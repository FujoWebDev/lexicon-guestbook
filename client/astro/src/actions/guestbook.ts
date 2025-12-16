import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { AtUri } from "@atproto/syntax";
import { getGuestbookAgent } from "../lib/atproto";
import { type Record as GateRecord } from "../../../generated/api/types/com/fujocoded/guestbook/gate";

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
  deleteGuestbook: defineAction({
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
          message: "You can only delete your own guestbooks.",
        });
      }

      // TODO: check if the record exists before deleting if you want
      // to warn the user in case of errors
      const data = await guestbookAgent.com.fujocoded.guestbook.book.delete({
        repo: context.locals.loggedInUser.did,
        rkey,
      });

      return data;
    },
  }),
  deleteSubmission: defineAction({
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

      // TODO: check if the record exists before deleting if you want
      // to warn the user in case of errors
      const data =
        await guestbookAgent.com.fujocoded.guestbook.submission.delete({
          repo: context.locals.loggedInUser.did,
          rkey,
        });

      return data;
    },
  }),
  hideSubmission: defineAction({
    accept: "form",
    input: z.object({
      atUri: z.string(),
      guestbookAtUri: z.string(),
    }),
    handler: async (input, context) => {
      const guestbookAgent = await getGuestbookAgent(context.locals);
      const { host } = new AtUri(input.atUri);

      if (!context.locals.loggedInUser) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to hide a post",
        });
      }

      if (context.locals.loggedInUser.did === host) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can only hide other people's posts.",
        });
      }

      // TODO: check if the record exists before hiding it if you want
      // to warn the user in case of errors

      const currentData = (
        await guestbookAgent.com.fujocoded.guestbook.gate
          .get({
            repo: context.locals.loggedInUser.did,
            rkey: "default",
          })
          .catch((e) => {
            if (e.error === "RecordNotFound") {
              // First time creating a gate, just return an empty one
              return { value: { hiddenSubmissions: [] } };
            }
            throw e;
          })
      ).value as GateRecord;

      const newSubmission = {
        hiddenAt: new Date().toISOString(),
        originallyPostedOn: input.guestbookAtUri,
        submissionUri: input.atUri,
      };
      if (
        currentData.hiddenSubmissions.find(
          (hiddenSubmission) =>
            hiddenSubmission.submissionUri == newSubmission.submissionUri
        )
      ) {
        // The submission already exists in the array, so we do nothing.
        throw new ActionError({
          code: "CONFLICT",
          message: "You tried to hide a submission that's already hidden",
        });
      }
      currentData.hiddenSubmissions.push(newSubmission);
      const data = await guestbookAgent.com.fujocoded.guestbook.gate.put(
        {
          repo: context.locals.loggedInUser.did,
          rkey: "default",
        },
        currentData
      );

      return data;
    },
  }),
  showSubmission: defineAction({
    accept: "form",
    input: z.object({
      atUri: z.string(),
      guestbookAtUri: z.string(),
    }),
    handler: async (input, context) => {
      const guestbookAgent = await getGuestbookAgent(context.locals);
      const { host } = new AtUri(input.atUri);

      if (!context.locals.loggedInUser) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "You must be logged in to hide a post",
        });
      }

      if (context.locals.loggedInUser.did === host) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You can only show other people's posts.",
        });
      }

      // TODO: check if the record exists before showing it if you want
      // to warn the user in case of errors

      const currentData = (
        await guestbookAgent.com.fujocoded.guestbook.gate
          .get({
            repo: context.locals.loggedInUser.did,
            rkey: "default",
          })
          .catch((e) => {
            if (e.error === "RecordNotFound") {
              // First time creating a gate, just return an empty one
              return {
                $type: "com.fujocoded.guestbook.gate",
                value: { hiddenSubmissions: [] },
              };
            }
            throw e;
          })
      ).value as GateRecord;

      const newSubmissions = currentData.hiddenSubmissions.filter(
        (hiddenSubmission) => hiddenSubmission.submissionUri !== input.atUri
      );

      const data = await guestbookAgent.com.fujocoded.guestbook.gate.put(
        {
          repo: context.locals.loggedInUser.did,
          rkey: "default",
        },
        { ...currentData, hiddenSubmissions: newSubmissions }
      );

      return data;
    },
  }),
};
