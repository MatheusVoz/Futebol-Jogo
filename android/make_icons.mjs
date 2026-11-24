// android/make_icons.mjs — Gera os ícones do app (mipmaps) a partir do retrato do
// Tico desenhado pelo próprio jogo (art/portraits.js). Executado pelo build_apk.sh.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const outRes = path.resolve(process.argv[2] || 'android/build/res');
const server = await startServer(0, process.cwd());
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?level=test`);
await page.waitForFunction(() => window.__SW && window.__SW.ready, null, { timeout: 30000 });
const images = await page.evaluate(async (SIZES) => {
  const m = await import('/src/game/art/portraits.js');
  const base = document.createElement('canvas');
  base.width = 48; base.height = 48;
  const bctx = base.getContext('2d');
  m.drawPortrait(bctx, 'tico', 'happy', 0, 0, { t: 0.5 });
  const out = {};
  for (const [name, size] of Object.entries(SIZES)) {
    for (const round of [false, true]) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      if (round) { x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); x.clip(); }
      else {
        // rounded square
        const r = size * 0.18;
        x.beginPath();
        x.moveTo(r, 0); x.arcTo(size, 0, size, size, r); x.arcTo(size, size, 0, size, r); x.arcTo(0, size, 0, 0, r); x.arcTo(0, 0, size, 0, r);
        x.clip();
      }
      x.drawImage(base, 0, 0, 48, 48, 0, 0, size, size);
      out[`${name}${round ? '_round' : ''}`] = c.toDataURL('image/png');
    }
  }
  return out;
}, SIZES);
for (const [key, url] of Object.entries(images)) {
  const [dpi, round] = key.split('_');
  const dir = path.join(outRes, `mipmap-${dpi}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, round ? 'ic_launcher_round.png' : 'ic_launcher.png'), Buffer.from(url.split(',')[1], 'base64'));
}
console.log('icons ->', outRes);
await browser.close();
server.close();
