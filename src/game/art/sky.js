// =============================================================================
// art/sky.js — Céu dinâmico e vivo, compartilhado por todos os mundos.
//
//   import { drawSky, skyPreset } from './sky.js';
//   registerBackground('w1', {
//     sky(ctx, w, h, t, cam, level) { drawSky(ctx, w, h, t, cam, skyPreset('w1', level)); },
//     layers: [...]   // paint(pc, w, h, tod) recebe o horário ('day'|'dusk'|'night')
//   });
//
// Horário da fase: level.data.timeOfDay = 'day' | 'dusk' | 'night' (padrão por mundo).
// Recursos: gradiente pontilhado (dither), sol com raios girando, lua com crateras
// e halo, estrelas cintilantes (com cores), estrelas cadentes, meteoros com rastro
// de fogo, nuvens fofinhas em 2–3 camadas com parallax e vento, aurora opcional.
// Tudo pré-renderizado e cacheado; em tempo de execução só drawImage + poucos pixels.
// =============================================================================
import { PixelCanvas, createCanvas } from '../../engine/pixel.js';
import { makeRng, hashString, mixColor, rand } from '../../engine/util.js';

// ----------------------------------------------------------------- presets
const P = {
  day: {
    gradient: ['#3d8fe0', '#6fb6f2', '#a8dcff', '#e4f6ff'],
    sun: { x: 0.78, y: 0.2, r: 13, color: '#fff3a8', glow: '#ffe27a', rays: true },
    moon: null, stars: 0, shooting: 0, meteors: 0,
    clouds: { count: 9, colors: ['#ffffff', '#e6f2ff', '#bcd6f2'], yMin: 0.08, yMax: 0.55, speed: 6, alpha: 1 },
    birds: true,
  },
  dusk: {
    gradient: ['#2a1f5a', '#7a3a8a', '#e0607a', '#ffb070', '#ffe0a0'],
    sun: { x: 0.25, y: 0.72, r: 16, color: '#ffd080', glow: '#ff8a50', rays: false },
    moon: { x: 0.82, y: 0.16, r: 6, color: '#fff0e0', crescent: true },
    stars: 0.25, shooting: 0.04, meteors: 0,
    clouds: { count: 8, colors: ['#ffb0a0', '#e07a8a', '#8a4a7a'], yMin: 0.15, yMax: 0.6, speed: 5, alpha: 0.95 },
  },
  night: {
    gradient: ['#05041a', '#0e0b34', '#1e1650', '#3a2a6a'],
    sun: null,
    moon: { x: 0.74, y: 0.18, r: 14, color: '#fff6dc', crescent: false },
    stars: 1, shooting: 0.18, meteors: 0.04,
    clouds: { count: 5, colors: ['#3a3270', '#2a2458', '#1a1640'], yMin: 0.1, yMax: 0.5, speed: 3, alpha: 0.85, moonlit: '#8a86c8' },
    aurora: false,
  },
};

// Per-world tints/overrides
const WORLD = {
  w1: { day: {}, dusk: {}, night: { aurora: ['#5fcf6a', '#8a6aff'] } },
  w2: {
    day: { gradient: ['#0a3a6a', '#1a6aa0', '#3aa0d0', '#8ad8f0'], sun: { x: 0.5, y: 0.08, r: 18, color: '#d8f8ff', glow: '#7fd6ff', rays: true, underwater: true }, clouds: null, stars: 0, bubbles: true },
    dusk: { gradient: ['#081a3a', '#123a6a', '#2a5a8a', '#6a7aa0'], sun: { x: 0.3, y: 0.06, r: 16, color: '#ffd8b0', glow: '#ff9a7a', rays: true, underwater: true }, moon: null, clouds: null, stars: 0, bubbles: true },
    night: { gradient: ['#020818', '#051430', '#0a2048', '#123058'], moon: { x: 0.7, y: 0.1, r: 12, color: '#cfefff', crescent: false, underwater: true }, clouds: null, stars: 0.3, shooting: 0, meteors: 0, bubbles: true, plankton: true },
  },
  w3: {
    day: { gradient: ['#4a3a8a', '#8a5aa0', '#e09a6a', '#ffd8a0'], sun: { x: 0.7, y: 0.25, r: 14, color: '#ffe8b0', glow: '#ffb84f', rays: true, clock: true } },
    dusk: { gradient: ['#1a1238', '#4a2a5a', '#a04a5a', '#ff9a5a'], sun: { x: 0.3, y: 0.7, r: 18, color: '#ffc080', glow: '#ff7a40', clock: true } },
    night: { gradient: ['#080616', '#16102e', '#2a1c48', '#4a3060'], moon: { x: 0.7, y: 0.18, r: 15, color: '#ffe8c0', clock: true } },
  },
  w4: {
    day: { gradient: ['#1a1430', '#2a2248', '#3a3060', '#4a3a6a'], sun: null, moon: { x: 0.8, y: 0.15, r: 10, color: '#e8e0ff', crescent: true }, stars: 0.3, shooting: 0.03, clouds: { count: 6, colors: ['#2a2448', '#1e1a38', '#141028'], yMin: 0.1, yMax: 0.5, speed: 4, alpha: 0.9, moonlit: '#6a64a0' } },
    dusk: { gradient: ['#100a22', '#1e1438', '#2e1e48', '#3a2450'], sun: null, moon: { x: 0.8, y: 0.15, r: 10, color: '#e8e0ff', crescent: true }, stars: 0.5, shooting: 0.05, clouds: { count: 6, colors: ['#241e40', '#181430', '#100c22'], yMin: 0.1, yMax: 0.5, speed: 4, alpha: 0.9, moonlit: '#5a5490' } },
    night: { gradient: ['#030208', '#08061a', '#120c28', '#1c1234'], moon: { x: 0.78, y: 0.14, r: 13, color: '#f0e8ff', crescent: false, eerie: true }, stars: 0.6, shooting: 0.06, meteors: 0.01, lightning: true },
  },
  w5: {
    day: { gradient: ['#3a0a2a', '#7a1a3a', '#c0304a', '#ff7a5a'], sun: { x: 0.5, y: 0.3, r: 20, color: '#ffe0a0', glow: '#ff4f8a', rays: true, rift: true }, stars: 0.2, meteors: 0.08, shooting: 0.05, clouds: { count: 7, colors: ['#ff8a8a', '#c04a6a', '#6a1a4a'], yMin: 0.1, yMax: 0.6, speed: 9, alpha: 0.9 } },
    dusk: { gradient: ['#1a0420', '#4a0a3a', '#8a1a4a', '#d0405a'], sun: { x: 0.5, y: 0.3, r: 22, color: '#ffd080', glow: '#ff3f7a', rays: true, rift: true }, stars: 0.5, meteors: 0.12, shooting: 0.08, clouds: { count: 7, colors: ['#c04a7a', '#7a1a4a', '#3a0a2a'], yMin: 0.1, yMax: 0.6, speed: 10, alpha: 0.9 } },
    night: { gradient: ['#08020e', '#1a0420', '#3a0a3a', '#5a1040'], moon: { x: 0.25, y: 0.2, r: 16, color: '#ffd0e0', blood: true }, stars: 1, meteors: 0.15, shooting: 0.12, clouds: { count: 5, colors: ['#5a1a4a', '#3a0a3a', '#200620'], yMin: 0.1, yMax: 0.55, speed: 8, alpha: 0.85, moonlit: '#c06a9a' }, aurora: ['#ff4f8a', '#ffd23f'] },
  },
};

export const DEFAULT_TOD = { w1: 'day', w2: 'day', w3: 'dusk', w4: 'night', w5: 'dusk' };

/** Resolve a sky preset for a world key ('w1'...) and the current level (timeOfDay). */
export function skyPreset(worldKey, level, todOverride) {
  const tod = todOverride || level?.data?.timeOfDay || DEFAULT_TOD[worldKey] || 'day';
  const base = P[tod] || P.day;
  const over = WORLD[worldKey]?.[tod] || {};
  const p = { ...base, ...over, tod, key: worldKey + ':' + tod };
  if (over.clouds === null) p.clouds = null;
  return p;
}
export function timeOfDay(worldKey, level) {
  return level?.data?.timeOfDay || DEFAULT_TOD[worldKey] || 'day';
}

// ----------------------------------------------------------------- caches
const cache = new Map();
function cached(key, make) {
  let v = cache.get(key);
  if (!v) { v = make(); cache.set(key, v); }
  return v;
}

function gradientCanvas(p, w, h) {
  return cached(`grad:${p.key}:${w}x${h}`, () => {
    const pc = new PixelCanvas(w, h);
    pc.vgradient(0, 0, w, h, p.gradient);
    pc.flush();
    return pc.canvas;
  });
}

function starField(p, w, h) {
  return cached(`stars:${p.key}:${w}x${h}`, () => {
    const rng = makeRng(hashString(p.key) ^ 0x9e37);
    const n = Math.round(((w * h) / 380) * p.stars);
    const stars = [];
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rng(), 1.6) * h * 0.85;
      const big = rng() < 0.07;
      const col = rng.pick(['#ffffff', '#ffffff', '#fff6d0', '#d0e4ff', '#ffd0e8']);
      stars.push({ x: rng() * w, y, big, col, tw: rng() < 0.45, ph: rng() * 6.28, sp: 1 + rng() * 3 });
    }
    return stars;
  });
}

function sunSprite(s) {
  return cached(`sun:${s.r}:${s.color}:${s.glow}:${!!s.clock}:${!!s.rift}`, () => {
    const R = s.r, S = R * 4 + 4;
    const pc = new PixelCanvas(S, S);
    const c = S / 2;
    pc.circle(c, c, R * 1.9, s.glow + '22');
    pc.circle(c, c, R * 1.5, s.glow + '33');
    pc.circle(c, c, R * 1.2, s.glow + '55');
    pc.circle(c, c, R, s.color);
    pc.circle(c - R * 0.25, c - R * 0.25, R * 0.6, mixColor(s.color, '#ffffff', 0.5));
    if (s.clock) {
      // clock-face sun (World 3)
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pc.px(Math.round(c + Math.cos(a) * (R - 2)), Math.round(c + Math.sin(a) * (R - 2)), '#a0602a');
      }
      pc.line(c, c, c, c - R * 0.6, '#7a4020');
      pc.line(c, c, c + R * 0.45, c, '#7a4020');
    }
    if (s.rift) {
      pc.line(c - 2, c - R + 1, c + 1, c, '#ff4f8a');
      pc.line(c + 1, c, c - 1, c + R - 1, '#ff4f8a');
    }
    pc.flush();
    return pc.canvas;
  });
}

function raysSprite(s) {
  return cached(`rays:${s.r}:${s.glow}`, () => {
    const R = s.r * 3.4, S = Math.ceil(R * 2 + 4);
    const cv = createCanvas(S, S);
    const x = cv.getContext('2d');
    x.translate(S / 2, S / 2);
    x.fillStyle = s.glow;
    for (let i = 0; i < 12; i++) {
      x.globalAlpha = i % 2 ? 0.1 : 0.18;
      x.beginPath();
      x.moveTo(0, 0);
      const a = (i / 12) * Math.PI * 2;
      x.lineTo(Math.cos(a - 0.08) * R, Math.sin(a - 0.08) * R);
      x.lineTo(Math.cos(a + 0.08) * R, Math.sin(a + 0.08) * R);
      x.fill();
    }
    return cv;
  });
}

function moonSprite(m) {
  return cached(`moon:${m.r}:${m.color}:${!!m.crescent}:${!!m.blood}:${!!m.eerie}:${!!m.clock}`, () => {
    const R = m.r, S = R * 4 + 4;
    const pc = new PixelCanvas(S, S);
    const c = S / 2;
    const glow = m.blood ? '#ff4f8a' : m.eerie ? '#b8a8ff' : '#fff2c0';
    pc.circle(c, c, R * 1.9, glow + '14');
    pc.circle(c, c, R * 1.5, glow + '22');
    pc.circle(c, c, R * 1.22, glow + '38');
    const body = m.blood ? '#ffb0c0' : m.color;
    const shade = mixColor(body, '#7a7090', 0.35);
    pc.circle(c, c, R, body);
    // craters
    const rng = makeRng(R * 31 + 7);
    for (let i = 0; i < Math.max(3, R / 2); i++) {
      const a = rng() * 6.28, d = rng() * R * 0.7;
      const cr = 1 + rng() * R * 0.18;
      pc.circle(c + Math.cos(a) * d, c + Math.sin(a) * d, cr, shade);
      pc.px(Math.round(c + Math.cos(a) * d - cr * 0.4), Math.round(c + Math.sin(a) * d - cr * 0.4), mixColor(body, '#ffffff', 0.4));
    }
    // terminator shading on the lower-right
    pc.dither(c - R, c - R, R * 2, R * 2, null, shade, (i, j) => {
      const dx = i - R, dy = j - R;
      if (dx * dx + dy * dy > R * R) return 0;
      return Math.max(0, (dx + dy) / (R * 2.2));
    });
    if (m.crescent) {
      // carve the crescent (erase an offset disc)
      for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
        if ((x - R * 0.55) ** 2 + (y - R * 0.25) ** 2 < (R * 0.95) ** 2) pc.erase(Math.round(c + x), Math.round(c + y));
      }
    }
    if (m.clock) { pc.line(c, c, c, c - R * 0.55, '#a07a40'); pc.line(c, c, c - R * 0.4, c + R * 0.2, '#a07a40'); }
    pc.flush();
    return pc.canvas;
  });
}

function cloudSprites(p) {
  const cl = p.clouds;
  return cached(`clouds:${p.key}`, () => {
    const rng = makeRng(hashString(p.key) ^ 0x51ed);
    const out = [];
    for (let k = 0; k < 6; k++) {
      const w = rng.int(40, 96), h = rng.int(16, 30);
      const pc = new PixelCanvas(w + 4, h + 4);
      const puffs = [];
      const n = rng.int(4, 8);
      for (let i = 0; i < n; i++) {
        const px = 6 + rng() * (w - 12), r = rng.range(h * 0.28, h * 0.55);
        puffs.push([px, h - r * 0.6 - rng() * 4 + 2, r]);
      }
      // shadow (bottom), body, highlight (top-left)
      for (const [x, y, r] of puffs) pc.circle(x, y + 2, r, cl.colors[2]);
      pc.rect(4, h - 4, w - 6, 4, cl.colors[2]);
      for (const [x, y, r] of puffs) pc.circle(x, y, r, cl.colors[1]);
      for (const [x, y, r] of puffs) pc.circle(x - r * 0.18, y - r * 0.22, r * 0.72, cl.colors[0]);
      if (cl.moonlit) for (const [x, y, r] of puffs) pc.circle(x - r * 0.3, y - r * 0.45, r * 0.35, cl.moonlit + '55');
      // flatten bottom edge
      for (let y = h + 1; y < h + 4; y++) for (let x = 0; x < w + 4; x++) pc.erase(x, y);
      pc.flush();
      out.push(pc.canvas);
    }
    return out;
  });
}

// --------------------------------------------------------------- live state
// transient sky events (shooting stars, meteors) per preset
const live = new Map();
function state(p, w, h) {
  let s = live.get(p.key);
  if (!s) {
    const rng = makeRng(hashString(p.key) ^ 0xc10d);
    const clouds = [];
    const cl = p.clouds;
    if (cl) for (let i = 0; i < cl.count; i++) {
      const layer = i % 3;
      clouds.push({ x: rng() * 900, y: cl.yMin + rng() * (cl.yMax - cl.yMin), spr: rng.int(0, 5), layer, speed: cl.speed * (0.5 + layer * 0.45) * (0.8 + rng() * 0.4) });
    }
    const birds = [];
    s = { clouds, streaks: [], birds, lastT: 0, flash: 0, nextFlash: 4 + Math.random() * 6 };
    live.set(p.key, s);
  }
  return s;
}

/**
 * Draw the full sky into ctx (screen space). cam is the level camera (for subtle
 * parallax); pass null in menus.
 */
export function drawSky(ctx, w, h, t, cam, p) {
  const s = state(p, w, h);
  const dt = Math.min(0.1, Math.max(0, t - s.lastT));
  s.lastT = t;
  const camX = cam ? cam.x : t * 8;
  const camY = cam ? cam.y : 0;
  ctx.drawImage(gradientCanvas(p, w, h), 0, 0);

  // aurora ribbons
  if (p.aurora) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = p.aurora[k];
      for (let x = 0; x < w; x += 2) {
        const y = h * 0.12 + Math.sin(x * 0.012 + t * 0.4 + k * 2) * 14 + Math.sin(x * 0.031 - t * 0.7) * 6 + k * 10;
        const len = 14 + Math.sin(x * 0.05 + t + k) * 8;
        ctx.globalAlpha = 0.05 + 0.04 * Math.sin(x * 0.02 + t * 1.3 + k);
        ctx.fillRect(x, Math.round(y), 2, Math.round(len));
      }
    }
    ctx.restore();
  }

  // stars (twinkling)
  if (p.stars > 0) {
    const stars = starField(p, w, h);
    const ox = -(camX * 0.01) % w;
    for (const st of stars) {
      let a = 1;
      if (st.tw) a = 0.45 + 0.55 * Math.abs(Math.sin(t * st.sp + st.ph));
      const x = Math.round((st.x + ox + w) % w), y = Math.round(st.y);
      ctx.globalAlpha = a * (p.tod === 'dusk' ? 0.6 : 1);
      ctx.fillStyle = st.col;
      if (st.big) {
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha *= 0.6;
        ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        if (a > 0.9) { ctx.globalAlpha = 0.35; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); }
      } else ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // sun
  if (p.sun) {
    const sx = Math.round(w * p.sun.x - camX * 0.006), sy = Math.round(h * p.sun.y + camY * 0.01);
    if (p.sun.rays) {
      const r = raysSprite(p.sun);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 0.05);
      ctx.globalAlpha = 0.8 + Math.sin(t * 0.8) * 0.2;
      ctx.drawImage(r, -r.width / 2, -r.height / 2);
      ctx.restore();
    }
    const spr = sunSprite(p.sun);
    ctx.drawImage(spr, sx - spr.width / 2, sy - spr.height / 2);
    if (p.sun.underwater) {
      // god rays reaching down
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const bx = sx + (i - 2.5) * 34 + Math.sin(t * 0.3 + i) * 10;
        ctx.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 1.7);
        ctx.fillStyle = p.sun.glow;
        ctx.beginPath();
        ctx.moveTo(bx - 4, sy); ctx.lineTo(bx + 4, sy);
        ctx.lineTo(bx + 30 + i * 4, h); ctx.lineTo(bx - 10 + i * 4, h);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // moon
  if (p.moon) {
    const mx = Math.round(w * p.moon.x - camX * 0.005), my = Math.round(h * p.moon.y + camY * 0.008);
    const spr = moonSprite(p.moon);
    ctx.globalAlpha = 0.95 + Math.sin(t * 0.6) * 0.05;
    ctx.drawImage(spr, mx - spr.width / 2, my - spr.height / 2);
    ctx.globalAlpha = 1;
  }

  // shooting stars & meteors
  if (p.shooting > 0 && Math.random() < p.shooting * dt) {
    s.streaks.push({ kind: 'star', x: rand(w * 0.1, w * 1.1), y: rand(0, h * 0.35), vx: -rand(160, 260), vy: rand(60, 120), life: rand(0.5, 0.9), max: 0 });
  }
  if (p.meteors > 0 && Math.random() < p.meteors * dt) {
    s.streaks.push({ kind: 'meteor', x: rand(w * 0.2, w * 1.2), y: -10, vx: -rand(50, 90), vy: rand(60, 100), life: rand(2, 3.5), max: 0 });
  }
  for (const st of s.streaks) {
    if (!st.max) st.max = st.life;
    st.life -= dt;
    st.x += st.vx * dt; st.y += st.vy * dt;
    const k = Math.max(0, st.life / st.max);
    const len = st.kind === 'star' ? 18 : 26;
    const nx = -st.vx, ny = -st.vy, nl = Math.hypot(nx, ny);
    for (let i = 0; i < len; i++) {
      const f = i / len;
      const x = Math.round(st.x + (nx / nl) * i), y = Math.round(st.y + (ny / nl) * i);
      if (st.kind === 'star') {
        ctx.globalAlpha = (1 - f) * Math.min(1, k * 2);
        ctx.fillStyle = f < 0.2 ? '#ffffff' : '#cfe4ff';
        ctx.fillRect(x, y, 1, 1);
      } else {
        ctx.globalAlpha = (1 - f) * Math.min(1, k * 1.5);
        ctx.fillStyle = f < 0.12 ? '#fff6c0' : f < 0.4 ? '#ffb040' : '#ff5a3a';
        ctx.fillRect(x, y, f < 0.3 ? 2 : 1, f < 0.3 ? 2 : 1);
        if (Math.random() < 0.08) { ctx.fillStyle = '#ffd080'; ctx.fillRect(x + Math.round(rand(-3, 3)), y + Math.round(rand(-3, 3)), 1, 1); }
      }
    }
    if (st.kind === 'meteor') { ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(st.x) - 1, Math.round(st.y) - 1, 3, 3); }
  }
  ctx.globalAlpha = 1;
  s.streaks = s.streaks.filter((st) => st.life > 0 && st.y < h + 20 && st.x > -40);

  // lightning flashes (World 4 storm)
  if (p.lightning) {
    s.nextFlash -= dt;
    if (s.nextFlash <= 0) { s.flash = 0.35; s.nextFlash = 6 + Math.random() * 10; }
    if (s.flash > 0) {
      s.flash -= dt;
      ctx.globalAlpha = Math.max(0, s.flash) * (Math.sin(s.flash * 60) > 0 ? 0.5 : 0.2);
      ctx.fillStyle = '#c8c0ff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  // clouds (3 depth layers with parallax + wind)
  if (p.clouds) {
    const sprites = cloudSprites(p);
    const span = w + 200;
    for (const c of s.clouds) {
      c.x += c.speed * dt;
      const par = 0.02 + c.layer * 0.04;
      const spr = sprites[c.spr];
      const x = Math.round(((((c.x - camX * par) % span) + span) % span) - 100);
      const y = Math.round(h * c.y + camY * 0.01 * (c.layer + 1));
      ctx.globalAlpha = p.clouds.alpha * (0.75 + c.layer * 0.12);
      ctx.drawImage(spr, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // floating bubbles in water skies
  if (p.bubbles) {
    ctx.fillStyle = '#cfefff';
    for (let i = 0; i < 18; i++) {
      const bx = ((i * 97 + t * 6 - camX * 0.03) % w + w) % w;
      const by = h - (((t * (10 + (i % 5) * 4) + i * 53) % (h + 20)));
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t + i);
      const r = 1 + (i % 3);
      ctx.fillRect(Math.round(bx + Math.sin(t * 2 + i) * 2), Math.round(by), r, r);
    }
    ctx.globalAlpha = 1;
  }

  // a few birds crossing on sunny days
  if (p.birds) {
    ctx.fillStyle = '#2a3a5a';
    for (let i = 0; i < 3; i++) {
      const bx = ((t * 14 + i * 37) % (w + 120)) - 60;
      const by = h * 0.22 + i * 7 + Math.sin(t * 1.5 + i) * 3;
      const wing = Math.floor(t * 6 + i) % 2;
      ctx.fillRect(Math.round(bx), Math.round(by), 1, 1);
      ctx.fillRect(Math.round(bx) - 2, Math.round(by) - wing, 2, 1);
      ctx.fillRect(Math.round(bx) + 1, Math.round(by) - wing, 2, 1);
    }
  }
}
