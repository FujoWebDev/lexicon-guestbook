import { and, eq, getTableColumns, param } from "drizzle-orm";
import { type Record as Submission } from "../../client/generated/api/types/com/fujocoded/guestbook/submission.js";
import { db } from "../db/index.js";
import { guestbooks, submissions, users } from "../db/schema.js";
import { createOrGetUser } from "./user.js";
import { getGuestbook } from "./book.js";
import { AtUri } from "@atproto/api";

const upsertSubmission = async (params: {
  submission: Submission;
  submissionRecordKey: string;
  guestbokId: number;
  authorId: number;
}) => {
  await db
    .insert(submissions)
    .values({
      recordKey: params.submissionRecordKey,
      collection: params.submission.$type,
      createdAt: new Date(params.submission.createdAt),
      text: params.submission.text,
      postedTo: params.guestbokId,
      author: params.authorId,
      record: JSON.stringify(params.submission),
    })
    .onConflictDoUpdate({
      target: [
        submissions.author,
        submissions.recordKey,
        submissions.collection,
      ],
      // TODO: update the date to actual creation time
      set: {
        text: params.submission.text,
        postedTo: params.guestbokId,
        author: params.authorId,
        createdAt: new Date(params.submission.createdAt),
      },
    });
};

const handleSubmissionUpsert = async ({
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
    console.dir(submission.postedTo, { depth: null });
    throw new Error(`Attempting create or update on unknown guestbook`);
  }

  await upsertSubmission({
    submission,
    submissionRecordKey,
    guestbokId: guestbook.id,
    authorId: author.id,
  });
};

const deleteSubmission = async (eventDetails: {
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

// TODO: type right
export const handleSubmissionEvent = async (
  eventDetails: {
    submission: Submission | undefined;
    submissionAuthor: string;
    submissionRecordKey: string;
  },
  eventType: "create" | "update" | "delete"
) => {
  if (eventType == "create" || eventType == "update") {
    const submission = eventDetails.submission;
    if (!submission) {
      throw new Error("Create or update event without submission data");
    }
    await handleSubmissionUpsert({ ...eventDetails, submission });
  } else if (eventType == "delete") {
    await deleteSubmission(eventDetails);
  }
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
  return await db
    .select({
      ...getTableColumns(submissions),
    })
    .from(submissions)
    .leftJoin(guestbooks, eq(guestbooks.id, submissions.postedTo))
    .innerJoin(users, eq(users.id, guestbooks.owner))
    .where(
      and(
        eq(guestbooks.recordKey, guestbookKey),
        eq(guestbooks.collection, collectionType),
        eq(users.did, ownerDid)
      )
    )
    .execute();
};
