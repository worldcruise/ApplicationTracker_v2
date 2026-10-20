import type {ArchiveManifestV1,FrozenPackageInput} from "@candidate/contracts";
import {historyHash} from "@candidate/domain";
import {buildArchiveIndex,readManifest,safeSegment,validateArchiveIndex} from "./archive";
import {DIRECTORY_KEY,localStore} from "./local-store";
import {packageJournal,packageLock,type PackageOperation} from "./package-journal";

type Journal=Pick<ReturnType<typeof packageJournal>,"get"|"stage"|"bindRoot"|"file"|"metadata">;type Store=ReturnType<typeof localStore>;
class PackageConflict extends Error {}
const encoded=(value:string)=>new TextEncoder().encode(value);
const isMissing=(error:unknown)=>error instanceof DOMException&&error.name==="NotFoundError";
async function bytes(file:FileSystemFileHandle){const f=await file.getFile();if(f.size>10*1024*1024)throw new PackageConflict("Existing file exceeds the verified package limit.");return new Uint8Array(await f.arrayBuffer());}
const prefix=(part:Uint8Array,full:Uint8Array)=>part.length<full.length&&part.every((value,index)=>value===full[index]);
async function existing(dir:FileSystemDirectoryHandle,name:string){try{return await dir.getFileHandle(name);}catch(error){if(isMissing(error))return null;throw error;}}
async function replace(file:FileSystemFileHandle,value:Uint8Array){const stream=await file.createWritable();try{await stream.write(new Uint8Array(value));await stream.close();}catch(error){await stream.abort().catch(()=>{});throw error;}if(await historyHash(await bytes(file))!==await historyHash(value))throw Error("Closed file failed hash readback.");}
export async function frozenPackageFiles(op:PackageOperation){
  if(op.frozenFiles)return structuredClone(op.frozenFiles);
  // Original AP01 journals retain their formatter rather than substituting newer bytes on retry.
  const legacyJob=["Target company: "+op.input.context.company,"Job title: "+op.input.context.title,"Original URL: "+op.input.context.url,"Posting identifier: "+op.input.context.externalId,"Captured/frozen at: "+op.input.createdAt,"Operation: "+op.input.operationId,"","Reviewed job description:",op.input.context.description,""].join("\n");
  const files:Record<string,Uint8Array>={"JobDetails.txt":encoded(legacyJob),"Resume.json":encoded(op.input.resume.rawJson),"Resume.pdf":new Uint8Array(op.pdf)};
  if(op.input.coverLetter)files["CoverLetter.txt"]=encoded(op.input.coverLetter.text);
  return files;
}
async function fileManifest(files:Record<string,Uint8Array>){const result:ArchiveManifestV1["files"]={};for(const [name,value] of Object.entries(files))result[name]={bytes:value.length,sha256:await historyHash(value)};return result;}
function metadata(op:PackageOperation,files:ArchiveManifestV1["files"],complete:boolean){
  const i=op.input;
  return {archiveVersion:1,organizationId:i.organizationId,candidateId:i.candidateId,operationId:op.id,bidId:op.result?.bidId??null,context:i.context,identifiers:i.identifiers,packageComplete:complete,
    schemaVersion:1,templateVersionId:i.resume.template.id,rendererVersion:i.resume.rendererVersion,files,inputHash:op.inputHash,createdAt:i.createdAt,deviceId:i.deviceId,
    profileRevision:i.resume.profileRevision,templateVersion:i.resume.template.version,templateLayoutHash:i.resume.template.layoutHash,fontAndAssetHashes:i.resume.template.assetHashes,pdfSha256:i.resume.pdfSha256,
    synchronization:{state:op.outcomes.database.state,checkedAt:op.outcomes.database.updatedAt,resumeVersionId:op.result?.resumeVersionId??null,resumeDocumentId:op.result?.resumeDocumentId??null,coverLetterVersionId:op.result?.coverLetterVersionId??null},
    capturedAt:i.capturedAt??null,relativePath:i.relativePath.join("/"),submissionRecorded:false};
}
function ownManifest(value:unknown,op:PackageOperation,expected:ArchiveManifestV1["files"]){
  const raw=value as Record<string,unknown>;
  if(!raw||raw.operationId!==op.id||raw.inputHash!==op.inputHash||raw.organizationId!==op.input.organizationId||raw.candidateId!==op.input.candidateId||JSON.stringify(raw.files)!==JSON.stringify(expected)||JSON.stringify(raw.context)!==JSON.stringify(op.input.context))throw new PackageConflict("Existing metadata differs from this frozen operation. No package content was overwritten.");
  return raw;
}
export function packageFiles(journal:Journal=packageJournal(),store:Store=localStore()){
  const scope=(i:FrozenPackageInput)=>({actorId:i.actorId,organizationId:i.organizationId,candidateId:i.candidateId});
  const get=(op:PackageOperation)=>journal.get(op.id,op.input.actorId,op.input.organizationId);
  async function locations(op:PackageOperation){
    const selected=await store.get<FileSystemDirectoryHandle>(DIRECTORY_KEY);if(!selected)throw Error("Choose the intended archive root before local package saving.");
    op=await journal.bindRoot(op.id,selected);const root=op.root!;
    if(await root.queryPermission({mode:"readwrite"})!=="granted")throw Error("Archive write permission is required. Renew it explicitly; database results are retained.");
    const path=op.input.relativePath;
    if(path.length!==3||!path.every(safeSegment)||path.join("/").length>240||!path[0]!.toLowerCase().endsWith("__"+op.input.candidateId)||!path[2]!.endsWith("__"+op.id))throw new PackageConflict("Frozen relative path is unsafe or too long. Relink a shorter valid path before creating a new operation.");
    const candidate=await root.getDirectoryHandle(path[0]!,{create:true});
    let company:FileSystemDirectoryHandle;
    try{company=await candidate.getDirectoryHandle(path[1]!);}catch(error){if(!isMissing(error))throw error;company=await candidate.getDirectoryHandle(path[1]!,{create:true});
      const index=buildArchiveIndex(scope(op.input),op.input.identifiers.companyKey,[]);const handle=await company.getFileHandle("archive-index.json",{create:true});await replace(handle,encoded(JSON.stringify(index,null,2)+"\n"));}
    const linkKey="archive-link:"+op.input.actorId+":"+op.input.organizationId+":"+op.input.candidateId+":"+await historyHash(op.input.identifiers.companyKey);
    await store.put(linkKey,{root,path:path.slice(0,2)});
    return {company,pkg:await company.getDirectoryHandle(path[2]!,{create:true})};
  }
  async function metaWrite(op:PackageOperation,dir:FileSystemDirectoryHandle,value:unknown){
    const data=encoded(JSON.stringify(value,null,2)+"\n");await journal.metadata(op.id,data,null);
    const file=await dir.getFileHandle("metadata.json",{create:true});await replace(file,data);await journal.metadata(op.id,null,await historyHash(data));
  }
  async function manifestBeforeWrite(op:PackageOperation,dir:FileSystemDirectoryHandle,expected:ArchiveManifestV1["files"]){
    let file=await existing(dir,"metadata.json");
    if(file){let data=await bytes(file);let parsed:unknown;
      try{parsed=JSON.parse(new TextDecoder().decode(data));}catch{
        if(!op.pendingMetadata||!prefix(data,op.pendingMetadata))throw new PackageConflict("Metadata is damaged and cannot be tied to an interrupted write. Inspect this operation; no overwrite occurred.");
        await replace(file,op.pendingMetadata);data=new Uint8Array(op.pendingMetadata);parsed=JSON.parse(new TextDecoder().decode(data));await journal.metadata(op.id,null,await historyHash(data));
      }
      return ownManifest(parsed,op,expected);
    }
    const initial=metadata(op,expected,false);await metaWrite(op,dir,initial);file=await dir.getFileHandle("metadata.json");return ownManifest(JSON.parse(new TextDecoder().decode(await bytes(file))),op,expected);
  }
  async function reconcileLocked(op:PackageOperation,dir:FileSystemDirectoryHandle,company:FileSystemDirectoryHandle){
    await journal.stage(op.id,"reconciliation","pending");
    try{
      op=await get(op);if(op.outcomes.local.state!=="succeeded")throw Error("Local files are not yet verified; metadata reconciliation remains pending.");
      await readManifest(dir,scope(op.input),op.input.identifiers.companyKey);
      const expected=await fileManifest(await frozenPackageFiles(op));await manifestBeforeWrite(op,dir,expected);await metaWrite(op,dir,metadata(await get(op),expected,true));
      await packageLock(op.input.organizationId+":"+op.input.candidateId+":"+op.input.identifiers.companyKey,"company-index",async()=>{
        const handle=await existing(company,"archive-index.json");if(!handle)throw Error("Company index is missing. Repair this company explicitly; verified package files are retained.");
        const file=await handle.getFile();if(file.size>2097152)throw Error("Company index exceeds the inspection bound.");
        const index=validateArchiveIndex(JSON.parse(await file.text()),scope(op.input),op.input.identifiers.companyKey);
        const old=index.entries.find(e=>e.operationId===op.id);
        if(old&&(old.directory!==op.input.relativePath[2]||JSON.stringify(old.identifiers)!==JSON.stringify(op.input.identifiers)))throw new PackageConflict("Existing index operation differs; repair is required.");
        const entries=index.entries.filter(e=>e.operationId!==op.id);entries.push({directory:op.input.relativePath[2]!,operationId:op.id,identifiers:op.input.identifiers});
        const next=buildArchiveIndex(scope(op.input),op.input.identifiers.companyKey,entries);validateArchiveIndex(next,scope(op.input),op.input.identifiers.companyKey);
        await replace(handle,encoded(JSON.stringify(next,null,2)+"\n"));
      });
      op=await get(op);await journal.stage(op.id,"reconciliation",op.result&&op.outcomes.database.state==="succeeded"?"succeeded":"pending",op.result?null:"Database confirmation is still required to reconcile IDs.");
    }catch(error){await journal.stage(op.id,"reconciliation",error instanceof PackageConflict?"conflict":"failed",error instanceof Error?error.message:"Metadata/index reconciliation failed.");throw error;}
  }
  async function writeLocal(op:PackageOperation){return packageLock(op.id,"local",async()=>{
    op=await get(op);await journal.stage(op.id,"local","pending");let where:Awaited<ReturnType<typeof locations>>;
    try{
      // One company lock protects creation of its initial index across workspace operations.
      where=await packageLock(op.input.organizationId+":"+op.input.candidateId+":"+op.input.identifiers.companyKey,"company-index",()=>locations(op));
      op=await get(op);const files=await frozenPackageFiles(op),expected=await fileManifest(files);const manifest=await manifestBeforeWrite(op,where.pkg,expected);
      for(const [name,value] of Object.entries(files)){
        const hash=expected[name]!.sha256;const prior=await existing(where.pkg,name);
        if(prior){const actual=await bytes(prior);if(await historyHash(actual)===hash){await journal.file(op.id,name,"verified",hash);continue;}
          op=await get(op);if(manifest.packageComplete!==false||op.fileStates[name]?.state!=="pending"||!prefix(actual,value))throw new PackageConflict(name+" has different bytes. No existing content was overwritten.");
        }
        await journal.file(op.id,name,"pending",hash);await replace(prior??await where.pkg.getFileHandle(name,{create:true}),value);await journal.file(op.id,name,"verified",hash);
      }
      op=await get(op);await metaWrite(op,where.pkg,metadata(op,expected,true));await journal.stage(op.id,"local","succeeded");
    }catch(error){await journal.stage(op.id,"local",error instanceof PackageConflict?"conflict":"failed",error instanceof Error?error.message:"Local package write failed.");throw error;}
    await reconcileLocked(await get(op),where.pkg,where.company);return get(op);
  });}
  async function reconcile(op:PackageOperation){return packageLock(op.id,"local",async()=>{const where=await locations(op);await reconcileLocked(await get(op),where.pkg,where.company);return get(op);});}
  return {writeLocal,reconcile};
}
