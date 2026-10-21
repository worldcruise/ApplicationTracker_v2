import { bidStatuses, interviewLifecycles, workflowSorts, type WorkflowSearchFilters, type WorkflowSearchKind } from "@candidate/contracts";

export class SearchInputError extends Error {}
export const normalizeSearch = (value: string) => value.trim().replace(/\s+/gu, " ");
const ids = ["candidateId", "ownerId", "teamId", "bidId"] as const;
const dates = ["createdFrom", "createdTo", "submittedFrom", "submittedTo", "scheduledFrom", "scheduledTo"] as const;
const common = ["q", "candidateId", "company", "status", "ownerId", "teamId", "followup", "sort", "page", "pageSize"];
const bidOnly = ["priority", "createdFrom", "createdTo", "submittedFrom", "submittedTo"];
const interviewOnly = ["bidId", "type", "round", "scheduledFrom", "scheduledTo", "upcoming", "feedbackPending"];
export function parseWorkflowSearch(params: URLSearchParams, kind: WorkflowSearchKind): WorkflowSearchFilters {
  const allowed = [...common, ...(kind === "bids" ? bidOnly : interviewOnly)];
  for (const key of params.keys()) if (![...allowed,"organizationId","search","view"].includes(key)) throw new SearchInputError(`Unsupported ${kind} search filter: ${key}.`);
  const values: Record<string, string | number | boolean> = {};
  for (const key of allowed) {
    if (params.getAll(key).length > 1) throw new SearchInputError(`Supply ${key} only once.`);
    const value = normalizeSearch(params.get(key) ?? "");
    if (!value) continue;
    if (/[\u0000-\u001f\u007f]/u.test(value) || value.length > 200) throw new SearchInputError(`${key} must contain at most 200 characters of plain text.`);
    values[key] = value;
  }
  for (const key of ids) if (values[key] && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(values[key]))) throw new SearchInputError(`${key} must be a valid reference.`);
  for (const key of dates) if (values[key]) {
    const date = String(values[key]);
    const parsed = new Date(date + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01" || date > "9998-12-31" || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw new SearchInputError(`${key} must be a valid calendar date.`);
  }
  for (const stem of ["created", "submitted", "scheduled"]) if (values[stem + "From"] && values[stem + "To"] && String(values[stem + "From"]) > String(values[stem + "To"])) throw new SearchInputError(`${stem}: the end date must be on or after the start date.`);
  if (values.status && !(kind === "bids" ? bidStatuses : interviewLifecycles).includes(values.status as never)) throw new SearchInputError("Choose a valid status.");
  if (values.priority && !["low", "normal", "high", "urgent"].includes(String(values.priority))) throw new SearchInputError("Choose a valid priority.");
  if (values.followup && !["due", "overdue"].includes(String(values.followup))) throw new SearchInputError("Choose a valid follow-up filter.");
  for (const key of ["upcoming", "feedbackPending"]) if (values[key]) {
    if (!["true", "false"].includes(String(values[key]))) throw new SearchInputError(`${key} must be true or false.`);
    if (values[key] === "true") values[key] = true; else delete values[key];
  }
  for (const [key, fallback, max] of [["page", 1, 100000], ["pageSize", 25, 100], ["round", 0, 10000]] as const) {
    if (values[key] === undefined && key === "round") continue;
    const value = values[key] ?? fallback;
    if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > max) throw new SearchInputError(`${key} must be between 1 and ${max}.`);
    values[key] = Number(value);
  }
  const sort = String(values.sort ?? (values.q ? "relevance" : kind === "bids" ? "updated_desc" : "scheduled_asc"));
  if (!workflowSorts.includes(sort as never) || (kind === "bids" ? sort.startsWith("scheduled") : sort === "submitted_desc")) throw new SearchInputError("Choose a supported sort order.");
  values.sort = sort;
  return values as unknown as WorkflowSearchFilters;
}
