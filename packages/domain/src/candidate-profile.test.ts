import assert from "node:assert/strict";
import test from "node:test";
import { emptyCandidateProfile, emptyExperience, partialDateRange, validateCandidateProfile, ProfileValidationFailure, mergeCandidateDraft } from "@candidate/domain";

test("unknown drafts are valid; Ready requires the four explicitly selected facts", () => {
  assert.equal(validateCandidateProfile(emptyCandidateProfile()).warnings.length, 4);
  assert.throws(() => validateCandidateProfile({ ...emptyCandidateProfile(), status: "ready", fullName: "Synthetic Avery", email: "avery@example.invalid", location: "Synthetic City" }),
    error => error instanceof ProfileValidationFailure && error.issues.some(i => i.path === "phone"));
});

test("three-way conflict recovery preserves independent edits and requires choices for reordered/deleted sections", () => {
  const base = { ...emptyCandidateProfile(), fullName: "Synthetic Avery", experiences: [emptyExperience(), emptyExperience()] };
  const mine = { ...base, phone: "+1 202 555 0100", experiences: [base.experiences[1]!, base.experiences[0]!] };
  const current = { ...base, fullName: "Synthetic Blake", experiences: [base.experiences[0]!] };
  const result = mergeCandidateDraft(base, mine, current);
  assert.equal(result.merged.fullName, current.fullName);
  assert.equal(result.merged.phone, mine.phone);
  assert.deepEqual(result.conflicts, ["experiences"]);
  assert.deepEqual(result.merged.experiences, current.experiences);
  assert.deepEqual(mergeCandidateDraft(base, mine, structuredClone(mine)).conflicts, []);
  assert.equal(base.phone, null);
});

test("real date precision is retained and impossible dates/periods fail", () => {
  assert.ok(partialDateRange("0001")); assert.ok(partialDateRange("2024-02-29"));
  assert.equal(partialDateRange("2023-02-29"), null); assert.equal(partialDateRange("2024-13"), null);
  const item = { ...emptyExperience(), startDate: "2021-03", endDate: "2020" };
  assert.throws(() => validateCandidateProfile({ ...emptyCandidateProfile(), experiences: [item] }), ProfileValidationFailure);
  const result = validateCandidateProfile({ ...emptyCandidateProfile(), experiences: [{ ...item, endDate: "2022" }] });
  assert.equal(result.profile.experiences[0]?.startDate, "2021-03");
});

test("overlap is a warning while title approval injection and unsafe links are rejected", () => {
  const work = { ...emptyExperience(), officialTitle: "Engineer II", proposedDisplayTitle: "Engineer", titlePolicy: "tailorable", startDate: "2020", endDate: "2022" };
  const result = validateCandidateProfile({ ...emptyCandidateProfile(), experiences: [work, { ...work, id: crypto.randomUUID() }] });
  assert.ok(result.warnings.some(i => i.message.includes("overlap")));
  assert.equal(result.profile.experiences[0]?.officialTitle, "Engineer II");
  assert.throws(() => validateCandidateProfile({ ...emptyCandidateProfile(), experiences: [{ ...work, approvedDisplayTitle: "Director" }] }), ProfileValidationFailure);
  for (const url of ["javascript:alert(1)", "https://user:pass@example.invalid", "file:///tmp/resume"]) {
    assert.throws(() => validateCandidateProfile({ ...emptyCandidateProfile(), links: [{ id: crypto.randomUUID(), type: "website", url }] }), ProfileValidationFailure);
  }
  assert.equal(validateCandidateProfile({ ...emptyCandidateProfile(), links: [{ id: crypto.randomUUID(), type: "website", url: "https://EXAMPLE.invalid" }] }).profile.links[0]?.url, "https://example.invalid/");
});
