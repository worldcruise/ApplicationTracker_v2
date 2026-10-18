import type { OrganizationRole, OrganizationScope, UserContext } from "@candidate/contracts";
import { ApiFailure } from "./errors";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(value: unknown, name = "identifier"): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new ApiFailure(400, "SCHEMA_INVALID", `Invalid ${name}.`);
  return value;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match?.[1]) throw new ApiFailure(401, "UNAUTHENTICATED", "A valid bearer token is required.");
  return match[1];
}

export function applicationOrigin(): string {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("invalid origin");
    return url.origin;
  } catch { throw new ApiFailure(503, "SERVICE_UNAVAILABLE", "Configure NEXT_PUBLIC_APP_URL."); }
}

export function checkMutationOrigin(request: Request, token: string | null): void {
  if (token) return; // Only the bearer client will be used; no cookie fallback.
  if (request.headers.get("origin") !== applicationOrigin()) throw new ApiFailure(403, "FORBIDDEN", "A same-origin request is required.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiFailure(403, "FORBIDDEN", "A same-origin request is required.");
}

export function currentOrganization(context: UserContext, organizationId: string): OrganizationScope {
  const scope = context.organizations.find(o => o.organizationId === organizationId);
  if (!scope) throw new ApiFailure(403, "FORBIDDEN", "An active organization membership is required.");
  return scope;
}

export function requireRole(scope: OrganizationScope, roles: readonly OrganizationRole[]): void {
  if (!roles.includes(scope.role)) throw new ApiFailure(403, "FORBIDDEN", "This action is not permitted for your current role.");
}

export function requireManagedTeam(scope: OrganizationScope, teamId: string): void {
  if (scope.role === "admin") return;
  if (scope.role !== "team_leader" || !scope.teams.some(t => t.teamId === teamId && t.role === "team_leader")) {
    throw new ApiFailure(403, "FORBIDDEN", "An active leadership membership in this team is required.");
  }
}

export function expectedVersion(request: Request): number {
  const match = /^"(0|[1-9][0-9]*)"$/.exec(request.headers.get("if-match") ?? "");
  const value = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(value)) throw new ApiFailure(400, "SCHEMA_INVALID", 'Supply If-Match with the quoted current row version, for example "1". Use "0" only for a new membership or summary.');
  return value;
}

/** Fixed destinations only; never follow a callback-supplied external URL. */
export function callbackDestination(mode: string | null): string {
  return mode === "recovery" || mode === "invite" ? "/account/update-password" : "/workspace";
}

