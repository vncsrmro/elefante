import fs from 'node:fs'
import path from 'node:path'
import {extractFile} from '@electron/asar'
const a='../Elefante/resources/app.asar'
const html=extractFile(a,path.normalize('out/renderer/index.html')).toString()
if(!html.includes('rel="icon"'))throw Error('No favicon')
for(const [,p] of html.matchAll(/(?:href|src)="\.\/(assets\/[^"]+)"/g))extractFile(a,path.normalize('out/renderer/'+p))
for(const p of ['icon.png','icon.ico','tray.png'])extractFile(a,path.join('build',p))
const manual='../Elefante/Marca/manual.html'
for(const [,p] of fs.readFileSync(manual,'utf8').matchAll(/(?:href|src)="([^"]+)"/g))if(!fs.existsSync(path.resolve(path.dirname(manual),p)))throw Error('Missing manual asset '+p)
console.log('Installed favicon, fallback icons and manual assets verified')
