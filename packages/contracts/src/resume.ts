export const RESUME_SCHEMA_VERSION = 1 as const;

/** Canonical v1 content only. Schema metadata and provenance stay outside it. */
export interface ResumeContentV1 {
  company: string;
  title: string;
  summary: string;
  skills: Record<string, string[]>[];
  experience: { title: string; company: string; sentences: string[] }[];
  education: { degree: string }[];
}
