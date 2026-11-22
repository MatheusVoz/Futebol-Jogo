// =============================================================================
// abilities/unstitch.js — DESCOSTURAR A REALIDADE
//
// Habilidade 'unstitch' (custo 25, recarga 1.0 s): pulso de ~4 tiles (deslocado para a
// frente do Tico). Para cada entidade no raio:
//   - hidden === true && reveal()  → reveal()   (ilhós escondidos, baús secretos...)
//   - unstitch(player) → bool      → efeito     (inimigos armored, paredes, armadilhas...)
// Entidades deste módulo:
//   seam_wall    'S'  parede de tecido costurada (sólida, autotile com vizinhas do mesmo
//                     props.group). Descosturada: o bloco CONECTADO inteiro se desfaz em onda,
//                     vira contorno fantasma por props.time||6 s (× duração) e se recostura com
//                     aviso piscando; empurra quem estiver dentro p/ o espaço livre mais próximo.
//                     props.permanent = nunca volta.
//   seam_barrier      membrana mágica brilhante (sólida); descosturar remove PARA SEMPRE
//                     (células vizinhas juntas). props.signal → level.signal(signal,true) ao abrir.
//   seam_trap         armadilha de espinhos costurados (dano por contato, props.damage);
//                     descosturar desarma para sempre.
// Eventos: level.events 'unstitch' (player, hits[]).
// Fase de teste: 'test_ab_unstitch' (?level=test_ab_unstitch&unlock=all).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, rand } from '../../engine/util.js';
import { defineImage, drawImage, getImage } from '../../engine/sprites.js';
import { getParticlePreset } from '../../engine/particles.js';
import { audio } from '../../engine/audio.js';
import { registerAbility, registerEntity, registerLevel } from '../registry.js';
import { getStats } from '../stats.js';
import { buildTestMap } from './stitch.js';
import * as VFX from '../art/vfx.js';

// ----------------------------------------------------------------- ajustes
const COST = 25, COOLDOWN = 1.0;
const RADIUS = 4 * TILE + 8;   // raio do pulso (px)
const FORWARD = 14;            // deslocamento do centro para a frente
const WARN = 1.2;              // aviso antes de recosturar (s)
const LILAC = '#c9a2ff';
const Rn = Math.round;

const dur = () => getStats().duration || 1;
function emit(level, name, x, y, n, ov) {
  level.particles.emit(getParticlePreset(name) ? name : 'thread', x, y, n, ov);
}
const seamIndex = (level) => (level._seamIndex ||= new Map());

// ----------------------------------------------------------------- arte: parede costurada
const PATCH = [
  { base: '#7e5096', light: '#a77bbd', dark: '#5a3470', weave: '#8d5fa6' },   // ameixa
  { base: '#a0607a', light: '#c88aa0', dark: '#74405a', weave: '#ae6e88' },   // rosa antigo
];
const OUT = '#2a1838', SEAM = '#ffd23f', SEAM_D = '#b07818', RUN = '#f4e6c8';
const madeSeam = new Set();
/** Imagem 16×16 da parede para máscara de vizinhos (1=esq 2=dir 4=cima 8=baixo) e cor. */
function seamImg(mask, patch) {
  const name = `seam_wall_${mask}_${patch}`;
  if (madeSeam.has(name)) return name;
  madeSeam.add(name);
  const P = PATCH[patch];
  const L = mask & 1, Rt = mask & 2, U = mask & 4, D = mask & 8;
  defineImage(name, 16, 16, (pc) => {
    pc.rect(0, 0, 16, 16, P.base);
    // trama do tecido
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (((x >> 1) + (y >> 1)) % 2 === 0 && (x + y) % 2 === 0) pc.px(x, y, P.weave);
    }
    // relevo (estofado): luz em cima/esq, sombra embaixo/dir nas bordas expostas
    if (!U) { pc.hline(0, 0, 16, OUT); pc.hline(0, 1, 16, P.light); }
    if (!D) { pc.hline(0, 15, 16, OUT); pc.hline(0, 14, 16, P.dark); }
    if (!L) { pc.vline(0, 0, 16, OUT); pc.vline(1, U ? 0 : 1, U ? 16 : 15, P.light); }
    if (!Rt) { pc.vline(15, 0, 16, OUT); pc.vline(14, U ? 0 : 1, D ? 16 : 14, P.dark); }
    // ponto corrido nas bordas expostas
    for (let i = 3; i < 13; i += 3) {
      if (!U) pc.px(i, 3, RUN), pc.px(i + 1, 3, RUN);
      if (!D) pc.px(i, 12, RUN), pc.px(i + 1, 12, RUN);
      if (!L) pc.px(3, i, RUN), pc.px(3, i + 1, RUN);
      if (!Rt) pc.px(12, i, RUN), pc.px(12, i + 1, RUN);
    }
    // costuras compartilhadas: sulco + meio "X" (o vizinho desenha a outra metade)
    const xs = [3, 8, 13];
    if (Rt) { pc.vline(15, 0, 16, P.dark); for (const y of xs) { pc.px(14, y - 1, SEAM); pc.px(15, y, SEAM); pc.px(14, y + 1, SEAM); pc.px(13, y, SEAM_D); } }
    if (L) { pc.vline(0, 0, 16, P.dark); for (const y of xs) { pc.px(1, y - 1, SEAM); pc.px(0, y, SEAM); pc.px(1, y + 1, SEAM); pc.px(2, y, SEAM_D); } }
    if (D) { pc.hline(0, 15, 16, P.dark); for (const x of xs) { pc.px(x - 1, 14, SEAM); pc.px(x, 15, SEAM); pc.px(x + 1, 14, SEAM); pc.px(x, 13, SEAM_D); } }
    if (U) { pc.hline(0, 0, 16, P.dark); for (const x of xs) { pc.px(x - 1, 1, SEAM); pc.px(x, 0, SEAM); pc.px(x + 1, 1, SEAM); pc.px(x, 2, SEAM_D); } }
    // botãozinho central em blocos isolados (charme de pelúcia)
    if (mask === 0) { pc.circle(8, 8, 2, '#e8c070'); pc.px(7, 8, OUT); pc.px(9, 8, OUT); }
  });
  return name;
}

// ----------------------------------------------------------------- arte: armadilha
function drawTrapImg(pc, armed) {
  // base de tecido (faixa vinho com X dourados)
  pc.rect(0, 7, 16, 3, '#5a1830');
  pc.hline(0, 7, 16, '#8a2848');
  for (let x = 2; x < 16; x += 5) { pc.px(x, 8, '#ffd23f'); pc.px(x + 1, 9, '#ffd23f'); pc.px(x + 1, 8, '#b07818'); pc.px(x, 9, '#b07818'); }
  if (armed) {
    for (const cx of [3, 8, 13]) {
      for (let h = 0; h < 7; h++) {
        const half = Math.floor((h + 1) / 3);
        for (let dx = -half; dx <= half; dx++) pc.px(cx + dx, 6 - (6 - h), dx < 0 ? '#ff6a7a' : dx > 0 ? '#7a1830' : '#c0304a');
      }
      pc.px(cx, 0, '#ffffff');                                     // ponta de alfinete
      pc.px(cx, 3, '#ffd23f'); pc.px(cx, 5, '#ffd23f');            // costura do cone
    }
  } else {
    for (const cx of [3, 8, 13]) { pc.hline(cx - 2, 6, 5, '#8a2848'); pc.px(cx, 5, '#c0304a'); }
    pc.px(5, 4, '#ffd23f'); pc.px(6, 3, '#ffd23f'); pc.px(11, 5, '#ffd23f'); pc.px(12, 4, '#ffd23f');   // fios soltos
  }
  pc.outline(OUT);
}
defineImage('seam_trap_on', 16, 11, (pc) => { pc.translate(0, 1); drawTrapImg(pc, true); });
defineImage('seam_trap_off', 16, 11, (pc) => { pc.translate(0, 1); drawTrapImg(pc, false); });

// ----------------------------------------------------------------- empurrar p/ fora
function blockedAt(level, e, x, y, extra) {
  if (level.map.rectSolid(x, y, e.w, e.h)) return true;
  for (const s of level.solids) {
    if (s === e || s.dead || !(s.solid || (extra && extra(s)))) continue;
    if (x < s.x + s.w && x + e.w > s.x && y < s.y + s.h && y + e.h > s.y) return true;
  }
  return false;
}
/** Move a entidade para a posição livre mais próxima (busca em anéis de 2 px). */
export function pushOut(level, e, extra) {
  if (!blockedAt(level, e, e.x, e.y, extra)) return false;
  const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  for (let r = 2; r <= 80; r += 2) {
    for (const [dx, dy] of dirs) {
      const nx = e.x + dx * r, ny = e.y + dy * r;
      if (!blockedAt(level, e, nx, ny, extra)) {
        e.x = nx; e.y = ny; e.vx = (e.vx || 0) * 0.3; e.vy = Math.min(e.vy || 0, 0);
        emit(level, 'thread', e.cx, e.cy, 6, { colors: [LILAC, '#ffffff'] });
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Base das células costuradas (índice por célula + inundação de vizinhas)
// ============================================================================
class SeamCell extends Entity {
  constructor(level, x, y, props, kind) {
    super(level, x, y, props);
    this.kind = kind;
    this.cellX = Math.round(x / TILE); this.cellY = Math.round(y / TILE);
    this.group = props.group ?? null;
    this.w = 16; this.h = 16;
    this.mask = 0;
    seamIndex(level).set(`${this.cellX},${this.cellY}`, this);
  }
  neighbor(dx, dy) {
    const n = seamIndex(this.level).get(`${this.cellX + dx},${this.cellY + dy}`);
    return n && !n.dead && n.kind === this.kind && n.group === this.group ? n : null;
  }
  computeMask() {
    this.mask = (this.neighbor(-1, 0) ? 1 : 0) | (this.neighbor(1, 0) ? 2 : 0) | (this.neighbor(0, -1) ? 4 : 0) | (this.neighbor(0, 1) ? 8 : 0);
  }
  init() { this.computeMask(); }
  /** Percorre o bloco conectado (BFS), chamando fn(célula, distância). */
  flood(fn, limit = 96) {
    const seen = new Set([this]);
    let frontier = [this], d = 0;
    while (frontier.length && seen.size <= limit) {
      const next = [];
      for (const c of frontier) {
        fn(c, d);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = c.neighbor(dx, dy);
          if (n && !seen.has(n)) { seen.add(n); next.push(n); }
        }
      }
      frontier = next; d++;
    }
  }
  onRemove() {
    const k = `${this.cellX},${this.cellY}`;
    if (seamIndex(this.level).get(k) === this) seamIndex(this.level).delete(k);
  }
  /** Contorno tracejado nas bordas expostas (estado fantasma). */
  dashedEdges(ctx, color, alpha, phase) {
    const x = Rn(this.x), y = Rn(this.y), m = this.mask;
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (let i = 0; i < 16; i++) {
      if (((i + phase) & 3) > 1) continue;
      if (!(m & 4)) ctx.fillRect(x + i, y, 1, 1);
      if (!(m & 8)) ctx.fillRect(x + 15 - i, y + 15, 1, 1);
      if (!(m & 1)) ctx.fillRect(x, y + 15 - i, 1, 1);
      if (!(m & 2)) ctx.fillRect(x + 15, y + i, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// SEAM_WALL — parede costurada
// ============================================================================
class SeamWall extends SeamCell {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props, 'wall');
    this.solid = true;
    this.z = 6;
    this.state = 'closed';      // closed | opening | open
    this.timer = 0;
    this.permanent = !!props.permanent;
    this.openTime = props.time || 6;
    this.patch = (this.cellX + this.cellY) & 1;
    this.pieces = [];
    this.flashT = 0;
    this.gid = 0;
    this.drawMargin = 80;
    this.seed = (this.cellX * 31 + this.cellY * 17) % 53;
  }
  unstitch() {
    if (this.state !== 'closed') return false;
    const gid = this.id;
    this.flood((c, d) => c.beginOpen(d * 0.045, gid));
    return true;
  }
  beginOpen(delay, gid) {
    if (this.state !== 'closed') return;
    this.state = 'opening'; this.timer = delay; this.gid = gid; this.alwaysUpdate = true;
  }
  unravel() {
    this.state = 'open';
    this.solid = false;
    this.timer = this.openTime * dur();
    const img = seamImg(this.mask, this.patch);
    for (let i = 0; i < 4; i++) {
      const sx = (i & 1) * 8, sy = (i >> 1) * 8;
      this.pieces.push({ img, sx, sy, x: this.x + sx + 4, y: this.y + sy + 4, vx: rand(10, 45) * (sx ? 1 : -1), vy: rand(-110, -40), rot: rand(0, 6), vr: rand(5, 11), life: 1 });
    }
    emit(this.level, 'thread', this.cx, this.cy, 4, { colors: ['#ffd23f', '#ffffff', LILAC] });
    emit(this.level, 'unravel_fiber', this.cx, this.cy, 3);
    audio.sfx('unstitch_hit', { cooldown: 0.07, vol: 0.55, randomPitch: 0.1 });
    if (this.permanent) this.removeT = 1.1;
  }
  restitch() {
    this.state = 'closed';
    this.solid = true;
    this.alwaysUpdate = false;
    this.flashT = 0.25;
    const gid = this.gid;
    const extra = (s) => s instanceof SeamWall && s.gid === gid && !s.permanent;
    const p = this.level.player;
    for (const e of [p, ...this.level.entities.filter((o) => o.enemy && !o.dead)]) {
      if (e && e.x < this.x + 16 && e.x + e.w > this.x && e.y < this.y + 16 && e.y + e.h > this.y) pushOut(this.level, e, extra);
    }
    emit(this.level, 'stitch_spark', this.cx, this.cy, 3);
    audio.sfx('stitch_connect', { cooldown: 0.12, vol: 0.45, pitch: 1.35 });
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.state === 'opening') { this.timer -= dt; if (this.timer <= 0) this.unravel(); }
    else if (this.state === 'open' && !this.permanent) {
      this.timer -= dt;
      if (this.timer < WARN && Math.random() < dt * 4) emit(this.level, 'stitch_spark', this.x + rand(0, 16), this.y + rand(0, 16), 1);
      if (this.timer <= 0) this.restitch();
    }
    for (const pc of this.pieces) { pc.vy += 420 * dt; pc.x += pc.vx * dt; pc.y += pc.vy * dt; pc.rot += pc.vr * dt; pc.life -= dt * 1.1; }
    if (this.pieces.length && this.pieces[0].life <= 0) this.pieces = this.pieces.filter((pc) => pc.life > 0);
    if (this.removeT !== undefined) { this.removeT -= dt; if (this.removeT <= 0) this.remove(); }
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.state !== 'open') {
      const sh = this.state === 'opening' ? Rn(Math.sin(this.t * 70)) : 0;
      drawImage(ctx, seamImg(this.mask, this.patch), x + sh, y);
      // brilho viajando pelos pontos dourados (dica de que dá para descosturar)
      const ph = (this.t * 0.5 + this.seed / 53) % 1;
      if (ph < 0.06 && (this.mask & 3)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + (this.mask & 2 ? 15 : 0), y + [3, 8, 13][this.seed % 3], 1, 1);
      }
      if (this.state === 'opening') { ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff3c0'; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1; }
      if (this.flashT > 0) { ctx.globalAlpha = this.flashT / 0.25 * 0.8; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1; }
    } else if (!this.permanent) {
      const warn = this.timer < WARN;
      const ph = Math.floor(this.t * 10);
      if (warn) {
        const on = Math.floor(this.timer * (this.timer < 0.4 ? 20 : 10)) % 2 === 0;
        const k = 1 - this.timer / WARN;
        ctx.globalAlpha = 0.08 + k * 0.3; ctx.fillStyle = PATCH[this.patch].base; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1;
        this.dashedEdges(ctx, on ? '#ffd23f' : '#ffffff', on ? 0.95 : 0.5, ph);
      } else {
        ctx.globalAlpha = 0.07; ctx.fillStyle = LILAC; ctx.fillRect(x, y, 16, 16); ctx.globalAlpha = 1;
        this.dashedEdges(ctx, '#e9d6ff', 0.45, ph);
      }
    }
    // pedaços de tecido descolando e caindo (giro simulado com escala horizontal)
    for (const pc of this.pieces) {
      const img = getImage(pc.img);
      if (!img) continue;
      const w = Math.max(1, Rn(8 * Math.abs(Math.cos(pc.rot))));
      ctx.globalAlpha = Math.max(0, Math.min(1, pc.life * 1.5));
      ctx.drawImage(img, pc.sx, pc.sy, 8, 8, Rn(pc.x - w / 2), Rn(pc.y - 4), w, 8);
    }
    ctx.globalAlpha = 1;
  }
}
registerEntity('seam_wall', SeamWall);

// ============================================================================
// SEAM_BARRIER — membrana mágica (remoção permanente)
// ============================================================================
const MEM = ['#4a1a78', '#7a3ab8', '#a855ff', '#d68cff', '#f4dcff'];
class SeamBarrier extends SeamCell {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props, 'barrier');
    this.solid = true;
    this.z = 7;
    this.state = 'closed';
    this.timer = 0; this.tearT = 0;
    this.light = { r: 22, color: '#c080ff', i: 0.55, flicker: 0.15 };
  }
  unstitch() {
    if (this.state !== 'closed') return false;
    this.flood((c, d) => { c.beginTear(d * 0.06); if (c.props.signal) this.level.signal(c.props.signal, true); });
    return true;
  }
  beginTear(delay) { if (this.state === 'closed') { this.state = 'tearing'; this.timer = delay; this.alwaysUpdate = true; } }
  update(dt) {
    this.tickTimers(dt);
    if (this.state !== 'tearing') {
      if (Math.random() < dt * 1.2) emit(this.level, 'sparkle', this.x + rand(2, 14), this.y + rand(0, 16), 1, { colors: ['#f4dcff', '#d68cff', '#ffffff'] });
      return;
    }
    if (this.timer > 0) { this.timer -= dt; return; }
    if (this.tearT === 0) {
      this.solid = false;
      emit(this.level, 'portal', this.cx, this.cy, 6);
      emit(this.level, 'thread', this.cx, this.cy, 4, { colors: [LILAC, '#ffffff', '#ffd23f'] });
      audio.sfx('unstitch_hit', { cooldown: 0.08, vol: 0.6, pitch: 0.8 });
    }
    this.tearT += dt;
    if (this.light) this.light.i = Math.max(0, 0.55 * (1 - this.tearT / 0.5));
    if (this.tearT > 0.5) this.remove();
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y), m = this.mask, t = this.t;
    const k = this.tearT / 0.5;   // 0..1 rasgando do centro para as bordas
    const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalAlpha = 0.6 * (1 - k * 0.6);
    for (let i = 0; i < 16; i++) {
      if (k > 0 && Math.abs(i - 7.5) < k * 8.5) continue;
      const gx = this.cellX * 16 + i;
      const v = 0.5 + 0.5 * Math.sin(t * 3.2 + gx * 0.38 + Math.sin(t * 1.7 + this.cellY * 0.9) * 1.5);
      ctx.fillStyle = MEM[Math.min(4, Math.floor(v * 4.2))];
      ctx.fillRect(x + i, y, 1, 16);
    }
    // faixas de brilho descendo
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * (1 - k);
    ctx.fillStyle = '#e8c8ff';
    for (let b = 0; b < 2; b++) {
      const yy = Rn(((t * 22 + b * 8 + this.cellY * 16) % 16));
      for (let i = 0; i < 16; i++) if (!(k > 0 && Math.abs(i - 7.5) < k * 8.5) && (i + b) % 3) ctx.fillRect(x + i, y + yy, 1, 1);
    }
    ctx.globalCompositeOperation = op;
    ctx.globalAlpha = pa * (1 - k);
    // moldura costurada nas bordas expostas
    ctx.fillStyle = OUT;
    if (!(m & 1)) ctx.fillRect(x, y, 2, 16);
    if (!(m & 2)) ctx.fillRect(x + 14, y, 2, 16);
    if (!(m & 4)) ctx.fillRect(x, y, 16, 2);
    if (!(m & 8)) ctx.fillRect(x, y + 14, 16, 2);
    ctx.fillStyle = '#ffd23f';
    for (let i = 1; i < 16; i += 4) {
      if (!(m & 1)) ctx.fillRect(x, y + i, 2, 2);
      if (!(m & 2)) ctx.fillRect(x + 14, y + i, 2, 2);
      if (!(m & 4)) ctx.fillRect(x + i, y, 2, 1);
      if (!(m & 8)) ctx.fillRect(x + i, y + 15, 2, 1);
    }
    ctx.globalAlpha = pa;
  }
}
registerEntity('seam_barrier', SeamBarrier);

// ============================================================================
// SEAM_TRAP — espinhos costurados
// ============================================================================
class SeamTrap extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 14; this.h = 7;
    this.x = x + 1; this.y = y + TILE - this.h;
    this.hazard = true; this.armed = true;
    this.contactDamage = props.damage ?? 1;
    this.disarmT = 0; this.z = 8;
  }
  unstitch() {
    if (!this.armed) return false;
    this.armed = false; this.hazard = false; this.disarmT = 0.45;
    emit(this.level, 'thread', this.cx, this.y, 6, { colors: ['#ff6a7a', '#ffd23f', '#ffffff'] });
    emit(this.level, 'fabric', this.cx, this.y + 2, 5, { colors: ['#c0304a', '#7a1830', '#ff6a7a'] });
    audio.sfx('unstitch_hit', { cooldown: 0.06, vol: 0.6 });
    return true;
  }
  update(dt) { this.tickTimers(dt); if (this.disarmT > 0) this.disarmT -= dt; }
  draw(ctx) {
    const x = Rn(this.x) - 1, y = Rn(this.y + this.h) - 11;
    if (this.armed) {
      const bob = Math.floor(this.t * 2 + this.x * 0.1) % 2;
      drawImage(ctx, 'seam_trap_on', x, y + bob * 0);
    } else if (this.disarmT > 0) {
      const img = getImage('seam_trap_on');
      const hh = Math.max(1, Rn(11 * this.disarmT / 0.45));
      if (img) ctx.drawImage(img, 0, 0, 16, 11, x, y + 11 - hh, 16, hh);
    } else drawImage(ctx, 'seam_trap_off', x, y);
  }
}
registerEntity('seam_trap', SeamTrap);

// ============================================================================
// Efeito do pulso: fios em espiral saindo das patinhas + linhas até os alvos
// ============================================================================
class UnstitchFx extends Entity {
  constructor(level, x, y, hits, radius, facing) {
    super(level, x - radius, y - radius, {});
    this.ox = x; this.oy = y; this.hits = hits; this.radius = radius; this.facing = facing;
    this.w = this.h = radius * 2;
    this.alwaysDraw = true; this.alwaysUpdate = true; this.z = 56;
  }
  update(dt) { this.t += dt; if (this.t > 0.6) this.remove(); }
  draw(ctx) {
    const T = 0.5, k = Math.min(1, this.t / T), e = 1 - Math.pow(1 - k, 3);
    const R = this.radius * e, arms = 6, a0 = this.t * 5 * this.facing;
    if (k < 1) {
      for (let i = 0; i < arms; i++) {
        for (let s = 0; s <= 16; s++) {
          const f = s / 16, r = 3 + f * R;
          const an = a0 + (i * Math.PI * 2) / arms + f * 2.6 * this.facing;
          const px = Rn(this.ox + Math.cos(an) * r), py = Rn(this.oy + Math.sin(an) * r * 0.85);
          ctx.globalAlpha = (1 - k) * (1 - f * 0.5);
          ctx.fillStyle = s === 16 ? '#ffffff' : s % 3 === 0 ? '#ffd23f' : LILAC;
          ctx.fillRect(px, py, s === 16 ? 2 : 1, s === 16 ? 2 : 1);
        }
      }
      // anel pontilhado mostrando o alcance
      ctx.globalAlpha = (1 - k) * 0.45; ctx.fillStyle = '#e9d6ff';
      for (let i = 0; i < 40; i++) { const an = (i / 40) * Math.PI * 2 + a0 * 0.2; ctx.fillRect(Rn(this.ox + Math.cos(an) * R), Rn(this.oy + Math.sin(an) * R * 0.85), 1, 1); }
    }
    ctx.globalAlpha = 1;
    // fios puxados até cada alvo
    for (const h of this.hits) {
      const a = 1 - this.t / 0.45;
      if (a <= 0) break;
      VFX.drawThreadLine(ctx, this.ox, this.oy, h.cx, h.cy, this.t, LILAC, { alpha: a, glow: 1.4, stitches: false, sag: 4 * a });
    }
  }
}

// ============================================================================
// HABILIDADE
// ============================================================================
registerAbility('unstitch', {
  name: 'Descosturar a Realidade', icon: 'icon_ab_unstitch', cost: COST, cooldown: COOLDOWN, color: LILAC,
  desc: 'Solta as costuras próximas: abre paredes costuradas, rasga barreiras, desarma armadilhas, tira armaduras e revela o que está escondido.',
  onPress(p, level) {
    if (!p.spendEnergy(COST)) return;
    p.setCooldown('unstitch', COOLDOWN);
    p.castT = 0.4;
    audio.sfx('unstitch_cast');
    const ox = p.cx + p.facing * FORWARD, oy = p.cy - 2;
    const hits = [];
    for (const e of [...level.entities]) {
      if (e.dead || e === p) continue;
      const dx = Math.max(e.x - ox, 0, ox - (e.x + e.w)), dy = Math.max(e.y - oy, 0, oy - (e.y + e.h));
      if (Math.hypot(dx, dy) > RADIUS) continue;
      let ok = false;
      try {
        if (e.hidden === true && typeof e.reveal === 'function') ok = !!e.reveal(p);
        else if (typeof e.unstitch === 'function') ok = !!e.unstitch(p);
      } catch (err) { console.error('[unstitch]', err); }
      if (ok) hits.push(e);
    }
    const paw = { x: p.cx + p.facing * 6, y: p.cy + 2 };
    level.add(new UnstitchFx(level, paw.x, paw.y, hits.slice(0, 8), RADIUS, p.facing));
    emit(level, 'unravel_fiber', paw.x, paw.y, 8);
    emit(level, 'thread', paw.x, paw.y, 10, { colors: [LILAC, '#ffffff', '#ffd23f'], speed: [40, 110] });
    if (hits.length) level.shake?.(0.12);
    level.events?.emit('unstitch', p, hits);
  },
});

// ============================================================================
// Fase de teste: ?level=test_ab_unstitch&unlock=all
// ============================================================================
registerLevel({
  id: 'test_ab_unstitch', world: 0, index: 0, name: 'Teste: Descosturar', subtitle: 'Avesso das coisas',
  tileset: 'default', background: 'default', music: null, parTime: 90,
  map: buildTestMap(64, 16, (fill, put) => {
    fill(0, 12, 63, 15, '#');
    put(2, 11, 'P');
    fill(10, 6, 19, 11, '#');                 // bloco com sala secreta
    fill(6, 9, 8, 9, '=');                    // degrau para passar por cima
    fill(12, 8, 18, 11, '.');
    fill(10, 8, 11, 11, 'S');                 // entrada costurada (2×4)
    fill(13, 11, 17, 11, 'o'); put(15, 9, 'h');
    fill(22, 0, 28, 8, '#');                  // corredor com barreira
    fill(30, 11, 33, 11, '.');
    put(38, 11, 'a');                         // inimigo com armadura
    fill(42, 7, 42, 11, 'S');                 // parede costurada permanente
    fill(46, 12, 53, 15, '.');                // abismo com ilhós escondidos
    put(45, 11, '@'); put(54, 11, '@');
    put(62, 11, 'E');
  }),
  legend: { a: 'ab_test_dummy' },
  props: {
    '38,11': { armored: true },
    ...Object.fromEntries([7, 8, 9, 10, 11].map((y) => [`42,${y}`, { permanent: true }])),
    '45,11': { hidden: true, group: 'h' }, '54,11': { hidden: true, group: 'h' },
  },
  objects: [
    { type: 'seam_barrier', x: 25, y: 9, signal: 'barrier_open' },
    { type: 'seam_barrier', x: 25, y: 10 },
    { type: 'seam_barrier', x: 25, y: 11 },
    ...[30, 31, 32, 33].map((x) => ({ type: 'seam_trap', x, y: 11 })),
  ],
});
