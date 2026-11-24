// =============================================================================
// levels/w2_b.js — MUNDO 2 (Oceano das Lágrimas), fases 3 e 4.
//   w2_3 "Navio Afundado" — dentro de um navio de brinquedo naufragado (casco '%').
//         Porões alagados embaixo, corredores secos em cima, convés com mastros.
//         Rombos e portas costurados ('S'), polvos de pote, Capitã Bolha
//         (missão 'bolha_crew': marujo 1/3 preso numa rede no porão de carga),
//         porão secreto (parede falsa) e cabine secreta da capitã (★3).
//   w2_4 "Blocos de Água Flutuante" — ilhas suspensas sobre um lago de sombras
//         (espreitadores). Bolsões de água parados, blocos de água que flutuam,
//         gêiseres (ensinados aqui), barquinhos, torre de gêiseres e marujo 2/3.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, wblock, marujo } from './w2_a.js';

// =============================================================================
// w2_3 — Navio Afundado. Mar a partir da linha 18. Casco: topo 10–11, corredores
// secos 12–17, piso do meio 18–19, porões alagados 20–31, fundo 32–37.
// =============================================================================
{
  const m = grid(250, 40);
  m.ground(0, 249, 38);
  m.fill(13, 18, 249, 37, '~');
  // --- A: rochedo de partida, Capitã Bolha, garrafa ---------------------------
  m.ground(0, 12, 15);
  m.put(3, 14, 'P');
  m.sign(6, 14, 'w2_sign_ship');
  m.put(9, 14, 'o'); m.put(11, 14, 'o');
  m.put(16, 18, 'n', { npc: 'capita_bolha', dialog: 'w2_bolha_2', quest: 'bolha_crew' });
  m.put(21, 18, 'u', { dialog: 'w2_bottle_2' });
  m.put(19, 28, 'a');
  m.put(18, 22, 'o'); m.put(20, 24, 'o'); m.put(22, 25, 'o'); m.put(24, 25, 'o');
  // --- casco ------------------------------------------------------------------
  m.fill(26, 10, 226, 37, '%');
  m.fill(151, 2, 226, 9, '%');                                 // castelo de popa
  m.clear(26, 10, 28, 11); m.clear(26, 12, 26, 15);            // proa inclinada
  // --- B: rombo costurado → porão da proa (L1) ---------------------------------
  m.fill(26, 23, 26, 26, '~'); m.fill(27, 23, 27, 26, 'S');
  m.fill(28, 20, 60, 31, '~');
  m.put(29, 31, '*');                                           // ★1 no canto do porão
  m.put(33, 31, 'd');
  m.put(38, 23, 'a'); m.put(52, 26, 'a');
  m.line(31, 37, 27, 'o', 2); m.line(46, 52, 22, 'o', 2);
  m.put(42, 31, 'e');
  m.fill(55, 18, 57, 19, '~');                                  // escotilha H1 (sobe)
  // porão secreto (L2) atrás da antepara falsa — segredo 1
  m.fill(61, 28, 63, 31, 'H');
  m.put(58, 31, 'o'); m.put(60, 31, 'o');
  m.fill(64, 20, 96, 31, '~');
  m.put(66, 31, 'X'); m.line(69, 87, 30, 'o', 3); m.put(80, 24, 'h');
  m.put(77, 26, 'b'); m.put(92, 31, 'r'); m.put(94, 22, 'e');
  // --- C: corredor seco (U1/U2) -----------------------------------------------
  m.fill(28, 12, 100, 17, ':');
  m.fill(34, 12, 35, 17, 'S');                                  // porta costurada do armário
  m.put(30, 17, 'c', { contents: 'buttons:6' }); m.put(32, 17, 'e');
  m.sign(53, 17, 'w2_sign_hatch');
  m.arc(61, 16, 6, 2);
  m.put(68, 17, 'd');
  m.plat(71, 75, 14); m.line(72, 74, 13);
  m.put(82, 17, 'g');
  m.plat(85, 89, 14); m.put(87, 13, 'h');
  m.plat(95, 99, 14);
  m.plat(96, 98, 10); m.fill(96, 11, 98, 11, ':');             // escotilha H2 (convés)
  // --- D: convés, mastros e o cesto da gávea (★2) ------------------------------
  m.line(40, 56, 9, 'o', 4); m.put(62, 9, 'g'); m.put(34, 9, 'e');
  m.put(101, 9, 'K');
  m.fill(112, 4, 112, 9, '%'); m.plat(108, 116, 7); m.plat(109, 115, 4);
  m.put(114, 3, '*'); m.put(110, 3, 'o'); m.put(111, 3, 'o');
  m.put(109, 6, 'o'); m.put(115, 6, 'o');
  m.put(122, 9, 'g');
  m.fill(134, 5, 134, 9, '%'); m.plat(130, 138, 7);
  for (const x of [131, 133, 135, 137]) m.put(x, 6, 'o');
  m.put(142, 9, 'd');
  m.fill(146, 10, 148, 11, ':');                                // escotilha H3 (desce)
  m.sign(144, 9, 'w2_sign_deck');
  // --- E: cozinha (U3) e despensa costurada ------------------------------------
  m.fill(104, 12, 170, 17, ':');
  m.put(106, 17, 'c', { contents: 'buttons:8' }); m.put(109, 17, 'h'); m.put(112, 17, 'e');
  m.line(115, 123, 15, 'o', 2);
  m.fill(126, 12, 127, 17, 'S');
  m.put(134, 17, 'd');
  m.line(130, 144, 14, 'o', 3);
  m.put(152, 17, 'K');
  m.put(158, 17, 'g');
  m.fill(162, 18, 165, 19, '~');                                // escotilha H4 (porão de carga)
  // --- F: porão de carga alagado (L3) + marujo preso na rede ------------------
  m.fill(104, 20, 200, 31, '~');
  m.fill(118, 27, 122, 31, '%'); m.fill(140, 25, 143, 31, '%'); m.fill(176, 26, 180, 31, '%');
  m.put(130, 24, 'b'); m.put(150, 26, 'a'); m.put(185, 23, 'a'); m.put(170, 31, 'd');
  m.fill(134, 32, 136, 33, '~'); m.fill(134, 31, 136, 31, 'S'); marujo(m, 135, 33);
  m.line(106, 116, 23, 'o', 2); m.line(124, 138, 22, 'o', 3);
  m.line(145, 160, 28, 'o', 3); m.line(182, 194, 25, 'o', 3);
  m.put(127, 31, 'e'); m.put(160, 22, 'b');
  m.fill(196, 18, 198, 19, '~');                                // escotilha H5 (cabine)
  // --- G: cabine da capitã (U4) + sala escondida (★3) — segredo 2 --------------
  m.fill(180, 12, 224, 17, ':');
  m.fill(175, 13, 178, 17, ':'); m.fill(179, 14, 179, 17, 'H');
  m.put(178, 17, 'X'); m.put(176, 17, '*'); m.line(175, 177, 14);
  m.sign(182, 17, 'w2_sign_captain');
  m.put(188, 17, 'c', { contents: 'buttons:10' });
  m.put(192, 17, 'K');
  m.plat(200, 204, 14); m.line(200, 204, 13, 'o', 2);
  m.put(207, 17, 'd'); m.put(215, 17, 'g');
  m.clear(221, 14, 226, 17);                                    // janela de popa
  // --- H: saída pelos rochedos -------------------------------------------------
  m.ground(229, 249, 16);
  m.line(230, 242, 13, 'o', 3); m.put(236, 15, 'g');
  m.put(246, 15, 'E');

  registerLevel({
    id: 'w2_3', world: 2, index: 3, name: 'Navio Afundado', subtitle: 'Mundo 2-3',
    music: 'w2_level', tileset: 'w2', background: 'w2', timeOfDay: 'night', parTime: 260,
    darkness: 0.3, ambient: 'w2_bubbles', oxygen: false,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w2_4 — Blocos de Água Flutuante. Lago de sombras nas linhas 30–33.
// =============================================================================
{
  const m = grid(260, 36);
  m.ground(0, 259, 34);
  m.fill(0, 30, 259, 33, '~');
  /** Prateleiras na face de uma ilha (rota de volta saindo do lago). */
  const shelves = (x0, x1, ys) => ys.forEach((y) => m.plat(x0, x1, y));
  // --- A: ilha de partida, primeiro bolsão e primeiro gêiser --------------------
  m.ground(0, 18, 20);
  m.put(2, 19, 'P');
  m.sign(5, 19, 'w2_sign_blocks');
  m.fill(8, 11, 13, 14, '~'); m.line(9, 12, 13);
  m.sign(14, 19, 'w2_sign_geyser');
  m.put(16, 19, 's', { h: 10, period: 3.4, burst: 1.5, power: 380 });
  m.plat(18, 22, 9); m.put(19, 8, 'o'); m.put(21, 8, 'e');
  // --- B: primeiro bloco flutuante sobre o lago --------------------------------
  wblock(m, 24, 12, 4, 4, { dx: 10 });
  m.line(26, 36, 10, 'o', 2);
  m.put(30, 31, 'f');
  m.ground(40, 50, 18); shelves(37, 39, [28, 24, 21]);
  m.put(46, 17, 'g'); m.line(42, 44, 16);
  // --- C: corrente de bolsões parados (★1 no bolsãozinho do alto) ---------------
  m.fill(54, 12, 58, 16, '~'); m.put(56, 14, 'a');
  m.fill(64, 9, 68, 13, '~'); m.line(65, 67, 12);
  m.fill(66, 4, 67, 6, '~'); m.put(66, 5, '*');
  m.fill(74, 12, 78, 16, '~'); m.put(75, 15, 'o'); m.put(77, 15, 'o'); m.put(76, 13, 'h');
  m.put(70, 31, 'f');
  m.ground(84, 92, 18); shelves(81, 83, [28, 24, 21]);
  m.line(86, 90, 17, 'o', 2);
  // --- D: lagoa elevada com barquinho e espreitadores ----------------------------
  m.ground(94, 128, 22);
  m.fill(94, 18, 96, 21, '#'); m.fill(126, 18, 128, 21, '#');
  m.fill(97, 18, 125, 21, '~');
  m.sign(95, 17, 'w2_sign_boat');
  m.put(97, 17, 'p', { dx: 22, w: 3, speed: 24, pause: 1 });
  m.put(104, 20, 'f'); m.put(117, 20, 'f');
  m.fill(108, 21, 112, 21, '^');
  m.line(99, 121, 14, 'o', 3);
  // --- E: torre de gêiseres ---------------------------------------------------
  m.ground(131, 157, 24);
  m.put(132, 23, 'K');
  m.put(135, 23, 's', { always: true, h: 10, power: 460 });
  m.put(145, 23, 's', { h: 12, period: 3, burst: 1.4, phase: 1, power: 420 });
  m.plat(138, 141, 19); m.plat(142, 145, 15); m.plat(147, 150, 11);
  m.line(138, 141, 18, 'o', 3); m.put(143, 14, 'o'); m.put(149, 10, 'o');
  m.plat(141, 144, 5); m.put(142, 4, '*'); m.put(144, 4, 'o');  // ★2 no alto da torre
  m.put(151, 23, 'g');
  wblock(m, 153, 20, 3, 3, { dy: -11, speed: 22, pause: 1.2 });
  m.ground(158, 170, 8);
  m.put(164, 7, 'K'); m.line(160, 168, 6, 'o', 4);
  // --- F: rota alta — blocos e bolsões; pilar com sala escondida ----------------
  wblock(m, 172, 6, 4, 4, { dx: 9, speed: 24 });
  m.fill(178, 14, 181, 17, '~'); m.put(179, 16, 'o'); m.put(180, 15, 'o');
  m.put(178, 31, 'f');
  m.ground(188, 198, 10); shelves(185, 187, [28, 24, 20, 16, 13]);
  m.line(189, 196, 9, 'o', 2);
  m.fill(192, 13, 197, 16, ':'); m.fill(198, 13, 198, 16, 'H');   // segredo
  m.put(196, 16, 'X'); m.put(193, 16, 'r'); m.line(193, 195, 14); m.put(194, 16, 'h');
  m.fill(199, 12, 203, 16, '~'); m.put(201, 14, 'a');
  m.ground(208, 214, 12);
  m.put(211, 11, 'o');
  wblock(m, 215, 10, 3, 3, { dy: -6, speed: 20, pause: 1.4 });
  m.plat(218, 222, 5, '#'); m.put(221, 4, '*'); marujo(m, 219, 4);  // ★3 + marujo 2/3
  // --- G: descida, barquinho no lago e saída ------------------------------------
  m.ground(217, 222, 26); m.put(219, 25, 'K');
  m.put(223, 29, 'p', { dx: 18, w: 3, speed: 26, pause: 0.8 });
  m.put(228, 31, 'f'); m.put(238, 31, 'f');
  m.arc(224, 26, 20, 2);
  m.ground(247, 259, 24); shelves(244, 246, [28]);
  m.put(250, 23, 'g'); m.put(256, 23, 'E');

  registerLevel({
    id: 'w2_4', world: 2, index: 4, name: 'Blocos de Água Flutuante', subtitle: 'Mundo 2-4',
    music: 'w2_level', tileset: 'w2', background: 'w2', timeOfDay: 'day', parTime: 240,
    darkness: 0, ambient: 'w2_bubbles', oxygen: false,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
