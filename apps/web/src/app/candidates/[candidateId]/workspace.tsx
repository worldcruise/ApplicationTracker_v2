"use client";
import { useEffect, useState } from "react";
import type { CandidateProfile, CandidateProfileInput, CandidateValidationIssue, OrganizationScope } from "@candidate/contracts";
import { candidateWarnings, editableProfile, mergeCandidateDraft, ProfileValidationFailure, validateCandidateProfile } from "@candidate/domain";
import { ClientApiFailure, readApi } from "@/app/workspace/requests";
import { ProfileFields, fieldLabels } from "../profile-fields";
import { button, primary, control } from "../directory";

type WorkspaceData = {
  bids: { id: string; companyName: string; jobTitle: string; status: string }[];
  interviews: { id: string; bidId: string; roundNumber: number; scheduledAt: string | null; lifecycleStatus: string }[];
  events: { id: string; action: string; actorId: string | null; createdAt: string }[];
  revisions: { revisionNumber: number; createdAt: string; changedBy: string | null }[];
  assignees: { id: string; displayName: string }[];
};
const tabs = ["overview", "profile", "resumes", "bids", "interviews", "activity"];
function valueText(value: unknown): string {
  if (value === null || value === "") return "Empty";
  if (Array.isArray(value)) return value.length ? value.map((row: Record<string, unknown>) => Object.entries(row).filter(([k]) => k !== "id").map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("; ") : v ?? "unknown"}`).join(" · ")).join("\n") : "No records";
  return String(value);
}
export function CandidateWorkspace({ profile: initial, scope, initialTab, directoryHref }: { profile: CandidateProfile; scope: OrganizationScope; initialTab: string; directoryHref: string }) {
  const [profile, setProfile] = useState(initial);
  const [draft, setDraft] = useState(() => editableProfile(initial));
  const [tab, setTab] = useState(tabs.includes(initialTab) ? initialTab : "overview");
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loadError, setLoadError] = useState(""); const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<CandidateValidationIssue[]>([]);
  const [conflicted, setConflicted] = useState(false);
  const [remote, setRemote] = useState<CandidateProfile | null>(null);
  const [choices, setChoices] = useState<Partial<Record<keyof CandidateProfileInput, "mine" | "current">>>({});
  const [history, setHistory] = useState<CandidateProfile | null>(null);
  const base = editableProfile(profile); const dirty = JSON.stringify(base) !== JSON.stringify(draft);
  const archived = profile.status === "archived";
  const manages = scope.role === "admin" || scope.teams.some(t => t.teamId === profile.owningTeamId && t.role === "team_leader");
  const path = `/api/v1/candidates/${profile.id}`; const query = `organizationId=${scope.organizationId}`;
  const warnings = candidateWarnings(draft);
  const merge = remote ? mergeCandidateDraft(base, draft, editableProfile(remote)) : null;
  useEffect(() => {
    let active = true;
    void readApi<WorkspaceData>(`${path}/workspace?${query}`).then(data => { if (active) { setWorkspace(data); setLoadError(""); } }, cause => {
      if (active) setLoadError(cause instanceof Error ? cause.message : "Related records could not be loaded.");
    });
    return () => { active = false; };
  }, [path, query, tick]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    const pop = () => { const t = new URL(location.href).searchParams.get("tab") ?? "overview"; setTab(tabs.includes(t) ? t : "overview"); };
    window.addEventListener("beforeunload", leave); window.addEventListener("popstate", pop);
    return () => { window.removeEventListener("beforeunload", leave); window.removeEventListener("popstate", pop); };
  }, [dirty]);
  function accept(next: CandidateProfile) { setProfile(next); setDraft(editableProfile(next)); setConflicted(false); setRemote(null); setChoices({}); setErrors([]); setTick(n => n + 1); }
  function fail(cause: unknown) {
    setMessage(cause instanceof Error ? cause.message : "The request failed. Your draft has been retained.");
    if (cause instanceof ClientApiFailure) {
      setErrors([...cause.fieldErrors]);
      if (cause.code === "VERSION_CONFLICT") { setConflicted(true); setRemote(null); setChoices({}); setMessage(`A newer profile is available${cause.currentVersion ? ` (version ${cause.currentVersion})` : ""}. Your draft is retained. Compare before saving again.`); }
    }
  }
  async function mutate(suffix: string, body: unknown, method = "POST") {
    setBusy(true); setMessage(""); setErrors([]);
    try {
      const result = await readApi<CandidateProfile>(`${path}${suffix}?${query}`, { method, headers: { "Content-Type": "application/json", "If-Match": JSON.stringify(String(profile.rowVersion)) }, body: JSON.stringify(body) });
      accept(result); setMessage("Saved to database.");
    } catch (cause) { fail(cause); } finally { setBusy(false); }
  }
  async function save() {
    setErrors([]); setMessage("");
    try { const validated = validateCandidateProfile(draft); await mutate("", validated.profile, "PATCH"); }
    catch (cause) { if (cause instanceof ProfileValidationFailure) { setErrors(cause.issues); setMessage(cause.message); } else fail(cause); }
  }
  return <div className="grid gap-5">
    <h2 className="text-2xl font-semibold">{profile.fullName ?? "Untitled draft"}</h2>
    <div className="flex flex-wrap items-center justify-between gap-3"><a className="underline" href={directoryHref} onClick={e => { if (dirty && !confirm("Leave this page and discard your unsaved draft?")) e.preventDefault(); }}>Candidate directory</a>
      <p className="text-sm">{profile.status} · Version <span data-testid="profile-version">{profile.rowVersion}</span> · {dirty ? "Unsaved changes" : "All changes saved"}</p></div>
    {archived && <p role="status" className="rounded border border-amber-400 bg-amber-50 p-3">Archived. Profile and assignments are read-only; history is retained.</p>}
    <nav aria-label="Candidate tabs" className="flex flex-wrap gap-2 border-b pb-3">{tabs.map(t => <button key={t} type="button" aria-current={tab === t ? "page" : undefined} className={tab === t ? primary : button} onClick={() => {
      setTab(t); const url = new URL(location.href); url.searchParams.set("tab", t); historyReplace(url);
    }}>{t[0]!.toUpperCase() + t.slice(1)}</button>)}</nav>
    {message && <p role={errors.length || conflicted ? "alert" : "status"} className="rounded border bg-white p-3">{message}</p>}
    {conflicted && <section aria-label="Resolve edit conflict" className="grid gap-3 rounded border border-amber-500 bg-amber-50 p-4">
      <h2 className="font-semibold">Resolve edit conflict</h2>
      {!remote && <button className={`${button} w-fit`} disabled={busy} onClick={async () => {
        setBusy(true); try { setRemote(await readApi<CandidateProfile>(`${path}?${query}`)); setChoices({}); } catch (cause) { fail(cause); } finally { setBusy(false); }
      }}>Compare with current profile</button>}
      {remote && merge && <><p>Database version {remote.rowVersion}. Unchanged fields merge automatically. Ordered sections are compared as a whole.</p>
        {remote.status === "archived" ? <p>The current record was archived. Copy any unsaved information you need before loading the current profile.</p> : <>
          {merge.conflicts.map(key => <fieldset key={key} className="rounded border p-3"><legend className="font-semibold">{fieldLabels[key]}</legend>
            <div className="grid gap-3 sm:grid-cols-2"><div><p className="font-medium">Your draft</p><p className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">{valueText(draft[key])}</p></div><div><p className="font-medium">Current database</p><p className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">{valueText(editableProfile(remote)[key])}</p></div></div>
            <label className="mr-4 inline-flex gap-2"><input type="radio" name={`resolve-${key}`} checked={choices[key] === "mine"} onChange={() => setChoices(c => ({ ...c, [key]: "mine" }))} />Keep my {fieldLabels[key].toLowerCase()}</label>
            <label className="inline-flex gap-2"><input type="radio" name={`resolve-${key}`} checked={choices[key] === "current"} onChange={() => setChoices(c => ({ ...c, [key]: "current" }))} />Use current {fieldLabels[key].toLowerCase()}</label>
          </fieldset>)}
          <button className={`${primary} w-fit`} disabled={busy || merge.conflicts.some(k => !choices[k])} onClick={() => {
            const merged = structuredClone(merge.merged); for (const key of merge.conflicts) Object.assign(merged, { [key]: choices[key] === "mine" ? draft[key] : editableProfile(remote)[key] });
            setProfile(remote); setDraft(merged); setRemote(null); setChoices({}); setConflicted(false); setMessage("Merged draft is ready for review. Save profile to persist it."); setErrors([]); setTick(n => n + 1);
          }}>Use merged draft</button>
        </>}
        <button className={`${button} w-fit`} disabled={busy} onClick={() => { if (!dirty || confirm("Discard your unsaved draft and load the current database profile?")) { accept(remote); setMessage("Current profile loaded."); } }}>Discard draft and load current</button>
      </>}
    </section>}
    {tab === "overview" && <section className="grid gap-4 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Overview</h2>
      <dl className="grid gap-2 sm:grid-cols-2">{(["fullName", "email", "phone", "location", "seniorityPreference"] as const).map(key => <div key={key}><dt className="text-xs text-slate-600">{fieldLabels[key]}</dt><dd>{profile[key] ?? "Not supplied"}</dd></div>)}</dl>
      <p className="whitespace-pre-wrap">{profile.professionalSummary ?? "No professional summary supplied."}</p>
      <div><h3 className="font-semibold">Professional links</h3>{profile.links.length ? <ul>{profile.links.map(l => <li key={l.id}><a className="underline" href={l.url} rel="noreferrer" target="_blank">{l.type}: {l.url}</a></li>)}</ul> : <p>No links supplied.</p>}</div>
      <div><h3 className="font-semibold">Ownership and assignments</h3><p>Owning team: {scope.teams.find(t => t.teamId === profile.owningTeamId)?.name ?? profile.owningTeamId}</p><p>Owner: {workspace?.assignees.find(p => p.id === profile.ownerId)?.displayName ?? profile.ownerId ?? "No owner"}</p>
        <ul className="my-3 grid gap-2">{profile.assignments.filter(a => !a.endedAt).map(a => <li key={a.id} className="flex items-center gap-3">{workspace?.assignees.find(p => p.id === a.userId)?.displayName ?? a.userId}
          {manages && <button className={button} disabled={busy || dirty || archived || conflicted} onClick={() => { if (confirm("End this assignment? The member will lose assignment-based access.")) void mutate("/assignments", { userId: a.userId, assign: false }); }}>End assignment</button>}</li>)}</ul>
        {!profile.assignments.some(a => !a.endedAt) && <p>No active assignments.</p>}
        {manages && <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void mutate("/assignments", { userId: form.get("userId"), assign: true }); }}>
          <label className="text-sm">Assign team member<select name="userId" className={control} required disabled={busy || dirty || archived || conflicted || !workspace} defaultValue=""><option value="" disabled>Choose active member</option>{workspace?.assignees.filter(p => !profile.assignments.some(a => a.userId === p.id && !a.endedAt)).map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label>
          <button className={button} disabled={busy || dirty || archived || conflicted || !workspace}>Assign member</button>
        </form>}
      </div>
      <div className="mt-3 border-t pt-4"><button className={button} disabled={busy || dirty || conflicted} onClick={() => {
        if (confirm(archived ? "Restore this candidate to its previous profile status?" : "Archive this candidate? Editing and new preparation will be disabled; all history will be retained.")) void mutate("/archive", { archived: !archived });
      }}>{archived ? "Restore candidate" : "Archive candidate"}</button><p className="mt-1 text-xs">Save or discard profile edits before changing assignments or archive state.</p></div>
    </section>}
    {tab === "profile" && <section className="rounded border bg-white p-5"><h2 className="mb-4 text-xl font-semibold">Profile</h2>
      {errors.length > 0 && <div role="alert" className="mb-4 rounded border border-red-400 p-3"><p>Check these fields:</p><ul>{errors.map((e, i) => <li key={i}><a className="underline" href={`#field-${e.path}`}>{e.path}: {e.message}</a></li>)}</ul></div>}
      <form onSubmit={e => { e.preventDefault(); void save(); }}>
        <ProfileFields value={draft} onChange={setDraft} errors={errors} disabled={busy || archived || conflicted} />
        <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 rounded border bg-white p-3"><button className={primary} disabled={busy || archived || conflicted || !dirty}>{busy ? "Saving…" : "Save profile"}</button>
          <button type="button" className={button} disabled={busy || !dirty} onClick={() => { if (confirm("Discard your unsaved changes?")) { setDraft(editableProfile(profile)); setErrors([]); setMessage(""); } }}>Discard changes</button><span className="text-xs">{dirty ? "Unsaved draft in this page" : "Saved to database"}</span></div>
      </form>
      {warnings.length > 0 && <aside className="mt-4 text-sm"><h3 className="font-semibold">Profile review</h3><ul className="list-inside list-disc">{warnings.map((w, i) => <li key={i}>{w.path}: {w.message}</li>)}</ul></aside>}
      {profile.experiences.some(e => e.proposedDisplayTitle || e.approvedDisplayTitle) && <section className="mt-5 grid gap-3 border-t pt-4"><h3 className="font-semibold">Display title approvals</h3>{profile.experiences.filter(e => e.proposedDisplayTitle || e.approvedDisplayTitle).map(e => <article key={e.id} className="rounded border p-3"><p>Official: {e.officialTitle ?? "Unknown"}</p><p>Proposed: {e.proposedDisplayTitle ?? "None"}</p><p>Approved: {e.approvedDisplayTitle ?? "Not approved"}</p>{e.titleApprovedAt && <p className="text-xs">Approved {new Date(e.titleApprovedAt).toLocaleString()}</p>}
        {manages && e.titlePolicy === "tailorable" && e.proposedDisplayTitle && !e.approvedDisplayTitle && <button className={`${button} mt-2`} disabled={busy || dirty || archived || conflicted || !e.officialTitle} onClick={() => void mutate("/title-approvals", { experienceId: e.id })}>Approve display title</button>}</article>)}</section>}
    </section>}
    {loadError && <p role="alert">{loadError} <button className="underline" onClick={() => setTick(n => n + 1)}>Retry related records</button></p>}
    {["resumes", "bids", "interviews", "activity"].includes(tab) && !workspace && !loadError && <p role="status">Loading related records…</p>}
    {tab === "resumes" && workspace && <section className="rounded border bg-white p-5"><h2 className="text-xl font-semibold">Resumes</h2><p>Resume version storage and candidate document workflows are not implemented yet. This tab cannot report document history until those migrations are available.</p><p className="mt-2 text-sm">Profile revisions are preserved under Activity. They are separate from immutable resume versions and submissions.</p></section>}
    {tab === "bids" && workspace && <section className="rounded border bg-white p-5"><h2 className="text-xl font-semibold">Bids</h2><p className="mb-3 text-sm">Most recent 100 authorized bid records. Full bid editing and submission are separate build-plan tasks.</p>{workspace.bids.length ? <ul className="grid gap-3">{workspace.bids.map(b => <li className="rounded border p-3" key={b.id}><p className="font-medium">{b.companyName} · {b.jobTitle}</p><p>{b.status}</p></li>)}</ul> : <p>No authorized bid records found.</p>}</section>}
    {tab === "interviews" && workspace && <section className="rounded border bg-white p-5"><h2 className="text-xl font-semibold">Interviews</h2><p className="mb-3 text-sm">Up to 100 authorized rounds for the displayed bids. Interview editing and feedback workflows remain separate tasks.</p>{workspace.interviews.length ? <ul className="grid gap-3">{workspace.interviews.map(i => <li className="rounded border p-3" key={i.id}><p>{workspace.bids.find(b => b.id === i.bidId)?.companyName} · Round {i.roundNumber}</p><p>{i.lifecycleStatus} · {i.scheduledAt ? new Date(i.scheduledAt).toLocaleString() : "Not scheduled"}</p></li>)}</ul> : <p>No authorized interview rounds found.</p>}</section>}
    {tab === "activity" && workspace && <section className="grid gap-4 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Activity</h2><p className="text-sm">Most recent 50 events and profile revisions. Historical snapshots remain unchanged by subsequent edits.</p>
      <h3 className="font-semibold">Profile revisions</h3><ul className="grid gap-2">{workspace.revisions.map(r => <li key={r.revisionNumber} className="flex flex-wrap items-center gap-3"><span>Version {r.revisionNumber} · {new Date(r.createdAt).toLocaleString()}{!r.changedBy && " · imported baseline"}</span><button className={button} disabled={busy} onClick={async () => {
        setBusy(true); try { setHistory(await readApi<CandidateProfile>(`${path}/revisions/${r.revisionNumber}?${query}`)); } catch (cause) { fail(cause); } finally { setBusy(false); }
      }}>View version {r.revisionNumber}</button></li>)}</ul>
      {history && <section aria-label="Historical profile" className="rounded border p-4"><h3 className="mb-3 font-semibold">Historical version {history.rowVersion} · {history.status} · Read-only</h3><ProfileFields value={editableProfile(history)} onChange={() => {}} disabled /><button className={`${button} mt-3`} onClick={() => setHistory(null)}>Close historical profile</button></section>}
      <h3 className="font-semibold">Audit events</h3><ul className="grid gap-2 text-sm">{workspace.events.map(e => <li key={e.id}>{e.action} · {new Date(e.createdAt).toLocaleString()}</li>)}</ul>
    </section>}
  </div>;
}
function historyReplace(url: URL) { window.history.replaceState(null, "", url); }
