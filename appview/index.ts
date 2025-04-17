import WebSocket from "ws";
import {
  type Record as Book,
  isRecord as isBook,
} from "../client/generated/api/types/com/fujocoded/guestbook/book.js";
import {
  type Record as Submission,
  isRecord as isSubmission,
} from "../client/generated/api/types/com/fujocoded/guestbook/submission.js";

type CommitEvent<T> = {
  did: string;
  kind: "commit";
  commit:
    | {
        operation: "create" | "update";
        record: T;
        rev: string;
        collection: string;
        rkey: string;
        cid: string;
      }
    | {
        operation: "delete";
        rev: string;
        collection: string;
        rkey: string;
      };
};

const JETSTREAM_URL = new URL(
  "subscribe",
  "wss://jetstream2.us-east.bsky.network/"
);
JETSTREAM_URL.searchParams.set(
  "wantedCollections",
  "com.fujocoded.guestbook.*"
);

const GUESTBOOKS = new Map<string /*owner did*/, (Book & { id: string })[]>();
const SUBMISSIONS = new Map<
  string /*atproto uri*/,
  (Submission & { id: string; author: string })[]
>();

const ws = new WebSocket(JETSTREAM_URL);

ws.on("open", () => {
  console.log("Starting to listen");
  console.log("Tell me all your secrets *glomps u*");
});

ws.on("message", async (data) => {
  const eventData: CommitEvent<unknown> = JSON.parse(data.toString());
  if (
    eventData.kind !== "commit" ||
    !eventData.commit.collection.startsWith("com.fujocoded.guestbook")
  ) {
    return;
  }

  console.log("Received event:");
  console.dir(eventData, { depth: null });

  // @ts-expect-error
  if (isBook(eventData.commit["record"])) {
    const bookEvent = eventData as CommitEvent<Book>;
    const owner = bookEvent.did;
    const previousData = GUESTBOOKS.get(owner) ?? [];
    console.log(
      `Received book event ${bookEvent.commit.operation} for key ${bookEvent.commit.rkey}`
    );
    if (bookEvent.commit.operation == "create") {
      GUESTBOOKS.set(owner, [
        ...previousData,
        { id: bookEvent.commit.rkey, ...bookEvent.commit.record },
      ]);
    }
    // TODO: Do this right
    if (bookEvent.commit.operation == "delete") {
      GUESTBOOKS.set(
        owner,
        previousData.filter((book) => book.id !== bookEvent.commit.rkey)
      );
    }
  }

  // TODO: check type of operation before figuring out type
  // @ts-expect-error
  if (isSubmission(eventData.commit["record"])) {
    const submissionEvent = eventData as CommitEvent<Submission>;
    console.log(
      `Received submission event ${submissionEvent.commit.operation} for key ${submissionEvent.commit.rkey}`
    );
    // We're only handling create because we really should do this with a database if we want to be fancier
    if (submissionEvent.commit.operation == "create") {
      const guestbookUri = submissionEvent.commit.record.postedTo;
      const previousData = SUBMISSIONS.get(guestbookUri) ?? [];
      SUBMISSIONS.set(guestbookUri, [
        ...previousData,
        {
          id: submissionEvent.commit.rkey,
          author: submissionEvent.did,
          ...submissionEvent.commit.record,
        },
      ]);
    }
    // TODO: Do this right
    if (submissionEvent.commit.operation == "delete") {
    }
  }

  console.log("Current guestbooks");
  console.dir(GUESTBOOKS, { depth: null });
  console.log("Current entries");
  console.dir(SUBMISSIONS, { depth: null });
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
