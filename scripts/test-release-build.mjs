// Fresh CI checkout only. Fictitious public endpoints; ALL external browser
// requests blocked. The resulting test ZIP is never published as production.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {launchExtension} from '../apps/web/scripts/test-extension-browser.mjs';
if(process.env.CI!=='true'||existsSync('apps/web/.env.local')||existsSync('apps/extension/.env.local'))throw Error('Requires fresh isolated CI checkout without local configuration.');
const release=JSON.parse(await readFile('releases/pilot.json','utf8')),identity=JSON.parse(await readFile('releases/extension-identity.json','utf8'));
const ref='abcdefghijklmnopqrst',env={...process.env,APPLICATION_ENV:'production',PRODUCTION_SUPABASE_PROJECT_REF:ref,NEXT_PUBLIC_APP_URL:'https://synthetic-pilot.example.com',NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_isolated_ci_no_live_project',EXTENSION_ALLOWED_ORIGIN:identity.origin,DOCUMENT_RENDER_KEY_ID:'synthetic-ci',DOCUMENT_RENDER_SIGNING_KEY:randomBytes(32).toString('hex'),SUPABASE_SERVICE_ROLE_KEY:'sb_secret_isolated_ci_'+randomBytes(16).toString('hex'),PILOT_DATA_MODE:'synthetic-only',FEASIBILITY_API_ENABLED:'false',NEXT_TELEMETRY_DISABLED:'1',EXTENSION_BUILD_PROFILE:'production',EXTENSION_PUBLIC_API_URL:'https://synthetic-pilot.example.com/api/v1',EXTENSION_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_isolated_ci_no_live_project'};
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{env,stdio:'inherit'});if(r.status!==0)throw Error('Clean release verification command failed.');};
run('npm',['run','production:check']);run('npm',['run','production:build']);run('npm',['run','extension:build']);run('npm',['run','release:extension']);
let scanned=0;
async function scan(folder){for(const e of await readdir(folder,{withFileTypes:true})){const path=folder+'/'+e.name;if(e.isDirectory())await scan(path);else{const b=await readFile(path);if([env.SUPABASE_SERVICE_ROLE_KEY,env.DOCUMENT_RENDER_SIGNING_KEY].some(s=>b.includes(Buffer.from(s))))throw Error('Server credential leaked into a client artifact.');scanned++;}}}
await scan('apps/web/.next/static');await scan('apps/extension/dist');
const folder='output/releases/'+release.release,zip=folder+`/applicationtracker-${release.release}.zip`,first=createHash('sha256').update(await readFile(zip)).digest('hex');
run('npm',['run','release:extension']);if(createHash('sha256').update(await readFile(zip)).digest('hex')!==first)throw Error('Same release inputs did not produce identical ZIP bytes.');
// Independent ZIP implementation checks CRC, path set, uncompressed bytes and
// every declared SHA-256, catching errors in our own ZIP writer.
run('python3',['scripts/verify-release.py',folder]);
const harness=await launchExtension();let checkpoints=0;
try{
 if(harness.origin!==identity.origin)throw Error('Chrome production identity differs from pinned public key.');checkpoints++;
 await harness.context.route('https://**/*',r=>r.abort());
 const page=await harness.context.newPage();await page.goto(harness.origin+'/workspace.html');await page.getByRole('heading',{name:'Extension sign-in',exact:true}).waitFor();checkpoints++;
 await page.evaluate(async()=>{const db=await new Promise((ok,fail)=>{const q=indexedDB.open('candidate-phase0',1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('records'))q.result.createObjectStore('records');};q.onsuccess=()=>ok(q.result);q.onerror=()=>fail(Error('IDB open failed'));});await new Promise((ok,fail)=>{const t=db.transaction('records','readwrite');t.objectStore('records').put({operationId:'synthetic-frozen-operation',actor:'synthetic-original-account',rawJson:'{invalid original',local:'failed',database:'pending'},'release-compatibility-marker');t.oncomplete=ok;t.onerror=fail;});db.close();});
 await harness.restart();if(harness.origin!==identity.origin)throw Error('Identity changed on restart');
 await harness.context.route('https://**/*',r=>r.abort());const reopened=await harness.context.newPage();await reopened.goto(harness.origin+'/workspace.html');await reopened.getByRole('heading',{name:'Extension sign-in',exact:true}).waitFor();
 const retained=await reopened.evaluate(async()=>{const db=await new Promise((ok,fail)=>{const q=indexedDB.open('candidate-phase0',1);q.onsuccess=()=>ok(q.result);q.onerror=fail;});const r=await new Promise((ok,fail)=>{const q=db.transaction('records').objectStore('records').get('release-compatibility-marker');q.onsuccess=()=>ok(q.result);q.onerror=fail;});db.close();return r;});
 if(retained?.rawJson!=='{invalid original'||retained?.database!=='pending'||retained?.actor!=='synthetic-original-account')throw Error('Frozen local marker changed across restart.');checkpoints++;
}finally{await harness.close();}
const result={result:'PASS',scope:'Fresh checkout npm ci, guarded production-mode web/extension build, deterministic ZIP and real Chrome stable-identity/restart; fictitious endpoints, no live service connectivity claim',release:release.release,extensionId:identity.extensionId,archiveSha256:first,browserCheckpoints:checkpoints,clientFilesScannedForServerCredentials:scanned,published:false};
await mkdir('output/clean-release',{recursive:true});await writeFile('output/clean-release/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
