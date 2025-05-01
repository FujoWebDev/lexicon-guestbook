import express from "express";
import { createServer } from "../client/generated/server/index.js";
import { getGuestbooksByUser } from "./lib/book.js";
import { getSubmissionByGuestbook } from "./lib/submission.js";
import { OutputSchema as GuestbookOutput } from "../client/generated/server/types/com/fujocoded/guestbook/getGuestbooks.js";
import { readFileSync } from "node:fs";

const pubKey = readFileSync("./public_key.pem", "utf-8");
const PORT = process.env.PORT ?? "3000";

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

const DOMAIN = "worktop.tail2ad46.ts.net";
app.get("/.well-known/did.json", (_, res) => {
  res.json({
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/multikey/v1",
      "https://w3id.org/security/suites/secp256k1-2019/v1",
    ],
    id: "did:web:" + DOMAIN,
    verificationMethod: [
      {
        id: "did:web:" + DOMAIN + "#atproto",
        type: "Multikey",
        controller: "did:web:" + DOMAIN,
        publicKeyMultibase: pubKey,
      },
    ],
    service: [
      {
        id: "#guestbook_appview",
        type: "GuestbookAppView",
        serviceEndpoint: "https://" + DOMAIN,
      },
    ],
  });
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
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
