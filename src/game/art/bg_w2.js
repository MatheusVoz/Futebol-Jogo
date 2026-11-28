// =============================================================================
// art/bg_w2.js — Fundo do Mundo 2: OCEANO DAS LÁGRIMAS.
//
// sky(): céu submarino compartilhado (art/sky.js) conforme o horário da fase.
// As camadas são pintadas POR HORÁRIO (paint(pc,w,h,tod)): 'day' (turquesa
// claro, borda rosada), 'dusk' (azul-violeta com borda laranja/rosa),
// 'night' (azul-marinho profundo, bioluminescência ciano/rosa, vigias acesas).
// layers (de trás p/ frente):
//   1) ruínas distantes: colunas, arcos, templo de cúpula e estruturas
//      impossíveis (arco invertido flutuante, escada para lugar nenhum, blocos
//      e cubos de água suspensos) + raios de luz animados (animate);
//   2) silhuetas de corais gigantes (ramificados, leques, esponjas) + cardumes
//      atravessando (animate);
//   3) enorme navio de brinquedo naufragado, blocos e patinho gigantes meio
//      enterrados + águas-vivas à deriva (animate);
//   4) floresta de kelp próxima e escura + bolhas/neve marinha (animate).
// front: névoa de cáusticas sutil à deriva.
// Todas as camadas são contínuas na horizontal (senóides de frequência inteira
// e elementos desenhados com "wrap"). fillBelow cobre fases altas.
// =============================================================================
import { registerBackground } from '../registry.js';
import { drawSky, skyPreset } from './sky.js';
import { PixelCanvas, colorU32 } from '../../engine/pixel.js';
import { w2WaterInfo } from './tiles_w2.js';

const TAU = Math.PI * 2;
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const wrap = (w, fn) => { fn(0); fn(-w); fn(w); };

const PAL = {
  day: {
    far: '#4aa6cc', farL: '#86d4ea', farD: '#3e94bc', cube: '#c8f8ff', fill1: '#3e94bc',
    cor: '#5a7cb4', corL: '#c4a0d4', corD: '#4a6ca4', fill2: '#2672a0', dots: null,
    shp: '#24688f', shpL: '#5aa4c4', shpD: '#1c5a80', hull: '#8a5a78', stripe: '#a8c8d4', glass: '#9ee8f4', glow: 0, sail: '#8ab8cc', fill3: '#1c5a80',
    kelp: '#164a68', kelpL: '#2a6e84', kelpD: '#103c58', fill4: '#103c58',
    fish: '#1c5a80', jelly: '#e8faff', jellyA: 0.45, jellyGlow: null, shaft: '#effeff', shaftA: 0.13,
    haze: '#d8fcff', hazeA: 0.55, snow: '#e0fcff',
  },
  dusk: {
    far: '#3a4a86', farL: '#c88aa8', farD: '#323e76', cube: '#ffd0c0', fill1: '#323e76',
    cor: '#3e3672', corL: '#e88a8a', corD: '#322c62', fill2: '#242c60', dots: null,
    shp: '#222a5a', shpL: '#c87a8a', shpD: '#1a2050', hull: '#6a3a5a', stripe: '#8a7a9a', glass: '#ffc890', glow: 0.4, sail: '#6a6a90', fill3: '#1a2050',
    kelp: '#151a40', kelpL: '#3a2e5a', kelpD: '#0f1434', fill4: '#0f1434',
    fish: '#1e2454', jelly: '#ffd8e8', jellyA: 0.45, jellyGlow: '#ff9ac0', shaft: '#ffd8b8', shaftA: 0.1,
    haze: '#ffd8c8', hazeA: 0.45, snow: '#ffe0d0',
  },
  night: {
    far: '#0e2444', farL: '#1e4064', farD: '#0b1e3a', cube: '#5ff8f0', fill1: '#0b1e3a',
    cor: '#0a1c38', corL: '#1a3a5a', corD: '#081630', fill2: '#081630', dots: ['#5ff8f0', '#ff7ac8', '#b48aff'],
    shp: '#081830', shpL: '#183454', shpD: '#06122a', hull: '#1e1a3a', stripe: '#24304a', glass: '#ffe08a', glow: 1, sail: '#1a2a44', fill3: '#06122a',
    kelp: '#050e20', kelpL: '#0c1c34', kelpD: '#040a18', fill4: '#040a18',
    fish: '#0c2240', jelly: '#ff9ad8', jellyA: 0.7, jellyGlow: '#ff7ac8', shaft: '#a8d8ff', shaftA: 0.05,
    haze: '#7ff8ec', hazeA: 0.4, snow: '#9af0ff',
  },
};
let curTod = 'day';    // horário da última pintura (getters de fillBelow/alpha leem isto no bake)
let activeTod = 'day'; // horário da fase em jogo (atualizado por sky())
const todOf = (tod) => (PAL[tod] ? tod : 'day');

// Durante uma FASE, sky() desenha tudo: céu AÉREO (acima da linha d'água), horizonte
// com ilhas distantes, e o fundo SUBMARINO recortado só atrás da água do mar (máscara
// por célula vinda de w2WaterInfo). As camadas `layers` ficam vazias nas fases
// (continuam pintadas para a introdução do mundo, que não tem mapa).
let LV = null;          // fase do quadro atual
let MASK = [];          // retângulos (tela) da água do mar visível neste quadro
const AIR_GRAD = {
  day: ['#3f92e0', '#72bcf2', '#ace0fa', '#e6f8ff'],
  dusk: ['#2a1f5a', '#7a3a8a', '#e0607a', '#ffb070', '#ffe0a0'],
  night: ['#04081c', '#0a1638', '#14265a', '#24386e'],
};
const _airP = {};
function airPreset(tod, level) {
  if (_airP[tod]) return _airP[tod];
  const p = skyPreset('w2air', level, tod);
  p.gradient = AIR_GRAD[tod] || p.gradient;
  p.key = 'w2air:' + tod;
  return (_airP[tod] = p);
}
function sky(ctx, w, h, t, cam, level) {
  const p = skyPreset('w2', level);
  activeTod = todOf(p.tod);
  if (!level || !level.map || cam.rx === undefined) { LV = null; drawSky(ctx, w, h, t, cam, p); return; }
  LV = level;
  const I = w2WaterInfo(level.map, level.data.map);
  drawSky(ctx, w, h, t, cam, airPreset(activeTod, level));
  drawAir(ctx, cam, t, w, h, level, I);
  buildMask(cam, w, h, level, I);
  drawUnder(ctx, cam, t, w, h, level, I);
}
// ------------------------------------------------------------------ utilidades de pintura
function ridgeFill(pc, w, h, ridge, body) {
  for (let x = 0; x < w; x++) { const y0 = Math.round(ridge(x)); pc.vline(x, y0, h - y0, body); }
}
/** Luz de borda (cima/esquerda) e sombra (direita) em todas as silhuetas opacas da camada. */
function rim(pc, lit, shade) {
  const { w, h } = pc;
  const src = pc.buf.slice();
  const L = colorU32(lit), S = shade ? colorU32(shade) : 0;
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 200;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!op(x, y)) continue;
      const xl = (x - 1 + w) % w, xr = (x + 1) % w;
      if (!op(xl, y) || !op(x, y - 1)) pc.buf[y * w + x] = L;
      else if (S && !op(xr, y)) pc.buf[y * w + x] = S;
    }
  }
}
function ring(pc, cx, cy, R, th, c, half) {
  for (let dy = -R; dy <= R; dy++) {
    if ((half < 0 && dy > 0) || (half > 0 && dy < 0)) continue;
    for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= R && d >= R - th) pc.px(cx + dx, cy + dy, c);
    }
  }
}
function column(pc, x, yb, hgt, cw, c, broken, r) {
  pc.rect(x, yb - hgt, cw, hgt, c);
  if (!broken) { pc.rect(x - 2, yb - hgt - 3, cw + 4, 3, c); pc.rect(x - 1, yb - hgt - 5, cw + 2, 2, c); }
  else for (let i = 0; i < cw; i++) pc.vline(x + i, yb - hgt - r.int(0, 5), 5, c);
  pc.rect(x - 2, yb - 4, cw + 4, 4, c);
}
function arch(pc, cx, yb, span, hgt, th, c) {
  const R = Math.round(span / 2);
  pc.rect(cx - R, yb - hgt, th, hgt, c); pc.rect(cx + R - th + 1, yb - hgt, th, hgt, c);
  ring(pc, cx, yb - hgt, R, th, c, -1);
}

// ------------------------------------------------------------------ animações
const _sh = {};
function shaftCanvas(col) {
  if (_sh[col]) return _sh[col];
  const pc = new PixelCanvas(70, 300);
  for (let y = 0; y < 300; y++) {
    const a = Math.max(0, 1 - y / 280);
    const x0 = Math.round(y * 0.32), ww = 14 + Math.round(y * 0.1);
    for (let i = 0; i < ww; i++) {
      const e = Math.min(i, ww - 1 - i) / (ww / 2);
      if (a * Math.min(1, e * 2) > ((((x0 + i) & 3) * 4 + (y & 3) * 5) % 16 + 0.5) / 16) pc.px(x0 + i, y, col);
    }
  }
  pc.flush();
  return (_sh[col] = pc.canvas);
}
function shafts(ctx, cam, t, w, y0 = -10) {
  const P = PAL[activeTod];
  const cv = shaftCanvas(P.shaft);
  const span = w + 140;
  for (let i = 0; i < 5; i++) {
    let x = (i * 157 - cam.x * 0.06 + Math.sin(t * 0.13 + i * 2.1) * 26) % span;
    if (x < 0) x += span;
    ctx.globalAlpha = P.shaftA * (0.55 + 0.45 * Math.sin(t * 0.45 + i * 1.7));
    ctx.drawImage(cv, Math.round(x - 90), Math.round(y0));
  }
  ctx.globalAlpha = 1;
}
function schools(speed, yMin, yMax, seed) {
  const r = lrng(seed);
  const S = [0, 1, 2].map((k) => ({
    dir: k % 2 ? -1 : 1, sp: 10 + r() * 10, u: r(), v: r(), ph: r() * TAU,
    fish: Array.from({ length: 10 + r.int(0, 10) }, () => [r() * 34 - 17, r() * 12 - 6, r() * TAU]),
  }));
  return (ctx, cam, t, w, h, y) => {
    const P = PAL[activeTod];
    ctx.fillStyle = P.fish;
    const span = w + 360;
    for (const s of S) {
      let cx = (s.u * span + s.dir * t * s.sp - cam.x * speed) % span;
      if (cx < 0) cx += span;
      cx -= 180;
      const cy = y + yMin + s.v * (yMax - yMin) + Math.sin(t * 0.4 + s.ph) * 10;
      for (const [fx, fy, p] of s.fish) {
        const x = Math.round(cx + fx + Math.sin(t * 1.3 + p) * 3), yy = Math.round(cy + fy + Math.sin(t * 2 + p) * 1.5 + Math.sin(fx * 0.2 + t) * 2);
        if (x < -4 || x > w + 4) continue;
        ctx.fillRect(x, yy, 3, 1); ctx.fillRect(x + (s.dir > 0 ? 1 : 0), yy - 1, 1, 1);
        ctx.fillRect(s.dir > 0 ? x - 1 : x + 3, yy + (((t * 6 + p) | 0) & 1 ? -1 : 0), 1, 1);
      }
    }
  };
}
const _jel = {};
function jellyFrames(tod) {
  if (_jel[tod]) return _jel[tod];
  const P = PAL[tod];
  const fr = [0, 1, 2].map((f) => {
    const pc = new PixelCanvas(20, 30);
    const bw = [7, 6, 5][f], bh = [5, 6, 7][f];
    if (P.jellyGlow) { pc.circle(10, 7, 9, P.jellyGlow + '18'); pc.circle(10, 7, 6, P.jellyGlow + '22'); }
    pc.ellipse(10, 7, bw, bh, P.jelly + '88');
    pc.ellipse(10, 6, bw - 1.5, bh - 2, P.jelly + 'aa');
    pc.px(8, 4, '#ffffffcc'); pc.px(9, 3, '#ffffffaa');
    for (let i = 0; i < 4; i++) {
      const x0 = 10 - bw + 2 + i * ((bw * 2 - 4) / 3);
      for (let k = 0; k < 16 + (i & 1) * 4; k++) pc.px(Math.round(x0 + Math.sin(k * 0.45 + f + i) * 1.2), 7 + bh - 1 + k, P.jelly + (k < 8 ? '88' : '44'));
    }
    pc.flush();
    return pc.canvas;
  });
  return (_jel[tod] = fr);
}
function jellies(speed, n, seed, yMin, yMax) {
  const r = lrng(seed);
  const J = Array.from({ length: n }, () => ({ u: r(), v: r(), ph: r() * TAU, sp: 2 + r() * 3 }));
  return (ctx, cam, t, w, h, y) => {
    const P = PAL[activeTod];
    const fr = jellyFrames(activeTod);
    const span = w + 60, H = yMax - yMin;
    for (const j of J) {
      let x = (j.u * span - cam.x * speed + Math.sin(t * 0.2 + j.ph) * 16) % span;
      if (x < 0) x += span;
      let yy = (j.v * H - t * j.sp) % H;
      if (yy < 0) yy += H;
      const f = Math.floor(t * 1.6 + j.ph) % 3;
      ctx.globalAlpha = P.jellyA * Math.min(1, yy / 30, (H - yy) / 30);
      ctx.drawImage(fr[f], Math.round(x - 30), Math.round(y + yMin + yy));
    }
    ctx.globalAlpha = 1;
  };
}
function snow(n, speed, seed, big) {
  const r = lrng(seed);
  const pts = Array.from({ length: n }, () => ({ u: r(), v: r(), ph: r() * TAU, sp: 3 + r() * 6, glow: r() < 0.3 }));
  return (ctx, cam, t, w, h) => {
    const P = PAL[activeTod];
    const night = activeTod === 'night';
    for (const p of pts) {
      let x = (p.u * (w + 20) - cam.x * speed + Math.sin(t * 0.6 + p.ph) * 6) % (w + 20);
      if (x < 0) x += w + 20;
      let y = (p.v * (h + 20) + t * p.sp - cam.y * speed * 0.5) % (h + 20);
      if (y < 0) y += h + 20;
      const a = 0.35 + 0.35 * Math.sin(t * 1.5 + p.ph);
      ctx.globalAlpha = night && p.glow ? a + 0.3 : a * 0.7;
      ctx.fillStyle = night && p.glow ? (p.ph > 3 ? '#ff9ad8' : '#7ff8ec') : P.snow;
      ctx.fillRect(Math.round(x - 10), Math.round(y - 10), 1, 1);
      if (big && p.glow && a > 0.55) { ctx.globalAlpha *= 0.4; ctx.fillRect(Math.round(x - 11), Math.round(y - 10), 3, 1); ctx.fillRect(Math.round(x - 10), Math.round(y - 11), 1, 3); }
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ composição nas fases
const AIRP = {
  day: { far: '#86b8d8', farL: '#b4dcf0', farD: '#6c9ec4', isl: '#5f93ba', islL: '#9ccbe4', islD: '#4a7ea6', fall: '#e8fbff', lamp: '#fff2a0', red: '#d97a7a', white: '#e8f4fa' },
  dusk: { far: '#8a5a8e', farL: '#e89aa0', farD: '#6a4078', isl: '#5a3a72', islL: '#d0808e', islD: '#42285c', fall: '#ffd8d0', lamp: '#ffd890', red: '#c06070', white: '#e8c0c8' },
  night: { far: '#1a2a52', farL: '#2c4474', farD: '#121e40', isl: '#121c3c', islL: '#26386a', islD: '#0c1430', fall: '#9ad8ff', lamp: '#ffe890', red: '#3a2a4a', white: '#3a4a6a' },
};
const _airBake = {};
/** Ilhas distantes no horizonte: ilhotas com coqueiros de coral, farol de bloquinhos,
 *  veleiro de papel e rochedos. Linha de base = horizonte (embaixo da imagem). */
function airFar(tod) {
  const key = 'far:' + tod;
  if (_airBake[key]) return _airBake[key];
  const A = AIRP[tod], W = 720, H = 110, r = lrng(808);
  const pc = new PixelCanvas(W, H);
  const isle = (cx, hw, hh, c) => {
    for (let x = -hw; x <= hw; x++) {
      const k = 1 - (x / hw) ** 2;
      const top = Math.round(hh * Math.sqrt(Math.max(0, k)) * (0.85 + 0.15 * Math.sin(x * 0.3 + cx)));
      wrap(W, (o) => pc.vline(cx + x + o, H - top, top, c));
    }
  };
  const palm = (x, base, hgt, c, flip) => {
    wrap(W, (o) => {
      for (let k = 0; k < hgt; k++) pc.px(Math.round(x + o + Math.sin(k / hgt * 1.6) * 4 * flip), base - k, c);
      const tx = Math.round(x + o + Math.sin(1.6) * 4 * flip), ty = base - hgt;
      for (const [dx, dy] of [[-7, 3], [-5, 1], [-3, 0], [3, 0], [5, 1], [7, 3], [-4, 2], [4, 2]]) pc.line(tx, ty, tx + dx, ty + dy, c);
    });
  };
  // rochedos e ilhotas
  for (let i = 0; i < 6; i++) { const cx = r.int(0, W), hw = r.int(30, 70), hh = r.int(8, 20); isle(cx, hw, hh, A.far); if (r() < 0.8) palm(cx + r.int(-hw / 2, hw / 2), H - hh + 2, r.int(12, 20), A.far, r() < 0.5 ? 1 : -1); }
  for (let i = 0; i < 4; i++) { const cx = r.int(0, W), sw = r.int(5, 9), sh = r.int(18, 34); wrap(W, (o) => { pc.rect(cx + o, H - sh, sw, sh, A.far); pc.rect(cx + o + 1, H - sh - 3, sw - 3, 3, A.far); }); }
  // farol de bloquinhos (listrado)
  const lx = 430, lb = H;
  wrap(W, (o) => {
    isle(lx + 4, 26, 9, A.far);
    for (let k = 0; k < 6; k++) pc.rect(lx - 4 + o + (k % 2), lb - 12 - k * 7, 12, 7, k % 2 ? A.white : A.red);
    pc.rect(lx - 3 + o, lb - 58, 12, 6, A.farD); pc.rect(lx - 1 + o, lb - 56, 8, 3, A.lamp); pc.tri(lx - 5 + o, lb - 58, lx + 11 + o, lb - 58, lx + 3 + o, lb - 66, A.red);
  });
  // veleiro de papel distante
  wrap(W, (o) => { pc.poly([[200 + o, H - 3], [222 + o, H - 3], [218 + o, H], [204 + o, H]], A.farD); pc.tri(211 + o, H - 4, 211 + o, H - 22, 222 + o, H - 5, A.white); pc.tri(209 + o, H - 4, 209 + o, H - 17, 201 + o, H - 5, A.white); });
  rim(pc, A.farL, A.farD);
  pc.flush();
  return (_airBake[key] = pc.canvas);
}
/** Ilhas flutuantes mágicas no céu (rocha com raízes, cascatinhas e bolhas de água). */
function airMid(tod) {
  const key = 'mid:' + tod;
  if (_airBake[key]) return _airBake[key];
  const A = AIRP[tod], W = 820, H = 120, r = lrng(4242);
  const pc = new PixelCanvas(W, H);
  const falls = [];
  for (let i = 0; i < 4; i++) {
    const cx = 90 + i * 200 + r.int(-40, 40), cy = r.int(26, 70), hw = r.int(16, 32), hh = r.int(14, 26);
    wrap(W, (o) => {
      pc.ellipse(cx + o, cy, hw, 4, A.islL);
      for (let x = -hw; x <= hw; x++) { const k = Math.sqrt(Math.max(0, 1 - (x / hw) ** 2)); const d = Math.round(hh * k * (0.55 + 0.25 * Math.sin(x * 0.7 + cx) + 0.2 * Math.sin(x * 1.9))); pc.vline(cx + x + o, cy, Math.max(1, d), A.isl); }
      for (let k = 0; k < 4; k++) { const rx = cx + o + r.int(-hw + 4, hw - 4); pc.vline(rx, cy + 4, r.int(6, 14), A.islD); }
      pc.rect(cx - hw + 3 + o, cy - 2, hw * 2 - 6, 2, A.islL);
    });
    if (r() < 0.75) falls.push([cx + r.int(-hw / 2, hw / 2), cy + 2, H - cy - 4]);
    if (r() < 0.6) { const bx = cx + r.int(-hw, hw), by = cy - r.int(12, 22), br = r.int(4, 7); wrap(W, (o) => { pc.circle(bx + o, by, br, A.fall + '40'); pc.ellipseOutline(bx + o, by, br, br, A.fall + 'a0'); pc.px(bx - 2 + o, by - 2, '#ffffff'); }); }
  }
  rim(pc, A.islL, A.islD);
  pc.flush();
  return (_airBake[key] = { canvas: pc.canvas, falls, W, H });
}
function tileX(ctx, cv, cw, x, y, w) {
  let xx = -Math.round(((x % cw) + cw) % cw);
  for (; xx < w; xx += cw) ctx.drawImage(cv, xx, y);
}
function drawAir(ctx, cam, t, w, h, level, I) {
  const A = AIRP[activeTod];
  const maxCamY = Math.max(0, level.map.height - cam.viewH);
  // ilhas flutuantes (parallax lento)
  const M = airMid(activeTod);
  const my = Math.round(h * 0.16 - (cam.y - maxCamY) * 0.05);
  tileX(ctx, M.canvas, M.W, cam.x * 0.1 + t * 1.5, my, w);
  ctx.fillStyle = A.fall;
  for (const [fx, fy, fl] of M.falls) {
    let x = -Math.round((((cam.x * 0.1 + t * 1.5) % M.W) + M.W) % M.W) + fx;
    for (; x < w + M.W; x += M.W) {
      if (x < -4 || x > w + 4) continue;
      for (let k = 0; k < fl; k += 3) { const a = 1 - k / fl; ctx.globalAlpha = 0.55 * a; ctx.fillRect(x + (((k + t * 30) | 0) % 6 < 3 ? 0 : 1), my + fy + k + Math.round((t * 40) % 3), 1, 2); }
    }
  }
  ctx.globalAlpha = 1;
  // horizonte: ilhas distantes apoiadas na linha d'água
  const seaY = (I.seaRow ?? level.map.rows) * 16 - cam.ry;
  if (seaY > -10 && seaY - 110 < h) {
    tileX(ctx, airFar(activeTod), 720, cam.x * 0.06, seaY - 110, w);
    // farol: facho girando à noite/entardecer
    if (activeTod !== 'day') {
      let lx = -Math.round((((cam.x * 0.06) % 720) + 720) % 720) + 433;
      for (; lx < w + 720; lx += 720) {
        if (lx < -80 || lx > w + 80) continue;
        const a = Math.sin(t * 1.2);
        ctx.globalAlpha = 0.18; ctx.fillStyle = A.lamp;
        for (let k = 4; k < 70; k += 2) ctx.fillRect(Math.round(lx + a * k), seaY - 56 - Math.round(k * 0.08), 2, 2);
        ctx.globalAlpha = 0.6 + 0.4 * Math.abs(a); ctx.fillRect(lx - 2, seaY - 56, 5, 3);
      }
      ctx.globalAlpha = 1;
    }
  }
}
function buildMask(cam, w, h, level, I) {
  MASK = []; POOLS.length = 0;
  const map = level.map, C = I.C;
  const x0 = Math.max(0, Math.floor(cam.x / 16)), x1 = Math.min(map.cols - 1, Math.floor((cam.x + w) / 16));
  const y0 = Math.max(0, Math.floor(cam.y / 16)), y1 = Math.min(map.rows - 1, Math.floor((cam.y + h) / 16));
  const pools = new Map();
  for (let ty = y0; ty <= y1; ty++) {
    let run = -1, kindRun = null;
    const close = (tx) => { if (run >= 0) { const r = [run * 16 - cam.rx, ty * 16 - cam.ry, (tx - run) * 16, 16]; if (kindRun === 'sea') MASK.push(r); else { (pools.get(kindRun) || pools.set(kindRun, []).get(kindRun)).push(r); } } run = -1; };
    for (let tx = x0; tx <= x1 + 1; tx++) {
      let k = null;
      if (tx <= x1) {
        const i = ty * C + tx, id = I.reg[i];
        if (id >= 0 && !I.cover[i]) { const Rg = I.regions[id]; k = Rg.kind === 'sea' ? 'sea' : Rg.kind === 'pool' ? Rg : null; }
      }
      if (k !== kindRun) { close(tx); if (k) { run = tx; kindRun = k; } else kindRun = null; }
    }
  }
  for (const [Rg, rects] of pools) POOLS.push({ Rg, rects });
}
const POOLS = [];
let SEAY = 0;
const introOnly = (fn) => (ctx, cam, t, w, h, y) => { if (cam.rx === undefined) fn(ctx, cam, t, w, h, y); };
const UWG = { day: ['#9ae4f0', '#4ab4dc', '#2a84c0', '#1a5a98', '#103c70'], dusk: ['#8aa0d8', '#5a74b8', '#3a5294', '#283a74', '#18264e'], night: ['#1e5a84', '#14426a', '#0c2e52', '#08203e', '#04142c'] };
const _uwg = {};
function uwGrad(tod) {
  if (_uwg[tod]) return _uwg[tod];
  const pc = new PixelCanvas(8, 360);
  pc.vgradient(0, 0, 8, 360, UWG[tod]);
  pc.flush();
  return (_uwg[tod] = pc.canvas);
}
const _uwL = {};
function uwLayers(tod) {
  if (_uwL[tod]) return _uwL[tod];
  return (_uwL[tod] = layers.map((L) => {
    const w = L.width, h = L.height, pc = new PixelCanvas(w, h);
    L.paint(pc, w, h, tod, null);
    pc.flush();
    return { L, canvas: pc.canvas, w, h };
  }));
}
function clipRects(ctx, rects) {
  ctx.beginPath();
  for (const r of rects) ctx.rect(r[0], r[1], r[2], r[3]);
  ctx.clip();
}
function drawUnder(ctx, cam, t, w, h, level, I) {
  const tod = activeTod, G = uwGrad(tod), deep = UWG[tod][4];
  if (MASK.length) {
    ctx.save();
    clipRects(ctx, MASK);
    const sy = (I.seaRow ?? 0) * 16 - cam.ry;
    SEAY = sy;
    ctx.drawImage(G, 0, sy, w, 360);
    if (sy + 360 < h) { ctx.fillStyle = deep; ctx.fillRect(0, sy + 360, w, h - sy - 360); }
    if (sy > 0) { ctx.fillStyle = UWG[tod][0]; ctx.fillRect(0, 0, w, sy); }
    const maxCamY = Math.max(0, level.map.height - cam.viewH);
    for (const E of uwLayers(tod)) {
      const L = E.L, spx = L.speed, spy = L.speedY;
      const y = Math.max(sy + 20, Math.round(h - E.h - (cam.y - maxCamY) * spy));
      ctx.globalAlpha = 0.85;
      tileX(ctx, E.canvas, E.w, cam.x * spx, y, w);
      if (y + E.h < h) { ctx.fillStyle = L.fillBelow; ctx.fillRect(0, y + E.h, w, h - y - E.h); }
      ctx.globalAlpha = 1;
      if (L.uwAnim) L.uwAnim(ctx, cam, t, w, h, y);
    }
    shafts(ctx, cam, t, w, sy - 4);
    ctx.restore();
  }
  for (const P of POOLS) {
    ctx.save();
    clipRects(ctx, P.rects);
    const py = P.Rg.y0 * 16 - cam.ry;
    ctx.drawImage(G, 0, py, w, 360);
    shafts(ctx, cam, t, w, py - 4);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ camadas
const layers = [
  // 1) ruínas distantes e estruturas impossíveis
  {
    width: 640, height: 210, speed: 0.05, speedY: 0.03, get fillBelow() { return PAL[curTod].fill1; },
    paint(pc, w, h, tod, ld) {
      curTod = todOf(tod);
      if (ld && ld.map) return; // fase: desenhado recortado por sky()
      const P = PAL[curTod]; const r = lrng(21);
      const ridge = (x) => h - 30 + 6 * Math.sin((TAU * 2 * x) / w + 0.4) + 3 * Math.sin((TAU * 7 * x) / w);
      const c = P.far;
      for (let i = 0; i < 12; i++) { // colunas
        const cx = r.int(0, w), hgt = r.int(36, 104), cw = r.int(5, 9), br = r() < 0.5;
        wrap(w, (o) => column(pc, cx + o, Math.round(ridge(cx)) + 4, hgt, cw, c, br, lrng(i)));
      }
      for (let i = 0; i < 3; i++) { // arcos
        const cx = 60 + i * 210 + r.int(-20, 20), span = r.int(34, 54), hgt = r.int(40, 70);
        wrap(w, (o) => arch(pc, cx + o, Math.round(ridge(cx)) + 4, span, hgt, 5, c));
      }
      // templo de cúpula
      const tx = 330, tb = Math.round(ridge(tx)) + 4;
      wrap(w, (o) => {
        pc.rect(tx - 34 + o, tb - 50, 68, 50, c); pc.rect(tx - 40 + o, tb - 54, 80, 5, c);
        pc.ellipse(tx + o, tb - 54, 26, 22, c); pc.rect(tx - 1 + o, tb - 92, 3, 18, c); pc.circle(tx + o + 0.5, tb - 93, 3, c);
        for (let k = 0; k < 4; k++) pc.rect(tx - 28 + k * 16 + o, tb - 44, 8, 36, P.farD);
      });
      // arco invertido flutuante + blocos suspensos + escada para lugar nenhum
      wrap(w, (o) => {
        ring(pc, 470 + o, 70, 26, 6, c, 1); pc.rect(440 + o, 64, 8, 8, c); pc.rect(493 + o, 64, 8, 8, c);
        for (let k = 0; k < 7; k++) pc.rect(170 + k * 7 + o, 120 - k * 8, 9, 6, c);
        pc.rect(230 + o, 52, 10, 10, c); pc.rect(250 + o, 40, 7, 7, c); pc.rect(580 + o, 60, 12, 9, c); pc.rect(560 + o, 88, 6, 6, c);
      });
      ridgeFill(pc, w, h, ridge, P.farD);
      rim(pc, P.farL, P.farD);
      // cubos de água flutuando (contorno claro + reflexo)
      for (const [x, y, s] of [[110, 58, 16], [395, 30, 12], [520, 120, 10], [610, 34, 14]]) {
        wrap(w, (o) => {
          pc.rect(x + o, y, s, s, P.cube + '30'); pc.strokeRect(x + o, y, s, s, P.cube + 'a0');
          pc.hline(x + 2 + o, y + 2, s - 6, P.cube + 'e0'); pc.px(x + 2 + o, y + 3, P.cube + 'c0');
        });
      }
      if (curTod === 'night') for (let i = 0; i < 20; i++) { const x = r.int(0, w), y = r.int(60, h - 40); if (pc.alphaAt(x, y) > 200) pc.px(x, y, i & 1 ? '#3ab8c4' : '#2a8a9c'); }
    },
    uwAnim: null, animate: (ctx, cam, t, w) => { if (cam.rx === undefined) shafts(ctx, cam, t, w); },
  },
  // 2) corais gigantes
  {
    width: 576, height: 220, speed: 0.13, speedY: 0.07, get fillBelow() { return PAL[curTod].fill2; },
    paint(pc, w, h, tod, ld) {
      curTod = todOf(tod);
      if (ld && ld.map) return; // fase: desenhado recortado por sky()
      const P = PAL[curTod]; const r = lrng(52);
      const ridge = (x) => h - 26 + 7 * Math.sin((TAU * 3 * x) / w + 1) + 3 * Math.sin((TAU * 8 * x) / w);
      const tips = [];
      const branch = (x, y, a, len, dep, tk, o, rr) => {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        pc.thickLine(x + o, y, x2 + o, y2, tk, P.cor);
        if (dep > 0) {
          const nb = rr() < 0.4 ? 3 : 2;
          for (let i = 0; i < nb; i++) branch(x2, y2, a + (i - (nb - 1) / 2) * (0.5 + rr() * 0.35), len * (0.66 + rr() * 0.16), dep - 1, Math.max(1.6, tk * 0.72), o, rr);
        } else if (o === 0) tips.push([x2, y2]);
      };
      for (let i = 0; i < 6; i++) {
        const cx = Math.round((i + 0.5) * (w / 6) + r.int(-25, 25)), base = Math.round(ridge(cx)) + 3, s = r.int(34, 56), seed = r.int(1, 1e6);
        wrap(w, (o) => { const rr = lrng(seed); branch(cx, base, -Math.PI / 2 + (rr() - 0.5) * 0.4, s, 4, 5.5, o, rr); });
      }
      for (let i = 0; i < 4; i++) { // leques
        const cx = r.int(0, w), base = Math.round(ridge(cx)) + 2, R = r.int(20, 34);
        wrap(w, (o) => {
          for (let dy = 0; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const d = Math.hypot(dx, dy * 1.05);
            if (d > R) continue;
            const a = Math.atan2(dy, dx);
            if (d > R - 2 || Math.abs((((a * 8) / Math.PI) % 1) - 0.5) > 0.4 || Math.abs(((d / 5) % 1) - 0.5) > 0.38) pc.px(cx + dx + o, base - 2 - dy, P.cor);
          }
          pc.rect(cx - 1 + o, base - 3, 3, 4, P.cor);
        });
      }
      for (let i = 0; i < 5; i++) { // esponjas tubulares
        const cx = r.int(0, w), base = Math.round(ridge(cx)) + 3;
        wrap(w, (o) => { for (let k = 0; k < 3; k++) { const hh = 14 + ((cx * 7 + k * 13) % 22); pc.rect(cx + k * 7 + o, base - hh, 5, hh, P.cor); pc.hline(cx + k * 7 - 1 + o, base - hh, 7, P.cor); } });
      }
      ridgeFill(pc, w, h, ridge, P.corD);
      rim(pc, P.corL, P.corD);
      if (P.dots) for (const [x, y] of tips) { const col = P.dots[(x * 7 + y) % 3 | 0]; wrap(w, (o) => { pc.px(Math.round(x) + o, Math.round(y), col); pc.px(Math.round(x) + o, Math.round(y) - 1, col + '60'); }); }
      else for (const [x, y] of tips) wrap(w, (o) => pc.px(Math.round(x) + o, Math.round(y), P.corL));
    },
    uwAnim: schools(0.13, 40, 150, 7), get animate() { return introOnly(this.uwAnim); },
  },
  // 3) navio de brinquedo naufragado
  {
    width: 760, height: 210, speed: 0.22, speedY: 0.12, get fillBelow() { return PAL[curTod].fill3; },
    paint(pc, w, h, tod, ld) {
      curTod = todOf(tod);
      if (ld && ld.map) return; // fase: desenhado recortado por sky()
      const P = PAL[curTod]; const r = lrng(77);
      const ridge = (x) => h - 26 + 8 * Math.sin((TAU * 2 * x) / w + 2) + 3 * Math.sin((TAU * 5 * x) / w);
      const cx = 250, base = Math.round(ridge(250)) - 6, ang = -0.13;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const R = ([x, y]) => [cx + x * ca - y * sa, base + x * sa + y * ca];
      const poly = (pts, c) => pc.poly(pts.map(R), c);
      // mastro quebrado e vela rasgada (atrás do casco)
      const m0 = R([10, -46]), m1 = R([-4, -150]);
      pc.thickLine(m0[0], m0[1], m1[0], m1[1], 2.2, P.shp);
      const s0 = R([-46, -124]), s1 = R([44, -132]);
      pc.thickLine(s0[0], s0[1], s1[0], s1[1], 1.2, P.shp);
      poly([[-44, -122], [42, -130], [38, -92], [26, -98], [14, -84], [2, -96], [-14, -86], [-30, -98], [-40, -90]], P.sail);
      poly([[-4, -150], [12, -156], [6, -146]], P.shp);
      // casco
      poly([[-100, -48], [104, -58], [86, 4], [-80, 8]], P.shp);
      poly([[-98, -46], [102, -56], [100, -48], [-96, -38]], P.stripe);
      poly([[-95, -36], [99, -46], [94, -26], [-90, -16]], P.hull);
      poly([[-60, -66], [-10, -68], [-8, -48], [-58, -46]], P.shp); // cabine
      for (let k = 0; k < 6; k++) { // vigias
        const [px, py] = R([-62 + k * 26, -2 - 18]);
        if (P.glow) { pc.circle(px, py, 7, P.glass + '22'); pc.circle(px, py, 5, P.glass + '33'); }
        pc.circle(px, py, 4, P.shpD); pc.circle(px, py, 3, P.glow ? P.glass : P.shpL);
      }
      const [wx0, wy0] = R([-44, -58]); pc.rect(Math.round(wx0), Math.round(wy0), 8, 5, P.glow ? P.glass : P.shpL);
      // brinquedos gigantes meio enterrados
      wrap(w, (o) => {
        const bx = 520 + o, bb = Math.round(ridge(520));
        pc.poly([[bx, bb - 30], [bx + 30, bb - 36], [bx + 36, bb - 6], [bx + 6, bb]], P.shp);
        pc.poly([[bx + 6, bb - 26], [bx + 26, bb - 30], [bx + 30, bb - 10], [bx + 10, bb - 6]], P.shpD);
        const dx = 660 + o, db = Math.round(ridge(660));
        pc.ellipse(dx, db - 8, 30, 16, P.shp); pc.circle(dx + 18, db - 30, 13, P.shp); pc.poly([[dx + 28, db - 32], [dx + 42, db - 29], [dx + 29, db - 25]], P.shp);
        pc.circle(dx + 21, db - 33, 2, P.glow ? P.glass : P.shpL);
        const rx = 90 + o, rb = Math.round(ridge(90));
        ring(pc, rx, rb - 6, 16, 6, P.shp, -1);
      });
      ridgeFill(pc, w, h, ridge, P.shpD);
      rim(pc, P.shpL, P.shpD);
      // corrente da âncora
      for (let k = 0; k < 14; k++) { const [x, y] = R([96 + k * 6, -6 + k * 1.6]); pc.ellipseOutline(x, y, 2.5, 1.5, P.shpD); }
      for (let i = 0; i < 30; i++) { const x = r.int(0, w), y = Math.round(ridge(x)) + r.int(2, 14); pc.px(x, y, P.shpL); }
    },
    uwAnim: jellies(0.22, 5, 33, 10, 170), get animate() { return introOnly(this.uwAnim); },
  },
  // 4) floresta de kelp próxima
  {
    width: 512, height: 170, speed: 0.46, speedY: 0.24, get fillBelow() { return PAL[curTod].fill4; },
    paint(pc, w, h, tod, ld) {
      curTod = todOf(tod);
      if (ld && ld.map) return; // fase: desenhado recortado por sky()
      const P = PAL[curTod]; const r = lrng(91);
      const ridge = (x) => h - 14 + 5 * Math.sin((TAU * 3 * x) / w) + 2 * Math.sin((TAU * 11 * x) / w + 1);
      const kelp = (x0, H, col, seed) => {
        const rr = lrng(seed);
        const base = Math.round(ridge(((x0 % w) + w) % w)) + 2;
        for (let s = 0; s < H; s++) {
          const x = Math.round(x0 + Math.sin(s * 0.045 + seed) * 6 * (s / H));
          pc.rect(x, base - s, 3, 1, col);
          if (s > 10 && s % 7 === 0) {
            const side = (s / 7) & 1 ? 1 : -1, len = 6 + rr.int(0, 6);
            for (let i = 0; i < len; i++) pc.rect(x + 1 + side * (i + 1), base - s - Math.round(i * 0.7), 1, 2 + (i < len - 2 ? 1 : 0), col);
          }
          if (rr() < 0.05) pc.circle(x + 1, base - s, 2, col);
        }
      };
      for (let i = 0; i < 9; i++) { const x = r.int(0, w), H = r.int(60, 120), sd = r.int(1, 999); wrap(w, (o) => kelp(x + o, H, P.kelpL, sd)); }
      for (let i = 0; i < 11; i++) { const x = r.int(0, w), H = r.int(40, 150), sd = r.int(1, 999); wrap(w, (o) => kelp(x + o, H, P.kelp, sd)); }
      for (let i = 0; i < 8; i++) { const x = r.int(0, w), rx = r.int(10, 26); wrap(w, (o) => pc.ellipse(x + o, Math.round(ridge(x)) + 2, rx, rx * 0.5, P.kelpD)); }
      ridgeFill(pc, w, h, ridge, P.kelpD);
      rim(pc, P.kelpL, null);
      if (curTod === 'night') for (let i = 0; i < 26; i++) { const x = r.int(0, w), y = r.int(20, h - 6); if (pc.alphaAt(x, y) > 200) pc.px(x, y, ['#5ff8f0', '#ff7ac8', '#b48aff'][i % 3]); }
    },
    uwAnim: snow(26, 0.5, 5, true), get animate() { return introOnly(this.uwAnim); },
  },
];

const front = [
  // névoa de cáusticas sutil (luz ondulante na frente de tudo)
  {
    width: 384, height: 280, speed: 0.9, speedY: 0, anchor: 'top', drift: 6, get alpha() { return PAL[curTod].hazeA; },
    paint(pc, w, h, tod, ld) {
      curTod = todOf(tod);
      if (ld && ld.map) return; // fase: desenhado recortado por sky()
      const P = PAL[curTod]; const r = lrng(404);
      const pts = Array.from({ length: 22 }, () => [r() * w, r() * h]);
      for (let y = 0; y < h; y++) {
        const fade = Math.max(0, 1 - y / (h * 0.8));
        if (fade <= 0) continue;
        for (let x = 0; x < w; x++) {
          let d1 = 1e9, d2 = 1e9;
          for (const [qx, qy] of pts) {
            let dx = Math.abs(x - qx); if (dx > w / 2) dx = w - dx;
            const dy = Math.abs(y - qy);
            const d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          const e = Math.sqrt(d2) - Math.sqrt(d1);
          if (e < 1.6 && ((x * 3 + y * 5) & 3) !== 0) pc.px(x, y, P.haze + (fade > 0.5 ? '22' : '14'));
        }
      }
    },
    uwAnim: snow(18, 1.1, 9, false),
    animate(ctx, cam, t, w, h, y) {
      if (cam.rx === undefined) { this.uwAnim(ctx, cam, t, w, h, y); return; }
      // fase: névoa de cáusticas + neve marinha só dentro da água do mar, presa à superfície
      if (!LV || !MASK.length || Math.abs((cam.zoom ?? 1) - 1) > 0.001) return;
      const tod = activeTod, key = 'haze:' + tod;
      if (!_airBake[key]) { const pc = new PixelCanvas(384, 280); this.paint(pc, 384, 280, tod, null); pc.flush(); _airBake[key] = pc.canvas; }
      ctx.save();
      clipRects(ctx, MASK);
      ctx.globalAlpha = PAL[tod].hazeA;
      tileX(ctx, _airBake[key], 384, cam.x * 0.9 + t * 6, Math.round(SEAY - 6), w);
      ctx.globalAlpha = 1;
      this.uwAnim(ctx, cam, t, w, h, y);
      ctx.restore();
    },
  },
];

registerBackground('w2', { sky, layers, front, defaultTimeOfDay: 'day' });
