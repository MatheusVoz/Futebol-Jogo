// =============================================================================
// scenes/map_layout.js — Traçado do mapa-múndi (estilo "overworld" de 16 bits).
//
// O mapa é uma faixa contínua de 5 REGIÕES (uma por mundo), cada uma com
// RW x RH px, lado a lado (região N começa em x = (N-1)*RW). Entre duas regiões
// há uma "costura" (fio dourado) e uma ponte por onde passa o caminho.
//
// Cada mundo tem um traçado feito à mão (coords locais da região):
//   nodes : 7 pontos — fases 1..5, fase dinâmica, castelo do chefe (sempre o último)
//   links : links[i] = pontos intermediários (cotovelos) do caminho nó i → nó i+1
//   bonus : { from, at, via } — ramo para a fase secreta a partir do nó `from`
//   exit  : cotovelos do castelo até a borda direita (x = RW), ligando ao próximo mundo
//   entry : cotovelos da borda esquerda (x = 0) até o 1º nó (y igual ao exit anterior)
// A lista de fases do mundo (WORLDS[i].levels) tem tamanho variável: os primeiros
// L-1 itens usam nodes[0..], o último (chefe) usa sempre nodes[6]. Se faltar um
// traçado, `linkWaypoints` gera um cotovelo em "L" automaticamente.
// =============================================================================

export const RW = 448, RH = 272;

export const LAYOUT = {
  // Floresta dos Brinquedos: sobe do prado, passa pelas montanhas, cruza o rio
  1: {
    nodes: [[40, 214], [100, 178], [100, 114], [178, 88], [234, 152], [300, 204], [392, 124]],
    links: [[[70, 214], [70, 178]], [], [[140, 114], [140, 88]], [[234, 88]], [[234, 204]], [[352, 204], [352, 124]]],
    bonus: { from: 3, at: [178, 42], via: [] },
    exit: [[392, 168], [424, 168], [424, 238], [448, 238]],
    entry: null,
  },
  // Oceano das Lágrimas: arquipélago ligado por pontes de madeira
  2: {
    nodes: [[46, 206], [98, 146], [162, 92], [234, 92], [234, 192], [316, 226], [384, 134]],
    links: [[[46, 146]], [[98, 92]], [], [], [[234, 226]], [[384, 226]]],
    bonus: { from: 3, at: [306, 50], via: [[306, 92]] },
    exit: [[420, 134], [420, 60], [448, 60]],
    entry: [[0, 238], [46, 238]],
  },
  // Cidade dos Relógios: ruas em grade, canais e pontes
  3: {
    nodes: [[38, 102], [102, 102], [102, 178], [182, 212], [252, 148], [316, 84], [398, 160]],
    links: [[], [], [[102, 212]], [[252, 212]], [[252, 84]], [[356, 84], [356, 160]]],
    bonus: { from: 2, at: [40, 216], via: [[40, 178]] },
    exit: [[426, 160], [426, 232], [448, 232]],
    entry: [[0, 60], [38, 60]],
  },
  // Pesadelo Debaixo da Cama: espiral entre ilhas de tapete flutuando no escuro
  4: {
    nodes: [[48, 200], [90, 128], [162, 62], [226, 128], [162, 204], [302, 180], [382, 98]],
    links: [[[48, 128]], [[90, 62]], [[226, 62]], [[226, 204]], [[162, 238], [302, 238]], [[302, 98]]],
    bonus: { from: 1, at: [138, 168], via: [[138, 128]] },
    exit: [[418, 98], [418, 204], [448, 204]],
    entry: [[0, 232], [48, 232]],
  },
  // Coração da Dimensão: retalhos de tecido costurados no cosmos
  5: {
    nodes: [[46, 204], [104, 142], [174, 86], [250, 142], [316, 212], [384, 162], [362, 74]],
    links: [[[104, 204]], [[104, 86]], [[250, 86]], [[250, 212]], [[384, 212]], [[322, 162], [322, 74]]],
    bonus: { from: 1, at: [46, 86], via: [[46, 142]] },
    exit: null,
    entry: [[0, 204]],
  },
};

/** Posição local (na região) do i-ésimo item de uma lista de fases de tamanho n. */
export function nodePos(world, i, n) {
  const L = LAYOUT[world];
  if (i === n - 1) return L.nodes[6];
  return L.nodes[Math.min(i, 5)];
}

/** Cotovelos do caminho entre o item i e i+1 (lista de tamanho n), em coords locais. */
export function linkWaypoints(world, i, n) {
  const L = LAYOUT[world];
  // traçado feito à mão quando a lista tem o tamanho "padrão" (7) ou o trecho é anterior ao chefe
  if (n === 7 || i + 1 < n - 1) { if (L.links[i]) return L.links[i]; }
  else if (i === 5 && L.links[5]) return L.links[5];
  // automático: anda na horizontal e depois na vertical (chega ao castelo pelo lado)
  const a = nodePos(world, i, n), b = nodePos(world, i + 1, n);
  if (a[0] === b[0] || a[1] === b[1]) return [];
  return i + 1 === n - 1 ? [[a[0], b[1]]] : [[b[0], a[1]]];
}
