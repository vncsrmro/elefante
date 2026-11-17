import {app,nativeImage} from 'electron';
import {writeFileSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await app.whenReady();
try { const source=nativeImage.createFromPath(root+'build/official-icon.png'); if(source.isEmpty())throw Error('Official icon missing');
for(const size of [16,32,48,64,128,256,512])writeFileSync(root+`build/brand-${size}.png`,source.resize({width:size,height:size,quality:'best'}).toPNG());
copyFileSync(root+'build/brand-512.png',root+'build/icon.png');copyFileSync(root+'build/brand-256.png',root+'src/renderer/src/assets/elefante-icon.png');copyFileSync(root+'build/brand-32.png',root+'build/tray.png');
await import('./brand-icons.mjs');
} finally {app.quit()}
