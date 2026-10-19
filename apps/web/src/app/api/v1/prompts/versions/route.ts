import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, expectedVersion, checkMutationOrigin, requireManagedTeam, requireRole } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
import { getProfile } from "@/lib/candidates/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function POST(request: Request) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
  const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const b = strictObject(await readJson(request), ["presetId", "kind", "scope", "teamId", "candidateId", "name", "description", "content", "enabled", "order"]);
  if (!["main", "custom"].includes(String(b.kind)) || !["global", "team", "candidate"].includes(String(b.scope)) || typeof b.name !== "string" || !b.name.trim() || b.name.length > 200 || typeof b.description !== "string" || b.description.length > 2000 || typeof b.content !== "string" || !b.content.trim() || b.content.length > 20000 || typeof b.enabled !== "boolean" || !Number.isInteger(b.order) || Number(b.order) < 0 || Number(b.order) > 10000) throw new ApiFailure(422, "SCHEMA_INVALID", "Check the prompt name, content, scope and order.");
  requireRole(scope, ["admin", "team_leader", "team_member"]);
  if (b.kind === "main" || b.scope === "global") requireRole(scope, ["admin"]);
  if (b.scope === "team") requireManagedTeam(scope, uuid(b.teamId));
  if (b.scope === "candidate") await getProfile(client, scope, uuid(b.candidateId));
  const id = await databaseResult<string>(client.rpc("publish_prompt_version", { p_org: scope.organizationId, p_preset: b.presetId === null ? null : uuid(b.presetId), p_expected: expectedVersion(request), p_input: b, p_request: requestId }));
  return { id };
}); }
