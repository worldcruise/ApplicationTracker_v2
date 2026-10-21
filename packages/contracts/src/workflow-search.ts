import type { Bid, Interview } from "./workflow.js";

export type WorkflowSearchKind = "bids" | "interviews";
export const workflowSorts = ["relevance", "updated_desc", "created_desc", "company_asc", "candidate_asc", "followup_asc", "submitted_desc", "scheduled_asc", "scheduled_desc"] as const;
export type WorkflowSort = typeof workflowSorts[number];
export interface WorkflowSearchFilters {
  q?: string; candidateId?: string; company?: string; status?: string; ownerId?: string; teamId?: string;
  priority?: string; createdFrom?: string; createdTo?: string; submittedFrom?: string; submittedTo?: string;
  followup?: "due" | "overdue"; bidId?: string; type?: string; round?: number;
  scheduledFrom?: string; scheduledTo?: string; upcoming?: boolean; feedbackPending?: boolean;
  sort: WorkflowSort; page: number; pageSize: number;
}
export interface SearchOption { value: string; label: string }
export interface WorkflowSearchOptions {
  candidates: SearchOption[]; companies: SearchOption[]; owners: SearchOption[]; teams: SearchOption[]; types: SearchOption[]; rounds: SearchOption[];
}
export interface WorkflowSearchRow<T = Bid | (Interview & { previousRoundId: string | null })> {
  record: T; candidateName: string | null; companyName: string; jobTitle: string;
  ownerName: string | null; teamName: string | null;
}
export interface WorkflowSearchResult<T = Bid | (Interview & { previousRoundId: string | null })> {
  items: WorkflowSearchRow<T>[]; total: number; page: number; pageSize: number; asOf: string; options: WorkflowSearchOptions;
}
