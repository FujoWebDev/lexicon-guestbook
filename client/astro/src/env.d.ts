/// <reference types="astro/client" />

namespace App {
  interface Locals extends Record<string, any> {
    loggedInDid: string | undefined;
    loggedInHandle: string | undefined;
  }
}
