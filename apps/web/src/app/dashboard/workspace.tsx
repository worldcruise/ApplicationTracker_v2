"use client";
import { useEffect, useState } from "react";
import { bidStatuses, dashboardMetrics, metricLabels, type DashboardItem, type DashboardMetric, type DashboardReport, type OrganizationScope } from "@candidate/contracts";
import { readApi } from "../workspace/requests";
import { ProcessingPanel } from "./processing";
const box = "grid gap-3 rounded border bg-white p-5";
const input = "rounded border border-slate-300 bg-white p-2";
const titles = { admin: "Admin dashboard", team_leader: "Team Leader dashboard", team_member: "Team Member dashboard", bidder: "Bidder dashboard" };
interface Notice { id: string; bidId: string; interviewId: string | null; title: string; readAt: string | null; createdAt: string }
interface Activity { id: string; action: string; actorId: string; subjectId: string; teamId: string | null; createdAt: string; requestId: string }
const date = (value: string) => new Date(value).toLocaleString();
function destination(row: DashboardItem, org: string) {
  return row.kind === "candidate" ? `/candidates/${row.candidateId}?organizationId=${org}` : `/bids/${row.bidId}?organizationId=${org}${row.kind === "interview" ? "&view=interviews" : row.kind === "task" ? "&view=followups" : ""}`;
}
export function OperationalDashboard({ scope, actorId }: { scope: OrganizationScope; actorId: string }) {
  const org = scope.organizationId;
  const [search, setSearch] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [reportError, setReportError] = useState("");
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [noticeError, setNoticeError] = useState("");
  const [activity, setActivity] = useState<{ items: Activity[]; total: number } | null>(null);
  const [activityError, setActivityError] = useState("");
  const [activityPage, setActivityPage] = useState(1);
  const [marking, setMarking] = useState(false);
  useEffect(() => { setSearch(new URLSearchParams(window.location.search).toString()); const pop = () => { setReport(null); setSearch(new URLSearchParams(window.location.search).toString()); }; window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop); }, []);
  useEffect(() => {
    if (search === null) return;
    let active = true;
    const q = new URLSearchParams(search); q.set("organizationId", org);
    setReportError("");
    void readApi<DashboardReport>(`/api/v1/dashboard?${q}`).then(r => { if (active) setReport(r); }).catch(e => { if (active) setReportError(e.message); });
    return () => { active = false; };
  }, [org, search, refresh]);
  useEffect(() => {
    let active = true;
    setNoticeError(""); setActivityError("");
    // Independent sources: a failed activity query cannot hide a good report or notifications.
    void Promise.allSettled([
      readApi<Notice[]>(`/api/v1/notifications?organizationId=${org}`).then(r => { if (active) setNotices(r); }).catch(e => { if (active) setNoticeError(e.message); }),
      readApi<{ items: Activity[]; total: number }>(`/api/v1/activity?organizationId=${org}&page=${activityPage}`).then(r => { if (active) setActivity(r); }).catch(e => { if (active) setActivityError(e.message); }),
    ]);
    return () => { active = false; };
  }, [org, refresh, activityPage]);
  function navigate(updates: Record<string, string>) {
    const q = new URLSearchParams(search ?? ""); q.set("organizationId", org);
    for (const [k, v] of Object.entries(updates)) if (v) q.set(k, v); else q.delete(k);
    window.history.pushState(null, "", `${window.location.pathname}?${q}`); setReport(null); setSearch(q.toString());
  }
  const current = new URLSearchParams(search ?? "");
  const teams = report?.teams ?? scope.teams.map(t => ({ id: t.teamId, name: t.name }));
  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? id;
  const metric = report?.detail.metric ?? "active_bids";
  const rate = (numerator: number | undefined, denominator: number) => numerator === undefined ? "Unavailable for this role" : denominator === 0 ? "N/A (0 / 0)" : `${(100 * numerator / denominator).toFixed(1)}% (${numerator} / ${denominator})`;
  return <div className="my-5 grid gap-5" data-testid="operational-dashboard">
    <header className={box}><h2 className="text-2xl font-semibold">{titles[scope.role]}</h2><p>{scope.name} · {scope.role === "bidder" ? "Your own currently authorized bid activity" : "Current organization, team and assignment scope"}</p>
      <nav aria-label="Operational navigation" className="flex flex-wrap gap-4 underline">
        <a href={`/dashboard?organizationId=${org}`}>Dashboard</a><a href={`/bids?organizationId=${org}`}>Bids and approvals</a><a href={`/tasks?organizationId=${org}`}>Follow-ups</a><a href={`/documents?organizationId=${org}`}>Document history</a>
        {scope.role !== "bidder" && <><a href={`/candidates?organizationId=${org}`}>Candidates and assignments</a><a href={`/interviews?organizationId=${org}`}>Interviews and feedback</a></>}
        <a href={`/workspace?organizationId=${org}#administration`}>{scope.role === "admin" ? "User, team and permission administration" : "Workspace and current access"}</a>
      </nav>
    </header>
    <form className={box} key={search ?? "loading"} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); navigate(Object.fromEntries([...f].map(([k, v]) => [k, String(v)]).concat([["page", "1"]]))); }}>
      <h3 className="font-semibold">Report filters</h3><div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">Team<select className={input} name="teamId" defaultValue={current.get("teamId") ?? ""}><option value="">All authorized teams</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="grid gap-1">Bid owner reference<input className={input} name="ownerId" defaultValue={current.get("ownerId") ?? ""} placeholder={actorId} /></label>
        <label className="grid gap-1">Current bid status<select className={input} name="status" defaultValue={current.get("status") ?? ""}><option value="">All statuses</option>{bidStatuses.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
        <label className="grid gap-1">Target company contains<input className={input} name="company" maxLength={200} defaultValue={current.get("company") ?? ""} /></label>
        <label className="grid gap-1">Submission cohort from (UTC)<input type="date" name="from" className={input} defaultValue={current.get("from") ?? ""} /></label>
        <label className="grid gap-1">Submission cohort through (UTC)<input type="date" name="to" className={input} defaultValue={current.get("to") ?? ""} /></label>
        {scope.role !== "bidder" && <label className="grid gap-1">Upcoming window (days)<input type="number" min={1} max={90} name="windowDays" className={input} defaultValue={current.get("windowDays") ?? "30"} /></label>}
      </div><p className="text-sm">Cohort dates affect conversion metrics. Action queues and workload show current work. Company and status restrict candidates to matching bids; candidate owner filtering also includes active profile assignments.</p>
      <div className="flex gap-4"><button className="rounded bg-slate-900 px-4 py-2 text-white">Apply report filters</button><button type="button" className="underline" onClick={() => setRefresh(n => n + 1)}>Refresh current access</button></div>
    </form>
    {reportError && <p role="alert">Report unavailable: {reportError}{report ? " Previous report is stale; refresh before acting." : " No successful empty result is implied."}</p>}
    {!report && !reportError && <p role="status">Loading scoped report…</p>}
    {report && <>
      <p className="text-sm">As of {date(report.asOf)} · Display time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Current permissions are rechecked on every read.</p>
      <section aria-label="Dashboard metrics" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{dashboardMetrics.filter(m => report.counts[m] !== undefined).map(m => <button key={m} className="rounded border bg-white p-4 text-left focus:ring-2" onClick={() => navigate({ metric: m, page: "1" })} aria-pressed={metric === m} data-metric={m}><span className="block text-sm">{metricLabels[m]}</span><strong className="text-2xl" data-testid={`count-${m}`}>{report.counts[m]}</strong></button>)}</section>
      <section className={box}><h3 className="text-lg font-semibold">Submission conversions</h3><p>Cohort [{report.cohort.from}, {report.cohort.toExclusive}) · UTC · distinct submitted bids. Recent cohorts may have incomplete outcomes.</p>
        {scope.role !== "bidder" && <p>Submission to interview: {rate(report.counts.interview_converted, report.counts.submitted ?? 0)}</p>}
        <p>Submission to offer: {rate(report.counts.offer_converted, report.counts.submitted ?? 0)}</p><p className="text-sm">Invitation evidence is a recorded interview-invited bid status or a scheduled round. Offer evidence is an explicit offer bid transition. Rounds and repeated submissions never multiply a bid.</p>
      </section>
      <section className={box} aria-label="Metric drill-down"><h3 className="text-lg font-semibold">{metricLabels[metric as DashboardMetric]} — exact scoped list</h3><p data-testid="detail-total">{report.detail.total} matching records</p>
        {report.detail.items.length === 0 ? <p>No matching records in the current scope and filters.</p> : <ul>{report.detail.items.map(r => <li key={`${r.kind}:${r.id}`} className="grid gap-1 border-b py-3"><a className="underline" href={destination(r, org)}>{r.label}</a><span>{r.status.replaceAll("_", " ")} · {teamName(r.teamId)} · owner {r.ownerId ?? "Unassigned"}</span>{r.dueAt && <span>{date(r.dueAt)} {r.timezone ? `(${r.timezone})` : ""}</span>}</li>)}</ul>}
        <div className="flex gap-4"><button disabled={report.detail.page <= 1} onClick={() => navigate({ page: String(report.detail.page - 1) })}>Previous report page</button><span>Page {report.detail.page}</span><button disabled={report.detail.page * report.detail.pageSize >= report.detail.total} onClick={() => navigate({ page: String(report.detail.page + 1) })}>Next report page</button></div>
      </section>
      <section className={box}><h3 className="text-lg font-semibold">Workload by team and owner</h3><p>Active bids by bid owner; open tasks by assignee. Bid-owner filters apply to the linked bid before grouping.</p>
        <div className="overflow-auto"><table className="w-full text-left"><thead><tr><th>Team</th><th>Owner / assignee</th><th>Active bids</th><th>Open tasks</th></tr></thead><tbody>{report.workload.map(w => <tr key={`${w.teamId}:${w.ownerId}`}><td>{teamName(w.teamId)}</td><td>{w.ownerId ?? "Unassigned"}</td><td>{w.activeBids}</td><td>{w.openTasks}</td></tr>)}</tbody></table></div>{!report.workload.length && <p>No open work.</p>}
        <p>Unassigned active bids: {report.workload.filter(w => w.ownerId === null).reduce((n, w) => n + w.activeBids, 0)}. Unassigned open tasks: 0 (tasks require an assignee).</p>
        {scope.role !== "bidder" && <><h4 className="font-semibold">Candidate assignments</h4>{report.assignments.map(a => <p key={a.teamId}>{teamName(a.teamId)}: {a.candidates} active candidates · {a.unassigned} without an active profile assignment</p>)}</>}
      </section>
      <section className={box}><h3 className="font-semibold">Bid stages and outcomes</h3>{report.stages.map(s => <p key={s.status}>{s.status.replaceAll("_", " ")}: {s.bids}</p>)}{scope.role !== "bidder" && <><h4 className="font-semibold">Interview progression (rounds)</h4>{report.interviewProgression.map(i => <p key={`${i.lifecycle}:${i.outcome}`}>{i.lifecycle.replaceAll("_", " ")} · {i.outcome.replaceAll("_", " ")}: {i.rounds}</p>)}<p>Round lifecycle and outcome remain separate from bid outcome.</p></>}</section>
    </>}
    <section className={box}><h3 className="text-lg font-semibold">In-app notifications</h3>{noticeError && <p role="alert">Notifications unavailable: {noticeError}</p>}{notices === null && !noticeError && <p>Loading notifications…</p>}{notices?.length === 0 && <p>No visible workflow notifications.</p>}
      {notices?.map(n => <article key={n.id} className="flex flex-wrap gap-3 border-b py-3"><a className="underline" href={`/bids/${n.bidId}?organizationId=${org}`}>{n.title}</a><time>{date(n.createdAt)}</time>{!n.readAt ? <button disabled={marking} className="underline" onClick={async () => { setMarking(true); try { await readApi(`/api/v1/notifications/${n.id}/read?organizationId=${org}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); setRefresh(t => t + 1); } catch (e) { setNoticeError(e instanceof Error ? e.message : "Could not mark notification read."); } finally { setMarking(false); } }}>Mark read</button> : <span>Read</span>}</article>)}
    </section>
    <section className={box}><h3 className="text-lg font-semibold">Activity history</h3><p>Redacted events in your current audit scope; no historical profile values are included.</p>{activityError && <p role="alert">Activity unavailable: {activityError}</p>}{activity?.items.map(a => <article className="border-b py-2 text-sm" key={a.id}><p>{a.action} · {date(a.createdAt)}</p><p>Actor {a.actorId} · record {a.subjectId} · request {a.requestId}</p></article>)}{activity?.total === 0 && <p>No visible activity.</p>}<div className="flex gap-4"><button disabled={activityPage === 1} onClick={() => setActivityPage(p => p - 1)}>Previous activity page</button><span>Page {activityPage}</span><button disabled={!activity || activityPage * 25 >= activity.total} onClick={() => setActivityPage(p => p + 1)}>Next activity page</button></div></section>
    <ProcessingPanel org={org} actor={actorId} refresh={refresh} />
  </div>;
}
