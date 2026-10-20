// ZIP32 stored entries: deterministic bytes, UTF-8 names, no external zip tool.
export function zipFiles(entries) {
 const local=[],central=[];let offset=0;
 const crc32=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const [name,data] of entries){if(name.startsWith('/')||name.split('/').some(p=>p==='..')||data.length>=0xffffffff)throw Error('Unsafe/oversized ZIP entry.');const n=Buffer.from(name),crc=crc32(data);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);h.copy(c,6,4,30);c.writeUInt32LE(offset,42);local.push(h,n,data);central.push(c,n);offset+=h.length+n.length+data.length;
 }
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,dir,end]);
}
