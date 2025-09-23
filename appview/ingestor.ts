/**
 * This file contains the code that listens to the events happening
 * on the whole ATproto network (through a Jetstream), keeps track
 * of them in the AppView's database, and thus keeps our AppView data
 * in sync with the current status of guestbooks in the ATmosphere.
 *
 * You can learn all you want to know (and probably more) about
 * Jetstreams here: https://github.com/bluesky-social/jetstream
 */
import WebSocket from "ws";
import {
  type Record as Book,
  isRecord as isBook,
} from "../client/generated/api/types/com/fujocoded/guestbook/book.js";
import {
  type Record as Submission,
  isRecord as isSubmission,
} from "../client/generated/api/types/com/fujocoded/guestbook/submission.js";
import {
  type Record as Gate,
  isRecord as isGate,
} from "../client/generated/api/types/com/fujocoded/guestbook/gate.js";
import { z } from "zod";
import { handleBookEvent } from "./lib/book.js";
import { handleSubmissionEvent } from "./lib/submission.js";
import { cursorToDate, getLastCursor, updateCursor } from "./lib/cursor.js";
import { handleGateEvent } from "./lib/gate.js";

const CommitEventSchema = z.object({
  did: z.string(),
  time_us: z.number(),
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
const isGateRecord = (record: unknown): record is Gate => isGate(record);

// To listen to the guestbook events in the ATmosphere we subscribe to a
// Jetstream service using the websocket protocol (wss://).
// You don't need to know much about websockets, except that they send
// event to this program when things happen in the network.
//
// Full Jetstream configuration options are at: https://github.com/bluesky-social/jetstream?tab=readme-ov-file#consuming-jetstream
const JETSTREAM_URL = new URL(
  "subscribe",
  "wss://jetstream2.us-east.bsky.network/"
);

// What events do we want to be sent? Anything related to com.fujocoded.guestbook!
JETSTREAM_URL.searchParams.set(
  "wantedCollections",
  "com.fujocoded.guestbook.*"
);

// When do we want to start reading events from? By default, the Jetstream will
// collect events starting from the moment it connects. This means that temporary
// disconnections might cause data created during the disconnection period to be lost.
// To fix this, we use a "cursor" (that is, a timestamp) to save the time we read our
// last event on, and start again from there.
let LAST_CURSOR_MICROSECONDS = await getLastCursor();
// We'll update the cursor once every hour of data we process
// Tests show we roughly process a hour of data every minute
const CURSOR_UPDATE_INTERVAL_MILLISECONDS = 60 * 60 * 1000;
if (LAST_CURSOR_MICROSECONDS) {
  console.log(
    `Starting catch up from cursor: ${LAST_CURSOR_MICROSECONDS} (${cursorToDate(
      LAST_CURSOR_MICROSECONDS
    ).toLocaleString()})`
  );
  JETSTREAM_URL.searchParams.set("cursor", LAST_CURSOR_MICROSECONDS.toString());
}

// TODO: if the record is a record that needs saving in the database
// update the cursor after saving it to the database
const maybeUpdateCursor = async (timestampMicroseconds: number) => {
  // Orginal timestamp is in microseconds
  const elapsedTimeMilliseconds =
    (timestampMicroseconds - (LAST_CURSOR_MICROSECONDS ?? 0)) / 1000;
  if (
    !LAST_CURSOR_MICROSECONDS ||
    elapsedTimeMilliseconds > CURSOR_UPDATE_INTERVAL_MILLISECONDS
  ) {
    LAST_CURSOR_MICROSECONDS = timestampMicroseconds;
    console.log("Updating cursor...");
    await updateCursor(LAST_CURSOR_MICROSECONDS);
    console.log(
      `Updated cursor to: ${LAST_CURSOR_MICROSECONDS} (${cursorToDate(
        LAST_CURSOR_MICROSECONDS
      ).toLocaleString()})`
    );
  }
};

const ws = new WebSocket(JETSTREAM_URL);

// First, we define what happens when the connection to the Jetstream starts
// and ends. In our case, these are mostly courtesy messages.
ws.on("open", () => {
  console.log("Starting to listen");
  console.log("Ready to glomp your guestbook events *glomps u too*");
});

ws.on("close", (code, reason) => {
  console.log("Byeeeeeee");
  console.log(code, reason);
});

// Then, we define what happens when a new event happens on the network.
// A Jetstream will call this function on 3 types of event:
// 1) A "commit" event for every add/delete/update event related to the
//    collections we asked it to listen to (in our case, "com.fujocoded.guestbook.*")
// 2) An "identity" event for when the identity of a user is updated in the network
//      (e.g. their handle)
// 3) An "account" event for when accounts get deactivated, or taken down, or undergo
//    status changes
ws.on("message", async (data) => {
  const rawEventData = JSON.parse(data.toString());
  await maybeUpdateCursor(rawEventData.time_us);
  if (rawEventData.kind !== "commit") {
    // Right now we only handle guestbook-related events
    // TODO: handle other types of events to update user-visible identities, or to
    // deactivate accounts.
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
    if (
      isSubmissionRecord({
        $type: eventData.commit.collection,
      })
    ) {
      await handleSubmissionEvent(
        {
          submission: undefined,
          submissionAuthor: eventData.did,
          submissionRecordKey: eventData.commit.rkey,
        },
        "delete"
      );
    }
    if (
      isBookRecord({
        $type: eventData.commit.collection,
      })
    ) {
      await handleBookEvent(
        {
          author: eventData.did,
          recordKey: eventData.commit.rkey,
          book: undefined,
        },
        "delete"
      );
    }
    return;
  }
  // Check if this event is related to an actual guestbook
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

  // Check if this event is related to a submission to a guestbook
  if (isSubmissionRecord(eventData.commit.record)) {
    await handleSubmissionEvent(
      {
        submissionRecordKey: eventData.commit.rkey,
        submission: eventData.commit.record,
        submissionAuthor: eventData.did,
      },
      eventData.commit.operation
    );
    console.log(
      `${eventData.commit.operation}d submission: ${eventData.did}/${eventData.kind}/${eventData.commit.rkey}`
    );

    return;
  }

  if (isGateRecord(eventData.commit.record)) {
    await handleGateEvent(
      {
        name: eventData.commit.rkey,
        content: eventData.commit.record,
        owner: eventData.did,
      },
      eventData.commit.operation
    );

    return;
  }

  console.error(`Unknown record type: ${eventData.commit.record.$type}`);
});

ws.on("error", (err) => {
  console.error("woopsie")!;
  console.error(err);
});
