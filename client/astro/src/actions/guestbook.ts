import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { AtUri } from "@atproto/api";
import { getGuestbookAgent } from "../lib/atproto";
import { AstroError } from "astro/errors";

export const actions = {
  postToGuestbook: defineAction({
    accept: "form",
    input: z.object({
      text: z.string(),
      // TODO: make an AtUri validator for zod
      postedTo: z.string(),
    }),
    handler: async (input, context) => {
      const guestbookAgent = await getGuestbookAgent(context.locals);
      const result =
        await guestbookAgent.com.fujocoded.guestbook.submission.create(
          {
            repo: context.locals.loggedInUser.did,
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
      key: z.string().min(3).max(30),
      title: z.string().max(200),
    }),
    handler: async (input, context) => {
      const guestbookAgent = await getGuestbookAgent(context.locals);
      const data = await guestbookAgent.com.fujocoded.guestbook.book.create(
        {
          repo: context.locals.loggedInUser.did,
          rkey: input.key,
        },
        {
          title: input.title,
        }
      );

      return data;
    },
  }),
  deletePost: defineAction({
    accept: "form",
    input: z.object({
      atUri: z.string(),
    }),
    handler: async (input, context) => {
      const guestbookAgent = await getGuestbookAgent(context.locals);
      const { rkey, host } = new AtUri(input.atUri);

      if (!context.locals.loggedInUser) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to delete a post",
        });
      }

      if (context.locals.loggedInUser.did !== host) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can only delete your own posts.",
        });
      }

      const data = await guestbookAgent.com.fujocoded.guestbook.book.delete({
        // repo: context.locals.loggedInUser.did,
        repo: host,
        rkey,
      });

      console.log(data);
      return data;
    },
  }),
};
