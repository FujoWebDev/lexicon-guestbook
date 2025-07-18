import { AppBskyActorDefs, AtpBaseClient } from "@atproto/api";
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

export const resolveBskyUserProfiles = async (dids: string[]) => {
  const result = new Map<string, AppBskyActorDefs.ProfileViewDetailed>();
  // To resolve the handle we're directly using the bsky app data with the
  // bsky profile. I have no idea if this would also return the handle for
  // DIDs that do not have a bsky account.
  // There is in theory an "official" way to resolve a handle, but it is
  // currently not implemented: https://github.com/bluesky-social/atproto/issues/3808
  const agent = new AtpBaseClient("https://public.api.bsky.app/");
  const uniqueDids = Array.from(new Set(dids));

  const profileRequests = uniqueDids.map(async (did) => {
    const profile = await agent.app.bsky.actor.getProfile({
      actor: did,
    });
    result.set(did, profile.data);
  });

  await Promise.all(profileRequests);

  return result;
};
