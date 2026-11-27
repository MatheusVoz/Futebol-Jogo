// =============================================================================
// tools/validate_levels.mjs — Valida os mapas ASCII registrados.
//   node tools/validate_levels.mjs                 (todas as fases wN_*)
//   node tools/validate_levels.mjs w1_1 w1_2       (fases específicas)
//   node tools/validate_levels.mjs --all           (inclui test_*)
// Checa: linhas do mesmo tamanho, P e E presentes, 3 estrelas, caracteres
// desconhecidos, entidades não registradas, início dentro de parede, e faz uma
// busca de ALCANCE aproximada (pulo ≈ 4 tiles de altura e ~6 de distância;
// pulo duplo a partir do Mundo 2; molas J; ignora habilidades/entidades sólidas
// — então "inalcançável" quase sempre significa problema real, a menos que dependa
// de Costura/plataformas móveis, o que deve ser intencional).
// =============================================================================
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const all = args.includes('--all');
const ids = args.filter((a) => !a.startsWith('--'));

const server = await startServer(0, process.cwd());
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?level=test`);
await page.waitForFunction(() => window.__SW && window.__SW.ready, null, { timeout: 30000 });

const report = await page.evaluate(async ({ ids, all }) => {
  const { R } = window.__SW;
  const { GLOBAL_LEGEND } = await import('/src/game/legend.js');
  const { TILE_CHARS, T } = await import('/src/engine/tilemap.js');
  const out = [];
  const levels = [...R.levels.values()].filter((l) => (ids.length ? ids.includes(l.id) : all || /^w\d_/.test(l.id)));
  for (const L of levels) {
    const errs = [], warns = [];
    const rows = L.map || [];
    if (!rows.length) { out.push({ id: L.id, errs: ['sem mapa'], warns }); continue; }
    const W = Math.max(...rows.map((r) => r.length));
    rows.forEach((r, i) => { if (r.length !== W) errs.push(`linha ${i} tem ${r.length} colunas (esperado ${W})`); });
    const legend = { ...GLOBAL_LEGEND, ...(R.legends.get(L.world) || {}), ...(L.legend || {}) };
    const H = rows.length;
    const at = (x, y) => (y < 0 ? '.' : y >= H ? '.' : x < 0 || x >= W ? '#' : rows[y][x] || '.');
    let P = null, E = [], stars = [], unknown = new Map(), unreg = new Set(), springs = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (c === '.' || c === ' ' || TILE_CHARS[c] !== undefined) continue;
      if (c === 'P') { P = { x, y }; continue; }
      if (c === 'E') E.push({ x, y });
      if (c === '*') stars.push({ x, y });
      if (c === 'J') springs.push({ x, y });
      const ent = legend[c];
      if (!ent) { unknown.set(c, (unknown.get(c) || 0) + 1); continue; }
      const type = typeof ent === 'string' ? ent : ent.type;
      if (!R.entities.has(type)) unreg.add(type);
    }
    for (const o of L.objects || []) if (!R.entities.has(o.type)) unreg.add(o.type);
    if (!P) errs.push('sem P (início)');
    if (!E.length && !L.boss && !L.noExit) errs.push('sem E (saída) — use boss:true ou noExit:true se for intencional');
    if (/^w\d_[1-5]$/.test(L.id) && stars.length !== 3) errs.push(`${stars.length} estrelas (*) — devem ser 3`);
    for (const [c, n] of unknown) errs.push(`caractere desconhecido '${c}' (${n}x)`);
    for (const t of unreg) warns.push(`entidade ainda não registrada: ${t}`);
    if (!L.name) warns.push('sem name');
    if (!L.parTime && /^w\d_/.test(L.id)) warns.push('sem parTime');
    // ---- reachability BFS over standable cells
    const solid = (x, y) => { const c = at(x, y); return c === '#' || c === '%' || (x < 0 || x >= W); };
    const oneway = (x, y) => at(x, y) === '=';
    const water = (x, y) => at(x, y) === '~';
    const spike = (x, y) => at(x, y) === '^';
    const free = (x, y) => !solid(x, y) && !spike(x, y);
    const standable = (x, y) => free(x, y) && free(x, y - 1) && (solid(x, y + 1) || oneway(x, y + 1) || water(x, y) || springAt(x, y + 1));
    const springSet = new Set(springs.map((s) => s.x + ',' + s.y));
    const springAt = (x, y) => springSet.has(x + ',' + y);
    const dj = L.world >= 2 || L.doubleJump;
    const JH = dj ? 7 : 4, JD = dj ? 8 : 6;
    if (P) {
      var seen = new Set();
      const q = [];
      // drop P to ground
      let sy = P.y; while (sy < H && !standable(P.x, sy)) sy++;
      if (sy >= H) errs.push('P não está sobre chão');
      else { q.push([P.x, sy]); seen.add(P.x + ',' + sy); }
      const clearCol = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (!free(x, y) && !water(x, y)) return false; return true; };
      while (q.length) {
        const [x, y] = q.shift();
        const push = (nx, ny) => { const k = nx + ',' + ny; if (!seen.has(k) && nx >= 0 && nx < W && ny >= 0 && ny < H && standable(nx, ny)) { seen.add(k); q.push([nx, ny]); } };
        const inW = water(x, y);
        const jh = springAt(x, y + 1) ? 9 : inW ? 3 : JH;
        for (let dx = -JD; dx <= JD; dx++) {
          for (let dy = -jh; dy <= 12; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (!standable(nx, ny)) continue;
            // rough arc check: the apex column above start and the landing column must be clear
            const apex = Math.min(y, ny) - 1;
            if (!clearCol(x, y - 1, Math.max(0, apex))) continue;
            if (!clearCol(nx, Math.max(0, apex), ny - 1)) continue;
            // horizontal path at apex height
            let ok = true;
            const step = dx > 0 ? 1 : -1;
            for (let xx = x; xx !== nx; xx += step) if (!free(xx, Math.max(0, apex)) && !water(xx, Math.max(0, apex))) { ok = false; break; }
            if (!ok) continue;
            // falling far allows more horizontal distance; going up limits it
            if (dy < 0 && Math.abs(dx) > JD - Math.floor(-dy / 2)) continue;
            push(nx, ny);
          }
        }
      }
      const reach = (t) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (seen.has(t.x + dx + ',' + (t.y + dy))) return true; return false; };
      for (const e of E) if (!reach(e)) warns.push(`saída em ${e.x},${e.y} parece INALCANÇÁVEL sem habilidades/plataformas (confira)`);
      stars.forEach((s, i) => { if (!reach(s)) warns.push(`estrela ${i} em ${s.x},${s.y} parece inalcançável sem habilidades (ok se for intencional)`); });
    }
    out.push({ id: L.id, size: '', errs, warns:[], dump: rows.map((r,y)=>r.split('').map((c,x)=>(typeof seen!=='undefined'&&seen.has(x+','+y))?'+':c).join('')) });
  }
  return out;
}, { ids, all });

let bad = 0;
for (const r of report) {
  const status = r.errs.length ? 'ERRO' : r.warns.length ? 'aviso' : 'ok';
  if (r.errs.length) bad++;
  console.log(`${status.padEnd(5)} ${r.id} ${r.size || ''}`);
  for (const e of r.errs) console.log('   ✗ ' + e);
  for (const w of r.warns) console.log('   ! ' + w); if (r.dump) console.log(r.dump.map((l,i)=>String(i).padStart(3)+' '+l).join('\n'));
}
if (!report.length) console.log('nenhuma fase encontrada');
if (pageErrors.length) { console.log('--- erros da página ---'); pageErrors.slice(0, 20).forEach((e) => console.log(e)); }
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
