import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";
import { getProfile, assignmentOptions } from "@/lib/candidates/service";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ candidateId: string }> }) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    const id = uuid((await route.params).candidateId); const profile = await getProfile(client, scope, id);
    const bids = await databaseResult<{ id: string; companyName: string; jobTitle: string; status: string }[]>(client.from("bids")
      .select("id,companyName:company_name,jobTitle:job_title,status").eq("organization_id", scope.organizationId).eq("candidate_id", id).order("created_at", { ascending: false }).limit(100));
    const interviews = bids.length ? await databaseResult<{ id: string; bidId: string; roundNumber: number; scheduledAt: string | null; lifecycleStatus: string }[]>(client.from("interviews")
      .select("id,bidId:bid_id,roundNumber:round_number,scheduledAt:scheduled_at,lifecycleStatus:lifecycle_status").eq("organization_id", scope.organizationId).in("bid_id", bids.map(b => b.id)).limit(100)) : [];
    const [events, revisions, assignees] = await Promise.all([
      databaseResult(client.from("audit_logs").select("id,action,createdAt:created_at,actorId:actor_id").eq("organization_id", scope.organizationId)
        .in("subject_id", [id, ...bids.map(b => b.id)]).order("created_at", { ascending: false }).limit(50)),
      databaseResult(client.from("candidate_profile_revisions").select("revisionNumber:revision_number,createdAt:created_at,changedBy:changed_by")
        .eq("organization_id", scope.organizationId).eq("candidate_id", id).order("revision_number", { ascending: false }).limit(50)),
      assignmentOptions(client, scope, profile.owningTeamId),
    ]);
    return { bids, interviews, events, revisions, assignees, resumesAvailable: false };
  });
}
