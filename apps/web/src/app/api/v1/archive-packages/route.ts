import {api,preflight} from "@/lib/api/http";
import {requestContext} from "@/lib/api/context";
import {currentOrganization,uuid,checkMutationOrigin} from "@/lib/api/guards";
import {ApiFailure,databaseResult} from "@/lib/api/errors";
import {readJson} from "@/lib/api/body";
import {packageInput,savePackage} from "@/lib/archive/service";
export const OPTIONS=preflight;export const dynamic="force-dynamic";
export async function GET(request:Request){return api(request,async()=>{const {client,context}=await requestContext(request);const q=new URL(request.url).searchParams;const org=currentOrganization(context,uuid(q.get("organizationId"))).organizationId;return databaseResult(client.rpc("archive_operation_result",{p_org:org,p_operation:uuid(q.get("operationId"))}));});}
export async function POST(request:Request){return api(request,async requestId=>{const {client,context,token}=await requestContext(request);checkMutationOrigin(request,token);const org=currentOrganization(context,uuid(new URL(request.url).searchParams.get("organizationId"))).organizationId;const input=packageInput(await readJson(request,1800000),context.userId,org);if(request.headers.get("idempotency-key")!==input.operationId)throw new ApiFailure(400,"SCHEMA_INVALID","Idempotency-Key must match the original package operationId.");return savePackage(client,input,requestId);});}
