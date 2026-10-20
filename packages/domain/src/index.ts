import type { OperationProgress } from "@candidate/contracts";
export * from "./candidate-profile.js";
export * from "./resume-review.js";
export * from "./workflow.js";
export * from "./history.js";
export * from "./archive-package.js";
export * from "./processing-reports.js";

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
