import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateResume, type OrganizationScope, type PromptAssembly, type PromptVersion, type ResumeSourceVersion, type ResumeReviewInput } from "@candidate/contracts";
import { isResumeReviewInput, reviewResume } from "@candidate/domain";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { getProfile } from "@/lib/candidates/service";
export const assemblyColumns = "id,candidateId:candidate_id,profileRevisionId:profile_revision_id,profileRevision:profile_revision,templateVersionId:template_version_id,templateSnapshot:template_snapshot,promptVersionIds:prompt_version_ids,job,text:prompt_text,sha256:prompt_sha256,createdAt:created_at,snapshot:candidate_snapshot";
export async function getAssembly(client: SupabaseClient, scope: OrganizationScope, id: string) {
  const row = await databaseResult<PromptAssembly | null>(client.from("prompt_assemblies").select(assemblyColumns).eq("organization_id", scope.organizationId).eq("id", id).maybeSingle());
  if (!row) throw new ApiFailure(403, "FORBIDDEN", "This assembly is unavailable in your current scope.");
  await getProfile(client, scope, row.candidateId); return row;
}
export function analyzeSource(assembly: PromptAssembly, rawJson: unknown, mapping: unknown) {
  if (typeof rawJson !== "string") throw new ApiFailure(422, "SCHEMA_INVALID", "Supply the original JSON text.");
  const validation = validateResume(rawJson);
  if (!validation.content) throw new ApiFailure(422, validation.errors.some(e => e.code === "INVALID_JSON") ? "INVALID_JSON" : "SCHEMA_INVALID", "Check the resume JSON. Your original input is retained.", false, validation.errors);
  if (mapping !== null && !isResumeReviewInput(mapping)) throw new ApiFailure(422, "SCHEMA_INVALID", "Supply valid record mappings and claim evidence.");
  const review = reviewResume(validation.content, assembly.snapshot, (mapping as ResumeReviewInput | null) ?? undefined);
  if (assembly.job.company.trim() && assembly.job.company.trim().toLocaleLowerCase("en-US") !== validation.content.company.trim().toLocaleLowerCase("en-US")) {
    review.conflicts.push({ path: "/company", code: "FACTUAL_REVIEW_REQUIRED", message: "Target company must match the reviewed job metadata; it is separate from historical employers." }); review.reviewed = false;
  }
  if (review.claims.length > 1000) throw new ApiFailure(422, "SCHEMA_INVALID", "This first workflow supports up to 1,000 narrative claims per review. Split the source into a smaller resume.");
  return { validation, content: validation.content, review };
}
export async function promptVersions(client: SupabaseClient, scope: OrganizationScope, candidateId: string) {
  const profile = await getProfile(client, scope, candidateId);
  const presets = await databaseResult<{ id: string; organizationId: string | null; kind: "main" | "custom"; scope: "global" | "team" | "candidate"; teamId: string | null; candidateId: string | null; current: number }[]>(client.from("prompt_presets")
    .select("id,organizationId:organization_id,kind,scope,teamId:team_id,candidateId:candidate_id,current:current_version").or(`organization_id.eq.${scope.organizationId},organization_id.is.null`).limit(1000));
  const applicable = presets.filter(p => p.scope === "global" || (p.scope === "team" && p.teamId === profile.owningTeamId) || (p.scope === "candidate" && p.candidateId === candidateId));
  const versions = applicable.length ? await databaseResult<{ id: string; presetId: string; version: number; name: string; description: string; content: string; enabled: boolean; order: number }[]>(client.from("prompt_versions")
    .select("id,presetId:preset_id,version,name,description,content,enabled,order:sort_order").in("preset_id", applicable.map(p => p.id)).order("version", { ascending: false }).limit(1000)) : [];
  return versions.map(v => { const p = applicable.find(p => p.id === v.presetId)!; return { ...v, kind: p.kind, scope: p.scope, scopeId: p.teamId ?? p.candidateId, current: p.current === v.version, builtin: p.organizationId === null } satisfies PromptVersion & { current: boolean; builtin: boolean }; });
}
export const sourceColumns = "id,candidateId:candidate_id,version,operationId:operation_id,assemblyId:assembly_id,rawJson:raw_json,content:parsed_content,schemaVersion:schema_version,snapshot:candidate_snapshot,provenance,templateVersionId:template_version_id,templateSnapshot:template_snapshot,rendererVersion:renderer_version,render:render_receipt,createdAt:created_at,createdBy:created_by";
export async function getSource(client: SupabaseClient, scope: OrganizationScope, id: string) {
  const row = await databaseResult<(Omit<ResumeSourceVersion, "provenance"> & { provenance: { mapping: ResumeReviewInput; reviewerId: string | null; reviewedAt: string | null; reviewed: boolean } }) | null>(client.from("resume_versions").select(sourceColumns).eq("organization_id", scope.organizationId).eq("id", id).maybeSingle());
  if (!row) throw new ApiFailure(403, "FORBIDDEN", "This source version is unavailable in your current scope.");
  await getProfile(client, scope, row.candidateId);
  const review = reviewResume(row.content, row.snapshot, row.provenance.mapping);
  review.reviewed = row.provenance.reviewed && review.reviewed;
  return { ...row, provenance: { ...review, reviewerId: row.provenance.reviewerId, reviewedAt: row.provenance.reviewedAt } };
}
