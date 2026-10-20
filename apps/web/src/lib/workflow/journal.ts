"use client";
import { useEffect, useState } from "react";
import { readApi, ClientApiFailure } from "@/app/workspace/requests";
import { queueProcessingReports } from "@/lib/operations/reports";
interface FrozenOperation { operationId:string;actorId:string;organizationId:string;url:string;method:string;version:number;body:Record<string,unknown> }
async function report(op:FrozenOperation,state:"failed"|"unknown"|"succeeded"){
 try{const match=new URL(op.url,window.location.origin).pathname.match(/^\/api\/v1\/bids\/([a-f0-9-]{36})(?:\/transitions)?$/i);const candidate=(op.body.input as {candidateId?:string}|undefined)?.candidateId??(match?(await readApi<{bid:{candidateId:string}}>(`/api/v1/bids/${match[1]}?organizationId=${op.organizationId}`,{headers:{"X-Operation-Actor":op.actorId}})).bid.candidateId:null);
 if(candidate)await queueProcessingReports({operationId:op.operationId,actorId:op.actorId,organizationId:op.organizationId,candidateId:candidate,bidId:match?.[1]??null},{databaseSync:{state}});
 }catch{/* Reporting cannot change the mutation result. */}
}
let opening:Promise<IDBDatabase>|undefined;
function db(){return opening??=new Promise((resolve,reject)=>{const r=indexedDB.open("candidate-workflow-operations",1);r.onupgradeneeded=()=>{r.result.createObjectStore("operations");r.result.createObjectStore("pending");};r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opening=undefined;reject(Error("Local operation journal is unavailable. Nothing was sent."));};});}
async function store(key:string,op:FrozenOperation|null,expectedId?:string){const database=await db();await new Promise<void>((resolve,reject)=>{
 const t=database.transaction(["operations","pending"],"readwrite");let message="Local operation journal could not be saved. Nothing was sent.";const pending=t.objectStore("pending");const request=pending.get(key);
 request.onsuccess=()=>{const previous=request.result as FrozenOperation|undefined;
  if(!op){if(previous?.operationId===expectedId)pending.delete(key);return;}
  if(previous&&previous.operationId!==op.operationId){message="Another tab has a frozen operation. Reload to reconcile it before starting another request.";t.abort();return;}
  const operations=t.objectStore("operations");const old=operations.get(op.operationId);old.onsuccess=()=>{if(old.result&&JSON.stringify(old.result)!==JSON.stringify(op)){message="Frozen operation input cannot change.";t.abort();return;}operations.put(op,op.operationId);pending.put(op,key);};
 };
 t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(Error(message));
});}
async function restore(key:string){const database=await db();return new Promise<FrozenOperation|undefined>((resolve,reject)=>{const r=database.transaction("pending").objectStore("pending").get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error("Local operation could not be restored."));});}
export function useWorkflowMutation(actorId:string,organizationId:string,onConfirmed:(result:{id:string;rowVersion?:number},operation:{url:string;method:string})=>void|Promise<void>){
 const key=actorId+":"+organizationId;const [pending,setPending]=useState<FrozenOperation|null>(null);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);
 useEffect(()=>{let active=true;void restore(key).then(op=>{if(active){setPending(op??null);setReady(true);if(op)setMessage("A frozen operation needs reconciliation. Its original input is retained.");}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[key]);
 async function confirm(result:{id:string;rowVersion?:number},op:FrozenOperation){void report(op,"succeeded");await store(key,null,op.operationId);setPending(null);setMessage("Database synchronization confirmed. No local archive was created.");await onConfirmed(result,op);}
 async function send(op:FrozenOperation){setBusy(true);try{const result=await readApi<{id:string;rowVersion?:number}>(op.url,{method:op.method,headers:{"Content-Type":"application/json","If-Match":JSON.stringify(String(op.version)),"Idempotency-Key":op.operationId,"X-Operation-Actor":op.actorId},body:JSON.stringify(op.body)});await confirm(result,op);}catch(e){void report(op,e instanceof ClientApiFailure&&e.status<500?"failed":"unknown");if(e instanceof ClientApiFailure && e.status<500){await store(key,null,op.operationId);setPending(null);setMessage(e.message+(e.currentVersion!==undefined?` Current version: ${e.currentVersion}. Your form remains available; reload and compare before resaving.`:"")+e.fieldErrors.map(f=>` ${f.path}: ${f.message}`).join(""));}else setMessage("Synchronization is unknown. Your original operation ID and payload are saved locally. Reconcile or retry this frozen request.");}finally{setBusy(false);}}
 async function execute(url:string,body:Record<string,unknown>,method:string,version:number){if(pending||!ready||busy)return;const operationId=crypto.randomUUID();const op={operationId,actorId,organizationId,url,method,version,body:{...body,operationId}};setBusy(true);try{await store(key,op);setPending(op);await send(op);}catch(e){setMessage(e instanceof Error?e.message:"Local saving failed.");}finally{setBusy(false);}}
 async function reconcile(){if(!pending)return;setBusy(true);try{const result=await readApi<{id:string;rowVersion?:number}|null>(`/api/v1/workflow-operations/${pending.operationId}?organizationId=${organizationId}`,{headers:{"X-Operation-Actor":actorId}});if(result)await confirm(result,pending);else await send(pending);}catch(e){setMessage(e instanceof Error?e.message:"Reconciliation failed. The original operation is retained.");}finally{setBusy(false);}}
 return {execute,reconcile,message,pending,busy,locked:busy||!!pending||!ready};
}
