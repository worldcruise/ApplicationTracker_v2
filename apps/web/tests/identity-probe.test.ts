import assert from "node:assert/strict";
import test from "node:test";
import { identityProbe } from "../src/app/api/v1/feasibility/identity/handler";

const origin = `chrome-extension://${"a".repeat(32)}`;

test("development probe rejects disabled, production, unallowlisted and unauthenticated requests", async t => {
  const keys = ["NODE_ENV", "FEASIBILITY_API_ENABLED", "EXTENSION_ALLOWED_ORIGIN"];
  const saved = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }));
  t.mock.method(globalThis, "fetch", () => assert.fail("rejected requests must not contact Auth"));
  Object.assign(process.env, { NODE_ENV: "test", FEASIBILITY_API_ENABLED: "false", EXTENSION_ALLOWED_ORIGIN: origin });
  const request = new Request("http://localhost/api/v1/feasibility/identity", { headers: { origin } });
  assert.equal((await identityProbe(request)).status, 404);
  Object.assign(process.env, { NODE_ENV: "production", FEASIBILITY_API_ENABLED: "true" });
  assert.equal((await identityProbe(request)).status, 404);
  Object.assign(process.env, { NODE_ENV: "test" });
  const wrongOrigin = await identityProbe(new Request(request.url, { headers: { origin: "https://example.invalid" } }));
  assert.equal(wrongOrigin.status, 403);
  assert.equal(wrongOrigin.headers.get("access-control-allow-origin"), null);
  assert.equal((await identityProbe(request)).status, 401);
  const preflight = await identityProbe(new Request(request.url, { method: "OPTIONS", headers: { origin } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  assert.match(preflight.headers.get("cache-control") ?? "", /no-store/);
});

test("bearer probe verifies with Auth in user context and returns identity only", async t => {
  const values = { NODE_ENV: "test", FEASIBILITY_API_ENABLED: "true", EXTENSION_ALLOWED_ORIGIN: origin, NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic" };
  const saved = Object.keys(values).map(key => process.env[key]);
  t.after(() => Object.keys(values).forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }));
  Object.assign(process.env, values);
  let status = 200;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer synthetic-user-token");
    assert.equal(init?.cache, "no-store");
    return status === 200
      ? Response.json({ id: "synthetic-user", app_metadata: {}, user_metadata: {}, aud: "authenticated" })
      : Response.json({ msg: "Synthetic rejection" }, { status });
  });
  const request = new Request("http://localhost/api/v1/feasibility/identity", { headers: { origin, authorization: "Bearer synthetic-user-token" } });
  const result = await identityProbe(request);
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).data, { userId: "synthetic-user", projectRef: "synthetic", verification: "identity-only", applicationAccessVerified: false });
  assert.equal(result.headers.get("access-control-allow-origin"), origin);
  status = 401;
  assert.equal((await identityProbe(request)).status, 401);
  status = 503;
  assert.equal((await identityProbe(request)).status, 503);
});
