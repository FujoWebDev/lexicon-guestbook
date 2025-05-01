import express from "express";
import { createServer } from "../client/generated/server/index.js";
import { getGuestbooksByUser } from "./lib/book.js";
import { getSubmissionByGuestbook } from "./lib/submission.js";
import { OutputSchema as GuestbookOutput } from "../client/generated/server/types/com/fujocoded/guestbook/getGuestbooks.js";

const app = express();
let server = createServer({
  validateResponse: false,
  payload: {
    jsonLimit: 100 * 1024, // 100kb
    textLimit: 100 * 1024, // 100kb
    // no blobs
    blobLimit: 0,
  },
});

server.com.fujocoded.guestbook.getGuestbooks({
  handler: async ({ params }) => {
    const userDid = params.ownerDid;
    const guestbooksData = await getGuestbooksByUser({ userDid });
    const guestbooks: GuestbookOutput["guestbooks"] = await Promise.all(
      guestbooksData.map(async (guestbook) => {
        const submissions = await getSubmissionByGuestbook({
          guestbookKey: guestbook.recordKey,
          collectionType: guestbook.collection,
          ownerDid: userDid,
        });

        return {
          uri: `at://${guestbook.ownerDid}/${guestbook.collection}/${guestbook.recordKey}`,
          owner: {
            did: guestbook.ownerDid,
          },
          submissionsCount: submissions.length,
        };
      })
    );

    return {
      encoding: "application/json",
      body: {
        guestbooks,
      },
    };
  },
});

app.use(server.xrpc.router);
app.listen(3000, () => {
  console.log("listening");
});
