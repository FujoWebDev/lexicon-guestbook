import { index, int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

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
