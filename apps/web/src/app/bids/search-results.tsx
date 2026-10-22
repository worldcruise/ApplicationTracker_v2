"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { bidStatuses, interviewLifecycles, type SearchOption, type WorkflowSearchKind, type WorkflowSearchResult, type WorkflowSearchRow } from "@candidate/contracts";
import { ClientApiFailure, readApi } from "../workspace/requests";
import { StatusBadge } from "@candidate/ui";

const inputClass="min-w-0 w-full rounded border border-slate-300 bg-white p-2 text-slate-950";
const common={candidateId:"Candidate",company:"Company",status:"Status",ownerId:"Owner",teamId:"Team",followup:"Follow-up"};
const bidFilters={...common,priority:"Priority",createdFrom:"Created from (UTC)",createdTo:"Created through (UTC)",submittedFrom:"Submitted from (UTC)",submittedTo:"Submitted through (UTC)"};
const interviewFilters={...common,bidId:"Associated bid ID",type:"Interview type",round:"Round",scheduledFrom:"Scheduled from (UTC)",scheduledTo:"Scheduled through (UTC)",upcoming:"Upcoming interviews",feedbackPending:"Feedback pending"};
const allKeys=[...new Set(["q",...Object.keys(bidFilters),...Object.keys(interviewFilters),"sort","page","pageSize"])];
const label=(value:string)=>value.replaceAll("_"," ");
const urlEvent="application-tracker:workflow-search";
function subscribeUrl(notify:()=>void) {window.addEventListener("popstate",notify);window.addEventListener(urlEvent,notify);return()=>{window.removeEventListener("popstate",notify);window.removeEventListener(urlEvent,notify);};}
const currentUrlParameters=()=>new URLSearchParams(window.location.search).toString();
export function useWorkflowSearchParameters() {const params=useSearchParams();return useSyncExternalStore(subscribeUrl,currentUrlParameters,()=>params.toString());}
export function writeWorkflowSearchParameters(params:URLSearchParams,pathname:string,replace=false) {window.history[replace?"replaceState":"pushState"](null,"",pathname+"?"+params.toString());window.dispatchEvent(new Event(urlEvent));}

export function clearWorkflowSearchParameters(params:URLSearchParams) {for(const key of allKeys)params.delete(key);}
export function WorkflowSearchResults({kind,org,tick,locked,onOpen,extraAction}:{kind:WorkflowSearchKind;org:string;tick:number;locked:boolean;onOpen:(row:WorkflowSearchRow)=>void;extraAction?:(row:WorkflowSearchRow)=>React.ReactNode}) {
 const serialized=useWorkflowSearchParameters();const params=new URLSearchParams(serialized);const pathname=usePathname();
 const [draft,setDraft]=useState(params.get("q")??"");const [result,setResult]=useState<WorkflowSearchResult|null>(null);
 const [options,setOptions]=useState<WorkflowSearchResult["options"]|null>(null);const [loading,setLoading]=useState(true);
 const [failure,setFailure]=useState<{permission:boolean;message:string}|null>(null);const [retry,setRetry]=useState(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const submittedQuery=useRef<string|null>(null);
 const fields:Record<string,string>=kind==="bids"?bidFilters:interviewFilters;
 const values=new URLSearchParams(serialized);
 const query=values.get("q")??"";
 useEffect(()=>{if(submittedQuery.current===query){submittedQuery.current=null;return;}submittedQuery.current=null;setDraft(query);if(timer.current)clearTimeout(timer.current);},[query,kind]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function navigate(changes:Record<string,string>,reset=true) {
  const next=new URLSearchParams(window.location.search);next.set("organizationId",org);
  for(const [key,value] of Object.entries(changes))if(value)next.set(key,value);else next.delete(key);
  if(reset)next.delete("page");
  writeWorkflowSearchParameters(next,pathname);
 }
 function submitSearch(value:string) {if(timer.current)clearTimeout(timer.current);const normalized=value.trim().replace(/\s+/gu," ");const current=new URLSearchParams(window.location.search);if(normalized===(current.get("q")??"")&&(!current.has("page")||current.get("page")==="1")){setRetry(n=>n+1);return;}if(normalized!==(current.get("q")??""))submittedQuery.current=normalized;navigate({q:normalized});}
 useEffect(()=>{
  const controller=new AbortController();let current=true;
  const q=new URLSearchParams(serialized);q.set("organizationId",org);q.set("search","true");
  setLoading(true);setFailure(null);setResult(null);
  void readApi<WorkflowSearchResult>(`/api/v1/${kind}?${q}`,{signal:controller.signal}).then(data=>{
   if(current){setResult(data);setOptions(data.options);}
  }).catch(error=>{if(current){const permission=error instanceof ClientApiFailure && [401,403].includes(error.status);setFailure({permission,message:error instanceof Error?error.message:"Search could not be loaded."});if(permission)setOptions(null);}}).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;controller.abort();};
 },[serialized,kind,org,tick,retry]);
 const optionMap:Record<string,SearchOption[]|undefined>={candidateId:options?.candidates,company:options?.companies,ownerId:options?.owners,teamId:options?.teams,type:options?.types,round:options?.rounds,
  status:(kind==="bids"?bidStatuses:interviewLifecycles).map(value=>({value,label:label(value)})),priority:["low","normal","high","urgent"].map(value=>({value,label:value})),followup:[{value:"due",label:"Due through today (UTC)"},{value:"overdue",label:"Overdue now"}]};
 const chips=Object.entries({q:kind==="bids"?"Search bids":"Search interviews",...fields}).filter(([key])=>values.has(key)&&values.get(key)!=="");
 return <div className="grid min-w-0 gap-3">
  <form role="search" aria-label={kind==="bids"?"Bid search":"Interview search"} className="search-toolbar" onSubmit={e=>{e.preventDefault();submitSearch(draft);}}>
   <label className="grid gap-1 text-sm">{kind==="bids"?"Search bids":"Search interviews"}<input type="search" className={inputClass} maxLength={200} value={draft} placeholder="Candidate, company, job title, ID…" onChange={e=>{const text=e.target.value;setDraft(text);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>submitSearch(text),300);}}/></label>
   <button type="submit" className="w-fit rounded border px-4 py-2">Search now</button>
   <details><summary className="cursor-pointer">Filters</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {Object.entries(fields).map(([key,title])=>{
     const value=values.get(key)??"";const choices=optionMap[key];
     return <label key={key} className="grid gap-1 text-sm">{title}{key==="upcoming"||key==="feedbackPending"?<input aria-label={`${title} filter`} type="checkbox" checked={value==="true"} onChange={e=>navigate({[key]:e.target.checked?"true":""})}/>:choices?<select aria-label={`${title} filter`} className={inputClass} value={value} onChange={e=>navigate({[key]:e.target.value})}><option value="">All</option>{value&&!choices.some(o=>o.value===value)&&<option value={value}>Selected reference {value}</option>}{choices.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input aria-label={`${title} filter`} className={inputClass} type={key.endsWith("From")||key.endsWith("To")?"date":"text"} value={value} onChange={e=>navigate({[key]:e.target.value})}/>}</label>;
    })}
   </div></details>
  </form>
  <div className="flex flex-wrap gap-2" aria-label="Active search filters">{chips.map(([key,title])=><button className="max-w-full break-all rounded-full border px-3 py-1 text-sm" key={key} aria-label={`Remove ${title} filter`} onClick={()=>{if(key==="q")setDraft("");navigate({[key]:""});}}>{title}: {optionMap[key]?.find(o=>o.value===values.get(key))?.label??values.get(key)} ×</button>)}{(chips.length>0||values.has("sort")||values.has("page")||values.has("pageSize"))&&<button className="underline" onClick={()=>{if(timer.current)clearTimeout(timer.current);submittedQuery.current=null;const next=new URLSearchParams(window.location.search);clearWorkflowSearchParameters(next);setDraft("");writeWorkflowSearchParameters(next,pathname);}}>Clear all</button>}</div>
  <div className="flex flex-wrap items-end gap-3">
   <label className="grid gap-1 text-sm">Sort results<select aria-label="Sort results" className={inputClass} value={values.get("sort")??(query?"relevance":kind==="bids"?"updated_desc":"scheduled_asc")} onChange={e=>navigate({sort:e.target.value})}>{[["relevance","Best match"],["updated_desc","Recently updated"],["created_desc","Newest created"],["company_asc","Company A–Z"],["candidate_asc","Candidate A–Z"],["followup_asc","Follow-up soonest"],...(kind==="bids"?[["submitted_desc","Latest submitted"]]:[["scheduled_asc","Scheduled soonest"],["scheduled_desc","Scheduled latest"]])].map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
   <label className="grid gap-1 text-sm">Results per page<select aria-label="Results per page" className={inputClass} value={values.get("pageSize")??"25"} onChange={e=>navigate({pageSize:e.target.value})}>{[10,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label>
  </div>
  <p className="text-sm text-slate-600">Date ranges include both UTC calendar dates. Scheduled times below use your browser’s time zone; each round retains its IANA time zone.</p>
  <div aria-live="polite" aria-atomic="true">{loading?<p role="status">Searching {kind}…</p>:failure?<div role="alert"><p>{failure.permission?"Permission required. Sign in with an active, authorized account.":"Search request failed."} {failure.message}</p><button className="underline" onClick={()=>setRetry(n=>n+1)}>Retry search</button></div>:result&&<><p>{result.total} {kind==="bids"?"opportunities in your current scope":"matching interviews in your current scope"}</p>{result.total===0&&<p>No matches. Try another search or clear the filters.</p>}{result.total>0&&result.items.length===0&&<p>No results on this page. Return to the first page.</p>}</>}</div>
  {!loading&&!failure&&result&&<><ul className="grid gap-2" aria-label={kind==="bids"?"Bid results":"Interview results"}>{result.items.map(row=>{
   const r=row.record;return <li key={r.id} className="search-result-card grid min-w-0 gap-3 sm:grid-cols-[1fr_auto]">
    <div className="min-w-0"><a className="break-words" href={`/bids/${"bidId" in r?r.bidId:r.id}?organizationId=${org}${"bidId" in r?"&view=interviews":""}`}>{row.companyName} · {row.jobTitle}</a><p>{row.candidateName??"Candidate name unavailable in this scope"}</p><p className="text-sm">{row.ownerName??`Owner ${r.ownerId}`} · {row.teamName??"Authorized team"}</p>{"lifecycle" in r?<><div className="result-metadata"><span className="status-badge status-neutral">Round {r.roundNumber}</span><StatusBadge value={r.lifecycle} /><span className="status-badge status-neutral">Outcome: {label(r.outcome)}</span></div><p>{r.scheduledAt?new Date(r.scheduledAt).toLocaleString():"Not scheduled"} · {r.timezone} {r.offset}<br/>{r.type} · {r.interviewer}</p></>:<div className="result-metadata"><StatusBadge value={r.status} /><StatusBadge value={r.priority}>{r.priority} priority</StatusBadge><span className="text-xs text-slate-500">{r.followUpAt?`Follow up ${new Date(r.followUpAt).toLocaleString()}`:"No follow-up date"}</span></div>}<p className="break-all text-xs">{kind==="bids"?"Bid":"Interview"} {r.id}{"bidId" in r?` · Bid ${r.bidId}`:r.externalId?` · External ID ${r.externalId}`:""}</p></div>
    <div className="grid content-start gap-2"><button className="underline" disabled={locked} onClick={()=>onOpen(row)}>{"lifecycle" in r?`Round ${r.roundNumber} · ${label(r.lifecycle)} · ${label(r.outcome)}`:"Open bid"}</button>{extraAction?.(row)}</div>
   </li>;
  })}</ul><nav className="flex flex-wrap items-center gap-4" aria-label="Search result pages"><button disabled={result.page===1} onClick={()=>navigate({page:String(Math.max(1,result.page-1))},false)}>Previous page</button><span>Page {result.page} of {Math.max(1,Math.ceil(result.total/result.pageSize))}</span><button disabled={result.page*result.pageSize>=result.total} onClick={()=>navigate({page:String(result.page+1)},false)}>Next page</button>{result.page>1&&<button className="underline" onClick={()=>navigate({page:"1"},false)}>First page</button>}</nav></>}
 </div>;
}
