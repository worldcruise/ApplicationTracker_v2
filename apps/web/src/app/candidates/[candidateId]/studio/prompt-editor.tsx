"use client";
import { useState } from "react";
import type { CandidateProfile, OrganizationScope, PromptVersion } from "@candidate/contracts";
import { readApi } from "@/app/workspace/requests";
import { button, control } from "../../directory";
type Row = PromptVersion & { current: boolean; builtin: boolean };
export function PromptEditor({ scope, profile, prompts, disabled, refresh, report }: { scope: OrganizationScope; profile: CandidateProfile; prompts: Row[]; disabled: boolean; refresh: () => void; report: (message: string) => void }) {
  const [selected, setSelected] = useState<Row | null>(null); const [target, setTarget] = useState("candidate"); const [kind, setKind] = useState("custom"); const [saving, setSaving] = useState(false);
  const manages = scope.role === "admin" || scope.teams.some(t => t.teamId === profile.owningTeamId && t.role === "team_leader");
  const editable = prompts.filter(p => p.current && !p.builtin && (scope.role === "admin" || p.scope === "candidate" || (p.scope === "team" && manages)));
  return <details><summary className="cursor-pointer text-sm font-medium">Scoped prompt versions and publication</summary>
    <p className="my-2 text-sm">Each publication appends a version. Existing assemblies keep their exact text and version IDs. Protected rules always remain above editable instructions.</p>
    <label htmlFor="prompt-preset" className="text-sm">Prompt to publish</label><select id="prompt-preset" className={control} value={selected?.id ?? ""} disabled={disabled || saving} onChange={e => { const p = editable.find(p => p.id === e.target.value) ?? null; setSelected(p); setTarget(p?.scope ?? "candidate"); setKind(p?.kind ?? "custom"); }}><option value="">New prompt</option>{editable.map(p => <option key={p.id} value={p.id}>{p.name} · {p.scope} · v{p.version}</option>)}</select>
    <form key={selected?.id ?? "new"} className="mt-3 grid gap-3" onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget); setSaving(true);
      try {
        const selectedScope = selected?.scope ?? target; await readApi(`/api/v1/prompts/versions?organizationId=${scope.organizationId}`, { method: "POST", headers: { "Content-Type": "application/json", "If-Match": JSON.stringify(String(selected?.version ?? 0)) },
          body: JSON.stringify({ presetId: selected?.presetId ?? null, kind: selected?.kind ?? kind, scope: selectedScope, teamId: selectedScope === "team" ? profile.owningTeamId : null, candidateId: selectedScope === "candidate" ? profile.id : null,
            name: String(form.get("name") ?? ""), description: String(form.get("description") ?? ""), content: String(form.get("content") ?? ""), enabled: form.get("enabled") === "on", order: Number(form.get("order")) }) });
        report("Prompt version published. Assemble again to use the current definitions; the old preview remains frozen."); refresh(); setSelected(null);
      } catch (error) { report(error instanceof Error ? error.message : "Prompt publication failed."); } finally { setSaving(false); }
    }}><fieldset disabled={disabled || saving} className="grid gap-3 sm:grid-cols-2">
      <label>Prompt kind<select aria-label="Prompt kind" className={control} value={kind} disabled={!!selected} onChange={e => { setKind(e.target.value); if (e.target.value === "main") setTarget("global"); }}><option value="custom">Custom preference</option>{scope.role === "admin" && <option value="main">Organization main prompt</option>}</select></label>
      <label>Prompt scope<select aria-label="Prompt scope" className={control} value={target} disabled={!!selected || kind === "main"} onChange={e => setTarget(e.target.value)}><option value="candidate">This candidate</option>{manages && <option value="team">Owning team</option>}{scope.role === "admin" && <option value="global">Organization global</option>}</select></label>
      <label>Prompt name<input className={control} name="name" defaultValue={selected?.name ?? ""} required maxLength={200} /></label>
      <label>Description<input className={control} name="description" defaultValue={selected?.description ?? ""} maxLength={2000} /></label>
      <label className="sm:col-span-2">Prompt content<textarea className={control} name="content" defaultValue={selected?.content ?? ""} rows={4} required maxLength={20000} /></label>
      <label>Prompt order<input className={control} name="order" type="number" min={0} max={10000} defaultValue={selected?.order ?? 0} required /></label>
      <label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={selected?.enabled ?? true} />Enabled</label>
      <button className={`${button} w-fit`}>Publish prompt version</button>
    </fieldset></form>
    <ul className="mt-3 grid gap-1 text-xs">{prompts.slice(0, 100).map(p => <li key={p.id}>{p.name} · {p.kind}/{p.scope} · v{p.version} · {p.current ? "current" : "historical"} · {p.enabled ? "enabled" : "disabled"}</li>)}</ul>
  </details>;
}
