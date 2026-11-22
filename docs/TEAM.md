# STITCHED WORLDS — Equipe, ondas e donos de arquivos

**Cada arquivo tem um único dono.** Edite apenas os seus. Precisa de algo de outro módulo? Use o contrato documentado em
`docs/ARCHITECTURE.md`; se faltar algo, contorne no seu arquivo e relate no relatório final.
Prefixo de screenshots: `.shots/<id-do-agente>_*.png`.

## Líder (núcleo) — `src/engine/*`, `src/main.js`, `src/content.js`, `src/game/{registry,legend,stats,worlds}.js`,
`src/game/player/player.js`, `src/game/scenes/{level_scene,boot}.js`, `src/game/enemies/base.js`, `tools/*`, `docs/*`.

## Onda 1 — Arte, áudio, sistemas, mecânicas, inimigos
| Agente | Arquivo(s) | Entrega |
|---|---|---|
| A01 Tico | `art/tico.js` | Spritesheet completo do Tico (todas as animações de player.js, squash & stretch, antecipação) + `meta` de âncoras (head, neck, back) |
| A02 Retratos | `art/portraits.js` | `registerPortrait` de todos os personagens (Tico com 9 expressões; NPCs e chefes) p/ diálogos |
| A03 Cosméticos | `art/cosmetics.js` | `drawCosmetics()` + `registerCosmetic` (chapéus, laços, mochilas, cores de linha, acessórios) |
| A04 UI Kit | `art/ui_kit.js` | Ícones (`icon_*`), molduras/painéis 9-slice costurados, botões, logo "STITCHED WORLDS", cursor/seta; helpers `drawPanel(ctx,x,y,w,h,style)`, `drawButton`, `drawLogo` exportados |
| A05 VFX | `art/vfx.js` | Presets de partículas por mundo (`w1_fireflies w2_bubbles w3_sparks w4_dust w5_threads`, etc.) + efeitos utilitários exportados (`spawnShockwave`, `drawThreadLine`, etc.) |
| A06–A10 Tiles | `art/tiles_w1.js` … `tiles_w5.js` | `registerTileset('wN', {...})` com autotile, variações, espinhos, plataformas, fundo, água (W2), decoração estática e animada |
| A11–A15 Fundos | `art/bg_w1.js` … `bg_w5.js` | `registerBackground('wN', {sky, layers:[...parallax], front:[névoa]})` |
| A16 SFX | `audio/sfx.js` | Todos os efeitos sonoros (lista em ARCHITECTURE/TEAM) |
| A17–A21 Música | `audio/music_w1.js` … `music_w5.js` | `wN_level`, `wN_calm` (+ `w4_chase`) |
| A22 Música chefes | `audio/music_bosses.js` | `boss_rabbit boss_whale boss_king boss_shadow boss_tailor boss_tailor_final` |
| A23 Música história | `audio/music_story.js` | `title worldmap opening memory revelation ending credits shop jingle_clear jingle_death jingle_item jingle_star` |
| A24 Costura | `abilities/stitch.js` | habilidade `stitch` + entidades `anchor`, `thread_bridge` |
| A25 Descosturar | `abilities/unstitch.js` | habilidade `unstitch` + `seam_wall`, `seam_barrier` |
| A26 Remendo | `abilities/rewind.js` | habilidade `rewind` + `crumble`, `rewind_bridge`, `boulder` + infraestrutura de histórico |
| A27 Retalho | `abilities/decoy.js` | habilidade `decoy` + entidade `decoy` |
| A28 Forma Desfiada | `abilities/unravel.js` | habilidade `unravel` + `thread_barrier`, `unravel_orb` |
| A29 Objetos | `objects/core.js`, `objects/interactive.js` | todos os objetos globais da legenda (exceto os das habilidades, `npc`, `shop`) |
| A30 Diálogos UI | `ui/dialogue.js` | Balões em pixel art, retratos, letra por letra, blips, escolhas, acelerar |
| A31 Diretor | `cutscenes/director.js` | `runCutscene` + API `cs` completa + cena `cutscene` (standalone com palcos) |
| A32 HUD | `ui/hud.js` | HUD completa |
| A33 Título | `scenes/title.js` | Título animado + menu + `settings` + `credits` |
| A34 Menus de jogo | `scenes/menus_basic.js` | `pause`, `death`, `victory` (resultados/estrelas), `loading` |
| A35 Mapa | `scenes/worldmap.js` | `worldmap` (mapa dos mundos, seleção de fase/mundo, bônus) |
| A36 Progressão | `scenes/menus_progress.js`, `progression.js` | `inventory`, `skilltree`, `shop`, `memories` (livro), `wardrobe`; registra skills/itens |
| A37 Toque | `ui/touch.js` | Controles de toque multitoque (overlay), layout adaptável |
| A38 Android | `android/**` (inclui `android/build_apk.sh`), `release/` | Projeto Android (WebView) + script que gera o APK assinado |
| A39 Personagens | `story/characters.js` | Sprites dos NPCs no mundo + entidades `npc` e `shop` |
| A40 Memórias | `story/memories.js` | `registerMemory` mem_1..mem_10 com cenas animadas desenhadas |
| A41–A44 Mecânicas | `mechanics/w2_water.js` `w3_time.js` `w4_dark.js` `w5_dimension.js` | objetos/mecânicas do mundo (legendas `j l m p q s u v w x y z 1-9`) |
| A45–A49 Inimigos | `enemies/w1.js` … `w5.js` | 4+ inimigos por mundo (legendas `a b d f g k`) |

## Onda 2 — Chefes, fases, história, cutscenes
| Agente | Arquivo(s) | Entrega |
|---|---|---|
| B01–B05 Chefes | `bosses/rabbit.js whale.js king.js shadow_mother.js tailor.js` | chefe + arena `wN_6` + cutscenes `bossN_intro`/`bossN_defeat` |
| B06–B20 Fases | `levels/wN_a.js` (fases 1–2), `wN_b.js` (3–4), `wN_c.js` (5 + bonus) | fases completas |
| B21–B25 Diálogos | `story/dialogues_w1.js` … `w5.js` | todas as falas listadas em STORY.md |
| B26 Abertura | `cutscenes/opening.js` | `opening`, `arrival` |
| B27 Intros | `cutscenes/world_intros.js` | `world1_intro`…`world5_intro`, `ability_*`, `w4_revelation` |
| B28 Final | `cutscenes/ending.js` | `ending_choice`, `ending_mend`, `ending_cut`, créditos |

## Onda 3 — QA, balanceamento, polimento, APK final

## Nomes de SFX que o jogo usa (A16 implementa todos)
ui_denied ui_switch ui_move ui_select ui_back ui_open ui_close text_blip text_blip_low · jump double_jump land step skid dash swim
splash_in splash_out whip whip_big hit needle charge_ready hurt death stomp · coin star heal energy checkpoint exit spring secret
secret_soft chest_open gate_open lever plate_down plate_up break_block crumble · bind armor_clink unstitch_hit enemy_die · stitch_cast
stitch_connect thread_snap unstitch_cast rewind_cast decoy_cast decoy_swap unravel_start unravel_end unravel_blast · boss_roar boss_hit
explosion portal bubble current clock_tick clock_chime shadow_whisper heartbeat thunder glass_crack page_turn
(Sons muito específicos podem ser registrados no próprio módulo com prefixo, ex.: `registerSfx('rabbit_thump', ...)`.)
