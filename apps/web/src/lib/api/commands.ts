import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoundationCommand, OrganizationScope, ProvisioningResult } from "@candidate/contracts";
import { ApiFailure, databaseResult } from "./errors";
import { expectedVersion, requireManagedTeam, requireRole } from "./guards";

export interface CommandContext {
  client: SupabaseClient;
  scope: OrganizationScope;
  request: Request;
  requestId: string;
  provision: (command: Extract<FoundationCommand, { command: "provisionUser" }>) => Promise<ProvisioningResult>;
}

async function requireRow(client: SupabaseClient, table: string, organizationId: string, id: string, key = "id") {
  const row = await databaseResult<Record<string, unknown> | null>(
    client.from(table).select("*").eq("organization_id", organizationId).eq(key, id).maybeSingle());
  if (!row) throw new ApiFailure(403, "FORBIDDEN", "The resource is unavailable in your current scope.");
  return row;
}

export async function executeCommand(command: FoundationCommand, context: CommandContext): Promise<unknown> {
  const { client, scope, request, requestId } = context;
  const p_org = scope.organizationId;
  const base = { p_org, p_request: requestId };
  const admin = () => requireRole(scope, ["admin"]);
  const rpc = (name: string, parameters: Record<string, unknown>) => databaseResult<unknown>(client.rpc(name, parameters));
  switch (command.command) {
    case "createTeam":
      admin();
      return { id: await rpc("create_team", { ...base, p_name: command.name }) };
    case "setTeamMembership":
      admin();
      await requireRow(client, "teams", p_org, command.teamId);
      await requireRow(client, "organization_memberships", p_org, command.userId, "user_id");
      return { rowVersion: await rpc("set_team_membership", { ...base, p_team: command.teamId,
        p_user: command.userId, p_role: command.role, p_active: command.active, p_expected: expectedVersion(request) }) };
    case "setOrganizationMembership":
      admin();
      await requireRow(client, "organization_memberships", p_org, command.userId, "user_id");
      return { rowVersion: await rpc("set_organization_membership", { ...base, p_user: command.userId,
        p_role: command.role, p_state: command.state, p_expected: expectedVersion(request) }) };
    case "createCandidate":
      requireManagedTeam(scope, command.teamId);
      await requireRow(client, "teams", p_org, command.teamId);
      return { id: await rpc("create_candidate", { ...base, p_team: command.teamId,
        p_owner: command.ownerId, p_full_name: command.fullName }) };
    case "changeAssignment":
    case "approveBidderSummary": {
      requireRole(scope, ["admin", "team_leader"]);
      const candidate = await requireRow(client, "candidates", p_org, command.candidateId);
      requireManagedTeam(scope, String(candidate.owning_team_id));
      if (command.command === "changeAssignment") {
        return { assignmentId: await rpc("change_candidate_assignment", { ...base, p_candidate: command.candidateId,
          p_user: command.userId, p_assign: command.assign }) };
      }
      return { rowVersion: await rpc("approve_bidder_summary", { ...base, p_candidate: command.candidateId,
        p_summary: command.summary, p_expected: expectedVersion(request) }) };
    }
    case "createDraftBid":
      if (scope.role === "bidder") {
        await rpc("get_bidder_candidate", { p_org, p_candidate: command.candidateId, p_bid: null });
      } else {
        await requireRow(client, "candidates", p_org, command.candidateId);
      }
      return { id: await rpc("create_draft_bid", { ...base, p_candidate: command.candidateId,
        p_company: command.companyName, p_title: command.jobTitle }) };
    case "grantBidderAccess":
      admin();
      await requireRow(client, command.bidId ? "bids" : "candidates", p_org, command.bidId ?? command.candidateId!);
      return { id: await rpc("grant_bidder_access", { ...base, p_user: command.userId,
        p_candidate: command.candidateId, p_bid: command.bidId, p_capability: command.capability,
        p_allow_email: command.allowEmail, p_allow_phone: command.allowPhone, p_expires: command.expiresAt }) };
    case "revokeBidderAccess":
      admin();
      await requireRow(client, "bid_access_grants", p_org, command.grantId);
      await rpc("revoke_bidder_access", { ...base, p_grant: command.grantId });
      return { revoked: true };
    case "provisionUser":
      admin();
      return context.provision(command);
  }
}

