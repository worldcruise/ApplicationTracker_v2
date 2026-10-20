import type {PackageSyncResult} from "@candidate/contracts";
import {ExtensionApiError,type ExtensionApi} from "./api";
import {packageJournal,packageLock,type PackageOperation} from "./package-journal";
import {packageFiles} from "./package-files";
import {synchronizeOperation} from "./production";
import {localStore,DIRECTORY_KEY} from "./local-store";
type Journal=ReturnType<typeof packageJournal>;
async function observePackage(api:ExtensionApi,op:PackageOperation){
 return packageLock(op.id,"observation",async()=>{
  const store=localStore(),key="package-observation:"+op.id;
  type Observation={actor:string;org:string;payload:{deviceId:string;checkedAt:string;fileHashes:Record<string,string>;metadataSha256:string};confirmed:boolean};
  let row=await store.get<Observation>(key);
  if(!row){if(!op.metadataHash||Object.values(op.fileStates).some(f=>f.state!=="verified"))throw Error("Verify all local files and metadata before recording the device observation.");
   row={actor:op.input.actorId,org:op.input.organizationId,payload:{deviceId:op.input.deviceId,checkedAt:new Date().toISOString(),fileHashes:Object.fromEntries(Object.entries(op.fileStates).map(([name,f])=>[name,f.sha256])),metadataSha256:op.metadataHash},confirmed:false};await store.add(key,row);
  }
  if(row.actor!==op.input.actorId||row.org!==op.input.organizationId)throw Error("Another account's device observation cannot be replayed.");
  if(!row.confirmed){await api.request("archive-packages/"+op.id+"/observations?organizationId="+op.input.organizationId,{actorId:op.input.actorId,organizationId:op.input.organizationId,body:row.payload});await store.put(key,{...row,confirmed:true});}
 });
}
export function packageProduction(api:ExtensionApi,journal:Journal=packageJournal(),files=packageFiles(journal),syncSource=synchronizeOperation,observe=(op:PackageOperation)=>observePackage(api,op)){
 const get=(op:PackageOperation)=>journal.get(op.id,op.input.actorId,op.input.organizationId);
 async function authorize(op:PackageOperation){
  const i=op.input,options={actorId:i.actorId,organizationId:i.organizationId};
  // A cached editor operation cannot become a bidder generation capability.
  const refs=[i.resume.reference,i.coverLetter?.reference].filter((r):r is NonNullable<typeof r>=>!!r);
  if(refs.some(r=>r.kind==="operation")){
   const context=await api.request<import("@candidate/contracts").UserContext>("me",options);const scope=context.organizations.find(o=>o.organizationId===i.organizationId);
   if(!scope||!["admin","team_leader","team_member"].includes(scope.role))throw Error("Current profile-editor permission is required for a source operation. Use an authorized prepared frozen export.");
   await api.request("candidates/"+i.candidateId+"?organizationId="+i.organizationId,options);
  }
  for(const ref of refs)if(ref.kind==="document")await api.request("documents/"+ref.documentId+"/archive-source?organizationId="+i.organizationId,options);
 }
 async function database(op:PackageOperation){return packageLock(op.id,"database",async()=>{
  op=await get(op);const i=op.input,query="?organizationId="+i.organizationId,options={actorId:i.actorId,organizationId:i.organizationId};
  await journal.stage(op.id,"database","pending");
  try{
   const context=await api.request<import("@candidate/contracts").UserContext>("me",options);if(!context.organizations.some(o=>o.organizationId===i.organizationId))throw Error("Current active membership is required.");
   // Reconcile first after an interrupted response. Never allocate a replacement operation.
   let result=await api.request<PackageSyncResult|null>("archive-packages"+query+"&operationId="+op.id+"&requestHash="+op.inputHash,options);
   if(!result){
    for(const ref of [i.resume.reference,i.coverLetter?.reference])if(ref?.kind==="operation")await syncSource(api,ref.operationId,i.actorId,i.organizationId);
    result=await api.request<PackageSyncResult>("archive-packages"+query,{...options,body:i,operationId:op.id});
   }
   await journal.result(op.id,result);await journal.stage(op.id,"database","succeeded");return get(op);
  }catch(error){await journal.stage(op.id,"database",error instanceof ExtensionApiError&&error.status>0&&error.status<500?"failed":"unknown",error instanceof Error?error.message:"Database confirmation is unknown.");throw error;}
 });}
 async function copy(op:PackageOperation){
  op=await get(op);if(op.outcomes.local.state!=="succeeded")throw Error("Verify local saving before copying its relative path.");
  await journal.stage(op.id,"clipboard","pending");
  try{const root=op.root??await localStore().get<FileSystemDirectoryHandle>(DIRECTORY_KEY);const path=(root?.name?root.name+"/":"")+op.input.relativePath.join("/");await api.withActor(op.input.actorId,()=>navigator.clipboard.writeText(path));await journal.stage(op.id,"clipboard","succeeded");}
  catch(error){await journal.stage(op.id,"clipboard","failed","Path copy was denied or unavailable. Select the Relative archive path field and copy it manually.");throw error;}
 }
 async function run(op:PackageOperation,branches={local:true,database:true}){
  op=await get(op);const local=async()=>{try{await authorize(op);await api.withActor(op.input.actorId,()=>files.writeLocal(op));}catch(error){const current=await get(op);if(current.outcomes.local.state==="idle"||current.outcomes.local.state==="pending")await journal.stage(op.id,"local","failed",error instanceof Error?error.message:"Local authorization failed.");throw error;}};
  // Start both branches before awaiting either. Each persists its own result immediately.
  await Promise.allSettled([...(branches.local?[local()]:[]),...(branches.database?[database(op)]:[])]);
  op=await get(op);
  if(op.outcomes.local.state==="succeeded"){
   try{await authorize(op);await api.withActor(op.input.actorId,()=>files.reconcile(op));}catch(error){await journal.stage(op.id,"reconciliation","pending",error instanceof Error?error.message:"Current authorization or metadata reconciliation failed; earlier saving results are retained.");}
   op=await get(op);if(op.outcomes.reconciliation.state==="succeeded")try{await observe(op);}catch(error){await journal.stage(op.id,"reconciliation","pending",error instanceof Error?error.message:"Device observation confirmation is pending. Local files and database receipt are retained.");}
   if(op.outcomes.clipboard.state!=="succeeded")try{await copy(op);}catch{/* copying never changes successful saving */}
  }
  return get(op);
 }
 return {run,database,copy};
}
