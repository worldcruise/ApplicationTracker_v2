import type { ApiErrorCode } from "@candidate/contracts";

export class ApiFailure extends Error {
  currentVersion: number | undefined;
  constructor(public status: number, public code: ApiErrorCode, message: string, public retryable = false,
    public fieldErrors: readonly { path: string; message: string }[] = []) {
    super(message);
  }
}

export interface DatabaseFailure { code?: string; message?: string }

export function databaseFailure(error: DatabaseFailure): ApiFailure {
  const workflowMessages: Record<string,string> = {
    INVALID_BID_TRANSITION:"This bid cannot move to the selected status. Reload the current status and choose an allowed transition.",
    APPROVAL_REQUIRED:"An independent approval of these exact job details and document versions is required.",
    PROFILE_FACTS_CHANGED:"Candidate facts changed. Create fresh reviewed resume and letter versions before requesting review.",
    VERIFIED_DOCUMENTS_REQUIRED:"Select a reviewed resume and any policy-required reviewed cover letter.",
    BID_CONTENT_FROZEN:"Submitted job details and documents are frozen. An administrator must explicitly reopen the bid before preparing a new submission.",
    SUBMISSION_ATTESTATION_REQUIRED:"Record the actual submission timestamp and confirmation or explicit attestation.",
    WORKFLOW_POLICY_REQUIRED:"An administrator must configure this team's approval policy.",
    INTERVIEW_INVITATION_REQUIRED:"Create a round only for a bid with an interview invitation.",
    NEXT_ROUND_REQUIRED:"Complete the previous round with the Next Round outcome before adding its successor.",
    INVALID_SCHEDULE:"The UTC time, local time, IANA zone and chosen offset do not agree.",
    COMPLETION_REQUIRED:"Record interview completion before recording feedback or an outcome.",
    INVALID_INTERVIEW_TRANSITION:"Completed rounds cannot return to scheduling; cancelled rounds remain historical.",
    LETTER_BID_MISMATCH:"This letter belongs to another bid. Select a letter prepared for this opportunity.",
    TASK_CLOSED:"This task has already been completed or cancelled.",
  };
  if (error.message && workflowMessages[error.message]) return new ApiFailure(422,"SCHEMA_INVALID",workflowMessages[error.message]!);
  if (error.message === "RENDER_ATTESTATION_REQUIRED") return new ApiFailure(503, "SERVICE_UNAVAILABLE", "The server render signing key is not registered or does not match the database. Ask the operator to configure document storage. Source versions and local PDFs are retained.");
  if (error.message === "PDF_HASH_MISMATCH") return new ApiFailure(409, "VERSION_CONFLICT", "The PDF failed its recorded integrity check. Exact export is blocked; no replacement was substituted.");
  if (error.message === "PACKAGE_SOURCE_UNSAFE") return new ApiFailure(403,"FORBIDDEN","The original JSON includes content outside this reviewed document. Ask an authorized preparer for a clean reviewed frozen version; the original was not rewritten.");
  if (error.message === "DUPLICATE_JOB") return new ApiFailure(409,"DUPLICATE_JOB","Multiple exact opportunities exist. Explicitly select the intended bid.");
  if (error.message === "CANDIDATE_ARCHIVED") return new ApiFailure(409, "SCHEMA_INVALID", "This candidate is archived. Restore it before making changes.");
  if (error.code === "42501") return new ApiFailure(403, "FORBIDDEN", "Access is not permitted in your current scope.");
  if (error.code === "40001") return new ApiFailure(409, "VERSION_CONFLICT", "This record changed. Reload its current version.");
  if (error.message === "KEY_PAYLOAD_MISMATCH") return new ApiFailure(409, "KEY_PAYLOAD_MISMATCH", "Reuse the original operation ID only with its original payload and actor.");
  if (error.message === "LAST_ACTIVE_ADMIN") return new ApiFailure(409, "FORBIDDEN", "Keep at least one active organization administrator.");
  if (error.message === "IDENTITY_NOT_CONFIRMED") return new ApiFailure(409, "SCHEMA_INVALID", "Confirm the account email before activation.");
  if (["22023", "22008", "22P02", "23503", "23505", "23514", "23502"].includes(error.code ?? "")) {
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

