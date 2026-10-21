import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normalizeSearch, parseWorkflowSearch, SearchInputError } from "../src/lib/workflow/search-input.js";

test("search normalizes whitespace while preserving names, Unicode, punctuation and literal wildcards",()=>{
 for(const value of ["  O’Neil   Élodie  ", "O'Neil", "C++ / C#", "%_\\", "a", ""]) {
  const result=parseWorkflowSearch(new URLSearchParams({q:value}),"bids");
  assert.equal(result.q??"",normalizeSearch(value));assert.equal(result.page,1);assert.equal(result.pageSize,25);
 }
 assert.equal(parseWorkflowSearch(new URLSearchParams(),"interviews").sort,"scheduled_asc");
 assert.equal(parseWorkflowSearch(new URLSearchParams("q=avery"),"bids").sort,"relevance");
});
test("combined search filters preserve date boundaries, pagination, references and existing lifecycle definitions",()=>{
 const params=new URLSearchParams({q:"Synthetic engineer",candidateId:"15000000-0000-4000-8000-000000000001",status:"draft",priority:"urgent",createdFrom:"2026-10-01",createdTo:"2026-10-21",submittedFrom:"2026-10-01",followup:"overdue",page:"2",pageSize:"10",sort:"company_asc"});
 const result=parseWorkflowSearch(params,"bids");assert.equal(result.page,2);assert.equal(result.followup,"overdue");assert.equal(result.createdTo,"2026-10-21");
 const interview=parseWorkflowSearch(new URLSearchParams({status:"completed",round:"2",type:"Technical",upcoming:"false",feedbackPending:"true",scheduledTo:"2028-02-29"}),"interviews");
 assert.equal(interview.round,2);assert.equal(interview.upcoming,undefined);assert.equal(interview.feedbackPending,true);
});
test("invalid and ambiguous query parameters fail with actionable errors before an RPC",()=>{
 for(const [kind,query] of [["bids","q=a&q=b"],["bids","candidateId=not-an-id"],["bids","status=completed"],["interviews","status=offer"],["bids","priority=critical"],["bids","page=0"],["bids","pageSize=101"],["bids","page=1.1"],["interviews","round=0"],["interviews","upcoming=yes"],["bids","createdFrom=2026-02-30"],["bids","createdFrom=2026-11-01&createdTo=2026-10-01"],["bids","sort=scheduled_asc"],["interviews","sort=submitted_desc"],["bids","q="+"x".repeat(201)]]) {
  assert.throws(()=>parseWorkflowSearch(new URLSearchParams(query),kind as "bids"|"interviews"),SearchInputError,query);
 }
});
