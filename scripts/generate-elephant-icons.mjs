import { app, BrowserWindow, nativeImage } from 'electron'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = 'D:\\IA LOCAL\\elefante-src'
const srcImgPath = 'C:\\Users\\vncs\\.gemini\\antigravity-cli\\brain\\f69bc7d6-ed95-48ca-a54e-f4834387bfc0\\elefante_app_icon_v3_1793566460288.jpg'
const b64 = readFileSync(srcImgPath).toString('base64')
const dataUri = `data:image/jpeg;base64,${b64}`

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <clipPath id="apple-squircle">
      <rect x="0" y="0" width="512" height="512" rx="114" ry="114" />
    </clipPath>
    <linearGradient id="glass-rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.50)" />
      <stop offset="35%" stop-color="rgba(56,189,248,0.28)" />
      <stop offset="70%" stop-color="rgba(139,92,246,0.24)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.10)" />
    </linearGradient>
  </defs>
  <g clip-path="url(#apple-squircle)">
    <image href="${dataUri}" x="-18" y="-18" width="548" height="548" preserveAspectRatio="xMidYMid slice" />
    <rect x="3" y="3" width="506" height="506" rx="112" ry="112" fill="none" stroke="url(#glass-rim)" stroke-width="6" />
  </g>
</svg>`

app.whenReady().then(async () => {
  const tmpHtml = join(rootDir, 'scripts', 'tmp-icon-render.html')
  writeFileSync(
    tmpHtml,
    `<!doctype html><html><head><style>*{margin:0;padding:0;background:transparent;overflow:hidden;}body{width:512px;height:512px;display:flex;align-items:center;justify-content:center;}</style></head><body>${svg512}</body></html>`
  )

  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })

  await win.loadFile(tmpHtml)
  await new Promise((r) => setTimeout(r, 500))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  const png512 = image.toPNG()

  const icon512Path = join(rootDir, 'build', 'icon.png')
  const icon256Path = join(rootDir, 'src', 'renderer', 'src', 'assets', 'elefante-icon.png')
  const tray32Path = join(rootDir, 'build', 'tray.png')

  writeFileSync(icon512Path, png512)
  const nImg = nativeImage.createFromBuffer(png512)
  writeFileSync(icon256Path, nImg.resize({ width: 256, height: 256, quality: 'best' }).toPNG())
  writeFileSync(tray32Path, nImg.resize({ width: 32, height: 32, quality: 'best' }).toPNG())

  win.destroy()
  try {
    unlinkSync(tmpHtml)
  } catch {}
  console.log('Generated all 3 icons successfully!')
  app.quit()
})
