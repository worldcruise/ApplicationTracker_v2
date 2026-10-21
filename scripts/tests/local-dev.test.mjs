import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:net';
import {localSettings,selectLocalOrigin} from '../lib/local-dev.mjs';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://xsyxlxpsglhkmvzlmhih.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic'};
test('localhost startup keeps the existing project, rejects public secrets and validates an explicit port',()=>{
 assert.deepEqual(localSettings(env),{port:3000,explicitPort:false});
 assert.deepEqual(localSettings({...env,PORT:'3001'}),{port:3001,explicitPort:true});
 for(const patch of [{NEXT_PUBLIC_SUPABASE_URL:'https://other-project.supabase.co'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_private'},{PORT:'bad'},{PORT:'65536'},{PORT:'80'}])assert.throws(()=>localSettings({...env,...patch}));
});
test('a real occupied loopback port gets a consistent fallback origin; explicit ports never silently move',async()=>{
 const server=createServer();await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
 const port=server.address().port;
 try{
  const selected=await selectLocalOrigin({port});assert(selected.port>port);assert.equal(selected.origin,`http://localhost:${selected.port}`);
  await assert.rejects(selectLocalOrigin({port,explicitPort:true}),/already in use/);
 }finally{await new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));}
});
