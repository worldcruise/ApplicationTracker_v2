import { sha256, type RenderedResume, type syntheticResume } from "@candidate/resume-engine";
import { localStore } from "./local-store";
import { requireDirectoryWritePermission } from "./directory";

export interface StoredSample extends RenderedResume {
  operationId: string;
  schemaVersion: 1;
  createdAt: string;
  fixture: typeof syntheticResume;
  templateVersion: "phase0-classic-v1";
  rendererVersion: "phase0-1";
  fontHashes: Record<string, string>;
}
export interface SampleOutcome {
  localSave: "not-started" | "pending" | "succeeded" | "failed";
  download: "not-started" | "initiated" | "failed";
  databaseSync: "not-attempted";
}
export const ACTIVE_SAMPLE = "active-sample";
export const sampleKey = (id: string) => `sample-pdf:${id}`;
export const outcomeKey = (id: string) => `sample-outcome:${id}`;
export const initialOutcome = (): SampleOutcome => ({ localSave: "not-started", download: "not-started", databaseSync: "not-attempted" });

export async function assertFrozenSample(sample: StoredSample) {
  if (await sha256(sample.bytes) !== sample.sha256) throw new Error("Frozen PDF bytes failed their hash check. No export was attempted.");
}

export async function loadSample() {
  const store = localStore();
  const id = await store.get<string>(ACTIVE_SAMPLE);
  if (!id) return undefined;
  const sample = await store.get<StoredSample>(sampleKey(id));
  if (!sample) throw new Error("Stored PDF pointer is incomplete; the prior result is unknown.");
  await assertFrozenSample(sample);
  return sample;
}

/** Same bytes for PDF.js input, Blob download, and a directory write. Never re-render on export. */
export async function pdfBlob(sample: StoredSample) {
  await assertFrozenSample(sample);
  return new Blob([new Uint8Array(sample.bytes)], { type: "application/pdf" });
}

export async function saveSampleToDirectory(handle: FileSystemDirectoryHandle, sample: StoredSample) {
  await assertFrozenSample(sample);
  await requireDirectoryWritePermission(handle);
  const name = `synthetic-resume__${sample.operationId}.pdf`;
  let existing: FileSystemFileHandle | undefined;
  try { existing = await handle.getFileHandle(name); }
  catch (error) { if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error; }
  if (existing) {
    const bytes = new Uint8Array(await (await existing.getFile()).arrayBuffer());
    if (await sha256(bytes) !== sample.sha256) throw new Error("This operation's filename already has different or incomplete bytes. Inspect it; it will not be overwritten.");
    return { name, reused: true };
  }
  const file = await handle.getFileHandle(name, { create: true });
  const stream = await file.createWritable();
  try { await stream.write(new Uint8Array(sample.bytes)); await stream.close(); }
  catch (error) { try { await stream.abort(); } catch { /* already closed */ } throw error; }
  const written = new Uint8Array(await (await file.getFile()).arrayBuffer());
  if (await sha256(written) !== sample.sha256) throw new Error("Closed file did not match the frozen PDF hash. Local save is not verified.");
  return { name, reused: false };
}
