// Invoked after the real synthetic Auth/API/browser suite has populated the DB.
// This restores the backup; a fresh migration/reset alone is NOT recovery proof.
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {encryptBackup,openBackup,requiredBackupExtensions} from '../../../scripts/lib/backup.mjs';
export async function testRecovery({identities,assert}){
 if(process.env.CI!=='true')throw Error('Recovery rehearsal is isolated CI only.');
 const container='supabase_db_application-tracker-v2',target='atv2_restore_'+randomUUID().replaceAll('-',''),folder='output/recovery';
 let phase='source fingerprint';
 const diagnostic=message=>{const line=message.match(/ERROR:([^\n]*)/)?.[1]??'';return JSON.stringify({objects:[...line.matchAll(/"([a-zA-Z_][a-zA-Z0-9_.]*)"/g)].map(m=>m[1]),category:['permission denied','already exists','does not exist','must be owner','must be superuser'].find(s=>line.includes(s))??'other'});};
 await mkdir(folder,{recursive:true});
 const sql=(database,query)=>{const result=spawnSync('docker',['exec','-i',container,'psql','-X','-At','-U','postgres','-d',database,'--set=ON_ERROR_STOP=1'],{input:query,encoding:'utf8',maxBuffer:16*1024*1024});if(result.status!==0)throw Error('Recovery '+phase+' SQL failed '+diagnostic(result.stderr??'')+' (contents suppressed).');return result.stdout.trim();};
 const schemas=['public','private','auth','supabase_migrations','extensions'];
 // Compare every restored row, without exporting any row content into logs.
 function fingerprints(database){
  const tables=JSON.parse(sql(database,"select coalesce(json_agg(format('%I.%I',schemaname,tablename) order by schemaname,tablename),'[]') from pg_tables where schemaname in ('auth','public','private','supabase_migrations');"));
  const rows={};for(const table of tables)rows[table]=sql(database,`select count(*)||':'||md5(coalesce(string_agg(j::text,E'\\n' order by j::text),'')) from (select to_jsonb(t) j from ${table} t) s;`);
  const security=sql(database,"select md5(string_agg(v,E'\\n' order by v)) from (select n.nspname||'.'||c.relname||':'||pg_get_userbyid(c.relowner)||':'||c.relrowsecurity||':'||c.relforcerowsecurity||':'||coalesce(c.relacl::text,'') v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') union all select schemaname||'.'||tablename||':'||policyname||':'||coalesce(qual,'')||':'||coalesce(with_check,'')||':'||roles::text from pg_policies where schemaname in ('public','private') union all select n.nspname||'.'||p.proname||':'||pg_get_userbyid(p.proowner)||':'||p.prosecdef||':'||coalesce(p.proacl::text,'')||':'||coalesce(p.proconfig::text,'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')) s;");
  const extensions=JSON.parse(sql(database,"select coalesce(json_agg(json_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) order by e.extname),'[]') from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname in ('pgcrypto','pg_trgm');"));
  return {rows,security,extensions};
 }
 const started=Date.now(),key=randomBytes(32).toString('hex'),path=folder+'/synthetic-database.aes';
 const before=fingerprints('postgres');
 assert(requiredBackupExtensions.every(name=>before.extensions.some(e=>e.name===name&&e.schema==='extensions')),'Required extension packages are recorded before backup');
 phase='encrypted pg_dump';
 const child=spawn('docker',['exec',container,'pg_dump','-U','postgres','-d','postgres','--format=custom',...schemas.map(s=>'--schema='+s),...requiredBackupExtensions.map(name=>'--extension='+name)],{stdio:['ignore','pipe','ignore']});
 const exit=new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',c=>c===0?ok():fail(Error('Isolated pg_dump failed.')));});exit.catch(()=>{});
 const input=Readable.from((async function*(){for await(const b of child.stdout)yield b;await exit;})());
 const backup=await encryptBackup(input,path,key,{projectRef:'isolated-ci-only',createdAt:new Date().toISOString(),schemas,extensions:before.extensions,postgresMajor:17});
 const backupMs=Date.now()-started;
 phase='source quiescence';
 assert(JSON.stringify(before)===JSON.stringify(fingerprints('postgres')),'Source was quiescent across the backup snapshot');
 const frozen=await openBackup(path,key),restoreStarted=Date.now();
 try{
  phase='create isolated target';
  sql('postgres',`create database ${target} template template0;`);
  // template0 still supplies an empty public namespace, while this archive
  // explicitly recreates its original ownership/ACL. Never use CASCADE.
  sql(target,'drop schema public;');
  phase='restore archive';
  // Restoring managed Auth ownership needs the isolated maintenance superuser.
  // Supabase's limited migration role cannot SET ROLE supabase_admin. Never
  // grant those privileges to a production application/migration role.
  const p=spawn('docker',['exec','-i',container,'pg_restore','-U','supabase_admin','-d',target,'--single-transaction','--exit-on-error'],{stdio:['pipe','ignore','pipe']});
  let errorText='';p.stderr.on('data',b=>{if(errorText.length<8000)errorText+=b.toString();});
  const done=new Promise((ok,fail)=>{p.once('error',fail);p.once('exit',c=>c===0?ok():fail(Error('Isolated pg_restore failed '+diagnostic(errorText)+'; contents suppressed.')));});done.catch(()=>{});
  try{await frozen.pipeTo(p.stdin);await done;}catch(e){p.kill();throw e;}
 }finally{await frozen.close();}
 phase='restored fingerprints';
 const restoreMs=Date.now()-restoreStarted,after=fingerprints(target);
 assert(JSON.stringify(before)===JSON.stringify(after),'All Auth/app/private/migration rows, RLS policies, owners and grants match restored backup');
 const bytes=sql(target,"select count(*)||':'||coalesce(sum(octet_length(pdf_bytes)),0) from public.document_blobs;").split(':').map(Number);
 assert(bytes[0]>0&&bytes[1]>0,'Restored backup includes actual immutable PDF bytes');
 assert(sql(target,"select count(*) from public.document_blobs b join public.documents d on d.id=b.document_id where encode(sha256(b.pdf_bytes),'hex')<>d.pdf_sha256 or octet_length(b.pdf_bytes)<>d.byte_size;")==='0','Every restored PDF matches its immutable SHA-256 and byte count');
 assert(Number(sql(target,'select count(*) from private.document_render_keys;'))>0,'Restored backup includes private document verification keys');
 const scoped=(id,query)=>sql(target,`begin;set local role authenticated;select set_config('request.jwt.claims','${JSON.stringify({sub:id,role:'authenticated'})}',true);${query};rollback;`).split('\n').filter(v=>/^\d+$/.test(v)).at(-1);
 assert(Number(scoped(identities.adminA.id,'select count(*) from public.candidates'))>0,'Restored active administrator can read authorized candidate rows');
 assert(scoped(identities.bidderA.id,'select count(*) from public.candidates')==='0','Restored bidder cannot read unrestricted candidate profiles');
 assert(scoped(identities.bidderA.id,'select count(*) from public.interview_feedback')==='0','Restored bidder cannot read interview feedback');
 assert(scoped(randomUUID(),'select count(*) from public.candidates')==='0','Restored unrelated identity cannot read candidates');
 const restoredOrg=sql(target,`select organization_id from public.organization_memberships where user_id='${identities.adminA.id}' and role='admin' and state='active' limit 1;`);
 assert(Number(scoped(identities.adminA.id,`select (public.search_workflow('${restoredOrg}','bids','{"q":"synthetic"}')->>'total')::int`))>0,'Restored authenticated search executes with actual trigram/FTS dependencies and RLS');
 const report={result:'PASS',backupMs,restoreMs,verifiedTables:Object.keys(after.rows).length,storedPdfs:bytes[0],storedPdfBytes:bytes[1],encryptedSha256:backup.encryptedSha256,securityFingerprint:after.security,
  extensions:after.extensions,scope:'AES-256-GCM logical backup restored into empty separate database on isolated CI PostgreSQL 17 cluster; all rows, immutable PDF bytes, private keys, RLS, owners, grants and required extension versions/schemas verified',
  limitations:['Synthetic data volume; not pilot load or hosted RTO/RPO acceptance','Existing cluster roles reused; hosted global roles/platform Auth configuration and encryption root key recovery require operator rehearsal','No provider failover, SMTP, remote project reconfiguration or offsite credential recovery claimed']};
 await writeFile(folder+'/result.json',JSON.stringify(report,null,2)+'\n');
 // The ephemeral CI encryption key is deliberately not published. Only the
 // non-sensitive result is an artifact; hosted offsite keys need separate escrow.
 assert(!(await readFile(path)).includes(Buffer.from(key)),'Encryption key is absent from encrypted backup');
 assert(createHash('sha256').update(await readFile(path)).digest('hex')===backup.encryptedSha256,'Encrypted backup checksum verifies');
 console.log(JSON.stringify(report));
 // The entire isolated stack is destroyed by CI. Never drop a caller's database.
 return report;
}
