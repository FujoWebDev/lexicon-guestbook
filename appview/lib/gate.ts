import { eq, and } from "drizzle-orm";
import {
  Record as GateRecord,
  HiddenSubmission,
} from "../../client/generated/api/types/com/fujocoded/guestbook/gate.js";
import { db } from "../db/index.js";
import { hiddenSubmissions, submissions, users } from "../db/schema.js";
import { createOrGetUser } from "./user.js";
import { AtUri } from "@atproto/api";

export type DatabaseTransaction = Parameters<
  Parameters<(typeof db)["transaction"]>[0]
>[0];

const deleteHiddenSubmissionsByUser = async (
  { did }: { did: string },
  tx: typeof db | DatabaseTransaction = db
) => {
  const userId = (await createOrGetUser({ did })).id;
  await tx
    .delete(hiddenSubmissions)
    .where(eq(hiddenSubmissions.hiddenBy, userId));
};

const hideSubmissions = async (
  {
    did,
    submissionsToHide,
  }: {
    did: string;
    submissionsToHide: HiddenSubmission[];
  },
  tx: typeof db | DatabaseTransaction = db
) => {
  const userId = (await createOrGetUser({ did })).id;
  const atUrisToHide = await Promise.all(
    submissionsToHide.map(async (submission) => {
      const {
        host: did,
        rkey,
        collection,
      } = new AtUri(submission.submissionUri);
      const dbSubmission = await tx
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.collection, collection),
            eq(submissions.recordKey, rkey),
            eq(
              submissions.author,
              db.select({ id: users.id }).from(users).where(eq(users.did, did))
            )
          )
        );
      return {
        submissionId: dbSubmission[0].id,
        hiddenBy: userId,
        hiddenAt: submission.hiddenAt
          ? new Date(submission.hiddenAt)
          : undefined,
      };
    })
  );
  if (!atUrisToHide.length) {
    return;
  }
  await tx.insert(hiddenSubmissions).values(atUrisToHide);
};

export const handleGateEvent = async (
  gateDetails: {
    name: string;
    content: GateRecord;
    owner: string;
  },
  eventType: "create" | "update"
) => {
  if (eventType == "create" || eventType == "update") {
    if (gateDetails.name != "default") {
      throw new Error(`Unknown gate type: ${gateDetails.name}`);
    }
    const content = gateDetails.content;

    await db.transaction(async (tx) => {
      // First we delete all submissions...
      await deleteHiddenSubmissionsByUser({ did: gateDetails.owner }, tx);
      // ...then we put the all back in
      // TODO: do this the reasonable way (calculate the diff)
      await hideSubmissions(
        {
          did: gateDetails.owner,
          submissionsToHide: gateDetails.content.hiddenSubmissions ?? [],
        },
        tx
      );
    });
  }
};
