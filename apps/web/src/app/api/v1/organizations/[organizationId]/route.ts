import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";
import type { FoundationSnapshot } from "@candidate/contracts";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ organizationId: string }> }) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const scope = currentOrganization(context, uuid((await route.params).organizationId));
    const org = scope.organizationId;
    const [teams, memberships, teamMemberships, assignments, grants, operations] = await Promise.all([
      databaseResult<FoundationSnapshot["teams"]>(client.from("teams").select("id,name,status,rowVersion:row_version,approvalPolicy:approval_policy").eq("organization_id", org).limit(100)),
      databaseResult<FoundationSnapshot["memberships"]>(client.from("organization_memberships").select("userId:user_id,role,state,rowVersion:row_version").eq("organization_id", org).limit(100)),
      databaseResult<FoundationSnapshot["teamMemberships"]>(client.from("team_memberships").select("teamId:team_id,userId:user_id,role,active,rowVersion:row_version").eq("organization_id", org).limit(100)),
      databaseResult<FoundationSnapshot["assignments"]>(client.from("candidate_assignments").select("id,candidateId:candidate_id,teamId:team_id,userId:user_id,activeFrom:active_from,endedAt:ended_at").eq("organization_id", org).limit(100)),
      databaseResult<FoundationSnapshot["grants"]>(client.from("bid_access_grants").select("id,bidId:bid_id,candidateId:candidate_id,userId:user_id,capability,allowEmail:allow_email,allowPhone:allow_phone,expiresAt:expires_at,revokedAt:revoked_at").eq("organization_id", org).limit(100)),
      scope.role === "admin" ? databaseResult(client.from("administrative_operations")
        .select("operationId:operation_id,targetUserId:target_user_id,state,lastErrorCode:last_error_code,email,displayName:display_name,desiredRole:desired_role").eq("organization_id", org).limit(100)) : Promise.resolve([]),
    ]);
    const userIds = [...new Set([...memberships.map(m => m.userId), ...teamMemberships.map(m => m.userId)])];
    const people = userIds.length ? await databaseResult<FoundationSnapshot["people"]>(client.from("users")
      .select("id,displayName:display_name").in("id", userIds)) : [];
    return { scope, teams, memberships, teamMemberships, assignments, grants, operations, people };
  });
}

