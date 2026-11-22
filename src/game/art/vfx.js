// =============================================================================
// art/vfx.js — Efeitos visuais reutilizáveis (fios luminosos, ondas de choque,
// impactos, portais, brilhos, texto flutuante) + presets de partículas.
//
// Exportações (assinaturas estáveis — usadas por habilidades, chefes e objetos):
//   drawThreadLine(ctx, x0, y0, x1, y1, t, color, {sag, glow, width, stitches, alpha})
//   spawnShockwave(level, x, y, {radius, color, color2, dur, thickness, particles})
//   spawnImpact(level, x, y, {size, color, dur, rays, particles})
//   spawnFloatingText(level, x, y, text, color)
//   drawPortalSwirl(ctx, x, y, r, t, colors, {squash, arms, alpha})
//   drawGlow(ctx, x, y, r, color, alpha)
// Entidades transitórias: 'vfx_shockwave', 'vfx_impact', 'vfx_text'.
//
// Presets de partículas ambientes (campo `rate` = partículas/s, `fromBottom`
// = nascem na base da tela e sobem): w1_fireflies w1_spores w2_bubbles
// w2_plankton w3_sparks w3_dust w4_dust w4_ash w5_threads w5_embers.
// Presets de efeito: impact_ring stitch_spark unravel_fiber rewind_glyph
// ghost_patch confetti stars_burst tear_drop ink glass_shard clock_shard
// shadow_wisp.
// Tudo desenhado em pixels inteiros; brilhos são pré-renderizados e cacheados.
// =============================================================================
import { registerParticle } from '../../engine/particles.js';
import { Entity } from '../../engine/entity.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { lighten, darken } from '../../engine/util.js';
import { registerEntity } from '../registry.js';
import font from '../../engine/font.js';

const R = Math.round;

// ----------------------------------------------------------------- brilho (cache)
const glowCache = new Map();
/** Canvas de brilho em faixas (3 anéis com pontilhado) — gerado uma vez por (raio, cor). */
function glowSprite(r, color) {
  r = Math.max(2, Math.min(96, R(r)));
  const key = r + color;
  let c = glowCache.get(key);
  if (c) return c;
  const size = r * 2 + 1;
  const pc = new PixelCanvas(size, size);
  const bands = [[1, 0.035], [0.72, 0.09], [0.48, 0.2], [0.25, 0.42]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d > 1) continue;
      let a = 0;
      for (const [lim, al] of bands) if (d <= lim) a = al;
      // pontilhado nas bordas das faixas para suavizar sem anti-aliasing
      const edge = bands.find(([lim]) => d <= lim && d > lim - 0.08);
      if (edge && ((x + y) & 1)) a *= 0.6;
      const hex = Math.round(a * 255).toString(16).padStart(2, '0');
      pc.px(x, y, color.length === 4 ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}${hex}` : color.slice(0, 7) + hex);
    }
  }
  pc.flush();
  c = pc.canvas;
  glowCache.set(key, c);
  return c;
}

/** Brilho aditivo em faixas centrado em (x,y). */
export function drawGlow(ctx, x, y, r, color = '#ffffff', alpha = 0.5) {
  if (alpha <= 0 || r < 1) return;
  const img = glowSprite(r, color);
  const h = (img.width - 1) / 2;
  const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
  ctx.globalAlpha = pa * Math.min(1, alpha);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(img, R(x) - h, R(y) - h);
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = op;
}

// ----------------------------------------------------------------- fio luminoso
/**
 * Linha de fio luminoso animada entre dois pontos (coords de mundo no ctx atual).
 * opts: sag (px de barriga no meio), glow (0..2, padrão 1), width (1..3),
 *       stitches (true = marquinhas de ponto), alpha (0..1).
 */
export function drawThreadLine(ctx, x0, y0, x1, y1, t = 0, color = '#ffd23f', opts = {}) {
  const sag = opts.sag ?? 0;
  const glow = opts.glow ?? 1;
  const width = Math.max(1, Math.min(3, R(opts.width ?? 1)));
  const stitches = opts.stitches ?? true;
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0) return;
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.abs(sag);
  const n = Math.max(2, Math.ceil(len));
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    pts[i] = [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag];
  }
  const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
  const light = lighten(color, 0.55), dark = darken(color, 0.35);
  // 1) halo aditivo
  if (glow > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.globalAlpha = pa * alpha * 0.16 * glow;
    const g = width + 2;
    for (let i = 0; i <= n; i += 2) ctx.fillRect(R(pts[i][0]) - (g >> 1) - 1, R(pts[i][1]) - (g >> 1) - 1, g + 2, g + 2);
    ctx.globalAlpha = pa * alpha * 0.22 * glow;
    for (let i = 0; i <= n; i += 2) ctx.fillRect(R(pts[i][0]) - (g >> 1), R(pts[i][1]) - (g >> 1), g, g);
    ctx.globalCompositeOperation = op;
  }
  // 2) núcleo torcido (sombra embaixo, cor, reflexo em diagonal = fio retorcido)
  ctx.globalAlpha = pa * alpha;
  const off = (width - 1) >> 1;
  ctx.fillStyle = dark;
  for (let i = 0; i <= n; i++) ctx.fillRect(R(pts[i][0]) - off, R(pts[i][1]) - off + width, width, 1);
  ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) ctx.fillRect(R(pts[i][0]) - off, R(pts[i][1]) - off, width, width);
  ctx.fillStyle = light;
  const twist = R(t * 12);
  for (let i = 0; i <= n; i++) if ((i + twist) % 4 === 0) ctx.fillRect(R(pts[i][0]) - off, R(pts[i][1]) - off, 1, 1);
  // 3) marquinhas de costura perpendiculares
  if (stitches && n > 10) {
    const ang = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    ctx.fillStyle = light;
    for (let i = 5; i < n - 3; i += 7) {
      const [px, py] = pts[i];
      for (let s = -1 - off; s <= 1 + off + (width > 1 ? 1 : 0); s++) {
        if (s === 0) continue;
        ctx.fillRect(R(px + nx * s), R(py + ny * s), 1, 1);
      }
    }
  }
  // 4) brilho viajante (dois pulsos)
  ctx.globalCompositeOperation = 'lighter';
  for (let p = 0; p < 2; p++) {
    const k = ((t * 0.7 + p * 0.5) % 1 + 1) % 1;
    const ci = Math.floor(k * n);
    for (let d = -5; d <= 5; d++) {
      const i = ci + d;
      if (i < 0 || i > n) continue;
      const f = 1 - Math.abs(d) / 6;
      ctx.globalAlpha = pa * alpha * f * 0.9;
      ctx.fillStyle = Math.abs(d) <= 1 ? '#ffffff' : light;
      ctx.fillRect(R(pts[i][0]) - off, R(pts[i][1]) - off, width, width);
    }
    if (ci >= 0 && ci <= n && glow > 0) {
      ctx.globalAlpha = pa * alpha * 0.35 * glow;
      ctx.fillStyle = light;
      ctx.fillRect(R(pts[ci][0]) - 2, R(pts[ci][1]) - 2, 4 + width - 1, 4 + width - 1);
    }
  }
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = pa;
}

// ----------------------------------------------------------------- portal
/**
 * Redemoinho de portal (braços em espiral, núcleo claro). opts.squash = altura/largura,
 * opts.arms = número de braços, opts.alpha.
 */
export function drawPortalSwirl(ctx, x, y, r, t = 0, colors = ['#ff4fd8', '#a855ff', '#ffffff'], opts = {}) {
  const sq = opts.squash ?? 1;
  const arms = opts.arms ?? 4;
  const alpha = opts.alpha ?? 1;
  const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
  const c0 = colors[0], c1 = colors[1] || c0, c2 = colors[2] || '#ffffff';
  // disco escuro de fundo (profundidade)
  ctx.globalAlpha = pa * alpha * 0.85;
  ctx.fillStyle = darken(c1, 0.55);
  for (let yy = -R(r * sq); yy <= R(r * sq); yy++) {
    const w = R(r * Math.sqrt(Math.max(0, 1 - (yy / (r * sq)) ** 2)));
    ctx.fillRect(R(x) - w, R(y) + yy, w * 2 + 1, 1);
  }
  drawGlow(ctx, x, y, r * 1.1, c1, 0.45 * alpha);
  ctx.globalCompositeOperation = 'lighter';
  const N = Math.max(12, R(r * 2.4));
  for (let a = 0; a < arms; a++) {
    for (let i = 0; i < N; i++) {
      const k = i / N;
      const rad = r * (1 - k * 0.92);
      const an = -t * 3.2 + k * 5.2 + (a / arms) * Math.PI * 2;
      const px = x + Math.cos(an) * rad, py = y + Math.sin(an) * rad * sq;
      ctx.globalAlpha = pa * alpha * (0.35 + 0.65 * k);
      ctx.fillStyle = k > 0.75 ? c2 : k > 0.35 ? c0 : c1;
      const s = k > 0.4 && k < 0.8 ? 2 : 1;
      ctx.fillRect(R(px), R(py), s, s);
    }
  }
  // anel externo tremeluzente
  const M = Math.max(16, R(r * 5));
  for (let i = 0; i < M; i++) {
    const an = (i / M) * Math.PI * 2 + t * 0.8;
    if ((i + R(t * 10)) % 3 === 0) continue;
    ctx.globalAlpha = pa * alpha * 0.7;
    ctx.fillStyle = i % 2 ? c0 : c1;
    ctx.fillRect(R(x + Math.cos(an) * r), R(y + Math.sin(an) * r * sq), 1, 1);
  }
  // núcleo
  ctx.globalAlpha = pa * alpha * (0.75 + Math.sin(t * 6) * 0.2);
  ctx.fillStyle = c2;
  ctx.fillRect(R(x) - 1, R(y) - R(2 * sq), 3, R(4 * sq) + 1);
  ctx.fillRect(R(x) - 2, R(y) - 1, 5, 3);
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = pa;
}

// ----------------------------------------------------------------- entidades transitórias
class VfxBase extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 1; this.h = 1;
    this.z = props.z ?? 70;
    this.alwaysUpdate = true; this.alwaysDraw = true;
    this.dur = props.dur ?? 0.35;
  }
  get k() { return Math.min(1, this.t / this.dur); }
  update(dt) { this.t += dt; if (this.t >= this.dur) this.remove(); }
}

/** Anel de pixels que expande e some. */
const Shockwave = registerEntity('vfx_shockwave', class extends VfxBase {
  draw(ctx) {
    const p = this.props, k = this.k;
    const e = 1 - (1 - k) * (1 - k) * (1 - k);
    const rad = (p.radius ?? 40) * e;
    const th = Math.max(1, R((p.thickness ?? 2) * (1 - k * 0.6)));
    const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const N = Math.max(12, R(rad * 2.2));
    for (let j = 0; j < th + 1; j++) {
      const rr = rad - j;
      if (rr < 1) break;
      ctx.globalAlpha = pa * (1 - k) * (j === th ? 0.35 : 0.9);
      ctx.fillStyle = j === 0 ? (p.color2 ?? '#ffffff') : (p.color ?? '#ffe27a');
      for (let i = 0; i < N; i++) {
        const an = (i / N) * Math.PI * 2;
        ctx.fillRect(R(this.x + Math.cos(an) * rr), R(this.y + Math.sin(an) * rr * (p.squash ?? 1)), 1, 1);
      }
    }
    if (k < 0.35) drawGlow(ctx, this.x, this.y, (p.radius ?? 40) * 0.6, p.color ?? '#ffe27a', 0.5 * (1 - k / 0.35));
    ctx.globalCompositeOperation = op; ctx.globalAlpha = pa;
  }
});

/** Estrela de impacto: raios que crescem e encolhem + clarão central. */
const Impact = registerEntity('vfx_impact', class extends VfxBase {
  constructor(l, x, y, p) { super(l, x, y, p); this.rot = p.rot ?? Math.random() * Math.PI; this.dur = p.dur ?? 0.18; }
  draw(ctx) {
    const p = this.props, k = this.k;
    const size = (p.size ?? 12) * (k < 0.3 ? k / 0.3 : 1);
    const rays = p.rays ?? 6;
    const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * (1 - k);
    for (let r = 0; r < rays; r++) {
      const an = this.rot + (r / rays) * Math.PI * 2;
      const L = size * (r % 2 ? 0.55 : 1);
      const start = L * k * 0.6;
      ctx.fillStyle = p.color ?? '#fff3a0';
      for (let i = start; i < L; i++) ctx.fillRect(R(this.x + Math.cos(an) * i), R(this.y + Math.sin(an) * i), 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    const c = Math.max(1, R(4 * (1 - k)));
    ctx.fillRect(R(this.x) - c, R(this.y) - 1, c * 2 + 1, 3);
    ctx.fillRect(R(this.x) - 1, R(this.y) - c, 3, c * 2 + 1);
    drawGlow(ctx, this.x, this.y, (p.size ?? 12) * 0.9, p.color ?? '#fff3a0', 0.6 * (1 - k));
    ctx.globalCompositeOperation = op; ctx.globalAlpha = pa;
  }
});

/** Texto que sobe e desaparece (ex.: "+5", "Fio antigo!"). */
const FloatText = registerEntity('vfx_text', class extends VfxBase {
  constructor(l, x, y, p) { super(l, x, y, p); this.dur = p.dur ?? 1.0; this.z = 80; }
  draw(ctx) {
    const k = this.k;
    const pop = k < 0.12 ? 1 + (0.12 - k) * 3 : 1;
    const yy = this.y - 18 * (1 - (1 - k) * (1 - k));
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * (k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1);
    font.draw(ctx, this.props.text ?? '', R(this.x), R(yy - (pop - 1) * 4), { color: this.props.color ?? '#ffffff', align: 'center', outline: '#1b1026' });
    ctx.globalAlpha = pa;
  }
});

/** Anel de choque (entidade transitória). */
export function spawnShockwave(level, x, y, opts = {}) {
  if (!level?.add) return null;
  const e = level.add(new Shockwave(level, x, y, opts));
  if (opts.particles !== false) level.particles?.emit('stitch_spark', x, y, opts.sparks ?? 8, opts.color ? { colors: [opts.color, '#ffffff'] } : undefined);
  return e;
}
/** Estrela de impacto (entidade transitória). */
export function spawnImpact(level, x, y, opts = {}) {
  if (!level?.add) return null;
  const e = level.add(new Impact(level, x, y, opts));
  if (opts.particles !== false) level.particles?.emit('hit', x, y, opts.sparks ?? 5);
  return e;
}
/** Texto flutuante. */
export function spawnFloatingText(level, x, y, text, color = '#ffffff') {
  if (!level?.add) return null;
  return level.add(new FloatText(level, x, y, { text, color }));
}

// ----------------------------------------------------------------- presets ambientes
registerParticle('w1_fireflies', { rate: 2.5, life: [2.5, 4.5], speed: [2, 9], angle: [0, 360], gravity: -2, drag: 0.3, wobble: 14, size: [1, 2], colors: ['#e8ff7a', '#c8ff5a', '#fff6a8'], shape: 'square', additive: true, front: false });
registerParticle('w1_spores', { rate: 3.5, life: [3, 5], speed: [2, 6], angle: [240, 300], gravity: -4, wobble: 10, size: [1, 1], colors: ['#c89bff', '#a070e0', '#e8c8ff', '#8fe0c0'], shape: 'pixel', additive: true });
registerParticle('w2_bubbles', { rate: 3, fromBottom: true, life: [3.5, 6], speed: [10, 22], angle: [260, 280], gravity: -12, drag: 0.2, wobble: 22, size: [1, 2.5], colors: ['#c8f4ff', '#ffffff', '#9fe8ff'], shape: 'ring', front: false });
registerParticle('w2_plankton', { rate: 6, life: [2, 4], speed: [1, 6], angle: [0, 360], wobble: 6, size: [1, 1], colors: ['#8ff0e0', '#ffffff', '#ff9ac0'], shape: 'pixel', additive: true, front: false });
registerParticle('w3_sparks', { rate: 1.6, life: [0.6, 1.2], speed: [20, 50], angle: [60, 120], gravity: 90, size: [1, 1], colors: ['#ffd23f', '#ff9a3c', '#fff3c0'], shape: 'spark', additive: true });
registerParticle('w3_dust', { rate: 5, life: [3, 5], speed: [1, 5], angle: [0, 360], wobble: 6, size: [1, 1], colors: ['#e8c890', '#c8a060', '#fff0c8'], shape: 'pixel', additive: true, front: false });
registerParticle('w4_dust', { rate: 4, life: [3, 5], speed: [1, 4], angle: [0, 360], wobble: 5, size: [1, 1], colors: ['#6a6a9a', '#8a8ab8', '#b8b0e0'], shape: 'pixel', front: false });
registerParticle('w4_ash', { rate: 4, life: [3, 5], speed: [6, 14], angle: [75, 105], gravity: 3, wobble: 16, size: [1, 2], colors: ['#3a3050', '#5a4a70', '#2a2238'], shape: 'square', spin: [-2, 2] });
registerParticle('w5_threads', { rate: 1.8, life: [3, 5], speed: [3, 10], angle: [0, 360], wobble: 8, size: [1.5, 3], colors: ['#ffd23f', '#ffe27a', '#ff8ac0'], shape: 'thread', spin: [-1, 1], additive: true, front: false });
registerParticle('w5_embers', { rate: 5, fromBottom: true, life: [2.5, 4.5], speed: [14, 34], angle: [250, 290], gravity: -10, wobble: 20, size: [1, 1], colors: ['#ff5a7a', '#ff3cbc', '#ffd23f', '#ff9a3c'], shape: 'pixel', additive: true });

// ----------------------------------------------------------------- presets de efeito
registerParticle('impact_ring', { life: [0.25, 0.3], speed: [0, 0], size: [4, 4], colors: ['#ffffff'], shape: 'ring', additive: true });
registerParticle('stitch_spark', { life: [0.15, 0.35], speed: [60, 150], angle: [0, 360], drag: 5, size: [1, 1], colors: ['#ffd23f', '#fff3a0', '#ffffff'], shape: 'spark', additive: true });
registerParticle('unravel_fiber', { life: [0.5, 1.0], speed: [20, 80], angle: [0, 360], gravity: 40, drag: 1.5, size: [1.5, 3], colors: ['#3fc7c0', '#7fe6df', '#ffd23f'], shape: 'thread', spin: [-6, 6] });
registerParticle('rewind_glyph', { life: [0.5, 1.0], speed: [10, 35], angle: [0, 360], gravity: -10, drag: 1, size: [2, 3], colors: ['#7fe6ff', '#c8f6ff', '#ffffff'], shape: 'ring', shrink: true, additive: true });
registerParticle('ghost_patch', { life: [0.5, 1.0], speed: [5, 25], angle: [0, 360], gravity: -20, drag: 1, size: [1, 3], colors: ['#c8b8ff', '#e8e0ff', '#9f8fe0'], shape: 'square', shrink: true, additive: true });
registerParticle('confetti', { life: [0.9, 1.6], speed: [80, 180], angle: [220, 320], gravity: 170, drag: 1.6, wobble: 20, size: [1, 2], colors: ['#ff4f7a', '#ffd23f', '#3fc7c0', '#a855ff', '#7fe07a', '#ffffff'], shape: 'square', spin: [-8, 8], fade: false });
registerParticle('stars_burst', { life: [0.4, 0.8], speed: [40, 110], angle: [0, 360], drag: 3, size: [1, 2], colors: ['#ffe27a', '#ffffff', '#ffd23f'], shape: 'star', additive: true });
registerParticle('tear_drop', { life: [0.5, 0.9], speed: [0, 20], angle: [80, 100], gravity: 380, size: [1, 2], colors: ['#7fd6ff', '#c8f0ff'], shape: 'square' });
registerParticle('ink', { life: [0.4, 0.9], speed: [20, 70], angle: [0, 360], gravity: 120, drag: 1, size: [1, 3], colors: ['#1a0f2a', '#2d1b45', '#3e2a5e'], shape: 'circle', shrink: true });
registerParticle('glass_shard', { life: [0.4, 0.9], speed: [60, 160], angle: [200, 340], gravity: 420, drag: 0.5, size: [1, 2], colors: ['#d8f4ff', '#ffffff', '#a8d8f0'], shape: 'square', spin: [-10, 10] });
registerParticle('clock_shard', { life: [0.5, 1.0], speed: [50, 140], angle: [200, 340], gravity: 320, drag: 0.5, size: [1, 2], colors: ['#ffd23f', '#c88a2a', '#fff3c0', '#8a5a1a'], shape: 'square', spin: [-10, 10] });
registerParticle('shadow_wisp', { life: [0.6, 1.2], speed: [5, 20], angle: [0, 360], gravity: -25, drag: 0.8, wobble: 15, size: [2, 4], colors: ['#1a0f2a', '#2d1b45', '#4a2a6a'], shape: 'circle', shrink: true });
