// =============================================================================
// util.js — Pequenas funções matemáticas e utilitárias usadas em todo o jogo.
// =============================================================================

export const TILE = 16;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const wrap = (v, max) => ((v % max) + max) % max;
export const smoothstep = (t) => t * t * (3 - 2 * t);
/** Exponential smoothing independent of frame rate. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Deterministic seeded RNG (mulberry32). rng() -> [0,1). */
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (a, b) => a + Math.floor(rng() * (b - a + 1)); // inclusive
  rng.range = (a, b) => a + rng() * (b - a);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
}

/** Hash two ints into a stable pseudo-random value [0,1). Useful for tile variation. */
export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Global random (non-deterministic) helpers
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

// ---------------------------------------------------------------- Easing
export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => --t * t * t + 1,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// ---------------------------------------------------------------- Colors
const _colorCache = new Map();
/** Parse '#rgb', '#rrggbb', '#rrggbbaa' or 'transparent' into [r,g,b,a] (0-255). */
export function parseColor(c) {
  if (Array.isArray(c)) return c;
  let v = _colorCache.get(c);
  if (v) return v;
  if (c === 'transparent' || c == null) v = [0, 0, 0, 0];
  else if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255];
  } else if (c.startsWith('rgb')) {
    const m = c.match(/[\d.]+/g).map(Number);
    v = [m[0], m[1], m[2], m[3] === undefined ? 255 : Math.round(m[3] * 255)];
  } else v = [255, 0, 255, 255];
  _colorCache.set(c, v);
  return v;
}

export function toHex([r, g, b, a = 255]) {
  const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b) + (a < 255 ? h(a) : '');
}

/** Mix two colors (strings), t in [0,1]. Returns hex string. */
export function mixColor(c1, c2, t) {
  const a = parseColor(c1), b = parseColor(c2);
  return toHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]);
}
export const darken = (c, t) => mixColor(c, '#000000', t);
export const lighten = (c, t) => mixColor(c, '#ffffff', t);
export function withAlpha(c, a) {
  const [r, g, b] = parseColor(c);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- Timers
/** Simple countdown helper. */
export class Timer {
  constructor(duration = 0) { this.duration = duration; this.t = 0; }
  start(d = this.duration) { this.duration = d; this.t = d; return this; }
  update(dt) { if (this.t > 0) this.t = Math.max(0, this.t - dt); return this.t; }
  get active() { return this.t > 0; }
  get done() { return this.t <= 0; }
  get progress() { return this.duration > 0 ? 1 - this.t / this.duration : 1; }
}

/** Tiny event emitter. */
export class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) {
    if (!this._h.has(ev)) this._h.set(ev, new Set());
    this._h.get(ev).add(fn);
    return () => this.off(ev, fn);
  }
  once(ev, fn) { const off = this.on(ev, (...a) => { off(); fn(...a); }); return off; }
  off(ev, fn) { this._h.get(ev)?.delete(fn); }
  emit(ev, ...args) { const s = this._h.get(ev); if (s) for (const fn of [...s]) fn(...args); }
  clear() { this._h.clear(); }
}

/**
 * Coroutine-style task runner. Generators yield seconds to wait (number),
 * or a function returning true when done, or another generator.
 *   tasks.run(function* () { yield 0.5; doThing(); yield () => cond; });
 */
export class TaskRunner {
  constructor() { this.tasks = []; }
  run(genFn, ...args) {
    const it = typeof genFn === 'function' ? genFn(...args) : genFn;
    const task = { stack: [it], wait: 0, cond: null, done: false };
    this.tasks.push(task);
    this._step(task, 0);
    return task;
  }
  _step(task, dt) {
    while (task.stack.length) {
      if (task.wait > 0) { task.wait -= dt; if (task.wait > 0) return; dt = 0; }
      if (task.cond) { if (!task.cond()) return; task.cond = null; }
      const it = task.stack[task.stack.length - 1];
      const r = it.next();
      if (r.done) { task.stack.pop(); continue; }
      const v = r.value;
      if (typeof v === 'number') task.wait = v;
      else if (typeof v === 'function') task.cond = v;
      else if (v && typeof v.next === 'function') task.stack.push(v);
    }
    task.done = true;
  }
  update(dt) {
    for (const t of this.tasks) if (!t.done) this._step(t, dt);
    this.tasks = this.tasks.filter((t) => !t.done);
  }
  clear() { this.tasks.length = 0; }
  get busy() { return this.tasks.length > 0; }
}
