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

function sky(ctx, w, h, t, cam, level) {
  const p = skyPreset('w2', level);
  activeTod = todOf(p.tod);
  drawSky(ctx, w, h, t, cam, p);
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
function shafts(ctx, cam, t, w) {
  const P = PAL[activeTod];
  const cv = shaftCanvas(P.shaft);
  const span = w + 140;
  for (let i = 0; i < 5; i++) {
    let x = (i * 157 - cam.x * 0.06 + Math.sin(t * 0.13 + i * 2.1) * 26) % span;
    if (x < 0) x += span;
    ctx.globalAlpha = P.shaftA * (0.55 + 0.45 * Math.sin(t * 0.45 + i * 1.7));
    ctx.drawImage(cv, Math.round(x - 90), -10);
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

// ------------------------------------------------------------------ camadas
const layers = [
  // 1) ruínas distantes e estruturas impossíveis
  {
    width: 640, height: 210, speed: 0.05, speedY: 0.03, get fillBelow() { return PAL[curTod].fill1; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const r = lrng(21);
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
    animate: (ctx, cam, t, w) => shafts(ctx, cam, t, w),
  },
  // 2) corais gigantes
  {
    width: 576, height: 220, speed: 0.13, speedY: 0.07, get fillBelow() { return PAL[curTod].fill2; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const r = lrng(52);
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
    animate: schools(0.13, 40, 150, 7),
  },
  // 3) navio de brinquedo naufragado
  {
    width: 760, height: 210, speed: 0.22, speedY: 0.12, get fillBelow() { return PAL[curTod].fill3; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const r = lrng(77);
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
    animate: jellies(0.22, 5, 33, 10, 170),
  },
  // 4) floresta de kelp próxima
  {
    width: 512, height: 170, speed: 0.46, speedY: 0.24, get fillBelow() { return PAL[curTod].fill4; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const r = lrng(91);
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
    animate: snow(26, 0.5, 5, true),
  },
];

const front = [
  // névoa de cáusticas sutil (luz ondulante na frente de tudo)
  {
    width: 384, height: 280, speed: 0.9, speedY: 0, anchor: 'top', drift: 6, get alpha() { return PAL[curTod].hazeA; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const r = lrng(404);
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
    animate: snow(18, 1.1, 9, false),
  },
];

registerBackground('w2', { sky, layers, front, defaultTimeOfDay: 'day' });
