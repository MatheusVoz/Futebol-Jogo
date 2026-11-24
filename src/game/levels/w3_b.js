// =============================================================================
// levels/w3_b.js — MUNDO 3 (Cidade dos Relógios Quebrados), fases 3 e 4.
//   w3_3 "Fábrica de Engrenagens" — esteiras (w), engrenagens-plataforma e serras
//         em trilho (m), robôs blindados (d → Descosturar), morcegos de engrenagem,
//         novelo levado pela esteira até a placa, bolha lenta sobre as serras.
//   w3_4 "Torre dos Registros" — subida em zigue-zague por 4 andares do arquivo:
//         pêndulos (p), portão do compasso (u), espinhos com relógios, poços de
//         subida com plataformas-relógio. Tique-Taque (w3_tique_3) + ficha
//         'w3_registry' (FIAPO — 1968).
// =============================================================================
import { registerLevel } from '../registry.js';
import { grid, W3, pit, back, clk, hide, npc } from './w3_a.js';

// =============================================================================
// w3_3 — Fábrica de Engrenagens. Chão na linha 24 (Tico em pé na 23).
// =============================================================================
{
  const m = grid(250, 30), G = 24;
  m.ground(0, 249, G);
  // --- segredo: volte à esquerda na largada (parede falsa) -------------------
  m.fill(0, 4, 8, 19, '%'); m.fill(8, 20, 8, 23, 'H');
  m.put(2, 23, 'X'); m.put(3, 23, 'r'); m.line(4, 7, 23); m.line(2, 7, 21);
  hide(m, 1, 20, 7, 23);
  // --- A: largada, esteira e primeiro robô -----------------------------------
  m.put(11, 23, 'P');
  m.sign(13, 23, 'w3_sign_factory');
  m.fill(16, 23, 23, 23, 'w'); m.props['16,23'] = { dir: 'r', speed: 60 }; m.line(16, 23, 21);
  m.sign(26, 23, 'w3_sign_rustbot'); m.put(25, 22, 'e');
  m.put(33, 23, 'd');
  // --- B: poço de engrenagens -------------------------------------------------
  pit(m, 38, 64, G);
  m.fill(44, 22, 45, 29, '%'); m.fill(51, 21, 52, 29, '%'); m.fill(58, 22, 59, 29, '%');
  m.put(41, 21, 'm', { size: 3, speed: 40 }); m.put(48, 19, 'm', { size: 3, speed: -40 });
  m.put(55, 19, 'm', { size: 3, speed: 40 }); m.put(62, 21, 'm', { size: 3, speed: -40 });
  m.arc(38, 18, 6, 2); m.arc(53, 16, 5, 2);
  m.fill(40, 8, 62, 8, '%');                                  // viga
  m.put(48, 9, 'g'); m.put(57, 9, 'g');
  m.put(60, 15, 'm', { size: 3, speed: 30, dy: -5, moveSpeed: 28 });   // elevador p/ a viga
  m.line(44, 52, 7, 'o', 2); m.put(54, 7, '*');               // ★1 (sobre a viga)
  // --- C: corredor de esteiras contra + serras -------------------------------
  m.put(67, 23, 'K'); m.put(69, 23, 'h');
  m.fill(71, 4, 101, 17, '%');
  m.sign(70, 23, 'w3_sign_saw');
  m.fill(73, 23, 86, 23, 'w'); m.props['73,23'] = { dir: 'l', speed: 45 };
  m.put(78, 19, 'm', { hazard: true, size: 2, dy: 3, moveSpeed: 40 });
  m.put(84, 18, 'g');
  m.put(91, 19, 'm', { hazard: true, size: 2, dx: 4, moveSpeed: 50 });
  m.line(74, 86, 21, 'o', 3);
  m.put(98, 23, 'd');
  // --- D: novelo na esteira → placa → portão ---------------------------------
  m.sign(103, 23, 'w3_sign_conveyor');
  m.obj({ type: 'boulder', x: 106, y: 23 });
  m.fill(108, 23, 116, 23, 'w'); m.props['108,23'] = { dir: 'r', speed: 40 };
  m.fill(118, 20, 118, 23, 'B'); m.line(108, 116, 20, 'o', 2);
  m.clear(121, G, 123, G); m.put(122, G, 'D', { signal: 'w33_gate' });
  m.fill(127, 4, 129, 19, '%'); m.put(128, 23, 'G', { signal: 'w33_gate' });
  // --- E: porta costurada + elevador de engrenagem (★2) ----------------------
  m.put(134, 23, 'b');
  m.fill(139, 11, 142, 11, '%'); m.line(139, 141, 10); m.put(142, 10, '*');  // ★2
  m.put(145, 21, 'm', { size: 3, speed: -30, dy: -8, moveSpeed: 30 });
  m.fill(150, 4, 151, 19, '%'); m.fill(150, 20, 151, 23, 'S');
  m.put(148, 23, 'e');
  // --- F: esteira rápida sob serras + bolha lenta -----------------------------
  m.put(155, 23, 'K'); m.put(157, 22, 'h');
  m.sign(158, 23, 'w3_sign_slow');
  m.fill(160, 4, 190, 14, '%');
  m.fill(161, 23, 186, 23, 'w'); m.props['161,23'] = { dir: 'r', speed: 55 };
  m.put(167, 16, 'm', { hazard: true, size: 2, dy: 5, moveSpeed: 55 });
  m.put(174, 20, 'q', { r: 3.5 });
  m.put(174, 16, 'm', { hazard: true, size: 2, dy: 5, moveSpeed: 55 });
  m.put(181, 16, 'm', { hazard: true, size: 2, dy: 5, moveSpeed: 55 });
  m.line(162, 186, 21, 'o', 4);
  m.put(170, 15, 'g'); m.put(184, 15, 'g');
  // --- G: abismo com blocos que desmoronam ------------------------------------
  pit(m, 193, 214, G);
  m.fill(200, 22, 201, 29, '%'); m.fill(208, 21, 209, 29, '%');
  m.fill(194, 22, 198, 22, 'C'); m.fill(202, 20, 206, 20, 'C'); m.fill(210, 21, 213, 21, 'C');
  m.line(194, 198, 20); m.line(202, 206, 18); m.line(210, 213, 19, 'o', 3);
  m.put(204, 13, 'f');
  // --- H: robôs, relógio que despenca (★3) e saída ---------------------------
  m.put(217, 23, 'K');
  m.put(222, 23, 'd');
  m.plat(226, 228, 19);
  m.put(230, 15, 'v', { trigger: 'below' });                  // Remendo → degrau fixo
  m.fill(232, 11, 234, 11, '%'); m.put(233, 10, '*');          // ★3
  m.put(236, 23, 'd'); m.put(240, 23, 'a');
  m.fill(242, 22, 249, 23, '%'); m.put(246, 21, 'E'); m.line(243, 245, 20);
  back(m, 9, 12, 30, 23); back(m, 102, 8, 126, 23); back(m, 130, 8, 149, 23); back(m, 215, 8, 241, 23);

  registerLevel({
    ...W3, id: 'w3_3', index: 3, name: 'Fábrica de Engrenagens', subtitle: 'Mundo 3-3',
    music: 'w3_level', timeOfDay: 'night', parTime: 260, darkness: 0.15,
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w3_4 — Torre dos Registros. 4 andares (pisos nas linhas 36, 27, 18, 9).
//   T1 → direita, poço A (direita) | T2 ← esquerda, poço B (esquerda)
//   T3 → direita, poço C (direita) | T4 (terraço) ← esquerda até a saída.
// =============================================================================
{
  const m = grid(200, 40);
  m.fill(0, 36, 199, 39, '%');                // piso T1
  m.fill(0, 27, 183, 28, '%');                // piso T2 / teto T1
  m.fill(16, 18, 199, 19, '%');               // piso T3 / teto T2
  m.fill(0, 9, 183, 12, '%');                 // terraço T4 / teto T3
  // ---------------------------------------------------------------- T1 (→)
  m.put(3, 35, 'P'); m.sign(6, 35, 'w3_sign_tower'); m.line(9, 14, 33);
  m.put(20, 35, 'a');
  pit(m, 31, 36, 36); pit(m, 39, 44, 36);
  clk(m, 32, 34, 3, 0); clk(m, 40, 34, 3, 1); m.line(32, 43, 31, 'o', 2);
  m.put(50, 35, 'b');
  m.sign(54, 35, 'w3_sign_pendulum');
  m.put(60, 29, 'p', { len: 5, amp: 50, period: 2.6 }); m.put(67, 29, 'p', { len: 5, amp: 50, period: 2.6, phase: 0.5 });
  m.put(74, 35, 'a');
  m.put(80, 35, 'K');
  m.fill(86, 35, 100, 35, 'w'); m.props['86,35'] = { dir: 'l', speed: 45 };
  m.put(93, 31, 'm', { hazard: true, size: 2, dy: 3, moveSpeed: 40 });
  m.put(108, 29, 'v', { trigger: 'below' }); m.put(113, 29, 'v', { trigger: 'below' });
  m.line(104, 116, 34, 'o', 3);
  m.put(125, 35, 'd'); m.put(122, 34, 'e');
  m.put(135, 29, 'g'); m.put(148, 29, 'g');
  // segredo T1: rachadura no piso
  m.put(140, 36, 'H'); m.put(141, 36, 'H');
  m.put(138, 38, 'X'); m.put(144, 38, 'r'); m.line(136, 137, 38); m.line(145, 146, 38);
  hide(m, 136, 37, 146, 38);
  m.put(156, 33, 'q', { r: 3 }); m.put(160, 31, 'f');
  m.put(172, 35, 'h'); m.put(178, 35, 'b');
  // poço A
  m.fill(194, 32, 196, 32, '%'); m.fill(188, 29, 190, 29, '%');
  m.put(197, 25, 'm', { size: 3, speed: 35 }); m.line(188, 190, 28);
  // ---------------------------------------------------------------- T2 (←)
  m.put(178, 26, 'K');
  m.put(168, 26, 'a');
  m.sign(126, 26, 'w3_sign_gate');
  m.fill(120, 20, 121, 23, '%'); m.put(120, 26, 'u', { open: 1.6, closed: 2.2, h: 3 }); m.put(121, 26, 'u', { open: 1.6, closed: 2.2, h: 3 });
  m.line(140, 160, 24, 'o', 4);
  m.put(150, 20, 'g');
  m.put(110, 26, 'a');
  m.put(100, 20, 'p', { len: 5, amp: 55, period: 2.4 }); m.put(92, 20, 'p', { len: 5, amp: 55, period: 2.4, phase: 0.5 });
  m.line(90, 102, 25, 'o', 4);
  m.put(80, 26, 'b');
  m.fill(60, 26, 74, 26, 'w'); m.props['60,26'] = { dir: 'r', speed: 45 };
  m.line(60, 74, 24, 'o', 3);
  m.put(52, 26, 'd'); m.put(48, 25, 'e');
  m.put(40, 20, 'g');
  m.fill(30, 20, 31, 22, '%'); m.fill(30, 23, 31, 26, 'S');
  m.put(22, 26, 'h');
  // poço B (★1 nos relógios do canto)
  m.fill(4, 23, 6, 23, '%'); m.fill(10, 20, 12, 20, '%');
  clk(m, 7, 17, 2, 0); clk(m, 2, 15, 2, 1); m.put(2, 13, '*');  // ★1
  // ---------------------------------------------------------------- T3 (→)
  m.put(20, 17, 'K');
  npc(m, 32, 17, 'tique_taque', 'w3_tique_3');
  m.sign(38, 17, 'w3_registry');
  m.line(44, 52, 15, 'o', 2);
  m.fill(60, 17, 65, 17, '^'); m.fill(66, 16, 66, 17, '%'); m.fill(67, 17, 72, 17, '^');
  clk(m, 61, 15, 2, 0); clk(m, 69, 15, 2, 1); m.put(66, 14, 'o'); m.line(61, 62, 14); m.line(69, 70, 14);
  m.put(80, 17, 'b'); m.put(90, 17, 'a');
  m.put(100, 13, 'v', { trigger: 'below' });
  m.put(110, 15, 'm', { hazard: true, size: 2, dx: 6, moveSpeed: 45 });
  m.put(122, 14, 'f'); m.put(130, 17, 'd'); m.put(127, 16, 'e');
  m.put(140, 13, 'p', { len: 4, amp: 50, period: 2.6 }); m.put(150, 13, 'p', { len: 4, amp: 50, period: 2.6, phase: 0.5 });
  m.put(145, 15, 'q', { r: 3 });
  m.put(162, 13, 'g'); m.put(172, 13, 'g');
  m.line(155, 175, 16, 'o', 4);
  m.put(180, 17, 'h');
  // poço C (★2 num desvio)
  m.fill(194, 14, 196, 14, '%'); m.fill(188, 11, 190, 11, '%');
  clk(m, 196, 8, 2, 0); m.put(198, 6, '*');                   // ★2
  // ---------------------------------------------------------------- T4 (←)
  m.put(170, 8, 'a');
  m.fill(151, 8, 156, 8, '^'); m.put(153, 4, 'l', { len: 3, speed: 45 });
  m.put(140, 8, 'b'); m.line(140, 148, 5, 'o', 2);
  m.fill(128, 3, 129, 5, '%'); m.put(128, 8, 'u', { open: 1.4, closed: 2, h: 3 }); m.put(129, 8, 'u', { open: 1.4, closed: 2, h: 3 });
  m.put(115, 5, 'f');
  m.fill(96, 8, 101, 8, '^'); m.fill(102, 7, 102, 8, '%'); m.fill(103, 8, 108, 8, '^');
  clk(m, 97, 6, 2, 1, 2.4); clk(m, 105, 6, 2, 0, 2.4); m.line(97, 107, 4, 'o', 2);
  m.put(80, 8, 'd');
  m.put(70, 4, 'v', { trigger: 'below' });
  m.put(60, 8, 'a'); m.put(50, 8, 'b');
  // segredo T4 (★3): rachadura no terraço
  m.put(36, 9, 'H'); m.put(37, 9, 'H');
  m.put(31, 11, 'X'); m.put(33, 11, '*'); m.line(39, 41, 11); m.put(29, 11, 'h');   // ★3
  hide(m, 28, 10, 42, 11);
  m.put(15, 8, 'b');
  m.fill(1, 7, 8, 8, '%'); m.put(4, 6, 'E'); m.line(9, 12, 6);
  back(m, 0, 29, 183, 35); back(m, 16, 20, 183, 26); back(m, 16, 13, 183, 17);

  registerLevel({
    ...W3, id: 'w3_4', index: 4, name: 'Torre dos Registros', subtitle: 'Mundo 3-4',
    music: 'w3_calm', timeOfDay: 'day', parTime: 300, darkness: 0,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
