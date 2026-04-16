import type { APIContext } from "astro";
import { DidResolver } from "@atproto/identity";
import { Client } from "@atproto/lex";

import { GUESTBOOK_APPVIEW_DOMAIN } from "astro:env/client";

export const getGuestbookAgent = async (locals: APIContext["locals"]) => {
  return new Client(
    locals.loggedInUser?.loggedInClient ?? "https://public.api.bsky.app",
    {
      service: `did:web:${GUESTBOOK_APPVIEW_DOMAIN}#guestbook_appview`,
    },
  );
};

const IDENTITY_RESOLVER = new DidResolver({});
export const didToHandle = async (did: string) => {
  const atprotoData = await IDENTITY_RESOLVER.resolveAtprotoData(did);
  return atprotoData.handle;
};
