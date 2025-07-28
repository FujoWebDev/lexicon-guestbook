/// <reference types="astro/client" />

namespace App {
  interface Locals extends Record<string, any> {
    loggedInClient: null | import("@atproto/oauth-client-node").OAuthSession;
    guestbookAgent:
      | import("../../../client/generated/api/index.ts").AtpBaseClient
      | null;
  }
}
