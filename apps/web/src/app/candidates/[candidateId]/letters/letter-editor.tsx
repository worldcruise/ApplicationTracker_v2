"use client";
import { useEffect, useState } from "react";
import type { CandidateProfile, CoverLetterVersion, OrganizationScope, ResumeOutcomes, ResumeReviewInput, ResumeStep } from "@candidate/contracts";
import { reviewResume } from "@candidate/domain";
import { readApi, ClientApiFailure } from "@/app/workspace/requests";
import { loadLetterDraft, saveLetterDraft, saveLetterOperation, type LetterOperation } from "@/lib/documents/journal";
import { initialResumeOutcomes, pdfDigest, studioKey, type StudioPdf } from "@/lib/resumes/journal";
import { TemplateLibrary } from "../studio/template-library";
import { FactReview } from "../studio/fact-review";
import { ProductionPdfPreview } from "../studio/pdf-preview";
import { DocumentHistory } from "@/app/documents/document-history";
import { button, control, primary } from "../../directory";
const emptyReview = (): ResumeReviewInput => ({ experienceIds: [], educationIds: [], claims: {} });
const contentFor = (text: string) => ({ company: "", title: "", summary: text, skills: [], experience: [], education: [] });
type Row = { id: string; version: number; reviewed: boolean; createdAt: string };
function decode(result: Omit<StudioPdf,"bytes"> & { base64: string }): StudioPdf { const { base64, ...meta } = result; return { ...meta, bytes: Uint8Array.from(atob(base64), c => c.charCodeAt(0)) }; }
function stage(o: ResumeOutcomes, step: ResumeStep, state: ResumeOutcomes[ResumeStep]["state"], error: string | null = null): ResumeOutcomes {
  return { ...o, [step]: { state, error, attempts: o[step].attempts + (state === "pending" || step === "validation" || step === "clipboard" ? 1 : 0), updatedAt: new Date().toISOString() } };
}
export function LetterEditor({ profile, scope, actorId }: { profile: CandidateProfile; scope: OrganizationScope; actorId: string }) {
  const [text, setText] = useState(""); const [templateId, setTemplateId] = useState("a7000000-0000-4000-9000-000000000001"); const [bidId, setBidId] = useState(""); const [mapping, setMapping] = useState(emptyReview);
  const [operation, setOperation] = useState<LetterOperation | null>(null); const [outcomes, setOutcomes] = useState(initialResumeOutcomes); const [history, setHistory] = useState<Row[]>([]);
  const [historical, setHistorical] = useState<CoverLetterVersion | null>(null); const [historicalPdf, setHistoricalPdf] = useState<StudioPdf | null>(null);
  const [ready, setReady] = useState(false); const [journalReady, setJournalReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [tick, setTick] = useState(0);
  const query = `organizationId=${scope.organizationId}`; const key = studioKey(actorId,scope.organizationId,profile.id);
  const snapshot = historical?.snapshot ?? profile; const content = contentFor(text); const review = reviewResume(content,snapshot,mapping);
  const uncertain = operation?.outcomes.databaseSync.state === "unknown"; const frozen = !!operation?.payload;
  const disabled = busy || !ready || !journalReady || !!historical || uncertain || profile.status === "archived";
  const pdf = historical ? historicalPdf : operation?.pdf ?? null;
  useEffect(() => { let active = true;
    void (async () => { try { const saved = await loadLetterDraft(key); if (!active) return;
      if (saved) { const op = saved.operation; if (op && (op.actorId !== actorId || op.organizationId !== scope.organizationId || op.candidateId !== profile.id || (op.pdf && await pdfDigest(op.pdf.bytes) !== op.pdf.sha256))) throw new Error("Stored identity or hash mismatch.");
        if (op?.outcomes.databaseSync.state === "pending") op.outcomes.databaseSync.state = "unknown";
        if (op?.outcomes.pdfGeneration.state === "pending") op.outcomes.pdfGeneration.state = "failed";
        if (!active) return; setText(saved.bodyText); setTemplateId(saved.templateId); setBidId(saved.bidId); setMapping(saved.review); setOperation(op); if (op) setOutcomes(op.outcomes); }
      if (active) setJournalReady(true);
    } catch { if (active) setMessage("Local restore failed. Existing data was retained. Export/copy your text and restore IndexedDB access before starting durable operations."); }
    finally { if (active) setReady(true); } })(); return () => { active = false; };
  }, [key,actorId,scope.organizationId,profile.id]);
  useEffect(() => { if (!ready || !journalReady || historical) return; const timer = setTimeout(() => { void saveLetterDraft(key,{ bodyText: text,templateId,bidId,review:mapping,operation }).catch(() => setMessage("Local draft saving failed; copy your text before leaving.")); },150); return () => clearTimeout(timer); }, [ready,journalReady,historical,key,text,templateId,bidId,mapping,operation]);
  useEffect(() => { let active = true; void readApi<Row[]>(`/api/v1/cover-letter-versions?${query}&candidateId=${profile.id}`).then(rows => { if (active) setHistory(rows); }, e => { if (active) setMessage(e instanceof Error ? e.message : "History lookup failed."); }); return () => { active=false; }; },[query,profile.id,tick]);
  useEffect(() => { const leave = (e: BeforeUnloadEvent) => { if (text && !historical && outcomes.databaseSync.state !== "succeeded") e.preventDefault(); }; window.addEventListener("beforeunload",leave); return () => window.removeEventListener("beforeunload",leave); },[text,historical,outcomes.databaseSync.state]);
  function report(e: unknown) { setMessage(e instanceof Error ? e.message : "Operation failed. Original text and existing PDF retained."); }
  function change(next: string) { setText(next); setMapping(emptyReview()); setOperation(null); setOutcomes(initialResumeOutcomes()); }
  async function keep(op: LetterOperation) { await saveLetterOperation(op); await saveLetterDraft(key,{ bodyText: op.bodyText,templateId:op.templateVersionId,bidId:op.bidId ?? "",review:op.review,operation:op }); setOperation(op); setOutcomes(op.outcomes); return op; }
  function makeOperation(): LetterOperation {
    if (operation) return structuredClone(operation);
    return { id:crypto.randomUUID(),actorId,organizationId:scope.organizationId,candidateId:profile.id,profileRevision:profile.rowVersion,templateVersionId:templateId,bidId:bidId || null,bodyText:text,review:structuredClone(mapping),renderedAt:new Date().toISOString(),payload:null,pdf:null,sourceId:null,outcomes:structuredClone(outcomes) };
  }
  async function generate() {
    setBusy(true); let op: LetterOperation | undefined;
    try { op=makeOperation(); if (op.payload) throw new Error("This operation is frozen. Start a new draft to generate a different PDF.");
      op.outcomes=stage(stage(op.outcomes,"validation","succeeded"),"pdfGeneration","pending"); await keep(op);
      const response=await readApi<Omit<StudioPdf,"bytes"> & {base64:string}>(`/api/v1/cover-letter-renders?${query}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidateId:op.candidateId,profileRevision:op.profileRevision,templateVersionId:op.templateVersionId,bodyText:op.bodyText,review:op.review,renderedAt:op.renderedAt})});
      const next=decode(response); if (await pdfDigest(next.bytes)!==next.sha256) throw new Error("PDF hash mismatch; preview/export blocked."); op.pdf=next; op.outcomes=stage(op.outcomes,"pdfGeneration","succeeded"); await keep(op); setMessage("PDF generated. Preview and export use the same frozen bytes. Database saving is independent.");
    } catch(e) { if(op) { op.outcomes=stage(op.outcomes,"pdfGeneration","failed","PDF generation failed; original text retained."); try {await keep(op);} catch {setJournalReady(false);} } report(e); } finally {setBusy(false);}
  }
  async function save() {
    if (!operation?.payload && !review.reviewed && !confirm("Save an UNVERIFIED letter version? Unresolved facts retain a watermark and cannot be linked for bidder export.")) return;
    setBusy(true); let op: LetterOperation | undefined; let sent=false;
    try { op=makeOperation(); if(!op.payload) op.payload={operationId:op.id,candidateId:op.candidateId,bidId:op.bidId,schemaVersion:1,profileRevision:op.profileRevision,templateVersionId:op.templateVersionId,bodyText:op.bodyText,review:op.review,render:op.pdf ? {sha256:op.pdf.sha256,pageCount:op.pdf.pageCount,rendererVersion:op.pdf.rendererVersion,renderedAt:op.pdf.renderedAt} : null};
      op.outcomes=stage(op.outcomes,"databaseSync","pending"); await keep(op); sent=true;
      const row=await readApi<CoverLetterVersion>(`/api/v1/cover-letter-versions?${query}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":op.id},body:JSON.stringify(op.payload)});
      op.sourceId=row.id; op.outcomes=stage(op.outcomes,"databaseSync","succeeded"); await keep(op); setTick(n=>n+1); setMessage(`Immutable cover letter version ${row.version} saved. No application submitted.`);
    } catch(e) { if(op) {op.outcomes=stage(op.outcomes,"databaseSync",sent && (!(e instanceof ClientApiFailure) || e.status>=500) ? "unknown":"failed","Original operation key/payload retained. Reconcile or retry this exact request."); try {await keep(op);} catch {setJournalReady(false);} } report(e); } finally {setBusy(false);}
  }
  async function download(kind:"pdf"|"text") {
    setBusy(true); try {
      if(kind==="pdf" && (!pdf || await pdfDigest(pdf.bytes)!==pdf.sha256)) throw new Error("Generate/retrieve the PDF and verify its hash first.");
      const value=kind==="pdf" ? new Uint8Array(pdf!.bytes) : text; const url=URL.createObjectURL(new Blob([value],{type:kind==="pdf" ? "application/pdf":"text/plain;charset=utf-8"}));
      const a=document.createElement("a"); a.href=url; a.download=`CoverLetter_${(historical?.createdAt ?? operation?.renderedAt ?? new Date().toISOString()).slice(0,10)}__${(historical?.operationId ?? operation?.id ?? crypto.randomUUID()).slice(0,8)}.${kind==="pdf" ? "pdf":"txt"}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      const next=stage(outcomes,"localExport","initiated"); setOutcomes(next); if(operation && !historical) await keep({...operation,outcomes:next}); setMessage("Download initiated. The browser cannot confirm that the file was kept. Database saving is independent.");
    } catch(e) {setOutcomes(o=>stage(o,"localExport","failed","Download initiation failed."));report(e);} finally {setBusy(false);}
  }
  return <div className="grid gap-5">
    <nav className="flex flex-wrap gap-4"><a className="underline" href={`/candidates/${profile.id}/studio?${query}`}>Resume Studio</a><a className="underline" href={`/candidates/${profile.id}?${query}&tab=resumes`}>Candidate workspace</a><a className="underline" href={`/documents?${query}&candidateId=${profile.id}`}>Document history</a></nav>
    {message && <p role="status" className="rounded border bg-white p-3">{message}</p>}{profile.status==="archived" && <p>Archived candidate: historical retrieval remains available; new letter versions are disabled.</p>}
    <section className="rounded border bg-white p-3"><h2 className="font-semibold">Letter operation outcomes</h2><dl className="grid gap-2 text-sm sm:grid-cols-5">{Object.entries(outcomes).map(([name,value])=><div key={name}><dt>{name}</dt><dd data-testid={`letter-${name}`}>{value.state}</dd><dd className="text-xs">Attempts: {value.attempts} {value.error}</dd></div>)}</dl>{operation && <p className="break-all text-xs">Operation: <span data-testid="letter-operation-id">{operation.id}</span></p>}</section>
    {uncertain && <div role="alert">Synchronization is uncertain; the editor is frozen and local export remains available.<button className={button} disabled={busy} onClick={()=>void save()}>Retry original letter synchronization</button><button className={button} disabled={busy} onClick={async()=>{if(!operation)return;setBusy(true);try{const rows=await readApi<Row[]>(`/api/v1/cover-letter-versions?${query}&candidateId=${profile.id}&operationId=${operation.id}`);if(rows[0]){await keep({...operation,sourceId:rows[0].id,outcomes:stage(operation.outcomes,"databaseSync","succeeded")});setTick(n=>n+1);setMessage("Original operation reconciled.");}else setMessage("No confirmed result found. Retry the original frozen request.");}catch(e){report(e);}finally{setBusy(false);}}}>Reconcile original letter operation</button></div>}
    {historical && <p>Historical letter version {historical.version} · read-only. <button className={button} onClick={()=>{setHistorical(null);setHistoricalPdf(null);setOperation(null);setMapping(emptyReview());setOutcomes(initialResumeOutcomes());setMessage("Historical text copied into a new draft. Re-review against the current profile.");}}>Edit letter as new draft</button></p>}
    <div className="grid items-start gap-4 xl:grid-cols-12"><aside className="grid gap-3 xl:col-span-3"><TemplateLibrary scope={scope} profile={profile} selected={templateId} disabled={disabled || frozen} report={setMessage} onSelect={id=>{setTemplateId(id);setOperation(null);setOutcomes(initialResumeOutcomes());}} />
      <section className="rounded border bg-white p-3"><h2 className="font-semibold">Letter version history</h2><p className="text-xs">Most recent 50 versions.</p><ul className="mt-2 grid gap-2">{history.map(row=><li key={row.id}><button className={button} disabled={busy || uncertain} onClick={async()=>{if(text && !confirm("Load a historical letter? The current operation remains in the local journal."))return;setBusy(true);try{const letter=await readApi<CoverLetterVersion>(`/api/v1/cover-letter-versions/${row.id}?${query}`);setHistorical(letter);setText(letter.bodyText);setMapping(letter.provenance.mapping);setTemplateId(letter.templateVersionId);setBidId(letter.bidId ?? "");setOperation(null);setHistoricalPdf(null);setOutcomes(initialResumeOutcomes());if(letter.render){const result=decode(await readApi<Omit<StudioPdf,"bytes"> & {base64:string}>(`/api/v1/cover-letter-versions/${row.id}/pdf?${query}`));if(await pdfDigest(result.bytes)!==letter.render.sha256)throw new Error("Historical PDF hash mismatch.");setHistoricalPdf(result);}setMessage("Loaded immutable letter version and frozen profile/template.");}catch(e){report(e);}finally{setBusy(false);}}}>Letter version {row.version} · {row.reviewed ? "reviewed":"unverified"}</button></li>)}</ul></section>
    </aside><section className="grid gap-3 rounded border bg-white p-4 xl:col-span-5"><h2 className="text-lg font-semibold">Cover letter PDF</h2><div className="flex flex-wrap gap-2"><button className={primary} disabled={disabled || frozen} onClick={()=>void generate()}>Generate letter PDF</button><button className={button} disabled={busy || !pdf} onClick={()=>void download("pdf")}>Export letter PDF</button></div>{pdf ? <ProductionPdfPreview bytes={pdf.bytes} sha256={pdf.sha256} text={pdf.text} />:<p>Generate after reviewing the text. Unverified drafts receive a watermark.</p>}</section>
    <section className="grid gap-3 rounded border bg-white p-4 xl:col-span-4"><h2 className="text-lg font-semibold">Letter text</h2><label htmlFor="letter-text">Original cover letter</label><textarea id="letter-text" className={`${control} min-h-96`} disabled={disabled || frozen} value={text} onChange={e=>change(e.target.value)} />
      <label>Optional existing bid reference<input className={control} disabled={disabled || frozen} value={bidId} onChange={e=>{setBidId(e.target.value);setOperation(null);}} /></label>
      <button className={button} disabled={disabled || frozen} onClick={()=>{if(!text || confirm("Replace the letter with the verified summary for a synthetic test?"))change(profile.professionalSummary ?? "");}}>Load verified summary</button>
      <button className={primary} disabled={busy || !journalReady || !!historical || profile.status==="archived" || outcomes.databaseSync.state==="succeeded"} onClick={()=>void save()}>{operation?.payload ? "Retry original letter save":"Save letter version"}</button>
      <button className={button} disabled={busy || !text} onClick={()=>void download("text")}>Export letter text</button><button className={button} disabled={busy || !text} onClick={async()=>{let next:ResumeOutcomes;try{await navigator.clipboard.writeText(text);next=stage(outcomes,"clipboard","succeeded");setMessage("Exact letter text copied.");}catch{next=stage(outcomes,"clipboard","failed","Clipboard denied. Select the original text manually.");setMessage("Clipboard failed. Original text remains available.");}setOutcomes(next);if(operation && !historical)try{await keep({...operation,outcomes:next});}catch(e){report(e);}}}>Copy letter text</button>
      <button className={button} disabled={busy || uncertain || !operation} onClick={()=>{setOperation(null);setOutcomes(initialResumeOutcomes());setMessage("New draft operation. Original saved version and journal entry are retained.");}}>Start new letter operation</button>
      <p className="text-xs">Plain text up to 200 KiB. Schema v1, profile revision {historical?.snapshot.rowVersion ?? profile.rowVersion}. Version publication appends; previous text/PDFs remain frozen.</p>
    </section></div>
    <FactReview content={content} snapshot={snapshot} review={review} value={mapping} disabled={disabled || frozen} onChange={v=>{setMapping(v);setOperation(null);setOutcomes(initialResumeOutcomes());}} />
    {(historical?.render || (operation?.sourceId && operation.pdf)) && <button className={button} disabled={busy} onClick={async()=>{setBusy(true);try{await readApi(`/api/v1/documents?${query}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"cover_letter",sourceVersionId:historical?.id ?? operation?.sourceId})});setTick(n=>n+1);setMessage("Exact frozen letter PDF stored. Local export and submission are separate.");}catch(e){report(e);}finally{setBusy(false);}}}>Store exact letter PDF</button>}
    <DocumentHistory scope={scope} candidateId={profile.id} refresh={tick} />
  </div>;
}
