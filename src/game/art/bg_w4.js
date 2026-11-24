// =============================================================================
// art/bg_w4.js — Fundo do Mundo 4: O PESADELO DEBAIXO DA CAMA.
//
// sky(): céu compartilhado (art/sky.js, preset 'w4': lua sinistra + relâmpagos).
// Camadas pintadas POR HORÁRIO (paint(pc,w,h,tod)) com paletas em PAL:
//  1) paredes de um quarto gigante em ruínas (topo rasgado), papel de parede,
//     janela torta com cortinas rasgadas (vidro vazado mostra o céu) —
//     animate: raios dentro da janela + móbile de berço girando no vazio;
//  2) cama enorme (cabeceira, colcha caída), guarda-roupa entreaberto e
//     criado-mudo com abajur — animate: olhos na fresta do armário e debaixo
//     da cama, brilho quente do abajur;
//  3) corredor de pernas de móveis que somem no escuro + brinquedos abandonados
//     — animate: sombras que vagam com olhinhos;
//  4) bagunça próxima no chão (livros, blocos, meia, tapete) — animate: poeira.
// front: névoa fria rasteira à deriva.
// Tudo contínuo na horizontal (elementos desenhados com "wrap").
// =============================================================================
import { registerBackground } from '../registry.js';
import { drawSky, skyPreset } from './sky.js';
import { PixelCanvas } from '../../engine/pixel.js';

const TAU = Math.PI * 2;
function lrng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  return r;
}
const wrap = (w, fn) => { fn(0); fn(-w); fn(w); };
/** Desloca de tela de um ponto fx da camada (repete a cada W). */
function eachX(cam, sx, W, w, fx, fn, drift = 0) {
  const base = -((((cam.x * sx + drift) % W) + W) % W) + fx;
  for (let X = base - W; X < w + 60; X += W) if (X > -120) fn(Math.round(X));
}

// ------------------------------------------------------------------ paletas por horário
const PAL = {
  night: {
    wall: '#2a2748', wallL: '#33305a', wallD: '#1c1a34', rim: '#56508a', pat: '#36325e', frame: '#120f20', frameL: '#3e3a62',
    cur: ['#2a1a40', '#3e2858', '#563a74'], glass: '#0a0818', patch: '#5a5470', beam: '#9a94d01a',
    f: ['#0c0a16', '#141122', '#1e1a30', '#3a3462'], blanket: ['#1e1838', '#2c2450', '#3e3468'],
    lamp: '#ffc46a', lampOn: true, legs: ['#0a0812', '#13101e', '#1d192e', '#34305a'],
    toy: ['#100d1a', '#1a1628', '#2a2440'], near: '#08070e', nearL: '#1c1828', fog: '#5a54884a', fogA: 0.2,
  },
  dusk: {
    wall: '#3a2f56', wallL: '#463a66', wallD: '#2a2242', rim: '#8a6a9a', pat: '#443866', frame: '#1a1428', frameL: '#5a4a72',
    cur: ['#3a1e44', '#562e5e', '#743e74'], glass: '#140c20', patch: '#6e5e7a', beam: '#ffb08a14',
    f: ['#140e1e', '#1e162c', '#2a2040', '#6a4a7a'], blanket: ['#2a1e40', '#3c2a58', '#563a72'],
    lamp: '#ffb860', lampOn: true, legs: ['#100a18', '#1a1426', '#261e38', '#5a4470'],
    toy: ['#160f20', '#22182e', '#342848'], near: '#0c0812', nearL: '#241a30', fog: '#7a5a8a44', fogA: 0.18,
  },
  day: {
    wall: '#4a4672', wallL: '#56527e', wallD: '#38345c', rim: '#8a86b8', pat: '#524e7c', frame: '#22203a', frameL: '#6a669a',
    cur: ['#3e2e5a', '#584478', '#745c96'], glass: '#1a1830', patch: '#7a7490', beam: '#e0dcff18',
    f: ['#1e1a30', '#28233e', '#36304e', '#6c64a0'], blanket: ['#38305a', '#4a4074', '#5e548e'],
    lamp: '#ffd890', lampOn: false, legs: ['#1a1628', '#241f36', '#322c48', '#5e5888'],
    toy: ['#221d34', '#2e2844', '#3e3658'], near: '#141020', nearL: '#2c2640', fog: '#8a86b840', fogA: 0.16,
  },
};
let curTod = 'night';
const todOf = (tod) => (PAL[tod] ? tod : 'night');
let activeTod = 'night';
function sky(ctx, w, h, t, cam, level) {
  const p = skyPreset('w4', level);
  activeTod = todOf(p.tod);
  drawSky(ctx, w, h, t, cam, p);
}

// ------------------------------------------------------------------ sprites animados (cache)
let A = null;
function mkc(w, h, fn) { const pc = new PixelCanvas(w, h); fn(pc); pc.flush(); return pc.canvas; }
function sprites() {
  if (A) return A;
  A = {};
  // raios (3 formas) para a janela
  A.bolt = [11, 22, 33].map((sd) => mkc(60, 90, (pc) => {
    const r = lrng(sd);
    let x = 30 + r.int(-10, 10), y = 0;
    while (y < 90) {
      const nx = x + r.int(-7, 7), ny = y + r.int(6, 12);
      pc.line(x, y, nx, ny, '#e8e4ff'); pc.line(x + 1, y, nx + 1, ny, '#a8a0ff');
      if (r() < 0.25) pc.line(nx, ny, nx + r.int(-12, 12), ny + r.int(8, 16), '#9890e0');
      x = nx; y = ny;
    }
  }));
  // sombra errante (bolha com tentáculos)
  A.shadow = [0, 1].map((k) => mkc(40, 34, (pc) => {
    pc.ellipse(20, 14, 13 + k * 3, 11, '#05040ab0'); pc.ellipse(20, 12, 10 + k * 2, 8, '#05040ad0');
    for (let i = 0; i < 5; i++) { const x = 9 + i * 5 + k; pc.thickLine(x, 20, x + ((i & 1) ? 2 : -2), 31 - (i % 3) * 2, 1, '#05040a90'); }
  }));
  A.glow = mkc(60, 60, (pc) => { for (const [r, a] of [[29, '10'], [21, '18'], [13, '26'], [7, '38']]) pc.circle(30, 30, r, '#ffc46a' + a); });
  return A;
}
/** Par de olhos que se abre/fecha num ciclo (sem estado). */
function drawEyes(ctx, x, y, t, ph, col = '#ffe066', gap = 6) {
  const cyc = (t * 0.11 + ph) % 1;
  if (cyc > 0.62) return;
  const fade = Math.min(1, cyc * 8, (0.62 - cyc) * 8);
  if ((t + ph * 5) % 3.3 < 0.14) return; // piscada
  ctx.globalAlpha = fade * 0.35; ctx.fillStyle = col;
  ctx.fillRect(x - 2, y - 2, 7, 5); ctx.fillRect(x + gap - 2, y - 2, 7, 5);
  ctx.globalAlpha = fade;
  ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + gap, y, 3, 2);
  ctx.fillStyle = '#0a0612';
  const lk = Math.round(Math.sin(t * 0.7 + ph));
  ctx.fillRect(x + 1 + lk, y, 1, 2); ctx.fillRect(x + gap + 1 + lk, y, 1, 2);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ camadas
const WIN = { x: 300, y: 62, w: 76, h: 104 }; // janela na camada 1 (coords da camada)
const layers = [
  // 1) paredes do quarto gigante em ruínas + janela de tempestade
  {
    width: 768, height: 260, speed: 0.05, speedY: 0.04, get fillBelow() { return PAL[curTod].wallD; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(41);
      // topo rasgado (inteiro em frequência para fechar o loop)
      const top = (x) => 40 + 18 * Math.sin((TAU * 2 * x) / w + 0.5) + 9 * Math.sin((TAU * 7 * x) / w) + ((x * 7919) % 5);
      for (let x = 0; x < w; x++) {
        const y0 = Math.round(top(x));
        for (let y = y0; y < h; y++) {
          let c = ((x / 14) | 0) & 1 ? P.wall : P.wallL;
          if (x % 14 === 0) c = P.wallD;
          const my = (y + ((x / 14) | 0) * 9) % 22;
          if (x % 14 > 4 && x % 14 < 10 && my > 6 && my < 11 && (x + y) % 2 === 0) c = P.pat;
          if (y > h - 30) c = y > h - 22 ? P.wallD : (y === h - 30 ? P.rim : P.frame); // rodapé gigante
          pc.px(x, y, c);
        }
        pc.px(x, y0, P.rim); pc.px(x, y0 + 1, P.wallD);
      }
      // rasgos descascados com reboco
      for (let i = 0; i < 9; i++) {
        const cx = r.int(0, w), cy = r.int(110, 200), rx = r.int(8, 20), ry = r.int(5, 12);
        wrap(w, (o) => { pc.ellipse(cx + o, cy, rx, ry, P.patch); pc.ellipseOutline(cx + o, cy, rx, ry, P.frame); pc.tri(cx + o + rx - 6, cy - ry, cx + o + rx + 6, cy - ry - 4, cx + o + rx, cy - 2, P.rim); });
      }
      // janela torta (vidro vazado mostra o céu)
      const { x: wx, y: wy, w: ww, h: wh } = WIN;
      pc.rect(wx - 8, wy - 8, ww + 16, wh + 16, P.frame); pc.strokeRect(wx - 8, wy - 8, ww + 16, wh + 16, P.frameL);
      for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) pc.erase(wx + x, wy + y);
      pc.rect(wx + (ww >> 1) - 2, wy, 4, wh, P.frame); pc.rect(wx, wy + (wh >> 1) - 2, ww, 4, P.frame);
      pc.hline(wx - 12, wy + wh + 8, ww + 24, P.frameL); pc.rect(wx - 12, wy + wh + 9, ww + 24, 4, P.frame);
      pc.line(wx + 8, wy + 10, wx + 22, wy + 30, P.frameL); pc.line(wx + 22, wy + 30, wx + 18, wy + 44, P.frameL); // vidro rachado
      // cortinas rasgadas
      for (const side of [-1, 1]) {
        const cx0 = side < 0 ? wx - 22 : wx + ww + 4;
        for (let x = 0; x < 20; x++) {
          const len = wh + 30 - ((x * 37) % 23) - (side < 0 ? x : 20 - x);
          const col = P.cur[(x >> 2) % 3];
          pc.vline(cx0 + x, wy - 14, len, col);
        }
      }
      pc.rect(wx - 28, wy - 18, ww + 56, 4, P.frameL);
      // feixe de luar no chão
      for (let y = wy + wh + 14; y < h - 22; y++) { const k = (y - wy - wh) * 0.5; pc.hline(Math.round(wx + k), y, ww, P.beam); }
      // quadro torto com desenho de sol de olhos
      const qx = 560, qy = 90;
      pc.poly([[qx, qy + 4], [qx + 44, qy], [qx + 47, qy + 34], [qx + 3, qy + 38]], P.frame);
      pc.poly([[qx + 4, qy + 7], [qx + 41, qy + 4], [qx + 43, qy + 30], [qx + 6, qy + 33]], P.patch);
      pc.circle(qx + 24, qy + 18, 7, '#b0904a'); pc.px(qx + 21, qy + 17, P.frame); pc.px(qx + 27, qy + 17, P.frame); pc.hline(qx + 21, qy + 21, 7, P.frame);
      pc.line(qx + 22, qy, qx + 30, qy - 30, P.frameL);
      // porta escura entreaberta ao longe
      pc.rect(110, 120, 46, 110, P.frame); pc.rect(114, 124, 30, 106, '#06050c'); pc.strokeRect(110, 120, 46, 110, P.frameL); pc.circle(150, 178, 2, P.rim);
    },
    animate(ctx, cam, t, w, h, y) {
      const S = sprites();
      // raio na janela de tempos em tempos
      const per = 7.3, k = t % per, flash = k < 0.45;
      eachX(cam, 0.05, 768, w, WIN.x, (X) => {
        if (flash) {
          ctx.save(); ctx.beginPath(); ctx.rect(X, y + WIN.y, WIN.w, WIN.h); ctx.clip();
          ctx.globalAlpha = (Math.sin(k * 50) > 0 ? 0.35 : 0.15) * (1 - k / 0.45);
          ctx.fillStyle = '#c8c0ff'; ctx.fillRect(X, y + WIN.y, WIN.w, WIN.h);
          ctx.globalAlpha = 1 - k / 0.45;
          ctx.drawImage(S.bolt[Math.floor(t / per) % 3], X + 8, y + WIN.y + 4);
          ctx.restore(); ctx.globalAlpha = 1;
          ctx.fillStyle = PAL[activeTod].frame;
          ctx.fillRect(X + (WIN.w >> 1) - 2, y + WIN.y, 4, WIN.h); ctx.fillRect(X, y + WIN.y + (WIN.h >> 1) - 2, WIN.w, 4);
        }
      });
      // móbile de berço pendurado no vazio, girando
      eachX(cam, 0.05, 768, w, 470, (X) => {
        const cy = y + 30;
        ctx.fillStyle = '#4a4670'; ctx.fillRect(X, cy - 200, 1, 200); ctx.fillRect(X - 18, cy, 37, 1);
        const items = [];
        for (let i = 0; i < 4; i++) { const a = t * 0.5 + i * TAU / 4; items.push([Math.cos(a), Math.sin(a), i]); }
        items.sort((p, q) => p[1] - q[1]);
        for (const [cx, sz, i] of items) {
          const ix = Math.round(X + cx * 18), iy = cy + 10 + i * 3 + Math.round(Math.sin(t * 1.3 + i) * 1.5);
          ctx.fillStyle = '#4a4670'; ctx.fillRect(ix, cy, 1, iy - cy);
          ctx.fillStyle = sz > 0 ? ['#a8a2d8', '#d8c890', '#9ac0d0', '#c898b8'][i] : '#5a5680';
          if (i === 1) { ctx.fillRect(ix - 2, iy, 5, 1); ctx.fillRect(ix - 1, iy - 1, 3, 3); ctx.fillRect(ix, iy - 2, 1, 5); }
          else ctx.fillRect(ix - 2, iy, 5, 4 - (i === 0 ? 1 : 0));
        }
      });
    },
  },
  // 2) cama enorme, guarda-roupa vivo e criado-mudo com abajur
  {
    width: 900, height: 220, speed: 0.12, speedY: 0.08, get fillBelow() { return PAL[curTod].f[0]; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const F = P.f;
      const fl = h - 18;
      pc.rect(0, fl, w, 18, F[0]); pc.hline(0, fl, w, F[2]);
      // cama: cabeceira, colchão, colcha caindo
      const bx = 120, bw = 330;
      pc.rect(bx - 14, fl - 150, 14, 150, F[1]); pc.vline(bx - 14, fl - 150, 150, F[3]); pc.circle(bx - 7, fl - 156, 9, F[1]); pc.px(bx - 11, fl - 161, F[3]);
      pc.rect(bx, fl - 130, 10, 50, F[1]); for (let i = 0; i < 5; i++) pc.rect(bx - 12 + i * 0, fl - 140 + i * 12, 12, 4, F[2]);
      pc.rect(bx + bw, fl - 90, 12, 90, F[1]); pc.vline(bx + bw, fl - 90, 90, F[3]); pc.circle(bx + bw + 6, fl - 95, 7, F[1]);
      pc.rect(bx, fl - 70, bw, 26, F[2]); pc.hline(bx, fl - 70, bw, F[3]);
      pc.ellipse(bx + 40, fl - 78, 30, 10, P.blanket[2]); pc.hline(bx + 18, fl - 87, 40, F[3]); // travesseiro
      for (let x = bx + 70; x < bx + bw + 6; x++) { // colcha com dobras
        const yy = fl - 74 + Math.round(2 * Math.sin(x * 0.08));
        const bot = fl - 30 + Math.round(6 * Math.sin(x * 0.11) + 4 * Math.sin(x * 0.27));
        for (let y = yy; y < bot; y++) pc.px(x, y, P.blanket[(Math.sin(x * 0.11) > 0.3 ? 2 : Math.sin(x * 0.11) < -0.3 ? 0 : 1)]);
        pc.px(x, yy, F[3]);
      }
      pc.rect(bx, fl - 30, bw, 30, '#05040a'); // escuridão debaixo da cama
      for (const lx of [bx + 4, bx + bw - 10]) pc.rect(lx, fl - 30, 8, 30, F[1]);
      // criado-mudo com abajur
      const nx = 480;
      pc.rect(nx, fl - 52, 46, 52, F[1]); pc.hline(nx, fl - 52, 46, F[3]); pc.strokeRect(nx + 5, fl - 44, 36, 16, F[0]); pc.circle(nx + 23, fl - 36, 2, F[3]);
      pc.rect(nx + 20, fl - 76, 4, 24, F[2]); pc.ellipse(nx + 22, fl - 53, 8, 2, F[2]);
      pc.poly([[nx + 12, fl - 98], [nx + 32, fl - 98], [nx + 38, fl - 76], [nx + 6, fl - 76]], P.lampOn ? '#c88a48' : F[2]);
      if (P.lampOn) { pc.hline(nx + 6, fl - 76, 33, '#ffe0a0'); pc.poly([[nx + 14, fl - 96], [nx + 18, fl - 96], [nx + 12, fl - 78], [nx + 8, fl - 78]], '#e8b060'); }
      // guarda-roupa vivo, porta entreaberta
      const ax = 640, aw = 110, ah = 180;
      pc.rect(ax, fl - ah, aw, ah, F[1]); pc.vline(ax, fl - ah, ah, F[3]); pc.rect(ax - 6, fl - ah - 10, aw + 12, 10, F[2]); pc.hline(ax - 6, fl - ah - 10, aw + 12, F[3]);
      pc.rect(ax + 54, fl - ah + 6, 8, ah - 14, '#030208'); // fresta escura
      pc.strokeRect(ax + 8, fl - ah + 14, 40, 70, F[0]); pc.strokeRect(ax + 8, fl - ah + 94, 40, 70, F[0]);
      pc.poly([[ax + 62, fl - ah + 4], [ax + 104, fl - ah + 14], [ax + 104, fl - 18], [ax + 62, fl - 8]], F[2]); // porta aberta
      pc.circle(ax + 70, fl - 96, 2, F[3]); pc.circle(ax + 46, fl - 96, 2, F[3]);
      pc.rect(ax + 4, fl - 8, 8, 8, F[1]); pc.rect(ax + aw - 12, fl - 8, 8, 8, F[1]);
      pc.vline(ax + 66, fl - ah + 30, 50, '#2a2440'); pc.rect(ax + 64, fl - ah + 80, 6, 18, P.blanket[1]); // manga para fora
    },
    animate(ctx, cam, t, w, h, y) {
      const fl = y + 220 - 18;
      eachX(cam, 0.12, 900, w, 0, (X) => {
        drawEyes(ctx, X + 150, fl - 16, t, 0.1, '#ffe066', 6);
        drawEyes(ctx, X + 290, fl - 12, t, 0.45, '#b4ff8a', 5);
        drawEyes(ctx, X + 400, fl - 18, t, 0.8, '#e8ecff', 7);
        drawEyes(ctx, X + 640 + 56, 220 - 18 - 180 + y + 60, t, 0.3, '#ffe066', 3);
        drawEyes(ctx, X + 640 + 55, y + 220 - 18 - 70, t, 0.75, '#ff9a6a', 3);
        if (PAL[activeTod].lampOn) {
          ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 2.3) + (Math.random() < 0.03 ? -0.3 : 0);
          ctx.drawImage(sprites().glow, X + 480 + 22 - 30, fl - 84 - 30);
          ctx.globalAlpha = 1;
        }
      });
    },
  },
  // 3) corredor de pernas de móveis + brinquedos abandonados
  {
    width: 640, height: 200, speed: 0.22, speedY: 0.13, get fillBelow() { return PAL[curTod].legs[0]; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const C = P.legs;
      const r = lrng(77);
      const fl = h - 14;
      for (let x = 70; x < w; x += 90 + r.int(0, 50)) { // pernas torneadas sumindo no escuro
        const lw = r.int(10, 16);
        wrap(w, (o) => {
          for (let y = 0; y < fl; y++) {
            const bulge = Math.round(3 * Math.max(0, Math.sin(y * 0.09 + x)) + (y > fl - 20 ? (fl - y) * -0.1 : 0));
            const x0 = x + o - (lw >> 1) - bulge, ww = lw + bulge * 2;
            const fade = y / 70;
            for (let i = 0; i < ww; i++) {
              if (fade < 1 && ((x + o + i) * 7 + y * 3) % 16 / 16 > fade) continue;
              pc.px(x0 + i, y, i < 2 ? C[3] : i > ww - 3 ? C[0] : C[1]);
            }
          }
          pc.rect(x + o - lw, fl - 4, lw * 2, 4, C[2]);
        });
      }
      // brinquedos abandonados
      const T = P.toy;
      const toys = [
        (x) => { pc.ellipse(x, fl - 12, 14, 12, T[1]); pc.circle(x + 2, fl - 30, 10, T[1]); pc.circle(x - 6, fl - 38, 4, T[1]); pc.circle(x + 10, fl - 38, 4, T[1]); pc.px(x - 1, fl - 32, '#c8c4e8'); pc.ellipse(x + 4, fl - 26, 4, 2, T[2]); },
        (x) => { pc.rect(x - 18, fl - 18, 36, 14, T[1]); pc.rect(x - 10, fl - 30, 14, 12, T[1]); pc.circle(x - 10, fl - 3, 5, T[0]); pc.circle(x + 10, fl - 3, 5, T[0]); pc.rect(x + 6, fl - 26, 4, 8, T[2]); pc.hline(x - 18, fl - 18, 36, T[2]); },
        (x) => { pc.circle(x, fl - 11, 11, T[1]); pc.ellipseOutline(x, fl - 11, 11, 4, T[2]); pc.px(x - 4, fl - 17, T[2]); },
        (x) => { pc.rect(x - 6, fl - 34, 12, 34, T[1]); pc.circle(x, fl - 40, 7, T[1]); pc.px(x - 3, fl - 41, '#c8c4e8'); pc.px(x + 2, fl - 41, '#c8c4e8'); pc.line(x + 6, fl - 30, x + 14, fl - 46, T[2]); }, // caixa-surpresa
      ];
      for (let i = 0; i < 6; i++) { const x = r.int(10, w - 10), k = i % toys.length; wrap(w, (o) => toys[k](x + o)); }
      pc.rect(0, fl, w, 14, C[0]); pc.hline(0, fl, w, C[2]);
    },
    animate(ctx, cam, t, w, h, y) {
      const S = sprites();
      for (let i = 0; i < 3; i++) {
        const span = w + 120;
        let x = ((i * 260 + t * (6 + i * 3) - cam.x * 0.22) % span + span) % span - 60;
        const yy = Math.round(y + 120 + i * 14 + Math.sin(t * 0.7 + i * 2) * 6);
        ctx.globalAlpha = 0.75;
        ctx.drawImage(S.shadow[(Math.floor(t * 2 + i) & 1)], Math.round(x), yy);
        ctx.globalAlpha = 1;
        drawEyes(ctx, Math.round(x) + 15, yy + 10, t, i * 0.31, '#e8ecff', 6);
      }
    },
  },
  // 4) bagunça próxima no chão
  {
    width: 560, height: 110, speed: 0.4, speedY: 0.24, get fillBelow() { return PAL[curTod].near; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod]; const D = P.near, L = P.nearL;
      const r = lrng(19);
      const fl = h - 22;
      for (let i = 0; i < 14; i++) {
        const x = r.int(0, w), k = r.int(0, 3);
        wrap(w, (o) => {
          const X = x + o;
          if (k === 0) { for (let b = 0; b < 4; b++) { const bw = 30 - b * 4 + ((x * b) % 6); pc.rect(X - (bw >> 1) + b, fl - 6 - b * 6, bw, 6, D); pc.hline(X - (bw >> 1) + b, fl - 6 - b * 6, bw, L); } }
          else if (k === 1) { pc.rect(X, fl - 18, 18, 18, D); pc.hline(X, fl - 18, 18, L); pc.vline(X, fl - 18, 18, L); }
          else if (k === 2) { pc.rect(X, fl - 10, 16, 8, D); pc.rect(X + 10, fl - 6, 12, 6, D); pc.hline(X, fl - 10, 16, L); }
          else { pc.ellipse(X, fl - 3, 16, 5, D); pc.hline(X - 10, fl - 8, 20, L); }
        });
      }
      pc.rect(0, fl, w, 22, D); pc.hline(0, fl, w, L);
      for (let x = 0; x < w; x += 3) pc.vline(x, fl - 1 - ((x * 13) % 3), 2, D);
    },
    animate(ctx, cam, t, w, h, y) {
      ctx.fillStyle = '#b8b0e0';
      for (let i = 0; i < 14; i++) {
        const span = w + 20;
        const x = ((i * 97 + Math.sin(t * 0.3 + i) * 20 - cam.x * 0.3) % span + span) % span - 10;
        const yy = y + 10 + ((i * 53 + t * (3 + (i % 4))) % 90);
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.5 + i);
        ctx.fillRect(Math.round(x), Math.round(yy), 1, 1);
      }
      ctx.globalAlpha = 1;
    },
  },
];

const front = [
  {
    width: 512, height: 80, speed: 1.2, speedY: 0.2, drift: 7, y: 34, get alpha() { return PAL[curTod].fogA; },
    paint(pc, w, h, tod) {
      curTod = todOf(tod); const P = PAL[curTod];
      const r = lrng(404);
      for (let i = 0; i < 12; i++) {
        const cx = r.int(0, w), cy = r.int(30, h - 12), rx = r.int(40, 100), ry = r.int(6, 14);
        wrap(w, (o) => pc.dither(Math.round(cx + o - rx), Math.round(cy - ry), rx * 2, ry * 2, null, P.fog.slice(0, 7), (x, y) => {
          const dx = (x - rx) / rx, dy = (y - ry) / ry, d = dx * dx + dy * dy;
          return d < 1 ? (1 - d) * 0.7 : 0;
        }));
      }
    },
  },
];

registerBackground('w4', { sky, layers, front, defaultTimeOfDay: 'night' });
