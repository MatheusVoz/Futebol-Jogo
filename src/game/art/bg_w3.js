// =============================================================================
// art/bg_w3.js — Fundo do Mundo 3: CIDADE DOS RELÓGIOS QUEBRADOS.
//
// Céu vivo compartilhado (sky.js, preset 'w3' com sol/lua-relógio) + camadas
// pintadas POR HORÁRIO (paint(pc,w,h,tod)): 'day' (névoa lilás-pêssego),
// 'dusk' (silhuetas violeta com janelas âmbar), 'night' (petróleo/violeta
// profundo, muitas janelas e mostradores acesos).
//   1) relógio gigante rachado ao longe (falta um pedaço) — ponteiros animados
//      e enlouquecidos (minutos vai-e-volta, segundos para trás).
//   2) torres de relógio distantes (algumas tortas) + fragmentos de relógio
//      e algarismos flutuando à deriva, girando (quadros pré-renderizados).
//   3) viaduto + engrenagens-silhueta gigantes girando devagar (quadros).
//   4) prédios tortos/deformados com janelas, mostradores, chaminés com fumaça,
//      pontes suspensas entre eles; janelas piscando; revoada de pássaros.
//   5) telhados próximos escuros com luzes que cintilam e cata-vento de chave.
// front: névoa de poeira dourada + partículas douradas flutuando.
// =============================================================================
import { registerBackground } from '../registry.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { drawSky, skyPreset } from './sky.js';

const TAU = Math.PI * 2;
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const fr = (v) => ((v % 1) + 1) % 1;
const mod = (a, m) => ((a % m) + m) % m;
const wrap = (w, fn) => { fn(0); fn(-w); fn(w); };

// ------------------------------------------------------------------ paletas por horário
const PAL = {
  day: {
    ck: { face: '#f0d4d4', face2: '#e6c4cc', rim: '#c89cbc', rimHi: '#fbe8ec', ink: '#a684ac', crack: '#b493b4', hand: '#8a6a9c', handA: 0.75 },
    far: { body: '#c4a0bc', hi: '#d4b4c8', win: '#e8c8b8', winN: 0, face: '#f0dce0', faceA: 0 },
    gear: { body: '#a684ac', hi: '#bc9cc0', arch: '#9a7aa4', archHi: '#b090b8' },
    bld: { wall: ['#d8b4b4', '#c8a4b4', '#dcc0b0'], shade: '#a07c9c', dark: '#7a5a80', roof: ['#5e9090', '#b06a46', '#7a6a9c'], roofHi: '#9ac8b4', win: '#7a6898', lit: '#ffe4a8', litN: 0.08, out: '#6a4c74', face: '#f6e6d8', bridge: '#7a5a80' },
    near: { body: '#6a5084', hi: '#86689c', dk: '#584070', win: '#ffd890', winN: 0.15, fill: '#584070' },
    fragA: 0.8, haze: '#fff0c4', hazeA: 0.2, mote: '#fff6cc', smoke: '#f4e8ee', glow: 0.25,
  },
  dusk: {
    ck: { face: '#d48a8e', face2: '#c47a86', rim: '#9a4e74', rimHi: '#f0a8a0', ink: '#8a4470', crack: '#8e4a72', hand: '#5a2a5a', handA: 0.8 },
    far: { body: '#7e4466', hi: '#9a5674', win: '#ffb070', winN: 0.25, face: '#ffc8a0', faceA: 0.6 },
    gear: { body: '#5a2c54', hi: '#74406a', arch: '#4e2650', archHi: '#683a62' },
    bld: { wall: ['#5a3050', '#522a4a', '#62364e'], shade: '#3e1e3e', dark: '#2e1430', roof: ['#2e4a52', '#6a3030', '#3e2e5a'], roofHi: '#ff9a6a', win: '#2a1430', lit: '#ffb850', litN: 0.45, out: '#1e0e22', face: '#ffd6a0', bridge: '#2a1230' },
    near: { body: '#26162e', hi: '#3e2240', dk: '#1a0e22', win: '#ffb84f', winN: 0.4, fill: '#1a0e22' },
    fragA: 0.9, haze: '#ffc888', hazeA: 0.24, mote: '#ffe0a0', smoke: '#c08a9a', glow: 0.7,
  },
  night: {
    ck: { face: '#3a2e5c', face2: '#34284f', rim: '#5a4884', rimHi: '#8a78b8', ink: '#6e5ea0', crack: '#251c40', hand: '#c8b0f0', handA: 0.55 },
    far: { body: '#241c40', hi: '#30264e', win: '#ffb84f', winN: 0.35, face: '#ffe0a0', faceA: 0.85 },
    gear: { body: '#1c1634', hi: '#2a2248', arch: '#181230', archHi: '#241c40' },
    bld: { wall: ['#1e1830', '#1a142a', '#221a34'], shade: '#120e20', dark: '#0c0a16', roof: ['#16282e', '#2a1a22', '#1e1a34'], roofHi: '#5a5a9a', win: '#100c1c', lit: '#ffb84f', litN: 0.6, out: '#08060e', face: '#ffe6a8', bridge: '#0e0a18' },
    near: { body: '#0e0c1a', hi: '#1c1830', dk: '#08060e', win: '#ffb84f', winN: 0.55, fill: '#08060e' },
    fragA: 0.75, haze: '#d8b070', hazeA: 0.14, mote: '#ffd890', smoke: '#4a4060', glow: 1,
  },
};
let curTod = 'dusk';    // horário da última pintura (getters de fillBelow/alpha leem isto no bake)
let activeTod = 'dusk'; // horário da fase em jogo (atualizado por sky())
const todOf = (tod) => (PAL[tod] ? tod : 'dusk');

function sky(ctx, w, h, t, cam, level) {
  const p = skyPreset('w3', level);
  activeTod = todOf(p.tod);
  drawSky(ctx, w, h, t, cam, p);
}

// ------------------------------------------------------------------ helpers
const GL = { I: ['#', '#', '#', '#', '#'], V: ['#.#', '#.#', '#.#', '.#.', '.#.'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'] };
const NUMS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
function glyphW(txt) { let w = 0; for (const ch of txt) w += GL[ch][0].length + 1; return w - 1; }
function numeral(pc, txt, cx, cy, c) {
  let x = Math.round(cx - glyphW(txt) / 2);
  for (const ch of txt) { pc.ascii(GL[ch], { '#': c }, x, Math.round(cy - 2.5)); x += GL[ch][0].length + 1; }
}
/** Desenha um ponteiro grosso com fillRect (anim). */
function hand(ctx, cx, cy, a, len, wd, col, alpha = 1) {
  ctx.fillStyle = col; ctx.globalAlpha = alpha;
  const s = Math.sin(a), c = -Math.cos(a);
  for (let k = -Math.round(len * 0.12); k <= len; k++) ctx.fillRect(Math.round(cx + s * k - wd / 2), Math.round(cy + c * k - wd / 2), wd, wd);
  ctx.globalAlpha = 1;
}
/** x inicial das cópias de uma camada, igual a drawParallax. */
function layerX(L, cam, t) { return -Math.round(mod(cam.x * (L.speed ?? 0.5) + (L.drift || 0) * t, L.w)); }

// ------------------------------------------------------------------ sprites: fragmentos flutuantes (por horário)
const FRAG = {};
function rotFrames(src, n) { // gira por amostragem do vizinho mais próximo (pixel art nítido)
  const S = Math.ceil(Math.hypot(src.w, src.h)) + 1, c = S / 2, sc = src.w / 2, sr = src.h / 2;
  const out = [];
  for (let f = 0; f < n; f++) {
    const a = (f / n) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const pc = new PixelCanvas(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const sx = Math.floor(ca * dx + sa * dy + sc), sy = Math.floor(-sa * dx + ca * dy + sr);
      if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) { const v = src.buf[sy * src.w + sx]; if (v >>> 24) pc.buf[y * S + x] = v; }
    }
    pc.flush();
    out.push(pc);
  }
  return out;
}
function fragSprites(tod) {
  if (FRAG[tod]) return FRAG[tod];
  const P = PAL[tod];
  const night = tod === 'night';
  const brass = night ? ['#c89a5a', '#8a6a4a', '#5a4058'] : tod === 'dusk' ? ['#ffc87a', '#d08a4a', '#8a4a40'] : ['#ffe4a0', '#e0b070', '#b08070'];
  const cream = night ? '#8a7ab0' : tod === 'dusk' ? '#f4c0a0' : '#fff0dc';
  const ink = night ? '#3a2c5a' : tod === 'dusk' ? '#6a2a4a' : '#8a6a8a';
  const out = night ? '#120e22' : tod === 'dusk' ? '#3a1630' : '#7a5a7a';
  const mk = (w, h, fn) => { const pc = new PixelCanvas(w, h); fn(pc); pc.outline(out); pc.flush(); return pc; };
  const base = [];
  // estilhaço de mostrador com algarismo
  for (const txt of ['XII', 'IX', 'IV', 'VII']) base.push(mk(16, 14, (pc) => {
    pc.poly([[1, 2], [14, 1], [13, 9], [6, 12], [2, 8]], cream);
    pc.line(1, 2, 14, 1, brass[0]); pc.line(14, 1, 13, 9, brass[1]);
    numeral(pc, txt, 8, 6, ink); pc.px(4, 10, ink);
  }));
  // engrenagenzinha
  for (const r of [4, 6]) base.push(mk(r * 2 + 6, r * 2 + 6, (pc) => {
    const c = r + 3;
    for (let y = 0; y < c * 2; y++) for (let x = 0; x < c * 2; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      if (d <= r || (d <= r + 2 && fr((a * (r + 3)) / TAU) < 0.5)) pc.px(x, y, d < 2 ? brass[0] : d > r - 1.5 || -dx - dy > d * 0.6 ? brass[0] : brass[1]);
      if (d < r - 1.5 && d > 2.2) pc.px(x, y, brass[2]);
    }
  }));
  // ponteiro solto
  base.push(mk(5, 18, (pc) => { pc.vline(2, 4, 13, brass[1]); pc.tri(0, 5, 5, 5, 2.5, 0, brass[0]); pc.circle(2.5, 15, 2, brass[1]); pc.px(2, 15, ink); }));
  // algarismo solto grande (letras de latão)
  for (const txt of ['X', 'V', 'I']) base.push(mk(9, 11, (pc) => {
    const g = GL[txt];
    for (let j = 0; j < 5; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') pc.rect(1 + i * 2 + (txt === 'I' ? 2 : 0), j * 2, 2, 2, j < 2 ? brass[0] : brass[1]);
  }));
  FRAG[tod] = base.map((b) => rotFrames(b, 8));
  void P;
  return FRAG[tod];
}
/** Animação de fragmentos à deriva (subindo devagar, girando, balançando). */
function fragments(n, seed, speed, yMin, yMax, scaleMin) {
  const r = lrng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ u: r(), v: r(), k: r.int(0, 9), ph: r() * TAU, sp: 0.4 + r() * 0.8, rs: (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.8), vx: (r() - 0.5) * 6 });
  return (ctx, cam, t, w, h, y) => {
    const F = fragSprites(activeTod), A = PAL[activeTod].fragA;
    const span = w + 80;
    for (const p of pts) {
      if (p.k >= F.length) continue;
      const fr8 = F[p.k];
      const spr = fr8[mod(Math.floor(t * p.rs + p.ph * 3), 8)];
      let x = mod(p.u * span - cam.x * speed + t * p.vx, span) - 40;
      const band = yMax - yMin;
      const yy = y + yMax - mod(p.v * band + t * 2.2 * p.sp, band) + Math.sin(t * p.sp + p.ph) * 4;
      if (yy < -30 || yy > h + 10) continue;
      ctx.globalAlpha = A * (scaleMin ?? 1);
      ctx.drawImage(spr.canvas, Math.round(x - spr.w / 2), Math.round(yy - spr.h / 2));
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ sprites: engrenagens gigantes (por horário)
const GEARS = {};
function gearSil(r, teeth, F, body, hi, spokes) {
  const R = r + 4, S = R * 2 + 3, c = S / 2;
  const frames = [];
  for (let f = 0; f < F; f++) {
    const rot = (TAU / teeth) * (f / F);
    const pc = new PixelCanvas(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
      if (d > R) continue;
      const a = Math.atan2(dy, dx) - rot, lit = (-dx - dy) / (d || 1);
      let col = null;
      if (d > r) { const ta = fr((a * teeth) / TAU); if (ta < 0.46) col = lit > 0.55 && d > R - 1.5 ? hi : body; }
      else if (d > r - 5) col = lit > 0.5 && d > r - 1.5 ? hi : body;
      else if (d < r * 0.22) col = d < 3 ? hi : body;
      else if (d < r * 0.22 + 2) col = body;
      else { const sa = fr((a * spokes) / TAU); col = Math.min(sa, 1 - sa) * (TAU / spokes) * d < 2.6 + d * 0.04 ? body : null; }
      if (col) pc.px(x, y, col);
    }
    pc.flush();
    frames.push(pc);
  }
  return { frames, F, S };
}
function gearSet(tod) {
  if (GEARS[tod]) return GEARS[tod];
  const G = PAL[tod].gear;
  GEARS[tod] = { A: gearSil(46, 18, 10, G.body, G.hi, 6), B: gearSil(28, 11, 10, G.body, G.hi, 5), C: gearSil(36, 14, 10, G.body, G.hi, 4) };
  return GEARS[tod];
}

// ------------------------------------------------------------------ prédios tortos (camada 4)
const SPOTS4 = {};
const SPOTS2 = {};
function buildingsPaint(pc, w, h, tod) {
  const P = PAL[tod].bld;
  const r = lrng(3301);
  const spots = { smoke: [], clocks: [], flick: [], lanterns: [] };
  const list = [];
  let x = 6;
  while (x < w - 30) {
    const bw = r.int(44, 78), top = r.int(40, 130), lean = (r() - 0.5) * 0.16;
    list.push({ x, bw, top, lean, kind: r.int(0, 3), wi: r.int(0, 2), clock: r() < 0.35, seed: r.int(0, 1e6) });
    x += bw + r.int(14, 34);
  }
  const off = (b, yy) => Math.round((h - yy) * b.lean);
  // pontes suspensas (atrás dos prédios)
  for (let i = 0; i + 1 < list.length; i++) {
    const a = list[i], b = list[i + 1];
    const yb = Math.max(a.top, b.top) + 24 + r.int(0, 30);
    const x0 = a.x + a.bw - 2 + off(a, yb), x1 = b.x + 2 + off(b, yb);
    const sag = 6 + (x1 - x0) * 0.12;
    for (let xx = x0; xx <= x1; xx++) {
      const u = (xx - x0) / Math.max(1, x1 - x0), yy = Math.round(yb + Math.sin(u * Math.PI) * sag);
      pc.px(xx, yy - 6, P.bridge); // corda de cima
      pc.px(xx, yy, P.bridge); pc.px(xx, yy + 1, P.out);
      if ((xx - x0) % 4 === 0) pc.vline(xx, yy - 6, 6, P.bridge);
    }
    spots.lanterns.push([Math.round((x0 + x1) / 2), Math.round(yb + sag - 2)]);
  }
  for (const b of list) {
    const rb = lrng(b.seed);
    const wall = P.wall[b.wi];
    for (let yy = b.top; yy < h; yy++) {
      const o = off(b, yy), x0 = b.x + o;
      pc.hline(x0, yy, b.bw, wall);
      pc.px(x0, yy, P.out); pc.px(x0 + b.bw - 1, yy, P.out);
      pc.hline(x0 + b.bw - 5, yy, 4, P.shade);
      if (((yy - b.top) % 22) === 0) { pc.hline(x0 - 1, yy, b.bw + 2, P.out); pc.hline(x0, yy + 1, b.bw - 5, P.shade); }
    }
    // janelas (algumas acesas), em arco
    for (let fy = b.top + 6; fy < h - 10; fy += 22) {
      for (let fx = 6; fx < b.bw - 10; fx += 10) {
        if (rb() < 0.12) continue;
        const o = off(b, fy + 4), wx0 = b.x + fx + o;
        const lit = rb() < P.litN;
        const c = lit ? P.lit : P.win;
        pc.rect(wx0, fy + 1, 5, 8, c); pc.hline(wx0 + 1, fy, 3, c);
        pc.hline(wx0 - 1, fy + 9, 7, P.out);
        if (!lit) pc.px(wx0 + 1, fy + 2, P.shade); else { pc.vline(wx0 + 2, fy + 1, 8, P.wall[0] === '#d8b4b4' ? P.win : P.out); pc.hline(wx0, fy + 4, 5, P.out); if (rb() < 0.25) spots.flick.push([wx0, fy, rb() * 9]); }
        if (rb() < 0.08) { pc.line(wx0, fy + 1, wx0 + 4, fy + 8, P.out); pc.line(wx0 + 4, fy + 1, wx0, fy + 8, P.out); } // tábuas pregadas
      }
    }
    // rachaduras (prédios deformados)
    for (let k = 0; k < 2; k++) {
      let cx = b.x + rb.int(8, b.bw - 8) + off(b, b.top + 40), cy = b.top + rb.int(10, 80);
      for (let s = 0; s < 8; s++) { const nx = cx + rb.int(-2, 2), ny = cy + rb.int(2, 4); pc.line(cx, cy, nx, ny, P.out); cx = nx; cy = ny; }
    }
    // telhado
    const ot = off(b, b.top), tx0 = b.x + ot, roof = P.roof[b.kind % 3];
    if (b.kind === 0) { // mansarda com águas-furtadas
      pc.poly([[tx0 - 3, b.top + 1], [tx0 + b.bw + 3, b.top + 1], [tx0 + b.bw - 6, b.top - 14], [tx0 + 6, b.top - 14]], roof);
      pc.line(tx0 + 6, b.top - 14, tx0 + b.bw - 6, b.top - 14, P.roofHi); pc.line(tx0 - 3, b.top + 1, tx0 + 6, b.top - 14, P.roofHi);
      for (let dx = 12; dx < b.bw - 12; dx += 16) { pc.rect(tx0 + dx, b.top - 10, 6, 8, P.out); pc.rect(tx0 + dx + 1, b.top - 8, 4, 5, P.litN > 0.3 && rb() < 0.6 ? P.lit : P.win); }
    } else if (b.kind === 1) { // pináculo pontudo
      const cx = tx0 + b.bw / 2;
      pc.tri(tx0 - 2, b.top + 1, tx0 + b.bw + 2, b.top + 1, cx + b.lean * 60, b.top - 34, roof);
      pc.line(tx0 - 2, b.top, cx + b.lean * 60, b.top - 34, P.roofHi);
      pc.circle(cx + b.lean * 60, b.top - 36, 2, P.roofHi);
    } else if (b.kind === 2) { // cúpula de cebola
      const cx = tx0 + b.bw / 2;
      pc.rect(tx0 + 4, b.top - 6, b.bw - 8, 7, P.shade);
      pc.ellipse(cx, b.top - 14, b.bw * 0.32, 12, roof); pc.tri(cx - 6, b.top - 22, cx + 6, b.top - 22, cx, b.top - 34, roof);
      pc.ellipse(cx - 4, b.top - 18, 3, 5, P.roofHi); pc.vline(Math.round(cx), b.top - 40, 6, P.roofHi);
    } else { // plano com caixa d'água
      pc.hline(tx0 - 2, b.top, b.bw + 4, P.out);
      const wx0 = tx0 + rb.int(6, b.bw - 22);
      pc.rect(wx0, b.top - 16, 14, 11, roof); pc.hline(wx0, b.top - 16, 14, P.roofHi); pc.tri(wx0 - 1, b.top - 16, wx0 + 15, b.top - 16, wx0 + 7, b.top - 22, roof);
      pc.vline(wx0 + 2, b.top - 5, 5, P.out); pc.vline(wx0 + 11, b.top - 5, 5, P.out);
    }
    // chaminés
    const ncx = tx0 + (b.kind === 1 ? 6 : b.bw - 14);
    pc.rect(ncx, b.top - (b.kind === 0 ? 20 : 10), 5, 12, P.dark); pc.hline(ncx - 1, b.top - (b.kind === 0 ? 20 : 10), 7, P.out);
    spots.smoke.push([ncx + 2, b.top - (b.kind === 0 ? 22 : 12), rb() * 9]);
    // mostrador
    if (b.clock) {
      const cr = Math.min(10, Math.floor(b.bw / 5)), cy = b.top + 14, cx = b.x + Math.round(b.bw / 2) + off(b, cy);
      pc.circle(cx, cy, cr + 1.5, P.out); pc.circle(cx, cy, cr, P.face);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; pc.px(Math.round(cx + Math.sin(a) * (cr - 1.5) - 0.5), Math.round(cy - Math.cos(a) * (cr - 1.5) - 0.5), P.out); }
      spots.clocks.push([cx, cy, cr, rb() * 6, rb.int(0, 2)]);
    }
  }
  SPOTS4[tod] = spots;
}

// ------------------------------------------------------------------ camadas
const layers = [
  // 1) relógio gigante rachado ao longe
  {
    width: 900, height: 260, speed: 0.02, speedY: 0.02,
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod].ck;
      const cx = 330, cy = 112, R = 88;
      for (let y = cy - R - 2; y <= cy + R + 2; y++) for (let x = cx - R - 2; x <= cx + R + 2; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > R) continue;
        const a = Math.atan2(dy, dx);
        let c;
        if (d > R - 5) c = (-dx - dy) / d > 0.3 && d > R - 3 ? P.rimHi : P.rim;
        else if (d > R - 6) c = P.ink;
        else c = d / R + (((x * 7 + y * 13) & 15) / 40) > 0.88 ? P.face2 : P.face;
        if (d > 71 && d < 72.2) c = P.ink;
        if (d > 57 && d < 58) c = P.ink;
        if (d > 72 && d < 77) { const m = fr((a / TAU) * 60 + 0.25); if (m < 0.12) c = P.ink; }
        if (d < 9 && d > 7.5) c = P.ink;
        pc.px(x, y, c);
      }
      for (let k = 0; k < 60; k += 5) { const a = (k / 60) * TAU; for (let rr = 68; rr <= 77; rr++) { pc.px(Math.round(cx + Math.sin(a) * rr), Math.round(cy - Math.cos(a) * rr), P.ink); pc.px(Math.round(cx + Math.sin(a) * rr) + 1, Math.round(cy - Math.cos(a) * rr), P.ink); } }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; numeral(pc, NUMS[k], cx + Math.sin(a) * 64, cy - Math.cos(a) * 64, P.ink); }
      // pedaço que falta (céu aparece) + estilhaços soltos
      const a0 = 0.25, a1 = 0.62;
      for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > R + 1) continue;
        const a = Math.atan2(dy, dx) + Math.PI / 2; // 0 = 12h, sentido horário
        const jag = Math.sin(d * 0.55) * 0.05 + Math.sin(d * 1.7) * 0.02;
        if (a > a0 + jag && a < a1 - jag && d > 46 + Math.sin(a * 40) * 4) pc.erase(x, y);
        else if (a > a0 + jag - 0.02 && a < a1 - jag + 0.02 && d > 44 + Math.sin(a * 40) * 4 && d <= R) pc.px(x, y, P.crack);
      }
      const r = lrng(55);
      for (let i = 0; i < 5; i++) {
        const a = a0 + (a1 - a0) * r() - Math.PI / 2, d = R + 10 + r() * 30, sx = cx + Math.cos(a) * d, sy = cy + Math.sin(a) * d, s = r.int(3, 7);
        pc.poly([[sx, sy], [sx + s, sy + 1], [sx + s - 2, sy + s], [sx - 1, sy + s - 2]], P.face); pc.line(sx, sy, sx + s, sy + 1, P.rimHi);
      }
      // rachaduras
      const crack = (x0, y0, ang, len, depth) => {
        let x = x0, y = y0;
        for (let s = 0; s < len; s++) {
          const nx = x + Math.cos(ang) * 3 + (r() - 0.5) * 3, ny = y + Math.sin(ang) * 3 + (r() - 0.5) * 3;
          if (Math.hypot(nx - cx, ny - cy) > R - 1) break;
          pc.line(x, y, nx, ny, P.crack); pc.line(x + 1, y, nx + 1, ny, P.rimHi + '60');
          if (depth < 2 && r() < 0.18) crack(nx, ny, ang + (r() - 0.5) * 1.6, len / 2, depth + 1);
          x = nx; y = ny; ang += (r() - 0.5) * 0.5;
        }
      };
      crack(cx + 30, cy - 60, 2.2, 22, 0); crack(cx - 70, cy + 20, -0.3, 18, 0); crack(cx - 10, cy + 70, -1.9, 14, 0);
      // rosácea central
      pc.circle(cx, cy, 5, P.rim); pc.circle(cx, cy, 2.5, P.rimHi);
    },
    animate(ctx, cam, t, w, h, y) {
      const P = PAL[activeTod].ck;
      for (let x0 = layerX(this, cam, t); x0 < w; x0 += this.w) {
        const cx = x0 + 330, cy = y + 112;
        if (cx < -100 || cx > w + 100) continue;
        const hr = 2.1 + Math.sin(t * 0.13) * 0.05;
        const mn = 5.2 + Math.sin(t * 0.45) * 0.7 + Math.sin(t * 2.7) * 0.04 * (Math.sin(t * 0.3) > 0.5 ? 1 : 0);
        const sc = -t * 0.9 + Math.floor(t * 2) * 0.12;
        hand(ctx, cx, cy, hr, 40, 3, P.hand, P.handA);
        hand(ctx, cx, cy, mn, 60, 2, P.hand, P.handA);
        hand(ctx, cx, cy, sc, 70, 1, P.ink, P.handA);
        ctx.globalAlpha = P.handA; ctx.fillStyle = P.rimHi; ctx.fillRect(Math.round(cx - 1), Math.round(cy - 1), 3, 3); ctx.globalAlpha = 1;
      }
    },
  },
  // 2) torres de relógio distantes + fragmentos à deriva
  {
    width: 640, height: 200, speed: 0.05, speedY: 0.04, get fillBelow() { return PAL[curTod].far.body; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod].far;
      const r = lrng(2207);
      const spots = [];
      // casario de base
      for (let x = 0; x < w; x++) { const yb = Math.round(158 + Math.sin(x * 0.05) * 4 + Math.sin(x * 0.17) * 2 + (x % 23 < 11 ? -5 : 0)); pc.vline(x, yb, h - yb, P.body); }
      let x = 4;
      while (x < w - 10) {
        const tw = r.int(12, 26), th = r.int(50, 120), lean = (r() - 0.5) * 0.14, top = 165 - th;
        const o = (yy) => Math.round((165 - yy) * lean);
        wrap(w, (ow) => {
          const r = lrng(x * 31 + 7);
          for (let yy = top; yy < 166; yy++) { pc.hline(x + o(yy) + ow, yy, tw, P.body); pc.px(x + o(yy) + ow, yy, P.hi); }
          const tx = x + o(top) + ow, cxm = tx + tw / 2;
          const kind = (x * 7) % 3;
          if (kind === 0) pc.tri(tx - 2, top + 1, tx + tw + 2, top + 1, cxm, top - tw * 1.3, P.body);
          else if (kind === 1) { pc.ellipse(cxm, top - 3, tw / 2 + 1, 6, P.body); pc.vline(Math.round(cxm), top - 16, 8, P.body); }
          else { pc.rect(tx + 2, top - 8, tw - 4, 9, P.body); pc.tri(tx, top - 7, tx + tw, top - 7, cxm, top - 18, P.body); }
          // mostrador
          const cr = Math.max(3, Math.floor(tw / 2) - 3), cyy = top + cr + 4, cxx = Math.round(cxm + lean * -(cr + 4));
          pc.circle(cxx, cyy, cr + 1, P.hi);
          pc.circle(cxx, cyy, cr, P.faceA > 0 ? P.face : P.hi);
          if (ow === 0) spots.push([cxx, cyy, cr]);
          for (let k = 0; k < 6; k++) if (r() < P.winN) pc.rect(Math.round(tx + 3 + r() * (tw - 6)), Math.round(cyy + cr + 6 + r() * (th - cr * 2 - 14)), 1, 2, P.win);
        });
        x += tw + r.int(16, 48);
      }
      for (let i = 0; i < 120; i++) if (r() < P.winN) pc.px(r.int(0, w - 1), r.int(160, h - 6), P.win);
      SPOTS2[curTod] = spots;
    },
    animate(ctx, cam, t, w, h, y) {
      // mostradores distantes piscando de leve à noite
      const P = PAL[activeTod].far, sp = SPOTS2[activeTod];
      if (P.faceA > 0 && sp) {
        ctx.fillStyle = P.face;
        for (let x0 = layerX(this, cam, t); x0 < w; x0 += this.w) for (const [cx, cy, cr] of sp) {
          const sx = x0 + cx; if (sx < -20 || sx > w + 20) continue;
          ctx.globalAlpha = 0.18 * P.faceA * (0.6 + 0.4 * Math.sin(t * 1.3 + cx));
          ctx.fillRect(Math.round(sx - cr - 2), Math.round(y + cy - cr - 2), cr * 2 + 4, cr * 2 + 4);
        }
        ctx.globalAlpha = 1;
      }
      farFrags(ctx, cam, t, w, h, y);
    },
  },
  // 3) viaduto + engrenagens gigantes girando devagar
  {
    width: 720, height: 240, speed: 0.1, speedY: 0.07, get fillBelow() { return PAL[curTod].gear.arch; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod].gear;
      gearSet(curTod);
      const deck = 176;
      pc.rect(0, deck, w, h - deck, P.arch);
      pc.hline(0, deck, w, P.archHi); pc.hline(0, deck + 4, w, P.archHi);
      for (let x = 0; x < w; x += 48) {
        for (let y = deck + 12; y < h; y++) for (let xx = -15; xx <= 15; xx++) {
          const dy = y - (deck + 28);
          if (dy < 0 ? Math.hypot(xx, dy) < 15 : Math.abs(xx) < 15) pc.erase(mod(x + 24 + xx, w), y);
        }
        pc.vline(mod(x + 8, w), deck + 6, h - deck - 6, P.archHi);
      }
      // mastros que seguram os eixos
      for (const gx of [150, 268, 520]) { pc.rect(gx - 3, 120, 6, deck - 120, P.body); pc.vline(gx - 3, 120, deck - 120, P.hi); }
    },
    animate(ctx, cam, t, w, h, y) {
      const G = gearSet(activeTod);
      const draw = (g, lx, ly, p) => { const f = mod(Math.floor(p * g.F), g.F); ctx.drawImage(g.frames[f].canvas, Math.round(lx - g.S / 2), Math.round(ly - g.S / 2)); };
      const p = t * 0.22;
      for (let x0 = layerX(this, cam, t); x0 < w; x0 += this.w) {
        if (x0 + 150 + 60 > -60 && x0 + 150 - 60 < w + 60) draw(G.A, x0 + 150, y + 124, p);
        if (x0 + 268 + 40 > -40 && x0 + 268 - 40 < w + 40) draw(G.B, x0 + 150 + 79, y + 124 - 19, -p + 0.5);
        const pc = Math.floor(t * 0.5) + Math.min(1, fr(t * 0.5) * 3); // engrenagem que "tiqueteia"
        if (x0 + 520 + 50 > -50 && x0 + 520 - 50 < w + 50) draw(G.C, x0 + 520, y + 134, pc * 0.5);
      }
    },
  },
  // 4) prédios tortos com janelas, mostradores, chaminés e pontes suspensas
  {
    width: 800, height: 260, speed: 0.2, speedY: 0.12, get fillBelow() { return PAL[curTod].bld.shade; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod);
      buildingsPaint(pc, w, h, curTod);
    },
    animate(ctx, cam, t, w, h, y) {
      const Pall = PAL[activeTod], P = Pall.bld, sp = SPOTS4[activeTod];
      if (!sp) return;
      for (let x0 = layerX(this, cam, t); x0 < w; x0 += this.w) {
        // fumaça das chaminés
        ctx.fillStyle = Pall.smoke;
        for (const [sx, sy, ph] of sp.smoke) {
          const bx = x0 + sx; if (bx < -40 || bx > w + 40) continue;
          for (let i = 0; i < 5; i++) {
            const k = fr(t * 0.18 + ph + i / 5), rr = 1 + Math.round(k * 4);
            ctx.globalAlpha = (1 - k) * 0.55;
            ctx.fillRect(Math.round(bx + k * 16 + Math.sin(t + i + ph) * 2 - rr / 2), Math.round(y + sy - k * 34 - rr / 2), rr + 1, rr);
          }
        }
        ctx.globalAlpha = 1;
        // janelas piscando (alguém acende e apaga a luz)
        for (const [wx, wy, ph] of sp.flick) {
          const bx = x0 + wx; if (bx < -8 || bx > w + 8) continue;
          if (Math.sin(t * 0.7 + ph) > 0.55) { ctx.fillStyle = P.win; ctx.fillRect(bx, Math.round(y + wy + 1), 5, 8); }
        }
        // ponteiros dos mostradores
        for (const [cx, cy, cr, ph, mode] of sp.clocks) {
          const bx = x0 + cx; if (bx < -20 || bx > w + 20) continue;
          const m = mode === 0 ? t * 0.9 + ph : mode === 1 ? -t * 0.6 + ph : ph + Math.floor(t * 1.5) * 0.5;
          hand(ctx, bx + 0.5, y + cy + 0.5, m / 8 + ph, Math.max(2, cr - 5), 1, P.out);
          hand(ctx, bx + 0.5, y + cy + 0.5, m, cr - 2, 1, P.out);
        }
        // lanternas das pontes
        if (Pall.glow > 0.5) for (const [lx, ly] of sp.lanterns) {
          const bx = x0 + lx; if (bx < -8 || bx > w + 8) continue;
          ctx.fillStyle = P.lit; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3 + lx);
          ctx.fillRect(bx - 2, Math.round(y + ly - 2), 5, 5);
          ctx.globalAlpha = 1; ctx.fillRect(bx, Math.round(y + ly), 1, 2);
        }
      }
      flock(ctx, cam, t, w, h, y);
      midFrags(ctx, cam, t, w, h, y);
    },
  },
  // 5) telhados próximos escuros
  {
    width: 560, height: 150, speed: 0.34, speedY: 0.2, get fillBelow() { return PAL[curTod].near.fill; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod].near;
      const r = lrng(5511);
      const roofline = new Int16Array(w).fill(h);
      let x = 0;
      while (x < w) {
        const rw = r.int(30, 64), base = r.int(70, 104), kind = r.int(0, 2);
        for (let i = 0; i < rw && x + i < w; i++) {
          const u = i / rw;
          let yy = base;
          if (kind === 0) yy = base - Math.round((0.5 - Math.abs(u - 0.5)) * rw * 0.6);
          else if (kind === 1) yy = base - (u > 0.15 && u < 0.85 ? 10 : 0);
          roofline[x + i] = yy;
        }
        // chaminé + janelinha
        const cxp = x + r.int(4, rw - 10);
        if (cxp < w - 6) for (let i = 0; i < 5; i++) roofline[cxp + i] = Math.min(roofline[cxp + i], base - r.int(14, 22) + (i === 0 || i === 4 ? 2 : 0));
        x += rw;
      }
      for (let xx = 0; xx < w; xx++) { pc.vline(xx, roofline[xx], h - roofline[xx], P.body); pc.px(xx, roofline[xx], P.hi); }
      // cata-vento em forma de chave de dar corda
      const kx = 300, ky = Math.min(roofline[kx], roofline[kx + 1]);
      pc.vline(kx, ky - 26, 26, P.body); pc.ring(kx, ky - 32, 5, P.body); pc.ring(kx, ky - 32, 4, P.body); pc.ring(kx - 7, ky - 32, 3, P.body); pc.ring(kx + 7, ky - 32, 3, P.body);
      pc.hline(kx - 6, ky - 18, 13, P.body); pc.px(kx + 7, ky - 19, P.body); pc.px(kx - 6, ky - 17, P.body);
      // engrenagem no telhado
      const gx = 120, gy = roofline[gx] - 4;
      for (let yy = -16; yy <= 16; yy++) for (let xx = -16; xx <= 16; xx++) {
        const d = Math.hypot(xx, yy), a = Math.atan2(yy, xx);
        if (d < 12 || (d < 15 && fr((a * 10) / TAU) < 0.5)) if (!(d > 4 && d < 9 && fr((a * 4) / TAU) > 0.2)) pc.px(gx + xx, gy + yy, P.body);
      }
      // janelas de sótão
      for (let i = 0; i < 26; i++) {
        const wx = r.int(4, w - 8), wy = roofline[wx] + r.int(10, 40);
        if (wy > h - 6) continue;
        pc.rect(wx, wy, 3, 4, r() < P.winN ? P.win : P.dk);
      }
    },
    animate(ctx, cam, t, w, h, y) {
      const P = PAL[activeTod].near;
      if (P.winN < 0.3) return;
      ctx.fillStyle = P.win;
      const r = lrng(91);
      for (let x0 = layerX(this, cam, t); x0 < w; x0 += this.w) {
        for (let i = 0; i < 14; i++) {
          const lx = x0 + r() * this.w, ly = y + 60 + r() * 60, ph = r() * TAU;
          const a = 0.5 + 0.5 * Math.sin(t * (1 + (i % 3) * 0.6) + ph);
          if (a < 0.3 || lx < -4 || lx > w + 4) continue;
          ctx.globalAlpha = a; ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
          if (a > 0.85) { ctx.globalAlpha = (a - 0.85) * 4; ctx.fillRect(Math.round(lx) - 1, Math.round(ly), 3, 1); ctx.fillRect(Math.round(lx), Math.round(ly) - 1, 1, 3); }
        }
      }
      ctx.globalAlpha = 1;
    },
  },
];
const farFrags = fragments(10, 4401, 0.06, 20, 150, 0.55);
const midFrags = fragments(8, 4402, 0.22, 10, 150, 1);

// revoada de pássaros atravessando o céu de tempos em tempos
function flock(ctx, cam, t, w, h, y) {
  const cyc = 26, k = fr(t / cyc), s = k * cyc;
  if (s > 14) return;
  const P = PAL[activeTod].bld;
  ctx.fillStyle = P.out;
  ctx.globalAlpha = activeTod === 'day' ? 0.6 : 0.85;
  const bx = -30 + s * ((w + 80) / 14), by = y + 40 + Math.sin(s * 0.5) * 10;
  for (let i = 0; i < 7; i++) {
    const ox = bx - (i % 2 ? i * 6 : i * 4), oy = by + ((i * 37) % 13) - 6 + Math.sin(t * 3 + i) * 2;
    const flap = Math.floor(t * 8 + i) & 1;
    const X = Math.round(ox), Y = Math.round(oy);
    ctx.fillRect(X, Y, 1, 1);
    if (flap) { ctx.fillRect(X - 2, Y - 1, 2, 1); ctx.fillRect(X + 1, Y - 1, 2, 1); }
    else { ctx.fillRect(X - 2, Y + 1, 2, 1); ctx.fillRect(X + 1, Y + 1, 2, 1); }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ frente: poeira dourada
const motes = (() => { const r = lrng(808); const a = []; for (let i = 0; i < 28; i++) a.push({ u: r(), v: r(), ph: r() * TAU, sp: 0.4 + r() }); return a; })();
const front = [
  {
    width: 512, height: 130, speed: 1.15, speedY: 0.2, drift: 6, y: 46, get alpha() { return PAL[curTod].hazeA; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(909);
      for (let i = 0; i < 12; i++) {
        const cx = r.int(0, w), cy = r.int(40, h - 10), rx = r.int(40, 110), ry = r.int(8, 18);
        wrap(w, (o) => pc.dither(Math.round(cx + o - rx), Math.round(cy - ry), rx * 2, ry * 2, null, P.haze, (x, y) => {
          const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
          return d < 1 ? (1 - d) * 0.55 : 0;
        }));
      }
    },
    animate(ctx, cam, t, w, h) {
      const P = PAL[activeTod];
      ctx.fillStyle = P.mote;
      for (const m of motes) {
        const x = mod(m.u * (w + 20) - cam.x * 0.9 + Math.sin(t * 0.3 * m.sp + m.ph) * 18 + t * 4, w + 20) - 10;
        const yy = mod(m.v * (h + 20) - t * 5 * m.sp - cam.y * 0.3, h + 20) - 10;
        const a = 0.5 + 0.5 * Math.sin(t * 2.2 * m.sp + m.ph);
        if (a < 0.25) continue;
        ctx.globalAlpha = a * 0.8;
        ctx.fillRect(Math.round(x), Math.round(yy), 1, 1);
        if (a > 0.9) { ctx.globalAlpha = 0.35; ctx.fillRect(Math.round(x) - 1, Math.round(yy), 3, 1); ctx.fillRect(Math.round(x), Math.round(yy) - 1, 1, 3); }
      }
      ctx.globalAlpha = 1;
    },
  },
];

registerBackground('w3', { sky, layers, front, defaultTimeOfDay: 'dusk' });
