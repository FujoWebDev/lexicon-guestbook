import { BskyAgent } from "@atproto/api";
import { AtpBaseClient } from "./generated/api/index.js";

const agent = new BskyAgent({ service: "https://bsky.social" });
await agent.login({
  identifier: "essentialrandom.bsky.social",
  password: process.env.APP_PASSWORD!,
});

console.log(agent.did);

const guestbookAgent = new AtpBaseClient(agent.fetchHandler);

const createReult = await guestbookAgent.com.fujocoded.guestbook.book.create(
  {
    repo: "essentialrandom.bsky.social",
    // This is the name of the "file" that will contain your guestbook data
    // within the 'com.fujocoded.guestbook.book' collection.
    rkey: "emotional-support",
  },
  {
    title: "Ms Boba's Emotional Support Guestbook",
  }
);

console.dir(createReult, { depth: null });
