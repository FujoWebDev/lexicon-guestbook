import { and, eq, getTableColumns, param } from "drizzle-orm";
import { type Record as Submission } from "../../client/generated/api/types/com/fujocoded/guestbook/submission.js";
import { db } from "../db/index.js";
import { guestbooks, submissions, users } from "../db/schema.js";
import { upsertUser } from "./user.js";

export const handleSubmissionEvent = async (
  params: { submission: Submission; author: string; recordKey: string },
  eventType: "create" | "update" | "delete"
) => {
  const [guestbookKey, collectionType, ownerDid] = params.submission.postedTo
    .split("/")
    .toReversed();

  const userId = await upsertUser({ did: params.author });

  const guestbookId = (
    await db
      .select({
        id: guestbooks.id,
      })
      .from(guestbooks)
      .leftJoin(users, eq(guestbooks.owner, users.id))
      .where(
        and(
          eq(guestbooks.recordKey, guestbookKey),
          eq(guestbooks.collection, collectionType),
          eq(users.did, ownerDid)
        )
      )
      .execute()
  )?.[0].id;

  if (!guestbookId) {
    console.dir(params, { depth: null });
    throw new Error("Attempting submission to unknown guestbook");
  }

  await db
    .insert(submissions)
    .values({
      recordKey: params.recordKey,
      collection: params.submission.$type,
      createdAt: new Date(),
      text: params.submission.text,
      postedTo: guestbookId,
      author: userId.id,
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
        postedTo: guestbookId,
        author: userId.id,
      },
    });
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
    .innerJoin(guestbooks, eq(guestbooks.id, submissions.postedTo))
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
