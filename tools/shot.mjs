// =============================================================================
// tools/shot.mjs — Screenshot/teste automatizado do jogo em Chromium headless.
//
//   node tools/shot.mjs --q "level=w1_1" --out .shots/w1_1.png
//        [--wait 800]            ms após o boot (jogo rodando em tempo real)
//        [--steps "right:60,right+jump:20,wait:30"]  entradas por quadros (modo determinístico)
//        [--eval "js"]           código executado na página antes do screenshot (pode usar __SW)
//        [--w 960 --h 540]       viewport   [--dist]  usa dist/ (build) em vez do código-fonte
//        [--frames 3 --every 20] várias capturas (out_0.png, out_1.png...) a cada N quadros
// Imprime erros do console e o resultado de --eval. Saída != 0 se houve erro JS.
// =============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import path from 'node:path';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);

const q = opt('q', '');
const out = opt('out', '.shots/shot.png');
const wait = +opt('wait', 600);
const steps = opt('steps', '');
const evalCode = opt('eval', '');
const W = +opt('w', 960), H = +opt('h', 540);
const frames = +opt('frames', 1), every = +opt('every', 30);
const root = path.resolve(flag('dist') ? 'dist' : '.');

fs.mkdirSync(path.dirname(out), { recursive: true });
const server = await startServer(0, root);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
let code = 0;
try {
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
  await page.waitForFunction(() => window.__SW && window.__SW.ready, null, { timeout: 30000 });
  await page.waitForTimeout(wait);
  if (steps) {
    await page.evaluate(() => window.__SW.pause());
    for (const s of steps.split(',')) {
      const [acts, n] = s.split(':');
      const count = +(n || 1);
      if (acts === 'wait') await page.evaluate((c) => window.__SW.step(c), count);
      else await page.evaluate(([a, c]) => window.__SW.press(a.split('+'), c), [acts, count]);
    }
  }
  if (evalCode) {
    const r = await page.evaluate(new Function('return (async () => {' + (evalCode.includes('return') ? evalCode : 'return ' + evalCode) + '})()'));
    console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r));
  }
  const canvas = await page.$('canvas#game');
  for (let i = 0; i < frames; i++) {
    if (i > 0) await page.evaluate((c) => { if (window.__SW.game.running) return new Promise((r) => setTimeout(r, c * 16.7)); window.__SW.step(c); }, every);
    const file = frames > 1 ? out.replace(/\.png$/, `_${i}.png`) : out;
    await canvas.screenshot({ path: file });
    console.log('saved', file);
  }
} catch (e) {
  errors.push('[shot] ' + e.message);
  code = 1;
}
const filtered = errors.filter((e) => !/favicon|AudioContext was not allowed/.test(e));
if (filtered.length) { console.log('--- console errors/warnings ---'); for (const e of filtered.slice(0, 40)) console.log(e); if (filtered.some((e) => e.includes('error'))) code = code || 2; }
await browser.close();
server.close();
process.exit(code);
