// =============================================================================
// levels/w1_a.js — MUNDO 1 (Floresta dos Brinquedos Perdidos), fases 1 e 2.
//   w1_1 "Clareira dos Esquecidos"  — tutorial (andar, pular, pulo variável,
//         correr, espinhos, ataque, golpe p/ baixo, dash, pisão) + Sr. Botão.
//   w1_2 "Altar da Primeira Costura" — altar da Costura Dimensional; ilhós sobre
//         riachos (seguro), abismo de verdade, ilhó com sinal abrindo portão;
//         primeiros inimigos (a, b).
// Os mapas são montados por código (grid/fill/put) para ficarem legíveis e fáceis
// de ajustar; o resultado é o mesmo array de strings que registerLevel espera.
// Também exporta os utilitários de montagem usados por w1_b.js e w1_c.js.
// =============================================================================
import { registerLevel } from '../registry.js';

/** Grade de montagem de mapa ASCII (W colunas × H linhas, começa vazia '.'). */
export function grid(W, H) {
  const g = Array.from({ length: H }, () => new Array(W).fill('.'));
  const props = {}, objects = [];
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const m = {
    W, H, props, objects,
    get: (x, y) => (inb(x, y) ? g[y][x] : '#'),
    /** Coloca um caractere (e props opcionais da entidade naquela célula). */
    put(x, y, ch, pr) { if (inb(x, y)) g[y][x] = ch; if (pr) props[`${x},${y}`] = pr; return m; },
    fill(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) g[y][x] = ch; return m; },
    clear(x0, y0, x1, y1) { return m.fill(x0, y0, x1, y1, '.'); },
    /** Chão sólido da linha `top` até o fundo do mapa. */
    ground(x0, x1, top, ch = '#') { return m.fill(x0, top, x1, H - 1, ch); },
    plat(x0, x1, y, ch = '=') { return m.fill(x0, y, x1, y, ch); },
    /** Linha de botões (ou outro char) de x0 a x1 na linha y, a cada `step`. */
    line(x0, x1, y, ch = 'o', step = 1) { for (let x = x0; x <= x1; x += step) m.put(x, y, ch); return m; },
    /** Arco de botões (trajetória de pulo) começando em (x0, y) com n colunas e altura h. */
    arc(x0, y, n, h = 2, ch = 'o') {
      for (let i = 0; i < n; i++) m.put(x0 + i, y - Math.round(Math.sin(Math.PI * (i + 0.5) / n) * h), ch);
      return m;
    },
    sign(x, y, dialog) { return m.put(x, y, 'i', { dialog }); },
    obj(o) { objects.push(o); return m; },
    build: () => g.map((r) => r.join('')),
  };
  return m;
}

/**
 * Toca com portão: túnel sob um abismo/obstáculo ligando dois poços (3 de largura,
 * com tampa '=' e degraus alternados para subir de volta). O portão na saída abre
 * com `signal` (normalmente o mesmo ilhó que atravessa o abismo, com latch) — é um
 * caminho de volta/bônus e garante uma rota de tiles para o validador.
 * Use floor = top + 9 (degraus a cada 3 linhas).
 */
/** Itens que podem morar dentro de uma sala secreta (char → tipo de entidade). */
const HIDDEN_TYPES = { o: 'button', X: 'secret_marker', r: 'patch', h: 'heart', e: 'energy', M: 'memory', c: 'chest' };
/**
 * Sala secreta: preenche com parede falsa 'H' (parece terreno maciço). No build(), os
 * itens colocados dentro dela viram `objects` (célula continua 'H' → nenhum buraco
 * visível denuncia a sala). Estrelas ficam no mapa (o validador as conta): uma
 * frestinha brilhando é a única pista.
 */
export function hideRoom(m, x0, y0, x1, y1) {
  m.fill(x0, y0, x1, y1, 'H');
  if (!m._rooms) {
    m._rooms = [];
    const build0 = m.build;
    m.build = () => {
      const rows = build0().map((r) => r.split(''));
      const inRoom = (x, y) => m._rooms.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
      for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        const type = HIDDEN_TYPES[ch];
        if (!type || !inRoom(x, y)) continue;
        const k = `${x},${y}`, pr = { ...(m.props[k] || {}) };
        pr.pid = `${m.id || 'lv'}:${ch}:${k}`;
        m.objects.push({ type, x, y, ...pr });
        delete m.props[k];
        rows[y][x] = 'H';
      }
      return rows.map((r) => r.join(''));
    };
  }
  m._rooms.push([x0, y0, x1, y1]);
  return m;
}

export function burrow(m, { nx, fx, top, floor, signal, coins = true }) {
  m.clear(nx, floor - 2, fx + 2, floor - 1);
  for (const sx of [nx, fx]) {
    m.clear(sx, top, sx + 2, floor - 1);
    let k = 0;
    for (let y = floor - 3; y >= top + 2; y -= 3, k++) m.fill(sx + (k % 2), y, sx + 1 + (k % 2), y, '=');
    m.fill(sx, top, sx + 2, top, '=');
  }
  m.put(fx - 1, floor - 1, 'G', { signal, latch: true });
  if (coins) for (let x = nx + 4; x < fx - 2; x += 2) if (m.get(x, floor - 1) === '.') m.put(x, floor - 1, 'o');
}

// =============================================================================
// w1_1 — Clareira dos Esquecidos (tutorial). Chão na linha 19 (Tico em pé na 18).
// =============================================================================
{
  const m = grid(220, 24);
  m.id = 'w1_1';
  const G = 19;
  m.ground(0, 77, G);
  // --- A: andar e pular -------------------------------------------------------
  m.put(3, 18, 'P');
  m.sign(6, 18, 'w1_sign_move');
  m.line(9, 13, 17);
  m.sign(15, 18, 'w1_sign_jump');
  m.fill(18, 18, 19, 18, '%'); m.line(18, 19, 16);          // toco baixo (1)
  m.fill(23, 17, 25, 18, '%'); m.line(23, 25, 15);          // toco médio (2)
  m.line(28, 31, 17);
  m.plat(26, 29, 14); m.put(27, 13, 'o'); m.put(28, 13, 'o');                // galhinho opcional
  m.put(33, 18, 'B', { contents: 'buttons:3' });
  // --- B: Sr. Botão, pulo variável, espinhos -----------------------------------
  m.put(37, 18, 'n', { npc: 'botao', dialog: 'w1_botao_1' });
  m.sign(42, 18, 'w1_sign_varjump');
  m.put(44, 17, 'o'); m.put(45, 16, 'o'); m.put(46, 16, 'o'); m.put(47, 17, 'o'); // pulinho curto
  m.fill(51, 16, 55, 18, '%');                               // muro de 3: pulo alto
  m.put(53, 15, '*');                                         // ★1 (fácil, no caminho)
  m.sign(58, 18, 'w1_sign_spikes');
  m.fill(61, 18, 62, 18, '^');
  m.put(60, 16, 'o'); m.put(61, 15, 'o'); m.put(62, 15, 'o'); m.put(63, 16, 'o');
  // --- C: correr, valas (seguras) e árvore opcional ---------------------------
  m.sign(66, 18, 'w1_sign_run');
  m.put(72, 18, 'K');
  m.plat(64, 67, 15); m.put(65, 14, 'o'); m.put(66, 14, 'o');
  m.ground(78, 80, 22);                                       // vala 1 (3)
  m.put(78, 16, 'o'); m.put(79, 15, 'o'); m.put(80, 16, 'o');
  m.ground(81, 88, G);
  m.fill(84, 17, 85, 18, '%'); m.put(84, 16, 'h');           // toco com coração
  m.ground(89, 93, 22);                                       // vala 2 (5: correndo)
  m.arc(89, 16, 5, 2);
  m.line(90, 92, 21);
  m.ground(94, 160, G);
  m.fill(101, 6, 101, 18, ':');                               // tronco (fundo)
  m.plat(97, 99, 16); m.put(98, 15, 'o');
  m.plat(102, 104, 13); m.put(103, 12, 'o');
  m.plat(97, 99, 10); m.put(98, 9, 'o');
  m.plat(102, 105, 7); m.line(102, 103, 6);
  m.put(105, 6, '*');                                         // ★2 (copa da árvore, fora do caminho)
  // --- D: ataque (blocos), baú, golpe p/ baixo (segredo 1) --------------------
  m.sign(111, 18, 'w1_sign_attack');
  m.fill(114, 10, 121, 16, '%');                              // tronco caído oco
  m.put(117, 17, 'B'); m.put(117, 18, 'B');
  m.put(115, 18, 'o'); m.put(116, 18, 'o'); m.put(119, 18, 'o'); m.put(120, 18, 'o');
  m.put(124, 18, 'c', { contents: 'buttons:5' });
  m.sign(126, 18, 'w1_sign_downstrike');
  hideRoom(m, 126, 20, 134, 21);                              // câmara escondida (sob o chão)
  m.put(128, 19, 'B'); m.put(129, 19, 'B');                   // piso quebrável
  m.put(127, 21, 'e'); m.line(128, 130, 21); m.put(132, 21, 'X'); m.put(133, 21, 'r');
  // --- E: dash ----------------------------------------------------------------
  m.put(140, 18, 'K');
  m.sign(143, 18, 'w1_sign_dash');
  m.clear(147, G, 151, 21);                                   // vala 3 (5)
  m.line(148, 150, 21);
  m.arc(147, 16, 5, 2);
  m.put(155, 18, 'a');
  m.plat(153, 156, 15); m.put(154, 14, 'o'); m.put(155, 14, 'o');
  m.clear(161, 0, 164, 23);                                   // vão de verdade (4)
  m.arc(161, 16, 4, 2);
  m.ground(165, 219, G);
  // colina com sala secreta (parede falsa) — ★3
  m.fill(170, 15, 177, 18, '#');                              // colina (mesma textura da parede falsa)
  m.plat(166, 168, 16);
  m.fill(170, 17, 171, 18, 'H');
  hideRoom(m, 172, 17, 176, 18);
  m.put(173, 18, 'X'); m.put(172, 17, 'o'); m.put(174, 17, 'o'); m.put(175, 18, '*');
  m.line(171, 176, 14, 'o', 2);
  // --- F: pisão nos inimigos e saída ------------------------------------------
  m.sign(182, 18, 'w1_sign_stomp');
  m.put(185, 17, 'h');
  m.put(188, 18, 'B'); m.put(188, 17, 'B', { contents: 'buttons:3' });
  m.put(199, 10, 'g');
  m.put(192, 18, 'a');
  m.plat(195, 197, 16); m.line(195, 197, 15);
  m.put(201, 18, 'a');
  m.fill(207, 18, 219, 18, '%'); m.fill(210, 17, 219, 17, '%'); m.fill(213, 16, 219, 16, '%');
  m.put(208, 17, 'o'); m.put(211, 16, 'o'); m.put(214, 15, 'o');
  m.put(217, 15, 'E');

  registerLevel({
    id: 'w1_1', world: 1, index: 1, name: 'Clareira dos Esquecidos', subtitle: 'Mundo 1-1',
    music: 'w1_level', tileset: 'w1', background: 'w1', timeOfDay: 'day', parTime: 170,
    darkness: 0, ambient: 'w1_fireflies', oxygen: false, intro: 'arrival',
    map: m.build(), props: m.props, objects: m.objects,
  });
}

// =============================================================================
// w1_2 — Altar da Primeira Costura. Chão na linha 18 (até o riacho 2), depois 17.
// =============================================================================
{
  const m = grid(240, 28);
  m.id = 'w1_2';
  m.ground(0, 32, 18);
  // --- A: altar + Sr. Botão ---------------------------------------------------
  m.put(3, 17, 'P');
  m.line(5, 9, 16);
  m.fill(12, 17, 16, 17, '%');
  m.put(14, 16, 'Q', { ability: 'stitch' });
  m.put(22, 17, 'n', { npc: 'botao', dialog: 'w1_botao_2' });
  m.sign(27, 17, 'w1_sign_stitch');
  // --- B: riachos (vão seguro com água embaixo) --------------------------------
  m.ground(33, 40, 21); m.fill(33, 18, 40, 20, '~');
  m.put(32, 17, '@', { group: 's1' }); m.put(41, 17, '@', { group: 's1' });
  m.line(34, 36, 15); m.put(37, 16, '*'); m.line(38, 40, 15); // ★1 (no meio da ponte)
  m.ground(41, 50, 18);
  m.line(44, 47, 16);
  m.plat(42, 44, 13); m.put(43, 12, 'h');
  m.put(48, 17, 'B', { contents: 'buttons:3' });
  m.ground(51, 58, 21); m.fill(51, 18, 58, 20, '~');
  m.put(50, 17, '@', { group: 's2' }); m.put(59, 16, '@', { group: 's2' });
  m.arc(51, 15, 8, 1);
  m.ground(59, 103, 17);
  // --- B2: primeiros inimigos -------------------------------------------------
  m.sign(62, 16, 'w1_sign_enemies');
  m.put(70, 16, 'a');
  m.plat(73, 76, 14); m.line(73, 76, 13);
  m.put(79, 16, 'K');
  m.sign(82, 16, 'w1_sign_lasso');
  m.put(87, 16, 'b');
  m.plat(89, 92, 14); m.line(89, 92, 13);
  m.put(95, 16, 'a');
  m.put(88, 9, 'g');
  m.put(99, 16, 'h');
  // --- C: abismo de verdade + toca com portão por baixo (segredo 1) -----------
  m.ground(104, 111, 23); m.fill(104, 22, 111, 22, '^');
  m.ground(112, 239, 17);
  burrow(m, { nx: 97, fx: 116, top: 17, floor: 26, signal: 'toca1' });
  m.sign(101, 16, 'w1_sign_realgap');
  m.put(103, 16, '@', { group: 'c1', signal: 'toca1', latch: true });
  m.put(112, 16, '@', { group: 'c1' });
  m.arc(104, 14, 8, 1);
  m.sign(101, 25, 'w1_sign_burrow');
  m.put(107, 25, 'X'); m.put(113, 25, 'r');
  // --- D: ilhó com sinal abre o portão do morro -------------------------------
  m.put(119, 16, 'a'); m.plat(117, 121, 13); m.line(118, 120, 12, 'o', 2);
  m.sign(126, 16, 'w1_sign_gate');
  m.fill(131, 16, 135, 16, '^');
  m.put(130, 16, '@', { group: 'p1' });
  m.put(136, 16, '@', { group: 'p1', signal: 'portao1', latch: true });
  m.fill(140, 9, 152, 16, '%'); m.clear(140, 15, 152, 16);
  m.put(140, 16, 'G', { signal: 'portao1' });
  m.line(142, 150, 16, 'o', 2);
  // ilha flutuante opcional (★2) — só com fio em rampa
  m.put(155, 16, '@', { group: 'i1' });
  m.plat(161, 165, 12, '#'); m.put(161, 11, '@', { group: 'i1' });
  m.line(162, 163, 11); m.put(164, 11, '*');
  m.put(167, 16, 'K');
  m.put(171, 16, 'B'); m.put(171, 15, 'B', { contents: 'heart' });
  m.put(178, 9, 'g');
  // --- E: inimigos, penhasco com sala secreta (★3) e saída --------------------
  m.put(175, 16, 'a');
  m.plat(180, 184, 14); m.put(182, 13, 'b');
  m.line(186, 189, 15);
  m.put(192, 16, 'a');
  m.clear(196, 17, 198, 27); m.arc(196, 15, 3, 1);
  m.put(202, 16, '%'); m.fill(203, 15, 203, 16, '%');
  m.fill(205, 12, 214, 16, '#');
  m.fill(205, 15, 206, 16, 'H');
  hideRoom(m, 207, 13, 212, 16);
  m.put(208, 16, 'X'); m.line(209, 210, 14); m.put(211, 15, '*'); m.put(212, 16, 'h');
  m.line(206, 213, 11, 'o', 2);
  m.line(218, 224, 15, 'o', 2);
  m.plat(219, 222, 12); m.put(220, 11, 'e');
  m.put(227, 16, 'a');
  m.put(234, 16, 'E');

  registerLevel({
    id: 'w1_2', world: 1, index: 2, name: 'Altar da Primeira Costura', subtitle: 'Mundo 1-2',
    music: 'w1_level', tileset: 'w1', background: 'w1', timeOfDay: 'day', parTime: 190,
    darkness: 0, ambient: 'w1_fireflies', oxygen: false,
    map: m.build(), props: m.props, objects: m.objects,
  });
}
