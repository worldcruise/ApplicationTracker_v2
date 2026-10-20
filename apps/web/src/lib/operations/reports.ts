"use client";
import { advanceProcessingReports, type ProcessingReports, type ReportIdentity } from "@candidate/domain";
import type { ProcessingStage } from "@candidate/contracts";
import { readApi } from "@/app/workspace/requests";
interface Row extends ProcessingReports { actorId: string; organizationId: string }
async function db() { return new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open("candidate-processing-reports", 1); r.onupgradeneeded = () => r.result.createObjectStore("reports"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(Error("Processing report journal unavailable.")); }); }
async function read(key: string) { const d = await db(); try { return await new Promise<Row | undefined>((resolve, reject) => { const r = d.transaction("reports").objectStore("reports").get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { d.close(); } }
async function write(key: string, row: Row) { const d = await db(); try { await new Promise<void>((resolve, reject) => { const t = d.transaction("reports", "readwrite"); t.objectStore("reports").put(row, key); t.oncomplete = () => resolve(); t.onerror = t.onabort = () => reject(t.error); }); } finally { d.close(); } }
const lock = <T,>(key: string, work: () => Promise<T>) => navigator.locks.request("processing-report:" + key, work);
export async function queueProcessingReports(identity: ReportIdentity, outcomes: Partial<Record<ProcessingStage, { state: string }>>) {
  const key = `${identity.actorId}:${identity.organizationId}:${identity.operationId}`;
  await lock(key, async () => { const previous = await read(key) ?? { actorId: identity.actorId, organizationId: identity.organizationId, states: {}, queue: [] }; await write(key, { ...previous, ...advanceProcessingReports(previous, identity, outcomes) }); });
  void flushProcessingReports(identity.actorId, identity.organizationId).catch(() => {});
}
export async function flushProcessingReports(actor: string, org: string) {
  return lock(`${actor}:${org}:flush`, async () => {
    const d = await db(); let keys: IDBValidKey[];
    try { keys = await new Promise((resolve, reject) => { const r = d.transaction("reports").objectStore("reports").getAllKeys(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { d.close(); }
    for (const k of keys.filter(k => typeof k === "string" && k.startsWith(`${actor}:${org}:`))) {
      const key = String(k);
      // Serialize updates and delivery for one operation. A lost response keeps the exact event.
      await lock(key, async () => {
        const row = await read(key); if (!row || row.actorId !== actor || row.organizationId !== org) return;
        while (row.queue.length) {
          await readApi(`/api/v1/processing?organizationId=${org}`, { method: "POST", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", "X-Operation-Actor": actor }, body: JSON.stringify(row.queue[0]) });
          row.queue.shift(); await write(key, row);
        }
      });
    }
  });
}
