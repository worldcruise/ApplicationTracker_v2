import { validateCandidateProfile, ProfileValidationFailure } from "@candidate/domain";
import { ApiFailure } from "@/lib/api/errors";
import { uuid } from "@/lib/api/guards";

export function profileInput(value: unknown) {
  try { return validateCandidateProfile(value); }
  catch (error) {
    if (error instanceof ProfileValidationFailure) throw new ApiFailure(400, "SCHEMA_INVALID", error.message, false, error.issues);
    throw error;
  }
}

export function strictObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiFailure(400, "SCHEMA_INVALID", "Supply the documented fields.");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== keys.length || keys.some(k => !Object.hasOwn(object, k))) throw new ApiFailure(400, "SCHEMA_INVALID", "Supply only the documented fields.");
  return object;
}

export function directoryInput(query: URLSearchParams) {
  const one = (name: string, values: string[], fallback: string) => {
    const value = query.get(name) ?? fallback;
    if (!values.includes(value)) throw new ApiFailure(400, "SCHEMA_INVALID", `Invalid ${name} filter.`);
    return value;
  };
  const id = (name: string) => query.get(name) ? uuid(query.get(name), name) : null;
  const page = Number(query.get("page") ?? 1);
  const search = (query.get("q") ?? "").trim();
  if (search.length > 200 || !Number.isSafeInteger(page) || page < 1 || page > 100000) throw new ApiFailure(400, "SCHEMA_INVALID", "Invalid search or page.");
  return { p_query: search, p_status: one("status", ["active", "draft", "ready", "archived", "all"], "active"),
    p_sort: one("sort", ["updated_desc", "name_asc", "name_desc", "created_desc"], "updated_desc"),
    p_team: id("teamId"), p_owner: id("ownerId"), p_assignee: id("assigneeId"),
    p_unassigned: one("unassigned", ["true", "false"], "false") === "true", p_page: page, p_page_size: 25 };
}
