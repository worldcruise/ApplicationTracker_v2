import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ documentId: string }> }) { return api(request, async () => {
  const { client, context } = await requestContext(request); const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  return databaseResult(client.rpc("export_frozen_document", { p_org: scope.organizationId, p_document: uuid((await route.params).documentId) }));
}); }
