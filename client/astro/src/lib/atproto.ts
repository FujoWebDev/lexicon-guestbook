import type { AstroCookies } from "astro";
import { AtpBaseClient } from "../../../../client/generated/api/index";
import { DidResolver } from "@atproto/identity";
import { getLoggedInClient } from "./auth";

const APPVIEW_DOMAIN = process.env.APPVIEW_DOMAIN ?? "worktop.tail2ad46.ts.net";
export const getGuestbookAgent = async (cookies: AstroCookies) => {
  const loggedInClient = await getLoggedInClient(cookies);
  const guestbookAgent = new AtpBaseClient(
    loggedInClient
      ? loggedInClient.fetchHandler.bind(loggedInClient)
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
