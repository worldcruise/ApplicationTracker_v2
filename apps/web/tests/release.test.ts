import test from "node:test";
import assert from "node:assert/strict";
import {checkClientVersion} from "../src/lib/api/compatibility";
import {ApiFailure} from "../src/lib/api/errors";
test("legacy and supported pilot clients keep v1; unsupported clients receive a non-destructive upgrade error",()=>{
 for(const version of [null,"extension/0.1.0","extension/0.2.0"]){const headers=version?{"X-Candidate-Client":version}:{};assert.doesNotThrow(()=>checkClientVersion(new Request("https://synthetic.invalid",{headers})));}
 for(const version of ["extension/2.0.0","invalid"]){assert.throws(()=>checkClientVersion(new Request("https://synthetic.invalid",{headers:{"X-Candidate-Client":version}})),(e:unknown)=>e instanceof ApiFailure&&e.status===426&&e.message.includes("pending operations"));}
});
