// =============================================================================
// levels/w4_a.js — MUNDO 4 (O Pesadelo Debaixo da Cama), fases 1 e 2.
//   w4_1 "Debaixo da Cama" — Luzinha se junta; poça de sombra, mão sob o chão,
//         abajures, altar do Retalho Fantasma (placa de pressão + portão),
//         caixa-surpresa, cômoda com sala escondida.
//   w4_2 "Corredor dos Armários" — furtividade: esconderijos, portas de armário
//         temporizadas, assoalho que range, guarda-roupas vivos, alavanca que
//         acende abajures sobre a poça de sombra, armário secreto.
// Todas as fases do W4: escuras (darkness ~0.8) com a Luzinha (luzinha: true).
// Também exporta os utilitários de montagem do W4 usados por w4_b.js e w4_c.js.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid } from './w1_a.js';

export { grid };

/** Parede do teto até G-6 com portão (sinal) de 5 tiles na coluna x. */
export function gateWall(m, x, G, signal, extra = {}) {
  m.fill(x, 0, x + 1, G - 6, '%');
  return m.put(x, G - 1, 'G', { signal, height: 5, ...extra });
}

/** Parede do teto até G-4 com porta de armário (3 tiles) na coluna x. */
export function closet(m, x, G, props = {}) {
  m.fill(x, 0, x + 1, G - 4, '%');
  m.fill(x, G - 3, x, G - 1, 'v');
  m.props[`${x},${G - 3}`] = { open: 2, closed: 2.5, ...props };
  return m;
}

/** Buraco (vão até o fundo do mapa) de x0 a x1. */
export const pit = (m, x0, x1, G) => m.clear(x0, G, x1, m.H - 1);

// =============================================================================
// w4_1 — Debaixo da Cama. Chão na linha 22 (Tico em pé na 21). Estrado no teto.
// =============================================================================
{
  const G = 22;
  const m = grid(230, 28);
  m.ground(0, 229, G);
  m.fill(0, 0, 122, 2, '%');                                    // estrado da cama
  // --- A: Luzinha ---------------------------------------------------------------
  m.put(3, 21, 'P');
  m.put(8, 21, 'n', { npc: 'luzinha', dialog: 'w4_luzinha_1' });
  m.sign(12, 21, 'w4_sign_dark');
  m.put(16, 21, 'm', { on: false });
  m.plat(19, 24, 18); m.line(19, 24, 17, 'o', 2);
  m.put(26, 21, 'o'); m.put(27, 21, 'o');
  // --- B: poça de sombra, mão sob o chão, caixotes ------------------------------
  m.sign(29, 21, 'w4_sign_pool');
  m.fill(31, 21, 36, 21, 'p');
  m.put(38, 21, 'm', { on: true, radius: 4 });
  m.line(31, 36, 18, 'o', 2);
  m.sign(40, 21, 'w4_sign_hand');
  m.put(44, 21, 'a');
  m.arc(42, 19, 5, 2);
  m.fill(49, 19, 52, 21, '%'); m.line(49, 52, 18);
  m.put(54, 21, 'h');
  // --- C: altar do Retalho Fantasma + primeiro portão ----------------------------
  m.sign(57, 21, 'w4_sign_decoy');
  m.put(60, 21, 'Q', { ability: 'decoy' });
  m.put(63, 21, 'e');
  m.put(66, 21, 'D', { signal: 'w41_g1' });
  gateWall(m, 72, G, 'w41_g1');
  m.line(75, 79, 21, 'o', 2);
  m.put(81, 21, 'K');
  // --- D: bonecas, caixa-surpresa (★1), sombra e abajur -------------------------
  m.put(88, 21, 'b');
  m.sign(93, 21, 'w4_sign_toybox');
  m.put(97, 21, 'u', { height: 9 });
  m.plat(99, 104, 11); m.put(102, 10, '*'); m.put(100, 10, 'o'); m.put(104, 10, 'o');
  m.fill(106, 17, 108, 21, '%'); m.put(107, 16, 'o');
  m.sign(110, 21, 'w4_sign_lamp');
  m.put(112, 21, 'm', { on: false, radius: 5 });
  m.put(118, 21, 'd');
  m.line(114, 120, 18, 'o', 3);
  // --- E: fora da cama — vão, cômoda com sala escondida (segredo, ★3) -------------
  pit(m, 126, 129, G); m.arc(126, 19, 4, 2);
  m.fill(134, 13, 146, 21, '%');
  m.fill(134, 18, 135, 21, 'H'); m.fill(136, 18, 145, 21, ':');
  m.put(137, 21, 'X'); m.line(138, 141, 19); m.put(143, 21, '*'); m.put(144, 21, 'r');
  m.plat(131, 133, 17);
  m.line(136, 145, 12, 'o', 3);
  m.put(150, 21, 'a');
  m.put(156, 21, 'K'); m.put(158, 21, 'h');
  // --- F: portão longe da placa (corra!), boneca, ★2 e saída ---------------------
  m.put(162, 21, 'D', { signal: 'w41_g2' });
  m.sign(160, 21, 'w4_sign_decoy2');
  m.line(164, 174, 20, 'o', 3);
  gateWall(m, 176, G, 'w41_g2');
  m.put(183, 21, 'b');
  m.plat(187, 191, 16); m.put(189, 15, '*');
  m.plat(181, 184, 18);
  m.put(195, 21, 'm', { on: false });
  m.put(199, 21, 'd');
  pit(m, 205, 208, G); m.arc(205, 19, 4, 2);
  m.put(212, 21, 'a');
  m.fill(218, 20, 229, 21, '%'); m.fill(222, 19, 229, 19, '%');
  m.put(217, 21, 'o'); m.put(220, 19, 'o');
  m.put(226, 18, 'E');

  registerLevel({
    id: 'w4_1', world: 4, index: 1, name: 'Debaixo da Cama', subtitle: 'Mundo 4-1',
    music: 'w4_calm', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 190,
    darkness: 0.75, ambient: 'w4_dust', oxygen: false, luzinha: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w4_2 — Corredor dos Armários. Chão na linha 20 (Tico em pé na 19). Teto 0–3.
// =============================================================================
{
  const G = 20;
  const m = grid(240, 26);
  m.ground(0, 239, G);
  m.fill(0, 0, 239, 3, '%');
  // --- A: esconderijo e primeira sombra ----------------------------------------
  m.put(2, 19, 'P');
  m.sign(5, 19, 'w4_sign_hide');
  m.put(9, 19, 'l');
  m.put(14, 19, 'm', { on: false });
  m.put(22, 19, 'd');
  m.plat(16, 20, 16); m.line(16, 20, 15, 'o', 2);
  m.line(24, 30, 18, 'o', 2);
  // --- B: porta de armário e assoalho que range ---------------------------------
  m.sign(31, 19, 'w4_sign_closet');
  closet(m, 34, G);
  m.sign(37, 19, 'w4_sign_creak');
  m.fill(39, 20, 47, 20, 'q');
  m.plat(40, 45, 15); m.line(40, 45, 14, 'o', 2);
  m.put(49, 19, 'l');
  m.put(54, 19, 'd');
  m.put(58, 19, 'h');
  // --- C: guarda-roupas vivos (passe por cima) -----------------------------------
  m.put(66, 19, 'g');
  m.plat(61, 70, 14); m.line(62, 69, 13, 'o', 3);
  m.put(74, 19, 'K'); m.put(76, 19, 'l');
  m.put(84, 19, 'g');
  m.plat(79, 89, 14); m.line(80, 88, 13, 'o', 4);
  m.put(92, 19, 'e');
  // --- D: alavanca acende abajures sobre a poça (★1) ----------------------------
  m.sign(97, 19, 'w4_sign_lever');
  m.put(100, 19, 'L', { signal: 'w42_l', latch: true });
  m.fill(104, 19, 117, 19, 'p');
  m.put(103, 19, 'm', { signal: 'w42_l', radius: 5 });
  m.put(118, 19, 'm', { signal: 'w42_l', radius: 5 });
  m.plat(108, 113, 14); m.put(110, 13, '*'); m.put(109, 13, 'o'); m.put(112, 13, 'o');
  m.put(111, 19, 'a');
  // --- E: salão das portas, bonecas e armário secreto (★2) ----------------------
  closet(m, 124, G, { offset: 0 });
  m.line(127, 131, 18, 'o', 2);
  closet(m, 134, G, { offset: 1.2 });
  m.put(140, 19, 'b');
  m.put(145, 19, 'l', { kind: 'blanket' });
  m.put(150, 19, 'b');
  m.fill(155, 9, 164, 19, '%');
  m.fill(155, 15, 156, 19, 'H'); m.fill(157, 15, 163, 19, ':');
  m.put(158, 19, 'X'); m.line(159, 161, 17); m.put(162, 19, '*'); m.put(163, 19, 'r');
  m.plat(151, 153, 14); m.line(156, 163, 8, 'o', 3);   // degraus por cima do armário
  m.put(168, 19, 'K');
  // --- F: corredor que range, sombras, caixa-surpresa (★3) e saída --------------
  m.fill(173, 20, 192, 20, 'q');
  m.put(180, 19, 'l'); m.put(186, 19, 'd'); m.put(196, 19, 'l'); m.put(199, 19, 'd');
  m.line(175, 191, 17, 'o', 4);
  m.put(203, 19, 'u', { height: 9 });
  m.plat(206, 209, 15); m.plat(201, 204, 10); m.put(203, 9, '*'); m.put(202, 9, 'o');
  m.put(212, 19, 'a');
  m.put(218, 19, 'g'); m.plat(214, 222, 15); m.line(215, 221, 14, 'o', 3);
  m.put(226, 19, 'h');
  m.put(230, 19, 'o'); m.put(232, 19, 'o');
  m.put(236, 19, 'E');

  registerLevel({
    id: 'w4_2', world: 4, index: 2, name: 'Corredor dos Armários', subtitle: 'Mundo 4-2',
    music: 'w4_level', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 210,
    darkness: 0.8, ambient: 'w4_dust', oxygen: false, luzinha: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
