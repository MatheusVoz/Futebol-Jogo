// =============================================================================
// levels/w3_c.js — MUNDO 3 (Cidade dos Relógios Quebrados), fase 5 e bônus.
//   w3_5 "Telhados do Tempo" — telhados sobre o vazio: portões do compasso (u),
//         pêndulos (p) em vigas, bolha lenta abrindo o portão por mais tempo,
//         escada de blocos que desmoronam (★), loja da Agulheta e a memória
//         'mem_5' escondida numa chaminé.
//   w3_bonus "Corrida Contra o Ponteiro" — desafio rápido: relógios de ciclo
//         curto, bolhas rápidas, portões apertados, serras; fio antigo no fim.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, W3, back, clk, hide, isle } from './w3_a.js';

// =============================================================================
// w3_5 — Telhados do Tempo.
// =============================================================================
{
  const m = grid(280, 30);
  const R = (x0, x1, top) => isle(m, x0, x1, top, 30 - top, '#');
  // --- R1: largada + Agulheta ------------------------------------------------
  R(0, 22, 20);
  m.put(3, 19, 'P'); m.sign(7, 19, 'w3_sign_roofs'); m.put(14, 19, 'U'); m.line(17, 21, 17);
  clk(m, 24, 19, 2, 0); m.arc(23, 16, 6, 2);
  // --- R2: primeiro portão do compasso ----------------------------------------
  R(29, 48, 18);
  m.sign(33, 17, 'w3_sign_gate');
  m.fill(38, 0, 39, 14, '%'); m.put(38, 17, 'u', { open: 1.8, closed: 2.2 }); m.put(39, 17, 'u', { open: 1.8, closed: 2.2 });
  m.put(44, 17, 'a'); m.line(41, 47, 15, 'o', 2);
  clk(m, 50, 18, 2, 1);
  // --- R3: pêndulos na viga ----------------------------------------------------
  R(55, 70, 19);
  m.sign(57, 18, 'w3_sign_pendulum');
  m.fill(58, 8, 69, 8, '%'); back(m, 58, 9, 58, 18); back(m, 69, 9, 69, 18);   // pórtico (pilares ao fundo)
  m.put(61, 9, 'p', { len: 8, amp: 45, period: 2.8 }); m.put(66, 9, 'p', { len: 8, amp: 45, period: 2.8, phase: 0.5 });
  m.line(60, 68, 16, 'o', 2); m.put(69, 18, 'b');
  clk(m, 72, 18, 2, 0);
  // --- R4: checkpoint, relógios que despencam ---------------------------------
  R(77, 95, 17);
  m.put(79, 16, 'K'); m.put(81, 16, 'h');
  m.put(86, 10, 'v', { trigger: 'below' }); m.put(90, 10, 'v', { trigger: 'below' });
  m.fill(91, 10, 95, 11, '%'); m.put(93, 12, 'g'); back(m, 91, 12, 95, 16);
  m.line(84, 92, 15, 'o', 2);
  clk(m, 97, 16, 2, 1);
  // --- R5: dois portões fora de compasso ---------------------------------------
  R(102, 120, 15); m.put(104, 14, 'K');
  m.fill(108, 0, 108, 11, '%'); m.put(108, 14, 'u', { open: 1.5, closed: 2, offset: 0 });
  m.fill(114, 0, 114, 11, '%'); m.put(114, 14, 'u', { open: 1.5, closed: 2, offset: 1.2 });
  m.line(109, 113, 13); m.put(118, 14, 'a');
  clk(m, 122, 16, 2, 0);
  // --- R6: chaminé com a memória escondida (segredo) + ponteiro (★1) ----------
  R(127, 150, 18);
  m.put(129, 17, 'b');
  m.plat(131, 133, 14);
  m.fill(135, 10, 142, 17, '%'); m.fill(135, 15, 135, 17, 'H');
  m.put(137, 17, 'X'); m.put(139, 17, 'M', { memory: 'mem_5' }); m.put(140, 17, 'o'); m.put(141, 17, 'r'); m.put(138, 15, 'e');
  hide(m, 136, 14, 141, 17);
  m.line(136, 141, 9, 'o', 2);
  m.put(146, 9, 'l', { len: 3, speed: 40 });
  m.fill(148, 4, 150, 4, '%'); m.put(149, 3, '*'); back(m, 148, 5, 150, 17);   // ★1 (terraço)
  clk(m, 152, 17, 2, 1);
  // --- R7: checkpoint + corredor de pêndulos -----------------------------------
  R(157, 175, 16);
  m.put(159, 15, 'K'); m.put(161, 15, 'h');
  m.fill(163, 5, 175, 5, '%'); back(m, 163, 6, 163, 15); back(m, 175, 6, 175, 15);
  m.put(166, 6, 'p', { len: 9, amp: 45, period: 2.6 }); m.put(171, 6, 'p', { len: 9, amp: 45, period: 2.6, phase: 0.5 });
  m.line(164, 174, 13, 'o', 2); m.put(174, 15, 'a');
  // ★2: escada de blocos que desmoronam sobre o vão (Remendo se cair)
  m.put(177, 13, 'C'); m.put(179, 10, 'C'); m.put(181, 7, 'C'); m.put(183, 4, '*');   // ★2
  // --- R8: bolha lenta segura o portão aberto ---------------------------------
  R(182, 200, 19);
  m.sign(184, 18, 'w3_sign_slow'); m.put(186, 18, 'K');
  m.put(187, 14, 'f');
  m.put(192, 17, 'q', { r: 3 });
  m.fill(194, 0, 195, 15, '%'); m.put(194, 18, 'u', { open: 0.9, closed: 2.4 }); m.put(195, 18, 'u', { open: 0.9, closed: 2.4 });
  m.line(196, 200, 16); clk(m, 202, 18, 2, 0);
  // --- R9: robôs + ponteiro (★3) -----------------------------------------------
  R(207, 230, 17);
  m.put(215, 16, 'd'); m.put(209, 16, 'K'); m.put(222, 16, 'b'); m.line(210, 220, 14, 'o', 2);
  m.put(226, 10, 'l', { len: 3, speed: -40 });
  m.fill(228, 4, 230, 4, '%'); m.put(229, 3, '*'); back(m, 228, 5, 230, 16);   // ★3 (terraço)
  clk(m, 232, 17, 2, 1);
  // --- R10: checkpoint 3, pêndulo final -----------------------------------------
  R(237, 250, 18);
  m.put(239, 17, 'K'); m.put(241, 17, 'h');
  m.fill(244, 6, 249, 6, '%'); back(m, 244, 7, 244, 17); back(m, 249, 7, 249, 17); m.put(247, 7, 'p', { len: 9, amp: 50, period: 2.4 });
  clk(m, 252, 17, 2, 0);
  // --- R11: último portão e saída ----------------------------------------------
  R(257, 279, 16);
  m.fill(262, 0, 263, 12, '%'); m.put(262, 15, 'u', { open: 1.4, closed: 1.8 }); m.put(263, 15, 'u', { open: 1.4, closed: 1.8 });
  m.put(268, 15, 'a'); m.line(265, 272, 13, 'o', 2);
  m.put(275, 15, 'E');
  back(m, 2, 12, 12, 19); back(m, 30, 10, 36, 17); back(m, 78, 9, 84, 16); back(m, 208, 9, 214, 16); back(m, 258, 8, 261, 15);

  registerLevel({
    ...W3, id: 'w3_5', index: 5, name: 'Telhados do Tempo', subtitle: 'Mundo 3-5',
    music: 'w3_level', timeOfDay: 'night', parTime: 260, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w3_bonus — Corrida Contra o Ponteiro.
// =============================================================================
{
  const m = grid(220, 24);
  const B = (x0, x1, top) => isle(m, x0, x1, top, 24 - top, '#');
  B(0, 12, 18); m.put(2, 17, 'P'); m.sign(5, 17, 'w3_sign_bonus'); m.put(10, 15, 's', { r: 2.5 });
  clk(m, 14, 17, 2, 0, 1.8); clk(m, 17, 16, 2, 1, 1.8); m.line(14, 18, 14);
  B(19, 30, 16);
  m.fill(25, 0, 25, 12, '%'); m.put(25, 15, 'u', { open: 1, closed: 1.4 }); m.put(28, 15, 'a');
  clk(m, 32, 16, 2, 1, 1.8); clk(m, 35, 17, 2, 0, 1.8); m.line(32, 36, 13, 'o', 2);
  B(37, 46, 17); m.put(41, 12, 'm', { hazard: true, size: 2, dy: 4, moveSpeed: 60 });
  m.put(49, 12, 'l', { len: 3, speed: 60 }); m.put(49, 7, '*');   // ★1 (em cima do ponteiro)
  B(53, 62, 15); m.put(58, 14, 'b'); m.line(54, 61, 12, 'o', 2);
  clk(m, 64, 15, 2, 0, 1.6); clk(m, 67, 16, 2, 1, 1.6);
  B(69, 80, 17); m.put(70, 16, 'K'); m.put(72, 16, 'h');
  m.fill(72, 6, 79, 6, '%'); back(m, 72, 7, 72, 16); back(m, 79, 7, 79, 16); m.put(76, 7, 'p', { len: 9, amp: 50, period: 2 });
  clk(m, 82, 16, 2, 1, 1.6); clk(m, 85, 15, 2, 0, 1.6);
  B(87, 96, 15); m.put(90, 13, 's', { r: 2.5 });
  m.fill(94, 0, 94, 11, '%'); m.put(94, 14, 'u', { open: 0.9, closed: 1.2 });
  clk(m, 98, 16, 2, 0, 1.5); clk(m, 101, 17, 2, 1, 1.5);
  B(103, 112, 17);
  clk(m, 104, 13, 2, 0, 1.5); clk(m, 107, 10, 2, 1, 1.5); m.put(109, 8, '*');   // ★2
  m.line(104, 111, 15, 'o', 2);
  B(119, 130, 16); m.put(125, 12, 'f'); m.put(128, 15, 'b');
  clk(m, 114, 17, 2, 1, 1.5); clk(m, 132, 17, 2, 0, 1.5);
  B(137, 148, 18); m.fill(138, 18, 147, 18, 'w'); m.props['138,18'] = { dir: 'r', speed: 90 };
  m.line(138, 147, 16, 'o', 2);
  B(155, 166, 16); m.put(156, 15, 'K'); m.put(160, 13, 'm', { hazard: true, size: 2, dx: 4, moveSpeed: 70 });
  clk(m, 150, 17, 2, 1, 1.5); clk(m, 168, 16, 2, 0, 1.5);
  B(173, 184, 17); m.put(178, 16, 'a'); m.line(174, 183, 14, 'o', 3);
  m.put(187, 12, 'l', { len: 3, speed: -60 });
  B(191, 219, 15);
  m.fill(196, 0, 197, 12, '%'); m.put(196, 14, 'u', { open: 0.8, closed: 1.2 }); m.put(197, 14, 'u', { open: 0.8, closed: 1.2 });
  clk(m, 201, 11, 2, 0, 1.4); clk(m, 204, 8, 2, 1, 1.4); m.put(205, 5, '*');    // ★3
  m.put(210, 14, 'T'); m.line(206, 209, 14); m.put(215, 14, 'E');

  registerLevel({
    ...W3, id: 'w3_bonus', index: 7, name: 'Corrida Contra o Ponteiro', subtitle: 'Mundo 3 - Bônus',
    music: 'w3_level', timeOfDay: 'dusk', parTime: 110, darkness: 0, bonus: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
