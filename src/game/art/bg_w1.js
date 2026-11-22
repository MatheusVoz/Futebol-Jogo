// =============================================================================
// art/bg_w1.js — Fundo do Mundo 1: FLORESTA DOS BRINQUEDOS PERDIDOS ao crepúsculo.
//
// sky(): degradê pontilhado (cache por tamanho, desliza um pouco com a câmera),
//        estrelas piscando, lua de feltro costurada com botão, estrela cadente.
// layers (de trás p/ frente): colinas + castelo de blocos abandonado; árvores
//        gigantes de pompom; faixa de névoa roxa (deriva); floresta média com
//        carretéis gigantes, torres de blocos e cogumelos brilhando; folhagem
//        escura próxima com pontos de luz + vaga-lumes (animate).
// front: névoa roxa rasteira translúcida à deriva.
// Todas as camadas são contínuas na horizontal (senóides de frequência inteira
// e elementos desenhados com "wrap").
// =============================================================================
import { registerBackground } from '../registry.js';
import { PixelCanvas } from '../../engine/pixel.js';

const TAU = Math.PI * 2;
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const wrap = (w, fn) => { fn(0); fn(-w); fn(w); };
/** Preenche colunas abaixo de uma crista ridge(x) com borda iluminada. */
function ridgeFill(pc, w, h, ridge, body, rim, rim2) {
  for (let x = 0; x < w; x++) {
    const y0 = Math.round(ridge(x));
    pc.vline(x, y0, h - y0, body);
    pc.px(x, y0, rim);
    if (rim2 && ridge(x - 1) > ridge(x)) pc.px(x, y0 + 1, rim2);
  }
}
/** Copa de pompons (círculos sobrepostos com sombra e luz da lua, de cima-esquerda). */
function pomCanopy(pc, cx, cy, R, r, cols) {
  const blobs = [];
  for (let i = 0; i < 8; i++) {
    const a = r() * TAU, d = r() * R * 0.55;
    blobs.push([cx + Math.cos(a) * d * 1.35, cy + Math.sin(a) * d * 0.75, R * (0.42 + r() * 0.3)]);
  }
  blobs.push([cx, cy, R * 0.6]);
  for (const [x, y, rr] of blobs) pc.circle(x + 2, y + 3, rr, cols[0]);
  for (const [x, y, rr] of blobs) pc.circle(x, y, rr, cols[1]);
  for (const [x, y, rr] of blobs) pc.circle(x - rr * 0.28, y - rr * 0.32, rr * 0.58, cols[2]);
  for (const [x, y, rr] of blobs) if (rr > 8) pc.circle(x - rr * 0.4, y - rr * 0.45, rr * 0.22, cols[3]);
}
/** Tronco de feltro com costura central. cols: [base, luz, sombra, costura] */
function trunk(pc, x, yTop, yBot, wTop, wBot, cols) {
  for (let y = yTop; y < yBot; y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const ww = Math.round(wTop + (wBot - wTop) * t * t * t);
    const x0 = Math.round(x - ww / 2);
    pc.hline(x0, y, ww, cols[0]);
    pc.px(x0, y, cols[1]); pc.px(x0 + 1, y, cols[1]);
    pc.px(x0 + ww - 1, y, cols[2]); pc.px(x0 + ww - 2, y, cols[2]);
    if ((y & 3) < 2) pc.px(x0 + (ww >> 1), y, cols[3]);
  }
}

// ------------------------------------------------------------------ céu
const SKY = ['#110a26', '#1a103a', '#26164c', '#38205c', '#562a68', '#7c366c', '#a6486c', '#c86468'];
const SKY_EXTRA = 90;
let skyCache = { key: '', canvas: null };
let moonPc = null;
const STARS = (() => { const r = lrng(1234); const a = []; for (let i = 0; i < 90; i++) a.push({ u: r(), v: r() * r(), ph: r() * TAU, sp: 0.6 + r() * 2, big: r() < 0.12 }); return a; })();

function buildMoon() {
  const pc = new PixelCanvas(64, 64);
  const c = 32;
  pc.circle(c, c, 30, '#e8c8ff0a'); pc.circle(c, c, 25, '#f0d8ff10'); pc.circle(c, c, 21, '#f8e8ff18');
  pc.circle(c, c, 16, '#efe3c2');
  pc.circle(c + 4, c + 4, 14, '#d8c8a0');
  pc.circle(c - 2, c - 2, 13, '#f6eccc');
  pc.circle(c - 5, c - 6, 5, '#fff8e4');
  // textura de feltro
  const r = lrng(77);
  for (let i = 0; i < 60; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 14;
    pc.px(Math.round(c + Math.cos(a) * d), Math.round(c + Math.sin(a) * d), r() < 0.5 ? '#d2c098' : '#fff4d8');
  }
  // costura
  for (let i = -12; i <= 12; i += 3) { const y = c + Math.round(i * 0.5 + Math.sin(i * 0.2) * 3); pc.px(c + i, y, '#a8946e'); pc.px(c + i + 1, y, '#a8946e'); }
  // botão-cratera
  pc.circle(c + 6, c + 5, 3.6, '#c4b088'); pc.circle(c + 6, c + 5, 2.6, '#e0d0a8');
  pc.px(c + 5, c + 4, '#8a7656'); pc.px(c + 7, c + 4, '#8a7656'); pc.px(c + 5, c + 6, '#8a7656'); pc.px(c + 7, c + 6, '#8a7656');
  pc.circle(c - 7, c + 4, 1.8, '#d8c8a0'); pc.circle(c + 1, c - 9, 1.4, '#ddd0aa');
  pc.flush();
  return pc;
}

function sky(ctx, w, h, t, cam, level) {
  const key = w + 'x' + h;
  if (skyCache.key !== key) {
    const pc = new PixelCanvas(w, h + SKY_EXTRA);
    pc.vgradient(0, 0, w, h + SKY_EXTRA, SKY);
    pc.flush();
    skyCache = { key, canvas: pc.canvas };
  }
  const maxY = Math.max(1, (level?.map?.height || h) - (cam?.viewH || h));
  const f = Math.max(0, Math.min(1, (cam?.y || 0) / maxY));
  const oy = Math.round(-SKY_EXTRA * f);
  ctx.drawImage(skyCache.canvas, 0, oy);
  // estrelas
  const cx = (cam?.x || 0) * 0.01;
  ctx.fillStyle = '#fff4e8';
  for (const s of STARS) {
    const a = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
    const x = Math.round(((s.u * w - cx) % w + w) % w), y = Math.round(s.v * h * 0.7 + oy * 0.3 + 4);
    ctx.globalAlpha = a * (1 - s.v * 0.6);
    ctx.fillRect(x, y, 1, 1);
    if (s.big && a > 0.75) { ctx.globalAlpha = (a - 0.75) * 2.5; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  ctx.globalAlpha = 1;
  // lua
  if (!moonPc) moonPc = buildMoon();
  ctx.drawImage(moonPc.canvas, Math.round(w * 0.24 - 32), Math.round(h * 0.17 - 32 + 18 + oy * 0.25));
  // estrela cadente ocasional
  const ph = t % 13;
  if (ph < 0.8) {
    const p = ph / 0.8, k = Math.floor(t / 13);
    const sx = w * (0.45 + ((k * 0.37) % 0.4)), sy = h * 0.08;
    const x = sx - p * 70, y = sy + p * 28;
    ctx.fillStyle = '#fff6e0';
    for (let i = 0; i < 8; i++) { ctx.globalAlpha = (1 - i / 8) * (1 - p) * 0.9; ctx.fillRect(Math.round(x + i * 2.5), Math.round(y - i), 1, 1); }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ animação: pontos de luz
function glints(n, seed, speed, colors, yMin, yMax, big = false) {
  const r = lrng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ u: r(), v: r(), ph: r() * TAU, sp: 0.5 + r(), c: colors[i % colors.length] });
  return (ctx, cam, t, w, h, y) => {
    const span = w + 40;
    for (const p of pts) {
      const a = 0.5 + 0.5 * Math.sin(t * 2 * p.sp + p.ph);
      if (a < 0.2) continue;
      let x = (p.u * span - cam.x * speed + Math.sin(t * 0.5 * p.sp + p.ph) * 12) % span;
      if (x < 0) x += span;
      x = Math.round(x - 20);
      const yy = Math.round(y + yMin + p.v * (yMax - yMin) + Math.sin(t * 0.8 * p.sp + p.ph * 2) * 7);
      if (yy < -2 || yy > h + 2) continue;
      ctx.fillStyle = p.c;
      ctx.globalAlpha = a;
      ctx.fillRect(x, yy, 1, 1);
      if (big && a > 0.7) { ctx.globalAlpha = (a - 0.7) * 1.6; ctx.fillRect(x - 1, yy, 3, 1); ctx.fillRect(x, yy - 1, 1, 3); }
    }
    ctx.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ camadas
const GLYPH_A = ['.###.', '#...#', '#####', '#...#', '#...#'];
const GLYPH_B = ['####.', '#...#', '####.', '#...#', '####.'];
const GLYPH_C = ['.####', '#....', '#....', '#....', '.####'];

const layers = [
  // 1) colinas distantes + castelo de brinquedo abandonado
  {
    width: 640, height: 200, speed: 0.04, speedY: 0.03, fillBelow: '#1c1636',
    paint(pc, w, h) {
      const r1 = (x) => h - 96 + 15 * Math.sin((TAU * 2 * x) / w + 0.5) + 7 * Math.sin((TAU * 5 * x) / w + 1.3) + 2 * Math.sin((TAU * 13 * x) / w);
      ridgeFill(pc, w, h, r1, '#2c2150', '#4a3a76', '#3a2e62');
      // castelo de blocos
      const cx = 420, base = Math.round(r1(cx)) + 6;
      const C = '#221a40', L = '#3a2e66', D = '#18122e';
      const tower = (x, tw, th, roof, broken) => {
        pc.rect(x, base - th, tw, th, C); pc.vline(x, base - th, th, L);
        for (let yy = base - th + 9; yy < base; yy += 9) pc.hline(x + 1, yy, tw - 1, D);
        if (broken) {
          pc.tri(x, base - th, x + tw, base - th, x + tw, base - th - 7, C);
          pc.px(x + tw - 2, base - th - 9, C); pc.px(x + tw + 2, base - th + 3, C);
        } else if (roof) {
          pc.tri(x - 3, base - th, x + tw + 3, base - th, x + tw / 2, base - th - roof, '#2a1e4a');
          pc.line(x - 3, base - th, x + tw / 2, base - th - roof, L);
          pc.vline(Math.round(x + tw / 2), base - th - roof - 7, 7, D);
          pc.rect(Math.round(x + tw / 2) + 1, base - th - roof - 7, 5, 3, '#5a2a4a');
        } else for (let i = 0; i < tw; i += 4) pc.rect(x + i, base - th - 3, 2, 3, C);
      };
      wrap(w, (o) => {
        pc.translate(o, 0);
        pc.rect(cx - 30, base - 34, 60, 34, C); pc.vline(cx - 30, base - 34, 34, L);
        for (let i = 0; i < 60; i += 6) pc.rect(cx - 30 + i, base - 38, 3, 4, C);
        for (let i = 0; i < 60; i += 12) pc.vline(cx - 30 + i, base - 34, 34, D);
        pc.rect(cx - 6, base - 14, 12, 14, D); pc.circle(cx, base - 14, 6, D);
        tower(cx - 46, 16, 62, 22, false);
        tower(cx + 30, 14, 76, 0, true);
        tower(cx - 14, 12, 52, 16, false);
        tower(cx + 8, 10, 44, 0, false);
        // janelas: uma ainda acesa
        pc.rect(cx - 40, base - 46, 3, 4, '#f2bc64'); pc.px(cx - 40, base - 46, '#fff0b8');
        pc.rect(cx - 10, base - 40, 2, 3, '#3a2a4a'); pc.rect(cx + 34, base - 58, 3, 4, '#3a2a4a');
        pc.rect(cx + 12, base - 30, 2, 3, '#c88a44');
        pc.resetTranslate();
      });
      const r2 = (x) => h - 52 + 10 * Math.sin((TAU * 3 * x) / w + 2) + 5 * Math.sin((TAU * 7 * x) / w + 0.2);
      ridgeFill(pc, w, h, r2, '#201a3e', '#3c3066', '#2c2450');
      // arvorezinhas de pompom na crista
      const rr = lrng(5);
      for (let x = 8; x < w; x += 18 + rr.int(0, 22)) {
        const y = Math.round(r2(x)), s = 3 + rr.int(0, 4);
        wrap(w, (o) => { pc.vline(x + o, y - s, s + 1, '#1a1434'); pc.circle(x + o, y - s - 1, s, '#241c46'); pc.px(x + o - 1, y - s - 3, '#3a3068'); });
      }
      // névoa no pé das colinas
      pc.ditherFn(0, h - 30, w, 30, (i, j) => ['#201a3e', '#382c60', (j / 30) * 0.7]);
    },
  },
  // 2) árvores gigantes de brinquedo distantes
  {
    width: 512, height: 230, speed: 0.12, speedY: 0.06, fillBelow: '#1a1834',
    paint(pc, w, h) {
      const r = lrng(31);
      const trees = [[30, 70, 34], [140, 40, 44], [250, 86, 30], [345, 30, 48], [450, 64, 36]];
      const cols = ['#1b1c36', '#262a4c', '#30365e', '#3e4672'];
      for (const [tx, top, R] of trees) {
        wrap(w, (o) => {
          const rr = lrng(tx * 7 + 3);
          trunk(pc, tx + o, top + 10, h, 12 + (R >> 3), 26 + (R >> 2), ['#22213e', '#323058', '#18172e', '#3a3864']);
          // raízes de bloquinhos
          pc.rect(tx + o - 22, h - 10, 10, 10, '#1e1d38'); pc.hline(tx + o - 22, h - 10, 10, '#2e2c52');
          pc.rect(tx + o + 13, h - 8, 8, 8, '#1e1d38'); pc.hline(tx + o + 13, h - 8, 8, '#2e2c52');
          pomCanopy(pc, tx + o, top, R, rr, cols);
          // fio pendurado com botão
          if (R > 40) { const hx = tx + o + 18; pc.vline(hx, top + 14, 40, '#2e2c50'); pc.circle(hx, top + 56, 3, '#3a3460'); pc.px(hx - 1, top + 55, '#1a1834'); pc.px(hx + 1, top + 55, '#1a1834'); }
        });
      }
      // chão ondulado
      const gr = (x) => h - 18 + 4 * Math.sin((TAU * 4 * x) / w) + 2 * Math.sin((TAU * 9 * x) / w + 1);
      ridgeFill(pc, w, h, gr, '#1a1834', '#2a2850', null);
      for (let i = 0; i < 60; i++) { const x = r.int(0, w - 1); const y = Math.round(gr(x)); pc.vline(x, y - r.int(1, 3), 3, '#1a1834'); }
    },
    animate: glints(10, 91, 0.12, ['#b8a8ff', '#9af0ff'], 40, 170),
  },
  // 3) névoa roxa média (deriva)
  {
    width: 480, height: 90, speed: 0.2, speedY: 0.1, drift: 5, alpha: 0.5, y: -48,
    paint(pc, w, h) {
      const r = lrng(55);
      for (let i = 0; i < 14; i++) {
        const cx = r.int(0, w), cy = r.int(30, h - 20), rx = r.int(40, 90), ry = r.int(6, 14);
        wrap(w, (o) => pc.dither(Math.round(cx + o - rx), Math.round(cy - ry), rx * 2, ry * 2, null, '#7e68b4', (x, y) => {
          const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
          return d < 1 ? (1 - d) * 0.75 : 0;
        }));
      }
      pc.dither(0, h - 26, w, 26, null, '#7e68b4', (x, y) => (y / 26) * 0.9);
    },
  },
  // 4) floresta média: carretéis gigantes, torres de blocos, cogumelos
  {
    width: 576, height: 220, speed: 0.3, speedY: 0.15, fillBelow: '#121722',
    paint(pc, w, h) {
      const r = lrng(77);
      const B = '#18202e', RIM = '#33465a', DK = '#10161f';
      // árvores médias
      for (const [tx, top, R] of [[200, 34, 34], [470, 20, 40]]) {
        wrap(w, (o) => {
          trunk(pc, tx + o, top + 8, h, 10, 22, ['#1a2230', '#2c3c50', '#111823', '#34485e']);
          pomCanopy(pc, tx + o, top, R, lrng(tx), ['#0f1a1e', '#16262a', '#1e3438', '#2c4a4a']);
        });
      }
      // carretel gigante em pé
      const spool = (sx, top, sw, shh, thread) => wrap(w, (o) => {
        const x = sx + o, bx = Math.round(x - sw / 2 + 4), bw = sw - 8;
        pc.rect(bx, top + 5, bw, shh - 10, thread[0]);
        for (let y = top + 6; y < top + shh - 5; y += 3) pc.hline(bx, y, bw, thread[1]);
        pc.rect(bx + 3, top + 5, 3, shh - 10, thread[2]);
        for (let y = top + 6; y < top + shh - 5; y += 3) pc.hline(bx + 3, y, 3, thread[3]);
        pc.rect(bx + bw - 4, top + 5, 4, shh - 10, DK);
        // flanges de madeira
        pc.ellipse(x, top + shh - 4, sw / 2 + 4, 5, '#241e2a'); pc.hline(Math.round(x - sw / 2 - 3), top + shh - 5, sw + 6, '#4a3e50');
        pc.ellipse(x, top + 4, sw / 2 + 4, 5.5, '#2a2232');
        pc.ellipse(x, top + 3, sw / 2 + 3, 4.2, '#4a3e52');
        pc.ellipse(x - 2, top + 2, sw / 2 - 2, 2.6, '#5c4e62');
        pc.ellipse(x, top + 3, 4, 2, '#140f18');
        // fio solto descendo até o chão
        pc.curve(bx + bw, top + shh * 0.4, x + sw / 2 + 20, top + shh * 0.7, x + sw / 2 + 30, h - 6, thread[2]);
      });
      spool(80, 70, 46, 130, ['#4a2440', '#5c2e4c', '#7e4466', '#9a5a7e']);
      spool(380, 120, 30, 82, ['#24444c', '#2e565e', '#447a80', '#5a949a']);
      // torre de blocos com letras
      const blocks = [[296, h - 28, 26, '#2a2238', GLYPH_A], [300, h - 54, 26, '#1e2a36', GLYPH_B], [293, h - 80, 26, '#2e2826', GLYPH_C], [298, h - 102, 22, '#262036', GLYPH_A]];
      for (const [bx, by, s, c, gl] of blocks) wrap(w, (o) => {
        pc.rect(bx + o, by, s, s, c); pc.hline(bx + o, by, s, RIM); pc.vline(bx + o, by, s, RIM);
        pc.hline(bx + o + 1, by + s - 1, s - 1, DK); pc.vline(bx + o + s - 1, by + 1, s - 1, DK);
        pc.strokeRect(bx + o + 3, by + 3, s - 6, s - 6, DK);
        const sc = 2, gx = bx + o + Math.round((s - 10) / 2), gy = by + Math.round((s - 10) / 2);
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (gl[j][i] === '#') pc.rect(gx + i * sc, gy + j * sc, sc, sc, '#3a4a5e');
      });
      // bloco caído
      wrap(w, (o) => { pc.rect(330 + o, h - 22, 18, 18, '#26203a'); pc.hline(330 + o, h - 22, 18, RIM); });
      // chão com grama e cogumelos brilhando
      const gr = (x) => h - 14 + 3 * Math.sin((TAU * 5 * x) / w + 0.7) + 2 * Math.sin((TAU * 11 * x) / w);
      ridgeFill(pc, w, h, gr, '#121722', '#24303e', null);
      for (let i = 0; i < 120; i++) { const x = r.int(0, w - 1); const y = Math.round(gr(x)); const hh = r.int(2, 6); pc.vline(x, y - hh, hh, '#121722'); }
      for (let i = 0; i < 16; i++) {
        const x = r.int(4, w - 5), y = Math.round(gr(x)), glow = r() < 0.5 ? '#5ff0e8' : '#ff7ac8';
        wrap(w, (o) => {
          pc.circle(x + o, y - 4, 6, glow + '18'); pc.circle(x + o, y - 4, 3.5, glow + '24');
          pc.vline(x + o, y - 3, 3, '#1a2430'); pc.hline(x + o - 2, y - 4, 5, glow); pc.hline(x + o - 1, y - 5, 3, glow);
          pc.px(x + o - 1, y - 5, '#ffffff');
        });
      }
    },
    animate: glints(12, 17, 0.3, ['#5ff0e8', '#ff7ac8', '#d8ff9a'], 60, 200),
  },
  // 5) folhagem escura próxima com pontos de luz
  {
    width: 448, height: 150, speed: 0.58, speedY: 0.28, fillBelow: '#0c0814',
    paint(pc, w, h) {
      const r = lrng(99);
      const DK = '#0c0814', MID = '#160f22', HI = '#22192f';
      const bush = (x, y, R) => wrap(w, (o) => {
        const rr = lrng(x * 13 + y);
        const bl = [];
        for (let i = 0; i < 6; i++) bl.push([x + o + (rr() - 0.5) * R * 2.2, y + (rr() - 0.3) * R * 0.8, R * (0.5 + rr() * 0.45)]);
        for (const [bx, by, br] of bl) pc.circle(bx, by, br, DK);
        for (const [bx, by, br] of bl) {
          for (let a = -2.6; a < -0.9; a += 0.18) pc.px(Math.round(bx + Math.cos(a) * (br - 1)), Math.round(by + Math.sin(a) * (br - 1)), MID);
          pc.px(Math.round(bx - br * 0.5), Math.round(by - br * 0.75), HI);
        }
      });
      for (let x = 10; x < w; x += 34 + r.int(0, 30)) bush(x, h - 30 - r.int(0, 28), 12 + r.int(0, 12));
      // samambaias
      for (let i = 0; i < 9; i++) {
        const x = r.int(0, w - 1), len = r.int(20, 44), dir = r() < 0.5 ? -1 : 1;
        wrap(w, (o) => {
          pc.curve(x + o, h, x + o + dir * 4, h - len, x + o + dir * len * 0.6, h - len + 6, DK, 0);
          for (let k = 4; k < len; k += 4) { const yy = h - k; pc.line(x + o + dir * (k * 0.25), yy, x + o + dir * (k * 0.25) + dir * 6, yy - 3, DK); pc.line(x + o + dir * (k * 0.25), yy, x + o + dir * (k * 0.25) - dir * 5, yy - 2, DK); }
        });
      }
      pc.rect(0, h - 26, w, 26, DK);
      // pontos de luz (cogumelos minúsculos)
      for (let i = 0; i < 18; i++) {
        const x = r.int(2, w - 3), y = h - r.int(10, 50), c = r() < 0.5 ? '#5ff0e8' : '#ff7ac8';
        wrap(w, (o) => { pc.circle(x + o, y, 3, c + '22'); pc.px(x + o, y, c); pc.px(x + o, y + 1, '#1a1428'); });
      }
    },
    animate: glints(14, 23, 0.58, ['#d8ff9a', '#9af0ff', '#ffb8e8'], -40, 140, true),
  },
];

const front = [
  // névoa roxa rasteira na frente de tudo
  {
    width: 512, height: 70, speed: 1.2, speedY: 0.2, drift: 9, alpha: 0.3, y: 14,
    paint(pc, w, h) {
      const r = lrng(404);
      for (let i = 0; i < 10; i++) {
        const cx = r.int(0, w), cy = r.int(24, h - 10), rx = r.int(50, 110), ry = r.int(8, 18);
        wrap(w, (o) => pc.dither(Math.round(cx + o - rx), Math.round(cy - ry), rx * 2, ry * 2, null, '#a68ae2', (x, y) => {
          const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
          return d < 1 ? (1 - d) * 0.85 : 0;
        }));
      }
      pc.dither(0, h - 24, w, 24, null, '#a68ae2', (x, y) => (y / 24) * 0.8);
    },
  },
];

registerBackground('w1', { sky, layers, front });
