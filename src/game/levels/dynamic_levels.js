// =============================================================================
// levels/dynamic_levels.js — FASES DINÂMICAS (estilo Cuphead), uma por mundo,
// antes do chefe (ordem em worlds.js → DYNAMIC). Mecânicas em mechanics/dynamic.js.
//   w1_climb "A Grande Árvore"      — subida automática dentro da árvore oca;
//            balões que sobem, plataformas móveis/que caem, névoa espinhenta subindo.
//   w2_ride  "Corrida da Tartaruga" — montado na tartaruga de pelúcia, rolagem para a
//            direita: nadar, saltar da água, bolhas contra peixes/ouriços/gaivotas.
//   w3_tower "Torre do Relógio"     — subida na torre: engrenagens-plataforma,
//            pêndulos, degraus de latão que sobem, engrenagens moendo embaixo.
//   w4_fly   "Voo do Avião de Papel"— nave (shoot'em up) para a direita + minichefe
//            "O Bicho-Papão de Meia".
//   w5_rise  "Ascensão do Coração"  — subida pela fenda (ilhas, correntes de gravidade,
//            lascas que sobem) e, no alto, voo no tapete de retalhos até o portal.
// Mapas montados com grid() de w1_a.js. Torres: 36 colunas, área jogável 6..29
// (24 colunas = 384 px; cabe em quase todas as telas e a câmera centraliza).
// =============================================================================
import { registerLevel } from '../registry.js';
import { save } from '../../engine/save.js';
import { grid } from './w1_a.js';

/** Fala de abertura só na primeira visita (sem checkpoint). */
function introOnce(key, lines) {
  return (level) => {
    if (level.run.checkpoint || save.seen(key)) return;
    level.say(lines).then(() => { save.markSeen(key); save.commit?.(); });
  };
}
/** Estrutura de torre: paredes, interior (fundo) e chão. */
function tower(m, { wallTop, bgTop, bgBottom, ground, wall = '#' }) {
  m.fill(0, wallTop, 5, m.H - 1, wall);
  m.fill(30, wallTop, 35, m.H - 1, wall);
  m.fill(6, bgTop, 29, bgBottom, ':');
  m.fill(0, ground, 35, m.H - 1, wall);
}
/** Abertura no fundo (mostra o céu) com moldura desenhada (bark | window | rift). */
function hole(m, x0, y0, x1, y1, style) {
  m.clear(x0, y0, x1, y1);
  m.obj({ type: 'dyn_decor', x: x0, y: y0, kind: 'hole', w: x1 - x0 + 1, h: y1 - y0 + 1, style });
}
/** Plataformas em lote: [linha, x0, x1, char?]. */
function plats(m, list, def = '=') { for (const [y, x0, x1, ch] of list) m.fill(x0, y, x1, y, ch || def); }

// =============================================================================
// w1_climb — A Grande Árvore
// =============================================================================
{
  const m = grid(36, 112);
  m.id = 'w1_climb';
  tower(m, { wallTop: 24, bgTop: 24, bgBottom: 107, ground: 108 });
  // buracos (nós da madeira) mostrando o céu/floresta lá fora
  hole(m, 21, 46, 26, 49, 'bark'); hole(m, 9, 70, 13, 73, 'bark'); hole(m, 22, 93, 27, 95, 'bark'); hole(m, 13, 30, 17, 32, 'bark');
  m.put(8, 107, 'P');
  m.obj({ type: 'dyn_decor', x: 6, y: 24, kind: 'rim', w: 24, style: 'bark' });
  m.obj({ type: 'dyn_decor', x: 14, y: 105, kind: 'sign_arrow', dir: 'up' });
  // --- A: primeiros galhos ------------------------------------------------------
  plats(m, [[105, 11, 15], [102, 17, 21], [99, 24, 29, '#'], [96, 17, 21], [93, 9, 13], [90, 15, 19]]);
  m.line(25, 28, 97); m.line(11, 14, 103); m.line(18, 20, 94, 'o');
  // ★1: nicho escondido na parede esquerda
  m.fill(3, 90, 5, 92, ':'); m.put(4, 92, '*'); m.put(3, 92, 'o');
  // --- B: poço dos balões (esquerda) x galhos (direita) ---------------------------
  plats(m, [[87, 21, 25], [84, 25, 29, '#'], [81, 20, 22], [78, 25, 29, '#'], [75, 20, 22], [72, 25, 29, '#'], [69, 20, 22]]);
  plats(m, [[87, 10, 12]]);
  m.obj({ type: 'dyn_lifts', x: 6, y: 88, kind: 'balloon', w: 3, speed: 36, period: 2.6, top: 62 });
  for (let y = 84; y >= 66; y -= 4) m.put(9, y, 'o');                // trilha de botões no caminho dos balões
  m.put(27, 77, 'h'); m.put(21, 74, 'o'); m.put(21, 80, 'o');
  m.put(28, 83, 'a');
  plats(m, [[66, 24, 29, '#']]); m.put(27, 65, 'K');
  // ★2: no topo do caminho dos balões
  plats(m, [[63, 9, 12]]); m.put(11, 62, '*'); m.line(9, 10, 62);
  // --- C: plataformas móveis e que caem -----------------------------------------
  plats(m, [[63, 17, 21], [60, 12, 14], [57, 18, 21], [54, 24, 29, '#'], [51, 21, 21], [48, 17, 17], [45, 6, 13, '#']]);
  m.put(15, 60, 'F', { width: 3, dx: 6, speed: 38 });
  m.put(19, 51, 'W', { width: 2 }); m.put(15, 48, 'W', { width: 2 });
  m.line(25, 28, 53); m.put(9, 44, 'a'); m.put(7, 44, 'h');
  m.put(16, 40, 'g');
  // --- D: elevador e topo do tronco ---------------------------------------------
  plats(m, [[42, 13, 17], [39, 19, 23], [36, 25, 28], [33, 22, 23], [31, 18, 21], [28, 12, 16], [25, 6, 10]]);
  m.put(25, 35, 'F', { width: 3, dx: 0, dy: -5, speed: 30, pause: 0.8 });
  m.line(20, 22, 30); m.line(13, 15, 27);
  // --- E: copa (ao ar livre) ------------------------------------------------------
  plats(m, [[22, 12, 18], [19, 20, 26], [16, 13, 17], [13, 7, 11], [10, 15, 19]]);
  plats(m, [[10, 1, 3]]); m.put(2, 9, '*');                         // ★3: galho lá fora, à esquerda
  m.put(10, 14, 'g');
  m.line(21, 25, 18); m.line(14, 16, 15); m.arc(12, 9, 4, 1);
  m.fill(21, 7, 29, 8, '#'); m.put(26, 6, 'E'); m.line(22, 24, 5);
  // decoração: lanternas e brinquedos pendurados no oco da árvore
  for (const [x, y, k] of [[18, 98, 'lantern'], [10, 82, 'toys'], [24, 70, 'lantern'], [8, 56, 'toys'], [21, 52, 'lantern'], [12, 36, 'toys'], [24, 26, 'lantern'], [16, 88, 'toys']]) m.obj({ type: 'dyn_decor', x, y, kind: k, len: 2 });
  m.obj({ type: 'dyn_scroller', x: 0, y: 0, mode: 'up', speed: 17, delay: 2.4, hazard: 'thorns', playX0: 6, playX1: 29, zones: [{ row: 82, speed: 19 }, { row: 56, speed: 21 }, { row: 26, speed: 19 }] });
  m.objects.unshift(m.objects.pop());   // o scroller atualiza antes de todos
  registerLevel({
    id: 'w1_climb', world: 1, index: 6, name: 'A Grande Árvore', subtitle: 'Mundo 1 - Fase Especial',
    music: 'w1_level', tileset: 'w1', background: 'w1', timeOfDay: 'dusk', parTime: 110,
    darkness: 0.12, ambient: 'w1_fireflies', oxygen: false, dynamic: 'climb',
    map: m.build(), props: m.props, objects: m.objects,
    onStart: introOnce('dyn_w1_climb_intro', [
      { who: 'botao', expr: 'surprised', text: 'Tico! A névoa espinhenta está subindo pelo oco da Grande Árvore!' },
      { who: 'botao', text: 'Não pare de subir! Se ela te alcançar, você se espeta — mas eu te puxo de volta pra cima.' },
      { who: 'tico', expr: 'determined', text: 'Pra cima, então!' },
    ]),
  });
}

// =============================================================================
// w2_ride — Corrida da Tartaruga
// =============================================================================
{
  const W = 326, H = 18, SURF = 6;
  const m = grid(W, H);
  m.id = 'w2_ride';
  m.fill(0, SURF, W - 1, 16, '~');
  m.fill(0, 17, W - 1, 17, '#');
  const rock = (x, top, w = 2, ch = '#') => m.fill(x, top, x + w - 1, 16, ch);            // pedra do fundo
  const isle = (x, bot, w = 3, top = SURF - 2) => m.fill(x, top, x + w - 1, bot, '%');     // ilhota (furar por baixo)
  const spikesFloor = (x0, x1) => m.fill(x0, 16, x1, 16, '^');
  m.put(5, 5, 'P');
  // --- A: aquecimento ------------------------------------------------------------
  m.arc(14, 9, 8, 3); m.line(26, 34, 12, 'o', 2);
  m.put(30, 9, 'a'); m.put(36, 13, 'a'); m.put(40, 8, 'a');
  rock(44, 12, 3); m.line(44, 46, 10);
  isle(52, 9, 4); m.line(52, 55, 12);
  m.put(60, 11, 'a'); m.put(63, 14, 'a');
  // --- B: muros de rede — saltar para fora da água -------------------------------
  rock(70, 5, 2); m.arc(66, 4, 9, 3); m.put(78, 3, 'g'); m.put(82, 10, 'b', { dy: 2 });
  rock(88, 5, 2); m.arc(84, 4, 9, 3);
  m.put(92, 1, '*');                                                   // ★1 no alto do salto
  m.put(98, 4, 'g'); m.put(104, 12, 'a'); m.put(106, 8, 'a');
  m.obj({ type: 'dyn_checkpoint', x: 112, y: 0, axis: 'x', h: 17 });
  // --- C: caverna submersa ---------------------------------------------------------
  m.fill(116, 3, 150, 9, '%'); m.fill(116, 10, 150, 10, '^');           // teto de pedra com espinhos embaixo
  spikesFloor(118, 148);
  m.put(122, 13, 'b'); m.put(129, 12, 'b', { dy: 1.5 }); m.put(136, 14, 'b'); m.put(142, 12, 'b', { dy: 1.5 });
  m.line(120, 146, 12, 'o', 3);
  m.fill(131, 7, 135, 10, '~'); m.put(133, 8, '*');   // ★2 num bolsão no teto
  m.put(147, 13, 'a');
  // --- D: pilares e gaivotas -------------------------------------------------------
  rock(158, 10, 3); isle(166, 8, 3); rock(174, 9, 3); isle(182, 9, 3); rock(190, 6, 2);
  m.arc(186, 4, 8, 3);
  m.put(162, 3, 'g'); m.put(170, 2, 'g'); m.put(178, 13, 'a'); m.put(196, 4, 'g'); m.put(200, 11, 'b', { dy: 3, speed: 1.2 });
  m.line(160, 164, 13); m.line(176, 180, 7);
  m.put(206, 9, 'h');
  m.obj({ type: 'dyn_checkpoint', x: 214, y: 0, axis: 'x', h: 17 });
  // --- E: slalom final ------------------------------------------------------------
  rock(222, 11, 2); isle(230, 11, 2); rock(238, 9, 2); isle(246, 12, 2); rock(254, 5, 2);
  m.arc(250, 4, 9, 3);
  m.put(226, 8, 'a'); m.put(234, 14, 'a'); m.put(242, 7, 'b', { dy: 2 }); m.put(258, 3, 'g'); m.put(262, 12, 'b', { dy: 3, speed: 1.6 });
  // ★3: alcove atrás de blocos quebráveis (atire bolhas!)
  m.fill(268, 11, 278, 16, '%'); m.clear(270, 12, 276, 15); m.fill(270, 12, 276, 15, '~');
  m.put(268, 13, 'B'); m.put(268, 14, 'B'); m.put(268, 12, 'B'); m.put(268, 15, 'B');
  m.put(273, 13, '*'); m.line(271, 275, 15, 'o', 2);
  m.put(284, 9, 'a'); m.put(288, 13, 'a'); m.put(292, 8, 'a'); m.line(282, 300, 10, 'o', 3);
  // --- praia (fim) -----------------------------------------------------------------
  m.fill(312, SURF, W - 1, 17, '#'); m.fill(310, 12, 311, 16, '#');
  m.put(318, 5, 'E');
  m.obj({ type: 'dyn_dismount', x: 305, y: 0, w: 7, h: 18, toX: 314, toY: 6 });
  m.obj({ type: 'dyn_turtle', x: 5, y: 6 });
  m.obj({ type: 'dyn_scroller', x: 0, y: 0, mode: 'right', speed: 66, delay: 2.4, stop: 324, zones: [{ col: 112, speed: 60 }, { col: 150, speed: 70 }, { col: 214, speed: 74 }] });
  m.objects.unshift(m.objects.pop());
  registerLevel({
    id: 'w2_ride', world: 2, index: 6, name: 'Corrida da Tartaruga', subtitle: 'Mundo 2 - Fase Especial',
    music: 'w2_level', tileset: 'w2', background: 'w2', timeOfDay: 'day', parTime: 95,
    darkness: 0, ambient: 'w2_bubbles', oxygen: false, dynamic: 'ride',
    legend: { a: 'dyn_fish', b: 'dyn_urchin', g: 'dyn_gull' },
    map: m.build(), props: m.props, objects: m.objects,
    onStart: introOnce('dyn_w2_ride_intro', [
      { who: 'capita_bolha', expr: 'happy', text: 'Segura firme, marujo! Essa tartaruga de pelúcia nada mais rápido que a maré!' },
      { who: 'capita_bolha', text: 'Mexa em qualquer direção, pule perto da superfície pra saltar e ataque pra soltar bolhas!' },
      { who: 'tico', expr: 'happy', text: 'Vamos nessa!' },
    ]),
  });
}

// =============================================================================
// w3_tower — Torre do Relógio
// =============================================================================
{
  const m = grid(36, 122);
  m.id = 'w3_tower';
  tower(m, { wallTop: 10, bgTop: 10, bgBottom: 117, ground: 118, wall: '%' });
  // janelas (céu violeta lá fora)
  for (const [x, y] of [[9, 104], [24, 84], [9, 60], [8, 40], [15, 22]]) hole(m, x, y, x + 2, y + 3, 'window');
  m.put(8, 117, 'P');
  // --- A: engrenagens -------------------------------------------------------------
  plats(m, [[115, 12, 15], [112, 19, 22], [109, 25, 29, '%'], [106, 18, 20], [103, 11, 14], [100, 15, 18, '%']]);
  m.put(25, 113, 'm', { size: 3, speed: 45 });
  m.put(13, 108, 'm', { size: 3, speed: -50 });
  m.put(16, 101, 'p', { len: 3, amp: 50, period: 2.8 });              // pêndulo sob a viga (linha 100)
  m.line(13, 15, 114); m.line(26, 28, 108); m.line(19, 20, 105);
  // --- B: degraus de latão que sobem (esquerda) x pêndulos (direita) --------------
  plats(m, [[97, 21, 24], [94, 25, 29, '%'], [91, 19, 22], [88, 25, 29, '%'], [85, 19, 22], [80, 21, 27, '%'], [77, 26, 29], [76, 20, 22], [74, 14, 18], [71, 6, 11, '%']]);
  m.obj({ type: 'dyn_lifts', x: 12, y: 98, kind: 'cog', w: 2, speed: 42, period: 2.4, top: 72 });
  m.put(26, 81, 'p', { len: 3, amp: 50, period: 2.6, phase: 0.25 });
  for (let y = 94; y >= 79; y -= 5) m.put(13, y, 'o');
  m.put(27, 93, 'h'); m.line(20, 22, 84);
  m.put(9, 70, 'K');
  // --- C: ponteiros e plataformas-relógio -----------------------------------------
  plats(m, [[68, 14, 17], [65, 21, 23], [62, 15, 17], [59, 22, 24], [56, 25, 29, '%'], [53, 18, 21], [50, 8, 14, '%']]);
  m.put(19, 61, 'l', { len: 3, speed: 30 });
  m.put(10, 64, 'j', { phase: 0 }); m.put(11, 64, 'j', { phase: 0 }); m.put(12, 64, 'j', { phase: 0 });
  m.put(6, 66, '*'); plats(m, [[67, 6, 7, '%']]);                     // ★1: degrau à esquerda (pule nas plataformas-relógio)
  m.put(27, 55, 'g');
  m.line(15, 17, 67); m.line(26, 28, 55); m.line(19, 20, 52);
  // ★2: alto, à direita, sobre uma engrenagem
  m.put(26, 51, 'm', { size: 3, speed: 40 }); m.put(26, 48, '*');
  // --- D: pêndulo e degraus que sobem ----------------------------------------------
  plats(m, [[47, 14, 17], [44, 19, 22], [41, 13, 16], [38, 6, 10, '%'], [35, 13, 16], [32, 20, 23], [29, 25, 29, '%'], [26, 18, 21], [23, 11, 14]]);
  m.obj({ type: 'dyn_lifts', x: 24, y: 46, kind: 'cog', w: 3, speed: 40, period: 2.6, top: 32 });
  m.put(18, 29, 'p', { len: 2, amp: 55, period: 2.4 });
  m.put(8, 37, 'h'); m.line(14, 16, 40); m.line(21, 23, 31); m.line(12, 14, 22);
  // --- E: campanário ----------------------------------------------------------------
  plats(m, [[20, 17, 20], [17, 22, 25], [14, 11, 19]]);
  m.put(4, 13, '*'); plats(m, [[14, 3, 5, '=']]); hole(m, 3, 10, 5, 13, 'window');  // ★3: janela na parede esquerda
  m.clear(6, 10, 29, 10); m.fill(6, 11, 29, 11, '%'); m.fill(10, 11, 13, 11, ':');                  // piso do campanário com alçapão
  m.fill(6, 0, 7, 10, '.'); m.fill(28, 0, 29, 10, '.');
  m.put(23, 10, 'E'); m.line(16, 20, 9);
  m.obj({ type: 'dyn_decor', x: 17, y: 2, kind: 'bell', posts: 9.5 });
  for (const [x, y, r] of [[17, 95, 3], [12, 46, 2], [21, 74, 2]]) m.obj({ type: 'dyn_decor', x, y, kind: 'clockface', r, z: 1 });
  m.obj({ type: 'dyn_scroller', x: 0, y: 0, mode: 'up', speed: 20, delay: 2.4, hazard: 'gears', playX0: 6, playX1: 29, zones: [{ row: 96, speed: 24 }, { row: 68, speed: 22 }, { row: 46, speed: 26 }, { row: 18, speed: 20 }] });
  m.objects.unshift(m.objects.pop());
  registerLevel({
    id: 'w3_tower', world: 3, index: 6, name: 'Torre do Relógio', subtitle: 'Mundo 3 - Fase Especial',
    music: 'w3_level', tileset: 'w3', background: 'w3', timeOfDay: 'dusk', parTime: 120,
    darkness: 0.1, ambient: 'w3_dust', oxygen: false, dynamic: 'climb',
    map: m.build(), props: m.props, objects: m.objects,
    onStart: introOnce('dyn_w3_tower_intro', [
      { who: 'tique_taque', expr: 'scared', text: 'Tic-tac! As engrenagens do porão estão moendo tudo e subindo pela torre!' },
      { who: 'tique_taque', text: 'Suba até o campanário antes que elas te peguem! Os degraus de latão sobem sozinhos!' },
    ]),
  });
}

// =============================================================================
// w4_fly — Voo do Avião de Papel
// =============================================================================
{
  const W = 300, H = 16;
  const m = grid(W, H);
  m.id = 'w4_fly';
  m.fill(0, 14, W - 1, 15, '#');
  const tower2 = (x, top, w = 2) => m.fill(x, top, x + w - 1, 13, '%');      // pilha de brinquedos/livros do chão
  const hang = (x, bot, w = 2) => m.fill(x, 0, x + w - 1, bot, '%');        // estrado da cama / caixa pendurada
  m.put(5, 7, 'P');
  // --- A: céu do pesadelo ---------------------------------------------------------
  m.arc(14, 8, 10, 2); m.line(28, 38, 5, 'o', 2);
  m.put(30, 4, 'a'); m.put(32, 9, 'a'); m.put(34, 6, 'a'); m.put(44, 3, 'a'); m.put(46, 10, 'a');
  tower2(52, 10, 3); hang(58, 3, 3);
  m.put(56, 7, 'b');
  m.line(62, 68, 7, 'o', 2);
  tower2(70, 9, 2); m.put(71, 4, '*');                                  // ★1 em cima da pilha
  m.put(76, 8, 'b'); m.put(80, 4, 'a'); m.put(82, 11, 'a');
  // --- B: tesouras e coelhos de poeira --------------------------------------------
  m.put(90, 6, 'f'); m.put(96, 10, 'f'); m.put(100, 3, 'f');
  m.put(104, 7, 'd', { dy: 4 }); m.put(110, 7, 'd', { dy: 4, phase: 0.5 });
  m.line(103, 111, 7, 'o', 2);
  m.obj({ type: 'dyn_checkpoint', x: 116, y: 0, axis: 'x', h: 14 });
  // --- C: debaixo da cama (estrado no alto) ---------------------------------------
  m.fill(124, 0, 196, 2, '%');
  for (let x = 128; x < 196; x += 10) hang(x, 4, 2);
  tower2(134, 11, 3); tower2(152, 10, 2); tower2(170, 11, 3); tower2(186, 10, 2);
  m.put(140, 8, 'd', { dy: 3 }); m.put(160, 8, 'd', { dy: 3, phase: 0.3 }); m.put(178, 7, 'd', { dy: 3, phase: 0.6 });
  m.put(146, 6, 'a'); m.put(148, 9, 'a'); m.put(156, 6, 'b'); m.put(166, 5, 'f'); m.put(174, 9, 'a'); m.put(182, 5, 'b'); m.put(192, 8, 'f');
  m.line(141, 147, 11, 'o', 2); m.line(161, 167, 6, 'o', 2);
  m.put(153, 8, '*');                                                   // ★2 espremida entre a pilha e o coelho
  m.put(198, 7, 'h');
  // --- D: tempestade de pesadelo ---------------------------------------------------
  m.put(206, 4, 'a'); m.put(208, 7, 'a'); m.put(210, 10, 'a'); m.put(214, 6, 'f'); m.put(220, 8, 'b'); m.put(226, 3, 'f'); m.put(228, 11, 'f');
  tower2(234, 8, 2); hang(240, 5, 2);
  m.put(237, 3, '*');                                                   // ★3 no vão estreito do alto
  m.obj({ type: 'dyn_checkpoint', x: 248, y: 0, axis: 'x', h: 14 });
  m.put(252, 6, 'a'); m.put(254, 9, 'a'); m.line(256, 266, 7, 'o', 2);
  m.obj({ type: 'dyn_boss_sock', x: 294, y: 6, hp: 90 });
  m.obj({ type: 'dyn_flyer', x: 5, y: 7, skin: 'plane', dir: 'right' });
  m.obj({ type: 'dyn_scroller', x: 0, y: 0, mode: 'right', speed: 72, delay: 2.4, zones: [{ col: 116, speed: 66 }, { col: 200, speed: 78 }] });
  m.objects.unshift(m.objects.pop());
  registerLevel({
    id: 'w4_fly', world: 4, index: 6, name: 'Voo do Avião de Papel', subtitle: 'Mundo 4 - Fase Especial',
    music: 'w4_level', tileset: 'w4', background: 'w4', timeOfDay: 'night', parTime: 100,
    darkness: 0, ambient: 'w4_dust', oxygen: false, noExit: true, dynamic: 'fly',
    legend: { a: 'dyn_bat', b: 'dyn_eye', d: 'dyn_dustbunny', f: 'dyn_scissors' },
    map: m.build(), props: m.props, objects: m.objects,
    onStart: introOnce('dyn_w4_fly_intro', [
      { who: 'luzinha', expr: 'happy', text: 'Um aviãozinho de papel feito de página de caderno! Ele voa, Tico!' },
      { who: 'luzinha', text: 'Mexa pra todo lado, segure o ataque pra atirar bolinhas de papel e pule pra dar um rasante!' },
      { who: 'tico', expr: 'determined', text: 'Segura a lanterna, Luzinha!' },
    ]),
  });
}

// =============================================================================
// w5_rise — Ascensão do Coração
// =============================================================================
{
  const m = grid(36, 134);
  m.id = 'w5_rise';
  tower(m, { wallTop: 46, bgTop: 46, bgBottom: 129, ground: 130 });
  for (const [x, y] of [[21, 116], [8, 100], [8, 75], [11, 57]]) hole(m, x, y, x + 3, y + 3, 'rift');   // rasgos para a fenda
  m.put(8, 129, 'P');
  m.obj({ type: 'dyn_decor', x: 6, y: 46, kind: 'rim', w: 24, style: 'rift' });
  // --- A: ilhas à deriva ------------------------------------------------------------
  plats(m, [[127, 12, 15], [124, 19, 22], [121, 25, 29, '#'], [118, 18, 20], [115, 11, 14], [112, 6, 9, '#']]);
  m.put(19, 112, 's', { w: 3, ax: 2, ay: 0, period: 3.5 });
  plats(m, [[109, 14, 17], [106, 22, 25], [103, 25, 29, '#']]);
  m.line(13, 15, 126); m.line(26, 28, 120); m.line(7, 9, 111);
  m.put(27, 102, '*');                                                 // ★1 (canto do rasgo)
  // --- B: corrente de gravidade + ruínas que desmoronam ---------------------------
  m.fill(14, 86, 16, 101, 'w');                                        // elevador de fio (sobe)
  plats(m, [[100, 19, 21], [97, 24, 26, 'u'], [94, 19, 21], [91, 24, 27, 'u'], [88, 18, 21]]);
  plats(m, [[85, 6, 12, '#']]); m.put(9, 84, 'K');
  for (let y = 98; y >= 88; y -= 3) m.put(15, y, 'o');
  m.put(22, 87, 'h');
  m.put(7, 90, 'g');
  // --- C: lascas que sobem ------------------------------------------------------------
  plats(m, [[82, 14, 17], [79, 20, 23], [76, 26, 29, '#'], [73, 20, 22], [70, 14, 16], [67, 8, 11, '#'], [64, 14, 17], [61, 20, 23], [58, 25, 29, '#'], [55, 18, 21], [52, 12, 15]]);
  m.obj({ type: 'dyn_lifts', x: 23, y: 74, kind: 'shard', w: 2, speed: 46, period: 2.2, top: 57 });
  m.put(9, 63, 's', { w: 3, ax: 0, ay: 1.5, period: 3 });
  m.put(6, 57, '*'); plats(m, [[58, 6, 7, '#']]);                      // ★2: degrau à esquerda
  m.put(17, 69, 'f'); m.line(21, 22, 72); m.line(15, 17, 63); m.line(19, 21, 54);
  // --- D: plataforma do tapete ---------------------------------------------------------
  plats(m, [[49, 6, 29, '#']]); m.put(8, 48, 'K');
  m.obj({ type: 'dyn_flyer', x: 18, y: 45, skin: 'carpet', dir: 'up', autoMount: false });
  m.obj({ type: 'dyn_decor', x: 13, y: 47, kind: 'sign_arrow', dir: 'up' });
  // --- E: voo pela fenda ----------------------------------------------------------------
  for (const [x, y, w] of [[8, 40, 3], [22, 36, 4], [12, 30, 3], [24, 24, 3], [7, 20, 4], [17, 14, 3]]) m.fill(x, y, x + w - 1, y + 1, '%');
  for (const [x, y] of [[10, 38], [24, 33], [14, 27], [26, 21], [9, 17], [19, 11]]) m.line(x, x + 2, y);
  m.put(28, 28, '*');                                                  // ★3 no canto direito do voo
  for (const [type, x, y, extra] of [
    ['dyn_bat', 12, 34], ['dyn_bat', 20, 32], ['dyn_bat', 16, 26], ['dyn_eye', 20, 22, { hold: 4 }],
    ['dyn_scissors', 10, 18], ['dyn_scissors', 22, 16], ['dyn_bat', 8, 12], ['dyn_bat', 26, 12], ['dyn_eye', 12, 9, { hold: 3 }],
  ]) m.obj({ type, x, y, ...(extra || {}) });
  plats(m, [[5, 6, 29]]); m.put(18, 4, 'E'); m.line(10, 14, 3); m.line(22, 26, 3);
  m.obj({ type: 'dyn_dismount', x: 0, y: 0, w: 36, h: 4 });
  for (const [x, y] of [[18, 70], [10, 104], [26, 42], [6, 26]]) m.obj({ type: 'dyn_decor', x, y, kind: 'spiral', r: 2, z: 1 });
  m.obj({ type: 'dyn_scroller', x: 0, y: 0, mode: 'up', speed: 22, delay: 2.4, hazard: 'rift', playX0: 6, playX1: 29, zones: [{ row: 100, speed: 25 }, { row: 70, speed: 27 }, { row: 40, speed: 40 }, { row: 14, speed: 30 }] });
  m.objects.unshift(m.objects.pop());
  registerLevel({
    id: 'w5_rise', world: 5, index: 6, name: 'Ascensão do Coração', subtitle: 'Mundo 5 - Fase Especial',
    music: 'w5_level', tileset: 'w5', background: 'w5', timeOfDay: 'dusk', parTime: 120,
    darkness: 0.1, ambient: 'w5_threads', oxygen: false, dynamic: 'climb',
    map: m.build(), props: m.props, objects: m.objects,
    onStart: introOnce('dyn_w5_rise_intro', [
      { who: 'lia', expr: 'scared', text: 'Tico, a fenda está se abrindo embaixo de nós! Suba!' },
      { who: 'lia', text: 'Lá em cima tem um tapete de retalhos — ele voa até o Coração da Dimensão!' },
    ]),
  });
}
