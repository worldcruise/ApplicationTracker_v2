import {useEffect,useState} from "react";
import type {FrozenDocument} from "@candidate/contracts";
import {sha256} from "@candidate/resume-engine";
import type {ExtensionApi} from "../api";
import {localStore} from "../local-store";
import {settleDownload} from "../exports";
import {PdfPreview} from "./PdfPreview";
export function PreparedDocuments({api,actor,org,candidate}:{api:ExtensionApi;actor:string;org:string;candidate:string}){
 const [rows,setRows]=useState<FrozenDocument[]>([]);const [pdf,setPdf]=useState<{bytes:Uint8Array;sha256:string}|null>(null);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const query="?organizationId="+org;
 useEffect(()=>{let live=true;void api.request<FrozenDocument[]>("documents"+query+"&candidateId="+candidate,{actorId:actor}).then(r=>{if(live)setRows(r);}).catch(e=>{if(live)setMessage(e.message);});return()=>{live=false;};},[actor,org,candidate]);
 async function retrieve(row:FrozenDocument,download:boolean){setBusy(true);try{const result=await api.request<{base64:string;sha256:string;filename:string}>("documents/"+row.id+"/pdf"+query,{actorId:actor});const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));if(await sha256(bytes)!==row.pdfSha256||result.sha256!==row.pdfSha256)throw Error("Stored PDF integrity check failed.");setPdf({bytes,sha256:result.sha256});setMessage("Authorized frozen bytes retrieved and verified.");
  if(download){const id=crypto.randomUUID();const filename="Prepared_"+id+".pdf";const key="prepared-export:"+id;await localStore().add(key,{id,actor,org,candidate,documentId:row.id,sha256:result.sha256,bytes,filename,state:"pending"});const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/pdf"}));const downloadId=await chrome.downloads.download({url,filename,conflictAction:"uniquify"});await localStore().put("production-download:"+downloadId,{preparedKey:key,operationId:null,filename,url});const check=await chrome.downloads.search({id:downloadId});if(check[0])await settleDownload(downloadId,check[0].state,check[0].error);setMessage("Prepared export requested; Chrome download completion is tracked independently. No content was created.");}
 }catch(e){setPdf(null);setMessage(e instanceof Error?e.message:"Export unavailable.");}finally{setBusy(false);}}
 return <section className="workspace-card"><h2>Authorized prepared documents</h2><p>Export permission retrieves an existing frozen version. It does not grant profile editing, generation, interview access or submission permission.</p>{message&&<p role="status">{message}</p>}{rows.map(r=><article key={r.id}><p>{r.filename} · {r.reviewed?"reviewed":"unverified"}</p><button disabled={busy} onClick={()=>void retrieve(r,false)}>Preview prepared {r.kind}</button><button disabled={busy} onClick={()=>void retrieve(r,true)}>Export prepared {r.kind}</button></article>)}{pdf&&<><p>SHA-256: <code>{pdf.sha256}</code></p><PdfPreview sample={pdf}/></>}</section>;
}
