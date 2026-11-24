// =============================================================================
// levels/w2_c.js — MUNDO 2 (Oceano das Lágrimas), fase 5 e bônus.
//   w2_5 "Fossa Escura" — noite profunda, OXIGÊNIO. Poço de descida, túnel do
//         primeiro redemoinho, cavernas com bolsões de ar e espreitadores
//         (plataformas penduradas), loja da Agulheta, zona funda com redemoinhos,
//         marujo 3/3, sala secreta sob o "chão" com a memória mem_3, Capitã Bolha
//         no fim (w2_bolha_3 / conclusão da missão).
//   w2_bonus "Corrente Turbulenta" — desafio: pistas de correnteza, cascatas que
//         alternam para cima/baixo, túnel contra a corrente com redes costuradas,
//         cadeia de redemoinhos e o fio antigo no final.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, current, marujo } from './w2_a.js';

// =============================================================================
// w2_5 — Fossa Escura. Água nas linhas 7–33; cavernas com ar nas linhas 10–21.
// =============================================================================
{
  const m = grid(240, 40);
  m.ground(0, 239, 34);
  m.fill(11, 7, 239, 33, '~');
  /** Caverna com bolsão de ar: teto de rocha 0–9, ar 10–21, água 22–33. */
  const cavern = (x0, x1) => { m.fill(x0, 0, x1, 9, '#'); m.fill(x0, 10, x1, 21, ':'); };
  // --- A: borda da fossa e poço de descida -------------------------------------
  m.ground(0, 10, 7);
  m.put(2, 6, 'P'); m.sign(5, 6, 'w2_sign_trench'); m.put(8, 6, 'h');
  m.fill(11, 14, 30, 33, '#');
  m.put(16, 7, 'u', { dialog: 'w2_bottle_3' });
  m.put(20, 13, 'l'); m.put(25, 10, 'a');
  m.line(13, 29, 11, 'o', 4);
  m.put(34, 18, 'b'); m.put(33, 33, 'l');
  for (let y = 15; y <= 31; y += 4) m.put(36, y, 'o');
  m.fill(39, 0, 60, 26, '#');
  // --- B: túnel do primeiro redemoinho -----------------------------------------
  m.sign(41, 33, 'w2_sign_whirl');
  m.put(46, 30, 'q', { r: 3, fling: 'r', power: 430 });
  m.fill(52, 33, 58, 33, '^');
  m.line(49, 58, 28, 'o', 3);
  // --- C: caverna 1 — loja, checkpoint e lagoa dos espreitadores ---------------
  cavern(61, 100);
  m.plat(61, 63, 20);
  m.fill(64, 18, 72, 21, '#');
  m.put(65, 17, 'K'); m.put(68, 17, 'U'); m.put(71, 17, 'h');
  m.sign(73, 17, 'w2_sign_lurker');
  for (const x of [76, 82, 88]) { m.plat(x, x + 2, 17); m.put(x + 1, 15, 'o'); }
  m.put(79, 14, 'o'); m.put(85, 14, 'o'); m.put(91, 14, 'o');
  m.put(78, 23, 'f'); m.put(88, 23, 'f');
  m.fill(93, 18, 100, 21, '#'); m.put(96, 17, 'e'); m.put(98, 17, 'o');
  m.line(75, 99, 31, 'o', 6);
  m.fill(101, 0, 103, 26, '#');
  // --- D: zona funda — redemoinhos, marujo, sala secreta (mem_3) ----------------
  m.fill(104, 0, 150, 9, '#');
  m.put(112, 33, 'l'); m.put(130, 33, 'l'); m.put(148, 33, 'l');
  m.put(110, 25, 'a'); m.put(125, 29, 'a'); m.put(140, 14, 'a');
  m.put(120, 13, 'b'); m.put(145, 24, 'b');
  m.put(116, 20, 'q', { r: 3, fling: 'r', power: 420 });
  m.fill(118, 33, 124, 33, '^');
  m.fill(126, 10, 130, 11, '#'); marujo(m, 128, 12);            // marujo 3/3 sob a saliência
  m.line(106, 114, 16, 'o', 4); m.line(132, 146, 19, 'o', 2);
  m.put(135, 30, 'q', { r: 3, fling: 'u', power: 380 });
  m.fill(138, 34, 139, 34, 'H');                                // "chão" falso — segredo
  m.put(136, 33, 'o'); m.put(137, 33, 'o');
  m.fill(134, 35, 146, 38, '~');
  m.put(135, 38, 'l'); m.put(140, 37, 'X'); m.line(141, 143, 36);
  m.put(145, 37, 'M', { memory: 'mem_3' });
  m.fill(151, 0, 153, 26, '#');
  // --- E: caverna 2 — plataformas penduradas, ★2 no teto ------------------------
  cavern(154, 195);
  m.plat(155, 157, 20);
  m.fill(158, 18, 164, 21, '#'); m.put(160, 17, 'K'); m.put(163, 17, 'h');
  for (const x of [167, 173, 179, 185]) { m.plat(x, x + 2, 17); m.put(x + 1, 16, 'o'); }
  m.plat(176, 178, 13); m.put(177, 12, '*');
  m.put(170, 23, 'f'); m.put(182, 23, 'f');
  m.fill(191, 18, 195, 21, '#'); m.put(193, 17, 'e');
  m.line(166, 190, 30, 'o', 6);
  m.put(160, 28, 'a');
  m.fill(196, 0, 198, 26, '#');
  // --- F: último mergulho, ★3 entre ouriços, caverna da saída -------------------
  m.fill(199, 0, 215, 9, '#');
  m.put(201, 27, 'l');
  m.fill(205, 33, 214, 33, '^'); m.put(209, 32, '*');
  m.put(206, 24, 'a'); m.put(211, 15, 'b');
  m.line(200, 212, 13, 'o', 3);
  m.fill(213, 10, 215, 26, '#');
  cavern(216, 239);
  m.put(218, 22, 'n', { npc: 'capita_bolha', dialog: 'w2_bolha_3', quest: 'bolha_crew', dialogDone: 'w2_bolha_3_done', reward: 30 });
  m.plat(220, 221, 19);
  m.ground(222, 239, 18);
  m.put(224, 17, 'K'); m.line(227, 233, 16, 'o', 2);
  m.put(236, 17, 'E');

  registerLevel({
    id: 'w2_5', world: 2, index: 5, name: 'Fossa Escura', subtitle: 'Mundo 2-5',
    music: 'w2_calm', tileset: 'w2', background: 'w2', timeOfDay: 'night', parTime: 260,
    darkness: 0.5, ambient: 'w2_plankton', oxygen: true, oxygenTime: 18,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w2_bonus — Corrente Turbulenta. Superfície na linha 6, fundo na 28.
// =============================================================================
{
  const m = grid(220, 30);
  m.ground(0, 219, 28);
  m.fill(9, 6, 219, 27, '~');
  m.ground(0, 8, 6);
  m.put(2, 5, 'P'); m.sign(5, 5, 'w2_sign_bonus');
  // --- A: pista da correnteza com rochas espinhosas -----------------------------
  current(m, 10, 8, 30, 18, 'r', 300);
  m.fill(18, 14, 20, 20, '#'); m.fill(17, 14, 17, 20, '^'); m.fill(21, 14, 21, 20, '^');
  m.fill(28, 6, 30, 13, '#'); m.fill(28, 14, 30, 14, '^');
  m.fill(34, 21, 36, 27, '#'); m.fill(34, 20, 36, 20, '^');
  m.line(12, 16, 10, 'o', 2); m.line(22, 27, 22, 'o', 2); m.line(31, 38, 12, 'o', 2);
  m.put(24, 27, 'l');
  // --- B: redemoinho e ★1 entre ouriços ----------------------------------------
  m.put(48, 18, 'q', { r: 3, fling: 'u', power: 420 });
  m.fill(52, 27, 54, 27, '^'); m.put(55, 26, '*'); m.fill(56, 27, 58, 27, '^');
  m.line(44, 52, 10, 'o', 2); m.put(45, 27, 'l');
  m.fill(60, 5, 64, 27, '#'); m.put(61, 4, 'K'); m.put(63, 4, 'h');
  // --- C: cascatas alternadas sobre ouriços ------------------------------------
  m.fill(65, 27, 98, 27, '^');
  for (const [x, dir] of [[68, 'd'], [76, 'u'], [84, 'd'], [92, 'u']]) {
    current(m, x, 7, 4, 20, dir, 300);
    for (let y = 10; y <= 24; y += 7) m.put(x + 1, y, 'o');
  }
  m.fill(76, 27, 79, 27, '#'); m.put(77, 26, 'l');
  m.fill(92, 27, 95, 27, '#'); m.put(93, 26, 'l');
  m.put(81, 15, 'b'); m.put(89, 20, 'a');
  // --- D: túnel contra a corrente com redes costuradas -------------------------
  m.fill(104, 6, 138, 17, '#');
  m.fill(120, 15, 122, 17, '~'); m.put(121, 16, '*');          // ★2 no nicho
  current(m, 104, 19, 35, 7, 'l', 200);
  m.fill(115, 18, 115, 27, 'S'); m.fill(128, 18, 128, 27, 'S');
  m.put(110, 27, 'l'); m.put(122, 27, 'l'); m.put(134, 27, 'l');
  m.line(106, 136, 23, 'o', 3);
  m.put(100, 20, 'e'); m.put(126, 22, 'e');
  m.fill(141, 5, 145, 27, '#'); m.put(142, 4, 'K'); m.put(144, 4, 'h');
  // --- E: cadeia de redemoinhos -------------------------------------------------
  m.fill(147, 27, 190, 27, '^');
  m.put(152, 18, 'q', { r: 3, fling: 'r', power: 420 });
  m.put(165, 20, 'q', { r: 3, fling: 'r', power: 420 });
  m.put(178, 16, 'q', { r: 3, fling: 'u', power: 400 });
  m.put(171, 9, '*');                                           // ★3 entre os redemoinhos
  m.put(158, 10, 'b'); m.put(184, 22, 'b'); m.put(160, 25, 'a');
  m.line(148, 190, 12, 'o', 3);
  m.fill(168, 20, 170, 26, '#'); m.put(169, 19, 'l');
  // --- F: subida final, fio antigo e saída --------------------------------------
  current(m, 192, 8, 4, 19, 'u', 300);
  m.ground(197, 219, 6);
  m.put(203, 5, 'T'); m.line(206, 212, 4, 'o', 2);
  m.put(216, 5, 'E');

  registerLevel({
    id: 'w2_bonus', world: 2, index: 7, name: 'Corrente Turbulenta', subtitle: 'Mundo 2 - Bônus',
    music: 'w2_level', tileset: 'w2', background: 'w2', timeOfDay: 'dusk', parTime: 170,
    darkness: 0, ambient: 'w2_bubbles', oxygen: true, oxygenTime: 20, bonus: true,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
