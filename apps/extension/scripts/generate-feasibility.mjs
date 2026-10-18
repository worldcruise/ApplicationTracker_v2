import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderFeasibilityResume, sha256, syntheticResume } from "@candidate/resume-engine";

const fontRoot = new URL("../../../packages/resume-engine/assets/fonts/", import.meta.url);
const fonts = {
  regular: new Uint8Array(await readFile(new URL("NotoSans-Regular.ttf", fontRoot))),
  bold: new Uint8Array(await readFile(new URL("NotoSans-Bold.ttf", fontRoot))),
};
const started = performance.now();
const rendered = await renderFeasibilityResume(fonts);
const renderMs = Math.round(performance.now() - started);
const output = new URL("../../../output/pdf/", import.meta.url);
const previews = new URL("../../../tmp/pdfs/", import.meta.url);
await mkdir(output, { recursive: true });
await mkdir(previews, { recursive: true });
await writeFile(new URL("phase0-synthetic-resume.pdf", output), rendered.bytes);
const loadingTask = getDocument({ data: rendered.bytes.slice(), useWasm: false, useWorkerFetch: false });
const pdf = await loadingTask.promise;
assert.equal(pdf.numPages, rendered.pageCount);
assert.ok(pdf.numPages >= 2, "synthetic fixture must exercise pagination");
let fullText = "";
let textItems = 0;
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    fullText += item.str + " ";
    textItems++;
    assert.ok(item.transform[4] >= 47 && item.transform[4] + item.width <= 565, `page ${number}: horizontal text overflow`);
    assert.ok(item.transform[5] >= 26 && item.transform[5] < 770, `page ${number}: vertical text overflow`);
  }
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvas: null, canvasContext: canvas.getContext("2d"), viewport }).promise;
  await writeFile(new URL(`phase0-page-${number}.png`, previews), canvas.toBuffer("image/png"));
}
assert.ok(fullText.includes(syntheticResume.snapshot.name), "Unicode name must survive selectable text extraction");
for (const role of syntheticResume.content.experience) assert.ok(fullText.includes(role.company));
assert.ok(fullText.includes("Education"));
assert.ok(!fullText.includes("\uFFFD"), "no replacement glyphs");
assert.equal(await sha256(rendered.bytes), rendered.sha256, "PDF.js must not detach/mutate export bytes");
await loadingTask.destroy();
const repeated = await renderFeasibilityResume(fonts);
assert.equal(repeated.sha256, rendered.sha256, "pinned fixture/metadata/fonts produce repeatable bytes");
console.log(JSON.stringify({ pages: rendered.pageCount, bytes: rendered.bytes.length, sha256: rendered.sha256, textItems, renderMs, unicodeText: "verified", layoutBounds: "verified", repeatedHash: "identical", output: "output/pdf/phase0-synthetic-resume.pdf", previewImages: "tmp/pdfs/phase0-page-*.png" }, null, 2));
