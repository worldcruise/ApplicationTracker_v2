import { organizationRoles, type FoundationCommand } from "@candidate/contracts";
import { ApiFailure } from "./errors";
import { uuid } from "./guards";

type Rule = (value: unknown) => void;
const invalid = (): never => { throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid command fields."); };
const text = (max: number): Rule => v => { if (typeof v !== "string" || !v.trim() || v.length > max) invalid(); };
const id: Rule = v => { uuid(v); };
const nullable = (rule: Rule): Rule => v => { if (v !== null) rule(v); };
const bool: Rule = v => { if (typeof v !== "boolean") invalid(); };
const oneOf = (values: readonly string[]): Rule => v => { if (typeof v !== "string" || !values.includes(v)) invalid(); };
const role = oneOf(organizationRoles);
const date: Rule = v => { if (typeof v !== "string" || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) invalid(); };
const schemas: Record<FoundationCommand["command"], Record<string, Rule>> = {
  createTeam: { name: text(200) },
  setTeamMembership: { teamId: id, userId: id, role: oneOf(["team_leader", "team_member", "bidder"]), active: bool },
  setOrganizationMembership: { userId: id, role, state: oneOf(["active", "deactivated"]) },
  createCandidate: { teamId: id, ownerId: nullable(id), fullName: text(200) },
  changeAssignment: { candidateId: id, userId: id, assign: bool },
  approveBidderSummary: { candidateId: id, summary: text(4000) },
  createDraftBid: { candidateId: id, companyName: text(200), jobTitle: text(200) },
  grantBidderAccess: { userId: id, candidateId: nullable(id), bidId: nullable(id),
    capability: oneOf(["bid.prepare", "bid.submit", "document.read", "document.export"]), allowEmail: bool, allowPhone: bool, expiresAt: nullable(date) },
  revokeBidderAccess: { grantId: id },
  provisionUser: { operationId: id, email: v => { text(320)(v); if (typeof v !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) invalid(); }, displayName: text(200), role },
};

export function parseCommand(value: unknown): FoundationCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  const object = value as Record<string, unknown>;
  if (typeof object.command !== "string" || !Object.hasOwn(schemas, object.command)) invalid();
  const schema = schemas[object.command as FoundationCommand["command"]];
  if (Object.keys(object).length !== Object.keys(schema).length + 1 || Object.keys(object).some(k => k !== "command" && !Object.hasOwn(schema, k))) invalid();
  for (const [key, rule] of Object.entries(schema)) rule(object[key]);
  if (object.command === "grantBidderAccess" && (object.candidateId === null) === (object.bidId === null)) invalid();
  return value as FoundationCommand;
}

export async function readCommand(request: Request): Promise<FoundationCommand> {
  // A bounded stream protects against chunked requests without Content-Length.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) invalid();
  const reader = request.body?.getReader();
  if (!reader) throw new ApiFailure(400, "INVALID_JSON", "Supply a JSON command body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.byteLength;
    if (length > 32_768) { await reader.cancel(); throw new ApiFailure(413, "SCHEMA_INVALID", "Command body exceeds 32 KiB."); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ApiFailure(400, "INVALID_JSON", "Supply a valid JSON command."); }
  return parseCommand(value);
}

