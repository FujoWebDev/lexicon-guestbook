import { AtUri, BskyAgent } from "@atproto/api";
import { AtpBaseClient } from "../generated/api/index.js";
import "dotenv/config";

const agent = new BskyAgent({ service: "https://bsky.social" });
await agent.login({
  identifier: "essentialrandom.bsky.social",
  password: process.env.APP_PASSWORD!,
});

const guestbookAgent = new AtpBaseClient(agent.fetchHandler);

// DELETE ALL SUBMISSION

const allSubmissions =
  await guestbookAgent.com.fujocoded.guestbook.submission.list({
    repo: "essentialrandom.bsky.social",
  });

for (const submission of allSubmissions.records) {
  const rkey = new AtUri(submission.uri).rkey;
  await guestbookAgent.com.fujocoded.guestbook.submission.delete({
    repo: "essentialrandom.bsky.social",
    rkey: rkey,
  });
}

// DELETE ALL GUESTBOOKS

const allGuestbooks = await guestbookAgent.com.fujocoded.guestbook.book.list({
  repo: "essentialrandom.bsky.social",
});

for (const guestbook of allGuestbooks.records) {
  const rkey = new AtUri(guestbook.uri).rkey;
  await guestbookAgent.com.fujocoded.guestbook.book.delete({
    repo: "essentialrandom.bsky.social",
    rkey: rkey,
  });
}
