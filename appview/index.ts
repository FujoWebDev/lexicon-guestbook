import express from "express";
import { createServer } from "../client/generated/server/index.js";
import { getGuestbook, getGuestbooksByUser } from "./lib/book.js";
import { getSubmissionByGuestbook } from "./lib/submission.js";
import { OutputSchema as GuestbookOutput } from "../client/generated/server/types/com/fujocoded/guestbook/getGuestbooks.js";
import { readFileSync } from "node:fs";
import { get } from "node:http";

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

app.get("/guestbook/:ownerDid/:collection/:guestbookKey/", async (req, res) => {
  const { ownerDid, guestbookKey } = req.params;

  const guestbookData = await getGuestbook({
    guestbookKey,
    ownerDid,
  });

  res.send(
    `
<html>
<body>
   ${!!guestbookData?.title && `<h1>${guestbookData?.title}</h1>`}
   <div class="submissions">
      ${guestbookData?.submissions
        .map(
          (submission) =>
            `<article><p><span class="author">${submission.author.did}</span> says: <span class="text">${submission.text}</span></p><datetime>${submission.createdAt}</datetime></article>`
        )
        .join("\n")}
   </div>
</body>
</html>
`
  );
});

server.com.fujocoded.guestbook.getGuestbook({
  handler: async ({ params }) => {
    const [guestbookKey, _collectionType, ownerDid] = params.guestbookAtUri
      .split("/")
      .toReversed();
    const guestbookData = await getGuestbook({
      guestbookKey,
      ownerDid,
    });

    const guestbookResponse = {
      atUri: params.guestbookAtUri,
      ...guestbookData,
    };

    return {
      encoding: "application/json",
      body: guestbookResponse,
    };
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
          atUri: `at://${guestbook.ownerDid}/${guestbook.collection}/${guestbook.recordKey}`,
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
