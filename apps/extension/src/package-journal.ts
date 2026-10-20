import type {FrozenPackageInput,PackageOutcome,PackageOutcomes,PackageStep,PackageSyncResult} from "@candidate/contracts";
import {validateResume} from "@candidate/contracts";
import {historyHash,identifyJob,normalizedText,packageJobDetails,packagePaths,validateHistoryContext} from "@candidate/domain";
import {DIRECTORY_KEY,localStore} from "./local-store";
export interface PackageOperation {
  id:string;input:FrozenPackageInput;inputHash:string;pdf:Uint8Array;root:FileSystemDirectoryHandle|null;
  outcomes:PackageOutcomes;result:PackageSyncResult|null;fileStates:Record<string,{state:"pending"|"verified";sha256:string}>;
  pendingMetadata:Uint8Array|null;metadataHash:string|null;nextRetryAt:string|null;
  frozenFiles?:Record<string,Uint8Array>;frozenFilesHash?:string;
}
async function filesHash(files:Record<string,Uint8Array>){const hashes=[];for(const name of Object.keys(files).sort())hashes.push([name,files[name]!.length,await historyHash(files[name]!)]);return historyHash(JSON.stringify(hashes));}
const key=(id:string)=>"archive-package:"+id;
const initial=():PackageOutcomes=>Object.fromEntries(["local","database","reconciliation","clipboard"].map(k=>[k,{state:"idle",attempts:0,updatedAt:null,error:null}])) as PackageOutcomes;
export function packageJournal(factory:IDBFactory=indexedDB){
  const store=localStore(factory);
  async function verify(op:PackageOperation|undefined,actor:string,org:string){if(!op||op.input.actorId!==actor||op.input.organizationId!==org)throw Error("This package belongs to another account or organization; it was not replayed.");if(op.inputHash!==await historyHash(JSON.stringify(op.input))||await historyHash(op.pdf)!==op.input.resume.pdfSha256||op.frozenFiles&&op.frozenFilesHash!==await filesHash(op.frozenFiles))throw Error("Frozen package integrity check failed.");return op;}
  return {
    async freeze(value:Omit<FrozenPackageInput,"version"|"operationId"|"deviceId"|"createdAt"|"identifiers"|"relativePath">,pdf:Uint8Array,intent="current"){
      const content=validateResume(value.resume.rawJson).content;if(!content)throw Error("Validate the original resume JSON before freezing a package.");
      if(content.company.trim()&&normalizedText(content.company)!==normalizedText(value.context.company))throw Error("Use a resume frozen for this target company; original JSON cannot be silently changed.");
      if(value.coverLetter&&new TextEncoder().encode(value.coverLetter.text).length>204800)throw Error("Cover letter exceeds 200 KiB.");
      validateHistoryContext(value.context);if(await historyHash(pdf)!==value.resume.pdfSha256||pdf.length>10*1024*1024)throw Error("Frozen PDF hash/inspection limit is invalid.");
      let device=await store.get<string>("production-device");if(!device){try{device=crypto.randomUUID();await store.add("production-device",device);}catch{device=await store.get<string>("production-device");}}if(!device)throw Error("Device identity could not be persisted.");
      const id=crypto.randomUUID(),createdAt=new Date().toISOString();
      const input:FrozenPackageInput={...structuredClone(value),version:1,operationId:id,deviceId:device,createdAt,identifiers:await identifyJob(value.context),relativePath:await packagePaths(value.candidateName,value.candidateId,value.context,id,createdAt)};
      const root=await store.get<FileSystemDirectoryHandle>(DIRECTORY_KEY)??null;
      const link=await store.get<{root:FileSystemDirectoryHandle;path:string[]}>("archive-link:"+value.actorId+":"+value.organizationId+":"+value.candidateId+":"+await historyHash(input.identifiers.companyKey));
      if(link&&root){if(!await root.isSameEntry(link.root))throw Error("The intended archive root changed. Relink before freezing this package.");input.relativePath=[...link.path,input.relativePath[2]!];}
      const op:PackageOperation={id,input,inputHash:await historyHash(JSON.stringify(input)),pdf:new Uint8Array(pdf),root,outcomes:initial(),result:null,fileStates:{},pendingMetadata:null,metadataHash:null,nextRetryAt:null};
      op.frozenFiles={"JobDetails.txt":new TextEncoder().encode(packageJobDetails(input)),"Resume.json":new TextEncoder().encode(input.resume.rawJson),"Resume.pdf":new Uint8Array(pdf)};
      if(input.coverLetter)op.frozenFiles["CoverLetter.txt"]=new TextEncoder().encode(input.coverLetter.text);
      op.frozenFilesHash=await filesHash(op.frozenFiles);
      const reservation="archive-package-reservation:"+value.actorId+":"+value.organizationId+":"+value.candidateId+":"+intent+":"+await historyHash(JSON.stringify(value));
      const selected=await store.reserve(reservation,"archive-package:",id,op);
      const saved=await store.get<PackageOperation>(key(selected));if(!saved)throw Error("The reserved operation is missing. Inspect local storage; a new operation was not replayed.");
      return verify(saved,value.actorId,value.organizationId);
    },
    async get(id:string,actor:string,org:string){return verify(await store.get<PackageOperation>(key(id)),actor,org);},
    async list(actor:string,org:string){return (await store.entries<PackageOperation>("archive-package:")).filter(op=>op.input.actorId===actor&&op.input.organizationId===org);},
    async stage(id:string,step:PackageStep,state:PackageOutcome["state"],error:string|null=null){return store.change<PackageOperation>(key(id),op=>{if(!op)throw Error("Package journal missing.");const previous=op.outcomes[step];return {...op,...(step==="database"?{nextRetryAt:state==="unknown"?new Date(Date.now()+Math.min(60000,1000*2**Math.min(6,previous.attempts))*(0.75+Math.random()*0.5)).toISOString():null}:{}),outcomes:{...op.outcomes,[step]:{state,error,attempts:previous.attempts+(state==="pending"?1:0),updatedAt:new Date().toISOString()}}};});},
    async bindRoot(id:string,root:FileSystemDirectoryHandle){const old=await store.get<PackageOperation>(key(id));if(!old)throw Error("Package missing.");if(old.root&&!await old.root.isSameEntry(root))throw Error("Original package root differs. Relink the original root instead of replaying elsewhere.");return store.change<PackageOperation>(key(id),op=>{if(!op)throw Error("Package missing.");return {...op,root:op.root??root};});},
    async file(id:string,name:string,state:"pending"|"verified",sha256:string){return store.change<PackageOperation>(key(id),op=>{if(!op||op.fileStates[name]&&op.fileStates[name]!.sha256!==sha256)throw Error("Frozen file hash cannot change.");return {...op,fileStates:{...op.fileStates,[name]:{state,sha256}}};});},
    async metadata(id:string,bytes:Uint8Array|null,hash:string|null){return store.change<PackageOperation>(key(id),op=>{if(!op)throw Error("Package missing.");return {...op,pendingMetadata:bytes,metadataHash:hash??op.metadataHash};});},
    async result(id:string,result:PackageSyncResult){return store.change<PackageOperation>(key(id),op=>{if(!op||result.operationId!==id||op.result&&JSON.stringify(op.result)!==JSON.stringify(result))throw Error("Immutable package result cannot change.");return {...op,result};});}
  };
}
export async function packageLock<T>(id:string,stage:string,work:()=>Promise<T>){if(!navigator.locks)throw Error("Web Locks are required for recoverable package operations.");return navigator.locks.request("archive-package:"+id+":"+stage,work);}
