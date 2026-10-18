import type { ApiErrorCode } from "@candidate/contracts";

export class ApiFailure extends Error {
  constructor(public status: number, public code: ApiErrorCode, message: string, public retryable = false) {
    super(message);
  }
}

export interface DatabaseFailure { code?: string; message?: string }

export function databaseFailure(error: DatabaseFailure): ApiFailure {
  if (error.code === "42501") return new ApiFailure(403, "FORBIDDEN", "Access is not permitted in your current scope.");
  if (error.code === "40001") return new ApiFailure(409, "VERSION_CONFLICT", "This record changed. Reload its current version.");
  if (error.message === "KEY_PAYLOAD_MISMATCH") return new ApiFailure(409, "KEY_PAYLOAD_MISMATCH", "Reuse the original operation ID only with its original payload and actor.");
  if (error.message === "LAST_ACTIVE_ADMIN") return new ApiFailure(409, "FORBIDDEN", "Keep at least one active organization administrator.");
  if (error.message === "IDENTITY_NOT_CONFIRMED") return new ApiFailure(409, "SCHEMA_INVALID", "Confirm the account email before activation.");
  if (["22023", "23503", "23505", "23514", "23502"].includes(error.code ?? "")) {
    return new ApiFailure(400, "SCHEMA_INVALID", "The requested values conflict with the current membership or resource constraints.");
  }
  if (error.code === "P0002") return new ApiFailure(403, "FORBIDDEN", "The requested resource is unavailable in your current scope.");
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code ?? "")) {
    return new ApiFailure(503, "SERVICE_UNAVAILABLE", "The application schema is unavailable. Apply the foundation migrations.", true);
  }
  return new ApiFailure(503, "SERVICE_UNAVAILABLE", "The application service is unavailable. Retry with the original operation ID.", true);
}

export async function databaseResult<T>(result: PromiseLike<{ data: unknown; error: DatabaseFailure | null }>): Promise<T> {
  const { data, error } = await result;
  if (error) throw databaseFailure(error);
  return data as T;
}

