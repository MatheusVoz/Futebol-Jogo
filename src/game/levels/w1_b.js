// =============================================================================
// levels/w1_b.js — MUNDO 1 (Floresta dos Brinquedos Perdidos), fases 3 e 4.
//   w1_3 "Trilha dos Brinquedos Quebrados" (entardecer) — Pip foge, cogumelos-bomba,
//         ponte de blocos com pássaros de papel, ravina vertical com elevador (F) e
//         plataformas que caem (W); trilha alta e descida até a saída.
//   w1_4 "Raízes Sussurrantes" (entardecer, caverna escura) — oco da árvore com
//         bifurcação: rota de cima (cogumelos/marionete) e rota funda (ursinhos
//         corrompidos + chave do Pip). Pip pede ajuda no começo e agradece no fim.
// Mapas montados com grid() de w1_a.js.
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid } from './w1_a.js';

// =============================================================================
// w1_3 — Trilha dos Brinquedos Quebrados. Chão na linha 22 (Tico em pé na 21).
// =============================================================================
{
  const m = grid(260, 30);
  const G = 22;
  const block = (x0, x1, top) => m.fill(x0, top, x1, top + 1, '%'); // bloco de brinquedo (2 de altura)
  m.ground(0, 37, G);
  // --- A: trilha dos brinquedos + Pip foge -------------------------------------
  m.put(3, 21, 'P');
  m.sign(7, 21, 'w1_sign_toys');
  m.fill(12, 20, 13, 21, '%'); m.put(14, 21, '%'); m.line(12, 14, 18);
  m.plat(18, 20, 18); m.line(18, 20, 17);
  m.line(23, 27, 20);
  m.sign(28, 21, 'w1_sign_pip');
  m.put(33, 21, 'n', { npc: 'pip', dialog: 'w1_pip_1', flee: true });
  m.arc(38, 19, 3, 1);                                         // vão 3
  m.ground(41, 99, G);
  // --- B: cogumelos-bomba ------------------------------------------------------
  m.sign(44, 21, 'w1_sign_boom');
  m.put(50, 21, 'd');
  m.fill(55, 20, 62, 21, '%'); m.put(59, 19, 'd'); m.line(56, 61, 18, 'o', 2);
  m.clear(66, G, 69, 29); m.arc(66, 19, 4, 2);                 // vão 4
  m.put(73, 21, 'd');
  m.plat(76, 79, 18); m.line(76, 79, 17);
  m.put(80, 21, 'a');
  m.fill(83, 20, 84, 21, '%'); m.put(84, 19, '*');             // ★1 (fácil)
  m.put(88, 21, 'K');
  m.put(94, 21, 'd');
  m.sign(97, 21, 'w1_sign_birds');
  // --- C: ponte de blocos sobre o abismo + pássaros de papel -------------------
  block(102, 104, 21); m.line(102, 104, 20 - 1);
  block(108, 110, 19); m.arc(105, 18, 3, 1);
  block(114, 116, 20); m.arc(111, 17, 3, 1);
  block(120, 123, 18); m.line(120, 123, 17 - 1);
  block(128, 130, 20); m.arc(124, 17, 4, 1);
  block(134, 136, 19); m.arc(131, 18, 3, 1);
  block(140, 142, 21); m.arc(137, 18, 3, 1);
  m.put(112, 13, 'g'); m.put(132, 12, 'g');
  m.ground(146, 187, G);
  // --- D: ravina vertical (chão seguro embaixo) --------------------------------
  m.put(150, 21, 'K');
  m.sign(153, 21, 'w1_sign_climb');
  m.put(158, 20, 'F', { dy: -8, speed: 34, pause: 1 });       // elevador: linha 20 → 12
  m.fill(162, 12, 165, 12, '%'); m.line(162, 165, 11);        // patamar
  m.put(168, 12, 'W', { width: 2 }); m.put(168, 10, 'o');
  m.put(172, 11, 'W', { width: 2 }); m.put(173, 9, 'o');
  m.put(176, 10, 'W', { width: 2 }); m.put(176, 8, 'o');
  m.put(180, 10, 'W', { width: 2 }); m.put(181, 8, 'o');
  m.fill(184, 10, 186, 10, '%');
  // rota "expert" (blocos isolados, pulos de 4 + dash)
  m.put(185, 18, '%'); m.put(182, 14, '%');
  // nicho opcional à esquerda (★2): elevador → plataforma que cai → borda
  m.put(155, 10, 'W', { width: 2 });
  m.fill(149, 9, 153, 9, '%'); m.put(150, 8, '*'); m.line(151, 153, 8);
  // penhasco + trilha alta
  m.ground(188, 229, 9);
  // sala secreta 1 na base do penhasco (parede falsa)
  m.fill(188, 20, 188, 21, 'H'); m.clear(189, 18, 195, 21);
  m.put(190, 21, 'X'); m.line(191, 193, 19); m.put(194, 21, 'r'); m.put(195, 21, 'h');
  // --- E: trilha alta, chão falso (segredo 2 / ★3) e descida -------------------
  m.put(192, 8, 'o'); m.put(194, 8, 'o');
  m.put(199, 3, 'g');
  m.fill(205, 9, 206, 10, 'H');                                // chão falso
  m.clear(201, 11, 210, 14); m.plat(205, 206, 12);
  m.put(202, 14, '*'); m.put(208, 14, 'X'); m.line(203, 207, 14, 'o', 2);
  m.line(201, 204, 7); m.line(207, 210, 7);                    // botões "desviam" do buraco
  m.put(210, 8, 'K');
  m.put(215, 8, 'd');
  m.put(221, 8, 'a');
  m.put(226, 4, 'g');
  m.ground(230, 235, 13); m.line(231, 234, 12);
  m.ground(236, 241, 17); m.put(239, 16, 'b');
  m.ground(242, 259, G);
  m.line(244, 250, 20);
  m.put(255, 21, 'E');

  registerLevel({
    id: 'w1_3', world: 1, index: 3, name: 'Trilha dos Brinquedos Quebrados', subtitle: 'Mundo 1-3',
    music: 'w1_level', tileset: 'w1', background: 'w1', timeOfDay: 'dusk', parTime: 200,
    darkness: 0, ambient: 'w1_fireflies', oxygen: false,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w1_4 — Raízes Sussurrantes. Superfície (chão 10) e o oco da árvore (':' fundo).
// =============================================================================
{
  const m = grid(240, 34);
  const cave = (x0, y0, x1, y1) => m.fill(x0, y0, x1, y1, ':');
  const PIP = { npc: 'pip', dialog: 'w1_pip_2', quest: 'pip_key', dialogDone: 'w1_pip_3', reward: 15 };
  m.ground(0, 24, 10);
  m.fill(25, 0, 239, 33, '#');
  // --- superfície + entrada --------------------------------------------------
  m.put(3, 9, 'P');
  m.line(6, 10, 8);
  m.put(16, 9, 'n', PIP);
  cave(25, 5, 42, 9);
  m.sign(28, 9, 'w1_sign_roots');
  m.line(31, 37, 8);
  // poço A (degraus para voltar)
  cave(39, 5, 46, 21);
  m.plat(40, 42, 19); m.plat(43, 45, 16); m.plat(40, 42, 13);
  m.line(43, 45, 15); m.put(41, 18, 'o');
  // --- corredor B: ursinho corrompido --------------------------------------------
  cave(47, 16, 92, 21);
  m.put(49, 21, 'K');
  m.sign(52, 21, 'w1_sign_bear');
  m.line(58, 70, 20, 'o', 2);
  m.put(76, 21, 'f');
  m.sign(83, 21, 'w1_sign_key');
  // poço C (bifurcação: sobe para a caverna D, desce para as raízes fundas E)
  cave(86, 6, 92, 31);
  m.plat(86, 88, 19); m.plat(90, 92, 16);
  m.plat(86, 88, 29); m.plat(90, 92, 26); m.plat(86, 88, 23);
  // segredo 2 (fundo do poço C, parede falsa): retalho
  m.fill(85, 30, 85, 31, 'H'); cave(78, 28, 84, 31);
  m.put(79, 31, 'r'); m.put(81, 31, 'X'); m.line(80, 83, 29, 'o', 1);
  // --- caverna D (rota de cima) ----------------------------------------------
  cave(93, 5, 158, 14);
  m.put(100, 14, 'a');
  m.put(97, 14, '@', { group: 'd2' });                          // fio em rampa → ★2
  m.fill(103, 9, 107, 9, '%'); m.put(104, 8, '@', { group: 'd2' });
  m.line(105, 106, 8); m.put(107, 8, '*');
  cave(106, 15, 110, 16); m.fill(106, 17, 110, 17, '^');       // fosso de espinhos (5)
  m.put(105, 14, '@', { group: 'd1' }); m.put(111, 14, '@', { group: 'd1' });
  m.arc(106, 12, 5, 1);
  m.put(118, 14, 'K');
  m.put(121, 14, 'd');
  m.fill(124, 12, 127, 14, '%'); m.line(124, 125, 11); m.put(126, 11, '*'); // ★1
  // chão falso (segredo 1 / ★3)
  m.fill(131, 15, 132, 15, 'H'); cave(128, 16, 136, 19); m.plat(131, 132, 17);
  m.put(129, 19, '*'); m.put(135, 19, 'X'); m.put(134, 19, 'e'); m.line(130, 133, 19);
  m.put(137, 14, 'b');
  m.fill(141, 5, 142, 9, '%'); m.fill(148, 5, 148, 8, '%');    // raízes pendentes
  m.line(144, 154, 13, 'o', 2);
  m.put(152, 14, 'a');
  // --- raízes fundas E (rota de baixo, chave do Pip) ---------------------------
  cave(93, 24, 158, 31);
  m.sign(95, 31, 'w1_sign_whisper');
  m.put(108, 31, 'f');
  m.put(115, 31, 'K');
  m.fill(118, 31, 120, 31, '^'); m.arc(117, 29, 5, 2);
  m.put(126, 31, 'd');
  m.fill(134, 29, 135, 31, '%'); m.plat(138, 142, 28);
  m.put(140, 27, 'q', { quest: 'pip_key', item: 'Chave de corda', sprite: 'key', text: 'Chave de corda do Pip!' });
  m.line(138, 139, 27); m.line(141, 142, 27);
  m.put(148, 31, 'f');
  m.put(155, 31, 'h');
  // poço F (junta as duas rotas)
  cave(159, 5, 163, 31);
  m.plat(162, 163, 29); m.plat(159, 160, 26); m.plat(162, 163, 23); m.plat(159, 160, 20); m.plat(162, 163, 17);
  m.plat(159, 163, 15);
  m.put(161, 27, 'o'); m.put(161, 21, 'o');
  // --- seção G: fosso com ilhós, nicho costurado, ursinho, Pip e saída ---------
  cave(164, 4, 233, 14);
  m.put(169, 14, 'K');
  cave(176, 15, 180, 16); m.fill(176, 17, 180, 17, '^');
  m.put(175, 14, '@', { group: 'g1' }); m.put(181, 14, '@', { group: 'g1' });
  m.arc(176, 12, 5, 1);
  m.sign(184, 14, 'w1_sign_seam');
  cave(186, 15, 190, 18); m.put(190, 18, '%'); m.fill(186, 15, 190, 15, 'S');
  m.put(188, 18, 'c', { contents: 'buttons:15' });
  m.line(193, 200, 12);
  m.put(203, 14, 'f');
  m.fill(208, 11, 210, 14, '%'); m.line(208, 210, 10);
  m.put(214, 14, 'a');
  m.fill(218, 4, 219, 8, '%');
  m.line(220, 224, 13);
  m.put(226, 14, 'n', PIP);
  m.put(231, 14, 'E');

  registerLevel({
    id: 'w1_4', world: 1, index: 4, name: 'Raízes Sussurrantes', subtitle: 'Mundo 1-4',
    music: 'w1_calm', tileset: 'w1', background: 'w1', timeOfDay: 'dusk', parTime: 210,
    darkness: 0.4, ambient: 'w1_spores', oxygen: false,
    legend: { q: 'quest_item' },
    map: m.build(), props: m.props, objects: m.objects,
  });
}
