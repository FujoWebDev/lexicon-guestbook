import { index, int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "user",
  {
    id: int().primaryKey({ autoIncrement: true }),
    did: text().notNull().unique(),
  },
  (t) => [index("users_did").on(t.did)]
);

export const guestbooks = sqliteTable(
  "guestbooks",
  {
    id: int().primaryKey({ autoIncrement: true }),
    recordKey: text().notNull(),
    collection: text().notNull(), // com.fujocoded.guestbook.book
    title: text(),
    owner: int()
      .notNull()
      .references(() => users.id),
    record: text({ mode: "json" }).notNull(),
  },
  (t) => [unique().on(t.owner, t.collection, t.recordKey)]
);

export const submissions = sqliteTable(
  "submissions",
  {
    id: int().primaryKey({ autoIncrement: true }),
    recordKey: text().notNull(),
    collection: text().notNull(), // com.fujocoded.guestbook.collection
    createdAt: int({ mode: "timestamp" }).notNull(),
    text: text(),
    postedTo: int()
      .notNull()
      .references(() => guestbooks.id),
    author: int()
      .notNull()
      .references(() => users.id),
    record: text({ mode: "json" }).notNull(),
  },
  (t) => [unique().on(t.author, t.collection, t.recordKey)]
);

export const BskyAuthSession = sqliteTable("BskyAuthSession", {
  key: text().primaryKey(),
  session: text(),
});

export const BskyAuthState = sqliteTable("BskyAuthState", {
  key: text().primaryKey(),
  state: text(),
});

export const AuthSession = sqliteTable("AuthSession", {
  id: text().primaryKey(),
  userDid: text(),
  expiresAt: int(),
});

export const Cursor = sqliteTable("cursor", {
  id: int().primaryKey(),
  cursor: int().notNull(),
});
