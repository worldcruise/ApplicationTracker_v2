import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiErrorResponse,ApiResponse,UserContext } from "@candidate/contracts";
import { verifiedIdentity,withAuthOperation,type AuthLock } from "./auth";
import type { ExtensionConfig } from "./config";
export class ExtensionApiError extends Error {
 constructor(public status:number,public code:string,message:string,public fields:readonly {path:string;message:string}[]=[]){super(message);}
}
export function extensionApi(client:SupabaseClient,config:ExtensionConfig,lock?:AuthLock){
 const base=new URL(config.apiUrl.endsWith("/")?config.apiUrl:config.apiUrl+"/");
 async function request<T>(path:string,options:{actorId?:string;organizationId?:string;body?:unknown;operationId?:string}={}):Promise<T>{
  const target=new URL(path,base);
  if(path.startsWith("/")||path.includes("..")||target.origin!==base.origin||!target.pathname.startsWith(base.pathname))throw Error("Use a relative shared API resource.");
  return withAuthOperation(async()=>{
   const identity=await verifiedIdentity(client);if(!identity)throw new ExtensionApiError(401,"UNAUTHENTICATED","Sign in to continue. Local work is retained.");
   if(options.actorId&&identity.id!==options.actorId)throw new ExtensionApiError(403,"ACCOUNT_CHANGED","This operation belongs to another account. Sign in as its original actor; it will not be replayed here.");
   async function fetchResource<R>(resource:string,body?:unknown):Promise<R>{
    const method=body===undefined?"GET":"POST";let response:Response|undefined;
    for(let attempt=0;attempt<(method==="GET"?2:1);attempt++){
     const session=await client.auth.getSession();if(session.error||!session.data.session||session.data.session.user.id!==identity!.id)throw new ExtensionApiError(401,"UNAUTHENTICATED","The session changed. Sign in again; no queued write was replayed.");
     try{response=await fetch(new URL(resource,base),{method,credentials:"omit",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30000),
      headers:{Authorization:"Bearer "+session.data.session.access_token,"X-Operation-Actor":identity!.id,...(body===undefined?{}:{"Content-Type":"application/json"}),...(options.operationId?{"Idempotency-Key":options.operationId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
     }catch{throw new ExtensionApiError(0,"NETWORK_ERROR","Shared API is unreachable. The original operation and PDF are retained; synchronization may be unknown.");}
     if(response.status!==401||method!=="GET"||attempt===1)break;
     if((await client.auth.refreshSession()).error)throw new ExtensionApiError(401,"UNAUTHENTICATED","Refresh failed. Sign in again.");
    }
    let envelope:ApiResponse<R>|ApiErrorResponse;try{envelope=await response!.json();}catch{throw new ExtensionApiError(response!.status,"INVALID_RESPONSE","The API did not return a valid result. Reconcile the original operation.");}
    if("error" in envelope)throw new ExtensionApiError(response!.status,envelope.error.code,envelope.error.message,envelope.error.fieldErrors);
    if(!response!.ok||!("data" in envelope))throw new ExtensionApiError(response!.status,"INVALID_RESPONSE","The API result could not be confirmed.");
    return envelope.data;
   }
   // Resolve current membership before every mutation. The actual endpoint rechecks
   // resource permissions in user context; no cached role authorizes a write.
   if(options.body!==undefined){const context=await fetchResource<UserContext>("me");if(context.userId!==identity.id||!context.organizations.some(o=>o.organizationId===options.organizationId))throw new ExtensionApiError(403,"FORBIDDEN","Current active organization access is required. No write was sent.");}
   const result=await fetchResource<T>(path,options.body);
   if(path==="me"&&(result as UserContext).userId!==identity.id)throw new ExtensionApiError(401,"IDENTITY_MISMATCH","The API and extension identities differ.");
   return result;
  },lock);
 }
 async function withActor<T>(actorId:string,work:()=>Promise<T>){return withAuthOperation(async()=>{const user=await verifiedIdentity(client);if(!user||user.id!==actorId)throw new ExtensionApiError(403,"ACCOUNT_CHANGED","The active account changed. This local operation was not replayed.");return work();},lock);}
 return {request,withActor};
}
export type ExtensionApi=ReturnType<typeof extensionApi>;
