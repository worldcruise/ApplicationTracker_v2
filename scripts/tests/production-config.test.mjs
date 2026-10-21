import test from 'node:test';import assert from 'node:assert/strict';
import {productionConfig} from '../lib/production-config.mjs';
const ref='abcdefghijklmnopqrst', env={PRODUCTION_SUPABASE_PROJECT_REF:ref,NEXT_PUBLIC_APP_URL:'https://synthetic-pilot.example.com',NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',DOCUMENT_RENDER_SIGNING_KEY:'a'.repeat(64),DOCUMENT_RENDER_KEY_ID:'synthetic',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_synthetic',EXTENSION_ALLOWED_ORIGIN:'chrome-extension://'+'a'.repeat(32),PILOT_DATA_MODE:'synthetic-only'};
test('production rejects development fallback, public secrets, insecure origins and unapproved real-data mode',()=>{
 assert.equal(productionConfig(env).projectRef,ref);
 const publicOnly={...env,DOCUMENT_RENDER_SIGNING_KEY:undefined,DOCUMENT_RENDER_KEY_ID:undefined,SUPABASE_SERVICE_ROLE_KEY:undefined};
 assert.equal(productionConfig(publicOnly,false,false).projectRef,ref);assert.throws(()=>productionConfig(publicOnly));
 for(const patch of [{PRODUCTION_SUPABASE_PROJECT_REF:'xsyxlxpsglhkmvzlmhih'},{NEXT_PUBLIC_SUPABASE_URL:'https://xsyxlxpsglhkmvzlmhih.supabase.co'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'},{NEXT_PUBLIC_APP_URL:'http://localhost:3000'},{PILOT_DATA_MODE:'approved-production'},{FEASIBILITY_API_ENABLED:'true'}])assert.throws(()=>productionConfig({...env,...patch}));
 assert.throws(()=>productionConfig({},true));
 assert.throws(()=>productionConfig({...env,NEXT_PUBLIC_APP_URL:'synthetic-private-invalid-input'}),error=>!error.message.includes('synthetic-private-invalid-input'));
});
