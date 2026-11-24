// =============================================================================
// cutscenes/opening.js — Abertura do jogo ('opening') e chegada ao Avesso ('arrival').
//
//  'opening'  cena própria com o palco 'quarto_tempestade': o quarto da Lia numa noite de
//             tempestade (janela com chuva e relâmpagos, cama com colcha de retalhos, abajur,
//             brinquedos na estante, desenhos na parede). Iluminação própria: tudo é desenhado
//             "aceso" e depois multiplicado por um MAPA DE LUZ (ambiente noturno + abajur +
//             relâmpagos entrando pela janela + brilho roxo do rasgo/portal), em drawFront.
//             Batidas (docs/STORY.md "Abertura"): pan lento + legendas, relâmpago, o Tico
//             escorrega da cama, silêncio, o abajur apaga, um rasgo costurado se abre no ar
//             (pontos estourando), dedos-agulha, o Costureiro se debruça ("Fio... antigo.
//             Finalmente."), fios roxos entram nas costuras do Tico, os olhos piscam roxo,
//             portal enorme, o Tico é arremessado girando, tudo se fecha, Lia tateia o vazio
//             ("Tico...?"), escurece, cartão de título. A cena chama opts.next ao terminar.
//  'arrival'  dentro da fase (intro da w1_1): túnel de fios no céu, o Tico cai girando, cara no
//             chão, levanta ('wake'), descobre que se mexe, tropeça, olha em volta, decide voltar.
//
// Exporta utilitários usados por world_intros.js: tws (tween de propriedades), spawnTask
// (corrotina em segundo plano), ticoActor (Tico-marionete com giro/escala/tinta/olho que
// brilha), drawThreadVortex (portal de fios), drawCostureiro / costureiroHead (o vilão).
// =============================================================================
import { registerCutscene } from '../registry.js';
import { registerStage } from './director.js';
import { defineSprite, drawSprite, animFrame } from '../../engine/sprites.js';
import { PixelCanvas, createCanvas } from '../../engine/pixel.js';
import { Ease, mixColor, hash2, clamp } from '../../engine/util.js';
import { drawGlow, drawThreadLine, drawPortalSwirl } from '../art/vfx.js';

const RN = Math.round;
const TAU = Math.PI * 2;
const EZ = (e) => (typeof e === 'function' ? e : Ease[e] || Ease.inOutQuad);
const NOOP = () => {};

// ============================================================ utilitários (exportados)
/** Interpola várias propriedades numéricas de `o` (gerador: use yield*; respeita "pular"). */
export function* tws(cs, o, props, dur = 1, ease) {
  const e = EZ(ease), from = {}, t0 = cs.time;
  for (const k in props) from[k] = o[k];
  for (;;) {
    const k = cs.skipping || dur <= 0 ? 1 : Math.min(1, (cs.time - t0) / dur);
    const v = e(k);
    for (const p in props) o[p] = from[p] + (props[p] - from[p]) * v;
    if (k >= 1) return;
    yield;
  }
}

/** Roda um gerador em segundo plano (yield = 1 quadro, yield n = n s). Morre ao pular. */
export function spawnTask(cs, gen) {
  let wait = 0;
  const a = cs.actor({ visible: false });
  a.update = (dt) => {
    if (!gen) return;
    if (cs.skipping || cs.ended) { gen = null; return; }
    wait -= dt;
    let guard = 0;
    while (gen && wait <= 0 && guard++ < 50) {
      const r = gen.next();
      if (r.done) { gen = null; break; }
      if (typeof r.value === 'number') wait += r.value; else break;
    }
  };
  return a;
}

/** Linha grossa em pixels (quadradinhos ao longo do segmento). */
function seg(ctx, x0, y0, x1, y1, w, c) {
  ctx.fillStyle = c;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))), h = w / 2;
  for (let i = 0; i <= n; i++) ctx.fillRect(RN(x0 + (x1 - x0) * i / n - h), RN(y0 + (y1 - y0) * i / n - h), w, w);
}
const hex2 = (a) => RN(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0');

// ---- luz em faixas (para o mapa de luz), cacheada por raio/cor
const lightCache = new Map();
function lightSprite(r, color) {
  r = Math.max(4, Math.min(200, RN(r / 4) * 4));
  const key = r + color;
  let c = lightCache.get(key);
  if (c) return c;
  const size = r * 2 + 1, pc = new PixelCanvas(size, size), base = color.slice(0, 7);
  const bands = [[1, 0.1], [0.8, 0.27], [0.6, 0.5], [0.38, 0.78], [0.18, 1]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - r, y - r) / r;
    if (d > 1) continue;
    let a = 0, edge = false;
    for (const [lim, al] of bands) if (d <= lim) { a = al; edge = d > lim - 0.05; }
    if (edge && ((x + y) & 1)) a *= 0.72;
    pc.px(x, y, base + hex2(a));
  }
  pc.flush();
  c = pc.canvas;
  lightCache.set(key, c);
  return c;
}
function light(l, x, y, r, color, a = 1) {
  if (a <= 0.004 || r < 2) return;
  const s = lightSprite(r, color), h = (s.width - 1) / 2;
  l.globalAlpha = Math.min(1, a);
  l.drawImage(s, RN(x - h), RN(y - h));
  l.globalAlpha = 1;
}
let LM = null;
function lightmap(w, h) {
  if (!LM || LM.width < w || LM.height < h) LM = createCanvas(Math.max(w, LM?.width || 0), Math.max(h, LM?.height || 0));
  return LM;
}
let VIG = null;
function vignette(w, h) {
  if (VIG && VIG.width === w && VIG.height === h) return VIG;
  const pc = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2), d = Math.sqrt(dx * dx * 0.75 + dy * dy * 1.1);
    const a = d < 0.78 ? 0 : d < 0.92 ? 0.16 : d < 1.06 ? 0.3 : 0.46;
    if (a && !(a < 0.2 && ((x + y) & 1))) pc.px(x, y, '#05030c' + hex2(a));
  }
  pc.flush();
  return (VIG = pc.canvas);
}

// ============================================================ Tico-marionete
function drawTicoPuppet(ctx, a) {
  const fr = a.frame != null ? a.frame : animFrame('tico', a.anim, a.t);
  const k = a.scale ?? 1, sx = (a.sx ?? 1) * k, sy = (a.sy ?? 1) * k, cy = 16 * sy;
  if (k <= 0.02) return;
  ctx.save();
  ctx.translate(RN(a.x), RN(a.y - cy));
  if (a.rot) ctx.rotate(a.rot);
  const o = { flip: a.flip, scaleX: sx, scaleY: sy };
  drawSprite(ctx, 'tico', a.anim, fr, 0, RN(cy), o);
  if (a.tint > 0.01) drawSprite(ctx, 'tico', a.anim, fr, 0, RN(cy), { ...o, variant: a.tintColor, alpha: Math.min(1, a.tint) });
  ctx.restore();
  if (a.eyeGlow > 0.01) {
    const ex = a.x + (a.eyeX ?? 6) * (a.flip ? -1 : 1), ey = a.y + (a.eyeY ?? -27);
    drawGlow(ctx, ex, ey, 9, a.glowColor || '#c060ff', 0.9 * a.eyeGlow);
    ctx.globalAlpha *= Math.min(1, a.eyeGlow);
    ctx.fillStyle = '#f4d0ff'; ctx.fillRect(RN(ex) - 1, RN(ey), 2, 1);
    ctx.fillStyle = '#b040ff'; ctx.fillRect(RN(ex) - 2, RN(ey) + 1, 4, 1);
  }
}
/** Ator do Tico (anim do sprite 'tico' + rot, sx/sy, scale, frame fixo, tint, eyeGlow). */
export function ticoActor(cs, o = {}) {
  return cs.actor({ sprite: 'tico', anim: 'idle', z: 5, rot: 0, sx: 1, sy: 1, frame: null, tint: 0, tintColor: '#b45cff', eyeGlow: 0, h: 34, ...o, draw: drawTicoPuppet });
}

/** Portal/túnel de fios (redemoinho + fios dourados e roxos em espiral). k = abertura 0..1. */
export function drawThreadVortex(ctx, x, y, r, t, k, cols = ['#ff4fd8', '#a855ff', '#ffffff'], squash = 0.6) {
  if (k <= 0.01) return;
  const R2 = r * k, al = Math.min(1, k);
  drawGlow(ctx, x, y, R2 * 1.5, cols[1], 0.3 * al);
  drawPortalSwirl(ctx, x, y, R2, t * 3, cols, { squash, arms: 4, alpha: al });
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 3 === 0 ? '#ffd23f' : i % 3 === 1 ? '#d08aff' : '#fff0b0';
    for (let s = 0; s <= 16; s++) {
      const u = s / 16, a = i / 10 * TAU + t * 2.4 + u * 2.8, rr = R2 * (0.4 + u * 1.2);
      ctx.globalAlpha = al * (1 - u * 0.85);
      ctx.fillRect(RN(x + Math.cos(a) * rr), RN(y + Math.sin(a) * rr * squash), 1, 1);
    }
  }
  const n = Math.max(10, RN(R2 * 0.8));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU - t * 1.4;
    ctx.globalAlpha = al;
    ctx.fillStyle = i % 2 ? '#ffe9a0' : '#7a2ab0';
    ctx.fillRect(RN(x + Math.cos(a) * (R2 + 3)), RN(y + Math.sin(a) * (R2 + 3) * squash), 2, 1);
  }
  ctx.globalAlpha = 1;
}

// ============================================================ o Costureiro (partes pré-desenhadas)
const COUT = '#0c0816';
function stitchLine(pc, x0, y0, x1, y1, c) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i += 2) pc.px(RN(x0 + (x1 - x0) * i / n), RN(y0 + (y1 - y0) * i / n), c);
}
function bakeHead(open) {
  const pc = new PixelCanvas(30, 36);
  const B = '#3c3152', D = '#2a2240', L = '#55487a';
  pc.ellipse(15, 22, 12, 12.5, B);
  pc.poly([[4, 18], [26, 15], [22, 7], [18, 1], [13, 3], [8, 9]], B);
  pc.poly([[17, 1], [22, 0], [24, 3], [21, 6]], D);
  for (let y = 0; y < 36; y++) for (let x = 0; x < 30; x++) {
    if (!pc.alphaAt(x, y)) continue;
    if (x > 20 + ((y >> 1) & 1) && hash2(x, y, 2) < 0.8) pc.px(x, y, D);
    else if (x < 6 + (y & 1) && y > 12) pc.px(x, y, L);
  }
  pc.rect(4, 19, 7, 8, '#2c2a4c'); stitchLine(pc, 4, 19, 10, 19, '#9a88c0'); stitchLine(pc, 10, 19, 10, 26, '#9a88c0');
  pc.rect(17, 8, 6, 5, '#4c3a48'); stitchLine(pc, 17, 13, 22, 13, '#9a88c0');
  // olhos de botão desparelhados: um grande e claro, um pequeno e vermelho
  pc.circle(10, 22, 4.2, '#bdb3a0'); pc.circle(10, 22, 3.2, '#ece4d2');
  for (const [hx, hy] of [[9, 21], [11, 21], [9, 23], [11, 23]]) pc.px(hx, hy, '#2a2034');
  pc.px(10, 22, '#a070d0');
  pc.circle(21.5, 23, 2.6, '#a02c40'); pc.px(21, 22, '#e06078'); pc.px(21, 23, '#2a0a14'); pc.px(22, 24, '#2a0a14');
  // boca costurada (zigue-zague)
  if (open) {
    pc.ellipse(15.5, 30.5, 7, 2.6, '#12081c');
    for (let x = 10; x <= 21; x += 2) pc.vline(x, 28, 5, '#d8c8ea');
  } else {
    pc.line(7, 30, 24, 29, '#1a1024');
    for (let x = 8; x <= 23; x += 2) pc.vline(x, 29 - (x > 15 ? 1 : 0), 3, '#d8c8ea');
  }
  pc.outline(COUT);
  pc.flush();
  return pc.canvas;
}
function bakeTorso() {
  const pc = new PixelCanvas(36, 58);
  const B = '#2e2844', D = '#201a34', L = '#463c66';
  pc.poly([[3, 8], [33, 8], [27, 58], [9, 58]], B);
  pc.ellipse(7, 10, 6, 5, B); pc.ellipse(29, 10, 6, 5, B); pc.rect(13, 2, 10, 8, D);
  for (let y = 0; y < 58; y++) for (let x = 0; x < 36; x++) {
    if (!pc.alphaAt(x, y)) continue;
    if (x > 25 - (y > 30 ? 2 : 0) && hash2(x, y, 5) < 0.85) pc.px(x, y, D);
    else if (x < 8 && y < 20 && ((x + y) & 1)) pc.px(x, y, L);
  }
  pc.poly([[5, 14], [14, 13], [13, 26], [6, 27]], '#3a2c40'); stitchLine(pc, 5, 14, 14, 13, '#8a78b0'); stitchLine(pc, 13, 13, 13, 26, '#8a78b0');
  pc.poly([[22, 32], [30, 31], [28, 45], [21, 45]], '#263050'); stitchLine(pc, 22, 32, 21, 45, '#8a78b0');
  pc.rect(12, 47, 11, 8, '#36283c'); stitchLine(pc, 12, 47, 22, 47, '#8a78b0');
  for (let y = 31; y < 58; y += 3) pc.px(18, y, '#6a5a90');
  // rasgo no peito com o brilho roxo
  pc.poly([[15, 15], [20, 16], [22, 23], [19, 31], [16, 30], [14, 22]], '#12061e');
  pc.poly([[16, 18], [19, 18], [20, 23], [18, 28], [16, 23]], '#9a3ae0');
  pc.vline(18, 19, 7, '#f2c0ff'); pc.px(17, 21, '#d890ff');
  for (const [x, y] of [[14, 17], [21, 19], [14, 25], [21, 27], [15, 30]]) pc.px(x, y, '#c8b8e0');
  pc.circle(11, 37, 2.2, '#c8a040'); pc.px(10, 36, '#f0d070');
  pc.circle(12, 48, 1.6, '#d8d0c0');
  pc.outline(COUT);
  pc.flush();
  return pc.canvas;
}
let CH = null;
function costParts() { return CH || (CH = { head: bakeHead(false), headO: bakeHead(true), torso: bakeTorso() }); }
/** Cabeça do Costureiro (30x36) — boca fechada ou aberta. */
export function costureiroHead(open = false) { const p = costParts(); return open ? p.headO : p.head; }

function needles(ctx, x, y, a, spread, t) {
  ctx.fillStyle = COUT; ctx.fillRect(RN(x) - 3, RN(y) - 3, 7, 7);
  ctx.fillStyle = '#3e3558'; ctx.fillRect(RN(x) - 2, RN(y) - 2, 5, 5);
  for (let i = 0; i < 4; i++) {
    const b = a + (i - 1.5) * spread + Math.sin(t * 5 + i * 1.7) * 0.05;
    const c = Math.cos(b), s = Math.sin(b);
    for (let k = 3; k < 18; k++) {
      ctx.fillStyle = k < 5 ? '#4a4264' : k === 7 ? '#2a2238' : k === 6 || k === 8 || k > 15 ? '#ffffff' : '#b4bcd6';
      ctx.fillRect(RN(x + c * k), RN(y + s * k), 1, 1);
    }
  }
}
/**
 * Desenha o Costureiro. C = { x,y (cintura), lean (rad), head (inclinação extra), arm (ângulo do braço),
 * bend (cotovelo), spread (dedos), eye 0..1, mouth 0|1, vis 0..1, scale }. Guarda C.eyes / C.hand / C.face.
 */
export function drawCostureiro(ctx, C, t) {
  if (!(C.vis > 0.01)) return;
  const P = costParts(), s = C.scale || 1, ca = Math.cos(C.lean), sa = Math.sin(C.lean);
  const W = (dx, dy) => [C.x + (dx * ca - dy * sa) * s, C.y + (dx * sa + dy * ca) * s];
  const br = Math.sin(t * 2.1) * 0.8;
  ctx.save();
  ctx.globalAlpha *= C.vis;
  ctx.save(); ctx.translate(RN(C.x), RN(C.y)); ctx.rotate(C.lean); ctx.scale(s, s); ctx.drawImage(P.torso, -18, -57); ctx.restore();
  // fios roxos vazando do rasgo do peito
  const [tx, ty] = W(1, -31);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 14; k++) {
      ctx.globalAlpha = C.vis * (1 - k / 14);
      ctx.fillStyle = k % 4 === 0 ? '#f0b8ff' : '#b050ff';
      ctx.fillRect(RN(tx + (i - 1.5) + Math.sin(t * 3 + i * 1.3 + k * 0.45) * k * 0.35), RN(ty + k * 1.4), 1, 1);
    }
  }
  ctx.globalAlpha = C.vis;
  const [nx, ny] = W(0, -55 + br);
  const hr = C.lean + (C.head || 0);
  ctx.save(); ctx.translate(RN(nx), RN(ny)); ctx.rotate(hr); ctx.scale(s, s); ctx.drawImage(C.mouth ? P.headO : P.head, -15, -33); ctx.restore();
  const hc = Math.cos(hr), hs = Math.sin(hr);
  const E = (dx, dy) => [nx + (dx * hc - dy * hs) * s, ny + (dx * hs + dy * hc) * s];
  C.eyes = [E(-5, -11), E(6.5, -10)];
  C.face = E(0, -14);
  if (C.eye > 0.01) {
    for (const [ex, ey] of C.eyes) drawGlow(ctx, ex, ey, 6, '#c070ff', 0.8 * C.eye);
    ctx.fillStyle = '#f6dcff'; ctx.fillRect(RN(C.eyes[0][0]), RN(C.eyes[0][1]), 1, 1); ctx.fillRect(RN(C.eyes[1][0]), RN(C.eyes[1][1]), 1, 1);
  }
  // braço da frente com os dedos-agulha
  const [sx, sy] = W(-12, -47 + br);
  const L1 = 30 * s, L2 = 28 * s;
  const ex = sx + Math.cos(C.arm) * L1, ey = sy + Math.sin(C.arm) * L1;
  const a2 = C.arm + (C.bend || 0), hx = ex + Math.cos(a2) * L2, hy = ey + Math.sin(a2) * L2;
  seg(ctx, sx, sy, ex, ey, 6, COUT); seg(ctx, ex, ey, hx, hy, 5, COUT);
  seg(ctx, sx, sy, ex, ey, 4, '#2e2844'); seg(ctx, ex, ey, hx, hy, 3, '#3c3458');
  ctx.fillStyle = '#8a78b0'; ctx.fillRect(RN(ex) - 1, RN(ey) - 1, 2, 2);
  needles(ctx, hx, hy, a2, C.spread ?? 0.25, t);
  C.hand = [hx + Math.cos(a2) * 14, hy + Math.sin(a2) * 14];
  ctx.restore();
}

// ============================================================ quarto da Lia (palco)
const RX0 = -288, RY0 = -176, RW = 576, RH = 312;   // área pré-desenhada (coords do palco)
const GX = -231, GY = -117, GW = 86, GH = 86;       // vidro da janela (transparente no quarto)
const QX0 = 34, QY0 = -22;                          // colcha (canvas separado: cobre a Lia)
const LX = 9, LY = -36;                             // canto do sprite da Lia
const LIA_HEAD = { headX: LX + 26, headY: LY + 12 };
const TB = { x: 80, y: -1 };                        // Tico no colo da Lia
const TF = { x: 112, y: 72 };                       // Tico caído no tapete
const PAT = ['#3fc7c0', '#ffd23f', '#ff8a3c', '#4a7fe0', '#e070a0', '#7cc46a', '#efe2c8'];
const qTop = (x) => 6 - 14 * Math.exp(-(((x - 60) / 13) ** 2)) - 8 * Math.exp(-(((x - 82) / 12) ** 2))
  - 10 * Math.exp(-(((x - 104) / 15) ** 2)) - 5 * Math.exp(-(((x - 168) / 9) ** 2));

function pixLetters(pc, s, x, y, c) {
  const G = { T: '111010010010010', I: '111010010010111', C: '111100100100111', O: '111101101101111' };
  for (const ch of s) { const g = G[ch]; for (let i = 0; i < 15; i++) if (g[i] === '1') pc.px(x + (i % 3), y + ((i / 3) | 0), c); x += 4; }
}
function paper(pc, x, y, w, h) {
  pc.rect(x + 1, y + 1, w, h, '#00000040');
  pc.rect(x, y, w, h, '#f4efe2'); pc.hline(x, y + h - 1, w, '#d8d0c0'); pc.vline(x + w - 1, y, h, '#e0d8c8');
  pc.rect(x - 1, y - 1, 4, 2, '#f0e0a0c0'); pc.rect(x + w - 3, y - 1, 4, 2, '#f0e0a0c0');
}
function bakeRoom() {
  const pc = new PixelCanvas(RW, RH);
  pc.translate(-RX0, -RY0);
  const X1 = RX0 + RW, Y1 = RY0 + RH;
  // parede: listras + estrelinhas e luas
  for (let y = RY0; y < 30; y++) for (let x = RX0; x < X1; x++) {
    let c = ((x + 288) / 12 | 0) % 2 ? '#7470b8' : '#7c78c2';
    if (y > 12 && hash2(x, y, 3) < (y - 12) / 26) c = '#66629f';
    pc.px(x, y, c);
  }
  for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 25; gx++) {
    const x = RX0 + 8 + gx * 24 + (gy % 2) * 12, y = -158 + gy * 24, c = '#9c98dc';
    if (y > 20) continue;
    if ((gx + gy) % 3 === 0) { pc.vline(x, y - 2, 4, c); pc.px(x + 1, y - 2, c); pc.px(x + 1, y + 1, c); pc.px(x + 2, y - 3, c); pc.px(x + 2, y + 2, c); }
    else { pc.px(x, y, c); pc.px(x - 1, y, c); pc.px(x + 1, y, c); pc.px(x, y - 1, c); pc.px(x, y + 1, c); }
  }
  pc.rect(RX0, RY0, RW, 6, '#5c58a0'); pc.hline(RX0, RY0 + 6, RW, '#9a96d8'); pc.hline(RX0, RY0 + 7, RW, '#4a4688');
  pc.rect(RX0, 30, RW, 10, '#d4cae6'); pc.hline(RX0, 30, RW, '#f2eafa'); pc.rect(RX0, 38, RW, 2, '#9a8eb4');
  pc.rect(282, RY0, 6, 216, '#5a5694');
  // assoalho de tábuas
  let yy = 40, row = 0;
  while (yy < Y1) {
    const h = 7 + row;
    for (let y = yy; y < Math.min(Y1, yy + h); y++) for (let x = RX0; x < X1; x++) {
      let c = '#a8744a';
      if (y === yy) c = '#76492c'; else if (y === yy + 1) c = '#c08a5a'; else if (hash2(x >> 2, y, row) < 0.1) c = '#986640';
      pc.px(x, y, c);
    }
    for (let x = RX0 + (row * 53) % 70; x < X1; x += 70 + (row % 3) * 10) pc.vline(x, yy, h, '#76492c');
    yy += h; row++;
  }
  for (let x = RX0; x < X1; x++) for (let y = 40; y < 46; y++) if (hash2(x, y, 9) < (46 - y) / 7) pc.px(x, y, '#5a3420a0');
  // tapete trançado
  ['#c85a5a', '#e8b050', '#5a8ac8', '#e8e0d0', '#c85a5a', '#7cc46a'].forEach((c, k) => pc.ellipse(112, 86, 80 - k * 12, 16 - k * 2.4, c));
  for (let x = 34; x < 192; x += 3) for (let y = 71; y < 102; y += 2) if (hash2(x, y, 4) < 0.25) pc.px(x, y, '#ffffff30');
  // janela (moldura; o vidro fica vazio para a vista dinâmica)
  pc.rect(GX - 6, GY - 6, GW + 12, GH + 12, '#e6dccd'); pc.rect(GX - 6, GY - 6, GW + 12, 2, '#fff6ea'); pc.rect(GX - 6, GY + GH + 4, GW + 12, 2, '#b8aa98');
  pc.strokeRect(GX - 1, GY - 1, GW + 2, GH + 2, '#a89a88');
  for (let y = GY; y < GY + GH; y++) for (let x = GX; x < GX + GW; x++) pc.erase(x, y);
  pc.rect(GX + 42, GY, 3, GH, '#e6dccd'); pc.vline(GX + 44, GY, GH, '#b8aa98');
  pc.rect(GX, GY + 42, GW, 3, '#e6dccd'); pc.hline(GX, GY + 44, GW, '#b8aa98');
  pc.rect(GX - 12, GY + GH + 6, GW + 24, 5, '#efe6d8'); pc.hline(GX - 12, GY + GH + 6, GW + 24, '#fffaf0'); pc.rect(GX - 10, GY + GH + 11, GW + 20, 2, '#8a7c90');
  // estante com brinquedos
  for (const sy of [-100, -64]) {
    pc.rect(-120, sy, 86, 4, '#a0703e'); pc.hline(-120, sy, 86, '#c89058'); pc.hline(-120, sy + 3, 86, '#6a4428');
    pc.rect(-114, sy + 4, 3, 6, '#7a5030'); pc.rect(-44, sy + 4, 3, 6, '#7a5030');
  }
  [['#d05050', 16], ['#5080d0', 13], ['#e0c050', 17], ['#60b060', 14], ['#a060c0', 15]].forEach(([c, h], i) => {
    pc.rect(-117 + i * 4, -100 - h, 3, h, c); pc.hline(-117 + i * 4, -97 - h, 3, '#ffffff60');
  });
  pc.rect(-94, -110, 10, 10, '#a8b0c0'); pc.rect(-92, -117, 6, 6, '#c4ccdc'); pc.px(-91, -115, '#ffd23f'); pc.px(-88, -115, '#ffd23f');
  pc.vline(-89, -121, 4, '#8890a0'); pc.px(-89, -122, '#e84848'); pc.rect(-96, -108, 2, 5, '#8890a0'); pc.rect(-84, -108, 2, 5, '#8890a0');
  pc.rect(-91, -107, 4, 3, '#4a7fe0');
  pc.rect(-72, -114, 6, 14, '#eeeeee'); pc.tri(-72, -114, -66, -114, -69, -120, '#e84848'); pc.tri(-74, -100, -72, -100, -72, -105, '#e84848');
  pc.tri(-66, -100, -64, -100, -66, -105, '#e84848'); pc.px(-69, -110, '#4a7fe0'); pc.px(-70, -110, '#7ab0ff');
  pc.circle(-55, -106, 5, '#a8d8f0'); pc.px(-57, -108, '#ffffff'); pc.rect(-60, -102, 10, 2, '#8a5a3a'); pc.px(-54, -104, '#ffffff');
  pc.rect(-117, -71, 7, 7, '#d84a4a'); pc.rect(-109, -71, 7, 7, '#4a7ad8'); pc.rect(-113, -78, 7, 7, '#e8c040');
  pc.px(-114, -68, '#fff'); pc.px(-113, -67, '#fff'); pc.px(-106, -68, '#fff'); pc.px(-110, -75, '#fff');
  pc.circle(-92, -69, 5, '#e84848'); pc.hline(-96, -69, 9, '#ffffff'); pc.px(-94, -72, '#ff9a9a');
  pc.ellipse(-74, -70, 5, 6, '#a8784a'); pc.circle(-74, -79, 4, '#b88858'); pc.circle(-77, -82, 1.6, '#a8784a'); pc.circle(-71, -82, 1.6, '#a8784a');
  pc.px(-76, -80, '#1a1010'); pc.px(-72, -81, '#1a1010'); pc.px(-71, -80, '#1a1010'); pc.px(-72, -79, '#1a1010'); pc.px(-71, -82, '#1a1010'); pc.px(-74, -77, '#5a3020');
  pc.poly([[-58, -66], [-42, -66], [-45, -64], [-55, -64]], '#8a5a3a'); pc.vline(-50, -80, 14, '#6a4428'); pc.tri(-49, -79, -49, -67, -42, -67, '#ffffff'); pc.tri(-51, -77, -51, -67, -56, -67, '#e84848');
  // desenhos da Lia na parede
  paper(pc, 62, -114, 28, 22);
  pc.circle(68, -108, 3, '#ffd23f'); for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) pc.px(68 + dx, -108 + dy, '#ffb020');
  pc.tri(74, -101, 88, -101, 81, -108, '#d05040'); pc.rect(76, -101, 10, 7, '#c89060'); pc.rect(80, -98, 2, 4, '#6a4020'); pc.hline(63, -94, 26, '#6ac060');
  paper(pc, 98, -122, 38, 27);
  pc.circle(106, -114, 2.5, '#f0c8a0'); pc.hline(103, -117, 6, '#6a3a20'); pc.vline(103, -116, 4, '#6a3a20'); pc.tri(103, -104, 109, -104, 106, -111, '#ff8ab0');
  pc.circle(118, -115, 2.5, '#f0c8a0'); pc.circle(118, -118, 1.6, '#c0c0c8'); pc.tri(115, -104, 121, -104, 118, -112, '#9a6ad0');
  pc.ellipse(129, -106, 4.5, 3, '#3fc7c0'); pc.circle(131, -111, 2.6, '#3fc7c0'); pc.px(127, -109, '#ffd23f'); pc.px(125, -108, '#ffd23f'); pc.px(132, -112, '#120a18');
  pc.hline(108, -108, 8, '#2a1a2a'); pc.hline(120, -108, 6, '#2a1a2a');
  pc.px(117, -121, '#e04050'); pc.px(119, -121, '#e04050'); pc.hline(117, -120, 3, '#e04050'); pc.px(118, -119, '#e04050');
  paper(pc, 142, -111, 28, 22);
  pc.ellipse(152, -101, 6, 4, '#3fc7c0'); pc.circle(158, -106, 3, '#3fc7c0'); pc.line(146, -100, 143, -104, '#3fc7c0');
  for (let i = 0; i < 4; i++) pc.px(148 + i * 3, -106 + (i % 2), '#ffd23f');
  pixLetters(pc, 'TICO', 147, -97, '#d83a3a');
  // criado-mudo, abajur, retrato da vó, copo d'água
  pc.rect(-48, 5, 42, 5, '#b07a4a'); pc.hline(-48, 5, 42, '#d09a62'); pc.hline(-48, 9, 42, '#7a4e2e');
  pc.rect(-45, 10, 36, 28, '#94603a'); pc.strokeRect(-42, 13, 30, 11, '#74482a'); pc.strokeRect(-42, 26, 30, 11, '#74482a');
  pc.rect(-29, 17, 4, 2, '#e0c070'); pc.rect(-29, 30, 4, 2, '#e0c070'); pc.rect(-45, 38, 4, 3, '#5e3a22'); pc.rect(-13, 38, 4, 3, '#5e3a22');
  pc.ellipse(-27, 3, 7, 2.5, '#c8b090'); pc.vline(-27, -8, 10, '#a89070');
  pc.poly([[-39, -8], [-15, -8], [-19, -25], [-35, -25]], '#f4dca8');
  for (let x = -34; x < -18; x += 4) pc.vline(x, -24, 16, '#e8c88a');
  pc.hline(-39, -8, 24, '#d8b070'); pc.hline(-35, -25, 16, '#fff0c8');
  pc.rect(-46, -7, 9, 12, '#d8b050'); pc.rect(-45, -6, 7, 10, '#e8dcc8'); pc.circle(-41.5, -3, 2.4, '#c8c8d4'); pc.circle(-41.5, -1, 1.8, '#f0c8a0'); pc.rect(-44, 1, 5, 3, '#9a6ad0');
  pc.rect(-13, -3, 4, 8, '#c8e4f4c0'); pc.hline(-13, 0, 4, '#8ac0e0c0');
  // baú de brinquedos com a girafa
  pc.rect(236, 6, 44, 34, '#b0703e'); pc.rect(236, 6, 44, 2, '#d0905a'); pc.vline(244, 6, 34, '#7a4a28'); pc.vline(271, 6, 34, '#7a4a28');
  pc.rect(234, 1, 48, 5, '#c08048'); pc.hline(234, 1, 48, '#e0a060');
  pc.rect(250, -18, 5, 20, '#f0c040'); pc.ellipse(254, -21, 6, 3.5, '#f0c040'); pc.px(252, -12, '#a06020'); pc.px(253, -6, '#a06020'); pc.px(251, -2, '#a06020');
  pc.px(257, -22, '#1a1010'); pc.vline(251, -26, 3, '#a06020');
  pc.line(266, -10, 272, 4, '#a8b0c0'); pc.hline(264, -6, 6, '#c89040');
  // brinquedos no chão
  pc.rect(36, 62, 7, 7, '#d84a4a'); pc.px(38, 64, '#fff'); pc.px(39, 65, '#fff'); pc.px(40, 64, '#fff');
  pc.rect(-152, 90, 14, 5, '#4a7fe0'); pc.rect(-149, 87, 7, 3, '#7ab0ff'); pc.px(-149, 95, '#1a1a1a'); pc.px(-141, 95, '#1a1a1a');
  pc.rect(176, 104, 8, 2, '#e84848'); pc.px(184, 104, '#f0d0a0');
  // cama: cabeceira, pés, travesseiro
  pc.rect(2, -40, 10, 80, '#8a5a3a'); pc.ellipse(7, -40, 5, 5, '#8a5a3a'); pc.circle(7, -47, 3, '#a87048');
  pc.vline(4, -42, 80, '#a87048'); pc.vline(11, -40, 78, '#6a4228');
  pc.rect(198, -12, 8, 52, '#8a5a3a'); pc.circle(202, -14, 3, '#a87048'); pc.vline(199, -12, 50, '#a87048'); pc.vline(205, -12, 50, '#6a4228');
  pc.rect(6, 22, 196, 12, '#8a5a3a'); pc.hline(6, 22, 196, '#a87048'); pc.hline(6, 33, 196, '#5e3a22'); pc.strokeRect(14, 25, 180, 6, '#74482c');
  pc.rect(8, 34, 5, 8, '#6a4228'); pc.rect(193, 34, 5, 8, '#6a4228'); pc.rect(8, 40, 194, 3, '#3a204080');
  pc.rect(12, 16, 190, 6, '#ece6f2');
  pc.ellipse(34, -4, 23, 10, '#f2ecf6'); pc.ellipse(36, 0, 21, 6, '#ddd4ea'); pc.ellipse(32, -7, 18, 5, '#faf6fc');
  for (let x = 13; x < 56; x += 3) pc.px(x, 5, '#e8dcf0');
  pc.outline('#1a1228', { inside: false });
  pc.flush();
  return pc.canvas;
}
function bakeQuilt() {
  const w = 174, h = 56, pc = new PixelCanvas(w, h);
  pc.translate(-QX0, -QY0);
  const dark = PAT.map((c) => mixColor(c, '#1a0a20', 0.32)), lite = PAT.map((c) => mixColor(c, '#ffffff', 0.3));
  for (let x = 38; x < 206; x++) {
    const top = RN(qTop(x)), bot = 30 + ((x >> 2) & 1);
    for (let y = top; y <= bot; y++) {
      const px = Math.floor((x - 38) / 12), py = Math.floor((y + 18) / 9), i = (px * 3 + py * 5 + 70) % PAT.length;
      let c = y > 20 ? dark[i] : PAT[i];
      if (y - top < 2 && y <= 20) c = lite[i];
      if ((x - 38) % 12 === 0 || (y + 18) % 9 === 0) c = (x + y) & 1 ? '#fff4dc' : dark[i];
      if (i === 6 && y <= 20 && (x * 7 + y * 3) % 11 === 0) c = '#e070a0';
      if (x < 86 && y - top < 3) c = y - top === 2 ? '#c8c0dc' : '#f6f2fc';
      pc.px(x, y, c);
    }
  }
  for (let x = 38; x < 206; x++) pc.px(x, 21, '#00000030');
  pc.outline('#1a1228');
  pc.flush();
  return pc.canvas;
}
let SKY = null;
function skyline() {
  if (SKY) return SKY;
  const pc = new PixelCanvas(GW, 26), c = '#0e1028';
  for (let x = 0; x < GW; x++) { const hh = 6 + RN(4 * Math.sin(x * 0.11) + 3 * Math.sin(x * 0.37)); pc.vline(x, 26 - hh, hh, c); }
  [[6, 12, 9], [20, 8, 12], [34, 14, 8], [52, 10, 14], [66, 12, 10], [78, 8, 7]].forEach(([x, w, hh]) => {
    pc.rect(x, 26 - hh - 4, w, hh + 4, c); pc.tri(x - 1, 22 - hh, x + w + 1, 22 - hh, x + w / 2, 17 - hh, c);
    for (let i = 0; i < 3; i++) if (hash2(x, i, 1) < 0.5) pc.px(x + 2 + i * 3, 26 - hh, '#ffd27a');
  });
  pc.vline(46, 2, 10, c); pc.px(46, 1, '#ff5050');
  pc.flush();
  return (SKY = pc.canvas);
}
let ROOM = null, QUILT = null;

// ---- Lia (sprite procedural: cabeça/ombro atrás do Tico, braço na frente)
const LC = { H1: '#6b3a1f', H2: '#8c5430', H0: '#4a2412', SK: '#f6caa2', SK2: '#e2a77f', BL: '#f29a8e', EY: '#3a1e12', PJ: '#86b6ea', PJ2: '#5f8fc8', PJL: '#b4d4f6', ST: '#ffe27a', OUT: '#2a1626' };
function drawLia(pc, anim, f) {
  const C = LC;
  if (anim.startsWith('arm')) {
    const pts = anim === 'arm_hug' ? [[40, 31], [55, 28], [70, 30]] : anim === 'arm_loose' ? [[40, 32], [52, 35], [66, 37]] : [[40, 31], [56, 29], [74 + f * 2, 31 + f]];
    const [s, e, h] = pts;
    pc.thickLine(s[0], s[1], e[0], e[1], 2.6, C.PJ); pc.thickLine(e[0], e[1], h[0] - 3, h[1], 2.2, C.PJ);
    pc.line(s[0], s[1] + 2, e[0], e[1] + 2, C.PJ2); pc.line(e[0], e[1] + 2, h[0] - 3, h[1] + 2, C.PJ2);
    pc.px(s[0] + 5, s[1] - 1, C.ST); pc.px(e[0] + 3, e[1], C.ST);
    pc.rect(h[0] - 5, h[1] - 2, 2, 4, C.PJL);
    pc.ellipse(h[0], h[1], 3.2, 2.6, C.SK); pc.px(h[0] - 1, h[1] + 1, C.SK2);
    if (anim === 'arm_reach') for (const [dx, dy] of [[3, -2], [4, -1], [4, 1], [3, 2]]) pc.px(h[0] + dx, h[1] + dy, C.SK);
    pc.outline(C.OUT);
    return;
  }
  const by = anim === 'sleep' && f ? 1 : 0;
  pc.ellipse(38, 37 + by, 10, 6, C.PJ); pc.ellipse(36, 35 + by, 7, 3, C.PJL);
  pc.px(34, 37 + by, C.ST); pc.px(41, 39 + by, C.ST); pc.px(44, 35 + by, C.ST);
  pc.ellipse(18, 22, 13, 12, C.H1); pc.ellipse(9, 29, 7, 6, C.H1); pc.ellipse(13, 34, 6, 4, C.H1); pc.ellipse(22, 33, 5, 4, C.H0);
  pc.ellipse(26, 25, 8, 8, C.SK2); pc.ellipse(28, 24, 8, 8, C.SK);
  pc.poly([[16, 13], [36, 15], [35, 20], [31, 18], [28, 21], [24, 18], [20, 22], [16, 20]], C.H1);
  pc.poly([[33, 15], [38, 19], [37, 27], [34, 22]], C.H1);
  pc.px(21, 15, C.H2); pc.px(22, 15, C.H2); pc.px(23, 14, C.H2); pc.px(26, 15, C.H2); pc.px(12, 17, C.H2); pc.px(11, 18, C.H2);
  const eyes = [[25, 25], [32, 25]];
  for (const [x, y] of eyes) {
    if (anim === 'stir') { pc.hline(x - 1, y, 3, C.EY); pc.px(x - 1, y - 2, C.EY); pc.px(x, y - 2, C.EY); }
    else { pc.px(x - 1, y, C.EY); pc.px(x, y + 1, C.EY); pc.px(x + 1, y, C.EY); }
    if (anim === 'murmur') { pc.px(x + (x < 30 ? 1 : -1), y - 3, C.EY); pc.px(x, y - 2, C.EY); }
  }
  pc.px(23, 28, C.BL); pc.px(24, 28, C.BL); pc.px(34, 28, C.BL); pc.px(35, 28, C.BL); pc.px(30, 27, C.SK2);
  if (anim === 'murmur' && !f) { pc.rect(29, 30, 2, 2, '#9a3a3a'); } else if (anim === 'stir') { pc.hline(28, 30, 3, '#b0504a'); } else pc.px(29, 30, '#c0605a');
  pc.outline(C.OUT);
}
defineSprite('cs_lia', {
  w: 88, h: 44, ox: 0, oy: 0,
  anims: { sleep: { frames: 2, fps: 0.7 }, stir: { frames: 1, fps: 1 }, murmur: { frames: 2, fps: 2.5 }, arm_hug: { frames: 1, fps: 1 }, arm_loose: { frames: 1, fps: 1 }, arm_reach: { frames: 2, fps: 1.5 } },
  draw: drawLia,
});

// ---- janela: céu de tempestade, raio, chuva
function makeBolt(seed) {
  const pts = [];
  let x = GX + 18 + hash2(seed, 2, 1) * 50, y = GY - 2;
  pts.push([x, y]);
  while (y < GY + GH - 18) { y += 4 + hash2(seed, y, 3) * 5; x += (hash2(seed, y, 5) - 0.5) * 10; pts.push([x, y]); }
  const b = pts[2 + (seed % 3)], br = [[b[0], b[1]]];
  for (let k = 0; k < 4; k++) { const p = br[br.length - 1]; br.push([p[0] + 3 + hash2(seed, k, 8) * 4, p[1] + 4 + hash2(seed, k, 9) * 3]); }
  return { pts, br };
}
function lightningAt(S, t) {
  let L = 0;
  for (const s of S.strikes) {
    const d = t - s.t0;
    if (d < 0 || d > 1.8) continue;
    const e = d < 0.05 ? 1 : d < 0.11 ? 0.3 : d < 0.17 ? 0.85 : Math.exp(-(d - 0.17) * 4.2) * 0.85;
    L = Math.max(L, e * s.p);
  }
  return L;
}
function strike(cs, S, p = 1, close = true) {
  S.strikes.push({ t0: cs.time, p });
  if (S.strikes.length > 5) S.strikes.shift();
  S.bolt = makeBolt((cs.time * 997) | 0);
  if (close) { cs.sfx('thunder'); cs.shake(0.3 * p); }
  else spawnTask(cs, (function* () { yield 0.7; cs.sfx('thunder', { vol: 0.4 }); })());
}
function drawWindowView(ctx, S, t) {
  const L = S.L;
  ctx.save(); ctx.beginPath(); ctx.rect(GX, GY, GW, GH); ctx.clip();
  ctx.fillStyle = mixColor('#1a1c3e', '#c8d0ff', L); ctx.fillRect(GX, GY, GW, GH);
  ctx.fillStyle = mixColor('#252a56', '#e4e8ff', L); ctx.fillRect(GX, GY + 48, GW, GH - 48);
  for (let i = 0; i < 9; i++) {
    const cx = GX - 24 + ((i * 41 + t * (3 + (i % 3))) % (GW + 48)), cy = GY + 6 + (i * 17) % 36, r = 9 + (i * 5) % 8;
    ctx.fillStyle = mixColor(i % 2 ? '#13152c' : '#1c1e3c', '#a0aae6', L * 0.75);
    ctx.beginPath(); ctx.ellipse(RN(cx), cy, r * 1.7, r * 0.7, 0, 0, TAU); ctx.fill();
  }
  if (L > 0.22 && S.bolt) {
    ctx.globalAlpha = Math.min(1, L * 1.3);
    for (const p of [S.bolt.pts, S.bolt.br]) for (let i = 1; i < p.length; i++) seg(ctx, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 2, '#b8a8ff');
    for (const p of [S.bolt.pts, S.bolt.br]) for (let i = 1; i < p.length; i++) seg(ctx, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], 1, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(skyline(), GX, GY + GH - 26);
  ctx.fillStyle = mixColor('#6a72b0', '#ffffff', L);
  for (let i = 0; i < 70; i++) {
    const sp = 230 + (i % 5) * 28;
    const x = GX + (((hash2(i, 1, 9) * GW * 4 - t * sp * 0.22) % GW) + GW) % GW;
    const y = GY + ((hash2(i, 2, 9) * (GH + 12) + t * sp) % (GH + 12)) - 12;
    for (let k = 0; k < 5; k++) ctx.fillRect(RN(x - k * 0.45), RN(y + k), 1, 1);
  }
  ctx.restore();
}
function drawGlass(ctx, t) {
  ctx.save(); ctx.beginPath(); ctx.rect(GX, GY, GW, GH); ctx.clip();
  for (let i = 0; i < 14; i++) {
    const x = GX + 3 + ((i * 29) % (GW - 6)), y = GY + ((i * 23 + t * (6 + (i % 4) * 5)) % (GH + 20)) - 10;
    ctx.fillStyle = '#c8d4ff40'; ctx.fillRect(x, RN(y) - 6, 1, 6);
    ctx.fillStyle = '#dce4ff'; ctx.fillRect(x, RN(y), 1, 2);
  }
  ctx.fillStyle = '#ffffff12';
  for (let k = 0; k < 30; k++) { ctx.fillRect(GX + 8 + k, GY + 40 - k, 1, 1); ctx.fillRect(GX + 50 + k, GY + 80 - k, 1, 1); }
  ctx.restore();
}
function drawCurtains(ctx, S, t) {
  ctx.fillStyle = '#6a4a32'; ctx.fillRect(-262, -137, 150, 3); ctx.fillStyle = '#9a7048'; ctx.fillRect(-262, -137, 150, 1);
  ctx.fillStyle = '#d8b050'; ctx.fillRect(-266, -139, 4, 6); ctx.fillRect(-113, -139, 4, 6);
  for (const [ox, dir] of [[-258, 1], [-114, -1]]) {
    for (let y = -134; y < -6; y++) {
      const u = (y + 134) / 128;
      const w = u < 0.55 ? 26 - 15 * (u / 0.55) : 11 + 19 * ((u - 0.55) / 0.45);
      const sw = (S.wind * (7 * u + 3 * Math.sin(t * 8 + u * 7)) + 0.7 * Math.sin(t * 1.3 + u * 4 + ox)) * u;
      const a = dir > 0 ? ox + sw * 0.3 : ox - w + sw, b = dir > 0 ? ox + w + sw : ox + sw * 0.3, ww = b - a;
      ctx.fillStyle = y === -7 ? '#8a3068' : '#c8609a'; ctx.fillRect(RN(a), y, RN(ww), 1);
      ctx.fillStyle = '#9a4078';
      for (const f of [0.22, 0.52, 0.8]) ctx.fillRect(RN(a + ww * f), y, ww > 16 ? 2 : 1, 1);
      ctx.fillStyle = '#ec8cc0'; ctx.fillRect(RN(a + ww * 0.38), y, 1, 1);
      if (((y + 134) % 8 === 0)) { ctx.fillStyle = '#ffd0e8'; ctx.fillRect(RN(a + ww * 0.66), y, 1, 1); }
    }
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(dir > 0 ? ox - 1 : ox - 13, -66, 14, 3); ctx.fillStyle = '#e0a020'; ctx.fillRect(dir > 0 ? ox - 1 : ox - 13, -64, 14, 1);
  }
}

// ---- rasgo costurado e portal
function riftHW(R, yy) {
  const k = 1 - (2 * yy / R.h) ** 2;
  return k <= 0 ? 0 : R.open * 13 * Math.sqrt(k) + (hash2(yy | 0, 0, 7) - 0.5) * 2.2 * Math.min(1, R.open * 3);
}
function drawRiftBack(ctx, R, t) {
  if (R.seam <= 0 && R.open <= 0) return;
  const h2 = R.h / 2;
  for (let yy = -h2; yy <= h2; yy++) {
    const hw = riftHW(R, yy), y = RN(R.y + yy);
    if (hw >= 1) {
      ctx.fillStyle = '#0c0414'; ctx.fillRect(RN(R.x - hw), y, RN(hw * 2), 1);
      ctx.fillStyle = '#b44cff'; ctx.fillRect(RN(R.x - hw) - 1, y, 1, 1); ctx.fillRect(RN(R.x + hw), y, 1, 1);
    } else if (Math.abs(yy) < h2 * R.seam) { ctx.fillStyle = (yy + (t * 20 | 0)) % 5 ? '#c070ff' : '#ffffff'; ctx.fillRect(RN(R.x), y, 1, 1); }
  }
  for (let i = 0; i < 20; i++) {
    const a = t * 1.4 + i * 2.1, yy = Math.sin(a) * h2 * 0.8 * (((i * 7) % 12) / 12), hw = riftHW(R, yy);
    if (hw < 2) continue;
    ctx.fillStyle = i % 3 ? '#5a1a8a' : '#e0a0ff';
    ctx.fillRect(RN(R.x + Math.cos(a * 1.3) * hw * 0.7), RN(R.y + yy), 1, 1);
  }
}
function drawRiftFront(ctx, S, t) {
  const R = S.rift;
  if (R.seam <= 0 && R.open <= 0) return;
  for (const s of R.stitches) {
    if (Math.abs(s.y) > R.h / 2 * Math.max(R.seam, R.open > 0 ? 1 : 0)) continue;
    const hw = Math.max(1, riftHW(R, s.y)), y = R.y + s.y, x0 = R.x - hw - 2, x1 = R.x + hw + 2;
    if (!s.b) { seg(ctx, x0, y - 1, x1, y + 1, 1, '#e8dcf0'); seg(ctx, x0, y + 1, x1, y - 1, 1, '#e8dcf0'); }
    else { const d = Math.min(1, (t - s.b) * 3); seg(ctx, x0, y, x0 + 1, y + 2 + d * 4, 1, '#cbb8e0'); seg(ctx, x1, y, x1 - 1, y + 2 + d * 4, 1, '#cbb8e0'); }
  }
  if (R.open > 0.05) for (let yy = -R.h / 2; yy <= R.h / 2; yy += 3) {
    const hw = riftHW(R, yy);
    if (hw < 1) continue;
    ctx.fillStyle = '#7a5a9a'; ctx.fillRect(RN(R.x - hw) - 2, RN(R.y + yy), 1, 2); ctx.fillRect(RN(R.x + hw) + 1, RN(R.y + yy) + 1, 1, 2);
  }
  const C = S.cost;
  if (C.vis > 0.3 && R.open > 0.5) needles(ctx, R.x - riftHW(R, -18) - 1, R.y - 18, -2.3, 0.22, t);   // a outra mão agarra a borda
}
function drawPortal(ctx, PT, t) {
  if (PT.a <= 0.01 || PT.r < 1) return;
  drawPortalSwirl(ctx, PT.x, PT.y, PT.r, t * 2.5, ['#ff4fd8', '#a855ff', '#ffffff'], { squash: 1, arms: 5, alpha: PT.a });
  const n = Math.max(8, RN(PT.r * 0.9));
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU - t * 1.3;
    ctx.fillStyle = i % 2 ? '#ffd0ff' : '#7a2ab0';
    ctx.fillRect(RN(PT.x + Math.cos(a) * (PT.r + 3)), RN(PT.y + Math.sin(a) * (PT.r + 3)), 2, 1);
  }
  ctx.globalAlpha = PT.a;
  for (let i = 0; i < 16; i++) {
    const ph = (t * 0.8 + i / 16) % 1, rr = PT.r * (2.6 - ph * 2.3), a = i * 0.9 + ph * 3.8;
    ctx.fillStyle = i % 2 ? '#e8b0ff' : '#ffffff';
    for (let k = 0; k < 4; k++) ctx.fillRect(RN(PT.x + Math.cos(a - k * 0.05) * (rr + k)), RN(PT.y + Math.sin(a - k * 0.05) * (rr + k)), 1, 1);
  }
  ctx.globalAlpha = 1;
}
function drawFlow(ctx, S, tico, t) {
  if (S.flow <= 0.01 || !S.cost.hand) return;
  const [hx, hy] = S.cost.hand, tx = tico.x - 4, ty = tico.y - 8;
  for (let i = 0; i < 3; i++) {
    const ex = tx + (i - 1) * 7, ey = ty + (i - 1) * 2;
    drawThreadLine(ctx, hx, hy, ex, ey, t + i, '#b04aff', { sag: 10 + i * 5 + Math.sin(t * 3 + i) * 3, glow: 1.2, alpha: S.flow, stitches: false });
    for (let k = 0; k < 4; k++) {
      const u = (t * 0.9 + k / 4 + i * 0.13) % 1;
      const x = hx + (ex - hx) * u, y = hy + (ey - hy) * u + Math.sin(u * Math.PI) * (10 + i * 5);
      ctx.globalAlpha = S.flow; ctx.fillStyle = '#f4d0ff'; ctx.fillRect(RN(x), RN(y), 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

registerStage('quarto_tempestade', (ctx, cs) => {
  const S = cs.S;
  if (!S) return;
  const t = cs.time;
  S.L = lightningAt(S, t);
  const r = cs.viewRect();
  ctx.fillStyle = '#0b0716'; ctx.fillRect(RN(r.x) - 8, RN(r.y) - 8, RN(r.w) + 16, RN(r.h) + 16);
  drawWindowView(ctx, S, t);
  ctx.drawImage(ROOM || (ROOM = bakeRoom()), RX0, RY0);
  drawCurtains(ctx, S, t);
  drawGlass(ctx, t);
  drawSprite(ctx, 'cs_lia', S.lia, animFrame('cs_lia', S.lia, t), LX, LY);
  ctx.drawImage(QUILT || (QUILT = bakeQuilt()), QX0, QY0);
  drawRiftBack(ctx, S.rift, t);
  drawPortal(ctx, S.portal, t);
});

/** Mapa de luz (multiplica) + brilhos aditivos. */
function roomLight(ctx, cs) {
  const S = cs.S;
  if (!S) return;
  try {
    const W = ctx.canvas.width, H = ctx.canvas.height, lm = lightmap(W, H), l = lm.getContext('2d');
    const L = S.L, t = cs.time, R = S.rift, PT = S.portal, C = S.cost, tico = S.tico;
    l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1;
    l.fillStyle = mixColor(S.amb, '#f2f4ff', L * 0.9); l.fillRect(0, 0, W, H);
    l.setTransform(ctx.getTransform()); l.globalCompositeOperation = 'lighter';
    l.fillStyle = '#6a72aa'; l.fillRect(GX, GY, GW, GH);
    light(l, GX + GW / 2, GY + GH / 2, 80, '#3a4280', 0.8);
    if (L > 0.02) {
      l.fillStyle = '#c8d0ff';
      const fx = (x, y) => [x + 40 + (GY + GH - y) * 0.9, 46 + (GY + GH - y) * 0.72];
      for (const [x, y, w, h] of [[GX, GY, 42, 42], [GX + 45, GY, 41, 42], [GX, GY + 45, 42, 41], [GX + 45, GY + 45, 41, 41]]) {
        const q = [fx(x, y), fx(x + w, y), fx(x + w, y + h), fx(x, y + h)];
        l.globalAlpha = Math.min(1, L * 0.6);
        l.beginPath(); l.moveTo(q[0][0], q[0][1]); for (const p of q) l.lineTo(p[0], p[1]); l.fill();
        l.globalAlpha = L * 0.12;
        l.beginPath(); l.moveTo(x, y + h); l.lineTo(x + w, y + h); l.lineTo(q[2][0], q[2][1]); l.lineTo(q[3][0], q[3][1]); l.fill();
      }
      l.globalAlpha = 1;
    }
    const fl = S.lamp * (0.92 + Math.sin(t * 9) * 0.04 + Math.sin(t * 23) * 0.03);
    if (fl > 0) { light(l, -27, -14, 120, '#ffaa66', 0.8 * fl); light(l, -27, -16, 46, '#ffe2b0', 0.7 * fl); }
    const rg = Math.max(R.glow, R.seam * 0.3);
    if (rg > 0) light(l, R.x, R.y, 30 + 90 * R.open, '#a040ff', rg);
    if (PT.a > 0) { light(l, PT.x, PT.y, PT.r * 3.4, '#b050ff', PT.a); light(l, PT.x, PT.y, PT.r * 1.4, '#ffd0ff', 0.7 * PT.a); }
    if (C.vis > 0 && C.eyes && C.eye > 0) for (const [ex, ey] of C.eyes) light(l, ex, ey, 18, '#c070ff', 0.7 * C.eye * C.vis);
    if (C.vis > 0 && C.hand) light(l, C.hand[0], C.hand[1], 26, '#8a50c0', 0.5 * C.vis);
    if (tico && tico.eyeGlow > 0) light(l, tico.x + (tico.eyeX ?? 0), tico.y + (tico.eyeY ?? 0), 30, '#c070ff', tico.eyeGlow);
    if (tico && (S.flow > 0 || tico.tint > 0)) light(l, tico.x, tico.y - 8, 44, tico.tintColor || '#b050ff', Math.max(S.flow, tico.tint) * 0.7);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lm, 0, 0, W, H, 0, 0, W, H); ctx.restore();
    // brilhos (bloom)
    if (fl > 0) drawGlow(ctx, -27, -17, 20, '#ffd090', 0.45 * fl);
    if (rg > 0) drawGlow(ctx, R.x, R.y, 16 + 28 * R.open, '#c060ff', 0.5 * rg);
    if (PT.a > 0) drawGlow(ctx, PT.x, PT.y, PT.r * 1.3, '#ff80ff', 0.4 * PT.a);
    if (C.vis > 0 && C.eyes && C.eye > 0) for (const [ex, ey] of C.eyes) { drawGlow(ctx, ex, ey, 5, '#e0a0ff', C.eye * C.vis); ctx.fillStyle = '#ffffff'; ctx.fillRect(RN(ex), RN(ey), 1, 1); }
    if (tico && tico.eyeGlow > 0) drawGlow(ctx, tico.x + (tico.eyeX ?? 0), tico.y + (tico.eyeY ?? 0), 8, '#d080ff', tico.eyeGlow);
  } catch (e) { if (!S.err) { S.err = 1; console.error('[opening light]', e); } }
}
function roomScreen(ctx, cs) {
  const S = cs.S;
  if (!S) return;
  const { w, h } = cs.view;
  try {
    ctx.drawImage(vignette(w, h), 0, 0);
    if (S.L > 0.05) { ctx.globalAlpha = S.L * 0.2; ctx.fillStyle = '#e8ecff'; ctx.fillRect(0, 0, w, h); }
    ctx.globalAlpha = 1;
    if (S.black > 0) { ctx.globalAlpha = Math.min(1, S.black); ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (S.titleT) {
      // um fio dourado costura a tela por baixo do título
      const k = clamp((cs.time - S.titleT - 0.4) / 2.4, 0, 1), y0 = RN(h * 0.66), xe = RN(w * Ease.inOutQuad(k));
      for (let x = 0; x < xe; x++) {
        const y = RN(y0 + Math.sin(x * 0.045 + cs.time * 1.5) * 4);
        ctx.fillStyle = (x >> 2) % 2 ? '#ffd23f' : '#b47a14'; ctx.fillRect(x, y, 1, 1);
        if (x % 9 === 0) { ctx.fillStyle = '#fff0a0'; ctx.fillRect(x, y - 2, 1, 5); }
      }
      if (k < 1) { const y = RN(y0 + Math.sin(xe * 0.045 + cs.time * 1.5) * 4); ctx.fillStyle = '#d8e0f0'; ctx.fillRect(xe, y - 1, 9, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(xe + 9, y - 1, 2, 1); drawGlow(ctx, xe + 4, y, 10, '#ffd23f', 0.5); }
    }
  } catch (e) { if (!S.err2) { S.err2 = 1; console.error('[opening screen]', e); } }
}

function* slipAndFall(cs, a) {
  yield* tws(cs, a, { x: a.x + 8, y: a.y + 2, rot: 0.22 }, 0.55, 'inQuad');
  yield* tws(cs, a, { x: a.x + 18, y: a.y + 26, rot: 0.55 }, 0.3, 'inQuad');
  yield* tws(cs, a, { x: TF.x, y: TF.y, rot: 0.1 }, 0.32, 'inQuad');
  cs.sfx('land'); cs.sfx('stomp'); cs.shake(0.45);
  cs.particles('dust', a.x, a.y, 12); cs.particles('fluff', a.x, a.y - 6, 5);
  a.sy = 0.78; a.sx = 1.18;
  yield* tws(cs, a, { y: TF.y - 7, sy: 1, sx: 1, rot: -0.12 }, 0.15, 'outQuad');
  yield* tws(cs, a, { y: TF.y, rot: 0 }, 0.17, 'inQuad');
  cs.sfx('land', { vol: 0.4 });
}
function* spinInto(cs, a, PT, dur) {
  const x0 = a.x, y0 = a.y, t0 = cs.time, ang0 = Math.atan2(y0 - PT.y, x0 - PT.x), d0 = Math.hypot(x0 - PT.x, y0 - PT.y);
  for (;;) {
    const k = cs.skipping ? 1 : Math.min(1, (cs.time - t0) / dur), e = Ease.inQuad(k), ang = ang0 + e * 5.5, d = d0 * (1 - e);
    a.x = PT.x + Math.cos(ang) * d; a.y = PT.y + Math.sin(ang) * d + 14 * (1 - e);
    a.rot = e * 15; a.scale = 1 - e * 0.95;
    if (k >= 1) break;
    yield;
  }
  a.alpha = 0;
}

registerCutscene('opening', {
  stage: 'quarto_tempestade', music: 'opening', letterbox: true,
  drawFront: roomLight, drawScreen: roomScreen,
  run: function* (cs) {
    const S = cs.S = {
      L: 0, strikes: [], bolt: null, amb: '#2c2e5c', lamp: 1, wind: 0, black: 1, flow: 0, auto: false, titleT: 0, lia: 'sleep',
      rift: { x: 196, y: 6, h: 64, open: 0, seam: 0, glow: 0, stitches: [-24, -14, -4, 6, 16, 25].map((y) => ({ y, b: 0 })) },
      portal: { x: 132, y: 2, r: 0, a: 0 },
      cost: { vis: 0, x: 230, y: 36, lean: -0.25, head: 0, arm: Math.PI - 0.2, bend: 0.3, spread: 0.12, eye: 0, mouth: 0 },
    };
    const R = S.rift, PT = S.portal, C = S.cost;
    Object.assign(cs.cam, { x: -186, y: -76, zoom: 1.8 });
    spawnTask(cs, (function* () { for (;;) { yield 4.5 + Math.random() * 3.5; if (S.auto) strike(cs, S, 0.3 + Math.random() * 0.3, false); } })());
    const tico = S.tico = ticoActor(cs, { anim: 'lying', x: TB.x, y: TB.y, z: 6, eyeX: -15, eyeY: -9 });
    const arm = cs.actor({ sprite: 'cs_lia', anim: 'arm_hug', x: LX, y: LY, z: 7 });
    cs.actor({ z: 4, draw: (ctx) => {
      if (C.vis <= 0.01) return;
      ctx.save(); ctx.beginPath(); ctx.rect(R.x - 400, R.y - 300, 401, 600); ctx.ellipse(R.x, R.y, Math.max(1, R.open * 13), R.h / 2, 0, 0, TAU); ctx.clip();
      drawCostureiro(ctx, C, cs.time); ctx.restore();
    } });
    cs.actor({ z: 8, draw: (ctx) => drawRiftFront(ctx, S, cs.time) });
    cs.actor({ z: 9, draw: (ctx) => drawFlow(ctx, S, tico, cs.time) });

    // 1) a janela, a chuva, o quarto
    yield* tws(cs, S, { black: 0 }, 2.2, 'linear');
    strike(cs, S, 0.45, false);
    yield* cs.parallel(cs.pan(-76, -72, 7), (function* () { yield 0.6; yield* cs.caption('Era uma noite de tempestade...', 3.4); })());
    yield* cs.parallel(cs.pan(70, -32, 5), cs.zoom(1.3, 5),
      (function* () { yield 1.2; yield* cs.caption('Como em todas as noites, Lia dormia abraçada ao Tico.', 3.6); })());
    S.auto = true;
    yield* cs.parallel(cs.pan(64, -16, 2.6), cs.zoom(2.2, 2.6));
    yield 1.4;
    // 2) relâmpago: a Lia se mexe e o Tico escorrega
    strike(cs, S, 1, true); S.lia = 'stir';
    yield 0.35;
    arm.setAnim('arm_loose');
    yield 0.3;
    spawnTask(cs, (function* () { yield 0.5; yield* cs.pan(112, 26, 1.1, 'inOutQuad'); })());
    yield* slipAndFall(cs, tico);
    S.lia = 'sleep';
    yield* cs.parallel(cs.pan(112, 30, 0.6), cs.zoom(2.0, 0.8));
    yield 0.9;
    // 3) silêncio. O abajur pisca e apaga.
    S.auto = false; cs.music(null, { fade: 2 });
    yield 1.6;
    for (const d of [0.1, 0.07, 0.18, 0.05, 0.25, 0.06, 0.12]) { S.lamp = S.lamp > 0.5 ? 0.15 : 1; yield d; }
    S.lamp = 0; S.amb = '#1e1e44';
    yield 1.3;
    // 4) um rasgo costurado por dentro se abre no ar
    cs.sfx('shadow_whisper');
    yield* cs.parallel(cs.pan(168, 8, 2.4), cs.zoom(1.75, 2.4), tws(cs, R, { seam: 1, glow: 0.45 }, 2.2));
    yield 0.4;
    for (const [i, idx] of [2, 3, 1, 4, 0, 5].entries()) {
      R.stitches[idx].b = cs.time;
      cs.sfx('thread_snap', { pitch: 0.85 + i * 0.07 });
      cs.particles('thread', R.x, R.y + R.stitches[idx].y, 4, { colors: ['#e8dcf0', '#c070ff'] });
      yield* tws(cs, R, { open: (i + 1) / 6, glow: 0.5 + 0.5 * (i + 1) / 6 }, 0.3, 'outBack');
      yield 0.18;
    }
    cs.shake(0.15);
    yield 0.7;
    // 5) dedos-agulha... e ele se debruça para fora
    C.vis = 1; cs.sfx('needle');
    yield* tws(cs, C, { x: R.x + 22, arm: Math.PI - 0.05, spread: 0.34 }, 1.6, 'outCubic');
    yield* tws(cs, C, { spread: 0.14 }, 0.4);
    yield* tws(cs, C, { spread: 0.36 }, 0.4);
    cs.music('revelation'); cs.sfx('heartbeat');
    yield* cs.parallel(
      tws(cs, C, { x: R.x - 2, y: R.y + 14, lean: -1.1, arm: 2.2, bend: 0.2, spread: 0.2, eye: 1 }, 2.8, 'inOutCubic'),
      cs.pan(150, 10, 2.8), cs.zoom(2.0, 2.8));
    cs.shake(0.12);
    const fx = C.face ? C.face[0] : 146, fy = C.face ? C.face[1] : -12;
    yield* cs.parallel(cs.pan(fx - 10, fy + 20, 1.2), cs.zoom(2.8, 1.2));
    C.mouth = 1;
    yield* cs.say([{ who: 'costureiro', expr: 'neutral', text: 'Fio... antigo.', wait: 1.5 }]);
    C.mouth = 0;
    yield 0.5;
    C.mouth = 1; C.head = 0.15;
    yield* cs.say([{ who: 'costureiro', expr: 'happy', text: 'Finalmente.', wait: 1.3 }]);
    C.mouth = 0;
    // examina o brinquedo: as costuras brilham dourado
    yield* cs.parallel(cs.pan(128, 40, 1.4), cs.zoom(2.2, 1.4), tws(cs, C, { arm: 2.12, bend: 0.45, spread: 0.12 }, 1.4));
    tico.tintColor = '#ffd23f'; cs.sfx('magic_hum'); cs.particles('sparkle', tico.x, tico.y - 6, 10);
    yield* tws(cs, tico, { tint: 0.55 }, 0.35); yield* tws(cs, tico, { tint: 0 }, 0.6);
    // 6) fios roxos entram nas costuras
    cs.sfx('bind'); tico.tintColor = '#b45cff';
    yield* cs.parallel(tws(cs, S, { flow: 1 }, 1.2), tws(cs, tico, { tint: 0.5 }, 1.6),
      (function* () { for (let i = 0; i < 7; i++) { cs.particles('portal', tico.x - 6 + i * 2, tico.y - 8, 3); cs.shake(0.05); yield 0.22; } })());
    tico.anim = 'wake'; tico.frame = 2; tico.eyeGlow = 1; tico.tint = 0.15;
    cs.flash('#b45cff', 0.3); cs.sfx('secret'); cs.shake(0.25);
    yield* cs.parallel(cs.zoom(3.0, 0.25, 'outQuad'), cs.pan(tico.x - 10, tico.y - 8, 0.25));
    yield 0.85;
    tico.eyeGlow = 0; tico.frame = null; tico.anim = 'lying';
    yield* cs.parallel(tws(cs, S, { flow: 0 }, 0.5), tws(cs, tico, { tint: 0 }, 0.6));
    // 7) o portal enorme — e o Tico é arremessado
    yield* cs.parallel(cs.pan(140, 8, 1.2), cs.zoom(1.55, 1.2), tws(cs, C, { lean: -0.55, arm: -2.0, bend: -0.5, spread: 0.45, head: -0.1 }, 1.2, 'inOutCubic'));
    cs.sfx('portal'); cs.sfx('rumble'); cs.shake(0.3);
    yield* cs.parallel(tws(cs, PT, { r: 38, a: 1 }, 1.4, 'outBack'), tws(cs, S, { wind: 1 }, 1.4));
    yield 0.5;
    yield* tws(cs, C, { arm: -2.9, bend: -0.1 }, 0.22, 'outQuad');
    cs.sfx('whoosh');
    yield* spinInto(cs, tico, PT, 1.3);
    cs.sfx('portal'); cs.flash('#ff80ff', 0.25); cs.particles('portal', PT.x, PT.y, 20);
    yield 0.5;
    // ele recua, o portal fecha e o rasgo se costura de novo
    yield* cs.parallel(
      tws(cs, C, { x: R.x + 34, lean: -0.2, vis: 0, eye: 0 }, 1.2, 'inCubic'),
      (function* () { yield 0.5; yield* tws(cs, PT, { r: 0, a: 0 }, 0.6, 'inBack'); cs.flash('#ffffff', 0.2); cs.shake(0.25); cs.sfx('boom'); })(),
      (function* () { yield 0.9; for (const s of R.stitches) s.b = 0; cs.sfx('stitch_connect'); yield* tws(cs, R, { open: 0, glow: 0 }, 0.8); yield* tws(cs, R, { seam: 0 }, 0.5); })(),
      tws(cs, S, { wind: 0 }, 2));
    // 8) silêncio. A Lia tateia o espaço vazio.
    yield 1.2;
    S.auto = true;
    yield* cs.parallel(cs.pan(52, -14, 2.6), cs.zoom(2.3, 2.6));
    yield 0.6;
    S.lia = 'murmur'; arm.setAnim('arm_reach');
    yield 0.8;
    yield* cs.say([{ who: 'lia', expr: 'sleepy', text: 'Tico...?', at: LIA_HEAD, wait: 2.2 }]);
    yield 1.6;
    S.auto = false;
    yield* tws(cs, S, { black: 1 }, 2.4, 'linear');
    // 9) cartão de título
    cs.music('title'); S.titleT = cs.time;
    yield* cs.title('Stitched Worlds', 'O Último Brinquedo', 4.6);
    yield 0.4;
  },
});

// ============================================================ 'arrival' (dentro da fase w1_1)
function* fallTo(cs, a, x, y, dur) {
  const x0 = a.x, y0 = a.y, t0 = cs.time;
  for (;;) {
    const k = cs.skipping ? 1 : Math.min(1, (cs.time - t0) / dur);
    a.x = x0 + (x - x0) * k; a.y = y0 + (y - y0) * k * k; a.rot = k * 9.4;
    if (k >= 1) return;
    yield;
  }
}
function* faceplant(cs, a, gy) {
  a.anim = 'hurt'; a.rot = 1.95; a.y = gy + 6; a.sx = 1.2; a.sy = 0.8;
  cs.sfx('land'); cs.sfx('en_bonk'); cs.shake(0.4);
  cs.particles('dust', a.x + 12, gy, 12); cs.particles('fluff', a.x + 10, gy - 4, 6);
  yield* tws(cs, a, { sx: 1, sy: 1 }, 0.2, 'outQuad');
}
registerCutscene('arrival', {
  run: function* (cs) {
    const L = cs.level, p = cs.player;
    const gx = RN(p.cx), gy = RN(p.bottom), vx = gx + 4, vy = Math.max(48, gy - 236);
    p.draw = NOOP;   // o ator faz o papel do Tico; o jogador volta no fim
    const vortex = cs.actor({ x: vx, y: vy, z: 2, k: 0, draw: (ctx, a) => drawThreadVortex(ctx, a.x, a.y, 36, cs.time, a.k) });
    const tico = ticoActor(cs, { anim: 'fall', x: vx, y: vy + 12, z: 30, alpha: 0 });
    yield* cs.pan(vx, vy + 50, 0);
    yield 0.5;
    cs.sfx('portal');
    yield* tws(cs, vortex, { k: 1 }, 1.1, 'outBack');
    cs.particles('portal', vx, vy, 16);
    yield 0.35;
    // a queda pelo túnel de fios
    tico.alpha = 1; cs.sfx('whoosh');
    yield* cs.parallel(fallTo(cs, tico, gx, gy, 1.15), cs.pan(gx, gy - 40, 1.15, 'inQuad'),
      (function* () { yield 0.55; yield* tws(cs, vortex, { k: 0 }, 0.6, 'inBack'); })());
    yield* faceplant(cs, tico, gy);
    yield* cs.zoom(1.8, 0.5, 'outQuad');
    yield 0.6;
    tico.anim = 'swim';   // perninhas balançando no ar
    yield 1.1;
    tico.anim = 'lying'; tico.rot = 0; tico.y = gy;
    cs.particles('dust', gx, gy, 6); cs.sfx('land', { vol: 0.5 });
    yield 0.6;
    tico.anim = 'wake'; tico.t = 0;
    yield 1.05;
    tico.anim = 'surprise'; tico.t = 0;
    yield* cs.say([{ who: 'tico', expr: 'surprised', text: 'Eu... estou me {#ffd23f}mexendo{/}?!', at: tico }]);
    tico.anim = 'look_down';
    yield* cs.say([{ who: 'tico', expr: 'surprised', text: 'Patas! Eu tenho patas que MEXEM!', at: tico }]);
    tico.anim = 'idle';
    yield* cs.walk(tico, gx + 12, 26);
    tico.y = gy; yield* faceplant(cs, tico, gy);
    yield 0.5;
    yield* cs.say([{ who: 'tico', expr: 'confused', text: 'Tá. Andar é mais difícil do que parece.', at: tico }]);
    tico.rot = 0; tico.y = gy; tico.anim = 'land'; tico.t = 0; cs.particles('dust', tico.x, gy, 5);
    yield 0.3;
    tico.anim = 'surprise'; tico.t = 0;
    yield* cs.say([{ who: 'tico', expr: 'surprised', text: 'Eu tenho DENTES? ...Ah, não. São costuras.', at: tico }]);
    tico.anim = 'idle';
    cs.face(tico, 'left'); yield 0.6; cs.face(tico, 'right'); yield 0.3;
    yield* cs.parallel(cs.zoom(1.2, 1.4), cs.pan(gx + 170, gy - 70, 1.6));
    yield 0.6;
    yield* cs.say([{ who: 'tico', expr: 'confused', text: 'Onde eu tô? Isso não é o quarto da Lia...' }]);
    yield* cs.parallel(cs.zoom(1.7, 1.0), cs.pan(tico.x, gy - 24, 1.2));
    tico.anim = 'scared';
    yield* cs.say([{ who: 'tico', expr: 'scared', text: 'Lia? LIA?!', at: tico, shake: true }]);
    tico.anim = 'sad';
    yield 0.8;
    yield* cs.say([{ who: 'tico', expr: 'sad', text: 'Ela vai acordar... e não vai me achar.', at: tico }]);
    tico.anim = 'idle';
    yield 0.4;
    tico.anim = 'celebrate'; tico.t = 0;
    yield* cs.say([{ who: 'tico', expr: 'determined', text: 'Então eu vou voltar pra casa. Custe o que custar!', at: tico }]);
    tico.anim = 'idle';
    yield* cs.zoom(1, 0.6);
    // devolve o controle: o jogador assume onde o ator está
    p.x = RN(tico.x - p.w / 2); p.y = RN(gy - p.h); p.vx = 0; p.vy = 0; p.facing = tico.flip ? -1 : 1;
    delete p.draw;
    cs.removeActor(tico);
    try { L.hud?.showTitle?.(L.data.name, L.data.subtitle); } catch (e) { /* opcional */ }
  },
});
