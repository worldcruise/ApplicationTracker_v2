export const organizationRoles = ["admin", "team_leader", "team_member", "bidder"] as const;
export type OrganizationRole = typeof organizationRoles[number];
export type TeamRole = Exclude<OrganizationRole, "admin">;

export interface OrganizationScope {
  organizationId: string;
  name: string;
  role: OrganizationRole;
  teams: readonly { teamId: string; name: string; role: TeamRole }[];
}

export interface UserContext {
  userId: string;
  organizations: readonly OrganizationScope[];
}

/** Explicitly safe output: never extend with raw profile or feedback fields. */
export interface BidderCandidate {
  candidateId: string;
  fullName: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  approvedSummary: string | null;
  documentReferences: readonly { documentId: string; bidId: string }[];
}

export interface ProvisioningResult {
  operationId: string;
  state: "pending_auth" | "awaiting_activation" | "completed";
  targetUserId: string | null;
}

export interface FoundationSnapshot {
  scope: OrganizationScope;
  teams: { id: string; name: string; status: string; rowVersion: number }[];
  memberships: { userId: string; role: OrganizationRole; state: "invited" | "active" | "deactivated"; rowVersion: number }[];
  people: { id: string; displayName: string }[];
  teamMemberships: { teamId: string; userId: string; role: TeamRole; active: boolean; rowVersion: number }[];
  assignments: { id: string; candidateId: string; teamId: string; userId: string; activeFrom: string; endedAt: string | null }[];
  grants: { id: string; bidId: string | null; candidateId: string | null; userId: string; capability: string; expiresAt: string | null; revokedAt: string | null }[];
  operations: { operationId: string; targetUserId: string | null; state: ProvisioningResult["state"]; lastErrorCode: string | null; email: string; displayName: string; desiredRole: OrganizationRole }[];
}

export type FoundationCommand =
  | { command: "createTeam"; name: string }
  | { command: "setTeamMembership"; teamId: string; userId: string; role: TeamRole; active: boolean }
  | { command: "setOrganizationMembership"; userId: string; role: OrganizationRole; state: "active" | "deactivated" }
  | { command: "createCandidate"; teamId: string; ownerId: string | null; fullName: string }
  | { command: "changeAssignment"; candidateId: string; userId: string; assign: boolean }
  | { command: "approveBidderSummary"; candidateId: string; summary: string }
  | { command: "createDraftBid"; candidateId: string; companyName: string; jobTitle: string }
  | { command: "grantBidderAccess"; userId: string; candidateId: string | null; bidId: string | null;
      capability: "bid.prepare" | "document.read" | "document.export"; allowEmail: boolean; allowPhone: boolean; expiresAt: string | null }
  | { command: "revokeBidderAccess"; grantId: string }
  | { command: "provisionUser"; operationId: string; email: string; displayName: string; role: OrganizationRole };
