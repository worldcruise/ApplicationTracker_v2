import type { CaptureContext } from "@candidate/contracts";
import { localStore } from "./local-store";

export const CAPTURE_COMMAND = "check-application-history";
export const ACTIVE_CAPTURE_SCOPE = "quick-active-context";
export interface CaptureScope { actorId: string; organizationId: string; candidateId: string }

/** Executed in the page's isolated world. No imports, credentials, messages or extension storage. */
export function extractPageContext() {
  const bounded = (s:string,max:number) => new TextDecoder().decode(new TextEncoder().encode(s).slice(0,max),{stream:true});
  let description = "";
  const nodes = document.querySelectorAll('[itemprop="description"], [data-testid="job-description"], .job-description, #job-description');
  if (nodes[0]) description = nodes[0].textContent ?? "";
  if (!description) {
    const queue: {value:unknown;depth:number}[]=[];
    for (const script of [...document.querySelectorAll('script[type="application/ld+json"]')].slice(0,20)) {
      const text=script.textContent??"";if(text.length>300000)continue;
      try{queue.push({value:JSON.parse(text),depth:0});}catch{/* Untrusted malformed metadata is ignored. */}
    }
    for(let n=0;queue.length&&n<100;n++){
      const {value,depth}=queue.shift()!;if(!value||typeof value!=="object"||depth>4)continue;
      const record=value as Record<string,unknown>;
      if((record["@type"]==="JobPosting" || (Array.isArray(record["@type"])&&record["@type"].includes("JobPosting")))&&typeof record.description==="string"){
        description=new DOMParser().parseFromString(record.description.slice(0,204800),"text/html").body.textContent??"";break;
      }
      for(const item of (Array.isArray(value)?value:Object.values(record)).slice(0,30))queue.push({value:item,depth:depth+1});
    }
  }
  if(!description)description=document.querySelector("main, article")?.textContent??"";
  return { company:bounded(window.getSelection()?.toString()??"",200),url:location.href.slice(0,2048),pageTitle:bounded(document.title,500),description:bounded(description,204800),descriptionTruncated:new TextEncoder().encode(description).length>204800 };
}
export function safeCapturedUrl(raw:string) {
  try{
    const url=new URL(raw);if(!["https:","http:"].includes(url.protocol))return {url:"",redacted:false};
    let redacted=!!(url.username||url.password);url.username="";url.password="";
    for(const key of [...url.searchParams.keys()])if(/^(?:access_token|refresh_token|id_token|authorization|password|token)$/iu.test(key)){url.searchParams.delete(key);redacted=true;}
    if(/(?:access_token|refresh_token|id_token)=/iu.test(url.hash)){url.hash="";redacted=true;}
    return {url:url.href.slice(0,2048),redacted};
  }catch{return {url:"",redacted:false};}
}
/** Both real browser event entry points call this workflow; no Auth work runs in the worker. */
export async function captureContext(source:CaptureContext["source"],tab:chrome.tabs.Tab|undefined,selectionText?:string,frameId=0) {
  const warnings:string[]=[];let extracted:ReturnType<typeof extractPageContext>|null=null;
  if(tab?.id!==undefined){try{
    const rows=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[frameId]},func:extractPageContext});
    extracted=rows[0]?.result??null;
  }catch{warnings.push("Page capture unavailable or restricted. Enter and review the job details manually.");}}
  const safe=safeCapturedUrl(tab?.url??extracted?.url??"");if(safe.redacted)warnings.push("Authentication parameters were removed from the captured URL. Review the safe posting URL.");
  if(!extracted?.description)warnings.push("No job description could be extracted. Paste it manually.");
  if(extracted?.descriptionTruncated)warnings.push("Job description was truncated to 200 KiB. Review it before lookup.");
  const bound=(value:string,max:number)=>new TextDecoder().decode(new TextEncoder().encode(value).slice(0,max),{stream:true});
  const stored=await chrome.storage.session.get(ACTIVE_CAPTURE_SCOPE);const scope=stored[ACTIVE_CAPTURE_SCOPE] as CaptureScope|undefined;
  const valid=scope&&[scope.actorId,scope.organizationId,scope.candidateId].every(v=>typeof v==="string"&&/^[0-9a-f-]{36}$/iu.test(v));
  const capture:CaptureContext={version:1,id:crypto.randomUUID(),source,capturedAt:new Date().toISOString(),actorId:valid?scope.actorId:null,organizationId:valid?scope.organizationId:null,candidateId:valid?scope.candidateId:null,
    company:bound(selectionText??extracted?.company??"",200),url:safe.url,pageTitle:bound(tab?.title??extracted?.pageTitle??"",500),description:extracted?.description??"",captureState:!extracted?"unavailable":warnings.length?"partial":"captured",warnings};
  await localStore().add("quick-capture:"+capture.id,capture);
  await chrome.tabs.create({url:chrome.runtime.getURL("workspace.html")+"?captureId="+capture.id});
  return capture;
}
