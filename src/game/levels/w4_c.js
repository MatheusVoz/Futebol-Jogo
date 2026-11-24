// =============================================================================
// levels/w4_c.js — MUNDO 4 (O Pesadelo Debaixo da Cama), fase 5 e bônus.
//   w4_5 "A Fuga" — loja da Agulheta e memória escondida (mem_7) antes de duas
//         PERSEGUIÇÕES do paredão de sombra (vãos sinalizados por arcos de botões,
//         muretas, esconderijo para respirar). Entre elas, a Luzinha quase se
//         apaga (w4_luzinha_3).
//   w4_bonus "Pesadelo Sem Fim" — desafio com tudo do mundo: mãos, portas de
//         armário, caixa-surpresa, abajures x sombras, assoalho que range e uma
//         perseguição final até o fio antigo.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, closet, pit } from './w4_a.js';

/** Vão de 3 tiles com arco de botões por cima. */
const gap = (m, x, G) => { pit(m, x, x + 2, G); m.arc(x, G - 3, 3, 1); };
/** Mureta de 2 tiles de altura. */
const low = (m, x, G) => m.fill(x, G - 2, x + 1, G - 1, '%');
/** Gatilho de perseguição (coluna de 4 células). */
const chase = (m, x, G, props) => { m.fill(x, G - 4, x, G - 1, 's'); m.props[`${x},${G - 4}`] = props; };

// =============================================================================
// w4_5 — A Fuga. Chão na linha 20 (Tico em pé na 19).
// =============================================================================
{
  const G = 20;
  const m = grid(260, 26);
  m.ground(0, 259, G);
  // --- A: calmaria — loja e memória escondida no baú de brinquedos ---------------
  m.put(2, 19, 'P');
  m.sign(5, 19, 'w4_sign_escape');
  m.line(7, 10, 17);
  m.put(13, 19, 'U');
  m.plat(16, 18, 15);
  m.fill(20, 10, 30, 19, '%');
  m.fill(20, 15, 21, 19, 'H'); m.fill(22, 15, 29, 19, ':');
  m.put(23, 19, 'X'); m.line(24, 26, 17); m.put(28, 19, 'M', { memory: 'mem_7' }); m.put(27, 19, 'r');
  m.line(21, 29, 9, 'o', 4);
  m.put(34, 19, 'K'); m.put(36, 19, 'h');
  m.sign(38, 19, 'w4_sign_run');
  // --- B: primeira perseguição ---------------------------------------------------
  chase(m, 41, G, { from: 'left', endX: 124, speed: 100 });
  gap(m, 50, G); m.line(45, 48, 18, 'o', 3);
  low(m, 58, G); m.put(58, 17, 'o');
  gap(m, 66, G);
  m.plat(70, 74, 15); m.put(72, 14, '*'); m.plat(75, 77, 17);  // ★1 na rota de cima
  low(m, 80, G);
  gap(m, 86, G);
  m.put(92, 19, 'l');
  low(m, 97, G); m.put(97, 17, 'o');
  gap(m, 104, G);
  m.line(108, 112, 18, 'o', 2);
  m.put(114, 19, 'h');
  low(m, 117, G);
  m.line(119, 123, 19, 'o', 2);
  // --- C: a Luzinha quase se apaga — descanso e ★2 -------------------------------
  m.put(128, 19, 'K');
  m.put(132, 19, 'n', { npc: 'luzinha', dialog: 'w4_luzinha_3', anim: 'dim' });
  m.put(137, 19, 'h'); m.put(139, 19, 'e');
  m.put(142, 19, 'u', { height: 9 });
  m.plat(144, 148, 10); m.put(146, 9, '*'); m.put(145, 9, 'o'); m.put(147, 9, 'o');
  m.fill(150, 15, 152, 19, '%');
  m.put(155, 19, 'K');
  // --- D: segunda perseguição (mais rápida) --------------------------------------
  chase(m, 158, G, { from: 'left', endX: 246, speed: 108 });
  m.line(160, 164, 18, 'o', 2);
  gap(m, 167, G);
  low(m, 175, G); m.put(175, 17, 'o');
  gap(m, 183, G);
  m.put(189, 19, 'l');
  low(m, 193, G);
  m.plat(197, 202, 15); m.put(200, 14, '*'); m.put(198, 14, 'o');   // ★3
  gap(m, 205, G);
  m.put(212, 19, 'h');
  low(m, 215, G); m.put(215, 17, 'o');
  gap(m, 222, G);
  low(m, 231, G);
  m.line(234, 242, 18, 'o', 2);
  // --- E: saída ---------------------------------------------------------------------
  m.fill(248, 18, 259, 19, '%');
  m.put(255, 17, 'E');

  registerLevel({
    id: 'w4_5', world: 4, index: 5, name: 'A Fuga', subtitle: 'Mundo 4-5',
    music: 'w4_level', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 180,
    darkness: 0.8, ambient: 'w4_ash', oxygen: false, luzinha: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w4_bonus — Pesadelo Sem Fim. Chão na linha 22 (Tico em pé na 21).
// =============================================================================
{
  const G = 22;
  const m = grid(200, 28);
  m.ground(0, 199, G);
  m.put(2, 21, 'P'); m.sign(5, 21, 'w4_sign_bonus');
  // --- A: campo de mãos ----------------------------------------------------------
  for (const x of [12, 18, 24, 30]) { m.put(x, 21, 'a'); m.arc(x - 2, 19, 5, 2); }
  m.plat(14, 28, 15); m.line(15, 27, 14, 'o', 4);
  // --- B: portas de armário com poça no meio -------------------------------------
  closet(m, 40, G, { offset: 0 });
  m.fill(43, 21, 49, 21, 'p');
  closet(m, 51, G, { offset: 1 });
  m.put(55, 21, 'h');
  // --- C: caixa-surpresa e muralha (★1) ------------------------------------------
  m.plat(58, 60, 16);
  m.put(63, 21, 'u', { height: 10 });
  m.plat(65, 72, 10); m.put(69, 9, '*'); m.put(66, 9, 'o'); m.put(72, 9, 'o');
  m.fill(75, 11, 77, 21, '%');
  m.plat(78, 80, 16);
  m.put(84, 21, 'K');
  // --- D: abajures x sombras sobre assoalho que range -----------------------------
  m.put(92, 21, 'm', { on: false, radius: 4 }); m.put(104, 21, 'm', { on: false, radius: 4 });
  m.put(98, 21, 'd'); m.put(110, 21, 'd'); m.put(121, 21, 'b');
  m.fill(113, 22, 126, 22, 'q');
  m.line(90, 126, 18, 'o', 4);
  // --- E: ★2 sobre a poça de sombra ----------------------------------------------
  m.put(130, 21, 'm', { on: true, radius: 3 });
  m.fill(132, 21, 142, 21, 'p');
  m.plat(135, 139, 16); m.put(137, 15, '*'); m.put(135, 15, 'o'); m.put(139, 15, 'o');
  m.put(146, 21, 'h'); m.put(148, 21, 'K');
  // --- F: perseguição final até o fio antigo (★3) ---------------------------------
  chase(m, 152, G, { from: 'left', endX: 192, speed: 115 });
  gap(m, 158, G);
  low(m, 165, G);
  gap(m, 171, G);
  low(m, 178, G);
  gap(m, 183, G);
  m.plat(187, 191, 18); m.put(189, 17, '*');
  m.put(194, 21, 'T');
  m.put(197, 21, 'E');

  registerLevel({
    id: 'w4_bonus', world: 4, index: 7, name: 'Pesadelo Sem Fim', subtitle: 'Mundo 4 - Bônus',
    music: 'w4_level', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 160,
    darkness: 0.85, ambient: 'w4_ash', oxygen: false, luzinha: true, bonus: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
