// =============================================================================
// art/map_props.js — Biblioteca de "carimbos" de decoração do mapa-múndi.
//
// Cada carimbo é um PixelCanvas pequeno (cacheado) com pivô nos PÉS:
//   prop(name, variant) → { pc, ax, ay, r }   (ax,ay = pivô; r = raio do "pé")
// Usado por scenes/overworld_art.js para estampar árvores, morros com olhos,
// montanhas, palmeiras, prédios, castelos etc. dentro da imagem pré-renderizada
// de cada região. Arte original, inspirada nos mapas de 16 bits: contorno escuro
// de 1 px, luz de cima-esquerda, 3–4 tons por material.
// =============================================================================
import { PixelCanvas } from '../../engine/pixel.js';
import { makeRng, mixColor, darken, lighten } from '../../engine/util.js';

export const INK = '#1b1030';
const cache = new Map();

function make(key, w, h, ax, ay, r, fn, outline = INK) {
  let s = cache.get(key);
  if (s) return s;
  const pc = new PixelCanvas(w, h);
  fn(pc);
  if (outline) pc.outline(outline);
  s = { pc, ax, ay, r, w, h };
  cache.set(key, s);
  return s;
}

/** Copa redonda sombreada (base para várias árvores). */
function crown(pc, cx, cy, r, dark, mid, lite, hi) {
  pc.circle(cx, cy + 1, r, dark);
  pc.circle(cx - 0.5, cy, r - 1, mid);
  pc.circle(cx - r * 0.35, cy - r * 0.35, r * 0.5, lite);
  if (hi) { pc.px(Math.round(cx - r * 0.5), Math.round(cy - r * 0.55), hi); pc.px(Math.round(cx - r * 0.5) + 1, Math.round(cy - r * 0.55), hi); }
}

const TREE_PALS = {
  green: ['#1f6a2e', '#2f8f3a', '#56c04e', '#b8f08a'],
  deep: ['#16502a', '#22743a', '#3c9a48', '#8ad878'],
  mint: ['#1f7a5a', '#2fa07a', '#6fdcb0', '#d0fff0'],
  autumn: ['#8a3a10', '#c0601a', '#f09a3a', '#ffe0a0'],
  gold: ['#8a5a10', '#c08a20', '#f0c040', '#fff0b0'],
  rose: ['#7a1a3a', '#b02a5a', '#f05a8a', '#ffd0e0'],
  dusk: ['#3a2a5a', '#4a3a78', '#6a58a8', '#a898d8'],
};

export function prop(name, v = 0) {
  switch (name) {
    // ------------------------------------------------------------ árvores
    case 'tree': { // árvore redonda clássica; v = paleta
      const pal = TREE_PALS[v] || TREE_PALS.green;
      return make('tree' + v, 15, 19, 7, 17, 6, (pc) => {
        pc.rect(6, 11, 3, 7, '#7a4a24'); pc.vline(6, 11, 7, '#a8703a');
        crown(pc, 7.5, 7, 6.5, pal[0], pal[1], pal[2], pal[3]);
      });
    }
    case 'tree_big': {
      const pal = TREE_PALS[v] || TREE_PALS.green;
      return make('treeB' + v, 21, 26, 10, 24, 8, (pc) => {
        pc.rect(8, 15, 5, 10, '#6a3e1e'); pc.vline(8, 15, 10, '#a8703a'); pc.px(12, 24, '#4a2a10'); pc.px(7, 24, '#6a3e1e');
        crown(pc, 10.5, 9.5, 9, pal[0], pal[1], pal[2], pal[3]);
        pc.circle(6, 12, 3, pal[1]); pc.circle(15, 12, 3, pal[0]);
      });
    }
    case 'pine': {
      const pal = TREE_PALS[v] || TREE_PALS.deep;
      return make('pine' + v, 13, 21, 6, 19, 5, (pc) => {
        pc.rect(5, 16, 3, 4, '#6a3e1e');
        for (let k = 0; k < 3; k++) {
          const y = 2 + k * 5, hw = 3 + k * 1.6;
          pc.tri(6.5 - hw, y + 7, 6.5 + hw, y + 7, 6.5, y, pal[1]);
          pc.tri(6.5 - hw, y + 7, 6.5, y + 7, 6.5, y, pal[2]);
          pc.hline(Math.round(6.5 - hw + 1), y + 6, Math.round(hw * 2 - 1), pal[0]);
        }
        pc.px(6, 2, pal[3]);
      });
    }
    case 'lolly': { // árvore-pirulito (brinquedo)
      const cols = [['#ff6a9a', '#ffd0e0'], ['#5fd0ff', '#d8f6ff'], ['#ffd23f', '#fff6c0'], ['#9a6aff', '#e0d0ff']][v % 4];
      return make('lolly' + v, 13, 20, 6, 18, 5, (pc) => {
        for (let y = 10; y < 19; y++) pc.px(6, y, y % 3 ? '#fff4ec' : '#e8384a');
        pc.vline(7, 10, 9, '#c8b8b0');
        pc.circle(6.5, 6, 5.5, darken(cols[0], 0.25)); pc.circle(6, 5.5, 4.8, cols[0]);
        for (let i = 0; i < 14; i++) { const a = i * 0.7, rr = 0.6 + i * 0.28; pc.px(Math.round(6 + Math.cos(a) * rr), Math.round(5.5 + Math.sin(a) * rr), cols[1]); }
      });
    }
    case 'bush': {
      const pal = TREE_PALS[v] || TREE_PALS.green;
      return make('bush' + v, 14, 9, 7, 7, 5, (pc) => {
        pc.ellipse(4.5, 5, 4, 3.5, pal[0]); pc.ellipse(9.5, 5, 4, 3.5, pal[0]); pc.ellipse(7, 3.5, 4, 3.5, pal[1]);
        pc.ellipse(4, 4, 3, 2.5, pal[1]); pc.ellipse(6, 2.5, 2, 1.5, pal[2]); pc.px(3, 3, pal[2]); pc.px(5, 1, pal[3]);
      });
    }
    case 'dead_tree': {
      return make('dead' + v, 17, 22, 8, 20, 4, (pc) => {
        const c = '#5a4a7a', l = '#8a7aaa';
        pc.rect(7, 9, 3, 12, c); pc.vline(7, 9, 12, l);
        pc.line(8, 10, 2, 4, c); pc.line(2, 4, 1, 1, c); pc.line(8, 8, 14, 3, c); pc.line(14, 3, 16, 4, c);
        pc.line(8, 12, 13, 9, c); pc.line(4, 6, 6, 2, c); pc.line(12, 4, 11, 0, c);
        if (v % 2) { pc.px(5, 13, '#ffe14a'); pc.px(10, 13, '#ffe14a'); } // olhos no tronco
      });
    }
    case 'palm': {
      return make('palm' + v, 19, 23, 8, 21, 4, (pc) => {
        const flip = v % 2 ? -1 : 1;
        for (let i = 0; i < 13; i++) { const x = 8 + Math.round(Math.sin(i * 0.17) * 2.2) * flip, y = 20 - i; pc.px(x, y, i % 3 ? '#c08a4a' : '#8a5a2a'); pc.px(x + 1, y, '#8a5a2a'); }
        const tx = 8 + Math.round(Math.sin(12 * 0.17) * 2.2) * flip, ty = 7;
        const fr = (dx, dy, c) => pc.curve(tx, ty, tx + dx * 0.6, ty + dy * 0.2 - 3, tx + dx, ty + dy, c, 0.9);
        fr(-8, 3, '#2f8f3a'); fr(8, 3, '#2f8f3a'); fr(-6, -4, '#56c04e'); fr(6, -4, '#56c04e'); fr(0, -6, '#56c04e'); fr(-9, 7, '#1f6a2e'); fr(9, 7, '#1f6a2e');
        pc.circle(tx, ty + 2, 1.3, '#6a3a1a'); pc.px(tx + 2, ty + 2, '#8a5a2a');
      });
    }
    // ------------------------------------------------------------ relevo
    case 'hill': { // morrinho com olhos; v = 0..2 tamanho, + paleta via v>=10
      const size = [9, 12, 16][v % 3];
      const pal = v >= 20 ? TREE_PALS.dusk : v >= 10 ? ['#7a3a10', '#c07a3a', '#f0b070', '#ffe0b0'] : ['#2a7a32', '#46a646', '#7fd06a', '#c8f8a8'];
      const w = size * 2 + 2, h = Math.round(size * 1.35) + 2;
      return make('hill' + v, w, h, size + 1, h - 1, size - 2, (pc) => {
        const cx = size + 0.5, by = h - 1;
        pc.ellipse(cx, by, size, h - 1.5, pal[0]);
        pc.ellipse(cx - 1, by, size - 1.5, h - 2.5, pal[1]);
        pc.ellipse(cx - size * 0.35, by - h * 0.55, size * 0.4, h * 0.25, pal[2]);
        pc.px(Math.round(cx - size * 0.5), Math.round(by - h * 0.7), pal[3]);
        for (let x = 0; x < w; x++) pc.erase(x, h - 1);
        // olhos
        const ey = Math.round(by - h * 0.55), ex = Math.round(cx + size * 0.12), gap = Math.max(3, Math.round(size * 0.32));
        for (const x of [ex - gap, ex + gap - 1]) { pc.rect(x, ey, 2, size > 10 ? 4 : 3, INK); pc.px(x, ey, '#ffffff'); }
      });
    }
    case 'mountain': {
      const pals = [['#6a3a1a', '#a8683a', '#d89a5a', '#f8d8a8'], ['#3a4a6a', '#5a6a8a', '#8a9ab8', '#e8f0ff'], ['#4a2a5a', '#6a4a7a', '#9a7aaa', '#d8c8e8']];
      const pal = pals[v % 3], big = v >= 3;
      const w = big ? 46 : 34, h = big ? 40 : 30;
      return make('mtn' + v, w, h, w >> 1, h - 1, w * 0.35, (pc) => {
        const cx = w / 2, top = 2;
        const pts = [[1, h - 1], [cx - w * 0.22, top + 6], [cx - 3, top], [cx + 3, top], [cx + w * 0.24, top + 7], [w - 1, h - 1]];
        pc.poly(pts, pal[1]);
        pc.poly([[cx, top + 1], [cx + 3, top], [cx + w * 0.24, top + 7], [w - 1, h - 1], [cx + 2, h - 1]], pal[0]);
        pc.poly([[4, h - 1], [cx - w * 0.2, top + 8], [cx - 2, top + 2], [cx - 6, h - 1]], pal[2]);
        // estrias
        for (let i = 0; i < 4; i++) { const x = cx - 8 + i * 6; pc.line(x, top + 10 + (i % 2) * 3, x + 2, h - 4, darken(pal[1], 0.2)); }
        // neve no pico
        pc.poly([[cx - 6, top + 6], [cx - 3, top], [cx + 3, top], [cx + 6, top + 6], [cx + 3, top + 4], [cx, top + 7], [cx - 3, top + 4]], pal[3]);
        pc.px(Math.round(cx - 2), top + 1, '#ffffff');
        for (let x = 0; x < w; x++) pc.erase(x, h - 1);
      });
    }
    case 'rock': {
      const c = [['#5a5a6a', '#8a8a9a', '#c0c0cc'], ['#6a5a4a', '#9a8a6a', '#d0c0a0'], ['#3a2e4a', '#5a4a6a', '#8a7a9a']][v % 3];
      return make('rock' + v, 9, 7, 4, 6, 3, (pc) => {
        pc.ellipse(4.5, 4, 4, 3, c[0]); pc.ellipse(4, 3.5, 3.2, 2.5, c[1]); pc.px(3, 2, c[2]); pc.px(4, 2, c[2]);
      });
    }
    case 'sea_rock': {
      return make('srock' + v, 13, 10, 6, 8, 5, (pc) => {
        pc.ellipse(6.5, 6, 5.5, 3.8, '#4a5a6a'); pc.ellipse(6, 5, 4.5, 3.2, '#7a8a9a'); pc.ellipse(5, 4, 2, 1.4, '#b8c8d8');
        if (v % 2) { pc.circle(9, 4, 2, '#5a6a7a'); pc.px(8, 3, '#a8b8c8'); }
      });
    }
    case 'block': { // bloco de brinquedo com letra
      const faces = [['#e8384a', '#ff8a9a'], ['#3a7ae0', '#8ac0ff'], ['#ffc020', '#fff08a'], ['#3ab04a', '#9af08a']][v % 4];
      const dim = v >= 4;
      const C = dim ? (c) => mixColor(c, '#2a1e44', 0.55) : (c) => c;
      return make('block' + v, 10, 11, 5, 10, 4, (pc) => {
        pc.rect(1, 3, 8, 7, C(faces[0])); pc.rect(1, 1, 8, 2, C(faces[1])); pc.rect(7, 3, 2, 7, C(darken(faces[0], 0.25)));
        pc.rect(3, 5, 3, 3, C('#fff4dc')); pc.px(4, 6, C(faces[0]));
      });
    }
    case 'mushroom': {
      const cap = [['#e8384a', '#ff8a8a'], ['#9a5aff', '#d0b0ff'], ['#ff5ad8', '#ffc0f0']][v % 3];
      return make('mush' + v, 9, 9, 4, 8, 3, (pc) => {
        pc.rect(3, 5, 3, 3, '#f4e8d0'); pc.px(5, 5, '#c8b8a0');
        pc.ellipse(4.5, 4, 4, 3, darken(cap[0], 0.2)); pc.ellipse(4, 3.5, 3.5, 2.5, cap[0]);
        pc.px(2, 3, '#ffffff'); pc.px(5, 2, '#ffffff'); pc.px(6, 4, cap[1]);
      });
    }
    // ------------------------------------------------------------ praia / mar
    case 'hut': {
      return make('hut' + v, 17, 17, 8, 16, 7, (pc) => {
        pc.rect(3, 8, 11, 8, '#c08a4a'); pc.rect(3, 8, 2, 8, '#e0b070'); pc.rect(7, 11, 3, 5, '#4a2a10');
        pc.tri(0, 9, 17, 9, 8.5, 1, '#e8c860'); pc.tri(8.5, 9, 17, 9, 8.5, 1, '#c8a040');
        for (let x = 2; x < 16; x += 3) pc.px(x, 8, '#a88030');
      });
    }
    case 'sandcastle': {
      return make('sandc' + v, 11, 10, 5, 9, 4, (pc) => {
        pc.rect(1, 5, 9, 4, '#e8c878'); pc.rect(1, 2, 3, 3, '#e8c878'); pc.rect(7, 2, 3, 3, '#e8c878'); pc.rect(4, 3, 3, 2, '#d8b060');
        pc.px(2, 1, '#e8c878'); pc.px(8, 1, '#e8c878'); pc.px(5, 0, '#ff5a6a'); pc.px(5, 1, '#8a6a3a');
      });
    }
    case 'coral': {
      const c = [['#ff7a9a', '#ffb0c8'], ['#ffa040', '#ffd090'], ['#c05aff', '#e8b0ff']][v % 3];
      return make('coral' + v, 9, 8, 4, 7, 3, (pc) => {
        pc.vline(4, 1, 6, c[0]); pc.vline(2, 3, 4, c[0]); pc.vline(6, 2, 5, c[0]); pc.px(1, 3, c[1]); pc.px(7, 2, c[1]); pc.px(4, 0, c[1]);
      });
    }
    case 'wreck': {
      return make('wreck', 32, 20, 16, 17, 12, (pc) => {
        pc.poly([[2, 12], [28, 10], [25, 18], [6, 18]], '#6a4424');
        pc.poly([[2, 12], [28, 10], [27, 12], [3, 14]], '#9a6a3a');
        for (let x = 6; x < 26; x += 4) pc.vline(x, 13, 4, '#4a2a14');
        pc.line(14, 11, 18, 0, '#5a3a1a'); pc.line(15, 11, 19, 0, '#8a5a2a');
        pc.poly([[18, 2], [26, 5], [19, 8]], '#e8e0d0'); pc.px(20, 4, '#c8c0b0');
        pc.rect(20, 14, 3, 2, '#1a0c06');
      });
    }
    // ------------------------------------------------------------ cidade
    case 'house': { // casinha da cidade dos relógios; v = 0..7 variações
      const rng = makeRng(v * 37 + 11);
      const w = 12 + (v % 3) * 3, hh = 9 + (v % 4) * 2;
      const roofs = [['#a8402a', '#d86a4a'], ['#2a6a7a', '#4a9aa8'], ['#6a3a7a', '#9a5aa8'], ['#3a5a2a', '#5a8a3a']];
      const walls = [['#e8d0a0', '#c8a878'], ['#f0e0c8', '#c8b090'], ['#d8a878', '#b08050']];
      const roof = roofs[v % 4], wall = walls[(v >> 1) % 3];
      const H = hh + 8;
      return make('house' + v, w + 2, H + 2, (w + 2) >> 1, H, w * 0.45, (pc) => {
        pc.rect(1, 8, w, hh, wall[0]); pc.rect(w - 2, 8, 3, hh, wall[1]);
        pc.poly([[0, 9], [w + 2, 9], [w - 1, 1], [3, 1]], roof[0]); pc.poly([[0, 9], [w * 0.5, 9], [w * 0.4, 1], [3, 1]], roof[1]);
        for (let x = 2; x < w; x += 3) pc.px(x, 5, darken(roof[0], 0.25));
        for (let y = 11; y < 8 + hh - 4; y += 4) for (let x = 3; x < w - 1; x += 4) { pc.rect(x, y, 2, 2, rng() < 0.6 ? '#ffe08a' : '#3a2a4a'); }
        pc.rect((w >> 1), 8 + hh - 4, 3, 4, '#5a3a1a');
        if (v % 3 === 0) { pc.rect(w - 4, 0, 2, 3, '#8a5a4a'); }
      });
    }
    case 'tower': { // torre com relógio (ponteiros animados em tempo real)
      return make('tower' + v, 16, 36, 8, 35, 6, (pc) => {
        const wall = v % 2 ? '#c8a070' : '#b0b0c0', lt = v % 2 ? '#e8c890' : '#d8d8e8', dk = v % 2 ? '#8a6a40' : '#7a7a90';
        pc.rect(3, 10, 10, 25, wall); pc.vline(3, 10, 25, lt); pc.rect(11, 10, 2, 25, dk);
        pc.tri(1, 11, 15, 11, 8, 0, v % 2 ? '#8a3a2a' : '#3a5a8a'); pc.tri(8, 11, 15, 11, 8, 0, darken(v % 2 ? '#8a3a2a' : '#3a5a8a', 0.25));
        pc.circle(8, 16, 4, '#fff4dc'); pc.ring(8, 16, 4, '#7a4020');
        for (let y = 23; y < 33; y += 4) pc.rect(6, y, 3, 2, '#ffe08a');
        pc.rect(6, 31, 4, 4, '#4a2a10');
      });
    }
    case 'gear': {
      return make('gear' + v, 15, 15, 7, 14, 6, (pc) => {
        const a0 = (v % 2) * Math.PI / 8;
        for (let i = 0; i < 8; i++) { const a = a0 + i * Math.PI / 4; pc.circle(7 + Math.cos(a) * 5.5, 7 + Math.sin(a) * 5.5, 1.5, '#a87830'); }
        pc.circle(7, 7, 5, '#c89a40'); pc.circle(6.5, 6.5, 3.5, '#e8c060'); pc.circle(7, 7, 1.6, '#5a3a10');
      });
    }
    case 'lamp': {
      return make('lamp' + v, 5, 13, 2, 12, 1, (pc) => {
        pc.vline(2, 3, 9, '#3a3040'); pc.rect(1, 11, 3, 1, '#3a3040'); pc.rect(1, 0, 3, 3, '#ffe08a'); pc.px(2, 1, '#ffffff');
      });
    }
    case 'fountain': {
      return make('fount', 19, 13, 9, 12, 8, (pc) => {
        pc.ellipse(9.5, 8, 9, 4, '#8a8a9a'); pc.ellipse(9.5, 7.5, 7.5, 3, '#4fb0e0'); pc.ellipse(8, 7, 3, 1, '#a8e0ff');
        pc.rect(8, 2, 3, 5, '#a8a8b8'); pc.px(9, 0, '#d8f6ff'); pc.px(8, 1, '#d8f6ff'); pc.px(10, 1, '#d8f6ff');
      });
    }
    // ------------------------------------------------------------ pesadelo
    case 'bedpost': {
      return make('bedpost' + v, 16, 46, 8, 45, 6, (pc) => {
        pc.rect(4, 6, 8, 39, '#4a2e2a'); pc.vline(5, 6, 39, '#6a4a3a'); pc.rect(10, 6, 2, 39, '#2e1a1a');
        pc.ellipse(8, 5, 6, 4, '#5a3a32'); pc.ellipse(7, 4, 3, 2, '#7a5a4a');
        pc.rect(2, 18, 12, 3, '#3a2222'); pc.rect(2, 30, 12, 2, '#3a2222');
      });
    }
    case 'sock': {
      return make('sock' + v, 13, 15, 6, 14, 5, (pc) => {
        const c = v % 2 ? '#5a4a8a' : '#6a3a5a';
        pc.rect(2, 0, 6, 9, c); pc.ellipse(6, 10, 5.5, 3.5, c); pc.rect(2, 0, 6, 2, '#a898c8');
        for (let y = 3; y < 9; y += 3) pc.hline(2, y, 6, darken(c, 0.3));
        pc.px(9, 11, '#2a1e3a'); pc.px(10, 10, '#2a1e3a');
      });
    }
    case 'teddy': {
      return make('teddy', 17, 18, 8, 17, 6, (pc) => {
        const c = '#5a4a6a', d = '#3a2e4a';
        pc.circle(4, 3, 2.5, c); pc.circle(13, 3, 2.5, c);
        pc.circle(8.5, 6, 5, c); pc.ellipse(8.5, 13, 6, 5, d); pc.ellipse(8.5, 12, 5, 4, c);
        pc.px(6, 5, '#ffe14a'); pc.px(11, 5, '#ffe14a'); pc.hline(7, 8, 3, '#1a1028'); pc.px(8, 13, '#8a7aa0'); pc.px(9, 13, '#8a7aa0');
      });
    }
    case 'night_lamp': {
      return make('nlamp', 11, 17, 5, 16, 4, (pc) => {
        pc.rect(4, 8, 3, 7, '#6a5a7a'); pc.rect(2, 14, 7, 2, '#4a3a5a');
        pc.poly([[1, 8], [10, 8], [8, 1], [3, 1]], '#ffe08a'); pc.poly([[6, 8], [10, 8], [8, 1], [6, 1]], '#e8b040');
      });
    }
    // ------------------------------------------------------------ coração
    case 'crystal': {
      const c = [['#ff4f8a', '#ffb0d0', '#a01e50'], ['#c05aff', '#e8c0ff', '#6a1e9a'], ['#ffd23f', '#fff6b0', '#a8701a']][v % 3];
      return make('crys' + v, 11, 17, 5, 16, 4, (pc) => {
        pc.poly([[3, 16], [1, 6], [3, 1], [5, 6], [6, 16]], c[2]); pc.poly([[3, 16], [2, 6], [3, 2], [4, 7]], c[0]);
        pc.poly([[6, 16], [6, 8], [8, 4], [10, 9], [9, 16]], c[0]); pc.poly([[7, 16], [7, 9], [8, 5], [8, 16]], c[1]);
        pc.px(3, 3, '#ffffff');
      });
    }
    case 'spool': {
      const col = ['#ffd23f', '#ff6a9a', '#7fd0ff'][v % 3];
      return make('spool' + v, 11, 13, 5, 12, 4, (pc) => {
        pc.rect(1, 0, 9, 2, '#c08a4a'); pc.rect(1, 10, 9, 2, '#8a5a2a');
        pc.rect(2, 2, 7, 8, col); for (let y = 3; y < 10; y += 2) pc.hline(2, y, 7, darken(col, 0.25)); pc.vline(3, 2, 8, lighten(col, 0.4));
      });
    }
    case 'heart_plant': {
      return make('hplant' + v, 9, 11, 4, 10, 3, (pc) => {
        pc.vline(4, 5, 5, '#3a8a3a'); pc.px(5, 7, '#56c04e'); pc.px(6, 6, '#56c04e');
        const c = v % 2 ? '#ff4f8a' : '#ffd23f';
        pc.circle(2.5, 2.5, 2, c); pc.circle(5.5, 2.5, 2, c); pc.tri(0.5, 3, 7.5, 3, 4, 7, c); pc.px(2, 2, '#ffffff');
      });
    }
    case 'needle': {
      return make('needle' + v, 7, 26, 3, 25, 2, (pc) => {
        pc.rect(2, 4, 3, 20, '#c0c8d8'); pc.vline(2, 4, 20, '#ffffff'); pc.rect(4, 4, 1, 20, '#8a94a8');
        pc.rect(3, 6, 1, 4, '#3a0a1a'); pc.tri(2, 24, 5, 24, 3.5, 26, '#8a94a8');
        pc.curve(3, 7, -6, 0, 1, -2, '#ffd23f');
      });
    }
    case 'big_heart': { // marco do Mundo 5 (v = 0/1 → quadro do pulsar)
      const s = v ? 1.12 : 1;
      return make('bheart' + v, 40, 36, 20, 34, 14, (pc) => {
        const cx = 20, cy = 15;
        pc.circle(cx - 7 * s, cy - 3 * s, 8.5 * s, '#a01e40'); pc.circle(cx + 7 * s, cy - 3 * s, 8.5 * s, '#a01e40');
        pc.tri(cx - 15.5 * s, cy, cx + 15.5 * s, cy, cx, cy + 17 * s, '#a01e40');
        pc.circle(cx - 7 * s, cy - 4 * s, 7 * s, '#d83a5a'); pc.circle(cx + 6 * s, cy - 4 * s, 7 * s, '#c82a4a');
        pc.tri(cx - 13 * s, cy - 1, cx + 12 * s, cy - 1, cx, cy + 14 * s, '#c82a4a');
        pc.circle(cx - 9 * s, cy - 7 * s, 3 * s, '#ff8aa0'); pc.px(cx - 10, cy - 9, '#ffffff');
        for (let i = 0; i < 9; i++) pc.px(cx - 1 + (i % 2), cy - 8 + i * 2, '#ffd23f'); // costura
      });
    }
    default: return null;
  }
}

// =============================================================== castelos
/** Castelo do chefe de cada mundo (44x52). Pivô (22,50) = porta (o ponto da fase fica ali). */
export function castleProp(world, locked) {
  return make('castle' + world + (locked ? 'L' : ''), 44, 54, 22, 51, 16, (pc) => {
    const C = locked ? (c) => mixColor(c, '#3a3448', 0.6) : (c) => c;
    if (world === 1) { // forte de brinquedo com torres de bloco e telhados verdes
      pc.rect(6, 22, 32, 28, C('#d8a860')); pc.rect(6, 22, 4, 28, C('#f0c880')); pc.rect(34, 22, 4, 28, C('#a87838'));
      for (let x = 6; x < 38; x += 6) pc.rect(x, 18, 4, 4, C('#d8a860'));
      for (const tx of [2, 30]) {
        pc.rect(tx, 12, 12, 38, C('#e8384a')); pc.rect(tx, 12, 3, 38, C('#ff7a8a')); pc.rect(tx + 10, 12, 2, 38, C('#a82030'));
        pc.tri(tx - 2, 13, tx + 14, 13, tx + 6, 0, C('#3ab04a')); pc.tri(tx + 6, 13, tx + 14, 13, tx + 6, 0, C('#227a32'));
        pc.rect(tx + 4, 20, 4, 5, C('#2a1a3a'));
      }
      pc.rect(16, 34, 12, 16, C('#2a1408')); pc.ellipse(22, 34, 6, 4, C('#2a1408'));
      pc.rect(17, 26, 3, 3, C('#ffe08a')); pc.rect(24, 26, 3, 3, C('#ffe08a'));
    } else if (world === 2) { // farol de vidro sobre rochedo
      pc.ellipse(22, 46, 20, 7, C('#4a5a6a')); pc.ellipse(20, 44, 16, 5, C('#7a8a9a'));
      pc.poly([[14, 46], [30, 46], [27, 12], [17, 12]], C('#e8f4ff'));
      pc.poly([[24, 46], [30, 46], [27, 12], [24, 12]], C('#b8d0e8'));
      for (let y = 18; y < 44; y += 8) pc.poly([[15 + (y - 12) * 0.08, y], [29 - (y - 12) * 0.08, y], [29 - (y - 12) * 0.08, y + 3], [15 + (y - 12) * 0.08, y + 3]], C('#4fb8ff'));
      pc.rect(15, 5, 14, 7, C('#ffe27a')); pc.rect(15, 5, 3, 7, C('#fff6c0')); pc.rect(13, 4, 18, 2, C('#4a6a8a')); pc.rect(13, 11, 18, 2, C('#4a6a8a'));
      pc.tri(14, 4, 30, 4, 22, 0, C('#ff6a6a'));
      pc.rect(19, 38, 6, 8, C('#2a4a6a')); pc.ellipse(22, 38, 3, 2, C('#2a4a6a'));
    } else if (world === 3) { // torre do relógio do Rei
      pc.rect(8, 26, 28, 24, C('#b08050')); pc.rect(8, 26, 4, 24, C('#d0a070'));
      pc.rect(13, 6, 18, 44, C('#c8a070')); pc.rect(13, 6, 4, 44, C('#e8c890')); pc.rect(28, 6, 3, 44, C('#8a6a40'));
      pc.tri(11, 7, 33, 7, 22, -4, C('#8a3a2a')); pc.tri(22, 7, 33, 7, 22, -4, C('#6a2a1a'));
      pc.circle(22, 17, 7, C('#7a4020')); pc.circle(22, 17, 6, C('#fff4dc'));
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; pc.px(Math.round(22 + Math.cos(a) * 5), Math.round(17 + Math.sin(a) * 5), C('#7a4020')); }
      for (const x of [9, 31]) { pc.rect(x - 1, 22, 6, 4, C('#a8702a')); pc.tri(x - 2, 23, x + 6, 23, x + 2, 16, C('#6a2a1a')); }
      pc.rect(17, 36, 10, 14, C('#4a2a10')); pc.ellipse(22, 36, 5, 3, C('#4a2a10'));
      pc.rect(16, 28, 3, 3, C('#ffe08a')); pc.rect(25, 28, 3, 3, C('#ffe08a'));
    } else if (world === 4) { // fortaleza da cama: cabeceira gigante com olhos
      pc.rect(2, 26, 40, 24, C('#2a1e44')); pc.rect(2, 22, 40, 5, C('#d8d0f0')); pc.rect(2, 22, 40, 1, C('#ffffff'));
      pc.rect(0, 4, 6, 46, C('#4a2e2a')); pc.rect(38, 10, 6, 40, C('#4a2e2a')); pc.vline(1, 4, 46, C('#6a4a3a')); pc.vline(39, 10, 40, C('#6a4a3a'));
      pc.ellipse(3, 4, 4, 3, C('#5a3a32')); pc.ellipse(41, 10, 4, 3, C('#5a3a32'));
      pc.poly([[6, 22], [38, 22], [34, 8], [22, 3], [10, 8]], C('#3a2a5a')); pc.poly([[22, 22], [38, 22], [34, 8], [22, 3]], C('#2a1e44'));
      pc.rect(14, 32, 16, 18, C('#0b0716')); pc.ellipse(22, 32, 8, 5, C('#0b0716'));
      pc.rect(17, 38, 2, 2, C('#ffe14a')); pc.rect(25, 38, 2, 2, C('#ffe14a'));
      for (let x = 4; x < 40; x += 5) pc.px(x, 29, C('#5a4a88'));
    } else { // torre-tear do Costureiro
      pc.poly([[10, 50], [34, 50], [28, 10], [16, 10]], C('#3a0a1a')); pc.poly([[22, 50], [34, 50], [28, 10], [22, 10]], C('#22040e'));
      pc.tri(13, 12, 31, 12, 22, -2, C('#7a1430')); pc.tri(22, 12, 31, 12, 22, -2, C('#5a0a24'));
      pc.line(4, 6, 40, 46, C('#ffd23f')); pc.line(40, 8, 4, 46, C('#ffd23f')); pc.line(5, 6, 41, 46, C('#c8a020'));
      pc.circle(22, 24, 4, C('#ff4f8a')); pc.circle(21, 23, 2, C('#ffb0d0'));
      pc.rect(17, 38, 10, 12, C('#ff4f8a')); pc.ellipse(22, 38, 5, 3, C('#ff4f8a')); pc.rect(19, 41, 6, 9, C('#2a0410'));
    }
  });
}

/** Bandeirinha de "castelo vencido" (hasteada no topo). */
export function flagProp(world) {
  return make('flag' + world, 12, 14, 1, 13, 1, (pc) => {
    pc.vline(1, 0, 14, '#d8d8e8');
    pc.poly([[2, 1], [11, 3], [2, 6]], '#fff4dc'); pc.px(5, 3, '#ffd23f'); pc.px(6, 3, '#ffd23f'); pc.px(5, 2, '#ffd23f');
  });
}

/** Carimbo como canvas (para desenhar direto no contexto em tempo real). */
export function propCanvas(s) {
  if (!s.flushed) { s.pc.flush(); s.flushed = true; }
  return s.pc.canvas;
}
