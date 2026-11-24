// =============================================================================
// story/dialogues_w5.js — Falas do MUNDO 5 (O Coração da Dimensão).
// NPCs: Eco da Tecelã (w5_1, w5_3, w5_5), Agulheta (loja, w5_5).
// Placas: w5_ruins_1/2 (bonecos de pano) e w5_sign_* (levels/w5_a.js, w5_b.js, w5_c.js).
// Formato: [{ who, expr, text }] — texto curto (≤ 110 caracteres), PT-BR.
// =============================================================================
import { registerDialogues } from '../registry.js';

const placa = (...texts) => texts.map((text) => ({ who: 'placa', text }));
const G = (t) => `{#ffd23f}${t}{/}`;   // dourado
const V = (t) => `{#ff6aa8}${t}{/}`;   // carmesim da dimensão

registerDialogues({
  // ------------------------------------------------------------ Eco da Tecelã
  w5_tecela_1: [
    { who: 'tecela', expr: 'neutral', text: 'Pequeno costurado... Faz tanto tempo que um fio dourado não passa pelo nosso Tear.' },
    { who: 'tico', expr: 'surprised', text: 'Quem disse isso? Você é... uma voz? Um eco?' },
    { who: 'tecela', expr: 'neutral', text: 'Sou o que restou das Tecelãs. Fiamos o tecido entre o mundo de lá e o Avesso.' },
    { who: 'tecela', expr: 'happy', text: `Seu fio foi fiado com a ${G('primeira canção de ninar do mundo')}. Por isso ele brilha assim.` },
    { who: 'tico', expr: 'confused', text: 'Mas o Costureiro quer meu fio. Ele disse que só ele pode rasgar a costura.' },
    { who: 'tecela', expr: 'determined', text: `Um fio feito de amor não pertence a ninguém. ${V('Nem a quem o roubou.')}` },
    { who: 'tecela', expr: 'neutral', text: `Toque o Tear. Ele vai te ensinar a ${G('Forma Desfiada')}: soltar-se sem se desfazer.` },
    { who: 'tico', expr: 'determined', text: 'Soltar sem desfazer. Tá. Parece assustador. Vou fazer mesmo assim.' },
  ],
  w5_tecela_1_repeat: [
    { who: 'tecela', expr: 'neutral', text: `Junte a luz dos ${G('carretéis')} e bata nos inimigos. Quando o fio encher, solte-se.` },
  ],
  w5_tecela_2: [
    { who: 'tecela', expr: 'sad', text: 'Estas ruínas são pedaços dos mundos que ele descosturou. Floresta, mar, relógios, sombras...' },
    { who: 'tico', expr: 'scared', text: 'Por que tem tantos bonequinhos de pano aqui? Eles parecem... com ELE. Só que fofinhos.' },
    { who: 'tecela', expr: 'neutral', text: 'Ele os costura de memória. Sempre o mesmo boneco. Como quem tenta lembrar do próprio rosto.' },
    { who: 'tico', expr: 'confused', text: 'Então o Costureiro já foi... pequeno? Um brinquedo, igual a mim?' },
    { who: 'tecela', expr: 'neutral', text: 'Os cristais da fenda trocam o vermelho pelo azul. O caminho existe nos dois. Escolha bem.' },
  ],
  w5_tecela_2_repeat: [
    { who: 'tecela', expr: 'neutral', text: `Bata no cristal: blocos ${V('vermelhos')} somem, blocos {#6ab8ff}azuis{/} aparecem. E ao contrário.` },
  ],
  w5_tecela_3: [
    { who: 'tecela', expr: 'neutral', text: 'Aqui em cima fica a Costura do Céu. Do outro lado dela, ele espera por você.' },
    { who: 'tico', expr: 'sad', text: 'Eu tenho medo. E se eu não conseguir voltar pra Lia?' },
    { who: 'tecela', expr: 'happy', text: 'Medo é só o fio esticado antes do ponto. Você aprendeu tudo que precisa no caminho.' },
    { who: 'tecela', expr: 'neutral', text: 'Lembre: ele não quer destruir. Ele quer não ser esquecido. São coisas parecidas... e diferentes.' },
    { who: 'tico', expr: 'determined', text: 'Então eu vou lembrar dele. E vou voltar pra casa. As duas coisas.' },
  ],
  w5_tecela_3_repeat: [
    { who: 'tecela', expr: 'neutral', text: 'Use tudo: costura, descostura, tempo, retalho e fio solto. O céu não tem atalhos.' },
  ],
  // ------------------------------------------------------------ Agulheta
  w5_agulheta: [
    { who: 'agulheta', expr: 'surprised', text: 'Tico! No fim do mundo! Literalmente! Que bom que você trouxe botões. Trouxe, né?' },
    { who: 'tico', expr: 'confused', text: 'Agulheta, como você SEMPRE chega antes de mim?' },
    { who: 'agulheta', expr: 'happy', text: 'Atalhos dimensionais, querido. E uma ótima agenda. Liquidação de fim de dimensão!' },
    { who: 'agulheta', expr: 'sad', text: 'Se o Costureiro rasgar tudo, eu fico sem freguês. Então compre, e depois vença ele. Nessa ordem.' },
  ],
  // ------------------------------------------------------------ Placas
  w5_ruins_1: placa(
    'Um bonequinho de pano, sentado nos escombros. Rasgo no peito, sorriso costurado torto.',
    'Bordado no pé, quase apagado: "F...". O resto da letra se desfez.'),
  w5_ruins_2: placa(
    `Dezenas de bonecos iguais, enfileirados. Todos com o mesmo ${V('rasgo no peito')}.`,
    'Num deles, um bilhete: "Se eu fizer muitos, algum ela vai reconhecer."'),
  w5_sign_heart: placa('O Coração da Dimensão. Aqui o tecido do mundo é fino como papel de seda.'),
  w5_sign_unravel: placa(
    `Carretéis de luz enchem o fio. Fio cheio: ative a ${G('Forma Desfiada')} e atravesse a barreira de fios!`),
  w5_sign_airplat: placa('Desfiado, cada pulo no ar tece um degrau dourado. Três por voo. Lá em cima brilha algo...'),
  w5_sign_rift: placa(`Cristal da fenda: bata nele e o mundo troca de cor. ${V('Vermelho')} ou {#6ab8ff}azul{/}, nunca os dois.`),
  w5_sign_rail: placa('Tirolesa de fio dourado! Pule nela, deslize e solte com um pulo no final.'),
  w5_sign_decoy: placa('O portão pede alguém na placa. Alguém... ou uma cópia de alguém.'),
  w5_sign_bridge: placa('Ponte de Fios. Lá embaixo não tem nada. Nem chão, nem fim. Segure firme.'),
  w5_sign_updraft: placa('Costuras de gravidade sopram pra cima e devolvem o pulo duplo. Suba sem medo!'),
  w5_sign_portal: placa('Portais da mesma cor estão ligados. Entre num, saia no outro — com a mesma velocidade.'),
  w5_sign_bonus: placa('O Último Fio. Uma canção antiga ecoa no fim deste caminho.'),
});
