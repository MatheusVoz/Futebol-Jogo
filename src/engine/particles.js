// =============================================================================
// particles.js — Sistema de partículas com pool e presets nomeados.
//
//   registerParticle('dust', {
//     life:[0.3,0.6], speed:[10,40], angle:[200,340] (graus, 0=direita, 90=baixo),
//     gravity:0, drag:2 (por segundo), size:[1,2], colors:['#fff','#ccc'],
//     shape:'pixel'|'square'|'circle'|'star'|'spark'|'ring'|'thread'|'fluff',
//     fade:true, shrink:true, additive:false, spin:[-3,3], front:true
//   });
//   level.particles.emit('dust', x, y, 6, { angle:[180,360] });   // overrides
//   level.particles.burst(x, y, { ...opções inline... }, count)
// =============================================================================
import { rand, pick, parseColor } from './util.js';

const presets = new Map();
export function registerParticle(name, def) { presets.set(name, def); }
export function getParticlePreset(name) { return presets.get(name); }

const r2 = (v) => (Array.isArray(v) ? rand(v[0], v[1]) : v ?? 0);

export class ParticleSystem {
  constructor(max = 900) {
    this.max = max;
    this.list = [];
  }
  clear() { this.list.length = 0; }

  emit(name, x, y, count = 1, overrides = {}) {
    const base = typeof name === 'string' ? presets.get(name) : name;
    if (!base) return;
    const d = overrides && Object.keys(overrides).length ? { ...base, ...overrides } : base;
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const ang = (r2(d.angle ?? [0, 360]) * Math.PI) / 180;
      const sp = r2(d.speed ?? [20, 60]);
      const life = r2(d.life ?? [0.4, 0.8]);
      this.list.push({
        x: x + r2(d.spreadX ?? 0) * (Math.random() * 2 - 1),
        y: y + r2(d.spreadY ?? 0) * (Math.random() * 2 - 1),
        vx: Math.cos(ang) * sp + (d.vx ?? 0),
        vy: Math.sin(ang) * sp + (d.vy ?? 0),
        life, maxLife: life,
        size: r2(d.size ?? 1),
        color: Array.isArray(d.colors) ? pick(d.colors) : d.color || '#ffffff',
        gravity: d.gravity ?? 0,
        drag: d.drag ?? 0,
        shape: d.shape || 'pixel',
        fade: d.fade !== false,
        shrink: !!d.shrink,
        additive: !!d.additive,
        rot: rand(0, Math.PI * 2),
        spin: r2(d.spin ?? 0),
        front: d.front !== false,
        wobble: d.wobble ?? 0,
        ph: rand(0, 6.28),
        trail: d.trail || 0,
        px: x, py: y,
      });
    }
  }
  burst(x, y, def, count = 10) { this.emit(def, x, y, count); }

  update(dt) {
    const L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.px = p.x; p.py = p.y;
      p.vy += p.gravity * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt + (p.wobble ? Math.sin(p.ph + p.life * 6) * p.wobble * dt : 0);
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      L[j++] = p;
    }
    L.length = j;
  }

  /** Draw particles. front=true draws foreground particles, false background. */
  draw(ctx, front = true) {
    for (const p of this.list) {
      if (p.front !== front) continue;
      const k = p.life / p.maxLife;
      const a = p.fade ? Math.min(1, k * 2) : 1;
      let s = p.shrink ? p.size * k : p.size;
      if (s < 0.5 && p.shape !== 'pixel') continue;
      ctx.globalAlpha = a;
      if (p.additive) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      const x = Math.round(p.x), y = Math.round(p.y);
      switch (p.shape) {
        case 'pixel': ctx.fillRect(x, y, 1, 1); break;
        case 'square': { const q = Math.max(1, Math.round(s)); ctx.fillRect(x - (q >> 1), y - (q >> 1), q, q); break; }
        case 'circle': {
          const q = Math.max(1, Math.round(s));
          if (q <= 2) ctx.fillRect(x - (q >> 1), y - (q >> 1), q, q);
          else { ctx.fillRect(x - q + 1, y - (q >> 1), q * 2 - 2, q); ctx.fillRect(x - (q >> 1), y - q + 1, q, q * 2 - 2); }
          break;
        }
        case 'star': {
          const q = Math.max(1, Math.round(s));
          ctx.fillRect(x - q, y, q * 2 + 1, 1);
          ctx.fillRect(x, y - q, 1, q * 2 + 1);
          if (q >= 2) ctx.fillRect(x - 1, y - 1, 3, 3);
          break;
        }
        case 'spark': {
          // short line along velocity
          const len = Math.max(2, Math.min(8, Math.hypot(p.vx, p.vy) * 0.03)) * (p.shrink ? k : 1);
          const ang = Math.atan2(p.vy, p.vx);
          for (let i = 0; i < len; i++) ctx.fillRect(Math.round(p.x - Math.cos(ang) * i), Math.round(p.y - Math.sin(ang) * i), 1, 1);
          break;
        }
        case 'ring': {
          const R = Math.round(s * (p.shrink ? 1 : 1 + (1 - k) * 2));
          for (let i = 0; i < 16; i++) {
            const an = (i / 16) * Math.PI * 2;
            ctx.fillRect(Math.round(x + Math.cos(an) * R), Math.round(y + Math.sin(an) * R), 1, 1);
          }
          break;
        }
        case 'thread': {
          // wavy short thread fiber
          const len = Math.max(3, Math.round(s * 3));
          for (let i = 0; i < len; i++) {
            const tx = x + Math.round(Math.cos(p.rot) * i);
            const ty = y + Math.round(Math.sin(p.rot) * i + Math.sin(i * 0.9 + p.ph) * 0.8);
            ctx.fillRect(tx, ty, 1, 1);
          }
          break;
        }
        case 'fluff': {
          const q = Math.max(1, Math.round(s));
          ctx.fillRect(x - q, y, q * 2, 1);
          ctx.fillRect(x - q + 1, y - 1, q * 2 - 2, 3);
          break;
        }
        default: ctx.fillRect(x, y, 1, 1);
      }
      if (p.additive) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- Core presets
registerParticle('dust', { life: [0.25, 0.5], speed: [8, 30], angle: [190, 350], gravity: -10, drag: 3, size: [1, 2.5], colors: ['#e8dcc8', '#cbbfa8', '#ffffff'], shape: 'circle', shrink: true });
registerParticle('land', { life: [0.25, 0.45], speed: [20, 55], angle: [180, 200], gravity: 0, drag: 5, size: [1, 2.5], colors: ['#e8dcc8', '#cbbfa8'], shape: 'circle', shrink: true });
registerParticle('sparkle', { life: [0.3, 0.7], speed: [10, 50], angle: [0, 360], drag: 2, size: [1, 2], colors: ['#fff6a8', '#ffffff', '#ffd23f'], shape: 'star', additive: true });
registerParticle('hit', { life: [0.12, 0.25], speed: [80, 180], angle: [0, 360], drag: 6, size: [1, 1], colors: ['#ffffff', '#fff3a0'], shape: 'spark', additive: true });
registerParticle('fluff', { life: [0.5, 1.0], speed: [20, 70], angle: [200, 340], gravity: 120, drag: 1.5, size: [1, 2], colors: ['#f4efe6', '#e0d8cc', '#ffffff'], shape: 'fluff', spin: [-4, 4] });
registerParticle('fabric', { life: [0.5, 0.9], speed: [40, 110], angle: [0, 360], gravity: 260, drag: 1, size: [1, 2], colors: ['#3fc7c0', '#2a9d97', '#ffd23f'], shape: 'square', spin: [-8, 8] });
registerParticle('thread', { life: [0.4, 0.9], speed: [10, 50], angle: [0, 360], gravity: 30, drag: 2, size: [1, 2], colors: ['#ffe27a', '#ffffff', '#ffc94a'], shape: 'thread', spin: [-5, 5], additive: true });
registerParticle('bubble', { life: [0.8, 1.6], speed: [5, 15], angle: [250, 290], gravity: -40, drag: 1, size: [1, 2], colors: ['#c8f4ff', '#ffffff'], shape: 'ring', wobble: 20, fade: true });
registerParticle('smoke', { life: [0.5, 1.0], speed: [5, 25], angle: [240, 300], gravity: -20, drag: 1, size: [2, 4], colors: ['#5a5068', '#7a7088', '#3e3650'], shape: 'circle', shrink: true });
registerParticle('heal', { life: [0.6, 1.0], speed: [10, 30], angle: [250, 290], gravity: -30, size: [1, 2], colors: ['#ff7aa2', '#ffc2d4'], shape: 'star', additive: true });
registerParticle('energy', { life: [0.4, 0.8], speed: [10, 40], angle: [0, 360], gravity: -20, size: [1, 2], colors: ['#8ff0ff', '#ffffff', '#55d0ff'], shape: 'star', additive: true });
registerParticle('splash', { life: [0.3, 0.6], speed: [60, 140], angle: [235, 305], gravity: 500, size: [1, 2], colors: ['#bdf0ff', '#ffffff', '#7fd6ff'], shape: 'square' });
registerParticle('ember', { life: [0.6, 1.4], speed: [10, 40], angle: [240, 300], gravity: -30, wobble: 15, size: [1, 1], colors: ['#ff9a3c', '#ffd23f', '#ff5a3c'], shape: 'pixel', additive: true });
registerParticle('shadow', { life: [0.4, 0.9], speed: [10, 40], angle: [0, 360], gravity: -15, drag: 1, size: [1, 3], colors: ['#1a0f2a', '#2d1b45', '#000000'], shape: 'circle', shrink: true });
registerParticle('portal', { life: [0.5, 1.0], speed: [10, 60], angle: [0, 360], drag: 1, size: [1, 2], colors: ['#ff4fd8', '#a855ff', '#ffffff'], shape: 'star', additive: true });
