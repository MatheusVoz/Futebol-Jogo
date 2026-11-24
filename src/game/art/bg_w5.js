// =============================================================================
// art/bg_w5.js — Fundo do Mundo 5: O CORAÇÃO DA DIMENSÃO.
//
// sky(): céu compartilhado (art/sky.js, preset 'w5') conforme o horário da fase.
// Camadas pintadas POR HORÁRIO (paint(pc,w,h,tod)): 'day' (carmim/rosado claro),
// 'dusk' (magenta profundo, padrão do mundo) e 'night' (roxo quase negro, fios
// dourados brilhando mais). Paletas em PAL.
// layers (de trás p/ frente):
//   1) FENDA colossal no céu, costurada com suturas douradas (faíscas animadas);
//   2) fios dourados gigantes distantes + castelo-tear espinhoso flutuante;
//   3) ilhas à deriva com pedaços dos mundos anteriores (árvore de pompom,
//      concha/coral, torre de relógio, caminha com abajur) + PORTAIS girando;
//   4) fios gigantes próximos (pulsos de luz correndo por eles) + ruínas
//      flutuantes dos mundos 1–4;
//   5) emaranhado escuro próximo (carretéis quebrados, alfinetes) + brasas.
// front: névoa vermelha translúcida à deriva.
// Tudo contínuo na horizontal (elementos desenhados com "wrap").
// =============================================================================
import { registerBackground } from '../registry.js';
import { drawSky, skyPreset } from './sky.js';

const TAU = Math.PI * 2;
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const wrap = (w, fn) => { fn(0); fn(-w); fn(w); };
const _mx = new Map();
function mix(a, b, t) {
  const k = a + b + t;
  let v = _mx.get(k);
  if (v) return v;
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  v = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  _mx.set(k, v);
  return v;
}
function ridgeFill(pc, w, h, ridge, body, rim, rim2) {
  for (let x = 0; x < w; x++) {
    const y0 = Math.round(ridge(x));
    pc.vline(x, y0, h - y0, body);
    pc.px(x, y0, rim);
    if (rim2 && ridge(x - 1) > ridge(x)) pc.px(x, y0 + 1, rim2);
  }
}
/** Soft glow (dither com cor translúcida) em elipse. */
function glow(pc, cx, cy, rx, ry, c, k = 0.8) {
  pc.dither(Math.round(cx - rx), Math.round(cy - ry), Math.round(rx * 2), Math.round(ry * 2), null, c, (x, y) => {
    const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
    return d < 1 ? (1 - d) * k : 0;
  });
}

// ------------------------------------------------------------------ paletas por horário
const PAL = {
  day: {
    tint: '#d0506a', tintA: 0.22,
    riftGlow: '#ffb0c0', riftEdge: '#ff5a8a', riftMid: '#ffc0d8', riftCore: '#fffbe8', riftLip: '#5a1440', suture: '#ffd23f', sutureD: '#c8801a',
    farThread: ['#f0a070', '#c8705a'], farIsl: '#b04a6a', farIslR: '#ff9aa0',
    castle: '#7a2654', castleR: '#ff9a9a', castleD: '#5a1a40', win: '#fff0a0', loom: '#e0a060',
    abyss: '#9a3058', abyssR: '#e0707a', abyssR2: '#c05068', haze1: '#ffb0b0',
    isl: ['#7a2a5a', '#9a3a6a', '#56183e'], islR: '#ffb0b0', gold: '#ffd23f', goldD: '#c8801a',
    portal: '#2a0a2a', portalR: '#ffd23f',
    thread: ['#ffe070', '#ffc030', '#c87a18', '#5a2a10'], mid: ['#5a1a44', '#7a2656', '#3e0e30'], midR: '#ff8a90', midFill: '#4a1238',
    near: '#2e0a24', nearHi: '#6a1e48', nearGold: '#a86a20', haze: '#ff7a8a', hazeA: 0.2, ember: ['#ffd23f', '#fff0c0', '#ff9ab0'], emberN: 0.6,
  },
  dusk: {
    tint: '#8a1a4a', tintA: 0.32,
    riftGlow: '#ff6a9a', riftEdge: '#ff3f7a', riftMid: '#ffa0c8', riftCore: '#fff6d8', riftLip: '#2a0624', suture: '#ffd23f', sutureD: '#b0701a',
    farThread: ['#d88a4a', '#a05a3a'], farIsl: '#5a1842', farIslR: '#e06a7a',
    castle: '#3a0c30', castleR: '#e05a7a', castleD: '#260620', win: '#ffd060', loom: '#c8803a',
    abyss: '#4a0e36', abyssR: '#c0406a', abyssR2: '#8a2852', haze1: '#d0507a',
    isl: ['#4a1440', '#6a2056', '#2e0a28'], islR: '#ff7a8a', gold: '#ffc83a', goldD: '#a8681a',
    portal: '#160416', portalR: '#ffc83a',
    thread: ['#ffe070', '#f0b030', '#a86418', '#3e1a0c'], mid: ['#36102e', '#4e1842', '#22061c'], midR: '#e0507a', midFill: '#2a0822',
    near: '#180414', nearHi: '#4a1238', nearGold: '#8a5418', haze: '#e04a6a', hazeA: 0.24, ember: ['#ffd23f', '#ff7aa0', '#fff0c0'], emberN: 0.85,
  },
  night: {
    tint: '#2a0a3a', tintA: 0.5,
    riftGlow: '#c03aa0', riftEdge: '#ff3f9a', riftMid: '#ff9ad8', riftCore: '#fff0ff', riftLip: '#12020e', suture: '#ffd23f', sutureD: '#9a601a',
    farThread: ['#a8702e', '#6a4428'], farIsl: '#2a0a2e', farIslR: '#8a3a7a',
    castle: '#1a0620', castleR: '#7a2a7a', castleD: '#100414', win: '#ffc040', loom: '#a8702e',
    abyss: '#200822', abyssR: '#6a1e5a', abyssR2: '#4a1442', haze1: '#7a2a7a',
    isl: ['#260a2a', '#3a1240', '#160618'], islR: '#b04a9a', gold: '#ffd23f', goldD: '#8a5a1a',
    portal: '#08020a', portalR: '#ffd23f',
    thread: ['#fff090', '#ffd040', '#a87018', '#2a120a'], mid: ['#1e0822', '#2c0e32', '#120414'], midR: '#9a3a8a', midFill: '#160618',
    near: '#0a020c', nearHi: '#2a0c2c', nearGold: '#6a4214', haze: '#a03a8a', hazeA: 0.26, ember: ['#ffd23f', '#ff9ad8', '#fff6c0'], emberN: 1,
  },
};
let curTod = 'dusk';    // horário da última pintura (getters de fillBelow/alpha leem isto no bake)
let activeTod = 'dusk'; // horário da fase em jogo (atualizado por sky())
const todOf = (tod) => (PAL[tod] ? tod : 'dusk');
const tc = (P, c) => mix(c, P.tint, P.tintA); // pinta cores de outros mundos com a luz vermelha

function sky(ctx, w, h, t, cam, level) {
  const p = skyPreset('w5', level);
  activeTod = todOf(p.tod);
  drawSky(ctx, w, h, t, cam, p);
}

/** Posição na tela de uma coordenada x de camada (mesma conta da LevelScene.drawParallax). */
function layerXs(x, cam, t, L, w) {
  const base = -(((cam.x * L.speed + (L.drift || 0) * t) % L.width + L.width) % L.width);
  const out = [];
  for (let k = -1; k <= Math.ceil(w / L.width) + 1; k++) { const sx = base + x + k * L.width; if (sx > -60 && sx < w + 60) out.push(sx); }
  return out;
}

// ------------------------------------------------------------------ elementos
/** Ilha flutuante de tecido (cone irregular) com costura dourada e fios pendurados. */
function island(pc, cx, top, hw, depth, P, seed) {
  const r = lrng(seed);
  for (let dx = -hw; dx <= hw; dx++) {
    const t = dx / hw, x = cx + dx;
    const y0 = top + Math.round(Math.abs(t) ** 3 * 3);
    const d = Math.max(2, Math.round(depth * (1 - t * t) * (0.72 + 0.28 * Math.sin(dx * 0.7 + seed))));
    pc.vline(x, y0, d, t < -0.35 ? P.isl[1] : P.isl[0]);
    for (let k = Math.round(d * 0.6); k < d; k++) if ((k + dx) % 3 === 0 || k > d * 0.82) pc.px(x, y0 + k, P.isl[2]);
    pc.px(x, y0, P.islR); pc.px(x, y0 + 1, P.isl[1]);
    if (dx % 5 < 3 && Math.abs(t) < 0.9) pc.px(x, y0 + 3, P.gold);
  }
  for (let i = 0; i < 3; i++) {
    const hx = cx + r.int(-hw >> 1, hw >> 1), ly = top + Math.round(depth * 0.7), len = r.int(8, 22);
    pc.curve(hx, ly, hx + r.int(-5, 5), ly + len * 0.5, hx + r.int(-3, 3), ly + len, i ? P.goldD : P.gold, 0);
  }
}
const CHUNKS = {
  tree(pc, x, y, P) { // W1: árvore de pompom
    pc.rect(x - 2, y - 14, 4, 14, tc(P, '#5e4636')); pc.vline(x - 2, y - 14, 14, tc(P, '#86684c'));
    for (const [dx, dy, rr] of [[0, -20, 8], [-6, -16, 6], [6, -16, 6]]) pc.circle(x + dx, y + dy, rr, tc(P, '#2c6a36'));
    for (const [dx, dy, rr] of [[-2, -22, 5], [-7, -18, 3], [4, -18, 3]]) pc.circle(x + dx, y + dy, rr, tc(P, '#4e9a46'));
    pc.px(x - 4, y - 25, tc(P, '#9cd468'));
  },
  shell(pc, x, y, P) { // W2: concha + coral
    pc.ellipse(x, y - 6, 9, 6, tc(P, '#f2a0b0'));
    for (let i = 0; i < 6; i++) pc.line(x, y - 1, x - 8 + i * 3.2, y - 11, tc(P, '#c86a84'));
    pc.hline(x - 5, y - 10, 8, tc(P, '#ffe0e8'));
    pc.vline(x + 12, y - 14, 14, tc(P, '#ff7a6a')); pc.line(x + 12, y - 8, x + 16, y - 13, tc(P, '#ff7a6a')); pc.line(x + 12, y - 10, x + 8, y - 16, tc(P, '#ff9a8a'));
  },
  clock(pc, x, y, P) { // W3: torre de relógio torta
    pc.rect(x - 6, y - 26, 12, 26, tc(P, '#a87830')); pc.vline(x - 6, y - 26, 26, tc(P, '#e0b860'));
    pc.tri(x - 8, y - 26, x + 8, y - 26, x + 2, y - 36, tc(P, '#6a4418'));
    pc.circle(x, y - 18, 4, tc(P, '#fff0d0')); pc.ellipseOutline(x, y - 18, 4, 4, tc(P, '#5a3a14'));
    pc.line(x, y - 18, x, y - 21, '#2a1a0a'); pc.line(x, y - 18, x + 2, y - 17, '#2a1a0a');
    pc.rect(x + 4, y - 30, 3, 4, tc(P, '#a87830')); // pedaço solto
  },
  bed(pc, x, y, P) { // W4: caminha com abajur aceso
    pc.rect(x - 12, y - 7, 18, 5, tc(P, '#3e3270')); pc.hline(x - 12, y - 7, 18, tc(P, '#6a5aa8'));
    pc.rect(x - 14, y - 12, 3, 12, tc(P, '#5a3a2a')); pc.rect(x + 6, y - 9, 2, 9, tc(P, '#5a3a2a'));
    pc.rect(x - 11, y - 9, 5, 2, tc(P, '#e8e0f0'));
    pc.vline(x + 13, y - 12, 12, tc(P, '#8a6a4a')); pc.tri(x + 9, y - 12, x + 17, y - 12, x + 13, y - 18, '#ffd860');
    glow(pc, x + 13, y - 12, 12, 9, '#ffe06044', 0.9);
  },
  arch(pc, x, y, P) { // ruína: arco quebrado de tecido costurado
    pc.rect(x - 12, y - 22, 5, 22, P.isl[1]); pc.rect(x + 7, y - 14, 5, 14, P.isl[1]);
    pc.curve(x - 10, y - 22, x, y - 34, x + 9, y - 16, P.isl[1], 1.5);
    pc.vline(x - 12, y - 22, 22, P.islR);
    for (let k = 0; k < 20; k += 4) pc.px(x - 10, y - 20 + k, P.gold);
  },
};

// ------------------------------------------------------------------ geometria compartilhada (paint + animate)
const RIFT = { x: 170, y0: 6, y1: 200 };
const riftCX = (y) => RIFT.x + 12 * Math.sin(y * 0.04) + 7 * (Math.abs(((y / 22) % 2) - 1) * 2 - 1);
const riftW = (y) => { const t = (y - RIFT.y0) / (RIFT.y1 - RIFT.y0); return t <= 0 || t >= 1 ? 0 : 17 * Math.pow(Math.sin(Math.PI * t), 1.1) * (0.8 + 0.2 * Math.sin(y * 0.6)); };
const PORTALS = [[120, 52, 12], [430, 90, 9]];
const MID_THREADS = [[40, 0, 250, 300, 3], [330, 0, 180, 300, 2], [470, 0, 560, 300, 2], [600, -10, 380, 300, 3]];

// ------------------------------------------------------------------ animações
function riftSparks() {
  return (ctx, cam, t, w, h, y) => {
    const L = layers[0], P = PAL[activeTod];
    for (const sx of layerXs(0, cam, t, L, w)) {
      for (let i = 0; i < 16; i++) {
        const k = (t * 0.25 + i * 0.0625) % 1, yy = RIFT.y0 + 20 + ((i * 37) % 130);
        const side = i & 1 ? 1 : -1, ww = riftW(yy);
        const x = sx + riftCX(yy) + side * (ww + k * 40 + Math.sin(t + i) * 3);
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.fillStyle = i % 3 ? P.riftMid : P.suture;
        ctx.fillRect(Math.round(x), Math.round(y + yy - k * 12), 1, 1);
      }
      // pulso de luz descendo pelo núcleo
      const py = RIFT.y0 + ((t * 40) % (RIFT.y1 - RIFT.y0));
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(sx + riftCX(py)), Math.round(y + py), 1, 4);
    }
    ctx.globalAlpha = 1;
  };
}
function portalSwirl() {
  return (ctx, cam, t, w, h, y) => {
    const L = layers[2], P = PAL[activeTod];
    for (const [px, py, pr] of PORTALS) for (const sx of layerXs(px, cam, t, L, w)) {
      for (let arm = 0; arm < 3; arm++) for (let k = 1; k < 11; k++) {
        const a = -t * 1.8 + arm * 2.094 + k * 0.55, rr = (k / 10) * (pr - 2);
        ctx.globalAlpha = 0.4 + 0.6 * (1 - k / 11);
        ctx.fillStyle = k < 4 ? '#fff0f8' : arm === 0 ? P.portalR : P.riftEdge;
        ctx.fillRect(Math.round(sx + Math.cos(a) * rr), Math.round(y + py + Math.sin(a) * rr * 0.8), 1, 1);
      }
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3 + px);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(sx) - 1, Math.round(y + py) - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  };
}
function threadPulses() {
  return (ctx, cam, t, w, h, y) => {
    const L = layers[3], P = PAL[activeTod];
    MID_THREADS.forEach(([x0, y0, x1, y1], i) => {
      for (let j = 0; j < 2; j++) {
        const k = (t * 0.12 + i * 0.29 + j * 0.5) % 1;
        const lx = x0 + (x1 - x0) * k, ly = y0 + (y1 - y0) * k;
        for (const sx of layerXs(lx, cam, t, L, w)) {
          ctx.globalAlpha = 0.35; ctx.fillStyle = P.thread[0];
          ctx.fillRect(Math.round(sx) - 3, Math.round(y + ly) - 3, 7, 7);
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#fffbe0';
          ctx.fillRect(Math.round(sx) - 1, Math.round(y + ly) - 1, 3, 3);
        }
      }
    });
    ctx.globalAlpha = 1;
  };
}
function embers(n, seed, speed) {
  const r = lrng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ u: r(), v: r(), ph: r() * TAU, sp: 0.5 + r(), i });
  return (ctx, cam, t, w, h, y) => {
    const P = PAL[activeTod], lim = Math.ceil(n * P.emberN), span = w + 40;
    for (const p of pts) {
      if (p.i >= lim) continue;
      const k = (t * 0.08 * p.sp + p.v) % 1;
      let x = (p.u * span - cam.x * speed + Math.sin(t * 0.9 * p.sp + p.ph) * 10) % span;
      if (x < 0) x += span;
      const yy = Math.round(h - k * (h + 20));
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.5) * (0.6 + 0.4 * Math.sin(t * 4 + p.ph));
      ctx.fillStyle = P.ember[p.i % P.ember.length];
      ctx.fillRect(Math.round(x - 20), yy, 1, 1);
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ camadas
const layers = [
  // 1) fenda colossal costurada no céu + ilhotas muito distantes
  {
    width: 640, height: 240, speed: 0.03, speedY: 0.02,
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      // ilhotas distantes (silhuetas)
      const r = lrng(12);
      for (let i = 0; i < 7; i++) {
        const cx = r.int(0, w), cy = r.int(120, 200), hw = r.int(6, 16);
        wrap(w, (o) => { for (let dx = -hw; dx <= hw; dx++) { const d = Math.round((hw - Math.abs(dx)) * 0.9); pc.vline(cx + o + dx, cy, d, P.farIsl); } pc.hline(cx + o - hw, cy, hw * 2 + 1, P.farIslR); });
      }
      wrap(w, (o) => {
        glow(pc, RIFT.x + o, (RIFT.y0 + RIFT.y1) / 2, 70, 110, P.riftGlow + '50', 0.9);
        glow(pc, RIFT.x + o, (RIFT.y0 + RIFT.y1) / 2, 40, 90, P.riftGlow + '60', 0.9);
        for (let y = RIFT.y0; y < RIFT.y1; y++) {
          const cx = riftCX(y) + o, ww = riftW(y);
          if (ww < 0.5) continue;
          const jag = Math.round(Math.sin(y * 1.3) * 1.2);
          const x0 = Math.round(cx - ww - 2 + jag), x1 = Math.round(cx + ww + 2 - jag);
          pc.hline(x0, y, x1 - x0 + 1, P.riftLip);
          pc.hline(x0 + 2, y, x1 - x0 - 3, P.riftEdge);
          const m = ww * 0.65; pc.hline(Math.round(cx - m), y, Math.round(m * 2) + 1, P.riftMid);
          const c = ww * 0.28; pc.hline(Math.round(cx - c), y, Math.round(c * 2) + 1, P.riftCore);
          // fiapos de tecido rasgado nas bordas
          if (y % 5 === 0) { pc.px(x0 - 1, y + 1, P.riftLip); pc.px(x0 - 2, y + 2, P.riftLip); pc.px(x1 + 1, y - 1, P.riftLip); }
        }
        // suturas douradas tentando segurar a fenda (algumas arrebentadas)
        for (let y = RIFT.y0 + 14, i = 0; y < RIFT.y1 - 10; y += 13, i++) {
          const cx = riftCX(y) + o, ww = riftW(y) + 5;
          if (i % 4 === 2) { pc.line(cx - ww, y, cx - ww * 0.3, y + 4, P.suture); pc.line(cx + ww, y + 3, cx + ww * 0.5, y + 9, P.sutureD); continue; }
          pc.line(cx - ww, y, cx + ww, y + 3, P.sutureD); pc.line(cx - ww, y - 1, cx + ww, y + 2, P.suture);
          pc.px(Math.round(cx - ww) - 1, y - 1, P.riftLip); pc.px(Math.round(cx + ww) + 1, y + 2, P.riftLip);
        }
      });
    },
    animate: riftSparks(),
  },
  // 2) fios gigantes distantes + castelo-tear espinhoso flutuante
  {
    width: 560, height: 260, speed: 0.07, speedY: 0.04, get fillBelow() { return PAL[curTod].abyss; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      // fios distantes cruzando o céu
      for (const [x0, x1, c] of [[20, 200, 0], [300, 120, 1], [380, 520, 0], [500, 640, 1]]) wrap(w, (o) => { pc.line(x0 + o, 0, x1 + o, h, P.farThread[c]); pc.line(x0 + o + 1, 0, x1 + o + 1, h, P.farThread[1]); });
      // castelo-tear sobre rocha flutuante
      const cx = 360, base = 170;
      wrap(w, (o) => {
        const X = cx + o, C = P.castle, R = P.castleR, D = P.castleD;
        for (let dx = -70; dx <= 70; dx++) { const t = dx / 70, d = Math.round(50 * (1 - t * t) * (0.7 + 0.3 * Math.sin(dx * 0.5))); pc.vline(X + dx, base, d, dx < -30 ? mix(C, R, 0.15) : C); if (dx % 4 === 0) pc.px(X + dx, base + d, D); }
        pc.hline(X - 70, base, 141, R);
        pc.rect(X - 40, base - 46, 80, 46, C); pc.vline(X - 40, base - 46, 46, R);
        for (let i = 0; i < 80; i += 8) pc.tri(X - 40 + i, base - 46, X - 34 + i, base - 46, X - 37 + i, base - 54, C); // ameias pontudas
        const spire = (sx, top, sw, bulge) => {
          pc.rect(sx - sw, top + 8, sw * 2, base - top - 8, C); pc.vline(sx - sw, top + 8, base - top - 8, R);
          pc.tri(sx - sw - 1, top + 8, sx + sw + 1, top + 8, sx, top - 30, C); pc.line(sx - sw - 1, top + 8, sx, top - 30, R);
          pc.px(sx, top - 12, P.win); // buraco da agulha aceso
          if (bulge) { pc.ellipse(sx, top + 26, sw + 4, 6, C); pc.hline(sx - sw - 3, top + 22, 3, R); for (let k = -4; k <= 4; k += 2) pc.hline(sx - sw - 2, top + 26 + k, (sw + 2) * 2, D); }
        };
        spire(X - 54, 70, 5, true); spire(X + 52, 58, 6, false); spire(X - 22, 50, 4, false); spire(X + 22, 66, 4, true); spire(X, 18, 7, true);
        // tear no topo: travessa + fios verticais
        pc.rect(X - 34, base - 92, 3, 46, C); pc.rect(X + 31, base - 92, 3, 46, C); pc.rect(X - 36, base - 94, 72, 4, C); pc.hline(X - 36, base - 94, 72, R);
        for (let i = -30; i <= 30; i += 3) pc.vline(X + i, base - 90, 44, i % 2 ? P.loom : D);
        // janelas acesas
        const rr = lrng(77);
        for (let i = 0; i < 9; i++) { const wx = X - 36 + rr.int(0, 70), wy = base - 40 + rr.int(0, 30); pc.rect(wx, wy, 2, 3, P.win); }
        pc.rect(X - 5, base - 14, 10, 14, D); pc.circle(X, base - 14, 5, D);
      });
      // mar de névoa/tecido distante embaixo
      const ab = (x) => h - 34 + 6 * Math.sin((TAU * 3 * x) / w + 1) + 3 * Math.sin((TAU * 8 * x) / w);
      ridgeFill(pc, w, h, ab, P.abyss, P.abyssR, P.abyssR2);
      pc.ditherFn(0, h - 30, w, 30, (i, j) => [P.abyss, P.haze1, (1 - j / 30) * 0.35]);
    },
  },
  // 3) ilhas à deriva com pedaços dos mundos anteriores + portais
  {
    width: 600, height: 200, speed: 0.14, speedY: 0.07, drift: 3, y: -26,
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const isl = [[60, 130, 26, 30, 'tree'], [220, 100, 22, 26, 'clock'], [330, 150, 30, 32, 'shell'], [520, 120, 24, 28, 'bed'], [430, 170, 14, 16, 'arch']];
      for (const [x, y, hw, d, kind] of isl) wrap(w, (o) => { CHUNKS[kind](pc, x + o, y, P); island(pc, x + o, y, hw, d, P, x); });
      // molduras dos portais (o redemoinho é animado)
      for (const [px, py, pr] of PORTALS) wrap(w, (o) => {
        glow(pc, px + o, py, pr * 2, pr * 1.7, P.riftEdge + '40', 0.9);
        pc.ellipse(px + o, py, pr, pr * 0.8, P.portal);
        pc.ellipseOutline(px + o, py, pr + 1, pr * 0.8 + 1, P.portalR);
        for (let a = 0; a < TAU; a += TAU / 10) pc.px(Math.round(px + o + Math.cos(a) * (pr + 3)), Math.round(py + Math.sin(a) * (pr * 0.8 + 3)), P.gold);
      });
    },
    animate: portalSwirl(),
  },
  // 4) fios gigantes próximos + ruínas flutuantes dos mundos 1–4
  {
    width: 576, height: 300, speed: 0.3, speedY: 0.15, get fillBelow() { return PAL[curTod].midFill; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      for (const [x0, y0, x1, y1, r] of MID_THREADS) wrap(w, (o) => {
        pc.thickLine(x0 + o, y0, x1 + o, y1, r + 1, P.thread[3]);
        pc.thickLine(x0 + o, y0, x1 + o, y1, r, P.thread[1]);
        pc.line(x0 + o - r * 0.5, y0, x1 + o - r * 0.5, y1, P.thread[0]);
        // torção do cordão
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5);
        for (let i = 0; i < n; i++) { const k = i / n; pc.px(Math.round(x0 + o + (x1 - x0) * k + r * 0.4), Math.round(y0 + (y1 - y0) * k), P.thread[2]); }
      });
      // massas flutuantes com ruínas
      const r = lrng(404);
      const ground = (x) => h - 46 + 10 * Math.sin((TAU * 2 * x) / w + 0.4) + 5 * Math.sin((TAU * 5 * x) / w + 1.1);
      ridgeFill(pc, w, h, ground, P.mid[0], P.midR, P.mid[1]);
      for (let x = 0; x < w; x += 2) if ((x >> 1) % 3 < 2) pc.px(x, Math.round(ground(x)) + 3, P.gold);
      // pilha de blocos tortos (W1)
      wrap(w, (o) => {
        const bx = 90 + o, by = Math.round(ground(90));
        pc.rect(bx - 10, by - 18, 18, 18, tc(P, '#c45e4c')); pc.hline(bx - 10, by - 18, 18, tc(P, '#e88c78'));
        pc.poly([[bx - 4, by - 18], [bx + 12, by - 22], [bx + 15, by - 36], [bx - 1, by - 32]], tc(P, '#4c76ba'));
        pc.line(bx - 4, by - 18, bx - 1, by - 32, tc(P, '#7aa0e0'));
      });
      // cano de latão quebrado com engrenagem (W3)
      wrap(w, (o) => {
        const gx = 250 + o, gy = Math.round(ground(250));
        pc.rect(gx - 4, gy - 48, 8, 48, tc(P, '#a87830')); pc.vline(gx - 4, gy - 48, 48, tc(P, '#e0b860'));
        pc.rect(gx - 6, gy - 50, 12, 4, tc(P, '#c8962e'));
        pc.circle(gx + 14, gy - 26, 11, tc(P, '#8a6020')); for (let a = 0; a < 10; a++) pc.rect(Math.round(gx + 14 + Math.cos(a * 0.628) * 12) - 2, Math.round(gy - 26 + Math.sin(a * 0.628) * 12) - 2, 4, 4, tc(P, '#8a6020'));
        pc.circle(gx + 14, gy - 26, 4, P.mid[0]);
      });
      // casco de navio de brinquedo (W2)
      wrap(w, (o) => {
        const sx = 400 + o, sy = Math.round(ground(400)) + 4;
        pc.poly([[sx - 22, sy - 14], [sx + 20, sy - 18], [sx + 14, sy], [sx - 16, sy]], tc(P, '#c85a4a'));
        pc.line(sx - 22, sy - 14, sx + 20, sy - 18, tc(P, '#f0a090'));
        pc.vline(sx, sy - 44, 30, tc(P, '#6a4a3a')); pc.tri(sx + 1, sy - 42, sx + 1, sy - 22, sx + 16, sy - 26, tc(P, '#f0e8d8'));
      });
      // abajur caído (W4) com luz fraca
      wrap(w, (o) => {
        const lx = 520 + o, ly = Math.round(ground(520));
        pc.line(lx - 14, ly - 2, lx + 6, ly - 10, tc(P, '#6a5a8a'));
        pc.poly([[lx + 4, ly - 18], [lx + 16, ly - 6], [lx + 8, ly - 2], [lx - 2, ly - 12]], tc(P, '#e8c860'));
        glow(pc, lx + 12, ly - 4, 16, 10, '#ffd86040', 0.9);
      });
      for (let i = 0; i < 40; i++) { const x = r.int(0, w - 1); const y = Math.round(ground(x)); pc.vline(x, y - r.int(1, 4), 3, P.mid[0]); }
    },
    animate: threadPulses(),
  },
  // 5) emaranhado escuro próximo (carretéis quebrados, alfinetes, fios caídos)
  {
    width: 480, height: 120, speed: 0.6, speedY: 0.3, get fillBelow() { return PAL[curTod].near; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(909);
      const g = (x) => h - 22 + 6 * Math.sin((TAU * 3 * x) / w) + 3 * Math.sin((TAU * 7 * x) / w + 2);
      // carretéis quebrados
      for (const [sx, sh] of [[70, 40], [300, 56], [420, 30]]) wrap(w, (o) => {
        const x = sx + o, top = Math.round(g(sx)) - sh;
        pc.rect(x - 6, top + 4, 12, sh, P.near); pc.ellipse(x, top + 3, 11, 3, P.near); pc.hline(x - 10, top + 1, 14, P.nearHi);
        pc.vline(x - 6, top + 5, sh - 6, P.nearHi);
      });
      // alfinetes gigantes enfiados
      for (let i = 0; i < 5; i++) {
        const x = r.int(0, w - 1), len = r.int(24, 40), dir = r() < 0.5 ? -1 : 1, by = Math.round(g(x));
        wrap(w, (o) => { pc.line(x + o, by, x + o + dir * len * 0.4, by - len, P.nearHi); pc.circle(x + o + dir * len * 0.4, by - len, 3, P.near); pc.px(x + o + dir * len * 0.4 - 1, by - len - 1, P.nearGold); });
      }
      // fios caídos
      for (let i = 0; i < 6; i++) {
        const x = r.int(0, w - 1), span = r.int(30, 70);
        wrap(w, (o) => pc.curve(x + o, Math.round(g(x)) - 10, x + o + span / 2, Math.round(g(x)) + 4, x + o + span, Math.round(g(x + span)) - 14, i & 1 ? P.nearGold : P.nearHi, 0));
      }
      ridgeFill(pc, w, h, g, P.near, P.nearHi, null);
      for (let i = 0; i < 70; i++) { const x = r.int(0, w - 1); pc.vline(x, Math.round(g(x)) - r.int(1, 4), 4, P.near); }
    },
    animate: embers(18, 31, 0.6),
  },
];

const front = [
  // névoa vermelha rasteira
  {
    width: 512, height: 80, speed: 1.2, speedY: 0.2, drift: 7, get alpha() { return PAL[curTod].hazeA; }, y: 16,
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(1313);
      for (let i = 0; i < 12; i++) {
        const cx = r.int(0, w), cy = r.int(26, h - 14), rx = r.int(40, 100), ry = r.int(6, 16);
        wrap(w, (o) => glow(pc, cx + o, cy, rx, ry, P.haze, 0.7));
      }
    },
  },
];

registerBackground('w5', { sky, layers, front, defaultTimeOfDay: 'dusk' });
