import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderAtsClassic, ATS_CLASSIC, syntheticResume, sha256 } from "@candidate/resume-engine";
const fixture = structuredClone(syntheticResume);
fixture.content.company = "TARGET METADATA MUST NOT BECOME EMPLOYER";
fixture.content.experience.forEach(w => { w.sentences = [...w.sentences, ...w.sentences]; });
const snapshot = { id: "a9000000-0000-4000-9000-000000000001", organizationId: "a9000000-0000-4000-9000-000000000002", owningTeamId: "a9000000-0000-4000-9000-000000000003", ownerId: null,
  fullName: fixture.snapshot.name, email: fixture.snapshot.email, phone: "+1 202 555 0100", location: fixture.snapshot.location, seniorityPreference: null, professionalSummary: fixture.content.summary, privateNotes: "EXCLUDED PRIVATE NOTE", status: "ready", rowVersion: 1, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z", links: [], assignments: [], certifications: [],
  experiences: fixture.content.experience.map((w, i) => ({ id: `a9000000-0000-4000-9000-${String(i + 100).padStart(12, "0")}`, company: w.company, officialTitle: w.title, approvedDisplayTitle: null, titleApprovedBy: null, titleApprovedAt: null, proposedDisplayTitle: null, titlePolicy: "fixed", startDate: `201${i}`, endDate: `201${i + 1}`, current: false, location: "Synthetic Region", sourceBullets: w.sentences, achievements: [], preferredBulletCount: 3 })),
  educations: [{ id: "a9000000-0000-4000-9000-000000000200", institution: "Fictional Example University", degree: fixture.content.education[0].degree, fieldOfStudy: null, startDate: null, endDate: "2010", displayPolicy: "fixed" }] };
const fonts = { regular: new Uint8Array(await readFile(new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url))), bold: new Uint8Array(await readFile(new URL("../assets/fonts/NotoSans-Bold.ttf", import.meta.url))) };
const input = { rawJson: JSON.stringify(fixture.content), snapshot, mapping: { experienceIds: snapshot.experiences.map(w => w.id), educationIds: snapshot.educations.map(e => e.id), claims: {} }, reviewed: true, renderedAt: "2026-10-18T12:00:00.000Z", templateVersionId: ATS_CLASSIC.id };
const output = new URL("../../../output/pdf/", import.meta.url); const previews = new URL("../../../tmp/pdfs/", import.meta.url); await mkdir(output, { recursive: true }); await mkdir(previews, { recursive: true });
const result = await renderAtsClassic(fonts, input); assert.ok(result.pageCount >= 3); assert.equal(result.sha256, await sha256(result.bytes));
await writeFile(new URL("ats-classic-synthetic.pdf", output), result.bytes);
const task = getDocument({ data: result.bytes.slice(), useWasm: false, useWorkerFetch: false, isEvalSupported: false }); const pdf = await task.promise;
let text = ""; let items = 0;
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n); const content = await page.getTextContent();
  for (const item of content.items) if ("str" in item && item.str.trim()) {
    text += item.str + " "; items++; assert.ok(item.transform[4] >= 47 && item.transform[4] + item.width <= 565, `page ${n}: horizontal overflow`); assert.ok(item.transform[5] >= 27 && item.transform[5] <= 745, `page ${n}: vertical overflow`);
  }
  const viewport = page.getViewport({ scale: 1.4 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); await page.render({ canvas: null, canvasContext: canvas.getContext("2d"), viewport }).promise;
  await writeFile(new URL(`ats-classic-page-${n}.png`, previews), canvas.toBuffer("image/png"));
}
assert.ok(text.includes(snapshot.fullName)); assert.ok(text.includes("2010")); assert.ok(!text.includes(fixture.content.company)); assert.ok(!text.includes(snapshot.privateNotes)); assert.ok(!text.includes("\uFFFD"));
for (const work of snapshot.experiences) assert.ok(text.includes(work.company));
await task.destroy(); assert.equal((await renderAtsClassic(fonts, input)).sha256, result.sha256, "pinned recovery reproduces exact bytes");
await assert.rejects(() => renderAtsClassic(fonts, { ...input, rawJson: "{}" }));
await assert.rejects(() => renderAtsClassic(fonts, { ...input, rawJson: JSON.stringify({ ...fixture.content, summary: "Unsupported \u{1F680}" }) }), /U\+1F680/);
const empty = await renderAtsClassic(fonts, { ...input, rawJson: JSON.stringify({ company: "", title: "", summary: "", skills: [], experience: [], education: [] }), mapping: { experienceIds: [], educationIds: [], claims: {} }, reviewed: false }); assert.ok(empty.pageCount === 1);
const unverified = await renderAtsClassic(fonts, { ...input, reviewed: false }); await writeFile(new URL("ats-classic-unverified-synthetic.pdf", output), unverified.bytes);
const unverifiedTask = getDocument({ data: unverified.bytes.slice(), useWasm: false, useWorkerFetch: false, isEvalSupported: false }); const unverifiedDoc = await unverifiedTask.promise;
const page = await unverifiedDoc.getPage(1); const viewport = page.getViewport({ scale: 1.4 }); const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)); await page.render({ canvas: null, canvasContext: canvas.getContext("2d"), viewport }).promise; await writeFile(new URL("ats-classic-unverified-page-1.png", previews), canvas.toBuffer("image/png"));
assert.ok((await page.getTextContent()).items.some(i => "str" in i && i.str === "UNVERIFIED")); await unverifiedTask.destroy();
console.log(JSON.stringify({ result: "PASS", template: "ATS Classic v1", pages: result.pageCount, bytes: result.bytes.length, sha256: result.sha256, textItems: items, unicode: "verified", bounds: "verified", targetMetadataExcluded: true, repeatedBytes: "identical", emptyContent: "verified", unsupportedGlyph: "actionable failure", unverifiedWatermark: "verified" }));
