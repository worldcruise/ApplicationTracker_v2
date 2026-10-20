"use client";
import { useState, type FormEvent } from "react";
import { organizationRoles, type FoundationCommand, type FoundationSnapshot, type OrganizationRole, type ProvisioningResult, type TeamRole } from "@candidate/contracts";
import { sendCommand, readApi } from "./requests";

const inputStyle = "rounded border bg-white p-2";
const buttonStyle = "rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50";
type InviteCommand = Extract<FoundationCommand, { command: "provisionUser" }>;

export function Administration({ snapshot, refresh }: { snapshot: FoundationSnapshot; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [frozen, setFrozen] = useState<InviteCommand | null>(null);
  const [inviteDone, setInviteDone] = useState(false);
  const org = snapshot.scope.organizationId;
  const name = (userId: string) => snapshot.people.find(p => p.id === userId)?.displayName ?? userId;
  async function run(command: FoundationCommand, version?: number) {
    setBusy(true); setMessage("");
    try {
      await sendCommand(org, command, version);
      setMessage("Change saved. Current access is being rechecked."); refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "The operation failed."); }
    finally { setBusy(false); }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const command: InviteCommand = frozen ?? {
      command: "provisionUser", operationId: crypto.randomUUID(), email: String(form.get("email") ?? ""),
      displayName: String(form.get("displayName") ?? ""), role: String(form.get("role")) as OrganizationRole,
    };
    setFrozen(command);
    try {
      const result = await sendCommand<ProvisioningResult>(org, command);
      setInviteDone(true); setMessage(`Account operation: ${result.state.replaceAll("_", " ")}. Activate the membership after the email is confirmed.`); refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Provisioning failed. Retry this operation."); }
    finally { setBusy(false); }
  }
  return <section className="grid gap-6 rounded border bg-white p-5">
    <h2 className="text-lg font-semibold">Organization administration</h2>
    <p className="text-sm">This setup panel shows up to 100 entries per roster. Manage candidate assignments through the scoped candidate directory and Overview controls. Larger roster pagination remains a release prerequisite.</p>
    <p role="status">{message}</p>
    <form className="grid gap-3" onSubmit={invite}>
      <h3 className="font-semibold">Invite or attach an account</h3>
      <fieldset disabled={busy || frozen !== null} className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1">Display name<input name="displayName" required maxLength={200} className={inputStyle} /></label>
        <label className="grid gap-1">Email<input name="email" type="email" required maxLength={320} className={inputStyle} /></label>
        <label className="grid gap-1">Organization role<select name="role" defaultValue="team_member" className={inputStyle}>{organizationRoles.map(r => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}</select></label>
      </fieldset>
      <div className="flex gap-3">
        <button disabled={busy || inviteDone} className={buttonStyle}>{frozen ? "Retry invitation" : "Invite account"}</button>
        {frozen && <button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={() => { setFrozen(null); setInviteDone(false); setMessage(""); }}>Start another invitation</button>}
      </div>
    </form>
    <div className="overflow-x-auto"><h3 className="mb-3 font-semibold">Memberships</h3>
      <p className="mb-3 text-sm">Deactivation removes this organization’s access, assignments and grants. Reactivation requires new team membership and assignments. Previously exported local files remain on their devices.</p>
      <table className="w-full text-left text-sm"><thead><tr><th>Account</th><th>State</th><th>Role and activation</th></tr></thead><tbody>
        {snapshot.memberships.map(m => <tr key={m.userId} className="border-t"><td className="py-3">{name(m.userId)}</td><td>{m.state}</td><td>
          <form key={m.rowVersion} className="flex flex-wrap gap-2 py-2" onSubmit={e => {
            e.preventDefault(); const form = new FormData(e.currentTarget);
            void run({ command: "setOrganizationMembership", userId: m.userId, role: String(form.get("role")) as OrganizationRole,
              state: m.state === "invited" ? "active" : m.state }, m.rowVersion);
          }}>
            <select name="role" defaultValue={m.role} aria-label={`Role for ${name(m.userId)}`} className={inputStyle}>{organizationRoles.map(r => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}</select>
            <button disabled={busy} className={buttonStyle}>{m.state === "invited" ? "Activate confirmed account" : "Save role"}</button>
            {m.state !== "invited" && <button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={() => void run({
              command: "setOrganizationMembership", userId: m.userId, role: m.role, state: m.state === "active" ? "deactivated" : "active",
            }, m.rowVersion)}>{m.state === "active" ? "Deactivate" : "Reactivate"}</button>}
          </form>
        </td></tr>)}
      </tbody></table>
    </div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
      e.preventDefault(); const form = new FormData(e.currentTarget); void run({ command: "createTeam", name: String(form.get("name")) });
    }}><label className="grid gap-1">New team name<input name="name" required maxLength={200} className={inputStyle} /></label><button disabled={busy} className={buttonStyle}>Create team</button></form>
    <form className="grid gap-3 sm:grid-cols-3" onSubmit={e => {
      e.preventDefault(); const form = new FormData(e.currentTarget);
      const teamId = String(form.get("team")); const userId = String(form.get("user"));
      const membership = snapshot.memberships.find(m => m.userId === userId);
      if (!membership || membership.role === "admin") { setMessage("Select an active non-admin account."); return; }
      const previous = snapshot.teamMemberships.find(m => m.teamId === teamId && m.userId === userId);
      void run({ command: "setTeamMembership", teamId, userId, role: membership.role as TeamRole, active: form.get("active") === "on" }, previous?.rowVersion ?? 0);
    }}>
      <label className="grid gap-1">Team<select name="team" required className={inputStyle}>{snapshot.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="grid gap-1">Active account<select name="user" required className={inputStyle}>{snapshot.memberships.filter(m => m.state === "active" && m.role !== "admin").map(m => <option key={m.userId} value={m.userId}>{name(m.userId)} ({m.role.replaceAll("_", " ")})</option>)}</select></label>
      <div className="grid gap-2"><label className="flex gap-2"><input name="active" type="checkbox" defaultChecked />Active team membership</label><button disabled={busy || !snapshot.teams.length} className={buttonStyle}>Save team membership</button></div>
    </form>
    <div className="grid gap-3"><h3 className="font-semibold">Team workflow policies</h3><p>Changing policy invalidates pending approvals. Previously recorded submissions keep their original policy snapshot.</p>
    {snapshot.teams.map(t=><form key={t.id+":"+t.rowVersion} className="flex flex-wrap items-center gap-3 rounded border p-3" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setMessage("");try{await readApi(`/api/v1/workflow-policy/${t.id}?organizationId=${org}`,{method:"PATCH",headers:{"Content-Type":"application/json","If-Match":JSON.stringify(String(t.rowVersion))},body:JSON.stringify({required:form.has("required"),coverLetterRequired:form.has("letter")})});refresh();setMessage("Policy saved; affected approvals invalidated.");}catch(cause){setMessage((cause instanceof Error?cause.message:"Policy synchronization is unknown.")+" Reload current policies before making another change.");}finally{setBusy(false);}}}>
    <span>{t.name} · policy {t.approvalPolicy?.version??"unconfigured"}</span><label><input name="required" type="checkbox" defaultChecked={t.approvalPolicy?.required??true}/> Require independent approval</label><label><input name="letter" type="checkbox" defaultChecked={t.approvalPolicy?.coverLetterRequired??false}/> Require cover letter</label><button className={buttonStyle} disabled={busy}>Save policy</button></form>)}</div>
    <form className="grid gap-3 border-t pt-4" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void run({command:"grantBidderAccess",userId:String(form.get("bidder")),candidateId:String(form.get("candidateId"))||null,bidId:String(form.get("bidId"))||null,capability:String(form.get("capability")) as "bid.prepare"|"bid.submit"|"document.read"|"document.export",allowEmail:form.has("email"),allowPhone:form.has("phone"),expiresAt:String(form.get("expiresAt"))||null});}}>
    <h3 className="font-semibold">Scoped bidder capability</h3><p>Choose exactly one candidate or bid target. Preparing, submitting and exporting require separate capabilities.</p><label className="grid gap-1">Bidder account<select name="bidder" required className={inputStyle}>{snapshot.memberships.filter(m=>m.state==="active"&&m.role==="bidder").map(m=><option key={m.userId} value={m.userId}>{name(m.userId)}</option>)}</select></label>
    <label className="grid gap-1">Candidate grant reference<input name="candidateId" className={inputStyle}/></label><label className="grid gap-1">Bid grant reference<input name="bidId" className={inputStyle}/></label><label className="grid gap-1">Capability<select name="capability" className={inputStyle}>{["bid.prepare","bid.submit","document.read","document.export"].map(c=><option key={c}>{c}</option>)}</select></label><label className="grid gap-1">Expiry (ISO timestamp with offset, optional)<input name="expiresAt" className={inputStyle}/></label><label><input type="checkbox" name="email"/> Include email in safe projection</label><label><input type="checkbox" name="phone"/> Include phone in safe projection</label><button className={buttonStyle} disabled={busy}>Grant scoped capability</button>
    </form>
    <details><summary>Existing scoped grants</summary>{snapshot.grants.filter(g=>!g.revokedAt).map(g=><div className="flex flex-wrap gap-3 py-2" key={g.id}><span>{name(g.userId)} · {g.capability} · {g.bidId??g.candidateId}</span><button disabled={busy} className="underline" onClick={()=>void run({command:"revokeBidderAccess",grantId:g.id})}>Revoke capability</button></div>)}</details>
    {snapshot.operations.length > 0 && <div><h3 className="font-semibold">Account operations</h3><ul className="mt-2 grid gap-2">{snapshot.operations.map(op => <li key={op.operationId} className="rounded border p-3">
      <p>{op.displayName} — {op.state.replaceAll("_", " ")}{op.lastErrorCode ? " — retry required" : ""}</p>
      {op.state === "pending_auth" && <button disabled={busy} className="mt-2 underline" onClick={async () => {
        setBusy(true); setMessage("");
        try { await sendCommand(org, { command: "provisionUser", operationId: op.operationId, email: op.email, displayName: op.displayName, role: op.desiredRole }); refresh(); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : "Retry failed."); } finally { setBusy(false); }
      }}>Retry original account operation</button>}
    </li>)}</ul></div>}
  </section>;
}

