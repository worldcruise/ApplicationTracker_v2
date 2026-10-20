import "server-only";
import {createHash,createHmac} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {FrozenPackageInput,HistoryRecord,PackageReference,PackageSyncResult} from "@candidate/contracts";
import {validateResume,validTemplateLayout} from "@candidate/contracts";
import {classifyHistory,identifyJob,normalizedText,validateHistoryContext} from "@candidate/domain";
import {ApiFailure,databaseResult} from "@/lib/api/errors";
import {uuid} from "@/lib/api/guards";
import {strictObject} from "@/lib/candidates/input";
export interface ArchiveSource {documentId:string;candidateId:string;profileRevision:number;kind:"resume"|"cover_letter";sourceId:string;rawJson?:string;text?:string;pdfSha256:string;pageCount:number;template:FrozenPackageInput["resume"]["template"];render:{rendererVersion:string;renderedAt:string};bidIds:string[]}
async function phase<T>(name:string,work:Promise<T>){try{return await work;}catch(error){if(error instanceof ApiFailure&&error.status===403)throw new ApiFailure(403,"FORBIDDEN",name+": current resource permissions are required.");throw error;}}
export function packageInput(value:unknown,actor:string,org:string):FrozenPackageInput {
 const b=strictObject(value,["version","operationId","actorId","organizationId","candidateId","deviceId","createdAt","candidateName","context","identifiers","relativePath","resume","coverLetter","existingBidId"]);
 for(const key of ["operationId","actorId","organizationId","candidateId","deviceId"])uuid(b[key]);if(b.existingBidId!==null)uuid(b.existingBidId);
 if(b.version!==1||b.actorId!==actor||b.organizationId!==org)throw new ApiFailure(403,"FORBIDDEN","Use the original actor and organization for this frozen operation.");
 if(typeof b.createdAt!=="string"||b.createdAt.length>30||!Number.isFinite(Date.parse(b.createdAt)))throw new ApiFailure(422,"SCHEMA_INVALID","Supply the frozen creation time.");
 if(typeof b.candidateName!=="string"||b.candidateName.length>200||/[\u0000-\u001f]/u.test(b.candidateName))throw new ApiFailure(422,"SCHEMA_INVALID","Invalid candidate display name.");
 if(!Array.isArray(b.relativePath)||b.relativePath.length!==3||b.relativePath.some(x=>typeof x!=="string"||x.length>120||!x||/^[. ]|[. ]$|[\u0000-\u001f<>:"/\\|?*]/u.test(x)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(x))||b.relativePath.join("/").length>240)throw new ApiFailure(422,"SCHEMA_INVALID","Invalid relative archive path.");
 const r=strictObject(b.resume,["reference","rawJson","pdfSha256","pageCount","schemaVersion","profileRevision","template","rendererVersion","renderedAt"]);
 const t=strictObject(r.template,["id","name","version","layout","layoutHash","assetHashes","rendererVersion"]);uuid(t.id);
 if(!validTemplateLayout(t.layout)||typeof t.name!=="string"||t.name.length>200||!Number.isInteger(t.version)||Number(t.version)<1||typeof t.layoutHash!=="string"||!/^[0-9a-f]{64}$/.test(t.layoutHash)||!t.assetHashes||typeof t.assetHashes!=="object"||Array.isArray(t.assetHashes)||Object.values(t.assetHashes).some(v=>typeof v!=="string"||!/^[0-9a-f]{64}$/.test(v))||!Number.isInteger(r.profileRevision)||Number(r.profileRevision)<1||typeof r.rendererVersion!=="string"||typeof r.renderedAt!=="string")throw new ApiFailure(422,"SCHEMA_INVALID","Use the recorded frozen template, assets, renderer and profile revision.");
 const ref=(v:unknown)=>{const kind=(v&&typeof v==="object"&&!Array.isArray(v))?(v as Record<string,unknown>).kind:undefined;const p=strictObject(v,kind==="operation"?["kind","operationId"]:["kind","documentId"]);if(p.kind==="operation"&&Object.keys(p).length===2)uuid(p.operationId);else if(p.kind==="document"&&Object.keys(p).length===2)uuid(p.documentId);else throw new ApiFailure(422,"SCHEMA_INVALID","Choose a frozen source operation or authorized document.");};ref(r.reference);
 if(typeof r.rawJson!=="string"||Buffer.byteLength(r.rawJson)>1048576||!validateResume(r.rawJson).content||r.schemaVersion!==1||typeof r.pdfSha256!=="string"||!/^[0-9a-f]{64}$/.test(r.pdfSha256)||!Number.isInteger(r.pageCount)||Number(r.pageCount)<1)throw new ApiFailure(422,"SCHEMA_INVALID","Supply valid original schema-v1 JSON and a recorded PDF hash.");
 if(b.coverLetter!==null){const l=strictObject(b.coverLetter,["reference","text"]);ref(l.reference);if(typeof l.text!=="string"||Buffer.byteLength(l.text)>204800)throw new ApiFailure(422,"SCHEMA_INVALID","Use frozen cover letter text up to 200 KiB.");}
 try {validateHistoryContext(b.context);}catch(e){throw new ApiFailure(422,"SCHEMA_INVALID",e instanceof Error?e.message:"Invalid job context.");}
 if(!(b.context as FrozenPackageInput["context"]).title.trim())throw new ApiFailure(422,"SCHEMA_INVALID","Review the job title before saving a package.");
 return b as unknown as FrozenPackageInput;
}
async function source(client:SupabaseClient,org:string,candidate:string,actor:string,ref:PackageReference,kind:"resume"|"cover_letter"){
 let doc:string;
 if(ref.kind==="document")doc=ref.documentId;
 else {
  const version=await databaseResult<{id:string}|null>(client.from(kind==="resume"?"resume_versions":"cover_letter_versions").select("id").eq("organization_id",org).eq("candidate_id",candidate).eq("created_by",actor).eq("operation_id",ref.operationId).maybeSingle());
  if(!version)throw new ApiFailure(409,"VERSION_CONFLICT","Synchronize the original frozen source and exact PDF before retrying this same package.");
  const d=await databaseResult<{id:string}|null>(client.from("documents").select("id").eq("organization_id",org).eq(kind==="resume"?"resume_version_id":"cover_letter_version_id",version.id).maybeSingle());
  if(!d)throw new ApiFailure(409,"VERSION_CONFLICT","Store the frozen PDF before retrying this same package.");doc=d.id;
 }
 const result=await databaseResult<ArchiveSource>(client.rpc("export_archive_source",{p_org:org,p_document:doc}));
 if(result.candidateId!==candidate||result.kind!==kind)throw new ApiFailure(403,"FORBIDDEN","The frozen document does not belong to this candidate and document type.");return result;
}
export async function savePackage(client:SupabaseClient,input:FrozenPackageInput,requestId:string):Promise<PackageSyncResult>{
 const org=input.organizationId,actor=input.actorId;
 const key=process.env.DOCUMENT_RENDER_SIGNING_KEY,keyId=process.env.DOCUMENT_RENDER_KEY_ID??"primary";
 if(!key||!/^[0-9a-f]{64}$/.test(key))throw new ApiFailure(503,"SERVICE_UNAVAILABLE","Database package synchronization requires the document signing key and matching database registration. Local files are independent.");
 if(!isDeepStrictEqual(await identifyJob(input.context),input.identifiers))throw new ApiFailure(422,"SCHEMA_INVALID","Frozen job identifiers do not match the reviewed input.");
 const r=await phase("Frozen resume export",source(client,org,input.candidateId,actor,input.resume.reference,"resume"));
 if(r.rawJson!==input.resume.rawJson||r.pdfSha256!==input.resume.pdfSha256||r.pageCount!==input.resume.pageCount||r.profileRevision!==input.resume.profileRevision||!isDeepStrictEqual(r.template,input.resume.template)||r.render.rendererVersion!==input.resume.rendererVersion||r.render.renderedAt!==input.resume.renderedAt)throw new ApiFailure(409,"VERSION_CONFLICT","Frozen source, template or PDF differs from this package. No replacement was substituted.");
 const content=validateResume(r.rawJson!).content!;if(content.company.trim()&&normalizedText(content.company)!==normalizedText(input.context.company))throw new ApiFailure(422,"SCHEMA_INVALID","The frozen resume targets a different company.");
 const l=input.coverLetter?await source(client,org,input.candidateId,actor,input.coverLetter.reference,"cover_letter"):null;
 if(l&&l.text!==input.coverLetter!.text)throw new ApiFailure(409,"VERSION_CONFLICT","Frozen cover letter text differs from this package.");
 const requestHash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
 // Checking a receipt never changes a key or silently adopts another actor's result.
 const previous=await phase("Package receipt",databaseResult<PackageSyncResult|null>(client.rpc("archive_operation_result",{p_org:org,p_operation:input.operationId})));
 // A replay still passes through the command's immutable request-hash comparison below.
 let exactBidIds:string[]=[],historyToken:string|null=null;
 if(input.existingBidId){
  const job=await databaseResult<({candidateId:string}&FrozenPackageInput["context"])|null>(client.rpc("archive_bid_job",{p_org:org,p_bid:input.existingBidId,p_document:r.documentId}));
  if(!job||job.candidateId!==input.candidateId)throw new ApiFailure(403,"FORBIDDEN","This existing bid is unavailable for archive saving.");
  const ids=await identifyJob({company:job.company,title:job.title,url:job.url,description:job.description,externalId:job.externalId});
  // An explicit selection may identify a URL-less job; it still must match the reviewed job facts.
  if(!previous&&(ids.companyKey!==input.identifiers.companyKey||ids.titleKey!==input.identifiers.titleKey||ids.canonicalUrl!==input.identifiers.canonicalUrl||ids.descriptionHash!==input.identifiers.descriptionHash))throw new ApiFailure(409,"DUPLICATE_JOB","The selected bid has different job details. Correct the draft and freeze a new package.");
 }
 for(let attempt=0;attempt<3;attempt++){
  if(!input.existingBidId&&!previous){
   const history=await phase("Duplicate history",databaseResult<{rows:HistoryRecord[];truncated:boolean;token:string;historyVersion:number;companyKey:string}>(client.rpc("archive_history_snapshot",{p_org:org,p_candidate:input.candidateId,p_company:input.context.company})));
   if(history.truncated||history.historyVersion!==2||history.companyKey!==input.identifiers.companyKey)throw new ApiFailure(409,"DUPLICATE_JOB","History is incomplete or normalization differs. Review existing bids and explicitly select the intended opportunity.");
   exactBidIds=[...new Set((await classifyHistory(input.context,history.rows)).exact.map(x=>x.id))];historyToken=history.token;
   if(exactBidIds.length>1)throw new ApiFailure(409,"DUPLICATE_JOB","Multiple exact opportunities exist. Explicitly select the intended bid before freezing a new package.");
  }
  const envelope=JSON.stringify({input,requestHash,resumeDocumentId:r.documentId,letterDocumentId:l?.documentId??null,exactBidIds,historyToken});
  const signature=createHmac("sha256",Buffer.from(key,"hex")).update("archive.v1|"+envelope).digest("hex");
  const response=await client.rpc("save_archive_package",{p_envelope:envelope,p_key_id:keyId,p_signature:signature,p_request:requestId});
  if(response.error?.message==="ARCHIVE_HISTORY_CHANGED"&&attempt<2)continue;
  return phase("Package transaction",databaseResult<PackageSyncResult>(Promise.resolve(response)));
 }
 throw new ApiFailure(409,"VERSION_CONFLICT","History changed repeatedly. Retry the original frozen operation.");
}
