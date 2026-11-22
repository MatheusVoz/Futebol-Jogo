// =============================================================================
// art/tico.js — Spritesheet DEFINITIVO do TICO, o dinossauro de pelúcia.
//
// Quadro 48x40, pivô nos pés (24,39), olhando para a DIREITA. Corpo+cabeça
// ~27 px de altura, centrados no pivô (hitbox do jogador 12x18).
//
// Como funciona:
//   • drawTicoPose(pc, pose) desenha o boneco a partir de uma POSE paramétrica
//     (deslocamento/achatamento do corpo, cabeça + inclinação, curva do
//     pescoço, fases das pernas, ângulo da cauda, braço, olho, boca, espinhos
//     eriçados, costuras brilhando, enchimento saindo...).
//   • poseFor(anim, f, n) devolve a pose-chave de cada quadro de cada animação.
//   • Poses com rotação/espelho (deitado, morte, giro) são desenhadas num
//     canvas temporário e copiadas transformadas (vizinho mais próximo) antes
//     do contorno de 1 px, para manter o traço nítido.
//   • Efeitos (chicote de fio dourado, rastros, brilhos, "z", gota de suor)
//     são desenhados por cima, alguns antes do contorno (legíveis em qualquer
//     fundo) e os translúcidos depois.
//   • meta(anim, f) → {head (topo-centro da cabeça), neck, back, tilt} em
//     coordenadas locais do quadro, calculado da MESMA pose (cosméticos).
//
// Animações (nomes exigidos por player.js + extras de cutscene):
//   idle walk run skid jump fall land attack1 attack2 attack3 attack_up
//   attack_down charge dash hurt death swim cast celebrate sleep scared
//   look_up look_down · lying wake wave sad surprise think
// =============================================================================
import { defineSprite } from '../../engine/sprites.js';
import { PixelCanvas } from '../../engine/pixel.js';

const C = {
  body: '#3fc7c0', shade: '#2a9d97', dark: '#1f7f7c', light: '#7fe6df', hi: '#b6f6f0',
  spine: '#ffd23f', spineD: '#e0a020', spineL: '#fff0a0',
  eye: '#120a18', glint: '#ffffff', eyeR: '#6a6a9a',
  spotY: '#ffd23f', spotO: '#ff8a3c', spotB: '#4a7fe0', out: '#1b2a3a',
  mouth: '#1b4a4a', tongue: '#ff7a96', seam: '#227f7b', blush: '#ff8fb0',
  belly: '#6adcd5', muzS: '#3bb5ae', muz: '#8fe9e2', muzL: '#c4f8f2',
  gold: '#ffd23f', goldL: '#fff6a8', goldD: '#e0a020',
  stuff: '#f6f2ff', stuffS: '#cfc8e6', tear: '#9fe0ff', zz: '#dff4ff',
};

const W = 48, H = 40;
const RC = { x: 24, y: 31.5 }; // centro das rotações do boneco inteiro

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
  arm: 0.55, arm2: null, // ângulo do braço (0 = frente, +π/2 = baixo, -π/2 = cima); arm2 = braço de trás
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
  const paw = { x: S.x + Math.cos(p.arm) * 3.8, y: S.y + Math.sin(p.arm) * 3.8 };
  return { B, brx, bry, H: H0, hrx, hry, N0, N1, N2, S, paw };
}
const bz = (a, b, c, t) => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y };
};
/** Transformação do boneco (rotação em torno de RC, translação, espelho). */
function xf(x, y, p) {
  if (p.rot) {
    const c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - RC.x, dy = y - RC.y;
    x = RC.x + dx * c - dy * s; y = RC.y + dx * s + dy * c;
  }
  x += p.rox; y += p.roy;
  if (p.flip) x = W - x;
  return { x, y };
}

// ------------------------------------------------------------- primitivas
function ball(pc, cx, cy, rx, ry, c0, c1, c2) {
  pc.ellipse(cx, cy, rx, ry, c0);
  pc.ellipse(cx - 0.7, cy - 0.8, rx - 0.9, ry - 1, c1);
  if (c2) pc.ellipse(cx - rx * 0.4, cy - ry * 0.5, Math.max(1, rx * 0.28), Math.max(0.8, ry * 0.2), c2);
}
/** Espinho de pelúcia: base (bx,by), direção (nx,ny). */
function spine(pc, bx, by, nx, ny, len, half, glow) {
  const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
  const tx = bx + nx * len, ty = by + ny * len, px = -ny, py = nx;
  const a = [bx + px * half, by + py * half], b = [bx - px * half, by - py * half];
  pc.poly([a, [tx, ty], b], glow ? C.spine : C.spineD);
  const lit = (px * -0.7 + py * -0.7) > 0 ? a : b;
  pc.poly([lit, [tx, ty], [bx, by]], glow ? C.goldL : C.spine);
}
/** Costura tracejada ao longo de um arco de elipse (graus). */
function dashArc(pc, cx, cy, rx, ry, a0, a1, col, step = 2) {
  const n = Math.max(2, Math.round((Math.abs(a1 - a0) / 360) * TAU * Math.max(rx, ry)));
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (a1 - a0) * (i / n)) * Math.PI) / 180;
    if ((k++ % step) === 0) pc.px(Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), col);
  }
}
const hex2 = (a) => Math.max(0, Math.min(255, Math.round(a))).toString(16).padStart(2, '0');

// ------------------------------------------------------------ partes do corpo
function drawTail(pc, g, p) {
  const { B } = g;
  const a = 0.78 + p.tail, L = 9.5 + p.tailLen;
  const P0 = { x: B.x - g.brx + 2.6, y: B.y + 1 };
  const P2 = { x: P0.x - Math.cos(a) * L, y: P0.y - Math.sin(a) * L };
  const P1 = { x: P0.x - Math.cos(a - 0.9) * L * 0.62, y: P0.y - Math.sin(a - 0.9) * L * 0.62 + 1.2 };
  const N = 14;
  for (const [ox, oy, dr, col] of [[0.5, 0.7, 0, C.shade], [-0.2, -0.3, -0.8, C.body]]) {
    for (let i = 0; i <= N; i++) {
      const t = i / N, q = bz(P0, P1, P2, t);
      const r = 3.1 - 1.2 * t + (t > 0.85 ? 0.35 : 0) + dr;
      pc.circle(q.x + ox, q.y + oy, Math.max(0.6, r), col);
    }
  }
  // luz no dorso da cauda + mancha azul
  const m = bz(P0, P1, P2, 0.55);
  pc.px(Math.round(m.x - 0.5), Math.round(m.y - 2), C.light);
  const s = bz(P0, P1, P2, 0.78);
  pc.circle(s.x, s.y, 1, C.spotB);
  return { P0, P1, P2 };
}
function drawLeg(pc, hx, hy, foot, col, colD, p) {
  const fx = hx + foot[0], fy = 37.5 + p.fy - foot[1];
  pc.thickLine(hx, hy, fx, fy - 1, 1.7, col);
  pc.ellipse(fx + 0.9, fy, 2.6, 1.6, col);
  pc.hline(Math.round(fx), Math.round(fy + 0.6), 2, colD); // solinha costurada
}
function drawArm(pc, sx, sy, ang, col, colD) {
  const ex = sx + Math.cos(ang) * 3.8, ey = sy + Math.sin(ang) * 3.8;
  pc.thickLine(sx + 0.4, sy + 0.5, ex + 0.4, ey + 0.5, 1.4, colD);
  pc.thickLine(sx, sy, ex, ey, 1.2, col);
  pc.px(Math.round(ex), Math.round(ey), colD);
}

function drawEye(pc, x, y, st) {
  const E = C.eye;
  switch (st) {
    case 'closed': // ‿ fechado e sereno
      pc.px(x, y + 2, E); pc.px(x + 1, y + 3, E); pc.px(x + 2, y + 3, E); pc.px(x + 3, y + 2, E); break;
    case 'happy': // ^
      pc.px(x, y + 2, E); pc.px(x + 1, y + 1, E); pc.px(x + 2, y + 1, E); pc.px(x + 3, y + 2, E); break;
    case 'squeeze': // >
      pc.px(x, y, E); pc.px(x + 1, y + 1, E); pc.px(x + 2, y + 2, E); pc.px(x + 1, y + 3, E); pc.px(x, y + 4, E); break;
    case 'x': // olho de botão costurado em X
      pc.px(x, y, E); pc.px(x + 2, y, E); pc.px(x + 1, y + 1, E); pc.px(x, y + 2, E); pc.px(x + 2, y + 2, E); break;
    case 'half':
      pc.rect(x, y + 2, 3, 2, E); pc.hline(x - 1, y + 1, 5, C.dark); pc.px(x, y + 2, C.glint); break;
    case 'wide':
      pc.rect(x, y - 1, 4, 5, '#ffffff'); pc.px(x, y - 1, C.light); pc.px(x + 3, y - 1, C.light);
      pc.px(x, y + 3, C.light); pc.px(x + 3, y + 3, C.light);
      pc.rect(x + 1, y, 2, 3, E); pc.px(x + 1, y, C.glint); break;
    default: {
      pc.rect(x, y, 3, 4, E); pc.px(x, y, C.glint); pc.px(x + 1, y, C.glint); pc.px(x, y + 1, C.glint);
      pc.px(x + 2, y + 3, C.eyeR);
      if (st === 'sad') { pc.px(x + 2, y, C.body); pc.px(x - 1, y - 1, C.mouth); pc.px(x, y - 2, C.mouth); pc.px(x + 1, y - 2, C.mouth); }
      if (st === 'det') { pc.hline(x, y, 3, C.body); pc.px(x - 1, y - 1, C.mouth); pc.px(x, y - 1, C.mouth); pc.px(x + 1, y - 1, C.mouth); pc.px(x + 2, y, C.mouth); pc.px(x, y + 1, C.glint); }
    }
  }
}
function drawMouth(pc, x, y, st) {
  const M = C.mouth;
  switch (st) {
    case 'line': pc.hline(x - 1, y + 1, 3, M); break;
    case 'flat': pc.hline(x, y + 1, 2, M); pc.px(x - 1, y, M); break;
    case 'sad': pc.px(x - 1, y + 1, M); pc.px(x, y, M); pc.px(x + 1, y + 1, M); break;
    case 'o': pc.rect(x, y, 2, 2, M); break;
    case 'open': pc.rect(x - 1, y, 3, 2, M); pc.px(x, y + 1, C.tongue); break;
    case 'grin': pc.hline(x - 2, y, 4, M); pc.px(x - 1, y + 1, M); pc.px(x, y + 1, C.tongue); pc.px(x + 1, y + 1, M); break;
    case 'wavy': pc.px(x - 2, y + 1, M); pc.px(x - 1, y, M); pc.px(x, y + 1, M); pc.px(x + 1, y, M); break;
    default: pc.px(x - 1, y, M); pc.px(x, y + 1, M); pc.px(x + 1, y, M); // sorrisinho costurado
  }
}

// ------------------------------------------------------- desenho da pose
function drawTicoPose(pc, p) {
  const g = geo(p);
  const { B, brx, bry, H: Hc, hrx, hry } = g;
  const ct = Math.cos(p.tilt), st = Math.sin(p.tilt);
  const hp = (dx, dy) => [Hc.x + dx * ct - dy * st, Hc.y + dx * st + dy * ct];
  const hn = (dx, dy) => [dx * ct - dy * st, dx * st + dy * ct];
  const glow = p.glow > 0.05;
  const seamC = glow ? (p.glow > 0.6 ? C.goldL : C.gold) : C.seam;
  const sp = 1 + 0.3 * p.spikes;

  // cauda + perna de trás + braço de trás
  const tail = drawTail(pc, g, p);
  drawLeg(pc, B.x - 3.4, B.y + bry * 0.5, p.lb, C.shade, C.dark, p);
  if (p.arm2 != null) drawArm(pc, g.S.x - 1.6, g.S.y - 0.4, p.arm2, C.shade, C.dark);

  // espinhos das costas (atrás do corpo)
  [[-116, 3.9, 2], [-144, 3.5, 1.9], [-170, 3, 1.6]].forEach(([a, len, half], i) => {
    const r = ((a + (i % 2 ? 12 : -12) * p.wig) * Math.PI) / 180;
    spine(pc, B.x + Math.cos(r) * (brx - 0.9), B.y + Math.sin(r) * (bry - 0.9), Math.cos(r), Math.sin(r), len * sp, half, glow);
  });
  { // espinho da cauda
    const q = bz(tail.P0, tail.P1, tail.P2, 0.45), q2 = bz(tail.P0, tail.P1, tail.P2, 0.5);
    const tx = q2.x - q.x, ty = q2.y - q.y;
    spine(pc, q.x, q.y - 1.2, ty, -tx, 2.2 * sp, 1.2, glow);
  }
  // espinho do pescoço
  {
    const q = bz(g.N0, g.N1, g.N2, 0.55);
    spine(pc, q.x - 1.4, q.y, -1, -0.45 + p.wig * 0.2, 2.8 * sp, 1.5, glow);
  }

  // corpo
  ball(pc, B.x, B.y, brx, bry, C.shade, C.body, C.light);
  // barriga clara + costura
  pc.ellipse(B.x + 3, B.y + 1.7, 3.5, 3.1, C.belly);
  dashArc(pc, B.x + 3, B.y + 1.7, 4, 3.6, 190, 280, seamC);
  // manchas
  pc.circle(B.x - 2.4, B.y - 0.6, 1.8, C.spotY);
  pc.circle(B.x - 5.3, B.y + 2.4, 1.1, C.spotO);
  pc.circle(B.x + 0.4, B.y - 3.6, 0.9, C.spotB);
  // enchimento saindo (morte)
  if (p.stuff > 0) {
    const sx = B.x + 3.2, sy = B.y - 0.8;
    pc.hline(Math.round(sx - 1), Math.round(sy + 1), 3, C.dark);
    const puffs = [[0, -1, 1.6], [2, -2.4, 1.3], [-1.6, -2.6, 1.2], [1, -4.2, 1.1], [3.4, -0.4, 1]];
    for (let i = 0; i < Math.min(puffs.length, 1 + p.stuff); i++) {
      const [dx, dy, r] = puffs[i];
      pc.circle(sx + dx + 0.4, sy + dy + 0.4, r, C.stuffS);
      pc.circle(sx + dx, sy + dy, r - 0.3, C.stuff);
    }
  }

  // perna da frente
  drawLeg(pc, B.x + 2.6, B.y + bry * 0.55, p.lf, C.body, C.shade, p);

  // pescoço (sombra, tom base, garganta clara)
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, q = bz(g.N0, g.N1, g.N2, t), r = 2.7 - 0.5 * t;
    pc.circle(q.x + 0.5, q.y + 0.3, r, C.shade);
  }
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, q = bz(g.N0, g.N1, g.N2, t), r = 2.7 - 0.5 * t;
    pc.circle(q.x - 0.3, q.y - 0.2, r - 0.7, C.body);
  }
  for (let i = 2; i <= 9; i++) {
    const q = bz(g.N0, g.N1, g.N2, i / 10);
    pc.px(Math.round(q.x + 1.2), Math.round(q.y), C.light);
  }
  { // gola costurada na base do pescoço
    const q = bz(g.N0, g.N1, g.N2, 0.12), q2 = bz(g.N0, g.N1, g.N2, 0.2);
    const tx = q2.x - q.x, ty = q2.y - q.y, l = Math.hypot(tx, ty) || 1;
    for (let k = -2; k <= 2; k += 2) pc.px(Math.round(q.x - (ty / l) * k), Math.round(q.y + (tx / l) * k), seamC);
  }

  // espinhos da cabeça (atrás)
  [[-96, 4.2, 2.1], [-130, 4.8, 2.3], [-164, 4, 2]].forEach(([a, len, half], i) => {
    const r = ((a + (i % 2 ? -10 : 10) * p.wig) * Math.PI) / 180;
    const [bx, by] = hp(Math.cos(r) * (hrx - 1), Math.sin(r) * (hry - 1));
    const [nx, ny] = hn(Math.cos(r), Math.sin(r));
    spine(pc, bx, by, nx, ny, len * sp, half, glow);
  });

  // cabeça
  ball(pc, Hc.x, Hc.y, hrx, hry, C.shade, C.body, C.light);
  { // manchas da cabeça
    const [ax, ay] = hp(-3.4, -1.2); pc.circle(ax, ay, 1.4, C.spotY);
    const [cx2, cy2] = hp(-0.6, -4.4); pc.circle(cx2, cy2, 0.8, C.spotB);
  }
  // focinho (peça clara costurada com fio dourado)
  {
    const [mx, my] = hp(4.4, 2.2);
    ball(pc, mx, my, 3.7, 2.7, C.muzS, C.muz, C.muzL);
    for (const a of [140, 172]) {
      const [dx, dy] = hn(Math.cos((a * Math.PI) / 180) * 4.3, Math.sin((a * Math.PI) / 180) * 3.3);
      pc.px(Math.round(mx + dx - 0.5), Math.round(my + dy - 0.5), glow ? C.goldL : C.gold);
    }
  }
  // rosto
  if (p.blush && p.eye !== 'x' && p.eye !== 'sad') {
    const [bx3, by3] = hp(0.6, 2.4); pc.hline(Math.round(bx3), Math.round(by3), 2, C.blush);
  }
  const [ex, ey] = hp(0.9 + p.look[0], -2.8 + p.look[1]);
  drawEye(pc, Math.round(ex), Math.round(ey), p.eye);
  if (p.tear) {
    pc.px(Math.round(ex + 1), Math.round(ey + 4 + p.tear), C.tear);
    pc.px(Math.round(ex + 1), Math.round(ey + 5 + p.tear), C.tear);
  }
  const [nx2, ny2] = hp(7.2, 0.7); pc.px(Math.round(nx2), Math.round(ny2), C.mouth);
  const [mx2, my2] = hp(5, 3.4); drawMouth(pc, Math.round(mx2), Math.round(my2), p.mouth);

  // braço da frente (patinha)
  drawArm(pc, g.S.x, g.S.y, p.arm, C.body, C.shade);
  return g;
}

// ------------------------------------------------------------------ efeitos
function drawWhip(pc, x0, y0, w) {
  const [x1, y1] = w.to;
  const c = w.c ? { x: w.c[0], y: w.c[1] } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const A = { x: x0, y: y0 }, Bp = { x: x1, y: y1 };
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(c.x - (x0 + x1) / 2, c.y - (y0 + y1) / 2);
  const N = Math.max(4, Math.ceil(len * 1.4));
  let l = A;
  for (let i = 1; i <= N; i++) {
    const t = i / N, q = bz(A, c, Bp, t), q2 = bz(A, c, Bp, Math.min(1, t + 0.01));
    let tx = q2.x - q.x, ty = q2.y - q.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const off = (w.amp || 0) * Math.sin(t * Math.PI) * Math.sin(t * Math.PI * (w.k || 3) + (w.ph || 0));
    const pt = { x: q.x - ty * off, y: q.y + tx * off };
    pc.line(l.x, l.y, pt.x, pt.y, t > 0.82 ? C.goldL : (i % 4 === 0 ? C.goldL : C.gold));
    l = pt;
  }
  return l;
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
    for (let k = 0; k < th; k++) pc.px(cx + Math.cos(a) * (r - k), cy + Math.sin(a) * (r - k), (k ? C.gold : C.goldL) + hex2(25 + 170 * t * (k ? 0.7 : 1)));
  }
}
function drawFxPre(pc, p) {
  for (const e of p.fx || []) {
    if (e.k === 'z') { const { x, y } = e; pc.hline(x, y, 3, C.zz); pc.px(x + 1, y + 1, C.zz); pc.hline(x, y + 2, 3, C.zz); }
    else if (e.k === 'drop') { pc.px(e.x + 1, e.y, C.tear); pc.rect(e.x, e.y + 1, 2, 2, C.tear); pc.px(e.x, e.y + 1, '#ffffff'); }
    else if (e.k === 'dots') { for (let i = 0; i < e.n; i++) pc.px(e.x + i * 3, e.y - i, '#ffffff'); }
  }
}
function drawFxPost(pc, p, g) {
  for (const e of p.fx || []) {
    switch (e.k) {
      case 'smear': smear(pc, e.x, e.y, e.r, e.a0, e.a1, e.th || 2); break;
      case 'spark': star(pc, e.x, e.y, e.s || 1); break;
      case 'orb': {
        pc.circle(e.x, e.y, e.r + 1.5, C.goldL + '55');
        pc.circle(e.x, e.y, e.r, C.gold); pc.circle(e.x - 0.4, e.y - 0.4, e.r - 0.8, C.goldL);
        pc.px(Math.round(e.x - 0.5), Math.round(e.y - 0.5), '#ffffff');
        break;
      }
      case 'speed':
        for (const [dy, len, a] of [[-4, 7, 'aa'], [0, 9, 'cc'], [3, 5, '88'], [-10, 6, '77']])
          pc.hline(Math.round(g.B.x - g.brx - 3 - len), Math.round(g.B.y + dy), len, '#ffffff' + a);
        break;
      case 'aura': {
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + e.ph;
          const x = 24 + Math.cos(a) * 15, y = 26 + Math.sin(a) * 12;
          if (i % 2) pc.px(Math.round(x), Math.round(y), C.goldL + 'cc'); else star(pc, x, y, 1);
        }
        break;
      }
      case 'ring': // anel do giro (attack3)
        smear(pc, e.x, e.y, e.r, e.a0, e.a1, 2);
        break;
      default:
    }
  }
}

// ----------------------------------------------------------- poses-chave
const pawOf = (o) => geo(K(o)).paw;
/** Posa deitado (de costas, como um brinquedo largado). */
function lyingPose(extra) {
  return K(Object.assign({
    rot: -Math.PI / 2, roy: -5.5, rox: 1, hx: -13, hy: 1, tilt: 0.1, neck: -1,
    eye: 'closed', mouth: 'line', blush: true, arm: 1.3, lf: [1, 0], lb: [-1, 0],
    tail: -2.1, spikes: -0.4, sq: 0.2,
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
          fx: [{ k: 'smear', x: pw.x - 2, y: pw.y + 3, r: 15, a0: -1.25, a1: -0.2, th: 3 }, { k: 'spark', x: 46, y: pw.y - 1, s: 2 }] }));
      }
      if (f === 2) {
        const o = { bx: 1, hx: 2, tilt: 0.08, arm: 0.05, lf: [2, 0], lb: [-2, 0], eye: 'det', mouth: 'smile' };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, pw.y + 1], amp: 1.3, k: 3, ph: 0 },
          fx: [{ k: 'smear', x: pw.x - 2, y: pw.y + 3, r: 15, a0: -0.8, a1: -0.15, th: 2 }, { k: 'spark', x: 46, y: pw.y + 1, s: 1 }] }));
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
          fx: [{ k: 'ring', x: 24, y: 26, r: 17, a0: 1.6, a1: TAU - 0.15 }, { k: 'smear', x: pw.x - 2, y: pw.y + 3, r: 15, a0: -1.3, a1: -0.2, th: 3 },
            { k: 'spark', x: 46, y: pw.y - 2, s: 3 }, { k: 'spark', x: 40, y: pw.y - 8, s: 1 }] }));
      }
      if (f === 3) {
        const o = { bx: 1.5, hx: 2.5, tilt: 0.06, arm: 0.05, sq: -0.1, lf: [3, 0], lb: [-2.5, 0], eye: 'det', mouth: 'smile', spikes: 0.6 };
        const pw = pawOf(o);
        return K(Object.assign(o, { whip: { to: [47, pw.y], amp: 1.6, k: 4, ph: 0.5 },
          fx: [{ k: 'smear', x: pw.x - 2, y: pw.y + 3, r: 15, a0: -0.8, a1: -0.15, th: 2 }, { k: 'spark', x: 45, y: pw.y - 3, s: 2 }, { k: 'spark', x: 38, y: pw.y + 4, s: 1 }] }));
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
      if (f === 2) return K({ hx: -6, hy: 1, tilt: -0.2, eye: 'x', mouth: 'o', arm: -1.0, rot: -0.55, roy: 0, tail: 0, lf: [2, 1] });
      if (f === 3) return K({ hx: -9, hy: 1, tilt: 0, eye: 'x', mouth: 'o', arm: 0, rot: -1.05, roy: -2, tail: -1, lf: [2, 2] });
      if (f === 4) return lyingPose({ roy: -7.5, eye: 'x', mouth: 'o', arm: 0.6, lf: [2, 2], lb: [0, 1] });
      return lyingPose({ eye: 'x', mouth: f < 6 ? 'o' : 'line', stuff: Math.max(0, Math.min(4, f - 5)), arm: 1.4, lf: [1.5, 0.5],
        roy: f === 5 ? -4.8 : -5.5 });
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
      return K({ sq: f === 0 ? 0.3 : -0.2, hy: f === 0 ? 0 : -1, tilt: -0.15, arm: up, arm2: up - 0.25, eye: f === 0 ? 'det' : 'closed',
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
      return K(Object.assign(P, { fx: f >= 1 ? sparks : null }));
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
      if (f === 3) return K({ rot: -1.0, roy: -2.5, hx: -8, hy: 1, eye: 'open', mouth: 'o', arm: 0.4, tail: -1.2, sq: 0.4 });
      if (f === 4) return K({ rot: -0.45, roy: -0.5, hx: -4, eye: 'wide', mouth: 'o', arm: -0.2, tail: -0.5, sq: 0.5 });
      if (f === 5) return K({ sq: 0.7, hx: -1, eye: 'wide', mouth: 'o', arm: -0.6, spikes: 0.6, tail: 0.1 });
      if (f === 6) return K({ sq: -0.45, hy: -1, tilt: -0.2, arm: -1.6, arm2: -1.8, eye: 'happy', mouth: 'open', spikes: 0.4, tail: 0.4 });
      return K({ eye: 'open', mouth: 'smile' });
    }
    case 'wave': {
      const s = Math.sin(ph);
      return K({ hx: 0.5, tilt: 0.1 * s, arm: -1.75 + 0.5 * s, eye: f % 3 === 2 ? 'happy' : 'open', mouth: f % 2 ? 'grin' : 'smile',
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

let tmp = null;
function blitXf(dst, src, p) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let X = x + 0.5;
    if (p.flip) X = W - X;
    X -= p.rox;
    const Y = y + 0.5 - p.roy;
    const dx = X - RC.x, dy = Y - RC.y;
    const sx = Math.floor(RC.x + dx * c + dy * s), sy = Math.floor(RC.y - dx * s + dy * c);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const v = src.buf[sy * W + sx];
    if (v >>> 24) dst.buf[y * W + x] = v;
  }
}

function drawTico(pc, anim, f) {
  const p = poseCached(anim, f);
  let g;
  if (p.rot || p.flip || p.rox || p.roy) {
    if (!tmp) tmp = new PixelCanvas(W, H);
    tmp.clear(); tmp.resetTranslate();
    g = drawTicoPose(tmp, p);
    blitXf(pc, tmp, p);
  } else g = drawTicoPose(pc, p);
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
  w: W, h: H, ox: 24, oy: 39,
  anims: ANIMS,
  draw: drawTico,
  meta(anim, f) { return anchors(poseCached(anim, f)); },
});
