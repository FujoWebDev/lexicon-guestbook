import express from "express";
import { createServer } from "../client/generated/server/index.js";
import { AtpBaseClient } from "../client/generated/api/index.js";
import { getGuestbook, getGuestbooksByUser } from "./lib/book.js";
import { getSubmissionByGuestbook } from "./lib/submission.js";
import { OutputSchema as GuestbookOutput } from "../client/generated/server/types/com/fujocoded/guestbook/getGuestbooks.js";
import { readFileSync } from "node:fs";
import { createRoutes } from "./routes/auth.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { handler as ssrHandler } from "./site/dist/server/entry.mjs";

import {
  deleteSessionTokenCookie,
  getLoggedInClient,
  oauthClient,
  setSessionTokenCookie,
  validateSessionToken,
} from "./lib/auth.js";

const pubKey = readFileSync("./public_key.pem", "utf-8");
const PORT = process.env.PORT ?? "3003";

const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded());
app.use(
  cors({
    origin: "*",
  })
);

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

  const loggedInClient = await getLoggedInClient(req, res);

  const guestbookData = await getGuestbook({
    guestbookKey,
    ownerDid,
  });

  res.send(
    `
<html>
<body>
   ${!!guestbookData?.title && `<h1>${guestbookData?.title}</h1>`}
   ${loggedInClient && `<h2>Welcome ${loggedInClient.did}</h2>`}
   <div class="submissions">
      ${guestbookData?.submissions
        .map(
          (submission) =>
            `<article><p><span class="author">${submission.author.did}</span> says: <span class="text">${submission.text}</span></p><datetime>${submission.createdAt}</datetime></article>`
        )
        .join("\n")}
   </div>
   <form action="/guestbook/did:plc:r2vpg2iszskbkegoldmqa322/com.fujocoded.guestbook.book/emotional-support" method="POST">
        <input name="message" placeholder="your text" />

        <button type="submit">Submit</button>
   </form>
</body>
</html>
`
  );
});

app.post(
  "/guestbook/:ownerDid/:collection/:guestbookKey/",
  async (req, res) => {
    const { ownerDid, guestbookKey } = req.params;
    const { message } = req.body;

    const loggedInClient = await getLoggedInClient(req, res);

    if (!loggedInClient) {
      res.sendStatus(500);
    }

    const guestbookAgent = new AtpBaseClient(
      loggedInClient!.fetchHandler.bind(loggedInClient)
    );

    const createReult =
      await guestbookAgent.com.fujocoded.guestbook.submission.create(
        {
          repo: loggedInClient!.did,
        },
        {
          createdAt: new Date().toISOString(),
          postedTo: `at://${ownerDid}/com.fujocoded.guestbook.book/${guestbookKey}`,
          text: message,
        }
      );

    if (createReult.uri) {
      res.status(200).send(createReult.uri);
    }
    res.sendStatus(500);
  }
);

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

createRoutes(app);

app.use("/", express.static("site/dist/client/"));
app.use(ssrHandler);

app.use(server.xrpc.router);
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
