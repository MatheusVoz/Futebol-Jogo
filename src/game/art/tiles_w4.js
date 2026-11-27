// =============================================================================
// art/tiles_w4.js — Tileset do Mundo 4: O PESADELO DEBAIXO DA CAMA.
//
// Sólido: tábuas de assoalho GIGANTES em corte (escurecem com a profundidade),
// com pregos, veios e trechos de CARPETE felpudo com barra bordada (autotile).
// Alt (por aglomerado): MATELASSÊ de colchão (aglomerados largos e baixos),
// pilhas de LIVROS deitados ou BLOCOS de brinquedo com letras.
// Vazado: prateleiras com mão-francesa ou ripas de estrado de cama.
// Espinhos (4 direções, variante por trecho): pregos, cacos de vidro, dentes.
// Fundo (bg): papel de parede descascando, rodapé, sombra nos cantos.
// decorate(): gizes de cera, meias, bonecas, brinquedos, coelhinhos de poeira,
// teias de canto (estáticas); teias com aranhinha balançando, OLHOS que piscam
// nas frestas (só aparecem longe do jogador, com luz própria), luzes noturnas
// e abajures com poeira dourada (com luz), desenhos de criança nas paredes e
// móveis gigantes de fundo (silhuetas) que mudam com data.timeOfDay.
// Também registra a fase-vitrine 'test_w4v' (?level=test_w4v).
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
const solidLike = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;
/** Tipo com bordas: laterais e fundo contam como sólido, acima do mapa é vazio. */
function S(map, tx, ty) {
  if (ty >= map.rows) return T.SOLID;
  if (ty < 0) return T.EMPTY;
  if (tx < 0 || tx >= map.cols) return T.SOLID;
  return map.get(tx, ty);
}

// ------------------------------------------------------------------ paleta
const OUT = '#0b0914';
const WOOD = [ // [profundidade][tom da tábua]
  ['#7a6678', '#6c5a6c', '#887484'],
  ['#564658', '#4c3e50', '#605064'],
  ['#362c3e', '#302738', '#3e3346'],
  ['#1e1928', '#1a1623', '#231d2d'],
];
const WSEAM = ['#2e2434', '#221a2a', '#17121f', '#0f0c16'];
const GRAIN = ['#5e4c5e', '#403446', '#28202f', '#16121c'];
const NAILH = ['#aaa6c0', '#6e6a86', '#45425a'];
const RIM = ['#bca6ba', '#968098'];
const CAR = { hi: '#9e70b0', lt: '#7e5494', md: '#643e7a', dk: '#4a2a5e', sh: '#2a1838', st: '#aa6280', st2: '#c8a060' };
const WP = { a: '#2f2c4e', b: '#353259', line: '#403c6a', lineD: '#25223f', mot: '#4a467c', mot2: '#58528c', speck: '#27243f', ao: '#15132a', edge: '#1a1828', pl: '#4e4a60', plD: '#403a52', plC: '#34303f', back: '#8a84a2', backD: '#625c7c' };

// ------------------------------------------------------------------ sólido: assoalho / carpete
const carpetAt = (tx, ty) => h2(Math.floor(tx / 9), Math.floor(ty / 5), 77) < 0.42;
const surfAt = (map, tx, ty) => solidLike(S(map, tx, ty)) && !solidLike(S(map, tx, ty - 1));

function drawFloor(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const run = (dx, dy) => { let k = 0; while (k < 3 && solidLike(S(map, tx + dx * (k + 1), ty + dy * (k + 1)))) k++; return k; };
  const ku = run(0, -1), kd = run(0, 1), kl = run(-1, 0), kr = run(1, 0);
  const sl = (dx, dy) => solidLike(S(map, tx + dx, ty + dy));
  const n = { u: ku > 0, d: kd > 0, l: kl > 0, r: kr > 0, ul: sl(-1, -1), ur: sl(1, -1), dl: sl(-1, 1), dr: sl(1, 1) };
  const carpet = !n.u && carpetAt(tx, ty);
  const carL = carpet && !(surfAt(map, tx - 1, ty) && carpetAt(tx - 1, ty));
  const carR = carpet && !(surfAt(map, tx + 1, ty) && carpetAt(tx + 1, ty));
  for (let ly = 0; ly < 16; ly++) {
    const wy = ty * 16 + ly, band = wy >> 3, r = wy & 7;
    const L = 40 + ((h2(band, 1) * 24) | 0), off = (h2(band, 2) * L) | 0;
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      // profundidade (distância até o ar) -> 4 níveis com pontilhado
      let d = 99;
      if (ku < 3) d = Math.min(d, ku * 16 + ly);
      if (kd < 3) d = Math.min(d, kd * 16 + 15 - ly + 6);
      if (kl < 3) d = Math.min(d, kl * 16 + lx + 2);
      if (kr < 3) d = Math.min(d, kr * 16 + 15 - lx + 2);
      if (n.u && n.l && !n.ul) d = Math.min(d, Math.hypot(lx + 0.5, ly + 0.5));
      if (n.u && n.r && !n.ur) d = Math.min(d, Math.hypot(15.5 - lx, ly + 0.5));
      if (n.d && n.l && !n.dl) d = Math.min(d, Math.hypot(lx + 0.5, 15.5 - ly) + 5);
      if (n.d && n.r && !n.dr) d = Math.min(d, Math.hypot(15.5 - lx, 15.5 - ly) + 5);
      const f = Math.max(0, Math.min(3, (d - 2) / 10));
      let lev = Math.floor(f);
      if (lev < 3 && f - lev > th(wx, wy)) lev++;
      // tábuas empilhadas com emendas desencontradas, pregos e veios
      const p = (wx + off) % L, id = ((wx + off) / L) | 0;
      let c = WOOD[lev][(h2(id, band, 3) * 3) | 0];
      if (r === 7 || p === 0) c = WSEAM[lev];
      else if (p === 1 || r === 0) c = WOOD[lev][2];
      else if ((p === 3 || p === L - 3) && (r === 2 || r === 5) && lev < 3) c = NAILH[lev];
      else if ((r === 3 || r === 5) && h2(((wx + band * 13) / 7) | 0, band * 8 + r, 7) < 0.14) c = GRAIN[lev];
      else if (h2(wx, wy, 11) < 0.03) c = GRAIN[lev];
      // superfície: borda iluminada pela lua ou carpete felpudo
      if (!n.u) {
        if (carpet && ly < 7) {
          const m = wx % 6;
          if (ly === 0) { if (h2(wx, ty, 31) < 0.4) continue; c = h2(wx, ty, 33) > 0.8 ? CAR.hi : CAR.lt; }
          else if (ly === 1) c = h2(wx, wy, 32) > 0.7 ? CAR.hi : CAR.lt;
          else if (ly === 2) c = (wx & 1) ? CAR.st : CAR.md;
          else if (ly === 3) c = m === 0 ? CAR.st2 : (m === 1 || m === 5) ? CAR.st : CAR.dk;
          else if (ly === 4) c = (wx & 1) ? CAR.md : CAR.st;
          else if (ly === 5) c = h2(wx, wy, 34) < 0.35 ? CAR.dk : CAR.md;
          else c = CAR.sh;
          if ((carL && lx < 2) || (carR && lx > 13)) { // franja do tapete
            const edge = carL ? lx === 0 : lx === 15;
            c = edge ? ((ly & 1) ? CAR.st2 : CAR.sh) : CAR.dk;
          }
        } else if (ly === 0) c = RIM[0];
        else if (ly === 1) c = RIM[1];
      }
      // contornos das faces expostas
      if (!n.l && lx === 0) c = OUT;
      else if (!n.l && lx === 1 && !(carpet && ly < 7)) c = WOOD[Math.max(0, lev - 1)][2];
      if (!n.r && lx === 15) c = OUT;
      else if (!n.r && lx === 14) c = WSEAM[lev];
      if (!n.d && ty < map.rows - 1) { if (ly === 15) c = OUT; else if (ly === 14) c = WSEAM[3]; }
      // cantos arredondados
      if ((!n.u && !n.l && lx + ly < 1) || (!n.u && !n.r && 15 - lx + ly < 1)) continue;
      if (!n.d && ty < map.rows - 1 && ((!n.l && lx + 15 - ly < 1) || (!n.r && 30 - lx - ly < 1))) continue;
      pc.px(x + lx, y + ly, c);
    }
  }
}

// ------------------------------------------------------------------ alt: colchão / livros / blocos
const altCache = new WeakMap();
/** Classifica cada aglomerado de '%' uma vez por mapa: 0 blocos, 1 livros, 2 colchão. */
function altKinds(map) {
  let v = altCache.get(map);
  if (v) return v;
  const W = map.cols, H = map.rows;
  v = new Int8Array(W * H).fill(-1);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (map.get(i, j) !== T.ALT || v[j * W + i] >= 0) continue;
    const cells = [[i, j]]; v[j * W + i] = 9;
    let x0 = i, x1 = i, y0 = j, y1 = j;
    for (let k = 0; k < cells.length; k++) {
      const [a, b] = cells[k];
      x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const na = a + dx, nb = b + dy;
        if (na < 0 || nb < 0 || na >= W || nb >= H || v[nb * W + na] >= 0 || map.get(na, nb) !== T.ALT) continue;
        v[nb * W + na] = 9; cells.push([na, nb]);
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const kind = (bh <= 2 && bw >= 3) ? 2 : (bh >= bw * 2 || h2(i, j, 41) < 0.3) ? 1 : 0;
    for (const [a, b] of cells) v[b * W + a] = kind;
  }
  altCache.set(map, v);
  return v;
}
const GLY = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  Z: ['###', '..#', '.#.', '#..', '###'], moon: ['.##', '##.', '#..', '##.', '.##'], heart: ['#.#', '###', '###', '.#.', '...'],
  star: ['.#.', '###', '.#.', '#.#', '...'],
};
const GLY_K = Object.keys(GLY);
const BLOCK_COLS = [
  ['#9a4a5c', '#bc6a7c', '#682e40'], ['#3e5490', '#5a74b4', '#28366a'], ['#a08636', '#c4a856', '#6e561e'],
  ['#3a7672', '#58a09a', '#245250'], ['#74428a', '#9662aa', '#4c2a5e'],
];
function drawBlock(pc, x, y, info) {
  const { tx, ty } = info;
  const col = BLOCK_COLS[(h2(tx, ty, 42) * BLOCK_COLS.length) | 0];
  const g = GLY[GLY_K[(h2(tx, ty, 43) * GLY_K.length) | 0]];
  pc.rect(x, y, 16, 16, OUT);
  pc.rect(x + 1, y + 1, 14, 14, col[0]);
  pc.hline(x + 1, y + 1, 14, col[1]); pc.vline(x + 1, y + 1, 14, col[1]);
  pc.hline(x + 1, y + 14, 14, col[2]); pc.vline(x + 14, y + 1, 14, col[2]);
  pc.strokeRect(x + 3, y + 3, 10, 10, col[2]);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '#') {
    pc.rect(x + 6 + i * 2, y + 4 + j * 2, 2, 2, '#3a2a30');
    pc.rect(x + 5 + i * 2, y + 3 + j * 2, 2, 2, '#e0d4b8');
  }
  // lascas e desgaste
  if (h2(tx, ty, 44) < 0.5) { pc.px(x + 1, y + 1, OUT); pc.px(x + 2, y + 1, col[2]); }
  if (h2(tx, ty, 45) < 0.4) { pc.px(x + 14, y + 14, OUT); pc.px(x + 13, y + 14, OUT); }
  for (let k = 0; k < 4; k++) pc.px(x + 2 + ((h2(tx, ty, 46 + k) * 12) | 0), y + 9 + ((h2(tx, ty, 50 + k) * 5) | 0), col[2]);
}
const BOOK_COLS = [
  ['#7a3040', '#9a4a58', '#4e1c2a'], ['#2e3e6e', '#46588e', '#1c2648'], ['#6e5a28', '#8e7838', '#463812'],
  ['#2e5a50', '#457a6c', '#1a3a32'], ['#5a3468', '#7a4a8a', '#3a1e46'], ['#5e5e70', '#80809a', '#3a3a4a'],
];
function drawBooks(pc, x, y, n, info) {
  const { tx, ty, map } = info;
  const alt = (dx, dy) => S(map, tx + dx, ty + dy) === T.ALT;
  for (let ly = 0; ly < 16; ly++) {
    const wy = ty * 16 + ly, band = wy >> 3, r = wy & 7;
    const L = 18 + ((h2(band, 51) * 18) | 0), off = (h2(band, 52) * L) | 0;
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, p = (wx + off) % L, id = ((wx + off) / L) | 0;
      const col = BOOK_COLS[(h2(id, band, 53) * 6) | 0];
      let c = col[0];
      if (r === 7 || p === 0) c = OUT;
      else if (r === 0 || p === 1) c = col[1];
      else if (r === 6 || p === L - 1) c = col[2];
      else if (p === 3 || p === L - 4) c = h2(id, band, 54) < 0.6 ? '#a88c50' : col[2];
      else if (r === 4 && Math.abs(p - L / 2) < 4 && (p & 1)) c = '#d0c09a';
      if ((!alt(-1, 0) && lx === 0) || (!alt(1, 0) && lx === 15) || (!alt(0, -1) && ly === 0)) c = OUT;
      pc.px(x + lx, y + ly, c);
    }
  }
}
const MAT = { hi: '#aab2ce', lt: '#8e96b6', md: '#747c9e', dk: '#585e80', sh: '#3c4060', st: '#5c6288', btn: '#cfd2e6', pipe: '#9ea6c6' };
function drawMattress(pc, x, y, info) {
  const { tx, ty, map } = info;
  const a = (dx, dy) => S(map, tx + dx, ty + dy) === T.ALT;
  const eu = !a(0, -1), ed = !a(0, 1), el = !a(-1, 0), er = !a(1, 0);
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    const u = (wx + wy) % 12, v = ((wx - wy) % 12 + 12) % 12;
    const k = Math.min(u, 12 - u, v, 12 - v) / 3; // estofado: claro no centro do losango
    let c = k > 1.2 ? MAT.lt : k > 0.6 ? MAT.md : MAT.dk;
    if (k > 1.6 && th(wx, wy) < 0.5) c = MAT.hi;
    if ((u === 0 || v === 0) && (wy & 1)) c = MAT.st;
    if (u === 0 && v === 0) c = MAT.btn;
    if (eu) { if (ly === 0) c = OUT; else if (ly === 1) c = MAT.pipe; else if (ly === 2) c = MAT.hi; else if (ly === 4 && (wx & 1)) c = MAT.st; }
    if (ed) { if (ly === 15) c = OUT; else if (ly === 14) c = MAT.sh; else if (ly === 13) c = MAT.dk; else if (ly === 11 && (wx & 1)) c = MAT.st; }
    if (el) { if (lx === 0) c = OUT; else if (lx === 1) c = MAT.pipe; }
    if (er) { if (lx === 15) c = OUT; else if (lx === 14) c = MAT.sh; }
    // cantos arredondados
    const cor = (cx, cy) => cx + cy;
    if ((eu && el && cor(lx, ly) < 2) || (eu && er && cor(15 - lx, ly) < 2) || (ed && el && cor(lx, 15 - ly) < 2) || (ed && er && cor(15 - lx, 15 - ly) < 2)) continue;
    if ((eu && el && cor(lx, ly) === 2) || (eu && er && cor(15 - lx, ly) === 2) || (ed && el && cor(lx, 15 - ly) === 2) || (ed && er && cor(15 - lx, 15 - ly) === 2)) c = OUT;
    pc.px(x + lx, y + ly, c);
  }
  // etiqueta "não remova" no canto de baixo
  if (ed && el) { pc.rect(x + 4, y + 12, 4, 4, '#d8d4e4'); pc.hline(x + 5, y + 13, 2, '#8a86a0'); pc.px(x + 4, y + 15, '#a8a4bc'); }
}
function drawAlt(pc, x, y, n, rng, info) {
  const k = altKinds(info.map)[info.ty * info.map.cols + info.tx];
  if (k === 2) drawMattress(pc, x, y, info);
  else if (k === 1) drawBooks(pc, x, y, n, info);
  else drawBlock(pc, x, y, info);
}

// ------------------------------------------------------------------ bg: papel de parede descascando
const MOT = [
  ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'], // lua
  ['...#...', '...#...', '.#####.', '..###..', '.##.##.', '.#...#.', '.......'], // estrela
  ['.......', '..#.#..', '.#####.', '.#####.', '..###..', '...#...', '.......'], // coração
];
/** Decor estático dos cômodos por mapa (preenchido por decorate, lido por drawWall). */
const ROOM_OVER = new WeakMap();
/** Pinta `paint` recortado ao tile (x,y) do canvas do pedaço; coords do decor são de mundo. */
function paintClipped(pc, x, y, tx, ty, paint) {
  const X0 = x + pc.ox, Y0 = y + pc.oy;
  const clip = Object.create(pc);
  clip.px = (px, py, c) => {
    const X = Math.floor(px + pc.ox), Y = Math.floor(py + pc.oy);
    if (X >= X0 && X < X0 + 16 && Y >= Y0 && Y < Y0 + 16) pc.px(px, py, c);
    return clip;
  };
  pc.translate(x - tx * 16, y - ty * 16);
  try { paint(clip); } catch (e) { /* decor com erro: ignora */ }
  pc.translate(tx * 16 - x, ty * 16 - y);
}
function drawWall(pc, x, y, n, rng, info) {
  drawWallBase(pc, x, y, n, rng, info);
  const list = ROOM_OVER.get(info.map);
  if (!list || !list.length) return;
  const wx = info.tx * 16, wy = info.ty * 16;
  for (const dd of list) {
    if (dd.x + (dd.w || 16) <= wx || dd.x >= wx + 16 || dd.y + (dd.h || 16) <= wy || dd.y >= wy + 16) continue;
    paintClipped(pc, x, y, info.tx, info.ty, dd.paint);
  }
}
function drawWallBase(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  const sol = (dx, dy) => solidLike(S(map, tx + dx, ty + dy));
  const su = sol(0, -1), sl = sol(-1, 0), sr = sol(1, 0), sd = sol(0, 1);
  const peel = h2(tx, ty, 61) < 0.07 && !sd && !su;
  const pcx = 4 + ((h2(tx, ty, 62) * 8) | 0), pcy = 4 + ((h2(tx, ty, 63) * 6) | 0);
  const prx = 3 + ((h2(tx, ty, 64) * 3) | 0), pry = 2 + ((h2(tx, ty, 65) * 3) | 0);
  const drip = h2(tx, 0, 68) < 0.18 ? 2 + ((h2(tx, 1, 69) * 12) | 0) : -1;
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    const panel = (wx / 12) | 0, m = wx % 12;
    let c = (panel & 1) ? WP.b : WP.a;
    if (m === 0) c = WP.lineD; else if (m === 1) c = WP.line;
    const sh = (panel & 1) * 12, my = ((wy + sh) % 24) - 8, mx = m - 3;
    if (mx >= 0 && mx < 7 && my >= 0 && my < 7) {
      const g = MOT[(h2(panel, ((wy + sh) / 24) | 0, 66) * MOT.length) | 0];
      if (g[my][mx] === '#') c = my < 3 ? WP.mot2 : WP.mot;
    }
    if (h2(wx, wy, 67) < 0.025) c = WP.speck;
    if (lx === drip && h2(wy >> 2, wx, 70) < 0.7) c = WP.speck; // escorrido de umidade
    // sombra nos cantos (perto de sólidos)
    let d = 9;
    if (su) d = Math.min(d, ly); if (sl) d = Math.min(d, lx); if (sr) d = Math.min(d, 15 - lx);
    if (d === 0) c = WP.edge; else if (d < 5 && (5 - d) / 6 > th(wx, wy)) c = WP.ao;
    // reboco aparecendo onde o papel descascou
    if (peel) {
      const dx = (lx - pcx) / prx, dy = (ly - pcy) / pry, q = dx * dx + dy * dy + (h2(wx, wy, 71) - 0.5) * 0.6;
      if (q < 1) c = h2(wx, wy, 72) < 0.1 ? WP.plC : dy < -0.2 ? WP.pl : WP.plD;
      else if (q < 1.3) c = WP.lineD;
    }
    if (su) { if (ly === 0) c = '#100e1c'; else if (ly === 1) c = '#4a4672'; else if (ly === 2) c = WP.ao; }
    if (sd) { // rodapé
      if (ly === 10) c = WP.ao; else if (ly === 11) c = '#0e0c18'; else if (ly === 12) c = '#6e5e70';
      else if (ly === 13 || ly === 14) c = (wx % 32 === 0) ? '#2e2434' : '#4c3e50'; else if (ly === 15) c = '#2a2030';
    }
    pc.px(x + lx, y + ly, c);
  }
  if (peel) { // aba enrolada do papel
    const ax = pcx, ay = pcy - pry, bx = Math.min(15, pcx + prx + 1);
    pc.tri(x + ax, y + ay, x + bx, y + ay, x + bx, y + Math.min(15, pcy), WP.backD);
    pc.line(x + ax + 1, y + ay, x + bx, y + ay, WP.back);
    pc.px(x + bx, y + Math.min(15, pcy + 1), WP.edge);
  }
}
/** Papel de parede atrás de vazados/espinhos que ficam dentro de cômodos. */
function behind(pc, x, y, rng, info) {
  const { tx, ty, map } = info;
  if ([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([a, b]) => S(map, tx + a, ty + b) === T.BG)) drawWall(pc, x, y, null, rng, info);
}

// ------------------------------------------------------------------ vazado: prateleira / estrado
function drawOneway(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  behind(pc, x, y, rng, info);
  let s = tx; while (s > 0 && map.get(s - 1, ty) === T.ONEWAY) s--;
  if (h2(s, ty, 5) < 0.5) { // prateleira de madeira com mão-francesa
    pc.hline(x, y, 16, '#a08898'); pc.hline(x, y + 1, 16, '#7e6878');
    pc.rect(x, y + 2, 16, 4, '#5a4658');
    for (let i = 0; i < 16; i++) if (h2(tx * 16 + i, ty, 6) < 0.18) pc.px(x + i, y + 3 + ((h2(i, tx, 7) * 2) | 0), '#4a3848');
    pc.hline(x, y + 6, 16, OUT);
    if (!n.l) { pc.vline(x, y, 7, OUT); pc.vline(x + 1, y + 1, 5, '#8a7484'); }
    if (!n.r) { pc.vline(x + 15, y, 7, OUT); pc.vline(x + 14, y + 1, 5, '#3e3046'); }
    const bk = !n.l ? 4 : !n.r ? 11 : ((tx - s) % 4 === 2 ? 8 : -1);
    if (bk >= 0) {
      pc.tri(x + bk - 4, y + 7, x + bk + 3, y + 7, x + bk, y + 13, OUT);
      pc.tri(x + bk - 2, y + 7, x + bk + 1, y + 7, x + bk, y + 11, '#5e5a74');
      pc.px(x + bk - 2, y + 7, '#8a86a2'); pc.px(x + bk, y + 8, '#2a2838');
    }
  } else { // ripas de estrado (por baixo da cama) com molinhas
    pc.hline(x, y, 16, '#aa9ca4'); pc.rect(x, y + 1, 16, 3, '#8a7c86'); pc.hline(x, y + 4, 16, '#5e5260'); pc.hline(x, y + 5, 16, OUT);
    for (let i = 0; i < 16; i++) {
      const wx = tx * 16 + i, m = wx % 12, q = wx % 24;
      if (m >= 2 && m <= 7) {
        const c = (m === 2 || m === 7) ? OUT : m === 3 ? '#7a6c76' : '#685a64';
        pc.vline(x + i, y + 6, 4, c); pc.px(x + i, y + 10, OUT);
      }
      if (q >= 15 && q <= 18) for (let j = 7; j < 14; j++) if ((j + q) % 3 === 0) pc.px(x + i, y + j, j > 11 ? '#5a5a72' : '#8a8aa2');
    }
    if (!n.l) pc.vline(x, y, 6, OUT);
    if (!n.r) pc.vline(x + 15, y, 6, OUT);
  }
}

// ------------------------------------------------------------------ espinhos: pregos / vidro / dentes
function xf(x, y, dir) {
  if (dir === 'down') return (lx, ly) => [x + lx, y + 15 - ly];
  if (dir === 'right') return (lx, ly) => [x + 15 - ly, y + lx];
  if (dir === 'left') return (lx, ly) => [x + ly, y + lx];
  return (lx, ly) => [x + lx, y + ly];
}
function drawSpike(pc, x, y, dir, rng, info) {
  const { tx, ty, map } = info;
  behind(pc, x, y, rng, info);
  const P = xf(x, y, dir);
  const put = (lx, ly, c) => { if (lx >= 0 && lx < 16 && ly >= 0 && ly < 16) { const [a, b] = P(lx, ly); pc.px(a, b, c); } };
  const horiz = dir === 'up' || dir === 'down';
  let s = horiz ? tx : ty;
  if (horiz) while (s > 0 && map.get(s - 1, ty) === T.SPIKE) s--; else while (s > 0 && map.get(tx, s - 1) === T.SPIKE) s--;
  const kind = (h2(horiz ? s : tx, horiz ? ty : s, 9) * 3) | 0;
  const hr = (k) => h2(tx * 31 + k, ty * 17 + k, 8);
  if (kind === 0) { // pregos tortos atravessando uma tábua lascada
    for (let i = 0; i < 3; i++) {
      const cx = 2 + i * 5 + ((hr(i) * 2) | 0), tip = 14 - (8 + ((hr(i + 5) * 5) | 0)), bend = hr(i + 9) < 0.3 ? 1 : 0;
      for (let ly = tip; ly < 14; ly++) {
        const o = ly < (tip + 14) / 2 ? bend : 0;
        put(cx - 1 + o, ly, OUT); put(cx + 2 + o, ly, OUT);
        put(cx + o, ly, ly === tip ? '#e0dcf0' : '#b8b4cc'); put(cx + 1 + o, ly, ly === tip ? OUT : '#68647e');
        if (hr(ly + i * 20) < 0.12) put(cx + o, ly, '#8a5a4a');
      }
      put(cx + bend, tip - 1, OUT);
    }
    for (let lx = 0; lx < 16; lx++) { put(lx, 14, WOOD[1][0]); put(lx, 15, WOOD[2][0]); if (hr(lx + 40) < 0.5) put(lx, 13, WOOD[0][1]); }
  } else if (kind === 1) { // cacos de vidro (translúcidos)
    for (let i = 0; i < 3; i++) {
      const b0 = 1 + i * 5 + ((hr(i) * 2) | 0), b1 = b0 + 4 + ((hr(i + 3) * 2) | 0), tx0 = b0 + ((hr(i + 6) * 5) | 0), ty0 = 3 + ((hr(i + 7) * 6) | 0);
      for (let ly = ty0; ly < 15; ly++) {
        const k = (ly - ty0) / (15 - ty0), xa = Math.round(tx0 + (b0 - tx0) * k), xb = Math.round(tx0 + (b1 - tx0) * k);
        for (let lx = xa; lx <= xb; lx++) put(lx, ly, lx === xa ? '#d8e8ff' : lx === xb ? '#3a4a70' : (lx === xa + 1 && ly > ty0 + 1) ? '#ffffffcc' : '#8aa4d2a0');
      }
      put(tx0, ty0 - 1, '#3a4a70');
    }
    for (let lx = 0; lx < 16; lx++) { put(lx, 15, hr(lx + 50) < 0.5 ? '#9ab4dc' : '#3a4a70'); if (hr(lx + 60) < 0.25) put(lx, 14, '#c8dcff'); }
  } else { // dentes numa gengiva (assustador, mas de brinquedo)
    for (let lx = 0; lx < 16; lx++) {
      const bump = Math.round(Math.sin((lx + tx * 16) * 0.8) * 0.8);
      put(lx, 11 + bump, '#9a4466'); for (let ly = 12 + bump; ly < 16; ly++) put(lx, ly, ly < 14 ? '#7a2c4c' : '#5a1e38');
    }
    for (let i = 0; i < 3; i++) {
      const cx = 3 + i * 5 + ((hr(i) * 2) | 0) - 1, hgt = 6 + ((hr(i + 4) * 4) | 0), hw = 2;
      for (let k = 0; k <= hgt; k++) {
        const ly = 11 - k, half = Math.max(0, Math.round(hw * (1 - k / (hgt + 1)) + 0.3));
        for (let dx = -half - 1; dx <= half + 1; dx++) {
          const edge = Math.abs(dx) === half + 1;
          put(cx + dx, ly, edge ? '#2a1820' : dx >= half && half > 0 ? '#b8ab98' : '#efe6d4');
        }
      }
      put(cx, 11 - hgt - 1, '#2a1820');
      if (hr(i + 12) < 0.25) put(cx, 9, '#8a7e6a'); // carie
    }
  }
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
    pc.circle(c, c, r, color + '12'); pc.circle(c, c, r * 0.7, color + '1c'); pc.circle(c, c, r * 0.42, color + '2c');
  }, null);
}
const CRAYON = [['#c84a5a', '#e47a86', '#7a2232'], ['#4a7ad0', '#7aa4f0', '#2a4a8a'], ['#e0b040', '#f4d470', '#8a6a1a'], ['#5ab06a', '#8ad89a', '#2a6a3a'], ['#9a5ad0', '#c08af0', '#5a2a8a']];
const EYE_COLS = ['#ffe066', '#e8ecff', '#b4ff8a'];
function buildSprites() {
  const S2 = {};
  S2.crayon = CRAYON.map((c) => mk(12, 5, (pc) => {
    pc.rect(1, 1, 8, 3, c[0]); pc.hline(1, 1, 8, c[1]); pc.rect(3, 1, 4, 3, c[2]); pc.hline(3, 1, 4, c[0]);
    pc.px(9, 1, c[1]); pc.px(9, 2, c[0]); pc.px(9, 3, c[2]); pc.px(10, 2, c[1]);
  }));
  S2.sock = [['#8a4a6a', '#c8a0b0', '#5a2a44'], ['#3a6a8a', '#a0c8d8', '#22445a']].map((c) => mk(13, 9, (pc) => {
    pc.rect(1, 1, 7, 4, c[0]); for (let i = 2; i < 8; i += 3) pc.vline(i, 1, 4, c[1]);
    pc.rect(6, 3, 5, 4, c[0]); pc.rect(9, 4, 3, 3, c[1]); pc.px(6, 6, c[1]); pc.vline(1, 1, 4, c[2]); pc.hline(6, 6, 4, c[2]);
  }));
  S2.sockHang = mk(9, 13, (pc) => {
    pc.rect(2, 1, 4, 8, '#7a4a8a'); for (let j = 2; j < 9; j += 3) pc.hline(2, j, 4, '#c8a0d0');
    pc.rect(2, 8, 6, 3, '#7a4a8a'); pc.rect(6, 8, 2, 3, '#c8a0d0'); pc.hline(2, 1, 4, '#4a2a5a');
  });
  S2.doll = mk(15, 18, (pc) => {
    const sk = '#d8c6c0', skD = '#a8949a', hair = '#8a3a4a', hairD = '#5e2232';
    pc.rect(7, 14, 6, 2, sk); pc.hline(7, 15, 6, skD); pc.rect(12, 13, 2, 3, '#2e2236');
    pc.rect(3, 9, 8, 6, '#4a5a8e'); pc.hline(3, 9, 8, '#6476ac'); pc.vline(10, 10, 5, '#33406a');
    pc.rect(5, 11, 2, 2, '#8a4a6a'); pc.px(7, 13, '#c8a060');
    pc.vline(2, 10, 4, sk); pc.vline(11, 10, 3, skD);
    pc.circle(7, 5, 4, sk); pc.px(4, 3, '#f0e4e0');
    pc.hline(4, 1, 7, hair); pc.hline(3, 2, 9, hair); pc.vline(2, 3, 7, hair); pc.vline(12, 3, 6, hair); pc.vline(3, 3, 2, hairD); pc.px(11, 3, hairD);
    pc.rect(5, 4, 2, 2, '#22223a'); pc.px(5, 4, '#8a8ab0');
    for (const [a, b] of [[8, 4], [10, 4], [9, 5], [8, 6], [10, 6]]) pc.px(a, b, '#3a2238');
    pc.px(4, 6, '#d8909a'); pc.hline(5, 8, 5, '#7a3040'); pc.px(6, 7, '#7a3040'); pc.px(8, 7, '#7a3040');
  });
  S2.ball = mk(9, 9, (pc) => {
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x - 4) ** 2 + (y - 4) ** 2 <= 12) pc.px(x, y, y < 4 ? '#c84a5a' : y === 4 ? '#4a7ad0' : '#e0d8c8');
    pc.px(3, 2, '#ffffff'); pc.px(6, 6, '#a8a090');
  });
  S2.soldier = mk(7, 13, (pc) => {
    pc.rect(2, 1, 3, 3, '#1e1a2a'); pc.rect(2, 4, 3, 2, '#d8c0a8'); pc.rect(1, 6, 5, 3, '#b03a4a'); pc.hline(1, 7, 5, '#e8e0d0');
    pc.rect(2, 9, 3, 3, '#2e3e6e'); pc.vline(3, 10, 2, '#1e1a2a'); pc.vline(6, 4, 6, '#8a8aa0');
  });
  S2.minib = mk(9, 9, (pc) => { pc.rect(1, 1, 7, 7, '#3a7672'); pc.hline(1, 1, 7, '#58a09a'); pc.rect(3, 3, 3, 3, '#e0d4b8'); pc.px(4, 4, '#3a7672'); });
  S2.marbles = mk(10, 5, (pc) => {
    for (const [mx, c] of [[1, '#4ac8d0'], [5, '#e07a9a'], [8, '#d8c060']]) { pc.rect(mx, 1, 2, 2, c); pc.px(mx, 1, '#ffffff'); }
  }, null);
  S2.bunny = mk(11, 8, (pc) => {
    pc.ellipse(5, 4, 4, 2.5, '#5a5672'); pc.ellipse(4, 3, 3, 2, '#7a7694');
    for (const [a, b] of [[1, 2], [9, 3], [3, 1], [7, 1], [10, 5], [0, 5]]) pc.px(a, b, '#6a6684');
    pc.px(4, 4, '#e8ecff'); pc.px(6, 4, '#e8ecff');
  }, null);
  // teia de canto (sup. esquerdo); a direita é espelhada no blit
  S2.web = mk(16, 16, (pc) => {
    const c = '#8c8ab4aa', c2 = '#6a6890aa';
    const ang = [0.05, 0.4, 0.78, 1.15, 1.5];
    const pts = (r) => ang.map((a) => [Math.cos(a) * r, Math.sin(a) * r]);
    for (const [ex, ey] of pts(15)) pc.line(0, 0, Math.round(ex), Math.round(ey), c);
    for (const r of [4, 8, 12]) { const p = pts(r); for (let i = 0; i < p.length - 1; i++) pc.line(Math.round(p[i][0]), Math.round(p[i][1]), Math.round(p[i + 1][0] - 0.5), Math.round(p[i + 1][1] - 0.5), r === 8 ? c : c2); }
  }, null);
  // luzes noturnas: lua de tomada, estrela de tomada, abajur de mesa
  S2.nlMoon = mk(11, 12, (pc) => {
    pc.rect(2, 4, 7, 7, '#5e5a74'); pc.hline(2, 4, 7, '#8a86a2'); pc.px(4, 9, '#2a2838'); pc.px(6, 9, '#2a2838');
    for (let y = 0; y < 9; y++) for (let x = 0; x < 11; x++) if ((x - 5) ** 2 + (y - 4) ** 2 <= 12 && (x - 7) ** 2 + (y - 3) ** 2 > 7) pc.px(x, y, x < 4 ? '#fff0c0' : '#ffd890');
  });
  S2.nlStar = mk(11, 12, (pc) => {
    pc.rect(3, 5, 5, 6, '#5e5a74'); pc.hline(3, 5, 5, '#8a86a2'); pc.px(4, 9, '#2a2838'); pc.px(6, 9, '#2a2838');
    pc.poly([[5, 0], [6, 3], [9, 3], [7, 5], [8, 8], [5, 6], [2, 8], [3, 5], [1, 3], [4, 3]], '#ffd890'); pc.px(5, 2, '#fff4d0'); pc.px(4, 4, '#fff4d0');
  });
  S2.lamp = mk(14, 19, (pc) => {
    pc.ellipse(7, 16, 4, 1.5, '#3a3448'); pc.vline(7, 9, 7, '#5e5a74'); pc.vline(6, 10, 5, '#8a86a2');
    pc.poly([[3, 1], [10, 1], [12, 8], [1, 8]], '#e8a858'); pc.hline(3, 1, 8, '#ffe0a0');
    pc.poly([[4, 2], [6, 2], [4, 7], [2, 7]], '#f4c878'); pc.hline(1, 8, 12, '#fff0c0');
  });
  S2.glow = glowHalo(18, '#ffc46a');
  // brinquedos que brilham no escuro (marcam o caminho): pote de vaga-lumes, estrela
  // fosforescente de pelúcia, pulseira de neon, cogumelo-luminária
  S2.jar = mk(10, 13, (pc) => {
    pc.rect(2, 0, 6, 2, '#8a6a4a'); pc.hline(2, 0, 6, '#b8946a');
    pc.rect(1, 2, 8, 10, '#2a3a4a'); pc.vline(2, 3, 8, '#6a8aa0'); pc.hline(1, 11, 8, '#1a2430');
    pc.px(4, 5, '#d8ff9a'); pc.px(6, 8, '#d8ff9a'); pc.px(3, 9, '#b4ff8a');
  });
  S2.gstar = mk(12, 11, (pc) => {
    pc.poly([[6, 0], [8, 4], [12, 4], [9, 7], [10, 11], [6, 9], [2, 11], [3, 7], [0, 4], [4, 4]], '#bfffd0');
    pc.px(5, 3, '#ffffff'); pc.px(4, 5, '#3a6a4a'); pc.px(7, 5, '#3a6a4a'); pc.hline(5, 7, 2, '#3a6a4a');
  });
  S2.gstick = mk(13, 6, (pc) => {
    pc.line(1, 4, 5, 1, '#ff8ad8'); pc.line(5, 1, 11, 3, '#ff8ad8'); pc.line(2, 4, 6, 2, '#ffd0f0'); pc.px(11, 4, '#c04aa0');
  });
  S2.shroom = mk(12, 12, (pc) => {
    pc.rect(5, 6, 3, 5, '#d8d0e8'); pc.hline(3, 11, 7, '#5e5a74');
    pc.ellipse(6, 5, 5, 4, '#8ad8ff'); pc.rect(1, 5, 11, 1, '#5aa8d8'); pc.px(4, 3, '#e8f8ff'); pc.px(8, 2, '#e8f8ff'); pc.px(6, 4, '#ffffff');
  });
  S2.ghalo = { '#b4ff8a': glowHalo(11, '#b4ff8a'), '#bfffd0': glowHalo(11, '#bfffd0'), '#ff8ad8': glowHalo(11, '#ff8ad8'), '#8ad8ff': glowHalo(11, '#8ad8ff') };
  // adesivos fosforescentes de estrela/lua na parede do quarto
  S2.stk = [mk(7, 7, (pc) => { pc.poly([[3, 0], [4, 2], [7, 3], [4, 4], [3, 7], [2, 4], [0, 3], [2, 2]], '#d8ffb8'); }, null),
            mk(6, 7, (pc) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 6; x++) if ((x - 3) ** 2 + (y - 3) ** 2 <= 9 && (x - 4.5) ** 2 + (y - 2.5) ** 2 > 5) pc.px(x, y, '#d8ffb8'); }, null)];
  S2.halo = {}; for (const c of EYE_COLS) S2.halo[c] = glowHalo(5, c);
  // desenhos de criança em papel (giz de cera)
  S2.draw = [0, 1, 2, 3, 4].map((k) => mk(21, 16, (pc) => {
    pc.rect(1, 1, 19, 14, '#b4aec8'); pc.hline(1, 1, 19, '#cec8e0'); pc.px(19, 14, '#8a849e'); pc.px(18, 14, '#9a94ae');
    pc.rect(8, 0, 5, 2, '#c8c0a0aa');
    const ln = (a, b, c, d, col) => pc.line(a, b, c, d, col);
    if (k === 0) { // casa + sol sorridente
      pc.strokeRect(4, 8, 7, 5, '#c84a5a'); ln(3, 8, 7, 4, '#e07a3a'); ln(7, 4, 11, 8, '#e07a3a'); pc.rect(6, 10, 2, 3, '#4a7ad0');
      pc.circle(15, 5, 2, '#e0b040'); for (const [a, b] of [[15, 1], [18, 5], [12, 5], [17, 2], [13, 2]]) pc.px(a, b, '#e0b040'); pc.px(14, 5, '#7a4a1a'); pc.px(16, 5, '#7a4a1a');
      ln(2, 13, 18, 13, '#5ab06a');
    } else if (k === 1) { // família de palitinho
      for (const [fx, col, hh] of [[5, '#4a7ad0', 7], [10, '#c84a5a', 7], [15, '#9a5ad0', 4]]) {
        pc.ring(fx, 13 - hh - 2, 1, col); pc.vline(fx, 13 - hh, hh - 2, col); ln(fx - 2, 13 - hh + 1, fx + 2, 13 - hh + 1, col); ln(fx, 11, fx - 1, 13, col); ln(fx, 11, fx + 1, 13, col);
      }
      pc.px(12, 3, '#c84a5a'); pc.px(13, 3, '#c84a5a'); pc.px(12, 4, '#c84a5a');
    } else if (k === 2) { // monstrinho de três olhos (amigável)
      pc.ellipse(10, 9, 6, 4, '#7a4ab0'); pc.px(7, 8, '#ffffff'); pc.px(10, 7, '#ffffff'); pc.px(13, 8, '#ffffff');
      pc.px(7, 9, '#1e1a2a'); pc.px(10, 8, '#1e1a2a'); pc.px(13, 9, '#1e1a2a'); ln(8, 11, 12, 11, '#e07a9a'); ln(4, 9, 2, 6, '#7a4ab0'); ln(16, 9, 18, 6, '#7a4ab0');
    } else if (k === 3) { // arco-íris + nuvem
      ['#c84a5a', '#e0b040', '#5ab06a', '#4a7ad0'].forEach((col, i) => pc.ellipseOutline(10, 13, 8 - i * 1.5, 8 - i * 1.5, col));
      pc.rect(1, 13, 19, 2, '#b4aec8'); pc.circle(15, 11, 2, '#e8e8f8'); pc.circle(17, 12, 2, '#e8e8f8');
    } else { // um dinossaurinho azul-turquesa (será o Tico?)
      pc.ellipse(9, 10, 4, 3, '#3fc7c0'); pc.vline(13, 4, 6, '#3fc7c0'); pc.circle(14, 4, 2, '#3fc7c0'); ln(5, 10, 2, 7, '#3fc7c0');
      for (const a of [6, 8, 10]) pc.px(a, 6, '#ffd23f'); pc.px(15, 3, '#1e1a2a'); pc.px(7, 13, '#3fc7c0'); pc.px(11, 13, '#3fc7c0');
    }
  }, '#2a2640'));
  return S2;
}
/** Pinta tufos do carpete sobre a superfície (estático). */
function paintTufts(pc, wx, wy, seed) {
  for (let i = 0; i < 16; i++) {
    const hh = h2(wx + i, seed, 3) < 0.3 ? 2 : h2(wx + i, seed, 4) < 0.5 ? 1 : 0;
    for (let k = 1; k <= hh; k++) pc.px(wx + i + (k === 2 && (i & 1) ? 1 : 0), wy - k, k === 2 ? CAR.hi : CAR.lt);
  }
}

// ------------------------------------------------------------------ decor animados
function eyesDecor(x, y, ph, col) {
  const gap = 4 + ((ph * 10) | 0) % 3;
  const dd = { x: x - 4, y: y - 5, w: gap + 11, h: 12, layer: 'back', light: { r: 11, color: col, i: 0, flicker: 0 } };
  let open = 0, lastT = -1;
  dd.anim = (ctx, t, level) => {
    const dt = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    const p = level?.player;
    let far = true, ox = 0;
    if (p) {
      const dx = p.x + p.w / 2 - (x + gap / 2 + 1.5), dy = p.y + p.h / 2 - y, d = Math.hypot(dx, dy) || 1;
      far = d > 92; ox = dx > 6 ? 1 : dx < -6 ? -1 : 0;
    }
    const want = far && ((t * 0.08 + ph) % 1) < 0.7 && ((t + ph * 7) % 3.7) > 0.15 ? 1 : 0;
    open += (want - open) * Math.min(1, dt * (want ? 2.5 : 14));
    dd.light.i = open * 0.45;
    if (open < 0.15) return;
    const hh = open > 0.6 ? 2 : 1;
    ctx.globalAlpha = 0.5 * open;
    const H = SPR.halo[col].canvas;
    ctx.drawImage(H, x - 4, y - 5); ctx.drawImage(H, x + gap - 3, y - 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    if (hh === 2) { ctx.fillRect(x + 1, y - 1, 2, 1); ctx.fillRect(x + gap + 1, y - 1, 2, 1); }
    ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + gap + 1, y, 3, 1);
    ctx.fillStyle = '#12081a';
    ctx.fillRect(x + 1 + ox, y - (hh - 1), 1, hh); ctx.fillRect(x + gap + 2 + ox, y - (hh - 1), 1, hh);
  };
  return dd;
}
function spiderDecor(x, y, ph) {
  return { x: x - 6, y, w: 14, h: 26, layer: 'back', anim: (ctx, t) => {
    const len = 9 + Math.round(4 + 4 * Math.sin(t * 0.45 + ph)), sway = Math.sin(t * 1.3 + ph) * 2.2;
    ctx.fillStyle = '#8c8ab4'; ctx.globalAlpha = 0.65;
    for (let i = 0; i < len; i++) ctx.fillRect(Math.round(x + sway * (i / len) ** 2), y + i, 1, 1);
    ctx.globalAlpha = 1;
    const sx = Math.round(x + sway), sy = y + len;
    ctx.fillStyle = '#0b0914'; ctx.fillRect(sx - 1, sy, 3, 3); ctx.fillRect(sx - 3, sy + 1, 7, 1); ctx.fillRect(sx - 2, sy + 3, 1, 1); ctx.fillRect(sx + 2, sy + 3, 1, 1);
    ctx.fillStyle = '#e8ecff'; ctx.fillRect(sx - 1, sy + 1, 1, 1); ctx.fillRect(sx + 1, sy + 1, 1, 1);
  } };
}
function lightDecor(x, y, spr, ph, r = 58) {
  const cx = x + (spr.w >> 1), cy = y + (spr.h >> 1) - 2;
  return { x: cx - 30, y: cy - 30, w: 60, h: 60, layer: 'back', light: { r, color: '#ffc46a', i: 0.9, flicker: 0.07 }, anim: (ctx, t) => {
    const G = SPR.glow;
    ctx.globalAlpha = 0.6 + 0.25 * Math.sin(t * 2.1 + ph);
    ctx.drawImage(G.canvas, cx - (G.w >> 1), cy - (G.h >> 1));
    ctx.globalAlpha = 1;
    ctx.drawImage(spr.canvas, x, y);
    ctx.fillStyle = '#ffe4a8'; // poeira dourada dançando na luz
    for (let i = 0; i < 5; i++) {
      const k = (t * 0.06 + i * 0.2 + ph) % 1;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
      ctx.fillRect(Math.round(cx + Math.sin(t * 0.5 + i * 1.7 + ph) * 15), Math.round(cy + 12 - k * 38), 1, 1);
    }
    ctx.globalAlpha = 1;
  } };
}

/** Brinquedo fosforescente no chão: marca o caminho no escuro (luz pequena e fria). */
function glowToyDecor(x, y, kind, ph) {
  const spr = [SPR.jar, SPR.gstar, SPR.gstick, SPR.shroom][kind];
  const col = ['#b4ff8a', '#bfffd0', '#ff8ad8', '#8ad8ff'][kind];
  const cx = x + (spr.w >> 1), cy = y + (spr.h >> 1);
  return { x: cx - 16, y: cy - 16, w: 32, h: 32, layer: 'back', light: { r: 40, color: col, i: 0.55, flicker: 0.05 }, anim: (ctx, t) => {
    const H = SPR.ghalo[col];
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 1.3 + ph);
    ctx.drawImage(H.canvas, cx - (H.w >> 1), cy - (H.h >> 1));
    ctx.globalAlpha = 1;
    ctx.drawImage(spr.canvas, x, y);
    if (kind === 0) { // vaga-lumes no pote
      ctx.fillStyle = '#e8ffb0';
      for (let i = 0; i < 3; i++) if (Math.sin(t * 3 + i * 2.1 + ph) > 0.2) ctx.fillRect(x + 3 + Math.round(2 + Math.sin(t * 1.7 + i * 2 + ph) * 2), y + 4 + Math.round(3 + Math.cos(t * 1.3 + i + ph) * 3), 1, 1);
    }
  } };
}
/** Adesivo fosforescente (estrela/lua) colado no fundo: brilho fraco pulsando. */
function stickerDecor(x, y, k, ph) {
  const spr = SPR.stk[k];
  return { x: x - 4, y: y - 4, w: 15, h: 15, layer: 'back', light: { r: 12, color: '#c8ffb0', i: 0.32, flicker: 0 }, anim: (ctx, t) => {
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 0.9 + ph);
    ctx.drawImage(spr.canvas, x, y);
    ctx.globalAlpha = 1;
  } };
}
/** Monstro do escuro: silhueta enorme espiando de trás dos móveis (quase invisível no
 *  breu — só a borda arroxeada e os OLHOS acesos denunciam). */
function monster(out, rng, bx, by, tod) {
  const C = SIL[tod] || SIL.night;
  const h = rng.int(64, 92), w = rng.int(26, 40), kind = rng.int(0, 2), fl = rng() < 0.5 ? -1 : 1;
  const rim = tod === 'day' ? '#5a4a8a' : '#2e2650';
  out.push({ x: bx - w - 14, y: by - h - 18, w: w * 2 + 28, h: h + 20, layer: 'back', paint(pc) {
    const top = by - h;
    for (let yy = top; yy < by; yy++) {
      const t = (yy - top) / h;
      let hw = Math.round(w * (kind === 1 ? 0.55 + 0.45 * Math.sqrt(t) : 0.35 + 0.65 * Math.sin(Math.min(1, t * 1.4) * 1.57)));
      hw += Math.round(Math.sin(yy * 0.4 + bx) * 1.2);           // pelo irregular
      pc.hline(bx - hw, yy, hw * 2 + 1, C[0]);
      pc.px(bx - hw, yy, rim); pc.px(bx + hw, yy, C[1]);
    }
    if (kind !== 1) { // chifres / orelhas
      pc.tri(bx - w * 0.3, top + 6, bx - w * 0.15, top + 6, bx - w * 0.45, top - 12, C[0]);
      pc.tri(bx + w * 0.15, top + 6, bx + w * 0.3, top + 6, bx + w * 0.45, top - 12, C[0]);
      pc.line(bx - w * 0.3, top + 6, bx - w * 0.45, top - 12, rim);
    } else { // tentáculos
      for (let k = 0; k < 3; k++) pc.curve(bx + fl * (w * 0.5), by - 10 - k * 14, bx + fl * (w + 6), by - 22 - k * 14, bx + fl * (w + 10), by - 34 - k * 10, C[0], 1);
    }
    // garras apoiadas no chão
    for (let k = 0; k < 3; k++) pc.tri(bx + fl * (w * 0.6 + k * 4), by, bx + fl * (w * 0.6 + k * 4 + 3), by, bx + fl * (w * 0.6 + k * 4 + 1), by - 6, C[1]);
  } });
  out.push(eyesDecor(bx - 4, by - h + 16 + rng.int(0, 6), rng() * 7, EYE_COLS[rng.int(0, EYE_COLS.length - 1)]));
}

// ------------------------------------------------------------------ móveis gigantes de fundo (silhuetas por horário)
const SIL = {
  day: ['#2c2846', '#3a3458', '#4a4470', '#6c64a0'],
  dusk: ['#221c38', '#2e2648', '#3c3258', '#7a5a8a'],
  night: ['#100e1e', '#18152a', '#211d38', '#3a3462'],
};
function furniture(out, rng, bx, by, tod) {
  const C = SIL[tod] || SIL.night;
  const kind = rng.int(0, 4);
  if (kind === 0) { // abajur de pé gigante com cúpula franjada (aceso à noite)
    const h = rng.int(70, 96), lit = tod !== 'day' && rng() < 0.7;
    out.push({ x: bx - 22, y: by - h - 22, w: 46, h: h + 24, layer: 'back', paint(pc) {
      pc.ellipse(bx, by - 2, 10, 3, C[0]); pc.rect(bx - 1, by - h, 3, h, C[1]); pc.vline(bx - 1, by - h, h, C[3]);
      pc.poly([[bx - 9, by - h - 18], [bx + 9, by - h - 18], [bx + 17, by - h], [bx - 17, by - h]], C[2]);
      pc.line(bx - 9, by - h - 18, bx - 17, by - h, C[3]); pc.hline(bx - 9, by - h - 18, 18, C[3]);
      for (let i = -17; i <= 17; i += 3) pc.vline(bx + i, by - h + 1, 2 + (i & 1), C[1]);
      if (lit) pc.hline(bx - 16, by - h, 33, '#e8b060');
    } });
    if (lit) out.push({ x: bx - 20, y: by - h - 16, w: 40, h: 40, layer: 'back', light: { r: 70, color: '#ffbe62', i: 0.7, flicker: 0.12 }, anim: (ctx, t) => {
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(t * 1.7 + bx);
      ctx.drawImage(SPR.glow.canvas, bx - 19, by - h - 14);
      ctx.globalAlpha = 1;
    } });
  } else if (kind === 1) { // encosto de cadeira gigante
    const h = rng.int(70, 92), w = rng.int(30, 40), seat = by - 34;
    out.push({ x: bx - 4, y: by - h - 4, w: w + 8, h: h + 6, layer: 'back', paint(pc) {
      pc.rect(bx, by - h, 4, h, C[1]); pc.rect(bx + w, seat, 4, by - seat, C[1]); pc.vline(bx, by - h, h, C[3]);
      pc.rect(bx, seat, w + 4, 4, C[2]); pc.hline(bx, seat, w + 4, C[3]);
      pc.rect(bx, by - h + 6, w * 0.45, 5, C[2]); pc.rect(bx, by - h + 22, w * 0.45, 3, C[2]);
      for (let i = 0; i < 3; i++) pc.vline(bx + 5 + i * 4, by - h + 11, 11, C[1]);
      pc.ellipse(bx + 2, by - h, 3, 3, C[2]); pc.px(bx + 1, by - h - 2, C[3]);
    } });
  } else if (kind === 2) { // coluna torneada de cama com pomo
    const h = rng.int(60, 90);
    out.push({ x: bx - 9, y: by - h - 12, w: 20, h: h + 14, layer: 'back', paint(pc) {
      pc.rect(bx - 3, by - h, 7, h, C[1]); pc.vline(bx - 3, by - h, h, C[2]);
      for (let k = 12; k < h; k += 16) { pc.ellipse(bx, by - k, 5, 3, C[1]); pc.px(bx - 4, by - k - 1, C[3]); }
      pc.circle(bx, by - h - 5, 6, C[1]); pc.circle(bx - 2, by - h - 7, 2, C[2]); pc.px(bx - 3, by - h - 9, C[3]);
    } });
  } else if (kind === 3) { // torre de blocos gigantes tortinha
    const n = rng.int(2, 4);
    const offs = []; for (let i = 0; i < n; i++) offs.push(rng.int(-4, 4));
    out.push({ x: bx - 18, y: by - n * 24 - 4, w: 38, h: n * 24 + 6, layer: 'back', paint(pc) {
      for (let i = 0; i < n; i++) {
        const x0 = bx - 11 + offs[i], y0 = by - (i + 1) * 23;
        pc.rect(x0, y0, 23, 23, C[1]); pc.hline(x0, y0, 23, C[3]); pc.vline(x0, y0, 23, C[2]);
        pc.strokeRect(x0 + 4, y0 + 4, 15, 15, C[0]); pc.rect(x0 + 9, y0 + 8, 5, 8, C[2]);
      }
    } });
  } else { // ursão de pelúcia abandonado, sentado e caído de lado
    out.push({ x: bx - 26, y: by - 56, w: 54, h: 58, layer: 'back', paint(pc) {
      pc.ellipse(bx, by - 14, 17, 14, C[1]); pc.ellipse(bx - 12, by - 3, 7, 4, C[1]); pc.ellipse(bx + 13, by - 3, 7, 4, C[1]);
      pc.circle(bx + 3, by - 36, 12, C[1]); pc.circle(bx - 6, by - 47, 5, C[1]); pc.circle(bx + 12, by - 46, 5, C[1]);
      pc.circle(bx - 6, by - 47, 2, C[0]); pc.ellipse(bx + 5, by - 31, 5, 3, C[2]); pc.px(bx + 5, by - 32, C[0]);
      pc.circle(bx, by - 38, 2, C[3]); pc.px(bx - 1, by - 39, '#8a86b0');               // um olho de botão
      pc.line(bx + 7, by - 41, bx + 10, by - 38, C[0]); pc.line(bx + 10, by - 41, bx + 7, by - 38, C[0]); // outro costurado
      for (let k = -24; k < -4; k += 3) pc.px(bx, by + k, C[0]);
      pc.ellipse(bx - 15, by - 18, 4, 9, C[2]);
      for (let a = -2.4; a < -0.8; a += 0.2) pc.px(Math.round(bx + 3 + Math.cos(a) * 11), Math.round(by - 36 + Math.sin(a) * 11), C[3]);
    } });
  }
}

// ------------------------------------------------------------------ decorate
function decorate(map, rng, data) {
  if (!SPR) SPR = buildSprites();
  const out = [];
  const rows = data?.map || [];
  const chAt = (tx, ty) => (rows[ty] && rows[ty][tx]) || '.';
  const free = (tx, ty) => { const t = map.get(tx, ty); const ch = chAt(tx, ty); return (t === T.EMPTY || t === T.BG) && (ch === '.' || ch === ':'); };
  const sol = (tx, ty) => solidLike(S(map, tx, ty));
  const lights = [], eyes = [], pics = [];
  const farFrom = (list, tx, ty, dmin) => list.every(([a, b]) => Math.abs(a - tx) + Math.abs(b - ty) * 1.5 >= dmin);
  for (let ty = 1; ty < map.rows; ty++) {
    let lastToy = -99, lastWeb = -99;
    for (let tx = 0; tx < map.cols; tx++) {
      const t = map.get(tx, ty);
      const wx = tx * 16, wy = ty * 16, seed = (tx * 92821 + ty * 68917) >>> 0;
      // ----- superfícies (chão com espaço livre acima)
      if (solidLike(t) && t !== T.FAKE && free(tx, ty - 1)) {
        const inside = map.get(tx, ty - 1) === T.BG;
        if (t === T.SOLID && !solidLike(S(map, tx, ty - 1)) && carpetAt(tx, ty)) out.push({ x: wx, y: wy - 3, w: 18, h: 4, layer: 'back', paint: (pc) => paintTufts(pc, wx, wy, seed) });
        const wide = sol(tx - 1, ty) && sol(tx + 1, ty) && free(tx - 1, ty - 1) && free(tx + 1, ty - 1);
        const r = rng();
        if (!inside && free(tx, ty - 2) && wide && farFrom(lights, tx, ty, 16) && rng() < 0.35) { // abajur de mesa
          lights.push([tx, ty]);
          out.push(lightDecor(wx + 1, wy - 18, SPR.lamp, rng() * 6));
        } else if (r < 0.05 && wide && tx - lastToy > 6) { // boneca de pano
          lastToy = tx; const x = wx + rng.int(0, 2), y = wy - 17, fl = rng() < 0.5;
          out.push({ x, y, w: 15, h: 18, layer: 'back', paint: (pc) => pc.blit(SPR.doll, x, y, { flipX: fl }) });
        } else if (r < 0.15 && tx - lastToy > 2) { // gizes de cera espalhados
          lastToy = tx; const k = rng.int(1, 3), items = [];
          for (let i = 0; i < k; i++) items.push([wx + rng.int(-2, 10), rng.int(0, CRAYON.length - 1), rng() < 0.5]);
          out.push({ x: wx - 4, y: wy - 5, w: 26, h: 6, layer: 'back', paint: (pc) => { for (const [cx, ci, f] of items) pc.blit(SPR.crayon[ci], cx, wy - 4, { flipX: f }); } });
        } else if (r < 0.2 && wide && tx - lastToy > 4) { // meia perdida
          lastToy = tx; const s = SPR.sock[rng.int(0, 1)], x = wx + rng.int(0, 4), fl = rng() < 0.5;
          out.push({ x, y: wy - 8, w: 13, h: 9, layer: 'back', paint: (pc) => pc.blit(s, x, wy - 8, { flipX: fl }) });
        } else if (r < 0.26 && tx - lastToy > 3) { // brinquedos pequenos
          lastToy = tx; const s = [SPR.ball, SPR.soldier, SPR.minib, SPR.marbles][rng.int(0, 3)], x = wx + rng.int(0, 16 - s.w);
          out.push({ x, y: wy - s.h + 1, w: s.w, h: s.h, layer: 'back', paint: (pc) => pc.blit(s, x, wy - s.h + 1) });
        } else if (r < 0.31) { // coelhinho de poeira
          const x = wx + rng.int(0, 5);
          out.push({ x, y: wy - 7, w: 11, h: 8, layer: inside ? 'back' : 'front', paint: (pc) => pc.blit(SPR.bunny, x, wy - 7) });
        }
      }
      // ----- células livres: cantos com teia, frestas com olhos, parede de cômodo
      if (free(tx, ty)) {
        const up = sol(tx, ty - 1), L = sol(tx - 1, ty), R = sol(tx + 1, ty);
        if (up && (L || R) && rng() < 0.7) {
          const fl = !L; const x = fl ? wx : wx;
          out.push({ x, y: wy, w: 16, h: 16, layer: 'back', paint: (pc) => pc.blit(SPR.web, x, wy, { flipX: fl }) });
        }
        const crevice = (up && (L || R)) || (L && R) || (up && map.get(tx, ty) === T.BG && h2(tx, ty, 90) < 0.3);
        if (crevice && farFrom(eyes, tx, ty, 7) && rng() < 0.55) {
          eyes.push([tx, ty]);
          const ex = L && !R ? wx + 3 : R && !L ? wx + 6 : wx + 4;
          out.push(eyesDecor(ex, wy + 6 + rng.int(0, 4), rng() * 7, EYE_COLS[rng.int(0, EYE_COLS.length - 1)]));
        }
        if (up && !L && !R && tx - lastWeb > 3) {
          const r = rng();
          if (r < 0.14) { lastWeb = tx; out.push(spiderDecor(wx + rng.int(3, 12), wy, rng() * 6)); }
          else if (r < 0.2) { lastWeb = tx; const x = wx + rng.int(2, 7); out.push({ x, y: wy, w: 9, h: 13, layer: 'back', paint: (pc) => { pc.vline(x + 4, wy, 2, '#8c8ab4'); pc.blit(SPR.sockHang, x, wy + 1); } }); }
        }
        if (map.get(tx, ty) === T.BG) {
          // luz noturna de tomada logo acima do rodapé
          if (sol(tx, ty + 1) && map.get(tx, ty - 1) === T.BG && farFrom(lights, tx, ty, 14) && rng() < 0.5) {
            lights.push([tx, ty]);
            out.push(lightDecor(wx + 3, wy - 1, rng() < 0.5 ? SPR.nlMoon : SPR.nlStar, rng() * 6, 54));
          } else if (map.get(tx + 1, ty) === T.BG && map.get(tx, ty + 1) === T.BG && map.get(tx + 1, ty + 1) === T.BG && !sol(tx, ty + 2) && farFrom(pics, tx, ty, 8) && rng() < 0.08) {
            pics.push([tx, ty]); // desenho de criança preso na parede
            const s = SPR.draw[rng.int(0, SPR.draw.length - 1)], x = wx + rng.int(2, 9), y = wy + rng.int(2, 10);
            out.push({ x, y, w: s.w, h: s.h, layer: 'back', paint: (pc) => pc.blit(s, x, y) });
          }
        }
      }
    }
  }
  // ---- móveis gigantes de fundo (silhuetas atrás dos tiles; cores pelo horário da fase)
  {
    const tod = data?.timeOfDay || 'night';
    const open = (tx, ty) => map.get(tx, ty) === T.EMPTY;
    const headroom = (tx, ty, n) => { for (let k = 1; k <= n; k++) if (!open(tx, ty - k)) return false; return true; };
    let tx = rng.int(3, 8);
    while (tx < map.cols - 3) {
      let gy = -1;
      for (let ty = 2; ty < map.rows; ty++) if (solidLike(map.get(tx, ty)) && open(tx, ty - 1) && headroom(tx, ty, 4)) { gy = ty; break; }
      if (gy > 0) {
        if (gy - 7 > 0 && headroom(tx, gy, 7) && rng() < 0.22) monster(out, rng, tx * 16 + 8, gy * 16 + 1, tod);
        else furniture(out, rng, tx * 16 + 8, gy * 16 + 1, tod);
      }
      tx += rng.int(7, 13);
    }
  }
  // ---- brinquedos fosforescentes no chão: nenhum trecho de chão fica no breu total
  //      (o caminho continua legível entre um abajur e outro)
  {
    let last = -99;
    for (let tx = 1; tx < map.cols - 1; tx++) {
      if (tx - last < 9) continue;
      for (let ty = 2; ty < map.rows; ty++) {
        const t = map.get(tx, ty);
        if (!solidLike(t) || t === T.FAKE || !free(tx, ty - 1) || map.get(tx, ty - 1) === T.BG) continue;
        if (!free(tx, ty - 2) || !farFrom(lights, tx, ty, 9)) continue;
        const kind = rng.int(0, 3), spr = [SPR.jar, SPR.gstar, SPR.gstick, SPR.shroom][kind];
        lights.push([tx, ty]); last = tx;
        out.push(glowToyDecor(tx * 16 + rng.int(1, 15 - spr.w), ty * 16 - spr.h + 1, kind, rng() * 6));
        break;
      }
    }
  }
  // ---- adesivos fosforescentes e olhos soltos na escuridão do fundo (longe do chão)
  {
    const openC = (tx, ty) => map.get(tx, ty) === T.EMPTY && chAt(tx, ty) === '.';
    for (let tx = 3; tx < map.cols - 3; tx += rng.int(4, 8)) {
      let gy = -1;
      for (let ty = 2; ty < map.rows; ty++) if (solidLike(map.get(tx, ty)) && openC(tx, ty - 1)) { gy = ty; break; }
      if (gy < 0) continue;
      const ty = gy - rng.int(4, 8);
      if (ty < 2 || !openC(tx, ty) || !openC(tx + 1, ty) || !openC(tx, ty + 1)) continue;
      if (rng() < 0.45) out.push(stickerDecor(tx * 16 + rng.int(0, 8), ty * 16 + rng.int(0, 8), rng.int(0, 1), rng() * 6));
      else if (farFrom(eyes, tx, ty, 12) && rng() < 0.45) { eyes.push([tx, ty]); out.push(eyesDecor(tx * 16 + 4, ty * 16 + 6, rng() * 7, EYE_COLS[rng.int(0, EYE_COLS.length - 1)])); }
    }
  }
  // decor dentro de cômodos (célula de parede ':') precisa ir na frente do papel de parede;
  // a luz fica num decor "fantasma" de trás (só o laço de trás acende luzes).
  // Decor ESTÁTICO de cômodo é pintado dentro do próprio papel de parede (drawWall lê
  // ROOM_OVER — decorate roda antes dos tiles), assim fica ATRÁS do Tico em vez de
  // na camada da frente (desenhos de criança não cobrem mais a cabeça dele).
  const extra = [], room = [];
  for (const dd of out) {
    if (dd.layer === 'front') continue;
    const ctx = Math.floor((dd.x + (dd.w || 16) / 2) / 16), cty = Math.floor((dd.y + (dd.h || 16) / 2) / 16);
    if (map.get(ctx, cty) !== T.BG) continue;
    if (dd.paint && !dd.anim) { room.push(dd); dd.room = true; continue; }
    dd.layer = 'front';
    if (dd.light) extra.push({ x: dd.x, y: dd.y, w: dd.w, h: dd.h, layer: 'back', light: dd.light, anim: () => {} });
  }
  ROOM_OVER.set(map, room);
  return out.filter((dd) => !dd.room).concat(extra);
}

// ------------------------------------------------------------------ registro
registerTileset('w4', {
  skyColor: '#0c0a1a',
  solid: drawFloor,
  alt: drawAlt,
  oneway: drawOneway,
  spike: drawSpike,
  bg: drawWall,
  water: { body: '#2a2650', top: '#8a86c8', deep: '#16142e', highlight: '#c8c4ff', alpha: 0.78 },
  decorate,
});

// ------------------------------------------------------------------ fase-vitrine (?level=test_w4v)
function showcaseMap() {
  const W = 90, H = 30;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const R = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < W) g[j][i] = c; };
  R(0, 25, W, 5, '#');                                     // assoalho
  R(0, 4, 3, 21, '#'); R(3, 14, 5, 2, '#');                // parede + marquise (fresta com olhos)
  R(8, 23, 7, 2, '%');                                     // colchão
  R(17, 19, 2, 6, '%');                                    // pilha de livros
  R(21, 24, 4, 1, '%'); R(22, 23, 3, 1, '%'); R(23, 22, 2, 1, '%'); R(24, 21, 1, 1, '%'); // escada de blocos
  R(10, 12, 5, 1, '='); R(20, 9, 6, 2, '#');               // plataformas altas
  R(28, 24, 4, 1, '^');                                    // pregos/vidro/dentes p/ cima
  R(30, 16, 7, 3, '#'); R(31, 19, 4, 1, '^');              // ilha com espinhos p/ baixo
  R(38, 21, 6, 1, '=');                                    // ripas
  R(46, 14, 2, 11, '#'); R(45, 17, 1, 3, '^'); R(48, 17, 1, 3, '^'); // pilar com espinhos ← →
  R(51, 25, 7, 2, '~');                                    // poça de tinta
  R(60, 8, 30, 17, '#'); R(62, 11, 25, 14, ':'); R(60, 21, 2, 4, 'H'); // quarto + parede falsa
  R(64, 21, 5, 1, '='); R(71, 18, 5, 1, '='); R(78, 15, 5, 1, '=');
  R(74, 24, 3, 1, '^'); R(83, 21, 2, 4, '%');
  g[24][5] = 'P'; g[24][85] = 'E'; g[24][42] = 'K';
  g[22][11] = '*'; g[15][33] = '*'; g[14][80] = '*';
  g[24][20] = 'o'; g[8][22] = 'o'; g[17][73] = 'o';
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w4v', world: 0, index: 0, name: 'Vitrine do Pesadelo', subtitle: 'Teste de arte',
  tileset: 'w4', background: 'w4', music: null, parTime: 120, darkness: 0.75, ambient: 'w4_dust',
  map: showcaseMap(),
});
