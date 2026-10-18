import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, checkMutationOrigin, expectedVersion, requireManagedTeam, uuid } from "@/lib/api/guards";
import { ApiFailure } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { strictObject } from "@/lib/candidates/input";
import { getProfile, candidateMutation } from "@/lib/candidates/service";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(request: Request, route: { params: Promise<{ candidateId: string }> }) {
  return api(request, async requestId => {
    const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    const id = uuid((await route.params).candidateId);
    const profile = await getProfile(client, scope, id);
    requireManagedTeam(scope, profile.owningTeamId);
    const body = strictObject(await readJson(request), ["userId", "assign"]);
    if (typeof body.assign !== "boolean") throw new ApiFailure(400, "SCHEMA_INVALID", "Choose assign or end assignment.");
    return candidateMutation(client, scope, id, "set_candidate_assignment", { p_expected: expectedVersion(request), p_user: uuid(body.userId), p_assign: body.assign, p_request: requestId });
  });
}

