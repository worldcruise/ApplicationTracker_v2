import type { OperationProgress } from "@candidate/contracts";

/** Fresh per-operation state; local success must never imply remote success. */
export function createOperationProgress(): OperationProgress {
  return {
    validation: "idle",
    pdfGeneration: "idle",
    localArchive: "idle",
    databaseSync: "idle",
    clipboard: "idle",
  };
}
