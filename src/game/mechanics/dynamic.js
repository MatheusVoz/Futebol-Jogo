// =============================================================================
// mechanics/dynamic.js — Mecânicas das FASES DINÂMICAS (inspiradas em Cuphead):
// subida com câmera automática, montaria aquática e voo de "nave".
// Nada aqui exige mudanças no player.js: os veículos CONGELAM o Tico
// (player.state = 'frozen') e o carregam colado no assento a cada quadro
// (lateUpdate), tratando dano com player.hurt(1, fonte).
//
// Entidades (use em `objects` da fase; x,y em tiles):
//  dyn_scroller   CONTROLADOR DE CÂMERA automática. props.mode 'up' (sobe) | 'right'
//                 (anda p/ a direita); speed (px/s), delay (s antes de começar),
//                 zones [{row|col, speed}] (muda a velocidade ao passar), stop (linha/
//                 coluna onde para), hazard 'thorns'|'gears'|'rift' (perigo que sobe
//                 colado na borda de baixo), playX0/playX1 (colunas jogáveis; a câmera
//                 centraliza nelas se couber). No modo 'up', cair para fora da tela ou
//                 tocar o perigo = 1 de dano e o Tico reaparece numa plataforma perto
//                 da câmera (ou numa almofada de resgate) — nunca morte instantânea.
//  dyn_lifts      GERADOR DE PLATAFORMAS QUE SOBEM (estilo abelha-rainha): props.kind
//                 'balloon' (W1) | 'cog' (W3) | 'shard' (W5), w (tiles), speed (px/s),
//                 period (s entre plataformas), top (linha onde estouram/somem).
//                 A célula do objeto é o ponto de partida (embaixo).
//  dyn_rescue     almofada de resgate temporária (criada pelo scroller).
//  dyn_turtle     MONTARIA: tartaruga de pelúcia (W2). Analógico move em todas as
//                 direções na água; pular perto da superfície = salto para fora; no
//                 fundo = braçada. Ataque = bolhas. O Tico não usa oxigênio montado.
//  dyn_flyer      NAVE: props.skin 'plane' (avião de papel, W4) | 'carpet' (tapete de
//                 retalhos, W5); props.dir 'right' | 'up' (direção do tiro/rolagem);
//                 props.autoMount (padrão true) — false = espera o Tico encostar.
//                 Movimento livre 2D; ataque (segurar) = tiros; pulo/esquiva = rasante
//                 invulnerável curto.
//  dyn_dismount   ZONA DE DESEMBARQUE (props.w/h em tiles): o veículo solta o Tico.
//  dyn_checkpoint CHECKPOINT EM LINHA (para fases com veículo): props.axis 'x' (cruzar
//                 a coluna) | 'y' (cruzar a linha), props.h (altura em tiles).
//  Inimigos (Enemy): dyn_fish dyn_urchin dyn_gull (W2), dyn_bat dyn_eye dyn_scissors
//                 dyn_dustbunny (W4/W5; skin pelo mundo), chefe dyn_boss_sock
//                 ("O Bicho-Papão de Meia" — miniboss do voo, aparece quando a
//                 rolagem termina e conclui a fase ao ser vencido).
//  dyn_decor      decoração extra desenhada (props.kind: 'clockface', 'lantern',
//                 'toys', 'spiral', 'bell', 'sign_arrow').
// Fases que usam: levels/dynamic_levels.js (w1_climb w2_ride w3_tower w4_fly w5_rise).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, approach, damp, rand, rectsOverlap } from '../../engine/util.js';
import { T, moveBody, isSolidType } from '../../engine/tilemap.js';
import { defineSprite, drawSprite, animFrame, defineImage, drawImage, getImage } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { input } from '../../engine/input.js';
import { registerEntity } from '../registry.js';
import { Enemy, EnemyProjectile } from '../enemies/base.js';
import { drawGlow, spawnShockwave, drawThreadLine } from '../art/vfx.js';

const Rn = Math.round;
const TAU = Math.PI * 2;

// =============================================================================
// utilidades de desenho
// =============================================================================
/** Elipse rotacionada (polígono) — para nadadeiras, asas etc. */
function blob(pc, cx, cy, rx, ry, ang, c, n = 18) {
  const pts = [], ca = Math.cos(ang), sa = Math.sin(ang);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
  }
  pc.poly(pts, c);
}
/** Pinta linhas (pautas) só onde já há pixel desenhado. */
function ruleLines(pc, x0, y0, x1, y1, step, c) {
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x++) if (pc.alphaAt(x, y) > 0) pc.px(x, y, c);
}
const worldOf = (level) => level?.data?.world || 1;

// =============================================================================
// ARTE — veículos
// =============================================================================
// ---- tartaruga de pelúcia com casco de retalhos (olha à direita), 52×30, pivô embaixo
defineSprite('dyn_turtle', {
  w: 54, h: 32, ox: 27, oy: 32,
  anims: { swim: { frames: 4, fps: 8 }, leap: { frames: 2, fps: 6 } },
  draw(pc, anim, f) {
    const leap = anim === 'leap';
    const back = leap ? 0.9 : [0.45, 0.15, -0.2, 0.15][f];
    const front = leap ? -1.0 : [-0.55, -0.15, 0.3, -0.15][f];
    blob(pc, 11, 24, 7, 3, back, '#4f9c66');                         // nadadeira de trás
    blob(pc, 11, 23, 5, 2, back, '#7ccb8e');
    pc.ellipse(26, 23, 18, 6, '#c8a564');                             // barriga
    pc.ellipse(26, 22, 17, 5, '#ecd6a0');
    for (let x = 14; x < 40; x += 4) pc.px(x, 26, '#b8904c');         // costura da barriga
    pc.ellipse(24, 16, 17, 11, '#2f7a4a');                            // casco
    pc.ellipse(24, 15, 16, 10, '#3f9a5c');
    pc.ellipse(21, 11, 10, 5, '#62bf78');                             // luz do casco
    // retalhos do casco
    pc.poly([[15, 9], [21, 7], [23, 12], [16, 14]], '#8ad49a');
    pc.poly([[25, 7], [32, 9], [31, 14], [25, 13]], '#d6e86a');
    pc.poly([[10, 15], [16, 15], [17, 20], [10, 20]], '#2e7048');
    pc.poly([[19, 15], [27, 15], [27, 21], [19, 21]], '#ff9a7a');
    pc.poly([[30, 15], [37, 14], [38, 20], [31, 20]], '#5ab0d0');
    // pontos de costura entre retalhos
    for (const [x, y] of [[22, 9], [22, 11], [24, 14], [17, 17], [28, 17], [30, 18], [18, 20], [29, 12], [14, 12]]) pc.px(x, y, '#f4ffd8');
    pc.ellipse(24, 22, 17, 2, '#245c38');                             // aba do casco
    for (let x = 9; x < 41; x += 3) pc.px(x, 22, '#9ee0a8');
    pc.ellipse(37, 19, 5, 4, '#7ccb8e');                              // pescoço
    pc.ellipse(44, 16, 8, 7, '#86cf96');                              // cabeça
    pc.ellipse(43, 13, 5, 3, '#a8e4b4');
    pc.rect(46, 12, 2, 4, '#120a18'); pc.px(46, 12, '#ffffff');       // olho
    pc.px(49, 17, '#ff8aa8'); pc.px(50, 17, '#ff8aa8');               // bochecha
    pc.px(47, 19, '#1b3a2a'); pc.px(48, 20, '#1b3a2a'); pc.px(49, 20, '#1b3a2a');
    blob(pc, 34, 26, 8, 3, front, '#4f9c66');                         // nadadeira da frente
    blob(pc, 34, 25, 6, 2, front, '#7ccb8e');
    pc.outline('#12301e');
  },
});

// ---- avião de papel pautado (caderno), 58×26, pivô embaixo-centro. 'back' atrás do Tico, 'front' na frente
defineSprite('dyn_plane', {
  w: 60, h: 28, ox: 30, oy: 22,
  anims: { back: { frames: 2, fps: 10 }, front: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    const fl = f ? 1 : 0;
    if (anim === 'back') {
      pc.poly([[4, 2 + fl], [57, 18], [16, 18]], '#d8dcf0');          // asa de lá (sombra)
      pc.poly([[6, 3 + fl], [55, 17], [18, 17]], '#f4f6ff');
      ruleLines(pc, 6, 6, 55, 17, 3, '#b4c8f0');
      for (let y = 4; y < 18; y++) if (pc.alphaAt(14, y) > 0) pc.px(14, y, '#ff8a9a');  // margem vermelha
      pc.outline('#2a3456');
      return;
    }
    pc.poly([[2, 18], [58, 18], [14, 26 - fl]], '#ffffff');            // fuselagem (dobra da frente)
    pc.poly([[4, 18], [56, 18], [16, 22]], '#eef0fa');
    pc.hline(6, 18, 50, '#c8d0ea');
    pc.line(14, 25 - fl, 56, 18, '#c0c8e4');
    ruleLines(pc, 3, 20, 50, 25, 3, '#c4d4f4');
    pc.px(40, 20, '#ffd23f'); pc.px(41, 20, '#ffd23f');               // adesivo de estrela
    pc.outline('#2a3456');
  },
});

// ---- tapete voador de retalhos (W5), 46×16, ondulando
defineSprite('dyn_carpet', {
  w: 48, h: 18, ox: 24, oy: 10,
  anims: { fly: { frames: 4, fps: 9 } },
  draw(pc, a, f) {
    const cols = ['#ff5a7a', '#ffd23f', '#8a5aff', '#3fc7c0', '#ff8a3c'];
    for (let x = 4; x < 44; x++) {
      const off = Math.round(Math.sin(x * 0.3 + (f * Math.PI) / 2) * 1.6);
      const c = cols[Math.floor((x - 4) / 8) % cols.length];
      pc.vline(x, 6 + off, 5, c);
      pc.px(x, 6 + off, '#fff3a8');
      pc.px(x, 10 + off, '#8a5a14');
      if ((x - 4) % 8 === 0) pc.vline(x, 7 + off, 3, '#fff3a8');
      if (x % 2 === 0) pc.px(x, 8 + off, '#ffffff40');
    }
    for (const x of [4, 43]) {                                         // franjas douradas
      const off = Math.round(Math.sin(x * 0.3 + (f * Math.PI) / 2) * 1.6);
      for (let i = 0; i < 3; i++) pc.vline(x + (x < 10 ? -1 - i : 1 + i), 7 + off + i, 3, i % 2 ? '#e0a020' : '#ffd23f');
    }
    pc.outline('#2a0a24');
  },
});

// =============================================================================
// ARTE — plataformas e perigos
// =============================================================================
defineImage('dyn_plank', 48, 8, (pc) => {
  pc.rect(0, 1, 48, 6, '#b07a40'); pc.hline(0, 1, 48, '#e0aa66'); pc.hline(0, 6, 48, '#7a4a20');
  for (let x = 6; x < 48; x += 12) pc.vline(x, 2, 4, '#8a5a2a');
  for (let x = 2; x < 48; x += 4) pc.px(x, 4, '#f4d090');
  pc.outline('#3a1e0a');
});
defineImage('dyn_cogstep', 48, 10, (pc) => {
  pc.rect(0, 1, 48, 7, '#c8902c'); pc.hline(0, 1, 48, '#ffe08a'); pc.hline(0, 7, 48, '#7a4a14');
  for (let x = 4; x < 48; x += 8) { pc.px(x, 4, '#5a3410'); pc.px(x + 1, 4, '#fff0b0'); }
  pc.circle(24, 5, 4, '#e0a83c'); pc.ring(24, 5, 4, '#7a4a14'); pc.px(24, 5, '#3a2008');
  for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; pc.px(Rn(24 + Math.cos(an) * 5), Rn(5 + Math.sin(an) * 5), '#7a4a14'); }
  pc.outline('#2a1606');
});
defineImage('dyn_shard', 48, 10, (pc) => {
  pc.poly([[0, 3], [8, 0], [40, 0], [48, 3], [42, 9], [6, 9]], '#8a1036');
  pc.poly([[2, 3], [9, 1], [39, 1], [46, 3], [41, 7], [7, 7]], '#e0284e');
  pc.poly([[6, 2], [20, 1], [16, 4], [8, 4]], '#ff9ab0');
  pc.hline(4, 8, 40, '#ffd23f');
  for (let x = 6; x < 44; x += 6) pc.px(x, 5, '#ffe0e8');
  pc.outline('#12061a');
});
/** Almofada de resgate (cor por mundo). */
const PAD_COL = { 1: ['#7fd08a', '#4f9c66', '#c8f0c0'], 2: ['#7fd6ff', '#3a8ac0', '#d8f6ff'], 3: ['#ffc870', '#c8862c', '#fff0c0'], 4: ['#b89aff', '#6a4ac0', '#e8dcff'], 5: ['#ff8ab0', '#c03a6a', '#ffe0ec'] };
for (const wk of [1, 2, 3, 4, 5]) {
  const [a, b, c] = PAD_COL[wk];
  defineImage('dyn_pad_' + wk, 50, 14, (pc) => {
    pc.ellipse(25, 8, 24, 5, b); pc.ellipse(25, 7, 23, 4, a); pc.ellipse(20, 5, 12, 2, c);
    for (let x = 6; x < 46; x += 4) pc.px(x, 7, b);
    for (const x of [3, 47]) { pc.px(x, 4, a); pc.px(x, 11, a); }
    pc.circle(25, 7, 2, '#ffd23f'); pc.px(25, 7, '#8a5a14');
    pc.outline('#1a1a2a');
  });
}
// engrenagem pesada do perigo do Mundo 3
defineSprite('dyn_hgear', {
  w: 44, h: 44, ox: 22, oy: 22,
  anims: { spin: { frames: 6, fps: 10 } },
  draw(pc, a, f) {
    const rot = (f / 6) * (TAU / 10);
    for (let i = 0; i < 10; i++) {
      const an = rot + (i / 10) * TAU;
      blob(pc, 22 + Math.cos(an) * 18, 22 + Math.sin(an) * 18, 4, 3, an, '#4a4048', 8);
    }
    pc.circle(22, 22, 17, '#5a5058'); pc.circle(22, 22, 15, '#6e6470'); pc.circle(20, 20, 9, '#867c88');
    pc.circle(22, 22, 6, '#c8902c'); pc.circle(22, 22, 3, '#2a1a10');
    for (let i = 0; i < 4; i++) { const an = rot * 2 + (i / 4) * TAU; pc.thickLine(22 + Math.cos(an) * 7, 22 + Math.sin(an) * 7, 22 + Math.cos(an) * 13, 22 + Math.sin(an) * 13, 1, '#3a3038'); }
    pc.outline('#120c10');
  },
});

// =============================================================================
// ARTE — inimigos
// =============================================================================
defineSprite('dyn_fish', {
  w: 22, h: 14, ox: 11, oy: 7, anims: { swim: { frames: 2, fps: 6 } },
  draw(pc, a, f) {
    pc.poly([[16, 7], [21, 2 + f], [21, 12 - f]], '#e0602c');            // cauda
    pc.ellipse(9, 7, 8, 5, '#ff8a3c'); pc.ellipse(8, 5, 6, 2, '#ffc070');
    for (let y = 4; y <= 10; y += 3) pc.px(12, y, '#c04a1c');
    pc.rect(4, 5, 2, 2, '#120a18'); pc.px(4, 5, '#fff');
    pc.rect(13, 0, 2, 3, '#c8c8d8'); pc.rect(12, 0, 4, 1, '#c8c8d8');     // chave de corda
    pc.outline('#3a1404');
  },
});
defineSprite('dyn_urchin', {
  w: 22, h: 22, ox: 11, oy: 11, anims: { idle: { frames: 2, fps: 3 } },
  draw(pc, a, f) {
    for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU + f * 0.13; pc.thickLine(11, 11, 11 + Math.cos(an) * 10, 11 + Math.sin(an) * 10, 0.6, '#5a2a7a'); }
    pc.circle(11, 11, 7, '#7a3aa0'); pc.circle(10, 9, 4, '#a868d0');
    pc.circle(11, 11, 2, f ? '#ff3a4a' : '#7a1020'); if (f) pc.px(10, 10, '#ffd0d0');
    pc.outline('#1a0826');
  },
});
defineSprite('dyn_gull', {
  w: 24, h: 16, ox: 12, oy: 8, anims: { fly: { frames: 2, fps: 6 } },
  draw(pc, a, f) {
    const wy = f ? 12 : 1;
    pc.poly([[8, 8], [3, wy], [13, 7]], '#d8dcea'); pc.poly([[12, 8], [20, wy], [16, 7]], '#c4c8da');
    pc.ellipse(11, 8, 6, 3, '#ffffff'); pc.ellipse(5, 7, 3, 3, '#ffffff');
    pc.poly([[2, 7], [0, 8], [2, 9]], '#ffb030'); pc.px(4, 6, '#120a18');
    pc.poly([[16, 8], [21, 6], [21, 10]], '#b8bcd0');
    pc.outline('#2a3040');
  },
});
const SKIN = {
  4: { body: '#2a1c48', hi: '#4a3a7a', eye: '#ffd870', wing: '#1a1030', glow: '#ffd870' },
  5: { body: '#7a1036', hi: '#c0305a', eye: '#fff3a8', wing: '#4a0a26', glow: '#ff4f8a' },
};
for (const wk of [4, 5]) {
  const S = SKIN[wk];
  defineSprite('dyn_bat_' + wk, {
    w: 24, h: 16, ox: 12, oy: 8, anims: { fly: { frames: 3, fps: 12 } },
    draw(pc, a, f) {
      const wy = [2, 8, 13][f];
      pc.poly([[10, 8], [1, wy], [4, 10], [8, 11]], S.wing); pc.poly([[14, 8], [23, wy], [20, 10], [16, 11]], S.wing);
      pc.ellipse(12, 9, 5, 4, S.body); pc.ellipse(11, 7, 3, 2, S.hi);
      pc.px(9, 4, S.body); pc.px(15, 4, S.body); pc.px(9, 5, S.body); pc.px(15, 5, S.body);
      pc.px(10, 8, S.eye); pc.px(14, 8, S.eye);
      if (wk === 5) { pc.vline(12, 13, 3, '#ffd23f'); }                 // ferrão de agulha
      pc.outline('#08040e');
    },
  });
  defineSprite('dyn_eye_' + wk, {
    w: 24, h: 24, ox: 12, oy: 12, anims: { idle: { frames: 2, fps: 2 }, charge: { frames: 2, fps: 12 } },
    draw(pc, a, f) {
      for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + 0.3; pc.thickLine(12, 12, 12 + Math.cos(an) * 11, 12 + Math.sin(an) * 11, 0.7, S.wing); }
      pc.circle(12, 12, 8, '#f0e8f8'); pc.circle(11, 10, 5, '#ffffff');
      for (const [x, y] of [[6, 14], [7, 15], [17, 9], [18, 9], [16, 16]]) pc.px(x, y, '#e06080');
      const iris = a === 'charge' ? (f ? '#ff3a4a' : '#ffd23f') : wk === 5 ? '#e0284e' : '#6a4ac0';
      pc.circle(12, 12, 4, iris); pc.circle(12, 12, 2, '#120a18'); pc.px(11, 11, '#ffffff');
      if (a === 'idle' && f) pc.rect(4, 5, 16, 5, S.body);              // pálpebra piscando
      pc.outline('#08040e');
    },
  });
}
defineSprite('dyn_scissors', {
  w: 28, h: 16, ox: 14, oy: 8, anims: { open: { frames: 2, fps: 10 } },
  draw(pc, a, f) {
    const o = f ? 4 : 1;
    pc.thickLine(13, 8, 0, 8 - o, 1.2, '#c8d0e0'); pc.thickLine(13, 8, 0, 8 + o, 1.2, '#a8b0c8');
    pc.line(13, 8, 1, 8 - o, '#ffffff');
    pc.ring(18, 4, 3, '#ff4f6a'); pc.ring(18, 12, 3, '#ff4f6a'); pc.ring(18, 4, 2, '#c02040'); pc.ring(18, 12, 2, '#c02040');
    pc.circle(13, 8, 1, '#ffd23f');
    pc.px(22, 3, '#ff9ab0');
    pc.outline('#1a1020');
  },
});
defineSprite('dyn_needle', {
  w: 12, h: 30, ox: 6, oy: 15, anims: { idle: { frames: 2, fps: 10 } },
  draw(pc, a, f) {
    pc.rect(5, 2, 3, 24, '#e0e4f0'); pc.vline(5, 2, 24, '#ffffff');
    pc.poly([[5, 26], [8, 26], [6, 29]], '#c8ccdc');
    pc.rect(5, 3, 3, 4, '#2a1a30'); pc.px(6, 4, '#ff4f8a');
    pc.thickLine(6, 3, 2 + f * 2, 0, 0.6, '#ffd23f');
    pc.outline('#12061a');
  },
});
defineSprite('dyn_dustbunny', {
  w: 26, h: 26, ox: 13, oy: 13, anims: { idle: { frames: 3, fps: 8 } },
  draw(pc, a, f) {
    for (let i = 0; i < 14; i++) { const an = (i / 14) * TAU + f * 0.15; const r = 10 + ((i + f) % 3); pc.thickLine(13, 13, 13 + Math.cos(an) * r, 13 + Math.sin(an) * r, 0.7, i % 2 ? '#4a4258' : '#6a6078'); }
    pc.circle(13, 13, 8, '#5a5268'); pc.circle(11, 11, 4, '#7a7290');
    pc.px(10, 12, '#ffd870'); pc.px(15, 12, '#ffd870'); pc.px(10, 11, '#fff4c0'); pc.px(15, 11, '#fff4c0');
    pc.ellipse(9, 4, 2, 4, '#5a5268'); pc.ellipse(17, 4, 2, 4, '#5a5268');   // orelhinhas de coelho
    pc.outline('#120c18');
  },
});
// ---- chefe: Bicho-Papão de Meia (meia listrada gigante virada para a esquerda)
defineSprite('dyn_sock', {
  w: 80, h: 76, ox: 40, oy: 40,
  anims: { idle: { frames: 4, fps: 6 }, open: { frames: 2, fps: 10 } },
  draw(pc, anim, f) {
    const open = anim === 'open';
    const bob = anim === 'idle' ? [0, 1, 2, 1][f] : 0;
    // tentáculos de sombra embaixo
    for (let i = 0; i < 5; i++) {
      const x = 20 + i * 10, sway = Math.sin(f * 1.6 + i) * 3;
      pc.thickLine(x, 56 + bob, x + sway, 72, 2.2 - i * 0.2, '#1a1030');
      pc.thickLine(x, 56 + bob, x + sway * 0.6, 66, 1.2, '#2e2050');
    }
    // perna da meia (vertical, à direita)
    const legX = 40, top = 4 + bob;
    pc.rect(legX, top, 26, 40, '#2e2260');
    for (let y = top; y < top + 40; y += 8) pc.rect(legX, y, 26, 4, '#5a3a9a');
    pc.rect(legX - 1, top, 28, 7, '#8a6ad0');                         // punho canelado
    for (let x = legX; x < legX + 28; x += 3) pc.vline(x, top, 7, '#6a4ab0');
    // pé (horizontal, cabeça à esquerda)
    pc.ellipse(34, 46 + bob, 30, 13, '#2e2260');
    for (let x = 8; x < 64; x += 8) pc.dither(x, 34 + bob, 4, 26, null, '#5a3a9a', 0.85);
    pc.ellipse(10, 46 + bob, 9, 11, '#ffd23f');                       // ponta remendada
    pc.ellipse(9, 44 + bob, 6, 7, '#ffe98a');
    pc.circle(58, 52 + bob, 6, '#ff8a3c');                            // calcanhar remendado
    for (let a = 0; a < 12; a++) { const an = (a / 12) * TAU; pc.px(Rn(58 + Math.cos(an) * 6), Rn(52 + bob + Math.sin(an) * 6), '#ffd0a0'); }
    // olhos de botão (desiguais)
    pc.circle(20, 38 + bob, 6, '#ffd23f'); pc.circle(20, 38 + bob, 4, '#e0a020');
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pc.px(20 + dx * 2, 38 + bob + dy * 2, '#5a3a00');
    pc.circle(33, 36 + bob, 4, '#ff6fa8'); pc.circle(33, 36 + bob, 2, '#c03a7a'); pc.px(33, 36 + bob, '#ffd0e0');
    // boca
    if (open) {
      pc.ellipse(18, 53 + bob, 13, 6 + f, '#2a0a1a'); pc.ellipse(18, 55 + bob, 8, 3, '#8a1a3a');
      for (let x = 8; x < 30; x += 4) { pc.tri(x, 48 + bob, x + 3, 48 + bob, x + 1.5, 51 + bob, '#ffffff'); pc.tri(x, 59 + bob + f, x + 3, 59 + bob + f, x + 1.5, 56 + bob + f, '#ffffff'); }
    } else {
      pc.hline(8, 53 + bob, 22, '#120a18');
      for (let x = 9; x < 30; x += 3) pc.vline(x, 52 + bob, 3, '#c8b8e8');   // boca costurada
    }
    pc.outline('#0a0614');
  },
});

// =============================================================================
// SCROLLER — câmera automática + perigo que sobe + resgate
// =============================================================================
class Scroller extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 1; this.h = 1;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 70;
    this.mode = p.mode || 'up';
    this.baseSpeed = p.speed ?? 24;
    this.speed = 0;
    this.delay = p.delay ?? 2.2;
    this.zones = p.zones || [];
    this.hazard = p.hazard || null;
    this.stopAt = p.stop ?? null;
    this.playX0 = (p.playX0 ?? 0) * TILE;
    this.playX1 = p.playX1 != null ? (p.playX1 + 1) * TILE : null;
    this.runT = 0; this.rescueCd = 0; this.done = false;
    this.vehicle = null;
    this.gateY = null;        // (modo 'up') a câmera não passa daqui enquanto ninguém montar
    this.camX = 0; this.camY = 0;
  }
  get cam() { return this.level.camera; }
  init() {
    const L = this.level, cam = L.camera, p = L.player;
    L.scroller = this;
    if (this.playX1 == null) this.playX1 = L.map.width;
    cam.manual = true;
    if (this.mode === 'up') {
      this.camY = clamp(p.y + p.h - cam.viewH * 0.66, 0, this.maxY());
      this.camX = this.wantX(p);
    } else {
      this.camX = clamp(p.cx - cam.viewW * 0.3, 0, this.limX());
      this.camY = this.wantY(p.cy);
    }
    this.apply();
  }
  maxY() { return Math.max(0, this.level.map.height - this.cam.viewH); }
  limX() {
    const vw = this.cam.viewW, mw = this.level.map.width;
    const end = this.stopAt != null ? Math.min(mw, this.stopAt * TILE) : mw;
    return Math.max(0, end - vw);
  }
  wantX(focus) {
    const vw = this.cam.viewW, mw = this.level.map.width;
    if (mw <= vw) return (mw - vw) / 2;
    const pw = this.playX1 - this.playX0;
    let x;
    if (vw >= pw + 8) x = (this.playX0 + this.playX1) / 2 - vw / 2;
    else x = clamp(focus.cx - vw / 2, this.playX0 - 8, this.playX1 + 8 - vw);
    return clamp(x, 0, mw - vw);
  }
  wantY(cy) {
    const vh = this.cam.viewH, mh = this.level.map.height;
    if (mh <= vh) return mh - vh;
    return clamp(cy - vh / 2, 0, mh - vh);
  }
  apply() {
    const cam = this.cam;
    if (cam.pan) return;
    cam.manual = true;
    cam.x = this.camX; cam.y = this.camY;
  }
  /** Linha (px) do topo do perigo que sobe. */
  hazardTop() { return this.camY + this.cam.viewH - (16 + Math.sin(this.t * 1.3) * 3); }

  update(dt) {
    const L = this.level, cam = L.camera, p = L.player;
    this.t += dt;
    if (this.rescueCd > 0) this.rescueCd -= dt;
    const paused = L.inputLocked || L.state !== 'play' || !!L.dialogue?.active;
    if (!paused) this.runT += dt;
    let target = this.baseSpeed;
    for (const z of this.zones) {
      if (this.mode === 'up' ? this.camY <= z.row * TILE : this.camX >= z.col * TILE) target = z.speed;
    }
    const ramp = clamp((this.runT - this.delay) / 1.5, 0, 1);
    this.speed = paused ? 0 : damp(this.speed, target * ramp, 3, dt);
    const v = this.vehicle && !this.vehicle.dead && this.vehicle.mounted ? this.vehicle : null;
    const focus = v || p;
    if (this.mode === 'up') {
      const lim = this.stopAt != null ? this.stopAt * TILE : 0;
      let ny = this.camY - this.speed * dt;
      const want = focus.cy - cam.viewH * 0.42;
      if (want < ny && !paused && p.state !== 'dead') ny += (want - ny) * Math.min(1, dt * 5);
      if (this.gateY != null && !v) ny = Math.max(ny, this.gateY);
      this.camY = clamp(Math.min(this.camY, ny), Math.min(lim, this.maxY()), this.maxY());
      this.done = this.camY <= lim + 0.5;
      this.camX = damp(this.camX, this.wantX(focus), 6, dt);
    } else {
      const lim = this.limX();
      this.camX = Math.min(lim, this.camX + this.speed * dt);
      this.done = this.camX >= lim - 0.5;
      this.camY = damp(this.camY, this.wantY(focus.cy), 3, dt);
    }
    this.apply();
    // perigo / queda (só no modo de subida, a pé)
    if (this.mode === 'up' && !v && p.state !== 'dead' && L.state === 'play') {
      const fellOut = p.y > this.camY + cam.viewH + 4;
      const touched = this.hazard && p.bottom > this.hazardTop() + 7;
      if (fellOut || touched) this.rescue();
      if (this.hazard && Math.random() < dt * 10) this.emitHazard();
    }
  }

  emitHazard() {
    const L = this.level, cam = L.camera;
    const x = cam.x + rand(0, cam.viewW), y = this.hazardTop() + 4;
    if (this.hazard === 'thorns') L.particles.emit('shadow_wisp', x, y, 1, { colors: ['#8a4aa8', '#5a2a7a', '#c08ad8'] });
    else if (this.hazard === 'gears') L.particles.emit(Math.random() < 0.5 ? 'smoke' : 'ember', x, y, 1);
    else if (this.hazard === 'rift') L.particles.emit('w5_embers', x, y, 1);
  }

  /** Dano + reaparecer numa plataforma perto do topo da tela. */
  rescue() {
    if (this.rescueCd > 0) return;
    this.rescueCd = 0.8;
    const L = this.level, p = L.player, cam = L.camera;
    L.particles.emit('fluff', p.cx, Math.min(p.cy, this.camY + cam.viewH - 6), 10);
    p.hurt(1, null, { noKnock: true });
    if (p.state === 'dead' || p.hp <= 0) return;
    const spot = this.findSpot();
    let px, py;
    if (spot) { px = spot.x; py = spot.y; }
    else {
      px = clamp(p.cx, this.playX0 + 30, this.playX1 - 30);
      py = Rn(this.camY + cam.viewH * 0.48);
      L.add(new RescuePad(L, px - 25, py, { world: worldOf(L) }));
    }
    p.x = px - p.w / 2; p.y = py - p.h;
    p.vx = 0; p.vy = 0;
    if (p.state === 'hurt') p.state = 'normal';
    p.invuln = Math.max(p.invuln || 0, 1.0);
    L.particles.emit('sparkle', p.cx, p.cy, 12);
    spawnShockwave(L, p.cx, p.bottom - 4, { radius: 22, color: '#ffffff', particles: false });
    audio.sfx('spring', { pitch: 1.3, vol: 0.6 });
  }
  /** Procura chão firme (tile) na faixa 28%–60% da tela, perto do Tico. */
  findSpot() {
    const L = this.level, map = L.map, cam = L.camera, p = L.player;
    const ty0 = Math.floor((this.camY + cam.viewH * 0.28) / TILE), ty1 = Math.floor((this.camY + cam.viewH * 0.62) / TILE);
    const tx0 = Math.max(1, Math.floor(Math.max(this.playX0, cam.x + 16) / TILE)), tx1 = Math.min(map.cols - 2, Math.floor((Math.min(this.playX1, cam.x + cam.viewW - 16)) / TILE) - 1);
    const free = (tx, ty) => { const t = map.get(tx, ty); return t === T.EMPTY || t === T.BG || t === T.FAKE; };
    let best = null, bd = 1e9;
    const mid = (ty0 + ty1) / 2;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = map.get(tx, ty);
        if (!(isSolidType(t) || t === T.ONEWAY)) continue;
        if (!free(tx, ty - 1) || !free(tx, ty - 2)) continue;
        if (map.get(tx - 1, ty) === T.SPIKE || map.get(tx + 1, ty) === T.SPIKE || map.get(tx, ty - 1) === T.SPIKE) continue;
        const r = { x: tx * TILE - 4, y: (ty - 2) * TILE, w: TILE + 8, h: TILE * 2 };
        if (L.query(r, (e) => (e.enemy || e.hazard) && !e.dead).length) continue;
        const d = Math.abs(tx * TILE + 8 - p.cx) / TILE + Math.abs(ty - mid) * 1.5;
        if (d < bd) { bd = d; best = { x: tx * TILE + 8, y: ty * TILE }; }
      }
    }
    return best;
  }

  draw(ctx) {
    if (this.mode !== 'up' || !this.hazard) return;
    const cam = this.cam, t = this.t;
    const x0 = Math.floor(cam.x) - 10, w = Math.ceil(cam.viewW) + 20;
    const top = this.hazardTop(), bot = this.camY + cam.viewH + 12;
    if (this.hazard === 'thorns') drawThorns(ctx, x0, w, top, bot, t);
    else if (this.hazard === 'gears') drawGears(ctx, x0, w, top, bot, t);
    else if (this.hazard === 'rift') drawRift(ctx, x0, w, top, bot, t);
  }
}
registerEntity('dyn_scroller', Scroller);

// ---- perigos que sobem (desenho procedural barato: colunas de 2 px)
function waveY(x, top, t, a = 3) { return top + Math.sin(x * 0.07 + t * 1.8) * a + Math.sin(x * 0.19 - t * 2.6) * 1.5; }
function drawThorns(ctx, x0, w, top, bot, t) {
  drawGlow(ctx, x0 + w / 2, top + 4, w * 0.6, '#b060ff', 0.12);
  for (let i = 0; i < w; i += 2) {
    const x = x0 + i, y = Rn(waveY(x, top, t));
    ctx.fillStyle = '#2a1238'; ctx.fillRect(x, y, 2, bot - y);
    ctx.fillStyle = '#4a2060'; ctx.fillRect(x, y + 3, 2, 3);
    ctx.fillStyle = '#7a3a90'; ctx.fillRect(x, y, 2, 2);
  }
  // espinhos (sarça com alfinetes)
  for (let k = Math.floor(x0 / 13) * 13; k < x0 + w; k += 13) {
    const y = Rn(waveY(k, top, t)) + 1, hh = 5 + ((k / 13) % 3);
    for (let j = 0; j < hh; j++) { ctx.fillStyle = j > hh - 2 ? '#f4d8ff' : '#c89ad8'; const ww = Math.max(1, Math.round((hh - j) / 2)); ctx.fillRect(k - (ww >> 1), y - j, ww, 1); }
  }
  // vinhas enroladas e olhos brilhando lá dentro
  ctx.fillStyle = '#1e3a2a';
  for (let i = 0; i < w; i += 3) { const x = x0 + i; ctx.fillRect(x, Rn(top + 9 + Math.sin(x * 0.12 + t) * 3), 3, 2); }
  for (let k = Math.floor(x0 / 70) * 70 + 20; k < x0 + w; k += 70) {
    const blink = Math.sin(t * 2 + k) > 0.92;
    if (blink) continue;
    const y = Rn(top + 14 + Math.sin(k + t * 0.7) * 2);
    ctx.fillStyle = '#ff9af0'; ctx.fillRect(k, y, 2, 2); ctx.fillRect(k + 5, y, 2, 2);
  }
}
function drawGears(ctx, x0, w, top, bot, t) {
  drawGlow(ctx, x0 + w / 2, top + 6, w * 0.6, '#ff8a3c', 0.18);
  const f = Math.floor(t * 10) % 6;
  for (let k = Math.floor(x0 / 40) * 40; k < x0 + w + 40; k += 40) {
    const alt = (k / 40) % 2 === 0;
    drawSprite(ctx, 'dyn_hgear', 'spin', alt ? f : 5 - f, k, Rn(top + 16 + (alt ? 0 : 6)));
  }
  ctx.fillStyle = '#1e1418'; ctx.fillRect(x0, Rn(top + 22), w, bot - top);
  // esteira de dentes
  const off = Math.floor(t * 30) % 8;
  for (let x = x0 - 8 + off; x < x0 + w; x += 8) { ctx.fillStyle = '#3a3038'; ctx.fillRect(x, Rn(top + 20), 5, 4); ctx.fillStyle = '#c8902c'; ctx.fillRect(x, Rn(top + 20), 5, 1); }
  ctx.fillStyle = '#ff8a3c'; ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2;
  ctx.fillRect(x0, Rn(top + 25), w, 1); ctx.globalAlpha = 1;
}
function drawRift(ctx, x0, w, top, bot, t) {
  drawGlow(ctx, x0 + w / 2, top + 6, w * 0.6, '#ff4f8a', 0.2);
  for (let i = 0; i < w; i += 2) {
    const x = x0 + i;
    const jag = ((Math.floor(x / 2) * 7 + Math.floor(t * 8)) % 5) - 2;
    const y = Rn(waveY(x, top, t, 2.5) + jag * 0.6);
    ctx.fillStyle = '#12061a'; ctx.fillRect(x, y, 2, bot - y);
    ctx.fillStyle = '#ff4f8a'; ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = '#5a1040'; ctx.fillRect(x, y + 2, 2, 2);
    if (jag === 2) { ctx.fillStyle = '#ffd0e0'; ctx.fillRect(x, y - 1, 2, 1); }
  }
  // estrelas e fios dourados dentro da fenda
  for (let k = 0; k < 14; k++) {
    const sx = x0 + ((k * 97 + Math.floor(t * 3) * 13) % w), sy = top + 8 + ((k * 31) % 22);
    if ((k + Math.floor(t * 4)) % 3 === 0) continue;
    ctx.fillStyle = k % 2 ? '#ffd23f' : '#ffffff'; ctx.fillRect(Rn(sx), Rn(sy), 1, 1);
  }
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < w; i += 2) { const x = x0 + i; ctx.fillRect(x, Rn(top + 12 + Math.sin(x * 0.05 + t * 2) * 4), 2, 1); }
}

// =============================================================================
// ALMOFADA DE RESGATE
// =============================================================================
class RescuePad extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 50; this.h = 8; this.oneway = true; this.z = 9; this.alwaysUpdate = true;
    this.life = 4.5; this.img = 'dyn_pad_' + (p.world || 1);
  }
  update(dt) {
    this.tickTimers(dt);
    const p = this.player;
    if (p && p.groundEntity === this) this.life = Math.max(this.life, 1.6);
    this.life -= dt;
    if (this.life <= 0) { this.level.particles.emit('fluff', this.cx, this.cy, 8); this.remove(); }
  }
  draw(ctx) {
    if (this.life < 1.2 && Math.floor(this.t * 12) % 2) return;
    const sq = this.t < 0.25 ? 1 + Math.sin((this.t / 0.25) * Math.PI) * 0.15 : 1;
    ctx.save(); ctx.translate(Rn(this.cx), Rn(this.y + 7)); ctx.scale(sq, 2 - sq);
    drawImage(ctx, this.img, -25, -10); ctx.restore();
  }
}
registerEntity('dyn_rescue', RescuePad);

// =============================================================================
// PLATAFORMAS QUE SOBEM (gerador + plataforma)
// =============================================================================
class Lift extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.kind = p.kind || 'balloon';
    this.w = (p.w || 3) * TILE; this.h = 8;
    this.speed = p.speed ?? 40;
    this.topY = p.topY ?? y - 200;
    this.bottomY = p.bottomY ?? y;
    this.oneway = true; this.alwaysUpdate = true; this.z = 8;
    this.state = 'up'; this.timer = 0; this.alpha = 1;
    this.seed = rand(0, TAU);
  }
  carry(dy) {
    const p = this.level.player, map = this.level.map;
    if (!p || p.dead || p.state === 'dead' || p.vy < 0) return;
    const on = p.groundEntity === this || (p.x + p.w > this.x && p.x < this.x + this.w && Math.abs(p.y + p.h - this.y) <= 3);
    if (!on) return;
    const ny = this.y + dy - p.h;
    if (!map.rectSolid(p.x, ny, p.w, p.h)) { p.y = ny; if (p.vy > 0) p.vy = 0; }
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.state === 'up') {
      const dy = -this.speed * dt;
      this.carry(dy);
      this.y += dy;
      if (this.y - this.topY < this.speed * 0.7) { this.state = 'warn'; this.timer = 0.7; }
    } else if (this.state === 'warn') {
      const dy = -this.speed * 0.5 * dt;
      this.carry(dy); this.y += dy;
      this.timer -= dt;
      if (this.timer <= 0) this.pop();
    } else if (this.state === 'gone') {
      this.timer -= dt; this.alpha = Math.max(0, this.timer / 0.3);
      if (this.timer <= 0) this.remove();
    }
  }
  pop() {
    const L = this.level;
    this.state = 'gone'; this.timer = 0.3; this.oneway = false;
    if (this.kind === 'balloon') { audio.sfx('break_block', { pitch: 1.6, vol: 0.5 }); L.particles.emit('confetti', this.cx, this.y - 18, 10); }
    else if (this.kind === 'cog') { audio.sfx('clock_tick', { vol: 0.6 }); L.particles.emit('clock_shard', this.cx, this.cy, 6); }
    else { audio.sfx('glass_crack', { vol: 0.5 }); L.particles.emit('glass_shard', this.cx, this.cy, 8); }
  }
  draw(ctx) {
    const shake = this.state === 'warn' ? Rn(Math.sin(this.t * 60) * 1.2) : 0;
    const x = Rn(this.x) + shake, y = Rn(this.y);
    ctx.globalAlpha = this.alpha;
    if (this.kind === 'balloon') {
      // dois balões presos à tábua
      const cols = [['#ff5a6a', '#ffb0b8'], ['#ffd23f', '#fff3a8']];
      for (let i = 0; i < 2; i++) {
        const bx = x + 10 + i * (this.w - 20), by = y - 26 + Math.sin(this.t * 2 + this.seed + i) * 2;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by + 8, 1, 18 - (by + 8 - (y - 26)) + 0);
        ctx.fillStyle = '#3a1e0a'; ctx.fillRect(bx - 5, by - 7, 11, 15); ctx.fillRect(bx - 6, by - 5, 13, 11);
        ctx.fillStyle = cols[i][0]; ctx.fillRect(bx - 4, by - 6, 9, 13); ctx.fillRect(bx - 5, by - 4, 11, 9);
        ctx.fillStyle = cols[i][1]; ctx.fillRect(bx - 3, by - 4, 2, 3);
        ctx.fillStyle = cols[i][0]; ctx.fillRect(bx - 1, by + 7, 3, 2);
        if (this.state === 'warn' && Math.floor(this.t * 10) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 4, by - 6, 9, 2); }
      }
      ctx.drawImage(plankFor(this.w, 'dyn_plank'), x, y);
    } else if (this.kind === 'cog') {
      ctx.fillStyle = '#3a3038';
      for (let yy = y + 10; yy < Math.min(this.bottomY + 16, y + 260); yy += 5) { ctx.fillRect(x + 6, yy, 2, 3); ctx.fillRect(x + this.w - 8, yy, 2, 3); }
      ctx.drawImage(plankFor(this.w, 'dyn_cogstep'), x, y - 1);
    } else {
      drawGlow(ctx, x + this.w / 2, y + 4, this.w * 0.7, '#ff4f8a', 0.25);
      ctx.drawImage(plankFor(this.w, 'dyn_shard'), x, y - 1);
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 6 + ((Math.floor(this.t * 20) + i * 13) % (this.w - 12)), y + 9 + i, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
registerEntity('dyn_lift', Lift);
const _plankCache = new Map();
/** Corta/repete a imagem base (48 px) na largura pedida (cacheado). */
function plankFor(w, name) {
  const k = name + w;
  let c = _plankCache.get(k);
  if (c) return c;
  const src = getImage(name);
  c = document.createElement('canvas'); c.width = w; c.height = src.height;
  const g = c.getContext('2d');
  const sw = src.width;
  g.drawImage(src, 0, 0, 4, src.height, 0, 0, 4, src.height);
  for (let x = 4; x < w - 4; x += sw - 8) { const ww = Math.min(sw - 8, w - 4 - x); g.drawImage(src, 4, 0, ww, src.height, x, 0, ww, src.height); }
  g.drawImage(src, sw - 4, 0, 4, src.height, w - 4, 0, 4, src.height);
  _plankCache.set(k, c);
  return c;
}

class LiftSpawner extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 1; this.h = 1; this.alwaysUpdate = true;
    this.kind = p.kind || 'balloon';
    this.tw = p.w || 3;
    this.speed = p.speed ?? 40;
    this.period = p.period ?? 3;
    this.bottomY = y;
    this.topY = (p.top ?? Math.floor(y / TILE) - 12) * TILE;
    this.timer = this.period;
  }
  init() {
    const gap = this.speed * this.period;
    for (let d = gap * 0.5; this.bottomY - d > this.topY + this.speed * 0.8; d += gap) this.spawnAt(this.bottomY - d);
  }
  spawnAt(y) {
    const L = this.level;
    const e = new Lift(L, this.x, y, { kind: this.kind, w: this.tw, speed: this.speed, topY: this.topY, bottomY: this.bottomY });
    L.add(e);
  }
  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer += this.period; this.spawnAt(this.bottomY); }
  }
}
registerEntity('dyn_lifts', LiftSpawner);

// =============================================================================
// VEÍCULOS (base): congela o Tico e o carrega no assento
// =============================================================================
class VehicleFront extends Entity {
  constructor(l, owner) { super(l, owner.x, owner.y, {}); this.owner = owner; this.w = 1; this.h = 1; this.z = 52; this.alwaysUpdate = true; this.alwaysDraw = true; }
  update() { if (this.owner.dead) this.remove(); }
  draw(ctx) { this.owner.drawFront?.(ctx); }
}

class Vehicle extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.z = 48; this.alwaysUpdate = true; this.alwaysDraw = true;
    this.mounted = false; this.leaving = false; this.auto = p.autoMount ?? true;
    this.ghostT = 0; this.fireCd = 0; this.animT = 0;
    this.seatOX = 0; this.seatOY = 0;
    this.riderAnim = 'idle';
  }
  seat() { return { x: this.cx + this.seatOX, y: this.y + this.seatOY }; }
  init() {
    const L = this.level;
    L.add(new VehicleFront(L, this));
    if (!this.auto && L.scroller && L.scroller.mode === 'up') L.scroller.gateY = this.y - L.camera.viewH * 0.6;
    if (this.auto) { const p = this.player; this.x = p.cx - this.seatOX - this.w / 2; this.y = p.bottom - this.seatOY; this.mount(true); }
  }
  mount(silent) {
    const L = this.level, p = L.player;
    this.mounted = true;
    if (L.scroller) { L.scroller.vehicle = this; L.scroller.gateY = null; }
    p.state = 'frozen'; p.cutsceneAnim = this.riderAnim; p.vx = 0; p.vy = 0;
    p.oxygen = 1;
    if (!silent) { audio.sfx('spring', { pitch: 1.2 }); L.particles.emit('sparkle', this.cx, this.cy, 12); }
  }
  dismount(hopX = 0, to = null) {
    const L = this.level, p = L.player;
    if (!this.mounted) return;
    this.mounted = false; this.leaving = true; this.leaveT = 0;
    if (L.scroller?.vehicle === this) L.scroller.vehicle = null;
    if (p.state !== 'dead' && to) {
      // salto guiado até terra firme (não cai na água)
      p.cutsceneAnim = 'jump';
      const sx = p.x, sy = p.y, tx = to.x - p.w / 2, ty = to.y - p.h;
      audio.sfx('jump');
      L.tasks.run(function* () {
        for (let k = 0; k < 1; k += 1 / 40) {
          if (p.state === 'dead') return;
          p.state = 'frozen'; p.cutsceneAnim = k < 0.5 ? 'jump' : 'fall';
          p.x = sx + (tx - sx) * k; p.y = sy + (ty - sy) * k - Math.sin(k * Math.PI) * 56; p.vx = 0; p.vy = 0;
          yield 0;
        }
        p.x = tx; p.y = ty; p.vx = 0; p.vy = 0;
        p.state = 'normal'; p.cutsceneAnim = null;
        L.particles.emit('dust', p.cx, p.bottom, 6);
      });
      return;
    }
    if (p.state !== 'dead') {
      p.state = 'normal'; p.cutsceneAnim = null;
      p.vy = -360; p.vx = hopX; p.jumping = true; p.grounded = false;
      p.invuln = Math.max(p.invuln || 0, 0.6);
      audio.sfx('jump');
    }
  }
  /** Retângulo que leva dano junto com o Tico (menor que o veículo: justo). */
  coreRect() { return { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 10 }; }
  update(dt) {
    this.tickTimers(dt); this.animT += dt;
    const L = this.level, p = L.player;
    if (!this.mounted) {
      if (this.leaving) { this.leaveT += dt; this.leave(dt); if (this.leaveT > 3) this.remove(); return; }
      this.idle(dt);
      if (p && p.state === 'normal' && rectsOverlap(this, p)) this.mount(false);
      return;
    }
    if (p.state === 'dead') { this.vx *= 0.96; this.vy = Math.min(200, this.vy + 300 * dt); this.x += this.vx * dt; this.y += this.vy * dt; return; }
    const play = L.state === 'play';
    if (play && p.state !== 'frozen') p.state = 'frozen';
    if (p.hurtInv > 0) p.hurtInv -= dt;     // no estado 'frozen' o player não desconta o piscar
    p.oxygen = 1;
    const inp = play && !L.inputLocked ? input : null;
    const ax = inp ? inp.axisX() : 0, ay = inp ? inp.axisY() : 0;
    this.control(dt, ax, ay, inp);
    this.keepInView(dt);
    p.cutsceneAnim = this.currentRiderAnim();
    if (play) this.checkDamage();
  }
  currentRiderAnim() { return this.riderAnim; }
  idle(dt) { this.y += Math.sin(this.t * 3) * 0.2; }
  leave(dt) { this.x += 120 * dt; this.y -= 30 * dt; }
  lateUpdate() {
    if (!this.mounted) return;
    const p = this.level.player;
    if (!p || p.state === 'dead') return;
    const s = this.seat();
    p.x = s.x - p.w / 2; p.y = s.y - p.h;
    p.vx = 0; p.vy = 0; p.grounded = true; p.groundEntity = null;
    p.facing = this.facingRider ?? 1;
  }
  move(dt) {
    const L = this.level, cam = L.camera;
    if (this.ghostT > 0) {
      this.ghostT -= dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.ghostT <= 0 && L.map.rectSolid(this.x, this.y, this.w, this.h)) {
        this.ghostT = 0.05;
        const dx = cam.x + cam.viewW * 0.45 - this.cx, dy = cam.y + cam.viewH * 0.45 - this.cy, d = Math.hypot(dx, dy) || 1;
        this.x += (dx / d) * 120 * dt; this.y += (dy / d) * 120 * dt;
      }
      return;
    }
    moveBody(this, this.vx * dt, this.vy * dt, L);
  }
  keepInView() {
    const L = this.level, cam = L.camera, m = 2;
    const minX = cam.x + m, maxX = cam.x + cam.viewW - this.w - m, minY = cam.y + m, maxY = cam.y + cam.viewH - this.h - m;
    let squeezed = false;
    const solidAt = (x, y) => this.ghostT <= 0 && L.map.rectSolid(x, y, this.w, this.h);
    if (this.x < minX) { if (solidAt(minX, this.y)) squeezed = true; this.x = minX; if (this.vx < 0) this.vx = 0; }
    if (this.x > maxX) { this.x = maxX; if (this.vx > 0) this.vx = 0; }
    if (this.y < minY) { if (solidAt(this.x, minY)) squeezed = true; this.y = minY; if (this.vy < 0) this.vy = 0; }
    if (this.y > maxY) { if (solidAt(this.x, maxY)) squeezed = true; this.y = maxY; if (this.vy > 0) this.vy = 0; }
    if (squeezed) this.squeeze();
  }
  squeeze() {
    const L = this.level;
    L.player.hurt(1, null, { noKnock: true });
    this.ghostT = 1.0;
    L.particles.emit('fluff', this.cx, this.cy, 8);
  }
  checkDamage() {
    const L = this.level, p = L.player, core = this.coreRect();
    for (const e of L.entities) {
      if (e.dead || e === this || e === p || !(e.enemy || e.hazard)) continue;
      if (!rectsOverlap(core, e)) continue;
      const dmg = e.contactDamage ?? 1;
      if (dmg > 0) p.hurt(dmg, e);
      e.onTouchPlayer?.(p);
    }
    if (L.map.rectHas(core.x + 2, core.y + 2, core.w - 4, core.h - 4, T.SPIKE)) p.hurt(1, null, { noKnock: true });
  }
  blinkHidden() { const p = this.level.player; return p.hurtInv > 0 && this.mounted && Math.floor(this.t * 18) % 2 === 0; }
  fire(kind, x, y, vx, vy) {
    this.level.add(new Shot(this.level, x, y, { kind, vx, vy }));
  }
}

// ---- tiros do Tico (bolha / bolinha de papel / agulha dourada)
class Shot extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.kind = p.kind || 'paper';
    const sz = this.kind === 'bubble' ? 10 : this.kind === 'needle' ? 6 : 8;
    this.w = this.kind === 'needle' ? 4 : sz; this.h = this.kind === 'needle' ? 12 : sz;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = p.vx || 0; this.vy = p.vy || 0;
    this.dmg = p.dmg ?? 1; this.life = p.life ?? 1.4;
    this.z = 45; this.alwaysUpdate = true;
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.kind === 'bubble') this.y += Math.sin(this.t * 14) * 0.4;
    const L = this.level;
    if (this.life <= 0 || L.map.rectSolid(this.x + 2, this.y + 2, this.w - 4, this.h - 4)) { this.pop(); return; }
    for (const e of L.entities) {
      if (e.dead || !e.hittable || e.isPlayer || e === this) continue;
      if (!rectsOverlap(this, e)) continue;
      const res = e.onHit ? e.onHit(this.dmg, this, { kind: 'shot' }) : e.hurt(this.dmg, this, { knockback: 40 });
      L.particles.emit('hit', this.cx, this.cy, 4, { colors: ['#ffffff', '#ffd23f'] });
      if (res !== false) audio.sfx('hit', { vol: 0.35, randomPitch: 0.15, cooldown: 0.04 });
      this.pop();
      return;
    }
  }
  pop() {
    const L = this.level;
    if (this.kind === 'bubble') L.particles.emit('bubble', this.cx, this.cy, 3);
    else L.particles.emit('sparkle', this.cx, this.cy, 2);
    this.remove();
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.kind === 'bubble') {
      ctx.fillStyle = '#e8ffff'; ctx.fillRect(x + 2, y, 6, 10); ctx.fillRect(x, y + 2, 10, 6); ctx.fillRect(x + 1, y + 1, 8, 8);
      ctx.fillStyle = '#7fd6ff'; ctx.fillRect(x + 2, y + 1, 6, 8); ctx.fillRect(x + 1, y + 2, 8, 6);
      ctx.fillStyle = '#c8f6ff'; ctx.fillRect(x + 3, y + 3, 4, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 2, 2, 2);
    } else if (this.kind === 'needle') {
      drawGlow(ctx, x + 2, y + 6, 8, '#ffd23f', 0.35);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 1, y + 2, 2, 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y, 2, 3);
      ctx.fillStyle = '#ff8a3c'; ctx.fillRect(x, y + 10, 4, 2);
    } else {
      ctx.fillStyle = '#2a3456'; ctx.fillRect(x + 1, y, 6, 8); ctx.fillRect(x, y + 1, 8, 6);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = '#b4c8f0'; ctx.fillRect(x + 2, y + 3, 4, 1); ctx.fillRect(x + 4, y + 5, 2, 1);
      ctx.fillStyle = '#8ff0ff'; ctx.globalAlpha = 0.5; ctx.fillRect(x - 6, y + 3, 6, 2); ctx.globalAlpha = 1;
    }
  }
}
registerEntity('dyn_shot', Shot);

// =============================================================================
// TARTARUGA (montaria aquática, W2)
// =============================================================================
class Turtle extends Vehicle {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 38; this.h = 20;
    this.seatOX = -4; this.seatOY = 1;
    this.riderAnim = 'idle';
    this.wasWet = true; this.leapT = 0; this.facingRider = 1;
  }
  coreRect() { return { x: this.x + 6, y: this.y + 6, w: this.w - 14, h: this.h - 8 }; }
  control(dt, ax, ay, inp) {
    const L = this.level, map = L.map;
    const S = L.scroller?.speed || 0;
    const wet = map.rectHas(this.x + 6, this.y + 8, this.w - 12, this.h - 10, T.WATER);
    const surf = wet && !map.rectHas(this.x + 6, this.y - 4, this.w - 12, 4, T.WATER);
    if (wet !== this.wasWet) {
      this.wasWet = wet;
      L.particles.emit('splash', this.cx, this.y + (wet ? this.h - 4 : this.h), 12);
      audio.sfx(wet ? 'splash_in' : 'splash_out', { vol: 0.6 });
      if (wet) this.vy *= 0.45;
    }
    if (this.leapT > 0) this.leapT -= dt;
    this.vx = approach(this.vx, S + ax * 110, 560 * dt);
    if (wet) {
      this.vy = approach(this.vy, ay * 100, (ay ? 460 : 300) * dt);
      if (inp && inp.pressed('jump')) {
        if (surf) { this.vy = -400; this.leapT = 0.5; audio.sfx('jump', { pitch: 0.9 }); L.particles.emit('splash', this.cx, this.y + 4, 10); }
        else { this.vy = Math.min(this.vy, -170); L.particles.emit('bubble', this.cx - 10, this.cy, 4); audio.sfx('swim', { randomPitch: 0.1 }); }
      }
      if (Math.random() < dt * 4) L.particles.emit('bubble', this.x + 4, this.cy, 1);
    } else {
      this.vy = Math.min(380, this.vy + (ay > 0 ? 1350 : 920) * dt);
    }
    this.fireCd -= dt;
    if (inp && inp.down('attack') && this.fireCd <= 0) {
      this.fireCd = 0.3;
      this.fire('bubble', this.x + this.w + 2, this.y + 9, 250 + S, 0);
      audio.sfx('bubble', { vol: 0.6, randomPitch: 0.15 });
      this.mouthT = 0.15;
    }
    if (this.mouthT > 0) this.mouthT -= dt;
    this.move(dt);
  }
  currentRiderAnim() { return this.wasWet && this.leapT <= 0 ? 'idle' : this.vy < 0 ? 'jump' : 'fall'; }
  leave(dt) { this.x += 140 * dt; this.y += 20 * dt; }
  draw(ctx) {
    if (this.blinkHidden()) return;
    const air = !this.wasWet;
    const anim = air ? 'leap' : 'swim';
    const tilt = air ? clamp(this.vy / 900, -0.35, 0.35) : 0;
    const opts = { rotation: tilt, alpha: this.ghostT > 0 ? 0.55 : 1 };
    if (this.flash > 0) opts.variant = 'flash';
    drawSprite(ctx, 'dyn_turtle', anim, animFrame('dyn_turtle', anim, this.animT * (1 + Math.abs(this.vx) / 200)), Rn(this.cx + 2), Rn(this.bottom + 4), opts);
  }
}
registerEntity('dyn_turtle', Turtle);

// =============================================================================
// NAVE: avião de papel (W4) / tapete de retalhos (W5)
// =============================================================================
class Flyer extends Vehicle {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.skin = p.skin || 'plane';
    this.dir = p.dir || 'right';
    if (this.skin === 'plane') { this.w = 40; this.h = 14; this.seatOX = -6; this.seatOY = 8; }
    else { this.w = 38; this.h = 10; this.seatOX = 0; this.seatOY = 0; }
    this.riderAnim = this.dir === 'up' ? 'look_up' : 'idle';
    this.dodgeT = 0; this.dodgeCd = 0; this.trail = [];
    this.facingRider = 1;
    this.baseY = y;
  }
  coreRect() {
    const p = this.level.player;
    return { x: p.x + 1, y: p.y + 4, w: p.w - 2, h: p.h - 4 };       // o casco é só o Tico (justo, como no Cuphead)
  }
  idle(dt) { this.y = this.baseY + Math.sin(this.t * 2.5) * 3; if (Math.random() < dt * 6) this.level.particles.emit('sparkle', this.cx, this.cy, 1); }
  control(dt, ax, ay, inp) {
    const L = this.level;
    const S = L.scroller?.speed || 0;
    const bx = this.dir === 'right' ? S : 0, by = this.dir === 'up' ? -S : 0;
    const sp = this.dodgeT > 0 ? 1.0 : 1;
    this.vx = approach(this.vx, bx + ax * 150 * sp, 1100 * dt);
    this.vy = approach(this.vy, by + ay * 140 * sp, 1100 * dt);
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.dodgeT > 0) { this.dodgeT -= dt; this.trail.push({ x: this.cx, y: this.cy, life: 0.25 }); }
    if (inp && (inp.pressed('jump') || inp.pressed('dash')) && this.dodgeCd <= 0) {
      this.dodgeT = 0.3; this.dodgeCd = 0.75;
      const dx = ax || (this.dir === 'right' && !ay ? 1 : 0), dy = ay || (this.dir === 'up' && !ax ? -1 : 0);
      const d = Math.hypot(dx, dy) || 1;
      this.vx += (dx / d) * 230; this.vy += (dy / d) * 230;
      const p = L.player; p.invuln = Math.max(p.invuln || 0, 0.4);
      audio.sfx('dash', { pitch: 1.1 });
      L.particles.emit('thread', this.cx, this.cy, 8);
    }
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter((t) => t.life > 0);
    this.fireCd -= dt;
    if (inp && inp.down('attack') && this.fireCd <= 0) {
      this.fireCd = 0.14;
      const p = L.player;
      if (this.dir === 'right') this.fire(this.skin === 'plane' ? 'paper' : 'needle', this.x + this.w + 2, p.cy - 1 + (this.alt ? 2 : -2), 400 + S, 0);
      else this.fire('needle', p.cx + (this.alt ? 4 : -4), p.y - 2, 0, -420 - S);
      this.alt = !this.alt;
      audio.sfx('needle', { vol: 0.25, randomPitch: 0.2, cooldown: 0.05 });
    }
    if (Math.random() < dt * 10) L.particles.emit('sparkle', this.x + 2, this.cy + 2, 1, { colors: this.skin === 'plane' ? ['#ffffff', '#b4c8f0'] : ['#ffd23f', '#ff8ab0'] });
    this.move(dt);
  }
  leave(dt) { this.y -= 160 * dt; this.x += 40 * dt; }
  draw(ctx) {
    for (const t of this.trail) {
      ctx.globalAlpha = t.life * 1.6; ctx.fillStyle = this.skin === 'plane' ? '#8ff0ff' : '#ff8ab0';
      ctx.fillRect(Rn(t.x) - 8, Rn(t.y), 16, 2); ctx.globalAlpha = 1;
    }
    if (this.blinkHidden()) return;
    const tilt = this.mounted ? clamp(this.vy / 900, -0.25, 0.25) * (this.dir === 'right' ? 1 : 0) : 0;
    const opts = { rotation: tilt, alpha: this.ghostT > 0 ? 0.55 : 1 };
    if (this.skin === 'plane') drawSprite(ctx, 'dyn_plane', 'back', animFrame('dyn_plane', 'back', this.animT), Rn(this.cx), Rn(this.y + 10), opts);
    else drawSprite(ctx, 'dyn_carpet', 'fly', animFrame('dyn_carpet', 'fly', this.animT), Rn(this.cx), Rn(this.y + 4), opts);
    if (!this.mounted && !this.leaving) {
      // chamariz: "Suba!"
      const by = Rn(this.y - 18 + Math.sin(this.t * 4) * 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(Rn(this.cx) - 1, by, 3, 6); ctx.fillRect(Rn(this.cx) - 3, by + 4, 7, 1); ctx.fillRect(Rn(this.cx) - 2, by + 5, 5, 1); ctx.fillRect(Rn(this.cx) - 1, by + 6, 3, 1);
      drawGlow(ctx, this.cx, this.cy, 26, '#ffd23f', 0.25 + Math.sin(this.t * 4) * 0.08);
    }
  }
  drawFront(ctx) {
    if (this.skin !== 'plane' || this.blinkHidden()) return;
    const tilt = this.mounted ? clamp(this.vy / 900, -0.25, 0.25) : 0;
    drawSprite(ctx, 'dyn_plane', 'front', animFrame('dyn_plane', 'front', this.animT), Rn(this.cx), Rn(this.y + 10), { rotation: tilt, alpha: this.ghostT > 0 ? 0.55 : 1 });
  }
}
registerEntity('dyn_flyer', Flyer);

// =============================================================================
// ZONA DE DESEMBARQUE e CHECKPOINT EM LINHA
// =============================================================================
registerEntity('dyn_dismount', class extends Entity {
  constructor(l, x, y, p = {}) { super(l, x, y, p); this.w = (p.w || 4) * TILE; this.h = (p.h || 6) * TILE; this.alwaysUpdate = true; }
  update() {
    const v = this.level.scroller?.vehicle;
    if (v && v.mounted && rectsOverlap(v, this)) v.dismount(this.props.hopX ?? 0, this.props.toX != null ? { x: this.props.toX * TILE + 8, y: this.props.toY * TILE } : null);
  }
});

registerEntity('dyn_checkpoint', class extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.axis = p.axis || 'x';
    if (this.axis === 'x') { this.w = 12; this.h = (p.h || 14) * TILE; this.x = x + 2; }
    else { this.w = (p.w || 24) * TILE; this.h = 8; }
    this.active = l.run.checkpoint?.id === p.pid;
    this.z = 6; this.activeRange = 500;
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level, p = L.player;
    if (this.active || !p || p.state === 'dead' || L.state !== 'play') return;
    const crossed = this.axis === 'x' ? p.cx >= this.x + 6 : p.cy <= this.y + 4;
    if (!crossed) return;
    this.active = true;
    for (const c of L.ofType('dyn_checkpoint')) if (c !== this) c.active = false;
    L.setCheckpoint(p.x, p.y, this.props.pid);
    audio.sfx('checkpoint');
    L.toast('Progresso costurado!');
    L.particles.emit('thread', p.cx, p.cy, 14, { colors: ['#ffb3d0', '#ff6fa8', '#ffffff'] });
    spawnShockwave(L, p.cx, p.cy, { radius: 30, color: '#ff8fc0', particles: false });
  }
  draw(ctx) {
    const col = this.active ? '#ff8fc0' : '#c8b8e8';
    if (this.axis === 'x') {
      const x = Rn(this.cx);
      for (let y = Rn(this.y); y < this.y + this.h; y += 6) {
        const wob = Math.round(Math.sin(y * 0.1 + this.t * 2) * 1.5);
        ctx.globalAlpha = this.active ? 0.8 : 0.45; ctx.fillStyle = col; ctx.fillRect(x + wob, y, 1, 4); ctx.globalAlpha = 1;
        if ((y / 6) % 5 === 0) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + wob - 2, y + 1, 5, 2); }
      }
      drawGlow(ctx, x, this.y + this.h / 2, 18, col, this.active ? 0.25 : 0.1);
    } else {
      const y = Rn(this.y);
      for (let x = Rn(this.x); x < this.x + this.w; x += 6) { ctx.globalAlpha = this.active ? 0.8 : 0.45; ctx.fillStyle = col; ctx.fillRect(x, y + Math.round(Math.sin(x * 0.1 + this.t * 2) * 1.5), 4, 1); ctx.globalAlpha = 1; }
    }
  }
});

// =============================================================================
// INIMIGOS DAS FASES DINÂMICAS
// =============================================================================
/** Base: acorda quando entra na tela; some quando fica muito para trás. */
class DynFoe extends Enemy {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.flying = true; this.stompable = false;
    this.awake = false; this.wakeT = 0;
    this.drops = { buttons: 1, heart: 0.04, energy: 0 };
    this.activeRange = 420;
    this.ph = rand(0, TAU);
    this.wk = worldOf(l) === 5 ? 5 : 4;
  }
  get scrollMode() { return this.level.scroller?.mode || 'right'; }
  onScreen(m = 6) {
    const c = this.level.camera;
    return this.x < c.x + c.viewW + m && this.x + this.w > c.x - m && this.y < c.y + c.viewH + m && this.y + this.h > c.y - m;
  }
  update(dt) {
    if (!this.awake) {
      this.tickTimers(dt);
      if (!this.onScreen()) return;
      this.awake = true; this.bx = this.x; this.by = this.y;
      this.onWake?.();
    }
    this.wakeT += dt;
    super.update(dt);
    const c = this.level.camera;
    if (this.scrollMode === 'right' ? this.x + this.w < c.x - 90 : this.y > c.y + c.viewH + 90) this.remove();
  }
}

// ---- W2: peixe de corda (nada para a esquerda ondulando)
registerEntity('dyn_fish', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y + 2, p); this.w = 16; this.h = 10; this.hp = this.maxHp = 1; this.fabricColors = ['#ff8a3c', '#ffc070']; }
  think(dt) {
    this.bx -= (this.props.speed ?? 50) * dt;
    this.x = this.bx; this.y = this.by + Math.sin(this.wakeT * 3 + this.ph) * (this.props.amp ?? 10);
  }
  draw(ctx) { drawSprite(ctx, 'dyn_fish', 'swim', animFrame('dyn_fish', 'swim', this.t), Rn(this.cx), Rn(this.cy), this.spriteOpts()); this.drawStatus(ctx); }
});
// ---- W2: ouriço de borracha (mina que balança; 2 bolhas para estourar)
registerEntity('dyn_urchin', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 14; this.h = 14; this.x = x + 1; this.y = y + 1; this.hp = this.maxHp = 2; this.drops = { buttons: 2, heart: 0.1, energy: 0 }; this.fabricColors = ['#7a3aa0', '#a868d0']; }
  think(dt) {
    const amp = (this.props.dy ?? 0) * TILE;
    this.y = this.by + (amp ? Math.sin(this.wakeT * (this.props.speed ?? 1.4) + this.ph) * amp : Math.sin(this.wakeT * 2 + this.ph) * 2);
    this.x = this.bx;
  }
  draw(ctx) {
    const blink = Math.floor(this.t * 3) % 2;
    drawGlow(ctx, this.cx, this.cy, 14, '#ff3a4a', blink ? 0.25 : 0.08);
    drawSprite(ctx, 'dyn_urchin', 'idle', blink, Rn(this.cx), Rn(this.cy), this.spriteOpts()); this.drawStatus(ctx);
  }
});
// ---- W2: gaivota de papel (no ar, sobre a água)
registerEntity('dyn_gull', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 18; this.h = 10; this.hp = this.maxHp = 1; this.fabricColors = ['#ffffff', '#d8dcea']; }
  think(dt) {
    this.bx -= (this.props.speed ?? 70) * dt;
    this.x = this.bx; this.y = this.by + Math.sin(this.wakeT * 4 + this.ph) * 6;
  }
  draw(ctx) { drawSprite(ctx, 'dyn_gull', 'fly', animFrame('dyn_gull', 'fly', this.t), Rn(this.cx), Rn(this.cy), this.spriteOpts()); this.drawStatus(ctx); }
});
// ---- W4/W5: morceguinho de sombra / mariposa-agulha (onda senoidal)
registerEntity('dyn_bat', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 14; this.h = 10; this.x = x + 1; this.y = y + 3; this.hp = this.maxHp = p.hp ?? 1; this.fabricColors = [SKIN[this.wk].body, SKIN[this.wk].hi]; }
  think(dt) {
    const sp = this.props.speed ?? 55, amp = this.props.amp ?? 16;
    if (this.scrollMode === 'right') { this.bx -= sp * dt; this.x = this.bx; this.y = this.by + Math.sin(this.wakeT * 3 + this.ph) * amp; }
    else { this.by += sp * 0.7 * dt; this.y = this.by; this.x = this.bx + Math.sin(this.wakeT * 3 + this.ph) * amp; }
  }
  draw(ctx) { drawSprite(ctx, 'dyn_bat_' + this.wk, 'fly', animFrame('dyn_bat_' + this.wk, 'fly', this.t), Rn(this.cx), Rn(this.cy), this.spriteOpts()); this.drawStatus(ctx); }
});
// ---- W4/W5: olho flutuante que acompanha a tela e atira (aviso de 0.7 s)
registerEntity('dyn_eye', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 16; this.h = 16; this.hp = this.maxHp = 3; this.shootT = 1.2 + rand(0, 0.8); this.chargeT = 0; this.drops = { buttons: 2, heart: 0.08, energy: 0 }; this.fabricColors = ['#f0e8f8', '#e06080']; }
  think(dt) {
    const S = this.level.scroller?.speed || 0;
    const hold = this.wakeT < (this.props.hold ?? 5);
    if (this.scrollMode === 'right') { this.bx += (hold ? S * 0.82 : -20) * dt; this.x = this.bx; this.y = this.by + Math.sin(this.wakeT * 1.6 + this.ph) * 10; }
    else { this.by -= (hold ? S * 0.82 : -20) * dt; this.y = this.by; this.x = this.bx + Math.sin(this.wakeT * 1.6 + this.ph) * 12; }
    if (this.chargeT > 0) {
      this.chargeT -= dt;
      if (this.chargeT <= 0) {
        const p = this.level.player, dx = p.cx - this.cx, dy = p.cy - this.cy, d = Math.hypot(dx, dy) || 1;
        this.level.add(new EnemyProjectile(this.level, this.cx, this.cy, { vx: (dx / d) * 105, vy: (dy / d) * 105, color: SKIN[this.wk].glow, w: 8, h: 8, life: 5, solidStop: true }));
        audio.sfx('shadow_whisper', { vol: 0.4, cooldown: 0.2 });
      }
    } else if ((this.shootT -= dt) <= 0) { this.shootT = 2.4; this.chargeT = 0.7; }
  }
  draw(ctx) {
    const charging = this.chargeT > 0;
    if (charging) drawGlow(ctx, this.cx, this.cy, 16, SKIN[this.wk].glow, 0.3 + Math.sin(this.t * 30) * 0.15);
    drawSprite(ctx, 'dyn_eye_' + this.wk, charging ? 'charge' : 'idle', animFrame('dyn_eye_' + this.wk, charging ? 'charge' : 'idle', this.t), Rn(this.cx), Rn(this.cy), this.spriteOpts());
    this.drawStatus(ctx);
  }
});
// ---- W4: tesoura voadora / W5: agulha — aviso "!" na borda e investida reta
registerEntity('dyn_scissors', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = this.wk === 5 ? 8 : 22; this.h = this.wk === 5 ? 22 : 10; this.hp = this.maxHp = 2; this.phase = 'wait'; this.fabricColors = ['#c8d0e0', '#ff4f6a']; }
  onWake() { this.phase = 'warn'; this.warnT = 0.9; audio.sfx('ui_denied', { pitch: 1.6, vol: 0.4 }); }
  think(dt) {
    const c = this.level.camera, up = this.scrollMode === 'up';
    if (this.phase === 'warn') {
      if (up) this.y = c.y - this.h + 4; else this.x = c.x + c.viewW - 4;
      this.hittable = false;
      if ((this.warnT -= dt) <= 0) { this.phase = 'go'; this.hittable = true; audio.sfx('whip_big', { pitch: 1.4, vol: 0.6 }); }
    } else if (this.phase === 'go') {
      const sp = this.props.speed ?? 290;
      if (up) this.y += sp * 0.8 * dt; else this.x -= sp * dt;
    }
  }
  draw(ctx) {
    const c = this.level.camera;
    if (this.phase === 'warn') {
      const up = this.scrollMode === 'up';
      const wx = up ? Rn(this.cx) : Rn(c.x + c.viewW - 10), wy = up ? Rn(c.y + 8) : Rn(this.cy - 4);
      if (Math.floor(this.t * 10) % 2) { ctx.fillStyle = '#ff4f6a'; ctx.fillRect(wx - 1, wy, 3, 6); ctx.fillRect(wx - 1, wy + 8, 3, 2); }
      drawGlow(ctx, wx, wy + 4, 12, '#ff4f6a', 0.3);
      return;
    }
    if (this.wk === 5) drawSprite(ctx, 'dyn_needle', 'idle', animFrame('dyn_needle', 'idle', this.t), Rn(this.cx), Rn(this.cy), { ...this.spriteOpts(), flip: false, rotation: Math.PI });
    else drawSprite(ctx, 'dyn_scissors', 'open', animFrame('dyn_scissors', 'open', this.t), Rn(this.cx), Rn(this.cy), { ...this.spriteOpts(), flip: false });
    this.drawStatus(ctx);
  }
});
// ---- W4: coelhinho de poeira espinhento (obstáculo invencível que sobe e desce)
registerEntity('dyn_dustbunny', class extends DynFoe {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 16; this.h = 16; this.hp = this.maxHp = 999; this.bindable = false; }
  onHit() { this.flash = 0.05; audio.sfx('armor_clink', { vol: 0.3, cooldown: 0.1 }); return false; }
  think(dt) {
    const amp = (this.props.dy ?? 3) * TILE, ampx = (this.props.dx ?? 0) * TILE, sp = this.props.speed ?? 1.6;
    this.y = this.by + Math.sin(this.wakeT * sp + (this.props.phase ?? 0) * TAU) * amp;
    this.x = this.bx + Math.sin(this.wakeT * sp * 0.5) * ampx;
  }
  draw(ctx) { drawSprite(ctx, 'dyn_dustbunny', 'idle', animFrame('dyn_dustbunny', 'idle', this.t), Rn(this.cx), Rn(this.cy), { variant: this.flash > 0 ? 'flash' : undefined }); }
});

// =============================================================================
// MINICHEFE DO VOO: O BICHO-PAPÃO DE MEIA
// =============================================================================
class SockBoss extends Enemy {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 48; this.h = 44;
    this.flying = true; this.stompable = false; this.bindable = false; this.hittable = false; this.enemy = false;
    this.hp = this.maxHp = p.hp ?? 70;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 30;
    this.engaged = false; this.state = 'sleep'; this.st = 0; this.cycle = 0;
    this.drops = { buttons: 0 };
  }
  get cam() { return this.level.camera; }
  arenaX() { return this.cam.x + this.cam.viewW - 84; }
  arenaY() { return this.cam.y + this.cam.viewH * 0.5 - this.h / 2; }
  engage() {
    const L = this.level;
    this.engaged = true; this.boss = true; this.bossName = 'O Bicho-Papão de Meia';
    L.boss = this;
    this.x = this.cam.x + this.cam.viewW + 40; this.y = this.arenaY();
    this.set('enter');
    audio.playMusic('w4_chase', { fade: 0.6 });
    audio.sfx('boss_roar');
    L.shake(0.3);
    L.toast('O Bicho-Papão de Meia!');
  }
  set(s) { this.state = s; this.st = 0; this.shots = 0; }
  update(dt) {
    this.tickTimers(dt); this.animT += dt;
    const L = this.level;
    if (!this.engaged) {
      if (L.scroller?.done && L.state === 'play') this.engage();
      else return;
    }
    if (this.dyingBoss) { this.updateDeath(dt); return; }
    this.st += dt;
    const p = L.player, hx = this.arenaX(), hy = this.arenaY();
    const rage = this.hp < this.maxHp * 0.5;
    const spd = rage ? 1.25 : 1;
    switch (this.state) {
      case 'enter':
        this.x = damp(this.x, hx, 2.5, dt); this.y = damp(this.y, hy, 3, dt);
        if (this.st > 1.6) { this.hittable = true; this.enemy = true; this.set('idle'); }
        break;
      case 'idle':
        this.x = damp(this.x, hx, 3, dt);
        this.y = damp(this.y, hy + Math.sin(this.t * 1.7) * this.cam.viewH * 0.28, 2.2, dt);
        if (this.st > 1.1 / spd) {
          const seq = rage ? ['spread', 'lunge', 'aimed', 'bats', 'spread', 'lunge'] : ['spread', 'bats', 'lunge', 'spread', 'aimed'];
          this.set(seq[this.cycle++ % seq.length]);
        }
        break;
      case 'spread': {
        this.y = damp(this.y, hy + Math.sin(this.t * 1.7) * this.cam.viewH * 0.2, 2, dt);
        const vol = rage ? 4 : 3;
        if (this.st > 0.5 && this.shots < vol && this.st > 0.5 + this.shots * 0.55 / spd) {
          this.shots++;
          const n = 5, base = Math.PI + (this.shots % 2 ? 0.12 : -0.12);
          for (let i = 0; i < n; i++) {
            const an = base + (i - (n - 1) / 2) * 0.28;
            L.add(new EnemyProjectile(L, this.x + 10, this.y + 34, { vx: Math.cos(an) * 120 * spd, vy: Math.sin(an) * 120 * spd, color: '#ffd23f', w: 8, h: 8, life: 5, solidStop: false }));
          }
          audio.sfx('needle', { pitch: 0.7 });
        }
        if (this.st > 0.6 + vol * 0.55 / spd + 0.4) this.set('idle');
        break;
      }
      case 'aimed': {
        if (this.st > 0.4 && this.shots < 3 && this.st > 0.4 + this.shots * 0.35) {
          this.shots++;
          const dx = p.cx - (this.x + 10), dy = p.cy - (this.y + 34), d = Math.hypot(dx, dy) || 1;
          L.add(new EnemyProjectile(L, this.x + 10, this.y + 34, { vx: (dx / d) * 170, vy: (dy / d) * 170, color: '#ff6fa8', w: 9, h: 9, life: 5, solidStop: false }));
          audio.sfx('shadow_whisper', { vol: 0.6 });
        }
        if (this.st > 1.8) this.set('idle');
        break;
      }
      case 'bats': {
        if (this.st > 0.5 && this.shots < (rage ? 4 : 3) && this.st > 0.5 + this.shots * 0.4) {
          this.shots++;
          const b = L.spawn('dyn_bat', this.x + 4, this.y + 26, { speed: 90, amp: 22 });
          if (b) { b.drops = { buttons: 0, heart: 0.15, energy: 0 }; }
          audio.sfx('boss_roar', { pitch: 1.8, vol: 0.4 });
        }
        if (this.st > 2.2) this.set('idle');
        break;
      }
      case 'lunge': {
        if (!this.lungeY) this.lungeY = clamp(p.cy - this.h / 2, this.cam.y + 8, this.cam.y + this.cam.viewH - this.h - 8);
        if (this.st < 0.9) { this.y = damp(this.y, this.lungeY, 6, dt); this.x = hx + Math.sin(this.st * 60) * 2; if (this.st < 0.05) audio.sfx('boss_roar', { pitch: 1.2, vol: 0.6 }); }
        else if (this.st < 2.2) { this.x -= 360 * spd * dt; if (this.x < this.cam.x - 80) { this.x = this.cam.x + this.cam.viewW + 60; this.st = 2.2; } }
        else { this.x = damp(this.x, hx, 3, dt); this.y = damp(this.y, hy, 3, dt); if (this.st > 3.4) { this.lungeY = null; this.set('idle'); } }
        break;
      }
    }
  }
  onHit(dmg, src) {
    if (!this.engaged || this.dyingBoss || !this.hittable) return false;
    this.hurt(dmg, src, { knockback: 0, invuln: 0.02 });
    return true;
  }
  hurt(n, src, opts = {}) {
    if (this.dyingBoss) return false;
    this.hp -= n; this.flash = 0.08;
    if (this.hp <= 0) this.die(src);
    return true;
  }
  die() {
    if (this.dyingBoss) return;
    const L = this.level;
    this.dyingBoss = true; this.enemy = false; this.hittable = false; this.dt0 = 0;
    for (const e of L.entities) if (e instanceof EnemyProjectile || (e instanceof DynFoe && !e.dead)) { L.particles.emit('smoke', e.cx, e.cy, 3); e.remove(); }
    audio.sfx('boss_hit'); L.shake(0.5); L.hitstop(0.2);
  }
  updateDeath(dt) {
    const L = this.level;
    this.dt0 += dt;
    this.x += Math.sin(this.dt0 * 50) * 1.5; this.y += 12 * dt;
    if (Math.random() < dt * 14) {
      const ex = this.x + rand(0, this.w), ey = this.y + rand(0, this.h);
      L.particles.emit('fabric', ex, ey, 4, { colors: ['#5a3a9a', '#2e2260', '#ffd23f'] });
      L.particles.emit('smoke', ex, ey, 2);
      audio.sfx('explosion', { vol: 0.5, cooldown: 0.12, randomPitch: 0.2 });
    }
    if (this.dt0 > 1.8 && !this.finished) {
      this.finished = true;
      L.particles.emit('fluff', this.cx, this.cy, 30);
      L.particles.emit('stars_burst', this.cx, this.cy, 20);
      spawnShockwave(L, this.cx, this.cy, { radius: 60, color: '#ffd23f' });
      L.boss = null;
      L.flash('#ffffff', 0.25);
      this.remove();
      L.complete({ delay: 1.6 });
    }
  }
  draw(ctx) {
    if (!this.engaged) return;
    const charging = this.state === 'lunge' && this.st < 0.9;
    const open = (this.state === 'spread' || this.state === 'aimed' || this.state === 'bats') && this.st > 0.35;
    if (charging) drawGlow(ctx, this.cx, this.cy, 40, '#ff3a4a', 0.25 + Math.sin(this.t * 30) * 0.1);
    else drawGlow(ctx, this.cx, this.cy, 44, '#6a4ac0', 0.18);
    const anim = open ? 'open' : 'idle';
    const opts = {};
    if (this.flash > 0) opts.variant = 'flash';
    if (this.dyingBoss) opts.alpha = Math.max(0, 1 - this.dt0 / 1.9);
    drawSprite(ctx, 'dyn_sock', anim, animFrame('dyn_sock', anim, this.animT), Rn(this.cx), Rn(this.cy), opts);
    if (charging) { ctx.fillStyle = '#ff3a4a'; ctx.fillRect(Rn(this.x) + 2, Rn(this.y) + 13, 3, 3); }
  }
}
registerEntity('dyn_boss_sock', SockBoss);

// =============================================================================
// DECORAÇÃO EXTRA (desenhada atrás do Tico; use em áreas abertas)
// =============================================================================
registerEntity('dyn_decor', class extends Entity {
  constructor(l, x, y, p = {}) { super(l, x, y, p); this.kind = p.kind || 'lantern'; this.w = 16; this.h = 16; this.z = p.z ?? 2; this.drawMargin = 96; this.seed = (x * 7 + y * 13) % 100; }
  update(dt) { this.tickTimers(dt); }
  draw(ctx) {
    const x = Rn(this.x + 8), y = Rn(this.y), t = this.t + this.seed;
    switch (this.kind) {
      case 'lantern': {           // lanterna de papel pendurada balançando
        const sw = Math.sin(t * 1.4) * 3, len = (this.props.len || 2) * TILE;
        ctx.fillStyle = '#3a2a1a'; for (let i = 0; i < len; i += 2) ctx.fillRect(Rn(x + (sw * i) / len), y + i, 1, 1);
        const lx = Rn(x + sw), ly = y + len;
        drawGlow(ctx, lx, ly + 6, 22, '#ffb040', 0.35);
        ctx.fillStyle = '#5a1a0a'; ctx.fillRect(lx - 5, ly, 10, 12);
        ctx.fillStyle = this.props.color || '#ff6a3a'; ctx.fillRect(lx - 4, ly + 1, 8, 10);
        ctx.fillStyle = '#ffd890'; ctx.fillRect(lx - 2, ly + 3, 4, 6);
        ctx.fillStyle = '#3a1a0a'; ctx.fillRect(lx - 4, ly + 4, 8, 1); ctx.fillRect(lx - 4, ly + 8, 8, 1);
        this.light = { r: 40, color: '#ffb040', i: 0.6, flicker: 0.3 };
        break;
      }
      case 'clockface': {         // mostrador gigante na parede da torre
        const R = (this.props.r || 3) * TILE;
        ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(x, y + 8, R + 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c8902c'; ctx.beginPath(); ctx.arc(x, y + 8, R + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f4e8cc'; ctx.beginPath(); ctx.arc(x, y + 8, R, 0, TAU); ctx.fill();
        ctx.fillStyle = '#5a3a24';
        for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; ctx.fillRect(Rn(x + Math.cos(an) * (R - 5)) - 1, Rn(y + 8 + Math.sin(an) * (R - 5)) - 1, i % 3 ? 2 : 3, i % 3 ? 2 : 3); }
        const hand = (an, len, w, c) => { ctx.fillStyle = c; for (let i = 0; i < len; i++) ctx.fillRect(Rn(x + Math.cos(an) * i) - (w >> 1), Rn(y + 8 + Math.sin(an) * i) - (w >> 1), w, w); };
        hand(t * 0.25 - Math.PI / 2, R * 0.55, 3, '#2a1a10');
        hand(-t * 1.6 - Math.PI / 2, R * 0.8, 2, '#2a1a10');
        hand(t * 4 - Math.PI / 2, R * 0.85, 1, '#c02020');
        ctx.fillStyle = '#c8902c'; ctx.fillRect(x - 2, y + 6, 4, 4);
        break;
      }
      case 'bell': {               // sino do campanário
        const sw = Math.sin(t * 1.2) * 0.15;
        ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
        ctx.fillStyle = '#2a1606'; ctx.fillRect(-15, 2, 30, 26); ctx.fillRect(-11, -2, 22, 6);
        ctx.fillStyle = '#c8902c'; ctx.fillRect(-14, 4, 28, 22); ctx.fillRect(-10, 0, 20, 6);
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(-10, 4, 4, 18);
        ctx.fillStyle = '#7a4a14'; ctx.fillRect(-14, 22, 28, 3);
        ctx.fillStyle = '#3a2008'; ctx.fillRect(-2, 26, 4, 5);
        ctx.restore();
        break;
      }
      case 'spiral': {             // espiral de fio dourado girando (W5)
        const R = (this.props.r || 2) * TILE;
        for (let i = 0; i < 60; i++) {
          const k = i / 60, an = k * TAU * 2.5 + t * 0.8;
          ctx.fillStyle = i % 4 ? '#ffd23f' : '#fff3a8';
          ctx.globalAlpha = 0.35 + k * 0.5;
          ctx.fillRect(Rn(x + Math.cos(an) * R * k), Rn(y + 8 + Math.sin(an) * R * k), 2, 2);
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'toys': {               // brinquedos perdidos pendurados por fios (W1)
        const sw = Math.sin(t * 1.1) * 2;
        ctx.fillStyle = '#d8c8a8'; ctx.fillRect(Rn(x + sw / 2), y, 1, 14);
        const tx = Rn(x + sw), ty = y + 14;
        if (this.seed % 2) {       // cavalinho de madeira
          ctx.fillStyle = '#3a1e0a'; ctx.fillRect(tx - 6, ty, 12, 9);
          ctx.fillStyle = '#ff8a3c'; ctx.fillRect(tx - 5, ty + 1, 10, 5); ctx.fillRect(tx + 2, ty - 3, 4, 5);
          ctx.fillStyle = '#ffd23f'; ctx.fillRect(tx - 5, ty + 6, 2, 2); ctx.fillRect(tx + 3, ty + 6, 2, 2);
        } else {                    // ursinho de pano
          ctx.fillStyle = '#3a1e0a'; ctx.fillRect(tx - 5, ty - 1, 10, 12);
          ctx.fillStyle = '#c8905a'; ctx.fillRect(tx - 4, ty, 8, 10); ctx.fillRect(tx - 5, ty - 1, 3, 3); ctx.fillRect(tx + 2, ty - 1, 3, 3);
          ctx.fillStyle = '#120a18'; ctx.fillRect(tx - 2, ty + 2, 1, 1); ctx.fillRect(tx + 1, ty + 2, 1, 1);
          ctx.fillStyle = '#ff8aa8'; ctx.fillRect(tx - 1, ty + 6, 3, 2);
        }
        break;
      }
      case 'sign_arrow': {         // placa com seta (direção)
        const d = this.props.dir || 'up';
        drawGlow(ctx, x, y + 8, 14, '#ffd23f', 0.15 + Math.sin(t * 3) * 0.08);
        ctx.fillStyle = '#3a1e0a'; ctx.fillRect(x - 7, y + 1, 14, 12); ctx.fillRect(x - 1, y + 12, 2, 4);
        ctx.fillStyle = '#c8905a'; ctx.fillRect(x - 6, y + 2, 12, 10);
        ctx.fillStyle = '#5a2a0a';
        if (d === 'up') { ctx.fillRect(x - 1, y + 4, 2, 7); ctx.fillRect(x - 3, y + 6, 6, 1); ctx.fillRect(x - 2, y + 5, 4, 1); }
        else { ctx.fillRect(x - 4, y + 6, 7, 2); ctx.fillRect(x + 1, y + 4, 1, 6); ctx.fillRect(x + 2, y + 5, 1, 4); }
        break;
      }
      default: break;
    }
  }
});
