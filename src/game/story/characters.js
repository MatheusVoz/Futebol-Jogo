// =============================================================================
// story/characters.js — NPCs no mundo (sprites de pelúcia + entidades).
//
// Sprites (olham para a DIREITA; pivô = pés no centro), combinando com os retratos:
//   npc_botao        idle · talk · monocle (ajusta o monóculo)
//   npc_pip          idle (chave girando) · talk · scared (tremendo) · flee (correndo)
//   npc_agulheta     idle · talk · count (joga moeda) — atrás da barraquinha de tecido
//   npc_capita_bolha idle · talk · bob (boiando; automático se estiver na água)
//   npc_tique_taque  idle (espiando da casinha) · talk · cuckoo (sai na mola)
//   npc_luzinha      idle · talk · fly · dim (quase apagada)
//   npc_tecela       idle · talk · weave (tece um fio entre as mãos)
//   qi_key, qi_marujo (itens de missão) · imagem npc_bang (balão "!")
//
// Entidades:
//   npc (legenda 'n')   props: npc (id sem prefixo), dialog (id ou array de falas),
//                       repeat (id para conversas seguintes; padrão `${dialog}_repeat`),
//                       quest + dialogDone (se save.data.quests[quest]==='done'),
//                       reward (botões dados uma vez após dialogDone), signal (emite ao
//                       terminar de falar), anim (anim base fixa, ex. 'dim'), flip,
//                       fixed (não vira), flee (foge na 1ª aproximação; flag salva
//                       `fled:<pid>` ou props.fleeFlag).
//   shop (legenda 'U')  barraquinha da Agulheta → makeScene('shop', level) (ou fala).
//                       Na 1ª visita do mundo toca `w<N>_agulheta` (ou props.dialog).
//   quest_item          props: quest, item (nome), sprite ('key'|'marujo'|sprite),
//                       need (N itens p/ concluir, conta em quests[`${quest}:n`]), text.
// Fase de teste: ?level=test_npcs
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { defineSprite, defineImage, drawSprite, drawImage, animFrame, animDuration, hasSprite } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { TILE } from '../../engine/util.js';
import { T } from '../../engine/tilemap.js';
import { R as REG, registerEntity, registerLevel, registerQuest, makeScene } from '../registry.js';
import { drawGlow } from '../art/vfx.js';

const R = Math.round;

// ============================================================ helpers de arte
/** Bola de pelúcia sombreada: tons [escuro, médio, claro, brilho]. Luz de cima-esquerda. */
function ball(pc, cx, cy, rx, ry, t) {
  pc.ellipse(cx, cy, rx, ry, t[0]);
  pc.ellipse(cx - rx * 0.14, cy - ry * 0.15, rx * 0.84, ry * 0.8, t[1]);
  pc.ellipse(cx - rx * 0.36, cy - ry * 0.38, rx * 0.42, ry * 0.36, t[2]);
  if (t[3] && rx > 3) pc.px(R(cx - rx * 0.5), R(cy - ry * 0.6), t[3]);
}
/** Pinta só onde está vazio (asas/halos atrás do corpo, sem contorno). */
function under(pc, x, y, c) { if (pc.inside(x, y) && pc.alphaAt(x, y) === 0) pc.px(x, y, c); }
function softEllipse(pc, cx, cy, rx, ry, fill, edge) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1) under(pc, x, y, d > 0.62 ? edge : fill);
    }
}

// Paletas (mesmas dos retratos em art/portraits.js)
const BO = {
  fur: ['#58321e', '#865632', '#ae7846', '#d29c64'], muz: ['#a47650', '#cea476', '#ead0a2', '#fff0d2'],
  inner: '#e2a084', nose: '#2a1810', btn: ['#2e120a', '#5e2618', '#8e4228', '#c47852'], thread: '#f0d8a0',
  scarf: ['#1e4a22', '#2e7434', '#4ca050', '#86d08a'], gold: '#e8b840', goldL: '#fff0a0', out: '#2a160c',
};
const PI = {
  fur: ['#565c74', '#868ea6', '#b6becf', '#e4e8f2'], ear: '#ffb0c8', earD: '#e080a0', nose: '#ff6f98',
  key: ['#7a4e0c', '#b8841e', '#e8c040', '#fff0a0'], eye: '#120a18', out: '#262638', belly: '#f2f4fa',
};
const AG = {
  cush: ['#701430', '#a8283f', '#de4858', '#ff7a84'], face: ['#ae8866', '#d8b88e', '#f8e0c0', '#fff4e4'],
  leaf: ['#1e5a28', '#2e8a3a', '#4ab858'], nose: '#2a1418', eye: '#1a0e14', shaft: '#cfd6e6',
  heads: ['#ffd23f', '#5ab0ff', '#ffffff', '#7ae07a', '#ff9ad8', '#b07aff', '#ffd23f'],
  gold: ['#8a5a10', '#c88a20', '#ffd23f', '#fff4a0'], wood: ['#5a3418', '#8a5a34', '#b07a48', '#d8a06a'], out: '#2a1018',
};
const CB = {
  duck: ['#c07418', '#eaa820', '#ffd84a', '#fff4a6'], beak: ['#a03a10', '#d85c18', '#ff8a2a', '#ffbc70'],
  hat: ['#0c142c', '#18224a', '#2a3a6c', '#4a5c9c'], crown: ['#8a94b4', '#ccd4ea', '#f2f4ff', '#ffffff'],
  gold: '#ffd23f', scarf: ['#7a1420', '#c02a30', '#e84a40', '#ff806a'], eye: '#120a18', out: '#3a2008',
};
const TT = {
  wood: ['#3a1a0c', '#653220', '#8a4a2a', '#b06a3a'], roof: ['#24100a', '#43200f', '#5e301a', '#7e4424'],
  hole: '#1a0a04', bird: ['#9a4412', '#dc7428', '#ffb84f', '#ffe08a'], belly: '#fff4dc',
  beak: '#ffd23f', beakD: '#c08a10', cheek: '#ff5a5a', eye: '#1a0e0a', out: '#1e0e06',
  spring: ['#6a6a80', '#b0b0c8', '#f0f0ff'], brass: '#e8b840', dial: '#f4ecd8',
};
const LU = {
  body: ['#22184a', '#3a2c72', '#5a4aa2', '#8070ca'], glow: ['#e0a828', '#ffd84a', '#fff3a0', '#ffffff'],
  mid: ['#a88a38', '#d0b048', '#e8d688', '#fff4c8'], dim: ['#7a6438', '#a08a4a', '#c8b878', '#e8dcb0'],
  eye: '#0e0a1e', out: '#120c28',
};
const TE = {
  hood: ['#6e4e22', '#a8823c', '#dcbc6c', '#fff0b8'], hoodIn: '#2a1430', face: ['#7e5e8e', '#c4a4c4', '#f0dce8', '#fff8f4'],
  robe: ['#4e224e', '#7e3270', '#ae5290', '#d884bc'], gold: '#ffe8b0', goldD: '#e0b060', out: '#24102a', eye: '#5a3a6a',
};

// ================================================================ SR. BOTÃO
defineSprite('npc_botao', {
  w: 32, h: 36, ox: 16, oy: 35,
  anims: { idle: { frames: 6, fps: 4 }, talk: { frames: 3, fps: 8 }, monocle: { frames: 6, fps: 6, loop: false } },
  draw(pc, anim, f) {
    const C = BO;
    let b = 0, mouth = 0, arm = null, mono = 0, glint = false;
    if (anim === 'idle') { b = [0, 0, 1, 1, 1, 0][f]; glint = f === 4; }
    else if (anim === 'talk') { mouth = [1, 0, 2][f]; b = f === 1 ? 1 : 0; }
    else { arm = [[21, 21], [18, 16], [16, 13], [16, 13], [18, 17], [21, 22]][f]; mono = [0, 0, -1, -1, 0, 0][f]; glint = f === 3; }
    // pernas
    ball(pc, 11, 32, 3.5, 3, C.fur); ball(pc, 20, 32, 3.5, 3, C.fur);
    pc.ellipse(11.5, 33.5, 2, 1.3, C.muz[0]); pc.ellipse(20.5, 33.5, 2, 1.3, C.muz[1]);
    ball(pc, 8, 25 + b, 2.6, 4, C.fur);                                   // braço de trás
    ball(pc, 15, 25 + b, 8, 7.5, C.fur);                                  // corpo
    pc.ellipse(17, 27 + b, 4.5, 4.2, C.muz[1]); pc.ellipse(16, 26 + b, 2.4, 2.2, C.muz[2]);
    for (let y = 24; y <= 30; y += 2) pc.px(17, y + b, C.muz[0]);          // costura da barriga
    if (!arm) ball(pc, 22, 25 + b, 2.6, 4, C.fur);                         // braço da frente
    // orelhas (a direita rasgada, com enchimento saindo)
    ball(pc, 9, 4 + b, 3, 3, C.fur); pc.ellipse(9.4, 4.4 + b, 1.6, 1.6, C.inner);
    ball(pc, 23, 4 + b, 3, 3, C.fur); pc.ellipse(23.4, 4.4 + b, 1.6, 1.6, C.inner);
    pc.px(25, 1 + b, '#fffaf0'); pc.px(26, 2 + b, '#e8e0d8'); pc.px(25, 2 + b, '#fffaf0');
    // cachecol listrado
    pc.rect(8, 17 + b, 16, 3, C.scarf[2]);
    for (let x = 9; x < 24; x += 3) pc.vline(x, 17 + b, 3, C.scarf[1]);
    pc.hline(8, 17 + b, 16, C.scarf[3]);
    pc.rect(9, 20 + b, 3, 5, C.scarf[1]); pc.vline(9, 20 + b, 5, C.scarf[3]); pc.hline(9, 22 + b, 3, C.scarf[0]);
    // cabeça
    ball(pc, 16, 11 + b, 8.5, 7.5, C.fur);
    for (let y = 5; y < 8; y++) for (let x = 9; x < 12; x++) pc.px(x, y + b, (x + y) & 1 ? '#4a7a3a' : '#7aa860'); // remendo
    pc.px(8, 5 + b, C.thread); pc.px(12, 7 + b, C.thread); pc.px(10, 4 + b, C.thread);
    pc.ellipse(19.5, 14 + b, 4.5, 3, C.muz[1]); pc.ellipse(18.5, 13.4 + b, 2.4, 1.5, C.muz[2]);
    pc.ellipse(22, 12.6 + b, 1.7, 1.2, C.nose); pc.px(21, 12 + b, '#7a5a4a');
    pc.vline(21, 14 + b, 1, C.out);
    if (mouth === 1) { pc.rect(19, 15 + b, 4, 2, '#4a1a10'); pc.px(20, 15 + b, '#c86a5a'); }
    else if (mouth === 2) pc.rect(20, 15 + b, 3, 1, '#4a1a10');
    else { pc.px(19, 15 + b, C.out); pc.px(20, 16 + b, C.out); pc.px(22, 16 + b, C.out); pc.px(21, 15 + b, C.out); }
    // olho de botão + monóculo dourado com corrente
    pc.circle(13, 10 + b, 2.3, C.btn[1]); pc.px(12, 9 + b, C.btn[3]); pc.px(12, 10 + b, C.thread); pc.px(13, 10 + b, C.thread);
    pc.ellipseOutline(13, 10 + b + mono, 3.3, 3.3, C.gold);
    pc.px(11, 8 + b + mono, glint ? '#ffffff' : C.goldL);
    pc.line(10, 13 + b, 10, 16 + b, C.gold);
    // olho em X (cicatriz) + sobrancelha
    for (const [x, y] of [[18, 8], [20, 8], [19, 9], [18, 10], [20, 10]]) pc.px(x, y + b, '#1e0e08');
    pc.line(17, 6 + b, 20, 6 + b, C.fur[0]); pc.line(10, 5 + b + mono, 12, 5 + b + mono, C.fur[0]);
    if (arm) { ball(pc, arm[0], arm[1] + b, 2.6, 3.4, C.fur); pc.px(arm[0] - 1, arm[1] + b - 2, C.fur[3]); }
    pc.outline(C.out);
    if (glint) { pc.px(10, 7 + b + mono, '#ffffff'); pc.px(9, 7 + b + mono, '#fff0a0'); pc.px(10, 6 + b + mono, '#fff0a0'); }
  },
});

// ===================================================================== PIP
/** Chave de corda (rotação simulada pela altura das alças). */
function windKey(pc, x, y, phase, K) {
  const sc = [1, 0.55, 0.15, 0.55][phase & 3];
  pc.rect(x, y, 5, 2, K[1]); pc.hline(x, y, 5, K[3]);
  const d = 1 + 3 * sc;
  for (const s of [-1, 1]) pc.ellipse(x - 1, y + 1 + s * d, 2, Math.max(0.7, 2 * sc), phase === 2 ? K[1] : K[2]);
  if (sc > 0.5) { pc.px(x - 1, y + 1 - d, K[0]); pc.px(x - 1, y + 1 + d, K[0]); }
}
defineSprite('npc_pip', {
  w: 28, h: 26, ox: 14, oy: 25,
  anims: { idle: { frames: 8, fps: 8 }, talk: { frames: 3, fps: 8 }, scared: { frames: 2, fps: 16 }, flee: { frames: 4, fps: 14 } },
  draw(pc, anim, f) {
    const C = PI;
    let b = 0, k = f & 3, blink = false, mouth = false, scared = false, jx = 0, run = false;
    if (anim === 'idle') { b = f < 4 ? 0 : 1; blink = f === 6; }
    else if (anim === 'talk') { mouth = f !== 1; b = f === 1 ? 1 : 0; }
    else if (anim === 'scared') { scared = true; jx = f ? 1 : -1; k = 2; }
    else { scared = true; run = true; b = f & 1 ? -1 : 0; k = f; }
    pc.translate(jx, 0);
    // cauda enrolada
    if (run) { pc.line(6, 19 + b, 0, 17 + b, C.fur[1]); pc.line(6, 20 + b, 1, 18 + b, C.ear); }
    else { pc.line(6, 21 + b, 2, 20 + b, C.fur[1]); pc.line(2, 20 + b, 1, 16 + b, C.fur[1]); pc.px(2, 15 + b, C.earD); pc.px(3, 15 + b, C.earD); }
    // pés
    const feet = run ? (f & 1 ? [[12, 24], [16, 24]] : [[7, 23], [21, 24]]) : [[10, 24], [18, 24]];
    for (const [x, y] of feet) pc.ellipse(x, y, 2.5, 1.5, C.ear);
    // corpo + barriga
    ball(pc, 13, 19 + b, 7, 5.5, C.fur);
    pc.ellipse(15.5, 20.5 + b, 3.8, 3.2, C.belly);
    windKey(pc, 2, 16 + b, k, C.key);                                      // chave nas costas
    // orelhas (para trás quando assustado)
    const e1 = scared ? [12, 7] : [14, 5], e2 = scared ? [17, 5] : [21, 4];
    ball(pc, e1[0], e1[1] + b, 4, 4, C.fur); pc.ellipse(e1[0] + 0.3, e1[1] + 0.3 + b, 2.5, 2.5, C.ear);
    ball(pc, 19, 12 + b, 6, 5, C.fur);                                    // cabeça
    ball(pc, e2[0], e2[1] + b, 3.8, 3.8, C.fur); pc.ellipse(e2[0] + 0.3, e2[1] + 0.3 + b, 2.3, 2.3, C.ear); pc.px(e2[0] + 1, e2[1] + 1 + b, C.earD);
    pc.ellipse(24, 13.5 + b, 3, 2.2, C.fur[2]);                           // focinho
    pc.circle(26.5, 13 + b, 1.2, C.nose);
    // olho
    if (scared) { pc.rect(19, 9 + b, 3, 3, '#ffffff'); pc.px(20, 10 + b, C.eye); }
    else if (blink) pc.hline(19, 11 + b, 3, C.eye);
    else { pc.rect(20, 9 + b, 2, 3, C.eye); pc.px(20, 9 + b, '#ffffff'); }
    pc.px(19, 14 + b, '#ff9ab8'); pc.px(18, 14 + b, '#ff9ab8');
    if (mouth) { pc.rect(23, 15 + b, 2, 2, '#5a1a2a'); pc.px(23, 15 + b, '#ffffff'); }
    else if (scared) { pc.px(23, 16 + b, C.out); pc.px(24, 15 + b, C.out); pc.px(25, 16 + b, C.out); }
    else pc.px(24, 16 + b, C.out);
    pc.outline(C.out);
    pc.line(25, 14 + b, 27, 13 + b, '#f4f6fc'); pc.line(25, 15 + b, 27, 16 + b, '#f4f6fc');
    if (scared) { pc.px(10, 4 + b, '#9ad8ff'); pc.px(10, 5 + b, '#5ab0ff'); pc.px(9, 5 + b, '#9ad8ff'); }
  },
});

// =============================================================== AGULHETA
defineSprite('npc_agulheta', {
  w: 48, h: 40, ox: 24, oy: 39,
  anims: { idle: { frames: 6, fps: 5 }, talk: { frames: 4, fps: 8 }, count: { frames: 6, fps: 8, loop: false } },
  draw(pc, anim, f) {
    const C = AG, W = C.wood;
    let b = 0, mouth = false, blink = false, paw = false, coin = null, happy = false;
    if (anim === 'idle') { b = [0, 0, 1, 1, 0, 0][f]; blink = f === 4; }
    else if (anim === 'talk') { mouth = !(f & 1); paw = f === 1 || f === 2; }
    else { paw = true; happy = true; coin = [0, -3, -6, -7, -5, -1][f]; }
    // postes + placa de botão dourado
    pc.rect(3, 4, 2, 35, W[1]); pc.vline(3, 4, 35, W[2]);
    pc.rect(43, 4, 2, 35, W[1]); pc.vline(43, 4, 35, W[2]);
    pc.circle(4.5, 14, 3, C.gold[1]); pc.circle(4, 13.5, 2, C.gold[2]); pc.px(3, 13, C.gold[0]); pc.px(5, 13, C.gold[0]); pc.px(3, 15, C.gold[0]); pc.px(5, 15, C.gold[0]);
    // alfinetes (atrás da almofada)
    const cx = 21, cy = 21 + b;
    const ang = [200, 222, 244, 266, 288, 310, 332];
    ang.forEach((a, i) => {
      const r = (a * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      pc.line(R(cx + c * 7), R(cy + s * 6.5), R(cx + c * 12), R(cy + s * 11), C.shaft);
    });
    ball(pc, cx, cy, 9.5, 8.5, C.cush);                                   // almofada-tomate
    pc.line(cx - 4, cy - 7, cx - 6, cy + 2, C.cush[1]); pc.line(cx + 1, cy - 8, cx + 1, cy + 3, C.cush[1]);
    ang.forEach((a, i) => {
      const r = (a * Math.PI) / 180, hx = R(cx + Math.cos(r) * 12.5), hy = R(cy + Math.sin(r) * 11.5);
      pc.rect(hx - 1, hy - 1, 2, 2, C.heads[i]); pc.px(hx - 1, hy - 1, (f + i) % 5 === 0 ? '#ffffff' : C.heads[i]);
    });
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]]) pc.px(cx + dx, cy - 9 + dy, C.leaf[1]); // folhas
    pc.px(cx, cy - 11, C.leaf[0]); pc.px(cx, cy - 10, C.leaf[2]);
    // rosto
    ball(pc, 28, 20 + b, 5.5, 5, C.face);
    pc.ellipse(32.5, 21.5 + b, 3, 2, C.face[1]); pc.ellipse(32, 21 + b, 2, 1.2, C.face[2]);
    pc.circle(35, 21 + b, 1.1, C.nose);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pc.px(25 + dx, 15 + b + dy, '#fff8e0'); // flor
    pc.px(25, 15 + b, '#ffb020');
    if (blink || happy) { pc.px(27, 19 + b, C.eye); pc.px(28, 18 + b, C.eye); pc.px(29, 19 + b, C.eye); }
    else { pc.rect(28, 18 + b, 2, 2, C.eye); pc.px(28, 18 + b, '#ffffff'); pc.px(27, 17 + b, C.eye); }
    pc.px(27, 22 + b, '#ff8aa0'); pc.px(28, 22 + b, '#ff8aa0');
    if (mouth) { pc.rect(31, 23 + b, 3, 2, '#4a1020'); } else { pc.px(31, 23 + b, '#5a2028'); pc.px(32, 24 + b, '#5a2028'); pc.px(33, 23 + b, '#5a2028'); }
    pc.circle(27, 25 + b, 1.3, C.gold[2]);                                // colar com moeda
    // balcão
    pc.rect(2, 26, 44, 3, W[2]); pc.hline(2, 26, 44, W[3]); pc.hline(2, 28, 44, W[0]);
    const cloth = ['#5a7ad0', '#e8b040', '#7ac070', '#d86aa0'];
    for (let i = 0; i < 4; i++) {
      pc.rect(4 + i * 10, 29, 10, 9, cloth[i]);
      pc.hline(4 + i * 10, 29, 10, '#ffffff40');
      for (let y = 30; y < 38; y += 2) pc.px(4 + i * 10, y, '#fff0d8');
    }
    for (let x = 5; x < 44; x += 2) pc.px(x, 38, cloth[(x >> 3) & 3]);
    // carretel e pote de botões no balcão
    pc.rect(8, 21, 6, 1, W[2]); pc.rect(8, 25, 6, 1, W[2]); pc.rect(9, 22, 4, 3, '#5ab0ff'); pc.hline(9, 23, 4, '#3a7ad0');
    pc.rect(36, 20, 6, 6, '#bfe6ff'); pc.hline(36, 20, 6, '#e8f6ff');
    for (const [x, y, c] of [[37, 22, '#ffd23f'], [39, 23, '#ff6f98'], [40, 21, '#7ae07a'], [38, 24, '#5ab0ff'], [40, 24, '#ffd23f']]) pc.px(x, y, c);
    // patinhas no balcão
    pc.ellipse(17, 26, 2, 1.4, C.face[1]);
    if (paw) { pc.ellipse(33, 23 + b, 1.8, 1.8, C.face[1]); pc.px(32, 22 + b, C.face[2]); }
    else pc.ellipse(29, 26, 2, 1.4, C.face[1]);
    if (coin !== null) { pc.ellipse(34, 18 + coin, f === 3 ? 0.8 : 1.6, 1.6, C.gold[2]); pc.px(34, 18 + coin, C.gold[1]); }
    // toldo listrado com babadinhos
    for (let x = 1; x < 47; x++) {
      const red = ((x - 1) >> 2) & 1;
      pc.vline(x, 1, 5, red ? '#e85a5a' : '#fff0d8');
      const sc = ((x - 1) & 3);
      if (sc === 1 || sc === 2) pc.px(x, 6, red ? '#c03a3a' : '#e8d8c0');
    }
    pc.hline(1, 1, 46, '#ffffff60');
    pc.outline(C.out);
  },
});

// ============================================================ CAPITÃ BOLHA
defineSprite('npc_capita_bolha', {
  w: 34, h: 32, ox: 17, oy: 31,
  anims: { idle: { frames: 6, fps: 5 }, talk: { frames: 3, fps: 8 }, bob: { frames: 8, fps: 6 } },
  draw(pc, anim, f) {
    const C = CB;
    let b = 0, hx = 0, mouth = false, blink = false, wag = false, ripple = -1;
    if (anim === 'idle') { b = [0, 0, 0, 1, 1, 1][f]; blink = f === 5; wag = f === 2; }
    else if (anim === 'talk') { mouth = f !== 1; b = f === 1 ? 1 : 0; }
    else { b = R(Math.sin((f / 8) * Math.PI * 2) * 1.5); hx = f < 4 ? 0 : 1; ripple = f; }
    // cauda levantada
    pc.poly([[5, 23 + b], [1 + (wag ? 1 : 0), 15 + b], [9, 19 + b]], C.duck[1]);
    pc.px(2 + (wag ? 1 : 0), 16 + b, C.duck[3]); pc.px(3, 18 + b, C.duck[2]);
    ball(pc, 15, 23 + b, 11, 7, C.duck);                                  // corpo
    pc.ellipse(13, 23 + b, 5, 3, C.duck[1]); pc.line(9, 24 + b, 16, 25 + b, C.duck[0]); // asa
    // lenço vermelho
    pc.rect(16, 17 + b, 9, 2, C.scarf[2]); pc.hline(16, 17 + b, 9, C.scarf[3]);
    pc.poly([[20, 19 + b], [25, 19 + b], [23, 23 + b]], C.scarf[1]);
    ball(pc, 20 + hx, 12 + b, 6.5, 6, C.duck);                            // cabeça
    // bico
    if (mouth) {
      pc.ellipse(27 + hx, 16.5 + b, 2.8, 1.3, C.beak[1]); pc.rect(24 + hx, 15 + b, 4, 1, '#6a1a10');
      pc.ellipse(27.5 + hx, 13.6 + b, 3.6, 1.6, C.beak[2]); pc.px(26 + hx, 13 + b, C.beak[3]);
    } else {
      pc.ellipse(26.5 + hx, 15.4 + b, 2.8, 1.1, C.beak[1]);
      pc.ellipse(27.5 + hx, 14 + b, 3.6, 1.6, C.beak[2]); pc.px(26 + hx, 13 + b, C.beak[3]);
      pc.hline(25 + hx, 15 + b, 5, C.beak[0]);
    }
    // olho + bochecha
    if (blink) pc.hline(21 + hx, 11 + b, 3, C.eye);
    else { pc.rect(22 + hx, 9 + b, 2, 3, C.eye); pc.px(22 + hx, 9 + b, '#ffffff'); }
    pc.px(20 + hx, 14 + b, '#ff9a6a'); pc.px(19 + hx, 14 + b, '#ff9a6a');
    // quepe de capitã
    pc.ellipse(19 + hx, 6 + b, 6.5, 3.5, C.crown[1]); pc.ellipse(18 + hx, 5 + b, 4, 2, C.crown[2]); pc.px(16 + hx, 4 + b, C.crown[3]);
    pc.rect(13 + hx, 6 + b, 13, 3, C.hat[2]); pc.hline(13 + hx, 6 + b, 13, C.hat[3]); pc.hline(13 + hx, 7 + b, 13, C.gold);
    pc.ellipse(25 + hx, 9.2 + b, 4.5, 1.2, C.hat[0]); pc.hline(22 + hx, 9 + b, 5, C.hat[1]);
    pc.rect(18 + hx, 5 + b, 3, 3, C.gold); pc.px(19 + hx, 6 + b, C.hat[1]);
    pc.outline(C.out);
    if (ripple >= 0) {
      const wv = [0, 1, 2, 1, 0, 1, 2, 1][ripple];
      for (let x = 2 - wv; x < 31 + wv; x++) if ((x + ripple) % 5 !== 0) pc.px(x, 29, x < 5 - wv || x > 27 + wv ? '#bfe8ff' : '#9fd8f8c0');
      pc.hline(0 + wv, 30, 3, '#bfe8ff'); pc.hline(30 - wv, 30, 3, '#bfe8ff');
    }
  },
});

// ============================================================ TIQUE-TAQUE
function cuckooBird(pc, x, y, open, blink) {
  const C = TT;
  ball(pc, x, y + 5, 4.5, 3.5, C.bird); pc.ellipse(x + 1.5, y + 6, 2.4, 2, C.belly);  // corpo
  pc.line(x - 4, y + 5, x - 1, y + 4, C.bird[0]);                                     // asa
  ball(pc, x + 2, y, 3.6, 3.3, C.bird);                                                // cabeça
  pc.px(x + 1, y - 4, C.bird[1]); pc.px(x + 2, y - 5, C.bird[2]); pc.px(x + 3, y - 4, C.bird[1]); // topete
  if (open) { pc.poly([[x + 5, y - 1], [x + 9, y - 1], [x + 5, y]], C.beak); pc.poly([[x + 5, y + 1], [x + 8, y + 2], [x + 5, y + 2]], C.beakD); }
  else { pc.poly([[x + 5, y - 1], [x + 9, y + 1], [x + 5, y + 2]], C.beak); pc.px(x + 6, y + 1, C.beakD); }
  if (blink) pc.hline(x + 2, y, 2, C.eye);
  else { pc.rect(x + 2, y - 1, 2, 2, '#ffffff'); pc.px(x + 3, y, C.eye); }
  pc.px(x + 1, y + 2, C.cheek);
}
defineSprite('npc_tique_taque', {
  w: 32, h: 42, ox: 16, oy: 41,
  anims: { idle: { frames: 8, fps: 4 }, talk: { frames: 3, fps: 8 }, cuckoo: { frames: 6, fps: 7, loop: false } },
  draw(pc, anim, f, n) {
    const C = TT;
    let doors = 'open', bird = 'peek', ext = 0, open = false, blink = false;
    if (anim === 'idle') { blink = f === 6; ext = f === 2 || f === 3 ? 1 : 0; }
    else if (anim === 'talk') { bird = 'out'; open = f !== 1; ext = f === 1 ? 1 : 2; }
    else { doors = f === 0 ? 'closed' : 'open'; bird = f === 0 ? 'none' : f === 5 ? 'peek' : 'out'; ext = [0, 0, 3, 2, 3, 0][f]; open = f === 2 || f === 4; }
    // poste e base
    pc.rect(14, 30, 4, 9, C.wood[1]); pc.vline(14, 30, 9, C.wood[3]);
    pc.rect(10, 39, 12, 2, C.wood[0]); pc.hline(10, 39, 12, C.wood[2]);
    // pêndulo
    const sw = [-2, -1, 0, 1, 2, 1, 0, -1][(f * 2) % 8];
    pc.line(16, 31, 16 + sw, 35, C.brass); pc.circle(16 + sw, 36, 1.6, C.brass); pc.px(15 + sw, 35, '#fff0a0');
    // casinha
    pc.rect(5, 12, 22, 19, C.wood[2]);
    for (let y = 15; y < 31; y += 4) pc.hline(5, y, 22, C.wood[1]);
    pc.vline(5, 12, 19, C.wood[3]);
    pc.poly([[2, 13], [16, 2], [30, 13]], C.roof[2]);
    pc.line(2, 13, 16, 2, C.roof[3]); pc.hline(3, 13, 27, C.roof[0]);
    for (let i = 0; i < 4; i++) { pc.px(7 + i * 3, 11 - i * 2, C.roof[1]); pc.px(25 - i * 3, 11 - i * 2, C.roof[1]); }
    pc.circle(16, 2, 1.5, C.brass);
    // mostrador com ponteiros
    pc.circle(16, 24, 4.6, '#8a5a30'); pc.circle(16, 24, 3.8, C.dial);
    for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) pc.px(16 + dx, 24 + dy, '#8a5a30');
    const a = (f / n) * Math.PI * 2 - Math.PI / 2;
    pc.line(16, 24, R(16 + Math.cos(a) * 3), R(24 + Math.sin(a) * 3), '#2a1a10');
    pc.line(16, 24, 16, 22, '#2a1a10');
    // abertura + portinhas
    pc.rect(12, 14, 8, 6, C.hole); pc.ellipse(16, 14, 4, 2.6, C.hole);
    if (doors === 'closed') {
      pc.rect(12, 12, 4, 8, C.wood[3]); pc.rect(16, 12, 4, 8, C.wood[1]);
      pc.px(15, 16, C.brass); pc.px(16, 16, C.brass);
    } else {
      pc.rect(10, 12, 2, 8, C.wood[3]); pc.rect(20, 12, 2, 8, C.wood[1]);
    }
    // passarinho
    if (bird === 'peek') cuckooBird(pc, 14, 16 - ext, false, blink);
    else if (bird === 'out') {
      const by = 10 - ext * 2;
      for (let y = by + 8; y < 19; y += 2) { pc.line(14, y, 18, y + 1, C.spring[1]); pc.px(14, y, C.spring[2]); }
      cuckooBird(pc, 15, by, open, false);
    }
    pc.outline(C.out);
  },
});

// =============================================================== LUZINHA
defineSprite('npc_luzinha', {
  w: 30, h: 28, ox: 15, oy: 27,
  anims: { idle: { frames: 6, fps: 8 }, talk: { frames: 3, fps: 8 }, fly: { frames: 4, fps: 14 }, dim: { frames: 4, fps: 4 } },
  draw(pc, anim, f) {
    const C = LU;
    let b = 0, wing = 6, G = C.glow, blink = false, mouth = false, sad = false, hx = 0, halo = true;
    if (anim === 'idle') { b = [0, 0, 1, 1, 1, 0][f]; wing = [6, 5, 3, 5, 6, 5][f]; blink = f === 5; G = f === 2 || f === 3 ? C.glow : [C.glow[0], C.glow[1], C.glow[2], C.glow[2]]; }
    else if (anim === 'talk') { mouth = f !== 1; wing = [6, 4, 6][f]; }
    else if (anim === 'fly') { wing = [6, 2, 6, 2][f]; hx = 1; b = f & 1; }
    else { sad = true; halo = false; G = [C.dim, C.dim, C.mid, C.dim][f]; wing = 5; b = 1; }
    // abdômen luminoso
    ball(pc, 13 + hx * 0, 20 + b, 6.5, 5, G);
    for (let x = 8; x < 20; x++) for (const y of [18, 21]) if (pc.alphaAt(x, y + b) && (x + y) % 3) pc.px(x, y + b, G[1]);
    pc.px(11, 23 + b, G[0]); pc.px(16, 23 + b, G[0]);
    // antenas
    pc.line(13 + hx, 4 + b, 11 + hx, 2 + b, C.body[1]); pc.line(11 + hx, 2 + b, 9 + hx, 1 + b, C.body[1]);
    pc.line(17 + hx, 4 + b, 19 + hx, 2 + b, C.body[1]); pc.line(19 + hx, 2 + b, 21 + hx, 1 + b, C.body[1]);
    pc.circle(8.5 + hx, 1.5 + b, 1.4, G[1]); pc.circle(21.5 + hx, 1.5 + b, 1.4, G[1]);
    ball(pc, 16 + hx, 10 + b, 7, 6.5, C.body);                            // cabeça
    pc.ellipse(18 + hx, 12.5 + b, 4.5, 2.6, C.body[3]); pc.ellipse(18 + hx, 13 + b, 3.6, 1.8, '#9a8ad8');
    // olhos grandes
    for (const ex of [14, 19]) {
      const x = ex + hx, y = 8 + b;
      if (blink) pc.hline(x, y + 2, 3, C.eye);
      else if (sad) { pc.rect(x, y + 1, 3, 2, C.eye); pc.px(x + 1, y + 1, '#fffbe8'); pc.px(x + (ex < 16 ? 2 : 0), y, C.body[0]); }
      else { pc.rect(x, y, 3, 3, C.eye); pc.px(x, y, '#fffbe8'); pc.px(x + 1, y, '#fffbe8'); }
    }
    pc.px(13 + hx, 12 + b, '#ff8fc8'); pc.px(22 + hx, 12 + b, '#ff8fc8');
    if (mouth) pc.rect(17 + hx, 13 + b, 2, 2, '#3a1030');
    else if (sad) { pc.px(17 + hx, 14 + b, C.out); pc.px(18 + hx, 13 + b, C.out); pc.px(19 + hx, 14 + b, C.out); }
    else { pc.px(17 + hx, 13 + b, C.out); pc.px(18 + hx, 14 + b, C.out); pc.px(19 + hx, 13 + b, C.out); }
    pc.outline(C.out);
    // asas translúcidas (atrás) e halo
    softEllipse(pc, 7, 10 + b, 4, wing, '#d8f0ff58', '#ffffffa8');
    softEllipse(pc, 24, 9 + b, 4, wing, '#d8f0ff58', '#ffffffa8');
    if (halo) softEllipse(pc, 13, 20 + b, 9, 7.5, '#fff3a018', '#fff3a030');
  },
});

// ========================================================== ECO DA TECELÃ
defineSprite('npc_tecela', {
  w: 34, h: 46, ox: 17, oy: 45,
  anims: { idle: { frames: 6, fps: 5 }, talk: { frames: 3, fps: 6 }, weave: { frames: 6, fps: 8, loop: false } },
  draw(pc, anim, f) {
    const C = TE;
    let hands = 'down', mouth = false, mark = f === 3, sp = f;
    if (anim === 'talk') { hands = 'up'; mouth = f !== 1; }
    else if (anim === 'weave') { hands = 'center'; mark = true; }
    // manto
    pc.poly([[10, 21], [24, 21], [30, 38], [4, 38]], C.robe[1]);
    pc.poly([[10, 21], [14, 21], [10, 38], [4, 38]], C.robe[2]);
    pc.poly([[22, 21], [24, 21], [30, 38], [26, 38]], C.robe[0]);
    for (let x = 4; x < 31; x++) { const y = 36 + ((x >> 1) & 1); pc.px(x, y, C.gold); pc.px(x, y + 1, C.goldD); }
    // mangas e mãos
    const hp = hands === 'up' ? [[7, 25], [27, 24]] : hands === 'center' ? [[13, 28], [21, 28]] : [[7, 28], [27, 28]];
    for (const [x, y] of hp) { ball(pc, x, y, 3, 3.6, C.robe); pc.ellipse(x, y + 3, 1.6, 1.3, C.face[2]); }
    // capuz e rosto
    ball(pc, 17, 14, 8, 9, C.hood);
    pc.poly([[14, 7], [20, 7], [17, 1]], C.hood[2]); pc.px(17, 2, C.hood[3]);
    for (let y = 6; y < 23; y++) for (let x = 9; x < 26; x++) if ((x + y * 3) % 7 === 0 && pc.alphaAt(x, y)) pc.px(x, y, C.hood[1]);
    pc.ellipse(18, 16, 5, 6, C.hoodIn);
    ball(pc, 18, 17, 3.8, 4.4, C.face);
    pc.hline(16, 17, 2, C.eye); pc.hline(19, 17, 2, C.eye);
    if (mouth) pc.px(18, 20, '#9a5a7a'); else pc.px(18, 20, C.face[0]);
    pc.px(18, 14, '#ffffff'); pc.px(17, 14, mark ? '#ffffff' : C.gold); pc.px(19, 14, mark ? '#ffffff' : C.gold); pc.px(18, 13, C.gold);
    pc.outline(C.out);
    // fios dourados: escorrendo do capuz e desfiando a barra
    const sw = [0, 1, 1, 0, -1, -1][f % 6];
    pc.line(10, 16, 7, 24, C.gold); pc.line(7, 24, 6 + sw, 31, C.gold);
    pc.line(25, 16, 28, 24, C.gold); pc.line(28, 24, 29 - sw, 31, C.goldD);
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 4.4, s = [1, 0, -1, 0][(f + i) & 3];
      pc.line(R(x), 39, R(x + s), 42, i & 1 ? C.goldD : C.gold); pc.px(R(x + s * 2), 44 - (i & 1), C.gold + '90');
    }
    if (hands === 'center') {
      for (let x = 14; x <= 20; x++) pc.px(x, 31 + R(Math.sin(x * 1.3 + f) * 1), C.gold);
      pc.px(14 + ((f * 2) % 7), 30 + (f & 1), '#ffffff');
    }
    // eco: translúcida e dourada
    pc.mapPixels((r, g, b, a) => [r * 0.72 + 255 * 0.28, g * 0.72 + 222 * 0.28, b * 0.72 + 150 * 0.28, Math.min(a, 205)]);
  },
});

// ========================================================== ITENS DE MISSÃO
defineSprite('qi_key', {
  w: 14, h: 14, ox: 7, oy: 7,
  anims: { idle: { frames: 4, fps: 6 } },
  draw(pc, a, f) {
    const K = PI.key;
    pc.rect(5, 6, 7, 2, K[1]); pc.hline(5, 6, 7, K[3]);
    pc.rect(11, 5, 2, 4, K[2]); pc.px(11, 5, K[3]);
    windKey(pc, 3, 6, f, K);
    pc.outline('#4a2a06');
  },
});
defineSprite('qi_marujo', {
  w: 12, h: 14, ox: 6, oy: 7,
  anims: { idle: { frames: 2, fps: 3 } },
  draw(pc, a, f) {
    pc.ellipse(6, 10, 4, 3.5, '#4a7fe0'); pc.ellipse(5, 9, 2.4, 2, '#7aa8ff');           // corpinho de borracha
    pc.poly([[3, 8], [9, 8], [6, 11]], '#ffffff'); pc.px(6, 10, '#e84a40');               // gola de marinheiro
    pc.circle(6, 5, 3, '#ffd2b0'); pc.px(5, 4, '#fff0e2');                               // rosto
    pc.px(5, 5, '#2a1a20'); pc.px(7, 5, '#2a1a20'); pc.px(6, 7, '#e86a6a');
    pc.rect(3, 1, 7, 2, '#ffffff'); pc.hline(3, 3, 7, '#c8d4ea'); pc.px(f ? 9 : 3, 0, '#4a7fe0'); // chapéu
    pc.outline('#1e2a50');
  },
});

// Balão "!" (diálogo ainda não ouvido)
defineImage('npc_bang', 9, 12, (pc) => {
  pc.rect(1, 1, 7, 7, '#fff8e8'); pc.rect(0, 2, 9, 5, '#fff8e8');
  pc.poly([[3, 8], [6, 8], [3, 10]], '#fff8e8');
  pc.vline(4, 2, 3, '#e8502a'); pc.vline(5, 2, 3, '#ff7a3c'); pc.rect(4, 6, 2, 1, '#e8502a');
  pc.hline(1, 7, 7, '#e8d8c0');
  pc.outline('#2a1a30');
});

// ============================================================ DEFINIÇÕES
const NPCS = {
  botao: { w: 14, h: 30, special: 'monocle', pitch: 0.8,
    placeholder: [{ who: 'botao', expr: 'neutral', text: 'Hmpf. Ainda não tenho nada para lhe dizer, pequeno. Volte depois.' }] },
  pip: { w: 14, h: 18, pitch: 1.5,
    placeholder: [{ who: 'pip', expr: 'scared', text: 'E-eu não sei de nada! Nadinha! Pode procurar outro rato!', shake: true }] },
  agulheta: { w: 30, h: 34, special: 'count', pitch: 1.2,
    placeholder: [{ who: 'agulheta', expr: 'happy', text: 'Botões, botões! Tudo tem seu preço, docinho. Até a minha simpatia.' }] },
  capita_bolha: { w: 18, h: 24, water: 'bob', pitch: 1.1,
    placeholder: [{ who: 'capita_bolha', expr: 'determined', text: 'Quac! Mantenha o casco firme e o bico erguido, marujo!' }] },
  tique_taque: { w: 16, h: 36, special: 'cuckoo', specialSfx: 'clock_chime', pitch: 1.3,
    placeholder: [{ who: 'tique_taque', expr: 'confused', text: 'Tique... taque... tique... eu já disse isso? Tique... taque...' }] },
  luzinha: { w: 14, h: 20, float: 10, special: 'fly', specialDur: 1.4, pitch: 1.4,
    light: { r: 64, color: '#ffe27a', i: 0.9, flicker: 0.15 }, glow: { r: 22, color: '#ffd84a', a: 0.45 },
    placeholder: [{ who: 'luzinha', expr: 'scared', text: 'E-eu fico pertinho de você, tá bom? O escuro é grande demais.' }] },
  tecela: { w: 18, h: 38, float: 6, special: 'weave', pitch: 0.7,
    light: { r: 54, color: '#ffe8b0', i: 0.7, flicker: 0.05 }, glow: { r: 26, color: '#ffd890', a: 0.35 },
    placeholder: [{ who: 'tecela', expr: 'neutral', text: 'O fio se lembra... mesmo quando nós esquecemos.' }] },
};

registerQuest('pip_key', { name: 'A Chave do Pip', world: 1, desc: 'Encontrar a chave de corda do Pip.' });
registerQuest('bolha_marujos', { name: 'Marujos Perdidos', world: 2, need: 3, desc: 'Resgatar os 3 marujos da Capitã Bolha.' });

// ================================================================== NPC
class Npc extends Entity {
  constructor(level, x, y, p) {
    super(level, x, y, p);
    this.kind = NPCS[p.npc] ? p.npc : 'botao';
    const d = (this.def = NPCS[this.kind]);
    this.sprite = 'npc_' + this.kind;
    this.w = d.w; this.h = d.h;
    this.alignToCell(x, y);
    this.water = !!d.water && level.map?.get(Math.floor(x / TILE), Math.floor(y / TILE)) === T.WATER;
    if (this.water) this.y = y + 5 - this.h;              // boiando na superfície
    this.floatH = d.float || 0;
    this.y -= this.floatH;
    this.interactable = !p.flee; this.prompt = 'Falar';
    this.z = 20;
    this.facing = p.flip ? -1 : 1;
    this.baseAnim = p.anim || (this.water ? d.water : 'idle');
    this.anim = this.baseAnim; this.animT = Math.random() * 2;
    this.specialT = 2 + Math.random() * 4; this.specialDur = 1;
    this.talking = false; this.heard = false; this.alpha = 1;
    this.flee = p.flee ? 'wait' : null; this.fleeFlag = p.fleeFlag || `fled:${p.pid}`;
    if (d.light) this.light = { ...d.light };
    else if ((level.data?.darkness ?? 0) > 0.3) this.light = { r: 30, color: '#ffe2b0', i: 0.5, flicker: 0 };
  }
  init() { if (this.flee && save.flag(this.fleeFlag)) this.remove(); }

  /** Diálogo atual (troca para dialogDone quando a missão foi concluída). */
  currentDialog() {
    const p = this.props;
    if (p.quest && p.dialogDone && save.data.quests?.[p.quest] === 'done') return p.dialogDone;
    return p.dialog;
  }
  hasUnheard() {
    const id = this.currentDialog();
    if (typeof id === 'string') return REG.dialogues.has(id) ? !save.seen(id) : !this.heard;
    return Array.isArray(id) && !this.heard;
  }
  linesFor(id) {
    if (Array.isArray(id)) return id;
    if (typeof id === 'string') {
      if (save.seen(id)) {
        const rep = (id === this.props.dialog && this.props.repeat) || `${id}_repeat`;
        if (REG.dialogues.has(rep)) return REG.dialogues.get(rep);
      }
      if (REG.dialogues.has(id)) return REG.dialogues.get(id);
    }
    return this.def.placeholder;
  }
  facePlayer() { const pl = this.player; if (pl && !this.props.fixed) this.facing = Math.sign(pl.cx - this.cx) || this.facing; }
  setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }

  interact() {
    if (this.talking || this.flee) return;
    const p = this.props, id = this.currentDialog();
    this.talking = true; this.setAnim('talk'); this.facePlayer();
    audio.sfx('text_blip', { pitch: this.def.pitch || 1 });
    this.level.say(this.linesFor(id)).then(() => {
      this.talking = false; this.heard = true; this.setAnim(this.baseAnim);
      if (typeof id === 'string' && REG.dialogues.has(id)) save.markSeen(id);
      const q = save.data.quests || (save.data.quests = {});
      if (p.quest && !q[p.quest] && id === p.dialog) q[p.quest] = 'active';
      if (p.quest && p.reward && id === p.dialogDone && !save.flag(`reward:${p.quest}`)) {
        save.setFlag(`reward:${p.quest}`);
        this.level.collect('button', p.reward);
        this.level.toast(`+${p.reward} botões`, 'icon_button');
        audio.sfx('coin');
      }
      if (p.signal) this.level.signal(p.signal, true);
      save.commit();
    });
  }

  update(dt) {
    this.tickTimers(dt);
    this.animT += dt;
    if (this.flee) { this.updateFlee(dt); return; }
    if (this.talking || this.playerNear(84, 48)) this.facePlayer();
    if (this.talking) { this.setAnim('talk'); return; }
    if (this.anim !== this.baseAnim) {
      if (this.anim === 'talk' || this.animT >= this.specialDur) this.setAnim(this.baseAnim);
    } else if (this.def.special && !this.props.anim && !this.water) {
      this.specialT -= dt;
      if (this.specialT <= 0) {
        this.setAnim(this.def.special);
        this.specialDur = this.def.specialDur || animDuration(this.sprite, this.anim);
        this.specialT = 4 + Math.random() * 5;
        if (this.def.specialSfx && this.playerNear(160, 90)) audio.sfx(this.def.specialSfx, { vol: 0.4 });
      }
    }
  }

  // Pip medroso: treme, (fala), e corre para longe do Tico. Salva a flag.
  updateFlee(dt) {
    const pl = this.player;
    this.fleeT = (this.fleeT || 0) + dt;
    if (this.flee === 'wait') {
      this.facePlayer();
      if (this.playerNear(72, 40)) { this.flee = 'scared'; this.fleeT = 0; this.setAnim('scared'); audio.sfx('ui_denied', { pitch: 1.8 }); }
    } else if (this.flee === 'scared') {
      if (this.fleeT > 0.6 && !this.saying) {
        const id = this.props.dialog;
        if (id && !this.saidFlee) {
          this.saidFlee = this.saying = true;
          this.level.say(this.linesFor(id)).then(() => {
            if (typeof id === 'string' && REG.dialogues.has(id)) save.markSeen(id);
            this.saying = false; this.startRun();
          });
        } else if (!this.saying) this.startRun();
      }
    } else if (this.flee === 'run') {
      this.x += this.runDir * 200 * dt;
      if (this.fleeT > 0.7) this.alpha = Math.max(0, this.alpha - dt * 2.2);
      if (Math.random() < 0.35) this.level.particles?.emit('dust', this.cx - this.runDir * 6, this.bottom - 1, 1);
      if (this.alpha <= 0 || this.fleeT > 2.5) this.remove();
    }
    void pl;
  }
  startRun() {
    this.flee = 'run'; this.fleeT = 0; this.alwaysUpdate = true; this.setAnim('flee');
    this.runDir = Math.sign(this.cx - (this.player?.cx ?? this.cx - 1)) || 1;
    this.facing = this.runDir;
    save.setFlag(this.fleeFlag); save.commit();
    audio.sfx('whoosh', { pitch: 1.6 });
  }

  draw(ctx) {
    const f = animFrame(this.sprite, this.anim, this.animT);
    const fy = this.floatH ? Math.sin(this.t * 2.2) * 2 : 0;
    const hop = this.talking ? Math.abs(Math.sin(this.t * 10)) * 2 : 0;
    const x = R(this.cx), y = R(this.bottom + fy - hop);
    const g = this.def.glow;
    if (g) drawGlow(ctx, x, y - this.h * 0.45, g.r, g.color, (this.anim === 'dim' ? 0.12 : g.a) * this.alpha);
    drawSprite(ctx, this.sprite, this.anim, f, x, y, { flip: this.facing < 0, alpha: this.alpha });
    if (!this.talking && !this.flee && this.player?.interactTarget !== this && this.hasUnheard())
      drawImage(ctx, 'npc_bang', x - 4, R(this.y - 14 + fy + Math.sin(this.t * 4) * 1.5));
  }
}
registerEntity('npc', Npc);

// ================================================================== LOJA
const AG_LINES = [{ who: 'agulheta', expr: 'happy', text: 'A lojinha está fechada para balanço, docinho! Volte com mais botões.' }];
registerEntity('shop', class Shop extends Entity {
  constructor(level, x, y, p) {
    super(level, x, y, p);
    this.w = 40; this.h = 34; this.alignToCell(x, y);
    this.interactable = true; this.prompt = 'Loja'; this.z = 8;
    this.anim = 'idle'; this.animT = 0; this.specialT = 3; this.busy = false;
    this.facing = p.flip ? -1 : 1;
    if ((level.data?.darkness ?? 0) > 0.2) this.light = { r: 52, color: '#ffd9a0', i: 0.7, flicker: 0.1 };
  }
  greetId() { return this.props.dialog || `w${Math.max(1, this.level.data?.world | 0)}_agulheta`; }
  update(dt) {
    this.tickTimers(dt); this.animT += dt;
    if (this.busy) return;
    if (this.anim !== 'idle') { if (this.animT >= animDuration('npc_agulheta', this.anim)) { this.anim = 'idle'; this.animT = 0; } }
    else if ((this.specialT -= dt) <= 0) {
      this.anim = 'count'; this.animT = 0; this.specialT = 5 + Math.random() * 4;
      if (this.playerNear(120, 60)) audio.sfx('coin', { vol: 0.25, pitch: 1.3 });
    }
  }
  open() {
    const s = makeScene('shop', this.level);
    if (s && this.level.manager) { audio.sfx('ui_open'); this.level.manager.push(s, { level: this.level }); return; }
    const id = this.greetId();
    this.talk(REG.dialogues.has(id) ? REG.dialogues.get(id) : AG_LINES);
  }
  talk(lines, then) {
    this.busy = true; this.anim = 'talk'; this.animT = 0;
    return this.level.say(lines).then(() => { this.busy = false; this.anim = 'idle'; this.animT = 0; then?.(); });
  }
  interact() {
    if (this.busy) return;
    const id = this.greetId();
    if (REG.dialogues.has(id) && !save.seen(id)) this.talk(REG.dialogues.get(id), () => { save.markSeen(id); save.commit(); this.open(); });
    else this.open();
  }
  draw(ctx) {
    const x = R(this.cx), y = R(this.bottom);
    drawSprite(ctx, 'npc_agulheta', this.anim, animFrame('npc_agulheta', this.anim, this.animT), x, y, { flip: this.facing < 0 });
    const id = this.greetId();
    if (!this.busy && this.player?.interactTarget !== this && REG.dialogues.has(id) && !save.seen(id))
      drawImage(ctx, 'npc_bang', x + 4, R(this.y - 6 + Math.sin(this.t * 4) * 1.5));
  }
});

// ========================================================= ITEM DE MISSÃO
registerEntity('quest_item', class QuestItem extends Entity {
  constructor(level, x, y, p) {
    super(level, x, y, p);
    this.w = 12; this.h = 12; this.x = x + 2; this.y = y + 2; this.z = 15;
    this.persistentId = p.pid;
    const s = p.sprite || 'key';
    this.sprite = hasSprite(s) ? s : hasSprite('qi_' + s) ? 'qi_' + s : 'qi_key';
  }
  init() {
    const p = this.props;
    if ((p.pid && save.isCollected(p.pid)) || (p.quest && !p.need && save.data.quests?.[p.quest] === 'done')) this.remove();
  }
  update(dt) {
    this.tickTimers(dt);
    const pl = this.player;
    if (pl && !pl.dead && this.overlaps(pl)) this.pick();
  }
  pick() {
    const p = this.props, q = p.quest, qs = save.data.quests || (save.data.quests = {});
    if (p.pid) save.markCollected(p.pid);
    const name = p.item || 'Item';
    let text = p.text || `${name} encontrado!`;
    if (q) {
      if (p.need) {
        const n = (qs[`${q}:n`] || 0) + 1;
        qs[`${q}:n`] = n;
        if (n >= p.need) qs[q] = 'done';
        text = p.text || `${name} (${Math.min(n, p.need)}/${p.need})`;
      } else qs[q] = 'done';
    }
    this.level.toast(text, 'icon_check');
    audio.sfx('star', { pitch: 1.2 });
    this.level.particles?.emit('stars_burst', this.cx, this.cy, 12, { colors: ['#ffd23f', '#ffffff', '#ffb0c8'] });
    save.commit();
    this.remove();
  }
  draw(ctx) {
    const x = R(this.cx), y = R(this.cy + Math.sin(this.t * 3) * 2);
    drawGlow(ctx, x, y, 14, '#ffe27a', 0.3 + Math.sin(this.t * 4) * 0.08);
    drawSprite(ctx, this.sprite, 'idle', animFrame(this.sprite, 'idle', this.t), x, y);
  }
});

// ============================================================ FASE DE TESTE
// ?level=test_npcs&god=1 — vitrine de todos os NPCs, loja e item de missão.
registerLevel({
  id: 'test_npcs', world: 0, index: 0, name: 'Vitrine de Personagens', subtitle: 'Teste',
  tileset: 'w1', background: 'w1', music: null, parTime: 120, ambient: 'w1_fireflies',
  map: [
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '..........................................................................',
    '.................q........................................................',
    '................===.......................................................',
    '..P.i...n....n........U.....n.............n....n........n.............E...',
    '################################~~~n~~~###################################',
    '################################~~~~~~~###################################',
    '##########################################################################',
    '##########################################################################',
  ],
  legend: { q: 'quest_item' },
  props: {
    '4,11': { text: 'Vitrine de {#ffd23f}personagens{/}: fale com todos! A chave é do Pip.' },
    '8,11': { npc: 'botao', dialog: 'w1_botao_1' },
    '13,11': { npc: 'pip', dialog: 'w1_pip_2', quest: 'pip_key', dialogDone: 'w1_pip_3', reward: 10 },
    '17,9': { quest: 'pip_key', item: 'Chave de corda', sprite: 'key' },
    '28,11': { npc: 'tique_taque', dialog: 'w3_tique_1' },
    '35,12': { npc: 'capita_bolha', dialog: 'w2_bolha_1' },
    '42,11': { npc: 'luzinha', dialog: 'w4_luzinha_1' },
    '47,11': { npc: 'tecela', dialog: 'w5_tecela_1' },
    '56,11': { npc: 'pip', dialog: 'w1_pip_1', flee: true },
  },
});
