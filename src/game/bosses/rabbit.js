// =============================================================================
// bosses/rabbit.js — CHEFE DO MUNDO 1: "O COELHO SEM ROSTO" + fase w1_6
//
// Fase 'w1_6' "O Coração da Floresta" (noite, música 'boss_rabbit'):
//   Parte A — PERSEGUIÇÃO: o coelho gigante (rabbit_chaser) persegue o Tico aos
//     pulos pelo corredor da floresta, esmagando árvores ('q' = rabbit_tree).
//     Velocidade elástica (fica ~150 px atrás); encostar = 1 de dano + pausa.
//     Vãos com ilhós (Costura Dimensional) e 2 checkpoints.
//   Parte B — ARENA (camera.lockTo): o Tico entra por um túnel onde o coelho não
//     cabe; um espinheiro fecha a entrada. 2 ilhós nas paredes (props.wall) ficam
//     além dos 10 tiles normais da costura: interceptamos anchor.fizzle() e
//     costuramos o fio de parede a parede (thread_bridge, contrato de stitch.js).
//     Lustre de brinquedos (rabbit_chandelier) preso por corda num gancho na
//     parede direita (rabbit_cleat, atacável).
// Chefe 'boss_rabbit' (Enemy, boss=true, ~24 PV × poder do jogador):
//   Fase 1: pulo-esmagador (sombra-alvo → ondas no chão: pule-as → fica ENTALADO
//           1,5 s com a costura das costas brilhando = janela; pisar também vale),
//           golpe de orelhas (preparação piscando; pule a varrida baixa).
//   Fase 2 (≤60%): rasga a barriga; bolas de enchimento em arco (EnemyProjectile),
//           2 besourinhos (w1_ragbug), INVESTIDA: fio entre os ilhós o derruba 3 s.
//   Fase 3 (≤25%): frenesi (avisos menores, combos), birra no centro: corte a
//           corda do lustre com ele embaixo (dano grande + janela).
//   FINAL: 0 PV → desaba; "Costure o rosto!" (habilidade/ataque/interagir perto)
//           → cutscene 'boss1_defeat' (olhos de botão, "Davi...", mem_2, Pulo Duplo).
//   Fora das janelas o enchimento amortece: dano × 0,25.
// Cutscenes: 'boss1_intro' (intro da fase), 'boss1_arena', 'boss1_defeat'.
// Arte 100% procedural (sprites 'rabbit_boss' / 'rabbit_boss_t' rasgado).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, lerp, rand, damp, rectsOverlap } from '../../engine/util.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { defineSprite, drawSprite, animFrame, frameMeta, getSprite, hasSprite, defineImage, drawImage } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { input } from '../../engine/input.js';
import { game } from '../../engine/game.js';
import font from '../../engine/font.js';
import { R, registerEntity, registerLevel, registerCutscene, makeScene } from '../registry.js';
import { getStats } from '../stats.js';
import { Enemy, EnemyProjectile } from '../enemies/base.js';
import { spawnShockwave, spawnImpact, spawnFloatingText, drawGlow, drawThreadLine } from '../art/vfx.js';

// ----------------------------------------------------------------- geometria da fase
const T = TILE;
const MW = 154, MH = 22, FR = 17;          // mapa: colunas, linhas, linha do chão
const FLOOR_Y = FR * T;                    // chão da arena (px)
const AX0 = 123 * T, AX1 = 146 * T;        // interior da arena (px)
const ACX = (AX0 + AX1) / 2;               // centro (lustre)
const WALL_X = 119 * T;                    // face externa da parede esquerda da arena
const CHAND_Y = 128, PULLEY_Y = 110;       // topo do lustre / roldana
const CLEAT_X = AX1 - 5, CLEAT_Y = 12 * T + 8;
const LOCK = { x: AX0 - 16, y: 104, w: AX1 - AX0 + 32, h: 200 };

// ----------------------------------------------------------------- paleta
const OUT = '#281c28', SHADE = '#3e2e44';
const FUR = ['#584860', '#76647a', '#a696a8', '#d0c2cc'];
const INNER = ['#b86a88', '#e8a8b8'];
const STUFF = ['#a8a0b4', '#dcd6e2', '#faf8fc'];
const VOID = '#140c18', RIM = '#5a4858', THREAD = '#ece4ee', GOLD = '#ffd23f';
const PATCH = ['#8a7a5a', '#ccbc94', '#ece0bc'];
const BTN_A = ['#163464', '#2a5aa0', '#5a9ae8', '#a8d0ff'];
const BTN_B = ['#5a1434', '#a02a5a', '#e04a8a', '#ffa0c8'];
const RIB = ['#344e70', '#56769a', '#7a9aba'];
const CBTN = ['#6a1a24', '#b8323c', '#f05a5a', '#ffb8a8'];
const DIRT = ['#2e2018', '#4a3426', '#6a4a34', '#8a6a4a'];
const BARK = ['#24181a', '#3e2a24', '#5c4030', '#7c5a40'];
const WOODC = ['#4a3226', '#6a4a34', '#8a6a4a'];
const Rn = Math.round;

// ----------------------------------------------------------------- sfx próprios
registerSfx('rabbit_thud', [
  { wave: 'sine', freq: 90, freqEnd: 34, dur: 0.26, vol: 0.45 },
  { wave: 'noise', freq: 400, dur: 0.14, vol: 0.16, filter: { type: 'lowpass', freq: 650 } },
]);
registerSfx('rabbit_rip', [
  { wave: 'noise', freq: 1000, dur: 0.34, vol: 0.3, filter: { type: 'bandpass', freq: 2400, freqEnd: 800, q: 2 } },
  { wave: 'sawtooth', freq: 190, freqEnd: 80, dur: 0.22, vol: 0.06 },
]);
registerSfx('rabbit_sew', [
  { wave: 'triangle', freq: 900, freqEnd: 1400, dur: 0.07, vol: 0.12 },
  { wave: 'triangle', freq: 1000, freqEnd: 1600, dur: 0.07, vol: 0.1, delay: 0.09 },
  { wave: 'noise', freq: 3000, dur: 0.05, vol: 0.05, delay: 0.04, filter: { type: 'highpass', freq: 3000 } },
]);
registerSfx('rabbit_pop', [
  { wave: 'sine', freq: 500, freqEnd: 1150, dur: 0.09, vol: 0.25 },
  { wave: 'square', freq: 1400, dur: 0.04, vol: 0.05, delay: 0.05 },
]);
registerSfx('rabbit_puff', [{ wave: 'noise', freq: 800, dur: 0.12, vol: 0.2, filter: { type: 'lowpass', freq: 900, freqEnd: 300 } }]);

// =============================================================================
// ARTE — pintor paramétrico do coelho (vista 3/4, olhando à direita)
// =============================================================================
const SW = 112, SH = 104, GY = 101, OX = 54;   // tamanho do quadro, linha do chão, pivô x
const layers = new Map();
/** Desenha numa camada temporária, contorna e cola em pc (clipY: apaga abaixo). */
function layer(pc, fn, out = OUT, clipY = null) {
  const key = pc.w + 'x' + pc.h;
  let L = layers.get(key);
  if (!L) { L = new PixelCanvas(pc.w, pc.h); layers.set(key, L); }
  L.buf.fill(0); L.ox = 0; L.oy = 0;
  fn(L);
  if (clipY !== null) L.buf.fill(0, (clipY + 1) * L.w);
  if (out) L.outline(out);
  pc.blit(L);
}
/** Elipse sombreada (luz de cima-esquerda) com 2–4 tons. */
function ball(L, cx, cy, rx, ry, tones) {
  const n = tones.length, cuts = n === 4 ? [0.36, 0.56, 0.86] : n === 3 ? [0.42, 0.78] : [0.5];
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) continue;
    const l = (-0.5 * nx - 0.62 * ny + 0.6 * Math.sqrt(1 - d) + 1) / 2 + (((x * 7 + y * 13) & 3) - 1.5) * 0.012;
    let k = 0; while (k < cuts.length && l >= cuts[k]) k++;
    L.px(x, y, tones[k]);
  }
}
/** Orelha: tubo curvo (ang 0 = para cima, + = para frente; bend = curvatura). */
function ear(L, x0, y0, ang, len, w, bend) {
  const n = Math.max(6, Math.round(len / 1.6)), pts = [];
  let x = x0, y = y0, a = ang;
  for (let i = 0; i <= n; i++) { pts.push([x, y, i / n]); a += bend / n; x += Math.sin(a) * len / n; y -= Math.cos(a) * len / n; }
  const rr = (t) => w * (1 - 0.32 * t * t);
  for (const [px, py, t] of pts) L.ellipse(px, py, rr(t), rr(t), FUR[2]);
  for (const [px, py, t] of pts) {
    const r = rr(t);
    L.px(Rn(px - r * 0.6), Rn(py - r * 0.45), FUR[3]);
    L.px(Rn(px + r * 0.62), Rn(py + r * 0.35), FUR[1]);
  }
  for (const [px, py, t] of pts) if (t > 0.16 && t < 0.86) { const r = Math.max(1, rr(t) * 0.42); L.ellipse(px + 0.3, py, r, r, INNER[1]); }
  return pts;
}
/** Braço/perna curta (a = 0 pendurado, + = para frente/cima). */
function limb(L, x0, y0, a, len, r) {
  const ex = x0 + Math.sin(a) * len, ey = y0 + Math.cos(a) * len;
  for (let i = 0; i <= 4; i++) { const t = i / 4, q = r * (1 - 0.12 * t); L.ellipse(lerp(x0, ex, t), lerp(y0, ey, t), q, q, FUR[2]); }
  ball(L, ex, ey, r + 0.5, r + 0.5, FUR);
}
function arc(pc, cx, cy, rx, ry, a0, a1, c) {
  const n = Math.ceil((a1 - a0) * Math.max(rx, ry));
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pc.px(Rn(cx + Math.cos(a) * rx), Rn(cy + Math.sin(a) * ry), c); }
}
function button(pc, x, y, tones, r = 3) {
  pc.ellipse(x, y, r + 1, r + 1, OUT);
  ball(pc, x, y, r, r, tones);
  pc.px(Rn(x - 1), Rn(y), tones[0]); pc.px(Rn(x + 1), Rn(y), tones[0]);
}
function bow(pc, x, y) {
  x = Rn(x); y = Rn(y);
  pc.tri(x, y, x - 7, y - 4, x - 7, y + 4, OUT); pc.tri(x, y, x + 7, y - 4, x + 7, y + 4, OUT);
  pc.tri(x, y, x - 6, y - 3, x - 6, y + 3, RIB[1]); pc.tri(x, y, x + 6, y - 3, x + 6, y + 3, RIB[2]);
  pc.rect(x - 1, y - 1, 3, 3, RIB[0]);
}
/** Costura das costas (ponto fraco) — brilha dourada quando glow. */
function seam(pc, x0, y0, cx, cy, x1, y1, glow) {
  pc.curve(x0, y0, cx, cy, x1, y1, SHADE);
  const c = glow ? GOLD : THREAD;
  for (let i = 1; i < 6; i++) {
    const t = i / 6, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    pc.px(Rn(x - 1), Rn(y - 1), c); pc.px(Rn(x + 1), Rn(y + 1), c);
    if (glow) pc.px(Rn(x), Rn(y), '#fff6c0');
  }
}
/** Buraco rasgado irregular. */
function hole(pc, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
    const r = Math.hypot(dx, dy) * (1 + 0.13 * Math.sin(a * 7 + 1) + 0.07 * Math.sin(a * 13));
    if (r < 1) pc.px(x, y, r > 0.8 ? RIM : VOID);
  }
}
/** Rosto: 'blank' (rasgo), 'roar' (rasgo aberto) ou 'mend0..3' (retalho + botões). */
function face(pc, fx, fy, mode) {
  if (mode.startsWith('mend')) {
    const st = +mode.slice(4);
    pc.ellipse(fx, fy, 9, 10, OUT);
    ball(pc, fx, fy, 8, 9, PATCH);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (i % 2) pc.px(Rn(fx + Math.cos(a) * 7), Rn(fy + Math.sin(a) * 8), GOLD); }
    if (st >= 1) button(pc, fx - 3, fy - 2, BTN_A, 2.2);
    if (st >= 2) button(pc, fx + 3.5, fy - 1, BTN_B, 2.2);
    if (st >= 3) {
      pc.curve(fx - 3, fy + 4, fx, fy + 7, fx + 3, fy + 4, '#6a4a3a');
      pc.px(Rn(fx - 6), Rn(fy + 3), '#f0a0b0'); pc.px(Rn(fx + 6), Rn(fy + 3), '#f0a0b0');
    }
    return;
  }
  const big = mode === 'roar';
  hole(pc, fx, fy, big ? 8.5 : 7.5, big ? 10 : 8.5);
  ball(pc, fx - 2, fy + 3, 2.6, 2.4, STUFF); ball(pc, fx + 3, fy - 3, 2, 1.8, STUFF);
  pc.curve(fx - 3, fy + 7, fx - 1, fy + 10, fx - 3, fy + 13, THREAD);
  pc.curve(fx + 3, fy + 6, fx + 5, fy + 9, fx + 4, fy + 12, THREAD);
  for (let i = 0; i < 7; i++) {
    const a = 1.4 + i * 0.6, x = Rn(fx + Math.cos(a) * 9.5), y = Rn(fy + Math.sin(a) * 10.5);
    pc.px(x, y, THREAD); pc.px(x + 1, y + 1, THREAD);
  }
}
function belly(pc, x, y) {
  hole(pc, x, y, 7, 4.5);
  ball(pc, x - 2, y - 1, 3.6, 3, STUFF); ball(pc, x + 3, y + 1, 3, 2.6, STUFF); ball(pc, x, y + 3, 2.6, 2, STUFF);
  pc.line(Rn(x - 7), Rn(y - 1), Rn(x - 9), Rn(y + 3), THREAD); pc.line(Rn(x + 6), Rn(y - 2), Rn(x + 9), Rn(y + 1), THREAD);
}
function dirt(pc, cx, gy, rx, ry) {
  for (let y = Math.floor(gy - ry); y <= gy; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - gy) / ry;
    const d = nx * nx + ny * ny * (1 + 0.3 * Math.sin(x * 1.7));
    if (d > 1) continue;
    pc.px(x, y, d > 0.8 ? DIRT[0] : ny < -0.6 ? DIRT[3] : ((x + y) & 3) ? DIRT[2] : DIRT[1]);
  }
}

// ---- poses
function standGeom(P) {
  const sq = P.sq ?? 1, lean = P.lean ?? 0, byo = P.by ?? 0;
  const bx = 52 + lean * 0.35, by = GY - 24 * sq - byo;
  const hx = 60 + lean, hy = GY - 53 * sq - byo + (P.hdy ?? 0);
  return { sq, lean, bx, by, hx, hy, brx: 21 + (1 - sq) * 14, bry: 20 * sq, fx: hx + 7, fy: hy + 2 };
}
function paintStand(pc, P) {
  const G = standGeom(P), { sq, lean, bx, by, hx, hy, brx, bry } = G;
  const shY = by - 11 * sq;
  layer(pc, (L) => {
    const e = ear(L, hx - 7, hy - 9, P.earB ?? -1.0, P.earBLen ?? 20, 4.2, P.earBBend ?? -1.6);
    const m = e[Math.floor(e.length * 0.55)];
    L.px(Rn(m[0]) - 1, Rn(m[1]) - 1, THREAD); L.px(Rn(m[0]) + 1, Rn(m[1]) + 1, THREAD); // remendo da orelha
    limb(L, bx - 7, shY + 1, P.armB ?? 0.15, 10, 4.5);
    ball(L, bx - 10 + (P.fbx ?? 0), GY - 4 + (P.fby ?? 0), 10, 4.5, FUR);
  });
  layer(pc, (L) => {
    ball(L, bx - brx + 2, by + 5, 6.5, 6.5, STUFF);                 // rabinho de algodão
    ball(L, bx, by, brx, bry, FUR);                                 // barriga
    ball(L, bx + 3 + lean * 0.25, by - 12 * sq, brx * 0.78, 12 * sq, FUR); // peito
    ball(L, bx + 12 + (P.ffx ?? 0), GY - 4.5 + (P.ffy ?? 0), 12, 5, FUR);  // pé da frente
    ear(L, hx + 3, hy - 11, P.earF ?? 0.12, P.earFLen ?? 25, 4.6, P.earFBend ?? 0.2);
    ball(L, hx, hy, 17, 14.5, FUR);                                 // cabeça
    ball(L, hx + 8, hy + 4, 9, 7.5, FUR);                           // focinho
  });
  arc(pc, hx, hy, 17, 14.5, 0.35, 2.8, SHADE);
  layer(pc, (L) => limb(L, bx + 9 + lean * 0.3, shY + 2, P.armF ?? 0.25, 11, 5));
  const sx = bx - brx + 6;
  seam(pc, sx + 2, by - 15 * sq, sx - 4, by, sx + 1, by + 13 * sq, P.glow);
  const px0 = Rn(bx - 9), py0 = Rn(by + 5 * sq);
  pc.rect(px0, py0, 7, 6, '#8e7c92'); pc.strokeRect(px0, py0, 7, 6, SHADE);
  pc.px(px0 + 2, py0 + 2, THREAD); pc.px(px0 + 4, py0 + 3, THREAD);
  bow(pc, hx - 4, hy + 13);
  button(pc, bx + 11 + lean * 0.25, by - 5 * sq, CBTN, 3);
  if (P.torn) belly(pc, bx + 3, by + 6);
  face(pc, G.fx, G.fy, P.face || 'blank');
}
function paintStuck(pc, P) {
  const K = [[0, 0, 0, 0], [-3, -3, 2, 1], [1, -1, -2, -3], [-2, 1, 1, -2]][P.kick || 0];
  layer(pc, (L) => ball(L, 24 + K[0], 60 + K[1], 10, 4.5, FUR));
  layer(pc, (L) => {
    ball(L, 28, 74, 6.5, 6.5, STUFF);
    ball(L, 48, 80, 23, 17, FUR);
    ball(L, 66, 89, 16, 11, FUR);
    ball(L, 32 + K[2], 55 + K[3], 11, 5, FUR);
    ear(L, 86, 92, 0.55 + K[2] * 0.05, 18, 4, 0.7);
    ear(L, 93, 97, 1.65, 15, 4, 0.3);
    ball(L, 82, 100, 15, 11, FUR);
  }, OUT, GY);
  seam(pc, 30, 70, 46, 59, 66, 70, P.glow);
  if (P.torn) { ball(pc, 58, 97, 3, 2, STUFF); ball(pc, 52, 98, 2.4, 1.8, STUFF); }
  dirt(pc, 84, GY + 1, 20, 7);
}
function paintDown(pc, P) {
  const br = P.br || 0;
  layer(pc, (L) => ball(L, 22, 90, 10, 4.5, FUR));
  layer(pc, (L) => {
    ball(L, 30, 84 - br * 0.5, 6.5, 6.5, STUFF);
    ball(L, 54, 89 - br * 0.5, 27, 12 + br * 0.5, FUR);
    ball(L, 28, 96, 11, 4.5, FUR);
    ear(L, 92, 86, 1.7, 22, 4.2, 0.25);
    ear(L, 86, 85, 1.15, 19, 4, 0.55);
    ball(L, 86, 92, 15, 9.5, FUR);
    limb(L, 70, 92, 1.45, 11, 4.5);
  }, OUT, GY);
  seam(pc, 34, 82 - br, 52, 76 - br, 72, 82 - br, P.glow);
  if (P.torn) { ball(pc, 58, 100, 3.2, 2, STUFF); ball(pc, 64, 100, 2.4, 1.6, STUFF); }
  hole(pc, 93, 93, 4, 4.5);
}
function sitGeom(P) {
  const br = P.br || 0, calm = !!P.calm;
  const bx = 54, by = 80 - br * 0.5, hx = 62, hy = (calm ? 50 : 55) - br * 0.6;
  return { bx, by, hx, hy, br, calm, fx: hx + 7, fy: hy + 3, btx: bx + 11, bty: by - 6 };
}
function paintSit(pc, P) {
  const G = sitGeom(P), { bx, by, hx, hy, br, calm } = G;
  layer(pc, (L) => {
    ear(L, hx - 7, hy - 9, calm ? -0.9 : -2.0, 20, 4.2, calm ? -1.4 : -0.5);
    ball(L, 34, GY - 4, 11, 4.5, FUR);
    limb(L, bx - 9, by - 8, calm ? 0.1 : -0.15, 11, 4.5);
  });
  layer(pc, (L) => {
    ball(L, bx - 22, by + 10, 6.5, 6.5, STUFF);
    ball(L, bx, by, 24, 20 + br * 0.5, FUR);
    ball(L, 74, GY - 4, 12, 4.5, FUR);
    ear(L, hx + 3, hy - 11, calm ? 0.15 + br * 0.05 : 1.75, 24, 4.6, calm ? 0.25 : 0.65);
    ball(L, hx, hy, 17, 14.5, FUR);
    ball(L, hx + 8, hy + 4, 9, 7.5, FUR);
  });
  arc(pc, hx, hy, 17, 14.5, 0.35, 2.8, SHADE);
  layer(pc, (L) => limb(L, bx + 11, by - 7, calm ? 0.55 : 0.08, 12, 5));
  seam(pc, bx - 18, by - 14, bx - 24, by, bx - 19, by + 13, false);
  bow(pc, hx - 4, hy + 13);
  button(pc, G.btx, G.bty, CBTN, 3);
  if (P.torn) {
    belly(pc, bx + 4, by + 6);
    if (!calm) { ball(pc, bx + 18, GY - 2, 5, 3, STUFF); ball(pc, bx + 26, GY - 1, 3.5, 2, STUFF); }
  }
  face(pc, G.fx, G.fy, P.face || 'blank');
}

const ANIMS = {
  idle: { frames: 4, fps: 5, loop: true }, walk: { frames: 4, fps: 7, loop: true },
  crouch: { frames: 2, fps: 6, loop: true }, air: { frames: 2, fps: 6, loop: true },
  stuck: { frames: 4, fps: 8, loop: true }, wind: { frames: 2, fps: 10, loop: true },
  swipe: { frames: 2, fps: 14, loop: false }, charge: { frames: 4, fps: 12, loop: true },
  down: { frames: 4, fps: 4, loop: true }, throw: { frames: 2, fps: 4, loop: false },
  roar: { frames: 2, fps: 10, loop: true }, hurt: { frames: 1, fps: 1, loop: false },
  sit: { frames: 2, fps: 2, loop: true }, sew: { frames: 4, fps: 1, loop: false },
  calm: { frames: 4, fps: 4, loop: true },
};
function pose(anim, f) {
  const S = (o) => ({ kind: 'stand', ...o });
  switch (anim) {
    case 'idle': return S({ sq: [1, 0.985, 0.97, 0.985][f], earF: 0.1 + [0, 0.05, 0.1, 0.05][f], earB: -1.0 - [0, 0.06, 0.12, 0.06][f], armF: 0.22 });
    case 'walk': return S({ sq: [1.02, 0.96, 1.02, 0.96][f], lean: 3, ffx: [4, 0, -4, 0][f], fbx: [-4, 0, 4, 0][f], ffy: [-2, 0, 0, 0][f], fby: [0, 0, -2, 0][f], armF: [0.5, 0.2, -0.1, 0.2][f], armB: [-0.1, 0.2, 0.5, 0.2][f], earF: [0, 0.1, 0, 0.1][f], earB: -1.1 });
    case 'crouch': return S({ sq: [0.86, 0.8][f], lean: -2, earF: -0.6, earFBend: -0.2, earB: -1.7, armF: -0.5, armB: -0.4, ffx: 2, fbx: -2 });
    case 'air': return S({ sq: [1.1, 1.05][f], earF: -1.0, earFBend: -0.5, earFLen: 26, earB: -2.2, earBBend: -0.6, armF: 2.0, armB: 1.8, ffy: 3, fby: 2, ffx: 3 });
    case 'wind': return S({ sq: 0.96, lean: -6, earF: [-1.7, -1.85][f], earFBend: -0.3, earFLen: 27, earB: [-2.1, -2.25][f], earBBend: -0.3, earBLen: 24, armF: -0.7, armB: -0.5 });
    case 'swipe': return S({ sq: 0.94, lean: 9, earF: [1.9, 2.25][f], earFLen: [32, 36][f], earFBend: [0.3, 0.55][f], earB: [1.6, 2.0][f], earBLen: [26, 30][f], earBBend: [0.4, 0.6][f], armF: 1.3, armB: 0.9, ffx: 5 });
    case 'charge': return S({ sq: 0.9, lean: 12, hdy: 8, earF: -1.55, earFBend: -0.2, earB: -1.95, earBBend: -0.4, fbx: [-7, 0, 7, 0][f], ffx: [7, 0, -7, 0][f], fby: [0, -4, 0, 0][f], ffy: [0, 0, 0, -4][f], armF: [0.9, 0.4, -0.2, 0.4][f], armB: [-0.2, 0.4, 0.9, 0.4][f] });
    case 'throw': return f ? S({ lean: 6, armF: 1.7, armB: -0.2, earF: 0.5, earB: -0.8, sq: 0.97 }) : S({ lean: -4, armF: -2.6, armB: 0.4, earF: -0.4, earB: -1.4 });
    case 'roar': return S({ sq: [1.05, 1.07][f], hdy: -4, lean: -3, earF: [-0.25, -0.35][f], earB: [-1.4, -1.5][f], armF: [1.1, 1.25][f], armB: [0.9, 1.05][f], face: 'roar' });
    case 'hurt': return S({ sq: 1.04, lean: -7, earF: -0.7, earB: -1.8, armF: 0.9, armB: 0.7 });
    case 'stuck': return { kind: 'stuck', kick: f, glow: f % 2 === 1 };
    case 'down': return { kind: 'down', br: [0, 0.6, 1, 0.6][f], glow: f % 2 === 1 };
    case 'sit': return { kind: 'sit', br: [0, 1][f], face: 'blank' };
    case 'sew': return { kind: 'sit', face: 'mend' + f };
    case 'calm': return { kind: 'sit', calm: true, br: [0, 0.6, 1, 0.6][f], face: 'mend3' };
    default: return S({});
  }
}
function paintRabbit(pc, P) {
  if (P.kind === 'stuck') paintStuck(pc, P);
  else if (P.kind === 'down') paintDown(pc, P);
  else if (P.kind === 'sit') paintSit(pc, P);
  else paintStand(pc, P);
}
function rabbitMeta(anim, f) {
  const P = pose(anim, f);
  if (P.kind === 'stand') { const g = standGeom(P); return { fx: g.fx, fy: g.fy }; }
  if (P.kind === 'sit') { const g = sitGeom(P); return { fx: g.fx, fy: g.fy, btx: g.btx, bty: g.bty }; }
  return null;
}
for (const [name, torn] of [['rabbit_boss', false], ['rabbit_boss_t', true]]) {
  defineSprite(name, {
    w: SW, h: SH, ox: OX, oy: GY, anims: ANIMS,
    draw(pc, anim, f) { paintRabbit(pc, { ...pose(anim, f), torn }); },
    meta(anim, f) { return rabbitMeta(anim, f); },
  });
}

// ---- árvore velha (esmagável), onda de choque, lustre
defineSprite('rabbit_tree', {
  w: 44, h: 72, ox: 22, oy: 71, anims: { idle: { frames: 1, fps: 1, loop: false } },
  draw(pc) {
    layer(pc, (L) => {
      for (let y = 18; y <= 71; y++) {
        const t = (y - 18) / 53, hw = 3 + t * 4 + (y > 64 ? (y - 64) * 0.9 : 0);
        for (let x = Rn(22 - hw); x <= Rn(22 + hw); x++) { const u = (x - (22 - hw)) / (2 * hw); L.px(x, y, u < 0.25 ? BARK[3] : u < 0.62 ? BARK[2] : BARK[1]); }
      }
      L.thickLine(21, 34, 8, 22, 1.6, BARK[2]); L.thickLine(8, 22, 4, 12, 1, BARK[2]);
      L.thickLine(23, 28, 36, 18, 1.6, BARK[2]); L.thickLine(36, 18, 40, 9, 1, BARK[2]);
      L.thickLine(22, 20, 24, 6, 1.2, BARK[2]); L.thickLine(30, 23, 34, 29, 0.8, BARK[1]);
    });
    pc.ellipse(19, 46, 2.5, 3.5, BARK[0]); pc.vline(24, 38, 10, BARK[1]); pc.vline(20, 56, 8, BARK[1]);
    pc.vline(34, 30, 5, '#d8c8a8');
    layer(pc, (L) => { ball(L, 34, 38, 3, 3, ['#c8b090', '#e8d8b8', '#f8f0e0']); ball(L, 34, 44, 2.6, 3.4, ['#5a3a5a', '#7a4a6a', '#a0628a']); });
    pc.px(33, 37, '#7a5868'); pc.px(35, 39, '#7a5868'); pc.px(35, 37, '#7a5868'); pc.px(33, 39, '#7a5868');
  },
});
defineSprite('rabbit_wave', {
  w: 18, h: 16, ox: 9, oy: 15, anims: { idle: { frames: 2, fps: 12, loop: true } },
  draw(pc, a, f) {
    layer(pc, (L) => {
      ball(L, 8, 13, 8, 4, DIRT);
      ball(L, 5 - f, 9, 3, 3, ['#8a78b8', '#b8a8e0', '#e8e0ff']);
      ball(L, 10 + f, 8, 5, 5, ['#8a78b8', '#b8a8e0', '#e8e0ff']);
      ball(L, 13 + f, 5, 2.6, 2.6, STUFF);
    }, '#1e1428');
  },
});
defineImage('rabbit_chandelier', 60, 36, (pc) => {
  layer(pc, (L) => {
    for (let x = 3; x <= 56; x++) for (let y = 3; y <= 11; y++) L.px(x, y, y < 5 ? BARK[3] : y > 9 ? BARK[1] : BARK[2]);
    L.ellipse(3.5, 7.5, 2.5, 4.5, '#c8a070'); L.ellipse(56.5, 7.5, 2.5, 4.5, '#c8a070');
    const str = (x, y1) => L.vline(x, 12, y1 - 12, '#d8c8a8');
    str(9, 20); ball(L, 9, 23, 3.5, 3.5, ['#a02a3a', '#e04a4a', '#ff9a8a']);
    str(18, 23); L.rect(15, 23, 7, 7, '#2a5aa0'); L.rect(16, 24, 5, 5, '#5a9ae8'); L.px(18, 26, '#ffffff');
    str(28, 18); L.rect(24, 21, 9, 4, '#c07a3a'); L.rect(31, 17, 3, 5, '#c07a3a'); L.vline(25, 25, 4, '#8a5a2a'); L.vline(31, 25, 4, '#8a5a2a'); L.px(32, 18, '#1b1020');
    str(38, 21); L.poly([[38, 21], [40, 25], [44, 25], [41, 28], [42, 32], [38, 29], [34, 32], [35, 28], [32, 25], [36, 25]], GOLD);
    str(47, 19); ball(L, 47, 22, 3, 3, ['#c8b090', '#e8d8b8', '#f8f0e0']); ball(L, 47, 28, 3, 3.6, ['#3a8a5a', '#4ab87a', '#8ae0aa']);
    str(54, 24); ball(L, 54, 28, 3.2, 3.6, ['#a07a1a', '#e0b030', '#fff0a0']);
  });
  for (let x = 6; x < 54; x += 6) pc.px(x, 7, BARK[1]);
});

// =============================================================================
// utilidades de desenho em tempo real
// =============================================================================
function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Rn(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (w > 0) ctx.fillRect(Rn(cx - w), Rn(cy + y), w * 2, 1);
  }
}
function pxLine(ctx, x0, y0, x1, y1, color, dashed = 0) {
  ctx.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) { if (dashed && (i % dashed) > dashed / 2) continue; ctx.fillRect(Rn(x0 + (x1 - x0) * i / n), Rn(y0 + (y1 - y0) * i / n), 1, 1); }
}
function drawRabbitEyes(ctx, spr, a, f, cx, fy, facing) {
  const m = frameMeta(spr, a, f);
  if (!m || m.fx === undefined) return;
  const d = facing < 0 ? -1 : 1, ex = cx + (m.fx - OX) * d, ey = fy + (m.fy - GY);
  for (const [ox, oy] of [[-3, -1], [3, 0]]) {
    const x = Rn(ex + ox * d), y = Rn(ey + oy);
    drawGlow(ctx, x, y, 5, '#ff3a5a', 0.55);
    ctx.fillStyle = '#ff3a5a'; ctx.fillRect(x - 1, y, 2, 1);
    ctx.fillStyle = '#ffd0d8'; ctx.fillRect(x, y, 1, 1);
  }
}
function drawStars(ctx, x, y, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * 2.094, sx = Rn(x + Math.cos(a) * 12), sy = Rn(y + Math.sin(a) * 4);
    ctx.fillStyle = '#fff6a8'; ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3);
  }
}
const shadowCol = (a) => `rgba(10,4,16,${a})`;

// =============================================================================
// PROJÉTEIS / PERIGOS
// =============================================================================
/** Onda de choque que corre rente ao chão — pule por cima. */
class RabbitWave extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 12; this.h = 11; this.x = x - 6; this.y = y - this.h;
    this.dir = props.dir || 1; this.speed = props.speed || 190;
    this.enemy = true; this.contactDamage = 1; this.alwaysUpdate = true; this.z = 35; this.life = 3;
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    this.x += this.dir * this.speed * dt;
    if (Math.random() < dt * 25) this.level.particles.emit('dust', this.cx, this.y + this.h, 1);
    if (this.life <= 0 || this.x < AX0 - 2 || this.x + this.w > AX1 + 2) { this.level.particles.emit('dust', this.cx, this.y + this.h, 5); this.remove(); }
  }
  draw(ctx) {
    drawSprite(ctx, 'rabbit_wave', 'idle', animFrame('rabbit_wave', 'idle', this.t), Rn(this.cx), Rn(this.y + this.h), { flip: this.dir < 0 });
  }
}
registerEntity('rabbit_wave', RabbitWave);

/** Bola de enchimento arremessada em arco (refletível pelo Remendo Temporal). */
class FluffBall extends EnemyProjectile {
  constructor(level, x, y, props = {}) {
    super(level, x, y, { w: 8, h: 8, gravity: true, life: 4, damage: 1, color: '#f4efe6', ...props });
  }
  update(dt) { super.update(dt); if (!this.dead && Math.random() < dt * 10) this.level.particles.emit('fluff', this.cx, this.cy, 1); }
  pop() { this.level.particles.emit('fluff', this.cx, this.cy, 6); super.pop(); }
  draw(ctx) {
    const x = Rn(this.cx), y = Rn(this.cy), r = this.reflected;
    ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 5, 6, 10); ctx.fillRect(x - 5, y - 3, 10, 6); ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = r ? '#c8a020' : '#a8a0b4'; ctx.fillRect(x - 3, y - 3, 7, 7); ctx.fillRect(x - 4, y - 2, 9, 4);
    ctx.fillStyle = r ? GOLD : '#dcd6e2'; ctx.fillRect(x - 3, y - 4, 5, 6); ctx.fillRect(x - 4, y - 3, 6, 4);
    ctx.fillStyle = r ? '#fff6c0' : '#faf8fc'; ctx.fillRect(x - 2, y - 3, 2, 2);
  }
}
registerEntity('rabbit_fluffball', FluffBall);

// =============================================================================
// ÁRVORE VELHA — o coelho a esmaga durante a perseguição
// =============================================================================
class RabbitTree extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 24; this.h = 60; this.x = x + T / 2 - 12; this.y = y + T - 60;
    this.z = 6; this.smashed = false; this.rot = 0; this.alpha = 1; this.flipX = ((x / T) | 0) % 2 === 0;
    (level._rabbitTrees ||= []).push(this);
  }
  smash(dir = 1) {
    if (this.smashed) return;
    this.smashed = true; this.fallT = 0; this.dir = dir;
    audio.sfx('break_block', { pitch: 0.6 }); audio.sfx('crumble', { vol: 0.6 });
    this.level.shake(0.22);
    this.level.particles.emit('fabric', this.cx, this.y + 20, 14, { colors: [BARK[1], BARK[2], BARK[3]] });
    this.level.particles.emit('dust', this.cx, this.y + this.h, 10);
  }
  update(dt) {
    this.t += dt;
    if (!this.smashed) return;
    this.fallT += dt;
    const k = Math.min(1, this.fallT / 0.55);
    this.rot = this.dir * k * k * 1.45;
    if (this.fallT > 0.6) this.alpha = Math.max(0, 1 - (this.fallT - 0.6) / 0.5);
    if (this.alpha <= 0) this.remove();
  }
  draw(ctx) {
    drawSprite(ctx, 'rabbit_tree', 'idle', 0, Rn(this.cx), Rn(this.y + this.h), { rotation: this.rot, alpha: this.alpha, flip: this.flipX });
  }
}
registerEntity('rabbit_tree', RabbitTree);

// =============================================================================
// PERSEGUIDOR (parte A) — mesmo sprite, movimento cinemático aos pulos
// =============================================================================
class RabbitChaser extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 40; this.h = 60; this.x = x;
    this.fy = this.groundAt(x + 20) ?? FLOOR_Y; this.y = this.fy - this.h;
    this.enemy = false; this.contactDamage = 0; this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 30;
    this.state = 'lurk'; this.st = 0; this.alpha = 0; this.hopPh = 0; this.bob = 0; this.inPit = false;
    this.driven = false; this.lurkT = 0; this.thudCd = 0;
    this.light = { r: 40, color: '#a070ff', i: 0.3, flicker: 0.2 };
  }
  go(s) { this.state = s; this.st = 0; }
  emerge() { if (this.state === 'lurk') this.go('emerge'); }
  roar() {
    this.alpha = 1; this.go('roar');
    audio.sfx('boss_roar'); this.level.shake(0.7);
    this.level.particles.emit('smoke', this.cx, this.y + 20, 10, { colors: ['#8a6ac8', '#5a4a80', '#b8a8e0'] });
  }
  startChase(delay = 0) { this.alpha = 1; this.preT = delay; this.go('pre'); }
  groundAt(x) {
    const map = this.level.map, col = Math.floor(x / T);
    for (let r = 4; r < map.rows; r++) if (map.solidAt(col * T + 8, r * T + 8)) return r * T;
    return null;
  }
  onTouchPlayer() { if (this.state === 'chase') { this.go('pause'); audio.sfx('boss_roar', { vol: 0.5, pitch: 1.3 }); } }
  update(dt) {
    this.t += dt; this.st += dt;
    const L = this.level, p = L.player;
    switch (this.state) {
      case 'lurk':
        if (!this.driven && !L.inputLocked) { this.lurkT += dt; if (this.lurkT > 0.35) this.emerge(); }
        break;
      case 'emerge':
        this.alpha = Math.min(1, this.st / 1.0);
        if (Math.random() < dt * 20) L.particles.emit('smoke', this.cx + rand(-24, 24), this.y + rand(10, 60), 1, { colors: ['#8a6ac8', '#5a4a80', '#b8a8e0'] });
        if (!this.driven && this.st > 1.0) this.roar();
        break;
      case 'roar': if (!this.driven && this.st > 1.1) this.go('chase'); break;
      case 'pre': if (this.st >= this.preT) this.go('chase'); break;
      case 'pause': if (this.st > 1.0) this.go('chase'); break;
      case 'chase': this.chase(dt, p); break;
      default: break;
    }
    this.contactDamage = this.state === 'chase' ? 1 : 0;
    this.enemy = this.alpha > 0.5;
  }
  chase(dt, p) {
    const L = this.level;
    const gap = p.cx - this.cx;
    // perseguição de verdade: quase tão rápido quanto o Tico correndo e acelera se ficar longe
    let v = clamp(138 + (gap - 110) * 0.8, 122, 215);
    if (p.state === 'hurt' || p.state === 'dead' || (p.hurtInv || 0) > 0.3) v = Math.min(v, 85);
    // ninguém passa por trás do coelho: quem tentar é arremessado para a frente (evita travar a fase)
    if (gap < 14 && p.state !== 'dead' && !L.inputLocked) {
      p.x = this.x + this.w + 4; p.vx = 190; p.vy = Math.min(p.vy, -160);
      if (!(p.hurtInv > 0)) p.hurt(1, this, { noKnock: true });
      v = 0;
    }
    if (L.inputLocked) v = 0;
    this.x = Math.min(this.x + v * dt, WALL_X - 6 - this.w);   // não atravessa a parede da arena
    // altura dos pés: chão sob o centro; sobre um vão, salta em arco
    const g = this.groundAt(this.cx);
    if (g === null) {
      const col = Math.floor(this.cx / T);
      let cl = col, cr = col;
      while (cl > 0 && this.groundAt(cl * T + 8) === null) cl--;
      while (cr < MW - 1 && this.groundAt(cr * T + 8) === null) cr++;
      const gL = this.groundAt(cl * T + 8) ?? FLOOR_Y, gR = this.groundAt(cr * T + 8) ?? FLOOR_Y;
      const span = Math.max(T, (cr - cl - 1) * T), k = clamp((this.cx - (cl + 1) * T) / span, 0, 1);
      this.fy = lerp(gL, gR, k) - Math.sin(Math.PI * k) * (24 + span * 0.3);
      this.inPit = true; this.bob = 0;
    } else {
      this.fy = this.inPit ? g : damp(this.fy, g, 16, dt);
      this.inPit = false;
      this.hopPh += dt / 0.46;
      if (this.hopPh >= 1) {
        this.hopPh -= 1;
        if (Math.abs(p.cx - this.cx) < 320) {
          L.shake(0.07); audio.sfx('rabbit_thud', { vol: 0.4, cooldown: 0.1 });
          L.particles.emit('dust', this.cx, this.fy, 5);
        }
      }
      this.bob = Math.sin(this.hopPh * Math.PI) * 9;
    }
    this.y = this.fy - this.h - this.bob;
    for (const t of L._rabbitTrees || []) if (!t.smashed && this.x + this.w + 6 > t.x + 4 && this.x < t.x + t.w) t.smash(1);
    if (Math.random() < dt * 3) L.particles.emit('fluff', this.cx - 10, this.y + 20, 1);
  }
  draw(ctx) {
    if (this.alpha <= 0.01) return;
    const cx = Rn(this.cx), fy = Rn(this.y + this.h);
    if (!this.inPit) fillEllipse(ctx, cx, Rn(this.fy) - 1, Rn(20 - this.bob * 0.6), 3, shadowCol(0.35 * this.alpha));
    let a = 'walk';
    if (this.state === 'roar' || this.state === 'pause') a = 'roar';
    else if (this.state === 'lurk' || this.state === 'emerge' || this.state === 'pre') a = 'idle';
    else if (this.inPit) a = 'air';
    const f = animFrame('rabbit_boss', a, this.t);
    drawSprite(ctx, 'rabbit_boss', a, f, cx, fy, { alpha: this.alpha });
    if (this.alpha > 0.6) drawRabbitEyes(ctx, 'rabbit_boss', a, f, cx, fy, 1);
  }
}
registerEntity('rabbit_chaser', RabbitChaser);

// =============================================================================
// O COELHO SEM ROSTO (chefe)
// =============================================================================
const FIGHT = new Set(['idle', 'crouch', 'air', 'stuck', 'unstuck', 'hop2b', 'approach', 'wind', 'swipe', 'recover',
  'throw_wind', 'throw', 'summon', 'charge_tel', 'charge', 'trip', 'down', 'getup', 'bonk', 'tantrum', 'tired', 'crushed']);
const AIRBORNE = new Set(['air', 'charge', 'trip']);
const WEAK = { stuck: 1, recover: 1, bonk: 1, tired: 1, down: 0.5, crushed: 0.75 };
const NOHARM = new Set(['dormant', 'enter', 'intro_roar', 'idle_ready', 'teach', 'phase2', 'phase3', 'defeated', 'sewing',
  'calm', 'unstuck', 'getup', 'trip']);
const BOX = { stuck: [58, 38], down: [72, 30], crushed: [72, 30], bonk: [44, 56], charge: [48, 52], trip: [48, 52],
  crouch: [46, 50], tired: [46, 50], defeated: [56, 48], sewing: [56, 48], calm: [56, 48] };
const PATTERNS = {
  1: ['hop', 'swipe', 'hop', 'swipe', 'hop', 'hop'],
  2: ['summon', 'charge', 'throw', 'hop', 'swipe', 'charge', 'throw', 'hop'],
  3: ['tantrum', 'charge', 'hop2', 'throw', 'swipe', 'tantrum', 'charge', 'hop2', 'throw'],
};
const TEACH_CHARGE = [
  { who: 'tico', expr: 'surprised', text: 'Ele vai investir com tudo!' },
  { who: 'tico', expr: 'determined', text: 'Os {#ffd23f}ilhós{/} nas paredes! Se eu costurar um fio entre eles, ele tropeça!' },
];
const TEACH_CHAND = [
  { who: 'tico', expr: 'surprised', text: 'Ele está furioso! O galho inteiro tremeu...' },
  { who: 'tico', expr: 'determined', text: 'A corda do {#ffd23f}lustre de brinquedos{/} afrouxou! Se eu cortar quando ele estiver embaixo...' },
];

class RabbitBoss extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.boss = true; this.bossName = 'O Coelho Sem Rosto';
    this.bindable = false; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.z = 30; this.spriteFacesRight = true;
    this.w = 40; this.h = 60;
    this.x = (props.cx ?? AX0 + 250) - this.w / 2; this.y = FLOOR_Y - this.h;
    this.maxHp = this.hp = Math.max(12, Math.round(24 * (getStats().power || 1)));
    this.drops = { buttons: 0 };
    this.phase = 1; this.state = 'dormant'; this.st = 0; this.fired = 0;
    this.torn = false; this.frenzy = false; this.pending = 0;
    this.qi = 0; this.minions = []; this.taught = {};
    this.facing = -1; this.rot = 0; this.ready = false;
    this.sewStage = -1; this.sewing = false; this.sewStarted = false; this.prevDown = true;
    this.setActive(false);
  }
  setActive(on) { this.enemy = on; this.hittable = on; this.stompable = on; }
  get weak() { return WEAK[this.state] !== undefined; }
  get fighting() { return FIGHT.has(this.state); }
  setBox(w, h) {
    const cx = this.cx, b = this.y + this.h;
    this.w = w; this.h = h; this.x = cx - w / 2; this.y = b - h;
  }
  place(cx, feet) { this.x = cx - this.w / 2; this.y = feet - this.h; }
  faceTo(t) { if (t && Math.abs(t.cx - this.cx) > 4) this.facing = t.cx < this.cx ? -1 : 1; }
  clampArena() { this.x = clamp(this.x, AX0, AX1 - this.w); }
  go(s) {
    this.state = s; this.st = 0; this.animT = 0; this.fired = 0; this.rot = 0;
    const b = BOX[s] || [40, 60];
    this.setBox(b[0], b[1]);
    if (s === 'idle') this.idleDelay = [0, 0.95, 0.75, 0.5][this.phase];
    if (s === 'stuck') this.stuckDur = this.phase === 3 ? 1.1 : 1.5;
    if (s === 'charge') this.chargeDist = 0;
    if (s === 'phase2' || s === 'phase3') { this.phase = s === 'phase2' ? 2 : 3; this.invuln = 2; }
  }

  // ---------------------------------------------------------------- entrada / luta
  enterFrom(ch) {
    const fromX = ch ? ch.cx : AX0 - 70, fromY = ch ? ch.y + ch.h : FLOOR_Y - 150;
    if (ch) ch.remove();
    this.hop = { from: fromX, fromY, to: AX0 + 250, air: 1.1, h: 150 };
    this.facing = 1;
    this.go('enter');
  }
  finishEntrance() { this.go('idle_ready'); this.place(AX0 + 250, FLOOR_Y); this.facing = -1; this.ready = true; }
  beginFight() {
    if (this.state === 'enter' || this.state === 'intro_roar') this.finishEntrance();
    this.level.boss = this;
    this.setActive(true);
    this.light = { r: 44, color: '#a070ff', i: 0.3, flicker: 0.2 };
    this.go('idle'); this.idleDelay = 0.8;
  }

  // ---------------------------------------------------------------- dano
  die() {}
  unstitch() { return false; }
  onStomp(p) {
    // só dá para pisar quando ele está vulnerável; fora disso, pular na cabeça machuca o Tico
    if (!this.hittable) return;
    if (!this.weak || (this.stompCd || 0) > 0) {
      p.vy = -280; p.vx = (p.cx < this.cx ? -1 : 1) * 170;
      p.hurt(1, this);
      return;
    }
    this.stompCd = 0.9;
    this.hurt(2 * (p.stats?.power || 1), p, { stomp: true });
  }
  hurt(amount = 1, src = null, opts = {}) {
    if (!this.fighting || this.invuln > 0) return false;
    const mul = opts.raw ? 1 : (this.weak ? WEAK[this.state] : 0.25);
    const dmg = amount * mul;
    const floor = this.phase === 1 ? this.maxHp * 0.6 : this.phase === 2 ? this.maxHp * 0.25 : 0;
    this.hp = Math.max(floor, this.hp - dmg);
    this.flash = 0.1; this.invuln = 0.1;
    const L = this.level;
    if (mul >= 0.75) {
      audio.sfx('boss_hit', { randomPitch: 0.08 });
      L.particles.emit('fluff', this.cx, this.cy, 6);
      L.particles.emit('fabric', this.cx, this.cy, 4, { colors: FUR });
      L.shake(0.12);
      if (dmg >= 1.4) L.hitstop(0.05);
    } else {
      audio.sfx('rabbit_puff', { cooldown: 0.08 });
      L.particles.emit('fluff', this.cx, this.cy, 2);
    }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.6) this.pending = 2;
    else if (this.phase === 2 && this.hp <= this.maxHp * 0.25) this.pending = 3;
    else if (this.phase === 3 && this.hp <= 0) this.defeat();
    return true;
  }
  canBeCrushed() { return this.fighting && this.state !== 'air' && this.state !== 'trip'; }
  crush() {
    if (!this.canBeCrushed()) return false;
    this.hp = Math.max(0, this.hp - Math.max(3, this.maxHp * 0.15));
    this.flash = 0.2;
    audio.sfx('boss_hit'); this.level.shake(0.7); this.level.hitstop(0.12);
    spawnFloatingText(this.level, this.cx, this.y - 24, 'Bum!', GOLD);
    if (this.hp <= 0) { this.defeat(); return true; }
    this.go('crushed');
    return true;
  }
  defeat() {
    const L = this.level;
    this.hp = 0;
    this.go('defeated');
    this.place(clamp(this.cx, AX0 + 40, AX1 - 40), FLOOR_Y);
    this.facing = this.cx < ACX ? 1 : -1;
    L.boss = null;
    this.setActive(false);
    this.clearHazards();
    for (const m of this.minions) if (!m.dead && !m.dying) m.die?.(this);
    audio.sfx('boss_roar', { pitch: 0.7, vol: 0.7 }); audio.sfx('explosion', { vol: 0.6 });
    audio.stopMusic?.(2);
    L.shake(0.8); L.hitstop(0.3); L.flash('#ffffff', 0.3);
    L.particles.emit('fluff', this.cx, this.cy, 30);
    L.particles.emit('fabric', this.cx, this.cy, 16, { colors: FUR });
    this.interactable = true; this.prompt = 'Costurar'; this.interactRange = 30;
    this.light = { r: 46, color: '#ffe8a0', i: 0.35, flicker: 0.1 };
  }
  clearHazards() { for (const e of this.level.entities) if (e instanceof RabbitWave || e instanceof FluffBall) e.remove(); }
  pushPlayer(force = 220) {
    const p = this.level.player;
    if (Math.abs(p.cx - this.cx) < 70 && Math.abs(p.cy - this.cy) < 60) { p.vx = Math.sign(p.cx - this.cx || 1) * force; p.vy = Math.min(p.vy, -140); }
  }
  teach(lines, after) {
    this.go('teach');
    this.clearHazards();
    for (const m of this.minions) if (!m.dead) m.stunT = 99;
    for (const a of this.level._rabbitAnchors || []) a.pulse = 1.5;
    this.level.say(lines).then(() => {
      for (const m of this.minions) if (!m.dead) m.stunT = 0;
      if (this.state === 'teach') after();
    });
  }
  aliveMinions() { this.minions = this.minions.filter((e) => !e.dead && !e.dying); return this.minions.length; }
  interact() { this.startSew(); }
  startSew() {
    if (this.sewStarted || this.state !== 'defeated') return;
    this.sewStarted = true; this.interactable = false;
    this.state = 'sewing'; this.st = 0;
    this.level.cutscene('boss1_defeat', { boss: this });
  }
  calm() { this.go('calm'); this.sewStage = 3; this.sewing = false; this.light = { r: 56, color: '#ffe8a0', i: 0.5, flicker: 0.05 }; }
  facePoint() {
    const m = frameMeta('rabbit_boss_t', 'sew', 0) || { fx: 69, fy: 58 };
    return { x: this.cx + (m.fx - OX) * this.facing, y: this.y + this.h + (m.fy - GY) };
  }
  buttonPoint() {
    const m = frameMeta('rabbit_boss_t', 'sew', 0) || { btx: 65, bty: 74 };
    return { x: this.cx + (m.btx - OX) * this.facing, y: this.y + this.h + (m.bty - GY) };
  }

  // ---------------------------------------------------------------- ataques
  startHop(tx, o = {}) {
    const lo = o.wall ? AX0 + 22 : AX0 + 56, hi = o.wall ? AX1 - 22 : AX1 - 56;
    this.hop = {
      from: this.cx, to: clamp(tx, lo, hi), air: (o.air ?? 0.82) * (this.phase === 3 ? 0.9 : 1), h: o.h ?? 125,
      next: o.next || 'stuck', waves: o.waves !== false, crouch: o.crouch ?? (this.phase === 3 ? 0.4 : 0.58),
    };
    if (Math.abs(this.hop.to - this.cx) > 4) this.facing = this.hop.to < this.cx ? -1 : 1; else this.faceTo(this.level.player);
    this.go('crouch');
  }
  land() {
    const L = this.level, h = this.hop;
    this.go('idle'); this.place(h.to, FLOOR_Y);
    if (h.waves) {
      L.shake(0.45); L.hitstop(0.06);
      audio.sfx('explosion', { vol: 0.55, pitch: 0.8 }); audio.sfx('rabbit_thud');
      spawnShockwave(L, this.cx, FLOOR_Y - 4, { radius: 70, color: '#d8c8ff', color2: '#8a6ac8' });
      this.spawnWaves(this.phase === 3 ? 230 : 190);
      L.particles.emit('dust', this.cx, FLOOR_Y, 18);
      L.particles.emit('fluff', this.cx, FLOOR_Y - 20, 6);
    } else {
      L.shake(0.2); audio.sfx('rabbit_thud', { vol: 0.6 });
      L.particles.emit('dust', this.cx, FLOOR_Y, 8);
    }
    this.go(h.next);
  }
  spawnWaves(speed) {
    for (const dir of [-1, 1]) this.level.add(new RabbitWave(this.level, this.cx + dir * 24, FLOOR_Y, { dir, speed }));
  }
  throwBalls() {
    const L = this.level, p = L.player, n = this.phase === 3 ? 5 : 3;
    const sx = this.cx + this.facing * 14, sy = this.y + 8;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (n === 5 ? 26 : 30);
      const tx = clamp(p.cx + off, AX0 + 8, AX1 - 8), ty = p.cy, tf = 0.9 + i * 0.07;
      L.add(new FluffBall(L, sx, sy, { vx: (tx - sx) / tf, vy: (ty - sy - 250 * tf * tf) / tf }));
    }
    audio.sfx('rabbit_rip', { vol: 0.7 }); audio.sfx('whoosh');
    L.particles.emit('fluff', sx, sy, 8);
  }
  spawnMinions() {
    if (!R.entities.has('w1_ragbug')) return;
    const n = 2 - this.aliveMinions();
    for (let i = 0; i < n; i++) {
      const side = i === 0 ? -1 : 1, px = clamp(this.cx + side * 34, AX0 + 20, AX1 - 36);
      const e = this.level.spawn('w1_ragbug', Math.floor(px / T) * T, (FR - 1) * T, {});
      if (e) { e.vy = -200; e.facing = side; e.drops = { buttons: 1, heart: 0.25, energy: 0.5 }; this.minions.push(e); }
    }
    audio.sfx('rabbit_rip');
    this.level.particles.emit('fluff', this.cx, this.cy, 12);
    this.level.particles.emit('fabric', this.cx, this.cy, 8, { colors: ['#d0503c', '#8262a8', '#f4efe6'] });
  }
  startCharge() {
    const side = this.cx < ACX ? -1 : 1, target = side < 0 ? AX0 + 30 : AX1 - 30;
    if (Math.abs(this.cx - target) > 24) this.startHop(target, { next: 'charge_tel', waves: false, h: 70, air: 0.6, wall: true });
    else this.go('charge_tel');
  }
  checkTrip() {
    const front = this.facing > 0 ? this.x + this.w : this.x;
    for (const e of this.level.entities) {
      if (!e.isThread || e.dead || !(e.sew >= 1) || typeof e.geom !== 'function') continue;
      const g = e.geom(); if (!g) continue;
      if (front < g.L.x || front > g.R.x) continue;
      const k = (front - g.L.x) / Math.max(1, g.R.x - g.L.x);
      const y = typeof e.yAt === 'function' ? e.yAt(k, g) : lerp(g.L.y, g.R.y, k);
      if (y > this.y + 4 && y < this.y + this.h - 4) return e;
    }
    return null;
  }
  trip(b) {
    const L = this.level;
    b.snap?.();
    this.go('trip'); this.tripVx = this.facing * 200;
    audio.sfx('thread_snap'); audio.sfx('boss_hit');
    L.shake(0.45); L.hitstop(0.08);
    L.particles.emit('thread', this.cx + this.facing * 20, this.y + 20, 16);
    spawnFloatingText(L, this.cx, this.y - 30, 'Tropeçou!', GOLD);
  }
  nextAttack() {
    const pat = PATTERNS[this.phase];
    let a = pat[this.qi++ % pat.length];
    if (a === 'summon' && this.aliveMinions() >= 1) a = 'throw';
    const p = this.level.player;
    switch (a) {
      case 'hop': this.startHop(p.cx, { next: 'stuck' }); break;
      case 'hop2': this.startHop(p.cx, { next: 'hop2b' }); break;
      case 'swipe': this.go('approach'); break;
      case 'throw': this.go('throw_wind'); break;
      case 'summon': this.go('summon'); break;
      case 'charge': this.startCharge(); break;
      case 'tantrum': this.startHop(ACX, { next: 'tantrum', h: 95, air: 0.7 }); break;
      default: this.go('idle');
    }
  }

  // ---------------------------------------------------------------- IA
  update(dt) {
    this.tickTimers(dt);
    this.animT += dt; this.st += dt;
    if (this.stompCd > 0) this.stompCd -= dt;
    if (this.state === 'dormant') return;
    this.think(dt);
    this.contactDamage = (this.weak || NOHARM.has(this.state)) ? 0 : 1;
    const L = this.level;
    if (this.frenzy && this.fighting && Math.random() < dt * 6) L.particles.emit('ember', this.cx + rand(-16, 16), this.y + rand(0, 20), 1, { colors: ['#ff3a5a', '#ff8a5a'] });
    if (this.torn && this.state !== 'calm' && Math.random() < dt * 2.5) L.particles.emit('fluff', this.cx + this.facing * 8, this.cy + 6, 1);
    if (this.sewing && Math.random() < dt * 14) { const f = this.facePoint(); L.particles.emit('sparkle', f.x + rand(-9, 9), f.y + rand(-9, 9), 1); }
  }
  think(dt) {
    const L = this.level, p = L.player, s = this.state, st = this.st, P3 = this.phase === 3;
    if (this.pending && this.fighting && !AIRBORNE.has(s)) { const ph = this.pending; this.pending = 0; this.go('phase' + ph); return; }
    switch (s) {
      case 'enter': {
        const h = this.hop, k = Math.min(1, st / h.air);
        this.place(lerp(h.from, h.to, k), lerp(h.fromY, FLOOR_Y, k) - Math.sin(Math.PI * k) * h.h);
        if (k >= 1) {
          this.place(h.to, FLOOR_Y);
          L.shake(0.6); audio.sfx('explosion', { vol: 0.7 }); audio.sfx('rabbit_thud');
          spawnShockwave(L, this.cx, FLOOR_Y - 4, { radius: 80, color: '#d8c8ff', color2: '#8a6ac8' });
          L.particles.emit('dust', this.cx, FLOOR_Y, 20);
          this.go('intro_roar'); this.faceTo(p);
        }
        break;
      }
      case 'intro_roar':
        if (!this.fired && st >= 0.35) { this.fired = 1; audio.sfx('boss_roar'); L.shake(0.6); L.particles.emit('smoke', this.cx, this.y, 8, { colors: ['#8a6ac8', '#b8a8e0'] }); }
        if (st >= 1.4) { this.go('idle_ready'); this.ready = true; }
        break;
      case 'idle_ready': case 'teach': case 'defeated_wait': break;
      case 'idle':
        if (p.state === 'dead') break;
        this.faceTo(p);
        if (st >= this.idleDelay) this.nextAttack();
        break;
      // ---- pulo-esmagador
      case 'crouch':
        if (st >= this.hop.crouch) { this.go('air'); audio.sfx('whoosh', { pitch: 0.6 }); L.particles.emit('dust', this.cx, FLOOR_Y, 8); }
        break;
      case 'air': {
        const h = this.hop, k = Math.min(1, st / h.air);
        this.place(lerp(h.from, h.to, k), FLOOR_Y - Math.sin(Math.PI * k) * h.h);
        if (k >= 1) this.land();
        break;
      }
      case 'stuck':
        if (Math.random() < dt * 6) L.particles.emit('dust', this.cx + this.facing * 20, FLOOR_Y, 1);
        if (st >= this.stuckDur) { this.go('unstuck'); this.pushPlayer(160); L.particles.emit('dust', this.cx, FLOOR_Y, 12); audio.sfx('crumble', { vol: 0.5 }); }
        break;
      case 'unstuck': if (st >= 0.4) this.go('idle'); break;
      case 'hop2b': if (st >= 0.3) this.startHop(p.cx, { next: 'stuck' }); break;
      // ---- golpe de orelhas
      case 'approach': {
        this.faceTo(p);
        const dx = p.cx - this.cx;
        if (Math.abs(dx) < 66 || st > 1.5) { this.go('wind'); audio.sfx('whoosh', { pitch: 0.5, vol: 0.6 }); break; }
        this.x += Math.sign(dx) * (P3 ? 72 : 52) * dt;
        break;
      }
      case 'wind':
        if (st >= [0, 0.62, 0.55, 0.42][this.phase]) { this.go('swipe'); audio.sfx('whip_big', { pitch: 0.55 }); L.shake(0.15); }
        break;
      case 'swipe': {
        if (st < 0.2) {
          const d = this.facing, w = 58;
          const box = { x: d > 0 ? this.x + this.w - 4 : this.x - w + 4, y: FLOOR_Y - 30, w, h: 30 };
          if (rectsOverlap(box, p)) p.hurt(1, this);
        }
        if (st >= 0.32) this.go('recover');
        break;
      }
      case 'recover': if (st >= (P3 ? 0.55 : 0.75)) this.go('idle'); break;
      // ---- arremesso / invocação
      case 'throw_wind': if (st >= (P3 ? 0.35 : 0.5)) { this.go('throw'); this.throwBalls(); } break;
      case 'throw': if (st >= 0.5) this.go('idle'); break;
      case 'summon':
        if (!this.fired && st >= 0.35) { this.fired = 1; this.spawnMinions(); audio.sfx('boss_roar', { vol: 0.5, pitch: 1.2 }); }
        if (st >= 1.0) this.go('idle');
        break;
      // ---- investida
      case 'charge_tel': {
        if (!this.fired) {
          this.fired = 1; this.facing = this.cx < ACX ? 1 : -1;
          if (!this.taught.charge) { this.taught.charge = true; this.teach(TEACH_CHARGE, () => { this.go('charge_tel'); this.st = -0.5; }); break; }
          audio.sfx('rumble');
          for (const a of L._rabbitAnchors || []) a.pulse = 1.2;
        }
        if (Math.random() < dt * 8) L.particles.emit('dust', this.cx - this.facing * 16, FLOOR_Y, 2);
        if (st >= (P3 ? 1.05 : 1.35)) { this.go('charge'); audio.sfx('boss_roar', { vol: 0.5, pitch: 1.25 }); }
        break;
      }
      case 'charge': {
        const v = this.facing * (P3 ? 335 : 285);
        this.x += v * dt; this.chargeDist += Math.abs(v) * dt;
        if (Math.random() < dt * 25) L.particles.emit('dust', this.cx - this.facing * 16, FLOOR_Y, 1);
        this.stepT = (this.stepT || 0) - dt;
        if (this.stepT <= 0) { this.stepT = 0.16; audio.sfx('rabbit_thud', { vol: 0.35, pitch: 1.3 }); L.shake(0.06); }
        if (this.chargeDist > 48) { const b = this.checkTrip(); if (b) { this.trip(b); break; } }
        if (this.facing > 0 ? this.x + this.w >= AX1 - 1 : this.x <= AX0 + 1) {
          this.x = this.facing > 0 ? AX1 - this.w : AX0;
          this.go('bonk');
          L.shake(0.55); audio.sfx('explosion', { vol: 0.6 });
          spawnImpact(L, this.facing > 0 ? AX1 - 2 : AX0 + 2, this.y + 20, { size: 18 });
          for (let i = 0; i < 6; i++) L.particles.emit('fabric', rand(AX0 + 10, AX1 - 10), LOCK.y + 4, 1, { colors: ['#3a6a3a', '#5a8a4a', '#7aa85a'] });
        }
        break;
      }
      case 'trip': {
        const k = Math.min(1, st / 0.55);
        this.x += this.tripVx * dt; this.tripVx *= Math.pow(0.2, dt);
        this.clampArena();
        this.y = FLOOR_Y - Math.sin(Math.PI * k) * 26 - this.h;
        this.rot = this.facing * k * 1.35;
        if (k >= 1) {
          this.go('down'); this.y = FLOOR_Y - this.h;
          L.shake(0.55); audio.sfx('explosion', { vol: 0.6 }); L.particles.emit('dust', this.cx, FLOOR_Y, 16);
          L.particles.emit('fluff', this.cx, FLOOR_Y - 10, 10);
        }
        break;
      }
      case 'down': if (st >= (P3 ? 2.6 : 3.0)) this.go('getup'); break;
      case 'crushed': if (st >= 3.0) this.go('getup'); break;
      case 'getup': if (!this.fired) { this.fired = 1; this.pushPlayer(150); } if (st >= 0.45) this.go('idle'); break;
      case 'bonk': if (st >= 1.1) this.go('idle'); break;
      case 'tired': if (st >= 1.0) this.go('idle'); break;
      // ---- birra (fase 3) — sob o lustre
      case 'tantrum': {
        const stomps = [0.45, 1.1, 1.75];
        this.stompPose = stomps.some((x) => st >= x - 0.18 && st < x);
        if (this.fired < 3 && st >= stomps[this.fired]) {
          this.fired++;
          L.shake(0.3); audio.sfx('rabbit_thud'); audio.sfx('explosion', { vol: 0.3, pitch: 1.2 });
          spawnShockwave(L, this.cx, FLOOR_Y - 4, { radius: 50, color: '#ff8a9a', color2: '#a04a6a' });
          L.particles.emit('dust', this.cx, FLOOR_Y, 10);
          this.spawnWaves(175);
        }
        if (st >= 2.35) this.go('tired');
        break;
      }
      // ---- transições de fase
      case 'phase2': case 'phase3': {
        const two = s === 'phase2';
        if (this.fired === 0 && st >= 0.1) { this.fired = 1; audio.sfx('boss_roar'); L.shake(0.6); this.pushPlayer(); }
        if (this.fired === 1 && st >= 0.85) {
          this.fired = 2;
          audio.sfx('rabbit_rip');
          if (two) {
            this.torn = true;
            L.particles.emit('fluff', this.cx, this.cy, 30);
            L.particles.emit('fabric', this.cx, this.cy, 16, { colors: FUR });
            spawnShockwave(L, this.cx, this.cy, { radius: 60, color: '#faf8fc' });
            L.flash('#ffffff', 0.15);
          } else {
            this.frenzy = true;
            L._rabbitChand?.loosen();
            spawnShockwave(L, this.cx, this.cy, { radius: 70, color: '#ff3a5a' });
            for (let i = 0; i < 10; i++) L.particles.emit('fabric', rand(AX0 + 10, AX1 - 10), LOCK.y + 4, 1, { colors: ['#3a6a3a', '#5a8a4a', '#7aa85a'] });
            L.flash('#ff3a5a', 0.15); L.shake(0.4);
          }
        }
        if (st >= 1.9) {
          this.qi = 0;
          if (!two && !this.taught.chand) { this.taught.chand = true; this.teach(TEACH_CHAND, () => this.go('idle')); }
          else this.go('idle');
        }
        break;
      }
      // ---- final
      case 'defeated': {
        const d = input.down('ability') || input.down('attack') || input.down('interact');
        const near = Math.abs(p.cx - this.cx) < 62 && Math.abs(p.cy - this.cy) < 64;
        if (st > 1.0 && near && d && !this.prevDown && p.state !== 'dead') this.startSew();
        this.prevDown = d;
        break;
      }
      default: break;
    }
    if (s !== 'enter' && s !== 'dormant') this.clampArena();
  }

  // ---------------------------------------------------------------- desenho
  animState() {
    const s = this.state, t = this.animT;
    const spr = this.torn ? 'rabbit_boss_t' : 'rabbit_boss';
    let a = 'idle', f = null;
    switch (s) {
      case 'enter': case 'air': a = 'air'; break;
      case 'crouch': case 'getup': case 'unstuck': case 'hop2b': a = 'crouch'; break;
      case 'tired': a = 'crouch'; f = 1; break;
      case 'stuck': a = 'stuck'; break;
      case 'approach': a = 'walk'; break;
      case 'wind': a = 'wind'; break;
      case 'swipe': a = 'swipe'; f = this.st < 0.08 ? 0 : 1; break;
      case 'throw_wind': a = 'throw'; f = 0; break;
      case 'throw': a = 'throw'; f = 1; break;
      case 'summon': case 'phase2': case 'phase3': case 'intro_roar': a = 'roar'; break;
      case 'charge_tel': a = 'charge'; f = Math.floor(t * 4) % 2; break;
      case 'charge': a = 'charge'; break;
      case 'trip': case 'bonk': a = 'hurt'; break;
      case 'down': case 'crushed': a = 'down'; break;
      case 'tantrum': a = this.stompPose ? 'crouch' : 'roar'; break;
      case 'defeated': a = 'sit'; break;
      case 'sewing': if (this.sewStage >= 0) { a = 'sew'; f = this.sewStage; } else a = 'sit'; break;
      case 'calm': a = 'calm'; break;
      default: break;
    }
    if (f === null) f = animFrame(spr, a, t);
    return { spr, a, f };
  }
  angry() {
    return this.frenzy || ['charge_tel', 'charge', 'wind', 'swipe', 'approach', 'phase2', 'phase3', 'summon', 'intro_roar', 'enter', 'throw_wind'].includes(this.state);
  }
  draw(ctx) {
    if (this.state === 'dormant') return;
    const cx = Rn(this.cx), fy = Rn(this.y + this.h), s = this.state;
    // marcador do pulo
    if ((s === 'crouch' || s === 'air') && this.hop?.waves) {
      const k = s === 'air' ? Math.min(1, this.st / this.hop.air) : 0, x = Rn(this.hop.to);
      const rx = Rn(10 + 16 * k), blink = Math.floor(this.t * 12) % 2;
      fillEllipse(ctx, x, FLOOR_Y - 1, rx, 3, shadowCol(0.25 + 0.3 * k));
      ctx.fillStyle = blink ? '#ff4a6a' : GOLD;
      for (let i = 0; i < 18; i++) { const an = i / 18 * Math.PI * 2; ctx.fillRect(Rn(x + Math.cos(an) * (rx + 3)), Rn(FLOOR_Y - 1 + Math.sin(an) * 4), 1, 1); }
      const ay = FLOOR_Y - 18 - (blink ? 2 : 0);
      ctx.fillRect(x - 1, ay, 3, 5); ctx.fillRect(x - 3, ay + 5, 7, 1); ctx.fillRect(x - 2, ay + 6, 5, 1); ctx.fillRect(x, ay + 7, 1, 1);
    }
    // sombra
    const air = s === 'air' || s === 'enter' || s === 'trip';
    const hgt = air ? Math.max(0, FLOOR_Y - fy) : 0;
    fillEllipse(ctx, cx, FLOOR_Y - 1, Math.max(6, Rn(this.w * 0.55 - hgt * 0.08)), 3, shadowCol(Math.max(0.12, 0.4 - hgt * 0.002)));
    // rastro do golpe de orelhas
    if (s === 'swipe' && this.st < 0.22) {
      const k = this.st / 0.22, d = this.facing;
      ctx.globalAlpha = 1 - k * 0.6;
      for (let i = 0; i < 30; i++) {
        const an = -1.1 + (i / 29) * 2.2 * Math.min(1, k * 2.2);
        ctx.fillStyle = i % 3 ? '#ffffff' : '#d8c8ff';
        ctx.fillRect(Rn(cx + d * (14 + Math.cos(an) * 60)), Rn(FLOOR_Y - 22 + Math.sin(an) * 18), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    // sprite
    const { spr, a, f } = this.animState();
    let jx = 0;
    if (s === 'stuck' && this.st > this.stuckDur - 0.35) jx = Math.floor(this.t * 30) % 2 ? 1 : -1;
    if (s === 'charge_tel') jx = Math.floor(this.t * 20) % 2 ? 1 : 0;
    const blink = (s === 'wind' && Math.floor(this.st * 14) % 2 === 0) || (s === 'charge_tel' && Math.floor(this.st * 6) % 3 === 0);
    drawSprite(ctx, spr, a, f, cx + jx, fy, { flip: this.facing < 0, variant: (this.flash > 0 || blink) ? 'flash' : undefined, rotation: this.rot || 0 });
    if (this.angry() && !this.rot) drawRabbitEyes(ctx, spr, a, f, cx + jx, fy, this.facing);
    // tontura
    if (s === 'down' || s === 'crushed') drawStars(ctx, cx + this.facing * 30, fy - 28, this.t);
    else if (s === 'bonk' || s === 'stuck' || s === 'tired') drawStars(ctx, cx + this.facing * (s === 'stuck' ? 26 : 4), this.y - 6, this.t);
    // costura do rosto (cutscene)
    if (this.sewing) {
      const fp = this.facePoint(), p = this.level.player, an = this.t * 9;
      const nx = fp.x + Math.cos(an) * 9, ny = fp.y + Math.sin(an) * 7;
      drawThreadLine(ctx, p.cx + p.facing * 6, p.cy, nx, ny, this.t, GOLD, { sag: 6, glow: true });
      ctx.fillStyle = '#e8eef8'; ctx.fillRect(Rn(nx) - 2, Rn(ny), 5, 1);
      ctx.fillStyle = GOLD; ctx.fillRect(Rn(nx) + 2, Rn(ny) - 1, 1, 1);
    }
    // aviso final
    if (s === 'defeated' && this.st > 1.0) {
      const bob = Rn(Math.sin(this.t * 4) * 2), ty = Rn(this.y - 40 + bob);
      font.draw(ctx, 'Costure o rosto!', cx, ty, { align: 'center', color: GOLD, outline: '#1b1020' });
      const nx = cx - 4, ny = ty + 12 + (Math.floor(this.t * 3) % 2);
      ctx.fillStyle = '#e8eef8'; ctx.fillRect(nx, ny, 7, 1); ctx.fillStyle = GOLD; ctx.fillRect(nx + 7, ny - 1, 1, 1);
      pxLine(ctx, nx + 8, ny - 1, nx + 12, ny + 3, GOLD);
    }
  }
}
registerEntity('boss_rabbit', RabbitBoss);

// =============================================================================
// LUSTRE DE BRINQUEDOS + GANCHO DA CORDA
// =============================================================================
class RabbitCleat extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 14; this.h = 16; this.hittable = true; this.ch = props.ch; this.z = 16; this.alwaysUpdate = true;
  }
  onHit() { this.ch?.cut(); return true; }
  hurt() { this.ch?.cut(); return true; }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), ch = this.ch;
    ctx.fillStyle = OUT; ctx.fillRect(x + 3, y + 2, 10, 12);
    ctx.fillStyle = WOODC[1]; ctx.fillRect(x + 4, y + 3, 8, 10);
    ctx.fillStyle = WOODC[2]; ctx.fillRect(x + 4, y + 3, 8, 2);
    if (ch && ch.state === 'hang') {
      ctx.fillStyle = ch.loose ? GOLD : '#c8b088';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 5 + i * 3, 10, 1);
      if (ch.loose && Math.floor(this.t * 6) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 4, 1, 1); ctx.fillRect(x + 13, y + 10, 1, 1); }
    }
  }
}
registerEntity('rabbit_cleat', RabbitCleat);

class RabbitChandelier extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 52; this.h = 30; this.hx = x; this.hy = y;
    this.x = x - this.w / 2; this.y = y;
    this.state = 'hang'; this.loose = false; this.respawnT = 0; this.vy = 0; this.hitBoss = false;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 14;
    this.cleat = new RabbitCleat(level, CLEAT_X - 7, CLEAT_Y - 8, { ch: this });
    level.add(this.cleat);
  }
  loosen() { this.loose = true; audio.sfx('thread_snap', { vol: 0.5, pitch: 1.4 }); this.level.particles.emit('thread', CLEAT_X, CLEAT_Y, 8); }
  cut() {
    if (this.state !== 'hang' || this.cutCd > 0) return false;
    this.cutCd = 0.3;
    if (!this.loose) {
      audio.sfx('armor_clink');
      spawnFloatingText(this.level, CLEAT_X - 16, CLEAT_Y - 16, 'Firme demais!', '#c8c0d8');
      return false;
    }
    this.state = 'fall'; this.vy = 30; this.hitBoss = false;
    audio.sfx('thread_snap'); audio.sfx('whoosh');
    this.level.particles.emit('thread', CLEAT_X, CLEAT_Y, 12);
    return true;
  }
  burst() {
    const L = this.level;
    this.state = 'broken'; this.respawnT = 7;
    audio.sfx('explosion', { vol: 0.6 }); audio.sfx('break_block');
    L.shake(0.5);
    L.particles.emit('confetti', this.hx, this.y + 16, 24);
    L.particles.emit('fabric', this.hx, this.y + 16, 16, { colors: ['#e04a4a', '#5a9ae8', GOLD, '#4ab87a', '#c07a3a'] });
    L.particles.emit('dust', this.hx, FLOOR_Y, 12);
    spawnImpact(L, this.hx, this.y + 16, { size: 22 });
  }
  update(dt) {
    this.t += dt;
    if (this.cutCd > 0) this.cutCd -= dt;
    const L = this.level;
    if (this.state === 'fall') {
      this.vy += 950 * dt; this.y += this.vy * dt;
      const b = L._rabbitBoss;
      if (b && !this.hitBoss && b.canBeCrushed() && rectsOverlap(this, b)) { this.hitBoss = true; b.crush(); this.burst(); return; }
      if (this.y + this.h >= FLOOR_Y) {
        this.y = FLOOR_Y - this.h; this.burst();
        const p = L.player;
        if (rectsOverlap(p, { x: this.x, y: FLOOR_Y - 22, w: this.w, h: 22 })) p.hurt(1, this);
      }
    } else if (this.state === 'broken') {
      this.respawnT -= dt;
      if (this.respawnT <= 0 && L._rabbitBoss?.state !== 'calm') { this.state = 'lower'; this.y = this.hy - 90; }
    } else if (this.state === 'lower') {
      this.y = Math.min(this.hy, this.y + 60 * dt);
      if (this.y >= this.hy) { this.state = 'hang'; audio.sfx('thread_snap', { vol: 0.3, pitch: 1.6 }); }
    }
    if (this.loose && this.state === 'hang' && Math.random() < dt * 4) L.particles.emit('sparkle', CLEAT_X + rand(-4, 4), CLEAT_Y + rand(-6, 6), 1);
  }
  draw(ctx) {
    const L = this.level, hx = Rn(this.hx), top = Rn(this.y);
    // galho grosso vindo da parede direita + roldana
    ctx.fillStyle = OUT; ctx.fillRect(hx - 34, PULLEY_Y - 14, AX1 - hx + 40, 10);
    ctx.fillStyle = BARK[2]; ctx.fillRect(hx - 33, PULLEY_Y - 13, AX1 - hx + 38, 8);
    ctx.fillStyle = BARK[3]; ctx.fillRect(hx - 33, PULLEY_Y - 13, AX1 - hx + 38, 2);
    ctx.fillStyle = BARK[1]; for (let x = hx - 28; x < AX1; x += 11) ctx.fillRect(x, PULLEY_Y - 9, 4, 1);
    for (let i = 0; i < 4; i++) fillEllipse(ctx, hx - 30 + i * 30, PULLEY_Y - 16, 7, 3, i % 2 ? '#2e4a2e' : '#3a5a34');
    fillEllipse(ctx, hx, PULLEY_Y, 4, 4, OUT); fillEllipse(ctx, hx, PULLEY_Y, 3, 3, '#8a8a9a'); ctx.fillStyle = '#c8c8d8'; ctx.fillRect(hx - 1, PULLEY_Y - 1, 1, 1);
    const ROPE = this.loose ? '#d8b860' : '#b89a68';
    if (this.state === 'hang' || this.state === 'lower') {
      pxLine(ctx, hx + 4, PULLEY_Y - 3, AX1 - 4, PULLEY_Y - 3, ROPE);
      pxLine(ctx, AX1 - 4, PULLEY_Y - 3, CLEAT_X, CLEAT_Y - 6, ROPE, this.loose ? 4 : 0);
      pxLine(ctx, hx + 3, PULLEY_Y, hx, top - 8, ROPE);
      pxLine(ctx, hx, top - 8, this.x + 6, top + 4, ROPE); pxLine(ctx, hx, top - 8, this.x + this.w - 6, top + 4, ROPE);
    } else {
      pxLine(ctx, hx + 3, PULLEY_Y, hx + 5, PULLEY_Y + 10, ROPE);
    }
    if (this.state !== 'broken') drawImage(ctx, 'rabbit_chandelier', Rn(this.x) - 4, top);
    // sombra-alvo no chão (fase 3)
    if (this.loose && this.state === 'hang') {
      const b = L._rabbitBoss, under = b && b.canBeCrushed() && Math.abs(b.cx - this.hx) < this.w / 2 + b.w / 2 - 6;
      const pulse = Math.floor(this.t * (under ? 10 : 3)) % 2;
      fillEllipse(ctx, hx, FLOOR_Y - 1, 22, 3, under ? (pulse ? 'rgba(255,58,90,0.55)' : 'rgba(255,210,63,0.5)') : shadowCol(0.3));
      if (under) {
        const y = CLEAT_Y - 48 - pulse * 2;
        font.draw(ctx, '!', CLEAT_X - 2, y, { align: 'center', color: pulse ? '#ff3a5a' : GOLD, outline: '#1b1020' });
      }
    }
  }
}
registerEntity('rabbit_chandelier', RabbitChandelier);

// =============================================================================
// CONTROLADOR DA ARENA — gatilho, trava da câmera, espinheiro, ilhós de parede
// =============================================================================
class RabbitArena extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 60;
    this.closeK = 0; this.started = false; this.anchors = [];
  }
  hookAnchors() {
    this.anchors = this.level.entities.filter((e) => !e.dead && e.tags?.has?.('anchor') && e.props?.wall);
    this.level._rabbitAnchors = this.anchors;
    for (const a of this.anchors) a.fizzle = () => this.wallStitch(a);
  }
  /** Costura entre os ilhós de parede (além do alcance normal de 10 tiles). */
  wallStitch(a) {
    const L = this.level, p = L.player, b = this.anchors.find((o) => o !== a);
    if (!b || !p) return;
    if (!p.spendEnergy(20)) return;
    p.castT = 0.3; p.setCooldown?.('stitch', 0.5);
    audio.sfx('stitch_cast');
    L.particles.emit('sparkle', a.attachX, a.attachY, 6);
    const ex = this.bridge();
    if (ex) { ex.refresh?.(); return; }
    const TB = R.entities.get('thread_bridge');
    if (TB) L.add(new TB(L, 0, 0, { a, b }));
  }
  bridge() { return this.level.entities.find((e) => e.isThread && !e.dead && this.anchors.includes(e.a) && this.anchors.includes(e.b)); }
  start() {
    const L = this.level;
    this.started = true;
    L.camera.lockTo(LOCK);
    audio.sfx('rumble'); L.shake(0.2);
    const boss = L._rabbitBoss, ch = L._rabbitChaser;
    L.cutscene('boss1_arena', { boss, chaser: ch && !ch.dead ? ch : null }).then(() => boss?.beginFight());
  }
  update(dt) {
    this.t += dt;
    const L = this.level, p = L.player;
    if (this.anchors.length < 2) this.hookAnchors();
    if (!this.started && p && p.state !== 'dead' && p.cx > AX0 + 30 && p.cy > 200) this.start();
    if (this.started) {
      this.closeK = Math.min(1, this.closeK + dt * 2.5);
      if (p.x < AX0) { p.x = AX0; if (p.vx < 0) p.vx = 0; }
    }
  }
  draw(ctx) {
    // espinheiro fechando o túnel
    if (this.closeK > 0) {
      const h = Rn(34 * Math.min(1, this.closeK * 1.15));
      for (let i = 0; i < 4; i++) {
        const bx = AX0 - 8 + i * 3;
        for (let y = 0; y < h; y++) {
          const xx = bx + Rn(Math.sin((y + i * 5) * 0.35) * 1.5);
          ctx.fillStyle = i % 2 ? '#4a2a5a' : '#2e1a3a'; ctx.fillRect(xx, FLOOR_Y - y, 2, 1);
          if ((y + i * 3) % 6 === 0) { ctx.fillStyle = '#c8a0e8'; ctx.fillRect(xx + (i % 2 ? 2 : -1), FLOOR_Y - y, 1, 1); }
        }
      }
    }
    // prévia do fio entre os ilhós de parede
    const p = this.level.player;
    if (this.anchors.length === 2 && p && p.state === 'normal' && save.data.equippedAbility === 'stitch' && save.data.abilities?.stitch && !this.bridge()) {
      const near = this.anchors.find((a) => Math.hypot(a.attachX - p.cx, a.attachY - p.cy) <= 3 * T + 4);
      if (near) {
        const [a, b] = this.anchors, ph = Math.floor(this.t * 12);
        ctx.globalAlpha = p.energy >= 20 ? 0.55 : 0.25;
        ctx.fillStyle = '#fff6a8';
        const n = Math.floor(Math.abs(b.attachX - a.attachX) / 3);
        for (let i = 2; i < n - 1; i++) if ((i + ph) % 3 === 0) ctx.fillRect(Rn(lerp(a.attachX, b.attachX, i / n)), Rn(lerp(a.attachY, b.attachY, i / n)), 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}
registerEntity('rabbit_arena', RabbitArena);

// =============================================================================
// CUTSCENES
// =============================================================================
registerCutscene('boss1_intro', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, ch = L._rabbitChaser;
    if (ch) ch.driven = true;
    yield 0.4;
    yield* cs.say([{ who: 'tico', expr: 'confused', text: 'Que silêncio... Até os vaga-lumes se esconderam.' }]);
    cs.sfx('rumble'); cs.shake(0.25);
    if (ch && !ch.dead) {
      yield 0.3;
      yield* cs.pan(ch.cx + 40, ch.cy - 10, 1.1);
      ch.emerge();
      yield 1.1;
      ch.roar(); cs.flash('#b890ff', 0.25);
      yield 0.6;
      yield* cs.title('O Coelho Sem Rosto', 'Guardião da Floresta', 2.6);
      yield* cs.panTo(p, 0.7);
    }
    cs.anim(p, 'scared');
    yield* cs.say([
      { who: 'tico', expr: 'scared', shake: true, text: 'Um c-coelho GIGANTE! E... cadê o rosto dele?!' },
      { who: 'coelho', expr: 'angry', shake: true, text: 'Grrr... Meu rosto... ONDE ESTÁ MEU ROSTO?!' },
      { who: 'tico', expr: 'scared', text: 'Pernas, pra que te quero!' },
    ]);
    cs.anim(p, null);
    if (ch && !ch.dead) { ch.driven = false; ch.startChase(0.6); }
  },
});

registerCutscene('boss1_arena', {
  run: function* (cs) {
    const b = cs.params.boss, ch = cs.params.chaser;
    if (!b) return;
    const first = !save.seen('boss1_arena');
    yield 0.25;
    if (first) yield* cs.say([{ who: 'tico', expr: 'surprised', text: 'Ufa! Ele não cabe no túnel...' }]);
    b.enterFrom(ch && !ch.dead && ch.alpha > 0.5 ? ch : null);
    yield () => b.ready || cs.skipping;
    if (!b.ready) b.finishEntrance();
    if (first) yield* cs.say([{ who: 'tico', expr: 'scared', text: '...mas pula por cima. Claro que pula.' }]);
  },
});

function drawMemoryOrb(ctx, a, t) {
  drawGlow(ctx, Rn(a.x), Rn(a.y), 16, '#d8b8ff', 0.6);
  if (hasSprite('obj_memory')) drawSprite(ctx, 'obj_memory', 'idle', animFrame('obj_memory', 'idle', t), Rn(a.x), Rn(a.y));
  else { fillEllipse(ctx, a.x, a.y, 4, 4, '#e8d8ff'); ctx.fillStyle = '#ffffff'; ctx.fillRect(Rn(a.x) - 1, Rn(a.y) - 2, 2, 2); }
}
function giveMemory(L) {
  const id = 'mem_2', p = L.player;
  L.collect('memory', 1, 'w1_6:mem_2', { id });
  audio.sfx('star', { pitch: 0.8 });
  spawnShockwave(L, p.cx, p.cy, { radius: 34, color: '#d8b8ff' });
  L.particles.emit('stars_burst', p.cx, p.cy, 14, { colors: ['#e8d8ff', '#ffffff', GOLD] });
  const title = R.memories?.get?.(id)?.title;
  L.toast(title ? `Memória: ${title}` : 'Memória recuperada!', 'icon_memory');
  save.commit();
  const sc = makeScene('memory_view', id, { onClose: () => {} });
  if (sc) game.scenes.push(sc);
}
function unlockDoubleJump(L) {
  const p = L.player;
  save.data.abilities.doubleJump = true;
  save.commit();
  audio.sfx('ability_get');
  L.toast('Pulo Duplo desbloqueado!', 'icon_star');
  L.particles.emit('sparkle', p.cx, p.cy, 20);
  L.particles.emit('stars_burst', p.cx, p.bottom, 12, { colors: [GOLD, '#ffffff', '#7fe6df'] });
  spawnShockwave(L, p.cx, p.bottom - 4, { radius: 30, color: GOLD });
}

registerCutscene('boss1_defeat', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._rabbitBoss;
    if (!b) { L.complete({ delay: 1 }); return; }
    const fp = b.facePoint(), side = b.facing;
    yield* cs.walk(p, clamp(fp.x + side * 28, AX0 + 10, AX1 - 10), 80);
    cs.face(p, side > 0 ? 'left' : 'right');
    yield 0.25;
    yield* cs.say([{ who: 'tico', expr: 'determined', text: 'Calma, grandão... Eu sei costurar. Mais ou menos.' }]);
    p.castT = 3.2; b.sewing = true;
    cs.sfx('stitch_cast');
    b.sewStage = 0; cs.sfx('rabbit_sew'); yield 0.75;
    b.sewStage = 1; cs.sfx('rabbit_pop'); cs.particles('sparkle', fp.x, fp.y, 6); yield 0.6;
    b.sewStage = 2; cs.sfx('rabbit_pop'); cs.particles('sparkle', fp.x, fp.y, 6); yield 0.6;
    b.sewStage = 3; cs.sfx('rabbit_sew'); yield 0.5;
    b.calm(); cs.flash('#fff6d8', 0.35); cs.sfx('secret_soft');
    L.particles.emit('stars_burst', fp.x, fp.y, 12, { colors: [GOLD, '#ffffff', '#ffa0c8'] });
    yield 0.9;
    yield* cs.say([
      { who: 'coelho', expr: 'surprised', text: '...Eu... eu consigo ver?' },
      { who: 'tico', expr: 'happy', text: 'Ficaram meio tortos... mas são olhos de botão novinhos!' },
      { who: 'coelho', expr: 'sad', text: 'Tinha um menino... Davi... Ele me levava pra todo lado. Dizia que eu espantava os monstros.' },
      { who: 'coelho', expr: 'sad', text: 'Aí ele cresceu. E um homem feito de linhas roxas arrancou meu rosto... e minhas lembranças.' },
      { who: 'tico', expr: 'sad', text: 'O Costureiro... Foi ele que me trouxe pra cá também.' },
      { who: 'coelho', expr: 'happy', text: 'Ele escondeu isto dentro do meu botão. Não é meu... tem o seu cheiro. Tome, pequeno.' },
    ]);
    const bp = b.buttonPoint();
    const orb = cs.actor({ x: bp.x, y: bp.y, z: 60, draw: drawMemoryOrb });
    cs.sfx('magic_hum');
    yield* cs.move(orb, bp.x, bp.y - 26, 0.8);
    yield* cs.move(orb, p.cx, p.cy - 4, 0.8);
    orb.alpha = 0;
    giveMemory(L);
    yield 0.8;
    yield* cs.say([
      { who: 'tico', expr: 'surprised', text: 'É a Lia... me ensinando a rugir! RAWR!' },
      { who: 'coelho', expr: 'happy', text: 'Leve também um pouco do meu pulo. Coelho que se preza pula duas vezes!' },
    ]);
    unlockDoubleJump(L);
    yield 0.9;
    yield* cs.say([
      { who: 'tico', expr: 'happy', text: 'Pulo duplo?! Uau!' },
      { who: 'coelho', expr: 'confused', text: 'Siga o rio até o Oceano das Lágrimas. Dizem que uma baleia de vidro engole tudo o que se perde por lá...' },
      { who: 'tico', expr: 'determined', text: 'Então é pra lá que eu vou. Obrigado, amigo!' },
    ]);
    L.complete({ delay: 1 });
  },
});

// =============================================================================
// FASE w1_6 — "O Coração da Floresta"
// =============================================================================
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < MW) g[y][x] = c; };
  const put = (x, y, c) => { g[y][x] = c; };
  fill(0, FR, MW - 1, MH - 1, '#');
  // ---- parte A: perseguição
  fill(31, FR, 33, MH - 1, '.');                     // vão 1 (3 tiles, pulo)
  fill(38, FR - 1, 49, FR - 1, '#');                 // degrau
  fill(50, FR - 1, 57, MH - 1, '.');                 // vão 2 (8 tiles, ilhós)
  put(49, FR - 3, '@'); put(58, FR - 2, '@');
  put(63, FR - 1, 'K');                              // checkpoint do meio
  put(69, FR - 1, '^'); put(70, FR - 1, '^');        // espinhos
  fill(76, FR - 2, 77, FR - 1, '%');                 // tronco caído
  fill(88, FR, 95, MH - 1, '.');                     // vão 3 (subindo, ilhós)
  fill(96, FR - 2, 112, FR - 1, '#');                // terreno alto
  put(87, FR - 2, '@'); put(96, FR - 4, '@');
  put(115, FR - 1, 'K');                             // checkpoint antes da arena
  for (const [x, y] of [[9, 16], [21, 16], [27, 16], [41, 15], [46, 15], [61, 16], [73, 16], [82, 16], [101, 14], [108, 14]]) put(x, y, 'q');
  for (const [x, y] of [[36, 16], [44, 15], [85, 16], [104, 14]]) put(x, y, 'e');
  put(110, 14, 'h');
  put(54, 12, '*'); put(77, 13, '*'); put(106, 11, '*');
  // ---- parte B: arena
  fill(119, 8, 122, FR - 3, '#');                    // parede esquerda com túnel embaixo
  put(123, FR - 4, '='); put(124, FR - 4, '='); put(144, FR - 4, '='); put(145, FR - 4, '=');
  put(123, FR - 3, '@'); put(145, FR - 3, '@');      // ilhós de parede
  fill(146, 0, MW - 1, FR - 1, '#');                 // parede direita
  put(16, FR - 1, 'P');
  return g.map((r) => r.join(''));
}

function setupLevel(L) {
  getSprite('rabbit_boss'); getSprite('rabbit_boss_t');   // pré-renderiza
  const boss = new RabbitBoss(L, 0, 0, { cx: AX0 + 250 });
  L.add(boss); L._rabbitBoss = boss;
  const ch = new RabbitChandelier(L, ACX, CHAND_Y, {});
  L.add(ch); L._rabbitChand = ch;
  L.add(new RabbitArena(L, 0, 0, {}));
  const p = L.player;
  if (p && p.cx < WALL_X - 120) {
    const c = new RabbitChaser(L, Math.max(24, p.cx - 230), 0, {});
    L.add(c); L._rabbitChaser = c;
  }
}

registerLevel({
  id: 'w1_6', world: 1, index: 6, name: 'O Coração da Floresta', subtitle: 'Mundo 1-6 · Chefe',
  music: 'boss_rabbit', tileset: 'w1', background: 'w1', timeOfDay: 'night', boss: true,
  parTime: 240, darkness: 0.3, ambient: 'w1_fireflies', intro: 'boss1_intro',
  map: buildMap(),
  legend: { q: 'rabbit_tree' },
  props: {
    '49,14': { group: 'c2' }, '58,15': { group: 'c2' },
    '87,15': { group: 'c3' }, '96,13': { group: 'c3' },
    '123,14': { group: 'arena', wall: true }, '145,14': { group: 'arena', wall: true },
  },
  onStart(level) { setupLevel(level); },
});
