"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { organizationRoles, type AccountRequest, type FoundationSnapshot } from "@candidate/contracts";
import { readApi } from "@/app/workspace/requests";
export function AccountReviews({ organizationId }: { organizationId: string }) {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [teams, setTeams] = useState<FoundationSnapshot["teams"]>([]);
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const endpoint = `/api/v1/organizations/${organizationId}`;
  useEffect(() => {
    let active = true;
    setLoaded(false); setRequests([]); setTeams([]);
    void Promise.all([readApi<AccountRequest[]>(`${endpoint}/account-requests?offset=${offset}`), readApi<FoundationSnapshot>(endpoint)]).then(([rows,snapshot]) => {
      if (active) { setRequests(rows); setTeams(snapshot.teams.filter(t => t.status === "active")); setLoaded(true); setMessage(""); }
    }).catch(cause => { if (active) setMessage(cause instanceof Error ? cause.message : "Could not load requests. Retry."); });
    return () => { active = false; };
  }, [endpoint, offset, tick]);
  return <div className="grid gap-4">
    <Link href={`/workspace?organizationId=${organizationId}`} className="underline">Return to workspace</Link>
    <button onClick={() => setTick(t => t+1)} className="justify-self-start underline">Reload requests</button>
    <p role="status">{message || (!loaded ? "Loading current access and requests…" : !requests.length ? "No account requests on this page." : "")}</p>
    {requests.map(row => <Review key={`${row.user_id}:${row.row_version}`} row={row} teams={teams} endpoint={endpoint} reload={() => setTick(t => t+1)} />)}
    <div className="flex gap-4"><button disabled={offset===0} onClick={() => setOffset(v => Math.max(0,v-50))}>Previous page</button><span>Page {offset/50+1}</span><button disabled={requests.length<50} onClick={() => setOffset(v => v+50)}>Next page</button></div>
  </div>;
}
function Review({ row, teams, endpoint, reload }: { row: AccountRequest; teams: FoundationSnapshot["teams"]; endpoint: string; reload: () => void }) {
  const [role, setRole] = useState("team_member");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    if (decision !== "approved" && decision !== "rejected") return;
    setBusy(true); setMessage("");
    try {
      await readApi(`${endpoint}/account-requests`, { method: "POST", headers: { "Content-Type":"application/json", "If-Match": JSON.stringify(String(row.row_version)) }, body: JSON.stringify({
        userId: row.user_id, decision, role: decision === "approved" ? role : null,
        teamId: decision === "approved" && role !== "admin" ? String(form.get("teamId") ?? "") || null : null,
        reason: String(form.get("reason") ?? "").trim() || null,
      }) });
      reload();
    } catch (cause) { setMessage(cause instanceof Error ? `${cause.message} Reload requests before changing a review; an identical retry is safe.` : "Review failed. Reload status before retrying."); }
    finally { setBusy(false); }
  }
  return <article className="grid gap-2 rounded border bg-white p-5">
    <h2 className="font-semibold">{row.full_name}</h2><p>{row.email}</p>{row.registered_email !== row.email && <p>Registered email: {row.registered_email}</p>}<p>Registered: {new Date(row.registered_at).toLocaleString()}</p>
    <p>Email verification: {row.email_verified ? "Verified" : "Not verified"}</p><p>Review status: {row.status}</p>
    {row.status === "pending" ? <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1">Role<select name="role" value={role} onChange={e => setRole(e.target.value)} disabled={busy} className="rounded border p-2">{organizationRoles.map(r => <option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></label>
      {role !== "admin" && <label className="grid gap-1">Required team<select name="teamId" disabled={busy} className="rounded border p-2"><option value="">Select a team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      <label className="grid gap-1">Optional review reason<textarea name="reason" maxLength={2000} disabled={busy} className="rounded border p-2" /></label>
      <div className="flex gap-4"><button type="submit" value="approved" disabled={busy || !row.email_verified} className="rounded bg-slate-900 p-2 text-white disabled:opacity-50">Approve</button><button type="submit" value="rejected" disabled={busy} className="rounded border p-2">Reject</button></div>
      {!row.email_verified && <p>Approval requires email verification. You may reject an unverified request.</p>}
    </form> : <div><p>Reviewed by: {row.reviewed_by} at {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : "—"}</p>{row.assigned_role && <p>Assigned role: {row.assigned_role.replaceAll("_"," ")}; team: {teams.find(t => t.id===row.team_id)?.name ?? row.team_id ?? "Organization-wide"}</p>}{row.reason && <p>Reason: {row.reason}</p>}</div>}
    <p role="status">{message}</p>
  </article>;
}
