// =============================================================================
// lighting.js — Iluminação 2D em pixel art (luz em faixas, sem gradiente borrado).
//
// A cada quadro: lighting.begin(darkness, color) ; entidades chamam
// lighting.add(x, y, radius, color, intensity) em coords de MUNDO; a cena
// chama lighting.render(ctx, cam) após desenhar o mundo.
// darkness 0 = sem escuridão (só brilhos aditivos), 1 = breu total.
// =============================================================================
import { createCanvas } from './pixel.js';
import { parseColor } from './util.js';

const BANDS = 5;

export class Lighting {
  constructor(w, h) {
    this.resize(w, h);
    this.lights = [];
    this.darkness = 0;
    this.color = '#0a0618';
    this.glowCache = new Map();
  }
  resize(w, h) {
    this.w = w; this.h = h;
    this.canvas = createCanvas(w, h);
    this.ctx = this.canvas.getContext('2d');
  }
  begin(darkness = 0, color = '#0a0618') {
    this.lights.length = 0;
    this.darkness = darkness;
    this.color = color;
  }
  /** Add a light. color tints an additive glow. flicker 0..1 adds jitter. */
  add(x, y, radius, color = '#ffe8b0', intensity = 1, flicker = 0) {
    this.lights.push({ x, y, radius, color, intensity, flicker });
  }

  /** Banded radial "hole" sprite for darkness punch-out (cached by radius). */
  holeSprite(r) {
    r = Math.max(4, Math.round(r / 2) * 2);
    const key = 'h' + r;
    let c = this.glowCache.get(key);
    if (c) return c;
    c = createCanvas(r * 2, r * 2);
    const x = c.getContext('2d');
    for (let b = BANDS; b >= 1; b--) {
      const rr = (r * b) / BANDS;
      x.globalAlpha = 1;
      x.fillStyle = `rgba(0,0,0,${(1 - (b - 1) / BANDS) * 0.9 + 0.1})`;
      x.globalCompositeOperation = 'source-over';
      x.beginPath();
      x.arc(r, r, rr, 0, Math.PI * 2);
      x.fill();
    }
    // inner bands must be stronger -> redraw from outside in with increasing alpha
    x.clearRect(0, 0, r * 2, r * 2);
    for (let b = BANDS; b >= 1; b--) {
      const rr = (r * b) / BANDS;
      x.fillStyle = `rgba(0,0,0,${1 - (b - 1) / BANDS})`;
      x.beginPath();
      x.arc(r, r, rr, 0, Math.PI * 2);
      x.fill();
    }
    this.glowCache.set(key, c);
    return c;
  }
  glowSprite(r, color) {
    r = Math.max(4, Math.round(r / 2) * 2);
    const key = 'g' + r + color;
    let c = this.glowCache.get(key);
    if (c) return c;
    c = createCanvas(r * 2, r * 2);
    const x = c.getContext('2d');
    const [cr, cg, cb] = parseColor(color);
    for (let b = BANDS; b >= 1; b--) {
      const rr = (r * b) / BANDS;
      x.fillStyle = `rgba(${cr},${cg},${cb},${0.08})`;
      x.beginPath();
      x.arc(r, r, rr, 0, Math.PI * 2);
      x.fill();
    }
    if (this.glowCache.size > 200) this.glowCache.clear();
    this.glowCache.set(key, c);
    return c;
  }

  render(ctx, cam) {
    const zoom = cam.zoom || 1;
    const ox = cam.rx, oy = cam.ry;
    const t = performance.now() / 1000;
    // 1) additive glows (always)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.lights) {
      const f = L.flicker ? 1 + Math.sin(t * 13 + L.x) * 0.06 * L.flicker + Math.sin(t * 7.3 + L.y) * 0.05 * L.flicker : 1;
      const r = L.radius * f * zoom;
      ctx.globalAlpha = Math.min(1, L.intensity * 0.9);
      const g = this.glowSprite(r * 0.8, L.color);
      ctx.drawImage(g, Math.round((L.x - ox) * zoom - g.width / 2), Math.round((L.y - oy) * zoom - g.height / 2));
    }
    ctx.restore();
    // 2) darkness with holes
    if (this.darkness <= 0.01) return;
    const lc = this.ctx;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, this.w, this.h);
    lc.globalAlpha = 1;
    lc.fillStyle = this.color;
    lc.fillRect(0, 0, this.w, this.h);
    lc.globalCompositeOperation = 'destination-out';
    for (const L of this.lights) {
      const f = L.flicker ? 1 + Math.sin(t * 11 + L.x) * 0.05 * L.flicker : 1;
      const r = L.radius * f * zoom * 1.15;
      const h = this.holeSprite(r);
      lc.globalAlpha = Math.min(1, L.intensity);
      lc.drawImage(h, Math.round((L.x - ox) * zoom - h.width / 2), Math.round((L.y - oy) * zoom - h.height / 2));
    }
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = this.darkness;
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }
}
