// =============================================================================
// abilities/stitch.js — COSTURA DIMENSIONAL ("Fio do Destino")
//
// Habilidade 'stitch' (custo 20, recarga 0.5 s) + entidades:
//   anchor        '@'  ilhó dourado. props: group, signal, latch, hidden, attachTo/ox/oy
//                      (via código, p/ chefes: level.spawn('anchor',0,0,{attachTo:boss,ox,oy})).
//                      Métodos: reveal(), link/unlink (contagem de fios), attachX/attachY.
//                      Se attachTo tiver onStitched(player, anchor, bridge) ele é chamado ao costurar
//                      e onThreadSnap(anchor, bridge) quando o fio arrebenta.
//   thread_bridge      ponte de fio caminhável entre 2 pontos (ilhós ou {x,y}/entidades):
//                      level.add(new (R.entities.get('thread_bridge'))(level,0,0,{a,b,life,instant}))
//                      Montaria em lateUpdate (inclinação ≤ 45° anda; mais íngreme escorrega).
//   thread_lasso       fio-laço lançado contra inimigos 'bindable' (bind) ou entidades
//                      com stitchTarget=true (chama onStitched(player, lasso)).
//   ab_test_dummy      inimigo de pelúcia simples só para as fases de teste (props.armored).
// Fase de teste: 'test_ab_stitch' (?level=test_ab_stitch&unlock=all).
// Eventos: level.events 'stitch:connect' (bridge) / 'stitch:snap' (bridge).
//
// Uso: perto (≤ 3 tiles) de um ilhó → costura até o melhor parceiro (≤ 10 tiles, mesmo
// group, na direção do olhar; ↑/↓ inclinam a escolha; prévia pontilhada mostra o alvo).
// Sem ilhó: laça o inimigo à frente (≤ 6 tiles) por 3 s × duração. Máx. 2 pontes.
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, approach, rand, lerp } from '../../engine/util.js';
import { defineImage, drawImage } from '../../engine/sprites.js';
import { getParticlePreset } from '../../engine/particles.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { input } from '../../engine/input.js';
import { R, registerAbility, registerEntity, registerLevel } from '../registry.js';
import { getStats } from '../stats.js';
import { Enemy } from '../enemies/base.js';
import * as VFX from '../art/vfx.js';

// ----------------------------------------------------------------- ajustes
const COST = 20, COOLDOWN = 0.5;
const NEAR = 3 * TILE + 4;      // alcance até o ilhó inicial
const PARTNER = 10 * TILE + 2;  // alcance até o ilhó parceiro
const LASSO = 6 * TILE;         // alcance do laço
const BRIDGE_TIME = 6;          // s × getStats().duration
const BLINK = 1.5;              // pisca nos últimos N s
const BIND_TIME = 3;            // s × duração
const MAX_BRIDGES = 2;
const SEW_SPEED = 760;          // px/s da agulha costurando
const GOLD = '#ffd23f';
const Rn = Math.round;

// ----------------------------------------------------------------- utilidades
const anchorsOf = (level) => (level._anchors ||= new Set());
const bridgesOf = (level) => (level._threadBridges ||= []);
const dur = () => getStats().duration || 1;
function emit(level, name, x, y, n, ov) {
  level.particles.emit(getParticlePreset(name) ? name : 'thread', x, y, n, ov);
}
/** Ponto de amarração: ilhó (attachX/Y), entidade (centro) ou {x,y}. */
export function attachPt(e) {
  if (!e) return null;
  if (e.attachX !== undefined) return { x: e.attachX, y: e.attachY };
  if (e.w !== undefined) return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
  return { x: e.x, y: e.y };
}
const pawOf = (p) => ({ x: p.cx + p.facing * 7, y: p.cy + 1 });

/** Linha livre de tiles sólidos E de entidades sólidas (portões, blocos...). */
function clearLine(level, x0, y0, x1, y1, ignore) {
  if (!level.map.los(x0, y0, x1, y1)) return false;
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
  const bx0 = Math.min(x0, x1), bx1 = Math.max(x0, x1), by0 = Math.min(y0, y1), by1 = Math.max(y0, y1);
  for (const s of level.solids) {
    if (!s.solid || s.dead || s === ignore) continue;
    if (s.x > bx1 || s.x + s.w < bx0 || s.y > by1 || s.y + s.h < by0) continue;
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return false;
    }
  }
  return true;
}

function nearestAnchor(level, p) {
  let best = null, bs = Infinity;
  for (const a of anchorsOf(level)) {
    if (a.dead || a.hidden) continue;
    const d = Math.hypot(a.attachX - p.cx, a.attachY - p.cy);
    if (d > NEAR) continue;
    const s = d - 6 * Math.sign(a.attachX - p.cx) * p.facing;
    if (s < bs) { bs = s; best = a; }
  }
  return best;
}
function findBridge(level, a, b) {
  return bridgesOf(level).find((br) => !br.dead && ((br.a === a && br.b === b) || (br.a === b && br.b === a)));
}
function bestPartner(level, a, p) {
  let aimX = (input.axisX?.() || 0) || p.facing, aimY = 0;
  if (input.down('up')) aimY = -1.3; else if (input.down('down')) aimY = 1.3;
  const al = Math.hypot(aimX, aimY); aimX /= al; aimY /= al;
  let best = null, bs = Infinity;
  for (const b of anchorsOf(level)) {
    if (b === a || b.dead || b.hidden) continue;
    const dx = b.attachX - a.attachX, dy = b.attachY - a.attachY;
    const d = Math.hypot(dx, dy);
    if (d > PARTNER || d < 10) continue;
    if (!clearLine(level, a.attachX, a.attachY, b.attachX, b.attachY, b.attachTo || a.attachTo)) continue;
    let s = d / PARTNER - 0.75 * (dx * aimX + dy * aimY) / d;
    if ((a.group ?? null) !== (b.group ?? null)) s += 1.6;
    if (findBridge(level, a, b)) s += 0.5;
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}
function lassoTarget(level, p) {
  const px = p.cx, py = p.cy;
  const up = input.down('up');
  let best = null, bs = Infinity;
  for (const e of level.entities) {
    if (e.dead || e === p) continue;
    const isEnemy = e.bindable && e.enemy && !e.dying && typeof e.bind === 'function';
    if (!isEnemy && !e.stitchTarget) continue;
    const dx = e.cx - px, dy = e.cy - py;
    if (dx * p.facing < -10) continue;                 // só à frente
    const d = Math.hypot(dx, dy);
    if (d > LASSO + Math.max(e.w, e.h) / 2) continue;
    if (Math.abs(dy) > (up ? LASSO : 3.5 * TILE) || (up && dy > 24)) continue;
    if (!clearLine(level, px, py - 2, e.cx, e.cy, e)) continue;
    const s = d - (e.stitchTarget ? 24 : 0) + (up ? dy * 0.5 : Math.abs(dy) * 0.6);
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}

// ----------------------------------------------------------------- arte (cache)
defineImage('anchor_eyelet', 15, 15, (pc) => {
  const c = 7;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d <= 4.7 && d >= 2.3) {
      const l = ((c - x) + (c - y)) / (d * 1.414);     // luz de cima-esquerda
      pc.px(x, y, l > 0.75 ? '#fff6c0' : l > 0.05 ? '#ffd23f' : l > -0.7 ? '#e0a020' : '#a8700f');
    } else if (d < 2.3) pc.px(x, y, '#2a1838');
  }
  pc.px(c - 1, c - 1, '#4a3058');                       // reflexo no furo
  pc.outline('#4a2a08');
  // pontos de casa de botão (radiais)
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    pc.px(Rn(c + Math.cos(a) * 6.6), Rn(c + Math.sin(a) * 6.6), '#f4e6c8');
  }
});

// ============================================================================
// ANCHOR — ilhó dourado
// ============================================================================
class Anchor extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 16; this.h = 16; this.z = 42;
    this.group = props.group ?? null;
    this.hidden = !!props.hidden;
    this.links = new Set();
    this.attachTo = props.attachTo || null;
    this.ox = props.ox ?? 0; this.oy = props.oy ?? 0;
    if (this.attachTo) { this.alwaysUpdate = true; this.follow(); }
    this.revealT = 0; this.revealIn = 0; this.pulse = 0; this.fizzT = 0;
    this.seed = ((x * 7 + y * 13) % 97) / 97;
    this.light = this.hidden ? null : { r: 26, color: GOLD, i: 0.5, flicker: 0.1 };
    this.tags.add('anchor');
    anchorsOf(level).add(this);
  }
  get attachX() { return this.x + 8; }
  get attachY() { return this.y + 8; }
  follow() { const t = this.attachTo; this.x = t.x + t.w / 2 + this.ox - 8; this.y = t.y + t.h / 2 + this.oy - 8; }
  update(dt) {
    this.tickTimers(dt);
    if (this.attachTo) { if (this.attachTo.dead) { this.remove(); return; } this.follow(); }
    if (this.revealT > 0) this.revealT -= dt;
    if (this.revealIn > 0) { this.revealIn -= dt; if (this.revealIn <= 0) this.reveal(); }
    if (this.pulse > 0) this.pulse -= dt;
    if (this.fizzT > 0) this.fizzT -= dt;
    if (!this.hidden && Math.random() < dt * (this.links.size ? 3 : 0.5)) {
      emit(this.level, 'sparkle', this.attachX + rand(-5, 5), this.attachY + rand(-5, 5), 1, { speed: [2, 10], life: [0.3, 0.6] });
    }
  }
  link(bridge) {
    const was = this.links.size;
    this.links.add(bridge);
    this.pulse = 0.5;
    if (this.props.signal && was === 0) this.level.signal(this.props.signal, true);
    this.attachTo?.onStitched?.(this.level.player, this, bridge);
  }
  unlink(bridge) {
    if (!this.links.delete(bridge)) return;
    if (this.props.signal && this.links.size === 0 && !this.props.latch) this.level.signal(this.props.signal, false);
    this.attachTo?.onThreadSnap?.(this, bridge);
  }
  /** Descosturar revela ilhós escondidos. */
  reveal() {
    if (!this.hidden) return false;
    this.hidden = false;
    this.revealT = 0.9;
    this.light = { r: 26, color: GOLD, i: 0.5, flicker: 0.1 };
    emit(this.level, 'sparkle', this.attachX, this.attachY, 12);
    emit(this.level, 'stitch_spark', this.attachX, this.attachY, 8);
    audio.sfx('secret_soft', { cooldown: 0.1 });
    // o ilhó parceiro escondido (mesmo group, ≤ 10 tiles) acende logo em seguida
    if (this.group !== null) for (const b of anchorsOf(this.level)) {
      const d = Math.hypot(b.attachX - this.attachX, b.attachY - this.attachY);
      if (b.hidden && !b.revealIn && b.group === this.group && d <= PARTNER) b.revealIn = 0.25 + d / 500;
    }
    return true;
  }
  /** Ilhó sem parceiro: faísca de aviso. */
  fizzle() {
    this.fizzT = 0.35;
    emit(this.level, 'hit', this.attachX, this.attachY, 4, { colors: ['#ff8a5c', '#ffd23f'] });
  }
  onRemove() {
    anchorsOf(this.level).delete(this);
    for (const b of [...this.links]) b.snap();
  }
  draw(ctx) {
    const cx = Rn(this.attachX), cy = Rn(this.attachY);
    if (this.hidden) {
      // brilho quase imperceptível (dica para quem presta atenção)
      if ((this.t * 0.35 + this.seed) % 1 < 0.05) {
        ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff6a8';
        ctx.fillRect(cx, cy - 1, 1, 3); ctx.fillRect(cx - 1, cy, 3, 1);
        ctx.globalAlpha = 1;
      }
      return;
    }
    const linked = this.links.size > 0;
    const fz = this.fizzT > 0 ? Rn(Math.sin(this.fizzT * 60)) : 0;
    VFX.drawGlow?.(ctx, cx, cy, linked ? 15 : 11, GOLD, 0.32 + 0.12 * Math.sin(this.t * 3 + this.seed * 6) + this.pulse * 0.6);
    drawImage(ctx, 'anchor_eyelet', cx - 7 + fz, cy - 7);
    if (linked) { ctx.fillStyle = '#fff3a0'; ctx.fillRect(cx - 1, cy - 1, 2, 2); }
    // brilho girando pelo aro
    const a = this.t * 2.4 + this.seed * 6.28;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Rn(cx + Math.cos(a) * 3.6) + fz, Rn(cy + Math.sin(a) * 3.6), 1, 1);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(Rn(cx + Math.cos(a - 0.5) * 3.6) + fz, Rn(cy + Math.sin(a - 0.5) * 3.6), 1, 1);
    ctx.globalAlpha = 1;
    // cintilada periódica (estrelinha)
    const ph = (this.t * 0.45 + this.seed) % 1;
    if (ph < 0.08) {
      const s = ph < 0.04 ? 2 : 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 4, cy - 4 - s, 1, s * 2 + 1); ctx.fillRect(cx - 4 - s, cy - 4, s * 2 + 1, 1);
    }
    if (this.revealT > 0) {
      const k = 1 - this.revealT / 0.9, r = 4 + k * 16;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff6a8';
      for (let i = 0; i < 16; i++) { const an = i * Math.PI / 8 + k; ctx.fillRect(Rn(cx + Math.cos(an) * r), Rn(cy + Math.sin(an) * r), 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
}
registerEntity('anchor', Anchor);

// ============================================================================
// THREAD_BRIDGE — ponte de fio caminhável
// ============================================================================
class ThreadBridge extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.a = props.a; this.b = props.b;
    this.isThread = true;
    this.maxLife = this.life = props.life ?? BRIDGE_TIME * dur();
    this.sew = props.instant ? 1 : 0;
    this.color = props.color || GOLD;
    this.alwaysUpdate = true; this.alwaysDraw = true;
    this.z = 40;
    this.riding = false; this.load = 0; this.vk = 0.5;
    this.wob = 0; this.wobT = 9; this.S = 0; this.D = 0;
    this.prevD = null;
    this.linked = false;
    bridgesOf(level).push(this);
    if (this.sew >= 1) this.onSewn(true);
  }
  geom() {
    const A = attachPt(this.a), B = attachPt(this.b);
    if (!A || !B || this.a?.dead || this.b?.dead) return null;
    const aLeft = A.x <= B.x;
    const L = aLeft ? A : B, Rr = aLeft ? B : A;
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    return { A, B, L, R: Rr, aLeft, len, W: Rr.x - L.x, slope: (Rr.y - L.y) / Math.max(1, Rr.x - L.x) };
  }
  shape(g) {
    const wv = this.wob * Math.exp(-this.wobT * 4) * Math.sin(this.wobT * 22);
    const sagBase = Math.min(5, g.len * 0.035), depth = Math.min(6, 2 + g.len * 0.025);
    this.S = sagBase * (1 - this.load) + wv * (1 - this.load);
    this.D = depth * this.load + wv * this.load;
  }
  yAt(k, g) {
    const v = clamp(this.vk, 0.02, 0.98);
    const V = k <= v ? k / v : (1 - k) / (1 - v);
    return g.L.y + (g.R.y - g.L.y) * k + this.S * Math.sin(Math.PI * k) + this.D * V;
  }
  sewnAt(k, g) { return this.sew >= 1 || (g.aLeft ? k : 1 - k) <= this.sew; }
  refresh() {
    this.life = this.maxLife = BRIDGE_TIME * dur();
    const g = this.geom();
    if (g) for (let i = 0; i <= 6; i++) emit(this.level, 'stitch_spark', lerp(g.L.x, g.R.x, i / 6), lerp(g.L.y, g.R.y, i / 6), 1);
    audio.sfx('stitch_connect', { pitch: 1.15 });
  }
  onSewn(silent) {
    this.sew = 1;
    if (this.linked) return;
    this.linked = true;
    this.a?.link?.(this); this.b?.link?.(this);
    if (!silent) {
      audio.sfx('stitch_connect');
      for (const e of [this.a, this.b]) { const p = attachPt(e); emit(this.level, 'sparkle', p.x, p.y, 8); }
    }
    this.level.events?.emit('stitch:connect', this);
  }
  kick(vy) { this.wob = clamp(vy / 350, 0.25, 1) * 3; this.wobT = 0; }
  update(dt) {
    this.tickTimers(dt);
    const g = this.geom();
    if (!g) { this.snap(); return; }
    if (this.sew < 1) {
      this.sew = Math.min(1, this.sew + (SEW_SPEED * dt) / Math.max(16, g.len));
      const k = this.sew;
      if (Math.random() < 0.7) emit(this.level, 'stitch_spark', lerp(g.A.x, g.B.x, k), lerp(g.A.y, g.B.y, k), 1);
      if (this.sew >= 1) this.onSewn(false);
    } else {
      this.life -= dt;
      if (this.life <= 0) { this.snap(); return; }
    }
    this.wobT += dt;
    // caixa para culling/consultas
    this.x = g.L.x - 2; this.w = g.W + 4;
    this.y = Math.min(g.L.y, g.R.y) - 4; this.h = Math.abs(g.R.y - g.L.y) + 14;
  }
  /** Lógica de montaria: roda depois de todos os updates (inclusive o do jogador). */
  lateUpdate(dt) {
    const p = this.level.player;
    const g = this.geom();
    if (!g || !p) return;
    this.shape(g);
    if (p.state === 'dead' || g.W < 10) { this.dismount(p); return; }
    const k = (p.cx - g.L.x) / g.W, kc = clamp(k, 0, 1);
    const inX = k >= -0.03 && k <= 1.03 && this.sewnAt(kc, g);
    const foot = p.y + p.h;
    const other = p.groundEntity && p.groundEntity !== this && p.groundEntity.isThread && p.groundEntity.riding;
    let snap = false;
    if (inX && !other && p.vy >= 0 && !(p.dropT > 0) && !p.inWater) {
      if (this.riding) this.vk = kc;
      const d = foot - this.yAt(kc, g);
      if (this.riding) snap = d >= -8 && d <= 10;
      else snap = (d >= -1.5 && d <= 12 && this.prevD !== null && this.prevD <= 2.5)
        || (p.grounded && d > 0 && d <= 9);
    }
    if (snap) {
      if (!this.riding) {
        this.vk = kc;
        if (p.vy > 60) this.kick(p.vy);
        if (p.vy > 120) p.onLand?.(p.vy);
        this.shape(g);
      }
      const ny = this.yAt(kc, g) - p.h;
      if (this.level.map.rectSolid(p.x, ny, p.w, p.h)) snap = false;
      else {
        this.riding = true;
        p.y = ny; p.vy = 0; p.jumping = false;
        p.grounded = true; p.onOneWay = true; p.groundEntity = this;
        if (Math.abs(g.slope) > 1) {                 // íngreme demais: escorrega
          const dir = Math.sign(g.slope);
          p.vx = approach(p.vx, dir * 210, 1200 * dt);
          if (Math.random() < 0.5) emit(this.level, 'stitch_spark', p.cx, p.bottom, 1);
        }
      }
    }
    if (!snap) this.dismount(p);
    this.load = approach(this.load, this.riding ? 1 : 0, (this.riding ? 5 : 2.5) * dt);
    this.prevD = (p.y + p.h) - this.yAt(kc, g);
  }
  dismount(p) {
    if (this.riding && p && p.groundEntity === this) p.groundEntity = null;
    this.riding = false;
  }
  snap(silent = false) {
    if (this.dead) return;
    this.remove();
    const g = this.geom();
    if (!silent && g) {
      audio.sfx('thread_snap');
      const n = Math.max(3, Math.round(g.len / 12));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        emit(this.level, 'thread', lerp(g.L.x, g.R.x, k), this.yAt(k, g), 1, { colors: [this.color, '#ffffff', '#ffc94a'] });
      }
      emit(this.level, 'stitch_spark', lerp(g.L.x, g.R.x, this.vk), this.yAt(this.vk, g), 6);
      this.level.add(new SnapFx(this.level, g, this));
    }
  }
  onRemove() {
    const list = bridgesOf(this.level);
    const i = list.indexOf(this);
    if (i >= 0) list.splice(i, 1);
    this.a?.unlink?.(this); this.b?.unlink?.(this);
    const p = this.level.player;
    if (p && p.groundEntity === this) p.groundEntity = null;
    this.level.events?.emit('stitch:snap', this);
  }
  draw(ctx) {
    const g = this.geom();
    if (!g) return;
    const t = this.t;
    let alpha = 1;
    if (this.sew >= 1 && this.life < BLINK) alpha = Math.floor(this.life * (this.life < 0.5 ? 22 : 11)) % 2 ? 0.3 : 1;
    const opt = { width: 2, glow: 1.2, alpha };
    if (this.sew < 1) {
      const tip = { x: lerp(g.A.x, g.B.x, this.sew), y: lerp(g.A.y, g.B.y, this.sew) };
      VFX.drawThreadLine(ctx, g.A.x, g.A.y, tip.x, tip.y, t, this.color, { width: 2, glow: 1.6 });
      drawNeedle(ctx, tip.x, tip.y, (g.B.x - g.A.x) / g.len, (g.B.y - g.A.y) / g.len, t);
    } else if (this.D < 0.75) {
      VFX.drawThreadLine(ctx, g.L.x, g.L.y, g.R.x, g.R.y, t, this.color, { ...opt, sag: this.S });
    } else {
      const v = clamp(this.vk, 0.02, 0.98);
      const px = lerp(g.L.x, g.R.x, v), py = this.yAt(v, g);
      VFX.drawThreadLine(ctx, g.L.x, g.L.y, px, py, t, this.color, opt);
      VFX.drawThreadLine(ctx, px, py, g.R.x, g.R.y, t + 0.37, this.color, opt);
    }
    // fio saindo da patinha do Tico até o primeiro ilhó (lançamento)
    const p = this.level.player;
    if (this.t < 0.28 && p && this.a?.attachX !== undefined) {
      const paw = pawOf(p);
      VFX.drawThreadLine(ctx, paw.x, paw.y, g.A.x, g.A.y, t, this.color, { alpha: 1 - this.t / 0.28, stitches: false });
    }
  }
}
registerEntity('thread_bridge', ThreadBridge);

function drawNeedle(ctx, x, y, dx, dy, t) {
  const cols = ['#ffffff', '#e8eef8', '#c8d2e2', '#a8b4c8', '#7a8698', '#a8b4c8'];
  for (let i = 0; i < cols.length; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(Rn(x - dx * i), Rn(y - dy * i), 1, 1); }
  if (Math.floor(t * 20) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Rn(x + dx * 2) - 1, Rn(y + dy * 2), 3, 1); ctx.fillRect(Rn(x + dx * 2), Rn(y + dy * 2) - 1, 1, 3); }
}

/** Efeito do fio arrebentando: duas metades chicoteando de volta aos ilhós. */
class SnapFx extends Entity {
  constructor(level, g, br) {
    super(level, g.L.x, Math.min(g.L.y, g.R.y) - 8, {});
    this.w = Math.max(8, g.W); this.h = Math.abs(g.R.y - g.L.y) + 24;
    this.L = { ...g.L }; this.R = { ...g.R }; this.k = clamp(br.vk, 0.1, 0.9); this.color = br.color;
    this.M = { x: lerp(g.L.x, g.R.x, this.k), y: br.yAt(this.k, g) };
    this.alwaysDraw = true; this.alwaysUpdate = true; this.z = 40;
  }
  update(dt) { this.t += dt; if (this.t > 0.38) this.remove(); }
  draw(ctx) {
    const e = 1 - Math.pow(1 - this.t / 0.38, 2), a = 1 - this.t / 0.38;
    const whip = Math.sin(this.t * 40) * 5 * a;
    for (const [P, s] of [[this.L, 1], [this.R, -1]]) {
      const ex = lerp(this.M.x, P.x, e), ey = lerp(this.M.y, P.y, e) + whip * s;
      VFX.drawThreadLine(ctx, P.x, P.y, ex, ey, this.t, this.color, { alpha: a, sag: whip * 0.6 * s, stitches: false });
    }
  }
}

// ============================================================================
// THREAD_LASSO — laço de fio (prende inimigos / aciona ganchos de chefe)
// ============================================================================
class ThreadLasso extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.owner = props.player || level.player;
    this.target = props.target || null;
    this.dir = props.dir || this.owner.facing;
    this.dy = props.dy || 0;
    const paw = pawOf(this.owner);
    this.tip = { x: paw.x, y: paw.y };
    this.phase = 'fly'; this.holdT = 0;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 55;
    this.w = 4; this.h = 4;
  }
  update(dt) {
    this.t += dt;
    const paw = pawOf(this.owner), tip = this.tip, tg = this.target;
    const moveTo = (gx, gy, sp) => {
      const dx = gx - tip.x, dy = gy - tip.y, d = Math.hypot(dx, dy);
      if (d <= sp * dt) { tip.x = gx; tip.y = gy; return true; }
      tip.x += (dx / d) * sp * dt; tip.y += (dy / d) * sp * dt; return false;
    };
    if (this.phase === 'fly') {
      if (tg && (tg.dead || tg.dying)) { this.phase = 'back'; }
      else if (tg) { if (moveTo(tg.cx, tg.cy, 640)) this.hit(); }
      else {
        const done = moveTo(paw.x + this.dir * LASSO, paw.y + this.dy, 640);
        if (done || this.level.map.solidAt(tip.x, tip.y) || this.level.platformAt(tip.x, tip.y)?.solid) {
          this.phase = 'back';
          emit(this.level, 'thread', tip.x, tip.y, 3);
        }
      }
      if (this.t > 0.6) this.phase = 'back';
    } else if (this.phase === 'hold') {
      if (tg && !tg.dead) { tip.x = tg.cx; tip.y = tg.cy; }
      this.holdT -= dt;
      if (this.holdT <= 0) this.phase = 'back';
    } else if (moveTo(paw.x, paw.y, 900)) this.remove();
    this.x = tip.x - 2; this.y = tip.y - 2;
  }
  hit() {
    const tg = this.target, p = this.owner;
    this.phase = 'hold'; this.holdT = 0.24;
    if (typeof tg.onStitched === 'function') { tg.onStitched(p, this); audio.sfx('bind'); }
    else if (typeof tg.bind === 'function') tg.bind(BIND_TIME * dur());
    emit(this.level, 'sparkle', tg.cx, tg.cy, 8);
    emit(this.level, 'thread', tg.cx, tg.cy, 8);
    this.level.hitstop?.(0.04);
  }
  draw(ctx) {
    const paw = pawOf(this.owner), tip = this.tip;
    const sag = this.phase === 'fly' ? 3 : this.phase === 'hold' ? 1 : 2;
    VFX.drawThreadLine(ctx, paw.x, paw.y, tip.x, tip.y, this.t, GOLD, { sag, glow: 1.3, stitches: false });
    // laçada girando na ponta
    const r = this.phase === 'hold' ? 5 : 3;
    for (let i = 0; i < 8; i++) {
      const a = this.t * 14 + i * Math.PI / 4;
      ctx.fillStyle = i % 2 ? '#ffffff' : GOLD;
      ctx.fillRect(Rn(tip.x + Math.cos(a) * r), Rn(tip.y + Math.sin(a) * r * 0.7), 1, 1);
    }
  }
}
registerEntity('thread_lasso', ThreadLasso);

// ============================================================================
// HABILIDADE
// ============================================================================
function castFx(p, level) {
  p.castT = 0.3;
  p._stitchSpark = 0.35;
  audio.sfx('stitch_cast');
  const paw = pawOf(p);
  emit(level, 'stitch_spark', paw.x, paw.y, 6);
  emit(level, 'sparkle', paw.x, paw.y, 3);
}

registerAbility('stitch', {
  name: 'Costura Dimensional', icon: 'icon_ab_stitch', cost: COST, cooldown: COOLDOWN, color: GOLD,
  desc: 'Perto de um ilhó dourado, costura uma ponte de fio até outro ilhó (↑/↓ escolhem). Longe deles, laça e prende inimigos.',
  onPress(p, level) {
    let near = nearestAnchor(level, p);
    const target = lassoTarget(level, p);
    // ilhó atrás do Tico + inimigo à frente → prioriza o laço
    if (near && target && (near.attachX - p.cx) * p.facing < -8) near = null;
    if (near) {
      const partner = bestPartner(level, near, p);
      if (partner) {
        if (!p.spendEnergy(COST)) return;
        castFx(p, level);
        p.setCooldown('stitch', COOLDOWN);
        const existing = findBridge(level, near, partner);
        if (existing) { existing.refresh(); return; }
        const list = bridgesOf(level).filter((b) => !b.dead);
        while (list.length >= MAX_BRIDGES) list.shift().snap();
        level.add(new ThreadBridge(level, 0, 0, { a: near, b: partner }));
        return;
      }
      near.fizzle();
    }
    if (target) {
      if (!p.spendEnergy(COST)) return;
      castFx(p, level);
      p.setCooldown('stitch', COOLDOWN);
      level.add(new ThreadLasso(level, p.cx, p.cy, { player: p, target }));
      return;
    }
    // nada para costurar: laço no vazio (sem custo) — feedback
    p.castT = 0.2;
    p.setCooldown('stitch', 0.35);
    audio.sfx(near ? 'ui_denied' : 'whip', { vol: 0.6 });
    level.add(new ThreadLasso(level, p.cx, p.cy, { player: p, dy: input.down('up') ? -LASSO * 0.7 : 0 }));
  },
  update(p, dt) { if (p._stitchSpark > 0) p._stitchSpark -= dt; },
  draw(ctx, p) {
    const level = p.level;
    // faíscas de costura na patinha durante o lançamento
    if (p._stitchSpark > 0) {
      const paw = pawOf(p);
      for (let i = 0; i < 4; i++) {
        const a = p.t * 18 + i * 1.57, r = 2 + (i % 2) * 2;
        ctx.fillStyle = i % 2 ? '#ffffff' : GOLD;
        ctx.fillRect(Rn(paw.x + Math.cos(a) * r), Rn(paw.y + Math.sin(a) * r), 1, 1);
      }
      drawNeedle(ctx, paw.x + p.facing * 3, paw.y - 2, p.facing * 0.8, 0.6, p.t);
    }
    // prévia: marcador no ilhó próximo + linha pontilhada até o parceiro escolhido
    if (save.data.equippedAbility !== 'stitch' || !save.data.abilities?.stitch || p.state !== 'normal' || !level) return;
    const a = nearestAnchor(level, p);
    if (!a) return;
    const ready = p.cooldownOf('stitch') <= 0 && p.energy >= p.costOf(COST);
    ctx.fillStyle = ready ? '#fff6a8' : '#8a8090';
    for (let i = 0; i < 4; i++) {
      const an = p.t * 3 + i * Math.PI / 2;
      ctx.fillRect(Rn(a.attachX + Math.cos(an) * 10), Rn(a.attachY + Math.sin(an) * 10), 1, 1);
    }
    const b = bestPartner(level, a, p);
    if (!b) return;
    const dx = b.attachX - a.attachX, dy = b.attachY - a.attachY, d = Math.hypot(dx, dy);
    const n = Math.floor(d / 3), ph = Math.floor(p.t * 12);
    ctx.globalAlpha = ready ? 0.55 : 0.25;
    ctx.fillStyle = '#fff6a8';
    for (let i = 2; i < n - 1; i++) if ((i + ph) % 3 === 0) ctx.fillRect(Rn(a.attachX + dx * i / n), Rn(a.attachY + dy * i / n), 1, 1);
    for (let i = 0; i < 4; i++) {
      const an = -p.t * 3 + i * Math.PI / 2;
      ctx.fillRect(Rn(b.attachX + Math.cos(an) * 9), Rn(b.attachY + Math.sin(an) * 9), 1, 1);
    }
    ctx.globalAlpha = 1;
  },
  onUnequip() {},
});

// ============================================================================
// Inimigo de teste (apenas para as fases test_ab_*)
// ============================================================================
class AbTestDummy extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 14; this.h = 12; this.alignToCell(x, y);
    this.hp = this.maxHp = props.hp ?? 3;
    this.armored = !!props.armored;
    this.speed = props.speed ?? 24;
  }
  think(dt) { this.patrol(this.speed, dt); this.physics(dt); }
  draw(ctx) {
    const o = this.spriteOpts();
    const x = Rn(this.x), y = Rn(this.y), f = this.facing;
    ctx.globalAlpha = o.alpha;
    const fl = this.flash > 0;
    ctx.fillStyle = '#2a1020'; ctx.fillRect(x + 1, y, 12, 12); ctx.fillRect(x, y + 1, 14, 10);
    ctx.fillStyle = fl ? '#ffffff' : '#e85d75'; ctx.fillRect(x + 1, y + 1, 12, 10);
    if (!fl) {
      ctx.fillStyle = '#ff9aac'; ctx.fillRect(x + 2, y + 2, 5, 2);
      ctx.fillStyle = '#b03a55'; ctx.fillRect(x + 1, y + 9, 12, 2);
      const ex = x + 7 + f * 2;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ex - 4, y + 4, 3, 3); ctx.fillRect(ex + 1, y + 4, 3, 3);
      ctx.fillStyle = '#120a18'; ctx.fillRect(ex - 3 + (f > 0 ? 1 : 0), y + 5, 1, 2); ctx.fillRect(ex + 2 + (f > 0 ? 1 : 0), y + 5, 1, 2);
      ctx.fillStyle = '#2a1020'; for (let i = 0; i < 3; i++) ctx.fillRect(ex - 2 + i * 2, y + 8, 1, 1);
    }
    if (this.armored) {   // dedal de metal (armadura)
      ctx.fillStyle = '#3a4050'; ctx.fillRect(x, y - 2, 14, 6);
      ctx.fillStyle = '#9aa4b8'; ctx.fillRect(x + 1, y - 1, 12, 4);
      ctx.fillStyle = '#d8dee8'; ctx.fillRect(x + 2, y - 1, 10, 1);
      ctx.fillStyle = '#5a6478'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 3, y + 1, 1, 1);
    }
    ctx.globalAlpha = 1;
    this.drawStatus(ctx);
  }
}
registerEntity('ab_test_dummy', AbTestDummy);

// ============================================================================
// Fase de teste: ?level=test_ab_stitch&unlock=all
// ============================================================================
/** Monta um mapa ASCII por código (usado pelas fases de teste das habilidades). */
export function buildTestMap(W, H, ops) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < W) g[y][x] = ch; };
  ops(fill, (x, y, ch) => fill(x, y, x, y, ch));
  return g.map((r) => r.join(''));
}

registerLevel({
  id: 'test_ab_stitch', world: 0, index: 0, name: 'Teste: Costura Dimensional', subtitle: 'Fio do Destino',
  tileset: 'default', background: 'default', music: null, parTime: 90,
  map: buildTestMap(72, 16, (fill, put) => {
    fill(0, 12, 71, 15, '#');
    fill(9, 12, 16, 15, '.');                 // abismo 1 (ponte A)
    put(2, 11, 'P');
    put(8, 11, '@'); put(17, 11, '@');        // grupo a
    put(22, 11, '@');                         // grupo b (rampa até o platô)
    fill(28, 7, 37, 11, '#'); put(28, 6, '@');
    fill(31, 6, 34, 6, 'o');
    put(45, 9, '@'); put(51, 9, '@');         // grupo c → sinal 'sg1'
    put(58, 11, 'a');                         // inimigo para laçar
    fill(60, 8, 62, 8, '=');                  // escorregador íngreme (grupo d)
    put(61, 7, '@'); put(64, 11, '@');
    put(70, 11, 'E');
  }),
  legend: { a: 'ab_test_dummy' },
  props: {
    '8,11': { group: 'a' }, '17,11': { group: 'a' },
    '22,11': { group: 'b' }, '28,6': { group: 'b' },
    '45,9': { group: 'c', signal: 'sg1' }, '51,9': { group: 'c' },
    '61,7': { group: 'd' }, '64,11': { group: 'd' },
  },
  onStart(level) {
    const Gate = R.entities.get('gate');
    if (Gate) level.add(new Gate(level, 55 * TILE, 11 * TILE, { signal: 'sg1', pid: 'test_ab_stitch:gate' }));
  },
});
