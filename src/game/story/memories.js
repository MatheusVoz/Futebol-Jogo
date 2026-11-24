// =============================================================================
// story/memories.js — As 10 memórias da criança (Livro de Memórias).
//
// registerMemory(id, { title, world, text: [linhas de narração], scene(ctx, w, h, t) })
// scene() desenha uma vinheta animada de livro de histórias no retângulo (0,0,w,h)
// do ctx atual. Tudo é desenhado num espaço de projeto de 220×130 px:
//   • as partes estáticas (cenário + personagens parados) são pré-renderizadas UMA vez
//     por memória (PixelCanvas, contorno de 1 px) e escaladas para caber em w×h;
//   • a animação por quadro é barata: camadas pré-renderizadas deslocadas (respiração),
//     brilhos pré-renderizados (abajur), chuva/bolhas/notas com fillRect, fiapos de tecido.
//   • por cima vai a moldura de papel envelhecido com vinheta sépia (também cacheada).
// Personagens: Lia (7 anos, cabelo castanho com chuquinhas e laços rosa), Vó Celeste
// (coque branco, óculos dourados, cardigã roxo, fita métrica), Tico, Fiapo (boneco de pano).
// =============================================================================
import { PixelCanvas } from '../../engine/pixel.js';
import font from '../../engine/font.js';
import { registerMemory } from '../registry.js';

const DW = 220, DH = 130;
const R = Math.round;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hh = (i) => { const v = Math.sin(i * 127.1 + 11.7) * 43758.5453; return v - Math.floor(v); };

// ------------------------------------------------------------------ paletas
const OUT = '#4a2c28';
const SK = ['#c98478', '#eeb09a', '#ffd9c2', '#fff0e2'];
const LH = ['#3e2216', '#5c3624', '#7e4e32', '#a06e4c'];         // cabelo da Lia
const VH = ['#9890b0', '#c4bed6', '#e6e2f0', '#ffffff'];         // cabelo da vó
const CARD = ['#4e3080', '#6a46a0', '#8e68c4', '#b896e4'];       // cardigã
const PJ = ['#4a5cb0', '#6a88d8', '#98baf6', '#cce0ff'];         // pijama da Lia
const WOOD = ['#5a3420', '#7a4a2e', '#9a6640', '#bc8656'];
const TC = { s: '#2a9d97', b: '#3fc7c0', l: '#7fe6df', h: '#c4f6f0', sp: '#ffd23f', eye: '#120a18', out: '#1b2a3a' };
const TT = [TC.s, TC.b, TC.l, TC.h];

// ------------------------------------------------------------------ desenho base
function ball(pc, cx, cy, rx, ry, t) {
  pc.ellipse(cx, cy, rx, ry, t[0]);
  pc.ellipse(cx - rx * 0.14, cy - ry * 0.15, rx * 0.84, ry * 0.8, t[1]);
  pc.ellipse(cx - rx * 0.36, cy - ry * 0.38, rx * 0.42, ry * 0.36, t[2]);
  if (t[3] && rx > 3) pc.px(R(cx - rx * 0.5), R(cy - ry * 0.6), t[3]);
}
function layer(fn, outline = OUT) {
  const pc = new PixelCanvas(DW, DH);
  fn(pc);
  if (outline) pc.outline(outline);
  return pc;
}
const canvasOf = (pc) => { pc.flush(); return pc.canvas; };

/** Rosto genérico: expressões smile happy roar sad cry scared sleep sing listen. */
function face(pc, cx, cy, expr, r, o = {}) {
  const ec = o.eye || '#2e1828', dx = Math.max(2, R(r * 0.42)), ey = R(cy + r * 0.05), my = R(cy + r * 0.55);
  const [eyes, mouth] = {
    smile: ['open', 'smile'], happy: ['happy', 'open'], roar: ['happy', 'roar'], sad: ['sad', 'sad'],
    cry: ['closed', 'cry'], scared: ['scared', 'o'], sleep: ['closed', 'dot'], sing: ['closed', 'o'], listen: ['open', 'dot'],
  }[expr] || ['open', 'smile'];
  for (const x of [cx - dx - 1, cx + dx]) {
    if (eyes === 'open' || eyes === 'sad') { const eh = r >= 7 ? 3 : 2; pc.rect(x, ey - eh + 1, 2, eh, ec); if (r >= 6) pc.px(x, ey - eh + 1, '#ffffff'); if (r >= 7) pc.px(x + (x < cx ? -1 : 2), ey - eh + 1, ec); }
    else if (eyes === 'scared') { pc.rect(x, ey - 2, 2, 3, ec); pc.px(x, ey - 2, '#ffffff'); }
    else if (eyes === 'happy') { if (o.small) pc.hline(x, ey, 2, ec); else { pc.px(x - 1, ey, ec); pc.hline(x, ey - 1, 2, ec); pc.px(x + 2, ey, ec); } }
    else { pc.px(x - 1, ey - 1, ec); pc.hline(x, ey, 2, ec); pc.px(x + 2, ey - 1, ec); }
    if (eyes === 'sad' || eyes === 'scared') pc.px(x + (x < cx ? -1 : 2), ey - 3, ec);
  }
  if (!o.noBlush) { pc.px(cx - dx - 2, my - 1, '#ff9ab0'); pc.px(cx - dx - 3, my - 1, '#ff9ab0'); pc.px(cx + dx + 2, my - 1, '#ff9ab0'); pc.px(cx + dx + 3, my - 1, '#ff9ab0'); }
  const ml = '#8a3a40', mi = '#5a1a2a';
  if (mouth === 'smile') { pc.px(cx - 1, my, ml); pc.px(cx, my + 1, ml); pc.px(cx + 1, my, ml); }
  else if (mouth === 'open') { pc.rect(cx - 1, my, 3, 2, mi); pc.px(cx, my + 1, '#e86a7a'); }
  else if (mouth === 'roar') { pc.rect(cx - 2, my - 1, 4, 3, mi); pc.hline(cx - 1, my + 1, 2, '#e86a7a'); pc.px(cx - 2, my - 1, '#ffffff'); }
  else if (mouth === 'sad') { pc.px(cx - 1, my + 1, ml); pc.px(cx, my, ml); pc.px(cx + 1, my + 1, ml); }
  else if (mouth === 'cry') { pc.rect(cx - 1, my, 3, 2, mi); pc.px(cx - 2, my + 1, ml); pc.px(cx + 2, my + 1, ml); }
  else if (mouth === 'o') pc.rect(cx, my, 2, 2, mi);
  else pc.px(cx, my, ml);
  if (expr === 'cry' || expr === 'sad') { pc.px(cx - dx - 1, ey + 2, '#8ad0ff'); pc.px(cx - dx - 1, ey + 3, '#5ab0ff'); if (expr === 'cry') { pc.px(cx + dx + 1, ey + 2, '#8ad0ff'); pc.px(cx + dx + 1, ey + 3, '#5ab0ff'); pc.px(cx + dx + 1, ey + 4, '#8ad0ff'); } }
}
function bow(pc, x, y, c = ['#a8306a', '#e85a9a', '#ff8ac0']) {
  pc.poly([[x, y], [x - 3, y - 2], [x - 3, y + 2]], c[1]); pc.poly([[x, y], [x + 3, y - 2], [x + 3, y + 2]], c[2]); pc.px(x, y, c[0]);
}
/** Cabeça da Lia (ou de outra menina com o.hair / o.bows=false). Estilo chibi detalhado. */
function liaHead(pc, cx, cy, expr = 'smile', o = {}) {
  const r = o.r || 7.5, H = o.hair || LH;
  // marias-chiquinhas atrás
  if (o.tails !== false) for (const s of [-1, 1]) { ball(pc, cx + s * (r + 2), cy + 2, 3, 4.4, H); pc.px(R(cx + s * (r + 2)), R(cy + 6), H[3]); }
  // massa de cabelo
  pc.ellipse(cx, cy - 0.5, r + 1.4, r + 1, H[0]);
  pc.ellipse(cx - 0.3, cy - 0.8, r + 0.8, r + 0.5, H[1]);
  // rosto (luz vindo da esquerda)
  pc.ellipse(cx, cy + r * 0.32, r * 0.92, r * 0.8, SK[0]);
  pc.ellipse(cx - 0.4, cy + r * 0.27, r * 0.86, r * 0.74, SK[1]);
  pc.ellipse(cx - r * 0.3, cy + r * 0.12, r * 0.42, r * 0.36, SK[2]);
  // franja em ondinhas + mechas laterais
  for (let i = -2; i <= 2; i++) pc.ellipse(cx + i * r * 0.36, cy - r * 0.3 + Math.abs(i) * 0.6, r * 0.26, r * 0.36, H[1]);
  for (let i = -2; i <= 2; i++) pc.px(R(cx + i * r * 0.36), R(cy - r * 0.3 + Math.abs(i) * 0.6 + r * 0.3), H[0]);
  for (const s of [-1, 1]) { pc.ellipse(cx + s * r * 0.86, cy + r * 0.2, r * 0.22, r * 0.55, H[1]); pc.px(R(cx + s * r * 0.86), R(cy + r * 0.7), H[0]); }
  // brilho do cabelo
  for (let a = -2.6; a < -1.2; a += 0.12) pc.px(R(cx + Math.cos(a) * r * 0.75), R(cy - 1 + Math.sin(a) * r * 0.75), H[3]);
  if (o.bows !== false && o.tails !== false) { bow(pc, R(cx - r - 1), R(cy - 3)); bow(pc, R(cx + r + 1), R(cy - 3)); }
  face(pc, cx, cy + 1.5, expr, r);
}
/** Cabeça da Vó Celeste: cachinhos brancos, coque com agulha, óculos redondos. */
function voHead(pc, cx, cy, expr = 'smile', o = {}) {
  const r = o.r || 7.5;
  pc.line(R(cx + r * 0.9), R(cy - r - 5), R(cx - r * 0.2), R(cy - r), '#c8ccd8');          // agulha no coque
  pc.px(R(cx + r * 0.9) + 1, R(cy - r - 5), '#ffd23f'); pc.px(R(cx + r * 0.9) + 2, R(cy - r - 4), '#ffd23f');
  ball(pc, cx + r * 0.1, cy - r - 1.5, r * 0.6, r * 0.5, VH);                              // coque
  // cabelo fofinho em cachos
  for (let a = Math.PI * 0.9; a < Math.PI * 2.1; a += 0.42) ball(pc, cx + Math.cos(a) * r * 0.95, cy - 0.5 + Math.sin(a) * r * 0.9, r * 0.36, r * 0.34, VH);
  pc.ellipse(cx, cy - 0.5, r * 0.95, r * 0.85, VH[1]);
  // rosto
  pc.ellipse(cx, cy + r * 0.34, r * 0.88, r * 0.76, SK[0]);
  pc.ellipse(cx - 0.4, cy + r * 0.3, r * 0.82, r * 0.7, SK[1]);
  pc.ellipse(cx - r * 0.3, cy + r * 0.15, r * 0.4, r * 0.34, SK[2]);
  for (let i = -2; i <= 2; i++) pc.ellipse(cx + i * r * 0.34, cy - r * 0.32, r * 0.24, r * 0.22, VH[2]);
  face(pc, cx, cy + 1.5, expr, r, { eye: '#3a2438', small: true });
  // óculos redondos dourados
  const dx = Math.max(2, R(r * 0.42)), ey = R(cy + 1.5 + r * 0.05);
  for (const x of [cx - dx - 1, cx + dx]) pc.ellipseOutline(x + 1, ey, 2.6, 2.4, '#b8862a');
  pc.hline(cx - dx + 2, ey - 1, Math.max(1, 2 * dx - 3), '#b8862a');
  pc.px(cx - dx - 1, ey - 2, '#fff0b0');
  pc.px(R(cx - r * 0.85), R(cy + r * 0.62), '#ffffff');                                       // brinco de pérola
}
/** Corpo da Lia em pé (vestido, gola, mangas bufantes, meias e sapatinhos). (cx, fy) = pés. */
function liaBody(pc, cx, fy, dress = ['#c8306a', '#ff8ac0', '#ffb0d4', '#ffe0ee']) {
  // pernas, meias e sapatos
  pc.rect(cx - 5, fy - 10, 3, 8, SK[1]); pc.rect(cx + 2, fy - 10, 3, 8, SK[0]);
  pc.rect(cx - 5, fy - 5, 3, 3, '#ffffff'); pc.rect(cx + 2, fy - 5, 3, 3, '#f0eef6');
  pc.ellipse(cx - 4, fy - 1, 3, 1.6, '#c8306a'); pc.ellipse(cx + 4, fy - 1, 3, 1.6, '#a02050');
  // saia em A com barra ondulada
  pc.poly([[cx - 6, fy - 27], [cx + 6, fy - 27], [cx + 12, fy - 10], [cx - 12, fy - 10]], dress[1]);
  pc.poly([[cx - 6, fy - 27], [cx - 2, fy - 27], [cx - 7, fy - 10], [cx - 12, fy - 10]], dress[2]);
  pc.poly([[cx + 3, fy - 27], [cx + 6, fy - 27], [cx + 12, fy - 10], [cx + 7, fy - 10]], dress[0] + '99');
  for (let x = cx - 11; x <= cx + 11; x += 3) pc.circle(x, fy - 10, 1.4, dress[1]);
  pc.hline(cx - 11, fy - 9, 23, dress[3]);
  // corpete, gola branca e mangas bufantes
  pc.rect(cx - 6, fy - 31, 12, 6, dress[1]);
  pc.ellipse(cx - 2, fy - 31, 2.5, 1.6, '#ffffff'); pc.ellipse(cx + 2, fy - 31, 2.5, 1.6, '#f4f0fa');
  ball(pc, cx - 7, fy - 29, 3, 2.6, [dress[0], dress[1], dress[2], dress[3]]);
  ball(pc, cx + 7, fy - 29, 3, 2.6, [dress[0], dress[1], dress[2], dress[3]]);
  for (const [x, y] of [[cx - 4, fy - 20], [cx + 3, fy - 16], [cx - 1, fy - 13]]) pc.px(x, y, '#ffffff');
}
/** Tico pequenino (24×20), olhando à direita. o: roar, closed, glow. */
function ticoPC(o = {}) {
  const pc = new PixelCanvas(24, 20);
  pc.thickLine(6, 13, 3, 8, 1.4, TC.s); ball(pc, 3, 7, 2.2, 2.2, TT);
  ball(pc, 9, 13, 5.5, 4.2, TT);
  pc.rect(6, 16, 2, 3, TC.s); pc.rect(11, 16, 2, 3, TC.b);
  pc.thickLine(12, 11, 15, 6, 1.5, TC.b);
  ball(pc, 17, 5, 4.6, 3.8, TT);
  for (const [x, y] of [[5, 9], [8, 8], [11, 8], [13, 6], [14, 3], [16, 1]]) { pc.px(x, y, TC.sp); pc.px(x, y - 1, '#e0a020'); }
  pc.px(8, 13, '#ffd23f'); pc.px(9, 13, '#ffd23f'); pc.px(11, 15, '#ff8a3c'); pc.px(6, 12, '#4a7fe0');
  if (o.closed) pc.hline(18, 4, 2, TC.eye); else { pc.rect(18, 3, 2, 2, TC.eye); pc.px(18, 3, '#ffffff'); }
  if (o.roar) { pc.rect(19, 6, 3, 2, '#5a1a2a'); pc.px(21, 6, '#ffffff'); } else { pc.px(20, 6, TC.out); pc.px(19, 7, TC.out); }
  pc.outline(TC.out);
  if (o.glow) for (const [x, y] of [[6, 11], [8, 10], [10, 10], [12, 11], [14, 8], [16, 3], [3, 5]]) pc.px(x, y, '#ffe680');
  return pc;
}
/** Fiapo, boneco de pano (14×18). */
function fiapoPC() {
  const pc = new PixelCanvas(14, 18);
  pc.rect(4, 9, 6, 6, '#5272b6'); pc.hline(4, 9, 6, '#7896dc');
  pc.thickLine(4, 10, 1, 13, 1, '#c8a680'); pc.thickLine(10, 10, 13, 12, 1, '#c8a680');
  pc.rect(4, 15, 2, 3, '#c8a680'); pc.rect(8, 15, 2, 3, '#9a7656');
  for (const [x, y] of [[3, 3], [5, 1], [8, 1], [10, 3], [2, 6], [11, 6]]) pc.circle(x + 0.5, y + 0.5, 1.6, '#d0603a');
  pc.circle(7, 5, 3.6, '#e8d2b2'); pc.px(5, 3, '#fff3de');
  pc.px(5, 5, '#ece2d0'); pc.px(8, 5, '#d03a50'); pc.px(6, 7, '#7a4a2a'); pc.px(7, 7, '#7a4a2a');
  pc.outline('#3a2418');
  return pc;
}

// ------------------------------------------------------------------ cenário
function room(pc, o) {
  const [w0, w1, w2] = o.wall, fy = o.floorY;
  pc.rect(0, 0, DW, fy, w1);
  for (let y = 0; y < fy; y++) for (let x = 0; x < DW; x++) {
    if (o.paper === 'stripes') { if (x % 16 < 7 && bay(x, y) < 0.45) pc.px(x, y, w2); }
    else if (o.paper === 'dots') { if (y % 14 === 5 && (x + (y % 28 < 14 ? 0 : 7)) % 14 === 0) { pc.rect(x, y, 2, 2, w2); pc.px(x + 1, y + 1, w0); } }
    else if (o.paper === 'tiles') { if (x % 12 === 0 || y % 12 === 0) pc.px(x, y, w0); else if (x % 12 === 1 && y % 12 === 1) pc.px(x, y, w2); }
    if (y < 14 && bay(x, y) < (14 - y) / 28) pc.px(x, y, w0);
  }
  pc.rect(0, fy - 4, DW, 4, o.base || '#efe0c6'); pc.hline(0, fy - 4, DW, '#fff6e6'); pc.hline(0, fy - 1, DW, '#9a7a5a');
  const [f0, f1, f2] = o.floor;
  pc.rect(0, fy, DW, DH - fy, f1);
  for (let y = fy, k = 0; y < DH; y += 6, k++) {
    pc.hline(0, y, DW, f2); pc.hline(0, y + 5, DW, f0);
    for (let x = (k * 23) % 37; x < DW; x += 37) pc.vline(x, y + 1, 4, f0);
  }
}
function windowFrame(pc, x, y, w, h, sky, o = {}) {
  pc.vgradient(x, y, w, h, sky);
  if (o.stars) for (let i = 0; i < 10; i++) pc.px(x + 2 + R(hh(i) * (w - 4)), y + 2 + R(hh(i + 50) * (h * 0.6)), i % 3 ? '#fff4c8' : '#ffffff');
  if (o.moon) { pc.circle(o.moon[0], o.moon[1], 5, '#fff4c8'); pc.circle(o.moon[0] + 2, o.moon[1] - 1, 4.2, sky[0]); }
  if (o.sun) { pc.circle(o.sun[0], o.sun[1], 6, '#ffe890'); pc.circle(o.sun[0], o.sun[1], 4, '#fff8d0'); }
  if (o.clouds) for (const [cx, cy] of o.clouds) { pc.ellipse(cx, cy, 7, 3, '#ffffff'); pc.ellipse(cx + 5, cy - 2, 4, 3, '#ffffff'); pc.hline(cx - 6, cy + 2, 13, '#dceaf6'); }
  if (o.hill) for (let xx = x; xx < x + w; xx++) { const hy = R(y + h - 6 - Math.sin((xx - x) * 0.12) * 3); pc.vline(xx, hy, y + h - hy, o.hill); }
  const fr = o.frame || WOOD;
  pc.strokeRect(x - 2, y - 2, w + 4, h + 4, fr[0]); pc.strokeRect(x - 1, y - 1, w + 2, h + 2, fr[2]);
  pc.vline(x + (w >> 1), y, h, fr[2]); pc.hline(x, y + (h >> 1), w, fr[2]);
  pc.rect(x - 5, y + h + 2, w + 10, 3, fr[3]); pc.hline(x - 5, y + h + 4, w + 10, fr[0]);
  if (o.curtain) for (const [cx, dir] of [[x - 3, -1], [x + w + 2, 1]]) {
    const C = o.curtain;
    pc.poly([[cx - 6, y - 5], [cx + 6, y - 5], [cx + 3 + dir * 2, y + h + 6], [cx - 3 + dir * 2, y + h + 6]], C[1]);
    for (let k = -1; k <= 1; k++) pc.line(cx + k * 3, y - 4, cx + k * 3 + dir * 2, y + h + 5, C[0]);
    pc.line(cx - 5, y - 4, cx - 3 + dir * 2, y + h + 5, C[2]);
  }
  if (o.curtain || o.rod) pc.rect(x - 12, y - 6, w + 24, 2, fr[1]);
}
function lamp(pc, x, y, shade = ['#d08a40', '#f0b860', '#ffd890', '#fff2c8']) {   // (x,y) = base
  pc.rect(x - 2, y - 10, 4, 10, '#c8a060'); pc.vline(x - 2, y - 10, 10, '#e8c890'); pc.rect(x - 4, y - 1, 8, 2, '#8a6a40');
  pc.poly([[x - 7, y - 21], [x + 7, y - 21], [x + 10, y - 10], [x - 10, y - 10]], shade[2]);
  pc.poly([[x - 7, y - 21], [x - 3, y - 21], [x - 6, y - 10], [x - 10, y - 10]], shade[3]);
  pc.hline(x - 10, y - 10, 21, shade[0]); pc.hline(x - 7, y - 21, 15, shade[1]);
}
function table(pc, x, y, w, h) {
  pc.rect(x, y, w, 3, WOOD[3]); pc.hline(x, y + 2, w, WOOD[1]);
  pc.rect(x + 2, y + 3, 2, h - 3, WOOD[1]); pc.rect(x + w - 4, y + 3, 2, h - 3, WOOD[0]);
}
function bed(pc, x, y, w, quilt, o = {}) {   // (x,y) = topo do colchão
  pc.rect(x - 3, y - 18, 4, 30, WOOD[1]); pc.vline(x - 3, y - 18, 30, WOOD[3]); pc.circle(x - 1, y - 19, 2.4, WOOD[2]);
  pc.rect(x, y, w, 12, '#f4ead8'); pc.rect(x, y + 9, w, 3, '#d8c8b0');
  pc.rect(x + 2, y - 5, 18, 7, '#fffaf0'); pc.hline(x + 3, y - 5, 16, '#ffffff'); pc.hline(x + 2, y + 1, 18, '#e0d6c8');
  if (quilt) {
    const qx = x + (o.quiltX ?? 16);
    for (let i = 0; qx + i * 8 < x + w; i++) for (let j = 0; j < 2; j++) pc.rect(qx + i * 8, y + 1 + j * 6, 8, 6, quilt[(i + j) % quilt.length]);
    for (let xx = qx; xx < x + w; xx += 2) pc.px(xx, y + 7, '#fff6e0');
    pc.hline(qx, y + 1, x + w - qx, '#ffffff60');
  }
  pc.rect(x + w - 2, y - 8, 4, 22, WOOD[1]); pc.circle(x + w, y - 9, 2.4, WOOD[2]);
}
const QUILT = ['#3fc7c0', '#ffd23f', '#ff8a3c', '#4a7fe0', '#ff9ab0'];

// ------------------------------------------------------------------ animação barata
const glowCache = new Map();
function glowImg(r, color) {
  const k = r + color;
  let c = glowCache.get(k);
  if (c) return c;
  const pc = new PixelCanvas(r * 2 + 1, r * 2 + 1);
  for (let y = 0; y <= r * 2; y++) for (let x = 0; x <= r * 2; x++) {
    const d = Math.hypot(x - r, y - r) / r;
    if (d >= 1) continue;
    const lv = Math.floor((1 - d) * (1 - d) * 4 + bay(x, y) * 0.9) / 4;
    if (lv > 0) pc.px(x, y, color + Math.min(255, R(lv * 200)).toString(16).padStart(2, '0'));
  }
  c = canvasOf(pc); glowCache.set(k, c);
  return c;
}
function glow(ctx, x, y, r, color, a) {
  const pa = ctx.globalAlpha, op = ctx.globalCompositeOperation;
  ctx.globalAlpha = pa * Math.max(0, Math.min(1, a)); ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowImg(r, color), x - r, y - r);
  ctx.globalAlpha = pa; ctx.globalCompositeOperation = op;
}
function dot(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), w, h); }
function sparkle(ctx, x, y, s, c = '#fff6c0') {
  dot(ctx, x, y, 1, 1, '#ffffff');
  if (s > 0.5) { dot(ctx, x - 1, y, 1, 1, c); dot(ctx, x + 1, y, 1, 1, c); dot(ctx, x, y - 1, 1, 1, c); dot(ctx, x, y + 1, 1, 1, c); }
}
function rain(ctx, x, y, w, h, t, n, c, speed = 90, len = 3, slant = 0) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = c;
  for (let i = 0; i < n; i++) {
    const yy = (hh(i) * h + t * speed * (0.8 + hh(i + 9) * 0.4)) % (h + len);
    const xx = (hh(i + 3) * w + yy * slant) % w;
    ctx.fillRect(R(x + xx), R(y + yy - len), 1, len);
  }
  ctx.restore();
}
/** Nota musical de pixel (colcheia ou duas colcheias ligadas). */
function note(ctx, x, y, two) {
  for (const [c, o] of [['#3a2a50', 1], ['#ffe8a0', 0]]) {
    ctx.fillStyle = c;
    ctx.fillRect(x + o, y + 5 + o, 3, 2); ctx.fillRect(x + 2 + o, y + o, 1, 6);
    if (two) { ctx.fillRect(x + 5 + o, y + 4 + o, 3, 2); ctx.fillRect(x + 7 + o, y - 1 + o, 1, 6); ctx.fillRect(x + 2 + o, y + o, 6, 1); }
    else { ctx.fillRect(x + 3 + o, y + 1 + o, 1, 1); ctx.fillRect(x + 4 + o, y + 2 + o, 1, 2); }
  }
}
const pulse = (t, f, k = 0) => Math.sin(t * f + k);
const breath = (t, f = 1.6, k = 0) => (Math.sin(t * f + k) > 0.2 ? 1 : 0);
const flick = (t) => 0.06 * Math.sin(t * 13) + 0.04 * Math.sin(t * 29.7) + 0.03 * Math.sin(t * 5.3);
const qpt = (a, b, c, u) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1]];

// ------------------------------------------------------------------ moldura de papel
let overlayCanvas = null;
function overlay() {
  if (overlayCanvas) return overlayCanvas;
  const pc = new PixelCanvas(DW, DH);
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
    const nx = (x + 0.5 - DW / 2) / (DW / 2), ny = (y + 0.5 - DH / 2) / (DH / 2);
    const d = Math.sqrt(nx * nx * 0.8 + ny * ny * 0.9);
    const v = Math.max(0, (d - 0.62) / 0.5);
    const lv = Math.floor(v * 4 + bay(x, y) * 0.99) / 4;
    if (lv > 0) pc.px(x, y, '#3a2010' + R(Math.min(1, lv) * 120).toString(16).padStart(2, '0'));
    const g = hh(x * 7.3 + y * 131.9);
    if (g < 0.025) pc.px(x, y, '#fff4dc30'); else if (g > 0.975) pc.px(x, y, '#5a3a2020');
  }
  for (let x = 0; x < DW; x++) for (const y of [0, 1, DH - 1, DH - 2]) pc.px(x, y, '#f2e4c8');
  for (let y = 0; y < DH; y++) for (const x of [0, 1, DW - 1, DW - 2]) pc.px(x, y, '#f2e4c8');
  for (let x = 2; x < DW - 2; x++) { if (hh(x) < 0.7) pc.px(x, 2, '#f2e4c8a0'); if (hh(x + 400) < 0.7) pc.px(x, DH - 3, '#f2e4c8a0'); }
  pc.strokeRect(2, 2, DW - 4, DH - 4, '#a88a60');
  for (const [x, y] of [[3, 3], [DW - 4, 3], [3, DH - 4], [DW - 4, DH - 4]]) pc.px(x, y, '#a88a60');
  overlayCanvas = canvasOf(pc);
  return overlayCanvas;
}
function lint(ctx, t, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) {
    const x = (hh(i) * DW + t * (2 + hh(i + 4) * 3) + Math.sin(t * 0.7 + i) * 6) % DW;
    const y = (hh(i + 20) * DH + t * (3 + hh(i + 7) * 4)) % DH;
    ctx.fillRect(R(x), R(y), 1, 1);
  }
}

// ------------------------------------------------------------------ fábrica de cenas
const cache = new Map();
function vignette(id, build, anim, opts = {}) {
  return function scene(ctx, w, h, t = 0) {
    let st = cache.get(id);
    if (!st) {
      st = {};
      const bg = new PixelCanvas(DW, DH);
      build(bg, st);
      st.bg = canvasOf(bg);
      cache.set(id, st);
    }
    const s = Math.min(w / DW, h / DH);
    const sm = ctx.imageSmoothingEnabled;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.fillStyle = '#e8d4b0'; ctx.fillRect(0, 0, w, h);
    ctx.translate(R((w - DW * s) / 2), R((h - DH * s) / 2));
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(st.bg, 0, 0);
    anim(ctx, t, st);
    ctx.globalAlpha = opts.lintA ?? 0.45;
    lint(ctx, t, opts.lint || '#fff4e0');
    ctx.globalAlpha = 1;
    ctx.drawImage(overlay(), 0, 0);
    ctx.restore();
    ctx.imageSmoothingEnabled = sm;
  };
}

// =============================================================== mem_1
registerMemory('mem_1', {
  title: 'O Primeiro Abraço', world: 1,
  text: [
    'Naquela noite, a Vó Celeste deu o último ponto com a linha dourada.',
    '— Pronto, pequena. Agora você tem alguém para cuidar de você.',
    'A bebê Lia apertou o dinossauro de retalhos... e não soltou mais.',
  ],
  scene: vignette('mem_1', (bg, st) => {
    room(bg, { wall: ['#c08460', '#d89c74', '#eebf96'], paper: 'dots', floorY: 100, floor: ['#6e4228', '#8a583a', '#a4704c'] });
    windowFrame(bg, 14, 18, 38, 44, ['#18204a', '#26346a', '#3a4c86'], { stars: true, moon: [42, 28], curtain: ['#8a3a4a', '#b8566a', '#d87a8a'] });
    bg.ellipse(110, 114, 76, 9, '#9a3c40'); bg.ellipse(110, 114, 68, 7, '#c4604e');
    for (let x = 46; x < 176; x += 3) bg.px(x, 114, '#f0c890');
    table(bg, 180, 80, 30, 22); lamp(bg, 195, 80);
    // berço com mantinha de retalhos (os mesmos do Tico)
    st.base = layer((pc) => {
      pc.rect(128, 96, 3, 8, WOOD[1]); pc.rect(164, 96, 3, 8, WOOD[0]);
      pc.curve(122, 104, 147, 99, 172, 104, WOOD[2], 1);
      pc.ellipse(147, 88, 25, 11, '#d8c098'); pc.ellipse(147, 86, 23, 9, '#ead8b4');
      for (let x = 126; x < 170; x += 4) pc.vline(x, 84, 12, '#c8ac80');
      pc.ellipse(168, 79, 9, 13, '#e8d4b0'); pc.ellipse(167, 79, 7, 11, '#f6e8cc');
      for (let i = 0; i < 5; i++) pc.rect(128 + i * 7, 82, 7, 7, QUILT[i]);
      pc.hline(128, 82, 35, '#ffffff70');
      for (let x = 128; x < 163; x += 2) pc.px(x, 85, '#fff6e0');
      ball(pc, 141, 78, 4.6, 4.4, SK); pc.px(140, 73, LH[1]); pc.px(141, 73, LH[2]); pc.px(142, 74, LH[1]);
      face(pc, 141, 78, 'happy', 4.5);
    });
    // cadeira de balanço + vó
    st.chair = layer((pc) => {
      pc.curve(40, 100, 70, 105, 100, 98, WOOD[1], 1);
      pc.rect(46, 44, 4, 54, WOOD[1]); pc.vline(46, 44, 54, WOOD[3]); pc.rect(54, 48, 3, 40, WOOD[2]);
      pc.rect(84, 82, 3, 18, WOOD[0]); pc.rect(50, 80, 38, 4, WOOD[2]);
      // saia no colo, pernas e sapatinhos
      pc.ellipse(78, 84, 15, 6, '#5a4a7a'); pc.ellipse(77, 83, 13, 4.5, '#7a68a0'); pc.hline(66, 82, 20, '#9a8ac0');
      pc.rect(86, 86, 4, 11, '#e8d8c8'); pc.rect(86, 92, 4, 5, '#c8b8a8');
      pc.ellipse(90, 98, 4.5, 2, '#5a2a2a'); pc.px(88, 97, '#8a4a4a');
      // tronco de cardigã com botões e xale
      pc.poly([[57, 62], [75, 62], [79, 82], [55, 82]], CARD[1]);
      pc.poly([[57, 62], [63, 62], [60, 82], [55, 82]], CARD[2]);
      pc.poly([[71, 62], [75, 62], [79, 82], [74, 82]], CARD[0]);
      pc.vline(66, 66, 15, CARD[0]); for (let y = 67; y < 81; y += 4) pc.px(67, y, '#ffd84a');
      pc.poly([[56, 60], [76, 60], [72, 68], [66, 64], [60, 68]], '#f0e2c8'); pc.hline(57, 60, 19, '#fff4e0');
      // braços estendidos segurando o Tico (mangas com punho)
      pc.thickLine(72, 66, 93, 67, 2.2, CARD[1]); pc.thickLine(62, 70, 89, 73, 2.2, CARD[2]);
      pc.rect(90, 65, 3, 4, CARD[3]); pc.rect(86, 71, 3, 4, CARD[3]);
      ball(pc, 96, 67, 2.6, 2.4, SK); ball(pc, 91, 73, 2.6, 2.4, SK);
    });
    bg.blit(st.base); bg.blit(st.chair);
    st.vo = canvasOf(layer((pc) => voHead(pc, 66, 52, 'smile', { r: 8 })));
    st.tico = canvasOf(ticoPC());
    st.arms = [0, 1].map((k) => canvasOf(layer((pc) => {
      ball(pc, 134, 76 - k * 2, 1.8, 2.4, SK); ball(pc, 148, 74 - (1 - k) * 2, 1.8, 2.4, SK);
    })));
  }, (ctx, t, st) => {
    glow(ctx, 195, 66, 46, '#ffcf70', 0.35 + flick(t));
    ctx.drawImage(st.vo, 0, breath(t));
    const tb = R(Math.sin(t * 2) * 1);
    ctx.drawImage(st.tico, 96, 53 + tb);
    ctx.drawImage(st.arms[Math.floor(t * 3) & 1], 0, 0);
    const a = [97, 66], b = [108, 46], c = [112, 62 + tb];
    ctx.fillStyle = '#ffd23f';
    for (let u = 0; u <= 1; u += 0.05) { const [x, y] = qpt(a, b, c, u); ctx.fillRect(R(x), R(y), 1, 1); }
    for (let i = 0; i < 3; i++) { const [x, y] = qpt(a, b, c, (t * 0.5 + i / 3) % 1); sparkle(ctx, x, y, pulse(t, 6, i)); }
  }),
});

// =============================================================== mem_2
registerMemory('mem_2', {
  title: 'O Rugido', world: 1,
  text: [
    '— Não, Tico! Dinossauro de verdade faz assim: RAWR!',
    'A Lia rugia, rugia... e caía na risada antes de terminar.',
    'O Tico nunca aprendeu a rugir. Mas aprendeu a fazer ela rir.',
  ],
  scene: vignette('mem_2', (bg, st) => {
    room(bg, { wall: ['#8cb8b8', '#a8d0c8', '#c8e8dc'], paper: 'stripes', floorY: 98, floor: ['#a06a44', '#bc845a', '#d49c70'] });
    windowFrame(bg, 150, 14, 48, 40, ['#7ec0f0', '#a8d8f8', '#d4f0ff'], { sun: [188, 24], clouds: [[162, 30]], hill: '#7ac070', curtain: ['#d08a30', '#f0b850', '#ffd880'] });
    bg.ellipse(96, 114, 60, 8, '#e8a0b0'); bg.ellipse(96, 114, 52, 6, '#f8c0c8');
    // blocos de brinquedo e um livro no chão
    for (const [x, c, l] of [[20, '#e84a40', 'A'], [30, '#4a7fe0', 'B'], [25, '#ffd23f', 'C']]) {
      const y = l === 'C' ? 92 : 102; bg.rect(x, y, 9, 9, c); bg.hline(x, y, 9, '#ffffff80'); bg.strokeRect(x, y, 9, 9, OUT);
    }
    bg.rect(176, 104, 18, 4, '#7a52b0'); bg.rect(177, 103, 16, 2, '#fff6e6');
    st.lia = canvasOf(layer((pc) => {
      liaBody(pc, 95, 108);
      liaHead(pc, 95, 69, 'roar');
      pc.thickLine(102, 79, 110, 73, 1.6, SK[1]); pc.thickLine(88, 80, 106, 78, 1.6, SK[0]);
    }));
    st.tico = canvasOf(ticoPC({ roar: true }));
    st.hands = canvasOf(layer((pc) => { ball(pc, 112, 74, 2.2, 2.2, SK); ball(pc, 109, 79, 2.2, 2.2, SK); }));
  }, (ctx, t, st) => {
    const hop = R(Math.abs(Math.sin(t * 5)) * 2);
    ctx.drawImage(st.lia, 0, -hop);
    const jx = Math.sin(t * 30) > 0 ? 1 : 0;
    ctx.drawImage(st.tico, 104 + jx, 60 - hop);
    ctx.drawImage(st.hands, 0, -hop);
    const k = (t * 1.2) % 2;
    if (k < 1.5) {
      const sc = k < 0.15 ? 2 : 1;
      const sx = R(Math.sin(t * 40)), sy = R(Math.cos(t * 37));
      font.draw(ctx, 'RAWR!', 140 + sx, 52 + sy, { color: '#ff6a3c', outline: '#4a1a10', align: 'center', scale: sc });
      for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.6; dot(ctx, 128 + Math.cos(a) * (10 + k * 6), 62 + Math.sin(a) * (10 + k * 6), 2, 1, '#ffd23f'); }
    }
    if (k > 0.8) font.draw(ctx, 'hi hi!', 70, 52 - R((k - 0.8) * 8), { color: '#e85a9a', outline: '#ffffff', align: 'center' });
  }),
});

// =============================================================== mem_3
registerMemory('mem_3', {
  title: 'Hora do Banho', world: 2,
  text: [
    'Hora do banho: espuma até as orelhas e um patinho de borracha.',
    '— O Tico não pode entrar, vó? — Só na beiradinha, querida.',
    'Ele ficou ali, de guarda, respingado de bolhas e de risadas.',
  ],
  scene: vignette('mem_3', (bg, st) => {
    room(bg, { wall: ['#7ab4c0', '#a4d4dc', '#d8f2f4'], paper: 'tiles', floorY: 104, floor: ['#c8b8a8', '#e8dccc', '#f8f0e4'], base: '#ffffff' });
    for (let y = 104; y < DH; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < DW; x += 12) bg.rect(x, y, 6, 6, '#c8d8e8');
    windowFrame(bg, 18, 14, 26, 24, ['#a8d8f8', '#d4f0ff', '#ffffff'], { frame: ['#8aa0b0', '#b8c8d4', '#e8f0f6', '#ffffff'] });
    bg.rect(176, 20, 26, 3, '#ffffff'); bg.rect(180, 12, 6, 8, '#ff8ab0'); bg.rect(190, 14, 5, 6, '#7ae0c0'); bg.circle(197, 17, 3, '#ffd23f');
    st.tub = layer((pc) => {
      for (const [x, y] of [[40, 70], [52, 64], [66, 60], [82, 58], [120, 58], [140, 60], [156, 64], [170, 68], [60, 66], [150, 66]]) { pc.circle(x, y, 7, '#ffffff'); pc.circle(x - 2, y - 2, 3, '#f4fbff'); pc.px(x + 3, y + 3, '#cfe6f4'); }
      ball(pc, 48, 64, 6, 5, ['#d8eef8', '#f2fbff', '#ffffff', '#ffffff']);
      pc.rect(34, 70, 152, 30, '#f6f2ec'); pc.ellipse(110, 70, 78, 6, '#fffcf6'); pc.ellipse(110, 70, 74, 4, '#bfe4f4');
      pc.ellipse(110, 100, 74, 8, '#f6f2ec'); pc.hline(36, 76, 148, '#ffffff'); pc.rect(36, 92, 148, 6, '#e4ddd2');
      for (const x of [46, 170]) { pc.rect(x, 104, 5, 6, '#e0b040'); pc.ellipse(x + 2, 110, 4, 2, '#c08a20'); }
      pc.rect(172, 50, 4, 20, '#b8c8d4'); pc.rect(166, 48, 12, 4, '#d8e4ec');
    });
    bg.blit(st.tub);
    st.lia = canvasOf(layer((pc) => {
      pc.rect(98, 60, 18, 10, SK[1]); pc.rect(98, 60, 6, 10, SK[2]);
      liaHead(pc, 107, 50, 'happy');
      for (const [x, y] of [[96, 66], [118, 66], [104, 68], [112, 69]]) { pc.circle(x, y, 4, '#ffffff'); pc.px(x - 1, y - 2, '#f4fbff'); }
      pc.circle(107, 41, 3.5, '#ffffff'); pc.circle(104, 42, 2.4, '#ffffff');
    }));
    st.tico = canvasOf(ticoPC());
    st.duck = canvasOf(layer((pc) => {
      ball(pc, 70, 68, 7, 4.5, ['#e0a020', '#ffd84a', '#fff4a6', '#ffffff']); ball(pc, 75, 61, 4, 3.8, ['#e0a020', '#ffd84a', '#fff4a6', '#ffffff']);
      pc.ellipse(80, 62, 2.6, 1.2, '#ff8a2a'); pc.px(76, 60, '#120a18'); pc.poly([[63, 66], [61, 61], [66, 64]], '#ffd84a');
    }, '#6a4010'));
  }, (ctx, t, st) => {
    ctx.drawImage(st.lia, 0, breath(t, 2.4));
    ctx.drawImage(st.tico, 160, 50);
    ctx.drawImage(st.duck, R(Math.sin(t * 0.8) * 3), R(Math.sin(t * 2.2) * 1.2));
    for (let i = 0; i < 9; i++) {
      const life = (t * 0.25 + hh(i)) % 1;
      const x = 46 + hh(i + 11) * 128 + Math.sin(t * 2 + i) * 2, y = 62 - life * 52, r = 1 + (i % 3);
      ctx.globalAlpha = 1 - life * 0.8;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      if (r === 1) dot(ctx, x, y, 2, 2, '#ffffff');
      else { ctx.fillStyle = '#ffffff'; ctx.fillRect(R(x - r), R(y), 1, r); ctx.fillRect(R(x + r), R(y), 1, r); ctx.fillRect(R(x), R(y - r), r, 1); ctx.fillRect(R(x), R(y + r), r, 1); dot(ctx, x - 1, y - 1, 1, 1, '#e8f8ff'); }
    }
    ctx.globalAlpha = 1;
  }),
});

// =============================================================== mem_4
registerMemory('mem_4', {
  title: 'O Dia Cinza', world: 2,
  text: [
    'Choveu o dia inteiro no dia em que a vovó partiu.',
    'A Lia vestiu o vestido escuro e não soltou o Tico nem por um segundo.',
    '— Você ainda tem o cheirinho dela — sussurrou.',
  ],
  scene: vignette('mem_4', (bg, st) => {
    room(bg, { wall: ['#6a6c7a', '#80828e', '#9496a2'], paper: 'stripes', floorY: 102, floor: ['#4a4a54', '#5a5a66', '#6a6a76'], base: '#a8a6ae' });
    windowFrame(bg, 30, 12, 70, 62, ['#5a6070', '#7a8090', '#9aa0ae'], { frame: ['#3a3a44', '#5a5a64', '#8a8a94', '#b0b0b8'], curtain: ['#4a4a5a', '#6a6a7a', '#8a8a9a'] });
    for (let x = 30; x < 100; x++) { const hy = 64 + R(Math.sin(x * 0.15) * 3); bg.vline(x, hy, 74 - hy, '#5a6a64'); }
    bg.rect(80, 70, 10, 8, '#c8b8a0'); bg.rect(81, 71, 8, 6, '#a8a0c0'); bg.circle(85, 73, 1.6, '#e6e2f0'); bg.rect(84, 75, 3, 2, '#8e68c4');
    bg.rect(40, 72, 4, 6, '#8a8aa0'); bg.px(41, 70, '#e8e0f0'); bg.px(42, 69, '#ffffff'); bg.px(43, 70, '#e8e0f0');
    bg.rect(116, 88, 72, 14, '#6a5a6a'); bg.rect(116, 84, 72, 6, '#7a6a7a'); bg.rect(116, 70, 6, 32, '#5a4a5a');
    st.lia = canvasOf(layer((pc) => {
      pc.rect(140, 96, 4, 8, SK[0]); pc.rect(150, 96, 4, 8, SK[0]);
      pc.ellipse(142, 104, 3.5, 2, '#1a1a24'); pc.ellipse(152, 104, 3.5, 2, '#1a1a24');
      pc.poly([[138, 74], [156, 74], [162, 96], [132, 96]], '#2a2a3a'); pc.poly([[138, 74], [143, 74], [138, 96], [132, 96]], '#3a3a4e');
      pc.hline(141, 74, 12, '#e8e4ec');
      liaHead(pc, 147, 64, 'sad', { bows: false });
      pc.circle(152, 59, 1.8, '#3a3a4e');
    }));
    st.tico = canvasOf(ticoPC({ closed: true }));
    st.arms = canvasOf(layer((pc) => { pc.thickLine(138, 78, 150, 86, 1.6, '#2a2a3a'); pc.thickLine(157, 78, 152, 88, 1.6, '#2a2a3a'); ball(pc, 151, 86, 2, 2, SK); ball(pc, 150, 88, 2, 2, SK); }));
  }, (ctx, t, st) => {
    rain(ctx, 30, 12, 70, 62, t, 26, '#c8d0e080', 70, 4, 0.15);
    for (let i = 0; i < 5; i++) { const y = 14 + ((t * (4 + i) + hh(i) * 60) % 58); dot(ctx, 33 + hh(i + 30) * 64, y, 1, 2, '#e0e8f4'); }
    const b = breath(t, 1.2);
    ctx.drawImage(st.lia, 0, b);
    ctx.drawImage(st.tico, 138, 76 + b);
    ctx.drawImage(st.arms, 0, b);
    const k = (t * 0.35) % 1;
    if (k < 0.7) dot(ctx, 143, 67 + b + k * 14, 1, 2, '#8ad0ff');
  }, { lint: '#dcdce6', lintA: 0.3 }),
});

// =============================================================== mem_5
registerMemory('mem_5', {
  title: 'A História do Fiapo', world: 3,
  text: [
    '— Quando eu era menina, tinha um boneco de pano chamado Fiapo.',
    '— Uma tempestade o levou pela janela. Procurei por dias...',
    '— Nunca mais o encontrei. Mas também nunca o esqueci.',
  ],
  scene: vignette('mem_5', (bg, st) => {
    room(bg, { wall: ['#a86a50', '#c48462', '#d8a07a'], paper: 'dots', floorY: 100, floor: ['#6a4028', '#84543a', '#9c6a4a'] });
    bg.ellipse(104, 114, 80, 9, '#5a6aa8'); bg.ellipse(104, 114, 72, 7, '#7a8ac8');
    table(bg, 6, 74, 22, 28); lamp(bg, 17, 74);
    st.vo = layer((pc) => {
      ball(pc, 44, 78, 20, 22, ['#6a2a30', '#8a3a3e', '#a8524e', '#c8706a']); ball(pc, 26, 86, 6, 12, ['#6a2a30', '#8a3a3e', '#a8524e']); ball(pc, 66, 86, 6, 12, ['#6a2a30', '#8a3a3e', '#a8524e']);
      ball(pc, 46, 80, 11, 11, CARD); pc.ellipse(52, 92, 14, 5, '#7a5a8a'); pc.rect(58, 94, 4, 8, '#5a4a6a'); pc.ellipse(62, 102, 4, 2, '#3a2a30');
      pc.rect(41, 70, 2, 8, '#ffd84a'); pc.rect(50, 70, 2, 8, '#ffd84a');
      pc.thickLine(52, 80, 62, 76, 1.6, CARD[2]); ball(pc, 63, 75, 2.2, 2, SK);
      voHead(pc, 46, 61, 'sing', { r: 7 });
    });
    bg.blit(st.vo);
    st.lia = layer((pc) => {
      pc.ellipse(112, 99, 13, 5, PJ[1]); pc.ellipse(110, 98, 9, 3, PJ[2]);
      pc.poly([[104, 80], [118, 80], [121, 97], [101, 97]], PJ[1]); pc.poly([[104, 80], [108, 80], [104, 97], [101, 97]], PJ[2]);
      for (const [x, y] of [[108, 86], [114, 91]]) pc.px(x, y, '#fff6b0');
      liaHead(pc, 111, 71, 'listen');
    });
    bg.blit(st.lia);
    const tico = ticoPC(); bg.blit(tico, 112, 82, { flipX: true });
    // nuvem de pensamento
    st.cloud = layer((pc) => {
      for (const [x, y, r] of [[150, 30, 22], [130, 24, 14], [172, 22, 16], [190, 34, 14], [140, 42, 14], [170, 44, 16], [118, 36, 10], [196, 22, 9]]) pc.circle(x, y, r, '#f6eee0');
      pc.circle(86, 54, 2.6, '#f6eee0'); pc.circle(96, 48, 3.6, '#f6eee0'); pc.circle(106, 44, 4.4, '#f6eee0');
    }, '#a88a70');
    bg.blit(st.cloud);
    const cloudC = bg.getU32(150, 30);
    for (let y = 10; y < 56; y++) for (let x = 112; x < 206; x++) if (bg.getU32(x, y) === cloudC && Math.hypot((x - 158) / 38, (y - 33) / 18) < 1) bg.px(x, y, bay(x, y) < (y - 10) / 60 ? '#6a6a8a' : '#8a8aa8');
    st.girl = canvasOf(layer((pc) => {
      pc.poly([[136, 42], [146, 42], [149, 52], [133, 52]], '#e8c040');
      liaHead(pc, 141, 36, 'sad', { hair: ['#1e1410', '#3a2a20', '#54402e', '#6e5644'], bows: false, r: 5 });
      pc.thickLine(146, 44, 152, 40, 1, SK[1]);
    }));
    st.fiapo = canvasOf(fiapoPC());
  }, (ctx, t, st) => {
    glow(ctx, 17, 60, 40, '#ffcf70', 0.35 + flick(t));
    ctx.save(); ctx.beginPath(); ctx.ellipse(158, 33, 38, 18, 0, 0, Math.PI * 2); ctx.clip();
    rain(ctx, 118, 14, 80, 40, t, 22, '#d8e0f0a0', 80, 3, 0.5);
    ctx.drawImage(st.girl, 0, 0);
    const u = (t * 0.22) % 1;
    const fx = 160 + u * 40, fy = 34 - Math.sin(u * Math.PI) * 14 + Math.sin(t * 5) * 1.5;
    ctx.save(); ctx.translate(R(fx), R(fy)); ctx.rotate(t * 3); ctx.drawImage(st.fiapo, -7, -9); ctx.restore();
    ctx.fillStyle = '#ffffffa0';
    for (let i = 0; i < 3; i++) { const w = (t * 30 + i * 30) % 90; ctx.fillRect(R(118 + w), 24 + i * 9, 8, 1); }
    ctx.restore();
  }),
});

// =============================================================== mem_6
registerMemory('mem_6', {
  title: 'O Carretel Dourado', world: 3,
  text: [
    'A vovó abriu a caixinha de costura e tirou o carretel mais antigo.',
    '— Esta linha dourada é especial. Guardei a vida inteira para algo importante.',
    'Ponto por ponto, ela costurou o Tico com ela.',
  ],
  scene: vignette('mem_6', (bg, st) => {
    room(bg, { wall: ['#5a3428', '#704436', '#86564a'], paper: 'stripes', floorY: 70, floor: ['#6a4028', '#8a5a3a', '#a8744c'], base: '#5a3428' });
    bg.rect(0, 70, DW, DH - 70, '#9a6640');
    for (let y = 72; y < DH; y += 7) bg.hline(0, y, DW, '#86563a');
    for (let x = 0; x < DW; x++) if (hh(x * 3.1) < 0.2) bg.vline(x, 72, 2, '#b07a50');
    st.vo = layer((pc) => {
      ball(pc, 124, 70, 30, 18, CARD);
      for (const x0 of [110, 136]) { pc.rect(x0, 54, 4, 18, '#ffd84a'); for (let y = 55; y < 72; y += 2) pc.px(x0, y, '#b88a18'); }
      voHead(pc, 124, 36, 'smile', { r: 12 });
    });
    bg.blit(st.vo);
    st.table = layer((pc) => {
      // carretel antigo
      pc.rect(26, 62, 26, 5, WOOD[2]); pc.rect(26, 96, 26, 5, WOOD[1]); pc.hline(26, 62, 26, WOOD[3]);
      pc.rect(29, 67, 20, 29, '#e8b830'); for (let y = 68; y < 96; y += 2) pc.hline(29, y, 20, y % 4 ? '#ffd23f' : '#c89420');
      pc.vline(31, 67, 29, '#fff0a0');
      // Tico sendo costurado, deitado
      ball(pc, 120, 98, 26, 13, TT); ball(pc, 158, 92, 12, 10, TT); pc.thickLine(98, 98, 82, 90, 3, TC.s); ball(pc, 80, 88, 5, 5, TT);
      for (let i = 0; i < 7; i++) { pc.px(100 + i * 8, 85 - (i % 2), TC.sp); pc.px(101 + i * 8, 85 - (i % 2), '#e0a020'); }
      pc.rect(162, 89, 3, 3, TC.eye); pc.px(162, 89, '#ffffff');
      for (let x = 106; x < 136; x += 3) { pc.px(x, 102, '#ffd23f'); pc.px(x + 1, 101, '#ffd23f'); }
      pc.rect(112, 104, 6, 6, '#ffd23f'); pc.rect(124, 92, 6, 6, '#ff8a3c');
      // almofada de alfinetes e tesoura
      ball(pc, 196, 100, 9, 8, ['#701430', '#a8283f', '#de4858', '#ff7a84']);
      for (const [x, y, c] of [[190, 90, '#5ab0ff'], [196, 88, '#ffffff'], [202, 90, '#7ae07a']]) { pc.line(x, y + 2, x + (x - 196) / 3, y + 6, '#cfd6e6'); pc.circle(x, y, 1.4, c); }
      pc.line(10, 112, 26, 104, '#c8ccd8'); pc.line(10, 114, 26, 110, '#c8ccd8'); pc.ring(8, 112, 2.5, '#e84a40'); pc.ring(8, 116, 2.5, '#e84a40');
      for (const [x, y, c] of [[64, 116, '#e84a40'], [72, 120, '#4a7fe0'], [176, 120, '#ffd23f']]) { pc.circle(x, y, 2.5, c); pc.px(x - 1, y, OUT); pc.px(x + 1, y, OUT); }
      ball(pc, 96, 74, 5, 4, SK); pc.thickLine(90, 66, 96, 72, 2.5, CARD[1]);
    });
    bg.blit(st.table);
    st.hand = canvasOf(layer((pc) => { pc.thickLine(152, 64, 140, 78, 2.6, CARD[2]); ball(pc, 138, 80, 4.5, 3.8, SK); }));
  }, (ctx, t, st) => {
    glow(ctx, 40, 82, 34, '#ffd860', 0.32 + pulse(t, 2) * 0.08);
    glow(ctx, 200, 10, 50, '#ffcf70', 0.22 + flick(t));
    const k = (Math.sin(t * 3) + 1) / 2;
    const nx = 132 + k * 4, ny = 86 - k * 12;
    ctx.drawImage(st.hand, R(k * 4), R(-k * 10));
    ctx.fillStyle = '#e8ecf4'; ctx.fillRect(R(nx), R(ny) - 5, 1, 9);
    const a = [48, 74], b = [90, 36 + k * 6], c = [nx, ny - 4];
    ctx.fillStyle = '#ffd23f';
    for (let u = 0; u <= 1; u += 0.02) { const [x, y] = qpt(a, b, c, u); ctx.fillRect(R(x), R(y), 1, 1); }
    for (let i = 0; i < 4; i++) { const [x, y] = qpt(a, b, c, (t * 0.4 + i / 4) % 1); sparkle(ctx, x, y, pulse(t, 7, i)); }
    if ((t % 3) < 0.25) { sparkle(ctx, 113, 36, 1); sparkle(ctx, 131, 36, 1); }
  }),
});

// =============================================================== mem_7
registerMemory('mem_7', {
  title: 'Medo do Escuro', world: 4,
  text: [
    'Quando a luz apagava, as sombras do quarto pareciam crescer.',
    '— Não tenha medo, Lia. Ele vai te proteger.',
    '— Tem um fio mágico nele. Ele brilha quando você mais precisa.',
  ],
  scene: vignette('mem_7', (bg, st) => {
    room(bg, { wall: ['#1a1c3a', '#24284c', '#30365e'], paper: 'dots', floorY: 104, floor: ['#1a1a30', '#24243e', '#2e2e4c'], base: '#3a3a5a' });
    windowFrame(bg, 168, 14, 36, 40, ['#0e1230', '#1a2250', '#2a3670'], { stars: true, moon: [190, 26], frame: ['#1a1a2a', '#2a2a40', '#4a4a64', '#6a6a84'], curtain: ['#2a2048', '#3a2e62', '#4e4280'] });
    bg.rect(4, 30, 26, 74, '#14142a'); bg.rect(6, 32, 22, 70, '#0a0a18'); bg.vline(28, 32, 70, '#3a3a5a');
    for (let y = 104; y < DH; y++) for (let x = 140; x < 200; x++) if (bay(x, y) < 0.3 * (1 - Math.abs(x - 170) / 30) && (y - 104) < (x - 140) * 0.6) bg.px(x, y, '#5a6aa0');
    table(bg, 34, 84, 18, 20); bg.circle(43, 80, 3.5, '#ffd890'); bg.rect(41, 82, 4, 2, '#c8a060');
    st.bed = layer((pc) => {
      bed(pc, 58, 84, 92, ['#3a4a8a', '#4a5aa0', '#5a3a7a', '#2a6a7a'], { quiltX: 18 });
      ball(pc, 100, 84, 22, 6, ['#3a4a8a', '#4a5aa0', '#6a7ac0']);
    });
    bg.blit(st.bed);
    st.lia = canvasOf(layer((pc) => {
      liaHead(pc, 70, 76, 'scared', { tails: false });
      pc.rect(60, 80, 22, 6, '#4a5aa0'); pc.hline(60, 80, 22, '#7a8ac8');
      for (let x = 61; x < 82; x += 2) pc.px(x, 82, '#6a7ac0');
    }));
    st.vo = layer((pc) => {
      ball(pc, 124, 76, 11, 12, CARD); pc.ellipse(116, 88, 12, 5, '#5a4a7a');
      pc.rect(106, 90, 4, 12, '#4a3a5a'); pc.ellipse(108, 103, 4, 2, '#2a1a20');
      pc.rect(119, 66, 2, 8, '#ffd84a'); pc.rect(128, 66, 2, 8, '#ffd84a');
      voHead(pc, 124, 57, 'smile', { r: 7 });
      pc.thickLine(118, 76, 100, 80, 1.6, CARD[2]); ball(pc, 97, 80, 2.2, 2, SK);
    });
    bg.blit(st.vo);
    st.tico = canvasOf(ticoPC({ glow: true }));
    st.shadow = canvasOf(layer((pc) => {
      for (const [x, y, r] of [[14, 50, 10], [10, 70, 12], [20, 86, 9], [6, 96, 10]]) pc.circle(x, y, r, '#0c0a1c');
      pc.rect(14, 60, 2, 2, '#c84a8a'); pc.rect(19, 61, 2, 2, '#c84a8a');
    }, null));
  }, (ctx, t, st) => {
    glow(ctx, 190, 28, 26, '#a8b8ff', 0.18 + pulse(t, 1.3) * 0.04);
    glow(ctx, 43, 80, 18, '#ffcf70', 0.4 + flick(t));
    ctx.globalAlpha = 0.85; ctx.drawImage(st.shadow, R(Math.sin(t * 1.4) * 2), R(Math.sin(t * 0.9) * 1)); ctx.globalAlpha = 1;
    ctx.drawImage(st.lia, 0, 0);
    if ((t % 3.5) < 0.12) dot(ctx, 66, 76, 7, 2, SK[1]);
    ctx.drawImage(st.tico, 84, 64 + R(Math.sin(t * 1.5)));
    glow(ctx, 95, 74, 14, '#ffe27a', 0.25 + pulse(t, 3) * 0.12);
    for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1; sparkle(ctx, 95 + Math.cos(a) * 12, 72 + Math.sin(a) * 7, pulse(t, 5, i), '#ffe27a'); }
  }, { lint: '#8a90c8', lintA: 0.4 }),
});

// =============================================================== mem_8
registerMemory('mem_8', {
  title: 'A Cama Vazia', world: 4,
  text: [
    'Um trovão. A Lia acordou e tateou a cama: vazia.',
    '— Tico? TICO?! — Procurou debaixo da cama, atrás da cortina...',
    'Só encontrou o escuro. E chorou baixinho, para a tempestade não ouvir.',
  ],
  scene: vignette('mem_8', (bg, st) => {
    room(bg, { wall: ['#16182e', '#1e2240', '#282e54'], paper: 'stripes', floorY: 104, floor: ['#16162a', '#1e1e36', '#282842'], base: '#30304e' });
    windowFrame(bg, 22, 14, 44, 48, ['#0a0c1e', '#141a36', '#202a4e'], { frame: ['#14141e', '#24243a', '#3a3a58', '#5a5a78'], curtain: ['#1e1a3a', '#2a2450', '#3a3468'] });
    st.bed = layer((pc) => {
      bed(pc, 104, 82, 104, ['#3a4a8a', '#4a5aa0', '#5a3a7a', '#2a6a7a'], { quiltX: 34 });
      pc.rect(106, 77, 18, 1, '#d0c8bc');
      pc.ellipse(170, 84, 26, 5, '#4a5aa0'); pc.ellipse(166, 82, 20, 3, '#6a7ac0');
      pc.rect(104, 94, 104, 10, '#0a0a14');
      for (let x = 104; x < 160; x += 3) pc.vline(x, 94, 6 + (x % 2), '#3a4a8a');
    });
    bg.blit(st.bed);
    st.lia = canvasOf(layer((pc) => {
      pc.ellipse(88, 104, 12, 4, PJ[0]); pc.ellipse(80, 104, 5, 3, SK[0]);
      pc.poly([[82, 84], [98, 86], [100, 102], [80, 102]], PJ[1]); pc.poly([[82, 84], [86, 84], [83, 102], [80, 102]], PJ[2]);
      for (const [x, y] of [[88, 92], [94, 97]]) pc.px(x, y, '#fff6b0');
      liaHead(pc, 92, 77, 'cry', { bows: false });
      pc.thickLine(98, 90, 106, 96, 1.5, PJ[1]); ball(pc, 107, 96, 2.2, 2, SK);
    }));
  }, (ctx, t, st) => {
    const L = t % 4.2, flash = L < 0.08 || (L > 0.18 && L < 0.26);
    rain(ctx, 22, 14, 44, 48, t, 30, flash ? '#ffffff' : '#7a88c0a0', 110, 4, 0.25);
    if (flash) {
      dot(ctx, 22, 14, 44, 48, '#d8e0ffa0');
      ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(48, 14); ctx.lineTo(42, 30); ctx.lineTo(47, 32); ctx.lineTo(38, 52); ctx.stroke();
    }
    const sob = (t % 2.4) < 0.5 ? R(Math.sin(t * 40)) : 0;
    ctx.drawImage(st.lia, sob, 0);
    for (let i = 0; i < 2; i++) { const k = (t * 0.8 + i * 0.5) % 1; dot(ctx, 88 + i * 8 + sob, 82 + k * 10, 1, 2, '#8ad0ff'); }
    if (flash) { ctx.globalAlpha = 0.25; dot(ctx, 0, 0, DW, DH, '#c8d4ff'); ctx.globalAlpha = 1; }
  }, { lint: '#6a70a8', lintA: 0.35 }),
});

// =============================================================== mem_9
registerMemory('mem_9', {
  title: 'Desenho na Geladeira', world: 5,
  text: [
    'Na porta da geladeira, preso com ímãs de frutinha, um desenho torto.',
    'A Lia, a vovó e o Tico, de mãos dadas debaixo de um sol enorme.',
    'Embaixo, em letras tortas: "NÓS 3 PARA SEMPRE".',
  ],
  scene: vignette('mem_9', (bg, st) => {
    bg.rect(0, 0, DW, DH, '#cfe4dc');
    for (let x = 0; x < DW; x++) for (let y = 0; y < DH; y++) if (bay(x, y) < 0.18 + x / DW * 0.15) bg.px(x, y, '#bcd6cc');
    bg.rect(0, 0, 10, DH, '#b4ccc4'); bg.rect(8, 40, 4, 50, '#e8f0ec'); bg.vline(8, 40, 50, '#ffffff');
    bg.rect(26, 10, 170, 112, '#c8c0b0');
    bg.rect(24, 8, 170, 112, '#fffcf2');
    for (let y = 16; y < 120; y += 9) bg.hline(26, y, 166, '#e4ecf4');
    const cr = (x0, y0, x1, y1, c) => { bg.line(x0, y0, x1, y1, c); bg.line(x0 + 1, y0, x1 + 1, y1, c); };
    bg.circle(48, 30, 11, '#ffd23f'); bg.circle(46, 28, 7, '#ffe680');
    bg.px(44, 28, '#3a2a10'); bg.px(50, 28, '#3a2a10'); cr(44, 33, 46, 35, '#e07a20'); cr(47, 35, 51, 32, '#e07a20');
    for (let x = 24; x < 194; x++) { const y = 98 + R(Math.sin(x * 0.4) * 1.5); bg.vline(x, y, 6, (x * 7) % 5 ? '#7ac070' : '#5aa050'); }
    // casa
    bg.rect(152, 64, 30, 34, '#e86a5a'); bg.poly([[148, 66], [167, 44], [186, 66]], '#a85a3a'); bg.rect(162, 80, 8, 18, '#7a4a2a'); bg.rect(156, 70, 6, 6, '#8ad0ff');
    // Lia (palitinho de vestido rosa)
    cr(60, 72, 60, 96, '#5c3624'); bg.poly([[54, 70], [66, 70], [70, 88], [50, 88]], '#ff8ac0');
    bg.circle(60, 62, 8, '#ffd9c2'); bg.ellipse(60, 57, 9, 4, '#5c3624'); bg.circle(50, 60, 3, '#5c3624'); bg.circle(70, 60, 3, '#5c3624');
    bg.px(57, 62, '#2a1a10'); bg.px(63, 62, '#2a1a10'); cr(57, 66, 60, 67, '#e84a6a'); bg.line(60, 67, 63, 66, '#e84a6a');
    cr(56, 96, 52, 100, '#5c3624'); cr(64, 96, 68, 100, '#5c3624');
    // Vó (cabelo branco, óculos, vestido roxo)
    bg.poly([[92, 66], [106, 66], [112, 92], [86, 92]], '#8e68c4');
    bg.circle(99, 56, 8, '#ffd9c2'); bg.ellipse(99, 50, 9, 4, '#c4bed6'); bg.circle(99, 44, 3.5, '#c4bed6');
    bg.ring(96, 56, 2.2, '#b8862a'); bg.ring(102, 56, 2.2, '#b8862a'); cr(96, 61, 99, 62, '#e84a6a'); bg.line(99, 62, 102, 61, '#e84a6a');
    cr(94, 92, 92, 100, '#4a3a2a'); cr(104, 92, 106, 100, '#4a3a2a');
    // Tico (bolota azul de dinossauro)
    bg.ellipse(134, 86, 10, 7, '#3fc7c0'); bg.line(140, 82, 144, 70, '#3fc7c0'); bg.line(141, 82, 145, 70, '#3fc7c0'); bg.ellipse(146, 68, 5, 4, '#3fc7c0');
    for (const [x, y] of [[128, 79], [133, 78], [138, 79], [146, 63]]) bg.px(x, y, '#ffd23f');
    bg.px(147, 67, '#120a18'); cr(124, 84, 120, 78, '#3fc7c0'); cr(130, 92, 130, 98, '#2a9d97'); cr(138, 92, 138, 98, '#2a9d97');
    // mãos dadas
    cr(66, 76, 88, 74, '#ffb090'); cr(110, 74, 128, 82, '#ffb090');
    // corações
    for (const [x, y] of [[80, 40], [118, 34], [140, 50]]) { bg.circle(x - 2, y, 2.5, '#ff5a7a'); bg.circle(x + 2, y, 2.5, '#ff5a7a'); bg.poly([[x - 4, y + 1], [x + 4, y + 1], [x, y + 6]], '#ff5a7a'); }
    // ímãs de frutinha
    for (const [x, y, c, l] of [[30, 12, '#e84a40', '#4ab858'], [186, 12, '#ffd23f', '#4ab858'], [30, 112, '#9a5ad8', '#4ab858'], [184, 112, '#ff8a3c', '#4ab858']]) {
      ball(bg, x, y, 5, 5, ['#5a2a20', c, '#ffffff80']); bg.px(x, y - 6, l); bg.px(x + 1, y - 6, l); bg.px(x - 2, y - 2, '#ffffffb0');
    }
  }, (ctx, t, st) => {
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 8; i++) {
      const a = t * 0.5 + (i / 8) * Math.PI * 2;
      for (let r = 13; r < 18; r++) ctx.fillRect(R(48 + Math.cos(a) * r), R(30 + Math.sin(a) * r), 2, 1);
    }
    const p = R(pulse(t, 4) * 0.8 + 0.5);
    for (const [x, y] of [[80, 40], [118, 34], [140, 50]]) if (p) dot(ctx, x - 3, y - 2, 1, 1, '#ffd0dc');
    font.draw(ctx, 'NÓS 3 PARA SEMPRE', 109, 106 + R(Math.sin(t * 2) * 0.6), { color: '#4a7fe0', align: 'center' });
    font.draw(ctx, 'LIA', 186, 90, { color: '#e85a9a', align: 'right' });
    const c = (Math.sin(t * 1.7) + 1) / 2 > 0.85;
    if (c) { ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(194, 120); ctx.lineTo(186, 120); ctx.lineTo(194, 112); ctx.fill(); }
    sparkle(ctx, 40 + ((t * 20) % 140), 20 + Math.sin(t) * 4, pulse(t, 8));
  }),
});

// =============================================================== mem_10
registerMemory('mem_10', {
  title: 'Canção de Ninar', world: 5,
  text: [
    'Toda noite, a vovó cantava baixinho a mesma canção de ninar.',
    '"Dorme, dorme, meu amor, que a linha do sonho já vem te buscar..."',
    'A Lia dormia primeiro. O Tico, dizem, ficava acordado até o fim.',
  ],
  scene: vignette('mem_10', (bg, st) => {
    room(bg, { wall: ['#3a3058', '#4a3e6e', '#5e5084'], paper: 'dots', floorY: 104, floor: ['#3a2a3a', '#4a3848', '#5a4658'], base: '#6a5a7a' });
    windowFrame(bg, 92, 12, 40, 38, ['#141a40', '#1e2856', '#2e3a70'], { stars: true, moon: [116, 24], curtain: ['#5a3a6a', '#7a5288', '#9a70a8'] });
    table(bg, 182, 82, 26, 22); lamp(bg, 195, 82, ['#c87a50', '#e8a070', '#ffc890', '#fff0d0']);
    st.bed = layer((pc) => bed(pc, 70, 84, 104, QUILT, { quiltX: 30 }));
    bg.blit(st.bed);
    st.kids = canvasOf(layer((pc) => {
      liaHead(pc, 84, 76, 'sleep', { tails: false });
      pc.blit(ticoPC({ closed: true }), 88, 70);
      ball(pc, 130, 86, 40, 6, ['#c8a040', '#ffd23f', '#ffe680']);
      for (let i = 0; i < 5; i++) pc.rect(96 + i * 14, 82, 14, 6, QUILT[i]);
      pc.hline(96, 82, 70, '#ffffff60');
    }));
    st.vo = layer((pc) => {
      pc.rect(36, 70, 4, 34, WOOD[1]); pc.rect(28, 86, 26, 4, WOOD[2]); pc.rect(30, 90, 3, 14, WOOD[0]); pc.rect(50, 90, 3, 14, WOOD[0]);
      ball(pc, 44, 76, 11, 12, CARD); pc.ellipse(52, 88, 12, 4, '#7a5a8a');
      pc.rect(58, 90, 4, 12, '#5a4a6a'); pc.ellipse(60, 103, 4, 2, '#3a2a30');
      pc.rect(39, 66, 2, 8, '#ffd84a'); pc.rect(48, 66, 2, 8, '#ffd84a');
      pc.thickLine(50, 78, 68, 84, 1.6, CARD[2]); ball(pc, 70, 85, 2.2, 2, SK);
      voHead(pc, 44, 57, 'sing', { r: 7 });
    });
    bg.blit(st.vo);
  }, (ctx, t, st) => {
    glow(ctx, 195, 68, 44, '#ffc070', 0.35 + flick(t));
    glow(ctx, 116, 24, 18, '#c8d0ff', 0.15);
    for (let i = 0; i < 6; i++) { if (pulse(t, 2 + i, i) > 0.7) sparkle(ctx, 95 + hh(i + 5) * 34, 14 + hh(i + 40) * 20, 1); }
    ctx.drawImage(st.kids, 0, breath(t, 1.1));
    for (let i = 0; i < 4; i++) {
      const life = (t * 0.18 + i / 4) % 1;
      const x = 54 + life * 70 + Math.sin(t * 2 + i * 1.7) * 4, y = 56 - life * 40;
      ctx.globalAlpha = Math.min(1, (1 - life) * 2);
      note(ctx, R(x), R(y), i % 2);
    }
    ctx.globalAlpha = 1;
    const z = (t * 0.5) % 1;
    ctx.globalAlpha = 1 - z;
    font.draw(ctx, 'z', R(76 + z * 6), R(64 - z * 12), { color: '#d8e0ff' });
    ctx.globalAlpha = 1;
  }, { lint: '#c8b8e8', lintA: 0.35 }),
});
