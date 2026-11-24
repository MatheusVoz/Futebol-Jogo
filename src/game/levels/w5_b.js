// =============================================================================
// levels/w5_b.js — MUNDO 5 (O Coração da Dimensão), fases 3 e 4.
//   w5_3 "Ruínas dos Mundos" — pedaços da Floresta, dos Relógios, do Oceano e do
//         Pesadelo costurados juntos; cristais da fenda (A/B), ruínas que caem (u),
//         bonecos de pano iguais ao Costureiro (placas w5_ruins_1/2), Eco (w5_tecela_2),
//         primeiro par de portais.
//   w5_4 "Labirinto de Portais" — 3 andares em zigue-zague; muralhas de fase com
//         portais para contorná-las, sala secreta só por portal, nichos de estrela.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, pit, back, hide, isle, npc, W5, rect, threadDoor } from './w5_a.js';

// =============================================================================
// w5_3 — Ruínas dos Mundos. Chão na linha 21.
// =============================================================================
{
  const m = grid(260, 28), G = 21;
  m.ground(0, 259, G);
  // --- A: pedaço da Floresta ---------------------------------------------------
  m.put(3, 20, 'P'); m.sign(7, 20, 'w5_ruins_1');
  m.fill(14, 6, 14, 20, ':');
  m.plat(11, 13, 17); m.plat(15, 18, 13); m.plat(10, 13, 9); m.put(11, 8, '*');      // ★1 (copa)
  m.line(15, 18, 12); m.put(12, 16, 'o');
  m.put(24, 20, 'a');
  m.fill(30, 21, 40, 24, '~'); m.line(31, 39, 23, 'o', 2); m.put(36, 15, 'g');
  // --- B: pedaço dos Relógios ---------------------------------------------------
  m.put(44, 20, 'h'); m.put(46, 20, 'K');
  pit(m, 52, 57, G); m.fill(52, G, 57, G, 'u'); m.line(52, 57, 18);
  m.put(64, 16, 'b');
  m.put(68, 20, 'l');
  rect(m, 72, 14, 73, 20, 'm'); m.fill(72, 3, 73, 13, '%');
  // --- C: Eco da Tecelã, bonecos de pano, poço de fases -------------------------
  npc(m, 80, 20, 'tecela', 'w5_tecela_2');
  m.sign(84, 20, 'w5_ruins_2');
  pit(m, 89, 102, G); m.fill(95, 21, 96, 27, '%');
  rect(m, 90, 19, 93, 19, 'p'); rect(m, 98, 19, 101, 19, 'm'); m.put(95, 20, 'l');
  m.line(90, 101, 17, 'o', 2);
  rect(m, 99, 15, 100, 15, 'm'); m.put(100, 12, '*');        // ★2 (degrau vermelho)
  m.put(110, 20, 'd');
  m.fill(116, 3, 117, 14, '%'); m.fill(116, 15, 117, 20, 'S');
  m.put(120, 20, 'K'); m.put(122, 20, 'h');
  // --- D: pedaço do Oceano ------------------------------------------------------
  m.fill(128, 21, 160, 25, '~');
  m.plat(140, 144, 17); m.line(140, 144, 16);
  m.line(130, 158, 24, 'o', 4); m.put(136, 14, 'g'); m.put(152, 14, 'g');
  m.put(166, 20, 'a');
  // --- E: pedaço do Pesadelo (túnel) --------------------------------------------
  m.fill(168, 3, 205, 16, '%');
  m.put(170, 19, 'v'); m.put(173, 19, 'v');
  m.fill(180, 17, 180, 20, 'Y');
  m.put(188, 20, 'a'); m.put(192, 17, 'g');
  m.fill(196, 17, 196, 20, 'Y'); m.put(194, 19, 'v');
  m.put(186, G, 'H'); m.put(187, G, 'H');                    // segredo
  m.put(183, 23, 'X'); m.put(190, 23, 'r'); m.line(184, 185, 23); m.line(188, 189, 23);
  hide(m, 182, 22, 191, 23);
  m.line(198, 204, 19, 'o', 2);
  // --- F: portais, saída ---------------------------------------------------------
  m.put(212, 20, 'K'); m.put(214, 20, 'h');
  m.sign(217, 20, 'w5_sign_portal');
  m.put(220, 20, 'j', { pair: 'w53a' });
  m.fill(232, 11, 238, 11, '%'); m.put(234, 10, 'j', { pair: 'w53a' }); m.put(237, 10, '*');   // ★3
  m.line(224, 230, 18, 'o', 2);
  m.put(244, 20, 'a'); m.put(250, 15, 'b');
  m.fill(252, 19, 259, 20, '%'); m.put(256, 18, 'E');
  back(m, 2, 12, 26, 20); back(m, 42, 10, 66, 20); back(m, 76, 12, 88, 20); back(m, 206, 10, 230, 20);

  registerLevel({
    ...W5, id: 'w5_3', index: 3, name: 'Ruínas dos Mundos', subtitle: 'Mundo 5-3',
    music: 'w5_level', timeOfDay: 'dusk', parTime: 260, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w5_4 — Labirinto de Portais. Andares: F1 (piso 32) →, F2 (piso 22) ←, F3 (piso 12) →.
// =============================================================================
{
  const m = grid(220, 36);
  m.fill(0, 32, 219, 35, '%');                  // F1
  m.fill(0, 22, 203, 23, '%');                  // F2 / teto F1
  m.fill(16, 12, 219, 13, '%');                 // F3 / teto F2
  // ------------------------------------------------------------- F1 (→)
  m.put(3, 31, 'P'); m.sign(6, 31, 'w5_sign_portal');
  m.put(12, 31, 'j', { pair: 'w54a' }); rect(m, 16, 24, 17, 31, 'm'); m.put(20, 31, 'j', { pair: 'w54a' });
  m.line(8, 11, 29);
  m.put(30, 31, 'a'); m.put(40, 26, 'b'); m.line(24, 44, 29, 'o', 4);
  pit(m, 48, 53, 32); m.fill(48, 32, 53, 32, 'u');
  m.put(62, 31, 'd');
  m.put(70, 31, 'K'); m.put(72, 31, 'h');
  m.put(78, 31, 'l'); rect(m, 82, 24, 83, 31, 'p'); rect(m, 90, 24, 91, 31, 'm'); m.put(86, 31, 'l'); m.put(94, 31, 'l');
  m.put(100, 30, 'v'); m.put(103, 30, 'v'); rect(m, 108, 24, 108, 31, 'Y');
  m.put(118, 31, 'f'); m.put(125, 25, 'g'); m.put(140, 25, 'g');
  // segredo: sala sob o piso, só por portal
  m.put(132, 31, 'j', { pair: 'w54s' });
  m.clear(129, 33, 140, 34);
  m.put(131, 34, 'X'); m.put(133, 34, 'r'); m.line(134, 136, 34); m.put(130, 34, 'e');
  m.put(138, 34, 'j', { pair: 'w54s' });
  hide(m, 129, 33, 140, 34);
  m.put(149, 26, 'q', { dx: 9, dy: 3 }); pit(m, 150, 155, 32);
  m.put(165, 31, 'a'); m.line(160, 186, 29, 'o', 4); m.put(178, 26, 'b');
  m.put(190, 31, 'h');
  // poço A (direita)
  m.fill(212, 28, 214, 28, '%'); m.fill(206, 25, 208, 25, '%'); rect(m, 216, 14, 217, 31, 'w');
  // ------------------------------------------------------------- F2 (←)
  m.put(200, 21, 'K'); m.put(198, 21, 'h'); m.put(190, 21, 'a');
  m.fill(180, 14, 181, 21, 'S');
  m.put(170, 15, 'g'); m.put(160, 16, 'b'); m.line(150, 175, 19, 'o', 5);
  m.put(117, 20, 'v'); m.put(115, 20, 'v'); rect(m, 110, 14, 110, 21, 'Y');
  m.put(100, 21, 'd');
  m.fill(80, 21, 85, 21, '^'); m.fill(86, 20, 86, 21, '%'); m.fill(87, 21, 92, 21, '^');
  rect(m, 81, 19, 84, 19, 'm'); rect(m, 88, 19, 91, 19, 'p'); m.put(86, 19, 'l');
  m.line(81, 91, 17, 'o', 2);
  m.put(70, 15, 'g'); m.put(60, 21, 'a'); m.put(40, 21, 'h');
  m.put(30, 21, 'j', { pair: 'w54b' });                       // portal p/ o nicho do ★1
  m.fill(200, 2, 212, 8, '%'); m.clear(202, 4, 210, 7);
  m.put(204, 7, 'j', { pair: 'w54b' }); m.put(208, 7, '*'); m.line(205, 207, 5);   // ★1
  // poço B (esquerda)
  m.fill(4, 18, 6, 18, '%'); m.fill(10, 15, 12, 15, '%'); rect(m, 1, 4, 2, 21, 'w');
  // ------------------------------------------------------------- F3 (→)
  m.put(20, 11, 'K'); m.put(22, 11, 'h');
  m.fill(40, 11, 45, 11, '^'); m.fill(46, 10, 46, 11, '%'); m.fill(47, 11, 52, 11, '^');
  m.put(38, 7, 'q', { dx: 16, dy: 2 }); m.line(40, 52, 6, 'o', 3);
  m.put(60, 11, 'a'); m.put(70, 6, 'b');
  m.put(77, 11, 'l'); rect(m, 80, 4, 81, 11, 'm'); m.put(84, 11, 'l'); rect(m, 87, 4, 88, 11, 'p'); m.put(91, 11, 'l');
  m.put(95, 10, 'v'); m.put(97, 10, 'v'); threadDoor(m, 100, 100, 3, 4, 11);
  m.put(110, 6, 'g'); m.put(125, 6, 'g');
  m.put(130, 11, 'j', { pair: 'w54c' }); m.fill(148, 4, 152, 4, '%'); m.put(149, 3, 'j', { pair: 'w54c' }); m.put(151, 3, '*');  // ★2
  m.put(140, 11, 'f'); m.put(160, 11, 'd');
  m.fill(170, 11, 175, 11, '^'); m.fill(170, 10, 175, 10, 'u');
  m.put(186, 7, 's', { w: 3, ay: 2, period: 4 }); m.put(186, 3, '*');   // ★3
  m.put(195, 11, 'a'); m.line(178, 200, 9, 'o', 4);
  m.fill(212, 10, 219, 11, '%'); m.put(216, 9, 'E');
  back(m, 0, 24, 203, 31); back(m, 16, 14, 199, 21);

  registerLevel({
    ...W5, id: 'w5_4', index: 4, name: 'Labirinto de Portais', subtitle: 'Mundo 5-4',
    music: 'w5_level', timeOfDay: 'night', parTime: 300, darkness: 0.1,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
