import { defineMiddleware } from "astro:middleware";
import {
  ACTION_QUERY_PARAMS,
  getActionContext,
  type ActionClient,
} from "astro:actions";
import { randomUUID } from "node:crypto";
import type { APIContext } from "astro";

type ActionSessionEntry = {
  name: string;
  result: unknown;
  input?: Record<string, string>;
};

type LastAction = {
  queryString: string;
  input: Record<string, string>;
};

declare global {
  namespace App {
    interface Locals {
      lastAction?: LastAction;
    }
    interface SessionData {
      [key: `action:${string}`]: ActionSessionEntry | undefined;
    }
  }
}

// Reads the form input that produced the last action result, typed against the
// action you pass in. Only returns a value when THAT action was the last one
// run — we compare the stored action name against the one parsed from the
// action reference. Values are the raw pre-Zod form strings, so the view is
// narrowed to the input's string-keyed fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionLike = ActionClient<any, any, any>;

// Astro documents ActionClient.queryString, and Astro.getActionResult() uses
// it internally to match stored results back to a specific action.
const getActionQueryString = (action: ActionLike): string | undefined =>
  "queryString" in action ? action.queryString : undefined;

const createActionQueryString = (actionName: string): string =>
  `?${new URLSearchParams({ [ACTION_QUERY_PARAMS.actionName]: actionName }).toString()}`;

export function getActionInput<T extends ActionLike>(
  locals: App.Locals,
  action: T,
): Record<string, string> | undefined {
  const lastAction = locals.lastAction;
  if (!lastAction || lastAction.queryString !== getActionQueryString(action)) {
    return undefined;
  }
  return lastAction.input;
}

// Implements POST/Redirect/GET for form-invoked actions so refreshing doesn't
// re-submit the form. The action result is stashed in session storage under a
// per-submission UUID, with that UUID carried across the redirect in a cookie.
const ACTION_SESSION_COOKIE = "astro-action-session";
const ACTION_SESSION_TTL_SECONDS = 60;

// For error redirects, only trust same-origin Referer values. That keeps the
// user on the page where they submitted the form without turning this into an
// open redirect if the header is missing or spoofed.
const getSafeRefererPath = (context: APIContext) => {
  const referer = context.request.headers.get("Referer");
  if (!referer) return context.originPathname;

  try {
    const refererUrl = new URL(referer);
    if (refererUrl.origin !== context.url.origin) {
      return context.originPathname;
    }

    return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`;
  } catch {
    return context.originPathname;
  }
};

// Pulls text inputs out of a form submission. Clones the request so the action
// handler can still read the body itself (Request bodies can only be consumed
// once). File entries are dropped — they can't be stored as plain strings and
// aren't needed for the "which entry did this action target?" use case.
const readStringFormFields = async (
  request: Request,
): Promise<Record<string, string> | undefined> => {
  try {
    const formData = await request.clone().formData();
    return Object.fromEntries(
      Array.from(formData.entries()).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value] as const] : [],
      ),
    );
  } catch {
    return undefined;
  }
};

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) {
    return next();
  }

  const { action, setActionResult, serializeActionResult } =
    getActionContext(context);

  // If sessions are unavailable, fall back to Astro's default form action
  // flow instead of redirecting and losing the action result.
  if (!context.session) {
    context.cookies.delete(ACTION_SESSION_COOKIE, { path: "/" });
    return next();
  }

  const sessionId = context.cookies.get(ACTION_SESSION_COOKIE)?.value;
  if (sessionId) {
    // A prior form submission left us a cookie pointing at a stored result.
    // We rehydrate into the request so Astro.getActionResult() sees it, then clear
    // the single-use cookie + session entry.
    const stored = await context.session.get(`action:${sessionId}`);
    if (stored) {
      setActionResult(stored.name, stored.result as never);
      context.locals.lastAction = {
        queryString: createActionQueryString(stored.name),
        input: stored.input ?? {},
      };
      context.session.delete(`action:${sessionId}`);
      context.cookies.delete(ACTION_SESSION_COOKIE, { path: "/" });
      return next();
    }

    context.cookies.delete(ACTION_SESSION_COOKIE, { path: "/" });
  }

  // This branch gets activated right after the action is submitted via a form.
  // We run the action, and persist its result and input under a new UUID. On
  // error we bounce back to the Referer so the user sees the error in-place; on
  // success we go to the canonical route. This transforms the POST request into
  // a GET request, making the user experience of submitting the form much
  // smoother.
  if (action?.calledFrom === "form") {
    const input = await readStringFormFields(context.request);
    const result = await action.handler();

    const newSessionId = randomUUID();
    context.session.set(`action:${newSessionId}`, {
      name: action.name,
      result: serializeActionResult(result),
      input,
    });
    context.cookies.set(ACTION_SESSION_COOKIE, newSessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: ACTION_SESSION_TTL_SECONDS,
    });

    const redirectTo = result.error
      ? getSafeRefererPath(context)
      : context.originPathname;
    return context.redirect(redirectTo);
  }

  return next();
});
