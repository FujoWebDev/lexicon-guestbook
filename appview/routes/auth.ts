import { Express } from "express";
import {
  createSession,
  generateSessionToken,
  oauthClient,
  setSessionTokenCookie,
} from "../lib/auth.js";
import { Agent } from "@atproto/api";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";

export const createRoutes = (app: Express) => {
  app.get("/client-metadata.json", (_req, res) => {
    res.json(oauthClient.clientMetadata).send();
  });

  app.get("/jwks.json", (_req, res) => {
    res.json(oauthClient.jwks).send();
  });

  app.get("/oauth/callback", async (req, res) => {
    console.dir(req.query);
    const { session: oauthSession } = await oauthClient.callback(
      // @ts-ignore
      new URLSearchParams(req.query)
    );

    const agent = new Agent(oauthSession);

    const token = generateSessionToken();
    const session = await createSession(token, agent.did!);
    setSessionTokenCookie(res, token, session.expiresAt);

    res.redirect(
      307,
      "/guestbook/did:plc:r2vpg2iszskbkegoldmqa322/com.fujocoded.guestbook.book/emotional-support"
    );
  });

  app.get("/oauth/authorize", async (req, res) => {
    // TODO: check if this state is good
    const state = encodeHexLowerCase(
      sha256(new TextEncoder().encode("mysalt"))
    );
    // @ts-ignore
    const url = await oauthClient.authorize(req.query.did, {
      scope: "atproto transition:generic",
      state,
    });
    res.redirect(307, url.toString());
  });
};
