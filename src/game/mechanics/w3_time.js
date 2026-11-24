// =============================================================================
// mechanics/w3_time.js — Mecânicas do MUNDO 3: CIDADE DOS RELÓGIOS QUEBRADOS.
//
// Legenda do mundo 3 (registerLegend(3,...)); props por célula em `props` da fase:
//  j  w3_clock_platform PLATAFORMA-RELÓGIO vazada que aparece/some no ritmo: props.phase
//                       0 (latão, sólida na 1ª metade do ciclo) | 1 (azinhavre, na 2ª),
//                       props.period = ciclo completo em s (3), props.offset (s),
//                       props.solid (bloco sólido em vez de vazado). Pisca e tiquetaqueia
//                       nos 0.75 s finais. 'j' contíguos na horizontal = uma plataforma.
//  l  w3_clock_hand     PONTEIRO gigante girando no pivô (centro da célula): o lado de
//                       cima é andável (inclinado; íngreme escorrega; quase vertical
//                       derruba). props.len (tiles, 3), props.speed (graus/s, 40; negativo
//                       = anti-horário), props.angle inicial (0 = direita), props.step
//                       (graus por tique) + props.beat (s) = anda aos saltos, props.face=false.
//  m  w3_gear           ENGRENAGEM: props.hazard=true → serra que fere; senão o topo é
//                       plataforma que anda junto com o giro. props.size (diâmetro em
//                       tiles: 3 / serra 2), props.speed (graus/s), props.dx/dy (tiles) +
//                       props.moveSpeed (px/s) = percorre um trilho.
//  p  w3_pendulum       PÊNDULO com lâmina pendurado no teto da célula: props.len (tiles,
//                       4), props.amp (graus, 55), props.period (s, 2.6), props.phase (0..1).
//  q  w3_slow_zone      BOLHA DE TEMPO LENTO (raio props.r tiles = 3): inimigos, projéteis
//                       e mecânicas do mundo 3 dentro dela ×0.35 (props.scale); o Tico
//                       ×0.6 (props.playerScale) — mesma trajetória de pulo, só mais lenta.
//  s  w3_fast_zone      BOLHA DE TEMPO RÁPIDO (×1.8 ambiente, ×1.3 Tico). Mesmas props.
//  u  w3_time_gate      PORTÃO que só abre numa janela do compasso: props.open / props.closed
//                       (s), props.offset (s). Mostrador mostra a fatia aberta (verde).
//                       'u' empilhados = altura; um 'u' sozinho = props.h tiles (3) p/ cima.
//  v  w3_falling_clock  RELÓGIO pendurado (bloco sólido) que DESPENCA quando o Tico passa
//                       por baixo (props.trigger 'below' | 'step' = ao pisar, props.range
//                       tiles). Fere quem estiver embaixo, vira degrau onde cair. REMENDO
//                       TEMPORAL (até ~3 s depois) o devolve ao lugar e ele fica FIXO
//                       (plataforma). props.respawn (s, 8; 0 = nunca) volta sozinho.
//  w  w3_conveyor       ESTEIRA (bloco sólido; props.thin = vazada de 8 px): leva quem está
//                       em cima. props.dir 'r'|'l', props.speed (px/s, 60). 'w' contíguos.
// Escala de tempo exportada: timeScaleAt(level, x, y). Outras entidades podem marcar
// `w3time = true` para ler `this._w3ts` sozinhas em vez de serem desaceleradas.
// Fase de teste: ?level=test_w3_mech&god=1&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, approach, rectsOverlap } from '../../engine/util.js';
import { moveBody } from '../../engine/tilemap.js';
import { defineImage, drawImage, hasImage, defineSprite, drawSprite, hasSprite } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { registerEntity, registerLegend, registerLevel } from '../registry.js';
import { EnemyProjectile } from '../enemies/base.js';

const Rn = Math.round;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
// ---- paleta (coerente com art/tiles_w3.js)
const OUT = '#140c16';
const BRASS = { hi: '#fff0b0', lt: '#f0c860', md: '#c89438', dk: '#8a5a24', sh: '#4e3018' };
const COP = { hi: '#ffb888', lt: '#e07848', md: '#a8502e', dk: '#6a2e20' };
const IRON = { hi: '#a8a4c4', md: '#6a6688', dk: '#3e3a56', sh: '#262238' };
const STEEL = { hi: '#a8a8ec', md: '#5e5eb0', dk: '#363676' };
const CREAM = { hi: '#fff8e4', md: '#f2e2bc', dk: '#c8b08a' };
const PH = [   // cores por fase das plataformas-relógio
  { hi: '#fff0b0', lt: '#f0c860', md: '#c89438', dk: '#8a5a24', face: '#fff8e4' },
  { hi: '#c8fff0', lt: '#6ac8a8', md: '#3a8a7c', dk: '#22584e', face: '#e8fff8' },
];
const SLOWC = ['#b8a8ff', '#ffffff', '#7a6cff'], FASTC = ['#ffd27a', '#ffffff', '#ff9a3c'];
const REW = '#7fe6ff';

registerSfx('w3_swing', { wave: 'noise', freq: 900, dur: 0.28, vol: 0.13, attack: 0.09, filter: { type: 'bandpass', freq: 500, freqEnd: 1700, q: 1.3 } });
registerSfx('w3_slow', [{ wave: 'sine', freq: 760, freqEnd: 190, dur: 0.5, vol: 0.16, vibrato: { rate: 7, depth: 0.5 } }, { wave: 'triangle', freq: 380, freqEnd: 95, dur: 0.5, vol: 0.1 }]);
registerSfx('w3_fast', [{ wave: 'square', freq: 240, freqEnd: 1300, dur: 0.22, vol: 0.09 }, { wave: 'sine', freq: 480, freqEnd: 2000, dur: 0.18, vol: 0.08, delay: 0.04 }]);

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
function circleRect(cx, cy, r, b) {
  const dx = cx - clamp(cx, b.x, b.x + b.w), dy = cy - clamp(cy, b.y, b.y + b.h);
  return dx * dx + dy * dy < r * r;
}
function nearPlayer(e, rx = 220, ry = 150) {
  const p = e.level.player;
  return !!p && Math.abs(p.cx - e.cx) < rx && Math.abs(p.cy - e.cy) < ry;
}
function standsOn(b, s) {
  return !!b && !b.dead && b.vy >= 0 && b.x + b.w > s.x + 1 && b.x < s.x + s.w - 1 && (b.groundEntity === s || (b.grounded && Math.abs(b.y + b.h - s.y) < 1.5));
}
/** Tira jogador/cópia de dentro de um sólido que acabou de surgir. */
function unstick(L, s) {
  for (const b of [L.player, L.decoy]) {
    if (!b || b.dead || !rectsOverlap(b, s)) continue;
    if (b.y + b.h / 2 < s.y + s.h / 2) { b.y = s.y - b.h; b.vy = Math.min(b.vy, 0); continue; }
    const nx = b.x + b.w / 2 < s.x + s.w / 2 ? s.x - b.w : s.x + s.w;
    if (!L.map.rectSolid(nx, b.y, b.w, b.h)) b.x = nx; else b.y = s.y + s.h;
  }
}
/** Leva quem está em cima (mesma regra da plataforma móvel global). */
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
/** Ponteiro/segmento de pixel art: carimbos de quadrados (contorno, corpo, brilho). */
function stampLine(ctx, x0, y0, ang, s0, s1, widthAt, cols) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  for (let pass = 0; pass < 3; pass++) {
    ctx.fillStyle = cols[pass];
    for (let s = s0; s <= s1; s++) {
      const hw = widthAt(s), x = Rn(x0 + ux * s), y = Rn(y0 + uy * s);
      if (pass === 0) ctx.fillRect(x - hw - 1, y - hw - 1, hw * 2 + 3, hw * 2 + 3);
      else if (pass === 1) ctx.fillRect(x - hw, y - hw, hw * 2 + 1, hw * 2 + 1);
      else if (hw > 0) ctx.fillRect(x - hw, y - hw, 1, 1);
    }
  }
}

// ============================================================ campo de tempo (bolhas lenta/rápida)
const zonesOf = (l) => l._w3zones || (l._w3zones = []);
/** Escala de tempo do ambiente no ponto (produto das bolhas que o contêm). */
export function timeScaleAt(l, x, y) {
  const zs = l._w3zones;
  if (!zs || !zs.length) return 1;
  let s = 1;
  for (const z of zs) if (!z.dead && z.has(x, y)) s *= z.env;
  return s;
}
/** Inimigos/projéteis: o update recebe dt escalado (IA, timers, física — tudo junto). */
function patchTime(e) {
  const orig = e.update;
  e.update = function (dt) { return orig.call(this, dt * (this._w3ts ?? 1)); };
  e._w3patched = true;
}
const r6 = (v) => Math.round(v * 1e6) / 1e6;
class TimeField extends Entity {
  constructor(l) {
    super(l, 0, 0, {});
    this.w = 0; this.h = 0; this.alwaysUpdate = true;
    this.pf = 1; this.ws = undefined; this.wg = undefined; this.pvy = 0;
  }
  lateUpdate() {
    const L = this.level, zs = zonesOf(L);
    for (const e of L.entities) {
      if (e.dead || e.isPlayer || e.boss || e.w3time) continue;
      if (!e.enemy && !(e instanceof EnemyProjectile)) continue;
      const s = timeScaleAt(L, e.cx, e.cy);
      if (s !== 1 && !e._w3patched) patchTime(e);
      e._w3ts = s;
    }
    const p = L.player;
    if (!p) return;
    let f = 1;
    if (p.state !== 'dead') for (const z of zs) if (!z.dead && z.has(p.cx, p.cy)) f *= z.ply;
    // aplica/remove o fator em mods sem estragar mudanças feitas por outros sistemas
    const m = p.mods;
    const baseS = m.speed === this.ws ? m.speed / this.pf : m.speed;
    const baseG = m.gravity === this.wg ? m.gravity / (this.pf * this.pf) : m.gravity;
    if (f !== this.pf) {
      p.vy *= f / this.pf;
      if (this.pf === 1) {
        audio.sfx(f < 1 ? 'w3_slow' : 'w3_fast', { vol: 0.5, cooldown: 0.3 });
        L.particles.emit('sparkle', p.cx, p.cy, 6, { colors: f < 1 ? SLOWC : FASTC });
      }
    } else if (f !== 1 && p.vy - this.pvy < -200) p.vy *= f;   // pulo/quique/mola: mesma altura
    if (f < 1) p.vy = Math.min(p.vy, 340 * f);
    m.speed = r6(baseS * f); m.gravity = r6(baseG * f * f);
    this.ws = m.speed; this.wg = m.gravity; this.pf = f; this.pvy = p.vy;
  }
}
function ensureField(l) { if (!l._w3field) { l._w3field = new TimeField(l); l.add(l._w3field); } }

function zoneImage(kind, R, col) {
  const name = `w3_zone_${kind}_${R}`;
  if (hasImage(name)) return name;
  defineImage(name, R * 2 + 3, R * 2 + 3, (pc) => {
    const c = R + 1;
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < R * 2 + 3; y++) for (let x = 0; x < R * 2 + 3; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy), k = d / R;
      if (k > 1) continue;
      const th = (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const ang = Math.atan2(dy, dx);
      if (k > 0.93) pc.px(x, y, col.b + 'c0');
      else if (k > 0.74 && k < 0.82 && ang > -2.6 && ang < -1.7) pc.px(x, y, col.c + 'a0');   // reflexo
      else if (th < 0.08 + k * k * 0.3) pc.px(x, y, col.a + '50');
    }
    for (let i = 0; i < 12; i++) {                  // marcas de hora
      const a = (i / 12) * TAU, r0 = R - 3, r1 = i % 3 === 0 ? R - 7 : R - 5;
      for (let r = r1; r <= r0; r++) pc.px(Rn(c + Math.cos(a) * r - 0.5), Rn(c + Math.sin(a) * r - 0.5), col.c + 'b0');
    }
  });
  return name;
}
class TimeZone extends Entity {
  constructor(l, x, y, p, kind) {
    super(l, x, y, p);
    const slow = kind === 'slow';
    this.kind = kind;
    this.R = Math.round((p.r ?? 3) * TILE); this.ox = x + 8; this.oy = y + 8;
    this.x = this.ox - this.R; this.y = this.oy - this.R; this.w = this.h = this.R * 2;
    this.env = p.scale ?? (slow ? 0.35 : 1.8); this.ply = p.playerScale ?? (slow ? 0.6 : 1.3);
    this.col = slow ? { a: '#7a6cff', b: '#b8a8ff', c: '#e8e0ff' } : { a: '#ff9a3c', b: '#ffd27a', c: '#fff4d8' };
    this.img = zoneImage(kind, this.R, this.col);
    this.z = 2; this.drawMargin = 8;
    this.motes = [];
    for (let i = 0; i < Math.max(4, Math.round(this.R / 5)); i++) this.motes.push({ a: (i * 2.399) % TAU, r: ((i * 0.618) % 1) * (this.R - 8) + 4, s: 0.6 + ((i * 0.37) % 1) * 0.8 });
    zonesOf(l).push(this); ensureField(l);
  }
  has(x, y) { const dx = x - this.ox, dy = y - this.oy; return dx * dx + dy * dy < this.R * this.R; }
  update(dt) { this.tickTimers(dt); }
  onRemove() { const zs = zonesOf(this.level), i = zs.indexOf(this); if (i >= 0) zs.splice(i, 1); }
  draw(ctx) {
    const ox = Rn(this.ox), oy = Rn(this.oy), R = this.R, t = this.t, slow = this.kind === 'slow';
    const wob = Math.sin(t * (slow ? 1.2 : 5)) * 0.6;
    drawImage(ctx, this.img, ox - R - 1, oy - R - 1 + Rn(wob));
    ctx.fillStyle = this.col.c;
    const am = t * (slow ? 0.3 : 5) - Math.PI / 2, ah = t * (slow ? 0.025 : 0.42) - Math.PI / 2;
    ctx.globalAlpha = 0.45;
    for (let s = 0; s < R - 8; s++) ctx.fillRect(Rn(ox + Math.cos(am) * s), Rn(oy + Math.sin(am) * s), 1, 1);
    for (let s = 0; s < R * 0.5; s++) ctx.fillRect(Rn(ox + Math.cos(ah) * s), Rn(oy + Math.sin(ah) * s), 2, 2);
    for (const m of this.motes) {
      const a = m.a + t * m.s * (slow ? 0.3 : 3.4);
      const x = ox + Math.cos(a) * m.r, y = oy + Math.sin(a) * m.r;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + m.a * 3);
      if (slow) ctx.fillRect(Rn(x), Rn(y), 1, 1);
      else for (let k = 0; k < 4; k++) ctx.fillRect(Rn(ox + Math.cos(a - k * 0.06) * m.r), Rn(oy + Math.sin(a - k * 0.06) * m.r), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================ arte fixa
function plateArt(pc, c, kind) {
  const L = kind === 'l' || kind === 's', Rr = kind === 'r' || kind === 's';
  const x0 = L ? 1 : 0, x1 = Rr ? 14 : 15, w = x1 - x0 + 1;
  pc.rect(x0, 1, w, 7, c.md);
  pc.hline(x0, 1, w, c.hi); pc.hline(x0, 2, w, c.lt); pc.hline(x0, 7, w, c.dk);
  for (let i = x0 + 1; i <= x1 - 1; i += 4) pc.rect(i, 8, 2, 2, c.dk);
  for (let i = x0 + 3; i <= x1 - 2; i += 5) pc.px(i, 5, c.dk);
  if (L) { pc.vline(x0, 2, 5, c.lt); pc.px(x0 + 2, 4, c.hi); }
  if (Rr) { pc.vline(x1, 2, 5, c.dk); pc.px(x1 - 2, 4, c.hi); }
  pc.outline(OUT);
}
for (const ph of [0, 1]) {
  for (const k of ['l', 'm', 'r', 's']) defineImage(`w3_cp${ph}_${k}`, 16, 12, (pc) => plateArt(pc, PH[ph], k));
  defineImage(`w3_dial${ph}`, 11, 11, (pc) => {
    pc.circle(5, 5, 4, PH[ph].face); pc.ellipseOutline(5, 5, 4, 4, PH[ph].dk);
    pc.px(5, 2, OUT); pc.px(8, 5, OUT); pc.px(5, 8, OUT); pc.px(2, 5, OUT);
    pc.outline(OUT);
  });
}
defineImage('w3_hub', 11, 11, (pc) => {
  pc.circle(5, 5, 4, BRASS.md); pc.circle(4, 4, 2, BRASS.lt); pc.px(3, 3, BRASS.hi);
  pc.rect(5, 5, 2, 2, BRASS.dk); pc.px(5, 5, OUT);
  pc.outline(OUT);
});
defineImage('w3_pend_mount', 12, 7, (pc) => {
  pc.rect(1, 0, 10, 3, BRASS.md); pc.hline(1, 0, 10, BRASS.hi); pc.hline(1, 2, 10, BRASS.dk);
  pc.rect(4, 3, 4, 3, IRON.md); pc.px(5, 4, IRON.hi); pc.px(2, 1, OUT); pc.px(9, 1, OUT);
  pc.outline(OUT);
});
defineSprite('w3_blade', {
  w: 28, h: 26, ox: 14, oy: 2, anims: { idle: { frames: 1, fps: 1 } },
  draw(pc) {
    pc.rect(13, 1, 2, 6, IRON.md); pc.px(13, 1, IRON.hi);
    for (let y = 8; y < 26; y++) for (let x = 0; x < 28; x++) {
      const dA = Math.hypot(x - 14, y - 7), dB = Math.hypot(x - 14, y - 2);
      if (dA <= 12.5 && dB > 12 && y > 9) pc.px(x, y, dA > 11.3 ? '#ffffff' : x < 14 ? STEEL.hi : STEEL.md);
    }
    pc.circle(14, 11, 6, BRASS.md); pc.circle(13, 10, 4, BRASS.lt); pc.px(11, 8, BRASS.hi); pc.px(12, 8, BRASS.hi);
    pc.circle(14, 11, 2, BRASS.dk); pc.px(14, 11, OUT);
    pc.outline(OUT);
  },
});
function gateDial(q) {
  const name = 'w3_gdial_' + q;
  if (!hasImage(name)) defineImage(name, 13, 13, (pc) => {
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
      const dx = x - 6, dy = y - 6, d = Math.hypot(dx, dy);
      if (d > 5.5) continue;
      const a = (Math.atan2(dx, -dy) + TAU) % TAU;
      pc.px(x, y, d > 4.6 ? CREAM.dk : a / TAU < q / 24 ? '#6ad88a' : '#5a3048');
    }
    pc.px(6, 1, CREAM.hi); pc.px(11, 6, CREAM.hi); pc.px(6, 11, CREAM.hi); pc.px(1, 6, CREAM.hi);
    pc.outline(OUT);
  });
  return name;
}
defineImage('w3_gate_box', 22, 18, (pc) => {
  pc.rect(1, 2, 20, 14, BRASS.md); pc.hline(1, 2, 20, BRASS.hi); pc.hline(1, 3, 20, BRASS.lt); pc.hline(1, 15, 20, BRASS.dk);
  pc.rect(3, 0, 16, 2, COP.md); pc.hline(3, 0, 16, COP.lt);
  pc.px(3, 5, BRASS.hi); pc.px(18, 5, BRASS.hi); pc.px(3, 13, BRASS.dk); pc.px(18, 13, BRASS.dk);
  pc.circle(11, 9, 6, BRASS.dk);
  pc.outline(OUT);
});
function fclockArt(pc, W, cracked) {
  pc.rect(1, 1, W - 2, 14, COP.md);
  pc.hline(1, 1, W - 2, COP.lt); pc.vline(1, 1, 14, COP.lt); pc.hline(1, 14, W - 2, COP.dk); pc.vline(W - 2, 1, 14, COP.dk);
  pc.hline(2, 2, W - 4, BRASS.lt); pc.hline(2, 13, W - 4, BRASS.dk);
  for (let i = 0; i < W / 16; i++) {
    const cx = i * 16 + 8, cy = 8;
    pc.circle(cx, cy, 4, CREAM.md); pc.ellipseOutline(cx, cy, 5, 5, BRASS.md);
    pc.px(cx, cy - 3, OUT); pc.px(cx + 3, cy, OUT); pc.px(cx, cy + 3, OUT); pc.px(cx - 3, cy, OUT);
    pc.line(cx, cy, cx, cy - 2, OUT); pc.line(cx, cy, cx + 2, cy + 1, COP.dk);
    pc.px(cx - 2, cy - 2, '#ffffff');
    if (cracked) { pc.line(cx - 4, cy - 2, cx + 1, cy + 1, '#4a3a44'); pc.line(cx + 1, cy + 1, cx + 3, cy + 4, '#4a3a44'); pc.px(cx + 2, cy - 3, '#4a3a44'); }
  }
  pc.outline(OUT);
}
function fclockImage(wt) {
  const name = 'w3_fclock_' + wt;
  if (!hasImage(name)) {
    defineImage(name, wt * TILE, TILE, (pc) => fclockArt(pc, wt * TILE, false));
    defineImage(name + '_x', wt * TILE, TILE, (pc) => fclockArt(pc, wt * TILE, true));
  }
  return name;
}
function convImage(wt, thin) {
  const name = `w3_conv_${wt}_${thin ? 't' : 'f'}`;
  if (hasImage(name)) return name;
  const W = wt * TILE, H = thin ? 8 : TILE;
  defineImage(name, W, H, (pc) => {
    pc.rect(1, 1, W - 2, 3, '#2e2638');
    if (!thin) {
      pc.rect(1, 4, W - 2, H - 5, IRON.md); pc.hline(1, 4, W - 2, IRON.hi); pc.hline(1, H - 2, W - 2, IRON.dk);
      pc.hline(1, 9, W - 2, BRASS.md); pc.hline(1, 10, W - 2, BRASS.dk);
      for (let i = 4; i < W - 2; i += 8) pc.px(i, 6, IRON.hi);
    } else pc.rect(1, 4, W - 2, 3, IRON.md);
    for (const cx of [4, W - 5]) { pc.circle(cx, 3, 3, IRON.dk); pc.circle(cx, 3, 1, BRASS.lt); }
    pc.outline(OUT);
  });
  return name;
}
/** Engrenagem pré-renderizada em quadros (luz fixa de cima-esquerda). */
function gearSprite(D, saw) {
  const name = `w3_gear_${D}_${saw ? 's' : 'p'}`;
  if (hasSprite(name)) return name;
  const R = D / 2, S = D + 4, c = S / 2;
  const teeth = saw ? Math.max(8, Math.round(D * 0.4)) : Math.max(8, Math.round(D * 0.25 / 4) * 4);
  const spokes = 4, N = saw ? 6 : 12;
  const period = saw ? TAU / teeth : TAU / spokes;   // quadros cobrem um período visual
  defineSprite(name, {
    w: S, h: S, ox: c, oy: c, anims: { spin: { frames: N, fps: 1 } },
    meta: () => ({ period, frames: N }),
    draw(pc, a, f) {
      const off = (f / N) * period, depth = saw ? 4 : 3, hub = Math.max(3, R * 0.24), rimIn = R - depth - 3;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy);
        if (r > R + 0.5) continue;
        const th = Math.atan2(dy, dx) - off;
        const u = (((th / (TAU / teeth)) % 1) + 1) % 1;
        const outer = saw ? R - depth * u : (u > 0.18 && u < 0.68 ? R : R - depth);
        if (r > outer) continue;
        if (!saw && r < rimIn - 1 && r > hub + 2) {
          const v = (((th / (TAU / spokes)) % 1) + 1) % 1;
          if (v > 0.2 && v < 0.8) continue;
        }
        const lit = -(dx + dy) / (r * 1.414 + 0.001);
        let col;
        if (saw) col = r > outer - 2.2 ? (lit > 0.1 ? '#ffffff' : STEEL.hi) : r < hub ? (lit > 0 ? '#ff7a5a' : '#c83a3a') : lit > 0.35 ? IRON.hi : lit < -0.35 ? IRON.dk : IRON.md;
        else col = r < hub ? (lit > 0 ? BRASS.hi : BRASS.lt) : r > rimIn ? (lit > 0.45 ? BRASS.hi : lit > 0 ? BRASS.lt : lit > -0.45 ? BRASS.md : BRASS.dk) : (lit > 0 ? BRASS.md : BRASS.dk);
        pc.px(x, y, col);
      }
      pc.rect(Math.floor(c) - 1, Math.floor(c) - 1, 2, 2, OUT);
      pc.outline(OUT);
    },
  });
  return name;
}

// ============================================================ j — plataforma-relógio
class ClockPlatform extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { vert: false });
    if (!m) { this.dead = true; return; }
    this.w = (p.w || m.w) * TILE; this.h = 10;
    this.phase = p.phase ? 1 : 0; this.period = Math.max(0.6, p.period ?? 3);
    this.lt = p.offset ?? 0; this.on = null; this.remain = 0; this.pop = 0;
    this.useSolid = !!p.solid; this.z = 8; this.alwaysUpdate = true;
    this.sync(true);
  }
  sync(init) {
    const k = (((this.lt / this.period) % 1) + 1) % 1;
    const on = (k < 0.5) === (this.phase === 0);
    this.remain = (0.5 - (k % 0.5)) * this.period;
    if (on === this.on) return;
    this.on = on;
    if (this.useSolid) this.solid = on; else this.oneway = on;
    if (init) return;
    const L = this.level, p = L.player;
    L.refreshSolids();
    if (!on && p && p.groundEntity === this) p.groundEntity = null;
    if (on && this.useSolid) unstick(L, this);
    if (nearPlayer(this)) audio.sfx('clock_tick', { pitch: on ? 1.25 : 0.8, vol: 0.45, cooldown: 0.05 });
    L.particles.emit(on ? 'sparkle' : 'dust', this.cx, this.y + 4, 3, { colors: [PH[this.phase].lt, PH[this.phase].hi] });
    this.pop = 0.18;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.pop > 0) this.pop -= dt;
    const prev = this.remain;
    this.lt += dt * timeScaleAt(this.level, this.cx, this.cy);
    this.sync(false);
    if (this.on && this.remain < 0.75 && Math.floor(this.remain / 0.25) !== Math.floor(prev / 0.25) && nearPlayer(this, 160, 110)) audio.sfx('clock_tick', { vol: 0.22, pitch: 1.6, cooldown: 0.05 });
  }
  draw(ctx) {
    const c = PH[this.phase], x = Rn(this.x), y = Rn(this.y), W = this.w;
    const half = this.period / 2, frac = 1 - this.remain / half;
    if (this.on) {
      const warn = this.remain < 0.6;
      const sh = warn ? Rn(Math.sin(this.t * 80) * 0.8) : 0;
      ctx.globalAlpha = warn && Math.floor(this.remain * 12) % 2 === 0 ? 0.4 : 1;
      for (let i = 0; i < W; i += 16) {
        const k = W <= 16 ? 's' : i === 0 ? 'l' : i + 16 >= W ? 'r' : 'm';
        drawImage(ctx, `w3_cp${this.phase}_${k}`, x + i + sh, y - 1);
      }
      if (this.pop > 0) { ctx.globalAlpha = this.pop * 4; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, W, 7); }
      ctx.globalAlpha = 1;
      this.drawDial(ctx, x + (W >> 1) + sh, y + 3, frac, 1);
    } else {
      ctx.globalAlpha = 0.7; ctx.fillStyle = c.hi;
      for (let i = 0; i < W; i += 4) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + 8, 2, 1); }
      ctx.fillRect(x, y, 1, 9); ctx.fillRect(x + W - 1, y, 1, 9);
      ctx.globalAlpha = 1;
      this.drawDial(ctx, x + (W >> 1), y + 3, frac, 0.55);
    }
  }
  drawDial(ctx, cx, cy, frac, alpha) {
    ctx.globalAlpha = alpha;
    drawImage(ctx, `w3_dial${this.phase}`, cx - 5, cy - 5);
    const a = frac * TAU - Math.PI / 2;
    ctx.fillStyle = OUT;
    for (let s = 0; s <= 3; s++) ctx.fillRect(Rn(cx + Math.cos(a) * s), Rn(cy + Math.sin(a) * s), 1, 1);
    ctx.globalAlpha = 1;
  }
}

// ============================================================ l — ponteiro giratório
class ClockHand extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.px0 = x + 8; this.py0 = y + 8;
    this.len = Math.max(1, p.len ?? 3) * TILE;
    this.ang = (p.angle ?? 0) * DEG; this.a0 = this.ang; this.prevAng = this.ang;
    this.speed = (p.speed ?? 40) * DEG;
    this.step = p.step ? Math.abs(p.step) * DEG : 0; this.beat = Math.max(0.2, p.beat ?? 1); this.lt = 0; this.bi = 0;
    this.face = p.face !== false;
    const r = this.len + 10;
    this.x = this.px0 - r; this.y = this.py0 - r; this.w = this.h = r * 2;
    this.riding = false; this.prevD = null; this.z = 9; this.alwaysUpdate = true;
    if (this.face) this.faceImg = this.makeFace();
  }
  makeFace() {
    const R = this.len + 6, name = 'w3_face_' + R;
    if (!hasImage(name)) defineImage(name, R * 2 + 1, R * 2 + 1, (pc) => {
      pc.circle(R, R, R, CREAM.md + '30'); pc.ellipseOutline(R, R, R, R, BRASS.dk + 'b0'); pc.ellipseOutline(R, R, R - 1, R - 1, BRASS.md + '70');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        for (let r = R - (i % 3 ? 3 : 5); r <= R - 2; r++) pc.px(Rn(R + Math.cos(a) * r), Rn(R + Math.sin(a) * r), BRASS.lt + 'c0');
      }
    });
    return name;
  }
  update(dt) {
    this.tickTimers(dt);
    const d = dt * timeScaleAt(this.level, this.px0, this.py0);
    this.prevAng = this.ang;
    if (this.step) {
      this.lt += d;
      const bi = Math.floor(this.lt / this.beat), fr = (this.lt % this.beat) / this.beat;
      const e = Math.min(1, fr / 0.2), ee = 1 - (1 - e) * (1 - e);
      this.ang = this.a0 + this.step * (bi + ee) * (this.speed < 0 ? -1 : 1);
      if (bi !== this.bi) { this.bi = bi; if (nearPlayer(this)) audio.sfx('clock_tick', { vol: 0.4, cooldown: 0.05 }); }
    } else this.ang += this.speed * d;
  }
  /** Montaria: depois de todos os updates (o topo do ponteiro é uma rampa que gira). */
  lateUpdate(dt) {
    const L = this.level, p = L.player;
    if (!p) return;
    const ux = Math.cos(this.ang), uy = Math.sin(this.ang);
    const tipX = this.px0 + ux * this.len;
    const xa = Math.min(this.px0, tipX), xb = Math.max(this.px0, tipX);
    const flat = Math.abs(ux) > 0.42;
    const slope = flat ? uy / ux : 0;
    const yAt = (x) => this.py0 + (x - this.px0) * slope - 3;
    const cx = clamp(p.cx, xa, xb), foot = p.y + p.h;
    let snap = false;
    if (flat && p.cx >= xa - 3 && p.cx <= xb + 3 && p.vy >= 0 && !(p.dropT > 0) && !p.inWater && p.state !== 'dead') {
      const d = foot - yAt(cx);
      snap = this.riding ? d >= -6 && d <= 10 : d >= -1.5 && d <= 12 && this.prevD !== null && this.prevD <= 2.5;
    }
    if (snap) {
      if (this.riding) {          // o ponto sob os pés gira junto
        const r = (cx - this.px0) / ux;
        const ddx = r * (Math.cos(this.ang) - Math.cos(this.prevAng));
        if (ddx && !L.map.rectSolid(p.x + ddx, p.y, p.w, p.h)) p.x += ddx;
      }
      const ny = yAt(clamp(p.cx, xa, xb)) - p.h;
      if (L.map.rectSolid(p.x, ny, p.w, p.h)) snap = false;
      else {
        if (!this.riding && p.vy > 120) p.onLand?.(p.vy);
        this.riding = true;
        p.y = ny; p.vy = 0; p.jumping = false;
        p.grounded = true; p.onOneWay = true; p.groundEntity = this;
        if (Math.abs(slope) > 0.9) p.vx = approach(p.vx, Math.sign(slope) * 170, 900 * dt);
      }
    }
    if (!snap && this.riding) { this.riding = false; if (p.groundEntity === this) p.groundEntity = null; }
    this.prevD = p.y + p.h - yAt(clamp(p.cx, xa, xb));
  }
  draw(ctx) {
    const ox = this.px0, oy = this.py0, L = this.len;
    if (this.faceImg) drawImage(ctx, this.faceImg, ox - L - 6, oy - L - 6);
    const tipLen = 8;
    const widthAt = (s) => (s < -4 ? 2 : s < L - tipLen ? 1 : Math.max(0, Math.round((L - s) * 0.42)));
    stampLine(ctx, ox, oy, this.ang, -9, L, widthAt, [OUT, this.riding ? STEEL.hi : STEEL.md, '#e0e0ff']);
    drawImage(ctx, 'w3_hub', Rn(ox) - 5, Rn(oy) - 5);
  }
}

// ============================================================ m — engrenagem (plataforma ou serra)
class Gear extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.saw = !!p.hazard;
    this.D = Math.max(1, p.size ?? (this.saw ? 2 : 3)) * TILE; this.R = this.D / 2;
    this.gx0 = x + 8; this.gy0 = y + 8; this.gx = this.gx0; this.gy = this.gy0;
    this.spd = (p.speed ?? (this.saw ? 240 : 50)) * DEG; this.rot = 0;
    this.ex = (p.dx || 0) * TILE; this.ey = (p.dy || 0) * TILE; this.plen = Math.hypot(this.ex, this.ey);
    this.mspd = p.moveSpeed ?? 40; this.s = 0; this.dir = 1; this.wait = 0;
    this.spr = gearSprite(this.D, this.saw);
    this.alwaysUpdate = this.plen > 0; this.z = this.saw ? 30 : 7; this.drawMargin = this.D;
    if (!this.saw) this.oneway = true;
    this.layout();
  }
  layout() {
    if (this.saw) { this.x = this.gx - this.R; this.y = this.gy - this.R; this.w = this.h = this.D; return; }
    const hw = Math.round(this.R * 0.62);
    this.x = this.gx - hw; this.w = hw * 2; this.y = this.gy - this.R + 1; this.h = 6;
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, d = dt * timeScaleAt(L, this.gx, this.gy);
    this.rot += this.spd * d;
    let nx = this.gx, ny = this.gy;
    if (this.plen > 0) {
      if (this.wait > 0) this.wait -= d;
      else {
        this.s += this.dir * this.mspd * d;
        if (this.s >= this.plen) { this.s = this.plen; this.dir = -1; this.wait = 0.4; }
        else if (this.s <= 0) { this.s = 0; this.dir = 1; this.wait = 0.4; }
      }
      const k = this.s / this.plen, e = k * k * (3 - 2 * k);
      nx = this.gx0 + this.ex * e; ny = this.gy0 + this.ey * e;
    }
    const ddx = nx - this.gx, ddy = ny - this.gy;
    this.gx = nx; this.gy = ny;
    if (!this.saw) {
      this.layout();
      this.y -= ddy;                                   // carry usa o topo antigo
      carryRiders(this, ddx + this.spd * this.R * d * 0.8, ddy);   // topo girando = esteira
      this.layout();
    } else {
      this.layout();
      const p = L.player;
      if (p && p.state !== 'dead' && circleRect(this.gx, this.gy, this.R - 2, p)) p.hurt(1, { cx: this.gx, cy: this.gy, x: this.gx });
      if (Math.random() < dt * 6 && nearPlayer(this, 200, 140)) L.particles.emit('hit', this.gx + Math.cos(this.rot) * this.R, this.gy + Math.sin(this.rot) * this.R, 1, { colors: ['#ffd27a', '#ffffff'] });
    }
  }
  draw(ctx) {
    if (this.plen > 0) {           // trilho
      ctx.globalAlpha = 0.35; ctx.fillStyle = IRON.dk;
      const n = Math.max(1, Math.round(this.plen / 6));
      for (let i = 0; i <= n; i++) ctx.fillRect(Rn(this.gx0 + this.ex * i / n) - 1, Rn(this.gy0 + this.ey * i / n) - 1, 3, 3);
      ctx.globalAlpha = 1;
    }
    const meta = { period: this.saw ? TAU / Math.max(8, Math.round(this.D * 0.4)) : TAU / 4, frames: this.saw ? 6 : 12 };
    const k = (((this.rot / meta.period) % 1) + 1) % 1;
    drawSprite(ctx, this.spr, 'spin', Math.floor(k * meta.frames) % meta.frames, this.gx, this.gy);
  }
}

// ============================================================ p — pêndulo com lâmina
class Pendulum extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.ax = x + 8; this.ay = y + 1;
    this.len = Math.max(1, p.len ?? 4) * TILE; this.amp = (p.amp ?? 55) * DEG;
    this.period = Math.max(0.6, p.period ?? 2.6); this.lt = (p.phase ?? 0) * this.period;
    const r = this.len + 16;
    this.x = this.ax - r; this.y = this.ay; this.w = r * 2; this.h = r + 8;
    this.alwaysUpdate = true; this.z = 45; this.prevSign = 0;
    this.sync();
  }
  sync() {
    this.ang = this.amp * Math.sin((TAU * this.lt) / this.period);
    this.bx = this.ax + Math.sin(this.ang) * this.len; this.by = this.ay + Math.cos(this.ang) * this.len;
    this.hx = this.ax + Math.sin(this.ang) * (this.len + 12); this.hy = this.ay + Math.cos(this.ang) * (this.len + 12);
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level;
    this.lt += dt * timeScaleAt(L, this.bx, this.by);
    this.sync();
    const sg = Math.sign(this.ang);
    if (sg && sg !== this.prevSign) {
      if (this.prevSign && nearPlayer(this, 200, 160)) audio.sfx('w3_swing', { vol: 0.5, cooldown: 0.1 });
      this.prevSign = sg;
    }
    const p = L.player;
    if (p && p.state !== 'dead' && circleRect(this.hx, this.hy, 10, p)) p.hurt(1, { cx: this.hx, cy: this.hy, x: this.hx });
  }
  draw(ctx) {
    const n = Math.max(2, Math.floor(this.len / 5));
    for (let i = 1; i <= n; i++) {
      const k = i / n, x = Rn(this.ax + (this.bx - this.ax) * k), y = Rn(this.ay + (this.by - this.ay) * k);
      ctx.fillStyle = OUT; ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = i % 2 ? IRON.hi : IRON.md; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    drawImage(ctx, 'w3_pend_mount', Rn(this.ax) - 6, Rn(this.ay) - 1);
    const sp = Math.abs(Math.cos((TAU * this.lt) / this.period));   // rastro no meio do balanço
    if (sp > 0.6) drawSprite(ctx, 'w3_blade', 'idle', 0, this.bx - Math.sign(this.ang || 1) * 0, this.by, { rotation: -this.ang * 0.8, alpha: 0.25 * sp });
    drawSprite(ctx, 'w3_blade', 'idle', 0, this.bx, this.by, { rotation: -this.ang });
  }
}

// ============================================================ u — portão do compasso
class TimeGate extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { horiz: false });
    if (!m) { this.dead = true; return; }
    const ht = m.h > 1 ? m.h : Math.max(1, p.h ?? 3);
    this.x = x + 3; this.w = 10; this.y = m.h > 1 ? y : y + TILE - ht * TILE; this.h = ht * TILE;
    this.openT = Math.max(0.3, p.open ?? 1.6); this.closedT = Math.max(0.3, p.closed ?? 2.4); this.cyc = this.openT + this.closedT;
    this.lt = p.offset ?? 0; this.k = 0; this.isOpen = null; this.remain = 0;
    this.solid = true; this.z = 12; this.alwaysUpdate = true;
    this.dial = gateDial(Math.round((this.openT / this.cyc) * 24));
    this.sync(true);
  }
  sync(init) {
    const ph = ((this.lt % this.cyc) + this.cyc) % this.cyc;
    const open = ph < this.openT;
    this.ph = ph; this.remain = open ? this.openT - ph : this.cyc - ph;
    if (open === this.isOpen) return;
    this.isOpen = open;
    if (init) { this.k = open ? 1 : 0; this.solid = !open; return; }
    if (nearPlayer(this)) audio.sfx(open ? 'clock_chime' : 'gate_open', { vol: open ? 0.4 : 0.35, pitch: open ? 1 : 0.7 });
  }
  update(dt) {
    this.tickTimers(dt);
    const prev = this.remain;
    this.lt += dt * timeScaleAt(this.level, this.cx, this.cy);
    this.sync(false);
    this.k = approach(this.k, this.isOpen ? 1 : 0, 7 * dt);
    const want = this.k < 0.8;
    if (want !== this.solid) {
      this.solid = want; this.level.refreshSolids();
      if (want) {        // fechou com alguém no vão: empurra para o lado mais perto
        const L = this.level;
        for (const b of [L.player, L.decoy]) {
          if (!b || b.dead || !rectsOverlap(b, this)) continue;
          const nx = b.cx < this.cx ? this.x - b.w : this.x + this.w;
          if (!L.map.rectSolid(nx, b.y, b.w, b.h)) b.x = nx;
        }
      }
    }
    if (this.isOpen && this.remain < 0.8 && Math.floor(this.remain / 0.2) !== Math.floor(prev / 0.2) && nearPlayer(this, 160, 120)) audio.sfx('clock_tick', { vol: 0.3, pitch: 1.4, cooldown: 0.05 });
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), H = this.h;
    ctx.fillStyle = OUT; ctx.fillRect(x - 3, y, 3, H); ctx.fillRect(x + 10, y, 3, H);
    ctx.fillStyle = BRASS.md; ctx.fillRect(x - 2, y, 1, H); ctx.fillRect(x + 11, y, 1, H);
    const by0 = y - Rn(this.k * (H - 3));
    const top = Math.max(y, by0), bot = by0 + H;
    if (bot > top) {
      for (const bx of [x + 1, x + 4, x + 7]) {
        ctx.fillStyle = OUT; ctx.fillRect(bx - 1, top, 4, bot - top);
        ctx.fillStyle = IRON.md; ctx.fillRect(bx, top, 2, bot - top);
        ctx.fillStyle = IRON.hi; ctx.fillRect(bx, top, 1, bot - top);
      }
      for (let yy = by0 + 6; yy < bot - 2; yy += 14) {
        if (yy < y) continue;
        ctx.fillStyle = OUT; ctx.fillRect(x, yy - 1, 10, 4);
        ctx.fillStyle = BRASS.lt; ctx.fillRect(x, yy, 10, 2);
      }
      ctx.fillStyle = OUT; ctx.fillRect(x, bot - 3, 10, 3);
      ctx.fillStyle = IRON.hi; for (const bx of [x + 1, x + 4, x + 7]) ctx.fillRect(bx, bot - 2, 2, 2);
    }
    drawImage(ctx, 'w3_gate_box', x - 6, y - 18);
    drawImage(ctx, this.dial, x - 1, y - 15);
    const a = (this.ph / this.cyc) * TAU - Math.PI / 2;
    ctx.fillStyle = OUT;
    for (let s = 0; s <= 4; s++) ctx.fillRect(Rn(x + 5 + Math.cos(a) * s), Rn(y - 9 + Math.sin(a) * s), 1, 1);
    const blink = this.isOpen && this.remain < 0.8 && Math.floor(this.t * 10) % 2;
    ctx.fillStyle = this.isOpen ? (blink ? '#fff4a0' : '#6ad88a') : '#e04848';
    ctx.fillRect(x + 4, y - 20, 2, 2);
  }
}

// ============================================================ v — relógio que despenca (rebobinável)
class FallingClock extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { vert: false });
    if (!m) { this.dead = true; return; }
    this.wt = p.w || m.w; this.w = this.wt * TILE; this.h = TILE;
    this.x0 = x; this.y0 = y;
    this.solid = true; this.rewindable = true; this.weight = true; this.sealed = !!p.sealed;
    this.st = 'hang'; this.timer = 0; this.vy = 0; this.armed = true; this.popT = 0;
    this.trig = p.trigger === 'step' ? 'step' : 'below'; this.range = (p.range ?? 7) * TILE;
    this.respawnT = p.respawn ?? 8; this.z = 9; this.drawMargin = 48;
    this.img = fclockImage(this.wt);
    const tx = Math.floor((x + 8) / TILE), ty = Math.floor(y / TILE);
    this.chainTop = null;
    for (let k = 1; k <= 8; k++) if (l.map.isSolid(tx, ty - k)) { this.chainTop = (ty - k + 1) * TILE; break; }
  }
  captureState() { return { y: this.y, vy: this.vy, st: this.st, timer: this.timer }; }
  restoreState(s) {
    const L = this.level, p = L.player, dy = s.y - this.y;
    if (dy && p && p.state !== 'dead' && p.x + p.w > this.x && p.x < this.x + this.w && Math.abs(p.y + p.h - this.y) < 3 && !L.map.rectSolid(p.x, p.y + dy, p.w, p.h)) p.y += dy;
    this.y = s.y; this.vy = s.vy; this.st = s.st; this.timer = s.timer;
    this.applySolid();
  }
  onRewound() {
    if (this.st !== 'hang' && this.st !== 'shake') return;
    this.st = 'held'; this.y = this.y0; this.vy = 0; this.popT = 0.5;
    this.applySolid();
    audio.sfx('clock_chime', { vol: 0.5, pitch: 1.2 });
    this.level.particles.emit('sparkle', this.cx, this.cy, 8, { colors: [REW, '#ffffff'] });
  }
  applySolid() {
    const want = this.st !== 'gone';
    if (want !== this.solid) { this.solid = want; this.level.refreshSolids(); }
    if (want) unstick(this.level, this);
  }
  near() {
    const p = this.level.player;
    if (!p || p.state === 'dead') return false;
    if (this.trig === 'step') return standsOn(p, this);
    return p.x + p.w > this.x - 4 && p.x < this.x + this.w + 4 && p.y >= this.y + this.h - 2 && p.y - (this.y + this.h) < this.range &&
      this.level.map.los(this.cx, this.y + this.h + 2, p.cx, p.y + 2);
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.popT > 0) this.popT -= dt;
    if (this.rewinding) return;
    const L = this.level, d = dt * timeScaleAt(L, this.cx, this.cy), p = L.player;
    switch (this.st) {
      case 'hang': {
        const n = this.near();
        if (!this.armed && !n) this.armed = true;
        if (this.armed && n) {
          this.st = 'shake'; this.timer = 0.4;
          audio.sfx('clock_tick', { pitch: 0.6, vol: 0.55 }); audio.sfx('crumble', { pitch: 1.5, vol: 0.35 });
        }
        break;
      }
      case 'shake':
        this.timer -= d;
        if (Math.random() < dt * 12) L.particles.emit('dust', this.x + Math.random() * this.w, this.y, 1);
        if (this.timer <= 0) { this.st = 'fall'; this.vy = 30; audio.sfx('thread_snap', { pitch: 0.7, vol: 0.5 }); }
        break;
      case 'fall': {
        this.vy = Math.min(460, this.vy + 1100 * d);
        const dy = this.vy * d;
        const riding = p && p.state !== 'dead' && p.x + p.w > this.x && p.x < this.x + this.w && Math.abs(p.y + p.h - this.y) < 3;
        if (p && p.state !== 'dead' && !riding && p.cy > this.y + this.h / 2 && rectsOverlap({ x: this.x, y: this.y + dy, w: this.w, h: this.h }, p)) {
          p.hurt(1, this);
          const nx = p.cx < this.cx ? this.x - p.w : this.x + this.w;
          if (!L.map.rectSolid(nx, p.y, p.w, p.h)) p.x = nx;
        }
        moveBody(this, 0, dy, L);
        if (riding) p.y = this.y - p.h;
        if (this.grounded) this.land();
        else if (this.y > L.map.height + 40) { this.st = 'gone'; this.timer = this.respawnT; this.applySolid(); }
        break;
      }
      case 'land': case 'gone':
        if (this.respawnT > 0 && (this.timer -= d) <= 0) {
          const home = { x: this.x0, y: this.y0, w: this.w, h: this.h };
          if (!(p && rectsOverlap(p, home))) {
            if (this.st === 'land') L.particles.emit('smoke', this.cx, this.cy, 5);
            this.st = 'hang'; this.y = this.y0; this.vy = 0; this.armed = false; this.popT = 0.4;
            this.applySolid();
            audio.sfx('secret_soft', { vol: 0.3, pitch: 1.3 });
          }
        }
        break;
      default: break;   // 'held': fixo para sempre
    }
  }
  land() {
    const L = this.level;
    this.st = 'land'; this.vy = 0; this.timer = this.respawnT;
    audio.sfx('break_block', { pitch: 0.7, vol: 0.7 }); audio.sfx('clock_chime', { pitch: 0.55, vol: 0.35 });
    L.shake(0.25);
    L.particles.emit('dust', this.cx, this.y + this.h, 8);
    L.particles.emit('hit', this.cx, this.y + this.h - 2, 4, { colors: [BRASS.hi, '#ffffff'] });
    for (const e of L.entities) if (e.enemy && !e.boss && !e.dead && rectsOverlap(e, { x: this.x, y: this.y, w: this.w, h: this.h + 4 })) e.hurt(3, this);
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), x0 = Rn(this.x0), y0 = Rn(this.y0), cxh = x0 + (this.w >> 1);
    const up = this.st === 'hang' || this.st === 'shake' || this.st === 'held';
    if (this.chainTop !== null) {
      const endY = up ? y : this.chainTop + 6;
      for (let yy = this.chainTop; yy < endY - 1; yy += 4) {
        ctx.fillStyle = OUT; ctx.fillRect(cxh - 2, yy, 4, 4);
        ctx.fillStyle = (yy >> 2) % 2 ? IRON.hi : IRON.md; ctx.fillRect(cxh - 1, yy + 1, 2, 2);
      }
    }
    if (!up) {      // contorno de onde ele estava (azul se o Tico conhece o Remendo)
      ctx.globalAlpha = 0.3; ctx.fillStyle = save.data.abilities?.rewind ? REW : CREAM.dk;
      for (let i = 0; i < this.w; i += 3) { ctx.fillRect(x0 + i, y0, 2, 1); ctx.fillRect(x0 + i, y0 + 15, 2, 1); }
      for (let i = 0; i < 16; i += 3) { ctx.fillRect(x0, y0 + i, 1, 2); ctx.fillRect(x0 + this.w - 1, y0 + i, 1, 2); }
      ctx.globalAlpha = 1;
    }
    if (this.st === 'gone') return;
    const sh = this.st === 'shake' ? Rn(Math.sin(this.t * 70)) : 0;
    if (this.st === 'fall') {
      ctx.globalAlpha = 0.3; ctx.fillStyle = CREAM.hi;
      for (let i = 3; i < this.w; i += 5) ctx.fillRect(x + i, y - 8, 1, 6);
      ctx.globalAlpha = 1;
    }
    if (this.st === 'held') {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t * 3); ctx.fillStyle = REW;
      ctx.fillRect(x - 1, y - 1, this.w + 2, this.h + 2); ctx.globalAlpha = 1;
    }
    drawImage(ctx, this.st === 'land' ? this.img + '_x' : this.img, x + sh, y, { alpha: this.popT > 0 && this.st === 'hang' ? 1 - this.popT * 1.5 : 1 });
  }
}

// ============================================================ w — esteira
class Conveyor extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    const m = mergeCells(l, x, y, p, { vert: false });
    if (!m) { this.dead = true; return; }
    this.thin = !!p.thin; this.wt = p.w || m.w;
    this.w = this.wt * TILE; this.h = this.thin ? 8 : TILE;
    if (this.thin) this.oneway = true; else this.solid = true;
    this.dir = p.dir === 'l' ? -1 : 1; this.speed = p.speed ?? 60;
    this.phase = 0; this.z = 8; this.img = convImage(this.wt, this.thin);
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, v = this.dir * this.speed * timeScaleAt(L, this.cx, this.cy);
    this.phase += v * dt;
    for (const b of [L.player, L.decoy]) if (b && b.state !== 'dead' && standsOn(b, this)) moveBody(b, v * dt, 0, L);
    for (const e of L.entities) {
      if (!e.enemy || e.dead || e.boss || e.flying) continue;
      if (e.grounded && Math.abs(e.y + e.h - this.y) < 1.5 && e.x + e.w > this.x && e.x < this.x + this.w && !L.map.rectSolid(e.x + v * dt, e.y, e.w, e.h)) e.x += v * dt;
    }
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), W = this.w;
    drawImage(ctx, this.img, x, y);
    const ph = ((Math.floor(this.phase) % 6) + 6) % 6;
    ctx.fillStyle = '#6a6080';
    for (let i = ph + 2; i < W - 2; i += 6) ctx.fillRect(x + i, y + 1, 2, 1);
    ctx.fillStyle = '#4a4258';
    for (let i = ph + 2; i < W - 2; i += 6) ctx.fillRect(x + i, y + 3, 2, 1);
    if (!this.thin) {
      ctx.fillStyle = '#ffb040';
      const cph = ((Math.floor(this.phase / 3) % 16) + 16) % 16;
      for (let i = 6 + (this.dir > 0 ? cph : 15 - cph) % 16; i < W - 6; i += 16) {
        ctx.globalAlpha = 0.85;
        const d = this.dir;
        ctx.fillRect(x + i, y + 6, 1, 1); ctx.fillRect(x + i + d, y + 7, 1, 1); ctx.fillRect(x + i, y + 8, 1, 1);
        ctx.fillRect(x + i - 2 * d, y + 6, 1, 1); ctx.fillRect(x + i - d, y + 7, 1, 1); ctx.fillRect(x + i - 2 * d, y + 8, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// ============================================================ registro
registerEntity('w3_clock_platform', ClockPlatform);
registerEntity('w3_clock_hand', ClockHand);
registerEntity('w3_gear', Gear);
registerEntity('w3_pendulum', Pendulum);
registerEntity('w3_slow_zone', class extends TimeZone { constructor(l, x, y, p = {}) { super(l, x, y, p, 'slow'); } });
registerEntity('w3_fast_zone', class extends TimeZone { constructor(l, x, y, p = {}) { super(l, x, y, p, 'fast'); } });
registerEntity('w3_time_gate', TimeGate);
registerEntity('w3_falling_clock', FallingClock);
registerEntity('w3_conveyor', Conveyor);
const W3_LEGEND = {
  j: 'w3_clock_platform', l: 'w3_clock_hand', m: 'w3_gear', p: 'w3_pendulum', q: 'w3_slow_zone',
  s: 'w3_fast_zone', u: 'w3_time_gate', v: 'w3_falling_clock', w: 'w3_conveyor',
};
registerLegend(3, W3_LEGEND);

// ============================================================ fase de teste
function grid(W, H, ops) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < W) g[y][x] = ch; };
  ops(fill, (x, y, ch) => fill(x, y, x, y, ch));
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w3_mech', world: 0, index: 0, name: 'Teste: Mecânicas dos Relógios', subtitle: 'Mundo 3',
  tileset: 'w3', background: 'w3', music: null, parTime: 120, timeOfDay: 'dusk',
  legend: W3_LEGEND,
  map: grid(112, 22, (fill, put) => {
    fill(0, 16, 111, 21, '#');
    put(2, 15, 'P');
    fill(5, 15, 10, 15, 'w');                         // esteira →
    fill(13, 16, 24, 21, '.');                        // abismo das plataformas-relógio
    fill(14, 13, 15, 13, 'j'); fill(17, 12, 18, 12, 'j'); fill(20, 13, 21, 13, 'j'); fill(23, 12, 24, 12, 'j');
    put(29, 13, 'm');                                 // engrenagem-plataforma
    put(35, 14, 'm');                                 // serra que corre no trilho
    fill(40, 6, 48, 9, '%'); put(44, 10, 'p');        // pêndulo no teto
    put(44, 14, 'q');                                 // bolha lenta no fundo do balanço
    put(54, 13, 's');                                 // bolha rápida antes do portão
    fill(59, 0, 61, 12, '%'); fill(60, 13, 60, 15, 'u');   // portão do compasso
    fill(66, 16, 75, 21, '.'); put(70, 12, 'l');      // ponteiro sobre o abismo
    put(82, 11, 'v');                                 // relógio que despenca
    fill(85, 12, 89, 15, '%');
    fill(93, 15, 96, 15, 'w');                        // esteira ←
    put(108, 15, 'E');
  }),
  props: {
    '5,15': { dir: 'r', speed: 70 },
    '14,13': { phase: 0, period: 2.4 }, '17,12': { phase: 1, period: 2.4 },
    '20,13': { phase: 0, period: 2.4 }, '23,12': { phase: 1, period: 2.4 },
    '29,13': { size: 3, speed: 50 },
    '35,14': { hazard: true, size: 2, dx: 3, moveSpeed: 45 },
    '44,10': { len: 4, amp: 60, period: 2.2 },
    '44,14': { r: 3 },
    '54,13': { r: 2.5 },
    '60,13': { open: 1.6, closed: 2.4 },
    '70,12': { len: 4, speed: 35 },
    '93,15': { dir: 'l', speed: 50 },
  },
});
