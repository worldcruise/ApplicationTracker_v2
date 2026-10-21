// Runs only inside the parent CI harness's isolated Supabase/localhost guard.
// Mailpit tokens stay in memory; never persist browser/session state or email bodies.
import { chromium, expect as browserExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
export async function testRegistration({ operator, url, publicKey, call, org, otherOrg, team, identities, password, assert }) {
  let stage="configure intake"; let browser; let checkpoints=0;
  const endpoint=`/organizations/${org}/account-requests`;
  const rpc=async (name,args) => { const r=await operator.rpc(name,args); assert(!r.error,`registration setup ${name} (${r.error?.code ?? "OK"})`);return r.data; };
  const confirmURL=async email => {
    for(let i=0;i<20;i++) {
      const inbox=await (await fetch("http://127.0.0.1:54324/api/v1/messages?limit=100")).json();
      const item=inbox.messages?.find(m => m.To?.some(t => t.Address?.toLowerCase()===email.toLowerCase()));
      if(item) {
        const message=await (await fetch(`http://127.0.0.1:54324/api/v1/message/${item.ID}`)).json();
        const link=message.HTML?.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/)?.[1]?.replaceAll("&amp;","&");
        assert(link?.startsWith("http://localhost:3000/auth/confirm?token_hash="),"Actual signup email contains the fixed token-hash callback");
        return link;
      }
      await pause(250);
    }
    throw new Error("Synthetic confirmation mail not delivered to isolated Mailpit");
  };
  const newSignup=async label => {
    const email=`synthetic-${label}-${randomUUID()}@example.invalid`;
    const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const result=await client.auth.signUp({email,password,options:{data:{full_name:`Synthetic ${label}`,registration_flow:"approval_v1"}}});
    assert(!result.error && result.data.user && !result.data.session,"Signup requires confirmation and creates no session");
    const identity={id:result.data.user.id,email,client};
    return identity;
  };
  const confirmed=async person => {
    const response=await fetch(await confirmURL(person.email),{redirect:"manual"});
    assert(response.status===307 && /no-store/.test(response.headers.get("cache-control") ?? ""),"Email confirmation uses no-store fixed redirect");
    const login=await person.client.auth.signInWithPassword({email:person.email,password});
    assert(!login.error && login.data.session,"Verified applicant can authenticate independently of approval");
    person.token=login.data.session.access_token;
  };
  try {
    await rpc("configure_registration",{p_org:org,p_enabled:true});
    stage="browser signup and actual confirmation email";
    browser=await chromium.launch();
    const applicantContext=await browser.newContext();const page=await applicantContext.newPage();page.setDefaultTimeout(15000);
    await page.goto("http://localhost:3000/sign-in");await page.getByRole("link",{name:"Create account",exact:true}).click();
    await page.getByRole("button",{name:"Create account",exact:true}).click();
    await browserExpect(page.getByText("Enter your full name (1–200 characters).",{exact:true})).toBeVisible();checkpoints++;
    const email=`synthetic-browser-registration-${randomUUID()}@example.invalid`;
    await page.getByLabel("Full name",{exact:true}).fill("Synthetic Registration Applicant");await page.getByLabel("Email",{exact:true}).fill(email);
    await page.getByLabel("Password",{exact:true}).fill(password);await page.getByLabel("Confirm password",{exact:true}).fill("mismatch");
    await page.getByRole("button",{name:"Create account",exact:true}).click();await browserExpect(page.getByText("Passwords do not match. Re-enter the confirmation.",{exact:true})).toBeVisible();
    await page.getByLabel("Confirm password",{exact:true}).fill(password);await page.getByRole("button",{name:"Create account",exact:true}).click();
    await browserExpect(page.getByRole("status")).toContainText("Check your email");checkpoints++;
    const rows=await call(identities.adminA,endpoint);const applicant=rows.data.find(r=>r.email===email);
    assert(applicant?.status==="pending" && !applicant.email_verified,"Auth insert atomically records an unverified pending applicant");
    const before=await createClient(url,publicKey,{auth:{persistSession:false}}).auth.signInWithPassword({email,password});assert(!!before.error,"Unverified email cannot sign in");
    await page.goto(await confirmURL(email));await page.waitForURL("**/account/status");
    await browserExpect(page.getByRole("heading",{name:"Awaiting administrator approval",exact:true})).toBeVisible();await browserExpect(page.getByText("Email: Verified",{exact:true})).toBeVisible();checkpoints++;
    for(const path of [`/api/v1/candidates?organizationId=${org}`,`/api/v1/organizations/${org}`,`/api/v1/organizations/${org}/account-requests`]) {
      const r=await page.request.get(`http://localhost:3000${path}`);assert(r.status()===403,"Pending cookie identity denied business/admin API");
    }
    const status=await (await page.request.get("http://localhost:3000/api/v1/account/status")).json();assert(status.data.status==="pending","Applicant status endpoint is self-scoped");
    stage="Admin screen approval";
    const adminContext=await browser.newContext();const adminPage=await adminContext.newPage();adminPage.setDefaultTimeout(15000);
    await adminPage.goto("http://localhost:3000/sign-in");await adminPage.getByLabel("Email",{exact:true}).fill(identities.adminA.email);await adminPage.getByLabel("Password",{exact:true}).fill(password);await adminPage.getByRole("button",{name:"Sign in",exact:true}).click();await adminPage.waitForURL("**/workspace");
    await adminPage.goto(`http://localhost:3000/admin/account-requests?organizationId=${org}`);
    const card=adminPage.getByRole("article").filter({hasText:email});await browserExpect(card).toContainText("Email verification: Verified");
    await card.getByLabel("Required team").selectOption(team);await card.getByRole("button",{name:"Approve",exact:true}).click();await browserExpect(card).toContainText("Review status: approved");checkpoints++;
    await page.getByRole("button",{name:"Check approval status",exact:true}).click();await page.waitForURL("**/workspace");await browserExpect(page.getByText("Role: team member",{exact:true})).toBeVisible();checkpoints++;
    await page.reload();await browserExpect(page.getByText("Role: team member",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Sign out",exact:true}).click();await page.waitForURL("**/sign-in");checkpoints++;
    stage="duplicates, rejection, races and direct RLS";
    const race=await newSignup("race"), rejected=await newSignup("reject");await confirmed(race);await confirmed(rejected);
    const duplicate=await createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}}).auth.signUp({email:race.email,password,options:{data:{full_name:"Changed duplicate name",registration_flow:"approval_v1"}}});
    assert(!duplicate.data.session,"Duplicate signup grants no session");
    const raw=await race.client.from("account_requests").select("*");assert(!raw.error && raw.data.length===0,"Applicant cannot enumerate raw review data");
    const candidates=await race.client.from("candidates").select("id");assert(!candidates.error && candidates.data.length===0,"Pending direct candidate RLS denies data");
    const docs=await race.client.from("resume_versions").select("id");assert(!docs.error && docs.data.length===0,"Pending direct document RLS denies data");
    const self=await race.client.from("account_requests").update({status:"approved",assigned_role:"admin"}).eq("user_id",race.id);assert(self.error?.code==="42501","Direct self promotion denied");
    const review={userId:race.id,decision:"approved",role:"bidder",teamId:team,reason:"Synthetic approval"};
    assert((await call(race,endpoint,review,1)).status===403,"Pending review attempt denied");
    for(const person of [identities.leaderA,identities.memberA,identities.bidderA]) assert((await call(person,endpoint,review,1)).status===403,"Non-Admin role cannot approve accounts");
    assert((await call(identities.adminB,endpoint,review,1)).status===403,"Other organization Admin denied");
    const wrong=await call(identities.adminA,`/organizations/${otherOrg}/account-requests`,review,1);assert(wrong.status===403,"Client cannot redirect review to other organization");
    const results=await Promise.all([call(identities.adminA,endpoint,review,1),call(identities.adminA,endpoint,{userId:race.id,decision:"rejected",role:null,teamId:null,reason:"Concurrent rejection"},1)]);
    assert(results.filter(r=>r.status===200).length===1 && results.filter(r=>r.status===409).length===1,"Simultaneous opposing reviews commit exactly one terminal decision");
    const final=await call(race,"/account/status");const winning=final.data.status==="approved"?review:{userId:race.id,decision:"rejected",role:null,teamId:null,reason:"Concurrent rejection"};
    assert((await call(identities.adminA,endpoint,winning,1)).status===200,"Lost-response identical replay succeeds");
    assert((await call(identities.adminA,endpoint,{userId:rejected.id,decision:"rejected",role:null,teamId:null,reason:"Synthetic review declined"},1)).status===200,"Admin rejection succeeds");
    assert((await call(rejected,"/account/status")).data.status==="rejected","Rejected identity reads clear own status");assert((await call(rejected,`/candidates?organizationId=${org}`)).status===403,"Rejected identity denied API");
    const list=await call(identities.adminA,endpoint);assert(list.data.filter(r=>r.user_id===race.id).length===1,"Duplicate signup creates no duplicate request");
    const member=await operator.from("organization_memberships").select("user_id").eq("user_id",applicant.user_id).eq("state","active");assert(member.data?.length===1,"Approval creates exactly one persisted active membership");
    const child=await operator.from("team_memberships").select("team_id").eq("user_id",applicant.user_id).eq("active",true);assert(child.data?.length===1 && child.data[0].team_id===team,"Approval atomically assigns required team");
    await page.getByLabel("Email",{exact:true}).fill(rejected.email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL("**/account/status");await browserExpect(page.getByRole("heading",{name:"Account request rejected",exact:true})).toBeVisible();await browserExpect(page.getByText("Review reason: Synthetic review declined",{exact:true})).toBeVisible();checkpoints++;
    console.log(JSON.stringify({registration:"PASS",browserCheckpoints:checkpoints,mail:"actual isolated Mailpit confirmation",concurrency:"opposing reviews serialize"}));
  } catch(e) { throw new Error(`Registration ${stage}: ${e instanceof Error ? e.message.split("\n")[0].replace(/token_hash=[^ &]+/g,"token_hash=[redacted]") : "failed"}`); }
  finally { await browser?.close(); await rpc("configure_registration",{p_org:org,p_enabled:false}); }
}
