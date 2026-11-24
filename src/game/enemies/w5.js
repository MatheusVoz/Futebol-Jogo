// =============================================================================
// enemies/w5.js — Inimigos do MUNDO 5 (O Coração da Dimensão).
// Paleta: carmesim / roxo / dourado, contorno escuro. Todos usam poderes
// dimensionais, com telégrafos claros (piscar + linhas tracejadas).
//
// Legenda (registerLegend(5)):
//   a w5_riftweaver  — tecelã encapuzada: abre um portal e se TELEPORTA para perto do
//                      alvo; marca dois ilhós dourados (linha tracejada, ~0.7 s) e
//                      estica entre eles um FIO-ARMADILHA baixo (pule!) que fere por ~2 s.
//                      3 hp.
//   b w5_sentinel    — fuso flutuante: vê o alvo, trava a mira (linha fina piscando
//                      ~0.75 s) e dispara um RAIO de fio na direção travada até a parede.
//                      2 hp.
//   d w5_patchgolem  — golem de retalhos com placas costuradas: armored=true (golpes
//                      ricocheteiam, NÃO é pisável) até Descosturar. Anda devagar; perto,
//                      ergue os braços (~0.65 s) e bate no chão soltando ONDAS de choque
//                      rasteiras para os dois lados (pule). 5 hp.
//   f w5_echo        — cópia sombria do Tico: espelha os DASHES do jogador (dash na
//                      direção oposta, com atraso curto) e deixa CÓPIAS que pulsam e
//                      estouram em duas agulhas lentas (refletíveis). 3 hp.
//   g w5_needlebat   — morcego de asas de agulha: paira, sacode as asas (~0.5 s) e
//                      MERGULHA num arco passando pelo alvo, depois sobe. 1 hp.
// Fase de teste: ?level=test_enemies_w5
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { Enemy, EnemyProjectile } from './base.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { defineSprite, drawSprite, animFrame } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { clamp, rand, TILE } from '../../engine/util.js';

// ----------------------------------------------------------------- paleta
const OUT = '#14060f';
const CR = ['#ff8aa0', '#e0405e', '#a81e3e', '#6a0e2a']; // carmesim
const PU = ['#c08ae0', '#8a4ab8', '#5a2a88', '#341650']; // roxo
const GO = ['#fff2a8', '#ffd23f', '#d09a20', '#8a5a10']; // dourado
const FAB = [CR[1], PU[1], GO[1]];

registerSfx('w5e_portal', [{ wave: 'sine', freq: 300, freqEnd: 1200, dur: 0.25, vol: 0.14 }, { wave: 'noise', freq: 2000, freqEnd: 600, dur: 0.2, vol: 0.06 }]);
registerSfx('w5e_charge', { wave: 'saw', freq: 200, freqEnd: 900, dur: 0.6, vol: 0.07, filter: { type: 'lowpass', freq: 1600 } });
registerSfx('w5e_beam', [{ wave: 'square', freq: 880, freqEnd: 440, dur: 0.3, vol: 0.1 }, { wave: 'noise', freq: 3000, freqEnd: 1000, dur: 0.3, vol: 0.06 }]);
registerSfx('w5e_slam', [{ wave: 'noise', freq: 400, freqEnd: 60, dur: 0.4, vol: 0.28, filter: { type: 'lowpass', freq: 600 } }, { wave: 'triangle', freq: 110, freqEnd: 40, dur: 0.35, vol: 0.3 }]);
registerSfx('w5e_twang', { wave: 'triangle', freq: 660, freqEnd: 620, dur: 0.25, vol: 0.12, vibrato: { rate: 30, depth: 0.6 } });
registerSfx('w5e_screech', { wave: 'square', duty: 0.2, freq: 1800, freqEnd: 900, dur: 0.18, vol: 0.06 });

// ----------------------------------------------------------------- utilidades
/** O segmento (x0,y0)-(x1,y1) toca o retângulo r? (amostragem a cada 3 px) */
function segHits(x0, y0, x1, y1, r, pad = 1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 3));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) return true;
  }
  return false;
}
/** Linha tracejada/animada em pixels inteiros. */
function dashLine(ctx, x0, y0, x1, y1, color, t, on = 3, off = 3, w = 1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d);
  ctx.fillStyle = color;
  const sh = Math.floor(t * 30);
  for (let i = 0; i <= n; i++) {
    if (((i + sh) % (on + off)) >= on) continue;
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w);
  }
}
function hurtPlayer(level, src, dmg = 1) { const p = level.player; if (p && p.state !== 'dead') p.hurt(dmg, src); }

/** Base com máquina de estados e desenho por sprite (pivô = base, centro). */
class DimEnemy extends Enemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.spriteFacesRight = true;
    this.state = 'idle'; this.stT = 0; this.cool = 0; this.hurtT = 0;
    this.fabricColors = FAB;
  }
  go(s) { this.state = s; this.stT = 0; }
  onHurt() { this.hurtT = 0.2; }
  update(dt) { if (this.cool > 0) this.cool -= dt; if (this.hurtT > 0) this.hurtT -= dt; super.update(dt); }
  blink() { return Math.floor(this.stT * 16) % 3 === 0; }
  drawBody(ctx, anim, { tele = false, cy = false, dx = 0, dy = 0 } = {}) {
    const o = this.spriteOpts();
    if (tele && !this.flash && this.blink()) o.variant = GO[0];
    const f = animFrame(this.sprite, anim, this.animT);
    drawSprite(ctx, this.sprite, anim, f, Math.round(this.cx + dx), Math.round((cy ? this.cy : this.bottom) + dy), o);
  }
}

// =============================================================================
// a) w5_riftweaver
// =============================================================================
defineSprite('w5_riftweaver', {
  w: 24, h: 28, ox: 12, oy: 27,
  anims: { idle: { frames: 4, fps: 5 }, cast: { frames: 2, fps: 8 }, warp: { frames: 3, fps: 12, loop: false } },
  draw(pc, anim, f) {
    const bob = anim === 'idle' ? [0, -1, -1, 0][f] : 0;
    const shrink = anim === 'warp' ? f * 3 : 0;
    // manto em sino com barra rasgada
    pc.poly([[12, 4 + bob + shrink], [20 - shrink, 25], [4 + shrink, 25]], CR[2]);
    pc.poly([[12, 5 + bob + shrink], [11, 25], [5 + shrink, 25]], CR[1]);
    for (let x = 5 + shrink; x < 20 - shrink; x += 3) pc.px(x, 26, CR[3]);
    if (anim === 'warp' && f === 2) return pc.outline(OUT);
    // capuz e rosto escuro com olhos dourados
    pc.circle(12, 8 + bob, 5, PU[2]); pc.circle(11, 7 + bob, 3, PU[1]);
    pc.rect(10, 8 + bob, 5, 3, '#0a0410'); pc.px(11, 9 + bob, GO[1]); pc.px(13, 9 + bob, GO[1]);
    // faixa dourada e carretel
    pc.hline(7, 16, 10, GO[2]); pc.hline(8, 15, 8, GO[1]);
    const ax = anim === 'cast' ? 20 : 17, ay = anim === 'cast' ? 10 - f * 2 : 16;
    pc.line(14, 14, ax, ay, PU[1]);
    pc.rect(ax - 1, ay - 2, 3, 4, GO[1]); pc.px(ax - 1, ay - 2, GO[0]);
    if (anim === 'cast') { pc.px(ax + 1, ay - 4, GO[0]); pc.px(ax + 2, ay - 3, GO[0]); }
    pc.outline(OUT);
  },
});
class ThreadTrap extends Entity {
  constructor(level, x0, y0, x1, y1) {
    super(level, x0, y0, {});
    Object.assign(this, { x0, y0, x1, y1 });
    this.x = Math.min(x0, x1) - 4; this.y = Math.min(y0, y1) - 4; this.w = Math.abs(x1 - x0) + 8; this.h = Math.abs(y1 - y0) + 8;
    this.z = 30; this.alwaysUpdate = true; this.life = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.t > 0.7 && this.t < 2.9) {
      if (!this.live) { this.live = true; audio.sfx('w5e_twang'); this.level.particles.emit('stitch_spark', (this.x0 + this.x1) / 2, (this.y0 + this.y1) / 2, 6); }
      if (segHits(this.x0, this.y0, this.x1, this.y1, this.level.player)) hurtPlayer(this.level, this);
    }
    if (this.t >= 2.9) { this.level.particles.emit('thread', (this.x0 + this.x1) / 2, (this.y0 + this.y1) / 2, 5); this.remove(); }
  }
  draw(ctx) {
    const t = this.t;
    for (const [x, y] of [[this.x0, this.y0], [this.x1, this.y1]]) { // ilhós
      ctx.fillStyle = OUT; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
      ctx.fillStyle = (t < 0.7 && Math.floor(t * 12) % 2) ? GO[0] : GO[1]; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      ctx.fillStyle = OUT; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    if (t < 0.7) dashLine(ctx, this.x0, this.y0, this.x1, this.y1, GO[1], t, 2, 3);
    else {
      const fade = t > 2.5 ? (2.9 - t) / 0.4 : 1;
      ctx.globalAlpha = fade;
      const wob = Math.sin(t * 40) * (t < 0.9 ? 1.5 : 0.4);
      dashLine(ctx, this.x0, this.y0 + 1, this.x1, this.y1 + 1, CR[3], 0, 1, 0);
      dashLine(ctx, this.x0, this.y0 + wob, this.x1, this.y1 + wob, CR[1], 0, 1, 0);
      dashLine(ctx, this.x0, this.y0 + wob, this.x1, this.y1 + wob, CR[0], t, 2, 5);
      ctx.globalAlpha = 1;
    }
  }
  drawLight(L) { if (this.t > 0.7) L.add((this.x0 + this.x1) / 2, (this.y0 + this.y1) / 2, 30, CR[1], 0.5, 0.2); }
}
class RiftWeaver extends DimEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w5_riftweaver';
    this.w = 12; this.h = 20; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 3, heart: 0.1, energy: 0.3 };
    this.cool = 1;
  }
  /** Procura chão livre perto de (x) na altura do alvo. */
  findSpot(t) {
    const map = this.level.map;
    for (const off of [rand(56, 80) * (Math.random() < 0.5 ? -1 : 1), 64, -64, 40, -40]) {
      const x = clamp(t.cx + off, 16, map.width - 16);
      for (let dy = -32; dy <= 48; dy += 4) {
        const fy = t.bottom + dy;
        if (!map.solidAt(x, fy - 2) && !map.solidAt(x, fy - 18) && map.solidAt(x, fy + 1) && !map.rectSolid(x - 6, fy - 20, 12, 19)) return [x, Math.floor((fy + 1) / TILE) * TILE];
      }
    }
    return null;
  }
  think(dt) {
    this.stT += dt;
    this.physics(dt);
    this.vx *= 0.8;
    const t = this.target();
    const sees = this.canSee(t, 180, false);
    switch (this.state) {
      case 'idle':
        this.anim = 'idle'; this.faceTarget(t);
        if (sees && this.cool <= 0) {
          const far = Math.abs(t.cx - this.cx) > 90 || Math.abs(t.bottom - this.bottom) > 24;
          if (far && this.findSpot(t)) { this.go('warpOut'); audio.sfx('w5e_portal'); this.level.particles.emit('portal', this.cx, this.cy, 10); }
          else { this.go('cast'); audio.sfx('w5e_charge'); }
        }
        break;
      case 'warpOut':
        this.setAnim('warp'); this.hittable = false; this.enemy = false;
        if (this.stT > 0.3) {
          const s = this.findSpot(t);
          if (s) { this.x = s[0] - this.w / 2; this.y = s[1] - this.h; this.vy = 0; }
          this.go('warpIn'); audio.sfx('w5e_portal'); this.level.particles.emit('portal', this.cx, this.cy, 12);
        }
        break;
      case 'warpIn':
        this.anim = 'idle'; this.faceTarget(t);
        if (this.stT > 0.35) { this.hittable = true; this.enemy = true; this.go('cast'); audio.sfx('w5e_charge'); }
        break;
      case 'cast':
        this.setAnim('cast'); this.faceTarget(t);
        if (this.stT > 0.45) {
          // fio baixo na altura dos pés do alvo (pulável), ancorado entre dois ilhós
          const fy = t.bottom - 6, cx = t.cx;
          this.level.add(new ThreadTrap(this.level, cx - 40, fy, cx + 40, fy));
          this.go('idle'); this.cool = 3.2;
        }
        break;
    }
  }
  draw(ctx) {
    const warp = this.state === 'warpOut' || this.state === 'warpIn';
    if (warp) { // portal: anel roxo/dourado girando
      const k = this.state === 'warpOut' ? this.stT / 0.3 : 1 - this.stT / 0.35;
      const r = 4 + 9 * Math.sin(Math.PI * clamp(k, 0, 1));
      for (let i = 0; i < 14; i++) {
        const a = this.t * 6 + (i / 14) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? PU[0] : GO[1];
        ctx.fillRect(Math.round(this.cx + Math.cos(a) * r * 0.7), Math.round(this.cy + Math.sin(a) * r), 2, 2);
      }
      ctx.globalAlpha = clamp(1 - k, 0, 1);
    }
    this.drawBody(ctx, this.anim, { tele: this.state === 'cast' });
    ctx.globalAlpha = 1;
    this.drawStatus(ctx);
  }
  drawLight(L) { if (!this.dying) L.add(this.cx, this.y + 4, 16, GO[1], 0.4); }
}
registerEntity('w5_riftweaver', RiftWeaver);

// =============================================================================
// b) w5_sentinel
// =============================================================================
defineSprite('w5_sentinel', {
  w: 22, h: 26, ox: 11, oy: 13,
  anims: { idle: { frames: 4, fps: 8 }, charge: { frames: 2, fps: 14 }, fire: { frames: 1, fps: 1 } },
  draw(pc, anim, f) {
    // fuso: corpo afunilado de madeira escura com fio carmesim enrolado
    pc.poly([[11, 1], [16, 8], [16, 18], [11, 25], [6, 18], [6, 8]], PU[3]);
    pc.rect(7, 8, 9, 11, CR[2]);
    for (let y = 9; y < 19; y += 2) pc.hline(7, y, 9, (y + f) % 4 < 2 ? CR[1] : CR[2]);
    pc.vline(7, 8, 11, CR[0]);
    // anéis dourados e olho central
    pc.hline(6, 8, 11, GO[2]); pc.hline(6, 18, 11, GO[2]); pc.hline(7, 7, 9, GO[1]);
    const eye = anim === 'idle' ? GO[1] : anim === 'charge' ? (f ? GO[0] : CR[0]) : '#ffffff';
    pc.circle(11, 13, 3, OUT); pc.circle(11, 13, 2, eye); pc.px(11, 13, anim === 'fire' ? GO[0] : OUT);
    // agulhas orbitando
    const a = (f / 4) * Math.PI * 2;
    for (const s of [0, Math.PI]) { const x = Math.round(11 + Math.cos(a + s) * 9), y = Math.round(13 + Math.sin(a + s) * 3); pc.px(x, y, GO[0]); pc.px(x, y + 1, GO[2]); }
    pc.outline(OUT);
  },
});
class Sentinel extends DimEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w5_sentinel';
    this.w = 12; this.h = 18; this.x = x + 2; this.y = y - 1;
    this.homeX = this.x; this.homeY = this.y;
    this.flying = true; this.hp = this.maxHp = 2;
    this.drops = { buttons: 2, heart: 0.05, energy: 0.3 };
    this.cool = 0.8; this.aim = [0, 0]; this.end = [0, 0];
  }
  beamEnd(ax, ay) {
    const d = Math.hypot(ax, ay) || 1, dx = ax / d, dy = ay / d;
    const hit = this.level.map.raycast(this.cx, this.cy, dx, dy, 220);
    return hit && hit.hit ? [hit.x, hit.y] : [this.cx + dx * 220, this.cy + dy * 220];
  }
  think(dt) {
    this.stT += dt;
    const t = this.target();
    this.y = this.homeY + Math.sin(this.t * 2) * 3;
    this.x += ((this.homeX + Math.sin(this.t * 0.6) * 10) - this.x) * Math.min(1, dt * 2);
    switch (this.state) {
      case 'idle':
        this.anim = 'idle'; this.faceTarget(t);
        if (this.cool <= 0 && this.canSee(t, 150)) { this.go('charge'); audio.sfx('w5e_charge'); }
        break;
      case 'charge': // mira travada nos últimos 0.25 s
        this.anim = 'charge';
        if (this.stT < 0.5) this.aim = [t.cx - this.cx, t.cy - this.cy];
        this.end = this.beamEnd(this.aim[0], this.aim[1]);
        if (this.stT > 0.75) { this.go('fire'); audio.sfx('w5e_beam'); this.level.shake(0.08); }
        break;
      case 'fire':
        this.anim = 'fire';
        this.end = this.beamEnd(this.aim[0], this.aim[1]);
        if (segHits(this.cx, this.cy, this.end[0], this.end[1], this.level.player, 2)) hurtPlayer(this.level, this);
        if (Math.random() < 0.5) this.level.particles.emit('stitch_spark', this.end[0], this.end[1], 1);
        if (this.stT > 0.35) { this.go('idle'); this.cool = 1.9; }
        break;
    }
  }
  draw(ctx) {
    if (this.state === 'charge' && !this.dying && this.boundT <= 0) {
      if (Math.floor(this.stT * 14) % 2 || this.stT > 0.5) dashLine(ctx, this.cx, this.cy, this.end[0], this.end[1], this.stT > 0.5 ? CR[0] : CR[1], this.t, 2, 2);
    }
    if (this.state === 'fire' && !this.dying) {
      const [ex, ey] = this.end;
      dashLine(ctx, this.cx, this.cy + 1, ex, ey + 1, CR[2], 0, 1, 0, 3);
      dashLine(ctx, this.cx - 1, this.cy - 1, ex - 1, ey - 1, CR[0], 0, 1, 0, 3);
      dashLine(ctx, this.cx, this.cy, ex, ey, '#fff0f4', this.t, 4, 2, 1);
      ctx.fillStyle = GO[0]; ctx.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 4, 4);
    }
    this.drawBody(ctx, this.anim, { cy: true, tele: this.state === 'charge' && this.stT > 0.5 });
    this.drawStatus(ctx);
  }
  drawLight(L) {
    if (this.dying) return;
    L.add(this.cx, this.cy, 18, CR[1], 0.45);
    if (this.state === 'fire') L.add((this.cx + this.end[0]) / 2, (this.cy + this.end[1]) / 2, 50, CR[0], 0.6, 0.3);
  }
}
registerEntity('w5_sentinel', Sentinel);

// =============================================================================
// d) w5_patchgolem
// =============================================================================
function golemDraw(pc, anim, f, armored) {
  {
    const step = anim === 'walk' ? [0, 1, 0, -1][f] : 0;
    const up = anim === 'windup', down = anim === 'slam';
    // pernas
    pc.rect(11, 30 + Math.max(0, step), 7, 9 - Math.max(0, step), PU[2]); pc.rect(22, 30 + Math.max(0, -step), 7, 9 - Math.max(0, -step), PU[2]);
    pc.hline(11, 38, 7, PU[3]); pc.hline(22, 38, 7, PU[3]);
    // tronco de retalhos
    const by = down ? 15 : 12;
    pc.rect(7, by, 26, 19, CR[2]);
    pc.rect(7, by, 13, 9, PU[1]); pc.rect(20, by + 9, 13, 10, PU[2]); pc.rect(20, by, 13, 9, CR[1]);
    for (let x = 8; x < 33; x += 2) pc.px(x, by + 9, GO[1]);
    for (let y = by + 1; y < by + 19; y += 2) pc.px(20, y, GO[1]);
    // cabeça pequena com um botão-olho
    pc.rect(15, by - 8, 10, 8, CR[2]); pc.hline(15, by - 8, 10, CR[1]);
    pc.circle(19, by - 4, 2, GO[1]); pc.px(19, by - 4, OUT); pc.hline(22, by - 3, 2, OUT);
    // braços
    if (up) { pc.rect(1, by - 12, 6, 16, PU[2]); pc.rect(33, by - 12, 6, 16, PU[2]); pc.rect(0, by - 17, 8, 6, CR[1]); pc.rect(32, by - 17, 8, 6, CR[1]); }
    else if (down) { pc.rect(0, 30, 8, 9, CR[1]); pc.rect(32, 30, 8, 9, CR[1]); pc.rect(2, by + 2, 5, 14, PU[2]); pc.rect(33, by + 2, 5, 14, PU[2]); }
    else { pc.rect(2, by + 1, 5, 16 + step, PU[2]); pc.rect(33, by + 1, 5, 16 - step, PU[2]); pc.rect(1, by + 15 + step, 7, 6, CR[1]); pc.rect(32, by + 15 - step, 7, 6, CR[1]); }
    if (armored) { // placas de metal costuradas com rebites dourados
      pc.rect(9, by + 2, 22, 13, '#7a7a96'); pc.hline(9, by + 2, 22, '#c8c8e0'); pc.vline(9, by + 2, 13, '#a8a8c4'); pc.hline(9, by + 14, 22, '#4a4a64');
      for (const [x, y] of [[11, by + 4], [28, by + 4], [11, by + 12], [28, by + 12]]) pc.px(x, y, GO[0]);
      pc.rect(14, by - 9, 12, 4, '#8a8aa6'); pc.hline(14, by - 9, 12, '#c8c8e0');
      for (let x = 10; x < 30; x += 3) pc.px(x, by + 8, '#4a4a64');
    } else { // enchimento exposto
      pc.ellipse(20, by + 8, 7, 4, '#f0e4e8'); pc.px(18, by + 7, '#ffffff'); pc.px(23, by + 9, '#c8b8c0');
    }
    pc.outline(OUT);
  }
}
const GOLEM_ANIMS = { walk: { frames: 4, fps: 5 }, windup: { frames: 2, fps: 10 }, slam: { frames: 1, fps: 1 } };
defineSprite('w5_patchgolem', { w: 40, h: 40, ox: 20, oy: 39, anims: GOLEM_ANIMS, draw: (pc, a, f) => golemDraw(pc, a, f, true) });
defineSprite('w5_patchgolem_bare', { w: 40, h: 40, ox: 20, oy: 39, anims: GOLEM_ANIMS, draw: (pc, a, f) => golemDraw(pc, a, f, false) });

class Shockwave extends Entity {
  constructor(level, x, y, dir) {
    super(level, x, y, {});
    this.w = 8; this.h = 9; this.x = x - 4; this.y = y - 9;
    this.vx = dir * 150; this.enemy = true; this.contactDamage = 1; this.z = 35; this.alwaysUpdate = true; this.life = 0.9;
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    this.x += this.vx * dt;
    const map = this.level.map;
    const ahead = this.vx > 0 ? this.right + 1 : this.x - 1;
    if (this.life <= 0 || map.solidAt(ahead, this.y + 4) || !map.solidAt(this.cx, this.bottom + 2)) { this.level.particles.emit('dust', this.cx, this.bottom, 3); this.remove(); return; }
    if (Math.random() < 0.5) this.level.particles.emit('dust', this.cx, this.bottom, 1);
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), k = Math.floor(this.t * 20) % 2;
    ctx.fillStyle = OUT; ctx.fillRect(x, y + 3, 8, 6); ctx.fillRect(x + 2, y, 4, 4);
    ctx.fillStyle = CR[1]; ctx.fillRect(x + 1, y + 4, 6, 5); ctx.fillStyle = k ? GO[0] : CR[0]; ctx.fillRect(x + 3, y + 1, 2, 4);
  }
  drawLight(L) { L.add(this.cx, this.cy, 14, CR[1], 0.5); }
}
class PatchGolem extends DimEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w5_patchgolem';
    this.w = 24; this.h = 30; this.alignToCell(x, y);
    this.hp = this.maxHp = 5; this.armored = true; this.stompable = false; this.bindable = true;
    this.drops = { buttons: 6, heart: 0.35, energy: 0.4 };
    this.go('walk');
  }
  unstitch(p) { const r = super.unstitch(p); if (r) { this.stompable = true; this.level.particles.emit('stitch_spark', this.cx, this.cy, 8); } return r; }
  think(dt) {
    this.stT += dt;
    const t = this.target();
    switch (this.state) {
      case 'walk':
        this.anim = 'walk';
        if (this.canSee(t, 170, false)) { this.faceTarget(t); this.vx = this.facing * 26; if (this.wallAhead() || !this.groundAhead()) this.vx = 0; }
        else this.patrol(18, dt);
        if (this.cool <= 0 && Math.abs(t.cx - this.cx) < 52 && Math.abs(t.bottom - this.bottom) < 30) { this.go('windup'); this.vx = 0; }
        break;
      case 'windup':
        this.anim = 'windup'; this.vx = 0;
        if (this.stT > 0.65) {
          this.go('slam'); audio.sfx('w5e_slam'); this.level.shake(0.35);
          this.level.particles.emit('impact_ring', this.cx, this.bottom, 1);
          for (const d of [-1, 1]) this.level.add(new Shockwave(this.level, this.cx + d * 14, this.bottom, d));
        }
        break;
      case 'slam':
        this.anim = 'slam'; this.vx = 0;
        if (this.stT > 0.55) { this.go('walk'); this.cool = 1.6; }
        break;
    }
    this.physics(dt);
  }
  draw(ctx) {
    this.sprite = this.armored ? 'w5_patchgolem' : 'w5_patchgolem_bare';
    this.drawBody(ctx, this.anim, { tele: this.state === 'windup', dx: this.state === 'windup' ? (Math.floor(this.stT * 30) % 2 ? 1 : -1) : 0 });
    this.drawStatus(ctx);
  }
  drawLight(L) { if (!this.dying) L.add(this.cx - 1, this.y + 4, 12, GO[1], 0.35); }
}
registerEntity('w5_patchgolem', PatchGolem);

// =============================================================================
// f) w5_echo — cópia sombria do Tico (usa o sprite 'tico' em silhueta)
// =============================================================================
class EchoDecoy extends Entity {
  constructor(level, x, y, facing) {
    super(level, x, y, {});
    this.w = 12; this.h = 18; this.x = x; this.y = y; this.facing = facing; this.z = 19; this.alwaysUpdate = true;
  }
  update(dt) {
    this.t += dt;
    if (this.t > 2.2) { // estoura em duas agulhas lentas
      for (const d of [-1, 1]) this.level.add(new EnemyProjectile(this.level, this.cx, this.cy, { vx: d * 70, life: 2.2, color: CR[1], w: 6, h: 4 }));
      this.level.particles.emit('ghost_patch', this.cx, this.cy, 6, { colors: [PU[1], CR[1]] });
      audio.sfx('w5e_twang', { pitch: 1.4 });
      this.remove();
    }
  }
  draw(ctx) {
    const fast = this.t > 1.4;
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(this.t * (fast ? 30 : 8));
    drawSprite(ctx, 'tico', 'idle', 0, Math.round(this.cx), Math.round(this.bottom), { flip: this.facing < 0, variant: fast ? CR[1] : PU[2] });
    ctx.globalAlpha = 1;
  }
}
class Echo extends DimEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'tico';
    this.w = 12; this.h = 18; this.alignToCell(x, y);
    this.hp = this.maxHp = 3;
    this.drops = { buttons: 4, heart: 0.15, energy: 0.3 };
    this.decoyT = 2; this.dashT = 0; this.mirrorDelay = -1; this.lastPState = '';
  }
  think(dt) {
    this.stT += dt;
    const t = this.target(), p = this.level.player;
    const sees = this.canSee(t, 190, false);
    // espelha o dash do jogador (direção oposta) após 0.12 s
    if (p.state === 'dash' && this.lastPState !== 'dash' && sees) { this.mirrorDelay = 0.12; this.mirrorDir = -(p.dashDir || p.facing || 1); }
    this.lastPState = p.state;
    if (this.mirrorDelay >= 0) {
      this.mirrorDelay -= dt;
      if (this.mirrorDelay < 0) { this.dashT = 0.18; this.facing = this.mirrorDir; audio.sfx('w5e_portal', { pitch: 1.6 }); }
    }
    if (this.dashT > 0) {
      this.dashT -= dt; this.vx = this.facing * 290; this.vy = 0;
      if (Math.random() < 0.7) this.level.particles.emit('shadow', this.cx - this.facing * 6, this.cy, 1);
      this.physics(dt, { noGravity: true });
      return;
    }
    if (sees) {
      this.faceTarget(t);
      const dx = t.cx - this.cx;
      this.vx = Math.abs(dx) > 30 ? Math.sign(dx) * 70 : 0;
      if (this.grounded && (this.wallAhead() || (t.bottom < this.bottom - 30 && Math.random() < dt * 2))) this.vy = -330;
      this.decoyT -= dt;
      if (this.decoyT <= 0 && this.grounded) { this.decoyT = 4; this.level.add(new EchoDecoy(this.level, this.x, this.y, this.facing)); }
    } else this.patrol(40, dt);
    this.physics(dt);
  }
  draw(ctx) {
    const o = this.spriteOpts();
    const a = this.dashT > 0 ? 'run' : !this.grounded ? 'jump' : Math.abs(this.vx) > 1 ? 'walk' : 'idle';
    const f = animFrame('tico', a, this.t);
    const x = Math.round(this.cx), y = Math.round(this.bottom);
    if (!this.dying) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawSprite(ctx, 'tico', a, f, x + dx, y + dy, { ...o, variant: CR[2] });
    drawSprite(ctx, 'tico', a, f, x, y, { ...o, variant: this.flash > 0 ? 'flash' : '#1e0c2a' });
    if (!this.dying && this.flash <= 0) { // olhos carmesim (aprox. na cabeça)
      ctx.fillStyle = CR[0];
      ctx.fillRect(x + (this.facing > 0 ? 5 : -7), y - 21, 2, 2);
    }
    this.drawStatus(ctx);
  }
  drawLight(L) { if (!this.dying) L.add(this.cx + this.facing * 5, this.y - 2, 12, CR[1], 0.4); }
}
registerEntity('w5_echo', Echo);

// =============================================================================
// g) w5_needlebat
// =============================================================================
defineSprite('w5_needlebat', {
  w: 26, h: 16, ox: 13, oy: 8,
  anims: { fly: { frames: 4, fps: 12 }, shake: { frames: 2, fps: 20 }, dive: { frames: 1, fps: 1 } },
  draw(pc, anim, f) {
    const wing = anim === 'dive' ? 3 : anim === 'shake' ? (f ? -3 : 3) : [-4, -1, 3, -1][f];
    // asas de agulhas douradas
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x0 = 13 + s * 3, x1 = 13 + s * (6 + i * 2), y1 = 7 + wing + i * 2 - (anim === 'dive' ? i : 0);
        pc.line(x0, 7, x1, y1, i % 2 ? GO[2] : GO[1]);
      }
      pc.px(13 + s * 12, 7 + wing + 6, GO[0]);
    }
    // corpo
    pc.ellipse(13, 8, 4, 4, PU[2]); pc.ellipse(12, 7, 2, 2, PU[1]);
    pc.px(10, 3, PU[2]); pc.px(16, 3, PU[2]); pc.px(10, 4, PU[2]); pc.px(16, 4, PU[2]);
    pc.px(11, 8, CR[0]); pc.px(15, 8, CR[0]); pc.px(13, 11, GO[0]); pc.px(13, 12, GO[2]);
    pc.outline(OUT);
  },
});
class NeedleBat extends DimEnemy {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.sprite = 'w5_needlebat';
    this.w = 12; this.h = 10; this.x = x + 2; this.y = y + 3;
    this.homeX = this.x; this.homeY = this.y;
    this.flying = true; this.hp = this.maxHp = 1;
    this.drops = { buttons: 1, heart: 0.04, energy: 0.2 };
    this.cool = 0.6;
  }
  think(dt) {
    this.stT += dt;
    const t = this.target();
    switch (this.state) {
      case 'idle':
        this.anim = 'fly';
        this.x += ((this.homeX + Math.sin(this.t * 1.1) * 18) - this.x) * Math.min(1, dt * 3);
        this.y += ((this.homeY + Math.sin(this.t * 2.3) * 4) - this.y) * Math.min(1, dt * 3);
        this.faceTarget(t);
        if (this.cool <= 0 && this.canSee(t, 130) && t.cy > this.cy - 8) { this.go('shake'); audio.sfx('w5e_screech'); }
        break;
      case 'shake':
        this.anim = 'shake';
        if (this.stT > 0.5) { // arco: parábola que passa pelo alvo e sobe do outro lado
          this.go('dive');
          this.a0 = [this.cx, this.cy]; this.aT = [t.cx, t.cy + 2];
          this.a1 = [t.cx + (t.cx - this.cx), this.cy];
          this.dur = clamp(Math.hypot(t.cx - this.cx, t.cy - this.cy) / 120, 0.6, 1.2);
        }
        break;
      case 'dive': {
        this.anim = 'dive';
        const k = Math.min(1, this.stT / this.dur);
        const [x0, y0] = this.a0, [xm, ym] = this.aT, [x1, y1] = this.a1;
        // Bézier quadrática com ponto de controle tal que a curva passa por (xm, ym) em k=0.5
        const cx = 2 * xm - (x0 + x1) / 2, cy = 2 * ym - (y0 + y1) / 2;
        const u = 1 - k;
        const nx = u * u * x0 + 2 * u * k * cx + k * k * x1, ny = u * u * y0 + 2 * u * k * cy + k * k * y1;
        this.facing = nx >= this.cx ? 1 : -1;
        this.x = nx - this.w / 2; this.y = ny - this.h / 2;
        const bonk = k > 0.55 && this.level.map.rectSolid(this.x + 2, this.y + 2, this.w - 4, this.h - 4);
        if (k >= 1 || bonk) { this.homeX = this.x; this.go('idle'); this.cool = 1.4; }
        break;
      }
    }
  }
  draw(ctx) {
    if (this.state === 'dive' && !this.dying) { ctx.fillStyle = GO[2]; ctx.globalAlpha = 0.5; ctx.fillRect(Math.round(this.cx - this.facing * 8), Math.round(this.cy), 3, 1); ctx.globalAlpha = 1; }
    this.drawBody(ctx, this.anim, { cy: true, tele: this.state === 'shake' });
    this.drawStatus(ctx);
  }
  drawLight(L) { if (!this.dying) L.add(this.cx, this.cy, 10, CR[0], 0.3); }
}
registerEntity('w5_needlebat', NeedleBat);

registerLegend(5, { a: 'w5_riftweaver', b: 'w5_sentinel', d: 'w5_patchgolem', f: 'w5_echo', g: 'w5_needlebat' });

// ----------------------------------------------------------------- fase de teste
function buildMap(W, H, ground, put) {
  const g = [];
  for (let r = 0; r < H; r++) g.push(Array(W).fill(r >= ground ? '#' : '.'));
  put((c, r, s) => { for (let i = 0; i < s.length; i++) g[r][c + i] = s[i]; });
  return g.map((a) => a.join(''));
}
registerLevel({
  id: 'test_enemies_w5', world: 0, index: 0, name: 'Teste: Inimigos do Mundo 5', subtitle: 'Teste',
  tileset: 'w5', background: 'w5', music: null, parTime: 120, darkness: 0.2,
  legend: { a: 'w5_riftweaver', b: 'w5_sentinel', d: 'w5_patchgolem', f: 'w5_echo', g: 'w5_needlebat' },
  map: buildMap(80, 18, 14, (put) => {
    put(1, 13, 'P'); put(78, 13, 'E');
    put(12, 13, 'a');
    put(22, 9, 'b'); put(26, 10, '===');
    put(36, 13, 'd');
    put(50, 13, 'f');
    put(62, 8, 'g'); put(66, 7, 'g');
    put(72, 11, '###');
  }),
});
