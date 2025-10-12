import { Agent } from "@atproto/api";
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

const callbackUrl = await authResponsePromise;
const { session } = await oauthClient.callback(callbackUrl.searchParams);

console.log("Authorization received!");
console.log("******************************************************\n");

const agent = new Agent(session);
const guestbookAgent = new AtpBaseClient(agent.fetchHandler);

const createReult = await guestbookAgent.com.fujocoded.guestbook.book.create(
  {
    repo: session.did,
    // This is the name of the "file" that will contain your guestbook data
    // within the 'com.fujocoded.guestbook.book' collection.
    rkey: "emotional-support",
  },
  {
    title: "My Emotional Support Guestbook",
  }
);

console.dir(createReult, { depth: null });
