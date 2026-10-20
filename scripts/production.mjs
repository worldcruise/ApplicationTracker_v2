import {spawn} from 'node:child_process';
import {productionConfig} from './lib/production-config.mjs';
import {readFile} from 'node:fs/promises';
productionConfig(process.env);
const identity=JSON.parse(await readFile(new URL('../releases/extension-identity.json',import.meta.url),'utf8'));
if(process.env.EXTENSION_ALLOWED_ORIGIN!==identity.origin)throw Error('Production origin must match the pinned pilot extension identity.');
if(!['build','start','check'].includes(process.argv[2]))throw Error('Use build, start or check.');
if(process.argv[2]==='check')console.log('Production environment isolation checks passed (no secrets printed).');
else {
 const args=process.argv[2]==='build'?['run','build:web']:['run','start','--workspace','@candidate/web','--','--hostname','0.0.0.0'];
 const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{stdio:'inherit',shell:process.platform==='win32',env:process.env});
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>{process.exitCode=code??1;});
}
