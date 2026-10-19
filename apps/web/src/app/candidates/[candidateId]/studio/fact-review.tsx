"use client";
import type { CandidateProfile, ResumeContentV1, ResumeReview, ResumeReviewInput } from "@candidate/contracts";
import { resumeEvidence } from "@candidate/domain";
import { control } from "../../directory";
export function FactReview({ content, snapshot, review, value, onChange, disabled }: { content: ResumeContentV1; snapshot: CandidateProfile; review: ResumeReview; value: ResumeReviewInput; onChange: (value: ResumeReviewInput) => void; disabled: boolean }) {
  const evidence = resumeEvidence(snapshot);
  return <section className="grid gap-3 rounded border bg-white p-4"><h2 className="text-lg font-semibold">Factual review</h2>
    <p className="text-sm">Map to verified records. Check the original evidence before attesting a paraphrase. Unsupported facts must enter the verified profile first. Review here does not approve an application submission.</p>
    <p className="font-medium" data-testid="factual-status">{review.reviewed ? "Facts reviewed against the frozen profile" : "Unverified — unresolved claims or conflicts remain"}</p>
    <fieldset disabled={disabled} className="grid gap-3">
      {content.experience.map((entry, i) => <div className="rounded border p-3" key={i}><p className="text-sm">JSON: {entry.title} · {entry.company}</p><label htmlFor={`map-work-${i}`} className="text-sm font-medium">Verified work record {i + 1}</label>
        <select id={`map-work-${i}`} className={control} value={value.experienceIds[i] ?? ""} onChange={e => { const ids = [...value.experienceIds]; ids[i] = e.target.value || null; onChange({ ...value, experienceIds: ids, claims: {} }); }}><option value="">Choose source record</option>{snapshot.experiences.map(w => <option key={w.id} value={w.id}>{w.company ?? "Unknown"} · {w.officialTitle ?? "Unknown"} · {w.startDate ?? "Unknown period"}</option>)}</select>
      </div>)}
      {content.education.map((entry, i) => <div className="rounded border p-3" key={i}><p className="text-sm">JSON: {entry.degree}</p><label htmlFor={`map-edu-${i}`} className="text-sm font-medium">Verified education record {i + 1}</label>
        <select id={`map-edu-${i}`} className={control} value={value.educationIds[i] ?? ""} onChange={e => { const ids = [...value.educationIds]; ids[i] = e.target.value || null; onChange({ ...value, educationIds: ids }); }}><option value="">Choose source record</option>{snapshot.educations.map(w => <option key={w.id} value={w.id}>{w.degree ?? "Unknown"} · {w.fieldOfStudy} · {w.institution}</option>)}</select>
      </div>)}
      {review.conflicts.map((c, i) => <p role="alert" className="text-sm text-red-800" key={i}>{c.path}: {c.message}</p>)}
      {review.claims.map(c => {
        const selected = value.claims[c.path] ?? { sources: [], attested: false }; const allowed = evidence.filter(e => !c.workId || e.id.startsWith(`work:${c.workId}:`));
        return <details key={c.path} open={!c.resolved} className="rounded border p-3"><summary className="cursor-pointer text-sm font-medium">{c.path} · {c.automatic ? "Exact verified text" : c.resolved ? "Human reviewed" : "Review required"}</summary>
          <p className="my-2 whitespace-pre-wrap text-sm">{c.text}</p>{!c.automatic && <><label className="text-sm" htmlFor={`evidence-${c.path}`}>Supporting frozen facts for {c.path}</label>
            <select id={`evidence-${c.path}`} className={`${control} min-h-28`} multiple value={selected.sources} onChange={e => onChange({ ...value, claims: { ...value.claims, [c.path]: { sources: [...e.target.selectedOptions].map(o => o.value), attested: false } } })}>{allowed.map(e => <option key={e.id} value={e.id}>{e.label}: {e.text}</option>)}</select>
            <ul className="my-2 grid gap-2 text-xs">{allowed.filter(e => selected.sources.includes(e.id)).map(e => <li key={e.id} className="rounded bg-slate-50 p-2"><strong>{e.label}</strong><p className="whitespace-pre-wrap">{e.text}</p></li>)}</ul>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={selected.attested} disabled={!selected.sources.length} onChange={e => onChange({ ...value, claims: { ...value.claims, [c.path]: { ...selected, attested: e.target.checked } } })} />I checked that this paraphrase is supported by these facts ({c.path})</label></>}
          {c.issues.map((issue, i) => <p key={i} className="mt-1 text-xs text-red-800">{issue}</p>)}
        </details>;
      })}
    </fieldset>
  </section>;
}
