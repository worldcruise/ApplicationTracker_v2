export const TEMPLATE_SECTIONS = ["summary", "skills", "experience", "education"] as const;
export type TemplateSection = typeof TEMPLATE_SECTIONS[number];
export interface TemplateLayout {
  page: "Letter" | "A4"; margin: number; fontSize: number; lineHeight: number; paragraphSpacing: number; sectionSpacing: number; bulletIndent: number;
  nameSize: number; headingSize: number; align: "left" | "center"; accent: string; showLinks: boolean; experienceOrder: "source" | "date_desc";
  sections: TemplateSection[]; labels: Record<TemplateSection, string>;
}
export interface TemplateVersion {
  id: string; presetId: string | null; name: string; version: number; layout: TemplateLayout; layoutHash: string; assetHashes: Record<string, string>; rendererVersion: string;
  scope: "builtin" | "personal" | "team" | "organization" | "candidate"; sharing: "private" | "team" | "organization"; ownerId: string | null; teamId: string | null; candidateId: string | null; current: boolean;
}
export type FrozenTemplate = Pick<TemplateVersion, "id" | "name" | "version" | "layout" | "layoutHash" | "assetHashes" | "rendererVersion">;
export const classicLayout: TemplateLayout = { page: "Letter", margin: 48, fontSize: 10.5, lineHeight: 15, paragraphSpacing: 6, sectionSpacing: 7, bulletIndent: 10,
  nameSize: 22, headingSize: 12, align: "left", accent: "#141a1f", showLinks: true, experienceOrder: "source", sections: ["summary", "skills", "experience", "education"], labels: { summary: "Professional summary", skills: "Skills", experience: "Experience", education: "Education" } };
export const builtInTemplates = [
  { id: "a7000000-0000-4000-9000-000000000001", name: "ATS Classic", layout: classicLayout, rendererVersion: "ats-classic/1.0.0" },
  { id: "b7000000-0000-4000-9000-000000000001", name: "Modern Professional", layout: { ...classicLayout, accent: "#17604f", nameSize: 25 }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000002", name: "Minimal", layout: { ...classicLayout, margin: 54, headingSize: 11, showLinks: false, accent: "#444444" }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000003", name: "Technical", layout: { ...classicLayout, sections: ["skills", "summary", "experience", "education"] as TemplateSection[], accent: "#224466" }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000004", name: "Executive", layout: { ...classicLayout, margin: 54, fontSize: 11, lineHeight: 16, nameSize: 26, paragraphSpacing: 8 }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000005", name: "Compact", layout: { ...classicLayout, margin: 36, fontSize: 9.5, lineHeight: 12, paragraphSpacing: 4, sectionSpacing: 5, nameSize: 20 }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000006", name: "Academic", layout: { ...classicLayout, page: "A4" as const, margin: 54, sections: ["summary", "education", "experience", "skills"] as TemplateSection[] }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000007", name: "Creative", layout: { ...classicLayout, align: "center" as const, accent: "#704080", nameSize: 25, sectionSpacing: 9 }, rendererVersion: "template-engine/2.0.0" },
  { id: "b7000000-0000-4000-9000-000000000008", name: "Chronological", layout: { ...classicLayout, sections: ["experience", "summary", "skills", "education"] as TemplateSection[], experienceOrder: "date_desc" as const }, rendererVersion: "template-engine/2.0.0" },
];
export function validTemplateLayout(value: unknown): value is TemplateLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false; const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== Object.keys(classicLayout).sort().join() || !["Letter", "A4"].includes(String(v.page)) || !["left", "center"].includes(String(v.align)) || !["source", "date_desc"].includes(String(v.experienceOrder)) || typeof v.showLinks !== "boolean" || typeof v.accent !== "string" || !/^#[0-9a-f]{6}$/i.test(v.accent)) return false;
  for (const [key, min, max] of [["margin", 36, 72], ["fontSize", 9, 13], ["lineHeight", 12, 22], ["paragraphSpacing", 3, 16], ["sectionSpacing", 4, 18], ["bulletIndent", 6, 24], ["nameSize", 18, 28], ["headingSize", 11, 16]] as const) if (typeof v[key] !== "number" || !Number.isFinite(v[key]) || v[key] < min || v[key] > max) return false;
  if (Number(v.lineHeight) < Number(v.fontSize) + 2 || !Array.isArray(v.sections) || v.sections.length > 4 || new Set(v.sections).size !== v.sections.length || v.sections.some(s => !TEMPLATE_SECTIONS.includes(s as TemplateSection))) return false;
  if (!v.labels || typeof v.labels !== "object" || Array.isArray(v.labels) || Object.keys(v.labels).sort().join() !== [...TEMPLATE_SECTIONS].sort().join()) return false;
  return Object.values(v.labels).every(t => typeof t === "string" && t.trim().length > 0 && t.length <= 60 && !/[\u0000-\u001f]/.test(t));
}
