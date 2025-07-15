import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { Cursor } from "../db/schema.js";

export const getLastCursor = async () => {
  // TODO: figure out why typescript thinks this cannot be null
  return (await db.select().from(Cursor).limit(1))[0]?.cursor ?? null;
};

export const cursorToDate = (cursor: number) => {
  return new Date(cursor / 1000);
};

export const updateCursor = async (cursor: number) => {
  // Insert the new cursor into the database.
  // We hardcode id 1 for the cursor since it's a single value.
  await db
    .insert(Cursor)
    .values({
      id: 1,
      cursor,
    })
    .onConflictDoUpdate({
      target: Cursor.id,
      set: {
        cursor,
      },
    });
};
