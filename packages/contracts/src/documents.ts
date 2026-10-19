import type { CandidateProfile } from "./candidates.js";
import type { FrozenTemplate } from "./templates.js";
import type { ResumeRenderReceipt, ResumeReviewInput } from "./production.js";
export interface CoverLetterVersion {
  id: string; candidateId: string; bidId: string | null; operationId: string; version: number; bodyText: string; schemaVersion: 1;
  snapshot: CandidateProfile; templateVersionId: string; templateSnapshot: FrozenTemplate; rendererVersion: string;
  provenance: { mapping: ResumeReviewInput; reviewed: boolean; reviewerId: string | null; reviewedAt: string | null };
  render: ResumeRenderReceipt | null; createdAt: string; createdBy: string;
}
export interface FrozenDocument {
  id: string; kind: "resume" | "cover_letter"; candidateId: string; filename: string; pdfSha256: string; byteSize: number; pageCount: number;
  schemaVersion: number; templateVersionId: string; rendererVersion: string; assetHashes: Record<string, string>; reviewed: boolean; createdAt: string;
}
