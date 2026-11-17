import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
const root=new URL('../',import.meta.url)
const read=p=>readFileSync(new URL(p,root))
for(const name of ['icon.png','icon.ico','icon.icns','tray.png'])assert(read('build/'+name).equals(read('docs/brand/assets/'+name)),`Outdated manual asset: ${name}`)
assert(read('build/icon.ico').equals(read('build/elefante-lime.ico')),'Windows icon differs')
for(const size of [16,32,48,64,128,256,512]){const p=read(`build/brand-${size}.png`);assert.equal(p.readUInt32BE(16),size);assert.equal(p.readUInt32BE(20),size)}
const ico=read('build/icon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),6)
const icns=read('build/icon.icns');assert.equal(icns.toString('ascii',0,4),'icns');assert.equal(icns.readUInt32BE(4),icns.length)
for(const p of ['build/elefante.svg','docs/brand/assets/elefante.svg'])assert(!existsSync(new URL(p,root)),`Legacy asset: ${p}`)
const pkg=JSON.parse(read('package.json'));assert.equal(pkg.build.mac.icon,'build/icon.icns');assert.equal(pkg.build.linux.icon,'build/icon.png');assert.equal(pkg.build.win.icon,'build/icon.ico')
console.log('Official icons: Windows, macOS, Linux and manual verified.')
