import { db } from "../db/index.js";
import { Cursor } from "../db/schema.js";

export const getLastCursor = async () => {
  const row = await db.query.Cursor.findFirst();
  return row?.cursor ?? null;
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

// This creates a function that will update the cursor periodically, starting from
// the given cursor, and then updating it at most once every given interval.
export const createCursorUpdater = ({
  startFromCursor: startFromCursorMicroseconds,
  cursorUpdateIntervalMilliseconds,
}: {
  startFromCursor: number | null;
  cursorUpdateIntervalMilliseconds: number;
}) => {
  let lastCursorMicroseconds = startFromCursorMicroseconds;
  return async (timestampMicroseconds: number) => {
    // Orginal timestamp is in microseconds
    const elapsedTimeMilliseconds =
      (timestampMicroseconds - (lastCursorMicroseconds ?? 0)) / 1000;
    if (
      !lastCursorMicroseconds ||
      elapsedTimeMilliseconds > cursorUpdateIntervalMilliseconds
    ) {
      lastCursorMicroseconds = timestampMicroseconds;
      console.log("Updating cursor...");
      await updateCursor(lastCursorMicroseconds);
      console.log(
        `Updated cursor to: ${lastCursorMicroseconds} (${cursorToDate(
          lastCursorMicroseconds
        ).toLocaleString()})`
      );
    }
  };
};
