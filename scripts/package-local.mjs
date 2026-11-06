// Build a candidate without touching the installed app or user data.
import { createPackage, extractFile, listPackage } from '@electron/asar'
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { resolve, join, normalize } from 'node:path'
import assert from 'node:assert/strict'

const destination = resolve(process.argv[2] || '../scratch/quota-candidate')
mkdirSync(destination, { recursive: true })
const stage = mkdtempSync(join(destination, 'stage-'))
cpSync(resolve('out'), join(stage, 'out'), { recursive: true })
cpSync(resolve('package.json'), join(stage, 'package.json'))
const archive = join(destination, 'app.asar')
await createPackage(stage, archive)
const entries = listPackage(archive).map(p => p.replaceAll('\\', '/'))
assert(!entries.some(p => p.startsWith('/out/out/')), 'Nested build directory')
for (const file of ['out/main/index.js', 'out/main/core.js', 'out/preload/index.cjs', 'out/renderer/index.html']) {
  assert(extractFile(archive, normalize(file)).equals(readFileSync(join(stage, file))), `Mismatch: ${file}`)
}
const html = extractFile(archive, normalize('out/renderer/index.html')).toString()
for (const [, asset] of html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+)"/g)) {
  assert(extractFile(archive, normalize(`out/renderer/${asset}`)).length > 0, `Missing ${asset}`)
}
console.log(`Verified candidate: ${archive}`)
