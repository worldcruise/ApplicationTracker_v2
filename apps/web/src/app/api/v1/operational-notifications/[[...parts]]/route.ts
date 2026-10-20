import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
    return databaseResult(client.from("operational_notifications").select("id,candidateId:candidate_id,bidId:bid_id,title,readAt:read_at,createdAt:created_at").eq("organization_id", scope.organizationId).eq("recipient_id", context.userId).order("created_at", { ascending: false }).order("id").limit(100));
  });
}
export async function POST(request: Request, route: { params: Promise<{ parts?: string[] }> }) {
  return api(request, async () => {
    const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
    const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId"))); const parts = (await route.params).parts;
    if (parts?.length !== 2 || parts[1] !== "read") throw new ApiFailure(404, "FORBIDDEN", "Unknown notification action.");
    await databaseResult(client.rpc("read_operational_notification", { p_org: scope.organizationId, p_id: uuid(parts[0]) })); return { id: parts[0] };
  });
}
