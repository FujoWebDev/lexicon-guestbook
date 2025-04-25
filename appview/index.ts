import WebSocket from "ws";
import {
  type Record as Book,
  isRecord as isBook,
} from "../client/generated/api/types/com/fujocoded/guestbook/book.js";
import {
  type Record as Submission,
  isRecord as isSubmission,
} from "../client/generated/api/types/com/fujocoded/guestbook/submission.js";
import { z } from "zod";
import { handleBookEvent } from "./lib/book.js";
import { handleSubmissionEvent } from "./lib/submission.js";

const CommitEventSchema = z.object({
  did: z.string(),
  kind: z.literal("commit"),
  commit: z.union([
    z.object({
      operation: z.enum(["create", "update"]),
      record: z
        .object({
          $type: z.string(),
        })
        .passthrough(),
      rev: z.string(),
      collection: z.string(),
      rkey: z.string(),
      cid: z.string(),
    }),
    z.object({
      operation: z.enum(["delete"]),
      rev: z.string(),
      collection: z.string(),
      rkey: z.string(),
    }),
  ]),
});
type CommitEvent = z.infer<typeof CommitEventSchema>;

const isBookRecord = (record: unknown): record is Book => isBook(record);
const isSubmissionRecord = (record: unknown): record is Submission =>
  isSubmission(record);

const JETSTREAM_URL = new URL(
  "subscribe",
  "wss://jetstream2.us-east.bsky.network/"
);
JETSTREAM_URL.searchParams.set(
  "wantedCollections",
  "com.fujocoded.guestbook.*"
);

const ws = new WebSocket(JETSTREAM_URL);

ws.on("open", () => {
  console.log("Starting to listen");
  console.log("Ready to glomp your commits *glomps u too*");
});

ws.on("message", async (data) => {
  const rawEventData = JSON.parse(data.toString());
  if (rawEventData.kind !== "commit") {
    return;
  }
  const eventData = CommitEventSchema.parse(rawEventData);

  if (!eventData.commit.collection.startsWith("com.fujocoded.guestbook")) {
    console.error(`Unexpected collection type ${eventData.commit.collection}`);
    return;
  }

  console.log("Received event:");
  console.dir(eventData, { depth: null });

  if (eventData.commit.operation == "delete") {
    // TODO: handle deleting things
    console.log("Delete operation:");
    console.dir(eventData, { depth: null });
    return;
  }

  if (isBookRecord(eventData.commit.record)) {
    await handleBookEvent(
      {
        recordKey: eventData.commit.rkey,
        book: eventData.commit.record,
        author: eventData.did,
      },
      eventData.commit.operation
    );
    console.log(
      `${eventData.commit.operation}d book: ${eventData.did}/${eventData.kind}/${eventData.commit.rkey}`
    );
    return;
  }

  if (isSubmissionRecord(eventData.commit.record)) {
    await handleSubmissionEvent(
      {
        recordKey: eventData.commit.rkey,
        submission: eventData.commit.record,
        author: eventData.did,
      },
      eventData.commit.operation
    );
    console.log(
      `${eventData.commit.operation}d submission: ${eventData.did}/${eventData.kind}/${eventData.commit.rkey}`
    );
    return;
  }

  console.error(`Unknown record type: ${eventData.commit.record.$type}`);
});

ws.on("error", (err) => {
  console.error("woopsie")!;
  console.error(err);
});

ws.on("close", (code, reason) => {
  console.log("Byeeeeeee");
  console.log(code, reason);
});

// TODO: webserver

// getGuestbooks({owner: string; name?: string}) : Guestbook[]
