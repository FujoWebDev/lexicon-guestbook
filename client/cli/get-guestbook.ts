import { Agent } from "@atproto/api";
import { getPdsUrl, getDid } from "./lib/atproto.ts";

const USER_HANDLE_OR_DID = "essentialrandom.bsky.social"; // Could also be "did:plc:r2vpg2iszskbkegoldmqa322"
const GUESTBOOK_KEY = "emotional-support";

const did = await getDid({ didOrHandle: USER_HANDLE_OR_DID });

if (!did) {
  throw new Error(`Did not resolve to a valid DID: ${USER_HANDLE_OR_DID}`);
}

const pdsUrl = await getPdsUrl({ didOrHandle: did });

const agent = new Agent(pdsUrl);

const record = await agent.com.atproto.repo.getRecord({
  repo: did,
  collection: "com.fujocoded.guestbook.book",
  rkey: GUESTBOOK_KEY,
});

if (!record.success) {
  console.log("There was an error getting the record");
  console.error(record);
  process.exit(1);
}

console.dir(record.data, { depth: null });
