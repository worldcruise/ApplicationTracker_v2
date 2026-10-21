import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { checkMutationOrigin, currentOrganization, expectedVersion, requireRole, uuid } from "@/lib/api/guards";
import type { AccountRequest } from "@candidate/contracts";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
type Params = { params: Promise<{ organizationId: string }> };
export async function GET(request: Request, { params }: Params) {
  return api(request, async () => {
    const { client, context } = await requestContext(request);
    const org = uuid((await params).organizationId);
    requireRole(currentOrganization(context, org), ["admin"]);
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid page offset.");
    return databaseResult<AccountRequest[]>(client.rpc("list_account_requests", { p_org: org, p_offset: offset }));
  });
}
export async function POST(request: Request, { params }: Params) {
  return api(request, async requestId => {
    const { client, context, token } = await requestContext(request);
    checkMutationOrigin(request, token);
    const org = uuid((await params).organizationId);
    requireRole(currentOrganization(context, org), ["admin"]);
    if (Number(request.headers.get("content-length")) > 10000) throw new ApiFailure(413, "SCHEMA_INVALID", "Review request is too large.");
    let body;
    try { body = await request.json(); } catch { throw new ApiFailure(400, "SCHEMA_INVALID", "Send a JSON review request."); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["userId","decision","role","teamId","reason"].includes(k))) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid review fields.");
    if (!["approved","rejected"].includes(body.decision) || (body.reason != null && (typeof body.reason !== "string" || body.reason.length > 2000))) throw new ApiFailure(400, "SCHEMA_INVALID", "Choose Approve or Reject; keep the reason under 2,000 characters.");
    if (body.decision === "approved" && !["admin","team_leader","team_member","bidder"].includes(body.role)) throw new ApiFailure(400, "SCHEMA_INVALID", "Select an authorized role.");
    if (body.decision === "rejected" && (body.role != null || body.teamId != null)) throw new ApiFailure(400, "SCHEMA_INVALID", "A rejection cannot assign access.");
    const version = await databaseResult<number>(client.rpc("review_account_request", {
      p_org: org, p_user: uuid(body.userId, "applicant"), p_decision: body.decision, p_role: body.role ?? null,
      p_team: body.teamId == null ? null : uuid(body.teamId, "team"), p_reason: body.reason ?? null,
      p_expected: expectedVersion(request), p_request: requestId,
    }));
    return { rowVersion: version };
  });
}
