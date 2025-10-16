import { relations } from "drizzle-orm";
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

export const blockedUsers = sqliteTable(
  "blockedUsers",
  {
    id: int().primaryKey({ autoIncrement: true }),
    blockingUser: int()
      .notNull()
      .references(() => users.id),
    blockedAt: int({ mode: "timestamp" }).notNull(),
    blockedUser: int()
      .notNull()
      .references(() => users.id),
  },
  (t) => [unique().on(t.blockingUser, t.blockedUser)]
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

export const usersRelations = relations(users, ({ many }) => ({
  guestbooks: many(guestbooks),
  submissions: many(submissions),
  hiddenSubmissions: many(hiddenSubmissions),
}));

export const guestbooksRelations = relations(guestbooks, ({ one, many }) => ({
  owner: one(users, {
    fields: [guestbooks.owner],
    references: [users.id],
  }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  guestbook: one(guestbooks, {
    fields: [submissions.postedTo],
    references: [guestbooks.id],
  }),
  author: one(users, {
    fields: [submissions.author],
    references: [users.id],
  }),
  hiddenEntries: many(hiddenSubmissions),
}));

export const hiddenSubmissionsRelations = relations(
  hiddenSubmissions,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [hiddenSubmissions.submissionId],
      references: [submissions.id],
    }),
    hiddenBy: one(users, {
      fields: [hiddenSubmissions.hiddenBy],
      references: [users.id],
    }),
  })
);

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blockingUser: one(users, {
    fields: [blockedUsers.blockingUser],
    references: [users.id],
  }),
  blockedUser: one(users, {
    fields: [blockedUsers.blockedUser],
    references: [users.id],
  }),
}));

export const Cursor = sqliteTable("cursor", {
  id: int().primaryKey(),
  cursor: int().notNull(),
});
