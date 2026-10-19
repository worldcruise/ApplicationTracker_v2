export const bidStatuses = ["draft","resume_preparation","ready_for_review","needs_changes","approved","submitted","awaiting_response","shortlisted","interview_invited","on_hold","rejected","withdrawn","expired","offer","closed"] as const;
export type BidStatus = typeof bidStatuses[number];
export const bidTransitions: Record<BidStatus, readonly BidStatus[]> = {
  draft:["resume_preparation","withdrawn","expired"], resume_preparation:["ready_for_review","submitted","on_hold","withdrawn"],
  ready_for_review:["approved","needs_changes","on_hold","withdrawn"], needs_changes:["resume_preparation","ready_for_review","withdrawn"],
  approved:["submitted","resume_preparation","on_hold","withdrawn"], submitted:["awaiting_response","shortlisted","interview_invited","rejected","offer","withdrawn","closed"],
  awaiting_response:["shortlisted","interview_invited","on_hold","rejected","expired","offer","withdrawn","closed"], shortlisted:["interview_invited","offer","on_hold","rejected","withdrawn","closed"],
  interview_invited:["offer","on_hold","rejected","withdrawn","closed"], on_hold:["withdrawn","expired","closed"], rejected:["closed"],withdrawn:["closed"],expired:["closed"],offer:["closed","rejected","withdrawn"],closed:[]
};
export interface WorkflowPolicy { required: boolean; coverLetterRequired: boolean; version: number }
export interface BidInput {
  candidateId: string; ownerId: string; teamId: string; companyName: string; jobTitle: string; jobDescription: string; jobUrl: string | null;
  externalId: string | null; jobLocation: string | null; priority: "low"|"normal"|"high"|"urgent"; followUpAt: string | null; lastContactAt: string | null;
  notes: string; outcome: string; resumeDocumentId: string | null; coverLetterDocumentId: string | null;
}
export interface Bid extends BidInput {
  id: string; status: BidStatus; rowVersion: number; contentRevision: number; contentHash: string; preparedBy: string;
  currentApprovalId: string | null; heldFromStatus: BidStatus | null; submittedAt: string | null; createdBy: string; createdAt: string; updatedAt: string;
  resumeVersionId: string | null; coverLetterVersionId: string | null;
}
export interface BidTransitionInput { operationId: string; status: BidStatus; reason: string; submittedAt: string | null; confirmation: string; attested: boolean; adminOverrideReason: string; reopen: boolean }
export const interviewLifecycles=["not_scheduled","scheduling","scheduled","completed","feedback_pending","cancelled"] as const;
export const interviewOutcomes=["pending","passed","next_round","offer","rejected"] as const;
export interface InterviewInput {
  bidId: string; ownerId: string; type: string; interviewer: string; localDateTime: string | null; timezone: string | null; offset: string | null;
  durationMinutes: number; location: string; meetingUrl: string | null; lifecycle: typeof interviewLifecycles[number]; outcome: typeof interviewOutcomes[number];
  nextAction: string; followUpAt: string | null;
}
export interface Interview extends InterviewInput { id: string; roundNumber: number; scheduledAt: string | null; rowVersion: number; createdAt: string; updatedAt: string }
export interface WorkflowTask { id: string; bidId: string; interviewId: string | null; assigneeId: string; title: string; dueAt: string; state: "open"|"completed"|"cancelled"; completedAt: string | null; rowVersion: number }
export interface WorkflowAccess { canEdit: boolean; canTransition: boolean; canSubmit: boolean; canReview: boolean; selfReview: boolean; canOverride: boolean; canAssign: boolean; canInterview: boolean; factsCurrent: boolean; policy: WorkflowPolicy | null }
export interface BidWorkspace { bid: Bid; access: WorkflowAccess; history: Record<string,unknown>[]; approvals: Record<string,unknown>[]; invalidations: Record<string,unknown>[]; submissions: Record<string,unknown>[]; revisions: Record<string,unknown>[] }
