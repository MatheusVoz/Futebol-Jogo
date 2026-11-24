// =============================================================================
// content.js — Importa TODOS os módulos de conteúdo (cada um se auto-registra).
// Cada arquivo tem UM dono (veja docs/TEAM.md). Não reordene sem necessidade:
// arte e áudio primeiro, depois sistemas, objetos, inimigos, chefes, fases.
// =============================================================================
// ---- arte
import './game/art/tileset_default.js';
import './game/art/tico.js';
import './game/art/portraits.js';
import './game/art/cosmetics.js';
import './game/art/ui_kit.js';
import './game/art/vfx.js';
import './game/art/tiles_w1.js';
import './game/art/tiles_w2.js';
import './game/art/tiles_w3.js';
import './game/art/tiles_w4.js';
import './game/art/tiles_w5.js';
import './game/art/bg_w1.js';
import './game/art/bg_w2.js';
import './game/art/bg_w3.js';
import './game/art/bg_w4.js';
import './game/art/bg_w5.js';
// ---- áudio
import './game/audio/sfx.js';
import './game/audio/music_w1.js';
import './game/audio/music_w2.js';
import './game/audio/music_w3.js';
import './game/audio/music_w4.js';
import './game/audio/music_w5.js';
import './game/audio/music_bosses.js';
import './game/audio/music_story.js';
// ---- sistemas
import './game/worlds.js';
import './game/progression.js';
import './game/abilities/stitch.js';
import './game/abilities/unstitch.js';
import './game/abilities/rewind.js';
import './game/abilities/decoy.js';
import './game/abilities/unravel.js';
import './game/objects/core.js';
import './game/objects/interactive.js';
import './game/mechanics/w2_water.js';
import './game/mechanics/w3_time.js';
import './game/mechanics/w4_dark.js';
import './game/mechanics/w5_dimension.js';
// ---- inimigos e chefes
import './game/enemies/w1.js';
import './game/enemies/w2.js';
import './game/enemies/w3.js';
import './game/enemies/w4.js';
import './game/enemies/w5.js';
import './game/bosses/rabbit.js';
import './game/bosses/whale.js';
import './game/bosses/king.js';
import './game/bosses/shadow_mother.js';
import './game/bosses/tailor.js';
// ---- história
import './game/story/characters.js';
import './game/story/memories.js';
import './game/story/dialogues_w1.js';
import './game/story/dialogues_w2.js';
import './game/story/dialogues_w3.js';
import './game/story/dialogues_w4.js';
import './game/story/dialogues_w5.js';
import './game/cutscenes/opening.js';
import './game/cutscenes/world_intros.js';
import './game/cutscenes/ending.js';
// ---- cenas / UI
import './game/scenes/title.js';
import './game/scenes/slots.js';
import './game/scenes/menus_basic.js';
import './game/scenes/worldmap.js';
import './game/scenes/menus_progress.js';
import './game/ui/touch.js';
// ---- fases
import './game/levels/test_level.js';
import './game/levels/w1_a.js';
import './game/levels/w1_b.js';
import './game/levels/w1_c.js';
import './game/levels/w2_a.js';
import './game/levels/w2_b.js';
import './game/levels/w2_c.js';
import './game/levels/w3_a.js';
import './game/levels/w3_b.js';
import './game/levels/w3_c.js';
import './game/levels/w4_a.js';
import './game/levels/w4_b.js';
import './game/levels/w4_c.js';
import './game/levels/w5_a.js';
import './game/levels/w5_b.js';
import './game/levels/w5_c.js';
