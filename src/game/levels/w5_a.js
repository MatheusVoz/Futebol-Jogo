// =============================================================================
// levels/w5_a.js — MUNDO 5 (O Coração da Dimensão), fases 1 e 2.
//   w5_1 "O Tear das Tecelãs" — altar da Forma Desfiada no Tear; orbes (v) para
//         carregar, barreiras de fio (Y), plataformas no ar (★); cristal da fenda
//         (l) com blocos de fase A/B (m/p); ilhas à deriva (s); tirolesa (q);
//         placa + Retalho Fantasma; ilhós. Eco da Tecelã (w5_tecela_1).
//   w5_2 "Ponte de Fios" — ilhas sobre o vazio ligadas por tirolesas de fio,
//         ilhas de retalhos à deriva e correntes ascendentes (w).
// Utilitários de montagem vêm de w3_a.js (grid/pit/back/hide/isle/npc).
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, pit, back, hide, isle, npc } from './w3_a.js';

export const W5 = { world: 5, tileset: 'w5', background: 'w5', ambient: 'w5_threads', oxygen: false };
/** Retângulo de células de mecânica (m/p/w/Y...) com props na célula do canto. */
export function rect(m, x0, y0, x1, y1, ch, pr) { m.fill(x0, y0, x1, y1, ch); if (pr) m.props[`${x0},${y0}`] = pr; return m; }
/** Porta de barreira de fio: parede sólida acima, 'Y' de y0 até y1. */
export function threadDoor(m, x0, x1, top, y0, y1) { m.fill(x0, top, x1, y0 - 1, '%'); return m.fill(x0, y0, x1, y1, 'Y'); }
export { grid, pit, back, hide, isle, npc };

// =============================================================================
// w5_1 — O Tear das Tecelãs. Chão na linha 21 (Tico em pé na 20).
// =============================================================================
{
  const m = grid(250, 28), G = 21;
  m.ground(0, 249, G);
  // --- A: chegada + Eco da Tecelã + altar ------------------------------------
  m.put(3, 20, 'P'); m.sign(6, 20, 'w5_sign_heart'); m.line(9, 14, 18);
  m.put(18, 15, 'g');
  npc(m, 24, 20, 'tecela', 'w5_tecela_1');
  m.fill(28, 20, 36, 20, '%'); m.put(32, 19, 'Q', { ability: 'unravel' }); m.line(29, 35, 17, 'o', 2);
  m.fill(27, 6, 37, 6, '%'); m.fill(27, 7, 27, 19, ':'); m.fill(37, 7, 37, 19, ':');    // o Tear
  // --- B: orbes + barreira de fio -------------------------------------------
  m.sign(39, 20, 'w5_sign_unravel');
  m.put(41, 18, 'v'); m.put(44, 18, 'v'); m.put(47, 18, 'v');
  threadDoor(m, 50, 51, 3, 15, 20);
  m.put(54, 20, 'e');
  // ★1: alto sobre o vão — só com as plataformas da Forma Desfiada
  m.sign(53, 20, 'w5_sign_airplat');
  pit(m, 56, 62, G); m.arc(56, 18, 7, 2);
  m.put(59, 7, '*'); m.line(58, 60, 9);
  m.put(70, 20, 'a'); m.put(78, 16, 'b');
  m.put(84, 20, 'K'); m.put(86, 20, 'h');
  // --- C: cristal da fenda + blocos de fase ----------------------------------
  m.sign(88, 20, 'w5_sign_rift');
  m.put(90, 20, 'l');
  rect(m, 93, 14, 94, 20, 'm');                         // muralha vermelha (fase A)
  m.fill(93, 3, 94, 13, '%');
  pit(m, 97, 110, G); m.fill(103, 21, 104, 27, '%');
  rect(m, 98, 18, 101, 18, 'p'); rect(m, 106, 17, 109, 17, 'p'); m.line(98, 109, 15, 'o', 2);
  m.put(113, 20, 'l');
  rect(m, 116, 14, 117, 20, 'p'); m.fill(116, 3, 117, 13, '%');   // muralha azul (fase B)
  // --- D: ilhas à deriva ------------------------------------------------------
  pit(m, 120, 140, G);
  m.fill(126, 19, 127, 27, '%'); m.fill(133, 18, 134, 27, '%');
  m.put(122, 17, 's', { w: 3, ay: 1, period: 3.5 }); m.put(129, 15, 's', { w: 3, ax: 1.5, period: 4 });
  m.put(136, 15, 's', { w: 3, ay: 1.5, period: 3, phase: 0.5 });
  m.line(121, 139, 13, 'o', 3); m.put(131, 10, 'g');
  // --- E: checkpoint 2, golem, tirolesa ---------------------------------------
  m.put(144, 20, 'K'); m.put(146, 20, 'h');
  m.put(150, 20, 'd');
  m.fill(152, 17, 153, 20, '%'); m.fill(155, 12, 160, 20, '%'); m.line(155, 159, 11);
  m.sign(156, 11, 'w5_sign_rail');
  pit(m, 161, 172, G); m.fill(166, 19, 167, 27, '%');
  m.put(161, 10, 'q', { dx: 11, dy: 6 });
  // --- F: segredo (rachadura no piso) + eco sombrio ----------------------------
  m.put(182, G, 'H'); m.put(183, G, 'H');
  m.put(180, 23, 'X'); m.put(186, 23, 'r'); m.line(177, 179, 23); m.line(187, 189, 23); m.put(184, 23, 'e');
  hide(m, 176, 22, 190, 23);
  m.put(195, 20, 'f'); m.put(200, 15, 'g');
  // --- G: placa segurada pelo Retalho Fantasma --------------------------------
  m.sign(203, 20, 'w5_sign_decoy');
  m.put(206, 20, 'D', { signal: 'w51_gate' });
  m.fill(211, 3, 213, 16, '%'); m.put(212, 20, 'G', { signal: 'w51_gate' });
  m.put(215, 20, 'K');
  // --- H: ilhós até o mirante (★2), cofre de fios (★3), saída -----------------
  m.put(218, 18, '@', { group: 'w51' }); m.put(225, 12, '@', { group: 'w51' });
  m.fill(224, 13, 229, 13, '%'); m.put(228, 12, '*'); m.line(225, 227, 12);   // ★2
  m.put(222, 19, 'v');
  m.fill(232, 14, 238, 20, '%'); m.clear(233, 17, 237, 20); m.fill(232, 17, 232, 20, 'Y');
  m.put(236, 20, '*'); m.put(234, 20, 'o');                  // ★3
  m.line(232, 238, 13, 'o', 2);
  m.put(242, 20, 'a');
  m.fill(244, 19, 249, 20, '%'); m.put(247, 18, 'E');
  back(m, 7, 10, 22, 20); back(m, 64, 10, 82, 20); back(m, 140, 12, 150, 20); back(m, 190, 10, 210, 20);

  registerLevel({
    ...W5, id: 'w5_1', index: 1, name: 'O Tear das Tecelãs', subtitle: 'Mundo 5-1',
    music: 'w5_calm', timeOfDay: 'night', parTime: 250, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w5_2 — Ponte de Fios. Ilhas sobre o vazio.
// =============================================================================
{
  const m = grid(260, 30);
  const I = (x0, x1, top, d = 4) => isle(m, x0, x1, top, d);
  I(0, 14, 18, 12); m.put(3, 17, 'P'); m.sign(7, 17, 'w5_sign_bridge'); m.line(9, 13, 15);
  I(21, 32, 16); m.put(27, 15, 'a'); m.line(22, 25, 14);
  m.put(33, 12, 'q', { dx: 8, dy: 4 });
  m.put(37, 8, '*');                                         // ★1 (pulo duplo saindo da tirolesa)
  I(40, 52, 19); m.put(46, 14, 'g'); m.line(42, 50, 17, 'o', 2);
  // corrente ascendente até a ilha alta
  m.sign(51, 18, 'w5_sign_updraft');
  rect(m, 53, 9, 54, 22, 'w');
  I(56, 57, 15, 2); I(60, 72, 11);
  m.put(62, 10, 'K'); m.put(64, 10, 'h'); m.put(68, 7, 'b'); m.line(65, 71, 9, 'o', 2);
  m.put(74, 14, 's', { w: 3, ay: 1, period: 3.5 });
  I(77, 90, 15); m.put(84, 14, 'a'); m.line(78, 82, 13);
  m.put(91, 11, 'q', { dx: 8, dy: 5 }); m.line(92, 98, 10, 'o', 3);
  // ilha 6 com sala escondida (rachadura no topo)
  I(98, 110, 17, 6); m.put(100, 16, 'h'); m.put(104, 12, 'g');
  m.put(106, 17, 'H'); m.put(107, 17, 'H');
  m.put(102, 19, 'r'); m.put(104, 19, 'X'); m.line(108, 109, 19); m.line(102, 109, 18, 'o', 3);
  hide(m, 101, 18, 109, 19);
  // ilha 7: barreira de fios
  I(117, 130, 15); m.put(119, 13, 'v'); m.put(121, 13, 'v');
  threadDoor(m, 124, 124, 3, 11, 14); m.put(128, 14, 'd');
  // ilha 8 + ilhas à deriva
  I(137, 150, 18); m.put(139, 17, 'K'); m.put(141, 17, 'h');
  m.put(152, 15, 's', { w: 3, ay: 1.5, period: 4 }); I(157, 158, 16, 2);
  m.put(161, 12, 's', { w: 3, ax: 2, period: 4.5 });
  m.line(151, 163, 11, 'o', 3);
  I(165, 180, 14); m.put(172, 13, 'f');
  rect(m, 181, 5, 182, 13, 'w'); m.put(180, 4, '*');         // ★2 (corrente)
  m.put(183, 11, 'q', { dx: 8, dy: 5 });
  I(188, 200, 17); m.put(190, 16, 'K'); m.put(192, 16, 'h'); m.put(196, 13, 'b');
  I(207, 215, 15); m.put(211, 10, 'g'); m.line(208, 214, 13, 'o', 2);
  m.put(203, 14, 's', { w: 2, ay: 1, period: 3 });
  I(222, 235, 17); m.put(223, 15, 'v'); m.put(224, 15, 'v');
  m.fill(225, 14, 226, 16, '#');
  m.fill(228, 11, 234, 16, '#'); m.clear(229, 14, 233, 16); m.fill(228, 14, 228, 16, 'Y');
  m.put(231, 16, '*'); m.line(229, 233, 10);                 // ★3
  m.put(218, 13, 's', { w: 3, ay: 1, period: 3.5 });
  I(242, 259, 16, 14); m.put(246, 15, 'a'); m.put(250, 11, 'g'); m.put(255, 15, 'E');
  m.put(238, 13, 's', { w: 3, ax: 1, period: 3 });

  registerLevel({
    ...W5, id: 'w5_2', index: 2, name: 'Ponte de Fios', subtitle: 'Mundo 5-2',
    music: 'w5_level', timeOfDay: 'day', parTime: 240, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
