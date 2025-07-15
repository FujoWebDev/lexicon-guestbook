import { alias } from "drizzle-orm/sqlite-core";
import { type Record as Book } from "../../client/generated/api/types/com/fujocoded/guestbook/book.js";
import { db } from "../db/index.js";
import { guestbooks, submissions, users } from "../db/schema.js";
import { eq, getTableColumns, and } from "drizzle-orm";

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
    await db
      .insert(guestbooks)
      .values({
        recordKey: params.recordKey,
        collection: params.book.$type,
        title: params.book.title,
        owner: userId,
        record: JSON.stringify(params.book),
      })
      .onConflictDoUpdate({
        target: [guestbooks.recordKey, guestbooks.collection, guestbooks.owner],
        set: {
          title: params.book.title,
          record: JSON.stringify(params.book),
        },
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
  const authors = alias(users, "authors");
  const guestbookEntries = await db
    .select({
      ...getTableColumns(guestbooks),
      ownerDid: users.did,
      submissions: submissions,
      submissionAuthor: authors,
    })
    .from(guestbooks)
    .innerJoin(users, eq(users.id, guestbooks.owner))
    .leftJoin(submissions, eq(submissions.postedTo, guestbooks.id))
    .leftJoin(authors, eq(submissions.author, authors.id))
    .where(
      and(eq(guestbooks.recordKey, guestbookKey), eq(users.did, ownerDid))
    );

  if (!guestbookEntries || !guestbookEntries.length) {
    return null;
  }

  return {
    title: guestbookEntries[0].title || undefined,
    owner: {
      did: guestbookEntries[0].ownerDid,
    },
    submissions:
      guestbookEntries.map((entry) => ({
        atUri: `at://${entry.submissionAuthor?.did}/${entry.submissions?.collection}/${entry.submissions?.recordKey}`,
        author: {
          did: entry.submissionAuthor!.did,
        },
        text: entry.submissions!.text || undefined,
        createdAt: entry.submissions!.createdAt.toISOString(),
      })) || [],
  };
};
