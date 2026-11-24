// =============================================================================
// story/dialogues_w4.js — Falas do MUNDO 4 (O Pesadelo Debaixo da Cama).
// NPCs: Luzinha (w4_1, w4_3 via cutscene 'w4_revelation', w4_5), Agulheta (loja,
// w4_5), sussurros do Costureiro nas placas (w4_whisper_1/2, w4_4).
// Placas: w4_sign_* (usadas pelos mapas em levels/w4_a.js, w4_b.js, w4_c.js).
// Formato: [{ who, expr, text }] — texto curto (≤ 110 caracteres), PT-BR.
// =============================================================================
import { registerDialogues } from '../registry.js';

const placa = (...texts) => texts.map((text) => ({ who: 'placa', text }));
const G = (t) => `{#ffd23f}${t}{/}`; // destaque dourado
const V = (t) => `{#c070ff}${t}{/}`; // destaque roxo (Costureiro)

registerDialogues({
  // ------------------------------------------------------------ Luzinha
  w4_luzinha_1: [
    { who: 'luzinha', expr: 'scared', text: 'Q-quem está aí? Se for um monstro, eu aviso: eu brilho MUITO! ...Um pouquinho.' },
    { who: 'tico', expr: 'surprised', text: 'Um vagalume de pelúcia! Calma, eu sou o Tico. Só um dinossauro perdido.' },
    { who: 'luzinha', expr: 'neutral', text: 'Eu sou a Luzinha. Eu era a luz de cabeceira de um menino. Ele dizia que eu espantava os monstros.' },
    { who: 'luzinha', expr: 'sad', text: 'Aí ele cresceu, e o escuro parou de dar medo. Eu vim parar aqui embaixo da cama.' },
    { who: 'tico', expr: 'determined', text: 'Então vem comigo! Eu espanto os monstros e você espanta o escuro. Trato?' },
    { who: 'luzinha', expr: 'happy', text: 'Trato! Fique pertinho de mim: as sombras odeiam luz. E eu odeio sombras. Combinamos!' },
  ],
  w4_luzinha_1_repeat: [
    { who: 'luzinha', expr: 'neutral', text: 'Estou bem atrás de você! Bom... bem atrás e tremendo. Mas estou!' },
  ],
  w4_luzinha_2: [
    { who: 'luzinha', expr: 'sad', text: 'Tico... você está apagado. E olha que quem apaga sou eu.' },
    { who: 'tico', expr: 'sad', text: 'Eu sou só um brinquedo, Luzinha. Ou sou algo muito maior... e pior do que isso?' },
    { who: 'luzinha', expr: 'determined', text: 'Você me tirou do escuro. Brinquedo nenhum faz isso por obrigação. Faz porque ama.' },
    { who: 'luzinha', expr: 'happy', text: 'Quem usa um fio não decide o que ele costura. Você decide. Vamos?' },
    { who: 'tico', expr: 'determined', text: 'Vamos. A Lia está me esperando. E eu não vou deixar ninguém rasgar o mundo dela.' },
  ],
  w4_luzinha_2_repeat: [
    { who: 'luzinha', expr: 'happy', text: 'Brilha comigo! Um, dois... três! Viu? O escuro ficou menor.' },
  ],
  w4_luzinha_3: [
    { who: 'luzinha', expr: 'sad', text: 'T-Tico... aquela sombra era tão grande... eu gastei quase toda a minha luz...' },
    { who: 'tico', expr: 'scared', text: 'Luzinha! Não apaga, por favor! Fica comigo!' },
    { who: 'luzinha', expr: 'sad', text: 'Tá tão frio... Será que é assim que os brinquedos esquecidos se sentem?' },
    { who: 'tico', expr: 'determined', text: `Pega a minha luz. Minhas costuras brilham, lembra? ${G('Fio antigo')}. Divide comigo.` },
    { who: 'luzinha', expr: 'surprised', text: 'Tá... quentinho. Eu estou brilhando de novo! Seu fio brilha como uma canção de ninar.' },
    { who: 'luzinha', expr: 'happy', text: 'Agora corre, Tico! Eu ilumino o caminho. Juntos, como combinamos!' },
  ],
  w4_luzinha_3_repeat: [
    { who: 'luzinha', expr: 'happy', text: 'Luz recarregada! Nunca mais me deixe ficar sem abraço. Digo, sem luz.' },
  ],

  // ------------------------------------------------------------ Agulheta
  w4_agulheta: [
    { who: 'agulheta', expr: 'scared', text: 'AAAH! Ah, é você. Achei que fosse um monstro. Monstros nunca compram nada.' },
    { who: 'tico', expr: 'confused', text: 'Você montou uma loja debaixo da cama de um pesadelo?' },
    { who: 'agulheta', expr: 'happy', text: 'Clientes assustados compram o dobro! É ciência. Promoção especial de coragem!' },
    { who: 'agulheta', expr: 'neutral', text: 'E não, os espinhos não são de medo. Eu nasci assim. Charmosa e pontuda.' },
  ],
  w4_agulheta_repeat: [
    { who: 'agulheta', expr: 'neutral', text: 'Compre logo, que eu ouvi um rangido e não fui eu. Acho.' },
  ],

  // ------------------------------------------------------------ Sussurros
  w4_whisper_1: [
    { who: 'placa', text: 'Rabiscado com fio roxo, a letra treme:' },
    { who: 'costureiro', expr: 'neutral', text: `${V('...pequeno... fio antigo... continue... cada passo seu... me aproxima...')}`, shake: true },
    { who: 'tico', expr: 'scared', text: 'Quem disse isso?! ...Luzinha, foi você? Fala que foi você.' },
  ],
  w4_whisper_2: [
    { who: 'placa', text: 'Outra mensagem, costurada por dentro do papel de parede:' },
    { who: 'costureiro', expr: 'neutral', text: `${V('...ninguém lembra de mim... logo... ninguém vai precisar lembrar...')}`, shake: true },
    { who: 'tico', expr: 'sad', text: 'Essa voz parece... triste. Por que um monstro estaria triste?' },
  ],

  // ------------------------------------------------------------ Placas
  w4_sign_dark: placa('Aqui embaixo é escuro. Fique perto da Luzinha e ataque os abajures para acendê-los.'),
  w4_sign_pool: placa('Poças de sombra machucam no escuro. Com luz por perto, elas não fazem nada.'),
  w4_sign_hand: placa('Rachaduras que brilham? Uma mão vai sair dali! Passe rápido ou pule por cima.'),
  w4_sign_decoy: placa(`O altar guarda o ${G('Retalho Fantasma')}: uma cópia sua que distrai monstros e pesa nas placas.`),
  w4_sign_decoy2: placa(
    'O portão fica longe! Deixe a cópia na placa e corra. Usar de novo TROCA você de lugar com ela.',
  ),
  w4_sign_toybox: placa('Caixa-surpresa! Caia em cima e ela te joga lá no alto.'),
  w4_sign_lamp: placa('Sombras fogem de abajures acesos. Acenda este antes de seguir.'),
  w4_sign_hide: placa('Corredor dos Armários. Interagir num guarda-roupa te esconde: sombras perdem você de vista.'),
  w4_sign_closet: placa('Portas de armário abrem e fecham sozinhas. Espere a hora certa... e não olhe pra dentro.'),
  w4_sign_creak: placa('Assoalho velho! Correr ou cair aqui faz barulho. Ande devagar, na pontinha das patas.'),
  w4_sign_lever: placa('Alavanca adiante: acende os abajures sobre a poça de sombra.'),
  w4_sign_dolls: placa('Bonecas só andam quando você NÃO está olhando. Encare e bata enquanto estão paradas.'),
  w4_sign_plate: placa('Placa de pressão: segura o portão aberto. Sua cópia fantasma pesa o suficiente!'),
  w4_sign_mirror: placa('Espelho mágico. O reflexo copia seus passos do outro lado... até os ruins.'),
  w4_sign_maze: placa('Labirinto de Brinquedos. Saída? Talvez. Monstros? Com certeza.'),
  w4_sign_anchor_lamp: placa('Costure os ilhós: o fio acende o abajur e afasta as sombras da poça.'),
  w4_sign_lamps: placa('Corredor das sombras. Acenda cada abajur e avance de luz em luz.'),
  w4_sign_escape: placa('Silêncio... silêncio demais. Compre o que precisar. Algo grande está acordando.'),
  w4_sign_run: placa('Daqui em diante: CORRA! Esconder-se num armário faz a sombra parar.'),
  w4_sign_bonus: placa('Pesadelo Sem Fim: tudo o que dá medo, de uma vez só. O fio antigo espera no fim.'),
});
