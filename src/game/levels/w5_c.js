// =============================================================================
// levels/w5_c.js — MUNDO 5 (O Coração da Dimensão), fase 5 e bônus.
//   w5_5 "A Costura do Céu" — a mais difícil: ilhas no céu usando TUDO (fases A/B,
//         portais, tirolesas, correntes, ilhas à deriva, ruínas, barreiras de fio,
//         ilhós, costuras). Eco (w5_tecela_3), Agulheta (U) e a memória 'mem_9'
//         escondida numa torre de retalhos.
//   w5_bonus "O Último Fio" — desafio final; memória 'mem_10' e fio antigo.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, hide, isle, npc, W5, rect, threadDoor } from './w5_a.js';

// =============================================================================
// w5_5 — A Costura do Céu.
// =============================================================================
{
  const m = grid(280, 30);
  const I = (x0, x1, top, d = 5) => isle(m, x0, x1, top, d);
  // --- I1: Eco + Agulheta ------------------------------------------------------
  I(0, 20, 20, 10); m.put(3, 19, 'P'); npc(m, 9, 19, 'tecela', 'w5_tecela_3'); m.put(16, 19, 'U');
  m.line(12, 14, 17); m.put(20, 19, 'h');
  // --- I2: cristal + muralha vermelha -------------------------------------------
  I(27, 40, 18); m.put(29, 17, 'l'); rect(m, 34, 10, 35, 17, 'm'); m.line(36, 40, 15);
  rect(m, 42, 17, 44, 17, 'p'); m.put(43, 14, 'g');
  I(47, 60, 16); m.put(55, 15, 'a'); m.put(52, 10, 'g');
  m.put(59, 15, 'j', { pair: 'w55a' });
  m.fill(64, 7, 69, 7, '%'); m.put(65, 6, 'j', { pair: 'w55a' }); m.put(68, 6, '*');   // ★1
  // --- I4: checkpoint, corrente ascendente ---------------------------------------
  I(67, 80, 19); m.put(69, 18, 'K'); m.put(71, 18, 'h'); m.line(73, 79, 17, 'o', 2);
  rect(m, 82, 8, 83, 24, 'w'); I(84, 85, 15, 2);
  I(86, 98, 10); m.put(87, 9, 'v'); m.put(89, 9, 'v'); threadDoor(m, 93, 93, 2, 6, 9);
  m.put(96, 5, 'b'); m.line(94, 98, 8);
  m.put(99, 7, 'q', { dx: 7, dy: 5 });
  I(105, 118, 14); m.put(112, 13, 'd'); m.put(108, 9, 'g'); m.line(106, 117, 12, 'o', 3);
  m.put(121, 13, 's', { w: 3, ay: 1.5, period: 3.5 });
  // --- I7: torre de retalhos com a memória (segredo) ------------------------------
  I(125, 140, 17); m.plat(127, 128, 13);
  m.fill(130, 10, 137, 16, '%'); m.fill(137, 14, 137, 16, 'H');
  m.put(132, 16, 'X'); m.put(134, 16, 'M', { memory: 'mem_9' }); m.put(135, 16, 'r'); m.put(131, 16, 'o'); m.put(133, 14, 'e');
  hide(m, 131, 13, 136, 16);
  m.line(130, 136, 9, 'o', 2); m.put(139, 16, 'a');
  m.put(143, 14, 's', { w: 2, ax: 1, period: 3 });
  // --- I8: checkpoint 2, duplo cristal ------------------------------------------
  I(147, 160, 15); m.put(149, 14, 'K'); m.put(151, 14, 'h'); m.put(156, 14, 'f');
  m.put(158, 14, 'l'); rect(m, 161, 16, 163, 16, 'p'); rect(m, 164, 16, 166, 16, 'm');
  I(167, 180, 17); m.put(171, 16, 'l'); rect(m, 174, 9, 175, 16, 'm'); m.put(178, 16, 'a');
  m.line(161, 166, 13);
  // --- I10: ruínas que caem --------------------------------------------------------
  I(187, 200, 15); m.put(192, 9, 'g'); m.put(197, 9, 'g'); m.line(188, 199, 13, 'o', 3);
  m.fill(201, 15, 206, 15, 'u');
  m.put(183, 14, 's', { w: 2, ay: 1, period: 3 });
  // --- I11: barreira + plataformas no ar (★2) -------------------------------------
  I(207, 220, 15); m.put(209, 14, 'v'); m.put(211, 14, 'v');
  threadDoor(m, 216, 216, 3, 11, 14); m.put(214, 4, '*');      // ★2
  m.put(219, 14, 'd');
  m.put(223, 15, 's', { w: 3, ay: 1, period: 3.5 });
  // --- I12: checkpoint 3, ilhós + portal --------------------------------------------
  I(227, 240, 18); m.put(229, 17, 'K'); m.put(231, 17, 'h');
  m.put(233, 17, 'S'); m.put(233, 16, 'S'); m.put(233, 15, 'S'); m.fill(233, 8, 233, 14, '%');
  m.put(236, 17, 'j', { pair: 'w55b' });
  I(243, 244, 14, 2); m.put(241, 12, '@', { group: 'w55' }); m.put(246, 7, '@', { group: 'w55' });
  I(247, 258, 10); m.put(249, 9, 'j', { pair: 'w55b' }); m.put(254, 6, 'b'); m.put(256, 9, 'a');
  m.line(248, 257, 7, 'o', 3);
  // --- I14: saída --------------------------------------------------------------------
  I(265, 279, 14, 16); m.put(270, 13, 'd'); m.put(276, 13, 'E'); m.line(266, 269, 11);
  rect(m, 261, 4, 262, 12, 'w'); m.put(263, 3, '*');         // ★3 (corrente sobre o vão)

  registerLevel({
    ...W5, id: 'w5_5', index: 5, name: 'A Costura do Céu', subtitle: 'Mundo 5-5',
    music: 'w5_level', timeOfDay: 'night', parTime: 280, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w5_bonus — O Último Fio.
// =============================================================================
{
  const m = grid(220, 24);
  const B = (x0, x1, top) => isle(m, x0, x1, top, 24 - top, '#');
  B(0, 12, 18); m.put(2, 17, 'P'); m.sign(5, 17, 'w5_sign_bonus');
  m.put(14, 14, 'q', { dx: 6, dy: 2 });
  B(19, 30, 16); m.put(24, 15, 'l'); rect(m, 27, 9, 28, 15, 'm'); m.line(20, 23, 14);
  rect(m, 32, 15, 35, 15, 'p');
  B(37, 46, 17); m.put(42, 16, 'a'); m.put(44, 11, 'g');
  m.put(49, 14, 's', { w: 3, ay: 1.5, period: 3 }); m.put(49, 8, '*');   // ★1
  B(53, 62, 15); m.put(55, 14, 'v'); m.put(57, 14, 'v'); threadDoor(m, 60, 60, 3, 11, 14);
  B(69, 80, 17); m.put(70, 16, 'K'); m.put(72, 16, 'h'); m.line(73, 79, 14, 'o', 2);
  rect(m, 82, 6, 83, 20, 'w'); B(84, 85, 13); m.put(84, 4, '*');          // ★2
  B(87, 96, 15); m.put(92, 14, 'f');
  m.fill(97, 15, 102, 15, 'u');
  B(103, 112, 15); m.put(107, 10, 'b'); m.line(104, 111, 13, 'o', 2);
  m.put(113, 11, 'q', { dx: 8, dy: 4 });
  B(119, 130, 16); m.put(121, 15, 'j', { pair: 'wbx' }); m.put(126, 15, 'd');
  B(137, 148, 18); m.put(139, 17, 'l'); rect(m, 143, 12, 144, 17, 'p'); m.line(145, 148, 16);
  m.fill(150, 3, 154, 3, '%'); m.put(151, 2, 'j', { pair: 'wbx' }); m.put(153, 2, '*');   // ★3
  B(155, 166, 16); m.put(160, 11, 'g'); m.put(164, 15, 'a');
  m.put(169, 13, 's', { w: 3, ax: 1.5, period: 3.5 });
  B(173, 184, 17); m.put(178, 16, 'b'); m.line(174, 183, 14, 'o', 3);
  B(191, 219, 15); m.put(194, 14, 'h');
  m.put(204, 14, 'M', { memory: 'mem_10' }); m.put(208, 14, 'T'); m.line(198, 202, 12);
  m.put(215, 14, 'E');

  registerLevel({
    ...W5, id: 'w5_bonus', index: 7, name: 'O Último Fio', subtitle: 'Mundo 5 - Bônus',
    music: 'w5_calm', timeOfDay: 'dusk', parTime: 130, darkness: 0, bonus: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
