import { AppBskyActorDefs, AtpBaseClient } from "@atproto/api";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { DidResolver } from "@atproto/identity";

export const createOrGetUser = async ({ did }: { did: string }) => {
  const user = await db.query.users.findFirst({
    where: eq(users.did, did),
  });
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

// There is in theory an "official" endpoint to resolve a handle, but it is
// currently not implemented: https://github.com/bluesky-social/atproto/issues/3808
const IDENTITY_RESOLVER = new DidResolver({});
export const didToHandle = async (did: string) => {
  const atprotoData = await IDENTITY_RESOLVER.resolveAtprotoData(did);
  return atprotoData.handle;
};

export const resolveBskyUserProfiles = async (dids: string[]) => {
  const result = new Map<string, AppBskyActorDefs.ProfileViewDetailed>();
  // To resolve the handle we're directly using the bsky app data with the
  // bsky profile. I have no idea if this would also return the handle for
  // DIDs that do not have a bsky account.

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
