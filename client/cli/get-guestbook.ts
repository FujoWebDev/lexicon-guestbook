/**
 * Lists all the guestbook records owned by the user. Unlike
 * `list-guestbook-records.ts`, this script's request is authenticated.
 *
 * Note this is different from the `get-guestbooks.ts` script. This script goes to a user's
 * PDS and lists raw records. `get-guestbooks.ts` goes to our appview server and
 * gets the guestbooks.
 */
import { BskyAgent } from "@atproto/api";
import { AtpBaseClient } from "../generated/api/index.ts";
import "dotenv/config";

const GUESTBOOK_APPVIEW_DID = "did:web:worktop.tail2ad46.ts.net";

const agent = new BskyAgent({ service: "https://bsky.social" });
await agent.login({
  identifier: "essentialrandom.bsky.social",
  password: process.env.APP_PASSWORD!,
});

console.log(agent.did);

const guestbookAgent = new AtpBaseClient(agent.fetchHandler);
guestbookAgent.setHeader(
  "atproto-proxy",
  `${GUESTBOOK_APPVIEW_DID}#guestbook_appview`
);

console.dir(
  await guestbookAgent.com.fujocoded.guestbook.getGuestbooks({
    ownerDid: agent.did!,
  }),
  { depth: null }
);
