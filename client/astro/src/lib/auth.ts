import {
  NodeOAuthClient,
  type NodeSavedStateStore,
  type NodeSavedSession,
  type NodeSavedSessionStore,
  type NodeSavedState,
} from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { AuthSession, BskyAuthSession, BskyAuthState } from "../db/schema.js";
import { eq, type InferSelectModel } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import type { AstroCookies } from "astro";

const ALLOWED_SCOPES = "atproto transition:generic";
const REDIRECT_PATH = "/oauth/callback";
const DAYS_IN_MS = 1000 * 60 * 60 * 24;
const SESSION_DURATION_DAYS = 30;
const RENEWAL_THRESHOLD_DAYS = 15;

export class StateStore implements NodeSavedStateStore {
  async get(key: string): Promise<NodeSavedState | undefined> {
    const result = await db
      .select()
      .from(BskyAuthState)
      .where(eq(BskyAuthState.key, key))
      .limit(1);
    if (!result?.length) return;
    return JSON.parse(result[0].state!) as NodeSavedState;
  }
  async set(key: string, val: NodeSavedState) {
    const state = JSON.stringify(val);
    await db.insert(BskyAuthState).values({ key, state }).onConflictDoUpdate({
      target: BskyAuthState.key,
      set: { state },
    });
  }
  async del(key: string) {
    await db.delete(BskyAuthState).where(eq(BskyAuthState.key, key));
  }
}

export class SessionStore implements NodeSavedSessionStore {
  async get(key: string): Promise<NodeSavedSession | undefined> {
    const result = await db
      .select()
      .from(BskyAuthSession)
      .where(eq(BskyAuthSession.key, key))
      .limit(1);
    if (!result?.length) return;
    return JSON.parse(result[0].session!) as NodeSavedSession;
  }
  async set(key: string, val: NodeSavedSession) {
    const session = JSON.stringify(val);
    await db
      .insert(BskyAuthSession)
      .values({ key, session })
      .onConflictDoUpdate({
        target: BskyAuthSession.key,
        set: { session },
      });
  }
  async del(key: string) {
    await db.delete(BskyAuthSession).where(eq(BskyAuthSession.key, key));
  }
}

const createClient = async (domain: string) => {
  // In local clients configuration for allowed scopes and redirects
  // is done through search params
  // See: https://atproto.com/specs/oauth#clients
  const LOCAL_SEARCH_PARAMS = new URLSearchParams({
    scope: ALLOWED_SCOPES,
    redirect_uri: new URL(REDIRECT_PATH, domain).toString(),
  });
  const IS_DEVELOPMENT = import.meta.env.DEV;

  return new NodeOAuthClient({
    clientMetadata: {
      client_name: "ATProto Guestbook",
      client_id: IS_DEVELOPMENT
        ? `http://localhost?${LOCAL_SEARCH_PARAMS.toString()}`
        : new URL("/client-metadata.json", domain).toString(),
      client_uri: domain,
      redirect_uris: [new URL(REDIRECT_PATH, domain).toString()],
      scope: ALLOWED_SCOPES,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "none",
      dpop_bound_access_tokens: true,
      jwks_uri: new URL("/jwks.json", domain).toString(),
    },
    keyset: await Promise.all([JoseKey.generate()]),
    stateStore: new StateStore(),
    sessionStore: new SessionStore(),
  });
};

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

export async function createSession(token: string, userDid: string) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session = {
    id: sessionId,
    userDid,
    expiresAt: Date.now() + DAYS_IN_MS * SESSION_DURATION_DAYS,
  };
  await db.insert(AuthSession).values(session);
  return session;
}

export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const result = await db
    .select()
    .from(AuthSession)
    .where(eq(AuthSession.id, sessionId));
  if (result.length < 1) {
    return { session: null };
  }
  const session = result[0];
  if (!session.expiresAt || Date.now() >= session.expiresAt) {
    await invalidateSession(sessionId);
    return { session: null };
  }
  if (Date.now() >= session.expiresAt - DAYS_IN_MS * RENEWAL_THRESHOLD_DAYS) {
    session.expiresAt = Date.now() + DAYS_IN_MS * SESSION_DURATION_DAYS;
    await db
      .update(AuthSession)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(AuthSession.id, session.id));
  }
  return { session };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(AuthSession).where(eq(AuthSession.id, sessionId));
}

export type SessionValidationResult = {
  session: InferSelectModel<typeof AuthSession> | null;
};

export function setSessionTokenCookie(
  cookie: AstroCookies,
  token: string,
  expiresAt: number
): void {
  cookie.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expires: new Date(expiresAt),
    path: "/",
  });
}

export function deleteSessionTokenCookie(cookie: AstroCookies): void {
  cookie.delete("session");
}

const DOMAIN = process.env.EXTERNAL_DOMAIN ?? "http://127.0.0.1:4321/";
export const oauthClient = await createClient(DOMAIN);

export const getLoggedInClient = async (cookies: AstroCookies) => {
  const sessionToken = cookies.get("session");
  if (sessionToken) {
    const { session } = await validateSessionToken(sessionToken.value);
    if (session == null) {
      deleteSessionTokenCookie(cookies);
    } else {
      // Check that the BlueSky session is valid
      try {
        const client = await oauthClient.restore(session.userDid!);
        setSessionTokenCookie(cookies, sessionToken.value, session.expiresAt!);
        return client;
      } catch (e) {
        // The session is valid but the oauthToken for BSky has expired.
        deleteSessionTokenCookie(cookies);
      }
    }
  }
  return null;
};
