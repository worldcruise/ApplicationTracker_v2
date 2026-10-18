import type { CandidateProfile, CandidateProfileInput, CandidateValidationIssue, WorkExperience, Education, Certification, ProfessionalLink } from "@candidate/contracts";

export class ProfileValidationFailure extends Error {
  constructor(public issues: CandidateValidationIssue[]) { super("Check the highlighted profile fields."); }
}
export function emptyCandidateProfile(): CandidateProfileInput {
  return { fullName: null, email: null, phone: null, location: null, seniorityPreference: null,
    professionalSummary: null, privateNotes: null, status: "draft", links: [], experiences: [], educations: [], certifications: [] };
}
export const emptyExperience = (): WorkExperience => ({ id: crypto.randomUUID(), company: null, officialTitle: null,
  proposedDisplayTitle: null, titlePolicy: "fixed", startDate: null, endDate: null, current: false,
  location: null, sourceBullets: [], achievements: [], preferredBulletCount: null });
export const emptyEducation = (): Education => ({ id: crypto.randomUUID(), institution: null, degree: null,
  fieldOfStudy: null, startDate: null, endDate: null, displayPolicy: "fixed" });
export const emptyCertification = (): Certification => ({ id: crypto.randomUUID(), name: null, issuer: null,
  issueDate: null, expiryDate: null, verificationStatus: "unverified", credentialId: null });

export function editableProfile(profile: CandidateProfile): CandidateProfileInput {
  return { fullName: profile.fullName, email: profile.email, phone: profile.phone, location: profile.location,
    seniorityPreference: profile.seniorityPreference, professionalSummary: profile.professionalSummary, privateNotes: profile.privateNotes,
    status: profile.status === "ready" ? "ready" : "draft", links: profile.links, educations: profile.educations, certifications: profile.certifications,
    experiences: profile.experiences.map(({ approvedDisplayTitle: _title, titleApprovedBy: _by, titleApprovedAt: _at, ...input }) => {
      void _title; void _by; void _at; return input;
    }) };
}

export function partialDateRange(value: string): { start: number; end: number } | null {
  if (!/^[0-9]{4}(-[0-9]{2})?(-[0-9]{2})?$/.test(value)) return null;
  const [year, month = 1, day = 1] = value.split("-").map(Number);
  if (!year || year < 1 || year > 9999) return null;
  const date = new Date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  const end = new Date(date);
  const precision = value.split("-").length;
  if (precision === 1) end.setUTCFullYear(year + 1);
  else if (precision === 2) end.setUTCMonth(month);
  else end.setUTCDate(day + 1);
  return { start: date.getTime(), end: end.getTime() };
}

export function validateCandidateProfile(value: unknown): { profile: CandidateProfileInput; warnings: CandidateValidationIssue[] } {
  const errors: CandidateValidationIssue[] = [];
  const issue = (path: string, message: string) => { errors.push({ path, message }); };
  function object(v: unknown, path: string, keys: string[]): Record<string, unknown> {
    if (!v || typeof v !== "object" || Array.isArray(v)) { issue(path, "Supply an object."); return {}; }
    const o = v as Record<string, unknown>;
    if (Object.keys(o).some(k => !keys.includes(k))) issue(path, "Unknown fields are not permitted.");
    for (const key of keys) if (!Object.hasOwn(o, key)) issue(path ? `${path}.${key}` : key, "This field must be present; unknown text may be null.");
    return o;
  }
  function text(v: unknown, path: string, max = 200): string | null {
    if (v === null) return null;
    if (typeof v !== "string" || v.length > max) { issue(path, `Use text up to ${max} characters or leave it empty.`); return null; }
    return v.trim() || null;
  }
  function choice<T extends string>(v: unknown, path: string, values: readonly T[]): T {
    if (typeof v !== "string" || !values.includes(v as T)) issue(path, "Choose a supported value.");
    return (values.includes(v as T) ? v : values[0]) as T;
  }
  function rows(v: unknown, path: string): Record<string, unknown>[] {
    if (!Array.isArray(v) || v.length > 100) { issue(path, "Use at most 100 records."); return []; }
    const seen = new Set<string>();
    return v.map((item, i) => {
      const o = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
      if (typeof o.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id) || seen.has(String(o.id))) {
        issue(`${path}.${i}.id`, "Use a distinct valid record identifier.");
      }
      seen.add(String(o.id)); return o;
    });
  }
  function period(o: Record<string, unknown>, path: string, first: string, last: string) {
    const start = text(o[first], `${path}.${first}`, 10), end = text(o[last], `${path}.${last}`, 10);
    const a = start ? partialDateRange(start) : null, b = end ? partialDateRange(end) : null;
    if (start && !a) issue(`${path}.${first}`, "Use a real YYYY, YYYY-MM or YYYY-MM-DD date.");
    if (end && !b) issue(`${path}.${last}`, "Use a real YYYY, YYYY-MM or YYYY-MM-DD date.");
    if (a && b && a.start >= b.end) issue(`${path}.${last}`, "The end must not precede the start.");
    return { start, end };
  }
  function bullets(v: unknown, path: string): string[] {
    if (!Array.isArray(v) || v.length > 100) { issue(path, "Use at most 100 text entries."); return []; }
    return v.map((s, i) => text(s, `${path}.${i}`, 4000) ?? "").filter(Boolean);
  }
  const o = object(value, "", Object.keys(emptyCandidateProfile()));
  const profile: CandidateProfileInput = { ...emptyCandidateProfile(),
    fullName: text(o.fullName, "fullName"), email: text(o.email, "email", 320), phone: text(o.phone, "phone", 40),
    location: text(o.location, "location", 500), seniorityPreference: text(o.seniorityPreference, "seniorityPreference"),
    professionalSummary: text(o.professionalSummary, "professionalSummary", 8000), privateNotes: text(o.privateNotes, "privateNotes", 8000),
    status: choice(o.status, "status", ["draft", "ready"]),
  };
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) issue("email", "Supply a valid email address.");
  if (profile.phone && (!/^[+0-9(). xXeEtT-]+$/.test(profile.phone) || !/^\d{7,20}$/.test(profile.phone.replace(/\D/g, "")))) issue("phone", "Use a phone number with 7–20 digits and optional formatting or extension.");
  if (profile.status === "ready") for (const key of ["fullName", "email", "phone", "location"] as const) if (!profile[key]) issue(key, "Required for Ready. Keep an incomplete profile as Draft.");
  const policies = ["fixed", "tailorable", "omit"] as const;
  profile.links = rows(o.links, "links").map((v, i): ProfessionalLink => {
    const path = `links.${i}`; object(v, path, ["id", "type", "url"]);
    let url = text(v.url, `${path}.url`, 2048) ?? "";
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
      url = parsed.href;
    } catch { issue(`${path}.url`, "Use an http or https URL without embedded credentials."); }
    return { id: String(v.id), type: choice(v.type, `${path}.type`, ["linkedin", "github", "website", "portfolio", "other"]), url };
  });
  profile.experiences = rows(o.experiences, "experiences").map((v, i): WorkExperience => {
    const path = `experiences.${i}`; object(v, path, Object.keys(emptyExperience()));
    const dates = period(v, path, "startDate", "endDate");
    if (typeof v.current !== "boolean") issue(`${path}.current`, "Choose current or historical employment.");
    if (v.current && dates.end) issue(`${path}.endDate`, "A current role cannot have an end date.");
    if (v.preferredBulletCount !== null && (!Number.isInteger(v.preferredBulletCount) || Number(v.preferredBulletCount) < 1 || Number(v.preferredBulletCount) > 30)) issue(`${path}.preferredBulletCount`, "Use a whole number from 1 to 30 or leave unknown.");
    return { id: String(v.id), company: text(v.company, `${path}.company`), officialTitle: text(v.officialTitle, `${path}.officialTitle`),
      proposedDisplayTitle: text(v.proposedDisplayTitle, `${path}.proposedDisplayTitle`), titlePolicy: choice(v.titlePolicy, `${path}.titlePolicy`, policies),
      startDate: dates.start, endDate: dates.end, current: v.current === true, location: text(v.location, `${path}.location`, 500),
      sourceBullets: bullets(v.sourceBullets, `${path}.sourceBullets`), achievements: bullets(v.achievements, `${path}.achievements`),
      preferredBulletCount: v.preferredBulletCount === null ? null : Number(v.preferredBulletCount) };
  });
  profile.educations = rows(o.educations, "educations").map((v, i): Education => {
    const path = `educations.${i}`; object(v, path, Object.keys(emptyEducation()));
    const dates = period(v, path, "startDate", "endDate");
    return { id: String(v.id), institution: text(v.institution, `${path}.institution`), degree: text(v.degree, `${path}.degree`),
      fieldOfStudy: text(v.fieldOfStudy, `${path}.fieldOfStudy`), startDate: dates.start, endDate: dates.end, displayPolicy: choice(v.displayPolicy, `${path}.displayPolicy`, policies) };
  });
  profile.certifications = rows(o.certifications, "certifications").map((v, i): Certification => {
    const path = `certifications.${i}`; object(v, path, Object.keys(emptyCertification()));
    const dates = period(v, path, "issueDate", "expiryDate");
    return { id: String(v.id), name: text(v.name, `${path}.name`), issuer: text(v.issuer, `${path}.issuer`), issueDate: dates.start, expiryDate: dates.end,
      verificationStatus: choice(v.verificationStatus, `${path}.verificationStatus`, ["unverified", "verified", "expired"]), credentialId: text(v.credentialId, `${path}.credentialId`) };
  });
  if (errors.length) throw new ProfileValidationFailure(errors);
  return { profile, warnings: candidateWarnings(profile) };
}

export function candidateWarnings(profile: CandidateProfileInput): CandidateValidationIssue[] {
  const result: CandidateValidationIssue[] = [];
  if (profile.status === "draft") for (const key of ["fullName", "email", "phone", "location"] as const) {
    if (!profile[key]) result.push({ path: key, message: "Missing for Ready; allowed in Draft." });
  }
  profile.experiences.forEach((row, i) => {
    if (!row.company || !row.officialTitle) result.push({ path: `experiences.${i}`, message: "Incomplete employment facts; fill them before using this record in a resume." });
    if (row.titlePolicy === "tailorable" && row.proposedDisplayTitle) result.push({ path: `experiences.${i}.proposedDisplayTitle`, message: "Display variants require explicit approval; official history is retained." });
    const a = row.startDate ? partialDateRange(row.startDate) : null;
    const end = row.current ? Infinity : row.endDate ? partialDateRange(row.endDate)?.end : null;
    if (!a || !end) return;
    profile.experiences.slice(0, i).forEach((other, j) => {
      const b = other.startDate ? partialDateRange(other.startDate) : null;
      const otherEnd = other.current ? Infinity : other.endDate ? partialDateRange(other.endDate)?.end : null;
      if (b && otherEnd && a.start < otherEnd && b.start < end) result.push({ path: `experiences.${i}`, message: `Employment may overlap entry ${j + 1}; review the supplied date precision.` });
    });
  });
  return result;
}

