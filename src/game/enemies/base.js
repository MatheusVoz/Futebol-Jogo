// =============================================================================
// enemies/base.js — Classe base dos inimigos. Todos os inimigos dos 5 mundos
// estendem Enemy e implementam think(dt) (IA) e draw(ctx).
//
// Recursos prontos:
//   - dano/flash/knockback, morte com animação de "descosturar" + drops
//   - this.boundT  (preso pela Costura Dimensional: congelado e enrolado em fios)
//   - this.stunT   (atordoado)
//   - this.armored (+ unstitch() remove a armadura — Descosturar a Realidade)
//   - this.target() -> o Retalho Fantasma (level.decoy) se existir e estiver
//     mais perto/no alcance, senão o jogador.
//   - helpers: patrol(), canSee(), faceTarget(), moveToward()
// Sobrescreva: think(dt), draw(ctx), onDeath() (opcional), onStomp(p) (opcional)
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { audio } from '../../engine/audio.js';
import { rand, chance, TILE } from '../../engine/util.js';

export class Enemy extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.enemy = true;
    this.hittable = true;
    this.stompable = true;
    this.bindable = true;
    this.hp = this.maxHp = 2;
    this.contactDamage = 1;
    this.boundT = 0;
    this.stunT = 0;
    this.dying = false;
    this.deathT = 0;
    this.armored = false;
    this.drops = { buttons: 2, heart: 0.08, energy: 0.2 };
    this.z = 20;
    this.anim = 'idle';
    this.animT = 0;
    this.facing = props.facing ?? -1;
    this.homeX = x; this.homeY = y;
  }
  setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }

  /** Preferred target: decoy (Retalho Fantasma) or player. */
  target(range = 200) {
    const d = this.level.decoy;
    const p = this.level.player;
    if (d && !d.dead) {
      const dd = Math.hypot(d.cx - this.cx, d.cy - this.cy);
      const pd = Math.hypot(p.cx - this.cx, p.cy - this.cy);
      if (dd < range && (dd < pd * 1.5 || d.taunting)) return d;
    }
    return p;
  }
  canSee(t, range = 160, needLos = true) {
    if (!t || t.dead) return false;
    if (t.hidden) return false; // hiding spots (World 4)
    const d = Math.hypot(t.cx - this.cx, t.cy - this.cy);
    if (d > range) return false;
    return !needLos || this.level.map.los(this.cx, this.cy - 2, t.cx, t.cy - 2);
  }
  faceTarget(t = this.target()) { if (t) this.facing = t.cx < this.cx ? -1 : 1; }
  /** Walk back and forth, turning at walls and ledges. */
  patrol(speed, dt, { ledges = true } = {}) {
    if (this.grounded && (this.wallAhead() || (ledges && !this.groundAhead()))) this.facing *= -1;
    this.vx = this.facing * speed;
  }
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.cx, dy = ty - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    this.vx = (dx / d) * speed; this.vy = (dy / d) * speed;
  }

  bind(seconds = 3) {
    if (!this.bindable || this.dying) return false;
    this.boundT = Math.max(this.boundT, seconds);
    this.vx = 0;
    audio.sfx('bind');
    return true;
  }
  stun(seconds = 1) { this.stunT = Math.max(this.stunT, seconds); }
  /** Descosturar: remove armor. Return true if something happened. */
  unstitch(player) {
    if (!this.armored) return false;
    this.armored = false;
    this.level.particles.emit('thread', this.cx, this.cy, 14);
    this.level.particles.emit('fabric', this.cx, this.cy, 8);
    audio.sfx('unstitch_hit');
    this.stun(0.8);
    return true;
  }

  onHit(dmg, src, info) {
    if (this.dying) return false;
    if (this.armored) {
      this.flash = 0.06;
      audio.sfx('armor_clink');
      this.level.particles.emit('hit', this.cx, this.cy, 3, { colors: ['#c0c8d8'] });
      if (src?.isPlayer) src.vx = -src.facing * 90;
      return false;
    }
    return this.hurt(dmg, src, { knockback: info?.kind === 'side3' ? 180 : 110 });
  }
  onStomp(p) {
    if (this.armored && !this.stompArmored) { p.vy = -260; audio.sfx('armor_clink'); return; }
    this.hurt(1 * (p.stats?.power || 1), p, { knockback: 0, noLift: true });
  }

  die(src) {
    if (this.dying) return;
    this.dying = true;
    this.deathT = 0;
    this.enemy = false;
    this.hittable = false;
    this.stompable = false;
    this.vx = (Math.sign(this.cx - (src?.cx ?? this.cx)) || 1) * 60;
    this.vy = -120;
    audio.sfx(this.deathSfx || 'enemy_die', { randomPitch: 0.1 });
    this.level.particles.emit('fluff', this.cx, this.cy, 10);
    this.level.particles.emit('fabric', this.cx, this.cy, 6, { colors: this.fabricColors || ['#c8a8d8', '#a888b8', '#ffffff'] });
    this.level.shake(0.1);
    this.onDeath?.();
    this.dropLoot();
  }
  dropLoot() {
    const d = this.drops || {};
    const n = d.buttons || 0;
    for (let i = 0; i < n; i++) {
      const b = this.level.spawn('loot_button', this.cx - 5, this.cy - 5, { vx: rand(-70, 70), vy: rand(-180, -100) });
    }
    if (chance(d.heart || 0)) this.level.spawn('heart', this.cx - 8, this.cy - 8, {});
    else if (chance(d.energy || 0)) this.level.spawn('energy', this.cx - 8, this.cy - 8, {});
  }

  update(dt) {
    this.tickTimers(dt);
    this.animT += dt;
    if (this.dying) {
      this.deathT += dt;
      this.vy += 600 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.deathT > 0.45) { this.level.particles.emit('smoke', this.cx, this.cy, 4); this.remove(); }
      return;
    }
    if (this.boundT > 0) {
      this.boundT -= dt;
      this.vx = 0;
      if (!this.flying) this.physics(dt);
      if (this.boundT <= 0) this.level.particles.emit('thread', this.cx, this.cy, 6);
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.vx *= 0.9; if (!this.flying) this.physics(dt); return; }
    this.think(dt);
  }
  think(dt) {}

  /** Draw thread wraps when bound — call at the end of draw(). */
  drawStatus(ctx) {
    if (this.boundT > 0) {
      ctx.fillStyle = '#ffe27a';
      const n = 3;
      for (let i = 0; i < n; i++) {
        const yy = Math.round(this.y + ((i + 1) * this.h) / (n + 1) + Math.sin(this.t * 6 + i) * 1);
        ctx.fillRect(Math.round(this.x - 1), yy, this.w + 2, 1);
      }
      if (Math.floor(this.t * 8) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(this.x + this.w / 2), Math.round(this.y - 3), 1, 1); }
    }
    if (this.stunT > 0 && !this.dying) {
      ctx.fillStyle = '#fff6a8';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 6 + (i * Math.PI * 2) / 3;
        ctx.fillRect(Math.round(this.cx + Math.cos(a) * 6), Math.round(this.y - 4 + Math.sin(a) * 2), 1, 1);
      }
    }
  }
  /** Common draw options for drawSprite (flash, death fade). */
  spriteOpts() {
    return {
      flip: this.facing > 0 ? !this.spriteFacesRight : !!this.spriteFacesRight,
      variant: this.flash > 0 ? 'flash' : undefined,
      alpha: this.dying ? Math.max(0, 1 - this.deathT / 0.45) : 1,
      rotation: this.dying ? this.deathT * 8 * Math.sign(this.vx || 1) : 0,
    };
  }
}

/** Projectile base for enemies. reflectable -> Remendo Temporal can reverse it. */
export class EnemyProjectile extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = props.w || 6; this.h = props.h || 6;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = props.vx || 0; this.vy = props.vy || 0;
    this.gravityOn = !!props.gravity;
    this.life = props.life ?? 3;
    this.enemy = true; this.contactDamage = props.damage ?? 1;
    this.reflectable = props.reflectable ?? true;
    this.reflected = false;
    this.z = 40; this.alwaysUpdate = true;
    this.color = props.color || '#ff5a7a';
    this.solidStop = props.solidStop ?? true;
  }
  /** Turn into a player-owned projectile (Remendo Temporal / parry). */
  reflect() {
    if (!this.reflectable || this.reflected) return false;
    this.reflected = true; this.enemy = false;
    this.vx = -this.vx; this.vy = -this.vy; this.life = 2;
    this.color = '#8ff0ff';
    return true;
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    if (this.gravityOn) this.vy += 500 * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.life <= 0 || (this.solidStop && this.level.map.rectSolid(this.x + 1, this.y + 1, this.w - 2, this.h - 2))) { this.pop(); return; }
    if (this.reflected) {
      for (const e of this.level.entities) {
        if (e.dead || !e.hittable || e === this || e.isPlayer) continue;
        if (this.overlaps(e)) { (e.onHit ? e.onHit(2, this, { kind: 'reflect' }) : e.hurt(2, this)); this.pop(); return; }
      }
    }
  }
  onTouchPlayer() { this.pop(); }
  pop() { this.level.particles.emit('hit', this.cx, this.cy, 4, { colors: [this.color, '#ffffff'] }); this.remove(); }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = this.color;
    ctx.fillRect(x + 1, y, this.w - 2, this.h); ctx.fillRect(x, y + 1, this.w, this.h - 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 2, 2);
  }
}
