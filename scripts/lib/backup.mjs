import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {open,link,unlink} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Writable} from 'node:stream';

const magic=Buffer.from('ATV2BK01');
function keyBytes(key){if(!/^[a-f0-9]{64}$/i.test(key??''))throw Error('BACKUP_ENCRYPTION_KEY must be a private 32-byte hexadecimal key.');return Buffer.from(key,'hex');}
// pg_dump streams directly into authenticated encryption; no plaintext backup file.
export async function encryptBackup(input,path,key,metadata){
 const secret=keyBytes(key),iv=randomBytes(12),json=Buffer.from(JSON.stringify({...metadata,format:1,cipher:'aes-256-gcm'}));
 if(json.length>65536)throw Error('Backup metadata too large.');
 const len=Buffer.alloc(4);len.writeUInt32BE(json.length);const header=Buffer.concat([magic,len,json,iv]);
 const cipher=createCipheriv('aes-256-gcm',secret,iv);cipher.setAAD(header);
 const partial=path+'.partial';let created=false;
 try{
  const handle=await open(partial,'wx',0o600);created=true;await handle.writeFile(header);await handle.close();
  await pipeline(input,cipher,createWriteStream(partial,{flags:'a',mode:0o600}));
  const handle2=await open(partial,'a');await handle2.writeFile(cipher.getAuthTag());await handle2.sync();await handle2.close();
  // Hard link refuses an existing final path; never replace an earlier backup.
  await link(partial,path);await unlink(partial);created=false;
 }finally{secret.fill(0);if(created)await unlink(partial).catch(()=>{});}
 return inspectBackup(path,key);
}

// Authenticate the entire envelope before a caller starts a restore. The second
// pass uses the same open file descriptor and authenticated stream.
export async function openBackup(path,key){
 const secret=keyBytes(key),handle=await open(path,'r');
 try{
  const size=(await handle.stat()).size,prefix=Buffer.alloc(12);await handle.read(prefix,0,12,0);
  if(!prefix.subarray(0,8).equals(magic))throw Error('Unknown backup format.');
  const length=prefix.readUInt32BE(8),start=12+length+12,end=size-17;
  if(length>65536||end<start)throw Error('Incomplete backup envelope.');
  const header=Buffer.alloc(start);await handle.read(header,0,start,0);
  const metadata=JSON.parse(header.subarray(12,12+length).toString('utf8'));
  const tag=Buffer.alloc(16);await handle.read(tag,0,16,size-16);
  const stream=()=>{
   const d=createDecipheriv('aes-256-gcm',secret,header.subarray(start-12));d.setAAD(header);d.setAuthTag(tag);
   return {source:createReadStream(path,{fd:handle.fd,autoClose:false,start,end}),decipher:d};
  };
  const s=stream();await pipeline(s.source,s.decipher,new Writable({write(_chunk,_encoding,done){done();}}));
  return {metadata,async pipeTo(destination){const s=stream();await pipeline(s.source,s.decipher,destination);},async close(){secret.fill(0);await handle.close();}};
 }catch{secret.fill(0);await handle.close();throw Error('Backup authentication failed; no restore started.');}
}
export async function inspectBackup(path,key){
 const backup=await openBackup(path,key);try{
  const hash=createHash('sha256');await pipeline(createReadStream(path),hash);
  return {metadata:backup.metadata,encryptedSha256:hash.digest('hex')};
 }finally{await backup.close();}
}
