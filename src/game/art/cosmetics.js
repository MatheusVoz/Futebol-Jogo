// =============================================================================
// art/cosmetics.js — Guarda-roupa do Tico: acessórios cosméticos desbloqueáveis.
//
// Exporta:
//   drawCosmetics(ctx, player, anim, frame, x, y, flip)
//       Chamado por player.js logo após o sprite do Tico. (x,y) = pivô do Tico
//       em coordenadas de mundo. Lê os itens equipados em save.data.cosmetics
//       {hat, neck, back, thread} e posiciona cada um pelas âncoras de
//       frameMeta('tico', anim, frame) → {head, neck, back, tilt} (coordenadas
//       locais do quadro 48x40, pivô (24,39)). `player` pode ser null (cutscenes,
//       vitrine do guarda-roupa): nesse caso não há reação a movimento.
//       `tilt` (opcional) em RADIANOS, positivo = horário no quadro virado p/ a
//       direita (cabeça inclinando p/ frente); valores > 2π são lidos como graus.
//   drawCosmeticPreview(ctx, id, x, y, t)
//       Ícone animado 24x24 do item para a UI (x,y = canto superior esquerdo).
//   threadColor()      → hex da cor de linha equipada (padrão '#ffd23f';
//                        a Arco-Íris varia com o tempo — chame a cada quadro).
//   threadPalette()    → { base, light, dark } da linha equipada.
//   COSMETIC_SLOTS     = ['hat','neck','back','thread']
//   Utilitários p/ a UI: cosmeticsInSlot(slot), ownsCosmetic(id),
//   cosmeticUnlocked(id), cosmeticLockText(id), equipCosmetic(id),
//   isEquipped(id), unequipSlot(slot), totalStars().
//
// Arte: cada acessório é desenhado em pixel art (ASCII ou procedural) SEM
// contorno; o contorno escuro de 1 px é aplicado depois. Chapéus são
// pré-renderizados em 25 inclinações (±90°, passos de 7,5°) com uma rotação
// estilo RotSprite (Scale2x ×2 + amostragem), para acompanhar `tilt` e o
// "balanço" do chapéu ao correr/pular sem perder a nitidez. Capa e cachecol
// reagem ao movimento (vento) e são cacheados por pose. Os dois lados (direita
// e esquerda) usam o mesmo atlas espelhado, exatamente como o sprite do Tico.
// Os ícones do guarda-roupa usam Scale2x da mesma arte + contorno de 1 px.
//
// Regra de design: nenhum item cobre o olho/rosto do Tico — chapéus ficam
// apoiados no topo e um pouco para trás da cabeça; tudo é pequeno, fofo, com
// costuras e materiais de brinquedo (feltro, papel, lã, madeira, latão).
// =============================================================================
import { PixelCanvas, createCanvas, silhouette } from '../../engine/pixel.js';
import { defineSprite, drawSprite, frameMeta, defineImage, getImage, getSprite } from '../../engine/sprites.js';
import { clamp, mixColor, hash2 } from '../../engine/util.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { R, registerCosmetic } from '../registry.js';

export const COSMETIC_SLOTS = ['hat', 'neck', 'back', 'thread'];

const OUT = '#1b2a3a';                 // contorno (mesmo do Tico)
// pivô do quadro do Tico (lido do sprite registrado para acompanhar mudanças de tamanho)
const ticoPivot = () => { const s = getSprite('tico'); return s ? [s.ox, s.oy] : [32, 51]; };
const DEFAULT_META = { head: { x: 30, y: 17 }, neck: { x: 27, y: 24 }, back: { x: 20, y: 24 }, tilt: 0 };
// Ajuste fino por slot (px, no quadro virado p/ a direita) aplicado às âncoras.
const SLOT_OFF = { hat: { x: -1, y: -1 }, neck: { x: 0, y: 0 }, back: { x: 0, y: 0 } };

const ROT_STEP = Math.PI / 24;         // 7,5°
const ROT_N = 12;                      // ±12 passos = ±90°

// ----------------------------------------------------------------- paletas
const PAL = {
  // feltro vermelho
  rL: '#ff8a7a', r: '#e8384a', rD: '#a81e3a', rE: '#6e1430',
  // rosa
  pL: '#ffc2dc', p: '#ff7eb0', pD: '#d64c8a',
  // amarelo / ouro de papel
  yL: '#fff3a0', y: '#ffd23f', yD: '#e0a020', yE: '#a86a14',
  // azul
  bL: '#9fd8ff', b: '#4f9ff0', bD: '#2f63c0', bE: '#22408a',
  // creme / branco
  wL: '#ffffff', w: '#f4ecdc', wD: '#cbbfae', wE: '#9a8e80',
  // preto (feltro escuro)
  kL: '#5a5470', k: '#34304a', kD: '#221e32',
  // madeira
  dL: '#e0a86a', d: '#b87a44', dD: '#86522c', dE: '#5a3420',
  // folha
  gL: '#b4f07a', g: '#5fc040', gD: '#3a8a30', gE: '#24602a',
  // roxo
  vL: '#c79cff', v: '#8f5fe0', vD: '#5f3aa8',
  // latão
  mL: '#ffe9a8', m: '#e0b050', mD: '#a8782c',
};

// ------------------------------------------------------- cores de linha
const THREADS = {
  thread_gold:    { base: '#ffd23f', light: '#fff09a', dark: '#c8901c' },
  thread_pink:    { base: '#ff6fae', light: '#ffb8d8', dark: '#c4407c' },
  thread_blue:    { base: '#4fb4ff', light: '#a8deff', dark: '#2a6cc4' },
  thread_green:   { base: '#6fe07a', light: '#b8f6b2', dark: '#33a048' },
  thread_silver:  { base: '#d8e2ee', light: '#ffffff', dark: '#8494ac' },
  thread_rainbow: { base: '#ff5a6e', light: '#ffd0d8', dark: '#b03050', rainbow: true },
};
const RAINBOW = ['#ff5a6e', '#ffa23c', '#ffe14a', '#5fd068', '#4fa8ff', '#a77bff'];

function rainbowAt(t) {
  const k = ((t * 1.5) % RAINBOW.length + RAINBOW.length) % RAINBOW.length;
  const i = Math.floor(k);
  return mixColor(RAINBOW[i], RAINBOW[(i + 1) % RAINBOW.length], k - i);
}
function equippedThreadId() {
  const id = save.data?.cosmetics?.thread;
  return THREADS[id] ? id : 'thread_gold';
}
/** Cor (hex) da linha equipada. A Arco-Íris muda com o tempo. */
export function threadColor() {
  const th = THREADS[equippedThreadId()];
  return th.rainbow ? rainbowAt(game.time || 0) : th.base;
}
/** Paleta {base, light, dark} da linha equipada. */
export function threadPalette() {
  const th = THREADS[equippedThreadId()];
  if (!th.rainbow) return { base: th.base, light: th.light, dark: th.dark };
  const base = rainbowAt(game.time || 0);
  return { base, light: mixColor(base, '#ffffff', 0.5), dark: mixColor(base, '#1b1030', 0.35) };
}

// =============================================================================
// Infraestrutura de pixel art
// =============================================================================
/** ASCII → PixelCanvas (sem contorno). '.' e ' ' = transparente. */
function art(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length));
  const pc = new PixelCanvas(w, rows.length);
  pc.ascii(rows, pal);
  return pc;
}
function fill(w, h, draw) { const pc = new PixelCanvas(w, h); draw(pc); return pc; }

/** Scale2x (EPX): amplia 2x preservando bordas nítidas e arredondando diagonais. */
function scale2x(src) {
  const { w, h, buf } = src;
  const out = new PixelCanvas(w * 2, h * 2);
  const o = out.buf, W = w * 2;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : buf[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = buf[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      const i = y * 2 * W + x * 2;
      o[i] = e0; o[i + 1] = e1; o[i + W] = e2; o[i + W + 1] = e3;
    }
  }
  return out;
}

/**
 * Rotação estilo RotSprite: `src4` é a arte ampliada 4x (Scale2x duas vezes);
 * cada pixel de destino amostra o ponto correspondente rotacionado.
 * (spx,spy) = centro de rotação em coords 1x da arte; (dpx,dpy) no destino.
 */
function rotateInto(dst, src4, spx, spy, dpx, dpy, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  for (let y = 0; y < dst.h; y++) {
    for (let x = 0; x < dst.w; x++) {
      const rx = x + 0.5 - dpx, ry = y + 0.5 - dpy;
      const sx = c * rx + s * ry + spx, sy = -s * rx + c * ry + spy;
      const ix = Math.floor(sx * 4), iy = Math.floor(sy * 4);
      if (ix < 0 || iy < 0 || ix >= src4.w || iy >= src4.h) continue;
      const v = src4.buf[iy * src4.w + ix];
      if (v >>> 24) dst.buf[y * dst.w + x] = v;
    }
  }
}
const up4 = (f) => scale2x(scale2x(f));

/** Raio (a partir do centro do pixel-pivô) que contém todos os pixels opacos. */
function radiusOf(fills, px, py) {
  let r = 0;
  for (const f of fills) {
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        if (f.buf[y * f.w + x] >>> 24) r = Math.max(r, Math.hypot(x - px, y - py) + 0.75);
      }
    }
  }
  return r;
}

/** Copia uma arte rotacionada (ou não) com o pivô em (dx,dy) de `dst`. */
function stamp(dst, f, f4, px, py, dx, dy, ang) {
  if (Math.abs(ang) < 1e-6) dst.blit(f, dx - px, dy - py);
  else rotateInto(dst, f4 || up4(f), px + 0.5, py + 0.5, dx + 0.5, dy + 0.5, ang);
}

/**
 * Sprite com 25 inclinações (anims r0..r24; r12 = sem rotação). Cada anim
 * tem os mesmos quadros de animação `fills`. Pivô = pixel (px,py) da arte.
 */
function tiltSprite(name, fills, px, py) {
  const Rr = Math.ceil(radiusOf(fills, px, py)) + 2;
  const size = Rr * 2 + 1;
  const f4 = fills.map(up4);
  const anims = {};
  for (let k = -ROT_N; k <= ROT_N; k++) anims['r' + (k + ROT_N)] = { frames: fills.length, fps: 1 };
  defineSprite(name, {
    w: size, h: size, ox: Rr, oy: Rr, anims,
    draw(pc, anim, f) {
      const k = +anim.slice(1) - ROT_N;
      stamp(pc, fills[f], f4[f], px, py, Rr, Rr, k * ROT_STEP);
      pc.outline(OUT);
    },
  });
}

/**
 * Sprite com poses pré-rotacionadas: poses = {anim: [{f, px, py, ang, dx?, dy?}, ...]}.
 * Todas as poses compartilham o mesmo pivô no quadro.
 */
function poseSprite(name, poses, size, ox, oy) {
  const anims = {};
  for (const a of Object.keys(poses)) anims[a] = { frames: poses[a].length, fps: 1 };
  defineSprite(name, {
    w: size, h: size, ox, oy, anims,
    draw(pc, anim, i) {
      const layers = poses[anim][i];
      for (const L of Array.isArray(layers) ? layers : [layers]) {
        stamp(pc, L.f, L.f4, L.px, L.py, ox + (L.dx || 0), oy + (L.dy || 0), L.ang || 0);
      }
      pc.outline(OUT);
    },
  });
}

/** Sprite simples (sem rotação) com quadros `fills`, pivô (px,py). */
function plainSprite(name, fills, px, py) {
  const w = Math.max(...fills.map((f) => f.w)) + 2, h = Math.max(...fills.map((f) => f.h)) + 2;
  defineSprite(name, {
    w, h, ox: px + 1, oy: py + 1, anims: { a: { frames: fills.length, fps: 1 } },
    draw(pc, anim, f) { pc.blit(fills[f], 1, 1); pc.outline(OUT); },
  });
}

// ---------------------------------------------------- cache de poses dinâmicas
const dynCache = new Map();
function dyn(key, build) {
  let e = dynCache.get(key);
  if (!e) { e = build(); dynCache.set(key, e); }
  return e;
}
/** Desenha um canvas com pivô (ox,oy) em (wx,wy), espelhando como drawSprite. */
function blitPivot(ctx, e, wx, wy, flip, flash) {
  let img = e.canvas;
  if (flash) img = e.flashC || (e.flashC = silhouette(e.canvas, '#ffffff'));
  const rx = Math.round(wx), ry = Math.round(wy);
  if (!flip) ctx.drawImage(img, rx - e.ox, ry - e.oy);
  else {
    ctx.save();
    ctx.translate(rx, ry);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -e.ox, -e.oy);
    ctx.restore();
  }
}
function finish(pc, ox, oy) { pc.outline(OUT); pc.flush(); return { canvas: pc.canvas, ox, oy, pc }; }

// =============================================================================
// ARTE DOS ITENS
// Coordenadas: quadro olhando para a DIREITA (frente = +x), luz de cima-esquerda.
// =============================================================================

// ------------------------------------------------------------------ chapéus
// Pivô de chapéu = pixel da base que encosta no topo da cabeça.

function artPartyHat() {
  // cone listrado na diagonal + pompom + babado
  const pc = new PixelCanvas(9, 12);
  const widths = [1, 1, 3, 3, 5, 5, 7, 7];
  for (let j = 0; j < widths.length; j++) {
    const y = 3 + j, w = widths[j], x0 = 4 - (w >> 1);
    for (let x = x0; x < x0 + w; x++) {
      const pink = ((x - y + 40) >> 1) & 1;
      let c = pink ? PAL.p : PAL.y;
      if (x === x0 && w > 1) c = pink ? PAL.pL : PAL.yL;
      else if (x === x0 + w - 1 && w > 1) c = pink ? PAL.pD : PAL.yD;
      pc.px(x, y, c);
    }
  }
  // babado (franzido) na base
  for (let x = 0; x < 9; x++) pc.px(x, 11, x === 0 ? PAL.bL : x === 8 ? PAL.bD : x % 2 ? PAL.b : PAL.bL);
  // pompom
  pc.ascii([
    '..wW.',
    '.wWWs',
    '..Ws.',
  ], { w: PAL.wL, W: PAL.w, s: PAL.wD }, 2, 0);
  return pc;
}

function artCrown() {
  return art([
    'H...Y...D',
    'HY.YYY.YD',
    'HYYYYYYYD',
    'HYrYbYgYD',
    'EEEEEEEEE',
  ], { H: PAL.yL, Y: PAL.y, D: PAL.yD, E: PAL.yE, r: '#ff5a6e', b: '#4fa8ff', g: '#5fd068' });
}

function artNightcap(frame = 0) {
  // gorro azul com estrelinhas, ponta caída para trás com pompom
  const sway = frame === 1;
  return art(sway ? [
    '......LLL..',
    '....LLBBBB.',
    '..LLBByBBBD',
    '.LBD.BBBBBD',
    'LBD..BBByBD',
    'Ww..BBBBBDD',
    'WW..WWWWWWW',
    'ss..wwwwwww',
  ] : [
    '......LLL..',
    '....LLBBBB.',
    '..LLBByBBBD',
    '.LBD.BBBBBD',
    '.BD..BBByBD',
    'WW..BBBBBDD',
    'Ww..WWWWWWW',
    '....wwwwwww',
  ], { L: PAL.bL, B: PAL.b, D: PAL.bD, y: PAL.yL, W: PAL.wL, w: PAL.wD, s: PAL.wD });
}

function artPirate() {
  return art([
    '....kKKK....',
    '..kKKKKKKK..',
    'k.KKKwwwKKK.',
    'kKKKKwKwKKKK',
    'kKKKKKwKKKKD',
    'GKKKKKKKKKKG',
    '.GGGGGGGGGG.',
  ], { k: PAL.kL, K: PAL.k, D: PAL.kD, w: PAL.wL, G: PAL.y });
}

function artTopHat() {
  return art([
    '..LCCCD..',
    '..LCCCD..',
    '..LCCgD..',
    '..bbgGg..',
    '..LCCgD..',
    'LLCCCCCDD',
  ], { L: PAL.kL, C: PAL.k, D: PAL.kD, b: PAL.m, g: PAL.mL, G: PAL.mD });
}

function artGhostHood(frame = 0) {
  // lençolzinho: cúpula sobre a cabeça + caimento atrás com barra ondulada
  return art(frame ? [
    '.....wWW...',
    '...wWWWWWs.',
    '..wWWeWeWWs',
    '.wWWWWWWWss',
    'wWWWWWWWs..',
    'WWWWWs.....',
    'WWWWs......',
    'WWWSs......',
    '.SW.S......',
  ] : [
    '.....wWW...',
    '...wWWWWWs.',
    '..wWWeWeWWs',
    '.wWWWWWWWss',
    'wWWWWWWWs..',
    'WWWWWs.....',
    'WWWWs......',
    'WWWWS......',
    'S.WS.......',
  ], { w: PAL.wL, W: '#ece8fa', s: '#c8c0e0', S: '#a39ac4', e: '#3a3458' });
}

function artLeaf() {
  return art([
    '.......ss.',
    '....LLLs..',
    '..LLGGGGL.',
    '.LGGvvvvGD',
    'LGvvGGGGDD',
    'Dv.....DD.',
  ], { L: PAL.gL, G: PAL.g, D: PAL.gD, v: '#d8ffa0', s: '#7a8a2c' });
}

function artMushroom() {
  return art([
    '...hRRRR...',
    '.hRwwRRRRR.',
    'hRRwwRRwRRD',
    'RRRRRRRRRDD',
    'ccgcgcgcgcc',
  ], { h: PAL.rL, R: PAL.r, D: PAL.rD, w: '#fff6e8', c: '#f0dcc0', g: '#c8a888' });
}

// -------------------------------------------------------------- pescoço
// Pivô = pixel central do item (vai na âncora `neck`).
function artBowRed() {
  return art([
    'LR...RR',
    'LRRKRRD',
    'RRDKDRD',
    '..RKD..',
    '.RD.RD.',
  ], { L: PAL.rL, R: PAL.r, D: PAL.rD, K: PAL.rE });
}
function artBowDots() {
  return art([
    'PPP...PPP',
    'PwPPKPPwP',
    'PPPPKPPPD',
    'PPD.K.PDD',
    '...PDD...',
    '..PD..D..',
  ], { P: PAL.p, w: PAL.wL, D: PAL.pD, K: '#a83068' });
}
function artBowtie() {
  return art([
    'LV...VD',
    'LVVKVVD',
    'LV...VD',
  ], { L: PAL.vL, V: PAL.v, D: PAL.vD, K: '#3a2266' });
}

// ---------------------------------------------------------------- costas
function artBackpack() {
  // mochila em forma de botão gigante (4 furos) com alça
  return art([
    '..LLB..',
    '.LBBBd.',
    'LBhBhBd',
    'LBBBBBd',
    'LBhBhBd',
    '.BBBBdS',
    '..dddS.',
    '.....S.',
  ], { L: '#ff9a7a', B: '#e8504a', d: '#a8303a', h: '#5a1a2a', S: PAL.dD });
}

function artSpool(th) {
  // carretel deitado: discos de madeira nas pontas e linha enrolada no meio
  const pc = new PixelCanvas(8, 6);
  pc.ascii([
    'lL....lL',
    'lL....lL',
    'lL....lL',
    'lL....lL',
    'lL....lL',
    'dD....dD',
  ], { l: PAL.dL, L: PAL.d, d: PAL.dD, D: PAL.dE });
  for (let y = 1; y <= 4; y++) {
    for (let x = 2; x <= 5; x++) {
      let c;
      if (th.rainbow) c = RAINBOW[(x + y * 2) % RAINBOW.length];
      else c = (x + y) % 3 === 0 ? th.light : th.base;
      if (y === 4) c = th.rainbow ? mixColor(c, '#1b1030', 0.25) : th.dark;
      pc.px(x, y, c);
    }
  }
  return pc;
}

function artWing(dark) {
  // asinha de feltro apontando para trás (−x); raiz no pixel (8,2)
  const pal = dark
    ? { L: '#d8c8d8', W: '#c8b4c8', s: '#a890a8', S: '#987e98', p: '#c87aa0' }
    : { L: '#ffffff', W: '#fbeef2', s: '#e8c8d8', S: '#d8a8c0', p: '#f08cb4' };
  return art([
    '...LLLLL.',
    '.LLWWWWWL',
    'LWWpWpWWW',
    '.WWWWWWWs',
    '..S.S.SS.',
  ], pal);
}

// ------------------------------------------------- cachecol (procedural)
/** Faixa com largura 2 seguindo uma direção com ondulação. */
function strand(pc, ox, oy, ang, len, amp, ph, col) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const steep = Math.abs(dy) > Math.abs(dx);
  for (let s = 0; s <= len * 2; s++) {
    const d = s / 2;
    const wv = amp * Math.sin(d * 0.9 + ph) * (d / len);
    const x = Math.round(ox + dx * d + nx * wv), y = Math.round(oy + dy * d + ny * wv);
    const c = col(d);
    pc.px(x, y, c);
    if (d < len - 0.6) { if (steep) pc.px(x + 1, y, c); else pc.px(x, y + 1, c); }
  }
}

const SCARF = { a: '#e8384a', aL: '#ff7a6a', aD: '#a81e3a', b: '#fff2d8', bD: '#d8c8a8' };
const WIND = {
  //        ângulos das pontas (rad, 0=+x, π=trás)  amplitude
  idle:  { a1: 1.75, a2: 1.95, amp: 0.3, l1: 6, l2: 5 },
  walk:  { a1: 2.15, a2: 2.35, amp: 0.7, l1: 6, l2: 5 },
  run:   { a1: 2.80, a2: 2.95, amp: 1.0, l1: 7, l2: 6 },
  dash:  { a1: 3.10, a2: 3.05, amp: 0.4, l1: 8, l2: 6 },
  rise:  { a1: 1.85, a2: 2.05, amp: 0.4, l1: 6, l2: 5 },
  fall:  { a1: 3.70, a2: 3.50, amp: 0.8, l1: 6, l2: 5 },
  swim:  { a1: 2.60, a2: 2.80, amp: 1.0, l1: 6, l2: 5 },
};

function buildScarf(st, ph) {
  const W = 24, H = 22, OX = 13, OY = 9;
  const pc = new PixelCanvas(W, H);
  const P = WIND[st] || WIND.idle;
  const stripe = (light) => (d) => {
    if (d > (light ? P.l1 : P.l2) - 0.6) return SCARF.b;           // franjinha
    return Math.floor(d / 2) % 2 ? SCARF.b : (light ? SCARF.a : SCARF.aD);
  };
  const phase = ph * Math.PI;
  // ponta de trás (mais escura) e ponta da frente
  strand(pc, OX - 3, OY + 1, P.a2, P.l2, P.amp, phase + 1.7, stripe(false));
  strand(pc, OX - 3, OY + 1, P.a1, P.l1, P.amp, phase, stripe(true));
  // faixa em volta do pescoço (listras verticais)
  for (let y = -1; y <= 1; y++) {
    for (let x = -3; x <= 2; x++) {
      if ((x === -3 || x === 2) && y === -1) continue;
      const cream = ((x + 4) >> 1) % 2 === 1;
      let c = cream ? SCARF.b : SCARF.a;
      if (y === -1) c = cream ? '#ffffff' : SCARF.aL;
      if (y === 1) c = cream ? SCARF.bD : SCARF.aD;
      pc.px(OX + x, OY + y, c);
    }
  }
  // nó
  pc.px(OX - 4, OY, SCARF.a); pc.px(OX - 4, OY + 1, SCARF.aD); pc.px(OX - 3, OY + 1, SCARF.aD);
  return finish(pc, OX, OY);
}

// ----------------------------------------------------- capa de retalhos
const PATCHES = [
  ['#e8505a', '#ff8f86', '#a8303e'],
  ['#f2b43c', '#ffe08a', '#b87a1c'],
  ['#4f8fe0', '#9cc8ff', '#2f5aa8'],
  ['#5cb85a', '#a6e894', '#357a3a'],
  ['#a070d8', '#d2b4ff', '#6a44a0'],
];
const CAPE_TAIL = {
  idle: [-1, 5], walk: [-2, 4], run: [-5, 1], dash: [-8, -1], rise: [-2, 6], fall: [-4, -3], swim: [-3, 2],
};
function buildCape(bx, by, st, ph, opts = {}) {
  const W = 34, H = 26, OX = 22, OY = 8;
  const mask = new PixelCanvas(W, H);
  const len = Math.max(4, Math.hypot(bx, by));
  const ux = bx / len, uy = by / len;
  const ext = len * 1.5;
  const E = [ux * ext, uy * ext];
  const tail = CAPE_TAIL[st] || CAPE_TAIL.idle;
  const flap = ph ? 1 : 0;
  const T = [E[0] + tail[0] - (st === 'run' || st === 'walk' || st === 'swim' ? flap : 0),
    E[1] + tail[1] + (st === 'fall' ? -flap : st === 'run' ? flap : 0)];
  const Q = [-1, 4];
  const pts = [[1, -1], [bx * 0.5, by * 0.5 - 1.2], [E[0], E[1] - 0.6], T];
  const n = 5;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const wv = Math.sin(k * Math.PI * 2 + ph * Math.PI) * 0.9;
    pts.push([T[0] + (Q[0] - T[0]) * k, T[1] + (Q[1] - T[1]) * k + wv]);
  }
  pts.push(Q);
  mask.poly(pts.map(([x, y]) => [x + OX + 0.5, y + OY + 0.5]), '#ffffff');
  const pc = new PixelCanvas(W, H);
  const on = (x, y) => mask.alphaAt(x, y) > 0;
  const cell = (x, y) => {
    const u = Math.floor((x - y * 0.6 + 60) / 4), v = Math.floor((y + 60) / 3);
    return [u, v, Math.floor(hash2(u, v, 7) * PATCHES.length) % PATCHES.length];
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      const [u, v, idx] = cell(x, y);
      const P = PATCHES[idx];
      let c = P[0];
      const [ul, vl] = cell(x - 1, y), [, vu] = cell(x, y - 1);
      const [uu] = cell(x, y - 1);
      const seam = (ul !== u) || (vu !== v) || (uu !== u && vu !== v);
      if (!on(x, y - 1)) c = P[1];
      else if (!on(x, y + 1)) c = P[2];
      else if (seam) c = (x + y) % 2 ? '#fff2d8' : P[2];
      pc.px(x, y, c);
    }
  }
  // fecho: botãozinho dourado no pescoço
  if (!opts.noClasp) pc.ascii(['yY', 'YD'], { y: PAL.yL, Y: PAL.y, D: PAL.yD }, OX, OY - 1);
  return finish(pc, OX, OY);
}

// =============================================================================
// REGISTRO DOS ITENS
// =============================================================================
const ITEMS = {};            // id -> def de renderização {slot, render, icon...}

function addItem(id, meta, render) {
  const def = { id, ...meta };
  registerCosmetic(id, def);
  ITEMS[id] = { id, slot: meta.slot, ...render };
}

// ---------------------------------------------------------------- chapéus
const HATS = [
  ['hat_party', artPartyHat, [4, 11], -2, {
    name: 'Chapéu de Festa', price: 60, currency: 'buttons',
    desc: 'Listrado, com pompom e babado. Todo dia é aniversário de alguém!' }],
  ['hat_crown', artCrown, [4, 4], -1, {
    name: 'Coroa de Papel', price: 120, currency: 'buttons', unlock: { stars: 9 },
    desc: 'Recortada e pintada com giz de cera. Rei do quarto de brinquedos.' }],
  ['hat_nightcap', [artNightcap(0), artNightcap(1)], [7, 7], 0, {
    name: 'Gorro de Dormir', price: 90, currency: 'buttons',
    desc: 'Macio, quentinho e com cheirinho de travesseiro. Ótimo para cochilos.' }],
  ['hat_pirate', artPirate, [6, 6], 0, {
    name: 'Chapéu de Pirata', price: 180, currency: 'buttons', unlock: { world: 2 },
    desc: 'Feito para navegar pelo Mar de Botões. Arrr!' }],
  ['hat_tophat', artTopHat, [4, 5], -1, {
    name: 'Cartola de Relojoeiro', price: 2, currency: 'threads', unlock: { world: 3 },
    desc: 'Com faixa de latão e engrenagem. Pontualidade acima de tudo.' }],
  ['hat_ghost', [artGhostHood(0), artGhostHood(1)], [6, 4], 0, {
    name: 'Capuz de Lençol Fantasma', price: 220, currency: 'buttons', unlock: { world: 4 },
    desc: 'Buuu! Assusta as sombras... só um pouquinho.' }],
  ['hat_leaf', artLeaf, [5, 5], 0, {
    name: 'Folha-Chapéu', price: 40, currency: 'buttons',
    desc: 'Colhida na Clareira dos Esquecidos. Protege do sereno.' }],
  ['hat_mushroom', artMushroom, [5, 4], 0, {
    name: 'Chapéu de Cogumelo', price: 150, currency: 'buttons', unlock: { stars: 18 },
    desc: 'Pintadinho e fofo como os cogumelos da floresta. Não serve para sopa!' }],
];
let order = 0;
for (const [id, mk, [px, py], tilt0, meta] of HATS) {
  const fills = Array.isArray(mk) ? mk : [mk()];
  const sprite = 'cos_' + id;
  tiltSprite(sprite, fills, px, py);
  addItem(id, { slot: 'hat', order: order++, ...meta }, {
    fills, px, py, tilt0,
    render(o, a) {
      const m = o.m;
      const k = clamp(Math.round(o.tilt / ROT_STEP + m.lag + tilt0), -ROT_N, ROT_N);
      const f = fills.length > 1 ? hatFrame(m) : 0;
      const lift = m.st === 'fall' && m.vy > 160 ? -1 : 0;
      drawSprite(o.ctx, sprite, 'r' + (k + ROT_N), f, a.wx, a.wy + lift, { flip: o.flip, variant: o.flash ? 'flash' : undefined });
    },
  });
}
function hatFrame(m) {
  if (m.st === 'idle') return Math.floor(m.t * 1.2) % 2;
  return Math.floor(m.t * (m.st === 'run' || m.st === 'dash' ? 8 : 5)) % 2;
}

// ---------------------------------------------------------------- pescoço
const BOWS = [
  ['neck_bow_red', artBowRed, [3, 1], 0, {
    name: 'Laço Vermelho', price: 50, currency: 'buttons',
    desc: 'Um laço de fita vermelha, igual ao das caixas de presente.' }],
  ['neck_bow_dots', artBowDots, [4, 1], 0, {
    name: 'Laço de Bolinhas', price: 80, currency: 'buttons',
    desc: 'Rosa com bolinhas brancas. Charmoso em qualquer mundo.' }],
  ['neck_bowtie', artBowtie, [3, 1], 2, {
    name: 'Gravata-Borboleta', price: 100, currency: 'buttons', unlock: { world: 3 },
    desc: 'Elegância de veludo roxo para grandes ocasiões.' }],
];
order = 0;
for (const [id, mk, [px, py], fx, meta] of BOWS) {
  const f = mk();
  const sprite = 'cos_' + id;
  plainSprite(sprite, [f], px, py);
  addItem(id, { slot: 'neck', order: order++, ...meta }, {
    fills: [f], px, py,
    render(o, a) {
      drawSprite(o.ctx, sprite, 'a', 0, a.wx + (o.flip ? -fx : fx), a.wy, { flip: o.flip, variant: o.flash ? 'flash' : undefined });
    },
  });
}
addItem('neck_scarf', {
  slot: 'neck', order: 2, name: 'Cachecol Listrado', price: 130, currency: 'buttons',
  desc: 'Tricotado à mão, vermelho e creme. Esvoaça quando você corre.',
}, {
  render(o, a) {
    const ph = flutterPhase(o.m);
    const e = dyn(`scarf|${o.m.st}|${ph}`, () => buildScarf(o.m.st, ph));
    blitPivot(o.ctx, e, a.wx, a.wy, o.flip, o.flash);
  },
});
// mantém a ordem de exibição: laço, bolinhas, cachecol, gravata
R.cosmetics.get('neck_bowtie').order = 3;

function flutterPhase(m) {
  const fps = { idle: 1.5, walk: 5, run: 10, dash: 14, rise: 6, fall: 9, swim: 4 }[m.st] || 2;
  return Math.floor(m.t * fps) % 2;
}

// ----------------------------------------------------------------- costas
const fBackpack = artBackpack();
plainSprite('cos_back_backpack', [fBackpack], 3, 5);
addItem('back_backpack', {
  slot: 'back', order: 0, name: 'Mochilinha de Botão', price: 140, currency: 'buttons',
  desc: 'Uma mochila em forma de botão gigante. Cabe um lanchinho e muita coragem.',
}, {
  render(o, a) {
    const bob = o.m.st === 'run' && Math.floor(o.m.t * 8) % 2 ? -1 : 0;
    drawSprite(o.ctx, 'cos_back_backpack', 'a', 0, a.wx, a.wy + bob, { flip: o.flip, variant: o.flash ? 'flash' : undefined });
  },
});

// carretel: um sprite por cor de linha (definido sob demanda)
const spoolDefined = new Set();
function spoolSprite(tid) {
  const name = 'cos_back_spool_' + tid;
  if (!spoolDefined.has(tid)) { plainSprite(name, [artSpool(THREADS[tid])], 4, 4); spoolDefined.add(tid); }
  return name;
}
addItem('back_spool', {
  slot: 'back', order: 1, name: 'Carretel nas Costas', price: 2, currency: 'threads',
  desc: 'Leva sua linha para todo lado — e muda de cor junto com ela.',
}, {
  render(o, a) {
    const tid = equippedThreadId();
    drawSprite(o.ctx, spoolSprite(tid), 'a', 0, a.wx, a.wy, { flip: o.flip, variant: o.flash ? 'flash' : undefined });
    if (!o.flash) drawLooseThread(o, a.wx, a.wy, -4, -4);
  },
});
/** Pontinha de linha solta saindo do carretel (1 px, sem contorno). */
function drawLooseThread(o, wx, wy, lx0, ly0) {
  const ctx = o.ctx, m = o.m;
  const P = WIND[m.st] || WIND.idle;
  const ang = P.a1 - 0.2, ph = flutterPhase(m) * Math.PI;
  const pal = threadPalette();
  ctx.fillStyle = pal.base;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let last = '';
  for (let s = 0; s <= 5; s += 0.5) {
    const wv = Math.sin(s * 1.1 + ph) * 0.8 * (s / 5);
    const lx = Math.round(lx0 + dx * s - dy * wv), ly = Math.round(ly0 + dy * s + dx * wv);
    const key = lx + ',' + ly;
    if (key === last) continue;
    last = key;
    const X = o.flip ? Math.round(wx) - 1 - lx : Math.round(wx) + lx;
    ctx.fillRect(X, Math.round(wy) + ly, 1, 1);
  }
}

// asinhas: poses pré-rotacionadas (descanso, cima, meio, baixo)
const fWing = artWing(false), fWingD = artWing(true);
const WING_ANG = { rest: 0.75, up: 1.3, mid: 0.55, down: -0.15 };
{
  const f4 = up4(fWing), d4 = up4(fWingD);
  const pose = (ang) => [
    { f: fWingD, f4: d4, px: 8, py: 2, ang: ang + 0.25, dx: 2, dy: -1 },
    { f: fWing, f4, px: 8, py: 2, ang },
  ];
  poseSprite('cos_back_wings', {
    a: [pose(WING_ANG.rest), pose(WING_ANG.up), pose(WING_ANG.mid), pose(WING_ANG.down)],
  }, 27, 13, 13);
}
addItem('back_wings', {
  slot: 'back', order: 2, name: 'Asinhas de Feltro', price: 3, currency: 'threads', unlock: { stars: 30 },
  desc: 'Não voam de verdade... mas batem bem rapidinho quando você pula!',
}, {
  render(o, a) {
    drawSprite(o.ctx, 'cos_back_wings', 'a', wingFrame(o.m), a.wx, a.wy, { flip: o.flip, variant: o.flash ? 'flash' : undefined });
  },
});
function wingFrame(m) {
  const cyc = [1, 2, 3, 2];
  if (m.st === 'rise' || m.st === 'dash') return cyc[Math.floor(m.t * 16) % 4];
  if (m.st === 'fall') return cyc[Math.floor(m.t * 11) % 4];
  if (m.st === 'swim') return cyc[Math.floor(m.t * 6) % 4];
  if (m.st === 'run') return Math.floor(m.t * 8) % 2 ? 2 : 0;
  // parado/andando: uma batidinha de vez em quando
  const k = (m.t % 3.2);
  return k < 0.12 ? 1 : k < 0.24 ? 2 : 0;
}

addItem('back_cape', {
  slot: 'back', order: 3, name: 'Capa de Retalhos', price: 260, currency: 'buttons', unlock: { world: 5 },
  desc: 'Costurada com pedacinhos de todos os mundos. Heróis também são remendados.',
}, {
  anchor: 'neck',
  render(o, a) {
    const bx = o.meta.back.x - o.meta.neck.x, by = o.meta.back.y - o.meta.neck.y;
    const ph = flutterPhase(o.m);
    const e = dyn(`cape|${bx},${by}|${o.m.st}|${ph}`, () => buildCape(bx, by, o.m.st, ph));
    blitPivot(o.ctx, e, a.wx, a.wy, o.flip, o.flash);
  },
});

// ---------------------------------------------------------- cores de linha
const THREAD_META = [
  ['thread_gold', { name: 'Linha Dourada', price: 0, currency: 'buttons',
    desc: 'A linha original do Tico. Brilha como um botão novinho.' }],
  ['thread_pink', { name: 'Linha Rosa', price: 70, currency: 'buttons',
    desc: 'Cor de algodão-doce para os seus fios e costuras.' }],
  ['thread_blue', { name: 'Linha Azul', price: 70, currency: 'buttons',
    desc: 'Azul como o Mar de Botões numa manhã calma.' }],
  ['thread_green', { name: 'Linha Verde', price: 70, currency: 'buttons',
    desc: 'Verde-musgo, direto da Clareira dos Esquecidos.' }],
  ['thread_silver', { name: 'Linha Prateada', price: 1, currency: 'threads', unlock: { world: 3 },
    desc: 'Fio de agulha nova, reluzente como um relógio polido.' }],
  ['thread_rainbow', { name: 'Linha Arco-Íris', price: 5, currency: 'threads', unlock: { stars: 45 },
    desc: 'Um fio que nunca se decide. Muda de cor sem parar!' }],
];
order = 0;
for (const [id, meta] of THREAD_META) {
  addItem(id, { slot: 'thread', order: order++, color: THREADS[id].base, ...meta }, { render() {} });
}

// =============================================================================
// MOVIMENTO (vento nas capas, balanço do chapéu)
// =============================================================================
const motion = new WeakMap();
const STILL = { st: 'idle', run: 0, air: false, vy: 0, lag: 0, t: 0 };
function motionOf(player) {
  if (!player) { STILL.t = game.time || 0; return STILL; }
  let m = motion.get(player);
  const t = player.t ?? game.time ?? 0;
  if (!m) { m = { lag: 0, lastT: t, st: 'idle', run: 0, air: false, vy: 0, t }; motion.set(player, m); }
  const dt = clamp(t - m.lastT, 0, 0.1);
  m.lastT = t;
  const vx = player.vx || 0, vy = player.vy || 0;
  const dash = player.state === 'dash';
  const spd = Math.abs(vx);
  const air = player.grounded === false && !player.inWater;
  let st = 'idle';
  if (player.inWater) st = 'swim';
  else if (dash) st = 'dash';
  else if (air) st = vy < -40 ? 'rise' : 'fall';
  else if (spd > 118) st = 'run';
  else if (spd > 10) st = 'walk';
  const fwd = vx * (player.facing || 1);              // >0 = andando para a frente
  const target = clamp(-fwd / 150, -1.4, 1.4) * 1.5 + (air ? (vy > 0 ? 0.6 : -0.5) : 0);
  m.lag += (target - m.lag) * Math.min(1, dt * 10);
  m.st = st; m.run = clamp(spd / 150, 0, 1.4); m.air = air; m.vy = vy; m.t = t;
  return m;
}

function normTilt(v) {
  if (!v || !isFinite(v)) return 0;
  return Math.abs(v) > Math.PI * 2 ? (v * Math.PI) / 180 : v;
}

// =============================================================================
// API PRINCIPAL
// =============================================================================
const SLOT_ORDER = ['back', 'neck', 'hat'];

export function drawCosmetics(ctx, player, anim, frame, x, y, flip) {
  const eq = save.data && save.data.cosmetics;
  if (!eq || (!eq.hat && !eq.neck && !eq.back)) return;
  const meta = frameMeta('tico', anim, frame) || DEFAULT_META;
  const o = {
    ctx, flip: !!flip, meta: {
      head: meta.head || DEFAULT_META.head, neck: meta.neck || DEFAULT_META.neck, back: meta.back || DEFAULT_META.back,
    },
    tilt: normTilt(meta.tilt), m: motionOf(player), flash: !!(player && player.flash > 0),
  };
  for (const slot of SLOT_ORDER) {
    const id = eq[slot];
    const it = id && ITEMS[id];
    if (!it || it.slot !== slot) continue;
    const key = it.anchor || (slot === 'hat' ? 'head' : slot);
    const an = o.meta[key];
    const off = SLOT_OFF[key === 'head' ? 'hat' : key] || SLOT_OFF[slot];
    const ax = an.x + off.x, ay = an.y + off.y;
    const [TICO_OX, TICO_OY] = ticoPivot();
    const a = { wx: x + (ax - TICO_OX) * (o.flip ? -1 : 1), wy: y + (ay - TICO_OY) };
    try { it.render(o, a); } catch (e) { console.error('[cosmetics]', id, e); ITEMS[id] = { slot: '-', render() {} }; }
  }
}

// =============================================================================
// ÍCONES DO GUARDA-ROUPA (24x24)
// =============================================================================
const ICON = 24;
/** Monta um ícone: arte 1x → Scale2x (se couber) → contorno → centralizado. */
function iconFromFill(f) {
  let src = f;
  // recorta a área opaca
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.buf[y * f.w + x] >>> 24) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return new PixelCanvas(ICON, ICON);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const crop = new PixelCanvas(cw, ch);
  crop.blit(f, 0, 0, { sx: x0, sy: y0, sw: cw, sh: ch });
  src = cw * 2 + 2 <= ICON && ch * 2 + 2 <= ICON ? scale2x(crop) : crop;
  const out = new PixelCanvas(ICON, ICON);
  out.blit(src, Math.floor((ICON - src.w) / 2), Math.floor((ICON - src.h) / 2));
  out.outline(OUT);
  return out;
}
/** Desenha a arte (com rotação opcional) num canvas grande para virar ícone. */
function posed(f, px, py, ang, size = 40) {
  const pc = new PixelCanvas(size, size);
  stamp(pc, f, null, px, py, size >> 1, size >> 1, ang);
  return pc;
}

function artSpoolIcon(th, shift = 0) {
  // carretel em pé com a pontinha da linha solta
  const pc = new PixelCanvas(10, 11);
  pc.ascii([
    '.lLLLLLL..',
    '.dDDDDDD..',
  ], { l: PAL.dL, L: PAL.d, d: PAL.dD, D: PAL.dE }, 0, 0);
  pc.ascii([
    '.lLLLLLL..',
    '.dDDDDDD..',
  ], { l: PAL.dL, L: PAL.d, d: PAL.dD, D: PAL.dE }, 0, 9);
  for (let y = 2; y <= 8; y++) {
    for (let x = 2; x <= 6; x++) {
      let c;
      if (th.rainbow) c = RAINBOW[(y + shift) % RAINBOW.length];
      else c = x === 2 ? th.light : x === 6 ? th.dark : (y % 2 ? th.base : mixColor(th.base, th.light, 0.35));
      if (th.rainbow && x === 2) c = mixColor(c, '#ffffff', 0.45);
      if (th.rainbow && x === 6) c = mixColor(c, '#1b1030', 0.3);
      pc.px(x, y, c);
    }
  }
  // fio solto saindo pela direita e descendo
  const loose = th.rainbow ? RAINBOW[(4 + shift) % RAINBOW.length] : th.base;
  pc.px(7, 4, loose); pc.px(8, 5, loose); pc.px(8, 6, loose); pc.px(9, 7, loose); pc.px(9, 8, loose);
  return pc;
}

const iconFrames = new Map();     // id -> [imageName...]
function defIconFrames(id, fills) {
  const names = fills.map((f, i) => {
    const n = `cos_icon_${id}_${i}`;
    defineImage(n, ICON, ICON, (pc) => { const ic = iconFromFill(f); pc.blit(ic, 0, 0); });
    return n;
  });
  iconFrames.set(id, names);
}

// chapéus: arte com a inclinação charmosa do item, se couber
for (const [id] of HATS) {
  const it = ITEMS[id];
  defIconFrames(id, [posed(it.fills[0], it.px, it.py, it.tilt0 * ROT_STEP)]);
}
for (const [id] of BOWS) defIconFrames(id, [ITEMS[id].fills[0]]);
defIconFrames('neck_scarf', [0, 1].map((ph) => buildScarf('walk', ph).pc));
defIconFrames('back_backpack', [fBackpack]);
defIconFrames('back_wings', [WING_ANG.rest, WING_ANG.up].map((ang) => {
  const pc = new PixelCanvas(30, 30);
  stamp(pc, fWingD, null, 8, 2, 17, 17, ang + 0.25);
  stamp(pc, fWing, null, 8, 2, 15, 18, ang);
  return pc;
}));
defIconFrames('back_cape', [0, 1].map((ph) => buildCape(-5, 0, 'walk', ph).pc));
for (const tid of Object.keys(THREADS)) {
  const th = THREADS[tid];
  defIconFrames(tid, th.rainbow ? [0, 1, 2, 3, 4, 5].map((s) => artSpoolIcon(th, s)) : [artSpoolIcon(th)]);
  // carretel de costas: ícone acompanha a linha equipada
  defIconFrames('back_spool:' + tid, [artSpool(th)]);
}

/** Ícone/preview 24x24 do item `id` com canto superior esquerdo em (x,y). */
export function drawCosmeticPreview(ctx, id, x, y, t = 0) {
  let key = id;
  if (id === 'back_spool') key = 'back_spool:' + equippedThreadId();
  const frames = iconFrames.get(key);
  if (!frames) return;
  const rate = id === 'thread_rainbow' ? 6 : frames.length > 1 ? 2.5 : 1;
  const name = frames[Math.floor(t * rate) % frames.length];
  const img = getImage(name);
  if (!img) return;
  const rx = Math.round(x), ry = Math.round(y);
  ctx.drawImage(img, rx, ry);
  // brilho de vez em quando (estrelinha de 4 pontas)
  const ph = ((t + (id.length * 0.37)) % 3.4);
  if (ph < 0.36) {
    const sx = rx + ICON - 6, sy = ry + 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy, 1, 1);
    if (ph > 0.08 && ph < 0.28) {
      ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
      if (ph > 0.14 && ph < 0.22) { ctx.fillRect(sx - 2, sy, 1, 1); ctx.fillRect(sx + 2, sy, 1, 1); ctx.fillRect(sx, sy - 2, 1, 1); ctx.fillRect(sx, sy + 2, 1, 1); }
    }
  }
}

// =============================================================================
// UTILITÁRIOS PARA O GUARDA-ROUPA / LOJA
// =============================================================================
/** Lista de defs (de R.cosmetics) de um slot, na ordem de exibição. */
export function cosmeticsInSlot(slot) {
  return [...R.cosmetics.values()].filter((d) => d.slot === slot).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
function cos() {
  const d = save.data;
  if (!d.cosmetics) d.cosmetics = { owned: ['thread_gold'], hat: null, neck: null, back: null, thread: 'thread_gold' };
  if (!Array.isArray(d.cosmetics.owned)) d.cosmetics.owned = ['thread_gold'];
  return d.cosmetics;
}
export function ownsCosmetic(id) {
  if (id === 'thread_gold') return true;
  return cos().owned.includes(id);
}
/** Total de estrelas costuradas encontradas em todas as fases. */
export function totalStars() {
  let n = 0;
  const lv = save.data?.progress?.levels || {};
  for (const k of Object.keys(lv)) for (const s of lv[k].starsFound || []) if (s) n++;
  return n;
}
/** O requisito de desbloqueio (estrelas/mundo) já foi cumprido? */
export function cosmeticUnlocked(id) {
  const d = R.cosmetics.get(id);
  if (!d) return false;
  const u = d.unlock;
  if (!u) return true;
  if (u.stars && totalStars() < u.stars) return false;
  if (u.world && !save.isWorldUnlocked(u.world)) return false;
  return true;
}
/** Texto curto do requisito (para itens trancados), ou '' se liberado. */
export function cosmeticLockText(id) {
  const d = R.cosmetics.get(id);
  if (!d || cosmeticUnlocked(id)) return '';
  if (d.unlock.stars) return `Encontre ${d.unlock.stars} estrelas`;
  if (d.unlock.world) return `Chegue ao Mundo ${d.unlock.world}`;
  return '';
}
export function isEquipped(id) {
  const d = R.cosmetics.get(id);
  return !!d && cos()[d.slot] === id;
}
/** Equipa (ou, se já equipado, tira — exceto linha). Retorna true se mudou. */
export function equipCosmetic(id) {
  const d = R.cosmetics.get(id);
  if (!d || !ownsCosmetic(id)) return false;
  const c = cos();
  if (d.slot === 'thread') { if (c.thread === id) return false; c.thread = id; return true; }
  c[d.slot] = c[d.slot] === id ? null : id;
  return true;
}
export function unequipSlot(slot) {
  const c = cos();
  if (slot === 'thread') c.thread = 'thread_gold';
  else c[slot] = null;
}
