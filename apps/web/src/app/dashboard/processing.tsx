"use client";
import { useEffect, useState } from "react";
import { readApi } from "../workspace/requests";
import { flushProcessingReports } from "@/lib/operations/reports";
interface Notice { id: string; candidateId: string; bidId: string | null; title: string; readAt: string | null; createdAt: string }
interface Observation { eventId: string; operationId: string; actorId: string; candidateId: string; bidId: string | null; stage: string; state: string; code: string; reportedAt: string }
interface Report { asOf: string; total: number; page: number; pageSize: number; counts: Record<string, number>; items: Observation[] }
const box="grid gap-3 rounded border bg-white p-5";
export function ProcessingPanel({ org, actor, refresh }: { org: string; actor: string; refresh: number }) {
 const [data,setData]=useState<Report|null>(null),[error,setError]=useState("");
 const [notices,setNotices]=useState<Notice[]|null>(null),[noticeError,setNoticeError]=useState("");
 const [page,setPage]=useState(1),[resolved,setResolved]=useState(false),[tick,setTick]=useState(0);
 useEffect(()=>{let live=true;setError("");setNoticeError("");
  void flushProcessingReports(actor,org).catch(()=>{/* Offline reports remain local with their original event IDs. */});
  void Promise.allSettled([
   readApi<Report>(`/api/v1/processing?organizationId=${org}&page=${page}&resolved=${resolved}`).then(r=>{if(live)setData(r);}).catch(e=>{if(live)setError(e.message);}),
   readApi<Notice[]>(`/api/v1/operational-notifications?organizationId=${org}`).then(r=>{if(live)setNotices(r);}).catch(e=>{if(live)setNoticeError(e.message);}),
  ]);return()=>{live=false;};
 },[org,actor,page,resolved,refresh,tick]);
 const href=(r:{bidId:string|null;candidateId:string})=>r.bidId?`/bids/${r.bidId}?organizationId=${org}`:`/candidates/${r.candidateId}?organizationId=${org}`;
 return <>
  <section className={box}><h3 className="text-lg font-semibold">Processing and synchronization</h3>
   <p>Dated client reports, scoped to the owner and authorized supervisors. These do not prove a file still exists or that an application was submitted. Offline or unreported device work is unknown to this service; inspect its original workspace journal.</p>
   <label><input type="checkbox" checked={resolved} onChange={e=>{setResolved(e.target.checked);setPage(1);}}/> Include recovered stages</label>
   {error&&<p role="alert">Processing reports unavailable: {error}{data?" Previous report is stale.":""}</p>}
   {data&&<><p>{data.total} reported stages · as of {new Date(data.asOf).toLocaleString()}</p><p>{Object.entries(data.counts).map(([s,n])=>`${s}: ${n}`).join(" · ")}</p>
    {data.items.map(r=><article key={r.eventId} className="grid gap-1 border-b py-3"><p>{r.stage} · {r.state} · {r.code} · {new Date(r.reportedAt).toLocaleString()}</p><a className="underline" href={href(r)}>Open original workspace</a><p className="text-sm">Operation {r.operationId} · actor {r.actorId}</p></article>)}
    {!data.items.length&&<p>No visible reported failures. Unreported local work has not been checked.</p>}
    <div className="flex gap-4"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous processing page</button><span>Page {page}</span><button disabled={page*25>=data.total} onClick={()=>setPage(p=>p+1)}>Next processing page</button></div></>}
  </section>
  <section className={box}><h3 className="text-lg font-semibold">Assignment and processing notifications</h3>{noticeError&&<p role="alert">Operational notifications unavailable: {noticeError}</p>}{notices?.length===0&&<p>No visible assignment or processing notifications.</p>}
   {notices?.map(n=><article key={n.id} className="flex flex-wrap gap-3 border-b py-2"><a className="underline" href={href(n)}>{n.title}</a><time>{new Date(n.createdAt).toLocaleString()}</time>{n.readAt?<span>Read</span>:<button className="underline" onClick={async()=>{try{await readApi(`/api/v1/operational-notifications/${n.id}/read?organizationId=${org}`,{method:"POST"});setTick(t=>t+1);}catch(e){setNoticeError(e instanceof Error?e.message:"Notification unavailable.");}}}>Mark read</button>}</article>)}
  </section>
 </>;
}
