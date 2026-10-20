import type { CoverLetterRequest, ResumeOutcomes, ResumeReviewInput } from "@candidate/contracts";
import { queueProcessingReports } from "@/lib/operations/reports";
import type { StudioPdf } from "@/lib/resumes/journal";
export interface LetterOperation {
  id: string; actorId: string; organizationId: string; candidateId: string; profileRevision: number; templateVersionId: string; bidId: string | null;
  bodyText: string; review: ResumeReviewInput; renderedAt: string; payload: CoverLetterRequest | null; pdf: StudioPdf | null; sourceId: string | null; outcomes: ResumeOutcomes;
}
export interface LetterDraft { bodyText: string; templateId: string; bidId: string; review: ResumeReviewInput; operation: LetterOperation | null }
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("candidate-cover-letters", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("drafts"); request.result.createObjectStore("operations"); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => { connection = undefined; reject(new Error("Local letter journal is unavailable.")); };
  });
}
export async function loadLetterDraft(key: string): Promise<LetterDraft | undefined> {
  const db = await database(); return new Promise((resolve, reject) => { const tx = db.transaction("drafts", "readonly"); const r = tx.objectStore("drafts").get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error("Letter draft restore failed.")); });
}
export async function saveLetterDraft(key: string, draft: LetterDraft) {
  const db = await database(); return new Promise<void>((resolve, reject) => { const tx = db.transaction("drafts", "readwrite"); tx.objectStore("drafts").put(structuredClone(draft), key); tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(new Error("Letter draft saving failed.")); });
}
export async function saveLetterOperation(op: LetterOperation) {
  const db = await database(); return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("operations", "readwrite"); const store = tx.objectStore("operations"); const r = store.get(op.id);
    r.onsuccess = () => {
      const old = r.result as LetterOperation | undefined;
      const frozen = (o: LetterOperation) => JSON.stringify([o.actorId,o.organizationId,o.candidateId,o.profileRevision,o.templateVersionId,o.bidId,o.bodyText,o.review,o.renderedAt]);
      if (old && (frozen(old) !== frozen(op) || (old.payload && JSON.stringify(old.payload) !== JSON.stringify(op.payload)) || (old.pdf && old.pdf.sha256 !== op.pdf?.sha256))) { tx.abort(); return; }
      store.put(structuredClone(op), op.id);
    };
    tx.oncomplete = () => { resolve(); void queueProcessingReports({ operationId: op.id, actorId: op.actorId, organizationId: op.organizationId, candidateId: op.candidateId, bidId: op.bidId }, op.outcomes).catch(() => {}); }; tx.onabort = tx.onerror = () => reject(new Error("Frozen letter operation changed or its journal is unavailable. Original operation retained."));
  });
}
