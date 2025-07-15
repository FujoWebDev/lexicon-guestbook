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
import { z } from "zod";
import { handleBookEvent } from "./lib/book.js";
import { handleSubmissionEvent } from "./lib/submission.js";
import { db } from "./db/index.js";
import { Cursor } from "./db/schema.js";
import { eq } from "drizzle-orm";

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
console.log(await db.select({ cursor: Cursor.cursor }).from(Cursor).limit(1));
let LAST_CURSOR = (await db.select().from(Cursor).limit(1))[0]?.cursor;
const CURSOR_UPDATE_INTERVAL = 5 * 60 * 1000; // We'll update cursor every 5 minutes
if (LAST_CURSOR) {
  console.log(
    `Starting catch up from cursor: ${LAST_CURSOR} (${new Date(
      LAST_CURSOR / 1000
    ).toLocaleTimeString()})`
  );
  JETSTREAM_URL.searchParams.set("cursor", LAST_CURSOR.toString());
}

const ws = new WebSocket(JETSTREAM_URL);

// First, we define what happens when the connection to the Jetstream starts
// and ends. In our case, these are mostly courtesy messages.
ws.on("open", () => {
  console.log("Starting to listen");
  console.log("Ready to glomp your guestbook entries *glomps u too*");
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
  }

  // Check if this event is related to a submission to a guestbook
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
  }

  if (
    !LAST_CURSOR ||
    eventData.time_us - LAST_CURSOR > CURSOR_UPDATE_INTERVAL
  ) {
    console.log("Updating cursor...");
    if (!LAST_CURSOR) {
      // Insert the new cursor into the database.
      // We hardcode id 1 for the cursor since it's a single value.
      await db.insert(Cursor).values({
        id: 1,
        cursor: eventData.time_us,
      });
    } else {
      await db
        .update(Cursor)
        .set({
          cursor: eventData.time_us,
        })
        .where(eq(Cursor.id, 1));
    }
    LAST_CURSOR = eventData.time_us;
    console.log(
      `Updated cursor to: ${LAST_CURSOR} (${new Date(
        LAST_CURSOR / 1000
      ).toLocaleTimeString()})`
    );
  }

  // console.error(`Unknown record type: ${eventData.commit.record.$type}`);
});

ws.on("error", (err) => {
  console.error("woopsie")!;
  console.error(err);
});
