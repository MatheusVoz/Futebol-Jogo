// =============================================================================
// enemies/w1.js — Inimigos do MUNDO 1 (Floresta dos Brinquedos Perdidos).
//
// Legenda (registerLegend(1)):
//   a w1_ragbug      — besourinho de retalhos: patrulha, vira na beira; ao levar
//                      o 1º golpe se enrola numa bola e rola (2 hp).
//   b w1_woodpuppet  — marionete de madeira com fios: pula até o jogador, prepara
//                      um chute (telegrafado). Pisável.
//   d w1_boomshroom  — cogumelo-bomba: escondido, infla perto do jogador, pisca e
//                      explode após 1 s. Estoura cedo (sem explosão) com o chicote
//                      / Agulhada. Não pisável enquanto inflado.
//   f w1_corrupt_toy — ursinho corrompido: nota o jogador (!), investe pelo chão;
//                      bate na parede = atordoado (dano em dobro). Bloqueia golpes
//                      de frente durante a investida. 3 hp.
//   g w1_paperbird   — pássaro de papel: voa em onda e mergulha quando o jogador
//                      passa por baixo.
//
// Também exporta utilitários de arte "pelúcia" (puff, stitch, limb...) e a base
// PlushEnemy (máquina de estados + desenho padrão), reaproveitados em w2.js.
// Fase de teste: ?level=test_enemies_w1
// =============================================================================
import { Enemy } from './base.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { defineSprite, drawSprite, animFrame, frameMeta } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { clamp, chance } from '../../engine/util.js';

// ----------------------------------------------------------------- arte base
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Volume de pelúcia sombreado (elipse, 5 tons pal=[brilho,luz,base,sombra,escuro]).
 *  Luz de cima-esquerda + dithering ordenado + "fiapos". o: {ymin,ymax,mask(x,y),lit,rough} */
export function puff(pc, cx, cy, rx, ry, pal, o = {}) {
  const rough = o.rough ?? 0.13, mask = o.mask, lit = o.lit || 0;
  const y0 = Math.max(Math.floor(cy - ry), o.ymin ?? -999), y1 = Math.min(Math.ceil(cy + ry), o.ymax ?? 999);
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1 || (mask && !mask(x, y))) continue;
    let lv = nx * -0.48 + ny * -0.62 + Math.sqrt(1 - d) * 0.62 + lit;
    lv += (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * rough * 2;
    if (o.fuzz !== false && (x * 37 + y * 101) % 23 === 0) lv -= 0.14;
    pc.px(x, y, pal[lv > 0.8 ? 0 : lv > 0.52 ? 1 : lv > 0.16 ? 2 : lv > -0.18 ? 3 : 4]);
  }
}
/** Linha tracejada (costura). */
export function stitch(pc, x0, y0, x1, y1, c, step = 2) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
  for (let i = 0; i <= n; i += step) { const t = n ? i / n : 0; pc.px(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), c); }
}
/** Membro cilíndrico (madeira/feltro) com sombra embaixo e luz em cima. */
export function limb(pc, x0, y0, x1, y1, r, pal) {
  pc.thickLine(x0, y0, x1, y1, r, pal[3]);
  pc.thickLine(x0 - 0.4, y0 - 0.4, x1 - 0.4, y1 - 0.4, Math.max(0.5, r - 0.6), pal[2]);
  if (r >= 1.2) pc.line(Math.round(x0 - 0.8), Math.round(y0 - 0.8), Math.round(x1 - 0.8), Math.round(y1 - 0.8), pal[1]);
}
/** Olho de botão 2x2 com brilho. */
export function btnEye(pc, x, y, c = '#0e0a14', hl = '#ffffff') {
  pc.rect(x, y, 2, 2, c); pc.px(x, y, hl);
}
/** Olho em X (costurado). */
export function xEye(pc, x, y, c) {
  pc.px(x - 1, y - 1, c); pc.px(x + 1, y - 1, c); pc.px(x, y, c); pc.px(x - 1, y + 1, c); pc.px(x + 1, y + 1, c);
}
/** Rotaciona uma lista de pontos [[x,y]] em torno de (cx,cy). */
export function rot(pts, a, cx, cy) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}
/** Linha de pixels nítida no ctx (fios, raios). */
export function pxLine(ctx, x0, y0, x1, y1, step = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i += step) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
}
/** Marca "!" (ou "?") pixelada acima de um inimigo. */
export function drawMark(ctx, x, y, col = '#ffd23f') {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#1e1424'; ctx.fillRect(x - 2, y - 1, 5, 11);
  ctx.fillStyle = col; ctx.fillRect(x - 1, y, 3, 5); ctx.fillRect(x - 1, y + 7, 3, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 1, 2);
}

export const OUT1 = '#1e1424';
const P = {
  red: ['#ffb59a', '#f07a5c', '#d0503c', '#9e3030', '#6a1e2a'],
  pur: ['#e0c8f4', '#b090d8', '#8262a8', '#5a4280', '#3a2a58'],
  plum: ['#9a7a9a', '#74547a', '#54385a', '#3c2644', '#281830'],
  wood: ['#f8e0b0', '#e4bc80', '#c48e54', '#925e36', '#603c24'],
  hair: ['#a0604a', '#7e4434', '#5e3026', '#44201c', '#2c1414'],
  green: ['#c4e894', '#94c868', '#68a24a', '#467a38', '#2c5428'],
  shoe: ['#a06a4a', '#7a4a34', '#5a3424', '#3e2418', '#2a1810'],
  cap: ['#f4d0ff', '#d692f2', '#a85ad4', '#7438a4', '#4a2070'],
  stem: ['#fffaf0', '#f4eacc', '#ddca9e', '#b4a078', '#86725a'],
  gill: ['#d0b898', '#ac9474', '#8c7458', '#6a5444', '#4a3a30'],
  ted: ['#e8d0b0', '#c8a880', '#9a7858', '#6e5240', '#463228'],
  muz: ['#fff0d8', '#f0d8b8', '#d8b890', '#a88a68', '#705a44'],
  corr: ['#ffd0ff', '#e090ff', '#b050f0', '#7a28b0', '#4a1470'],
  patch: ['#c0d0e8', '#90a8c8', '#6a80a6', '#4a5c7e', '#2e3a54'],
};
const CREAM = '#f4e2b8';

// sons próprios (prefixo en_)
registerSfx('en_alert', [{ wave: 'square', freq: 660, freqEnd: 1320, dur: 0.07, vol: 0.12 }, { wave: 'square', freq: 990, freqEnd: 1500, dur: 0.07, vol: 0.1, delay: 0.08 }]);
registerSfx('en_fuse', { wave: 'square', freq: 1400, dur: 0.03, vol: 0.07 });
registerSfx('en_inflate', { wave: 'triangle', freq: 180, freqEnd: 520, dur: 0.3, vol: 0.18 });
registerSfx('en_bonk', [{ wave: 'triangle', freq: 220, freqEnd: 70, dur: 0.18, vol: 0.3 }, { wave: 'noise', freq: 900, dur: 0.08, vol: 0.15 }]);
registerSfx('en_paper', { wave: 'noise', freq: 3000, freqEnd: 1200, dur: 0.18, vol: 0.12 });
registerSfx('en_hop', { wave: 'square', freq: 300, freqEnd: 180, dur: 0.06, vol: 0.08 });

// ------------------------------------------------------------ base comum
/** Base dos inimigos de pelúcia: estado (state/stT), anim de dano, telégrafo. */
export class PlushEnemy extends Enemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.spriteFacesRight = true;
    this.state = 'idle'; this.stT = 0; this.hurtT = 0; this.cool = 0;
    this.centerPivot = false; // true: pivô no centro da hitbox (voadores/nadadores)
    this.teleOn = false;
  }
  go(s) { this.state = s; this.stT = 0; }
  onHurt() { this.hurtT = 0.22; }
  update(dt) {
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.cool > 0) this.cool -= dt;
    super.update(dt);
  }
  /** Pisca (telégrafo) durante a preparação: liga 1 de cada 3 ticks. */
  tele(on = true) { this.teleOn = on && Math.floor(this.stT * 16) % 3 === 0; }
  pivotXY() { return [Math.round(this.cx), Math.round(this.centerPivot ? this.cy : this.bottom)]; }
  /** Converte ponto local do quadro (meta) em coordenadas de mundo. */
  metaPt(m, ox, oy) {
    const [px, py] = this.pivotXY();
    const flip = this.facing < 0;
    return [px + (flip ? ox - m[0] : m[0] - ox), py + m[1] - oy];
  }
  bodyAnim() { return this.hurtT > 0 && !this.dying ? 'hurt' : this.anim; }
  drawBody(ctx, extra = {}) {
    const o = this.spriteOpts();
    if (this.teleOn && !this.flash) o.variant = this.teleColor || 'flash';
    Object.assign(o, extra);
    const a = extra.anim || this.bodyAnim();
    const f = animFrame(this.sprite, a, a === 'hurt' ? this.t : this.animT);
    const [px, py] = this.pivotXY();
    drawSprite(ctx, this.sprite, a, f, px + (extra.dx || 0), py + (extra.dy || 0), o);
    return f;
  }
  draw(ctx) { this.drawBody(ctx); this.drawStatus(ctx); }
}

// =============================================================================
// a — w1_ragbug: besourinho de retalhos
// =============================================================================
function ragbugBody(pc, { sq = 0, leg = 0, ant = 0, xeye = false, headDy = 0 }) {
  // perninhas
  for (let i = 0; i < 3; i++) {
    const lx = 6 + i * 4, ph = (leg + i) & 1;
    pc.rect(lx + ph, 14, 1, 1, P.plum[4]); pc.rect(lx + 1 - ph, 15, 2, 1, P.plum[3]);
  }
  const cx = 10.5, cy = 11 + sq * 0.5, rx = 7.5 + sq, ry = 7 - sq;
  puff(pc, cx, cy, rx, ry, P.red, { ymax: 13 });
  const edge = (y) => 12.5 - (y - 4) * 0.55;
  puff(pc, cx, cy, rx, ry, P.pur, { ymax: 13, mask: (x, y) => x > edge(y) && y < 11 });
  for (let y = Math.ceil(cy - ry) + 1; y < 11; y += 2) pc.px(Math.round(edge(y)), y, CREAM);
  pc.hline(Math.round(cx - rx + 2), 13, Math.round(rx * 2 - 3), P.plum[3]);
  // botões-pinta
  for (const [bx, by] of [[5, 9], [8, 6], [9, 10]]) { pc.rect(bx, by, 2, 2, '#3a1a26'); pc.px(bx, by, '#ff9a8a'); }
  // cabeça + antenas
  const hy = 11.5 + headDy;
  puff(pc, 18.5, hy, 3.6, 3.2, P.plum);
  const sw = ant ? 1 : 0;
  pc.line(18, Math.round(hy - 3), 20 + sw, 4, P.plum[2]); pc.line(16, Math.round(hy - 3), 15 - sw, 4, P.plum[2]);
  for (const [px, py] of [[20 + sw, 3], [14 - sw, 3]]) { pc.rect(px, py, 2, 2, '#ffd23f'); pc.px(px, py, '#fff3a0'); }
  if (xeye) { xEye(pc, 19, Math.round(hy - 1), CREAM); }
  else { btnEye(pc, 19, Math.round(hy - 1)); pc.px(22, Math.round(hy), '#0e0a14'); }
  pc.px(19, Math.round(hy + 2), CREAM); pc.px(21, Math.round(hy + 2), CREAM);
}
function ragbugBall(pc, a, peek = false) {
  const cx = 11.5, cy = 10.5, r = 5.6, c = Math.cos(a), s = Math.sin(a);
  puff(pc, cx, cy, r, r, P.red);
  puff(pc, cx, cy, r, r, P.pur, { mask: (x, y) => (x + 0.5 - cx) * c + (y + 0.5 - cy) * s > 1.2 });
  for (let t = -5; t <= 5; t += 2) pc.px(Math.round(cx + 1.2 * c - t * s), Math.round(cy + 1.2 * s + t * c), CREAM);
  for (const [u, v] of [[-2.5, -2], [-1.5, 2.5]]) pc.rect(Math.round(cx + u * c - v * s), Math.round(cy + u * s + v * c), 2, 2, '#3a1a26');
  if (peek) { puff(pc, 16, 12, 2.4, 2.2, P.plum); btnEye(pc, 16, 11); }
}
defineSprite('w1_ragbug', {
  w: 24, h: 16, ox: 12, oy: 16,
  anims: { idle: { frames: 2, fps: 3 }, move: { frames: 4, fps: 10 }, windup: { frames: 2, fps: 8, loop: false }, attack: { frames: 4, fps: 14 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') ragbugBody(pc, { ant: f, sq: f * 0.4 });
    else if (anim === 'move') ragbugBody(pc, { leg: f, ant: f >> 1, headDy: f & 1 ? 0 : -0.5 });
    else if (anim === 'windup') { if (f === 0) ragbugBody(pc, { sq: 1.5, headDy: 1 }); else ragbugBall(pc, 0, true); }
    else if (anim === 'attack') ragbugBall(pc, (f * Math.PI) / 2);
    else ragbugBody(pc, { sq: f ? 0.5 : 1.6, xeye: true, headDy: 1 });
    pc.outline(OUT1);
  },
});

class RagBug extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w1_ragbug';
    this.w = 14; this.h = 10; this.alignToCell(x, y);
    this.hp = this.maxHp = 2;
    this.speed = 26; this.rollDir = 1;
    this.drops = { buttons: 2, heart: 0.06, energy: 0.15 };
    this.fabricColors = ['#d0503c', '#8262a8', CREAM];
    this.go('walk');
  }
  onHurt(n, src) {
    super.onHurt();
    if (this.hp > 0 && this.state !== 'roll') { this.rollDir = Math.sign(this.cx - (src?.cx ?? this.cx)) || -this.facing; this.go('curl'); }
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    switch (this.state) {
      case 'walk': {
        this.setAnim('move');
        const sees = this.canSee(p, 72) && Math.sign(p.cx - this.cx) === this.facing && Math.abs(p.cy - this.cy) < 24;
        this.patrol(sees ? this.speed * 1.8 : this.speed, dt);
        if (!sees && this.stT > 3 + (this.id % 3)) this.go('look');
        break;
      }
      case 'look': // para, mexe as antenas e olha para trás
        this.vx = 0; this.setAnim('idle');
        if (this.stT > 0.9) { if (this.canSee(p, 90)) this.faceTarget(p); this.go('walk'); }
        break;
      case 'curl':
        this.vx *= 0.8; this.setAnim('windup');
        if (this.stT > 0.22) { this.go('roll'); this.vy = -90; audio.sfx('en_hop'); }
        break;
      case 'roll':
        this.setAnim('attack'); this.facing = this.rollDir;
        this.vx = this.rollDir * 135 * (1 - Math.min(0.7, this.stT / 1.2));
        if (this.grounded && this.wallAhead(this.rollDir)) { this.rollDir *= -1; this.level.particles.emit('dust', this.cx, this.bottom, 3); }
        if (this.stT > 0.9) { this.go('uncurl'); this.vx = 0; }
        break;
      case 'uncurl':
        this.vx = 0; this.setAnim('windup'); this.animT = 0;
        if (this.stT > 0.35) { this.speed = 38; this.go('walk'); }
        break;
    }
    this.physics(dt);
  }
}
registerEntity('w1_ragbug', RagBug);

// =============================================================================
// b — w1_woodpuppet: marionete de madeira (fios até a cruzeta flutuante)
// =============================================================================
const PUP_BASE = { b: 0, hx: 0, hy: 0, jaw: 0, ff: [16.5, 30], bf: [11.5, 30], fh: [18.5, 22], bh: [9.5, 22], xe: false };
const PUP = {
  idle: [{}, { b: 1, fh: [19, 23], bh: [9, 21] }],
  move: [{ b: 3, ff: [17, 30], bf: [11, 30], fh: [20, 16], bh: [8, 16] }, { b: -1, ff: [17, 28], bf: [11, 29], fh: [20, 11], bh: [8, 11] }, { b: 2, ff: [18, 30], bf: [10, 30], fh: [20, 20], bh: [8, 20] }],
  windup: [{ b: 1, hx: -1, jaw: 1, ff: [9, 26], fk: [13, 27], bf: [12, 30], fh: [20, 14], bh: [7, 18] }, { b: 1, hx: -2, jaw: 2, ff: [7, 24], fk: [12, 26], bf: [12.5, 30], fh: [21, 12], bh: [6, 17] }],
  attack: [{ hx: -2, jaw: 2, ff: [25, 24], fk: [20, 24], bf: [11, 30], fh: [7, 17], bh: [9, 20] }, { hx: -1, jaw: 1, ff: [24, 26], fk: [19, 25], bf: [11, 30], fh: [8, 18], bh: [10, 21] }],
  hurt: [{ hx: -2, hy: 1, jaw: 2, xe: true, fh: [22, 13], bh: [6, 12] }, { hx: 1, hy: 2, jaw: 1, xe: true, fh: [19, 26], bh: [10, 26] }],
};
const pupPose = (anim, f) => ({ ...PUP_BASE, ...(PUP[anim]?.[f] || {}) });
function puppetLeg(pc, hip, foot, knee) {
  const k = knee || [(hip[0] + foot[0]) / 2 + 1, (hip[1] + foot[1]) / 2];
  limb(pc, hip[0], hip[1], k[0], k[1], 1.3, P.wood); limb(pc, k[0], k[1], foot[0], foot[1], 1.3, P.wood);
  pc.px(Math.round(k[0]), Math.round(k[1]), P.wood[4]);
  puff(pc, foot[0] + 0.8, foot[1] - 0.2, 2.4, 1.6, P.shoe);
}
function drawPuppet(pc, q) {
  const b = q.b, sh = [11, 15 + b], sf = [17, 15 + b], hb = [12.5, 23 + b], hf = [15.5, 23 + b];
  limb(pc, sh[0], sh[1], q.bh[0], q.bh[1], 1.2, P.wood); puff(pc, q.bh[0], q.bh[1], 1.7, 1.7, P.wood);
  puppetLeg(pc, hb, q.bf, q.bk);
  // túnica de retalho
  puff(pc, 14, 19 + b, 4.6, 5.6, P.green);
  puff(pc, 14, 19 + b, 4.6, 5.6, P.red, { mask: (x, y) => x >= 15 && x <= 17 && y >= 19 + b && y <= 22 + b });
  stitch(pc, 14, 15 + b, 14, 24 + b, CREAM);
  pc.px(16, 17 + b, '#ffd23f');
  puppetLeg(pc, hf, q.ff, q.fk);
  // cabeça de madeira com mandíbula de quebra-nozes
  const hx = 14 + q.hx, hy = 8 + b + q.hy;
  pc.rect(13, hy + 4, 3, 3, P.wood[3]);
  puff(pc, hx, hy, 5.6, 5.6, P.wood);
  puff(pc, hx, hy, 5.6, 5.6, P.hair, { mask: (x, y) => y < hy - 2.5 - (x - hx) * 0.6 });
  pc.rect(Math.round(hx) - 1, Math.round(hy - 7), 2, 2, P.wood[4]);
  const ex = Math.round(hx), ey = Math.round(hy - 1);
  if (q.xe) { xEye(pc, ex + 1, ey + 1, '#0e0a14'); xEye(pc, ex + 4, ey + 1, '#0e0a14'); }
  else { btnEye(pc, ex, ey); btnEye(pc, ex + 3, ey); }
  pc.px(ex + 3, ey + 3, '#e87878'); pc.px(ex + 4, ey + 3, '#f09090');
  const my = Math.round(hy + 3);
  pc.rect(ex + 1, my, 5, 1 + q.jaw, '#2a1418');
  pc.rect(ex + 1, my + 1 + q.jaw, 5, 2, P.wood[2]); pc.hline(ex + 1, my + 2 + q.jaw, 5, P.wood[3]);
  pc.vline(ex + 1, my - 1, 4 + q.jaw, P.wood[4]);
  limb(pc, sf[0], sf[1], q.fh[0], q.fh[1], 1.2, P.wood); puff(pc, q.fh[0], q.fh[1], 1.8, 1.8, P.wood);
}
defineSprite('w1_woodpuppet', {
  w: 28, h: 32, ox: 14, oy: 32,
  anims: { idle: { frames: 2, fps: 3 }, move: { frames: 3, fps: 8, loop: false }, windup: { frames: 2, fps: 5, loop: false }, attack: { frames: 2, fps: 10, loop: false }, hurt: { frames: 2, fps: 8 } },
  draw(pc, anim, f) { drawPuppet(pc, pupPose(anim, f)); pc.outline(OUT1); },
  meta(anim, f) { const q = pupPose(anim, f); return { head: [14 + q.hx, 1 + q.b + q.hy], fh: q.fh, bh: q.bh }; },
});

class WoodPuppet extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w1_woodpuppet';
    this.w = 12; this.h = 18; this.alignToCell(x, y);
    this.hp = this.maxHp = 2;
    this.drops = { buttons: 3, heart: 0.08, energy: 0.2 };
    this.fabricColors = ['#c48e54', '#68a24a', '#f8e0b0'];
    this.barX = this.cx; this.barY = this.y - 22;
    this.kicked = false;
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    switch (this.state) {
      case 'idle':
        this.vx *= 0.8; this.setAnim('idle');
        if (this.stT > 0.4 && this.canSee(p, 150)) { this.faceTarget(p); this.go('crouch'); }
        break;
      case 'crouch': // agacha antes do pulo
        this.vx = 0; this.setAnim('move'); this.animT = 0;
        if (this.stT > 0.2) {
          this.faceTarget(p);
          const land = this.level.map.solidAt(this.cx + this.facing * 34, this.bottom + 4) || this.level.platformAt(this.cx + this.facing * 34, this.bottom + 4);
          this.vy = -230; this.vx = land || dy < -10 ? this.facing * clamp(Math.abs(dx) * 1.6, 30, 78) : 0;
          audio.sfx('en_hop', { randomPitch: 0.15 });
          this.go('air');
        }
        break;
      case 'air':
        this.setAnim('move'); this.animT = Math.min(this.animT, 0.2);
        if (this.grounded && this.stT > 0.1) { this.go('land'); this.level.particles.emit('dust', this.cx, this.bottom, 3); }
        break;
      case 'land':
        this.vx *= 0.6; this.setAnim('move'); this.animT = 0.3;
        if (this.stT > 0.3) {
          if (Math.abs(dx) < 34 && Math.abs(dy) < 22) { this.faceTarget(p); this.go('windup'); audio.sfx('en_alert', { pitch: 0.7 }); }
          else if (this.canSee(p, 170)) this.go('crouch'); else this.go('idle');
        }
        break;
      case 'windup': // telegrafa o chute (~0.45 s)
        this.vx = 0; this.setAnim('windup'); this.tele();
        if (this.stT > 0.45) { this.teleOn = false; this.kicked = false; this.vx = this.facing * 95; this.go('kick'); audio.sfx('whip', { pitch: 0.7 }); }
        break;
      case 'kick': {
        this.setAnim('attack'); this.vx *= 0.88;
        const kb = { x: this.facing > 0 ? this.right : this.x - 14, y: this.y + 4, w: 14, h: 10 };
        const pl = this.level.player;
        if (!this.kicked && pl && pl.state !== 'dead' && pl.x < kb.x + kb.w && pl.x + pl.w > kb.x && pl.y < kb.y + kb.h && pl.y + pl.h > kb.y) { this.kicked = true; pl.hurt(1, this); }
        if (this.stT > 0.28) this.go('recover');
        break;
      }
      case 'recover': // momento vulnerável: balança nos fios
        this.vx *= 0.7; this.setAnim('idle');
        if (this.stT > 0.6) this.go('idle');
        break;
    }
    this.physics(dt);
  }
  update(dt) {
    super.update(dt);
    // cruzeta flutuante segue com atraso
    const tx = this.cx + Math.sin(this.t * 1.7) * 2, ty = this.y - 20 + Math.sin(this.t * 2.3) * 1.5 - (this.state === 'air' ? 6 : 0);
    this.barX += (tx - this.barX) * Math.min(1, dt * 9); this.barY += (ty - this.barY) * Math.min(1, dt * 12);
  }
  draw(ctx) {
    const a = this.bodyAnim(), f = animFrame(this.sprite, a, a === 'hurt' ? this.t : this.animT);
    const m = frameMeta(this.sprite, a, f);
    const bx = Math.round(this.barX), by = Math.round(this.barY);
    if (m && !this.dying) {
      ctx.fillStyle = 'rgba(240,232,214,0.75)';
      const H = this.metaPt(m.head, 14, 32), F = this.metaPt(m.fh, 14, 32), B = this.metaPt(m.bh, 14, 32);
      pxLine(ctx, bx, by + 1, H[0], H[1]); pxLine(ctx, bx - 6, by, B[0], B[1]); pxLine(ctx, bx + 6, by, F[0], F[1]);
    }
    if (!this.dying) {
      ctx.fillStyle = OUT1; ctx.fillRect(bx - 8, by - 1, 17, 3); ctx.fillRect(bx - 1, by - 4, 3, 9);
      ctx.fillStyle = '#c48e54'; ctx.fillRect(bx - 7, by, 15, 1); ctx.fillRect(bx, by - 3, 1, 7);
      ctx.fillStyle = '#f8e0b0'; ctx.fillRect(bx - 7, by, 6, 1);
    }
    this.drawBody(ctx);
    this.drawStatus(ctx);
  }
}
registerEntity('w1_woodpuppet', WoodPuppet);

// =============================================================================
// d — w1_boomshroom: cogumelo-bomba de feltro
// =============================================================================
const DOTS = [[-0.55, -0.45], [0.2, -0.75], [0.6, -0.2], [-0.1, -0.15], [-0.8, 0.1]];
function drawShroom(pc, { capR = 9, capRy = 6, capY = 15, stemH = 9, stemW = 4, face = 'n', dot = CREAM, strain = false }) {
  if (stemH > 0) puff(pc, 14, 28 - stemH / 2, stemW, stemH / 2 + 0.5, P.stem, { ymax: 27 });
  puff(pc, 14, capY + 1, capR * 0.82, 2.2, P.gill, { ymin: Math.round(capY + 1) });
  puff(pc, 14, capY, capR, capRy, P.cap, { ymax: Math.round(capY + 1) });
  for (const [u, v] of DOTS) {
    const x = Math.round(14 + u * capR), y = Math.round(capY + v * capRy);
    if (y > capY) continue;
    pc.rect(x, y, 2, 2, dot); pc.px(x + 1, y + 1, P.cap[2]);
  }
  if (strain) for (let i = -2; i <= 2; i++) pc.px(14 + i * 2, Math.round(capY - capRy * 0.4) + (i & 1), '#fff6ff');
  if (face === 'peek') { pc.px(12, 27, '#fff6a8'); pc.px(16, 27, '#fff6a8'); }
  else if (stemH >= 5) {
    const ey = Math.round(28 - stemH * 0.7);
    if (face === 'x') { xEye(pc, 12, ey + 1, '#2a1a20'); xEye(pc, 16, ey + 1, '#2a1a20'); }
    else {
      btnEye(pc, 11, ey); btnEye(pc, 15, ey);
      if (face === 'angry') { pc.px(10, ey - 1, '#2a1a20'); pc.px(11, ey - 1, '#2a1a20'); pc.px(17, ey - 1, '#2a1a20'); pc.px(16, ey - 1, '#2a1a20'); }
    }
    const my = ey + 3;
    if (face === 'angry') for (let i = 0; i < 5; i++) pc.px(12 + i, my + (i & 1), '#2a1a20');
    else { pc.px(13, my, '#2a1a20'); pc.px(14, my + 1, '#2a1a20'); pc.px(15, my, '#2a1a20'); }
  }
}
defineSprite('w1_boomshroom', {
  w: 28, h: 28, ox: 14, oy: 28,
  anims: { idle: { frames: 2, fps: 2 }, move: { frames: 3, fps: 9, loop: false }, windup: { frames: 2, fps: 6 }, attack: { frames: 3, fps: 12, loop: false }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') drawShroom(pc, { capR: 6, capRy: 4, capY: 25, stemH: 0, face: f ? 'none' : 'peek' });
    else if (anim === 'move') drawShroom(pc, [{ capR: 7, capRy: 5, capY: 22, stemH: 4, stemW: 3 }, { capR: 8.5, capRy: 6, capY: 18, stemH: 8, stemW: 3.8 }, { capR: 10, capRy: 6.5, capY: 15, stemH: 11, stemW: 4.5 }][f]);
    else if (anim === 'windup') drawShroom(pc, { capR: 11 + f * 0.7, capRy: 7 + f * 0.5, capY: 14 - f * 0.5, stemH: 12, stemW: 5 + f * 0.6, face: 'angry', dot: f ? '#ffffff' : '#ffb8ff', strain: true });
    else if (anim === 'attack') {
      if (f === 0) { drawShroom(pc, { capR: 13, capRy: 9, capY: 14, stemH: 12, stemW: 6, face: 'angry', dot: '#ffffff', strain: true }); pc.circle(14, 12, 4, '#fff6ff'); }
      else {
        const r = f === 1 ? 10 : 13;
        drawShroom(pc, { capR: 0.1, capRy: 0.1, capY: 27, stemH: f === 1 ? 6 : 3, stemW: 3.5, face: 'none' });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + f;
          puff(pc, 14 + Math.cos(a) * r, 15 + Math.sin(a) * r * 0.8, f === 1 ? 2 : 1.4, f === 1 ? 1.6 : 1.2, P.cap);
        }
      }
    } else drawShroom(pc, { capR: 10.5, capRy: 5, capY: 18 + f, stemH: 8 - f, stemW: 4.6, face: 'x' });
    pc.outline(OUT1);
  },
});

class BoomShroom extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w1_boomshroom';
    this.w = 12; this.h = 7; this.alignToCell(x, y);
    this.hp = this.maxHp = 1;
    this.drops = { buttons: 2, heart: 0.05, energy: 0.25 };
    this.fabricColors = ['#a85ad4', '#f4eacc', CREAM];
    this.light = { r: 14, color: '#c070ff', i: 0.25, flicker: 0.1 };
    this.radius = props.radius || 36;
    this.go('hidden');
  }
  setBox(w, h) { const b = this.bottom, c = this.cx; this.w = w; this.h = h; this.x = c - w / 2; this.y = b - h; }
  onDeath() {
    if (this.state === 'armed' || this.state === 'grow') { // estourado cedo: só esporos
      this.level.particles.emit('smoke', this.cx, this.cy, 6);
      this.level.particles.emit('sparkle', this.cx, this.cy, 6, { colors: ['#ffb8ff', '#d692f2', '#ffffff'] });
      audio.sfx('bubble', { pitch: 0.6 });
    }
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const near = Math.abs(p.cx - this.cx) < 52 && Math.abs(p.cy - this.cy) < 40;
    switch (this.state) {
      case 'hidden':
        this.setAnim('idle'); this.stompable = true;
        if (near && this.stT > 0.5) { this.go('grow'); audio.sfx('en_inflate'); }
        break;
      case 'grow':
        this.setAnim('move'); this.stompable = false;
        this.setBox(12 + this.stT * 12, 7 + this.stT * 26);
        if (this.stT > 0.33) { this.setBox(16, 16); this.go('armed'); }
        break;
      case 'armed': { // pavio de 1 s: pisca cada vez mais rápido
        this.setAnim('windup');
        const rate = 6 + this.stT * 22;
        const on = Math.floor(this.stT * rate) % 2 === 0;
        this.teleOn = on; this.teleColor = '#ff5a8a';
        if (on && Math.floor((this.stT - dt) * rate) % 2 !== 0) audio.sfx('en_fuse', { pitch: 1 + this.stT * 0.5 });
        this.light.i = 0.4 + this.stT * 0.6; this.light.r = 16 + this.stT * 14;
        if (this.stT > 1.0) this.explode();
        break;
      }
      case 'burst':
        this.setAnim('attack'); this.teleOn = false;
        if (this.stT > 0.25) this.remove();
        break;
    }
    this.physics(dt);
  }
  explode() {
    this.go('burst');
    this.enemy = false; this.hittable = false; this.stompable = false; this.dying = false;
    const R = this.radius, L = this.level;
    audio.sfx('explosion'); L.shake(0.35); L.flash?.('#ffd0ff', 0.08);
    L.particles.emit('smoke', this.cx, this.cy - 4, 12);
    L.particles.emit('ember', this.cx, this.cy, 10, { colors: ['#ffb8ff', '#d692f2', '#fff6a8'] });
    L.particles.emit('fabric', this.cx, this.cy, 10, { colors: this.fabricColors });
    const pl = L.player;
    if (pl && pl.state !== 'dead' && Math.hypot(pl.cx - this.cx, pl.cy - this.cy) < R) pl.hurt(1, this);
    for (const e of L.entities) {
      if (e === this || e.dead || !e.hittable || e.isPlayer || !e.enemy) continue;
      if (Math.hypot(e.cx - this.cx, e.cy - this.cy) < R) e.onHit ? e.onHit(2, this, { kind: 'explosion' }) : e.hurt(2, this);
    }
    this.drops = { buttons: 1, heart: 0, energy: 0.1 };
    this.dropLoot();
  }
  draw(ctx) {
    if (this.state === 'burst') {
      const r = Math.round(this.radius * Math.min(1, this.stT / 0.12)), cx = Math.round(this.cx), cy = Math.round(this.cy - 2);
      ctx.fillStyle = this.stT < 0.12 ? '#fff6ff' : '#d692f2';
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 2, 2); }
    }
    this.drawBody(ctx); this.drawStatus(ctx);
  }
}
registerEntity('w1_boomshroom', BoomShroom);

// =============================================================================
// f — w1_corrupt_toy: ursinho de pelúcia corrompido
// =============================================================================
const TED_BASE = { b: 0, lean: 0, hx: 0, hy: 0, ff: [19, 29.5], bf: [12, 29.5], arm: 0, eye: 'n', ears: 0, lines: false };
const TED = {
  idle: [{}, { b: 1 }],
  move: [{ ff: [20, 29], bf: [11, 29.5] }, { b: 1 }, { ff: [18, 29.5], bf: [13, 29] }, { b: 1 }],
  windup: [{ b: 2, lean: -1, hy: 2, arm: 2, eye: 'g' }, { b: 2, lean: 0, hy: 3, arm: 1, eye: 'g', ff: [17, 29.5] }],
  attack: [{ lean: 3, hx: 3, hy: 3, ears: 1, lines: true, eye: 'g', ff: [23, 29], bf: [9, 29.5] }, { lean: 3, hx: 3, hy: 4, ears: 1, lines: true, eye: 'g', b: 1 }, { lean: 3, hx: 3, hy: 3, ears: 1, lines: true, eye: 'g', ff: [16, 29.5], bf: [14, 29] }, { lean: 3, hx: 3, hy: 4, ears: 1, lines: true, eye: 'g', b: 1 }],
  hurt: [{ lean: -2, hx: -2, hy: -1, eye: 'x' }, { lean: -1, hx: -1, eye: 'x' }],
  stun: [{ b: 4, hx: -1, hy: 1, eye: 'x', ff: [22, 30], bf: [15, 30] }, { b: 4, hx: 1, hy: 1, eye: 'x', ff: [22, 30], bf: [15, 30] }],
};
function drawTeddy(pc, q) {
  const b = q.b, L = q.lean, hx = 18 + q.hx, hy = 11 + b + q.hy;
  puff(pc, q.bf[0], q.bf[1], 3, 2.2, P.ted);
  puff(pc, 10 + L * 0.5, 21 + b, 2.5, 3.5, P.ted); // braço de trás
  puff(pc, 15 + L, 22 + b, 7, 6.5, P.ted);
  puff(pc, 15 + L, 22 + b, 7, 6.5, P.patch, { mask: (x, y) => x >= 9 + L && x <= 13 + L && y >= 18 + b && y <= 23 + b });
  stitch(pc, 9 + L, 18 + b, 13 + L, 18 + b, CREAM); stitch(pc, 9 + L, 23 + b, 13 + L, 23 + b, CREAM);
  // barriga rasgada com corrupção
  const sx = Math.round(19 + L), sy = Math.round(21 + b);
  puff(pc, sx, sy + 2, 3, 3.6, P.muz);
  pc.vline(sx, sy, 5, '#2a1030'); pc.px(sx - 1, sy + 1, P.corr[1]); pc.px(sx + 1, sy + 2, P.corr[2]); pc.px(sx - 1, sy + 3, P.corr[2]); pc.px(sx, sy + 5, P.corr[1]); pc.px(sx, sy + 6, P.corr[3]);
  for (let i = 0; i < 3; i++) { pc.px(sx - 2, sy + i * 2, '#3a2228'); pc.px(sx + 2, sy + i * 2 + 1, '#3a2228'); }
  puff(pc, q.ff[0], q.ff[1], 3, 2.2, P.ted);
  // cabeça
  const ey = q.ears ? 2 : 0;
  puff(pc, hx - 6 - ey, hy - 6 + ey, 2.6, 2.6, P.ted); puff(pc, hx + 4 - ey, hy - 6.5 + ey, 2.6, 2.6, P.ted);
  pc.px(Math.round(hx - 6 - ey), Math.round(hy - 6 + ey), P.muz[2]); pc.px(Math.round(hx + 4 - ey), Math.round(hy - 6.5 + ey), P.muz[2]);
  puff(pc, hx, hy, 7.5, 7, P.ted);
  stitch(pc, Math.round(hx - 1), Math.round(hy - 6), Math.round(hx - 1), Math.round(hy - 2), P.ted[4]);
  puff(pc, hx + 6, hy + 2, 3.2, 2.4, P.muz);
  pc.rect(Math.round(hx + 7), Math.round(hy + 1), 2, 1, '#2a1a20'); pc.px(Math.round(hx + 7), Math.round(hy + 1), '#6a5060');
  stitch(pc, Math.round(hx + 4), Math.round(hy + 4), Math.round(hx + 7), Math.round(hy + 4), '#2a1a20');
  const ex = Math.round(hx + 3), eyy = Math.round(hy - 1), gx = Math.round(hx - 2);
  if (q.eye === 'x') { xEye(pc, ex + 1, eyy + 1, '#0e0a14'); xEye(pc, gx, eyy + 1, P.corr[1]); }
  else {
    btnEye(pc, ex, eyy);
    if (q.eye === 'g') { pc.circle(gx + 0.5, eyy + 1.5, 2.2, '#ff70ff60'); xEye(pc, gx, eyy + 1, '#ffd0ff'); }
    else xEye(pc, gx, eyy + 1, P.corr[1]);
  }
  puff(pc, 21 + L, 22 + b + q.arm, 2.6, 3.5, P.ted); // braço da frente
  // manchas de corrupção
  for (const [cx, cy] of [[11, 26], [17, 16], [13, 14]]) pc.px(cx + Math.round(L), cy + b, P.corr[2]);
}
defineSprite('w1_corrupt_toy', {
  w: 32, h: 32, ox: 16, oy: 32,
  anims: { idle: { frames: 2, fps: 2.5 }, move: { frames: 4, fps: 7 }, windup: { frames: 2, fps: 6 }, attack: { frames: 4, fps: 14 }, hurt: { frames: 2, fps: 10 }, stun: { frames: 2, fps: 3 } },
  draw(pc, anim, f) {
    const q = { ...TED_BASE, ...(TED[anim]?.[f] || {}) };
    drawTeddy(pc, q);
    pc.outline(OUT1);
    if (q.lines) for (const [y, l] of [[14, 5], [19, 7], [25, 4]]) pc.hline(1 + ((f + y) & 1), y, l, '#e090ffb0');
  },
});

class CorruptToy extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w1_corrupt_toy';
    this.w = 16; this.h = 18; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 4, heart: 0.15, energy: 0.3 };
    this.fabricColors = ['#9a7858', '#b050f0', '#e8d0b0'];
    this.light = { r: 26, color: '#b050ff', i: 0.35, flicker: 0.2 };
    this.teleColor = '#e090ff';
    this.go('wander');
  }
  onHit(dmg, src, info) {
    if (this.state === 'charge' && src && Math.sign(src.cx - this.cx) === this.facing) { // bloqueia de frente
      this.flash = 0.06; audio.sfx('armor_clink');
      this.level.particles.emit('hit', this.cx + this.facing * 8, this.cy, 4, { colors: ['#e090ff', '#ffffff'] });
      if (src.isPlayer) src.vx = this.facing * 160;
      return false;
    }
    return super.onHit(this.stunT > 0 ? dmg * 2 : dmg, src, info);
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const dx = p.cx - this.cx;
    if (chance(0.06)) this.level.particles.emit('energy', this.cx + (Math.random() - 0.5) * 14, this.cy, 1, { colors: ['#e090ff', '#b050f0'] });
    this.stompable = this.state !== 'charge';
    switch (this.state) {
      case 'wander':
        this.setAnim('move'); this.patrol(20, dt);
        if (this.canSee(p, 140) && Math.abs(p.cy - this.cy) < 36 && (Math.sign(dx) === this.facing || Math.abs(dx) < 60) && this.cool <= 0) {
          this.faceTarget(p); this.vx = 0; this.go('notice'); audio.sfx('en_alert');
        }
        break;
      case 'notice': // "!" + raspa o chão (~0.55 s)
        this.vx = 0; this.setAnim('windup');
        this.tele(this.stT > 0.2);
        if (this.stT > 0.55) { this.teleOn = false; this.go('charge'); }
        break;
      case 'charge':
        this.setAnim('attack');
        this.vx = this.facing * Math.min(170, 60 + this.stT * 400);
        if (chance(0.4)) this.level.particles.emit('dust', this.cx - this.facing * 6, this.bottom, 1);
        if (this.wallAhead(this.facing, 3)) { // BONK: atordoado (momento fraco)
          audio.sfx('en_bonk'); this.level.shake(0.25);
          this.level.particles.emit('hit', this.cx + this.facing * 9, this.cy - 4, 6);
          this.vx = -this.facing * 70; this.vy = -140;
          this.setAnim('stun'); this.stun(1.8); this.go('recover');
        } else if (!this.groundAhead(this.facing, 6) || this.stT > 1.8) { this.go('skid'); }
        break;
      case 'skid':
        this.vx *= 0.86; this.setAnim('windup');
        if (chance(0.5)) this.level.particles.emit('dust', this.cx + this.facing * 6, this.bottom, 1);
        if (this.stT > 0.55) this.go('recover');
        break;
      case 'recover':
        this.vx *= 0.8; this.setAnim('idle');
        if (this.stT > 0.7) { this.cool = 0.6; this.faceTarget(p); this.go('wander'); }
        break;
    }
    this.physics(dt);
  }
  draw(ctx) {
    this.drawBody(ctx, this.stunT > 0 && this.hurtT <= 0 ? { anim: 'stun' } : {});
    if (this.state === 'notice' && !this.dying) drawMark(ctx, this.cx, this.y - 16 - Math.max(0, 3 - this.stT * 20));
    this.drawStatus(ctx);
  }
}
registerEntity('w1_corrupt_toy', CorruptToy);

// =============================================================================
// g — w1_paperbird: pássaro de papel (avião de origami desenhado a giz)
// =============================================================================
const PAPER = ['#ffffff', '#f6f0e2', '#ddd4bf', '#b4ab98', '#8a8478'];
function drawPaperBird(pc, { tail = 3, a = 0, dive = false, crumple = 0 }) {
  const C = [13, 9];
  if (crumple) {
    const pts = rot([[6, 6], [10, 3], [15, 4], [19, 7], [18, 12], [13, 14], [8, 13], [5, 10]], crumple, 12.5, 9);
    pc.poly(pts, PAPER[2]);
    pc.poly(rot([[8, 6], [12, 4], [16, 6], [13, 9]], crumple, 12.5, 9), PAPER[0]);
    pc.line(8, 11, 13, 8, PAPER[4]); pc.line(13, 8, 17, 11, PAPER[4]); pc.line(11, 5, 12, 9, PAPER[3]);
    xEye(pc, 15, 9, '#4a7fe0');
    return;
  }
  const N = dive ? [25, 9] : [24, 9], T = dive ? [5, 6 + (tail > 4 ? 1 : 0)] : [3, tail], R = [8, 9], K = dive ? [10, 12] : [9, 13];
  const tr = (pts) => (a ? rot(pts, a, C[0], C[1]) : pts);
  pc.poly(tr([N, R, K]), PAPER[2]);
  pc.poly(tr([[N[0] - 2, 10], R, [K[0] + 1, K[1] - 1]]), PAPER[3]);
  pc.poly(tr([N, T, R]), PAPER[1]);
  pc.poly(tr([N, [T[0] + 3, T[1] + 1], [R[0] + 2, 8]]), PAPER[0]);
  const ln = (p, q, c) => { const [A, B] = tr([p, q]); pc.line(Math.round(A[0]), Math.round(A[1]), Math.round(B[0]), Math.round(B[1]), c); };
  ln(N, R, PAPER[4]);
  ln([9, T[1] + 3], [13, 7], '#4a7fe0'); ln([13, 7], [16, 8], '#4a7fe0');
  const [E] = tr([[18, 10]]), [Bk] = tr([[22, 9]]);
  pc.rect(Math.round(E[0]), Math.round(E[1]), 2, 2, '#ffffff'); pc.px(Math.round(E[0]) + 1, Math.round(E[1]), '#2a2440'); pc.px(Math.round(E[0]) + 1, Math.round(E[1]) + 1, '#4a7fe0');
  pc.poly(tr([[N[0] + 1, 9], [Bk[0] - (a ? 0 : 0), 8], [Bk[0], 10.5]]), '#e04848');
}
defineSprite('w1_paperbird', {
  w: 28, h: 18, ox: 14, oy: 9,
  anims: { idle: { frames: 3, fps: 4 }, move: { frames: 3, fps: 9 }, windup: { frames: 2, fps: 8, loop: false }, attack: { frames: 2, fps: 12 }, hurt: { frames: 2, fps: 8 } },
  draw(pc, anim, f) {
    pc.translate(1, 0);
    if (anim === 'idle' || anim === 'move') drawPaperBird(pc, { tail: [3, 5, 7][f] });
    else if (anim === 'windup') drawPaperBird(pc, { tail: 4, a: -0.3 - f * 0.15 });
    else if (anim === 'attack') drawPaperBird(pc, { dive: true, tail: 4 + f });
    else drawPaperBird(pc, { crumple: f ? 0.4 : 0.01 });
    pc.resetTranslate();
    pc.outline('#2a2848');
  },
});

class PaperBird extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w1_paperbird';
    this.flying = true; this.centerPivot = true;
    this.w = 14; this.h = 8; this.x = x + 1; this.y = y + 4;
    this.homeX = this.cx; this.homeY = this.cy;
    this.hp = this.maxHp = 1;
    this.range = (props.range ?? 4) * 16;
    this.drops = { buttons: 2, heart: 0.05, energy: 0.2 };
    this.fabricColors = ['#ffffff', '#ddd4bf', '#4a7fe0'];
    this.deathSfx = 'en_paper';
    this.angle = 0;
    this.go('fly');
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    this.angle *= 0.85;
    switch (this.state) {
      case 'fly': {
        this.setAnim('move');
        if ((this.cx > this.homeX + this.range && this.facing > 0) || (this.cx < this.homeX - this.range && this.facing < 0)) this.facing *= -1;
        this.vx = this.facing * 42;
        this.vy = (this.homeY + Math.sin(this.t * 2.6) * 10 - this.cy) * 4;
        this.physics(dt, { noGravity: true });
        if (this.hitWall) this.facing *= -1;
        if (this.cool <= 0 && Math.abs(dx) < 46 && dy > 20 && dy < 150 && this.canSee(p, 170)) { this.faceTarget(p); this.go('windup'); audio.sfx('en_paper', { pitch: 1.4 }); }
        return;
      }
      case 'windup': // empina e pisca (~0.4 s)
        this.setAnim('windup'); this.tele();
        this.vx *= 0.9; this.vy = -18;
        this.physics(dt, { noGravity: true });
        if (this.stT > 0.4) {
          this.teleOn = false;
          const tx = p.cx + (p.vx || 0) * 0.15, ty = p.cy;
          const d = Math.hypot(tx - this.cx, ty - this.cy) || 1;
          this.vx = ((tx - this.cx) / d) * 200; this.vy = ((ty - this.cy) / d) * 200;
          this.facing = this.vx < 0 ? -1 : 1;
          this.go('dive'); audio.sfx('dash', { pitch: 1.3, vol: 0.6 });
        }
        return;
      case 'dive': {
        this.setAnim('attack');
        this.angle = this.facing > 0 ? Math.atan2(this.vy, this.vx) : Math.atan2(-this.vy, -this.vx);
        const vx = this.vx, vy = this.vy;
        this.physics(dt, { noGravity: true });
        if (this.hitWall || this.grounded || this.hitCeiling) { // amassa no chão: vulnerável
          this.vx = 0; this.vy = 0; this.angle = 0; this.go('stuck'); audio.sfx('en_paper', { pitch: 0.7 });
          this.level.particles.emit('dust', this.cx, this.bottom, 4); return;
        }
        this.vx = vx; this.vy = vy;
        if (this.stT > 0.9 || this.cy > p.cy + 30) this.go('return');
        return;
      }
      case 'stuck':
        this.setAnim('hurt'); this.vx = 0; this.vy = 0;
        if (this.stT > 0.9) this.go('return');
        return;
      case 'return':
        this.setAnim('idle');
        this.moveToward(this.homeX, this.homeY, 70, dt);
        this.facing = this.vx < 0 ? -1 : 1;
        this.physics(dt, { noGravity: true });
        if (Math.hypot(this.homeX - this.cx, this.homeY - this.cy) < 6 || this.stT > 3) { this.cool = 0.8; this.go('fly'); }
        return;
    }
  }
  draw(ctx) {
    const extra = {};
    if (!this.dying && Math.abs(this.angle) > 0.01) extra.rotation = this.angle;
    if (this.state === 'stuck') extra.anim = 'hurt';
    this.drawBody(ctx, extra); this.drawStatus(ctx);
  }
}
registerEntity('w1_paperbird', PaperBird);

registerLegend(1, { a: 'w1_ragbug', b: 'w1_woodpuppet', d: 'w1_boomshroom', f: 'w1_corrupt_toy', g: 'w1_paperbird' });

// ------------------------------------------------------------- fase de teste
registerLevel({
  id: 'test_enemies_w1', world: 0, index: 0, name: 'Teste: Inimigos do Mundo 1', subtitle: 'Teste',
  tileset: 'w1', background: 'w1', music: null, parTime: 120,
  legend: { a: 'w1_ragbug', b: 'w1_woodpuppet', d: 'w1_boomshroom', f: 'w1_corrupt_toy', g: 'w1_paperbird' },
  map: [
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '.............................g......................g.................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '.........a............................................................',
    '......########.....................................=====..............',
    '.....#########.......................#................................',
    '.P..##########.....b..........d...d..#.......f...............a......E.',
    '######################################################################',
    '######################################################################',
    '######################################################################',
    '######################################################################',
  ],
});
