import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceProcessingReports } from "./processing-reports.ts";
test("failure reports retain retry IDs, independent stages and redacted recovery across reopening", () => {
  const identity = { operationId: "operation", actorId: "actor", organizationId: "org", candidateId: "candidate", bidId: null };
  let n = 0; const id = () => "event-" + ++n;
  const empty = { states: {}, queue: [] };
  const failed = advanceProcessingReports(empty, identity, { local: { state: "succeeded" }, database: { state: "unknown" } }, id);
  assert.equal(failed.queue.length, 1); assert.equal(failed.queue[0]?.stage, "database"); assert.equal(failed.queue[0]?.code, "SYNC_UNKNOWN");
  assert.deepEqual(empty, { states: {}, queue: [] });
  const reopened = advanceProcessingReports(structuredClone(failed), identity, { database: { state: "unknown" } }, id);
  assert.deepEqual(reopened.queue, failed.queue, "reopening/repeated attempts retain the frozen report ID");
  const recovered = advanceProcessingReports(reopened, identity, { database: { state: "succeeded" }, clipboard: { state: "failed" } }, id);
  assert.deepEqual(recovered.queue.map(e => [e.eventId, e.stage, e.code]), [["event-1", "database", "SYNC_UNKNOWN"], ["event-2", "database", "RECOVERED"], ["event-3", "clipboard", "PROCESSING_FAILED"]]);
  assert.equal(Object.hasOwn(recovered.queue[0]!, "actorId"), false, "server derives actor from the request");
  assert.deepEqual(Object.keys(recovered.queue[0]!).sort(), ["bidId", "candidateId", "code", "eventId", "operationId", "stage", "state"]);
});
