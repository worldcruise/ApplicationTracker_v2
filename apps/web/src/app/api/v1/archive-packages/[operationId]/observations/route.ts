import {api,preflight} from "@/lib/api/http";
import {requestContext} from "@/lib/api/context";
import {currentOrganization,uuid,checkMutationOrigin} from "@/lib/api/guards";
import {databaseResult} from "@/lib/api/errors";
import {readJson} from "@/lib/api/body";
export const OPTIONS=preflight;
export async function POST(request:Request,route:{params:Promise<{operationId:string}>}){return api(request,async()=>{const {client,context,token}=await requestContext(request);checkMutationOrigin(request,token);const org=currentOrganization(context,uuid(new URL(request.url).searchParams.get("organizationId"))).organizationId;return databaseResult(client.rpc("record_archive_device",{p_org:org,p_operation:uuid((await route.params).operationId),p_input:await readJson(request,4096)}));});}
