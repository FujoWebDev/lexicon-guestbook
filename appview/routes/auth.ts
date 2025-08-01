import { Express } from "express";
import { Agent } from "@atproto/api";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";

export const createRoutes = (app: Express) => {
  app.get("/client-metadata.json", (_req, res) => {
    // res.json(oauthClient.clientMetadata).send();
  });

  app.get("/jwks.json", (_req, res) => {
    // res.json(oauthClient.jwks).send();
  });
};
