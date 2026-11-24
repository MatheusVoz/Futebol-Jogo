// =============================================================================
// story/dialogues_w3.js — Falas do MUNDO 3 (Cidade dos Relógios Quebrados).
// NPCs: Tique-Taque (w3_1, w3_2, w3_4), Agulheta (loja, w3_5), ficha da Torre
// (w3_registry, em w3_4). Placas: w3_sign_* (levels/w3_a.js, w3_b.js, w3_c.js).
// Formato: [{ who, expr, text }] — texto curto (≤ 110 caracteres), PT-BR.
// =============================================================================
import { registerDialogues } from '../registry.js';

const placa = (...texts) => texts.map((text) => ({ who: 'placa', text }));
const G = (t) => `{#ffd23f}${t}{/}`;   // destaque dourado
const B = (t) => `{#7fe6ff}${t}{/}`;   // destaque azul (tempo)

registerDialogues({
  // ------------------------------------------------------------ Tique-Taque
  w3_tique_1: [
    { who: 'tique_taque', expr: 'happy', text: 'Cuco! São três e quinze! São três e quinze! São três e...' },
    { who: 'tico', expr: 'confused', text: 'Oi? Passarinho? Você tá bem? Faz um tempão que são três e quinze.' },
    { who: 'tique_taque', expr: 'surprised', text: 'Tempão? Aqui não tem tempão. Aqui não tem tempão. O tempo PAROU, pequeno.' },
    { who: 'tique_taque', expr: 'neutral', text: 'Cada relógio daqui parou na hora em que um brinquedo foi perdido. Foi perdido.' },
    { who: 'tico', expr: 'sad', text: 'Então tem um relógio parado na hora em que eu caí da cama?' },
    { who: 'tique_taque', expr: 'neutral', text: 'Sou o Tique-Taque. Minha mola quebrou e eu repito... eu repito... eu repito.' },
    { who: 'tique_taque', expr: 'happy', text: `Ali na praça! O ${G('relógio-altar')}! Ele remenda o tempo. Remenda o tempo!` },
    { who: 'tico', expr: 'determined', text: 'Remendar o tempo? Isso eu preciso ver. Valeu, Tique-Taque!' },
    { who: 'tique_taque', expr: 'happy', text: 'De nada! São três e quinze! De nada! São três e quinze!' },
  ],
  w3_tique_1_repeat: [
    { who: 'tique_taque', expr: 'neutral', text: `Se o chão cair, ${B('volte o tempo')}. Volte o tempo. Cuco!` },
  ],
  w3_tique_2: [
    { who: 'tique_taque', expr: 'surprised', text: 'Cuco! Você chegou alto! Chegou alto! Olhe pra lá, olhe pra lá!' },
    { who: 'tique_taque', expr: 'neutral', text: `Aquela torre torta é a ${G('Torre dos Registros')}. Todo brinquedo perdido tem uma ficha lá.` },
    { who: 'tico', expr: 'surprised', text: 'Uma ficha? Tipo... com nome e tudo? Será que tem uma minha?' },
    { who: 'tique_taque', expr: 'neutral', text: 'Nome, dono, dia e hora. Dia e hora. Ninguém mais lê. Ninguém mais lê.' },
    { who: 'tique_taque', expr: 'happy', text: 'Os relógios daqui piscam antes de sumir. Pule no tique, pouse no taque!' },
    { who: 'tico', expr: 'happy', text: 'Tique, taque. Pulo, pouso. Entendi! ...Acho.' },
  ],
  w3_tique_2_repeat: [
    { who: 'tique_taque', expr: 'neutral', text: 'Dourado na primeira metade, verde na segunda. Verde na segunda. Cuco!' },
  ],
  w3_tique_3: [
    { who: 'tique_taque', expr: 'happy', text: 'Cuco! Você subiu a torre! Subiu a torre! Eu vim pelo poço do relógio.' },
    { who: 'tico', expr: 'surprised', text: 'Quantas gavetas... Isso tudo são brinquedos perdidos?' },
    { who: 'tique_taque', expr: 'sad', text: 'Milhares. Milhares. Alguns esperam tanto que esquecem que estão esperando.' },
    { who: 'tique_taque', expr: 'neutral', text: 'A ficha mais velha está bem ali. Bem ali. Ninguém lê a mais velha.' },
    { who: 'tico', expr: 'determined', text: 'Então eu leio. Alguém tem que lembrar deles.' },
  ],
  w3_tique_3_repeat: [
    { who: 'tique_taque', expr: 'neutral', text: 'Lá em cima o Rei guarda o segundo perdido. O segundo perdido. Cuidado!' },
  ],
  // ------------------------------------------------------------ Ficha da Torre
  w3_registry: [
    { who: 'placa', text: 'REGISTRO DE BRINQUEDOS PERDIDOS — gaveta 1, ficha nº 1. Papel amarelado, letra antiga.' },
    { who: 'placa', text: `${G('FIAPO')} — boneco de pano. Perdido na ${B('tempestade de 1968')}. Dona: "uma menina de tranças".` },
    { who: 'tico', expr: 'confused', text: '1968? Isso é... muito tempo. Muito, MUITO tempo.' },
    { who: 'placa', text: 'Situação: "Ainda esperando." (Alguém riscou e escreveu por cima: "Ninguém virá.")' },
    { who: 'tico', expr: 'sad', text: 'Fiapo... Quem será você? Espero que alguém ainda lembre de você.' },
  ],
  w3_registry_repeat: [
    { who: 'placa', text: 'FIAPO — perdido na tempestade de 1968. "Ainda esperando."' },
  ],
  // ------------------------------------------------------------ Agulheta
  w3_agulheta: [
    { who: 'agulheta', expr: 'happy', text: 'Tico, meu cliente preferido! Chegou na hora certa. Aqui toda hora é a mesma, mas enfim!' },
    { who: 'tico', expr: 'surprised', text: 'Agulheta?! Como você chegou nos telhados antes de mim?' },
    { who: 'agulheta', expr: 'neutral', text: 'Segredo comercial. Digamos que eu "volto no tempo" pra abrir a loja cedo.' },
    { who: 'agulheta', expr: 'happy', text: `Tempo é dinheiro, e ${G('botões')} também! Vamos às compras, que o relógio não espera. Ah, espera.` },
  ],
  // ------------------------------------------------------------ Placas
  w3_sign_city: placa('Cidade dos Relógios Quebrados. Aqui, cada relógio parou na hora em que alguém foi esquecido.'),
  w3_sign_rewind: placa(
    `${B('Remendo Temporal')}: blocos rachados, pontes e relógios que caírem voltam ~3 segundos no tempo.`,
    'Use perto deles (alcance de 6 passos). Não funciona em você nem nos inimigos.'),
  w3_sign_bridge: placa('Cuidado: a ponte do beco desaba quando alguém pisa na placa. Desabou? Volte o tempo!'),
  w3_sign_falling: placa(
    'Relógios pendurados despencam em quem passa embaixo!',
    `Volte o tempo logo depois da queda: o relógio volta pro alto e fica ${G('preso')}, virando degrau.`),
  w3_sign_boulder: placa('O portão só abre com peso na placa. Um bom empurrão no novelo resolve.'),
  w3_sign_reflect: placa(`Soldadinhos atiram rolhas. Use o ${B('Remendo')} perto delas e elas voltam pra quem atirou!`),
  w3_sign_clock: placa('Plataformas-relógio: as douradas e as verdes se revezam. Elas piscam antes de sumir.'),
  w3_sign_rhythm: placa('Ruas Suspensas. Não olhe pra baixo. Siga o tique-taque dos relógios.'),
  w3_sign_hand: placa('Ponteiros gigantes giram sem parar. Ande por cima deles, mas pule antes que fiquem em pé!'),
  w3_sign_slow: placa(`Bolhas ${B('azuis')} deixam tudo lento lá dentro: serras, relógios, portões... e você também.`),
  w3_sign_fast: placa(`Bolhas ${G('laranjas')} aceleram o tempo. Corra, que os relógios caem mais rápido aqui!`),
  w3_sign_factory: placa('Fábrica de Engrenagens. Esteiras levam quem estiver em cima. Não durma no ponto!'),
  w3_sign_rustbot: placa('Robôs enferrujados usam placas remendadas. Descosture as placas e bata! Pule as ondas do soco.'),
  w3_sign_saw: placa('Serras em trilho! Observe o vai-e-vem e passe quando ela subir.'),
  w3_sign_conveyor: placa('A esteira leva qualquer coisa... até novelos gigantes. Para onde será que ela vai?'),
  w3_sign_tower: placa('Torre dos Registros. Quatro andares de gavetas. Suba sempre: os poços ficam nas pontas.'),
  w3_sign_pendulum: placa('Pêndulos com lâmina! Passe logo depois que ele balançar pra longe.'),
  w3_sign_gate: placa('Portões do compasso só abrem na fatia verde do mostrador. Espere o tique certo!'),
  w3_sign_roofs: placa('Telhados do Tempo. Daqui dá pra ouvir o tique-taque do castelo do Rei.'),
  w3_sign_bonus: placa('Corrida Contra o Ponteiro! Os relógios aqui são apressados. Não pare nunca.'),
});
