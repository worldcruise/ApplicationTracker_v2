"use client";
import { useEffect, useState } from "react";
import type { CandidateProfile, OrganizationScope, PromptAssembly, PromptVersion, ResumeOutcomes, ResumeReviewInput, ResumeSourceVersion, ResumeStep } from "@candidate/contracts";
import { validateResume } from "@candidate/contracts";
import { defaultResumeMapping, reviewResume } from "@candidate/domain";
import { ClientApiFailure, readApi } from "@/app/workspace/requests";
import { initialResumeOutcomes, loadStudioDraft, saveStudioDraft, saveStudioOperation, studioKey, pdfDigest, safeResumeFilename, type StudioOperation, type StudioPdf } from "@/lib/resumes/journal";
import { FactReview } from "./fact-review";
import { ProductionPdfPreview } from "./pdf-preview";
import { TemplateLibrary } from "./template-library";
import { PromptEditor } from "./prompt-editor";
import { DocumentHistory } from "@/app/documents/document-history";
import { button, control, primary } from "../../directory";
type VersionRow = { id: string; version: number; reviewed: boolean; render: unknown; createdAt: string };
type PromptRow = PromptVersion & { current: boolean; builtin: boolean };
function decodePdf(result: Omit<StudioPdf, "bytes"> & { base64: string }): StudioPdf {
  const { base64, ...metadata } = result; return { ...metadata, bytes: Uint8Array.from(atob(base64), c => c.charCodeAt(0)) };
}
export function ResumeStudio({ profile, scope, actorId }: { profile: CandidateProfile; scope: OrganizationScope; actorId: string }) {
  const [templateId, setTemplateId] = useState("a7000000-0000-4000-9000-000000000001");
  const [raw, setRaw] = useState(""); const [job, setJob] = useState<PromptAssembly["job"]>({ company: "", title: "", description: "" });
  const [assembly, setAssembly] = useState<PromptAssembly | null>(null); const [mapping, setMapping] = useState<ResumeReviewInput | null>(null);
  const [operation, setOperation] = useState<StudioOperation | null>(null); const [outcomes, setOutcomes] = useState(initialResumeOutcomes);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [localError, setLocalError] = useState("");
  const [checked, setChecked] = useState(false); const [prompts, setPrompts] = useState<PromptRow[]>([]); const [versions, setVersions] = useState<VersionRow[]>([]); const [tick, setTick] = useState(0);
  const [historical, setHistorical] = useState<ResumeSourceVersion | null>(null); const [historicalPdf, setHistoricalPdf] = useState<StudioPdf | null>(null);
  const [journalReady, setJournalReady] = useState(false);
  const key = studioKey(actorId, scope.organizationId, profile.id); const query = `organizationId=${scope.organizationId}`;
  const validation = validateResume(raw); const snapshot = assembly?.snapshot ?? profile;
  const reviewInput = mapping ?? (validation.content ? defaultResumeMapping(validation.content, snapshot) : null);
  const review = validation.content && reviewInput ? reviewResume(validation.content, snapshot, reviewInput) : null;
  if (review && assembly?.job.company.trim() && assembly.job.company.trim().toLowerCase() !== validation.content?.company.trim().toLowerCase()) {
    review.reviewed = false; review.conflicts.push({ path: "/company", code: "FACTUAL_REVIEW_REQUIRED", message: "Target company must match the reviewed job metadata." });
  }
  const uncertain = operation?.outcomes.databaseSync.state === "unknown";
  const disabled = busy || !ready || !journalReady || profile.status === "archived" || !!historical || uncertain;
  const pdf = historical ? historicalPdf : operation?.pdf ?? null;
  const stale = !!assembly && assembly.profileRevision !== profile.rowVersion;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await loadStudioDraft(key); if (!active) return;
        if (saved) {
          if (saved.operation && (saved.operation.actorId !== actorId || saved.operation.organizationId !== scope.organizationId || saved.operation.candidateId !== profile.id || (saved.operation.pdf && await pdfDigest(saved.operation.pdf.bytes) !== saved.operation.pdf.sha256))) throw new Error("The stored operation identity or PDF integrity check failed.");
          if (saved.operation?.outcomes.databaseSync.state === "pending") saved.operation.outcomes.databaseSync.state = "unknown";
          if (saved.operation?.outcomes.pdfGeneration.state === "pending") saved.operation.outcomes.pdfGeneration.state = "failed";
          if (!active) return; setRaw(saved.rawJson); setJob(saved.job); setAssembly(saved.assembly); if (saved.assembly) setTemplateId(saved.assembly.templateVersionId); setMapping(saved.review); setOperation(saved.operation); setOutcomes(saved.operation?.outcomes ?? saved.outcomes ?? initialResumeOutcomes());
          setMessage("Restored this account’s local draft and operation outcomes.");
        }
        if (active) setJournalReady(true);
      } catch { if (active) setLocalError("Local draft restore failed. Existing data was not deleted. Durable operation actions require a working IndexedDB journal."); }
      finally { if (active) setReady(true); }
    })(); return () => { active = false; };
  }, [key, actorId, scope.organizationId, profile.id]);
  useEffect(() => {
    if (!ready || !journalReady || historical) return;
    const timer = setTimeout(() => { void saveStudioDraft(key, { rawJson: raw, job, assembly, review: mapping, operation, outcomes }).then(() => setLocalError(""), () => setLocalError("Local draft saving failed. Keep this page open; copy your source before leaving.")); }, 150);
    return () => clearTimeout(timer);
  }, [ready, journalReady, key, raw, job, assembly, mapping, operation, outcomes, historical]);
  useEffect(() => {
    let active = true;
    void Promise.all([readApi<PromptRow[]>(`/api/v1/prompts?${query}&candidateId=${profile.id}`), readApi<VersionRow[]>(`/api/v1/resume-versions?${query}&candidateId=${profile.id}`)]).then(([p, v]) => { if (active) { setPrompts(p); setVersions(v); } }, cause => { if (active) setMessage(cause instanceof Error ? cause.message : "Prompt/history loading failed."); });
    return () => { active = false; };
  }, [query, profile.id, tick]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (raw && !historical && outcomes.databaseSync.state !== "succeeded") e.preventDefault(); };
    window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave);
  }, [raw, historical, outcomes.databaseSync.state]);
  function fail(error: unknown) { setMessage(error instanceof Error ? error.message : "The operation failed. Original source and existing PDF bytes are retained."); }
  function stage(values: ResumeOutcomes, step: ResumeStep, state: ResumeOutcomes[ResumeStep]["state"], error: string | null = null): ResumeOutcomes {
    return { ...values, [step]: { state, attempts: values[step].attempts + (state === "pending" || step === "validation" || step === "clipboard" ? 1 : 0), error, updatedAt: new Date().toISOString() } };
  }
  async function keep(op: StudioOperation) {
    await saveStudioOperation(op); await saveStudioDraft(key, { rawJson: raw, job, assembly, review: mapping, operation: op, outcomes: op.outcomes }); setOperation(op); setOutcomes(op.outcomes); return op;
  }
  function makeOperation(): StudioOperation {
    if (!assembly || !reviewInput) throw new Error("Assemble a prompt and validate canonical JSON first.");
    const same = operation && operation.assemblyId === assembly.id && operation.rawJson === raw && JSON.stringify(operation.review) === JSON.stringify(reviewInput);
    if (same) return { ...structuredClone(operation), outcomes: structuredClone(outcomes) };
    return { id: crypto.randomUUID(), actorId, organizationId: scope.organizationId, candidateId: profile.id, assemblyId: assembly.id, rawJson: raw, review: structuredClone(reviewInput), renderedAt: new Date().toISOString(), payload: null, pdf: null, sourceId: null, outcomes: { ...initialResumeOutcomes(), clipboard: outcomes.clipboard } };
  }
  function editRaw(next: string) { setRaw(next); setMapping(null); setOperation(null); setHistorical(null); setHistoricalPdf(null); setChecked(false); setOutcomes(o => ({ ...initialResumeOutcomes(), clipboard: o.clipboard })); setMessage("Source changed. Validate and regenerate; earlier operations remain in the local journal."); }
  async function generate() {
    setChecked(true); if (!validation.content || !assembly || !reviewInput) { setOutcomes(o => stage(o, "validation", "failed", "Check JSON and assemble a prompt.")); return; }
    setBusy(true); setMessage(""); let op: StudioOperation | undefined;
    try {
      op = makeOperation(); if (op.payload) throw new Error("This operation is frozen for synchronization. Start a new operation to generate another PDF.");
      op.outcomes = stage(stage(op.outcomes, "validation", "succeeded"), "pdfGeneration", "pending"); await keep(op);
      const response = await readApi<Omit<StudioPdf, "bytes"> & { base64: string }>(`/api/v1/resume-renders?${query}`, { method: "POST", headers: { "X-Operation-Actor": actorId, "Content-Type": "application/json" }, body: JSON.stringify({ assemblyId: op.assemblyId, rawJson: op.rawJson, review: op.review, renderedAt: op.renderedAt }) });
      const generated = decodePdf(response); if (await pdfDigest(generated.bytes) !== generated.sha256) throw new Error("Returned PDF bytes failed their integrity check.");
      op.pdf = generated; op.outcomes = stage(op.outcomes, "pdfGeneration", "succeeded"); await keep(op); setMessage("PDF generated. Preview and export use these frozen bytes. Database synchronization has not been implied.");
    } catch (error) { if (op) { op.outcomes = stage(op.outcomes, "pdfGeneration", "failed", "PDF generation failed; source retained."); try { await keep(op); } catch { setLocalError("Operation outcome could not be persisted."); } } fail(error); }
    finally { setBusy(false); }
  }
  async function synchronize() {
    setChecked(true); if (!assembly || !reviewInput || !validation.content) return;
    if (!operation?.payload && !review?.reviewed && !confirm("Save this structurally valid source as UNVERIFIED? Unresolved facts remain flagged and any PDF retains its watermark.")) return;
    setBusy(true); setMessage(""); let op: StudioOperation | undefined; let sent = false;
    try {
      op = makeOperation(); if (!op.payload) op.payload = { operationId: op.id, assemblyId: op.assemblyId, schemaVersion: 1, rawJson: op.rawJson, review: structuredClone(op.review), render: op.pdf ? { sha256: op.pdf.sha256, pageCount: op.pdf.pageCount, rendererVersion: op.pdf.rendererVersion, renderedAt: op.pdf.renderedAt } : null };
      op.outcomes = stage(op.outcomes, "databaseSync", "pending"); await keep(op); sent = true;
      const source = await readApi<ResumeSourceVersion>(`/api/v1/resume-versions?${query}`, { method: "POST", headers: { "X-Operation-Actor": actorId, "Content-Type": "application/json", "Idempotency-Key": op.id }, body: JSON.stringify(op.payload) });
      op.sourceId = source.id; op.outcomes = stage(op.outcomes, "databaseSync", "succeeded"); await keep(op); setTick(n => n + 1); setMessage(`Immutable source version ${source.version} saved${source.replayed ? " (existing result reconciled)" : ""}. No application was submitted.`);
    } catch (error) {
      if (op) { op.outcomes = stage(op.outcomes, "databaseSync", sent && (!(error instanceof ClientApiFailure) || error.status >= 500) ? "unknown" : "failed", "Synchronization did not return a confirmed result. Original key, payload and PDF are retained."); try { await keep(op); } catch { setLocalError("Frozen operation exists, but its latest outcome could not be persisted. Reconcile the original operation key."); } } fail(error);
    } finally { setBusy(false); }
  }
  async function reconcile() {
    if (!operation) return; setBusy(true);
    try { const rows = await readApi<VersionRow[]>(`/api/v1/resume-versions?${query}&candidateId=${profile.id}&operationId=${operation.id}`);
      if (rows[0]) { await keep({ ...operation, sourceId: rows[0].id, outcomes: stage(operation.outcomes, "databaseSync", "succeeded") }); setTick(n => n + 1); setMessage("Original operation is persisted. No new source version was created."); }
      else setMessage("No persisted result was found at this check. Status remains uncertain; retry the original frozen operation with the same key.");
    } catch (error) { fail(error); } finally { setBusy(false); }
  }
  async function exportPdf() {
    if (!pdf) return; setBusy(true);
    try {
      if (await pdfDigest(pdf.bytes) !== pdf.sha256) throw new Error("Frozen PDF integrity check failed. Export was blocked.");
      const op = operation ? structuredClone(operation) : null; if (op && !historical) { op.outcomes = stage(op.outcomes, "localExport", "pending"); await keep(op); }
      const objectUrl = URL.createObjectURL(new Blob([new Uint8Array(pdf.bytes)], { type: "application/pdf" })); const anchor = document.createElement("a");
      const naming = op ?? { id: historical?.operationId ?? crypto.randomUUID(), renderedAt: pdf.renderedAt } as StudioOperation;
      anchor.download = safeResumeFilename(snapshot.fullName, validation.content?.company ?? "", validation.content?.title ?? "", naming); anchor.href = objectUrl; anchor.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      if (op && !historical) { op.outcomes = stage(op.outcomes, "localExport", "initiated"); await keep(op); } else setOutcomes(o => stage(o, "localExport", "initiated"));
      setMessage("Download initiated. The browser cannot confirm that the file was kept; database synchronization is independent.");
    } catch (error) { setOutcomes(o => stage(o, "localExport", "failed", "Download could not be initiated.")); fail(error); } finally { setBusy(false); }
  }
  return <div className="grid gap-5">
    <nav className="flex flex-wrap gap-4"><a className="underline" href={`/candidates/${profile.id}?${query}&tab=resumes`}>Candidate workspace</a><a className="underline" href={`/candidates/${profile.id}/letters?${query}`}>Cover letters</a><a className="underline" href={`/documents?${query}&candidateId=${profile.id}`}>Document history</a><span>{profile.fullName ?? "Untitled draft"} · Profile revision {profile.rowVersion}</span></nav>
    {profile.status === "archived" && <p role="status" className="rounded border p-3">Archived candidate: new assembly/generation/saving is disabled. Existing source history remains readable.</p>}
    {localError && <p role="alert">{localError}</p>}{message && <p role="status" className="rounded border bg-white p-3">{message}</p>}
    <section aria-label="Independent operation outcomes" className="rounded border bg-white p-3"><h2 className="font-semibold">Operation outcomes</h2><dl className="mt-2 grid gap-2 text-sm sm:grid-cols-5">{Object.entries(outcomes).map(([step, result]) => <div key={step}><dt>{step}</dt><dd data-testid={`outcome-${step}`}>{result.state}</dd><dd className="text-xs">Attempts: {result.attempts}{result.error && <p>{result.error}</p>}</dd></div>)}</dl>{operation && <p className="mt-2 break-all text-xs">Operation: <span data-testid="operation-id">{operation.id}</span></p>}</section>
    {uncertain && <div role="alert" className="rounded border border-amber-500 p-3">Database result is uncertain. PDF/export remain available. Reconcile or retry the frozen request before editing it.<div className="mt-2 flex gap-3"><button className={button} disabled={busy} onClick={() => void reconcile()}>Reconcile original operation</button><button className={primary} disabled={busy} onClick={() => void synchronize()}>Retry original synchronization</button></div></div>}
    <section className="grid gap-3 rounded border bg-white p-4"><h2 className="text-lg font-semibold">Prompt and reviewed job</h2><p className="text-sm">The external AI prompt includes professional summary, verified work, education and certifications. It excludes contact details, professional links and private notes. Review the exact text before copying it to an external service.</p>
      <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2"><label>Target company<input aria-label="Target company" className={control} maxLength={200} value={job.company} onChange={e => { setJob({ ...job, company: e.target.value }); setAssembly(null); setOperation(null); setOutcomes(initialResumeOutcomes()); }} /></label><label>Target role<input aria-label="Target role" className={control} maxLength={200} value={job.title} onChange={e => { setJob({ ...job, title: e.target.value }); setAssembly(null); setOperation(null); setOutcomes(initialResumeOutcomes()); }} /></label><label className="sm:col-span-2">Reviewed job description<textarea className={control} rows={4} value={job.description} onChange={e => { setJob({ ...job, description: e.target.value }); setAssembly(null); setOperation(null); setOutcomes(initialResumeOutcomes()); }} /></label></fieldset>
      <div className="flex flex-wrap gap-3"><button className={primary} disabled={disabled} onClick={async () => {
        setBusy(true); try { const result = await readApi<PromptAssembly>(`/api/v1/prompt-assemblies?${query}`, { method: "POST", headers: { "X-Operation-Actor": actorId, "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: profile.id, profileRevision: profile.rowVersion, job, templateVersionId: templateId }) }); setAssembly(result); setMapping(null); setOperation(null); setOutcomes(initialResumeOutcomes()); setMessage("Exact prompt assembled and frozen. Copy writes this preview without changes."); } catch (error) { fail(error); } finally { setBusy(false); }
      }}>Assemble prompt</button><button className={button} disabled={!assembly || busy} onClick={async () => {
        if (!assembly) return; let next: ResumeOutcomes;
        try { await navigator.clipboard.writeText(assembly.text); next = stage(outcomes, "clipboard", "succeeded"); setMessage("Exact previewed prompt copied."); }
        catch { next = stage(outcomes, "clipboard", "failed", "Clipboard permission denied; select the exact preview text manually."); setMessage("Clipboard failed. The exact prompt remains in the preview for manual copying."); }
        setOutcomes(next); if (operation) try { await keep({ ...operation, outcomes: next }); } catch { setLocalError("Clipboard result could not be journaled. The actual clipboard outcome is shown above."); }
      }}>Copy Prompt</button></div>
      {assembly && <details open><summary className="cursor-pointer font-medium">Exact prompt preview · revision {assembly.profileRevision}</summary><textarea aria-label="Exact prompt preview" readOnly value={assembly.text} rows={9} className={`${control} font-mono`} /><p className="break-all text-xs">Assembly {assembly.id} · SHA-256 {assembly.sha256}</p></details>}
      <PromptEditor scope={scope} profile={profile} prompts={prompts} disabled={disabled} refresh={() => setTick(n => n + 1)} report={setMessage} />
    </section>
    {stale && <p role="alert">This assembly uses an older profile revision. Assemble again and re-review before a new render/save. Existing immutable PDFs remain recoverable.</p>}
    {historical && <p className="rounded border bg-amber-50 p-3">Historical source version {historical.version} · read-only.<button className={`${button} ml-3`} onClick={() => { setHistorical(null); setHistoricalPdf(null); setOperation(null); setOutcomes(initialResumeOutcomes()); setMessage("Loaded content is now a new draft. Assemble against the current profile before saving a new version."); }}>Edit as new draft</button></p>}
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <aside className="grid gap-4 xl:col-span-3"><TemplateLibrary scope={scope} profile={profile} selected={templateId} onSelect={id => { setTemplateId(id); setAssembly(null); setOperation(null); setOutcomes(initialResumeOutcomes()); setMessage("Template selected. Assemble a new prompt and regenerate to use this frozen version."); }} disabled={disabled} report={setMessage} />
        <section className="rounded border bg-white p-4"><h2 className="font-semibold">Immutable source history</h2><p className="text-xs">Most recent 50 versions.</p><ul className="mt-3 grid gap-2">{versions.map(v => <li key={v.id}><button className={`${button} w-full text-left`} disabled={busy || uncertain} onClick={async () => {
          if (raw && !confirm("Load this historical source? Your current operation is retained in the journal; the editor will show the selected version.")) return;
          setBusy(true); try { const source = await readApi<ResumeSourceVersion>(`/api/v1/resume-versions/${v.id}?${query}`); const origin = await readApi<PromptAssembly>(`/api/v1/prompt-assemblies/${source.assemblyId}?${query}`);
            setHistorical(source); setRaw(source.rawJson); setMapping(source.provenance.mapping); setAssembly(origin); setTemplateId(source.templateVersionId); setJob(origin.job); setOperation(null); setHistoricalPdf(null); setOutcomes(initialResumeOutcomes());
            if (source.render) { const result = decodePdf(await readApi<Omit<StudioPdf, "bytes"> & { base64: string }>(`/api/v1/resume-versions/${v.id}/pdf?${query}`)); if (await pdfDigest(result.bytes) !== source.render.sha256) throw new Error("Historical PDF hash mismatch; export blocked."); setHistoricalPdf(result); }
            setMessage(`Historical source ${source.version} loaded. ${source.render ? "Recovered PDF matches its recorded hash." : "No PDF was recorded for this source version."}`);
          } catch (error) { fail(error); } finally { setBusy(false); }
        }}>Version {v.version} · {v.reviewed ? "reviewed" : "unverified"}<span className="block text-xs">{new Date(v.createdAt).toLocaleString()}</span></button></li>)}</ul>{!versions.length && <p className="mt-2 text-sm">No source versions returned.</p>}</section>
      </aside>
      <section className="grid gap-3 rounded border bg-white p-4 xl:col-span-6"><h2 className="text-lg font-semibold">Resume PDF</h2><div className="flex flex-wrap gap-2"><button className={primary} disabled={disabled || !assembly || stale || !!operation?.payload} onClick={() => void generate()}>Generate PDF</button><button className={button} disabled={busy || !pdf} onClick={() => void exportPdf()}>Export PDF</button></div>
        {pdf ? <><ProductionPdfPreview bytes={pdf.bytes} sha256={pdf.sha256} text={pdf.text} />{pdf.warnings.map((w, i) => <p className="text-sm" key={i}>{w}</p>)}</> : <p>Validate and review the source, then generate PDF. Unverified content can be previewed with a watermark.</p>}
      </section>
      <section className="grid gap-3 rounded border bg-white p-4 xl:col-span-3"><h2 className="text-lg font-semibold">Resume JSON</h2><label htmlFor="resume-json" className="text-sm">Original JSON response</label><textarea id="resume-json" className={`${control} min-h-96 font-mono text-xs`} value={raw} spellCheck={false} disabled={disabled} onChange={e => editRaw(e.target.value)} />
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !ready} onClick={() => { setChecked(true); setOutcomes(o => stage(o, "validation", validation.content ? "succeeded" : "failed", validation.content ? null : "Check field errors; original text retained.")); setMessage(validation.content ? "Canonical structure valid. Review warnings and factual evidence separately." : "Invalid JSON/structure. Original input retained."); }}>Validate JSON</button>
          <button className={button} disabled={disabled} onClick={() => { setChecked(true); if (validation.content) editRaw(JSON.stringify(JSON.parse(raw), null, 2)); else setMessage("Format blocked by invalid JSON. Original input retained."); }}>Format JSON</button>
          <button className={button} disabled={disabled} onClick={() => { if (!raw || confirm("Replace the editor with JSON copied from this synthetic/verified candidate snapshot?")) editRaw(JSON.stringify({ company: job.company, title: job.title, summary: snapshot.professionalSummary ?? "", skills: [], experience: snapshot.experiences.map(w => ({ title: w.titlePolicy === "tailorable" ? w.approvedDisplayTitle ?? w.officialTitle ?? "" : w.officialTitle ?? "", company: w.company ?? "", sentences: w.sourceBullets })), education: snapshot.educations.map(e => ({ degree: [e.degree, e.fieldOfStudy].filter(Boolean).join(" in ") })) }, null, 2)); }}>Load verified facts</button>
          <button className={button} disabled={disabled} onClick={() => { if (confirm("Clear the editor? Prior operations and saved versions remain unchanged.")) editRaw(""); }}>Clear JSON</button></div>
        {checked && validation.errors.map((e, i) => <p role="alert" key={i} className="text-sm text-red-800">{e.path || "/"}: {e.message}</p>)}
        {validation.content && <details><summary className="cursor-pointer text-sm">Content warnings ({validation.warnings.length})</summary><ul className="text-xs">{validation.warnings.map((w, i) => <li key={i}>{w.path || "/"}: {w.message}</li>)}</ul></details>}
        <button className={primary} disabled={busy || !ready || !journalReady || !assembly || stale || !!historical || profile.status === "archived" || !validation.content || outcomes.databaseSync.state === "succeeded"} onClick={() => void synchronize()}>{operation?.payload ? "Retry original synchronization" : review?.reviewed ? "Save reviewed source" : "Save unverified source"}</button>
        <button className={button} disabled={busy || uncertain || !operation} onClick={() => { setOperation(null); setOutcomes(initialResumeOutcomes()); setMessage("New operation will use a new UUID. Earlier frozen operations remain retained."); }}>Start new operation</button>
      </section>
    </div>
    {validation.content && review && reviewInput && <FactReview content={validation.content} snapshot={snapshot} review={review} value={reviewInput} disabled={disabled} onChange={v => { setMapping(v); setOperation(null); setOutcomes(o => ({ ...initialResumeOutcomes(), clipboard: o.clipboard })); setMessage("Review changed. Regenerate PDF to reflect this exact review."); }} />}
    {(historical?.render || (operation?.sourceId && operation.pdf)) && <button className={button} disabled={busy} onClick={async () => { setBusy(true); try { await readApi(`/api/v1/documents?${query}`, { method: "POST", headers: { "X-Operation-Actor": actorId, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "resume", sourceVersionId: historical?.id ?? operation?.sourceId }) }); setTick(n => n + 1); setMessage("Exact frozen resume PDF stored. Local export and submission remain separate."); } catch (error) { fail(error); } finally { setBusy(false); } }}>Store exact resume PDF</button>}
    <DocumentHistory scope={scope} candidateId={profile.id} refresh={tick} />
  </div>;
}
