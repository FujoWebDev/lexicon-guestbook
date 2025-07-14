import { BskyAgent } from "@atproto/api";
import { AtpBaseClient } from "../generated/api/index.js";
import "dotenv/config";

const GUESTBOOK_APPVIEW_DID = "did:web:worktop.tail2ad46.ts.net";

const agent = new BskyAgent({ service: "https://bsky.social" });
await agent.login({
  identifier: "essentialrandom.bsky.social",
  password: process.env.APP_PASSWORD!,
});

console.log(agent.did);

const guestbookAgent = new AtpBaseClient(agent.fetchHandler);
// TODO: check how to turn on logging for invalid responses
guestbookAgent.setHeader(
  "atproto-proxy",
  `${GUESTBOOK_APPVIEW_DID}#guestbook_appview`
);

console.dir(
  await guestbookAgent.com.fujocoded.guestbook.getGuestbook(
    {
      guestbookAtUri:
        "at://did:plc:r2vpg2iszskbkegoldmqa322/com.fujocoded.guestbook.book/emotional-support",
    },
    {}
  ),
  { depth: null }
);
