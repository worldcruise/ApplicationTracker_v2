import type { CandidateProfile } from "./candidates.js";
import type { ResumeContentV1 } from "./resume.js";
import type { ResumeIssue } from "./resume-validation.js";
export interface ResumeReviewInput {
  experienceIds: (string | null)[]; educationIds: (string | null)[];
  claims: Record<string, { sources: string[]; attested: boolean }>;
}
export interface ResumeEvidence { id: string; label: string; text: string }
export interface ResumeClaim { path: string; text: string; workId: string | null; automatic: boolean; resolved: boolean; issues: string[] }
export interface ResumeReview {
  mapping: ResumeReviewInput; claims: ResumeClaim[]; conflicts: ResumeIssue[]; reviewed: boolean;
}
export interface PromptVersion {
  id: string; presetId: string; version: number; kind: "main" | "custom";
  scope: "global" | "team" | "candidate"; scopeId: string | null;
  name: string; description: string; content: string; enabled: boolean; order: number;
}
export interface PromptAssembly {
  id: string; candidateId: string; profileRevisionId: string; profileRevision: number;
  templateVersionId: string; promptVersionIds: string[]; text: string; sha256: string; createdAt: string;
  job: { company: string; title: string; description: string }; snapshot: CandidateProfile;
}
export interface ResumeRenderReceipt { sha256: string; pageCount: number; rendererVersion: string; renderedAt: string }
export interface ResumeSourceRequest {
  operationId: string; assemblyId: string; schemaVersion: 1; rawJson: string; review: ResumeReviewInput; render: ResumeRenderReceipt | null;
}
export interface ResumeSourceVersion {
  id: string; candidateId: string; version: number; operationId: string; assemblyId: string;
  rawJson: string; content: ResumeContentV1; schemaVersion: 1; snapshot: CandidateProfile;
  provenance: ResumeReview; templateVersionId: string; rendererVersion: string;
  render: ResumeRenderReceipt | null; createdAt: string; createdBy: string; replayed?: boolean;
}
export type ResumeStep = "validation" | "pdfGeneration" | "localExport" | "databaseSync" | "clipboard";
export interface ResumeOutcome { state: "idle" | "pending" | "succeeded" | "failed" | "unknown" | "initiated"; attempts: number; error: string | null; updatedAt: string | null }
export type ResumeOutcomes = Record<ResumeStep, ResumeOutcome>;
