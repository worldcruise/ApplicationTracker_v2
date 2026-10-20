import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable,Writable} from 'node:stream';import {randomBytes} from 'node:crypto';
import {encryptBackup,openBackup} from '../lib/backup.mjs';
test('encrypted backup authenticates bytes and metadata; wrong key and damage fail before restore',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'atv2-backup-')),path=join(dir,'test.aes'),key=randomBytes(32).toString('hex'),bytes=Buffer.concat([Buffer.from('synthetic-private-pdf-and-key'),randomBytes(150000)]);
 try{
  await encryptBackup(Readable.from(bytes),path,key,{projectRef:'synthetic-ci'});
  assert.equal((await readFile(path)).includes(Buffer.from('synthetic-private-pdf-and-key')),false);
  const opened=await openBackup(path,key);const chunks=[];await opened.pipeTo(new Writable({write(chunk,_e,done){chunks.push(chunk);done();}}));await opened.close();assert.deepEqual(Buffer.concat(chunks),bytes);
  await assert.rejects(openBackup(path,randomBytes(32).toString('hex')));
  const corrupt=await readFile(path);corrupt[30]^=1;await writeFile(join(dir,'bad.aes'),corrupt);await assert.rejects(openBackup(join(dir,'bad.aes'),key));
  await assert.rejects(encryptBackup(Readable.from(bytes),path,key,{}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
