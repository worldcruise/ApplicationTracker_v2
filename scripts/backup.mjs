// Native PostgreSQL clients: no local Docker, passwords in environment only.
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {encryptBackup,inspectBackup,openBackup} from './lib/backup.mjs';
const action=process.argv[2],file=process.argv[3],key=process.env.BACKUP_ENCRYPTION_KEY;
const schemas=['auth','public','private','supabase_migrations','extensions'];
function client(command,args){const p=spawn(command,args,{env:process.env,stdio:['pipe','pipe','ignore']});const done=new Promise((ok,fail)=>{p.once('error',()=>fail(Error('Install PostgreSQL 17 client tools and check private PG* connection settings.')));p.once('exit',c=>c===0?ok():fail(Error('PostgreSQL command failed; review connection, permissions and target prerequisites without logging credentials.')));});return {p,done};}
async function query(sql){const {p,done}=client('psql',['-X','-At','--set=ON_ERROR_STOP=1']);let out='';p.stdout.on('data',b=>{out+=b;});p.stdin.end(sql);await done;return out.trim();}
try{
 if(action==='verify'){if(!file)throw Error('Specify the encrypted backup path.');const result=await inspectBackup(file,key);console.log(JSON.stringify({result:'verified',...result}));}
 else if(action==='create'){
  const ref=process.env.PRODUCTION_SUPABASE_PROJECT_REF;if(!/^[a-z]{20}$/.test(ref??'')||ref==='xsyxlxpsglhkmvzlmhih')throw Error('Specify the separate production reference.');
  if(process.env.PGSSLMODE!=='verify-full')throw Error('Hosted backups require PGSSLMODE=verify-full and a trusted PGSSLROOTCERT.');
  if(!process.env.PGHOST||!process.env.PGUSER?.includes(ref)||process.env.PGDATABASE!=='postgres')throw Error('PG* settings must explicitly identify the production session pooler and database.');
  if(!(await query('show server_version;')).startsWith('17.'))throw Error('Revalidate this backup recipe for the server major version.');
  const folder=resolve('backups');await mkdir(folder,{recursive:true,mode:0o700});const path=join(folder,`${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.aes`);
  const release=JSON.parse(await readFile('releases/pilot.json','utf8'));
  const {p,done}=client('pg_dump',['--format=custom','--no-password',...schemas.map(s=>'--schema='+s)]);
  // Observe process failure immediately, then ensure an unsuccessful dump cannot
  // be mistaken for a completed backup (the encryption input is destroyed).
  const observed=done.catch(e=>{p.stdout.destroy(e);throw e;});observed.catch(()=>{});
  const source=Readable.from((async function*(){for await(const chunk of p.stdout)yield chunk;await observed;})());
  try{const result=await encryptBackup(source,path,key,{projectRef:ref,createdAt:new Date().toISOString(),schemas,postgresMajor:17,release:release.release,scope:'logical database; provider settings and global roles require separate recovery'});console.log(JSON.stringify({result:'backup-created',path,...result}));}catch(e){p.kill();throw e;}
 }else if(action==='restore-empty'){
  if(!file||!/^atv2_restore_[a-z0-9_]+$/.test(process.env.PGDATABASE??''))throw Error('Restore only accepts an explicitly created, isolated atv2_restore_* database. It never clears a database.');
  const backup=await openBackup(file,key);
  try{
   const count=await query("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%' and c.relkind in ('r','p');");
   if(count!=='0')throw Error('Restore target contains user tables. Refusing to overwrite.');
   const {p,done}=client('pg_restore',['--single-transaction','--exit-on-error','--no-password','--dbname='+process.env.PGDATABASE]);p.stdout.resume();const observed=done;observed.catch(()=>{});
   try{await backup.pipeTo(p.stdin);await observed;}catch(e){p.kill();throw e;}
   console.log(JSON.stringify({result:'restored-into-empty-isolated-database',target:process.env.PGDATABASE,verify:'Run recovery fingerprint/RLS checks before serving any traffic.'}));
  }finally{await backup.close();}
 }else throw Error('Usage: node scripts/backup.mjs create | verify FILE | restore-empty FILE');
}catch(error){console.error(error.message);process.exitCode=1;}
