import { type Record as Book } from "../../client/generated/api/types/com/fujocoded/guestbook/book.js";
import { db } from "../db/index.js";
import { guestbooks, submissions, users } from "../db/schema.js";
import { eq, getTableColumns, and, sql } from "drizzle-orm";

export const handleBookEvent = async (
  params: { book: Book; author: string; recordKey: string },
  eventType: "create" | "update" | "delete"
) => {
  if (eventType == "create") {
    const userId = (
      await db
        .insert(users)
        .values({
          did: params.author,
        })
        .onConflictDoNothing()
        .returning({
          id: users.id,
        })
        .execute()
    )?.[0]?.id;
    await db.insert(guestbooks).values({
      recordKey: params.recordKey,
      collection: params.book.$type,
      title: params.book.title,
      owner: userId,
      record: JSON.stringify(params.book),
    });
  }
};

export const getGuestbooksByUser = async ({ userDid }: { userDid: string }) => {
  return await db
    .select({
      ...getTableColumns(guestbooks),
      ownerDid: users.did,
    })
    .from(guestbooks)
    .innerJoin(users, eq(users.id, guestbooks.owner))
    .where(eq(users.did, userDid));
};

export const getGuestbook = async ({
  guestbookKey,
  ownerDid,
}: {
  guestbookKey: string;
  ownerDid: string;
}) => {
  const guestbookEntries = await db
    .select({
      ...getTableColumns(guestbooks),
      ownerDid: users.did,
      submissions: submissions,
    })
    .from(guestbooks)
    .innerJoin(users, eq(users.id, guestbooks.owner))
    .leftJoin(submissions, eq(submissions.postedTo, guestbooks.id))
    .where(
      and(eq(guestbooks.recordKey, guestbookKey), eq(users.did, ownerDid))
    );

  if (!guestbookEntries[0]) {
    return null;
  }
  return {
    title: guestbookEntries[0].title,
    owner: {
      did: guestbookEntries[0].ownerDid,
    },
    submissions: guestbookEntries.map((entry) => ({
      text: entry.submissions?.text,
      createdAt: entry.submissions?.createdAt,
    })),
  };
};
