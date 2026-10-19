import { validateResume,type CoverLetterRequest,type CoverLetterVersion,type FrozenDocument,type ResumeSourceRequest,type ResumeSourceVersion } from "@candidate/contracts";
import { reviewResume } from "@candidate/domain";
import { renderAtsClassic,sha256,type AtsRender } from "@candidate/resume-engine";
import { ExtensionApiError,type ExtensionApi } from "./api";
import { operationJournal,operationLock,type ExtensionOperation } from "./journal";
export const letterContent=(text:string)=>({company:"",title:"",summary:text,skills:[],experience:[],education:[]});
export function analyzeOperation(op:ExtensionOperation){
 const validation=validateResume(op.kind==="resume"?op.input.rawJson:JSON.stringify(letterContent(op.input.bodyText)));
 if(!validation.content)throw Error(validation.errors.map(e=>e.path+": "+e.message).join("\n"));
 if(op.kind==="cover_letter"&&(!op.input.bodyText.trim()||new TextEncoder().encode(op.input.bodyText).length>204800))throw Error("Supply cover letter text up to 200 KiB.");
 const review=reviewResume(validation.content,op.input.snapshot,op.input.review);
 if(op.kind==="resume"&&op.input.assembly?.job.company.trim()&&validation.content.company.trim().toLocaleLowerCase("en-US")!==op.input.assembly.job.company.trim().toLocaleLowerCase("en-US"))review.reviewed=false;
 return {validation,review};
}
export async function generateOperation(op:ExtensionOperation):Promise<AtsRender>{
 const journal=operationJournal();if(op.pdf)return op.pdf;if(op.payload)throw Error("This source operation is frozen. Start a new operation for a new PDF.");
 const analysis=analyzeOperation(op);await journal.stage(op.id,"validation","succeeded");await journal.stage(op.id,"pdfGeneration","pending");
 try{
  const asset=async(name:string)=>{const r=await fetch(chrome.runtime.getURL("fonts/"+name));if(!r.ok)throw Error("Bundled font unavailable.");return new Uint8Array(await r.arrayBuffer());};
  const [regular,bold]=await Promise.all([asset("NotoSans-Regular.ttf"),asset("NotoSans-Bold.ttf")]);
  const pdf=await renderAtsClassic({regular,bold},{rawJson:op.kind==="resume"?op.input.rawJson:JSON.stringify(letterContent(op.input.bodyText)),snapshot:op.input.snapshot,mapping:op.input.review,reviewed:analysis.review.reviewed,renderedAt:op.createdAt,templateVersionId:op.input.template.id,template:op.input.template,...(op.kind==="cover_letter"?{letterText:op.input.bodyText}:{})});
  await journal.pdf(op.id,pdf);await journal.stage(op.id,"pdfGeneration","succeeded");return pdf;
 }catch(e){await journal.stage(op.id,"pdfGeneration","failed",e instanceof Error?e.message:"Generation failed; source retained.");throw e;}
}
export async function synchronizeOperation(api:ExtensionApi,id:string,actor:string,org:string){
 return operationLock(id,async()=>{
  const journal=operationJournal();let op=await journal.get(id,actor,org);const query="?organizationId="+org;const resource=op.kind==="resume"?"resume-versions":"cover-letter-versions";
  const options={actorId:actor,organizationId:org};
  await api.request("me",options);
  // Recheck resource access before reconciliation or mutation. Bidders cannot
  // turn an old cached editor operation into a generation capability.
  const context=await api.request<import("@candidate/contracts").UserContext>("me",options);
  if(context.organizations.find(o=>o.organizationId===org)?.role==="bidder")throw Error("Your current role cannot synchronize resume or letter content. Prepared exports remain separate.");
  await api.request(`candidates/${op.candidateId}${query}`,options);
  try{
   if(!op.payload){const analysis=analyzeOperation(op);const render=op.pdf?{sha256:op.pdf.sha256,pageCount:op.pdf.pageCount,rendererVersion:op.pdf.rendererVersion,renderedAt:op.pdf.renderedAt}:null;
    const payload:ResumeSourceRequest|CoverLetterRequest=op.kind==="resume"?{operationId:id,assemblyId:op.input.assembly!.id,schemaVersion:1,rawJson:op.input.rawJson,review:analysis.review.mapping,render}:
     {operationId:id,candidateId:op.candidateId,bidId:op.input.bidId,schemaVersion:1,profileRevision:op.input.snapshot.rowVersion,templateVersionId:op.input.template.id,bodyText:op.input.bodyText,review:analysis.review.mapping,render};
    op=await journal.payload(id,payload);
   }
   await journal.stage(id,"databaseSync","pending");
   if(!op.sourceId){const existing=await api.request<{id:string}[]>(`${resource}${query}&candidateId=${op.candidateId}&operationId=${id}`,options);
    const source=existing[0]??await api.request<ResumeSourceVersion|CoverLetterVersion>(resource+query,{...options,body:op.payload,operationId:id});op=await journal.source(id,source.id);}
   if(op.pdf&&!op.documentId){const document=await api.request<FrozenDocument>("documents"+query,{...options,body:{kind:op.kind,sourceVersionId:op.sourceId}});
    if(document.pdfSha256!==op.pdf.sha256)throw Error("Stored PDF hash does not match the preview. Existing bytes are retained.");op=await journal.document(id,document.id);}
   await journal.stage(id,"databaseSync","succeeded");return journal.get(id,actor,org);
  }catch(e){await journal.stage(id,"databaseSync",e instanceof ExtensionApiError&&e.status>0&&e.status<500?"failed":"unknown",e instanceof Error?e.message:"No confirmed synchronization result.");throw e;}
 });
}
export function exportFilename(op:ExtensionOperation){const safe=(v:string)=>v.normalize("NFKC").replace(/[\u0000-\u001f<>:"/\\|?*]/g,"_").replace(/[. ]+$/g,"").slice(0,40)||"Unknown";return `${op.kind==="resume"?"Resume":"CoverLetter"}_${safe(op.input.snapshot.fullName??"Candidate")}_${safe(op.input.assembly?.job.company??"Letter")}_${op.createdAt.slice(0,10)}__${op.id}.pdf`;}
export async function checkedBytes(op:ExtensionOperation){if(!op.pdf||await sha256(op.pdf.bytes)!==op.pdf.sha256)throw Error("Generate and verify the frozen PDF first.");return op.pdf.bytes.slice();}
