import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSecurityPolicy } from "../src/lib/api/security";
test("production CSP pins script nonces and connection origin without general eval", () => {
 const policy=contentSecurityPolicy("synthetic-nonce","https://synthetic.example.invalid",false);
 assert.match(policy,/script-src 'self' 'nonce-synthetic-nonce' 'strict-dynamic'/);
 assert.ok(!policy.includes("'unsafe-eval'"));assert.match(policy,/frame-ancestors 'none'/);assert.match(policy,/object-src 'none'/);
 assert.match(policy,/connect-src 'self' https:\/\/synthetic.example.invalid/);
 assert.ok(contentSecurityPolicy("dev","http://localhost:54321",true).includes("'unsafe-eval'"));
});
