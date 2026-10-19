import test from "node:test";
import assert from "node:assert/strict";
import {bidStatuses,bidTransitions} from "@candidate/contracts";
import {schedulingChoices,validateBidTransition,validateInterviewInput,WorkflowValidationFailure} from "./workflow.ts";
test("fifteen bid states retain the documented edges and terminal states",()=>{
  assert.equal(bidStatuses.length,15);assert.deepEqual(bidTransitions.closed,[]);assert.deepEqual(bidTransitions.draft,["resume_preparation","withdrawn","expired"]);
  assert.ok(!bidTransitions.submitted.includes("draft"));assert.ok(!bidTransitions.interview_invited.includes("submitted"));
  assert.throws(()=>validateBidTransition({operationId:crypto.randomUUID(),status:"submitted",reason:"Actual submission",submittedAt:null,confirmation:"",attested:false,adminOverrideReason:"",reopen:false}),WorkflowValidationFailure);
});
test("scheduling detects daylight-saving gaps and requires an explicit repeated-time occurrence",()=>{
  assert.throws(()=>schedulingChoices("2026-03-08T02:30","America/New_York"),/highlighted/);
  const choices=schedulingChoices("2026-11-01T01:30","America/New_York");assert.deepEqual(choices.map(x=>x.offset),["-04:00","-05:00"]);assert.notEqual(choices[0]!.instant,choices[1]!.instant);
  assert.equal(schedulingChoices("2026-06-01T12:30","Asia/Kathmandu")[0]!.offset,"+05:45");
  const input={bidId:crypto.randomUUID(),ownerId:crypto.randomUUID(),type:"Video",interviewer:"Synthetic interviewer",localDateTime:"2026-11-01T01:30",timezone:"America/New_York",offset:null,durationMinutes:60,location:"",meetingUrl:null,lifecycle:"scheduled",outcome:"pending",nextAction:"",followUpAt:null};
  assert.throws(()=>validateInterviewInput(input),WorkflowValidationFailure);assert.equal(validateInterviewInput({...input,offset:"-05:00"}).scheduledAt,choices[1]!.instant);
  assert.throws(()=>validateInterviewInput({...input,offset:"-05:00",outcome:"offer"}),WorkflowValidationFailure);
  assert.equal(validateInterviewInput({...input,offset:"-05:00",lifecycle:"feedback_pending",outcome:"pending"}).outcome,"pending");
});
