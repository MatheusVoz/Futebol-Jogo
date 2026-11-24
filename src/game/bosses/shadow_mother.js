// =============================================================================
// bosses/shadow_mother.js — CHEFE DO MUNDO 4: "A MÃE DAS SOMBRAS" + fase w4_6
//
// Fase 'w4_6' "Debaixo de Tudo" (escuridão 0.85, Luzinha acompanha, música
// 'boss_shadow'): aproximação curta e escura (esconderijo, abajur, estrelas,
// checkpoint) e então a ARENA debaixo da cama: chão de assoalho, 3 vazados
// (o do meio, alto, fica logo abaixo do OLHO-NÚCLEO) e 4 ABAJURES de chefe
// (tag 'lamp', campo on). Bater num abajur o ACENDE (nunca apaga).
// Chefe 'boss_shadow_mother' (boss=true, 24 PV): silhueta gigante no alto da arena,
// cheia de olhos. O alvo é o olho-núcleo (hitbox); ele só ABRE (vulnerável)
// quando 2+ abajures estão acesos. Fora isso os golpes ricocheteiam.
//   Fase 1: MÃOS DE SOMBRA brotam do chão sob o alvo (rachadura brilha ~0.7 s).
//           Elas miram Enemy.target() → o Retalho Fantasma atrai as mãos.
//           Sombras queimam na luz: mãos não brotam dentro da luz de abajur aceso.
//   Fase 2 (≤16 PV): além das mãos, APAGA abajures (gavinha tracejada ~1.1 s,
//           o abajur pisca) e manda ONDAS DE SOMBRA rasteiras pelo chão (pule
//           ou fique num vazado; aviso na borda ~0.7 s). Reacenda os abajures.
//   Fase 3 (≤8 PV): ESCURIDÃO TOTAL — os abajures quebram; só a luz da Luzinha.
//           RAJADAS DE OLHOS (projéteis refletíveis, olhos acendem ~0.6 s antes);
//           depois de cada rajada ela ofega e o olho fica aberto ~3 s.
// Justiça: o olho é sólido para o Tico (a esquiva não atravessa) e encostar fere;
// não é pisável. Cutscenes 'boss4_intro' e 'boss4_defeat' (mem_8, Mundo 5).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, damp, rand, rectsOverlap } from '../../engine/util.js';
import { T as TT, moveBody } from '../../engine/tilemap.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { drawImage, hasImage } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { R, registerEntity, registerLevel, registerCutscene, makeScene } from '../registry.js';
import { getStats } from '../stats.js';
import { EnemyProjectile } from '../enemies/base.js';

const T = TILE;
const Rn = Math.round;
const MW = 110, MH = 20, FLOOR_ROW = 16;
const AX0 = 60 * T, AX1 = 108 * T, ATOP = 3 * T, AFLOOR = FLOOR_ROW * T;
const ACX = (AX0 + AX1) / 2;
const EYE = { w: 30, h: 22, cy: 7.6 * T };
const LOCK = { x: AX0 - 16, y: 0, w: AX1 - AX0 + 32, h: AFLOOR + 4 * T };
const LAMP_COLS = [63, 74, 94, 105];
const GOLD = '#ffe066', LAMPC = '#ffd870', VIOLET = '#9a6aff', DEEP = '#05030a', OUT = '#0a0614';

registerSfx('sm_crack', { wave: 'noise', freq: 600, freqEnd: 120, dur: 0.5, vol: 0.14, filter: { type: 'lowpass', freq: 700 } });
registerSfx('sm_grab', [{ wave: 'noise', freq: 1500, freqEnd: 300, dur: 0.15, vol: 0.18 }, { wave: 'triangle', freq: 120, freqEnd: 50, dur: 0.22, vol: 0.25 }]);
registerSfx('sm_whisper', { wave: 'noise', freq: 2400, freqEnd: 1800, dur: 0.6, vol: 0.05, filter: { type: 'bandpass', freq: 2200, q: 4 } });
registerSfx('sm_moan', { wave: 'saw', freq: 90, freqEnd: 60, dur: 0.9, vol: 0.12, vibrato: { rate: 5, depth: 0.5 }, filter: { type: 'lowpass', freq: 500 } });
registerSfx('sm_eye', { wave: 'square', duty: 0.2, freq: 1100, freqEnd: 600, dur: 0.16, vol: 0.06 });
registerSfx('sm_clink', { wave: 'square', freq: 300, freqEnd: 200, dur: 0.06, vol: 0.08 });

const playerAlive = (L) => L.player && L.player.state !== 'dead';
function lampsOn(L) { return L.entities.filter((e) => !e.dead && e.isBossLamp && e.on); }
function inLampLight(L, x, y) {
  for (const e of lampsOn(L)) if (Math.hypot(e.cx - x, e.y + 8 - y) < e.lightRadius * 0.8) return true;
  return false;
}
/** y do chão (sólido ou vazado) logo abaixo de (x, y). */
function groundBelow(L, x, y) {
  const map = L.map;
  for (let ty = Math.max(0, Math.floor(y / T)); ty < MH; ty++) {
    const t = map.get(Math.floor(x / T), ty);
    if (t === TT.SOLID || t === TT.ALT || t === TT.ONEWAY) return ty * T;
  }
  return AFLOOR;
}

// =============================================================================
// ABAJUR DO CHEFE — acende com golpe/Agulhada (nunca apaga com golpe)
// =============================================================================
class BossLamp extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 14; this.h = 24; this.x = x + 1; this.y = y + T - 24;
    this.tags.add('lamp'); this.isBossLamp = true;
    this.on = false; this.lightRadius = 5 * T; this.broken = false;
    this.hittable = true; this.flick = 0; this.warnT = 0; this.z = 15; this.alwaysUpdate = true;
  }
  setOn(v) {
    if (v === this.on || (v && this.broken)) return;
    this.on = v; this.flick = v ? 0.35 : 0;
    audio.sfx(v ? 'w4_lamp_on' : 'lever', { vol: 0.6 });
    this.level.particles.emit(v ? 'sparkle' : 'smoke', this.cx, this.y + 6, 8, v ? { colors: ['#fff4c0', LAMPC, '#ffffff'] } : {});
  }
  onHit() { if (this.broken) return false; if (!this.on) this.setOn(true); return true; }
  shatter() { this.on = false; this.broken = true; this.hittable = false; this.level.particles.emit('glass_shard', this.cx, this.y + 6, 8); audio.sfx('glass_crack'); }
  update(dt) { this.t += dt; if (this.flick > 0) this.flick -= dt; if (this.warnT > 0) this.warnT -= dt; }
  drawLight(lt) {
    if (!this.on) { if (!this.broken) lt.add(this.cx, this.y + 6, 12, '#806040', 0.4); return; }
    const fl = (this.flick > 0 && Math.floor(this.flick * 30) % 2) || (this.warnT > 0 && Math.floor(this.t * 14) % 2) ? 0.35 : 1;
    lt.add(this.cx, this.y + 8, this.lightRadius, LAMPC, fl, 0.04);
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.on) {
      ctx.globalAlpha = 0.12; ctx.fillStyle = LAMPC;
      for (let i = 0; i < 18; i++) ctx.fillRect(x + 5 - i * 0.6, y + 11 + i, 5 + i * 1.2, 1);
      ctx.globalAlpha = 1;
    }
    if (hasImage(this.on ? 'w4_lamp_on' : 'w4_lamp_off')) drawImage(ctx, this.on ? 'w4_lamp_on' : 'w4_lamp_off', x, y);
    else { ctx.fillStyle = '#5e5a74'; ctx.fillRect(x + 6, y + 10, 2, 13); ctx.fillStyle = this.on ? LAMPC : '#4a4058'; ctx.fillRect(x + 1, y + 2, 12, 8); }
    if (this.broken) { ctx.fillStyle = OUT; ctx.fillRect(x + 3, y + 4, 2, 1); ctx.fillRect(x + 8, y + 6, 3, 1); ctx.fillRect(x + 5, y + 2, 1, 4); }
    else if (!this.on && Math.floor(this.t * 2) % 2) { ctx.fillStyle = GOLD; ctx.fillRect(x + 6, y - 4, 2, 2); } // dica: "bata em mim"
  }
}
registerEntity('sm_lamp', BossLamp);

// =============================================================================
// MÃO DE SOMBRA — rachadura (aviso) → irrompe → recua. Não brota na luz.
// =============================================================================
class ShadowHand extends Entity {
  constructor(level, x, floorY) {
    super(level, x - 7, floorY - 4, {});
    this.w = 14; this.h = 4; this.floorY = floorY; this.state = 'crack'; this.st = 0; this.reach = 0;
    this.z = 45; this.alwaysUpdate = true; this.enemy = false; this.contactDamage = 1;
    audio.sfx('sm_crack', { vol: 0.7 });
  }
  setReach(k) { this.reach = k; this.h = Math.max(4, Rn(50 * k)); this.y = this.floorY - this.h; this.enemy = k > 0.25; }
  update(dt) {
    this.t += dt; this.st += dt;
    const L = this.level;
    if (this.state === 'crack') {
      if (Math.random() < dt * 20) L.particles.emit('dust', this.cx + rand(-6, 6), this.floorY - 1, 1);
      if (this.st > 0.7) {
        if (inLampLight(L, this.cx, this.floorY - 10)) { L.particles.emit('smoke', this.cx, this.floorY - 6, 6); audio.sfx('sm_whisper'); this.remove(); return; }
        this.state = 'grab'; this.st = 0; audio.sfx('sm_grab'); L.particles.emit('shadow', this.cx, this.floorY - 4, 8);
      }
    } else if (this.state === 'grab') {
      this.setReach(Math.min(1, this.st / 0.1));
      if (this.st > 0.55) { this.state = 'back'; this.st = 0; }
    } else {
      this.setReach(Math.max(0, 1 - this.st / 0.35));
      if (this.st > 0.35) this.remove();
    }
  }
  draw(ctx) {
    const x = Rn(this.cx), fy = Rn(this.floorY);
    if (this.state === 'crack') { // rachadura brilhando + olhinhos
      const k = Math.min(1, this.st / 0.7), w = Rn(6 + 10 * k);
      ctx.fillStyle = OUT; ctx.fillRect(x - w, fy - 1, w * 2, 2);
      ctx.fillStyle = Math.floor(this.st * 16) % 2 ? '#ff7a3a' : '#c84a2a';
      for (let i = -w; i < w; i += 3) ctx.fillRect(x + i, fy - 1 - ((i * 7) & 1), 2, 1);
      if (k > 0.5) { ctx.fillStyle = GOLD; ctx.fillRect(x - 3, fy - 3, 2, 1); ctx.fillRect(x + 2, fy - 3, 2, 1); }
      return;
    }
    const top = Rn(this.y);
    ctx.fillStyle = DEEP;
    ctx.fillRect(x - 5, top + 6, 11, fy - top - 6);                              // braço
    ctx.fillRect(x - 8, top + 2, 17, 8);                                         // palma
    for (const [dx, h] of [[-8, 6], [-4, 9], [0, 10], [4, 9], [8, 5]]) ctx.fillRect(x + dx, top + 2 - h + 4, 2, h); // dedos em garra
    ctx.fillStyle = '#2a1c48';
    ctx.fillRect(x - 5, top + 6, 1, fy - top - 6); ctx.fillRect(x - 8, top + 2, 1, 6);
    ctx.fillStyle = GOLD; ctx.fillRect(x - 3, top + 6, 2, 2); ctx.fillRect(x + 2, top + 6, 2, 2);
  }
  drawLight(L) { if (this.state === 'crack') L.add(this.cx, this.floorY, 22, '#ff6a3a', 0.8, 0.3); else L.add(this.cx, this.y + 8, 14, GOLD, 0.5); }
}

// =============================================================================
// ONDA DE SOMBRA — rasteira, atravessa a arena (pule!)
// =============================================================================
class ShadowWave extends Entity {
  constructor(level, dir) {
    const x = dir > 0 ? AX0 + 2 : AX1 - 18;
    super(level, x, AFLOOR - 14, {});
    this.w = 16; this.h = 14; this.dir = dir; this.st = 0; this.z = 44; this.alwaysUpdate = true;
    this.enemy = false; this.contactDamage = 1;
  }
  update(dt) {
    this.t += dt; this.st += dt;
    if (this.st < 0.7) return; // aviso na borda
    this.enemy = true;
    this.x += this.dir * 125 * dt;
    if (Math.random() < 0.5) this.level.particles.emit('shadow', this.cx, this.bottom - 2, 1);
    if (this.x < AX0 - 20 || this.x > AX1 + 4) this.remove();
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.st < 0.7) {
      ctx.fillStyle = Math.floor(this.st * 14) % 2 ? VIOLET : '#4a2a88';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 3, y + 10 - (i & 1) * 2, 2, 4 + (i & 1) * 2);
      return;
    }
    ctx.fillStyle = DEEP;
    for (let i = 0; i < 16; i++) { const h = Rn(8 + 5 * Math.sin(i * 0.5 + this.t * 12)); ctx.fillRect(x + i, y + 14 - h, 1, h); }
    ctx.fillStyle = VIOLET; ctx.fillRect(x + (this.dir > 0 ? 12 : 2), y + 4, 2, 1);
    ctx.fillStyle = GOLD; ctx.fillRect(x + 6, y + 7, 1, 1); ctx.fillRect(x + 9, y + 7, 1, 1);
  }
  drawLight(L) { if (this.st >= 0.7) L.add(this.cx, this.cy, 16, VIOLET, 0.45); }
}

// =============================================================================
// O CHEFE
// =============================================================================
let BODY = null;
function bodyCanvas() {
  if (BODY) return BODY;
  const W = 360, H = 170, pc = new PixelCanvas(W, H);
  const cx = W / 2;
  pc.ellipse(cx, 70, 150, 62, '#07040e');
  pc.ellipse(cx, 60, 120, 52, DEEP);
  for (let i = 0; i < 9; i++) { // gavinhas pendendo
    const x0 = 40 + i * 35, len = 50 + ((i * 37) % 40);
    for (let y = 100; y < 100 + len; y++) { const w = Math.max(1, Rn(7 * (1 - (y - 100) / len))); pc.hline(Rn(x0 + Math.sin(y * 0.08 + i) * 6) - (w >> 1), y, w, DEEP); }
  }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { // "braços" ao longo do teto
    pc.thickLine(cx + s * 60, 40 + k * 10, cx + s * (150 + k * 12), 20 + k * 30, 5 - k, DEEP);
  }
  for (let a = -2.7; a < -0.4; a += 0.03) pc.px(Rn(cx + Math.cos(a) * 120), Rn(60 + Math.sin(a) * 52), '#2a1c48'); // borda roxa
  pc.flush();
  BODY = pc;
  return pc;
}
const SIDE_EYES = [[-90, -18, 5], [-62, -34, 4], [-40, 10, 3], [58, -30, 4], [88, -12, 5], [44, 14, 3], [-110, 6, 3], [112, 4, 3], [-20, -40, 3], [24, -42, 3]];

class ShadowMother extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = EYE.w; this.h = EYE.h; this.x = ACX - EYE.w / 2; this.y = EYE.cy - EYE.h / 2;
    this.boss = true; this.bossName = 'A Mãe das Sombras';
    this.hp = this.maxHp = 24;
    this.hittable = true; this.enemy = false; this.stompable = false; this.bindable = false;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 5;
    this.fighting = false; this.state = 'dormant'; this.st = 0; this.phase = 1;
    this.handT = 1.5; this.snuffT = 5; this.waveT = 4; this.barrage = 0; this.openK = 0; this.alpha = 0;
    this.invuln = 0; this.hintCd = 0; this.darkT = level.data.darkness ?? 0.85;
    this.snuffing = null;
  }
  go(s) { this.state = s; this.st = 0; }
  get vulnerable() {
    if (!this.fighting || this.state === 'defeated') return false;
    if (this.phase >= 3) return this.state === 'tired';
    return lampsOn(this.level).length >= 2;
  }
  beginFight() {
    const L = this.level;
    this.fighting = true; this.alpha = 1; L.boss = this; this.go('idle');
    if (save.data.abilities?.decoy) save.data.equippedAbility = 'decoy';
    L.toast('Acenda 2 abajures para abrir o olho! O Retalho Fantasma atrai as mãos.', 'icon_ab_decoy');
  }
  clink() {
    audio.sfx('sm_clink');
    this.level.particles.emit('shadow', this.cx, this.cy, 3);
    if (this.hintCd <= 0) { this.hintCd = 5; this.level.toast(this.phase >= 3 ? 'Espere ela cansar... o olho vai abrir!' : 'O olho está fechado. Acenda mais abajures!', 'icon_memory'); }
  }
  onHit(dmg, src, info) {
    if (!this.vulnerable || this.invuln > 0) { this.clink(); return false; }
    return this.hurt(dmg, src);
  }
  hurt(amount = 1) {
    if (!this.vulnerable || this.invuln > 0) return false;
    const L = this.level;
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 0.12; this.invuln = 0.25;
    audio.sfx('enemy_hurt', { pitch: 0.5 }); L.hitstop(0.05); L.shake(0.12);
    L.particles.emit('shadow', this.cx, this.cy, 8);
    if (this.hp <= 0) { this.defeat(); return true; }
    if (this.phase === 1 && this.hp <= 16) this.toPhase(2);
    else if (this.phase === 2 && this.hp <= 8) this.toPhase(3);
    return true;
  }
  toPhase(n) {
    const L = this.level;
    this.phase = n; this.go('roar');
    audio.sfx('boss_roar', { pitch: 0.5 }); audio.sfx('sm_moan'); L.shake(0.4); L.flash(VIOLET, 0.2);
    for (const e of L.entities) if (e instanceof ShadowHand || e instanceof ShadowWave) e.remove();
    if (n === 2) L.toast('Ela apaga a luz! Reacenda os abajures.', 'icon_memory');
    if (n === 3) {
      for (const l of L.entities) if (l.isBossLamp) l.shatter();
      this.darkT = 0.97;
      L.toast('Escuridão total... fique perto da Luzinha!', 'icon_memory');
    }
  }
  defeat() {
    const L = this.level;
    this.fighting = false; this.go('defeated'); this.hittable = false;
    for (const e of L.entities) if (e instanceof ShadowHand || e instanceof ShadowWave || e instanceof EnemyProjectile) e.remove();
    audio.sfx('boss_roar', { pitch: 0.4 }); L.shake(0.6); L.flash('#ffffff', 0.3);
    this.darkT = 0.6;
  }
  spawnHand(tx) {
    const L = this.level;
    const t = tx ?? L.player;
    const x = clamp(t.cx + rand(-4, 4), AX0 + 10, AX1 - 10);
    L.add(new ShadowHand(L, x, groundBelow(L, x, t.bottom - 4)));
  }
  pickTarget() {
    const L = this.level, d = L.decoy;
    return d && !d.dead ? d : L.player; // as mãos caçam o Retalho Fantasma quando existe
  }
  update(dt) {
    this.t += dt; this.st += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hintCd > 0) this.hintCd -= dt;
    const L = this.level;
    if (typeof L.data.darkness === 'number') L.data.darkness = damp(L.data.darkness, this.darkT, 1.2, dt);
    this.openK = damp(this.openK, this.vulnerable ? 1 : 0, 10, dt);
    if (this.fighting) this.think(dt);
    if (this.state === 'defeated') {
      this.alpha = Math.max(0, 1 - this.st / 2.2);
      if (!this.csStarted && this.st > 1.6) { this.csStarted = true; L.cutscene('boss4_defeat', { boss: this }); }
    }
    if (this.fighting) this.solidVsPlayer();
  }
  think(dt) {
    const L = this.level;
    if (!playerAlive(L)) return;
    if (this.state === 'roar') { if (this.st > 1.2) this.go('idle'); return; }
    // mãos de sombra (todas as fases)
    this.handT -= dt;
    if (this.handT <= 0) {
      const n = this.phase === 1 ? 1 : 2;
      this.handT = this.phase === 1 ? 2.2 : this.phase === 2 ? 2.6 : 3.4;
      const tgt = this.pickTarget();
      this.spawnHand(tgt);
      if (n > 1) this.spawnHand({ cx: tgt.cx + rand(40, 70) * (Math.random() < 0.5 ? -1 : 1), bottom: tgt.bottom });
    }
    if (this.phase === 2) {
      // apagar abajures
      if (!this.snuffing) {
        this.snuffT -= dt;
        const lit = lampsOn(L);
        if (this.snuffT <= 0 && lit.length) { this.snuffing = lit[(Math.random() * lit.length) | 0]; this.snuffing.warnT = 1.1; this.snuffT = 6.5; audio.sfx('sm_whisper'); }
      } else if (this.snuffing.warnT <= 0) { this.snuffing.setOn(false); this.snuffing = null; }
      // ondas rasteiras
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = 5.2; L.add(new ShadowWave(L, Math.random() < 0.5 ? 1 : -1)); }
    }
    if (this.phase === 3) {
      if (this.state === 'idle' && this.st > 1.6) { this.go('charge'); audio.sfx('sm_moan', { pitch: 1.3 }); }
      else if (this.state === 'charge' && this.st > 0.6) { this.go('barrage'); this.barrage = 0; this.volleyT = 0; }
      else if (this.state === 'barrage') {
        this.volleyT -= dt;
        if (this.volleyT <= 0) {
          this.volleyT = 0.75; this.barrage++;
          const p = L.player, srcs = [[this.cx, this.cy], [ACX - 90, EYE.cy - 18], [ACX + 88, EYE.cy - 12]];
          const [sx, sy] = srcs[this.barrage % 3];
          const base = Math.atan2(p.cy - sy, p.cx - sx);
          for (let i = -1; i <= 1; i++) {
            const a = base + i * 0.32;
            L.add(new EnemyProjectile(L, sx, sy, { vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, life: 3.2, color: GOLD, w: 5, h: 5, solidStop: false }));
          }
          audio.sfx('sm_eye');
        }
        if (this.barrage >= 4) { this.go('tired'); audio.sfx('sm_moan', { pitch: 0.7 }); }
      } else if (this.state === 'tired' && this.st > 3.2) this.go('idle');
    }
  }
  /** Olho sólido: empurra o Tico (a esquiva não atravessa) e fere ao encostar. */
  solidVsPlayer() {
    const L = this.level, p = L.player;
    if (!p || p.state === 'dead' || !rectsOverlap(p, this)) return;
    if (!(p.invuln > 0)) p.hurt(1, this);
    const opts = [{ dx: this.x - p.right, dy: 0 }, { dx: this.right - p.x, dy: 0 }, { dx: 0, dy: this.y - p.bottom }, { dx: 0, dy: this.bottom - p.y }]
      .sort((a, b) => Math.abs(a.dx + a.dy) - Math.abs(b.dx + b.dy));
    for (const o of opts) { moveBody(p, o.dx, o.dy, L, {}); if (o.dy > 0 && p.vy < 0) p.vy = 0; if (!rectsOverlap(p, this)) break; }
  }
  drawLight(L) {
    if (this.alpha <= 0.05) return;
    const a = this.alpha;
    for (const [dx, dy, r] of SIDE_EYES) if (this.eyeOpen(dx)) L.add(ACX + dx, EYE.cy + dy, 6 + r * 2, GOLD, 0.35 * a);
    L.add(this.cx, this.cy, 18 + this.openK * 22, this.openK > 0.5 ? '#ff6a5a' : VIOLET, 0.6 * a, 0.1);
    if (this.snuffing) L.add(this.snuffing.cx, this.snuffing.y + 4, 16, VIOLET, 0.6);
  }
  eyeOpen(dx) {
    const charge = this.state === 'charge' || this.state === 'barrage';
    return charge || ((this.t * 0.25 + dx * 0.013) % 1 + 1) % 1 < 0.7;
  }
  draw(ctx) {
    if (this.alpha <= 0) return;
    const B = bodyCanvas();
    const bob = Rn(Math.sin(this.t * 0.8) * 3);
    ctx.globalAlpha = this.alpha;
    ctx.drawImage(B.canvas, Rn(ACX - B.w / 2), Rn(EYE.cy - 70 + bob));
    // olhos laterais
    const p = this.level.player;
    for (const [dx, dy, r] of SIDE_EYES) {
      if (!this.eyeOpen(dx)) continue;
      const ex = Rn(ACX + dx), ey = Rn(EYE.cy + dy + bob);
      ctx.fillStyle = this.state === 'charge' && Math.floor(this.st * 14) % 2 ? '#ffffff' : GOLD;
      ctx.fillRect(ex - r, ey - 1, r * 2, 2); ctx.fillRect(ex - r + 1, ey - 2, r * 2 - 2, 4);
      ctx.fillStyle = OUT;
      const lk = p ? clamp(Math.round((p.cx - ex) / 60), -r + 1, r - 2) : 0;
      ctx.fillRect(ex + lk, ey - 1, 1, 2);
    }
    // olho-núcleo
    const cx = Rn(this.cx), cy = Rn(this.cy + bob), k = this.openK;
    const ry = Math.max(1, Rn(10 * k));
    ctx.fillStyle = '#2a1c48'; ctx.fillRect(cx - 16, cy - 1, 32, 2);
    if (ry > 1) {
      for (let y = -ry; y <= ry; y++) { const w = Rn(15 * Math.sqrt(1 - (y / (ry + 0.5)) ** 2)); ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#ffe9a0'; ctx.fillRect(cx - w, cy + y, w * 2, 1); }
      const ix = p ? clamp(Rn((p.cx - cx) / 30), -6, 6) : 0, iy = p ? clamp(Rn((p.cy - cy) / 40), -2, 2) : 0;
      ctx.fillStyle = '#c8203a'; ctx.fillRect(cx + ix - 5, cy + iy - Math.min(5, ry), 10, Math.min(10, ry * 2));
      ctx.fillStyle = OUT; ctx.fillRect(cx + ix - 1, cy + iy - Math.min(4, ry), 3, Math.min(8, ry * 2));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx + ix - 3, cy + iy - 2, 1, 1);
    } else { // pálpebra fechada costurada
      ctx.fillStyle = VIOLET; for (let i = -14; i <= 14; i += 4) ctx.fillRect(cx + i, cy - 2, 1, 4);
    }
    // gavinha que apaga um abajur (aviso)
    if (this.snuffing) {
      const l = this.snuffing, n = 30;
      ctx.fillStyle = Math.floor(this.t * 12) % 2 ? VIOLET : DEEP;
      for (let i = 0; i < n; i++) {
        if ((i + Math.floor(this.t * 20)) % 3 === 0) continue;
        const u = i / n;
        ctx.fillRect(Rn(cx + (l.cx - cx) * u + Math.sin(u * 9 + this.t * 6) * 4), Rn(cy + (l.y + 4 - cy) * u), 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}
registerEntity('boss_shadow_mother', ShadowMother);

// =============================================================================
// ARENA — gatilho, trava da câmera, parede de sombra atrás do Tico
// =============================================================================
class ShadowArena extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 60; this.started = false; this.closeK = 0;
  }
  start() {
    const L = this.level, b = L._mother;
    this.started = true;
    L.camera.lockTo(LOCK);
    audio.sfx('rumble'); L.shake(0.2);
    L.cutscene('boss4_intro', { boss: b }).then(() => { if (b && b.state !== 'defeated') b.beginFight(); });
  }
  update(dt) {
    this.t += dt;
    const L = this.level, p = L.player;
    if (!p) return;
    if (!this.started && playerAlive(L) && p.x > AX0 + 24) this.start();
    if (!this.started) return;
    this.closeK = Math.min(1, this.closeK + dt * 1.5);
    if (p.x < AX0) { p.x = AX0; if (p.vx < 0) p.vx = 0; }
  }
  draw(ctx) {
    if (this.closeK <= 0) return;
    const h = Rn((AFLOOR - ATOP) * this.closeK);
    ctx.fillStyle = DEEP;
    for (let i = 0; i < 8; i++) for (let y = 0; y < h; y += 2) ctx.fillRect(Rn(AX0 - 8 + i + Math.sin(y * 0.2 + this.t * 3 + i) * 1.5), AFLOOR - y, 1, 2);
    ctx.fillStyle = GOLD;
    for (let k = 0; k < 3; k++) { const yy = AFLOOR - 20 - k * 40; if (h > AFLOOR - yy && (this.t + k) % 3 < 2.6) { ctx.fillRect(AX0 - 6, yy, 1, 1); ctx.fillRect(AX0 - 3, yy, 1, 1); } }
  }
}
registerEntity('sm_arena', ShadowArena);

// =============================================================================
// CUTSCENES
// =============================================================================
registerCutscene('boss4_intro', {
  run: function* (cs) {
    const L = cs.level, b = cs.params.boss || L._mother;
    const first = !save.flag('boss4_seen');
    yield* cs.pan(ACX, EYE.cy + 40, 1.0);
    if (first) yield* cs.say([{ who: 'luzinha', expr: 'scared', text: 'Tico... o chão está respirando. E aqueles pontinhos lá em cima não são estrelas.' }]);
    cs.sfx('sm_moan'); cs.shake(0.3);
    for (let i = 0; i < 20; i++) { if (b) b.alpha = (i + 1) / 20; yield 0.05; }
    cs.flash('#9a6aff', 0.25); cs.sfx('boss_roar', { pitch: 0.45 });
    yield* cs.title('A Mãe das Sombras', 'O Medo Debaixo de Tudo', 2.6);
    if (first) {
      yield* cs.say([
        { who: 'mae_sombras', text: 'Shhh... volte para debaixo das cobertas, brinquedinho. Aqui embaixo, quem manda sou eu.', shake: true },
        { who: 'tico', expr: 'scared', text: 'Eu... eu não tenho medo de você!' },
        { who: 'mae_sombras', text: 'Todos têm. É assim que deve ser.' },
        { who: 'luzinha', expr: 'determined', text: 'As sombras odeiam luz! Acenda os abajures, que eu fico do seu lado!' },
      ]);
      save.setFlag('boss4_seen'); save.commit();
    }
    yield* cs.panTo(cs.player, 0.6);
  },
});

function giveMemory(L) {
  const id = 'mem_8', p = L.player;
  L.collect('memory', 1, 'w4_6:mem_8', { id });
  audio.sfx('star', { pitch: 0.8 });
  L.particles.emit('stars_burst', p.cx, p.cy, 14, { colors: ['#e8d8ff', '#ffffff', '#ffd23f'] });
  const title = R.memories?.get?.(id)?.title;
  L.toast(title ? `Memória: ${title}` : 'Memória recuperada!', 'icon_memory');
  save.commit();
  const sc = makeScene('memory_view', id, { onClose: () => {} });
  if (sc) game.scenes.push(sc);
}
registerCutscene('boss4_defeat', {
  run: function* (cs) {
    const L = cs.level, p = cs.player;
    const finish = () => { save.unlockWorld(5); save.commit(); L.complete({ delay: 1 }); };
    yield* cs.pan(ACX, EYE.cy + 30, 0.8);
    cs.particles('shadow', ACX, EYE.cy, 20);
    yield* cs.say([
      { who: 'mae_sombras', text: 'Você me desfez, pequeno... Mas sabe o que eu era?' },
      { who: 'mae_sombras', text: 'Eu sou o medo que mantém as crianças debaixo das cobertas... e ele, longe delas.' },
      { who: 'mae_sombras', text: 'Agora, nada mais o segura.', shake: true },
      { who: 'tico', expr: 'surprised', text: 'Ele...? O Costureiro?' },
      { who: 'luzinha', expr: 'sad', text: 'Ela também era um nó... Tico, a gente precisa correr.' },
    ]);
    L.data.darkness = 0.4;
    cs.flash('#ffffff', 0.4);
    yield 0.4;
    giveMemory(L);
    yield 0.8;
    yield* cs.panTo(p, 0.5);
    finish();
  },
});

// =============================================================================
// FASE w4_6 — "Debaixo de Tudo"
// =============================================================================
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < MW) g[y][x] = c; };
  const put = (x, y, c) => { g[y][x] = c; };
  fill(0, FLOOR_ROW, MW - 1, MH - 1, '#');          // assoalho
  fill(0, 0, 1, FLOOR_ROW, '#');                    // parede esquerda
  // ---- aproximação escura
  fill(2, 0, 57, 1, '#');                           // estrado da cama (teto)
  fill(10, 13, 14, 15, '%');                        // colchão caído
  fill(18, 12, 22, 12, '=');
  fill(26, 15, 29, 15, '^');                        // pregos
  fill(33, 11, 37, 13, '#'); fill(34, 14, 36, 14, '^');
  fill(42, 12, 46, 12, '=');
  fill(50, 10, 52, 15, '%');                        // pilha de livros
  put(4, 15, 'P'); put(7, 15, 'l'); put(24, 15, 'm'); put(40, 15, 'b');
  put(20, 11, '*'); put(35, 10, '*'); put(51, 9, '*');
  put(31, 15, 'e'); put(44, 11, 'h');
  put(55, 15, 'K');
  // ---- arena debaixo de tudo
  fill(58, 0, MW - 1, 2, '#');                      // teto
  fill(58, 3, 59, 12, '#');                         // batente (a passagem fica embaixo)
  fill(108, 0, MW - 1, FLOOR_ROW, '#');             // parede direita
  fill(64, 13, 68, 13, '='); fill(100, 13, 104, 13, '=');
  fill(80, 10, 88, 10, '=');                        // plataforma sob o olho
  fill(76, 13, 78, 13, '='); fill(90, 13, 92, 13, '=');
  return g.map((r) => r.join(''));
}
function setupLevel(L) {
  L.data = { ...L.data };                          // cópia: a escuridão muda na luta
  for (const c of LAMP_COLS) L.add(new BossLamp(L, c * T, (FLOOR_ROW - 1) * T, {}));
  const boss = new ShadowMother(L, 0, 0, {});
  L.add(boss); L._mother = boss;
  L.add(new ShadowArena(L, 0, 0, {}));
}
registerLevel({
  id: 'w4_6', world: 4, index: 6, name: 'Debaixo de Tudo', subtitle: 'Mundo 4-6 · Chefe',
  music: 'boss_shadow', tileset: 'w4', background: 'w4', timeOfDay: 'night', boss: true,
  parTime: 240, darkness: 0.85, luzinha: true, ambient: 'w4_dust',
  map: buildMap(),
  props: { '24,15': { on: true }, '7,15': { kind: 'blanket' } },
  onStart(level) { setupLevel(level); },
});
