// =============================================================================
// story/dialogues_w2.js — Falas do MUNDO 2 (Oceano das Lágrimas).
// NPCs: Capitã Bolha (w2_1, w2_3, w2_5 — missão 'bolha_crew', 3 marujos),
// Agulheta (loja, w2_5), garrafas com mensagens de crianças (w2_1, w2_3, w2_5).
// Placas: w2_sign_* (usadas pelos mapas em levels/w2_a.js, w2_b.js, w2_c.js).
// Formato: [{ who, expr, text }] — texto curto (≤ 110 caracteres), PT-BR.
// =============================================================================
import { registerDialogues } from '../registry.js';

const placa = (...texts) => texts.map((text) => ({ who: 'placa', text }));
const G = (t) => `{#ffd23f}${t}{/}`; // destaque dourado
const A = (t) => `{#7fe0ff}${t}{/}`; // destaque água

registerDialogues({
  // ------------------------------------------------------------ Capitã Bolha
  w2_bolha_1: [
    { who: 'capita_bolha', expr: 'determined', text: 'Quac! Alto lá, marujo! Identifique-se! Nome, posto e... isso é um RABO?' },
    { who: 'tico', expr: 'surprised', text: 'Eu sou o Tico! Um dinossauro. De pelúcia. Rabo incluso.' },
    { who: 'capita_bolha', expr: 'neutral', text: 'Capitã Bolha, do glorioso navio Banheirinha! Bom... ex-glorioso.' },
    { who: 'tico', expr: 'confused', text: 'Por que a água daqui é salgada? E... um pouco triste?' },
    { who: 'capita_bolha', expr: 'sad', text: `Este é o ${A('Oceano das Lágrimas')}. Cada gota é de uma criança que perdeu um brinquedo.` },
    { who: 'capita_bolha', expr: 'sad', text: 'Uma baleia de vidro engoliu meu navio. Minha tripulação sumiu no fundo do mar.' },
    { who: 'tico', expr: 'determined', text: 'Eu ajudo a achar eles! ...Depois de aprender a nadar. Isso é importante.' },
    { who: 'capita_bolha', expr: 'happy', text: 'Quac! Pule na água: PULAR dá braçadas. Pato não afunda, e você... vamos ver!' },
  ],
  w2_bolha_1_repeat: [
    { who: 'capita_bolha', expr: 'neutral', text: 'Bico erguido, marujo! E cuidado com os caranguejos: eles são bravos de frente.' },
  ],
  w2_bolha_2: [
    { who: 'capita_bolha', expr: 'surprised', text: 'Marujo Tico! Achei o casco de um navio enorme. Cheiro de sabonete... são eles!' },
    { who: 'capita_bolha', expr: 'sad', text: 'Meus três marujos de borracha estão presos em algum lugar dessas águas.' },
    { who: 'tico', expr: 'confused', text: 'Como eu reconheço um marujo de borracha?' },
    { who: 'capita_bolha', expr: 'neutral', text: 'Fácil: eles brilham, apitam quando apertados e choram de saudade da banheira.' },
    { who: 'capita_bolha', expr: 'determined', text: `Missão: ${G('resgatar 3 marujos')}! Um está aqui no navio. Os outros, mais adiante.` },
    { who: 'tico', expr: 'determined', text: 'Sim, senhora capitã! ...Eu bato continência com a pata ou com o rabo?' },
    { who: 'capita_bolha', expr: 'happy', text: 'Com o coração, marujo. Quac!' },
  ],
  w2_bolha_2_repeat: [
    { who: 'capita_bolha', expr: 'neutral', text: 'Os porões estão alagados. Procure redes costuradas: aquele Costureiro adora prender os outros.' },
  ],
  w2_bolha_3: [
    { who: 'capita_bolha', expr: 'scared', text: 'Q-quac... Que fossa escura. Nem a minha coragem de borracha boia aqui.' },
    { who: 'tico', expr: 'sad', text: 'Ainda não achei todos os marujos. Desculpa, capitã.' },
    { who: 'capita_bolha', expr: 'determined', text: 'Nada de desculpas! Volte pelas águas e olhe cada cantinho. Eles estão esperando.' },
    { who: 'capita_bolha', expr: 'sad', text: 'Um no navio, um nas ilhas flutuantes, um nesta fossa. Eu sinto pelo apito.' },
  ],
  w2_bolha_3_repeat: [
    { who: 'capita_bolha', expr: 'neutral', text: 'Navio, ilhas, fossa. Três marujos. Uma capitã muito ansiosa. Quac!' },
  ],
  w2_bolha_3_done: [
    { who: 'capita_bolha', expr: 'surprised', text: 'Esse apito... São vocês! Meus marujos! Pinguinho, Esponja e o Sargento Patinho!' },
    { who: 'capita_bolha', expr: 'happy', text: 'Tripulação completa! Você é o melhor dinossauro marinheiro dos sete mares!' },
    { who: 'tico', expr: 'happy', text: 'Sou o ÚNICO dinossauro marinheiro, mas eu aceito o título!' },
    { who: 'capita_bolha', expr: 'sad', text: 'Mas cuidado. A Baleia de Vidro está logo ali. Ela não é má... só engoliu tristeza demais.' },
    { who: 'capita_bolha', expr: 'neutral', text: `Leve estes ${G('botões')}, pagamento de capitã. E volte inteiro, ouviu?` },
  ],
  w2_bolha_3_done_repeat: [
    { who: 'capita_bolha', expr: 'happy', text: 'A tripulação mandou um apito de agradecimento. Piii! Boa viagem, marujo!' },
  ],

  // ------------------------------------------------------------ Agulheta
  w2_agulheta: [
    { who: 'agulheta', expr: 'happy', text: 'Tcharã! Loja submarina da Agulheta, aberta 24 horas! Bom, aqui é sempre noite.' },
    { who: 'tico', expr: 'surprised', text: 'Como você chegou no fundo do mar antes de mim?!' },
    { who: 'agulheta', expr: 'neutral', text: 'Uma comerciante nunca revela suas rotas. Nem seus preços... até você perguntar.' },
    { who: 'agulheta', expr: 'happy', text: 'E não, eu não furo boias. Foi UMA vez. A boia que começou.' },
  ],
  w2_agulheta_repeat: [
    { who: 'agulheta', expr: 'neutral', text: 'Botões molhados valem o mesmo! Pode pagar, eu seco depois.' },
  ],

  // ------------------------------------------------------------ Garrafas
  w2_bottle_1: [
    { who: 'narrador', text: 'Um bilhete com letra torta, borrado de lágrima:' },
    { who: 'narrador', text: '"Querido mar, devolve meu patinho amarelo. Ele tem medo de dormir longe da banheira. — Bia, 5 anos"' },
    { who: 'tico', expr: 'sad', text: 'Será que a Lia também escreveu um bilhete pra mim?' },
  ],
  w2_bottle_2: [
    { who: 'narrador', text: 'Um desenho de um barquinho, e embaixo:' },
    { who: 'narrador', text: '"Meu barquinho foi embora na enxurrada. Se alguém achar, fala que eu não fiquei bravo. — Léo"' },
    { who: 'tico', expr: 'neutral', text: 'Ninguém fica bravo. Só fica com saudade.' },
  ],
  w2_bottle_3: [
    { who: 'narrador', text: 'Um papel dobrado muitas vezes, com cheiro de travesseiro:' },
    { who: 'narrador', text: '"Eu cresci e esqueci de você, Coelhinho. Desculpa. Mas eu lembrei hoje. Obrigado por tudo."' },
    { who: 'tico', expr: 'sad', text: 'Lembrar tarde... ainda é lembrar. Né?' },
  ],

  // ------------------------------------------------------------ Placas
  w2_sign_beach: placa('Praia das Lágrimas. Proibido chorar na areia: já tem água salgada demais por aqui.'),
  w2_sign_crab: placa('Caranguejo! Ele bloqueia golpes de frente. Pule na cabeça ou bata por trás.'),
  w2_sign_unstitch: placa(`O altar guarda o ${G('Descosturar')}. Use perto de redes e costuras para desfazê-las.`),
  w2_sign_armor: placa('Polvo de pote! O pote protege a cabeça. DESCOSTURE o capacete e depois ataque.'),
  w2_sign_swim: placa('Na água: PULAR dá braçada, DASH dá impulso. Na superfície, PULAR te tira da água.'),
  w2_sign_oxygen: placa(
    'Recife fundo! Embaixo d\'água seu AR acaba. Suba à superfície ou toque nas bolhas dos respiradouros.',
    'Bolsões de ar dentro das cavernas também deixam respirar.',
  ),
  w2_sign_current: placa('Correntezas empurram tudo. Deixe-se levar... mas desvie dos ouriços!'),
  w2_sign_lever: placa('Correnteza forte demais no túnel? Procure a alavanca no bolsão de ar.'),
  w2_sign_ship: placa('Navio afundado à frente. A capitã jura que o rombo foi costurado "por um alfaiate muito mal-educado".'),
  w2_sign_hatch: placa('Escotilhas ligam os porões aos corredores. Mergulhe para baixo, nade para cima.'),
  w2_sign_deck: placa('Convés. A escotilha leva à cozinha. Cheiro de sopa de algas... argh.'),
  w2_sign_captain: placa('Diário da capitã: "Escondi meu tesouro onde ninguém olha: logo atrás de mim, à esquerda."'),
  w2_sign_blocks: placa('Bolsões de água flutuam no ar! Pule dentro, nade e salte para o próximo.'),
  w2_sign_geyser: placa('Gêiser! Ele borbulha antes de jorrar. Fique em cima e seja lançado lá pro alto.'),
  w2_sign_boat: placa('Barquinho de brinquedo: suba e faça a travessia. Sombras na lagoa saltam em quem passa!'),
  w2_sign_trench: placa('Fossa Escura. Respiradouros são raros: guarde fôlego e siga as águas-vivas brilhantes.'),
  w2_sign_whirl: placa('Redemoinho! Ele te puxa para o olho e te ARREMESSA. Use a seu favor.'),
  w2_sign_lurker: placa('Espreitadores vivem sob a superfície. Pule de plataforma em plataforma sem parar.'),
  w2_sign_bonus: placa('Corrente Turbulenta: só para marujos corajosos. O fio antigo espera no fim.'),
});
