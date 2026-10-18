/** Operation outcomes are independent; none of these states records submission. */
export type OperationState = "idle" | "pending" | "succeeded" | "failed" | "unknown";
export type OperationStep =
  | "validation" | "pdfGeneration" | "localArchive" | "databaseSync" | "clipboard";
export type OperationProgress = Record<OperationStep, OperationState>;
