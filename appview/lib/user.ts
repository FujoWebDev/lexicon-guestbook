import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const upsertUser = async ({ did }: { did: string }) => {
  const user = (
    await db.select().from(users).where(eq(users.did, did)).execute()
  )?.[0];
  if (user) {
    return { id: user.id, did };
  }

  const insertedUser = await db
    .insert(users)
    .values({
      did,
    })
    .returning({
      id: users.id,
      did: users.did,
    })
    .execute();

  return { ...insertedUser[0] };
};
