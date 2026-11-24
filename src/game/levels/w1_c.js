// =============================================================================
// levels/w1_c.js — MUNDO 1 (Floresta dos Brinquedos Perdidos), fase 5 e bônus.
//   w1_5 "Névoa do Coelho" (noite) — loja da Agulheta, aviso do Sr. Botão,
//         brinquedos sem rosto (placas), abismo real com toca por baixo, ilhó no
//         alto da árvore abrindo o portão de espinhos, ilhós + inimigos sobre vãos
//         e a copa morta opcional (fios em rampa) com a memória mem_1 escondida.
//   w1_bonus "Desafio do Carretel" — espinhos, corrente de molas, corrente de
//         ilhós (2 pontes), torre de molas e passarela alta até o fio antigo (T).
// Mapas montados com grid()/burrow() de w1_a.js.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, burrow } from './w1_a.js';

// =============================================================================
// w1_5 — Névoa do Coelho. Chão na linha 22 (Tico em pé na 21).
// =============================================================================
{
  const m = grid(280, 32);
  m.ground(0, 52, 22);
  // --- A: loja, primeiro brinquedo sem rosto, Sr. Botão ------------------------
  m.put(3, 21, 'P');
  m.sign(7, 21, 'w1_sign_fog');
  m.put(13, 21, 'U');
  m.line(18, 22, 20);
  m.fill(26, 20, 27, 21, '%'); m.line(26, 27, 18);
  m.sign(30, 21, 'w1_sign_faceless1');
  m.plat(33, 36, 18); m.line(33, 36, 17);
  m.put(42, 21, 'n', { npc: 'botao', dialog: 'w1_botao_3' });
  // --- B: vãos com ilhós, abismo de verdade com toca por baixo -----------------
  m.put(52, 21, '@', { group: 'b1' }); m.put(58, 21, '@', { group: 'b1' });
  m.put(54, 20, '*');                                           // ★1 (fácil)
  m.arc(53, 18, 5, 1);
  m.put(56, 14, 'g');
  m.ground(58, 78, 22);
  m.put(65, 21, 'b');
  m.plat(68, 71, 18); m.line(68, 71, 17);
  m.ground(79, 86, 28); m.fill(79, 27, 86, 27, '^');
  m.ground(87, 279, 22);
  burrow(m, { nx: 73, fx: 91, top: 22, floor: 31, signal: 'toca5' });
  m.sign(76, 21, 'w1_sign_anchors');
  m.put(78, 21, '@', { group: 'n1', signal: 'toca5', latch: true }); m.put(87, 21, '@', { group: 'n1' });
  m.arc(79, 19, 8, 1);
  m.put(82, 30, 'X'); m.put(85, 30, 'h');                       // segredo 1 (toca)
  m.put(97, 21, 'K');
  m.sign(101, 21, 'w1_sign_faceless2');
  m.line(104, 108, 20);
  m.put(112, 21, 'f');
  m.fill(118, 20, 119, 21, '%');                                // tora: o ursinho bate e fica tonto
  // --- C: árvore com ilhó alto que abre o portão de espinhos -------------------
  m.plat(124, 126, 19); m.put(125, 18, 'o');
  m.plat(129, 131, 16); m.put(130, 15, 'o');
  m.plat(124, 127, 13); m.put(127, 12, '@', { group: 'v1' });
  m.plat(135, 139, 11); m.put(136, 10, '@', { group: 'v1', signal: 'nevoa1', latch: true });
  m.line(137, 139, 9); m.put(138, 10, 'O'); m.put(139, 10, '*');  // ★2 (galho do outro lado)
  m.put(131, 7, 'g');
  m.sign(145, 21, 'w1_sign_gate2');
  m.fill(150, 8, 161, 21, '%'); m.clear(150, 19, 161, 21);
  m.put(150, 21, 'G', { signal: 'nevoa1' });
  m.line(152, 160, 21, 'o', 2);
  // --- D: ilhós + inimigos sobre vãos -----------------------------------------
  m.put(166, 21, 'K');
  m.clear(172, 22, 176, 31);
  m.put(171, 21, '@', { group: 'd3' }); m.put(177, 21, '@', { group: 'd3' });
  m.arc(172, 19, 5, 2); m.put(174, 14, 'g');
  m.put(180, 21, 'd');
  m.clear(182, 22, 185, 31);
  m.ground(186, 200, 20);
  m.put(181, 21, '@', { group: 'd4' }); m.put(186, 19, '@', { group: 'd4' });
  m.put(193, 19, 'b'); m.line(188, 191, 18); m.line(195, 199, 18);
  // copa morta opcional: fios em rampa → ilha com parede falsa (★3 + memória)
  m.fill(207, 6, 207, 21, ':');
  m.put(203, 21, '@', { group: 't1' });
  m.plat(210, 214, 16); m.put(210, 15, '@', { group: 't1' }); m.put(214, 15, '@', { group: 't2' });
  m.plat(221, 226, 11); m.put(221, 10, '@', { group: 't2' }); m.line(222, 226, 10);
  m.fill(227, 6, 234, 11, '#'); m.fill(227, 9, 228, 10, 'H'); m.clear(229, 8, 233, 10);
  m.put(229, 10, 'X'); m.put(230, 10, '*'); m.put(232, 10, 'M', { memory: 'mem_1' }); m.line(230, 232, 8);
  m.put(216, 5, 'g');
  // --- E: reta final ------------------------------------------------------------
  m.put(240, 21, 'K');
  m.put(244, 21, 'B'); m.put(245, 21, 'B'); m.put(244, 20, 'B'); m.put(245, 20, 'B', { contents: 'patch' });
  m.put(249, 19, 'e');
  m.put(253, 21, 'f');
  m.sign(258, 21, 'w1_sign_faceless3');
  m.fill(262, 19, 263, 21, '%'); m.line(262, 263, 18);
  m.line(266, 271, 20);
  m.put(275, 21, 'E');

  registerLevel({
    id: 'w1_5', world: 1, index: 5, name: 'Névoa do Coelho', subtitle: 'Mundo 1-5',
    music: 'w1_level', tileset: 'w1', background: 'w1', timeOfDay: 'night', parTime: 230,
    darkness: 0.22, ambient: 'w1_spores', oxygen: false,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w1_bonus — Desafio do Carretel. Chão na linha 26 (Tico em pé na 25).
// =============================================================================
{
  const m = grid(180, 30);
  m.ground(0, 40, 26);
  // --- sala 1: pulinhos entre espinhos + primeira mola ------------------------
  m.put(2, 25, 'P');
  m.sign(5, 25, 'w1_sign_bonus');
  m.fill(9, 25, 11, 25, '^'); m.arc(9, 23, 3, 1);
  m.fill(14, 25, 16, 25, '^'); m.arc(14, 23, 3, 1);
  m.fill(17, 24, 18, 25, '%'); m.line(17, 18, 22);
  m.fill(19, 25, 22, 25, '^'); m.arc(19, 22, 4, 2);
  m.fill(26, 25, 28, 25, '^'); m.arc(26, 23, 3, 1);
  m.sign(31, 25, 'w1_sign_spring');
  m.put(34, 25, 'J');
  m.plat(35, 40, 18); m.line(35, 37, 17); m.put(39, 17, '*');  // ★1
  // --- sala 2: corrente de molas sobre espinhos --------------------------------
  m.ground(41, 76, 26); m.fill(44, 25, 76, 25, '^');
  for (const x of [43, 49, 55, 61, 67, 73]) { m.put(x, 25, 'J'); if (x < 73) m.arc(x + 1, 20, 5, 3); }
  m.put(58, 16, '*');                                           // ★2 (no ápice do salto)
  m.ground(77, 90, 22);
  m.put(80, 21, 'K');
  // --- sala 3: corrente de ilhós (2 pontes) ou molas no fosso -----------------
  m.ground(91, 104, 27); m.fill(91, 26, 104, 26, '^');
  m.put(96, 26, 'J'); m.put(102, 26, 'J');
  m.put(90, 21, '@'); m.fill(99, 20, 100, 20, '%'); m.put(99, 19, '@'); m.put(108, 21, '@');
  m.arc(91, 19, 8, 1);
  m.ground(105, 123, 22);
  // --- sala 4: torre de molas -----------------------------------------------------
  m.put(111, 21, 'J'); m.fill(112, 21, 115, 21, '^');
  m.plat(113, 117, 14); m.line(113, 115, 13);
  m.put(116, 13, 'J');
  m.plat(118, 123, 7); m.line(119, 122, 6);
  m.line(111, 111, 16); m.line(111, 111, 18);
  // --- sala 5: passarela alta, fosso com ilhós, ilha da ★3, fio antigo -----------
  m.ground(124, 179, 8);
  m.put(126, 7, 'K');
  m.fill(130, 7, 132, 7, '^'); m.arc(130, 5, 3, 1);
  m.clear(137, 8, 141, 11); m.fill(137, 12, 141, 12, '^');
  m.put(136, 7, '@', { group: 'w' }); m.put(142, 7, '@', { group: 'w' });
  m.arc(137, 5, 5, 1);
  m.fill(149, 7, 151, 7, '^');
  m.put(146, 7, '@', { group: 'i' });
  m.plat(152, 157, 4, '#'); m.put(153, 3, '@', { group: 'i' }); m.line(154, 155, 3); m.put(157, 3, '*'); // ★3
  m.line(160, 166, 6);
  m.fill(169, 7, 171, 7, '%');
  m.put(170, 6, 'T');
  m.put(176, 7, 'E');

  registerLevel({
    id: 'w1_bonus', world: 1, index: 7, name: 'Desafio do Carretel', subtitle: 'Mundo 1 - Bônus',
    music: 'w1_level', tileset: 'w1', background: 'w1', timeOfDay: 'dusk', parTime: 150,
    darkness: 0, ambient: 'w1_fireflies', oxygen: false, bonus: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
