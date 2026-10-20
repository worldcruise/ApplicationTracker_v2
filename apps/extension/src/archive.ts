import { HISTORY_VERSION, type ArchiveHistory, type ArchiveIndexV1, type ArchiveManifestV1, type HistoryIdentifiers, type ReviewedJobContext } from "@candidate/contracts";
import { historyHash, identifyJob, matchIdentifiers, validateHistoryContext } from "@candidate/domain";
import { DIRECTORY_KEY,localStore } from "./local-store";
import type { CaptureScope } from "./capture";

const MAX_PACKAGES=100, MAX_FILE=10*1024*1024, MAX_TOTAL=32*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const hash=/^[0-9a-f]{64}$/u;
const fileNames=["JobDetails.txt","Resume.pdf","Resume.json","CoverLetter.txt"];
export class ArchiveError extends Error {
  constructor(public state:ArchiveHistory["state"],message:string,public repair=false){super(message);}
}
interface Link {root:FileSystemDirectoryHandle; path:string[]}
type Store=ReturnType<typeof localStore>;
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value)&&!Object.keys(value).some(k=>["__proto__","prototype","constructor"].includes(k));}
export function safeSegment(value:unknown):value is string {
  return typeof value==="string"&&value.length>0&&value.length<=150&&!/[<>:"/\\|?*\u0000-\u001f]/u.test(value)&&value!=="."&&value!==".."&&!/[. ]$/u.test(value)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(value);
}
function identifiersEqual(actual:unknown,expected:HistoryIdentifiers) {
  return object(actual)&&Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>actual[k]===v);
}
async function jsonFile(dir:FileSystemDirectoryHandle,name:string,max=1048576):Promise<unknown>{
  const file=await (await dir.getFileHandle(name)).getFile();if(file.size>max)throw new ArchiveError("unknown",name+" exceeds the bounded inspection size.",true);
  try{return JSON.parse(await file.text());}catch{throw new ArchiveError("unknown",name+" is not readable versioned JSON.",true);}
}
async function permission(handle:FileSystemDirectoryHandle,write=false){
  const result=await handle.queryPermission({mode:write?"readwrite":"read"});
  if(result!=="granted")throw new ArchiveError("permission_required","Archive permission must be renewed explicitly; no absence was inferred.");
}
export async function readManifest(dir:FileSystemDirectoryHandle,scope:CaptureScope,companyKey:string,budget={bytes:0}):Promise<ArchiveManifestV1>{
  const raw=await jsonFile(dir,"metadata.json");
  if(!object(raw)||raw.archiveVersion!==1||raw.schemaVersion!==1||raw.organizationId!==scope.organizationId||raw.candidateId!==scope.candidateId||!uuid.test(String(raw.operationId))||!(raw.bidId===null||uuid.test(String(raw.bidId)))||!uuid.test(String(raw.templateVersionId))||typeof raw.rendererVersion!=="string"||!raw.rendererVersion||raw.rendererVersion.length>100||typeof raw.packageComplete!=="boolean"||!object(raw.files))throw new ArchiveError("unknown","Package metadata version or organization/candidate scope is invalid.",true);
  let context:ReviewedJobContext;try{context=validateHistoryContext(raw.context);}catch{throw new ArchiveError("unknown","Package job context is invalid.",true);}
  const identifiers=await identifyJob(context);
  if(identifiers.companyKey!==companyKey||!identifiersEqual(raw.identifiers,identifiers))throw new ArchiveError("unknown","Package identifiers do not match the reviewed company/context.",true);
  if(!raw.packageComplete)throw new ArchiveError("unknown","An indexed package is incomplete; inspect it before claiming local absence.",true);
  for(const name of fileNames.slice(0,3))if(!Object.hasOwn(raw.files,name))throw new ArchiveError("unknown","A package is missing a required file manifest.",true);
  for(const [name,value] of Object.entries(raw.files)){
    if(!fileNames.includes(name)||!object(value)||!hash.test(String(value.sha256))||!Number.isSafeInteger(value.bytes)||(value.bytes as number)<0||(value.bytes as number)>MAX_FILE)throw new ArchiveError("unknown","Package file manifest is invalid or exceeds inspection limits.",true);
    const file=await (await dir.getFileHandle(name)).getFile();budget.bytes+=file.size;
    if(file.size!==value.bytes||file.size>MAX_FILE||budget.bytes>MAX_TOTAL)throw new ArchiveError("unknown","Package size differs or bounded inspection budget was exceeded.",true);
    if(await historyHash(new Uint8Array(await file.arrayBuffer()))!==value.sha256)throw new ArchiveError("unknown","Package file hash differs: "+name+". No index hit is trusted.",true);
  }
  return raw as unknown as ArchiveManifestV1;
}
export function buildArchiveIndex(scope:CaptureScope,companyKey:string,entries:ArchiveIndexV1["entries"]):ArchiveIndexV1 {
  const byUrl:Record<string,string[]>={},byDescription:Record<string,string[]>={},byExternal:Record<string,string[]>={};
  for(const entry of entries){if(entry.identifiers.urlHash)(byUrl[entry.identifiers.urlHash]??=[]).push(entry.operationId);if(entry.identifiers.descriptionHash)(byDescription[entry.identifiers.descriptionHash]??=[]).push(entry.operationId);if(entry.identifiers.externalId)(byExternal[JSON.stringify([entry.identifiers.provider,entry.identifiers.externalId])]??=[]).push(entry.operationId);}
  return {archiveVersion:1,organizationId:scope.organizationId,candidateId:scope.candidateId,companyKey,normalizationVersion:HISTORY_VERSION,checkedAt:new Date().toISOString(),entries,byUrl,byDescription,byExternal};
}
export function validateArchiveIndex(raw:unknown,scope:CaptureScope,key:string):ArchiveIndexV1 {
  if(!object(raw)||raw.archiveVersion!==1||raw.organizationId!==scope.organizationId||raw.candidateId!==scope.candidateId||raw.companyKey!==key||raw.normalizationVersion!==HISTORY_VERSION||typeof raw.checkedAt!=="string"||!Number.isFinite(Date.parse(raw.checkedAt))||!Array.isArray(raw.entries)||raw.entries.length>MAX_PACKAGES)throw new ArchiveError("unknown","Archive index is missing, damaged, unsupported or in another scope.",true);
  const ids=new Set<string>(),paths=new Set<string>();
  for(const entry of raw.entries){
    if(!object(entry)||!safeSegment(entry.directory)||!uuid.test(String(entry.operationId))||ids.has(String(entry.operationId))||paths.has(entry.directory)||!object(entry.identifiers)||entry.identifiers.version!==HISTORY_VERSION||entry.identifiers.companyKey!==key)throw new ArchiveError("unknown","Archive index has unsafe, duplicated or invalid entries.",true);
    for(const v of [entry.identifiers.urlHash,entry.identifiers.descriptionHash])if(v!==null&&!hash.test(String(v)))throw new ArchiveError("unknown","Archive index hash is invalid.",true);
    ids.add(String(entry.operationId));paths.add(entry.directory);
  }
  const index=raw as unknown as ArchiveIndexV1;
  const rebuilt=buildArchiveIndex(scope,key,index.entries);
  const sameMap=(a:unknown,b:Record<string,string[]>)=>object(a)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>Array.isArray(a[k])&&JSON.stringify(a[k])===JSON.stringify(v));
  if(!sameMap(raw.byUrl,rebuilt.byUrl)||!sameMap(raw.byDescription,rebuilt.byDescription)||!sameMap(raw.byExternal,rebuilt.byExternal))throw new ArchiveError("unknown","Archive lookup maps differ from the index entries.",true);
  return index;
}
export function archiveHistory(store:Store=localStore()) {
  const linkKey=async(scope:CaptureScope,key:string)=>"archive-link:"+scope.actorId+":"+scope.organizationId+":"+scope.candidateId+":"+await historyHash(key);
  async function linked(scope:CaptureScope,key:string,write=false){
    const root=await store.get<FileSystemDirectoryHandle>(DIRECTORY_KEY);if(!root)throw new ArchiveError("unknown","Choose the intended archive root before checking local history.");
    await permission(root,write);const link=await store.get<Link>(await linkKey(scope,key));
    if(!link)throw new ArchiveError("unknown","This company folder is not linked on this device. Link the intended folder; a missing map is not proof of no archive.");
    if(!await root.isSameEntry(link.root)||link.path.length!==2||!link.path.every(safeSegment)||!link.path[0]!.toLowerCase().endsWith("__"+scope.candidateId.toLowerCase()))throw new ArchiveError("unknown","Archive root or mapped path changed. Relink the intended company folder.",true);
    const candidate=await root.getDirectoryHandle(link.path[0]!);const company=await candidate.getDirectoryHandle(link.path[1]!);await permission(company,write);
    return {company,path:link.path};
  }
  async function link(scope:CaptureScope,context:ReviewedJobContext,company:FileSystemDirectoryHandle){
    const root=await store.get<FileSystemDirectoryHandle>(DIRECTORY_KEY);if(!root)throw new ArchiveError("unknown","Select the intended archive root first.");
    await permission(root);await permission(company);const path=await root.resolve(company);
    if(!path||path.length!==2||!path.every(safeSegment)||!path[0]!.toLowerCase().endsWith("__"+scope.candidateId.toLowerCase()))throw new ArchiveError("unknown","Choose a company folder directly inside CandidateName__CandidateID under the selected root.");
    const key=(await identifyJob(validateHistoryContext(context))).companyKey;
    await store.put(await linkKey(scope,key),{root,path});
    return path.join("/");
  }
  async function lookup(scope:CaptureScope,context:ReviewedJobContext):Promise<ArchiveHistory>{
    const empty={company:[],exact:[],possible:[],checkedAt:new Date().toISOString()};
    try{
      const query=await identifyJob(validateHistoryContext(context));const {company,path}=await linked(scope,query.companyKey);
      const index=validateArchiveIndex(await jsonFile(company,"archive-index.json",2097152),scope,query.companyKey);
      const result:ArchiveHistory={...empty,state:index.entries.length?"found":"not_found",message:"Verified indexed packages only. Files added outside the index require scoped repair.",relativePath:path.join("/"),company:[],exact:[],possible:[]};
      const budget={bytes:0};
      // Direct index paths only: normal lookup never enumerates the root/candidate/company tree.
      for(const entry of index.entries){const dir=await company.getDirectoryHandle(entry.directory);const manifest=await readManifest(dir,scope,query.companyKey,budget);
        if(manifest.operationId!==entry.operationId||!identifiersEqual(entry.identifiers,manifest.identifiers))throw new ArchiveError("unknown","Indexed operation/identifiers differ from package metadata.",true);
        const match=matchIdentifiers(query,manifest.identifiers);const row={id:manifest.bidId??manifest.operationId,company:manifest.context.company,title:manifest.context.title,status:null,submittedAt:null,evidence:match.evidence,path:[...path,entry.directory].join("/"),files:Object.entries(manifest.files).map(([name,value])=>({name,...value}))};
        if(match.company)result.company.push(row);if(match.exact)result.exact.push(row);if(match.possible)result.possible.push(row);
      }
      result.checkedAt=new Date().toISOString();return result;
    }catch(error){
      if(error instanceof ArchiveError)return {...empty,state:error.state,message:error.message,repairRequired:error.repair};
      if(error instanceof DOMException&&["NotAllowedError","SecurityError"].includes(error.name))return {...empty,state:"permission_required",message:"Archive access was denied; local history is unknown."};
      if(error instanceof DOMException&&error.name==="NotFoundError")return {...empty,state:"unknown",message:"A mapped folder, index or required file is missing. Relink or repair the selected company folder.",repairRequired:true};
      return {...empty,state:"check_failed",message:"Local archive inspection failed. No absence was inferred."};
    }
  }
  async function repair(scope:CaptureScope,context:ReviewedJobContext){
    const query=await identifyJob(validateHistoryContext(context));const {company,path}=await linked(scope,query.companyKey,true);
    const entries:ArchiveIndexV1["entries"]=[],failures:string[]=[];const budget={bytes:0};let count=0;
    // Explicit repair enumerates just this company and its immediate package children.
    for await(const [name,handle] of company.entries()){
      if(handle.kind!=="directory")continue;if(++count>MAX_PACKAGES)throw new ArchiveError("unknown","Company repair exceeds 100 package directories. No index was replaced.",true);
      try{if(!safeSegment(name))throw Error("Unsafe folder name");const manifest=await readManifest(handle as FileSystemDirectoryHandle,scope,query.companyKey,budget);entries.push({directory:name,operationId:manifest.operationId,identifiers:manifest.identifiers});}
      catch{failures.push(name);}
    }
    if(failures.length)return {written:false,failures,message:"Unreadable/incomplete packages retained. Existing index was not replaced."};
    if(new Set(entries.map(e=>e.operationId)).size!==entries.length)throw new ArchiveError("unknown","Duplicate operation IDs require manual inspection. No index was replaced.",true);
    const index=buildArchiveIndex(scope,query.companyKey,entries.sort((a,b)=>a.directory.localeCompare(b.directory)));
    validateArchiveIndex(index,scope,query.companyKey);
    const bytes=new TextEncoder().encode(JSON.stringify(index,null,2)+"\n");
    const lock="archive-index:"+await linkKey(scope,query.companyKey);
    if(!navigator.locks)throw new ArchiveError("unknown","Web Locks are required to replace an archive index safely.");
    await navigator.locks.request(lock,async()=>{await permission(company,true);const file=await company.getFileHandle("archive-index.json",{create:true});const stream=await file.createWritable();try{await stream.write(bytes);await stream.close();}catch(error){await stream.abort().catch(()=>{});throw error;}
      if(await historyHash(new Uint8Array(await (await file.getFile()).arrayBuffer()))!==await historyHash(bytes))throw new ArchiveError("unknown","Repaired index failed readback verification.",true);
    });
    return {written:true,failures:[],message:"Company index rebuilt and verified at relative path "+path.join("/")+". Package contents were preserved."};
  }
  return {lookup,link,repair};
}
