// =============================================================================
// art/tiles_w3.js — Tileset do Mundo 3: CIDADE DOS RELÓGIOS QUEBRADOS.
//
// Ruas suspensas: meio-fio de latão rebitado + paralelepípedos com musgo nas
// frestas (variantes: chapa de latão estriada, bueiro com brilho âmbar,
// pedra faltando), alvenaria creme → malva → violeta → sombra azul-petróleo,
// reboco rachado mostrando tijolos, chapas de cobre com azinhavre e, no fundo
// das massas, a MÁQUINA da cidade (engrenagens e canos). Acabamento de latão
// sob as ruas suspensas, cantos arredondados e cantos internos (autotiling).
// alt: blocos de maquinário (caixa rebitada, mostrador de relógio, manômetro,
// janela de engrenagem). oneway: passarelas de ferro com treliça (e grade via
// decor) ou PONTEIROS DE RELÓGIO gigantes. spike: ponteiros quebrados e dentes
// de engrenagem (4 direções). bg: interior de torre de relógio.
// decorate(): postes a gás (luz tremulante + mariposas), relógios de pêndulo,
// engrenagens girando (quadros pré-renderizados, pares que engrenam), relógios
// de ponteiros enlouquecidos, vapor, pombos que bicam e fogem do Tico, placas
// em algarismos romanos, vasos de flores, cartazes, canos, correntes,
// lanternas penduradas balançando, pêndulos nas torres.
// Tudo pré-renderizado: decor animado só faz drawImage + poucos fillRect.
// Também registra a fase-vitrine 'test_w3v' (?level=test_w3v).
// =============================================================================
import { registerTileset, registerLevel, registerEntity } from '../registry.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { T } from '../../engine/tilemap.js';
import { Entity } from '../../engine/entity.js';

const TAU = Math.PI * 2;
// ------------------------------------------------------------------ utilidades
const h2 = (x, y, s = 0) => {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const th = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const fr = (v) => ((v % 1) + 1) % 1;
/** rng local determinístico (decor pode ser pintado várias vezes, uma por chunk). */
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const solidLike = (t) => t === T.SOLID || t === T.ALT || t === T.FAKE;

// ------------------------------------------------------------------ paleta
const OUT = '#140c16';
const BRASS = { hi: '#fff0b0', lt: '#f0c860', md: '#c89438', dk: '#8a5a24', sh: '#4e3018' };
const COP = { hi: '#ffb888', lt: '#e07848', md: '#a8502e', dk: '#6a2e20', pat: '#6ac8a8', pat2: '#3a8a7c' };
const IRON = { hi: '#a8a4c4', md: '#6a6688', dk: '#3e3a56', sh: '#262238' };
const STEEL = { hi: '#a8a8ec', md: '#5e5eb0', dk: '#363676' }; // aço azulado dos ponteiros
const MOSS = { hi: '#a8d860', md: '#6aa040', dk: '#3e6a34' };
const CREAM = { hi: '#fff8e4', md: '#f2e2bc', dk: '#c8b08a' };
const STONE = [ // alvenaria por profundidade: creme → malva → violeta → petróleo
  { base: ['#e6cfa6', '#dbc296', '#efdab2'], hi: '#fff0cc', dk: '#b8977a', mortar: '#8a6a5e' },
  { base: ['#b2908a', '#a6847f', '#bd9b92'], hi: '#cfb0a2', dk: '#86686c', mortar: '#5e4656' },
  { base: ['#5e5070', '#554868', '#685a7a'], hi: '#74688c', dk: '#443a56', mortar: '#2e263e' },
  { base: ['#1d3640', '#1a313a', '#203b45'], hi: '#284a52', dk: '#142830', mortar: '#0e1c24' },
];
const COB = { hi: '#d8ccc4', lt: '#b4a4a4', md: '#968490', dk: '#6c5c6c', mortar: '#3a2e40' }; // paralelepípedos
const PLAST = [ // reboco creme (com tijolos à mostra)
  { a: '#f2e0bc', b: '#e6d0a8', dk: '#a88a6c', brick: ['#c86a4a', '#b05a40'], bm: '#6a3a30' },
  { a: '#c4a49c', b: '#b49490', dk: '#7a5e64', brick: ['#8a4a48', '#7a4040'], bm: '#4a2a34' },
];
const COPL = [ // chapas de cobre por profundidade
  { hi: '#f0a070', md: '#c0643a', lt: '#d27a4a', dk: '#7a3a24' },
  { hi: '#b87060', md: '#8a4834', lt: '#9a5640', dk: '#52281e' },
];
const MACH = { hi: '#335e5c', md: '#27494e', dk: '#0f2228', brass: '#8a6a38', pipe: ['#4a3c3a', '#33302f', '#5e4a40'] };
const TOWER = { brick: ['#2a2440', '#262038', '#2e2846'], mortar: '#1a1628', pil: '#3a2c3c', pilHi: '#52404c', dk: '#14101e', gear: '#322c4e', gearHi: '#3c3658', wain: ['#30222e', '#281c28'], mold: '#8a6434', moldHi: '#c09a52' };

// ------------------------------------------------------------------ sólido: rua suspensa + alvenaria + máquina
function countSolid(map, tx, ty, dx, dy, max) {
  let k = 0;
  while (k < max) {
    const x = tx + dx * (k + 1), y = ty + dy * (k + 1);
    if (y >= map.rows || solidLike(map.get(x, y))) k++; else break;
  }
  return k;
}
/** Engrenagens e canos do interior profundo (contínuos entre tiles). null = nada. */
function machinePx(wx, wy) {
  // canos (na frente das engrenagens)
  const pr = ((wy % 52) + 52) % 52;
  if (pr >= 24 && pr <= 27 && h2(Math.floor(wx / 48), Math.floor(wy / 52), 81) < 0.5) {
    const fl = (wx % 24) < 2;
    return fl ? (pr === 24 ? MACH.brass : MACH.pipe[2]) : pr === 24 ? MACH.pipe[2] : pr === 27 ? MACH.dk : MACH.pipe[0];
  }
  const pc = ((wx % 60) + 60) % 60;
  if (pc >= 40 && pc <= 43 && h2(Math.floor(wy / 48), Math.floor(wx / 60), 82) < 0.45) {
    const fl = (wy % 20) < 2;
    return fl ? (pc === 40 ? MACH.brass : MACH.pipe[2]) : pc === 40 ? MACH.pipe[2] : pc === 43 ? MACH.dk : MACH.pipe[1];
  }
  const GC = 30;
  const cx = Math.floor(wx / GC), cy = Math.floor(wy / GC);
  const hv = h2(cx, cy, 77);
  if (hv > 0.42) return null;
  const ccx = cx * GC + 15 + Math.round((h2(cx, cy, 78) - 0.5) * 4);
  const ccy = cy * GC + 15 + Math.round((h2(cx, cy, 79) - 0.5) * 4);
  const r = 5 + Math.floor(h2(cx, cy, 80) * 7);
  const dx = wx + 0.5 - ccx, dy = wy + 0.5 - ccy, d = Math.hypot(dx, dy);
  if (d > r + 2.4) return null;
  const a = Math.atan2(dy, dx) + hv * 10;
  const lit = (-dx - dy) / (d || 1);
  if (d > r) return fr((a * (r + 3)) / TAU) < 0.5 ? (lit > 0.2 ? MACH.hi : MACH.md) : null;
  if (d > r - 2) return lit > 0.3 ? MACH.hi : MACH.md;
  if (d < 1.6) return MACH.brass;
  if (d < 3.2) return MACH.md;
  const sa = fr((a * 5) / TAU);
  return Math.min(sa, 1 - sa) * (TAU / 5) * d < 1.1 ? MACH.md : MACH.dk;
}
function masonry(wx, wy, lev) {
  const S = STONE[lev];
  const course = Math.floor(wy / 6), r = wy - course * 6;
  if (r === 5) return S.mortar;
  const W = h2(course, 1, 90) < 0.5 ? 12 : 15;
  const off = Math.floor(h2(course, 2, 91) * W);
  const bi = Math.floor((wx + off) / W), bx = wx + off - bi * W;
  if (bx === 0) return S.mortar;
  const hv = h2(bi, course, 92);
  const hh = h2(wx, wy, 93);
  if (hh < 0.03) return S.dk;
  if (r === 0 && bx < W - 1) return hv > 0.25 ? S.hi : S.base[2];
  if (r === 4 || bx === W - 1) return S.dk;
  if (hh > 0.985) return S.hi;
  // musgo/fuligem na argamassa perto da superfície
  return S.base[(hv * 3) | 0];
}
function plaster(wx, wy, lev) {
  const P = PLAST[lev];
  const cx = Math.floor(wx / 40), cy = Math.floor(wy / 36);
  const pcx = cx * 40 + 10 + h2(cx, cy, 95) * 20, pcy = cy * 36 + 8 + h2(cx, cy, 96) * 20;
  const prx = 5 + h2(cx, cy, 97) * 7, pry = 3 + h2(cx, cy, 98) * 4;
  const e = ((wx - pcx) / prx) ** 2 + ((wy - pcy) / pry) ** 2 + (h2(wx, wy, 99) - 0.5) * 0.6;
  if (e < 1) {
    const course = Math.floor(wy / 4), r = wy - course * 4, off = (course & 1) * 4, bx = (wx + off) % 8;
    return r === 3 || bx === 0 ? P.bm : P.brick[(h2(Math.floor((wx + off) / 8), course, 100) * 2) | 0];
  }
  if (e < 1.4) return P.dk;
  // rachadura fina
  const cr = Math.abs(((wx - cx * 40) * 0.6 + Math.sin(wy * 0.7 + cx) * 1.5) - (wy - cy * 36));
  if (h2(cx, cy, 102) < 0.5 && cr < 0.6 && (wy - cy * 36) < 14) return P.dk;
  return th(wx, wy) < 0.25 + 0.3 * h2(wx >> 2, wy >> 2, 101) ? P.b : P.a;
}
function copperPlate(wx, wy, lev) {
  const C = COPL[lev];
  const px = ((wx % 16) + 16) % 16, py = ((wy % 12) + 12) % 12;
  if (px === 0 || py === 11) return C.dk;
  if (py === 0) return C.hi;
  const riv = (px === 2 || px === 13) && (py === 2 || py === 9);
  if (riv) return C.hi;
  if ((px === 3 || px === 14) && (py === 3 || py === 10)) return C.dk;
  // azinhavre escorrendo dos rebites
  if ((px === 2 || px === 13) && py > 2 && py < 8 && h2(Math.floor(wx / 16) * 2 + (px > 8), Math.floor(wy / 12), 103) < 0.55 && py < 3 + h2(wx, Math.floor(wy / 12), 104) * 6) return lev ? COP.pat2 : COP.pat;
  return th(wx, wy) < 0.18 ? C.lt : C.md;
}

function drawStreet(pc, x, y, n0, rng, info) {
  const { tx, ty, map } = info;
  if (info.type === T.FAKE && altFakeSet(map).has(tx + ',' + ty)) return drawMachine(pc, x, y, n0, rng, info);
  const bottomRow = ty >= map.rows - 1;
  const n = bottomRow ? { ...n0, d: true, dl: true, dr: true } : n0;
  const MAX = 3;
  const ku = n.u ? 1 + countSolid(map, tx, ty - 1, 0, -1, MAX - 1) : 0;
  const kd = n.d ? 1 + countSolid(map, tx, ty + 1, 0, 1, MAX - 1) : 0;
  const kl = n.l ? 1 + countSolid(map, tx - 1, ty, -1, 0, MAX - 1) : 0;
  const kr = n.r ? 1 + countSolid(map, tx + 1, ty, 1, 0, MAX - 1) : 0;
  const diag = (n.u && n.l && !n.ul) || (n.u && n.r && !n.ur) || (n.d && n.l && !n.dl) || (n.d && n.r && !n.dr);
  const levAt = new Int8Array(256);
  for (let ly = 0; ly < 16; ly++) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, wy = ty * 16 + ly;
      let d = 99;
      if (ku < MAX) d = Math.min(d, ku * 16 + ly);
      if (kd < MAX) d = Math.min(d, kd * 16 + 15 - ly + 6);
      if (kl < MAX) d = Math.min(d, kl * 16 + lx + 2);
      if (kr < MAX) d = Math.min(d, kr * 16 + 15 - lx + 2);
      if (diag) {
        if (n.u && n.l && !n.ul) d = Math.min(d, Math.hypot(lx + 0.5, ly + 0.5) + 2);
        if (n.u && n.r && !n.ur) d = Math.min(d, Math.hypot(15.5 - lx, ly + 0.5) + 2);
        if (n.d && n.l && !n.dl) d = Math.min(d, Math.hypot(lx + 0.5, 15.5 - ly) + 6);
        if (n.d && n.r && !n.dr) d = Math.min(d, Math.hypot(15.5 - lx, 15.5 - ly) + 6);
      }
      const f = Math.max(0, Math.min(3, (d - 5) / 11.5));
      let lev = Math.floor(f);
      if (lev < 3 && f - lev > th(wx, wy)) lev++;
      levAt[ly * 16 + lx] = lev;
      let c;
      if (lev === 3) c = machinePx(wx, wy) || masonry(wx, wy, 3);
      else {
        const reg = h2(Math.floor(wx / 40), Math.floor(wy / 36), 94);
        if (lev <= 1 && reg < 0.26) c = plaster(wx, wy, lev);
        else if (lev <= 1 && reg < 0.38) c = copperPlate(wx, wy, lev);
        else c = masonry(wx, wy, lev);
      }
      pc.px(x + lx, y + ly, c);
    }
  }
  // ---- topo: meio-fio de latão + paralelepípedos (ou chapa / bueiro)
  if (!n.u) {
    const seg = h2(Math.floor(tx / 3), ty, 20);
    const plate = seg < 0.2;
    const grate = !plate && n.l && n.r && h2(tx, ty, 21) < 0.1;
    const hole = !plate && !grate && h2(tx, ty, 22) < 0.14 ? 1 + Math.floor(h2(tx, ty, 23) * 2) : -1;
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      const seam = (wx & 31) === 0;
      const riv = (wx & 7) === 3;
      pc.px(x + lx, y, OUT);
      pc.px(x + lx, y + 1, seam ? BRASS.md : BRASS.hi);
      pc.px(x + lx, y + 2, seam ? BRASS.dk : riv ? '#fffbe8' : BRASS.lt);
      pc.px(x + lx, y + 3, seam ? BRASS.dk : riv ? BRASS.dk : BRASS.md);
      pc.px(x + lx, y + 4, BRASS.sh);
      for (let ly = 5; ly <= 12; ly++) {
        const wy = ty * 16 + ly;
        let c;
        if (plate) {
          const pxm = wx & 15;
          if (ly === 12) c = OUT;
          else if (ly === 5) c = BRASS.lt;
          else if (pxm === 0) c = BRASS.sh;
          else if ((pxm === 2 || pxm === 13) && (ly === 6 || ly === 10)) c = BRASS.hi;
          else if (((wx + wy) & 3) === 0 && ((wx - wy) & 3) === 0) c = BRASS.lt;
          else if (((wx + wy) & 3) === 2 && ((wx - wy) & 3) === 2) c = BRASS.dk;
          else c = ly === 11 ? BRASS.dk : (h2(wx, wy, 24) < 0.04 ? COP.pat2 : BRASS.md);
        } else {
          // dois cursos de pedras 5x3 (argamassa nas linhas 8 e 12)
          if (ly === 8 || ly === 12) {
            c = h2(wx, wy, 25) < (ly === 12 ? 0.18 : 0.3) ? (h2(wx, wy, 26) < 0.5 ? MOSS.md : MOSS.dk) : COB.mortar;
            if (ly === 12 && c === COB.mortar) c = OUT;
          } else {
            const course = ly < 8 ? 0 : 1, j = ly - (course ? 9 : 5);
            const off = course * 3 + ((ty * 5) & 7);
            const si = Math.floor((wx + off) / 6), i = wx + off - si * 6;
            if (i === 5) c = h2(si, ty * 2 + course, 27) < 0.25 ? MOSS.dk : COB.mortar;
            else if ((i === 0 || i === 4) && (j === 0 || j === 2)) c = COB.mortar;
            else {
              const tone = h2(si, ty * 2 + course, 28);
              const base = tone < 0.33 ? COB.md : tone < 0.8 ? COB.lt : '#a8949a';
              c = j === 0 && i < 4 ? (tone < 0.33 ? COB.lt : COB.hi) : (i === 4 || j === 2) ? COB.dk : base;
              if (hole === course && i < 5 && Math.floor(si) % 3 === 1) c = j === 0 ? COB.mortar : '#1a1424';
            }
          }
        }
        pc.px(x + lx, y + ly, c);
      }
    }
    if (grate) {
      for (let ly = 5; ly <= 11; ly++) for (let lx = 3; lx <= 12; lx++) {
        const edge = lx === 3 || lx === 12 || ly === 5 || ly === 11;
        let c = edge ? BRASS.dk : (lx & 1) ? IRON.md : '#0c0a14';
        if (!edge && !(lx & 1) && ly >= 9) c = ly === 10 ? '#c8641e' : '#5a2a14'; // brilho da máquina lá embaixo
        if (edge && (ly === 5)) c = BRASS.md;
        pc.px(x + lx, y + ly, c);
      }
    }
  }
  // ---- fundo: acabamento de latão sob ruas suspensas
  if (!n.d && !bottomRow) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      pc.px(x + lx, y + 12, OUT);
      pc.px(x + lx, y + 13, (wx & 7) === 5 ? BRASS.hi : BRASS.md);
      pc.px(x + lx, y + 14, BRASS.dk);
      pc.px(x + lx, y + 15, OUT);
    }
  }
  // ---- laterais: cantaria (luz da esquerda)
  if (!n.l) {
    for (let ly = 0; ly < 16; ly++) {
      pc.px(x, y + ly, OUT);
      if (ly === 0 || ly === 15) continue;
      if (!n.u && ly <= 4) pc.px(x + 1, y + ly, ly === 4 ? BRASS.dk : BRASS.hi);
      else if (!n.d && ly >= 12) pc.px(x + 1, y + ly, ly === 12 ? OUT : BRASS.lt);
      else pc.px(x + 1, y + ly, STONE[levAt[ly * 16 + 1]].hi);
    }
  }
  if (!n.r) {
    for (let ly = 0; ly < 16; ly++) {
      pc.px(x + 15, y + ly, OUT);
      if (ly === 0 || ly === 15) continue;
      if (!n.u && ly <= 4) pc.px(x + 14, y + ly, BRASS.dk);
      else if (!n.d && ly >= 12) pc.px(x + 14, y + ly, ly === 12 ? OUT : BRASS.sh);
      else pc.px(x + 14, y + ly, STONE[levAt[ly * 16 + 14]].dk);
    }
  }
  // ---- cantos internos: o meio-fio entra na quina
  if (n.u && n.l && !n.ul) { pc.px(x, y, OUT); pc.px(x, y + 1, BRASS.md); pc.px(x, y + 2, BRASS.dk); pc.px(x + 1, y, BRASS.dk); pc.px(x, y + 3, BRASS.sh); }
  if (n.u && n.r && !n.ur) { pc.px(x + 15, y, OUT); pc.px(x + 15, y + 1, BRASS.dk); pc.px(x + 15, y + 2, BRASS.sh); pc.px(x + 14, y, BRASS.sh); }
  if (n.d && n.l && !n.dl && !bottomRow) { pc.px(x, y + 15, OUT); pc.px(x + 1, y + 15, BRASS.dk); }
  if (n.d && n.r && !n.dr && !bottomRow) { pc.px(x + 15, y + 15, OUT); pc.px(x + 14, y + 15, BRASS.dk); }
  // ---- cantos externos arredondados
  const cut = (a, b, c2, dd) => { pc.erase(x + a[0], y + a[1]); pc.erase(x + b[0], y + b[1]); pc.erase(x + c2[0], y + c2[1]); pc.px(x + dd[0], y + dd[1], OUT); };
  if (!n.u && !n.l) cut([0, 0], [1, 0], [0, 1], [1, 1]);
  if (!n.u && !n.r) cut([15, 0], [14, 0], [15, 1], [14, 1]);
  if (!n.d && !n.l && !bottomRow) cut([0, 15], [1, 15], [0, 14], [1, 14]);
  if (!n.d && !n.r && !bottomRow) cut([15, 15], [14, 15], [15, 14], [14, 14]);
}

// ------------------------------------------------------------------ alt: blocos de maquinário
function frame(pc, x, y, P) {
  pc.rect(x, y, 16, 16, OUT);
  pc.rect(x + 1, y + 1, 14, 14, P.md);
  pc.hline(x + 1, y + 1, 14, P.hi); pc.vline(x + 1, y + 2, 12, P.lt);
  pc.hline(x + 1, y + 14, 14, P.dk); pc.vline(x + 14, y + 1, 13, P.dk);
  for (const [rx, ry] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { pc.px(x + rx, y + ry, P.hi); pc.px(x + rx + 1, y + ry + 1, P.dk); }
}
function handPx(pc, cx, cy, a, len, c) {
  for (let k = 1; k <= len; k++) pc.px(Math.round(cx + Math.sin(a) * k - 0.5), Math.round(cy - Math.cos(a) * k - 0.5), c);
}
function smallGear(pc, cx, cy, r, teeth, rot, P) {
  for (let yy = -r - 2; yy <= r + 2; yy++) for (let xx = -r - 2; xx <= r + 2; xx++) {
    const dx = xx + 0.5, dy = yy + 0.5, d = Math.hypot(dx, dy);
    if (d > r + 1.6) continue;
    const a = Math.atan2(dy, dx) - rot, lit = (-dx - dy) / (d || 1);
    let c = null;
    if (d > r) { if (fr((a * teeth) / TAU) < 0.5) c = lit > 0.2 ? P.hi : P.md; }
    else if (d > r - 1.5) c = lit > 0.3 ? P.hi : lit < -0.4 ? P.dk : P.md;
    else if (d < 1.2) c = P.hi;
    else c = d < 2.2 ? P.md : P.dk;
    if (c) pc.px(Math.floor(cx + xx), Math.floor(cy + yy), c);
  }
}
// ------------------------------------------------------------------ alt (massas grandes): PRÉDIO de tijolos
// Massas de '%' com 3+ tiles de altura e 2+ de largura viram fachada de prédio:
// tijolo cor de cobre, cornija de latão no topo, cunhais de pedra nas quinas,
// faixas entre andares e janelas em arco (acesas à noite, céu refletido de dia),
// às vezes um óculo-relógio. Blocos pequenos continuam como caixas de maquinário.
const BRK = { base: ['#8e4c3c', '#844636', '#9a5444'], hi: '#b4664c', dk: '#5e2e28', mortar: '#46242c', soot: '#6a3430' };
/** Paredes falsas (H) dentro de prédios de '%' se disfarçam de prédio (sem emenda de textura). */
const FAKE_CTX = new WeakMap();
function altFakeSet(map) {
  let set = FAKE_CTX.get(map);
  if (set) return set;
  set = new Set();
  const seen = new Uint8Array(map.cols * map.rows);
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
    if (seen[y * map.cols + x] || map.get(x, y) !== T.FAKE) continue;
    const cells = [], st = [[x, y]]; seen[y * map.cols + x] = 1;
    let alt = 0, sol = 0;
    while (st.length) {
      const [cx, cy] = st.pop(); cells.push(cx + ',' + cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, o = map.get(nx, ny);
        if (o === T.FAKE && map.inBounds(nx, ny)) { if (!seen[ny * map.cols + nx]) { seen[ny * map.cols + nx] = 1; st.push([nx, ny]); } }
        else if (o === T.ALT) alt++; else if (o === T.SOLID) sol++;
      }
    }
    if (alt > sol) for (const c of cells) set.add(c);
  }
  FAKE_CTX.set(map, set);
  return set;
}
const altLike = (map, x, y) => { const o = map.get(x, y); return o === T.ALT || (o === T.FAKE && altFakeSet(map).has(x + ',' + y)); };
function altRun(map, tx, ty, dx, dy, max) {
  let k = 0;
  while (k < max && altLike(map, tx + dx * (k + 1), ty + dy * (k + 1))) k++;
  return k;
}
function litChance(level) { const tod = level?.timeOfDay; return tod === 'night' ? 0.62 : tod === 'day' ? 0.12 : 0.42; }
function archWindow(pc, x, y, w, h, lit, day, seed) {
  // moldura escura com topo em arco
  pc.rect(x, y + 2, w, h - 2, OUT); pc.rect(x + 1, y + 1, w - 2, 1, OUT); pc.rect(x + 2, y, w - 4, 1, OUT);
  const gx = x + 1, gy = y + 2, gw = w - 2, gh = h - 3;
  const glass = lit ? '#ffc860' : day ? '#8a9ad0' : '#2a2442';
  const glass2 = lit ? '#ffe9a8' : day ? '#b8c8f0' : '#3e3864';
  pc.rect(gx, gy, gw, gh, glass); pc.rect(gx + 1, gy - 1, gw - 2, 1, glass);
  if (lit) { pc.rect(gx, gy + gh - 2, gw, 2, '#e8963c'); pc.px(gx + 1, gy, glass2); pc.px(gx + 1, gy + 1, glass2); if (seed < 0.3) { pc.rect(gx + gw - 2, gy + 2, 2, gh - 4, '#b0603a'); } }
  else { pc.line(gx, gy + 3, gx + 2, gy + 1, glass2); pc.px(gx + gw - 1, gy + gh - 1, glass2); }
  pc.vline(x + (w >> 1), gy - 1, gh + 1, BRASS.dk); pc.hline(gx, gy + (gh >> 1), gw, BRASS.dk);
  pc.hline(x - 1, y + h - 1, w + 2, BRASS.lt); pc.hline(x - 1, y + h, w + 2, BRASS.sh);
}
function drawAltBuilding(pc, x, y, n, rng, info, k) {
  const { tx, ty, level } = info;
  const lit = litChance(level), day = level?.timeOfDay === 'day';
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    const course = Math.floor(wy / 4), r = wy - course * 4, off = (course & 1) * 4, bi = Math.floor((wx + off) / 8), bx = (wx + off) - bi * 8;
    let c;
    if (r === 3 || bx === 0) c = BRK.mortar;
    else if (r === 0 && bx < 7) c = h2(bi, course, 140) < 0.3 ? BRK.hi : BRK.base[2];
    else if (bx === 7) c = BRK.dk;
    else c = BRK.base[(h2(bi, course, 141) * 3) | 0];
    if (h2(wx, wy, 142) < 0.025) c = BRK.dk;
    pc.px(x + lx, y + ly, c);
  }
  // faixa entre andares (a cada 2 tiles a partir do topo)
  if (k.u > 0 && k.u % 2 === 0) {
    pc.hline(x, y, 16, OUT); pc.hline(x, y + 1, 16, CREAM.md); pc.hline(x, y + 2, 16, CREAM.dk); pc.hline(x, y + 3, 16, BRK.mortar);
    for (let lx = 1; lx < 16; lx += 4) pc.px(x + lx, y + 1, CREAM.hi);
  }
  // janela (um vão por andar, colunas alternadas)
  const bay = k.l >= 1 && k.r >= 1 && k.d >= 1 && k.u >= 1 && k.u % 2 === 1 && ((k.l + (k.l + k.r) % 2) % 2 === 1);
  if (bay) {
    const hv = h2(tx, ty, 143);
    if (hv < 0.1 && k.l + k.r >= 4) { // óculo-relógio
      const cx = x + 8, cy = y + 8;
      pc.circle(cx, cy, 6.6, OUT); pc.circle(cx, cy, 5.8, BRASS.md); pc.circle(cx, cy, 4.8, CREAM.md); pc.px(cx - 3, cy - 3, CREAM.hi);
      for (let q = 0; q < 12; q += 3) { const a = (q / 12) * TAU; pc.px(Math.round(cx + Math.sin(a) * 3.6 - 0.5), Math.round(cy - Math.cos(a) * 3.6 - 0.5), OUT); }
      handPx(pc, cx, cy, h2(tx, ty, 144) * TAU, 2, OUT); handPx(pc, cx, cy, h2(tx, ty, 145) * TAU, 4, '#3a2440');
    } else archWindow(pc, x + 4, y + 2, 8, 12, hv < 0.1 + lit, day, h2(tx, ty, 146));
  }
  // cunhais de pedra nas quinas
  if (!n.l) {
    for (let ly = 0; ly < 16; ly++) {
      const wy = ty * 16 + ly, blk = Math.floor(wy / 5) & 1, edge = (wy % 5) === 4;
      pc.px(x, y + ly, OUT);
      for (let lx = 1; lx <= (blk ? 4 : 2); lx++) pc.px(x + lx, y + ly, edge ? STONE[0].mortar : lx === 1 ? STONE[0].hi : STONE[0].base[0]);
      if (!edge) pc.px(x + (blk ? 5 : 3), y + ly, STONE[0].dk);
    }
  }
  if (!n.r) {
    for (let ly = 0; ly < 16; ly++) {
      const wy = ty * 16 + ly, blk = (Math.floor(wy / 5) & 1) ^ 1, edge = (wy % 5) === 4;
      pc.px(x + 15, y + ly, OUT);
      for (let lx = 14; lx >= (blk ? 11 : 13); lx--) pc.px(x + lx, y + ly, edge ? STONE[0].mortar : lx === 14 ? STONE[1].dk : STONE[0].dk);
      if (!edge) pc.px(x + (blk ? 10 : 12), y + ly, BRK.dk);
    }
  }
  // cornija de latão no topo
  if (!n.u) {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      pc.px(x + lx, y, OUT); pc.px(x + lx, y + 1, BRASS.hi); pc.px(x + lx, y + 2, (wx & 7) === 3 ? '#fffbe8' : BRASS.lt);
      pc.px(x + lx, y + 3, BRASS.md); pc.px(x + lx, y + 4, BRASS.dk); pc.px(x + lx, y + 5, OUT);
      pc.px(x + lx, y + 6, (wx & 3) < 2 ? CREAM.dk : OUT); pc.px(x + lx, y + 7, BRK.soot);
    }
  }
  if (!n.d) {
    for (let lx = 0; lx < 16; lx++) { pc.px(x + lx, y + 12, OUT); pc.px(x + lx, y + 13, BRASS.md); pc.px(x + lx, y + 14, BRASS.dk); pc.px(x + lx, y + 15, OUT); }
  }
  const cut = (a, b, c2, dd) => { pc.erase(x + a[0], y + a[1]); pc.erase(x + b[0], y + b[1]); pc.erase(x + c2[0], y + c2[1]); pc.px(x + dd[0], y + dd[1], OUT); };
  if (!n.u && !n.l) cut([0, 0], [1, 0], [0, 1], [1, 1]);
  if (!n.u && !n.r) cut([15, 0], [14, 0], [15, 1], [14, 1]);
  if (!n.d && !n.l) cut([0, 15], [1, 15], [0, 14], [1, 14]);
  if (!n.d && !n.r) cut([15, 15], [14, 15], [15, 14], [14, 14]);
}
/** Laje de terraço sobre uma fachada de fundo: pedra creme, rufo de latão e mísulas. */
function drawTerrace(pc, x, y, n, info) {
  const { tx, ty } = info;
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    pc.px(x + lx, y + ly, ly < 8 ? masonry(wx, wy, 0) : masonry(wx, wy, 1));
  }
  for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx;
    if (!n.u) { pc.px(x + lx, y, OUT); pc.px(x + lx, y + 1, BRASS.hi); pc.px(x + lx, y + 2, (wx & 7) === 3 ? '#fffbe8' : BRASS.lt); pc.px(x + lx, y + 3, BRASS.md); pc.px(x + lx, y + 4, BRASS.sh); }
    pc.px(x + lx, y + 11, OUT); pc.px(x + lx, y + 12, CREAM.md); pc.px(x + lx, y + 13, CREAM.dk); pc.px(x + lx, y + 14, OUT);
    if ((wx & 7) < 3) pc.px(x + lx, y + 15, (wx & 7) === 0 ? OUT : CREAM.dk); // mísulas
  }
  if (!n.l) for (let ly = 0; ly < 15; ly++) { pc.px(x, y + ly, OUT); pc.px(x + 1, y + ly, ly < 5 ? BRASS.hi : STONE[0].hi); }
  if (!n.r) for (let ly = 0; ly < 15; ly++) { pc.px(x + 15, y + ly, OUT); pc.px(x + 14, y + ly, ly < 5 ? BRASS.dk : STONE[0].dk); }
  if (!n.u && !n.l) { pc.erase(x, y); pc.erase(x + 1, y); pc.erase(x, y + 1); pc.px(x + 1, y + 1, OUT); }
  if (!n.u && !n.r) { pc.erase(x + 15, y); pc.erase(x + 14, y); pc.erase(x + 15, y + 1); pc.px(x + 14, y + 1, OUT); }
}
function drawMachine(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  const k = { u: altRun(map, tx, ty, 0, -1, 40), d: altRun(map, tx, ty, 0, 1, 40), l: altRun(map, tx, ty, -1, 0, 60), r: altRun(map, tx, ty, 1, 0, 60) };
  if (k.u + k.d >= 2 && k.l + k.r >= 1) return drawAltBuilding(pc, x, y, n, rng, info, k);
  if (k.d === 0 && map.get(tx, ty + 1) === T.BG) return drawTerrace(pc, x, y, n, info);
  const v = h2(tx, ty, 30);
  if (v < 0.42) { // caixa de latão rebitada com travessas em X
    frame(pc, x, y, BRASS);
    pc.rect(x + 4, y + 4, 8, 8, '#b07e30');
    pc.line(x + 4, y + 4, x + 11, y + 11, BRASS.lt); pc.line(x + 11, y + 4, x + 4, y + 11, BRASS.lt);
    pc.line(x + 4, y + 5, x + 10, y + 11, BRASS.dk); pc.line(x + 11, y + 5, x + 5, y + 11, BRASS.dk);
    pc.strokeRect(x + 3, y + 3, 10, 10, BRASS.dk);
    pc.hline(x + 4, y + 3, 8, BRASS.sh);
  } else if (v < 0.64) { // mostrador de relógio em moldura de cobre
    frame(pc, x, y, { hi: COP.hi, lt: COP.lt, md: COP.md, dk: COP.dk });
    const cx = x + 8, cy = y + 8;
    pc.circle(cx, cy, 6.4, OUT); pc.circle(cx, cy, 5.6, CREAM.md);
    pc.ellipse(cx + 1, cy + 1, 4.6, 4.6, CREAM.md);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      pc.px(Math.round(cx + Math.sin(a) * 4.4 - 0.5), Math.round(cy - Math.cos(a) * 4.4 - 0.5), k % 3 === 0 ? OUT : CREAM.dk);
    }
    pc.px(cx - 3, cy - 3, CREAM.hi); pc.px(cx - 2, cy - 4, CREAM.hi);
    const ha = h2(tx, ty, 31) * TAU, ma = h2(tx, ty, 32) * TAU;
    handPx(pc, cx, cy, ha, 2, OUT); handPx(pc, cx, cy, ma, 4, '#3a2440');
    pc.px(cx - 1, cy - 1, BRASS.lt);
    if (h2(tx, ty, 33) < 0.6) { const s = h2(tx, ty, 34) < 0.5 ? 1 : -1; pc.line(cx + 1, cy - 5 * s, cx + 3, cy + s, CREAM.dk); pc.line(cx + 3, cy + s, cx + 2, cy + 4 * s, CREAM.dk); }
  } else if (v < 0.84) { // painel com manômetro, lâmpada âmbar e cano com registro
    frame(pc, x, y, BRASS);
    pc.rect(x + 3, y + 3, 10, 10, '#1a3a40'); pc.hline(x + 3, y + 3, 10, '#0e2228'); pc.vline(x + 3, y + 3, 10, '#0e2228');
    pc.circle(x + 7, y + 7, 3.6, OUT); pc.circle(x + 7, y + 7, 2.8, CREAM.md); pc.px(x + 5, y + 5, CREAM.hi);
    handPx(pc, x + 7, y + 7, -0.6 + h2(tx, ty, 35) * 2.2, 2, '#d0302a');
    pc.rect(x + 10, y + 4, 2, 2, '#ffb840'); pc.px(x + 10, y + 4, '#fff0b0');
    pc.hline(x + 3, y + 11, 10, COP.lt); pc.hline(x + 3, y + 12, 10, COP.dk);
    pc.rect(x + 9, y + 10, 3, 3, COP.md); pc.px(x + 10, y + 9, BRASS.lt);
  } else { // janela com engrenagem de azinhavre
    frame(pc, x, y, BRASS);
    pc.rect(x + 3, y + 3, 10, 10, '#0e1e24');
    smallGear(pc, x + 8, y + 8, 3, 6, h2(tx, ty, 36) * 2, { hi: '#8ad0b8', md: '#4a8a7a', dk: '#24504a' });
    pc.line(x + 4, y + 7, x + 7, y + 4, '#ffffff40'); pc.line(x + 4, y + 9, x + 9, y + 4, '#ffffff22');
    pc.strokeRect(x + 2, y + 2, 12, 12, BRASS.dk);
  }
}

// ------------------------------------------------------------------ oneway: passarela de ferro / ponteiro gigante
function walkStyle(map, tx, ty) {
  let sx = tx;
  while (sx > 0 && map.get(sx - 1, ty) === T.ONEWAY) sx--;
  return h2(sx, ty, 40) < 0.42 ? 'hand' : 'walk';
}
/** Parede de torre por trás de tiles vazados que ficam dentro do interior (bg). */
function towerBehind(pc, x, y, rng, info) {
  const { tx, ty, map } = info;
  const B = (dx, dy) => map.get(tx + dx, ty + dy) === T.BG;
  if (!(B(-1, 0) || B(1, 0) || B(0, -1) || B(0, 1))) return;
  const nb = (dx, dy) => { const o = map.get(tx + dx, ty + dy); return o === T.BG || o === T.ONEWAY || o === T.SPIKE; };
  drawTower(pc, x, y, { u: nb(0, -1), d: nb(0, 1), l: nb(-1, 0), r: nb(1, 0) }, rng, { ...info, noFeature: true });
}
function drawWalk(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  towerBehind(pc, x, y, rng, info);
  const style = walkStyle(map, tx, ty);
  if (style === 'hand') {
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx, m = wx & 15;
      const hole = m >= 6 && m <= 9 && !(m === 6 || m === 9);
      pc.px(x + lx, y, OUT);
      pc.px(x + lx, y + 1, STEEL.hi);
      pc.px(x + lx, y + 2, hole ? OUT : STEEL.md);
      pc.px(x + lx, y + 3, hole ? OUT : STEEL.md);
      pc.px(x + lx, y + 4, STEEL.dk);
      pc.px(x + lx, y + 5, OUT);
      if (m === 5 || m === 10) { pc.px(x + lx, y + 2, STEEL.dk); pc.px(x + lx, y + 3, STEEL.dk); }
    }
    if (!n.l) { // anel do contrapeso
      for (let lx = 0; lx < 10; lx++) for (let i = 0; i < 9; i++) pc.erase(x + lx, y + i);
      pc.circle(x + 5.5, y + 4, 5.2, OUT); pc.circle(x + 5.5, y + 4, 4.3, STEEL.md);
      pc.ellipse(x + 4.5, y + 3, 2.6, 2.4, STEEL.hi); pc.circle(x + 5.5, y + 4, 2.6, STEEL.md);
      pc.circle(x + 5.5, y + 4, 1.6, OUT); pc.px(x + 5, y + 3, BRASS.lt);
      pc.rect(x + 10, y, 6, 6, OUT); pc.hline(x + 10, y + 1, 6, STEEL.hi); pc.hline(x + 10, y + 2, 6, STEEL.md); pc.hline(x + 10, y + 3, 6, STEEL.md); pc.hline(x + 10, y + 4, 6, STEEL.dk);
    }
    if (!n.r) { // ponta em lança
      for (let lx = 6; lx < 16; lx++) for (let i = 0; i < 9; i++) pc.erase(x + lx, y + i);
      pc.poly([[x + 5, y], [x + 9, y - 0.01], [x + 16, y + 3], [x + 9, y + 7], [x + 5, y + 6]], OUT);
      pc.poly([[x + 5, y + 1], [x + 9, y + 1], [x + 14.5, y + 3], [x + 9, y + 6], [x + 5, y + 5]], STEEL.md);
      pc.hline(x + 5, y + 1, 4, STEEL.hi); pc.line(x + 9, y + 1, x + 13, y + 3, STEEL.hi);
      pc.line(x + 9, y + 5, x + 13, y + 4, STEEL.dk); pc.px(x + 8, y + 3, OUT); pc.px(x + 9, y + 3, STEEL.dk);
    }
    return;
  }
  // passarela de ferro com treliça
  for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx;
    pc.px(x + lx, y, OUT);
    pc.px(x + lx, y + 1, IRON.hi);
    pc.px(x + lx, y + 2, (wx & 7) === 2 ? BRASS.lt : IRON.md);
    pc.px(x + lx, y + 3, IRON.dk);
    pc.px(x + lx, y + 4, OUT);
    for (let ly = 5; ly <= 8; ly++) {
      const k = ly - 5;
      if (((wx + k) & 7) === 0 || ((wx - k) & 7) === 0) pc.px(x + lx, y + ly, ((wx + k) & 7) === 0 ? IRON.md : IRON.dk);
    }
    pc.px(x + lx, y + 9, IRON.dk);
    pc.px(x + lx, y + 10, OUT);
  }
  const bracket = (bx, dir) => {
    pc.rect(bx - 1, y, 4, 12, OUT); pc.vline(bx, y + 1, 10, IRON.hi); pc.vline(bx + 1, y + 1, 10, IRON.md);
    pc.px(bx, y + 2, BRASS.lt); pc.px(bx, y + 8, BRASS.lt);
    pc.line(bx + dir * 2, y + 11, bx + dir * 6, y + 5, IRON.dk);
  };
  if (!n.l) bracket(x + 1, 1);
  if (!n.r) bracket(x + 13, -1);
}

// ------------------------------------------------------------------ espinhos: ponteiros quebrados + dentes de engrenagem
let SPIKES = null;
function buildSpikes() {
  const ups = [];
  for (let v = 0; v < 3; v++) {
    const pc = new PixelCanvas(16, 16);
    // base: engrenagem quebrada meio enterrada
    pc.rect(0, 12, 16, 4, BRASS.dk); pc.hline(0, 12, 16, BRASS.lt); pc.hline(0, 13, 16, BRASS.md);
    pc.px(3, 14, BRASS.hi); pc.px(12, 14, BRASS.hi); pc.px(4, 15, BRASS.sh); pc.px(13, 15, BRASS.sh);
    const tooth = (x0, x1, tipX, tipY, P) => {
      pc.tri(x0, 12.5, x1, 12.5, tipX, tipY, P.md);
      pc.line(x0 + 0.5, 12, tipX, tipY, P.hi);
      pc.line(x1 - 1, 12, tipX + 0.4, tipY + 1, P.dk);
      pc.px(tipX, tipY, '#ffffff');
    };
    const hand = (bx, tipY, lean) => { // ponteiro de aço azulado com ponta de lança
      pc.line(bx, 12, bx + lean, tipY + 3, STEEL.md); pc.line(bx + 1, 12, bx + 1 + lean, tipY + 3, STEEL.dk);
      pc.tri(bx - 1.5 + lean, tipY + 4, bx + 2.5 + lean, tipY + 4, bx + 0.5 + lean, tipY - 0.5, STEEL.md);
      pc.px(Math.round(bx + lean), tipY + 1, STEEL.hi); pc.px(Math.round(bx + lean), tipY, '#ffffff');
      pc.hline(bx - 1 + lean, tipY + 6, 4, STEEL.hi);
    };
    if (v === 0) { tooth(0.5, 6, 3, 4, BRASS); hand(7, 1, 0); tooth(10, 15.5, 13, 4, BRASS); }
    else if (v === 1) { hand(3, 2, -1); tooth(5, 11, 8, 2, { hi: COP.hi, md: COP.lt, dk: COP.dk }); hand(12, 3, 1); }
    else { tooth(0.5, 5.5, 2.5, 5, BRASS); tooth(4.5, 10.5, 7.5, 1, BRASS); tooth(9.5, 15.5, 12.5, 5, { hi: COP.hi, md: COP.lt, dk: COP.dk }); }
    pc.outline(OUT);
    ups.push(pc);
  }
  const rot = (src, map) => {
    const pc = new PixelCanvas(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const [sx, sy] = map(x, y); pc.buf[y * 16 + x] = src.buf[sy * 16 + sx]; }
    return pc;
  };
  const S = { up: ups, down: [], left: [], right: [] };
  for (const u of ups) {
    S.down.push(rot(u, (x, y) => [15 - x, 15 - y]));
    S.right.push(rot(u, (x, y) => [y, 15 - x]));
    S.left.push(rot(u, (x, y) => [15 - y, x]));
  }
  return S;
}
function drawSpike(pc, x, y, dir, rng, info) {
  if (!SPIKES) SPIKES = buildSpikes();
  towerBehind(pc, x, y, rng, info);
  const arr = SPIKES[dir] || SPIKES.up;
  pc.blit(arr[(h2(info.tx, info.ty, 50) * arr.length) | 0], x, y);
}

// ------------------------------------------------------------------ bg ao ar livre: FACHADA de prédio ao fundo
// ':' cujo topo dá para o céu = prédio logo atrás da rua (não "interior de torre"):
// reboco em tom de fundo, pilastras nas laterais, cornija no topo (o telhado é
// pintado pelo decorate acima dela), janelas com luz e soco de pedra embaixo.
const FAC = {
  day: { wall: ['#b49aac', '#ab90a4'], line: '#9a7e96', pil: '#d6c0c8', pilDk: '#8a6e88', trim: '#7a5e7c', win: '#7a8cc4', win2: '#a8bce8', lit: '#ffe0a0', lit2: '#fff4d0', base: '#8a7090' },
  dusk: { wall: ['#6e4c68', '#664662'], line: '#583a56', pil: '#8e6a84', pilDk: '#4a3048', trim: '#3e2840', win: '#2e1e3a', win2: '#4a3456', lit: '#ffb850', lit2: '#ffe0a0', base: '#4e3450' },
  night: { wall: ['#3a3054', '#342a4c'], line: '#2c2442', pil: '#4e4468', pilDk: '#221c36', trim: '#1c1630', win: '#16122a', win2: '#2a2446', lit: '#ffb84f', lit2: '#ffe6a8', base: '#28203e' },
};
const bgRun = (map, tx, ty, dx, dy, max) => { let k = 0; while (k < max && map.get(tx + dx * (k + 1), ty + dy * (k + 1)) === T.BG) k++; return k; };
/** ':' ao ar livre? (subindo pela coluna de ':' chega-se ao céu). */
function bgOutdoor(map, tx, ty) {
  let y = ty - 1;
  const see = (t) => t === T.BG || t === T.ONEWAY || t === T.SPIKE;
  while (y >= 0 && see(map.get(tx, y))) y--;
  if (y < 0) return !solidLike(map.get(tx, 0));
  // laje fina (1-2 tiles) com céu em cima = terraço/marquise do prédio de fundo
  let k = 0;
  while (k < 3 && y >= 0 && solidLike(map.get(tx, y))) { y--; k++; }
  if (k === 0) return map.get(tx, y) === T.EMPTY;
  return k <= 2 && y >= 0 && map.get(tx, y) === T.EMPTY;
}
function drawFacadeBG(pc, x, y, n, info) {
  const { tx, ty, map, level } = info;
  const F = FAC[level?.timeOfDay] || FAC.dusk;
  const k = { u: bgRun(map, tx, ty, 0, -1, 30), d: bgRun(map, tx, ty, 0, 1, 30), l: bgRun(map, tx, ty, -1, 0, 60), r: bgRun(map, tx, ty, 1, 0, 60) };
  const below = map.get(tx, ty + 1), floor = solidLike(below) || below === T.ONEWAY;
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    let c = th(wx, wy) < 0.2 + 0.25 * h2(wx >> 3, wy >> 3, 150) ? F.wall[1] : F.wall[0];
    if ((wy % 8) === 7) c = F.line;
    pc.px(x + lx, y + ly, c);
  }
  // faixa por andar
  if (k.u > 0 && k.u % 2 === 0) { pc.hline(x, y, 16, F.trim); pc.hline(x, y + 1, 16, F.pil); pc.hline(x, y + 2, 16, F.pilDk); }
  // janela
  const total = k.l + k.r + 1;
  const bay = !info.noFeature && k.l >= 1 && k.r >= 1 && k.u % 2 === 1 && !floor && ((k.l + (total % 2 ? 0 : 1)) % 2 === 1 || total <= 4);
  if (bay) {
    const hv = h2(tx, ty, 151);
    const lit = hv < litChance(level) + 0.1;
    pc.rect(x + 4, y + 3, 8, 11, F.trim);
    pc.rect(x + 5, y + 4, 6, 9, lit ? F.lit : F.win);
    pc.rect(x + 5, y + 4, 6, 1, F.trim); pc.px(x + 5, y + 5, F.trim); pc.px(x + 10, y + 5, F.trim);
    pc.vline(x + 7, y + 5, 8, F.trim); pc.hline(x + 5, y + 9, 6, F.trim);
    if (lit) { pc.px(x + 6, y + 6, F.lit2); pc.px(x + 6, y + 7, F.lit2); if (hv < 0.12) pc.rect(x + 8, y + 10, 3, 3, F.pilDk); }
    else pc.px(x + 9, y + 6, F.win2);
    pc.hline(x + 3, y + 13, 10, F.pil); pc.hline(x + 3, y + 14, 10, F.pilDk);
  }
  // soco / porta no térreo
  if (floor) {
    pc.rect(x, y + 10, 16, 6, F.base); pc.hline(x, y + 10, 16, F.pil); pc.hline(x, y + 11, 16, F.pilDk);
    if (!info.noFeature && k.l >= 1 && k.r >= 1 && h2(tx, ty, 152) < 0.22) { // porta de madeira
      pc.rect(x + 4, y + 2, 8, 14, F.trim); pc.rect(x + 5, y + 4, 6, 12, '#5a3424'); pc.rect(x + 6, y + 3, 4, 1, '#5a3424');
      pc.vline(x + 8, y + 4, 12, '#3a2018'); pc.px(x + 9, y + 10, BRASS.lt); pc.rect(x + 6, y + 5, 4, 2, F.lit);
    }
  }
  // pilastras nas laterais
  if (!n.l) { pc.vline(x, y, 16, F.trim); pc.vline(x + 1, y, 16, F.pil); pc.vline(x + 2, y, 16, F.pil); pc.vline(x + 3, y, 16, F.pilDk); }
  if (!n.r) { pc.vline(x + 12, y, 16, F.trim); pc.vline(x + 13, y, 16, F.pil); pc.vline(x + 14, y, 16, F.pilDk); pc.vline(x + 15, y, 16, F.trim); }
  // cornija
  if (!n.u) {
    pc.hline(x, y, 16, F.trim); pc.hline(x, y + 1, 16, BRASS.dk); pc.hline(x, y + 2, 16, F.pil); pc.hline(x, y + 3, 16, F.pilDk);
    for (let lx = 0; lx < 16; lx += 3) pc.px(x + lx, y + 4, F.trim);
  }
}

// ------------------------------------------------------------------ bg: interior de torre de relógio
function drawTower(pc, x, y, n, rng, info) {
  const { tx, ty, map } = info;
  if (bgOutdoor(map, tx, ty)) return drawFacadeBG(pc, x, y, n, info);
  const below = map.get(tx, ty + 1);
  const floor = solidLike(below) || below === T.ONEWAY;
  for (let ly = 0; ly < 16; ly++) for (let lx = 0; lx < 16; lx++) {
    const wx = tx * 16 + lx, wy = ty * 16 + ly;
    let c;
    const col = ((wx % 64) + 64) % 64;
    if (col < 4) c = col === 0 ? TOWER.dk : col === 1 ? TOWER.pilHi : col === 2 ? TOWER.pil : TOWER.dk;
    else {
      const course = Math.floor(wy / 5), r = wy - course * 5, off = (course & 1) * 6, bx = (wx + off) % 12;
      c = r === 4 || bx === 0 ? TOWER.mortar : TOWER.brick[(h2(Math.floor((wx + off) / 12), course, 61) * 3) | 0];
      // silhuetas de engrenagens gigantes, bem apagadas
      const GC = 56, cx = Math.floor(wx / GC), cy = Math.floor(wy / GC);
      if (h2(cx, cy, 62) < 0.55) {
        const ccx = cx * GC + 28, ccy = cy * GC + 28, R = 17 + h2(cx, cy, 63) * 6;
        const dx = wx + 0.5 - ccx, dy = wy + 0.5 - ccy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const ring = (d > R - 3 && d <= R) || (d > R && d < R + 3 && fr((a * 14) / TAU) < 0.45);
        const sa = fr((a * 6) / TAU), spoke = d < R - 3 && Math.min(sa, 1 - sa) * (TAU / 6) * d < 1.3;
        if (ring || spoke || d < 4) c = (dy < -d * 0.5 && d > R - 4) ? TOWER.gearHi : TOWER.gear;
      }
    }
    if (!n.u && ly < 4 && th(wx, wy) < (4 - ly) / 5) c = TOWER.dk;
    if ((!n.l && lx < 2) || (!n.r && lx > 13)) c = TOWER.dk;
    pc.px(x + lx, y + ly, c);
  }
  if (floor) { // lambri de madeira com moldura de latão
    for (let lx = 0; lx < 16; lx++) {
      const wx = tx * 16 + lx;
      pc.px(x + lx, y + 7, TOWER.moldHi); pc.px(x + lx, y + 8, TOWER.mold);
      for (let ly = 9; ly < 16; ly++) {
        const m = ((wx % 16) + 16) % 16;
        pc.px(x + lx, y + ly, m === 0 || ly === 9 ? TOWER.dk : m === 1 || ly === 10 ? '#3c2c38' : TOWER.wain[(Math.floor(wx / 16) & 1)]);
      }
    }
  } else if (n.u && n.d && !info.noFeature) {
    const v = h2(tx, ty, 64);
    const ok = ((tx + ty * 2) % 3) === 0;
    if (ok && v < 0.06) { // janela redonda (o céu lá fora)
      pc.circle(x + 8, y + 8, 6.4, OUT); pc.circle(x + 8, y + 8, 5.6, BRASS.dk); pc.circle(x + 8, y + 8, 4.6, '#6a4a9a');
      pc.ellipse(x + 8, y + 10, 4.4, 2.4, '#c06a7a'); pc.ellipse(x + 8, y + 11.5, 3.6, 1.2, '#ffb070');
      pc.hline(x + 4, y + 8, 9, OUT); pc.vline(x + 8, y + 4, 9, OUT);
      pc.px(x + 5, y + 5, '#c8b0f0'); pc.px(x + 4, y + 6, BRASS.lt); pc.px(x + 6, y + 3, BRASS.lt);
    } else if (ok && v < 0.1) { // cartaz desbotado
      const red = h2(tx, ty, 65) < 0.5, pa = red ? '#8a5a5e' : '#4a6a6a', ink = red ? '#5a2a3a' : '#22404a';
      pc.rect(x + 3, y + 2, 10, 12, '#3a2a3a'); pc.rect(x + 4, y + 3, 8, 10, pa); pc.hline(x + 4, y + 3, 8, red ? '#a07070' : '#6a8a84');
      pc.circle(x + 8, y + 7, 2.6, ink); pc.px(x + 8, y + 6, pa); pc.px(x + 9, y + 7, pa); pc.hline(x + 5, y + 11, 6, ink);
      pc.px(x + 11, y + 12, '#6a5a6a'); pc.px(x + 8, y + 2, BRASS.md);
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
    pc.circle(c, c, r, color + '12'); pc.circle(c, c, r * 0.7, color + '1a'); pc.circle(c, c, r * 0.42, color + '2a'); pc.circle(c, c, r * 0.2, color + '30');
  }, null);
}
const GEARP = {
  brass: { hi: '#ffe08a', md: '#d8a040', dk: '#8a5a24', hub: '#fff0b0', hole: '#4a2a18' },
  copper: { hi: '#f0a070', md: '#b86038', dk: '#6a3020', hub: '#ffd0a0', hole: '#3a1810' },
  teal: { hi: '#8ad0b8', md: '#3e8a7a', dk: '#1e4a48', hub: '#c8f0e0', hole: '#10282a' },
};
/** Quadros de rotação de uma engrenagem (cobrem um passo de dente → laço perfeito). */
function gearFrames(r, teeth, F, P, spokes = 5) {
  const R = r + 2, S = R * 2 + 3, c = S / 2;
  const frames = [];
  for (let f = 0; f < F; f++) {
    const rot = (TAU / teeth) * (f / F);
    frames.push(mk(S, S, (pc) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
        if (d > R + 0.2) continue;
        const a = Math.atan2(dy, dx) - rot, lit = (-dx - dy) / (d || 1);
        let col = null;
        const side = lit > 0.2 ? P.hi : lit < -0.35 ? P.dk : P.md;
        if (d > r) { if (fr((a * teeth) / TAU) < 0.5) col = side; }
        else if (d > r - 1.6) col = side;
        else if (d < 1.3) col = P.hub;
        else if (d < 2.6) col = lit > 0 ? P.hi : P.md;
        else { const sa = fr((a * spokes) / TAU); col = Math.min(sa, 1 - sa) * (TAU / spokes) * d < 1.0 ? P.md : P.hole; }
        if (col) pc.px(x, y, col);
      }
    }));
  }
  return { frames, F, S, r, teeth };
}
function clockFace(size, rim) {
  const c = size / 2, r = c - 1;
  return mk(size, size, (pc) => {
    pc.circle(c, c, r, rim.md); pc.circle(c - 0.5, c - 0.5, r - 0.6, rim.hi); pc.circle(c, c, r - 0.8, rim.md);
    pc.circle(c, c, r - 1.6, CREAM.md); pc.ellipse(c + 0.6, c + 0.6, r - 2.2, r - 2.2, CREAM.md);
    pc.ellipse(c - 1, c - 1, r * 0.35, r * 0.25, CREAM.hi);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, rr = r - 2.6;
      pc.px(Math.round(c + Math.sin(a) * rr - 0.5), Math.round(c - Math.cos(a) * rr - 0.5), k % 3 === 0 ? '#3a2440' : CREAM.dk);
    }
    if (size >= 17) { pc.px(c - 1, 2.5, rim.hi); pc.px(c, 2, rim.hi); }
  });
}
function pigeonFrames() {
  const P = { h: '#aca8cc', e: '#140c16', k: '#e8c890', n: '#4ab0a0', v: '#9a6ad0', b: '#8682a8', w: '#bcb8d8', d: '#4e4a6e', t: '#5a5680', f: '#e0705a' };
  const F = [
    ['......hh..', '.....hhhek', '.....nhh..', '....nnv...', '..bbbnnb..', 'tbbwwwbbb.', '.tbddddbb.', '...bbbbb..', '....f..f..'],
    ['..........', '..........', '..........', '..bbbb....', 'tbbwwwbn..', '.tbddddnh.', '...bbbbhhh', '......hhek', '....f..f..'],
    ['.....hhh..', '.....hhek.', '.....nh...', '.....nv...', '..bbbnnb..', 'tbbwwwbbb.', '.tbddddbb.', '...bbbbb..', '....f..f..'],
    ['..ww......', '...www....', '....wwwhh.', '..bbbbnhek', 'tbbbbbnn..', '.tbbbbbb..', '...ff.....', '..........', '..........'],
    ['..........', '..........', '.......hh.', '..bbbbnhek', 'tbbbbbnn..', '.tbwwwbb..', '...www....', '...ww.....', '..........'],
  ];
  const R = F.map((rows) => mk(12, 11, (pc) => pc.ascii(rows, P, 1, 1)));
  const L = R.map((s) => mk(12, 11, (pc) => pc.blit(s, 0, 0, { flipX: true }), null));
  return { R, L };
}
function buildSprites() {
  const S = {};
  S.gears = {
    s: gearFrames(4, 6, 5, GEARP.brass, 3),
    m: gearFrames(6, 8, 6, GEARP.brass, 4),
    mc: gearFrames(6, 8, 6, GEARP.copper, 4),
    l: gearFrames(9, 11, 7, GEARP.copper, 5),
    lt: gearFrames(9, 11, 7, GEARP.teal, 5),
  };
  S.clockS = clockFace(13, { hi: BRASS.hi, md: BRASS.md });
  S.clockL = clockFace(19, { hi: COP.hi, md: COP.md });
  S.clockCase = mk(23, 27, (pc) => { // caixa de nogueira atrás do mostrador grande + gancho + pinha de corrente
    const W0 = '#5a3424', W1 = '#7a4a30', W2 = '#9a6440';
    pc.rect(1, 3, 21, 21, W1); pc.hline(1, 3, 21, W2); pc.vline(1, 3, 21, W2); pc.vline(21, 4, 20, W0); pc.hline(2, 23, 20, W0);
    pc.tri(3, 3, 19, 3, 11, -0.5, W1); pc.line(3, 3, 11, 0, W2);
    pc.rect(9, 24, 5, 2, BRASS.md); pc.px(11, 26, BRASS.dk); pc.px(10, 24, BRASS.hi);
    pc.px(11, 0, BRASS.hi);
  });
  S.pig = pigeonFrames();
  S.haloAmber = glowHalo(26, '#ffb84f');
  S.haloSmall = glowHalo(14, '#ffc060');
  S.puff = [2, 3, 4, 5].map((r) => mk(r * 2 + 2, r * 2 + 2, (pc) => {
    const c = r + 1;
    pc.circle(c, c, r, '#c8b8c4'); pc.circle(c - 0.6, c - 0.6, r - 0.7, '#ece2da'); pc.circle(c - 1, c - 1, r * 0.45, '#fffaf2');
  }, null));
  // poste a gás (estático; o vidro é animado à parte)
  S.lamp = mk(13, 44, (pc) => {
    pc.rect(3, 38, 7, 5, IRON.dk); pc.hline(2, 42, 9, IRON.md); pc.hline(3, 38, 7, BRASS.md); pc.px(4, 40, IRON.hi);
    pc.rect(5, 12, 3, 27, IRON.md); pc.vline(5, 12, 27, IRON.hi); pc.vline(7, 12, 27, IRON.dk);
    for (const ry of [18, 30]) { pc.hline(4, ry, 5, BRASS.md); pc.px(4, ry, BRASS.hi); }
    pc.rect(3, 10, 7, 2, BRASS.md); pc.hline(3, 10, 7, BRASS.lt);
    pc.rect(3, 4, 7, 6, '#7a4a24'); pc.vline(6, 4, 6, IRON.dk);
    pc.tri(2, 4, 11, 4, 6.5, -0.5, IRON.md); pc.hline(2, 3, 9, IRON.dk); pc.px(6, 0, BRASS.lt); pc.px(5, 1, IRON.hi);
    pc.line(8, 14, 11, 12, IRON.dk); pc.px(11, 11, IRON.dk); pc.line(5, 14, 2, 12, IRON.dk); pc.px(2, 11, IRON.dk);
  });
  // relógio de pêndulo (caixa de nogueira, vidro rachado)
  S.grand = mk(15, 33, (pc) => {
    const W0 = '#5a3424', W1 = '#7a4a30', W2 = '#9a6440';
    pc.rect(2, 3, 11, 12, W1); pc.tri(1, 4, 14, 4, 7.5, -0.5, W1); pc.line(1, 4, 7, 0, W2);
    pc.circle(7.5, 9, 5, BRASS.md); pc.circle(7.5, 9, 4.2, CREAM.md); pc.px(5, 7, CREAM.hi);
    for (let k = 0; k < 12; k += 3) { const a = (k / 12) * TAU; pc.px(Math.round(7.5 + Math.sin(a) * 3.3 - 0.5), Math.round(9 - Math.cos(a) * 3.3 - 0.5), '#3a2440'); }
    pc.rect(3, 15, 9, 13, W0); pc.vline(3, 15, 13, W1); pc.vline(11, 15, 13, '#3a2018');
    pc.rect(5, 16, 5, 10, '#16303a'); pc.line(9, 16, 6, 21, '#4a7a80'); pc.line(6, 21, 8, 25, '#4a7a80');
    pc.rect(2, 28, 11, 4, W1); pc.hline(2, 28, 11, W2); pc.hline(1, 31, 13, W0);
    pc.px(2, 4, BRASS.lt); pc.px(12, 4, BRASS.lt); pc.px(7, 0, BRASS.hi);
  });
  S.bob = mk(5, 5, (pc) => { pc.circle(2.5, 2.5, 2, BRASS.md); pc.px(1, 1, BRASS.hi); pc.px(2, 1, BRASS.lt); });
  S.bobL = mk(11, 11, (pc) => { pc.circle(5.5, 5.5, 4.6, BRASS.md); pc.circle(5, 5, 3.4, BRASS.lt); pc.ring(5.5, 5.5, 2.4, BRASS.dk); pc.px(4, 3, BRASS.hi); pc.px(3, 4, BRASS.hi); });
  // lanterna pendurada / arandela de parede
  S.lantern = mk(9, 12, (pc) => {
    pc.px(4, 0, IRON.md); pc.hline(2, 1, 5, IRON.md); pc.tri(1, 3, 8, 3, 4.5, 0.5, IRON.dk);
    pc.rect(2, 3, 5, 6, '#7a4a24'); pc.vline(4, 3, 6, IRON.dk); pc.hline(1, 9, 7, BRASS.md); pc.px(4, 10, BRASS.dk);
  });
  S.sconce = mk(11, 13, (pc) => {
    pc.rect(0, 6, 2, 5, IRON.dk); pc.curve(1, 9, 5, 11, 6, 8, IRON.md);
    pc.tri(3, 3, 10, 3, 6.5, -0.5, IRON.dk); pc.rect(4, 3, 5, 5, '#7a4a24'); pc.vline(6, 3, 5, IRON.dk); pc.hline(3, 8, 7, BRASS.md);
  });
  // vasos de flor, placas, cartazes, engrenagens caídas, relógio caído, cano de vapor
  const FL = ['#e04a6a', '#b07ae8', '#ffc84a', '#ff8a4a', '#f0f0ff'];
  S.pots = [0, 1, 2].map((v) => mk(10, 12, (pc) => {
    const r = lrng(700 + v);
    for (let i = 0; i < 5; i++) { const lx = r.int(2, 7), hh = r.int(2, 5); pc.vline(lx, 7 - hh, hh, MOSS.md); pc.px(lx + (i & 1 ? 1 : -1), 6 - r.int(0, 2), MOSS.hi); }
    for (let i = 0; i < 3 + v; i++) { const fx = r.int(1, 8), fy = r.int(1, 4), c = FL[(v + i) % FL.length]; pc.px(fx, fy, c); pc.px(fx + 1, fy, c); pc.px(fx, fy + 1, c); pc.px(fx + 1, fy + 1, '#5a2a3a'); }
    pc.rect(1, 7, 8, 1, '#e08a5a'); pc.rect(2, 8, 6, 3, '#b05a34'); pc.vline(7, 8, 3, '#7a3a24'); pc.px(2, 8, '#e8a070');
  }));
  const GL = { I: ['#', '#', '#', '#', '#'], V: ['#.#', '#.#', '#.#', '.#.', '.#.'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'] };
  S.signs = ['XII', 'IV', 'IX', 'VII', 'III', 'XI'].map((txt) => {
    let tw = 0; for (const ch of txt) tw += GL[ch][0].length + 1; tw -= 1;
    const W = Math.max(11, tw + 6);
    return mk(W, 24, (pc) => {
      const cx = Math.floor(W / 2);
      pc.rect(cx - 1, 7, 2, 17, IRON.md); pc.vline(cx - 1, 7, 17, IRON.hi); pc.rect(cx - 2, 21, 4, 3, IRON.dk);
      pc.rect(0, 0, W, 8, '#2a5a5a'); pc.hline(0, 0, W, '#4a8a80'); pc.hline(0, 7, W, '#163a3a');
      pc.strokeRect(1, 1, W - 2, 6, BRASS.md);
      let gx = Math.floor((W - tw) / 2);
      for (const ch of txt) { pc.ascii(GL[ch], { '#': CREAM.md }, gx, 2); gx += GL[ch][0].length + 1; }
      pc.px(1, 1, BRASS.hi); pc.px(W - 2, 1, BRASS.hi);
    });
  });
  S.posters = [0, 1, 2, 3].map((v) => mk(11, 14, (pc) => {
    const paper = v === 3 ? '#e0c8a0' : CREAM.md, ink = ['#7a2a3a', '#2a4a6a', '#6a3a8a', '#8a4a20'][v];
    pc.rect(0, 1, 11, 13, paper); pc.hline(0, 1, 11, CREAM.hi); pc.vline(10, 1, 13, CREAM.dk);
    if (v === 0) { pc.circle(5.5, 6.5, 3.6, ink); pc.circle(5.5, 6.5, 2.6, paper); pc.vline(5, 4, 3, ink); pc.hline(5, 6, 3, ink); }
    else if (v === 1) { smallGear(pc, 5, 6, 2, 6, 0.3, { hi: ink, md: ink, dk: ink }); pc.px(5, 6, paper); }
    else if (v === 2) { pc.ascii(['#.#.#.#', '#.#..#.', '.#..#.#'], { '#': ink }, 2, 4); }
    else { pc.rect(3, 3, 5, 3, ink); pc.rect(2, 6, 7, 1, ink); pc.circle(5.5, 9, 1.6, ink); }
    pc.hline(2, 11, 7, ink); pc.hline(3, 12, 4, ink + '88');
    pc.erase(10, 13); pc.erase(9, 13); pc.erase(10, 12); pc.px(5, 0, BRASS.lt);
  }));
  S.cogs = [0, 1].map((v) => mk(15, 15, (pc) => smallGear(pc, 7, 7, v ? 5 : 4, v ? 9 : 7, v * 0.4, v ? GEARP.copper : GEARP.brass)));
  S.fallenClock = mk(15, 9, (pc) => {
    pc.ellipse(7.5, 5, 7, 4.2, BRASS.md); pc.ellipse(7.5, 5, 5.8, 3.2, CREAM.md); pc.ellipse(6.5, 4, 3, 1.4, CREAM.hi);
    pc.line(7, 5, 10, 4, '#3a2440'); pc.line(7, 5, 6, 3, '#3a2440'); pc.line(3, 3, 6, 7, CREAM.dk); pc.px(7, 5, BRASS.hi);
    pc.rect(13, 0, 2, 2, BRASS.lt);
  });
  S.vent = mk(10, 13, (pc) => {
    pc.rect(3, 4, 4, 9, COP.md); pc.vline(3, 4, 9, COP.hi); pc.vline(6, 4, 9, COP.dk);
    pc.rect(2, 2, 6, 3, COP.lt); pc.hline(2, 2, 6, COP.hi); pc.hline(2, 4, 6, COP.dk);
    pc.circle(8, 8, 1.8, BRASS.md); pc.px(7, 7, BRASS.hi); pc.hline(6, 8, 2, BRASS.dk);
    pc.rect(2, 10, 6, 1, BRASS.dk);
  });
  return S;
}

// ------------------------------------------------------------------ pintores estáticos (coordenadas de mundo)
function paintWeeds(pc, x, yb, seed) {
  const r = lrng(seed);
  const n = r.int(2, 5);
  for (let i = 0; i < n; i++) {
    const bx = x + r.int(0, 14), hgt = r.int(2, 5), lean = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < hgt; k++) pc.px(bx + (k >= hgt - 1 && hgt > 2 ? lean : 0), yb - 1 - k, k === hgt - 1 ? MOSS.hi : k === 0 ? MOSS.dk : MOSS.md);
  }
  if (r() < 0.4) {
    const fx = x + r.int(2, 13), fh = r.int(4, 7), c = r() < 0.5 ? '#c08af0' : r() < 0.5 ? '#ffc84a' : '#ff7a8a';
    pc.vline(fx, yb - fh + 1, fh - 1, MOSS.dk);
    pc.px(fx, yb - fh, c); pc.px(fx - 1, yb - fh, c); pc.px(fx + 1, yb - fh, c); pc.px(fx, yb - fh - 1, c); pc.px(fx, yb - fh, '#fff4c0');
  }
}
function paintMoss(pc, x, yt, seed, dir) { // musgo escorrendo pela face lateral (camada da frente)
  const r = lrng(seed);
  for (let i = 0; i < 3; i++) {
    const sx = x + (dir < 0 ? i : -i), len = r.int(2, 7 - i * 2);
    for (let k = 0; k < len; k++) pc.px(sx, yt + k, k === len - 1 ? MOSS.dk : (k & 1) ? MOSS.md : MOSS.hi);
  }
}
function paintPipe(pc, x, y0, len, seed) { // cano vertical de cobre com abraçadeiras e registro
  const r = lrng(seed);
  for (let yy = y0; yy < y0 + len; yy++) {
    pc.px(x, yy, OUT); pc.px(x + 1, yy, COP.hi); pc.px(x + 2, yy, COP.lt); pc.px(x + 3, yy, COP.md); pc.px(x + 4, yy, OUT);
    if (((yy - y0) % 14) === 6) { pc.hline(x, yy, 5, BRASS.md); pc.px(x + 1, yy, BRASS.hi); pc.hline(x - 1, yy + 1, 7, BRASS.dk); }
    if (r() < 0.04) pc.px(x + 2, yy, COP.pat);
  }
  pc.hline(x - 1, y0, 7, OUT); pc.hline(x, y0 + 1, 5, COP.lt);
  if (len > 20) { const vy = y0 + 10 + r.int(0, len - 20); pc.circle(x + 2.5, vy, 3, OUT); pc.circle(x + 2.5, vy, 2.2, '#c0302a'); pc.px(x + 2, vy, BRASS.hi); pc.px(x + 1, vy - 1, '#ff7a6a'); }
}
function paintChain(pc, x, yt, len, seed, end) {
  for (let k = 0; k < len; k++) {
    const y = yt + k, m = k % 4;
    if (m === 0 || m === 2) pc.px(x, y, OUT);
    else if (m === 1) { pc.px(x - 1, y, IRON.md); pc.px(x + 1, y, IRON.dk); pc.px(x, y, OUT); }
    else pc.px(x, y, IRON.hi);
  }
  if (end) pc.blit(end, x - Math.floor(end.w / 2), yt + len - 1);
}
function paintVines(pc, x, yt, seed) {
  const r = lrng(seed);
  for (let i = 0; i < 3; i++) {
    const sx = x + r.int(0, 14), len = r.int(2, 8);
    for (let k = 0; k < len; k++) pc.px(sx + (k > 4 && (i & 1) ? 1 : 0), yt + k, k === len - 1 ? MOSS.hi : (k + i) % 3 === 0 ? MOSS.dk : MOSS.md);
    if (len > 5 && r() < 0.5) pc.px(sx - 1, yt + len - 2, '#c08af0');
  }
}
function paintRail(pc, wx, wy, left, right) { // grade da passarela (atrás do jogador)
  const y = wy;
  for (let lx = 0; lx < 16; lx++) {
    const x = wx + lx;
    pc.px(x, y - 10, OUT); pc.px(x, y - 9, IRON.hi); pc.px(x, y - 8, IRON.dk);
    pc.px(x, y - 5, IRON.md);
    if ((x & 7) === 1) { for (let k = 9; k >= 1; k--) pc.px(x, y - k, IRON.md); pc.px(x + 1, y - 7, OUT); pc.px(x + 1, y - 4, OUT); pc.px(x + 1, y - 2, OUT); }
  }
  const post = (px) => { for (let k = 11; k >= 1; k--) { pc.px(px, y - k, IRON.hi); pc.px(px + 1, y - k, IRON.dk); } pc.px(px, y - 12, BRASS.hi); pc.px(px + 1, y - 12, BRASS.md); pc.px(px, y - 13, OUT); pc.px(px + 1, y - 13, OUT); };
  if (left) post(wx + 1);
  if (right) post(wx + 13);
}

// ------------------------------------------------------------------ decor animado
function hand(ctx, cx, cy, a, len, col) {
  ctx.fillStyle = col;
  const s = Math.sin(a), c = -Math.cos(a);
  for (let k = 1; k <= len; k++) ctx.fillRect(Math.round(cx + s * k - 0.5), Math.round(cy + c * k - 0.5), 1, 1);
}
function todGlow(level) { const tod = level?.timeOfDay; return tod === 'night' ? 1 : tod === 'day' ? 0.35 : 0.75; }
function gearAnim(G, x, y, spd, ph, tick = false) {
  return (ctx, t) => {
    let p = t * spd + ph;
    if (tick) { const fl = Math.floor(p); p = fl + Math.min(1, (p - fl) * 5); }
    let f = Math.floor(p * G.F) % G.F; if (f < 0) f += G.F;
    ctx.drawImage(G.frames[f].canvas, x, y);
  };
}
/** Relógio com ponteiros enlouquecidos: modo 0 adianta, 1 anda para trás, 2 gagueja. */
function clockAnim(face, x, y, mode, ph) {
  const c = face.w / 2, big = face.w > 15;
  return (ctx, t) => {
    ctx.drawImage(face.canvas, x, y);
    let ma, ha, sa;
    if (mode === 0) { ma = t * 1.6 + ph; ha = ma / 12 + ph; sa = t * 6; }
    else if (mode === 1) { ma = -t * 1.1 + ph; ha = ma / 6; sa = -t * 4; }
    else { const k = Math.floor(t * 2 + ph); ma = (k % 5) * 0.5 + Math.sin(t * 17) * 0.06; ha = ph + Math.sin(t * 0.7) * 0.4; sa = Math.floor(t * 4) * 0.52 * (k & 1 ? -1 : 1); }
    hand(ctx, x + c, y + c, ha, big ? 4 : 2, '#2a1830');
    hand(ctx, x + c, y + c, ma, big ? 6 : 4, '#3a2440');
    if (big) hand(ctx, x + c, y + c, sa, 6, '#c0302a');
    ctx.fillStyle = BRASS.hi; ctx.fillRect(Math.round(x + c - 0.5), Math.round(y + c - 0.5), 1, 1);
  };
}
/** Corrente vertical (elos alternados) de um teto até uma plataforma pendurada. */
function chainAnim(x, y0, len) {
  return (ctx) => {
    for (let k = 0; k < len; k += 2) {
      const m = (k >> 1) & 1;
      ctx.fillStyle = OUT; ctx.fillRect(x - 1, y0 + k, 3, 2);
      ctx.fillStyle = m ? IRON.hi : IRON.md; ctx.fillRect(x - (m ? 0 : 1), y0 + k, m ? 1 : 3, 1);
    }
    ctx.fillStyle = BRASS.md; ctx.fillRect(x - 2, y0 + len - 1, 5, 2); ctx.fillRect(x - 2, y0, 5, 2);
  };
}
/** Relógio de parede montado: caixa de madeira com gancho e prumo (fica ATRÁS do Tico). */
function wallClockAnim(x, y, mode, ph) {
  const face = clockAnim(SPR.clockL, x + 2, y + 4, mode, ph);
  return (ctx, t) => {
    ctx.drawImage(SPR.clockCase.canvas, x, y);
    face(ctx, t);
  };
}
function lampAnim(x, y, ph, small = false) { // vidro tremulante + halo + mariposas
  return (ctx, t, level) => {
    const f = 0.78 + 0.14 * Math.sin(t * 11 + ph) * Math.sin(t * 6.3 + ph * 2) + (Math.sin(t * 37 + ph) > 0.93 ? -0.25 : 0);
    const g = todGlow(level);
    const H = small ? SPR.haloSmall : SPR.haloAmber;
    ctx.globalAlpha = Math.max(0, f * g);
    ctx.drawImage(H.canvas, Math.round(x + 3.5 - H.w / 2), Math.round(y + 3 - H.h / 2));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffb84f'; ctx.fillRect(x, y, 5, 6);
    ctx.fillStyle = '#ffe8a0'; ctx.globalAlpha = f; ctx.fillRect(x + 1, y + 1, 3, 4); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffbe8'; ctx.fillRect(x + 2 + (Math.sin(t * 9 + ph) > 0.6 ? 1 : 0), y + 2 + (f < 0.7 ? 1 : 0), 1, 2);
    ctx.fillStyle = '#5a3418'; ctx.fillRect(x + 2, y, 1, 6);
    if (g > 0.5) { // mariposas rodando a luz
      ctx.fillStyle = '#e8dcc0';
      for (let i = 0; i < 2; i++) {
        const a = t * (2.2 + i * 0.7) + ph + i * 3;
        ctx.fillRect(Math.round(x + 2 + Math.cos(a) * (7 + i * 3)), Math.round(y + 3 + Math.sin(a * 1.3) * (5 + i * 2)), 1, 1);
      }
    }
  };
}
function grandAnim(x, y, ph, mode) {
  return (ctx, t) => {
    ctx.drawImage(SPR.grand.canvas, x, y);
    const a = Math.sin(t * 3.1 + ph) * 0.42;
    const px0 = x + 7.5, py0 = y + 16;
    ctx.fillStyle = BRASS.dk;
    for (let k = 1; k <= 6; k++) ctx.fillRect(Math.round(px0 + Math.sin(a) * k - 0.5), Math.round(py0 + Math.cos(a) * k), 1, 1);
    ctx.drawImage(SPR.bob.canvas, Math.round(px0 + Math.sin(a) * 7.5 - 2.5), Math.round(py0 + Math.cos(a) * 7.5 - 2));
    const ma = mode ? -t * 2.3 + ph : t * 3.7 + ph;
    hand(ctx, x + 7.5, y + 9, ma / 9, 2, '#2a1830');
    hand(ctx, x + 7.5, y + 9, ma, 3, '#3a2440');
  };
}
function steamAnim(x, y, ph) { // x,y = boca do cano
  return (ctx, t) => {
    const burst = 0.55 + 0.45 * Math.sin(t * 0.9 + ph);
    for (let i = 0; i < 6; i++) {
      const k = fr(t * 0.55 + ph + i / 6);
      const a = (1 - k) * 0.75 * burst;
      if (a < 0.05) continue;
      const P = SPR.puff[Math.min(3, Math.floor(k * 4.2))];
      ctx.globalAlpha = a;
      ctx.drawImage(P.canvas, Math.round(x - P.w / 2 + Math.sin(t * 1.7 + i * 2 + ph) * 2 + k * 6), Math.round(y - P.h / 2 - k * 30));
    }
    ctx.globalAlpha = 1;
  };
}
function lanternAnim(x, y, len, ph) { // x,y = gancho no teto
  return (ctx, t, level) => {
    const a = Math.sin(t * 1.4 + ph) * 0.12 + Math.sin(t * 0.53 + ph) * 0.05;
    ctx.fillStyle = IRON.md;
    for (let k = 0; k < len; k += 2) ctx.fillRect(Math.round(x + Math.sin(a) * k), Math.round(y + Math.cos(a) * k), 1, 1);
    const lx = Math.round(x + Math.sin(a) * len - 4), ly = Math.round(y + Math.cos(a) * len);
    ctx.drawImage(SPR.lantern.canvas, lx, ly);
    lampAnim(lx + 2, ly + 3, ph, true)(ctx, t, level);
  };
}
function sconceAnim(x, y, ph) {
  return (ctx, t, level) => { ctx.drawImage(SPR.sconce.canvas, x, y); lampAnim(x + 4, y + 3, ph, true)(ctx, t, level); };
}
function pendulumAnim(x, y, len, ph) {
  return (ctx, t) => {
    const a = Math.sin(t * (2.2 / Math.sqrt(len / 24)) + ph) * 0.38;
    ctx.fillStyle = BRASS.dk;
    for (let k = 0; k < len; k++) ctx.fillRect(Math.round(x + Math.sin(a) * k), Math.round(y + Math.cos(a) * k), 1, 1);
    ctx.fillStyle = BRASS.lt; ctx.fillRect(x - 1, y, 3, 2);
    ctx.drawImage(SPR.bobL.canvas, Math.round(x + Math.sin(a) * len - 5.5), Math.round(y + Math.cos(a) * len - 5.5));
  };
}
function pigeonAnim(x, y, n, rng) { // y = topo do chão
  const birds = [];
  for (let i = 0; i < n; i++) birds.push({ ox: i * 8 + rng.int(0, 3), ph: rng() * 10, dl: rng() * 0.3, dir: rng() < 0.5 ? 1 : -1, sp: 0.2 + rng() * 0.25 });
  const mid = x + n * 4;
  let fleeT = -1;
  return (ctx, t, level) => {
    const p = level?.player;
    if (p) {
      const dx = Math.abs(p.x + p.w / 2 - mid), dy = Math.abs(p.y + p.h - y);
      if (fleeT < 0) { if (dx < 38 && dy < 40) fleeT = t; }
      else if (t - fleeT > 6 && dx > 110) fleeT = -1;
    }
    for (const b of birds) {
      const s = fleeT >= 0 ? t - fleeT - b.dl : -1;
      if (s > 0) {
        if (s > 3) continue;
        const S = b.dir > 0 ? SPR.pig.R : SPR.pig.L;
        ctx.drawImage(S[3 + (Math.floor(t * 14 + b.ph) & 1)].canvas, Math.round(x + b.ox + b.dir * s * 52), Math.round(y - 10 - s * 26 - s * s * 8));
        continue;
      }
      const ph = t * b.sp + b.ph;
      const walk = Math.sin(ph) * 5, face = Math.cos(ph) >= 0 ? 1 : -1;
      const moving = Math.abs(Math.cos(ph)) > 0.5;
      const c = fr(t * 0.7 + b.ph * 0.37) * 6;
      const f = moving ? (Math.floor(t * 6 + b.ph) % 3 === 0 ? 2 : 0) : c < 1.2 ? (Math.floor(t * 5 + b.ph) & 1) : c < 2 ? 2 : c > 4 && c < 4.6 ? 1 : 0;
      const S = face > 0 ? SPR.pig.R : SPR.pig.L;
      ctx.drawImage(S[f].canvas, Math.round(x + b.ox + walk), y - 10);
    }
  };
}

// ------------------------------------------------------------------ decorate
function decorate(map, rng, data) {
  if (!SPR) SPR = buildSprites();
  const out = [];
  const rows = data?.map || [];
  const chAt = (tx, ty) => (rows[ty] && rows[ty][tx]) || '.';
  const free = (tx, ty) => { const t = map.get(tx, ty), ch = chAt(tx, ty); return (t === T.EMPTY && ch === '.') || (t === T.BG && ch === ':'); };
  const emptyish = (tx, ty) => { const t = map.get(tx, ty); return t === T.EMPTY || t === T.BG; };
  const S = (tx, ty) => map.get(tx, ty) === T.SOLID;
  const add = (o) => out.push(o);
  const blitAt = (spr, x, y, layer = 'back', flip = false) => add({ x, y, w: spr.w, h: spr.h, layer, paint: (pc) => pc.blit(spr, x, y, { flipX: flip }) });
  const clockBand = new Set();
  const roofTops = [];
  for (let ty = 1; ty < map.rows; ty++) {
    let lastBig = -99, lastPig = -99, lastWall = -99, lastHang = -99, lastPend = -99;
    for (let tx = 0; tx < map.cols; tx++) {
      const t = map.get(tx, ty);
      const wx = tx * 16, wy = ty * 16;
      const seed = (tx * 92821 + ty * 68917) >>> 0;
      // ---------- superfície das ruas
      if (t === T.SOLID && free(tx, ty - 1)) {
        const inside = map.get(tx, ty - 1) === T.BG;
        const room = (k) => { for (let i = 1; i <= k; i++) if (!emptyish(tx, ty - i)) return false; return true; };
        const ledgeL = emptyish(tx - 1, ty) && !solidLike(map.get(tx - 1, ty)), ledgeR = emptyish(tx + 1, ty);
        const wide = S(tx - 1, ty) && S(tx + 1, ty);
        const r = rng();
        let big = false;
        if (r < 0.11 && tx - lastBig >= 6 && room(3) && !ledgeL && !ledgeR) { // poste a gás
          lastBig = tx; big = true;
          const x = wx + 2, y = wy - 43;
          blitAt(SPR.lamp, x, y);
          add({ x: x + 4, y: y + 4, w: 5, h: 6, layer: 'back', anim: lampAnim(x + 4, y + 4, rng() * 9), light: { r: 58, color: '#ffb84f', i: 0.8, flicker: 0.35 } });
        } else if (r < 0.12 && tx - lastBig >= 5 && room(3) && !ledgeL && !ledgeR) { // relógio de pêndulo
          lastBig = tx; big = true;
          const x = wx + 1, y = wy - 32;
          add({ x, y, w: 15, h: 33, layer: 'back', anim: grandAnim(x, y, rng() * 6, rng() < 0.5 ? 1 : 0) });
        } else if (r < 0.16 && tx - lastBig >= 4 && room(2)) { // placa em algarismos romanos
          lastBig = tx; big = true;
          const spr = SPR.signs[rng.int(0, SPR.signs.length - 1)];
          blitAt(spr, wx + rng.int(0, 16 - spr.w), wy - 23);
        } else if (r < 0.21 && tx - lastBig >= 4 && room(2)) { // cano de vapor
          lastBig = tx; big = true;
          const x = wx + rng.int(1, 5), y = wy - 12;
          blitAt(SPR.vent, x, y);
          add({ x: x - 6, y: y - 34, w: 22, h: 36, layer: 'back', anim: steamAnim(x + 5, y + 1, rng() * 7) });
        } else if (r < 0.26 && tx - lastBig >= 4) { // engrenagens meio enterradas, engrenando
          lastBig = tx; big = true;
          const A = rng() < 0.5 ? SPR.gears.l : SPR.gears.lt, B = SPR.gears.m;
          const ax = wx - 2, ay = wy - A.S / 2 + 3;
          const spd = (0.5 + rng() * 0.8) * (rng() < 0.5 ? 1 : -1), ph = rng() * 3, tick = rng() < 0.35;
          add({ x: ax, y: ay, w: A.S, h: A.S, layer: 'back', anim: gearAnim(A, ax, ay, spd, ph, tick) });
          const bx = ax + A.S - 4, by = wy - B.S / 2 + 1;
          add({ x: bx, y: by, w: B.S, h: B.S, layer: 'back', anim: gearAnim(B, bx, by, -spd, ph + 0.5, tick) });
        } else if (r < 0.33 && tx - lastPig >= 6 && !inside && room(2)) { // pombos
          lastPig = tx;
          const k = rng.int(1, 3);
          add({ x: wx - 8, y: wy - 12, w: k * 8 + 24, h: 12, layer: 'back', anim: pigeonAnim(wx, wy, k, rng) });
        } else if (r < 0.4) { // engrenagem caída / relógio caído
          const spr = rng() < 0.4 ? SPR.fallenClock : SPR.cogs[rng.int(0, 1)];
          blitAt(spr, wx + rng.int(0, 16 - spr.w + 2), wy - spr.h + (spr === SPR.fallenClock ? 2 : 5));
        }
        // mato nas frestas e flores (quase todo topo)
        if (rng() < 0.62) add({ x: wx, y: wy - 9, w: 16, h: 10, layer: 'back', paint: (pc) => paintWeeds(pc, wx, wy, seed ^ 0x55) });
        // vasos de flor nas beiradas
        if (!big && (ledgeL || ledgeR) && room(1) && rng() < 0.55) {
          const spr = SPR.pots[rng.int(0, 2)];
          blitAt(spr, ledgeL ? wx + 2 : wx + 16 - spr.w - 2, wy - 11);
        }
        if (ledgeL && rng() < 0.7) add({ x: wx, y: wy + 4, w: 4, h: 8, layer: 'front', paint: (pc) => paintMoss(pc, wx + 1, wy + 5, seed, -1) });
        if (ledgeR && rng() < 0.7) add({ x: wx + 12, y: wy + 4, w: 4, h: 8, layer: 'front', paint: (pc) => paintMoss(pc, wx + 14, wy + 5, seed ^ 7, 1) });
      }
      // ---------- faces laterais (fachadas)
      if (t === T.SOLID && S(tx, ty - 1) && ty - 1 > 0) {
        const faceL = emptyish(tx - 1, ty) && emptyish(tx - 1, ty - 1), faceR = emptyish(tx + 1, ty) && emptyish(tx + 1, ty - 1);
        if ((faceL || faceR) && tx - lastWall >= 2) {
          const r = rng();
          const fx = faceL ? wx + 2 : wx + 3;
          if (r < 0.1 && S(tx, ty + 1)) { lastWall = tx; add({ x: fx, y: wy - 8, w: 6, h: 40, layer: 'front', paint: (pc) => paintPipe(pc, fx + (faceL ? 1 : 6), wy - 6, 34, seed) }); }
          else if (r < 0.17) { lastWall = tx; const spr = SPR.posters[rng.int(0, 3)]; blitAt(spr, fx + (faceL ? 1 : 0), wy + 1, 'front'); }
          else if (r < 0.23) { lastWall = tx; const x = fx, y = wy + 2; add({ x, y, w: 13, h: 13, layer: 'front', anim: clockAnim(SPR.clockS, x, y, rng.int(0, 2), rng() * 6) }); }
          else if (r < 0.28 && emptyish(faceL ? tx - 1 : tx + 1, ty + 1)) { lastWall = tx; const x = faceL ? wx + 1 : wx + 4, y = wy + 1; add({ x, y, w: 11, h: 13, layer: 'front', anim: sconceAnim(x, y, rng() * 7), light: { r: 40, color: '#ffb84f', i: 0.7, flicker: 0.35 } }); }
          else if (r < 0.32) { lastWall = tx; const G = SPR.gears.m, y = wy + 1; add({ x: wx + 1, y, w: G.S, h: G.S, layer: 'front', anim: gearAnim(G, wx + 1, y, rng() < 0.5 ? 0.7 : -0.9, rng() * 3, rng() < 0.5) }); }
        }
      }
      // ---------- tetos: lanternas, correntes, trepadeiras
      if ((t === T.SOLID || t === T.ALT) && free(tx, ty + 1) && ty + 1 < map.rows) {
        const deep = emptyish(tx, ty + 2) && emptyish(tx, ty + 3);
        const r = rng();
        if (r < 0.1 && deep && tx - lastHang >= 6) {
          lastHang = tx;
          const len = rng.int(8, 18), ph = rng() * 6;
          add({ x: wx + 4, y: wy + 16 + len - 2, w: 9, h: 14, layer: 'back', anim: lanternAnim(wx + 8, wy + 16, len, ph), light: { r: 44, color: '#ffb84f', i: 0.75, flicker: 0.3 } });
        } else if (r < 0.2 && deep && tx - lastHang >= 3) {
          lastHang = tx;
          const len = rng.int(10, 26), end = rng() < 0.5 ? SPR.cogs[0] : null, cx = wx + rng.int(3, 12);
          add({ x: cx - 8, y: wy + 16, w: 16, h: len + 16, layer: 'back', paint: (pc) => paintChain(pc, cx, wy + 16, len, seed, end) });
        } else if (r < 0.45 && t === T.SOLID) add({ x: wx, y: wy + 16, w: 18, h: 10, layer: 'back', paint: (pc) => paintVines(pc, wx, wy + 16, seed ^ 0x99) });
      }
      // ---------- plataformas vazadas penduradas: correntes até o teto (nada flutua à toa)
      if (t === T.ONEWAY && map.get(tx - 1, ty) !== T.ONEWAY) {
        let ex = tx; while (map.get(ex + 1, ty) === T.ONEWAY) ex++;
        const ceilAt = (cx) => { for (let k = 1; k <= 9; k++) { const o = map.get(cx, ty - k); if (solidLike(o)) return k; if (o !== T.EMPTY && o !== T.BG) return 0; } return 0; };
        for (const [cx, ox] of [[tx, 3], [ex, 12]]) {
          const k = ceilAt(cx);
          if (k < 2) continue;
          const x = cx * 16 + ox, y0 = (ty - k + 1) * 16, len = (k - 1) * 16;
          add({ x: x - 2, y: y0, w: 5, h: len + 2, layer: 'mid', anim: chainAnim(x, y0, len) });
        }
      }
      // ---------- passarelas: grade
      if (t === T.ONEWAY && free(tx, ty - 1) && walkStyle(map, tx, ty) === 'walk') {
        const l = map.get(tx - 1, ty) !== T.ONEWAY, rr = map.get(tx + 1, ty) !== T.ONEWAY;
        add({ x: wx, y: wy - 14, w: 16, h: 14, layer: 'back', paint: (pc) => paintRail(pc, wx, wy, l, rr) });
      }
      // ---------- interior das torres: pêndulos e relógios
      if (t === T.BG && bgOutdoor(map, tx, ty)) {
        if (map.get(tx, ty - 1) === T.EMPTY) roofTops.push([tx, ty]);
      } else if (t === T.BG) {
        const ceil = solidLike(map.get(tx, ty - 1));
        let depth = 0; while (depth < 6 && map.get(tx, ty + depth) === T.BG) depth++;
        if (ceil && depth >= 4 && tx - lastPend >= 5 && rng() < 0.35) {
          lastPend = tx;
          const len = Math.min(56, depth * 16 - 30);
          add({ x: wx - 8, y: wy, w: 32, h: len + 8, layer: 'mid', anim: pendulumAnim(wx + 8, wy, len, rng() * 6) });
        } else if (!ceil && depth >= 3 && depth <= 4 && map.get(tx, ty - 1) === T.BG && map.get(tx, ty + depth) !== T.ONEWAY && !clockBand.has(Math.floor(tx / 5)) && rng() < 0.3) {
          clockBand.add(Math.floor(tx / 5));
          add({ x: wx - 3, y: wy - 4, w: 23, h: 27, layer: 'mid', anim: wallClockAnim(wx - 3, wy - 4, rng.int(0, 2), rng() * 6) });
        }
      }
    }
  }
  // ---------- telhados sobre as fachadas de fundo (':' ao ar livre)
  const tod = data?.timeOfDay || 'dusk';
  const runs = [];
  for (const [tx, ty] of roofTops) {
    const last = runs[runs.length - 1];
    if (last && last.ty === ty && last.x1 === tx - 1) last.x1 = tx; else runs.push({ ty, x0: tx, x1: tx });
  }
  for (const rr of runs) {
    let room = 0;
    while (room < 3 && rr.ty - room - 1 >= 0) {
      let ok = true;
      for (let x = rr.x0; x <= rr.x1; x++) if (map.get(x, rr.ty - room - 1) !== T.EMPTY) { ok = false; break; }
      if (!ok) break;
      room++;
    }
    if (room < 1) continue;
    const x0 = rr.x0 * 16, x1 = rr.x1 * 16 + 16, yb = rr.ty * 16, seed = (rr.x0 * 7919 + rr.ty * 31) >>> 0;
    const hgt = Math.min(room * 16 - 2, 13 + Math.min(10, (rr.x1 - rr.x0) * 2));
    add({ x: x0 - 4, y: yb - hgt - 30, w: x1 - x0 + 8, h: hgt + 30, layer: 'back', paint: (pc) => paintRoof(pc, x0, x1, yb, hgt, seed, tod) });
    if (rr.x1 - rr.x0 >= 2 && room >= 2) { // chaminé fumegante na ponta
      const cx = (h2(rr.x0, rr.ty, 160) < 0.5 ? x0 + 8 : x1 - 14), cy = yb - Math.round(hgt * 0.6) - 8;
      add({ x: cx - 10, y: cy - 34, w: 26, h: 38, layer: 'back', anim: steamAnim(cx + 3, cy, rng() * 7) });
    }
  }
  return out;
}

/** Telhado mansarda (ardósia ou cobre) com lucarnas acesas e cumeeira de latão. */
const ROOF = {
  day: [{ a: '#5e9090', b: '#4e7c80', hi: '#9ac8b4', dk: '#3a5e66' }, { a: '#b06a46', b: '#9a5a3c', hi: '#e09a6a', dk: '#6a3a2a' }],
  dusk: [{ a: '#2e4a52', b: '#283f48', hi: '#4e7078', dk: '#1a2a32' }, { a: '#6a3030', b: '#5a2828', hi: '#9a4e40', dk: '#3a1a1e' }],
  night: [{ a: '#16282e', b: '#122228', hi: '#2a4650', dk: '#0a1418' }, { a: '#2a1a22', b: '#24161e', hi: '#46303a', dk: '#140c12' }],
};
function paintRoof(pc, x0, x1, yb, hgt, seed, tod) {
  const r = lrng(seed);
  const P = (ROOF[tod] || ROOF.dusk)[r() < 0.6 ? 0 : 1];
  const F = FAC[tod] || FAC.dusk;
  const inset = Math.min(6, Math.floor(hgt / 2));
  for (let yy = 0; yy < hgt; yy++) {
    const k = yy / hgt, xl = Math.round(x0 - 2 + inset * (1 - k)), xr = Math.round(x1 + 1 - inset * (1 - k));
    const y = yb - hgt + yy;
    for (let x = xl; x <= xr; x++) {
      let c = ((x + (Math.floor(yy / 3) & 1) * 3) % 6 === 0) ? P.dk : (yy % 3 === 0 ? P.b : P.a);
      if (x === xl || x === xr) c = OUT;
      else if (x === xl + 1) c = P.hi;
      pc.px(x, y, c);
    }
  }
  pc.hline(x0 - 2 + inset, yb - hgt - 1, x1 - x0 + 4 - inset * 2, OUT);
  pc.hline(x0 - 1 + inset, yb - hgt, x1 - x0 + 2 - inset * 2, BRASS.lt);
  // lucarnas
  const nD = Math.max(1, Math.floor((x1 - x0) / 34));
  for (let i = 0; i < nD; i++) {
    const dx = Math.round(x0 + ((i + 0.5) * (x1 - x0)) / nD) - 4, dy = yb - Math.min(hgt - 2, 11);
    const lit = r() < 0.55;
    pc.rect(dx, dy, 9, 9, OUT); pc.tri(dx - 1, dy + 1, dx + 9, dy + 1, dx + 4, dy - 4, OUT);
    pc.tri(dx, dy + 1, dx + 8, dy + 1, dx + 4, dy - 3, P.hi);
    pc.rect(dx + 2, dy + 2, 5, 6, lit ? F.lit : F.win); pc.vline(dx + 4, dy + 2, 6, OUT);
    if (lit) pc.px(dx + 3, dy + 3, F.lit2);
  }
  // relógio na empena (prédios largos)
  if (x1 - x0 >= 80 && r() < 0.7) {
    const cx = Math.round((x0 + x1) / 2), cy = yb - hgt - 7;
    pc.tri(cx - 11, cy + 8, cx + 11, cy + 8, cx, cy - 8, OUT); pc.tri(cx - 9, cy + 7, cx + 9, cy + 7, cx, cy - 6, P.a);
    pc.circle(cx, cy + 2, 4.6, OUT); pc.circle(cx, cy + 2, 3.8, CREAM.md); pc.px(cx - 2, cy, CREAM.hi);
    pc.vline(cx, cy - 1, 3, OUT); pc.hline(cx, cy + 2, 3, OUT); pc.px(cx, cy - 9, BRASS.lt); pc.px(cx, cy - 10, BRASS.hi);
  } else if (r() < 0.5) { // cata-vento
    const cx = Math.round(x0 + (x1 - x0) * (0.3 + r() * 0.4)), cy = yb - hgt - 1;
    pc.vline(cx, cy - 9, 9, IRON.dk); pc.hline(cx - 3, cy - 7, 7, BRASS.md); pc.px(cx + 3, cy - 8, BRASS.md); pc.px(cx - 3, cy - 6, BRASS.dk); pc.px(cx, cy - 10, BRASS.hi);
  }
}

// ------------------------------------------------------------------ camada do meio
// Decor animado com layer 'mid' (relógios de parede e pêndulos dos interiores) precisa
// ficar POR CIMA das paredes de fundo e ATRÁS do Tico. A LevelScene só conhece 'back'
// (sob os tiles) e 'front' (sobre as entidades), então as fases do Mundo 3 chamam
// promoteMidDecor(level) no onStart: cada item vira uma entidade leve com z baixo.
class MidDecor extends Entity {
  constructor(level, d) {
    super(level, d.x, d.y, {});
    this.w = d.w || 16; this.h = d.h || 16; this.z = 1; this.d = d; this.drawMargin = 24;
    if (d.light) this.light = { r: d.light.r, color: d.light.color, i: d.light.i ?? 0.8, flicker: d.light.flicker ?? 0.3 };
  }
  update() {}
  draw(ctx) { try { this.d.anim(ctx, this.level.time, this.level); } catch (e) { /* ignore */ } }
}
registerEntity('w3_mid_decor', MidDecor);
export function promoteMidDecor(level) {
  if (!level?.animDecor) return;
  const mids = level.animDecor.filter((d) => d.layer === 'mid');
  if (!mids.length) return;
  level.animDecor = level.animDecor.filter((d) => d.layer !== 'mid');
  for (const d of mids) level.entities.push(new MidDecor(level, d));
}

// ------------------------------------------------------------------ registro
registerTileset('w3', {
  skyColor: '#2a1c48',
  solid: drawStreet,
  alt: drawMachine,
  oneway: drawWalk,
  spike: drawSpike,
  bg: drawTower,
  water: { body: '#24505c', top: '#8ad8c8', deep: '#122a36', highlight: '#e0fff4', alpha: 0.76 },
  decorate,
});

// ------------------------------------------------------------------ fase-vitrine (?level=test_w3v)
function showcaseMap() {
  const W = 90, H = 40;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const R = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < W) g[j][i] = c; };
  R(0, 32, W, 8, '#');                                         // chão
  R(0, 8, 4, 24, '#'); R(4, 8, 3, 2, '#');                     // paredão
  R(4, 27, 4, 1, '='); R(4, 22, 3, 2, '#'); R(5, 18, 6, 1, '='); R(4, 14, 4, 2, '%'); R(4, 11, 6, 1, '=');
  R(11, 29, 8, 3, '#'); R(13, 27, 4, 2, '#');                  // morro de ruas
  R(14, 20, 9, 2, '#'); R(16, 22, 4, 1, '^');                  // rua suspensa com espinhos para baixo
  R(22, 32, 9, 1, '.'); R(22, 33, 9, 3, '~');                  // canal
  R(25, 27, 4, 1, '=');
  R(33, 31, 4, 1, '^');                                        // espinhos para cima
  R(36, 27, 7, 1, '=');
  R(45, 19, 2, 13, '#'); R(44, 24, 1, 3, '^'); R(47, 24, 1, 3, '^'); // pilar com espinhos ← →
  R(49, 21, 9, 3, '#'); R(51, 24, 4, 1, '^');                  // ilha suspensa
  R(59, 31, 4, 1, '%'); R(60, 30, 3, 1, '%'); R(61, 29, 2, 1, '%'); R(62, 28, 1, 1, '%');
  R(63, 24, 6, 1, '=');
  R(68, 12, 20, 20, '#'); R(70, 15, 16, 17, ':'); R(68, 29, 2, 3, 'H'); // torre do relógio + parede falsa
  R(72, 27, 5, 1, '='); R(79, 23, 6, 1, '='); R(81, 20, 3, 1, '%'); R(73, 19, 4, 1, '=');
  R(88, 12, 2, 20, '#');
  g[31][9] = 'P'; g[14][84] = 'E'; g[31][41] = 'K';
  g[31][20] = 'o'; g[20][53] = 'o'; g[30][78] = 'o';
  g[7][2] = '*'; g[18][75] = '*'; g[26][15] = '*';
  return g.map((r) => r.join(''));
}
registerLevel({
  id: 'test_w3v', world: 0, index: 0, name: 'Vitrine dos Relógios', subtitle: 'Teste de arte',
  tileset: 'w3', background: 'w3', music: null, parTime: 120, darkness: 0,
  map: showcaseMap(),
});
