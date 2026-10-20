import type {FrozenPackageInput} from "@candidate/contracts";
import {historyHash,identifyJob,validateHistoryContext} from "./history.js";

export function windowsName(value:string,max=40){
  let safe=value.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu,"_").replace(/[. ]+$/u,"").trim();
  if(!safe||safe==="."||safe==="..")safe="Unknown";
  if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(safe))safe="_"+safe;
  let bounded="";for(const char of safe){if(bounded.length+char.length>max)break;bounded+=char;}
  bounded=bounded.replace(/[. ]+$/u,"")||"Unknown";
  if(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(bounded))bounded="_"+bounded;
  return bounded;
}
export async function packagePaths(name:string,candidateId:string,context:FrozenPackageInput["context"],operationId:string,createdAt:string){
  if(!/^[0-9a-f-]{36}$/iu.test(candidateId)||!/^[0-9a-f-]{36}$/iu.test(operationId)||!Number.isFinite(Date.parse(createdAt)))throw Error("Valid frozen candidate/operation/time are required.");
  const ids=await identifyJob(validateHistoryContext(context));
  return [windowsName(name)+"__"+candidateId.toLowerCase(),windowsName(context.company)+"__"+(await historyHash(ids.companyKey)).slice(0,16),createdAt.slice(0,10)+"_"+windowsName(context.title,32)+"__"+operationId.toLowerCase()];
}
export function packageJobDetails(input:FrozenPackageInput){
  return ["Target company: "+input.context.company,"Job title: "+input.context.title,"Original URL: "+input.context.url,"Posting identifier: "+input.context.externalId,"Captured/frozen at: "+input.createdAt,"Operation: "+input.operationId,"","Reviewed job description:",input.context.description,""].join("\n");
}
