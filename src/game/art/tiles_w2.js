// =============================================================================
// art/tiles_w2.js — Tileset do Mundo 2: OCEANO DAS LÁGRIMAS.
//
// solid  : leito de areia (conchas, pedrinhas, tufos de capim-marinho) sobre
//          alvenaria de ruína submersa — fiadas de blocos contínuas entre tiles,
//          escurecendo com a profundidade, glifos entalhados, rachaduras, vermes
//          luminosos nas juntas, objetos enterrados, cracas e algas nas bordas,
//          cantos internos (autotile por n.{u,d,l,r,ul,ur,dl,dr}).
// alt    : casco de navio de brinquedo afundado (tábuas pintadas descascando,
//          pregos, amurada, vigias de latão com vidro brilhante, cracas).
// oneway : prateleiras de coral (rosa/laranja/violeta) ou tábuas de convés com
//          corda (escolha estável por trecho).
// spike  : ouriços-do-mar e coral pontiagudo (desenhados "para cima" num
//          buffer, contornados e girados para as 4 direções).
// bg     : parede de ruína escura com glifos tênues e sombras de contato.
// drawWater: água translúcida — faixa de superfície animada (onda + espuma),
//          escurecimento por profundidade, cáusticas (quadros Voronoi
//          pré-renderizados deslocados com t), brilhos, bolhas e plâncton;
//          bolsões flutuantes ganham membrana nas laterais/fundo e gotas.
// decorate(): conchas, estrelas-do-mar, brinquedos afundados, cordas, mastros
//          quebrados, âncoras, tesouros, corais (estáticos) + algas balançando
//          de várias alturas, anêmonas luminosas (com luz), fontes de bolhas,
//          cardumes que disparam, caranguejos andando, mariscos que abrem,
//          glifos que pulsam e capim-marinho na frente.
// Tudo pré-renderizado: os decor animados fazem só drawImage + poucos fillRect.
// Também registra a fase-vitrine 'test_w2v' (?level=test_w2v).
// =============================================================================
import { registerTileset, registerLevel } from '../registry.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { T } from '../../engine/tilemap.js';

// ------------------------------------------------------------------ utilidades
const TAU = Math.PI * 2;
const h2 = (x, y, s = 0) => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const th = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
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
/** rng local determinístico. */
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const solidLike = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;

// ------------------------------------------------------------------ paletas
const OUT = '#081322';
const DEEP = '#060e1a';
const ST = [ // pedra da ruína [nível de profundidade][tom]
  ['#6fa2ac', '#6396a4', '#7cacb0'],
  ['#4a7a8e', '#426f86', '#538392'],
  ['#2e5670', '#2a4e68', '#335c74'],
  ['#1b344e', '#182f48', '#1f3a54'],
];
const ST_HI = ['#a8d0cc', '#78a8b0', '#4a7890', '#2a4862'];
const ST_SH = ['#456e80', '#30566c', '#20405a', '#132840'];
const MORT = ['#2a4a5e', '#1f3c52', '#152e44', '#0d2036'];
const MOSS = ['#4f9a7c', '#3c8470', '#67b088'];
const GLOW = ['#7ff8ec', '#5ae8e4', '#3ab8c4', '#2a8a9c'];
const SAND = { hi: '#fdf0c8', lt: '#efd8a0', md: '#dabc80', rip: '#c8a86c', dk: '#b89660', edge: '#8c7250', sh: '#3a4250', sed: '#6e6656' };
const GRAINS = ['#f6a8b4', '#ffffff', '#8c9aa6', '#e88a6a', '#a8d8e0'];
const SEAGR = { hi: '#9ee8a0', lt: '#62c27e', md: '#3e9a66', dk: '#2a7458' };
const WOOD = { hi: '#e4b884', lt: '#c08e5a', md: '#9c6c40', dk: '#76502e', gap: '#3a2418' };
const PAINTS = [
  { lt: '#ee7a66', md: '#d0544c', dk: '#a03c3c' },
  { lt: '#fbf2da', md: '#e4d8b8', dk: '#bcae8e' },
  { lt: '#6aaee0', md: '#4886c0', dk: '#30649a' },
  { lt: '#f8d462', md: '#dcb040', dk: '#a8822e' },
];
const CORAL = {
  pink: { hi: '#ffd6e0', lt: '#ff9ab4', md: '#f0708e', dk: '#c04a72', sh: '#7e2a52', tip: '#fff0f4' },
  orange: { hi: '#ffe4b8', lt: '#ffb070', md: '#f0844a', dk: '#c05a34', sh: '#7a3424', tip: '#fff4e0' },
  violet: { hi: '#eed6ff', lt: '#c89af0', md: '#a070d8', dk: '#7048a8', sh: '#44286a', tip: '#ffffff' },
  gold: { hi: '#fff0b0', lt: '#f8d060', md: '#e0a83a', dk: '#a8742a', sh: '#6a4420', tip: '#fffbe0' },
};
const URCHIN = [
  { body: '#3a1a52', mid: '#6a3a8e', hi: '#b088d8', spine: '#2a1040', tip: '#ecd0ff' },
  { body: '#16284e', mid: '#2e4e8e', hi: '#7aa8e0', spine: '#0e1a3a', tip: '#c0ecff' },
  { body: '#4e1a2a', mid: '#8e3a4a', hi: '#e08098', spine: '#3a0e1a', tip: '#ffd6de' },
];
const BGW = { base: ['#132a3c', '#11273a', '#163042'], mort: '#08141f', hi: '#1c3a52', sh: '#0c1c2b', glyph: '#1f5868', glyph2: '#2e8c98', algae: '#14403a', algae2: '#1a5046' };

// glifos 5×5 (lágrima, olho, espiral, peixe, tridente, concha, ondas, estrela)
const GLYPHS = [
  ['..#..', '.###.', '#####', '#####', '.###.'],
  ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  ['#####', '#...#', '#.#.#', '#.###', '#....'],
  ['.#..#', '###.#', '#####', '###.#', '.#..#'],
  ['#.#.#', '#.#.#', '#####', '..#..', '..#..'],
  ['..#..', '.#.#.', '#.#.#', '#.#.#', '#####'],
  ['.#...', '#.#.#', '...#.', '.#...', '#.#.#'],
  ['..#..', '.###.', '#####', '.#.#.', '#...#'],
];

// ------------------------------------------------------------------ profundidade (autotile)
function countSolid(map, tx, ty, dx, dy, max) {
  let k = 0;
  while (k < max) {
    const x = tx + dx * (k + 1), y = ty + dy * (k + 1);
    if (y >= map.rows || solidLike(map.get(x, y))) k++; else break;
  }
  return k;
}
const _lev = new Int8Array(256);
/** Nível 0 (borda exposta) .. 3 (fundo da massa) por pixel, com dithering. */
function depthMap(n, info) {
  const { tx, ty, map } = info;
  const MAX = 3;
  const ku = n.u ? 1 + countSolid(map, tx, ty - 1, 0, -1, MAX - 1) : 0;
  const kd = n.d ? 1 + countSolid(map, tx, ty + 1, 0, 1, MAX - 1) : 0;
  const kl = n.l ? 1 + countSolid(map, tx - 1, ty, -1, 0, MAX - 1) : 0;
  const kr = n.r ? 1 + countSolid(map, tx + 1, ty, 1, 0, MAX - 1) : 0;
  const cUL = n.u && n.l && !n.ul, cUR = n.u && n.r && !n.ur, cDL = n.d && n.l && !n.dl, cDR = n.d && n.r && !n.dr;
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      let d = 99;
      if (ku < MAX) d = Math.min(d, ku * 16 + ly);
      if (kd < MAX) d = Math.min(d, kd * 16 + 15 - ly + 4);
      if (kl < MAX) d = Math.min(d, kl * 16 + lx);
      if (kr < MAX) d = Math.min(d, kr * 16 + 15 - lx + 2);
      if (cUL) d = Math.min(d, Math.hypot(lx + 0.5, ly + 0.5));
      if (cUR) d = Math.min(d, Math.hypot(15.5 - lx, ly + 0.5));
      if (cDL) d = Math.min(d, Math.hypot(lx + 0.5, 15.5 - ly) + 4);
      if (cDR) d = Math.min(d, Math.hypot(15.5 - lx, 15.5 - ly) + 4);
      const f = clamp((d - 3) / 10, 0, 3);
      let lev = Math.floor(f);
      if (lev < 3 && f - lev > th(tx * 16 + lx, ty * 16 + ly)) lev++;
      _lev[ly * 16 + lx] = lev;
    }
  }
  return _lev;
}

function barnacle(pc, x, y) {
  pc.px(x, y - 1, '#e6dcc8'); pc.px(x - 1, y, '#d0c4ae'); pc.px(x + 1, y, '#a89c88'); pc.px(x, y + 1, '#8a806e');
  pc.px(x, y, '#24303c'); pc.px(x - 1, y - 1, '#fff6e4');
}
/** Algas penduradas na borda inferior exposta (desenham no tile de baixo). */
function hangAlgae(pc, x, y, tx, ty, s) {
  for (let lx = 1; lx < 15; lx++) {
    const hh = h2(tx * 16 + lx, ty, s);
    if (hh < 0.24) {
      const len = 1 + (((hh * 97) | 0) % 4);
      for (let k = 0; k < len; k++) pc.px(x + lx, y + 16 + k, k === len - 1 ? '#2a6a5a' : '#3f8c6e');
    } else if (hh > 0.94) pc.px(x + lx, y + 16, OUT);
  }
}

// ------------------------------------------------------------------ sólido: areia + ruína
const sandTop = (wx) => clamp(4 + Math.round(1.3 * Math.sin(wx * 0.23) + 0.9 * Math.sin(wx * 0.071 + 1.7)), 3, 6);

function drawSeabed(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const n = ty >= map.rows - 1 ? { ...n0, d: true, dl: true, dr: true } : n0;
  const lev = depthMap(n, info);
  const sandy = !n.u;
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      const L = lev[ly * 16 + lx];
      // alvenaria em fiadas de 8 px, deslocadas por fiada (contínua entre tiles)
      const row = wy >> 3, ry = wy & 7;
      const bxw = wx + ((h2(row, 17) * 16) | 0);
      const bx = bxw >> 4, rx = bxw & 15;
      const bh = h2(bx, row, 3);
      let c;
      if (ry === 0 || rx === 0) {
        c = MORT[L];
        if (L > 0 && h2(wx, wy, 19) < 0.02) c = GLOW[L]; // verme luminoso na junta
      } else {
        c = ST[L][(bh * 3) | 0];
        if (ry === 1 || rx === 1) c = ST_HI[L];
        else if (ry === 7 || rx === 15) c = ST_SH[L];
        if (bh < 0.08 && L < 3) { // glifo entalhado (sombra em cima, luz embaixo-direita)
          const g = GLYPHS[(h2(bx, row, 8) * GLYPHS.length) | 0];
          const gx = rx - 5, gy = ry - 2;
          if (gx >= 0 && gx < 5 && gy >= 0 && gy < 5 && g[gy][gx] === '#') c = MORT[L];
          else if (gx >= 1 && gx < 6 && gy >= 1 && gy < 6 && g[gy - 1][gx - 1] === '#') c = ST_HI[L];
        } else if (bh > 0.9) { // rachadura
          const cx0 = 4 + ((h2(bx, row, 9) * 7) | 0);
          if (ry > 1 && ry < 7 && rx === cx0 + ((ry - 2) >> 1) * (bh > 0.95 ? 1 : -1)) c = MORT[Math.min(3, L + 1)];
        }
        const hh = h2(wx, wy, 11);
        if (hh < 0.05) c = ST_SH[L]; else if (hh > 0.972) c = ST_HI[L];
        if (L === 0 && h2(wx >> 1, wy >> 1, 21) < 0.16) c = MOSS[(h2(wx, wy, 22) * 3) | 0];
      }
      // sedimento de areia assentado logo abaixo do topo
      if (sandy) {
        const st = sandTop(wx);
        if (ly >= st && ly < st + 5) {
          const k = ly - st;
          if ((ry === 0 || rx === 0) && k < 4) c = k < 2 ? SAND.dk : SAND.edge;
          else if (h2(wx, wy, 23) < 0.55 - k * 0.13) c = k === 0 ? SAND.edge : SAND.sed;
        }
      }
      pc.px(x + lx, y + ly, c);
    }
  }
  const lv = (lx, ly) => lev[clamp(ly, 0, 15) * 16 + clamp(lx, 0, 15)];

  // objetos enterrados (variações)
  if (rng() < 0.26) {
    const cx = rng.int(3, 12), cy = rng.int(sandy ? 10 : 4, 12);
    const L = lv(cx, cy);
    const kind = rng.int(0, 6);
    if (L >= 1) {
      const s = (c) => mix(c, DEEP, Math.min(0.7, (L - 1) * 0.3));
      const X = x + cx, Y = y + cy;
      if (kind === 0) { // amonite fóssil
        pc.circle(X + 0.5, Y + 0.5, 3.2, s('#3a4a56')); pc.circle(X + 0.5, Y + 0.5, 2.5, s('#c8b89a'));
        pc.ring(X + 0.5, Y + 0.5, 1.4, s('#7a6a58')); pc.px(X, Y, s('#5a4a3a')); pc.px(X - 1, Y - 2, s('#efe4c8'));
      } else if (kind === 1) { // pérola numa concha
        pc.ellipse(X + 0.5, Y + 1, 3.5, 2, s('#6a5a8a')); pc.ellipse(X + 0.5, Y + 0.6, 2.6, 1.3, s('#b8a0d0'));
        pc.rect(X - 1, Y - 1, 2, 2, s('#f4f0ff')); pc.px(X - 1, Y - 1, '#ffffff'); pc.px(X, Y, s('#c0b8d8'));
      } else if (kind === 2) { // moeda de ouro
        pc.circle(X + 0.5, Y + 0.5, 2.6, s('#7a5a1a')); pc.circle(X + 0.5, Y + 0.5, 1.9, s('#e8c040'));
        pc.px(X, Y, s('#a8801e')); pc.px(X - 1, Y - 1, s('#fff4b0'));
      } else if (kind === 3) { // timão de brinquedo
        pc.ring(X + 0.5, Y + 0.5, 3, s('#8a5a32'));
        for (let a = 0; a < 4; a++) { const an = a * Math.PI / 4; pc.line(X - Math.round(Math.cos(an) * 4), Y - Math.round(Math.sin(an) * 4), X + Math.round(Math.cos(an) * 4), Y + Math.round(Math.sin(an) * 4), s('#6a4224')); }
        pc.px(X, Y, s('#d8a050'));
      } else if (kind === 4) { // espinha de peixe
        pc.hline(X - 3, Y, 6, s('#d8d0b8'));
        for (let i = -2; i <= 1; i += 1) { pc.px(X + i, Y - 1, s('#b8b098')); pc.px(X + i, Y + 1, s('#b8b098')); }
        pc.px(X + 3, Y - 1, s('#d8d0b8')); pc.px(X + 3, Y + 1, s('#d8d0b8')); pc.px(X + 4, Y, s('#d8d0b8')); pc.px(X - 4, Y - 1, s('#b8b098')); pc.px(X - 4, Y + 1, s('#b8b098'));
      } else if (kind === 5) { // vidro marinho
        pc.rect(X - 1, Y, 3, 2, s('#3ab89a')); pc.px(X - 1, Y, s('#b8fff0')); pc.px(X + 1, Y + 1, s('#1e7a68'));
      } else { // bloquinho de brinquedo
        const col = rng() < 0.5 ? '#c8504a' : '#4a7ec8';
        pc.rect(X - 2, Y - 2, 5, 5, s(col)); pc.hline(X - 2, Y - 2, 5, s(mix(col, '#ffffff', 0.4))); pc.px(X, Y, s('#f4ecd8')); pc.px(X - 1, Y + 1, s('#f4ecd8')); pc.px(X + 1, Y + 1, s('#f4ecd8'));
      }
    }
  }

  // bordas laterais / inferior (contorno + luz da esquerda)
  if (!n.l) for (let ly = 0; ly < 16; ly++) { pc.px(x, y + ly, OUT); pc.px(x + 1, y + ly, ST_HI[Math.max(0, lv(1, ly) - 1)]); }
  if (!n.r) for (let ly = 0; ly < 16; ly++) { pc.px(x + 15, y + ly, OUT); pc.px(x + 14, y + ly, ST_SH[lv(14, ly)]); }
  if (!n.d) {
    for (let lx = 0; lx < 16; lx++) { pc.px(x + lx, y + 15, OUT); pc.px(x + lx, y + 14, MORT[Math.min(3, lv(lx, 14) + 1)]); }
    hangAlgae(pc, x, y, tx, ty, 41);
    if (!n.l) { pc.erase(x, y + 15); pc.px(x + 1, y + 14, OUT); pc.px(x, y + 14, OUT); }
    if (!n.r) { pc.erase(x + 15, y + 15); pc.px(x + 14, y + 14, OUT); }
  }
  // cracas nas bordas expostas
  if (!n.l && rng() < 0.5) barnacle(pc, x + 2, y + rng.int(sandy ? 9 : 3, 12));
  if (!n.r && rng() < 0.5) barnacle(pc, x + 13, y + rng.int(sandy ? 9 : 3, 12));
  if (!n.d && rng() < 0.3) barnacle(pc, x + rng.int(3, 12), y + 12);
  // cantos internos
  if (n.d && n.l && !n.dl) pc.px(x, y + 15, OUT);
  if (n.d && n.r && !n.dr) pc.px(x + 15, y + 15, OUT);
  if (n.u && n.l && !n.ul) {
    pc.px(x, y, OUT);
    for (let ly = 0; ly < 4; ly++) pc.px(x, y + ly, ly < 3 ? SAND.md : SAND.edge);
    pc.px(x + 1, y, SAND.lt); pc.px(x + 1, y + 1, SAND.dk); pc.px(x + 1, y + 2, SAND.edge); pc.px(x + 2, y, SAND.edge);
  }
  if (n.u && n.r && !n.ur) {
    for (let ly = 0; ly < 4; ly++) pc.px(x + 15, y + ly, ly < 3 ? SAND.dk : SAND.edge);
    pc.px(x + 14, y, SAND.md); pc.px(x + 14, y + 1, SAND.dk); pc.px(x + 14, y + 2, SAND.edge); pc.px(x + 13, y, SAND.edge);
  }

  // topo de areia ondulada (marcas de correnteza, grãos, tufos, pedrinhas)
  if (sandy) {
    const above = map.get(tx, ty - 1);
    const open = above === T.EMPTY || above === T.WATER || above === T.BG;
    if (!n.l) { pc.erase(x, y); pc.erase(x + 1, y); pc.erase(x, y + 1); }
    if (!n.r) { pc.erase(x + 15, y); pc.erase(x + 14, y); pc.erase(x + 15, y + 1); }
    for (let lx = n.l ? 0 : -1; lx <= (n.r ? 15 : 16); lx++) {
      const wx = tx * 16 + lx;
      let thick = sandTop(wx), top = 0;
      if (lx === -1 || lx === 16) { top = 2; thick += 1; } else if ((!n.l && lx === 0) || (!n.r && lx === 15)) top = 1;
      for (let ly = top; ly < thick; ly++) {
        let c;
        if (ly === top) c = SAND.hi;
        else if (ly === top + 1) c = SAND.lt;
        else if (ly === thick - 1) c = SAND.edge;
        else c = ((wx * 2 + ly * 5) % 9 === 0) ? SAND.rip : SAND.md;
        if (ly > top && ly < thick - 1 && h2(wx, ty * 16 + ly, 31) < 0.08) c = GRAINS[(h2(wx, ly, 32) * GRAINS.length) | 0];
        if (lx === 16 || (!n.r && lx === 15 && ly > top)) c = ly === thick - 1 ? SAND.edge : SAND.dk;
        if (lx === -1 && ly > top) c = ly === thick - 1 ? SAND.edge : SAND.md;
        pc.px(x + lx, y + ly, c);
      }
      pc.px(x + lx, y + thick, lx < 0 || lx > 15 ? OUT : SAND.sh);
      if (lx < 0 || lx > 15 || !open) continue;
      const hh = h2(wx, ty, 4);
      if (hh < 0.12) { // tufo de capim-marinho
        const hgt = 2 + ((h2(wx, ty, 6) * 4) | 0), lean = h2(wx, ty, 7) < 0.5 ? -1 : 1;
        for (let k = 1; k <= hgt; k++) pc.px(x + lx + (k > 2 ? lean : 0), y - k, k === hgt ? SEAGR.hi : k === 1 ? SEAGR.dk : SEAGR.md);
      } else if (hh < 0.15 && lx < 15) { // pedrinha
        pc.px(x + lx, y - 1, '#a8b4ba'); pc.px(x + lx + 1, y - 1, '#6e7e8a');
      } else if (hh < 0.17 && lx < 15) { // conchinha
        pc.px(x + lx, y - 1, '#f6b0bc'); pc.px(x + lx + 1, y - 1, '#d87088'); pc.px(x + lx, y - 2, '#ffe0e4');
      }
    }
  }
}

// ------------------------------------------------------------------ alt: casco de navio de brinquedo
function drawHull(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const n = ty >= map.rows - 1 ? { ...n0, d: true, dl: true, dr: true } : n0;
  const lev = depthMap(n, info);
  const dk = (c, L) => (L ? mix(c, DEEP, L * 0.2) : c);
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      const L = lev[ly * 16 + lx];
      const prow = Math.floor(wy / 5), pry = wy - prow * 5;
      const sx = (wx + ((h2(prow, 51) * 64) | 0)) % 44;
      const stripe = prow >> 1;
      const sp = h2(stripe, 52);
      const P = sp < 0.2 ? null : PAINTS[stripe % 3 === 0 ? 0 : (sp > 0.86 ? 2 : sp > 0.76 ? 3 : 1)];
      const patch = h2(wx >> 3, prow, 54) < 0.15 + L * 0.05;
      const chip = patch ? h2(wx, wy, 59) < 0.9 : h2(wx, wy, 56) < 0.025;
      const base = P && !chip ? P : null;
      let c;
      if (pry === 4) c = '#4e3222';
      else if (sx === 0) c = WOOD.gap;
      else if (base) c = pry === 0 ? base.lt : (sx === 43 ? base.dk : base.md);
      else c = pry === 0 ? WOOD.lt : (h2(wx >> 3, wy, 55) < 0.18 ? WOOD.dk : WOOD.md);
      if ((sx === 2 || sx === 41) && pry === 2) c = '#e8e0cc';
      if (L === 0 && pry !== 4 && h2(wx >> 1, wy >> 1, 57) < 0.08) c = MOSS[(h2(wx, wy, 58) * 3) | 0];
      pc.px(x + lx, y + ly, dk(c, L));
    }
  }
  // vigia de latão com vidro luminoso
  if (n.l && n.r && n.u && n.d && rng() < 0.22) {
    const cx = x + 8, cy = y + 8;
    pc.circle(cx, cy, 5.6, '#2a1c12'); pc.circle(cx, cy, 4.7, '#b8862e'); pc.circle(cx - 0.6, cy - 0.6, 3.9, '#f0d080');
    pc.circle(cx, cy, 3.3, '#0c3444'); pc.circle(cx, cy, 2.5, '#1a6878');
    pc.px(cx - 2, cy - 2, '#d8fffa'); pc.px(cx - 1, cy - 2, '#7ae8f0'); pc.px(cx - 2, cy - 1, '#7ae8f0'); pc.px(cx + 1, cy + 1, '#2aa8b8');
    pc.px(cx - 4, cy - 4, '#5a4020'); pc.px(cx + 3, cy - 4, '#5a4020'); pc.px(cx - 4, cy + 3, '#5a4020'); pc.px(cx + 3, cy + 3, '#5a4020');
  } else if (rng() < 0.3) { // aglomerado de cracas
    const bx = rng.int(3, 12), by = rng.int(4, 12), k = rng.int(2, 4);
    for (let i = 0; i < k; i++) barnacle(pc, x + bx + rng.int(-2, 2), y + by + rng.int(-2, 2));
  }
  // amurada (tábua de topo com pregos)
  if (!n.u) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      pc.px(x + lx, y, '#f4d098'); pc.px(x + lx, y + 1, '#c89a60'); pc.px(x + lx, y + 2, '#8a5e34'); pc.px(x + lx, y + 3, WOOD.gap);
      if (wx % 6 === 3) pc.px(x + lx, y + 1, '#fff4dc');
    }
  }
  if (!n.l) for (let ly = 0; ly < 16; ly++) { pc.px(x, y + ly, OUT); pc.px(x + 1, y + ly, dk('#d8a874', lev[ly * 16 + 1])); }
  if (!n.r) for (let ly = 0; ly < 16; ly++) { pc.px(x + 15, y + ly, OUT); pc.px(x + 14, y + ly, WOOD.gap); }
  if (!n.d) {
    for (let lx = 0; lx < 16; lx++) { pc.px(x + lx, y + 15, OUT); pc.px(x + lx, y + 14, '#2a1a12'); }
    hangAlgae(pc, x, y, tx, ty, 43);
    if (!n.l) { pc.erase(x, y + 15); pc.px(x + 1, y + 14, OUT); }
    if (!n.r) { pc.erase(x + 15, y + 15); pc.px(x + 14, y + 14, OUT); }
  }
  if (!n.u) {
    for (let lx = 0; lx < 16; lx++) pc.px(x + lx, y - 1, OUT);
    if (!n.l) { pc.erase(x, y - 1); pc.erase(x, y); pc.px(x + 1, y, OUT); }
    if (!n.r) { pc.erase(x + 15, y - 1); pc.erase(x + 15, y); pc.px(x + 14, y, OUT); }
  }
}

// ------------------------------------------------------------------ bg: parede de ruína escura
function drawRuinWall(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  const sU = solidLike(map.get(tx, ty - 1)), sL = solidLike(map.get(tx - 1, ty));
  const sR = solidLike(map.get(tx + 1, ty)), sD = solidLike(map.get(tx, ty + 1));
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      const row = wy >> 3, ry = wy & 7;
      const bxw = wx + ((h2(row, 71) * 24) | 0);
      const bx = Math.floor(bxw / 24), rx = bxw % 24;
      const bh = h2(bx, row, 72);
      let c;
      if (ry === 0 || rx === 0) c = BGW.mort;
      else {
        c = BGW.base[(bh * 3) | 0];
        if (ry === 1) c = BGW.hi; else if (ry === 7 || rx === 23) c = BGW.sh;
        if (bh < 0.2) {
          const g = GLYPHS[(h2(bx, row, 73) * GLYPHS.length) | 0];
          const gx = rx - 9, gy = ry - 2;
          if (gx >= 0 && gx < 5 && gy >= 0 && gy < 5 && g[gy][gx] === '#') c = bh < 0.05 ? BGW.glyph2 : BGW.glyph;
        }
        if (h2(wx, wy, 74) < 0.06) c = BGW.sh;
      }
      if (h2(wx, 0, 75) < 0.05 && h2(wx, wy >> 2, 76) < 0.7) c = (wy & 1) ? BGW.algae : BGW.algae2;
      let sh = 0;
      if (sU) sh = Math.max(sh, (6 - ly) / 6);
      if (sL) sh = Math.max(sh, (4 - lx) / 5);
      if (sR) sh = Math.max(sh, (lx - 11) / 6);
      if (sD) sh = Math.max(sh, (ly - 12) / 6);
      if (sh > th(wx, wy)) c = mix(c, '#03070d', 0.55);
      pc.px(x + lx, y + ly, c);
    }
  }
}
/** Parede interna do navio (tábuas escuras, cavernas/costelas, pregos) — atrás de
 *  corredores e porões do casco. */
function drawHullWall(pc, x, y, info) {
  const { tx, ty, map } = info;
  const sU = solidLike(map.get(tx, ty - 1)), sL = solidLike(map.get(tx - 1, ty));
  const sR = solidLike(map.get(tx + 1, ty)), sD = solidLike(map.get(tx, ty + 1));
  const B = ['#3a2618', '#33210f', '#402a1a'];
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      const row = Math.floor(wy / 6), ry = wy - row * 6;
      const sx = (wx + ((h2(row, 61) * 40) | 0)) % 40;
      let c = B[(h2(row, sx > 20 ? 1 : 0, 62) * 3) | 0];
      if (ry === 5) c = '#1c100a';
      else if (ry === 0) c = '#4a3220';
      if (sx === 0) c = '#1c100a';
      const rib = ((wx % 80) + 80) % 80;
      if (rib < 6) c = rib === 0 ? '#1a0e08' : rib === 1 ? '#7a5230' : rib === 5 ? '#24160c' : '#5a3a22';
      if (rib === 3 && wy % 12 === 4) c = '#c8a060';
      if (h2(wx, wy, 63) < 0.03) c = '#24160c';
      let sh = 0;
      if (sU) sh = Math.max(sh, (6 - ly) / 6);
      if (sL) sh = Math.max(sh, (4 - lx) / 5);
      if (sR) sh = Math.max(sh, (lx - 11) / 6);
      if (sD) sh = Math.max(sh, (ly - 12) / 6);
      if (sh > th(wx, wy)) c = mix(c, '#05030a', 0.5);
      pc.px(x + lx, y + ly, c);
    }
  }
}
/** As paredes de fundo agora vêm da camada de paredes de decorate() (atrás de tudo). */
function bgBehind() {}

// buffer temporário (oneway/espinhos são desenhados nele, contornados e copiados)
let TMP = null;
const O = 2;
function tmp() { if (!TMP) TMP = new PixelCanvas(20, 26); TMP.clear(); return TMP; }

// ------------------------------------------------------------------ oneway: prateleira de coral / convés
function drawShelf(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  bgBehind(pc, x, y, info);
  let sx = tx;
  while (sx > 0 && map.get(sx - 1, ty) === T.ONEWAY) sx--;
  const kh = h2(sx, ty, 61);
  const p = tmp();
  const P = (lx, ly, c) => p.px(O + lx, O + ly, c);
  if (kh < 0.32) { // tábua de convés com corda
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      const end = (!n.l && lx === 0) || (!n.r && lx === 15);
      for (let ly = end ? 1 : 0; ly < 5; ly++) {
        let c = ly === 0 ? WOOD.hi : ly === 1 ? WOOD.lt : ly === 4 ? WOOD.dk : (h2(wx >> 2, ly, 67) < 0.2 ? WOOD.dk : WOOD.md);
        if (wx % 12 === 0 && ly > 0 && ly < 4) c = WOOD.gap;
        if (wx % 12 === 2 && ly === 2) c = '#e8e0cc';
        P(lx, ly, c);
      }
    }
    const rope = (lx) => {
      for (let ly = -1; ly < 6; ly++) P(lx, ly, (ly & 1) ? '#a88a58' : '#e8d098');
      P(lx + 1, 0, '#c8b078'); P(lx + 1, 3, '#c8b078');
      for (let k = 6; k < 10; k++) P(lx + (k > 8 ? 1 : 0), k, k === 9 ? '#f0dca8' : '#c8b078');
    };
    if (!n.l) rope(2);
    if (!n.r) rope(12);
    if (rng() < 0.25) { const bx = rng.int(4, 11); P(bx, 5, '#d0c4ae'); P(bx + 1, 5, '#a89c88'); }
  } else { // prateleira de coral
    const C = kh < 0.6 ? CORAL.pink : kh < 0.88 ? CORAL.orange : CORAL.violet;
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      const e = !n.l && lx < 3 ? 3 - lx : !n.r && lx > 12 ? lx - 12 : 0;
      const top = (h2(wx, ty, 63) < 0.3 ? -1 : 0) + (e > 1 ? 1 : 0);
      const bot = 4 + (h2(wx >> 1, ty, 64) < 0.45 ? 1 : 0) - Math.max(0, e - 1);
      for (let ly = top; ly <= bot; ly++) {
        let c = ly === top ? C.hi : ly === top + 1 ? C.lt : ly === bot ? C.dk : C.md;
        if (ly === top + 1 && wx % 5 === 0) c = C.tip;
        if (ly > top + 1 && ly < bot && h2(wx, ly + ty * 16, 66) < 0.14) c = C.sh;
        P(lx, ly, c);
      }
      const hh = h2(wx, ty, 65);
      if (hh < 0.22 && !e) { const len = 1 + (((hh * 97) | 0) % 4); for (let k = 0; k < len; k++) P(lx, bot + 1 + k, k === len - 1 ? C.lt : C.dk); }
      if (hh > 0.93) P(lx, top - 1, C.tip);
    }
  }
  p.outline(OUT);
  pc.blit(p, x - O, y - O);
}

// ------------------------------------------------------------------ espinhos: ouriços e coral afiado
function drawSpike(pc, x, y, dir, rng, info) {
  bgBehind(pc, x, y, info);
  const p = tmp();
  const P = (lx, ly, c) => p.px(O + Math.round(lx), O + Math.round(ly), c);
  const line = (x0, y0, x1, y1, c, cTip) => {
    const st = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= st; i++) { const k = i / st; P(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, i === st ? cTip : c); }
  };
  const urchin = (cx, cy, r, U) => {
    const ns = 11;
    for (let i = 0; i < ns; i++) {
      const a = Math.PI + ((i + 0.5) / ns) * Math.PI + (rng() - 0.5) * 0.18;
      const len = r + 2.5 + ((i & 1) ? 0 : 2.5) + rng() * 1.5;
      line(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, U.spine, U.tip);
    }
    p.circle(O + cx, O + cy, r, U.body);
    p.circle(O + cx - r * 0.3, O + cy - r * 0.3, r * 0.6, U.mid);
    P(cx - r * 0.5, cy - r * 0.55, U.hi);
    P(cx + r * 0.3, cy - r * 0.1, U.mid);
  };
  const spikeC = (bx, w, hgt, lean, C) => {
    p.tri(O + bx - w / 2, O + 16, O + bx + w / 2, O + 16, O + bx + lean, O + 16 - hgt, C.md);
    line(bx - w / 2 + 0.5, 15, bx + lean, 16 - hgt, C.hi, C.tip);
    P(bx + w / 2 - 1, 15, C.dk);
  };
  const v = rng();
  const U1 = URCHIN[rng.int(0, URCHIN.length - 1)], U2 = URCHIN[rng.int(0, URCHIN.length - 1)];
  if (v < 0.4) {
    spikeC(8, 3, 9, 0, CORAL.pink);
    urchin(4, 12, 3, U1); urchin(12, 12.5, 2.6, U2);
  } else if (v < 0.75) {
    spikeC(1.5, 3, 8, -1, CORAL.violet); spikeC(14.5, 3, 9, 1, CORAL.pink);
    urchin(8, 11.5, 4, U1);
  } else {
    spikeC(3, 4, 12, -1, CORAL.pink); spikeC(8, 4, 14, 0, CORAL.violet); spikeC(13, 4, 11, 1, CORAL.pink);
    urchin(11, 14, 2, U2);
  }
  p.outline(OUT);
  const W = p.w;
  for (let ly = -1; ly <= 15; ly++) {
    for (let lx = -1; lx <= 16; lx++) {
      const val = p.buf[(O + ly) * W + (O + lx)];
      if (!(val >>> 24)) continue;
      let dx, dy;
      if (dir === 'up') { dx = lx; dy = ly; }
      else if (dir === 'down') { dx = 15 - lx; dy = 15 - ly; }
      else if (dir === 'right') { dx = 15 - ly; dy = lx; }
      else { dx = ly; dy = 15 - lx; }
      pc.px(x + dx, y + dy, val);
    }
  }
}

// ------------------------------------------------------------------ água
const WPAL = { // do raso (claro) ao fundo (escuro): r,g,b,a — por horário
  day: [[96, 216, 228, 0.34], [64, 182, 216, 0.42], [42, 144, 198, 0.5], [30, 108, 170, 0.58], [22, 80, 142, 0.66], [16, 58, 114, 0.72], [11, 40, 88, 0.78], [8, 28, 66, 0.82]],
  dusk: [[150, 176, 214, 0.36], [110, 146, 200, 0.44], [76, 112, 180, 0.52], [54, 84, 154, 0.6], [38, 62, 128, 0.66], [26, 46, 104, 0.72], [18, 34, 82, 0.78], [12, 24, 62, 0.82]],
  night: [[50, 130, 168, 0.4], [34, 104, 150, 0.48], [24, 80, 130, 0.56], [16, 60, 108, 0.64], [12, 44, 90, 0.7], [9, 34, 74, 0.76], [7, 26, 58, 0.8], [5, 18, 44, 0.85]],
};
const hex2 = (v) => Math.round(v).toString(16).padStart(2, '0');
const WSTR = {};
for (const k in WPAL) WSTR[k] = WPAL[k].map(([r, g, b, a]) => '#' + hex2(r) + hex2(g) + hex2(b) + hex2(a * 255));
const CAUS_A = [0.6, 0.42, 0.26, 0.14];
const WS = {};
let CAUS = null;
let waterTod = 'day'; // horário da fase atual (lido em decorate(), que recebe os dados da fase)
let curRows = null;   // linhas ASCII da fase atual (decorate) — para reconhecer células de entidades
function waterCol(z, x, yy, tod) {
  const L = WSTR[tod];
  const f = clamp(z / 14, 0, L.length - 1);
  const k = Math.min(L.length - 2, Math.floor(f));
  return L[f - k > th(x, yy) ? k + 1 : k];
}
function buildWater(tod) {
  const S = {};
  S.body = [];
  for (let d = 0; d < 8; d++) {
    const p = new PixelCanvas(16, 16);
    for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) p.px(xx, yy, waterCol(d * 16 + yy, xx, yy, tod));
    p.flush(); S.body.push(p.canvas);
  }
  // faixa de superfície (64 px, repete na horizontal), 16 quadros: linha de onda + espuma + corpo raso
  S.NS = 16; S.surf = [];
  for (let f = 0; f < S.NS; f++) {
    const ph = (f / S.NS) * TAU;
    const p = new PixelCanvas(64, 19);
    for (let xx = 0; xx < 64; xx++) {
      const wv = Math.sin((TAU * 2 * xx) / 64 + ph) * 1.1 + Math.sin((TAU * 3 * xx) / 64 - 2 * ph) * 0.7;
      const cy = 3 + Math.round(wv);
      for (let yy = cy; yy < 19; yy++) {
        let c = waterCol(Math.max(0, yy - 3), xx, yy + 1, tod);
        if (yy === cy) c = '#e8fffcdc';
        else if (yy === cy + 1) c = '#a8f4f4b0';
        else if (yy === cy + 2) c = '#7ae0ec88';
        p.px(xx, yy, c);
      }
      if (wv < -1.05) p.px(xx, cy - 1, '#ffffffc0');
      if (h2(xx, f, 82) < 0.035) p.px(xx, cy, '#ffffff');
      if (h2(xx, f >> 1, 83) < 0.05) p.px(xx, cy + 4, '#c8fff880');
    }
    p.flush(); S.surf.push(p.canvas);
  }
  // cáusticas: bordas de células de Voronoi que se movem em laços (64×64 repetível, +16 de folga)
  S.NC = 8;
  if (CAUS) { S.caus = CAUS; S.bub = bubbles(); return S; }
  S.caus = CAUS = [];
  const r = lrng(777);
  const pts = [];
  for (let i = 0; i < 9; i++) pts.push({ x: r() * 64, y: r() * 64, rx: 2 + r() * 4, ry: 2 + r() * 4, ph: r() * TAU, k: r() < 0.5 ? 1 : -1 });
  for (let f = 0; f < S.NC; f++) {
    const a = (f / S.NC) * TAU;
    const Q = pts.map((q) => [q.x + Math.cos(a * q.k + q.ph) * q.rx, q.y + Math.sin(a * q.k + q.ph) * q.ry]);
    const p = new PixelCanvas(80, 80);
    for (let yy = 0; yy < 64; yy++) {
      for (let xx = 0; xx < 64; xx++) {
        let d1 = 1e9, d2 = 1e9;
        for (const [qx, qy] of Q) {
          let dx = Math.abs(xx - qx) % 64; if (dx > 32) dx = 64 - dx;
          let dy = Math.abs(yy - qy) % 64; if (dy > 32) dy = 64 - dy;
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        const c = e < 1.0 ? '#d8fff890' : e < 2.2 ? '#9ef4f02c' : null;
        if (!c) continue;
        p.px(xx, yy, c);
        if (xx < 16) p.px(xx + 64, yy, c);
        if (yy < 16) p.px(xx, yy + 64, c);
        if (xx < 16 && yy < 16) p.px(xx + 64, yy + 64, c);
      }
    }
    p.flush(); S.caus.push(p.canvas);
  }
  S.bub = bubbles();
  return S;
}
function bubbles() {
  const c = '#d8fffa', hi = '#ffffff', f = '#9ef4f040';
  return [
    mk(3, 3, (p) => { p.px(1, 0, c); p.px(0, 1, c); p.px(2, 1, c); p.px(1, 2, c); p.px(1, 1, f); }, null),
    mk(4, 4, (p) => { p.hline(1, 0, 2, c); p.hline(1, 3, 2, c); p.vline(0, 1, 2, c); p.vline(3, 1, 2, c); p.rect(1, 1, 2, 2, f); p.px(1, 1, hi); }, null),
    mk(5, 5, (p) => { p.hline(1, 0, 3, c); p.hline(1, 4, 3, c); p.vline(0, 1, 3, c); p.vline(4, 1, 3, c); p.rect(1, 1, 3, 3, f); p.px(1, 1, hi); p.px(2, 1, hi); }, null),
  ];
}

// ------------------------------------------------------------------ análise da água
// Calculada uma vez por mapa (cache): regiões conexas de água, quais são BOLHAS
// mágicas flutuantes (ar dos lados/embaixo), qual é o MAR (linha d'água principal),
// profundidade/superfície por célula e quais células ficam "cobertas" (sob rocha,
// casco ou parede de fundo) e precisam de parede atrás em vez do fundo do mar.
// bg_w2.js usa isto para desenhar o fundo submarino só atrás da água do mar.
const ENT_BLOCK = new Set(['S', 'G', 'B', 'H', 'Y']);
const _winfo = new WeakMap();
const isThin = (t) => t === T.ONEWAY || t === T.SPIKE;
export function w2WaterInfo(map, rows) {
  let I = _winfo.get(map);
  if (I) return I;
  const C = map.cols, R = map.rows, N = C * R;
  const chAt = (x, y) => (rows && rows[y] && rows[y][x]) || '.';
  const isEntCell = (x, y) => { const c = chAt(x, y); return c !== '.' && c !== '~' && c !== ':' && c !== ' '; };
  const reg = new Int32Array(N).fill(-1);
  const depth = new Uint8Array(N), surf = new Uint8Array(N), ceil = new Uint8Array(N), memb = new Uint8Array(N);
  const cover = new Uint8Array(N); // 1 = parede de ruína atrás, 2 = parede de casco atrás
  const regions = [];
  // --- regiões (4-conexas)
  const st = [];
  for (let i = 0; i < N; i++) {
    if (reg[i] >= 0 || map.data[i] !== T.WATER) continue;
    const id = regions.length;
    const Rg = { id, x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0, leak: 0, per: 0, cells: [] };
    reg[i] = id; st.push(i);
    while (st.length) {
      const k = st.pop(), x = k % C, y = (k / C) | 0;
      Rg.n++; Rg.cells.push(k);
      if (x < Rg.x0) Rg.x0 = x; if (x > Rg.x1) Rg.x1 = x; if (y < Rg.y0) Rg.y0 = y; if (y > Rg.y1) Rg.y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= C || ny < 0 || ny >= R) { if (dy >= 0) Rg.per++; continue; }
        const j = ny * C + nx, t = map.data[j];
        if (t === T.WATER) { if (reg[j] < 0) { reg[j] = id; st.push(j); } continue; }
        if (dy < 0) continue; // em cima pode ser ar (superfície)
        Rg.per++;
        if ((t === T.EMPTY || t === T.BG) && !isEntCell(nx, ny)) Rg.leak++;
      }
    }
    Rg.bubble = Rg.leak >= 2 && Rg.leak >= Rg.per * 0.3;
    regions.push(Rg);
  }
  // --- profundidade, superfície, teto e membranas por célula
  const air = (x, y) => { const t = map.get(x, y); return (t === T.EMPTY || t === T.BG) && !isEntCell(x, y); };
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const i = y * C + x;
    if (map.data[i] !== T.WATER) continue;
    let d = 0, yy = y - 1;
    while (d < 7) {
      const t = map.get(x, yy);
      if (t === T.WATER) { d++; yy--; } else if (isThin(t)) yy--; else break;
    }
    depth[i] = d;
    const above = map.get(x, y - 1);
    if (above === T.EMPTY || above === T.BG) surf[i] = isEntCell(x, y - 1) && map.get(x, y - 2) === T.WATER ? 0 : 1;
    else if (d === 0 && !isThin(above) && above !== T.WATER) ceil[i] = 1;
    memb[i] = (air(x - 1, y) ? 1 : 0) | (air(x + 1, y) ? 2 : 0) | (air(x, y + 1) ? 4 : 0);
  }
  // --- células cobertas (água ou ar sob rocha/casco/parede): ganham parede de fundo
  const solidish = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;
  const styleAt = (x, y) => {
    let alt = 0, sol = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k < 24; k++) {
        const t = map.get(x + dx * k, y + dy * k);
        if (t === T.ALT) { alt++; break; }
        if (t === T.SOLID || t === T.FAKE) { sol++; break; }
        if (y + dy * k < 0 || y + dy * k >= R) break;
      }
    }
    return alt > sol ? 2 : 1;
  };
  // coluna aberta para o céu (nada sólido/parede acima; bolhas não contam). Sob uma
  // saliência, só fica "coberto" quem está a 3+ tiles da borda aberta mais próxima
  // (bordas finas continuam mostrando o fundo; cavernas/túneis/porões ganham parede).
  const openCol = new Uint8Array(N);
  for (let x = 0; x < C; x++) {
    for (let y = 0; y < R; y++) {
      const i = y * C + x, t = map.data[i];
      if (solidish(t) || t === T.BG) break;
      openCol[i] = 1;
    }
  }
  const INF = 255, hd = new Uint8Array(N);
  for (let y = 0; y < R; y++) {
    let d = INF;
    for (let x = 0; x < C; x++) {
      const i = y * C + x, t = map.data[i];
      if (solidish(t) || t === T.BG) { d = INF; hd[i] = INF; continue; }
      d = openCol[i] ? 0 : Math.min(INF, d + 1); hd[i] = d;
    }
    d = INF;
    for (let x = C - 1; x >= 0; x--) {
      const i = y * C + x, t = map.data[i];
      if (solidish(t) || t === T.BG) { d = INF; continue; }
      d = openCol[i] ? 0 : Math.min(INF, d + 1); if (d < hd[i]) hd[i] = d;
    }
  }
  for (let i = 0; i < N; i++) {
    const t = map.data[i];
    if (t === T.BG) cover[i] = styleAt(i % C, (i / C) | 0);
    else if ((t === T.WATER || t === T.EMPTY || isThin(t)) && !openCol[i] && hd[i] >= 3) {
      if (t === T.WATER && regions[reg[i]].bubble) continue;
      cover[i] = styleAt(i % C, (i / C) | 0);
    }
  }
  // --- linha do mar: linha de superfície mais comum entre regiões grandes não flutuantes
  const cnt = new Map();
  for (const Rg of regions) {
    if (Rg.bubble || Rg.n < 40) continue;
    for (const k of Rg.cells) if (surf[k] && !cover[k] && map.data[k - C] !== T.BG) { const y = (k / C) | 0; cnt.set(y, (cnt.get(y) || 0) + 1); }
  }
  let seaRow = null, best = 0;
  for (const [y, n] of cnt) if (n > best) { best = n; seaRow = y; }
  for (const Rg of regions) {
    Rg.kind = Rg.bubble ? 'bubble' : 'pool';
    if (!Rg.bubble && seaRow !== null) for (const k of Rg.cells) if (surf[k] && !cover[k] && ((k / C) | 0) === seaRow) { Rg.kind = 'sea'; break; }
  }
  for (const Rg of regions) if (Rg.kind === 'sea' || Rg.kind === 'pool') { let open = 0; for (const k of Rg.cells) if (!cover[k]) open++; Rg.open = open; }
  I = { C, R, reg, regions, depth, surf, ceil, memb, cover, seaRow, bubbleCache: new Map() };
  _winfo.set(map, I);
  return I;
}

// ------------------------------------------------------------------ bolha de água mágica
// Forma arredondada com borda de "vidro" iridescente que ondula, corpo translúcido
// com brilho especular. Assado uma vez por forma; por quadro só a borda + brilhos.
const BUB_RIM = ['#e8ffff', '#ffd6f4', '#c8fff0', '#fff6c8'];
function bakeBubble(bw, bh, inCell) {
  const W = bw * 16 + 4, H = bh * 16 + 4, O2 = 2, r = Math.round(clamp(Math.min(bw, bh) * 16 / 3.2, 6, 13));
  const inside = new Uint8Array(W * H);
  const has = (cx, cy) => cx >= 0 && cy >= 0 && cx < bw && cy < bh && inCell(cx, cy);
  for (let y = 0; y < bh * 16; y++) for (let x = 0; x < bw * 16; x++) {
    const cx = x >> 4, cy = y >> 4;
    if (!has(cx, cy)) continue;
    const u = x & 15, v = y & 15;
    const L = !has(cx - 1, cy), Rr = !has(cx + 1, cy), U = !has(cx, cy - 1), D = !has(cx, cy + 1);
    let out = false;
    if (L && U && u < r && v < r && Math.hypot(r - u - 0.5, r - v - 0.5) > r) out = true;
    if (Rr && U && u > 15 - r && v < r && Math.hypot(u - (15 - r) - 0.5, r - v - 0.5) > r) out = true;
    if (L && D && u < r && v > 15 - r && Math.hypot(r - u - 0.5, v - (15 - r) - 0.5) > r) out = true;
    if (Rr && D && u > 15 - r && v > 15 - r && Math.hypot(u - (15 - r) - 0.5, v - (15 - r) - 0.5) > r) out = true;
    if (!out) inside[(y + O2) * W + x + O2] = 1;
  }
  // distância até a borda (chamfer simples)
  const dist = new Uint8Array(W * H).fill(255);
  for (let i = 0; i < W * H; i++) if (!inside[i]) dist[i] = 0;
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - W] + 1); }
  for (let y = H - 2; y >= 0; y--) for (let x = W - 2; x > 0; x--) { const i = y * W + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + W] + 1); }
  const pc = new PixelCanvas(W, H);
  const rim = [];
  const by0 = O2, bh0 = bh * 16, bxw = bw * 16;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!inside[i]) continue;
    const d = dist[i] - 1;
    if (d === 0) {
      let nx = 0, ny = 0;
      if (!inside[i - 1]) nx = -1; else if (!inside[i + 1]) nx = 1;
      if (!inside[i - W]) ny = -1; else if (!inside[i + W]) ny = 1;
      rim.push(x, y, nx, ny);
      continue;
    }
    const fy = clamp((y - by0) / bh0, 0, 1), fx = clamp((x - O2) / bxw, 0, 1);
    let c = fy + (th(x, y) - 0.5) * 0.25 < 0.45 ? '#7fdcf070' : fy + (th(x, y) - 0.5) * 0.25 < 0.8 ? '#4ab0e07c' : '#2a80c88a';
    if (d === 1) c = '#d8fcff66';
    else if (d <= 3 && fy > 0.62) c = '#1a5aa070';
    if (d >= 2 && d <= 3 && fx < 0.42 && fy < 0.42 && (fx + fy) < 0.55) c = '#ffffffc8';
    pc.px(x, y, c);
  }
  // contorno escuro por fora (lê bem contra o céu claro)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (inside[i]) continue;
    if (inside[i - 1] || inside[i + 1] || inside[i - W] || inside[i + W]) pc.px(x, y, '#12407acc');
  }
  // brilhos fixos
  const sx = O2 + 7, sy = O2 + 9;
  if (inside[sy * W + sx]) { pc.px(sx, sy, '#ffffff'); pc.px(sx + 1, sy, '#ffffffa0'); }
  if (bw * bh > 2) { const ex = O2 + bxw - 8, ey = O2 + bh0 - 9; if (inside[ey * W + ex]) { pc.px(ex, ey, '#c8fcffc0'); pc.px(ex - 1, ey + 1, '#c8fcff80'); } }
  pc.flush();
  return { canvas: pc.canvas, rim, W, H, bw, bh };
}
const _rectBub = new Map();
function rectBubble(bw, bh) {
  const k = bw + 'x' + bh;
  let B = _rectBub.get(k);
  if (!B) { B = bakeBubble(bw, bh, () => true); _rectBub.set(k, B); }
  return B;
}
function drawBaked(ctx, B, x, y, t, seed) {
  x -= 2; y -= 2;
  ctx.drawImage(B.canvas, x, y);
  const rim = B.rim;
  // borda ondulante (respira ±1 px ao longo da normal) com reflexos iridescentes
  for (let c = 0; c < 4; c++) {
    ctx.fillStyle = BUB_RIM[c];
    ctx.globalAlpha = c === 0 ? 0.9 : 0.75;
    for (let i = 0; i < rim.length; i += 4) {
      const px = rim[i], py = rim[i + 1];
      const b7 = ((((px + py * 0.7) / 9 + t * 0.9 + seed) | 0) % 7 + 7) % 7;
      if ((b7 < 4 ? 0 : b7 - 3) !== c) continue;
      const o = Math.sin(px * 0.21 + py * 0.27 + t * 2.6 + seed) > 0.45 ? 1 : 0;
      ctx.fillRect(x + px + rim[i + 2] * o, y + py + rim[i + 3] * o, 1, 1);
    }
  }
  // bolhinhas subindo e cintilas
  const n = Math.max(2, Math.min(6, (B.bw * B.bh) >> 1));
  const iw = B.bw * 16 - 10, ih = B.bh * 16 - 10;
  for (let i = 0; i < n; i++) {
    const hs = h2(i, seed | 0, 17);
    const k = (t * (0.15 + hs * 0.2) + hs) % 1;
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 * 0.8 : 0.8;
    ctx.fillStyle = '#e8ffff';
    ctx.fillRect(x + 7 + Math.round(hs * iw + Math.sin(t * 2.3 + i) * 1.5), Math.round(y + 7 + ih - k * ih), 1, 1);
    const s = (t * 0.7 + hs * 9) % 3;
    if (s < 0.25) {
      ctx.globalAlpha = 1 - Math.abs(s - 0.125) / 0.125; ctx.fillStyle = '#ffffff';
      const qx = x + 6 + Math.round(h2(i, 3, seed | 0) * iw), qy = y + 6 + Math.round(h2(i, 4, seed | 0) * ih);
      ctx.fillRect(qx - 1, qy, 3, 1); ctx.fillRect(qx, qy - 1, 1, 3);
    }
  }
  ctx.globalAlpha = 1;
}
/** Bolha de água retangular (w×h tiles) — usada pelos blocos de água móveis (w2_water.js). */
export function drawWaterBubble(ctx, x, y, wt, ht, t, seed = 0) {
  drawBaked(ctx, rectBubble(Math.max(1, wt | 0), Math.max(1, ht | 0)), Math.round(x), Math.round(y), t, seed);
}
function drawRegionBubble(ctx, I, Rg, t) {
  if (!Rg.baked) {
    const set = new Set(Rg.cells);
    Rg.baked = bakeBubble(Rg.x1 - Rg.x0 + 1, Rg.y1 - Rg.y0 + 1, (cx, cy) => set.has((Rg.y0 + cy) * I.C + Rg.x0 + cx));
  }
  drawBaked(ctx, Rg.baked, Rg.x0 * 16, Rg.y0 * 16 + Math.round(Math.sin(t * 1.3 + Rg.id) * 0.6), t, Rg.id * 1.7);
}

function drawWater(ctx, map, x0, y0, x1, y1, t) {
  const tod = WSTR[waterTod] ? waterTod : 'day';
  const S = WS[tod] || (WS[tod] = buildWater(tod));
  const I = w2WaterInfo(map, curRows);
  const cm = tod === 'night' ? 0.55 : tod === 'dusk' ? 0.8 : 1;
  const fs = Math.floor(t * 9) % S.NS, fc = Math.floor(t * 6) % S.NC;
  const cox = Math.floor(t * 5), coy = Math.floor(t * 2.5);
  const W = T.WATER, C = I.C;
  const bubbles = new Set();
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (map.get(tx, ty) !== W) continue;
      const i = ty * C + tx;
      const Rg = I.regions[I.reg[i]];
      if (!Rg) continue;
      if (Rg.bubble) { bubbles.add(Rg); continue; }
      const px = tx * 16, py = ty * 16;
      const d = I.depth[i];
      const surface = I.surf[i] === 1;
      if (surface) ctx.drawImage(S.surf[fs], px & 63, 0, 16, 19, px, py - 3, 16, 19);
      else ctx.drawImage(S.body[d], px, py);
      if (I.ceil[i]) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#062038'; ctx.fillRect(px, py, 16, 2); }
      // cáusticas (somem com a profundidade)
      if (d < 4) {
        ctx.globalAlpha = CAUS_A[d] * cm;
        const sx = (((px + cox) % 64) + 64) % 64, sy = (((py + coy) % 64) + 64) % 64;
        if (surface) ctx.drawImage(S.caus[fc], sx, sy + 4, 16, 12, px, py + 4, 16, 12);
        else ctx.drawImage(S.caus[fc], sx, sy, 16, 16, px, py, 16, 16);
      }
      ctx.globalAlpha = 1;
      const hs = h2(tx, ty, 91);
      // brilhos na superfície
      if (surface) {
        const s = (t * 0.8 + hs * 10) % 2.6;
        if (s < 0.3) {
          const a = 1 - Math.abs(s - 0.15) / 0.15;
          const sxp = px + 2 + (((hs * 977) | 0) % 12), syp = py + 2;
          ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#ffffff';
          ctx.fillRect(sxp, syp, 1, 1);
          if (a > 0.5) { ctx.fillRect(sxp - 1, syp, 3, 1); ctx.fillRect(sxp, syp - 1, 1, 3); }
          ctx.globalAlpha = 1;
        }
      }
      // bolhas subindo até a superfície
      if (d >= 1 && hs < 0.1) {
        const span = d * 16 + 12;
        const k = (t * (0.16 + hs) + hs * 31) % 1;
        const by = Math.round(py + 13 - k * span);
        const bx = px + 3 + (((hs * 1000) | 0) % 10) + Math.round(Math.sin(t * 3 + hs * 50) * 1.2);
        ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 0.85;
        ctx.drawImage(S.bub[((hs * 100) | 0) % 3].canvas, bx, by);
        ctx.globalAlpha = 1;
      }
      // plâncton luminoso no fundo
      if (d >= (tod === 'night' ? 0 : 2) && hs > (tod === 'night' ? 0.72 : 0.86)) {
        const a = 0.5 + 0.5 * Math.sin(t * 2.2 + hs * 40);
        ctx.globalAlpha = a * 0.9; ctx.fillStyle = hs > 0.95 ? '#ff9ad8' : '#7ff8ec';
        ctx.fillRect(Math.round(px + 8 + Math.sin(t * 0.5 + hs * 9) * 6), Math.round(py + 8 + Math.sin(t * 0.37 + hs * 13) * 5), 1, 1);
        ctx.globalAlpha = 1;
      }
      // borda vazada (raro depois da revisão: água encostando no ar pelos lados)
      const mb = I.memb[i];
      if (mb) {
        ctx.fillStyle = '#c8fcff';
        const y0e = surface ? 3 : 0;
        for (let yy = y0e; yy < 16; yy += 2) {
          const o = Math.round(Math.sin((py + yy) * 0.45 + t * 2.6) * 0.7);
          if (mb & 1) { ctx.globalAlpha = 0.55; ctx.fillRect(px + Math.max(0, o), py + yy, 1, 2); }
          if (mb & 2) { ctx.globalAlpha = 0.45; ctx.fillRect(px + 15 + Math.min(0, o), py + yy, 1, 2); }
        }
        if (mb & 4) for (let xx = 0; xx < 16; xx += 2) { ctx.globalAlpha = 0.5; ctx.fillRect(px + xx, py + 15, 2, 1); }
        ctx.globalAlpha = 1;
      }
    }
  }
  for (const Rg of bubbles) drawRegionBubble(ctx, I, Rg, t);
}

// ------------------------------------------------------------------ sprites de decoração
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
    pc.circle(c, c, r, color + '12'); pc.circle(c, c, r * 0.7, color + '1c'); pc.circle(c, c, r * 0.42, color + '2a');
  }, null);
}
const KELP_P = [
  { hi: '#a4ecb0', lt: '#62c482', md: '#3c9c64', dk: '#27744e', bl: '#e8cc60' },
  { hi: '#f0dc90', lt: '#c8ac52', md: '#9a8238', dk: '#6c5a28', bl: '#f4e8a8' },
  { hi: '#a0f4e0', lt: '#52c8b2', md: '#2e9a8c', dk: '#1e6a66', bl: '#ff9ab8' },
];
const KELP_H = [26, 40, 58, 80];
const KNF = 12;
function kelpFrames(H, K, seed) {
  const r = lrng(seed);
  const leaves = [];
  for (let s = 5; s < H - 3; s += r.int(4, 7)) leaves.push({ s, side: leaves.length % 2 ? 1 : -1, len: r.int(3, 6), bl: r() < 0.4, ph: r() * TAU });
  const W = 24, frames = [];
  for (let f = 0; f < KNF; f++) {
    const ph = (f / KNF) * TAU;
    const xAt = (s) => W / 2 + Math.sin(ph - s * 0.07) * 3.4 * Math.pow(s / H, 1.4) + Math.sin(2 * ph - s * 0.19) * 0.9 * (s / H);
    frames.push(mk(W, H + 3, (pc) => {
      for (const lf of leaves) {
        const x0 = xAt(lf.s), y0 = H + 1 - lf.s;
        const flap = Math.sin(ph + lf.ph);
        for (let i = 1; i <= lf.len; i++) {
          const lx = Math.round(x0 + lf.side * i), ly = Math.round(y0 - i * (0.55 + flap * 0.18));
          pc.px(lx, ly, i === lf.len ? K.hi : K.lt);
          if (i < lf.len - 1) pc.px(lx, ly + 1, K.md);
        }
        if (lf.bl) pc.circle(Math.round(x0) + lf.side * 1.5 + 0.5, y0 + 1.5, 1.2, K.bl);
      }
      for (let s = 0; s <= H; s++) {
        const xx = Math.round(xAt(s)), yy = H + 1 - s;
        pc.px(xx, yy, s % 6 === 0 ? K.lt : K.md); pc.px(xx + 1, yy, K.dk);
      }
      const tx = Math.round(xAt(H)); pc.px(tx, 1, K.hi); pc.px(tx, 0, K.lt);
    }));
  }
  return frames;
}
const ANEM_P = [
  { body: '#2a8a9a', bl: '#4ab8c0', bd: '#1a5a6a', tent: '#7ae8f0', tip: '#efffff', glow: '#5ff8f0' },
  { body: '#c05a8a', bl: '#e88ab0', bd: '#803a6a', tent: '#ffa8cc', tip: '#fff0ff', glow: '#ff7ac8' },
  { body: '#6a4aa0', bl: '#9a7ad0', bd: '#3e2a6a', tent: '#c8a8ff', tip: '#ffffff', glow: '#b48aff' },
];
function anemoneFrames(P) {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const ph = (f / 4) * TAU;
    frames.push(mk(20, 17, (pc) => {
      for (let i = 0; i < 9; i++) {
        const u = (i - 4) / 4;
        const len = 6 + (1 - Math.abs(u)) * 2;
        for (let k = 0; k <= len; k++) {
          const kk = k / len;
          const xx = 10 + u * 3 + u * kk * 5.5 + Math.sin(ph + i * 0.9 + kk * 2.5) * kk * 1.6;
          const yy = 10 - kk * (len - Math.abs(u) * 3);
          pc.px(Math.round(xx), Math.round(yy), k === len ? P.tip : P.tent);
        }
      }
      pc.ellipse(10, 11.5, 5, 2, P.bl);
      pc.rect(6, 12, 8, 4, P.body); pc.vline(6, 12, 4, P.bl); pc.vline(13, 12, 4, P.bd); pc.hline(6, 15, 8, P.bd);
      pc.px(8, 13, P.bl); pc.px(11, 14, P.bl); pc.px(9, 11, P.tip);
    }));
  }
  return frames;
}
function fishSpr(P, flip) {
  return mk(7, 4, (pc) => {
    const X = (x) => (flip ? 6 - x : x);
    pc.px(X(0), 0, P.t); pc.px(X(0), 3, P.t); pc.px(X(1), 1, P.t); pc.px(X(1), 2, P.t);
    for (let x = 2; x <= 5; x++) { pc.px(X(x), 1, P.b); pc.px(X(x), 2, P.b); }
    pc.px(X(3), 0, P.b); pc.px(X(4), 0, P.b); pc.px(X(3), 3, P.b); pc.px(X(4), 3, P.b);
    pc.px(X(3), 1, P.s); pc.px(X(3), 2, P.s); pc.px(X(4), 0, P.s);
    pc.px(X(5), 1, '#0a1020'); pc.px(X(6), 2, P.b);
  }, null);
}
function crabFrames() {
  const B = '#e8603a', L = '#ff9a6a', D = '#a83a2a';
  return [0, 1, 2].map((f) => mk(15, 10, (pc) => {
    // patas
    for (let i = 0; i < 3; i++) {
      const o = (f === 1 ? (i & 1) : ((i + 1) & 1));
      pc.px(3 - i, 7 + o, D); pc.px(2 - i, 8 + o, D);
      pc.px(11 + i, 7 + (1 - o), D); pc.px(12 + i, 8 + (1 - o), D);
    }
    pc.ellipse(7.5, 6, 4.6, 2.6, B);
    pc.hline(5, 4, 4, L); pc.px(4, 5, L); pc.hline(5, 8, 5, D);
    // olhos em pedúnculos
    pc.vline(6, 2, 2, D); pc.vline(9, 2, 2, D); pc.px(6, 1, '#101018'); pc.px(9, 1, '#101018');
    // garras
    const up = f === 2 ? -2 : 0;
    pc.rect(1, 3 + up, 2, 2, B); pc.px(0, 2 + up, L); pc.px(2, 2 + up, L); pc.px(3, 5, D);
    pc.rect(12, 3 + up, 2, 2, B); pc.px(12, 2 + up, L); pc.px(14, 2 + up, L); pc.px(11, 5, D);
  }));
}
function clamFrames() {
  return [0, 1, 2].map((f) => mk(12, 9, (pc) => {
    const S = '#b89ad0', SL = '#e0c8f0', SD = '#7a5a9a';
    pc.ellipse(6, 7, 5.5, 2, SD); pc.hline(1, 7, 10, S);
    for (let x = 2; x < 10; x += 2) pc.px(x, 8, SL);
    if (f > 0) {
      pc.ellipse(6, 6.5, 4, 1.2, '#f0b0c0');
      if (f === 2) { pc.circle(6, 5.6, 1.6, '#f8f4ff'); pc.px(5, 5, '#ffffff'); pc.px(7, 6, '#c8c0e0'); }
    }
    const lid = f === 0 ? 6 : f === 1 ? 4 : 2;
    pc.ellipse(6, lid, 5.5, 1.8, S); pc.hline(2, lid - 1, 7, SL);
    for (let x = 2; x < 11; x += 2) pc.px(x, lid, SD);
  }));
}
function branchCoral(w, h, C, seed) {
  const r = lrng(seed);
  return mk(w, h, (pc) => {
    const segs = [];
    const grow = (x, y, a, len, depth, tk) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      segs.push([x, y, x2, y2, tk, depth]);
      if (depth > 0) {
        const nb = r() < 0.35 ? 3 : 2;
        for (let i = 0; i < nb; i++) grow(x2, y2, a + (i - (nb - 1) / 2) * (0.55 + r() * 0.3) + (r() - 0.5) * 0.2, len * (0.62 + r() * 0.2), depth - 1, Math.max(0.6, tk - 0.45));
      }
    };
    grow(w / 2, h - 1, -Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.3, 3, 1.6);
    for (const [a, b, c, d, tk] of segs) pc.thickLine(a + 1, b, c + 1, d, tk, C.dk);
    for (const [a, b, c, d, tk] of segs) pc.thickLine(a, b, c, d, tk, C.md);
    for (const [a, b, c, d, tk] of segs) if (tk > 0.9) pc.line(a - 1, b, c - 1, d, C.lt);
    for (const [, , c, d, , dep] of segs) if (dep === 0) { pc.px(c, d, C.tip); pc.px(c, d + 1, C.hi); }
  });
}
function fanCoral(w, h, C) {
  return mk(w, h, (pc) => {
    const cx = w / 2, by = h - 3, R = Math.min(w / 2 - 1, h - 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - cx) / R, dy = (by - y) / (R * 1.05);
        if (dy < 0.05 || dx * dx + dy * dy > 1) continue;
        const a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
        const spoke = Math.abs((((a * 7) / Math.PI) % 1) - 0.5) > 0.36;
        const arc = Math.abs(((d * 5) % 1) - 0.5) > 0.38;
        pc.px(x, y, spoke || arc ? (d > 0.82 ? C.lt : x < cx ? C.md : C.dk) : C.sh);
      }
    }
    pc.vline(Math.round(cx), by, 3, C.dk); pc.vline(Math.round(cx) - 1, by + 1, 2, C.md);
  });
}
function brainCoral(C) {
  return mk(16, 10, (pc) => {
    pc.ellipse(8, 10, 7.5, 9, C.md);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - 8) / 7.5, dy = (y + 0.5 - 10) / 9;
      if (dx * dx + dy * dy > 1) continue;
      if (Math.sin(x * 1.25 + Math.sin(y * 1.1) * 2.2) > 0.55) pc.px(x, y, C.dk);
      else if (dx < -0.2 && dy < -0.5) pc.px(x, y, C.lt);
    }
  });
}
function tubeSponge(C) {
  return mk(14, 16, (pc) => {
    for (const [x, hh, r] of [[3, 9, 2], [7, 15, 2.5], [11, 7, 2]]) {
      const x0 = Math.round(x - r), ww = Math.round(r * 2) + 1;
      pc.rect(x0, 16 - hh, ww, hh, C.md); pc.vline(x0, 16 - hh, hh, C.lt); pc.vline(x0 + ww - 1, 16 - hh, hh, C.dk);
      pc.hline(x0, 16 - hh, ww, C.hi); pc.hline(x0 + 1, 17 - hh, ww - 2, C.sh);
      for (let y = 18 - hh; y < 16; y += 3) pc.px(x0 + 1, y, C.lt);
    }
  });
}
function starfish(P) {
  return mk(11, 11, (pc) => {
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * TAU) / 5; pc.thickLine(5, 5, 5 + Math.cos(a) * 4.6, 5 + Math.sin(a) * 4.6, 0.9, P.md); }
    pc.circle(5.5, 5.5, 1.8, P.md);
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * TAU) / 5; pc.px(Math.round(5 + Math.cos(a) * 2.5), Math.round(5 + Math.sin(a) * 2.5), P.lt); }
    pc.px(5, 5, P.hi);
  });
}
function buildSprites() {
  const S = {};
  S.kelp = KELP_P.map((K, pi) => KELP_H.map((H, hi) => kelpFrames(H, K, 100 + pi * 17 + hi * 5)));
  S.fgrass = [-1, 0, 1].map((lean) => mk(16, 11, (pc) => {
    for (const [bx, hgt] of [[2, 6], [4, 9], [6, 5], [8, 10], [10, 7], [12, 8], [14, 5]]) {
      for (let k = 0; k < hgt; k++) {
        const xx = bx + Math.round(lean * (k / hgt) ** 2 * 3);
        pc.px(xx, 10 - k, k > hgt - 3 ? SEAGR.hi : k > hgt / 2 ? SEAGR.lt : SEAGR.md);
      }
    }
  }, '#0c2a26'));
  S.anem = ANEM_P.map((P) => ({ fr: anemoneFrames(P), halo: glowHalo(15, P.glow), glow: P.glow, tip: P.tip }));
  S.fish = [
    { b: '#ff9a4a', s: '#fff0e0', t: '#e0603a' }, { b: '#4ac0ff', s: '#e8ffff', t: '#f0d040' },
    { b: '#ffd84a', s: '#2a3a5a', t: '#ff8a3a' }, { b: '#ff7ab0', s: '#ffe0f0', t: '#b04a8a' },
  ].map((P) => [fishSpr(P, false), fishSpr(P, true)]);
  S.crab = crabFrames();
  S.clam = clamFrames();
  S.bub = bubbles();
  S.vent = mk(14, 15, (pc) => {
    pc.poly([[1, 15], [4, 3], [10, 3], [13, 15]], '#4a5a66');
    pc.poly([[3, 15], [5, 4], [7, 4], [6, 15]], '#6a7e8a');
    pc.poly([[10, 15], [9, 4], [10, 4], [12, 15]], '#33424e');
    pc.ellipse(7, 3.5, 3.5, 1.6, '#2a1a14'); pc.hline(5, 3, 4, '#ff9a4a'); pc.px(7, 3, '#ffd27a');
    pc.px(3, 9, '#e8d8a0'); pc.px(10, 11, '#e8d8a0'); pc.px(5, 12, '#c8b880'); pc.px(9, 7, '#e8d8a0');
  });
  S.ventGlow = glowHalo(7, '#ffa860');
  S.corals = [
    { pc: branchCoral(22, 22, CORAL.pink, 11), sink: 1 },
    { pc: branchCoral(18, 17, CORAL.orange, 23), sink: 1 },
    { pc: branchCoral(20, 26, CORAL.violet, 37), sink: 1 },
    { pc: fanCoral(20, 18, CORAL.violet), sink: 1 },
    { pc: fanCoral(16, 14, CORAL.pink), sink: 1 },
    { pc: brainCoral(CORAL.gold), sink: 2 },
    { pc: tubeSponge(CORAL.orange), sink: 1 },
    { pc: tubeSponge(CORAL.gold), sink: 1 },
  ];
  S.shells = [
    mk(8, 7, (pc) => { for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) { const dx = (x + 0.5 - 4) / 4, dy = (6 - y) / 5.5; if (dx * dx + dy * dy <= 1) pc.px(x, y, x % 2 ? '#f0a0a8' : '#ffd8d0'); } pc.rect(2, 5, 4, 2, '#d07a88'); }),
    mk(9, 6, (pc) => { pc.ellipse(4.5, 3, 4.2, 2.6, '#f4d8b0'); pc.ring(3.5, 3, 1.6, '#c08a60'); pc.px(3, 3, '#a06a48'); pc.rect(6, 2, 2, 3, '#ff9a9a'); pc.px(8, 3, '#f4d8b0'); }),
    mk(6, 4, (pc) => { pc.ellipse(3, 2, 2.8, 1.8, '#e8c890'); pc.px(1, 1, '#8a5a3a'); pc.px(3, 0, '#8a5a3a'); pc.px(4, 2, '#8a5a3a'); pc.hline(1, 3, 4, '#6a4a2a'); }),
    mk(7, 5, (pc) => { pc.ellipse(3.5, 2.5, 3.2, 2.2, '#efe6d6'); pc.px(3, 1, '#b8a890'); pc.px(2, 2, '#b8a890'); pc.px(4, 2, '#b8a890'); pc.px(3, 3, '#b8a890'); }),
  ];
  S.stars = [
    { md: '#f08a3a', lt: '#ffc070', hi: '#fff0c0' }, { md: '#e86a9a', lt: '#ffa8c8', hi: '#fff0f8' }, { md: '#9a6ad0', lt: '#c8a0f0', hi: '#ffffff' },
  ].map(starfish);
  S.toys = [
    { sink: 3, pc: mk(11, 10, (pc) => { // patinho de borracha desbotado
      pc.ellipse(5, 6.5, 4.6, 3, '#e8c84a'); pc.circle(7.5, 3, 2.3, '#e8c84a'); pc.hline(2, 5, 4, '#fae07a');
      pc.rect(9, 3, 2, 1, '#ff8a3a'); pc.px(8, 2, '#101018'); pc.px(3, 8, '#7aa86a'); pc.px(5, 9, '#7aa86a'); pc.px(1, 6, '#c8a83a');
    }) },
    { sink: 3, pc: mk(17, 15, (pc) => { // barquinho de brinquedo tombado
      pc.poly([[1, 9], [15, 7], [13, 13], [3, 14]], '#d0544c'); pc.line(2, 10, 14, 8, '#fbf2da'); pc.line(3, 12, 13, 11, '#a03c3c');
      pc.line(8, 8, 6, 1, '#8a5a32'); pc.poly([[6, 1], [12, 6], [7, 7]], '#efe6d0'); pc.px(9, 5, '#c8b898'); pc.px(13, 12, '#4a8a6a');
    }) },
    { sink: 2, pc: mk(16, 10, (pc) => { // submarino amarelo
      pc.ellipse(8, 6, 7, 3.2, '#f0c040'); pc.hline(3, 4, 9, '#f8e080'); pc.rect(6, 1, 3, 3, '#e0a830'); pc.px(8, 0, '#a8822e');
      pc.circle(5.5, 6, 1.2, '#2a8a9a'); pc.circle(9.5, 6, 1.2, '#2a8a9a'); pc.px(5, 5, '#c8fff8'); pc.px(9, 5, '#c8fff8'); pc.vline(15, 4, 4, '#8a8a90');
    }) },
    { sink: 3, pc: mk(11, 11, (pc) => { // baldinho com pá
      pc.poly([[1, 3], [9, 3], [8, 10], [2, 10]], '#d84a5a'); pc.hline(1, 3, 9, '#ff8a8a'); pc.vline(2, 4, 6, '#ff8a8a');
      pc.ellipseOutline(5, 3, 4, 3, '#c0b8a8'); pc.line(8, 1, 10, 9, '#4a8ad0'); pc.rect(9, 8, 2, 3, '#4a8ad0');
    }) },
    { sink: 2, pc: mk(12, 9, (pc) => { // peixinho de corda (lata)
      pc.ellipse(5, 5, 4.5, 2.6, '#4a9ad0'); pc.poly([[9, 5], [11, 2], [11, 8]], '#2a6aa0'); pc.px(2, 4, '#101018');
      pc.hline(4, 4, 3, '#a8d8f0'); pc.vline(6, 0, 3, '#c8c0b0'); pc.hline(5, 0, 3, '#c8c0b0'); pc.px(4, 6, '#d84a5a'); pc.px(6, 6, '#d84a5a');
    }) },
    { sink: 2, pc: mk(9, 9, (pc) => { // bloquinho de letra
      pc.rect(0, 1, 8, 8, '#4a7ec8'); pc.hline(0, 1, 8, '#7aa8e8'); pc.vline(0, 1, 8, '#7aa8e8');
      pc.ascii(['.###.', '#...#', '#####', '#...#', '#...#'], { '#': '#f4ecd8' }, 2, 3); pc.px(7, 8, '#3a8a6a');
    }) },
  ];
  S.anchor = mk(15, 19, (pc) => {
    const R = '#9a5a44', RL = '#c88a6a', RD = '#6a3a2e';
    pc.ring(7, 2.5, 2, R); pc.rect(6, 4, 3, 12, R); pc.vline(6, 4, 12, RL); pc.hline(3, 6, 9, R); pc.hline(3, 6, 4, RL);
    pc.curve(1, 12, 4, 18, 7, 17, R, 1); pc.curve(13, 12, 10, 18, 7, 17, R, 1);
    pc.tri(0, 13, 3, 10, 3, 14, RD); pc.tri(14, 13, 11, 10, 11, 14, RD); pc.px(8, 9, '#4a8a6a'); pc.px(6, 13, '#4a8a6a');
  });
  S.mast = mk(30, 64, (pc) => {
    pc.thickLine(16, 63, 12, 6, 1.3, '#7a5030'); pc.line(15, 63, 11, 6, '#a87448');
    pc.poly([[10, 6], [14, 3], [13, 8]], '#5a3a22'); // ponta quebrada
    pc.thickLine(3, 17, 25, 13, 0.8, '#6a4428');
    pc.poly([[4, 18], [24, 14], [22, 30], [17, 27], [14, 33], [9, 28], [5, 31]], '#e4dcc4');
    pc.line(5, 19, 23, 16, '#fff8e8'); pc.rect(10, 21, 4, 3, '#c8504a'); pc.px(18, 22, '#b8b098'); pc.px(7, 26, '#b8b098');
    pc.line(3, 17, 14, 62, '#c8b078'); pc.line(25, 13, 18, 62, '#c8b078');
    pc.rect(12, 40, 3, 2, '#d8c090'); pc.px(13, 44, '#4a8a6a'); pc.px(14, 50, '#4a8a6a'); pc.px(13, 51, '#3a7a5a');
  });
  S.coins = mk(13, 6, (pc) => {
    pc.ellipse(6.5, 4.5, 6, 2.6, '#c89a2a'); pc.ellipse(6, 3.5, 4.5, 1.8, '#f0c840');
    pc.px(3, 3, '#fff4b0'); pc.px(7, 2, '#fff4b0'); pc.px(9, 4, '#a8801e'); pc.px(5, 4, '#a8801e'); pc.px(11, 4, '#e8c040'); pc.px(1, 4, '#e8c040');
  });
  S.chest = mk(15, 13, (pc) => {
    pc.rect(1, 6, 13, 7, '#7a4a2a'); pc.hline(1, 6, 13, '#a86a3a'); pc.vline(4, 6, 7, '#d8a840'); pc.vline(10, 6, 7, '#d8a840');
    pc.ellipse(7.5, 6, 5.5, 1.5, '#f0c840'); pc.px(5, 5, '#fff4b0'); pc.px(9, 6, '#fff4b0');
    pc.poly([[1, 6], [3, 0], [14, 1], [14, 6]], '#8a5432'); pc.line(3, 1, 13, 2, '#b87a48'); pc.vline(8, 1, 5, '#d8a840');
    pc.rect(6, 8, 3, 2, '#e8c040'); pc.px(13, 12, '#4a8a6a');
  });
  S.glyph = GLYPHS.map((g) => mk(9, 9, (pc) => {
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (g[y][x] === '#') {
      pc.px(x + 2, y + 2, '#8ffcf0');
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pc.px(x + 2 + ox, y + 2 + oy, '#5ff8f030');
    }
  }, null));
  return S;
}
let SPR = null;

// ------------------------------------------------------------------ animações de decoração
function kelpAnim(fr, x, y, ph) {
  return (ctx, t) => { ctx.drawImage(fr[Math.floor((t / 3.4 + ph) * KNF) % KNF].canvas, x, y); };
}
function anemAnim(A, x, y, ph) {
  return (ctx, t) => {
    const p = 0.5 + 0.5 * Math.sin(t * 1.7 + ph);
    ctx.globalAlpha = 0.5 + 0.5 * p;
    ctx.drawImage(A.halo.canvas, x + 10 - 16, y + 7 - 16);
    ctx.globalAlpha = 1;
    ctx.drawImage(A.fr[Math.floor(t * 3 + ph) % 4].canvas, x, y);
    ctx.fillStyle = A.glow;
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.3 + ph + i * 0.33) % 1;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillRect(Math.round(x + 5 + i * 5 + Math.sin(t * 2 + i + ph) * 2), Math.round(y + 3 - k * 20), 1, 1);
    }
    ctx.globalAlpha = 1;
  };
}
function ventAnim(mx, my, ph) {
  return (ctx, t) => {
    const p = 0.5 + 0.5 * Math.sin(t * 3.1 + ph);
    ctx.globalAlpha = 0.35 + 0.45 * p;
    ctx.drawImage(SPR.ventGlow.canvas, mx - 8, my - 7);
    for (let i = 0; i < 7; i++) {
      const k = (t * 0.55 + i / 7 + ph) % 1;
      const s = k < 0.3 ? 0 : k < 0.7 ? 1 : 2;
      ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 0.9;
      ctx.drawImage(SPR.bub[s].canvas, Math.round(mx - s - 1 + Math.sin(k * 9 + i * 2 + t) * (1 + k * 3)), Math.round(my - 3 - k * 72));
    }
    ctx.globalAlpha = 1;
  };
}
function bubbleCol(x, y, span, ph) {
  return (ctx, t) => {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.35 + i / 3 + ph) % 1;
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 0.8;
      ctx.drawImage(SPR.bub[i === 1 ? 1 : 0].canvas, Math.round(x + Math.sin(t * 2.4 + i * 2) * 1.5), Math.round(y - k * span));
    }
    ctx.globalAlpha = 1;
  };
}
function crabAnim(x, y, ph) {
  return (ctx, t) => {
    const u = (t * 0.22 + ph) % 4;
    let off = 0, walking = false;
    if (u < 1) { off = u * 14; walking = true; } else if (u < 2) off = 14; else if (u < 3) { off = 14 - (u - 2) * 14; walking = true; }
    const fu = u % 1;
    const f = walking ? Math.floor(t * 9) % 2 : (fu > 0.35 && fu < 0.5) || (fu > 0.6 && fu < 0.75) ? 2 : 0;
    ctx.drawImage(SPR.crab[f].canvas, Math.round(x + off), y);
  };
}
function clamAnim(x, y, ph) {
  return (ctx, t) => {
    const u = (t * 0.16 + ph) % 1;
    const f = u < 0.35 ? 0 : u < 0.42 ? 1 : u < 0.86 ? 2 : u < 0.93 ? 1 : 0;
    ctx.drawImage(SPR.clam[f].canvas, x, y);
    if (f === 2) {
      const s = (t * 1.3 + ph * 7) % 2;
      if (s < 0.4) { ctx.globalAlpha = 1 - Math.abs(s - 0.2) / 0.2; ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y + 4, 1, 1); ctx.fillRect(x + 3, y + 5, 3, 1); ctx.fillRect(x + 4, y + 3, 1, 3); ctx.globalAlpha = 1; }
    }
  };
}
function fishAnim(x0, y0, n, pal, ph, range) {
  const r = lrng((ph * 1e6) | 0);
  const fish = [];
  for (let i = 0; i < n; i++) fish.push({ ox: r.int(-9, 9), oy: r.int(-5, 5), p: r() * TAU, dl: r() * 0.08 });
  const sd = (ph * 1000) | 0;
  return (ctx, t) => {
    const u = t / 2.3 + ph, seg = Math.floor(u), fr = u - seg;
    const pA = (h2(seg, 7, sd) - 0.5) * range, pB = (h2(seg + 1, 7, sd) - 0.5) * range;
    const right = pB >= pA;
    const cy = y0 + Math.sin(t * 0.7 + ph) * 4;
    for (const f of fish) {
      const q = clamp((fr - f.dl) / 0.22, 0, 1);
      const e = 1 - (1 - q) * (1 - q) * (1 - q);
      const fx = x0 + pA + (pB - pA) * e + f.ox + Math.sin(t * 2.1 + f.p) * 1.5;
      const fy = cy + f.oy + Math.sin(t * 1.7 + f.p * 2) * 1.2;
      ctx.drawImage(SPR.fish[pal][right ? 0 : 1].canvas, Math.round(fx), Math.round(fy));
    }
  };
}
function glyphAnim(spr, x, y, ph) {
  return (ctx, t) => {
    const p = 0.5 + 0.5 * Math.sin(t * 1.2 + ph);
    ctx.globalAlpha = 0.15 + 0.6 * p * p;
    ctx.drawImage(spr.canvas, x, y);
    ctx.globalAlpha = 1;
  };
}
function sparkleAnim(x, y, w, ph) {
  return (ctx, t) => {
    ctx.fillStyle = '#fff4b0';
    for (let i = 0; i < 2; i++) {
      const s = (t * 0.9 + ph + i * 0.5) % 1.6;
      if (s > 0.35) continue;
      const a = 1 - Math.abs(s - 0.17) / 0.17;
      const sx = x + Math.round(h2(Math.floor(t * 0.9 + ph + i * 0.5), i, 5) * w), sy = y + i * 2;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillRect(sx, sy, 1, 1);
      if (a > 0.5) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
    }
    ctx.globalAlpha = 1;
  };
}
function grassRunAnim(items, y) {
  return (ctx, t) => {
    for (const [x, ph] of items) {
      const s = Math.sin(t * 1.5 - x * 0.03 + ph) + 0.5 * Math.sin(t * 0.6 + x * 0.011);
      ctx.drawImage(SPR.fgrass[s < -0.5 ? 0 : s > 0.5 ? 2 : 1].canvas, x, y);
    }
  };
}
// corda pendurada do teto, com nós (estática)
function paintRope(pc, x, y, len, seed) {
  const sway = (h2(seed, 1) - 0.5) * 6;
  for (let k = 0; k < len; k++) {
    const xx = Math.round(x + sway * Math.sin((k / len) * Math.PI * 0.5));
    pc.px(xx, y + k, (k & 2) ? '#a88a58' : '#e0c890'); pc.px(xx + 1, y + k, '#6a5434');
  }
  const ex = Math.round(x + sway);
  pc.rect(ex - 1, y + len, 3, 2, '#e0c890'); pc.px(ex - 1, y + len + 2, '#a88a58'); pc.px(ex + 1, y + len + 3, '#a88a58');
  if (h2(seed, 2) < 0.5) { pc.ring(ex + 0.5, y + len + 6, 2.4, '#d0544c'); pc.px(ex - 1, y + len + 4, '#ff8a8a'); }
}
// algas penduradas do teto (estáticas)
function paintHang(pc, x, y, seed) {
  const r = lrng(seed);
  const n = r.int(1, 3);
  for (let i = 0; i < n; i++) {
    const sx = x + r.int(1, 14), len = r.int(4, 14), cols = r() < 0.3 ? ['#b8a04a', '#8a7a3a'] : ['#4aa078', '#2e7a5e'];
    for (let k = 0; k < len; k++) {
      const xx = sx + Math.round(Math.sin(k * 0.5 + i) * 0.8);
      pc.px(xx, y + k, k === len - 1 ? cols[1] : cols[0]);
      if (k % 3 === 1) pc.px(xx + ((k >> 1) & 1 ? 1 : -1), y + k, cols[1]);
    }
  }
}

// ------------------------------------------------------------------ decorate
function decorate(map, rng, data) {
  if (!SPR) SPR = buildSprites();
  waterTod = data?.timeOfDay || 'day';
  curRows = data?.map || null;
  const out = [];
  const rows = data?.map || [];
  // --- camada de paredes de fundo (parede ':' e água/ar cobertos por rocha/casco),
  // assada em blocos de 16×16 tiles e desenhada ANTES de toda a decoração animada.
  const WI = w2WaterInfo(map, rows);
  const BS = 16;
  for (let by = 0; by < map.rows; by += BS) for (let bx = 0; bx < map.cols; bx += BS) {
    let pc = null;
    for (let ty = by; ty < Math.min(map.rows, by + BS); ty++) for (let tx = bx; tx < Math.min(map.cols, bx + BS); tx++) {
      const st = WI.cover[ty * map.cols + tx];
      if (!st) continue;
      if (!pc) pc = new PixelCanvas(BS * 16, BS * 16);
      const info = { tx, ty, map };
      if (st === 2) drawHullWall(pc, (tx - bx) * 16, (ty - by) * 16, info);
      else drawRuinWall(pc, (tx - bx) * 16, (ty - by) * 16, null, null, info);
    }
    if (!pc) continue;
    pc.flush();
    const cv = pc.canvas, X = bx * 16, Y = by * 16;
    out.push({ x: X, y: Y, w: BS * 16, h: BS * 16, layer: 'back', anim: (ctx) => ctx.drawImage(cv, X, Y) });
  }
  const chAt = (tx, ty) => (rows[ty] && rows[ty][tx]) || '.';
  const free = (tx, ty) => {
    const t = map.get(tx, ty), ch = chAt(tx, ty);
    return (t === T.EMPTY || t === T.BG || t === T.WATER) && (ch === '.' || ch === '~' || ch === ':');
  };
  const surf = (tx, ty) => { const t = map.get(tx, ty); return (t === T.SOLID || t === T.ALT) && free(tx, ty - 1); };
  const room = (tx, ty, max) => { let k = 0; while (k < max && free(tx, ty - 1 - k)) k++; return k; };
  const downRoom = (tx, ty, max) => { let k = 0; while (k < max && free(tx, ty + 1 + k)) k++; return k; };
  const bgInside = (tx, ty) => {
    let i = tx; while (map.get(i, ty) === T.WATER && i > -2) i--; if (map.get(i, ty) === T.BG) return true;
    i = tx; while (map.get(i, ty) === T.WATER && i < map.cols + 1) i++; if (map.get(i, ty) === T.BG) return true;
    let j = ty; while (map.get(tx, j) === T.WATER && j > -2) j--; return map.get(tx, j) === T.BG;
  };
  let run = null;
  const flush = () => {
    if (run && run.items.length) { const q = run; out.push({ x: q.x0 - 4, y: q.y - 2, w: q.x1 - q.x0 + 26, h: 14, layer: 'front', anim: grassRunAnim(q.items, q.y) }); }
    run = null;
  };
  for (let ty = 1; ty < map.rows; ty++) {
    let lastAnim = -99, lastBig = -99, lastFish = -99, lastGlyph = -99;
    flush();
    for (let tx = 0; tx < map.cols; tx++) {
      const t = map.get(tx, ty);
      const wx = tx * 16, wy = ty * 16;
      const seed = (tx * 92821 + ty * 68917) >>> 0;
      if (surf(tx, ty)) {
        const up = map.get(tx, ty - 1);
        const wet = up === T.WATER, inside = WI.cover[(ty - 1) * map.cols + tx] > 0;
        const layer = 'back';
        const rm = room(tx, ty, 6);
        const wide = surf(tx - 1, ty) && surf(tx + 1, ty);
        const isHull = t === T.ALT;
        const r = rng();
        const pk = isHull ? 0 : wet ? 0.26 : 0.1;
        if (r < pk && tx - lastAnim > 1 && rm >= 2) { // alga gigante (kelp)
          lastAnim = tx;
          const maxH = rm * 16 - 6;
          const opts = KELP_H.map((H, i) => i).filter((i) => KELP_H[i] <= maxH);
          const hi = opts[rng.int(0, opts.length - 1)], pi = rng.int(0, KELP_P.length - 1), H = KELP_H[hi];
          const x = wx - 4 + rng.int(-3, 3), y = wy - H;
          out.push({ x, y, w: 24, h: H + 3, layer: 'back', anim: kelpAnim(SPR.kelp[pi][hi], x, y, x * 0.004 + rng() * 0.3) });
        } else if (r < pk + 0.055 && tx - lastAnim > 3) { // anêmona luminosa
          lastAnim = tx;
          const A = SPR.anem[rng.int(0, SPR.anem.length - 1)];
          const x = wx - 2 + rng.int(0, 2), y = wy - 16;
          out.push({ x, y, w: 20, h: 17, layer, anim: anemAnim(A, x, y, rng() * 6), light: { r: 30, color: A.glow, i: 0.6, flicker: 0.15 } });
        } else if (r < pk + 0.08 && tx - lastBig > 8 && rm >= 3 && !isHull) { // fonte hidrotermal de bolhas
          lastBig = tx;
          const vx = wx + 1;
          out.push({ x: vx, y: wy - 15, w: 14, h: 16, layer: 'back', paint: (pc) => pc.blit(SPR.vent, vx, wy - 14) });
          out.push({ x: vx, y: wy - 22, w: 14, h: 16, layer: 'back', anim: ventAnim(vx + 7, wy - 12, rng() * 5), light: { r: 26, color: '#ffa860', i: 0.5, flicker: 0.4 } });
        } else if (r < pk + 0.115 && wide && tx - lastAnim > 3) { // caranguejo andando
          lastAnim = tx;
          const x = wx + rng.int(-2, 2), y = wy - 9;
          out.push({ x: x - 2, y, w: 32, h: 10, layer, anim: crabAnim(x, y, rng() * 4) });
        } else if (r < pk + 0.135 && tx - lastAnim > 3) { // marisco que abre (pérola)
          lastAnim = tx;
          const x = wx + rng.int(1, 4), y = wy - 8;
          out.push({ x, y, w: 12, h: 9, layer, anim: clamAnim(x, y, rng()) });
        } else if (r < pk + 0.21 && tx - lastBig > 3 && rm >= 2 && !isHull) { // coral grande
          lastBig = tx;
          const c = SPR.corals[rng.int(0, SPR.corals.length - 1)];
          const flip = rng() < 0.5;
          const x = wx + 8 - (c.pc.w >> 1) + rng.int(-3, 3), y = wy - c.pc.h + c.sink;
          out.push({ x, y, w: c.pc.w, h: c.pc.h, layer, paint: (pc) => pc.blit(c.pc, x, y, { flipX: flip }) });
        } else if (r < pk + 0.25 && wide && tx - lastBig > 5) { // brinquedo afundado
          lastBig = tx;
          const toy = SPR.toys[rng.int(0, SPR.toys.length - 1)];
          const flip = rng() < 0.5;
          const x = wx + rng.int(-2, 16 - toy.pc.w + 2), y = wy - toy.pc.h + toy.sink;
          out.push({ x, y, w: toy.pc.w, h: toy.pc.h, layer, paint: (pc) => pc.blit(toy.pc, x, y, { flipX: flip }) });
        } else if (r < pk + 0.28 && wide && tx - lastBig > 10 && !isHull) { // mastro quebrado ou âncora
          lastBig = tx;
          if (rm >= 4 && rng() < 0.55) {
            const flip = rng() < 0.5, x = wx - 7, y = wy - 60;
            out.push({ x, y, w: 30, h: 64, layer: 'back', paint: (pc) => pc.blit(SPR.mast, x, y, { flipX: flip }) });
          } else {
            const x = wx, y = wy - 14;
            out.push({ x: x - 12, y, w: 28, h: 19, layer, paint: (pc) => {
              pc.blit(SPR.anchor, x, y);
              for (let i = 0; i < 4; i++) { pc.ellipseOutline(x - 2 - i * 3, wy - 1 - (i & 1), 1.5, 1, '#6a3a2e'); }
            } });
          }
        } else if (r < pk + 0.3 && wide) { // tesouro
          const chest = rng() < 0.4;
          const spr = chest ? SPR.chest : SPR.coins;
          const x = wx + rng.int(0, 16 - spr.w), y = wy - spr.h + (chest ? 2 : 1);
          out.push({ x, y, w: spr.w, h: spr.h, layer, paint: (pc) => pc.blit(spr, x, y) });
          out.push({ x, y: y - 2, w: spr.w, h: 6, layer, anim: sparkleAnim(x + 1, y + (chest ? 3 : 1), spr.w - 2, rng() * 3), light: chest ? { r: 18, color: '#ffd860', i: 0.4, flicker: 0.2 } : undefined });
        } else if (r < pk + 0.46) { // conchas / estrelas-do-mar
          const k = rng();
          const spr = k < 0.45 ? SPR.shells[rng.int(0, SPR.shells.length - 1)] : SPR.stars[rng.int(0, SPR.stars.length - 1)];
          const flip = rng() < 0.5;
          const x = wx + rng.int(0, 16 - spr.w), y = wy - spr.h + (k < 0.45 ? 1 : 3);
          out.push({ x, y, w: spr.w, h: spr.h, layer, paint: (pc) => pc.blit(spr, x, y, { flipX: flip }) });
        }
        // cardume que dispara
        if (rm >= 4 && tx - lastFish > 12 && rng() < 0.14) {
          lastFish = tx;
          const x0 = wx + 8, y0 = wy - 16 * rng.int(2, rm - 1);
          out.push({ x: x0 - 34, y: y0 - 10, w: 70, h: 22, layer: 'back', anim: fishAnim(x0, y0, rng.int(3, 6), rng.int(0, SPR.fish.length - 1), rng() * 10, 44) });
        }
        // bolhinhas subindo do leito submerso
        if (wet && rng() < 0.08) {
          const sp = room(tx, ty, 8) * 16;
          out.push({ x: wx + 4, y: wy - sp, w: 8, h: sp, layer: 'back', anim: bubbleCol(wx + rng.int(3, 11), wy - 4, sp - 8, rng()) });
        }
        // capim-marinho na frente (balança)
        if (!wet && !inside && !isHull) {
          if (!run || tx - run.tx0 >= 10) { flush(); run = { items: [], y: wy - 9, x0: wx, x1: wx, tx0: tx }; }
          if (rng() < 0.38) run.items.push([wx + rng.int(-2, 2), rng() * 6]);
          run.x1 = wx;
        } else flush();
      } else if (run) flush();
      // teto: cordas e algas penduradas
      if ((t === T.SOLID || t === T.ALT) && free(tx, ty + 1) && ty + 1 < map.rows) {
        const rr = rng();
        if (rr < 0.07 && downRoom(tx, ty, 4) >= 3) {
          const len = rng.int(14, 34);
          out.push({ x: wx, y: wy + 16, w: 16, h: len + 10, layer: 'back', paint: (pc) => paintRope(pc, wx + 7, wy + 16, len, seed) });
        } else if (rr < 0.4) {
          out.push({ x: wx, y: wy + 16, w: 18, h: 16, layer: 'back', paint: (pc) => paintHang(pc, wx, wy + 16, seed ^ 0x99) });
        }
      }
      // glifos que pulsam na parede de fundo
      if (t === T.BG && tx - lastGlyph > 4 && rng() < 0.05) {
        lastGlyph = tx;
        const spr = SPR.glyph[rng.int(0, SPR.glyph.length - 1)];
        const x = wx + rng.int(1, 6), y = wy + rng.int(1, 6);
        out.push({ x, y, w: 9, h: 9, layer: 'back', anim: glyphAnim(spr, x, y, rng() * 6), light: { r: 16, color: '#5ff8f0', i: 0.35, flicker: 0.1 } });
      }
    }
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ registro
registerTileset('w2', {
  skyColor: '#0a3a6a',
  solid: drawSeabed,
  alt: drawHull,
  oneway: drawShelf,
  spike: drawSpike,
  bg() {}, // paredes de fundo: camada própria em decorate() (permite decoração por cima)
  water: { body: '#2a90c6', top: '#a8f4f4', deep: '#103a72', highlight: '#ffffff', alpha: 0.6 },
  drawWater,
  decorate,
});

// ------------------------------------------------------------------ fase-vitrine (?level=test_w2v)
function showcaseMap() {
  const W = 90, H = 40;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const R = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < W) g[j][i] = c; };
  R(0, 33, W, 7, '#');                                     // leito
  R(0, 6, 3, 27, '#'); R(3, 8, 7, 2, '#');                 // paredão + teto (algas/cordas)
  R(10, 28, 12, 2, '%'); R(11, 30, 10, 1, '%'); R(12, 31, 8, 2, '%'); // casco do navio
  R(11, 24, 10, 1, '=');                                   // convés/coral
  R(24, 33, 20, 6, '~'); R(30, 37, 3, 2, '#'); R(38, 38, 2, 1, '^'); // grande poça submersa
  R(27, 29, 4, 1, '='); R(35, 27, 5, 1, '=');
  R(29, 11, 12, 2, '#'); R(30, 6, 10, 5, '~');             // aquário flutuante sobre ilha
  R(20, 17, 6, 2, '#');                                    // ilhota
  R(45, 32, 3, 1, '^');                                    // ouriços para cima
  R(50, 14, 12, 19, '#'); R(52, 17, 8, 14, ':'); R(50, 29, 2, 3, 'H'); // torre em ruínas + parede falsa
  R(53, 27, 4, 1, '='); R(55, 23, 4, 1, '='); R(52, 20, 3, 1, '='); R(57, 30, 2, 1, '^');
  R(56, 18, 3, 3, '~');                                    // bolsão dentro da ruína
  R(64, 16, 5, 4, '~');                                    // bolsão flutuante
  R(63, 22, 7, 2, '#'); R(64, 24, 5, 1, '^');              // ilha com ouriços para baixo
  R(73, 18, 2, 15, '#'); R(72, 23, 1, 3, '^'); R(75, 23, 1, 3, '^'); // pilar com espinhos ← →
  R(78, 29, 4, 1, '%'); R(79, 28, 3, 1, '%');              // destroço de casco
  R(82, 26, 6, 7, '#'); R(88, 6, 2, 27, '#');              // plataforma final + parede
  R(62, 8, 3, 6, '~');                                     // coluna de água suspensa
  g[32][5] = 'P'; g[25][85] = 'E'; g[32][22] = 'K';
  g[32][8] = 'o'; g[23][15] = 'o'; g[15][66] = 'o';
  g[5][35] = '*'; g[19][55] = '*'; g[21][66] = '*';
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w2v', world: 0, index: 0, name: 'Vitrine do Oceano', subtitle: 'Teste de arte',
  tileset: 'w2', background: 'w2', music: null, parTime: 120, darkness: 0,
  map: showcaseMap(),
});
