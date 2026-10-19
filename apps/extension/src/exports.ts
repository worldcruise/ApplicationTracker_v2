import { sha256 } from "@candidate/resume-engine";
import { requireDirectoryWritePermission } from "./directory";
import { localStore,DIRECTORY_KEY } from "./local-store";
import { operationJournal,type ExtensionOperation } from "./journal";
import { checkedBytes,exportFilename } from "./production";
import {settleDownload} from "./download-events";
export {settleDownload} from "./download-events";
export async function refreshDownload(op:ExtensionOperation){
 if(op.downloadId!==null){const rows=await chrome.downloads.search({id:op.downloadId});if(rows[0])await settleDownload(op.downloadId,rows[0].state,rows[0].error);}
 else if(op.filename&&op.outcomes.localExport.state==="pending"){
  const rows=await chrome.downloads.search({filenameRegex:op.id});const matches=rows.filter(row=>row.filename.replaceAll("\\","/").endsWith("/"+op.filename));
  if(matches.length===1){await localStore().put("production-download:"+matches[0]!.id,{operationId:op.id,filename:op.filename,url:null});await operationJournal().download(op.id,matches[0]!.id,op.filename);await settleDownload(matches[0]!.id,matches[0]!.state,matches[0]!.error);}
 }
}
export async function exportOperation(op:ExtensionOperation,mode:"directory"|"download"){
 const bytes=await checkedBytes(op);const name=exportFilename(op);const journal=operationJournal();
 if(mode==="download"&&op.downloadId!==null){await refreshDownload(op);const prior=await chrome.downloads.search({id:op.downloadId});if(prior[0]?.state==="complete"||prior[0]?.state==="in_progress")return;}
 if(mode==="download"&&op.downloadId===null&&op.filename&&op.outcomes.localExport.state==="pending"){await refreshDownload(op);throw Error("The earlier download result needs reconciliation. Reopen this frozen operation before retrying; no duplicate download was started.");}
 await journal.stage(op.id,"localExport","pending");
 try{
  if(mode==="directory"){
   const handle=await localStore().get<FileSystemDirectoryHandle>(DIRECTORY_KEY);if(!handle)throw Error("Choose a folder, or explicitly use Chrome download.");
   await requireDirectoryWritePermission(handle);let file:FileSystemFileHandle|undefined;
   try{file=await handle.getFileHandle(name);}catch(e){if(!(e instanceof DOMException&&e.name==="NotFoundError"))throw e;}
   if(file){if(await sha256(new Uint8Array(await (await file.getFile()).arrayBuffer()))!==op.pdf!.sha256)throw Error("This operation's file has different bytes. It will not be overwritten.");}
   else{file=await handle.getFileHandle(name,{create:true});const stream=await file.createWritable();try{await stream.write(new Uint8Array(bytes));await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}
    if(await sha256(new Uint8Array(await (await file.getFile()).arrayBuffer()))!==op.pdf!.sha256)throw Error("Closed file failed its PDF hash check.");}
   await journal.stage(op.id,"localExport","succeeded");return;
  }
  await journal.download(op.id,null,name);const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/pdf"}));
  const id=await chrome.downloads.download({url,filename:name,conflictAction:"uniquify",saveAs:false});
  await localStore().put("production-download:"+id,{operationId:op.id,filename:name,url});await journal.download(op.id,id,name);
  await refreshDownload(await journal.get(op.id,op.actorId,op.organizationId));
  const changed=(delta:chrome.downloads.DownloadDelta)=>{if(delta.id===id&&(delta.state?.current==="complete"||delta.state?.current==="interrupted")){URL.revokeObjectURL(url);chrome.downloads.onChanged.removeListener(changed);}};
  chrome.downloads.onChanged.addListener(changed);
 }catch(e){await journal.stage(op.id,"localExport","failed",e instanceof Error?e.message:"Export failed.");throw e;}
}
