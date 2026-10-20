import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const q = new URL(request.url).searchParams;
    const scope = currentOrganization(context, uuid(q.get("organizationId")));
    const page = Number(q.get("page") ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid activity page.");
    // Redacted identifiers and actions only; never return historical field values.
    const result = await client.from("audit_logs").select("id,actorId:actor_id,action,subjectId:subject_id,teamId:team_id,requestId:request_id,createdAt:created_at", { count: "exact" })
      .eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).order("id").range((page - 1) * 25, page * 25 - 1);
    if (result.error) await databaseResult(Promise.resolve(result));
    return { items: result.data, total: result.count, page, pageSize: 25 };
  });
}
