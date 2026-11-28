// =============================================================================
// art/bg_w1.js — Fundo do Mundo 1: FLORESTA DOS BRINQUEDOS PERDIDOS.
//
// sky(): céu compartilhado (art/sky.js) conforme o horário da fase.
// As camadas são pintadas POR HORÁRIO (paint(pc,w,h,tod)): 'day' (verdes vivos,
// névoa azulada), 'dusk' (luz de borda laranja/rosa), 'night' (silhuetas azuis
// escuras com cogumelos brilhando). Paletas em PAL.
// layers (de trás p/ frente): colinas + castelo de blocos abandonado; árvores
//        gigantes de pompom; faixa de névoa roxa (deriva); floresta média com
//        carretéis gigantes, torres de blocos e cogumelos brilhando; folhagem
//        escura próxima com pontos de luz + vaga-lumes (animate).
// front: névoa roxa rasteira translúcida à deriva.
// Todas as camadas são contínuas na horizontal (senóides de frequência inteira
// e elementos desenhados com "wrap").
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
/** Preenche colunas abaixo de uma crista ridge(x) com borda iluminada. */
function ridgeFill(pc, w, h, ridge, body, rim, rim2) {
  for (let x = 0; x < w; x++) {
    const y0 = Math.round(ridge(x));
    pc.vline(x, y0, h - y0, body);
    pc.px(x, y0, rim);
    if (rim2 && ridge(x - 1) > ridge(x)) pc.px(x, y0 + 1, rim2);
  }
}
/** Copa de pompons (círculos sobrepostos com sombra e luz da lua, de cima-esquerda). */
function pomCanopy(pc, cx, cy, R, r, cols) {
  const blobs = [];
  for (let i = 0; i < 8; i++) {
    const a = r() * TAU, d = r() * R * 0.55;
    blobs.push([cx + Math.cos(a) * d * 1.35, cy + Math.sin(a) * d * 0.75, R * (0.42 + r() * 0.3)]);
  }
  blobs.push([cx, cy, R * 0.6]);
  for (const [x, y, rr] of blobs) pc.circle(x + 2, y + 3, rr, cols[0]);
  for (const [x, y, rr] of blobs) pc.circle(x, y, rr, cols[1]);
  for (const [x, y, rr] of blobs) pc.circle(x - rr * 0.28, y - rr * 0.32, rr * 0.58, cols[2]);
  for (const [x, y, rr] of blobs) if (rr > 8) pc.circle(x - rr * 0.4, y - rr * 0.45, rr * 0.22, cols[3]);
}
/** Tronco de feltro com costura central. cols: [base, luz, sombra, costura] */
function trunk(pc, x, yTop, yBot, wTop, wBot, cols) {
  for (let y = yTop; y < yBot; y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const ww = Math.round(wTop + (wBot - wTop) * t * t * t);
    const x0 = Math.round(x - ww / 2);
    pc.hline(x0, y, ww, cols[0]);
    pc.px(x0, y, cols[1]); pc.px(x0 + 1, y, cols[1]);
    pc.px(x0 + ww - 1, y, cols[2]); pc.px(x0 + ww - 2, y, cols[2]);
    if ((y & 3) < 2) pc.px(x0 + (ww >> 1), y, cols[3]);
  }
}

// ------------------------------------------------------------------ paletas por horário
const PAL = {
  day: {
    fill1: '#7fa9b4', h1: '#a2c8d2', h1r: '#d2ecee', h1r2: '#b8dade',
    cs: '#8cb2c4', csL: '#c4e0e8', csD: '#7498ac', roof: '#c88282', roofL: '#eab0a8', flag: '#e05a5a', win: '#5e7e94', win2: '#5e7e94',
    h2: '#86b4a6', h2r: '#b4dcc4', h2r2: '#9ccab6', tt: '#6c9c8a', tc: '#78ac94', th: '#a8d2b4', hz: '#b4d8dc',
    fc: ['#4c7c6e', '#5c9682', '#74b092', '#9ccca6'], ft: ['#6e7e72', '#93a696', '#58685c', '#a2b4a2'], fb: '#6c8276', fbr: '#92aa9a', fth: '#6e7e72', fbt: '#d88080', fg: '#5c8e6e', fgr: '#86ba8e',
    mist: '#e8f4f4', mistA: 0.38,
    mt: ['#5e4636', '#86684c', '#402f24', '#9a7c5c'], mc: ['#22502c', '#2c6a36', '#3e8a42', '#6cb45a'],
    s1: ['#a8444c', '#c45c5c', '#e27e74', '#f4a894'], s2: ['#2e7c86', '#3a949c', '#5cb6b8', '#86d4cc'],
    fl: ['#6a4a3a', '#a87e5c', '#7c5c46', '#b88e66', '#d6ae80'], hole: '#2a1c18',
    mb: ['#c45e4c', '#4c76ba', '#d8ac4a', '#5aa45a'], mbGl: 0.55,
    mg: '#2c5634', mgr: '#5a9452', glow: false, cap: '#e05a54',
    nDK: '#1c3c24', nMID: '#2a5432', nHI: '#46763e', dots: ['#f2d462', '#f27cb2', '#ffffff', '#a68cf2'],
    glints: ['#fff8c8', '#ffffff'], glintN: 0.4, fmist: '#eef6ff', fA: 0.18,
  },
  dusk: {
    fill1: '#4a2e50', h1: '#6c4064', h1r: '#f2a684', h1r2: '#c47676',
    cs: '#50325a', csL: '#eca07e', csD: '#3c2446', roof: '#5c3462', roofL: '#f2a684', flag: '#e2625a', win: '#ffd474', win2: '#eca452',
    h2: '#4c2e52', h2r: '#dc8872', h2r2: '#a45c6c', tt: '#3c2644', tc: '#4c3054', th: '#cc7e70', hz: '#8e5474',
    fc: ['#2e2040', '#44304e', '#5c3e5a', '#9a5e62'], ft: ['#3c2c46', '#bc7466', '#2a1e34', '#5c445a'], fb: '#36283e', fbr: '#a4645c', fth: '#4c3652', fbt: '#e49472', fg: '#2e2038', fgr: '#ac6462',
    mist: '#f2aaa4', mistA: 0.42,
    mt: ['#2c2232', '#9e5e52', '#1c1420', '#b47462'], mc: ['#1c1a26', '#282434', '#362e40', '#7a4a4c'],
    s1: ['#5c2c40', '#70364a', '#c4645c', '#ec8e72'], s2: ['#26424c', '#30525a', '#a46e60', '#dc9472'],
    fl: ['#261e2a', '#c47e64', '#302634', '#503c48', '#dc9470'], hole: '#140e16',
    mb: ['#3c263a', '#2c2c40', '#402e30', '#362c42'], mbGl: 0.3,
    mg: '#1a1622', mgr: '#7e4c52', glow: true, cap: '#ff7ac8',
    nDK: '#140c16', nMID: '#26161f', nHI: '#6e3a3a', dots: ['#5ff0e8', '#ff7ac8'],
    glints: ['#ffd890', '#ffb8a0', '#fff0c0'], glintN: 0.8, fmist: '#f2b4bc', fA: 0.26,
  },
  night: {
    fill1: '#161a34', h1: '#1e2448', h1r: '#3a4472', h1r2: '#2c3662',
    cs: '#181c3c', csL: '#30386a', csD: '#121530', roof: '#202652', roofL: '#30386a', flag: '#4c2c4c', win: '#f2bc64', win2: '#c88a44',
    h2: '#161a38', h2r: '#2e3664', h2r2: '#232a52', tt: '#121630', tc: '#1a1e40', th: '#30386a', hz: '#2c3462',
    fc: ['#141a32', '#1c2444', '#253058', '#36426c'], ft: ['#1a1e3a', '#2a3256', '#12162c', '#343c64'], fb: '#181c36', fbr: '#283052', fth: '#283050', fbt: '#363c66', fg: '#141830', fgr: '#242a4e',
    mist: '#5c68b2', mistA: 0.45,
    mt: ['#141c2c', '#26364a', '#0e141f', '#2e425a'], mc: ['#0c161a', '#122226', '#1a3034', '#28464a'],
    s1: ['#3c1e3a', '#4c2646', '#6c3a60', '#88507c'], s2: ['#1e3a44', '#264c56', '#3a6e78', '#4e8890'],
    fl: ['#1c1824', '#3e3448', '#221c2a', '#3c3248', '#4e4258'], hole: '#0c0a12',
    mb: ['#221c32', '#18222e', '#262222', '#1e1a2e'], mbGl: 0.22,
    mg: '#0e131c', mgr: '#1e2a38', glow: true, cap: '#5ff0e8',
    nDK: '#080610', nMID: '#120e1e', nHI: '#1e1a32', dots: ['#5ff0e8', '#ff7ac8'],
    glints: ['#d8ff9a', '#9af0ff', '#ffb8e8'], glintN: 1, fmist: '#8c7cda', fA: 0.3,
  },
};
let curTod = 'night';   // horário da última pintura (getters de fillBelow/alpha leem isto no bake)
let activeTod = 'day';  // horário da fase em jogo (atualizado por sky())
const todOf = (tod) => (PAL[tod] ? tod : 'day');
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

function sky(ctx, w, h, t, cam, level) {
  const p = skyPreset('w1', level);
  activeTod = todOf(p.tod);
  drawSky(ctx, w, h, t, cam, p);
}

// ------------------------------------------------------------------ animação: pontos de luz
function glints(n, seed, speed, yMin, yMax, big = false) {
  const r = lrng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ u: r(), v: r(), ph: r() * TAU, sp: 0.5 + r(), i });
  return (ctx, cam, t, w, h, y) => {
    const span = w + 40;
    const P = PAL[activeTod], cols = P.glints, lim = Math.ceil(n * P.glintN);
    for (const p of pts) {
      if (p.i >= lim) continue;
      p.c = cols[p.i % cols.length];
      const a = 0.5 + 0.5 * Math.sin(t * 2 * p.sp + p.ph);
      if (a < 0.2) continue;
      let x = (p.u * span - cam.x * speed + Math.sin(t * 0.5 * p.sp + p.ph) * 12) % span;
      if (x < 0) x += span;
      x = Math.round(x - 20);
      const yy = Math.round(y + yMin + p.v * (yMax - yMin) + Math.sin(t * 0.8 * p.sp + p.ph * 2) * 7);
      if (yy < -2 || yy > h + 2) continue;
      ctx.fillStyle = p.c;
      ctx.globalAlpha = a;
      ctx.fillRect(x, yy, 1, 1);
      if (big && a > 0.7) { ctx.globalAlpha = (a - 0.7) * 1.6; ctx.fillRect(x - 1, yy, 3, 1); ctx.fillRect(x, yy - 1, 1, 3); }
    }
    ctx.globalAlpha = 1;
  };
}


// ------------------------------------------------------------------ animação: raios de luz e passarinhos
/** Fachos de luz diagonais entre as copas (dia/entardecer), balançando devagar. */
function lightShafts(speed) {
  const beams = [[0.08, 26, 0.0], [0.3, 14, 1.7], [0.52, 34, 3.1], [0.77, 18, 4.4]];
  return (ctx, cam, t, w, h) => {
    if (activeTod === 'night') return;
    const span = w + 160;
    const col = activeTod === 'dusk' ? '#ffb070' : '#fff6c8';
    ctx.fillStyle = col;
    for (const [u, bw, ph] of beams) {
      let x = (u * span - cam.x * speed) % span; if (x < 0) x += span; x -= 80;
      const a = (activeTod === 'dusk' ? 0.07 : 0.06) * (0.6 + 0.4 * Math.sin(t * 0.35 + ph));
      const sway = Math.sin(t * 0.2 + ph) * 6;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x + sway, -4); ctx.lineTo(x + bw + sway, -4);
      ctx.lineTo(x + bw + 70, h); ctx.lineTo(x + 40, h);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a * 0.6;
      ctx.beginPath();
      ctx.moveTo(x + sway + bw * 0.3, -4); ctx.lineTo(x + sway + bw * 0.6, -4);
      ctx.lineTo(x + bw * 0.6 + 62, h); ctx.lineTo(x + bw * 0.3 + 50, h);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
}
/** Bandinho de passarinhos de papel bem longe, cruzando o céu (dia/entardecer). */
function birds(speed) {
  const flock = [[0, 0], [7, 3], [-6, 4], [13, 6], [-11, 7]];
  return (ctx, cam, t, w, h, y) => {
    if (activeTod === 'night') return;
    ctx.fillStyle = activeTod === 'dusk' ? '#4a2a4a' : '#5a6e7e';
    for (let g = 0; g < 2; g++) {
      const span = w + 240;
      let bx = ((t * (9 + g * 4) + g * 300 - cam.x * speed) % span + span) % span - 120;
      const by = Math.round(y + 30 + g * 26 + Math.sin(t * 0.3 + g) * 6);
      for (const [dx, dy] of flock) {
        const x = Math.round(bx + dx), yy = by + dy;
        const f = Math.sin(t * 6 + dx) > 0 ? 1 : 0;
        ctx.fillRect(x - 2, yy - f, 2, 1); ctx.fillRect(x + 1, yy - f, 2, 1); ctx.fillRect(x, yy, 1, 1);
      }
    }
  };
}

// ------------------------------------------------------------------ camadas
const GLYPH_A = ['.###.', '#...#', '#####', '#...#', '#...#'];
const GLYPH_B = ['####.', '#...#', '####.', '#...#', '####.'];
const GLYPH_C = ['.####', '#....', '#....', '#....', '.####'];

const layers = [
  // 1) colinas distantes + castelo de brinquedo abandonado
  {
    width: 640, height: 200, speed: 0.04, speedY: 0.03, get fillBelow() { return PAL[curTod].fill1; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r1 = (x) => h - 96 + 15 * Math.sin((TAU * 2 * x) / w + 0.5) + 7 * Math.sin((TAU * 5 * x) / w + 1.3) + 2 * Math.sin((TAU * 13 * x) / w);
      ridgeFill(pc, w, h, r1, P.h1, P.h1r, P.h1r2);
      // castelo de blocos
      const cx = 420, base = Math.round(r1(cx)) + 6;
      const C = P.cs, L = P.csL, D = P.csD;
      const tower = (x, tw, th, roof, broken) => {
        pc.rect(x, base - th, tw, th, C); pc.vline(x, base - th, th, L);
        for (let yy = base - th + 9; yy < base; yy += 9) pc.hline(x + 1, yy, tw - 1, D);
        if (broken) {
          pc.tri(x, base - th, x + tw, base - th, x + tw, base - th - 7, C);
          pc.px(x + tw - 2, base - th - 9, C); pc.px(x + tw + 2, base - th + 3, C);
        } else if (roof) {
          pc.tri(x - 3, base - th, x + tw + 3, base - th, x + tw / 2, base - th - roof, P.roof);
          pc.line(x - 3, base - th, x + tw / 2, base - th - roof, P.roofL);
          pc.vline(Math.round(x + tw / 2), base - th - roof - 7, 7, D);
          pc.rect(Math.round(x + tw / 2) + 1, base - th - roof - 7, 5, 3, P.flag);
        } else for (let i = 0; i < tw; i += 4) pc.rect(x + i, base - th - 3, 2, 3, C);
      };
      wrap(w, (o) => {
        pc.translate(o, 0);
        pc.rect(cx - 30, base - 34, 60, 34, C); pc.vline(cx - 30, base - 34, 34, L);
        for (let i = 0; i < 60; i += 6) pc.rect(cx - 30 + i, base - 38, 3, 4, C);
        for (let i = 0; i < 60; i += 12) pc.vline(cx - 30 + i, base - 34, 34, D);
        pc.rect(cx - 6, base - 14, 12, 14, D); pc.circle(cx, base - 14, 6, D);
        tower(cx - 46, 16, 62, 22, false);
        tower(cx + 30, 14, 76, 0, true);
        tower(cx - 14, 12, 52, 16, false);
        tower(cx + 8, 10, 44, 0, false);
        // janelas: uma ainda acesa
        pc.rect(cx - 40, base - 46, 3, 4, P.win); if (P.win !== P.win2) pc.px(cx - 40, base - 46, '#fff0b8');
        pc.rect(cx - 10, base - 40, 2, 3, D); pc.rect(cx + 34, base - 58, 3, 4, D);
        pc.rect(cx + 12, base - 30, 2, 3, P.win2);
        pc.resetTranslate();
      });
      const r2 = (x) => h - 52 + 10 * Math.sin((TAU * 3 * x) / w + 2) + 5 * Math.sin((TAU * 7 * x) / w + 0.2);
      ridgeFill(pc, w, h, r2, P.h2, P.h2r, P.h2r2);
      // arvorezinhas de pompom na crista
      const rr = lrng(5);
      for (let x = 8; x < w; x += 18 + rr.int(0, 22)) {
        const y = Math.round(r2(x)), s = 3 + rr.int(0, 4);
        wrap(w, (o) => { pc.vline(x + o, y - s, s + 1, P.tt); pc.circle(x + o, y - s - 1, s, P.tc); pc.px(x + o - 1, y - s - 3, P.th); pc.px(x + o - 2, y - s - 2, P.th); });
      }
      // névoa no pé das colinas
      pc.ditherFn(0, h - 30, w, 30, (i, j) => [P.h2, P.hz, (j / 30) * 0.7]);
    },
    animate: birds(0.04),
  },
  // 2) árvores gigantes de brinquedo distantes
  {
    width: 512, height: 280, speed: 0.12, speedY: 0.06, get fillBelow() { return PAL[curTod].fg; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(31);
      const trees = [[30, 120, 34], [140, 90, 44], [250, 136, 30], [345, 80, 48], [450, 114, 36]];
      const cols = P.fc;
      for (const [tx, top, R] of trees) {
        wrap(w, (o) => {
          const rr = lrng(tx * 7 + 3);
          trunk(pc, tx + o, top + 10, h, 12 + (R >> 3), 26 + (R >> 2), P.ft);
          // raízes de bloquinhos
          pc.rect(tx + o - 22, h - 10, 10, 10, P.fb); pc.hline(tx + o - 22, h - 10, 10, P.fbr);
          pc.rect(tx + o + 13, h - 8, 8, 8, P.fb); pc.hline(tx + o + 13, h - 8, 8, P.fbr);
          pomCanopy(pc, tx + o, top, R, rr, cols);
          // fio pendurado com botão
          if (R > 40) { const hx = tx + o + 18; pc.vline(hx, top + 14, 40, P.fth); pc.circle(hx, top + 56, 3, P.fbt); pc.px(hx - 1, top + 55, P.fg); pc.px(hx + 1, top + 55, P.fg); }
        });
      }
      // chão ondulado
      const gr = (x) => h - 18 + 4 * Math.sin((TAU * 4 * x) / w) + 2 * Math.sin((TAU * 9 * x) / w + 1);
      ridgeFill(pc, w, h, gr, P.fg, P.fgr, null);
      for (let i = 0; i < 60; i++) { const x = r.int(0, w - 1); const y = Math.round(gr(x)); pc.vline(x, y - r.int(1, 3), 3, P.fg); }
    },
    animate: glints(10, 91, 0.12, 90, 220),
  },
  // 3) névoa roxa média (deriva)
  {
    width: 480, height: 90, speed: 0.2, speedY: 0.1, drift: 5, get alpha() { return PAL[curTod].mistA; }, y: -48,
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(55);
      for (let i = 0; i < 14; i++) {
        const cx = r.int(0, w), cy = r.int(30, h - 20), rx = r.int(40, 90), ry = r.int(6, 14);
        wrap(w, (o) => pc.dither(Math.round(cx + o - rx), Math.round(cy - ry), rx * 2, ry * 2, null, P.mist, (x, y) => {
          const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
          return d < 1 ? (1 - d) * 0.75 : 0;
        }));
      }
      pc.dither(0, h - 26, w, 26, null, P.mist, (x, y) => (y / 26) * 0.9);
    },
  },
  // 4) floresta média: carretéis gigantes, torres de blocos, cogumelos
  {
    width: 576, height: 270, speed: 0.3, speedY: 0.15, get fillBelow() { return PAL[curTod].mg; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(77);
      const DK = P.mt[2];
      // árvores médias
      for (const [tx, top, R] of [[200, 84, 34], [470, 70, 40]]) {
        wrap(w, (o) => {
          trunk(pc, tx + o, top + 8, h, 10, 22, P.mt);
          pomCanopy(pc, tx + o, top, R, lrng(tx), P.mc);
        });
      }
      // carretel gigante em pé
      const spool = (sx, top, sw, shh, thread) => wrap(w, (o) => {
        const x = sx + o, bx = Math.round(x - sw / 2 + 4), bw = sw - 8;
        pc.rect(bx, top + 5, bw, shh - 10, thread[0]);
        for (let y = top + 6; y < top + shh - 5; y += 3) pc.hline(bx, y, bw, thread[1]);
        pc.rect(bx + 3, top + 5, 3, shh - 10, thread[2]);
        for (let y = top + 6; y < top + shh - 5; y += 3) pc.hline(bx + 3, y, 3, thread[3]);
        pc.rect(bx + bw - 4, top + 5, 4, shh - 10, DK);
        // flanges de madeira
        pc.ellipse(x, top + shh - 4, sw / 2 + 4, 5, P.fl[0]); pc.hline(Math.round(x - sw / 2 - 3), top + shh - 5, sw + 6, P.fl[1]);
        pc.ellipse(x, top + 4, sw / 2 + 4, 5.5, P.fl[2]);
        pc.ellipse(x, top + 3, sw / 2 + 3, 4.2, P.fl[3]);
        pc.ellipse(x - 2, top + 2, sw / 2 - 2, 2.6, P.fl[4]);
        pc.ellipse(x, top + 3, 4, 2, P.hole);
        // fio solto descendo até o chão
        pc.curve(bx + bw, top + shh * 0.4, x + sw / 2 + 20, top + shh * 0.7, x + sw / 2 + 30, h - 6, thread[2]);
      });
      spool(80, 120, 46, 130, P.s1);
      spool(380, 170, 30, 82, P.s2);
      // torre de blocos com letras
      const blocks = [[296, h - 28, 26, P.mb[0], GLYPH_A], [300, h - 54, 26, P.mb[1], GLYPH_B], [293, h - 80, 26, P.mb[2], GLYPH_C], [298, h - 102, 22, P.mb[3], GLYPH_A]];
      for (const [bx, by, s, c, gl] of blocks) wrap(w, (o) => {
        const RIM = mix(c, '#ffffff', 0.25), BD = mix(c, '#000000', 0.4);
        pc.rect(bx + o, by, s, s, c); pc.hline(bx + o, by, s, RIM); pc.vline(bx + o, by, s, RIM);
        pc.hline(bx + o + 1, by + s - 1, s - 1, BD); pc.vline(bx + o + s - 1, by + 1, s - 1, BD);
        pc.strokeRect(bx + o + 3, by + 3, s - 6, s - 6, BD);
        const sc = 2, gx = bx + o + Math.round((s - 10) / 2), gy = by + Math.round((s - 10) / 2);
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (gl[j][i] === '#') pc.rect(gx + i * sc, gy + j * sc, sc, sc, mix(c, '#ffffff', P.mbGl));
      });
      // bloco caído
      wrap(w, (o) => { pc.rect(330 + o, h - 22, 18, 18, P.mb[3]); pc.hline(330 + o, h - 22, 18, mix(P.mb[3], '#ffffff', 0.25)); });
      // chão com grama e cogumelos brilhando
      const gr = (x) => h - 14 + 3 * Math.sin((TAU * 5 * x) / w + 0.7) + 2 * Math.sin((TAU * 11 * x) / w);
      ridgeFill(pc, w, h, gr, P.mg, P.mgr, null);
      for (let i = 0; i < 120; i++) { const x = r.int(0, w - 1); const y = Math.round(gr(x)); const hh = r.int(2, 6); pc.vline(x, y - hh, hh, P.mg); }
      for (let i = 0; i < 16; i++) {
        const x = r.int(4, w - 5), y = Math.round(gr(x)), glow = P.glow ? (r() < 0.5 ? '#5ff0e8' : '#ff7ac8') : (r() < 0.6 ? P.cap : '#c89a5a');
        wrap(w, (o) => {
          if (P.glow) { pc.circle(x + o, y - 4, 6, glow + '18'); pc.circle(x + o, y - 4, 3.5, glow + '24'); }
          pc.vline(x + o, y - 3, 3, P.glow ? P.mg : '#e8dcc8'); pc.hline(x + o - 2, y - 4, 5, glow); pc.hline(x + o - 1, y - 5, 3, glow);
          pc.px(x + o - 1, y - 5, '#ffffff');
        });
      }
    },
    animate: glints(12, 17, 0.3, 110, 250),
  },
  // 4b) fachos de luz entre as copas (só animação; nada pintado)
  { width: 64, height: 270, speed: 0.4, speedY: 0.2, alpha: 0, paint() {}, animate: lightShafts(0.4) },
  // 5) folhagem escura próxima com pontos de luz
  {
    width: 448, height: 150, speed: 0.58, speedY: 0.28, get fillBelow() { return PAL[curTod].nDK; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(99);
      const DK = P.nDK, MID = P.nMID, HI = P.nHI;
      const bush = (x, y, R) => wrap(w, (o) => {
        const rr = lrng(x * 13 + y);
        const bl = [];
        for (let i = 0; i < 6; i++) bl.push([x + o + (rr() - 0.5) * R * 2.2, y + (rr() - 0.3) * R * 0.8, R * (0.5 + rr() * 0.45)]);
        for (const [bx, by, br] of bl) pc.circle(bx, by, br, DK);
        for (const [bx, by, br] of bl) {
          for (let a = -2.6; a < -0.9; a += 0.18) pc.px(Math.round(bx + Math.cos(a) * (br - 1)), Math.round(by + Math.sin(a) * (br - 1)), MID);
          pc.px(Math.round(bx - br * 0.5), Math.round(by - br * 0.75), HI);
        }
      });
      for (let x = 10; x < w; x += 34 + r.int(0, 30)) bush(x, h - 30 - r.int(0, 28), 12 + r.int(0, 12));
      // samambaias
      for (let i = 0; i < 9; i++) {
        const x = r.int(0, w - 1), len = r.int(20, 44), dir = r() < 0.5 ? -1 : 1;
        wrap(w, (o) => {
          pc.curve(x + o, h, x + o + dir * 4, h - len, x + o + dir * len * 0.6, h - len + 6, DK, 0);
          for (let k = 4; k < len; k += 4) { const yy = h - k; pc.line(x + o + dir * (k * 0.25), yy, x + o + dir * (k * 0.25) + dir * 6, yy - 3, DK); pc.line(x + o + dir * (k * 0.25), yy, x + o + dir * (k * 0.25) - dir * 5, yy - 2, DK); }
        });
      }
      pc.rect(0, h - 26, w, 26, DK);
      // pontos de luz (cogumelos minúsculos)
      for (let i = 0; i < 18; i++) {
        const x = r.int(2, w - 3), y = h - r.int(10, 50), c = P.dots[i % P.dots.length];
        wrap(w, (o) => { if (P.glow) pc.circle(x + o, y, 3, c + '22'); pc.px(x + o, y, c); pc.px(x + o, y + 1, MID); });
      }
    },
    animate: glints(14, 23, 0.58, -40, 140, true),
  },
];

const front = [
  // névoa roxa rasteira na frente de tudo
  {
    width: 512, height: 70, speed: 1.2, speedY: 0.2, drift: 9, get alpha() { return PAL[curTod].fA; }, y: 14,
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(404);
      for (let i = 0; i < 12; i++) {
        const cx = r.int(0, w), cy = r.int(26, h - 14), rx = r.int(40, 100), ry = r.int(6, 14);
        wrap(w, (o) => pc.dither(Math.round(cx + o - rx), Math.round(cy - ry), rx * 2, ry * 2, null, P.fmist, (x, y) => {
          const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
          return d < 1 ? (1 - d) * 0.7 : 0;
        }));
      }
    },
  },
];

registerBackground('w1', { sky, layers, front, defaultTimeOfDay: 'day' });
