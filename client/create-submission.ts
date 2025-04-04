import { BskyAgent } from "@atproto/api";
import { AtpBaseClient } from "./generated/api/index.js";

const agent = new BskyAgent({ service: "https://bsky.social" });
await agent.login({
  identifier: "essentialrandom.bsky.social",
  password: process.env.APP_PASSWORD!,
});

console.log(agent.did);

const guestbookAgent = new AtpBaseClient(agent.fetchHandler);

const createReult =
  await guestbookAgent.com.fujocoded.guestbook.submission.create(
    {
      repo: "essentialrandom.bsky.social",
    },
    {
      createdAt: new Date().toISOString(),
      postedTo:
        "at://did:plc:r2vpg2iszskbkegoldmqa322/com.fujocoded.guestbook.book/emotional-support",
      text: "Welcome all that dare to enter! Please leave your message, it helps me keep going.",
    }
  );

console.dir(createReult, { depth: null });
