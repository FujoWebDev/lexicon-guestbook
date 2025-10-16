import { eq, and } from "drizzle-orm";
import {
  type Record as Book,
  isRecord as isBook,
} from "../../client/generated/api/types/com/fujocoded/guestbook/book.js";
import { db } from "../db/index.js";
import { guestbooks, users, blockedUsers } from "../db/schema.js";
import { resolveBskyUserProfiles, createOrGetUser } from "./user.js";

export const isBookRecord = (record: unknown): record is Book => isBook(record);

export const upsertGuestbook = async ({
  book,
  recordKey,
  ownerDid,
}: {
  book: Book;
  recordKey: string;
  ownerDid: string;
}) => {
  const user = await createOrGetUser({ did: ownerDid });
  await db
    .insert(guestbooks)
    .values({
      recordKey: recordKey,
      collection: book.$type,
      title: book.title,
      owner: user.id,
      record: JSON.stringify(book),
    })
    .onConflictDoUpdate({
      target: [guestbooks.recordKey, guestbooks.collection, guestbooks.owner],
      set: {
        title: book.title,
        record: JSON.stringify(book),
      },
    });
};

export const getGuestbooksByUser = async ({ userDid }: { userDid: string }) => {
  const owner = await db.query.users.findFirst({
    where: eq(users.did, userDid),
    with: {
      guestbooks: true,
    },
  });

  if (!owner) {
    return [];
  }

  return owner.guestbooks.map((book) => ({
    ...book,
    ownerDid: owner.did,
  }));
};

export const getGuestbook = async ({
  guestbookKey,
  ownerDid,
}: {
  guestbookKey: string;
  ownerDid: string;
}) => {
  const owner = await db.query.users.findFirst({
    where: eq(users.did, ownerDid),
    with: {
      guestbooks: {
        where: eq(guestbooks.recordKey, guestbookKey),
        with: {
          submissions: {
            with: {
              author: true,
              hiddenEntries: true,
            },
          },
        },
      },
    },
  });

  const guestbook = owner?.guestbooks[0];

  if (!owner || !guestbook) {
    return null;
  }

  const profilesMap = await resolveBskyUserProfiles([
    ownerDid,
    ...guestbook.submissions
      .map((entry) => entry.author?.did)
      .filter((x): x is string => !!x),
  ]);

  const blockedUserIds = await getBlockedUserIds({ userId: owner.id });

  return {
    id: guestbook.id,
    title: guestbook.title || undefined,
    isDeleted: guestbook.isDeleted,
    owner: {
      did: owner.did,
      handle: profilesMap.get(ownerDid)?.handle,
      avatar: profilesMap.get(ownerDid)?.avatar,
    },
    submissions:
      guestbook.submissions.map((entry) => ({
        atUri: `at://${entry.author.did}/${entry.collection}/${entry.recordKey}`,
        author: {
          did: entry.author.did,
          handle: profilesMap.get(entry.author.did)?.handle,
          avatar: profilesMap.get(entry.author.did)?.avatar,
        },
        text: entry.text || undefined,
        createdAt: entry.createdAt.toISOString(),
        hidden: (entry.hiddenEntries ?? []).length > 0,
        authorBlocked: blockedUserIds.has(entry.author.id),
      })) ?? [],
  };
};

export const deleteGuestBook = async ({
  guestbookKey,
  ownerDid,
}: {
  guestbookKey: string;
  ownerDid: string;
}) => {
  const ownerId = (await createOrGetUser({ did: ownerDid })).id;
  await db
    .delete(guestbooks)
    .where(
      and(eq(guestbooks.recordKey, guestbookKey), eq(guestbooks.owner, ownerId))
    );
};

export const getBlockedUserIds = async ({ userId }: { userId: number }) => {
  const blockedUserRecords = await db.query.blockedUsers.findMany({
    where: eq(blockedUsers.blockingUser, userId),
  });
  return new Set(
    blockedUserRecords.map((blockedUserRecord) => blockedUserRecord.blockedUser)
  );
};
