import {randomUUID} from 'node:crypto';
export async function testOperationsHTTP({call,identities,org,team,fixture,assert}) {
 const path=(resource,q='')=>`/${resource}?organizationId=${org}${q}`;
 const load=async(who,q='')=>{const r=await call(who,path('dashboard',q));assert(r.status===200,`Operational report loads (${r.code??r.status})`);return r.data;};
 const roles=['adminA','leaderA','memberA','bidderA'];
 for(const name of roles){const who=identities[name];const d=await load(who);
  assert(d.version==='operations/1'&&Number.isFinite(Date.parse(d.asOf)),'Report declares version and as-of clock');
  const rows=await who.client.from('bids').select('id,status,owner_id,created_by').eq('organization_id',org);
  assert(!rows.error,'Independent user-context source query succeeds');
  const own=rows.data.filter(b=>name!=='bidderA'||b.owner_id===who.id||b.created_by===who.id);
  assert(d.counts.active_bids===own.filter(b=>!['rejected','withdrawn','expired','closed'].includes(b.status)).length,'Active count reconciles with independently scoped RLS source');
  assert(d.counts.all_bids===own.length,'All-bid count reconciles without truncation');
  for(const metric of Object.keys(d.counts)){const detail=await load(who,'&metric='+metric);assert(detail.detail.total===detail.counts[metric],'Metric and detail total use identical definitions');assert(detail.detail.items.length===Math.min(25,detail.detail.total),'Detail pagination is bounded and exact');}
  if(name==='bidderA'){
   assert(!Object.hasOwn(d.counts,'upcoming_interviews')&&!Object.hasOwn(d.counts,'pending_feedback')&&!Object.hasOwn(d.counts,'active_candidates')&&d.interviewProgression.length===0,'Bidder report omits interview/profile projections');
   assert(!JSON.stringify(d).includes('PRIVATE')&&!JSON.stringify(d).includes('feedbackText'),'No private source content in bidder report');
   assert((await call(who,path('dashboard','&metric=pending_feedback'))).status===403,'Bidder cannot request hidden drill-down');
  }
 }
 assert((await call(identities.adminB,path('dashboard'))).status===403,'Other organization report denied');
 const hidden=await load(identities.leaderBeta,'&teamId='+team);assert(hidden.counts.all_bids===0&&hidden.detail.total===0,'Other-team filter never widens RLS');
 const empty=await load(identities.memberA,'&company=NoSuchSyntheticCompany');assert(empty.counts.submitted===0&&empty.detail.total===0,'Empty report has real zero denominator');
 for(const q of ['&from=2026-02-30','&from=2026-10-21&to=2026-10-20','&windowDays=999','&page=0','&status=unknown','&ownerId=invalid']) assert((await call(identities.adminA,path('dashboard',q))).status===400,'Invalid report input rejected');
 const rpc=await identities.adminB.client.rpc('operational_dashboard',{p_org:org});assert(rpc.error?.code==='42501','Direct RPC cannot bypass membership guard');
 const injected=await identities.memberA.client.rpc('operational_dashboard',{p_org:org,p_filters:{allOrganizations:true}});assert(injected.error?.code==='22023','Direct RPC rejects unknown filter controls');
 const cohort=await load(identities.memberA);
 const submissions=await identities.memberA.client.from('bid_submissions').select('bid_id,submitted_at').eq('organization_id',org).gte('submitted_at',cohort.cohort.from).lt('submitted_at',cohort.cohort.toExclusive).lte('submitted_at',cohort.asOf);
 const bids=await identities.memberA.client.from('bids').select('id').eq('organization_id',org);
 const bidIds=new Set(bids.data.map(b=>b.id));const submitted=new Set(submissions.data.filter(s=>bidIds.has(s.bid_id)).map(s=>s.bid_id));
 assert(cohort.counts.submitted===submitted.size,'Conversion denominator counts distinct immutable submitted bids, not submission events');
 const histories=await identities.memberA.client.from('bid_status_history').select('bid_id,to_status').eq('organization_id',org);
 const rounds=await identities.memberA.client.from('interviews').select('bid_id,scheduled_at').eq('organization_id',org);
 const invited=new Set([...histories.data.filter(h=>h.to_status==='interview_invited').map(h=>h.bid_id),...rounds.data.filter(i=>i.scheduled_at).map(i=>i.bid_id)].filter(id=>submitted.has(id)));
 assert(cohort.counts.interview_converted===invited.size&&invited.size>0,'Multiple rounds count once per submitted bid');
 const company='Synthetic Paging '+randomUUID();
 for(let n=0;n<27;n++){const body={operationId:randomUUID(),input:{...fixture.input,companyName:company,jobTitle:'Synthetic opportunity '+n}};const r=await call(identities.memberA,path('bids'),body,0,{'Idempotency-Key':body.operationId});assert(r.status===200,'Create distinct synthetic paging opportunity');}
 const q='&company='+encodeURIComponent(company);const first=await load(identities.memberA,q), second=await load(identities.memberA,q+'&page=2');
 assert(first.detail.total===27&&first.detail.items.length===25&&second.detail.items.length===2,'Totals include every page');
 assert(!second.detail.items.some(b=>first.detail.items.some(a=>a.id===b.id)),'Stable ordered pages have no duplicate rows');
 const teamFiltered=await load(identities.memberA,q+'&teamId='+team+'&ownerId='+identities.memberA.id+'&status=draft');assert(teamFiltered.counts.active_bids===27&&teamFiltered.workload.reduce((n,w)=>n+w.activeBids,0)===27,'All filters apply before workload aggregation');
 return {company,candidate:fixture.candidate};
}
