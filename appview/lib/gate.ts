import { eq, and } from "drizzle-orm";
import {
  BlockedUser,
  Record as GateRecord,
  HiddenSubmission,
  isRecord as isGate,
} from "../../client/generated/api/types/com/fujocoded/guestbook/gate.js";
import { db } from "../db/index.js";
import {
  blockedUsers,
  hiddenSubmissions,
  submissions,
  users,
} from "../db/schema.js";
import { createOrGetUser } from "./user.js";
import { AtUri } from "@atproto/syntax";

export const isGateRecord = (record: unknown): record is GateRecord =>
  isGate(record);

type DatabaseTransaction = Parameters<
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

  const submissionsToHideInserts = (
    await Promise.all(
      submissionsToHide.map(async (submission) => {
        const {
          host: authorDid,
          rkey,
          collection,
        } = new AtUri(submission.submissionUri);

        const author = await tx.query.users.findFirst({
          where: eq(users.did, authorDid),
        });

        if (!author) {
          return null;
        }

        const dbSubmission = await tx.query.submissions.findFirst({
          where: and(
            eq(submissions.collection, collection),
            eq(submissions.recordKey, rkey),
            eq(submissions.author, author.id)
          ),
        });

        if (!dbSubmission) {
          return null;
        }

        return {
          submissionId: dbSubmission.id,
          hiddenBy: userId,
          hiddenAt: submission.hiddenAt
            ? new Date(submission.hiddenAt)
            : undefined,
        };
      })
    )
  ).filter(<T>(submission: T): submission is NonNullable<T> => !!submission);

  if (!submissionsToHideInserts.length) {
    return;
  }

  await tx.insert(hiddenSubmissions).values(submissionsToHideInserts);
};

export const deleteGate = async (gateDetails: {
  name: string;
  owner: string;
}) => {
  if (gateDetails.name != "default") {
    throw new Error(`Unknown gate type: ${gateDetails.name}`);
  }

  await db.transaction(async (tx) => {
    await deleteHiddenSubmissionsByUser({ did: gateDetails.owner }, tx);
  });
};

export const upsertGate = async (gateDetails: {
  name: string;
  content: GateRecord;
  owner: string;
}) => {
  if (gateDetails.name != "default") {
    throw new Error(`Unknown gate type: ${gateDetails.name}`);
  }
  const content = gateDetails.content;

  await db.transaction(async (tx) => {
    // First we delete all submissions...
    await deleteHiddenSubmissionsByUser({ did: gateDetails.owner }, tx);
    // ...then we put them all back in
    // TODO: do this the reasonable way (calculate the diff)
    // (calculate the diff)
    await hideSubmissions(
      {
        did: gateDetails.owner,
        submissionsToHide: gateDetails.content.hiddenSubmissions ?? [],
      },
      tx
    );

    // First we delete all blocked users...
    await deleteBlockedUsersByUser({ did: gateDetails.owner }, tx);
    // ...then we put them all back in
    // TODO: do this the reasonable way (calculate the diff)
    await blockUsers(
      {
        did: gateDetails.owner,
        usersToBlock: gateDetails.content.blockedUsers ?? [],
      },
      tx
    );
  });
};

const deleteBlockedUsersByUser = async (
  { did }: { did: string },
  tx: typeof db | DatabaseTransaction = db
) => {
  const userId = (await createOrGetUser({ did })).id;
  await tx.delete(blockedUsers).where(eq(blockedUsers.blockingUser, userId));
};

const blockUsers = async (
  {
    did,
    usersToBlock,
  }: {
    did: string;
    usersToBlock: BlockedUser[];
  },
  tx: typeof db | DatabaseTransaction = db
) => {
  const userId = (await createOrGetUser({ did })).id;

  const blockedUsersInserts = (
    await Promise.all(
      usersToBlock.map(async (user) => {
        const { host: blockedDid } = new AtUri(user.userDid);

        const blockedUser = await tx.query.users.findFirst({
          where: eq(users.did, blockedDid),
        });

        if (!blockedUser) {
          return null;
        }

        return {
          blockedUser: blockedUser.id,
          blockedAt: new Date(user.blockedAt ?? Date.now()),
          blockingUser: userId,
        };
      })
    )
  ).filter(<T>(blockedUser: T): blockedUser is NonNullable<T> => !!blockedUser);

  if (!blockedUsersInserts.length) {
    return;
  }

  await tx.insert(blockedUsers).values(blockedUsersInserts);
};
