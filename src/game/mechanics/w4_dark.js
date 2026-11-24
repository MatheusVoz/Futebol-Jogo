// =============================================================================
// mechanics/w4_dark.js — Mecânicas do MUNDO 4: O PESADELO DEBAIXO DA CAMA.
//
// Legenda do mundo 4 (registerLegend(4,...)); props por célula em `props` da fase:
//  j  w4_luzinha       LUZINHA (vagalume de pelúcia): fica apagadinha na célula até o Tico
//                      chegar perto; depois o segue com luz quente de raio 70. Também nasce
//                      sozinha junto do Tico quando a fase tem `luzinha: true`.
//  l  w4_hiding_spot   ESCONDERIJO (guarda-roupa; props.kind 'blanket' = forte de cobertor):
//                      "interagir" esconde (player.hidden=true, estado 'frozen', invisível
//                      para Enemy.canSee e imune a contato); interagir/pular/atacar sai.
//  m  w4_lamp          ABAJUR (tag 'lamp', campo `on`): props.on inicial, props.radius (tiles,
//                      5), props.signal (aceso enquanto o sinal está ligado — alavanca, placa
//                      ou os 2 ilhós costurados com o mesmo signal; props.latch = fica aceso),
//                      sem signal (ou props.hit) liga/desliga com ataque. Sombras fogem da luz.
//  p  w4_shadow_pool   POÇA DE SOMBRA ('p' contíguos = retângulo): fere 1 a cada 0.9 s quem
//                      fica dentro SEM luz (abajur aceso ou a Luzinha por perto protegem).
//  q  w4_creaky_floor  ASSOALHO QUE RANGE (bloco sólido, 'q' contíguos): aterrissar ou correr
//                      em cima faz barulho → level.events.emit('noise', x, y, raio) e chama
//                      enemy.onNoise?.(x, y, raio) / enemy.investigate?.(x, y). Andar devagar
//                      (sem correr) é silencioso. props.radius (tiles, 7).
//  s  w4_chase_trigger GATILHO DE PERSEGUIÇÃO (invisível; 's' empilhados ou coluna inteira):
//                      ao entrar toca 'w4_chase' e solta um PAREDÃO DE SOMBRA que vem por trás
//                      (props.from 'left'|'right', props.speed 112) até props.endX (coluna) ou
//                      o sinal props.end. Esconder-se faz a sombra parar.
//  u  w4_toy_box       CAIXA-SURPRESA: cair em cima lança o Tico props.height tiles (8) —
//                      altura fixa, segurar o pulo não muda nada.
//  v  w4_closet_door   PORTA DO ARMÁRIO: abre/fecha no tempo (props.open 2 s, props.closed
//                      2.5 s, props.offset) ou com props.signal; fechada bloqueia. Olhos lá dentro.
//                      'v' empilhados = altura; um 'v' sozinho = props.h tiles (3) para cima.
// Fase de teste: ?level=test_w4_mech&god=1&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, approach, rand, rectsOverlap } from '../../engine/util.js';
import { defineImage, drawImage, hasImage, drawSprite, animFrame, hasSprite } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { input } from '../../engine/input.js';
import { game } from '../../engine/game.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';

const Rn = Math.round;
const TAU = Math.PI * 2;
// ---- paleta: roxos/azuis muito escuros + amarelo de abajur
const OUT = '#0a0614';
const NIGHT = { a: '#140f26', b: '#241c40', c: '#382e5e', d: '#54487e' };
const LAMP = { hi: '#fff4c0', lt: '#ffd870', md: '#e8a840', dk: '#a86a28' };
const WOOD = { hi: '#8a6a7a', lt: '#6a4e62', md: '#4e3850', dk: '#33243a' };
const EYE = '#ffe066';
const TOY = { r: '#c83a5a', rl: '#ff6a7a', b: '#4a5ac8', y: '#ffd23f' };

registerSfx('w4_creak', [
  { wave: 'sawtooth', freq: 150, freqEnd: 92, dur: 0.38, vol: 0.09, vibrato: { rate: 19, depth: 1.6 }, filter: { type: 'lowpass', freq: 900 } },
  { wave: 'noise', freq: 900, dur: 0.1, vol: 0.05 },
]);
registerSfx('w4_lamp_on', [{ wave: 'square', freq: 1900, freqEnd: 900, dur: 0.04, vol: 0.1 }, { wave: 'sine', freq: 120, dur: 0.3, vol: 0.07, delay: 0.03 }]);
registerSfx('w4_jingle', { wave: 'triangle', freq: 784, dur: 0.42, vol: 0.12, arp: [0, 4, 7, 12], arpSpeed: 0.07 });

// ============================================================ utilidades
function mergeCells(level, x, y, props, { horiz = true, vert = true } = {}) {
  const rows = level.data?.map, ch = props.char;
  if (!rows || !ch) return { w: 1, h: 1 };
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  const at = (tx, ty) => (rows[ty] || '')[tx];
  if ((horiz && at(cx - 1, cy) === ch) || (vert && at(cx, cy - 1) === ch)) return null;
  let w = 1, h = 1;
  if (horiz) while (at(cx + w, cy) === ch) w++;
  if (vert) while (at(cx, cy + h) === ch) h++;
  return { w, h };
}
function standsOn(b, s) {
  return !!b && !b.dead && b.vy >= 0 && b.x + b.w > s.x + 1 && b.x < s.x + s.w - 1 && (b.groundEntity === s || (b.grounded && Math.abs(b.y + b.h - s.y) < 1.5));
}
function nearPlayer(e, rx = 220, ry = 150) {
  const p = e.level.player;
  return !!p && Math.abs(p.cx - e.cx) < rx && Math.abs(p.cy - e.cy) < ry;
}
/** Luz forte no ponto: abajur aceso (tag 'lamp') ou entidade não-inimiga com light.r ≥ 40 (Luzinha). */
export function litAt(level, x, y, pad = 0) {
  for (const e of level.entities) {
    if (e.dead || e.enemy || e.isPlayer) continue;
    let r;
    if (e.tags?.has('lamp')) { if (e.on !== true) continue; r = e.lightRadius ?? e.light?.r ?? 64; }
    else if (e.light && (e.light.r || 0) >= 40) r = e.light.r;
    else continue;
    r += pad;
    const dx = e.cx - x, dy = e.cy - y;
    if (dx * dx + dy * dy < r * r) return e;
  }
  return null;
}

// ============================================================ arte
function wardrobeArt(pc, open) {
  pc.rect(1, 3, 20, 27, WOOD.md); pc.rect(0, 0, 22, 4, WOOD.lt); pc.hline(0, 0, 22, WOOD.hi);
  pc.rect(2, 30, 3, 2, WOOD.dk); pc.rect(17, 30, 3, 2, WOOD.dk);
  if (open) {
    pc.rect(3, 5, 16, 24, '#05030a');
    pc.rect(1, 5, 3, 24, WOOD.lt); pc.rect(18, 5, 3, 24, WOOD.lt);
    pc.hline(5, 8, 12, WOOD.dk); pc.px(8, 9, '#8a8aa8'); pc.px(13, 9, '#8a8aa8');
  } else {
    pc.rect(3, 5, 7, 24, WOOD.lt); pc.rect(12, 5, 7, 24, WOOD.lt);
    pc.strokeRect(4, 7, 5, 9, WOOD.dk); pc.strokeRect(13, 7, 5, 9, WOOD.dk);
    pc.strokeRect(4, 18, 5, 9, WOOD.dk); pc.strokeRect(13, 18, 5, 9, WOOD.dk);
    pc.vline(10, 5, 24, '#05030a'); pc.vline(11, 5, 24, '#05030a');
    pc.px(9, 17, LAMP.md); pc.px(12, 17, LAMP.md);
  }
  pc.vline(1, 3, 27, WOOD.hi);
  pc.outline(OUT);
}
defineImage('w4_wardrobe_open', 22, 32, (pc) => wardrobeArt(pc, true));
defineImage('w4_wardrobe_shut', 22, 32, (pc) => wardrobeArt(pc, false));
function blanketArt(pc, shut) {
  pc.poly([[1, 17], [5, 4], [11, 1], [17, 4], [21, 17]], '#5a4e9a');
  pc.poly([[4, 17], [7, 7], [11, 4], [15, 7], [18, 17]], '#7a6ec0');
  for (let i = 3; i < 20; i += 4) pc.px(i, 12, TOY.y);
  pc.hline(2, 16, 19, '#3a3070');
  if (!shut) pc.poly([[8, 17], [11, 9], [14, 17]], '#05030a');
  pc.outline(OUT);
}
defineImage('w4_blanket_open', 22, 18, (pc) => blanketArt(pc, false));
defineImage('w4_blanket_shut', 22, 18, (pc) => blanketArt(pc, true));
function lampArt(pc, on) {
  const sh = on ? { a: LAMP.hi, b: LAMP.lt, c: LAMP.md } : { a: '#7a6e9a', b: '#5e5480', c: '#463e66' };
  pc.poly([[3, 1], [11, 1], [14, 10], [0, 10]], sh.b);
  pc.poly([[4, 1], [7, 1], [6, 10], [2, 10]], sh.a);
  pc.hline(0, 10, 15, sh.c);
  for (let i = 1; i < 14; i += 3) pc.px(i, 9, on ? '#ff9ab4' : '#8a6a9a');
  pc.rect(6, 11, 2, 9, LAMP.dk); pc.vline(6, 11, 9, LAMP.md);
  pc.ellipse(7, 21, 5, 2, LAMP.dk); pc.hline(3, 20, 8, LAMP.md);
  pc.outline(OUT);
}
defineImage('w4_lamp_on', 15, 24, (pc) => lampArt(pc, true));
defineImage('w4_lamp_off', 15, 24, (pc) => lampArt(pc, false));
function toyboxArt(pc, open) {
  pc.rect(1, open ? 5 : 3, 14, open ? 10 : 12, TOY.r);
  pc.hline(1, open ? 5 : 3, 14, TOY.rl); pc.hline(1, 14, 14, '#8a1a3a');
  pc.px(4, 9, TOY.y); pc.px(11, 8, TOY.y); pc.px(8, 12, TOY.y); pc.px(5, 12, '#ffffff');
  if (open) { pc.rect(0, 1, 7, 2, TOY.b); pc.px(0, 3, TOY.b); }
  else { pc.rect(0, 1, 16, 2, TOY.b); pc.hline(0, 1, 16, '#7a8af0'); }
  pc.rect(15, 7, 1, 3, '#a8a4c4'); pc.rect(15, 10, 1, 1, TOY.y);
  pc.outline(OUT);
}
defineImage('w4_toybox_shut', 17, 16, (pc) => toyboxArt(pc, false));
defineImage('w4_toybox_open', 17, 16, (pc) => toyboxArt(pc, true));
defineImage('w4_jester', 13, 11, (pc) => {
  pc.circle(6, 7, 3, '#fff4e8'); pc.px(6, 8, TOY.r);
  pc.px(5, 6, OUT); pc.px(7, 6, OUT);
  pc.tri(2, 4, 6, 4, 1, 0, '#a855ff'); pc.tri(6, 4, 10, 4, 11, 0, TOY.y);
  pc.px(1, 0, TOY.y); pc.px(11, 0, '#a855ff');
  pc.outline(OUT);
});
function floorImage(wt) {
  const name = 'w4_floor_' + wt;
  if (hasImage(name)) return name;
  defineImage(name, wt * TILE, TILE, (pc) => {
    const W = wt * TILE;
    pc.rect(0, 0, W, 16, WOOD.md);
    for (let y = 0; y < 16; y += 4) {
      pc.hline(0, y, W, y === 0 ? WOOD.hi : WOOD.dk);
      const off = (y * 7) % 13;
      for (let x = off; x < W; x += 13) { pc.vline(x, y + 1, 3, WOOD.dk); pc.px(x + 2, y + 2, '#a89aa8'); }
    }
    for (let x = 5; x < W; x += 23) pc.line(x, 6, x + 4, 7, WOOD.dk);
  });
  return name;
}

// ============================================================ j — Luzinha
class Luzinha extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 12; this.h = 12; this.x = x + 2; this.y = y + 2;
    this.found = !!p.follow;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 55; this.flip = false; this.mv = 0;
    this.light = { r: this.found ? 70 : 24, color: '#ffe9a0', i: 1, flicker: 0.12 };
    this.isLuzinha = true;
    l._luzinha = this;
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player;
    if (!p) return;
    if (!this.found) {
      if (Math.hypot(p.cx - this.cx, p.cy - this.cy) < 52) {
        this.found = true;
        audio.sfx('secret_soft', { vol: 0.5 }); audio.sfx('heal', { vol: 0.4, pitch: 1.3 });
        L.particles.emit('sparkle', this.cx, this.cy, 10, { colors: [LAMP.hi, LAMP.lt, '#ffffff'] });
      }
      return;
    }
    const tx = p.cx - p.facing * 18, ty = p.y - 4 + Math.sin(this.t * 2.6) * 3;
    const dx = tx - this.cx, dy = ty - this.cy;
    if (Math.hypot(dx, dy) > 260) { this.x = tx - 6; this.y = ty - 6; }
    else { const k = 1 - Math.exp(-4 * dt); this.x += dx * k; this.y += dy * k; }
    this.mv = Math.abs(dx);
    if (dx < -3) this.flip = true; else if (dx > 3) this.flip = false;
    this.light.r = approach(this.light.r, 70, 80 * dt);
    if (Math.random() < dt * 3) L.particles.emit('sparkle', this.cx + rand(-3, 3), this.cy + 4, 1, { colors: [LAMP.lt, LAMP.hi] });
  }
  draw(ctx) {
    const anim = !this.found ? 'dim' : this.mv > 8 ? 'fly' : 'idle';
    if (hasSprite('npc_luzinha')) drawSprite(ctx, 'npc_luzinha', anim, animFrame('npc_luzinha', anim, this.t), this.cx, this.cy + 12, { flip: this.flip });
    else { ctx.fillStyle = LAMP.lt; ctx.fillRect(Rn(this.cx) - 2, Rn(this.cy) - 2, 4, 4); }
  }
}

// ============================================================ l — esconderijo
class HidingSpot extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.kind = p.kind === 'blanket' ? 'blanket' : 'wardrobe';
    this.w = 22; this.h = this.kind === 'wardrobe' ? 32 : 18;
    this.x = x - 3; this.y = y + TILE - this.h;
    this.interactable = true; this.prompt = 'Esconder';
    this.z = 56; this.occ = false; this.hideT = 0;
  }
  interact(p) { if (!this.occ) this.enter(p); }
  enter(p) {
    this.occ = true; this.hideT = 0;
    p.hidden = true; p.state = 'frozen'; p.cutsceneAnim = 'idle'; p.vx = 0; p.x = this.cx - p.w / 2;
    this.prompt = 'Sair';
    audio.sfx('ui_close', { vol: 0.6 }); audio.sfx('w4_creak', { vol: 0.5, pitch: 1.4 });
  }
  leave(p) {
    this.occ = false; p.hidden = false;
    if (p.state === 'frozen') p.state = 'normal';
    p.cutsceneAnim = null; this.prompt = 'Esconder';
    audio.sfx('ui_open', { vol: 0.6 });
  }
  update(dt) {
    this.tickTimers(dt);
    const p = this.player;
    if (!this.occ || !p) return;
    this.hideT += dt;
    if (p.state === 'dead' || !p.hidden) { this.occ = false; this.prompt = 'Esconder'; return; }
    p.invuln = Math.max(p.invuln, 0.12); p.vx = 0; p.x = this.cx - p.w / 2;
    if (this.hideT > 0.25 && !this.level.inputLocked && (input.pressed('interact') || input.pressed('jump') || input.pressed('attack'))) this.leave(p);
  }
  draw(ctx) {
    const base = this.kind === 'wardrobe' ? 'w4_wardrobe' : 'w4_blanket';
    drawImage(ctx, base + (this.occ ? '_shut' : '_open'), Rn(this.x), Rn(this.y));
    if (this.occ && Math.floor(this.t * 0.7) % 4 !== 3) {        // olhinhos do Tico na fresta
      ctx.fillStyle = '#7fe6df';
      const ey = this.kind === 'wardrobe' ? 14 : 12;
      ctx.fillRect(Rn(this.x) + 10, Rn(this.y) + ey, 1, 1); ctx.fillRect(Rn(this.x) + 11, Rn(this.y) + ey, 1, 1);
    }
  }
}

// ============================================================ m — abajur
class Lamp extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 14; this.h = 24; this.x = x + 1; this.y = y + TILE - 24;
    this.tags.add('lamp');
    this.on = !!p.on; this.lightRadius = (p.radius ?? 5) * TILE;
    this.hittable = !p.signal || !!p.hit;
    this.flick = 0; this.z = 15;
  }
  setOn(v) {
    if (v === this.on) return;
    this.on = v; this.flick = v ? 0.35 : 0;
    if (nearPlayer(this, 260, 180)) audio.sfx(v ? 'w4_lamp_on' : 'lever', { vol: 0.6 });
    if (v) this.level.particles.emit('sparkle', this.cx, this.y + 6, 8, { colors: [LAMP.hi, LAMP.lt, '#ffffff'] });
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.flick > 0) this.flick -= dt;
    const s = this.props.signal;
    if (s) { const v = !!this.level.signals?.[s]; this.setOn(!!(v || (this.props.latch && this.on))); }
  }
  onHit() { if (!this.hittable) return false; this.setOn(!this.on); return true; }
  drawLight(lt) {
    if (!this.on) { lt.add(this.cx, this.y + 6, 10, '#806040', 0.35); return; }
    const fl = this.flick > 0 && Math.floor(this.flick * 30) % 2 ? 0.4 : 1;
    lt.add(this.cx, this.y + 8, this.lightRadius, '#ffd870', fl, 0.04);
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.on) {
      ctx.globalAlpha = 0.12; ctx.fillStyle = LAMP.lt;
      for (let i = 0; i < 18; i++) ctx.fillRect(x + 7 - 2 - i * 0.6, y + 11 + i, 5 + i * 1.2, 1);
      ctx.globalAlpha = 1;
    }
    drawImage(ctx, this.on ? 'w4_lamp_on' : 'w4_lamp_off', x, y);
  }
}

// ============================================================ p — poça de sombra
class ShadowPool extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p);
    if (!m) { this.dead = true; return; }
    this.w = (p.w || m.w) * TILE; this.h = (p.h || m.h) * TILE;
    this.z = 4; this.dmgT = 0; this.lit = 0;
    this.tend = [];
    for (let i = 0; i < Math.max(2, Math.round(this.w / 10)); i++) this.tend.push({ x: (i + 0.5) / Math.max(2, Math.round(this.w / 10)), ph: i * 1.7, hgt: 0.5 + ((i * 0.37) % 0.5) });
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player;
    this.lit = approach(this.lit, litAt(L, this.cx, this.y + this.h - 4) ? 1 : 0, dt * 3);
    if (!p || p.state === 'dead' || p.hidden) return;
    if (!rectsOverlap(p, { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 2 })) { this.dmgT = Math.max(0, this.dmgT - dt); return; }
    if (litAt(L, p.cx, p.cy)) { this.dmgT = Math.max(0, this.dmgT - dt); return; }
    this.dmgT += dt;
    if (Math.random() < dt * 14) L.particles.emit('shadow', p.cx + rand(-5, 5), p.bottom - 2, 1);
    if (this.dmgT >= 0.9) { this.dmgT = 0; p.hurt(1, null, { noKnock: true }); audio.sfx('shadow_whisper', { vol: 0.5, cooldown: 0.5 }); }
  }
  draw(ctx) {
    const x = Rn(this.x), W = this.w, bot = Rn(this.y + this.h), t = this.t, k = 1 - this.lit * 0.6;
    ctx.globalAlpha = 0.85 * k + 0.1; ctx.fillStyle = '#05030a';
    for (let i = 0; i < W; i += 2) {
      const hh = 3 + Rn(Math.sin(i * 0.3 + t * 2) * 1.2 + 1.2);
      ctx.fillRect(x + i, bot - hh, 2, hh);
    }
    ctx.fillStyle = '#2a1a4a';
    for (const td of this.tend) {
      const tx = x + td.x * W, len = (this.h - 6) * td.hgt * k;
      for (let s = 0; s < len; s += 2) {
        const o = Math.sin(t * 3 + td.ph + s * 0.15) * (2 + s * 0.12);
        ctx.globalAlpha = (0.75 - (s / Math.max(1, len)) * 0.55) * k;
        ctx.fillRect(Rn(tx + o), bot - 3 - s, 2, 2);
      }
    }
    if (k > 0.7) {
      const blink = Math.floor(t * 0.8 + this.x) % 5 === 0;
      ctx.globalAlpha = blink ? 0.2 : 0.9; ctx.fillStyle = '#c84aff';
      const ex = x + Rn(W * 0.35 + Math.sin(t * 0.4) * W * 0.2);
      ctx.fillRect(ex, bot - 4, 1, 1); ctx.fillRect(ex + 3, bot - 4, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ q — assoalho que range
class CreakyFloor extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { vert: false });
    if (!m) { this.dead = true; return; }
    this.w = (p.w || m.w) * TILE; this.h = TILE;
    this.solid = true; this.z = 8; this.cd = 0; this.ring = 0; this.rx = 0;
    this.radius = (p.radius ?? 7) * TILE;
    this.img = floorImage(this.w / TILE);
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.cd > 0) this.cd -= dt;
    if (this.ring > 0) this.ring -= dt;
    const p = this.player;
    if (!standsOn(p, this)) return;
    if (p.justLanded) this.creak(p.cx, 1);
    else if (Math.abs(p.vx) > 100 && this.cd <= 0) this.creak(p.cx, 0.8);
  }
  creak(x, k) {
    const L = this.level, y = this.y;
    this.cd = 0.38; this.ring = 0.6; this.rx = x;
    audio.sfx('w4_creak', { vol: 0.5 + 0.4 * k, randomPitch: 0.15, cooldown: 0.1 });
    L.events?.emit?.('noise', x, y, this.radius);
    for (const e of L.entities) {
      if (!e.enemy || e.dead) continue;
      if (Math.hypot(e.cx - x, e.cy - y) > this.radius) continue;
      if (e.onNoise) e.onNoise(x, y, this.radius); else e.investigate?.(x, y);
    }
  }
  draw(ctx) {
    drawImage(ctx, this.img, Rn(this.x), Rn(this.y));
    if (this.ring > 0) {
      const k = 1 - this.ring / 0.6, r = 6 + k * 34;
      ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = LAMP.hi;
      for (let i = -3; i <= 3; i++) {
        const a = -Math.PI / 2 + i * 0.32;
        ctx.fillRect(Rn(this.rx + Math.cos(a) * r), Rn(this.y - 4 + Math.sin(a) * r * 0.6), 2, 1);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ============================================================ s — perseguição
class Chaser extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.dir = p.dir || 1; this.front = x; this.speed = p.speed ?? 112;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 60; this.dying = 0; this.beat = 0;
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player, cam = L.camera;
    if (this.dying) { this.dying += dt; if (this.dying > 1.2) this.remove(); return; }
    if (!p) return;
    const dist = this.dir > 0 ? p.x - this.front : this.front - (p.x + p.w);
    let v = this.speed + Math.max(0, dist - 170) * 1.6;
    if (p.state === 'dead' || (p.hidden && dist < 60)) v = 0;
    this.front += this.dir * v * dt;
    if (dist > 200 && !p.hidden) this.front = this.dir > 0 ? Math.max(this.front, p.x - 200) : Math.min(this.front, p.x + p.w + 200);   // sempre à vista
    if (dist < -2 && p.state !== 'dead' && !p.hidden) {
      p.hurt(1, { cx: this.front - this.dir * 30, x: this.front });
      this.front -= this.dir * 90;
    }
    if (dist < 140 && (this.beat -= dt) <= 0) { this.beat = 0.6; audio.sfx('heartbeat', { vol: 0.5 }); }
    this.x = this.dir > 0 ? this.front - 400 : this.front; this.w = 400;
    this.y = cam.y - 20; this.h = (cam.viewH || 260) + 40;
    if (Math.random() < dt * 25) L.particles.emit('shadow', this.front + rand(-6, 6), this.y + rand(20, this.h - 20), 1);
  }
  dissolve() {
    if (this.dying) return;
    this.dying = 0.001;
    audio.sfx('shadow_whisper', { vol: 0.7 });
    for (let i = 0; i < 10; i++) this.level.particles.emit('shadow', this.front, this.y + rand(0, this.h), 3);
  }
  eyes() {
    const out = [];
    for (let i = 0; i < 3; i++) out.push({ x: this.front - this.dir * (18 + i * 22), y: this.y + this.h * (0.3 + i * 0.22) + Math.sin(this.t * 1.3 + i) * 6, open: Math.floor(this.t * 0.9 + i * 1.7) % 4 !== 0 });
    return out;
  }
  drawLight(lt) { if (!this.dying) for (const e of this.eyes()) if (e.open) lt.add(e.x, e.y, 18, EYE, 0.9); }
  draw(ctx) {
    const a = this.dying ? Math.max(0, 1 - this.dying / 1.2) : 1, d = this.dir, t = this.t;
    ctx.globalAlpha = 0.93 * a; ctx.fillStyle = '#05030a';
    for (let yy = this.y; yy < this.y + this.h; yy += 4) {
      const o = Math.sin(yy * 0.06 + t * 5) * 7 + Math.sin(yy * 0.17 - t * 3) * 3;
      const edge = this.front + d * o;
      if (d > 0) ctx.fillRect(Rn(edge - 420), Rn(yy), 420, 4); else ctx.fillRect(Rn(edge), Rn(yy), 420, 4);
    }
    ctx.fillStyle = '#4a2a7a';
    for (let i = 0; i < 4; i++) {          // mãos que se esticam
      const hy = this.y + this.h * (0.2 + i * 0.2), reach = 10 + Math.max(0, Math.sin(t * 2.2 + i * 1.9)) * 18;
      for (let s = 0; s < reach; s += 2) ctx.fillRect(Rn(this.front + d * s), Rn(hy + Math.sin(s * 0.3 + t * 4) * 2), 2, 2);
      ctx.fillRect(Rn(this.front + d * reach), Rn(hy - 3), 2, 7);
    }
    for (const e of this.eyes()) {
      if (!e.open) continue;
      ctx.fillStyle = EYE; ctx.fillRect(Rn(e.x) - 4, Rn(e.y), 3, 2); ctx.fillRect(Rn(e.x) + 2, Rn(e.y), 3, 2);
      ctx.fillStyle = '#ff5a3c'; ctx.fillRect(Rn(e.x) - 3, Rn(e.y), 1, 1); ctx.fillRect(Rn(e.x) + 3, Rn(e.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
class ChaseTrigger extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { horiz: false });
    if (!m) { this.dead = true; return; }
    this.x = x; this.w = TILE;
    if (m.h > 1) { this.y = y; this.h = m.h * TILE; } else { this.y = 0; this.h = l.map.height; }
    this.started = false; this.done = false; this.chaser = null; this.alwaysUpdate = true;
    this.dir = p.from === 'right' ? -1 : 1;
  }
  update(dt) {
    const L = this.level, p = L.player, pr = this.props;
    if (!p || this.done) return;
    if (!this.started) { if (p.state !== 'dead' && this.overlaps(p)) this.start(); return; }
    const endX = pr.endX != null ? pr.endX * TILE : null;
    if ((pr.end && L.signals?.[pr.end]) || (endX !== null && (this.dir > 0 ? p.cx >= endX : p.cx <= endX))) this.finish();
  }
  start() {
    const L = this.level, cam = L.camera;
    this.started = true;
    audio.playMusic('w4_chase', { fade: 0.3 });
    audio.sfx('shadow_whisper', { vol: 0.8 });
    L.shake(0.3);
    const fx = this.dir > 0 ? cam.x - 30 : cam.x + (cam.viewW || 400) + 30;
    this.chaser = L.add(new Chaser(L, fx, 0, { dir: this.dir, speed: this.props.speed }));
  }
  finish() {
    const L = this.level;
    this.done = true;
    this.chaser?.dissolve();
    audio.playMusic(L.data.music || `w${L.data.world}_level`, { fade: 1 });
  }
}

// ============================================================ u — caixa-surpresa (pulo grande)
class ToyBox extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 16; this.h = 12; this.x = x; this.y = y + 4;
    this.power = Math.sqrt(2 * 1000 * (p.height ?? 8) * TILE) + 20;
    this.popT = 9; this.boost = false; this.z = 6;
  }
  update(dt) {
    this.tickTimers(dt);
    this.popT += dt;
    const p = this.player;
    if (p && p.state === 'normal' && p.vy >= 0 && this.overlaps(p) && p.bottom - this.y < 8) {
      p.vy = -this.power; p.jumping = true; p.airJumps = 0; p.canAirDash = true; p.grounded = false;
      p.y = Math.min(p.y, this.y - p.h + 2);
      this.boost = true; this.popT = 0;
      audio.sfx('spring', { pitch: 0.85 }); audio.sfx('w4_jingle', { vol: 0.6 });
      this.level.particles.emit('sparkle', this.cx, this.y, 8, { colors: [TOY.y, TOY.rl, '#ffffff'] });
    }
  }
  /** Altura fixa: compensa o "corte" do pulo quando o botão não está seguro. */
  lateUpdate(dt) {
    if (!this.boost) return;
    const p = this.player;
    if (!p || p.vy >= 0 || p.state !== 'normal' || p.inWater) { this.boost = false; return; }
    if (!input.down('jump') || !p.jumping) p.vy -= 1600 * dt * (p.mods?.gravity ?? 1);
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), open = this.popT < 0.7;
    drawImage(ctx, open ? 'w4_toybox_open' : 'w4_toybox_shut', x, y - 4);
    if (open) {
      const k = this.popT < 0.12 ? this.popT / 0.12 : Math.max(0, 1 - (this.popT - 0.35) / 0.35);
      const top = y + 2 - Rn(18 * Math.min(1, k) + Math.sin(this.popT * 40) * (1 - Math.min(1, this.popT * 2)) * 2);
      ctx.fillStyle = '#a8a4c4';
      for (let yy = top + 8; yy < y + 4; yy += 2) ctx.fillRect(x + 6 + ((yy >> 1) % 2 ? 0 : 3), yy, 2, 1);
      drawImage(ctx, 'w4_jester', x + 2, top - 2);
    }
  }
}

// ============================================================ v — porta do armário
class ClosetDoor extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { horiz: false });
    if (!m) { this.dead = true; return; }
    const ht = m.h > 1 ? m.h : Math.max(1, p.h ?? 3);
    this.x = x + 2; this.w = 12; this.y = m.h > 1 ? y : y + TILE - ht * TILE; this.h = ht * TILE;
    this.openT = p.open ?? 2; this.closedT = p.closed ?? 2.5; this.cyc = this.openT + this.closedT;
    this.lt = p.offset ?? 0; this.k = 0; this.isOpen = null; this.remain = 0;
    this.solid = true; this.z = 12; this.alwaysUpdate = true;
    this.sync(true);
  }
  sync(init) {
    let open;
    if (this.props.signal) { open = !!this.level.signals?.[this.props.signal]; this.remain = 9; }
    else { const ph = ((this.lt % this.cyc) + this.cyc) % this.cyc; open = ph < this.openT; this.remain = open ? this.openT - ph : this.cyc - ph; }
    if (open === this.isOpen) return;
    this.isOpen = open;
    if (init) { this.k = open ? 1 : 0; this.solid = !open; return; }
    if (nearPlayer(this)) audio.sfx(open ? 'w4_creak' : 'gate_open', { vol: 0.45, pitch: open ? 0.8 : 0.6 });
  }
  update(dt) {
    this.tickTimers(dt);
    this.lt += dt;
    this.sync(false);
    this.k = approach(this.k, this.isOpen ? 1 : 0, 5 * dt);
    const want = this.k < 0.7;
    if (want !== this.solid) {
      this.solid = want; this.level.refreshSolids();
      if (want) {
        const L = this.level;
        for (const b of [L.player, L.decoy]) {
          if (!b || b.dead || !rectsOverlap(b, this)) continue;
          const nx = b.cx < this.cx ? this.x - b.w : this.x + this.w;
          if (!L.map.rectSolid(nx, b.y, b.w, b.h)) b.x = nx;
        }
      }
    }
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), H = this.h, t = this.t;
    ctx.fillStyle = OUT; ctx.fillRect(x - 3, y - 3, 18, H + 3);
    ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 2, y - 2, 16, H + 2);
    ctx.fillStyle = '#05030a'; ctx.fillRect(x, y, 12, H);
    if (this.k > 0.25) {             // olhos no escuro
      ctx.globalAlpha = Math.min(1, (this.k - 0.25) * 2);
      for (let i = 0; i < Math.max(1, Math.floor(H / 22)); i++) {
        if (Math.floor(t * 0.8 + i * 1.3) % 5 === 0) continue;
        const ey = y + 8 + i * 22 + Rn(Math.sin(t + i) * 2), ex = x + 3 + Rn(Math.sin(t * 0.7 + i * 2));
        ctx.fillStyle = EYE; ctx.fillRect(ex, ey, 2, 2); ctx.fillRect(ex + 5, ey, 2, 2);
        ctx.fillStyle = '#ff5a3c'; ctx.fillRect(ex + 1, ey + 1, 1, 1); ctx.fillRect(ex + 6, ey + 1, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const shake = this.isOpen && !this.props.signal && this.remain < 0.6 ? Rn(Math.sin(t * 60)) : 0;
    const pw = Math.max(2, Rn(12 * (1 - this.k)));
    ctx.fillStyle = OUT; ctx.fillRect(x - 1 + shake, y - 1, pw + 2, H + 1);
    ctx.fillStyle = WOOD.lt; ctx.fillRect(x + shake, y, pw, H);
    if (pw > 6) {
      ctx.fillStyle = WOOD.dk;
      for (let yy = y + 4; yy < y + H - 6; yy += 16) ctx.fillRect(x + 2 + shake, yy, pw - 4, 1);
      ctx.fillStyle = LAMP.md; ctx.fillRect(x + pw - 3 + shake, y + (H >> 1), 2, 2);
    }
    ctx.fillStyle = WOOD.hi; ctx.fillRect(x + shake, y, 1, H);
  }
}

// ============================================================ registro
registerEntity('w4_luzinha', Luzinha);
registerEntity('w4_hiding_spot', HidingSpot);
registerEntity('w4_lamp', Lamp);
registerEntity('w4_shadow_pool', ShadowPool);
registerEntity('w4_creaky_floor', CreakyFloor);
registerEntity('w4_chase_trigger', ChaseTrigger);
registerEntity('w4_chaser', Chaser);
registerEntity('w4_toy_box', ToyBox);
registerEntity('w4_closet_door', ClosetDoor);
const W4_LEGEND = { j: 'w4_luzinha', l: 'w4_hiding_spot', m: 'w4_lamp', p: 'w4_shadow_pool', q: 'w4_creaky_floor', s: 'w4_chase_trigger', u: 'w4_toy_box', v: 'w4_closet_door' };
registerLegend(4, W4_LEGEND);

// Luzinha automática: fases com `luzinha: true` (se o mapa não tiver um 'j').
game.events?.on?.('levelStart', (level) => {
  if (!level?.data?.luzinha || level._luzinha || !level.player) return;
  const p = level.player;
  level.add(new Luzinha(level, p.x - 18, p.y - 14, { follow: true }));
});

// ============================================================ fase de teste
function grid(W, H, ops) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < W) g[y][x] = ch; };
  ops(fill, (x, y, ch) => fill(x, y, x, y, ch));
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w4_mech', world: 0, index: 0, name: 'Teste: Mecânicas do Pesadelo', subtitle: 'Mundo 4',
  tileset: 'w4', background: 'w4', music: null, parTime: 120, darkness: 0.7, luzinha: true, timeOfDay: 'night',
  legend: { ...W4_LEGEND, a: 'w4_shadowstalker' },
  map: grid(104, 20, (fill, put) => {
    fill(0, 15, 103, 19, '#');
    put(2, 14, 'P');
    put(5, 14, 'L'); put(8, 14, 'm');                 // alavanca acende o abajur
    put(11, 14, 'm');                                 // abajur que liga com ataque
    fill(14, 14, 19, 14, 'p');                        // poça de sombra
    put(24, 14, 'l'); put(27, 14, 'l');               // guarda-roupa e cobertor
    put(31, 14, 'a');
    fill(34, 15, 40, 15, 'q');                        // assoalho que range
    put(46, 14, 'u'); fill(49, 7, 54, 14, '%');       // caixa-surpresa → plataforma alta
    fill(56, 0, 60, 11, '%'); fill(58, 12, 58, 14, 'v');   // porta do armário
    put(64, 14, 's');                                 // começa a perseguição
    fill(72, 15, 74, 19, '.'); fill(82, 15, 84, 19, '.'); fill(78, 13, 79, 14, '%');
    put(100, 14, 'E');
  }),
  props: {
    '5,14': { signal: 'L1' }, '8,14': { signal: 'L1', radius: 6 },
    '11,14': { on: true },
    '27,14': { kind: 'blanket' },
    '46,14': { height: 9 },
    '58,12': { open: 2, closed: 2.5 },
    '64,14': { endX: 94, speed: 105 },
  },
});
