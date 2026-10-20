import { processingStages, processingStates } from "@candidate/contracts";
import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { strictObject } from "@/lib/candidates/input";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => {
    const { client, context } = await requestContext(request); const q = new URL(request.url).searchParams;
    const scope = currentOrganization(context, uuid(q.get("organizationId")));
    return databaseResult(client.rpc("operational_processing", { p_org: scope.organizationId, p_page: Number(q.get("page") ?? 1), p_resolved: q.get("resolved") === "true" }));
  });
}
export async function POST(request: Request) {
  return api(request, async () => {
    const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    const b = strictObject(await readJson(request, 4096), ["eventId", "operationId", "candidateId", "bidId", "stage", "state", "code"]);
    uuid(b.eventId); uuid(b.operationId); uuid(b.candidateId); if (b.bidId !== null) uuid(b.bidId);
    if (!processingStages.includes(b.stage as typeof processingStages[number]) || !processingStates.includes(b.state as typeof processingStates[number]) || !["PROCESSING_FAILED", "SYNC_UNKNOWN", "PERMISSION_DENIED", "CONFLICT", "RECOVERED", "PENDING"].includes(String(b.code))) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid redacted processing state.");
    return databaseResult(client.rpc("report_processing", { p_org: scope.organizationId, p_input: b }));
  });
}
