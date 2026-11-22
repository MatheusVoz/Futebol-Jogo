# STITCHED WORLDS — Arquitetura e Contratos (LEIA INTEIRO ANTES DE CODAR)

Jogo de plataforma 2D em pixel art, **JavaScript (ES modules) + Canvas 2D + WebAudio**, 100% procedural
(nenhum arquivo de imagem/som: toda arte é desenhada por código e cacheada; toda música/sfx é sintetizada).
Empacotado em **um único APK** Android (WebView carregando `dist/`). Funciona offline.

- Código-fonte: `src/` (módulos ES). Entrada: `src/main.js`. Todos os módulos de conteúdo são importados por `src/content.js`.
- **Regra de ouro: cada arquivo tem UM dono** (veja `docs/TEAM.md`). Só edite seus arquivos. Se precisar de algo
  em arquivo alheio, contorne (subclasse, wrapper, hook) e relate no relatório final.
- Nada de bibliotecas externas, nada de `fetch`, nada de imagens/áudio externos, nada de emojis como sprites.
- Textos do jogo em **português do Brasil**, com acentos (a fonte suporta á à â ã é ê í ó ô õ ú ç e maiúsculas acentuadas).
- Resolução lógica ~ **400–560 × 200–260 px** (`game.view.w/h`, variável conforme a tela), escala inteira.
  Tile = **16 px**. Desenhe tudo em coordenadas inteiras (`Math.round`).

## Testar
```
node tools/shot.mjs --q "level=w1_1" --out .shots/minha.png            # screenshot (veja com a ferramenta Read)
node tools/shot.mjs --q "level=w1_1&god=1&unlock=all" --steps "right:60,right+jump:20" --eval "__SW.level.player.x"
node tools/shot.mjs --q "scene=title" --out .shots/t.png
node tools/shot.mjs --q "cutscene=opening" --wait 4000 --out .shots/c.png
node tools/build.mjs                                                     # bundle (verifica erros de import/sintaxe)
node tools/validate_levels.mjs [w1_1 ...]                                # valida mapas (quando existir)
```
`--steps` pausa o loop em tempo real e simula quadros a 60 Hz com entradas virtuais (`right`, `left`, `up`,
`down`, `jump`, `attack`, `dash`, `ability`, `cycle`, `interact`, `pause`, `confirm`, `back`), ex.: `right+jump:20`.
`--eval` roda JS na página (use `window.__SW`: `game, save, R, level, scene, goLevel(id), step(n), press([...], n), errors`).
Salve screenshots em `.shots/<seu-prefixo>_*.png` (pasta ignorada pelo git). **Sempre olhe os screenshots** e
corrija o que estiver feio/quebrado. A saída do shot.mjs lista erros do console — zere-os.
Parâmetros úteis: `god=1` (invencível), `unlock=all` (todas as habilidades/mundos, 999 botões), `debug=1` (fps/estado),
`fresh=1` (apaga o save), `intro=1` (toca a intro da fase).

## Motor (`src/engine/`) — não editar (dono: líder)
| Módulo | Uso |
|---|---|
| `util.js` | `TILE=16`, `clamp, lerp, approach, damp, rand, randInt, pick, chance, makeRng(seed)` (rng.int/range/pick/chance), `hash2`, `Ease.*`, `mixColor/darken/lighten/withAlpha`, `Timer`, `Emitter`, `TaskRunner` (corrotinas: `yield 0.5` espera segundos, `yield () => cond`, `yield* outroGerador`) |
| `pixel.js` | `PixelCanvas(w,h)`: `px, rect, strokeRect, hline, vline, line, thickLine, ellipse, circle, ellipseOutline, ring, poly, tri, curve, dither, vgradient, ditherFn, ascii(rows,palette,x,y), outline(color,{diagonal,inside}), replaceColor, mapPixels, blit, translate, flush()`. Cores `'#rgb' '#rrggbb' '#rrggbbaa'` (alpha mistura). `paint(w,h,fn)` → canvas. |
| `sprites.js` | `defineSprite(name,{w,h,ox,oy,anims:{a:{frames,fps,loop}},draw(pc,anim,frame,n),meta?})`, `drawSprite(ctx,name,anim,frame,x,y,{flip,alpha,variant:'flash'|'ghost'|'dark'|'#hex',scaleX,scaleY,rotation})` (x,y = pivô), `animFrame(name,anim,t)`, `animDone`, `animDuration`, `frameMeta`, `defineImage(name,w,h,fn)`, `getImage`, `drawImage(ctx,name,x,y,{flip,alpha})` |
| `font.js` | `font.draw(ctx,text,x,y,{color,align,shadow,outline,maxWidth,lineHeight,maxChars,scale})`, `font.measure`, `font.wrap`, `font.visibleLength`. Marcação: `{#ffcc33}amarelo{/}`, ícone `{i:nome_imagem}`. Capitular 7 px, linha 10 px. Chars extras: `… ♥ ★ • → ← ↑ ↓` |
| `input.js` | `input.down/pressed/released/consume(action)`, `axisX/axisY`, `pointer{x,y,down,pressed,released}` (coords lógicas), `setVirtual(action,bool)` (toque), `lastDevice` |
| `audio.js` | `registerSfx(name, layer|layers|fn)`, `registerSong(name, song)`, `audio.sfx(name,{vol,pitch,randomPitch,pan,cooldown})`, `audio.playMusic(name,{fade})`, `stopMusic`, `duck/unduck`, `setVolume('music'|'sfx'|'master',v)`, `renderSongOffline(name,s)` (testes) |
| `camera.js` | `Camera`: `follow, setBounds, lockTo(rect), unlock, shake(trauma), panTo(x,y,dur), release(), zoom/targetZoom, centerOn, visible()` |
| `tilemap.js` | `T.{EMPTY,SOLID,ALT,ONEWAY,SPIKE,WATER,FAKE,BG}`, `Tilemap.get/set/at/solidAt/rectHas/rectSolid/raycast/los`, `moveBody(body,dx,dy,world,{dropThrough})` |
| `entity.js` | `Entity` base (veja abaixo) |
| `particles.js` | `registerParticle(name, def)`, `level.particles.emit(name,x,y,count,overrides)`. Presets: `dust land sparkle hit fluff fabric thread bubble smoke heal energy splash ember shadow portal` |
| `lighting.js` | `level.addLight(x,y,r,color,intensity,flicker)` ou `entity.light={r,color,i,flicker}`; `level.data.darkness` 0..1 |
| `scene.js` | `Scene` (`enter(params) exit() resume() update(dt) draw(ctx) resize(w,h)`, getters `overlay`, `blocksUpdate`), `game.scenes.push/pop/replace/go(scene,params,{transition:'fade'|'stitch'|'iris'|'none'})/cover(fn)` |
| `save.js` | `save.data` (progresso — veja `defaultSave()`), `save.settings`, `commit()`, `commitSettings()`, `newGame()`, `hasGame()`, helpers `isCollected/markCollected/flag/setFlag/seen/markSeen/hasAbility/unlockAbility/hasSkill/levelRecord/isWorldUnlocked/unlockWorld` |
| `game.js` | `game.view{w,h,scale}`, `game.scenes`, `game.events` (Emitter), `game.time`, `game.timeScale`, `game.addOverlay(fn(ctx))`, `game.vibrate(ms)`, `game.params` |

## Camada de jogo (`src/game/`)
- `registry.js`: **`R`** + `registerEntity(type, Class)`, `registerLevel`, `registerTileset`, `registerBackground`,
  `registerCutscene(id, {stage?, music?, run: function*(cs){}})`, `registerDialogue(id, lines)`, `registerDialogues({...})`,
  `registerLegend(world,{char:type})`, `registerMemory`, `registerAbility`, `registerPortrait`, `registerSkill`,
  `registerShopItem`, `registerCosmetic`, `registerScene(name, Class)`, `makeScene(name, ...args)`, `registerQuest`.
- `worlds.js`: `WORLDS`, fases `wN_1..wN_6` (6 = chefe) + `wN_bonus`. `nextLevelId(id)`.
- `legend.js`: caracteres globais dos mapas. `stats.js`: `getStats()` (atributos derivados de skills/loja).
- `player/player.js`: Tico (dono: líder). `scenes/level_scene.js`: cena de fase (dono: líder). `enemies/base.js`: `Enemy`, `EnemyProjectile` (dono: líder).

### Entity (base) — `src/engine/entity.js`
`constructor(level, x, y, props)` — **x,y = canto superior esquerdo da CÉLULA do mapa** (px). Ajuste `w,h,x,y` no constructor
(ex.: `this.alignToCell(x,y)` assenta no chão da célula). Campos: `x y w h vx vy facing z hp maxHp flash invuln t dead props tags`.
Métodos: `init() update(dt) lateUpdate?(dt) draw(ctx) onRemove() remove() physics(dt,{noGravity}) hurt(n,src,opts) die(src)
tickTimers(dt) groundAhead() wallAhead() playerNear(dx,dy) overlaps(o) distTo(o)`; getters `cx cy left right top bottom player`.
Flags: `solid` (bloqueia tudo), `oneway` (só por cima), `enemy` (dano por contato `contactDamage`), `hazard`, `hittable`
(recebe ataques: `onHit(dmg, src, {kind})` ou `hurt`), `stompable` (`onStomp(player)`), `interactable` + `interact(player)` +
`prompt:'Falar'`, `isSecret`, `isButton`, `alwaysUpdate`, `alwaysDraw`, `light`, `waterVolume`, `boss`.
`draw(ctx)`: ctx já está em coordenadas de MUNDO (câmera aplicada). Ordem por `z` (jogador = 50).
Entidades atualizam só perto da câmera (`activeRange`, padrão 260 px) a menos que `alwaysUpdate`.
Plataformas móveis: mova `x/y` e carregue quem estiver em cima (`player.groundEntity === this` → some o deslocamento ao jogador).

### Enemy (base) — `src/game/enemies/base.js`
`class X extends Enemy { constructor(...){ super(...); this.w=..; this.h=..; this.hp=this.maxHp=..; } think(dt){ IA } draw(ctx){ ...; this.drawStatus(ctx); } }`
Já trata: morte animada + drops (`this.drops={buttons, heart, energy}`), **preso por fio** (`boundT`, `bind(s)`), atordoado (`stunT`),
**armadura** (`armored=true` bloqueia ataques; `unstitch()` remove), alvo com **Retalho Fantasma** (`this.target()`),
`canSee(t,range)`, `patrol(speed,dt)`, `faceTarget()`, `moveToward()`, `spriteOpts()` (flip/flash/fade de morte; defina
`spriteFacesRight=true` se seu sprite olha à direita). Inimigo voador: `this.flying=true` (não chame `physics` com gravidade).
`EnemyProjectile(level, x, y, {vx,vy,gravity,life,damage,color,w,h,reflectable})` — `reflect()` (Remendo Temporal) o devolve.
**Chefes**: `this.boss = true; this.bossName = 'O Coelho Sem Rosto'; level.boss = this;` → a HUD mostra a barra (`hp/maxHp`). Ao morrer:
`level.boss = null`.

### LevelScene (`this.level`)
`map player camera particles lighting tasks entities solids data run hud dialogue decoy boss inputLocked timer`
`add(e) spawn(type,x,y,props) query(rect,filter) byTag(tag) ofType(type) find(fn) findById(props.id) platformAt(px,py)`
`signal(name,value) onSignal(name,fn) signals[name]` — fiação de puzzles (alavanca → portão).
`shake(a) hitstop(s) flash(color,s) toast(text,icon) addLight(...)` · `say(lines|dialogId) → Promise` · `cutscene(id,params) → Promise`
`lockInput()/unlockInput()` · `setCheckpoint(x,y,id)` · `foundSecret(id)` · `collect(kind,n,pid,{index,id})` · `complete({delay,music})`
`fadeTeleport(ent,x,y)` · `respawn()` · `restart()` · `exitToMap()` · `pauseGame()` · `computeResults()`.
Dados da fase podem ter hooks `onStart(level)`, `onUpdate(level,dt)`, `drawOverlay(ctx,level)` (tela).

### Player (`level.player`)
Estados: `normal dash hurt dead frozen celebrate`. Use `player.state='frozen'` + `player.cutsceneAnim='scared'` em cutscenes.
`hp maxHp energy maxEnergy spendEnergy(n)→bool gainEnergy(n) heal(n) hurt(n,src,{respawn,noKnock,force}) addForce(fx,fy)
facing grounded inWater oxygen mods{speed,damage,gravity,invulnerable,phase,trail,trailColor,airPlatform} unravelMeter(0..1)
castT (mostra anim 'cast' por N s) setCooldown(id,s) cooldownOf(id) lastSafe interactTarget hidden(bool, mundo 4)`.
Física (px/s): andar 92, correr 150 (após 0.55 s segurando), pulo 372 (altura máx ≈ 68 px ≈ **4 tiles**; toque curto ≈ 1.5 tiles),
pulo duplo 330 (+≈ 3 tiles), gravidade 1000/1380, queda máx 340, dash 300 por 0.16 s (≈ 3 tiles; 1 no ar), coyote 0.1 s,
buffer 0.13 s. **Vão horizontal seguro: 3 tiles andando, 5 correndo, 7 com dash no ar, 8+ com pulo duplo+dash.** Hitbox 12×18.
Ataque: chicote de fio (combo 3 golpes, alcance ~26 px), ataque p/ cima (↑+ataque), p/ baixo no ar (↓+ataque, quica em inimigos),
segurar ataque 0.5 s = **Agulhada** (projétil, 15 energia). Pular em cima de inimigos `stompable` causa dano e quica.

## Habilidades — `registerAbility(id, def)` (ids: `stitch unstitch rewind decoy unravel`)
```
registerAbility('stitch', {
  name: 'Costura Dimensional', icon: 'icon_ab_stitch', cost: 20, cooldown: 0.5, color: '#ffd23f',
  desc: '...', onPress(player, level){}, onHold(player, level, dt){}, onRelease(player, level){},
  update(player, dt){}, draw(ctx, player){}, drawBehind(ctx, player){}, onUnequip(player, level){}
});
```
Use `player.spendEnergy(cost)`, `player.setCooldown(id, s)`, `player.castT = 0.3`, `audio.sfx(...)`, partículas.
Duração afetada por `getStats().duration` (multiplicador). Desbloqueio: `save.data.abilities[id] = true` (altar `ability_shrine`).
Contratos entre sistemas (TODOS devem respeitar):
- **Costura Dimensional (stitch)** — entidade `anchor` (`@`, ilhó dourado). Perto de um ilhó (≤ 3 tiles), usar a habilidade costura
  um FIO até o ilhó parceiro mais próximo (≤ 10 tiles, preferindo `props.group` igual) criando uma **ponte/corda de fio**
  caminhável (`thread_bridge`) por `6 s × duration`. Ilhós com `props.signal` emitem `level.signal(signal,true)` enquanto costurados
  (false ao expirar, salvo `props.latch`). Sem ilhó por perto: o fio laça o inimigo `bindable` mais próximo à frente (≤ 6 tiles)
  → `enemy.bind(3 × duration)`. Chefes expõem pontos de costura próprios (podem registrar entidades `anchor` com `props.boss`).
- **Descosturar a Realidade (unstitch)** — afeta entidades num raio de ~4 tiles que implementem `unstitch(player) → bool`:
  `seam_wall` (`S`, parede costurada: some por `props.time||6 s`, ou permanente com `props.permanent`), inimigos `armored`,
  armadilhas/barreiras mágicas, objetos com `hidden=true` (revela). Efeito: fios se soltando, fragmentos sumindo.
- **Remendo Temporal (rewind)** — entidades com `rewindable=true` + `captureState()`/`restoreState(s)` têm histórico de ~4 s gravado
  pela habilidade; ao usar (raio ~6 tiles) elas voltam ~3 s no tempo (plataformas `crumble` `C`, pontes que caem, pedregulhos, portas).
  Projéteis inimigos com `reflectable` no raio são **devolvidos** (`reflect()`). Custo alto + recarga (não desfaz tudo; não afeta
  o jogador nem inimigos).
- **Retalho Fantasma (decoy)** — cria cópia translúcida (`level.decoy`, entidade `decoy`) por `8 s × duration`; inimigos miram nela
  (`Enemy.target()`), ela pesa em `pressure_plate` (`D`). Usar de novo com a cópia ativa = **trocar de lugar** com ela.
- **Forma Desfiada (unravel)** — exige `player.unravelMeter >= 1` (enche batendo em inimigos/carretéis). 10 s: velocidade ×1.45,
  dano ×2.5, `player.mods.phase` (atravessa `thread_barrier` `Y` e inimigos comuns), pulo no ar cria plataforma instantânea
  (`mods.airPlatform`), ataque especial devastador ao apertar habilidade de novo. Visual: corpo desfiado com fios orbitando.

## Mapas das fases (ASCII) — `registerLevel({...})`
```
registerLevel({
  id: 'w1_1', world: 1, index: 1, name: 'Clareira dos Esquecidos', subtitle: 'Mundo 1-1',
  music: 'w1_level', tileset: 'w1', background: 'w1', parTime: 150,
  darkness: 0, ambient: 'w1_fireflies', oxygen: false, intro: 'w1_1_intro' /* cutscene opcional */,
  map: [ '....', ... ],                       // todas as linhas com o MESMO comprimento
  props: { '12,8': { dialog: 'w1_botao_1', npc: 'botao' } },   // props para a entidade na célula col,linha
  objects: [ { type: 'gate', x: 40, y: 9, signal: 'g1' } ],    // entidades extras (x,y em tiles)
  legend: { 'q': 'w1_special' },              // sobrescritas locais de caracteres
  onStart(level){}, onUpdate(level, dt){}
});
```
Tiles: `#` sólido · `%` sólido alternativo (pedra/tijolo) · `=` plataforma vazada · `^` espinhos · `~` água · `H` parede falsa
(segredo: parece sólida, é atravessável) · `:` parede de fundo · `.` vazio · `P` início do Tico.
Globais (entidades): `E` saída · `K` checkpoint · `o` botão · `O` botão grande · `*` estrela costurada (exatamente 3 por fase) ·
`M` memória (props.memory) · `r` retalho mágico · `T` fio antigo · `h` coração · `e` energia · `c` baú (props.contents) ·
`@` ilhó · `B` bloco quebrável · `S` parede costurada · `C` plataforma que desmorona · `X` gatilho de área secreta (invisível) ·
`n` NPC (props.npc + props.dialog) · `i` placa (props.text) · `J` mola · `G` portão (props.signal) · `L` alavanca (props.signal) ·
`D` placa de pressão (props.signal) · `Q` altar de habilidade (props.ability) · `U` loja · `F` plataforma móvel (props.dx, dy em
tiles, speed) · `Y` barreira de fios · `W` plataforma que cai.
Por mundo (registerLegend): **inimigos `a b d f g k`**, **mecânicas `j l m p q s u v w x y z 1-9`** (veja TEAM.md).
Borda esquerda/direita do mapa é parede; fundo do mapa é abismo (cair = 1 de dano e volta ao último chão seguro).
Altura típica 18–40 linhas, largura 160–320 colunas. Deixe 3+ linhas de céu acima do ponto mais alto jogável.

## Diálogos — `level.say(lines)` / `cs.say(lines)` / `registerDialogue(id, lines)`
```
[{ who: 'tico', expr: 'surprised', text: 'Eu... estou me mexendo?' },
 { who: 'botao', expr: 'neutral', text: 'Calma, pequeno. Você está no {#ffd23f}Avesso{/}.' },
 { who: 'tico', text: 'O que eu faço?', choices: ['Seguir', 'Ficar'] }]   // promise resolve com o índice
```
`who`: id de retrato registrado (`R.portraits`) — `tico lia vo_celeste costureiro botao pip agulheta capita_bolha tique_taque
luzinha fiapo coelho baleia rei mae_sombras tecela narrador placa`. `expr`: `neutral happy sad scared surprised confused
determined sleepy angry` (Tico tem todas; outros têm ao menos `neutral` e algumas). `at: entidade` opcional (balão ancorado
sobre quem fala). `speed`, `shake:true` (texto tremendo), `wait` (s).

## Cutscenes — `registerCutscene(id, { stage?, music?, run: function*(cs) { ... } })`
Rodam dentro da fase (`level.cutscene(id)`) ou como cena própria (`makeScene('cutscene', id, {next})`, para abertura/final/memórias,
com `stage` = função de cenário desenhado). API `cs` (use `yield*` nas que bloqueiam):
`wait(s) say(lines) choice(prompt, options)→cs.lastChoice pan(x,y,dur) panTo(ent,dur) zoom(z,dur) shake(a) flash(c,dur)
fadeOut(dur,color) fadeIn(dur) letterbox(on) music(name) sfx(name) caption(text,dur) title(text,sub) walk(ent,x,speed)
anim(ent,name) face(ent,dir) spawn(type,x,y,props) actor({sprite,anim,x,y,flip,alpha,z,draw?})→Actor move(actor,x,y,dur,ease)
fade(actor,alpha,dur) particles(name,x,y,n) parallel(...gens) setFlag(name) unlockAbility(id) player level stage time`.

## Áudio — formato de música (tracker)
```
registerSong('w1_level', {
  bpm: 96, stepsPerBeat: 4, swing: 0.1, reverb: 0.45, echoSteps: 3, echoFeedback: 0.3, loopFrom: 0, volume: 1,
  instruments: {
    lead: { wave:'pulse', duty:0.25, attack:0.01, decay:0.12, sustain:0.6, release:0.12, vol:0.18, vibrato:{rate:5,depth:0.15,delay:0.2}, echo:0.25, reverb:0.3, pan:-0.2, octave:0, filter:{type:'lowpass',freq:3000,q:1} },
    bass: { wave:'triangle', vol:0.3, release:0.05 },
    pad:  { wave:'saw', voices:3, spread:14, attack:0.4, release:0.8, vol:0.08, filter:{freq:1400} },
    bell: { wave:'fm', ratio:3.5, index:3, indexDecay:0.4, decay:0.6, sustain:0, vol:0.12 },
    drums:{ kit:'default', vol:0.5, reverb:0.1 }
  },
  patterns: {
    A: { lead: 'C5 - E5 - G5 - . . A5 - G5 - E5 - . .', bass: 'C3 . . . G2 . . . A2 . . . F2 . . .', drums: 'k . h . s . h . k k h . s . h o' },
  },
  order: ['A', 'A', 'B', 'A'],
});
```
Tokens (1 por passo de 1/16): nota `C4 D#4 Eb3`, acorde `C4+E4+G4`, `-` sustenta, `.` silêncio, sufixo `!` acento / `?` suave.
Bateria: `k` bumbo `s` caixa `x` palmas `h` chimbal `o` chimbal aberto `c` prato `t`/`T` tons `r` aro `p` tique (relógio) `b` estrondo.
Ondas: `square pulse(duty) triangle sawtooth/saw sine noise fm`. `voices/spread` (uníssono), `glide`, `gate` (0..1).
SFX: `registerSfx('jump', { wave:'square', freq:320, freqEnd:640, dur:0.12, vol:0.25 })` ou array de camadas ou `fn(ac,dest,t,opts)`.

## Arte — padrões
- Pixel art nítido, **contorno escuro de 1 px** (`pc.outline(cor)`), luz vinda de cima-esquerda, 3–4 tons por material, dithering
  com moderação. Sem anti-aliasing. Proporções fofas ("brinquedo de pelúcia que ganhou vida" — costuras visíveis, botões, retalhos).
- **Tico** (sprite `tico`, 32×32, pivô (16,31), olha p/ direita): corpo `#3fc7c0`, sombra `#2a9d97`, luz `#7fe6df`, espinhos
  `#ffd23f`/`#e0a020`, olho `#120a18`, manchas amarela `#ffd23f` laranja `#ff8a3c` azul `#4a7fe0`, contorno `#1b2a3a`.
  Cabeça grande e redonda, pescoço comprido, cauda levantada e arredondada, patinhas curtas, boca costurada pequena.
- Paletas por mundo: W1 verdes/marrons acolhedores + roxo da névoa e cogumelos luminosos; W2 azuis/turquesas + coral rosa;
  W3 latão/cobre/âmbar + céu violeta com relógios; W4 roxos/azuis muito escuros + amarelo de luz de abajur; W5 vermelho/magenta/roxo
  com fios dourados gigantes.
- Ícones de UI: defina com `defineImage('icon_...', w, h, fn)` (ui_kit.js). Nomes usados por todos: `icon_heart icon_heart_empty
  icon_energy icon_button icon_star icon_star_empty icon_patch icon_thread icon_memory icon_secret icon_ab_stitch icon_ab_unstitch
  icon_ab_rewind icon_ab_decoy icon_ab_unravel icon_lock icon_check`.

## Persistência
Tudo em `save.data` (veja `src/engine/save.js`). Coletáveis persistentes usam `props.pid` (gerado automaticamente por célula) →
`save.markCollected(pid)` e checagem `save.isCollected(pid)` no constructor (mostrar "fantasma" translúcido se já coletado, para
estrelas). Chame `save.commit()` após mudanças importantes (a LevelScene já salva ao completar fase/checkpoint).

## Qualidade (obrigatório)
- Zero erros no console. `node tools/build.mjs` deve passar. Teste no navegador com `tools/shot.mjs` e OLHE os screenshots.
- Sem colisões quebradas, inimigos presos, plataformas impossíveis, textos cortados ou fora da tela.
- Performance: nada de `getImageData` por quadro; pré-renderize em `defineSprite/defineImage/PixelCanvas`. Partículas com moderação.
- Código organizado, comentado em português (cabeçalho explicando o módulo), sem dependências externas.
