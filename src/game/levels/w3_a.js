// =============================================================================
// levels/w3_a.js — MUNDO 3 (Cidade dos Relógios Quebrados), fases 1 e 2.
//   w3_1 "Praça do Relógio Parado" — altar do Remendo Temporal; ensina blocos que
//         desmoronam (C), ponte que cai (rewind_bridge), relógio que despenca (v),
//         novelo/pedregulho em placa; primeiros soldadinhos (a) e despertadores (b);
//         plataformas-relógio (j) apresentadas com calma. Tique-Taque (w3_tique_1).
//   w3_2 "Ruas Suspensas" — ilhas de rua flutuando no vazio: ritmo de plataformas-
//         relógio, ponteiros gigantes (l), bolhas de tempo lento/rápido (q/s),
//         relógios que despencam. Tique-Taque mostra a Torre (w3_tique_2).
// Montagem por código com grid() de w1_a.js. Exporta utilitários p/ w3_b/w3_c.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid } from './w1_a.js';
import { promoteMidDecor } from '../art/tiles_w3.js';

export { grid };
/** Campos comuns das fases do Mundo 3 (onStart: relógios/pêndulos de parede atrás do Tico). */
export const W3 = { world: 3, tileset: 'w3', background: 'w3', ambient: 'w3_sparks', oxygen: false, onStart: promoteMidDecor };
/** Abismo: limpa as colunas x0..x1 da linha y0 até o fundo. */
export function pit(m, x0, x1, y0 = 0) { return m.fill(x0, y0, x1, m.H - 1, '.'); }
/** Parede de fundo (':') só onde está vazio — chame depois de pôr as entidades. */
export function back(m, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.get(x, y) === '.') m.put(x, y, ':');
  return m;
}
/** Plataforma-relógio de largura w (fase 0 = latão / 1 = azinhavre). */
export function clk(m, x, y, w, phase, period = 3, more) {
  m.fill(x, y, x + w - 1, y, 'j');
  m.props[`${x},${y}`] = { phase, period, ...more };
  return m;
}
/** Bloco flutuante (ilha de rua / pilar) de x0..x1 a partir de `top` com `d` linhas. */
export function isle(m, x0, x1, top, d = 4, ch = '#') { return m.fill(x0, top, x1, Math.min(m.H - 1, top + d - 1), ch); }
const HIDE_T = { o: 'button', r: 'patch', X: 'secret_marker', e: 'energy', h: 'heart', M: 'memory', T: 'ancient_thread', c: 'chest' };
/** Sala secreta: o vazio vira parede falsa 'H' (some quando o Tico entra) e os itens
 *  viram `objects` para ficarem escondidos atrás dela. Estrelas continuam no mapa. */
export function hide(m, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ch = m.get(x, y), t = HIDE_T[ch];
    if (t) { m.obj({ type: t, x, y, ...(m.props[`${x},${y}`] || {}) }); delete m.props[`${x},${y}`]; m.put(x, y, 'H'); }
    else if (ch === '.' || ch === ':') m.put(x, y, 'H');
  }
  return m;
}
export function npc(m, x, y, id, dialog) { return m.put(x, y, 'n', { npc: id, dialog }); }

// =============================================================================
// w3_1 — Praça do Relógio Parado. Chão na linha 21 (Tico em pé na 20).
// =============================================================================
{
  const m = grid(250, 28), G = 21;
  m.ground(0, 249, G);
  // --- A: rua de chegada + Tique-Taque ---------------------------------------
  m.put(3, 20, 'P');
  m.sign(6, 20, 'w3_sign_city');
  m.line(9, 13, 18);
  m.fill(16, 19, 17, 20, '%'); m.line(16, 17, 17);
  npc(m, 22, 20, 'tique_taque', 'w3_tique_1');
  m.put(28, 20, 'a');
  // --- B: altar do Remendo Temporal ------------------------------------------
  m.fill(33, 20, 41, 20, '%');
  m.put(37, 19, 'Q', { ability: 'rewind' });
  m.line(34, 36, 17); m.line(38, 40, 17);                     // (fachada do templo ao fundo)
  m.sign(44, 20, 'w3_sign_rewind');
  m.put(45, 19, 'e'); m.put(46, 20, 'K');
  // --- C: vala segura com blocos que desmoronam ------------------------------
  m.clear(47, G, 57, 23); m.fill(47, G, 57, G, 'C');
  m.line(48, 56, 23, 'o', 2);                                 // prêmio de consolação no fundo
  m.fill(51, 17, 53, 17, 'C');
  m.fill(55, 14, 59, 14, '%'); m.line(55, 58, 13); m.put(59, 13, 'e');   // terraço do sobrado
  // --- D: corredor baixo com ponte que cai (Remendo obrigatório) -------------
  m.sign(60, 20, 'w3_sign_bridge');
  m.fill(62, 3, 85, 17, '%');                                 // prédio sobre a passagem
  m.put(64, 20, 'D', { signal: 'w31_br' });
  pit(m, 66, 72, G);
  m.obj({ type: 'rewind_bridge', x: 66, y: G, width: 7, noStep: true, signal: 'w31_br', respawn: 7 });
  m.line(75, 83, 19, 'o', 2);
  // --- E: soldadinhos + relógio que despenca (★1) ----------------------------
  m.put(89, 20, 'a');
  m.plat(90, 93, 17); m.line(90, 93, 16);
  m.sign(87, 20, 'w3_sign_falling');
  m.put(97, 20, 'b');
  m.plat(95, 97, 13); m.put(96, 12, 'o');
  m.put(100, 8, 'v', { trigger: 'below' });                   // devolvido pelo Remendo = degrau fixo
  m.fill(102, 4, 105, 4, '%'); m.line(102, 103, 3); m.put(104, 3, '*');   // ★1 (terraço do sobrado alto)
  // --- F: novelo na placa abre o portão --------------------------------------
  m.put(109, 20, 'K');
  m.sign(113, 20, 'w3_sign_boulder');
  m.obj({ type: 'boulder', x: 118, y: 20 });
  m.line(119, 123, 17);
  m.clear(124, G, 126, G); m.put(125, G, 'D', { signal: 'w31_gate' });
  m.fill(130, 0, 132, 16, '%'); m.put(131, 20, 'G', { signal: 'w31_gate' });   // torre da guarita até o céu
  m.fill(137, 12, 149, 12, '%');                              // marquise com morcegos
  m.put(141, 13, 'g'); m.put(147, 13, 'g');
  m.line(138, 148, 19, 'o', 2);
  m.put(145, 20, 'a');
  // --- G: abismo com pedras que desmoronam -----------------------------------
  pit(m, 152, 173, G);
  m.fill(158, 19, 159, 27, '%'); m.fill(165, 18, 166, 27, '%');
  m.fill(153, 20, 156, 20, 'C'); m.line(153, 156, 18);
  m.fill(160, 17, 163, 17, 'C'); m.line(160, 163, 15);
  m.fill(167, 16, 169, 16, 'C'); m.fill(171, 17, 172, 17, 'C'); m.line(167, 172, 14);
  m.put(162, 11, 'f'); m.put(150, 19, 'h'); m.put(149, 20, 'K');
  // --- H: rolhas refletidas, checkpoint e plataformas-relógio (★2) -----------
  m.sign(176, 20, 'w3_sign_reflect');
  m.put(183, 20, 'a');
  m.fill(186, 17, 189, 20, '%'); m.put(188, 16, 'a'); m.put(187, 16, 'h');
  m.put(192, 20, 'K');
  m.sign(194, 20, 'w3_sign_clock');
  pit(m, 196, 210, G);
  m.fill(202, 20, 204, 27, '%');
  clk(m, 197, 19, 3, 0); clk(m, 206, 19, 3, 1);
  clk(m, 199, 16, 2, 1); clk(m, 202, 13, 2, 0); clk(m, 205, 10, 2, 1);
  m.put(200, 15, 'o'); m.put(203, 12, 'o'); m.put(208, 8, '*');           // ★2 (rota alta)
  // --- segredo: rachadura no calçamento (parede falsa no chão) ---------------
  m.put(216, G, 'H'); m.put(217, G, 'H');
  m.clear(213, 22, 222, 24);
  m.line(214, 215, 24); m.put(218, 24, 'X'); m.put(220, 24, 'r'); m.put(221, 24, 'o');
  hide(m, 213, 22, 222, 24);
  // --- I: nicho costurado (★3) e saída ---------------------------------------
  m.fill(223, 18, 224, 20, '%');
  m.fill(226, 14, 232, 20, '%'); m.clear(227, 18, 231, 20); m.fill(226, 18, 226, 20, 'S');
  m.put(228, 20, 'o'); m.put(230, 20, '*');                   // ★3 (Descosturar)
  m.line(227, 231, 13);
  m.put(237, 20, 'b'); m.put(225, 20, 'K');
  m.fill(241, 19, 249, 20, '%'); m.fill(244, 17, 249, 18, '%');
  m.put(242, 18, 'o'); m.put(245, 16, 'o');
  m.put(247, 16, 'E');
  // fachadas ao fundo
  back(m, 8, 11, 14, 20); back(m, 19, 14, 25, 20); back(m, 32, 11, 42, 19); back(m, 55, 15, 59, 20);
  back(m, 86, 10, 94, 20); back(m, 102, 5, 105, 20); back(m, 110, 12, 128, 20); back(m, 137, 13, 149, 20);
  back(m, 174, 12, 185, 20); back(m, 233, 10, 240, 20);

  registerLevel({
    ...W3, id: 'w3_1', index: 1, name: 'Praça do Relógio Parado', subtitle: 'Mundo 3-1',
    music: 'w3_level', timeOfDay: 'dusk', parTime: 240, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w3_2 — Ruas Suspensas. Ilhas de rua flutuando sobre o vazio.
// =============================================================================
{
  const m = grid(260, 30);
  const I = (x0, x1, top, d = 4) => isle(m, x0, x1, top, d);
  const TW = (x0, x1, top) => isle(m, x0, x1, top, 30 - top, '%');   // torre que sobe do fundo da cidade
  // --- ilha 1: partida -------------------------------------------------------
  I(0, 16, 20, 10);
  m.put(3, 19, 'P'); m.sign(7, 19, 'w3_sign_rhythm'); m.line(9, 13, 17);
  // vão 1 e 2: escada de relógios
  clk(m, 18, 19, 2, 0); clk(m, 21, 18, 2, 1); m.line(18, 22, 16);
  I(23, 34, 18); m.put(30, 17, 'a'); m.line(26, 28, 15);
  clk(m, 36, 17, 2, 1); clk(m, 39, 16, 2, 0); m.arc(35, 14, 7, 2);
  I(41, 50, 16); m.put(47, 15, 'b');
  // vão 3: ponteiro gigante
  m.sign(44, 15, 'w3_sign_hand');
  m.put(54, 14, 'l', { len: 3, speed: 40 }); m.line(52, 56, 9, 'o', 2);
  // --- ilha 4: checkpoint ----------------------------------------------------
  I(58, 72, 19); m.put(60, 18, 'K'); m.put(68, 18, 'a');
  m.fill(63, 15, 66, 18, '%'); m.line(63, 65, 14); m.put(66, 14, 'e');
  // --- trecho 5: pilares, relógios e bolha lenta -----------------------------
  m.sign(71, 18, 'w3_sign_slow');
  clk(m, 74, 18, 2, 0, 2.4); clk(m, 77, 17, 2, 1, 2.4);
  TW(79, 81, 17); m.line(79, 81, 15);
  m.put(85, 13, 'q', { r: 3 });
  clk(m, 83, 15, 2, 0, 2.4); clk(m, 86, 14, 2, 1, 2.4); m.line(83, 87, 12, 'o', 2);
  TW(88, 90, 15);
  m.put(94, 10, 'f');
  clk(m, 92, 14, 2, 0, 2.4); clk(m, 95, 15, 2, 1, 2.4);
  I(97, 112, 17); m.put(104, 16, 'b'); m.put(99, 16, 'h'); m.line(99, 103, 14); m.put(101, 16, 'K');
  m.put(110, 9, 'v', { trigger: 'below' });
  // --- subida à ilha alta (Tique-Taque) --------------------------------------
  clk(m, 114, 14, 2, 1); TW(117, 119, 13); clk(m, 121, 11, 2, 0);
  I(124, 140, 9, 4);
  npc(m, 134, 8, 'tique_taque', 'w3_tique_2');
  m.line(128, 131, 8); m.put(126, 8, 'K');
  // ★1: gaiola pendurada embaixo da ilha alta (volta pelos relógios)
  m.plat(129, 132, 17); m.put(130, 16, '*'); m.put(129, 16, 'o'); m.put(132, 16, 'o');
  clk(m, 141, 13, 2, 0, 2.4); clk(m, 135, 15, 2, 1, 2.4);
  // --- trecho 8: ponteiros sobre o vazio -------------------------------------
  m.put(146, 11, 'l', { len: 3, speed: 40 });
  TW(148, 149, 14); m.line(148, 149, 12);
  m.put(153, 12, 'l', { len: 3, speed: -45, angle: 180 });
  TW(156, 157, 15); m.line(156, 157, 13);
  m.put(162, 11, 'l', { len: 3, step: 30, beat: 0.5, angle: 90 });
  m.arc(141, 8, 7, 2);
  // --- ilha 8: checkpoint 2 --------------------------------------------------
  I(164, 180, 14); m.put(168, 13, 'K'); m.put(170, 13, 'h'); m.put(176, 13, 'a'); m.line(170, 174, 11);
  // --- trecho 9: rua com relógios que despencam + prédio (segredo, ★2) -------
  I(184, 214, 19, 5);
  m.sign(185, 18, 'w3_sign_fast');
  m.put(187, 16, 's', { r: 2.5 });
  m.put(188, 12, 'v', { trigger: 'below' }); m.put(191, 12, 'v', { trigger: 'below' });
  m.line(186, 192, 17, 'o', 2);
  m.plat(192, 194, 15);
  m.fill(196, 12, 204, 18, '%');                              // prédio
  m.clear(198, 16, 203, 18); m.fill(204, 16, 204, 18, 'H');   // sala escondida (entra pela direita)
  m.put(198, 18, 'r'); m.put(200, 18, 'X'); m.line(201, 203, 18);
  hide(m, 198, 16, 203, 18);
  m.line(197, 203, 11, 'o', 2);
  m.put(206, 8, 'v', { trigger: 'below' });                   // Remendo → degrau p/ a coluna
  m.fill(208, 4, 210, 4, '%'); m.put(209, 3, '*');            // ★2 (terraço do sobrado de fundo)
  m.put(212, 18, 'b'); m.put(214, 18, 'K');
  // --- trecho 10: corrida final de relógios ----------------------------------
  clk(m, 216, 18, 2, 0, 2); clk(m, 219, 17, 2, 1, 2);
  TW(221, 222, 17);
  m.put(226, 14, 's', { r: 2 });
  clk(m, 224, 16, 2, 1, 2); clk(m, 227, 15, 2, 0, 2);
  TW(229, 230, 16);
  clk(m, 229, 11, 2, 0, 2.4); clk(m, 232, 8, 2, 1, 2.4); m.put(233, 5, '*');   // ★3
  m.put(235, 11, 'f');
  clk(m, 233, 17, 2, 1, 2);
  TW(237, 238, 18);
  clk(m, 241, 17, 2, 1, 2);
  m.line(216, 245, 13, 'o', 5);
  I(245, 259, 17, 13); m.put(250, 16, 'a'); m.put(255, 16, 'E');
  back(m, 2, 12, 12, 19); back(m, 26, 11, 32, 17); back(m, 186, 10, 194, 18); back(m, 208, 5, 210, 18); back(m, 249, 9, 258, 16);

  registerLevel({
    ...W3, id: 'w3_2', index: 2, name: 'Ruas Suspensas', subtitle: 'Mundo 3-2',
    music: 'w3_level', timeOfDay: 'day', parTime: 230, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
