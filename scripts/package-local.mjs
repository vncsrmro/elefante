// Build a candidate without touching the installed app or user data.
import { createPackage, extractAll, extractFile, listPackage } from '@electron/asar'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { resolve, join, normalize } from 'node:path'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../', import.meta.url))
const destination = resolve(process.argv[2] || join(root, '../scratch/quota-candidate-v2'))
mkdirSync(destination, { recursive: true })
const stage = mkdtempSync(join(destination, 'stage-'))
const baseline = mkdtempSync(join(destination, 'baseline-'))
extractAll(join(root, '../scratch/elefante-before-quota.asar'), baseline)
cpSync(join(baseline, 'node_modules'), join(stage, 'node_modules'), { recursive: true })
cpSync(join(root, 'out'), join(stage, 'out'), { recursive: true })
cpSync(join(root, 'build'), join(stage, 'build'), { recursive: true })
cpSync(join(root, 'package.json'), join(stage, 'package.json'))
const requireFromStage = createRequire(join(stage, 'package.json'))
const manifest = JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8'))
for (const dependency of Object.keys(manifest.dependencies)) {
  // Font packages expose CSS rather than a Node entry point.
  if (dependency.startsWith('@fontsource')) continue
  requireFromStage.resolve(dependency === '@modelcontextprotocol/sdk' ? `${dependency}/client/index.js` : dependency)
}
// Loading the updater also checks its transitive runtime dependencies.
requireFromStage('electron-updater')
const archive = join(destination, 'app.asar')
await createPackage(stage, archive)
const entries = listPackage(archive).map(p => p.replaceAll('\\', '/'))
assert(entries.includes('/node_modules/electron-updater/package.json'), 'Missing updater dependency')
assert(!entries.some(p => p.startsWith('/out/out/')), 'Nested build directory')
for (const file of ['out/main/index.js', 'out/main/core.js', 'out/preload/index.cjs', 'out/renderer/index.html']) {
  assert(extractFile(archive, normalize(file)).equals(readFileSync(join(stage, file))), `Mismatch: ${file}`)
}
const html = extractFile(archive, normalize('out/renderer/index.html')).toString()
for (const [, asset] of html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+)"/g)) {
  assert(extractFile(archive, normalize(`out/renderer/${asset}`)).length > 0, `Missing ${asset}`)
}
console.log(`Verified candidate: ${archive}`)
