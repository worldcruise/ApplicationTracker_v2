import { HISTORY_VERSION, type ReviewedJobContext, type HistoryIdentifiers, type HistoryRecord, type HistoryMatch, type HistoryMatches } from "@candidate/contracts";

export function normalizedText(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}
export function companyKeys(value: string) {
  const key = normalizedText(value);
  const loose = key.replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/gu, " ").trim()
    .replace(/(?:\s+(?:incorporated|inc|limited|ltd|llc|plc|corp|corporation))+$/u, "").trim();
  return { key, loose: loose || key };
}
export function canonicalJobUrl(raw: string) {
  if (!raw.trim()) return { url: null, posting: false, provider: null };
  const url = new URL(raw.trim());
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || /[\u0000-\u0020\u007f]/u.test(raw.trim())) throw Error("Use an HTTP(S) job URL without credentials or control characters.");
  if ([...url.searchParams.keys()].some(key=>/^(?:access_token|refresh_token|id_token|authorization|password|token)$/iu.test(key)) || /(?:access_token|refresh_token|id_token)=/iu.test(url.hash)) throw Error("Remove authentication secrets from the job URL before lookup.");
  const hashRoute = /^#[!/?]/u.test(url.hash);
  url.hash = "";
  const tracking = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "gclid", "fbclid", "msclkid"]);
  const parts=url.search.slice(1).split("&").filter(part=>{
    try{return !tracking.has(decodeURIComponent(part.split("=")[0]!.replace(/\+/gu," ")).toLowerCase());}catch{return true;}
  });
  url.search=parts.join("&");
  // Keep schemes, trailing slashes, parameter order and every unknown/job-bearing parameter distinct.
  const generic = /\/(?:search|jobs?|careers|positions?|requisitions?)\/?$/iu.test(url.pathname);
  const pathPosting = /\/(?:jobs?|positions?|requisitions?)\/(?!search(?:\/|$)|all(?:\/|$)|categories(?:\/|$))[^/]+/iu.test(url.pathname);
  const queryPosting = [...url.searchParams].some(([k,v]) => /^(?:gh_jid|jobid|job_id|jk|requisitionid)$/iu.test(k) && !!v.trim());
  return { url: url.href, posting: !hashRoute && (queryPosting || (!generic && pathPosting)), provider: url.hostname.toLowerCase() };
}
export function validateHistoryContext(input: unknown): ReviewedJobContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Supply reviewed job details.");
  const data = input as Record<string, unknown>;
  const limits: Record<keyof ReviewedJobContext,number> = { company: 200, title: 200, url: 2048, description: 204800, externalId: 300 };
  if (Object.keys(data).some(k => !Object.hasOwn(limits,k))) throw Error("Unknown job detail field.");
  for (const [key,max] of Object.entries(limits)) {
    if (typeof data[key] !== "string" || new TextEncoder().encode(data[key] as string).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(data[key] as string)) throw Error(`Invalid ${key}: use plain text up to ${max} UTF-8 bytes.`);
  }
  if (!(data.company as string).trim()) throw Error("Review and supply a company name before lookup.");
  canonicalJobUrl(data.url as string);
  return data as unknown as ReviewedJobContext;
}
export async function historyHash(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), v => v.toString(16).padStart(2,"0")).join("");
}
export async function identifyJob(context: ReviewedJobContext): Promise<HistoryIdentifiers> {
  const company = companyKeys(context.company), url = canonicalJobUrl(context.url);
  return { version: HISTORY_VERSION, companyKey: company.key, companyLooseKey: company.loose, canonicalUrl: url.url,
    urlHash: url.url ? await historyHash(url.url) : null, postingSpecific: url.posting,
    descriptionHash: context.description.trim() ? await historyHash(JSON.stringify([HISTORY_VERSION, company.key, normalizedText(context.title), normalizedText(context.description)])) : null,
    titleKey: normalizedText(context.title), externalId: context.externalId.trim() || null, provider: url.provider };
}
export function matchIdentifiers(query: HistoryIdentifiers, row: HistoryIdentifiers) {
  const evidence: HistoryMatch["evidence"] = [];
  const company = query.companyKey === row.companyKey;
  const similarCompany = !!query.companyLooseKey && query.companyLooseKey === row.companyLooseKey;
  if (!company && !similarCompany) return { company: false, exact: false, possible: false, evidence };
  evidence.push(company ? "company_key" : "company_name_similarity");
  const sameUrl = !!query.canonicalUrl && query.canonicalUrl === row.canonicalUrl;
  const changed = (!!query.titleKey && !!row.titleKey && query.titleKey !== row.titleKey) || (!!query.descriptionHash && !!row.descriptionHash && query.descriptionHash !== row.descriptionHash);
  const exact = company && sameUrl && query.postingSpecific && row.postingSpecific && !changed;
  if (sameUrl) evidence.push(exact ? "posting_url" : changed ? "url_reused_or_changed" : "generic_url");
  if (query.descriptionHash && query.descriptionHash === row.descriptionHash) evidence.push("description_fingerprint");
  if (query.titleKey && query.titleKey === row.titleKey) evidence.push("similar_title");
  // Existing bid external IDs have no reviewed provider contract. Never promote those IDs to strong matches.
  if (query.externalId && query.externalId === row.externalId && query.provider === row.provider) evidence.push("unverified_external_id");
  return { company, exact, possible: !exact && (!company || evidence.length > 1), evidence };
}
export async function classifyHistory(context: ReviewedJobContext, rows: HistoryRecord[]): Promise<HistoryMatches> {
  const query = await identifyJob(context); const result: HistoryMatches = { company: [], exact: [], possible: [] };
  for (const row of rows) {
    const ids = await identifyJob({ company: row.companyName, title: row.jobTitle, url: row.jobUrl ?? "", description: row.jobDescription, externalId: row.externalId ?? "" });
    const match = matchIdentifiers(query,ids);
    const item: HistoryMatch = { id: row.id, observationId:row.observationId??row.id,submissionId:row.submissionId??null, company: row.companyName, title: row.jobTitle, status: row.status, submittedAt: row.submittedAt, evidence: match.evidence };
    if (match.company) result.company.push(item);
    if (match.exact) result.exact.push(item);
    if (match.possible) result.possible.push(item);
  }
  return result;
}
