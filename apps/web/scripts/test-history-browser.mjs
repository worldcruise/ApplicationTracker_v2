import {expect} from "@playwright/test";
import {randomUUID,createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {identifyJob} from "@candidate/domain";
export async function testHistoryBrowser({harness,fixture,identities,org,password,assert}){
  let step="sign-in",checks=0;const {candidate,job}=fixture;const actor=identities.leaderA;
  let page=await harness.context.newPage();page.setDefaultTimeout(20000);
  const login=async(person)=>{await page.getByLabel("Email",{exact:true}).fill(person.email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in to existing account",exact:true}).click();await expect(page.getByTestId("account-id")).toHaveText(person.id);};
  const run=()=>page.getByRole("button",{name:"Check application history",exact:true}).click();
  try{
    await page.goto(harness.origin+"/workspace.html");await expect(page.getByTestId("account-id")).toBeVisible();await page.getByRole("button",{name:"Sign out of extension",exact:true}).click();await login(actor);await page.getByLabel("Organization",{exact:true}).selectOption(org);await page.getByLabel("Candidate",{exact:true}).selectOption(candidate+"|");
    await expect(page.getByRole("heading",{name:"Job description",exact:true})).toBeVisible();
    const worker=harness.context.serviceWorkers()[0];
    const command=await worker.evaluate(async()=>{const all=await chrome.commands.getAll();await chrome.contextMenus.update("check-application-history",{title:"Check Application History"});return all.find(r=>r.name==="check-application-history");});
    assert(command&&command.shortcut,"Quick Check command and menu are registered in real Chromium");checks++;
    step="actual isolated page capture";
    const jobPage=await harness.context.newPage();const capturedUrl="http://localhost:3000/quick-check-synthetic/jobs/123?utm_source=fixture";
    await jobPage.route(capturedUrl,route=>route.fulfill({status:200,contentType:"text/html",body:'<!doctype html><title>Synthetic captured page title</title><span id="company">Synthetic History Labs</span><section itemprop="description">Build synthetic history tools</section>'}));await jobPage.goto(capturedUrl);
    await jobPage.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.getElementById("company"));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
    await expect.poll(()=>worker.evaluate(async()=>{const row=await chrome.storage.session.get("quick-active-context");return row["quick-active-context"]?.candidateId;})).toBe(candidate);
    const opened=harness.context.waitForEvent("page");
    await worker.evaluate(async(target)=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===target);const entry=await import(chrome.runtime.getURL("service-worker.js"));await entry.captureContext("shortcut",tab);},capturedUrl);
    page=await opened;page.setDefaultTimeout(20000);await page.waitForLoadState("domcontentloaded");
    await expect(page.getByLabel("Company to check",{exact:true})).toHaveValue(job.company);await expect(page.getByLabel("Job description to check",{exact:true})).toHaveValue(job.description);await expect(page.getByLabel("Job URL to check",{exact:true})).toHaveValue(capturedUrl);
    await expect(page.getByTestId("history-database-state")).toHaveCount(0);checks++;
    step="review and authorized real lookup";
    await page.getByLabel("Job title to check",{exact:true}).fill(job.title);await page.getByLabel("Job URL to check",{exact:true}).fill(job.url);await page.getByLabel("External posting ID to check",{exact:true}).fill(job.externalId);await run();
    await expect(page.getByTestId("history-database-state")).toHaveText("found");await expect(page.getByTestId("history-local-state")).toHaveText("unknown");await expect(page.getByRole("heading",{name:"Database exact-job matches (1)",exact:true})).toBeVisible();assert(!(await page.locator("body").innerText()).includes("PRIVATE HISTORY"),"Quick Check contains no profile/bid notes");checks++;
    step="review draft persists";await page.reload();await expect(page.getByLabel("Job title to check",{exact:true})).toHaveValue(job.title);await expect(page.getByLabel("Job URL to check",{exact:true})).toHaveValue(job.url);checks++;
    step="real browser filesystem fixture";
    const identifiers=await identifyJob(job),operationId=randomUUID();
    const pdf=readFileSync(new URL("../../../output/pdf/ats-classic-synthetic.pdf",import.meta.url));
    const files={"JobDetails.txt":Buffer.from(JSON.stringify(job)),"Resume.json":Buffer.from(JSON.stringify({company:job.company,title:job.title,summary:"Synthetic tools",skills:[],experience:[],education:[]})),"Resume.pdf":pdf};
    const manifest={archiveVersion:1,organizationId:org,candidateId:candidate,operationId,bidId:fixture.exact,context:job,identifiers,packageComplete:true,schemaVersion:1,templateVersionId:"a7000000-0000-4000-9000-000000000001",rendererVersion:"ats-classic/1.0.0",files:Object.fromEntries(Object.entries(files).map(([k,b])=>[k,{bytes:b.length,sha256:createHash("sha256").update(b).digest("hex")}]))};
    const path=["Synthetic Candidate__"+candidate,"Synthetic Company__fixture"];
    const index={archiveVersion:1,organizationId:org,candidateId:candidate,companyKey:identifiers.companyKey,normalizationVersion:identifiers.version,checkedAt:new Date().toISOString(),entries:[{directory:operationId,operationId,identifiers}],byUrl:{[identifiers.urlHash]:[operationId]},byDescription:{[identifiers.descriptionHash]:[operationId]},byExternal:{[JSON.stringify([identifiers.provider,identifiers.externalId])]:[operationId]}};
    const linkKey="archive-link:"+actor.id+":"+org+":"+candidate+":"+createHash("sha256").update(identifiers.companyKey).digest("hex");
    await page.evaluate(async({path,index,manifest,files,linkKey,operationId})=>{
      const root=await navigator.storage.getDirectory();const parent=await root.getDirectoryHandle(path[0],{create:true}),company=await parent.getDirectoryHandle(path[1],{create:true}),pkg=await company.getDirectoryHandle(operationId,{create:true});
      const write=async(dir,name,bytes)=>{const stream=await (await dir.getFileHandle(name,{create:true})).createWritable();await stream.write(bytes);await stream.close();};
      for(const [name,base64] of Object.entries(files))await write(pkg,name,Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));
      await write(pkg,"metadata.json",JSON.stringify(manifest));await write(company,"archive-index.json",JSON.stringify(index));
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open("candidate-phase0",1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});await new Promise((resolve,reject)=>{const tx=db.transaction("records","readwrite");tx.objectStore("records").put(root,"archive-directory");tx.objectStore("records").put({root,path},linkKey);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(Error("OPFS handle did not persist"));});
    },{path,index,manifest,files:Object.fromEntries(Object.entries(files).map(([k,b])=>[k,b.toString("base64")])),linkKey,operationId});
    await page.reload();await expect(page.getByLabel("Company to check",{exact:true})).toHaveValue(job.company);
    let release;const gate=new Promise(resolve=>{release=resolve;});const apiPattern="**/api/v1/application-history?**";
    await page.route(apiPattern,async route=>{await gate;await route.continue();});await run();
    try{await expect(page.getByTestId("history-local-state")).toHaveText("found");await expect(page.getByTestId("history-database-state")).toHaveText("pending");}finally{release();}
    await expect(page.getByTestId("history-database-state")).toHaveText("found");await page.unroute(apiPattern);checks++;
    step="database failure retains successful local result";
    await page.route(apiPattern,route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:{code:"SERVICE_UNAVAILABLE",message:"Synthetic history outage",fieldErrors:[]}})}));await run();await expect(page.getByTestId("history-database-state")).toHaveText("check_failed");await expect(page.getByTestId("history-local-state")).toHaveText("found");await page.unroute(apiPattern);checks++;
    async function overwrite(name,text,inPackage=false){await page.evaluate(async({path,operationId,name,text,inPackage})=>{const root=await navigator.storage.getDirectory();let dir=await (await root.getDirectoryHandle(path[0])).getDirectoryHandle(path[1]);if(inPackage)dir=await dir.getDirectoryHandle(operationId);const stream=await(await dir.getFileHandle(name)).createWritable();await stream.write(text);await stream.close();},{path,operationId,name,text,inPackage});}
    step="corrupt index and scoped repair";await overwrite("archive-index.json","{invalid");await run();await expect(page.getByTestId("history-database-state")).toHaveText("found");await expect(page.getByTestId("history-local-state")).toHaveText("unknown");await page.getByRole("button",{name:"Repair linked company index",exact:true}).click();await expect(page.getByTestId("history-local-state")).toHaveText("found");checks++;
    step="changed package files remain unknown";await overwrite("Resume.json","Changed synthetic file",true);await run();await expect(page.getByTestId("history-database-state")).toHaveText("found");await expect(page.getByTestId("history-local-state")).toHaveText("unknown");await page.getByRole("button",{name:"Repair linked company index",exact:true}).click();await expect(page.getByText(/Unreadable\/incomplete packages retained/)).toBeVisible();await expect(page.getByTestId("history-local-state")).toHaveText("unknown");checks++;
    step="selection menu input and restricted page fallback";const fallback=harness.context.waitForEvent("page");await worker.evaluate(async()=>{const entry=await import(chrome.runtime.getURL("service-worker.js"));await entry.captureContext("context_menu",undefined,"Synthetic menu selection");});const manual=await fallback;await manual.waitForLoadState("domcontentloaded");await expect(manual.getByLabel("Company to check",{exact:true})).toHaveValue("Synthetic menu selection");await expect(manual.getByText(/Page capture unavailable|No job description could be extracted/)).toBeVisible();checks++;
    await jobPage.close();return checks;
  }catch(error){throw Error("Quick Check "+step+": "+error.message);}
}
