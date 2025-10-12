/**
 * Goes through the guestbook appview server to get all the guestbook records
 * owned by a user. Unlike `get-guestbooks-auth.ts`, this script's request is
 * authenticated.
 *
 * Note this is different from the `list-guestbook-records-auth.ts` script. This
 * script goes to our appview server and gets its augmented view of the
 * guestbooks, which includes metadata like the number of submissions. Instead,
 * `list-guestbook-records-auth.ts` goes to a user's PDS and gets the raw
 * records.
 */
import { AtpBaseClient as GuestbookClient } from "../generated/api/index.ts";
import "dotenv/config";
import {
  startAuthServer,
  waitForAuthCallback,
} from "./lib/oauth/oauth-server.ts";
import { createClient } from "./lib/oauth/oauth-client.ts";
import { randomBytes } from "node:crypto";

const GUESTBOOK_APPVIEW_URL = new URL("https://worktop.tail2ad46.ts.net/");
const GUESTBOOK_APPVIEW_DID = `did:web:${GUESTBOOK_APPVIEW_URL.hostname}`;

const USER_HANDLE_OR_DID = "essentialrandom.bsky.social"; // Could also be "did:plc:r2vpg2iszskbkegoldmqa322"

const authServerAddress = await startAuthServer();

console.log("OAuth server is running at", authServerAddress);
console.log("\n******************************************************");
console.log("Requesting authorization...");

const authResponsePromise = waitForAuthCallback();

const oauthClient = await createClient();
const url = await oauthClient.authorize(USER_HANDLE_OR_DID, {
  scope: "atproto transition:generic",
  // This random value is used to protects against CSRF (Cross-Site Request
  // Forgery) attacks. We send it along our authorization request, and the OAuth
  // provider will send it back with the authentication response. By verifying
  // it matches what we sent, we can be sure the callback is in response to
  // OUR authorization request, not someone else's.
  state: randomBytes(16).toString("base64url"),
});

console.log("Go to this URL to authorize this request:\n");
console.log(url.href);

console.log("\nWaiting for authorization...");

const callbackUrl = await authResponsePromise;
const { session } = await oauthClient.callback(callbackUrl.searchParams);

console.log("Authorization received!");
console.log("******************************************************\n");

console.log(
  `Sending request to ${GUESTBOOK_APPVIEW_DID} through ${session.did}'s PDS`
);

// This agent uses the authenticated session's fetch handler to make requests.
// This goes through the user's PDS to sign the request.
const guestbookAgent = new GuestbookClient(session.fetchHandler.bind(session));
// But where does the users' PDS send the request to once it's signed?
// Wherever the "atproto-proxy" header tells it to go! In this case, to
// guestbook appview server.
guestbookAgent.setHeader(
  "atproto-proxy",
  `${GUESTBOOK_APPVIEW_DID}#guestbook_appview`
);

const response = await guestbookAgent.com.fujocoded.guestbook.getGuestbooks({
  // We ask the appview server to get the guestbooks for the user that
  // is currently authenticated
  ownerDid: session.did,
});
console.dir(response.data, { depth: null });
