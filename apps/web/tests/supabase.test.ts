import assert from "node:assert/strict";
import test from "node:test";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { noStoreFetch } from "../src/lib/supabase/config";
import { updateSession } from "../src/lib/supabase/proxy";
import { preserveSessionResponse, preventSessionCaching } from "../src/lib/supabase/response";

const url = "https://synthetic.supabase.co";
const userId = "00000000-0000-4000-8000-000000000001";

function jwt(expiresAt: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: userId, aud: "authenticated", role: "authenticated", exp: expiresAt,
    iat: Math.floor(Date.now() / 1000), iss: `${url}/auth/v1`,
  })}.c3ludGhldGlj`;
}

test("near-expiry SSR session refresh reaches request and response, including chunked cookies", async t => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_synthetic";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  const now = Math.floor(Date.now() / 1000);
  const freshJwt = jwt(now + 3600);
  const user = {
    id: userId, aud: "authenticated", role: "authenticated",
    app_metadata: {}, user_metadata: { synthetic: "x".repeat(5000) },
    created_at: "2026-01-01T00:00:00.000Z",
  };
  let refreshes = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const endpoint = new URL(input instanceof Request ? input.url : input.toString());
    if (endpoint.pathname === "/auth/v1/token") {
      assert.equal(endpoint.searchParams.get("grant_type"), "refresh_token");
      assert.equal(init?.cache, "no-store");
      refreshes++;
      return Response.json({
        access_token: freshJwt, refresh_token: "synthetic-rotated-refresh",
        token_type: "bearer", expires_in: 3600, user,
      });
    }
    assert.equal(endpoint.pathname, "/auth/v1/user");
    return Response.json(user);
  });

  // Let the real SDK serialize a synthetic session instead of hand-writing its cookie format.
  const jar = new Map<string, string>();
  const seed = createServerClient(url, "sb_publishable_synthetic", {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: entries => entries.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const seeded = await seed.auth.setSession({ access_token: jwt(now + 30), refresh_token: "synthetic-old-refresh" });
  assert.equal(seeded.error, null);
  assert.ok(jar.size > 1, "fixture exercises multiple cookie chunks");

  const request = new NextRequest("http://localhost:3000/", {
    headers: { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") },
  });
  const response = await updateSession(request);
  assert.equal(refreshes, 1);
  assert.ok(response.cookies.getAll().length > 1);
  response.cookies.getAll().forEach(cookie => {
    assert.equal(request.cookies.get(cookie.name)?.value, cookie.value);
    assert.equal(cookie.sameSite, "lax");
  });
  assert.notEqual(request.headers.get("cookie"), [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
  assert.equal(response.headers.get("x-middleware-request-cookie"), request.headers.get("cookie"));
  assert.match(response.headers.get("cache-control") ?? "", /private.*no-store/);
  assert.equal(response.headers.get("pragma"), "no-cache");

  const nextRequestClient = createServerClient(url, "sb_publishable_synthetic", {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => assert.fail("fresh request must not refresh again") },
  });
  const verified = await nextRequestClient.auth.getClaims();
  assert.equal(verified.data?.claims.exp, now + 3600);
  assert.equal(refreshes, 1);
});

test("redirect replacements retain every cookie, deletion and cache header", () => {
  const source = preventSessionCaching(NextResponse.next());
  source.cookies.set("session.0", "synthetic-new", { path: "/", sameSite: "lax", secure: true });
  source.cookies.set("session.1", "", { path: "/", maxAge: 0 });
  const redirect = preserveSessionResponse(source, NextResponse.redirect("https://example.invalid/login"));
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get("location"), "https://example.invalid/login");
  assert.deepEqual(redirect.cookies.getAll(), source.cookies.getAll());
  for (const name of ["cache-control", "expires", "pragma"]) {
    assert.equal(redirect.headers.get(name), source.headers.get(name));
  }
});

test("user-context fetch overrides any caller cache preference", async t => {
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.cache, "no-store");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer synthetic-user");
    return new Response(null, { status: 204 });
  });
  await noStoreFetch("https://example.invalid/rest/v1/authorized_table", {
    cache: "force-cache", headers: { authorization: "Bearer synthetic-user" },
  });
});
