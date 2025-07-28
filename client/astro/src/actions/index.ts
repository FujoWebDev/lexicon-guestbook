import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getGuestbookAgent } from "../lib/atproto";

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
        await getGuestbookAgent().com.fujocoded.guestbook.submission.create(
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
      const data =
        await getGuestbookAgent().com.fujocoded.guestbook.book.create(
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
