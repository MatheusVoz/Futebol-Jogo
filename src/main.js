// =============================================================================
// main.js — Ponto de entrada. Registra o conteúdo, inicia o motor e abre a
// cena inicial. Parâmetros de URL úteis para desenvolvimento e testes:
//   ?level=w1_1        abre direto uma fase
//   ?scene=worldmap    abre uma cena registrada
//   ?cutscene=opening  roda uma cutscene standalone
//   ?debug=1           HUD de depuração (F3 alterna caixas de colisão)
//   ?god=1             invencível      ?unlock=all  libera tudo (testes)
// =============================================================================
import './content.js';
import { game } from './engine/game.js';
import { save } from './engine/save.js';
import { input } from './engine/input.js';
import { audio } from './engine/audio.js';
import { R, makeScene } from './game/registry.js';
import { LevelScene } from './game/scenes/level_scene.js';
import { BootScene } from './game/scenes/boot.js';

const canvas = document.getElementById('game');
game.init(canvas);
const params = game.params;
game.debug.enabled = params.get('debug') === '1';
game.debug.god = params.get('god') === '1';

if (params.get('unlock') === 'all') {
  if (!save.hasGame()) save.newGame();
  const d = save.data;
  d.progress.unlockedWorlds = [1, 2, 3, 4, 5];
  Object.keys(d.abilities).forEach((k) => (d.abilities[k] = true));
  d.inventory.buttons = Math.max(d.inventory.buttons, 999);
  d.inventory.patches = Math.max(d.inventory.patches, 30);
  d.inventory.threads = Math.max(d.inventory.threads, 5);
}
if (params.get('fresh') === '1') save.wipe();

window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') game.debug.hitboxes = !game.debug.hitboxes;
  if (e.code === 'F2') game.debug.enabled = !game.debug.enabled;
});

function firstScene() {
  setTimeout(() => { window.__SW.ready = true; }, 50);
  const lvl = params.get('level');
  const sc = params.get('scene');
  const cs = params.get('cutscene');
  if (lvl && R.levels.has(lvl)) {
    if (!save.hasGame()) save.newGame();
    game.scenes.replace(new LevelScene(), { levelId: lvl, skipIntro: params.get('intro') !== '1' });
    return;
  }
  if (cs) {
    const s = makeScene('cutscene', cs, { next: () => game.scenes.go(makeScene('title')) });
    if (s) { game.scenes.replace(s); return; }
  }
  if (sc) {
    const s = makeScene(sc, {});
    if (s) { game.scenes.replace(s); return; }
  }
  const title = makeScene('title');
  if (title) game.scenes.replace(title);
  else game.scenes.replace(new LevelScene(), { levelId: 'test' });
}

game.start(new BootScene(), { next: firstScene });

// ---- hooks para testes automatizados (Playwright) e depuração
window.__SW = {
  game, save, input, audio, R, LevelScene, makeScene,
  get scene() { return game.scenes.top; },
  get level() { const s = game.scenes.stack.find((x) => x instanceof LevelScene); return s || null; },
  goLevel(id, opts = {}) { if (!save.hasGame()) save.newGame(); game.scenes.replace(new LevelScene(), { levelId: id, skipIntro: true, ...opts }); },
  step(n = 1) { game.stepFrames(n); },
  /** Hold actions for n frames: press(['right','jump'], 30) */
  press(actions, frames = 1) {
    for (const a of actions) input.setVirtual(a, true);
    game.stepFrames(frames);
    for (const a of actions) input.setVirtual(a, false);
    game.stepFrames(1);
  },
  errors: [],
  ready: false,
  pause() { game.running = false; },
  resume() { if (!game.running) game.start(); },
};
window.addEventListener('error', (e) => window.__SW.errors.push(String(e.message)));
