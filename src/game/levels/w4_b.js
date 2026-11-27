// =============================================================================
// levels/w4_b.js — MUNDO 4 (O Pesadelo Debaixo da Cama), fases 3 e 4.
//   w4_3 "Quarto das Bonecas" — bonecas que só andam quando você não olha,
//         quebra-cabeças do Retalho Fantasma (placas + portões; as bonecas miram
//         a cópia), o reflexo do espelho (mimic), a REVELAÇÃO do Costureiro
//         (cutscene 'w4_revelation', uma vez) e o baú de brinquedos secreto.
//   w4_4 "Labirinto de Brinquedos" — abajures contra sombras (ataque, alavanca,
//         ilhós costurados com sinal), assoalho que range, sussurros nas placas
//         (w4_whisper_1/2), muralhas de blocos e bloco secreto.
// =============================================================================
import { registerLevel } from '../registry.js';
import { save } from '../../engine/save.js';
import { grid, gateWall, pit } from './w4_a.js';

// =============================================================================
// w4_3 — Quarto das Bonecas. Chão na linha 22 (Tico em pé na 21).
// =============================================================================
{
  const G = 22;
  const REV_X = 120;                                            // coluna da revelação
  const m = grid(240, 28);
  m.ground(0, 239, G);
  // --- A: bonecas (olhe para elas!) ---------------------------------------------
  m.put(2, 21, 'P');
  m.sign(5, 21, 'w4_sign_dolls');
  m.put(14, 21, 'b');
  m.plat(17, 21, 18); m.line(17, 21, 17, 'o', 2);
  m.put(20, 21, 'm', { on: true, radius: 4 });
  m.put(26, 21, 'b');
  m.line(28, 31, 19);
  m.put(33, 21, 'h');
  // --- B: placa + portão, casinha de bonecas (★1) --------------------------------
  m.put(38, 21, 'D', { signal: 'w43_g1' });
  m.sign(36, 21, 'w4_sign_plate');
  m.line(40, 46, 20, 'o', 2);
  gateWall(m, 48, G, 'w43_g1');
  m.put(54, 21, 'b');
  m.plat(56, 58, 18);
  m.fill(60, 15, 67, 21, '%'); m.put(64, 14, '*'); m.line(61, 66, 14, 'o', 5);
  m.put(69, 21, 'e');
  // --- C: o espelho e o reflexo ---------------------------------------------------
  m.sign(72, 21, 'w4_sign_mirror');
  m.line(76, 84, 19, 'o', 2);
  m.put(95, 21, 'f', { mirror: 88 });
  pit(m, 96, 98, G); m.arc(96, 19, 3, 1);
  pit(m, 102, 104, G); m.arc(102, 19, 3, 1);
  m.put(108, 21, 'K');
  // --- D: o quarto silencioso (revelação) -----------------------------------------
  m.put(114, 21, 'm', { on: true, radius: 5 });
  m.line(116, 124, 20, 'o', 4);
  m.put(127, 21, 'h');
  m.put(131, 21, 'a');
  // --- E: segundo portão (bonecas miram a cópia), ★3, baú secreto (★2) -----------
  m.put(138, 21, 'D', { signal: 'w43_g2' });
  m.put(144, 21, 'b');
  m.line(140, 148, 18, 'o', 4);
  gateWall(m, 150, G, 'w43_g2');
  m.plat(154, 159, 17); m.put(157, 16, '*'); m.put(155, 16, 'o');
  m.put(162, 21, 'a');
  m.plat(163, 165, 17);
  m.fill(166, 13, 178, 21, '%');
  m.fill(166, 18, 167, 21, 'H'); m.fill(168, 18, 177, 21, ':');
  m.put(169, 21, 'X'); m.line(170, 173, 19); m.put(175, 21, '*'); m.put(177, 21, 'r');
  m.line(168, 177, 12, 'o', 3);
  m.put(182, 21, 'K');
  // --- F: alavanca + poça de sombra, corredor de bonecas e saída -----------------
  m.put(186, 21, 'L', { signal: 'w43_l', latch: true });
  m.fill(190, 21, 202, 21, 'p');
  m.put(196, 21, 'm', { signal: 'w43_l', radius: 6 });
  m.line(191, 201, 18, 'o', 2);
  m.put(206, 21, 'b'); m.put(214, 21, 'b'); m.put(220, 21, 'a');
  m.plat(209, 212, 18); m.put(210, 17, 'h');
  pit(m, 224, 227, G); m.arc(224, 19, 4, 2);
  m.put(236, 21, 'E');

  m.put(55, 21, 'K');  // QA: checkpoint no meio
  registerLevel({
    id: 'w4_3', world: 4, index: 3, name: 'Quarto das Bonecas', subtitle: 'Mundo 4-3',
    music: 'w4_level', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 220,
    darkness: 0.8, ambient: 'w4_dust', oxygen: false, luzinha: true,
    map: m.build(), props: m.props, objects: m.objects,
    onUpdate(level) {
      const p = level.player;
      if (level._w4rev || !p || p.x < REV_X * 16) return;
      level._w4rev = true;
      if (save.flag('w4_revelation_seen')) return;
      save.setFlag('w4_revelation_seen');
      level.cutscene('w4_revelation');
    },
  });
}

// =============================================================================
// w4_4 — Labirinto de Brinquedos. Chão na linha 26 (Tico em pé na 25).
// =============================================================================
{
  const G = 26;
  const m = grid(240, 32);
  m.ground(0, 239, G);
  // --- A: entrada e primeiro sussurro --------------------------------------------
  m.put(2, 25, 'P');
  m.sign(5, 25, 'w4_sign_maze');
  m.put(10, 25, 'm', { on: false });
  m.put(18, 25, 'd');
  m.line(12, 20, 23, 'o', 2);
  m.sign(24, 25, 'w4_whisper_1');
  m.fill(28, 22, 31, 25, '%'); m.fill(30, 19, 31, 21, '%'); m.line(28, 29, 21); m.put(31, 18, 'o');
  // --- B: assoalho que range x rota silenciosa por cima --------------------------
  m.fill(36, 26, 48, 26, 'q');
  m.plat(36, 48, 19); m.line(37, 47, 18, 'o', 2);
  m.plat(43, 45, 23); m.put(44, 22, 'm', { on: false, radius: 4 });
  m.put(52, 25, 'd');
  m.put(57, 25, 'h');
  // --- C: ilhós costurados acendem o abajur sobre a poça --------------------------
  m.sign(62, 25, 'w4_sign_anchor_lamp');
  m.put(66, 25, 'e');
  m.fill(72, 25, 88, 25, 'p');
  m.put(71, 24, '@', { group: 'l1', signal: 'w44_lamp', latch: true });
  m.put(80, 21, '@', { group: 'l1', signal: 'w44_lamp', latch: true });
  m.put(89, 24, '@', { group: 'l1' });
  m.plat(79, 81, 22);
  m.put(80, 18, 'm', { signal: 'w44_lamp', radius: 6 });
  m.plat(79, 81, 19);
  m.put(76, 25, 'd'); m.put(85, 25, 'd');
  m.line(73, 87, 20, 'o', 3);
  m.put(94, 25, 'K');
  // --- D: muralhas de blocos (por baixo, por cima), ★1 no nicho -------------------
  m.fill(100, 0, 102, 20, '%');   // muralha desce do teto (passa-se por baixo) m.line(98, 104, 24, 'o', 3);
  m.put(108, 25, 'u', { height: 9 });
  m.plat(110, 112, 21); m.plat(106, 108, 16); m.plat(110, 112, 11);
  m.fill(114, 10, 116, 25, '%');
  m.plat(105, 107, 7); m.put(106, 6, '*'); m.put(111, 10, 'o'); m.put(107, 15, 'o');
  m.plat(117, 119, 18); m.put(118, 17, 'o');
  m.sign(119, 25, 'w4_whisper_2');
  m.put(124, 25, 'a'); m.put(132, 25, 'a');
  m.line(121, 135, 22, 'o', 2);
  m.put(138, 25, 'b');
  m.fill(141, 0, 143, 21, '%');
  // --- E: corredor dos abajures, bloco secreto (★2) -------------------------------
  m.sign(146, 25, 'w4_sign_lamps');
  m.put(149, 25, 'm', { on: false, radius: 4 }); m.put(157, 25, 'm', { on: false, radius: 4 });
  m.put(169, 25, 'm', { on: false, radius: 4 });
  m.put(153, 25, 'd'); m.put(162, 25, 'd'); m.put(174, 25, 'd');
  m.put(165, 25, 'l');
  m.line(150, 172, 22, 'o', 4);
  m.plat(176, 178, 20);
  m.fill(180, 15, 192, 25, '%');
  m.fill(180, 21, 181, 25, 'H'); m.fill(182, 21, 191, 25, ':');
  m.put(183, 25, 'X'); m.line(184, 187, 23); m.put(189, 25, '*'); m.put(191, 25, 'r');
  m.line(182, 191, 14, 'o', 3);
  m.put(196, 25, 'K'); m.put(198, 25, 'h');
  // --- F: rangidos finais, caixa-surpresa (★3) e saída ----------------------------
  m.fill(202, 26, 214, 26, 'q');
  m.put(208, 25, 'l'); m.put(216, 25, 'd');
  m.line(203, 213, 23, 'o', 5);
  m.put(220, 25, 'u', { height: 9 });
  m.plat(222, 224, 20); m.plat(225, 229, 15); m.put(227, 14, '*');
  m.put(232, 25, 'b');
  m.put(237, 25, 'E');

  m.put(145, 25, 'K'); m.put(147, 25, 'h');  // QA: checkpoint no meio
  registerLevel({
    id: 'w4_4', world: 4, index: 4, name: 'Labirinto de Brinquedos', subtitle: 'Mundo 4-4',
    music: 'w4_level', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 230,
    darkness: 0.82, ambient: 'w4_ash', oxygen: false, luzinha: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
