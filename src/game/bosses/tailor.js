// =============================================================================
// bosses/tailor.js — CHEFE FINAL: "O COSTUREIRO" + fase w5_6
//
// Fase 'w5_6' "O Coração do Avesso" (música 'boss_tailor' → 'boss_tailor_final'):
//   Caminho curto (3 estrelas, checkpoint) até a ARENA (camera.lockTo). No centro, no
//   alto, uma GAIOLA de fios dourados ('Y' = thread_barrier) guarda o CORAÇÃO do Avesso
//   (tailor_heart). Parapeitos laterais e a plataforma da gaiola ('=').
// Chefe 'boss_tailor' (Enemy, boss=true, 40 PV × poder; a barra da HUD usa o próprio chefe).
//   Fase 1 (100→75%): CHUVA DE AGULHAS (cada uma mostra a linha de queda antes) e
//     CHICOTADA DE FIO (linha pontilhada mira; depois vira perigo). Os ILHÓS nos ombros
//     brilham: Costura Dimensional (laço, stitchTarget → onStitched) o amarra → cai
//     ATORDOADO 2,6 s (pode pisar e bater). Fora disso o chicote dá 25%.
//   Fase 2 (75→25%): a arena vira FRAGMENTOS dos mundos anteriores, 12,5% cada,
//     e a habilidade do mundo é equipada sozinha (se o Tico a tiver):
//       Floresta (W1) — mesma regra da costura: amarrar → bater.
//       Oceano (W2)   — armadura de coral costurada (armored): Descosturar tira por 5 s.
//       Relógios (W3) — só os PONTEIROS-AGULHA refletidos com o Remendo Temporal ferem
//                       (voltam teleguiados) → atordoado 1,6 s.
//       Quarto (W4)   — escuro; ele AGARRA (mão gigante pelo chão, aviso dos olhos). Se
//                       pegar o Retalho Fantasma, fica preso 3 s (janela).
//   Fase 3 (25→0%): FORMA GIGANTE (fundo da arena). Mãos gigantes esmagam (sombra 1 s),
//     agulhas caem; orbes de desfiar aparecem nos parapeitos. O coração só sente golpes
//     com a Forma Desfiada ativa (atravessa a gaiola 'Y') ou a Tempestade de Fios.
//   0 PV → cutscene 'ending_choice' (cutscenes/ending.js).
// Justiça: corpo sólido (empurra; a esquiva não atravessa), encostar fere (em cima também),
// pisar só vale atordoado. Cada ataque tem aviso ≥ 0,8 s.
// Cutscene: 'boss5_intro' (ao entrar na arena; curta nas tentativas).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, lerp, rand, damp, rectsOverlap } from '../../engine/util.js';
import { moveBody } from '../../engine/tilemap.js';
import { defineSprite, drawSprite, getSprite, animFrame } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import font from '../../engine/font.js';
import { R, registerEntity, registerLevel, registerCutscene } from '../registry.js';
import { getStats } from '../stats.js';
import { Enemy, EnemyProjectile } from '../enemies/base.js';
import { spawnShockwave, spawnFloatingText, drawGlow } from '../art/vfx.js';

// ----------------------------------------------------------------- geometria
const T = TILE;
const MW = 58, MH = 22, FR = 18;
const FLOOR = FR * T, AX0 = 22 * T, AX1 = 52 * T, ATOP = 3 * T;
const ACX = (AX0 + AX1) / 2;
const LOCK = { x: AX0 - 16, y: ATOP - 16, w: AX1 - AX0 + 32, h: FLOOR + 32 - (ATOP - 16) };
const BW = 34, BH = 60, HOVER = 8;
const XMIN = AX0 + BW / 2 + 6, XMAX = AX1 - BW / 2 - 6;
const HEART = { x: 37 * T, y: 9 * T + 8 };
const ORBS = [[24, 13], [49, 13]];

// ----------------------------------------------------------------- paleta
const OUT = '#06030a', PATCH = ['#22142e', '#2a1a3a', '#3a2452', '#4a2e6a'], THREAD = '#a855ff', THREAD_L = '#e0b8ff';
const NEEDLE = ['#5a6070', '#a8b0c0', '#eef2ff'], GOLD = '#ffd23f', BTN = ['#7a2a9a', '#c070ff'], BTN2 = ['#8a6a20', '#e8c050'];
const Rn = Math.round;
const FRAGS = [
  { id: 'forest', name: 'Floresta', ab: 'stitch', tint: '#2e6a3a', hint: 'Lace os ilhós com a Costura Dimensional!' },
  { id: 'ocean', name: 'Oceano', ab: 'unstitch', tint: '#1e5a8a', hint: 'Descosture a armadura de coral!' },
  { id: 'clocks', name: 'Relógios', ab: 'rewind', tint: '#8a6a2a', hint: 'Devolva os ponteiros com o Remendo Temporal!' },
  { id: 'bedroom', name: 'Quarto', ab: 'decoy', tint: '#2a1e48', hint: 'Engane a mão com o Retalho Fantasma!' },
];

// =============================================================================
// ARTE
// =============================================================================
defineSprite('tailor_body', {
  w: 56, h: 80, ox: 28, oy: 79,
  anims: { idle: { frames: 4, fps: 5 }, down: { frames: 1, fps: 1 } },
  draw(pc, anim, f) {
    const down = anim === 'down', sw = [0, 1, 0, -1][f];
    const top = down ? 36 : 8;
    // casaco longo de retalhos (barra esfiapada)
    pc.poly([[18, top + 20], [38, top + 20], [46 + sw, 78], [10 + sw, 78]], PATCH[1]);
    pc.poly([[18, top + 20], [26, top + 20], [20 + sw, 78], [10 + sw, 78]], PATCH[0]);
    pc.rect(30, top + 34, 9, 10, PATCH[3]); pc.rect(16, top + 46, 8, 9, PATCH[2]); pc.rect(28, top + 56, 10, 8, PATCH[0]);
    for (let x = 11 + sw; x < 46 + sw; x += 3) pc.px(x, 78, PATCH[3]);
    for (let y = top + 34; y < top + 44; y += 2) { pc.px(29, y, THREAD); pc.px(39, y, THREAD); }
    for (let x = 16; x < 24; x += 2) pc.px(x, top + 45, THREAD);
    // rasgo no peito (vaza fio roxo)
    pc.poly([[25, top + 26], [31, top + 25], [29, top + 33], [26, top + 34]], '#120818');
    pc.px(27, top + 28, THREAD_L); pc.px(28, top + 31, THREAD); pc.px(29, top + 27, THREAD);
    // ombros e braços compridos com dedos-agulha
    pc.ellipse(28, top + 21, 13, 5, PATCH[2]);
    pc.thickLine(16, top + 22, 9, top + 44 + sw, 2, PATCH[1]); pc.thickLine(40, top + 22, 47, top + 44 - sw, 2, PATCH[1]);
    for (let i = -1; i <= 1; i++) { pc.line(9, top + 45 + sw, 7 + i * 3, top + 56 + sw, NEEDLE[1]); pc.line(47, top + 45 - sw, 49 + i * 3, top + 56 - sw, NEEDLE[1]); }
    // cabeça de pano (saco costurado), olhos de botão desparelhados
    pc.ellipse(28, top + 9, 11, 10, PATCH[2]); pc.ellipse(26, top + 7, 6, 4, PATCH[3]);
    for (let x = 18; x <= 38; x += 3) pc.px(x, top + 1 + Math.round(Math.abs(x - 28) * 0.2), THREAD);
    pc.circle(23, top + 9, 4, BTN[0]); pc.circle(23, top + 9, 2, BTN[1]); pc.px(22, top + 8, OUT); pc.px(24, top + 10, OUT);
    pc.circle(33, top + 10, 2.5, BTN2[0]); pc.px(33, top + 10, BTN2[1]);
    pc.line(23, top + 15, 33, top + 15, THREAD); for (let x = 24; x < 33; x += 2) pc.px(x, top + 16, THREAD);
    pc.outline(OUT);
  },
});

function pxLine(ctx, x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) ctx.fillRect(Rn(lerp(x0, x1, i / n)), Rn(lerp(y0, y1, i / n)), w, w);
}
function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); ctx.fillRect(Rn(cx - w), Rn(cy + y), w * 2 + 1, 1); }
}
const segDist = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy || 1;
  const u = clamp(((px - x0) * dx + (py - y0) * dy) / l, 0, 1);
  return Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u));
};

// =============================================================================
// PROJÉTEIS / PERIGOS
// =============================================================================
/** Agulha: cai do teto (aviso com linha) ou voa reta; `homing` = ponteiro de relógio refletível. */
class TailorNeedle extends EnemyProjectile {
  constructor(level, x, y, props = {}) {
    super(level, x, y, { w: 6, h: 6, life: 6, color: NEEDLE[2], reflectable: !!props.clock, solidStop: false, ...props });
    this.warn = props.warn || 0; this.fvx = this.vx; this.fvy = this.vy; this.clock = !!props.clock;
    if (this.warn > 0) { this.vx = 0; this.vy = 0; }
    this.ang = Math.atan2(this.fvy || 1, this.fvx);
    if (this.clock) this.light = { r: 14, color: GOLD, i: 0.5 };
  }
  reflect() {
    if (!super.reflect()) return false;
    this.warn = 0; this.life = 3;
    return true;
  }
  update(dt) {
    if (this.warn > 0) { this.warn -= dt; this.t += dt; if (this.warn <= 0) { this.vx = this.fvx; this.vy = this.fvy; } return; }
    const b = this.level._tailor;
    if (this.reflected && b && !b.dead) {
      const dx = b.cx - this.cx, dy = b.cy - this.cy, d = Math.hypot(dx, dy) || 1;
      this.vx = damp(this.vx, (dx / d) * 300, 6, dt); this.vy = damp(this.vy, (dy / d) * 300, 6, dt);
    }
    if (this.vx || this.vy) this.ang = Math.atan2(this.vy, this.vx);
    super.update(dt);
    if (!this.dead && (this.y > FLOOR + 8 || this.x < AX0 - 20 || this.x > AX1 + 20)) this.remove();
  }
  draw(ctx) {
    const cx = this.cx, cy = this.cy, c = Math.cos(this.ang), s = Math.sin(this.ang);
    if (this.warn > 0) {
      const blink = Math.floor(this.t * 12) % 2 === 0;
      ctx.fillStyle = blink ? 'rgba(224,184,255,0.55)' : 'rgba(224,184,255,0.25)';
      for (let i = 4; i < 260; i += 8) { const x = cx + this.fvx / (Math.hypot(this.fvx, this.fvy) || 1) * i, y = cy + this.fvy / (Math.hypot(this.fvx, this.fvy) || 1) * i; if (y > FLOOR) break; ctx.fillRect(Rn(x), Rn(y), 1, 3); }
    }
    const L = this.clock ? 8 : 6, col = this.reflected ? '#8ff0ff' : this.clock ? GOLD : NEEDLE[2];
    if (this.clock || this.reflected) drawGlow(ctx, Rn(cx), Rn(cy), 9, col, 0.35);
    pxLine(ctx, cx - c * L, cy - s * L, cx + c * L, cy + s * L, OUT, 2);
    pxLine(ctx, cx - c * (L - 1), cy - s * (L - 1), cx + c * L, cy + s * L, col);
    ctx.fillStyle = THREAD; ctx.fillRect(Rn(cx - c * L), Rn(cy - s * L), 1, 1);
  }
}
registerEntity('tailor_needle', TailorNeedle);

/** Mão que agarra (fragmento do Quarto): corre pelo chão na altura do alvo. */
class GrabHand extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 30; this.h = 20; this.x = x - 15; this.y = y - 10; this.dir = props.dir || 1;
    this.vx = this.dir * 250; this.enemy = true; this.contactDamage = 1; this.z = 46; this.alwaysUpdate = true;
  }
  update(dt) {
    this.t += dt; this.x += this.vx * dt;
    const L = this.level, d = L.decoy, b = L._tailor;
    if (d && !d.dead && rectsOverlap(this, d)) {   // pegou o Retalho Fantasma!
      d.hurt?.(3, this);
      b?.fooled(this.cx);
      L.particles.emit('ghost_patch', d.cx, d.cy, 8);
      this.remove(); return;
    }
    if (this.x < AX0 - 30 || this.right > AX1 + 30) { b?.grabMissed(); this.remove(); }
  }
  onTouchPlayer(p) { p.vx = this.dir * 220; }
  draw(ctx) {
    const x = Rn(this.cx), y = Rn(this.cy), d = this.dir;
    // braço de retalhos até a borda
    const ex = d > 0 ? AX0 - 8 : AX1 + 8;
    ctx.fillStyle = PATCH[1]; ctx.fillRect(Math.min(ex, x), y - 3, Math.abs(x - ex), 7);
    ctx.fillStyle = THREAD; for (let xx = Math.min(ex, x); xx < Math.max(ex, x); xx += 4) ctx.fillRect(xx, y - 3, 1, 1);
    fillEllipse(ctx, x, y, 10, 8, OUT); fillEllipse(ctx, x, y, 9, 7, PATCH[2]);
    for (let i = -1; i <= 1; i++) pxLine(ctx, x + d * 8, y + i * 5, x + d * 18, y + i * 7, NEEDLE[1]);
  }
}
registerEntity('tailor_grab', GrabHand);

/** Mão gigante (forma final): sombra no chão 1 s → esmaga → sobe. */
class GiantHand extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 40; this.h = 30; this.x = x - 20; this.y = ATOP - 40; this.hx = x;
    this.warn = props.warn ?? 1.0; this.z = 47; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.enemy = false; this.contactDamage = 1; this.vy = 0; this.mode = 'warn';
  }
  update(dt) {
    this.t += dt;
    if (this.mode === 'warn') { if (this.t >= this.warn) { this.mode = 'fall'; this.enemy = true; audio.sfx('whoosh', { pitch: 0.6 }); } }
    else if (this.mode === 'fall') {
      this.vy = Math.min(600, this.vy + 1800 * dt); this.y += this.vy * dt;
      if (this.bottom >= FLOOR) {
        this.y = FLOOR - this.h; this.mode = 'stay'; this.st = 0;
        audio.sfx('boom'); this.level.shake(0.4);
        this.level.particles.emit('dust', this.cx, FLOOR - 2, 10);
      }
    } else if (this.mode === 'stay') { this.st += dt; if (this.st > 0.5) { this.mode = 'up'; this.enemy = false; } }
    else { this.y -= 260 * dt; if (this.bottom < ATOP - 10) this.remove(); }
  }
  onTouchPlayer() {}
  draw(ctx) {
    const x = Rn(this.hx);
    if (this.mode === 'warn') {
      const k = this.t / this.warn, blink = Math.floor(this.t * 12) % 2 === 0;
      fillEllipse(ctx, x, FLOOR - 1, Rn(10 + k * 12), 2, `rgba(10,0,20,${0.3 + k * 0.4})`);
      ctx.fillStyle = blink ? 'rgba(255,150,200,0.45)' : 'rgba(255,150,200,0.2)';
      ctx.fillRect(x - 20, ATOP, 1, FLOOR - ATOP); ctx.fillRect(x + 19, ATOP, 1, FLOOR - ATOP);
      return;
    }
    const y = Rn(this.y);
    ctx.fillStyle = PATCH[1]; ctx.fillRect(x - 8, ATOP - 40, 16, y - ATOP + 44);
    fillEllipse(ctx, x, y + 14, 20, 15, OUT); fillEllipse(ctx, x, y + 13, 19, 14, PATCH[2]);
    ctx.fillStyle = THREAD; for (let i = -16; i <= 16; i += 4) ctx.fillRect(x + i, y + 4, 1, 2);
    for (let i = -2; i <= 2; i++) pxLine(ctx, x + i * 8, y + 22, x + i * 9, y + 30, NEEDLE[2]);
  }
}
registerEntity('tailor_giant_hand', GiantHand);

/** Coração do Avesso na gaiola: só a Forma Desfiada (ou a Tempestade de Fios) o fere. */
class TailorHeart extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 22; this.h = 22; this.x = HEART.x - 11; this.y = HEART.y - 11;
    this.z = 12; this.alwaysUpdate = true; this.alwaysDraw = true; this.hittable = false; this.hintCd = 0;
  }
  get boss() { return this.level._tailor; }
  update(dt) {
    this.t += dt; if (this.hintCd > 0) this.hintCd -= dt;
    const b = this.boss;
    this.hittable = !!(b && b.state === 'giant');
    this.light = { r: b && b.state === 'giant' ? 46 : 24, color: THREAD, i: 0.6 };
  }
  onHit(dmg, src, info = {}) {
    const b = this.boss, p = this.level.player;
    if (!b || b.state !== 'giant') return false;
    if ((p && p.mods.phase) || info.kind === 'blast') return b.heartHit(dmg, info.kind === 'blast');
    if (this.hintCd <= 0) { this.hintCd = 3; spawnFloatingText(this.level, this.cx, this.y - 8, 'Só a Forma Desfiada alcança!', GOLD); }
    audio.sfx('armor_clink', { cooldown: 0.1 });
    return false;
  }
  hurt(n, src, opts) { return this.onHit(n, src, opts || {}); }
  draw(ctx) {
    const b = this.boss, on = b && b.state === 'giant';
    const beat = 1 + Math.max(0, Math.sin(this.t * (on ? 6 : 2.5))) * 0.25;
    const x = Rn(this.cx), y = Rn(this.cy);
    drawGlow(ctx, x, y, Rn(16 * beat), THREAD, on ? 0.6 : 0.3);
    const r = Rn(6 * beat);
    fillEllipse(ctx, x - r / 2, y - 2, r, r, OUT); fillEllipse(ctx, x + r / 2, y - 2, r, r, OUT);
    ctx.fillStyle = OUT; for (let i = 0; i < r + 4; i++) ctx.fillRect(x - r - 1 + i, y + i - 1, Math.max(1, (r + 2) * 2 - i * 2), 1);
    fillEllipse(ctx, x - r / 2, y - 2, r - 1, r - 1, on ? '#c070ff' : '#6a3a8a'); fillEllipse(ctx, x + r / 2, y - 2, r - 1, r - 1, on ? '#c070ff' : '#6a3a8a');
    ctx.fillStyle = on ? '#c070ff' : '#6a3a8a'; for (let i = 0; i < r + 2; i++) ctx.fillRect(x - r + i, y + i - 1, Math.max(1, r * 2 - i * 2), 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r / 2 - 1, y - 4, 2, 2);
    ctx.fillStyle = THREAD_L; for (let i = 0; i < 6; i++) ctx.fillRect(x - 6 + ((i * 5 + Rn(this.t * 20)) % 13), y + 2 + (i % 3), 1, 1);
  }
}
registerEntity('tailor_heart', TailorHeart);

// =============================================================================
// O CHEFE
// =============================================================================
const FIGHT = new Set(['idle', 'walk', 'needlewind', 'lashwind', 'lash', 'lashpost', 'throwwind', 'grabwind', 'grab',
  'tired', 'bound', 'stunned', 'fooled', 'giant']);
const STUN = new Set(['bound', 'stunned', 'fooled', 'tired']);
// fração de vida em que cada etapa termina: p1, floresta, oceano, relógios, quarto, gigante
const FLOORS = [0.75, 0.625, 0.5, 0.375, 0.25, 0];

class TailorBoss extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.boss = true; this.bossName = 'O Costureiro';
    this.bindable = false; this.flying = true; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.z = 30; this.w = BW; this.h = BH; this.place(ACX + 90);
    this.maxHp = this.hp = Math.max(24, Math.round(40 * (getStats().power || 1)));
    this.drops = { buttons: 0 };
    this.stage = 0; this.state = 'dormant'; this.st = 0; this.qi = 0; this.pending = false;
    this.facing = -1; this.alpha = 1; this.armorT = 0; this.hintCd = 0; this.taught = {};
    this.giantK = 0; this.handT = 2; this.rainT = 3;
    this.setActive(false);
  }
  setActive(on) { this.hittable = on; this.contact = on; this.enemy = on; this.stompable = false; this.stitchTarget = false; }
  get frag() { return this.stage >= 1 && this.stage <= 4 ? FRAGS[this.stage - 1] : null; }
  get fid() { return this.frag ? this.frag.id : this.stage === 0 ? 'p1' : 'giant'; }
  get fighting() { return FIGHT.has(this.state); }
  get stunned() { return STUN.has(this.state); }
  get spd() { return this.stage >= 3 ? 1.12 : 1; }
  place(cx, bottom = FLOOR - HOVER) { this.x = cx - this.w / 2; this.y = bottom - this.h; }
  go(s) {
    this.state = s; this.st = 0; this.fired = 0;
    const st = STUN.has(s), giant = s === 'giant';
    this.contact = this.enemy = FIGHT.has(s) && !st && !giant;
    this.hittable = FIGHT.has(s) && !giant;
    this.stompable = st && s !== 'tired';
    if (st) this.place(this.cx, FLOOR);
  }
  shoulders() { return [{ x: this.cx - 11, y: this.y + 14 }, { x: this.cx + 11, y: this.y + 14 }]; }
  get bindOpen() { return (this.fid === 'p1' || this.fid === 'forest') && FIGHT.has(this.state) && !this.stunned && (this.bindCd || 0) <= 0; }

  // ---------------------------------------------------------------- entrada
  beginFight() {
    const L = this.level;
    L.boss = this;
    this.light = { r: 56, color: THREAD, i: 0.5 };
    this.equip('stitch');
    this.go('idle'); this.idleDelay = 0.9;
    L.toast('Lace os ilhós dos ombros com a Costura Dimensional!', 'icon_ab_stitch');
  }
  equip(ab) { if (save.data.abilities?.[ab]) save.data.equippedAbility = ab; }

  // ---------------------------------------------------------------- dano
  die() {}
  hint(text) { if (this.hintCd > 0) return; this.hintCd = 3.5; spawnFloatingText(this.level, this.cx, this.y - 10, text, GOLD); }
  onStitched(p) {
    if (!this.bindOpen) { this.hint('Agora não! Espere os ilhós brilharem.'); return; }
    this.bindCd = 4;
    this.clearLash();
    audio.sfx('bind'); this.level.shake(0.2);
    spawnFloatingText(this.level, this.cx, this.y - 12, 'Amarrado!', GOLD);
    this.go('bound'); this.stunDur = 2.6;
  }
  unstitch(p) {
    if (this.fid !== 'ocean' || !this.armored || !this.fighting) return false;
    this.armored = false; this.armorT = 5;
    audio.sfx('unstitch_hit');
    this.level.particles.emit('fabric', this.cx, this.cy, 12, { colors: ['#f0708e', '#ff9ab4', PATCH[2]] });
    spawnFloatingText(this.level, this.cx, this.y - 12, 'Sem armadura!', '#ff9ab4');
    this.go('tired'); this.stunDur = 0.8;
    return true;
  }
  onHit(dmg, src, info = {}) {
    if (!this.fighting || this.invuln > 0 || this.state === 'giant') return false;
    if (info.kind === 'reflect') {
      if (this.fid !== 'clocks') return this.hurtRaw(dmg * 0.5);
      const r = this.hurtRaw(1.5);
      if (!this.stunned && this.state !== 'defeated' && !this.pending) { this.go('stunned'); this.stunDur = 1.6; }
      return r;
    }
    return this.hurt(dmg, src);
  }
  hurt(amount = 1, src = null) {
    if (!this.fighting || this.invuln > 0 || this.state === 'giant') return false;
    const f = this.fid;
    let mul;
    if (this.stunned && this.state !== 'tired') mul = 0.5;
    else if (f === 'ocean' && !this.armored) mul = 0.5;
    else if (f === 'p1') mul = 0.25;
    else mul = 0;
    if (f === 'ocean' && this.armored) { audio.sfx('armor_clink', { cooldown: 0.1 }); this.hint(FRAGS[1].hint); return false; }
    if (mul <= 0) { audio.sfx('armor_clink', { cooldown: 0.1 }); this.hint(this.frag ? this.frag.hint : 'Ele está protegido!'); return false; }
    return this.hurtRaw(amount * mul);
  }
  hurtRaw(n) {
    const L = this.level, floor = this.maxHp * FLOORS[this.stage];
    this.hp = Math.max(floor, this.hp - n);
    this.flash = 0.1; this.invuln = 0.08;
    audio.sfx(n >= 0.5 ? 'boss_hit' : 'hit', { randomPitch: 0.08 });
    L.particles.emit('fabric', this.cx, this.cy, n >= 0.5 ? 6 : 2, { colors: PATCH });
    L.particles.emit('thread', this.cx, this.cy, 3, { colors: [THREAD, THREAD_L] });
    if (n >= 0.5) L.shake(0.1);
    if (this.hp <= floor + 0.001) this.pending = true;
    return true;
  }
  heartHit(dmg, blast) {
    const L = this.level, n = (blast ? dmg * 0.8 : dmg) * 0.5;
    this.hp = Math.max(0, this.hp - n);
    audio.sfx('boss_hit'); L.shake(0.2); L.hitstop(0.05);
    L.particles.emit('thread', HEART.x, HEART.y, 8, { colors: [THREAD, THREAD_L, GOLD] });
    spawnShockwave(L, HEART.x, HEART.y, { radius: 20, color: THREAD });
    if (this.hp <= 0) this.defeat();
    return true;
  }
  defeat() {
    const L = this.level;
    this.hp = 0; this.pending = false;
    this.go('defeated'); this.setActive(false);
    L.boss = null;
    this.clearHazards();
    this.place(ACX, FLOOR);
    if (L.data) L.data.darkness = 0.2;
    audio.sfx('boss_roar', { pitch: 0.6 }); audio.sfx('explosion', { vol: 0.6 });
    audio.stopMusic?.(2.5);
    L.shake(0.7); L.hitstop(0.2); L.flash('#ffffff', 0.4);
  }
  clearLash() { this.lash = null; }
  clearHazards() {
    this.clearLash();
    for (const e of this.level.entities) if (!e.dead && (e instanceof TailorNeedle || e instanceof GrabHand || e instanceof GiantHand)) e.remove();
  }

  // ---------------------------------------------------------------- troca de etapa
  nextStage() {
    const L = this.level;
    this.pending = false; this.clearHazards();
    this.stage++; this.qi = 0; this.armored = false; this.armorT = 0; this.bindCd = 1.5;
    this.go('transition'); this.contact = this.enemy = false; this.hittable = false;
    audio.sfx('portal'); audio.sfx('boss_roar', { pitch: 0.8, vol: 0.6 });
    L.flash('#ffffff', 0.35); L.shake(0.35);
    if (L.data) L.data.darkness = this.fid === 'bedroom' ? 0.6 : 0.25;
    if (this.frag) {
      this.equip(this.frag.ab);
      L.toast(`${this.frag.name}! ${this.frag.hint}`, `icon_ab_${this.frag.ab}`);
      spawnFloatingText(L, this.cx, this.y - 16, this.stage === 1 ? 'Lembranças... viram... armas!' : 'De novo... outro mundo...', THREAD_L);
    } else {
      // forma gigante
      this.equip('unravel');
      audio.playMusic?.('boss_tailor_final', { fade: 1.5 });
      L.toast('O coração! Junte carga e use a Forma Desfiada!', 'icon_ab_unravel');
      for (const [x, y] of ORBS) L.spawn('unravel_orb', x * T, y * T, { respawn: 6 });
    }
    if (this.stage >= 2) L.spawn('heart', ACX - 8, FLOOR - 24);
  }

  // ---------------------------------------------------------------- ataques
  next() {
    const f = this.fid;
    const P = {
      p1: ['needles', 'lash', 'walk', 'lash', 'needles', 'lash'],
      forest: ['lash', 'needles', 'lash', 'walk'],
      ocean: ['lash', 'sidewave', 'walk', 'needles'],
      clocks: ['throw', 'needles', 'throw', 'walk'],
      bedroom: ['grab', 'needles', 'grab'],
    }[f];
    const k = P[this.qi++ % P.length];
    if (k === 'needles') this.go('needlewind');
    else if (k === 'lash') this.go('lashwind');
    else if (k === 'throw') this.go('throwwind');
    else if (k === 'grab') this.go('grabwind');
    else if (k === 'sidewave') { this.sideWave(); this.idleDelay = 1.6; this.go('idle'); }
    else this.go('walk');
  }
  rain(n, warn = 0.9) {
    const L = this.level, p = L.player, xs = [];
    for (let i = 0; i < n; i++) {
      let x;
      for (let k = 0; k < 8; k++) { x = i === 0 && p ? p.cx : rand(AX0 + 10, AX1 - 10); if (xs.every((o) => Math.abs(o - x) > 28)) break; }
      xs.push(x);
      L.add(new TailorNeedle(L, x, ATOP + 4, { vx: 0, vy: 230, warn: warn + i * 0.12 }));
    }
    audio.sfx('needle', { cooldown: 0.1 });
  }
  sideWave() {
    const L = this.level, p = L.player, d = p && p.cx < ACX ? 1 : -1, x = d > 0 ? AX0 + 4 : AX1 - 4;
    const ys = [FLOOR - 8, FLOOR - 40, FLOOR - 72].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const y of ys) L.add(new TailorNeedle(L, x, y, { vx: d * 170, vy: 0, warn: 0.9 }));
    audio.sfx('needle');
  }
  throwClock() {
    const L = this.level, t = this.target(), ox = this.cx, oy = this.y + 20;
    const base = Math.atan2((t?.cy ?? oy) - oy, (t?.cx ?? ox) - ox);
    for (let i = 0; i < 3; i++) {
      const a = base + (i - 1) * 0.25;
      L.add(new TailorNeedle(L, ox, oy, { vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, warn: 0.15 + i * 0.15, clock: true }));
    }
    audio.sfx('clock_tick'); audio.sfx('whoosh');
  }
  fooled(x) {
    if (this.fid !== 'bedroom') return;
    this.place(clamp(x, XMIN, XMAX), FLOOR);
    spawnFloatingText(this.level, this.cx, this.y - 12, 'Pegou o retalho!', GOLD);
    audio.sfx('decoy_swap'); this.level.shake(0.25);
    this.alpha = 1; this.go('fooled'); this.stunDur = 3;
  }
  grabMissed() {
    if (this.state !== 'grab') return;
    this.alpha = 1;
    if (!save.data.abilities?.decoy) { this.go('tired'); this.stunDur = 2; this.state = 'stunned'; this.stompable = true; this.contact = this.enemy = false; return; }
    this.idleDelay = 0.8; this.go('idle');
  }

  think(dt) {
    const L = this.level, t = this.target(), s = this.state, p = L.player;
    if (this.pending && this.fighting && !['lash', 'grab'].includes(s)) { this.nextStage(); return; }
    const faceT = () => { if (t && Math.abs(t.cx - this.cx) > 6) this.facing = t.cx < this.cx ? -1 : 1; };
    const bob = () => this.place(this.cx, FLOOR - HOVER + Math.sin(this.t * 2) * 3);
    switch (s) {
      case 'idle': faceT(); bob(); if (this.st >= (this.idleDelay ?? 0.8)) { this.idleDelay = this.stage >= 3 ? 0.6 : 0.8; this.next(); } break;
      case 'walk': {
        faceT(); bob();
        const dx = (t ? t.cx : ACX) - this.cx;
        if (Math.abs(dx) > 80) this.place(clamp(this.cx + Math.sign(dx) * 55 * this.spd * dt, XMIN, XMAX), this.bottom);
        if (this.st > 1.4) this.go('idle');
        break;
      }
      case 'needlewind':
        bob();
        if (this.st >= 0.5) { this.rain(this.stage >= 3 ? 6 : 5); this.idleDelay = 1.4; this.go('idle'); }
        break;
      case 'lashwind': {
        faceT(); bob();
        if (this.st < 0.55 && t) this.lashT = { x: t.cx, y: t.cy };
        const hx = this.cx + this.facing * 16, hy = this.y + 30;
        const tx = this.lashT ? this.lashT.x : hx + this.facing * 100, ty = this.lashT ? this.lashT.y : hy;
        const d = Math.hypot(tx - hx, ty - hy) || 1, len = 170;
        this.lash = { x0: hx, y0: hy, x1: hx + ((tx - hx) / d) * len, y1: hy + ((ty - hy) / d) * len, live: false };
        if (this.st >= 0.85) { this.lash.live = true; audio.sfx('whip_big', { pitch: 0.7 }); this.go('lash'); }
        break;
      }
      case 'lash':
        if (this.lash && p && p.state !== 'dead' && segDist(p.cx, p.cy, this.lash.x0, this.lash.y0, this.lash.x1, this.lash.y1) < 10) p.hurt(1, this);
        if (this.st >= 0.3) { this.clearLash(); this.go('lashpost'); }
        break;
      case 'lashpost': bob(); if (this.st >= 0.7) this.go('idle'); break;
      case 'throwwind': faceT(); bob(); if (this.st >= 0.7) { this.throwClock(); this.idleDelay = 1.5; this.go('idle'); } break;
      case 'grabwind': {
        // some nas sombras e aparece no canto oposto ao alvo
        if (this.st === 0 || this.grabSide === undefined) this.grabSide = t && t.cx > ACX ? -1 : 1;
        this.alpha = damp(this.alpha, 0.25, 6, dt);
        this.place(damp(this.cx, this.grabSide < 0 ? XMIN : XMAX, 5, dt), this.bottom);
        this.facing = -this.grabSide;
        if (this.st >= 1.1) {
          const tg = this.target(), gy = clamp(tg ? tg.cy : FLOOR - 12, FLOOR - 70, FLOOR - 10);
          L.add(new GrabHand(L, this.cx + this.facing * 20, gy, { dir: this.facing }));
          audio.sfx('w4e_grab', { cooldown: 0.2 }); this.grabSide = undefined; this.go('grab');
        }
        break;
      }
      case 'grab': if (this.st > 3) { this.alpha = 1; this.go('idle'); } break;
      case 'bound': case 'stunned': case 'fooled': case 'tired':
        if (this.st >= (this.stunDur || 2)) { this.alpha = 1; this.idleDelay = 0.6; this.go('idle'); }
        break;
      case 'transition':
        this.alpha = damp(this.alpha, 1, 4, dt);
        this.place(damp(this.cx, ACX + (this.stage === 5 ? 0 : 90), 3, dt), FLOOR - HOVER);
        if (this.stage === 5) this.giantK = Math.min(1, this.giantK + dt * 0.6);
        if (this.st >= 2.2) {
          if (this.stage === 5) { this.go('giant'); this.handT = 1.5; this.rainT = 4; }
          else { this.idleDelay = 0.8; this.armored = this.fid === 'ocean'; this.go('idle'); }
        }
        break;
      case 'giant': {
        this.giantK = 1;
        this.handT -= dt; this.rainT -= dt;
        if (this.handT <= 0) {
          this.handT = 2.4;
          const x = clamp(p ? p.cx + rand(-10, 10) : ACX, AX0 + 24, AX1 - 24);
          L.add(new GiantHand(L, x, 0, { warn: 1.0 }));
        }
        if (this.rainT <= 0) { this.rainT = 5.5; this.rain(4, 1.0); }
        break;
      }
      case 'defeated':
        if (!this.csStarted && this.st >= 1.4) { this.csStarted = true; L.cutscene('ending_choice', { boss: this }); }
        break;
      default: break;
    }
    // armadura de coral volta depois de 5 s
    if (this.fid === 'ocean' && !this.armored && this.armorT > 0) {
      this.armorT -= dt;
      if (this.armorT <= 0 && this.fighting) { this.armored = true; audio.sfx('stitch_connect'); this.hint('A armadura se recosturou!'); }
    }
    this.stitchTarget = this.bindOpen;
  }

  update(dt) {
    this.tickTimers(dt);
    this.st += dt;
    if (this.hintCd > 0) this.hintCd -= dt;
    if (this.bindCd > 0) this.bindCd -= dt;
    if (this.stompCd > 0) this.stompCd -= dt;
    if (this.state === 'dormant') return;
    this.think(dt);
    if ((this.fighting && this.state !== 'giant') || this.state === 'transition') this.solidVsPlayer();
  }
  onStomp(p) {
    if (!this.stompable || (this.stompCd || 0) > 0) { p.vy = -280; p.vx = (p.cx < this.cx ? -1 : 1) * 170; p.hurt(1, this); return; }
    this.stompCd = 0.6;
    this.hurtRaw(1.2 * (p.stats?.power || 1));
  }
  /** Corpo sólido: empurra o Tico (a esquiva não atravessa) e fere ao encostar. */
  solidVsPlayer() {
    const L = this.level, p = L.player;
    if (!p || p.state === 'dead' || this.alpha < 0.5 || !rectsOverlap(p, this)) return;
    if (this.stompable && p.vy > 40 && p.bottom - this.y < 12) return;
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

  // ---------------------------------------------------------------- desenho
  drawGiant(ctx) {
    const k = this.giantK;
    if (k <= 0) return;
    const t = this.t, cx = ACX, top = ATOP + 6 + Rn((1 - k) * 120), w = 300;
    ctx.globalAlpha = 0.8 * k;
    // tronco e cabeça gigantes atrás da gaiola
    ctx.fillStyle = PATCH[0]; ctx.fillRect(cx - w / 2 + 30, top + 70, w - 60, FLOOR - top - 70);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = PATCH[1 + (i % 3)]; ctx.fillRect(cx - 120 + (i * 37) % 220, top + 80 + ((i * 53) % 120), 28, 22); }
    fillEllipse(ctx, cx, top + 40, 70, 48, PATCH[2]);
    fillEllipse(ctx, cx - 26, top + 36, 16, 16, BTN[0]); fillEllipse(ctx, cx - 26, top + 36, 9, 9, BTN[1]);
    fillEllipse(ctx, cx + 28, top + 40, 9, 9, BTN2[0]); fillEllipse(ctx, cx + 28, top + 40, 4, 4, BTN2[1]);
    ctx.fillStyle = THREAD; for (let x = cx - 30; x < cx + 30; x += 4) ctx.fillRect(x, top + 66, 2, 1);
    // rasgo do peito em volta do coração
    ctx.fillStyle = '#120818'; fillEllipse(ctx, HEART.x, HEART.y, 30, 24, '#120818');
    ctx.fillStyle = THREAD;
    for (let i = 0; i < 10; i++) { const a = t * 0.8 + i * 0.63; ctx.fillRect(Rn(HEART.x + Math.cos(a) * 30), Rn(HEART.y + Math.sin(a) * 24), 2, 1); }
    ctx.globalAlpha = 1;
  }
  draw(ctx) {
    if (this.state === 'giant' || this.state === 'dormant' && this.alpha <= 0) return;
    const fade = this.stage === 5 && this.state === 'transition' ? Math.max(0, 1 - this.giantK * 1.5) : 1;
    if (fade <= 0) return;
    const s = this.state, f = this.facing, bx = Rn(this.cx), by = Rn(this.bottom);
    // chicotada de fio
    if (this.lash) {
      const { x0, y0, x1, y1, live } = this.lash;
      if (!live) {
        const blink = Math.floor(this.st * 12) % 2 === 0;
        ctx.fillStyle = blink ? 'rgba(255,150,200,0.85)' : 'rgba(255,150,200,0.4)';
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 5);
        for (let i = 0; i < n; i += 2) ctx.fillRect(Rn(lerp(x0, x1, i / n)), Rn(lerp(y0, y1, i / n)), 2, 1);
      } else {
        pxLine(ctx, x0, y0, x1, y1, THREAD, 2); pxLine(ctx, x0, y0, x1, y1, THREAD_L);
        drawGlow(ctx, Rn(x1), Rn(y1), 10, THREAD, 0.5);
      }
    }
    if (s === 'needlewind' || s === 'throwwind') drawGlow(ctx, bx, Rn(this.y + 20), 16 + Rn(this.st * 12), s === 'throwwind' ? GOLD : NEEDLE[2], 0.4);
    if (s === 'grabwind') {
      const blink = Math.floor(this.st * 10) % 2 === 0;
      if (blink) { ctx.fillStyle = '#ff5a8a'; ctx.fillRect(bx - 6, Rn(this.y + 8), 3, 2); ctx.fillRect(bx + 4, Rn(this.y + 9), 2, 2); }
    }
    drawGlow(ctx, bx, Rn(this.cy), 30, THREAD, 0.25 * this.alpha);
    const a = this.stunned ? 'down' : 'idle';
    drawSprite(ctx, 'tailor_body', a, animFrame('tailor_body', a, this.t), bx, by, {
      flip: f < 0, alpha: this.alpha * fade, variant: this.flash > 0 ? 'flash' : undefined,
    });
    // ilhós dos ombros (alvo da Costura)
    if (this.bindOpen && !this.stunned) {
      for (const sp of this.shoulders()) {
        const pul = 0.5 + 0.5 * Math.sin(this.t * 7);
        drawGlow(ctx, Rn(sp.x), Rn(sp.y), 6 + Rn(pul * 3), GOLD, 0.5);
        ctx.fillStyle = GOLD; ctx.fillRect(Rn(sp.x) - 2, Rn(sp.y) - 2, 4, 4); ctx.fillStyle = OUT; ctx.fillRect(Rn(sp.x) - 1, Rn(sp.y) - 1, 2, 2);
      }
    }
    // armadura de coral (Oceano)
    if (this.fid === 'ocean' && this.armored && this.fighting) {
      const cols = ['#f0708e', '#c04a72', '#ff9ab4'];
      for (let i = 0; i < 7; i++) {
        const xx = Rn(this.x + 2 + ((i * 11) % (BW - 6))), yy = Rn(this.y + 18 + ((i * 17) % 36));
        ctx.fillStyle = OUT; ctx.fillRect(xx - 1, yy - 1, 8, 7); ctx.fillStyle = cols[i % 3]; ctx.fillRect(xx, yy, 6, 5);
        ctx.fillStyle = THREAD; ctx.fillRect(xx + 1, yy - 1, 1, 1); ctx.fillRect(xx + 4, yy + 5, 1, 1);
      }
    }
    if (s === 'bound') {   // fios dourados amarrando
      ctx.fillStyle = GOLD;
      for (let y = this.y + 6; y < this.bottom - 4; y += 7) for (let x = this.x - 2; x < this.right + 2; x += 2) if ((x + y) % 4 === 0) ctx.fillRect(Rn(x), Rn(y + Math.sin(x * 0.4) * 1.5), 1, 1);
    }
    if (this.stunned && s !== 'tired') {
      for (let i = 0; i < 3; i++) { const an = this.t * 5 + i * 2.1; ctx.fillStyle = i % 2 ? GOLD : '#ffffff'; ctx.fillRect(Rn(this.cx + Math.cos(an) * 14), Rn(this.y - 2 + Math.sin(an) * 3), 2, 2); }
    }
  }
}
registerEntity('boss_tailor', TailorBoss);

// =============================================================================
// ARENA: gatilho, grade de fios, cenário dos fragmentos, energia de reserva
// =============================================================================
class TailorArena extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 2;
    this.started = false; this.closeK = 0; this.energyT = 5; this.side = 0; this.fragK = 0; this.shown = null;
  }
  start() {
    const L = this.level, b = L._tailor;
    this.started = true;
    L.camera.lockTo(LOCK);
    audio.sfx('rumble'); L.shake(0.2);
    L.cutscene('boss5_intro', { boss: b }).then(() => { if (b && b.state === 'dormant') b.beginFight(); });
  }
  update(dt) {
    this.t += dt;
    const L = this.level, p = L.player, b = L._tailor;
    if (!p) return;
    if (!this.started && p.state !== 'dead' && p.cx > AX0 + 24) this.start();
    if (!this.started) return;
    this.closeK = Math.min(1, this.closeK + dt * 2);
    if (p.x < AX0) { p.x = AX0; if (p.vx < 0) p.vx = 0; }
    const want = b && b.frag ? b.frag.id : null;
    if (want !== this.shown) { this.fragK = damp(this.fragK, 0, 10, dt); if (this.fragK < 0.05) this.shown = want; }
    else this.fragK = damp(this.fragK, want ? 1 : 0, 3, dt);
    if (b && b.fighting) {
      this.energyT -= dt;
      if (this.energyT <= 0) {
        this.energyT = 6;
        const E = R.entities.get('energy');
        const have = L.entities.some((e) => !e.dead && e.constructor === E && e.x > AX0 && e.x < AX1);
        if (!have && p.energy < p.maxEnergy * 0.6) {
          this.side ^= 1;
          const x = (this.side ? 47 : 26) * T;
          L.spawn('energy', x, 13 * T);
          L.particles.emit('sparkle', x + 8, 13 * T + 8, 6);
        }
      }
    }
  }
  drawFrag(ctx) {
    const k = this.fragK, id = this.shown;
    if (!id || k < 0.02) return;
    const t = this.t, x0 = AX0, x1 = AX1, y0 = ATOP, y1 = FLOOR;
    ctx.globalAlpha = 0.55 * k;
    if (id === 'forest') {
      for (let i = 0; i < 7; i++) {
        const x = x0 + 20 + i * 70, h = 120 + (i % 3) * 30;
        ctx.fillStyle = '#1e3a24'; ctx.fillRect(x + 8, y1 - h + 40, 8, h - 40);
        fillEllipse(ctx, x + 12, y1 - h + 30, 28, 30, i % 2 ? '#2e5a34' : '#24482c');
        ctx.fillStyle = '#c8f070'; if (Math.sin(t * 2 + i) > 0.6) ctx.fillRect(x + (i * 13) % 30, y1 - 60 - (i * 7) % 40, 1, 1);
      }
    } else if (id === 'ocean') {
      ctx.fillStyle = '#1a4a7a'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = '#5ec8e8';
      for (let y = y0 + 20; y < y1; y += 28) for (let x = x0; x < x1; x += 6) ctx.fillRect(x, Rn(y + Math.sin(x * 0.05 + t * 1.5) * 3), 3, 1);
      for (let i = 0; i < 10; i++) { const by = y1 - ((t * 20 + i * 41) % (y1 - y0)); ctx.fillStyle = '#c8f4ff'; ctx.fillRect(x0 + (i * 53) % (x1 - x0), Rn(by), 2, 2); }
      for (let i = 0; i < 5; i++) fillEllipse(ctx, x0 + 40 + i * 100, y1 - 10, 14, 12, '#f0708e');
    } else if (id === 'clocks') {
      for (let i = 0; i < 4; i++) {
        const cx = x0 + 60 + i * 120, cy = y0 + 60 + (i % 2) * 70, r = 34;
        fillEllipse(ctx, cx, cy, r, r, '#8a6a2a'); fillEllipse(ctx, cx, cy, r - 4, r - 4, '#f8f0dc');
        const a = t * (i % 2 ? 1.5 : -1);
        pxLine(ctx, cx, cy, cx + Math.sin(a) * 24, cy - Math.cos(a) * 24, '#2a1a10', 2);
        pxLine(ctx, cx, cy, cx + Math.sin(a / 12) * 14, cy - Math.cos(a / 12) * 14, '#2a1a10', 2);
      }
    } else if (id === 'bedroom') {
      ctx.fillStyle = '#1c1838'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = '#221d44'; for (let x = x0; x < x1; x += 16) ctx.fillRect(x, y0, 6, y1 - y0);
      ctx.fillStyle = '#3a2440'; ctx.fillRect(x0 + 300, y1 - 50, 140, 50);
      const cols = ['#c8506a', '#4a7fe0', '#ffd23f', '#6fbf6f'];
      for (let i = 0; i < 7; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(x0 + 300 + i * 20, y1 - 46, 20, 18); }
      ctx.fillStyle = '#ffcf7a'; ctx.fillRect(x0 + 60, y1 - 70, 20, 12);
    }
    ctx.globalAlpha = 1;
  }
  draw(ctx) {
    this.level._tailor?.drawGiant(ctx);
    this.drawFrag(ctx);
    if (this.closeK > 0) {   // grade de fios fechando a entrada
      const h = Rn(3 * T * this.closeK);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? THREAD : PATCH[2]; ctx.fillRect(AX0 - 6 + i * 2, FLOOR - h, 1, h); }
    }
    const L = this.level;
    if ((L.data.darkness ?? 0) > 0.4) for (const [x, y] of ORBS) L.addLight(x * T + 8, y * T + 8, 26, GOLD, 0.35);
  }
}
registerEntity('tailor_arena', TailorArena);

// =============================================================================
// CUTSCENE DE ENTRADA
// =============================================================================
registerCutscene('boss5_intro', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._tailor;
    if (!b) return;
    const first = !save.seen('boss5_intro');
    yield 0.2;
    yield* cs.panTo(b, 1.0);
    cs.sfx('boss_roar', { pitch: 0.7 }); cs.shake(0.3); cs.flash('#a855ff', 0.25);
    yield 0.5;
    if (first) {
      yield* cs.title('O Costureiro', 'Senhor do Avesso', 2.8);
      yield* cs.say([
        { who: 'costureiro', expr: 'neutral', text: 'Fio... dourado. Você veio. Os nós... todos... desatados.' },
        { who: 'tico', expr: 'angry', text: 'Eu não vim te dar nada! Eu vim voltar pra Lia!' },
        { who: 'costureiro', expr: 'angry', shake: true, text: 'Lia. Celeste. Todos... esquecem. Aqui... ninguém... é esquecido.' },
        { who: 'tico', expr: 'scared', text: 'Ele é enorme... Calma, Tico. Pense.' },
        { who: 'tico', expr: 'determined', text: 'Aqueles ilhós nos ombros! Se eu laçar com a Costura Dimensional, ele cai!' },
      ]);
    } else yield 0.3;
    yield* cs.panTo(p, 0.6);
  },
});

// =============================================================================
// FASE w5_6 — "O Coração do Avesso"
// =============================================================================
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < MW) g[y][x] = c; };
  const put = (x, y, c) => { g[y][x] = c; };
  fill(0, FR, MW - 1, MH - 1, '#');
  // ---- caminho
  fill(7, 16, 9, 16, '='); fill(11, 14, 13, 14, '=');
  put(8, 15, '*'); put(12, 13, '*'); put(16, 17, '*');
  put(5, 17, 'e'); put(17, 17, 'K'); put(2, 17, 'P');
  // ---- arena
  fill(20, 0, MW - 1, 2, '%');                 // teto
  fill(20, 3, 21, 14, '%');                    // parede esquerda (entrada embaixo)
  fill(52, 3, MW - 1, FR - 1, '%');            // parede direita
  fill(25, 14, 28, 14, '='); fill(45, 14, 48, 14, '=');   // parapeitos
  fill(33, 11, 40, 11, '=');                   // plataforma da gaiola
  fill(34, 7, 39, 7, 'Y');                     // gaiola de fios
  fill(34, 8, 34, 10, 'Y'); fill(39, 8, 39, 10, 'Y');
  return g.map((r) => r.join(''));
}

function setupLevel(L) {
  getSprite('tailor_body');
  L.data = { ...L.data };
  const boss = new TailorBoss(L, 0, 0, {});
  L.add(boss); L._tailor = boss;
  L.add(new TailorHeart(L, 0, 0, {}));
  L.add(new TailorArena(L, 0, 0, {}));
}

registerLevel({
  id: 'w5_6', world: 5, index: 6, name: 'O Coração do Avesso', subtitle: 'Mundo 5-6 - Chefe Final',
  music: 'boss_tailor', tileset: 'w5', background: 'w5', timeOfDay: 'night', boss: true,
  parTime: 420, darkness: 0.25, ambient: 'w5_threads',
  map: buildMap(),
  onStart(level) { setupLevel(level); },
  drawOverlay(ctx, L) {
    const b = L._tailor;
    if (!b || !b.frag || !b.fighting) return;
    font.draw(ctx, `Fragmento: ${b.frag.name}`, Rn(game.view.w / 2), 34, { color: '#e0b8ff', align: 'center', outline: '#06030a' });
  },
});
