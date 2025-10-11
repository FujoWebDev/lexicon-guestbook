/**
 * Makes an authenticated request. In this case, it lists all the guestbook records
 * owned by the user.
 *
 * Note this is different from the `get-guestbooks.ts` script. That script makes a
 * request to our appview server to get the guestbooks, instead of going to a user's
 * PDS and listing the raw records.
 */
import { Agent } from "@atproto/api";
import {
  startAuthServer,
  waitForAuthCallback,
} from "./lib/oauth/oauth-server.ts";
import { createClient } from "./lib/oauth/oauth-client.ts";
import { randomBytes } from "node:crypto";

const USER_HANDLE_OR_DID = "essentialrandom.bsky.social"; // Could also be "did:plc:r2vpg2iszskbkegoldmqa322"

const oauthClient = await createClient();

const authServerAddress = await startAuthServer();

console.log("OAuth server is running at", authServerAddress);
console.log("\n******************************************************");
console.log("Requesting authorization...");

const authResponsePromise = waitForAuthCallback();
const url = await oauthClient.authorize(USER_HANDLE_OR_DID, {
  scope: "atproto",
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

console.log("Getting record...");
const agent = new Agent(session);
const record = await agent.com.atproto.repo.listRecords(
  {
    repo: session.did,
    collection: "com.fujocoded.guestbook.book",
  },
  {}
);

if (!record.success) {
  console.log("There was an error getting the record");
  console.error(record);
  process.exit(1);
}

console.dir(record.data, { depth: null });
