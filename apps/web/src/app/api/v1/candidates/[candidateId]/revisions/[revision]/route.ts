import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { getProfile } from "@/lib/candidates/service";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ candidateId: string; revision: string }> }) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    const params = await route.params; const id = uuid(params.candidateId); await getProfile(client, scope, id);
    const number = Number(params.revision);
    if (!Number.isSafeInteger(number) || number < 1) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid revision number.");
    const row = await databaseResult<{ snapshot: unknown } | null>(client.from("candidate_profile_revisions").select("snapshot:verified_snapshot")
      .eq("organization_id", scope.organizationId).eq("candidate_id", id).eq("revision_number", number).maybeSingle());
    if (!row) throw new ApiFailure(403, "FORBIDDEN", "The revision is unavailable in your current scope.");
    return row.snapshot;
  });
}
