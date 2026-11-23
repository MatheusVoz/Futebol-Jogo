// =============================================================================
// art/tico.js — Spritesheet DEFINITIVO do TICO, o dinossauro de pelúcia (v2).
//
// Quadro 64x52, pivô nos pés (32,51), olhando para a DIREITA. Corpo+cabeça
// ~36 px de altura, centrados no pivô (hitbox do jogador continua 12x18).
//
// Como funciona:
//   • As POSES são descritas em "unidades de pose" (espaço 48x40 antigo, pivô
//     (24,39)) e mapeadas para o quadro 64x52 com escala SC no momento de
//     desenhar — assim todas as poses-chave continuam valendo.
//   • drawTicoPose(pc, pose) desenha o boneco a partir de uma POSE paramétrica
//     (deslocamento/achatamento do corpo, cabeça + inclinação, curva do
//     pescoço, fases das pernas, ângulo da cauda, braço, olho, boca, espinhos
//     eriçados, costuras brilhando, enchimento saindo...).
//   • Volumes de pelúcia (cabeça, corpo, focinho, barriga, cauda, pescoço,
//     patas) são sombreados pixel a pixel: 5 tons por material, luz de
//     cima-esquerda, luz de contorno no topo, dithering ordenado + "fiapos"
//     de tecido presos ao volume (a textura acompanha o movimento), oclusão
//     onde a cabeça encontra o pescoço e onde o corpo encontra as pernas.
//   • Detalhes: costuras tracejadas (pescoço, costas, barriga, focinho),
//     espinhos de feltro com sombreado próprio, manchas bordadas, olho grande
//     e brilhante (2 brilhos + pálpebra), narina, boquinha costurada,
//     almofadinhas claras nas patas.
//   • Poses com rotação/espelho (deitado, morte, giro) passam todas as
//     primitivas por uma "vista" transformada (view), desenhando nativamente.
//   • meta(anim, f) → {head (topo-centro da cabeça), neck, back, tilt} em
//     coordenadas locais do quadro 64x52, calculado da MESMA pose.
//
// Animações (nomes exigidos por player.js + extras de cutscene):
//   idle walk run skid jump fall land attack1 attack2 attack3 attack_up
//   attack_down charge dash hurt death swim cast celebrate sleep scared
//   look_up look_down · lying wake wave sad surprise think
// =============================================================================
import { defineSprite } from '../../engine/sprites.js';

const C = {
  body: '#3fc7c0', shade: '#2a9d97', dark: '#1f7f7c', light: '#7fe6df', hi: '#b6f6f0',
  spine: '#ffd23f', spineD: '#e0a020', spineDD: '#b47a14', spineL: '#fff0a0',
  eye: '#120a18', glint: '#ffffff', glint2: '#c9d2ff', eyeR: '#3a2c5e',
  spotY: '#ffd23f', spotYE: '#d49a1a', spotYL: '#fff0a0',
  spotO: '#ff8a3c', spotOE: '#c95a22', spotOL: '#ffc08a',
  spotB: '#4a7fe0', spotBE: '#2c52a8', spotBL: '#9ab8ff',
  out: '#1b2a3a', mouth: '#1b4a4a', tongue: '#ff7a96', seam: '#1c7470', seamL: '#2a9d97', blush: '#ff8fb0',
  pad: '#c4f8f2', gold: '#ffd23f', goldL: '#fff6a8', goldD: '#e0a020',
  stuff: '#f6f2ff', stuffS: '#cfc8e6', tear: '#9fe0ff', zz: '#dff4ff',
};
// 5 tons por material (escuro → brilho)
const TB = ['#1f7f7c', '#2a9d97', '#3fc7c0', '#7fe6df', '#b6f6f0'];   // tecido turquesa
const TK = ['#16605d', '#1f7f7c', '#2a9d97', '#3fc7c0', '#62d6cf'];   // membros de trás (na sombra)
const TL = ['#36aaa4', '#5ad3cc', '#82e7e0', '#aaf1eb', '#d4faf6'];   // tecido claro (barriga/focinho)

const W = 64, H = 52;
const SC = 1.3;                 // escala unidades de pose → pixels do quadro
const OP = { x: 24, y: 39 };    // pivô no espaço de pose
const PV = { x: 32, y: 51 };    // pivô no quadro
const RC = { x: 24, y: 31.5 };  // centro das rotações do boneco inteiro (espaço de pose)

const ANIMS = {
  idle: { frames: 8, fps: 6 }, walk: { frames: 8, fps: 12 }, run: { frames: 8, fps: 16 },
  skid: { frames: 3, fps: 10 }, jump: { frames: 3, fps: 10, loop: false }, fall: { frames: 3, fps: 8 },
  land: { frames: 3, fps: 16, loop: false },
  attack1: { frames: 4, fps: 18, loop: false }, attack2: { frames: 4, fps: 18, loop: false },
  attack3: { frames: 5, fps: 18, loop: false }, attack_up: { frames: 4, fps: 18, loop: false },
  attack_down: { frames: 4, fps: 18, loop: false }, charge: { frames: 4, fps: 12 },
  dash: { frames: 3, fps: 16 }, hurt: { frames: 2, fps: 10 }, death: { frames: 10, fps: 10, loop: false },
  swim: { frames: 6, fps: 10 }, cast: { frames: 6, fps: 12 }, celebrate: { frames: 10, fps: 10 },
  sleep: { frames: 4, fps: 2 }, scared: { frames: 4, fps: 12 }, look_up: { frames: 2, fps: 4 },
  look_down: { frames: 2, fps: 4 },
  // extras de cutscene
  lying: { frames: 2, fps: 1 }, wake: { frames: 8, fps: 8, loop: false }, wave: { frames: 6, fps: 10 },
  sad: { frames: 4, fps: 4 }, surprise: { frames: 4, fps: 12, loop: false }, think: { frames: 4, fps: 4 },
};
// ----------------------------------------------------------------- pose base
const BASE = {
  bx: 0, by: 0,          // deslocamento do corpo
  sq: 0,                 // achatamento (+ achata e alarga / - estica)
  hx: 0, hy: 0,          // deslocamento extra da cabeça
  tilt: 0,               // inclinação da cabeça (rad; + = horário, p/ frente/baixo)
  neck: 0,               // curvatura extra do pescoço (+ = arqueia p/ trás)
  lf: [0, 0], lb: [0, 0],// pés dianteiro/traseiro: [dx, altura erguida]
  fy: 0,                 // deslocamento vertical da base dos pés (no ar)
  tail: 0, tailLen: 0,   // ângulo extra (+ = mais erguida) e comprimento extra da cauda
  arm: 0.55, arm2: null, armLen: 3.8, // ângulo do braço (0 = frente, +π/2 = baixo, -π/2 = cima); arm2 = braço de trás
  eye: 'open', mouth: 'smile', look: [0, 0], blush: true,
  spikes: 0, wig: 0,     // espinhos eriçados / balanço dos espinhos
  glow: 0, stuff: 0, tear: 0,
  rot: 0, flip: false, rox: 0, roy: 0, // transformação do boneco inteiro
  whip: null,            // { to:[x,y], c:[x,y]?, amp, k, ph } (coords do quadro)
  fx: null,              // efeitos: [{k:'smear'|'spark'|'z'|'drop'|'orb'|'speed'|'dots'|'aura'|'ring', ...}]
};
const K = (o) => Object.assign({}, BASE, o);
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ geometria
function geo(p) {
  const s = p.sq;
  const brx = 7.2 * (1 + 0.13 * s), bry = 5.6 * (1 - 0.15 * s);
  const B = { x: 20 + p.bx, y: 31.5 + p.by + s * 0.85 };
  const H0 = { x: 33 + p.bx + p.hx, y: 17 + p.by + p.hy + s * 1.5 };
  const hrx = 7, hry = 6.4;
  const N0 = { x: B.x + 3.2, y: B.y - bry + 2.6 };
  const N2 = { x: H0.x - 2.4, y: H0.y + 3.6 };
  const N1 = { x: (N0.x + N2.x) / 2 - 1.4 - p.neck, y: (N0.y + N2.y) / 2 + 0.6 };
  const S = { x: B.x + 4.2, y: B.y - 1.2 };            // ombro
  const paw = { x: S.x + Math.cos(p.arm) * p.armLen, y: S.y + Math.sin(p.arm) * p.armLen };
  return { B, brx, bry, H: H0, hrx, hry, N0, N1, N2, S, paw };
}
const bz = (a, b, c, t) => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y };
};
// ------------------------------------------------------------- primitivas
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const hex2 = (a) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, '0');

/**
 * Volume de pelúcia sombreado pixel a pixel. sample(px,py) → [u,v] (normal
 * projetada no disco unitário) ou null. (ax,ay) = âncora da textura (presa ao
 * volume, para o tecido não "escorrer" quando ele se move).
 */
function plush(pc, x0, y0, x1, y1, sample, tones, base, ax, ay, rim) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const s = sample(x + 0.5, y + 0.5);
      if (!s) continue;
      const u = s[0], v = s[1], d2 = u * u + v * v;
      if (d2 > 1) continue;
      const lam = -0.55 * u - 0.7 * v + 0.45 * Math.sqrt(1 - d2);
      let lv = base + lam * 1.8;
      if (lam > 0.93) lv += 0.55;                                // brilho macio
      if (rim && v < -0.45 && d2 > 0.62) lv = Math.max(lv, 3.15); // luz de contorno no topo
      const lx = x - ax, ly = y - ay;
      lv += (BAYER[(ly & 3) * 4 + (lx & 3)] / 16 - 0.47) * 0.5;  // dithering ordenado
      const h = hash(lx, ly);
      if (h < 0.045) lv += 0.6; else if (h > 0.965) lv -= 0.6;   // fiapos do tecido
      pc.px(x, y, tones[lv < 0 ? 0 : lv >= 4 ? 4 : lv | 0]);
    }
  }
}
function plushBall(pc, cx, cy, rx, ry, tones, base = 1.9, rim = true) {
  plush(pc, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1,
    (x, y) => [(x - cx) / rx, (y - cy) / ry], tones, base, Math.round(cx), Math.round(cy), rim);
}
function plushTube(pc, S, tones, base = 1.9, rim = true) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of S) { x0 = Math.min(x0, s.x - s.r); y0 = Math.min(y0, s.y - s.r); x1 = Math.max(x1, s.x + s.r); y1 = Math.max(y1, s.y + s.r); }
  plush(pc, x0 - 1, y0 - 1, x1 + 1, y1 + 1, (x, y) => {
    let best = -1, bu = 0, bv = 0;
    for (const s of S) {
      const dx = x - s.x, dy = y - s.y, k = 1 - Math.hypot(dx, dy) / s.r;
      if (k > best) { best = k; bu = dx / s.r; bv = dy / s.r; }
    }
    return best >= 0 ? [bu, bv] : null;
  }, tones, base, Math.round(S[0].x), Math.round(S[0].y), rim);
}
/** Costura tracejada ao longo de uma polilinha (coords do quadro). */
function seamPath(pc, pts, col, on = 2, per = 3) {
  let k = 0, last = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let j = 0; j < n; j++) {
      const x = Math.floor(a.x + (b.x - a.x) * (j / n)), y = Math.floor(a.y + (b.y - a.y) * (j / n));
      if (last && last[0] === x && last[1] === y) continue;
      last = [x, y];
      if ((k++ % per) < on) pc.px(x, y, col);
    }
  }
}

// ------------------------------------------------------------ transformação
/** Espaço de pose → quadro (rotação em torno de RC, translação, escala, espelho). */
function xf(x, y, p) {
  if (p.rot) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - RC.x, dy = y - RC.y;
    x = RC.x + dx * c - dy * s; y = RC.y + dx * s + dy * c;
  }
  x = PV.x + (x + p.rox - OP.x) * SC;
  y = PV.y + (y + p.roy - OP.y) * SC;
  if (p.flip) x = W - x;
  return { x, y };
}
/** Só a escala (efeitos posicionados no espaço de pose). */
const M = (x, y) => ({ x: PV.x + (x - OP.x) * SC, y: PV.y + (y - OP.y) * SC });

/**
 * "Vista" transformada: todas as primitivas passam por xf e são desenhadas
 * NATIVAMENTE no quadro final (sem reamostrar pixels). Elipses giradas viram
 * elipses alinhadas com raios equivalentes (o Tico é todo redondinho); a luz
 * do sombreamento continua vindo de cima-esquerda na tela.
 */
function view(pc, p) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const T = (x, y) => xf(x, y, p);
  const R = (rx, ry) => (p.rot ? [Math.hypot(rx * c, ry * s) * SC, Math.hypot(rx * s, ry * c) * SC] : [rx * SC, ry * SC]);
  const V = {
    pt: T,
    px(x, y, col) { const q = T(x, y); pc.px(Math.floor(q.x), Math.floor(q.y), col); },
    circle(cx, cy, r, col) { const q = T(cx, cy); pc.circle(q.x, q.y, r * SC, col); },
    ellipse(cx, cy, rx, ry, col) { const q = T(cx, cy), [a, b] = R(rx, ry); pc.ellipse(q.x, q.y, a, b, col); },
    line(x0, y0, x1, y1, col) { const a = T(x0, y0), b = T(x1, y1); pc.line(Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y), col); },
    poly(pts, col) { pc.poly(pts.map(([x, y]) => { const q = T(x, y); return [q.x, q.y]; }), col); },
    ball(cx, cy, rx, ry, tones, base, rim) { const q = T(cx, cy), [a, b] = R(rx, ry); plushBall(pc, q.x, q.y, a, b, tones, base, rim); },
    tube(S, tones, base, rim) { plushTube(pc, S.map((o) => { const q = T(o.x, o.y); return { x: q.x, y: q.y, r: o.r * SC }; }), tones, base, rim); },
    seam(pts, col, on, per) { seamPath(pc, pts.map((o) => T(o.x, o.y)), col, on, per); },
    arc(cx, cy, rx, ry, a0, a1, rot = 0) { // pontos de um arco (graus) no espaço de pose
      const out = [], n = Math.max(3, Math.ceil(Math.abs(a1 - a0) / 8));
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let i = 0; i <= n; i++) {
        const a = ((a0 + (a1 - a0) * (i / n)) * Math.PI) / 180, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        out.push({ x: cx + ex * cr - ey * sr, y: cy + ex * sr + ey * cr });
      }
      return out;
    },
    /** canto sup.-esq. (na tela) de um padrão de w px ancorado em (x,y) */
    anchor(x, y, w = 3) { const q = T(x, y); return [Math.round(q.x) - (p.flip ? w - 1 : 0), Math.round(q.y)]; },
  };
  return V;
}

// ------------------------------------------------------------ partes do corpo
/** Espinho de feltro macio: base (bx,by), direção (nx,ny) — espaço de pose. */
function felt(V, bx, by, nx, ny, len, half, glow) {
  const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
  const tx = bx + nx * len, ty = by + ny * len, px = -ny, py = nx;
  const a = [bx + px * half, by + py * half], b = [bx - px * half, by - py * half];
  const litA = (px * -0.7 + py * -0.7) > 0, lit = litA ? a : b, dk = litA ? b : a;
  const cD = glow ? C.spineD : C.spineDD, cM = glow ? C.spine : C.spineD, cL = glow ? C.goldL : C.spine, cH = glow ? '#ffffff' : C.spineL;
  V.poly([a, [tx, ty], b], cM);
  V.poly([dk, [tx, ty], [bx + nx * len * 0.3, by + ny * len * 0.3]], cD);           // face na sombra
  V.poly([lit, [tx - nx * 0.4, ty - ny * 0.4], [bx + nx * 0.5, by + ny * 0.5]], cL); // face iluminada
  V.line(lit[0] * 0.75 + bx * 0.25 + nx * 0.6, lit[1] * 0.75 + by * 0.25 + ny * 0.6, bx + nx * len * 0.62 + px * 0.1, by + ny * len * 0.62 + py * 0.1, cH);
}
/** Mancha bordada: borda de ponto-cheio mais escura + brilho de linha. */
function spot(V, pc, x, y, r, col, edge, lite) {
  V.circle(x, y, r, edge);
  V.circle(x - 0.12, y - 0.12, r - 0.55, col);
  const q = V.pt(x - r * 0.38, y - r * 0.42);
  pc.px(Math.floor(q.x), Math.floor(q.y), lite);
}
function tailCurve(g, p) {
  const { B } = g;
  const a = 0.78 + p.tail, L = 9.5 + p.tailLen;
  const P0 = { x: B.x - g.brx + 2.8, y: B.y + 1 };
  const P2 = { x: P0.x - Math.cos(a) * L, y: P0.y - Math.sin(a) * L };
  const P1 = { x: P0.x - Math.cos(a - 0.9) * L * 0.62, y: P0.y - Math.sin(a - 0.9) * L * 0.62 + 1.2 };
  return { P0, P1, P2 };
}
function drawLeg(V, pc, hx, hy, foot, tones, p) {
  const fx = hx + foot[0], fy = 37.6 + p.fy - foot[1];
  V.tube([{ x: hx, y: hy, r: 2.2 }, { x: (hx + fx) / 2, y: (hy + fy - 1) / 2, r: 2.0 }, { x: fx, y: fy - 1, r: 1.9 }], tones, 1.8, false);
  V.ball(fx + 0.9, fy, 2.8, 1.75, tones, 2.0, true);
  // almofadinhas claras na sola + dedinho costurado
  const a = V.pt(fx - 0.6, fy + 1.05), b = V.pt(fx + 2.6, fy + 1.05);
  pc.line(Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y), tones === TK ? TK[4] : C.pad);
  V.px(fx + 2.4, fy - 0.6, tones[0]);
}
function drawArm(V, pc, sx, sy, ang, tones, len) {
  const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
  V.tube([{ x: sx, y: sy, r: 1.7 }, { x: (sx + ex) / 2, y: (sy + ey) / 2, r: 1.55 }, { x: ex, y: ey, r: 1.6 }], tones, 1.9, true);
  const q = V.pt(ex + Math.cos(ang) * 0.9, ey + Math.sin(ang) * 0.9);
  pc.px(Math.floor(q.x), Math.floor(q.y), tones === TK ? TK[4] : C.pad); // almofadinha
}

// ---------------------------------------------------------------- rosto
/** Olho (4x6) com 2 brilhos e pálpebra; (x,y) = canto sup.-esq. */
function drawEye(pc, x, y, st) {
  const E = C.eye, D = C.dark;
  const open = () => {
    pc.rect(x, y + 1, 4, 4, E); pc.hline(x + 1, y, 2, E); pc.hline(x + 1, y + 5, 2, E);
    pc.px(x + 3, y + 4, C.eyeR); pc.px(x + 2, y + 5, C.eyeR);              // reflexo roxo embaixo
    pc.rect(x, y + 1, 2, 2, C.glint); pc.px(x + 2, y + 4, C.glint2);       // 2 brilhos
  };
  switch (st) {
    case 'closed':
      pc.px(x - 1, y + 3, E); pc.px(x, y + 4, E); pc.hline(x + 1, y + 5, 2, E); pc.px(x + 3, y + 4, E); pc.px(x + 4, y + 3, E);
      pc.px(x - 1, y + 2, D); break;
    case 'happy':
      pc.px(x - 1, y + 4, E); pc.px(x, y + 3, E); pc.hline(x + 1, y + 2, 2, E); pc.px(x + 3, y + 3, E); pc.px(x + 4, y + 4, E);
      pc.px(x, y + 4, E); pc.px(x + 3, y + 4, E); break;
    case 'squeeze':
      pc.px(x, y + 1, E); pc.px(x + 1, y + 2, E); pc.px(x + 2, y + 3, E); pc.px(x + 3, y + 3, E); pc.px(x + 1, y + 4, E); pc.px(x, y + 5, E);
      pc.px(x - 1, y, D); break;
    case 'x': // olho de botão costurado em X
      for (let i = 0; i < 5; i++) { pc.px(x - 1 + i, y + 1 + i, E); pc.px(x + 3 - i, y + 1 + i, E); }
      break;
    case 'half':
      pc.rect(x, y + 3, 4, 2, E); pc.hline(x + 1, y + 5, 2, E); pc.px(x, y + 3, C.glint); pc.px(x + 1, y + 3, C.glint);
      pc.hline(x - 1, y + 2, 6, D); break;
    case 'wide':
      pc.rect(x - 1, y, 6, 6, '#ffffff'); pc.hline(x, y - 1, 4, '#ffffff'); pc.hline(x, y + 6, 4, '#ffffff');
      pc.px(x - 1, y, '#d8eef0'); pc.px(x + 4, y + 5, '#d8eef0'); pc.px(x + 4, y, '#d8eef0'); pc.px(x - 1, y + 5, '#d8eef0');
      pc.rect(x + 1, y + 1, 2, 4, E); pc.px(x + 3, y + 2, E); pc.px(x + 3, y + 3, E);
      pc.px(x + 1, y + 1, C.glint); pc.hline(x, y - 2, 4, D); break;
    case 'sad':
      open(); pc.px(x, y + 1, C.body); pc.px(x + 1, y, C.body); pc.px(x, y + 2, D); pc.px(x + 1, y + 1, D); pc.px(x + 2, y, D);
      pc.px(x - 1, y - 1, C.mouth); pc.px(x, y - 2, C.mouth); pc.px(x + 1, y - 2, C.mouth); pc.px(x + 2, y - 3, C.mouth); break;
    case 'det':
      open(); pc.px(x + 3, y + 1, C.body); pc.px(x + 2, y, C.body); pc.px(x + 3, y + 2, D); pc.px(x + 2, y + 1, D); pc.px(x + 1, y, D);
      pc.px(x - 1, y - 2, C.mouth); pc.px(x, y - 2, C.mouth); pc.px(x + 1, y - 1, C.mouth); pc.px(x + 2, y - 1, C.mouth); pc.px(x + 3, y, C.mouth); break;
    default:
      open(); pc.hline(x + 1, y - 1, 2, D); pc.px(x, y, D); pc.px(x - 1, y, D); // pálpebra + cílio
  }
}
/** Boquinha costurada; (x,y) = centro-topo. */
function drawMouth(pc, x, y, st) {
  const Mo = C.mouth;
  switch (st) {
    case 'line': pc.hline(x - 1, y + 1, 3, Mo); break;
    case 'flat': pc.hline(x - 1, y + 1, 3, Mo); pc.px(x - 2, y, Mo); break;
    case 'sad': pc.px(x - 2, y + 2, Mo); pc.px(x - 1, y + 1, Mo); pc.px(x, y + 1, Mo); pc.px(x + 1, y + 2, Mo); break;
    case 'o': pc.px(x, y, Mo); pc.hline(x - 1, y + 1, 3, Mo); pc.px(x, y + 2, Mo); pc.px(x, y + 1, C.tongue); break;
    case 'open': pc.hline(x - 2, y, 4, Mo); pc.px(x - 2, y + 1, Mo); pc.hline(x - 1, y + 1, 2, C.tongue); pc.px(x + 1, y + 1, Mo); pc.hline(x - 1, y + 2, 2, Mo); break;
    case 'grin': pc.hline(x - 3, y, 6, Mo); pc.px(x - 2, y + 1, Mo); pc.hline(x - 1, y + 1, 2, C.tongue); pc.px(x + 1, y + 1, Mo); pc.hline(x - 1, y + 2, 2, Mo); break;
    case 'wavy': for (let i = 0; i < 6; i++) pc.px(x - 3 + i, y + (i % 2 ? 0 : 1), Mo); break;
    default: pc.px(x - 2, y, Mo); pc.px(x - 1, y + 1, Mo); pc.px(x, y + 1, Mo); pc.px(x + 1, y + 1, Mo); pc.px(x + 2, y, Mo); // sorrisinho
  }
}

// ------------------------------------------------------- desenho da pose
function drawTicoPose(pc, p) {
  const g = geo(p);
  const V = view(pc, p);
  const { B, brx, bry, H: Hc, hrx, hry } = g;
  const ct = Math.cos(p.tilt), st = Math.sin(p.tilt);
  const hp = (dx, dy) => [Hc.x + dx * ct - dy * st, Hc.y + dx * st + dy * ct];
  const hn = (dx, dy) => [dx * ct - dy * st, dx * st + dy * ct];
  const glow = p.glow > 0.05;
  const seamC = glow ? (p.glow > 0.6 ? C.goldL : C.gold) : C.seam;
  const seamL = glow ? seamC : C.seamL;
  const sp = 1 + 0.3 * p.spikes;

  // ---- cauda grossa e arredondada
  const tail = tailCurve(g, p);
  const TS = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9, q = bz(tail.P0, tail.P1, tail.P2, t);
    TS.push({ x: q.x, y: q.y, r: 3.7 - 1.7 * t + (t > 0.85 ? 0.45 : 0) });
  }
  { // espinho da cauda (atrás)
    const q = bz(tail.P0, tail.P1, tail.P2, 0.45), q2 = bz(tail.P0, tail.P1, tail.P2, 0.5);
    felt(V, q.x, q.y - 1.6, q2.y - q.y, q.x - q2.x, 2.4 * sp, 1.3, glow);
  }
  V.tube(TS, TB, 1.85, true);
  { const s = bz(tail.P0, tail.P1, tail.P2, 0.72); spot(V, pc, s.x, s.y + 0.2, 1.25, C.spotB, C.spotBE, C.spotBL); }

  // ---- pernas (atrás do corpo: o corpo faz a oclusão do quadril) + braço de trás
  drawLeg(V, pc, B.x - 3.4, B.y + bry * 0.45, p.lb, TK, p);
  drawLeg(V, pc, B.x + 2.6, B.y + bry * 0.45, p.lf, TB, p);
  if (p.arm2 != null) drawArm(V, pc, g.S.x - 1.6, g.S.y - 0.4, p.arm2, TK, p.armLen);

  // ---- espinhos das costas e do pescoço (atrás)
  [[-112, 3.9, 2], [-140, 3.6, 1.9], [-166, 3.1, 1.7]].forEach(([a, len, half], i) => {
    const r = ((a + (i % 2 ? 12 : -12) * p.wig) * Math.PI) / 180;
    felt(V, B.x + Math.cos(r) * (brx - 1), B.y + Math.sin(r) * (bry - 1), Math.cos(r), Math.sin(r), len * sp, half, glow);
  });
  { const q = bz(g.N0, g.N1, g.N2, 0.55); felt(V, q.x - 1.6, q.y, -1, -0.45 + p.wig * 0.2, 3 * sp, 1.6, glow); }

  // ---- corpo + oclusão nas pernas
  V.ball(B.x, B.y, brx, bry, TB, 1.9, true);
  // painel claro da barriga (redondo, costurado)
  V.ball(B.x + 3.1, B.y + 1.6, 3.7, 3.3, TL, 2.0, false);
  V.seam(V.arc(B.x + 3.1, B.y + 1.6, 4.1, 3.75, 150, 318), seamC);
  // costura das costas (abaixo dos espinhos)
  V.seam(V.arc(B.x, B.y, brx - 1.5, bry - 1.3, -98, -178), seamC);
  // manchas bordadas
  spot(V, pc, B.x - 2.6, B.y - 0.4, 1.9, C.spotY, C.spotYE, C.spotYL);
  spot(V, pc, B.x - 5.4, B.y + 2.5, 1.2, C.spotO, C.spotOE, C.spotOL);
  spot(V, pc, B.x + 0.2, B.y - 3.4, 1.15, C.spotB, C.spotBE, C.spotBL);
  // enchimento saindo pela costura (morte) — tufos sobem na TELA
  if (p.stuff > 0) {
    const o = V.pt(B.x + 3.2, B.y - 0.8);
    pc.hline(Math.round(o.x - 2), Math.round(o.y + 1), 5, C.dark);
    const puffs = [[0, -1.5, 2.6], [3, -3.2, 2.2], [-2.8, -3.2, 2.1], [0.6, -5.8, 2.1], [4, -0.5, 1.7]];
    for (let i = 0; i < Math.min(puffs.length, 1 + p.stuff); i++) {
      const [dx, dy, r] = puffs[i];
      pc.circle(o.x + dx + 0.5, o.y + dy + 0.5, r, C.stuffS);
      pc.circle(o.x + dx, o.y + dy, r - 0.4, C.stuff);
      pc.px(Math.floor(o.x + dx - r * 0.4), Math.floor(o.y + dy - r * 0.4), '#ffffff');
    }
  }

  // ---- pescoço (tubo de pelúcia) + costura na nuca
  const NS = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8, q = bz(g.N0, g.N1, g.N2, t); NS.push({ x: q.x, y: q.y, r: 2.9 - 0.55 * t }); }
  V.tube(NS, TB, 1.95, true);
  {
    const pts = [];
    for (let i = 2; i <= 8; i++) {
      const t = i / 10, q = bz(g.N0, g.N1, g.N2, t), q2 = bz(g.N0, g.N1, g.N2, t + 0.02);
      let tx = q2.x - q.x, ty = q2.y - q.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const r = 2.9 - 0.55 * t - 1.05;
      pts.push({ x: q.x + ty * r, y: q.y - tx * r });
    }
    V.seam(pts, seamC);
  }
  // oclusão sob a cabeça
  { const q = bz(g.N0, g.N1, g.N2, 0.88); V.ellipse(q.x + 0.4, q.y + 0.2, 2.6, 2.2, C.dark); }

  // ---- espinhos da cabeça (atrás)
  [[-96, 4.2, 2.1], [-130, 4.8, 2.3], [-164, 4.1, 2.05]].forEach(([a, len, half], i) => {
    const r = ((a + (i % 2 ? -10 : 10) * p.wig) * Math.PI) / 180;
    const [bx, by] = hp(Math.cos(r) * (hrx - 1.1), Math.sin(r) * (hry - 1.1));
    const [nx, ny] = hn(Math.cos(r), Math.sin(r));
    felt(V, bx, by, nx, ny, len * sp, half, glow);
  });

  // ---- cabeça
  V.ball(Hc.x, Hc.y, hrx, hry, TB, 1.95, true);
  { const [ax, ay] = hp(-3.5, -1.3); spot(V, pc, ax, ay, 1.5, C.spotY, C.spotYE, C.spotYL); }
  { const [ax, ay] = hp(-0.9, -4.3); spot(V, pc, ax, ay, 1.05, C.spotB, C.spotBE, C.spotBL); }
  { const [ax, ay] = hp(-4.6, 2.4); spot(V, pc, ax, ay, 0.95, C.spotO, C.spotOE, C.spotOL); }
  // focinho (peça clara, costurada com fio dourado) + narina
  {
    const [mx, my] = hp(4.5, 2.2);
    V.ball(mx, my, 3.8, 2.8, TL, 2.0, true);
    V.seam(V.arc(mx, my, 4.3, 3.3, 118, 255, p.tilt), glow ? C.goldL : C.gold, 1, 2);
    const [nx, ny] = hp(7.0, 0.9);
    const [ax, ay] = V.anchor(nx, ny, 2);
    pc.hline(ax - (p.flip ? 0 : 1), ay, 2, C.mouth); pc.px(ax - (p.flip ? -1 : 0), ay + 1, TL[0]);
  }
  // rosto (padrões de olho/boca ficam "em pé" na tela, ancorados na cabeça)
  if (p.blush && p.eye !== 'x' && p.eye !== 'sad') {
    const [bx, by] = hp(0.4, 2.7); const [ax, ay] = V.anchor(bx, by, 3);
    pc.hline(ax, ay, 3, C.blush); pc.px(ax, ay + 1, C.blush + '99'); pc.px(ax + 2, ay + 1, C.blush + '99');
  }
  const [ex0, ey0] = hp(0.7 + p.look[0], -3.1 + p.look[1]);
  const [ex, ey] = V.anchor(ex0, ey0, 4);
  drawEye(pc, ex, ey, p.eye);
  if (p.tear) { pc.px(ex + 3, ey + 6 + p.tear, C.tear); pc.px(ex + 3, ey + 7 + p.tear, C.tear); pc.px(ex + 2, ey + 7 + p.tear, '#ffffff'); }
  { const [mx, my] = hp(5.1, 3.5); const [ax, ay] = V.anchor(mx, my, 1); drawMouth(pc, ax, ay, p.mouth); }

  // ---- braço da frente (patinha)
  drawArm(V, pc, g.S.x, g.S.y, p.arm, TB, p.armLen);
  return g;
}

// ------------------------------------------------------------------ efeitos
function drawWhip(pc, x0, y0, w) {
  const B2 = M(w.to[0], w.to[1]);
  const c = w.c ? M(w.c[0], w.c[1]) : { x: (x0 + B2.x) / 2, y: (y0 + B2.y) / 2 };
  const A = { x: x0, y: y0 };
  const len = Math.hypot(B2.x - x0, B2.y - y0) + Math.hypot(c.x - (x0 + B2.x) / 2, c.y - (y0 + B2.y) / 2);
  const N = Math.max(4, Math.ceil(len * 1.4));
  let l = A;
  for (let i = 1; i <= N; i++) {
    const t = i / N, q = bz(A, c, B2, t), q2 = bz(A, c, B2, Math.min(1, t + 0.01));
    let tx = q2.x - q.x, ty = q2.y - q.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const off = (w.amp || 0) * SC * Math.sin(t * Math.PI) * Math.sin(t * Math.PI * (w.k || 3) + (w.ph || 0));
    const pt = { x: q.x - ty * off, y: q.y + tx * off };
    pc.line(Math.floor(l.x), Math.floor(l.y), Math.floor(pt.x), Math.floor(pt.y), t > 0.82 ? C.goldL : (i % 4 === 0 ? C.goldL : C.gold));
    l = pt;
  }
}
function star(pc, x, y, s) {
  x = Math.round(x); y = Math.round(y);
  for (let i = 1; i <= s; i++) {
    const c = i === s ? C.gold : C.goldL;
    pc.px(x + i, y, c); pc.px(x - i, y, c); pc.px(x, y + i, c); pc.px(x, y - i, c);
  }
  pc.px(x, y, '#ffffff');
}
function smear(pc, cx, cy, r, a0, a1, th = 2) {
  const steps = Math.ceil(Math.abs(a1 - a0) * r * 1.6);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = a0 + (a1 - a0) * t;
    for (let k = 0; k < th; k++) pc.px(cx + Math.cos(a) * (r - k), cy + Math.sin(a) * (r - k), C.goldL + hex2(30 + 190 * t * (k ? 0.55 : 1)));
  }
}
function drawFxPre(pc, p) {
  for (const e of p.fx || []) {
    if (!('x' in e)) continue;
    const q = M(e.x, e.y), x = Math.round(q.x), y = Math.round(q.y);
    if (e.k === 'z') { pc.hline(x, y, 4, C.zz); pc.px(x + 2, y + 1, C.zz); pc.px(x + 1, y + 2, C.zz); pc.hline(x, y + 3, 4, C.zz); }
    else if (e.k === 'drop') { pc.px(x + 1, y, C.tear); pc.rect(x, y + 1, 3, 2, C.tear); pc.px(x + 1, y + 3, C.tear); pc.px(x, y + 1, '#ffffff'); }
    else if (e.k === 'dots') { for (let i = 0; i < e.n; i++) pc.rect(x + i * 4, y - i * 2, 2, 2, '#ffffff'); }
  }
}
function drawFxPost(pc, p, g) {
  for (const e of p.fx || []) {
    const q = 'x' in e ? M(e.x, e.y) : null;
    switch (e.k) {
      case 'smear': case 'ring': smear(pc, q.x, q.y, e.r * SC, e.a0, e.a1, (e.th || 2) + (e.th === 3 ? 1 : 0)); break;
      case 'spark': star(pc, q.x, q.y, (e.s || 1) + (e.s >= 2 ? 1 : 0)); break;
      case 'orb': {
        const r = e.r * SC;
        pc.circle(q.x, q.y, r + 2, C.goldL + '55');
        pc.circle(q.x, q.y, r, C.gold); pc.circle(q.x - 0.5, q.y - 0.5, r - 1, C.goldL);
        pc.px(Math.round(q.x - 1), Math.round(q.y - 1), '#ffffff');
        break;
      }
      case 'speed':
        for (const [dy, len, a] of [[-4, 7, 'aa'], [0, 9, 'cc'], [3, 5, '88'], [-10, 6, '77']]) {
          const s = M(g.B.x - g.brx - 3 - len, g.B.y + dy);
          pc.hline(Math.round(s.x), Math.round(s.y), Math.round(len * SC), '#ffffff' + a);
        }
        break;
      case 'aura': {
        const n = 7, c = M(24, 26);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + e.ph, x = c.x + Math.cos(a) * 15 * SC, y = c.y + Math.sin(a) * 12 * SC;
          if (i % 2) pc.px(Math.round(x), Math.round(y), C.goldL + 'cc'); else star(pc, x, y, 1);
        }
        break;
      }
      default:
    }
  }
}
// ----------------------------------------------------------- poses-chave
const pawOf = (o) => geo(K(o)).paw;
/** Posa deitado (de costas, como um brinquedo largado). */
function lyingPose(extra) {
  return K(Object.assign({
    rot: -Math.PI / 2, roy: -4.5, rox: 3, hx: -13, hy: -1.5, tilt: 0.5, neck: -1,
    eye: 'closed', mouth: 'line', blush: true, arm: 0.2, lf: [3, 2], lb: [1, 2],
    tail: -2.35, spikes: -1, sq: -1.6,
  }, extra));
}

function poseFor(anim, f, n) {
  const ph = (f / n) * TAU;
  switch (anim) {
    case 'idle': {
      const b = Math.sin(ph);
      return K({ sq: 0.45 * b, hy: Math.round(0.9 * Math.sin(ph - 0.9)), tail: 0.1 * Math.sin(ph + 1),
        arm: 0.55 + 0.12 * b, eye: f === 6 ? 'closed' : f === 5 ? 'half' : 'open', wig: 0.3 * Math.sin(ph - 1.5) });
    }
    case 'walk': {
      const s = Math.sin(ph), c = Math.cos(ph);
      return K({ lf: [3 * s, Math.max(0, c) * 2.2], lb: [-3 * s, Math.max(0, -c) * 2.2],
        by: Math.abs(s) < 0.5 ? -1 : 0, hy: Math.abs(Math.sin(ph - 0.5)) < 0.5 ? -1 : 0, hx: 0.5,
        tail: 0.14 * Math.sin(2 * ph + 1), arm: 0.55 - 0.6 * s, wig: 0.5 * Math.sin(2 * ph) });
    }
    case 'run': {
      const s = Math.sin(ph), c = Math.cos(ph);
      const up = Math.round(1.6 * Math.abs(s));
      return K({ bx: 1, hx: 4, hy: 2.5 - up * 0.5, tilt: 0.18, neck: -1.5, by: -up, fy: -up * 0.6,
        sq: up ? -0.35 : 0.35, lf: [4.5 * s, Math.max(0, c) * 3.5], lb: [-4.5 * s - 1, Math.max(0, -c) * 3.5],
        tail: 0.15 + 0.35 * Math.sin(2 * ph + 1.2), tailLen: 1, arm: 0.3 - 1.0 * s, mouth: 'grin',
        wig: Math.sin(2 * ph + 0.6), spikes: 0.3 });
    }
    case 'skid': {
      const sh = f === 1 ? 0.6 : 0;
      return K({ bx: -1 + sh, hx: -3 + sh, hy: f === 0 ? 0 : 1, tilt: -0.28, sq: 0.35, lf: [5, 0], lb: [-1, 0],
        tail: 0.55, arm: -0.6, eye: 'wide', mouth: 'o', spikes: 0.6, wig: f % 2 ? 0.6 : -0.6 });
    }
    case 'jump':
      if (f === 0) return K({ sq: -0.65, by: -1, fy: 0, lf: [1, 0], lb: [-1.5, 0], arm: -0.7, tail: -0.1, hy: -1 });
      if (f === 1) return K({ sq: -0.3, by: -1, fy: -1, lf: [2, 2.2], lb: [-1, 2.8], arm: -1.15, tail: -0.15, spikes: 0.5, mouth: 'open' });
      return K({ sq: 0, by: -1, fy: -1, lf: [1.5, 1.6], lb: [-1, 1.2], arm: -0.5, tail: 0.25, mouth: 'smile' });
    case 'fall':
      return K({ sq: -0.2, by: -2, fy: 0, lf: [1.5 + (f % 2) * 0.5, 0], lb: [-1.5, (f === 1) ? 0.6 : 0],
        arm: [-1.25, -0.75, -1.0][f], tail: 0.45 + 0.1 * f, eye: 'wide', mouth: 'o', spikes: 0.7, wig: f - 1, hy: -1 });
    case 'land':
      return K({ sq: [1.5, 0.6, -0.15][f], hy: [2, 1, -0.5][f], tail: [-0.3, -0.1, 0.1][f], arm: [1.0, 0.8, 0.5][f],
        eye: f === 0 ? 'closed' : 'open', mouth: f === 0 ? 'line' : 'smile', spikes: f === 0 ? -0.3 : 0 });

    case 'attack1': {
      if (f === 0) {
        const o = { bx: -1, hx: -2, tilt: -0.15, arm: -2.3, sq: 0.3, eye: 'det', mouth: 'flat', tail: 0.3 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x - 6, pw.y + 2], c: [pw.x - 6, pw.y - 5], amp: 0 } }));
      }
      if (f === 1) {
        const o = { bx: 1.5, hx: 2.5, tilt: 0.12, arm: -0.05, sq: -0.2, lf: [2, 0], lb: [-2, 0], eye: 'det', mouth: 'open', spikes: 0.4 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, pw.y - 1], c: [38, pw.y - 4], amp: 0 },
          fx: [{ k: 'smear', x: pw.x - 4, y: pw.y + 2, r: 18, a0: -1.0, a1: -0.12, th: 3 }, { k: 'spark', x: 46, y: pw.y - 1, s: 2 }] }));
      }
      if (f === 2) {
        const o = { bx: 1, hx: 2, tilt: 0.08, arm: 0.05, lf: [2, 0], lb: [-2, 0], eye: 'det', mouth: 'smile' };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, pw.y + 1], amp: 1.3, k: 3, ph: 0 },
          fx: [{ k: 'smear', x: pw.x - 4, y: pw.y + 2, r: 18, a0: -0.6, a1: -0.1, th: 2 }, { k: 'spark', x: 46, y: pw.y + 1, s: 1 }] }));
      }
      {
        const o = { bx: 0, hx: 0.5, arm: 0.45, eye: 'open', mouth: 'smile' };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x + 9, pw.y + 3], c: [pw.x + 6, pw.y - 3], amp: 0.6, k: 2 } }));
      }
    }
    case 'attack2': {
      if (f === 0) {
        const o = { bx: -0.5, hx: -1, hy: -1, tilt: -0.22, arm: -1.7, sq: -0.2, eye: 'det', mouth: 'flat', tail: 0.4 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x - 5, pw.y - 7], c: [pw.x + 2, pw.y - 8] } }));
      }
      if (f === 1) {
        const o = { bx: 1.5, hx: 2.5, hy: 1, tilt: 0.2, arm: 0.5, sq: 0.25, lf: [2.5, 0], lb: [-2, 0], eye: 'det', mouth: 'open', spikes: 0.4 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, 37], c: [42, pw.y - 3] },
          fx: [{ k: 'smear', x: pw.x, y: pw.y, r: 14, a0: -1.0, a1: 0.45, th: 3 }, { k: 'spark', x: 46, y: 36, s: 2 }] }));
      }
      if (f === 2) {
        const o = { bx: 1, hx: 2, hy: 1, tilt: 0.12, arm: 0.45, sq: 0.15, lf: [2.5, 0], lb: [-2, 0], eye: 'det', mouth: 'smile' };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, 35], amp: 1.2, k: 3, ph: 1 },
          fx: [{ k: 'smear', x: pw.x, y: pw.y, r: 14, a0: -0.9, a1: 0.4, th: 2 }, { k: 'spark', x: 46, y: 35, s: 1 }] }));
      }
      {
        const o = { hx: 0.5, arm: 0.6, eye: 'open', mouth: 'smile' };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x + 8, pw.y + 4], c: [pw.x + 5, pw.y - 2], amp: 0.5, k: 2 } }));
      }
    }
    case 'attack3': {
      if (f === 0) {
        const o = { sq: 0.9, bx: -1.5, hx: -2, hy: 1, tilt: -0.1, arm: -2.6, eye: 'det', mouth: 'flat', spikes: 0.8, tail: 0.4, wig: 1 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x - 4, pw.y + 6], c: [pw.x - 9, pw.y - 3], amp: 0.8, k: 2 } }));
      }
      if (f === 1) {
        return K({ flip: true, sq: -0.2, by: -1, arm: -0.9, eye: 'det', mouth: 'open', spikes: 1, tail: 0.5, lf: [1, 1], lb: [-1, 1.5],
          fx: [{ k: 'ring', x: 24, y: 26, r: 16, a0: -0.6, a1: 3.8 }, { k: 'ring', x: 24, y: 26, r: 12, a0: 0.2, a1: 3.6 },
            { k: 'spark', x: 8, y: 26, s: 2 }] });
      }
      if (f === 2) {
        const o = { bx: 2, hx: 3, tilt: 0.12, arm: -0.05, sq: -0.3, lf: [3, 0], lb: [-2.5, 0], eye: 'det', mouth: 'grin', spikes: 1, wig: -1 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, pw.y - 2], c: [40, pw.y - 6], amp: 0 },
          fx: [{ k: 'ring', x: 24, y: 26, r: 17, a0: 1.6, a1: TAU - 0.15 }, { k: 'smear', x: pw.x - 4, y: pw.y + 2, r: 18, a0: -1.05, a1: -0.12, th: 3 },
            { k: 'spark', x: 46, y: pw.y - 2, s: 3 }, { k: 'spark', x: 40, y: pw.y - 8, s: 1 }] }));
      }
      if (f === 3) {
        const o = { bx: 1.5, hx: 2.5, tilt: 0.06, arm: 0.05, sq: -0.1, lf: [3, 0], lb: [-2.5, 0], eye: 'det', mouth: 'smile', spikes: 0.6 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, pw.y], amp: 1.6, k: 4, ph: 0.5 },
          fx: [{ k: 'smear', x: pw.x - 4, y: pw.y + 2, r: 18, a0: -0.6, a1: -0.1, th: 2 }, { k: 'spark', x: 45, y: pw.y - 3, s: 2 }, { k: 'spark', x: 38, y: pw.y + 4, s: 1 }] }));
      }
      {
        const o = { bx: 0.5, hx: 1, arm: 0.5, eye: 'open', mouth: 'smile', spikes: 0.2 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x + 10, pw.y + 4], c: [pw.x + 7, pw.y - 3], amp: 0.7, k: 2 } }));
      }
    }
    case 'attack_up': {
      if (f === 0) {
        const o = { sq: 0.5, hx: -2, tilt: -0.35, arm: 0.6, eye: 'det', mouth: 'flat', look: [0, -1] };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x + 4, pw.y + 5], c: [pw.x + 4, pw.y], amp: 0 } }));
      }
      const o = [null,
        { sq: -0.5, hx: -3, hy: 0, tilt: -0.5, arm: -1.45, eye: 'det', mouth: 'open', spikes: 0.5, look: [0, -1] },
        { sq: -0.3, hx: -3, tilt: -0.45, arm: -1.4, eye: 'det', mouth: 'smile', look: [0, -1] },
        { sq: 0, hx: -1, tilt: -0.2, arm: -0.6, eye: 'open', mouth: 'smile' }][f];
      const pw = pawOf(o);
      if (f === 1) return K(Object.assign(o, { whip: { to: [pw.x + 6, 0], c: [pw.x + 14, pw.y - 8] },
        fx: [{ k: 'smear', x: pw.x + 2, y: pw.y, r: 15, a0: -0.2, a1: -1.5, th: 3 }, { k: 'spark', x: pw.x + 6, y: 1, s: 2 }] }));
      if (f === 2) return K(Object.assign(o, { whip: { to: [pw.x + 4, 0], c: [pw.x + 10, pw.y - 10], amp: 1.2, k: 3 },
        fx: [{ k: 'smear', x: pw.x + 2, y: pw.y, r: 15, a0: -0.5, a1: -1.5, th: 2 }, { k: 'spark', x: pw.x + 4, y: 1, s: 1 }] }));
      return K(Object.assign(o, { whip: { to: [pw.x + 9, pw.y - 4], c: [pw.x + 6, pw.y - 9], amp: 0.6, k: 2 } }));
    }
    case 'attack_down': {
      const base = { by: -5, fy: -4, tilt: 0.45, look: [0, 1], lf: [2, 0.5], lb: [-1, 1], tail: 0.5, spikes: 0.4 };
      if (f === 0) {
        const o = Object.assign({}, base, { arm: -1.4, eye: 'det', mouth: 'flat', sq: -0.2 });
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [pw.x - 3, pw.y - 6], c: [pw.x + 3, pw.y - 7] } }));
      }
      const o = Object.assign({}, base, [null,
        { arm: 1.2, eye: 'det', mouth: 'open', sq: 0.2, hx: 1, hy: 1 },
        { arm: 1.15, eye: 'det', mouth: 'smile', sq: 0.1, hx: 1, hy: 1 },
        { arm: 0.6, eye: 'open', mouth: 'smile' }][f]);
      const pw = pawOf(o);
      if (f === 1) return K(Object.assign(o, { whip: { to: [pw.x + 2, 39], c: [pw.x + 9, pw.y + 5] },
        fx: [{ k: 'smear', x: pw.x, y: pw.y, r: 11, a0: 0.1, a1: 1.45, th: 3 }, { k: 'spark', x: pw.x + 2, y: 38, s: 2 }] }));
      if (f === 2) return K(Object.assign(o, { whip: { to: [pw.x + 1, 39], c: [pw.x + 5, pw.y + 6], amp: 1, k: 3 },
        fx: [{ k: 'spark', x: pw.x + 1, y: 38, s: 1 }] }));
      return K(Object.assign(o, { whip: { to: [pw.x + 7, pw.y + 6], c: [pw.x + 7, pw.y], amp: 0.5, k: 2 } }));
    }
    case 'charge': {
      const sh = f % 2 ? 0.5 : -0.5;
      const o = { sq: 0.45, bx: -1 + sh, hx: -0.5 + sh, tilt: 0.1, arm: -0.35, arm2: -0.15, eye: 'det', mouth: 'flat',
        spikes: 0.9, wig: f % 2 ? 1 : -1, glow: f % 2 ? 0.4 : 0.2, tail: 0.3 };
      const pw = pawOf(o);
      return K(Object.assign(o, { fx: [{ k: 'orb', x: pw.x + 2.5, y: pw.y - 0.5, r: 1.6 + (f % 2) * 0.8 },
        { k: 'spark', x: pw.x + 2.5 + [4, -2, 3, -3][f], y: pw.y - 0.5 + [-3, -4, 3, 2][f], s: 1 }] }));
    }
    case 'dash':
      return K({ sq: 0.7, bx: 1 + f * 0.5, by: -1, hx: 4.5, hy: 3, tilt: 0.25, neck: -1.5, lf: [-2, 2], lb: [-4.5, 2.5], fy: -1,
        tail: -0.55, tailLen: 1.5, arm: 2.2, eye: 'det', mouth: 'flat', spikes: 0.5, wig: -1, fx: [{ k: 'speed' }] });
    case 'hurt':
      return f === 0
        ? K({ bx: -2, hx: -3.5, hy: -1, tilt: -0.4, sq: -0.35, eye: 'squeeze', mouth: 'open', spikes: 1.1, arm: -1.9, tail: 0.65, lf: [2, 1], lb: [-1, 0], wig: 1 })
        : K({ bx: -1, hx: -2.5, tilt: -0.25, sq: 0.25, eye: 'squeeze', mouth: 'wavy', spikes: 0.7, arm: -1.2, tail: 0.4, wig: -1 });
    case 'death': {
      if (f === 0) return K({ bx: -2, hx: -3.5, hy: -1, tilt: -0.4, sq: -0.35, eye: 'squeeze', mouth: 'open', spikes: 1.1, arm: -1.9, tail: 0.6 });
      if (f === 1) return K({ bx: -1, hx: -4, hy: 1, tilt: -0.3, sq: 0.3, eye: 'squeeze', mouth: 'wavy', arm: -1.2, rot: -0.12, tail: 0.3 });
      if (f === 2) return K({ hx: -3, hy: 0, tilt: -0.1, eye: 'x', mouth: 'o', arm: -1.0, rot: -0.55, roy: -0.5, tail: 0, lf: [2, 1] });
      if (f === 3) return K({ hx: -7, hy: 0, tilt: 0.2, eye: 'x', mouth: 'o', arm: 0, rot: -1.05, roy: -2.5, tail: -1, lf: [2, 2] });
      if (f === 4) return lyingPose({ roy: -7, eye: 'x', mouth: 'o', arm: 0.6, lf: [2, 2], lb: [0, 1] });
      return lyingPose({ eye: 'x', mouth: f < 6 ? 'o' : 'line', stuff: Math.max(0, Math.min(4, f - 5)), arm: 1.4, lf: [1.5, 0.5],
        roy: f === 5 ? -3.8 : -4.5 });
    }
    case 'swim': {
      const s = Math.sin(ph), c = Math.cos(ph);
      return K({ bx: 0, by: -1 + Math.round(s * 0.8), hx: 3, hy: 1, tilt: -0.1, sq: 0.25,
        lf: [2 + 2.5 * s, 2 + 1.5 * c], lb: [-2 - 2.5 * s, 2 - 1.5 * c], fy: -1 + Math.round(s * 0.8),
        tail: -0.2 + 0.25 * Math.sin(ph + 1), tailLen: 1, arm: 0.6 + 0.9 * s, mouth: 'smile', wig: 0.4 * s });
    }
    case 'cast': {
      const up = f === 0 ? -0.8 : -1.55 + 0.12 * Math.sin(ph * 2);
      const gl = f === 0 ? 0.2 : 0.55 + 0.45 * Math.sin(ph * 1.5);
      return K({ sq: f === 0 ? 0.3 : -0.2, hy: f === 0 ? 0 : -1, tilt: -0.15, arm: up, arm2: up - 0.25, armLen: 4.8, eye: f === 0 ? 'det' : 'closed',
        mouth: f === 0 ? 'flat' : 'open', glow: gl, spikes: 0.5 + gl * 0.5, wig: Math.sin(ph * 2), tail: 0.3,
        fx: f === 0 ? null : [{ k: 'aura', ph: f * 0.7 }] });
    }
    case 'celebrate': {
      const sparks = [{ k: 'spark', x: [9, 40, 12, 38, 8, 42, 14, 37, 10, 41][f], y: [12, 8, 6, 14, 18, 6, 10, 4, 16, 10][f], s: 1 + (f % 2) },
        { k: 'spark', x: [40, 10, 38, 12, 42, 9, 36, 13, 39, 8][f], y: [18, 20, 4, 22, 9, 15, 3, 18, 6, 22][f], s: 1 }];
      const P = [
        { sq: 0.9, arm: 0.9, eye: 'happy', mouth: 'grin', tail: 0.1 },
        { sq: -0.6, by: -4, fy: -3, arm: -1.6, arm2: -1.8, eye: 'happy', mouth: 'grin', spikes: 0.8, tail: 0.5, lf: [1, 0], lb: [-1, 0] },
        { sq: -0.2, by: -7, fy: -6, arm: -1.9, arm2: -2.1, eye: 'happy', mouth: 'grin', spikes: 0.6, tail: 0.6, lf: [2, 1.5], lb: [-1, 2] },
        { flip: true, sq: -0.1, by: -7, fy: -6, arm: -1.7, eye: 'happy', mouth: 'grin', tail: 0.5, lf: [2, 1.5], lb: [-1, 2] },
        { sq: -0.3, by: -4, fy: -4, arm: -1.8, arm2: -2, eye: 'happy', mouth: 'grin', tail: 0.4, lf: [1, 0.5], lb: [-1, 1] },
        { sq: 1.0, hy: 1, arm: 0.5, eye: 'happy', mouth: 'grin', tail: -0.1 },
        { sq: 0.2, arm: -1.7, arm2: -1.9, eye: 'happy', mouth: 'grin', tail: 0.3, wig: 1 },
        { sq: -0.2, hx: 1, tilt: 0.15, arm: -2.0, arm2: -1.7, eye: 'happy', mouth: 'open', tail: 0.5, wig: -1 },
        { sq: 0.2, hx: -0.5, tilt: -0.12, arm: -1.5, arm2: -1.9, eye: 'happy', mouth: 'grin', tail: 0.3, wig: 1 },
        { sq: 0, arm: -1.8, arm2: -1.6, eye: 'happy', mouth: 'grin', tail: 0.4, wig: -1 }][f];
      return K(Object.assign(P, { armLen: P.arm < -1 ? 4.8 : 3.8, fx: f >= 1 ? sparks : null }));
    }
    case 'sleep': {
      const b = Math.sin(ph);
      return K({ sq: 0.65 + 0.2 * b, hx: -1, hy: 3.5 + Math.round(b * 0.6), tilt: 0.55, neck: 1, eye: 'closed', mouth: 'line',
        tail: -0.5, arm: 1.4, spikes: -0.3, lf: [1, 0], lb: [-1, 0],
        fx: [{ k: 'z', x: 38 + (f % 2), y: 14 - f * 2 }, ...(f >= 2 ? [{ k: 'z', x: 42, y: 8 - (f - 2) * 2 }] : [])] });
    }
    case 'scared': {
      const sh = f % 2 ? 1 : 0;
      return K({ sq: 0.5, bx: -1 + sh, hx: -2.5 + sh, hy: 1, tilt: -0.15, eye: 'wide', mouth: 'wavy', spikes: 1.1,
        wig: f % 2 ? 1 : -1, arm: -1.25, arm2: -1.0, tail: -0.65, lf: [1, 0], lb: [-1, 0],
        fx: [{ k: 'drop', x: 22 + sh, y: 12 + (f >> 1) }] });
    }
    case 'look_up':
      return K({ tilt: -0.5, hy: -1, hx: -1.5, neck: 0.5, look: [0, -1], sq: f ? -0.15 : 0 });
    case 'look_down':
      return K({ tilt: 0.5, hy: 1.5, hx: 1.5, look: [0, 1], sq: f ? 0.15 : 0 });

    // ---------------------------------------------------- extras de cutscene
    case 'lying':
      return lyingPose({ tail: f ? -2.05 : -2.1 });
    case 'wake': {
      if (f === 0) return lyingPose();
      if (f === 1) return lyingPose({ eye: 'half', tail: -2.0 });
      if (f === 2) return lyingPose({ eye: 'open', mouth: 'smile', arm: 0.8 });
      if (f === 3) return K({ rot: -1.0, roy: -2.5, hx: -6, hy: 0, tilt: 0.2, eye: 'open', mouth: 'o', arm: 0.4, tail: -1.2, sq: 0.4 });
      if (f === 4) return K({ rot: -0.45, roy: -0.5, hx: -2, eye: 'wide', mouth: 'o', arm: -0.2, tail: -0.5, sq: 0.5 });
      if (f === 5) return K({ sq: 0.7, hx: -1, eye: 'wide', mouth: 'o', arm: -0.6, spikes: 0.6, tail: 0.1 });
      if (f === 6) return K({ sq: -0.45, hy: -1, tilt: -0.2, arm: -1.6, arm2: -1.8, eye: 'happy', mouth: 'open', spikes: 0.4, tail: 0.4 });
      return K({ eye: 'open', mouth: 'smile' });
    }
    case 'wave': {
      const s = Math.sin(ph);
      return K({ hx: 0.5, tilt: 0.1 * s, arm: -1.6 + 0.55 * s, armLen: 5.2, eye: f % 3 === 2 ? 'happy' : 'open', mouth: f % 2 ? 'grin' : 'smile',
        tail: 0.2 * Math.sin(2 * ph), sq: 0.15 * Math.cos(2 * ph) });
    }
    case 'sad': {
      const b = Math.sin(ph);
      return K({ hy: 2.5, hx: -0.5, tilt: 0.38, sq: 0.25 + 0.12 * b, eye: 'sad', mouth: 'sad', tail: -0.55, spikes: -0.5,
        arm: 1.25, tear: f >= 2 ? f - 2 : 0 });
    }
    case 'surprise':
      return [
        K({ sq: 0.45, hx: -1, eye: 'wide', mouth: 'o', spikes: 0.5, arm: 0.2 }),
        K({ sq: -0.5, by: -3, fy: -2.5, eye: 'wide', mouth: 'o', spikes: 1.3, arm: -1.6, arm2: -1.8, tail: 0.6, lf: [1, 0], lb: [-1, 0], hy: -1 }),
        K({ sq: 0.55, eye: 'wide', mouth: 'o', spikes: 0.8, arm: -0.8, tail: 0.2 }),
        K({ sq: 0, eye: 'wide', mouth: 'o', spikes: 0.6, arm: -0.9, tail: 0.3 })][f];
    case 'think':
      return K({ hx: -1, hy: -0.5, tilt: -0.22, look: [0, -1], arm: -1.0, mouth: f % 2 ? 'line' : 'flat', eye: 'open',
        tail: 0.15 * Math.sin(ph * 2), fx: f ? [{ k: 'dots', n: f, x: 38, y: 9 }] : null });
    default:
      return K({});
  }
}

// ----------------------------------------------------------- render + meta
const cache = new Map();
function poseCached(anim, f) {
  const key = anim + ':' + f;
  let p = cache.get(key);
  if (!p) { p = poseFor(anim, f, ANIMS[anim]?.frames || 1); cache.set(key, p); }
  return p;
}

function drawTico(pc, anim, f) {
  const p = poseCached(anim, f);
  const g = drawTicoPose(pc, p);
  if (p.whip) {
    const pw = xf(g.paw.x, g.paw.y, p);
    drawWhip(pc, pw.x, pw.y, p.whip);
  }
  drawFxPre(pc, p);
  pc.outline(C.out);
  drawFxPost(pc, p, g);
}

function anchors(p) {
  const g = geo(p);
  const ct = Math.cos(p.tilt), st = Math.sin(p.tilt);
  const head = xf(g.H.x + st * g.hry, g.H.y - ct * g.hry, p);
  const nq = bz(g.N0, g.N1, g.N2, 0.5);
  const neck = xf(nq.x, nq.y, p);
  const back = xf(g.B.x - 2, g.B.y - g.bry + 1, p);
  const r = (q) => ({ x: Math.round(q.x), y: Math.round(q.y) });
  const tilt = (p.tilt + p.rot) * (p.flip ? -1 : 1);
  return { head: r(head), neck: r(neck), back: r(back), tilt: Math.round(tilt * 1000) / 1000 };
}

defineSprite('tico', {
  w: W, h: H, ox: PV.x, oy: PV.y,
  anims: ANIMS,
  draw: drawTico,
  meta(anim, f) { return anchors(poseCached(anim, f)); },
});
