# STITCHED WORLDS — Bíblia da História (fonte única da verdade narrativa)

Tom: fofo, engraçado, misterioso e, às vezes, assustador. Emoção sincera sem pieguice. Diálogos curtos (≤ 110 caracteres por fala),
com personalidade. Português do Brasil. Revelações distribuídas aos poucos — **nunca explique tudo de uma vez**.

## Personagens
- **Tico** — dinossauro de pelúcia azul-turquesa (protagonista). Curioso, corajoso por teimosia, medroso às vezes, engraçado sem
  querer ("Eu tenho DENTES? ...Ah, não. São costuras."). Ama a Lia acima de tudo. Pergunta-chave da jornada: *"Eu sou só um
  brinquedo? Ou algo muito maior do que isso?"*
- **Lia** — a criança (7 anos), dona do Tico. Dorme abraçada com ele toda noite. Tem medo do escuro desde que a avó morreu.
- **Vó Celeste** — avó costureira da Lia (faleceu há um ano). Costurou o Tico com retalhos do cobertor de bebê da Lia e a
  **linha dourada de um carretel antigo** que guardou a vida toda. Aparece só em memórias.
- **O Costureiro** — criatura antiga, alta, feita de retalhos escuros, olhos de botão desparelhados, dedos-agulha compridos, um
  rasgo no peito de onde vaza fio roxo. Fala pouco e em frases quebradas. **Segredo (só revelado no Mundo 5):** ele é **Fiapo**,
  o boneco de pano da Vó Celeste quando ela era criança, perdido numa tempestade em 1968. Caiu no Avesso, esperou décadas
  acreditando ter sido esquecido, e a solidão o transformou. Quer rasgar a costura entre os mundos para que o Avesso engula o mundo
  real — "assim ninguém nunca mais será esquecido". Precisava do Tico porque a linha dourada do Tico vem do MESMO carretel que
  costurou o próprio Fiapo: é a única linha capaz de costurar e descosturar a fronteira.
- **O Avesso** — a dimensão dos brinquedos perdidos e esquecidos, o "lado de dentro" do tecido do mundo. Cinco regiões. Cada
  região tem um **Guardião** (chefe) que, sem saber, é um **nó** que mantém a costura fechada. Ao derrotar cada guardião, Tico
  desata um nó — e é exatamente isso que o Costureiro queria (revelação no Mundo 4).
- **As Tecelãs** — seres antigos que teceram a fronteira entre os sonhos e a vigília com fios feitos das primeiras canções de
  ninar. Sumiram. O "fio antigo" é delas. Aparecem como ecos/estátuas no Mundo 5.

### NPCs (ids de retrato entre parênteses)
| NPC | Onde | Personalidade / papel |
|---|---|---|
| **Sr. Botão** (`botao`) | W1 (fases 1, 2, 5) | Ursinho velho de um olho só (botão). Mentor rabugento e gentil. Explica o Avesso. Nota que as costuras do Tico brilham dourado: "fio antigo... como o das Tecelãs". |
| **Pip** (`pip`) | W1 (fases 3, 4) | Ratinho de corda medroso. Tem medo da energia do Tico; foge. Depois de ajudado (missão: achar sua chave de corda), vira amigo. |
| **Agulheta** (`agulheta`) | Todos os mundos (loja `U`) | Porco-espinho-almofada-de-alfinetes, comerciante tagarela e interesseira. Vende melhorias por botões dourados. Piadas recorrentes. |
| **Capitã Bolha** (`capita_bolha`) | W2 (fases 1, 3, 5) | Pata de borracha capitã de navio de brinquedo. Perdeu a tripulação (bonecos de banho) engolida pela Baleia. Missão: resgatar 3 marujos. |
| **Tique-Taque** (`tique_taque`) | W3 (fases 1, 2, 4) | Passarinho de relógio cuco preso num loop. Repete frases. Ajuda com dicas de tempo. Lembra dos registros da Torre. |
| **Luzinha** (`luzinha`) | W4 (todas) | Vagalume de pelúcia (luz noturna). Medrosa mas leal. Acompanha o Tico e ilumina o caminho. Quase se apaga no fim do W4. |
| **Eco da Tecelã** (`tecela`) | W5 (fases 1, 3, 5) | Voz calma, antiga. Revela a origem do fio e ensina a Forma Desfiada. |
| **Coelho Sem Rosto** (`coelho`) | Chefe W1 | Coelho enorme de pelúcia velha cujo rosto foi arrancado pelo Costureiro (ele "coleciona" rostos/lembranças). Depois de vencido, Tico costura botões no lugar dos olhos: ele lembra o nome de seu dono ("Davi...") e entrega uma memória. |
| **Baleia de Vidro** (`baleia`) | Chefe W2 | Baleia de vidro gigante (como um globo de neve) que engole coisas perdidas. Remendada à força pelo Costureiro com placas de tecido escuro. Libertada, revela: "Cada guardião é um nó... e você está desatando." (Tico não entende ainda.) |
| **Rei do Segundo Perdido** (`rei`) | Chefe W3 | Relógio de bolso coroado que se recusa a deixar o tempo passar (como uma criança que não quer crescer). Controla o tempo na luta. Derrotado, para de lutar e deixa o tempo andar: "Talvez crescer não seja esquecer." |
| **Mãe das Sombras** (`mae_sombras`) | Chefe W4 | Entidade gigantesca das sombras debaixo da cama. Assustadora — mas no fim revela que é o medo que mantém as crianças sob as cobertas... e o Costureiro longe delas. "Agora, nada mais o segura." |
| **Lia, Vó Celeste** (`lia`, `vo_celeste`) | Memórias e final | — |
| **Narrador** (`narrador`) | Cutscenes | Texto de livro de histórias, sem retrato. |

## Arco por mundo (batidas obrigatórias)
**Abertura (cutscene `opening`)** — Noite de tempestade. Lia dorme abraçada ao Tico. Relâmpago. Tico escorrega e cai no chão.
Silêncio. Um pequeno rasgo escuro se abre no ar, costurado por dentro. Dedos-agulha saem. O Costureiro examina o brinquedo:
"Fio... antigo. Finalmente." Fios roxos entram nas costuras do Tico. Os olhos dele se abrem. Algo está errado (olhos piscam roxo).
O Costureiro abre um portal enorme e o joga lá dentro. Lia murmura dormindo: "Tico...?" e tateia o espaço vazio.
**Chegada (cutscene `arrival`)** — Tico cai por um túnel de fios e aterrissa na Floresta. "Eu... estou me mexendo?!" Comédia:
tenta andar, cai de cara. Começa o tutorial (fase w1_1).

**Mundo 1 — Floresta dos Brinquedos Perdidos** (brinquedos de crianças que cresceram).
- w1_1: tutorial; encontra **Sr. Botão** (`w1_botao_1`): "Bem-vindo ao Avesso, onde vêm parar as coisas esquecidas."
- w1_2: altar → **Costura Dimensional** (cutscene `ability_stitch`). Botão: "Essas costuras brilham... fio antigo." (`w1_botao_2`)
- w1_3/w1_4: **Pip** foge do Tico (`w1_pip_1`), depois pede ajuda (missão `pip_key`: chave de corda escondida na w1_4) (`w1_pip_2`, `w1_pip_3`).
- w1_5: Botão avisa do Coelho (`w1_botao_3`); pistas ambientais: brinquedos sem rosto pendurados nas árvores.
- w1_6 (chefe): **O Coelho Sem Rosto** — perseguição + arena. Após vencer, Tico costura o rosto dele → memória `mem_2`.
- Memórias: `mem_1` (escondida no W1), `mem_2` (chefe).

**Mundo 2 — Oceano das Lágrimas** (água das lágrimas de crianças que perderam brinquedos).
- w2_1: Tico descobre que pode **Descosturar** ao se enroscar numa rede costurada (cutscene `ability_unstitch`). **Capitã Bolha** (`w2_bolha_1`).
- w2_3/w2_5: Bolha e a missão dos marujos (`w2_bolha_2`, `w2_bolha_3`); garrafas com mensagens de crianças ("Devolve meu patinho").
- w2_6 (chefe): **A Baleia de Vidro**. Libertada: "Cada guardião é um nó... e você está desatando." → `mem_4`.
- Memórias: `mem_3` (escondida), `mem_4` (chefe).

**Mundo 3 — Cidade dos Relógios Quebrados** (o tempo parado no instante em que cada brinquedo se perdeu).
- w3_1: relógio-altar → **Remendo Temporal** (cutscene `ability_rewind`). **Tique-Taque** em loop (`w3_tique_1`).
- w3_2/w3_4: Tique-Taque mostra a **Torre dos Registros** (`w3_tique_2`, `w3_tique_3`): uma ficha diz "FIAPO — perdido na tempestade
  de 1968". Tico estranha: "1968? Isso é... muito tempo." (pista; ninguém sabe quem é Fiapo ainda).
- w3_6 (chefe): **O Rei do Segundo Perdido**. "Talvez crescer não seja esquecer." → `mem_6`.
- Memórias: `mem_5` (escondida), `mem_6` (chefe).

**Mundo 4 — O Pesadelo Debaixo da Cama** (medos infantis; furtividade e escuridão).
- w4_1: **Luzinha** se junta (`w4_luzinha_1`). Altar sombrio → **Retalho Fantasma** (cutscene `ability_decoy`).
- w4_3: **Revelação**: a voz do Costureiro nas sombras (cutscene `w4_revelation`): "Você está fazendo exatamente o que eu queria.
  Cada nó que você desata me aproxima de casa." Tico entende que os guardiões eram nós. Crise: "Eu sou um brinquedo? Ou algo muito
  maior do que isso?" Luzinha o anima (`w4_luzinha_2`).
- w4_5: Luzinha quase se apaga protegendo o Tico (`w4_luzinha_3`) — momento emocionante; ela se recupera com a luz do Tico.
- w4_6 (chefe): **A Mãe das Sombras**. "Eu sou o medo que mantém as crianças debaixo das cobertas... e ele, longe delas." → `mem_8`.
- Memórias: `mem_7` (escondida), `mem_8` (chefe).

**Mundo 5 — O Coração da Dimensão** (origem do Costureiro; ruínas dos mundos anteriores, fios gigantes, portais).
- w5_1: **Tear das Tecelãs** → **Forma Desfiada** (cutscene `ability_unravel`). Eco da Tecelã (`w5_tecela_1`): o fio do Tico foi fiado
  com a primeira canção de ninar do mundo; "um fio feito de amor não pertence a ninguém — nem a quem o roubou".
- w5_3/w5_5: ruínas com bonecos de pano idênticos ao Costureiro, mas pequenos e fofos (pista: ele já foi um boneco). Eco (`w5_tecela_2`,
  `w5_tecela_3`).
- w5_6 (chefe final): **O Costureiro**, várias fases, cenário se transformando nos mundos anteriores, uso obrigatório de todas as
  habilidades e da Forma Desfiada. **Revelação**: o Tico vê a memória da Vó criança perdendo o Fiapo na tempestade — o Costureiro É
  o Fiapo. A linha do Tico veio do carretel da Celeste, o mesmo que costurou o Fiapo.
- **Escolha final** (cutscene `ending_choice`): **"Cortar o fio"** ou **"Costurar o coração"**.
  - *Costurar o coração* (final verdadeiro, `ending_mend`): Tico usa sua linha para costurar o rasgo no peito do Fiapo e mostra a
    memória: Celeste velhinha, costurando o Tico, dizendo baixinho "Eu nunca te esqueci, Fiapo." O Costureiro chora fios, encolhe e
    vira um bonequinho de pano. A costura entre os mundos se fecha; os dois caem no quarto da Lia. Manhã: Lia acorda abraçada ao Tico;
    aos pés da cama, um boneco de pano antigo. A mãe, da porta: "Esse... era o boneco da sua avó. Onde você achou?" Lia abraça os dois.
    Tico pisca. Pós-créditos: as costuras do Tico brilham dourado no escuro.
  - *Cortar o fio* (`ending_cut`): Tico corta o fio; o Costureiro se desfaz em pó sussurrando "...Celeste..."; a costura se fecha
    com violência; Tico cai em casa, mas suas costuras douradas ficaram cinzentas — ele é só um brinquedo de novo. Lia o encontra no
    chão: "Você caiu, Tico? Eu te protejo." Um único fio dourado flutua janela afora. Agridoce.

## Memórias da criança (`registerMemory(id, { title, world, text, scene? })`)
| id | título | conteúdo (cena curta animada no Livro de Memórias) |
|---|---|---|
| `mem_1` | O Primeiro Abraço | Vó Celeste termina de costurar o Tico e o entrega à Lia bebê. |
| `mem_2` | O Rugido | Lia ensinando o Tico a "rugir" — "RAWR!" — e rindo. |
| `mem_3` | Hora do Banho | Lia, Tico e um patinho de borracha na banheira cheia de espuma. |
| `mem_4` | O Dia Cinza | Lia de vestido escuro, abraçada ao Tico, no dia em que a vó partiu. |
| `mem_5` | A História do Fiapo | Vó contando: "Quando eu era menina, perdi meu boneco Fiapo numa tempestade. Nunca o esqueci." |
| `mem_6` | O Carretel Dourado | Vó costurando o Tico com "a linha dourada do carretel antigo". |
| `mem_7` | Medo do Escuro | Lia com medo do escuro; vó: "Ele vai te proteger. Tem um fio mágico nele." |
| `mem_8` | A Cama Vazia | (presente) Lia acordando na tempestade, procurando o Tico debaixo da cama, chorando. |
| `mem_9` | Desenho na Geladeira | Desenho da Lia: ela, a vó e o Tico de mãos dadas. (escondida no W5) |
| `mem_10` | Canção de Ninar | Vó cantando para a Lia e o Tico dormirem. (bônus W5 / final) |

## IDs de diálogo (escreva todos em `src/game/story/dialogues_wN.js`)
Use estes ids nos mapas (`props: { 'x,y': { npc: 'botao', dialog: 'w1_botao_1' } }`). Cada NPC pode ter falas extras
`<id>_repeat` (ao falar de novo). Placas: `w<N>_sign_<tema>` livres para os designers de fase (registradas no arquivo de diálogos do mundo
pelo próprio designer em seu arquivo de fase, via `registerDialogue`).
W1: `w1_botao_1 w1_botao_2 w1_botao_3 w1_pip_1 w1_pip_2 w1_pip_3 w1_agulheta`
W2: `w2_bolha_1 w2_bolha_2 w2_bolha_3 w2_agulheta w2_bottle_1 w2_bottle_2 w2_bottle_3`
W3: `w3_tique_1 w3_tique_2 w3_tique_3 w3_agulheta w3_registry`
W4: `w4_luzinha_1 w4_luzinha_2 w4_luzinha_3 w4_agulheta w4_whisper_1 w4_whisper_2`
W5: `w5_tecela_1 w5_tecela_2 w5_tecela_3 w5_agulheta w5_ruins_1 w5_ruins_2`
