import type { APIContext } from "astro";
import { AtpBaseClient as GuestbookClient } from "../../../../client/generated/api/index";
import { DidResolver } from "@atproto/identity";
import { GUESTBOOK_APPVIEW_DOMAIN } from "astro:env/client";

export const getGuestbookAgent = async (locals: APIContext["locals"]) => {
  const guestbookAgent = new GuestbookClient(
    locals.loggedInUser
      ? locals.loggedInUser.fetchHandler
      : { service: `https://${GUESTBOOK_APPVIEW_DOMAIN}` }
  );
  guestbookAgent.setHeader(
    "atproto-proxy",
    `did:web:${GUESTBOOK_APPVIEW_DOMAIN}#guestbook_appview`
  );

  return guestbookAgent;
};

const IDENTITY_RESOLVER = new DidResolver({});
export const didToHandle = async (did: string) => {
  const atprotoData = await IDENTITY_RESOLVER.resolveAtprotoData(did);
  return atprotoData.handle;
};
