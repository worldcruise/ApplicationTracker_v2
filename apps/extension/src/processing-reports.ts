import { advanceProcessingReports, type ProcessingReports } from "@candidate/domain";
import type { ExtensionApi } from "./api";
import type { PackageOperation } from "./package-journal";
import { localStore } from "./local-store";
/** Trusted workspace only. Reports are actor-bound and contain no package content. */
export async function reportPackageProcessing(api: ExtensionApi, op: PackageOperation) {
  const i = op.input, key = `processing-reports:${i.actorId}:${i.organizationId}:${op.id}`;
  return navigator.locks.request(key, async () => {
    const store = localStore(); const old = await store.get<ProcessingReports>(key) ?? { states: {}, queue: [] };
    const next = advanceProcessingReports(old, { operationId: op.id, actorId: i.actorId, organizationId: i.organizationId, candidateId: i.candidateId, bidId: op.result?.bidId ?? i.existingBidId }, op.outcomes);
    // Freeze event IDs before any network effect; retry only these original events.
    await store.put(key, next);
    while (next.queue.length) {
      await api.request("processing?organizationId=" + i.organizationId, { actorId: i.actorId, organizationId: i.organizationId, body: next.queue[0] });
      next.queue.shift(); await store.put(key, next);
    }
  });
}
