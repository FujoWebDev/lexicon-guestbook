/**
 * Goes through the guestbook appview server to get all the guestbook records
 * owned by a user. This is the unauthenticated version of
 * `get-guestbooks-auth.ts`.
 *
 * Note this is different from the `list-guestbook-records.ts` script. This script goes
 * to our appview server and gets its augmented view of the guestbooks, which
 * includes metadata like the number of submissions. Instead,
 * `list-guestbook-records.ts` goes to a user's PDS and gets the raw records.
 */
import { getDid } from "./lib/atproto.ts";
import { AtpBaseClient as GuestbookClient } from "../generated/api/index.ts";
import "dotenv/config";

const GUESTBOOK_APPVIEW_URL = new URL("https://worktop.tail2ad46.ts.net/");
const GUESTBOOK_APPVIEW_DID = `did:web:${GUESTBOOK_APPVIEW_URL.hostname}`;

const USER_HANDLE_OR_DID = "essentialrandom.bsky.social"; // Could also be "did:plc:r2vpg2iszskbkegoldmqa322"

const did = await getDid({ didOrHandle: USER_HANDLE_OR_DID });

if (!did) {
  throw new Error(`Did not resolve to a valid DID: ${USER_HANDLE_OR_DID}`);
}

const guestbookAgent = new GuestbookClient(GUESTBOOK_APPVIEW_URL);

console.log(`Sending request directly to ${GUESTBOOK_APPVIEW_DID}`);

const response = await guestbookAgent.com.fujocoded.guestbook.getGuestbooks({
  ownerDid: did,
});
console.dir(response.data, { depth: null });
