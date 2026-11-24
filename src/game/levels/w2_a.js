// =============================================================================
// levels/w2_a.js — MUNDO 2 (Oceano das Lágrimas), fases 1 e 2.
//   w2_1 "Praia das Lágrimas" — praia → primeiro mergulho. Altar do Descosturar
//         (rede costurada 'S' + polvo de pote blindado 'd'), Capitã Bolha,
//         caranguejos, peixes de corda, barquinho, gruta e poça secretas.
//   w2_2 "Recife de Corais"   — fase com OXIGÊNIO: respiradouros, correntezas
//         (canal sob ouriços, elevador, correnteza com alavanca), campo de
//         águas-vivas, cavernas com bolsões de ar, cascatas para baixo.
// Montagem por código com grid() de w1_a.js. Este módulo também exporta os
// utilitários aquáticos usados por w2_b.js e w2_c.js.
// Observação: correntezas e blocos de água vão em `objects` (não no mapa), para
// a célula continuar sendo água '~' (o motor só herda água sob entidades com 2+
// vizinhos de água) e para o validador enxergar a rota nadando.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid } from './w1_a.js';

export { grid };

/** Água num retângulo. */
export const sea = (m, x0, y0, x1, y1) => m.fill(x0, y0, x1, y1, '~');

/** Correnteza (objeto w2_current) cobrindo w×h tiles a partir de (x,y). */
export function current(m, x, y, w, h, dir, strength = 320, extra = {}) {
  return m.obj({ type: 'w2_current', x, y, w, h, dir, strength, ...extra });
}

/** Bloco de água flutuante (objeto w2_water_block) w×h, deslocando dx/dy tiles. */
export function wblock(m, x, y, w, h, extra = {}) {
  return m.obj({ type: 'w2_water_block', x, y, w, h, speed: 26, pause: 1, ...extra });
}

/** Marujo de borracha da Capitã Bolha (missão 'bolha_crew': 3 entre w2_3 e w2_5). */
export function marujo(m, x, y) {
  return m.obj({ type: 'quest_item', x, y, quest: 'bolha_crew', item: 'Marujo de borracha', sprite: 'marujo', need: 3 });
}

// =============================================================================
// w2_1 — Praia das Lágrimas. Areia/superfície do mar na linha 18 (Tico em pé na 17).
// =============================================================================
{
  const m = grid(240, 30);
  m.ground(0, 60, 18);
  // --- A: praia, garrafa, duna, primeiro caranguejo ----------------------------
  m.put(3, 17, 'P');
  m.sign(6, 17, 'w2_sign_beach');
  m.put(9, 17, 'u', { dialog: 'w2_bottle_1' });
  m.line(11, 14, 16);
  m.fill(16, 16, 21, 17, '#'); m.fill(17, 15, 20, 15, '#');   // duna
  m.line(17, 20, 14);
  m.sign(23, 17, 'w2_sign_crab');
  m.plat(25, 28, 14); m.line(25, 28, 13);
  m.put(28, 17, 'g');
  // --- B: altar do Descosturar + arco de pedra com rede costurada --------------
  m.sign(31, 17, 'w2_sign_unstitch');
  m.put(34, 17, 'Q', { ability: 'unstitch' });
  m.put(36, 17, 'e');
  m.fill(39, 6, 47, 17, '#'); m.clear(39, 14, 47, 17);        // arco
  m.fill(39, 14, 40, 17, 'S');                                  // rede costurada
  m.line(42, 46, 17, 'o', 2);
  m.put(41, 5, '*'); m.line(44, 46, 5);                        // ★1 no topo do arco
  m.plat(49, 51, 14); m.put(50, 13, 'o');
  m.plat(52, 54, 10); m.put(53, 9, 'o');
  m.sign(49, 17, 'w2_sign_armor');
  m.put(53, 17, 'd');                                           // polvo blindado
  m.put(57, 17, 'K');
  m.sign(59, 17, 'w2_sign_swim');
  // --- C: primeiro mergulho + Capitã Bolha ------------------------------------
  m.fill(61, 18, 205, 29, '~');
  m.ground(61, 76, 23);
  m.ground(77, 205, 28);
  m.put(62, 18, 'n', { npc: 'capita_bolha', dialog: 'w2_bolha_1' });
  m.line(65, 68, 20);
  m.fill(70, 22, 71, 22, '^');
  m.put(72, 20, 'a');
  m.line(73, 75, 22);
  m.put(78, 20, 'o'); m.put(79, 22, 'o'); m.put(80, 24, 'o'); m.put(81, 26, 'o');
  m.put(82, 23, 'a');
  m.fill(84, 16, 88, 27, '#');                                  // ilhota
  m.put(85, 15, 'o'); m.put(86, 14, 'h'); m.put(87, 15, 'o');
  m.fill(90, 27, 91, 27, '^');
  // recife com gruta escondida (parede falsa do lado esquerdo) — segredo 1
  m.fill(95, 20, 108, 27, '#');
  m.fill(97, 21, 106, 26, '~');
  m.fill(95, 23, 96, 26, 'H');
  m.line(91, 93, 24);
  m.put(98, 26, 'X'); m.line(99, 102, 23); m.put(104, 26, 'r'); m.put(105, 22, 'e');
  m.put(89, 21, 'b');                                           // água-viva antes do recife
  // --- D: píer, barquinho e o mastro do ★2 -------------------------------------
  for (const x of [111, 116, 121]) m.fill(x, 17, x, 27, '%');
  m.plat(110, 122, 16); m.line(112, 120, 15, 'o', 2);
  m.put(114, 24, 'a');
  m.put(124, 17, 'p', { dx: 14, w: 3, speed: 24, pause: 0.8 });
  m.line(126, 138, 14, 'o', 2);
  m.line(127, 139, 26, 'o', 4);
  m.put(131, 23, 'a');
  m.plat(134, 137, 11); m.put(136, 10, '*');                   // ★2 nos destroços suspensos
  m.put(135, 10, 'o');
  for (const x of [143, 148, 153]) m.fill(x, 17, x, 27, '%');
  m.plat(142, 154, 16);
  m.put(146, 15, 'g'); m.put(151, 15, 'K'); m.put(154, 15, 'e');
  // --- E: rochedo — túnel submerso com rede costurada --------------------------
  m.fill(158, 3, 174, 21, '#');
  m.line(159, 163, 25, 'o', 2);
  m.fill(166, 22, 166, 27, 'S');                                // rede (1 coluna, dentro d'água)
  m.put(171, 23, 'a');
  m.line(168, 173, 25, 'o', 2);
  m.put(172, 27, 'c', { contents: 'buttons:8' });
  // --- F: mar aberto, subida para a praia final --------------------------------
  m.put(180, 22, 'b');
  m.line(177, 183, 19, 'o', 3);
  m.fill(186, 17, 189, 27, '#'); m.put(187, 16, 'o'); m.put(188, 16, 'o');
  m.put(193, 24, 'a');
  m.ground(197, 201, 25); m.ground(202, 205, 22);
  m.ground(206, 239, 18);
  m.put(208, 17, 'K');
  // poça de maré com gruta atrás da parede falsa — segredo 2 (★3)
  m.fill(211, 18, 216, 22, '~');
  m.line(212, 215, 22, 'o', 3);
  m.fill(217, 20, 218, 22, 'H');
  m.fill(219, 19, 225, 22, '~');
  m.put(220, 22, 'X'); m.line(221, 223, 20); m.put(224, 21, '*');
  m.put(222, 17, 'g');
  m.fill(229, 16, 239, 17, '#'); m.fill(233, 14, 239, 15, '#');
  m.put(228, 17, 'o'); m.put(231, 15, 'o'); m.put(234, 13, 'o');
  m.put(237, 13, 'E');

  registerLevel({
    id: 'w2_1', world: 2, index: 1, name: 'Praia das Lágrimas', subtitle: 'Mundo 2-1',
    music: 'w2_calm', tileset: 'w2', background: 'w2', timeOfDay: 'day', parTime: 200,
    darkness: 0, ambient: 'w2_bubbles', oxygen: false,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w2_2 — Recife de Corais (oxigênio). Superfície do mar na linha 9.
// =============================================================================
{
  const m = grid(260, 34);
  m.ground(0, 12, 9);
  m.fill(13, 9, 259, 33, '~');
  // --- A: topo do recife e primeiro respiradouro --------------------------------
  m.put(2, 8, 'P');
  m.sign(5, 8, 'w2_sign_oxygen');
  m.line(8, 11, 7);
  m.ground(13, 36, 21);
  m.plat(16, 19, 13); m.line(16, 19, 12);
  m.plat(23, 26, 16); m.line(23, 26, 15);
  m.put(20, 20, 'l');
  m.put(25, 11, 'a');
  m.fill(27, 20, 30, 20, '^');
  m.fill(32, 8, 36, 20, '#');                                   // ilhota de respiro
  m.sign(33, 7, 'w2_sign_current'); m.line(35, 36, 7);
  // --- B: canal da correnteza sob o paredão de ouriços --------------------------
  m.ground(37, 76, 25);
  m.fill(40, 5, 70, 15, '#'); m.fill(40, 4, 70, 4, '^');
  current(m, 41, 17, 29, 5, 'r', 300);
  m.fill(46, 24, 49, 24, '^'); m.fill(56, 24, 59, 24, '^'); m.fill(64, 24, 66, 24, '^');
  m.fill(51, 16, 53, 16, '^'); m.fill(61, 16, 62, 16, '^');
  m.line(43, 68, 19, 'o', 3);
  m.put(52, 24, 'l');
  m.fill(73, 8, 76, 24, '#'); m.line(73, 76, 7, 'o', 3);
  // --- C: bacia das águas-vivas + elevador de correnteza ------------------------
  m.ground(77, 112, 30);
  m.put(82, 14, 'b'); m.put(88, 21, 'b'); m.put(94, 13, 'b'); m.put(100, 22, 'b');
  m.put(90, 27, 'a'); m.put(103, 17, 'a');
  m.fill(83, 29, 85, 29, '^'); m.fill(96, 29, 98, 29, '^');
  m.put(91, 29, '*');                                           // ★1 no fundo da bacia
  m.line(86, 89, 28); m.put(93, 29, 'l');
  current(m, 106, 11, 3, 18, 'u', 380);
  m.line(107, 107, 14); m.put(107, 18, 'o'); m.put(107, 22, 'o'); m.put(107, 26, 'o');
  m.fill(110, 8, 114, 21, '#');                                 // saliência do paredão
  m.put(112, 7, 'K'); m.sign(113, 7, 'w2_sign_lever');
  // --- D: paredão do recife — cavernas com bolsões de ar e alavanca -------------
  m.ground(115, 152, 0);
  m.fill(115, 22, 124, 27, '~');                                // túnel 1
  m.put(120, 27, 'l'); m.line(116, 123, 24, 'o', 2);
  m.fill(125, 13, 134, 17, ':'); m.fill(125, 18, 134, 27, '~'); // câmara 1 (bolsão de ar)
  m.plat(127, 132, 15);
  m.put(130, 14, 'L', { signal: 'w22_lever', latch: true });
  m.put(127, 14, 'o'); m.put(128, 14, 'o');
  m.put(129, 25, 'a');
  m.fill(135, 22, 144, 27, '~');                                // túnel 2 (correnteza com sinal)
  current(m, 135, 22, 10, 6, 'l', 620, { signal: 'w22_lever', invert: true });
  m.line(136, 143, 25, 'o', 2);
  m.fill(145, 6, 150, 9, ':'); m.fill(145, 10, 150, 27, '~');  // câmara 2 (poço + bolsão)
  m.fill(151, 10, 152, 14, '~');
  m.plat(146, 149, 8); m.put(148, 7, '*');                     // ★2 no bolsão de cima
  m.put(147, 7, 'o'); m.put(149, 7, 'o');
  m.put(147, 19, 'b'); m.put(150, 26, 'l');
  // --- E: labirinto de corais + gruta secreta ---------------------------------
  m.ground(153, 200, 28);
  m.fill(158, 21, 163, 27, '#'); m.fill(158, 20, 163, 20, '^');
  m.plat(166, 170, 14); m.line(166, 170, 13, 'o', 2);
  m.plat(176, 180, 18); m.line(176, 180, 17, 'o', 2);
  m.put(168, 22, 'a'); m.put(185, 15, 'a'); m.put(172, 27, 'g');
  m.put(175, 27, 'l');
  m.line(155, 163, 17, 'o', 2);
  m.fill(186, 22, 199, 27, '#');                                // coral com gruta (segredo)
  m.fill(188, 23, 197, 26, '~');
  m.fill(186, 24, 187, 26, 'H');
  m.put(183, 25, 'o'); m.put(184, 26, 'o');
  m.put(189, 26, 'X'); m.line(190, 193, 24); m.put(195, 26, 'r'); m.put(196, 23, 'h');
  m.put(190, 18, 'b');
  m.fill(201, 8, 205, 27, '#'); m.put(203, 7, 'K');
  // --- F: cascatas para baixo sobre ouriços e a praia final --------------------
  m.ground(206, 259, 28);
  current(m, 210, 10, 4, 15, 'd', 250);
  m.fill(209, 27, 214, 27, '^');
  m.line(211, 212, 12); m.line(211, 212, 16);
  m.put(218, 18, 'b');
  m.fill(219, 22, 220, 27, '#'); m.put(219, 21, 'l');
  current(m, 223, 10, 5, 15, 'd', 270);
  m.fill(222, 27, 224, 27, '^'); m.put(225, 27, '*'); m.fill(226, 27, 228, 27, '^'); // ★3
  m.line(224, 226, 13);
  m.put(232, 20, 'b'); m.put(238, 14, 'a');
  m.line(232, 240, 11, 'o', 2);
  m.fill(240, 24, 244, 27, '#'); m.put(242, 23, 'l');
  m.ground(246, 259, 9);
  m.line(247, 252, 7, 'o', 2); m.put(250, 8, 'g');
  m.put(256, 8, 'E');

  registerLevel({
    id: 'w2_2', world: 2, index: 2, name: 'Recife de Corais', subtitle: 'Mundo 2-2',
    music: 'w2_level', tileset: 'w2', background: 'w2', timeOfDay: 'dusk', parTime: 230,
    darkness: 0, ambient: 'w2_plankton', oxygen: true, oxygenTime: 18,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
