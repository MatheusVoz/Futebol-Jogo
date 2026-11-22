// =============================================================================
// tools/check.mjs — Teste de fumaça: abre cada fase registrada e cada cena,
// roda alguns segundos de simulação (com entradas aleatórias) e reporta erros.
//   node tools/check.mjs            (fases wN_* + cenas)
//   node tools/check.mjs w1_1 w2_3  (fases específicas)
//   node tools/check.mjs --scenes   (só cenas)
// =============================================================================
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const onlyScenes = args.includes('--scenes');
const ids = args.filter((a) => !a.startsWith('--'));
const server = await startServer(0, process.cwd());
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
let errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?level=test&god=1&unlock=all`);
await page.waitForFunction(() => window.__SW && window.__SW.ready, null, { timeout: 30000 });
await page.evaluate(() => window.__SW.pause());

const levelIds = onlyScenes ? [] : await page.evaluate((ids) => [...window.__SW.R.levels.keys()].filter((id) => (ids.length ? ids.includes(id) : /^w\d_/.test(id))).sort(), ids);
let failed = 0;
for (const id of levelIds) {
  errors = [];
  const res = await page.evaluate((id) => {
    const S = window.__SW;
    try {
      S.goLevel(id);
      const acts = ['right', 'right', 'right', 'jump', 'attack', 'left', 'dash', 'ability', 'right'];
      for (let i = 0; i < 30; i++) S.press([acts[i % acts.length], 'right'], 8);
      const L = S.level;
      return { ok: true, ents: L ? L.entities.length : -1, px: L ? Math.round(L.player.x) : 0 };
    } catch (e) { return { ok: false, err: String(e && e.stack || e) }; }
  }, id);
  const errs = errors.slice();
  if (!res.ok || errs.length) failed++;
  console.log(`${!res.ok || errs.length ? 'FALHA' : 'ok   '} ${id} ${res.ok ? `(${res.ents} entidades)` : res.err}`);
  for (const e of [...new Set(errs)].slice(0, 6)) console.log('   ' + e.slice(0, 300));
}
if (!ids.length) {
  const scenes = await page.evaluate(() => [...window.__SW.R.scenes.keys()]);
  for (const name of scenes) {
    if (name === 'cutscene') continue;
    errors = [];
    const res = await page.evaluate((name) => {
      const S = window.__SW;
      try {
        S.goLevel('test');
        const lvl = S.level;
        const sc = S.makeScene(name, lvl, lvl && lvl.computeResults ? { levelId: 'test', name: 'Teste', time: 50, par: 60, rating: 2, stars: [true, false, true], starsThisRun: [true, false, true], secretsFound: 0, secretsTotal: 1, buttons: 10, deaths: 0, boss: false, world: 1 } : undefined);
        if (!sc) return { ok: true, skipped: true };
        S.game.scenes.push(sc);
        for (let i = 0; i < 10; i++) S.press(['down'], 6);
        S.press(['back'], 3);
        S.step(30);
        return { ok: true };
      } catch (e) { return { ok: false, err: String(e && e.stack || e) }; }
    }, name);
    const errs = errors.slice();
    if (!res.ok || errs.length) failed++;
    console.log(`${!res.ok || errs.length ? 'FALHA' : 'ok   '} cena:${name} ${res.ok ? '' : res.err}`);
    for (const e of [...new Set(errs)].slice(0, 6)) console.log('   ' + e.slice(0, 300));
  }
}
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
