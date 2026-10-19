import {localStore} from "./local-store";
import type {ExtensionOperation} from "./journal";
/** Bounded event handler: no Auth, renderer, Blob ownership or worker globals. */
export async function settleDownload(id:number,state:"in_progress"|"complete"|"interrupted",error?:string,store=localStore()){
 const record=await store.get<{operationId:string|null;preparedKey?:string}>("production-download:"+id);if(!record||state==="in_progress")return;
 if(record.preparedKey){await store.change<Record<string,unknown>>(record.preparedKey,op=>({...op,state,error:error??null}));return;}
 if(!record.operationId)return;
 await store.change<ExtensionOperation>("production-op:"+record.operationId,op=>{
  if(!op)throw Error("Download operation is missing.");if(op.downloadId!==id)return op;
  return {...op,outcomes:{...op.outcomes,localExport:{...op.outcomes.localExport,state:state==="complete"?"succeeded":"failed",error:state==="complete"?null:"Chrome download interrupted: "+(error??"unknown"),updatedAt:new Date().toISOString()}}};
 });
}
