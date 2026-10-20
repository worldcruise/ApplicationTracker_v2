export const developmentProject = 'xsyxlxpsglhkmvzlmhih';
const need = (env, name) => { const v=env[name]?.trim(); if(!v) throw Error(`Missing ${name}.`); return v; };
export function publicKey(value) {
 if(value.startsWith('sb_publishable_')) return true;
 try { const p=JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString());return p.role==='anon'; } catch { return false; }
}
export function productionConfig(env,extension=false) {
 const ref=need(env,'PRODUCTION_SUPABASE_PROJECT_REF');
 if(!/^[a-z]{20}$/.test(ref)||ref===developmentProject)throw Error('Production must use a separate Supabase project reference.');
 const url=new URL(need(env,extension?'EXTENSION_PUBLIC_SUPABASE_URL':'NEXT_PUBLIC_SUPABASE_URL'));
 if(url.href!==`https://${ref}.supabase.co/`)throw Error('Production Supabase URL must match the approved production project.');
 const key=need(env,extension?'EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
 if(!publicKey(key))throw Error('Use only a Supabase publishable/anon public key.');
 const app=new URL(need(env,extension?'EXTENSION_PUBLIC_API_URL':'NEXT_PUBLIC_APP_URL'));
 if(app.protocol!=='https:'||app.username||app.password||app.search||app.hash||['localhost','127.0.0.1'].includes(app.hostname)||app.hostname.endsWith('.invalid'))throw Error('Configure the real HTTPS production application origin.');
 if(extension?app.pathname!=='/api/v1':!['','/'].includes(app.pathname))throw Error('Use the production origin, or /api/v1 for the extension.');
 if(!extension){
  if(env.FEASIBILITY_API_ENABLED==='true')throw Error('The feasibility probe must be disabled in production.');
  if(!/^chrome-extension:\/\/[a-p]{32}$/.test(need(env,'EXTENSION_ALLOWED_ORIGIN')))throw Error('Set the exact approved production extension origin.');
  if(!/^[a-f0-9]{64}$/.test(need(env,'DOCUMENT_RENDER_SIGNING_KEY')))throw Error('Configure the private document signing key.');
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(need(env,'DOCUMENT_RENDER_KEY_ID')))throw Error('Configure the registered document key ID.');
  const service=need(env,'SUPABASE_SERVICE_ROLE_KEY');
  if(publicKey(service))throw Error('Identity provisioning needs its server-only privileged key.');
  if(!['synthetic-only','approved-production'].includes(need(env,'PILOT_DATA_MODE')))throw Error('Set an explicit pilot data mode.');
  if(env.PILOT_DATA_MODE==='approved-production'&&!env.RETENTION_POLICY_APPROVAL_ID?.trim())throw Error('Real-data onboarding requires the recorded retention approval.');
 }
 return {projectRef:ref,supabaseUrl:url.origin,apiOrigin:app.origin,publishableKey:key};
}
