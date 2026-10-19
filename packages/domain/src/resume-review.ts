import type { CandidateProfile, ResumeContentV1, ResumeEvidence, ResumeReview, ResumeReviewInput } from "@candidate/contracts";
const norm = (text: string | null) => (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
const escape = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
export function isResumeReviewInput(value: unknown): value is ResumeReviewInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join() !== "claims,educationIds,experienceIds") return false;
  const ids = (list: unknown) => Array.isArray(list) && list.length <= 100 && list.every(id => id === null || (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)));
  if (!ids(v.experienceIds) || !ids(v.educationIds) || !v.claims || typeof v.claims !== "object" || Array.isArray(v.claims)) return false;
  return Object.entries(v.claims).length <= 1000 && Object.entries(v.claims).every(([path, claim]) => {
    if (!/^\/(summary$|skills\/|experience\/)/.test(path) || path.length > 400 || !claim || typeof claim !== "object" || Array.isArray(claim)) return false;
    const c = claim as Record<string, unknown>;
    return Object.keys(c).sort().join() === "attested,sources" && typeof c.attested === "boolean" && Array.isArray(c.sources) && c.sources.length <= 100 && c.sources.every(id => typeof id === "string" && id.length <= 100);
  });
}
export function resumeEvidence(snapshot: CandidateProfile): ResumeEvidence[] {
  return [
    ...(snapshot.professionalSummary ? [{ id: "profile:summary", label: "Verified professional summary", text: snapshot.professionalSummary }] : []),
    ...snapshot.experiences.flatMap(w => [
      { id: `work:${w.id}:facts`, label: `${w.company ?? "Unknown employer"} — official employment facts`, text: [w.company, w.officialTitle, w.approvedDisplayTitle, w.startDate, w.endDate, w.location].filter(Boolean).join(" | ") },
      ...w.sourceBullets.map((text, i) => ({ id: `work:${w.id}:bullet:${i}`, label: `${w.company ?? "Work"} source bullet ${i + 1}`, text })),
      ...w.achievements.map((text, i) => ({ id: `work:${w.id}:achievement:${i}`, label: `${w.company ?? "Work"} verified achievement ${i + 1}`, text })),
    ]),
    ...snapshot.educations.map(e => ({ id: `education:${e.id}`, label: e.institution ?? "Education", text: [e.degree, e.fieldOfStudy, e.institution, e.startDate, e.endDate].filter(Boolean).join(" | ") })),
    ...snapshot.certifications.filter(c => c.verificationStatus === "verified").map(c => ({ id: `certification:${c.id}`, label: c.name ?? "Certification", text: [c.name, c.issuer, "verified", c.issueDate, c.expiryDate].filter(Boolean).join(" | ") })),
  ];
}
export function defaultResumeMapping(content: ResumeContentV1, snapshot: CandidateProfile): ResumeReviewInput {
  return { experienceIds: content.experience.map(e => {
    const matches = snapshot.experiences.filter(w => norm(w.company) === norm(e.company) && norm(e.company) &&
      (norm(w.officialTitle) === norm(e.title) || (w.titlePolicy === "tailorable" && norm(w.approvedDisplayTitle) === norm(e.title))));
    return matches.length === 1 ? matches[0]!.id : null;
  }), educationIds: content.education.map(e => {
    const matches = snapshot.educations.filter(w => norm(w.degree) && [w.degree, [w.degree, w.fieldOfStudy].filter(Boolean).join(" "), [w.degree, w.fieldOfStudy].filter(Boolean).join(" in ")].some(v => norm(v) === norm(e.degree)));
    return matches.length === 1 ? matches[0]!.id : null;
  }), claims: {} };
}
/** Structural shape does not prove narrative facts. Explicit attestations bind
 * the exact content path to named frozen evidence; no client reviewer is trusted. */
export function reviewResume(content: ResumeContentV1, snapshot: CandidateProfile, supplied?: ResumeReviewInput): ResumeReview {
  const mapping = supplied ?? defaultResumeMapping(content, snapshot);
  const conflicts: ResumeReview["conflicts"] = [];
  const evidence = resumeEvidence(snapshot);
  const claims: ResumeReview["claims"] = [];
  const conflict = (path: string, message: string) => conflicts.push({ path, code: "FACTUAL_REVIEW_REQUIRED", message });
  if (mapping.experienceIds.length !== content.experience.length || mapping.educationIds.length !== content.education.length) conflict("", "Map every employment and education entry to this frozen profile.");
  function claim(path: string, text: string, allowed: ResumeEvidence[]) {
    if (!text.trim()) return;
    const automatic = allowed.some(e => norm(e.text) === norm(text));
    const selected = mapping.claims[path];
    const sources = allowed.filter(e => selected?.sources.includes(e.id));
    const comparison = automatic ? allowed.filter(e => norm(e.text) === norm(text)) : sources;
    const proof = norm(comparison.map(e => e.text).join(" "));
    const issues: string[] = [];
    const numbers = text.match(/\d+(?:[.,]\d+)*(?:%|\+)?/g) ?? [];
    const sourceNumbers = new Set(comparison.flatMap(e => e.text.match(/\d+(?:[.,]\d+)*(?:%|\+)?/g) ?? []));
    if (numbers.some(n => !sourceNumbers.has(n))) issues.push("A numerical claim is absent from the selected verified evidence. Correct the content or verified profile.");
    const credentials = norm(text).match(/\b(?:ph\.?d\.?|mba|msc|bsc|bachelor|master|doctorate|certified|certification)\b/g) ?? [];
    if (credentials.some(c => !proof.includes(c))) issues.push("A qualification claim is absent from the selected verified evidence.");
    if (!automatic && (!selected?.attested || !sources.length)) issues.push("Select supporting facts and explicitly attest this paraphrase; unsupported claims must be corrected in the verified profile first.");
    if (selected?.sources.some(id => !allowed.some(e => e.id === id))) issues.push("Evidence must belong to the mapped source entry or frozen profile.");
    claims.push({ path, text, evidence: allowed, automatic, resolved: issues.length === 0, issues });
  }
  claim("/summary", content.summary, evidence);
  content.skills.forEach((group, i) => Object.entries(group).forEach(([category, skills]) => skills.forEach((s, j) => claim(`/skills/${i}/${escape(category)}/${j}`, s, evidence))));
  const usedWork = new Set<string>(); const usedEducation = new Set<string>();
  content.experience.forEach((entry, i) => {
    const source = snapshot.experiences.find(e => e.id === mapping.experienceIds[i]);
    if (!source) { conflict(`/experience/${i}`, "Choose a verified work record. Repeated employers require explicit selection."); return; }
    if (usedWork.has(source.id)) conflict(`/experience/${i}`, "Do not duplicate the same employment record."); usedWork.add(source.id);
    if (!norm(entry.company) || norm(entry.company) !== norm(source.company)) conflict(`/experience/${i}/company`, "Historical employer must match the selected work record; target company is separate metadata.");
    const allowedTitles = [source.officialTitle, ...(source.titlePolicy === "tailorable" ? [source.approvedDisplayTitle] : [])].filter(v => norm(v));
    if (!norm(entry.title) || !allowedTitles.some(t => norm(t) === norm(entry.title))) conflict(`/experience/${i}/title`, "Use the official title or an explicitly approved tailorable display title.");
    entry.sentences.forEach((text, j) => claim(`/experience/${i}/sentences/${j}`, text, evidence.filter(e => e.id.startsWith(`work:${source.id}:`))));
  });
  content.education.forEach((entry, i) => {
    const source = snapshot.educations.find(e => e.id === mapping.educationIds[i]);
    if (!source) { conflict(`/education/${i}`, "Choose a verified education record; do not add a qualification through generated JSON."); return; }
    if (usedEducation.has(source.id)) conflict(`/education/${i}`, "Do not duplicate the same education record."); usedEducation.add(source.id);
    if (!norm(source.degree) || ![source.degree, [source.degree, source.fieldOfStudy].filter(Boolean).join(" "), [source.degree, source.fieldOfStudy].filter(Boolean).join(" in ")].some(v => norm(v) === norm(entry.degree))) conflict(`/education/${i}/degree`, "Degree and major must match the selected verified education.");
  });
  if (snapshot.status !== "ready") conflict("/profile", "A Draft profile may be previewed/saved as unverified; a reviewed resume requires a Ready profile.");
  for (const path of Object.keys(mapping.claims)) if (!claims.some(c => c.path === path)) conflict(path, "Review applies only to a current narrative claim.");
  return { mapping, claims, conflicts, reviewed: conflicts.length === 0 && claims.every(c => c.resolved) };
}
