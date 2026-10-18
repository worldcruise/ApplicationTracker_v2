import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, requireRole, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    requireRole(scope, ["admin", "team_leader", "team_member"]);
    return databaseResult(client.from("candidates").select("id,fullName:full_name,owningTeamId:owning_team_id,ownerId:owner_id,status,rowVersion:row_version")
      .eq("organization_id", scope.organizationId).order("id").limit(100));
  });
}

