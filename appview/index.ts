import express, { Response } from "express";
import { createServer } from "../client/generated/server/index.js";
import { AtpBaseClient } from "../client/generated/api/index.js";
import { getGuestbook, getGuestbooksByUser } from "./lib/book.js";
import { getSubmissionByGuestbook } from "./lib/submission.js";
import { OutputSchema as GuestbookOutput } from "../client/generated/server/types/com/fujocoded/guestbook/getGuestbooks.js";
import { readFileSync } from "node:fs";
import { createRoutes } from "./routes/auth.js";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { handler as ssrHandler } from "./site/dist/server/entry.mjs";

import { getLoggedInClient } from "./lib/auth.js";

const pubKey = readFileSync("./public_key.pem", "utf-8");
const PORT = process.env.PORT ?? "3003";

const app = express();
app.use(cookieParser());
// Make sure that this bodyParser is json or it will cause problems with the
// handling of the Astro actions
app.use(bodyParser.json());

let server = createServer({
  validateResponse: false,
  payload: {
    jsonLimit: 100 * 1024, // 100kb
    textLimit: 100 * 1024, // 100kb
    // no blobs
    blobLimit: 0,
  },
});

const APPVIEW_DOMAIN = "worktop.tail2ad46.ts.net";
app.get("/.well-known/did.json", (_, res) => {
  res.json({
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/multikey/v1",
      "https://w3id.org/security/suites/secp256k1-2019/v1",
    ],
    id: "did:web:" + APPVIEW_DOMAIN,
    verificationMethod: [
      {
        id: "did:web:" + APPVIEW_DOMAIN + "#atproto",
        type: "Multikey",
        controller: "did:web:" + APPVIEW_DOMAIN,
        publicKeyMultibase: pubKey,
      },
    ],
    service: [
      {
        id: "#guestbook_appview",
        type: "GuestbookAppView",
        serviceEndpoint: "https://" + APPVIEW_DOMAIN,
      },
    ],
  });
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

    if (!guestbookData) {
      return {
        status: 404,
        message: "Guestbook not found",
      };
    }

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
app.use(async (req, res, next) => {
  if (req.url.startsWith("/xrpc")) {
    return next();
  }

  const loggedInClient = await getLoggedInClient(req, res);
  const guestbookAgent = new AtpBaseClient(
    loggedInClient
      ? loggedInClient.fetchHandler.bind(loggedInClient)
      : { service: `https://${APPVIEW_DOMAIN}` }
  );
  if (loggedInClient) {
    guestbookAgent?.setHeader(
      "atproto-proxy",
      `did:web:${APPVIEW_DOMAIN}#guestbook_appview`
    );
  }
  const locals = {
    loggedInClient,
    guestbookAgent,
  };

  ssrHandler(req, res, next, locals);
});

app.use(server.xrpc.router);
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
