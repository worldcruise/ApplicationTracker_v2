import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, checkMutationOrigin, expectedVersion, uuid } from "@/lib/api/guards";
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
    await getProfile(client, scope, id);
    const body = strictObject(await readJson(request), ["archived"]);
    if (typeof body.archived !== "boolean") throw new ApiFailure(400, "SCHEMA_INVALID", "Choose archive or restore.");
    return candidateMutation(client, scope, id, "set_candidate_archived", { p_expected: expectedVersion(request), p_archived: body.archived, p_request: requestId });
  });
}

