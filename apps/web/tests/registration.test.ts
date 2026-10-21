import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationErrors } from "@candidate/contracts";
test("registration requires usable identity, password bounds and matching confirmation", () => {
  const valid = { fullName: "Synthetic Zoë 林", email: "synthetic@example.invalid", password: "Synthetic-password-123", confirmation: "Synthetic-password-123" };
  assert.deepEqual(registrationErrors(valid), []);
  assert.deepEqual(registrationErrors({ fullName:" ", email:"broken", password:"short", confirmation:"other" }).map(e => e.path), ["fullName","email","password","confirmation"]);
  assert.equal(registrationErrors({ ...valid, password:"a".repeat(257) }).some(e => e.path === "password"), true);
});
