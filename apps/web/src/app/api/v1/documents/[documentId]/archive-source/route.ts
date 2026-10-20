import {api,preflight} from "@/lib/api/http";
import {requestContext} from "@/lib/api/context";
import {currentOrganization,uuid} from "@/lib/api/guards";
import {ApiFailure,databaseResult} from "@/lib/api/errors";
export const OPTIONS=preflight;export const dynamic="force-dynamic";
export async function GET(request:Request,route:{params:Promise<{documentId:string}>}){return api(request,async()=>{const {client,context}=await requestContext(request);const q=new URL(request.url).searchParams;const scope=currentOrganization(context,uuid(q.get("organizationId")));const documentId=uuid((await route.params).documentId);const source=await databaseResult<Record<string,unknown>>(client.rpc("export_archive_source",{p_org:scope.organizationId,p_document:documentId}));if(q.has("bidId")){const job=await databaseResult(client.rpc("archive_bid_job",{p_org:scope.organizationId,p_bid:uuid(q.get("bidId")),p_document:documentId}));if(!job)throw new ApiFailure(403,"FORBIDDEN","This job is not available in your current export scope.");return {...source,job};}return source;});}
