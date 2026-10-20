import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalJobUrl, companyKeys, identifyJob, matchIdentifiers, validateHistoryContext } from "./history.ts";
const context = {company:"Synthetic Labs",title:"Engineer",url:"https://jobs.example.invalid/jobs/123?job_id=123&utm_source=test#top",description:"Build synthetic tools",externalId:"123"};
test("company and URL normalization preserve identity-bearing differences", () => {
  assert.deepEqual(companyKeys("  SYNTHETIC　Labs  Inc. "),{key:"synthetic labs inc.",loose:"synthetic labs"});
  assert.equal(canonicalJobUrl("HTTPS://Jobs.Example.invalid:443/jobs/123?job_id=123&utm_source=test&custom=one#top").url,"https://jobs.example.invalid/jobs/123?job_id=123&custom=one");
  assert.notEqual(canonicalJobUrl("https://x.invalid/jobs/123/").url,canonicalJobUrl("https://x.invalid/jobs/123").url);
  assert.notEqual(canonicalJobUrl("https://x.invalid/jobs/123?job_id=1").url,canonicalJobUrl("https://x.invalid/jobs/123?job_id=2").url);
  assert.equal(canonicalJobUrl("https://x.invalid/jobs/123?unknown=a%20b&job_id=1&utm_source=x&unknown=a+b").url,"https://x.invalid/jobs/123?unknown=a%20b&job_id=1&unknown=a+b");
  assert.equal(canonicalJobUrl("https://x.invalid/careers").posting,false);
  assert.equal(canonicalJobUrl("https://x.invalid/#/jobs/123").posting,false);
  assert.throws(()=>canonicalJobUrl("https://user:secret@x.invalid/jobs/1"));
  assert.throws(()=>validateHistoryContext({...context,company:""}));
  assert.throws(()=>validateHistoryContext({...context,constructor:"not a job field"}));
  assert.equal(validateHistoryContext({...context,company:"É".repeat(200)}).company.length,200);
});
test("only strong unchanged posting URLs are exact; fingerprints, aliases and reused URLs are evidence warnings",async()=>{
  const ids=await identifyJob(context);
  assert.equal(matchIdentifiers(ids,await identifyJob({...context,url:"https://jobs.example.invalid/jobs/123?job_id=123"})).exact,true);
  const fingerprint=matchIdentifiers(ids,await identifyJob({...context,url:"https://jobs.example.invalid/jobs/456"}));
  assert.equal(fingerprint.exact,false);assert.ok(fingerprint.evidence.includes("description_fingerprint"));
  assert.equal(matchIdentifiers(ids,await identifyJob({...context,company:"Synthetic Labs Inc."})).exact,false);
  const changed=matchIdentifiers(ids,await identifyJob({...context,title:"Different opportunity"}));
  assert.equal(changed.exact,false);assert.ok(changed.evidence.includes("url_reused_or_changed"));
  const generic=await identifyJob({...context,url:"https://jobs.example.invalid/careers"});
  assert.equal(matchIdentifiers(generic,generic).exact,false);
  assert.equal(matchIdentifiers(ids,await identifyJob({...context,company:"Unrelated Synthetic"})).company,false);
});
