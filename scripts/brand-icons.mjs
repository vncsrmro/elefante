import {readFileSync,writeFileSync} from 'node:fs'
const sizes=[16,32,48,64,128,256]
const buffers=sizes.map(s=>readFileSync(new URL('../build/brand-'+s+'.png',import.meta.url)))
const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4)
let offset=header.length
sizes.forEach((s,i)=>{const p=6+i*16;header[p]=s===256?0:s;header[p+1]=header[p];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(buffers[i].length,p+8);header.writeUInt32LE(offset,p+12);offset+=buffers[i].length})
writeFileSync(new URL('../build/icon.ico',import.meta.url),Buffer.concat([header,...buffers]))
const png=readFileSync(new URL('../build/brand-512.png',import.meta.url));const h=Buffer.alloc(16);h.write('icns');h.writeUInt32BE(png.length+16,4);h.write('ic09',8);h.writeUInt32BE(png.length+8,12)
writeFileSync(new URL('../build/icon.icns',import.meta.url),Buffer.concat([h,png]))
writeFileSync(new URL('../build/elefante-lime.ico',import.meta.url),readFileSync(new URL('../build/icon.ico',import.meta.url)))
