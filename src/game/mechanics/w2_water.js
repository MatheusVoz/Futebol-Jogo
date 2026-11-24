// =============================================================================
// mechanics/w2_water.js — Mecânicas do MUNDO 2: OCEANO DAS LÁGRIMAS.
//
// Legenda do mundo 2 (registerLegend(2,...)); props por célula em `props` da fase:
//  j  w2_current     CORRENTEZA. Retângulo = células 'j' contíguas (ou props.w/h em
//                    tiles). props.dir 'r'|'l'|'u'|'d', props.strength (força px/s²:
//                    ~200 suave, 320 padrão, 520+ impossível de vencer nadando),
//                    props.signal (+props.invert) liga/desliga. Empurra Tico, cópia,
//                    inimigos (não chefes), projéteis e as bolhas de ar. Riscos animados.
//  l  w2_air_bubble  RESPIRADOURO: solta bolhas de ar (props.rate s, props.delay s) que
//                    sobem até a superfície/teto (ou props.h tiles a seco). Tocar uma
//                    bolha = oxigênio cheio. Use em fases `oxygen: true`.
//  m  w2_water_block BLOCO DE ÁGUA flutuante (waterVolume → o Tico nada dentro).
//                    Retângulo de 'm' contíguos (ou props.w/h). props.dx/dy (tiles) +
//                    speed (px/s) + pause (s) = flutua levando o Tico. Afoga (oxygen).
//  p  w2_toy_boat    BARQUINHO: plataforma vazada que boia na superfície (acha a água
//                    abaixo da célula sozinho), afunda um pouco com peso e deriva
//                    props.dx tiles (speed px/s, pause s). props.w = largura (3).
//                    Ponha o 'p' na linha de ar logo acima da água, na ponta esquerda.
//  q  w2_whirlpool   REDEMOINHO: puxa girando para o olho (props.r raio tiles = 3,
//                    strength, spin 1|-1). ~0.5 s no olho → ARREMESSA o Tico para
//                    props.fling 'u'|'d'|'l'|'r' (props.power ≈ px de impulso).
//  s  w2_geyser      GÊISER no chão da célula: borbulha (aviso 0.9 s) e jorra uma coluna
//                    de props.h tiles (padrão: até o teto, máx. 10) por props.burst s a
//                    cada props.period s (props.phase = atraso s; props.always = jato
//                    contínuo, um elevador). Quem sai pelo topo é lançado (props.power).
//  u  w2_bottle      MENSAGEM NA GARRAFA (colecionável persistente por pid): ao tocar
//                    abre props.dialog (id ou falas) ou props.text (+props.who); depois
//                    pode ser relida com "interagir". Boia se estiver na água.
// Fase de teste: ?level=test_w2_mech&god=1&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, approach, rand, makeRng, rectsOverlap } from '../../engine/util.js';
import { T, moveBody, isSolidType } from '../../engine/tilemap.js';
import { defineImage, drawImage, getImage, hasImage, defineSprite, drawSprite } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { EnemyProjectile } from '../enemies/base.js';

const Rn = Math.round;
const TAU = Math.PI * 2;
// ---- paleta (coerente com art/tiles_w2.js)
const OUT = '#081322';
const WAT = { body: '#2a90c6', deep: '#103a72', mid: '#5ec8e8', top: '#a8f4f4', foam: '#e8ffff', mem: '#c8fcff', edge: '#1a64a0' };
const STONE = ['#7cacb0', '#4a7a8e', '#2e5670', '#1b344e'];
const CORAL = { hi: '#ffd6e0', lt: '#ff9ab4', md: '#f0708e', dk: '#c04a72' };
const WOOD = { hi: '#e4b884', lt: '#c08e5a', md: '#9c6c40', dk: '#76502e', gap: '#3a2418' };
const PAINT = { lt: '#ee7a66', md: '#d0544c', dk: '#a03c3c' };
const SAIL = { lt: '#fbf2da', md: '#e4d8b8', dk: '#bcae8e' };
const DIRS = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] };
const DEFAULT_TEXT = 'Um bilhete borrado pelas lágrimas do mar: "Se encontrar isto... não se esqueça de quem te amou."';

registerSfx('w2_geyser', [
  { wave: 'noise', freq: 600, dur: 0.7, vol: 0.2, attack: 0.04, filter: { type: 'bandpass', freq: 700, freqEnd: 2600, q: 0.9 } },
  { wave: 'sine', freq: 110, freqEnd: 48, dur: 0.45, vol: 0.22 },
]);

// ============================================================ utilidades
/** Funde células contíguas do mesmo caractere (canto sup. esq. é o dono).
 *  Retorna {w,h} em tiles, ou null se esta célula pertence a outra. */
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
/** Desloca um corpo sem atravessar tiles sólidos. */
function nudge(e, dx, dy, map) {
  if (dx && !map.rectSolid(e.x + dx, e.y, e.w, e.h)) e.x += dx;
  if (dy && !map.rectSolid(e.x, e.y + dy, e.w, e.h)) e.y += dy;
}
function circleRect(cx, cy, r, b) {
  const dx = cx - clamp(cx, b.x, b.x + b.w), dy = cy - clamp(cy, b.y, b.y + b.h);
  return dx * dx + dy * dy < r * r;
}
const currentsOf = (l) => l._w2cur || (l._w2cur = []);
/** Correnteza ativa no ponto (ou null). */
function currentAt(l, x, y) {
  for (const c of currentsOf(l)) if (!c.dead && c.on && x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return c;
  return null;
}
/** Leva quem está em cima de uma plataforma (jogador e Retalho Fantasma). */
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
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return [ch(16), ch(8), ch(0)];
}

// ============================================================ arte
function bubbleArt(pc, cx, cy, rx, ry) {
  pc.ellipse(cx, cy, rx, ry, '#a8f4f450');
  pc.ellipseOutline(cx, cy, rx, ry, '#e8ffffe0');
  pc.px(cx - rx + 2, cy - 2, '#ffffff'); pc.px(cx - rx + 2, cy - 1, '#ffffff'); pc.px(cx - 2, cy - ry + 2, '#ffffff');
  pc.px(cx + rx - 2, cy + ry - 2, '#7fd6ff');
}
defineImage('w2_bub_a', 13, 13, (pc) => bubbleArt(pc, 6, 6, 6, 5));
defineImage('w2_bub_b', 13, 13, (pc) => bubbleArt(pc, 6, 6, 5, 6));
defineImage('w2_bub_s', 7, 7, (pc) => { pc.ellipseOutline(3, 3, 2, 2, '#e8ffffd0'); pc.px(2, 2, '#ffffff'); });

defineImage('w2_vent', 18, 11, (pc) => {
  pc.ellipse(9, 11, 8, 6, STONE[2]);
  pc.ellipse(8, 10, 6, 4, STONE[1]);
  pc.rect(6, 2, 6, 6, STONE[1]); pc.rect(7, 1, 4, 2, STONE[0]);
  pc.rect(8, 1, 2, 3, '#06101c');
  pc.vline(6, 3, 4, STONE[0]); pc.hline(4, 7, 2, STONE[0]);
  pc.px(3, 8, CORAL.md); pc.px(4, 9, CORAL.dk); pc.px(13, 6, CORAL.lt); pc.px(14, 8, CORAL.md); pc.px(11, 9, '#7ff8ec');
  pc.outline(OUT);
});
defineImage('w2_geyser', 20, 10, (pc) => {
  pc.ellipse(10, 10, 9, 6, STONE[2]);
  pc.ellipse(10, 9, 7, 4, STONE[1]);
  pc.rect(6, 3, 8, 4, STONE[1]); pc.rect(7, 2, 6, 2, '#efd8a0');
  pc.rect(8, 2, 4, 2, '#06101c');
  pc.hline(6, 5, 2, '#fdf0c8'); pc.px(13, 6, '#dabc80'); pc.px(4, 8, '#dabc80');
  pc.px(16, 7, CORAL.md); pc.px(3, 7, CORAL.lt);
  pc.outline(OUT);
});
defineImage('w2_whirl_eye', 11, 11, (pc) => {
  pc.circle(5, 5, 4, '#0a2448'); pc.circle(5, 5, 2, '#04101e');
  pc.ellipseOutline(5, 5, 4, 4, '#5ec8e8'); pc.px(3, 3, '#e8ffff');
});
defineSprite('w2_bottle', {
  w: 12, h: 18, ox: 6, oy: 9, anims: { idle: { frames: 1, fps: 1 } },
  draw(pc) {
    pc.rect(3, 7, 6, 9, '#7fd8c8'); pc.rect(2, 9, 8, 6, '#7fd8c8');
    pc.rect(4, 4, 4, 3, '#6cc4b8');
    pc.rect(4, 1, 4, 3, WOOD.lt); pc.hline(4, 1, 4, WOOD.hi); pc.px(7, 3, WOOD.dk);
    pc.rect(4, 8, 4, 6, SAIL.lt); pc.vline(6, 8, 6, SAIL.dk); pc.hline(4, 11, 4, CORAL.md);
    pc.vline(3, 9, 5, '#e8fff8'); pc.px(4, 5, '#ffffff');
    pc.hline(3, 15, 6, '#3e9a8a');
    pc.outline('#0e2a30');
  },
});
/** Barquinho de brinquedo (casco pintado + convés + vela de papel remendada). */
function paintBoat(pc, W, wet) {
  const o = 2, mx = o + Math.floor(W / 2) - 1;
  pc.rect(mx, 6, 2, 22, WOOD.dk); pc.vline(mx, 6, 22, WOOD.md);
  pc.tri(mx + 2, 7, mx + 2, 25, mx + 15, 25, SAIL.lt);
  pc.line(mx + 3, 10, mx + 3, 24, SAIL.md); pc.line(mx + 3, 24, mx + 13, 24, SAIL.dk);
  pc.rect(mx + 4, 18, 4, 4, CORAL.lt); pc.strokeRect(mx + 4, 18, 4, 4, CORAL.dk);
  pc.tri(mx, 2, mx, 7, mx - 7, 4, CORAL.md); pc.px(mx - 2, 4, CORAL.hi);
  pc.rect(o, 28, W, 3, WOOD.lt); pc.hline(o, 28, W, WOOD.hi);
  for (let i = o + 5; i < o + W - 2; i += 7) pc.vline(i, 29, 2, WOOD.gap);
  pc.poly([[o - 1, 31], [o + W, 31], [o + W - 5, 39], [o + 4, 39]], PAINT.md);
  pc.hline(o, 31, W, PAINT.lt);
  pc.hline(o + 1, 34, W - 2, SAIL.lt); pc.hline(o + 2, 35, W - 4, SAIL.md);
  pc.hline(o + 5, 38, W - 10, PAINT.dk);
  for (let i = o + 6; i < o + W - 6; i += 10) { pc.circle(i, 32, 1, '#f8d462'); }
  pc.outline(OUT);
  if (wet) pc.mapPixels((r, g, b, a) => { const [wr, wg, wb] = mixHex('#000000', WAT.body, 1); return [r * 0.45 + wr * 0.55, g * 0.45 + wg * 0.55, b * 0.45 + wb * 0.55, a * 0.8]; });
}
function boatImage(wt) {
  const name = 'w2_boat_' + wt;
  if (!hasImage(name)) {
    defineImage(name, wt * TILE + 4, 41, (pc) => paintBoat(pc, wt * TILE, false));
    defineImage(name + '_wet', wt * TILE + 4, 41, (pc) => paintBoat(pc, wt * TILE, true));
  }
  return name;
}
function discImage(R) {
  const name = 'w2_whirl_' + R;
  if (!hasImage(name)) {
    defineImage(name, R * 2, R * 2, (pc) => {
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < R * 2; y++) for (let x = 0; x < R * 2; x++) {
        const k = 1 - Math.hypot(x + 0.5 - R, y + 0.5 - R) / R;
        if (k <= 0) continue;
        const th = (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        if (k > 0.5 && th < k) pc.px(x, y, '#04142ca0');
        else if (th < k * 1.6 + 0.08) pc.px(x, y, '#0e3a6688');
      }
    });
  }
  return name;
}

// ============================================================ j — correnteza
class Current extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p);
    if (!m) { this.dead = true; return; }
    this.w = (p.w || m.w) * TILE; this.h = (p.h || m.h) * TILE;
    const d = DIRS[p.dir] || DIRS.r;
    this.dx = d[0]; this.dy = d[1];
    this.strength = p.strength ?? 320;
    this.z = 3; this.inside = false; this.drawMargin = 8;
    const rng = makeRng((x * 7 + y * 13) | 1);
    const n = clamp(Math.round((this.w * this.h) / 70), 6, 120);
    this.streaks = [];
    for (let i = 0; i < n; i++) this.streaks.push({ a: rng(), b: 0.06 + rng() * 0.88, len: 4 + Math.floor(rng() * 8), sp: 0.75 + rng() * 0.55, bub: rng() < 0.16, ph: rng() * TAU });
    currentsOf(l).push(this);
  }
  get on() { const s = this.props.signal; return !s || !!this.level.signals?.[s] !== !!this.props.invert; }
  update(dt) {
    this.tickTimers(dt);
    if (!this.on) { this.inside = false; return; }
    const L = this.level, p = L.player;
    const fx = this.dx * this.strength, fy = this.dy * this.strength;
    const inP = !!p && p.state !== 'dead' && this.overlaps(p);
    if (inP) {
      p.addForce(fx, fy);
      if (!this.inside) audio.sfx('current', { vol: 0.5, cooldown: 0.8 });
      if (Math.random() < dt * 8) L.particles.emit('bubble', p.cx - this.dx * 6, p.cy - this.dy * 6, 1);
    }
    this.inside = inP;
    const k = 0.2 * dt;
    for (const e of L.entities) {
      if (e.dead || e === p || e === this || e.solid || e.oneway || e.boss) continue;
      if (!(e.enemy || e.isDecoy || e instanceof EnemyProjectile || e.currentPush)) continue;
      if (this.overlaps(e)) nudge(e, fx * k, fy * k, L.map);
    }
  }
  draw(ctx) {
    if (!this.on) return;
    const X = this.x, Y = this.y, horiz = this.dx !== 0;
    const span = horiz ? this.w : this.h, across = horiz ? this.h : this.w;
    const sgn = this.dx + this.dy, v = this.strength * 0.3;
    ctx.globalAlpha = 0.07; ctx.fillStyle = WAT.top; ctx.fillRect(X, Y, this.w, this.h);
    for (const s of this.streaks) {
      const run = span + s.len * 2;
      let head = ((s.a * run + this.t * v * s.sp) % run) - s.len;      // -len..span+len
      if (sgn < 0) head = span - head;
      const a0 = Math.max(0, sgn > 0 ? head - s.len : head), a1 = Math.min(span, sgn > 0 ? head : head + s.len);
      if (a1 <= a0) continue;
      const edge = clamp(Math.min(a0, span - a1) / 10, 0, 1);
      const off = Rn(s.b * across + Math.sin(this.t * 2 + s.ph) * 1.2);
      if (s.bub) {
        const hp = clamp(head, 0, span - 2);
        ctx.globalAlpha = 0.55 * edge; ctx.fillStyle = WAT.foam;
        if (horiz) ctx.fillRect(Rn(X + hp), Y + off, 2, 2); else ctx.fillRect(X + off, Rn(Y + hp), 2, 2);
        continue;
      }
      ctx.globalAlpha = 0.42 * edge; ctx.fillStyle = WAT.top;
      if (horiz) ctx.fillRect(Rn(X + a0), Y + off, Rn(a1 - a0), 1); else ctx.fillRect(X + off, Rn(Y + a0), 1, Rn(a1 - a0));
      const hp = clamp(head, a0, a1 - 2);
      ctx.globalAlpha = 0.85 * edge; ctx.fillStyle = WAT.foam;
      if (horiz) ctx.fillRect(Rn(X + hp), Y + off, 2, 1); else ctx.fillRect(X + off, Rn(Y + hp), 1, 2);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ l — respiradouro de bolhas de ar
class AirVent extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const map = l.map, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const wet = map.get(tx, ty) === T.WATER;
    let top = ty;
    const maxUp = p.h ?? (wet ? 18 : 6);
    for (let k = 1; k < maxUp; k++) {
      const t = map.get(tx, ty - k);
      if (isSolidType(t) || (wet && t !== T.WATER)) break;
      top = ty - k;
    }
    this.x = x; this.w = TILE; this.y = top * TILE; this.h = (ty + 1) * TILE - this.y;
    this.bx = x + 8; this.by = (ty + 1) * TILE - 9;
    this.rate = p.rate ?? 1.5; this.timer = p.delay ?? 0.4;
    this.bubs = []; this.puff = 0; this.z = 6; this.drawMargin = 60;
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player;
    if (this.puff > 0) this.puff -= dt;
    if ((this.timer -= dt) <= 0) {
      this.timer += this.rate;
      if (this.bubs.length < 6) {
        this.bubs.push({ x: this.bx, y: this.by, vy: -12, ph: Math.random() * TAU, ox: 0, r: 5, life: 0 });
        this.puff = 0.25;
        if (nearPlayer(this, 160, 120)) audio.sfx('bubble', { vol: 0.25, randomPitch: 0.2, cooldown: 0.2 });
      }
    }
    for (const b of this.bubs) {
      b.life += dt;
      b.vy = approach(b.vy, -34, 40 * dt);
      b.y += b.vy * dt;
      const c = currentAt(L, b.x, b.y);
      if (c) { b.ox = clamp(b.ox + c.dx * c.strength * 0.1 * dt, -56, 56); b.y += c.dy * c.strength * 0.08 * dt; }
      b.x = this.bx + b.ox + Math.sin(b.life * 3 + b.ph) * 2.5;
      if (b.y - b.r < this.y + 2 || L.map.solidAt(b.x, b.y - b.r - 1) || b.life > 14) this.pop(b, false);
      else if (p && p.state !== 'dead' && circleRect(b.x, b.y, b.r + 1, p)) this.pop(b, true);
    }
    this.bubs = this.bubs.filter((b) => !b.dead);
  }
  pop(b, breathe) {
    b.dead = true;
    const L = this.level;
    L.particles.emit('bubble', b.x, b.y, breathe ? 6 : 3);
    if (breathe) {
      const p = L.player;
      p.oxygen = 1;
      audio.sfx('bubble', { vol: 0.6, pitch: 1.3 });
      L.particles.emit('sparkle', p.cx, p.cy - 4, 4, { colors: [WAT.foam, WAT.top, '#ffffff'] });
    }
  }
  draw(ctx) {
    for (const b of this.bubs) {
      if (b.life < 0.35) { drawImage(ctx, 'w2_bub_s', Rn(b.x - 3), Rn(b.y - 3)); continue; }
      drawImage(ctx, (Math.floor(b.life * 4 + b.ph) & 1) ? 'w2_bub_a' : 'w2_bub_b', Rn(b.x - 6), Rn(b.y - 6));
    }
    const sq = this.puff > 0 ? 1 : 0;
    drawImage(ctx, 'w2_vent', this.x - 1, this.by - 1 + sq);
  }
}

// ============================================================ m — bloco de água flutuante
class WaterBlock extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p);
    if (!m) { this.dead = true; return; }
    this.w = (p.w || m.w) * TILE; this.h = (p.h || m.h) * TILE;
    this.waterVolume = true; this.z = 5;
    this.x0 = x; this.y0 = y; this.x1 = x + (p.dx || 0) * TILE; this.y1 = y + (p.dy || 0) * TILE;
    this.len = Math.hypot(this.x1 - this.x0, this.y1 - this.y0);
    this.speed = p.speed || 28; this.pauseT = p.pause ?? 0.8;
    this.s = 0; this.dir = 1; this.wait = this.pauseT;
    if (this.len > 0) this.alwaysUpdate = true;
    this.o2 = null; this.seed = (x * 3 + y * 5) % 97;
  }
  holds(r) { return rectsOverlap(this, { x: r.x + 2, y: r.y + 6, w: r.w - 4, h: r.h - 8 }); }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player;
    this.o2 = p ? p.oxygen : null;
    // empuxo quase neutro: sem nadar, o Tico flutua em vez de afundar e cair pelo fundo
    if (p && p.state !== 'dead' && this.holds(p)) p.addForce(0, -152);
    if (this.len < 1) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    this.s += this.dir * this.speed * dt;
    if (this.s >= this.len) { this.s = this.len; this.dir = -1; this.wait = this.pauseT; }
    else if (this.s <= 0) { this.s = 0; this.dir = 1; this.wait = this.pauseT; }
    const k = this.s / this.len, e = k * k * (3 - 2 * k);
    const nx = this.x0 + (this.x1 - this.x0) * e, ny = this.y0 + (this.y1 - this.y0) * e;
    const ddx = nx - this.x, ddy = ny - this.y;
    for (const r of [p, L.decoy]) if (r && !r.dead && this.holds(r)) nudge(r, ddx, ddy, L.map);
    this.x = nx; this.y = ny;
  }
  /** player.js só mede oxigênio em tiles de água: aqui a água-entidade também afoga. */
  lateUpdate(dt) {
    const L = this.level, p = L.player;
    if (!L.data.oxygen || !p || p.state === 'dead' || this.o2 === null || p._w2o2 === L.time) return;
    if (!rectsOverlap(this, { x: p.x + 3, y: p.y, w: p.w - 6, h: 4 })) return;
    p._w2o2 = L.time;
    p.oxygen = this.o2 - dt / (L.data.oxygenTime || 16);
    if (p.oxygen <= 0) { p.oxygen = 0.35; p.hurt(1, null, { noKnock: true }); }
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), W = this.w, H = this.h, t = this.t;
    ctx.globalAlpha = 0.5; ctx.fillStyle = WAT.body; ctx.fillRect(x, y + 3, W, H - 3);
    ctx.globalAlpha = 0.22; ctx.fillStyle = WAT.deep;
    ctx.fillRect(x, y + (H >> 1), W, H - (H >> 1)); ctx.fillRect(x, y + Rn(H * 0.78), W, H - Rn(H * 0.78));
    // superfície ondulada + espuma
    for (let i = 0; i < W; i++) {
      const o = Rn(Math.sin(i * 0.35 + t * 3.1) * 1.1 + Math.sin(i * 0.13 - t * 1.7) * 0.8);
      ctx.globalAlpha = 0.5; ctx.fillStyle = WAT.body; ctx.fillRect(x + i, y + 2 + o, 1, Math.max(0, 1 - o));
      ctx.globalAlpha = 0.9; ctx.fillStyle = WAT.foam; ctx.fillRect(x + i, y + 1 + o, 1, 1);
      ctx.globalAlpha = 0.45; ctx.fillStyle = WAT.top; ctx.fillRect(x + i, y + 3 + o, 1, 2);
    }
    // membrana nas laterais e no fundo
    ctx.fillStyle = WAT.mem;
    for (let yy = 4; yy < H; yy += 2) {
      const o = Rn(Math.sin((y + yy) * 0.45 + t * 2.6) * 0.7);
      ctx.globalAlpha = 0.6; ctx.fillRect(x + Math.max(0, o), y + yy, 1, 2); ctx.fillRect(x + W - 1 + Math.min(0, o), y + yy, 1, 2);
      ctx.globalAlpha = 0.2; ctx.fillRect(x + 1 + Math.max(0, o), y + yy, 1, 2);
    }
    for (let xx = 0; xx < W; xx += 2) {
      const o = Rn(Math.sin((x + xx) * 0.4 + t * 2.2) * 0.7);
      ctx.globalAlpha = 0.55; ctx.fillRect(x + xx, y + H - 1 + Math.min(0, o), 2, 1);
    }
    // brilhos (cáusticas), bolhinhas subindo e uma gota pingando
    const n = Math.max(2, (W * H) >> 9);
    for (let i = 0; i < n; i++) {
      const hs = ((i * 977 + this.seed * 131) % 1000) / 1000;
      const a = 0.5 + 0.5 * Math.sin(t * 2.4 + hs * 30);
      ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2 + Rn(((hs * 7919) % 1) * (W - 4) + Math.sin(t * 0.7 + i) * 3), y + 6 + Rn(((hs * 3571) % 1) * (H - 10)), 1, 1);
      const k = (t * (0.18 + hs * 0.2) + hs) % 1;
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 * 0.8 : 0.8; ctx.fillStyle = WAT.foam;
      ctx.fillRect(x + 3 + Rn(hs * (W - 6) + Math.sin(t * 3 + i) * 1.2), Rn(y + H - 4 - k * (H - 8)), 1, 1);
    }
    const g = (t * 0.45 + this.seed * 0.01) % 1, gx = x + 4 + (this.seed % Math.max(1, W - 8));
    ctx.fillStyle = WAT.mem;
    if (g < 0.5) { ctx.globalAlpha = 0.8 * (1 - g * 2); ctx.fillRect(gx, Rn(y + H + g * g * 120), 1, 2); }
    else { ctx.globalAlpha = 0.6; ctx.fillRect(gx, y + H, 1, g > 0.8 ? 2 : 1); }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ p — barquinho de brinquedo
class ToyBoat extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const wt = clamp(p.w || 3, 2, 6);
    this.w = wt * TILE; this.h = 6;
    const map = l.map, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    let sy = null;
    for (let k = -1; k <= 10 && sy === null; k++) if (map.get(tx, ty + k) === T.WATER && map.get(tx, ty + k - 1) !== T.WATER) sy = (ty + k) * TILE;
    this.surf = sy ?? (ty + 1) * TILE;
    this.x0 = x; this.x1 = x + (p.dx || 0) * TILE; this.len = Math.abs(this.x1 - this.x0);
    this.speed = p.speed || 20; this.pauseT = p.pause ?? 1; this.s = 0; this.dir = 1; this.wait = 0.6;
    this.y = this.surf - 5; this.sink = 0; this.sinkV = 0; this.wasLoaded = false;
    this.oneway = true; this.alwaysUpdate = true; this.z = 8; this.drawMargin = 40;
    this.img = boatImage(wt);
  }
  loaded() {
    const L = this.level;
    return [L.player, L.decoy].some((r) => r && !r.dead && (r.groundEntity === this || (r.grounded && r.x + r.w > this.x && r.x < this.x + this.w && Math.abs(r.y + r.h - this.y) <= 1.5)));
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level;
    let nx = this.x;
    if (this.len >= 1) {
      if (this.wait > 0) this.wait -= dt;
      else {
        this.s += this.dir * this.speed * dt;
        if (this.s >= this.len) { this.s = this.len; this.dir = -1; this.wait = this.pauseT; }
        else if (this.s <= 0) { this.s = 0; this.dir = 1; this.wait = this.pauseT; }
      }
      const k = this.s / this.len, e = k * k * (3 - 2 * k);
      nx = this.x0 + (this.x1 - this.x0) * e;
    }
    const load = this.loaded();
    if (load && !this.wasLoaded) { this.sinkV += 45; L.particles.emit('splash', this.cx, this.surf, 4, { speed: [30, 70] }); }
    this.wasLoaded = load;
    this.sinkV += ((load ? 3 : 0) - this.sink) * 70 * dt - this.sinkV * 7 * dt;
    this.sink += this.sinkV * dt;
    const bob = Math.sin(this.t * 2.2) * 1.2 + Math.sin(this.t * 0.9 + 1) * 0.6;
    const ny = this.surf - 5 + bob + this.sink;
    carryRiders(this, nx - this.x, ny - this.y);
    const moving = Math.abs(nx - this.x) > 0.05;
    this.x = nx; this.y = ny;
    if (moving && Math.random() < dt * 5) L.particles.emit('bubble', this.dir > 0 ? this.x + 2 : this.x + this.w - 2, this.surf + 3, 1);
  }
  draw(ctx) {
    const img = getImage(this.img), wet = getImage(this.img + '_wet');
    if (!img || !wet) return;
    const x = Rn(this.x) - 2, top = Rn(this.y) - 28;
    const wl = clamp(this.surf + 1 - top, 0, img.height);
    if (wl > 0) ctx.drawImage(img, 0, 0, img.width, wl, x, top, img.width, wl);
    if (wl < img.height) ctx.drawImage(wet, 0, wl, img.width, img.height - wl, x, top + wl, img.width, img.height - wl);
    ctx.globalAlpha = 0.75; ctx.fillStyle = WAT.foam;
    const ph = Math.floor(this.t * 5) % 3;
    for (let i = 1; i < this.w + 2; i += 3) ctx.fillRect(x + i + ph - 1, this.surf, 2, 1);
    ctx.globalAlpha = 1;
  }
}

// ============================================================ q — redemoinho
const FLING_T = 0.45;
class Whirlpool extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.R = Math.round((p.r || 3) * TILE); this.ox = x + 8; this.oy = y + 8;
    this.x = this.ox - this.R; this.y = this.oy - this.R; this.w = this.h = this.R * 2;
    this.strength = p.strength ?? 440;
    this.spin = p.spin === -1 || p.spin === 'ccw' ? -1 : 1;
    const f = DIRS[p.fling || 'u'] || DIRS.u;
    this.fdx = f[0]; this.fdy = f[1]; this.power = p.power ?? 420;
    this.coreT = 0; this.cool = 0; this.flingT = 0; this.ang = 0; this.inside = false;
    this.z = 3; this.img = discImage(this.R);
  }
  update(dt) {
    this.tickTimers(dt);
    this.ang += this.spin * dt * 2.4;
    const L = this.level, p = L.player;
    if (this.cool > 0) this.cool -= dt;
    if (!p || p.state === 'dead') { this.coreT = 0; return; }
    const ux = p.cx - this.ox, uy = p.cy - this.oy, d = Math.hypot(ux, uy) || 0.001;
    const inR = d < this.R && this.cool <= 0;
    if (inR) {
      const k = 1 - d / this.R, pull = this.strength * (0.3 + 0.7 * k);
      const nx = ux / d, ny = uy / d, sw = this.spin * pull * 0.8 * clamp((d / this.R) * 1.6, 0, 1);
      p.addForce(-nx * pull - ny * sw, -ny * pull + nx * sw);
      if (!this.inside) audio.sfx('current', { vol: 0.45, pitch: 0.8, cooldown: 0.6 });
      if (d < 18) this.coreT += dt; else this.coreT = Math.max(0, this.coreT - dt * 0.5);
      if (Math.random() < dt * 10) L.particles.emit('bubble', p.cx, p.cy, 1);
      if (this.coreT >= 0.5) this.fling(p);
    } else this.coreT = Math.max(0, this.coreT - dt);
    this.inside = inR;
  }
  fling(p) {
    const L = this.level;
    this.coreT = 0; this.cool = 1.1; this.flingT = FLING_T;
    p.vx = this.fdx * 150; p.vy = this.fdy * 150;
    p.airJumps = 0; p.canAirDash = true; p.jumping = false;
    audio.sfx('splash_out', { pitch: 1.2 }); audio.sfx('current', { pitch: 1.5, vol: 0.6 });
    L.particles.emit('bubble', this.ox, this.oy, 10, { speed: [20, 60], angle: [0, 360] });
    L.shake(0.15);
  }
  lateUpdate(dt) {
    if (this.flingT <= 0) return;
    this.flingT -= dt;
    const p = this.level.player;
    if (!p || p.state === 'dead') { this.flingT = 0; return; }
    const k = Math.max(0, this.flingT / FLING_T);
    moveBody(p, this.fdx * this.power * k * dt, this.fdy * this.power * k * dt, this.level);
    if (Math.random() < 0.5) this.level.particles.emit('bubble', p.cx, p.cy, 1);
  }
  draw(ctx) {
    const R = this.R, ox = Rn(this.ox), oy = Rn(this.oy);
    drawImage(ctx, this.img, ox - R, oy - R);
    for (let i = 0; i < 28; i++) {          // anel externo de espuma girando
      const th = (i / 28) * TAU + this.ang * 0.45;
      ctx.globalAlpha = i % 2 ? 0.2 : 0.45; ctx.fillStyle = WAT.top;
      ctx.fillRect(Rn(ox + Math.cos(th) * (R - 2)), Rn(oy + Math.sin(th) * (R - 2)), 2, 1);
    }
    for (let a = 0; a < 4; a++) {           // braços em espiral (giram mais rápido perto do olho)
      for (let r = R - 3; r > 5; r -= 1.5) {
        const q = 1 - r / R;
        const th = this.ang * (1 + q * 1.8) + a * (TAU / 4) + this.spin * q * 3.6;
        ctx.globalAlpha = 0.25 + 0.7 * q;
        ctx.fillStyle = q > 0.55 ? WAT.foam : WAT.top;
        ctx.fillRect(Rn(ox + Math.cos(th) * r), Rn(oy + Math.sin(th) * r), 2, q > 0.5 ? 2 : 1);
      }
    }
    ctx.globalAlpha = 1;
    drawImage(ctx, 'w2_whirl_eye', ox - 5, oy - 5);
    if (this.coreT > 0.05) {           // aviso do arremesso: setas na direção
      const k = Math.min(1, this.coreT / 0.5);
      ctx.fillStyle = '#ffffff';
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = k * (Math.floor(this.t * 12 + i) % 3 === 0 ? 1 : 0.5);
        ctx.fillRect(ox + this.fdx * (6 + i * 5) - 1, oy + this.fdy * (6 + i * 5) - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ============================================================ s — gêiser
const JET_V = 330;
class Geyser extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const map = l.map, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const max = Math.max(1, (p.h ?? 11) - 1);
    let n = 0;
    while (n < max && !map.isSolid(tx, ty - n - 1)) n++;
    this.bot = (ty + 1) * TILE; this.H = (n + 1) * TILE;
    this.x = x + 2; this.w = 12; this.y = this.bot - this.H; this.h = this.H;
    this.period = Math.max(1.5, p.period ?? 3.6); this.burst = Math.min(p.burst ?? 1.3, this.period * 0.6);
    this.warn = Math.min(0.9, this.period - this.burst); this.offset = p.phase ?? 0;
    this.always = !!p.always; this.power = p.power ?? 360;
    this.jet = 0; this.st = 'idle'; this.wasIn = false; this.z = 7; this.drawMargin = 32;
  }
  phaseNow() {
    if (this.always) return 'burst';
    const c = (((this.level.time + this.offset) % this.period) + this.period) % this.period;
    if (c >= this.period - this.burst) return 'burst';
    return c >= this.period - this.burst - this.warn ? 'warn' : 'idle';
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player;
    const st = this.phaseNow();
    if (st !== this.st) {
      const near = nearPlayer(this, 240, 200);
      if (st === 'warn' && near) audio.sfx('bubble', { pitch: 0.55, vol: 0.4 });
      if (st === 'burst' && near) { audio.sfx('w2_geyser', { vol: 0.8 }); L.particles.emit('splash', this.cx, this.bot - 6, 10); }
      this.st = st;
    }
    this.jet = approach(this.jet, st === 'burst' ? 1 : 0, (st === 'burst' ? 7 : 4) * dt);
    if (st === 'warn' && Math.random() < dt * 18) L.particles.emit('bubble', this.cx + rand(-4, 4), this.bot - 7, 1);
    const top = this.bot - this.H * this.jet;
    if (st === 'burst' && this.jet > 0.2 && Math.random() < dt * 22) L.particles.emit('splash', this.cx, top + 3, 1);
    const inCol = (b) => b && !b.dead && b.x + b.w > this.x - 1 && b.x < this.x + this.w + 1 && b.y + b.h > top && b.y < this.bot;
    const live = st === 'burst' && this.jet > 0.3;
    if (p && p.state !== 'dead' && live && inCol(p)) {
      p.vy = Math.min(p.vy, -JET_V); p.jumping = false; p.airJumps = 0; p.canAirDash = true;
      this.wasIn = true;
      if (Math.random() < dt * 20) L.particles.emit('splash', p.cx, p.bottom, 1);
    } else if (this.wasIn) {
      this.wasIn = false;
      if (p && live && p.state !== 'dead' && p.bottom <= top + 12) {   // saiu pelo topo: lançamento
        p.vy = -this.power; p.jumping = true;
        audio.sfx('spring', { pitch: 1.4, vol: 0.45 });
        L.particles.emit('splash', p.cx, p.bottom, 6);
      }
    }
    const d = L.decoy;
    if (d && live && inCol(d)) d.vy = Math.min(d.vy ?? 0, -JET_V);
  }
  draw(ctx) {
    const cx = Rn(this.cx), bot = this.bot, t = this.t;
    if (this.jet > 0.02) {
      const top = Rn(bot - this.H * this.jet), hgt = bot - 5 - top;
      if (hgt > 0) {
        for (let yy = top + 3; yy < bot - 5; yy += 4) {
          const o = Rn(Math.sin(yy * 0.2 + t * 14) * 0.8), hh = Math.min(4, bot - 5 - yy);
          ctx.globalAlpha = 0.9; ctx.fillStyle = WAT.edge; ctx.fillRect(cx - 6 + o, yy, 12, hh);
          ctx.fillStyle = WAT.mid; ctx.fillRect(cx - 5 + o, yy, 10, hh);
          ctx.fillStyle = WAT.top; ctx.fillRect(cx - 3 + o, yy, 5, hh);
        }
        ctx.fillStyle = WAT.foam; ctx.globalAlpha = 0.9;
        const sc = (t * 260) % 9;
        for (let yy = bot - 6 - sc; yy > top + 3; yy -= 9) ctx.fillRect(cx - 2 + Rn(Math.sin(yy * 0.3) * 1.5), Rn(yy), 2, 4);
        // coroa de espuma + gotas
        ctx.fillRect(cx - 6, top, 12, 3); ctx.fillRect(cx - 8, top + 2, 3, 2); ctx.fillRect(cx + 5, top + 2, 3, 2);
        ctx.fillStyle = WAT.top; ctx.fillRect(cx - 4, top - 1, 8, 1);
        for (let i = 0; i < 4; i++) {
          const k = (t * 2.2 + i * 0.25) % 1, side = i % 2 ? 1 : -1;
          ctx.globalAlpha = 0.85 * (1 - k); ctx.fillStyle = WAT.foam;
          ctx.fillRect(Rn(cx + side * (4 + k * 10 + i)), Rn(top - 2 - 10 * k + 30 * k * k), 1, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
    const sh = this.st === 'warn' ? Rn(Math.sin(t * 60)) : 0;
    if (this.st === 'warn' && Math.floor(t * 10) % 2) {
      ctx.globalAlpha = 0.8; ctx.fillStyle = WAT.foam; ctx.fillRect(cx - 2, bot - 12 - Rn(Math.random() * 4), 2, 2); ctx.globalAlpha = 1;
    }
    drawImage(ctx, 'w2_geyser', Rn(this.x) - 4 + sh, bot - 10);
  }
}

// ============================================================ u — mensagem na garrafa
class Bottle extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 10; this.h = 14; this.alignToCell(x, y);
    this.got = !!p.pid && save.isCollected(p.pid);
    this.floaty = l.map.get(Math.floor(x / TILE), Math.floor(y / TILE)) === T.WATER;
    if (this.floaty) this.y = y + 1;
    this.baseY = this.y; this.z = 20;
    if (this.got) { this.interactable = true; this.prompt = 'Ler'; }
  }
  update(dt) {
    this.tickTimers(dt);
    this.y = this.baseY + (this.floaty ? Math.sin(this.t * 2) * 2 : 0);
    const p = this.player;
    if (!this.got && p && p.state !== 'dead' && this.overlaps(p)) this.take();
    if (!this.got && Math.random() < dt * 1.5) this.level.particles.emit('sparkle', this.cx + rand(-4, 4), this.cy + rand(-6, 6), 1);
  }
  take() {
    const L = this.level, pid = this.props.pid;
    this.got = true; this.interactable = true; this.prompt = 'Ler';
    if (pid) save.markCollected(pid);
    L.collect('bottle', 1, pid);
    audio.sfx('secret', { vol: 0.6 }); audio.sfx('page_turn');
    L.particles.emit('sparkle', this.cx, this.cy, 10);
    L.particles.emit('bubble', this.cx, this.cy, 5);
    this.read();
  }
  read() {
    const p = this.props;
    const lines = p.dialog || [{ who: p.who || 'narrador', text: p.text || DEFAULT_TEXT }];
    Promise.resolve(this.level.say(lines)).catch((e) => console.error('[w2_bottle]', e));
  }
  interact() { this.read(); }
  draw(ctx) {
    const rot = this.floaty ? Math.sin(this.t * 1.6) * 0.3 : -0.15;
    drawSprite(ctx, 'w2_bottle', 'idle', 0, this.cx, this.cy, { rotation: rot, alpha: this.got ? 0.45 : 1 });
  }
}

// ============================================================ registro
registerEntity('w2_current', Current);
registerEntity('w2_air_bubble', AirVent);
registerEntity('w2_water_block', WaterBlock);
registerEntity('w2_toy_boat', ToyBoat);
registerEntity('w2_whirlpool', Whirlpool);
registerEntity('w2_geyser', Geyser);
registerEntity('w2_bottle', Bottle);
const W2_LEGEND = { j: 'w2_current', l: 'w2_air_bubble', m: 'w2_water_block', p: 'w2_toy_boat', q: 'w2_whirlpool', s: 'w2_geyser', u: 'w2_bottle' };
registerLegend(2, W2_LEGEND);

// ============================================================ fase de teste
function grid(W, H, ops) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < W) g[y][x] = ch; };
  ops(fill, (x, y, ch) => fill(x, y, x, y, ch));
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w2_mech', world: 0, index: 0, name: 'Teste: Mecânicas do Oceano', subtitle: 'Mundo 2',
  tileset: 'w2', background: 'w2', music: null, parTime: 120, oxygen: true, timeOfDay: 'day',
  legend: W2_LEGEND,
  map: grid(106, 28, (fill, put) => {
    fill(0, 12, 9, 27, '#');                      // praia
    put(2, 11, 'P'); put(6, 11, 'u');
    fill(10, 12, 29, 15, '~'); fill(10, 16, 29, 27, '#');   // lagoa do barquinho
    put(10, 11, 'p');
    fill(30, 12, 33, 27, '#'); put(31, 11, 'K');
    fill(34, 12, 75, 24, '~'); fill(34, 25, 75, 27, '#');   // bacia funda
    put(38, 13, 'u');
    fill(44, 12, 61, 14, '%');                    // casco afundado = teto do túnel
    fill(36, 19, 43, 21, 'j');                    // correnteza → túnel
    put(52, 24, 'l');                             // respiradouro no túnel
    put(66, 20, 'q');                             // redemoinho (arremessa para cima)
    put(72, 24, 's');                             // gêiser até a borda alta
    fill(76, 6, 83, 27, '#');
    fill(84, 2, 87, 5, 'm');                      // bloco de água que atravessa o abismo
    fill(96, 6, 105, 27, '#'); put(102, 5, 'E');
  }),
  props: {
    '6,11': { text: 'Garrafa de teste: toque para ler, depois "interagir" para reler.' },
    '10,11': { dx: 15, w: 3, speed: 22 },
    '36,19': { dir: 'r', strength: 300 },
    '66,20': { r: 3, fling: 'u', power: 420 },
    '72,24': { h: 20, period: 3.6, burst: 1.6 },
    '84,2': { dx: 8, speed: 26, pause: 1.2 },
  },
});
