import assert from "node:assert/strict";
import test from "node:test";
import { validateResume, type CandidateProfile } from "@candidate/contracts";
import { defaultResumeMapping, reviewResume, emptyCandidateProfile, emptyExperience } from "@candidate/domain";
const work = { ...emptyExperience(), company: "Historical Studio", officialTitle: "Engineer II", sourceBullets: ["Improved a synthetic workflow by 20%."] };
const snapshot: CandidateProfile = { ...emptyCandidateProfile(), id: crypto.randomUUID(), organizationId: crypto.randomUUID(), owningTeamId: crypto.randomUUID(), ownerId: null,
  fullName: "Synthetic Zo\u00eb", email: "zoe@example.invalid", phone: "+1 202 555 0100", location: "Synthetic City", status: "ready", rowVersion: 1, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
  experiences: [{ ...work, approvedDisplayTitle: null, titleApprovedBy: null, titleApprovedAt: null }], assignments: [] };
const content = { company: "Target Co", title: "Engineer", summary: "", skills: [], experience: [{ company: work.company, title: work.officialTitle, sentences: work.sourceBullets }], education: [] };
test("v1 preserves raw invalid input, distinguishes structure from empty content and strips unsupported rendering properties", () => {
  const bad = '{"company":"Target",'; assert.equal(validateResume(bad).rawJson, bad); assert.equal(validateResume(bad).errors[0]?.code, "INVALID_JSON");
  assert.ok(validateResume("{}").errors.some(e => e.path === "/experience"));
  const result = validateResume(JSON.stringify({ ...content, summary: "", education: [{ degree: "", university: "Unsupported" }], extra: "original" }));
  assert.equal(result.errors.length, 0); assert.ok(result.warnings.some(w => w.code === "EMPTY_CONTENT"));
  assert.ok(result.warnings.some(w => w.path === "/education/0/university")); assert.ok(!("extra" in result.content!));
  assert.ok(result.rawJson.includes("original")); assert.ok(validateResume(JSON.stringify(content), 2).errors.length);
});
test("bounded safe parsing rejects prototype keys, deep nesting and oversized arrays without runtime code generation", () => {
  assert.ok(validateResume('{"__proto__":{},"company":""}').errors.some(e => e.path === "/__proto__"));
  assert.ok(validateResume(JSON.stringify({ ...content, extra: Array.from({ length: 101 }, () => "x") })).errors.length);
  let deep: unknown = "x"; for (let i = 0; i < 34; i++) deep = { nested: deep };
  assert.ok(validateResume(JSON.stringify({ ...content, extra: deep })).errors.length);
  assert.ok(validateResume(" ".repeat(1_048_577)).errors[0]?.message.includes("1 MiB"));
  assert.equal(validateResume(JSON.stringify({ ...content, summary: "Synthetic \u00e9\u0142\u00f6\u00f1" })).errors.length, 0);
});
test("mapping separates target from employer, ambiguous records require selection and unsupported titles cannot be attested away", () => {
  const typed = validateResume(JSON.stringify(content)).content!;
  assert.equal(defaultResumeMapping(typed, snapshot).experienceIds[0], work.id);
  assert.equal(reviewResume(typed, snapshot).reviewed, true);
  assert.ok(reviewResume({ ...typed, experience: [{ ...typed.experience[0]!, company: "Target Co" }] }, snapshot).conflicts.length);
  const duplicate = { ...snapshot, experiences: [...snapshot.experiences, { ...snapshot.experiences[0]!, id: crypto.randomUUID() }] };
  assert.equal(defaultResumeMapping(typed, duplicate).experienceIds[0], null);
  assert.ok(reviewResume({ ...typed, experience: [{ ...typed.experience[0]!, title: "Director" }] }, snapshot, { ...defaultResumeMapping(typed, snapshot) }).conflicts.some(c => c.path.endsWith("title")));
});
test("human paraphrases bind evidence; unsupported numbers remain blocked and source edits require re-review", () => {
  const typed = validateResume(JSON.stringify({ ...content, summary: "Improved the synthetic workflow by 20%." })).content!;
  const mapping = defaultResumeMapping(typed, snapshot);
  assert.equal(reviewResume(typed, snapshot, mapping).reviewed, false);
  mapping.claims["/summary"] = { sources: [`work:${work.id}:bullet:0`], attested: true };
  assert.equal(reviewResume(typed, snapshot, mapping).reviewed, true);
  assert.equal(reviewResume({ ...typed, summary: "Improved the synthetic workflow by 99%." }, snapshot, mapping).reviewed, false);
  assert.equal(reviewResume({ ...typed, summary: "Certified MBA expert." }, snapshot, mapping).reviewed, false);
  const changed = { ...snapshot, experiences: [{ ...snapshot.experiences[0]!, sourceBullets: ["Different verified fact"] }] };
  assert.equal(reviewResume(typed, changed, mapping).reviewed, false);
});
