import { JoseKey } from "@atproto/jwk-jose";
import { writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUBLIC_KEY_PATH = path.resolve(process.cwd(), "public_jwk.json");
const PRIVATE_KEY_PATH = path.resolve(process.cwd(), "private_jwk.json");

if (existsSync(PUBLIC_KEY_PATH) || existsSync(PRIVATE_KEY_PATH)) {
  throw new Error(
    "Either private key or public key already exist. Remove them to genreate new ones."
  );
}

const key = await JoseKey.generate();

writeFileSync(PUBLIC_KEY_PATH, JSON.stringify(key.publicJwk));
writeFileSync(PRIVATE_KEY_PATH, JSON.stringify(key.privateJwk));
