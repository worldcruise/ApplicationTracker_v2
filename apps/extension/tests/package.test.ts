import test from "node:test";
import assert from "node:assert/strict";
import {IDBFactory} from "fake-indexeddb";
import {historyHash,packagePaths,windowsName} from "@candidate/domain";
import {classicLayout,type FrozenPackageInput,type FrozenTemplate,type PackageSyncResult} from "@candidate/contracts";
import {packageJournal,type PackageOperation} from "../src/package-journal";
import {packageFiles} from "../src/package-files";
import {DIRECTORY_KEY,localStore} from "../src/local-store";
import {archiveHistory} from "../src/archive";
import {packageProduction} from "../src/package-production";
import {ExtensionApiError,type ExtensionApi} from "../src/api";

const actor="a9000000-0000-4000-9000-000000000001",org="a9000000-0000-4000-9000-000000000100",candidate="a9000000-0000-4000-9000-000000000200";
const raw=' {\n"company":"Synthetic Package Co","title":"Engineer","summary":"Synthetic tools","skills":[],"experience":[],"education":[],"original_extension":"preserved"\n}\n';
const template:FrozenTemplate={id:"a7000000-0000-4000-9000-000000000001",name:"ATS Classic",version:1,layout:classicLayout,layoutHash:"f".repeat(64),assetHashes:{font:"e".repeat(64)},rendererVersion:"ats-classic/1.0.0"};
async function frozen(factory=new IDBFactory()){
 const pdf=new TextEncoder().encode("%PDF-1.4 synthetic package bytes");
 const value:Omit<FrozenPackageInput,"version"|"operationId"|"deviceId"|"createdAt"|"identifiers"|"relativePath">={actorId:actor,organizationId:org,candidateId:candidate,candidateName:"Synthetic Candidate",context:{company:"Synthetic Package Co",title:"Engineer",url:"https://jobs.example.invalid/jobs/123",description:"Synthetic job description",externalId:"123"},resume:{reference:{kind:"operation",operationId:"a9000000-0000-4000-9000-000000000300"},rawJson:raw,pdfSha256:await historyHash(pdf),pageCount:1,schemaVersion:1,profileRevision:1,template,rendererVersion:template.rendererVersion,renderedAt:"2026-10-20T00:00:00.000Z"},coverLetter:{reference:{kind:"operation",operationId:"a9000000-0000-4000-9000-000000000400"},text:"Synthetic original letter\n"},existingBidId:null};
 return {value,pdf,factory,journal:packageJournal(factory)};
}
class Dir {
 kind="directory";permission:PermissionState="granted";children=new Map<string,Dir>();files=new Map<string,Uint8Array>();failName:string|null=null;
 constructor(public name:string,public parent:Dir|null=null){}
 async queryPermission(){return this.permission;}
 async isSameEntry(other:unknown){return other===this;}
 async resolve(other:Dir){const path=[];let next:Dir|null=other;while(next&&next!==this){path.unshift(next.name);next=next.parent;}return next===this?path:null;}
 async getDirectoryHandle(name:string,options?:{create?:boolean}){let dir=this.children.get(name);if(!dir){if(!options?.create)throw new DOMException("Missing","NotFoundError");dir=new Dir(name,this);this.children.set(name,dir);}return dir;}
 async *entries(){for(const row of this.children)yield row;}
 root():Dir{return this.parent?this.parent.root():this;}
 async getFileHandle(name:string,options?:{create?:boolean}){
  if(!this.files.has(name)){if(!options?.create)throw new DOMException("Missing","NotFoundError");this.files.set(name,new Uint8Array());}
  return {name,kind:"file",getFile:async()=>new File([new Uint8Array(this.files.get(name)!)],name),createWritable:async()=>{let pending=new Uint8Array();return {write:async(value:Uint8Array)=>{pending=new Uint8Array(value);},close:async()=>{if(this.root().failName===name){this.root().failName=null;this.files.set(name,pending.slice(0,Math.max(1,Math.floor(pending.length/2))));throw Error("Simulated interrupted close");}this.files.set(name,pending);},abort:async()=>{}};}};
 }
}
function installLocks(t:{after:(fn:()=>void)=>void}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,"navigator"),locks=new Map<string,Promise<unknown>>();
 const request=<T>(name:string,work:()=>Promise<T>)=>{const next=(locks.get(name)??Promise.resolve()).then(work);locks.set(name,next.catch(()=>{}));return next;};
 Object.defineProperty(globalThis,"navigator",{configurable:true,value:{locks:{request}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,"navigator",previous);});
}
test("package branches settle independently and original receipt recovery avoids a second mutation after timeout",async t=>{
 installLocks(t);Object.assign(navigator,{clipboard:{writeText:async()=>{throw Error("Denied");}}});
 const f=await frozen();const op=await f.journal.freeze({...f.value,resume:{...f.value.resume,reference:{kind:"document",documentId:crypto.randomUUID()}},coverLetter:null},f.pdf);
 const receipt:PackageSyncResult={operationId:op.id,bidId:crypto.randomUUID(),reusedBid:false,resumeDocumentId:crypto.randomUUID(),resumeVersionId:crypto.randomUUID(),coverLetterVersionId:null,createdAt:op.input.createdAt};
 let committed:PackageSyncResult|null=null,posts=0;let release!:()=>void;const held=new Promise<void>(r=>{release=r;});
 const api={withActor:async<T>(_actor:string,work:()=>Promise<T>)=>work(),request:async(path:string,options?:{body?:unknown})=>{if(path==="me")return {organizations:[{organizationId:org,role:"team_member"}]};if(path.startsWith("documents/"))return {};if(!options?.body)return committed;posts++;committed=receipt;await held;throw new ExtensionApiError(0,"NETWORK_ERROR","Synthetic lost response");}} as ExtensionApi;
 const files={writeLocal:async()=>{await f.journal.stage(op.id,"local","succeeded");return f.journal.get(op.id,actor,org);},reconcile:async()=>{const current=await f.journal.get(op.id,actor,org);await f.journal.stage(op.id,"reconciliation",current.result?"succeeded":"pending");return f.journal.get(op.id,actor,org);}};
 const saving=packageProduction(api,f.journal,files,undefined,async()=>{}).run(op);
 for(let tries=0;tries<50;tries++){if((await f.journal.get(op.id,actor,org)).outcomes.local.state==="succeeded")break;await new Promise(r=>setTimeout(r,2));}
 assert.equal((await f.journal.get(op.id,actor,org)).outcomes.local.state,"succeeded");assert.equal((await f.journal.get(op.id,actor,org)).outcomes.database.state,"pending");release();
 const partial=await saving;assert.equal(partial.outcomes.database.state,"unknown");assert.equal(partial.outcomes.local.state,"succeeded");assert.equal(partial.outcomes.clipboard.state,"failed");assert.equal(partial.result,null);
 const reopened=packageJournal(f.factory),recovered=await packageProduction(api,reopened,files,undefined,async()=>{}).run(await reopened.get(op.id,actor,org),{local:false,database:true});
 assert.equal(posts,1);assert.equal(recovered.id,op.id);assert.deepEqual(recovered.result,receipt);assert.equal(recovered.outcomes.database.state,"succeeded");assert.equal(recovered.outcomes.reconciliation.state,"succeeded");assert.equal(recovered.outcomes.clipboard.state,"failed");
});
test("database-only success persists across local denial and another identity cannot reconcile the queue",async t=>{
 installLocks(t);Object.assign(navigator,{clipboard:{writeText:async()=>{}}});const f=await frozen(),op=await f.journal.freeze(f.value,f.pdf);
 const receipt:PackageSyncResult={operationId:op.id,bidId:crypto.randomUUID(),reusedBid:false,resumeDocumentId:crypto.randomUUID(),resumeVersionId:crypto.randomUUID(),coverLetterVersionId:null,createdAt:op.input.createdAt};
 let revoked=false,posts=0;const api={withActor:async<T>(_actor:string,work:()=>Promise<T>)=>{if(revoked)throw Error("Account changed");return work();},request:async(path:string,options?:{body?:unknown})=>{if(revoked)throw new ExtensionApiError(403,"ACCOUNT_CHANGED","Account changed");if(path==="me")return {organizations:[{organizationId:org,role:"team_member"}]};if(path.startsWith("candidates/"))return {};if(options?.body){posts++;return receipt;}return null;}} as ExtensionApi;
 const files={writeLocal:async()=>{await f.journal.stage(op.id,"local","failed","Permission denied");throw Error("Permission denied");},reconcile:async()=>{throw Error("Not yet local");}};
 const noSourceSync=async()=>({}) as never;const partial=await packageProduction(api,f.journal,files,noSourceSync,async()=>{}).run(op);assert.equal(partial.outcomes.local.state,"failed");assert.equal(partial.outcomes.database.state,"succeeded");assert.deepEqual(partial.result,receipt);assert.equal(posts,1);
 revoked=true;const denied=await packageProduction(api,f.journal,files,noSourceSync,async()=>{}).run(op,{local:false,database:true});assert.equal(posts,1);assert.equal(denied.outcomes.database.state,"failed");assert.deepEqual(denied.result,receipt);
});
async function filesystem(){
 const f=await frozen(),op=await f.journal.freeze(f.value,f.pdf),root=new Dir("Synthetic root");const records=new Map<string,unknown>([[DIRECTORY_KEY,root]]);
 const store={get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,value);}} as ReturnType<typeof localStore>;
 const journal={get:async()=>op,stage:async(_id:string,step:keyof PackageOperation["outcomes"],state:PackageOperation["outcomes"][typeof step]["state"],error:string|null=null)=>{const old=op.outcomes[step];op.outcomes[step]={state,error,attempts:old.attempts+(state==="pending"?1:0),updatedAt:new Date().toISOString()};return op;},bindRoot:async(_id:string,selected:FileSystemDirectoryHandle)=>{op.root=selected;return op;},file:async(_id:string,name:string,state:"pending"|"verified",sha256:string)=>{op.fileStates[name]={state,sha256};return op;},metadata:async(_id:string,data:Uint8Array|null,hash:string|null)=>{op.pendingMetadata=data;if(hash)op.metadataHash=hash;return op;}} satisfies Pick<ReturnType<typeof packageJournal>,"get"|"stage"|"bindRoot"|"file"|"metadata">;
 const folder=async()=>{const candidateDir=await root.getDirectoryHandle(op.input.relativePath[0]!);const company=await candidateDir.getDirectoryHandle(op.input.relativePath[1]!);return {company,pkg:await company.getDirectoryHandle(op.input.relativePath[2]!)};};
 return {op,root,store,journal,folder,writer:packageFiles(journal,store)};
}
test("package reservation survives new journal instances and simultaneous clicks without replacing original input",async()=>{
 const f=await frozen();const [a,b]=await Promise.all([f.journal.freeze(f.value,f.pdf),f.journal.freeze(f.value,f.pdf)]);assert.equal(a.id,b.id);assert.equal((await f.journal.list(actor,org)).length,1);
 const reopened=packageJournal(f.factory),op=await reopened.get(a.id,actor,org);assert.equal(op.input.resume.rawJson,raw);await assert.rejects(reopened.get(a.id,"another-account",org),/another account/);
 assert.equal(new TextDecoder().decode(op.frozenFiles!["Resume.json"]),raw);assert.equal(await historyHash(op.frozenFiles!["Resume.pdf"]!),op.input.resume.pdfSha256);
 const changed=await reopened.freeze(f.value,f.pdf,"explicit-new-intent");assert.notEqual(changed.id,a.id);
 const store=localStore(f.factory);await store.put("archive-package:"+a.id,{...op,input:{...op.input,candidateName:"Changed"}});await assert.rejects(reopened.get(a.id,actor,org),/integrity/);
});
test("Windows package paths remain bounded and retain IDs after sanitization and truncation",async()=>{
 assert.equal(windowsName("CON"),"_CON");assert.equal(windowsName("COM1a",4),"_COM1");assert.ok(!/[<>:"/\\|?*]/u.test(windowsName('unsafe<>:"/\\|?*name... ')));assert.ok(windowsName("😀".repeat(100)).length<=40);
 const f=await frozen(),id=crypto.randomUUID(),date="2026-10-20T00:00:00Z";const a=await packagePaths("Long😀".repeat(100),candidate,{...f.value.context,company:"A/B"},id,date),b=await packagePaths("Long😀".repeat(100),candidate,{...f.value.context,company:"A?B"},id,date);
 assert.ok(a.join("/").length<=240);assert.ok(a[0]!.endsWith(candidate));assert.ok(a[2]!.endsWith(id));assert.notEqual(a[1],b[1]);
});
test("repeated local saves preserve original JSON/PDF, one index entry and independent database state",async t=>{
 installLocks(t);const f=await filesystem();await Promise.all([f.writer.writeLocal(f.op),f.writer.writeLocal(f.op)]);const {company,pkg}=await f.folder();
 assert.equal(new TextDecoder().decode(pkg.files.get("Resume.json")),raw);assert.equal(await historyHash(pkg.files.get("Resume.pdf")!),f.op.input.resume.pdfSha256);assert.equal(new TextDecoder().decode(pkg.files.get("CoverLetter.txt")),f.op.input.coverLetter!.text);
 assert.equal(f.op.outcomes.local.state,"succeeded");assert.equal(f.op.outcomes.database.state,"idle");assert.equal(f.op.outcomes.reconciliation.state,"pending");assert.equal(JSON.parse(new TextDecoder().decode(company.files.get("archive-index.json"))).entries.length,1);
 const meta=JSON.parse(new TextDecoder().decode(pkg.files.get("metadata.json")));assert.equal(meta.packageComplete,true);assert.equal(meta.submissionRecorded,false);assert.equal(meta.files["Resume.json"].sha256,await historyHash(new TextEncoder().encode(raw)));
});
test("interrupted data and metadata prefixes recover from frozen bytes after reopening the writer",async t=>{
 installLocks(t);for(const name of ["Resume.pdf","metadata.json"]){const f=await filesystem();f.root.failName=name;await assert.rejects(f.writer.writeLocal(f.op),/interrupted/);assert.equal(f.op.outcomes.local.state,"failed");await packageFiles(f.journal,f.store).writeLocal(f.op);assert.equal(f.op.outcomes.local.state,"succeeded");const {pkg}=await f.folder();assert.equal(await historyHash(pkg.files.get("Resume.pdf")!),f.op.input.resume.pdfSha256);}
});
test("database-only results survive permission denial and reconcile after the original local retry",async t=>{
 installLocks(t);const f=await filesystem();f.op.result={operationId:f.op.id,bidId:crypto.randomUUID(),reusedBid:false,resumeDocumentId:crypto.randomUUID(),resumeVersionId:crypto.randomUUID(),coverLetterVersionId:null,createdAt:f.op.input.createdAt} satisfies PackageSyncResult;f.op.outcomes.database.state="succeeded";f.root.permission="denied";
 await assert.rejects(f.writer.writeLocal(f.op),/permission/);assert.equal(f.op.outcomes.database.state,"succeeded");assert.equal(f.root.children.size,0);f.root.permission="granted";await f.writer.writeLocal(f.op);assert.equal(f.op.outcomes.reconciliation.state,"succeeded");const {pkg}=await f.folder();assert.equal(JSON.parse(new TextDecoder().decode(pkg.files.get("metadata.json"))).bidId,f.op.result.bidId);
});
test("conflicting files are never overwritten and index-only failure preserves verified local files",async t=>{
 installLocks(t);const f=await filesystem();await f.writer.writeLocal(f.op);const {company,pkg}=await f.folder();const original=pkg.files.get("Resume.pdf")!;const changed=original.slice();changed[changed.length-1]=changed[changed.length-1]!^1;pkg.files.set("Resume.pdf",changed);await assert.rejects(f.writer.writeLocal(f.op),/different bytes/);assert.deepEqual(pkg.files.get("Resume.pdf"),changed);assert.equal(f.op.outcomes.local.state,"conflict");
 pkg.files.set("Resume.pdf",original);company.files.set("archive-index.json",new TextEncoder().encode("{broken"));await assert.rejects(f.writer.writeLocal(f.op));assert.equal(f.op.outcomes.local.state,"succeeded");assert.equal(f.op.outcomes.reconciliation.state,"failed");
 const repair=await archiveHistory(f.store).repair({actorId:actor,organizationId:org,candidateId:candidate},f.op.input.context);assert.equal(repair.written,true);await f.writer.reconcile(f.op);assert.equal(f.op.outcomes.local.state,"succeeded");
});
