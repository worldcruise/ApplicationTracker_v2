import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderAtsClassic, ATS_CLASSIC, type AtsInput } from "@candidate/resume-engine";
import type { PromptAssembly, ResumeRenderReceipt } from "@candidate/contracts";
import { ApiFailure } from "@/lib/api/errors";
import { analyzeSource } from "./service";
const fontRoot = path.resolve(process.cwd(), "../../packages/resume-engine/assets/fonts");
async function fonts() { const [regular, bold] = await Promise.all([readFile(path.join(fontRoot, "NotoSans-Regular.ttf")), readFile(path.join(fontRoot, "NotoSans-Bold.ttf"))]); return { regular: new Uint8Array(regular), bold: new Uint8Array(bold) }; }
export async function render(input: AtsInput) {
  try { return await renderAtsClassic(await fonts(), input); }
  catch (error) { throw new ApiFailure(422, "SCHEMA_INVALID", error instanceof Error ? error.message : "PDF generation failed; source text is retained."); }
}
export async function renderAssembly(assembly: PromptAssembly, rawJson: unknown, mapping: unknown, renderedAt: unknown) {
  const analysis = analyzeSource(assembly, rawJson, mapping);
  if (typeof renderedAt !== "string" || renderedAt.length > 30 || !Number.isFinite(Date.parse(renderedAt))) throw new ApiFailure(422, "SCHEMA_INVALID", "Use the frozen ISO render timestamp.");
  return render({ rawJson: analysis.validation.rawJson, snapshot: assembly.snapshot, mapping: analysis.review.mapping, reviewed: analysis.review.reviewed, renderedAt, templateVersionId: assembly.templateVersionId, ...(assembly.templateSnapshot ? { template: assembly.templateSnapshot } : {}) });
}
export function renderReceipt(value: unknown): ResumeRenderReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiFailure(422, "SCHEMA_INVALID", "Supply the frozen render receipt or null.");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "pageCount,renderedAt,rendererVersion,sha256" || typeof v.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(v.sha256) || !Number.isSafeInteger(v.pageCount) || Number(v.pageCount) < 1 || Number(v.pageCount) > 100 || ![ATS_CLASSIC.renderer, "template-engine/2.0.0"].includes(String(v.rendererVersion)) || typeof v.renderedAt !== "string") throw new ApiFailure(422, "SCHEMA_INVALID", "The render receipt is invalid.");
  return v as unknown as ResumeRenderReceipt;
}
