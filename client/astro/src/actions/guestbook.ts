import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { AtUri } from "@atproto/syntax";
import { getGuestbookAgent } from "../lib/atproto";
import { fujocoded } from "../../generated/com";
import { currentDatetimeString } from "@atproto/lex";
import { XrpcResponseError } from "@atproto/lex-client";

const AtUriSchema = z.custom<AtUri>((val) => {
  return typeof val == "string" && new AtUri(val);
});

// A gate is a record (one per guestbook) that keeps track of which submissions
// a user has hidden. Both the hide and show buttons edit this same record, and
// both follow the same process: read the record, change it, save it back.
//
// The tricky part: if another edit happens before the current one is finished
// updating the data, there may now be new information in that record that wasn't
// present at the time it was read. This may cause new data to be overwritten.
//
// This helper prevents that. When it saves the record, it tells the server
// "only accept this update if the document hasn't been touched since I read
// it." If someone got there first, the server refuses, then this helper grabs
// the fresh version and tries again (up to five times).
//
// See: https://github.com/bluesky-social/atproto/tree/main/packages/lex/lex#updating-profile-with-retry-logic
const updateGate = async (
  agent: Awaited<ReturnType<typeof getGuestbookAgent>>,
  mutate: (
    current: fujocoded.guestbook.gate.Main,
  ) => fujocoded.guestbook.gate.Main,
) => {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    const existing = await agent
      .get(fujocoded.guestbook.gate, { rkey: "default" })
      .catch((e) => {
        if (e?.error === "RecordNotFound") return null;
        throw e;
      });

    const current: fujocoded.guestbook.gate.Main = existing?.value ?? {
      $type: "com.fujocoded.guestbook.gate",
      hiddenSubmissions: [],
    };
    const updated = mutate(current);

    try {
      return await agent.put(fujocoded.guestbook.gate, updated, {
        rkey: "default",
        swapRecord: existing?.cid,
      });
    } catch (e) {
      if (
        e instanceof XrpcResponseError &&
        e.error === "InvalidSwap" &&
        attempt < MAX_ATTEMPTS
      ) {
        continue;
      }
      throw e;
    }
  }
};

export const actions = {
  postToGuestbook: defineAction({
    accept: "form",
    input: z.object({
      text: z.string(),
      postedTo: AtUriSchema,
    }),
    handler: async (input, context) => {
      if (!context.locals.loggedInUser) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Must be logged in to post to a guestbook",
        });
      }
      const guestbookAgent = await getGuestbookAgent(context.locals);
      const result = await guestbookAgent.create(
        fujocoded.guestbook.submission,
        {
          createdAt: currentDatetimeString(),
          postedTo: input.postedTo.toString(),
          text: input.text,
        },
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
      if (!context.locals.loggedInUser) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Must be logged in to create a guestbook",
        });
      }
      const data = await guestbookAgent.create(
        fujocoded.guestbook.book,
        {
          title: input.title,
        },
        {
          rkey: input.key,
        },
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

      const data = await guestbookAgent.delete(fujocoded.guestbook.book.main, {
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

      // We don't need to check for record existance since deleting a
      // non-existing record is not an error. But if you want to make sure no
      // changes have been made to a record you want to delete, you can pass an
      // existing record's CID via swapRecord to trigger an error in case of
      // concurrent updates.
      const data = await guestbookAgent.delete(
        fujocoded.guestbook.submission.main,
        {
          rkey,
          // swapRecord: existingRecord.cid,
        },
      );

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

      return await updateGate(guestbookAgent, (current) => {
        const newSubmission = {
          hiddenAt: currentDatetimeString(),
          originallyPostedOn: new AtUri(input.guestbookAtUri).toString(),
          submissionUri: new AtUri(input.atUri).toString(),
        };
        const hiddenSubmissions = current.hiddenSubmissions ?? [];
        if (
          hiddenSubmissions.some(
            (h) => h.submissionUri === newSubmission.submissionUri,
          )
        ) {
          throw new ActionError({
            code: "CONFLICT",
            message: "You tried to hide a submission that's already hidden",
          });
        }
        return {
          ...current,
          hiddenSubmissions: [...hiddenSubmissions, newSubmission],
        };
      });
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

      return await updateGate(guestbookAgent, (current) => ({
        ...current,
        hiddenSubmissions:
          current.hiddenSubmissions?.filter(
            (h) => h.submissionUri !== input.atUri,
          ) ?? [],
      }));
    },
  }),
};
