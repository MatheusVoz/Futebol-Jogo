// =============================================================================
// art/tico.js — Sprite TEMPORÁRIO do Tico (o agente de arte do Tico substitui
// por spritesheets completos). Quadro 48x40, pivô nos pés (24,39), olhando
// para a DIREITA. Mantenha TODOS os nomes de animação listados em player.js.
// =============================================================================
import { defineSprite } from '../../engine/sprites.js';

const C = {
  body: '#3fc7c0', shade: '#2a9d97', light: '#7fe6df', spine: '#ffd23f', spineD: '#e0a020',
  eye: '#120a18', spotY: '#ffd23f', spotO: '#ff8a3c', spotB: '#4a7fe0', out: '#1b2a3a', mouth: '#1b4a4a',
};

const ANIMS = {
  idle: { frames: 6, fps: 6 }, walk: { frames: 8, fps: 12 }, run: { frames: 8, fps: 16 }, skid: { frames: 2, fps: 10 },
  jump: { frames: 2, fps: 10, loop: false }, fall: { frames: 2, fps: 8 }, land: { frames: 2, fps: 16, loop: false },
  attack1: { frames: 4, fps: 18, loop: false }, attack2: { frames: 4, fps: 18, loop: false }, attack3: { frames: 5, fps: 18, loop: false },
  attack_up: { frames: 4, fps: 18, loop: false }, attack_down: { frames: 4, fps: 18, loop: false }, charge: { frames: 4, fps: 12 },
  dash: { frames: 2, fps: 16 }, hurt: { frames: 2, fps: 10 }, death: { frames: 8, fps: 8, loop: false }, swim: { frames: 6, fps: 10 },
  cast: { frames: 4, fps: 12 }, celebrate: { frames: 8, fps: 10 }, sleep: { frames: 4, fps: 2 }, scared: { frames: 4, fps: 12 },
  look_up: { frames: 2, fps: 4 }, look_down: { frames: 2, fps: 4 },
};

function drawTico(pc, anim, f, n) {
  pc.translate(8, 8);
  let bob = 0, legA = 0, lean = 0, eyeClosed = false, squash = 0, headDy = 0;
  const ph = (f / n) * Math.PI * 2;
  if (anim === 'idle') { bob = Math.sin(ph) > 0.3 ? 1 : 0; eyeClosed = f === 5; }
  if (anim === 'walk' || anim === 'run') { bob = Math.abs(Math.sin(ph)) * (anim === 'run' ? 2 : 1); legA = Math.sin(ph); lean = anim === 'run' ? 1 : 0; }
  if (anim === 'jump') { squash = -1; }
  if (anim === 'land') { squash = f === 0 ? 2 : 1; }
  if (anim === 'sleep') { eyeClosed = true; bob = f % 2; }
  if (anim === 'death') { eyeClosed = true; squash = Math.min(3, f); }
  if (anim === 'look_up') headDy = -2;
  if (anim === 'look_down') headDy = 2;
  const by = 22 + squash - bob;
  // tail
  pc.ellipse(7 - lean, by + 1, 5, 3, C.body);
  pc.px(3 - lean, by - 1, C.body);
  // legs
  pc.rect(10 + Math.round(legA * 2), by + 4 - squash, 3, 5 + squash, C.shade);
  pc.rect(17 - Math.round(legA * 2), by + 4 - squash, 3, 5 + squash, C.body);
  // body
  pc.ellipse(15 + lean, by, 7, 6 - squash * 0.5, C.body);
  pc.ellipse(16 + lean, by + 2, 4, 3, C.light);
  // spots
  pc.circle(12 + lean, by - 1, 1.5, C.spotY);
  pc.circle(16 + lean, by + 3, 1.2, C.spotO);
  pc.px(18 + lean, by - 3, C.spotB);
  // neck + head
  const hx = 21 + lean * 2, hy = by - 10 + headDy;
  pc.thickLine(17 + lean, by - 3, hx - 1, hy + 3, 2, C.body);
  pc.ellipse(hx + 1, hy, 5.5, 4.5, C.body);
  // spines
  pc.tri(9, by - 5, 11, by - 9, 13, by - 5, C.spine);
  pc.tri(13, by - 6, 15, by - 10, 17, by - 6, C.spine);
  pc.tri(hx - 4, hy - 2, hx - 2, hy - 6, hx, hy - 3, C.spine);
  // eye
  if (eyeClosed) pc.hline(hx + 2, hy - 1, 2, C.eye);
  else { pc.rect(hx + 2, hy - 2, 2, 3, C.eye); pc.px(hx + 2, hy - 2, '#ffffff'); }
  pc.px(hx + 5, hy + 2, C.mouth);
  pc.outline(C.out);
  // whip line for attacks
  if (anim.startsWith('attack')) {
    const k = f / (n - 1);
    const len = Math.round(4 + Math.sin(k * Math.PI) * 9);
    if (anim === 'attack_up') pc.line(hx, hy - 4, hx, hy - 4 - len, '#ffe27a');
    else if (anim === 'attack_down') pc.line(16, 31, 16, 31, '#ffe27a');
    else pc.line(hx + 4, hy + 4, Math.min(39, hx + 4 + len), hy + 4 - (f % 2), '#ffe27a');
  }
}

defineSprite('tico', {
  w: 48, h: 40, ox: 24, oy: 39,
  anims: ANIMS,
  draw: drawTico,
  meta(anim, f) { return { head: { x: 30, y: 17 }, neck: { x: 27, y: 24 }, back: { x: 20, y: 24 } }; },
});
