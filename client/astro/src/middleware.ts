import { getActionContext } from "astro:actions";
import { actions } from "astro:actions";
import { deleteSessionTokenCookie, getLoggedInClient } from "./lib/auth";
import { didToHandle } from "./lib/atproto";

const LOGIN_ACTION_NAME = "login" satisfies keyof typeof actions;
const LOGOUT_ACTION_NAME = "logout" satisfies keyof typeof actions;

export async function onRequest(context, next) {
  const { action } = getActionContext(context);

  const loggedInClient = await getLoggedInClient(context.cookies);

  if (loggedInClient?.did && !context.locals.loggedInDid) {
    context.locals.loggedInDid = loggedInClient.did;
    context.locals.loggedInHandle = await didToHandle(loggedInClient.did);
  }

  if (action?.name == LOGIN_ACTION_NAME) {
    const { data } = await action.handler();
    if (data.redirectUrl) {
      return context.redirect(data.redirectUrl);
    }
  }

  if (action?.name == LOGOUT_ACTION_NAME) {
    const { data } = await action.handler();
    if (data) {
      context.locals.loggedInDid = undefined;
      context.locals.loggedInHandle = undefined;
      // TODO: check if it gets called on its own when logging out
      deleteSessionTokenCookie(context.cookies);
      return context.redirect("/");
    }
  }

  return next();
}
