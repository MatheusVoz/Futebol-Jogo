// =============================================================================
// objects/core.js — Objetos essenciais (versão base do núcleo).
// exit, checkpoint, button, star, heart, energy, sign, secret_marker,
// player_needle, spring.
// (O agente de "Objetos de Fase" pode reescrever este arquivo por completo,
//  mantendo os mesmos nomes de tipo e comportamento.)
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { defineSprite, drawSprite, animFrame } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { TILE, rectsOverlap } from '../../engine/util.js';
import { registerEntity } from '../registry.js';
import font from '../../engine/font.js';

// ------------------------------------------------------------------ art
defineSprite('obj_button', {
  w: 10, h: 10, ox: 5, oy: 5,
  anims: { spin: { frames: 6, fps: 10 } },
  draw(pc, a, f) {
    const widths = [4, 3, 2, 1, 2, 3];
    const rx = widths[f];
    pc.ellipse(5, 5, rx + 0.5, 4.5, '#ffd23f');
    if (rx >= 2) { pc.px(5 - 1, 4, '#9a6a00'); pc.px(5 + 1, 4, '#9a6a00'); pc.px(5 - 1, 6, '#9a6a00'); pc.px(5 + 1, 6, '#9a6a00'); }
    pc.px(5 - Math.max(0, rx - 2), 2, '#fff6c0');
    pc.outline('#7a4a00');
  },
});
defineSprite('obj_star', {
  w: 16, h: 16, ox: 8, oy: 8,
  anims: { idle: { frames: 8, fps: 8 } },
  draw(pc, a, f) {
    const s = f % 4 === 0 ? 0 : 0;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 7 : 3;
      const an = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      pts.push([8 + Math.cos(an) * r, 8 + Math.sin(an) * r + s]);
    }
    pc.poly(pts, '#ffe27a');
    pc.poly(pts.map(([x, y]) => [x * 0.6 + 3.2, y * 0.6 + 3.2]), '#fff6c0');
    // stitches
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i / 5) * Math.PI * 2 + (f * Math.PI) / 16;
      pc.px(Math.round(8 + Math.cos(an) * 4), Math.round(8 + Math.sin(an) * 4), '#c86a00');
    }
    pc.outline('#7a3a00');
  },
});
defineSprite('obj_spool', {
  w: 16, h: 24, ox: 8, oy: 24,
  anims: { off: { frames: 1, fps: 1 }, on: { frames: 4, fps: 6 } },
  draw(pc, a, f) {
    pc.rect(3, 4, 10, 3, '#8a5a3a'); pc.rect(3, 19, 10, 3, '#8a5a3a');
    pc.rect(5, 7, 6, 12, a === 'on' ? '#ff6fa8' : '#6a5a7a');
    if (a === 'on') for (let y = 8; y < 19; y += 2) pc.hline(5, y + (f % 2), 6, '#ffb3d0');
    pc.rect(7, 0, 2, 4, '#5a3a2a');
    pc.outline('#2a1a20');
  },
});

// ------------------------------------------------------------------ pickups
class Pickup extends Entity {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.w = 10; this.h = 10;
    this.x = x + 3; this.y = y + 3;
    this.baseY = this.y;
    this.collected = false;
    this.magnet = false;
  }
  update(dt) {
    this.tickTimers(dt);
    this.y = this.baseY + Math.sin(this.t * 3 + this.x * 0.1) * 1.5;
    const p = this.player;
    if (p && !p.dead && rectsOverlap({ x: this.x - 2, y: this.y - 2, w: this.w + 4, h: this.h + 4 }, p)) this.pick(p);
  }
  pick(p) {}
}

registerEntity('button', class extends Pickup {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.isButton = true;
    if (l.run.collected.has(pr.pid)) this.dead = true;
  }
  update(dt) {
    super.update(dt);
    const p = this.player;
    const st = p.stats;
    const r = 26 + (st.magnet || 0);
    if (!this.dead && Math.abs(p.cx - this.cx) < r && Math.abs(p.cy - this.cy) < r) {
      this.x += (p.cx - this.cx) * Math.min(1, dt * 10);
      this.baseY += (p.cy - this.cy) * Math.min(1, dt * 10);
    }
  }
  pick() {
    this.remove();
    this.level.collect('button', 1, this.props.pid);
    audio.sfx('coin', { pitch: 1 + (this.level.run.buttons % 8) * 0.03 });
    this.level.particles.emit('sparkle', this.cx, this.cy, 4);
  }
  draw(ctx) { drawSprite(ctx, 'obj_button', 'spin', animFrame('obj_button', 'spin', this.t + this.x * 0.01), this.cx, this.cy); }
});

registerEntity('star', class extends Pickup {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 14; this.h = 14; this.x = x + 1; this.y = y + 1; this.baseY = this.y;
    this.light = { r: 28, color: '#ffe27a', i: 0.7 };
    this.already = save.isCollected(pr.pid);
  }
  pick() {
    this.remove();
    this.level.collect('star', 1, this.props.pid, { index: this.props.starIndex });
    audio.sfx('star');
    this.level.particles.emit('sparkle', this.cx, this.cy, 16);
    this.level.toast(`Estrela costurada ${this.level.run.starsFound.filter(Boolean).length}/3`, 'icon_star');
    this.level.hitstop(0.05);
  }
  draw(ctx) {
    drawSprite(ctx, 'obj_star', 'idle', animFrame('obj_star', 'idle', this.t), this.cx, this.cy, { alpha: this.already ? 0.45 : 1 });
  }
});

registerEntity('heart', class extends Pickup {
  pick(p) {
    if (p.hp >= p.maxHp) return;
    this.remove(); p.heal(1); audio.sfx('heal');
    this.level.particles.emit('heal', this.cx, this.cy, 8);
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#7a1030'; ctx.fillRect(x, y + 1, 10, 6); ctx.fillRect(x + 1, y + 7, 8, 1); ctx.fillRect(x + 2, y + 8, 6, 1); ctx.fillRect(x + 4, y + 9, 2, 1);
    ctx.fillStyle = '#ff4f7a'; ctx.fillRect(x + 1, y + 1, 3, 6); ctx.fillRect(x + 6, y + 1, 3, 6); ctx.fillRect(x + 2, y + 6, 6, 2); ctx.fillRect(x + 4, y + 3, 2, 4);
    ctx.fillStyle = '#ffc2d4'; ctx.fillRect(x + 2, y + 2, 1, 1);
  }
});

registerEntity('energy', class extends Pickup {
  pick(p) {
    this.remove(); p.gainEnergy(35); audio.sfx('energy');
    this.level.particles.emit('energy', this.cx, this.cy, 10);
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 1, y, 8, 2); ctx.fillRect(x + 1, y + 8, 8, 2);
    ctx.fillStyle = '#55d0ff'; ctx.fillRect(x + 2, y + 2, 6, 6);
    ctx.fillStyle = '#c8f6ff'; ctx.fillRect(x + 3, y + 3, 1, 4);
  }
});

// ------------------------------------------------------------------ checkpoint
registerEntity('checkpoint', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 16; this.h = 24; this.x = x; this.y = y + TILE - 24;
    this.active = l.run.checkpoint?.id === pr.pid;
    this.z = 5;
  }
  update(dt) {
    this.tickTimers(dt);
    if (!this.active && this.overlaps(this.player)) {
      this.active = true;
      for (const c of this.level.ofType('checkpoint')) if (c !== this) c.active = false;
      this.level.setCheckpoint(this.x + 2, this.y + this.h - 18, this.props.pid);
      audio.sfx('checkpoint');
      this.level.particles.emit('thread', this.cx, this.y + 8, 14);
      this.level.toast('Progresso costurado!');
    }
    if (this.active) this.light = { r: 34, color: '#ff8fc0', i: 0.6, flicker: 0.3 };
  }
  draw(ctx) {
    drawSprite(ctx, 'obj_spool', this.active ? 'on' : 'off', animFrame('obj_spool', 'on', this.t), this.cx, this.bottom);
  }
});

// ------------------------------------------------------------------ exit
registerEntity('exit', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 20; this.h = 32; this.x = x - 2; this.y = y + TILE - 32;
    this.light = { r: 50, color: '#c89bff', i: 0.9, flicker: 0.4 };
    this.z = 4;
  }
  update(dt) {
    this.tickTimers(dt);
    if (Math.random() < 0.3) this.level.particles.emit('portal', this.cx, this.cy, 1, { speed: [5, 25] });
    if (this.level.state === 'play' && this.overlaps(this.player) && this.player.state === 'normal') {
      audio.sfx('exit');
      this.level.particles.emit('portal', this.cx, this.cy, 30);
      this.level.complete();
    }
  }
  draw(ctx) {
    const cx = Math.round(this.cx), cy = Math.round(this.cy);
    const t = this.t;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = ['#ff4fd8', '#a855ff', '#ffffff'][i];
      ctx.beginPath();
      ctx.ellipse(cx, cy, 8 - i * 2 + Math.sin(t * 4 + i) * 1, 14 - i * 3 + Math.sin(t * 3 + i), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // stitches around the portal
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 10; i++) {
      const a = t * 1.5 + (i / 10) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 17), 1, 2);
    }
  }
});

// ------------------------------------------------------------------ sign
registerEntity('sign', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 14; this.h = 14; this.x = x + 1; this.y = y + 2;
    this.interactable = true; this.prompt = 'Ler'; this.z = 3;
  }
  interact() { this.level.say(this.props.dialog || [{ who: 'sign', text: this.props.text || '...' }]); }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + 6, y + 8, 2, 6);
    ctx.fillStyle = '#c89a5a'; ctx.fillRect(x, y, 14, 9);
    ctx.fillStyle = '#7a5a30'; ctx.fillRect(x, y + 8, 14, 1); ctx.fillRect(x + 2, y + 3, 10, 1); ctx.fillRect(x + 2, y + 5, 7, 1);
  }
});

// ------------------------------------------------------------------ secret
registerEntity('secret_marker', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.isSecret = true;
    this.w = 16; this.h = 16;
    this.found = l.run.secrets.has(pr.pid);
  }
  update() {
    if (!this.found && this.overlaps(this.player)) { this.found = true; this.level.foundSecret(this.props.pid); }
  }
});

// ------------------------------------------------------------------ spring
registerEntity('spring', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 14; this.h = 8; this.x = x + 1; this.y = y + 8; this.squish = 0; this.z = 6;
  }
  update(dt) {
    this.tickTimers(dt);
    this.squish = Math.max(0, this.squish - dt * 4);
    const p = this.player;
    if (p.vy >= 0 && this.overlaps(p) && p.bottom - this.y < 8) {
      p.vy = -(this.props.power || 520); p.jumping = false; p.airJumps = 0; p.canAirDash = true; p.grounded = false;
      this.squish = 1; audio.sfx('spring'); this.level.particles.emit('dust', this.cx, this.y, 6);
    }
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), s = Math.round(this.squish * 3);
    ctx.fillStyle = '#d03a6a'; ctx.fillRect(x, y + s, 14, 3);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 3, y + 3 + s, 8, 5 - s);
  }
});

// ------------------------------------------------------------------ needle projectile
registerEntity('player_needle', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 12; this.h = 4; this.x = x - 6; this.y = y - 2;
    this.vx = (pr.dir || 1) * 340; this.life = 0.7; this.z = 55; this.alwaysUpdate = true;
    this.light = { r: 18, color: '#8ff0ff', i: 0.6 };
  }
  update(dt) {
    this.life -= dt; this.x += this.vx * dt;
    if (this.life <= 0 || this.level.map.rectSolid(this.x, this.y, this.w, this.h)) { this.level.particles.emit('hit', this.cx, this.cy, 5); this.remove(); return; }
    for (const e of this.level.entities) {
      if (e.dead || !e.hittable || e === this) continue;
      if (this.overlaps(e)) {
        const res = e.onHit ? e.onHit(this.props.damage || 3, this, { kind: 'needle' }) : e.hurt(this.props.damage || 3, this, { knockback: 160 });
        if (res !== false) { this.level.particles.emit('hit', this.cx, this.cy, 8); audio.sfx('hit'); this.remove(); return; }
      }
    }
    if (Math.random() < 0.7) this.level.particles.emit('energy', this.cx - Math.sign(this.vx) * 6, this.cy, 1, { speed: [0, 10] });
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), d = Math.sign(this.vx);
    ctx.fillStyle = '#e8f6ff'; ctx.fillRect(x, y + 1, 12, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(d > 0 ? x + 10 : x, y + 1, 2, 1);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(d > 0 ? x : x + 9, y, 3, 4);
  }
});

// ------------------------------------------------------------------ loot button (dropped by enemies)
registerEntity('loot_button', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 8; this.h = 8; this.vx = pr.vx || 0; this.vy = pr.vy || -150; this.life = 8; this.z = 30;
    this.gravity = 700; this.maxFall = 300; this.alwaysUpdate = true;
  }
  update(dt) {
    this.tickTimers(dt);
    this.life -= dt;
    if (this.life <= 0) { this.remove(); return; }
    const p = this.player;
    if (this.t > 0.35 && Math.abs(p.cx - this.cx) < 30 + (p.stats.magnet || 0) && Math.abs(p.cy - this.cy) < 30) {
      this.vx += (p.cx - this.cx) * dt * 30; this.vy += (p.cy - this.cy) * dt * 30;
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else {
      this.physics(dt);
      if (this.grounded) { this.vx *= 0.8; if (Math.abs(this.vy) < 1) this.vy = 0; }
    }
    if (this.t > 0.25 && this.overlaps(p)) {
      this.remove();
      this.level.collect('button', 1);
      audio.sfx('coin', { pitch: 1.1 });
    }
  }
  draw(ctx) {
    if (this.life < 2 && Math.floor(this.t * 10) % 2) return;
    drawSprite(ctx, 'obj_button', 'spin', animFrame('obj_button', 'spin', this.t), this.cx, this.cy);
  }
});
