import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, expectedVersion, checkMutationOrigin, requireRole, requireManagedTeam } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { strictObject } from "@/lib/candidates/input";
import { getProfile } from "@/lib/candidates/service";
import { validTemplateLayout } from "@candidate/contracts";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function POST(request: Request) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token); const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  requireRole(scope, ["admin", "team_leader", "team_member"]);
  const b = strictObject(await readJson(request), ["presetId", "baseVersionId", "name", "scope", "sharing", "teamId", "candidateId", "layout"]);
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100 || !["personal", "team", "organization", "candidate"].includes(String(b.scope)) || !["private", "team", "organization"].includes(String(b.sharing)) || !validTemplateLayout(b.layout)) throw new ApiFailure(422, "SCHEMA_INVALID", "Check template scope, name and safe layout bounds.");
  if (b.scope === "organization") requireRole(scope, ["admin"]);
  if (b.scope === "team") requireManagedTeam(scope, uuid(b.teamId));
  if (b.scope === "candidate") await getProfile(client, scope, uuid(b.candidateId));
  return { id: await databaseResult<string>(client.rpc("publish_template_version", { p_org: scope.organizationId, p_preset: b.presetId === null ? null : uuid(b.presetId), p_expected: expectedVersion(request), p_input: { ...b, baseVersionId: uuid(b.baseVersionId) }, p_request: requestId })) };
}); }
