import { bidStatuses, dashboardMetrics, type DashboardFilters } from "@candidate/contracts";
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
    const filters: DashboardFilters = {};
    for (const key of ["teamId", "ownerId"] as const) if (q.has(key)) filters[key] = uuid(q.get(key));
    for (const key of ["from", "to"] as const) if (q.has(key)) {
      const value = q.get(key)!;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new ApiFailure(400, "SCHEMA_INVALID", "Use valid UTC cohort dates.");
      filters[key] = value;
    }
    if (q.has("status")) { if (!bidStatuses.includes(q.get("status") as typeof bidStatuses[number])) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid status."); filters.status = q.get("status")!; }
    if (q.has("company")) { const value = q.get("company")!.trim(); if (value.length > 200) throw new ApiFailure(400, "SCHEMA_INVALID", "Company filter is too long."); if (value) filters.company = value; }
    if (q.has("windowDays")) { const value = Number(q.get("windowDays")); if (!Number.isInteger(value) || value < 1 || value > 90) throw new ApiFailure(400, "SCHEMA_INVALID", "Interview window must be 1–90 days."); filters.windowDays = value; }
    const metric = q.get("metric") ?? "active_bids"; const page = Number(q.get("page") ?? 1);
    if (!dashboardMetrics.includes(metric as typeof dashboardMetrics[number]) || !Number.isInteger(page) || page < 1 || page > 100000) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid report or page.");
    return databaseResult(client.rpc("operational_dashboard", { p_org: scope.organizationId, p_filters: filters, p_metric: metric, p_page: page }));
  });
}
