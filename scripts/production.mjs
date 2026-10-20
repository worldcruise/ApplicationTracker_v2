import {spawn} from 'node:child_process';
import {productionConfig} from './lib/production-config.mjs';
productionConfig(process.env);
if(!['build','start','check'].includes(process.argv[2]))throw Error('Use build, start or check.');
if(process.argv[2]==='check')console.log('Production environment isolation checks passed (no secrets printed).');
else {
 const args=process.argv[2]==='build'?['run','build:web']:['run','start','--workspace','@candidate/web','--','--hostname','0.0.0.0'];
 const child=spawn(process.platform==='win32'?'npm.cmd':'npm',args,{stdio:'inherit',shell:process.platform==='win32',env:process.env});
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
 child.on('exit',code=>{process.exitCode=code??1;});
}
