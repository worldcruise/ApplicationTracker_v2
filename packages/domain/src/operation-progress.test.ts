import assert from "node:assert/strict";
import test from "node:test";
import { createOperationProgress } from "./index.ts";

test("a local save cannot imply database synchronization or submission", () => {
  const progress = createOperationProgress();
  progress.validation = "succeeded";
  progress.pdfGeneration = "succeeded";
  progress.localArchive = "succeeded";
  progress.databaseSync = "failed";

  assert.equal(progress.localArchive, "succeeded");
  assert.equal(progress.databaseSync, "failed");
  assert.equal(progress.clipboard, "idle");
  assert.equal("submitted" in progress, false);
});

test("operation progress belongs to one operation and is not shared mutable state", () => {
  const first = createOperationProgress();
  const second = createOperationProgress();
  first.localArchive = "succeeded";
  first.databaseSync = "unknown";

  assert.equal(second.localArchive, "idle");
  assert.equal(second.databaseSync, "idle");
});
