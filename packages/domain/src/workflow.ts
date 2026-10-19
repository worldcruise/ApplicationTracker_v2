import { Temporal } from "@js-temporal/polyfill";
import { bidStatuses, bidTransitions, interviewLifecycles, interviewOutcomes, type Bid, type BidInput, type BidStatus, type BidTransitionInput, type InterviewInput } from "@candidate/contracts";
export class WorkflowValidationFailure extends Error {
  issues: {path:string;message:string}[];
  constructor(issues: { path: string; message: string }[]) { super("Check the highlighted workflow fields. Your input is retained."); this.issues=issues; }
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validator(value: unknown, keys: string[]) {
  const issues: {path:string;message:string}[]=[];const issue=(path:string,message:string)=>issues.push({path,message});
  const v=value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  if(Object.keys(v).length!==keys.length || keys.some(k=>!Object.hasOwn(v,k)) || Object.keys(v).some(k=>!keys.includes(k))) issue("/","Supply only the documented fields.");
  const text=(key:string,max:number,required=false,nullable=false)=>{const x=v[key];if(nullable && x===null)return;if(typeof x!=="string" || x.length>max || (required && !x.trim()) || (typeof x==="string" && /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x))) issue(`/${key}`,`Supply ${required ? "nonempty " : ""}text up to ${max} characters${nullable ? " or null" : ""}.`);};
  const id=(key:string,nullable=false)=>{if(nullable && v[key]===null)return;if(typeof v[key]!=="string" || !uuid.test(v[key]))issue(`/${key}`,"Supply a valid UUID.");};
  const one=(key:string,values:readonly string[])=>{if(typeof v[key]!=="string" || !values.includes(v[key]))issue(`/${key}`,`Choose ${values.join(", ")}.`);};
  const date=(key:string)=>{if(v[key]===null)return;try{if(typeof v[key]!=="string" || v[key].length>40)throw Error();Temporal.Instant.from(v[key]);}catch{issue(`/${key}`,"Supply an ISO timestamp with an explicit UTC offset, or null.");}};
  const url=(key:string)=>{if(v[key]===null)return;try{if(typeof v[key]!=="string" || v[key].length>2048)throw Error();const u=new URL(v[key]);if(!["http:","https:"].includes(u.protocol)||u.username||u.password)throw Error();}catch{issue(`/${key}`,"Use an HTTP(S) URL without credentials, or null.");}};
  return {v,issue,text,id,one,date,url,finish:()=>{if(issues.length)throw new WorkflowValidationFailure(issues);}};
}
export function validateBidInput(value: unknown): BidInput {
  const c=validator(value,["candidateId","ownerId","teamId","companyName","jobTitle","jobDescription","jobUrl","externalId","jobLocation","priority","followUpAt","lastContactAt","notes","outcome","resumeDocumentId","coverLetterDocumentId"]);
  for(const k of ["candidateId","ownerId","teamId"])c.id(k);for(const k of ["resumeDocumentId","coverLetterDocumentId"])c.id(k,true);
  c.text("companyName",200,true);c.text("jobTitle",200,true);c.text("jobDescription",204800);if(typeof c.v.jobDescription==="string" && new TextEncoder().encode(c.v.jobDescription).length>204800)c.issue("/jobDescription","Job description exceeds 200 KiB UTF-8.");
  c.url("jobUrl");c.text("externalId",300,false,true);c.text("jobLocation",300,false,true);c.one("priority",["low","normal","high","urgent"]);c.date("followUpAt");c.date("lastContactAt");c.text("notes",20000);c.text("outcome",4000);c.finish();return value as BidInput;
}
export function validateBidTransition(value: unknown): BidTransitionInput {
  const c=validator(value,["operationId","status","reason","submittedAt","confirmation","attested","adminOverrideReason","reopen"]);
  c.id("operationId");c.one("status",bidStatuses);c.text("reason",4000,true);c.date("submittedAt");c.text("confirmation",4000);c.text("adminOverrideReason",4000);
  for(const k of ["attested","reopen"])if(typeof c.v[k]!=="boolean")c.issue(`/${k}`,"Supply true or false.");
  if(c.v.status==="submitted" && (c.v.submittedAt===null || (c.v.attested!==true && (typeof c.v.confirmation!=="string" || !c.v.confirmation.trim()))))c.issue("/confirmation","Explicit submission needs its actual timestamp and confirmation or attestation.");
  c.finish();return value as BidTransitionInput;
}
export function availableBidTransitions(bid: Pick<Bid,"status"|"heldFromStatus">): readonly BidStatus[] {
  return bid.status==="on_hold" && bid.heldFromStatus ? [...new Set([...bidTransitions.on_hold,bid.heldFromStatus])] : bidTransitions[bid.status];
}
export function schedulingChoices(localDateTime: string,timezone: string) {
  try {
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(localDateTime) || /^[+-]/.test(timezone))throw Error();
    new Intl.DateTimeFormat("en",{timeZone:timezone}).format();
    const local=Temporal.PlainDateTime.from(localDateTime);const fields={year:local.year,month:local.month,day:local.day,hour:local.hour,minute:local.minute,timeZone:timezone};
    const candidates=[Temporal.ZonedDateTime.from(fields,{disambiguation:"earlier"}),Temporal.ZonedDateTime.from(fields,{disambiguation:"later"})];
    const valid=candidates.filter(z=>z.toPlainDateTime().equals(local));
    if(!valid.length)throw new WorkflowValidationFailure([{path:"/localDateTime",message:"This local time does not exist because of a daylight-saving change. Choose another time."}]);
    return [...new Map(valid.map(z=>[z.epochNanoseconds.toString(),{instant:z.toInstant().toString(),offset:z.offset}])).values()];
  } catch(e){if(e instanceof WorkflowValidationFailure)throw e;throw new WorkflowValidationFailure([{path:"/timezone",message:"Use a valid IANA time zone and real local date/time."}]);}
}
export function validateInterviewInput(value: unknown): InterviewInput & { scheduledAt: string | null; offset: string | null } {
  const c=validator(value,["bidId","ownerId","type","interviewer","localDateTime","timezone","offset","durationMinutes","location","meetingUrl","lifecycle","outcome","nextAction","followUpAt"]);
  c.id("bidId");c.id("ownerId");c.text("type",100);c.text("interviewer",300);c.text("location",1000);c.url("meetingUrl");c.one("lifecycle",interviewLifecycles);c.one("outcome",interviewOutcomes);c.text("nextAction",4000);c.date("followUpAt");
  for(const k of ["localDateTime","timezone","offset"])c.text(k,k==="offset" ? 9:100,false,true);
  if(!Number.isInteger(c.v.durationMinutes) || Number(c.v.durationMinutes)<1 || Number(c.v.durationMinutes)>1440)c.issue("/durationMinutes","Duration must be 1–1,440 minutes.");
  if(["scheduled","completed","feedback_pending"].includes(String(c.v.lifecycle)) && !c.v.localDateTime)c.issue("/localDateTime","This lifecycle requires a schedule.");
  if(!["completed","feedback_pending"].includes(String(c.v.lifecycle)) && c.v.outcome!=="pending")c.issue("/outcome","Record completion separately before recording its result.");
  if(c.v.localDateTime===null && (c.v.timezone!==null || c.v.offset!==null))c.issue("/timezone","A zone/offset needs a local date/time.");
  c.finish();const input=value as InterviewInput;let scheduledAt:string|null=null;let offset=input.offset;
  if(input.localDateTime){if(!input.timezone)throw new WorkflowValidationFailure([{path:"/timezone",message:"Choose the IANA time zone for this schedule."}]);const choices=schedulingChoices(input.localDateTime,input.timezone);
    const selected=choices.find(x=>x.offset===input.offset) ?? (choices.length===1 && input.offset===null ? choices[0]:undefined);
    if(!selected)throw new WorkflowValidationFailure([{path:"/offset",message:`Choose which occurrence you mean: ${choices.map(c=>`${c.offset} (${c.instant})`).join(" or ")}.`}]);scheduledAt=selected.instant;offset=selected.offset;}
  return {...input,scheduledAt,offset};
}
