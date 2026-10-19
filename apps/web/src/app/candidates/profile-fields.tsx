"use client";
import type { ReactNode } from "react";
import type { CandidateProfileInput, CandidateValidationIssue, WorkExperience, Education, Certification, ProfessionalLink } from "@candidate/contracts";
import { emptyExperience, emptyEducation, emptyCertification } from "@candidate/domain";
import { button, control } from "./directory";

export const fieldLabels: Record<keyof CandidateProfileInput, string> = {
  fullName: "Full name", email: "Email", phone: "Phone", location: "Location", seniorityPreference: "Seniority preference",
  professionalSummary: "Professional summary", privateNotes: "Private notes", status: "Profile status", links: "Professional links",
  experiences: "Work experience", educations: "Education", certifications: "Certifications",
};
export function TextField({ path, label, value, onChange, multiline = false, hint, errors = [] }: {
  path: string; label: string; value: string | null; onChange: (value: string | null) => void; multiline?: boolean; hint?: string | undefined; errors?: CandidateValidationIssue[];
}) {
  const issues = errors.filter(e => e.path === path); const id = `field-${path}`;
  const props = { id, value: value ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value || null),
    className: control, "aria-invalid": issues.length > 0, "aria-describedby": `${id}-help` };
  return <div><label htmlFor={id} className="block text-sm font-medium">{label}</label>
    {multiline ? <textarea {...props} rows={3} maxLength={path === "privateNotes" || path === "professionalSummary" ? 8000 : undefined} /> : <input {...props} maxLength={path === "email" ? 320 : path === "phone" ? 40 : path.endsWith("url") ? 2048 : path === "location" ? 500 : 200} />}
    <div id={`${id}-help`} className="text-xs text-slate-600">{hint}{issues.map((e, i) => <p key={i} className="text-red-800">{e.message}</p>)}</div>
  </div>;
}
function SelectField({ path, label, value, values, onChange }: { path: string; label: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <div><label htmlFor={`field-${path}`} className="block text-sm font-medium">{label}</label><select id={`field-${path}`} className={control} value={value} onChange={e => onChange(e.target.value)}>{values.map(v => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></div>;
}
function Records<T extends { id: string }>({ title, rows, setRows, create, children }: { title: string; rows: T[]; setRows: (rows: T[]) => void; create: () => T; children: (row: T, i: number) => ReactNode }) {
  function move(i: number, delta: number) { const updated = [...rows]; [updated[i], updated[i + delta]] = [updated[i + delta]!, updated[i]!]; setRows(updated); }
  return <section className="grid gap-3 rounded border p-4" aria-label={title}>
    <h3 className="text-lg font-semibold">{title}</h3>{rows.length === 0 && <p className="text-sm">No records added.</p>}
    {rows.map((row, i) => <fieldset key={row.id} className="grid gap-3 rounded border bg-slate-50 p-4">
      <legend className="text-sm font-semibold">{title} {i + 1}</legend>{children(row, i)}
      <div className="flex flex-wrap gap-2"><button className={button} type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${title} ${i + 1} up`}>Move up</button>
        <button className={button} type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${title} ${i + 1} down`}>Move down</button>
        <button className={button} type="button" onClick={() => { if (confirm(`Remove ${title.toLowerCase()} ${i + 1} from this draft? Saved history will be retained.`)) setRows(rows.filter(r => r.id !== row.id)); }}>Remove</button></div>
    </fieldset>)}
    <button className={`${button} w-fit`} type="button" disabled={rows.length >= 100} onClick={() => setRows([...rows, create()])}>Add {title.toLowerCase()}</button>
  </section>;
}
const dateHint = "Known precision only: YYYY, YYYY-MM or YYYY-MM-DD; leave unknown dates empty.";
const policies = ["fixed", "tailorable", "omit"];
export function ProfileFields({ value, onChange, errors = [], disabled = false }: {
  value: CandidateProfileInput; onChange: (value: CandidateProfileInput) => void; errors?: CandidateValidationIssue[]; disabled?: boolean;
}) {
  const set = <K extends keyof CandidateProfileInput>(key: K, next: CandidateProfileInput[K]) => onChange({ ...value, [key]: next });
  const text = <T,>(row: T, key: keyof T, path: string, label: string, update: (row: T) => void, multiline = false, hint?: string) =>
    <TextField key={String(key)} path={path} label={label} value={row[key] as string | null} onChange={v => update({ ...row, [key]: v })} multiline={multiline} hint={hint} errors={errors} />;
  return <fieldset disabled={disabled} className="grid gap-6">
    <section className="grid gap-3 rounded border p-4"><h3 className="text-lg font-semibold">Personal information</h3>
      <p className="text-sm">Drafts may be incomplete. Ready requires full name, email, phone and location. Other missing facts remain visible as warnings.</p>
      <div className="grid gap-3 sm:grid-cols-2">{(["fullName", "email", "phone", "location", "seniorityPreference"] as const).map(key => <TextField key={key} path={key} label={fieldLabels[key]} value={value[key]} onChange={v => set(key, v)} errors={errors} />)}
        <SelectField path="status" label="Profile status" value={value.status} values={["draft", "ready"]} onChange={v => set("status", v as "draft" | "ready")} />
      </div>
      <TextField path="professionalSummary" label="Professional summary" value={value.professionalSummary} onChange={v => set("professionalSummary", v)} multiline errors={errors} />
      <TextField path="privateNotes" label="Private notes" hint="Visible to authorized profile users; excluded from the bidder projection." value={value.privateNotes} onChange={v => set("privateNotes", v)} multiline errors={errors} />
    </section>
    <Records<ProfessionalLink> title="Professional links" rows={value.links} setRows={v => set("links", v)} create={() => ({ id: crypto.randomUUID(), type: "website", url: "" })}>{(row, i) => {
      const update = (v: ProfessionalLink) => set("links", value.links.map(r => r.id === row.id ? v : r));
      return <><SelectField path={`links.${i}.type`} label="Link type" value={row.type} values={["linkedin", "github", "website", "portfolio", "other"]} onChange={v => update({ ...row, type: v as ProfessionalLink["type"] })} />
        <TextField path={`links.${i}.url`} label="URL" value={row.url} onChange={v => update({ ...row, url: v ?? "" })} hint="Full http:// or https:// URL, without credentials." errors={errors} /></>;
    }}</Records>
    <Records<WorkExperience> title="Work experience" rows={value.experiences} setRows={v => set("experiences", v)} create={emptyExperience}>{(row, i) => {
      const prefix = `experiences.${i}`; const update = (v: WorkExperience) => set("experiences", value.experiences.map(r => r.id === row.id ? v : r));
      return <><div className="grid gap-3 sm:grid-cols-2">{(["company", "officialTitle", "location"] as const).map(key => text(row, key, `${prefix}.${key}`, key === "officialTitle" ? "Official historical job title" : key === "company" ? "Company" : "Work location", update))}</div>
        <p className="text-xs">Keep the official title as supplied in employment history. Propose a separate presentation title; approval never changes the official title.</p>
        {text(row, "proposedDisplayTitle", `${prefix}.proposedDisplayTitle`, "Proposed display title", update)}
        <SelectField path={`${prefix}.titlePolicy`} label="Title policy" value={row.titlePolicy} values={policies} onChange={v => update({ ...row, titlePolicy: v as WorkExperience["titlePolicy"] })} />
        <div className="grid gap-3 sm:grid-cols-2">{text(row, "startDate", `${prefix}.startDate`, "Employment start date", update, false, dateHint)}{text(row, "endDate", `${prefix}.endDate`, "Employment end date", update, false, dateHint)}</div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={row.current} onChange={e => update({ ...row, current: e.target.checked })} />Currently employed here (clear end date)</label>
        <TextField path={`${prefix}.sourceBullets`} label="Source bullets" value={row.sourceBullets.join("\n")} onChange={v => update({ ...row, sourceBullets: v?.split("\n") ?? [] })} multiline hint="One fact per line. Preserve source facts; do not invent claims." errors={errors} />
        <TextField path={`${prefix}.achievements`} label="Verified achievements" value={row.achievements.join("\n")} onChange={v => update({ ...row, achievements: v?.split("\n") ?? [] })} multiline hint="One verified achievement per line." errors={errors} />
        <label className="text-sm">Preferred bullet count (optional)<input className={control} type="number" min={1} max={30} value={row.preferredBulletCount ?? ""} onChange={e => update({ ...row, preferredBulletCount: e.target.value ? Number(e.target.value) : null })} /></label>
      </>;
    }}</Records>
    <Records<Education> title="Education" rows={value.educations} setRows={v => set("educations", v)} create={emptyEducation}>{(row, i) => {
      const prefix = `educations.${i}`; const update = (v: Education) => set("educations", value.educations.map(r => r.id === row.id ? v : r));
      return <>{(["institution", "degree", "fieldOfStudy"] as const).map(key => text(row, key, `${prefix}.${key}`, key === "fieldOfStudy" ? "Major / field of study" : key === "degree" ? "Degree" : "Institution", update))}
        <div className="grid gap-3 sm:grid-cols-2">{text(row, "startDate", `${prefix}.startDate`, "Education start date", update, false, dateHint)}{text(row, "endDate", `${prefix}.endDate`, "Education end date", update, false, dateHint)}</div>
        <SelectField path={`${prefix}.displayPolicy`} label="Education display policy" value={row.displayPolicy} values={policies} onChange={v => update({ ...row, displayPolicy: v as Education["displayPolicy"] })} />
      </>;
    }}</Records>
    <Records<Certification> title="Certifications" rows={value.certifications} setRows={v => set("certifications", v)} create={emptyCertification}>{(row, i) => {
      const prefix = `certifications.${i}`; const update = (v: Certification) => set("certifications", value.certifications.map(r => r.id === row.id ? v : r));
      return <>{(["name", "issuer", "credentialId"] as const).map(key => text(row, key, `${prefix}.${key}`, key === "credentialId" ? "Credential ID" : key === "name" ? "Certification name" : "Issuer", update))}
        <div className="grid gap-3 sm:grid-cols-2">{text(row, "issueDate", `${prefix}.issueDate`, "Issue date", update, false, dateHint)}{text(row, "expiryDate", `${prefix}.expiryDate`, "Expiry date", update, false, dateHint)}</div>
        <SelectField path={`${prefix}.verificationStatus`} label="Verification status" value={row.verificationStatus} values={["unverified", "verified", "expired"]} onChange={v => update({ ...row, verificationStatus: v as Certification["verificationStatus"] })} />
      </>;
    }}</Records>
  </fieldset>;
}
