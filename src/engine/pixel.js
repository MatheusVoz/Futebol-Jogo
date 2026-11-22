// =============================================================================
// pixel.js — PixelCanvas: desenho de pixel art nítido (sem anti-aliasing).
//
// Todo sprite, tile, fundo e ícone do jogo é desenhado PROCEDURALMENTE com
// estas primitivas na inicialização e depois cacheado em canvases.
//
//   const pc = new PixelCanvas(32, 32);
//   pc.ellipse(16, 20, 8, 6, '#3fc7c0');
//   pc.line(4, 4, 20, 9, '#000');
//   pc.outline('#1b1430');          // contorno automático de 1px
//   pc.flush();                     // grava o buffer no canvas
//   ctx.drawImage(pc.canvas, x, y);
//
// Cores: strings '#rgb' | '#rrggbb' | '#rrggbbaa'. Pixels com alpha < 255 são
// misturados (blend) com o que já existe no buffer.
// =============================================================================
import { parseColor, clamp } from './util.js';

const u32Cache = new Map();
/** Convert color string to little-endian packed ABGR uint32 used by ImageData. */
export function colorU32(c) {
  if (typeof c === 'number') return c;
  let v = u32Cache.get(c);
  if (v === undefined) {
    const [r, g, b, a] = parseColor(c);
    v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    u32Cache.set(c, v);
  }
  return v;
}

export function createCanvas(w, h) {
  let c;
  if (typeof document !== 'undefined') {
    c = document.createElement('canvas');
    c.width = w; c.height = h;
  } else {
    c = new OffscreenCanvas(w, h);
  }
  return c;
}

export class PixelCanvas {
  constructor(w, h) {
    this.w = w | 0;
    this.h = h | 0;
    this.canvas = createCanvas(this.w, this.h);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.ctx.imageSmoothingEnabled = false;
    this.image = this.ctx.createImageData(this.w, this.h);
    this.buf = new Uint32Array(this.image.data.buffer);
    this.ox = 0; // translation offset applied to all primitives
    this.oy = 0;
  }

  /** Translate subsequent drawing (handy for drawing at frame offsets). */
  translate(x, y) { this.ox += x; this.oy += y; return this; }
  resetTranslate() { this.ox = 0; this.oy = 0; return this; }

  clear() { this.buf.fill(0); return this; }

  /** Write buffer to the canvas. Call once after drawing. */
  flush() { this.ctx.putImageData(this.image, 0, 0); return this; }

  /** Read canvas pixels back into the buffer (after using ctx drawing calls). */
  pull() {
    this.image = this.ctx.getImageData(0, 0, this.w, this.h);
    this.buf = new Uint32Array(this.image.data.buffer);
    return this;
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  /** Get packed color at (x,y) (absolute coords, ignores translate). 0 = transparent. */
  getU32(x, y) { return this.inside(x, y) ? this.buf[y * this.w + x] : 0; }
  alphaAt(x, y) { return this.getU32(x, y) >>> 24; }

  /** Set one pixel (with translate). */
  px(x, y, c) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const v = colorU32(c);
    const a = v >>> 24;
    const i = y * this.w + x;
    if (a === 255 || a === 0) { if (a) this.buf[i] = v; return this; }
    // alpha blend over existing pixel
    const d = this.buf[i];
    const da = d >>> 24;
    if (da === 0) { this.buf[i] = v; return this; }
    const t = a / 255;
    const r = (v & 255) * t + (d & 255) * (1 - t);
    const g = ((v >>> 8) & 255) * t + ((d >>> 8) & 255) * (1 - t);
    const b = ((v >>> 16) & 255) * t + ((d >>> 16) & 255) * (1 - t);
    const na = Math.min(255, a + da * (1 - t));
    this.buf[i] = ((na << 24) | (b << 16) | (g << 8) | r) >>> 0;
    return this;
  }

  /** Erase a pixel (make transparent). */
  erase(x, y) {
    x = Math.floor(x + this.ox); y = Math.floor(y + this.oy);
    if (this.inside(x, y)) this.buf[y * this.w + x] = 0;
    return this;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  strokeRect(x, y, w, h, c) {
    for (let i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c); }
    for (let j = 1; j < h - 1; j++) { this.px(x, y + j, c); this.px(x + w - 1, y + j, c); }
    return this;
  }
  hline(x, y, w, c) { for (let i = 0; i < w; i++) this.px(x + i, y, c); return this; }
  vline(x, y, h, c) { for (let j = 0; j < h; j++) this.px(x, y + j, c); return this; }

  /** Bresenham line. */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  /** Thick line made of filled circles. */
  thickLine(x0, y0, x1, y1, r, c) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
    }
    return this;
  }

  /** Filled ellipse centered at (cx,cy) with radii rx, ry. Crisp edges. */
  ellipse(cx, cy, rx, ry, c) {
    if (rx <= 0 || ry <= 0) { this.px(cx, cy, c); return this; }
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const span = rx * Math.sqrt(1 - dy * dy);
      const xa = Math.round(cx - span), xb = Math.round(cx + span);
      for (let x = xa; x < xb; x++) this.px(x, y, c);
    }
    return this;
  }
  circle(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }

  /** Ellipse outline (1px ring). */
  ellipseOutline(cx, cy, rx, ry, c) {
    const steps = Math.max(12, Math.ceil((rx + ry) * 4));
    let lx = null, ly = null;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx - 0.5), y = Math.round(cy + Math.sin(a) * ry - 0.5);
      if (x !== lx || y !== ly) this.px(x, y, c);
      lx = x; ly = y;
    }
    return this;
  }
  ring(cx, cy, r, c) { return this.ellipseOutline(cx, cy, r, r, c); }

  /** Filled polygon (scanline). points: [[x,y],...] */
  poly(points, c) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c);
      }
    }
    return this;
  }

  /** Triangle helper. */
  tri(x0, y0, x1, y1, x2, y2, c) { return this.poly([[x0, y0], [x1, y1], [x2, y2]], c); }

  /** Quadratic bezier curve stroke. */
  curve(x0, y0, cx, cy, x1, y1, c, thickness = 0) {
    const steps = Math.ceil(Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy)) + 1;
    let px0 = x0, py0 = y0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      const x = it * it * x0 + 2 * it * t * cx + t * t * x1;
      const y = it * it * y0 + 2 * it * t * cy + t * t * y1;
      if (thickness > 0) this.thickLine(px0, py0, x, y, thickness, c);
      else this.line(px0, py0, x, y, c);
      px0 = x; py0 = y;
    }
    return this;
  }

  /**
   * Ordered-dither fill between two colors. level 0..1 = proportion of c2.
   * Gives the classic pixel-art gradient look.
   */
  dither(x, y, w, h, c1, c2, level) {
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ax = Math.floor(x + i + this.ox), ay = Math.floor(y + j + this.oy);
        const th = (B[(ay & 3) * 4 + (ax & 3)] + 0.5) / 16;
        const c = (typeof level === 'function' ? level(i, j) : level) > th ? c2 : c1;
        if (c) this.px(x + i, y + j, c);
      }
    return this;
  }

  /** Vertical gradient with ordered dithering across a list of color stops. */
  vgradient(x, y, w, h, colors) {
    const n = colors.length - 1;
    return this.ditherFn(x, y, w, h, (i, j) => {
      const t = (j / Math.max(1, h - 1)) * n;
      const k = Math.min(n - 1, Math.floor(t));
      return [colors[k], colors[k + 1], t - k];
    });
  }

  /** Generic dithered fill: fn(i,j) -> [colorA, colorB, mix] */
  ditherFn(x, y, w, h, fn) {
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ax = Math.floor(x + i + this.ox), ay = Math.floor(y + j + this.oy);
        const th = (B[(ay & 3) * 4 + (ax & 3)] + 0.5) / 16;
        const [a, b, t] = fn(i, j);
        this.px(x + i, y + j, t > th ? b : a);
      }
    return this;
  }

  /**
   * Draw ASCII art. rows: array of strings; palette: {char: color}. ' ' and '.'
   * are transparent unless present in palette.
   */
  ascii(rows, palette, x = 0, y = 0, { flipX = false } = {}) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        const c = palette[ch];
        if (c === undefined || c === null) continue;
        this.px(x + (flipX ? row.length - 1 - i : i), y + j, c);
      }
    }
    return this;
  }

  /**
   * Add an outline around all opaque pixels (absolute buffer pass).
   * diagonal=true also fills diagonal neighbours (thicker look).
   */
  outline(c, { diagonal = false, inside = false } = {}) {
    const v = colorU32(c);
    const { w, h } = this;
    const src = this.buf.slice();
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 40;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const solid = op(x, y);
        if (inside) {
          if (solid && (!op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1))) this.buf[y * w + x] = v;
          continue;
        }
        if (solid) continue;
        let n = op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1);
        if (!n && diagonal) n = op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1);
        if (n) this.buf[y * w + x] = v;
      }
    return this;
  }

  /** Recolor every opaque pixel matching `from` to `to`. */
  replaceColor(from, to) {
    const f = colorU32(from), t = colorU32(to);
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] === f) this.buf[i] = t;
    return this;
  }

  /** Map every opaque pixel through fn(r,g,b,a) -> [r,g,b,a]. */
  mapPixels(fn) {
    for (let i = 0; i < this.buf.length; i++) {
      const v = this.buf[i];
      const a = v >>> 24;
      if (!a) continue;
      const [r, g, b, na] = fn(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, a);
      this.buf[i] = ((clamp(na, 0, 255) << 24) | (clamp(b, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(r, 0, 255)) >>> 0;
    }
    return this;
  }

  /** Copy another PixelCanvas into this buffer at (x,y) with optional flip. */
  blit(src, x = 0, y = 0, { flipX = false, sx = 0, sy = 0, sw = src.w, sh = src.h } = {}) {
    for (let j = 0; j < sh; j++)
      for (let i = 0; i < sw; i++) {
        const v = src.buf[(sy + j) * src.w + (sx + (flipX ? sw - 1 - i : i))];
        if (v >>> 24) this.px(x + i, y + j, v);
      }
    return this;
  }
}

/**
 * Convenience: create a PixelCanvas, run draw(pc), flush, return the canvas.
 */
export function paint(w, h, draw) {
  const pc = new PixelCanvas(w, h);
  draw(pc);
  pc.flush();
  return pc.canvas;
}

/** Make a solid-color silhouette copy (used for hit flashes, ghosts). */
export function silhouette(srcCanvas, color, alpha = 1) {
  const c = createCanvas(srcCanvas.width, srcCanvas.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}
