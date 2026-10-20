import type { ProcessingObservation, ProcessingStage } from "@candidate/contracts";
export interface ProcessingReports { states: Partial<Record<ProcessingStage, string>>; queue: ProcessingObservation[] }
export interface ReportIdentity { operationId: string; actorId: string; organizationId: string; candidateId: string; bidId: string | null }
/** No source text, error messages, credentials or document data enters telemetry. */
export function advanceProcessingReports(previous: ProcessingReports, identity: ReportIdentity, outcomes: Partial<Record<ProcessingStage, { state: string }>>, makeId: () => string = () => crypto.randomUUID()): ProcessingReports {
  const next = structuredClone(previous);
  for (const [stage, result] of Object.entries(outcomes) as [ProcessingStage, { state: string }][]) {
    const state = result.state;
    if (next.states[stage] === state || !["failed", "unknown", "conflict", "succeeded"].includes(state)) continue;
    // Successful stages need reporting only after this device observed a failure.
    if (state === "succeeded" && next.states[stage] === undefined) continue;
    next.states[stage] = state;
    next.queue.push({ eventId: makeId(), operationId: identity.operationId, candidateId: identity.candidateId, bidId: identity.bidId,
      stage, state: state as ProcessingObservation["state"], code: state === "succeeded" ? "RECOVERED" : state === "unknown" ? "SYNC_UNKNOWN" : state === "conflict" ? "CONFLICT" : "PROCESSING_FAILED" });
  }
  return next;
}
