// =============================================================================
// sprites.js — Registro de spritesheets procedurais.
//
// defineSprite('tico', {
//   w: 32, h: 32,            // tamanho de cada quadro
//   ox: 16, oy: 31,          // pivô (ponto de ancoragem; normalmente os pés)
//   anims: {
//     idle: { frames: 6, fps: 6, loop: true },
//     jump: { frames: 2, fps: 10, loop: false },
//   },
//   draw(pc, anim, frame, nFrames) { ...desenha no PixelCanvas pc (w x h)... },
//   meta(anim, frame) { return { head: {x:16,y:6} } }   // opcional (âncoras)
// });
//
// drawSprite(ctx, 'tico', 'idle', frameIndex, x, y, { flip: true });
// animFrame('tico', 'idle', tSeconds) -> índice do quadro
//
// Os quadros são renderizados uma única vez em um atlas (lazy ou em buildAll).
// =============================================================================
import { PixelCanvas, createCanvas, silhouette } from './pixel.js';

const defs = new Map();
const built = new Map();
const images = new Map();
const imageDefs = new Map();

export function defineSprite(name, def) {
  defs.set(name, def);
  built.delete(name);
}
export function hasSprite(name) { return defs.has(name); }
export function spriteNames() { return [...defs.keys()]; }

function build(name) {
  const def = defs.get(name);
  if (!def) return null;
  const animNames = Object.keys(def.anims);
  const maxFrames = Math.max(...animNames.map((a) => def.anims[a].frames));
  const atlas = createCanvas(def.w * maxFrames, def.h * animNames.length);
  const actx = atlas.getContext('2d');
  const rows = {};
  const metas = {};
  const pc = new PixelCanvas(def.w, def.h);
  animNames.forEach((anim, row) => {
    const a = def.anims[anim];
    rows[anim] = row;
    metas[anim] = [];
    for (let f = 0; f < a.frames; f++) {
      pc.clear();
      pc.resetTranslate();
      try {
        def.draw(pc, anim, f, a.frames);
      } catch (e) {
        console.error(`[sprites] erro desenhando ${name}.${anim}[${f}]`, e);
        pc.rect(0, 0, def.w, def.h, '#ff00ff');
      }
      pc.flush();
      actx.drawImage(pc.canvas, f * def.w, row * def.h);
      metas[anim].push(def.meta ? def.meta(anim, f, a.frames) : null);
    }
  });
  const s = {
    name, w: def.w, h: def.h, ox: def.ox ?? def.w / 2, oy: def.oy ?? def.h,
    anims: def.anims, rows, atlas, metas, variants: {},
  };
  built.set(name, s);
  return s;
}

export function getSprite(name) {
  return built.get(name) || build(name);
}

/** Pre-build every registered sprite (call from the loading screen). */
export async function buildAll(onProgress) {
  const names = [...defs.keys()].filter((n) => !built.has(n));
  let i = 0;
  for (const n of names) {
    build(n);
    i++;
    if (onProgress) onProgress(i / names.length, n);
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

function variantAtlas(s, variant) {
  let v = s.variants[variant];
  if (v) return v;
  if (variant === 'flash') v = silhouette(s.atlas, '#ffffff');
  else if (variant === 'dark') v = silhouette(s.atlas, '#0a0614');
  else if (variant === 'ghost') {
    // translucent cyan "patch" copy used by Retalho Fantasma
    v = createCanvas(s.atlas.width, s.atlas.height);
    const c = v.getContext('2d');
    c.globalAlpha = 0.55;
    c.drawImage(s.atlas, 0, 0);
    c.globalAlpha = 0.45;
    c.drawImage(silhouette(s.atlas, '#9ff6ff'), 0, 0);
  } else if (variant.startsWith('#')) v = silhouette(s.atlas, variant);
  else return s.atlas;
  s.variants[variant] = v;
  return v;
}

/** Frame index for animation time t (seconds). */
export function animFrame(name, anim, t) {
  const s = getSprite(name);
  const a = s?.anims[anim];
  if (!a) return 0;
  const f = Math.floor(t * a.fps);
  if (a.loop === false) return Math.min(f, a.frames - 1);
  return ((f % a.frames) + a.frames) % a.frames;
}
export function animDuration(name, anim) {
  const a = getSprite(name)?.anims[anim];
  return a ? a.frames / a.fps : 0;
}
export function animDone(name, anim, t) {
  const a = getSprite(name)?.anims[anim];
  return !a || t >= a.frames / a.fps;
}
export function frameMeta(name, anim, frame) {
  return getSprite(name)?.metas[anim]?.[frame] ?? null;
}

/**
 * Draw a sprite frame with its pivot at (x, y).
 * opts: flip (bool), alpha, variant ('flash'|'ghost'|'dark'|'#hex'),
 *       scaleX, scaleY, rotation (radians, around pivot)
 */
export function drawSprite(ctx, name, anim, frame, x, y, opts = {}) {
  const s = getSprite(name);
  if (!s) return;
  const row = s.rows[anim];
  if (row === undefined) return;
  const a = s.anims[anim];
  frame = Math.max(0, Math.min(a.frames - 1, frame | 0));
  const img = opts.variant ? variantAtlas(s, opts.variant) : s.atlas;
  const sx = frame * s.w, sy = row * s.h;
  const rx = Math.round(x), ry = Math.round(y);
  const sxl = opts.scaleX ?? 1, syl = opts.scaleY ?? 1;
  const needTransform = opts.flip || opts.rotation || sxl !== 1 || syl !== 1;
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0) return;
  const prevA = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prevA * alpha;
  if (!needTransform) {
    ctx.drawImage(img, sx, sy, s.w, s.h, rx - s.ox, ry - s.oy, s.w, s.h);
  } else {
    ctx.save();
    ctx.translate(rx, ry);
    if (opts.rotation) ctx.rotate(opts.rotation);
    ctx.scale((opts.flip ? -1 : 1) * sxl, syl);
    ctx.drawImage(img, sx, sy, s.w, s.h, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }
  if (alpha !== 1) ctx.globalAlpha = prevA;
}

// ------------------------------------------------------------ Static images
/** defineImage('icon_heart', 9, 8, pc => {...}) — cached procedural image. */
export function defineImage(name, w, h, draw) {
  imageDefs.set(name, { w, h, draw });
  images.delete(name);
}
export function getImage(name) {
  let img = images.get(name);
  if (img) return img;
  const d = imageDefs.get(name);
  if (!d) return null;
  const pc = new PixelCanvas(d.w, d.h);
  try { d.draw(pc); } catch (e) { console.error('[sprites] image', name, e); pc.rect(0, 0, d.w, d.h, '#f0f'); }
  pc.flush();
  img = pc.canvas;
  images.set(name, img);
  return img;
}
export function hasImage(name) { return imageDefs.has(name); }
export function drawImage(ctx, name, x, y, opts = {}) {
  const img = getImage(name);
  if (!img) return;
  const prevA = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevA * opts.alpha;
  if (opts.flip) {
    ctx.save();
    ctx.translate(Math.round(x) + img.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else ctx.drawImage(img, Math.round(x), Math.round(y));
  ctx.globalAlpha = prevA;
}
