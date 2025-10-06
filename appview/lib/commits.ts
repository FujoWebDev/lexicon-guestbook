import { z } from "zod";

// This is what a create or update operation committed to the network looks like.
//
// It includes:
// - operation: the operation that was committed
// - collection: the collection of the record (usually the name of a record Lexicon, e.g. "com.fujocoded.guestbook.book")
// - rkey: the rkey of the record, which uniquely identifies the record within the collection
// - record: the record that was committed, usually defined through a Lexicon
// - rev: the revision of the record (TODO: explain)
// - cid: the cid of the record (TODO: explain)
const CreateOrUpdateOperationSchema = z.object({
  operation: z.enum(["create", "update"]),
  collection: z.string(),
  rkey: z.string(),
  record: z
    .object({
      $type: z.string(),
    })
    .passthrough(),
  rev: z.string(),
  cid: z.string(),
});

// This is what a delete operation committed to the network looks like.
// Unlike the create or update operation, this one doesn't include a record—it was,
// after all, deleted.
//
// It includes:
// - operation: the operation that was committed, in this case "delete"
// - collection: the collection of the record (usually the name of a record Lexicon, e.g. "com.fujocoded.guestbook.book")
// - rkey: the rkey of the record, which uniquely identifies the record within the collection
// - rev: the revision of the record (TODO: explain)
// - cid: the cid of the record (TODO: explain)
const DeleteOperationSchema = z.object({
  operation: z.enum(["delete"]),
  collection: z.string(),
  rkey: z.string(),
  rev: z.string(),
  cid: z.string(),
});

// This is what the full commit events from the Jetstream look like.
//
// Each commit event has:
// - did: the did of the user who committed the event
// - time_us: the time of the event in microseconds
// - kind: the kind of event, which is always "commit"
// - commit: the commit itself, which can be a create, update, or delete operation
export const CommitEventSchema = z.object({
  did: z.string(),
  time_us: z.number(),
  kind: z.literal("commit"),
  commit: z.union([CreateOrUpdateOperationSchema, DeleteOperationSchema]),
});
export type CommitEvent = z.infer<typeof CommitEventSchema>;
