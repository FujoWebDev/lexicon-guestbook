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

const createReult =
  await guestbookAgent.com.fujocoded.guestbook.submission.create(
    {
      repo: session.did,
    },
    {
      createdAt: new Date().toISOString(),
      // This is the AtUri of the guestbook you want to post to. You can use
      // pdsls.dev to look at at PDSes and find AtURIs.
      // See Ms Boba's here: https://pdsls.dev/at://did:plc:r2vpg2iszskbkegoldmqa322/com.fujocoded.guestbook.book/emotional-support
      postedTo:
        "at://did:plc:r2vpg2iszskbkegoldmqa322/com.fujocoded.guestbook.book/emotional-support",
      text: `${session.did} was here!`,
    }
  );

console.dir(createReult, { depth: null });
