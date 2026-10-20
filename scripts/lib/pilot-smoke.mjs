import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
export async function pilotSmoke({supabaseUrl,publishableKey,appOrigin,email,password,organizationId,teamId}){
 const check=(ok,label)=>{if(!ok)throw Error(label);};let checks=0;
 const service=await fetch(supabaseUrl+'/auth/v1/settings',{headers:{apikey:publishableKey},cache:'no-store',signal:AbortSignal.timeout(15000)});
 check(service.ok,`Service connectivity failed: HTTP ${service.status}.`);await service.body?.cancel();checks++;
 const health=await fetch(appOrigin+'/healthz',{cache:'no-store',signal:AbortSignal.timeout(15000)});
 check(health.ok&&(await health.json()).apiContract==='v1','Application liveness failed; this is separate from database authentication.');checks++;
 const client=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(30000)})}});
 const login=await client.auth.signInWithPassword({email,password});check(!login.error&&login.data.user,'Synthetic authentication failed; verify account, network and Auth configuration.');checks++;
 const token=login.data.session.access_token;
 async function api(path,{method='GET',body,version,anonymous=false,clientVersion='extension/0.2.0'}={}){
  const r=await fetch(appOrigin+'/api/v1'+path,{method,cache:'no-store',signal:AbortSignal.timeout(30000),headers:{...(!anonymous?{Authorization:'Bearer '+token}:{}),'X-Candidate-Client':clientVersion,...(body?{'Content-Type':'application/json'}:{}),...(version!==undefined?{'If-Match':JSON.stringify(String(version))}:{})},...(body?{body:JSON.stringify(body)}:{})});
  check(/no-store/.test(r.headers.get('cache-control')??''),'Authenticated API lacks no-store.');const e=await r.json();return {status:r.status,...e};
 }
 let candidateId;
 try{
  const me=await api('/me');check(me.status===200&&me.data.userId===login.data.user.id&&me.data.organizations.some(o=>o.organizationId===organizationId),'Missing active organization membership or database migrations.');checks++;
  check((await api('/me',{anonymous:true})).status===401,'Anonymous API access was not denied.');checks++;
  check((await api('/me',{clientVersion:'extension/99.0.0'})).status===426,'Unsupported extension did not receive a non-destructive upgrade response.');checks++;
  const created=await api(`/organizations/${organizationId}/commands`,{method:'POST',body:{command:'createCandidate',teamId,ownerId:null,fullName:'Synthetic Pilot '+randomUUID().slice(0,8)}});
  check(created.status===200&&created.data.id,'Synthetic candidate creation failed: check team permissions, migration state and network.');candidateId=created.data.id;checks++;
  const path=`/candidates/${candidateId}?organizationId=${organizationId}`,read=await api(path);
  check(read.status===200&&read.data.fullName.startsWith('Synthetic Pilot '),'Saved synthetic profile did not persist on a fresh read.');checks++;
  const db=await client.from('candidates').select('id').eq('id',candidateId).single();check(!db.error&&db.data.id===candidateId,'Authenticated database/RLS read failed after API save.');checks++;
  const archived=await api(`/candidates/${candidateId}/archive?organizationId=${organizationId}`,{method:'POST',body:{archived:true},version:read.data.rowVersion});
  check(archived.status===200&&archived.data.status==='archived','Synthetic cleanup archive failed; retain candidate ID for operator follow-up.');checks++;
  const historical=await api(path);check(historical.status===200&&historical.data.status==='archived','Archived synthetic record/history did not persist.');checks++;
  return {result:'PASS',checks,candidateId,scope:'Service connectivity, real password Auth, membership, user-context API + DB persistence, compatibility denial and retained archive; no submission requested'};
 }catch(e){throw Error(e.message+(candidateId?' Synthetic candidate requiring review: '+candidateId:''));}
 finally{await client.auth.signOut({scope:'local'});}
}
