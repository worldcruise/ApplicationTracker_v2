import assert from "node:assert/strict";
import test from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationScope, UserContext } from "@candidate/contracts";
import { ApiFailure, databaseFailure } from "../src/lib/api/errors";
import { bearerToken, callbackDestination, checkMutationOrigin, currentOrganization, expectedVersion, requireManagedTeam } from "../src/lib/api/guards";
import { parseCommand, readCommand } from "../src/lib/api/command-input";
import { executeCommand } from "../src/lib/api/commands";
import { provisionUser } from "../src/lib/api/provisioning";
import { api, preflight } from "../src/lib/api/http";

const org = "00000000-0000-4000-8000-000000000100";
const team = "00000000-0000-4000-8000-000000000200";
const user = "00000000-0000-4000-8000-000000000001";
const operation = "00000000-0000-4000-8000-000000000800";
const scope: OrganizationScope = { organizationId: org, name: "Synthetic", role: "team_leader", teams: [{ teamId: team, name: "Synthetic Alpha", role: "team_leader" }] };
const failure = (status: number) => (error: unknown) => error instanceof ApiFailure && error.status === status;
const request = (headers?: HeadersInit) => new Request("http://localhost:3000/api/v1/me", { headers: headers ?? {} });

function client(handler: (name: string, body: Record<string, unknown>) => Response | Promise<Response>): SupabaseClient {
  return createClient("https://synthetic.supabase.co", "sb_publishable_synthetic", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer synthetic-user-token" }, fetch: async (input, init) => {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer synthetic-user-token");
      const url = new URL(String(input));
      return handler(url.pathname.split("/").at(-1)!, init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {});
    } },
  });
}
const ok = (data: unknown) => Response.json(data);
const missing = () => Response.json({ code: "P0002", message: "AUTH_IDENTITY_REQUIRED" }, { status: 404 });
const invite = { command: "provisionUser", operationId: operation, email: "synthetic@example.invalid", displayName: "Synthetic Person", role: "team_member" } as const;

test("current organization and leadership are resolved from server context", () => {
  const context: UserContext = { userId: user, organizations: [scope] };
  assert.equal(currentOrganization(context, org).role, "team_leader");
  assert.throws(() => currentOrganization(context, user), failure(403));
  assert.doesNotThrow(() => requireManagedTeam(scope, team));
  assert.throws(() => requireManagedTeam(scope, user), failure(403));
  assert.throws(() => requireManagedTeam({ ...scope, role: "team_member" }, team), failure(403));
});

test("cookie mutations require exact origin; malformed bearer never falls back to cookies", () => {
  assert.throws(() => checkMutationOrigin(request(), null), failure(403));
  assert.throws(() => checkMutationOrigin(request({ Origin: "https://attacker.invalid" }), null), failure(403));
  assert.doesNotThrow(() => checkMutationOrigin(request({ Origin: "http://localhost:3000" }), null));
  assert.throws(() => checkMutationOrigin(request({ Origin: "http://localhost:3000", "Sec-Fetch-Site": "cross-site" }), null), failure(403));
  assert.throws(() => bearerToken(request({ Authorization: "Bearer" })), failure(401));
  assert.throws(() => bearerToken(request({ Authorization: "Basic pretend" })), failure(401));
  assert.equal(bearerToken(request({ Authorization: "Bearer synthetic" })), "synthetic");
  assert.doesNotThrow(() => checkMutationOrigin(request(), "verified-by-auth-layer"));
});

test("quoted version and fixed callback destinations reject alternate inputs", () => {
  for (const header of ["", "1", 'W/"1"', '"-1"', '"01"', '"9007199254740992"']) {
    assert.throws(() => expectedVersion(request({ "If-Match": header })), failure(400));
  }
  assert.equal(expectedVersion(request({ "If-Match": '"0"' })), 0);
  assert.equal(expectedVersion(request({ "If-Match": '"17"' })), 17);
  assert.equal(callbackDestination("recovery"), "/account/update-password");
  assert.equal(callbackDestination("https://attacker.invalid"), "/workspace");
});

test("command contract rejects identity injection, unknown commands and ambiguous grant targets", () => {
  assert.equal(parseCommand({ command: "createTeam", name: "Synthetic" }).command, "createTeam");
  assert.throws(() => parseCommand({ command: "__proto__" }), failure(400));
  assert.throws(() => parseCommand({ command: "createTeam", name: "Synthetic", createdBy: user }), failure(400));
  assert.throws(() => parseCommand({ command: "setOrganizationMembership", userId: user, role: "superuser", state: "active" }), failure(400));
  assert.throws(() => parseCommand({ command: "grantBidderAccess", userId: user, candidateId: user, bidId: user,
    capability: "bid.prepare", allowEmail: false, allowPhone: false, expiresAt: null }), failure(400));
});

test("body parsing bounds chunked input and distinguishes invalid JSON", async () => {
  const post = (body: string) => new Request("http://localhost:3000", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  await assert.rejects(readCommand(post("[")), error => error instanceof ApiFailure && error.code === "INVALID_JSON");
  await assert.rejects(readCommand(post(" ".repeat(32_769))), failure(413));
  assert.equal((await readCommand(post(JSON.stringify({ command: "createTeam", name: "Synthetic" })))).command, "createTeam");
});

test("API role/team guards reject before any privileged command executes", async () => {
  let calls = 0;
  const connection = client(() => { calls++; return ok(null); });
  const base = { client: connection, scope, request: request(), requestId: operation,
    provision: async () => { throw new Error("Must not invoke Auth administration"); } };
  await assert.rejects(executeCommand({ command: "createTeam", name: "Escalation" }, base), failure(403));
  await assert.rejects(executeCommand({ command: "createCandidate", teamId: user, ownerId: null, fullName: "Synthetic" }, base), failure(403));
  await assert.rejects(executeCommand(invite, base), failure(403));
  assert.equal(calls, 0);
});

test("bidder candidate preparation uses projection RPC and user token; raw profile is never fetched", async () => {
  const calls: string[] = [];
  const connection = client(name => { calls.push(name); return name === "get_bidder_candidate" ? ok({ candidateId: user }) : ok(operation); });
  const result = await executeCommand({ command: "createDraftBid", candidateId: user, companyName: "Synthetic Co", jobTitle: "Engineer" }, {
    client: connection, scope: { ...scope, role: "bidder", teams: [] }, request: request(), requestId: operation,
    provision: async () => { throw new Error("Unexpected"); },
  });
  assert.deepEqual(calls, ["get_bidder_candidate", "create_draft_bid"]);
  assert.deepEqual(result, { id: operation });
});

test("provisioning reconciles lost invitation response without granting active membership", async () => {
  let created = false;
  const calls: string[] = [];
  const connection = client(name => {
    calls.push(name);
    if (name === "complete_user_provisioning") return created ? ok({ operationId: operation, state: "awaiting_activation", targetUserId: user }) : missing();
    return ok({ state: "pending_auth" });
  });
  const result = await provisionUser(invite, { client: connection, organizationId: org, invite: async () => {
    created = true; throw new Error("Synthetic lost response");
  } });
  assert.equal(result.state, "awaiting_activation");
  assert.deepEqual(calls, ["begin_user_provisioning", "complete_user_provisioning", "record_provisioning_failure", "complete_user_provisioning"]);
});

test("missing administration configuration preserves a pending operation and original retry key", async () => {
  const errors: unknown[] = [];
  const connection = client((name, body) => {
    if (name === "complete_user_provisioning") return missing();
    if (name === "record_provisioning_failure") errors.push(body);
    return ok({});
  });
  await assert.rejects(provisionUser(invite, { client: connection, organizationId: org,
    invite: async () => { throw new ApiFailure(503, "SERVICE_UNAVAILABLE", "Missing private key"); } }), error =>
    error instanceof ApiFailure && error.retryable && error.status === 503);
  assert.deepEqual(errors, [{ p_org: org, p_operation: operation, p_code: "CONFIGURATION_REQUIRED" }]);
});

test("changed provisioning payload fails before any Auth action", async () => {
  const connection = client(() => Response.json({ code: "22023", message: "KEY_PAYLOAD_MISMATCH" }, { status: 400 }));
  await assert.rejects(provisionUser(invite, { client: connection, organizationId: org, invite: async () => assert.fail("No invitation") }),
    error => error instanceof ApiFailure && error.code === "KEY_PAYLOAD_MISMATCH");
});

test("protected API responses and errors are uncached, origin-specific and redacted", async () => {
  const response = await api(request({ Origin: "http://localhost:3000" }), async () => ({ rowVersion: 4 }));
  assert.match(response.headers.get("cache-control")!, /private.*no-store/);
  assert.equal(response.headers.get("etag"), '"4"');
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(preflight(request({ Origin: "https://attacker.invalid" })).status, 403);
  const error = await api(request(), async () => { throw new Error("private database detail"); });
  assert.equal(error.status, 503);
  assert.doesNotMatch(await error.text(), /private database detail/);
  assert.equal(databaseFailure({ code: "42P01" }).status, 503);
  assert.equal(databaseFailure({ code: "42501" }).status, 403);
  assert.equal(databaseFailure({ code: "40001" }).status, 409);
});

