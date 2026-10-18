import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, checkMutationOrigin, expectedVersion, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";
import { getProfile, candidateMutation } from "@/lib/candidates/service";
import { readJson } from "@/lib/api/body";
import { profileInput } from "@/lib/candidates/input";
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
    return getProfile(client, scope, candidateId);
  });
}
export async function PATCH(request: Request, route: { params: Promise<{ candidateId: string }> }) {
  return api(request, async requestId => {
    const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    const id = uuid((await route.params).candidateId); await getProfile(client, scope, id);
    const { profile } = profileInput(await readJson(request));
    return candidateMutation(client, scope, id, "save_candidate_profile", {
      p_expected: expectedVersion(request), p_profile: profile, p_request: requestId,
    });
  });
}

