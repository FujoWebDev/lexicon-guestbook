import { defineAction } from "astro:actions";
import { z } from "astro:schema";

export const server = {
  postToGuestbook: defineAction({
    accept: "form",
    input: z.object({
      text: z.string(),
      // TODO: make an AtUri validator for zod
      postedTo: z.string(),
    }),
    handler: async (input, context) => {
      const result =
        await context.locals.guestbookAgent.com.fujocoded.guestbook.submission.create(
          {
            repo: context.locals.loggedInClient!.did,
          },
          {
            createdAt: new Date().toISOString(),
            postedTo: input.postedTo,
            text: input.text,
          }
        );

      return result.uri;
    },
  }),
};
