import type { PromptAssembly, ResumeOutcomes, ResumeReviewInput, ResumeSourceRequest } from "@candidate/contracts";
export interface StudioPdf { bytes: Uint8Array; sha256: string; pageCount: number; rendererVersion: string; renderedAt: string; warnings: string[]; text: string }
export interface StudioOperation {
  id: string; actorId: string; organizationId: string; candidateId: string; assemblyId: string; rawJson: string; review: ResumeReviewInput;
  renderedAt: string; payload: ResumeSourceRequest | null; pdf: StudioPdf | null; sourceId: string | null; outcomes: ResumeOutcomes;
}
export interface StudioDraft { rawJson: string; job: PromptAssembly["job"]; assembly: PromptAssembly | null; review: ResumeReviewInput | null; operation: StudioOperation | null; outcomes: ResumeOutcomes }
export const studioKey = (actor: string, org: string, candidate: string) => `${actor}:${org}:${candidate}`;
export function initialResumeOutcomes(): ResumeOutcomes {
  return Object.fromEntries(["validation", "pdfGeneration", "localExport", "databaseSync", "clipboard"].map(k => [k, { state: "idle", attempts: 0, error: null, updatedAt: null }])) as unknown as ResumeOutcomes;
}
let open: Promise<IDBDatabase> | undefined;
function database() {
  return open ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("candidate-resume-studio", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("drafts"); request.result.createObjectStore("operations"); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => { open = undefined; reject(new Error("Local resume journal is unavailable.")); };
  });
}
export async function loadStudioDraft(key: string): Promise<StudioDraft | undefined> {
  const db = await database(); return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly"); const request = tx.objectStore("drafts").get(key);
    request.onsuccess = () => resolve(request.result as StudioDraft | undefined); request.onerror = () => reject(new Error("Local draft could not be restored."));
  });
}
export async function saveStudioDraft(key: string, draft: StudioDraft) {
  const db = await database(); return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite"); tx.objectStore("drafts").put(structuredClone(draft), key);
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(new Error("Local draft could not be saved."));
  });
}
export async function saveStudioOperation(operation: StudioOperation) {
  const db = await database(); return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("operations", "readwrite"); const store = tx.objectStore("operations"); const request = store.get(operation.id);
    request.onsuccess = () => {
      const old = request.result as StudioOperation | undefined;
      const context = (v: StudioOperation) => JSON.stringify([v.actorId, v.organizationId, v.candidateId, v.assemblyId, v.rawJson, v.review, v.renderedAt]);
      if (old && (context(old) !== context(operation) || (old.payload && JSON.stringify(old.payload) !== JSON.stringify(operation.payload)) || (old.pdf && old.pdf.sha256 !== operation.pdf?.sha256))) { tx.abort(); return; }
      store.put(structuredClone(operation), operation.id);
    };
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(new Error("Operation journal write failed or frozen input changed. Start a new operation; the previous result is retained."));
  });
}
export async function pdfDigest(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function safeResumeFilename(name: string | null, company: string, title: string, operation: StudioOperation) {
  const safe = (value: string) => value.normalize("NFKC").replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").replace(/[. ]+$/g, "").trim().slice(0, 45) || "Unknown";
  return `${safe(name ?? "Resume")}_${safe(company)}_${safe(title)}_${operation.renderedAt.slice(0, 10).replaceAll("-", "")}__${operation.id.slice(0, 8)}.pdf`;
}
