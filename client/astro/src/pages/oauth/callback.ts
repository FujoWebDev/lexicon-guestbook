import type { APIRoute } from "astro";
import {
  createSession,
  generateSessionToken,
  oauthClient,
  setSessionTokenCookie,
} from "../../lib/auth";

export const GET: APIRoute = async ({ params, request, redirect, cookies }) => {
  const requestUrl = new URL(request.url);
  const { session: oauthSession } = await oauthClient.callback(
    requestUrl.searchParams
  );

  const token = generateSessionToken();
  const session = await createSession(token, oauthSession.did);
  setSessionTokenCookie(cookies, token, session.expiresAt);

  return redirect(`/${oauthSession.did}`);
};
