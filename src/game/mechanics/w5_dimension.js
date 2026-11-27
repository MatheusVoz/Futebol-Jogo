// =============================================================================
// mechanics/w5_dimension.js — Mecânicas do MUNDO 5: O CORAÇÃO DA DIMENSÃO.
//
// Legenda do mundo 5 (registerLegend(5,...)); props por célula em `props` da fase:
//  j  w5_portal          PORTAL (2 tiles de altura a partir da célula, para cima): liga ao outro
//                        portal com o mesmo props.pair (id; padrão 'a'). Velocidade preservada.
//                        Leva Tico e o Retalho Fantasma.
//  l  w5_rift_switch     CRISTAL DA FENDA: ataque ou "interagir" alterna a fase global
//                        A (vermelho) ↔ B (azul): level.signal('phase', 'A'|'B').
//                        Fase inicial: level.data.phase (padrão 'A').
//  m  w5_phase_block_a   BLOCO DE FASE A (vermelho): sólido só na fase A; fantasma na B.
//  p  w5_phase_block_b   BLOCO DE FASE B (azul): sólido só na fase B. 'm'/'p' contíguos = retângulo.
//  q  w5_thread_rail     TIROLESA DE FIO DOURADO: da célula até (+props.dx, +props.dy) tiles
//                        (padrão dx 8, dy 3). Pule/caia nela para agarrar; desliza (mais rápido
//                        na descida); pular solta (e devolve o pulo duplo); na ponta solta com
//                        o embalo.
//  s  w5_drifting_island ILHA DE RETALHOS flutuante (vazada), carrega o Tico: props.w (tiles, 3),
//                        props.ax / props.ay (amplitude em tiles; padrão 0 / 1), props.period
//                        (s, 4), props.phase (0..1). ax e ay juntos = elipse.
//  u  w5_collapsing_ruin RUÍNA que desmorona 0.5 s depois de pisada (pedaços sobem e somem);
//                        rebobinável (Remendo Temporal). props.respawn (s, 6; 0 = nunca),
//                        props.sealed (selo: o Remendo não funciona).
//  v  (alias)            orbe 'unravel_orb' de abilities/unravel.js.
//  w  w5_gravity_seam    COSTURA DE GRAVIDADE (corrente ascendente; 'w' contíguos = retângulo):
//                        quem entra é erguido a props.speed px/s (230) e recupera pulo duplo e
//                        dash. Pairar no topo = elevador. (Inverter a gravidade de verdade não é
//                        robusto com a física atual — por isso é uma corrente para cima.)
// Fase de teste: ?level=test_w5_mech&god=1&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { T } from '../../engine/tilemap.js';
import { TILE, clamp, rectsOverlap } from '../../engine/util.js';
import { defineImage, drawImage, getImage, hasImage } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import * as VFX from '../art/vfx.js';

const Rn = Math.round;
const TAU = Math.PI * 2;
// ---- paleta: vermelho/magenta/roxo + fios dourados
const OUT = '#12061a';
const GOLD = { hi: '#fff3a8', lt: '#ffd23f', md: '#e0a020', dk: '#8a5a14' };
const PHC = {
  A: { hi: '#ff9ab0', lt: '#ff5a7a', md: '#e0284e', dk: '#8a1036', rune: '#ffe0e8' },
  B: { hi: '#a8c8ff', lt: '#6a9aff', md: '#3a5ae0', dk: '#1a2a8a', rune: '#e0ecff' },
};
const STONE = { hi: '#6a4a8a', md: '#4a2e66', dk: '#2e1a44', crack: '#ff4fd8' };
const FAB = ['#c8306a', '#8a3ac8', '#e0508a', '#5a2a9a', '#ff7aa8'];
const PORTAL_COLS = [['#ff4fd8', '#a855ff', '#ffffff'], ['#4fd8ff', '#3a5ae0', '#ffffff'], ['#ffd23f', '#ff7a3c', '#ffffff'], ['#7aff9a', '#2ab87a', '#ffffff']];
const REW = '#7fe6ff';

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
  bgUnder(level.map, cx, cy, w, h);
  return { w, h };
}
/** Retângulo de mecânica dentro de um painel de fundo (':'): as células viram fundo
 *  também (sem "janela" para o céu atrás de correntes/blocos de fase). */
function bgUnder(map, cx, cy, w, h) {
  if (!map) return;
  for (let r = cy; r < cy + h; r++) {
    if (map.get(cx - 1, r) !== T.BG && map.get(cx + w, r) !== T.BG) continue;
    for (let i = 0; i < w; i++) if (map.get(cx + i, r) === T.EMPTY) map.set(cx + i, r, T.BG);
  }
}
function standsOn(b, s) {
  return !!b && !b.dead && b.vy >= 0 && b.x + b.w > s.x + 1 && b.x < s.x + s.w - 1 && (b.groundEntity === s || (b.grounded && Math.abs(b.y + b.h - s.y) < 1.5));
}
function unstick(L, s) {
  for (const b of [L.player, L.decoy]) {
    if (!b || b.dead || !rectsOverlap(b, s)) continue;
    if (b.y + b.h / 2 < s.y + s.h / 2) { b.y = s.y - b.h; b.vy = Math.min(b.vy, 0); continue; }
    const nx = b.x + b.w / 2 < s.x + s.w / 2 ? s.x - b.w : s.x + s.w;
    if (!L.map.rectSolid(nx, b.y, b.w, b.h)) b.x = nx; else b.y = s.y + s.h;
  }
}
function carryRiders(plat, dx, dy) {
  const L = plat.level, map = L.map;
  for (const r of [L.player, L.decoy]) {
    if (!r || r.dead || r.vy < 0) continue;
    const gap = Math.abs(r.y + r.h - plat.y);
    const on = r.x + r.w > plat.x - 2 && r.x < plat.x + plat.w + 2 && (gap <= 3 || (r.groundEntity === plat && gap <= 6));
    if (!on) continue;
    if (dx && !map.rectSolid(r.x + dx, r.y, r.w, r.h)) r.x += dx;
    const ny = plat.y + dy - r.h;
    if (!map.rectSolid(r.x, ny, r.w, r.h)) { r.y = ny; if (r.vy > 0) r.vy = 0; }
  }
}
function nearPlayer(e, rx = 220, ry = 150) {
  const p = e.level.player;
  return !!p && Math.abs(p.cx - e.cx) < rx && Math.abs(p.cy - e.cy) < ry;
}
const phaseOf = (L) => L.signals?.phase ?? L.data?.phase ?? 'A';
function hashStr(s) { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

// ============================================================ arte
for (const k of ['A', 'B']) {
  defineImage('w5_pb_' + k, 16, 16, (pc) => {
    const c = PHC[k];
    pc.rect(0, 0, 16, 16, c.md);
    pc.hline(0, 0, 16, c.hi); pc.vline(0, 0, 16, c.lt); pc.hline(0, 15, 16, c.dk); pc.vline(15, 0, 16, c.dk);
    pc.strokeRect(2, 2, 12, 12, c.lt);
    for (let i = 3; i < 13; i += 3) { pc.px(i, 2, GOLD.lt); pc.px(i, 13, GOLD.lt); }
    if (k === 'A') pc.poly([[8, 4], [12, 8], [8, 12], [4, 8]], c.rune); else pc.ellipseOutline(8, 8, 3, 3, c.rune);
    pc.px(8, 8, c.dk);
  });
}
defineImage('w5_ruin', 16, 16, (pc) => {
  pc.rect(0, 0, 16, 16, STONE.md);
  pc.hline(0, 0, 16, STONE.hi); pc.vline(0, 0, 16, STONE.hi); pc.hline(0, 15, 16, STONE.dk); pc.vline(15, 0, 16, STONE.dk);
  pc.hline(1, 7, 14, STONE.dk); pc.vline(7, 1, 6, STONE.dk); pc.vline(10, 8, 7, STONE.dk);
  pc.line(3, 10, 6, 13, STONE.crack); pc.line(11, 2, 13, 5, STONE.crack);
  pc.px(4, 4, GOLD.lt); pc.px(12, 11, GOLD.lt);
});
defineImage('w5_ruin_crack', 16, 16, (pc) => {
  pc.line(2, 1, 7, 8, '#ffffff'); pc.line(7, 8, 5, 15, '#ffffff'); pc.line(7, 8, 14, 10, '#ffffff'); pc.line(10, 0, 9, 5, '#ffffff');
});
defineImage('w5_switch_base', 16, 10, (pc) => {
  pc.rect(2, 4, 12, 6, STONE.md); pc.hline(2, 4, 12, STONE.hi); pc.hline(2, 9, 12, STONE.dk);
  pc.rect(4, 1, 8, 3, GOLD.md); pc.hline(4, 1, 8, GOLD.hi);
  pc.px(5, 6, GOLD.lt); pc.px(10, 6, GOLD.lt);
  pc.outline(OUT);
});
for (const k of ['A', 'B']) {
  defineImage('w5_crystal_' + k, 11, 15, (pc) => {
    const c = PHC[k];
    pc.poly([[5, 0], [10, 6], [5, 14], [0, 6]], c.md);
    pc.poly([[5, 0], [5, 14], [0, 6]], c.lt);
    pc.line(5, 1, 2, 6, c.hi); pc.px(4, 3, '#ffffff');
    pc.outline(OUT);
  });
}
defineImage('w5_peg', 7, 7, (pc) => { pc.circle(3, 3, 3, GOLD.md); pc.circle(2, 2, 1, GOLD.hi); pc.px(3, 3, GOLD.dk); pc.outline(OUT); });
defineImage('w5_spool', 9, 7, (pc) => { pc.rect(1, 1, 7, 5, '#c8306a'); pc.vline(0, 0, 7, GOLD.md); pc.vline(8, 0, 7, GOLD.md); pc.hline(1, 3, 7, '#ff7aa8'); pc.outline(OUT); });
function islandImage(wt) {
  const name = 'w5_island_' + wt;
  if (hasImage(name)) return name;
  const W = wt * TILE;
  defineImage(name, W + 2, 26, (pc) => {
    pc.poly([[1, 2], [W + 1, 2], [W - 6, 14], [W / 2 + 4, 24], [W / 2 - 4, 24], [8, 14]], FAB[3]);
    for (let i = 0; i < wt * 2; i++) pc.rect(1 + i * 8, 1, 8, 6, FAB[i % 5]);
    pc.hline(1, 1, W, '#ffb8d0');
    for (let x = 3; x < W; x += 4) pc.px(x, 7, GOLD.lt);
    for (let i = 0; i < wt * 2; i++) pc.vline(1 + i * 8, 2, 4, '#3a1050');
    pc.line(10, 9, W / 2, 20, '#8a3ac8'); pc.line(W - 8, 9, W / 2 + 2, 19, '#c8306a');
    pc.outline(OUT);
  });
  return name;
}

// ============================================================ j — portal
class Portal extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 14; this.h = 28; this.x = x + 1; this.y = y + TILE - 28;
    this.pair = String(p.pair ?? 'a'); this.cols = PORTAL_COLS[hashStr(this.pair) % PORTAL_COLS.length];
    this.other = null; this.ignore = new Set(); this.z = 6; this.flashT = 0;
    this.light = { r: 34, color: this.cols[0], i: 0.6, flicker: 0.1 };
  }
  init() { this.other = this.level.entities.find((e) => e !== this && e instanceof Portal && e.pair === this.pair) || null; }
  update(dt) {
    this.tickTimers(dt);
    if (this.flashT > 0) this.flashT -= dt;
    if (!this.other || this.other.dead) return;
    const L = this.level;
    for (const b of [L.player, L.decoy]) {
      if (!b || b.dead || b.state === 'dead') continue;
      const inside = rectsOverlap(this, { x: b.x + 3, y: b.y + 4, w: b.w - 6, h: b.h - 8 });
      if (!inside) { this.ignore.delete(b); continue; }
      if (this.ignore.has(b)) continue;
      this.teleport(b);
    }
  }
  teleport(b) {
    const o = this.other, L = this.level;
    let nx = o.cx - b.w / 2, ny = o.y + o.h - b.h - 1;
    if (L.map.rectSolid(nx, ny, b.w, b.h)) ny = o.y;
    L.particles.emit('portal', b.cx, b.cy, 10);
    b.x = nx; b.y = ny; b.groundEntity = null;          // vx/vy preservados (embalo)
    o.ignore.add(b); this.flashT = 0.25; o.flashT = 0.25;
    L.particles.emit('portal', b.cx, b.cy, 12);
    audio.sfx('portal', { vol: 0.6, cooldown: 0.1 });
    if (b === L.player) L.camera.centerOn?.(b.cx, b.cy);
  }
  draw(ctx) {
    const cx = Rn(this.cx), cy = Rn(this.cy);
    VFX.drawPortalSwirl(ctx, cx, cy, 8, this.t, this.cols, { squash: 1.8, arms: 4, alpha: this.other ? 1 : 0.4 });
    ctx.fillStyle = GOLD.lt;
    for (let i = 0; i < 20; i++) {          // moldura de pontos dourados girando
      const a = (i / 20) * TAU + this.t * 0.6;
      ctx.globalAlpha = i % 2 ? 0.5 : 1;
      ctx.fillRect(Rn(cx + Math.cos(a) * 9), Rn(cy + Math.sin(a) * 15), 1, 1);
    }
    if (this.flashT > 0) { ctx.globalAlpha = this.flashT * 3; ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 6, cy - 12, 12, 24); }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ l — cristal da fenda
class RiftSwitch extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 14; this.h = 22; this.x = x + 1; this.y = y + TILE - 22;
    this.hittable = true; this.interactable = true; this.prompt = 'Virar';
    this.cd = 0; this.z = 12; this.pop = 0;
  }
  toggle() {
    if (this.cd > 0) return false;
    const L = this.level, n = phaseOf(L) === 'A' ? 'B' : 'A';
    this.cd = 0.4; this.pop = 0.3;
    L.signal('phase', n);
    L.flash(n === 'A' ? '#ff5a7a' : '#6a9aff', 0.12);
    L.shake(0.15);
    audio.sfx('portal', { pitch: n === 'A' ? 1.25 : 0.85, vol: 0.7 });
    L.particles.emit('sparkle', this.cx, this.y + 6, 10, { colors: [PHC[n].hi, PHC[n].lt, '#ffffff'] });
    return true;
  }
  onHit() { return this.toggle(); }
  interact() { this.toggle(); }
  update(dt) { this.tickTimers(dt); if (this.cd > 0) this.cd -= dt; if (this.pop > 0) this.pop -= dt; }
  drawLight(lt) { lt.add(this.cx, this.y + 6, 30, PHC[phaseOf(this.level)].lt, 0.7, 0.1); }
  draw(ctx) {
    const ph = phaseOf(this.level), x = Rn(this.x), y = Rn(this.y);
    drawImage(ctx, 'w5_switch_base', x - 1, y + 12);
    const bob = Rn(Math.sin(this.t * 2.4) * 1.5) - (this.pop > 0 ? 2 : 0);
    VFX.drawGlow(ctx, x + 7, y + 6 + bob, 10, PHC[ph].lt, 0.35);
    drawImage(ctx, 'w5_crystal_' + ph, x + 2, y - 2 + bob);
  }
}

// ============================================================ m / p — blocos de fase
class PhaseBlock extends Entity {
  constructor(l, x, y, p, which) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p);
    if (!m) { this.dead = true; return; }
    this.which = which;
    this.w = (p.w || m.w) * TILE; this.h = (p.h || m.h) * TILE;
    this.solid = phaseOf(l) === which; this.z = 7; this.alwaysUpdate = true; this.pop = 0;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.pop > 0) this.pop -= dt;
    const want = phaseOf(this.level) === this.which;
    if (want === this.solid) return;
    this.solid = want; this.pop = 0.2;
    this.level.refreshSolids();
    if (want) unstick(this.level, this);
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), c = PHC[this.which];
    ctx.globalAlpha = this.solid ? 1 : 0.2;
    for (let yy = 0; yy < this.h; yy += 16) for (let xx = 0; xx < this.w; xx += 16) drawImage(ctx, 'w5_pb_' + this.which, x + xx, y + yy);
    if (!this.solid) {
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.t * 4); ctx.fillStyle = c.hi;
      const o = Math.floor(this.t * 8) % 4;
      for (let i = o; i < this.w; i += 4) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + this.h - 1, 2, 1); }
      for (let i = o; i < this.h; i += 4) { ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + this.w - 1, y + i, 1, 2); }
    } else { ctx.fillStyle = OUT; ctx.globalAlpha = 1; ctx.fillRect(x, y + this.h, this.w, 1); }
    if (this.pop > 0) { ctx.globalAlpha = this.pop * 4; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, this.w, this.h); }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ q — tirolesa de fio dourado
class ThreadRail extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.ax = x + 8; this.ay = y + 8;
    this.bx = this.ax + (p.dx ?? 8) * TILE; this.by = this.ay + (p.dy ?? 3) * TILE;
    this.len = Math.hypot(this.bx - this.ax, this.by - this.ay) || 1;
    this.ux = (this.bx - this.ax) / this.len; this.uy = (this.by - this.ay) / this.len;
    this.x = Math.min(this.ax, this.bx) - 8; this.y = Math.min(this.ay, this.by) - 8;
    this.w = Math.abs(this.bx - this.ax) + 16; this.h = Math.abs(this.by - this.ay) + 40;
    this.riding = false; this.s = 0; this.v = 0; this.cool = 0; this.z = 40; this.alwaysUpdate = true;
  }
  /** Tudo depois do update do jogador: a posição desenhada é exatamente a do fio. */
  lateUpdate(dt) {
    this.t += dt;
    if (this.cool > 0) this.cool -= dt;
    const L = this.level, p = L.player;
    if (!p) return;
    if (!this.riding) {
      if (this.cool > 0 || p.state !== 'normal' || p.grounded || p.inWater || p.hidden) return;
      const hx = p.cx - this.ax, hy = p.y + 3 - this.ay;
      const s = hx * this.ux + hy * this.uy, d = Math.abs(hx * this.uy - hy * this.ux);
      if (s > 2 && s < this.len - 2 && d < 8) this.grab(p, s);
      return;
    }
    if (p.state !== 'normal') { this.release(p, false); return; }
    if (input.pressed('jump')) { this.release(p, true); return; }
    this.v = clamp(this.v + 560 * this.uy * dt, -330, 330);      // gravidade ao longo do fio
    if (Math.abs(this.v) < 70) this.v = 70 * (Math.sign(this.v) || 1);
    this.s += this.v * dt;
    if (this.s <= 0 || this.s >= this.len) { this.release(p, false); return; }
    const rx = this.ax + this.ux * this.s, ry = this.ay + this.uy * this.s;
    const nx = rx - p.w / 2, ny = ry + 2;
    if (L.map.rectSolid(nx, ny, p.w, p.h)) { this.release(p, false); return; }
    p.x = nx; p.y = ny; p.vx = this.ux * this.v; p.vy = this.uy * this.v;
    p.airJumps = 0; p.canAirDash = true; p.jumping = false; p.grounded = false;
    if (Math.abs(p.vx) > 5) p.facing = Math.sign(p.vx);
    if (Math.random() < dt * 20) L.particles.emit('thread', rx, ry, 1, { speed: [5, 25] });
  }
  grab(p, s) {
    this.riding = true; this.s = s;
    let v = p.vx * this.ux + p.vy * this.uy;
    if (Math.abs(v) < 90) v = Math.abs(this.uy) > 0.15 ? (this.uy > 0 ? 90 : -90) : (p.facing * this.ux >= 0 ? 90 : -90);
    this.v = v;
    audio.sfx('stitch_connect', { vol: 0.5, pitch: 1.3 });
    this.level.particles.emit('thread', p.cx, p.y, 5);
  }
  release(p, jump) {
    this.riding = false; this.cool = 0.35;
    if (jump) { p.vy = -310; p.jumping = true; p.airJumps = 0; p.canAirDash = true; audio.sfx('jump', { pitch: 1.1 }); }
  }
  draw(ctx) {
    VFX.drawThreadLine(ctx, Rn(this.ax), Rn(this.ay), Rn(this.bx), Rn(this.by), this.t, GOLD.lt, { width: 2, glow: 1, stitches: true });
    drawImage(ctx, 'w5_peg', Rn(this.ax) - 3, Rn(this.ay) - 3);
    drawImage(ctx, 'w5_peg', Rn(this.bx) - 3, Rn(this.by) - 3);
    if (this.riding) drawImage(ctx, 'w5_spool', Rn(this.ax + this.ux * this.s) - 4, Rn(this.ay + this.uy * this.s) - 3);
  }
}

// ============================================================ s — ilha de retalhos flutuante
class DriftIsland extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.wt = clamp(p.w ?? 3, 2, 8); this.w = this.wt * TILE; this.h = 8;
    this.ox = x; this.oy = y + 4; this.x = x; this.y = this.oy;
    this.ampX = (p.ax ?? 0) * TILE; this.ampY = (p.ay ?? 1) * TILE;
    this.period = Math.max(0.8, p.period ?? 4); this.lt = (p.phase ?? 0) * this.period;
    this.oneway = true; this.alwaysUpdate = true; this.z = 8; this.drawMargin = 40;
    this.img = islandImage(this.wt);
    this.place();
  }
  place() {
    const k = (TAU * this.lt) / this.period;
    this.nx = this.ox + this.ampX * Math.cos(k); this.ny = this.oy + this.ampY * Math.sin(k);
  }
  update(dt) {
    this.tickTimers(dt);
    this.lt += dt;
    this.place();
    carryRiders(this, this.nx - this.x, this.ny - this.y);
    this.x = this.nx; this.y = this.ny;
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    drawImage(ctx, this.img, x - 1, y - 1);
    ctx.fillStyle = GOLD.lt;
    for (let i = 0; i < 3; i++) {           // fios soltos balançando embaixo
      const bx = x + this.w * (0.3 + i * 0.2), len = 8 + i * 3;
      for (let s = 0; s < len; s += 2) ctx.fillRect(Rn(bx + Math.sin(this.t * 2 + i + s * 0.25) * s * 0.25), y + 20 + s, 1, 2);
    }
  }
}

// ============================================================ u — ruína que desmorona (rebobinável)
const RU_SHAKE = 0.5;
class Ruin extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 16; this.h = 16; this.solid = true; this.z = 8;
    this.rewindable = true; this.sealed = !!p.sealed;
    this.st = 'idle'; this.timer = 0; this.bt = 0; this.popT = 0;
    this.respawnT = p.respawn ?? 6;
    this.pieces = [];
    for (let i = 0; i < 6; i++) this.pieces.push({ sx: (i % 3) * 5 + 1, sy: Math.floor(i / 3) * 7 + 1, vx: ((i * 37) % 21) - 10, vy: -12 - ((i * 53) % 18), s: 5 });
  }
  captureState() { return { st: this.st, timer: this.timer, bt: this.bt }; }
  restoreState(s) {
    const was = this.st;
    this.st = s.st; this.timer = s.timer; this.bt = s.bt;
    this.applySolid();
    if (was === 'broken' && s.st !== 'broken') this.popT = 0.25;
  }
  applySolid() {
    const want = this.st !== 'broken';
    if (want === this.solid) return;
    this.solid = want;
    if (want) unstick(this.level, this);
    this.level.refreshSolids();
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.popT > 0) this.popT -= dt;
    if (this.rewinding) return;
    const L = this.level;
    if (this.st === 'idle') {
      if (standsOn(L.player, this) || standsOn(L.decoy, this)) { this.st = 'shake'; this.timer = RU_SHAKE; audio.sfx('crumble', { pitch: 1.3, vol: 0.45, cooldown: 0.08 }); }
    } else if (this.st === 'shake') {
      this.timer -= dt;
      if (Math.random() < dt * 14) L.particles.emit('portal', this.x + Math.random() * 16, this.y + 14, 1);
      if (this.timer <= 0) {
        this.st = 'broken'; this.bt = 0; this.timer = this.respawnT;
        this.applySolid();
        audio.sfx('crumble', { cooldown: 0.05 });
        L.particles.emit('portal', this.cx, this.cy, 6);
      }
    } else if (this.st === 'broken') {
      this.bt = Math.min(3, this.bt + dt);
      if (this.respawnT > 0 && (this.timer -= dt) <= 0) {
        const blocked = [L.player, L.decoy].some((b) => b && !b.dead && rectsOverlap(b, this));
        if (!blocked) { this.st = 'idle'; this.applySolid(); this.popT = 0.3; audio.sfx('secret_soft', { vol: 0.3, pitch: 1.4 }); }
      }
    }
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.st !== 'broken') {
      const sh = this.st === 'shake' ? Rn(Math.sin(this.t * 70) * (1.3 - this.timer / RU_SHAKE)) : 0;
      drawImage(ctx, 'w5_ruin', x + sh, y);
      if (this.st === 'shake') drawImage(ctx, 'w5_ruin_crack', x + sh, y, { alpha: Math.min(1, 1.2 - this.timer / RU_SHAKE) });
      if (this.popT > 0) { ctx.globalAlpha = this.popT * 2.5; ctx.fillStyle = REW; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1; }
      return;
    }
    ctx.globalAlpha = 0.25; ctx.fillStyle = save.data.abilities?.rewind ? REW : STONE.hi;
    for (let i = 0; i < 16; i += 3) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + 15, 2, 1); ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + 15, y + i, 1, 2); }
    ctx.globalAlpha = 1;
    const bt = this.bt;
    if (bt > 2) return;
    const img = getImage('w5_ruin');
    if (!img) return;
    ctx.globalAlpha = Math.max(0, 1 - bt / 2);      // pedaços sobem para o vazio (função do tempo: rebobina certinho)
    for (const pc of this.pieces) ctx.drawImage(img, pc.sx, pc.sy, pc.s, pc.s, Rn(x + pc.sx + pc.vx * bt), Rn(y + pc.sy + pc.vy * bt - 6 * bt * bt), pc.s, pc.s);
    ctx.globalAlpha = 1;
  }
}

// ============================================================ w — costura de gravidade (corrente ascendente)
class GravitySeam extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p);
    if (!m) { this.dead = true; return; }
    this.w = (p.w || m.w) * TILE; this.h = (p.h || m.h) * TILE;
    this.speed = p.speed ?? 230; this.z = 3; this.inside = false;
    this.motes = [];
    for (let i = 0; i < Math.max(4, Math.round((this.w * this.h) / 120)); i++) this.motes.push({ a: (i * 0.618) % 1, b: (i * 0.37) % 1, sp: 0.7 + ((i * 0.29) % 0.6) });
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level;
    let any = false;
    for (const b of [L.player, L.decoy]) {
      if (!b || b.dead || b.state === 'dead' || b.hidden || !this.overlaps(b)) continue;
      b.vy = Math.max(b.vy - 3200 * dt, -this.speed);
      if (b === L.player) { b.airJumps = 0; b.canAirDash = true; any = true; }
    }
    if (any && !this.inside) audio.sfx('current', { pitch: 1.4, vol: 0.4, cooldown: 0.6 });
    this.inside = any;
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), W = this.w, H = this.h, t = this.t;
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#ff4fd8'; ctx.fillRect(x, y, W, H);
    const cx = x + (W >> 1);
    for (let yy = 0; yy < H; yy += 6) {      // costura dourada em zigue-zague no meio
      const o = ((yy / 6) | 0) % 2 ? 2 : -2;
      ctx.globalAlpha = 0.8; ctx.fillStyle = GOLD.lt; ctx.fillRect(cx + o - 1, y + yy, 2, 4);
      ctx.fillStyle = GOLD.dk; ctx.fillRect(cx - o - 1, y + yy + 2, 2, 1);
    }
    for (const m of this.motes) {
      const k = (m.a + t * 0.6 * m.sp) % 1;
      const yy = y + H - k * H, xx = x + 2 + m.b * (W - 4) + Math.sin(t * 3 + m.a * 20) * 2;
      ctx.globalAlpha = Math.min(1, k * 5, (1 - k) * 5) * 0.8;
      ctx.fillStyle = m.b > 0.5 ? GOLD.hi : '#ff9ad8';
      ctx.fillRect(Rn(xx), Rn(yy), 1, 4);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ registro
registerEntity('w5_portal', Portal);
registerEntity('w5_rift_switch', RiftSwitch);
registerEntity('w5_phase_block_a', class extends PhaseBlock { constructor(l, x, y, p = {}) { super(l, x, y, p, 'A'); } });
registerEntity('w5_phase_block_b', class extends PhaseBlock { constructor(l, x, y, p = {}) { super(l, x, y, p, 'B'); } });
registerEntity('w5_thread_rail', ThreadRail);
registerEntity('w5_drifting_island', DriftIsland);
registerEntity('w5_collapsing_ruin', Ruin);
registerEntity('w5_gravity_seam', GravitySeam);
const W5_LEGEND = {
  j: 'w5_portal', l: 'w5_rift_switch', m: 'w5_phase_block_a', p: 'w5_phase_block_b', q: 'w5_thread_rail',
  s: 'w5_drifting_island', u: 'w5_collapsing_ruin', v: 'unravel_orb', w: 'w5_gravity_seam',
};
registerLegend(5, W5_LEGEND);

// ============================================================ fase de teste
function grid(W, H, ops) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < W) g[y][x] = ch; };
  ops(fill, (x, y, ch) => fill(x, y, x, y, ch));
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w5_mech', world: 0, index: 0, name: 'Teste: Mecânicas da Dimensão', subtitle: 'Mundo 5',
  tileset: 'w5', background: 'w5', music: null, parTime: 120, timeOfDay: 'night',
  legend: W5_LEGEND,
  map: grid(108, 22, (fill, put) => {
    fill(0, 16, 107, 21, '#');
    put(2, 15, 'P');
    put(6, 15, 'j'); fill(18, 9, 23, 10, '#'); put(20, 8, 'j');     // par de portais
    put(28, 15, 'l');                                                // cristal da fenda
    fill(32, 13, 34, 13, 'm'); fill(36, 11, 38, 11, 'p');            // blocos A / B
    fill(40, 9, 42, 9, '#'); put(42, 7, 'q');                        // tirolesa
    fill(58, 16, 70, 21, '.'); put(62, 12, 's');                     // ilha sobre o abismo
    fill(72, 16, 78, 21, '.'); fill(73, 13, 77, 13, 'u');            // ruínas que desmoronam
    put(82, 14, 'v');                                                // orbe da Forma Desfiada
    fill(87, 6, 88, 15, 'w'); fill(89, 5, 95, 15, '#');              // costura → topo alto
    put(104, 15, 'E');
  }),
  props: {
    '6,15': { pair: 'a' }, '20,8': { pair: 'a' },
    '42,7': { dx: 13, dy: 5 },
    '62,12': { w: 3, ax: 2, ay: 1.5, period: 4 },
  },
});
