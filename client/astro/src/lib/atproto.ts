import type { APIContext } from "astro";
import { AtpBaseClient as GuestbookClient } from "../../../../client/generated/api/index";
import { DidResolver } from "@atproto/identity";

const APPVIEW_DOMAIN = process.env.APPVIEW_DOMAIN ?? "worktop.tail2ad46.ts.net";

export const getGuestbookAgent = async (locals: APIContext["locals"]) => {
  const guestbookAgent = new GuestbookClient(
    locals.loggedInUser
      ? locals.loggedInUser.fetchHandler
      : { service: `https://${APPVIEW_DOMAIN}` }
  );
  guestbookAgent.setHeader(
    "atproto-proxy",
    `did:web:${APPVIEW_DOMAIN}#guestbook_appview`
  );

  return guestbookAgent;
};

const IDENTITY_RESOLVER = new DidResolver({});
export const didToHandle = async (did: string) => {
  const atprotoData = await IDENTITY_RESOLVER.resolveAtprotoData(did);
  return atprotoData.handle;
};
