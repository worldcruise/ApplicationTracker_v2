// Isolated CI only. No linked or hosted project is accepted; credentials never print.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const web = fileURLToPath(new URL("../", import.meta.url));
let step = "isolated environment guard";
let assertions = 0;
let server;
class TestFailure extends Error {}
function expect(value, label) {
  if (!value) throw new TestFailure(label);
  assertions++;
}
function run(command, args, env, inherit = true) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8", stdio: inherit ? "inherit" : "pipe" });
  if (result.status !== 0) throw new TestFailure(`Command failed during ${step}`);
  return result.stdout;
}
try {
  if (process.env.CI !== "true" || existsSync(new URL("../.env.local", import.meta.url))) {
    throw new TestFailure("This harness requires an isolated CI checkout without apps/web/.env.local");
  }
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const settings = JSON.parse(run(npx, ["--no-install", "supabase", "status", "--output", "json"], process.env, false));
  const url = settings.API_URL;
  const publicKey = settings.ANON_KEY;
  const serviceKey = settings.SERVICE_ROLE_KEY;
  expect(url === "http://127.0.0.1:54321" && typeof publicKey === "string" && typeof serviceKey === "string", "Only the isolated local Supabase stack is accepted");
  const baseEnv = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXT_TELEMETRY_DISABLED: "1" };
  delete baseEnv.SUPABASE_SERVICE_ROLE_KEY;
  step = "production build";
  run(npm, ["run", "build"], baseEnv);
  const runtimeEnv = { ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: serviceKey, NODE_ENV: "production" };
  step = "production server startup";
  server = spawn(process.execPath, [fileURLToPath(new URL("../../../node_modules/next/dist/bin/next", import.meta.url)), "start", "--port", "3000"],
    { cwd: web, env: runtimeEnv, stdio: "ignore" });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch("http://localhost:3000/sign-in")).ok) { ready = true; break; } } catch { /* starting */ }
    if (server.exitCode !== null) break;
    await pause(1000);
  }
  expect(ready, "Production server became ready");
  const anonymous = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const operator = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const password = `Synthetic-${randomUUID()}!a9`;
  const suffix = randomUUID().slice(0, 8);
  const identities = {};
  step = "synthetic Auth identities";
  for (const name of ["adminA", "leaderA", "memberA", "bidderA", "leaderBeta", "memberBeta", "adminB", "leaderB", "memberB", "bidderB"]) {
    const email = `synthetic-${name.toLowerCase()}-${suffix}@example.invalid`;
    const created = await operator.auth.admin.createUser({ email, password, email_confirm: true });
    expect(!created.error && created.data.user, `Created synthetic identity ${name}`);
    const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const session = await auth.auth.signInWithPassword({ email, password });
    expect(!session.error && session.data.session, `Signed in synthetic identity ${name}`);
    const token = session.data.session.access_token;
    identities[name] = { id: created.data.user.id, email, token,
      client: createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } } }) };
  }
  const orgA = randomUUID(); const orgB = randomUUID();
  step = "operator bootstrap CLI";
  run(npm, ["run", "admin:bootstrap", "--", "--organization-id", orgA, "--admin-user-id", identities.adminA.id, "--name", "Synthetic North"], runtimeEnv);
  const boot = await operator.rpc("bootstrap_organization", { p_org: orgB, p_admin: identities.adminB.id, p_name: "Synthetic South", p_request: randomUUID() });
  expect(!boot.error, "Second isolated organization bootstrap");

  async function call(identity, path, body, version, extra = {}) {
    const response = await fetch(`http://localhost:3000/api/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: { ...(identity ? { Authorization: `Bearer ${identity.token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...(version === undefined ? {} : { "If-Match": JSON.stringify(String(version)) }), ...extra },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: "manual",
    });
    expect(/no-store/.test(response.headers.get("cache-control") ?? ""), "API responses are no-store");
    const envelope = await response.json();
    expect(typeof envelope.requestId === "string", "API response has request ID");
    return { status: response.status, data: envelope.data, code: envelope.error?.code };
  }
  async function command(identity, organizationId, body, version, status = 200) {
    const result = await call(identity, `/organizations/${organizationId}/commands`, body, version);
    expect(result.status === status, `Command ${body.command} expected HTTP ${status}, received ${result.status} (${result.code ?? "OK"})`);
    return result.data;
  }
  async function attach(admin, organizationId, person, role) {
    const operationId = randomUUID();
    const result = await command(admin, organizationId, { command: "provisionUser", operationId,
      email: person.email, displayName: "Synthetic Person", role });
    expect(result.state === "awaiting_activation", "Provisioned identity remains inactive");
    const before = await call(person, "/me");
    expect(before.status === 200 && before.data.organizations.length === 0, "Invited account has no active membership");
    const activated = await command(admin, organizationId, { command: "setOrganizationMembership", userId: person.id, role, state: "active" }, 1);
    person.version = activated.rowVersion;
    return operationId;
  }

  step = "organization and team setup through the application API";
  const teamA = (await command(identities.adminA, orgA, { command: "createTeam", name: "Synthetic Alpha" })).id;
  const teamBeta = (await command(identities.adminA, orgA, { command: "createTeam", name: "Synthetic Beta" })).id;
  const teamB = (await command(identities.adminB, orgB, { command: "createTeam", name: "Synthetic Gamma" })).id;
  for (const [personName, role, teamId, organizationId, admin] of [
    ["leaderA", "team_leader", teamA, orgA, identities.adminA], ["memberA", "team_member", teamA, orgA, identities.adminA],
    ["bidderA", "bidder", teamA, orgA, identities.adminA], ["leaderBeta", "team_leader", teamBeta, orgA, identities.adminA],
    ["memberBeta", "team_member", teamBeta, orgA, identities.adminA], ["leaderB", "team_leader", teamB, orgB, identities.adminB],
    ["memberB", "team_member", teamB, orgB, identities.adminB], ["bidderB", "bidder", teamB, orgB, identities.adminB],
  ]) {
    const person = identities[personName];
    await attach(admin, organizationId, person, role);
    await command(admin, organizationId, { command: "setTeamMembership", userId: person.id, teamId, role, active: true }, 0);
  }
  const first = (await command(identities.leaderA, orgA, { command: "createCandidate", teamId: teamA,
    ownerId: identities.memberA.id, fullName: "Synthetic Avery" })).id;
  const unassigned = (await command(identities.adminA, orgA, { command: "createCandidate", teamId: teamA,
    ownerId: identities.memberA.id, fullName: "Synthetic Blair" })).id;
  const unrelated = (await command(identities.adminA, orgA, { command: "createCandidate", teamId: teamBeta,
    ownerId: identities.memberBeta.id, fullName: "Synthetic Casey" })).id;
  const otherOrg = (await command(identities.adminB, orgB, { command: "createCandidate", teamId: teamB,
    ownerId: identities.memberB.id, fullName: "Synthetic Devin" })).id;
  await command(identities.leaderA, orgA, { command: "changeAssignment", candidateId: first, userId: identities.memberA.id, assign: true });
  await command(identities.leaderA, orgA, { command: "approveBidderSummary", candidateId: first, summary: "Approved synthetic summary" }, 0);
  const bid = (await command(identities.adminA, orgA, { command: "createDraftBid", candidateId: first, companyName: "Synthetic Co", jobTitle: "Engineer" })).id;
  const unrelatedBid = (await command(identities.adminA, orgA, { command: "createDraftBid", candidateId: first, companyName: "Other Synthetic Co", jobTitle: "Engineer" })).id;
  const grant = (await command(identities.adminA, orgA, { command: "grantBidderAccess", userId: identities.bidderA.id,
    candidateId: null, bidId: bid, capability: "bid.prepare", allowEmail: false, allowPhone: false, expiresAt: null })).id;

  step = "HTTP allowed and denied authorization";
  const candidatePath = (candidateId, organizationId = orgA, bidId) =>
    `/candidates/${candidateId}?organizationId=${organizationId}${bidId ? `&bidId=${bidId}` : ""}`;
  expect((await call(null, "/me")).status === 401, "Missing authentication is 401");
  expect((await call(identities.memberA, candidatePath(first))).status === 200, "Assigned member API read allowed");
  expect((await call(identities.memberA, candidatePath(unassigned))).status === 403, "Ownership without assignment denied");
  expect((await call(identities.leaderA, candidatePath(unrelated))).status === 403, "Unrelated team denied");
  expect((await call(identities.adminA, candidatePath(otherOrg, orgB))).status === 403, "Cross-organization admin denied");
  expect((await call(identities.bidderA, `/candidates?organizationId=${orgA}`)).status === 403, "Bidder profile directory denied");
  const projection = await call(identities.bidderA, candidatePath(first, orgA, bid));
  expect(projection.status === 200 && projection.data.approvedSummary === "Approved synthetic summary", "Authorized safe bidder projection allowed");
  expect(!("privateNotes" in projection.data) && !("interviewFeedback" in projection.data) && !("ownerId" in projection.data), "Projection excludes restricted fields");
  expect(projection.data.email === null && projection.data.phone === null, "Contact fields denied by default");
  expect((await call(identities.bidderA, candidatePath(first))).status === 403, "Bid-only grant cannot read candidate-wide");
  expect((await call(identities.bidderA, candidatePath(first, orgA, unrelatedBid))).status === 403, "Unrelated bid denied");
  await command(identities.memberA, orgA, { command: "createTeam", name: "Escalation" }, undefined, 403);
  await command(identities.leaderA, orgA, { command: "setOrganizationMembership", userId: identities.memberA.id, role: "admin", state: "active" }, 2, 403);
  await command(identities.adminA, orgA, { command: "setOrganizationMembership", userId: identities.adminA.id, role: "admin", state: "deactivated" }, 1, 409);
  await command(identities.adminA, orgA, { command: "setOrganizationMembership", userId: identities.memberA.id, role: "team_member", state: "active" }, 999, 409);

  step = "direct Data API bypass denial";
  const raw = await identities.bidderA.client.from("candidates").select("*");
  expect(!raw.error && raw.data.length === 0, "Bidder direct raw profiles denied by RLS");
  const feedback = await identities.bidderA.client.from("interview_feedback").select("*");
  expect(!feedback.error && feedback.data.length === 0, "Bidder direct feedback denied by RLS");
  const escalation = await identities.memberA.client.from("organization_memberships").update({ role: "admin" }).eq("user_id", identities.memberA.id);
  expect(escalation.error?.code === "42501", "Direct membership mutation denied by grants");
  const foreign = await identities.adminA.client.from("candidates").select("id").eq("organization_id", orgB);
  expect(!foreign.error && foreign.data.length === 0, "User context cannot bypass cross-tenant RLS");

  step = "current membership and grant revocation with existing tokens";
  await command(identities.adminA, orgA, { command: "setOrganizationMembership", userId: identities.memberA.id, role: "team_member", state: "deactivated" }, identities.memberA.version);
  expect((await call(identities.memberA, candidatePath(first))).status === 403, "Unexpired token loses application access after deactivation");
  const after = await identities.memberA.client.from("candidates").select("id");
  expect(!after.error && after.data.length === 0, "Unexpired token loses direct database access after deactivation");
  await command(identities.adminA, orgA, { command: "revokeBidderAccess", grantId: grant });
  expect((await call(identities.bidderA, candidatePath(first, orgA, bid))).status === 403, "Unexpired bidder token loses revoked projection");

  step = "cookie session and CSRF";
  const jar = new Map();
  const cookieClient = () => createServerClient(url, publicKey, { cookieOptions: { path: "/", sameSite: "lax", secure: true },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => values.forEach(c => c.value ? jar.set(c.name, c.value) : jar.delete(c.name)) } });
  const login = await cookieClient().auth.signInWithPassword({ email: identities.adminA.email, password });
  expect(!login.error, "Real SSR cookie sign-in succeeds");
  const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  const cookieMe = await call(null, "/me", undefined, undefined, { Cookie: cookieHeader() });
  expect(cookieMe.status === 200 && cookieMe.data.userId === identities.adminA.id, "Cookie request retains identity and RLS context");
  const csrf = await call(null, `/organizations/${orgA}/commands`, { command: "createTeam", name: "CSRF denied" }, undefined,
    { Cookie: cookieHeader(), Origin: "https://attacker.invalid" });
  expect(csrf.status === 403, "Cookie mutation rejects cross-origin CSRF");
  const goodOrigin = await call(null, `/organizations/${orgA}/commands`, { command: "createTeam", name: "Synthetic Cookie Team" }, undefined,
    { Cookie: cookieHeader(), Origin: "http://localhost:3000" });
  expect(goodOrigin.status === 200, "Cookie mutation accepts exact origin with current admin");
  const refresh = await cookieClient().auth.refreshSession();
  expect(!refresh.error, "Real Auth refresh succeeds");
  expect((await call(null, "/me", undefined, undefined, { Cookie: cookieHeader() })).status === 200, "Refreshed cookie retains application access");

  step = "real Auth invitation, pending activation and operation replay";
  const newEmail = `synthetic-invited-${suffix}@example.invalid`;
  const invitation = { command: "provisionUser", operationId: randomUUID(), email: newEmail, displayName: "Synthetic Invited", role: "team_member" };
  const pending = await command(identities.adminA, orgA, invitation);
  expect(pending.state === "awaiting_activation", "New Auth invitation attaches inactive membership");
  const existing = await command(identities.adminA, orgA, invitation);
  expect(existing.targetUserId === pending.targetUserId, "Provision retry returns same identity");
  await command(identities.adminA, orgA, { ...invitation, displayName: "Changed payload" }, undefined, 409);
  await command(identities.adminA, orgA, { command: "setOrganizationMembership", userId: pending.targetUserId, role: "team_member", state: "active" }, 1, 409);

  step = "server-side recovery callback and password change";
  const recovery = await operator.auth.admin.generateLink({ type: "recovery", email: identities.adminA.email });
  expect(!recovery.error && recovery.data.properties?.hashed_token, "Synthetic recovery link generated");
  const recovered = await fetch(`http://localhost:3000/auth/confirm?type=recovery&token_hash=${encodeURIComponent(recovery.data.properties.hashed_token)}`, { redirect: "manual" });
  expect(recovered.status === 307 && recovered.headers.get("location") === "http://localhost:3000/account/update-password", "Recovery callback has fixed destination");
  expect(/no-store/.test(recovered.headers.get("cache-control") ?? ""), "Recovery redirect cannot be cached");
  jar.clear();
  for (const cookie of recovered.headers.getSetCookie()) {
    const pair = cookie.split(";")[0]; const separator = pair.indexOf("=");
    const name = pair.slice(0, separator); const value = decodeURIComponent(pair.slice(separator + 1));
    if (value) jar.set(name, value);
  }
  expect(jar.size > 0, "Recovery redirect preserves session cookie chunks");
  const restored = await cookieClient().auth.getUser();
  expect(!restored.error && restored.data.user.id === identities.adminA.id, "Recovery cookie verifies correct identity");
  const replacement = `Synthetic-recovered-${randomUUID()}!z9`;
  expect(!(await cookieClient().auth.updateUser({ password: replacement })).error, "Recovered identity can change its password");
  expect(!(await anonymous.auth.signInWithPassword({ email: identities.adminA.email, password: replacement })).error, "New password signs in");
  expect(!(await cookieClient().auth.signOut()).error, "Real Auth sign-out succeeds");
  expect((await call(null, "/me", undefined, undefined, { Cookie: cookieHeader() })).status === 401, "Signed-out cookie has no authenticated context");

  step = "client artifact secret exclusion";
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) inspect(path);
      else if (/\.(js|json|html)$/.test(entry.name)) expect(!readFileSync(path).includes(Buffer.from(serviceKey)), "Privileged key absent from client artifact");
    }
  }
  inspect(`${web}/.next/static`);
  inspect(`${root}/apps/extension/dist`);
  console.log(JSON.stringify({ result: "PASS", assertions, scope: "isolated Supabase Auth + production Next HTTP; synthetic data only", browserAcceptance: "not executed" }));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", step, message: error instanceof TestFailure ? error.message : "Integration harness failed; inspect the isolated service health and current step." }));
  process.exitCode = 1;
} finally {
  server?.kill("SIGTERM");
}

