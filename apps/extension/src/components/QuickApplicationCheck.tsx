import {useEffect,useRef,useState} from "react";
import type {ArchiveHistory,CaptureContext,DatabaseHistory,HistoryMatch,ReviewedJobContext} from "@candidate/contracts";
import {validateHistoryContext} from "@candidate/domain";
import {archiveHistory} from "../archive";
import {ExtensionApiError,type ExtensionApi} from "../api";
import {CAPTURE_COMMAND,type CaptureScope} from "../capture";
import {chooseDirectory,restoreDirectory,renewDirectory,type DirectorySelection} from "../directory";
import {localStore} from "../local-store";

const blank:ReviewedJobContext={company:"",title:"",url:"",description:"",externalId:""};
interface Draft {revision:number;context:ReviewedJobContext;pageTitle:string;captureId:string|null}
interface DbState {state:"idle"|"pending"|"found"|"not_found"|"unknown"|"check_failed"|"permission_required";data?:DatabaseHistory;message?:string}
export function QuickApplicationCheck({api,scope,web}:{api:ExtensionApi;scope:CaptureScope;web:(path:string)=>string}){
  const captureId=new URLSearchParams(location.search).get("captureId");
  const [context,setContext]=useState<ReviewedJobContext>(blank),[capture,setCapture]=useState<CaptureContext|null>(null),[pageTitle,setPageTitle]=useState("");
  const [ready,setReady]=useState(false),[localError,setLocalError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[open,setOpen]=useState(!!captureId);
  const [database,setDatabase]=useState<DbState>({state:"idle"}),[local,setLocal]=useState<ArchiveHistory|null>(null),[localPending,setLocalPending]=useState(false),[checked,setChecked]=useState<ReviewedJobContext|null>(null);
  const [directory,setDirectory]=useState<DirectorySelection>({permission:"none"}),[shortcut,setShortcut]=useState("");
  const key="quick-draft:"+scope.actorId+":"+scope.organizationId+":"+scope.candidateId+":"+(captureId??"manual");
  const revision=useRef(0),pending=useRef(Promise.resolve()),epoch=useRef(0);
  const usable=!capture||(capture.actorId===scope.actorId&&capture.organizationId===scope.organizationId&&capture.candidateId===scope.candidateId);
  useEffect(()=>{let live=true;void(async()=>{try{
    const stored=await localStore().get<Draft>(key);
    if(captureId&&/^[0-9a-f-]{36}$/iu.test(captureId)){const row=await localStore().get<CaptureContext>("quick-capture:"+captureId);if(live&&row)setCapture(row);
      if(!stored&&row?.actorId===scope.actorId&&row.organizationId===scope.organizationId&&row.candidateId===scope.candidateId){if(live){setContext({company:row.company,title:row.pageTitle.slice(0,200),url:row.url,description:row.description,externalId:""});setPageTitle(row.pageTitle);}}
    }
    if(stored&&live){revision.current=stored.revision;setContext(stored.context);setPageTitle(stored.pageTitle);}
    if(live)setReady(true);
  }catch{if(live)setLocalError("Local check draft/capture could not be restored. Preserve your text before reloading.");}})();
  void restoreDirectory().then(r=>{if(live)setDirectory(r);}).catch(()=>{if(live)setMessage("Archive root permission could not be checked.");});
  void chrome.commands.getAll().then(rows=>{if(live)setShortcut(rows.find(r=>r.name===CAPTURE_COMMAND)?.shortcut??"");});
  return()=>{live=false;epoch.current++;};},[key]);
  function save(next:ReviewedJobContext,title=pageTitle){
    setContext(next);setDatabase({state:"idle"});setLocal(null);setChecked(null);epoch.current++;
    pending.current=pending.current.then(async()=>{const row=await localStore().change<Draft>(key,old=>{if((old?.revision??0)!==revision.current)throw Error("Another workspace changed this check draft. Preserve your input and reload before continuing.");return {revision:revision.current+1,context:next,pageTitle:title,captureId};});revision.current=row.revision;}).catch(error=>{setLocalError(error.message);throw error;});void pending.current.catch(()=>{});
  }
  async function adopt(){try{
    if(!captureId)return;
    const row=await api.withActor(scope.actorId,()=>localStore().change<CaptureContext>("quick-capture:"+captureId,old=>{if(!old||old.actorId&&old.actorId!==scope.actorId)throw Error("This capture belongs to another account.");if(old.actorId&&(old.organizationId!==scope.organizationId||old.candidateId!==scope.candidateId))throw Error("Select the capture's original organization/candidate.");return {...old,...scope};}));
    setCapture(row);setPageTitle(row.pageTitle);save({company:row.company,title:row.pageTitle.slice(0,200),url:row.url,description:row.description,externalId:""},row.pageTitle);
  }catch(error){setMessage(error instanceof Error?error.message:"Capture unavailable.");}}
  async function check(){
    let reviewed:ReviewedJobContext;try{reviewed=validateHistoryContext(context);await pending.current;}catch(error){setMessage(error instanceof Error?error.message:"Review the job fields.");return;}
    const run=++epoch.current;setBusy(true);setMessage("");setChecked(reviewed);setDatabase({state:"pending"});setLocal(null);setLocalPending(true);
    const databaseTask=api.request<DatabaseHistory>("application-history?organizationId="+scope.organizationId,{actorId:scope.actorId,organizationId:scope.organizationId,body:{candidateId:scope.candidateId,context:reviewed}})
      .then(data=>{if(epoch.current===run)setDatabase({state:data.truncated?"unknown":data.company.length||data.possible.length?"found":"not_found",data,message:data.truncated?"Only the latest 100 authorized company candidates were checked. Unreturned exact matches remain unknown.":"Results are limited to your current authorized candidate scope."});})
      .catch(error=>{if(epoch.current===run)setDatabase({state:error instanceof ExtensionApiError&&[401,403].includes(error.status)?"permission_required":error instanceof ExtensionApiError&&error.status===0?"unknown":"check_failed",message:error instanceof Error?error.message:"Database history is unknown."});throw error;});
    const localTask=archiveHistory().lookup(scope,reviewed).then(result=>{if(epoch.current===run){setLocal(result);setLocalPending(false);}}).catch(()=>{if(epoch.current===run){setLocal({state:"check_failed",checkedAt:new Date().toISOString(),message:"Local check failed; absence is unknown.",company:[],exact:[],possible:[]});setLocalPending(false);}});
    await Promise.allSettled([databaseTask,localTask]);if(epoch.current===run)setBusy(false);
  }
  async function selectCompany(){
    try{const reviewed=validateHistoryContext(context);if(typeof window.showDirectoryPicker!=="function")throw Error("Directory selection is unavailable in this browser context.");
      const picker=window.showDirectoryPicker({id:"candidate-history-company",mode:"readwrite"});const handle=await picker;
      const path=await api.withActor(scope.actorId,()=>archiveHistory().link(scope,reviewed,handle));setMessage("Linked relative company path: "+path+". Check its index, or explicitly repair it.");setLocal(null);
    }catch(error){setMessage(error instanceof Error?error.message:"Company folder could not be linked.");}
  }
  async function repair(){setBusy(true);try{await pending.current;const reviewed=validateHistoryContext(context);const result=await api.withActor(scope.actorId,()=>archiveHistory().repair(scope,reviewed));setMessage(result.message+(result.failures.length?" Unreadable entries: "+result.failures.join(", "):""));setLocal(await archiveHistory().lookup(scope,reviewed));}catch(error){setMessage(error instanceof Error?error.message:"Repair failed. Local history remains unknown.");}finally{setBusy(false);}}
  const disabled=!ready||busy||!!localError||!usable;
  return <details className="workspace-card" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Quick Application Check</summary>
    <p>Shortcut: {shortcut||"not assigned"}. Change it at <code>chrome://extensions/shortcuts</code>. Select company text and use the shortcut or Check Application History selection menu.</p>
    {new URLSearchParams(location.search).has("captureUnavailable")&&<p role="alert">Page capture could not be persisted. Enter job details manually; no lookup has run.</p>}
    {capture&&!usable&&<p role="status">{capture.actorId?"This capture belongs to another account, organization or candidate. It is not replayed here.":"This capture has no authenticated candidate context. Assign it explicitly to this account and selected candidate."}{!capture.actorId&&<button onClick={()=>void adopt()}>Use captured page for this account and candidate</button>}</p>}
    {localError&&<p role="alert">{localError}</p>}{message&&<p role="status">{message}</p>}
    {capture&&usable&&<p>Capture: {capture.source} · {capture.captureState} · {capture.capturedAt}. {capture.warnings.join(" ")}</p>}
    {usable&&<><p>Review and correct every field before lookup. Page title: {pageTitle||"Manual entry"}. Nothing is submitted or merged.</p>
    <fieldset disabled={disabled}><label>Company to check<input aria-label="Company to check" value={context.company} onChange={e=>save({...context,company:e.target.value})}/></label>
    <label>Job title to check<input aria-label="Job title to check" value={context.title} onChange={e=>save({...context,title:e.target.value})}/></label>
    <label>Job URL to check<input aria-label="Job URL to check" value={context.url} onChange={e=>save({...context,url:e.target.value})}/></label>
    <label>External posting ID (unverified)<input aria-label="External posting ID to check" value={context.externalId} onChange={e=>save({...context,externalId:e.target.value})}/></label>
    <label>Job description to check<textarea aria-label="Job description to check" rows={6} value={context.description} onChange={e=>save({...context,description:e.target.value})}/></label>
    <p>{new TextEncoder().encode(context.description).length} / 204800 UTF-8 bytes. Draft is stored for this account/candidate; lookups require an explicit click.</p>
    <button onClick={()=>void check()}>Check application history</button></fieldset>
    <div className="probe-actions"><button disabled={busy} onClick={()=>void chooseDirectory().then(setDirectory).catch(e=>setMessage(e.message))}>Choose history archive root</button><button disabled={busy||!directory.handle} onClick={()=>void renewDirectory(directory.handle!).then(setDirectory).catch(e=>setMessage(e.message))}>Renew history archive permission</button><button disabled={disabled||!directory.handle} onClick={()=>void selectCompany()}>Link selected company folder</button><button disabled={disabled||!directory.handle} onClick={()=>void repair()}>Repair linked company index</button></div>
    <p>Archive root: {directory.handle?.name??"not selected"}; read/write permission: {directory.permission}. Repair inspects only the linked company folder and preserves package files. Missing links/indexes never mean no history.</p>
    <button onClick={()=>{epoch.current++;setBusy(false);setDatabase({state:"idle"});setLocal(null);setLocalPending(false);setChecked(null);setOpen(false);}}>Cancel check</button>
    {checked&&<section aria-label="Application history results"><h3>Checked opportunity</h3><p>{checked.company} · {checked.title} · {checked.url}</p>
      <h3>Database lookup state: <span data-testid="history-database-state">{database.state}</span></h3><p>{database.message}</p>
      {database.data&&<><p>Checked at {database.data.checkedAt}; {database.data.scope}; normalization {database.data.identifiers.version}.</p><HistoryRows label="Database company-level history" partial={database.data.truncated} rows={database.data.company} web={web}/><HistoryRows label="Database exact-job matches" partial={database.data.truncated} rows={database.data.exact} web={web}/><HistoryRows label="Database possible duplicates" partial={database.data.truncated} rows={database.data.possible} web={web}/></>}
      <h3>Local archive lookup state: <span data-testid="history-local-state">{localPending?"pending":local?.state??"idle"}</span></h3>
      {local&&<><p>{local.message} Checked at {local.checkedAt}.</p>{local.relativePath&&<p>Relative archive path: <code>{local.relativePath}</code></p>}{["found","not_found"].includes(local.state)?<><HistoryRows label="Local company-level history" rows={local.company}/><HistoryRows label="Local exact-job matches" rows={local.exact}/><HistoryRows label="Local possible duplicates" rows={local.possible}/></>:<p>Local company/exact/possible history remains unknown until this source can be verified.</p>}</>}
      <p>Company history alone does not block another job. Fingerprints and similar names/titles are warnings. Local package presence is not an application submission or current server permission.</p>
      <a href={web("bids")+"&candidateId="+scope.candidateId} target="_blank" rel="noreferrer">Open previous authorized bid history</a>
    </section>}
    </>}
  </details>;
}
function HistoryRows({label,rows,web,partial=false}:{label:string;rows:HistoryMatch[];web?:(path:string)=>string;partial?:boolean}){
  return <section><h4>{label} ({rows.length})</h4>{!rows.length&&<p>{partial?"No match in the returned rows; remaining history is unknown.":"No match in this checked source and scope."}</p>}{rows.map((row,i)=><article key={row.observationId??row.id+":"+i}><p>{row.company} · {row.title}{web?" · Authorized bid status: "+row.status:" · Local package; status not inferred"}{row.submittedAt?" · submitted "+row.submittedAt:""}</p><p>{web&&(row.submissionId?"Frozen submission "+row.submissionId:"Current bid content; submission is a separate event")}</p><p>Evidence: {row.evidence.join(", ")}</p>{row.path&&<p>Relative archive path: <code>{row.path}</code></p>}{row.files&&<details><summary>Open Local Archive (inspect verified package)</summary>{row.files.map(file=><p key={file.name}>{file.name}: {file.bytes} bytes; SHA-256 <code>{file.sha256}</code></p>)}</details>}{web&&<a href={web("bids/"+row.id)} target="_blank" rel="noreferrer">Open existing bid</a>}</article>)}</section>;
}
