import express from "express";
import { createServer } from "../client/generated/server/index.js";
import { getGuestbook, getGuestbooksByUser } from "./lib/book.js";
import { getSubmissionByGuestbook } from "./lib/submission.js";
import { OutputSchema as GuestbookOutput } from "../client/generated/server/types/com/fujocoded/guestbook/getGuestbooks.js";
import { readFileSync } from "node:fs";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { verifyJwt, parseReqNsid, XRPCError } from "@atproto/xrpc-server";
import { IdResolver } from "@atproto/identity";

const pubKey = readFileSync("./public_jwk.json", "utf-8");
const PORT = process.env.PORT ?? "3003";

const app = express();
// TODO: these might need to be removed now that the Astro client is separate
app.use(cookieParser());
// Make sure that this bodyParser is json or it will cause problems with the
// handling of the Astro actions
app.use(bodyParser.json());

const IDENTITY_RESOLVER = new IdResolver({});
const APPVIEW_DOMAIN = process.env.APPVIEW_DOMAIN ?? "worktop.tail2ad46.ts.net";
const APPVIEW_DID = "did:web:" + APPVIEW_DOMAIN;
app.get("/.well-known/did.json", (_, res) => {
  res.json({
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/multikey/v1",
      "https://w3id.org/security/suites/secp256k1-2019/v1",
    ],
    id: APPVIEW_DID,
    verificationMethod: [
      {
        id: APPVIEW_DID + "#atproto",
        type: "Multikey",
        controller: APPVIEW_DID,
        // TODO: figure out what to do with this
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

const server = createServer({
  validateResponse: false,
  payload: {
    jsonLimit: 100 * 1024, // 100kb
    textLimit: 100 * 1024, // 100kb
    // no blobs
    blobLimit: 0,
  },
  // @ts-expect-error TODO: investigate why this discrepancy
  // TODO: also investigate why there's no way to stop errors being swallowed
  errorParser: (err) => {
    console.error(err);
    return XRPCError.fromError(err);
  },
});

export const getDidInAuth = async (
  req: express.Request
): Promise<null | string> => {
  const { authorization = "" } = req.headers;
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }
  const jwt = authorization.replace("Bearer ", "").trim();
  const nsid = parseReqNsid(req);

  try {
    const token = await verifyJwt(
      jwt,
      APPVIEW_DID,
      nsid,
      async (did: string) => {
        return await IDENTITY_RESOLVER.did.resolveAtprotoKey(did);
      }
    );

    return token.iss;
  } catch (e) {
    // We do not consider it an error to have an expired or invalid token here
    return null;
  }
};

server.com.fujocoded.guestbook.getGuestbook({
  handler: async ({ params, req, auth }) => {
    const [guestbookKey, _collectionType, ownerDid] = params.guestbookAtUri
      .split("/")
      .toReversed();

    const isOwnGuestbook = (await getDidInAuth(req)) === ownerDid;

    const guestbookData = await getGuestbook({
      guestbookKey,
      ownerDid,
    });

    // TODO: show deleted guestbooks that still have submissions to the
    // guestbook owner
    if (!guestbookData || guestbookData.isDeleted) {
      return {
        status: 404,
        message: "Guestbook not found",
      };
    }

    const showHiddenSubmissions = params.showHidden && isOwnGuestbook;
    const guestbookResponse = {
      atUri: params.guestbookAtUri,
      ...guestbookData,
      submissions: showHiddenSubmissions
        ? guestbookData.submissions
        : guestbookData.submissions.filter(
            (submission) => !submission.hidden && !submission.authorBlocked
          ),
    };

    return {
      encoding: "application/json",
      body: guestbookResponse,
    };
  },
  // TODO: figure out if you can truly use this one for auth
  // auth: () => {

  // }
});

server.com.fujocoded.guestbook.getGuestbooks({
  handler: async ({ req, params }) => {
    const userDid = params.ownerDid;
    const guestbooksData = await getGuestbooksByUser({ userDid });
    const guestbooks: GuestbookOutput["guestbooks"] = await Promise.all(
      guestbooksData
        .filter((guestbook) => !guestbook.isDeleted)
        .map(async (guestbook) => {
          const submissions = await getSubmissionByGuestbook({
            guestbookKey: guestbook.recordKey,
            collectionType: guestbook.collection,
            ownerDid: userDid,
          });

          const isOwnGuestbook = (await getDidInAuth(req)) === userDid;

          return {
            title: guestbook.title ?? undefined,
            atUri: `at://${guestbook.ownerDid}/${guestbook.collection}/${guestbook.recordKey}`,
            owner: {
              did: guestbook.ownerDid,
            },
            submissionsCount: submissions.filter(
              (submission) => !submission.hiddenAt && !submission.authorBlocked
            ).length,
            hiddenSubmissionsCount: isOwnGuestbook
              ? submissions.filter(
                  (submission) =>
                    !!submission.hiddenAt && !submission.authorBlocked
                ).length
              : undefined,
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
