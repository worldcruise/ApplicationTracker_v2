import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, requireManagedTeam, checkMutationOrigin, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";
import { listCandidates } from "@/lib/candidates/service";
import { profileInput, strictObject } from "@/lib/candidates/input";
import { readJson } from "@/lib/api/body";
import type { CandidateProfile } from "@candidate/contracts";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const query = new URL(request.url).searchParams;
    const scope = currentOrganization(context, uuid(query.get("organizationId")));
    return listCandidates(client, scope, query);
  });
}
export async function POST(request: Request) {
  return api(request, async requestId => {
    const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    const body = strictObject(await readJson(request), ["teamId", "ownerId", "profile"]);
    const teamId = uuid(body.teamId); requireManagedTeam(scope, teamId);
    const { profile } = profileInput(body.profile);
    return databaseResult<CandidateProfile>(client.rpc("create_candidate_profile", { p_org: scope.organizationId, p_team: teamId,
      p_owner: body.ownerId === null ? null : uuid(body.ownerId), p_profile: profile, p_request: requestId }));
  });
}

