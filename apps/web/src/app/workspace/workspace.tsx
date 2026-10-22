"use client";
import { useEffect, useRef, useState } from "react";
import type { FoundationSnapshot, UserContext, BidderCandidate, CandidateDirectory } from "@candidate/contracts";
import { readApi } from "./requests";
import { Administration } from "./administration";
import { OperationalDashboard } from "../dashboard/workspace";

export function FoundationWorkspace({ context, initialOrganization }: { context: UserContext; initialOrganization: string }) {
  const [org, setOrg] = useState(initialOrganization);
  const currentOrg = useRef(org);
  const [snapshot, setSnapshot] = useState<FoundationSnapshot | null>(null);
  const [candidates, setCandidates] = useState<{ id: string; fullName: string; status: string }[]>([]);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [projection, setProjection] = useState<BidderCandidate | null>(null);
  useEffect(() => {
    let active = true;
    setSnapshot(null); setCandidates([]); setProjection(null); setError("");
    void (async () => {
      try {
        const result = await readApi<FoundationSnapshot>(`/api/v1/organizations/${org}`);
        const rows = result.scope.role === "bidder" ? [] :
          (await readApi<CandidateDirectory>(`/api/v1/candidates?organizationId=${org}`)).items.map(c => ({ ...c, fullName: c.fullName ?? "Untitled draft" }));
        if (active) { setSnapshot(result); setCandidates(rows); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "The workspace could not be loaded."); }
    })();
    return () => { active = false; };
  }, [org, tick]);
  return <div className="grid gap-6">
    <label className="grid max-w-md gap-1">Organization<select className="rounded border bg-white p-2" value={org} onChange={e => {
      currentOrg.current = e.target.value; setSnapshot(null); setCandidates([]); setProjection(null); setError(""); setOrg(e.target.value);
      window.location.assign(`/workspace?organizationId=${encodeURIComponent(e.target.value)}`);
    }}>
      {context.organizations.map(o => <option key={o.organizationId} value={o.organizationId}>{o.name}</option>)}
    </select></label>
    {error && <p role="alert">{error} <a className="underline" href="/workspace">Reload access</a></p>}
    {!snapshot && !error && <p role="status">Checking current access…</p>}
    {snapshot && <>
      <OperationalDashboard key={org} scope={snapshot.scope} actorId={context.userId} />
      <section id="current-access" className="rounded border bg-white p-5"><h2 className="text-lg font-semibold">Current access</h2>
        <p>Role: {snapshot.scope.role.replaceAll("_", " ")}</p><p>Teams: {snapshot.teams.map(t => t.name).join(", ") || "No active team scope"}</p>
        <div className="flex flex-wrap gap-4"><a className="mt-2 inline-block underline" href={`/documents?organizationId=${org}`}>Open authorized document history</a><a className="mt-2 inline-block underline" href={`/bids?organizationId=${org}`}>Open bids and follow-ups</a></div>
      </section>
      {snapshot.scope.role === "bidder" ? <section className="rounded border bg-white p-5">
        <h2 className="text-lg font-semibold">Authorized candidate preparation</h2>
        <p className="mb-4 text-sm">Open a candidate using its assigned reference. A bid-specific grant also requires the bid reference.</p>
        <form className="grid gap-3" onSubmit={async e => {
          e.preventDefault(); setProjection(null); setError("");
          const form = new FormData(e.currentTarget);
          const candidateId = String(form.get("candidateId") ?? "");
          const bidId = String(form.get("bidId") ?? "");
          try {
            const result = await readApi<BidderCandidate>(`/api/v1/candidates/${encodeURIComponent(candidateId)}?organizationId=${org}${bidId ? `&bidId=${encodeURIComponent(bidId)}` : ""}`);
            if (currentOrg.current === org) setProjection(result);
          } catch (cause) { if (currentOrg.current === org) setError(cause instanceof Error ? cause.message : "Preparation details are unavailable."); }
        }}>
          <label className="grid gap-1">Candidate reference<input name="candidateId" required className="rounded border p-2" /></label>
          <label className="grid gap-1">Bid reference (when assigned)<input name="bidId" className="rounded border p-2" /></label>
          <button className="w-fit rounded bg-slate-900 px-4 py-2 text-white">Open authorized details</button>
        </form>
        {projection && <article className="mt-5"><h3 className="font-semibold">{projection.fullName ?? "Untitled draft"}</h3>
          <p>{projection.location}</p>{projection.email && <p>{projection.email}</p>}{projection.phone && <p>{projection.phone}</p>}
          <p className="mt-3 whitespace-pre-wrap">{projection.approvedSummary ?? "No approved summary is available."}</p>
        </article>}
      </section> : <section className="rounded border bg-white p-5"><h2 className="text-lg font-semibold">Candidates in your scope</h2>
        <a className="my-3 inline-block underline" href={`/candidates?organizationId=${org}`}>Open candidate directory</a>
        {candidates.length ? <ul className="mt-3 grid gap-2">{candidates.map(c => <li key={c.id}>{c.fullName} <span className="text-sm text-slate-500">({c.status})</span></li>)}</ul> : <p>No candidates found in your authorized scope.</p>}
      </section>}
      {snapshot.scope.role === "admin" && <div id="administration"><Administration key={org} snapshot={snapshot} refresh={() => setTick(n => n + 1)} /></div>}
      {snapshot.scope.role === "team_leader" && <section id="administration" className="grid gap-3 rounded border bg-white p-5"><h2 className="text-lg font-semibold">Team administration</h2><p>Manage candidate assignments from each candidate's Overview. Organization roles, memberships, bidder grants and approval policy are controlled by an administrator.</p><a className="underline" href={`/candidates?organizationId=${org}`}>Manage team candidate assignments</a>{snapshot.teams.map(t => <article key={t.id}><h3 className="font-semibold">{t.name}</h3><p>Independent approval: {t.approvalPolicy?.required ? "required" : "optional"} · cover letter: {t.approvalPolicy?.coverLetterRequired ? "required" : "optional"}</p>{snapshot.teamMemberships.filter(m => m.teamId === t.id).map(m => <p key={m.userId}>{snapshot.people.find(p => p.id === m.userId)?.displayName ?? m.userId} · {m.role.replaceAll("_", " ")} · {m.active ? "Active" : "Inactive"}</p>)}</article>)}</section>}
    </>}
  </div>;
}

