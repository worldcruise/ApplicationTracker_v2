import type { CandidateProfile,CoverLetterRequest,FrozenTemplate,PromptAssembly,ResumeOutcomes,ResumeReviewInput,ResumeSourceRequest,ResumeStep } from "@candidate/contracts";
import { sha256,type AtsRender } from "@candidate/resume-engine";
import { localStore } from "./local-store";
export interface ExtensionDraft {rawJson:string;letterText:string;bidId:string;job:PromptAssembly["job"];templateId:string;assembly:PromptAssembly|null;review:ResumeReviewInput|null;letterReview:ResumeReviewInput;resumeOperationId:string|null;letterOperationId:string|null}
export interface ExtensionOperation {
 id:string;actorId:string;organizationId:string;candidateId:string;deviceId:string;kind:"resume"|"cover_letter";createdAt:string;inputHash:string;
 input:{snapshot:CandidateProfile;assembly:PromptAssembly|null;template:FrozenTemplate;rawJson:string;bodyText:string;bidId:string|null;review:ResumeReviewInput};
 payload:ResumeSourceRequest|CoverLetterRequest|null;pdf:AtsRender|null;sourceId:string|null;outcomes:ResumeOutcomes;
 downloadId:number|null;filename:string|null;
}
export const draftKey=(actor:string,org:string,candidate:string)=>`production-draft:${actor}:${org}:${candidate}`;
export const operationKey=(id:string)=>"production-op:"+id;
export const initialOutcomes=():ResumeOutcomes=>Object.fromEntries(["validation","pdfGeneration","localExport","databaseSync","clipboard"].map(k=>[k,{state:"idle",attempts:0,error:null,updatedAt:null}])) as unknown as ResumeOutcomes;
export function operationJournal(factory:IDBFactory=indexedDB){
 const store=localStore(factory);
 async function identity(op:ExtensionOperation|undefined,actor:string,org:string){if(!op||op.actorId!==actor||op.organizationId!==org)throw Error("Queued work belongs to another account or organization. It was not replayed.");if(await sha256(new TextEncoder().encode(JSON.stringify(op.input)))!==op.inputHash)throw Error("Frozen operation input failed its integrity check.");if(op.pdf&&await sha256(op.pdf.bytes)!==op.pdf.sha256)throw Error("Frozen PDF integrity check failed.");return op;}
 return {
  async create(value:Omit<ExtensionOperation,"id"|"createdAt"|"inputHash"|"payload"|"pdf"|"sourceId"|"outcomes"|"downloadId"|"filename"|"deviceId">){
   let device=await store.get<string>("production-device");if(!device){try{device=crypto.randomUUID();await store.add("production-device",device);}catch{device=await store.get<string>("production-device");}}if(!device)throw Error("Local device identity could not be saved.");
   const op:ExtensionOperation={...structuredClone(value),id:crypto.randomUUID(),createdAt:new Date().toISOString(),inputHash:await sha256(new TextEncoder().encode(JSON.stringify(value.input))),payload:null,pdf:null,sourceId:null,outcomes:initialOutcomes(),downloadId:null,filename:null,deviceId:device};
   await store.add(operationKey(op.id),op);return op;
  },
  async get(id:string,actor:string,org:string){return identity(await store.get<ExtensionOperation>(operationKey(id)),actor,org);},
  async list(actor:string,org:string){return (await store.entries<ExtensionOperation>("production-op:")).filter(op=>op.actorId===actor&&op.organizationId===org);},
  async stage(id:string,step:ResumeStep,state:ResumeOutcomes[ResumeStep]["state"],error:string|null=null){
   return store.change<ExtensionOperation>(operationKey(id),op=>{if(!op)throw Error("Operation journal is missing.");const previous=op.outcomes[step];return {...op,outcomes:{...op.outcomes,[step]:{state,attempts:previous.attempts+(state==="pending"?1:0),error,updatedAt:new Date().toISOString()}}};});
  },
  async pdf(id:string,pdf:AtsRender){if(await sha256(pdf.bytes)!==pdf.sha256)throw Error("PDF hash mismatch.");return store.change<ExtensionOperation>(operationKey(id),op=>{if(!op||op.pdf&&op.pdf.sha256!==pdf.sha256)throw Error("Frozen PDF cannot be replaced.");return {...op,pdf};});},
  async payload(id:string,payload:ResumeSourceRequest|CoverLetterRequest){return store.change<ExtensionOperation>(operationKey(id),op=>{if(!op||payload.operationId!==id||op.payload&&JSON.stringify(op.payload)!==JSON.stringify(payload))throw Error("Frozen synchronization payload cannot change.");return {...op,payload};});},
  async source(id:string,sourceId:string){return store.change<ExtensionOperation>(operationKey(id),op=>{if(!op||op.sourceId&&op.sourceId!==sourceId)throw Error("Immutable result cannot change.");return {...op,sourceId};});},
  async download(id:string,downloadId:number|null,filename:string){return store.change<ExtensionOperation>(operationKey(id),op=>{if(!op||op.filename&&op.filename!==filename)throw Error("Export filename cannot change.");return {...op,downloadId,filename};});},
 };
}
export async function operationLock<T>(id:string,work:()=>Promise<T>){if(!navigator.locks)throw Error("Web Locks are unavailable; safe concurrent operations are unsupported.");return navigator.locks.request("candidate-production:"+id,work);}
