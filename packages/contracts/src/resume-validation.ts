import precompiled from "./generated/resume-v1.js";
import type { ResumeContentV1 } from "./resume.js";
export const RESUME_LIMITS = { jsonBytes: 1_048_576, jobBytes: 204_800, depth: 32, arrayEntries: 100 } as const;
export interface ResumeIssue { path: string; code: string; message: string }
export type ResumeValidation = { rawJson: string; errors: ResumeIssue[]; warnings: ResumeIssue[]; content: ResumeContentV1 | null };
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
const fields = ["company", "title", "summary", "skills", "experience", "education"];
const validate = precompiled as unknown as { (data: unknown): boolean; errors?: { instancePath: string; keyword: string; message?: string; params: { missingProperty?: string } }[] };

/** Shared browser/server parser; never mutates, formats or discards the original. */
export function validateResume(rawJson: string, schemaVersion: number = 1): ResumeValidation {
  const result: ResumeValidation = { rawJson, errors: [], warnings: [], content: null };
  const error = (path: string, code: string, message: string) => result.errors.push({ path, code, message });
  if (schemaVersion !== 1) { error("", "SCHEMA_INVALID", "Unsupported schema version. Select version 1."); return result; }
  if (new TextEncoder().encode(rawJson).length > RESUME_LIMITS.jsonBytes) { error("", "SCHEMA_INVALID", "Resume JSON exceeds 1 MiB."); return result; }
  let parsed: unknown;
  try { parsed = JSON.parse(rawJson); } catch (cause) {
    const text = cause instanceof Error ? cause.message : "";
    const position = /position (\d+)/.exec(text)?.[1];
    const offset = position ? Number(position) : null;
    const preceding = offset === null ? "" : rawJson.slice(0, offset);
    error("", "INVALID_JSON", offset === null ? "Invalid JSON. Check quotes, commas and closing brackets." : `Invalid JSON at character ${offset}, line ${preceding.split("\n").length}, column ${preceding.length - preceding.lastIndexOf("\n")}. Check quotes, commas and brackets.`);
    return result;
  }
  function safe(value: unknown, path: string, depth: number) {
    if (result.errors.length >= 100) return;
    if (depth > RESUME_LIMITS.depth) { error(path, "SCHEMA_INVALID", "Nesting exceeds 32 levels."); return; }
    if (typeof value === "string" && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) error(path, "SCHEMA_INVALID", "Remove unsupported control characters.");
    if (Array.isArray(value)) {
      if (value.length > RESUME_LIMITS.arrayEntries) { error(path, "SCHEMA_INVALID", "Use at most 100 entries per array."); return; }
      value.forEach((v, i) => safe(v, `${path}/${i}`, depth + 1));
    } else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) error(`${path}/${pointer(key)}`, "SCHEMA_INVALID", "Prototype-related property names are not supported.");
      safe(child, `${path}/${pointer(key)}`, depth + 1);
    }
  }
  safe(parsed, "", 0); if (result.errors.length) return result;
  if (!validate(parsed)) {
    for (const issue of (validate.errors ?? []).slice(0, 100)) error(issue.instancePath + (issue.params.missingProperty ? `/${pointer(issue.params.missingProperty)}` : ""), "SCHEMA_INVALID", issue.keyword === "required" ? "Required structure is missing; use an empty string or array for unknown content." : `Expected canonical v1 structure: ${issue.message ?? issue.keyword}.`);
    return result;
  }
  const value = parsed as ResumeContentV1 & Record<string, unknown>;
  function unsupported(object: object, supported: string[], path: string) {
    for (const key of Object.keys(object)) if (!supported.includes(key)) result.warnings.push({ path: `${path}/${pointer(key)}`, code: "UNSUPPORTED_FIELD", message: "Preserved in original JSON; excluded from canonical rendering. Add new fields only through schema versioning." });
  }
  unsupported(value, fields, "");
  value.experience.forEach((v, i) => unsupported(v, ["title", "company", "sentences"], `/experience/${i}`));
  value.education.forEach((v, i) => unsupported(v, ["degree"], `/education/${i}`));
  function empty(v: unknown, path: string) {
    if ((typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length)) result.warnings.push({ path, code: "EMPTY_CONTENT", message: "Empty content is structurally valid; review before using the resume." });
    if (Array.isArray(v)) v.forEach((child, i) => empty(child, `${path}/${i}`));
    else if (v && typeof v === "object") for (const [key, child] of Object.entries(v)) empty(child, `${path}/${pointer(key)}`);
  }
  // Copy only supported properties; rawJson remains the complete original.
  result.content = { company: value.company, title: value.title, summary: value.summary,
    skills: value.skills.map(category => Object.fromEntries(Object.entries(category).map(([k, v]) => [k, [...v]]))),
    experience: value.experience.map(v => ({ title: v.title, company: v.company, sentences: [...v.sentences] })), education: value.education.map(v => ({ degree: v.degree })) };
  empty(result.content, ""); return result;
}
