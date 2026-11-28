// =============================================================================
// art/tiles_w1.js — Tileset do Mundo 1: FLORESTA DOS BRINQUEDOS PERDIDOS.
//
// Solo de feltro em camadas costuradas (escurece com a profundidade), grama de
// feltro com franja e tufos, blocos de madeira com letras (alt), tábuas de
// picolé amarradas com corda (oneway), sarças com alfinetes de costura
// (espinhos), interior escuro de árvore oca (bg), lagoa arroxeada (água).
// decorate(): grama, flores, brinquedos perdidos, raízes com contas, cogumelos
// luminosos (com luz), flores que OBSERVAM o jogador e grama da frente balançando.
// Tudo pré-renderizado: os decor animados só fazem drawImage + poucos fillRect.
// Também registra a fase-vitrine 'test_w1v' (?level=test_w1v).
// =============================================================================
import { registerTileset, registerLevel } from '../registry.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { T } from '../../engine/tilemap.js';

// ------------------------------------------------------------------ utilidades
const h2 = (x, y, s = 0) => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const th = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const _mx = new Map();
/** Mistura duas cores '#rrggbb' (t 0..1), com cache. */
function mix(a, b, t) {
  const k = a + b + t.toFixed(2);
  let v = _mx.get(k);
  if (v) return v;
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  v = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  _mx.set(k, v);
  return v;
}
/** rng local determinístico (decor pode ser pintado várias vezes, uma por chunk). */
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const solidLike = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;

// ------------------------------------------------------------------ paleta
const OUT = '#170d10';
const DARK = '#120a10';
const SOIL = [ // [profundidade][tom de feltro]
  ['#7e5234', '#6c4429', '#8c5e3a'],
  ['#5c3a25', '#4f311f', '#68432a'],
  ['#40281b', '#362117', '#492d1f'],
  ['#2a1a13', '#23150f', '#301d15'],
];
const SEAM = ['#5c3a22', '#462a1a', '#321e14', '#21140e'];
const THREAD = ['#d4b27a', '#a07e54', '#6e523a', '#3e2e22'];
const G = { hi: '#b6de64', lt: '#84be48', md: '#5e9e3c', dk: '#487f33', edge: '#2c5428', sh: '#1d100b' };
const GRASS_LAND = G;
const GW = { hi: '#5aa88a', lt: '#3e8a72', md: '#2e6e5e', dk: '#245a4e', edge: '#1a3e38', sh: '#140c0c' }; // musgo submerso
const FLOWER_COLS = ['#f27cb2', '#f2d462', '#a68cf2', '#72e2e0', '#f4ecd8', '#ff9a6a'];
const BTN_COLS = ['#c8506a', '#4aa6bc', '#d8aa42', '#8a6ccc', '#5cb06a'];

// glifos 5x5 das letras dos blocos
const GLYPHS = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'], B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'], D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'], O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'], S: ['.####', '#....', '.###.', '....#', '####.'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], Z: ['#####', '...#.', '..#..', '.#...', '#####'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'], '♥': ['.#.#.', '#####', '#####', '.###.', '..#..'],
};
const GLYPH_KEYS = Object.keys(GLYPHS);
const BLOCKS = [
  { b: '#b04a40', l: '#d27258', d: '#78302c', dd: '#3e1a1c' },
  { b: '#3e62a2', l: '#6088c8', d: '#283e74', dd: '#151f40' },
  { b: '#c99a3a', l: '#e6c464', d: '#8e6426', dd: '#4a3216' },
  { b: '#4a8e50', l: '#6eb468', d: '#2e6036', dd: '#18341f' },
  { b: '#a9804f', l: '#cba070', d: '#74522f', dd: '#3c2a19' },
];

// ------------------------------------------------------------------ solo (autotile)
function countSolid(map, tx, ty, dx, dy, max) {
  let k = 0;
  while (k < max) {
    const x = tx + dx * (k + 1), y = ty + dy * (k + 1);
    if (y >= map.rows || solidLike(map.get(x, y))) k++; else break;
  }
  return k;
}

function drawSoil(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const bottomRow = ty >= map.rows - 1;
  let n = bottomRow ? { ...n0, d: true, dl: true, dr: true } : n0;
  // bloco de brinquedo (alt) apoiado em cima: o solo continua gramado/iluminado
  // por baixo dele (antes ficava um "buraco" escuro sob cada pilha de blocos)
  if (ty > 0 && map.get(tx, ty - 1) === T.ALT) n = { ...n, u: false, ul: false, ur: false };
  const MAX = 3;
  const ku = n.u ? 1 + countSolid(map, tx, ty - 1, 0, -1, MAX - 1) : 0;
  const kd = n.d ? 1 + countSolid(map, tx, ty + 1, 0, 1, MAX - 1) : 0;
  const kl = n.l ? 1 + countSolid(map, tx - 1, ty, -1, 0, MAX - 1) : 0;
  const kr = n.r ? 1 + countSolid(map, tx + 1, ty, 1, 0, MAX - 1) : 0;
  const levAt = new Int8Array(256);
  const colOff = new Int8Array(16); // ondulação das camadas: só depende da coluna
  for (let lx = 0; lx < 16; lx++) { const wx = tx * 16 + lx; colOff[lx] = Math.round(2.2 * Math.sin(wx * 0.19) + 1.4 * Math.sin(wx * 0.071 + 2.1)); }
  const diag = (n.u && n.l && !n.ul) || (n.u && n.r && !n.ur) || (n.d && n.l && !n.dl) || (n.d && n.r && !n.dr);
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      let d = 99;
      if (ku < MAX) d = Math.min(d, ku * 16 + ly);
      if (kd < MAX) d = Math.min(d, kd * 16 + 15 - ly + 4); // luz de baixo conta menos
      if (kl < MAX) d = Math.min(d, kl * 16 + lx);
      if (kr < MAX) d = Math.min(d, kr * 16 + 15 - lx + 2);
      if (diag) {
        if (n.u && n.l && !n.ul) d = Math.min(d, Math.hypot(lx + 0.5, ly + 0.5));
        if (n.u && n.r && !n.ur) d = Math.min(d, Math.hypot(15.5 - lx, ly + 0.5));
        if (n.d && n.l && !n.dl) d = Math.min(d, Math.hypot(lx + 0.5, 15.5 - ly) + 4);
        if (n.d && n.r && !n.dr) d = Math.min(d, Math.hypot(15.5 - lx, 15.5 - ly) + 4);
      }
      const f = Math.max(0, Math.min(3, (d - 3) / 11));
      let lev = Math.floor(f);
      if (lev < 3 && f - lev > th(wx, wy)) lev++;
      levAt[ly * 16 + lx] = lev;
      // camadas de feltro onduladas (contínuas entre tiles)
      const v = wy + colOff[lx];
      const band = Math.floor(v / 7), r = v - band * 7;
      let c = SOIL[lev][(h2(band, 3) * 3) | 0];
      if (r === 0 && h2(wx >> 2, band, 12) > 0.22) c = SEAM[lev];
      else if (r === 1 && h2(wx >> 2, band, 12) > 0.85) c = SEAM[lev];
      else if (r === 3 && h2(band, 9) < 0.22 && ((wx + band * 3) & 3) < 2) c = THREAD[lev];
      else {
        const hh = h2(wx, wy, 11);
        if (hh < 0.045) c = SEAM[lev];
        else if (hh > 0.975 && lev > 0) c = SOIL[lev - 1][2];
      }
      pc.px(x + lx, y + ly, c);
    }
  }
  const lv = (lx, ly) => levAt[Math.max(0, Math.min(15, ly)) * 16 + Math.max(0, Math.min(15, lx))];

  // objetos enterrados (variações) — mais frequentes e menos apagados no solo
  // profundo, para as grandes massas de terra não virarem retângulos lisos
  const deep = ku >= MAX && kl >= 2 && kr >= 2;
  if (deep && rng() < 0.22) { // aglomerado de pedras / raiz grossa no fundo
    const cx = x + rng.int(2, 13), cy = y + rng.int(2, 13);
    if (rng() < 0.6) {
      pc.ellipse(cx, cy, 3.4, 2.2, '#2e2430'); pc.ellipse(cx, cy - 0.5, 2.6, 1.6, '#4a3e4c'); pc.px(cx - 1, cy - 1, '#6a5c6c');
      pc.ellipse(cx + 4, cy + 2, 2, 1.4, '#3a2e3a'); pc.px(cx + 3, cy + 1, '#5a4c5c');
    } else {
      pc.curve(cx - 7, cy - 3, cx, cy + 4, cx + 7, cy - 1, '#3a2418'); pc.curve(cx - 7, cy - 2, cx, cy + 5, cx + 7, cy, '#2a1810');
      pc.px(cx - 2, cy + 1, '#5a3a26');
    }
  }
  if (rng() < (deep ? 0.34 : 0.3)) {
    const cx = rng.int(3, 12), cy = rng.int(n.u ? 3 : 10, 12);
    const L = lv(cx, cy);
    const s = (c) => (L ? mix(c, '#140a0c', Math.min(deep ? 0.5 : 0.75, L * (deep ? 0.17 : 0.25))) : c);
    const kind = rng.int(0, 5);
    if (kind <= 1) { // botão de costura
      const col = BTN_COLS[rng.int(0, BTN_COLS.length - 1)];
      pc.circle(x + cx + 0.5, y + cy + 0.5, 3, s(mix(col, '#000000', 0.45)));
      pc.circle(x + cx + 0.5, y + cy + 0.5, 2.2, s(col));
      pc.px(x + cx - 1, y + cy, s('#1a0e10')); pc.px(x + cx + 1, y + cy, s('#1a0e10'));
      if (kind === 1) { pc.px(x + cx - 1, y + cy + 1, s('#1a0e10')); pc.px(x + cx + 1, y + cy + 1, s('#1a0e10')); }
      pc.px(x + cx - 1, y + cy - 2, s(mix(col, '#ffffff', 0.5)));
    } else if (kind === 2) { // pedrinhas
      pc.ellipse(x + cx, y + cy, 2.6, 1.8, s('#3a2e3e'));
      pc.ellipse(x + cx, y + cy - 0.4, 2, 1.3, s('#706278'));
      pc.px(x + cx - 1, y + cy - 1, s('#9a8ca0'));
      pc.ellipse(x + cx + 3, y + cy + 1, 1.6, 1.2, s('#5e5066'));
    } else if (kind === 3) { // bolinha de gude
      pc.circle(x + cx + 0.5, y + cy + 0.5, 2.6, s('#1c3a44'));
      pc.circle(x + cx + 0.5, y + cy + 0.5, 1.9, s('#3fb6c2'));
      pc.px(x + cx, y + cy + 1, s('#f07ab2'));
      pc.px(x + cx - 1, y + cy - 1, s('#e8fff8'));
    } else if (kind === 4) { // remendo costurado
      const pcol = rng() < 0.5 ? '#5a3a62' : '#3e5a3a';
      pc.rect(x + cx - 3, y + cy - 2, 7, 5, s(pcol));
      for (let i = 0; i < 7; i += 2) { pc.px(x + cx - 3 + i, y + cy - 2, s(THREAD[0])); pc.px(x + cx - 3 + i, y + cy + 2, s(THREAD[0])); }
      pc.px(x + cx - 3, y + cy, s(THREAD[0])); pc.px(x + cx + 3, y + cy, s(THREAD[0]));
    } else { // raizinha
      pc.curve(x + cx - 5, y + cy - 2, x + cx, y + cy + 3, x + cx + 5, y + cy, s('#8a5e3a'));
      pc.px(x + cx - 2, y + cy, s('#b08058'));
    }
  }

  // bordas laterais / inferior (contorno + luz da esquerda)
  if (!n.l) for (let ly = 0; ly < 16; ly++) { pc.px(x, y + ly, OUT); const L = lv(1, ly); pc.px(x + 1, y + ly, L > 0 ? SOIL[L - 1][2] : '#9a6a44'); }
  if (!n.r) for (let ly = 0; ly < 16; ly++) { pc.px(x + 15, y + ly, OUT); pc.px(x + 14, y + ly, SEAM[lv(14, ly)]); }
  if (!n.d) {
    for (let lx = 0; lx < 16; lx++) {
      pc.px(x + lx, y + 15, OUT); pc.px(x + lx, y + 14, SEAM[Math.min(3, lv(lx, 14) + 1)]);
      const hh = h2(tx * 16 + lx, ty, 5);
      if (hh < 0.14) { pc.px(x + lx, y + 16, OUT); if (hh < 0.05) pc.px(x + lx, y + 17, OUT); }
    }
    if (!n.l) { pc.erase(x, y + 15); pc.px(x + 1, y + 14, OUT); pc.px(x, y + 14, OUT); }
    if (!n.r) { pc.erase(x + 15, y + 15); pc.px(x + 14, y + 14, OUT); }
  }
  // cantos internos
  if (n.d && n.l && !n.dl) pc.px(x, y + 15, OUT);
  if (n.d && n.r && !n.dr) pc.px(x + 15, y + 15, OUT);
  if (n.u && n.l && !n.ul) {
    pc.px(x, y, OUT);
    for (let ly = 0; ly < 4; ly++) pc.px(x, y + ly, ly < 3 ? G.md : G.edge);
    pc.px(x + 1, y, G.lt); pc.px(x + 1, y + 1, G.dk); pc.px(x + 1, y + 2, G.edge); pc.px(x + 2, y, G.edge);
  }
  if (n.u && n.r && !n.ur) {
    for (let ly = 0; ly < 4; ly++) pc.px(x + 15, y + ly, ly < 3 ? G.dk : G.edge);
    pc.px(x + 14, y, G.md); pc.px(x + 14, y + 1, G.dk); pc.px(x + 14, y + 2, G.edge); pc.px(x + 13, y, G.edge);
  }

  // topo gramado (feltro verde com franja, tufos e saliência)
  if (!n.u) {
    const above = map.get(tx, ty - 1);
    const aboveFree = above === T.EMPTY;
    const G = above === T.WATER ? GW : GRASS_LAND;
    if (!n.l) { pc.erase(x, y); pc.erase(x + 1, y); pc.erase(x, y + 1); }
    if (!n.r) { pc.erase(x + 15, y); pc.erase(x + 14, y); pc.erase(x + 15, y + 1); }
    for (let lx = n.l ? 0 : -1; lx <= (n.r ? 15 : 16); lx++) {
      const wx = tx * 16 + lx;
      let thick = 4 + (h2(wx, 1) < 0.35 ? 1 : 0) + (Math.sin(wx * 0.8) > 0.55 ? 1 : 0);
      if (h2(wx, 2) < 0.16) thick += 2;
      let top = 0;
      if (lx === -1 || lx === 16) { top = 2; thick += 2; } else if ((!n.l && lx === 0) || (!n.r && lx === 15)) top = 1;
      for (let ly = top; ly < thick; ly++) {
        let c;
        if (ly === top) c = lx < 4 && !n.l ? G.lt : G.hi;
        else if (ly === top + 1) c = G.lt;
        else if (ly === thick - 1) c = G.edge;
        else c = ((wx + ly) & 1) && ly > top + 2 ? G.dk : G.md;
        if (lx === 16 || (!n.r && lx === 15 && ly > top)) c = ly === thick - 1 ? G.edge : G.dk;
        pc.px(x + lx, y + ly, c);
      }
      if (lx === -1 || lx === 16) pc.px(x + lx, y + thick, OUT);
      else pc.px(x + lx, y + thick, G.sh);
      // pequenas flores de feltro na grama
      if (lx >= 1 && lx <= 14 && h2(wx, ty, 8) < 0.035) pc.px(x + lx, y + 1, FLOWER_COLS[(h2(wx, ty, 9) * 6) | 0]);
      // tufos acima da superfície
      if (aboveFree && lx >= 0 && lx <= 15 && h2(wx, ty, 4) < 0.24) {
        const hgt = 1 + ((h2(wx, ty, 6) * 3) | 0);
        for (let k = 1; k <= hgt; k++) pc.px(x + lx, y - k, k === hgt ? G.hi : G.lt);
      }
    }
  }
}

// ------------------------------------------------------------------ blocos de letra (alt)
function drawBlock(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  const B = BLOCKS[(h2(tx, ty, 21) * BLOCKS.length) | 0];
  const depth = n.u ? 1 + countSolid(map, tx, ty - 1, 0, -1, 2) : 0;
  const s = (c) => (depth > 1 ? mix(c, '#140a14', (depth - 1) * 0.16) : c);
  pc.rect(x, y, 16, 16, s(B.dd));
  pc.rect(x + 1, y + 1, 14, 14, s(B.b));
  pc.hline(x + 1, y + 1, 14, s(B.l)); pc.vline(x + 1, y + 1, 14, s(B.l));
  pc.hline(x + 2, y + 14, 13, s(B.d)); pc.vline(x + 14, y + 2, 13, s(B.d));
  // painel rebaixado + letra em relevo
  pc.strokeRect(x + 3, y + 3, 10, 10, s(B.d));
  pc.hline(x + 4, y + 12, 9, s(B.l)); pc.vline(x + 12, y + 4, 8, s(B.l));
  const gl = GLYPHS[GLYPH_KEYS[(h2(tx, ty, 22) * GLYPH_KEYS.length) | 0]];
  const lc = s(mix(B.l, '#f4e8c8', 0.55));
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (gl[j][i] === '#') {
    pc.px(x + 6 + i, y + 6 + j, s(B.dd));
    pc.px(x + 5 + i, y + 5 + j, lc);
  }
  // desgaste: arranhões e lascas
  for (let k = 0; k < 3; k++) if (rng() < 0.6) pc.px(x + rng.int(2, 13), y + rng.int(2, 13), s(B.d));
  if (rng() < 0.5) { const sx = rng.int(3, 10); pc.line(x + sx, y + 2, x + sx + 3, y + 4, s(mix(B.b, B.l, 0.5))); }
  if (!n.u && !n.l) { pc.erase(x, y); pc.px(x + 1, y + 1, s(B.dd)); }
  if (!n.u && !n.r) { pc.erase(x + 15, y); pc.px(x + 14, y + 1, s(B.dd)); }
  if (!n.d && !n.l) pc.erase(x, y + 15);
  if (!n.d && !n.r) pc.erase(x + 15, y + 15);
  // musgo sobre blocos expostos
  if (!n.u && map.get(tx, ty - 1) !== T.WATER) {
    for (let lx = 1; lx < 15; lx++) {
      const wx = tx * 16 + lx;
      const m = h2(wx, ty, 23);
      if (m < 0.55) {
        const hh = 1 + (m < 0.2 ? 2 : m < 0.4 ? 1 : 0);
        for (let ly = 0; ly < hh; ly++) pc.px(x + lx, y + ly, ly === 0 ? G.lt : G.dk);
        if (m < 0.08) { pc.px(x + lx, y + hh, G.edge); pc.px(x + lx, y + hh + 1, G.edge); }
      }
    }
  }
}

// tiles vazados dentro de interiores (':') recebem o fundo da árvore oca por trás
const bgLike = (t) => t === T.BG || t === T.ONEWAY || t === T.SPIKE;
function interiorBehind(pc, x, y, rng, info) {
  const { map, tx, ty } = info;
  const g = (dx, dy) => map.get(tx + dx, ty + dy);
  if (g(-1, 0) !== T.BG && g(1, 0) !== T.BG && g(0, -1) !== T.BG && g(0, 1) !== T.BG) return;
  drawHollow(pc, x, y, null, rng, info);
}

// ------------------------------------------------------------------ tábuas vazadas (oneway)
function drawPlank(pc, x, y, n, rng, info) {
  const { tx, ty } = info;
  interiorBehind(pc, x, y, rng, info);
  const x0 = n.l ? 0 : 1, x1 = n.r ? 15 : 14;
  const C = { hi: '#dcae6c', b: '#aa763f', g: '#8a5a30', lo: '#6e4424', o: '#2a160e' };
  for (let lx = x0; lx <= x1; lx++) {
    const wx = tx * 16 + lx;
    pc.px(x + lx, y, C.hi);
    for (let ly = 1; ly <= 3; ly++) {
      const grain = h2(wx >> 2, ly + ty * 7, 31) < 0.35 && ((wx + ly) % 5) < 3;
      pc.px(x + lx, y + ly, grain ? C.g : C.b);
    }
    pc.px(x + lx, y + 4, C.lo);
    pc.px(x + lx, y + 5, C.o);
  }
  // pontas arredondadas com anéis da madeira
  if (!n.l) {
    pc.vline(x, y + 1, 4, C.o); pc.px(x + 1, y, C.o); pc.px(x + 1, y + 5, C.o);
    pc.px(x + 2, y + 2, C.hi); pc.px(x + 2, y + 3, C.g); pc.px(x + 1, y + 1, C.g);
  }
  if (!n.r) {
    pc.vline(x + 15, y + 1, 4, C.o); pc.px(x + 14, y, C.o); pc.px(x + 14, y + 5, C.o);
    pc.px(x + 13, y + 2, C.g); pc.px(x + 13, y + 3, C.lo);
  }
  // emendas entre tábuas + preguinhos
  if (n.l && (tx & 1) === 0) { pc.vline(x, y + 1, 4, C.o); pc.px(x + 2, y + 2, '#d8d8e0'); pc.px(x - 3, y + 2, '#d8d8e0'); }
  // amarração de corda
  const rope = n.r && h2(tx, ty, 32) < 0.4;
  if (rope || (!n.l && !n.r)) {
    const rx = rope ? 13 : 7;
    for (let ly = -1; ly <= 6; ly++) {
      pc.px(x + rx, y + ly, (ly & 1) ? '#b8955a' : '#e2c88e');
      pc.px(x + rx + 1, y + ly, (ly & 1) ? '#e2c88e' : '#8a6a3c');
      pc.px(x + rx + 2, y + ly, '#5a4228');
    }
    pc.px(x + rx, y - 2, OUT); pc.px(x + rx + 1, y - 2, OUT);
    const dl = 3 + ((h2(tx, ty, 33) * 4) | 0);
    for (let k = 0; k < dl; k++) pc.px(x + rx + 1 + (k > 2 ? 1 : 0), y + 7 + k, k & 1 ? '#b8955a' : '#d8bc84');
    pc.px(x + rx + 2, y + 7 + dl, '#8a6a3c'); pc.px(x + rx + 3, y + 7 + dl, '#8a6a3c');
  }
  // folhinha brotando
  if (h2(tx, ty, 34) < 0.25) { const lx = rng.int(3, 11); pc.px(x + lx, y + 6, G.md); pc.px(x + lx + 1, y + 7, G.dk); pc.px(x + lx, y + 7, G.lt); }
}

// ------------------------------------------------------------------ sarças com alfinetes (spike)
const PIN_HEADS = ['#e8434f', '#f2c440', '#42c6d4', '#e874c4', '#f4f0e4'];
function drawSpike(pc, x, y, dir, rng, info) {
  const P = (lx, ly, c) => {
    if (lx < 0 || lx > 15 || ly < 0 || ly > 15) return;
    if (dir === 'down') pc.px(x + lx, y + 15 - ly, c);
    else if (dir === 'right') pc.px(x + 15 - ly, y + lx, c);
    else if (dir === 'left') pc.px(x + ly, y + lx, c);
    else pc.px(x + lx, y + ly, c);
  };
  const { tx, ty } = info;
  interiorBehind(pc, x, y, rng, info);
  const base = (dir === 'left' || dir === 'right') ? ty * 16 : tx * 16;
  // alfinetes
  const xs = [2 + rng.int(0, 1), 7 + rng.int(0, 1), 12 + rng.int(0, 1)];
  xs.forEach((px, i) => {
    const tip = 1 + rng.int(0, 3) + (i === 1 ? 0 : 1);
    P(px, tip - 1, OUT);
    for (let ly = tip; ly < 12; ly++) {
      P(px - 1, ly, OUT); P(px + 1, ly, OUT);
      P(px, ly, ly === tip ? '#ffffff' : ly < tip + 3 ? '#e8ecf6' : '#a8aec4');
    }
    const hc = PIN_HEADS[(h2(base + px, i, 41) * PIN_HEADS.length) | 0];
    const hy = 11;
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) P(px + dx, hy + dy, hc);
    for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1]]) P(px + dx, hy + dy, OUT);
    P(px - 1, hy - 1, mix(hc, '#ffffff', 0.6));
    P(px + 1, hy + 1, mix(hc, '#000000', 0.4));
  });
  // sarça (caule espinhento torcido) na base
  for (let lx = 0; lx < 16; lx++) {
    const w = base + lx;
    const yy = 13 + Math.round(Math.sin(w * 0.55) * 1.1);
    P(lx, yy - 1, h2(w, 1, 42) < 0.5 ? '#9a5a7a' : '#6e3e58');
    P(lx, yy, '#542e44');
    P(lx, yy + 1, '#2e1826');
    for (let ly = yy + 2; ly < 16; ly++) P(lx, ly, '#1e1018');
    const yy2 = 14 + Math.round(Math.sin(w * 0.4 + 2) * 1.2);
    if (yy2 !== yy) P(lx, yy2, '#3a2232');
    if (h2(w, 2, 43) < 0.18) { P(lx, yy - 2, '#a86a7e'); P(lx, yy - 3, '#e0a8b8'); }
    if (h2(w, 3, 44) < 0.12) { P(lx, yy - 2, '#2e5a2e'); P(lx + 1, yy - 2, '#4a7e3a'); P(lx + 1, yy - 3, '#2e5a2e'); }
  }
}

// ------------------------------------------------------------------ interior da árvore oca (bg)
function drawHollow(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const b = (dx, dy) => bgLike(map.get(tx + dx, ty + dy));
  const n = { u: b(0, -1), d: b(0, 1), l: b(-1, 0), r: b(1, 0) };
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      const col = Math.floor(wx / 3 + Math.sin(wy * 0.07 + (wx >> 3)) * 0.8);
      const k = h2(col, 0, 51);
      let c = k < 0.3 ? '#2a1a1e' : k < 0.7 ? '#24161a' : '#301e20';
      if (h2(col, wy >> 3, 52) < 0.1) c = '#180e12';
      else if (h2(wx, wy, 53) < 0.03) c = '#3a2626';
      // sombras internas de profundidade
      let sh = 0;
      if (!n.u) sh = Math.max(sh, 1 - ly / 7);
      if (!n.l) sh = Math.max(sh, 0.8 - lx / 5);
      if (!n.r) sh = Math.max(sh, 0.8 - (15 - lx) / 5);
      if (!n.d) sh = Math.max(sh, 0.4 - (15 - ly) / 6);
      if (sh > th(wx, wy)) c = '#110a0d';
      pc.px(x + lx, y + ly, c);
    }
  }
  // nó da madeira
  if (rng() < 0.08 && n.u && n.d) {
    const cx = x + rng.int(5, 10), cy = y + rng.int(5, 10);
    pc.ellipse(cx, cy, 3, 4, '#3a2626'); pc.ellipse(cx, cy, 2, 3, '#140a0e'); pc.px(cx - 2, cy - 3, '#4a3230');
  }
  // rachadura vertical com musgo luminoso fraco
  if (rng() < 0.06 && n.u && n.d) {
    const cx = x + rng.int(3, 12);
    for (let k = 0; k < 16; k++) pc.px(cx + (k % 7 === 3 ? 1 : 0), y + k, '#0c0609');
    pc.px(cx + 1, y + rng.int(3, 12), '#2e6a66');
  }
  // teia no canto superior
  if (!n.u && !n.l) {
    for (let i = 0; i < 9; i++) { pc.px(x + i, y + Math.round(i * 0.35), '#8a809a80'); pc.px(x + Math.round(i * 0.35), y + i, '#8a809a80'); pc.px(x + i * 0.7, y + i * 0.7, '#8a809a60'); }
    for (const r of [4, 7]) for (let a = 0; a <= 6; a++) { const t = (a / 6) * Math.PI / 2; pc.px(x + Math.round(Math.cos(t) * r), y + Math.round(Math.sin(t) * r), '#8a809a50'); }
  } else if (!n.u && !n.r) {
    for (let i = 0; i < 8; i++) { pc.px(x + 15 - i, y + Math.round(i * 0.35), '#8a809a70'); pc.px(x + 15 - Math.round(i * 0.35), y + i, '#8a809a70'); pc.px(x + 15 - i * 0.7, y + i * 0.7, '#8a809a50'); }
  }
  // fungo-prateleira luminoso nas paredes
  if ((!n.l || !n.r) && rng() < 0.3) {
    const left = !n.l;
    const fy = y + rng.int(4, 11);
    const fx = left ? x : x + 11;
    pc.ellipse(fx + (left ? 1 : 4), fy, 4, 1.6, '#2a5a5e');
    pc.hline(fx + (left ? 0 : 1), fy - 1, 4, '#5fd8d0');
    pc.px(fx + (left ? 2 : 2), fy - 1, '#c8fff4');
  }
  runMid(pc, x, y, info);
}

/**
 * Camada "do meio" dentro de interiores (':'): decor que deve ficar ATRÁS do Tico
 * mas na FRENTE da parede de fundo (raízes, estacas, cogumelos...). O decor normal
 * 'back' é pintado antes dos tiles e ficaria escondido sob o fundo da árvore oca;
 * então decorate() registra esses pintores por célula em map._w1mid e eles são
 * repintados aqui, recortados à célula, logo depois do fundo.
 */
function runMid(pc, x, y, info) {
  const list = info.map._w1mid?.get(info.tx + info.ty * 65536);
  if (!list) return;
  const ox = x - info.tx * 16, oy = y - info.ty * 16;
  const X0 = x + pc.ox, Y0 = y + pc.oy;
  const base = Object.getPrototypeOf(pc).px;
  pc.px = function (px, py, c) {
    const ax = Math.floor(px + this.ox), ay = Math.floor(py + this.oy);
    if (ax < X0 || ay < Y0 || ax >= X0 + 16 || ay >= Y0 + 16) return this;
    return base.call(this, px, py, c);
  };
  pc.translate(ox, oy);
  try { for (const f of list) f(pc); } catch (e) { /* decor nunca derruba o bake */ }
  pc.translate(-ox, -oy);
  delete pc.px;
}

// ------------------------------------------------------------------ sprites de decoração (cache)
let SPR = null;
function mk(w, h, fn, outline = OUT) {
  const pc = new PixelCanvas(w, h);
  fn(pc);
  if (outline) pc.outline(outline);
  pc.flush();
  return pc;
}
function glowHalo(r, color) {
  return mk(r * 2 + 2, r * 2 + 2, (pc) => {
    const c = r + 1;
    pc.circle(c, c, r, color + '14'); pc.circle(c, c, r * 0.72, color + '1c'); pc.circle(c, c, r * 0.45, color + '28');
  }, null);
}
function mushroom(pc, cx, base, rx, hgt, P) {
  pc.rect(cx - 1, base - hgt, 3, hgt, '#e8e0d4'); pc.vline(cx + 1, base - hgt, hgt, '#b4a4b0'); pc.px(cx - 1, base - 1, '#c8bcc4');
  const cy = base - hgt;
  const ry = Math.max(2, Math.round(rx * 0.7));
  for (let yy = -ry; yy <= 0; yy++) {
    const span = Math.round(rx * Math.sqrt(1 - (yy / (ry + 0.5)) ** 2));
    for (let xx = -span; xx <= span; xx++) pc.px(cx + xx, cy + yy, yy === 0 ? P.dk : (xx < -span / 3 && yy < -ry / 2) ? P.hi : P.md);
  }
  pc.px(cx - Math.round(rx / 2), cy - ry + 1, '#ffffff');
  pc.px(cx + Math.round(rx / 3), cy - 1, P.hi);
  if (rx > 3) pc.px(cx + 1, cy - ry + 1, P.hi);
}
const MUSH_P = {
  cyan: { hi: '#c8fff6', md: '#5ff0e4', dk: '#2a9aa8', glow: '#5ff0e8' },
  pink: { hi: '#ffd0ec', md: '#ff78c4', dk: '#b03a8a', glow: '#ff7ac8' },
};

function buildSprites() {
  const S = {};
  // aglomerados de cogumelos luminosos
  S.mush = [];
  for (const key of ['cyan', 'pink']) {
    const P = MUSH_P[key];
    S.mush.push({ key, glow: P.glow, pc: mk(20, 16, (pc) => { mushroom(pc, 6, 16, 5, 6, P); mushroom(pc, 14, 16, 3, 4, P); }) });
    S.mush.push({ key, glow: P.glow, pc: mk(20, 16, (pc) => { mushroom(pc, 10, 16, 6, 8, P); mushroom(pc, 4, 16, 2, 3, P); mushroom(pc, 16, 16, 2, 3, P); }) });
  }
  S.halo = { cyan: glowHalo(16, '#5ff0e8'), pink: glowHalo(16, '#ff7ac8') };
  // flor observadora: caule + cabeça
  S.fstem = mk(13, 18, (pc) => {
    pc.curve(6, 0, 4, 9, 6, 18, '#2e6a34', 0); pc.curve(7, 0, 5, 9, 7, 18, '#4a8a3c', 0);
    pc.ellipse(3, 11, 3, 1.6, '#4a8a3c'); pc.px(2, 10, '#84be48');
    pc.ellipse(10, 14, 3, 1.6, '#3e7a36'); pc.px(10, 13, '#84be48');
  });
  S.fhead = mk(15, 15, (pc) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      pc.circle(7.5 + Math.cos(a) * 4.6, 7.5 + Math.sin(a) * 4.6, 2.6, i < 3 ? '#e48acb' : '#c25aa6');
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      pc.px(Math.round(7 + Math.cos(a) * 5.5), Math.round(7 + Math.sin(a) * 5.5), '#f6b8e2');
    }
    pc.circle(7.5, 7.5, 3.6, '#5a1e48');
    pc.ellipse(7.5, 7.5, 3, 2.6, '#f2ecdc');
    pc.hline(6, 5, 3, '#ffffff');
  });
  // grama da frente (3 quadros de balanço)
  S.fgrass = [-1, 0, 1].map((lean) => mk(14, 14, (pc) => {
    const blades = [[2, 9], [4, 13], [6, 10], [8, 12], [10, 8], [12, 11]];
    for (const [bx, hgt] of blades) for (let k = 0; k < hgt; k++) {
      const xx = bx + Math.round(lean * (k / hgt) * (k / hgt) * 3);
      pc.px(xx, 13 - k, k > hgt - 3 ? G.hi : k > hgt / 2 ? G.lt : G.md);
    }
  }, '#1a2a16'));
  // lâminas individuais da frente (5 variações × 3 quadros de balanço)
  S.blades = [];
  for (let v = 0; v < 5; v++) {
    const r = lrng(900 + v * 31);
    const bl = [];
    const nb = r.int(2, 4);
    for (let i = 0; i < nb; i++) bl.push([r.int(1, 14), r.int(3, 7), r() < 0.4]);
    S.blades.push([-1, 0, 1].map((lean) => mk(18, 9, (pc) => {
      for (const [bx, hgt, dark] of bl) for (let k = 0; k < hgt; k++) {
        const q = k / hgt, xx = 1 + bx + Math.round(lean * q * q * 2.4);
        pc.px(xx, 8 - k, k >= hgt - 1 ? (dark ? G.lt : G.hi) : q > 0.5 ? (dark ? G.md : G.lt) : (dark ? G.dk : G.md));
      }
    }, null)));
  }
  // brinquedos perdidos
  S.toys = [
    mk(12, 11, (pc) => { // bola listrada
      pc.circle(6, 6, 5, '#a8423e'); pc.ellipse(6, 6.5, 5, 1.3, '#e6d6ae'); pc.ellipse(7.5, 7.5, 3, 2.5, '#7e2a2c');
      pc.ellipse(7.5, 7.8, 3, 0.8, '#b8a888'); pc.px(4, 3, '#f09a86'); pc.px(3, 4, '#d86a5a');
    }),
    mk(10, 10, (pc) => { // bloquinho com letra
      pc.rect(1, 1, 8, 8, '#3e62a2'); pc.hline(1, 1, 8, '#6088c8'); pc.vline(1, 1, 8, '#6088c8'); pc.hline(2, 8, 7, '#283e74'); pc.vline(8, 2, 7, '#283e74');
      pc.ascii(['.#.', '###', '#.#'], { '#': '#e6dcc0' }, 4, 3);
    }),
    mk(17, 8, (pc) => { // soldadinho caído
      pc.rect(1, 2, 4, 4, '#241a2c'); pc.rect(0, 3, 1, 2, '#241a2c');
      pc.rect(5, 2, 3, 4, '#ecc8a0'); pc.px(6, 3, '#241a2c');
      pc.rect(8, 1, 5, 6, '#a63a3a'); pc.px(9, 3, '#f2c440'); pc.px(11, 3, '#f2c440'); pc.hline(8, 5, 5, '#6e2228');
      pc.rect(13, 2, 3, 2, '#2a3a6a'); pc.rect(13, 4, 3, 2, '#22305a');
    }),
    mk(14, 15, (pc) => { // ursinho sentado sem um olho
      pc.circle(3, 3, 2, '#7a5034'); pc.circle(10, 3, 2, '#7a5034');
      pc.ellipse(7, 10, 5, 4.5, '#946640'); pc.circle(6.5, 6, 4.5, '#a4744a');
      pc.ellipse(6.5, 7.5, 2, 1.5, '#d0a070'); pc.px(6, 7, '#241418');
      pc.px(5, 5, '#241418'); pc.line(8, 4, 9, 5, '#d8c8a0'); pc.line(9, 4, 8, 5, '#d8c8a0');
      pc.ellipse(7, 11, 2.5, 2, '#c49060'); pc.vline(7, 10, 3, '#5a3a24');
      pc.ellipse(3, 13.5, 2, 1.4, '#7a5034'); pc.ellipse(11, 13.5, 2, 1.4, '#7a5034');
      pc.px(4, 6, '#c08a5a');
    }),
    mk(16, 10, (pc) => { // carrinho sem uma roda
      pc.rect(1, 4, 13, 4, '#3e7ab0'); pc.rect(4, 1, 7, 3, '#5a9ad0'); pc.rect(5, 2, 2, 2, '#a8e0f0'); pc.rect(8, 2, 2, 2, '#a8e0f0');
      pc.hline(1, 4, 13, '#6aaee0'); pc.hline(1, 7, 13, '#2a5480'); pc.px(13, 5, '#f2d462');
      pc.circle(4, 8.5, 1.8, '#1e1820'); pc.px(4, 8, '#8a8494');
    }),
    mk(12, 12, (pc) => { // chave de dar corda
      pc.ring(3.5, 3.5, 2.6, '#d4aa44'); pc.ring(8.5, 3.5, 2.6, '#d4aa44'); pc.rect(5, 3, 2, 2, '#d4aa44');
      pc.rect(5, 5, 2, 7, '#b88a2e'); pc.vline(5, 5, 7, '#ecd078'); pc.px(2, 2, '#fff0b0');
    }),
  ];
  return S;
}

// ------------------------------------------------------------------ pintores de decor estático
function paintFlower(pc, x, yb, seed) {
  const r = lrng(seed);
  const hgt = r.int(4, 9), col = FLOWER_COLS[r.int(0, FLOWER_COLS.length - 1)];
  pc.vline(x, yb - hgt, hgt, '#3e7a34');
  pc.px(x + 1, yb - Math.round(hgt / 2), G.lt); pc.px(x - 1, yb - 2, G.md);
  const hy = yb - hgt - 1;
  pc.px(x, hy - 1, col); pc.px(x - 1, hy, col); pc.px(x + 1, hy, col); pc.px(x, hy + 1, mix(col, '#000000', 0.3));
  pc.px(x, hy, r() < 0.5 ? '#f2d462' : '#3a1e2e');
  pc.px(x - 1, hy - 1, OUT); pc.px(x + 1, hy - 1, OUT);
}
function paintSmallMush(pc, x, yb, seed) {
  const r = lrng(seed);
  const cap = r() < 0.5 ? ['#c04a3a', '#e07a5a', '#7a2a24'] : ['#a07a4a', '#c8a070', '#6a4a2a'];
  const hgt = r.int(2, 4);
  pc.vline(x, yb - hgt, hgt, '#e0d4c0');
  pc.hline(x - 2, yb - hgt - 1, 5, cap[0]); pc.hline(x - 1, yb - hgt - 2, 3, cap[1]); pc.px(x, yb - hgt - 3, OUT);
  pc.px(x - 3, yb - hgt - 1, OUT); pc.px(x + 3, yb - hgt - 1, OUT); pc.px(x - 2, yb - hgt - 2, OUT); pc.px(x + 2, yb - hgt - 2, OUT);
  pc.hline(x - 1, yb - hgt, 3, cap[2]); pc.px(x + 1, yb - hgt - 1, '#f4ecd8');
}
function paintRoots(pc, x, yt, seed) {
  const r = lrng(seed);
  const nRoots = r.int(1, 3);
  for (let j = 0; j < nRoots; j++) {
    const rx = x + r.int(0, 12), len = r.int(6, 22), ph = r() * 6, drift = r.int(-3, 3);
    let lastX = rx;
    for (let k = 0; k < len; k++) {
      const xx = rx + Math.round(Math.sin(k * 0.35 + ph) * 1.4 + (drift * k) / len);
      pc.px(xx, yt + k, k % 4 === 0 ? '#7a5236' : '#5a3a26');
      if (k < len * 0.45) pc.px(xx + 1, yt + k, '#3a2418');
      if (k > 3 && r() < 0.08) { pc.px(xx - 1, yt + k, G.dk); pc.px(xx - 2, yt + k - 1, G.md); }
      lastX = xx;
    }
    const end = r();
    if (end < 0.35) { // conta de madeira de brinquedo
      const bc = BTN_COLS[r.int(0, BTN_COLS.length - 1)];
      pc.rect(lastX - 1, yt + len, 3, 3, bc); pc.px(lastX - 1, yt + len, mix(bc, '#ffffff', 0.5)); pc.px(lastX + 1, yt + len + 2, mix(bc, '#000000', 0.4));
      pc.px(lastX, yt + len + 3, '#5a3a26');
    } else if (end < 0.55) { pc.px(lastX + 1, yt + len, '#5a3a26'); pc.px(lastX + 2, yt + len - 1, '#5a3a26'); }
  }
}

/** Gramado denso: fileira escura alta atrás + fileira clara curta na frente + extras. */
const LEAF_COLS = ['#d8823a', '#c45a2a', '#e0b040', '#a84a3a', '#b8a040'];
function paintMeadow(pc, x, yb, seed, short) {
  const r = lrng(seed);
  const maxH = short ? 4 : 9;
  for (let i = 0; i < 16; i++) {
    if (r() < 0.42) continue;
    const hgt = Math.min(maxH, r() < 0.22 ? r.int(6, 9) : r.int(3, 6)), lean = r.int(-1, 1);
    for (let k = 0; k < hgt; k++) { const q = k / hgt; pc.px(x + i + Math.round(lean * q * q * 2), yb - 1 - k, k >= hgt - 1 ? G.md : q > 0.5 ? G.dk : G.edge); }
  }
  for (let i = 0; i < 16; i++) {
    if (r() < 0.38) continue;
    const hgt = Math.min(maxH, r.int(2, 5)), lean = r.int(-1, 1), yel = r() < 0.12;
    for (let k = 0; k < hgt; k++) { const q = k / hgt; pc.px(x + i + Math.round(lean * q * q * 2), yb - 1 - k, k >= hgt - 1 ? (yel ? '#dce474' : G.hi) : q > 0.4 ? (yel ? '#aac452' : G.lt) : G.md); }
  }
  const ex = x + r.int(2, 13), e = r();
  if (e < 0.16) { // trevo
    const L = '#4aa84e', H = '#8ad872', D = '#24602e';
    pc.vline(ex, yb - 2, 2, D);
    pc.rect(ex - 2, yb - 4, 2, 2, L); pc.rect(ex + 1, yb - 4, 2, 2, L); pc.rect(ex - 1, yb - 6, 2, 2, L);
    pc.px(ex - 2, yb - 4, H); pc.px(ex + 1, yb - 4, H); pc.px(ex - 1, yb - 6, H); pc.px(ex, yb - 4, D);
  } else if (e < 0.32) paintFlower(pc, ex, yb, seed ^ 0x77);
  else if (e < 0.42) { // pedrinha
    pc.ellipse(ex, yb - 1, 2.2, 1.4, '#7a7484'); pc.px(ex - 1, yb - 2, '#bab4c2'); pc.hline(ex - 2, yb - 1, 1, '#4a4452'); pc.px(ex + 2, yb - 1, '#4a4452');
  } else if (e < 0.54) { // folha caída
    const c = LEAF_COLS[r.int(0, LEAF_COLS.length - 1)], d = mix(c, '#000000', 0.35);
    pc.hline(ex - 1, yb - 1, 4, c); pc.px(ex, yb - 2, c); pc.px(ex + 1, yb - 2, mix(c, '#ffffff', 0.3)); pc.px(ex + 3, yb - 2, d); pc.px(ex + 1, yb - 1, d);
  } else if (e < 0.6 && !short) paintSmallMush(pc, ex, yb + 1, seed ^ 0x33);
  if (r() < 0.3) { const fx = x + r.int(1, 14), c = FLOWER_COLS[r.int(0, FLOWER_COLS.length - 1)]; pc.px(fx, yb - 3, c); pc.px(fx, yb - 2, G.dk); }
}
/** Grama pendurada nas bordas com saliência (dir -1 = lado esquerdo, +1 = direito). */
function paintHang(pc, x, yt, seed, dir) {
  const r = lrng(seed);
  const n = r.int(2, 4);
  for (let i = 0; i < n; i++) {
    const hx = x + dir * r.int(0, 1), len = r.int(3, 10), y0 = yt + r.int(4, 6);
    for (let k = 0; k < len; k++) pc.px(hx + (k > len * 0.6 ? dir : 0), y0 + k, k >= len - 1 ? G.lt : k < 2 ? G.edge : (k & 1 ? G.md : G.dk));
    if (r() < 0.25) pc.px(hx + dir, y0 + len, FLOWER_COLS[r.int(0, FLOWER_COLS.length - 1)]);
  }
}

// ------------------------------------------------------------------ decor animado
function bladesAnim(items, y) {
  return (ctx, t) => {
    for (const [x, v] of items) {
      const s = Math.sin(t * 1.9 - x * 0.03) + 0.5 * Math.sin(t * 0.7 + x * 0.011);
      ctx.drawImage(SPR.blades[v][s < -0.55 ? 0 : s > 0.55 ? 2 : 1].canvas, x, y);
    }
  };
}
function mushAnim(spr, halo, x, y, ph) {
  return (ctx, t) => {
    const p = 0.5 + 0.5 * Math.sin(t * 1.6 + ph);
    ctx.globalAlpha = 0.55 + 0.45 * p;
    ctx.drawImage(halo.canvas, x + 10 - 17, y + 9 - 17);
    ctx.globalAlpha = 1;
    ctx.drawImage(spr.pc.canvas, x, y);
    // esporos subindo
    ctx.fillStyle = spr.glow;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.35 + ph + i * 0.33) % 1;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillRect(Math.round(x + 4 + i * 6 + Math.sin(t * 2 + i + ph) * 2), Math.round(y + 6 - k * 22), 1, 1);
    }
    ctx.globalAlpha = 1;
  };
}
function flowerAnim(x, y, ph) {
  return (ctx, t, level) => {
    const sway = Math.round(Math.sin(t * 1.1 + ph) * 1.2);
    ctx.drawImage(SPR.fstem.canvas, x + 1, y + 12);
    const hx = x + sway, hy = y;
    ctx.drawImage(SPR.fhead.canvas, hx, hy);
    const ex = hx + 7.5, ey = hy + 7.5;
    const blink = ((t + ph * 3) % 4.7) < 0.13;
    if (blink) {
      ctx.fillStyle = '#c25aa6'; ctx.fillRect(hx + 5, hy + 5, 6, 5);
      ctx.fillStyle = '#5a1e48'; ctx.fillRect(hx + 5, hy + 7, 6, 1);
      return;
    }
    const p = level?.player;
    let ox = 0, oy = 0, near = false;
    if (p) {
      const dx = p.x + p.w / 2 - ex, dy = p.y + p.h / 2 - ey;
      const d = Math.hypot(dx, dy) || 1;
      ox = Math.round((dx / d) * 1.6); oy = Math.round((dy / d) * 1.2);
      near = d < 34;
    }
    ctx.fillStyle = '#2a8a84';
    if (!near) ctx.fillRect(Math.round(ex - 1.5 + ox), Math.round(ey - 1.5 + oy), 3, 3);
    ctx.fillStyle = '#120a18';
    ctx.fillRect(Math.round(ex - (near ? 0.5 : 1) + ox), Math.round(ey - (near ? 0.5 : 1) + oy), near ? 1 : 2, near ? 1 : 2);
  };
}
function grassAnim(x, y, ph) {
  return (ctx, t) => {
    const s = Math.sin(t * 1.8 + ph) + Math.sin(t * 0.7 + ph * 2) * 0.5;
    const f = s < -0.5 ? 0 : s > 0.5 ? 2 : 1;
    ctx.drawImage(SPR.fgrass[f].canvas, x, y);
  };
}

// ------------------------------------------------------------------ decor extra (vida!)
const WOOD = { hi: '#c89058', b: '#8a5a30', lo: '#5e3a1e', o: OUT, rope: '#d4b27a', ropeD: '#8a6a44' };
/** Estaca de madeira de (px, y0) até y1 (coordenadas de mundo). */
function paintPost(pc, px, y0, y1) {
  const len = y1 - y0;
  if (len <= 0) return;
  pc.rect(px - 2, y0, 1, len, WOOD.o); pc.rect(px + 2, y0, 1, len, WOOD.o);
  pc.rect(px - 1, y0, 3, len, WOOD.b); pc.vline(px - 1, y0, len, WOOD.hi); pc.vline(px + 1, y0, len, WOOD.lo);
  for (let yy = y0 + 7; yy < y1 - 2; yy += 9) pc.px(px, yy, WOOD.lo);       // veios
  pc.hline(px - 2, y0 + 1, 5, WOOD.rope); pc.hline(px - 2, y0 + 2, 5, WOOD.ropeD); // amarração
  pc.hline(px - 3, y1 - 1, 7, WOOD.o); pc.hline(px - 2, y1 - 2, 5, WOOD.lo);       // pé
}
/** Mão-francesa sob a ponta de uma tábua presa na parede. dir: +1 parede à esquerda. */
function paintBracket(pc, wallX, y, dir) {
  for (let k = 0; k < 9; k++) {
    const xx = wallX + dir * k, yy = y + 12 - k;
    pc.px(xx, yy, WOOD.b); pc.px(xx, yy + 1, WOOD.lo); pc.px(xx, yy + 2, WOOD.o);
  }
  pc.vline(wallX + (dir > 0 ? 0 : -1), y + 2, 12, WOOD.lo);
  pc.px(wallX + dir, y + 11, '#e8e0d0'); // prego
}
/** Corda/cipó subindo da tábua até sumir na copa (quando não há chão embaixo). */
function paintRopeUp(pc, px, y0, y1, seed) {
  const r = lrng(seed);
  for (let yy = y1; yy > y0; yy--) {
    const xx = px + Math.round(Math.sin(yy * 0.05 + seed) * 0.6);
    pc.px(xx, yy, ((yy >> 1) & 1) ? WOOD.rope : WOOD.ropeD);
    if (r() < 0.05) { pc.px(xx + 1, yy, G.md); pc.px(xx + 2, yy - 1, G.lt); }
  }
}
/** Arbusto de feltro com frutinhas/flores. */
function paintBush(pc, cx, yb, wdt, hgt, seed, tod) {
  const r = lrng(seed);
  const P = tod === 'night' ? ['#0e2420', '#163a2e', '#245040', '#3a6a52'] : tod === 'dusk' ? ['#1e2e2a', '#2e4a36', '#466a44', '#6a8a5a'] : ['#24502c', '#36723a', '#4e9444', '#7cbc5a'];
  const blobs = [];
  const n = 3 + Math.round(wdt / 10);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const rr = hgt * (0.45 + r() * 0.25) * (1 - Math.abs(t - 0.5) * 0.7);
    blobs.push([cx - wdt / 2 + t * wdt, yb - rr * 0.9 - r() * 2, rr]);
  }
  for (const [x, y, rr] of blobs) pc.circle(x, y + 1, rr + 1, OUT);
  for (const [x, y, rr] of blobs) pc.circle(x, y + 1, rr, P[0]);
  for (const [x, y, rr] of blobs) pc.circle(x - rr * 0.15, y - rr * 0.1, rr * 0.8, P[1]);
  for (const [x, y, rr] of blobs) pc.circle(x - rr * 0.35, y - rr * 0.35, rr * 0.42, P[2]);
  for (const [x, y, rr] of blobs) pc.px(Math.round(x - rr * 0.45), Math.round(y - rr * 0.55), P[3]);
  pc.rect(cx - wdt / 2 - 1, yb, wdt + 2, 2, P[0]); // base no chão
  const kind = r();
  const cols = kind < 0.4 ? ['#e04a5a', '#ff8a8a'] : kind < 0.7 ? FLOWER_COLS : null;
  if (cols) for (let i = 0; i < 3 + (wdt >> 3); i++) {
    const [x, y, rr] = blobs[r.int(0, blobs.length - 1)];
    const fx = Math.round(x + (r() - 0.5) * rr * 1.2), fy = Math.round(y + (r() - 0.6) * rr);
    const c = cols[r.int(0, cols.length - 1)];
    pc.px(fx, fy, c); if (kind >= 0.4) { pc.px(fx + 1, fy, c); pc.px(fx, fy + 1, mix(c, '#000000', 0.3)); }
    else pc.px(fx - 1, fy - 1, '#ffd0d0');
  }
  // botão de costura esquecido no meio do arbusto
  if (r() < 0.25) { const [x, y] = blobs[0]; pc.circle(x + 2, y + 2, 1.6, BTN_COLS[r.int(0, 4)]); pc.px(Math.round(x + 2), Math.round(y + 2), OUT); }
}
/** Samambaia de feltro (folhas em leque). */
function paintFern(pc, x, yb, seed, tod) {
  const r = lrng(seed);
  const C = tod === 'night' ? ['#16302a', '#24483a'] : tod === 'dusk' ? ['#2e4a36', '#4a6a44'] : ['#3e7a34', '#6aa848'];
  const n = r.int(3, 5);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2, len = r.int(8, 14);
    const ex = x + Math.cos(a) * len, ey = yb + Math.sin(a) * len;
    pc.curve(x, yb, (x + ex) / 2, ey - 2, ex, ey + 2, C[0]);
    for (let k = 2; k < len; k += 2) {
      const t = k / len, px = x + (ex - x) * t, py = yb + (ey - yb) * t - Math.sin(t * Math.PI) * 2;
      pc.px(Math.round(px - 1), Math.round(py - 1), C[1]); pc.px(Math.round(px + 1), Math.round(py), C[0]);
    }
  }
}
/** Canteiro de flores (3–5 flores de alturas diferentes). */
function paintFlowerPatch(pc, x, yb, seed) {
  const r = lrng(seed);
  const n = r.int(3, 5);
  for (let i = 0; i < n; i++) paintFlower(pc, x + i * 3 + r.int(-1, 1), yb, seed + i * 977);
}

/** Árvore grande da fase (dados `decor` da fase): tronco de feltro, copa de pompom e
 *  galhos que seguram as tábuas próximas. Pintada no fundo (atrás dos tiles). */
function treePainter(d, runs, tod) {
  const bx = Math.round(d.x * 16 + 8), by = d.base * 16 + 4, top = d.top * 16 + 8;
  const w = d.w || 14, half = w >> 1;
  const dead = !!d.dead;
  const bark = tod === 'night' ? ['#1e1620', '#2c2230', '#3a2e3e', '#120c14'] : tod === 'dusk' ? ['#3a2a30', '#4e3a3e', '#6a5050', '#22161c'] : ['#5a3e2a', '#74523a', '#946c4a', '#3a2618'];
  const leaf = dead ? null : tod === 'night' ? ['#0c1a1c', '#12282a', '#1a3a38', '#2a524a'] : tod === 'dusk' ? ['#2a2440', '#3a3254', '#55456a', '#8a6a80'] : ['#1f4a2a', '#2e6a36', '#46903f', '#78bc58'];
  const r = lrng((bx * 31 + top) >>> 0);
  const blobs = [];
  if (leaf && d.canopy !== false) {
    const R = d.r || 34;
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, dd = r() * R * 0.6; blobs.push([bx + Math.cos(a) * dd * 1.3, top - 6 + Math.sin(a) * dd * 0.7, R * (0.38 + r() * 0.3)]); }
    blobs.push([bx, top - 10, R * 0.55]);
  }
  // galhos até as tábuas vizinhas
  const branches = [];
  for (const run of runs) {
    const ry = run.ty * 16;
    if (ry < top - 24 || ry > by - 8) continue;
    const near = run.x1 * 16 + 16 < bx ? run.x1 * 16 + 14 : run.x0 * 16 > bx ? run.x0 * 16 + 2 : null;
    if (near === null) { run.tree = true; continue; } // tábua cruzando o tronco
    if (Math.abs(near - bx) > 5 * 16) continue;
    run.tree = true;
    branches.push([near, ry + 7]);
  }
  const x0 = bx - 70, y0 = Math.min(top - 60, by - 10);
  return {
    x: x0, y: y0, w: 140, h: by - y0 + 8, layer: 'back',
    paint(pc) {
      if (leaf && blobs.length) for (const [x, y, rr] of blobs) pc.circle(x + 2, y + 3, rr + 1, leaf[0]);
      for (const [ex, ey] of branches) {
        const sx = ex < bx ? bx - half + 2 : bx + half - 2, sy = ey + 10;
        pc.thickLine(sx, sy, ex, ey, 2.2, bark[3]);
        pc.thickLine(sx, sy - 1, ex, ey - 1, 1.6, bark[1]);
        pc.line(sx, sy - 2, ex, ey - 2, bark[2]);
        if (!dead) { pc.circle(ex + (ex < bx ? -2 : 2), ey - 3, 3, leaf ? leaf[2] : bark[2]); pc.px(ex, ey - 5, leaf ? leaf[3] : bark[2]); }
      }
      // tronco (afina para cima) com raízes no pé
      for (let y = top; y < by; y++) {
        const t = (y - top) / Math.max(1, by - top);
        const ww = Math.round(w * (0.75 + 0.25 * t) + (t > 0.9 ? (t - 0.9) * 90 : 0));
        const xl = bx - (ww >> 1);
        pc.hline(xl - 1, y, ww + 2, bark[3]);
        pc.hline(xl, y, ww, bark[1]);
        pc.hline(xl, y, 2, bark[2]); pc.hline(xl + ww - 3, y, 3, bark[0]);
        if ((y >> 2) % 3 === 0) pc.px(xl + (ww >> 1) + ((y >> 4) & 1 ? 1 : -1), y, bark[0]);
        if ((y & 3) < 2) pc.px(xl + (ww >> 1), y, bark[2] === bark[1] ? bark[0] : THREAD[2]); // costura central
      }
      // oco/nó e remendo costurado
      const hy = Math.round(top + (by - top) * 0.55);
      pc.ellipse(bx + 1, hy, 3, 4, bark[3]); pc.ellipse(bx + 1, hy + 1, 2, 2.6, '#0c0608');
      if (by - top > 80) {
        const py = Math.round(top + (by - top) * 0.3);
        pc.rect(bx - half + 2, py, 6, 7, dead ? '#5a4a5a' : '#6a3a52');
        for (let i = 0; i < 6; i += 2) { pc.px(bx - half + 2 + i, py, THREAD[0]); pc.px(bx - half + 2 + i, py + 6, THREAD[0]); }
      }
      if (dead) { // galhos secos no topo
        pc.thickLine(bx, top + 4, bx - 22, top - 14, 1.5, bark[3]); pc.line(bx, top + 3, bx - 22, top - 15, bark[1]);
        pc.thickLine(bx, top + 10, bx + 20, top - 6, 1.5, bark[3]); pc.line(bx, top + 9, bx + 20, top - 7, bark[1]);
        pc.line(bx - 14, top - 8, bx - 18, top - 20, bark[1]); pc.line(bx + 12, top, bx + 16, top - 12, bark[1]);
      }
      if (leaf && blobs.length) {
        for (const [x, y, rr] of blobs) pc.circle(x, y, rr, leaf[1]);
        for (const [x, y, rr] of blobs) pc.circle(x - rr * 0.25, y - rr * 0.3, rr * 0.6, leaf[2]);
        for (const [x, y, rr] of blobs) { pc.px(Math.round(x - rr * 0.4), Math.round(y - rr * 0.5), leaf[3]); pc.px(Math.round(x - rr * 0.2), Math.round(y - rr * 0.6), leaf[3]); }
        for (let i = 0; i < 6; i++) { const [x, y, rr] = blobs[i % blobs.length]; pc.px(Math.round(x + rr * 0.3), Math.round(y + rr * 0.2), FLOWER_COLS[i % FLOWER_COLS.length]); }
      }
    },
  };
}

// ------------------------------------------------------------------ bichinhos (decor animado, sem colisão)
const BUTTERFLY_COLS = [['#f2a0d0', '#c25aa6'], ['#f2d462', '#c08a2a'], ['#8ad0f2', '#3a7ab0'], ['#f4ecd8', '#a89a8a']];
function butterflyAnim(cx, cy, ph, col) {
  return (ctx, t) => {
    const tt = t * 0.5 + ph;
    const x = Math.round(cx + Math.sin(tt * 1.3) * 22 + Math.sin(tt * 3.1) * 5);
    const y = Math.round(cy + Math.sin(tt * 1.7 + 1) * 9 + Math.sin(tt * 5.3) * 2);
    const open = Math.sin(t * 16 + ph * 7) > 0;
    ctx.fillStyle = col[1];
    if (open) { ctx.fillRect(x - 2, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2); ctx.fillStyle = col[0]; ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); }
    else { ctx.fillRect(x - 1, y - 2, 1, 2); ctx.fillRect(x + 1, y - 2, 1, 2); }
    ctx.fillStyle = '#1a1018'; ctx.fillRect(x, y - 1, 1, 2);
  };
}
function firefliesAnim(cx, cy, ph, n, cols) {
  const pts = [];
  const r = lrng(Math.floor(ph * 1000));
  for (let i = 0; i < n; i++) pts.push([r() * 6.28, 0.4 + r() * 0.8, 10 + r() * 22, 4 + r() * 10, r() * 6.28]);
  return (ctx, t) => {
    for (let i = 0; i < pts.length; i++) {
      const [a, sp, rx, ry, bph] = pts[i];
      const b = Math.sin(t * 2.2 * sp + bph);
      if (b < 0.1) continue;
      const x = Math.round(cx + Math.sin(t * 0.4 * sp + a) * rx), y = Math.round(cy + Math.cos(t * 0.33 * sp + a * 1.7) * ry);
      ctx.globalAlpha = b * 0.35; ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.globalAlpha = Math.min(1, b + 0.2); ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ decorate
function decorate(map, rng, data) {
  if (!SPR) SPR = buildSprites();
  const out = [];
  const rows = data?.map || [];
  const tod = data?.timeOfDay || 'day';
  const chAt = (tx, ty) => (rows[ty] && rows[ty][tx]) || '.';
  const isAir = (tx, ty) => { const t = map.get(tx, ty); return (t === T.EMPTY || t === T.BG) && chAt(tx, ty) === '.'; };
  const surf = (tx, ty) => map.get(tx, ty) === T.SOLID && isAir(tx, ty - 1);
  // ---- camada do meio (interiores): ver runMid()
  const mid = new Map();
  map._w1mid = mid;
  const interiorCell = (t) => t === T.BG || t === T.ONEWAY || t === T.SPIKE;
  /** Decor de fundo que também aparece dentro de interiores (sobre a parede ':'). */
  const addMid = (d) => {
    out.push({ ...d, layer: 'back' });
    for (let cy = Math.floor(d.y / 16); cy <= Math.floor((d.y + d.h) / 16); cy++)
      for (let cx = Math.floor(d.x / 16); cx <= Math.floor((d.x + d.w) / 16); cx++) {
        if (!interiorCell(map.get(cx, cy))) continue;
        const k = cx + cy * 65536;
        let l = mid.get(k); if (!l) mid.set(k, (l = []));
        l.push(d.paint);
      }
  };
  // ---- tábuas (oneway): estacas até o chão, mão-francesa na parede ou galho de árvore
  const runs = [];
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (map.get(tx, ty) !== T.ONEWAY) continue;
      let x1 = tx; while (map.get(x1 + 1, ty) === T.ONEWAY) x1++;
      runs.push({ x0: tx, x1, ty });
      tx = x1;
    }
  }
  const trees = (data?.decor || []).filter((d) => d.t === 'tree');
  const treeDecor = trees.map((d) => treePainter(d, runs, tod));
  const solidL = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;
  for (const run of runs) {
    const { x0, x1, ty } = run;
    const y = ty * 16;
    const attL = solidL(map.get(x0 - 1, ty)), attR = solidL(map.get(x1 + 1, ty));
    if (attL) addMid({ x: x0 * 16, y, w: 12, h: 16, paint: (pc) => paintBracket(pc, x0 * 16, y, 1) });
    if (attR) addMid({ x: x1 * 16 + 4, y, w: 12, h: 16, paint: (pc) => paintBracket(pc, x1 * 16 + 16, y, -1) });
    if (attL || attR || run.tree) continue;
    const n = x1 - x0 + 1;
    const cols = n === 1 ? [x0 * 16 + 8] : [x0 * 16 + 4, x1 * 16 + 11];
    if (n >= 7) cols.push(Math.round((x0 + x1) / 2) * 16 + 8);
    const found = [];
    for (const px of cols) {
      const tx = Math.floor(px / 16);
      let gy = -1, kind = 0;
      for (let yy = ty + 1; yy < Math.min(map.rows, ty + 16); yy++) {
        const t = map.get(tx, yy);
        if (t === T.EMPTY || t === T.BG) continue;
        if (t === T.WATER) continue; // estaca entra na água até o fundo
        gy = yy; kind = t; break;
      }
      if (gy > 0) {
        const yEnd = gy * 16 + (kind === T.SPIKE ? 10 : kind === T.ONEWAY ? 2 : 3);
        found.push([px, yEnd]);
        addMid({ x: px - 4, y: y + 3, w: 9, h: yEnd - y, paint: (pc) => paintPost(pc, px, y + 3, yEnd) });
      } else {
        const yTop = Math.max(0, y - 16 * 14);
        addMid({ x: px - 2, y: yTop, w: 5, h: y - yTop + 2, paint: (pc) => paintRopeUp(pc, px, yTop, y + 1, px) });
      }
    }
    if (found.length >= 2) { // travessa em X entre as duas primeiras estacas
      const [[ax, ay], [bx2, by2]] = found;
      const yb = Math.min(ay, by2) - 4;
      if (yb - (y + 8) > 14) addMid({ x: ax, y: y + 6, w: bx2 - ax, h: yb - y, paint: (pc) => { pc.line(ax + 1, y + 8, bx2 - 1, yb, WOOD.lo); pc.line(ax + 1, yb, bx2 - 1, y + 8, WOOD.lo); } });
    }
  }

  let lastAnim = -99, lastToy = -99, lastFront = -99, lastBush = -99, lastBug = -99;
  let run = null; // trecho de lâminas da frente (um decor animado por até 10 tiles)
  const flush = () => {
    if (run && run.items.length) { const q = run; out.push({ x: q.x0 - 4, y: q.y - 2, w: q.x1 - q.x0 + 26, h: 12, layer: 'front', anim: bladesAnim(q.items, q.y) }); }
    run = null;
  };
  const bugCols = tod === 'night' ? ['#d8ff9a', '#9af0ff'] : ['#e8ff7a', '#fff6a8', '#c8ff5a'];
  for (let ty = 1; ty < map.rows; ty++) {
    lastAnim = -99; lastToy = -99; lastFront = -99; lastBush = -99;
    flush();
    for (let tx = 0; tx < map.cols; tx++) {
      const t = map.get(tx, ty);
      const wx = tx * 16, wy = ty * 16;
      const seed = (tx * 92821 + ty * 68917) >>> 0;
      if (surf(tx, ty)) {
        const inside = map.get(tx, ty - 1) === T.BG;
        const room2 = isAir(tx, ty - 2);
        const r = rng();
        const wide = surf(tx - 1, ty) && surf(tx + 1, ty);
        if (r < 0.075 && tx - lastAnim > 4) { // cogumelos luminosos
          lastAnim = tx;
          const spr = SPR.mush[rng.int(0, SPR.mush.length - 1)];
          const x = wx - 2 + rng.int(0, 2), y = wy - 15;
          const light = { r: 34, color: spr.glow, i: 0.55, flicker: 0.12 };
          if (inside) { // dentro da árvore: estático na camada do meio + só a luz animada
            addMid({ x, y, w: 20, h: 16, paint: (pc) => pc.blit(spr.pc, x, y) });
            out.push({ x, y, w: 20, h: 16, layer: 'back', anim: () => {}, light });
          } else out.push({ x, y, w: 20, h: 16, layer: 'back', anim: mushAnim(spr, SPR.halo[spr.key], x, y, rng() * 6), light });
        } else if (r < 0.11 && room2 && !inside && tx - lastAnim > 4 && wide) { // flor que observa
          lastAnim = tx;
          const x = wx + rng.int(0, 2), y = wy - 29;
          out.push({ x, y, w: 15, h: 30, layer: 'back', anim: flowerAnim(x, y, rng() * 6) });
        } else if (r < 0.17 && wide && tx - lastToy > 7) { // brinquedo perdido
          lastToy = tx;
          const k = rng.int(0, SPR.toys.length - 1), spr = SPR.toys[k];
          const flip = rng() < 0.5, sink = k === 0 ? 3 : k === 5 ? 3 : 1;
          const x = wx + rng.int(-2, 16 - spr.w + 2), y = wy - spr.h + sink;
          addMid({ x, y, w: spr.w, h: spr.h, paint: (pc) => pc.blit(spr, x, y, { flipX: flip }) });
        } else if (r < 0.2 && !inside && tx - lastFront > 6 && tx - lastAnim > 2) { // grama da frente (só na altura do pé)
          lastFront = tx;
          const x = wx + rng.int(0, 3), y = wy - 12;
          out.push({ x, y, w: 14, h: 14, layer: 'front', anim: grassAnim(x, y, rng() * 6) });
        } else if (r < 0.3) {
          addMid({ x: wx, y: wy - 10, w: 16, h: 12, paint: (pc) => paintSmallMush(pc, wx + 4 + (seed % 8), wy + 1, seed) });
        }
        // arbustos, samambaias e canteiros (fundo) — só com espaço livre acima
        if (!inside && room2 && wide && isAir(tx, ty - 3)) {
          const q = rng();
          if (q < 0.16 && tx - lastBush > 5) {
            lastBush = tx;
            const bw = rng.int(18, 34), bh = rng.int(11, 18), cx = wx + 8 + rng.int(-4, 4);
            out.push({ x: cx - bw / 2 - 12, y: wy - bh * 2 - 4, w: bw + 24, h: bh * 2 + 8, layer: 'back', paint: (pc) => paintBush(pc, cx, wy + 2, bw, bh, seed ^ 0xb5, tod) });
          } else if (q < 0.26) out.push({ x: wx - 12, y: wy - 18, w: 40, h: 20, layer: 'back', paint: (pc) => paintFern(pc, wx + 8, wy + 1, seed ^ 0xfe, tod) });
          else if (q < 0.36 && tod !== 'night') out.push({ x: wx - 2, y: wy - 14, w: 22, h: 16, layer: 'back', paint: (pc) => paintFlowerPatch(pc, wx + 2, wy + 1, seed ^ 0xf1) });
        }
        // bichinhos: borboletas de dia, vaga-lumes no entardecer/noite e nas tocas
        if (room2 && isAir(tx, ty - 3) && tx - lastBug > 14 && rng() < 0.09) {
          lastBug = tx;
          const cx = wx + 8, cy = wy - rng.int(22, 40);
          if (inside || tod !== 'day') out.push({ x: cx - 40, y: cy - 20, w: 80, h: 40, layer: 'back', anim: firefliesAnim(cx, cy, rng() * 6, rng.int(4, 7), bugCols) });
          else out.push({ x: cx - 34, y: cy - 16, w: 68, h: 32, layer: 'back', anim: butterflyAnim(cx, cy, rng() * 6, BUTTERFLY_COLS[rng.int(0, BUTTERFLY_COLS.length - 1)]) });
        }
        // gramado denso em todo topo gramado + grama pendurada nas bordas
        out.push({ x: wx - 2, y: wy - 12, w: 20, h: 13, layer: inside ? 'front' : 'back', paint: (pc) => paintMeadow(pc, wx, wy, seed ^ 0x55, inside) });
        if (!inside && map.get(tx - 1, ty) === T.EMPTY) out.push({ x: wx - 4, y: wy, w: 6, h: 18, layer: 'back', paint: (pc) => paintHang(pc, wx - 1, wy, seed ^ 0x1234, -1) });
        if (!inside && map.get(tx + 1, ty) === T.EMPTY) out.push({ x: wx + 14, y: wy, w: 6, h: 18, layer: 'back', paint: (pc) => paintHang(pc, wx + 16, wy, seed ^ 0x4321, 1) });
        // lâminas soltas na frente, balançando ao vento (na altura do pé)
        if (!inside) {
          if (!run || tx - run.tx0 >= 10 || run.ty !== ty) { flush(); run = { items: [], y: wy - 8, x0: wx, x1: wx, tx0: tx, ty }; }
          if (rng() < 0.6) run.items.push([wx - 1 + rng.int(-2, 2), rng.int(0, SPR.blades.length - 1)]);
          run.x1 = wx;
        } else flush();
      } else if (run && run.ty === ty) flush();
      // raízes penduradas sob tetos (sempre ATRÁS do Tico)
      if ((t === T.SOLID) && isAir(tx, ty + 1) && ty + 1 < map.rows && rng() < 0.4) {
        addMid({ x: wx, y: wy + 16, w: 18, h: 28, paint: (pc) => paintRoots(pc, wx + 1, wy + 15, seed ^ 0x99) });
      }
    }
  }
  flush();
  // ---- árvores de fundo em duas profundidades (a de trás mais clara/enevoada)
  {
    const open = (tx, ty) => map.get(tx, ty) === T.EMPTY;   // nada de árvore dentro de cavernas
    const headroom = (tx, ty, n) => { for (let k = 1; k <= n; k++) if (!open(tx, ty - k)) return false; return true; };
    const PALS = {
      day: [['#1f3f30', '#2a5440', '#36684c', '#4a7e5a'], ['#24402e', '#2f5a38', '#3c6e44', '#548a52']],
      dusk: [['#2a2440', '#3a3254', '#4a3e62', '#7a5a7a'], ['#2e2a3e', '#40384e', '#52465c', '#8a6070']],
      night: [['#0e1626', '#152034', '#1c2a42', '#2a3c58'], ['#101a24', '#182632', '#203240', '#30465a']],
    };
    const HAZE = { day: '#9cc4c8', dusk: '#7a5a86', night: '#1c2440' };
    const PAL = PALS[tod] || PALS.day;
    var bg = [];
    const groundAt = (tx) => { for (let ty = 2; ty < map.rows; ty++) if (map.get(tx, ty) === T.SOLID && open(tx, ty - 1) && headroom(tx, ty, 4)) return ty; return -1; };
    for (const far of [true, false]) {
      let tx = rng.int(1, 5);
      while (tx < map.cols - 2) {
        const gy = groundAt(tx);
        if (gy > 0) {
          const bx = tx * 16 + 8 + rng.int(-4, 4), by = gy * 16 + 2;
          const h = far ? rng.int(70, 110) : rng.int(44, 78), r = far ? rng.int(18, 26) : rng.int(15, 22), tone = rng() < 0.5 ? 0 : 1;
          const base = PAL[tone];
          const C = far ? base.map((c) => mix(c, HAZE[tod] || HAZE.day, 0.45)) : base;
          const trunkBase = tod === 'night' ? ['#141018', '#1e1822'] : tod === 'dusk' ? ['#2a2028', '#3a2c34'] : tone ? ['#3a2c26', '#4a3a30'] : ['#3e2e22', '#52402e'];
          const trunk = far ? trunkBase.map((c) => mix(c, HAZE[tod] || HAZE.day, 0.4)) : trunkBase;
          const tw = far ? 5 : 7;
          const blobs = [];
          for (let i = 0; i < 4; i++) blobs.push([bx + rng.int(-r, r) * 0.7, by - h + rng.int(-6, 8), r * rng.range(0.6, 0.95)]);
          blobs.push([bx, by - h - 4, r]);
          bg.push({ x: bx - r * 2, y: by - h - r * 2, w: r * 4, h: h + r * 2, layer: 'back', paint(pc) {
            pc.rect(bx - (tw >> 1), by - h + 4, tw, h - 4, trunk[0]); pc.rect(bx - (tw >> 1), by - h + 4, 2, h - 4, trunk[1]);
            pc.line(bx, by - h * 0.55, bx + 9, by - h * 0.72, trunk[0]); pc.line(bx, by - h * 0.45, bx - 8, by - h * 0.6, trunk[0]);
            for (const [x, y, rr] of blobs) pc.circle(x + 1, y + 2, rr, C[0]);
            for (const [x, y, rr] of blobs) pc.circle(x, y, rr - 1, C[1]);
            for (const [x, y, rr] of blobs) pc.circle(x - rr * 0.25, y - rr * 0.25, rr * 0.6, C[2]);
            for (const [x, y, rr] of blobs) { pc.px(Math.round(x - rr * 0.4), Math.round(y - rr * 0.5), C[3]); pc.px(Math.round(x - rr * 0.2), Math.round(y - rr * 0.6), C[3]); }
          } });
        }
        tx += far ? rng.int(5, 11) : rng.int(4, 9);
      }
    }
  }
  // o bake pinta na ordem do array: árvores de fundo (longe → perto) primeiro,
  // depois as árvores grandes da fase, e só então arbustos/estacas/grama
  return [...bg, ...treeDecor, ...out];
}

// ------------------------------------------------------------------ registro
registerTileset('w1', {
  skyColor: '#24164a',
  solid: drawSoil,
  alt: drawBlock,
  oneway: drawPlank,
  spike: drawSpike,
  bg: drawHollow,
  water: { body: '#3a4a8a', top: '#9ae8e0', deep: '#1e2452', highlight: '#e4fff8', alpha: 0.74 },
  decorate,
});

// ------------------------------------------------------------------ fase-vitrine (?level=test_w1v)
function showcaseMap() {
  const W = 90, H = 40;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const R = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < W) g[j][i] = c; };
  R(0, 32, W, 8, '#');                                   // chão
  R(0, 6, 4, 26, '#'); R(4, 6, 3, 1, '#');               // escalada alta
  R(4, 27, 4, 1, '='); R(4, 23, 3, 2, '#'); R(5, 19, 5, 1, '='); R(4, 15, 4, 2, '%'); R(4, 11, 5, 1, '=');
  R(12, 29, 7, 3, '#'); R(14, 28, 3, 1, '#');            // morrinho
  R(15, 21, 7, 2, '#'); R(16, 23, 4, 1, '^');            // ilha com espinhos para baixo
  R(22, 32, 10, 1, '.'); R(22, 33, 10, 3, '~');          // lagoa
  R(26, 27, 3, 1, '=');
  R(35, 31, 4, 1, '^');                                  // espinhos para cima
  R(38, 27, 6, 1, '=');
  R(46, 20, 2, 12, '#'); R(45, 24, 1, 3, '^'); R(48, 24, 1, 3, '^'); // pilar com espinhos ← →
  R(50, 22, 8, 3, '#'); R(52, 25, 4, 1, '^');            // ilha flutuante
  R(60, 31, 4, 1, '%'); R(61, 30, 3, 1, '%'); R(62, 29, 2, 1, '%'); R(63, 28, 1, 1, '%'); // escada de blocos
  R(64, 24, 5, 1, '=');
  R(70, 14, 18, 18, '#'); R(72, 17, 14, 15, ':'); R(70, 29, 2, 3, 'H'); // árvore oca + parede falsa
  R(74, 27, 5, 1, '='); R(80, 23, 5, 1, '='); R(82, 20, 3, 1, '%'); R(75, 20, 3, 1, '=');
  g[31][9] = 'P'; g[13][84] = 'E'; g[31][42] = 'K';
  g[31][20] = 'o'; g[21][53] = 'o'; g[30][78] = 'o';
  g[5][2] = '*'; g[19][76] = '*'; g[27][17] = '*';
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w1v', world: 0, index: 0, name: 'Vitrine da Floresta', subtitle: 'Teste de arte',
  tileset: 'w1', background: 'w1', music: null, parTime: 120, darkness: 0,
  map: showcaseMap(),
});
