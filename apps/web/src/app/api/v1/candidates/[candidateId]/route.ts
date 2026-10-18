import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import type { BidderCandidate } from "@candidate/contracts";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ candidateId: string }> }) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const query = new URL(request.url).searchParams;
    const scope = currentOrganization(context, uuid(query.get("organizationId")));
    const candidateId = uuid((await route.params).candidateId);
    if (scope.role === "bidder") {
      return databaseResult<BidderCandidate>(client.rpc("get_bidder_candidate", {
        p_org: scope.organizationId, p_candidate: candidateId, p_bid: query.has("bidId") ? uuid(query.get("bidId")) : null,
      }));
    }
    const candidate = await databaseResult<Record<string, unknown> | null>(client.from("candidates")
      .select("id,organizationId:organization_id,owningTeamId:owning_team_id,ownerId:owner_id,fullName:full_name,email,phone,location,seniorityPreference:seniority_preference,status,privateNotes:private_notes,rowVersion:row_version")
      .eq("organization_id", scope.organizationId).eq("id", candidateId).maybeSingle());
    if (!candidate) throw new ApiFailure(403, "FORBIDDEN", "The candidate is unavailable in your current scope.");
    return candidate;
  });
}

