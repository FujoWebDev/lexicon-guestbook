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
  createGuestbook: defineAction({
    accept: "form",
    input: z.object({
      key: z.string().min(3).max(10),
      title: z.string().max(200),
    }),
    handler: async (input, context) => {
      const guestbookClient = context.locals.guestbookAgent;
      const data = await guestbookClient.com.fujocoded.guestbook.book.create(
        {
          repo: context.locals.loggedInClient.did,
          rkey: input.key,
        },
        {
          title: input.title,
        }
      );

      return data;
    },
  }),
};
