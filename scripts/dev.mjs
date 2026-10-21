import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
import {localSettings,selectLocalOrigin} from './lib/local-dev.mjs';

try{
 const root=fileURLToPath(new URL('../',import.meta.url));
 let local={};try{local=parseEnv(await readFile(new URL('../apps/web/.env.local',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Cannot read apps/web/.env.local.');}
 const settings=localSettings({...local,...process.env}),selected=await selectLocalOrigin(settings);
 console.log(`Local pilot: ${selected.origin}\nSign in: ${selected.origin}/sign-in\nHosted Supabase: xsyxlxpsglhkmvzlmhih (synthetic data only). Docker is optional.`);
 if(selected.port!==3000)console.log(`Port ${selected.port} selected. Add this exact origin's Auth redirect URLs in Supabase before testing recovery/invitations; see docs/LOCAL_PILOT.md.`);
 // Override the app origin for this process only. Fixed callbacks and cookie
 // mutation checks must agree with the actual selected loopback port.
 const env={...process.env,PORT:String(selected.port),NEXT_PUBLIC_APP_URL:selected.origin,NODE_ENV:'development'};
 // npm supplies its CLI path to scripts. Invoke it through Node directly so
 // Windows needs no shell concatenation (and no DEP0190 warning).
 const npmCli=process.env.npm_execpath;if(!npmCli)throw Error('Start the local pilot with npm run dev from the repository root.');
 const child=spawn(process.execPath,[npmCli,'run','dev:workspaces'],{cwd:root,env,stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
 child.once('error',()=>{console.error('Cannot start npm. Install the pinned Node/npm versions and run npm ci.');process.exitCode=1;});
 child.once('exit',code=>{process.exitCode=code??1;});
}catch(error){console.error(error.message);process.exitCode=1;}
