import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
import { getProfile } from "@/lib/candidates/service";
import { getAssembly, analyzeSource, getSource } from "@/lib/resumes/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request) { return api(request, async () => {
  const { client, context } = await requestContext(request); const q = new URL(request.url).searchParams;
  const scope = currentOrganization(context, uuid(q.get("organizationId"))); const candidateId = uuid(q.get("candidateId"));
  await getProfile(client, scope, candidateId);
  const query = client.from("resume_versions").select("id,version,operationId:operation_id,reviewed,render:render_receipt,createdAt:created_at,createdBy:created_by")
    .eq("organization_id", scope.organizationId).eq("candidate_id", candidateId).order("version", { ascending: false }).limit(50);
  if (q.has("operationId")) query.eq("operation_id", uuid(q.get("operationId"))).eq("created_by", context.userId);
  return databaseResult(query);
}); }
export async function POST(request: Request) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
  const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const b = strictObject(await readJson(request, 2_097_152), ["operationId", "assemblyId", "schemaVersion", "rawJson", "review", "render"]);
  if (uuid(request.headers.get("idempotency-key")) !== uuid(b.operationId) || b.schemaVersion !== 1) throw new ApiFailure(422, "SCHEMA_INVALID", "Use schema v1 and the original operation UUID in Idempotency-Key.");
  const assembly = await getAssembly(client, scope, uuid(b.assemblyId)); const analysis = analyzeSource(assembly, b.rawJson, b.review);
  if (b.render !== null) throw new ApiFailure(422, "SCHEMA_INVALID", "Render receipt verification is not enabled yet; save source without a PDF receipt.");
  const result = await databaseResult<{ id: string; replayed: boolean }>(client.rpc("save_resume_source", { p_org: scope.organizationId, p_candidate: assembly.candidateId, p_payload: { ...b, review: analysis.review.mapping }, p_request: requestId }));
  return { ...await getSource(client, scope, result.id), replayed: result.replayed };
}); }
