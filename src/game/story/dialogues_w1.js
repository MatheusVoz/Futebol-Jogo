// =============================================================================
// story/dialogues_w1.js — Falas do MUNDO 1 (Floresta dos Brinquedos Perdidos).
// NPCs: Sr. Botão (w1_1, w1_2, w1_5), Pip (w1_3, w1_4), Agulheta (loja, w1_5).
// Placas: w1_sign_* (usadas pelos mapas em levels/w1_a.js, w1_b.js, w1_c.js).
// Formato: [{ who, expr, text }] — texto curto (≤ 110 caracteres), PT-BR.
// =============================================================================
import { registerDialogues } from '../registry.js';

const placa = (...texts) => texts.map((text) => ({ who: 'placa', text }));
const G = (t) => `{#ffd23f}${t}{/}`; // destaque dourado

registerDialogues({
  // ------------------------------------------------------------ Sr. Botão
  w1_botao_1: [
    { who: 'botao', expr: 'neutral', text: 'Ora, ora. Mais um que caiu do céu. Cuidado onde pisa, pequeno.' },
    { who: 'tico', expr: 'surprised', text: 'Um urso! Um urso que FALA! ...Espera. Eu também falo?!' },
    { who: 'botao', expr: 'neutral', text: `Bem-vindo ao ${G('Avesso')}, onde vêm parar as coisas esquecidas.` },
    { who: 'tico', expr: 'confused', text: 'Esquecidas? Não, não. A Lia não me esqueceu. Eu só... caí da cama.' },
    { who: 'botao', expr: 'sad', text: 'Todos dizem isso no começo. Sou o Sr. Botão. Perdi um olho... e um menino chamado Rafa.' },
    { who: 'tico', expr: 'determined', text: 'Então eu preciso voltar pra casa! Como eu saio daqui?' },
    { who: 'botao', expr: 'neutral', text: 'Siga floresta adentro. Mas primeiro aprenda a usar essas perninhas curtas.' },
    { who: 'tico', expr: 'happy', text: 'Elas são curtas, mas são RÁPIDAS! ...Eu acho.' },
  ],
  w1_botao_1_repeat: [
    { who: 'botao', expr: 'neutral', text: 'Vá, vá. A floresta não morde. Bom... quase nada aqui morde.' },
  ],
  w1_botao_2: [
    { who: 'botao', expr: 'surprised', text: 'Esse brilho... Deixe-me ver suas costuras, pequeno.' },
    { who: 'tico', expr: 'confused', text: 'Ei! Cuidado, eu sinto cócegas nas costuras!' },
    { who: 'botao', expr: 'neutral', text: `Fio dourado. ${G('Fio antigo')}... como o das Tecelãs das histórias.` },
    { who: 'tico', expr: 'surprised', text: 'Tecelãs? Quem me costurou foi a Vó Celeste, com o cobertor de bebê da Lia!' },
    { who: 'botao', expr: 'neutral', text: 'Então sua avó sabia mais do que contava. Esse fio liga coisas: ilhós, pontes... mundos.' },
    { who: 'botao', expr: 'neutral', text: `Ache um ${G('ilhó dourado')} e use a Costura. O fio faz o resto.` },
    { who: 'tico', expr: 'happy', text: 'Um dinossauro com superpoderes de costura. A Lia NUNCA vai acreditar!' },
  ],
  w1_botao_2_repeat: [
    { who: 'botao', expr: 'neutral', text: 'Ilhó dourado, Costura, ponte. Simples. Até um urso de um olho só entende.' },
  ],
  w1_botao_3: [
    { who: 'botao', expr: 'scared', text: 'Pare! Não tão rápido. Está ouvindo? Nem os grilos cantam aqui.' },
    { who: 'tico', expr: 'scared', text: 'Eu estou ouvindo meu enchimento tremer. Isso conta?' },
    { who: 'botao', expr: 'sad', text: 'Na névoa mora o {#ff6a6a}Coelho Sem Rosto{/}. Arrancaram o rosto dele... e as lembranças junto.' },
    { who: 'tico', expr: 'sad', text: 'Os brinquedos pendurados nas árvores... eles também não têm rosto.' },
    { who: 'botao', expr: 'neutral', text: 'Ele não é mau, pequeno. Está perdido. Mas um brinquedo perdido assim machuca.' },
    { who: 'tico', expr: 'determined', text: 'Então eu vou com cuidado. E se ele estiver triste... sei lá, eu dou um abraço?' },
    { who: 'botao', expr: 'happy', text: 'Ha! Abraço de dinossauro. Talvez funcione. Vá. E volte inteiro.' },
  ],
  w1_botao_3_repeat: [
    { who: 'botao', expr: 'neutral', text: 'Fique longe dos galhos com brinquedos pendurados. E cuide desse fio dourado.' },
  ],

  // ------------------------------------------------------------------ Pip
  w1_pip_1: [
    { who: 'pip', expr: 'scared', text: 'AAAH! Um m-m-monstro brilhante!', shake: true },
    { who: 'tico', expr: 'surprised', text: 'Monstro? Onde?! ...Ah. O monstro sou eu?' },
    { who: 'pip', expr: 'scared', text: 'Seus pontos brilham igual aos do homem dos fios! N-não chega perto!' },
    { who: 'tico', expr: 'sad', text: 'Espera! Eu só quero conversar! Eu sou fofinho, olha!' },
  ],
  w1_pip_1_repeat: [
    { who: 'pip', expr: 'scared', text: 'Não! Não! Tchau!' },
  ],
  w1_pip_2: [
    { who: 'pip', expr: 'sad', text: 'V-você de novo... Desculpa ter fugido. Eu tenho medo de coisas que brilham.' },
    { who: 'tico', expr: 'happy', text: 'Tudo bem! Eu tenho medo do escuro. E de aspirador de pó.' },
    { who: 'pip', expr: 'sad', text: `Perdi minha ${G('chave de corda')} nas raízes. Sem ela eu paro... e fico parado pra sempre.` },
    { who: 'tico', expr: 'determined', text: 'Deixa comigo! Achar coisas perdidas é minha especialidade. ...Desde hoje.' },
    { who: 'pip', expr: 'neutral', text: 'Ela caiu lá no fundo, onde as raízes sussurram. Cuidado com os ursinhos bravos!' },
  ],
  w1_pip_2_repeat: [
    { who: 'pip', expr: 'sad', text: 'Achou a chave? Ela brilha um pouquinho, lá no fundo das raízes...' },
  ],
  w1_pip_3: [
    { who: 'tico', expr: 'happy', text: 'Olha o que eu achei! Uma chave de corda tamanho ratinho!' },
    { who: 'pip', expr: 'surprised', text: 'Minha chave! Você achou mesmo!' },
    { who: 'pip', expr: 'happy', text: 'Gira, gira, gira... Ahhh! Cada engrenagem cantando de novo!' },
    { who: 'pip', expr: 'happy', text: 'Você não é monstro nenhum. Toma, uns botões que eu guardei. Amigos?' },
    { who: 'tico', expr: 'happy', text: 'Amigos! Meu primeiro amigo no Avesso é um ratinho de corda. Que demais!' },
  ],
  w1_pip_3_repeat: [
    { who: 'pip', expr: 'happy', text: 'Tic-tic-tic! Tô funcionando! Se cuida lá na frente, Tico!' },
  ],

  // ------------------------------------------------------------- Agulheta
  w1_agulheta: [
    { who: 'agulheta', expr: 'happy', text: 'Freguês! Freguês novo! Entra, entra, que os alfinetes não mordem. Muito.' },
    { who: 'tico', expr: 'surprised', text: 'Você é um porco-espinho... ou uma almofada de alfinetes?' },
    { who: 'agulheta', expr: 'neutral', text: `Sou empreendedora, querido. Agulheta, a seu dispor. Aceito ${G('botões dourados')}.` },
    { who: 'tico', expr: 'confused', text: 'Botões? Peguei um monte! Achei que eram moedas de chocolate...' },
    { who: 'agulheta', expr: 'happy', text: 'Chocolate não compra melhorias. Botões compram! Dá uma olhadinha, sem compromisso.' },
  ],

  // ------------------------------------------------------- placas — w1_1
  w1_sign_move: [
    ...placa('Use o ANALÓGICO (ou ← →) para andar. Os botões dourados pelo caminho são seus!'),
    { who: 'tico', expr: 'happy', text: 'Um pé, depois o outro... Eu sou praticamente um atleta!' },
  ],
  w1_sign_jump: placa('Aperte PULAR para pular. Tocos não são obstáculos: são degraus!'),
  w1_sign_varjump: placa('Toque rápido em PULAR = pulinho. Segure PULAR = pulo alto. Teste nesse muro!'),
  w1_sign_spikes: [
    ...placa('Espinhos de alfinete! Pule por cima, a não ser que queira virar almofada.'),
    { who: 'tico', expr: 'scared', text: 'Eu já sou de pelúcia. Não preciso de mais furinhos, obrigado.' },
  ],
  w1_sign_run: placa('Segure CORRER (ou continue andando) para disparar. Correndo, o pulo vai mais longe!'),
  w1_sign_attack: placa('ATACAR: chicote de fio! Aperte 3 vezes para um combo e quebre esses blocos.'),
  w1_sign_downstrike: [
    ...placa('O chão aqui soa oco... No ar, segure BAIXO e aperte ATACAR para golpear para baixo.'),
    { who: 'tico', expr: 'confused', text: 'Oco? Chão oco esconde coisa. Todo mundo sabe disso.' },
  ],
  w1_sign_dash: placa('DASH: um impulso rápido! Funciona no ar também (uma vez por pulo).'),
  w1_sign_stomp: placa('Besourinhos de retalho! Pule na cabeça deles ou use o chicote.'),

  // ------------------------------------------------------- placas — w1_2
  w1_sign_stitch: placa(
    `Perto de um ${G('ilhó dourado')}, aperte HABILIDADE: o fio vira ponte até outro ilhó!`,
    'A ponte dura poucos segundos. Atravesse sem enrolar!',
  ),
  w1_sign_enemies: placa('Brinquedos bravos! A marionete pula e chuta: espere o chute e contra-ataque.'),
  w1_sign_lasso: placa('Sem ilhó por perto, a Costura LAÇA o inimigo à frente e o prende um tempinho.'),
  w1_sign_realgap: [
    ...placa('Este buraco é de verdade: espinhos lá embaixo! Costure e atravesse rápido.'),
    { who: 'tico', expr: 'determined', text: 'Fio dourado, não me deixa na mão. Quer dizer... na pata.' },
  ],
  w1_sign_burrow: placa('Toca dos Botões. Dizem que o chão por aqui é oco... um golpe para baixo bem dado e quem sabe?'),
  w1_sign_gate: placa('Portão de raízes. Dizem que ele se abre quando alguém costura os ilhós da frente.'),

  // ------------------------------------------------------- placas — w1_3
  w1_sign_toys: [
    ...placa('Trilha dos Brinquedos Quebrados. Aqui descansam carrinhos sem rodas e piões sem ponta.'),
    { who: 'tico', expr: 'sad', text: 'Será que os donos deles sentem saudade? ...Será que a Lia sente a minha?' },
  ],
  w1_sign_boom: placa('Cogumelos-bomba! Incham quando você chega perto. Estoure com o chicote antes do BUM.'),
  w1_sign_birds: placa('Pássaros de papel mergulham em quem passa embaixo. Corra, ou chicoteie para cima!'),
  w1_sign_climb: placa(
    'Ravina dos Blocos. Plataformas que tremem, caem! O elevador de carretel é mais calmo.',
    'Os blocos caídos voltam depois de um tempinho. Paciência é uma virtude (de pelúcia).',
  ),
  w1_sign_pip: [
    ...placa('Pegadas minúsculas... e um cheirinho de óleo de engrenagem.'),
    { who: 'tico', expr: 'confused', text: 'Um ratinho de corda medroso. Será que ele vai ficar bem sozinho?' },
  ],

  // ------------------------------------------------------- placas — w1_4
  w1_sign_roots: [
    ...placa('Raízes Sussurrantes. Fale baixo: as raízes guardam tudo o que ouvem.'),
    { who: 'tico', expr: 'scared', text: 'Que escuro... Tudo bem. Minhas costuras brilham um pouquinho. Eu acho.' },
  ],
  w1_sign_bear: placa('Ursinhos corrompidos investem sem frear. Desvie e deixe que batam na parede!'),
  w1_sign_whisper: placa('"...lembra de mim...? ...alguém lembra...?", sussurram as raízes.'),
  w1_sign_key: placa('Algo brilha lá embaixo, entre as raízes mais fundas...'),
  w1_sign_seam: [
    ...placa('Uma parede costurada com fio escuro. Hoje ela não abre.'),
    { who: 'tico', expr: 'confused', text: 'Se dá pra costurar, deve dar pra descosturar. Volto aqui um dia!' },
  ],

  // ------------------------------------------------------- placas — w1_5
  w1_sign_fog: placa('Névoa do Coelho. Volte enquanto pode. (Alguém riscou embaixo: "NÃO VOLTE. AJUDE ELE.")'),
  w1_sign_faceless1: [
    ...placa('Um ursinho pendurado num galho. No lugar do rosto, só pano liso.'),
    { who: 'tico', expr: 'scared', text: 'Ele... não tem rosto. Quem faria isso com um brinquedo?' },
  ],
  w1_sign_faceless2: placa('Bonecas sem rosto balançam sem vento. Uma ainda segura um bilhete: "Davi".'),
  w1_sign_faceless3: [
    ...placa('Dezenas de brinquedos sem rosto, todos virados para o mesmo lado: a toca do Coelho.'),
    { who: 'tico', expr: 'determined', text: 'Tá bom. Coragem, Tico. Coragem de pelúcia, nível máximo.' },
  ],
  w1_sign_anchors: placa('Ilhós na névoa. Costure, atravesse e não olhe para baixo.'),
  w1_sign_gate2: placa('Portão de espinhos. Lá no alto da árvore, um ilhó pisca... será que estão ligados?'),
  w1_sign_memory: [
    { who: 'tico', expr: 'surprised', text: 'Esse brilho quentinho... parece cheiro de colo de vó.' },
  ],

  // ------------------------------------------------------ placas — bônus
  w1_sign_bonus: placa('Desafio do Carretel! Molas, ilhós e espinhos. No fim, um fio antigo espera os teimosos.'),
  w1_sign_spring: placa('Botões-mola: pise neles para subir alto. Ajuste a queda com a direção.'),
});
