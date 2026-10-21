import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bidStatuses, type Bid, type BidWorkspace, type Interview, type OrganizationScope, type WorkflowAccess } from "@candidate/contracts";
import { validateBidInput, validateBidTransition, validateInterviewInput, WorkflowValidationFailure } from "@candidate/domain";
import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin, expectedVersion, requireRole } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
import { readJson } from "@/lib/api/body";
import { parseWorkflowSearch, SearchInputError } from "./search-input";
export { preflight };
export const bidColumns="id,candidateId:candidate_id,ownerId:owner_id,teamId:team_id,companyName:company_name,jobTitle:job_title,jobDescription:job_description,jobUrl:job_url,externalId:external_id,jobLocation:job_location,priority,followUpAt:follow_up_at,lastContactAt:last_contact_at,notes,outcome,resumeDocumentId:resume_document_id,coverLetterDocumentId:cover_letter_document_id,status,rowVersion:row_version,contentRevision:content_revision,contentHash:content_hash,preparedBy:prepared_by,currentApprovalId:current_approval_id,heldFromStatus:held_from_status,submittedAt:submitted_at,createdBy:created_by,createdAt:created_at,updatedAt:updated_at,resumeVersionId:resume_version_id,coverLetterVersionId:cover_letter_version_id";
export const interviewColumns="id,bidId:bid_id,ownerId:owner_id,roundNumber:round_number,type,interviewer,localDateTime:local_datetime,timezone,offset:chosen_offset,scheduledAt:scheduled_at,durationMinutes:duration_minutes,location,meetingUrl:meeting_url,lifecycle:lifecycle_status,outcome,nextAction:next_action,followUpAt:follow_up_at,rowVersion:row_version,createdAt:created_at,updatedAt:updated_at,previousRoundId:previous_round_id";
const taskColumns="id,bidId:bid_id,interviewId:interview_id,assigneeId:assignee_id,title,dueAt:due_at,state,completedAt:completed_at,rowVersion:row_version";
export async function getBid(client: SupabaseClient, scope: OrganizationScope,id:string) {
 const row=await databaseResult<Bid|null>(client.from("bids").select(bidColumns).eq("organization_id",scope.organizationId).eq("id",id).maybeSingle());
 if(!row)throw new ApiFailure(403,"FORBIDDEN","This bid is unavailable in your current scope.");return row;
}
export async function getInterview(client:SupabaseClient,scope:OrganizationScope,id:string) {
 requireRole(scope,["admin","team_leader","team_member"]);
 const row=await databaseResult<Interview|null>(client.from("interviews").select(interviewColumns).eq("organization_id",scope.organizationId).eq("id",id).maybeSingle());
 if(!row)throw new ApiFailure(403,"FORBIDDEN","This interview is unavailable in your current scope.");return row;
}
export async function bidWorkspace(client:SupabaseClient,scope:OrganizationScope,id:string):Promise<BidWorkspace> {
 const bid=await getBid(client,scope,id);
 const access=await databaseResult<WorkflowAccess>(client.rpc("get_bid_workflow_access",{p_org:scope.organizationId,p_bid:id}));
 const tables=["bid_status_history","bid_approvals","bid_approval_invalidations","bid_submissions","bid_revisions"];
 const values=await Promise.all(tables.map(t=>databaseResult<Record<string,unknown>[]>(client.from(t).select("*").eq("organization_id",scope.organizationId).eq("bid_id",id).order("created_at",{ascending:false}).limit(200))));
 return {bid,access,history:values[0]!,approvals:values[1]!,invalidations:values[2]!,submissions:values[3]!,revisions:values[4]!};
}
function operation(request:Request,value:unknown) {
 const id=uuid(value,"operationId");if(request.headers.get("idempotency-key")!==id)throw new ApiFailure(400,"SCHEMA_INVALID","Idempotency-Key must match the frozen operationId.");return id;
}
function text(value:unknown,max:number,required=false) {
 if(typeof value!=="string" || value.length>max || (required&&!value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new ApiFailure(422,"SCHEMA_INVALID","Supply valid plain text.");return value;
}
export function workflow(request:Request,resource:string,parts:string[]) {
 return api(request,async requestId=>{
  const {client,context,token}=await requestContext(request);const q=new URL(request.url).searchParams;const scope=currentOrganization(context,uuid(q.get("organizationId")));const org=scope.organizationId;
  const read=request.method==="GET";if(!read)checkMutationOrigin(request,token);
  const id=parts[0] ? uuid(parts[0]):null;const action=parts[1];if(parts.length>2)throw new ApiFailure(404,"FORBIDDEN","Unknown workflow resource.");
  try {
   if(read && !id && q.get("search")==="true" && (resource==="bids" || resource==="interviews")) {
    if(resource==="interviews")requireRole(scope,["admin","team_leader","team_member"]);
    const filters=parseWorkflowSearch(q,resource);
    const result=await databaseResult<{items:{record:Record<string,unknown>}[]}>(client.rpc("search_workflow",{p_org:org,p_kind:resource,p_filters:filters}));
    const columns=(resource==="bids"?bidColumns:interviewColumns).split(",").map(value=>{const [alias,column]=value.split(":");return [alias!,column??alias!] as const;});
    return {...result,items:result.items.map(item=>({...item,record:Object.fromEntries(columns.map(([alias,column])=>[alias,item.record[column]]))}))};
   }
   if(resource==="bids") {
    if(read && !id) {
     const page=Number(q.get("page")??1);if(!Number.isInteger(page)||page<1||page>100000)throw new ApiFailure(400,"SCHEMA_INVALID","Invalid page.");
     const query=client.from("bids").select(bidColumns,{count:"exact"}).eq("organization_id",org).order("updated_at",{ascending:false}).range((page-1)*25,page*25-1);
     for(const [key,col] of [["candidateId","candidate_id"],["teamId","team_id"],["ownerId","owner_id"]])if(q.get(key!))query.eq(col!,uuid(q.get(key!)));
     if(q.get("status")){if(!bidStatuses.includes(q.get("status") as typeof bidStatuses[number]))throw new ApiFailure(400,"SCHEMA_INVALID","Invalid status.");query.eq("status",q.get("status"));}
     if(q.get("priority")){if(!["low","normal","high","urgent"].includes(q.get("priority")!))throw new ApiFailure(400,"SCHEMA_INVALID","Invalid priority.");query.eq("priority",q.get("priority"));}
     const search=(q.get("q")??"").trim();if(search.length>200)throw new ApiFailure(400,"SCHEMA_INVALID","Search is too long.");
     if(search)query.ilike("company_name",`%${search.replace(/[\\%_]/g,"\\$&")}%`);
     const result=await query;if(result.error)await databaseResult(Promise.resolve(result));return {items:result.data,total:result.count,page,pageSize:25};
    }
    if(id && read && !action)return await bidWorkspace(client,scope,id);
    if(request.method==="POST" && id && action==="transitions") {
     const current=await bidWorkspace(client,scope,id);const input=validateBidTransition(await readJson(request));const op=operation(request,input.operationId);
     if(current.bid.status!=="on_hold"&&input.status==="approved" && !current.access.canReview && !(current.access.canOverride && input.adminOverrideReason.trim()))throw new ApiFailure(403,"FORBIDDEN","Independent leader/admin review is required. An administrator self-approval needs an override reason.");
     if(current.bid.status!=="on_hold"&&input.status==="needs_changes"&&!current.access.canAssign)throw new ApiFailure(403,"FORBIDDEN","A current team leader or administrator must request changes.");
     if(input.reopen && !current.access.canOverride)throw new ApiFailure(403,"FORBIDDEN","Only an administrator can reopen terminal bids.");
     if(input.status==="submitted" ? !current.access.canSubmit : !current.access.canTransition && !["approved","needs_changes"].includes(input.status))throw new ApiFailure(403,"FORBIDDEN","This transition is outside your permissions.");
     const {operationId:_,...payload}=input;void _;
     return await databaseResult(client.rpc("transition_bid",{p_org:org,p_bid:id,p_expected:expectedVersion(request),p_input:payload,p_operation:op,p_request:requestId}));
    }
    if(!action && ((!id&&request.method==="POST")||(id&&request.method==="PATCH"))) {
     if(id){const access=await databaseResult<WorkflowAccess>(client.rpc("get_bid_workflow_access",{p_org:org,p_bid:id}));if(!access.canEdit)throw new ApiFailure(403,"FORBIDDEN","Preparing bid content is not permitted.");}
     const body=strictObject(await readJson(request,600000),["operationId","input"]);const input=validateBidInput(body.input);const op=operation(request,body.operationId);
     return await databaseResult(client.rpc("save_bid",{p_org:org,p_bid:id,p_expected:expectedVersion(request),p_input:input,p_operation:op,p_request:requestId}));
    }
   }
   if(resource==="interviews") {
    requireRole(scope,["admin","team_leader","team_member"]);
    if(read&&!id){const query=client.from("interviews").select(interviewColumns).eq("organization_id",org).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(200);if(q.get("bidId"))query.eq("bid_id",uuid(q.get("bidId")));return await databaseResult(query);}
    if(id && read&&!action){const interview=await getInterview(client,scope,id);const feedback=await databaseResult(client.from("interview_feedback").select("*").eq("organization_id",org).eq("interview_id",id).order("revision_number",{ascending:false}));const revisions=await databaseResult(client.from("interview_revisions").select("*").eq("organization_id",org).eq("interview_id",id).order("revision",{ascending:false}));return {interview,feedback,revisions};}
    if(id)await getInterview(client,scope,id);
    if(id&&action==="feedback"&&request.method==="POST"){const b=strictObject(await readJson(request),["operationId","feedback"]);return await databaseResult(client.rpc("record_interview_feedback",{p_org:org,p_interview:id,p_expected:expectedVersion(request),p_feedback:text(b.feedback,20000,true),p_operation:operation(request,b.operationId),p_request:requestId}));}
    if(!action&&((!id&&request.method==="POST")||(id&&request.method==="PATCH"))){const b=strictObject(await readJson(request),["operationId","previousRoundId","input"]);const input=validateInterviewInput(b.input);await getBid(client,scope,input.bidId);return await databaseResult(client.rpc("save_interview",{p_org:org,p_interview:id,p_expected:expectedVersion(request),p_input:input,p_previous:b.previousRoundId===null?null:uuid(b.previousRoundId),p_operation:operation(request,b.operationId),p_request:requestId}));}
   }
   if(resource==="tasks") {
    if(read&&!id){const query=client.from("workflow_tasks").select(taskColumns).eq("organization_id",org).order("due_at").limit(200);if(q.get("bidId"))query.eq("bid_id",uuid(q.get("bidId")));if(q.get("mine")==="true")query.eq("assignee_id",context.userId);if(q.get("state")){if(!["open","completed","cancelled"].includes(q.get("state")!))throw new ApiFailure(400,"SCHEMA_INVALID","Invalid task state.");query.eq("state",q.get("state"));}if(q.get("overdue")==="true")query.eq("state","open").lt("due_at",new Date().toISOString());return await databaseResult(query);}
    if(id&&action==="complete"&&request.method==="POST"){const b=strictObject(await readJson(request),["operationId"]);return await databaseResult(client.rpc("complete_workflow_task",{p_org:org,p_task:id,p_expected:expectedVersion(request),p_operation:operation(request,b.operationId),p_request:requestId}));}
   }
   if(resource==="notifications"){
    if(read&&!id)return await databaseResult(client.from("workflow_notifications").select("id,bidId:bid_id,interviewId:interview_id,title,readAt:read_at,createdAt:created_at").eq("organization_id",org).eq("recipient_id",context.userId).order("created_at",{ascending:false}).limit(100));
    if(id&&action==="read"&&request.method==="POST"){strictObject(await readJson(request),[]);await databaseResult(client.rpc("read_workflow_notification",{p_org:org,p_notification:id}));return {id};}
   }
   if(resource==="workflow-operations"&&read&&id&&!action){const row=await databaseResult<{result:unknown}|null>(client.from("workflow_operations").select("result").eq("organization_id",org).eq("actor_id",context.userId).eq("operation_id",id).maybeSingle());return row?.result??null;}
   if(resource==="workflow-policy"&&id&&!action&&request.method==="PATCH"){requireRole(scope,["admin"]);const b=strictObject(await readJson(request),["required","coverLetterRequired"]);if(typeof b.required!=="boolean"||typeof b.coverLetterRequired!=="boolean")throw new ApiFailure(422,"SCHEMA_INVALID","Supply boolean policy flags.");return await databaseResult(client.rpc("set_team_workflow_policy",{p_org:org,p_team:id,p_expected:expectedVersion(request),p_required:b.required,p_letter:b.coverLetterRequired,p_request:requestId}));}
   throw new ApiFailure(404,"FORBIDDEN","Unknown workflow action.");
  }catch(e){
   if(e instanceof SearchInputError)throw new ApiFailure(400,"SCHEMA_INVALID",e.message);
   if(e instanceof WorkflowValidationFailure)throw new ApiFailure(422,"SCHEMA_INVALID",e.message,false,e.issues);
   if(e instanceof ApiFailure&&e.code==="VERSION_CONFLICT"&&id){if(resource==="bids")e.currentVersion=(await getBid(client,scope,id)).rowVersion;else if(resource==="interviews")e.currentVersion=(await getInterview(client,scope,id)).rowVersion;}
   if(!read&&id&&e instanceof ApiFailure&&["VERSION_CONFLICT","SCHEMA_INVALID","KEY_PAYLOAD_MISMATCH","SERVICE_UNAVAILABLE"].includes(e.code)){
    try{const op=uuid(request.headers.get("idempotency-key"));const target=resource==="bids"?await getBid(client,scope,id):resource==="interviews"?await getInterview(client,scope,id):null;
     if(target)await client.rpc("record_workflow_failure",{p_org:org,p_bid:resource==="bids"?id:(target as Interview).bidId,p_interview:resource==="interviews"?id:null,p_operation:op,p_code:e.code});
    }catch{/* Failure notification must never replace the original operation result or error. */}
   }
   throw e;
  }
 });
}
