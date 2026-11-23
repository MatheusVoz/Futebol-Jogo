// =============================================================================
// enemies/w2.js — Inimigos do MUNDO 2 (Oceano das Lágrimas). Funcionam na água
// (tiles '~', map.at(x,y) === T.WATER).
//
// Legenda (registerLegend(2)):
//   a w2_mechfish — peixe de corda de lata: patrulha nadando, trava a mira
//                   (olho vermelho, chave gira) e dá um bote. Fora d'água: debate-se.
//   b w2_jelly    — água-viva corrompida: flutua sobe/desce; a cada ~3 s prepara
//                   (0.6 s, brilho) e solta um ANEL elétrico (pule/afaste-se).
//   d w2_octopus  — polvo de pano num pote: se esconde, sai e cospe tinta em arco
//                   (refletível). armored=true (capacete de pote) → Descosturar.
//   f w2_lurker   — sombra sob a superfície: segue o jogador por baixo e SALTA
//                   da água quando ele passa por cima. Não pisável.
//   g w2_crab     — caranguejo de brinquedo: bloqueia golpes de frente com as
//                   garras; vulnerável por trás, pisão ou logo após o beliscão.
// Fase de teste: ?level=test_enemies_w2
// =============================================================================
import { EnemyProjectile } from './base.js';
import { PlushEnemy, puff, stitch, btnEye, xEye, drawMark, pxLine } from './w1.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { defineSprite, drawSprite, animFrame, frameMeta } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { T } from '../../engine/tilemap.js';
import { clamp, chance } from '../../engine/util.js';

const OUT2 = '#0e1a2e';
const P = {
  tin: ['#e0fff8', '#9ae8d8', '#56b8b0', '#347e88', '#1e4a5c'],
  orange: ['#ffe0b0', '#ffb070', '#e8783a', '#b04a28', '#702c1c'],
  brass: ['#fff4b0', '#ffd23f', '#d09a20', '#8a6018', '#523808'],
  bell: ['#fff0fa', '#ffc0e8', '#f08ad0', '#b058b0', '#703080'],
  core: ['#e0a0ff', '#b060e0', '#7a30b0', '#4e1a80', '#300c50'],
  clay: ['#ffc8a0', '#f09868', '#c86a44', '#94482e', '#5e2c20'],
  octo: ['#ffd0d8', '#ff9aa8', '#e86a80', '#b04460', '#702840'],
  shadow: ['#6a5a9a', '#4a3c7a', '#30265a', '#1e163e', '#100a24'],
  crab: ['#ffd8c0', '#ff9a70', '#e05a3a', '#a83a2a', '#682018'],
  belly: ['#fff6e8', '#f8e4c8', '#e8caa0', '#b89a78', '#7a6450'],
};
const CREAM = '#fff0d8';

registerSfx('en_zap', [{ wave: 'sawtooth', freq: 120, freqEnd: 900, dur: 0.25, vol: 0.14 }, { wave: 'noise', freq: 4000, dur: 0.2, vol: 0.12 }]);
registerSfx('en_charge', { wave: 'triangle', freq: 200, freqEnd: 800, dur: 0.55, vol: 0.1 });
registerSfx('en_spit', [{ wave: 'noise', freq: 1200, freqEnd: 400, dur: 0.12, vol: 0.18 }, { wave: 'sine', freq: 300, freqEnd: 120, dur: 0.1, vol: 0.2 }]);
registerSfx('en_wind', { wave: 'square', freq: 900, dur: 0.02, vol: 0.06 });

const isWater = (lvl, x, y) => lvl.map.at(x, y) === T.WATER;

// =============================================================================
// a — w2_mechfish: peixe de corda
// =============================================================================
function drawFish(pc, { tail = 0, key = 0, red = false, stretch = 0, dent = false, mouth = false }) {
  const rx = 8 + stretch, ry = 5 - stretch * 0.5 - (dent ? 0.8 : 0);
  // cauda articulada
  pc.poly([[7, 10], [1, 5 + tail], [3, 10 + tail * 0.5], [1, 15 + tail]], P.orange[2]);
  pc.poly([[7, 10], [2, 6 + tail], [3, 9 + tail * 0.5]], P.orange[1]);
  pc.poly([[12, 6], [15, 2.5], [17, 6]], P.tin[3]);
  puff(pc, 14, 10, rx, ry, P.tin, { rough: 0.08, fuzz: false });
  puff(pc, 14, 10, rx, ry, P.orange, { rough: 0.08, fuzz: false, mask: (x) => x >= 11 && x <= 12 });
  for (const [x, y] of [[9, 8], [9, 12], [16, 7], [16, 13]]) { pc.px(x, y, P.tin[0]); pc.px(x, y + 1, P.tin[4]); }
  if (dent) pc.line(13, 7, 15, 9, P.tin[4]);
  // olho e boca-grade
  pc.circle(18.5, 9, 2.4, red ? '#ff4a4a' : '#f4fff8');
  if (dent) xEye(pc, 18, 9, '#1a1020');
  else { pc.rect(19, 8, 1, 2, red ? '#fff06a' : '#10141c'); pc.px(17, 7, '#ffffff'); }
  pc.rect(20, 11, 3, mouth ? 3 : 2, '#10141c'); pc.px(21, 11, P.tin[0]); if (mouth) pc.px(20, 13, P.tin[0]);
  pc.poly([[13, 12], [11, 15.5], [16, 13]], P.orange[3]);
  // chave de corda (gira)
  pc.vline(13, 2, 4, P.brass[3]);
  const kw = [3, 2, 0.6][key];
  puff(pc, 13 - kw, 1.5, Math.max(0.8, kw * 0.6), 1.5, P.brass, { fuzz: false });
  puff(pc, 13 + kw + 0.5, 1.5, Math.max(0.8, kw * 0.6), 1.5, P.brass, { fuzz: false });
}
defineSprite('w2_mechfish', {
  w: 28, h: 18, ox: 14, oy: 9,
  anims: { idle: { frames: 2, fps: 3 }, move: { frames: 3, fps: 8 }, windup: { frames: 2, fps: 14 }, attack: { frames: 2, fps: 12 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    pc.translate(2, 0);
    if (anim === 'idle') drawFish(pc, { tail: f ? 1 : -1, key: f });
    else if (anim === 'move') drawFish(pc, { tail: [-2, 0, 2][f], key: f });
    else if (anim === 'windup') drawFish(pc, { tail: -3, key: f ? 2 : 0, red: true });
    else if (anim === 'attack') drawFish(pc, { tail: f ? 1 : -1, key: 1, red: true, stretch: 1, mouth: true });
    else drawFish(pc, { tail: f ? 2 : -2, key: 2, dent: true });
    pc.resetTranslate(); pc.outline(OUT2);
  },
});

class MechFish extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w2_mechfish';
    this.flying = true; this.centerPivot = true;
    this.w = 16; this.h = 10; this.x = x; this.y = y + 3;
    this.hp = this.maxHp = 2;
    this.drops = { buttons: 3, heart: 0.08, energy: 0.2 };
    this.fabricColors = ['#56b8b0', '#e8783a', '#ffd23f'];
    this.deathSfx = 'armor_clink';
    this.go('swim');
  }
  inW(x = this.cx, y = this.cy) { return isWater(this.level, x, y); }
  /** Move ficando dentro da água (anula componentes que sairiam dela). */
  swimMove(dt) {
    if (!this.inW(this.cx + this.vx * dt + Math.sign(this.vx) * 8, this.cy)) { this.vx = 0; this.hitW = true; }
    if (!this.inW(this.cx, this.cy + this.vy * dt + Math.sign(this.vy) * 5)) this.vy = 0;
    this.physics(dt, { noGravity: true });
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    if (!this.inW()) { // fora d'água: debate-se no chão e tenta voltar
      this.setAnim('hurt');
      this.vy += 700 * dt; this.vx *= 0.98;
      if (this.grounded && this.stT > 0.4) { this.vy = -150; this.vx = (Math.random() < 0.5 ? -1 : 1) * 50; this.facing = Math.sign(this.vx); this.stT = 0; }
      this.physics(dt, { noGravity: true });
      if (this.inW()) this.go('swim');
      return;
    }
    this.hitW = false;
    switch (this.state) {
      case 'swim':
        this.setAnim('move');
        this.vx = this.facing * 32; this.vy = Math.sin(this.t * 2) * 10;
        this.swimMove(dt);
        if (this.hitW || this.hitWall) this.facing *= -1;
        if (this.cool <= 0 && this.canSee(p, 120) && (p.inWater || this.inW(p.cx, p.cy + 10))) { this.faceTarget(p); this.go('lock'); audio.sfx('en_alert', { pitch: 1.2 }); }
        break;
      case 'lock': // trava a mira: chave gira, recua (~0.5 s)
        this.setAnim('windup'); this.tele(); this.faceTarget(p);
        this.vx = -this.facing * 14; this.vy = 0; this.swimMove(dt);
        if (Math.floor(this.stT * 20) !== Math.floor((this.stT - dt) * 20)) audio.sfx('en_wind', { pitch: 1 + this.stT });
        if (this.stT > 0.5) {
          this.teleOn = false;
          const d = Math.hypot(p.cx - this.cx, p.cy - this.cy) || 1;
          this.dvx = ((p.cx - this.cx) / d) * 210; this.dvy = ((p.cy - this.cy) / d) * 210;
          this.facing = this.dvx < 0 ? -1 : 1;
          this.go('dash'); audio.sfx('dash', { pitch: 0.8 });
        }
        break;
      case 'dash':
        this.setAnim('attack');
        this.vx = this.dvx; this.vy = this.dvy; this.swimMove(dt);
        if (chance(0.5)) this.level.particles.emit('bubble', this.cx - this.facing * 8, this.cy, 1);
        if (this.stT > 0.6 || (this.vx === 0 && this.vy === 0)) { this.go('tired'); }
        break;
      case 'tired': // chave desacelera: vulnerável
        this.setAnim('idle'); this.vx *= 0.9; this.vy *= 0.9; this.swimMove(dt);
        if (this.stT > 0.9) { this.cool = 0.6; this.go('swim'); }
        break;
    }
  }
}
registerEntity('w2_mechfish', MechFish);

// =============================================================================
// b — w2_jelly: água-viva corrompida com anel elétrico
// =============================================================================
function drawJelly(pc, { rx = 10, ry = 8, glow = 0, x = false, ph = 0, curl = 0, spread = 0 }) {
  const cy = 11;
  puff(pc, 14, cy, rx, ry, P.bell, { ymax: cy + 2, lit: 0.05 });
  for (let sx = 14 - rx + 2; sx <= 14 + rx - 2; sx += 3) puff(pc, sx, cy + 2.5, 1.7, 1.3, P.bell, { lit: -0.15 });
  puff(pc, 14, cy - 2, rx * 0.42, ry * 0.4, P.core, { lit: glow * 0.3 });
  if (glow) for (const [gx, gy] of [[12, cy - 3], [15, cy - 1], [16, cy - 4]]) pc.px(gx, gy, glow > 1 ? '#ffffff' : '#8ff0ff');
  stitch(pc, 14 - rx + 3, cy - ry + 3, 14 + rx - 3, cy - ry + 3, '#fff0fa');
  if (x) { xEye(pc, 10, cy + 1, '#1a0a20'); xEye(pc, 18, cy + 1, '#1a0a20'); }
  else { btnEye(pc, 9, cy); btnEye(pc, 17, cy); }
  pc.px(13, cy + 2, '#5a2050'); pc.px(14, cy + 1, '#5a2050'); pc.px(15, cy + 2, '#5a2050');
}
function jellyTentacles(pc, { ph = 0, curl = 0, spread = 0, glow = 0 }) {
  for (let i = 0; i < 5; i++) {
    const bx = 7 + i * 3.5, len = 16 - curl * 8, dir = (i - 2) * spread;
    let px = bx, py = 14;
    for (let j = 1; j <= len; j++) {
      const nx = bx + Math.sin(ph + j * 0.55 + i) * 1.4 + dir * j * 0.25 + (curl ? Math.sin(j * 0.9) * curl * 2 : 0);
      const ny = 14 + j;
      const c = glow && j % 3 === 0 ? '#8ff0ff' : i & 1 ? '#a058d0' : '#ff9ad0';
      pc.px(Math.round(nx), ny, c); pc.px(Math.round(nx) + 1, ny, i & 1 ? '#5a2a80' : '#b0508a');
      px = nx; py = ny;
    }
    pc.rect(Math.round(px), py, 2, 1, '#ffd0ef');
  }
}
defineSprite('w2_jelly', {
  w: 28, h: 32, ox: 14, oy: 13,
  anims: { idle: { frames: 3, fps: 4 }, move: { frames: 3, fps: 4 }, windup: { frames: 2, fps: 8 }, attack: { frames: 2, fps: 12 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    let b = {}, t = { ph: f * 2.1 };
    if (anim === 'windup') { b = { rx: 9, ry: 9, glow: 1 + f }; t = { ph: f, curl: 1, glow: 1 }; }
    else if (anim === 'attack') { b = { rx: 11.5, ry: 7, glow: 2 }; t = { ph: f * 3, spread: 1, glow: 1 }; }
    else if (anim === 'hurt') { b = { rx: 11, ry: 6.5, x: true }; t = { ph: f * 3, curl: 0.5 }; }
    else b = { ry: 8 + (f === 1 ? 0.6 : 0) };
    drawJelly(pc, b); pc.outline(OUT2); jellyTentacles(pc, t);
    if (anim === 'attack') for (let i = 0; i < 6; i++) pc.px(3 + ((i * 7 + f * 5) % 22), 2 + ((i * 5 + f * 3) % 20), '#fff06a');
  },
});

class Jelly extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w2_jelly';
    this.flying = true; this.centerPivot = true;
    this.w = 16; this.h = 16; this.x = x; this.y = y;
    this.homeX = this.cx; this.homeY = this.cy;
    this.hp = this.maxHp = 2;
    this.drops = { buttons: 3, heart: 0.1, energy: 0.35 };
    this.fabricColors = ['#f08ad0', '#b060e0', '#fff0fa'];
    this.light = { r: 22, color: '#ff8ad8', i: 0.35, flicker: 0.1 };
    this.ringR = 0; this.ringHit = false; this.period = props.period ?? 2.4;
    this.stT = (this.id % 5) * 0.3;
    this.go('float');
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const ty = this.homeY + Math.sin(this.t * 1.4 + this.id) * 18;
    let tx = this.homeX;
    if (this.canSee(p, 120, false)) tx = clamp(p.cx, this.homeX - 48, this.homeX + 48);
    this.vx = clamp((tx - this.cx) * 0.6, -14, 14); this.vy = (ty - this.cy) * 2;
    this.stompable = this.state === 'float';
    switch (this.state) {
      case 'float':
        this.setAnim('idle'); this.light.i = 0.35; this.faceTarget(p);
        if (this.stT > this.period && this.canSee(p, 160, false)) { this.go('charge'); audio.sfx('en_charge'); }
        break;
      case 'charge': // telégrafo de 0.6 s: encolhe, brilha e pisca
        this.setAnim('windup'); this.tele(); this.vx *= 0.3; this.vy *= 0.3;
        this.light.i = 0.4 + this.stT; this.light.color = '#8ff0ff';
        if (chance(0.3)) this.level.particles.emit('energy', this.cx, this.cy, 1);
        if (this.stT > 0.6) { this.teleOn = false; this.ringR = 4; this.ringHit = false; this.go('pulse'); audio.sfx('en_zap'); this.level.shake(0.1); }
        break;
      case 'pulse': {
        this.setAnim('attack'); this.vx = 0; this.vy = 0;
        this.ringR = 4 + this.stT * 110;
        const pl = this.level.player, d = pl ? Math.hypot(pl.cx - this.cx, pl.cy - this.cy) : 999;
        if (!this.ringHit && pl && pl.state !== 'dead' && d > this.ringR - 9 && d < this.ringR + 4) { this.ringHit = true; pl.hurt(1, this); }
        if (this.stT > 0.4) { this.ringR = 0; this.light.color = '#ff8ad8'; this.go('float'); }
        break;
      }
    }
    this.physics(dt, { noGravity: true });
  }
  draw(ctx) {
    if (this.ringR > 0 && !this.dying) {
      const cx = this.cx, cy = this.cy, r = this.ringR, n = Math.max(24, (r * 1.6) | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, j = ((i * 7919 + ((this.t * 30) | 0)) % 5) - 2;
        ctx.fillStyle = i % 3 ? '#8ff0ff' : '#fff06a';
        ctx.fillRect(Math.round(cx + Math.cos(a) * (r + j)), Math.round(cy + Math.sin(a) * (r + j)), 2, 2);
        if (i % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(cx + Math.cos(a) * (r - 3)), Math.round(cy + Math.sin(a) * (r - 3)), 1, 1); }
      }
    }
    this.drawBody(ctx); this.drawStatus(ctx);
  }
}
registerEntity('w2_jelly', Jelly);

// =============================================================================
// d — w2_octopus: polvo de pano no pote (capacete de pote = armadura)
// =============================================================================
const OCT = {
  idle: [{ hy: 21 }, { hy: 21, blink: true }],
  move: [{ hy: 19 }, { hy: 16, tent: true }, { hy: 14, tent: true }],
  windup: [{ hy: 13, puffed: 1, tent: true }, { hy: 12.5, puffed: 1.5, tent: true }],
  attack: [{ hy: 13, tube: 2, ink: true, tent: true }, { hy: 13.5, tube: 1, tent: true }],
  hurt: [{ hy: 14, x: true, tent: true }, { hy: 15, x: true, tent: true }],
};
function drawOcto(pc, q) {
  const hy = q.hy, rx = 6.5 + (q.puffed || 0);
  puff(pc, 16, 21.5, 7.5, 2, P.clay, { lit: 0.3 });
  pc.ellipse(16, 21.4, 5.6, 1.2, '#2a1418');
  puff(pc, 16, hy, rx, 6, P.octo, { ymax: 21 });
  for (const [sx, sy] of [[12, hy - 3], [19, hy - 4], [14, hy + 3]]) if (sy < 21) pc.px(sx, Math.round(sy), P.octo[0]);
  const ey = Math.round(hy - 1);
  if (ey < 21) {
    if (q.x) { xEye(pc, 13, ey + 1, '#1a0a20'); xEye(pc, 18, ey + 1, '#1a0a20'); }
    else if (q.blink) { pc.hline(12, ey + 1, 2, '#1a0a20'); pc.hline(17, ey + 1, 2, '#1a0a20'); }
    else { btnEye(pc, 12, ey); btnEye(pc, 17, ey); if (q.puffed) { pc.px(11, ey - 1, '#1a0a20'); pc.px(19, ey - 1, '#1a0a20'); } }
  }
  if (q.puffed || q.tube) {
    const tx = 21.5 + (q.tube || 0) - (q.puffed ? 1 : 0), ty = hy + 2.5;
    if (ty < 21) { puff(pc, tx, ty, 2.4, 1.7, P.octo, { lit: -0.1 }); pc.px(Math.round(tx + 2), Math.round(ty), '#2a1020'); }
    if (q.ink) { pc.circle(tx + 4.5, ty - 0.5, 1.6, '#3a2050'); pc.px(Math.round(tx + 4), Math.round(ty - 1), '#8a6ab0'); }
  }
  // pote (frente)
  puff(pc, 16, 21.5, 7.5, 2, P.clay, { lit: 0.3, ymin: 22 });
  puff(pc, 16, 28, 9.5, 5.6, P.clay, { ymin: 24, ymax: 33 });
  pc.hline(10, 23, 13, P.clay[3]);
  for (let x = 9; x <= 23; x += 2) pc.px(x, 26 + ((x >> 1) & 1), CREAM);
  pc.line(20, 29, 22, 31, P.clay[4]); pc.px(21, 29, P.clay[0]);
  if (q.tent) {
    for (const [x0, x1, x2, s] of [[10, 7, 6, -1], [22, 25, 26, 1]]) {
      pc.thickLine(x0, 21, x1, 25, 1.3, P.octo[2]); pc.thickLine(x1, 25, x2, 28, 1, P.octo[3]);
      pc.px(x2 + s, 28, P.octo[3]); pc.px(x1, 25, P.octo[0]); pc.px(x0 + s, 23, P.octo[0]);
    }
  }
}
defineSprite('w2_octopus', {
  w: 32, h: 34, ox: 16, oy: 34,
  anims: { idle: { frames: 2, fps: 1.5 }, move: { frames: 3, fps: 10, loop: false }, windup: { frames: 2, fps: 6 }, attack: { frames: 2, fps: 8, loop: false }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) { drawOcto(pc, OCT[anim][f]); pc.outline(OUT2); },
  meta(anim, f) { return { head: [16, OCT[anim][f].hy - 6] }; },
});
defineSprite('w2_octo_helm', {
  w: 18, h: 11, ox: 9, oy: 10,
  anims: { idle: { frames: 1, fps: 1 } },
  draw(pc) {
    pc.poly([[3, 9], [5, 2], [13, 2], [15, 9]], P.clay[2]);
    puff(pc, 9, 5, 6, 4.5, P.clay, { mask: (x, y) => y >= 2 && y <= 9 && x >= 3 + (9 - y) * 0.3 && x <= 15 - (9 - y) * 0.3, rough: 0.1, lit: 0.1 });
    pc.hline(4, 8, 11, P.clay[0]); pc.hline(4, 9, 11, P.clay[3]);
    pc.rect(6, 1, 6, 1, P.clay[3]);
    stitch(pc, 4, 5, 14, 5, CREAM); pc.px(11, 3, P.clay[4]); pc.px(12, 4, P.clay[4]);
    pc.outline(OUT2);
  },
});

class InkBlob extends EnemyProjectile {
  draw(ctx) {
    const x = Math.round(this.cx), y = Math.round(this.cy);
    const c = this.reflected ? '#8ff0ff' : '#3a2050';
    ctx.fillStyle = OUT2; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
    ctx.fillStyle = c; ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = this.reflected ? '#ffffff' : '#8a6ab0'; ctx.fillRect(x - 1, y - 1, 2, 1);
    ctx.fillStyle = c; ctx.fillRect(Math.round(x - this.vx * 0.03), Math.round(y - this.vy * 0.03), 2, 2);
  }
}

class Octopus extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w2_octopus';
    this.w = 18; this.h = 14; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.armored = props.armored ?? true;
    this.drops = { buttons: 4, heart: 0.15, energy: 0.3 };
    this.fabricColors = ['#e86a80', '#c86a44', CREAM];
    this.shots = 0;
    this.go('hidden');
  }
  get exposed() { return this.state === 'aim' || this.state === 'shoot' || this.state === 'out'; }
  onHit(dmg, src, info) {
    if (!this.exposed) { // escondido no pote: tink!
      this.flash = 0.05; audio.sfx('armor_clink', { pitch: 0.8 });
      this.level.particles.emit('hit', this.cx, this.y, 3, { colors: ['#f09868'] });
      return false;
    }
    return super.onHit(dmg, src, info);
  }
  onStomp(p) {
    if (!this.exposed || this.armored) { p.vy = -260; audio.sfx('armor_clink'); return; }
    super.onStomp(p);
  }
  unstitch(player) {
    const r = super.unstitch(player);
    if (r) { this.level.particles.emit('fabric', this.cx, this.y - 10, 8, { colors: ['#c86a44', '#f09868', '#94482e'] }); if (!this.exposed) this.go('rise'); }
    return r;
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    this.faceTarget(p);
    const near = this.canSee(p, 180, false);
    switch (this.state) {
      case 'hidden':
        this.setAnim('idle');
        if (this.stT > 1.5 && near) { this.go('rise'); audio.sfx('bubble', { pitch: 0.8 }); }
        break;
      case 'rise':
        this.setAnim('move');
        if (this.stT > 0.3) { this.go('aim'); this.shots = 0; }
        break;
      case 'aim': // incha as bochechas e pisca (~0.45 s)
        this.setAnim('windup'); this.tele();
        if (this.stT > 0.45) { this.teleOn = false; this.go('shoot'); this.spit(p, 0); }
        break;
      case 'shoot':
        this.setAnim('attack');
        if (this.shots < 2 && this.stT > 0.3) { this.animT = 0; this.spit(p, 1); }
        if (this.stT > 0.5) this.go('out');
        break;
      case 'out': // vulnerável (se sem capacete)
        this.setAnim('windup'); this.animT = 0;
        if (this.stT > 0.7) this.go('sink');
        break;
      case 'sink':
        this.setAnim('move'); this.animT = 0.05;
        if (this.stT > 0.25) this.go('hidden');
        break;
    }
    this.physics(dt);
  }
  spit(p, i) {
    this.shots++;
    const mx = this.cx + this.facing * 10, my = this.bottom - 22;
    const tx = p.cx + (i ? this.facing * 16 : 0), dy = p.cy - my;
    const dx = tx - mx, Tt = clamp(Math.abs(dx) / 120, 0.55, 1.1);
    const vx = dx / Tt, vy = (dy - 0.5 * 500 * Tt * Tt) / Tt;
    this.level.add(new InkBlob(this.level, mx, my, { vx, vy, gravity: true, life: 3, w: 7, h: 7, color: '#3a2050', reflectable: true }));
    this.level.particles.emit('smoke', mx, my, 2, { colors: ['#3a2050', '#5a3a70'] });
    audio.sfx('en_spit', { randomPitch: 0.1 });
  }
  draw(ctx) {
    const f = this.drawBody(ctx);
    if (this.armored && !this.dying) {
      const a = this.bodyAnim(), m = frameMeta(this.sprite, a, f);
      if (m) { const [hx, hy] = this.metaPt(m.head, 16, 34); drawSprite(ctx, 'w2_octo_helm', 'idle', 0, hx, hy + 3, { flip: this.facing < 0, variant: this.flash > 0 || this.teleOn ? 'flash' : undefined }); }
    }
    this.drawStatus(ctx);
  }
}
registerEntity('w2_octopus', Octopus);

// =============================================================================
// f — w2_lurker: sombra que espreita sob a superfície
// =============================================================================
function drawLurker(pc, { rx = 10, ry = 8.5, eye = 1, mouth = 0, fin = 0, x = false, cyo = 0 }) {
  const cx = 16, cy = 17 + cyo;
  pc.poly([[cx - rx, cy], [cx - rx - 4 - fin, cy - 3 - fin], [cx - rx + 1, cy + 4]], P.shadow[3]);
  pc.poly([[cx + rx, cy], [cx + rx + 4 + fin, cy - 3 - fin], [cx + rx - 1, cy + 4]], P.shadow[3]);
  for (let i = -2; i <= 2; i++) pc.tri(cx + i * 4 - 2, cy - ry + 2, cx + i * 4 + 2, cy - ry + 2, cx + i * 4 + (i & 1), cy - ry - 2 - (i & 1) * 1.5, P.shadow[2]);
  for (let i = -1; i <= 1; i++) pc.tri(cx + i * 5 - 2, cy + ry - 2, cx + i * 5 + 2, cy + ry - 2, cx + i * 5 - 1, cy + ry + 3, P.shadow[3]);
  puff(pc, cx, cy, rx, ry, P.shadow);
  puff(pc, cx - 3, cy - 4, 3, 2, P.shadow, { lit: 0.35 });
  stitch(pc, cx - 6, cy - 6, cx, cy - 6, '#8a7ab8');
  const ey = Math.round(cy - 3);
  if (x) { xEye(pc, cx - 4, ey, '#d8fff4'); xEye(pc, cx + 4, ey, '#d8fff4'); }
  else if (eye) {
    pc.circle(cx - 4, ey, 2.2 + (eye > 1 ? 0.6 : 0), '#d8fff4'); pc.circle(cx + 4.5, ey, 1.8 + (eye > 1 ? 0.6 : 0), '#d8fff4');
    pc.rect(cx - 4, ey - 1, 1, 2, '#ff3a6a'); pc.rect(cx + 4, ey - 1, 1, 2, '#ff3a6a');
  } else { pc.hline(cx - 6, ey, 3, '#8ff0d8'); pc.hline(cx + 3, ey, 3, '#8ff0d8'); }
  const my = Math.round(cy + 3);
  pc.rect(cx - 6, my, 13, 1 + mouth, '#0a0614');
  for (let i = 0; i < 4; i++) { pc.px(cx - 5 + i * 3, my, '#f4f0ff'); if (mouth) pc.px(cx - 4 + i * 3, my + mouth, '#f4f0ff'); }
}
defineSprite('w2_lurker', {
  w: 34, h: 34, ox: 17, oy: 17,
  anims: { idle: { frames: 2, fps: 2 }, move: { frames: 2, fps: 4 }, windup: { frames: 2, fps: 8 }, attack: { frames: 3, fps: 6, loop: false }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    pc.translate(1, 0);
    if (anim === 'idle') drawLurker(pc, { eye: f ? 0 : 1 });
    else if (anim === 'move') drawLurker(pc, { fin: f });
    else if (anim === 'windup') drawLurker(pc, { eye: 2, mouth: 1, rx: 10.5 + f * 0.5 });
    else if (anim === 'attack') drawLurker(pc, [{ rx: 8.5, ry: 10.5, eye: 2, mouth: 4 }, { rx: 11, ry: 8, eye: 2, mouth: 3, fin: 2 }, { rx: 9.5, ry: 8, eye: 1, mouth: 1, fin: 1 }][f]);
    else drawLurker(pc, { x: true, mouth: 2, ry: 7.5 + f });
    pc.resetTranslate(); pc.outline(OUT2);
  },
});

class Lurker extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w2_lurker';
    this.flying = true; this.centerPivot = true;
    this.w = 18; this.h = 16; this.x = x - 1; this.y = y;
    this.hp = this.maxHp = 2;
    this.stompable = false;
    this.drops = { buttons: 4, heart: 0.12, energy: 0.3 };
    this.fabricColors = ['#30265a', '#1e163e', '#8a7ab8'];
    // superfície: sobe enquanto houver água
    const m = level.map, tx = Math.floor((x + 8) / 16);
    let ty = Math.floor((y + 8) / 16);
    while (ty > 0 && m.get(tx, ty - 1) === T.WATER) ty--;
    this.surf = ty * 16;
    this.go('lurk'); this.submerge();
  }
  submerge() { this.enemy = false; this.hittable = false; this.bindable = false; }
  emerge() { this.enemy = true; this.hittable = true; this.bindable = true; }
  inW(x, y) { return isWater(this.level, x, y); }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const dx = p.cx - this.cx, depth = this.surf + 14;
    switch (this.state) {
      case 'lurk': {
        this.setAnim('move');
        this.vy = (depth - this.cy) * 3;
        this.vx = Math.abs(dx) > 4 && this.canSee(p, 200, false) ? Math.sign(dx) * 30 : 0;
        if (!this.inW(this.cx + Math.sign(this.vx) * 12, this.cy)) this.vx = 0;
        if (this.vx) this.facing = Math.sign(this.vx);
        this.physics(dt, { noGravity: true });
        if (chance(0.02)) this.level.particles.emit('bubble', this.cx, this.y, 1);
        const above = Math.abs(dx) < 30 && p.bottom <= this.surf + 6 && p.cy > this.surf - 120;
        const inside = p.inWater && Math.hypot(dx, p.cy - this.cy) < 40;
        if (this.cool <= 0 && (above || inside)) { this.go('rise'); this.faceTarget(p); audio.sfx('bubble', { pitch: 0.5 }); }
        break;
      }
      case 'rise': // telégrafo: bolhas + olhos acesos na superfície (~0.45 s)
        this.setAnim('windup'); this.tele();
        this.vx = 0; this.vy = (this.surf + 6 - this.cy) * 6;
        this.physics(dt, { noGravity: true });
        if (chance(0.5)) this.level.particles.emit('bubble', this.cx + (Math.random() - 0.5) * 16, this.surf + 2, 1);
        if (this.stT > 0.45) {
          this.teleOn = false; this.emerge();
          const h = clamp(this.surf - p.cy + 16, 40, 110);
          this.vy = -Math.sqrt(2 * 600 * h); this.vx = clamp(dx * 1.2, -60, 60);
          this.level.particles.emit('splash', this.cx, this.surf, 12); audio.sfx('splash_out');
          this.go('leap');
        }
        break;
      case 'leap':
        this.setAnim('attack');
        this.vy += 600 * dt;
        this.physics(dt, { noGravity: true });
        if (this.grounded && !this.inW(this.cx, this.cy)) { this.vy = -200; this.vx = Math.sign(this.homeX - this.x) * 70; }
        if (this.vy > 0 && this.cy > this.surf + 4 && this.inW(this.cx, this.cy)) {
          this.level.particles.emit('splash', this.cx, this.surf, 10); audio.sfx('splash_in');
          this.go('sink');
        }
        break;
      case 'sink':
        this.setAnim('idle'); this.vx *= 0.9; this.vy = (depth - this.cy) * 3;
        this.physics(dt, { noGravity: true });
        if (this.stT > 0.4) { this.submerge(); this.cool = 1.4; this.go('lurk'); }
        break;
    }
  }
  draw(ctx) {
    const under = (this.state === 'lurk' || this.state === 'sink') && !this.dying;
    if (under) {
      // sombra difusa sob a água + olhinhos brilhando
      const cx = Math.round(this.cx), cy = Math.round(this.cy);
      ctx.fillStyle = 'rgba(16,10,36,0.35)'; ctx.fillRect(cx - 11, cy - 5, 22, 10); ctx.fillRect(cx - 8, cy - 7, 16, 14);
      if (Math.floor(this.t * 1.3 + this.id) % 4 !== 0) { ctx.fillStyle = '#8ff0d8'; ctx.fillRect(cx - 5, cy - 3, 2, 1); ctx.fillRect(cx + 3, cy - 3, 2, 1); }
      ctx.fillStyle = 'rgba(200,240,255,0.5)';
      const w = 6 + Math.round(Math.sin(this.t * 3) * 2);
      ctx.fillRect(cx - w, this.surf, 3, 1); ctx.fillRect(cx + w - 2, this.surf, 3, 1);
      return;
    }
    this.drawBody(ctx); this.drawStatus(ctx);
  }
}
registerEntity('w2_lurker', Lurker);

// =============================================================================
// g — w2_crab: caranguejo de brinquedo (bloqueia de frente)
// =============================================================================
function drawCrab(pc, { leg = 0, claw = 'rest', b = 0, x = false, lunge = 0 }) {
  const cx = 17 + lunge, cy = 15 + b;
  // pernas
  for (let i = 0; i < 3; i++) {
    const ph = (leg + i) & 1;
    for (const s of [-1, 1]) { const lx = cx + s * (4 + i * 2.5); pc.line(Math.round(lx), cy + 3, Math.round(lx + s * (1 + ph)), 21, P.crab[3]); }
  }
  puff(pc, cx - 9, cy - 3, 3, 2.5, P.crab); // garra de trás
  puff(pc, cx, cy, 8.5, 5, P.crab);
  puff(pc, cx, cy, 8.5, 5, P.belly, { mask: (xx, y) => y > cy + 1 });
  stitch(pc, cx - 6, cy - 1, cx + 6, cy - 1, P.crab[4]);
  pc.px(cx - 4, cy - 3, P.crab[0]); pc.px(cx + 2, cy - 4, P.crab[0]);
  // olhos em hastes
  for (const [bx, tx] of [[cx - 2, cx - 3], [cx + 3, cx + 4]]) {
    pc.line(bx, cy - 4, tx, cy - 8, P.belly[3]);
    puff(pc, tx + 0.5, cy - 9, 1.9, 1.9, P.belly, { fuzz: false });
    if (x) xEye(pc, tx + 1, cy - 9, '#1a0a20'); else pc.rect(tx + (claw === 'guard' ? 0 : 1), cy - 9, 1, 2, '#1a0a20');
  }
  // garra da frente
  const C = { rest: [cx + 9, cy - 1], guard: [cx + 8, cy - 7], open: [cx + 10, cy - 6], snap: [cx + 13, cy - 1] }[claw];
  pc.thickLine(cx + 6, cy, C[0] - 2, C[1] + 1, 1.1, P.crab[3]);
  if (claw === 'open') {
    puff(pc, C[0] + 1, C[1] - 2, 3.6, 2.2, P.crab); puff(pc, C[0] + 1, C[1] + 3, 3.4, 2, P.crab, { lit: -0.1 });
    pc.hline(C[0] + 1, C[1] + 1, 4, '#3a1010');
  } else {
    puff(pc, C[0] + 1, C[1], 4, 3.3, P.crab);
    pc.line(C[0] + 2, C[1], C[0] + 5, C[1] + (claw === 'snap' ? 0 : 1), P.crab[4]);
    pc.px(C[0], C[1] - 2, P.crab[0]);
  }
}
defineSprite('w2_crab', {
  w: 36, h: 22, ox: 18, oy: 22,
  anims: { idle: { frames: 2, fps: 2 }, move: { frames: 4, fps: 10 }, windup: { frames: 2, fps: 8 }, attack: { frames: 2, fps: 10, loop: false }, hurt: { frames: 2, fps: 10 }, guard: { frames: 2, fps: 4 } },
  draw(pc, anim, f) {
    const q = {
      idle: { b: f ? 0.5 : 0 }, move: { leg: f, b: f & 1 ? 0.5 : 0 }, windup: { claw: 'open', b: f ? 1 : 0.5 },
      attack: { claw: 'snap', lunge: f ? 1 : 2 }, hurt: { x: true, b: 1 - f }, guard: { claw: 'guard', b: f ? 0.5 : 0, leg: f },
    }[anim];
    drawCrab(pc, q); pc.outline(OUT2);
  },
});

class Crab extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w2_crab';
    this.w = 20; this.h = 12; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 3, heart: 0.1, energy: 0.25 };
    this.fabricColors = ['#e05a3a', '#f8e4c8', '#ffd8c0'];
    this.turnT = 0;
    this.go('walk');
  }
  onHit(dmg, src, info) {
    const front = src && Math.sign(src.cx - this.cx) === this.facing;
    if (front && this.state !== 'recover' && info?.kind !== 'explosion') { // garras na frente
      this.flash = 0.05; audio.sfx('armor_clink');
      this.level.particles.emit('hit', this.cx + this.facing * 12, this.cy - 4, 4, { colors: ['#ffd8c0', '#ffffff'] });
      if (src.isPlayer) src.vx = this.facing * 140;
      if (this.state === 'guard' || this.state === 'walk') { this.faceTarget(); this.go('windup'); }
      return false;
    }
    return super.onHit(dmg, src, info);
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const dx = p.cx - this.cx, sees = this.canSee(p, 90) && Math.abs(p.cy - this.cy) < 30;
    // vira devagar quando o jogador passa para trás (janela para atacar)
    if (this.state === 'guard') {
      if (Math.sign(dx) !== this.facing) { this.turnT += dt; if (this.turnT > 0.55) { this.facing *= -1; this.turnT = 0; } } else this.turnT = 0;
    }
    switch (this.state) {
      case 'walk':
        this.setAnim('move'); this.patrol(24, dt);
        if (sees) { this.go('guard'); this.vx = 0; }
        break;
      case 'guard':
        this.setAnim('guard');
        this.vx = Math.sign(dx) === this.facing && Math.abs(dx) > 26 ? this.facing * 14 : 0;
        if (this.vx && !this.groundAhead()) this.vx = 0;
        if (Math.abs(dx) < 30 && Math.sign(dx) === this.facing && this.stT > 0.4) this.go('windup');
        if (!this.canSee(p, 130)) this.go('walk');
        break;
      case 'windup': // abre a garra e pisca (~0.4 s)
        this.vx = 0; this.setAnim('windup'); this.tele();
        if (this.stT > 0.4) { this.teleOn = false; this.go('snap'); this.vx = this.facing * 110; audio.sfx('whip', { pitch: 1.4 }); this.hitDone = false; }
        break;
      case 'snap': {
        this.setAnim('attack'); this.vx *= 0.85;
        if (!this.groundAhead()) this.vx = 0;
        const pl = this.level.player, kx = this.facing > 0 ? this.right : this.x - 12;
        if (!this.hitDone && pl && pl.state !== 'dead' && pl.x < kx + 12 && pl.x + pl.w > kx && pl.y < this.bottom && pl.bottom > this.y - 6) { this.hitDone = true; pl.hurt(1, this); }
        if (this.stT > 0.22) this.go('recover');
        break;
      }
      case 'recover': // garras baixas: vulnerável de frente também
        this.vx *= 0.7; this.setAnim('idle');
        if (this.stT > 0.55) this.go(sees ? 'guard' : 'walk');
        break;
    }
    this.physics(dt);
  }
}
registerEntity('w2_crab', Crab);

registerLegend(2, { a: 'w2_mechfish', b: 'w2_jelly', d: 'w2_octopus', f: 'w2_lurker', g: 'w2_crab' });

// ------------------------------------------------------------- fase de teste
registerLevel({
  id: 'test_enemies_w2', world: 0, index: 0, name: 'Teste: Inimigos do Mundo 2', subtitle: 'Teste',
  tileset: 'w2', background: 'w2', music: null, parTime: 120,
  legend: { a: 'w2_mechfish', b: 'w2_jelly', d: 'w2_octopus', f: 'w2_lurker', g: 'w2_crab' },
  map: [
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '......................................................................',
    '.P.......g......................d............................g.....E..',
    '##############~~~~~~~~~~~~~~~~##########~~~~~~~~~~~~~~~~##############',
    '##############~~~~~~~~~~~~f~~~##########~~~~~~~~~~~~~~~~##############',
    '##############~~~~~a~~~~~~~~~~##########~~~~b~~~~~~~~~~~##############',
    '##############~~~~~~~~~~~~~~~~##########~~~~~~~a~~~~~~~~##############',
    '##############~~~~~~~~~~~~~~~~##########~~~~~~~~~~~~~~~~##############',
    '######################################################################',
  ],
});
