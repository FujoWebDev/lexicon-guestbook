import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { oauthClient } from "../lib/auth";

export const actions = {
  login: defineAction({
    accept: "form",
    input: z.object({
      did: z.string(),
    }),
    handler: async (input, context) => {
      // TODO: check if this state is good
      const state = encodeHexLowerCase(
        sha256(new TextEncoder().encode("mysalt"))
      );
      try {
        const url = await oauthClient.authorize(input.did, {
          scope: "atproto transition:generic",
          state,
        });
        return { redirectUrl: url };
      } catch (e) {
        console.log(e.message);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "There was an unknown error",
        });
      }
    },
  }),
  logout: defineAction({
    accept: "form",
    handler: () => {},
  }),
};
