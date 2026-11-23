// =============================================================================
// art/ui_kit.js — Kit de interface "pelúcia & costura".
//   drawPanel / drawButton / drawLogo / drawBar / drawCursor  (assinaturas fixas)
//   drawDisc(ctx, cx, cy, r, color, pressed)  botão redondo de feltro (toque/HUD)
//   Ícones (defineImage): icon_* (10–13 px, contorno 1 px) e ctl_* (glifos dos
//   botões de toque, 16–22 px). Tudo procedural e cacheado.
// =============================================================================
import { defineImage, getImage } from '../../engine/sprites.js';
import { PixelCanvas, createCanvas } from '../../engine/pixel.js';
import { lighten, darken } from '../../engine/util.js';
import font from '../../engine/font.js';

export const INK = '#1b1030';

// --------------------------------------------------------------------- cores
const shadeCache = new Map();
function tones(c) {
  let t = shadeCache.get(c);
  if (!t) { t = { hi: lighten(c, 0.4), lo: darken(c, 0.28), st: lighten(c, 0.62), dk: darken(c, 0.12) }; shadeCache.set(c, t); }
  return t;
}

// ------------------------------------------------------------------- painéis
const PANEL = {
  paper: { ink: '#2a1840', base: '#fff4dc', alt: '#f5e6c6', hi: '#fffbf0', lo: '#e0c696', st: '#c8925a', r: 2 },
  dark: { ink: '#0b0716', base: '#2a1f4a', alt: '#251b42', hi: '#3f3168', lo: '#1c1434', st: '#7a68b8', r: 2 },
  wood: { ink: '#2a1408', base: '#a0703a', alt: '#8c5f30', hi: '#c48c4c', lo: '#6e4620', st: null, r: 1, wood: true },
  balloon: { ink: '#1b1030', base: '#fff8e8', alt: '#fff8e8', hi: '#ffffff', lo: '#ead8b8', st: null, r: 3 },
  glass: { ink: '#1b1030', base: '#24305ad8', alt: '#212b52d8', hi: '#5a7ac0', lo: '#18203ee0', st: '#7fa8e0', r: 2 },
  gold: { ink: '#3a2008', base: '#ffd23f', alt: '#f6c634', hi: '#fff0a0', lo: '#d09a20', st: '#9a6410', r: 2 },
  felt: { ink: '#0f3a3a', base: '#3fc7c0', alt: '#39b9b2', hi: '#7fe6df', lo: '#2a9d97', st: '#d8fffb', r: 2 },
  red: { ink: '#3a0a1c', base: '#e8456a', alt: '#dc3e62', hi: '#ff8aa4', lo: '#a82a4c', st: '#ffd0dc', r: 2 },
};
const panelCache = new Map();

function cornerInside(x, y, w, h, r) {
  const cx = x < r ? r - x : x > w - 1 - r ? x - (w - 1 - r) : 0;
  const cy = y < r ? r - y : y > h - 1 - r ? y - (h - 1 - r) : 0;
  return cx === 0 || cy === 0 || cx * cx + cy * cy <= r * r;
}

function buildPanel(w, h, s) {
  const pc = new PixelCanvas(w, h);
  const r = Math.max(0, Math.min(s.r, Math.floor(Math.min(w, h) / 3)));
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && cornerInside(x, y, w, h, r);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) { pc.px(x, y, s.ink); continue; }
      const top = !inside(x, y - 2) || !inside(x - 2, y);
      const bot = !inside(x, y + 2) || !inside(x + 2, y);
      let c = s.base;
      if (s.wood) { if ((y * 5 + ((x >> 3) * 3)) % 7 === 0 || (x * 3 + y * 11) % 23 === 0) c = s.alt; } else if ((x + y * 2) % 5 === 0) c = s.alt;
      if (top) c = s.hi; else if (bot) c = s.lo;
      pc.px(x, y, c);
    }
  }
  // pesponto (linha tracejada) a 3 px da borda
  if (s.st && w >= 12 && h >= 10) {
    const i0 = 3, x1 = w - 4, y1 = h - 4;
    let k = 0;
    const dash = (x, y) => { if (k++ % 4 < 2) pc.px(x, y, s.st); };
    for (let x = i0 + 1; x <= x1 - 1; x++) dash(x, i0);
    for (let y = i0 + 1; y <= y1 - 1; y++) dash(x1, y);
    for (let x = x1 - 1; x >= i0 + 1; x--) dash(x, y1);
    for (let y = y1 - 1; y >= i0 + 1; y--) dash(i0, y);
  }
  if (s.wood && w >= 10 && h >= 10) {
    for (const [nx, ny] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) { pc.px(nx, ny, '#f0d8a8'); pc.px(nx + 1, ny + 1, '#4a2a10'); }
  }
  pc.flush();
  return pc.canvas;
}

/** Painel. style: 'paper' | 'dark' | 'wood' | 'balloon' | 'glass' (+ 'gold' 'felt' 'red') */
export function drawPanel(ctx, x, y, w, h, style = 'dark') {
  w = Math.round(w); h = Math.round(h);
  if (w < 3 || h < 3) return;
  const s = PANEL[style] || PANEL.dark;
  const key = style + '|' + w + '|' + h;
  let img = panelCache.get(key);
  if (!img) {
    if (panelCache.size > 160) panelCache.clear();
    img = buildPanel(w, h, s);
    panelCache.set(key, img);
  }
  ctx.drawImage(img, Math.round(x), Math.round(y));
}

/** Botão com rótulo. opts: { selected, disabled, icon, style } */
export function drawButton(ctx, x, y, w, h, label, opts = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const sel = !!opts.selected, dis = !!opts.disabled;
  const style = opts.style || (sel ? 'gold' : 'dark');
  // "lábio" inferior (botão de tecido acolchoado)
  ctx.fillStyle = '#0b0716';
  ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
  drawPanel(ctx, x, y, w, h - 1, style);
  const s = PANEL[style] || PANEL.dark;
  const color = dis ? '#7a6a9a' : (style === 'dark' || style === 'glass' || style === 'red' || style === 'wood') ? '#fff4dc' : s.ink;
  let cx = x + Math.floor(w / 2);
  const ty = y + Math.floor((h - 1 - 7) / 2);
  if (opts.icon) {
    const img = getImage(opts.icon);
    if (img) {
      const lw = font.measure(label || '');
      const total = img.width + (label ? 3 + lw : 0);
      const ix = x + Math.floor((w - total) / 2);
      ctx.globalAlpha *= dis ? 0.5 : 1;
      ctx.drawImage(img, ix, y + Math.floor((h - 1 - img.height) / 2));
      ctx.globalAlpha = dis ? ctx.globalAlpha * 2 : ctx.globalAlpha;
      cx = ix + img.width + 3 + Math.floor(lw / 2);
    }
  }
  if (label) font.draw(ctx, label, cx, ty, { align: 'center', color, shadow: style === 'dark' && !dis ? '#0b0716' : undefined });
  if (sel) { // brilho piscante nos cantos
    ctx.fillStyle = '#fffbe0';
    ctx.fillRect(x + 2, y + 2, 2, 1); ctx.fillRect(x + 2, y + 3, 1, 1);
  }
}

/** Barra de progresso. colors: { bg, fill, border } */
export function drawBar(ctx, x, y, w, h, ratio, colors = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 3 || h < 3) return;
  const ink = colors.border || INK, bg = colors.bg || '#2a1f4a', fill = colors.fill || '#55d0ff';
  ratio = Math.max(0, Math.min(1, ratio || 0));
  ctx.fillStyle = ink;
  ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = bg; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (h >= 5) { ctx.fillStyle = darken(bg, 0.25); ctx.fillRect(x + 1, y + 1, w - 2, 1); }
  const fw = Math.round((w - 2) * ratio);
  if (fw > 0) {
    const t = tones(fill);
    ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, fw, h - 2);
    if (h >= 4) {
      ctx.fillStyle = t.hi; ctx.fillRect(x + 1, y + 1, fw, 1);
      ctx.fillStyle = t.lo; ctx.fillRect(x + 1, y + h - 2, fw, 1);
    }
    if (h >= 5) { ctx.fillStyle = t.dk; for (let i = 2; i < fw - 1; i += 3) ctx.fillRect(x + 1 + i, y + 2, 1, h - 4); }
    ctx.fillStyle = t.st; ctx.fillRect(x + fw, y + 1, 1, h - 2);
  }
}

/** Cursor/seta de seleção apontando para a direita, ponta em (x,y). (agulha com linha) */
export function drawCursor(ctx, x, y, t = 0) {
  const img = getImage('ui_needle');
  if (!img) return;
  const o = Math.round(Math.sin(t * 8) * 1.5);
  ctx.drawImage(img, Math.round(x) - 13 + o, Math.round(y) - 2);
}

// ------------------------------------------------------------ disco de feltro
const discCache = new Map();
function buildDisc(r, col, pressed) {
  const size = r * 2 + 1;
  const pc = new PixelCanvas(size, size + 2);
  const c = r + 0.5;
  const base = pressed ? darken(col, 0.18) : col;
  const t = tones(base);
  const step = Math.PI * 2 / Math.max(10, Math.round(r * 1.6) * 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
      if (d > r) continue;
      let k = base;
      if (d > r - 1) k = INK;
      else {
        const sh = (dx + dy) / r;
        if (d > r - 2.3 && sh < -0.35) k = t.hi;
        else if (d > r - 2.3 && sh > 0.35) k = t.lo;
        else if (d > r - 4.2 && d <= r - 3.2 && r >= 9) {
          const a = Math.atan2(dy, dx) + Math.PI;
          if (Math.floor(a / step) % 2 === 0) k = t.st;
        } else if (!pressed && dx < -r * 0.25 && dy < -r * 0.25 && d < r * 0.62 && d > r * 0.4) k = t.hi;
      }
      pc.px(x, y, k);
    }
  }
  if (!pressed) { // sombra projetada
    for (let y = 0; y < size + 2; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= r) continue;
        if (Math.hypot(x + 0.5 - c, y - 2 + 0.5 - c) <= r - 0.3) pc.px(x, y, '#0b071699');
      }
    }
  }
  pc.flush();
  return pc.canvas;
}
/** Botão redondo de feltro centrado em (cx,cy). */
export function drawDisc(ctx, cx, cy, r, color = '#3fc7c0', pressed = false) {
  r = Math.max(4, Math.round(r));
  const key = r + color + (pressed ? 'p' : '');
  let img = discCache.get(key);
  if (!img) { if (discCache.size > 80) discCache.clear(); img = buildDisc(r, color, pressed); discCache.set(key, img); }
  ctx.drawImage(img, Math.round(cx) - r, Math.round(cy) - r + (pressed ? 1 : 0));
}

// ---------------------------------------------------------------------- logo
let logoImg = null;
let logoMeta = null;

function textMask(text) {
  const w = Math.max(1, font.measure(text)) + 1, h = 8;
  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  font.draw(g, text, 0, 0, { color: '#ffffff' });
  const d = g.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  let maxX = 0;
  for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 100) { m[i] = 1; maxX = Math.max(maxX, i % w); }
  return { w: maxX + 1, h, stride: w, m };
}

function buildLogo() {
  const W = 216, H = 82;
  const code = new Uint8Array(W * H); // 0 vazio, 1 STITCHED, 2 WORLDS, 3 botão
  const stamp = (mask, ox, oy, s, id) => {
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
      if (!mask.m[y * mask.stride + x]) continue;
      for (let j = -1; j <= s; j++) for (let i = -1; i <= s; i++) { // escala + engrossa 1 px
        const X = ox + x * s + i, Y = oy + y * s + j;
        if (X >= 0 && Y >= 0 && X < W && Y < H && !code[Y * W + X]) code[Y * W + X] = id;
      }
    }
  };
  // STITCHED (x3)
  const st = textMask('STITCHED');
  const stW = st.w * 3, stX = Math.round((W - stW) / 2), stY = 6;
  stamp(st, stX, stY, 3, 1);
  // WORLDS (x4) com o O substituído por um botão de costura
  const parts = ['W', 'O', 'R', 'L', 'D', 'S'];
  const masks = parts.map((p) => textMask(p));
  const btnD = 30, gap = 6;
  let total = 0;
  masks.forEach((m, i) => { total += (i === 1 ? btnD - 2 : m.w * 4) + (i ? gap : 0); });
  let x = Math.round((W - total) / 2);
  const wY = stY + 7 * 3 + 6;
  let btn = null;
  masks.forEach((m, i) => {
    if (i) x += gap;
    if (i === 1) { btn = { cx: x + (btnD - 2) / 2 - 0.5, cy: wY + 13.5, r: btnD / 2 }; x += btnD - 2; return; }
    stamp(m, x, wY, 4, 2);
    x += m.w * 4;
  });
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    if (Math.hypot(xx + 0.5 - btn.cx - 0.5, y + 0.5 - btn.cy - 0.5) <= btn.r) code[y * W + xx] = 3;
  }
  // distâncias (manhattan): fora das letras e profundidade dentro
  const out = new Uint8Array(W * H).fill(255), dep = new Uint8Array(W * H).fill(255);
  let q = [];
  for (let i = 0; i < W * H; i++) if (code[i]) { out[i] = 0; q.push(i); }
  for (let d = 1; d <= 5 && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const xx = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = xx + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const k = Y * W + X;
        if (out[k] === 255) { out[k] = d; nq.push(k); }
      }
    }
    q = nq;
  }
  q = [];
  for (let i = 0; i < W * H; i++) {
    if (!code[i]) continue;
    const xx = i % W, y = (i / W) | 0;
    const diff = (X, Y) => X < 0 || Y < 0 || X >= W || Y >= H || code[Y * W + X] !== code[i];
    if (diff(xx + 1, y) || diff(xx - 1, y) || diff(xx, y + 1) || diff(xx, y - 1)) { dep[i] = 1; q.push(i); }
  }
  for (let d = 2; d <= 6 && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const xx = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = xx + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const k = Y * W + X;
        if (code[k] === code[i] && dep[k] === 255) { dep[k] = d; nq.push(k); }
      }
    }
    q = nq;
  }

  const pc = new PixelCanvas(W, H);
  // --- fios em espiral (atrás de tudo)
  const sw = new PixelCanvas(W, H);
  const swirl = (cx, cy, r0, r1, a0, turns, col, dir) => {
    for (let a = 0; a <= turns * Math.PI * 2; a += 0.04) {
      const r = r0 + (r1 - r0) * (a / (turns * Math.PI * 2));
      sw.px(Math.round(cx + Math.cos(a0 + a * dir) * r), Math.round(cy + Math.sin(a0 + a * dir) * r), col);
    }
  };
  swirl(stX - 8, stY + 14, 1, 9, 0, 1.6, '#ff6b8a', -1);
  swirl(W - stX + 8, stY + 8, 1, 8, Math.PI, 1.5, '#7fe6df', 1);
  sw.curve(stX - 15, stY + 22, stX - 20, wY + 30, stX + 10, wY + 33, '#ff6b8a');
  sw.curve(W - stX + 14, stY + 14, W - stX + 22, wY + 24, W - stX - 6, wY + 34, '#7fe6df');
  // agulha prateada na ponta do fio azul
  sw.thickLine(W - stX + 15, stY + 6, W - stX + 24, stY - 2, 0.8, '#e8eef8');
  sw.px(W - stX + 23, stY - 1, '#9aa4c0'); sw.px(W - stX + 16, stY + 6, '#9aa4c0');
  sw.outline(INK);
  pc.blit(sw, 0, 0);
  // --- sombra, fundo de feltro com pesponto, contorno
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx;
    const o = out[i];
    if (o > 4 && y >= 3 && out[(y - 3) * W + xx] <= 4) pc.px(xx, y, '#0b0716aa');
    if (o === 0 || o > 4) continue;
    if (o === 1 || o === 4) pc.px(xx, y, INK);
    else if (o === 3 && ((xx >> 1) + (y >> 1)) % 2 === 0) pc.px(xx, y, '#fff4dc');
    else pc.px(xx, y, o === 2 ? '#4a3a7a' : '#3b2d63');
  }
  // --- letras
  const pal = {
    1: { g: ['#e6fbff', '#a8e8ff', '#7fd6ff', '#5fbcef', '#3f98d8'], hi: '#ffffff', lo: '#2f6fb0', seam: '#2f78c0' },
    2: { g: ['#fff6b8', '#ffe27a', '#ffd23f', '#f2b428', '#d48c18'], hi: '#fffbe0', lo: '#9a5a10', seam: '#a8661a' },
  };
  const bandOf = (id) => id === 1 ? [stY - 1, stY + 21] : [wY - 1, wY + 29];
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx, id = code[i];
    if (!id) continue;
    if (id === 3) {
      const dx = xx + 0.5 - btn.cx - 0.5, dy = y + 0.5 - btn.cy - 0.5, d = Math.hypot(dx, dy);
      let k;
      if (d > btn.r - 1.2) k = INK;
      else if (d > btn.r - 4.2) k = (dx + dy) < -4 ? '#fff0a0' : (dx + dy) > 6 ? '#c9861a' : '#ffd23f';
      else if (d > btn.r - 5.2) k = '#b0701a';
      else k = (dx + dy) > 3 ? '#f0b428' : '#ffdc5a';
      pc.px(xx, y, k);
      continue;
    }
    const p = pal[id], [b0, b1] = bandOf(id);
    const f = Math.max(0, Math.min(0.999, (y - b0) / (b1 - b0)));
    let k = p.g[Math.floor(f * p.g.length)];
    const dd = dep[i];
    const up = y > 0 && code[i - W] === id, dn = y < H - 1 && code[i + W] === id;
    if (dd === 1 && !up) k = p.hi;
    else if (dd === 1 && !dn) k = p.lo;
    else if (dd === 1 && xx > 0 && code[i - 1] !== id) k = lighten(k, 0.3);
    else if (dd === 3 && (xx + y) % 4 < 2) k = p.seam;
    pc.px(xx, y, k);
  }
  // furos do botão + linha rosa em X
  const hc = [[-5, -5], [4, -5], [-5, 4], [4, 4]];
  for (const [hx, hy] of hc) {
    const X = Math.round(btn.cx + hx), Y = Math.round(btn.cy + hy);
    pc.rect(X, Y, 3, 3, '#5a3008'); pc.px(X, Y, '#3a1c04');
  }
  const bx = Math.round(btn.cx), by = Math.round(btn.cy);
  pc.thickLine(bx - 3, by - 3, bx + 4, by + 4, 0.7, '#ff6b8a');
  pc.thickLine(bx + 4, by - 3, bx - 3, by + 4, 0.7, '#ff8fa8');
  pc.px(bx - 9, by - 9, '#ffffff'); pc.px(bx - 8, by - 10, '#ffffff'); pc.px(bx - 10, by - 8, '#fffbe0');
  // --- fita do subtítulo
  const label = 'O ÚLTIMO BRINQUEDO';
  const lw = font.measure(label);
  const rw = lw + 40, rh = 13, rx = Math.round((W - rw) / 2), ry = wY + 31;
  const tail = (x0, dir) => {
    const P = (pts) => pts.map(([a, b]) => [x0 + a * dir, ry + 3 + b]);
    const o = dir > 0 ? 0 : 1;
    pc.poly(P([[0 + o, 0], [11, 0], [7, rh / 2], [11, rh], [0 + o, rh]]), INK);
    pc.poly(P([[0 + o, 1], [9.2, 1], [5.6, rh / 2], [9.2, rh - 1], [0 + o, rh - 1]]), '#a02848');
    pc.poly(P([[0 + o, 1], [9.2, 1], [8, 2], [0 + o, 2]]), '#c23a5c');
  };
  tail(rx - 1, -1); tail(rx + rw, 1);
  for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
    const edge = j === 0 || j === rh - 1 || i === 0 || i === rw - 1;
    let k = edge ? INK : j === 1 ? '#ff8aa4' : j === rh - 2 ? '#b02a50' : '#e8456a';
    if (!edge && (j === 2 || j === rh - 3) && i > 2 && i < rw - 3 && i % 4 < 2) k = '#ffd0dc';
    pc.px(rx + i, ry + j, k);
  }
  // pequenos "—" costurados dos lados do texto
  for (const sx of [rx + 6, rx + rw - 15]) { pc.hline(sx, ry + 6, 9, '#fff4dc'); pc.px(sx + 4, ry + 5, '#fff4dc'); pc.px(sx + 4, ry + 7, '#fff4dc'); }
  pc.flush();
  const g = pc.canvas.getContext('2d');
  font.draw(g, label, Math.round(W / 2), ry + 3, { align: 'center', color: '#fff4dc', shadow: '#7a1435' });
  logoMeta = { btn: { x: bx - 9, y: by - 9 }, s: { x: stX + 4, y: stY + 2 }, w: { x: x - 4, y: wY + 2 } };
  return pc.canvas;
}

/** Logo do jogo centralizado em cx (y = topo). Tamanho em scale 1: 216×82. */
export function drawLogo(ctx, cx, y, scale = 1, t = 0) {
  if (!logoImg) logoImg = buildLogo();
  const w = Math.round(logoImg.width * scale), h = Math.round(logoImg.height * scale);
  const x0 = Math.round(cx - w / 2), y0 = Math.round(y + Math.sin(t * 1.6) * 1.2 * scale);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(logoImg, x0, y0, w, h);
  ctx.imageSmoothingEnabled = prev;
  // brilhos
  const sp = [logoMeta.btn, logoMeta.s, logoMeta.w];
  sp.forEach((p, i) => {
    const ph = (t * 0.7 + i * 0.37) % 1.6;
    if (ph > 0.5) return;
    const k = Math.round((1 - Math.abs(ph - 0.25) * 4) * 3);
    const px = x0 + Math.round(p.x * scale), py = y0 + Math.round(p.y * scale), s = Math.max(1, Math.round(scale));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px - k * s, py, (k * 2 + 1) * s, s);
    ctx.fillRect(px, py - k * s, s, (k * 2 + 1) * s);
  });
}

// ===================================================================== ÍCONES
function icon(name, rows, pal, opts = {}) {
  const w = Math.max(...rows.map((r) => r.length)) + 2, h = rows.length + 2;
  defineImage(name, w, h, (pc) => { pc.ascii(rows, pal, 1, 1, opts); opts.extra?.(pc); pc.outline(INK); });
}
function iconFn(name, w, h, fn) {
  defineImage(name, w, h, (pc) => { pc.translate(1, 1); fn(pc); pc.resetTranslate(); pc.outline(INK); });
}

// --- corações de pelúcia com costura no meio
const HEART = [
  '.HHR...RRR.',
  'HWHRR.RRRRS',
  'HHRRRRRRRRS',
  'RRRRRdRRRRS',
  'RRRRRRRRRSS',
  '.RRRRdRRRS.',
  '..RRRRRRS..',
  '...RRdRS...',
  '....RSS....',
  '.....S.....',
];
const HP_FULL = { H: '#ff9ab4', W: '#ffffff', R: '#ff4f7a', S: '#c22a55', d: '#a01a44' };
const HP_EMPTY = { H: '#563868', W: '#62447a', R: '#3a2448', S: '#2c1a3a', d: '#4e3262' };
icon('icon_heart', HEART, HP_FULL);
icon('icon_heart_empty', HEART, HP_EMPTY);
icon('icon_heart_half', HEART, HP_EMPTY, { extra: (pc) => pc.ascii(HEART.map((r) => r.slice(0, 6)), HP_FULL, 1, 1) });
// silhueta branca (piscar ao levar dano)
icon('icon_heart_flash', HEART, { H: '#fff', W: '#fff', R: '#fff', S: '#ffd0dc', d: '#ffe0e8' });

icon('icon_energy', [
  'wWWWWWWWw',
  'bbbbbbbbb',
  '.LTTLTTD.',
  '.TLTTLTD.',
  '.TTLTTLD.',
  '.LTTLTTD.',
  '.TLTTLTD.',
  'wWWWWWWWw',
  'bbbbbbbbb',
], { W: '#f0c088', w: '#c8904c', b: '#8a5a2a', L: '#d8f8ff', T: '#55d0ff', D: '#2a8fc8' });

icon('icon_button', [
  '..HHHGG..',
  '.HGGGGGD.',
  'HGgggggGD',
  'HGgkgkgGD',
  'GGgggggGD',
  'GGgkgkgDD',
  'GGgggggDD',
  '.GDDDDDD.',
  '..DDDDD..',
], { H: '#fff0a0', G: '#ffd23f', g: '#ecb426', k: '#5a3008', D: '#b07810' });

const STAR = [
  '.....H.....',
  '....HYY....',
  '....HYO....',
  'HHHHYYYYYYO',
  '.HYYYsYYYO.',
  '..YYYYYYO..',
  '..YYYYYYO..',
  '.YYO...YYO.',
  '.YO.....YO.',
  'O.........O',
];
icon('icon_star', STAR, { H: '#fff3a0', Y: '#ffd23f', O: '#d0901a', s: '#fffbe0' });
icon('icon_star_empty', STAR, { H: '#5a4e7a', Y: '#3e3458', O: '#2e2644', s: '#4e4270' });

iconFn('icon_patch', 11, 11, (pc) => {
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    if ((x === 0 && y === 0) || (x === 8 && y === 8)) continue;
    let c = ((x >> 1) + (y >> 1)) & 1 ? '#c86aff' : '#b252f0';
    if (y === 0 || x === 0) c = '#e0a8ff';
    if (y === 8 || x === 8) c = '#8a34c0';
    if ((x === 2 || x === 6 || y === 2 || y === 6) && x >= 2 && x <= 6 && y >= 2 && y <= 6 && (x + y) % 2 === 0) c = '#f8e0ff';
    pc.px(x, y, c);
  }
});

iconFn('icon_thread', 12, 12, (pc) => {
  pc.circle(4.5, 4.5, 4.5, '#e8a820');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    if (Math.hypot(x + 0.5 - 4.5, y + 0.5 - 4.5) > 4.4) continue;
    if ((x - y + 30) % 3 === 0) pc.px(x, y, x + y < 8 ? '#fff4b0' : '#ffd860');
    else if (x + y > 10) pc.px(x, y, '#b07810');
  }
  pc.px(8, 8, '#ffd860'); pc.px(9, 9, '#ffd860'); pc.px(9, 8, '#ffd860');
});

icon('icon_memory', [
  '..PPPPP..',
  '.PLLPPPP.',
  'PLLPPPPPD',
  'PLWWPWWPD',
  'PPWWWWWPD',
  'PPPWWWPPD',
  'PPPPWPPDD',
  '.PPPPPDD.',
  '..DDDDD..',
], { P: '#ff9ad8', L: '#ffd8f0', W: '#ffffff', D: '#d060a8' });

icon('icon_secret', [
  '..GGGGG..',
  '.GLWWWGG.',
  'GLWGGGWGD',
  'GGGGGGWGD',
  'GGGGGWGGD',
  'GGGGWGGGD',
  'GGGGGGGDD',
  '.GGGWGDD.',
  '..DDDDD..',
], { G: '#5fe0a0', L: '#b8ffd8', W: '#ffffff', D: '#2a9a68' });

icon('icon_ab_stitch', [
  '.......LS.',
  '......L.S.',
  '......SSG.',
  '.....SS.G.',
  '....SS...G',
  '...SS....G',
  '..SS....G.',
  '.SS...GG..',
  'SS..GG....',
  'D.GG......',
], { L: '#ffffff', S: '#c8d0e0', D: '#8a94b0', G: '#ffd23f' });

icon('icon_ab_unstitch', [
  'S.......S',
  'SL.....LS',
  '.SL...LS.',
  '..SL.LS..',
  '...SPS...',
  '...H.H...',
  '..H...H..',
  '.HH...HH.',
  'H..H.H..H',
  'H..H.H..H',
  '.HH...HH.',
], { S: '#b8c4dc', L: '#ffffff', P: '#ffd23f', H: '#ff8a3c' });

iconFn('icon_ab_rewind', 13, 13, (pc) => {
  pc.circle(5.5, 5.5, 5.4, '#3a8fd0');
  pc.circle(5.5, 5.5, 4.4, '#7fd6ff');
  pc.circle(5.5, 5.5, 3.2, '#e8f8ff');
  pc.vline(5, 3, 3, INK); pc.hline(3, 5, 3, INK);
  // seta anti-horária no topo-esquerdo
  pc.rect(0, 0, 4, 4, '#00000000');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (x + y < 3) pc.erase(x, y);
  pc.tri(0, 0, 5, 0, 0, 5, '#c8f0ff');
  pc.px(1, 1, '#ffffff');
});

icon('icon_ab_decoy', [
  '..GGGGG..',
  '.GLLGGGG.',
  'GLGGGGGGD',
  'GLkGGGkGD',
  'GGkGGGkGD',
  'GGGGGGGGD',
  'GsGsGsGsD',
  'GGGGGGGGD',
  'GG.GGG.GD',
  'G...G...D',
], { G: '#c8f4ff', L: '#ffffff', D: '#7fb8d8', k: INK, s: '#8ad0f0' });

iconFn('icon_ab_unravel', 13, 13, (pc) => {
  for (let a = 0; a < Math.PI * 4.1; a += 0.04) {
    const r = 0.36 * a;
    pc.px(Math.round(5 + Math.cos(a) * r), Math.round(5 + Math.sin(a) * r), a > 9 ? '#ff4fd8' : '#ffb0ec');
  }
  pc.px(5, 5, '#ffffff');
});

icon('icon_lock', [
  '..SSSSS..',
  '.SL...SS.',
  '.S.....S.',
  '.S.....S.',
  'HHHHHHHHG',
  'HGGGGGGGD',
  'GGGGkGGGD',
  'GGGGkGGGD',
  'GGGGGGGGD',
  'DDDDDDDDD',
], { S: '#b8c4dc', L: '#ffffff', H: '#fff0a0', G: '#ffd23f', D: '#b07810', k: INK });

icon('icon_check', [
  '.......LG',
  '......LGD',
  'L....LGD.',
  'GL..LGD..',
  '.GLLGD...',
  '..GGD....',
  '...D.....',
], { L: '#c8ffc0', G: '#6fdf6f', D: '#3a9a3a' });

iconFn('icon_clock', 13, 13, (pc) => {
  pc.rect(4, 0, 3, 2, '#ffd23f');
  pc.circle(5.5, 6.5, 5.2, '#d09a20');
  pc.circle(5.5, 6.5, 4.4, '#ffd23f');
  pc.circle(5.5, 6.5, 3.4, '#fff4dc');
  pc.vline(5, 4, 3, INK); pc.hline(5, 6, 3, INK);
  pc.px(3, 4, '#ffffff');
});

icon('icon_map', [
  'LLLdddLLLdd',
  'LLLdddLLxdx',
  'LLLdddLLLxd',
  'LLLddrLLxdx',
  'LLLdrdLrLdd',
  'LLrdddrLLdd',
  'LrLdddLLLdd',
  'LLLdddLLLdd',
], { L: '#f2dfb8', d: '#d4b684', r: '#e8456a', x: '#e8456a' });

icon('icon_book', [
  '.PPPPPPPP',
  'SPPPPPPPP',
  'SPHHHHHPP',
  'SPHlllHPP',
  'SPHHHHHPP',
  'SPPPPPPPP',
  'SPPPPPPPP',
  'SPPPPPPPP',
  'SwwwwwwwP',
  '.SSSSRSSS',
  '.....R...',
], { S: '#6a2e90', P: '#a05ad0', H: '#fff4dc', l: '#b898d8', w: '#fff4dc', R: '#ff4f7a' });

icon('icon_bag', [
  '...T.T...',
  '....T....',
  '...bbb...',
  '..BBBBB..',
  '.BHBBBBB.',
  'BHBBBBBBD',
  'BHBBGBBBD',
  'BBBBBBBBD',
  '.BBBBBBD.',
  '..DDDDD..',
], { B: '#c08a4a', H: '#e8b878', D: '#8a5a2a', b: '#a0703a', T: '#ff6b8a', G: '#ffd23f' });

icon('icon_shirt', [
  '...HT.TT...',
  '.HHHTwTTTD.',
  'HHTTTTTTTDD',
  'HTTTTTTTTTD',
  '...TTTTTD..',
  '...TTsTTD..',
  '...TTTTTD..',
  '...TTsTTD..',
  '...DDDDDD..',
], { T: '#3fc7c0', H: '#7fe6df', D: '#2a9d97', w: '#d8fffb', s: '#ffd23f' });

iconFn('icon_gear', 12, 12, (pc) => {
  const teeth = [[4, 0], [4, 8], [0, 4], [8, 4], [1, 1], [7, 1], [1, 7], [7, 7]];
  for (const [x, y] of teeth) pc.rect(x, y, 2, 2, '#9aa4c0');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const d = Math.hypot(x + 0.5 - 5, y + 0.5 - 5);
    if (d <= 3.6 && d > 1.3) pc.px(x, y, x + y < 8 ? '#e8eef8' : x + y > 10 ? '#8a94b0' : '#c8d0e0');
  }
});

icon('icon_pause', [
  'WWD.WWD',
  'WWD.WWD',
  'WWD.WWD',
  'WWD.WWD',
  'WWD.WWD',
  'WWD.WWD',
  'WWD.WWD',
], { W: '#fff4dc', D: '#d9bf8f' });

icon('icon_music', [
  '...NNNNNN',
  '...NNNNNN',
  '...N....N',
  '...N....N',
  '...N....N',
  '.NNN..NNN',
  'NNNN.NNNN',
  'NNND.NNND',
  '.DD...DD.',
], { N: '#fff4dc', D: '#d9bf8f' });

icon('icon_sfx', [
  '...S......',
  '..SS...w..',
  'SSSS.w..w.',
  'SSSS..w.w.',
  'SSSS..w.w.',
  'SSSS.w..w.',
  '..SS...w..',
  '...S......',
], { S: '#fff4dc', w: '#7fd6ff' });

icon('icon_skull', [
  '..WWWWW..',
  '.WWWWWWWs',
  'WWWWWWWWs',
  'WkkWWWkks',
  'WkkWWWkks',
  'WWWWkWWWs',
  '.WWWWWWs.',
  '..WkWks..',
  '..WWWWs..',
], { W: '#f4ecdc', s: '#c8bca8', k: INK });

icon('icon_key', [
  '.HHG.......',
  'H..GGGGGGGG',
  'H..GDDDDDDD',
  '.GGD...D.D.',
], { H: '#fff0a0', G: '#ffd23f', D: '#b07810' });

const ARROW = ['...W...', '...WW..', 'WWWWWW.', 'WWWWWWW', 'DDDDDD.', '...DD..', '...D...'];
icon('icon_arrow_r', ARROW, { W: '#fff4dc', D: '#d9bf8f' });
icon('icon_arrow_l', ARROW, { W: '#fff4dc', D: '#d9bf8f' }, { flipX: true });

const HAND = [
  '..WW.....',
  '..WWh....',
  '..WWh....',
  '..WWWWWh.',
  'WhWWWWWWh',
  'WWWWWWWWh',
  '.WWWWWWWh',
  '..WWWWWh.',
  '..ssssss.',
];
icon('icon_hand', HAND, { W: '#fff4dc', h: '#e0c49a', s: '#3fc7c0' });
icon('icon_interact', HAND, { W: '#fff4dc', h: '#e0c49a', s: '#3fc7c0' });

// cursor-agulha
icon('ui_needle', [
  '....HHHHHHHH.',
  'pp.SS.SSSSSSs',
  '..pDDDDDDDD..',
], { H: '#ffffff', S: '#c8d0e0', D: '#8a94b0', s: '#ffffff', p: '#ff6b8a' });

// ============================================================ GLIFOS DE TOQUE
const CW = '#fff4dc', CS = '#d9bf8f';
function ctl(name, size, fn) {
  defineImage(name, size, size, (pc) => { fn(pc); pc.outline(INK); });
}
function scaledAscii(pc, rows, pal, x, y, s) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) pc.rect(x + i * s, y + j * s, s, s, c); } });
}
ctl('ctl_jump', 22, (pc) => {
  pc.poly([[11, 1], [19, 9], [14.5, 9], [14.5, 12], [7.5, 12], [7.5, 9], [3, 9]], CW);
  pc.poly([[11, 1], [19, 9], [14.5, 9], [14.5, 12], [11, 12]], CS);
  pc.px(10, 3, '#ffffff'); pc.px(9, 4, '#ffffff');
  for (let i = 0; i < 3; i++) { pc.ellipseOutline(11, 14.5 + i * 2, 5, 1.2, i % 2 ? '#c8d0e0' : '#ffffff'); }
  pc.rect(4, 19, 14, 2, '#c08a4a'); pc.hline(4, 19, 14, '#e8b878');
});
ctl('ctl_run', 22, (pc) => {
  // linhas de velocidade
  pc.hline(1, 7, 5, CW); pc.hline(0, 11, 6, CW); pc.hline(2, 15, 4, CW);
  // tênis
  pc.poly([[8, 6], [13, 6], [14, 10], [19, 12], [20, 16], [8, 16]], '#ff6b8a');
  pc.poly([[14, 10], [19, 12], [20, 16], [14, 16]], '#d84868');
  pc.rect(8, 6, 5, 2, '#ff9ab4');
  pc.rect(7, 16, 14, 2, CW); pc.hline(7, 17, 14, CS);
  pc.px(10, 9, '#ffffff'); pc.px(12, 11, '#ffffff'); pc.px(10, 12, '#ffffff');
  pc.rect(8, 13, 3, 2, '#ffd23f');
});
ctl('ctl_attack', 22, (pc) => {
  pc.curve(15, 5, 21, 15, 9, 19, '#ff6b8a', 0.6);
  pc.curve(9, 19, 3, 20, 2, 14, '#ff6b8a', 0.6);
  pc.thickLine(4, 18, 16, 4, 0.9, '#e8eef8');
  pc.line(5, 18, 16, 6, '#9aa4c0');
  pc.px(15, 4, INK); pc.px(16, 5, '#ffffff');
  pc.px(4, 19, '#ffffff');
});
ctl('ctl_dash', 22, (pc) => {
  pc.hline(1, 7, 7, '#7fd6ff'); pc.hline(0, 11, 9, '#c8f0ff'); pc.hline(1, 15, 7, '#7fd6ff');
  pc.poly([[10, 3], [14.5, 3], [21, 11], [14.5, 19], [10, 19], [16, 11]], CW);
  pc.poly([[16, 11], [21, 11], [14.5, 19], [10, 19]], CS);
});
ctl('ctl_ability', 22, (pc) => {
  for (const [x, y] of [[2, 4], [19, 6], [3, 17], [18, 18], [11, 0]]) { pc.px(x, y, '#fff6b0'); pc.px(x + 1, y, '#ffd23f'); pc.px(x, y + 1, '#ffd23f'); }
  pc.rect(5, 3, 12, 3, '#e8b878'); pc.hline(5, 5, 12, '#a0703a');
  pc.rect(5, 16, 12, 3, '#e8b878'); pc.hline(5, 18, 12, '#a0703a');
  for (let y = 6; y < 16; y++) for (let x = 7; x < 15; x++) pc.px(x, y, (x + y) % 3 === 0 ? '#fff0a0' : x > 12 ? '#d09a20' : '#ffd23f');
});
ctl('ctl_cycle', 16, (pc) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    if (d >= 4 && d <= 6.2 && !(a > -1.2 && a < -0.3) && !(a > 1.95 && a < 2.85)) pc.px(x, y, dy < 0 ? CW : CS);
  }
  pc.tri(9, 0, 14, 4.5, 9, 7, CW);
  pc.tri(7, 9, 2, 11.5, 7, 16, CS);
});
ctl('ctl_interact', 22, (pc) => { scaledAscii(pc, HAND, { W: CW, h: CS, s: '#3fc7c0' }, 2, 1, 2); });
ctl('ctl_pause', 16, (pc) => { pc.rect(3, 2, 4, 11, CW); pc.rect(9, 2, 4, 11, CW); pc.vline(6, 2, 11, CS); pc.vline(12, 2, 11, CS); });
