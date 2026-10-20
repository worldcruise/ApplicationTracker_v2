import test from "node:test";
import assert from "node:assert/strict";
import {IDBFactory} from "fake-indexeddb";
import {historyHash,identifyJob} from "@candidate/domain";
import type {ArchiveManifestV1} from "@candidate/contracts";
import {archiveHistory,buildArchiveIndex,safeSegment} from "../src/archive";
import {captureContext,extractPageContext,ACTIVE_CAPTURE_SCOPE} from "../src/capture";
import {localStore,DIRECTORY_KEY} from "../src/local-store";
const scope={actorId:"a9000000-0000-4000-9000-000000000001",organizationId:"a9000000-0000-4000-9000-000000000100",candidateId:"a9000000-0000-4000-9000-000000000200"};
const context={company:"Synthetic Archive",title:"Engineer",url:"https://jobs.example.invalid/jobs/123",description:"Build synthetic tools",externalId:"123"};
class Directory {
  kind="directory";permission:PermissionState="granted";enumerations=0;children=new Map<string,Directory>();files=new Map<string,Uint8Array>();
  constructor(public name:string,public parent:Directory|null=null){}
  async queryPermission(){return this.permission;}
  async isSameEntry(other:unknown){return this===other;}
  async resolve(other:Directory){const path=[];let next:Directory|null=other;while(next&&next!==this){path.unshift(next.name);next=next.parent;}return next===this?path:null;}
  async getDirectoryHandle(name:string){const child=this.children.get(name);if(!child)throw new DOMException("Missing synthetic folder","NotFoundError");return child;}
  add(name:string){const child=new Directory(name,this);this.children.set(name,child);return child;}
  put(name:string,value:unknown){this.files.set(name,new TextEncoder().encode(typeof value==="string"?value:JSON.stringify(value)));}
  async getFileHandle(name:string,options?:{create?:boolean}){
    if(!this.files.has(name)&&!options?.create)throw new DOMException("Missing synthetic file","NotFoundError");
    return {name,kind:"file",getFile:async()=>{const bytes=this.files.get(name)!;return new File([new Uint8Array(bytes)],name);},createWritable:async()=>({write:async(bytes:Uint8Array)=>{this.files.set(name,new Uint8Array(bytes));},async close(){},async abort(){}})};
  }
  async *entries(){this.enumerations++;for(const row of this.children)yield row;}
}
function storeMemory(){const rows=new Map<string,unknown>();return {async get<T>(key:string){return rows.get(key) as T|undefined;},async put(key:string,v:unknown){rows.set(key,v);}} as ReturnType<typeof localStore>;}
async function fixture(){
  const store=storeMemory(),root=new Directory("Synthetic Root"),candidate=root.add("Synthetic Candidate__"+scope.candidateId),company=candidate.add("Synthetic Company__hash"),pkg=company.add("Synthetic_Operation");
  await store.put(DIRECTORY_KEY,root);const ids=await identifyJob(context);
  const manifest:ArchiveManifestV1={archiveVersion:1,organizationId:scope.organizationId,candidateId:scope.candidateId,operationId:"a9000000-0000-4000-9000-000000000300",bidId:null,context,identifiers:ids,packageComplete:true,schemaVersion:1,templateVersionId:"a7000000-0000-4000-9000-000000000001",rendererVersion:"ats-classic/1.0.0",files:{}};
  for(const name of ["JobDetails.txt","Resume.pdf","Resume.json"]){pkg.put(name,"Synthetic "+name);const bytes=pkg.files.get(name)!;manifest.files[name]={sha256:await historyHash(bytes),bytes:bytes.length};}
  pkg.put("metadata.json",manifest);company.put("archive-index.json",buildArchiveIndex(scope,ids.companyKey,[{directory:pkg.name,operationId:manifest.operationId,identifiers:ids}]));
  const service=archiveHistory(store);await service.link(scope,context,company as unknown as FileSystemDirectoryHandle);
  return {store,root,candidate,company,pkg,manifest,service};
}
test("direct archive lookup verifies every indexed package and never scans; source failures remain unknown",async()=>{
  const f=await fixture();const result=await f.service.lookup(scope,context);
  assert.equal(result.state,"found");assert.equal(result.exact.length,1);assert.equal(result.company[0]!.status,null);assert.equal(f.root.enumerations+f.candidate.enumerations+f.company.enumerations,0);
  assert.equal((await archiveHistory(f.store).lookup(scope,context)).state,"found");
  assert.equal((await f.service.lookup({...scope,actorId:"another-actor"},context)).state,"unknown");
  assert.equal((await f.service.lookup(scope,{...context,company:"Unlinked Synthetic"})).state,"unknown");
  f.root.permission="denied";assert.equal((await f.service.lookup(scope,context)).state,"permission_required");f.root.permission="granted";
  f.pkg.put("Resume.pdf","Changed bytes");assert.equal((await f.service.lookup(scope,context)).state,"unknown");
  f.company.put("archive-index.json","{bad json");assert.equal((await f.service.lookup(scope,context)).state,"unknown");
  f.company.files.delete("archive-index.json");assert.equal((await f.service.lookup(scope,context)).state,"unknown");
  for(const name of ["..","/absolute","C:\\escape","CON","a/../b","trailing."])assert.equal(safeSegment(name),false);
});
test("company-scoped repair rebuilds only verified packages; unreadable entries preserve the previous index",async t=>{
  const f=await fixture();const descriptor=Object.getOwnPropertyDescriptor(globalThis,"navigator");Object.defineProperty(globalThis,"navigator",{configurable:true,value:{locks:{request:async(_key:string,work:()=>Promise<unknown>)=>work()}}});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,"navigator",descriptor);});
  f.company.put("archive-index.json","damaged");const repaired=await f.service.repair(scope,context);assert.equal(repaired.written,true);assert.equal((await f.service.lookup(scope,context)).state,"found");assert.equal(f.company.enumerations,1);assert.equal(f.root.enumerations+f.candidate.enumerations,0);
  const previous=f.company.files.get("archive-index.json")!.slice();f.company.add("Unreadable Synthetic Package");const failed=await f.service.repair(scope,context);assert.equal(failed.written,false);assert.equal(failed.failures.length,1);assert.deepEqual(f.company.files.get("archive-index.json"),previous);
  const other=await fixture();other.manifest.packageComplete=false;other.pkg.put("metadata.json",other.manifest);assert.equal((await other.service.lookup(scope,context)).state,"unknown");
  const empty=await fixture();empty.company.children.clear();empty.company.put("archive-index.json",buildArchiveIndex(scope,(await identifyJob(context)).companyKey,[]));assert.equal((await empty.service.lookup(scope,context)).state,"not_found");
});
test("shortcut and menu use the same bounded credential-free capture workflow; restricted pages require manual review",async t=>{
  const factory=new IDBFactory();Object.defineProperty(globalThis,"indexedDB",{configurable:true,value:factory});let fail=false;const opened:string[]=[];let invoked:unknown;
  const chromeMock={storage:{session:{get:async()=>({[ACTIVE_CAPTURE_SCOPE]:scope})}},scripting:{executeScript:async(request:{func:unknown})=>{invoked=request.func;if(fail)throw Error("Restricted page");return [{result:{company:"Synthetic selected",url:"https://jobs.example.invalid/jobs/123?access_token=do-not-persist",pageTitle:"Synthetic title",description:"Synthetic JD",descriptionTruncated:false}}];}},runtime:{getURL:(path:string)=>"chrome-extension://synthetic/"+path},tabs:{create:async({url}:{url:string})=>{opened.push(url);}}};
  Object.defineProperty(globalThis,"chrome",{configurable:true,value:chromeMock});t.after(()=>{Reflect.deleteProperty(globalThis,"chrome");Reflect.deleteProperty(globalThis,"indexedDB");});
  const a=await captureContext("shortcut",{id:1} as chrome.tabs.Tab);const b=await captureContext("context_menu",{id:1} as chrome.tabs.Tab,"Menu synthetic company");
  assert.equal(invoked,extractPageContext);assert.equal(a.company,"Synthetic selected");assert.equal(b.company,"Menu synthetic company");assert.equal(a.actorId,scope.actorId);assert.ok(!a.url.includes("token"));assert.ok(!JSON.stringify(await localStore().get("quick-capture:"+a.id)).includes("do-not-persist"));assert.equal(opened.length,2);
  fail=true;const restricted=await captureContext("shortcut",{id:2,url:"chrome://settings"} as chrome.tabs.Tab);assert.equal(restricted.captureState,"unavailable");assert.equal(restricted.url,"");assert.ok(restricted.warnings.length);
  let shortcutHook:(command:string,tab:chrome.tabs.Tab)=>void=()=>{},menuHook:(info:chrome.contextMenus.OnClickData,tab:chrome.tabs.Tab)=>void=()=>{};
  Object.assign(chromeMock,{commands:{onCommand:{addListener:(fn:typeof shortcutHook)=>{shortcutHook=fn;}}},contextMenus:{onClicked:{addListener:(fn:typeof menuHook)=>{menuHook=fn;}}},action:{onClicked:{addListener:()=>{}}},downloads:{onChanged:{addListener:()=>{}}}});
  Object.assign(chromeMock.runtime,{onInstalled:{addListener:()=>{}}});await import("../src/service-worker");fail=false;
  shortcutHook("check-application-history",{id:1} as chrome.tabs.Tab);menuHook({menuItemId:"check-application-history",selectionText:"Router menu company",frameId:0} as chrome.contextMenus.OnClickData,{id:1} as chrome.tabs.Tab);
  for(let i=0;i<40&&opened.length<5;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(opened.length,5);const captures=await localStore().entries<{company:string}>("quick-capture:");assert.ok(captures.some(row=>row.company==="Router menu company"));
});
