import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin, requireRole } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { databaseResult } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function POST(request: Request, route: { params: Promise<{ documentId: string }> }) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token); const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId"))); requireRole(scope, ["admin", "team_leader"]);
  const b = strictObject(await readJson(request), ["bidId"]);
  await databaseResult(client.rpc("link_document_to_bid", { p_org: scope.organizationId, p_document: uuid((await route.params).documentId), p_bid: uuid(b.bidId), p_request: requestId })); return { linked: true };
}); }
