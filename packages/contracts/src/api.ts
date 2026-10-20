/** Starter contracts from design section 10; route contracts arrive in T005. */
export type ApiErrorCode =
  | "INVALID_JSON" | "SCHEMA_INVALID" | "FACTUAL_REVIEW_REQUIRED"
  | "UNAUTHENTICATED" | "FORBIDDEN" | "VERSION_CONFLICT"
  | "DUPLICATE_JOB" | "KEY_PAYLOAD_MISMATCH"
  | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "CLIENT_UPGRADE_REQUIRED";
// Additive error: unsupported clients retain their local operations until upgraded.

export interface ApiErrorResponse {
  requestId: string;
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors: readonly { path: string; message: string }[];
    retryable: boolean;
    currentVersion?: number;
  };
}

export interface ApiResponse<T> {
  requestId: string;
  data: T;
}
