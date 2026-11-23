// =============================================================================
// abilities/unravel.js — FORMA DESFIADA
//
// Habilidade 'unravel' (sem custo de energia): exige player.unravelMeter >= 1
// (enche batendo em inimigos, +0.5 por 'unravel_orb', +0.05 por energia coletada).
// Ativação: congelamento dramático (hitstop 0.5), clarão, explosão de fios.
// Dura enquanto o medidor esvazia: 10 s × getStats().duration (orbes no meio estendem).
//   player.mods = { speed 1.45, damage 2.5, phase true, trail true, trailColor ouro,
//                   airPlatform: pulo no ar cria 'unravel_platform' (máx. 3 por voo) }
// Apertar de novo durante a forma = TEMPESTADE DE FIOS: golpe radial (120 px, 6 de dano,
// chefes inclusive) que encerra a forma.
// Entidades deste módulo:
//   thread_barrier  'Y'  parede de fios esticados: sólida, exceto com player.mods.phase
//                        (nunca prende o Tico: só volta a ser sólida quando ele sai).
//   unravel_orb          carretel de luz: +0.5 de carga. Reaparece após props.respawn
//                        (padrão 10 s); props.once = some de vez.
//   unravel_platform     plataforma vazada de fio dourado (1.6 s).
// Fase de teste: ?level=test_ab_unravel&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, rectsOverlap } from '../../engine/util.js';
import { defineImage, drawImage, drawSprite } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { game } from '../../engine/game.js';
import { save } from '../../engine/save.js';
import { R, registerAbility, registerEntity, registerLevel } from '../registry.js';
import { getStats } from '../stats.js';
import { buildTestMap } from './stitch.js';
import * as VFX from '../art/vfx.js';

// ----------------------------------------------------------------- ajustes
const DURATION = 10, BLAST_R = 120, BLAST_DMG = 6, ORB_GAIN = 0.5, ENERGY_GAIN = 0.05;
const PLAT_LIFE = 1.6, PLAT_JUMP = 340;
const GOLD = '#ffd23f', GOLD_L = '#fff3a0', GOLD_D = '#e0a020', TEAL = '#7fe6df';
const MODS_ON = { speed: 1.45, damage: 2.5, phase: true, trail: true, trailColor: GOLD };
const MODS_OFF = { speed: 1, damage: 1, phase: false, trail: false, trailColor: undefined, airPlatform: null };
const Rn = Math.round;
const dur = () => getStats().duration || 1;

function rectDist(e, px, py) {
  const dx = Math.max(e.x - px, 0, px - (e.x + e.w));
  const dy = Math.max(e.y - py, 0, py - (e.y + e.h));
  return Math.hypot(dx, dy);
}

// ----------------------------------------------------------------- arte
defineImage('unravel_orb', 12, 12, (pc) => {
  pc.circle(5.5, 5.5, 5, GOLD);
  for (let t = 0; t < 6.3; t += 0.1) {
    pc.px(Math.floor(5.5 + Math.cos(t) * 4), Math.floor(5.5 + Math.sin(t) * 1.6 + Math.cos(t) * 1.2), GOLD_D);
    pc.px(Math.floor(5.5 + Math.cos(t) * 1.5), Math.floor(5.5 + Math.sin(t) * 4), GOLD_D);
  }
  pc.circle(4, 3.5, 1.2, '#ffffff');
  pc.outline('#5a3a10');
});

// ============================================================================
// PLATAFORMA DE FIO (pulo no ar)
// ============================================================================
class UnravelPlatform extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 28; this.h = 5; this.oneway = true; this.z = 45;
    this.life = PLAT_LIFE; this.alwaysUpdate = true;
  }
  update(dt) {
    this.tickTimers(dt);
    this.life -= dt;
    if (Math.random() < dt * 8) this.level.particles.emit('sparkle', this.x + Math.random() * this.w, this.y + 2, 1);
    if (this.life <= 0) { this.level.particles.emit('thread', this.cx, this.cy, 6); this.remove(); }
  }
  draw(ctx) {
    if (this.life < 0.45 && Math.floor(this.life * 14) % 2 === 0) return;
    const k = Math.min(1, this.t / 0.08), w = Rn(this.w * k), x = Rn(this.cx - w / 2), y = Rn(this.y);
    VFX.drawGlow(ctx, this.cx, y + 2, 16, GOLD, 0.35);
    ctx.fillStyle = '#5a3a10'; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = GOLD_D; ctx.fillRect(x + 1, y + 1, w - 2, 3);
    ctx.fillStyle = GOLD;
    for (let i = 1; i < w - 1; i++) if ((i + Math.floor(this.t * 12)) % 4 < 2) ctx.fillRect(x + i, y + 2, 1, 1);
    ctx.fillStyle = GOLD_L; ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 1, 3, 1);
  }
}
registerEntity('unravel_platform', UnravelPlatform);

function airPlatform(p) {
  const L = p.level;
  L.add(new UnravelPlatform(L, Rn(p.cx - 14), Rn(p.bottom) + 1));
  L.particles.emit('unravel_fiber', p.cx, p.bottom, 6, { angle: [20, 160] });
  p.doJump(PLAT_JUMP, true);
}

// ============================================================================
// BARREIRA DE FIOS ('Y')
// ============================================================================
class ThreadBarrier extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 16; this.h = 16; this.solid = true; this.z = 9;
    (l._barrierCells ||= new Set()).add(`${x / TILE},${y / TILE}`);
    this.light = { r: 16, color: GOLD, i: 0.25 };
  }
  init() {
    const c = this.level._barrierCells, cx = this.x / TILE, cy = this.y / TILE;
    this.capTop = !c.has(`${cx},${cy - 1}`);
    this.capBot = !c.has(`${cx},${cy + 1}`);
  }
  update(dt) {
    this.tickTimers(dt);
    const p = this.level.player;
    const inside = p && rectsOverlap(p, this);
    let want = !(p && p.mods.phase);
    if (want && inside) {   // forma acabou com o Tico dentro: não prende, empurra para fora
      want = false;
      p.x += (p.cx < this.cx ? -1 : 1) * 70 * dt;
    }
    if (want !== this.solid) { this.solid = want; this.level.refreshSolids(); }
  }
  draw(ctx) {
    const p = this.level.player, x = Rn(this.x), y = Rn(this.y);
    const open = !this.solid;
    const pa = ctx.globalAlpha;
    if (!open) VFX.drawGlow(ctx, x + 8, y + 8, 12, GOLD, 0.18 + Math.sin(this.t * 4 + y) * 0.05);
    ctx.globalAlpha = pa * (open ? 0.45 : 1);
    // fios horizontais (mais fracos)
    ctx.fillStyle = open ? '#a07040' : '#c87a3a';
    for (const hy of [4, 11]) ctx.fillRect(x, y + hy, 16, 1);
    // fios verticais esticados (se abrem ao redor do Tico)
    for (const lx of [2, 7, 12]) {
      const gx = x + lx;
      for (let j = 0; j < 16; j++) {
        const wy = y + j;
        let off = open ? Rn(Math.sin(this.t * 6 + wy * 0.5 + lx) * 1) : 0;
        if (p && wy >= p.y - 2 && wy <= p.bottom + 2) {
          const d = gx - p.cx;
          if (Math.abs(d) < 9) off += Math.sign(d || 1) * (open ? Rn(9 - Math.abs(d)) : (Math.abs(d) < 4 ? 1 : 0));
        }
        ctx.fillStyle = (j + Math.floor(this.t * 10)) % 6 === 0 ? '#ffffff' : (lx === 7 ? GOLD_L : GOLD);
        ctx.fillRect(gx + off, wy, 1, 1);
        if (!open) { ctx.fillStyle = GOLD_D; ctx.fillRect(gx + off + 1, wy, 1, 1); }
      }
    }
    ctx.globalAlpha = pa;
    // pinos de ancoragem nas pontas da coluna
    for (const [cap, py] of [[this.capTop, y], [this.capBot, y + 13]]) {
      if (!cap) continue;
      ctx.fillStyle = '#3a2410'; ctx.fillRect(x, py, 16, 3);
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(x + 1, py + 1, 14, 1);
      ctx.fillStyle = GOLD; for (const lx of [2, 7, 12]) ctx.fillRect(x + lx, py + 1, 1, 1);
    }
  }
}
registerEntity('thread_barrier', ThreadBarrier);

// ============================================================================
// ORBE DE CARGA
// ============================================================================
class UnravelOrb extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 12; this.h = 12; this.x = x + 2; this.y = y + 2; this.z = 30;
    this.hideT = 0; this.light = { r: 20, color: GOLD, i: 0.45 };
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.hideT > 0) {
      this.hideT -= dt;
      if (this.hideT <= 0) { this.level.particles.emit('sparkle', this.cx, this.cy, 6); this.light = { r: 20, color: GOLD, i: 0.45 }; }
      return;
    }
    if (Math.random() < dt * 5) this.level.particles.emit('sparkle', this.cx + (Math.random() - 0.5) * 14, this.cy + (Math.random() - 0.5) * 14, 1);
    const p = this.level.player;
    if (p && p.state !== 'dead' && rectsOverlap(p, { x: this.x - 2, y: this.y - 2 + this.bob, w: this.w + 4, h: this.h + 4 })) this.pick(p);
  }
  get bob() { return Rn(Math.sin(this.t * 3) * 2); }
  pick(p) {
    p.unravelMeter = Math.min(1, (p.unravelMeter || 0) + ORB_GAIN);
    audio.sfx('star', { pitch: 1.5, vol: 0.5 });
    this.level.particles.emit('thread', this.cx, this.cy, 10);
    this.level.particles.emit('sparkle', this.cx, this.cy, 8);
    VFX.spawnFloatingText(this.level, this.cx, this.y - 4, p.unravelMeter >= 1 ? 'Carga cheia!' : '+Carga', GOLD);
    if (this.props.once) { this.remove(); return; }
    this.hideT = this.props.respawn ?? 10;
    this.light = null;
  }
  draw(ctx) {
    const cx = Rn(this.cx), cy = Rn(this.cy) + this.bob;
    if (this.hideT > 0) {   // contorno fraco enquanto volta
      ctx.globalAlpha = 0.25; ctx.fillStyle = GOLD;
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + this.t; ctx.fillRect(Rn(cx + Math.cos(a) * 5), Rn(cy + Math.sin(a) * 5), 1, 1); }
      ctx.globalAlpha = 1;
      return;
    }
    VFX.drawGlow(ctx, cx, cy, 13, GOLD, 0.35 + Math.sin(this.t * 5) * 0.1);
    drawImage(ctx, 'unravel_orb', cx - 6, cy - 6);
    for (let i = 0; i < 3; i++) {
      const a = this.t * 4 + i * 2.09;
      ctx.fillStyle = i ? GOLD_L : '#ffffff';
      ctx.fillRect(Rn(cx + Math.cos(a) * 9), Rn(cy + Math.sin(a) * 4), 1, 1);
    }
  }
}
registerEntity('unravel_orb', UnravelOrb);

// ============================================================================
// EFEITO DA TEMPESTADE DE FIOS
// ============================================================================
class BlastFx extends Entity {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 1; this.h = 1; this.z = 70; this.alwaysDraw = true; this.alwaysUpdate = true; }
  update(dt) { this.t += dt; if (this.t > 0.5) this.remove(); }
  draw(ctx) {
    const k = this.t / 0.5, reach = BLAST_R * Math.min(1, this.t / 0.12), start = k > 0.3 ? BLAST_R * (k - 0.3) / 0.7 : 0;
    ctx.globalAlpha = 1 - k * 0.6;
    for (let i = 0; i < 14; i++) {
      const a = i * (Math.PI * 2 / 14) + 0.2;
      const r = reach * (i % 2 ? 0.8 : 1);
      if (r <= start) continue;
      VFX.drawThreadLine(ctx, this.x + Math.cos(a) * start, this.y + Math.sin(a) * start, this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, this.t * 3 + i, i % 3 ? GOLD : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
}
registerEntity('unravel_blast_fx', BlastFx);

// ============================================================================
// HABILIDADE
// ============================================================================
function activate(p, level) {
  p._unr = { t: 0 };
  p.unravelMeter = 1;
  Object.assign(p.mods, MODS_ON, { airPlatform });
  p.castT = 0.4;
  p.invuln = Math.max(p.invuln, 0.6);
  p.setCooldown('unravel', 0.35);
  level.hitstop(0.5);
  level.flash('#fff3c0', 0.4);
  level.shake(0.45);
  level.particles.emit('unravel_fiber', p.cx, p.cy, 28, { speed: [60, 160] });
  level.particles.emit('thread', p.cx, p.cy, 16);
  level.particles.emit('stars_burst', p.cx, p.cy, 10);
  VFX.spawnShockwave(level, p.cx, p.cy, { radius: 44, color: GOLD, dur: 0.6 });
  audio.sfx('unravel_start');
  game.vibrate?.(80);
}
function finish(p, level) {
  p._unr = null;
  p.unravelMeter = 0;
  Object.assign(p.mods, MODS_OFF);
  p.setCooldown('unravel', 1);
  audio.sfx('unravel_end');
  if (level) {
    level.particles.emit('unravel_fiber', p.cx, p.cy, 14, { gravity: 120 });
    VFX.spawnShockwave(level, p.cx, p.cy, { radius: 20, color: TEAL, particles: false, dur: 0.35 });
  }
}
function blast(p, level) {
  const cx = p.cx, cy = p.cy;
  for (const e of level.entities) {
    if (e.dead || !e.hittable || e === p || e.isPlayer || e.isDecoy || rectDist(e, cx, cy) > BLAST_R) continue;
    if (e.onHit) e.onHit(BLAST_DMG, p, { kind: 'blast' });
    else e.hurt(BLAST_DMG, p, { knockback: 240 });
  }
  audio.sfx('unravel_blast');
  level.flash('#fff3c0', 0.3);
  level.shake(0.75);
  level.hitstop(0.12);
  game.vibrate?.(120);
  level.add(new BlastFx(level, cx, cy, {}));
  VFX.spawnShockwave(level, cx, cy, { radius: BLAST_R, color: GOLD, color2: '#ffffff', thickness: 3, dur: 0.5, sparks: 16 });
  VFX.spawnShockwave(level, cx, cy, { radius: BLAST_R * 0.6, color: TEAL, particles: false, dur: 0.4 });
  level.particles.emit('thread', cx, cy, 30, { speed: [80, 200] });
  level.particles.emit('stars_burst', cx, cy, 14);
  finish(p, level);
}

/** Fios soltos saindo do corpo (desenho). */
function looseFibers(ctx, p, front) {
  const f = p.facing, t = p.t;
  const pts = front ? [[4, -16], [-2, -6], [6, -10]] : [[-5, -12], [-7, -4], [1, -19], [-3, -14]];
  pts.forEach(([ox, oy], i) => {
    let x = p.cx + ox * f, y = p.bottom + oy;
    ctx.fillStyle = (i + (front ? 1 : 0)) % 2 ? GOLD : TEAL;
    for (let j = 0; j < 7; j++) {
      x -= f * 1; y += Math.sin(t * 9 + i * 1.7 + j * 0.8) * 0.9 + (front ? 0.3 : -0.1);
      ctx.fillRect(Rn(x), Rn(y), 1, 1);
    }
  });
}
/** Fios em órbita (metade de trás em drawBehind, metade da frente em draw). */
function orbit(ctx, p, front) {
  const cx = p.cx, cy = p.cy - 1;
  for (let i = 0; i < 3; i++) {
    const tilt = i * 1.05 + 0.3, sp = 4 + i * 0.7;
    for (let j = 0; j < 9; j++) {
      const a = p.t * sp + i * 2.1 - j * 0.12;
      const s = Math.sin(a);
      if ((s > 0) !== front) continue;
      const ex = Math.cos(a) * 15, ey = s * 5;
      const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt) * 0.5, y = cy + ex * Math.sin(tilt) * 0.35 + ey;
      ctx.globalAlpha = 1 - j / 9;
      ctx.fillStyle = j === 0 ? '#ffffff' : GOLD;
      ctx.fillRect(Rn(x), Rn(y), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

registerAbility('unravel', {
  name: 'Forma Desfiada', icon: 'icon_ab_unravel', cost: 0, cooldown: 1, color: GOLD,
  desc: 'Com a carga cheia, Tico se desfia: mais rápido e forte, atravessa barreiras de fios e cria plataformas no ar. Aperte de novo para a Tempestade de Fios.',
  onPress(p, level) {
    if (p._unr) { blast(p, level); return; }
    if ((p.unravelMeter || 0) < 1) {
      audio.sfx('ui_denied');
      level.toast('A Forma Desfiada precisa de carga!', 'icon_ab_unravel');
      p.setCooldown('unravel', 0.6);
      return;
    }
    activate(p, level);
  },
  update(p, dt) {
    if (!p._unr) {
      if (p.unravelMeter >= 1 && save.data.abilities?.unravel && Math.random() < dt * 4) {
        p.level.particles.emit('sparkle', p.cx + (Math.random() - 0.5) * 16, p.cy + (Math.random() - 0.5) * 16, 1);
      }
      return;
    }
    p._unr.t += dt;
    p.unravelMeter = Math.max(0, p.unravelMeter - dt / (DURATION * dur()));
    if (Math.random() < dt * 10) p.level.particles.emit('unravel_fiber', p.cx, p.cy, 1, { speed: [10, 30] });
    if (p.unravelMeter <= 0 || p.state === 'dead') finish(p, p.level);
  },
  drawBehind(ctx, p) {
    if (!p._unr) return;
    const low = p.unravelMeter < 0.2 && Math.floor(p.t * 8) % 2 === 0;
    VFX.drawGlow(ctx, p.cx, p.cy, 22 + Math.sin(p.t * 6) * 2, low ? TEAL : GOLD, 0.4);
    orbit(ctx, p, false);
    looseFibers(ctx, p, false);
  },
  draw(ctx, p) {
    if (!p._unr) return;
    // brilho dourado "desfiando" o corpo
    const a = 0.16 + (Math.sin(p.t * 7) + 1) * 0.08;
    drawSprite(ctx, 'tico', p.anim, p.frame, p.cx, p.bottom, { flip: p.facing < 0, variant: GOLD_L, alpha: a });
    looseFibers(ctx, p, true);
    orbit(ctx, p, true);
    // medidor esvaziando sobre a cabeça
    const w = 16, x = Rn(p.cx - w / 2), y = Rn(p.y) - 20, fill = Rn(w * p.unravelMeter);
    if (p.unravelMeter < 0.2 && Math.floor(p.t * 8) % 2 === 0) return;
    ctx.fillStyle = '#2a1a08'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = GOLD; ctx.fillRect(x, y, fill, 2);
    ctx.fillStyle = GOLD_L; ctx.fillRect(x, y, fill, 1);
  },
  onUnequip(p, level) { if (p._unr) finish(p, level); },
});

// energia coletada também carrega um pouco a Forma Desfiada (embrulha o pick() do coletável)
game.events?.on?.('levelStart', () => {
  const E = R.entities.get('energy');
  if (!E || E.prototype._unrWrapped || typeof E.prototype.pick !== 'function') return;
  const orig = E.prototype.pick;
  E.prototype.pick = function (p) {
    orig.call(this, p);
    if (p && p.unravelMeter !== undefined) p.unravelMeter = Math.min(1, p.unravelMeter + ENERGY_GAIN);
  };
  E.prototype._unrWrapped = true;
});

// ============================================================================
// Fase de teste: ?level=test_ab_unravel&unlock=all
// ============================================================================
registerLevel({
  id: 'test_ab_unravel', world: 0, index: 0, name: 'Teste: Forma Desfiada', subtitle: 'Desfiar é Libertar',
  tileset: 'default', background: 'default', music: null, parTime: 90,
  map: buildTestMap(64, 18, (fill, put) => {
    fill(0, 14, 63, 17, '#');
    put(2, 13, 'P');
    put(6, 12, 'u'); put(9, 12, 'u');            // 2 orbes = carga cheia
    fill(15, 0, 15, 8, '#'); fill(15, 9, 15, 13, 'Y');
    fill(21, 14, 33, 17, '.');                   // abismo largo: plataformas no ar
    put(41, 13, 'a'); put(45, 13, 'a'); put(48, 13, 'a');
    put(62, 13, 'E');
  }),
  legend: { u: 'unravel_orb', a: 'ab_test_dummy' },
  props: { '41,13': { hp: 6 }, '45,13': { hp: 6 }, '48,13': { hp: 6 } },
  onStart() { if (save.data.abilities?.unravel) save.data.equippedAbility = 'unravel'; },
});
