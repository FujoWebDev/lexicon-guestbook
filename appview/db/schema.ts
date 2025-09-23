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
    // TODO: make this notNull
    isDeleted: int({ mode: "boolean" }).default(false),
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

export const hiddenSubmissions = sqliteTable("hidden_submission", {
  id: int().primaryKey({ autoIncrement: true }),
  submissionId: int()
    .notNull()
    .references(() => submissions.id),
  hiddenBy: int()
    .notNull()
    .references(() => users.id),
  hiddenAt: int({ mode: "timestamp" }),
});

export const Cursor = sqliteTable("cursor", {
  id: int().primaryKey(),
  cursor: int().notNull(),
});
