// =============================================================================
// overworld_art.js — Arte do mapa-múndi estilo "overworld" 16 bits (original):
// ilhas com litoral orgânico, praia, espuma, penhascos, morros sombreados,
// árvores e marcos temáticos por mundo; mar animado; castelos dos chefes;
// nuvens com sombra. Usado por scenes/worldmap.js. Tudo pré-renderizado.
// =============================================================================
import { PixelCanvas } from '../../engine/pixel.js';
import { makeRng, mixColor, clamp } from '../../engine/util.js';

const INK = '#1b1030';
export const ISLE_M = 26; // margem de praia/mar raso ao redor da área de 232x124

const THEME = {
  1: { g: ['#2f7a3a', '#3f9a48', '#5fbf5a', '#8fe07a'], sand: ['#e8d49a', '#c8ac70'], cliff: ['#8a5a32', '#5a3a1e'], hill: ['#3f9a48', '#6fcf62', '#2a6a32'] },
  2: { g: ['#c8a868', '#dcc080', '#efd8a0', '#fff0c8'], sand: ['#f4e4b0', '#d8c088'], cliff: ['#5a7a9a', '#3a5070'], hill: ['#3fa0a8', '#7fd8d0', '#2a6a78'] },
  3: { g: ['#7a5a3a', '#9a7448', '#b88e5a', '#dab07a'], sand: ['#c8b090', '#a08868'], cliff: ['#6a4a2a', '#42301a'], hill: ['#b07a3a', '#e0aa5a', '#7a4f22'] },
  4: { g: ['#24183c', '#302250', '#3e2e66', '#5a4890'], sand: ['#5a5470', '#3e3a52'], cliff: ['#2a2238', '#16101e'], hill: ['#3a2a5a', '#5a4888', '#22183a'] },
  5: { g: ['#5a0e26', '#7a1430', '#a01e40', '#d04060'], sand: ['#6a2a3a', '#4a1a28'], cliff: ['#3a0a1a', '#22040e'], hill: ['#8a1a3a', '#c8385a', '#5a0a24'] },
};

const cache = new Map();
const cached = (k, f) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };

/** Ilha do mundo (canvas de (PW+2M) x (PH+2M)); nodesLocal = pontos dos caminhos (coords da área). */
export function islandImage(world, locked, PW, PH, nodesLocal, segsLocal) {
  return cached(`isle${world}${locked ? 'L' : ''}`, () => {
    const M = ISLE_M, W = PW + M * 2, H = PH + M * 2;
    const T = THEME[world];
    const C = locked ? (c) => mixColor(c, '#2e2a3e', 0.7) : (c) => c;
    const pc = new PixelCanvas(W, H);
    const rng = makeRng(world * 7919 + 3);
    const ph1 = rng() * 6.28, ph2 = rng() * 6.28;
    const cx = W / 2, cy = H / 2;
    // signed "inside" distance of an organic blob (rounded rect + wobble)
    const rr = 18;
    const dist = (x, y) => {
      const qx = Math.abs(x - cx) - (PW / 2 + 4 - rr), qy = Math.abs(y - cy) - (PH / 2 + 2 - rr);
      const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
      const a = Math.atan2(y - cy, x - cx);
      const wob = Math.sin(a * 5 + ph1) * 3.2 + Math.sin(a * 11 + ph2) * 1.6 + Math.sin(a * 23) * 0.7;
      return -(sdf - wob);
    };
    const D = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) D[y * W + x] = dist(x, y);
    const land = (x, y) => x >= 0 && y >= 0 && x < W && y < H && D[y * W + x] > 3;
    // shallow water + foam + beach + grass
    const shallow = C(world === 4 ? '#1e2a4a' : world === 5 ? '#4a1a3a' : '#5fd0d8');
    const shallow2 = C(world === 4 ? '#18223e' : world === 5 ? '#3a1230' : '#3fb0c8');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = D[y * W + x];
      if (d < -12) continue;
      if (d < -3) { const k = (d + 12) / 9; pc.px(x, y, k > 0.55 || ((x + y) % 3 === 0 && k > 0.25) ? shallow : shallow2 + '99'); continue; }
      if (d < -1.5) { if ((x * 3 + y) % 4 !== 0) pc.px(x, y, C('#ffffff')); continue; }
      if (d < 3) { pc.px(x, y, C(d < 0.5 ? T.sand[1] : T.sand[0])); continue; }
      let c = T.g[1];
      const n = Math.sin(x * 0.31 + y * 0.17) + Math.sin(x * 0.11 - y * 0.29);
      if (n > 0.9) c = T.g[2]; else if (n < -1.0) c = T.g[0];
      if ((x % 5 === 0 && y % 3 === 0) || (x % 5 === 2 && y % 3 === 1)) c = n > 0 ? T.g[3] : T.g[2];
      if (d < 5) c = T.g[0];
      pc.px(x, y, C(c));
    }
    // south-facing cliff (gives the island height)
    for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
      if (land(x, y)) continue;
      let up = 0;
      for (let k = 1; k <= 5; k++) if (land(x, y - k)) { up = k; break; }
      if (!up || D[y * W + x] < -6) continue;
      const c = up <= 2 ? T.cliff[0] : T.cliff[1];
      pc.px(x, y, C((x + y) % 5 === 0 ? mixColor(c, '#000000', 0.25) : c));
      if (up === 5 || !land(x, y - up + 1) === false && up === 5) pc.px(x, y, C(INK));
    }
    // keep decor away from paths
    const far = (x, y, r = 13) => {
      for (const [a, b] of segsLocal) {
        const ax = a[0] + M, ay = a[1] + M, bx = b[0] + M, by = b[1] + M;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const k = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
        if (Math.hypot(x - ax - dx * k, y - ay - dy * k) < r) return false;
      }
      for (const [nx, ny] of nodesLocal) if (Math.hypot(x - nx - M, y - ny - M) < r + 4) return false;
      return D[y * W + x] > 10;
    };
    // hills (rounded mounds with light from the top-left)
    const hills = [];
    for (let tries = 0; tries < 300 && hills.length < 7; tries++) {
      const x = rng.int(20, W - 20), y = rng.int(20, H - 20), r = rng.int(8, 15);
      if (!far(x, y, r + 6) || hills.some((h) => Math.hypot(h.x - x, h.y - y) < h.r + r + 4)) continue;
      hills.push({ x, y, r });
    }
    hills.sort((a, b) => a.y - b.y);
    for (const h of hills) {
      const [base, lite, dark] = T.hill.map(C);
      pc.ellipse(h.x + 2, h.y + 2, h.r, h.r * 0.75, '#0b071655');
      pc.ellipse(h.x, h.y, h.r, h.r * 0.75, dark);
      pc.ellipse(h.x - 1, h.y - 1, h.r - 1, h.r * 0.75 - 1, base);
      pc.ellipse(h.x - h.r * 0.3, h.y - h.r * 0.3, h.r * 0.45, h.r * 0.3, lite);
      pc.ellipseOutline(h.x, h.y, h.r, h.r * 0.75, C(INK));
    }
    // themed props
    const prop = (x, y) => {
      const k = rng();
      if (world === 1) {
        // round tree
        pc.ellipse(x + 1, y + 4, 4, 2, '#0b071655'); pc.rect(x, y, 2, 4, C('#6a4428'));
        pc.circle(x + 1, y - 3, 4.5, C('#2a6a32')); pc.circle(x, y - 4, 3.5, C('#4fae4a')); pc.px(x - 1, y - 6, C('#a8f080'));
        if (k < 0.2) { pc.px(x + 4, y + 2, C('#ff5a6a')); pc.px(x - 3, y + 3, C('#fff07a')); }
      } else if (world === 2) {
        if (k < 0.5) { pc.vline(x, y - 6, 7, C('#3a7a3a')); pc.px(x - 1, y - 6, C('#5fbf5a')); pc.px(x + 1, y - 5, C('#5fbf5a')); pc.hline(x - 3, y - 7, 7, C('#5fbf5a')); pc.px(x - 3, y - 6, C('#3a8a3a')); pc.px(x + 3, y - 6, C('#3a8a3a')); }
        else { pc.vline(x, y - 4, 5, C('#ff7a9a')); pc.vline(x - 2, y - 2, 3, C('#ff7a9a')); pc.vline(x + 2, y - 3, 4, C('#ffa0b8')); }
      } else if (world === 3) {
        const hh = rng.int(6, 11);
        pc.rect(x - 3, y - hh, 6, hh, C('#c8a070')); pc.rect(x - 3, y - hh - 2, 6, 2, C('#8a4a2a'));
        for (let wy = y - hh + 2; wy < y - 1; wy += 3) { pc.px(x - 2, wy, C('#ffe08a')); pc.px(x + 1, wy, C('#ffe08a')); }
        pc.strokeRect(x - 3, y - hh - 2, 6, hh + 2, C(INK));
      } else if (world === 4) {
        if (k < 0.5) { pc.px(x, y, C('#ffe14a')); pc.px(x + 3, y, C('#ffe14a')); }
        else { pc.vline(x, y - 6, 7, C('#5a4a6a')); pc.line(x, y - 4, x - 3, y - 7, C('#5a4a6a')); pc.line(x, y - 3, x + 3, y - 6, C('#5a4a6a')); }
      } else {
        pc.tri(x - 2, y, x + 2, y, x, y - 7, C('#ff6a9a')); pc.tri(x - 1, y, x + 1, y, x, y - 5, C('#ffc0d8'));
        if (k < 0.4) for (let i = 0; i < 6; i++) pc.px(x + 3 + i, y - 4 + Math.round(Math.sin(i) * 1.5), C('#ffd23f'));
      }
    };
    let placed = 0;
    for (let tries = 0; tries < 600 && placed < 26; tries++) {
      const x = rng.int(14, W - 14), y = rng.int(14, H - 12);
      if (!far(x, y) || hills.some((h) => Math.hypot(h.x - x, h.y - y) < h.r + 4)) continue;
      prop(x, y); placed++;
    }
    // World 1: a little river with a bridge spot; World 2: tide pools
    if (world === 1 || world === 2) {
      let x = rng.int(W * 0.35, W * 0.65), y = 14;
      const col = C(world === 1 ? '#4fb0e0' : '#7fe0f0');
      for (; y < H - 14; y++) {
        x += Math.round(Math.sin(y * 0.15 + ph1));
        if (D[y * W + x] > 3) { pc.rect(x - 1, y, 3, 1, col); if (y % 5 === 0) pc.px(x, y, C('#d8f6ff')); }
      }
    }
    pc.flush();
    return pc.canvas;
  });
}

/** Castelo/marco do chefe de cada mundo (30x36). Ponto (15,33) = porta, sobre o botão do chefe. */
export function castleImage(world, locked) {
  return cached(`castle${world}${locked ? 'L' : ''}`, () => {
    const pc = new PixelCanvas(30, 36);
    const C = locked ? (c) => mixColor(c, '#2e2a3e', 0.6) : (c) => c;
    pc.ellipse(15, 34, 12, 2.5, '#0b071666');
    if (world === 1) { // hollow tree burrow
      pc.rect(9, 12, 12, 22, C('#7a4a2a')); pc.rect(10, 12, 3, 22, C('#9a6a3a'));
      pc.circle(15, 9, 11, C('#2a6a32')); pc.circle(12, 7, 7, C('#4fae4a')); pc.circle(19, 8, 6, C('#3f9a48'));
      pc.ellipse(15, 28, 3.5, 5, C('#1a0c06'));
      pc.px(9, 4, C('#ff5a6a')); pc.px(20, 3, C('#ff5a6a'));
    } else if (world === 2) { // glass lighthouse
      pc.poly([[10, 33], [20, 33], [18, 10], [12, 10]], C('#e8f4ff'));
      for (let y = 14; y < 33; y += 6) pc.rect(11, y, 9, 3, C('#7fd0ff'));
      pc.rect(11, 5, 8, 5, C('#ffe27a')); pc.rect(10, 4, 10, 1, C('#5a7a9a')); pc.tri(10, 4, 20, 4, 15, 0, C('#ff6a6a'));
      pc.rect(14, 28, 3, 5, C('#2a4a6a'));
    } else if (world === 3) { // clock tower
      pc.rect(9, 8, 12, 25, C('#c8a070')); pc.rect(9, 8, 3, 25, C('#e0c090'));
      pc.tri(8, 8, 22, 8, 15, 0, C('#8a4a2a'));
      pc.circle(15, 14, 4, C('#fff4dc')); pc.ring(15, 14, 4, C('#7a4020')); pc.vline(15, 11, 3, C(INK)); pc.hline(15, 14, 3, C(INK));
      pc.rect(13, 27, 5, 6, C('#4a2a10'));
    } else if (world === 4) { // giant bed fortress
      pc.rect(4, 18, 22, 10, C('#4a3a7a')); pc.rect(4, 16, 22, 3, C('#e8e0ff'));
      pc.rect(3, 8, 3, 25, C('#6a4a3a')); pc.rect(24, 12, 3, 21, C('#6a4a3a'));
      pc.rect(6, 28, 18, 5, C('#0b0716')); pc.px(11, 30, C('#ffe14a')); pc.px(15, 30, C('#ffe14a'));
      for (let x = 6; x < 24; x += 4) pc.px(x, 22, C('#6a5aa0'));
    } else { // the Tailor's loom spire
      pc.poly([[8, 33], [22, 33], [17, 6], [13, 6]], C('#2a0a1a'));
      pc.tri(11, 8, 19, 8, 15, 0, C('#5a1030'));
      pc.line(6, 4, 24, 30, C('#ffd23f')); pc.line(24, 6, 6, 30, C('#ffd23f'));
      pc.ellipse(15, 18, 2, 3, C('#ff4f8a')); pc.rect(13, 27, 5, 6, C('#ff4f8a'));
    }
    pc.outline(INK);
    pc.flush();
    return pc.canvas;
  });
}

/** Mar animado preenchendo a tela (camX/camY = câmera do mapa). */
export function drawSea(ctx, w, h, camX, camY, t, world) {
  const deep = world === 4 ? ['#0e1430', '#141c40', '#26305a'] : world === 5 ? ['#2a0820', '#3a0c2c', '#5a1a40'] : ['#1f6fb8', '#2a86cc', '#7fd0f0'];
  ctx.fillStyle = deep[0];
  ctx.fillRect(0, 0, w, h);
  const tile = cached(`sea${deep[0]}`, () => {
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const pc = new PixelCanvas(48, 24);
      pc.rect(0, 0, 48, 24, deep[0]);
      for (let i = 0; i < 48; i++) {
        const y1 = 6 + Math.round(Math.sin((i + f * 3) * 0.26) * 1.5);
        const y2 = 18 + Math.round(Math.sin((i + 24 - f * 3) * 0.26) * 1.5);
        pc.px(i, y1, deep[1]); pc.px(i, y1 + 1, deep[1]);
        pc.px(i, y2, deep[1]);
        if ((i + f * 5) % 16 < 4) pc.px(i, y1 - 1, deep[2]);
      }
      pc.flush();
      frames.push(pc.canvas);
    }
    return frames;
  });
  const fr = tile[Math.floor(t * 3) % 4];
  const ox = -(((camX % 48) + 48) % 48), oy = -(((camY % 24) + 24) % 24);
  for (let y = oy; y < h; y += 24) for (let x = ox; x < w; x += 48) ctx.drawImage(fr, x, y);
  // sparkles
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 22; i++) {
    const sx = ((i * 97 - camX * 1) % (w + 40) + w + 40) % (w + 40) - 20;
    const sy = ((i * 53 - camY) % (h + 20) + h + 20) % (h + 20) - 10;
    if (Math.sin(t * 3 + i * 1.7) > 0.85) { ctx.fillRect(Math.round(sx), Math.round(sy), 2, 1); ctx.fillRect(Math.round(sx) + 1, Math.round(sy) - 1, 1, 3); }
  }
}

/** Nuvens passando por cima do mapa, com sombra no chão/mar. */
export function drawClouds(ctx, w, h, camX, camY, t, layer) {
  const puffs = cached('ow_clouds', () => {
    const out = [];
    for (let k = 0; k < 4; k++) {
      const rng = makeRng(k * 31 + 5);
      const cw = rng.int(64, 96), ch = 26;
      const pc = new PixelCanvas(cw + 4, ch + 4), sh = new PixelCanvas(cw + 4, ch + 4);
      const ps = [];
      for (let i = 0; i < 6; i++) ps.push([10 + rng() * (cw - 20), ch - 10 - rng() * 5, rng.range(7, 11)]);
      for (const [x, y, r] of ps) { pc.circle(x, y + 1, r, '#c8dcf0'); sh.circle(x, y, r, '#0b07161e'); }
      for (const [x, y, r] of ps) pc.circle(x - 1, y - 1, r * 0.85, '#ffffff');
      pc.flush(); sh.flush();
      out.push({ img: pc.canvas, sh: sh.canvas });
    }
    return out;
  });
  const span = w + 160;
  for (let i = 0; i < 3; i++) {
    const c = puffs[i % 4];
    const x = Math.round((((i * 263 + t * (5 + i) - camX * 0.5) % span) + span) % span - 80);
    const y = Math.round(24 + ((i * 71) % Math.max(40, h - 110)) - camY * 0.2);
    if (layer === 'shadow') ctx.drawImage(c.sh, x + 14, y + 26);
    else { ctx.globalAlpha = 0.9; ctx.drawImage(c.img, x, y); ctx.globalAlpha = 1; }
  }
}
