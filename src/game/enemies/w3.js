// =============================================================================
// enemies/w3.js — Inimigos do MUNDO 3 (Cidade dos Relógios Quebrados).
//
// Legenda (registerLegend(3)):
//   a w3_tinsoldier  — soldadinho de corda: marcha, para, MIRA (a chave gira e ele
//                      ergue o fuzil ~0.5 s) e dispara uma rolha (refletível pelo
//                      Remendo Temporal). Vira nas beiradas. Pisável. 2 hp.
//   b w3_livingclock — despertador vivo: pula até o jogador e TOCA (sinos tremem
//                      ~0.45 s; anel de choque: jogador fica lento ×0.5 por 1.5 s).
//                      Teleporta uma distância curta com tique-taque piscando
//                      (para se aproximar ou fugir após levar golpe). 3 hp.
//   d w3_rustbot     — robô enferrujado: lento, BLINDADO por placas remendadas
//                      (golpes batem; Descosturar arranca as placas). Ergue os
//                      punhos ~0.6 s e esmurra o chão: ondas de choque correm pelo
//                      chão para os dois lados (pule!). 4 hp.
//   f w3_timewarper  — ampulheta flutuante com aura: dentro da aura o jogador anda
//                      devagar; foge quando você chega perto e, depois de virar a
//                      ampulheta (~0.45 s), dispara orbes de areia lentos. 2 hp.
//   g w3_cogbat      — morcego de engrenagens: pendurado no teto (assenta sozinho
//                      no teto acima da célula); quando o jogador passa embaixo,
//                      desdobra as asas (~0.4 s) e mergulha em ARCO. 2 hp.
//
// Exporta slowPlayer(level, chave, fator, seg) — lentidão segura e acumulável
// (restaura player.mods.speed mesmo se outra coisa o alterar no meio).
// Fase de teste: ?level=test_enemies_w3
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { EnemyProjectile } from './base.js';
import { PlushEnemy, puff, OUT1 } from './w1.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { defineSprite } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { clamp, rand, approach, TILE } from '../../engine/util.js';
import { spawnShockwave } from '../art/vfx.js';

// ----------------------------------------------------------------- paletas
// [brilho, luz, base, sombra, escuro]
const TIN = ['#f6faff', '#cdd8e8', '#98a8bf', '#66748e', '#3e4760'];
const BRASS = ['#fff4b8', '#f6cf62', '#cc9a3c', '#91672a', '#5c3e1c'];
const COAT = ['#ffb4a4', '#f2645c', '#c83c40', '#8c2434', '#561628'];
const NAVY = ['#a8c4ff', '#6c8ce6', '#4a62be', '#344690', '#222a5e'];
const HAT = ['#5c5c8c', '#3e3c6a', '#2a2848', '#1c1a34', '#100e20'];
const SKIN = ['#fff4e8', '#ffe0c8', '#f4c4a4', '#d89c84', '#a87068'];
const RUST = ['#f4b888', '#d68048', '#a8582e', '#763a22', '#4a2418'];
const STEEL = ['#e4f4f0', '#a8c8c4', '#76989a', '#4e6a70', '#30444c'];
const SAND = ['#fff6cc', '#f6dc94', '#dcb464', '#ac843e', '#70522a'];
const WOOD = ['#e8b888', '#c48a58', '#9a6438', '#6c4228', '#44281a'];
const COP = ['#ffd0a0', '#e89a5c', '#c06a3a', '#884428', '#55281a'];
const FACE = ['#ffffff', '#fffaf0', '#fff2dc', '#ead6b4', '#c8ae8a'];
const INK = '#2a1a2e', THREAD = '#f0e0b0', AURA = '#b48cff';

// ----------------------------------------------------------------- sons (prefixo w3e_)
registerSfx('w3e_cork', [{ wave: 'square', freq: 900, freqEnd: 260, dur: 0.06, vol: 0.18 }, { wave: 'noise', freq: 2600, dur: 0.05, vol: 0.12 }]);
registerSfx('w3e_wind', { wave: 'square', freq: 1700, dur: 0.018, vol: 0.06 });
registerSfx('w3e_ring', [
  { wave: 'square', freq: 1568, dur: 0.55, vol: 0.1, vibrato: { rate: 28, depth: 1.2 } },
  { wave: 'triangle', freq: 2093, dur: 0.5, vol: 0.09, vibrato: { rate: 31, depth: 1 } },
]);
registerSfx('w3e_servo', { wave: 'sawtooth', freq: 110, freqEnd: 380, dur: 0.55, vol: 0.09, filter: { type: 'lowpass', freq: 900 } });
registerSfx('w3e_slam', [{ wave: 'triangle', freq: 150, freqEnd: 40, dur: 0.32, vol: 0.35 }, { wave: 'noise', freq: 700, freqEnd: 120, dur: 0.28, vol: 0.25 }]);
registerSfx('w3e_whirr', { wave: 'sawtooth', freq: 300, freqEnd: 900, dur: 0.32, vol: 0.06, vibrato: { rate: 22, depth: 0.8 } });
registerSfx('w3e_sand', { wave: 'noise', freq: 1800, freqEnd: 500, dur: 0.25, vol: 0.1 });
registerSfx('w3e_warp', { wave: 'sine', freq: 700, freqEnd: 220, dur: 0.35, vol: 0.12, vibrato: { rate: 9, depth: 0.6 } });
registerSfx('w3e_clank', [{ wave: 'square', freq: 520, freqEnd: 300, dur: 0.05, vol: 0.1 }, { wave: 'noise', freq: 3000, dur: 0.04, vol: 0.06 }]);

// ----------------------------------------------------------------- arte base
/** Cilindro metálico: faixas verticais (luz à esquerda). */
function cyl(pc, x, y, w, h, pal, hi = true) {
  for (let i = 0; i < w; i++) {
    const t = w > 1 ? i / (w - 1) : 0.5;
    pc.vline(x + i, y, h, pal[t < 0.16 ? 1 : t < 0.62 ? 2 : t < 0.86 ? 3 : 4]);
  }
  if (hi && w > 3 && h > 2) pc.vline(x + 1, y + 1, h - 2, pal[0]);
}
/** Engrenagem com dentes (ph = fase de rotação). */
function gear(pc, cx, cy, r, pal, ph = 0, teeth = 8) {
  for (let i = 0; i < teeth; i++) {
    const a = ph + (i / teeth) * Math.PI * 2;
    pc.rect(Math.round(cx + Math.cos(a) * r - 1), Math.round(cy + Math.sin(a) * r - 1), 2, 2, pal[i % 2 ? 3 : 2]);
  }
  puff(pc, cx, cy, r - 0.6, r - 0.6, pal, { fuzz: false, rough: 0.05 });
  pc.circle(cx - 0.5, cy - 0.5, Math.max(0.8, r * 0.28), pal[4]);
}

// ----------------------------------------------------------------- lentidão segura
class SlowFx extends Entity {
  constructor(level) {
    super(level, 0, 0);
    this.w = this.h = 1; this.z = 60;
    this.alwaysUpdate = this.alwaysDraw = true;
    this.src = new Map(); this.applied = 1; this.last = null; this.f = 1;
  }
  update(dt) {
    this.t += dt;
    let f = 1;
    for (const [k, s] of this.src) { s.t -= dt; if (s.t <= 0) this.src.delete(k); else f = Math.min(f, s.f); }
    const m = this.level.player?.mods;
    if (m) {
      // se alguém sobrescreveu mods.speed, o valor atual vira a nova base
      const base = this.last !== null && m.speed === this.last ? m.speed / this.applied : m.speed;
      m.speed = base * f; this.applied = f; this.last = m.speed;
    }
    this.f = f;
    if (f >= 1) { if (this.level.__w3slow === this) this.level.__w3slow = null; this.remove(); }
  }
  draw(ctx) { // reloginho girando sobre a cabeça do jogador
    const p = this.level.player;
    if (!p || this.f >= 1) return;
    const x = Math.round(p.cx), y = Math.round(p.y - 9 + Math.sin(this.t * 5));
    ctx.fillStyle = OUT1; ctx.fillRect(x - 4, y - 3, 9, 7); ctx.fillRect(x - 3, y - 4, 7, 9);
    ctx.fillStyle = '#9ff0ff'; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillRect(x - 2, y - 3, 5, 7);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 2, 1);
    ctx.fillStyle = OUT1; ctx.fillRect(x, y - 2, 1, 3);
    const a = this.t * 5;
    ctx.fillRect(x + Math.round(Math.cos(a) * 2), y + Math.round(Math.sin(a) * 2), 1, 1);
  }
}
/** Deixa o jogador lento (fator 0..1) por `dur` s. Fontes com a mesma chave se renovam; vale o menor fator. */
export function slowPlayer(level, key, factor, dur) {
  if (!level?.player) return;
  let fx = level.__w3slow;
  if (!fx || fx.dead) { fx = level.__w3slow = new SlowFx(level); level.add(fx); }
  const s = fx.src.get(key);
  if (s) { s.t = Math.max(s.t, dur); s.f = Math.min(s.f, factor); } else fx.src.set(key, { t: dur, f: factor });
}

/** Procura chão livre para um corpo w×h perto de (x, y). Retorna o novo y ou null. */
function findFloor(level, x, y, w, h) {
  const m = level.map, cx = x + w / 2;
  if (x < 2 || x + w > m.cols * TILE - 2) return null;
  let best = null;
  for (let r = Math.floor((y - 40) / TILE); r <= Math.floor((y + h + 56) / TILE); r++) {
    const fy = r * TILE - h;
    if (!m.solidAt(cx, r * TILE + 1) || !m.solidAt(x + 2, r * TILE + 1) || !m.solidAt(x + w - 2, r * TILE + 1)) continue;
    if (m.rectSolid(x, fy, w, h)) continue;
    if (best === null || Math.abs(fy - y) < Math.abs(best - y)) best = fy;
  }
  return best;
}

// ----------------------------------------------------------------- projéteis
class Cork extends EnemyProjectile {
  constructor(level, x, y, props) { super(level, x, y, { w: 7, h: 5, life: 2.2, color: '#c8955a', ...props }); }
  pop() {
    audio.sfx('w3e_cork', { pitch: 1.5, vol: 0.4 });
    this.level.particles.emit('hit', this.cx, this.cy, 4, { colors: ['#c8955a', '#fff4dc'] });
    this.remove();
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), r = this.reflected, d = this.vx < 0 ? -1 : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(d > 0 ? x - 6 : x + 8, y + 2, 5, 1);
    ctx.fillStyle = OUT1; ctx.fillRect(x - 1, y, 9, 5); ctx.fillRect(x, y - 1, 7, 7);
    ctx.fillStyle = r ? '#8ff0ff' : '#c8955a'; ctx.fillRect(x, y, 7, 5);
    ctx.fillStyle = r ? '#e0ffff' : '#e8bf86'; ctx.fillRect(x, y, 7, 2);
    ctx.fillStyle = r ? '#4ab8d0' : '#93643a'; ctx.fillRect(d > 0 ? x : x + 6, y, 1, 5);
    ctx.fillStyle = r ? '#2a7890' : '#6a4426'; ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + 5, y + 1, 1, 1);
  }
}

class SandOrb extends EnemyProjectile {
  constructor(level, x, y, props) { super(level, x, y, { w: 8, h: 8, life: 4.5, color: '#f6dc94', ...props }); }
  update(dt) {
    super.update(dt);
    if (!this.dead && Math.random() < dt * 25) this.level.particles.emit('dust', this.cx, this.cy, 1, { colors: this.reflected ? ['#8ff0ff'] : [SAND[1], SAND[2]] });
  }
  onTouchPlayer() { slowPlayer(this.level, 'sand', 0.7, 0.9); this.pop(); }
  pop() {
    audio.sfx('w3e_sand', { vol: 0.6 });
    this.level.particles.emit('dust', this.cx, this.cy, 6, { colors: [SAND[0], SAND[1], SAND[2]] });
    this.remove();
  }
  draw(ctx) {
    const x = Math.round(this.cx), y = Math.round(this.cy);
    const c = this.reflected ? ['#1e4a5a', '#4ab8d0', '#8ff0ff', '#e0ffff'] : [SAND[4], SAND[3], SAND[2], SAND[0]];
    ctx.fillStyle = c[0]; ctx.fillRect(x - 3, y - 5, 6, 10); ctx.fillRect(x - 5, y - 3, 10, 6); ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = c[1]; ctx.fillRect(x - 3, y - 4, 6, 8); ctx.fillRect(x - 4, y - 3, 8, 6);
    ctx.fillStyle = c[2]; ctx.fillRect(x - 3, y - 3, 5, 5);
    ctx.fillStyle = c[3]; ctx.fillRect(x - 2, y - 3, 2, 2);
    const a = this.t * 7;
    for (let i = 0; i < 3; i++) { const b = a + i * 2.1; ctx.fillRect(Math.round(x + Math.cos(b) * 6), Math.round(y + Math.sin(b) * 6), 1, 1); }
  }
}

/** Onda de choque que corre pelo chão (soco do robô). Some em paredes/beiradas. */
class SlamWave extends EnemyProjectile {
  constructor(level, x, y, props) { super(level, x, y, { w: 10, h: 9, life: 0.8, reflectable: false, solidStop: false, color: '#ffb060', ...props }); }
  update(dt) {
    this.t += dt; this.life -= dt;
    this.x += this.vx * dt;
    const m = this.level.map, fx = this.vx > 0 ? this.right + 1 : this.left - 1;
    if (this.life <= 0 || m.solidAt(fx, this.y + 3) || !m.solidAt(this.cx, this.bottom + 2)) { this.pop(); return; }
    if (Math.random() < dt * 30) this.level.particles.emit('dust', this.cx, this.bottom - 1, 1);
  }
  pop() { this.level.particles.emit('dust', this.cx, this.bottom - 2, 3); this.remove(); }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), d = this.vx > 0 ? 1 : -1;
    ctx.globalAlpha = Math.min(1, this.life * 4);
    for (let i = 0; i < 10; i++) {
      const k = i / 9, hgt = Math.max(1, Math.round(2 + 7 * k * k * (0.85 + 0.15 * Math.sin(this.t * 40 + i))));
      const xx = d > 0 ? x + i : x + 9 - i;
      ctx.fillStyle = '#6a3018'; ctx.fillRect(xx, y + 9 - hgt, 1, hgt);
      ctx.fillStyle = k > 0.8 ? '#fff2c0' : '#ffb060'; ctx.fillRect(xx, y + 9 - hgt, 1, Math.max(1, hgt - 3));
    }
    ctx.fillStyle = '#c87a40';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + ((i * 7 + Math.floor(this.t * 30)) % 10), y - 2 - ((i * 3 + Math.floor(this.t * 20)) % 4), 1, 1);
    ctx.globalAlpha = 1;
  }
}

// =============================================================================
// a — w3_tinsoldier: soldadinho de chumbo de corda
// =============================================================================
function soldier(pc, o = {}) {
  const b = o.bob || 0, aim = o.aim || 0, hurt = !!o.hurt;
  // chave de corda nas costas (gira: larguras diferentes)
  const kw = [3, 2, 1, 2][(o.key || 0) & 3];
  pc.rect(4, 16 + b, 3, 1, BRASS[3]);
  pc.rect(4 - kw, 13 + b, kw, 3, BRASS[1]); pc.rect(4 - kw, 17 + b, kw, 3, BRASS[2]);
  pc.px(4 - kw, 13 + b, BRASS[0]);
  // pernas (calça azul, bota preta)
  const L = o.leg == null ? [0, 0, 0, 0] : [[1, 0, -1, 1], [0, 0, 0, 0], [-1, 1, 1, 0], [0, 0, 0, 0]][o.leg & 3];
  const legAt = (x, lift, back) => {
    cyl(pc, x, 21 - lift, 3, 4, back ? [NAVY[2], NAVY[3], NAVY[3], NAVY[4], NAVY[4]] : NAVY, false);
    pc.rect(x, 25 - lift, 4, 3, back ? '#151020' : '#241c30'); pc.hline(x, 25 - lift, 3, back ? '#2a2238' : '#4a3e5c');
  };
  legAt(8 + L[2], L[3], true); legAt(11 + L[0], L[1], false);
  // casaco vermelho com talabartes
  const y0 = 13 + b;
  cyl(pc, 7, y0, 9, 8, COAT);
  pc.hline(6, y0 + 7, 11, COAT[3]);
  pc.line(8, y0 + 1, 14, y0 + 6, '#f4ece0'); pc.line(14, y0 + 1, 8, y0 + 6, '#f4ece0');
  pc.rect(10, y0 + 3, 3, 2, BRASS[1]); pc.px(10, y0 + 3, BRASS[0]);
  pc.hline(7, y0, 9, BRASS[2]);
  pc.rect(6, y0, 2, 2, BRASS[1]); pc.rect(15, y0, 2, 2, BRASS[2]);
  // cabeça pintada
  const hy = 8 + b + (hurt ? 1 : 0);
  cyl(pc, 8, hy, 7, 5, SKIN, false);
  pc.px(9, hy + 2, '#ff8a8a'); pc.px(14, hy + 2, '#ff8a8a');
  if (hurt) { pc.hline(10, hy + 1, 2, INK); pc.hline(13, hy + 1, 2, INK); pc.px(12, hy + 3, INK); }
  else {
    pc.px(11, hy + 1, INK); pc.px(13, hy + 1, INK);
    pc.hline(10, hy + 3, 5, '#3a2418'); pc.px(10, hy + 4, '#3a2418'); pc.px(14, hy + 4, '#3a2418');
  }
  // chapéu alto (barretina) com placa e pompom
  const tx = hurt ? 7 : 8, ty = 1 + b + (hurt ? 1 : 0);
  cyl(pc, tx, ty + 1, 7, 6, HAT);
  pc.hline(tx - 1, ty + 7, 9, HAT[4]);
  pc.rect(tx + 4, ty + 3, 2, 2, BRASS[1]); pc.px(tx + 4, ty + 3, BRASS[0]);
  pc.rect(tx + 2, ty - 1, 3, 2, COAT[1]); pc.px(tx + 2, ty - 1, COAT[0]);
  pc.vline(8, hy, 4, BRASS[3]);
  // fuzil de rolha
  if (aim === 0) { // ombro-armas
    pc.vline(17, 4 + b, 12, TIN[2]); pc.vline(18, 4 + b, 12, TIN[3]); pc.px(17, 3 + b, TIN[0]);
    pc.rect(17, 15 + b, 2, 5, WOOD[2]); pc.px(17, 15 + b, WOOD[1]);
    pc.rect(15, y0 + 2, 2, 3, COAT[3]); pc.rect(16, y0 + 4, 2, 2, SKIN[1]);
  } else if (aim === 1) { // baixando
    pc.thickLine(11, 19 + b, 15, 15 + b, 0.9, WOOD[2]);
    pc.line(15, 15 + b, 21, 9 + b, TIN[2]); pc.line(16, 15 + b, 22, 9 + b, TIN[3]);
    pc.rect(13, y0 + 2, 3, 2, COAT[3]); pc.px(15, y0 + 4, SKIN[1]);
  } else { // apontado
    const r = o.recoil ? -1 : 0;
    pc.rect(9 + r, 15 + b, 6, 2, WOOD[2]); pc.hline(9 + r, 15 + b, 6, WOOD[1]);
    pc.hline(15 + r, 15 + b, 8, TIN[1]); pc.hline(15 + r, 16 + b, 8, TIN[3]); pc.px(22 + r, 15 + b, TIN[0]);
    pc.rect(12, y0 + 1, 3, 2, COAT[3]); pc.px(14 + r, 17 + b, SKIN[1]); pc.px(18 + r, 17 + b, SKIN[1]);
    if (o.cork) { pc.rect(22 + r, 14 + b, 2, 3, '#c8955a'); pc.px(22 + r, 14 + b, '#e8bf86'); }
  }
}
defineSprite('w3_tinsoldier', {
  w: 24, h: 28, ox: 11, oy: 28,
  anims: { idle: { frames: 2, fps: 3 }, move: { frames: 4, fps: 8 }, windup: { frames: 4, fps: 8, loop: false }, attack: { frames: 2, fps: 8, loop: false }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') soldier(pc, { key: f });
    else if (anim === 'move') soldier(pc, { leg: f, key: f, bob: f & 1 ? 0 : -1 });
    else if (anim === 'windup') soldier(pc, { key: f * 2 + 1, aim: f < 1 ? 1 : 2, cork: f >= 2 });
    else if (anim === 'attack') soldier(pc, { key: 2, aim: 2, recoil: f === 0 });
    else soldier(pc, { key: f, hurt: true, aim: 1 });
    pc.outline(OUT1);
  },
});

class TinSoldier extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w3_tinsoldier'; this.teleColor = '#fff3a0';
    this.w = 10; this.h = 22; this.alignToCell(x, y);
    this.hp = this.maxHp = 2;
    this.drops = { buttons: 3, heart: 0.06, energy: 0.2 };
    this.fabricColors = [COAT[2], TIN[1], BRASS[1]];
    this.deathSfx = 'w3e_clank';
    this.speed = 26; this.shotCool = 0.6; this.tick = -1;
    this.go('march');
  }
  think(dt) {
    this.stT += dt; this.shotCool -= dt;
    const p = this.target();
    const sees = this.canSee(p, 150) && Math.abs(p.cy - this.cy) < 30;
    const ahead = Math.sign(p.cx - this.cx) === this.facing;
    switch (this.state) {
      case 'march':
        this.setAnim('move'); this.patrol(this.speed, dt);
        if (sees && this.shotCool <= 0 && (ahead || this.stT > 0.8)) { this.faceTarget(p); this.vx = 0; this.tick = -1; this.go('aim'); }
        else if (this.stT > 2.6 + (this.id % 3) * 0.5) this.go('halt');
        break;
      case 'halt': // sentido! olha em volta
        this.vx = 0; this.setAnim('idle');
        if (this.stT > 0.7) { if (sees) this.faceTarget(p); this.go('march'); }
        break;
      case 'aim': { // telégrafo: a corda gira cada vez mais rápido e o fuzil desce
        this.vx = 0; this.setAnim('windup'); this.tele(this.stT > 0.28);
        const k = Math.floor(this.stT / 0.09);
        if (k !== this.tick) { this.tick = k; audio.sfx('w3e_wind', { pitch: 1 + k * 0.12 }); }
        if (this.stT > 0.5) { this.teleOn = false; this.fire(p); this.go('fire'); }
        break;
      }
      case 'fire':
        this.vx *= 0.8; this.setAnim('attack');
        if (this.stT > 0.35) this.go('unwind');
        break;
      case 'unwind': // corda frouxa: parado e indefeso
        this.vx = 0; this.setAnim('idle');
        if (this.stT > 0.8) { this.shotCool = 0.9; this.go('march'); }
        break;
    }
    this.physics(dt);
  }
  fire(p) {
    const mx = this.cx + this.facing * 12, my = this.bottom - 12.5;
    const vy = clamp((p.cy - my) / Math.max(40, Math.abs(p.cx - mx)), -0.3, 0.3) * 165;
    this.level.add(new Cork(this.level, mx, my, { vx: this.facing * 165, vy }));
    audio.sfx('w3e_cork');
    this.level.particles.emit('smoke', mx, my, 3);
    this.vx = -this.facing * 40;
  }
  draw(ctx) {
    this.drawBody(ctx);
    if (this.state === 'fire' && this.stT < 0.07 && !this.dying) { // clarão do tiro
      const x = Math.round(this.cx + this.facing * 13), y = Math.round(this.bottom - 13);
      ctx.fillStyle = '#fff3a0'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 3, 3);
    }
    this.drawStatus(ctx);
  }
}
registerEntity('w3_tinsoldier', TinSoldier);

// =============================================================================
// b — w3_livingclock: despertador vivo
// =============================================================================
function alarm(pc, o = {}) {
  const cx = 12, cy = 15 + (o.sq || 0), ring = !!o.ring, f = o.f || 0;
  const lf = o.legs == null ? [0, 0] : [[0, 0], [-1, 1], [0, 0], [1, -1]][o.legs & 3];
  pc.line(8, 21, 7 + lf[0], 24, BRASS[3]); pc.line(16, 21, 17 + lf[1], 24, BRASS[3]);
  pc.rect(5 + lf[0], 24, 4, 2, BRASS[2]); pc.hline(5 + lf[0], 24, 3, BRASS[1]);
  pc.rect(16 + lf[1], 24, 4, 2, BRASS[2]); pc.hline(16 + lf[1], 24, 3, BRASS[1]);
  // sinos + martelinho
  const rv = ring ? (f & 1 ? 1 : -1) : 0;
  for (const s of [-1, 1]) {
    const bx = cx + 0.5 + s * 6 + (ring ? s * (f & 1) : 0), by = 6 - (ring ? 1 : 0);
    puff(pc, bx, by, 3.8, 3.4, BRASS, { ymax: by + 1, fuzz: false, rough: 0.05 });
    pc.hline(Math.round(bx - 4), by + 1, 8, BRASS[3]);
    pc.px(Math.round(bx - 0.5), by - 4, BRASS[2]);
  }
  pc.vline(cx, 2, 5, TIN[3]); pc.rect(cx - 1 + rv, 1, 3, 2, TIN[1]);
  // corpo e mostrador
  puff(pc, cx + 0.5, cy + 0.5, 8.5, 8, BRASS, { fuzz: false, rough: 0.06 });
  puff(pc, cx + 0.5, cy + 0.5, 6.4, 6, FACE, { fuzz: false, rough: 0.03 });
  pc.px(cx, cy - 5, INK); pc.px(cx + 6, cy, INK); pc.px(cx, cy + 6, INK); pc.px(cx - 5, cy, INK);
  const a = (o.hand || 0) * (Math.PI / 2) - Math.PI / 2;
  pc.line(cx, cy, Math.round(cx + Math.cos(a) * 4), Math.round(cy + Math.sin(a) * 4), '#d04a5a');
  if (o.hurt) {
    pc.px(cx - 3, cy - 3, INK); pc.px(cx - 2, cy - 2, INK); pc.px(cx - 3, cy - 1, INK);
    pc.px(cx + 3, cy - 3, INK); pc.px(cx + 2, cy - 2, INK); pc.px(cx + 3, cy - 1, INK);
    pc.line(cx - 5, cy - 3, cx - 1, cy + 1, '#8a96b0'); pc.line(cx - 1, cy + 1, cx + 4, cy + 2, '#8a96b0');
  } else {
    pc.rect(cx - 3, cy - 2, 2, 2, INK); pc.px(cx - 3, cy - 2, '#ffffff');
    pc.rect(cx + 2, cy - 2, 2, 2, INK); pc.px(cx + 2, cy - 2, '#ffffff');
    if (o.angry) { pc.line(cx - 4, cy - 4, cx - 2, cy - 3, INK); pc.line(cx + 4, cy - 4, cx + 2, cy - 3, INK); }
  }
  if (o.mouth) { pc.rect(cx - 2, cy + 2, 5, 3, '#5a1a2a'); pc.hline(cx - 2, cy + 2, 5, '#ffffff'); pc.px(cx, cy + 4, '#ff6a7a'); }
  else if (!o.hurt) { pc.hline(cx - 1, cy + 3, 3, INK); pc.px(cx - 2, cy + 2, INK); pc.px(cx + 2, cy + 2, INK); }
  pc.px(cx, cy, INK);
  if (o.waves) for (const s of [-1, 1]) {
    const x = s < 0 ? 1 : 22;
    pc.vline(x, cy - 2, 5, '#fff3a0'); pc.px(x - s, cy - 3, '#fff3a0'); pc.px(x - s, cy + 3, '#fff3a0');
  }
}
defineSprite('w3_livingclock', {
  w: 24, h: 26, ox: 12, oy: 26,
  anims: { idle: { frames: 4, fps: 4 }, move: { frames: 4, fps: 10 }, windup: { frames: 4, fps: 14 }, attack: { frames: 4, fps: 16 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') alarm(pc, { hand: f, sq: f & 1 ? 0 : 0 });
    else if (anim === 'move') alarm(pc, { legs: f, hand: f, sq: f === 0 ? 1 : 0 });
    else if (anim === 'windup') alarm(pc, { ring: true, f, angry: true, hand: f, sq: 1 });
    else if (anim === 'attack') alarm(pc, { ring: true, f, angry: true, mouth: true, waves: f & 1, hand: f });
    else alarm(pc, { hurt: true, hand: 2, sq: f });
    pc.outline(OUT1);
  },
});

const RING_R = 58;
class LivingClock extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w3_livingclock';
    this.w = 14; this.h = 16; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 3, heart: 0.08, energy: 0.25 };
    this.fabricColors = [BRASS[1], FACE[2], '#d04a5a'];
    this.deathSfx = 'w3e_clank';
    this.ringCool = 0.6; this.tpCool = 1.5; this.ringT = -1; this.escape = false;
    this.go('idle');
  }
  onHurt(n, src) {
    super.onHurt();
    if (this.hp > 0 && this.tpCool <= 0 && this.state !== 'blink' && Math.random() < 0.6) { this.escape = true; this.go('blink'); }
  }
  think(dt) {
    this.stT += dt; this.ringCool -= dt; this.tpCool -= dt;
    if (this.ringT >= 0) { this.ringT += dt; if (this.ringT > 0.5) this.ringT = -1; }
    const p = this.target();
    const sees = this.canSee(p, 170);
    const adx = Math.abs(p.cx - this.cx);
    switch (this.state) {
      case 'idle':
        this.setAnim('idle'); this.vx *= 0.8;
        if (this.stT > 0.3 && sees) { this.faceTarget(p); this.escape = false; this.go(adx > 110 && this.tpCool <= 0 ? 'blink' : 'hop'); }
        break;
      case 'hop':
        if (this.grounded) {
          this.vx = 0; this.setAnim('idle');
          if (!sees) { this.go('idle'); break; }
          this.faceTarget(p);
          if (adx < 52 && Math.abs(p.cy - this.cy) < 40 && this.ringCool <= 0) { this.go('windup'); break; }
          if (adx > 120 && this.tpCool <= 0) { this.escape = false; this.go('blink'); break; }
          if (this.stT > 0.35) { this.vy = -175; this.vx = this.facing * (adx < 30 ? 20 : 62); this.stT = 0; audio.sfx('en_hop', { pitch: 1.4 }); }
        } else this.setAnim('move');
        break;
      case 'windup': // sinos tremendo (~0.45 s)
        this.vx = 0; this.setAnim('windup'); this.tele();
        if (Math.floor(this.stT * 14) !== Math.floor((this.stT - dt) * 14)) audio.sfx('w3e_wind', { pitch: 2 });
        if (this.stT > 0.45) { this.teleOn = false; this.ring(); this.go('ring'); }
        break;
      case 'ring':
        this.vx = 0; this.setAnim('attack');
        if (this.stT > 0.6) { this.ringCool = 2.4; this.go('hop'); }
        break;
      case 'blink': // tique-taque piscando (~0.4 s) e some
        this.vx = 0; this.setAnim('windup');
        if (Math.floor(this.stT / 0.1) !== Math.floor((this.stT - dt) / 0.1)) audio.sfx('clock_tick', { pitch: Math.floor(this.stT / 0.1) % 2 ? 0.8 : 1.25 });
        if (this.stT > 0.4) { this.teleport(p); this.go('appear'); }
        break;
      case 'appear':
        this.vx = 0; this.setAnim('idle');
        if (this.stT > 0.25) this.go('hop');
        break;
    }
    this.physics(dt);
  }
  ring() {
    const L = this.level;
    this.ringT = 0;
    audio.sfx('w3e_ring'); audio.sfx('clock_chime', { vol: 0.5 });
    spawnShockwave(L, this.cx, this.cy, { radius: RING_R, color: '#ffe27a', color2: '#ffffff', dur: 0.45, thickness: 3 });
    L.shake(0.12);
    const p = L.player;
    if (p && !p.hidden && Math.hypot(p.cx - this.cx, p.cy - this.cy) < RING_R + 4) {
      slowPlayer(L, 'ring', 0.5, 1.5);
      L.particles.emit('sparkle', p.cx, p.cy, 6, { colors: ['#9ff0ff', '#ffffff'] });
    }
  }
  teleport(p) {
    const L = this.level;
    L.particles.emit('sparkle', this.cx, this.cy, 8, { colors: [BRASS[0], '#ffffff'] });
    const dist = Math.abs(p.cx - this.cx);
    const dir = this.escape ? (Math.sign(this.cx - p.cx) || 1) : (Math.sign(p.cx - this.cx) || 1);
    const want = this.escape ? [60, 76, 44, -60, -44] : [dist - 44, dist - 64, 56, 36];
    for (const d of want) {
      const nx = this.x + dir * clamp(d, -80, 96);
      const ny = findFloor(L, nx, this.y, this.w, this.h);
      if (ny !== null) { this.x = nx; this.y = ny; this.vx = this.vy = 0; break; }
    }
    this.tpCool = 3.2; this.escape = false; this.faceTarget(p);
    audio.sfx('w3e_warp');
    L.particles.emit('sparkle', this.cx, this.cy, 8, { colors: [BRASS[0], '#ffffff'] });
  }
  draw(ctx) {
    const extra = {};
    if (this.state === 'blink' && !this.dying) { // tique-taque: pisca e encolhe
      extra.variant = Math.floor(this.stT / 0.1) % 2 ? 'flash' : undefined;
      extra.scaleX = 1 - this.stT * 0.8; extra.scaleY = 1 + this.stT * 0.5;
    } else if (this.state === 'appear' && !this.dying) {
      const k = Math.min(1, this.stT / 0.25);
      extra.scaleX = 0.5 + 0.5 * k; extra.scaleY = 1.4 - 0.4 * k;
    }
    this.drawBody(ctx, extra);
    if ((this.state === 'blink' || this.state === 'appear') && !this.dying) { // marcas de relógio girando
      const k = this.state === 'blink' ? this.stT / 0.4 : 1 - this.stT / 0.25;
      const r = 8 + 10 * (1 - k), cx = this.cx, cy = this.cy - 2;
      ctx.fillStyle = '#fff3a0';
      for (let i = 0; i < 12; i++) {
        const a = i * (Math.PI / 6) + this.t * 3;
        ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
    }
    this.drawStatus(ctx);
  }
}
registerEntity('w3_livingclock', LivingClock);

// =============================================================================
// d — w3_rustbot: robô enferrujado blindado
// =============================================================================
function rustbot(pc, o = {}) {
  const b = o.bob || 0, red = !!o.red;
  const st = o.step == null ? [0, 0] : [[0, 0], [1, -1], [0, 0], [-1, 1]][o.step & 3];
  cyl(pc, 11 + st[0], 27, 4, 4, RUST, false); cyl(pc, 19 + st[1], 27, 4, 4, RUST, false);
  pc.rect(9 + st[0], 31, 8, 3, RUST[4]); pc.hline(10 + st[0], 31, 6, RUST[2]);
  pc.rect(17 + st[1], 31, 8, 3, RUST[4]); pc.hline(18 + st[1], 31, 6, RUST[2]);
  // tronco
  const ty = 13 + b;
  cyl(pc, 8, ty, 18, 14, RUST);
  pc.hline(8, ty, 18, RUST[1]); pc.hline(8, ty + 13, 18, RUST[4]);
  for (const [x, y] of [[10, 11], [22, 2], [24, 10], [9, 3]]) { pc.px(x, ty + y, RUST[4]); pc.px(x + 1, ty + y, '#5a7a5a'); }
  // cabeça com visor
  const hy = 4 + b, ec = red ? '#ff4a3a' : '#ffc84a', lk = o.look || 0;
  cyl(pc, 11, hy, 12, 9, RUST);
  pc.hline(11, hy, 12, RUST[1]);
  pc.rect(12, hy + 3, 10, 3, '#1e0e10');
  pc.hline(13 + lk * 2, hy + 4, 4, ec); pc.px(14 + lk * 2, hy + 4, '#ffffff');
  for (let i = 0; i < 4; i++) pc.px(13 + i * 2, hy + 7, RUST[4]);
  pc.vline(17, hy - 3, 3, TIN[3]); pc.rect(16, hy - 4, 3, 2, ec);
  // placas remendadas (armadura) ou peito aberto
  if (o.plates) {
    const plate = (x, y, w, h) => {
      pc.rect(x, y, w, h, STEEL[2]); pc.hline(x, y, w, STEEL[1]); pc.vline(x, y, h, STEEL[1]);
      pc.hline(x, y + h - 1, w, STEEL[3]); pc.vline(x + w - 1, y, h, STEEL[3]);
      pc.px(x + 1, y + 1, STEEL[0]); pc.px(x + w - 2, y + h - 2, STEEL[4]);
      for (let i = 1; i < w - 1; i += 2) { pc.px(x + i, y - 1, THREAD); pc.px(x + i, y + h, THREAD); }
      for (let j = 1; j < h - 1; j += 2) { pc.px(x - 1, y + j, THREAD); pc.px(x + w, y + j, THREAD); }
    };
    plate(10, ty + 2, 9, 8); plate(20, ty + 4, 4, 6); plate(13, hy + 1, 6, 2);
  } else {
    pc.rect(11, ty + 3, 11, 8, '#1e0e10');
    for (let i = 11; i < 22; i += 2) { pc.px(i, ty + 2, RUST[1]); pc.px(i + 1, ty + 11, RUST[3]); }
    gear(pc, 15.5, ty + 7.5, 3.4, BRASS, o.ph || 0);
    gear(pc, 20, ty + 5.5, 2.2, BRASS, -(o.ph || 0), 6);
    pc.line(12, ty + 10, 21, ty + 9, '#d04a5a'); pc.px(21, ty + 9, '#ffe27a');
  }
  // braços com punhos (0 repouso, 1 subindo, 2 no alto, 3 soco no chão)
  const FP = [[[5, 23], [29, 23]], [[5, 10], [29, 10]], [[8, 3], [26, 3]], [[4, 30], [30, 30]]][o.arms || 0];
  const SH = [[7, ty + 2], [27, ty + 2]];
  for (let i = 0; i < 2; i++) {
    const [sx, sy] = SH[i], [fx, fy] = FP[i];
    pc.thickLine(sx, sy, fx, fy, 1.3, RUST[3]); pc.line(sx, sy - 1, fx, fy - 1, RUST[2]);
    pc.rect(fx - 2, fy - 2, 5, 5, RUST[2]); pc.hline(fx - 2, fy - 2, 5, RUST[1]);
    pc.vline(fx + 2, fy - 2, 5, RUST[3]); pc.hline(fx - 1, fy + 1, 3, RUST[4]);
    if (o.plates) { pc.rect(sx - 2, sy - 2, 4, 3, STEEL[2]); pc.hline(sx - 2, sy - 2, 4, STEEL[1]); }
  }
  if (o.hurt) { pc.line(12, hy + 3, 21, hy + 5, '#ffffff'); }
}
for (const [name, plates] of [['w3_rustbot', true], ['w3_rustbot_bare', false]]) {
  defineSprite(name, {
    w: 34, h: 34, ox: 17, oy: 34,
    anims: { idle: { frames: 2, fps: 2 }, move: { frames: 4, fps: 6 }, windup: { frames: 3, fps: 6, loop: false }, attack: { frames: 2, fps: 8, loop: false }, hurt: { frames: 2, fps: 10 } },
    draw(pc, anim, f) {
      const ph = f * 0.4;
      if (anim === 'idle') rustbot(pc, { plates, look: f, ph });
      else if (anim === 'move') rustbot(pc, { plates, step: f, bob: f & 1 ? 1 : 0, ph });
      else if (anim === 'windup') rustbot(pc, { plates, arms: f === 0 ? 1 : 2, red: true, bob: -1, ph });
      else if (anim === 'attack') rustbot(pc, { plates, arms: 3, red: true, bob: 1 + f, ph });
      else rustbot(pc, { plates, hurt: true, bob: f, ph, red: true });
      pc.outline(OUT1);
    },
  });
}

class RustBot extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.armored = props.armored ?? true;
    this.sprite = this.armored ? 'w3_rustbot' : 'w3_rustbot_bare'; this.teleColor = '#ff7a4a';
    this.w = 20; this.h = 28; this.alignToCell(x, y);
    this.hp = this.maxHp = 4;
    this.speed = this.armored ? 15 : 22; this.slamCool = 1;
    this.drops = { buttons: 5, heart: 0.15, energy: 0.3 };
    this.fabricColors = [RUST[2], STEEL[2], THREAD];
    this.deathSfx = 'w3e_slam';
    this.go('walk');
  }
  unstitch(player) {
    if (!super.unstitch(player)) return false;
    this.sprite = 'w3_rustbot_bare'; this.speed = 22;
    this.level.particles.emit('hit', this.cx, this.cy, 10, { colors: [STEEL[1], STEEL[2], THREAD] });
    audio.sfx('w3e_clank', { pitch: 0.7 });
    return true;
  }
  think(dt) {
    this.stT += dt; this.slamCool -= dt;
    const p = this.target();
    switch (this.state) {
      case 'walk':
        this.setAnim('move'); this.patrol(this.speed, dt);
        if (this.slamCool <= 0 && Math.abs(p.cx - this.cx) < 60 && Math.abs(p.bottom - this.bottom) < 40 && this.canSee(p, 110)) {
          this.faceTarget(p); this.go('windup'); audio.sfx('w3e_servo');
        }
        break;
      case 'windup': // ergue os punhos, vapor, olho vermelho (~0.6 s)
        this.vx = 0; this.setAnim('windup'); this.tele(this.stT > 0.3);
        if (Math.random() < dt * 14) this.level.particles.emit('smoke', this.cx + rand(-8, 8), this.y + 2, 1);
        if (this.stT > 0.6) { this.teleOn = false; this.slam(); this.go('slam'); }
        break;
      case 'slam':
        this.vx = 0; this.setAnim('attack');
        if (this.stT > 0.3) this.go('recover');
        break;
      case 'recover': // ofegante: brecha para atacar
        this.vx = 0; this.setAnim('idle');
        if (Math.random() < dt * 6) this.level.particles.emit('smoke', this.cx, this.y + 2, 1);
        if (this.stT > 0.9) { this.slamCool = 1.4; this.go('walk'); }
        break;
    }
    this.physics(dt);
  }
  slam() {
    const L = this.level;
    audio.sfx('w3e_slam'); L.shake(0.3);
    L.particles.emit('dust', this.cx - 13, this.bottom - 1, 5); L.particles.emit('dust', this.cx + 13, this.bottom - 1, 5);
    for (const d of [-1, 1]) L.add(new SlamWave(L, this.cx + d * 14, this.bottom - 4.5, { vx: d * 135 }));
  }
  draw(ctx) {
    this.drawBody(ctx);
    if (!this.armored && !this.dying && Math.floor(this.t * 3) % 4 === 0 && Math.random() < 0.3) { // faíscas do peito aberto
      ctx.fillStyle = '#ffe27a';
      ctx.fillRect(Math.round(this.cx + rand(-4, 4)), Math.round(this.y + 8 + rand(0, 6)), 1, 1);
    }
    this.drawStatus(ctx);
  }
}
registerEntity('w3_rustbot', RustBot);

// =============================================================================
// f — w3_timewarper: ampulheta flutuante com aura lenta
// =============================================================================
function hourglass(pc, o = {}) {
  const cx = 11, sand = o.sand ?? 0.6, glow = !!o.glow, f = o.f || 0;
  // braços-ponteiros saindo das hastes
  const ar = o.arms || 0;
  pc.line(2, 13, 0, 10 - ar, BRASS[2]); pc.px(0, 9 - ar, BRASS[1]);
  pc.line(19, 13, 21, 16 + ar, BRASS[2]); pc.px(21, 17 + ar, BRASS[1]);
  // hastes
  pc.vline(2, 3, 22, WOOD[2]); pc.vline(19, 3, 22, WOOD[3]);
  // vidro (bulbos)
  const hw = (y) => { const t = y <= 13 ? (13 - y) / 9 : (y - 14) / 9; return Math.max(1, Math.round(1 + 5.2 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))))); };
  for (let y = 4; y <= 23; y++) {
    const w = hw(y);
    for (let x = cx - w + 1; x <= cx + w; x++) pc.px(x, y, '#c8ecff40');
    pc.px(cx - w, y, '#e8f8ff'); pc.px(cx + w + 1, y, '#8ab8d0');
  }
  // areia de cima (diminui) e monte de baixo (cresce)
  const sc = glow ? [SAND[0], '#ffffff', SAND[1]] : [SAND[1], SAND[2], SAND[3]];
  const top = 13 - Math.round(sand * 8);
  for (let y = top; y <= 13; y++) {
    const w = hw(y) - (y === top ? 1 : 0);
    for (let x = cx - w + 1; x <= cx + w; x++) pc.px(x, y, x < cx - w / 3 ? sc[0] : x > cx + w / 2 ? sc[2] : sc[1]);
  }
  const hp = Math.round((1 - sand) * 6) + 1;
  for (let y = 24 - hp; y <= 23; y++) {
    const w = Math.min(hw(y), 1 + (y - (24 - hp)) * 2);
    for (let x = cx - w + 1; x <= cx + w; x++) pc.px(x, y, x < cx - w / 3 ? sc[0] : x > cx + w / 2 ? sc[2] : sc[1]);
  }
  for (let y = 14 + (f & 1); y < 24 - hp; y += 2) pc.px(cx + (y & 1), y, sc[0]);
  // tampas de madeira com friso de latão
  cyl(pc, 1, 1, 20, 3, WOOD); cyl(pc, 1, 24, 20, 3, WOOD);
  pc.hline(1, 3, 20, BRASS[2]); pc.hline(1, 24, 20, BRASS[2]);
  pc.px(1, 0, WOOD[3]); pc.px(20, 0, WOOD[3]); pc.px(1, 27, WOOD[3]); pc.px(20, 27, WOOD[3]);
  // rostinho no bulbo de cima (olhos roxos brilhando)
  const ec = glow ? '#ffffff' : '#d8b8ff';
  pc.rect(cx - 3, 7, 2, 2, AURA); pc.px(cx - 3, 7, ec);
  pc.rect(cx + 2, 7, 2, 2, AURA); pc.px(cx + 2, 7, ec);
  if (o.mouth) { pc.rect(cx - 1, 10, 4, 2, '#3a1a5a'); pc.px(cx, 10, '#ffffff'); }
  else { pc.hline(cx - 1, 10, 3, '#3a1a5a'); pc.px(cx + 1, 11, '#ffffff'); }
  if (o.hurt) { pc.line(cx - 4, 5, cx + 1, 10, '#ffffff'); pc.line(cx + 1, 10, cx + 4, 9, '#ffffff'); pc.line(cx - 3, 18, cx + 2, 21, '#ffffff'); }
}
defineSprite('w3_timewarper', {
  w: 22, h: 28, ox: 11, oy: 14,
  anims: { idle: { frames: 4, fps: 5 }, move: { frames: 4, fps: 8 }, windup: { frames: 2, fps: 10 }, attack: { frames: 2, fps: 10 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle' || anim === 'move') hourglass(pc, { sand: 0.7 - f * 0.05, f, arms: f & 1 });
    else if (anim === 'windup') hourglass(pc, { sand: 0.5, f, glow: true, arms: 2 });
    else if (anim === 'attack') hourglass(pc, { sand: 0.35, f, glow: f === 0, mouth: true, arms: 3 });
    else hourglass(pc, { sand: 0.5, f, hurt: true });
    pc.outline(OUT1);
  },
});

class TimeWarper extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w3_timewarper'; this.flying = true; this.centerPivot = true; this.teleColor = '#e0c0ff';
    this.w = 14; this.h = 20; this.x = x + 1; this.y = y - 2;
    this.homeX = this.cx; this.homeY = this.cy;
    this.hp = this.maxHp = 2;
    this.drops = { buttons: 3, heart: 0.1, energy: 0.3 };
    this.fabricColors = [SAND[1], '#c8ecff', AURA];
    this.deathSfx = 'w3e_warp';
    this.shotT = 1.2; this.rot = 0; this.auraR = props.aura ?? 52;
    this.go('float');
  }
  steer(tx, ty, sp, dt) {
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 24);
    this.vx = approach(this.vx, (dx / d) * sp * k, 240 * dt);
    this.vy = approach(this.vy, (dy / d) * sp * k, 240 * dt);
  }
  think(dt) {
    this.stT += dt; this.shotT -= dt;
    const p = this.target(), pl = this.level.player;
    if (pl && !pl.hidden && Math.hypot(pl.cx - this.cx, pl.cy - this.cy) < this.auraR) slowPlayer(this.level, 'aura', 0.55, 0.12);
    const dx = p.cx - this.cx, d = Math.hypot(dx, p.cy - this.cy);
    const sees = this.canSee(p, 180);
    const near = sees && d < 78;
    let tx = this.homeX, ty = this.homeY + Math.sin(this.t * 2) * 6;
    if (near) { // foge mantendo distância (preso à área de casa)
      tx = clamp(this.cx - (Math.sign(dx) || 1) * 60, this.homeX - 96, this.homeX + 96);
      ty = clamp(this.cy - 16, this.homeY - 32, this.homeY + 8);
    }
    switch (this.state) {
      case 'float':
        this.setAnim(near ? 'move' : 'idle');
        this.steer(tx, ty, near ? 88 : 40, dt);
        if (sees) this.faceTarget(p);
        if (sees && this.shotT <= 0 && d < 170) { this.go('flip'); audio.sfx('w3e_warp', { pitch: 1.5 }); }
        break;
      case 'flip': // vira a ampulheta (~0.45 s)
        this.setAnim('windup'); this.tele(this.stT > 0.2);
        this.steer(tx, ty, 25, dt);
        this.rot = Math.PI * Math.min(1, this.stT / 0.45);
        if (this.stT > 0.45) { this.rot = 0; this.teleOn = false; this.shoot(p); this.go('cast'); }
        break;
      case 'cast':
        this.setAnim('attack'); this.steer(tx, ty, 25, dt);
        if (this.stT > 0.35) { this.shotT = near ? 1.6 : 2.3; this.go('float'); }
        break;
    }
    this.physics(dt, { noGravity: true });
  }
  shoot(p) {
    const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    this.level.add(new SandOrb(this.level, this.cx + Math.cos(a) * 9, this.cy + Math.sin(a) * 9, { vx: Math.cos(a) * 72, vy: Math.sin(a) * 72 }));
    audio.sfx('w3e_sand');
  }
  drawAura(ctx) {
    const R = this.auraR, cx = Math.round(this.cx), cy = Math.round(this.cy), pa = ctx.globalAlpha;
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 3);
    ctx.globalAlpha = pa * 0.15 * pulse;
    ctx.fillStyle = '#9ff0ff'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    const n = 96, a0 = this.t * 0.6;
    for (let i = 0; i < n; i++) { // borda tracejada dupla girando (mostrador)
      if (i % 6 === 5) continue;
      const a = a0 + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      ctx.globalAlpha = pa * 0.9 * pulse;
      ctx.fillStyle = i % 24 === 0 ? '#ffffff' : '#9ff0ff';
      ctx.fillRect(Math.round(cx + c * R), Math.round(cy + s * R), 1, 1);
      ctx.globalAlpha = pa * 0.4 * pulse;
      ctx.fillRect(Math.round(cx + c * (R - 1)), Math.round(cy + s * (R - 1)), 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) { // marcas das horas apontando para dentro
      const a = a0 + (i / 12) * Math.PI * 2;
      for (let k = 2; k < (i % 3 ? 4 : 6); k++) {
        ctx.globalAlpha = pa * (0.7 - k * 0.1);
        ctx.fillRect(Math.round(cx + Math.cos(a) * (R - k)), Math.round(cy + Math.sin(a) * (R - k)), 1, 1);
      }
    }
    ctx.globalAlpha = pa * 0.45; ctx.fillStyle = AURA;
    for (let i = 0; i < 16; i++) {
      const a = -this.t * 1.1 + (i / 16) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * R * 0.6), Math.round(cy + Math.sin(a) * R * 0.6), 1, 1);
    }
    ctx.globalAlpha = pa;
  }
  draw(ctx) {
    if (!this.dying) this.drawAura(ctx);
    this.drawBody(ctx, this.rot && !this.dying ? { rotation: this.rot } : {});
    this.drawStatus(ctx);
  }
}
registerEntity('w3_timewarper', TimeWarper);

// =============================================================================
// g — w3_cogbat: morcego de engrenagens
// =============================================================================
function cogbat(pc, o = {}) {
  const cx = 13, hang = !!o.hang, ph = o.ph || 0;
  const Y = hang ? (y) => 17 - y : (y) => y;
  const eye = o.red ? '#ff5a3a' : '#ffe27a';
  if (hang) { // garrinhas no teto
    pc.vline(12, 0, 3, COP[4]); pc.vline(14, 0, 3, COP[4]); pc.px(11, 0, COP[3]); pc.px(15, 0, COP[3]);
  }
  // asas
  const WT = o.wings;
  if (WT) for (const s of [-1, 1]) {
    const mx = (x) => (s > 0 ? x : 2 * cx - x);
    const S = [cx + s * 3, Y(8)];
    const pts = [S, ...WT.map(([x, y]) => [mx(x), Y(y)]), [cx + s * 3, Y(11)]];
    pc.poly(pts, COP[3]);
    for (let i = 0; i < WT.length - 1; i++) { // membrana com recortes
      const [ax, ay] = WT[i], [bx, by] = WT[i + 1];
      pc.line(mx(ax), Y(ay), Math.round((mx(ax) + mx(bx) + S[0]) / 3), Math.round((Y(ay) + Y(by) + S[1]) / 3), COP[4]);
    }
    for (const [x, y] of WT) { pc.line(S[0], S[1], mx(x), Y(y), COP[1]); pc.px(mx(x), Y(y), BRASS[0]); }
  } else { // asas fechadas como capa
    for (const s of [-1, 1]) {
      puff(pc, cx + 0.5 + s * 4.5, 9.5, 3 + (o.open || 0), 6.5, COP, { fuzz: false, rough: 0.08 });
      pc.vline(cx + s * 5, 5, 9, COP[4]); pc.vline(cx + s * 3, 6, 8, COP[1]);
    }
  }
  // corpo-engrenagem
  gear(pc, cx + 0.5, 9.5, 5.2, BRASS, ph);
  // orelhas
  pc.tri(9, Y(5), 10, Y(1), 12, Y(4), COP[2]); pc.tri(17, Y(5), 16, Y(1), 14, Y(4), COP[2]);
  pc.px(10, Y(2), COP[0]); pc.px(16, Y(2), COP[0]);
  // olhão
  pc.rect(12, Y(10), 3, 3, '#fff6e0');
  if (o.hurt) { pc.px(12, Y(9), INK); pc.px(14, Y(9), INK); pc.px(13, Y(10), INK); pc.px(12, Y(11), INK); pc.px(14, Y(11), INK); }
  else { pc.rect(13, Y(10) + (hang ? -1 : 0), 2, 2, eye); pc.px(14, Y(10) + (hang ? -1 : 0), INK); }
  // presas
  pc.px(12, Y(13), '#ffffff'); pc.px(14, Y(13), '#ffffff');
}
const WINGS = [
  [[24, 1], [25, 5], [21, 9]],
  [[25, 6], [25, 10], [21, 12]],
  [[23, 13], [21, 16], [18, 14]],
  [[25, 6], [25, 10], [21, 12]],
];
defineSprite('w3_cogbat', {
  w: 27, h: 18, ox: 13, oy: 9,
  anims: { idle: { frames: 2, fps: 2 }, move: { frames: 4, fps: 12 }, windup: { frames: 2, fps: 10 }, attack: { frames: 2, fps: 12 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') cogbat(pc, { hang: true, ph: f * 0.3, open: 0 });
    else if (anim === 'move') cogbat(pc, { wings: WINGS[f], ph: f * 0.4 });
    else if (anim === 'windup') cogbat(pc, { hang: true, ph: f * 0.4, open: 1 + f, red: true });
    else if (anim === 'attack') cogbat(pc, { wings: [[20, 1], [22, 4], [19, 8]], ph: f * 0.4, red: true });
    else cogbat(pc, { wings: WINGS[2], hurt: true, ph: f });
    pc.outline(OUT1);
  },
});

class CogBat extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w3_cogbat'; this.flying = true; this.centerPivot = true; this.teleColor = '#ffb060';
    this.w = 14; this.h = 12; this.x = x + 1; this.y = y;
    this.hp = this.maxHp = 2;
    this.drops = { buttons: 2, heart: 0.06, energy: 0.2 };
    this.fabricColors = [BRASS[1], COP[2], '#ff5a3a'];
    this.deathSfx = 'w3e_clank';
    this.go('hang');
  }
  init() { this.perch(); this.homeX = this.x; this.homeY = this.y; }
  /** Assenta sob o teto mais próximo acima (até 8 tiles). */
  perch() {
    const m = this.level.map;
    for (let yy = Math.floor(this.y); yy > this.y - TILE * 8; yy--) if (m.solidAt(this.cx, yy - 1)) { this.y = yy; return true; }
    return false;
  }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    switch (this.state) {
      case 'hang':
        this.vx = this.vy = 0; this.setAnim('idle');
        if (this.cool <= 0 && Math.abs(dx) < 46 && dy > 16 && dy < 160 && this.canSee(p, 180)) { this.go('drop'); audio.sfx('w3e_whirr'); }
        return;
      case 'drop': // desdobra as asas e treme (~0.4 s)
        this.setAnim('windup'); this.tele(); this.vx = this.vy = 0;
        if (this.stT > 0.4) {
          this.teleOn = false;
          this.sx = this.cx; this.sy = this.cy;
          this.dir = Math.sign(dx) || this.facing;
          this.A = Math.max(Math.abs(dx), 12); this.B = clamp(dy + 4, 24, 150);
          this.T = 0.55 + this.B / 420;
          this.go('swoop'); audio.sfx('dash', { pitch: 1.4, vol: 0.5 });
        }
        return;
      case 'swoop': { // arco: desce até o alvo e sobe do outro lado
        this.setAnim('attack');
        const th = Math.min(Math.PI, (this.stT / this.T) * Math.PI);
        const tx = this.sx + this.dir * this.A * (1 - Math.cos(th)), ty = this.sy + this.B * Math.sin(th);
        this.vx = clamp((tx - this.cx) / dt, -380, 380); this.vy = clamp((ty - this.cy) / dt, -380, 380);
        this.facing = this.dir;
        this.physics(dt, { noGravity: true });
        if (this.hitWall || (this.grounded && th > 0.3) || th >= Math.PI) { this.vx *= 0.3; this.vy = 0; this.go('return'); }
        return;
      }
      case 'return': // volta ao poleiro
        this.setAnim('move');
        this.moveToward(this.homeX + this.w / 2, this.homeY + this.h / 2, 80, dt);
        this.facing = this.vx < 0 ? -1 : 1;
        this.physics(dt, { noGravity: true });
        if (Math.hypot(this.homeX - this.x, this.homeY - this.y) < 4) { this.x = this.homeX; this.y = this.homeY; this.cool = 1; this.go('hang'); }
        else if (this.stT > 4) {
          if (this.perch()) { this.homeX = this.x; this.homeY = this.y; this.cool = 1; this.go('hang'); } else this.stT = 0;
        }
        return;
    }
  }
}
registerEntity('w3_cogbat', CogBat);

registerLegend(3, { a: 'w3_tinsoldier', b: 'w3_livingclock', d: 'w3_rustbot', f: 'w3_timewarper', g: 'w3_cogbat' });

// ----------------------------------------------------------------- fase de teste
function buildMap(W, H, ground, put) {
  const g = [];
  for (let r = 0; r < H; r++) g.push(Array(W).fill(r >= ground ? '#' : '.'));
  put((c, r, s) => { for (let i = 0; i < s.length; i++) g[r][c + i] = s[i]; });
  return g.map((a) => a.join(''));
}
registerLevel({
  id: 'test_enemies_w3', world: 0, index: 0, name: 'Teste: Inimigos do Mundo 3', subtitle: 'Teste',
  tileset: 'w3', background: 'w3', music: null, parTime: 120,
  legend: { a: 'w3_tinsoldier', b: 'w3_livingclock', d: 'w3_rustbot', f: 'w3_timewarper', g: 'w3_cogbat' },
  map: buildMap(70, 18, 14, (put) => {
    put(1, 13, 'P'); put(68, 13, 'E');
    put(10, 11, '####'); put(10, 12, '####'); put(10, 13, '####'); put(11, 10, 'a');
    put(19, 13, 'b');
    put(26, 8, 'f');
    put(32, 13, 'd');
    put(40, 6, '%%%%%%%%%%%%%%'); put(40, 7, '%%%%%%%%%%%%%%'); put(42, 8, 'g'); put(50, 8, 'g');
    put(56, 11, '====='); put(60, 13, 'a'); put(64, 13, 'b');
  }),
});
