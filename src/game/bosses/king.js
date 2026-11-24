// =============================================================================
// bosses/king.js — CHEFE DO MUNDO 3: "O REI DO SEGUNDO PERDIDO" + fase w3_6
//
// Fase 'w3_6' "A Sala do Último Segundo" (entardecer, música 'boss_king'):
//   Subida curta (plataformas vazadas + muro de engrenagens, 3 estrelas, checkpoint)
//   até a ARENA-MOSTRADOR (camera.lockTo). O chão da arena são 6 SEGMENTOS de
//   mostrador (king_segment, entidades sólidas) sobre um fosso raso de engrenagens
//   (king_gears: fere e arremessa para cima — dá para pular de volta).
// Chefe 'boss_king' (Enemy, boss=true, ~28 PV × poder). Flutua um pouco acima do chão.
//   Fase 1: CETRO-PÊNDULO (ergue 0,8 s com arco pontilhado → varre a frente; depois
//           fica ofegante = janela para o chicote), PONTEIROS arremessados
//           (EnemyProjectile refletível). O Remendo Temporal devolve os ponteiros
//           TELEGUIADOS ao rei: dano grande + atordoado (pode pisar). O Tico ensina
//           isso numa fala no primeiro arremesso.
//   Fase 2 (≤66%): PARE! — CONGELA o tempo 1,5 s (tela sépia, Tico congelado) e
//           crava 4 ponteiros em volta dele, que disparam 0,4 s após o degelo.
//           LAÇO: o pêndulo (king_pendulum, rewindable) brilha e o rei ameaça
//           "voltar o segundo" (recupera a vida perdida nos últimos 6 s). O pêndulo
//           fica SELADO (selo roxo), exceto enquanto brilha: Remendo Temporal nele
//           quebra o laço (rei atordoado) e acaba com a recuperação nesta fase.
//           Segmentos do chão somem/voltam como ponteiros de relógio (piscam antes).
//   Fase 3 (≤33%): o tempo ACELERA — tudo mais rápido; o laço volta a ameaçar.
//   FINAL: 0 PV → cutscene 'boss3_defeat' ("Talvez crescer não seja esquecer.",
//          mem_6, Mundo 4 liberado).
// Justiça: corpo sólido (empurra; a esquiva não atravessa), encostar fere (em cima
// também); pisar só vale atordoado. Fora das janelas o chicote dá 35% do dano.
// Cutscenes: 'boss3_intro' (ao entrar na arena; curta nas tentativas), 'boss3_defeat'.
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, lerp, rand, damp, rectsOverlap } from '../../engine/util.js';
import { moveBody } from '../../engine/tilemap.js';
import { defineSprite, drawSprite, getSprite, hasSprite, animFrame } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { R, registerEntity, registerLevel, registerCutscene, makeScene } from '../registry.js';
import { getStats } from '../stats.js';
import { Enemy, EnemyProjectile } from '../enemies/base.js';
import { spawnShockwave, spawnFloatingText, drawGlow } from '../art/vfx.js';

// ----------------------------------------------------------------- geometria
const T = TILE;
const MW = 86, MH = 24, FR = 18;
const FLOOR = FR * T;                         // topo dos segmentos / chão
const AX0 = 53 * T, AX1 = 83 * T, ATOP = 4 * T;
const ACX = (AX0 + AX1) / 2;
const LOCK = { x: AX0 - 16, y: ATOP - 16, w: AX1 - AX0 + 32, h: 20 * T - ATOP + 16 };
const KW = 40, KH = 52, HOVER = 3;
const XMIN = AX0 + KW / 2 + 4, XMAX = AX1 - KW / 2 - 4;
const SEG_N = 6, SEG_W = (AX1 - AX0) / SEG_N;

// ----------------------------------------------------------------- paleta
const OUT = '#2a1a10', GOLD = ['#7a4a14', '#b07818', '#e0a83a', '#ffe08a'];
const FACE = '#f8f0dc', CAPE = ['#3a1a4a', '#5a2a6a', '#7a3e8a'], RUBY = '#e0304a', SAPH = '#4a7fe0';
const AMBER = '#ffcf6a', VIOLET = '#b97aff';
const Rn = Math.round;

registerSfx('king_tick', [{ wave: 'square', freq: 1800, dur: 0.03, vol: 0.08, filter: { type: 'bandpass', freq: 2200, q: 3 } }]);
registerSfx('king_freeze', [
  { wave: 'sine', freq: 1200, freqEnd: 200, dur: 0.6, vol: 0.18 },
  { wave: 'noise', freq: 3000, dur: 0.5, vol: 0.08, filter: { type: 'bandpass', freq: 1500, freqEnd: 400, q: 2 } },
]);
registerSfx('king_unfreeze', [{ wave: 'sine', freq: 200, freqEnd: 1100, dur: 0.4, vol: 0.16 }]);

// =============================================================================
// ARTE
// =============================================================================
const SPW = 64, SPH = 72, SOX = 32, SOY = 71;
defineSprite('king_body', {
  w: SPW, h: SPH, ox: SOX, oy: SOY,
  anims: { idle: { frames: 2, fps: 3 }, stun: { frames: 1, fps: 1 } },
  draw(pc, anim, f) {
    const sw = f ? 1 : 0, stun = anim === 'stun';
    // capa
    pc.poly([[16, 30], [48, 30], [55 + sw, 66], [9 - sw, 66]], CAPE[1]);
    pc.poly([[16, 30], [24, 30], [16 - sw, 66], [9 - sw, 66]], CAPE[0]);
    pc.rect(10, 62, 45, 3, '#f0e8f0'); for (let x = 11; x < 55; x += 3) pc.px(x, 63, '#20202a');   // arminho
    // perninhas e sapatos
    pc.rect(24, 60, 4, 8, GOLD[1]); pc.rect(36, 60, 4, 8, GOLD[1]);
    pc.rect(21, 67, 8, 3, '#3a2418'); pc.rect(35, 67, 8, 3, '#3a2418');
    // bracinho esquerdo (o direito segura o cetro, desenhado à parte)
    pc.thickLine(14, 42, 7, 50, 1.5, GOLD[1]); pc.circle(7, 51, 2, GOLD[2]);
    // caixa do relógio
    pc.circle(32, 40, 21, GOLD[1]); pc.circle(31, 39, 20, GOLD[2]); pc.ellipse(26, 30, 7, 4, GOLD[3]);
    pc.circle(32, 40, 16, GOLD[0]); pc.circle(32, 40, 15, FACE);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = i % 3 === 0 ? 11 : 12;
      for (let k = r; k <= 13; k++) pc.px(Rn(32 + Math.sin(a) * k), Rn(40 - Math.cos(a) * k), '#5a4a3a');
    }
    // rosto
    if (stun) {
      for (const ex of [26, 38]) for (let i = -1; i <= 1; i++) { pc.px(ex + i, 36 + i, '#2a1a10'); pc.px(ex + i, 36 - i, '#2a1a10'); }
      pc.ellipse(32, 47, 2, 1.5, '#2a1a10');
    } else {
      pc.rect(25, 35, 3, 4, '#2a1a10'); pc.rect(37, 35, 3, 4, '#2a1a10'); pc.px(26, 35, '#ffffff'); pc.px(38, 35, '#ffffff');
      pc.line(23, 33, 28, 34, '#2a1a10'); pc.line(41, 33, 36, 34, '#2a1a10');
      pc.line(29, 48, 35, 48, '#2a1a10'); pc.px(28, 49, '#2a1a10'); pc.px(36, 49, '#2a1a10');
    }
    // haste + coroa
    pc.rect(29, 17, 6, 3, GOLD[1]); pc.rect(30, 16, 4, 1, GOLD[3]);
    pc.rect(20, 10, 24, 6, GOLD[2]); pc.rect(20, 10, 24, 1, GOLD[3]);
    pc.tri(20, 10, 23, 2, 26, 10, GOLD[2]); pc.tri(29, 10, 32, 0, 35, 10, GOLD[2]); pc.tri(38, 10, 41, 2, 44, 10, GOLD[2]);
    pc.circle(32, 13, 1.5, RUBY); pc.px(25, 13, SAPH); pc.px(39, 13, SAPH); pc.px(32, 1, '#ffffff');
    pc.outline(OUT);
  },
});

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); ctx.fillRect(Rn(cx - w), Rn(cy + y), w * 2 + 1, 1); }
}
function pxLine(ctx, x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) ctx.fillRect(Rn(lerp(x0, x1, i / n)), Rn(lerp(y0, y1, i / n)), w, w);
}

// =============================================================================
// PROJÉTEIS / ARENA
// =============================================================================
/** Ponteiro de relógio. Refletido (Remendo Temporal) volta TELEGUIADO ao rei. */
class KingHand extends EnemyProjectile {
  constructor(level, x, y, props = {}) {
    super(level, x, y, { w: 8, h: 8, life: 5, color: AMBER, reflectable: true, ...props });
    this.hold = props.hold || 0; this.fvx = this.vx; this.fvy = this.vy;
    if (this.hold > 0) { this.vx = 0; this.vy = 0; }
    this.ang = Math.atan2(this.fvy, this.fvx);
    this.light = { r: 14, color: AMBER, i: 0.5 };
  }
  reflect() {
    if (!super.reflect()) return false;
    const k = this.level._king;
    if (k) { const dx = k.cx - this.cx, dy = k.cy - this.cy, d = Math.hypot(dx, dy) || 1; this.vx = (dx / d) * 260; this.vy = (dy / d) * 260; }
    this.hold = 0; this.life = 3; this.ang = Math.atan2(this.vy, this.vx);
    return true;
  }
  update(dt) {
    const k = this.level._king;
    if (k && k.timeFrozen && !this.reflected) { this.t += 0; return; }
    if (this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) { this.vx = this.fvx; this.vy = this.fvy; }
      else { this.t += dt; return; }
    }
    if (this.reflected && k && !k.dead) {   // persegue o rei
      const dx = k.cx - this.cx, dy = k.cy - this.cy, d = Math.hypot(dx, dy) || 1;
      this.vx = damp(this.vx, (dx / d) * 280, 6, dt); this.vy = damp(this.vy, (dy / d) * 280, 6, dt);
      this.ang = Math.atan2(this.vy, this.vx);
    }
    super.update(dt);
  }
  draw(ctx) {
    const cx = this.cx, cy = this.cy, c = Math.cos(this.ang), s = Math.sin(this.ang);
    const col = this.reflected ? '#8ff0ff' : AMBER;
    drawGlow(ctx, Rn(cx), Rn(cy), 8, col, 0.35);
    if (this.hold > 0 && Math.floor(this.t * 12) % 2 === 0) pxLine(ctx, cx, cy, cx + c * 26, cy + s * 26, 'rgba(255,207,106,0.5)');
    pxLine(ctx, cx - c * 6, cy - s * 6, cx + c * 6, cy + s * 6, OUT, 2);
    pxLine(ctx, cx - c * 5, cy - s * 5, cx + c * 5, cy + s * 5, col);
    ctx.fillStyle = col;
    ctx.fillRect(Rn(cx + c * 6 - s * 2), Rn(cy + s * 6 + c * 2), 1, 1); ctx.fillRect(Rn(cx + c * 6 + s * 2), Rn(cy + s * 6 - c * 2), 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Rn(cx + c * 6), Rn(cy + s * 6), 1, 1);
  }
}
registerEntity('king_hand', KingHand);

/** Segmento do chão-mostrador (sólido). Some/volta na fase 2+ (pisca antes). */
class KingSegment extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.i = props.i || 0; this.w = SEG_W; this.h = T; this.x = AX0 + this.i * SEG_W; this.y = FLOOR;
    this.solid = true; this.z = 5; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.warnT = 0; this.goneT = 0; this.k = 1;
  }
  vanish(warn, gone) { if (this.warnT > 0 || this.goneT > 0) return; this.warnT = warn; this.goneDur = gone; }
  restore() { this.warnT = 0; this.goneT = 0.001; }
  update(dt) {
    this.t += dt;
    if (this.warnT > 0) {
      this.warnT -= dt;
      if (this.warnT <= 0) { this.solid = false; this.goneT = this.goneDur; audio.sfx('king_tick', { pitch: 0.5 }); }
    } else if (this.goneT > 0) {
      this.goneT -= dt;
      if (this.goneT <= 0) {
        this.solid = true; this.goneT = 0;
        const p = this.level.player;
        if (p && rectsOverlap(p, this)) { p.y = this.y - p.h; p.vy = Math.min(p.vy, 0); }
        audio.sfx('king_tick', { pitch: 1.4 });
      }
    }
    this.k = damp(this.k, this.solid ? 1 : 0, 12, dt);
  }
  draw(ctx) {
    if (this.k < 0.05) return;
    const x = Rn(this.x), y = Rn(this.y), w = Rn(this.w);
    const blink = this.warnT > 0 && Math.floor(this.t * 12) % 2 === 0;
    ctx.globalAlpha = this.k;
    ctx.fillStyle = OUT; ctx.fillRect(x, y, w, 12);
    ctx.fillStyle = blink ? '#ff9a7a' : GOLD[2]; ctx.fillRect(x + 1, y, w - 2, 3);
    ctx.fillStyle = blink ? '#c0503a' : GOLD[1]; ctx.fillRect(x + 1, y + 3, w - 2, 7);
    ctx.fillStyle = FACE; ctx.fillRect(x + 4, y + 4, w - 8, 4);
    ctx.fillStyle = '#5a4a3a';
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 8 + i * Math.floor((w - 16) / 4), y + 4, 1, i % 2 ? 2 : 4);
    ctx.fillStyle = GOLD[3]; ctx.fillRect(x + 1, y, w - 2, 1);
    ctx.fillStyle = OUT; ctx.fillRect(x + Rn(w / 2) - 1, y + 10, 3, 6);   // haste
    ctx.globalAlpha = 1;
  }
}
registerEntity('king_segment', KingSegment);

/** Engrenagens no fundo do fosso: ferem e jogam o Tico para cima. */
class KingGears extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.x = AX0; this.w = AX1 - AX0; this.y = FLOOR + T + 6; this.h = 10;
    this.enemy = true; this.contactDamage = 1; this.z = 4; this.alwaysUpdate = true; this.alwaysDraw = true;
  }
  update(dt) { this.t += dt; }
  onTouchPlayer(p) { p.vy = -330; }
  draw(ctx) {
    const y = FLOOR + 2 * T;
    for (let gx = AX0 + 8; gx < AX1; gx += 16) {
      const a = this.t * 3 * ((gx / 16) % 2 ? 1 : -1);
      fillEllipse(ctx, gx, y - 2, 7, 7, GOLD[0]);
      ctx.fillStyle = GOLD[1];
      for (let i = 0; i < 8; i++) { const an = a + (i / 8) * Math.PI * 2; ctx.fillRect(Rn(gx + Math.cos(an) * 8) - 1, Rn(y - 2 + Math.sin(an) * 8) - 1, 2, 2); }
      fillEllipse(ctx, gx, y - 2, 2, 2, OUT);
    }
  }
}
registerEntity('king_gears', KingGears);

/** Cetro-pêndulo: arma do rei e alvo do Remendo Temporal (selado fora do brilho). */
class KingPendulum extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 12; this.h = 12; this.z = 31; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.rewindable = true; this.sealed = true; this.ang = 0; this.tick = 0;
  }
  get king() { return this.level._king; }
  captureState() { return { a: this.ang, k: this.tick++ }; }
  restoreState(s) { this.ang = s.a; }
  onRewindStart() { if (!this.sealed) this.king?.breakLoop(); }
  update(dt) {
    this.t += dt;
    const k = this.king;
    if (!k || k.dead) return;
    if (!this.rewinding) this.ang = k.pendAng;
    this.sealed = !k.loopOpen;
    const b = k.bob(this.ang);
    this.x = b.x - 6; this.y = b.y - 6;
  }
  draw(ctx) {
    const k = this.king;
    if (!k || k.alpha <= 0) return;
    const pv = k.pivot(), b = { x: this.cx, y: this.cy };
    pxLine(ctx, pv.x, pv.y, b.x, b.y, OUT, 2);
    pxLine(ctx, pv.x, pv.y, b.x, b.y, GOLD[2]);
    if (k.loopOpen) drawGlow(ctx, Rn(b.x), Rn(b.y), 18 + Rn(Math.sin(this.t * 10) * 3), '#8ff0ff', 0.6);
    fillEllipse(ctx, b.x, b.y, 6, 6, OUT); fillEllipse(ctx, b.x, b.y, 5, 5, k.loopOpen ? '#bff6ff' : GOLD[2]);
    fillEllipse(ctx, b.x - 1, b.y - 1, 2, 2, '#ffffff');
    if (this.sealed && k.phase >= 2 && !k.loopBroken) {   // selo roxo
      ctx.fillStyle = VIOLET;
      for (let i = 0; i < 8; i++) { const a = this.t * 2 + (i / 8) * Math.PI * 2; ctx.fillRect(Rn(b.x + Math.cos(a) * 8), Rn(b.y + Math.sin(a) * 8), 1, 1); }
    }
    if (k.loopBroken && k.phase >= 2) { pxLine(ctx, b.x - 3, b.y - 3, b.x + 2, b.y + 3, OUT); }
  }
}
registerEntity('king_pendulum', KingPendulum);

// =============================================================================
// O CHEFE
// =============================================================================
const FIGHT = new Set(['idle', 'walk', 'swingwind', 'swing', 'panting', 'throwwind', 'teach', 'stunned',
  'freezewind', 'frozen', 'selfrewind']);
const WEAK = { panting: 1, stunned: 1 };
const PATTERNS = {
  1: ['swing', 'throw', 'swing', 'throw', 'walk'],
  2: ['freeze', 'swing', 'throw', 'swing'],
  3: ['throw', 'freeze', 'swing', 'throw', 'swing', 'freeze'],
};

class KingBoss extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.boss = true; this.bossName = 'O Rei do Segundo Perdido';
    this.bindable = false; this.flying = true; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.z = 30; this.w = KW; this.h = KH;
    this.place(ACX + 120);
    this.maxHp = this.hp = Math.max(18, Math.round(28 * (getStats().power || 1)));
    this.drops = { buttons: 0 };
    this.phase = 1; this.state = 'dormant'; this.st = 0; this.qi = 0; this.pending = 0;
    this.facing = -1; this.alpha = 1; this.pendAng = 0.25; this.handA = 0;
    this.hpHist = []; this.histT = 0; this.loopT = 9; this.loopOpen = false; this.loopBroken = false;
    this.timeFrozen = false; this.taught = {}; this.segT = 3;
    this.setActive(false);
  }
  setActive(on) { this.hittable = on; this.contact = on; this.enemy = on; this.stompable = false; }
  get fighting() { return FIGHT.has(this.state); }
  get weak() { return WEAK[this.state] !== undefined; }
  get spd() { return [1, 1, 1.1, 1.35][this.phase]; }
  get tele() { return [1, 1, 0.92, 0.75][this.phase]; }
  place(cx, bottom = FLOOR - HOVER) { this.x = cx - this.w / 2; this.y = bottom - this.h; }
  go(s) {
    this.state = s; this.st = 0; this.fired = 0;
    const stun = s === 'stunned';
    this.contact = this.enemy = FIGHT.has(s) && !stun;
    this.hittable = FIGHT.has(s);
    this.stompable = stun;
  }
  pivot() { return { x: this.cx + this.facing * 16, y: this.y + 32 }; }
  /** Posição da bola do pêndulo para o ângulo a (0 = para baixo; + = para a frente). */
  bob(a) { const p = this.pivot(); return { x: p.x + Math.sin(a) * 52 * this.facing, y: p.y + Math.cos(a) * 22 }; }

  // ---------------------------------------------------------------- entrada
  beginFight() {
    const L = this.level;
    L.boss = this;
    if (save.data.abilities?.rewind) save.data.equippedAbility = 'rewind';
    this.light = { r: 60, color: AMBER, i: 0.45 };
    this.go('idle'); this.idleDelay = 0.8;
  }

  // ---------------------------------------------------------------- dano
  die() {}
  unstitch() { return false; }
  onStomp(p) {
    if (!this.stompable || (this.stompCd || 0) > 0) { p.vy = -280; p.vx = (p.cx < this.cx ? -1 : 1) * 170; p.hurt(1, this); return; }
    this.stompCd = 0.6;
    this.hurt(2 * (p.stats?.power || 1), p, { raw: true });
  }
  onHit(dmg, src, info = {}) {
    if (info.kind === 'reflect') return this.hurt(3.5, src, { raw: true, reflect: true });
    return this.hurt(dmg, src);
  }
  hurt(amount = 1, src = null, opts = {}) {
    if (!this.fighting || this.invuln > 0 || this.state === 'teach') return false;
    const mul = opts.raw ? 1 : this.weak ? 1 : 0.35;
    const floor = this.phase === 1 ? this.maxHp * (2 / 3) : this.phase === 2 ? this.maxHp / 3 : 0;
    this.hp = Math.max(floor, this.hp - amount * mul);
    this.flash = 0.1; this.invuln = 0.08;
    const L = this.level;
    if (mul >= 1) {
      audio.sfx('boss_hit', { randomPitch: 0.08 });
      L.particles.emit('hit', this.cx, this.cy, 6, { colors: [AMBER, '#ffffff', GOLD[2]] });
      L.shake(0.12);
    } else { audio.sfx('armor_clink', { cooldown: 0.1 }); L.particles.emit('hit', this.cx, this.cy, 2); }
    if (opts.reflect) {
      L.hitstop(0.08); spawnShockwave(L, this.cx, this.cy, { radius: 26, color: '#8ff0ff' });
      if (this.state !== 'stunned' && this.state !== 'freezewind') this.stun(2);
    }
    if (this.phase < 3 && this.hp <= floor + 0.001) this.pending = this.phase + 1;
    else if (this.phase === 3 && this.hp <= 0) this.defeat();
    return true;
  }
  stun(s) {
    this.unfreeze();
    this.go('stunned'); this.stunDur = s; this.pendAng = 0;
    spawnFloatingText(this.level, this.cx, this.y - 10, 'Tonto! Pule nele!', '#ffd23f');
  }
  /** Remendo Temporal no pêndulo brilhante: o laço do tempo se parte. */
  breakLoop() {
    if (!this.loopOpen || !this.fighting) return;
    const L = this.level;
    this.loopOpen = false; this.loopBroken = true;
    audio.sfx('glass_crack'); audio.sfx('clock_chime', { pitch: 0.6 });
    L.flash('#8ff0ff', 0.2); L.shake(0.3);
    spawnFloatingText(L, this.cx, this.y - 22, 'O laço quebrou!', '#8ff0ff');
    this.stun(2.6);
  }
  defeat() {
    const L = this.level;
    this.hp = 0; this.pending = 0; this.loopOpen = false;
    this.unfreeze();
    this.go('defeated');
    L.boss = null; this.setActive(false);
    this.clearHazards();
    for (const s of L._kingSegs || []) s.restore();
    audio.sfx('clock_chime', { pitch: 0.5 }); audio.sfx('explosion', { vol: 0.5 });
    audio.stopMusic?.(2);
    L.shake(0.5); L.hitstop(0.15); L.flash('#fff2c8', 0.25);
  }
  clearHazards() { for (const e of this.level.entities) if (!e.dead && e instanceof KingHand) e.remove(); }

  // ---------------------------------------------------------------- ataques
  next() {
    const pat = PATTERNS[this.phase];
    const k = pat[this.qi++ % pat.length];
    if (k === 'swing') this.go('walk'), (this.after = 'swingwind');
    else if (k === 'throw') this.go('throwwind');
    else if (k === 'freeze') this.go('freezewind');
    else { this.go('walk'); this.after = null; }
  }
  throwHands() {
    const L = this.level, t = this.target(), n = this.phase >= 3 ? 4 : 3, sp = 125 * this.spd;
    const ox = this.cx, oy = this.y + 22;
    const base = Math.atan2((t?.cy ?? oy) - oy, (t?.cx ?? ox + this.facing) - ox);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.22;
      L.add(new KingHand(L, ox, oy, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hold: i * 0.12 }));
    }
    audio.sfx('whoosh'); audio.sfx('clock_tick');
  }
  freezeTime() {
    const L = this.level, p = L.player;
    this.timeFrozen = true;
    audio.sfx('king_freeze');
    if (p && p.state !== 'dead') { p.state = 'frozen'; p.vx = 0; }
    // 4 ponteiros cravados em volta do Tico (disparam depois do degelo)
    if (p) for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4 + rand(-0.2, 0.2), r = 76;
      const x = clamp(p.cx + Math.cos(a) * r, AX0 + 8, AX1 - 8), y = clamp(p.cy + Math.sin(a) * r, ATOP + 8, FLOOR - 6);
      const d = Math.hypot(p.cx - x, p.cy - y) || 1, sp = 150 * this.spd;
      L.add(new KingHand(L, x, y, { vx: ((p.cx - x) / d) * sp, vy: ((p.cy - y) / d) * sp, hold: 0.45 + i * 0.12 }));
    }
  }
  unfreeze() {
    if (!this.timeFrozen) return;
    this.timeFrozen = false;
    const p = this.level.player;
    if (p && p.state === 'frozen') { p.state = 'normal'; p.cutsceneAnim = null; }
    audio.sfx('king_unfreeze');
  }
  startTransition() {
    const L = this.level;
    this.clearHazards(); this.unfreeze();
    this.phase = this.pending; this.pending = 0; this.qi = 0;
    this.loopBroken = false; this.loopOpen = false; this.loopT = 6;
    this.go('transition'); this.contact = this.enemy = false; this.hittable = false;
    audio.sfx('clock_chime'); audio.sfx('boss_roar', { pitch: 1.3, vol: 0.6 });
    L.shake(0.4); L.flash(AMBER, 0.2);
    spawnFloatingText(L, this.cx, this.y - 14, this.phase === 2 ? 'Ninguém sai do meu segundo!' : 'Mais rápido! MAIS RÁPIDO!', AMBER);
    L.spawn('heart', ACX - 8, FLOOR - 40);
  }

  think(dt) {
    const L = this.level, t = this.target(), s = this.state;
    if (this.pending && this.fighting && s !== 'frozen') { this.startTransition(); return; }
    const faceT = () => { if (t && Math.abs(t.cx - this.cx) > 6) this.facing = t.cx < this.cx ? -1 : 1; };
    const restAng = 0.25 + Math.sin(this.t * 2) * 0.1;
    switch (s) {
      case 'idle':
        faceT(); this.pendAng = damp(this.pendAng, restAng, 6, dt);
        if (this.st >= (this.idleDelay ?? 0.8)) { this.idleDelay = [0, 0.8, 0.6, 0.4][this.phase]; this.next(); }
        break;
      case 'walk': {
        faceT(); this.pendAng = damp(this.pendAng, restAng, 6, dt);
        const want = this.after ? 46 : 90;
        const dx = (t ? t.cx : ACX) - this.cx;
        if (Math.abs(dx) > want) this.place(clamp(this.cx + Math.sign(dx) * 62 * this.spd * dt, XMIN, XMAX));
        if ((Math.abs(dx) <= want + 2 || this.st > 1.8) && this.st > 0.3) { if (this.after) { const a = this.after; this.after = null; this.go(a); } else this.go('idle'); }
        break;
      }
      case 'swingwind': {
        const dur = 0.8 * this.tele;
        this.pendAng = damp(this.pendAng, -2.5, 10, dt);
        if (Math.floor(this.st * 8) !== Math.floor((this.st - dt) * 8)) audio.sfx('king_tick');
        if (this.st >= dur) { audio.sfx('whip_big', { pitch: 0.6 }); this.go('swing'); }
        break;
      }
      case 'swing': {
        const dur = 0.36 / this.spd;
        this.pendAng = lerp(-2.5, 2.3, Math.min(1, this.st / dur));
        const b = this.bob(this.pendAng), p = L.player;
        if (p && p.state !== 'dead' && Math.hypot(clamp(b.x, p.x, p.right) - b.x, clamp(b.y, p.y, p.bottom) - b.y) < 8) p.hurt(1, this);
        if (this.st >= dur) { L.shake(0.15); this.go('panting'); }
        break;
      }
      case 'panting':
        this.pendAng = damp(this.pendAng, 0.3, 3, dt);
        if (this.st >= [0, 1.3, 1.0, 0.8][this.phase]) this.go('idle');
        break;
      case 'throwwind':
        faceT();
        if (!this.taught.throw && save.data.abilities?.rewind) { this.taught.throw = true; this.go('teach'); this.teach('throw'); break; }
        if (this.st >= 0.6 * this.tele) { this.throwHands(); this.idleDelay = 0.9; this.go('idle'); }
        break;
      case 'teach': break;
      case 'freezewind':
        faceT();
        if (Math.floor(this.st * 10) !== Math.floor((this.st - dt) * 10)) audio.sfx('king_tick', { pitch: 1 + this.st });
        if (this.st >= 0.8 * this.tele) { this.freezeTime(); this.go('frozen'); }
        break;
      case 'frozen':
        if (this.st >= (this.phase >= 3 ? 1.2 : 1.5)) { this.unfreeze(); this.idleDelay = 1.0; this.go('idle'); }
        break;
      case 'stunned':
        this.pendAng = damp(this.pendAng, 0, 4, dt);
        if (this.st >= this.stunDur) { this.idleDelay = 0.5; this.go('idle'); }
        break;
      case 'selfrewind': {
        // "volta, segundo!": a vida perdida nos últimos 6 s retorna
        if (this.st >= 0.9) {
          const floor = this.phase === 2 ? this.maxHp / 3 : 0;
          const old = this.hpHist.length ? Math.max(...this.hpHist.map((h) => h.hp)) : this.hp;
          const gain = Math.max(0, old - this.hp);
          this.hp = Math.min(this.maxHp * (this.phase === 2 ? 2 / 3 : 1 / 3), Math.max(floor, old));
          this.loopOpen = false; this.loopT = 9;
          audio.sfx('rewind_cast'); L.flash('#8ff0ff', 0.15);
          if (gain > 0.1) spawnFloatingText(L, this.cx, this.y - 16, `+${Math.round(gain)} segundos!`, '#8ff0ff');
          this.go('idle');
        }
        break;
      }
      case 'transition':
        this.place(damp(this.cx, ACX, 3, dt));
        if (this.st >= 1.8) { this.idleDelay = 0.6; this.go('idle'); }
        break;
      case 'defeated':
        this.pendAng = damp(this.pendAng, 0, 2, dt);
        if (!this.csStarted && this.st >= 1.2) { this.csStarted = true; L.cutscene('boss3_defeat', { boss: this }); }
        break;
      default: break;
    }
    // --- laço do tempo (fase 2+): o pêndulo brilha por 2,6 s, depois ele volta a vida
    if (this.phase >= 2 && !this.loopBroken && save.data.abilities?.rewind && this.fighting && !this.timeFrozen) {
      if (!this.loopOpen) {
        this.loopT -= dt;
        if (this.loopT <= 0 && this.hpHist.some((h) => h.hp > this.hp + 0.5)) {
          this.loopOpen = true; this.loopWin = 2.6; audio.sfx('magic_hum');
          if (!this.taught.loop) { this.taught.loop = true; this.teach('loop'); }
        } else if (this.loopT <= 0) this.loopT = 1;
      } else if (this.state !== 'teach' && this.state !== 'stunned') {
        this.loopWin -= dt;
        if (this.loopWin <= 0 && this.state !== 'selfrewind' && this.state !== 'swing') this.go('selfrewind');
      }
    }
    // --- segmentos do chão (fase 2+)
    if (this.phase >= 2 && this.fighting) {
      this.segT -= dt;
      if (this.segT <= 0) {
        this.segT = this.phase >= 3 ? 2.6 : 3.4;
        const segs = (L._kingSegs || []).filter((g) => g.solid && g.warnT <= 0);
        const p = L.player, under = segs.find((g) => p && p.cx >= g.x && p.cx < g.x + g.w);
        const pool = segs.filter((g) => g !== under || Math.random() < 0.5);
        for (let i = 0; i < 2 && pool.length; i++) pool.splice(Math.floor(Math.random() * pool.length), 1)[0].vanish(1.0 * this.tele, 2.4);
      }
    }
  }
  teach(kind) {
    const L = this.level;
    const lines = kind === 'throw'
      ? [{ who: 'tico', expr: 'determined', text: 'Ponteiros voando! Se eu usar o Remendo Temporal quando chegarem perto... eles voltam pra ele!' }]
      : [{ who: 'tico', expr: 'surprised', text: 'O pêndulo está brilhando... ele vai voltar o tempo! Remendo Temporal no pêndulo, rápido!' }];
    const prev = this.state;
    if (kind === 'loop') { this.loopWin = 3.2; }
    L.say(lines).then(() => {
      if (this.state === 'teach') { this.throwHands(); this.idleDelay = 0.9; this.go('idle'); }
      else if (prev === 'teach') this.go('idle');
    });
  }

  update(dt) {
    this.tickTimers(dt);
    if (this.stompCd > 0) this.stompCd -= dt;
    // fase 3: o tempo dele corre mais rápido
    const k = this.phase >= 3 && this.fighting ? 1.15 : 1;
    this.st += dt * k;
    this.handA += dt * (this.timeFrozen ? 0 : this.phase >= 3 ? 9 : this.state === 'selfrewind' ? -12 : 1.2);
    if (this.fighting) {
      this.histT -= dt;
      if (this.histT <= 0) { this.histT = 0.25; this.hpHist.push({ hp: this.hp, t: this.t }); }
      this.hpHist = this.hpHist.filter((h) => this.t - h.t <= 6);
    }
    if (this.state === 'dormant') return;
    this.think(dt * k);
    if (this.fighting || this.state === 'transition') this.solidVsPlayer();
  }
  /** Corpo sólido: empurra o Tico (a esquiva não atravessa) e fere ao encostar. */
  solidVsPlayer() {
    const L = this.level, p = L.player;
    if (!p || p.state === 'dead' || !rectsOverlap(p, this)) return;
    if (this.stompable && p.vy > 40 && p.bottom - this.y < 12) return;   // a pisada é resolvida pela fase
    if (this.contact && !(p.invuln > 0)) p.hurt(1, this);
    const opts = [
      { dx: this.x - p.right, dy: 0 }, { dx: this.right - p.x, dy: 0 },
      { dx: 0, dy: this.y - p.bottom }, { dx: 0, dy: this.bottom - p.y },
    ].sort((a, b) => Math.abs(a.dx + a.dy) - Math.abs(b.dx + b.dy));
    for (const o of opts) {
      moveBody(p, o.dx, o.dy, L, {});
      if (o.dx < 0 && p.vx > 0) p.vx = -60; if (o.dx > 0 && p.vx < 0) p.vx = 60;
      if (o.dy < 0) p.vy = this.contact ? -200 : Math.min(p.vy, 0);
      if (!rectsOverlap(p, this)) break;
    }
    if (p.state === 'dash') { p.state = 'normal'; p.dashT = 0; }
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    const s = this.state, f = this.facing, bx = Rn(this.cx), by = Rn(this.bottom);
    // telegrafia do pêndulo: arco pontilhado
    if (s === 'swingwind') {
      const blink = Math.floor(this.st * 12) % 2 === 0;
      ctx.fillStyle = blink ? 'rgba(255,170,120,0.8)' : 'rgba(255,170,120,0.4)';
      for (let a = -2.4; a <= 2.3; a += 0.12) { const b = this.bob(a); if (a > -0.6) ctx.fillRect(Rn(b.x), Rn(b.y), 2, 1); }
    }
    if (s === 'freezewind') {
      const k = this.st / (0.8 * this.tele);
      ctx.fillStyle = `rgba(255,207,106,${0.3 + 0.4 * k})`;
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + this.t * 3, r = 40 - k * 16; ctx.fillRect(Rn(this.cx + Math.cos(a) * r), Rn(this.cy + Math.sin(a) * r), 2, 2); }
    }
    drawGlow(ctx, bx, Rn(this.cy), 34, s === 'selfrewind' ? '#8ff0ff' : AMBER, 0.25);
    fillEllipse(ctx, bx, FLOOR - 1, 16, 2, 'rgba(20,10,10,0.35)');
    const bobY = Rn(Math.sin(this.t * 2.5) * 1.5);
    drawSprite(ctx, 'king_body', s === 'stunned' || s === 'defeated' ? 'stun' : 'idle', animFrame('king_body', 'idle', this.t), bx, by + 2 + bobY, {
      flip: f < 0, variant: this.flash > 0 ? 'flash' : undefined, alpha: this.alpha,
    });
    // ponteiros do mostrador
    const cx = bx + (f < 0 ? 0 : 0), cy = by + 2 + bobY - 31;
    const hm = this.handA, hh = this.handA / 12;
    pxLine(ctx, cx, cy, cx + Math.sin(hm) * 11, cy - Math.cos(hm) * 11, OUT);
    pxLine(ctx, cx, cy, cx + Math.sin(hh) * 7, cy - Math.cos(hh) * 7, '#7a2a2a');
    ctx.fillStyle = GOLD[3]; ctx.fillRect(cx - 1, cy - 1, 2, 2);
    // braço do cetro
    const pv = this.pivot();
    pxLine(ctx, this.cx + f * 12, this.y + 26 + bobY, pv.x, pv.y, GOLD[1], 2);
    if (s === 'stunned') {
      for (let i = 0; i < 3; i++) { const a = this.t * 5 + i * 2.1; ctx.fillStyle = i % 2 ? '#ffd23f' : '#ffffff'; ctx.fillRect(Rn(this.cx + Math.cos(a) * 14), Rn(this.y - 4 + Math.sin(a) * 3), 2, 2); }
    }
  }
}
registerEntity('boss_king', KingBoss);

// =============================================================================
// ARENA
// =============================================================================
class KingArena extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 60;
    this.started = false; this.closeK = 0; this.energyT = 5; this.side = 0;
  }
  start() {
    const L = this.level, b = L._king;
    this.started = true;
    L.camera.lockTo(LOCK);
    audio.sfx('rumble'); L.shake(0.2);
    L.cutscene('boss3_intro', { boss: b }).then(() => { if (b && b.state === 'dormant') b.beginFight(); });
  }
  update(dt) {
    this.t += dt;
    const L = this.level, p = L.player;
    if (!p) return;
    if (!this.started && p.state !== 'dead' && p.cx > AX0 + 24 && p.cy > ATOP) this.start();
    if (!this.started) return;
    this.closeK = Math.min(1, this.closeK + dt * 2);
    if (p.x < AX0) { p.x = AX0; if (p.vx < 0) p.vx = 0; }
    const b = L._king;
    if (b && b.fighting) {
      this.energyT -= dt;
      if (this.energyT <= 0) {
        this.energyT = 7;
        const E = R.entities.get('energy');
        const have = L.entities.some((e) => !e.dead && e.constructor === E && e.x > AX0 && e.x < AX1);
        if (!have && p.energy < p.maxEnergy * 0.6) {
          this.side ^= 1;
          const x = this.side ? 80 * T : 55 * T;
          L.spawn('energy', x, 13 * T);
          L.particles.emit('sparkle', x + 8, 13 * T + 8, 6);
        }
      }
    }
  }
  draw(ctx) {
    if (this.closeK <= 0) return;
    // grade de engrenagens fechando a entrada
    const h = Rn(3 * T * this.closeK), x = AX0 - 6;
    ctx.fillStyle = OUT; ctx.fillRect(x - 1, FLOOR - h, 6, h);
    ctx.fillStyle = GOLD[1]; ctx.fillRect(x, FLOOR - h, 4, h);
    ctx.fillStyle = GOLD[3]; for (let y = FLOOR - h; y < FLOOR; y += 6) ctx.fillRect(x, y, 4, 1);
  }
}
registerEntity('king_arena', KingArena);

// sobreposição de tela: sépia do tempo congelado / aceleração da fase 3
function drawOverlay(ctx, L) {
  const k = L._king;
  if (!k) return;
  const { w, h } = game.view;
  if (k.timeFrozen) {
    ctx.fillStyle = 'rgba(200,160,90,0.28)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,230,170,0.6)';
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; ctx.fillRect(Rn(w / 2 + Math.cos(a) * (h * 0.45)), Rn(h / 2 + Math.sin(a) * (h * 0.45)), i % 5 ? 1 : 3, i % 5 ? 1 : 3); }
  } else if (k.phase >= 3 && k.fighting) {
    ctx.fillStyle = 'rgba(255,120,60,0.06)'; ctx.fillRect(0, 0, w, h);
  }
}

// =============================================================================
// CUTSCENES
// =============================================================================
registerCutscene('boss3_intro', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._king;
    if (!b) return;
    const first = !save.seen('boss3_intro');
    yield 0.2;
    yield* cs.panTo(b, 1.0);
    cs.sfx('clock_chime'); cs.shake(0.2);
    yield 0.5;
    if (first) {
      yield* cs.title('O Rei do Segundo Perdido', 'Guardião da Cidade dos Relógios', 2.6);
      yield* cs.say([
        { who: 'rei', expr: 'angry', text: 'Tic... tac... NÃO! Nada de "tac"! Neste salão o segundo NUNCA acaba!' },
        { who: 'tico', expr: 'confused', text: 'Um relógio de bolso... de coroa? Você é que parou a cidade inteira?' },
        { who: 'rei', expr: 'neutral', text: 'Se o tempo não anda, ninguém cresce. E se ninguém cresce... ninguém esquece os brinquedos.' },
        { who: 'tico', expr: 'determined', text: 'Mas ficar parado pra sempre também é se perder. Vou fazer esse relógio andar!' },
      ]);
    } else yield 0.3;
    yield* cs.panTo(p, 0.6);
  },
});

function drawMemoryOrb(ctx, a, t) {
  drawGlow(ctx, Rn(a.x), Rn(a.y), 16, '#d8b8ff', 0.6);
  if (hasSprite('obj_memory')) drawSprite(ctx, 'obj_memory', 'idle', animFrame('obj_memory', 'idle', t), Rn(a.x), Rn(a.y));
  else { fillEllipse(ctx, a.x, a.y, 4, 4, '#e8d8ff'); }
}
function giveMemory(L) {
  const id = 'mem_6', p = L.player;
  L.collect('memory', 1, 'w3_6:mem_6', { id });
  audio.sfx('star', { pitch: 0.8 });
  spawnShockwave(L, p.cx, p.cy, { radius: 34, color: '#d8b8ff' });
  L.particles.emit('stars_burst', p.cx, p.cy, 14, { colors: ['#e8d8ff', '#ffffff', '#ffd23f'] });
  const title = R.memories?.get?.(id)?.title;
  L.toast(title ? `Memória: ${title}` : 'Memória recuperada!', 'icon_memory');
  save.commit();
  const sc = makeScene('memory_view', id, { onClose: () => {} });
  if (sc) game.scenes.push(sc);
}

registerCutscene('boss3_defeat', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._king;
    const finish = () => { save.unlockWorld(4); save.commit(); L.complete({ delay: 1 }); };
    if (!b) { finish(); return; }
    yield* cs.walk(p, clamp(b.cx + (p.cx < b.cx ? -40 : 40), AX0 + 10, AX1 - 10), 80);
    cs.face(p, p.cx < b.cx ? 'right' : 'left');
    yield 0.3;
    yield* cs.say([
      { who: 'rei', expr: 'sad', text: 'Pare... por favor. Se o ponteiro andar, a menina que me carregava vai crescer de vez.' },
      { who: 'tico', expr: 'sad', text: 'Ela vai crescer de qualquer jeito. Mas isso não quer dizer que vai te esquecer.' },
      { who: 'rei', expr: 'surprised', text: '...Não?' },
    ]);
    // ele deixa o tempo andar
    b.handA = 0; b.timeFrozen = false;
    for (let i = 0; i < 6; i++) { cs.sfx('king_tick', { pitch: 0.8 + i * 0.1 }); b.handA += Math.PI / 3; yield 0.35; }
    cs.sfx('clock_chime'); cs.flash('#fff2c8', 0.4);
    cs.particles('stars_burst', b.cx, b.cy, 16, { colors: [AMBER, '#ffffff', GOLD[3]] });
    yield 0.6;
    yield* cs.say([
      { who: 'rei', expr: 'happy', text: 'Tic... tac. Que som bonito. Eu tinha esquecido.' },
      { who: 'rei', expr: 'neutral', text: 'Talvez crescer não seja esquecer.' },
      { who: 'rei', expr: 'happy', text: 'Guardei isto no meu último segundo. Acho que sempre foi seu, pequeno.' },
    ]);
    const orb = cs.actor({ x: b.cx, y: b.cy, z: 62, draw: drawMemoryOrb });
    cs.sfx('magic_hum');
    yield* cs.move(orb, b.cx, b.cy - 26, 0.8);
    yield* cs.move(orb, p.cx, p.cy - 4, 0.8);
    orb.alpha = 0;
    giveMemory(L);
    yield 0.8;
    yield* cs.say([
      { who: 'rei', expr: 'neutral', text: 'Cuidado lá embaixo. Debaixo da cama mora um medo bem antigo... e bem grande.' },
      { who: 'tico', expr: 'determined', text: 'Medo eu tenho. Mas eu vou mesmo assim. Obrigado, Majestade!' },
    ]);
    finish();
  },
});

// =============================================================================
// FASE w3_6 — "A Sala do Último Segundo"
// =============================================================================
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < MW) g[y][x] = c; };
  const put = (x, y, c) => { g[y][x] = c; };
  // ---- subida
  fill(0, 20, MW - 1, MH - 1, '#');
  fill(14, 17, 16, 17, '=');                   // degrau vazado
  fill(20, 15, 22, 15, '=');
  fill(25, 14, 34, 19, '%');                   // muro de engrenagens
  fill(35, 18, 52, 19, '#');                   // patamar antes da arena
  fill(42, 15, 44, 15, '=');
  put(40, 17, 'K');
  put(15, 15, '*'); put(30, 12, '*'); put(43, 13, '*');
  put(21, 13, 'e'); put(47, 17, 'h');
  put(4, 19, 'P');
  // ---- arena
  fill(50, 0, MW - 1, 3, '%');                 // teto
  fill(50, 4, 52, 14, '%');                    // parede esquerda (entrada embaixo)
  fill(83, 4, MW - 1, 19, '%');                // parede direita
  fill(53, 18, 82, 19, '.');                   // fosso das engrenagens (segmentos são entidades)
  fill(54, 14, 56, 14, '='); fill(79, 14, 81, 14, '=');   // parapeitos
  fill(66, 11, 69, 11, '=');
  return g.map((r) => r.join(''));
}

function setupLevel(L) {
  getSprite('king_body');
  const boss = new KingBoss(L, 0, 0, {});
  L.add(boss); L._king = boss;
  L._kingSegs = [];
  for (let i = 0; i < SEG_N; i++) { const s = new KingSegment(L, 0, 0, { i }); L.add(s); L._kingSegs.push(s); }
  L.add(new KingGears(L, 0, 0, {}));
  L.add(new KingPendulum(L, 0, 0, {}));
  L.add(new KingArena(L, 0, 0, {}));
}

registerLevel({
  id: 'w3_6', world: 3, index: 6, name: 'A Sala do Último Segundo', subtitle: 'Mundo 3-6 · Chefe',
  music: 'boss_king', tileset: 'w3', background: 'w3', timeOfDay: 'dusk', boss: true,
  parTime: 240, darkness: 0.1,
  map: buildMap(),
  onStart(level) { setupLevel(level); },
  drawOverlay,
});
