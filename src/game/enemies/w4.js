// =============================================================================
// enemies/w4.js — Inimigos do MUNDO 4 (O Pesadelo Debaixo da Cama).
// Fases escuras: todos têm olhos/brilhos que acendem na escuridão (drawLight).
//
// Legenda (registerLegend(4)):
//   a w4_underhand      — mão de sombra sob o chão/móvel: quando o jogador pisa no
//                         lugar, a rachadura brilha e olhos aparecem (~0.45 s), a mão
//                         irrompe e depois recua. Não sai na luz nem com jogador
//                         escondido. Não pisável. 2 hp.
//   b w4_creepydoll     — boneca deformada: só anda quando o jogador NÃO está olhando
//                         para ela (player.facing na direção dela = congela, inclina
//                         a cabeça). Congelada = vulnerável; andando = golpes atravessam.
//                         Perto, ergue os braços (~0.4 s) e dá um bote. 3 hp.
//   d w4_shadowstalker  — sombra que persegue no escuro; foge de lâmpadas acesas
//                         (tag 'lamp' + on===true, raio = light.r) e se desfaz se
//                         ficar na luz (renasce no escuro, em casa). Perde o jogador
//                         escondido. Bote telegrafado (~0.4 s). Não pisável. 3 hp.
//   f w4_mimic          — reflexo de vidro escuro: surge de uma poça e espelha o
//                         movimento horizontal do jogador do outro lado de uma linha
//                         de espelho (cintilante) e copia os pulos (com atraso).
//                         props.mirror = coluna fixa da linha (senão: ponto médio ao
//                         acordar). Cai em buracos! 3 hp.
//   g w4_wardrobe       — guarda-roupa vivo: portas rangem e se abrem mostrando olhos
//                         quando o jogador está perto e não escondido; treme (~0.45 s)
//                         e cospe mariposas (w4_moth, voadoras, atraídas por luz).
//                         Parado; só leva dano com as portas abertas. 5 hp.
// Exporta lightAt(level, x, y, pad) — fonte de luz forte que ilumina (x, y) ou null.
// Fase de teste: ?level=test_enemies_w4
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { PlushEnemy, puff, OUT1 } from './w1.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { defineSprite, drawSprite, animFrame } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { clamp, rand, approach, TILE } from '../../engine/util.js';

// ----------------------------------------------------------------- paletas
const SH = ['#7a6aaa', '#54468a', '#3a2e6a', '#261c4c', '#140e2c'];
const PORC = ['#fffaf4', '#f4e2d8', '#dcc0b8', '#ac8c94', '#6e5470'];
const DRESS = ['#f8c8dc', '#d890b0', '#ac6488', '#7c4064', '#4c2444'];
const HAIR = ['#8a6a5a', '#6a4a40', '#4c3030', '#342020', '#201418'];
const OBS = ['#5a5088', '#3a3266', '#262048', '#18142e', '#0c0a1a'];
const GLASS = ['#f0feff', '#b8f6ff', '#6ac8dc', '#357890', '#1a4058'];
const SILV = ['#ffffff', '#d8dce8', '#a4aabc', '#6c7288', '#40445a'];
const WOODD = ['#a8785a', '#82583e', '#5e3e2c', '#40281e', '#261610'];
const EYE = '#ffe46a', CLAW = '#e8e0ff', THREAD = '#f0e0b0', DARK = '#07040c';

// ----------------------------------------------------------------- sons (prefixo w4e_)
registerSfx('w4e_rumble', { wave: 'noise', freq: 220, freqEnd: 70, dur: 0.42, vol: 0.2, filter: { type: 'lowpass', freq: 420 } });
registerSfx('w4e_grab', [{ wave: 'noise', freq: 1300, freqEnd: 300, dur: 0.15, vol: 0.18 }, { wave: 'triangle', freq: 130, freqEnd: 50, dur: 0.2, vol: 0.25 }]);
registerSfx('w4e_giggle', [0, 0.07, 0.14].map((d, i) => ({ wave: 'triangle', freq: 1300 - i * 120, freqEnd: 1500 - i * 150, dur: 0.06, vol: 0.07, delay: d, vibrato: { rate: 18, depth: 0.8 } })));
registerSfx('w4e_creak', { wave: 'sawtooth', freq: 95, freqEnd: 150, dur: 0.45, vol: 0.07, vibrato: { rate: 13, depth: 1.5 }, filter: { type: 'bandpass', freq: 700, q: 3 } });
registerSfx('w4e_lunge', { wave: 'noise', freq: 2400, freqEnd: 700, dur: 0.16, vol: 0.12 });
registerSfx('w4e_hiss', { wave: 'noise', freq: 5000, freqEnd: 2500, dur: 0.35, vol: 0.08, filter: { type: 'highpass', freq: 2000 } });
registerSfx('w4e_dissolve', [{ wave: 'noise', freq: 1500, freqEnd: 200, dur: 0.5, vol: 0.12 }, { wave: 'sine', freq: 500, freqEnd: 120, dur: 0.5, vol: 0.08 }]);
registerSfx('w4e_mirror', [{ wave: 'sine', freq: 1760, freqEnd: 2637, dur: 0.4, vol: 0.06, vibrato: { rate: 7, depth: 0.5 } }, { wave: 'triangle', freq: 880, dur: 0.4, vol: 0.05, delay: 0.05 }]);
registerSfx('w4e_knock', { wave: 'triangle', freq: 160, freqEnd: 90, dur: 0.08, vol: 0.22 });
registerSfx('w4e_gag', { wave: 'sawtooth', freq: 70, freqEnd: 110, dur: 0.42, vol: 0.1, vibrato: { rate: 9, depth: 2 }, filter: { type: 'lowpass', freq: 500 } });
registerSfx('w4e_flutter', [0, 0.05, 0.1, 0.15].map((d) => ({ wave: 'noise', freq: 1800, dur: 0.03, vol: 0.06, delay: d })));

// ----------------------------------------------------------------- utilitários
/** Fonte de luz forte iluminando (x, y): entidade com tag 'lamp' acesa (on===true; raio
 *  lightRadius/light.r/props.radius) ou entidade não-inimiga com light.r >= 40. */
export function lightAt(level, x, y, pad = 0) {
  for (const e of level.entities) {
    if (e.dead || e.enemy || e.isPlayer || e === level.decoy) continue;
    let r;
    if (e.tags?.has('lamp')) {
      if (!(e.on === true || (e.on === undefined && e.light))) continue;
      r = e.lightRadius ?? e.light?.r ?? e.props?.radius ?? 64;
    } else if (e.light && (e.light.r || 0) >= 40) r = e.light.r;
    else continue;
    r += pad;
    const dx = e.cx - x, dy = e.cy - y;
    if (dx * dx + dy * dy < r * r) return e;
  }
  return null;
}
function cyl(pc, x, y, w, h, pal) {
  for (let i = 0; i < w; i++) { const t = w > 1 ? i / (w - 1) : 0.5; pc.vline(x + i, y, h, pal[t < 0.16 ? 1 : t < 0.62 ? 2 : t < 0.86 ? 3 : 4]); }
}
/** Olho brilhante desenhado em tempo real (pupila olhando para lx,ly ∈ [-1,1]). */
function glowEye(ctx, x, y, lx = 0, ly = 0, w = 3) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#fff6c8'; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = EYE; ctx.fillRect(x, y + 1, w, 1);
  ctx.fillStyle = '#1a0e20'; ctx.fillRect(x + Math.round((w - 1) / 2 + lx), y + (ly > 0 ? 1 : 0), 1, 1);
}

// =============================================================================
// a — w4_underhand: mão de sombra que irrompe do chão
// =============================================================================
function hand(pc, o = {}) {
  const top = o.top ?? 44, glow = o.glow || 0, f = o.f || 0;
  if (o.tips) { // pontas dos dedos saindo da fresta
    for (let i = 0; i < 4; i++) { const x = 8 + i * 3, h = o.tips - (i === 0 || i === 3 ? 1 : 0); pc.vline(x, 44 - h, h, SH[2]); pc.px(x, 43 - h, CLAW); }
  }
  if (top < 44) {
    const wob = (y) => Math.round(Math.sin(y * 0.45 + f) * 0.8);
    for (let y = top + 15; y < 44; y++) { // antebraço esfumaçado
      const w = 3 + (y > 38 ? 1 : 0), x = 12 + wob(y);
      pc.hline(x - w, y, w * 2, SH[3]); pc.px(x - w, y, SH[1]); pc.px(x - w + 1, y, SH[2]); pc.px(x + w - 1, y, SH[4]);
      if ((y + f) % 5 === 0) pc.px(x + w, y, SH[3]);
    }
    puff(pc, 12, top + 11, 5.5, 5.5, SH, { fuzz: false, rough: 0.15 });
    const sp = o.clench ? 0 : 1;
    for (let i = 0; i < 4; i++) {
      const bx = 8 + i * 2.7, tx = bx + (i - 1.5) * sp * 1.5, ty = top + (i === 0 || i === 3 ? 3 : 1) + (o.clench ? 4 : 0);
      pc.thickLine(bx, top + 8, tx, ty, 0.9, SH[2]);
      pc.line(Math.round(bx) - 1, top + 8, Math.round(tx) - 1, ty, SH[1]);
      pc.px(Math.round(tx), ty - 1, CLAW); pc.px(Math.round(tx), ty - 2, CLAW);
    }
    pc.thickLine(17, top + 12, 20 + sp, top + 7, 0.9, SH[2]); pc.px(20 + sp, top + 6, CLAW);
    // olho na palma
    pc.rect(10, top + 9, 5, 4, '#fff6c8');
    for (const [x, y] of [[10, 9], [14, 9], [10, 12], [14, 12]]) pc.px(x, top + y, SH[2]);
    if (o.shut) pc.hline(10, top + 11, 5, SH[4]);
    else { pc.rect(12, top + 10, 2, 2, '#ffb020'); pc.px(12, top + 10, '#1a0e20'); }
    for (let y = 44; y < 48; y++) for (let x = 0; x < 24; x++) pc.erase(x, y); // o braço some sob o chão
  }
  // rachadura no chão (sempre visível, sutil)
  const cc = glow > 1 ? '#ffd23f' : glow ? '#ff6a3a' : '#05020a';
  const C = [[3, 45], [6, 44], [9, 46], [12, 44], [15, 45], [18, 44], [21, 46]];
  for (let i = 0; i < C.length - 1; i++) pc.line(C[i][0], C[i][1], C[i + 1][0], C[i + 1][1], cc);
  pc.line(9, 46, 10, 47, cc); pc.line(15, 45, 14, 47, cc);
  if (glow) { pc.rect(10, 44, 5, 2, cc); for (const x of [6, 12, 18]) pc.px(x, 43 - (f & 1), '#ffb060'); }
  if (o.eyes) { pc.rect(10, 44, 5, 2, '#05020a'); pc.px(10, 44, EYE); pc.px(14, 44, EYE); }
}
defineSprite('w4_underhand', {
  w: 24, h: 48, ox: 12, oy: 44,
  anims: { idle: { frames: 4, fps: 1.5 }, windup: { frames: 3, fps: 7, loop: false }, attack: { frames: 2, fps: 8 }, move: { frames: 3, fps: 9, loop: false }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') hand(pc, { eyes: f === 2 });
    else if (anim === 'windup') hand(pc, { glow: f ? 2 : 1, tips: f + 1, f });
    else if (anim === 'attack') hand(pc, { top: 3, clench: f === 1, f });
    else if (anim === 'move') hand(pc, { top: [14, 24, 34][f], clench: true, f });
    else hand(pc, { top: 7, shut: true, f });
    pc.outline(OUT1);
  },
});

class UnderHand extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w4_underhand';
    this.w = 12; this.h = 4; this.alignToCell(x, y); this.floorY = this.bottom;
    this.hp = this.maxHp = 2; this.stompable = false;
    this.drops = { buttons: 2, heart: 0.05, energy: 0.2 };
    this.fabricColors = [SH[2], SH[1], EYE];
    this.deathSfx = 'w4e_dissolve';
    this.reach = 0;
    this.setHidden(true);
    this.go('lurk');
  }
  setHidden(h) { this.enemy = !h; this.hittable = !h; this.bindable = !h; }
  setReach(k) { this.reach = k; this.h = Math.max(4, Math.round(36 * k)); this.y = this.floorY - this.h; }
  onHurt() { super.onHurt(); if (this.state === 'grab') this.go('retreat'); }
  think(dt) {
    this.stT += dt;
    const p = this.target();
    const over = p && !p.hidden && Math.abs(p.cx - this.cx) < 15 && p.bottom > this.floorY - 40 && p.bottom < this.floorY + 6;
    switch (this.state) {
      case 'lurk':
        this.setReach(0); this.setHidden(true); this.setAnim('idle');
        if (this.cool <= 0 && over && !lightAt(this.level, this.cx, this.floorY - 8)) { this.go('crack'); audio.sfx('w4e_rumble'); this.level.shake(0.05); }
        break;
      case 'crack': // telégrafo: rachadura acende + pontas dos dedos (~0.45 s)
        this.setAnim('windup');
        if (Math.random() < dt * 20) this.level.particles.emit('dust', this.cx + rand(-6, 6), this.floorY - 1, 1);
        if (this.stT > 0.45) {
          this.setHidden(false); this.go('grab'); audio.sfx('w4e_grab');
          this.level.particles.emit('shadow', this.cx, this.floorY - 4, 8);
        }
        break;
      case 'grab':
        this.setAnim('attack'); this.setReach(Math.min(1, this.stT / 0.08));
        if (this.stT > 0.6) this.go('retreat');
        break;
      case 'retreat':
        this.setAnim('move'); this.setReach(Math.max(0, 1 - this.stT / 0.35));
        if (this.reach < 0.3) this.setHidden(true);
        if (this.stT > 0.35) { this.cool = 1.4; this.go('lurk'); }
        break;
    }
  }
  drawLight(L) {
    if (this.dying) return;
    if (this.state === 'crack') L.add(this.cx, this.floorY, 22, '#ff6a3a', 0.85, 0.3);
    else if (this.state === 'grab' || this.state === 'retreat') L.add(this.cx, this.y + 10, 12, EYE, 0.5);
    else if (this.anim === 'idle' && animFrame(this.sprite, 'idle', this.animT) === 2) L.add(this.cx, this.floorY + 1, 7, EYE, 0.3);
  }
}
registerEntity('w4_underhand', UnderHand);

// =============================================================================
// b — w4_creepydoll: boneca que só se mexe quando você não olha
// =============================================================================
function doll(pc, o = {}) {
  const t = o.tilt || 0, cx = 10, arms = o.arms || 0;
  const lg = o.leg == null ? [0, 0] : [[0, 0], [1, -1], [0, 0], [-1, 1]][o.leg & 3];
  pc.vline(8 + lg[0], 22, 4, PORC[2]); pc.vline(11 + lg[1], 22, 4, PORC[3]);
  pc.rect(7 + lg[0], 26, 3, 2, '#2a1420'); pc.rect(10 + lg[1], 26, 3, 2, '#2a1420'); pc.px(7 + lg[0], 26, '#5a3a4a');
  for (let y = 14; y <= 22; y++) { // vestido em sino
    const hw = 3 + Math.floor((y - 14) * 0.6);
    for (let x = cx - hw; x < cx + hw; x++) { const k = (x - (cx - hw)) / (2 * hw - 1); pc.px(x, y, DRESS[k < 0.2 ? 1 : k < 0.62 ? 2 : k < 0.86 ? 3 : 4]); }
  }
  for (let x = cx - 7; x < cx + 7; x += 2) { pc.px(x, 22, '#fff4f8'); pc.px(x + 1, 23, '#e8d8e0'); }
  pc.hline(cx - 3, 14, 6, '#fff4f8'); pc.px(cx - 1, 16, DRESS[0]); pc.px(cx - 1, 18, DRESS[0]);
  pc.rect(cx + 1, 18, 3, 3, '#7a8aa8'); pc.px(cx + 1, 17, THREAD); pc.px(cx + 3, 21, THREAD); pc.px(cx + 4, 19, THREAD);
  const AR = [[[6, 15], [4, 21], [14, 15], [16, 24]], [[6, 15], [3, 8], [14, 15], [17, 8]], [[7, 15], [18, 13], [13, 15], [19, 16]]][arms];
  pc.line(AR[0][0], AR[0][1], AR[1][0], AR[1][1], PORC[2]); pc.line(AR[2][0], AR[2][1], AR[3][0], AR[3][1], PORC[3]);
  pc.px(AR[1][0], AR[1][1], PORC[0]); pc.px(AR[3][0], AR[3][1], PORC[0]);
  // cabeça de porcelana (inclinada por t)
  const hx = cx + t;
  puff(pc, hx, 8, 6.2, 6, PORC, { fuzz: false, rough: 0.05 });
  puff(pc, hx, 4, 6.6, 3.2, HAIR, { ymax: 4, fuzz: false });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) pc.rect(Math.round(hx + s * 6.5) - 1, 5 + i * 2 + (s === t ? 1 : 0), 2, 2, HAIR[i % 2 ? 3 : 2]);
  pc.rect(hx + 2, 0, 2, 2, '#c83c5a'); pc.rect(hx + 5, 0, 2, 2, '#a82c4a'); pc.px(hx + 4, 1, '#ff6a8a');
  const ly = 7 + (t > 0 ? 1 : 0), ry = 6 + (t < 0 ? 1 : 0);
  pc.rect(hx - 3, ly, 2, 2, '#1a0e20'); pc.px(hx - 3, ly, '#ffffff');
  pc.rect(hx + 1, ry, 3, 3, '#2a0814'); pc.px(hx + 2, ry + 1, o.glow ? '#ffffff' : '#ff4a6a');
  if (o.mouth) { pc.rect(hx - 2, 10, 5, 3, '#2a0a14'); pc.px(hx - 1, 10, PORC[0]); pc.px(hx + 1, 10, PORC[0]); pc.px(hx, 12, PORC[0]); }
  else { pc.hline(hx - 2, 11, 5, '#6a3048'); for (let i = -2; i <= 2; i += 2) pc.vline(hx + i, 10, 3, '#6a3048'); }
  pc.px(hx - 4, 10, '#ff9ab0'); pc.px(hx + 4, 10, '#ff9ab0');
  pc.line(hx + 3, 3, hx + 4, 5, PORC[4]); pc.line(hx + 4, 5, hx + 6, 6, PORC[4]);
  if (o.crack) { pc.line(hx - 4, 4, hx - 1, 9, PORC[4]); pc.line(hx - 1, 9, hx - 2, 12, PORC[4]); }
}
defineSprite('w4_creepydoll', {
  w: 20, h: 28, ox: 10, oy: 28,
  anims: { idle: { frames: 3, fps: 1 }, move: { frames: 4, fps: 12 }, windup: { frames: 2, fps: 8 }, attack: { frames: 2, fps: 10 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') doll(pc, { tilt: f - 1 });
    else if (anim === 'move') doll(pc, { leg: f, tilt: f & 1 ? 1 : -1 });
    else if (anim === 'windup') doll(pc, { arms: 1, mouth: true, glow: f === 1, tilt: f ? 1 : 0 });
    else if (anim === 'attack') doll(pc, { arms: 2, mouth: true, glow: true });
    else doll(pc, { crack: true, tilt: f ? -1 : 1 });
    pc.outline(OUT1);
  },
});

class CreepyDoll extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w4_creepydoll'; this.teleColor = '#ff5a7a';
    this.w = 12; this.h = 22; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 3, heart: 0.1, energy: 0.25 };
    this.fabricColors = [DRESS[2], PORC[1], '#ffffff'];
    this.pose = 1; this.lean = 0; this.ghostT = 0;
    this.freeze(true);
  }
  /** O jogador está olhando para a boneca? */
  watched() {
    const p = this.level.player;
    if (!p || p.hidden || p.state === 'dead') return false;
    const dx = this.cx - p.cx;
    return Math.abs(dx) < 240 && Math.abs(this.cy - p.cy) < 100 && (Math.abs(dx) < 4 || Math.sign(dx) === p.facing);
  }
  freeze(silent) {
    if (!silent && this.state !== 'frozen') audio.sfx('w4e_creak', { pitch: 1.6, vol: 0.5 });
    this.go('frozen'); this.vuln = true; this.stompable = true;
    this.pose = Math.random() < 0.5 ? 0 : 2; this.lean = (this.pose - 1) * 0.12;
  }
  onHit(dmg, src, info) {
    if (!this.vuln) { // andando: o golpe atravessa
      if (this.ghostT <= 0) audio.sfx('w4e_giggle', { pitch: 1.3, vol: 0.5 });
      this.ghostT = 0.3; return false;
    }
    return super.onHit(dmg, src, info);
  }
  think(dt) {
    this.stT += dt; if (this.ghostT > 0) this.ghostT -= dt;
    const tg = this.target();
    const active = tg && !tg.hidden && Math.abs(tg.cx - this.cx) < 220 && Math.abs(tg.cy - this.cy) < 80;
    const seen = this.watched();
    if (seen && this.state !== 'frozen') this.freeze();
    switch (this.state) {
      case 'frozen': // estátua: a cabeça inclina de vez em quando
        this.vx = 0; this.setAnim('idle');
        if (this.stT > 1.3 + (this.id % 3) * 0.3) { this.stT = 0.2; this.pose = (this.pose + 2) % 4 === 1 ? 0 : 2 - this.pose; this.lean = (this.pose - 1) * 0.14; audio.sfx('w4e_creak', { pitch: 2, vol: 0.3 }); }
        if (!seen && active && this.stT > 0.15) { this.go('creep'); this.vuln = false; this.stompable = false; this.lean = 0; audio.sfx('w4e_giggle'); }
        break;
      case 'creep':
        this.setAnim('move'); this.faceTarget(tg);
        this.vx = approach(this.vx, this.facing * 62, 500 * dt);
        if (!active) { this.freeze(); break; }
        if (Math.abs(tg.cx - this.cx) < 40 && Math.abs(tg.cy - this.cy) < 26) { this.go('windup'); this.vx = 0; }
        break;
      case 'windup': // ergue os bracinhos, boca rasga (~0.4 s)
        this.vx = 0; this.setAnim('windup'); this.tele();
        if (this.stT > 0.4) { this.teleOn = false; this.vx = this.facing * 175; this.vy = -150; this.go('lunge'); audio.sfx('w4e_lunge'); }
        break;
      case 'lunge':
        this.setAnim('attack');
        if (this.grounded && this.stT > 0.12) { this.vx *= 0.4; this.go('creep'); }
        break;
    }
    this.physics(dt);
  }
  draw(ctx) {
    const o = this.spriteOpts();
    if (this.teleOn && !this.flash) o.variant = this.teleColor;
    if (!this.dying) {
      if (this.state === 'frozen') o.rotation = this.lean;
      if (this.ghostT > 0) o.alpha = 0.45 + 0.3 * Math.sin(this.t * 40);
    }
    const a = this.bodyAnim();
    const f = a === 'idle' ? this.pose : animFrame(this.sprite, a, a === 'hurt' ? this.t : this.animT);
    drawSprite(ctx, this.sprite, a, f, Math.round(this.cx), Math.round(this.bottom), o);
    this.drawStatus(ctx);
  }
  drawLight(L) {
    if (this.dying) return;
    const tilt = this.anim === 'idle' ? this.pose - 1 : 0;
    L.add(this.cx + this.facing * (2.5 + tilt), this.bottom - 21, this.state === 'frozen' ? 7 : 10, '#ff4a6a', 0.55, 0.3);
  }
}
registerEntity('w4_creepydoll', CreepyDoll);

// =============================================================================
// d — w4_shadowstalker: sombra que persegue no escuro e foge da luz
// =============================================================================
function stalker(pc, o = {}) {
  const l = o.lean || 0, w = o.wisp || 0, arms = o.arms || 0;
  for (let i = 0; i < 4; i++) { // cauda de fumaça
    const x0 = 10 + i * 3 + l, x1 = x0 + Math.round(Math.sin(w * 1.7 + i * 1.9) * 2.5) - l;
    pc.thickLine(x0, 22, x1, 31 - (i % 2) * 3, 1.1 - (i % 2) * 0.3, i % 2 ? SH[4] : SH[3]);
  }
  puff(pc, 15 + l, 17, 7.5, 7.5, SH, { fuzz: false, rough: 0.25 });
  const A = [[[9, 15], [5, 27]], [[9, 14], [1, 6]], [[10, 15], [25, 13]]][arms];
  const B = [[[21, 15], [25, 27]], [[21, 14], [29, 6]], [[20, 16], [28, 19]]][arms];
  for (const [[sx, sy], [ex, ey]] of [A, B]) {
    pc.thickLine(sx + l, sy, ex + l, ey, 0.9, SH[3]);
    const dx = ex - sx, dy = ey - sy, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    for (let k = -1; k <= 1; k++) pc.line(ex + l, ey, Math.round(ex + l + nx * 3 - ny * k * 2), Math.round(ey + ny * 3 + nx * k * 2), CLAW);
  }
  const hx = 15 + l * 2;
  puff(pc, hx, 9, 6.5, 5.8, SH, { fuzz: false, rough: 0.2 });
  pc.tri(hx - 5, 6, hx - 4, 1, hx - 2, 5, SH[2]); pc.tri(hx + 5, 6, hx + 4, 1, hx + 2, 5, SH[2]);
  const big = o.eyes || 0;
  pc.rect(hx - 4, 7, 3, 2 + big, '#fff6c8'); pc.rect(hx + 1, 7, 3, 2 + big, '#fff6c8');
  pc.hline(hx - 4, 8 + big, 3, EYE); pc.hline(hx + 1, 8 + big, 3, EYE);
  pc.px(hx - 2, 7, '#1a0e20'); pc.px(hx + 3, 7, '#1a0e20');
  if (o.mouth) { pc.rect(hx - 4, 11, 9, 3, '#05020a'); for (let i = 0; i < 9; i += 2) { pc.px(hx - 4 + i, 11, '#fffaf0'); pc.px(hx - 3 + i, 13, '#fffaf0'); } }
  else for (let i = 0; i < 8; i++) pc.px(hx - 4 + i, 12 - (i & 1), '#fffaf0');
}
defineSprite('w4_shadowstalker', {
  w: 30, h: 34, ox: 15, oy: 17,
  anims: { idle: { frames: 4, fps: 5 }, move: { frames: 4, fps: 8 }, windup: { frames: 2, fps: 8 }, attack: { frames: 2, fps: 10 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') stalker(pc, { wisp: f });
    else if (anim === 'move') stalker(pc, { wisp: f, lean: 1 });
    else if (anim === 'windup') stalker(pc, { wisp: f, arms: 1, eyes: 1, mouth: true });
    else if (anim === 'attack') stalker(pc, { wisp: f, arms: 2, lean: 1, mouth: true, eyes: 1 });
    else stalker(pc, { wisp: f * 2, arms: 1, lean: -1 });
    pc.outline('#4a3a80');
  },
});

class ShadowStalker extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w4_shadowstalker'; this.flying = true; this.centerPivot = true; this.teleColor = '#ffe46a';
    this.w = 14; this.h = 20; this.x = x + 1; this.y = y - 4;
    this.homeX = this.cx; this.homeY = this.cy;
    this.hp = this.maxHp = 3; this.stompable = false;
    this.drops = { buttons: 3, heart: 0.1, energy: 0.3 };
    this.fabricColors = ['#2a1c48', '#5a4a8a', EYE];
    this.deathSfx = 'w4e_dissolve';
    this.fade = 1; this.lastX = this.homeX; this.lastY = this.homeY;
    this.go('lurk');
  }
  steer(tx, ty, sp, dt) {
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 16);
    this.vx = approach(this.vx, (dx / d) * sp * k, 260 * dt);
    this.vy = approach(this.vy, (dy / d) * sp * k, 260 * dt);
  }
  onHurt() { super.onHurt(); if (this.hp > 0 && this.state !== 'gone') { this.cool = 0.8; } }
  think(dt) {
    this.stT += dt;
    const L = this.level, p = this.target();
    let fadeTo = 1;
    if (this.state !== 'flee' && this.state !== 'gone' && lightAt(L, this.cx, this.cy, 6)) { this.go('flee'); audio.sfx('w4e_hiss'); }
    const sees = this.state !== 'gone' && this.canSee(p, 200);
    if (sees) { this.lastX = p.cx; this.lastY = p.cy; }
    switch (this.state) {
      case 'lurk':
        this.setAnim('idle');
        this.steer(this.homeX + Math.sin(this.t * 0.7) * 12, this.homeY + Math.sin(this.t * 1.7) * 3, 30, dt);
        if (sees) { this.go('chase'); audio.sfx('shadow_whisper'); }
        break;
      case 'chase': {
        this.setAnim('move');
        if (!sees) { this.go('search'); break; }
        this.faceTarget(p);
        if (lightAt(L, this.cx + Math.sign(p.cx - this.cx) * 12, this.cy, 4)) { this.vx *= 0.85; this.vy *= 0.85; fadeTo = 0.7; } // não entra na luz
        else this.steer(p.cx, p.cy - 4, 60, dt);
        if (this.cool <= 0 && Math.abs(p.cx - this.cx) < 38 && Math.abs(p.cy - this.cy) < 30) { this.go('windup'); audio.sfx('w4e_hiss', { pitch: 0.7 }); }
        break;
      }
      case 'windup': // abre os braços, olhos crescem (~0.4 s)
        this.setAnim('windup'); this.tele(); this.vx *= 0.85; this.vy = approach(this.vy, -18, 300 * dt);
        if (this.stT > 0.4) {
          this.teleOn = false;
          const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
          this.vx = Math.cos(a) * 185; this.vy = Math.sin(a) * 185;
          this.go('lunge'); audio.sfx('w4e_lunge');
        }
        break;
      case 'lunge':
        this.setAnim('attack');
        if (this.stT > 0.35 || this.hitWall) { this.vx *= 0.3; this.vy *= 0.3; this.cool = 1; this.go('chase'); }
        break;
      case 'search': // perdeu o jogador (escondido?): vai até onde o viu e procura
        this.setAnim('idle');
        this.steer(this.lastX + Math.sin(this.stT * 2) * 20, this.lastY - 6, 36, dt);
        if (sees && this.stT > 0.3) this.go('chase');
        else if (this.stT > 3.5) this.go('home');
        break;
      case 'home':
        this.setAnim('move'); this.steer(this.homeX, this.homeY, 45, dt);
        if (sees) this.go('chase');
        else if (Math.hypot(this.homeX - this.cx, this.homeY - this.cy) < 6) this.go('lurk');
        break;
      case 'flee': { // luz! recua e começa a se desfazer
        this.setAnim('hurt'); fadeTo = 0.35;
        const lamp = lightAt(L, this.cx, this.cy, 6);
        if (lamp) {
          const dx = this.cx - lamp.cx, dy = this.cy - lamp.cy, d = Math.hypot(dx, dy) || 1;
          this.vx = approach(this.vx, (dx / d) * 110, 600 * dt); this.vy = approach(this.vy, (dy / d) * 50, 600 * dt);
        }
        if (Math.random() < dt * 20) L.particles.emit('shadow', this.cx + rand(-5, 5), this.cy + rand(-6, 6), 1);
        if (!lamp && this.stT > 0.3) { this.cool = 0.8; this.go(sees ? 'chase' : 'home'); }
        else if (lamp && this.stT > 1.0) { this.go('gone'); audio.sfx('w4e_dissolve'); L.particles.emit('shadow', this.cx, this.cy, 14); }
        break;
      }
      case 'gone': // desfeito: renasce em casa quando estiver escuro lá
        fadeTo = 0; this.enemy = false; this.hittable = false; this.vx = this.vy = 0;
        if (this.stT > 3 && !lightAt(L, this.homeX, this.homeY, 8)) {
          this.x = this.homeX - this.w / 2; this.y = this.homeY - this.h / 2;
          this.enemy = this.hittable = true; this.go('reform');
        }
        break;
      case 'reform':
        this.setAnim('windup'); this.vx = this.vy = 0;
        if (Math.random() < dt * 20) L.particles.emit('shadow', this.cx + rand(-8, 8), this.cy + rand(-8, 8), 1);
        if (this.stT > 0.6) this.go('lurk');
        break;
    }
    this.fade = approach(this.fade, fadeTo, dt * (fadeTo < this.fade ? 3 : 1.5));
    if (this.state !== 'gone') this.physics(dt, { noGravity: true });
  }
  draw(ctx) {
    if (this.fade <= 0.02 && !this.dying) return;
    const extra = {};
    if (!this.dying) extra.alpha = this.fade * (0.85 + 0.15 * Math.sin(this.t * 5));
    this.drawBody(ctx, extra); this.drawStatus(ctx);
  }
  drawLight(L) {
    if (this.dying || this.fade < 0.3) return;
    L.add(this.cx + this.facing * 2, this.cy - 9, this.state === 'windup' ? 14 : 10, EYE, 0.6 * this.fade, 0.2);
  }
}
registerEntity('w4_shadowstalker', ShadowStalker);

// =============================================================================
// f — w4_mimic: reflexo que espelha o jogador
// =============================================================================
function mimic(pc, o = {}) {
  const e = o.emerge ?? 1, dy = Math.round((1 - e) * 18), arms = o.arms || 0;
  pc.ellipse(10, 25.5, 8, 1.6, OBS[2]); pc.hline(5, 25, 4, GLASS[3]); pc.px(13, 26, GLASS[3]); // poça
  if (e <= 0) { pc.px(7, 25, GLASS[1]); return; }
  const lg = o.leg == null ? [0, 0] : [[0, 0], [2, -2], [0, 0], [-2, 2]][o.leg & 3];
  if (dy < 5) { pc.line(8, 19 + dy, 7 + lg[0], 25, OBS[2]); pc.line(12, 19 + dy, 13 + lg[1], 25, OBS[3]); pc.px(6 + lg[0], 25, OBS[1]); pc.px(14 + lg[1], 25, OBS[3]); }
  cyl(pc, 7, 13 + dy, 6, 7, OBS);
  pc.px(8, 15 + dy, GLASS[2]); pc.px(11, 17 + dy, GLASS[3]);
  const A = [[[7, 14], [3, 21]], [[7, 14], [3, 7]], [[7, 14], [1, 11]]][arms], B = [[[12, 14], [16, 22]], [[12, 14], [17, 7]], [[12, 14], [19, 11]]][arms];
  for (const [[sx, sy], [ex, ey]] of [A, B]) { pc.line(sx, sy + dy, ex, ey + dy, OBS[2]); pc.px(ex, ey + dy, GLASS[1]); pc.px(ex - 1, ey + dy + 1, GLASS[2]); }
  // cabeça = espelho de mão: moldura prateada + vidro com rosto torto
  const hy = 7 + dy;
  pc.ellipse(10, hy, 5.6, 6.6, SILV[2]); pc.ellipseOutline(10, hy, 5.6, 6.6, SILV[3]); pc.px(7, hy - 5, SILV[0]);
  puff(pc, 10, hy, 4.3, 5.3, [GLASS[1], GLASS[2], GLASS[3], OBS[1], OBS[2]], { fuzz: false, rough: 0.05 });
  pc.line(7, hy - 2, 9, hy - 4, GLASS[0]);
  pc.rect(8, hy - 1, 2, 2, '#05020a'); pc.rect(11, hy - 2, 2, 3, '#05020a'); pc.px(12, hy - 1, '#ff4a6a');
  pc.line(8, hy + 3, 12, hy + 2, '#05020a'); pc.px(12, hy + 1, '#05020a'); pc.px(9, hy + 3, '#ffffff'); pc.px(11, hy + 2, '#ffffff');
  pc.vline(10, hy + 6, 2, SILV[3]);
  if (o.crack) { pc.line(7, hy - 4, 10, hy, '#ffffff'); pc.line(10, hy, 9, hy + 4, '#ffffff'); pc.line(10, hy, 13, hy + 1, '#ffffff'); }
}
defineSprite('w4_mimic', {
  w: 20, h: 27, ox: 10, oy: 27,
  anims: { idle: { frames: 2, fps: 3 }, move: { frames: 4, fps: 12 }, windup: { frames: 4, fps: 8, loop: false }, attack: { frames: 2, fps: 8 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    if (anim === 'idle') mimic(pc, { arms: f });
    else if (anim === 'move') mimic(pc, { leg: f });
    else if (anim === 'windup') mimic(pc, { emerge: f / 3 });
    else if (anim === 'attack') mimic(pc, { arms: 1, leg: f * 2 });
    else mimic(pc, { crack: true, arms: 2 });
    pc.outline(OUT1);
  },
});

class Mimic extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w4_mimic';
    this.w = 12; this.h = 20; this.alignToCell(x, y);
    this.homeX = this.x; this.homeY = this.y; this.floorY = this.bottom;
    this.gravity = 1100;
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 4, heart: 0.12, energy: 0.3 };
    this.fabricColors = [OBS[2], GLASS[1], '#ffffff'];
    this.deathSfx = 'glass_crack';
    this.fixedMirror = props.mirror != null ? props.mirror * TILE + TILE / 2 : null;
    this.mirrorX = this.fixedMirror ?? this.cx; this.lineA = 0;
    this.hist = []; this.jumpQ = []; this.prevVy = 0; this.lostT = 0; this.usedAir = false;
    this.setAwake(false);
    this.go('dormant');
  }
  setAwake(a) { this.enemy = a; this.hittable = a; this.stompable = a; this.bindable = a; }
  onHurt() { super.onHurt(); this.jumpQ.length = 0; }
  think(dt) {
    this.stT += dt;
    const pl = this.level.player;
    const vis = pl && pl.state !== 'dead' && !pl.hidden;
    this.hist.push(pl.cx); if (this.hist.length > 8) this.hist.shift();
    const jumped = pl.vy < -200 && pl.vy - this.prevVy < -180;
    this.prevVy = pl.vy;
    switch (this.state) {
      case 'dormant':
        this.vx = 0; this.setAnim('windup'); this.animT = 0;
        this.lineA = approach(this.lineA, 0, dt * 2);
        if (vis && Math.abs(pl.cx - this.cx) < 150 && Math.abs(pl.bottom - this.bottom) < 48 && this.canSee(pl, 170)) {
          this.mirrorX = this.fixedMirror ?? Math.round((pl.cx + this.cx) / 2);
          this.go('rise'); audio.sfx('w4e_mirror'); audio.sfx('glass_crack', { pitch: 1.5, vol: 0.4 });
        }
        break;
      case 'rise': // emerge da poça; a linha do espelho acende (~0.5 s)
        this.vx = 0; this.setAnim('windup'); this.lineA = Math.min(1, this.stT / 0.5);
        if (this.stT > 0.5) { this.setAwake(true); this.lostT = 0; this.jumpQ.length = 0; this.go('mirror'); }
        break;
      case 'mirror': {
        const tx = 2 * this.mirrorX - this.hist[0];
        this.vx = clamp((tx - this.cx) * 9, -165, 165);
        if (Math.abs(this.vx) < 8) this.vx = 0;
        this.facing = -pl.facing;
        this.setAnim(!this.grounded ? 'attack' : Math.abs(this.vx) > 10 ? 'move' : 'idle');
        if (jumped && vis) this.jumpQ.push({ t: 0.13, v: pl.vy });
        for (const j of this.jumpQ) j.t -= dt;
        while (this.jumpQ.length && this.jumpQ[0].t <= 0) {
          const j = this.jumpQ.shift();
          if (this.grounded || !this.usedAir) { if (!this.grounded) this.usedAir = true; this.vy = j.v; audio.sfx('jump', { pitch: 0.6, vol: 0.4 }); }
        }
        if (this.grounded) this.usedAir = false;
        const lost = !vis || Math.abs(pl.cx - this.mirrorX) > 260 || Math.abs(pl.bottom - this.bottom) > 140;
        this.lostT = lost ? this.lostT + dt : 0;
        if (this.lostT > 1.2) { this.setAwake(false); this.go('sink'); audio.sfx('w4e_mirror', { pitch: 0.6 }); }
        break;
      }
      case 'sink': // derrete na poça e volta para casa
        this.vx = 0; this.lineA = Math.max(0, 1 - this.stT / 0.5);
        if (this.stT > 0.5) { this.x = this.homeX; this.y = this.homeY; this.vy = 0; this.go('dormant'); }
        break;
    }
    this.physics(dt);
    if (this.y > this.level.map.height + 40) { this.level.particles.emit('hit', this.cx, this.level.map.height - 4, 6, { colors: [GLASS[1], '#ffffff'] }); this.remove(); }
  }
  draw(ctx) {
    if (!this.dying) this.drawMirror(ctx);
    const o = this.spriteOpts();
    let a = this.bodyAnim(), f;
    if (this.state === 'dormant') { a = 'windup'; f = 0; }
    else if (this.state === 'sink') { a = 'windup'; f = Math.max(0, 3 - Math.floor(this.stT * 8)); }
    else f = animFrame(this.sprite, a, a === 'hurt' ? this.t : this.animT);
    drawSprite(ctx, this.sprite, a, f, Math.round(this.cx), Math.round(this.bottom), o);
    this.drawStatus(ctx);
  }
  drawMirror(ctx) {
    const A = this.lineA;
    if (A <= 0.01) return;
    const x = Math.round(this.mirrorX), y1 = Math.round(this.floorY), y0 = y1 - 72, pa = ctx.globalAlpha;
    for (let y = y0; y < y1; y++) {
      const k = 1 - Math.abs((y - (y0 + y1) / 2) / ((y1 - y0) / 2));
      const sh = (y + Math.floor(this.t * 40)) % 14 < 2;
      ctx.globalAlpha = pa * A * Math.min(1, k * 3) * (sh ? 0.95 : 0.4 + 0.3 * k);
      ctx.fillStyle = sh ? '#ffffff' : GLASS[1];
      ctx.fillRect(x, y, 1, 1);
      if (sh || (y & 3) === 0) { ctx.globalAlpha *= 0.4; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); }
    }
    ctx.globalAlpha = pa;
  }
  drawLight(L) {
    if (this.dying) return;
    if (this.lineA > 0.05) { L.add(this.mirrorX, this.floorY - 20, 22, GLASS[1], 0.35 * this.lineA, 0.2); L.add(this.mirrorX, this.floorY - 52, 22, GLASS[1], 0.3 * this.lineA, 0.2); }
    if (this.state === 'dormant') L.add(this.cx, this.bottom - 2, 6, GLASS[1], 0.25);
    else L.add(this.cx, this.bottom - 20, 12, GLASS[1], 0.55, 0.2);
  }
}
registerEntity('w4_mimic', Mimic);

// =============================================================================
// g — w4_wardrobe: guarda-roupa vivo que cospe mariposas  (+ w4_moth)
// =============================================================================
const DOORS = { idle: [0, 0], windup: [1, 2, 1], move: [2, 2], attack: [3, 3], hurt: [2, 2] };
function wardrobe(pc, o = {}) {
  const d = o.door || 0, sx = o.shake || 0, X0 = 5 + sx, X1 = 32 + sx, IY0 = 10, IY1 = 46;
  pc.rect(X0 + 1, 49, 3, 5, WOODD[4]); pc.rect(X1 - 3, 49, 3, 5, WOODD[4]); pc.px(X0, 53, WOODD[3]); pc.px(X1, 53, WOODD[3]);
  cyl(pc, X0, 8, X1 - X0 + 1, 41, WOODD);
  pc.hline(X0, 48, X1 - X0 + 1, WOODD[4]); pc.hline(X0 - 1, 8, X1 - X0 + 3, WOODD[1]);
  const mid = (X0 + X1) / 2;
  for (let x = X0 - 1; x <= X1 + 1; x++) { // frontão em arco
    const k = (x - mid) / ((X1 - X0) / 2 + 1), top = 1 + Math.round(5 * k * k);
    pc.vline(x, top, 8 - top, x < mid ? WOODD[1] : WOODD[2]); pc.px(x, top, WOODD[0]);
  }
  pc.circle(mid + 0.5, 3.5, 1.6, '#d8b04a'); pc.px(Math.round(mid), 3, '#fff0a0');
  const IX0 = X0 + 2, IX1 = X1 - 2;
  if (d > 0) { // interior escuro: cabides e dentes
    pc.rect(IX0, IY0, IX1 - IX0 + 1, IY1 - IY0 + 1, DARK);
    for (const hx of [12, 19, 25]) { pc.px(hx + sx, 12, '#5a5a6a'); pc.px(hx + sx, 13, '#4a4a5a'); pc.line(hx - 2 + sx, 14, hx + 2 + sx, 14, '#4a4a5a'); }
    if (d >= 2) for (let x = IX0; x + 2 <= IX1; x += 3) { pc.tri(x, IY1, x + 2, IY1, x + 1, IY1 - 3, '#e8e0d0'); pc.tri(x + 1, IY0 + 18, x + 3, IY0 + 18, x + 2, IY0 + 21, '#d8d0c0'); }
  }
  const door = (x, w, side) => {
    const h = IY1 - IY0 + 3;
    pc.rect(x, IY0 - 1, w, h, WOODD[2]); pc.vline(x, IY0 - 1, h, WOODD[1]); pc.vline(x + w - 1, IY0 - 1, h, WOODD[3]);
    if (w >= 6) { pc.strokeRect(x + 2, IY0 + 2, w - 4, 14, WOODD[3]); pc.strokeRect(x + 2, IY0 + 20, w - 4, 15, WOODD[3]); pc.hline(x + 2, IY0 + 2, w - 4, WOODD[1]); pc.hline(x + 2, IY0 + 20, w - 4, WOODD[1]); }
    pc.rect(side < 0 ? x + w - 2 : x, 28, 2, 2, '#d8b04a'); pc.px(side < 0 ? x + w - 2 : x, 28, '#fff0a0');
  };
  if (d === 0) { door(IX0, 12, -1); door(IX0 + 12, 12, 1); pc.vline(IX0 + 12, IY0, IY1 - IY0, DARK); if (o.glint) pc.px(IX0 + 12, 31, EYE); }
  else if (d === 1) { door(IX0, 10, -1); door(IX1 - 9, 10, 1); }
  else if (d === 2) { door(IX0, 6, -1); door(IX1 - 5, 6, 1); }
  else { door(X0 - 4, 4, 1); door(X1 + 1, 4, -1); }
  if (o.crack) { pc.line(X0 + 4, 20, X0 + 9, 26, WOODD[4]); pc.line(X1 - 3, 33, X1 - 8, 40, WOODD[4]); }
}
defineSprite('w4_wardrobe', {
  w: 38, h: 54, ox: 19, oy: 54,
  anims: { idle: { frames: 2, fps: 1.2 }, windup: { frames: 3, fps: 7 }, move: { frames: 2, fps: 2 }, attack: { frames: 2, fps: 8 }, hurt: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    const door = DOORS[anim][f];
    if (anim === 'idle') wardrobe(pc, { door, glint: f === 1 });
    else if (anim === 'windup') wardrobe(pc, { door, shake: f === 1 ? 1 : f === 2 ? -1 : 0 });
    else if (anim === 'move') wardrobe(pc, { door, shake: 0 });
    else if (anim === 'attack') wardrobe(pc, { door, shake: f ? 1 : -1 });
    else wardrobe(pc, { door, crack: true, shake: f ? 1 : -1 });
    pc.outline(OUT1);
  },
});

function moth(pc, up) {
  const wy = up ? 0 : 4;
  pc.tri(6, 4, 0, wy, 2, 9, '#c8bcd8'); pc.tri(6, 4, 12, wy, 10, 9, '#a89cc0');
  pc.px(3, up ? 3 : 5, '#4a3a5a'); pc.px(9, up ? 3 : 5, '#4a3a5a'); pc.px(3, up ? 4 : 6, EYE); pc.px(9, up ? 4 : 6, EYE);
  pc.vline(6, 2, 6, '#4a3a3a'); pc.px(6, 2, '#6a5a50');
  pc.px(5, 1, '#9a8aa0'); pc.px(7, 1, '#9a8aa0'); pc.px(4, 0, '#9a8aa0'); pc.px(8, 0, '#9a8aa0');
}
defineSprite('w4_moth', {
  w: 13, h: 10, ox: 6, oy: 5,
  anims: { idle: { frames: 2, fps: 14 }, move: { frames: 2, fps: 14 }, windup: { frames: 2, fps: 14 }, attack: { frames: 2, fps: 14 }, hurt: { frames: 2, fps: 14 } },
  draw(pc, anim, f) { moth(pc, f === 0); pc.outline(OUT1); },
});

class Moth extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w4_moth'; this.flying = true; this.centerPivot = true;
    this.w = 8; this.h = 6; this.x = x - 4; this.y = y - 3;
    this.vx = props.vx || 0; this.vy = props.vy || 0;
    this.hp = this.maxHp = 1;
    this.drops = { buttons: 0, heart: 0, energy: 0.05 };
    this.fabricColors = ['#d8d0e8', '#a898c0', '#fff6c8'];
    this.life = props.life ?? 7; this.alwaysUpdate = true;
    this.light = { r: 12, color: '#e0d0ff', i: 0.45, flicker: 0.4 };
    this.go('flutter');
  }
  think(dt) {
    this.stT += dt; this.life -= dt;
    this.setAnim('move');
    if (this.life <= 0) { this.level.particles.emit('dust', this.cx, this.cy, 3, { colors: ['#c8bcd8'] }); this.remove(); return; }
    const p = this.target(), lamp = lightAt(this.level, this.cx, this.cy, 60);
    const w = this.id * 1.7;
    if (this.stT < 0.45) { this.vx *= 0.96; this.vy += 80 * dt; } // recém-cuspida
    else if (lamp) { // mariposa adora luz: circula a lâmpada
      const a = this.t * 2.5 + w;
      this.vx = approach(this.vx, (lamp.cx + Math.cos(a) * 18 - this.cx) * 3, 200 * dt);
      this.vy = approach(this.vy, (lamp.cy - 10 + Math.sin(a) * 10 - this.cy) * 3, 200 * dt);
    } else if (p && !p.hidden) {
      const dx = p.cx - this.cx, dy = p.cy - 6 - this.cy, d = Math.hypot(dx, dy) || 1;
      this.vx = approach(this.vx, (dx / d) * 46 + Math.cos(this.t * 5 + w) * 30, 130 * dt);
      this.vy = approach(this.vy, (dy / d) * 46 + Math.sin(this.t * 7 + w) * 40, 170 * dt);
    } else {
      this.vx = approach(this.vx, Math.cos(this.t * 1.3 + w) * 30, 60 * dt);
      this.vy = approach(this.vy, Math.sin(this.t * 2.1 + w) * 20, 60 * dt);
    }
    this.facing = this.vx < 0 ? -1 : 1;
    this.physics(dt, { noGravity: true });
  }
  draw(ctx) { this.drawBody(ctx, this.life < 1 && !this.dying ? { alpha: this.life } : {}); }
}
registerEntity('w4_moth', Moth);

class Wardrobe extends PlushEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w4_wardrobe'; this.teleColor = '#ffe46a';
    this.w = 28; this.h = 44; this.alignToCell(x, y);
    this.hp = this.maxHp = 5; this.stompable = false; this.bindable = false;
    this.drops = { buttons: 6, heart: 0.25, energy: 0.4 };
    this.fabricColors = [WOODD[2], WOODD[1], EYE];
    this.deathSfx = 'break_block';
    this.moths = []; this.spitT = 1;
    this.setOpen(false);
    this.go('sleep');
  }
  setOpen(o) { this.isOpen = o; this.enemy = o; }
  onHit(dmg, src, info) {
    if (!this.isOpen) { // portas fechadas: só um "toc"
      this.flash = 0.05; audio.sfx('w4e_knock');
      this.level.particles.emit('hit', this.cx, this.cy, 2, { colors: [WOODD[1]] });
      return false;
    }
    return super.onHit(dmg, src, info);
  }
  think(dt) {
    this.stT += dt; this.spitT -= dt;
    this.moths = this.moths.filter((m) => !m.dead);
    const p = this.target();
    const near = p && !p.hidden && Math.abs(p.cx - this.cx) < 112 && Math.abs(p.cy - this.cy) < 72;
    this.facing = p && p.cx < this.cx ? -1 : 1;
    switch (this.state) {
      case 'sleep':
        this.setAnim('idle'); this.setOpen(false);
        if (near && this.canSee(p, 140)) { this.go('creak'); audio.sfx('w4e_creak'); }
        break;
      case 'creak': // portas rangem e se abrem (~0.5 s)
        this.setAnim('windup'); this.animT = Math.min(this.stT, 0.28);
        if (this.stT > 0.5) { this.setOpen(true); this.go('watch'); }
        break;
      case 'watch':
        this.setAnim('move');
        if (!near) { this.go('shut'); break; }
        if (this.spitT <= 0 && this.moths.length < 3) { this.go('gag'); audio.sfx('w4e_gag'); }
        break;
      case 'gag': // treme antes de cuspir (~0.45 s)
        this.setAnim('windup'); this.tele();
        if (this.stT > 0.45) { this.teleOn = false; this.spit(p); this.go('spit'); }
        break;
      case 'spit':
        this.setAnim('attack');
        if (this.stT > 0.4) { this.spitT = 2.6; this.go('watch'); }
        break;
      case 'shut':
        this.setAnim('windup'); this.animT = 0;
        if (this.stT > 0.3) { this.setOpen(false); this.go('sleep'); audio.sfx('w4e_knock', { pitch: 0.7 }); }
        break;
    }
  }
  spit(p) {
    const n = this.moths.length < 2 ? 2 : 1, dir = p && p.cx < this.cx ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const m = new Moth(this.level, this.cx, this.y + 20, { vx: dir * rand(55, 95), vy: rand(-110, -50) });
      this.level.add(m); this.moths.push(m);
    }
    audio.sfx('w4e_flutter');
    this.level.particles.emit('dust', this.cx, this.y + 20, 6, { colors: ['#c8bcd8', '#8a7aa0'] });
  }
  eyesPos() { // olhos no interior (afastados conforme a abertura das portas)
    const a = this.bodyAnim(), f = animFrame(this.sprite, a, a === 'hurt' ? this.t : this.animT);
    const d = this.state === 'sleep' ? 0 : (DOORS[a] || [0])[f] ?? 0;
    return { d, sep: d >= 3 ? 6 : d === 2 ? 4 : 1, y: this.bottom - 54 + 22 };
  }
  draw(ctx) {
    this.drawBody(ctx);
    if (this.dying) return;
    const { d, sep, y } = this.eyesPos();
    if (d > 0) {
      const p = this.target(), lx = p ? clamp((p.cx - this.cx) / 40, -1, 1) : 0, ly = p ? clamp((p.cy - y) / 40, -1, 1) : 0;
      glowEye(ctx, this.cx - sep - 3, y, lx, ly); glowEye(ctx, this.cx + sep, y, lx, ly);
    }
    this.drawStatus(ctx);
  }
  drawLight(L) {
    if (this.dying) return;
    const { d, y } = this.eyesPos();
    if (d > 0) L.add(this.cx, y + 1, d >= 2 ? 18 : 10, EYE, 0.65, 0.2);
    else if (animFrame(this.sprite, 'idle', this.animT) === 1) L.add(this.cx, this.bottom - 23, 5, EYE, 0.35);
  }
}
registerEntity('w4_wardrobe', Wardrobe);

registerLegend(4, { a: 'w4_underhand', b: 'w4_creepydoll', d: 'w4_shadowstalker', f: 'w4_mimic', g: 'w4_wardrobe' });

// ----------------------------------------------------------------- fase de teste
/** Abajur de teste (só nesta fase): tag 'lamp'; golpeie para ligar/desligar. */
class TestLamp extends Entity {
  constructor(level, x, y) {
    super(level, x, y);
    this.w = 10; this.h = 30; this.x = x + 3; this.y = y + TILE - 30; this.z = 5;
    this.tags.add('lamp'); this.hittable = true; this.setOn(true);
  }
  setOn(v) { this.on = v; this.light = v ? { r: 70, color: '#ffd890', i: 0.95, flicker: 0.15 } : null; }
  onHit() { if (this.t < 0.3) return false; this.t = 0; this.setOn(!this.on); audio.sfx('lever'); return true; }
  update(dt) { this.t += dt; }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#3a2a2a'; ctx.fillRect(x + 4, y + 10, 2, 18); ctx.fillRect(x + 1, y + 28, 8, 2);
    ctx.fillStyle = this.on ? '#ffe8a8' : '#7a6a5a'; ctx.fillRect(x, y + 2, 10, 8); ctx.fillRect(x + 2, y, 6, 2);
    ctx.fillStyle = this.on ? '#fff8e0' : '#5a4a40'; ctx.fillRect(x + 1, y + 3, 3, 5);
  }
}
function buildMap(W, H, ground, put) {
  const g = [];
  for (let r = 0; r < H; r++) g.push(Array(W).fill(r >= ground ? '#' : '.'));
  put((c, r, s) => { for (let i = 0; i < s.length; i++) g[r][c + i] = s[i]; });
  return g.map((a) => a.join(''));
}
registerLevel({
  id: 'test_enemies_w4', world: 0, index: 0, name: 'Teste: Inimigos do Mundo 4', subtitle: 'Teste',
  tileset: 'w4', background: 'w4', music: null, parTime: 120, darkness: 0.6,
  legend: { a: 'w4_underhand', b: 'w4_creepydoll', d: 'w4_shadowstalker', f: 'w4_mimic', g: 'w4_wardrobe' },
  map: buildMap(70, 18, 14, (put) => {
    put(1, 13, 'P'); put(68, 13, 'E');
    put(10, 13, 'a'); put(14, 13, 'a');
    put(22, 13, 'b');
    put(31, 11, 'd');
    put(36, 10, '====');
    put(52, 13, 'f'); for (let r = 14; r < 18; r++) put(57, r, '..');
    put(63, 13, 'g');
  }),
  onStart(level) { level.add(new TestLamp(level, 42 * TILE, 13 * TILE)); },
});
