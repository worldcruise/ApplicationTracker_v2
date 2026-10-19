"use client";
import Link from "next/link";
import { useState } from "react";
import type { CandidateDirectory, CandidateProfile, OrganizationScope } from "@candidate/contracts";
import { emptyCandidateProfile } from "@candidate/domain";
import { readApi } from "@/app/workspace/requests";

export const control = "w-full rounded border border-slate-300 bg-white p-2 text-sm";
export const button = "rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50";
export const primary = "rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50";
type Props = {
  directory: CandidateDirectory; scope: OrganizationScope; query: string;
  teams: { id: string; name: string }[]; people: { id: string; displayName: string }[];
  memberships: { userId: string; role: string }[]; teamMemberships: { userId: string; teamId: string }[];
  organizations: readonly OrganizationScope[];
};
export function CandidateDirectoryView({ directory, scope, query, teams, people, memberships, teamMemberships, organizations }: Props) {
  const params = new URLSearchParams(query); params.set("organizationId", scope.organizationId);
  const managed = teams.filter(t => scope.role === "admin" || scope.teams.some(s => s.teamId === t.id && s.role === "team_leader"));
  const [team, setTeam] = useState(managed[0]?.id ?? "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const eligible = people.filter(p => memberships.some(m => m.userId === p.id &&
    (m.role === "admin" || teamMemberships.some(t => t.userId === p.id && t.teamId === team))));
  function pageLink(page: number) { const p = new URLSearchParams(params); p.set("page", String(page)); return `/candidates?${p}`; }
  return <div className="grid gap-6">
    <nav><Link className="underline" href="/workspace">Workspace and account</Link></nav>
    <form action="/candidates" className="grid gap-3 rounded border bg-white p-4 sm:grid-cols-3" aria-label="Directory filters">
      <label>Organization<select aria-label="Organization" name="organizationId" className={control} defaultValue={scope.organizationId}>{organizations.map(o => <option key={o.organizationId} value={o.organizationId}>{o.name}</option>)}</select></label>
      <label>Search<input name="q" className={control} defaultValue={params.get("q") ?? ""} placeholder="Name, email or location" maxLength={200} /></label>
      <label>Status<select aria-label="Status" name="status" className={control} defaultValue={params.get("status") ?? "active"}>{["active", "draft", "ready", "archived", "all"].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <label>Team<select aria-label="Team" name="teamId" className={control} defaultValue={params.get("teamId") ?? ""}><option value="">All visible teams</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Owner<select aria-label="Owner" name="ownerId" className={control} defaultValue={params.get("ownerId") ?? ""}><option value="">Any owner</option>{people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label>
      <label>Assigned member<select aria-label="Assigned member" name="assigneeId" className={control} defaultValue={params.get("assigneeId") ?? ""}><option value="">Any member</option>{people.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label>
      <label>Sort<select aria-label="Sort" name="sort" className={control} defaultValue={params.get("sort") ?? "updated_desc"}><option value="updated_desc">Recently updated</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="created_desc">Newest created</option></select></label>
      <label className="flex items-center gap-2"><input name="unassigned" type="checkbox" value="true" defaultChecked={params.get("unassigned") === "true"} />Unassigned only</label>
      <div className="flex items-end gap-3"><button className={primary}>Apply filters</button><Link className="underline" href={`/candidates?organizationId=${scope.organizationId}`}>Reset</Link></div>
    </form>
    <section aria-label="Candidate results" className="overflow-x-auto rounded border bg-white p-4">
      <p className="mb-3 text-sm">{directory.total} candidates in your scope · Page {directory.page}</p>
      {directory.items.length ? <table className="w-full text-left text-sm"><thead><tr>{["Candidate", "Location", "Status", "Team", "Updated"].map(h => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>{directory.items.map(c => <tr key={c.id}>
        <td className="border-b p-2"><Link className="font-medium underline" href={`/candidates/${c.id}?organizationId=${scope.organizationId}&returnTo=${encodeURIComponent(`/candidates?${params}`)}`}>{c.fullName ?? "Untitled draft"}</Link><p>{c.email}</p></td>
        <td className="border-b p-2">{c.location ?? "—"}</td><td className="border-b p-2">{c.status}</td><td className="border-b p-2">{teams.find(t => t.id === c.owningTeamId)?.name ?? "Team"}</td><td className="border-b p-2">{new Date(c.updatedAt).toLocaleString()}</td>
      </tr>)}</tbody></table> : <p>No candidates match these filters.</p>}
      <nav aria-label="Result pages" className="mt-4 flex gap-4">{directory.page > 1 && <Link className="underline" href={pageLink(directory.page - 1)}>Previous</Link>}{directory.page * directory.pageSize < directory.total && <Link className="underline" href={pageLink(directory.page + 1)}>Next</Link>}</nav>
    </section>
    {managed.length > 0 && <section className="rounded border bg-white p-5"><h2 className="text-lg font-semibold">Create candidate</h2><p className="mb-3 text-sm">Start an incomplete draft, then fill in the profile. A name is optional until Ready.</p>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={async e => {
        e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError("");
        try { const profile = await readApi<CandidateProfile>(`/api/v1/candidates?organizationId=${scope.organizationId}`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamId: team, ownerId: form.get("ownerId") || null, profile: { ...emptyCandidateProfile(), fullName: form.get("fullName") || null } }) });
          window.location.assign(`/candidates/${profile.id}?organizationId=${scope.organizationId}&tab=profile`);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Creation failed."); setBusy(false); }
      }}>
        <label>Full name (optional)<input name="fullName" maxLength={200} className={control} /></label>
        <label>Owning team<select aria-label="Owning team" value={team} onChange={e => setTeam(e.target.value)} className={control}>{managed.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Candidate owner<select aria-label="Candidate owner" name="ownerId" key={team} className={control}><option value="">No owner</option>{eligible.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label>
        <button className={`${primary} w-fit`} disabled={busy}>{busy ? "Creating…" : "Create draft"}</button>
      </form>{error && <p role="alert" className="mt-3">{error}</p>}
    </section>}
  </div>;
}
