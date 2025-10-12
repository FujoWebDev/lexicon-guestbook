import { Agent, AtUri } from "@atproto/api";
import { AtpBaseClient } from "../generated/api/index.js";
import {
  startAuthServer,
  waitForAuthCallback,
} from "./lib/oauth/oauth-server.ts";
import { createClient } from "./lib/oauth/oauth-client.ts";
import { randomBytes } from "node:crypto";

const USER_HANDLE_OR_DID = "essentialrandom.bsky.social"; // Could also be "did:plc:r2vpg2iszskbkegoldmqa322"

const authServerAddress = await startAuthServer();

console.log("OAuth server is running at", authServerAddress);
console.log("\n******************************************************");
console.log("Requesting authorization...");

const authResponsePromise = waitForAuthCallback();

const oauthClient = await createClient();
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

console.log(
  "REMEMBER: AUTHORIZING THIS WILL DELETE ALL THEIR GUESTBOOKS AND SUBMISSIONS"
);
console.log("MAKE SURE YOU WANT TO DO THIS. THERE IS NO UNDO.");

const callbackUrl = await authResponsePromise;
const { session } = await oauthClient.callback(callbackUrl.searchParams);

console.log("Authorization received!");
console.log("******************************************************\n");

const agent = new Agent(session);
const guestbookAgent = new AtpBaseClient(agent.fetchHandler);

// DELETE ALL SUBMISSION

const allSubmissions =
  await guestbookAgent.com.fujocoded.guestbook.submission.list({
    repo: session.did,
  });

for (const submission of allSubmissions.records) {
  const rkey = new AtUri(submission.uri).rkey;
  await guestbookAgent.com.fujocoded.guestbook.submission.delete({
    repo: session.did,
    rkey: rkey,
  });
}

// DELETE ALL GUESTBOOKS

const allGuestbooks = await guestbookAgent.com.fujocoded.guestbook.book.list({
  repo: session.did,
});

for (const guestbook of allGuestbooks.records) {
  const rkey = new AtUri(guestbook.uri).rkey;
  await guestbookAgent.com.fujocoded.guestbook.book.delete({
    repo: session.did,
    rkey: rkey,
  });
}

// DELETE ALL GATES

const allGates = await guestbookAgent.com.fujocoded.guestbook.gate.list({
  repo: session.did,
});

for (const guestbook of allGates.records) {
  const rkey = new AtUri(guestbook.uri).rkey;
  await guestbookAgent.com.fujocoded.guestbook.book.delete({
    repo: session.did,
    rkey: rkey,
  });
}
