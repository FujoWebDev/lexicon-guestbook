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
import { deleteGuestBook, isBookRecord, upsertGuestbook } from "./lib/book.js";
import {
  deleteSubmission,
  isSubmissionRecord,
  upsertSubmission,
} from "./lib/submission.js";
import {
  createCursorUpdater,
  cursorToDate,
  getLastCursor,
} from "./lib/cursor.js";
import { isGateRecord, upsertGate } from "./lib/gate.js";
import { CommitEvent, CommitEventSchema } from "./lib/commits.js";

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
const savedCursorMicroseconds = await getLastCursor();
if (savedCursorMicroseconds) {
  // If there is a saved cursor, we start again from there. If not, we'll start from
  // where the Jetstream is currently at.
  // TODO: figure out how to catch up from the beginning
  console.log(
    `Starting catch up from cursor: ${savedCursorMicroseconds} (${cursorToDate(
      savedCursorMicroseconds
    ).toLocaleString()})`
  );
  // We add the cursor parameter to the Jetstream URL so we start from the right place.
  JETSTREAM_URL.searchParams.set("cursor", savedCursorMicroseconds.toString());
}

// We'll update the cursor once every hour of data we process.
// Tests show we roughly process a hour of data every minute when we're catching
// up after a restart.
const CURSOR_UPDATE_INTERVAL_MILLISECONDS = 60 * 60 * 1000;
const maybeUpdateCursor = createCursorUpdater({
  startFromCursor: savedCursorMicroseconds,
  cursorUpdateIntervalMilliseconds: CURSOR_UPDATE_INTERVAL_MILLISECONDS,
});

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

  // Right now we only handle guestbook-related events, which are all about
  // "commit"ing data to the network (e.g. a new guestbook, or a deletion of a
  // submission, etc.)
  // TODO: handle other types of events to update user-visible identities, or to
  // deactivate accounts.
  if (rawEventData.kind !== "commit") {
    // Every time an event is processed, we call "maybeUpdateCursor" so we know
    // where to catch up from next time we start the program.
    // It's called "maybe" because it will only update the cursor once for every hour
    // of data we've processed.
    await maybeUpdateCursor(rawEventData.time_us);
    return;
  }

  const eventData = CommitEventSchema.parse(rawEventData);

  // We only asked to listen to guestbook-related events, so we should only get events
  // related to guestbooks.
  if (!eventData.commit.collection.startsWith("com.fujocoded.guestbook")) {
    throw new Error(
      `Unexpected collection type ${eventData.commit.collection}`
    );
  }

  console.log("Received event:");
  console.dir(eventData, { depth: null });

  // Once we're here, we know that the event is related to our guestbook. We then check
  // what type of collection we're dealing with (e.g. a Book, a Submission, or a Gate), and
  // handle it appropriately by passing the event data to the appropriate function.
  switch (eventData.commit.collection) {
    case "com.fujocoded.guestbook.book": {
      await handleBookCommitEvent(eventData);
      break;
    }
    case "com.fujocoded.guestbook.submission": {
      await handleSubmissionCommitEvent(eventData);
      break;
    }
    case "com.fujocoded.guestbook.gate": {
      await handleGateCommitEvent(eventData);
      break;
    }
    default: {
      console.error(
        `Unexpected collection type ${eventData.commit.collection}`
      );
      break;
    }
  }

  await maybeUpdateCursor(eventData.time_us);
});

async function handleBookCommitEvent(eventData: CommitEvent) {
  // A book commit event will create, update, or delete a guestbook.
  // In the case of a book, the event data will contain:
  // - The guestbook itself, as the record in the event data
  // - The record key of the guestbook, as the rkey in the event data
  // - The did of the owner of the guestbook, as the did in the event data
  if (
    eventData.commit.operation == "create" ||
    eventData.commit.operation == "update"
  ) {
    // If the record in the event data is not a book, something went very wrong!
    if (!isBookRecord(eventData.commit.record)) {
      throw new Error(
        `Unexpected record type ${eventData.commit.record.$type} passed to handleBookCommitEvent`
      );
    }
    await upsertGuestbook({
      book: eventData.commit.record,
      recordKey: eventData.commit.rkey,
      ownerDid: eventData.did,
    });
  }
  // In the case of a delete operation, everything stays the same, except that
  // there's no record in the event data.
  if (eventData.commit.operation == "delete") {
    await deleteGuestBook({
      guestbookKey: eventData.commit.rkey,
      ownerDid: eventData.did,
    });
  }
  console.log(
    `${eventData.commit.operation}d book: ${eventData.did}/${eventData.kind}/${eventData.commit.rkey}`
  );
}

async function handleSubmissionCommitEvent(eventData: CommitEvent) {
  // A submission commit event will create, update, or delete a submission.
  // In the case of a submission, the event data will contain:
  // - The submission itself, as the record in the event data
  // - The record key of the submission, as the rkey in the event data
  // - The did of the author of the submission, as the did in the event data
  if (
    eventData.commit.operation == "create" ||
    eventData.commit.operation == "update"
  ) {
    if (!isSubmissionRecord(eventData.commit.record)) {
      throw new Error(
        `Unexpected record type ${eventData.commit.record.$type} passed to handleSubmissionCommitEvent`
      );
    }
    await upsertSubmission({
      submission: eventData.commit.record,
      submissionRecordKey: eventData.commit.rkey,
      submissionAuthor: eventData.did,
    });
  }
  if (eventData.commit.operation == "delete") {
    await deleteSubmission({
      submissionAuthor: eventData.did,
      submissionRecordKey: eventData.commit.rkey,
    });
  }
  console.log(
    `${eventData.commit.operation}d submission: ${eventData.did}/${eventData.kind}/${eventData.commit.rkey}`
  );
}

async function handleGateCommitEvent(eventData: CommitEvent) {
  // A gate commit event will create, update, or delete a gate.
  // In the case of a gate, the event data will contain:
  // - The gate itself, as the record in the event data
  // - The record key of the gate, as the rkey in the event data
  // - The did of the owner of the gate, as the did in the event data
  if (eventData.commit.operation == "delete") {
    // TODO: handle deleting gates
  } else {
    if (!isGateRecord(eventData.commit.record)) {
      throw new Error(
        `Unexpected record type ${eventData.commit.record.$type} passed to handleGateCommitEvent`
      );
    }
    await upsertGate({
      name: eventData.commit.rkey,
      content: eventData.commit.record,
      owner: eventData.did,
    });
  }
  console.log(
    `${eventData.commit.operation}d gate: ${eventData.did}/${eventData.kind}/${eventData.commit.rkey}`
  );
}

ws.on("error", (err) => {
  console.error("woopsie")!;
  console.error(err);
});
