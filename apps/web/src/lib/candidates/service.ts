import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidateDirectory, CandidateProfile, OrganizationScope } from "@candidate/contracts";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { requireRole } from "@/lib/api/guards";
import { directoryInput } from "./input";

export async function getProfile(client: SupabaseClient, scope: OrganizationScope, id: string) {
  requireRole(scope, ["admin", "team_leader", "team_member"]);
  const result = await databaseResult<CandidateProfile | null>(client.rpc("get_candidate_profile", { p_org: scope.organizationId, p_candidate: id }));
  if (!result) throw new ApiFailure(403, "FORBIDDEN", "The candidate is unavailable in your current scope.");
  return result;
}
export function listCandidates(client: SupabaseClient, scope: OrganizationScope, query: URLSearchParams) {
  requireRole(scope, ["admin", "team_leader", "team_member"]);
  return databaseResult<CandidateDirectory>(client.rpc("list_candidates", { p_org: scope.organizationId, ...directoryInput(query) }));
}
export async function candidateMutation(client: SupabaseClient, scope: OrganizationScope, id: string, name: string, parameters: Record<string, unknown>) {
  try { return await databaseResult<CandidateProfile>(client.rpc(name, { p_org: scope.organizationId, p_candidate: id, ...parameters })); }
  catch (error) {
    if (error instanceof ApiFailure && error.code === "VERSION_CONFLICT") error.currentVersion = (await getProfile(client, scope, id)).rowVersion;
    throw error;
  }
}
export async function assignmentOptions(client: SupabaseClient, scope: OrganizationScope, teamId: string) {
  if (scope.role !== "admin" && !scope.teams.some(t => t.teamId === teamId && t.role === "team_leader")) return [];
  const members = await databaseResult<{ user_id: string }[]>(client.from("team_memberships").select("user_id")
    .eq("organization_id", scope.organizationId).eq("team_id", teamId).eq("role", "team_member").eq("active", true));
  if (!members.length) return [];
  const ids = members.map(m => m.user_id);
  const active = await databaseResult<{ user_id: string }[]>(client.from("organization_memberships").select("user_id")
    .eq("organization_id", scope.organizationId).eq("role", "team_member").eq("state", "active").in("user_id", ids));
  if (!active.length) return [];
  return databaseResult<{ id: string; displayName: string }[]>(client.from("users").select("id,displayName:display_name").eq("status", "active").in("id", active.map(m => m.user_id)));
}
