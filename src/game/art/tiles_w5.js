// =============================================================================
// art/tiles_w5.js — Tileset do Mundo 5: O CORAÇÃO DA DIMENSÃO.
//
// A dimensão de origem do Costureiro: tudo é TECIDO escuro tramado (trama de
// cesto que escurece com a profundidade), preso por pontos de costura DOURADOS
// que brilham, com bordas desfiadas.
//   solid  : tecido tramado roxo-escuro, costura dourada contornando as bordas,
//            franja desfiada, cruzes de ponto antigas no fundo.
//   alt    : ruínas de retalhos misturando materiais dos mundos 1–4 (feltro com
//            musgo, azulejo do mar, chapa de latão rebitada, colcha da noite).
//   oneway : cordão dourado esticado com retalho de tecido cortado em zigue-zague.
//   spike  : agulhas gigantes enfiadas numa costura rasgada (4 direções).
//   bg     : interior de um tear gigante (urdidura esticada, vigas, liços).
//   água   : "fio derretido" magenta da fenda.
// decorate(): agulhas/espirais de fio gigantes ao fundo (paleta conforme
// data.timeOfDay), franjas, botões, alfinetes, fios pendurados (estáticos) +
// fios ondulando, destroços de mundos anteriores flutuando, fendas brilhando
// (com luz) e costuras pulsando (animados).
// Também registra a fase-vitrine 'test_w5v' (?level=test_w5v).
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
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const solidLike = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;

// ------------------------------------------------------------------ paleta
const OUT = '#12050f';
const WEAVE = [ // [profundidade] -> [luz, meio, sombra]
  ['#6e3070', '#57245c', '#421a48'],
  ['#54205c', '#3e1646', '#2a0c30'],
  ['#3c1442', '#2c0e32', '#1c0820'],
  ['#2c0e30', '#200824', '#140416'],
];
const RIM = { u: '#b46aa8', l: '#8e4c8c', r: '#2a0c2c', d: '#1a0618' };
const GOLD = { hi: '#fff6c0', md: '#ffd23f', lo: '#d08a1a', dim: '#7a4e22', glow: '#ffb020', hole: '#14040e' };
const PINK = '#ff4f8a';

function countSolid(map, tx, ty, dx, dy, max) {
  let k = 0;
  while (k < max) {
    const x = tx + dx * (k + 1), y = ty + dy * (k + 1);
    if (y >= map.rows || solidLike(map.get(x, y))) k++; else break;
  }
  return k;
}

// ------------------------------------------------------------------ tecido tramado (solid)
function drawFabric(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const n = ty >= map.rows - 1 ? { ...n0, d: true, dl: true, dr: true } : n0;
  const MAX = 3;
  const ku = n.u ? 1 + countSolid(map, tx, ty - 1, 0, -1, MAX - 1) : 0;
  const kd = n.d ? 1 + countSolid(map, tx, ty + 1, 0, 1, MAX - 1) : 0;
  const kl = n.l ? 1 + countSolid(map, tx - 1, ty, -1, 0, MAX - 1) : 0;
  const kr = n.r ? 1 + countSolid(map, tx + 1, ty, 1, 0, MAX - 1) : 0;
  const cUL = n.u && n.l && !n.ul, cUR = n.u && n.r && !n.ur, cDL = n.d && n.l && !n.dl, cDR = n.d && n.r && !n.dr;
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      // franja desfiada: quanto a borda "come" (0..2 px), depende da coordenada ao longo da borda
      const frX = h2(wx, 7) < 0.28 ? 1 : h2(wx, 8) < 0.06 ? 2 : 0;
      const frY = h2(wy, 9) < 0.28 ? 1 : h2(wy, 10) < 0.06 ? 2 : 0;
      let d = 99, e = 'i', s = wx;
      const take = (v, ed, ss) => { if (v < d) { d = v; e = ed; s = ss; } };
      if (ku < MAX) take(ku * 16 + ly - (ku ? 0 : frX), 'u', wx);
      if (kd < MAX) take(kd * 16 + 15 - ly - (kd ? 0 : frX), 'd', wx);
      if (kl < MAX) take(kl * 16 + lx - (kl ? 0 : frY), 'l', wy);
      if (kr < MAX) take(kr * 16 + 15 - lx - (kr ? 0 : frY), 'r', wy);
      if (cUL) take(Math.hypot(lx + 0.5, ly + 0.5) - 0.5, 'u', wx + wy);
      if (cUR) take(Math.hypot(15.5 - lx, ly + 0.5) - 0.5, 'u', wy - wx + 999);
      if (cDL) take(Math.hypot(lx + 0.5, 15.5 - ly) - 0.5, 'd', wx - wy + 999);
      if (cDR) take(Math.hypot(15.5 - lx, 15.5 - ly) - 0.5, 'd', wx + wy);
      if (d < 0) continue;                          // desfiado: transparente
      const di = Math.round(d);
      if (di === 0) { pc.px(x + lx, y + ly, OUT); continue; }
      if (di === 1) { pc.px(x + lx, y + ly, RIM[e] || RIM.u); continue; }
      // profundidade
      const f = Math.max(0, Math.min(3, (d - 2) / 10));
      let lev = Math.floor(f);
      if (lev < 3 && f - lev > th(wx, wy)) lev++;
      const W = WEAVE[lev];
      // trama de cesto 4x4: células alternam fios horizontais/verticais
      const cx = wx >> 2, cy = wy >> 2, ix = wx & 3, iy = wy & 3;
      const k = ((cx + cy) & 1) === 0 ? iy : ix;
      let c = k === 0 ? W[0] : k === 3 ? W[2] : W[1];
      if (k === 1 && h2(cx, cy, 3) < 0.12) c = mix(c, '#7a2a5a', 0.5); // fio avermelhado na trama
      // colcha: blocos de retalhos com tons diferentes e pesponto apagado entre eles
      if (lev >= 1) {
        const pby = Math.floor((wy + 8) / 40), pbx = Math.floor((wx + (pby & 1) * 24) / 48);
        const hv = h2(pbx, pby, 4);
        if (hv < 0.33) c = mix(c, '#2a1a5a', 0.3); else if (hv > 0.7) c = mix(c, '#5a1030', 0.3);
        const sx = (wx + (pby & 1) * 24) % 48, sy = (wy + 8) % 40;
        if ((sx === 0 && (wy & 3) < 2) || (sy === 0 && (wx & 3) < 2)) c = lev === 1 ? '#8a5a2a' : '#5e3a1e';
        else if (sx === 1 || sy === 1) c = mix(c, '#000000', 0.3);
      }
      // costura dourada correndo junto da borda (d≈5)
      if (e !== 'i' && di >= 4 && di <= 6) {
        const dash = ((s % 6) + 6) % 6;
        const onDash = dash < 4;
        if (di === 5) {
          if (onDash) c = dash === 0 ? GOLD.hi : dash === 3 ? GOLD.lo : GOLD.md;
          else if (dash === 4) c = GOLD.hole;
        } else if (onDash) c = mix(c, GOLD.glow, e === 'u' ? 0.38 : 0.25); // brilho em volta
      }
      pc.px(x + lx, y + ly, c);
    }
  }
  // cruz de ponto antiga (dourado apagado) no miolo do tecido
  if (ku >= 1 && kd >= 1 && kl >= 1 && kr >= 1 && h2(tx, ty, 21) < 0.07) {
    const ox = x + 4 + rng.int(0, 6), oy = y + 4 + rng.int(0, 6);
    for (let i = 0; i < 5; i++) { pc.px(ox + i, oy + i, GOLD.dim); pc.px(ox + 4 - i, oy + i, GOLD.dim); }
    pc.px(ox + 2, oy + 2, '#b07a2a'); pc.px(ox, oy, '#a06a2a');
  }
  // veio de fenda magenta (raro, no fundo)
  if (ku >= 2 && h2(tx, ty, 22) < 0.1) {
    let vx = x + rng.int(2, 13);
    for (let ly = 0; ly < 16; ly++) { pc.px(vx, y + ly, ly & 1 ? '#5a1448' : '#7a1c5a'); if (h2(tx, ly, 23) < 0.3) vx += h2(ly, tx, 24) < 0.5 ? -1 : 1; vx = Math.max(x + 1, Math.min(x + 14, vx)); }
  }
}

// ------------------------------------------------------------------ ruínas de retalhos (alt)
const RUIN_TINT = '#5a1040';
function matColor(m, lx, ly, wx, wy) {
  let c;
  if (m === 0) { // feltro verde musgoso (W1)
    c = ((wx * 3 + wy * 5) % 7 === 0) ? '#6ea24a' : (h2(wx, wy, 1) < 0.2 ? '#3e6e34' : '#4e8a3c');
    if (((wy + (wx >> 3)) % 6) === 0 && (wx & 1)) c = '#2e5228';
  } else if (m === 1) { // azulejo do mar (W2)
    const gx = wx & 7, gy = wy & 7;
    if (gx === 0 || gy === 0) c = '#1c4a5a';
    else if (gx === 1 || gy === 1) c = '#7ad4e0';
    else c = ((wx >> 3) + (wy >> 3)) & 1 ? '#3a9ab0' : '#2e86a0';
    if (gx > 2 && gy > 2 && gx + gy === 9) c = '#5cc0d0';
  } else if (m === 2) { // chapa de latão rebitada (W3)
    const gx = wx % 10, gy = wy % 10;
    c = gy === 0 ? '#5a3a14' : gy === 1 ? '#e8c060' : (gx === 0 ? '#7a5218' : '#b8862e');
    if ((gx === 3 || gx === 7) && gy === 4) c = '#ffe8a0';
    if ((gx === 3 || gx === 7) && gy === 5) c = '#6a4410';
    if (gy > 1 && h2(wx >> 1, wy >> 1, 5) < 0.08) c = '#4e7a5a'; // azinhavre
  } else { // colcha da noite (W4)
    const q = ((wx + wy) % 8 === 0) || ((((wx - wy) % 8) + 8) % 8 === 0);
    c = q ? '#3e3270' : '#2a2050';
    if (((wx * 7 + wy * 13) % 37) === 0) c = '#ffd23f';
  }
  return mix(c, RUIN_TINT, 0.22);
}
function drawRuin(pc, x, y, n, rng, info) {
  const { tx, ty } = info;
  const mA = (h2(tx, ty, 31) * 4) | 0, mB = (mA + 1 + ((h2(tx, ty, 32) * 3) | 0)) % 4;
  const split = (h2(tx, ty, 33) * 4) | 0; // 0 nenhum, 1 horiz, 2 vert, 3 diagonal
  const sideB = (lx, ly) => split === 1 ? ly > 7 : split === 2 ? lx > 8 : split === 3 ? lx + ly > 15 : false;
  const onSeam = (lx, ly) => split === 1 ? ly === 7 || ly === 8 : split === 2 ? lx === 8 || lx === 9 : split === 3 ? lx + ly === 15 || lx + ly === 16 : false;
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    // cantos lascados nos cantos expostos
    if ((!n.u && !n.l && lx + ly < 2) || (!n.u && !n.r && (15 - lx) + ly < 2) || (!n.d && !n.l && lx + 15 - ly < 2) || (!n.d && !n.r && 30 - lx - ly < 2)) continue;
    let c = matColor(sideB(lx, ly) ? mB : mA, lx, ly, wx, wy);
    if (onSeam(lx, ly)) c = ((wx + wy) % 3 === 0) ? GOLD.md : '#3a1030';
    // bordas expostas: contorno + luz de cima-esquerda
    const eu = !n.u && ly === 0, ed = !n.d && ly === 15, el = !n.l && lx === 0, er = !n.r && lx === 15;
    if (eu || ed || el || er) c = OUT;
    else if (!n.u && ly === 1) c = mix(c, '#ffe0f0', 0.35);
    else if (!n.l && lx === 1) c = mix(c, '#ffe0f0', 0.2);
    else if (!n.d && ly === 14) c = mix(c, '#000000', 0.4);
    else if (!n.r && lx === 14) c = mix(c, '#000000', 0.3);
    pc.px(x + lx, y + ly, c);
  }
  // rachadura
  if (h2(tx, ty, 34) < 0.35) {
    let cx = x + rng.int(3, 12), cy = y + (n.u ? 0 : 2);
    for (let i = 0; i < 7; i++) { pc.px(cx, cy, '#1a0614'); pc.px(cx + 1, cy, mix(matColor(mA, 0, 0, tx * 16, ty * 16), '#ffffff', 0.15)); cy++; cx += rng.int(-1, 1); }
  }
  // pontos em X atravessando a emenda dos retalhos
  if (split === 1 || split === 2) for (let k = 2; k < 14; k += 4) {
    const a = split === 1 ? [k, 6, k + 2, 9] : [7, k, 10, k + 2];
    pc.line(x + a[0], y + a[1], x + a[2], y + a[3], GOLD.md); pc.line(x + a[2], y + a[1], x + a[0], y + a[3], GOLD.lo);
  }
}

// ------------------------------------------------------------------ interior do tear (bg)
const bgLike = (t) => t === T.BG || t === T.ONEWAY || t === T.SPIKE;
function drawLoom(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  const b = (dx, dy) => { const t = map.get(tx + dx, ty + dy); return bgLike(t) || solidLike(t); };
  const beam = (ty % 7) === 0;
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    // urdidura: fios verticais esticados (com brilho dourado ocasional)
    const k = wx % 4, gw = h2(wx >> 2, 1, 2) < 0.2;
    let c = k === 0 ? '#14060f' : k === 1 ? (gw ? '#8a5a2a' : '#4a1e48') : k === 2 ? (gw ? '#5e3a1e' : '#341438') : '#24102a';
    // tecido sendo tecido: faixa com losangos (vermelho/magenta/dourado) e fio de trama
    const band = ((wy % 48) + 48) % 48, row = Math.floor(wy / 48);
    if (band >= 26 && band < 44) {
      const pal = [['#7a1a4a', '#c0305a', '#ffb84a'], ['#4a1a6a', '#8a3a9a', '#ffd23f'], ['#6a1030', '#a8284a', '#ff8ab0']][((h2(row, wx >> 6, 3) * 3) | 0)];
      const dx = Math.abs(((wx % 16) + 16) % 16 - 8), dy = Math.abs(band - 35);
      const dd = dx + dy;
      c = dd === 6 || dd === 7 ? pal[2] : dd < 4 ? pal[1] : pal[0];
      c = mix(c, '#14060f', (wy & 1) ? 0.55 : 0.42); // apagado: é fundo
      if (band === 26) c = '#a8742a'; else if (band === 43) c = '#1a0614';
    } else if (band === 25) c = (wx & 1) ? '#c0305a' : '#14060f'; // última passada da lançadeira
    // liços: arames finos com olhal
    if (wx % 24 === 11 && band < 25) c = band % 8 === 4 ? '#ffd23f' : '#8a7a8a';
    if (beam) { if (ly < 5) c = ly === 0 ? '#120608' : ly === 1 ? '#8a5a3a' : ly === 4 ? '#1e0e0c' : ((wx >> 1) % 5 === 0 ? '#3a2014' : '#5a3424'); if (ly === 2 && wx % 16 === 3) c = '#ffd23f'; }
    // sombra perto das bordas da área (vinheta)
    let ed = 99;
    if (!b(0, -1)) ed = Math.min(ed, ly); if (!b(0, 1)) ed = Math.min(ed, 15 - ly);
    if (!b(-1, 0)) ed = Math.min(ed, lx); if (!b(1, 0)) ed = Math.min(ed, 15 - lx);
    if (ed === 0) c = OUT; else if (ed < 4 && th(wx, wy) * 4 > ed - 0.5) c = '#0e040e';
    pc.px(x + lx, y + ly, c);
  }
}
function behind(pc, x, y, rng, info) {
  const { map, tx, ty } = info;
  const g = (dx, dy) => map.get(tx + dx, ty + dy);
  if (g(-1, 0) !== T.BG && g(1, 0) !== T.BG && g(0, -1) !== T.BG && g(0, 1) !== T.BG) return;
  drawLoom(pc, x, y, null, rng, info);
}

// ------------------------------------------------------------------ ponte de fio + retalho (oneway)
const SCRAPS = ['#c0304a', '#8a2a7a', '#d0505a', '#5a2a8a', '#b03a6a'];
function drawBridge(pc, x, y, n, rng, info) {
  const { tx, ty } = info;
  behind(pc, x, y, rng, info);
  const scrap = h2(tx, ty, 51) < 0.7;
  const sc = SCRAPS[(h2(tx >> 1, ty, 52) * SCRAPS.length) | 0];
  for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx;
    if (scrap) { // retalho cortado com tesoura de picotar (zigue-zague)
      const zz = 5 + Math.abs(((wx % 4) + 4) % 4 - 2);
      for (let ly = 2; ly <= zz; ly++) {
        let c = ly === zz ? OUT : ly === 2 ? mix(sc, '#ffffff', 0.25) : ((wx + ly) % 4 === 0 ? mix(sc, '#000000', 0.25) : sc);
        if (ly === 4 && (wx % 4) < 2) c = mix(sc, '#ffd23f', 0.5); // pesponto
        pc.px(x + lx, y + ly, c);
      }
    } else if (lx % 5 === 2) { pc.vline(x + lx, y + 2, 3 + ((h2(wx, ty, 53) * 4) | 0), GOLD.lo); }
    // cordão dourado torcido (2 px) com contorno
    const tw = (wx + 0) % 4;
    pc.px(x + lx, y, tw < 2 ? GOLD.hi : GOLD.md);
    pc.px(x + lx, y + 1, tw < 2 ? GOLD.lo : GOLD.md);
    pc.px(x + lx, y + 2, scrap ? OUT : '#3a1a10');
  }
  // nós e alfinetes de ancoragem nas pontas
  const knot = (kx) => {
    pc.rect(x + kx - 1, y, 4, 4, GOLD.md); pc.strokeRect(x + kx - 2, y - 1, 6, 6, OUT);
    pc.px(x + kx, y + 1, GOLD.hi); pc.px(x + kx + 1, y + 3, GOLD.lo);
    pc.vline(x + kx + 1, y + 5, 6, '#c8ccdc'); pc.px(x + kx + 1, y + 11, '#ffffff');
  };
  if (!n.l) knot(1);
  if (!n.r) knot(11);
  if (n.l && n.r && h2(tx, ty, 54) < 0.25) { pc.px(x + 7, y + 3, '#f4f0e4'); pc.px(x + 8, y + 3, '#f4f0e4'); } // botãozinho
}

// ------------------------------------------------------------------ agulhas gigantes + costura rasgada (spike)
function drawNeedles(pc, x, y, dir, rng, info) {
  const P = (lx, ly, c) => {
    if (lx < 0 || lx > 15 || ly < 0 || ly > 15) return;
    if (dir === 'down') pc.px(x + lx, y + 15 - ly, c);
    else if (dir === 'right') pc.px(x + 15 - ly, y + lx, c);
    else if (dir === 'left') pc.px(x + ly, y + lx, c);
    else pc.px(x + lx, y + ly, c);
  };
  const { tx, ty } = info;
  behind(pc, x, y, rng, info);
  const base = (dir === 'left' || dir === 'right') ? ty * 16 : tx * 16;
  const needle = (cx, tip, wide, tilt) => {
    for (let ly = tip; ly < 13; ly++) {
      const t = (ly - tip) / Math.max(1, 12 - tip);
      const hw = wide && t > 0.35 ? 1 : 0;
      const ox = Math.round(cx + tilt * (12 - ly) / 6);
      P(ox - hw - 1, ly, OUT); P(ox + hw + 1, ly, OUT);
      for (let k = -hw; k <= hw; k++) P(ox + k, ly, ly === tip ? '#ffffff' : k < 0 || (!hw && ly < tip + 3) ? '#f0f2fa' : k > 0 ? '#7a7e9a' : '#b8bcd0');
      // buraco da agulha
      if (wide && (ly === 9 || ly === 10)) P(ox, ly, '#2a1030');
    }
    P(Math.round(cx + tilt * (12 - tip) / 6), tip - 1, OUT);
  };
  const big = 6 + rng.int(0, 3);
  needle(big, 0, true, 0);
  needle(2 + rng.int(0, 1), 4 + rng.int(0, 2), false, -1);
  needle(13 + rng.int(0, 1), 3 + rng.int(0, 3), false, 1);
  // fio dourado enfiado no buraco da agulha grande
  P(big - 1, 9, GOLD.md); P(big - 2, 10, GOLD.md); P(big - 3, 11, GOLD.lo); P(big + 1, 10, GOLD.md); P(big + 2, 11, GOLD.lo);
  // costura rasgada na base: tecido roto com fios soltos
  for (let lx = 0; lx < 16; lx++) {
    const w = base + lx;
    const top = 12 + Math.round(Math.sin(w * 0.9) * 0.8 + (h2(w, 1, 61) < 0.3 ? -1 : 0));
    P(lx, top, OUT);
    for (let ly = top + 1; ly < 16; ly++) P(lx, ly, ly === top + 1 ? '#6e3070' : (((w >> 2) + ly) & 1) ? '#3c1642' : '#2e1034');
    if (h2(w, 2, 62) < 0.25) { P(lx, top - 1, '#8a4a86'); P(lx, top - 2, h2(w, 3, 63) < 0.5 ? '#b46aa8' : GOLD.lo); }
    if (lx % 5 === 1) P(lx, 14, PINK); // brilho da fenda pelo rasgo
  }
}

// ------------------------------------------------------------------ sprites de decoração
function mk(w, h, fn, outline = OUT) {
  const pc = new PixelCanvas(w, h);
  fn(pc);
  if (outline) pc.outline(outline);
  pc.flush();
  return pc;
}
function halo(r, color) {
  return mk(r * 2 + 2, r * 2 + 2, (pc) => {
    const c = r + 1;
    pc.circle(c, c, r, color + '12'); pc.circle(c, c, r * 0.7, color + '1e'); pc.circle(c, c, r * 0.42, color + '30');
  }, null);
}
const BTN = ['#e8434f', '#ffd23f', '#42c6d4', '#e874c4', '#f4f0e4', '#8a6ccc'];
let SPR = null;
function buildSprites() {
  const S = {};
  S.buttons = BTN.map((c) => mk(9, 9, (pc) => {
    pc.circle(4, 4, 4, c); pc.ellipseOutline(4, 4, 3, 3, mix(c, '#000000', 0.25));
    pc.px(2, 2, mix(c, '#ffffff', 0.6)); pc.px(3, 2, mix(c, '#ffffff', 0.4));
    for (const [hx, hy] of [[3, 3], [5, 3], [3, 5], [5, 5]]) pc.px(hx, hy, mix(c, '#000000', 0.55));
  }));
  // alfinetes espetados (inclinados)
  S.pins = BTN.map((c, i) => mk(7, 12, (pc) => {
    const f = i & 1;
    pc.line(f ? 2 : 4, 4, f ? 4 : 2, 11, '#c8ccdc'); pc.px(f ? 4 : 2, 11, '#ffffff');
    pc.circle(f ? 2 : 4, 3, 2, c); pc.px(f ? 1 : 3, 2, '#ffffff');
  }));
  // destroços de mundos anteriores (flutuam)
  S.debris = [
    mk(12, 12, (pc) => { pc.rect(1, 1, 10, 10, '#c45e4c'); pc.hline(1, 1, 10, '#e88c78'); pc.vline(1, 1, 10, '#e88c78'); pc.rect(4, 3, 4, 1, '#ffd0c0'); pc.rect(4, 6, 4, 1, '#ffd0c0'); pc.vline(4, 3, 6, '#ffd0c0'); pc.vline(7, 3, 6, '#ffd0c0'); }), // bloco (W1)
    mk(13, 11, (pc) => { pc.ellipse(6, 6, 6, 4, '#f2a0b0'); for (let i = 0; i < 5; i++) pc.line(6, 10, 1 + i * 2.5, 2, '#d06a84'); pc.hline(3, 3, 6, '#ffe0e8'); }), // concha (W2)
    mk(13, 13, (pc) => { pc.circle(6, 6, 5, '#c8962e'); for (let a = 0; a < 8; a++) pc.rect(Math.round(6 + Math.cos(a * 0.785) * 5.6) - 1, Math.round(6 + Math.sin(a * 0.785) * 5.6) - 1, 2, 2, '#c8962e'); pc.circle(6, 6, 2, '#5a3a14'); pc.px(4, 3, '#ffe8a0'); }), // engrenagem (W3)
    mk(12, 12, (pc) => { pc.poly([[6, 0], [8, 4], [12, 5], [9, 8], [10, 12], [6, 10], [2, 12], [3, 8], [0, 5], [4, 4]], '#ffd23f'); pc.px(5, 4, '#fff6c0'); pc.px(6, 7, '#c08a1a'); }), // estrela de pelúcia (W4)
    mk(10, 14, (pc) => { pc.rect(2, 0, 6, 3, '#e8e0d4'); pc.rect(1, 3, 8, 8, '#a02a3a'); pc.hline(1, 6, 8, GOLD.md); pc.rect(2, 11, 6, 3, '#e8e0d4'); pc.vline(2, 3, 8, '#c84a5a'); }), // carretel
  ];
  // fenda pequena (rasgo vertical com suturas)
  S.rift = mk(9, 22, (pc) => {
    pc.poly([[4, 0], [6, 6], [5, 12], [7, 17], [4, 21], [2, 15], [3, 9], [2, 4]], '#ff4f8a');
    pc.poly([[4, 2], [5, 7], [4, 12], [5, 16], [4, 19], [3, 14], [4, 9], [3, 4]], '#ffd0e8');
    pc.vline(4, 5, 12, '#ffffff');
    for (const yy of [5, 10, 15]) { pc.px(1, yy, GOLD.md); pc.px(2, yy, GOLD.md); pc.px(6, yy + 1, GOLD.md); pc.px(7, yy + 1, GOLD.lo); }
  }, '#3a0630');
  S.riftHalo = halo(20, PINK);
  S.stitchGlow = halo(5, GOLD.glow);
  return S;
}

// fios pendurados estáticos (com conta/botão na ponta)
function paintHangThread(pc, x, y, len, seed) {
  const r = lrng(seed);
  const c = r() < 0.6 ? GOLD.lo : '#9a3a7a', c2 = r() < 0.5 ? GOLD.md : '#c45a9a';
  const bend = r.int(-4, 4);
  pc.curve(x, y, x + bend, y + len * 0.5, x + Math.round(bend * 0.4), y + len, c, 0);
  pc.px(x, y + 1, c2);
  if (r() < 0.5) { const b = BTN[r.int(0, BTN.length - 1)]; pc.circle(x + Math.round(bend * 0.4), y + len + 2, 2, b); pc.px(x + Math.round(bend * 0.4) - 1, y + len + 1, '#ffffff'); }
}
// franja desfiada no topo do tecido (sobressai acima do tile)
function paintFringe(pc, x, y, seed) {
  const r = lrng(seed);
  for (let i = 0; i < 16; i++) {
    if (r() < 0.45) continue;
    const hh = r.int(1, 4), c = r() < 0.18 ? GOLD.lo : r() < 0.5 ? '#8a4a86' : '#6e3070';
    const lean = r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1);
    for (let k = 0; k < hh; k++) pc.px(x + i + (k > 1 ? lean : 0), y - 1 - k, c);
  }
}
// agulha/espiral de fio gigante ao fundo (equivalente às árvores de fundo do W1)
const SPIRE_PAL = {
  day: { body: ['#7a2a5a', '#94386a', '#5e1e48'], gold: '#e8a040', tip: '#e0b8c8' },
  dusk: { body: ['#4a1846', '#5e2256', '#361034'], gold: '#d8902a', tip: '#b08aa8' },
  night: { body: ['#200c2a', '#2c1238', '#160820'], gold: '#a8701e', tip: '#6a5a7a' },
};
function paintSpire(pc, bx, by, hgt, wid, seed, P) {
  const r = lrng(seed);
  const top = by - hgt;
  for (let yy = top + 10; yy < by; yy++) {
    const t = (yy - top) / hgt;
    const hw = Math.max(1, Math.round(wid * (0.25 + 0.75 * t) + Math.sin(yy * 0.35 + seed) * 0.8));
    pc.hline(bx - hw, yy, hw * 2 + 1, P.body[0]);
    pc.hline(bx - hw, yy, Math.max(1, hw >> 1), P.body[1]);
    pc.px(bx + hw, yy, P.body[2]); pc.px(bx + hw - 1, yy, P.body[2]);
    if (yy % 3 === 0) pc.hline(bx - hw + 1, yy, hw * 2 - 1, P.body[2]); // fio enrolado
    // espiral dourada
    const sp = Math.sin(yy * 0.22 + seed);
    if (Math.abs(Math.cos(yy * 0.22 + seed)) < 0.5) pc.px(bx + Math.round(sp * hw), yy, P.gold);
  }
  // ponta de agulha com buraco
  pc.tri(bx - 2, top + 11, bx + 2, top + 11, bx, top - 4, P.tip);
  pc.px(bx, top + 4, P.body[2]); pc.px(bx, top + 5, P.body[2]);
  // pedaços desprendidos flutuando
  for (let i = 0; i < 3; i++) pc.rect(bx + r.int(-wid - 8, wid + 8), top + r.int(10, hgt - 10), 2, 2, P.body[1]);
}

// ------------------------------------------------------------------ animados
function waveThread(x, y, len, ph, col) {
  return (ctx, t) => {
    ctx.fillStyle = col;
    for (let k = 0; k < len; k++) {
      const a = k / len;
      ctx.fillRect(Math.round(x + Math.sin(t * 1.7 + ph + k * 0.18) * a * 4), y + k, 1, 1);
    }
    ctx.fillStyle = GOLD.hi;
    ctx.fillRect(Math.round(x + Math.sin(t * 1.7 + ph + len * 0.18) * 4), y + len, 1, 1);
  };
}
function debrisAnim(spr, x, y, ph) {
  return (ctx, t) => {
    const bob = Math.round(Math.sin(t * 1.1 + ph) * 3);
    const sw = Math.round(Math.sin(t * 0.5 + ph) * 1.5);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PINK;
    ctx.fillRect(x + sw + 2, y + bob + spr.h + 2, spr.w - 4, 1);
    ctx.globalAlpha = 1;
    ctx.drawImage(spr.canvas, x + sw, y + bob);
    // fiapo solto pendurado
    ctx.fillStyle = GOLD.lo;
    for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(x + sw + spr.w / 2 + Math.sin(t * 2 + ph + k * 0.5) * k * 0.4), y + bob + spr.h + k, 1, 1);
  };
}
function riftAnim(x, y, ph) {
  return (ctx, t) => {
    const p = 0.5 + 0.5 * Math.sin(t * 2.3 + ph);
    ctx.globalAlpha = 0.5 + 0.5 * p;
    ctx.drawImage(SPR.riftHalo.canvas, x + 4 - 21, y + 11 - 21);
    ctx.globalAlpha = 1;
    ctx.drawImage(SPR.rift.canvas, x, y);
    // faíscas sugadas para dentro
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.6 + ph + i * 0.25) % 1, a = i * 1.7 + ph;
      ctx.fillStyle = i & 1 ? GOLD.md : '#ffd0e8';
      ctx.globalAlpha = k;
      ctx.fillRect(Math.round(x + 4 + Math.cos(a) * (1 - k) * 14), Math.round(y + 11 + Math.sin(a) * (1 - k) * 12), 1, 1);
    }
    ctx.globalAlpha = 1;
  };
}
function stitchPulse(x0, x1, y) {
  return (ctx, t) => {
    for (let x = x0; x < x1; x++) {
      if (((x % 6) + 6) % 6 !== 0) continue;
      const a = 0.5 + 0.5 * Math.sin(t * 3 - x * 0.09);
      if (a < 0.35) continue;
      ctx.globalAlpha = (a - 0.35) * 1.5;
      ctx.fillStyle = GOLD.hi;
      ctx.fillRect(x, y, 4, 1);
      if (a > 0.85) { ctx.globalAlpha = (a - 0.85) * 3; ctx.drawImage(SPR.stitchGlow.canvas, x - 4, y - 6); }
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ decorate
function decorate(map, rng, data) {
  if (!SPR) SPR = buildSprites();
  const out = [];
  const rows = data?.map || [];
  const chAt = (tx, ty) => (rows[ty] && rows[ty][tx]) || '.';
  const isAir = (tx, ty) => { const t = map.get(tx, ty); return (t === T.EMPTY || t === T.BG) && chAt(tx, ty) === '.'; };
  const open = (tx, ty) => map.get(tx, ty) === T.EMPTY && chAt(tx, ty) === '.';
  const surf = (tx, ty) => map.get(tx, ty) === T.SOLID && isAir(tx, ty - 1);
  const under = (tx, ty) => solidLike(map.get(tx, ty)) && open(tx, ty + 1);
  // ---- agulhas/espirais de fio gigantes ao fundo (paleta conforme o horário)
  {
    const P = SPIRE_PAL[data?.timeOfDay || 'dusk'] || SPIRE_PAL.dusk;
    const headroom = (tx, ty, k) => { for (let i = 1; i <= k; i++) if (!open(tx, ty - i)) return false; return true; };
    let tx = rng.int(3, 8);
    while (tx < map.cols - 2) {
      for (let ty = 2; ty < map.rows; ty++) if (map.get(tx, ty) === T.SOLID && open(tx, ty - 1) && headroom(tx, ty, 4)) {
        const bx = tx * 16 + 8, by = ty * 16 + 3, hgt = rng.int(50, 96), wid = rng.int(4, 7), seed = tx * 131 + ty;
        out.push({ x: bx - wid - 12, y: by - hgt - 6, w: wid * 2 + 24, h: hgt + 8, layer: 'back', paint: (pc) => paintSpire(pc, bx, by, hgt, wid, seed, P) });
        break;
      }
      tx += rng.int(7, 13);
    }
  }
  let lastBtn = -99, lastRift = -99, lastPin = -99;
  for (let ty = 1; ty < map.rows; ty++) {
    let run = -1;
    const endRun = (tx) => { if (run >= 0 && tx - run >= 2) out.push({ x: run * 16, y: ty * 16 - 4, w: (tx - run) * 16, h: 12, layer: 'back', anim: stitchPulse(run * 16 + 6, tx * 16 - 6, ty * 16 + 5) }); run = -1; };
    for (let tx = 0; tx < map.cols; tx++) {
      const wx = tx * 16, wy = ty * 16, seed = (tx * 92821 + ty * 68917) >>> 0;
      const s = surf(tx, ty);
      if (s) {
        if (run < 0) run = tx;
        if (tx - run >= 9) { endRun(tx); run = tx; }
        out.push({ x: wx, y: wy - 6, w: 18, h: 7, layer: 'back', paint: (pc) => paintFringe(pc, wx, wy, seed) });
        const r = rng();
        if (r < 0.1 && tx - lastBtn > 3) {
          lastBtn = tx; const spr = SPR.buttons[rng.int(0, SPR.buttons.length - 1)], bx = wx + rng.int(1, 6);
          out.push({ x: bx, y: wy - 6, w: 9, h: 9, layer: 'back', paint: (pc) => pc.blit(spr, bx, wy - 6) });
        } else if (r < 0.2 && tx - lastPin > 2) {
          lastPin = tx; const spr = SPR.pins[rng.int(0, SPR.pins.length - 1)], px = wx + rng.int(2, 9);
          out.push({ x: px, y: wy - 10, w: 7, h: 12, layer: 'front', paint: (pc) => pc.blit(spr, px, wy - 10) });
        } else if (r < 0.26 && tx - lastRift > 8 && open(tx, ty - 2) && open(tx, ty - 1)) {
          lastRift = tx; const rx = wx + 4, ry = wy - 30;
          out.push({ x: rx - 18, y: ry - 10, w: 44, h: 44, layer: 'back', anim: riftAnim(rx, ry, rng() * 6), light: { r: 44, color: PINK, i: 0.7, flicker: 0.25 } });
        }
      } else endRun(tx);
      // embaixo de tecido/ponte: fios pendurados (estáticos + alguns ondulando)
      if ((under(tx, ty) || (map.get(tx, ty) === T.ONEWAY && open(tx, ty + 1))) && rng() < 0.55) {
        const hx = wx + rng.int(2, 13), len = rng.int(6, 18);
        if (rng() < 0.35) out.push({ x: hx - 6, y: wy + 14, w: 13, h: len + 4, layer: 'back', anim: waveThread(hx, wy + 15, len, rng() * 6, rng() < 0.6 ? GOLD.lo : '#b04a8a') });
        else out.push({ x: hx - 6, y: wy + 14, w: 14, h: len + 6, layer: 'back', paint: (pc) => paintHangThread(pc, hx, wy + 15, len, seed) });
      }
    }
    endRun(map.cols);
  }
  // ---- destroços flutuando em espaços abertos
  for (let tx = 4; tx < map.cols - 4; tx += rng.int(6, 11)) {
    const ty = rng.int(2, map.rows - 6);
    let ok = true;
    for (let j = -1; j <= 2 && ok; j++) for (let i = -1; i <= 1; i++) if (!open(tx + i, ty + j)) { ok = false; break; }
    if (!ok) continue;
    const spr = SPR.debris[rng.int(0, SPR.debris.length - 1)], x = tx * 16 + 2, y = ty * 16 + 2;
    out.push({ x: x - 4, y: y - 6, w: spr.w + 8, h: spr.h + 16, layer: 'back', anim: debrisAnim(spr, x, y, rng() * 6) });
  }
  return out;
}

// ------------------------------------------------------------------ registro
registerTileset('w5', {
  skyColor: '#2a0624',
  solid: drawFabric,
  alt: drawRuin,
  oneway: drawBridge,
  spike: drawNeedles,
  bg: drawLoom,
  water: { body: '#7a1a5a', top: '#ff9ad0', deep: '#2a0630', highlight: '#fff0f8', alpha: 0.76 },
  decorate,
});

// ------------------------------------------------------------------ fase-vitrine (?level=test_w5v)
function showcaseMap() {
  const W = 90, H = 30;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const R = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < W) g[j][i] = c; };
  R(0, 24, W, 6, '#');                                    // chão de tecido
  R(0, 4, 3, 20, '#');                                    // parede esquerda
  R(3, 19, 4, 1, '='); R(5, 15, 4, 1, '='); R(3, 11, 3, 2, '%');
  R(10, 21, 6, 3, '#'); R(12, 20, 3, 1, '#');             // morrinho
  R(14, 13, 8, 2, '#'); R(15, 15, 5, 1, '^');             // ilha com agulhas para baixo
  R(22, 24, 9, 1, '.'); R(22, 25, 9, 3, '~');             // poça de fio derretido
  R(25, 20, 4, 1, '=');
  R(33, 23, 4, 1, '^');                                   // agulhas para cima
  R(37, 19, 6, 1, '=');
  R(45, 12, 2, 12, '#'); R(44, 16, 1, 3, '^'); R(47, 16, 1, 3, '^'); // pilar com agulhas ← →
  R(50, 14, 8, 3, '%'); R(52, 17, 4, 1, '^');             // ruína flutuante
  R(59, 23, 4, 1, '%'); R(60, 22, 3, 1, '%'); R(61, 21, 2, 1, '%'); // escada de ruínas
  R(64, 17, 5, 1, '=');
  R(70, 6, 18, 18, '#'); R(72, 9, 14, 15, ':'); R(70, 21, 2, 3, 'H'); // tear interno + parede falsa
  R(74, 19, 5, 1, '='); R(80, 15, 5, 1, '='); R(82, 12, 3, 1, '%'); R(75, 12, 3, 1, '=');
  g[23][8] = 'P'; g[11][84] = 'E'; g[23][41] = 'K';
  g[23][18] = 'o'; g[13][53] = 'o'; g[22][78] = 'o';
  g[3][1] = '*'; g[11][76] = '*'; g[19][13] = '*';
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w5v', world: 0, index: 0, name: 'Vitrine do Coração', subtitle: 'Teste de arte',
  tileset: 'w5', background: 'w5', music: null, parTime: 120, darkness: 0,
  map: showcaseMap(),
});
