import {randomUUID} from "node:crypto";
import {identifyJob,packagePaths} from "@candidate/domain";
export async function testArchiveHTTP({call,command,identities,org,team,assert}){
 const a=identities.adminA,m=identities.memberA,b=identities.bidderA,l=identities.leaderA,url=p=>p+"?organizationId="+org;
 const profile={fullName:"Synthetic Archive Avery",email:"archive@example.invalid",phone:"+1 202 555 0175",location:"Synthetic City",seniorityPreference:null,professionalSummary:"Built synthetic tools.",privateNotes:"PRIVATE ARCHIVE PROFILE",status:"ready",links:[],experiences:[],educations:[],certifications:[]};
 const created=await call(a,url("/candidates"),{teamId:team,ownerId:null,profile});assert(created.status===200,"Archive fixture persists");const candidate=created.data.id;
 assert((await call(l,url("/candidates/"+candidate+"/assignments"),{userId:m.id,assign:true},1)).status===200,"Archive member assigned");
 const job={company:"Synthetic Archive Company",title:"Engineer",url:"https://jobs.example.invalid/jobs/archive-1",description:"Synthetic archive opportunity",externalId:"archive-1"};
 const assembly=await call(m,url("/prompt-assemblies"),{candidateId:candidate,profileRevision:2,job:{company:job.company,title:job.title,description:job.description}});assert(assembly.status===200,"Archive assembly freezes facts");
 const review={experienceIds:[],educationIds:[],claims:{}},renderedAt="2026-10-20T12:00:00.000Z";
 async function document(extra={}){
  const rawJson=" \n"+JSON.stringify({company:job.company,title:job.title,summary:profile.professionalSummary,skills:[],experience:[],education:[],...extra},null,2)+"\n";
  const rendered=await call(m,url("/resume-renders"),{assemblyId:assembly.data.id,rawJson,review,renderedAt});assert(rendered.status===200,"Archive PDF renders");
  const payload={operationId:randomUUID(),assemblyId:assembly.data.id,schemaVersion:1,rawJson,review,render:{sha256:rendered.data.sha256,pageCount:rendered.data.pageCount,rendererVersion:rendered.data.rendererVersion,renderedAt}};
  const source=await call(m,url("/resume-versions"),payload,undefined,{"Idempotency-Key":payload.operationId});assert(source.status===200,"Archive original source persists");
  const doc=await call(m,url("/documents"),{kind:"resume",sourceVersionId:source.data.id});assert(doc.status===200,"Archive frozen PDF stores");return {rawJson,doc:doc.data,operationId:payload.operationId};
 }
 const frozen=await document(),unsafe=await document({privateUnsupported:"PRIVATE UNRENDERED VALUE"});
 const exported=await call(m,url("/documents/"+frozen.doc.id+"/archive-source"));assert(exported.status===200&&exported.data.rawJson===frozen.rawJson,"Authorized original JSON preserves whitespace");const bundle=exported.data;
 async function input(context=job){const id=randomUUID(),createdAt=renderedAt;return {version:1,operationId:id,actorId:m.id,organizationId:org,candidateId:candidate,deviceId:randomUUID(),createdAt,candidateName:profile.fullName,context,identifiers:await identifyJob(context),relativePath:await packagePaths(profile.fullName,candidate,context,id,createdAt),resume:{reference:{kind:"document",documentId:frozen.doc.id},rawJson:frozen.rawJson,pdfSha256:bundle.pdfSha256,pageCount:bundle.pageCount,schemaVersion:1,profileRevision:2,template:bundle.template,rendererVersion:bundle.render.rendererVersion,renderedAt:bundle.render.renderedAt},coverLetter:null,existingBidId:null};}
 const save=(who,value)=>call(who,url("/archive-packages"),value,undefined,{"Idempotency-Key":value.operationId});
 const first=await input(),second=await input();const results=await Promise.all([save(m,first),save(m,second)]);
 for(const result of results)assert(result.status===200,`Concurrent archive save succeeds (${result.status}/${result.code??"OK"})`);
 const receipt=results[0].data;assert(receipt.bidId===results[1].data.bidId,"Concurrent distinct operations reuse one strong matching bid");
 assert(results.filter(x=>x.data.reusedBid).length===1,"Exactly one concurrent operation creates the draft");
 const repeated=await Promise.all([save(m,first),save(m,first)]);assert(repeated.every(r=>r.status===200&&JSON.stringify(r.data)===JSON.stringify(receipt)),"Repeated click or lost-response replay returns the same receipt");
 const status=await call(m,url("/archive-packages")+"&operationId="+first.operationId);assert(JSON.stringify(status.data)===JSON.stringify(receipt),"Original receipt survives a lost API response");
 const bid=await call(m,url("/bids/"+receipt.bidId));assert(bid.data.bid.status==="draft"&&bid.data.submissions.length===0&&!bid.data.bid.submittedAt,"Archive save never submits an application");
 assert((await save(m,{...first,candidateName:"Changed frozen value"})).code==="KEY_PAYLOAD_MISMATCH","Changed frozen input cannot reuse the operation key");
 assert((await save(identities.memberB,first)).status===403,"Another account cannot replay this package");
 assert((await call(identities.leaderBeta,url("/documents/"+frozen.doc.id+"/archive-source"))).status===403,"Other team cannot export archive source");
 const forged=await m.client.rpc("save_archive_package",{p_envelope:JSON.stringify({input:first}),p_key_id:"primary",p_signature:"00".repeat(32),p_request:randomUUID()});assert(!!forged.error,"Direct forged synchronization cannot bypass API validation");
 const mutation=await m.client.from("archive_operations").insert({organization_id:org,operation_id:randomUUID()});assert(!!mutation.error,"Archive ledger has no direct user mutation grant");
 for(const doc of [frozen.doc,unsafe.doc])assert((await call(a,url("/documents/"+doc.id+"/links"),{bidId:receipt.bidId})).status===200,"Manager links prepared artifact");
 const grant=await command(a,org,{command:"grantBidderAccess",userId:b.id,candidateId:candidate,bidId:null,capability:"document.export",allowEmail:false,allowPhone:false,expiresAt:null});
 const safe=await call(b,url("/documents/"+frozen.doc.id+"/archive-source"));assert(safe.status===200&&safe.data.rawJson===frozen.rawJson,"Export-only bidder receives only the exact rendered original source");
 assert(!JSON.stringify(safe.data).includes("PRIVATE ARCHIVE PROFILE")&&!JSON.stringify(safe.data).includes("snapshot"),"Prepared source projection excludes unrestricted profile snapshots");
 assert((await call(b,url("/documents/"+unsafe.doc.id+"/archive-source"))).status===403,"Bidder cannot receive unrendered unsupported JSON fields");
 assert((await b.client.from("resume_versions").select("raw_json")).data?.length===0,"Prepared export grants no source-table read access");
 const bidderInput=await input();bidderInput.actorId=b.id;bidderInput.existingBidId=receipt.bidId;
 const bidderSaved=await save(b,bidderInput);assert(bidderSaved.status===200&&bidderSaved.data.bidId===receipt.bidId,"Export-only bidder archives an existing frozen version without editing bid content");
 assert((await call(m,url("/bids/"+receipt.bidId))).data.bid.rowVersion===bid.data.bid.rowVersion,"Export-only package does not change selected documents, approval or bid version");
 const noTarget={...await input(),actorId:b.id};assert((await save(b,noTarget)).status===403,"Export permission cannot create a new opportunity");
 await command(a,org,{command:"revokeBidderAccess",grantId:grant.id});
 assert((await call(b,url("/archive-packages")+"&operationId="+bidderInput.operationId)).status===403,"Current export revocation blocks receipt reconciliation");
 const otherJob={...job,url:"https://jobs.example.invalid/jobs/archive-2",externalId:"archive-2"};const other=await save(m,await input(otherJob));assert(other.status===200&&other.data.bidId!==receipt.bidId,"Fingerprint alone does not merge separate opportunities");
 return {candidate,job,first,receipt,source:frozen,bundle};
}
