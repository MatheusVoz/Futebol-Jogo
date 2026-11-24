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
import { defineSprite, drawSprite, hasSprite, defineImage, drawImage, getSprite, frameMeta } from '../../engine/sprites.js';
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
  const ln = thick === 2 ? line2 : (p, x0, y0, x1, y1, col) => p.line(x0, y0, x1, y1, col);
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
// Utilitários extras para os demais personagens
// =============================================================================
/** Costura (linha escura + pontos de linha) só onde a camada já tem pixels. */
function seamIn(L, x0, y0, x1, y1, dark, thread, step = 3) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, qx = -dy, qy = dx;
  const has = (x, y) => (L.getU32(x, y) >>> 24) > 0;
  for (let i = 0; i <= n; i++) {
    const fx = x0 + dx * i, fy = y0 + dy * i;
    const x = Math.round(fx), y = Math.round(fy);
    if (!has(x, y)) continue;
    L.px(x, y, dark);
    if (i % step === 1) {
      for (const k of [-1.4, 1.4]) { const sx = Math.round(fx + qx * k), sy = Math.round(fy + qy * k); if (has(sx, sy)) L.px(sx, sy, thread); }
      L.px(x, y, thread);
    }
  }
}
/** Boca genérica pequena. c: { line, inside, tongue, teeth, w } */
function drawMouth(pc, cx, y, expr, open, c) {
  const M = c.line, IN = c.inside || '#3a1428', TG = c.tongue || '#ff7a9a', TE = c.teeth || '#ffffff';
  const h = Math.max(2, Math.floor((c.w || 5) / 2));
  const curve = (w, d) => { for (let i = -w; i <= w; i++) { const t = i / w; pc.px(cx + i, Math.round(y + d * (1 - t * t)), M); } };
  switch (expr) {
    case 'happy':
      if (open) { const w = h + 1; pc.poly([[cx - w, y], [cx + w + 1, y], [cx + w - 1, y + 4], [cx - w + 2, y + 4]], IN); pc.hline(cx - w, y, 2 * w + 1, M); pc.rect(cx - 1, y + 2, 3, 2, TG); }
      else curve(h + 1, 1.6);
      break;
    case 'sad':
      if (open) { oval(pc, cx - 2, y, 5, 4, IN); pc.rect(cx - 1, y + 2, 3, 1, TG); pc.hline(cx - 1, y, 3, M); }
      else curve(h, -1.5);
      break;
    case 'scared':
      if (open) oval(pc, cx - h, y - 1, 2 * h + 1, 4, IN);
      for (let i = -h - 1; i <= h + 1; i++) pc.px(cx + i, y + ((i & 1) ? 0 : 1) - (open ? 1 : 0), M);
      break;
    case 'surprised':
      if (open) { oval(pc, cx - 2, y - 1, 5, 6, IN); pc.rect(cx - 1, y + 2, 3, 2, TG); pc.ring(cx + 0.5, y + 2, 2.6, M); }
      else { pc.ring(cx + 0.5, y + 1.5, 1.8, M); pc.px(cx, y + 1, IN); }
      break;
    case 'angry':
      if (open) { pc.poly([[cx - h - 1, y], [cx + h + 2, y], [cx + h, y + 4], [cx - h + 1, y + 4]], IN); pc.hline(cx - h, y + 1, 2 * h + 1, TE); pc.hline(cx - h - 1, y, 2 * h + 3, M); pc.rect(cx - 1, y + 3, 3, 1, TG); }
      else { curve(h, -1.2); pc.px(cx - h - 1, y + 1, M); pc.px(cx + h + 1, y + 1, M); }
      break;
    case 'determined':
      if (open) { pc.poly([[cx - h, y], [cx + h + 1, y], [cx + h, y + 3], [cx - h + 1, y + 3]], IN); pc.hline(cx - h, y + 1, 2 * h + 1, TE); pc.hline(cx - h, y, 2 * h + 1, M); }
      else { pc.hline(cx - h, y + 1, 2 * h, M); pc.px(cx + h, y, M); }
      break;
    case 'sleepy':
      if (open) { oval(pc, cx - 1, y - 1, 4, 4, IN); pc.ring(cx + 1, y + 1, 2.2, M); }
      else pc.hline(cx - 1, y + 1, 3, M);
      break;
    case 'confused':
      if (open) oval(pc, cx - 1, y, 4, 3, IN);
      for (let i = -h; i <= h; i++) pc.px(cx + i, y + (((i + 8) >> 1) % 2), M);
      break;
    default:
      if (open) { pc.poly([[cx - h, y], [cx + h + 1, y], [cx + h - 1, y + 4], [cx - h + 2, y + 4]], IN); pc.rect(cx - 1, y + 2, 3, 2, TG); pc.hline(cx - h, y, 2 * h + 1, M); }
      else curve(h, 1);
  }
}

// =============================================================================
// LIA — a menina (7 anos), de pijama, marias-chiquinhas com laços
// =============================================================================
const LI = {
  skin: ['#c98478', '#eeb09a', '#ffd9c2', '#fff0e2'], hair: ['#2e1812', '#52301f', '#77472f', '#9e6a48'],
  rib: ['#a8306a', '#e85a9a', '#ff8ac0', '#ffc8e4'], pj: ['#4a5cb0', '#6a88d8', '#98baf6', '#cce0ff'],
  eye: '#2e1828', out: '#2e1620',
};
function bow(L, cx, cy, tones) {
  L.poly([[cx, cy], [cx - 5, cy - 3], [cx - 5, cy + 3]], tones[2]);
  L.poly([[cx, cy], [cx + 5, cy - 3], [cx + 5, cy + 3]], tones[1]);
  L.px(cx - 4, cy - 1, tones[3]); L.px(cx - 3, cy - 1, tones[3]);
  L.rect(cx - 1, cy - 1, 3, 3, tones[2]); L.px(cx - 1, cy - 1, tones[3]);
}
function drawLia(pc, expr, mouth, blink) {
  const out = LI.out;
  part(pc, out, (L) => { ball(L, 8, 31, 5.5, 8, LI.hair); ball(L, 40, 31, 5.5, 8, LI.hair); });
  part(pc, out, (L) => { bow(L, 9, 22, LI.rib); bow(L, 39, 22, LI.rib); });
  part(pc, out, (L) => ball(L, 24, 22, 15, 15, LI.hair));
  part(pc, out, (L) => {
    ball(L, 24, 56, 18, 13, LI.pj);
    for (const [x, y] of [[12, 47], [33, 46], [22, 49]]) { L.px(x, y, '#fff6b0'); L.px(x - 1, y, '#ffe070'); L.px(x + 1, y, '#ffe070'); L.px(x, y - 1, '#ffe070'); L.px(x, y + 1, '#ffe070'); }
  });
  part(pc, out, (L) => { L.rect(21, 34, 7, 9, LI.skin[1]); L.rect(21, 34, 3, 9, LI.skin[2]); });
  part(pc, '#b8a8c8', (L) => { L.ellipse(19.5, 43, 5, 2.5, '#fff8f0'); L.ellipse(28.5, 43, 5, 2.5, '#fff8f0'); L.hline(16, 44, 4, '#e0d8e8'); L.hline(29, 44, 4, '#e0d8e8'); });
  part(pc, out, (L) => ball(L, 24, 25, 12, 11.5, LI.skin, [0.16, 0.38, 0.9]));
  // franja
  part(pc, out, (L) => {
    ball(L, 24, 19, 13.5, 8, LI.hair, null, (x, y) => y <= 18);
    for (const [x0, x1, tip] of [[11, 17, 22], [16, 23, 21], [22, 28, 20], [27, 33, 21], [32, 37, 23]]) L.tri(x0, 18, x1, 18, (x0 + x1) / 2 + 1, tip, LI.hair[2]);
    L.hline(15, 13, 6, LI.hair[3]); L.hline(14, 14, 3, LI.hair[3]);
  });
  const eyes = [{ x: 16, y: 23, w: 5, h: 6, side: -1 }, { x: 27, y: 23, w: 5, h: 6, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'sad', scared: 'wide', surprised: 'big', sleepy: 'sleepy' }[expr] || 'open';
  if (blink && kind !== 'happy') kind = 'closed';
  drawEyes(pc, eyes, kind, { eye: LI.eye, lid: LI.skin[2] });
  if (kind === 'open' || kind === 'sad' || kind === 'big') { pc.px(15, 23, LI.eye); pc.px(32, 23, LI.eye); }
  drawBrows(pc, eyes, expr, LI.hair[1], -1, 1);
  pc.px(24, 29, LI.skin[1]); pc.px(25, 29, LI.skin[1]);
  blush(pc, 15.5, 30.5, 5, 3, '#ff9ab0', expr === 'happy' ? 1 : 0.6);
  blush(pc, 32.5, 30.5, 5, 3, '#ff9ab0', expr === 'happy' ? 1 : 0.6);
  drawMouth(pc, 24, 32, expr, mouth, { line: '#8a3a40', inside: '#5a1a2a', w: 4 });
  if (expr === 'sad' && !blink) { tearDrop(pc, 17, 29, 2); tearDrop(pc, 31, 29, 1); }
  if (expr === 'scared') sweatDrop(pc, 37, 13);
  if (expr === 'sleepy') sleepZ(pc, 38, 9, 4);
  if (expr === 'surprised') bangMark(pc, 41, 6, '#ffffff', '#2a1e48');
}

// =============================================================================
// VÓ CELESTE — avó costureira: coque com agulha e linha dourada, óculos, fita métrica
// =============================================================================
const VO = {
  skin: ['#b87868', '#dea48c', '#f6cfb6', '#fff0e2'], hair: ['#7a7092', '#ada6c4', '#dcd8ea', '#fbfaff'],
  card: ['#4e3080', '#7a52b0', '#a878d8', '#cfa8f2'], blouse: '#fff3e4', tape: '#ffd84a', tapeD: '#b88a18',
  frame: '#b8862a', frameL: '#f0c860', eye: '#3a2438', out: '#34203c', gold: '#ffd23f',
};
function drawVo(pc, expr, mouth, blink) {
  const out = VO.out;
  // agulha no coque + linha dourada
  part(pc, '#3a3a50', (L) => { L.line(5, 3, 20, 14, '#c8ccd8'); L.line(6, 3, 21, 14, '#f4f6ff'); L.px(5, 3, '#ffffff'); });
  pc.curve(6, 4, 1, 9, 4, 15, VO.gold); pc.curve(4, 15, 7, 19, 3, 23, VO.gold);
  part(pc, out, (L) => ball(L, 14, 11, 7, 6.5, VO.hair));
  part(pc, out, (L) => ball(L, 24, 22, 14.5, 14, VO.hair));
  part(pc, out, (L) => {
    ball(L, 24, 57, 19, 14, VO.card);
    L.poly([[18, 42], [30, 42], [24, 50]], VO.blouse);
    L.hline(18, 42, 13, '#e8d4c4');
    // botões do casaco
    for (const y of [46]) { L.px(15, y, VO.card[3]); L.px(33, y, VO.card[3]); }
  });
  // fita métrica no pescoço
  part(pc, '#6a4a10', (L) => {
    for (const x0 of [16, 30]) {
      L.rect(x0, 40, 3, 8, VO.tape);
      for (let y = 41; y < 48; y += 2) L.px(x0, y, VO.tapeD);
    }
  });
  part(pc, out, (L) => { L.rect(20, 34, 8, 7, VO.skin[1]); L.rect(20, 34, 3, 7, VO.skin[2]); });
  part(pc, out, (L) => ball(L, 25, 26, 11, 11, VO.skin, [0.16, 0.38, 0.9]));
  // cabelo da frente (ondas)
  part(pc, out, (L) => {
    ball(L, 24, 19, 13, 7, VO.hair, null, (x, y) => y <= 18 - (x > 24 ? 1 : 0));
    L.curve(13, 18, 18, 14, 24, 17, VO.hair[1]); L.curve(24, 17, 30, 13, 36, 16, VO.hair[1]);
  });
  pc.px(14, 30, '#ffffff'); pc.px(14, 31, '#d8d0e0'); // brinco de pérola
  const eyes = [{ x: 19, y: 25, w: 3, h: 3, side: -1 }, { x: 29, y: 25, w: 3, h: 3, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'open', surprised: 'open', sleepy: 'closed' }[expr] || 'open';
  if (blink) kind = kind === 'happy' ? 'happy' : 'closed';
  if (kind === 'open') for (const e of eyes) { pc.rect(e.x, e.y, 3, 3, VO.eye); pc.px(e.x, e.y, '#ffffff'); if (expr === 'surprised') pc.rect(e.x - 1, e.y - 1, 1, 1, VO.eye); }
  else if (kind === 'happy') for (const e of eyes) { pc.px(e.x, e.y + 2, VO.eye); pc.px(e.x + 1, e.y + 1, VO.eye); pc.px(e.x + 2, e.y + 1, VO.eye); pc.px(e.x + 3, e.y + 2, VO.eye); }
  else for (const e of eyes) { pc.hline(e.x, e.y + 2, 4, VO.eye); pc.px(e.x, e.y + 1, VO.eye); }
  // rugas de sorriso
  pc.px(16, 27, VO.skin[1]); pc.px(16, 29, VO.skin[1]); pc.px(34, 27, VO.skin[1]);
  // sobrancelhas finas
  if (expr === 'sad') { pc.line(18, 22, 21, 21, VO.hair[0]); pc.line(29, 21, 32, 22, VO.hair[0]); }
  else if (expr === 'surprised') { pc.line(18, 20, 21, 20, VO.hair[0]); pc.line(29, 20, 32, 20, VO.hair[0]); }
  else { pc.line(18, 22, 21, 21, VO.hair[1]); pc.line(29, 21, 32, 22, VO.hair[1]); }
  // óculos redondos
  for (const [cx, cy] of [[20.5, 26.5], [30.5, 26.5]]) {
    pc.ring(cx, cy, 3.6, VO.frame);
    pc.px(Math.round(cx - 2), Math.round(cy - 2), '#ffffffb0'); pc.px(Math.round(cx - 1), Math.round(cy - 3), '#ffffff90');
  }
  pc.hline(24, 25, 3, VO.frame); pc.px(24, 25, VO.frameL);
  pc.line(14, 25, 16, 25, VO.frame);
  blush(pc, 17, 31, 5, 2, '#f08a9a', 0.55); blush(pc, 33, 31, 4, 2, '#f08a9a', 0.55);
  pc.px(26, 30, VO.skin[1]);
  drawMouth(pc, 25, 33, expr === 'sleepy' ? 'neutral' : expr, mouth, { line: '#9a4a50', inside: '#5a1e2a', w: 4 });
  if (expr === 'sad' && !blink) tearDrop(pc, 31, 30, 2);
  if (expr === 'sleepy') { // cantando: notinhas
    const n = (x, y) => { pc.rect(x, y + 3, 2, 2, VO.gold); pc.vline(x + 2, y, 4, VO.gold); pc.px(x + 3, y, VO.gold); };
    n(38, 8); n(42, 14);
  }
}

// =============================================================================
// O COSTUREIRO — criatura alta de retalhos escuros, olhos de botão desparelhados,
// dedos-agulha e um rasgo no peito vazando fio roxo
// =============================================================================
const CO = {
  p1: ['#120c1c', '#211830', '#342848', '#4c3c62'], p2: ['#0e0e18', '#1c1c2c', '#2c2e44', '#42465e'],
  p3: ['#180c18', '#2c162e', '#44264a', '#603a66'], coat: ['#0a0812', '#16121e', '#241e30', '#362c46'],
  thread: '#a855ff', threadL: '#dcb0ff', threadD: '#5e22a0', out: '#06030a', void: '#0a0410',
  needle: ['#55556a', '#9a9ab2', '#dcdcec', '#ffffff'], bone: ['#6a5a48', '#bcae96', '#e8dcc8', '#fff8ea'],
  red: ['#4a0e1a', '#8a1e30', '#c83048', '#ff7088'],
};
function drawCostureiro(pc, expr, mouth) {
  const out = CO.out;
  // fios soltos do peito (atrás do casaco não; vêm por cima depois)
  // casaco com gola alta e pontuda
  part(pc, out, (L) => {
    ball(L, 24, 58, 23, 16, CO.coat);
    L.poly([[0, 48], [3, 30], [15, 37], [17, 48]], CO.coat[2]);
    L.poly([[48, 48], [45, 30], [33, 37], [31, 48]], CO.coat[1]);
    L.line(3, 31, 14, 37, CO.threadD); L.line(45, 31, 34, 37, CO.threadD);
    L.line(4, 32, 2, 46, CO.coat[3]);
  });
  // cabeça alta de retalhos (passa da borda de cima)
  part(pc, out, (L) => {
    const reg = (x, y) => (y < 11 + (x - 12) * 0.35 ? (x < 25 - (y * 0.25) ? 0 : 2) : (x > 29 && y > 27 ? 2 : 1));
    ballPatches(L, 24, 16, 12.5, 19.5, [CO.p1, CO.p2, CO.p3], reg);
    seamIn(L, 10, 6.5, 38, 16.3, CO.out, CO.thread, 3);
    seamIn(L, 26, -3, 22, 9, CO.out, CO.thread, 3);
    seamIn(L, 29, 36, 30, 27, CO.out, CO.thread, 3);
    seamIn(L, 30, 27, 38, 27, CO.out, CO.thread, 3);
  });
  // rasgo no peito com fio roxo vazando
  part(pc, out, (L) => {
    L.poly([[21, 40], [24, 38], [27, 41], [26, 44], [28, 48], [20, 48], [22, 44]], CO.void);
    L.px(23, 41, '#3a1458'); L.px(24, 43, '#5a1e88');
  });
  pc.curve(23, 41, 18, 44, 20, 48, CO.thread); pc.curve(24, 42, 27, 45, 25, 48, CO.threadL);
  pc.curve(25, 41, 31, 43, 30, 48, CO.thread);
  for (const [x, y] of [[20, 41], [27, 42], [21, 46], [28, 46]]) { pc.px(x, y, CO.thread); }
  // mão com dedos-agulha
  part(pc, out, (L) => {
    const tips = [[34, 20], [38, 16], [42, 17], [46, 22]];
    tips.forEach(([tx, ty], i) => {
      const bx = 36 + i * 2.4, by = 39;
      L.line(bx, by, tx, ty, CO.needle[1]); L.line(bx - 1, by, tx - 1, ty + 1, CO.needle[3]);
      L.px(tx, ty, CO.needle[3]);
      const ex = Math.round(bx + (tx - bx) * 0.25), ey = Math.round(by + (ty - by) * 0.25);
      L.px(ex, ey, CO.needle[0]);
    });
    ball(L, 40, 42, 6, 4.5, CO.p3);
    L.line(36, 42, 44, 41, CO.out);
  });
  pc.curve(37, 33, 30, 38, 33, 44, CO.thread);
  // olhos de botão desparelhados (não piscam)
  const glow = expr === 'angry';
  if (glow) { pc.circle(18, 16, 6.5, '#a855ff55'); pc.circle(30, 19, 4.8, '#a855ff55'); }
  pc.circle(18, 16, 5.6, CO.out); pc.circle(30, 19, 4, CO.out);
  sewButton(pc, 18, 16, 4.6, CO.bone[2], CO.bone[0], CO.bone[3], CO.thread, 4);
  sewButton(pc, 30, 19, 3.2, CO.red[2], CO.red[0], CO.red[3], CO.threadL, 2);
  if (expr === 'sad') { pc.curve(19, 21, 17, 26, 19, 31, CO.thread); pc.px(19, 31, CO.threadL); }
  if (expr === 'angry') { line2(pc, 12, 9, 22, 12, CO.out); line2(pc, 26, 14, 34, 12, CO.out); }
  if (expr === 'surprised') { pc.line(13, 8, 22, 8, CO.out); pc.line(27, 12, 33, 12, CO.out); }
  // boca costurada
  const curveY = { neutral: 1.2, happy: 3.5, angry: -1.4, sad: -2.2, surprised: 0 }[expr] ?? 1.2;
  const x0 = 13, x1 = 33, yb = 28;
  const yAt = (x) => { const t = (x - x0) / (x1 - x0); return yb - (x - x0) * 0.08 + curveY * 4 * t * (1 - t) * (expr === 'happy' ? 1 : 1); };
  const gap = mouth ? 2 : expr === 'surprised' ? 2 : 0;
  if (gap) {
    for (let x = x0 + 2; x <= x1 - 2; x++) {
      const y = Math.round(yAt(x));
      const g = Math.round(gap * Math.sin(((x - x0) / (x1 - x0)) * Math.PI) + (expr === 'surprised' && mouth ? 1 : 0));
      pc.vline(x, y - g, g * 2 + 1, CO.void);
      if (g > 0 && (x % 4 === 1)) pc.vline(x, y - g, g * 2 + 1, '#3a1458');
    }
  }
  for (let x = x0; x <= x1; x++) {
    const y = Math.round(yAt(x));
    const g = gap ? Math.round(gap * Math.sin(((x - x0) / (x1 - x0)) * Math.PI)) : 0;
    pc.px(x, y - g, CO.out); pc.px(x, y + g, CO.out);
    if (x % 3 === 0 && x > x0 && x < x1) { pc.vline(x, y - g - 1, g * 2 + 3, CO.thread); pc.px(x, y - g - 1, CO.threadL); }
  }
  if (expr === 'angry') { pc.px(13, 27, CO.thread); pc.px(33, 25, CO.thread); }
}

// =============================================================================
// FIAPO — o boneco de pano da Vó criança (mesmos botões desparelhados)
// =============================================================================
const FI = {
  cloth: ['#9a7656', '#c8a680', '#e8d2b2', '#fff3de'], yarn: ['#6e2414', '#a43e26', '#d0603a', '#f28c5c'],
  shirt: ['#34508e', '#5272b6', '#7896dc', '#a8c0f6'], thread: '#7a4a2a', gold: '#ffd23f', out: '#3a2418',
  bone: ['#6a5a48', '#bcae96', '#ece2d0', '#fffaf0'], red: ['#5a1020', '#9a2236', '#d03a50', '#ff8094'],
};
function drawFiapo(pc, expr, mouth) {
  const out = FI.out;
  part(pc, out, (L) => {
    ball(L, 24, 52, 18, 11, FI.shirt);
    L.rect(26, 44, 5, 4, '#e8c84a'); L.strokeRect(26, 44, 5, 4, '#a07820');
    L.px(28, 43, FI.gold); L.px(28, 48, FI.gold);
  });
  part(pc, out, (L) => { L.rect(20, 36, 8, 6, FI.cloth[1]); L.rect(20, 36, 3, 6, FI.cloth[2]); });
  dashedArc(pc, 24, 41, 5, 1.2, 0, 180, FI.thread, 1, 1);
  part(pc, out, (L) => {
    ball(L, 24, 24, 13, 12.5, FI.cloth);
    // remendo xadrez azul na bochecha
    for (let y = 27; y < 32; y++) for (let x = 31; x < 36; x++) L.px(x, y, ((x + y) & 1) ? '#8ab0e8' : '#c8dcff');
    L.strokeRect(30, 26, 7, 7, '#5a78b0');
    L.px(30, 28, FI.thread); L.px(36, 30, FI.thread); L.px(32, 26, FI.thread); L.px(34, 32, FI.thread);
  });
  // cabelo de lã (laçadas)
  part(pc, out, (L) => {
    for (let a = 190; a <= 350; a += 20) {
      const r = (a * Math.PI) / 180;
      const x = 24 + Math.cos(r) * 11.5, y = 23 + Math.sin(r) * 11.5;
      ball(L, x, y, 3.2, 3.2, FI.yarn);
      L.px(Math.round(x), Math.round(y), FI.yarn[0]);
    }
    ball(L, 23, 11, 3.4, 3.4, FI.yarn);
  });
  const btn = expr === 'happy' ? 0 : 0;
  pc.circle(18, 24 + btn, 4.1, FI.out); pc.circle(30, 24, 3.1, FI.out);
  sewButton(pc, 18, 24, 3.6, FI.bone[2], FI.bone[0], FI.bone[3], FI.thread, 4);
  sewButton(pc, 30, 24, 2.6, FI.red[2], FI.red[0], FI.red[3], FI.gold, 2);
  if (expr === 'sad') { pc.line(13, 20, 17, 18, FI.out); pc.line(28, 18, 32, 20, FI.out); }
  if (expr === 'surprised') { pc.line(14, 17, 19, 17, FI.out); pc.line(28, 18, 32, 18, FI.out); }
  blush(pc, 16, 30, 5, 2, '#ff9a9a', expr === 'happy' ? 1 : 0.6);
  drawMouth(pc, 24, 31, expr, mouth, { line: FI.thread, inside: '#4a2010', w: 5 });
  if (expr === 'sad') { pc.curve(18, 28, 16, 32, 18, 36, FI.gold); pc.curve(30, 27, 32, 31, 30, 35, FI.gold); }
}

// =============================================================================
// SR. BOTÃO — ursinho velho de um olho só (botão) com monóculo, mentor rabugento
// =============================================================================
const BO = {
  fur: ['#58321e', '#865632', '#ae7846', '#d29c64'], muz: ['#a47650', '#cea476', '#ead0a2', '#fff0d2'],
  inner: '#e2a084', nose: '#2a1810', btn: ['#2e120a', '#5e2618', '#8e4228', '#c47852'], thread: '#f0d8a0',
  scarf: ['#1e4a22', '#2e7434', '#4ca050', '#86d08a'], gold: '#e8b840', goldL: '#fff0a0', out: '#2a160c',
};
function drawBotao(pc, expr, mouth, blink) {
  const out = BO.out;
  part(pc, out, (L) => {
    ball(L, 11, 11, 6, 6, BO.fur); L.ellipse(11.5, 11.5, 3.2, 3.2, BO.inner);
    ball(L, 37, 10, 6, 6, BO.fur); L.ellipse(37, 10.5, 3.2, 3.2, BO.inner);
    // enchimento saindo da orelha rasgada
    L.circle(41, 6, 1.6, '#fffaf0'); L.px(42, 5, '#e8e0d8');
  });
  part(pc, out, (L) => {
    ball(L, 24, 57, 19, 14, BO.fur);
  });
  // cachecol listrado
  part(pc, out, (L) => {
    L.poly([[10, 38], [38, 38], [37, 44], [11, 44]], BO.scarf[2]);
    for (let x = 12; x < 37; x += 4) L.vline(x, 38, 6, BO.scarf[1]);
    L.hline(11, 38, 27, BO.scarf[3]);
    L.poly([[12, 42], [17, 42], [16, 48], [10, 48]], BO.scarf[1]);
    L.vline(13, 43, 5, BO.scarf[3]);
  });
  part(pc, out, (L) => {
    ball(L, 24, 23, 15, 13.5, BO.fur);
    // remendo xadrez na testa
    for (let y = 12; y < 18; y++) for (let x = 12; x < 19; x++) L.px(x, y, (x % 3 === 0 || y % 3 === 0) ? '#4a7a3a' : '#7aa860');
    for (const [x, y] of [[11, 13], [11, 16], [19, 12], [19, 15], [13, 11], [16, 11], [13, 18], [16, 18]]) L.px(x, y, BO.thread);
  });
  part(pc, mixColor(BO.fur[0], BO.out, 0.4), (L) => ball(L, 25, 30, 8.5, 6.5, BO.muz));
  // olho de botão + cicatriz em X
  pc.circle(17, 22, 4.1, BO.out);
  sewButton(pc, 17, 22, 3.6, BO.btn[2], BO.btn[0], BO.btn[3], BO.thread, 4);
  const xc = '#1e0e08';
  pc.line(30, 20, 34, 24, xc); pc.line(34, 20, 30, 24, xc); pc.px(31, 20, BO.thread); pc.px(33, 24, BO.thread);
  // monóculo dourado com corrente
  pc.ring(17, 22, 5.6, BO.gold);
  pc.px(13, 18, BO.goldL);
  if (blink) { pc.line(14, 24, 19, 19, '#ffffffc0'); pc.line(15, 25, 20, 20, '#ffffff80'); }
  else { pc.px(14, 20, '#ffffff90'); pc.px(15, 19, '#ffffff90'); }
  pc.curve(14, 27, 9, 33, 12, 40, BO.gold);
  // sobrancelhas peludas
  const browC = BO.fur[0];
  const br = {
    neutral: [[12, 15, 21, 17], [28, 17, 36, 16]], happy: [[12, 15, 21, 14], [28, 15, 36, 16]],
    sad: [[12, 17, 21, 14], [28, 14, 36, 17]], angry: [[12, 14, 21, 18], [28, 18, 36, 14]], surprised: [[12, 13, 21, 12], [28, 13, 36, 13]],
  }[expr] || [[12, 15, 21, 17], [28, 17, 36, 16]];
  for (const [a, b, c, d] of br) { line2(pc, a, b, c, d, browC); pc.line(a, b - 1, c - 2, d - 1, BO.fur[1]); }
  // nariz e boca
  part(pc, null, (L) => { L.ellipse(25.5, 27, 3.5, 2.2, BO.nose); L.px(24, 26, '#7a5a4a'); L.px(25, 26, '#5a3a2a'); });
  pc.vline(25, 29, 2, BO.out);
  const mexpr = expr === 'neutral' ? 'neutral' : expr;
  if (mouth || expr === 'surprised' || expr === 'happy') drawMouth(pc, 25, 31, mexpr, mouth, { line: BO.out, inside: '#4a1a10', w: 5 });
  else if (expr === 'angry' || expr === 'sad') { pc.line(21, 33, 25, 31, BO.out); pc.line(25, 31, 29, 33, BO.out); }
  else { pc.line(21, 31, 24, 32, BO.out); pc.line(26, 32, 29, 31, BO.out); pc.px(25, 31, BO.out); }
  if (expr === 'angry') angerMark(pc, 38, 16);
  if (expr === 'surprised') bangMark(pc, 41, 18, '#ffffff', '#1a2a10');
}

// =============================================================================
// PIP — ratinho de corda medroso (chave de corda nas costas)
// =============================================================================
const PI = {
  fur: ['#565c74', '#868ea6', '#b6becf', '#e4e8f2'], ear: '#ffb0c8', earD: '#e080a0', nose: '#ff6f98',
  key: ['#7a4e0c', '#b8841e', '#e8c040', '#fff0a0'], eye: '#120a18', out: '#262638', belly: '#f2f4fa',
};
function drawPip(pc, expr, mouth, blink) {
  const out = PI.out;
  const shake = expr === 'scared' ? 1 : 0;
  // chave de corda
  part(pc, out, (L) => {
    L.rect(6, 38, 9, 3, PI.key[1]); L.hline(6, 38, 9, PI.key[3]);
    for (const cy of [33, 45]) ball(L, 7, cy, 4, 3.8, PI.key);
    L.circle(7.5, 33, 1.4, PI.key[0]); L.circle(7.5, 45, 1.4, PI.key[0]);
  });
  part(pc, out, (L) => {
    ball(L, 21, 52, 15, 11, PI.fur);
    ball(L, 25, 52, 7, 8, [PI.fur[2], PI.belly, '#ffffff'], [0.3, 0.85]);
    seamIn(L, 14, 41, 14, 48, PI.fur[0], '#ff9ab8', 3);
  });
  part(pc, out, (L) => {
    ball(L, 12 - shake, 13, 8, 8, PI.fur); L.ellipse(12.5 - shake, 13.5, 5, 5, PI.ear); L.ellipse(13.5 - shake, 14.5, 3, 3, PI.earD);
    ball(L, 33 + shake, 12, 8, 8, PI.fur); L.ellipse(33 + shake, 12.5, 5, 5, PI.ear); L.ellipse(34 + shake, 13.5, 3, 3, PI.earD);
  });
  part(pc, out, (L) => {
    ball(L, 22, 27, 12.5, 11, PI.fur);
    ball(L, 31, 31, 7, 4.8, [PI.fur[1], PI.fur[2], PI.fur[3]], [0.3, 0.8]);
  });
  part(pc, null, (L) => { ball(L, 38, 30, 2.2, 2, ['#c84870', PI.nose, '#ffb0c8']); });
  // bigodes
  for (const [a, b, c, d] of [[34, 32, 45, 30], [34, 33, 45, 34], [12, 31, 3, 30], [12, 32, 3, 33]]) pc.line(a, b, c, d, '#f4f6fc');
  const eyes = [{ x: 16, y: 21, w: 5, h: 7, side: -1 }, { x: 26, y: 21, w: 4, h: 7, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'sad', scared: 'wide', surprised: 'big' }[expr] || 'open';
  if (blink && kind !== 'happy') kind = 'closed';
  drawEyes(pc, eyes, kind, { eye: PI.eye, lid: PI.fur[2] });
  drawBrows(pc, eyes, expr, PI.fur[0], -1, 1);
  blush(pc, 14, 28, 4, 2, '#ff9ab8', 0.7);
  // boca + dentinhos
  const my = 35;
  if (mouth) { pc.rect(31, my, 5, 2, '#5a1a2a'); pc.px(32, my, '#ffffff'); pc.px(33, my, '#ffffff'); }
  else if (expr === 'happy') { pc.line(30, my, 32, my + 1, out); pc.line(32, my + 1, 35, my, out); pc.px(32, my + 2, '#ffffff'); pc.px(33, my + 2, '#ffffff'); }
  else if (expr === 'sad' || expr === 'scared') { pc.line(30, my + 1, 33, my, out); pc.line(33, my, 35, my + 1, out); }
  else if (expr === 'surprised') { pc.ring(33, my + 1, 1.6, out); }
  else { pc.hline(31, my, 4, out); pc.px(32, my + 1, '#ffffff'); pc.px(33, my + 1, '#ffffff'); }
  if (expr === 'scared') { sweatDrop(pc, 38, 18); for (const x of [5, 7]) pc.vline(x, 18, 4, '#5a7ab0'); }
  if (expr === 'sad' && !blink) tearDrop(pc, 17, 28, 2);
  if (expr === 'surprised') bangMark(pc, 41, 18, '#ffffff', '#2a3448');
}

// =============================================================================
// AGULHETA — porco-espinho almofada-de-alfinetes, comerciante tagarela
// =============================================================================
const AG = {
  cush: ['#701430', '#a8283f', '#de4858', '#ff7a84'], face: ['#ae8866', '#d8b88e', '#f8e0c0', '#fff4e4'],
  leaf: ['#1e5a28', '#2e8a3a', '#4ab858'], nose: '#2a1418', eye: '#1a0e14',
  shaft: '#cfd6e6', shaftD: '#7a8098', heads: ['#ffd23f', '#5ab0ff', '#ffffff', '#7ae07a', '#ff9ad8', '#b07aff', '#ffd23f', '#5ab0ff', '#ffffff'],
  gold: ['#8a5a10', '#c88a20', '#ffd23f', '#fff4a0'], out: '#3a0e1c',
};
function drawAgulheta(pc, expr, mouth, blink) {
  const out = AG.out;
  // alfinetes (atrás da almofada só a base é escondida)
  const pins = [];
  [196, 214, 232, 250, 268, 286, 304, 160, 178].forEach((a, i) => {
    const r = (a * Math.PI) / 180;
    pins.push([19 + Math.cos(r) * 15.5, 27 + Math.sin(r) * 14.5, Math.cos(r), Math.sin(r), AG.heads[i]]);
  });
  part(pc, out, (L) => {
    for (const [x, y, nx, ny] of pins) { L.line(Math.round(x), Math.round(y), Math.round(x + nx * 5), Math.round(y + ny * 5), AG.shaft); }
  });
  part(pc, out, (L) => {
    ball(L, 19, 28, 17, 16, AG.cush);
    L.curve(19, 12, 5, 24, 8, 44, AG.cush[1]); L.curve(19, 12, 20, 28, 18, 46, AG.cush[1]); L.curve(19, 12, 33, 22, 30, 44, AG.cush[1]);
  });
  part(pc, out, (L) => {
    for (const [x, y, nx, ny, c] of pins) { const hx = x + nx * 5.5, hy = y + ny * 5.5; L.circle(hx, hy, 1.7, c); L.px(Math.round(hx - 1), Math.round(hy - 1), '#ffffff'); }
  });
  // folhinhas no topo (almofada-tomate)
  part(pc, out, (L) => {
    for (const [dx, dy] of [[-5, 1], [5, 1], [0, -3], [-3, -2], [3, -2]]) L.tri(19, 12, 19 + dx * 1.2 - 1, 12 + dy, 19 + dx * 1.2 + 1, 12 + dy + 1, AG.leaf[1]);
    L.rect(18, 9, 2, 3, AG.leaf[0]); L.px(18, 9, AG.leaf[2]);
  });
  // rosto
  part(pc, out, (L) => {
    ball(L, 32, 29, 10, 9.5, AG.face);
    ball(L, 40, 32, 5.5, 3.6, AG.face, [0.3, 0.55, 0.9]);
    ball(L, 28, 19, 2.6, 2.6, AG.face); L.px(28, 19, '#f0a0b0');
  });
  part(pc, null, (L) => { L.ellipse(45, 31, 2.2, 1.9, AG.nose); L.px(44, 30, '#7a5a60'); });
  // flor no cabelo
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) pc.circle(24 + dx, 17 + dy, 1.4, '#fff8e0');
  pc.px(24, 17, '#ffb020'); pc.px(23, 17, '#ffd23f');
  // colar com moeda dourada
  pc.curve(26, 38, 31, 42, 37, 37, AG.gold[1]);
  part(pc, AG.gold[0], (L) => { ball(L, 31, 43, 2.6, 2.6, AG.gold); L.px(31, 43, AG.gold[0]); });
  const eyes = [{ x: 28, y: 24, w: 4, h: 5, side: -1 }, { x: 36, y: 24, w: 3, h: 5, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'sad', surprised: 'big', angry: 'angry' }[expr] || 'open';
  if (blink && kind !== 'happy') kind = 'closed';
  drawEyes(pc, eyes, kind, { eye: AG.eye, lid: AG.face[2] });
  if (kind !== 'closed' && kind !== 'happy') { pc.px(27, 23, AG.eye); pc.px(26, 22, AG.eye); pc.px(39, 23, AG.eye); }
  drawBrows(pc, eyes, expr, AG.face[0], -1, 1);
  blush(pc, 28, 31, 4, 2, '#ff8aa0', expr === 'happy' ? 1 : 0.7);
  drawMouth(pc, 37, 34, expr === 'neutral' ? 'determined' : expr, mouth, { line: '#5a2028', inside: '#4a1020', w: 5 });
  if (expr === 'happy') { // brilho de cobiça
    for (const [x, y] of [[41, 20], [44, 24]]) { pc.px(x, y, '#ffffff'); pc.px(x - 1, y, '#ffe680'); pc.px(x + 1, y, '#ffe680'); pc.px(x, y - 1, '#ffe680'); pc.px(x, y + 1, '#ffe680'); }
  }
  if (expr === 'angry') angerMark(pc, 40, 16);
}

// =============================================================================
// CAPITÃ BOLHA — pata de borracha capitã de navio de brinquedo
// =============================================================================
const CB = {
  duck: ['#c07418', '#eaa820', '#ffd84a', '#fff4a6'], beak: ['#a03a10', '#d85c18', '#ff8a2a', '#ffbc70'],
  hat: ['#0c142c', '#18224a', '#2a3a6c', '#4a5c9c'], crown: ['#8a94b4', '#ccd4ea', '#f2f4ff', '#ffffff'],
  gold: ['#8a5a10', '#c88a20', '#ffd23f', '#fff4a0'], scarf: ['#7a1420', '#c02a30', '#e84a40', '#ff806a'],
  eye: '#120a18', out: '#3a2008',
};
function drawBolha(pc, expr, mouth, blink) {
  const out = CB.out;
  part(pc, out, (L) => ball(L, 22, 55, 17, 12, CB.duck));
  part(pc, out, (L) => {
    L.poly([[14, 41], [32, 41], [24, 48]], CB.scarf[2]);
    L.hline(14, 41, 19, CB.scarf[3]);
    L.poly([[27, 43], [33, 47], [30, 48]], CB.scarf[1]);
    L.rect(22, 41, 4, 3, CB.scarf[1]);
  });
  part(pc, out, (L) => {
    ball(L, 22, 27, 13, 12, CB.duck);
    L.rect(13, 19, 3, 2, '#ffffff'); L.px(13, 21, '#ffffff');
  });
  // bico
  part(pc, out, (L) => {
    if (mouth) {
      ball(L, 34, 34, 7.5, 2.8, CB.beak);
      L.ellipse(33, 32.5, 6, 1.6, '#6a1a10');
      ball(L, 35, 29.5, 8.5, 3.3, CB.beak);
    } else {
      ball(L, 34, 32.5, 7, 2.2, CB.beak);
      ball(L, 35, 29.5, 8.5, 3.3, CB.beak);
      L.hline(29, 32, 12, CB.beak[0]);
    }
    L.px(39, 28, CB.beak[0]);
  });
  // quepe de capitã
  part(pc, out, (L) => {
    ball(L, 21, 11.5, 14, 6, CB.crown, null, (x, y) => y <= 14);
    L.rect(8, 13, 27, 4, CB.hat[2]); L.hline(8, 13, 27, CB.hat[3]); L.hline(8, 16, 27, CB.hat[1]);
    L.hline(8, 14, 27, CB.gold[1]);
    ball(L, 31, 18, 8.5, 2.2, [CB.hat[0], CB.hat[1], CB.hat[2]], [0.4, 0.75]);
  });
  part(pc, CB.gold[0], (L) => { ball(L, 21, 14.5, 2.4, 2.4, CB.gold); L.vline(21, 13, 3, CB.hat[1]); L.hline(20, 14, 3, CB.hat[1]); });
  const eyes = [{ x: 17, y: 21, w: 4, h: 6, side: -1 }, { x: 26, y: 21, w: 4, h: 6, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'sad', angry: 'angry', determined: 'determined', surprised: 'big' }[expr] || 'open';
  if (blink && kind !== 'happy') kind = 'closed';
  drawEyes(pc, eyes, kind, { eye: CB.eye, lid: CB.duck[2] });
  drawBrows(pc, eyes, expr, CB.duck[0], 0, 1);
  blush(pc, 16, 29, 4, 2, '#ff9a6a', expr === 'happy' ? 1 : 0.65);
  if (expr === 'sad' && !blink) tearDrop(pc, 18, 27, 2);
  if (expr === 'angry') angerMark(pc, 38, 20);
  if (expr === 'surprised') bangMark(pc, 41, 19, '#ffffff', '#0e2a48');
  if (expr === 'determined') { pc.px(43, 22, '#ffffff'); pc.px(42, 22, '#fff4a0'); pc.px(44, 22, '#fff4a0'); pc.px(43, 21, '#fff4a0'); pc.px(43, 23, '#fff4a0'); }
}

// =============================================================================
// TIQUE-TAQUE — passarinho de relógio cuco, saindo da portinha na mola
// =============================================================================
const TT = {
  wood: ['#3a1a0c', '#653220', '#8a4a2a', '#b06a3a'], roof: ['#24100a', '#43200f', '#5e301a', '#7e4424'],
  hole: '#1a0a04', bird: ['#9a4412', '#dc7428', '#ffb84f', '#ffe08a'], belly: '#fff4dc',
  beak: '#ffd23f', beakD: '#c08a10', cheek: '#ff5a5a', eye: '#1a0e0a', out: '#1e0e06',
  spring: ['#6a6a80', '#b0b0c8', '#f0f0ff'], brass: '#e8b840',
};
function drawTique(pc, expr, mouth, blink) {
  const out = TT.out;
  // casinha do cuco
  part(pc, out, (L) => {
    L.poly([[4, 48], [4, 17], [24, 5], [44, 17], [44, 48]], TT.wood[2]);
    for (let y = 18; y < 48; y += 4) L.hline(5, y, 39, TT.wood[1]);
    L.vline(5, 17, 31, TT.wood[3]);
    // abertura em arco
    L.rect(14, 22, 20, 26, TT.hole); L.ellipse(24, 22, 10, 7, TT.hole);
    L.hline(14, 47, 20, TT.hole);
  });
  // portinhas abertas
  part(pc, out, (L) => {
    L.poly([[8, 19], [14, 17], [14, 46], [8, 44]], TT.wood[3]); L.vline(9, 21, 22, TT.wood[2]); L.px(12, 32, TT.brass);
    L.poly([[34, 17], [40, 19], [40, 44], [34, 46]], TT.wood[1]); L.vline(38, 21, 22, TT.wood[0]); L.px(36, 32, TT.brass);
  });
  // telhado entalhado
  part(pc, out, (L) => {
    L.thickLine(1, 18, 24, 3, 1.6, TT.roof[2]); L.thickLine(24, 3, 47, 18, 1.6, TT.roof[1]);
    L.line(2, 16, 24, 1, TT.roof[3]);
    for (let i = 0; i < 6; i++) { L.circle(4 + i * 3.6, 19.5 - i * 2.4, 1.2, TT.roof[0]); L.circle(44 - i * 3.6, 19.5 - i * 2.4, 1.2, TT.roof[0]); }
    L.circle(24, 4, 2, TT.brass); L.px(23, 3, '#fff0a0');
  });
  // mola
  for (let y = 38; y < 48; y += 2) { pc.line(20, y, 28, y + 1, TT.spring[1]); pc.px(20, y, TT.spring[2]); pc.px(28, y + 1, TT.spring[0]); }
  // passarinho
  part(pc, out, (L) => {
    ball(L, 24, 33, 8, 6.5, TT.bird);
    L.ellipse(26, 35, 4, 3.5, TT.belly);
    L.ellipse(19.5, 32.5, 4, 3, TT.bird[1]); L.line(17, 33, 21, 31, TT.bird[0]);
    ball(L, 24, 22, 7.5, 7, TT.bird);
    // topete
    L.line(22, 15, 20, 11, TT.bird[1]); L.line(24, 15, 24, 10, TT.bird[2]); L.line(26, 15, 28, 12, TT.bird[1]);
  });
  part(pc, out, (L) => {
    if (mouth) { L.tri(30, 20, 38, 21, 30, 23, TT.beak); L.tri(30, 24, 36, 26, 30, 26, TT.beakD); }
    else { L.tri(30, 21, 38, 23, 30, 25, TT.beak); L.line(31, 23, 37, 23, TT.beakD); }
  });
  // olhos pintados
  const eyeAt = expr === 'confused' && !blink ? [[18, 19], [26, 19]] : [[19, 19], [25, 19]];
  for (const [x, y] of eyeAt) {
    if (blink && expr !== 'happy') { pc.hline(x, y + 2, 4, TT.eye); continue; }
    switch (expr) {
      case 'happy': pc.line(x, y + 3, x + 1, y + 1, TT.eye); pc.line(x + 2, y + 1, x + 3, y + 3, TT.eye); break;
      case 'confused': { // espiral
        oval(pc, x - 1, y - 1, 6, 6, '#ffffff');
        const sp = ['.###.', '#...#', '#.#.#', '#..#.', '.##..'];
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (sp[j][i] === '#') pc.px(x - 1 + i, y - 1 + j, TT.eye);
        break;
      }
      case 'surprised': oval(pc, x - 1, y - 1, 6, 6, TT.eye); oval(pc, x, y, 4, 4, '#ffffff'); pc.px(x + 2, y + 2, TT.eye); break;
      case 'sad': oval(pc, x, y, 4, 4, '#ffffff'); pc.rect(x + 1, y + 2, 2, 2, TT.eye); pc.line(x - 1, y - 1 + (x < 22 ? 1 : 0), x + 3, y - 1 + (x < 22 ? 0 : 1), TT.wood[0]); break;
      default: oval(pc, x, y, 4, 4, '#ffffff'); pc.rect(x + 1, y + 1, 2, 2, TT.eye); pc.px(x + 1, y + 1, '#ffffff');
    }
  }
  blush(pc, 20, 25, 3, 2, TT.cheek, 1); blush(pc, 28, 25, 2, 2, TT.cheek, 1);
  if (expr === 'confused') questionMark(pc, 39, 6, '#ffffff', '#2a1838');
  if (expr === 'surprised') bangMark(pc, 41, 6, '#ffffff', '#2a1838');
  if (expr === 'sad' && !blink) tearDrop(pc, 21, 24, 2);
}

// =============================================================================
// LUZINHA — vagalume de pelúcia (luz noturna), barriguinha que brilha
// =============================================================================
const LU = {
  body: ['#22184a', '#3a2c72', '#5a4aa2', '#8070ca'], glow: ['#e0a828', '#ffd84a', '#fff3a0', '#ffffff'],
  dim: ['#7a6438', '#a08a4a', '#c8b878', '#e8dcb0'], eye: '#0e0a1e', out: '#120c28',
};
function drawLuzinha(pc, expr, mouth, blink) {
  const out = LU.out;
  const dim = expr === 'sad' || expr === 'sleepy';
  const G = dim ? LU.dim : LU.glow;
  // asas translúcidas
  for (const [cx, cy] of [[10, 26], [38, 26]]) {
    pc.ellipse(cx, cy, 6, 9, '#d8f0ff70');
    pc.ellipseOutline(cx, cy, 6, 9, '#ffffffc0');
    pc.line(cx, cy - 6, cx, cy + 6, '#ffffff60');
  }
  // brilho em volta da barriga
  if (!dim) { pc.circle(25, 41, 15, '#fff3a022'); pc.circle(25, 41, 12, '#fff3a033'); }
  else pc.circle(25, 41, 12, '#e8dcb018');
  part(pc, out, (L) => {
    ball(L, 25, 42, 11, 8.5, G, [0.25, 0.5, 0.9]);
    for (const y of [38, 43]) for (let x = 14; x < 37; x++) if (L.getU32(x, y) >>> 24 && bay(x, y) < 0.6) L.px(x, y, G[1]);
  });
  // antenas
  part(pc, out, (L) => {
    L.curve(20, 12, 17, 6, 13, 4, LU.body[1]); L.curve(28, 12, 31, 6, 35, 4, LU.body[1]);
    ball(L, 13, 4, 2.3, 2.3, G); ball(L, 35, 4, 2.3, 2.3, G);
  });
  part(pc, out, (L) => {
    ball(L, 24, 21, 12, 11, LU.body);
    L.ellipse(24, 25, 8, 5, LU.body[3]);
    L.ellipse(24, 25.5, 7, 4, '#9a8ad8');
  });
  const eyes = [{ x: 16, y: 18, w: 5, h: 7, side: -1 }, { x: 27, y: 18, w: 5, h: 7, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'sad', scared: 'wide', surprised: 'big', sleepy: 'sleepy' }[expr] || 'open';
  if (blink && kind !== 'happy') kind = 'closed';
  drawEyes(pc, eyes, kind, { eye: LU.eye, lid: LU.body[2], white: '#fffbe8' });
  drawBrows(pc, eyes, expr, LU.body[0], 0, 1);
  blush(pc, 15, 26, 4, 2, '#ff8fc8', 0.8); blush(pc, 33, 26, 4, 2, '#ff8fc8', 0.8);
  drawMouth(pc, 24, 27, expr, mouth, { line: LU.out, inside: '#3a1030', w: 4 });
  if (expr === 'scared') sweatDrop(pc, 37, 11);
  if (expr === 'sad' && !blink) tearDrop(pc, 17, 25, 2);
  if (expr === 'sleepy') sleepZ(pc, 38, 12, 4, '#fff3a0', '#2a2050');
}

// =============================================================================
// COELHO SEM ROSTO — rosto arrancado (enchimento à mostra); depois de vencido,
// o Tico costura um retalho com olhos de botão (expressões happy/sad/surprised/confused)
// =============================================================================
const CL = {
  fur: ['#76647a', '#a696a8', '#d0c2cc', '#f0e6ee'], inner: '#e8a8b8', void: '#140c18',
  stuff: ['#a8a0b4', '#dcd6e2', '#faf8fc'], thread: '#ece4ee', patch: ['#a49470', '#ccbc94', '#ece0bc', '#fff8e2'],
  gold: '#ffd23f', btnA: ['#163464', '#2a5aa0', '#5a9ae8', '#a8d0ff'], btnB: ['#5a1434', '#a02a5a', '#e04a8a', '#ffa0c8'],
  ribbon: ['#344e70', '#56769a', '#7a9aba', '#a4c2da'], red: '#ff3a5a', out: '#281c28',
};
function drawCoelho(pc, expr, mouth) {
  const out = CL.out;
  const mended = expr === 'happy' || expr === 'sad' || expr === 'surprised' || expr === 'confused';
  // orelhas (uma em pé, outra dobrada e rasgada)
  part(pc, out, (L) => {
    ball(L, 15, 3, 4.6, 13, CL.fur); L.ellipse(15.5, 4, 2, 10, CL.inner);
    ball(L, 32, 6, 4.6, 9, CL.fur); ball(L, 39, 6, 6.5, 3.6, CL.fur); L.ellipse(39, 6.5, 4.5, 1.6, CL.inner);
  });
  crossStitches(pc, 34, 9, 36, 4, 2, CL.thread);
  part(pc, out, (L) => ball(L, 24, 57, 19, 14, CL.fur));
  part(pc, out, (L) => {
    L.poly([[24, 41], [15, 37], [15, 45]], CL.ribbon[2]); L.poly([[24, 41], [33, 37], [33, 45]], CL.ribbon[1]);
    L.rect(22, 39, 5, 5, CL.ribbon[2]); L.px(22, 39, CL.ribbon[3]);
    L.line(23, 44, 20, 48, CL.ribbon[1]); L.line(26, 44, 29, 48, CL.ribbon[0]);
  });
  part(pc, out, (L) => {
    ball(L, 24, 25, 14.5, 13, CL.fur);
    seamIn(L, 12, 35, 18, 38, CL.fur[0], CL.thread, 3);
  });
  if (!mended) {
    // buraco irregular com enchimento
    part(pc, null, (L) => {
      for (let y = 15; y < 38; y++) for (let x = 13; x < 37; x++) {
        const dx = (x + 0.5 - 25) / 9.5, dy = (y + 0.5 - 26) / 8.5;
        const a = Math.atan2(dy, dx);
        const r = Math.hypot(dx, dy) * (1 + 0.13 * Math.sin(a * 7 + 1) + 0.07 * Math.sin(a * 13));
        if (r < 1) L.px(x, y, r > 0.86 ? '#5a4858' : CL.void);
      }
      for (const [x, y, r] of [[20, 30, 3], [29, 23, 2.6], [30, 31, 2.4], [22, 22, 1.8]]) ball(L, x, y, r, r, CL.stuff);
    });
    for (const [x0, y0, x1, y1] of [[20, 34, 19, 40], [26, 35, 27, 39], [31, 33, 33, 37]]) pc.curve(x0, y0, x0 + 2, (y0 + y1) / 2, x1, y1, CL.thread);
    if (expr === 'angry') {
      for (const [x, y] of [[21, 25], [29, 26]]) { pc.circle(x, y, 2.2, '#ff3a5a55'); pc.rect(x - 1, y, 2, 1, CL.red); pc.px(x, y, '#ffd0d8'); }
      pc.line(10, 15, 13, 18, '#d8c8d0'); pc.line(38, 14, 35, 18, '#d8c8d0');
    }
  } else {
    // retalho novo costurado com fio dourado
    part(pc, '#8a7a5a', (L) => ball(L, 25, 26, 9.5, 8.5, CL.patch));
    dashedArc(pc, 25, 26, 10.6, 9.6, 0, 360, CL.gold, 1, 2);
    sewButton(pc, 21, 24, 2.8, CL.btnA[2], CL.btnA[0], CL.btnA[3], CL.gold, 4);
    sewButton(pc, 29.5, 24, 2.8, CL.btnB[2], CL.btnB[0], CL.btnB[3], CL.gold, 4);
    pc.px(25, 28, '#e87a98'); pc.px(24, 28, '#e87a98'); pc.px(25, 29, '#c85a78');
    drawMouth(pc, 25, 30, expr === 'confused' ? 'confused' : expr, mouth, { line: '#6a4a3a', inside: '#3a1a20', w: 4 });
    if (expr === 'sad') { pc.curve(21, 27, 19, 30, 20, 34, CL.gold); pc.curve(30, 27, 32, 30, 31, 34, CL.gold); }
    if (expr === 'confused') questionMark(pc, 39, 14, '#ffffff', '#1e141e');
  }
}

// =============================================================================
// BALEIA DE VIDRO — globo de neve vivo, remendada com placas de tecido escuro
// =============================================================================
const BA = {
  glass: ['#2a6aa0', '#4a9ccc', '#82d2f2', '#cff6ff'], inner: '#3a7ab0', innerL: '#5aa0d0',
  patch: ['#100c20', '#1c1832', '#2a2646', '#3e3a5e'], thread: '#a855ff', eye: '#0c1830', out: '#0a2440',
};
function drawBaleia(pc, expr, mouth, blink) {
  const out = BA.out;
  part(pc, out, (L) => {
    ball(L, 14, 27, 30, 18.5, BA.glass, [0.18, 0.42, 0.86]);
    // interior do globo: água com neve e coisas perdidas
    for (let y = 14; y < 44; y++) for (let x = 0; x < 30; x++) {
      const dx = (x + 0.5 - 10) / 22, dy = (y + 0.5 - 29) / 13;
      if (dx * dx + dy * dy < 1) {
        L.px(x, y, dx * dx + dy * dy > 0.72 ? BA.innerL : BA.inner);
        if (((x * 7 + y * 13) % 29) === 0) L.px(x, y, '#e8f8ff');
      }
    }
    // meia vermelha, estrela e chavinha perdidas
    L.rect(6, 31, 3, 4, '#e84a5a'); L.rect(6, 34, 5, 2, '#e84a5a'); L.hline(6, 31, 3, '#ffffff');
    L.px(17, 37, '#ffd23f'); L.hline(16, 38, 3, '#ffd23f'); L.px(17, 39, '#ffd23f');
    L.ring(13, 22, 1.4, '#e8c040'); L.hline(14, 22, 4, '#e8c040'); L.px(17, 23, '#e8c040');
    // pregas da barriga
    for (const [y, x0] of [[41, 18], [43, 16]]) L.hline(x0, y, 24, BA.glass[3]);
    // reflexos do vidro
    L.curve(3, 14, 10, 9, 22, 9, '#ffffff'); L.curve(2, 18, 4, 15, 7, 13, '#ffffff');
  });
  // placas de tecido escuro (remendos forçados do Costureiro)
  const patchPoly = (pts) => part(pc, out, (L) => {
    L.poly(pts, BA.patch[2]);
    L.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1], BA.patch[3]);
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; crossStitches(L, a[0], a[1], b[0], b[1], 3, BA.thread); }
  });
  patchPoly([[5, 11], [15, 10], [16, 17], [6, 18]]);
  patchPoly([[30, 37], [40, 34], [42, 41], [32, 44]]);
  // boca
  const mx = (x) => Math.round(39 - (x - 20) * 0.02 + Math.pow((x - 20) / 24, 2) * -6);
  if (mouth || expr === 'surprised') for (let x = 22; x < 45; x++) { const y = mx(x); const g = Math.round(2.2 * Math.sin(((x - 22) / 23) * Math.PI)); pc.vline(x, y - g, g + 1, '#0a1a38'); }
  for (let x = 20; x < 46; x++) { pc.px(x, mx(x), out); pc.px(x, mx(x) + 1, BA.glass[1]); }
  if (expr === 'happy') { pc.px(19, mx(20) - 1, out); pc.px(18, mx(20) - 2, out); }
  // olho
  const ex = 31, ey = 25;
  if (expr === 'angry') pc.circle(ex + 2, ey + 2, 5, '#a855ff55');
  if (blink && expr !== 'happy') { pc.hline(ex - 1, ey + 3, 6, BA.eye); pc.px(ex - 1, ey + 2, BA.eye); }
  else if (expr === 'happy') { pc.line(ex - 1, ey + 3, ex + 1, ey + 1, BA.eye); pc.line(ex + 2, ey + 1, ex + 4, ey + 3, BA.eye); pc.line(ex - 1, ey + 4, ex + 1, ey + 2, BA.eye); pc.line(ex + 2, ey + 2, ex + 4, ey + 4, BA.eye); }
  else {
    const big = expr === 'surprised' ? 1 : 0;
    oval(pc, ex - 1 - big, ey - 1 - big, 8 + big * 2, 8 + big * 2, BA.out);
    oval(pc, ex - big, ey - big, 6 + big * 2, 6 + big * 2, BA.eye);
    pc.rect(ex + 1, ey + 1, 2, 2, expr === 'angry' ? '#e0b0ff' : '#ffffff'); pc.px(ex + 4, ey + 4, '#6a8ab0');
    if (expr === 'sad') { pc.line(ex - 1, ey + 1, ex + 4, ey - 1, BA.glass[2]); pc.line(ex - 1, ey, ex + 3, ey - 1, BA.glass[2]); }
    if (expr === 'angry') { pc.line(ex - 1, ey - 1, ex + 5, ey + 2, BA.glass[2]); pc.line(ex - 1, ey, ex + 5, ey + 3, BA.glass[2]); line2(pc, ex - 2, ey - 3, ex + 6, ey, BA.patch[1]); }
  }
  if (expr === 'sad' && !blink) tearDrop(pc, ex + 1, ey + 7, 2);
}

// =============================================================================
// REI DO SEGUNDO PERDIDO — relógio de bolso coroado; os ponteiros são as sobrancelhas
// =============================================================================
const RE = {
  gold: ['#8a5010', '#c88a28', '#ffcf6a', '#fff0b4'], dial: ['#d8c8a0', '#f0e4c8', '#fff8ea', '#ffffff'],
  tick: '#6a4a2a', hand: '#2a1a30', gems: ['#e83a5a', '#3a7aff', '#3ad890'],
  cape: ['#560c22', '#8a1a34', '#c8304a', '#ea607a'], ermine: '#f8f4ff', eye: '#1a1020', out: '#3a2008',
};
function drawRei(pc, expr, mouth, blink) {
  const out = RE.out;
  // corrente
  for (let i = 0; i < 9; i++) { const t = i / 8; const x = Math.round(16 - t * 12 + Math.sin(t * 3) * 2), y = Math.round(9 + t * 34); pc.ring(x + 0.5, y + 0.5, 1.2, i % 2 ? RE.gold[1] : RE.gold[2]); }
  part(pc, out, (L) => {
    ball(L, 24, 59, 23, 16, RE.cape);
    for (let x = 4; x < 45; x++) for (let y = 43; y < 48; y++) if (Math.abs(y - 45 - Math.sin(x / 4)) < 2) L.px(x, y, RE.ermine);
    for (const x of [9, 17, 25, 33, 41]) { L.px(x, 45, '#1a1020'); L.px(x, 46, '#1a1020'); }
  });
  // coroa + haste
  part(pc, out, (L) => {
    L.rect(22, 7, 5, 4, RE.gold[1]); L.hline(22, 7, 5, RE.gold[3]);
    L.poly([[14, 8], [14, 1], [18, 5], [24, -1], [30, 5], [34, 1], [34, 8]], RE.gold[2]);
    L.hline(14, 7, 21, RE.gold[1]); L.hline(14, 6, 21, RE.gold[0]);
    L.vline(15, 2, 4, RE.gold[3]);
    L.circle(24.5, 3, 1.4, RE.gems[0]); L.px(24, 2, '#ffd0d8');
    L.px(19, 5, RE.gems[1]); L.px(29, 5, RE.gems[2]);
  });
  // caixa dourada + mostrador
  part(pc, out, (L) => {
    ball(L, 24, 27, 16, 16, RE.gold);
    ball(L, 24, 27, 12.6, 12.6, RE.dial, [0.2, 0.4, 0.9]);
    L.ring(24, 27, 13, RE.gold[0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.round(24 + Math.sin(a) * 11 - 0.5), y = Math.round(27 - Math.cos(a) * 11 - 0.5);
      L.px(x, y, RE.tick);
      if (i % 3 === 0) L.px(Math.round(24 + Math.sin(a) * 10 - 0.5), Math.round(27 - Math.cos(a) * 10 - 0.5), RE.tick);
    }
  });
  // ponteiros = sobrancelhas
  const H = {
    neutral: [24, 21, 16, 20, 32, 20], happy: [24, 20, 16, 19, 32, 19], angry: [24, 22, 16, 18, 32, 18],
    sad: [24, 19, 16, 22, 32, 22], surprised: [24, 18, 16, 17, 32, 17],
  }[expr] || [24, 21, 16, 20, 32, 20];
  const [px, py, lx, ly, rx, ry] = H;
  line2(pc, px, py, lx, ly, RE.hand); pc.line(px, py, rx, ry, RE.hand);
  pc.px(lx - 1, ly, RE.hand); pc.px(lx - 1, ly + 1, RE.hand);
  pc.rect(rx, ry - 1, 2, 3, RE.hand);
  pc.circle(24.5, py + 0.5, 1.6, RE.gold[1]); pc.px(24, py, RE.gold[3]);
  const eyes = [{ x: 18, y: 24, w: 3, h: 5, side: -1 }, { x: 28, y: 24, w: 3, h: 5, side: 1 }];
  let kind = { neutral: 'open', happy: 'happy', sad: 'open', angry: 'open', surprised: 'big' }[expr] || 'open';
  if (blink && kind !== 'happy') kind = 'closed';
  drawEyes(pc, eyes, kind, { eye: RE.eye, lid: RE.dial[2] });
  blush(pc, 17, 31, 4, 2, '#ff8a9a', expr === 'angry' ? 1 : 0.7); blush(pc, 31, 31, 4, 2, '#ff8a9a', expr === 'angry' ? 1 : 0.7);
  if (!mouth && expr === 'neutral') { pc.hline(22, 33, 5, RE.eye); pc.px(21, 34, RE.eye); pc.px(27, 34, RE.eye); pc.hline(23, 34, 3, '#e87a8a'); }
  else drawMouth(pc, 24, 32, expr, mouth, { line: RE.eye, inside: '#4a1020', w: 4 });
  if (expr === 'sad' && !blink) { tearDrop(pc, 19, 29, 2); tearDrop(pc, 29, 29, 2); }
  if (expr === 'angry') { // fumacinha de birra
    for (const [x, y] of [[4, 14], [42, 13]]) { pc.circle(x, y, 2, '#ffffffb0'); pc.circle(x + 1, y - 2, 1.4, '#ffffff90'); }
  }
}

// =============================================================================
// MÃE DAS SOMBRAS — massa de sombra com muitos olhos, debaixo da cama
// =============================================================================
const MS = {
  mass: ['#06040c', '#110a1e', '#1e1434', '#30224e'], rim: '#6a42a8',
  eyeY: ['#b08420', '#ffe9a0', '#fffbe4'], eyeV: ['#6a3aa8', '#c8a0ff', '#f0e4ff'], red: ['#a01828', '#ff4a3a', '#ffd0b0'],
  mouth: '#2a0820', teeth: '#e8dcf0', pupil: '#030208',
};
function almondEye(pc, cx, cy, w, h, kind, tones, blinkIt) {
  const hw = w / 2;
  if (blinkIt || kind === 'closed') { pc.line(cx - hw, cy, cx + hw, cy, tones[1]); pc.px(Math.round(cx), Math.round(cy) + 1, tones[0]); return; }
  let top = h / 2, bot = h / 2;
  if (kind === 'calm') top = h * 0.25;
  if (kind === 'angry') top = h * 0.2;
  if (kind === 'sad') { top = h * 0.3; bot = h * 0.45; }
  if (kind === 'wide') { top = h * 0.7; bot = h * 0.7; }
  if (kind === 'happy') { for (let i = -hw; i <= hw; i++) pc.px(Math.round(cx + i), Math.round(cy - (1 - (i / hw) ** 2) * h * 0.4), tones[1]); return; }
  for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
    const t = (x + 0.5 - cx) / hw; if (Math.abs(t) > 1) continue;
    const k = 1 - t * t;
    const slant = kind === 'angry' ? t * (cx < 24 ? 1 : -1) * h * 0.25 : kind === 'sad' ? -t * (cx < 24 ? 1 : -1) * h * 0.2 : 0;
    const y0 = Math.round(cy - top * k + slant), y1 = Math.round(cy + bot * k);
    for (let y = y0; y <= y1; y++) pc.px(x, y, y === y0 ? tones[0] : tones[1]);
  }
  pc.rect(Math.round(cx) - (kind === 'wide' ? 0 : 0), Math.round(cy - top * 0.6), 1, Math.max(1, Math.round((top + bot) * 0.8)), MS.pupil);
  pc.px(Math.round(cx - hw * 0.4), Math.round(cy - top * 0.3), tones[2]);
}
function drawMae(pc, expr, mouth, blink) {
  part(pc, MS.rim, (L) => {
    ball(L, 24, 34, 26, 20, MS.mass, [0.25, 0.5, 0.88]);
    // tentáculos/dedos subindo
    for (const [x0, y0, x1, y1, r] of [[6, 22, 2, 4, 2.6], [14, 16, 11, 1, 2.4], [34, 16, 37, 0, 2.4], [42, 22, 46, 6, 2.6], [24, 14, 23, 2, 2]]) {
      for (let i = 0; i <= 12; i++) { const t = i / 12; L.circle(x0 + (x1 - x0) * t + Math.sin(t * 5) * 1.5, y0 + (y1 - y0) * t, r * (1 - t * 0.7), MS.mass[t < 0.5 ? 2 : 1]); }
    }
  });
  const main = { neutral: 'calm', angry: 'angry', sad: 'sad', surprised: 'wide', happy: 'happy' }[expr] || 'calm';
  const big = expr === 'angry' ? MS.red : MS.eyeY;
  const small = expr === 'angry' ? MS.red : MS.eyeV;
  const smallKind = expr === 'surprised' ? 'wide' : expr === 'sad' ? 'sad' : expr === 'happy' ? 'happy' : 'calm';
  const minis = [[8, 15, 5, 3], [40, 14, 5, 3], [24, 11, 6, 3], [5, 32, 4, 2], [43, 31, 4, 2], [11, 41, 4, 2], [38, 42, 4, 2], [31, 15, 4, 2], [17, 14, 4, 2]];
  minis.forEach(([x, y, w, h], i) => {
    if (expr === 'surprised') { pc.circle(x + 0.5, y + 0.5, w / 2 + 0.6, small[1]); pc.px(x, y, MS.pupil); return; }
    almondEye(pc, x, y, w, h + 1, smallKind, small, blink ? i % 2 === 0 : (expr === 'sad' && i % 3 === 0));
  });
  for (const cx of [16, 32]) {
    pc.ellipse(cx, 24, 7.5, 5, '#00000070');
    almondEye(pc, cx, 24, 12, 8, main, big, blink);
  }
  // boca em lua crescente
  const yAt = (x) => 35 + Math.round((1 - ((x - 24) / 13) ** 2) * (expr === 'sad' ? -2 : expr === 'happy' ? 4 : 2.5));
  if (mouth || expr === 'angry' || expr === 'surprised') {
    const gap = expr === 'surprised' ? 4 : mouth ? 3 : 1;
    for (let x = 12; x <= 36; x++) {
      const y = yAt(x), g = Math.round(gap * Math.sin(((x - 12) / 24) * Math.PI));
      pc.vline(x, y - g, g * 2 + 1, MS.mouth);
      if (g > 0) { if (x % 3 === 0) pc.px(x, y - g, MS.teeth); if (x % 3 === 1) pc.px(x, y + g, MS.teeth); }
    }
  }
  for (let x = 11; x <= 37; x++) { const y = yAt(x) + (x === 11 || x === 37 ? -1 : 0); pc.px(x, y, '#9a6ad8'); pc.px(x, y + 1, '#00000080'); }
}

// =============================================================================
// ECO DA TECELÃ — figura antiga de fios dourados, translúcida, olhos serenos
// =============================================================================
const TE = {
  hood: ['#6e4e22', '#a8823c', '#dcbc6c', '#fff0b8'], hoodIn: '#2a1430', face: ['#7e5e8e', '#c4a4c4', '#f0dce8', '#fff8f4'],
  robe: ['#4e224e', '#7e3270', '#ae5290', '#d884bc'], gold: '#ffe8b0', goldD: '#e0b060', out: '#24102a', eye: '#5a3a6a',
};
function drawTecela(pc, expr, mouth, blink) {
  const out = TE.out;
  part(pc, out, (L) => {
    ball(L, 24, 57, 20, 13, TE.robe);
    for (let x = 6; x < 43; x++) { const y = 46 + ((x >> 1) % 2); L.px(x, y, TE.gold); L.px(x, y + 1, TE.goldD); }
  });
  part(pc, out, (L) => {
    ball(L, 24, 26, 15.5, 18, TE.hood);
    L.tri(17, 10, 31, 10, 24, 1, TE.hood[3]);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((L.getU32(x, y) >>> 24) && (x + y * 3) % 7 === 0) L.px(x, y, TE.hood[1]);
    L.ellipse(25, 28, 9.5, 11, TE.hoodIn);
  });
  part(pc, null, (L) => {
    ball(L, 25, 30, 7.5, 9, TE.face, [0.2, 0.45, 0.88]);
    for (let y = 21; y < 25; y++) for (let x = 17; x < 34; x++) if ((L.getU32(x, y) >>> 24) && bay(x, y) < (25 - y) / 4) L.px(x, y, TE.face[0]);
  });
  // marca brilhante na testa
  pc.px(25, 24, '#ffffff'); pc.px(24, 24, TE.gold); pc.px(26, 24, TE.gold); pc.px(25, 23, TE.gold); pc.px(25, 25, TE.gold);
  const open = expr === 'surprised' && !blink;
  for (const ex of [21, 28]) {
    if (open) { oval(pc, ex - 1, 27, 4, 3, '#fffbe8'); pc.px(ex, 28, '#ffffff'); pc.rect(ex - 2, 26, 6, 5, '#ffe8b030'); }
    else if (expr === 'happy') { pc.px(ex - 1, 29, TE.eye); pc.hline(ex, 28, 2, TE.eye); pc.px(ex + 2, 29, TE.eye); }
    else { pc.hline(ex - 1, 29, 4, TE.eye); pc.px(ex - 1, 28, TE.eye); pc.px(ex + 2, 28, TE.eye); pc.px(ex, 30, TE.face[1]); }
  }
  if (expr === 'sad') { pc.line(19, 26, 22, 25, TE.face[0]); pc.line(28, 25, 31, 26, TE.face[0]); }
  drawMouth(pc, 25, 34, expr === 'surprised' ? 'surprised' : expr === 'sad' ? 'sad' : expr === 'happy' ? 'happy' : 'neutral', mouth, { line: '#9a5a7a', inside: '#4a1a40', w: 3 });
  // fios dourados escorrendo do capuz
  pc.curve(10, 30, 5, 39, 8, 48, TE.gold); pc.curve(39, 30, 44, 39, 41, 48, TE.gold); pc.curve(13, 36, 11, 42, 13, 48, TE.goldD);
  // eco: levemente translúcida
  pc.mapPixels((r, g, b, a) => [r, g, b, Math.min(a, 228)]);
}

// =============================================================================
// Enfeites dos fundos
// =============================================================================
const BG_EXTRA = {
  costureiro(pc) { // rasgo no canto com fios roxos atravessando
    pc.poly([[30, 2], [36, 5], [39, 3], [44, 9], [41, 12], [46, 16], [46, 2]], '#06030a');
    for (const [a, b, c, d] of [[33, 3, 45, 13], [37, 2, 46, 8], [31, 5, 44, 15]]) pc.line(a, b, c, d, '#a855ff');
  },
  baleia(pc) {
    for (const [x, y, r] of [[8, 9, 2.5], [12, 16, 1.5], [40, 8, 2], [43, 15, 1.2], [6, 38, 1.8], [41, 40, 2.4]]) {
      pc.ring(x, y, r, '#9fe8ff'); pc.px(Math.round(x - r * 0.5), Math.round(y - r * 0.5), '#ffffff');
    }
  },
  mae_sombras(pc) { // estrado da cama em cima e luz de abajur embaixo
    pc.rect(2, 2, 44, 6, '#3a2418'); pc.hline(2, 7, 44, '#22140c');
    for (let x = 4; x < 46; x += 7) pc.rect(x, 2, 1, 6, '#22140c');
    for (let x = 2; x < 46; x++) { const len = 2 + ((x * 7) % 3); pc.vline(x, 8, len, x % 2 ? '#7a3a6a' : '#5a2a50'); }
    for (let x = 2; x < 46; x++) for (let y = 42; y < 46; y++) if (bay(x, y) < (y - 41) / 6) pc.px(x, y, '#5a4020');
  },
  tecela(pc) { for (let x = 6; x < 44; x += 5) for (let y = 2; y < 46; y++) if ((y + x) % 9 !== 0) pc.px(x, y, '#c88ab055'); },
  luzinha(pc) {
    for (const [x, y] of [[7, 8], [40, 6], [11, 18], [42, 22], [6, 40]]) { pc.px(x, y, '#fff3a0'); pc.px(x + 1, y, '#fff3a060'); pc.px(x - 1, y, '#fff3a060'); }
    for (let x = 4; x < 44; x++) { const y = 10 + Math.round(Math.sin(x / 5) * 2); pc.px(x, y + 30, '#2a3060'); }
  },
  rei(pc) { // engrenagens douradas ao fundo
    for (const [cx, cy, r] of [[6, 8, 5], [43, 40, 6]]) {
      pc.ring(cx, cy, r, '#7a5aa0'); pc.ring(cx, cy, r - 2, '#6a4a90');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; pc.px(Math.round(cx + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * (r + 1)), '#7a5aa0'); }
    }
  },
};

// =============================================================================
// Tabela de personagens
// =============================================================================
const CHARS = {
  tico: {
    name: 'Tico', color: '#3fc7c0', exprs: ALL_EXPRS, draw: drawTico,
    bg: { tones: ['#f6a6bf', '#f08aac', '#e36d98'], pattern: PAT.gingham(4), edge: '#4a1838', stitch: '#ffe680', shade: '#5a1048' },
  },
  lia: {
    name: 'Lia', color: '#ff9ad8', exprs: ['neutral', 'happy', 'sad', 'scared', 'surprised', 'sleepy'], draw: drawLia,
    bg: { tones: ['#c4b4f0', '#b4a2e6', '#fff3a0'], pattern: PAT.dots(9), edge: '#2a1e48', stitch: '#ffffff', shade: '#3a2a78' },
  },
  vo_celeste: {
    name: 'Vó Celeste', color: '#d8b0ff', exprs: ['neutral', 'happy', 'sad', 'surprised', 'sleepy'], draw: drawVo,
    bg: { tones: ['#f2dca6', '#e8cc8c', '#d6b072'], pattern: PAT.quilt(8), edge: '#4a3018', stitch: '#a878d8', shade: '#6a3a10' },
  },
  costureiro: {
    name: 'O Costureiro', color: '#a855ff', exprs: ['neutral', 'happy', 'angry', 'sad', 'surprised'], draw: drawCostureiro,
    bg: { tones: ['#2a1a3a', '#22142e', '#3a2452'], pattern: PAT.felt(7), edge: '#06030a', stitch: '#a855ff', shade: '#000000', rimLight: '#4a2e6a', rimDark: '#120818', extra: BG_EXTRA.costureiro },
  },
  botao: {
    name: 'Sr. Botão', color: '#c89a5a', exprs: ['neutral', 'happy', 'sad', 'angry', 'surprised'], draw: drawBotao,
    bg: { tones: ['#5c8c4a', '#4e7c40', '#3e6a34'], pattern: PAT.felt(3), edge: '#1a2a10', stitch: '#f0d8a0', shade: '#0a2010' },
  },
  pip: {
    name: 'Pip', color: '#c0c8d8', exprs: ['neutral', 'happy', 'sad', 'scared', 'surprised'], draw: drawPip,
    bg: { tones: ['#cfe0c0', '#bed2ae', '#a8c098'], pattern: PAT.stripesV(3), edge: '#22301a', stitch: '#ff9ab8', shade: '#2a4a20' },
  },
  agulheta: {
    name: 'Agulheta', color: '#ff6fa8', exprs: ['neutral', 'happy', 'sad', 'angry', 'surprised'], draw: drawAgulheta,
    bg: { tones: ['#7a3a9a', '#6c2e8a', '#e8b84a'], pattern: PAT.dots(8), edge: '#2a0e38', stitch: '#ffd23f', shade: '#1a0628' },
  },
  capita_bolha: {
    name: 'Capitã Bolha', color: '#ffd23f', exprs: ['neutral', 'happy', 'sad', 'angry', 'determined', 'surprised'], draw: drawBolha,
    bg: { tones: ['#4a92d2', '#3a7cc2', '#a8e2ff'], pattern: PAT.waves(6), edge: '#0e2a48', stitch: '#fff4dc', shade: '#0a2050' },
  },
  tique_taque: {
    name: 'Tique-Taque', color: '#ffb84f', exprs: ['neutral', 'happy', 'sad', 'confused', 'surprised'], draw: drawTique,
    bg: { tones: ['#7a5aa8', '#6a4a98', '#ffcf6a'], pattern: PAT.dots(7), edge: '#2a1838', stitch: '#ffcf6a', shade: '#1a0838' },
  },
  luzinha: {
    name: 'Luzinha', color: '#fff3a0', exprs: ['neutral', 'happy', 'sad', 'scared', 'surprised', 'sleepy'], draw: drawLuzinha,
    bg: { tones: ['#1e2450', '#1a1f44', '#2a3060'], pattern: PAT.plain, edge: '#0a0c1e', stitch: '#fff3a0', shade: '#05060f', glow: [25, 40, 22, '#4a4a70'], extra: BG_EXTRA.luzinha },
  },
  fiapo: {
    name: 'Fiapo', color: '#e0c8a8', exprs: ['neutral', 'happy', 'sad', 'surprised'], draw: drawFiapo,
    bg: { tones: ['#a6c2e2', '#94b2d6', '#82a2c8'], pattern: PAT.gingham(3), edge: '#2a3048', stitch: '#ffe8b0', shade: '#1a2a50' },
  },
  coelho: {
    name: 'Coelho Sem Rosto', color: '#d8c8d0', exprs: ['neutral', 'angry', 'happy', 'sad', 'surprised', 'confused'], draw: drawCoelho,
    bg: { tones: ['#4e5e48', '#44543e', '#3a4836'], pattern: PAT.felt(11), edge: '#141a10', stitch: '#d8c8d0', shade: '#0a1008' },
  },
  baleia: {
    name: 'Baleia de Vidro', color: '#9fe8ff', exprs: ['neutral', 'happy', 'sad', 'angry', 'surprised'], draw: drawBaleia,
    bg: { tones: ['#1e4c7c', '#1a4472', '#2a5a8c'], pattern: PAT.waves(7), edge: '#081a30', stitch: '#9fe8ff', shade: '#040e20', extra: BG_EXTRA.baleia },
  },
  rei: {
    name: 'Rei do Segundo Perdido', color: '#ffcf6a', exprs: ['neutral', 'happy', 'sad', 'angry', 'surprised'], draw: drawRei,
    bg: { tones: ['#5a3a8a', '#4e3080', '#ffcf6a'], pattern: PAT.dots(9), edge: '#1e1030', stitch: '#ffcf6a', shade: '#100628', extra: BG_EXTRA.rei },
  },
  mae_sombras: {
    name: 'Mãe das Sombras', color: '#9a6aff', exprs: ['neutral', 'happy', 'sad', 'angry', 'surprised'], draw: drawMae,
    bg: { tones: ['#3a2c5e', '#322652', '#463870'], pattern: PAT.felt(5), edge: '#05030a', stitch: '#9a6aff', shade: '#000000', extra: BG_EXTRA.mae_sombras },
  },
  tecela: {
    name: 'Eco da Tecelã', color: '#ffe8b0', exprs: ['neutral', 'happy', 'sad', 'surprised'], draw: drawTecela,
    bg: { tones: ['#6a2a6a', '#5e2460', '#7a3a7a'], pattern: PAT.stripesD(4), edge: '#2a0e2a', stitch: '#ffe8b0', shade: '#1a041a', extra: BG_EXTRA.tecela },
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
// O retrato do Tico é tirado do PRÓPRIO sprite do jogo (close na cabeça, 2x),
// para ele ser sempre o mesmo dinossauro que o jogador controla.
const TICO_EXPR = {
  neutral: ['idle', 0, 2], happy: ['celebrate', 4, 5], sad: ['sad', 0, 1], scared: ['scared', 0, 1], surprised: ['surprise', 2, 3],
  confused: ['think', 0, 1], determined: ['charge', 0, 1], sleepy: ['sleep', 0, 1], angry: ['charge', 2, 3],
};
function drawTicoPortrait(ctx, expr, x, y, opts) {
  const sp = getSprite('tico');
  if (!sp) return false;
  const [anim0, fa, fb] = TICO_EXPR[expr] || TICO_EXPR.neutral;
  const anim = sp.rows[anim0] !== undefined ? anim0 : 'idle';
  const talking = opts.talking && Math.floor((opts.t || 0) * 8) % 2 === 1;
  const f = Math.min(sp.anims[anim].frames - 1, talking ? fb : fa);
  const m = frameMeta('tico', anim, f) || { head: { x: 38, y: 14 } };
  const S = PORTRAIT_SIZE;
  const p = R.portraits.get('tico');
  const rx = Math.round(x), ry = Math.round(y);
  if (p?.bgImage) drawImage(ctx, p.bgImage, rx, ry);
  else { ctx.fillStyle = '#e8a0c0'; ctx.fillRect(rx, ry, S, S); }
  // recorte 22x21 em volta da cabeça -> 44x42 dentro da moldura
  const cw = 24, ch = 24;
  const cx0 = Math.round(m.head.x - 12), cy0 = Math.round(m.head.y - 5);
  ctx.save();
  ctx.beginPath(); ctx.rect(rx + 3, ry + 3, S - 6, S - 6); ctx.clip();
  const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  const sx = f * sp.w + cx0, sy = sp.rows[anim] * sp.h + cy0;
  if (opts.flip) { ctx.translate(rx + S, ry); ctx.scale(-1, 1); ctx.drawImage(sp.atlas, sx, sy, cw, ch, 0, 0, cw * 2, ch * 2); }
  else ctx.drawImage(sp.atlas, sx, sy, cw, ch, rx, ry, cw * 2, ch * 2);
  ctx.imageSmoothingEnabled = prev;
  ctx.restore();
  return true;
}

export function drawPortrait(ctx, who, expr = 'neutral', x, y, opts = {}) {
  if (!who || NO_PORTRAIT.has(who)) return;
  if (who === 'tico' && hasSprite('tico') && drawTicoPortrait(ctx, expr, x, y, opts)) return;
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
