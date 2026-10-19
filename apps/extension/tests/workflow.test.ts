import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import type { CandidateProfile,FrozenTemplate,ResumeSourceRequest } from "@candidate/contracts";
import { operationJournal } from "../src/journal";
import { extensionApi,ExtensionApiError } from "../src/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import {localStore} from "../src/local-store";
import {settleDownload} from "../src/download-events";
test("production journals survive closure, partition actors, preserve frozen input and merge independent outcomes",async()=>{
 const factory=new IDBFactory();const journal=operationJournal(factory);
 const op=await journal.create({actorId:"synthetic-actor",organizationId:"synthetic-org",candidateId:"synthetic-candidate",kind:"resume",input:{snapshot:{} as CandidateProfile,template:{} as FrozenTemplate,assembly:null,rawJson:'{"invalid":',bodyText:"",bidId:null,review:{experienceIds:[],educationIds:[],claims:{}}}});
 const reopened=operationJournal(factory);assert.equal((await reopened.get(op.id,op.actorId,op.organizationId)).input.rawJson,'{"invalid":');
 await assert.rejects(reopened.get(op.id,"other-actor",op.organizationId),/another account/);assert.deepEqual(await reopened.list("other-actor",op.organizationId),[]);
 const payload={operationId:op.id,assemblyId:"synthetic",schemaVersion:1,rawJson:op.input.rawJson,review:op.input.review,render:null} as ResumeSourceRequest;
 await journal.payload(op.id,payload);await assert.rejects(journal.payload(op.id,{...payload,rawJson:"{}"}),/cannot change/);
 await Promise.all([journal.stage(op.id,"localExport","succeeded"),reopened.stage(op.id,"databaseSync","unknown")]);
 const saved=await reopened.get(op.id,op.actorId,op.organizationId);assert.equal(saved.outcomes.localExport.state,"succeeded");assert.equal(saved.outcomes.databaseSync.state,"unknown");
});
test("shared API checks identity/current membership before writes and never retries a write or another actor",async t=>{
 let calls=0,writes=0,member=true;const user={id:"synthetic-actor"};
 const client={auth:{getSession:async()=>({data:{session:{access_token:"synthetic-token",user}},error:null}),getUser:async()=>({data:{user},error:null})}} as unknown as SupabaseClient;
 t.mock.method(globalThis,"fetch",async(input:RequestInfo|URL,init?:RequestInit)=>{calls++;assert.equal(init?.credentials,"omit");assert.equal(new Headers(init?.headers).get("x-operation-actor"),user.id);if(String(input).endsWith("/me"))return Response.json({data:{userId:user.id,organizations:member?[{organizationId:"synthetic-org"}]:[]}});writes++;return Response.json({error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic unavailable",fieldErrors:[]}},{status:503});});
 const api=extensionApi(client,{apiUrl:"https://example.invalid/api/v1",supabaseUrl:"https://synthetic.supabase.co",publishableKey:"sb_publishable_synthetic"},async(_n,work)=>work());
 await assert.rejects(api.request("resume-versions",{actorId:"other",organizationId:"synthetic-org",body:{}}),/another account/);assert.equal(calls,0);
 await assert.rejects(api.request("resume-versions",{actorId:user.id,organizationId:"synthetic-org",body:{}}),ExtensionApiError);assert.equal(writes,1);
 member=false;await assert.rejects(api.request("resume-versions",{actorId:user.id,organizationId:"synthetic-org",body:{}}),/active organization/);assert.equal(writes,1);
 await assert.rejects(api.withActor("other-actor",async()=>{writes++;}),/account changed/);assert.equal(writes,1);
});
test("download events survive page closure and cannot overwrite another download's result",async()=>{
 const store=localStore(new IDBFactory());await store.put("production-op:synthetic",{downloadId:2,outcomes:{localExport:{state:"pending",attempts:1,error:null}}});
 await store.put("production-download:1",{operationId:"synthetic"});await store.put("production-download:2",{operationId:"synthetic"});
 await settleDownload(1,"interrupted","SYNTHETIC_ERROR",store);
 assert.equal((await store.get<{outcomes:{localExport:{state:string}}}>("production-op:synthetic"))!.outcomes.localExport.state,"pending");
 await settleDownload(2,"complete",undefined,store);
 assert.equal((await store.get<{outcomes:{localExport:{state:string}}}>("production-op:synthetic"))!.outcomes.localExport.state,"succeeded");
});
