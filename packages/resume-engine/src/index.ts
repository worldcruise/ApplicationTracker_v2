import type { ResumeContentV1, RESUME_SCHEMA_VERSION } from "@candidate/contracts";

/** Rendering boundary only. Layout/PDF implementation belongs to T008/T028. */
export interface ResumeRenderInput {
  content: ResumeContentV1;
  schemaVersion: typeof RESUME_SCHEMA_VERSION;
  templateVersionId: string;
  rendererVersion: string;
}

export interface RenderedResume {
  bytes: Uint8Array;
  pageCount: number;
  sha256: string;
}

export type ResumeRenderer = (input: ResumeRenderInput) => Promise<RenderedResume>;
