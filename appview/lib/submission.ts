import { and, eq } from "drizzle-orm";
import { type Record as Submission } from "../../client/generated/api/types/com/fujocoded/guestbook/submission.js";
import { db } from "../db/index.js";
import { guestbooks, submissions, users } from "../db/schema.js";
import { createOrGetUser } from "./user.js";
import { getGuestbook } from "./book.js";
import { AtUri } from "@atproto/api";

export const upsertSubmission = async ({
  submission,
  submissionAuthor,
  submissionRecordKey,
}: {
  submission: Submission;
  submissionAuthor: string;
  submissionRecordKey: string;
}) => {
  const { host: ownerDid, rkey: guestbookKey } = new AtUri(submission.postedTo);

  const author = await createOrGetUser({ did: submissionAuthor });

  const guestbook = await getGuestbook({
    guestbookKey,
    ownerDid,
  });

  if (!guestbook) {
    throw new Error(`Attempting create or update on unknown guestbook`);
  }

  await db
    .insert(submissions)
    .values({
      recordKey: submissionRecordKey,
      collection: submission.$type,
      createdAt: new Date(submission.createdAt),
      text: submission.text,
      postedTo: guestbook.id,
      author: author.id,
      record: JSON.stringify(submission),
    })
    .onConflictDoUpdate({
      target: [
        submissions.author,
        submissions.recordKey,
        submissions.collection,
      ],
      // TODO: update the date to actual creation time
      set: {
        text: submission.text,
        postedTo: guestbook.id,
        author: author.id,
        createdAt: new Date(submission.createdAt),
      },
    });
};

export const deleteSubmission = async (eventDetails: {
  submissionAuthor: string;
  submissionRecordKey: string;
}) => {
  const author = await createOrGetUser({ did: eventDetails.submissionAuthor });

  return db
    .delete(submissions)
    .where(
      and(
        eq(submissions.collection, "com.fujocoded.guestbook.submission"),
        eq(submissions.recordKey, eventDetails.submissionRecordKey),
        eq(submissions.author, author.id)
      )
    );
};

export const getSubmissionByGuestbook = async ({
  guestbookKey,
  collectionType,
  ownerDid,
}: {
  guestbookKey: string;
  collectionType: string;
  ownerDid: string;
}) => {
  const owner = await db.query.users.findFirst({
    where: eq(users.did, ownerDid),
    with: {
      guestbooks: {
        where: and(
          eq(guestbooks.recordKey, guestbookKey),
          eq(guestbooks.collection, collectionType)
        ),
        with: {
          submissions: {
            with: {
              hiddenEntries: true,
            },
          },
        },
      },
    },
  });

  const guestbook = owner?.guestbooks[0];

  if (!guestbook || !owner) {
    return [];
  }

  return guestbook.submissions.map(({ hiddenEntries, ...submission }) => {
    const [hiddenEntry] = hiddenEntries;
    return {
      ...submission,
      hiddenAt: hiddenEntry?.hiddenAt ?? undefined,
    };
  });
};
