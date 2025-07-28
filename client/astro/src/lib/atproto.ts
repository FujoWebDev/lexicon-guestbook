import { AtpBaseClient } from "../../../../client/generated/api/index";

const APPVIEW_DOMAIN = process.env.APPVIEW_DOMAIN ?? "worktop.tail2ad46.ts.net";
export const getGuestbookAgent = () => {
  // const loggedInClient = await getLoggedInClient(req, res);
  const guestbookAgent = new AtpBaseClient(
    // loggedInClient
    //   ? loggedInClient.fetchHandler.bind(loggedInClient) :
    { service: `https://${APPVIEW_DOMAIN}` }
  );
  // if (loggedInClient) {
  guestbookAgent?.setHeader(
    "atproto-proxy",
    `did:web:${APPVIEW_DOMAIN}#guestbook_appview`
  );
  // }
  return guestbookAgent;
};
