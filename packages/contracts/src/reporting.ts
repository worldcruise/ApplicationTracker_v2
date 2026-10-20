/** Reporting version changes require an explicit metric migration. */
export const reportingVersion = "operations/1" as const;
export const dashboardMetrics = ["active_candidates", "active_bids", "awaiting_review", "awaiting_response", "draft_bids", "document_work", "pending_offers", "open_tasks", "overdue_followups", "upcoming_interviews", "pending_feedback", "submitted", "interview_converted", "offer_converted", "all_bids"] as const;
export type DashboardMetric = typeof dashboardMetrics[number];
export const metricLabels: Record<DashboardMetric, string> = {
  active_candidates: "Active candidates", active_bids: "Active bids", awaiting_review: "Awaiting review", awaiting_response: "Awaiting response",
  draft_bids: "Draft bids", document_work: "Document preparation / revision", pending_offers: "Pending offers", open_tasks: "Open tasks",
  overdue_followups: "Overdue follow-ups", upcoming_interviews: "Upcoming interviews", pending_feedback: "Pending feedback",
  submitted: "Submitted cohort", interview_converted: "Cohort with interview invitation", offer_converted: "Cohort receiving offer", all_bids: "All scoped bids",
};
export interface DashboardFilters { teamId?: string; ownerId?: string; status?: string; company?: string; from?: string; to?: string; windowDays?: number }
export interface DashboardItem { id: string; kind: "bid" | "candidate" | "task" | "interview"; bidId: string | null; candidateId: string; teamId: string; ownerId: string | null; label: string; status: string; dueAt: string | null; timezone: string | null; updatedAt: string }
export interface DashboardReport {
  version: typeof reportingVersion; asOf: string; role: string; filters: DashboardFilters;
  cohort: { from: string; toExclusive: string }; upcomingTo: string;
  counts: Partial<Record<DashboardMetric, number>>;
  detail: { metric: DashboardMetric; total: number; page: number; pageSize: number; items: DashboardItem[] };
  workload: { teamId: string; ownerId: string | null; activeBids: number; openTasks: number }[];
  assignments: { teamId: string; candidates: number; unassigned: number }[];
  stages: { status: string; bids: number }[];
  interviewProgression: { lifecycle: string; outcome: string; rounds: number }[];
}
export const processingStages = ["validation", "pdfGeneration", "localExport", "databaseSync", "local", "database", "reconciliation", "clipboard"] as const;
export type ProcessingStage = typeof processingStages[number];
export const processingStates = ["pending", "failed", "unknown", "conflict", "succeeded"] as const;
export interface ProcessingObservation {
  eventId: string; operationId: string; candidateId: string; bidId: string | null;
  stage: ProcessingStage; state: typeof processingStates[number]; code: "PROCESSING_FAILED" | "SYNC_UNKNOWN" | "PERMISSION_DENIED" | "CONFLICT" | "RECOVERED" | "PENDING";
}
