// =============================================================================
// font.js — Fonte bitmap em pixel art com acentuação do português.
//
//   font.draw(ctx, 'Olá, Tico!', x, y, { color:'#fff', shadow:'#000', align:'center' })
//   font.measure('texto')          -> largura em px
//   font.wrap('texto longo', 120)  -> array de linhas
//
// Marcação inline:
//   {#ffcc33}texto amarelo{/}      cor temporária
//   {i:icon_button}                ícone registrado com defineImage()
// Altura da capitular: 7px. Avanço de linha padrão: 10px.
// =============================================================================
import { createCanvas } from './pixel.js';
import { getImage } from './sprites.js';

// Glyph rows: '/' separates rows. Rows start at cap-top (y=0). 7 main rows,
// optional rows 8-9 = descenders.
const G = {
  A: '.xxx./x...x/x...x/xxxxx/x...x/x...x/x...x',
  B: 'xxxx./x...x/x...x/xxxx./x...x/x...x/xxxx.',
  C: '.xxx./x...x/x..../x..../x..../x...x/.xxx.',
  D: 'xxxx./x...x/x...x/x...x/x...x/x...x/xxxx.',
  E: 'xxxxx/x..../x..../xxxx./x..../x..../xxxxx',
  F: 'xxxxx/x..../x..../xxxx./x..../x..../x....',
  G: '.xxx./x...x/x..../x.xxx/x...x/x...x/.xxxx',
  H: 'x...x/x...x/x...x/xxxxx/x...x/x...x/x...x',
  I: 'xxx/.x./.x./.x./.x./.x./xxx',
  J: '..xxx/...x./...x./...x./...x./x..x./.xx..',
  K: 'x...x/x..x./x.x../xx.../x.x../x..x./x...x',
  L: 'x..../x..../x..../x..../x..../x..../xxxxx',
  M: 'x...x/xx.xx/x.x.x/x.x.x/x...x/x...x/x...x',
  N: 'x...x/xx..x/x.x.x/x..xx/x...x/x...x/x...x',
  O: '.xxx./x...x/x...x/x...x/x...x/x...x/.xxx.',
  P: 'xxxx./x...x/x...x/xxxx./x..../x..../x....',
  Q: '.xxx./x...x/x...x/x...x/x.x.x/x..x./.xx.x',
  R: 'xxxx./x...x/x...x/xxxx./x.x../x..x./x...x',
  S: '.xxxx/x..../x..../.xxx./....x/....x/xxxx.',
  T: 'xxxxx/..x../..x../..x../..x../..x../..x..',
  U: 'x...x/x...x/x...x/x...x/x...x/x...x/.xxx.',
  V: 'x...x/x...x/x...x/x...x/x...x/.x.x./..x..',
  W: 'x...x/x...x/x...x/x.x.x/x.x.x/x.x.x/.x.x.',
  X: 'x...x/x...x/.x.x./..x../.x.x./x...x/x...x',
  Y: 'x...x/x...x/.x.x./..x../..x../..x../..x..',
  Z: 'xxxxx/....x/...x./..x../.x.../x..../xxxxx',
  a: '...../...../.xxx./....x/.xxxx/x...x/.xxxx',
  b: 'x..../x..../xxxx./x...x/x...x/x...x/xxxx.',
  c: '..../..../.xxx/x.../x.../x.../.xxx',
  d: '....x/....x/.xxxx/x...x/x...x/x...x/.xxxx',
  e: '...../...../.xxx./x...x/xxxxx/x..../.xxx.',
  f: '..xx/.x../xxxx/.x../.x../.x../.x..',
  g: '...../...../.xxxx/x...x/x...x/x...x/.xxxx/....x/.xxx.',
  h: 'x..../x..../xxxx./x...x/x...x/x...x/x...x',
  i: 'x/./x/x/x/x/x',
  j: '..x/.../..x/..x/..x/..x/..x/x.x/.x.',
  k: 'x.../x.../x..x/x.x./xx../x.x./x..x',
  l: 'x./x./x./x./x./x./.x',
  m: '...../...../xx.x./x.x.x/x.x.x/x.x.x/x.x.x',
  n: '...../...../xxxx./x...x/x...x/x...x/x...x',
  o: '...../...../.xxx./x...x/x...x/x...x/.xxx.',
  p: '...../...../xxxx./x...x/x...x/x...x/xxxx./x..../x....',
  q: '...../...../.xxxx/x...x/x...x/x...x/.xxxx/....x/....x',
  r: '..../..../x.xx/xx../x.../x.../x...',
  s: '..../..../.xxx/x.../.xx./...x/xxx.',
  t: '.x../.x../xxxx/.x../.x../.x../..xx',
  u: '...../...../x...x/x...x/x...x/x...x/.xxxx',
  v: '...../...../x...x/x...x/x...x/.x.x./..x..',
  w: '...../...../x...x/x...x/x.x.x/x.x.x/.x.x.',
  x: '...../...../x...x/.x.x./..x../.x.x./x...x',
  y: '...../...../x...x/x...x/x...x/x...x/.xxxx/....x/.xxx.',
  z: '...../...../xxxxx/...x./..x../.x.../xxxxx',
  0: '.xxx./x...x/x..xx/x.x.x/xx..x/x...x/.xxx.',
  1: '..x../.xx../..x../..x../..x../..x../.xxx.',
  2: '.xxx./x...x/....x/...x./..x../.x.../xxxxx',
  3: 'xxxx./....x/....x/.xxx./....x/....x/xxxx.',
  4: '...x./..xx./.x.x./x..x./xxxxx/...x./...x.',
  5: 'xxxxx/x..../xxxx./....x/....x/x...x/.xxx.',
  6: '.xxx./x..../x..../xxxx./x...x/x...x/.xxx.',
  7: 'xxxxx/....x/...x./..x../.x.../.x.../.x...',
  8: '.xxx./x...x/x...x/.xxx./x...x/x...x/.xxx.',
  9: '.xxx./x...x/x...x/.xxxx/....x/....x/.xxx.',
  '!': 'x/x/x/x/x/./x',
  '?': '.xxx./x...x/....x/...x./..x../...../..x..',
  '.': './././././x',
  ',': '../../../../../.x/x.',
  ':': './././x/./x/.',
  ';': '../../../.x/../.x/x.',
  '-': '.../.../.../xxx/.../.../...',
  '+': '...../..x../..x../xxxxx/..x../..x../.....',
  '=': '..../..../xxxx/..../xxxx/..../....',
  '/': '....x/....x/...x./..x../.x.../x..../x....',
  '\\': 'x..../x..../.x.../..x../...x./....x/....x',
  '(': '.x/x./x./x./x./x./.x',
  ')': 'x./.x/.x/.x/.x/.x/x.',
  '[': 'xx/x./x./x./x./x./xx',
  ']': 'xx/.x/.x/.x/.x/.x/xx',
  "'": 'x/x/./././././.',
  '"': 'x.x/x.x/.../.../.../.../...',
  '%': 'xx..x/xx.x./...x./..x../.x.../.x.xx/x..xx',
  '*': '...../x.x.x/.xxx./xxxxx/.xxx./x.x.x/.....',
  '#': '.x.x./xxxxx/.x.x./.x.x./.x.x./xxxxx/.x.x.',
  '<': '...x/..x./.x../x.../.x../..x./...x',
  '>': 'x.../.x../..x./...x/..x./.x../x...',
  '_': '..../..../..../..../..../..../xxxx',
  '&': '.x../x.x./x.x./.x../x.xx/x..x/.xx.',
  '~': '...../...../.x..x/x.xx./...../...../.....',
  '^': '.x./x.x/.../.../.../.../...',
  '|': 'x/x/x/x/x/x/x',
  '@': '.xxx./x...x/x.xxx/x.x.x/x.xxx/x..../.xxx.',
  $: '..x../.xxxx/x.x../.xxx./..x.x/xxxx./..x..',
  '…': './././././x.x.x',
  '—': '...../...../...../xxxxx/...../...../.....',
  '–': '..../..../..../xxxx/..../..../....',
  '«': '...../..x.x/.x.x./x.x../.x.x./..x.x/.....',
  '»': '...../x.x../.x.x./..x.x/.x.x./x.x../.....',
  'º': 'xx/xx/../../../../..',
  'ª': 'xx/xx/../../../../..',
  '♥': '...../.x.x./xxxxx/xxxxx/.xxx./..x../.....',
  '★': '..x../..x../xxxxx/.xxx./.x.x./x...x/.....',
  '•': './././x/./././.',
  '→': '...../..x../...x./xxxxx/...x./..x../.....',
  '←': '...../..x../.x.../xxxxx/.x.../..x../.....',
  '↑': '..x../.xxx./x.x.x/..x../..x../..x../.....',
  '↓': '..x../..x../..x../x.x.x/.xxx./..x../.....',
};

const ACCENTS = {
  acute: ['..x', '.x.'],
  grave: ['x..', '.x.'],
  circ: ['.x.', 'x.x'],
  tilde: ['.x.x', 'x.x.'],
  diaer: ['...', 'x.x'],
};
const COMPOSE = {
  á: ['a', 'acute'], à: ['a', 'grave'], â: ['a', 'circ'], ã: ['a', 'tilde'], ä: ['a', 'diaer'],
  é: ['e', 'acute'], è: ['e', 'grave'], ê: ['e', 'circ'], ë: ['e', 'diaer'],
  í: ['ı', 'acute'], ì: ['ı', 'grave'], î: ['ı', 'circ'], ï: ['ı', 'diaer'],
  ó: ['o', 'acute'], ò: ['o', 'grave'], ô: ['o', 'circ'], õ: ['o', 'tilde'], ö: ['o', 'diaer'],
  ú: ['u', 'acute'], ù: ['u', 'grave'], û: ['u', 'circ'], ü: ['u', 'diaer'],
  ñ: ['n', 'tilde'],
  Á: ['A', 'acute'], À: ['A', 'grave'], Â: ['A', 'circ'], Ã: ['A', 'tilde'],
  É: ['E', 'acute'], Ê: ['E', 'circ'], Í: ['I', 'acute'], Ó: ['O', 'acute'], Ô: ['O', 'circ'],
  Õ: ['O', 'tilde'], Ú: ['U', 'acute'], Ü: ['U', 'diaer'], Ñ: ['N', 'tilde'],
};

const glyphs = new Map(); // char -> { w, px: [[x,y],...] }

function parseGlyph(src) {
  const rows = src.split('/');
  const w = Math.max(...rows.map((r) => r.length));
  const px = [];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'x') px.push([x, y]); });
  return { w, px };
}
for (const [ch, src] of Object.entries(G)) glyphs.set(String(ch), parseGlyph(src));
glyphs.set(' ', { w: 3, px: [] });
glyphs.set('ı', { w: 3, px: [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6]] }); // dotless i, centered in 3
// ç / Ç
{
  const c = glyphs.get('c'), C = glyphs.get('C');
  glyphs.set('ç', { w: c.w, px: [...c.px, [2, 7], [1, 8]] });
  glyphs.set('Ç', { w: C.w, px: [...C.px, [2, 7], [1, 8]] });
}
for (const [ch, [base, acc]] of Object.entries(COMPOSE)) {
  const b = glyphs.get(base);
  const a = ACCENTS[acc];
  const upper = base === base.toUpperCase() && base !== 'ı';
  const aw = a[0].length;
  const ox = Math.floor((b.w - aw) / 2);
  const oy = upper ? -2 : 0;
  const px = [...b.px];
  a.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'x') px.push([ox + x, oy + y]); });
  glyphs.set(ch, { w: Math.max(b.w, aw), px });
}
const FALLBACK = parseGlyph('xxx/x.x/x.x/x.x/x.x/x.x/xxx');

export const LINE_HEIGHT = 10;
const ATLAS_TOP = 2; // rows above cap for accents
const CELL_H = 12;

// --------------------------------------------------------------- Atlas cache
const charList = [...glyphs.keys()];
const charIndex = new Map(charList.map((c, i) => [c, i]));
const CELL_W = 6;
const atlasCache = new Map();

function getAtlas(color) {
  let a = atlasCache.get(color);
  if (a) return a;
  const cols = 32;
  const rows = Math.ceil((charList.length + 1) / cols);
  a = createCanvas(cols * CELL_W, rows * CELL_H);
  const ctx = a.getContext('2d');
  ctx.fillStyle = color;
  const drawG = (g, idx) => {
    const cx = (idx % cols) * CELL_W, cy = Math.floor(idx / cols) * CELL_H;
    for (const [x, y] of g.px) ctx.fillRect(cx + x, cy + y + ATLAS_TOP, 1, 1);
  };
  charList.forEach((ch, i) => drawG(glyphs.get(ch), i));
  drawG(FALLBACK, charList.length);
  if (atlasCache.size > 48) atlasCache.delete(atlasCache.keys().next().value);
  atlasCache.set(color, a);
  return a;
}

function glyphOf(ch) { return glyphs.get(ch) || FALLBACK; }

// --------------------------------------------------------------- Markup
/** Parse text into tokens: {ch} | {color} | {reset} | {icon}. */
function tokenize(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const end = text.indexOf('}', i);
      if (end > i) {
        const tag = text.slice(i + 1, end);
        if (tag[0] === '#') { out.push({ color: tag }); i = end; continue; }
        if (tag === '/') { out.push({ reset: true }); i = end; continue; }
        if (tag.startsWith('i:')) { out.push({ icon: tag.slice(2) }); i = end; continue; }
      }
    }
    out.push({ ch });
  }
  return out;
}

function tokenWidth(t) {
  if (t.ch !== undefined) {
    if (t.ch === '\n') return 0;
    return glyphOf(t.ch).w + 1;
  }
  if (t.icon) { const img = getImage(t.icon); return img ? img.width + 1 : 0; }
  return 0;
}

export function measure(text) {
  let best = 0;
  for (const line of String(text).split('\n')) {
    let w = 0;
    for (const t of tokenize(line)) w += tokenWidth(t);
    best = Math.max(best, w > 0 ? w - 1 : 0);
  }
  return best;
}

/** Strip markup to get plain visible characters. */
export function plain(text) {
  return tokenize(String(text)).map((t) => (t.ch !== undefined ? t.ch : t.icon ? '■' : '')).join('');
}

/** Word-wrap text (keeps markup). Returns array of lines. */
export function wrap(text, maxWidth) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (measure(test) <= maxWidth || !line) line = test;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

/** Count visible characters (for typewriter effects). */
export function visibleLength(text) {
  return tokenize(String(text)).filter((t) => t.ch !== undefined || t.icon).length;
}

/** Draw a single line, returns width. maxChars limits visible chars (typewriter). */
function drawLine(ctx, line, x, y, color, maxChars, state) {
  let cx = x;
  let cur = color;
  for (const t of tokenize(line)) {
    if (t.color) { cur = state.forceColor || t.color; continue; }
    if (t.reset) { cur = color; continue; }
    if (state.count >= maxChars) break;
    if (t.icon) {
      const img = getImage(t.icon);
      if (img) { ctx.drawImage(img, Math.round(cx), Math.round(y + 7 - img.height + 1)); cx += img.width + 1; }
      state.count++;
      continue;
    }
    const g = glyphOf(t.ch);
    const idx = charIndex.has(t.ch) ? charIndex.get(t.ch) : charList.length;
    const atlas = getAtlas(cur);
    const sx = (idx % 32) * CELL_W, sy = Math.floor(idx / 32) * CELL_H;
    ctx.drawImage(atlas, sx, sy, CELL_W, CELL_H, Math.round(cx), Math.round(y) - ATLAS_TOP, CELL_W, CELL_H);
    cx += g.w + 1;
    state.count++;
  }
  return cx - x;
}

/**
 * Draw text. Options:
 *  color, align ('left'|'center'|'right'), shadow (color), outline (color),
 *  maxWidth (wrap), lineHeight, maxChars (typewriter), scale (integer)
 * Returns {width, height, lines}.
 */
export function draw(ctx, text, x, y, opts = {}) {
  const color = opts.color || '#ffffff';
  const lh = opts.lineHeight || LINE_HEIGHT;
  const lines = opts.maxWidth ? wrap(text, opts.maxWidth) : String(text).split('\n');
  const scale = opts.scale || 1;
  const maxChars = opts.maxChars ?? Infinity;
  if (scale !== 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    const r = draw(ctx, text, 0, 0, { ...opts, scale: 1 });
    ctx.restore();
    return { ...r, width: r.width * scale, height: r.height * scale };
  }
  let width = 0;
  const passes = [];
  if (opts.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) passes.push([dx, dy, opts.outline]);
  } else if (opts.shadow) passes.push([1, 1, opts.shadow]);
  passes.push([0, 0, null]);
  for (const [dx, dy, pc] of passes) {
    const state = { count: 0, forceColor: pc };
    lines.forEach((line, i) => {
      const w = measure(line);
      width = Math.max(width, w);
      let lx = x;
      if (opts.align === 'center') lx = x - Math.floor(w / 2);
      else if (opts.align === 'right') lx = x - w;
      drawLine(ctx, line, lx + dx, y + i * lh + dy, pc || color, maxChars, state);
    });
  }
  return { width, height: lines.length * lh, lines };
}

export const font = { draw, measure, wrap, plain, visibleLength, LINE_HEIGHT };
export default font;
