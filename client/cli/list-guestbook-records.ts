/**
 * Lists all the guestbook records owned by the user. Unlike
 * `list-guestbook-records-auth.ts`, this script's request is unauthenticated.
 *
 * Note this is different from the `get-guestbooks.ts` script. This script goes
 * to a user's PDS and lists raw records. `get-guestbooks.ts` goes to our
 * appview server and gets the guestbooks.
 */
import { Agent } from "@atproto/api";
import { getPdsUrl, getDid } from "./lib/atproto.ts";

const USER_HANDLE_OR_DID = "essentialrandom.bsky.social"; // Could also be "did:plc:r2vpg2iszskbkegoldmqa322"

const did = await getDid({ didOrHandle: USER_HANDLE_OR_DID });

if (!did) {
  throw new Error(`Did not resolve to a valid DID: ${USER_HANDLE_OR_DID}`);
}

const pdsUrl = await getPdsUrl({ didOrHandle: did });

const agent = new Agent(pdsUrl);

const records = await agent.com.atproto.repo.listRecords({
  repo: did,
  collection: "com.fujocoded.guestbook.book",
});

if (!records.success) {
  console.log("There was an error listing the records");
  console.error(records);
  process.exit(1);
}

console.dir(records.data, { depth: null });

// If we wanted to get a specific record, we could do so with getRecord
// and an rkey.
// const record = await agent.com.atproto.repo.getRecord({
//   repo: did,
//   collection: "com.fujocoded.guestbook.book",
//   rkey: "emotional-support",
// });
