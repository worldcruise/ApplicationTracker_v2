import type { BidStatus } from "./workflow.js";

export const HISTORY_VERSION = "job-match/1" as const;
export interface ReviewedJobContext {
  company: string;
  title: string;
  url: string;
  description: string;
  externalId: string;
}
export interface HistoryIdentifiers {
  version: typeof HISTORY_VERSION;
  companyKey: string;
  companyLooseKey: string;
  canonicalUrl: string | null;
  urlHash: string | null;
  postingSpecific: boolean;
  descriptionHash: string | null;
  titleKey: string;
  externalId: string | null;
  provider: string | null;
}
export type MatchEvidence = "company_key" | "company_name_similarity" | "posting_url" | "url_reused_or_changed" | "generic_url" | "description_fingerprint" | "similar_title" | "unverified_external_id";
export interface HistoryRecord {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  jobDescription: string;
  externalId: string | null;
  status: BidStatus;
  submittedAt: string | null;
  updatedAt: string;
}
export interface HistoryMatch {
  id: string;
  company: string;
  title: string;
  status: BidStatus | null;
  submittedAt: string | null;
  evidence: MatchEvidence[];
  path?: string;
  files?: { name: string; bytes: number; sha256: string }[];
}
export interface HistoryMatches {
  company: HistoryMatch[];
  exact: HistoryMatch[];
  possible: HistoryMatch[];
}
export interface DatabaseHistory extends HistoryMatches {
  checkedAt: string;
  identifiers: HistoryIdentifiers;
  truncated: boolean;
  scope: "authorized_candidate";
}
export type ArchiveLookupState = "found" | "not_found" | "permission_required" | "check_failed" | "unknown";
export interface ArchiveHistory extends HistoryMatches {
  state: ArchiveLookupState;
  checkedAt: string;
  message: string;
  relativePath?: string;
  repairRequired?: boolean;
}
export interface ArchiveManifestV1 {
  archiveVersion: 1;
  organizationId: string;
  candidateId: string;
  operationId: string;
  bidId: string | null;
  context: ReviewedJobContext;
  identifiers: HistoryIdentifiers;
  packageComplete: boolean;
  schemaVersion: 1;
  templateVersionId: string;
  rendererVersion: string;
  files: Record<string, { sha256: string; bytes: number }>;
}
export interface ArchiveIndexV1 {
  archiveVersion: 1;
  organizationId: string;
  candidateId: string;
  companyKey: string;
  normalizationVersion: typeof HISTORY_VERSION;
  checkedAt: string;
  entries: { directory: string; operationId: string; identifiers: HistoryIdentifiers }[];
  byUrl: Record<string, string[]>;
  byDescription: Record<string, string[]>;
  byExternal: Record<string, string[]>;
}
export interface CaptureContext {
  version: 1;
  id: string;
  capturedAt: string;
  source: "shortcut" | "context_menu";
  actorId: string | null;
  organizationId: string | null;
  candidateId: string | null;
  company: string;
  url: string;
  pageTitle: string;
  description: string;
  captureState: "captured" | "partial" | "unavailable";
  warnings: string[];
}
