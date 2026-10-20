import { advanceProcessingReports, type ProcessingReports, type ReportIdentity } from "@candidate/domain";
import type { ProcessingStage } from "@candidate/contracts";
import type { ExtensionApi } from "./api";
import type { PackageOperation } from "./package-journal";
import { localStore } from "./local-store";
/** Trusted workspace only. Reports are actor-bound and contain no package content. */
export async function reportPackageProcessing(api: ExtensionApi, op: PackageOperation) {
  const i = op.input;
  return reportExtensionProcessing(api, { operationId: op.id, actorId: i.actorId, organizationId: i.organizationId, candidateId: i.candidateId, bidId: op.result?.bidId ?? i.existingBidId }, op.outcomes);
}
export async function reportExtensionProcessing(api: ExtensionApi, identity: ReportIdentity, outcomes: Partial<Record<ProcessingStage, { state: string }>>) {
  const key = `processing-reports:${identity.actorId}:${identity.organizationId}:${identity.operationId}`;
  return navigator.locks.request(key, async () => {
    const store = localStore(); const old = await store.get<ProcessingReports>(key) ?? { states: {}, queue: [] };
    const next = advanceProcessingReports(old, identity, outcomes);
    // Freeze event IDs before any network effect; retry only these original events.
    await store.put(key, next);
    while (next.queue.length) {
      await api.request("processing?organizationId=" + identity.organizationId, { actorId: identity.actorId, organizationId: identity.organizationId, body: next.queue[0] });
      next.queue.shift(); await store.put(key, next);
    }
  });
}
