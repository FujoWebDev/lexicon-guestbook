import {
  NodeOAuthClient,
  type NodeOAuthClientOptions,
} from "@atproto/oauth-client-node";
import { JoseKey } from "@atproto/jwk-jose";
import { StateStore, SessionStore } from "./auth-storage-unstorage.ts";

export const CALLBACK_PATH = "/oauth/callback";
export const JWKS_PATH = "/jwks.json";
export const CLIENT_METADATA_PATH = "/client-metadata.json";
export const JWKS = await JoseKey.generate();
export const LOCAL_SERVER_PORT = process.env.LOCAL_SERVER_PORT ?? "3000";

const DOMAIN = new URL(process.env.EXTERNAL_DOMAIN ?? "http://127.0.0.1/");
const IS_LOCALHOST = DOMAIN.hostname === "127.0.0.1";

// In local clients configuration for allowed scopes and redirects
// is done through search params. In that case, the client ID must
// also be "localhost" (not 127.0.0.1).
// See: https://atproto.com/specs/oauth#clients
const CLIENT_ID = new URL(IS_LOCALHOST ? "http://localhost" : DOMAIN);
if (IS_LOCALHOST) {
  DOMAIN.port = LOCAL_SERVER_PORT;

  CLIENT_ID.searchParams.set("scope", "atproto");
  CLIENT_ID.searchParams.set(
    "redirect_uri",
    new URL(CALLBACK_PATH, DOMAIN).toString()
  );
}

export const CLIENT_METADATA: NodeOAuthClientOptions["clientMetadata"] = {
  client_name: "ATProto Guestbook",
  client_id: IS_LOCALHOST
    ? CLIENT_ID.href
    : new URL(CLIENT_METADATA_PATH, CLIENT_ID).toString(),
  client_uri: DOMAIN.href,
  redirect_uris: [new URL(CALLBACK_PATH, DOMAIN).href],
  scope: "atproto",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  application_type: "web",
  token_endpoint_auth_method: "none",
  dpop_bound_access_tokens: true,
  jwks_uri: new URL(JWKS_PATH, DOMAIN).toString(),
} as const;

export const createClient = async () => {
  return new NodeOAuthClient({
    clientMetadata: CLIENT_METADATA,
    keyset: [JWKS],
    stateStore: new StateStore(),
    sessionStore: new SessionStore(),
  });
};
