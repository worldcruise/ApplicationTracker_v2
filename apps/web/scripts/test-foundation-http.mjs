// Isolated CI only. No linked or hosted project is accepted; credentials never print.
import { spawn, spawnSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { testCandidateBrowser } from "./test-candidate-browser.mjs";
import { testResumeHTTP } from "./test-resume-http.mjs";
import { testResumeBrowser } from "./test-resume-browser.mjs";
import { testTemplateHTTP } from "./test-template-http.mjs";
import { testDocumentHTTP } from "./test-document-http.mjs";
import { testDocumentBrowser } from "./test-document-browser.mjs";
import { testWorkflowHTTP } from "./test-workflow-http.mjs";
import { testWorkflowBrowser } from "./test-workflow-browser.mjs";
import { launchExtension,testExtensionBrowser } from "./test-extension-browser.mjs";
import { testHistoryHTTP } from "./test-history-http.mjs";
import { testHistoryBrowser } from "./test-history-browser.mjs";
import { testArchiveHTTP } from "./test-archive-http.mjs";
import { testPackageBrowser } from "./test-package-browser.mjs";
import { testOperationsHTTP } from "./test-operations-http.mjs";
import { testOperationsBrowser } from "./test-operations-browser.mjs";
import { testRecovery } from "./test-recovery.mjs";
import { pilotSmoke } from "../../../scripts/lib/pilot-smoke.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const web = fileURLToPath(new URL("../", import.meta.url));
let step = "isolated environment guard";
let assertions = 0;
let server;
let extensionHarness;
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
    NEXT_PUBLIC_APP_URL: "http://localhost:3000", NEXT_TELEMETRY_DISABLED: "1", EXTENSION_PUBLIC_SUPABASE_URL: url, EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey, EXTENSION_PUBLIC_API_URL: "http://localhost:3000/api/v1" };
  delete baseEnv.SUPABASE_SERVICE_ROLE_KEY;
  step = "production build";
  run(npm, ["run", "build"], baseEnv);
  step = "unpacked extension startup";
  extensionHarness=await launchExtension();
  const renderKey = randomBytes(32).toString("hex");
  const runtimeEnv = { ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: serviceKey, DOCUMENT_RENDER_SIGNING_KEY: renderKey, DOCUMENT_RENDER_KEY_ID: "primary", EXTENSION_ALLOWED_ORIGIN: extensionHarness.origin, NODE_ENV: "production" };
  step = "production server startup";
  server = spawn(process.execPath, [fileURLToPath(import.meta.resolve("next/dist/bin/next")), "start", "--port", "3000"],
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
  const configured = await operator.rpc("configure_document_render_key", { p_id: "primary", p_key_hex: renderKey });
  expect(!configured.error, `Isolated render signing key registered (${configured.error?.code ?? "OK"})`);
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

  async function call(identity, path, body, version, extra = {}, method = body ? "POST" : "GET") {
    const response = await fetch(`http://localhost:3000/api/v1${path}`, {
      method,
      headers: { ...(identity ? { Authorization: `Bearer ${identity.token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...(version === undefined ? {} : { "If-Match": JSON.stringify(String(version)) }), ...extra },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: "manual",
    });
    expect(/no-store/.test(response.headers.get("cache-control") ?? ""), "API responses are no-store");
    const envelope = await response.json();
    expect(typeof envelope.requestId === "string", "API response has request ID");
    return { status: response.status, data: envelope.data, code: envelope.error?.code, message:envelope.error?.message, currentVersion: envelope.error?.currentVersion, fieldErrors: envelope.error?.fieldErrors };
  }
  async function command(identity, organizationId, body, version, status = 200) {
    if (body.command === "changeAssignment" && version === undefined) {
      const current = await call(identity, `/candidates/${body.candidateId}?organizationId=${organizationId}`);
      version = current.data.rowVersion;
    }
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

  step = "candidate API persistence, concurrent editing, history and archive";
  const blank = { fullName: null, email: null, phone: null, location: null, seniorityPreference: null,
    professionalSummary: null, privateNotes: null, status: "draft", links: [], experiences: [], educations: [], certifications: [] };
  const createdProfile = await call(identities.adminA, `/candidates?organizationId=${orgA}`, { teamId: teamA, ownerId: identities.memberA.id, profile: blank });
  expect(createdProfile.status === 200 && createdProfile.data.fullName === null, "Incomplete draft is persisted without invented facts");
  const managedId = createdProfile.data.id;
  const path = `/candidates/${managedId}?organizationId=${orgA}`;
  const childPath = suffix => `/candidates/${managedId}/${suffix}?organizationId=${orgA}`;
  const experience = (title, start, end) => ({ id: randomUUID(), company: "Synthetic Employer", officialTitle: title,
    proposedDisplayTitle: "Software Engineer", titlePolicy: "tailorable", startDate: start, endDate: end, current: false,
    location: null, sourceBullets: ["Synthetic verified contribution"], achievements: ["Synthetic verified achievement"], preferredBulletCount: 3 });
  let content = { ...blank, fullName: "Synthetic Managed Avery", email: "managed@example.invalid", phone: "+1-202-555-0100",
    location: "Synthetic City", status: "ready", links: [{ id: randomUUID(), type: "github", url: "https://GITHUB.com/synthetic-candidate" }],
    experiences: [experience("Engineer II", "2020-02", "2022"), experience("Engineer I", "2018", "2020-01")],
    educations: [{ id: randomUUID(), institution: "Synthetic University", degree: "BSc", fieldOfStudy: "Computing",
      startDate: "2014", endDate: "2018", displayPolicy: "fixed" }],
    certifications: [{ id: randomUUID(), name: "Synthetic Certification", issuer: "Synthetic Issuer", issueDate: "2021-01",
      expiryDate: null, credentialId: "SYNTHETIC-123", verificationStatus: "verified" }] };
  const invalidReady = await call(identities.adminA, path, { ...content, phone: null }, 1, {}, "PATCH");
  expect(invalidReady.status === 400 && invalidReady.fieldErrors.some(i => i.path === "phone"), "Ready API requires phone with a linked field error");
  let savedProfile = await call(identities.adminA, path, content, 1, {}, "PATCH");
  expect(savedProfile.status === 200 && savedProfile.data.rowVersion === 2, "All profile sections persist atomically");
  const reloaded = await call(identities.adminA, path);
  expect(reloaded.data.experiences.length === 2 && reloaded.data.educations[0].institution === "Synthetic University"
    && reloaded.data.certifications[0].credentialId === "SYNTHETIC-123" && reloaded.data.links[0].url === "https://github.com/synthetic-candidate", "Fresh GET retains normalized persisted sections");
  expect(reloaded.data.experiences[0].startDate === "2020-02", "HTTP round trip preserves date precision");
  const assigned = await call(identities.leaderA, childPath("assignments"), { userId: identities.memberA.id, assign: true }, 2);
  expect(assigned.status === 200 && assigned.data.rowVersion === 3, "Candidate assignment is versioned");
  const concurrent = await Promise.all([
    call(identities.adminA, path, { ...content, fullName: "Synthetic Managed Winner One" }, 3, {}, "PATCH"),
    call(identities.memberA, path, { ...content, fullName: "Synthetic Managed Winner Two" }, 3, {}, "PATCH"),
  ]);
  expect(concurrent.filter(r => r.status === 200).length === 1 && concurrent.filter(r => r.status === 409).length === 1, "Simultaneous saves have exactly one winner");
  expect(concurrent.find(r => r.status === 409).currentVersion === 4, "Conflict response exposes current authorized version");
  savedProfile = await call(identities.adminA, path);
  content.fullName = savedProfile.data.fullName;
  const pendingApproval = await call(identities.memberA, childPath("title-approvals"), { experienceId: content.experiences[0].id }, 4);
  expect(pendingApproval.status === 403, "Members cannot approve presentation variants");
  const approved = await call(identities.leaderA, childPath("title-approvals"), { experienceId: content.experiences[0].id }, 4);
  expect(approved.status === 200 && approved.data.experiences[0].officialTitle === "Engineer II"
    && approved.data.experiences[0].approvedDisplayTitle === "Software Engineer", "Title approval is separate from official history");
  const frozenTitle = await call(identities.adminA, childPath("revisions/5"));
  content.experiences[0].proposedDisplayTitle = "Backend Engineer";
  const changedTitle = await call(identities.memberA, path, content, 5, {}, "PATCH");
  expect(changedTitle.status === 200 && changedTitle.data.experiences[0].approvedDisplayTitle === null, "Editing proposed title clears stale approval");
  expect(frozenTitle.data.experiences[0].approvedDisplayTitle === "Software Engineer", "Earlier approved snapshot is immutable");
  const stolenChild = await call(identities.adminA, `/candidates?organizationId=${orgA}`, { teamId: teamA, ownerId: null, profile: content });
  expect([400, 403].includes(stolenChild.status), "Record IDs cannot be reparented to a different candidate");
  const badDate = structuredClone(content); badDate.experiences[0].startDate = "2023-02-29";
  expect((await call(identities.adminA, path, badDate, 6, {}, "PATCH")).status === 400, "Impossible dates fail without overwriting input");
  const unsafe = structuredClone(content); unsafe.links[0].url = "javascript:alert(1)";
  expect((await call(identities.adminA, path, unsafe, 6, {}, "PATCH")).status === 400, "Unsafe professional URL rejected");
  content.experiences.reverse();
  expect((await call(identities.memberA, path, content, 6, {}, "PATCH")).status === 200, "Record reorder saves");
  const reordered = await call(identities.adminA, path);
  expect(reordered.data.experiences[0].id === content.experiences[0].id, "Record order survives fresh request");
  const oldOrder = await call(identities.adminA, childPath("revisions/2"));
  expect(oldOrder.data.experiences[0].officialTitle === "Engineer II", "Reordering cannot alter earlier revision order");
  content.experiences.pop();
  expect((await call(identities.memberA, path, content, 7, {}, "PATCH")).status === 200, "Removing a current record saves");
  expect((await call(identities.adminA, childPath("revisions/2"))).data.experiences.length === 2, "Removal preserves old immutable source records");
  const filtered = await call(identities.adminA, `/candidates?organizationId=${orgA}&q=Managed&status=ready&teamId=${teamA}&ownerId=${identities.memberA.id}&assigneeId=${identities.memberA.id}&sort=name_asc`);
  expect(filtered.status === 200 && filtered.data.total === 1 && filtered.data.items[0].id === managedId, "Directory search/filters/sorting operate on authorized persisted data");
  expect((await call(identities.leaderBeta, path)).status === 403, "Unrelated team cannot read complete profile");
  const archivedProfile = await call(identities.memberA, childPath("archive"), { archived: true }, 8);
  expect(archivedProfile.status === 200 && archivedProfile.data.status === "archived", "Archiving persists as explicit versioned state");
  const normalList = await call(identities.adminA, `/candidates?organizationId=${orgA}`);
  expect(!normalList.data.items.some(r => r.id === managedId), "Default directory excludes archived profile");
  const archivedList = await call(identities.adminA, `/candidates?organizationId=${orgA}&status=archived`);
  expect(archivedList.data.items.some(r => r.id === managedId), "Archived filter exposes retained authorized profile");
  expect((await call(identities.memberA, path, content, 9, {}, "PATCH")).status === 409, "Archived profile cannot be edited");
  expect((await call(identities.leaderA, childPath("assignments"), { userId: identities.memberA.id, assign: false }, 9)).status === 409, "Archived assignments are read-only");
  const restoredProfile = await call(identities.memberA, childPath("archive"), { archived: false }, 9);
  expect(restoredProfile.status === 200 && restoredProfile.data.status === "ready", "Restore preserves prior Ready state");
  const workspaceData = await call(identities.adminA, childPath("workspace"));
  expect(workspaceData.data.revisions.length >= 10 && workspaceData.data.events.some(r => r.action === "candidate.archived"), "Activity tab uses actual revisions and audit events");
  const revokedAssignment = await call(identities.leaderA, childPath("assignments"), { userId: identities.memberA.id, assign: false }, 10);
  expect(revokedAssignment.status === 200 && (await call(identities.memberA, path)).status === 403, "Ending assignment immediately revokes complete profile access");
  expect((await identities.bidderA.client.from("candidate_profile_revisions").select("id")).data.length === 0, "Direct bidder profile-history access denied");
  expect((await identities.memberA.client.from("work_experiences").select("id").eq("candidate_id", managedId)).data.length === 0, "Revoked user cannot bypass API via child tables");
  const oldAssignment = await identities.leaderA.client.rpc("change_candidate_assignment", { p_org: orgA, p_candidate: managedId,
    p_user: identities.memberA.id, p_assign: true, p_request: randomUUID() });
  expect(oldAssignment.error?.code === "42501", "Legacy assignment RPC cannot bypass version checks");
  step = "resume prompt/source Auth and HTTP acceptance";
  const resumeFixture = await testResumeHTTP({ call, identities, org: orgA, team: teamA, expect });
  step = "template library and frozen version acceptance";
  const templateFixture = await testTemplateHTTP({ call, identities, org: orgA, candidate: resumeFixture.candidate, expect });
  step = "cover letters and frozen export-only documents";
  const documentFixture = await testDocumentHTTP({ call, command, identities, org: orgA, ...templateFixture, expect });
  step = "resume production headless Chromium acceptance";
  try { const checkpoints = await testResumeBrowser({ org: orgA, candidate: resumeFixture.candidate, identities, password }); expect(checkpoints === 9, "All resume browser checkpoints completed"); console.log(JSON.stringify({ result: "PASS", resumeBrowserCheckpoints: checkpoints })); }
  catch (error) { throw new TestFailure(error.message); }
  step = "letter and frozen document headless Chromium acceptance";
  try { const checks = await testDocumentBrowser({org:orgA,candidate:resumeFixture.candidate,identities,password,...documentFixture}); expect(checks===8,"All letter/document browser checkpoints completed"); console.log(JSON.stringify({result:"PASS",documentBrowserCheckpoints:checks})); }
  catch(error) { throw new TestFailure(error.message); }
  step = "candidate headless Chromium acceptance";
  try {
    const browserChecks = await testCandidateBrowser({ org: orgA, team: teamA, identities, password });
    expect(browserChecks === 15, "Candidate browser acceptance completes all 15 checkpoints");
    console.log(JSON.stringify({ result: "PASS", browser: "headless Chromium", candidateCheckpoints: browserChecks }));
  } catch (error) { throw new TestFailure(error.message); }
  step = "bid and interview production API acceptance";
  const workflowFixture = await testWorkflowHTTP({call,command,identities,org:orgA,team:teamA,expect});
  step="archive package HTTP";
  const archiveFixture=await testArchiveHTTP({call,command,identities,org:orgA,team:teamA,assert:expect,renderKey});
  step = "bid and interview browser acceptance";
  try { const checks=await testWorkflowBrowser({org:orgA,team:teamA,identities,password,...workflowFixture});expect(checks===15,"All 15 workflow browser checkpoints complete");console.log(JSON.stringify({result:"PASS",workflowBrowserCheckpoints:checks})); } catch(e){throw new TestFailure(e.message); }
  step = "unpacked extension real-backend acceptance";
  try { const checks=await testExtensionBrowser({harness:extensionHarness,call,command,identities,org:orgA,team:teamA,password,assert:expect});expect(checks===12,"All 12 extension browser checkpoints complete");console.log(JSON.stringify({result:"PASS",extensionBrowserCheckpoints:checks}));} catch(e){throw new TestFailure(e.message);}
  step = "current membership and grant revocation with existing tokens";
  step="application history HTTP";
  const historyFixture=await testHistoryHTTP({call,command,identities,org:orgA,team:teamA,assert:expect,workflowFixture});
  step="quick application check browser";
  try{const checks=await testHistoryBrowser({harness:extensionHarness,fixture:historyFixture,identities,org:orgA,password,assert:expect});expect(checks===9,"All nine Quick Check browser checkpoints complete");console.log(JSON.stringify({result:"PASS",historyBrowserCheckpoints:checks}));}catch(error){throw new TestFailure(error.message);}
  step="package save and recovery browser";
  try{const checks=await testPackageBrowser({harness:extensionHarness,fixture:archiveFixture,identities,org:orgA,password,call,assert:expect});expect(checks===7,"All seven package browser checkpoints complete");console.log(JSON.stringify({result:"PASS",packageBrowserCheckpoints:checks}));}catch(error){throw new TestFailure(error.message);}
  step="operational reporting API/RLS";
  const operationsFixture=await testOperationsHTTP({call,command,identities,org:orgA,team:teamA,fixture:workflowFixture,assert:expect});
  step="role dashboard browser acceptance";
  const operationChecks=await testOperationsBrowser({org:orgA,identities,password,fixture:operationsFixture});expect(operationChecks===11,"All eleven operational dashboard browser checkpoints complete");console.log(JSON.stringify({result:"PASS",operationsBrowserCheckpoints:operationChecks}));
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
      else if (/\.(js|json|html)$/.test(entry.name)) { const bytes = readFileSync(path); expect(!bytes.includes(Buffer.from(serviceKey)) && !bytes.includes(Buffer.from(renderKey)), "Privileged keys absent from client artifact"); }
    }
  }
  inspect(`${web}/.next/static`);
  inspect(`${root}/apps/extension/dist`);
  step = "reusable pilot smoke against isolated synthetic backend";
  const smoke=await pilotSmoke({supabaseUrl:url,publishableKey:publicKey,appOrigin:'http://localhost:3000',email:identities.adminA.email,password:replacement,organizationId:orgA,teamId:teamA});
  expect(smoke.checks===11,'All eleven reusable pilot smoke checkpoints pass');console.log(JSON.stringify({pilotSmoke:smoke}));
  step = "encrypted backup and isolated restore";
  await testRecovery({identities,assert:expect});
  console.log(JSON.stringify({ result: "PASS", assertions, scope: "isolated Supabase Auth + production Next HTTP; synthetic data only", browserAcceptance: "86 headless Chromium checkpoints including role dashboards, CSP, unpacked MV3 Quick Check and package recovery; hosted native shortcut/menu and Windows filesystem gates pending" }));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", step, message: error instanceof TestFailure ? error.message : "Integration harness failed; inspect the isolated service health and current step." }));
  process.exitCode = 1;
} finally {
  server?.kill("SIGTERM");
  await extensionHarness?.close();
}

