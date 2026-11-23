// =============================================================================
// player.js — TICO, o dinossauro de pelúcia. Controlador de plataforma com
// aceleração, coyote time, jump buffer, pulo variável, pulo duplo, corrida,
// esquiva (dash), ataque em combo com fio, ataque carregado (agulha), nado,
// interação e habilidades dimensionais (via registro R.abilities).
//
// Animações esperadas no sprite 'tico' (src/game/art/tico.js):
//   idle walk run skid jump fall land attack1 attack2 attack3 attack_up
//   attack_down charge dash hurt death swim cast celebrate sleep scared
//   look_up look_down
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { moveBody, T } from '../../engine/tilemap.js';
import { drawSprite, animFrame, animDone, getSprite, frameMeta } from '../../engine/sprites.js';
import { input } from '../../engine/input.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { approach, clamp, TILE, rectsOverlap } from '../../engine/util.js';
import { R } from '../registry.js';
import { getStats } from '../stats.js';
import { drawCosmetics } from '../art/cosmetics.js';

// ---- Tunables (px, s)
export const P = {
  W: 12, H: 22,
  WALK: 92, RUN: 150, RUN_DELAY: 0.55,
  ACC_GROUND: 950, DEC_GROUND: 1400, TURN: 2000, ACC_AIR: 720, DEC_AIR: 380,
  JUMP_V: 372, DJUMP_V: 330, GRAV_UP: 1000, GRAV_CUT: 2600, GRAV_FALL: 1380, APEX_MUL: 0.55, MAX_FALL: 340,
  COYOTE: 0.1, BUFFER: 0.13,
  DASH_V: 300, DASH_T: 0.16,
  SWIM_ACC: 520, SWIM_MAX: 90, SWIM_DRAG: 3.2, SWIM_GRAV: 160, SWIM_STROKE: 170,
  HURT_INV: 1.25, ATTACK_T: 0.24, COMBO_WINDOW: 0.32, CHARGE_T: 0.5, NEEDLE_COST: 15,
};

export const ABILITY_ORDER = ['stitch', 'unstitch', 'rewind', 'decoy', 'unravel'];

export class Player extends Entity {
  constructor(level, x, y) {
    super(level, x, y);
    this.w = P.W; this.h = P.H;
    this.z = 50;
    this.isPlayer = true;
    const st = getStats();
    this.maxHp = st.maxHp;
    this.hp = this.maxHp;
    this.maxEnergy = st.maxEnergy;
    this.energy = this.maxEnergy;
    this.state = 'normal';   // normal | dash | hurt | dead | frozen | celebrate
    this.anim = 'idle';
    this.animT = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumping = false;
    this.airJumps = 0;
    this.canAirDash = true;
    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = 1;
    this.runT = 0;
    this.attackT = 0;
    this.attackKind = null;
    this.combo = 0;
    this.comboT = 0;
    this.attackHit = new Set();
    this.chargeT = 0;
    this.idleT = 0;
    this.landT = 0;
    this.inWater = false;
    this.oxygen = 1;
    this.lastSafe = { x, y };
    this.safeTimer = 0;
    this.lookT = 0;
    this.lookUp = false;
    this.lookDown = false;
    this.dropT = 0;
    this.forceX = 0; this.forceY = 0;   // external accelerations (currents, wind)
    this.carryVX = 0;                  // momentum from platforms
    this.abilityCd = {};
    this.mods = { speed: 1, damage: 1, gravity: 1, invulnerable: false, phase: false };
    this.unravelMeter = 0;             // 0..1 Forma Desfiada charge
    this.cutsceneAnim = null;          // forced anim during cutscenes
    this.footstepT = 0;
    this.interactTarget = null;
    this.hurtT = 0;
    this.deathT = 0;
    this.trail = [];
    this.squashT = 0;
    this.prevGrounded = true;
  }

  get stats() { return getStats(); }
  get equipped() { return save.data.equippedAbility; }
  get ability() { return R.abilities.get(this.equipped); }
  get dashing() { return this.state === 'dash'; }
  get controllable() { return this.state === 'normal' || this.state === 'dash'; }

  setAnim(a) {
    if (this.anim !== a) { this.anim = a; this.animT = 0; }
  }

  // --------------------------------------------------------------- energy
  costOf(base) { return Math.max(1, Math.round(base * (1 - this.stats.efficiency))); }
  spendEnergy(amount) {
    const c = this.costOf(amount);
    if (this.energy < c) { this.level.flashEnergy?.(); audio.sfx('ui_denied'); return false; }
    this.energy -= c;
    return true;
  }
  gainEnergy(n) { this.energy = Math.min(this.maxEnergy, this.energy + n); }
  heal(n = 1) { this.hp = Math.min(this.maxHp, this.hp + n); }
  addForce(fx, fy) { this.forceX += fx; this.forceY += fy; }

  // --------------------------------------------------------------- update
  update(dt) {
    this.tickTimers(dt);
    this.animT += dt;
    const st = this.stats;
    this.maxHp = st.maxHp; this.maxEnergy = st.maxEnergy;
    if (this.state === 'dead') { this.updateDead(dt); return; }
    if (this.state === 'frozen' || this.state === 'celebrate') {
      this.vx = approach(this.vx, 0, P.DEC_GROUND * dt);
      this.applyGravityAndMove(dt, false);
      if (this.state === 'celebrate') this.setAnim('celebrate');
      else this.setAnim(this.cutsceneAnim || (this.grounded ? (Math.abs(this.vx) > 10 ? 'walk' : 'idle') : this.vy < 0 ? 'jump' : 'fall'));
      return;
    }

    // energy regen
    this.energy = Math.min(this.maxEnergy, this.energy + st.regen * dt);
    for (const k in this.abilityCd) if (this.abilityCd[k] > 0) this.abilityCd[k] -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.comboT > 0) this.comboT -= dt; else this.combo = 0;
    if (this.landT > 0) this.landT -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.hurtInv > 0) this.hurtInv -= dt;

    const inp = this.level.inputLocked ? null : input;
    const ax = inp ? inp.axisX() : 0;
    const anyInput = inp && (ax !== 0 || inp.down('jump') || inp.down('attack') || inp.down('ability') || inp.down('dash') || inp.down('up') || inp.down('down'));
    this.idleT = anyInput || !this.grounded || Math.abs(this.vx) > 5 ? 0 : this.idleT + dt;

    // water check (center)
    const wasInWater = this.inWater;
    this.inWater = this.level.map.rectHas(this.x + 2, this.y + 6, this.w - 4, this.h - 8, T.WATER) || this.level.inWaterVolume?.(this);
    if (this.inWater !== wasInWater) {
      this.level.particles.emit('splash', this.cx, this.y + (this.inWater ? this.h : 4), 10);
      audio.sfx(this.inWater ? 'splash_in' : 'splash_out');
      if (this.inWater) { this.vy *= 0.35; this.airJumps = 0; this.canAirDash = true; }
    }
    this.updateOxygen(dt);

    // ability input
    if (inp) this.handleAbilityInput(inp, dt);

    if (this.state === 'dash') this.updateDash(dt);
    else if (this.state === 'hurt') {
      if (this.hurtT <= 0) this.state = 'normal';
      this.applyGravityAndMove(dt, true);
    } else if (this.inWater) this.updateSwim(dt, inp, ax);
    else this.updateNormal(dt, inp, ax);

    // attacks (both on land and water)
    if (inp && this.state === 'normal') this.handleAttack(dt, inp);
    this.updateAttackHitbox(dt);

    // ability per-frame updates
    for (const ab of R.abilities.values()) ab.update?.(this, dt);

    // hazards & pits
    this.checkHazards();
    // interactables
    this.updateInteract(inp);
    // safe position
    this.trackSafe(dt);
    // animation
    this.chooseAnim();
    // trail when dashing / unravel
    if (this.state === 'dash' || this.mods.trail) {
      this.trail.push({ x: this.x + this.w / 2, y: this.y + this.h, anim: this.anim, f: this.frame, flip: this.facing < 0, life: 0.18 });
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
    this.forceX = 0; this.forceY = 0;
  }

  updateNormal(dt, inp, ax) {
    const st = this.stats;
    const mods = this.mods;
    // ---- horizontal
    const running = inp && (inp.down('run') || this.runT >= P.RUN_DELAY);
    if (ax !== 0 && this.attackT <= 0.05) this.facing = ax;
    if (ax !== 0) this.runT += dt; else this.runT = 0;
    if (this.grounded && ax !== 0 && Math.sign(this.vx) !== ax && Math.abs(this.vx) > 60) this.runT = 0;
    const maxSpeed = (running ? P.RUN : P.WALK) * st.speed * mods.speed * (this.chargeT > P.CHARGE_T ? 0.6 : 1);
    const target = ax * maxSpeed;
    let acc;
    if (this.grounded) {
      if (ax === 0) acc = P.DEC_GROUND;
      else if (Math.sign(this.vx) !== ax && this.vx !== 0) acc = P.TURN;
      else acc = P.ACC_GROUND;
    } else acc = ax === 0 ? P.DEC_AIR : P.ACC_AIR;
    // attacking on ground slows you
    if (this.attackT > 0 && this.grounded) acc *= 1.4;
    const tgt = this.attackT > 0 && this.grounded ? target * 0.35 : target;
    this.vx = approach(this.vx, tgt, acc * dt);
    // skid particles
    if (this.grounded && ax !== 0 && Math.sign(this.vx) === -ax && Math.abs(this.vx) > 70 && Math.random() < 0.5) {
      this.level.particles.emit('dust', this.cx - ax * 4, this.bottom - 1, 1);
      if (this.anim !== 'skid') audio.sfx('skid', { vol: 0.5, cooldown: 0.25 });
    }

    // ---- jump buffer / coyote
    if (this.grounded) { this.coyote = P.COYOTE; this.airJumps = 0; this.canAirDash = true; }
    else this.coyote -= dt;
    if (inp && inp.pressed('jump')) this.jumpBuf = P.BUFFER;
    else this.jumpBuf -= dt;

    // drop through one-way
    if (inp && this.grounded && this.onOneWay && inp.down('down') && this.jumpBuf > 0) {
      this.dropT = 0.22; this.jumpBuf = 0; this.y += 2; this.grounded = false; this.coyote = 0;
    } else if (this.jumpBuf > 0) {
      if (this.coyote > 0) this.doJump(P.JUMP_V, false);
      else if (save.data.abilities.doubleJump && this.airJumps < 1 && !this.inWater) this.doJump(P.DJUMP_V, true);
      else if (this.mods.airPlatform && this.airJumps < 3) { this.mods.airPlatform(this); }
    }

    // ---- dash
    if (inp && inp.pressed('dash') && this.dashCd <= 0 && (this.grounded || this.canAirDash)) this.startDash(ax || this.facing);

    this.applyGravityAndMove(dt, inp && inp.down('jump'));

    // look up/down
    if (inp && this.grounded && Math.abs(this.vx) < 5 && ax === 0) {
      if (inp.down('up') && !this.interactTarget) this.lookT += dt;
      else if (inp.down('down')) this.lookT -= dt;
      else this.lookT = 0;
    } else this.lookT = 0;
    this.lookUp = this.lookT > 0.45;
    this.lookDown = this.lookT < -0.45;
  }

  doJump(v, isDouble) {
    this.vy = -v;
    this.jumping = true;
    this.jumpBuf = 0;
    this.coyote = 0;
    this.grounded = false;
    if (isDouble) {
      this.airJumps++;
      this.level.particles.emit('thread', this.cx, this.bottom, 8, { angle: [30, 150], speed: [30, 70] });
      this.level.particles.emit('dust', this.cx, this.bottom, 5, { angle: [60, 120] });
      audio.sfx('double_jump');
      this.setAnim('jump');
      this.animT = 0;
      this.flipSpin = 0.3;
    } else {
      this.level.particles.emit('dust', this.cx, this.bottom - 1, 5);
      audio.sfx('jump', { randomPitch: 0.05 });
    }
    this.squashT = 0.12;
  }

  applyGravityAndMove(dt, holdingJump) {
    let g;
    if (this.vy < 0) g = holdingJump && this.jumping ? P.GRAV_UP : P.GRAV_CUT;
    else g = P.GRAV_FALL;
    if (holdingJump && Math.abs(this.vy) < 45 && this.jumping) g *= P.APEX_MUL;
    if (this.vy >= 0) this.jumping = false;
    g *= this.mods.gravity;
    this.vy = Math.min(P.MAX_FALL, this.vy + g * dt);
    this.vx += this.forceX * dt;
    this.vy += this.forceY * dt;
    const wasGrounded = this.grounded;
    const prevVy = this.vy;
    moveBody(this, this.vx * dt, this.vy * dt, this.level, { dropThrough: this.dropT > 0 });
    if (this.grounded && !wasGrounded) this.onLand(prevVy);
    if (this.hitCeiling && this.vy <= 0) { this.vy = 20; this.jumping = false; }
  }

  onLand(vy) {
    if (vy > 120) {
      this.landT = 0.12;
      this.level.particles.emit('land', this.cx - 4, this.bottom - 1, 3, { angle: [175, 185] });
      this.level.particles.emit('land', this.cx + 4, this.bottom - 1, 3, { angle: [-5, 5] });
      audio.sfx('land', { vol: Math.min(1, vy / 300) });
    }
    if (vy > 300) this.level.shake(0.12);
  }

  startDash(dir) {
    this.state = 'dash';
    this.dashT = P.DASH_T;
    this.dashDir = dir;
    this.facing = dir;
    this.dashCd = this.stats.dashCooldown;
    if (!this.grounded) this.canAirDash = false;
    this.invuln = Math.max(this.invuln, P.DASH_T + 0.06);
    this.vx = dir * P.DASH_V * this.mods.speed;
    this.vy = 0;
    this.attackT = 0;
    audio.sfx('dash');
    this.level.particles.emit('dust', this.cx, this.bottom - 2, 6, { angle: dir > 0 ? [160, 200] : [-20, 20], speed: [30, 80] });
    game.vibrate(10);
  }

  updateDash(dt) {
    this.dashT -= dt;
    this.vx = this.dashDir * P.DASH_V * this.mods.speed;
    this.vy = 0;
    moveBody(this, this.vx * dt, 0, this.level, {});
    if (Math.random() < 0.6) this.level.particles.emit('thread', this.cx - this.dashDir * 6, this.cy, 1, { speed: [5, 20] });
    if (this.dashT <= 0 || this.hitWall) {
      this.state = 'normal';
      this.vx = this.dashDir * P.WALK * 1.1;
    }
  }

  updateSwim(dt, inp, ax) {
    const ay = inp ? inp.axisY() : 0;
    if (ax !== 0) this.facing = ax;
    this.vx += ax * P.SWIM_ACC * dt * this.mods.speed;
    this.vy += (ay * P.SWIM_ACC * 0.8 + P.SWIM_GRAV) * dt;
    const k = Math.exp(-P.SWIM_DRAG * dt);
    this.vx *= k; this.vy *= k;
    this.vx = clamp(this.vx, -P.SWIM_MAX * 1.6, P.SWIM_MAX * 1.6);
    this.vy = clamp(this.vy, -P.SWIM_MAX * 1.8, P.SWIM_MAX);
    // stroke
    if (inp && inp.pressed('jump')) {
      // at surface -> jump out
      const surface = !this.level.map.rectHas(this.x, this.y - 6, this.w, 4, T.WATER);
      if (surface) { this.vy = -P.JUMP_V * 0.9; this.jumping = true; audio.sfx('jump'); }
      else {
        this.vy = Math.min(this.vy, -P.SWIM_STROKE);
        if (ax) this.vx += ax * 60;
        this.level.particles.emit('bubble', this.cx, this.cy, 3);
        audio.sfx('swim', { randomPitch: 0.1 });
      }
      this.setAnim('swim'); this.animT = 0;
    }
    if (inp && inp.pressed('dash') && this.dashCd <= 0) {
      this.vx = (ax || this.facing) * P.SWIM_MAX * 2.4;
      this.vy += ay * 120;
      this.dashCd = this.stats.dashCooldown;
      this.invuln = Math.max(this.invuln, 0.2);
      this.level.particles.emit('bubble', this.cx, this.cy, 6);
      audio.sfx('dash', { pitch: 0.8 });
    }
    this.vx += this.forceX * dt;
    this.vy += this.forceY * dt;
    moveBody(this, this.vx * dt, this.vy * dt, this.level, {});
    if (Math.random() < 0.03) this.level.particles.emit('bubble', this.cx + this.facing * 4, this.y + 4, 1);
  }

  updateOxygen(dt) {
    if (!this.level.data.oxygen) { this.oxygen = 1; return; }
    const headIn = this.level.map.rectHas(this.x + 3, this.y, this.w - 6, 4, T.WATER);
    if (headIn) {
      this.oxygen -= dt / (this.level.data.oxygenTime || 16);
      if (this.oxygen <= 0) { this.oxygen = 0.35; this.hurt(1, null, { noKnock: true }); }
    } else this.oxygen = Math.min(1, this.oxygen + dt * 0.8);
  }

  handleAbilityInput(inp, dt) {
    // direct select
    for (let i = 0; i < 5; i++) if (inp.pressed('ab' + (i + 1))) this.selectAbility(ABILITY_ORDER[i]);
    if (inp.pressed('cycle')) this.cycleAbility(1);
    const ab = this.ability;
    if (!ab || !save.data.abilities[this.equipped]) return;
    if (!this.controllable && !ab.usableAnytime) return;
    if (inp.pressed('ability')) {
      if ((this.abilityCd[ab.id] || 0) > 0) { audio.sfx('ui_denied'); return; }
      ab.onPress?.(this, this.level);
    }
    if (inp.down('ability')) ab.onHold?.(this, this.level, dt);
    if (inp.released('ability')) ab.onRelease?.(this, this.level);
  }
  unlockedAbilities() { return ABILITY_ORDER.filter((a) => save.data.abilities[a] && R.abilities.has(a)); }
  selectAbility(id) {
    if (!save.data.abilities[id]) return;
    if (save.data.equippedAbility !== id) {
      R.abilities.get(save.data.equippedAbility)?.onUnequip?.(this, this.level);
      save.data.equippedAbility = id;
      audio.sfx('ui_switch');
      this.level.hud?.pulseAbility?.();
    }
  }
  cycleAbility(dir = 1) {
    const list = this.unlockedAbilities();
    if (list.length < 2) { if (list.length === 1) this.selectAbility(list[0]); return; }
    const i = list.indexOf(this.equipped);
    this.selectAbility(list[(i + dir + list.length) % list.length]);
  }
  setCooldown(id, s) { this.abilityCd[id] = s; }
  cooldownOf(id) { return Math.max(0, this.abilityCd[id] || 0); }

  // --------------------------------------------------------------- combat
  handleAttack(dt, inp) {
    if (inp.pressed('attack')) {
      this.chargeT = 0.0001;
      if (this.attackT <= 0.06) this.startAttack(inp);
    }
    if (inp.down('attack') && this.chargeT > 0) {
      this.chargeT += dt;
      if (this.chargeT > P.CHARGE_T && Math.random() < 0.4) this.level.particles.emit('energy', this.cx + this.facing * 8, this.cy, 1, { speed: [5, 15] });
      if (this.chargeT > P.CHARGE_T && this.chargeT - dt <= P.CHARGE_T) audio.sfx('charge_ready');
    }
    if (inp.released('attack')) {
      if (this.chargeT > P.CHARGE_T) this.fireNeedle();
      this.chargeT = 0;
    }
  }

  startAttack(inp) {
    const up = inp.down('up'), down = inp.down('down');
    this.attackHit.clear();
    if (down && !this.grounded) { this.attackKind = 'down'; this.attackT = P.ATTACK_T; this.setAnim('attack_down'); }
    else if (up) { this.attackKind = 'up'; this.attackT = P.ATTACK_T; this.setAnim('attack_up'); }
    else {
      this.combo = this.comboT > 0 ? (this.combo % 3) + 1 : 1;
      this.comboT = P.COMBO_WINDOW + P.ATTACK_T + this.stats.comboWindow;
      this.attackKind = 'side' + this.combo;
      this.attackT = P.ATTACK_T + (this.combo === 3 ? 0.06 : 0);
      this.setAnim('attack' + this.combo);
      if (this.grounded) this.vx += this.facing * (this.combo === 3 ? 70 : 30);
    }
    audio.sfx(this.combo === 3 ? 'whip_big' : 'whip', { randomPitch: 0.08 });
  }

  /** Current attack hitbox (world rect) or null. */
  attackBox() {
    if (this.attackT <= 0) return null;
    const total = this.attackKind === 'side3' ? P.ATTACK_T + 0.06 : P.ATTACK_T;
    const el = total - this.attackT;
    if (el < 0.03 || el > 0.16) return null;
    const f = this.facing;
    switch (this.attackKind) {
      case 'up': return { x: this.cx - 12, y: this.y - 22, w: 24, h: 26 };
      case 'down': return { x: this.cx - 10, y: this.bottom - 4, w: 20, h: 22 };
      case 'side3': return { x: f > 0 ? this.right - 2 : this.x - 32, y: this.y - 4, w: 34, h: 24 };
      default: return { x: f > 0 ? this.right - 2 : this.x - 26, y: this.y + 1, w: 28, h: 16 };
    }
  }

  updateAttackHitbox(dt) {
    if (this.attackT > 0) this.attackT -= dt;
    const box = this.attackBox();
    if (!box) return;
    const dmg = (this.attackKind === 'side3' ? 1.5 : 1) * this.stats.power * this.mods.damage;
    let hitSomething = false;
    for (const e of this.level.entities) {
      if (e.dead || !e.hittable || this.attackHit.has(e)) continue;
      if (!rectsOverlap(box, e)) continue;
      this.attackHit.add(e);
      const res = e.onHit ? e.onHit(dmg, this, { kind: this.attackKind }) : e.hurt(dmg, this, { knockback: this.attackKind === 'side3' ? 200 : 120 });
      if (res !== false) {
        hitSomething = true;
        this.level.particles.emit('hit', (box.x + box.w / 2 + e.cx) / 2, (box.y + box.h / 2 + e.cy) / 2, 6);
        this.level.particles.emit('fabric', e.cx, e.cy, 3);
        this.unravelMeter = Math.min(1, this.unravelMeter + 0.025 * this.stats.unravelCharge);
      }
    }
    if (hitSomething) {
      audio.sfx('hit', { randomPitch: 0.1 });
      this.level.hitstop(this.attackKind === 'side3' ? 0.07 : 0.04);
      this.level.shake(0.08);
      if (this.attackKind === 'down') { this.vy = -300; this.airJumps = 0; this.canAirDash = true; }
    }
  }

  fireNeedle() {
    if (!this.spendEnergy(P.NEEDLE_COST)) return;
    const Needle = R.entities.get('player_needle');
    if (Needle) {
      const n = new Needle(this.level, this.cx + this.facing * 8, this.cy - 2, { dir: this.facing, damage: 3 * this.stats.power * this.mods.damage });
      this.level.add(n);
    }
    this.setAnim('attack3');
    this.attackT = 0.18; this.attackKind = 'needle';
    audio.sfx('needle');
    this.level.shake(0.06);
    this.vx -= this.facing * 40;
  }

  /** Damage the player. opts: { respawn:true (pit/spike), noKnock, force } */
  hurt(amount = 1, source = null, opts = {}) {
    if (this.state === 'dead' || game.debug.god) return false;
    if (!opts.force && (this.invuln > 0 || this.mods.invulnerable)) {
      if (opts.respawn) this.respawnSafe();
      return false;
    }
    this.hp -= amount;
    this.invuln = P.HURT_INV;
    this.hurtInv = P.HURT_INV;
    this.flash = 0.15;
    this.attackT = 0; this.chargeT = 0;
    audio.sfx('hurt');
    game.vibrate(60);
    this.level.hitstop(0.09);
    this.level.shake(0.35);
    this.level.particles.emit('fabric', this.cx, this.cy, 8);
    this.level.particles.emit('fluff', this.cx, this.cy, 6);
    this.level.onPlayerHurt?.(amount, source);
    if (this.hp <= 0) { this.die(); return true; }
    if (opts.respawn) { this.respawnSafe(); return true; }
    if (!opts.noKnock) {
      const dir = source ? Math.sign(this.cx - (source.cx ?? source.x ?? this.cx)) || -this.facing : -this.facing;
      this.vx = dir * 170;
      this.vy = -200;
      this.state = 'hurt';
      this.hurtT = 0.28;
    }
    return true;
  }

  respawnSafe() {
    this.level.fadeTeleport?.(this, this.lastSafe.x, this.lastSafe.y) ?? (this.x = this.lastSafe.x, this.y = this.lastSafe.y);
    this.vx = 0; this.vy = 0;
  }

  die() {
    this.hp = 0;
    this.state = 'dead';
    this.deathT = 0;
    this.vx = 0; this.vy = -180;
    this.setAnim('death');
    audio.sfx('death');
    audio.duck(0.25, 0.4);
    this.level.hitstop(0.2);
    this.level.shake(0.5);
  }
  updateDead(dt) {
    this.deathT += dt;
    this.vy = Math.min(P.MAX_FALL, this.vy + 700 * dt);
    if (this.deathT < 0.6) moveBody(this, 0, this.vy * dt, this.level, {});
    if (this.deathT > 0.5 && this.deathT - dt <= 0.5) this.level.particles.emit('fluff', this.cx, this.cy, 16);
    if (this.deathT > 1.5 && !this._deathReported) { this._deathReported = true; this.level.onPlayerDeath(); }
  }

  checkHazards() {
    if (this.state === 'dead') return;
    // spikes: shrunk hitbox
    if (this.level.map.rectHas(this.x + 3, this.y + 5, this.w - 6, this.h - 6, T.SPIKE)) {
      this.hurt(1, null, { respawn: true, force: false });
    }
    // fell out of map
    if (this.y > this.level.map.height + 40) {
      if (this.level.data.pitKills) { this.hp = 1; this.hurt(1, null, { force: true }); }
      else this.hurt(1, null, { respawn: true, force: true });
    }
  }

  trackSafe(dt) {
    this.safeTimer -= dt;
    if (this.safeTimer > 0 || !this.grounded || this.inWater || this.groundEntity || this.state !== 'normal') return;
    this.safeTimer = 0.2;
    // require solid ground under both feet and no spikes nearby
    const m = this.level.map;
    const fy = this.bottom + 2;
    const okL = m.solidAt(this.x + 1, fy) || m.at(this.x + 1, fy) === T.ONEWAY;
    const okR = m.solidAt(this.right - 1, fy) || m.at(this.right - 1, fy) === T.ONEWAY;
    if (!okL || !okR) return;
    if (m.rectHas(this.x - 20, this.y - 8, this.w + 40, this.h + 16, T.SPIKE)) return;
    this.lastSafe = { x: this.x, y: this.y };
  }

  updateInteract(inp) {
    let best = null, bd = 1e9;
    for (const e of this.level.entities) {
      if (!e.interactable || e.dead) continue;
      const r = e.interactRange ?? 22;
      const dx = Math.abs(e.cx - this.cx), dy = Math.abs(e.cy - this.cy);
      if (dx < r + e.w / 2 && dy < r + e.h / 2) { const d = dx + dy; if (d < bd) { bd = d; best = e; } }
    }
    this.interactTarget = best;
    if (best && inp && this.grounded && inp.pressed('interact') && this.state === 'normal') {
      inp.consume('interact');
      best.interact(this);
    }
  }

  // --------------------------------------------------------------- animation
  chooseAnim() {
    if (this.state === 'dead') { this.setAnim('death'); return; }
    if (this.cutsceneAnim) { this.setAnim(this.cutsceneAnim); return; }
    if (this.state === 'hurt') { this.setAnim('hurt'); return; }
    if (this.state === 'dash') { this.setAnim('dash'); return; }
    if (this.castT > 0) { this.castT -= 1 / 60; this.setAnim('cast'); return; }
    if (this.attackT > 0 && this.attackKind) {
      if (this.attackKind === 'needle') { this.setAnim('attack3'); return; }
      const a = this.attackKind.startsWith('side') ? 'attack' + this.attackKind.slice(4) : 'attack_' + this.attackKind;
      this.setAnim(a);
      return;
    }
    if (this.inWater) { if (this.anim !== 'swim' || animDone('tico', 'swim', this.animT)) this.setAnim('swim'); return; }
    if (this.chargeT > P.CHARGE_T) { this.setAnim('charge'); return; }
    if (!this.grounded) { this.setAnim(this.vy < 0 ? 'jump' : 'fall'); return; }
    if (this.landT > 0) { this.setAnim('land'); return; }
    const sp = Math.abs(this.vx);
    const ax = input.axisX();
    if (ax !== 0 && Math.sign(this.vx) === -ax && sp > 70) { this.setAnim('skid'); return; }
    if (sp > P.WALK + 12) { this.setAnim('run'); this.footsteps(0.17); return; }
    if (sp > 8) { this.setAnim('walk'); this.footsteps(0.26); return; }
    if (this.lookUp) { this.setAnim('look_up'); return; }
    if (this.lookDown) { this.setAnim('look_down'); return; }
    if (this.idleT > 12) { this.setAnim('sleep'); if (Math.random() < 0.01) this.level.particles.emit('sparkle', this.cx + 6, this.y, 1, { colors: ['#cfe8ff'] }); return; }
    this.setAnim('idle');
  }
  footsteps(interval) {
    this.footstepT -= 1 / 60;
    if (this.footstepT <= 0) {
      this.footstepT = interval;
      audio.sfx('step', { vol: 0.35, randomPitch: 0.15, cooldown: 0.05 });
      if (Math.random() < 0.5) this.level.particles.emit('dust', this.cx - this.facing * 4, this.bottom - 1, 1);
    }
  }
  get frame() { return animFrame('tico', this.anim, this.animT); }

  draw(ctx) {
    const x = this.cx, y = this.bottom;
    // dash / unravel afterimages
    for (const t of this.trail) {
      drawSprite(ctx, 'tico', t.anim, t.f, t.x, t.y, { flip: t.flip, alpha: (t.life / 0.18) * 0.5, variant: this.mods.trailColor || '#8ff0ff' });
    }
    // blink while invulnerable after taking damage
    const blinkHide = this.hurtInv > 0 && this.state !== 'dead' && this.flash <= 0 && Math.floor(this.t * 18) % 2 === 0;
    const f = this.frame;
    const opts = { flip: this.facing < 0 };
    if (this.flash > 0) opts.variant = 'flash';
    if (!blinkHide) {
      ab_drawBehind(ctx, this);
      drawSprite(ctx, 'tico', this.anim, f, x, y, opts);
      drawCosmetics(ctx, this, this.anim, f, x, y, this.facing < 0);
    }
    this.drawExtras(ctx);
  }
  drawExtras(ctx) {
    for (const ab of R.abilities.values()) ab.draw?.(ctx, this);
    if (this.chargeT > P.CHARGE_T) {
      const k = (Math.sin(this.t * 30) + 1) / 2;
      ctx.fillStyle = k > 0.5 ? '#ffffff' : '#8ff0ff';
      ctx.fillRect(Math.round(this.cx + this.facing * 9), Math.round(this.cy - 3), 2, 2);
    }
  }
}

function ab_drawBehind(ctx, p) {
  for (const ab of R.abilities.values()) ab.drawBehind?.(ctx, p);
}
