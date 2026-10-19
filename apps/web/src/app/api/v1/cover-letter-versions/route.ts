import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { getProfile } from "@/lib/candidates/service";
import { getLetter, letterAnalysis, letterPayload, renderCurrentLetter, renderReceipt } from "@/lib/documents/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request) { return api(request, async () => {
  const { client, context } = await requestContext(request); const q = new URL(request.url).searchParams;
  const scope = currentOrganization(context, uuid(q.get("organizationId"))); const candidateId = uuid(q.get("candidateId")); await getProfile(client, scope, candidateId);
  const query = client.from("cover_letter_versions").select("id,version,operationId:operation_id,bidId:bid_id,reviewed,render:render_receipt,createdAt:created_at").eq("organization_id", scope.organizationId).eq("candidate_id", candidateId).order("version", { ascending: false }).limit(50);
  if (q.has("operationId")) query.eq("operation_id", uuid(q.get("operationId"))).eq("created_by", context.userId);
  return databaseResult(query);
}); }
export async function POST(request: Request) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
  const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId"))); const b = letterPayload(await readJson(request, 300000));
  if (uuid(request.headers.get("idempotency-key")) !== b.operationId) throw new ApiFailure(422, "SCHEMA_INVALID", "Reuse the original operation UUID in Idempotency-Key.");
  // Reconcile a retry against its immutable snapshot, even after the live profile changes.
  const old = await databaseResult<{ id: string } | null>(client.from("cover_letter_versions").select("id").eq("organization_id", scope.organizationId).eq("operation_id", b.operationId).maybeSingle());
  const snapshot = old ? (await getLetter(client, scope, old.id)).snapshot : await getProfile(client, scope, uuid(b.candidateId));
  const analysis = letterAnalysis(b.bodyText, b.review, snapshot);
  if (b.render !== null && !old) {
    const receipt = renderReceipt(b.render); const rendered = await renderCurrentLetter(client, scope, b, receipt.renderedAt);
    if (receipt.sha256 !== rendered.sha256 || receipt.pageCount !== rendered.pageCount || receipt.rendererVersion !== rendered.rendererVersion) throw new ApiFailure(409, "VERSION_CONFLICT", "PDF does not match the frozen letter. Retain the existing bytes and create a new operation.");
  }
  const id = await databaseResult<string>(client.rpc("save_cover_letter", { p_org: scope.organizationId, p_candidate: b.candidateId, p_payload: { ...b, review: analysis.review.mapping }, p_request: requestId }));
  return getLetter(client, scope, id);
}); }
