import assert from "node:assert/strict";
import test from "node:test";
import { createExtensionAuth, sessionStorageAdapter, signInExistingAccount, verifiedIdentity, verifyApiIdentity, type AuthLock, type SessionArea } from "../src/auth";

const config = { supabaseUrl: "https://synthetic.supabase.co", publishableKey: "sb_publishable_synthetic", apiUrl: "http://localhost:3000/api/v1" };
const userId = "00000000-0000-4000-8000-000000000001";
function memoryArea() {
  const data: Record<string, unknown> = {};
  const events: string[] = [];
  const area: SessionArea = {
    async get(key) { events.push("get"); return { [key]: data[key] }; },
    async set(values) { events.push("set"); Object.assign(data, values); },
    async remove(key) { delete data[key]; },
    async setAccessLevel(value) { events.push(value.accessLevel); },
  };
  const tails = new Map<string, Promise<unknown>>();
  const lock: AuthLock = async (name, work) => {
    const previous = tails.get(name) ?? Promise.resolve();
    const result = previous.then(work, work);
    tails.set(name, result.catch(() => undefined));
    return result;
  };
  return { area, data, events, lock };
}
function session() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.c3ludGhldGlj`,
    refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600,
    user: { id: userId, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
}

test("trusted session storage survives a workspace/client reopen, then clears with the browser session", async t => {
  const memory = memoryArea();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.hostname, "synthetic.supabase.co");
    if (url.pathname.endsWith("/token")) return Response.json(session());
    assert.equal(url.pathname, "/auth/v1/user");
    return Response.json(session().user);
  });
  const first = await createExtensionAuth(config, memory.area);
  const identity = await signInExistingAccount(first, "candidate-test@example.invalid", "synthetic-password");
  assert.equal(identity?.id, userId);
  assert.equal(memory.events[0], "TRUSTED_CONTEXTS");
  assert.ok(Object.keys(memory.data).some(key => key.includes("auth-token")));
  const reopened = await createExtensionAuth(config, memory.area);
  assert.equal((await verifiedIdentity(reopened))?.id, userId);
  for (const key of Object.keys(memory.data)) delete memory.data[key];
  const restarted = await createExtensionAuth(config, memory.area);
  assert.equal(await verifiedIdentity(restarted), null);
});

test("shared identity check retries only its safe GET once after a 401 and never trusts a mismatched ID", async t => {
  const memory = memoryArea();
  let apiCalls = 0;
  let refreshes = 0;
  let wrongUser = false;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "localhost") {
      apiCalls++;
      assert.equal(init?.method ?? "GET", "GET");
      assert.equal(init?.credentials, "omit");
      assert.ok(new Headers(init?.headers).get("authorization")?.startsWith("Bearer "));
      if (apiCalls === 1) return new Response(null, { status: 401 });
      return Response.json({ data: { userId: wrongUser ? "other-user" : userId, projectRef: "synthetic", verification: "identity-only" } });
    }
    if (url.pathname.endsWith("/token")) {
      if (url.searchParams.get("grant_type") === "refresh_token") refreshes++;
      return Response.json(session());
    }
    return Response.json(session().user);
  });
  const client = await createExtensionAuth(config, memory.area);
  await signInExistingAccount(client, "candidate-test@example.invalid", "synthetic-password");
  assert.equal(await verifyApiIdentity(client, config), userId);
  assert.equal(apiCalls, 2);
  assert.equal(refreshes, 1);
  wrongUser = true;
  await assert.rejects(verifyApiIdentity(client, config), /did not match/);
});

test("session adapter limits access before reading and does not coerce malformed storage", async () => {
  const memory = memoryArea();
  const adapter = await sessionStorageAdapter(memory.area);
  memory.data.bad = { access_token: "synthetic" };
  assert.equal(await adapter.getItem("bad"), null);
  assert.deepEqual(memory.events, ["TRUSTED_CONTEXTS", "get"]);
});
