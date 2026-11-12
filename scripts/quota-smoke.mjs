import { _electron as electron } from 'playwright'
const app = await electron.launch({
 executablePath: 'D:/IA LOCAL/elefante-src/node_modules/electron/dist/electron.exe',
 args: ['D:/IA LOCAL/scratch/quota-candidate-v2/app.asar', '--user-data-dir=D:/IA LOCAL/scratch/quota-qa-profile-v2'],
 env: {...process.env, ELEFANTE_DATA: 'D:/IA LOCAL/scratch/quota-qa-data'},
 timeout: 20000
})
try {
 const page = await app.firstWindow()
 await page.waitForLoadState('domcontentloaded')
 await page.locator('.onb, .status-bar').first().waitFor({timeout:60000})
 if (await page.locator('.onb').isVisible()) await page.locator('.onb__top button').click()
 await page.locator('.status-bar').waitFor({timeout:30000})
 await page.locator('.status-bar__item[aria-expanded]').first().click()
 await page.locator('.status-usage-popover').waitFor({timeout:10000})
 console.log((await page.locator('body').innerText()).slice(0,1000))
 await page.screenshot({path:'D:/IA LOCAL/scratch/quota-candidate-v2/qa.png'})
 console.log('PASS: interface e painel de uso carregados.')
 const { readCodexQuota } = await import('file:///D:/IA%20LOCAL/scratch/quota-candidate-v2/quota-probe.mjs')
 const { join } = await import('node:path')
 const { writeFileSync } = await import('node:fs')
 const quota = await readCodexQuota(join(process.env.APPDATA, 'npm/codex.cmd'), 'D:/IA LOCAL/Elefante/data/codex-home')
 const result = JSON.stringify({ quota, checkedAt: new Date().toISOString() }, null, 2)
 writeFileSync('D:/IA LOCAL/scratch/quota-candidate-v2/quota-result.json', result)
 console.log('Quota consultada na conta do Elefante:', result)
 console.log('A copia de teste permanecera aberta. Pressione Enter neste terminal para fechar.')
 process.stdin.resume()
 await new Promise(resolve => process.stdin.once('data', resolve))
 process.stdin.pause()
} finally { await app.close() }
