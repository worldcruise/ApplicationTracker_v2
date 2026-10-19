import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classicLayout, type CandidateProfile, type CoverLetterVersion, type FrozenTemplate, type OrganizationScope, type ResumeReviewInput } from "@candidate/contracts";
import { isResumeReviewInput, reviewResume } from "@candidate/domain";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { uuid } from "@/lib/api/guards";
import { strictObject } from "@/lib/candidates/input";
import { getProfile } from "@/lib/candidates/service";
import { render, renderReceipt } from "@/lib/resumes/render";
import { getSource } from "@/lib/resumes/service";

export const documentColumns = "id,kind,candidateId:candidate_id,filename,pdfSha256:pdf_sha256,byteSize:byte_size,pageCount:page_count,schemaVersion:schema_version,templateVersionId:template_version_id,rendererVersion:renderer_version,assetHashes:asset_hashes,reviewed,createdAt:created_at";
export const letterColumns = "id,candidateId:candidate_id,bidId:bid_id,version,operationId:operation_id,bodyText:body_text,schemaVersion:schema_version,snapshot:candidate_snapshot,templateVersionId:template_version_id,templateSnapshot:template_snapshot,rendererVersion:renderer_version,provenance,render:render_receipt,createdAt:created_at,createdBy:created_by";
export const letterContent = (text: string) => ({ company: "", title: "", summary: text, skills: [], experience: [], education: [] });
export function letterAnalysis(body: unknown, mapping: unknown, snapshot: CandidateProfile) {
  if (typeof body !== "string" || Buffer.byteLength(body, "utf8") > 204800 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body)) throw new ApiFailure(422, "SCHEMA_INVALID", "Supply plain cover letter text up to 200 KiB. Your original text is retained.");
  if (!isResumeReviewInput(mapping)) throw new ApiFailure(422, "SCHEMA_INVALID", "Supply factual review evidence for the letter.");
  return { body, review: reviewResume(letterContent(body), snapshot, mapping) };
}
export function letterPayload(value: unknown) {
  const b = strictObject(value, ["operationId", "candidateId", "bidId", "schemaVersion", "profileRevision", "templateVersionId", "bodyText", "review", "render"]);
  uuid(b.operationId); uuid(b.candidateId); uuid(b.templateVersionId); if (b.bidId !== null) uuid(b.bidId);
  if (b.schemaVersion !== 1 || !Number.isSafeInteger(b.profileRevision) || Number(b.profileRevision) < 1) throw new ApiFailure(422, "SCHEMA_INVALID", "Use letter schema v1 and the current profile revision.");
  return b;
}
export async function getLetter(client: SupabaseClient, scope: OrganizationScope, id: string) {
  const row = await databaseResult<CoverLetterVersion | null>(client.from("cover_letter_versions").select(letterColumns).eq("organization_id", scope.organizationId).eq("id", id).maybeSingle());
  if (!row) throw new ApiFailure(403, "FORBIDDEN", "This letter version is unavailable in your current scope.");
  await getProfile(client, scope, row.candidateId); return row;
}
async function getTemplate(client: SupabaseClient, id: string) {
  const t = await databaseResult<FrozenTemplate | null>(client.from("template_versions").select("id,name,version,layout,layoutHash:layout_hash,assetHashes:asset_hashes,rendererVersion:renderer_version").eq("id", id).maybeSingle());
  if (!t) throw new ApiFailure(403, "FORBIDDEN", "This template version is unavailable in your current scope.");
  return { ...t, layout: t.rendererVersion === "ats-classic/1.0.0" ? classicLayout : t.layout };
}
export async function renderLetter(snapshot: CandidateProfile, template: FrozenTemplate, bodyText: unknown, mapping: unknown, renderedAt: unknown) {
  const analysis = letterAnalysis(bodyText, mapping, snapshot);
  if (typeof renderedAt !== "string" || renderedAt.length > 30 || !Number.isFinite(Date.parse(renderedAt))) throw new ApiFailure(422, "SCHEMA_INVALID", "Use the frozen ISO render timestamp.");
  return render({ rawJson: JSON.stringify(letterContent(analysis.body)), letterText: analysis.body, snapshot, mapping: analysis.review.mapping, reviewed: analysis.review.reviewed, renderedAt, templateVersionId: template.id,
    template: { ...template, layout: template.rendererVersion === "ats-classic/1.0.0" ? classicLayout : template.layout, rendererVersion: "template-engine/2.0.0" } });
}
export async function renderCurrentLetter(client: SupabaseClient, scope: OrganizationScope, b: Record<string, unknown>, renderedAt: unknown) {
  const snapshot = await getProfile(client, scope, uuid(b.candidateId));
  if (snapshot.status === "archived") throw new ApiFailure(403, "FORBIDDEN", "Restore the candidate before creating a letter.");
  if (snapshot.rowVersion !== b.profileRevision) throw new ApiFailure(409, "VERSION_CONFLICT", "The profile changed. Reload and re-review before creating a new letter version.");
  return renderLetter(snapshot, await getTemplate(client, uuid(b.templateVersionId)), b.bodyText, b.review, renderedAt);
}
export async function recoverPdf(client: SupabaseClient, scope: OrganizationScope, kind: "resume" | "cover_letter", id: string) {
  const source = kind === "resume" ? await getSource(client, scope, id) : await getLetter(client, scope, id);
  if (!source.render) throw new ApiFailure(422, "SCHEMA_INVALID", "This version has no recorded PDF. Save a new rendered version to record one.");
  const result = "rawJson" in source
    ? await render({ rawJson: source.rawJson, snapshot: source.snapshot, mapping: source.provenance.mapping, reviewed: source.provenance.reviewed, renderedAt: source.render.renderedAt, templateVersionId: source.templateVersionId, ...(source.templateSnapshot ? { template: source.templateSnapshot } : {}) })
    : await renderLetter(source.snapshot, source.templateSnapshot, source.bodyText, source.provenance.mapping, source.render.renderedAt);
  if (result.sha256 !== source.render.sha256 || result.pageCount !== source.render.pageCount || result.rendererVersion !== source.render.rendererVersion) throw new ApiFailure(409, "VERSION_CONFLICT", "Pinned recovery did not reproduce the recorded PDF hash. No replacement was substituted. Retrieve previously stored bytes or restore the pinned renderer/assets.");
  return { source, result };
}
export async function storeDocument(client: SupabaseClient, scope: OrganizationScope, kind: "resume" | "cover_letter", id: string, requestId: string) {
  const key = process.env.DOCUMENT_RENDER_SIGNING_KEY; const keyId = process.env.DOCUMENT_RENDER_KEY_ID ?? "primary";
  if (!key || !/^[0-9a-f]{64}$/.test(key) || !/^[a-zA-Z0-9_-]{1,60}$/.test(keyId)) throw new ApiFailure(503, "SERVICE_UNAVAILABLE", "Exact PDF storage needs the server signing key and matching database key registration. Source versions and local PDFs remain available.");
  const { source, result } = await recoverPdf(client, scope, kind, id);
  const filename = `${kind}_v${source.version}_${id.slice(0, 8)}.pdf`;
  const message = ["document.v1", scope.organizationId, kind, id, result.sha256, source.templateVersionId, result.rendererVersion, result.pageCount, filename].join("|");
  const signature = createHmac("sha256", Buffer.from(key, "hex")).update(message, "utf8").digest("hex");
  const documentId = await databaseResult<string>(client.rpc("store_rendered_document", { p_org: scope.organizationId, p_kind: kind, p_source: id, p_base64: Buffer.from(result.bytes).toString("base64"), p_filename: filename, p_key_id: keyId, p_signature: signature, p_request: requestId }));
  return databaseResult(client.from("documents").select(documentColumns).eq("id", documentId).eq("organization_id", scope.organizationId).single());
}
export { renderReceipt };
export type { ResumeReviewInput };
