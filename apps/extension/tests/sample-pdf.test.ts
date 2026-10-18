import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { renderFeasibilityResume, sha256, syntheticResume } from "@candidate/resume-engine";
import { assertFrozenSample, pdfBlob, saveSampleToDirectory, type StoredSample } from "../src/sample-pdf";

async function fixture(): Promise<StoredSample> {
  const bytes = new TextEncoder().encode("%PDF-synthetic-test-bytes");
  return {
    bytes, sha256: await sha256(bytes), pageCount: 1, operationId: "00000000-0000-4000-8000-000000000001", schemaVersion: 1,
    createdAt: "2026-10-17T00:00:00.000Z", fixture: structuredClone(syntheticResume), templateVersion: "phase0-classic-v1", rendererVersion: "phase0-1", fontHashes: {},
  };
}

test("directory export closes/read-verifies frozen bytes, reuses identical retries and refuses collisions", async () => {
  const sample = await fixture();
  let permission: PermissionState = "granted";
  let present = false;
  let bytes = new Uint8Array();
  let writes = 0;
  let closed = false;
  const file = {
    async getFile() { return new File([bytes], "synthetic.pdf"); },
    async createWritable() {
      return {
        async write(value: Uint8Array) { writes++; bytes = new Uint8Array(value); },
        async close() { closed = true; },
        async abort() {},
      };
    },
  };
  const handle = {
    async queryPermission() { return permission; },
    async getFileHandle(_name: string, options?: { create?: boolean }) {
      if (!present && !options?.create) throw new DOMException("Synthetic missing file", "NotFoundError");
      present = true;
      return file;
    },
  } as unknown as FileSystemDirectoryHandle;
  assert.equal((await saveSampleToDirectory(handle, sample)).reused, false);
  assert.ok(closed);
  assert.equal(await sha256(bytes), sample.sha256);
  assert.equal((await saveSampleToDirectory(handle, sample)).reused, true);
  assert.equal(writes, 1);
  bytes = new Uint8Array([9, 9]);
  await assert.rejects(saveSampleToDirectory(handle, sample), /will not be overwritten/);
  permission = "denied";
  await assert.rejects(saveSampleToDirectory(handle, sample), /permission is required/);
  assert.equal(writes, 1);
});

test("download blob is byte-identical and mutated snapshots cannot export", async () => {
  const sample = await fixture();
  assert.equal(await sha256(new Uint8Array(await (await pdfBlob(sample)).arrayBuffer())), sample.sha256);
  sample.bytes[0] = 0;
  await assert.rejects(assertFrozenSample(sample), /hash check/);
  await assert.rejects(pdfBlob(sample), /hash check/);
});

test("renderer embeds bundled fonts for Unicode/multipage content and rejects unsupported glyphs", async () => {
  const root = new URL("../../../packages/resume-engine/assets/fonts/", import.meta.url);
  const fonts = {
    regular: new Uint8Array(await readFile(new URL("NotoSans-Regular.ttf", root))),
    bold: new Uint8Array(await readFile(new URL("NotoSans-Bold.ttf", root))),
  };
  const result = await renderFeasibilityResume(fonts);
  assert.ok(result.pageCount >= 2);
  assert.equal(await sha256(result.bytes), result.sha256);
  const unsupported = structuredClone(syntheticResume);
  unsupported.snapshot.name = "Synthetic 🦄";
  await assert.rejects(renderFeasibilityResume(fonts, unsupported), /does not support U\+/);
});
