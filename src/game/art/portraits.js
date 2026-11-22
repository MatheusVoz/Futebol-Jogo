// =============================================================================
// art/portraits.js — Retratos de diálogo (48x48) de todos os personagens.
//
// Cada retrato tem duas camadas, ambas pré-renderizadas UMA vez (nada de
// trabalho de pixel por quadro):
//   1) fundo: um retalho de tecido com borda costurada, próprio de cada
//      personagem (defineImage 'portrait_bg_<id>');
//   2) busto: o personagem recortado dentro do retalho, num spritesheet
//      'portrait_<id>' com uma animação por expressão e 4 quadros cada:
//      0 = boca fechada, 1 = boca aberta, 2 = piscando, 3 = piscando + boca aberta.
// O spritesheet é construído pelo buildAll() da tela de carregamento.
//
// API (mantida do stub):
//   PORTRAIT_SIZE = 48
//   portraitInfo(who) -> { name, color }
//   drawPortrait(ctx, who, expr, x, y, { talking, t, flip })
//     desenha com o canto superior esquerdo em (x,y). Falando, a boca alterna
//     ~9 Hz; os olhos piscam de vez em quando (determinístico a partir de t).
//   registerPortrait(id, { name, color, exprs, draw(pc, expr, frame) })
//     — outros módulos podem registrar retratos extras com draw próprio; este
//     módulo cria o spritesheet deles sob demanda.
// 'narrador' e 'placa' não têm retrato (nada é desenhado).
// =============================================================================
import { R, registerPortrait } from '../registry.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { defineSprite, drawSprite, hasSprite, defineImage, drawImage } from '../../engine/sprites.js';
import { mixColor, hashString } from '../../engine/util.js';

export const PORTRAIT_SIZE = 48;
const S = PORTRAIT_SIZE;
const ALL_EXPRS = ['neutral', 'happy', 'sad', 'scared', 'surprised', 'confused', 'determined', 'sleepy', 'angry'];

// =============================================================================
// Utilitários de desenho
// =============================================================================
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const clamp01 = (v) => (v < 0 ? 0 : v > 0.999 ? 0.999 : v);

/** Camada temporária leve (mesma API do PixelCanvas, sem canvas DOM). */
function makeLayer() {
  const L = Object.create(PixelCanvas.prototype);
  L.w = S; L.h = S; L.buf = new Uint32Array(S * S); L.ox = 0; L.oy = 0;
  return L;
}
const layerPool = [];
let layerTop = 0;
/** Desenha uma peça numa camada própria, contorna e cola no alvo. */
function part(target, outColor, draw, outlineOpts) {
  const L = layerPool[layerTop] || (layerPool[layerTop] = makeLayer());
  layerTop++;
  L.buf.fill(0); L.ox = 0; L.oy = 0;
  try {
    draw(L);
    if (outColor) L.outline(outColor, outlineOpts);
    target.blit(L);
  } finally { layerTop--; }
}

/** Luz vinda de cima-esquerda (normalizada). */
const LX = -0.5, LY = -0.62, LZ = 0.6;
/**
 * Elipse preenchida com volume (sombreamento esférico + dithering curto).
 * tones: do mais escuro ao mais claro. cuts: limiares (len = tones-1) em 0..1.
 */
function ball(pc, cx, cy, rx, ry, tones, cuts, clipFn) {
  const n = tones.length;
  if (!cuts) cuts = n === 4 ? [0.2, 0.42, 0.84] : n === 3 ? [0.36, 0.82] : n === 2 ? [0.45] : [];
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (clipFn && !clipFn(x, y)) continue;
      const nz = Math.sqrt(1 - d);
      const l = (nx * LX + ny * LY + nz * LZ + 1) / 2 + (bay(x, y) - 0.5) * 0.07;
      let k = 0;
      while (k < cuts.length && l >= cuts[k]) k++;
      pc.px(x, y, tones[k]);
    }
  }
  return pc;
}
/** Elipse por caixa (x,y,w,h). */
function oval(pc, x, y, w, h, c) { return pc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, c); }
/** Linha grossa de 2px (sobrancelhas etc.). */
function line2(pc, x0, y0, x1, y1, c) { pc.line(x0, y0, x1, y1, c); pc.line(x0, y0 + 1, x1, y1 + 1, c); }
/** Arco tracejado sobre uma elipse (costuras). a0..a1 em graus (0 = direita, 90 = baixo). */
function dashedArc(pc, cx, cy, rx, ry, a0, a1, c, on = 2, off = 2) {
  let lx = null, ly = null, n = 0;
  const steps = Math.ceil(Math.abs(a1 - a0) * (rx + ry) / 40) + 8;
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + (a1 - a0) * (i / steps)) * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(a) * rx - 0.5), y = Math.round(cy + Math.sin(a) * ry - 0.5);
    if (x === lx && y === ly) continue;
    if (n % (on + off) < on) pc.px(x, y, c);
    n++; lx = x; ly = y;
  }
}
/** Pontos de costura em cruz pequenos ao longo de um segmento. */
function crossStitches(pc, x0, y0, x1, y1, n, c) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    pc.px(x - 1, y - 1, c); pc.px(x + 1, y + 1, c); pc.px(x, y, c); pc.px(x + 1, y - 1, c); pc.px(x - 1, y + 1, c);
  }
}
/** Botão costurado (olho de botão, enfeite). */
function sewButton(pc, cx, cy, r, base, dark, light, thread, holes = 4) {
  pc.circle(cx, cy, r, dark);
  pc.circle(cx - 0.4, cy - 0.4, r - 1, base);
  if (r >= 3) pc.px(Math.round(cx - r * 0.55), Math.round(cy - r * 0.55), light);
  if (r >= 4) pc.ring(cx, cy, r - 1.5, mixColor(base, dark, 0.45));
  const ix = Math.floor(cx), iy = Math.floor(cy);
  if (holes === 4) {
    const o = r >= 4 ? 1 : 0;
    pc.px(ix - 1 - o, iy - 1 - o, thread); pc.px(ix + o, iy - 1 - o, thread);
    pc.px(ix - 1 - o, iy + o, thread); pc.px(ix + o, iy + o, thread);
    if (o) { pc.px(ix - 1, iy - 1, thread); pc.px(ix, iy, thread); pc.px(ix, iy - 1, thread); pc.px(ix - 1, iy, thread); }
  } else if (holes === 2) {
    pc.px(ix - 1, iy, thread); pc.px(ix + 1, iy, thread); pc.px(ix, iy, mixColor(thread, base, 0.4));
  }
}
/** Gota de suor. */
function sweatDrop(pc, x, y) {
  pc.px(x + 1, y, '#3a6ab0');
  pc.rect(x, y + 1, 3, 1, '#3a6ab0');
  pc.rect(x - 1, y + 2, 5, 2, '#3a6ab0');
  pc.rect(x, y + 4, 3, 1, '#3a6ab0');
  pc.px(x + 1, y + 1, '#bfe8ff');
  pc.rect(x, y + 2, 3, 2, '#9fd8ff');
  pc.px(x, y + 2, '#ffffff');
}
/** Lágrima escorrendo. */
function tearDrop(pc, x, y, len = 3) {
  for (let i = 0; i < len; i++) pc.px(x, y + i, i === 0 ? '#e8f8ff' : '#8fd0ff');
  pc.rect(x - 1, y + len, 3, 2, '#6fb8f0');
  pc.px(x, y + len, '#dff4ff');
  pc.px(x, y + len + 2, '#4f90d0');
}
/** Marca de raiva (veia em cruz). */
function angerMark(pc, x, y) {
  const c = '#e0304a', d = '#901830';
  pc.rect(x, y + 1, 2, 1, c); pc.rect(x + 3, y + 1, 2, 1, c);
  pc.rect(x + 1, y, 1, 2, c); pc.rect(x + 3, y, 1, 2, c);
  pc.rect(x, y + 3, 2, 1, c); pc.rect(x + 3, y + 3, 2, 1, c);
  pc.rect(x + 1, y + 3, 1, 2, c); pc.rect(x + 3, y + 3, 1, 2, c);
  pc.px(x + 2, y + 2, d);
}
/** Interrogação em pixel (4x6). */
function questionMark(pc, x, y, c = '#ffffff', sh = '#3a2a5a') {
  const rows = ['.##.', '#..#', '...#', '..#.', '....', '..#.'];
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < 4; i++) if (rows[j][i] === '#') { pc.px(x + i + 1, y + j + 1, sh); }
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < 4; i++) if (rows[j][i] === '#') pc.px(x + i, y + j, c);
}
/** Exclamação em pixel. */
function bangMark(pc, x, y, c = '#ffffff', sh = '#3a2a5a') {
  for (const [dx, dy] of [[1, 1], [1, 2], [1, 3], [1, 5]]) pc.px(x + dx + 1, y + dy, sh);
  pc.rect(x, y, 2, 4, c); pc.rect(x, y + 5, 2, 1, c);
}
/** "z" de sono. */
function sleepZ(pc, x, y, size, c = '#e8f0ff', sh = '#3a3a6a') {
  for (const off of [1, 0]) {
    const col = off ? sh : c;
    pc.hline(x + off, y + off, size, col);
    for (let i = 1; i < size - 1; i++) pc.px(x + off + size - 1 - i, y + off + i, col);
    pc.hline(x + off, y + off + size - 1, size, col);
  }
}
/** Bochecha corada com dithering. */
function blush(pc, cx, cy, w, h, c, density = 0.65) {
  for (let y = Math.floor(cy - h / 2); y < cy + h / 2; y++)
    for (let x = Math.floor(cx - w / 2); x < cx + w / 2; x++) {
      const nx = (x + 0.5 - cx) / (w / 2), ny = (y + 0.5 - cy) / (h / 2);
      if (nx * nx + ny * ny > 1) continue;
      if (density >= 1 || bay(x, y) < density) pc.px(x, y, c);
    }
}


/**
 * Elipse sombreada com tons escolhidos por região (retalhos costurados):
 * regionFn(x,y) -> índice do conjunto de tons em toneSets.
 */
function ballPatches(pc, cx, cy, rx, ry, toneSets, regionFn, cuts) {
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
  const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    const d = nx * nx + ny * ny;
    if (d > 1) continue;
    const tones = toneSets[regionFn(x, y)];
    const c = cuts || (tones.length === 4 ? [0.2, 0.42, 0.84] : [0.36, 0.82]);
    const l = (nx * LX + ny * LY + Math.sqrt(1 - d) * LZ + 1) / 2 + (bay(x, y) - 0.5) * 0.07;
    let k = 0;
    while (k < c.length && l >= c[k]) k++;
    pc.px(x, y, tones[k]);
  }
}

/**
 * Olhos genéricos de pelúcia/desenho. eyes: [{x,y,w,h,side:-1|1}] (side -1 = olho à esquerda).
 * kind: open | happy | closed | sad | wide | big | angry | determined | sleepy | squint
 * col: { eye, lid, glint, glint2, white }
 */
function drawEyes(pc, eyes, kind, col) {
  const E = col.eye, lid = col.lid, G = col.glint || '#ffffff', G2 = col.glint2 || mixColor(E, '#ffffff', 0.4);
  for (const e of eyes) {
    const { x, y, w, h } = e;
    const s = e.side || -1;
    const cx = x + w / 2;
    const openEye = (yy = y, hh = h) => {
      oval(pc, x, yy, w, hh, E);
      if (w >= 4) pc.rect(x + 1, yy + 1, w >= 5 ? 2 : 1, hh >= 6 ? 2 : 1, G); else pc.px(x + 1, yy + 1, G);
      if (w >= 4 && hh >= 5) pc.px(x + w - 2, yy + hh - 2, G2);
    };
    switch (kind) {
      case 'open': openEye(); break;
      case 'wide':
        oval(pc, x - 1, y - 1, w + 2, h + 2, E);
        oval(pc, x, y, w, h, col.white || '#f6f8ff');
        pc.rect(Math.round(cx) - 1, Math.round(y + h / 2) - 1, 2, 2, E);
        break;
      case 'big':
        oval(pc, x - 1, y - 1, w + 2, h + 2, E);
        pc.rect(x, y, 3, 3, G); pc.px(x + w - 1, y + h - 1, G);
        break;
      case 'happy': {
        const m = Math.round(cx - 0.5), t = y + Math.round(h * 0.3), b = y + Math.round(h * 0.65);
        pc.line(x, b, m, t, E); pc.line(m, t, x + w - 1, b, E);
        pc.line(x, b + 1, m, t + 1, E); pc.line(m, t + 1, x + w - 1, b + 1, E);
        break;
      }
      case 'closed': {
        const yy = y + Math.round(h * 0.6);
        pc.hline(x, yy, w, E); pc.px(x, yy - 1, E); pc.px(x + w - 1, yy - 1, E);
        if (w > 3) pc.hline(x + 1, yy + 1, w - 2, E);
        break;
      }
      case 'sad':
        openEye(y + 1, h - 1);
        if (s < 0) { pc.line(x - 1, y + 2, x + 2, y, lid); pc.line(x - 1, y + 3, x + 2, y + 1, lid); }
        else { pc.line(x + w, y + 2, x + w - 3, y, lid); pc.line(x + w, y + 3, x + w - 3, y + 1, lid); }
        break;
      case 'angry':
        openEye(y + 1, h - 1);
        if (s < 0) for (let i = -1; i < 2; i++) pc.line(x - 1, y + i, x + w, y + i + 3, lid);
        else for (let i = -1; i < 2; i++) pc.line(x + w, y + i, x - 1, y + i + 3, lid);
        break;
      case 'determined':
        openEye();
        pc.hline(x - 1, y, w + 2, lid); pc.hline(x - 1, y + 1, w + 2, lid);
        if (s < 0) pc.px(x + w - 1, y + 2, lid); else pc.px(x, y + 2, lid);
        break;
      case 'sleepy': {
        const hh = Math.max(2, Math.round(h * 0.45));
        oval(pc, x, y + h - hh * 2, w, hh * 2, E);
        pc.rect(x - 1, y - 1, w + 2, h - hh + 1, lid);
        pc.hline(x, y + h - hh, w, col.lash || E);
        break;
      }
      case 'squint': {
        const m = y + Math.round(h / 2);
        if (s < 0) { pc.line(x, m - 2, x + w - 1, m, E); pc.line(x + w - 1, m, x, m + 2, E); }
        else { pc.line(x + w - 1, m - 2, x, m, E); pc.line(x, m, x + w - 1, m + 2, E); }
        break;
      }
      case 'line': pc.hline(x, y + Math.round(h / 2), w, E); break;
    }
  }
}
/** Sobrancelhas genéricas a partir das caixas dos olhos. */
function drawBrows(pc, eyes, expr, c, dy = 0, thick = 2) {
  const ln = thick === 2 ? line2 : (a, b, cc, d, col) => pc.line(a, b, cc, d, col);
  for (const e of eyes) {
    const { x, w } = e, s = e.side || -1;
    const y = e.y - 2 + dy;
    const L = x - 1, Rx = x + w;
    let a, b; // a = ponta de fora, b = ponta de dentro (y)
    switch (expr) {
      case 'sad': a = y; b = y - 2; break;
      case 'scared': a = y - 2; b = y - 3; break;
      case 'surprised': a = y - 3; b = y - 3; break;
      case 'angry': a = y - 2; b = y + 1; break;
      case 'determined': a = y - 2; b = y; break;
      case 'confused': a = s < 0 ? y - 3 : y; b = s < 0 ? y - 2 : y; break;
      default: continue;
    }
    if (s < 0) ln(pc, L, a, Rx, b, c); else ln(pc, L, b, Rx, a, c);
  }
}

// =============================================================================
// Fundo: retalho de tecido com borda costurada
// =============================================================================
/** Distância (em px) até a borda do retalho com cantos arredondados; <0 = fora. */
function insetOf(x, y) {
  const xx = Math.min(x, S - 1 - x), yy = Math.min(y, S - 1 - y);
  let m = Math.min(xx, yy);
  const R0 = 4;
  if (xx < R0 && yy < R0) m = Math.min(m, Math.floor(R0 - 0.5 - Math.hypot(R0 - 0.5 - xx, R0 - 0.5 - yy) + 0.75));
  return m;
}
const INSET = new Int8Array(S * S);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) INSET[y * S + x] = insetOf(x, y);

// ---- padrões de tecido (fn(x,y) -> índice de tom 0..n)
const PAT = {
  plain: () => 0,
  gingham: (s = 4) => (x, y) => (((x / s) | 0) % 2) + (((y / s) | 0) % 2),
  stripesV: (s = 3) => (x) => (((x / s) | 0) % 2),
  stripesD: (s = 3) => (x, y) => ((((x + y) / s) | 0) % 2),
  dots: (s = 8) => (x, y) => {
    const row = (y / s) | 0;
    const ox = (row % 2) * (s / 2);
    const dx = ((x + ox) % s) - s / 2 + 0.5, dy = (y % s) - s / 2 + 0.5;
    return dx * dx + dy * dy <= 2.2 ? 2 : 0;
  },
  felt: (seed = 1) => (x, y) => {
    const h = (Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 2654435761) >>> 24) / 255;
    return h > 0.86 ? 1 : 0;
  },
  waves: (s = 6) => (x, y) => {
    const v = (y + Math.round(Math.sin((x / s) * Math.PI) * 1.5)) % s;
    return v === 0 ? 2 : v === 1 ? 1 : 0;
  },
  quilt: (s = 8) => (x, y) => ((x % s === 0 || y % s === 0) ? 2 : ((((x / s) | 0) + ((y / s) | 0)) % 2)),
};

/**
 * Desenha o retalho de fundo 48x48.
 * cfg: { tones:[base, alt, accent], edge, rim, stitch, pattern, glow?, extra?(pc) }
 */
function drawPatch(pc, cfg) {
  const { tones, edge, stitch } = cfg;
  const pat = cfg.pattern || PAT.plain;
  const shadeT = tones.map((c) => mixColor(c, cfg.shade || '#000000', 0.28));
  const lightT = tones.map((c) => mixColor(c, '#ffffff', 0.1));
  const rimL = cfg.rimLight || mixColor(tones[0], '#ffffff', 0.35);
  const rimD = cfg.rimDark || mixColor(tones[0], '#000000', 0.4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ins = INSET[y * S + x];
    if (ins < 0) continue;
    if (ins === 0) { pc.px(x, y, edge); continue; }
    if (ins === 1) { pc.px(x, y, x + y < S - 1 ? rimL : rimD); continue; }
    const k = Math.min(tones.length - 1, pat(x, y));
    // gradiente de luz: claro em cima-esquerda, sombra embaixo-direita
    const g = (x * 0.45 + y * 0.75) / S + (bay(x, y) - 0.5) * 0.22;
    let c = g > 0.83 ? shadeT[k] : g < 0.22 ? lightT[k] : tones[k];
    if (cfg.glow) {
      const [gx, gy, gr, gc] = cfg.glow;
      const d = Math.hypot(x - gx, y - gy) / gr + (bay(x, y) - 0.5) * 0.25;
      if (d < 1) c = mixColor(c, gc, d < 0.55 ? 0.5 : 0.25);
    }
    pc.px(x, y, c);
  }
  if (cfg.extra) cfg.extra(pc);
  // costura tracejada na margem (inset 3), com sombrinha
  const shadow = cfg.stitchShadow || mixColor(tones[0], '#000000', 0.45);
  const pts = [];
  for (let x = 4; x <= S - 5; x++) pts.push([x, 3]);
  for (let y = 4; y <= S - 5; y++) pts.push([S - 4, y]);
  for (let x = S - 5; x >= 4; x--) pts.push([x, S - 4]);
  for (let y = S - 5; y >= 4; y--) pts.push([3, y]);
  pts.forEach(([x, y], i) => {
    if (i % 4 < 2) { pc.px(x + 1, y + 1, shadow); }
  });
  pts.forEach(([x, y], i) => { if (i % 4 < 2) pc.px(x, y, stitch); });
}

/** Recorta a camada do busto para dentro do retalho (inset >= 1). */
function clipToPatch(pc) {
  for (let i = 0; i < S * S; i++) if (INSET[i] < 1) pc.buf[i] = 0;
}

// =============================================================================
// TICO — dinossauro de pelúcia turquesa (9 expressões)
// =============================================================================
const TC = {
  body: '#3fc7c0', shade: '#2a9d97', dark: '#1f7f7c', light: '#7fe6df', hi: '#b6f6f0',
  spine: '#ffd23f', spineD: '#e0a020', spineL: '#fff0a0',
  eye: '#120a18', out: '#1b2a3a', mouth: '#1b4a4a', seam: '#227f7b', gold: '#ffd23f',
  spotY: '#ffd23f', spotO: '#ff8a3c', spotB: '#4a7fe0', blush: '#ff8fb0',
  muzzle: ['#3bb5ae', '#62d6cf', '#8fe9e2', '#c4f8f2'],
};
const TICO_T = [TC.dark, TC.shade, TC.body, TC.light];

/** Espinho amarelo de pelúcia: base em (bx,by), apontando na direção (nx,ny). */
function spine(pc, bx, by, nx, ny, len, half) {
  const l = Math.hypot(nx, ny); nx /= l; ny /= l;
  const tx = bx + nx * len, ty = by + ny * len;
  const px = -ny, py = nx;
  const a = [bx + px * half, by + py * half], b = [bx - px * half, by - py * half];
  pc.poly([a, [tx, ty], b], TC.spineD);
  // metade iluminada (lado voltado para cima-esquerda)
  const lit = (px * LX + py * LY) > 0 ? a : b;
  pc.poly([lit, [tx, ty], [bx + nx * 0.5, by + ny * 0.5]], TC.spine);
  pc.px(Math.round((lit[0] + tx) / 2 + nx * -0.5), Math.round((lit[1] + ty) / 2 + ny * -0.5), TC.spineL);
}

function ticoEyeOpen(pc, x, y, w, h) {
  oval(pc, x, y, w, h, TC.eye);
  pc.rect(x + 1, y + 1, 2, 2, '#ffffff');
  pc.px(x + w - 2, y + h - 2, '#6a6a9a');
}

function drawTico(pc, expr, mouth, blink) {
  const out = TC.out;
  // ---- espinhos (atrás)
  const HX = 22, HY = 21, HRX = 15.5, HRY = 14;
  const spines = [];
  for (const [a, len] of [[188, 6.5], [212, 7.5], [237, 7.5], [262, 6.5]]) {
    const r = (a * Math.PI) / 180;
    const nx = Math.cos(r), ny = Math.sin(r);
    spines.push([HX + nx * (HRX - 1.5), HY + ny * (HRY - 1.5), nx, ny * 1.05, len, 3.4]);
  }
  spines.push([10, 34, -1, -0.25, 5.5, 3]);
  spines.push([4, 42, -1, -0.55, 5.5, 3.2]);
  for (const s of spines) part(pc, out, (L) => spine(L, ...s));
  // ---- dorso (atrás do pescoço)
  part(pc, out, (L) => {
    ball(L, 13, 53, 19, 13, TICO_T);
    L.ellipse(6, 45.5, 2.2, 1.8, TC.spotO); L.px(7, 46, mixColor(TC.spotO, '#000', 0.25));
    L.circle(13, 43, 1.2, TC.spotB);
  });
  // ---- pescoço + cabeça (uma peça só)
  part(pc, out, (L) => {
    L.poly([[11, 28], [27, 28], [29, 48], [9, 48]], TC.body);
    for (let y = 28; y < 48; y++) {
      const t = (y - 28) / 20;
      const xl = Math.round(11 - 2 * t), xr = Math.round(27 + 2 * t);
      L.px(xl, y, TC.light); L.px(xl + 1, y, (y & 1) ? TC.light : TC.body);
      L.px(xr - 1, y, TC.shade); L.px(xr - 2, y, TC.shade); L.px(xr - 3, y, (y & 1) ? TC.shade : TC.body);
    }
    // garganta clara
    L.ellipse(22, 46, 4, 6, TC.light);
    ball(L, HX, HY, HRX, HRY, TICO_T);
    // manchas
    const spot = (x, y, r, c) => { L.ellipse(x, y, r, r * 0.85, c); L.px(Math.round(x + r * 0.4), Math.round(y + r * 0.4), mixColor(c, '#000', 0.25)); };
    spot(12, 14.5, 2.6, TC.spotY);
    spot(9.5, 22.5, 1.7, TC.spotO);
    spot(17.5, 9.5, 1.5, TC.spotB);
    spot(12.5, 30, 1.5, TC.spotB);
  });
  // ---- focinho (peça mais clara, costurada com fio dourado)
  const MX = 31, MY = 28.5, MRX = 9.5, MRY = 6.5;
  part(pc, TC.seam, (L) => ball(L, MX, MY, MRX, MRY, TC.muzzle, [0.18, 0.45, 0.88]));
  dashedArc(pc, MX, MY, MRX + 1.2, MRY + 1.2, 150, 285, TC.gold, 1, 2);
  // narinas
  pc.px(37, 25, TC.mouth); pc.px(39, 25, TC.mouth);
  drawTicoFace(pc, expr, mouth, blink);
}

function drawTicoFace(pc, expr, mouth, blink) {
  const E = TC.eye, M = TC.mouth, BR = TC.out;
  const L = { x: 17, y: 11, w: 6, h: 9 };   // olho próximo (esquerdo)
  const Rr = { x: 29, y: 11, w: 5, h: 9 };  // olho distante (direito)
  const lidC = TC.body;
  const eyes = (kind) => {
    for (const e of [L, Rr]) {
      const { x, y, w, h } = e;
      const cx = x + w / 2;
      switch (kind) {
        case 'open': ticoEyeOpen(pc, x, y, w, h); break;
        case 'wide': // susto: olho branco com pupila pequena
          oval(pc, x - 1, y - 1, w + 2, h + 2, E);
          oval(pc, x, y, w, h, '#f4fbff');
          pc.rect(Math.round(cx) - 1, y + 3, 2, 2, E);
          break;
        case 'big': // surpresa: olho maior e brilhante
          oval(pc, x - 1, y - 1, w + 2, h + 2, E);
          pc.rect(x, y, 3, 3, '#ffffff');
          pc.px(x + w - 1, y + h - 1, '#ffffff');
          pc.px(x + w - 2, y + h - 1, '#6a6a9a');
          break;
        case 'happy': // ^ ^
          pc.line(x, y + 5, Math.floor(cx) - 0.5, y + 2, E); pc.line(x + 1, y + 5, Math.floor(cx), y + 3, E);
          pc.line(Math.ceil(cx - 0.5), y + 2, x + w - 1, y + 5, E); pc.line(Math.ceil(cx - 0.5), y + 3, x + w - 2, y + 5, E);
          break;
        case 'closed': // piscada: arco para baixo
          pc.hline(x, y + 5, w, E); pc.px(x - (e === L ? 0 : 0), y + 4, E); pc.px(x + w - 1, y + 4, E);
          pc.hline(x + 1, y + 6, w - 2, E);
          break;
        case 'sad': ticoEyeOpen(pc, x, y + 1, w, h - 1);
          // pálpebra caída no canto de fora
          if (e === L) { pc.line(x - 1, y + 2, x + 2, y, lidC); pc.line(x - 1, y + 3, x + 3, y + 1, lidC); pc.px(x, y + 4, lidC); }
          else { pc.line(x + w, y + 2, x + w - 3, y, lidC); pc.line(x + w, y + 3, x + w - 4, y + 1, lidC); pc.px(x + w - 1, y + 4, lidC); }
          pc.px(x + 2, y + h - 2, '#9fd8ff');
          break;
        case 'angry': ticoEyeOpen(pc, x, y + 1, w, h - 1);
          if (e === L) { pc.line(x, y, x + w, y + 3, lidC); pc.line(x, y + 1, x + w, y + 4, lidC); pc.line(x, y - 1, x + w, y + 2, lidC); }
          else { pc.line(x + w - 1, y, x - 1, y + 3, lidC); pc.line(x + w - 1, y + 1, x - 1, y + 4, lidC); pc.line(x + w - 1, y - 1, x - 1, y + 2, lidC); }
          break;
        case 'determined': ticoEyeOpen(pc, x, y, w, h);
          for (let i = 0; i < 2; i++) pc.hline(x - 1, y + i, w + 2, lidC);
          if (e === L) pc.px(x + w - 1, y + 2, lidC); else pc.px(x, y + 2, lidC);
          pc.px(x + 1, y + 3, '#ffffff'); pc.px(x + 2, y + 3, '#ffffff');
          break;
        case 'sleepy':
          oval(pc, x, y + 2, w, h - 2, E);
          for (let i = 0; i < 4; i++) pc.hline(x - 1, y + i, w + 2, lidC);
          pc.hline(x, y + 4, w, '#155a57');
          pc.px(x + 1, y + 5, '#8a8ab0');
          break;
        case 'squint': // >
          pc.line(x, y + 2, x + w - 2, y + 4, E); pc.line(x + w - 2, y + 4, x, y + 6, E);
          pc.line(x + 1, y + 2, x + w - 1, y + 4, E); pc.line(x + w - 1, y + 4, x + 1, y + 6, E);
          break;
      }
    }
  };
  // ---- olhos
  let eyeKind = {
    neutral: 'open', happy: 'happy', sad: 'sad', scared: 'wide', surprised: 'big', confused: 'open',
    determined: 'determined', sleepy: 'sleepy', angry: 'angry',
  }[expr] || 'open';
  if (blink && eyeKind !== 'happy') eyeKind = 'closed';
  if (expr === 'confused' && !blink) {
    ticoEyeOpen(pc, L.x, L.y, L.w, L.h);
    // olho direito apertado
    pc.line(Rr.x, Rr.y + 4, Rr.x + Rr.w - 1, Rr.y + 3, E); pc.line(Rr.x, Rr.y + 5, Rr.x + Rr.w - 1, Rr.y + 4, E);
  } else eyes(eyeKind);

  // ---- sobrancelhas (costuradas, escuras)
  const brow = (x0, y0, x1, y1) => line2(pc, x0, y0, x1, y1, BR);
  switch (expr) {
    case 'sad': brow(17, 10, 21, 8); brow(31, 8, 34, 10); break;
    case 'scared': brow(17, 8, 21, 7); brow(30, 7, 34, 8); break;
    case 'surprised': brow(18, 7, 22, 6); brow(29, 6, 33, 7); break;
    case 'confused': brow(17, 8, 22, 7); brow(29, 10, 34, 10); break;
    case 'determined': brow(17, 9, 23, 11); brow(29, 11, 34, 9); break;
    case 'angry': brow(17, 8, 23, 11); brow(29, 11, 35, 8); break;
  }

  // ---- bochechas
  const blushD = expr === 'happy' ? 1 : expr === 'angry' ? 0.75 : expr === 'scared' ? 0 : 0.4;
  if (blushD > 0) {
    const bc = expr === 'angry' ? '#ff6070' : TC.blush;
    blush(pc, 16, 24, 6, 3, bc, blushD);
    blush(pc, 34, 23, 4, 2, bc, blushD * 0.8);
  }

  // ---- boca (no focinho)
  drawTicoMouth(pc, expr, mouth);

  // ---- extras
  if (expr === 'scared') { sweatDrop(pc, 38, 8); pc.line(10, 13, 10, 16, '#2a6aa0'); pc.line(12, 12, 12, 15, '#2a6aa0'); }
  if (expr === 'sad' && !blink) tearDrop(pc, 19, 21, 3);
  if (expr === 'angry') angerMark(pc, 38, 5);
  if (expr === 'confused') questionMark(pc, 40, 4, '#ffffff', '#1b2a3a');
  if (expr === 'surprised') bangMark(pc, 41, 4, '#ffffff', '#1b2a3a');
  if (expr === 'sleepy') { sleepZ(pc, 38, 8, 4); sleepZ(pc, 42, 3, 3); }
}

function drawTicoMouth(pc, expr, open) {
  const M = TC.mouth, IN = '#3a1428', TG = '#ff7a9a';
  const stitchSmile = (x0, x1, y, curve) => {
    // linha costurada com pequenos pontos verticais
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const yy = Math.round(y + curve * 4 * t * (1 - t));
      pc.px(x, yy, M);
    }
    for (let x = x0 + 2; x < x1; x += 3) {
      const t = (x - x0) / (x1 - x0);
      const yy = Math.round(y + curve * 4 * t * (1 - t));
      pc.px(x, yy - 1, M); pc.px(x, yy + 1, M);
    }
  };
  switch (expr) {
    case 'happy':
      if (open) {
        pc.poly([[27, 29], [39, 28], [36, 34], [30, 34]], IN);
        pc.hline(28, 29, 11, M);
        pc.rect(31, 32, 4, 2, TG);
        pc.hline(30, 34, 6, M);
      } else stitchSmile(27, 39, 29, 2.5);
      break;
    case 'sad':
      if (open) { oval(pc, 30, 30, 6, 4, IN); pc.rect(31, 32, 4, 2, TG); pc.hline(31, 30, 4, M); }
      else stitchSmile(29, 37, 32, -1.6);
      break;
    case 'scared': {
      const yb = 31;
      if (open) { oval(pc, 29, 29, 8, 5, IN); pc.rect(31, 32, 4, 2, TG); }
      for (let x = 28; x <= 38; x++) pc.px(x, yb + (((x >> 1) % 2) ? 0 : 1) - (open ? 2 : 0), M);
      break;
    }
    case 'surprised':
      if (open) { oval(pc, 30, 28, 6, 7, IN); pc.rect(31, 32, 4, 2, TG); pc.ring(33, 31.5, 3.2, M); }
      else { oval(pc, 31, 29, 4, 4, IN); pc.ring(33, 31, 2.2, M); }
      break;
    case 'confused':
      if (open) { oval(pc, 31, 30, 5, 3, IN); }
      for (let x = 28; x <= 37; x++) pc.px(x, 30 + (((x + 1) >> 1) % 2), M);
      break;
    case 'determined':
      if (open) {
        pc.poly([[28, 29], [38, 28], [36, 33], [30, 33]], IN);
        pc.hline(29, 29, 9, '#f8fff8'); pc.hline(29, 28, 10, M);
        pc.px(31, 29, M); pc.px(34, 29, M);
        pc.hline(30, 33, 6, M);
      } else { stitchSmile(28, 38, 30, 1.2); pc.px(38, 29, M); pc.px(39, 28, M); }
      break;
    case 'sleepy':
      if (open) { oval(pc, 31, 29, 5, 5, IN); pc.rect(32, 32, 3, 1, TG); pc.ring(33.5, 31.5, 2.6, M); }
      else stitchSmile(30, 36, 30, 0.6);
      break;
    case 'angry':
      if (open) {
        pc.poly([[27, 28], [39, 28], [37, 34], [29, 34]], IN);
        pc.rect(28, 28, 11, 2, '#f8fff8'); pc.hline(28, 30, 11, '#c8d8d8');
        for (const x of [30, 33, 36]) pc.vline(x, 28, 2, M);
        pc.rect(31, 33, 4, 1, TG);
        pc.hline(27, 27, 13, M);
      } else {
        pc.rect(29, 30, 8, 2, '#f8fff8');
        pc.strokeRect(28, 29, 10, 4, M);
        for (const x of [31, 34]) pc.vline(x, 30, 2, M);
        pc.px(28, 33, M); pc.px(37, 33, M);
      }
      break;
    default: // neutral
      if (open) { pc.poly([[28, 29], [38, 29], [36, 33], [30, 33]], IN); pc.rect(31, 31, 4, 2, TG); pc.hline(28, 29, 11, M); pc.hline(30, 33, 6, M); }
      else stitchSmile(28, 38, 29, 1.6);
  }
}

// =============================================================================
// Tabela de personagens
// =============================================================================
const CHARS = {
  tico: {
    name: 'Tico', color: '#3fc7c0', exprs: ALL_EXPRS, draw: drawTico,
    bg: { tones: ['#f6a6bf', '#f08aac', '#e36d98'], pattern: PAT.gingham(4), edge: '#4a1838', stitch: '#ffe680', shade: '#5a1048' },
  },
};

// =============================================================================
// Registro + cache
// =============================================================================
const NO_PORTRAIT = new Set(['narrador', 'placa']);
registerPortrait('narrador', { name: '', color: '#ffffff', none: true });
registerPortrait('placa', { name: '', color: '#c89a5a', none: true });

function frameFlags(frame) { return { mouth: (frame & 1) === 1, blink: (frame & 2) === 2 }; }

function definePortraitSprite(id, exprs, drawFn) {
  const anims = {};
  for (const e of exprs) anims[e] = { frames: 4, fps: 1, loop: true };
  defineSprite('portrait_' + id, {
    w: S, h: S, ox: S / 2, oy: S / 2, anims,
    draw(pc, anim, frame) {
      const { mouth, blink } = frameFlags(frame);
      drawFn(pc, anim, mouth, blink);
      clipToPatch(pc);
    },
  });
}

for (const [id, def] of Object.entries(CHARS)) {
  const exprs = def.exprs.includes('neutral') ? def.exprs : ['neutral', ...def.exprs];
  registerPortrait(id, {
    name: def.name, color: def.color, exprs,
    sprite: 'portrait_' + id, bgImage: 'portrait_bg_' + id,
    /** draw(pc, expr, frame): desenha o busto (frame: bit0 boca aberta, bit1 piscando). */
    draw(pc, expr, frame = 0) { const f = frameFlags(frame); def.draw(pc, exprs.includes(expr) ? expr : 'neutral', f.mouth, f.blink); },
  });
  defineImage('portrait_bg_' + id, S, S, (pc) => drawPatch(pc, def.bg));
  definePortraitSprite(id, exprs, def.draw);
}

// Retratos registrados por outros módulos (com draw próprio): spritesheet sob demanda.
function ensureExternal(p) {
  const name = 'portrait_' + p.id;
  if (hasSprite(name)) return true;
  if (typeof p.draw !== 'function') return false;
  const exprs = Array.isArray(p.exprs) && p.exprs.length ? p.exprs : ['neutral'];
  const anims = {};
  for (const e of exprs) anims[e] = { frames: 4, fps: 1, loop: true };
  defineSprite(name, { w: S, h: S, ox: S / 2, oy: S / 2, anims, draw: (pc, anim, frame) => p.draw(pc, anim, frame) });
  p.sprite = name;
  p.exprs = exprs;
  return true;
}

/** {name, color} do personagem. */
export function portraitInfo(who) {
  const p = R.portraits.get(who);
  return p ? { name: p.name, color: p.color } : { name: who || '', color: '#ffffff' };
}

/** Desenha o retrato 48x48 com canto sup. esq. em (x,y). opts: { talking, t, flip } */
export function drawPortrait(ctx, who, expr = 'neutral', x, y, opts = {}) {
  if (!who || NO_PORTRAIT.has(who)) return;
  const p = R.portraits.get(who);
  if (!p || p.none) return;
  if (!p.sprite && !ensureExternal(p)) return;
  const exprs = p.exprs || ['neutral'];
  const e = exprs.includes(expr) ? expr : exprs.includes('neutral') ? 'neutral' : exprs[0];
  const t = opts.t ?? (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);
  const mouth = !!opts.talking && Math.floor(t * 9) % 2 === 1;
  // piscada: ~0.13 s a cada ~3.4 s, com fase própria por personagem e piscada dupla ocasional
  const ph = ((p.blinkPhase ??= (hashString(who) % 1000) / 1000 * 3.4));
  const cyc = (t + ph) / 3.4;
  const k = Math.floor(cyc), f = (cyc - k) * 3.4;
  const blink = f < 0.13 || (k % 3 === 1 && f > 0.26 && f < 0.38);
  const frame = (mouth ? 1 : 0) + (blink ? 2 : 0);
  const rx = Math.round(x), ry = Math.round(y);
  if (p.bgImage) drawImage(ctx, p.bgImage, rx, ry);
  drawSprite(ctx, p.sprite, e, frame, rx + S / 2, ry + S / 2, { flip: !!opts.flip });
}
