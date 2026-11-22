// =============================================================================
// objects/interactive.js — Objetos interativos GLOBAIS das fases (estilo pelúcia).
//
//  tipo (char)          props
//  chest (c)            contents: 'buttons:N' | 'patch' | 'thread' | 'heart' | 'memory:<id>'
//                       (persistente via pid; abre com ataque ou interagir)
//  big_button (O)       vale 5 botões (persistente)
//  memory (M)           memory: id (persistente; abre makeScene('memory_view') se existir)
//  patch (r)            retalho mágico (persistente)
//  ancient_thread (T)   fio antigo (raro, persistente)
//  breakable (B)        2 golpes (ou dash); contents opcional (igual ao baú)
//  gate (G)             signal, latch, height (tiles; padrão: até o teto, máx. 6), invert
//  lever (L)            signal, on (estado inicial), latch (não volta)
//  pressure_plate (D)   signal, latch — pressionada por jogador, level.decoy ou entidade com `weight`
//  ability_shrine (Q)   ability: id (stitch unstitch rewind decoy unravel)
//  moving_platform (F)  dx, dy (tiles), speed (px/s, 40), pause (s, 0.5), width (tiles, 2), signal (só anda se ligado)
//  falling_platform (W) width (tiles, 1) — treme 0,4 s, cai, volta após 3 s
//  loot_pop             (interno) item subindo do baú
// Também registra a fase de teste 'test_objects' (?level=test_objects).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { defineSprite, drawSprite, animFrame, drawImage, hasImage } from '../../engine/sprites.js';
import { paint } from '../../engine/pixel.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { TILE, rectsOverlap, rand } from '../../engine/util.js';
import { R as REG, registerEntity, registerLevel, makeScene } from '../registry.js';
import { drawGlow, drawThreadLine, spawnShockwave, spawnImpact, spawnFloatingText } from '../art/vfx.js';

const R = Math.round;
const OUT = '#1e1226';

// =============================================================== ARTE
// ---- baú de veludo com debrum dourado (closed / opening / open)
function drawChest(pc, open) {
  // corpo
  pc.rect(2, 12, 16, 9, '#c83a4a');
  pc.hline(2, 12, 16, '#e8606a'); pc.rect(2, 19, 16, 2, '#8a1a2a');
  for (const x of [5, 14]) { pc.vline(x, 12, 9, '#ffd23f'); pc.vline(x + 1, 12, 9, '#e0a020'); }
  for (let x = 3; x < 17; x += 2) pc.px(x, 17, '#ff9aa0');
  if (open > 0.3) {
    // interior com brilho
    pc.rect(3, 10, 14, 3, '#3a0a1a'); pc.hline(4, 11, 12, open > 0.7 ? '#ffd23f' : '#6a2a1a');
    if (open > 0.7) { pc.px(7, 10, '#fff6c0'); pc.px(12, 10, '#fff6c0'); }
    // tampa aberta para trás (forro rosa visível)
    const h = R(3 + open * 4);
    const top = 10 - h;
    pc.rect(3, top, 14, h, '#7a1a2a'); pc.rect(4, top + 1, 12, h - 1, '#ffb8c4');
    for (let x = 5; x < 15; x += 2) pc.px(x, top + 1, '#ffe0e6');
  } else {
    const lift = R(open * 6);
    const y = 6 - lift;
    pc.rect(2, y + 2, 16, 5, '#d8485a'); pc.rect(3, y + 1, 14, 1, '#d8485a'); pc.rect(5, y, 10, 1, '#d8485a');
    pc.hline(4, y + 1, 9, '#ff8a8a'); pc.hline(3, y + 2, 4, '#ff8a8a');
    pc.hline(2, y + 6, 16, '#9a2030');
    for (const x of [5, 14]) { pc.vline(x, y + 1, 6, '#ffd23f'); pc.vline(x + 1, y + 1, 6, '#e0a020'); }
    if (lift) pc.hline(3, y + 7, 14, '#ffd23f');
    // fecho de botão
    pc.circle(10, y + 6.5, 1.8, '#ffd23f'); pc.px(10, y + 6, '#8a5200'); pc.px(9, y + 5, '#fff6c0');
  }
  pc.outline(OUT);
}
defineSprite('obj_chest', {
  w: 20, h: 22, ox: 10, oy: 21,
  anims: { closed: { frames: 1, fps: 1 }, opening: { frames: 5, fps: 14, loop: false }, open: { frames: 1, fps: 1 } },
  draw(pc, a, f) { drawChest(pc, a === 'closed' ? 0 : a === 'open' ? 1 : (f + 1) / 5); },
});

// ---- botão grande (6 quadros girando)
defineSprite('obj_bigbutton', {
  w: 16, h: 16, ox: 8, oy: 8,
  anims: { spin: { frames: 6, fps: 9 } },
  draw(pc, a, f) {
    const rx = [7, 5.5, 3.5, 1.5, 3.5, 5.5][f];
    if (rx < 2) { pc.rect(7, 1, 3, 14, '#e0a020'); pc.vline(7, 2, 10, '#fff3a0'); pc.outline('#5a3000'); return; }
    pc.ellipse(8, 8, rx, 7, '#e0a020');
    pc.ellipse(8, 8, rx - 1.2, 5.6, '#ffd23f');
    pc.ellipse(8 - rx * 0.15, 7, Math.max(1, rx - 3), 3.5, '#ffe98a');
    const hx = Math.max(1, R(rx * 0.32));
    for (const [dx, dy] of [[-hx, -2], [hx, -2], [-hx, 2], [hx, 2]]) pc.px(8 + dx, 8 + dy, '#7a4200');
    if (rx > 4) { pc.line(8 - hx, 6, 8 + hx, 10, '#ff6fa8'); pc.line(8 + hx, 6, 8 - hx, 10, '#ff6fa8'); }
    pc.px(R(8 - rx + 2), 3, '#ffffff');
    pc.outline('#5a3000');
  },
});

// ---- fragmento de memória: foto rasgada sépia com costura
defineSprite('obj_memory', {
  w: 16, h: 18, ox: 8, oy: 9,
  anims: { idle: { frames: 4, fps: 5 } },
  draw(pc, a, f) {
    pc.rect(1, 1, 14, 15, '#f4e6c8');
    pc.rect(3, 3, 10, 8, '#b88a64');
    pc.rect(3, 3, 10, 3, '#d8b088');                    // céu
    pc.circle(10.5, 4.5, 1.5, '#fff0c0');               // sol
    pc.rect(3, 9, 10, 2, '#8a6448');                    // chão
    pc.rect(5, 6, 2, 3, '#5a3a28'); pc.px(5, 5, '#5a3a28'); pc.px(6, 5, '#5a3a28');   // criança
    pc.rect(8, 7, 3, 2, '#5a3a28'); pc.px(9, 6, '#5a3a28');                            // brinquedo
    // canto rasgado
    for (let i = 0; i < 5; i++) { pc.erase(14 - i, 15 - (i % 2)); pc.erase(14, 11 + i); pc.erase(13 - i, 16); }
    // costura rosa no topo
    for (let x = 2; x < 14; x += 2) pc.px(x, 1, '#ff7aa8');
    pc.hline(3, 13, 6, '#c8a888');
    pc.outline('#3a2418');
    if (f === 1) pc.px(4, 3, '#ffffff');
    if (f === 2) pc.px(11, 9, '#ffffff');
  },
});

// ---- retalho mágico: quadradinho de colcha costurado
defineSprite('obj_patch', {
  w: 14, h: 14, ox: 7, oy: 7,
  anims: { idle: { frames: 4, fps: 6 } },
  draw(pc, a, f) {
    pc.rect(1, 1, 6, 6, '#ff7aa8'); pc.rect(7, 1, 6, 6, '#4a7fe0');
    pc.rect(1, 7, 6, 6, '#ffd23f'); pc.rect(7, 7, 6, 6, '#3fc7c0');
    pc.px(3, 3, '#ffd0e0'); pc.px(9, 9, '#aff0ea'); pc.px(10, 3, '#ffffff'); pc.px(4, 10, '#fff6c0');
    for (let i = 2; i < 13; i += 2) { pc.px(i, 2, '#ffffff'); pc.px(i, 11, '#ffffff'); pc.px(2, i, '#ffffff'); pc.px(11, i, '#ffffff'); }
    pc.vline(7, 2, 10, '#2a1a3a'); pc.hline(2, 7, 10, '#2a1a3a');
    pc.outline(OUT);
    const sp = [[1, 1], [12, 1], [12, 12], [1, 12]][f];
    pc.px(sp[0], sp[1], '#ffffff');
  },
});

// ---- fio antigo: meada dourada torcida (6 quadros de brilho)
defineSprite('obj_ancient', {
  w: 16, h: 16, ox: 8, oy: 8,
  anims: { idle: { frames: 6, fps: 10 } },
  draw(pc, a, f) {
    pc.ellipseOutline(8, 8, 6, 4, '#e0a020');
    pc.ellipseOutline(8, 8, 4, 6, '#ffd23f');
    pc.ellipseOutline(8, 8, 5, 5, '#ffe98a');
    pc.circle(8, 8, 1.5, '#fff6c0');
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * Math.PI * 2 + f * 0.5;
      if (i % 3 === 0) pc.px(R(8 + Math.cos(an) * 5), R(8 + Math.sin(an) * 5), '#ffffff');
    }
    pc.line(12, 11, 15, 14, '#ffd23f');                  // pontinha solta
    pc.outline('#4a2a00');
  },
});

// ---- bloco de estopa costurado (quebrável): 3 estados de dano
defineSprite('obj_block', {
  w: 16, h: 16, ox: 0, oy: 0,
  anims: { idle: { frames: 3, fps: 1 } },
  draw(pc, a, f) {
    pc.rect(0, 0, 16, 16, '#b8905a');
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) if ((x * 3 + y * 5) % 7 === 0) pc.px(x, y, '#a07a48');
    pc.hline(1, 1, 14, '#d8b07a'); pc.vline(1, 1, 14, '#d0a870');
    pc.hline(1, 14, 14, '#8a6438'); pc.vline(14, 1, 14, '#8a6438');
    for (let i = 2; i < 14; i += 3) { pc.px(i, 3, '#5a3a20'); pc.px(i, 12, '#5a3a20'); pc.px(3, i, '#5a3a20'); pc.px(12, i, '#5a3a20'); }
    // X costurado no meio
    pc.line(6, 6, 9, 9, '#ff6fa8'); pc.line(9, 6, 6, 9, '#ff6fa8');
    if (f >= 1) { pc.line(2, 9, 6, 12, '#4a2a14'); pc.px(4, 10, '#f4efe6'); pc.px(5, 11, '#ffffff'); }
    if (f >= 2) { pc.line(10, 2, 13, 6, '#4a2a14'); pc.rect(11, 3, 2, 2, '#f4efe6'); pc.line(7, 10, 10, 13, '#4a2a14'); pc.px(8, 12, '#f4efe6'); }
    pc.outline(OUT, { inside: true });
  },
});

// ---- alavanca: agulha de tricô com novelo (5 quadros: -45° → +45°)
defineSprite('obj_lever', {
  w: 18, h: 18, ox: 9, oy: 18,
  anims: { pose: { frames: 5, fps: 1 } },
  draw(pc, a, f) {
    const an = (-45 + f * 22.5) * Math.PI / 180;
    const ex = 9 + Math.sin(an) * 10, ey = 13 - Math.cos(an) * 10;
    pc.line(9, 13, R(ex), R(ey), '#d8e0f0');
    pc.line(10, 13, R(ex) + 1, R(ey), '#8a94b0');
    pc.circle(ex, ey, 2.8, f >= 3 ? '#5ad07a' : '#e8406a');
    pc.px(R(ex) - 1, R(ey) - 1, '#ffffff');
    pc.px(R(ex) + 1, R(ey), f >= 3 ? '#2a8a4a' : '#8a1030');
    // base: meia-cúpula de madeira com retalho
    pc.ellipse(9, 15.5, 7, 3.5, '#8a5a34');
    pc.rect(2, 15, 15, 3, '#8a5a34'); pc.hline(4, 13, 10, '#c8905a'); pc.hline(3, 14, 12, '#a87448');
    pc.rect(7, 15, 5, 2, '#ffd23f'); pc.px(8, 15, '#fff6c0');
    pc.outline(OUT);
  },
});

// ---- placa de pressão: botão azul sobre almofada
defineSprite('obj_plate', {
  w: 16, h: 8, ox: 8, oy: 8,
  anims: { up: { frames: 1, fps: 1 }, down: { frames: 1, fps: 1 } },
  draw(pc, a) {
    pc.rect(0, 6, 16, 2, '#5a4a6a'); pc.hline(1, 6, 14, '#7a6a8a');
    const y = a === 'down' ? 4 : 2;
    pc.rect(2, y + 1, 12, 6 - y, '#2a6aa8');
    pc.ellipse(8, y + 1, 6.4, 1.6, a === 'down' ? '#7ad0ff' : '#4a9ae0');
    pc.hline(4, y, 5, a === 'down' ? '#c8f0ff' : '#9fd0ff');
    pc.px(6, y + 1, '#1a3a6a'); pc.px(10, y + 1, '#1a3a6a');
    pc.outline(OUT);
  },
});

// ---- altar de habilidade: pedestal de pedra com estandarte costurado
defineSprite('obj_shrine', {
  w: 26, h: 26, ox: 13, oy: 26,
  anims: { idle: { frames: 1, fps: 1 } },
  draw(pc) {
    pc.rect(2, 20, 22, 6, '#6a6a8a'); pc.hline(3, 20, 20, '#9a9ab8'); pc.hline(2, 25, 22, '#4a4a68');
    pc.rect(6, 8, 14, 12, '#7a7a9a'); pc.vline(7, 8, 12, '#a8a8c8'); pc.vline(18, 8, 12, '#5a5a78');
    pc.px(10, 13, '#5a5a78'); pc.px(15, 17, '#5a5a78');
    // estandarte
    pc.rect(9, 9, 8, 9, '#6a3a9a'); pc.vline(9, 9, 9, '#ffd23f'); pc.vline(16, 9, 9, '#ffd23f');
    pc.px(11, 18, '#6a3a9a'); pc.px(14, 18, '#6a3a9a');
    pc.circle(12.5, 12.5, 1.6, '#ffd23f'); pc.px(12, 12, '#fff6c0');
    for (let y = 10; y < 17; y += 2) pc.px(10, y, '#b07ae0');
    // prato de latão no topo
    pc.rect(3, 5, 20, 3, '#e0a020'); pc.hline(4, 5, 18, '#ffe98a'); pc.hline(3, 7, 20, '#a86a10');
    pc.outline(OUT);
  },
});

// ---- texturas por largura (cache): plataforma móvel e plataforma que cai
const plankCache = new Map();
function movingPlank(wpx) {
  const k = 'm' + wpx;
  if (plankCache.has(k)) return plankCache.get(k);
  const c = paint(wpx, 11, (pc) => {
    pc.rect(0, 5, wpx, 5, '#8a5a34'); pc.hline(0, 9, wpx, '#5a3a20'); pc.hline(0, 5, wpx, '#a87448');
    for (let x = 7; x < wpx - 2; x += 9) pc.vline(x, 6, 3, '#6a4428');
    // almofada acolchoada azul com pontos de costura
    pc.rect(1, 0, wpx - 2, 5, '#4a7fe0'); pc.hline(2, 0, wpx - 4, '#8ab8ff'); pc.hline(1, 4, wpx - 2, '#2a5ab0');
    for (let x = 3; x < wpx - 3; x += 2) pc.px(x, 2, '#c8dcff');
    for (let x = 8; x < wpx - 4; x += 8) { pc.px(x, 1, '#2a5ab0'); pc.px(x, 3, '#2a5ab0'); }
    pc.rect(2, 6, 2, 2, '#ffd23f'); pc.rect(wpx - 4, 6, 2, 2, '#ffd23f');
    pc.outline(OUT, { inside: true });
  });
  plankCache.set(k, c);
  return c;
}
function fallingPlank(wpx) {
  const k = 'f' + wpx;
  if (plankCache.has(k)) return plankCache.get(k);
  const c = paint(wpx, 9, (pc) => {
    pc.rect(0, 0, wpx, 6, '#e8d8b8'); pc.hline(1, 0, wpx - 2, '#fff4dc'); pc.hline(0, 5, wpx, '#b8a888');
    for (let x = 2; x < wpx - 2; x += 3) pc.px(x, 3, '#c84a4a');           // costura frágil
    pc.rect(R(wpx / 2) - 2, 1, 3, 2, '#7aa8d8');                         // remendinho
    pc.rect(0, 0, 2, 9, '#8a5a34'); pc.rect(wpx - 2, 0, 2, 9, '#8a5a34');
    pc.px(4, 6, '#e8d8b8'); pc.px(wpx - 5, 6, '#e8d8b8'); pc.px(R(wpx / 2), 6, '#d8c8a8');  // franjas
    pc.outline(OUT);
  });
  plankCache.set(k, c);
  return c;
}
const gateCache = new Map();
function gateArt(hpx) {
  if (gateCache.has(hpx)) return gateCache.get(hpx);
  const c = paint(16, hpx, (pc) => {
    for (const bx of [1, 6, 11]) {
      pc.rect(bx, 0, 4, hpx - 3, '#8a5a34'); pc.vline(bx + 1, 0, hpx - 3, '#b07a48');
      for (let y = 0; y < hpx - 4; y += 4) { pc.px(bx, y, '#e8406a'); pc.px(bx + 1, y + 1, '#e8406a'); pc.px(bx + 2, y + 2, '#ff7a9a'); pc.px(bx + 3, y + 3, '#e8406a'); }
      pc.rect(bx + 1, hpx - 3, 2, 3, '#ffd23f'); pc.px(bx + 1, hpx - 1, '#e0a020');   // borla
    }
    for (const y of [4, R(hpx / 2)]) { pc.rect(0, y, 16, 3, '#6a4428'); pc.hline(0, y, 16, '#9a6a3a'); }
    const my = R(hpx / 2) + 1;
    pc.circle(8, my, 2.6, '#ffd23f'); pc.px(7, my - 1, '#8a5200'); pc.px(9, my - 1, '#8a5200'); pc.px(7, my - 2, '#fff6c0');
    pc.outline(OUT, { inside: true });
  });
  gateCache.set(hpx, c);
  return c;
}

// =============================================================== AJUDANTES
/** Entrega o conteúdo de baú/bloco: botões soltos, retalho, fio, coração ou memória. */
function dropContents(level, x, y, contents, pid) {
  const c = String(contents || 'buttons:3');
  const [kind, arg] = [c.split(':')[0], c.slice(c.indexOf(':') + 1)];
  if (kind === 'buttons') {
    const n = Math.max(1, Math.min(40, parseInt(arg, 10) || 3));
    for (let i = 0; i < n; i++) level.spawn('loot_button', x - 4, y - 4, { vx: rand(-70, 70), vy: rand(-240, -140) });
    spawnFloatingText(level, x, y - 14, `+${n}`, '#ffd23f');
  } else if (kind === 'patch') {
    level.collect('patch', 1);
    level.spawn('loot_pop', x, y, { sprite: 'obj_patch', color: '#ff7aa8' });
    level.toast('Retalho mágico!', 'icon_patch');
  } else if (kind === 'thread') {
    level.collect('thread', 1);
    level.spawn('loot_pop', x, y, { sprite: 'obj_ancient', color: '#ffd23f' });
    level.toast('Fio antigo!', 'icon_thread');
  } else if (kind === 'heart') {
    level.spawn('heart', x - 8, y - 20, {});
  } else if (kind === 'memory') {
    level.spawn('memory', x - 8, y - 22, { memory: arg, pid: `${pid}:mem` });
  } else if (kind === 'energy') {
    level.spawn('energy', x - 8, y - 20, {});
  }
  level.particles.emit('confetti', x, y - 4, 14);
}

/** Ítem que sobe girando de dentro do baú e some em brilho. */
registerEntity('loot_pop', class extends Entity {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 1; this.h = 1; this.z = 60; this.alwaysUpdate = true; }
  update(dt) {
    this.t += dt;
    if (this.t > 1.2) { this.level.particles.emit('stars_burst', this.x, this.y - 22, 10); this.remove(); }
  }
  draw(ctx) {
    const k = Math.min(1, this.t / 0.5);
    const y = this.y - 22 * (1 - (1 - k) * (1 - k));
    drawGlow(ctx, this.x, y, 14, this.props.color || '#ffffff', 0.5);
    drawSprite(ctx, this.props.sprite, 'idle', animFrame(this.props.sprite, 'idle', this.t), R(this.x), R(y), { scaleX: Math.cos(this.t * 6) });
  }
});

/** Coletável persistente flutuante (base de big_button, memory, patch, ancient_thread). */
class Keepsake extends Entity {
  constructor(l, x, y, p, w = 14, h = 14) {
    super(l, x, y, p);
    this.w = w; this.h = h; this.x = x + (TILE - w) / 2; this.y = y + (TILE - h) / 2;
    this.baseY = this.y; this.z = 22;
    this.already = save.isCollected(p.pid);
  }
  update(dt) {
    this.tickTimers(dt);
    this.y = this.baseY + Math.sin(this.t * 2.6 + this.x * 0.05) * 2;
    const p = this.player;
    if (!this.already && p && !p.dead && rectsOverlap({ x: this.x - 2, y: this.y - 2, w: this.w + 4, h: this.h + 4 }, p)) { this.remove(); this.pick(p); }
  }
  pick() {}
}

// =============================================================== BAÚ
registerEntity('chest', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = 18; this.h = 15; this.alignToCell(x, y);
    this.opened = save.isCollected(p.pid) || l.run.collected.has(p.pid);
    this.openT = this.opened ? 9 : -1;
    this.hittable = !this.opened; this.interactable = !this.opened; this.prompt = 'Abrir';
    this.z = 8;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.openT >= 0) this.openT += dt;
    if (!this.opened && Math.random() < 0.03) this.level.particles.emit('sparkle', this.x + rand(2, 16), this.y + rand(0, 6), 1);
  }
  onHit() { this.open(); return true; }
  interact() { this.open(); }
  open() {
    if (this.opened) return;
    this.opened = true; this.openT = 0;
    this.hittable = false; this.interactable = false;
    audio.sfx('chest_open');
    this.level.shake(0.12);
    this.level.collect('chest', 1, this.props.pid);
    this.level.tasks.run(function* (self) {
      yield 0.3;
      if (self.dead) return;
      spawnShockwave(self.level, self.cx, self.y + 4, { radius: 22, color: '#ffd23f', particles: false });
      dropContents(self.level, self.cx, self.y + 2, self.props.contents, self.props.pid);
    }, this);
  }
  draw(ctx) {
    const cx = R(this.cx), by = R(this.bottom);
    if (!this.opened) { drawSprite(ctx, 'obj_chest', 'closed', 0, cx, by, { scaleY: 1 + Math.sin(this.t * 3) * 0.02 }); return; }
    if (this.openT < 0.36) drawSprite(ctx, 'obj_chest', 'opening', animFrame('obj_chest', 'opening', this.openT), cx, by);
    else {
      if (this.openT < 1.6) drawGlow(ctx, cx, by - 10, 16, '#ffd23f', 0.5 * (1 - (this.openT - 0.36) / 1.24));
      drawSprite(ctx, 'obj_chest', 'open', 0, cx, by);
    }
  }
});

// =============================================================== BOTÃO GRANDE (5)
registerEntity('big_button', class extends Keepsake {
  constructor(l, x, y, p) {
    super(l, x, y, p, 14, 14);
    if (this.already || l.run.collected.has(p.pid)) this.dead = true;
    this.light = { r: 24, color: '#ffd23f', i: 0.5 };
  }
  pick() {
    this.level.collect('button', 5);
    this.level.collect('bigbutton', 1, this.props.pid);
    audio.sfx('coin', { pitch: 0.8 }); audio.sfx('coin', { pitch: 1.2, vol: 0.6 });
    this.level.particles.emit('sparkle', this.cx, this.cy, 12);
    spawnFloatingText(this.level, this.cx, this.y - 4, '+5', '#ffd23f');
  }
  draw(ctx) {
    drawGlow(ctx, this.cx, this.cy, 13, '#ffd23f', 0.3);
    drawSprite(ctx, 'obj_bigbutton', 'spin', animFrame('obj_bigbutton', 'spin', this.t), R(this.cx), R(this.cy));
  }
});

// =============================================================== MEMÓRIA
registerEntity('memory', class extends Keepsake {
  constructor(l, x, y, p) {
    super(l, x, y, p, 14, 16);
    const id = p.memory;
    if (id && save.data.inventory.memories.includes(id)) this.already = true;
    this.light = { r: 30, color: '#d8b8ff', i: this.already ? 0.3 : 0.7, flicker: 0.2 };
  }
  update(dt) {
    super.update(dt);
    if (!this.dead && Math.random() < (this.already ? 0.03 : 0.1)) this.level.particles.emit('ghost_patch', this.cx + rand(-8, 8), this.cy + rand(-8, 8), 1);
  }
  pick() {
    const id = this.props.memory;
    this.level.collect('memory', 1, this.props.pid, { id });
    audio.sfx('star', { pitch: 0.8 });
    spawnShockwave(this.level, this.cx, this.cy, { radius: 34, color: '#d8b8ff' });
    this.level.particles.emit('stars_burst', this.cx, this.cy, 14, { colors: ['#e8d8ff', '#ffffff', '#ffd23f'] });
    const title = REG.memories?.get(id)?.title;
    this.level.toast(title ? `Memória: ${title}` : 'Memória recuperada!', 'icon_memory');
    save.commit();
    const scene = id ? makeScene('memory_view', id, { onClose: () => {} }) : null;
    if (scene) game.scenes.push(scene);
  }
  draw(ctx) {
    const cx = R(this.cx), cy = R(this.cy);
    if (this.already) { drawSprite(ctx, 'obj_memory', 'idle', 0, cx, cy, { variant: 'ghost', alpha: 0.5 }); return; }
    drawGlow(ctx, cx, cy, 18, '#c8a8ff', 0.35 + Math.sin(this.t * 2.5) * 0.1);
    drawSprite(ctx, 'obj_memory', 'idle', animFrame('obj_memory', 'idle', this.t), cx, cy);
  }
});

// =============================================================== RETALHO MÁGICO
registerEntity('patch', class extends Keepsake {
  constructor(l, x, y, p) {
    super(l, x, y, p, 12, 12);
    if (this.already || l.run.collected.has(p.pid)) this.dead = true;
    this.light = { r: 24, color: '#ff8ac0', i: 0.5 };
  }
  update(dt) {
    super.update(dt);
    if (!this.dead && Math.random() < 0.08) this.level.particles.emit('sparkle', this.cx + rand(-7, 7), this.cy + rand(-7, 7), 1, { colors: ['#ffb3d0', '#ffffff', '#9fd0ff'] });
  }
  pick() {
    this.level.collect('patch', 1, this.props.pid);
    audio.sfx('star', { pitch: 1.15 });
    this.level.particles.emit('confetti', this.cx, this.cy, 12);
    spawnShockwave(this.level, this.cx, this.cy, { radius: 24, color: '#ff8ac0' });
    this.level.toast('Retalho mágico!', 'icon_patch');
    spawnFloatingText(this.level, this.cx, this.y - 4, '+1 retalho', '#ffb3d0');
  }
  draw(ctx) {
    drawGlow(ctx, this.cx, this.cy, 13, '#ff7aa8', 0.3);
    drawSprite(ctx, 'obj_patch', 'idle', animFrame('obj_patch', 'idle', this.t), R(this.cx), R(this.cy));
  }
});

// =============================================================== FIO ANTIGO (raro)
registerEntity('ancient_thread', class extends Keepsake {
  constructor(l, x, y, p) {
    super(l, x, y, p, 14, 14);
    if (this.already || l.run.collected.has(p.pid)) this.dead = true;
    this.light = { r: 36, color: '#ffe27a', i: 0.8, flicker: 0.3 };
  }
  update(dt) {
    super.update(dt);
    if (!this.dead && Math.random() < 0.2) this.level.particles.emit('thread', this.cx + rand(-6, 6), this.cy + rand(-6, 6), 1, { speed: [4, 14] });
  }
  pick() {
    this.level.collect('thread', 1, this.props.pid);
    audio.sfx('star', { pitch: 0.7 }); audio.sfx('secret_soft');
    this.level.hitstop(0.08); this.level.shake(0.15); this.level.flash('#fff3c0', 0.12);
    spawnShockwave(this.level, this.cx, this.cy, { radius: 44, color: '#ffd23f', thickness: 3 });
    this.level.particles.emit('stars_burst', this.cx, this.cy, 20);
    this.level.toast('Fio antigo encontrado!', 'icon_thread');
    save.commit();
  }
  draw(ctx) {
    const cx = R(this.cx), cy = R(this.cy);
    drawGlow(ctx, cx, cy, 20, '#ffd23f', 0.35 + Math.sin(this.t * 5) * 0.12);
    // fios orbitando
    for (let i = 0; i < 2; i++) {
      const a = this.t * 2 + i * Math.PI;
      drawThreadLine(ctx, cx + Math.cos(a) * 11, cy + Math.sin(a) * 5, cx + Math.cos(a + 1.3) * 11, cy + Math.sin(a + 1.3) * 5, this.t, '#ffe27a', { stitches: false, glow: 0.5, alpha: 0.7 });
    }
    drawSprite(ctx, 'obj_ancient', 'idle', animFrame('obj_ancient', 'idle', this.t), cx, cy, { scaleX: 1 + Math.sin(this.t * 3) * 0.08, scaleY: 1 + Math.sin(this.t * 3) * 0.08 });
  }
});

// =============================================================== BLOCO QUEBRÁVEL
registerEntity('breakable', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = 16; this.h = 16;
    this.solid = true; this.hittable = true; this.z = 9;
    this.hits = 0; this.maxHits = p.hits || 2; this.shakeT = 0;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.shakeT > 0) this.shakeT -= dt;
    // dash quebra na hora
    const p = this.player;
    if (p && p.state === 'dash' && rectsOverlap({ x: p.x - 3, y: p.y + 2, w: p.w + 6, h: p.h - 4 }, this)) this.smash(p);
  }
  onHit(dmg, src) {
    if (this.dead || this.invuln > 0) return false;
    this.invuln = 0.12;
    this.hits++;
    if (this.hits >= this.maxHits) { this.smash(src); return true; }
    this.flash = 0.1; this.shakeT = 0.2;
    audio.sfx('hit', { pitch: 0.8 });
    this.level.particles.emit('fluff', this.cx, this.cy, 4);
    return true;
  }
  smash() {
    if (this.dead) return;
    this.remove();
    audio.sfx('break_block');
    this.level.shake(0.15);
    this.level.particles.emit('fabric', this.cx, this.cy, 10, { colors: ['#b8905a', '#8a6438', '#d8b07a'] });
    this.level.particles.emit('fluff', this.cx, this.cy, 8);
    spawnImpact(this.level, this.cx, this.cy, { size: 14 });
    const pid = this.props.pid;
    if (this.props.contents && !save.isCollected(pid) && !this.level.run.collected.has(pid)) {
      this.level.collect('chest', 1, pid);
      dropContents(this.level, this.cx, this.cy, this.props.contents, pid);
    }
  }
  draw(ctx) {
    const f = Math.min(2, this.hits);
    const ox = this.shakeT > 0 ? R(Math.sin(this.t * 80) * 1.5) : 0;
    drawSprite(ctx, 'obj_block', 'idle', f, R(this.x) + ox, R(this.y), this.flash > 0 ? { variant: 'flash' } : undefined);
  }
});

// =============================================================== PORTÃO
registerEntity('gate', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    // cresce para cima a partir da célula até o teto (ou props.height tiles)
    let tiles = p.height || 0;
    if (!tiles) { tiles = 1; while (tiles < 6 && !l.map.solidAt(x + 8, y - tiles * TILE + 8)) tiles++; }
    this.fullH = tiles * TILE;
    this.x = x; this.y = y + TILE - this.fullH; this.w = 16; this.h = this.fullH;
    this.solid = true; this.z = 7;
    this.open = 0; this.latched = false;
    this.alwaysUpdate = true;
    this.want = this.isOn();
    this.open = this.want ? 1 : 0;
    this.applyOpen();
  }
  isOn() {
    const v = !!this.level.signals?.[this.props.signal];
    return this.props.invert ? !v : v;
  }
  applyOpen() {
    this.h = Math.max(0, R(this.fullH * (1 - this.open)));
    this.solid = this.h > 3;
  }
  update(dt) {
    this.tickTimers(dt);
    let want = this.isOn() || this.latched;
    if (want && this.props.latch) this.latched = true;
    if (want !== this.want) {
      // não fecha em cima do jogador
      const p = this.player;
      if (!want && p && rectsOverlap(p, { x: this.x, y: this.y, w: this.w, h: this.fullH })) want = true;
      else { this.want = want; audio.sfx('gate_open', { pitch: want ? 1 : 0.8 }); this.level.shake(0.06); }
    }
    const target = this.want ? 1 : 0;
    if (this.open !== target) {
      this.open = target > this.open ? Math.min(1, this.open + dt * 2.2) : Math.max(0, this.open - dt * 3);
      this.applyOpen();
      if (Math.random() < 0.4) this.level.particles.emit('dust', this.cx + rand(-6, 6), this.y + this.h, 1);
      if (this.open === 0) { this.level.shake(0.08); this.level.particles.emit('dust', this.cx, this.y + this.fullH, 5); }
    }
  }
  draw(ctx) {
    const x = R(this.x), y = R(this.y);
    // trilho/molduras fixos
    ctx.fillStyle = '#3a2418'; ctx.fillRect(x - 1, y, 1, this.fullH); ctx.fillRect(x + 16, y, 1, this.fullH);
    const lamp = this.want ? '#5ad07a' : '#e8406a';
    ctx.fillStyle = OUT; ctx.fillRect(x + 5, y - 3, 6, 4);
    ctx.fillStyle = lamp; ctx.fillRect(x + 6, y - 2, 4, 2);
    drawGlow(ctx, x + 8, y - 1, 6, lamp, 0.35);
    if (this.h <= 0) return;
    const img = gateArt(this.fullH);
    ctx.drawImage(img, 0, this.fullH - this.h, 16, this.h, x, y, 16, this.h);
  }
});

// =============================================================== ALAVANCA
registerEntity('lever', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = 14; this.h = 16; this.x = x + 1; this.y = y;
    this.on = !!p.on; this.pose = this.on ? 4 : 0; this.cd = 0;
    this.hittable = true; this.interactable = true; this.prompt = 'Puxar'; this.z = 6;
  }
  init() { if (this.on && this.props.signal) this.level.signal(this.props.signal, true); }
  onHit() { return this.toggle(); }
  interact() { this.toggle(); }
  toggle() {
    if (this.cd > 0 || (this.on && this.props.latch)) return false;
    this.cd = 0.35; this.on = !this.on;
    audio.sfx('lever');
    this.level.particles.emit('stitch_spark', this.cx, this.y + 4, 5);
    if (this.props.signal) this.level.signal(this.props.signal, this.on);
    if (this.props.latch && this.on) { this.interactable = false; this.hittable = false; }
    return true;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.cd > 0) this.cd -= dt;
    const target = this.on ? 4 : 0;
    this.pose += Math.sign(target - this.pose) * Math.min(Math.abs(target - this.pose), dt * 30);
  }
  draw(ctx) {
    drawSprite(ctx, 'obj_lever', 'pose', R(this.pose), R(this.cx), R(this.bottom));
  }
});

// =============================================================== PLACA DE PRESSÃO
registerEntity('pressure_plate', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = 16; this.h = 6; this.x = x; this.y = y + TILE - 6;
    this.pressed = false; this.z = 4; this.alwaysUpdate = true;
  }
  weighs(e) {
    return e && !e.dead && rectsOverlap({ x: this.x + 1, y: this.y - 6, w: this.w - 2, h: 10 }, e);
  }
  update(dt) {
    this.tickTimers(dt);
    const L = this.level;
    let on = this.weighs(L.player) || this.weighs(L.decoy);
    if (!on) for (const e of L.entities) if (e.weight && e !== this && this.weighs(e)) { on = true; break; }
    if (this.pressed && this.props.latch) on = true;
    if (on !== this.pressed) {
      this.pressed = on;
      audio.sfx(on ? 'plate_down' : 'plate_up');
      if (on) L.particles.emit('dust', this.cx, this.bottom - 2, 4);
      if (this.props.signal) L.signal(this.props.signal, on);
    }
  }
  draw(ctx) {
    if (this.pressed) drawGlow(ctx, this.cx, this.bottom - 3, 9, '#55d0ff', 0.35);
    drawSprite(ctx, 'obj_plate', this.pressed ? 'down' : 'up', 0, R(this.cx), R(this.bottom));
  }
});

// =============================================================== ALTAR DE HABILIDADE
registerEntity('ability_shrine', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = 22; this.h = 26; this.alignToCell(x, y);
    this.interactable = true; this.z = 6; this.busy = false;
    this.refresh();
  }
  get def() { return REG.abilities.get(this.props.ability) || null; }
  get color() { return this.def?.color || '#c89bff'; }
  refresh() {
    this.done = !!this.props.ability && save.hasAbility(this.props.ability);
    this.prompt = this.done ? 'Lembrar' : 'Tocar';
    this.light = { r: this.done ? 24 : 44, color: this.color, i: this.done ? 0.4 : 0.85, flicker: 0.3 };
  }
  update(dt) {
    this.tickTimers(dt);
    if (!this.done && Math.random() < 0.15) this.level.particles.emit('thread', this.cx + rand(-10, 10), this.bottom - 26 + rand(-8, 8), 1, { colors: [this.color, '#ffffff'], speed: [4, 12] });
  }
  interact(player) {
    if (this.busy) return;
    const id = this.props.ability;
    const def = this.def;
    const name = def?.name || 'Nova habilidade';
    if (this.done || !id) { this.level.say([{ who: 'narrador', text: def?.desc || `{${'#ffd23f'}}${name}{/}` }]); return; }
    this.busy = true;
    save.unlockAbility(id);
    if (!save.data.equippedAbility || !save.hasAbility(save.data.equippedAbility)) save.data.equippedAbility = id;
    save.commit();
    audio.sfx('secret');
    this.level.flash('#ffffff', 0.25); this.level.shake(0.25); this.level.hitstop(0.1);
    spawnShockwave(this.level, this.cx, this.bottom - 26, { radius: 60, color: this.color, thickness: 3 });
    this.level.particles.emit('confetti', this.cx, this.bottom - 26, 24);
    this.level.particles.emit('stars_burst', this.cx, this.bottom - 26, 20, { colors: [this.color, '#ffffff'] });
    if (player) { player.castT = 0.8; }
    this.refresh();
    const csId = `ability_${id}`;
    const done = () => { this.busy = false; };
    if (REG.cutscenes.has(csId)) this.level.cutscene(csId, { shrine: this }).then(done, done);
    else {
      this.level.toast(`Nova habilidade: ${name}!`, def?.icon || `icon_ab_${id}`);
      spawnFloatingText(this.level, this.cx, this.bottom - 44, name, this.color);
      const lines = [{ who: 'narrador', text: `Você aprendeu {#ffd23f}${name}{/}!` }];
      if (def?.desc) lines.push({ who: 'narrador', text: def.desc });
      this.level.say(lines).then(done, done);
    }
  }
  draw(ctx) {
    const cx = R(this.cx), by = R(this.bottom);
    drawSprite(ctx, 'obj_shrine', 'idle', 0, cx, by);
    const oy = by - 34 + R(Math.sin(this.t * 2) * 2);
    const col = this.color;
    if (this.done) {
      drawGlow(ctx, cx, oy, 8, col, 0.25);
      ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.fillRect(cx - 2, oy - 2, 5, 5); ctx.globalAlpha = 1;
      return;
    }
    drawGlow(ctx, cx, oy, 20, col, 0.45 + Math.sin(this.t * 3) * 0.1);
    // anéis de fio orbitando
    ctx.fillStyle = col;
    for (let i = 0; i < 14; i++) {
      const a = this.t * 2.2 + (i / 14) * Math.PI * 2;
      ctx.globalAlpha = Math.sin(a) > 0 ? 1 : 0.4;
      ctx.fillRect(R(cx + Math.cos(a) * 12), R(oy + Math.sin(a) * 4), 1, 1);
      ctx.fillRect(R(cx + Math.cos(-a * 0.8) * 5), R(oy + Math.sin(-a * 0.8) * 11), 1, 1);
    }
    ctx.globalAlpha = 1;
    const icon = this.def?.icon || `icon_ab_${this.props.ability}`;
    if (hasImage(icon)) drawImage(ctx, icon, cx - 6, oy - 6);
    else {
      ctx.fillStyle = OUT; ctx.fillRect(cx - 4, oy - 4, 9, 9);
      ctx.fillStyle = col; ctx.fillRect(cx - 3, oy - 3, 7, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 2, oy - 2, 2, 2);
    }
  }
});

// =============================================================== PLATAFORMA MÓVEL
registerEntity('moving_platform', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = (p.width || 2) * TILE; this.h = 8;
    this.x0 = x; this.y0 = y; this.x = x; this.y = y;
    this.x1 = x + (p.dx || 0) * TILE; this.y1 = y + (p.dy || 0) * TILE;
    this.speed = p.speed || 40; this.pauseT = p.pause ?? 0.5;
    this.len = Math.hypot(this.x1 - this.x0, this.y1 - this.y0);
    this.s = 0; this.dir = 1; this.wait = 0;
    this.oneway = true; this.alwaysUpdate = true; this.z = 8;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.len < 1) return;
    if (this.props.signal && !this.level.signals?.[this.props.signal]) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    this.s += this.dir * this.speed * dt;
    if (this.s >= this.len) { this.s = this.len; this.dir = -1; this.wait = this.pauseT; }
    else if (this.s <= 0) { this.s = 0; this.dir = 1; this.wait = this.pauseT; }
    // suaviza nas pontas
    const k = this.s / this.len;
    const e = k < 0.08 ? k * k / 0.16 : k > 0.92 ? 1 - (1 - k) * (1 - k) / 0.16 : (k - 0.04) / 0.92;
    const nx = this.x0 + (this.x1 - this.x0) * e, ny = this.y0 + (this.y1 - this.y0) * e;
    this.carry(nx - this.x, ny - this.y);
    this.x = nx; this.y = ny;
  }
  carry(dx, dy) {
    const map = this.level.map;
    for (const r of [this.level.player, this.level.decoy]) {
      if (!r || r.dead || r.groundEntity !== this) continue;
      if (dx && !map.rectSolid(r.x + dx, r.y, r.w, r.h)) r.x += dx;
      if (dy && !map.rectSolid(r.x, r.y + dy, r.w, r.h)) r.y += dy;
    }
  }
  draw(ctx) {
    // trilho de fio (caminho)
    const hw = this.w / 2;
    drawThreadLine(ctx, R(this.x0 + hw), R(this.y0 + 4), R(this.x1 + hw), R(this.y1 + 4), this.t * 0.3, '#c8b8e8', { glow: 0, alpha: 0.28, stitches: true });
    ctx.drawImage(movingPlank(this.w), R(this.x), R(this.y));
  }
});

// =============================================================== PLATAFORMA QUE CAI
registerEntity('falling_platform', class extends Entity {
  constructor(l, x, y, p) {
    super(l, x, y, p);
    this.w = (p.width || 1) * TILE; this.h = 8;
    this.x0 = x; this.y0 = y; this.x = x; this.y = y;
    this.state = 'idle'; this.timer = 0; this.alpha = 1;
    this.oneway = true; this.z = 8;
  }
  update(dt) {
    this.tickTimers(dt);
    const p = this.player;
    if (this.state === 'idle') {
      if (p && p.groundEntity === this) { this.state = 'shake'; this.timer = 0.4; audio.sfx('crumble', { pitch: 1.2 }); }
    } else if (this.state === 'shake') {
      this.timer -= dt;
      if (Math.random() < 0.3) this.level.particles.emit('fluff', this.x + rand(0, this.w), this.y + 6, 1);
      if (this.timer <= 0) { this.state = 'fall'; this.vy = 20; this.timer = 3; audio.sfx('crumble'); }
    } else if (this.state === 'fall') {
      this.vy = Math.min(380, this.vy + 900 * dt);
      const dy = this.vy * dt;
      if (p && p.groundEntity === this) p.y += dy;
      this.y += dy;
      this.timer -= dt;
      if (this.timer < 2.4) { this.oneway = false; this.alpha = 0; }
      if (this.timer <= 0) {
        if (p && rectsOverlap(p, { x: this.x0, y: this.y0 - 2, w: this.w, h: this.h + 2 })) { this.timer = 0.2; return; }
        this.state = 'respawn'; this.timer = 0.35; this.x = this.x0; this.y = this.y0; this.vy = 0; this.oneway = true;
        this.level.particles.emit('sparkle', this.cx, this.cy, 5);
      }
    } else if (this.state === 'respawn') {
      this.timer -= dt; this.alpha = 1 - Math.max(0, this.timer / 0.35);
      if (this.timer <= 0) { this.state = 'idle'; this.alpha = 1; }
    }
  }
  draw(ctx) {
    if (this.alpha <= 0) return;
    const ox = this.state === 'shake' ? R(Math.sin(this.t * 90)) : 0;
    ctx.globalAlpha = this.alpha;
    ctx.drawImage(fallingPlank(this.w), R(this.x) + ox, R(this.y));
    ctx.globalAlpha = 1;
  }
});

// =============================================================== FASE DE TESTE
// ?level=test_objects&god=1 — vitrine de todos os objetos deste módulo e de core.js.
registerLevel({
  id: 'test_objects', world: 0, index: 0, name: 'Vitrine de Objetos', subtitle: 'Teste',
  tileset: 'default', background: 'default', music: null, parTime: 120, ambient: 'w1_fireflies',
  map: [
    '.............................................................................................#',
    '.............................................................................................#',
    '.............................................................................................#',
    '.............................................................................................#',
    '..................................................................*..........................#',
    '....................................................T........................................#',
    '.............................................................................................#',
    '.............................................................................................#',
    '.........................................###.........................h.......................#',
    '...................................................................#####.....................#',
    '.............................................................................................#',
    '..............*.........................................M....................................#',
    '.................r........................................................WWW.........*......#',
    '..P..o.o.o..O.......K...i...c...B.B...L...G...D.....J.......Q...F..................e.....E...#',
    '#########################################################################......###############',
    '#########################################################################......###############',
    '#########################################################################......###############',
  ],
  props: {
    '24,13': { text: 'Bem-vindo à {#ffd23f}vitrine{/}! Bata no baú, no bloco e na alavanca.' },
    '28,13': { contents: 'buttons:6' },
    '32,13': { contents: 'patch' },
    '38,13': { signal: 'tg1' },
    '42,13': { signal: 'tg1' },
    '46,13': { signal: 'tp1' },
    '60,13': { ability: 'stitch' },
    '64,13': { dx: 0, dy: -4, speed: 36, width: 2 },
    '56,11': { memory: 'm_test' },
  },
  objects: [
    { type: 'gate', x: 48, y: 13, signal: 'tp1', height: 2 },
    { type: 'chest', x: 80, y: 13, contents: 'memory:m_test2' },
  ],
});
