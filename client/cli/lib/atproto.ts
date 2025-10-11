import { IdResolver } from "@atproto/identity";

const IDENTITY_RESOLVER = new IdResolver({});

export const getDid = async ({ didOrHandle }: { didOrHandle: string }) => {
  if (didOrHandle.startsWith("did:")) {
    return didOrHandle;
  }
  return await IDENTITY_RESOLVER.handle.resolve(didOrHandle);
};

export const getPdsUrl = async ({ didOrHandle }: { didOrHandle: string }) => {
  const did = await getDid({ didOrHandle });
  if (!did) {
    throw new Error(`Did not resolve to a valid DID: ${didOrHandle}`);
  }
  const atprotoData = await IDENTITY_RESOLVER.did.resolveAtprotoData(did);
  return atprotoData.pds;
};
