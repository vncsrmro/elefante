// Screenshots of the harnesses in the introduction (which ones the agents use,
// what each one's setup says, a test, the model pickers) and in Settings.
// New install, fake engines.
import { _electron as electron } from 'playwright'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const out = process.argv[2] ?? 'screens'
mkdirSync(out, { recursive: true })
const data = mkdtempSync(join(tmpdir(), 'elefante-'))
const app = await electron.launch({ args: ['.'], env: { ...process.env, ELEFANTE_DATA: data, ELEFANTE_FAKE_ENGINES: '1', ELEFANTE_SEED: '0' } })
const win = await app.firstWindow()
await win.setViewportSize({ width: 1360, height: 900 })
const errors = []
win.on('pageerror', (e) => errors.push(String(e)))
win.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const shot = (name) => win.screenshot({ path: `${out}/${name}.png` })
const settle = () => win.waitForTimeout(500)

await win.waitForSelector('.splash')
await win.click('.splash')
await win.waitForSelector('.onb')
await win.fill('.onb__field input', 'Marina')
await settle()
await shot('h1-boas-vindas')
await win.click('button:has-text("Começar")')
await win.waitForSelector('.harness')
await settle()
await shot('h2-harnesses')
await win.locator('.harness').nth(0).locator('button:has-text("Testar")').click()
await win.locator('.harness').nth(0).locator('.model-picker select').selectOption('sonnet')
await win.locator('.harness').nth(0).locator('button:has-text("Mandar teste")').click()
await win.locator('.harness').nth(0).locator('.note').waitFor({ timeout: 20000 })
await settle()
await shot('h3-harness-testado')
await win.click('button:has-text("Continuar")')
await settle()
await shot('h4-modelos-vazio')
const pick = (n) => win.locator('.onb-pick').nth(n).locator('.model-picker select')
await pick(0).nth(0).selectOption('codex')
await settle()
await shot('h5-modelos-codex')
await pick(1).nth(0).selectOption('opencode').catch(() => {})
await settle()
await shot('h6-modelos-opencode')
console.log('erros:', errors)
await app.close()
