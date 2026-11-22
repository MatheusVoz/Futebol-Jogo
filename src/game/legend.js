// =============================================================================
// legend.js — Caracteres GLOBAIS dos mapas ASCII das fases.
// Tiles: # sólido | % sólido alternativo | = plataforma vazada | ^ espinhos
//        ~ água | H parede falsa (segredo) | : parede de fundo | . vazio
// 'P' = início do jogador.
// Os mundos registram letras próprias com registerLegend(world, {...}):
//   inimigos:  a b d f g k
//   mecânicas: j l m p q s u v w x y z 1-9
// =============================================================================
export const GLOBAL_LEGEND = {
  E: 'exit',            // saída da fase (portal de costura)
  K: 'checkpoint',      // ponto de controle (carretel)
  o: 'button',          // botão dourado (moeda)
  O: 'big_button',      // botão grande (5 moedas, persistente)
  '*': 'star',          // estrela costurada (3 por fase)
  M: 'memory',          // fragmento de memória (props.memory = id)
  r: 'patch',           // retalho mágico (árvore de habilidades)
  T: 'ancient_thread',  // fio antigo (raro)
  h: 'heart',           // coração (cura)
  e: 'energy',          // carretel de energia
  c: 'chest',           // baú (props.contents)
  '@': 'anchor',        // ilhó de costura (Costura Dimensional)
  B: 'breakable',       // bloco quebrável (ataque)
  S: 'seam_wall',       // parede costurada (Descosturar)
  C: 'crumble',         // plataforma que desmorona (Remendo Temporal)
  X: 'secret_marker',   // gatilho invisível de área secreta
  n: 'npc',             // personagem (props.npc, props.dialog)
  i: 'sign',            // placa (props.text)
  J: 'spring',          // mola/botão saltitante
  G: 'gate',            // portão (abre com sinal props.signal)
  L: 'lever',           // alavanca (props.signal)
  D: 'pressure_plate',  // placa de pressão (props.signal) — o Retalho Fantasma ativa
  Q: 'ability_shrine',  // altar de habilidade (props.ability)
  U: 'shop',            // loja da Agulheta
  F: 'moving_platform', // plataforma móvel (props.dx, props.dy em tiles, props.speed)
  Y: 'thread_barrier',  // barreira de fios (só atravessa na Forma Desfiada)
  W: 'falling_platform',// plataforma que cai (sem remendo)
};
