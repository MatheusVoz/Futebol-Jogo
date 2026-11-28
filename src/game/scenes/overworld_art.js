// =============================================================================
// overworld_art.js — Arte do mapa-múndi "estilo 16 bits" (original), usada por
// scenes/worldmap.js. Tudo é procedural e PRÉ-RENDERIZADO uma vez por sessão:
//
//   regionArt(world, geo)   → { frames:[canvas,canvas], water, sea, anims, ... }
//        Terreno da região (litoral orgânico, praia, penhasco, rios/canais,
//        textura do chão) + decoração densa (florestas, morros com olhos,
//        montanhas, palmeiras, prédios, torres, cama gigante, cristais...).
//        2 quadros (espuma do litoral alternando). Água do mar = transparente
//        (o fundo animado aparece por baixo).
//   drawBackdrop(...)       → mar / vazio / cosmos animado de cada região
//   seamImage()             → costura dourada entre duas regiões
//   roadsImage(...)         → caminhos (bege, pontilhados) + pontes, por estado
//   drawRegionAnims(...)    → detalhes animados pequenos (brilhos na água,
//                             borboletas, barcos, redemoinho, ponteiros de
//                             relógio, engrenagens, olhos piscando, coração...)
//   nodeImage / drawCastle  → bolinhas de fase (amarela/vermelha) e castelos
//   lockedOverlay()         → pontos em X para regiões ainda costuradas
// Desempenho: o quadro só desenha imagens cacheadas + poucos retângulos.
// =============================================================================
import { PixelCanvas, colorU32 } from '../../engine/pixel.js';
import { makeRng, mixColor, clamp, hash2, darken, lighten } from '../../engine/util.js';
import { prop, castleProp, flagProp, propCanvas, INK } from '../art/map_props.js';
import { RW, RH } from './map_layout.js';

const R0 = Math.round;
const cache = new Map();
const cached = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };

// ------------------------------------------------------------------ temas
export const THEME = {
  1: { ground: ['#3c9a3c', '#4cb048', '#68c858', '#98e078'], edge: '#2a7a30', beach: ['#f4e0a0', '#d8bc78'], cliff: ['#b07038', '#7a4a20', '#4a2a10'],
    inland: ['#3a88e0', '#5aa8f0', '#c8f0ff'], shallow: '#8ae0f0', road: ['#f4dca8', '#a8743a', '#d0aa6a'], bridge: 'wood' },
  2: { ground: ['#4aa848', '#5cbc50', '#7cd468', '#b0ec90'], edge: '#3a8a3a', beach: ['#fae8b0', '#e0c888'], cliff: ['#c8a868', '#9a7a48', '#5a4a30'],
    inland: ['#3a9ae0', '#5ab8f0', '#d8f8ff'], shallow: '#9af0f0', road: ['#f8e4b4', '#a8783e', '#d8b474'], bridge: 'wood' },
  3: { ground: ['#b8946a', '#c8a478', '#d8b88a', '#ead0a4'], edge: '#8a6a48', beach: ['#a8a0a0', '#7a7272'], cliff: ['#7a6a5a', '#5a4a3e', '#3a2e26'],
    inland: ['#3a6aa8', '#5a8ac8', '#ffd090'], shallow: '#7a90d0', road: ['#f0dcb0', '#7a5a3a', '#c8a878'], bridge: 'stone' },
  4: { ground: ['#241a3e', '#2e2250', '#3a2c62', '#4e3e80'], edge: '#5a4a90', beach: ['#4a3a72', '#3a2c5a'], cliff: ['#1a1230', '#120c22', '#0b0716'],
    inland: ['#1a2450', '#28366a', '#8a9ae0'], shallow: '#3a2a6a', road: ['#b8a8e0', '#2a1e48', '#8a7ab8'], bridge: 'rope' },
  5: { ground: ['#8a1634', '#a01e40', '#b8284e', '#d84a6a'], edge: '#ffd23f', beach: ['#ffd23f', '#c89a20'], cliff: ['#5a0a24', '#3a0618', '#22040e'],
    inland: ['#5a1a6a', '#7a2a8a', '#ffb0e0'], shallow: '#ff6a9a', road: ['#ffe48a', '#8a3a1a', '#e0b040'], bridge: 'thread' },
};

// ------------------------------------------------------------------ ruído
function vnoise(x, y, s, seed) {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x, y, seed) => vnoise(x, y, 40, seed) * 0.55 + vnoise(x, y, 17, seed + 7) * 0.3 + vnoise(x, y, 7, seed + 13) * 0.15;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const k = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
/** Transformada de distância (chanfro 1/√2): distância até o pixel-semente mais próximo. */
function chamfer(seedFn, W, H) {
  const N = W * H, d = new Float32Array(N), D2 = 1.4142;
  for (let i = 0; i < N; i++) d[i] = seedFn(i) ? 0 : 1e6;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + D2); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D2); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + D2); if (x > 0) v = Math.min(v, d[i + W - 1] + D2); }
    d[i] = v;
  }
  return d;
}

// ------------------------------------------------------------------ terreno
/**
 * Máscaras do terreno do mundo. Retorna { land, inland } (Uint8Array W*H):
 * land = chão; inland = água "interna" (rio/lago/canal, opaca, com margem).
 */
function terrain(world, geo, Dp, rng) {
  const W = RW, H = RH, N = W * H;
  const land = new Uint8Array(N), inland = new Uint8Array(N);
  const seed = world * 101;
  const rectSdf = (x, y, inset, rad) => {
    const qx = Math.abs(x - W / 2) - (W / 2 - inset - rad), qy = Math.abs(y - H / 2) - (H / 2 - inset - rad);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
  };
  const edgeCut = (x, y) => Math.min(x, W - 1 - x) - 15 - vnoise(x, y, 9, seed + 3) * 6;
  // ilhas extras / lagos feitos à mão
  const blobs = {
    2: [[150, 206, 24], [300, 150, 18], [60, 60, 20], [128, 36, 12], [196, 158, 14], [410, 236, 12], [272, 252, 10], [360, 44, 16], [392, 196, 10], [24 + 40, 120, 9]],
    4: [[136, 112, 26], [334, 42, 22], [370, 236, 20], [40, 52, 18], [276, 112, 16], [118, 236, 14], [204, 20, 12], [420, 150, 10], [30, 150, 8]],
  }[world] || [];
  const river = world === 1 ? [[266, 0], [270, 50], [292, 100], [288, 140], [318, 186], [328, 236], [332, 272]] : null;
  const lake = world === 1 ? { x: 304, y: 122, rx: 20, ry: 11 } : null;
  // W5: retalhos (retângulos) em volta dos caminhos e alguns extras
  let patches = null;
  if (world === 5) {
    patches = [];
    for (const [ax, ay, bx, by] of geo.segs) {
      const e = 13 + rng.int(0, 6);
      patches.push([Math.min(ax, bx) - e, Math.min(ay, by) - e, Math.max(ax, bx) + e, Math.max(ay, by) + e]);
    }
    for (const [x, y] of geo.nodes) { const e = 18 + rng.int(0, 5); patches.push([x - e, y - e, x + e, y + e]); }
    for (let i = 0; i < 16; i++) {
      const [x, y] = rng.pick(geo.nodes);
      const w = rng.int(28, 64), h = rng.int(22, 46);
      const px = x + rng.int(-70, 40), py = y + rng.int(-60, 30);
      patches.push([px, py, px + w, py + h]);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, dp = Dp[i];
    let v;
    if (world === 1 || world === 3) {
      v = -rectSdf(x, y, world === 1 ? 20 : 16, 34) + (fbm(x, y, seed) - 0.5) * 26;
      if (dp < 11) v = Math.max(v, 1);
    } else if (world === 2) {
      v = -99;
      for (const [nx, ny, k] of geo.nodes) { const r = k === 'boss' ? 27 : k === 'bonus' ? 15 : 18; v = Math.max(v, r - Math.hypot(x - nx, y - ny)); }
      for (const [bx, by, r] of blobs) v = Math.max(v, r - Math.hypot(x - bx, y - by));
      v += (vnoise(x, y, 8, seed) - 0.5) * 9;
    } else if (world === 4) {
      v = 21 - dp + (fbm(x, y, seed) - 0.5) * 26;
      for (const [bx, by, r] of blobs) v = Math.max(v, r - Math.hypot(x - bx, y - by) + (vnoise(x, y, 7, seed) - 0.5) * 8);
      if (dp < 9) v = Math.max(v, 1);
    } else {
      v = -99;
      const j = (vnoise(x, y, 3, seed) - 0.5) * 1.6;
      for (const [x0, y0, x1, y1] of patches) v = Math.max(v, Math.min(x - x0, x1 - x, y - y0, y1 - y) + j);
      if (dp < 9) v = Math.max(v, 1);
    }
    v = Math.min(v, edgeCut(x, y));
    if (v > 0) land[i] = 1;
    // água interna
    if (river && land[i]) {
      let rd = 1e9;
      for (let k = 0; k < river.length - 1; k++) rd = Math.min(rd, segDist(x, y, ...river[k], ...river[k + 1]));
      const lk = ((x - lake.x) / lake.rx) ** 2 + ((y - lake.y) / lake.ry) ** 2;
      if (rd < 4.2 + vnoise(x, y, 11, seed) * 1.6 || lk < 1) inland[i] = 1;
    }
    if (world === 3 && land[i]) {
      const c1 = Math.abs(y - 126) < 4, c2 = Math.abs(x - 150) < 4 && y > 126, c3 = Math.abs(x - 290) < 4 && y < 126;
      if (c1 || c2 || c3) inland[i] = 1;
    }
  }
  return { land, inland, patches };
}

// ------------------------------------------------------------------ região
/**
 * geo: { segs:[[ax,ay,bx,by]...], nodes:[[x,y,kind]...], boss:[x,y] } em coords locais.
 */
export function regionArt(world, geo) {
  return cached('region' + world, () => buildRegion(world, geo));
}
export function regionReady(world) { return cache.has('region' + world); }

function buildRegion(world, geo) {
  const W = RW, H = RH, N = W * H;
  const T = THEME[world];
  const rng = makeRng(world * 7919 + 17);
  // distância até caminhos e nós
  const Dp = new Float32Array(N).fill(999), Dn = new Float32Array(N).fill(999);
  for (const [ax, ay, bx, by] of geo.segs) {
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - 44)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + 44));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - 44)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + 44));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = segDist(x, y, ax, ay, bx, by), i = y * W + x; if (d < Dp[i]) Dp[i] = d; }
  }
  for (const [nx, ny] of geo.nodes) {
    for (let y = Math.max(0, ny - 50); y < Math.min(H, ny + 50); y++) for (let x = Math.max(0, nx - 50); x < Math.min(W, nx + 50); x++) {
      const d = Math.hypot(x - nx, y - ny), i = y * W + x; if (d < Dn[i]) Dn[i] = d;
    }
  }
  const { land, inland, patches } = terrain(world, geo, Dp, rng);
  const water = new Uint8Array(N);
  for (let i = 0; i < N; i++) water[i] = !land[i] || inland[i] ? 1 : 0;
  const solid = (i) => land[i] && !inland[i];
  const dIn = chamfer((i) => !solid(i), W, H);           // chão → água
  const dOut = chamfer((i) => land[i] === 1, W, H);      // mar → terra
  const dRiv = chamfer((i) => !inland[i], W, H);         // dentro da água interna → margem

  const pc = new PixelCanvas(W, H);
  const buf = pc.buf;
  const U = (c) => colorU32(c);
  const G = T.ground.map(U), BEACH = T.beach.map(U), CL = T.cliff.map(U), EDGE = U(T.edge), INKU = U(INK);
  const INL = T.inland.map(U);
  const cliffH = world === 4 ? 9 : world === 5 ? 6 : world === 2 ? 3 : 5;
  const seaShore = world <= 3;
  const seed = world * 31;
  const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dth = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const patchCol = world === 5 ? ['#a01e40', '#b8304e', '#8a1a48', '#c84060', '#962048', '#7a1640'].map(U) : null;
  const patchAt = (x, y) => { let id = -1; for (let k = 0; k < patches.length; k++) { const p = patches[k]; if (x >= p[0] && x <= p[2] && y >= p[1] && y <= p[3]) id = k; } return id; };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (inland[i]) { // rio / lago / canal (opaco)
      const dr = dRiv[i];
      let c = INL[0];
      if (dr < 1.5) c = world === 3 ? U('#5a5050') : INKU;
      else if (dr < 2.5) c = INL[1];
      else if (((x * 3 + y * 7) % 23 === 0) || (world === 3 && (x + y * 5) % 37 === 0)) c = INL[2];
      buf[i] = c;
      continue;
    }
    if (land[i]) {
      const d = dIn[i];
      let c;
      const n = fbm(x, y, seed);
      if (world === 1 || world === 2) {
        const k = n * 2 + (hash2(x, y, seed) - 0.5) * 0.35;
        c = k > 1.18 ? G[2] : k < 0.78 ? G[0] : G[1];
        if (((x + (y >> 1) * 3) % 7 === 0) && (y % 3 === 0) && hash2(x >> 2, y >> 2, seed) > 0.5) c = G[3];
      } else if (world === 3) { // calçamento de pedras
        const row = Math.floor(y / 5), off = (row % 2) * 4;
        const joint = y % 5 === 0 || (x + off) % 8 === 0;
        c = joint ? G[0] : (hash2((x + off) >> 3, row, seed) > 0.7 ? G[2] : G[1]);
        if (!joint && (x + y) % 9 === 0) c = G[3];
      } else if (world === 4) { // tapete escuro com losangos
        const u = (x + y) % 16, v2 = (x - y + 1600) % 16;
        c = (u === 0 || v2 === 0) ? G[2] : (n > 0.62 ? G[1] : G[0]);
        if (u === 8 && v2 === 8) c = G[3];
      } else { // colcha de retalhos
        const id = patchAt(x, y);
        c = patchCol[(id + 600) % patchCol.length];
        if ((x + y) % 6 === 0 && hash2(x >> 3, y >> 3, id) > 0.6) c = U('#d84a6a');
        if (id >= 0) { // pesponto na borda de cada retalho
          const p = patches[id], e = Math.min(x - p[0], p[2] - x, y - p[1], p[3] - y);
          if (e >= 2.5 && e < 3.5 && ((x + y) % 5) < 3) c = U('#ffb0c8');
        }
      }
      // bordas: praia / cais / bainha
      if (world === 5) {
        if (d < 1.5) c = INKU; else if (d < 3) c = ((x + y) % 4 < 2) ? BEACH[0] : BEACH[1];
      } else if (world === 4) {
        if (d < 1.5) c = U('#8a7ac8'); else if (d < 3) c = EDGE;
      } else {
        const nearSea = dOut[i] === 0 ? (d < 6 && seaShore) : false;
        // perto do mar = praia; perto de rio/canal = margem de grama/pedra
        let seaD = 99;
        if (d < 6) { // verifica se a água próxima é mar (não rio)
          for (let k = -4; k <= 4 && seaD === 99; k += 4) for (let m = -4; m <= 4; m += 4) {
            const xx = x + k, yy = y + m; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            if (!land[yy * W + xx]) { seaD = d; break; }
          }
        }
        if (nearSea && seaD < 99) {
          if (d < 1.5) c = INKU; else if (d < (world === 2 ? 5 : 3.6)) c = d < 2.5 ? BEACH[1] : BEACH[0];
          else if (d < 5) c = world === 3 ? G[0] : EDGE;
        } else if (d < 1.5) c = world === 3 ? U('#5a5050') : EDGE;
        else if (d < 2.5 && world === 3) c = BEACH[0];
      }
      buf[i] = c;
      continue;
    }
    // mar: penhasco sob a terra (dá altura), contorno, água rasa
    let up = 0;
    for (let k = 1; k <= cliffH; k++) { if (y - k >= 0 && land[(y - k) * W + x]) { up = k; break; } }
    if (up) {
      let c;
      if (world === 4) c = up < 3 ? CL[0] : up < 6 ? CL[1] : CL[2];
      else if (world === 5) c = (x % 3 === 0 && up > 2) ? U('#ffd23f') : up < 3 ? CL[0] : CL[1];
      else c = up <= 1 ? CL[0] : up < cliffH ? (((x + up) % 6 === 0) ? CL[2] : CL[1]) : INKU;
      if (world <= 3 && up < cliffH && (x * 7 + y) % 11 === 0) c = CL[2];
      buf[i] = c;
      continue;
    }
    const o = dOut[i];
    if (o < 1.5) { buf[i] = world === 4 ? U('#3a2c62') : INKU; continue; }
    const reach = world === 2 ? 14 : world === 4 ? 10 : world === 5 ? 9 : 8;
    if (o < reach) {
      const k = 1 - o / reach;
      if (k > dth(x, y) * 0.9 + 0.12) {
        const a = world === 4 ? 0x40 : world === 5 ? 0x48 : 0x88;
        buf[i] = ((a << 24) | (colorU32(T.shallow) & 0xffffff)) >>> 0;
      }
    }
  }

  // ------------------------------------------------ detalhes do chão
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H && solid(y * W + x)) buf[y * W + x] = U(c); };
  for (let k = 0; k < 520; k++) {
    const x = rng.int(4, W - 5), y = rng.int(4, H - 5), i = y * W + x;
    if (!solid(i) || dIn[i] < 4 || Dp[i] < 6) continue;
    if (world === 1) {
      if (k % 3 === 0) { const c = rng.pick(['#ff5a6a', '#fff07a', '#ffffff', '#ff9ad8']); put(x, y, c); put(x + 2, y + 1, c); put(x + 1, y - 1, '#fff6c0'); }
      else { put(x, y, '#2a7a30'); put(x + 1, y - 1, '#2a7a30'); put(x + 2, y, '#2a7a30'); }
    } else if (world === 2) {
      if (dIn[i] < 8) { if (k % 4 === 0) { put(x, y, '#ff8a6a'); put(x - 1, y, '#ff8a6a'); put(x + 1, y, '#ff8a6a'); put(x, y - 1, '#ff8a6a'); put(x, y + 1, '#ff8a6a'); } else put(x, y, '#ffffff'); }
      else { put(x, y, '#3a8a3a'); put(x + 1, y - 1, '#3a8a3a'); }
    } else if (world === 3) {
      if (k % 5 === 0) { put(x, y, '#8a6a48'); put(x + 1, y, '#8a6a48'); }
    } else if (world === 4) {
      if (k % 4 === 0) { put(x, y, '#6a5aa0'); }
    } else {
      if (k % 3 === 0) { put(x, y, '#ffd23f'); put(x + 1, y + 1, '#ffd23f'); put(x + 2, y + 1, '#ffd23f'); put(x + 3, y, '#ffd23f'); }
    }
  }

  // ------------------------------------------------ decoração
  const placed = [];
  const castle = geo.boss ? { x0: geo.boss[0] - 26, x1: geo.boss[0] + 26, y0: geo.boss[1] - 58, y1: geo.boss[1] + 10 } : null;
  const free = (s, x, y, o = {}) => {
    x = R0(x); y = R0(y);
    if (x < 8 || y < 10 || x >= W - 8 || y >= H - 4) return false;
    const i = y * W + x, r = s.r;
    const top = Math.max(0, y - s.ay + 2) * W + x;
    const pad = o.pathPad ?? 6;
    if (Dp[i] < r + pad || Dp[top] < r + pad - 2 || Dp[Math.max(0, y - (s.ay >> 1)) * W + x] < r + pad - 1) return false;
    if (Dn[i] < r + (o.nodePad ?? 13) || Dn[top] < r + 9) return false;
    if (castle && x + r > castle.x0 && x - r < castle.x1 && y > castle.y0 && y - s.ay < castle.y1) return false;
    const on = o.on || 'land';
    if (on === 'land') { if (!solid(i) || dIn[i] < (o.minIn ?? r * 0.7 + 2) || !solid(top)) return false; }
    else if (on === 'sea') { if (land[i] || dOut[i] < (o.minOut ?? r + 5)) return false; }
    else if (on === 'shallow') { if (land[i] || dOut[i] < 3 || dOut[i] > 10) return false; }
    else if (on === 'void') { if (land[i] || dOut[i] < (o.minOut ?? r + 4)) return false; }
    const ov = o.overlap ?? 0.95;
    for (const p of placed) { const dx = p.x - x, dy = p.y - y, m = (p.s.r + r) * ov; if (dx * dx + dy * dy < m * m) return false; }
    return true;
  };
  const add = (s, x, y, extra) => { const p = { s, x: R0(x), y: R0(y), ...extra }; placed.push(p); return p; };
  const scatter = (pick, count, o = {}, tries = count * 30) => {
    let n = 0;
    for (let k = 0; k < tries && n < count; k++) {
      const s = pick();
      const x = o.area ? rng.int(o.area[0], o.area[2]) : rng.int(8, W - 8), y = o.area ? rng.int(o.area[1], o.area[3]) : rng.int(12, H - 4);
      if (free(s, x, y, o)) { add(s, x, y, o.extra); n++; }
    }
    return n;
  };
  const cluster = (pick, centers, per, spread, o = {}) => {
    for (let c = 0, k = 0; c < centers && k < centers * 40; k++) {
      const cx = rng.int(20, W - 20), cy = rng.int(24, H - 10);
      if (!free(pick(), cx, cy, o)) continue;
      c++;
      for (let j = 0; j < per * 6; j++) {
        const a = rng() * 6.283, rr = Math.sqrt(rng()) * spread;
        const s = pick(), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.75;
        if (free(s, x, y, { ...o, overlap: o.overlap ?? 0.62 })) add(s, x, y);
      }
    }
  };
  const anims = [];
  if (world === 1) {
    scatter(() => prop('mountain', rng() < 0.4 ? 3 : 0), 5, { area: [24, 20, 230, 80], overlap: 0.55, minIn: 6 });
    scatter(() => prop('mountain', rng() < 0.3 ? 3 : 0), 3, { area: [300, 20, 430, 110], overlap: 0.55, minIn: 6 });
    scatter(() => prop('hill', rng.int(0, 2)), 9, { overlap: 1.1 });
    const tpick = () => { const k = rng(); return k < 0.5 ? prop('tree', rng() < 0.6 ? 'green' : 'deep') : k < 0.72 ? prop('pine', 'deep') : k < 0.86 ? prop('lolly', rng.int(0, 3)) : prop('tree_big', 'green'); };
    cluster(tpick, 16, 9, 26);
    scatter(() => prop('bush', rng() < 0.5 ? 'green' : 'mint'), 30, { overlap: 0.9 });
    scatter(() => prop('block', rng.int(0, 3)), 8);
    scatter(() => prop('mushroom', 0), 10);
    scatter(() => prop('rock', 0), 12);
    scatter(tpick, 40, { overlap: 0.8 });
  } else if (world === 2) {
    scatter(() => prop('wreck'), 1, { on: 'sea', minOut: 14 });
    scatter(() => prop('hut'), 3, { minIn: 7 });
    scatter(() => prop('hill', rng.int(0, 1)), 4, { minIn: 9 });
    scatter(() => prop('palm', rng.int(0, 1)), 46, { minIn: 3, overlap: 0.75 });
    scatter(() => prop('sandcastle'), 4, { minIn: 3 });
    scatter(() => prop('bush', 'green'), 10, { minIn: 7 });
    scatter(() => prop('sea_rock', rng.int(0, 1)), 18, { on: 'sea', minOut: 8 });
    scatter(() => prop('coral', rng.int(0, 2)), 22, { on: 'shallow', pathPad: 5 });
  } else if (world === 3) {
    for (let k = 0; k < 4; k++) scatter(() => prop('tower', k), 1, { minIn: 6, overlap: 1.2 });
    scatter(() => prop('fountain'), 1, { minIn: 10 });
    cluster(() => prop('house', rng.int(0, 11)), 12, 7, 26, { overlap: 0.82, minIn: 5 });
    scatter(() => prop('house', rng.int(0, 11)), 30, { overlap: 0.85, minIn: 5 });
    scatter(() => prop('gear', 0), 6, { minIn: 6, extra: { gear: true } });
    scatter(() => prop('tree', 'autumn'), 18, { overlap: 0.8 });
    scatter(() => prop('lamp'), 26, { pathPad: 4, nodePad: 9, overlap: 2 });
  } else if (world === 4) {
    scatter(() => prop('bedpost'), 3, { minIn: 7, overlap: 1.3 });
    scatter(() => prop('teddy'), 1, { minIn: 7 });
    scatter(() => prop('night_lamp'), 3, { minIn: 5, extra: { glow: true } });
    scatter(() => prop('sock', rng.int(0, 1)), 4);
    cluster(() => (rng() < 0.7 ? prop('dead_tree', rng.int(0, 3)) : rng() < 0.5 ? prop('tree', 'dusk') : prop('bush', 'dusk')), 12, 7, 22, { minIn: 3 });
    scatter(() => prop('mushroom', rng.int(1, 2)), 26, { minIn: 3 });
    scatter(() => (rng() < 0.6 ? prop('dead_tree', rng.int(0, 3)) : prop('bush', 'dusk')), 30, { minIn: 3, overlap: 0.8 });
    scatter(() => prop('block', rng.int(4, 7)), 8);
    scatter(() => prop('rock', 2), 10);
    scatter(() => prop('hill', 20 + rng.int(0, 1)), 3, { minIn: 8 });
  } else {
    scatter(() => prop('needle', 0), 4, { minIn: 6, overlap: 1.2 });
    scatter(() => prop('spool', rng.int(0, 2)), 10);
    cluster(() => prop('crystal', rng.int(0, 2)), 9, 6, 18);
    scatter(() => prop('heart_plant', rng.int(0, 1)), 30, { overlap: 0.8 });
    scatter(() => prop('tree', rng() < 0.5 ? 'rose' : 'gold'), 14, { overlap: 0.8 });
  }
  // marco do Mundo 5: coração gigante (animado), no maior espaço livre
  if (world === 5) {
    const hs = prop('big_heart', 0);
    for (let k = 0; k < 600; k++) {
      const x = rng.int(40, W - 40), y = rng.int(60, H - 20);
      if (free(hs, x, y, { on: k < 300 ? 'void' : 'land', minOut: 10, minIn: 6, overlap: 1 })) { placed.push({ s: hs, x, y, skip: true }); anims.push({ k: 'heart', x, y }); break; }
    }
  }
  // sombras primeiro, depois os carimbos ordenados por y
  placed.sort((a, b) => a.y - b.y);
  for (const p of placed) {
    if (p.skip || p.gear) continue;
    const r = Math.max(3, p.s.r);
    const ellip = (cx, cy, rx, ry) => {
      for (let yy = Math.floor(cy - ry); yy <= cy + ry; yy++) for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
        if (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1) pc.px(xx, yy, world >= 4 ? '#05020a55' : '#0b071640');
      }
    };
    ellip(p.x + 1, p.y, r + 1, 2);
  }
  for (const p of placed) {
    if (p.skip) continue;
    if (p.gear) { anims.push({ k: 'gear', x: p.x, y: p.y, ph: rng() * 6 }); continue; }
    pc.blit(p.s.pc, p.x - p.s.ax, p.y - p.s.ay);
    const nm = p.s.pc;
    if (p.glow) anims.push({ k: 'glow', x: p.x, y: p.y - 12, ph: rng() * 6 });
    if (p.s === prop('tower', 0) || p.s === prop('tower', 1) || p.s === prop('tower', 2) || p.s === prop('tower', 3)) anims.push({ k: 'clock', x: p.x, y: p.y - 35 + 16, ph: rng() * 6 });
    void nm;
  }
  // casinhas com chaminé soltam fumaça; janelas piscam
  if (world === 3) {
    for (const p of placed) {
      const hv = [0, 3, 6, 9].map((v) => prop('house', v));
      if (hv.includes(p.s) && rng() < 0.6) anims.push({ k: 'smoke', x: p.x - (p.s.ax) + p.s.w - 4, y: p.y - p.s.ay, ph: rng() * 6 });
    }
  }

  // ------------------------------------------------ animações pequenas
  const findSpot = (test, tries = 400) => {
    for (let k = 0; k < tries; k++) { const x = rng.int(6, W - 7), y = rng.int(8, H - 6); if (test(x, y, y * W + x)) return [x, y]; }
    return null;
  };
  const addN = (k, n, test, extra = {}) => { for (let j = 0; j < n; j++) { const s = findSpot(test); if (s) anims.push({ k, x: s[0], y: s[1], ph: rng() * 6.28, ...extra }); } };
  const seaOpen = (x, y, i) => !land[i] && dOut[i] > 6 && Dp[i] > 8;
  if (world === 1) {
    addN('glint', 10, seaOpen);
    addN('riv', 16, (x, y, i) => inland[i] && dRiv[i] > 2.5);
    addN('fly', 7, (x, y, i) => solid(i) && Dp[i] > 10 && Dn[i] > 18);
    addN('cloud', 3, () => true, { v: 0 });
  } else if (world === 2) {
    addN('glint', 26, seaOpen);
    addN('whirl', 1, (x, y, i) => !land[i] && dOut[i] > 20 && Dp[i] > 18);
    addN('boat', 2, (x, y, i) => !land[i] && dOut[i] > 12 && Dp[i] > 16);
    addN('fish', 3, (x, y, i) => !land[i] && dOut[i] > 10 && Dp[i] > 12);
    addN('gull', 3, () => true);
    addN('cloud', 2, () => true, { v: 1 });
  } else if (world === 3) {
    addN('riv', 14, (x, y, i) => inland[i] && dRiv[i] > 2.5);
    addN('glint', 8, seaOpen);
  } else if (world === 4) {
    addN('eyes', 16, (x, y, i) => !land[i] && dOut[i] > 8 && Dp[i] > 12);
    addN('eyes', 6, (x, y, i) => solid(i) && dIn[i] > 6 && Dp[i] > 14 && Dn[i] > 20);
    addN('mote', 18, () => true);
  } else {
    addN('star', 30, (x, y, i) => !land[i] && dOut[i] > 5);
    addN('rise', 14, (x, y, i) => solid(i) && Dp[i] > 8);
  }

  // ------------------------------------------------ quadros (espuma)
  const frames = [];
  const base = buf.slice();
  const foamU = U('#ffffff'), foam2 = U('#d8f4ff');
  for (let f = 0; f < 2; f++) {
    if (f) buf.set(base);
    if (world <= 3) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (land[i] || base[i] >>> 24 === 255) continue;
        const o = dOut[i];
        const b0 = f ? 2.6 : 1.6;
        if (o >= b0 && o < b0 + 1.2 && ((x * 2 + y + f * 3) % 5) < 3) buf[i] = o < b0 + 0.6 ? foamU : foam2;
        else if (o >= b0 + 3 && o < b0 + 3.8 && ((x + y * 3 + f * 5) % 9) < 2) buf[i] = foam2;
      }
    }
    pc.flush();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(pc.canvas, 0, 0);
    frames.push(c);
    if (world > 3) { frames.push(c); break; }
  }
  return { frames, water, land, inland, anims, Dp };
}

// ------------------------------------------------------------------ fundo
const BACK = {
  1: { s: 64, c: ['#2a68c8', '#3478d8', '#6aacf0', '#d8f0ff'] },
  2: { s: 64, c: ['#2470c8', '#2e82dc', '#62bcf4', '#e0f8ff'] },
  3: { s: 64, c: ['#2a2e6a', '#363c80', '#5a64a8', '#ffb070'] },
  4: { s: 96, c: ['#0a0614', '#120a22', '#241838', '#5a4a8a'] },
  5: { s: 96, c: ['#2e0618', '#3e0a22', '#661a3e', '#ffd0e0'] },
};
function backTiles(world) {
  return cached('back' + world, () => {
    const B = BACK[world], S = B.s, out = [];
    const rng = makeRng(world * 41 + 2);
    const stars = [];
    for (let i = 0; i < (world >= 4 ? 26 : 0); i++) stars.push([rng.int(0, S - 1), rng.int(0, S / 2 - 1), rng()]);
    for (let f = 0; f < 4; f++) {
      const pc = new PixelCanvas(S, world >= 4 ? S / 2 * 2 : S / 2);
      const H = pc.h;
      pc.rect(0, 0, S, H, B.c[0]);
      if (world <= 3) {
        for (let x = 0; x < S; x++) {
          const ph = (x + f * 4) / S * Math.PI * 2;
          const y1 = 7 + R0(Math.sin(ph * 2) * 1.6), y2 = 23 + R0(Math.sin(ph * 2 + 2) * 1.6);
          pc.px(x, y1, B.c[1]); pc.px(x, y1 + 1, B.c[1]); pc.px(x, y2, B.c[1]);
          if (((x + f * 8) % 32) < 7) pc.px(x, y1 - 1, B.c[2]);
          if (((x + 16 - f * 8 + 64) % 32) < 4) pc.px(x, y2 - 1, B.c[2]);
          if (((x + f * 8) % 32) === 3) pc.px(x, y1 - 2, B.c[3]);
        }
      } else {
        // névoa/nebulosa ondulante + estrelas cintilando
        for (let y = 0; y < H; y++) for (let x = 0; x < S; x++) {
          const n = Math.sin((x + f * 3) * 0.13 + Math.sin(y * 0.21) * 1.5) + Math.sin(y * 0.17 - x * 0.05);
          if (n > 1.3) pc.px(x, y, B.c[2]); else if (n > 0.7 && (x + y) % 2 === 0) pc.px(x, y, B.c[1]);
        }
        for (const [sx, sy, k] of stars) {
          for (const yy of [sy, sy + S / 2]) {
            const on = (k * 4 + f) % 4;
            if (on < 1) { pc.px(sx, yy, B.c[3]); pc.px(sx - 1, yy, B.c[2]); pc.px(sx + 1, yy, B.c[2]); pc.px(sx, yy - 1, B.c[2]); pc.px(sx, yy + 1, B.c[2]); }
            else if (on < 3) pc.px(sx, yy, B.c[3]);
            else pc.px(sx, yy, B.c[2]);
          }
        }
      }
      pc.flush();
      out.push(pc.canvas);
    }
    return out;
  });
}
/** Fundo animado da região (coords de tela; x0..x1 = faixa da região na tela). */
export function drawBackdrop(ctx, world, x0, x1, h, camX, camY, t) {
  const tiles = backTiles(world), img = tiles[Math.floor(t * (world >= 4 ? 2 : 3)) % 4];
  const tw = img.width, th = img.height;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, h); ctx.clip();
  ctx.fillStyle = BACK[world].c[0]; ctx.fillRect(x0, 0, x1 - x0, h);
  const px = world >= 4 ? camX * 0.6 : camX, py = world >= 4 ? camY * 0.6 : camY;   // vazio/cosmos com leve parallax
  const ox = -(((px % tw) + tw) % tw), oy = -(((py % th) + th) % th);
  for (let y = oy; y < h; y += th) for (let x = ox; x < x1; x += tw) if (x + tw > x0) ctx.drawImage(img, R0(x), R0(y));
  ctx.restore();
}

/** Costura dourada vertical entre duas regiões (12 x RH). */
export function seamImage() {
  return cached('seam', () => {
    const pc = new PixelCanvas(12, RH);
    for (let y = 0; y < RH; y++) { pc.px(5, y, '#0b0716aa'); pc.px(6, y, '#0b071688'); pc.px(4, y, '#0b071644'); pc.px(7, y, '#0b071644'); }
    for (let y = -6; y < RH; y += 8) {
      pc.line(2, y + 1, 9, y + 5, '#5a3a10'); pc.line(9, y + 5, 2, y + 9, '#5a3a10');
      pc.line(2, y, 9, y + 4, '#ffd23f'); pc.line(9, y + 4, 2, y + 8, '#ffe88a');
      pc.px(2, y, '#fff6c0');
    }
    pc.flush();
    return pc.canvas;
  });
}

// ------------------------------------------------------------------ caminhos
/**
 * Caminhos da região como imagem (RW x RH). links: [{ pts:[{x,y}] (locais, ~1px), open:bool }]
 * Por cima de água vira ponte (estilo do mundo). key = assinatura do estado.
 */
export function roadsImage(world, key, links, region) {
  return cached('roads' + world + '|' + key, () => {
    // descarta versões antigas desta região (estado mudou)
    for (const k of [...cache.keys()]) if (k.startsWith('roads' + world + '|') && k !== 'roads' + world + '|' + key) cache.delete(k);
    const pc = new PixelCanvas(RW, RH);
    const T = THEME[world];
    const isWater = (x, y) => { x = R0(x); y = R0(y); return x < 0 || y < 0 || x >= RW || y >= RH || region.water[y * RW + x] === 1; };
    const fill = colorU32(T.road[0]), edge = colorU32(T.road[1]), dot = colorU32(T.road[2]);
    const buf = pc.buf;
    const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < RW && y < RH) buf[y * RW + x] = c; };
    // 1) bordas e pontes, 2) recheio, 3) pontinhos centrais
    const open = links.filter((l) => l.open), ghost = links.filter((l) => !l.open);
    const bridgeCols = {
      wood: ['#c88a4a', '#8a5a2a', '#5a3414', '#e8b070'], stone: ['#b8b0b0', '#7a7070', '#4a4040', '#e0d8d8'],
      rope: ['#5a4a72', '#3a2c52', '#c8b8f0', '#7a6a98'], thread: ['#ff9ab8', '#c84a7a', '#ffd23f', '#ffd0e0'],
    }[T.bridge];
    const BC = bridgeCols.map(colorU32);
    for (const l of open) {
      const P = l.pts;
      for (let k = 0; k < P.length; k++) {
        const p = P[k], q = P[Math.min(P.length - 1, k + 1)], o = P[Math.max(0, k - 1)];
        const x = R0(p.x), y = R0(p.y);
        const horiz = Math.abs(q.x - o.x) >= Math.abs(q.y - o.y);
        if (isWater(x, y)) {
          // ponte: tábuas perpendiculares ao caminho, corrimãos nas bordas
          for (let j = -4; j <= 4; j++) {
            const xx = horiz ? x : x + j, yy = horiz ? y + j : y;
            const along = horiz ? x : y;
            let c = Math.abs(j) === 4 ? BC[2] : Math.abs(j) === 3 ? BC[1] : (along % 3 === 0 ? BC[1] : BC[0]);
            if (Math.abs(j) < 3 && along % 3 === 1 && j === -2) c = BC[3];
            set(xx, yy, c);
          }
          if ((horiz ? x : y) % 8 === 0) { for (let j = 5; j <= 6; j++) set(horiz ? x : x + j, horiz ? y + j : y, BC[2]); }
          continue;
        }
        for (let j = -3; j <= 3; j++) for (let m = -3; m <= 3; m++) {
          if (Math.abs(j) === 3 && Math.abs(m) === 3) continue;
          const i = (y + j) * RW + (x + m);
          if (x + m < 0 || y + j < 0 || x + m >= RW || y + j >= RH) continue;
          if (buf[i] !== fill && !isWater(x + m, y + j)) buf[i] = edge;
        }
      }
    }
    for (const l of open) for (const p of l.pts) {
      const x = R0(p.x), y = R0(p.y);
      if (isWater(x, y)) continue;
      for (let j = -2; j <= 2; j++) for (let m = -2; m <= 2; m++) { if (Math.abs(j) === 2 && Math.abs(m) === 2) continue; if (!isWater(x + m, y + j)) set(x + m, y + j, fill); }
    }
    for (const l of open) {
      for (let k = 2; k < l.pts.length - 2; k += 5) {
        const p = l.pts[k], x = R0(p.x), y = R0(p.y);
        if (isWater(x, y)) continue;
        set(x, y, dot); set(x - 1, y, dot); set(x, y - 1, dot); set(x - 1, y - 1, dot);
      }
    }
    // trechos ainda trancados: só pontinhos apagados
    const gh = colorU32(world >= 4 ? '#a898d866' : '#1b103066');
    for (const l of ghost) {
      for (let k = 3; k < l.pts.length - 3; k += 6) {
        const p = l.pts[k], x = R0(p.x), y = R0(p.y);
        for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = (y + b) * RW + (x + a);
          if (x + a >= 0 && y + b >= 0 && x + a < RW && y + b < RH && !(buf[i] >>> 24)) buf[i] = gh;
        }
      }
    }
    pc.flush();
    return pc.canvas;
  });
}

/** Trecho sendo revelado (animação), desenhado direto no contexto. frac 0..1. */
export function drawRoadPartial(ctx, world, pts, frac, ox) {
  const T = THEME[world];
  const n = Math.floor(pts.length * clamp(frac, 0, 1));
  ctx.fillStyle = T.road[1];
  for (let k = 0; k < n; k += 2) { const p = pts[k]; ctx.fillRect(R0(p.x) + ox - 3, R0(p.y) - 3, 7, 7); }
  ctx.fillStyle = T.road[0];
  for (let k = 0; k < n; k += 2) { const p = pts[k]; ctx.fillRect(R0(p.x) + ox - 2, R0(p.y) - 2, 5, 5); }
  ctx.fillStyle = T.road[2];
  for (let k = 2; k < n; k += 5) { const p = pts[k]; ctx.fillRect(R0(p.x) + ox - 1, R0(p.y) - 1, 2, 2); }
}

// ------------------------------------------------------------------ nós
/** Bolinha de fase. kind: 'level'|'dyn'|'bonus'; state: 'open'|'done'|'locked'|'soon'; f = quadro de brilho. */
export function nodeImage(kind, state, f = 0) {
  return cached(`node${kind}${state}${f}`, () => {
    const big = kind === 'dyn';
    const S = big ? 15 : 13;
    const pc = new PixelCanvas(S, S + 1);
    const c = (S - 1) / 2;
    const face = state === 'done' ? ['#c81e2e', '#ff5a5a', '#ffb0a0', '#7a0a14']
      : state === 'open' ? ['#e8a810', '#ffd83a', '#fff6b0', '#9a6a08']
        : ['#5a5470', '#7a7490', '#a8a0c0', '#3a3448'];
    if (kind === 'bonus') {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.8 : 6; pts.push([c + 0.5 + Math.cos(a) * r, c + 1 + Math.sin(a) * r]); }
      pc.poly(pts.map(([x, y]) => [x, y + 1]), '#0b071677');
      pc.poly(pts, face[0]);
      pc.poly(pts.map(([x, y]) => [c + 0.5 + (x - c - 0.5) * 0.65 - 0.5, c + 1 + (y - c - 1) * 0.65 - 0.5]), face[1]);
      pc.px(R0(c - 1), R0(c - 1), face[2]);
    } else {
      const r = big ? 6 : 5;
      pc.circle(c + 0.5, c + 1.5, r, '#0b071677');
      pc.circle(c + 0.5, c + 0.5, r, face[3]);
      pc.circle(c + 0.5, c + 0.5, r - 1, face[0]);
      pc.circle(c, c, r - 2, face[1]);
      pc.px(R0(c - 2), R0(c - 2), face[2]); pc.px(R0(c - 1), R0(c - 2), face[2]); pc.px(R0(c - 2), R0(c - 1), face[2]);
      if (f) { pc.px(R0(c + 1), R0(c + 1), face[2]); }
      if (big) { // seta da fase dinâmica
        const col = state === 'locked' || state === 'soon' ? '#3a3448' : '#ffffff';
        pc.px(R0(c), R0(c) - 2, col); pc.hline(R0(c) - 1, R0(c) - 1, 3, col); pc.hline(R0(c) - 2, R0(c), 5, col); pc.vline(R0(c), R0(c) + 1, 2, col);
      }
      if (state === 'soon') { pc.px(R0(c), R0(c) - 1, '#d8d0f0'); pc.px(R0(c) + 1, R0(c) - 2, '#d8d0f0'); pc.px(R0(c), R0(c) + 2, '#d8d0f0'); }
    }
    pc.outline(INK);
    pc.flush();
    return pc.canvas;
  });
}

/** Castelo do chefe com o pivô (porta) em (x,y). */
export function drawCastle(ctx, world, x, y, state, t) {
  const locked = state === 'locked' || state === 'soon';
  const s = castleProp(world, locked);
  ctx.drawImage(propCanvas(s), R0(x - s.ax), R0(y - s.ay));
  if (state === 'done') {
    const f = flagProp(world), wave = Math.floor(t * 4) % 2;
    ctx.drawImage(propCanvas(f), R0(x - 1), R0(y - s.ay - 12 + wave));
  } else if (!locked && world === 4) { // olhos da cabeceira piscam
    if (Math.sin(t * 1.7) > 0.93) { ctx.fillStyle = '#0b0716'; ctx.fillRect(R0(x - 5), R0(y - 13), 2, 2); ctx.fillRect(R0(x + 3), R0(y - 13), 2, 2); }
  }
}

// ------------------------------------------------------------------ animações
const cloudImgs = () => cached('ow_clouds', () => {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const rng = makeRng(k * 31 + 5);
    const cw = rng.int(48, 70), ch = 22;
    const pc = new PixelCanvas(cw + 4, ch + 4), sh = new PixelCanvas(cw + 4, ch + 4);
    const ps = [];
    for (let i = 0; i < 5; i++) ps.push([9 + rng() * (cw - 18), ch - 9 - rng() * 4, rng.range(6, 9)]);
    for (const [x, y, r] of ps) { pc.circle(x, y + 1, r, '#c8dcf0'); sh.circle(x, y, r, '#0b07161c'); }
    for (const [x, y, r] of ps) pc.circle(x - 1, y - 1, r * 0.85, '#ffffff');
    pc.outline('#8aa8c8');
    pc.flush(); sh.flush();
    out.push({ img: pc.canvas, sh: sh.canvas });
  }
  return out;
});
const boatImg = () => cached('ow_boat', () => {
  const pc = new PixelCanvas(16, 14);
  pc.poly([[1, 9], [15, 9], [12, 13], [4, 13]], '#8a4a2a'); pc.hline(2, 10, 12, '#c07a4a');
  pc.vline(8, 1, 8, '#5a3a1a'); pc.poly([[9, 1], [14, 7], [9, 7]], '#fff4dc'); pc.poly([[7, 2], [7, 7], [3, 7]], '#ff7a6a');
  pc.outline(INK); pc.flush(); return pc.canvas;
});
const gearFrames = () => cached('ow_gears', () => [0, 1].map((v) => propCanvas(prop('gear', v))));
const heartFrames = () => cached('ow_hearts', () => [0, 1].map((v) => propCanvas(prop('big_heart', v))));
const glowImg = () => cached('ow_glow', () => {
  const S = 40, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,224,138,0.55)'); gr.addColorStop(1, 'rgba(255,224,138,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return c;
});

/** Detalhes animados da região (ctx já transladado para coords do MAPA; ox = x da região). */
const TOP_ANIMS = new Set(['fly', 'cloud', 'gull', 'mote']);
export function drawRegionAnims(ctx, world, region, ox, t, layer) {
  for (const a of region.anims) {
    const top = TOP_ANIMS.has(a.k);
    if (layer === 'shadow' ? a.k !== 'cloud' : (layer === 'top') !== top) continue;
    const x = ox + a.x, y = a.y, ph = a.ph || 0;
    switch (a.k) {
      case 'glint': {
        const s = Math.sin(t * 2.2 + ph * 3);
        if (s > 0.6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 3, 1); if (s > 0.85) ctx.fillRect(x, y - 1, 1, 3); }
        break;
      }
      case 'riv': {
        const k = (t * 1.5 + ph) % 2;
        if (k < 1) { ctx.fillStyle = world === 3 ? '#ffd090' : '#e0f8ff'; ctx.fillRect(x + R0(k * 3) - 1, y, 2, 1); }
        break;
      }
      case 'fly': { // borboletas
        if (layer !== 'top') break;
        const fx = x + R0(Math.sin(t * 0.8 + ph) * 10), fy = y + R0(Math.cos(t * 1.3 + ph) * 5) - 6;
        const wing = Math.floor(t * 8 + ph) % 2;
        ctx.fillStyle = ph > 3 ? '#fff07a' : '#ff9ad8';
        ctx.fillRect(fx - 1 - wing, fy, 1 + wing, 2); ctx.fillRect(fx + 1, fy, 1 + wing, 2);
        ctx.fillStyle = '#1b1030'; ctx.fillRect(fx, fy, 1, 2);
        break;
      }
      case 'cloud': {
        const C = cloudImgs()[Math.floor(ph) % 3];
        const span = RW + 120;
        const cx = ox + ((((a.x + t * (4 + ph)) % span) + span) % span) - 60;
        if (layer === 'shadow') break;
        ctx.globalAlpha = 0.8; ctx.drawImage(C.img, R0(cx), R0(y - 6)); ctx.globalAlpha = 1;
        break;
      }
      case 'whirl': {
        for (let i = 0; i < 18; i++) {
          const ang = -t * 3 + i * 0.55, r = 1 + i * 0.6;
          ctx.fillStyle = i % 3 ? '#9ad8f8' : '#ffffff';
          ctx.fillRect(R0(x + Math.cos(ang) * r), R0(y + Math.sin(ang) * r * 0.6), 1, 1);
        }
        break;
      }
      case 'boat': {
        const bob = R0(Math.sin(t * 2 + ph) * 1.2), dx = R0(Math.sin(t * 0.2 + ph) * 14);
        ctx.fillStyle = '#ffffff';
        if (Math.floor(t * 3 + ph) % 2) ctx.fillRect(x + dx - 9, y + 5, 3, 1); else ctx.fillRect(x + dx + 7, y + 5, 3, 1);
        ctx.drawImage(boatImg(), x + dx - 8, y - 8 + bob);
        break;
      }
      case 'fish': {
        const k = (t * 0.6 + ph) % 3;
        if (k < 1) {
          const fx = x + R0((k - 0.5) * 16), fy = y - R0(Math.sin(k * Math.PI) * 10);
          ctx.fillStyle = '#ff8a3c'; ctx.fillRect(fx - 2, fy, 4, 2); ctx.fillStyle = '#ffd23f'; ctx.fillRect(fx - 3, fy - 1, 1, 1); ctx.fillRect(fx - 3, fy + 2, 1, 1);
        } else if (k < 1.3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, y - 1, 1, 1); ctx.fillRect(x + 9, y - 2, 1, 1); ctx.fillRect(x + 6, y - 2, 1, 1); }
        break;
      }
      case 'gull': {
        if (layer !== 'top') break;
        const span = RW;
        const gx = ox + ((((a.x + t * 16 + ph * 40) % span) + span) % span), gy = y * 0.4 + 20 + R0(Math.sin(t + ph) * 6);
        const up = Math.floor(t * 5 + ph) % 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(R0(gx) - 3, R0(gy) - up, 2, 1); ctx.fillRect(R0(gx) + 1, R0(gy) - up, 2, 1); ctx.fillRect(R0(gx) - 1, R0(gy), 2, 1);
        break;
      }
      case 'gear': {
        const fr = gearFrames()[Math.floor(t * 4 + ph) % 2];
        ctx.drawImage(fr, x - 7, y - 14);
        break;
      }
      case 'clock': {
        const hA = t * 0.5 + ph, mA = t * 3 + ph * 2;
        ctx.fillStyle = INK;
        for (let k = 1; k <= 3; k++) ctx.fillRect(R0(x + Math.cos(mA) * k), R0(y + Math.sin(mA) * k), 1, 1);
        ctx.fillStyle = '#a8401a';
        for (let k = 1; k <= 2; k++) ctx.fillRect(R0(x + Math.cos(hA) * k), R0(y + Math.sin(hA) * k), 1, 1);
        break;
      }
      case 'smoke': {
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.5 + ph + i / 3) % 1;
          ctx.fillStyle = `rgba(220,210,230,${(0.7 * (1 - k)).toFixed(2)})`;
          const s = 1 + R0(k * 2);
          ctx.fillRect(R0(x + Math.sin(k * 5 + ph) * 2) - (s >> 1), R0(y - k * 14), s + 1, s + 1);
        }
        break;
      }
      case 'eyes': {
        const bl = Math.sin(t * 0.9 + ph * 7);
        if (bl < -0.2) break; // fechados por um tempo
        const look = R0(Math.sin(t * 0.4 + ph));
        ctx.fillStyle = bl > 0.96 ? '#5a4a20' : '#ffe14a';
        ctx.fillRect(x - 2 + look, y, 2, bl > 0.96 ? 1 : 2); ctx.fillRect(x + 2 + look, y, 2, bl > 0.96 ? 1 : 2);
        break;
      }
      case 'mote': {
        if (layer !== 'top') break;
        const mx = x + R0(Math.sin(t * 0.5 + ph) * 8), my = y - R0(((t * 6 + ph * 10) % 30));
        ctx.fillStyle = Math.sin(t * 3 + ph) > 0 ? '#a898d8' : '#6a5aa0';
        ctx.fillRect(mx, my, 1, 1);
        break;
      }
      case 'glow': {
        const k = 0.75 + Math.sin(t * 9 + ph) * 0.08 + Math.sin(t * 23 + ph) * 0.05;
        ctx.globalAlpha = clamp(k, 0, 1);
        ctx.drawImage(glowImg(), x - 20, y - 20);
        ctx.globalAlpha = 1;
        break;
      }
      case 'star': {
        const s = Math.sin(t * 2.5 + ph * 5);
        ctx.fillStyle = s > 0.5 ? '#ffffff' : '#ffb0d0';
        ctx.fillRect(x, y, 1, 1);
        if (s > 0.8) { ctx.fillStyle = '#ff9ac0'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
        break;
      }
      case 'rise': {
        const k = (t * 0.4 + ph) % 1;
        ctx.fillStyle = k < 0.5 ? '#ffd23f' : '#ffb0c8';
        ctx.fillRect(x + R0(Math.sin(k * 6 + ph) * 2), R0(y - k * 18), 1, 1);
        break;
      }
      case 'heart': {
        const beat = (t * 1.4) % 1, big = beat < 0.12 || (beat > 0.22 && beat < 0.32);
        const img = heartFrames()[big ? 1 : 0];
        ctx.drawImage(img, x - 20, y - 34);
        break;
      }
      default: break;
    }
  }
}

// ------------------------------------------------------------------ trancado
/** Camada de pontos em X sobre uma região ainda costurada (RW x RH). */
export function lockedOverlay() {
  return cached('lockedOv', () => {
    const pc = new PixelCanvas(RW, RH);
    pc.rect(0, 0, RW, RH, '#0b0716a0');
    for (let row = 0; row < 5; row++) {
      const yy = 40 + row * 48 + (row % 2) * 6;
      for (let xx = 18 + (row % 2) * 7; xx < RW - 22; xx += 14) {
        for (let i = 0; i < 7; i++) {
          pc.px(xx + i, yy - 3 + i, '#120a1e'); pc.px(xx + 6 - i, yy - 3 + i, '#120a1e');
          pc.px(xx + i, yy - 4 + i, '#6a5a88'); pc.px(xx + 6 - i, yy - 4 + i, '#6a5a88');
        }
      }
    }
    pc.flush();
    return pc.canvas;
  });
}

export { R0, darken, lighten, mixColor };
