// =============================================================================
// objects/core.js — Objetos essenciais de toda fase (arte de pelúcia/tecido).
//   exit          portal de costura mágico (fim da fase)
//   checkpoint    carretel que enrola fio ao ser ativado
//   button        botão dourado (moeda) — imantado pelo jogador
//   star          estrela costurada (3 por fase; "fantasma" se já coletada)
//   heart         coração de pelúcia (cura 1)
//   energy        carretel de energia (+35)
//   sign          placa de madeira com retalho (props.text / props.dialog)
//   spring        botão de costura gigante que serve de trampolim (props.power)
//   secret_marker gatilho invisível de área secreta
//   player_needle projétil da Agulhada (props.dir, props.damage)
//   loot_button   botão que cai de inimigos (props.vx, props.vy)
// Toda arte é procedural (defineSprite) com contorno escuro de 1 px.
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { defineSprite, drawSprite, animFrame } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { TILE, rectsOverlap } from '../../engine/util.js';
import { registerEntity } from '../registry.js';
import { drawPortalSwirl, drawGlow, drawThreadLine, spawnShockwave, spawnImpact, spawnFloatingText } from '../art/vfx.js';

const R = Math.round;

// =============================================================== ARTE
// ---- botão-moeda (6 quadros girando)
defineSprite('obj_button', {
  w: 10, h: 10, ox: 5, oy: 5,
  anims: { spin: { frames: 6, fps: 10 } },
  draw(pc, a, f) {
    const rx = [4, 3, 2, 1, 2, 3][f];
    if (rx === 1) { pc.rect(4, 1, 2, 8, '#e0a020'); pc.vline(4, 2, 5, '#fff3a0'); pc.outline('#6a3a00'); return; }
    pc.ellipse(5, 5, rx + 0.5, 4.5, '#e0a020');            // aro
    pc.ellipse(5, 5, rx - 0.5, 3.5, '#ffd23f');            // face
    if (rx >= 3) { pc.px(4, 4, '#8a5200'); pc.px(6, 4, '#8a5200'); pc.px(4, 6, '#8a5200'); pc.px(6, 6, '#8a5200'); pc.px(5, 5, '#ff8a3c'); }
    else { pc.px(5, 4, '#8a5200'); pc.px(5, 6, '#8a5200'); }
    pc.px(5 - rx + 1, 3, '#fff6c0'); pc.px(5 - rx + 1, 2, '#fff6c0');
    pc.outline('#6a3a00');
  },
});

// ---- estrela costurada de pelúcia (8 quadros: brilho girando)
defineSprite('obj_star', {
  w: 18, h: 18, ox: 9, oy: 9,
  anims: { idle: { frames: 8, fps: 8 } },
  draw(pc, a, f) {
    const star = (r1, r2, cx = 9, cy = 9.5) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? r1 : r2;
        const an = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        pts.push([cx + Math.cos(an) * r, cy + Math.sin(an) * r]);
      }
      return pts;
    };
    pc.poly(star(8, 3.6), '#e0a020');                         // sombra/lateral
    pc.poly(star(7.4, 3.2, 8.6, 9), '#ffd23f');               // face
    pc.poly(star(4.2, 1.9, 7.6, 7.8), '#ffe98a');             // luz sup.-esq.
    // costura tracejada contornando por dentro
    const pts = star(5.8, 2.6, 8.8, 9.2);
    for (let i = 0; i < 10; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 10];
      for (let k = 0; k < 1; k += 0.34) if (((i * 3 + k * 3) | 0) % 2 === 0) pc.px(R(x0 + (x1 - x0) * k), R(y0 + (y1 - y0) * k), '#c86a00');
    }
    // olhinhos de botão e bochechas
    pc.px(7, 9, '#3a1a08'); pc.px(10, 9, '#3a1a08');
    pc.px(6, 10, '#ff9a6a'); pc.px(11, 10, '#ff9a6a');
    pc.px(8, 11, '#a85a00'); pc.px(9, 11, '#a85a00');
    pc.outline('#5a2a00');
    // brilho que percorre as pontas
    const tip = star(8, 3.6)[(f % 5) * 2];
    if (f < 5) { pc.px(R(tip[0]), R(tip[1]) + 1, '#ffffff'); }
    pc.px(5, 5, '#ffffff');
  },
});

// ---- carretel do checkpoint: off (vazio) / wind (enrolando) / on (cheio, brilhando)
function drawSpool(pc, fill, shimmer, on) {
  const wood = '#c8905a', woodL = '#ecb880', woodD = '#8a5a34';
  pc.rect(5, 7, 8, 13, '#a87448');                              // miolo
  pc.vline(6, 7, 13, '#c8905a'); pc.vline(12, 7, 13, '#8a5a34');
  // fio enrolado (de baixo para cima); vazio = restinho desbotado
  const f = fill > 0 ? fill : 0.22;
  const top = R(19 - f * 12);
  const c0 = fill > 0 ? '#ff6fa8' : '#9a8aa8', cS = fill > 0 ? '#c03c7c' : '#6a5a78', cL = fill > 0 ? '#ffb3d0' : '#c8b8d0';
  for (let y = top; y <= 19; y++) {
    const bulge = y > top && y < 19 ? 1 : 0;
    pc.hline(4 - bulge, y, 10 + bulge * 2, c0);
    pc.px(13 + bulge, y, cS); pc.px(12 + bulge, y, cS);
    if ((y + shimmer) % 3 === 0) pc.line(5, y, 7, y - 1, cL);
  }
  pc.hline(5, top, 8, cL);
  // flanges de madeira (com face superior visível)
  pc.rect(1, 3, 16, 4, wood); pc.hline(2, 2, 14, woodL); pc.hline(1, 3, 16, woodL); pc.hline(1, 6, 16, woodD);
  pc.rect(1, 20, 16, 4, wood); pc.hline(1, 20, 16, woodL); pc.hline(1, 23, 16, woodD);
  pc.px(3, 4, '#fff0d8'); pc.px(3, 21, '#fff0d8'); pc.px(14, 5, '#a87448'); pc.px(14, 22, '#a87448');
  // agulha espetada no topo
  pc.vline(13, 0, 3, '#e8eef8'); pc.px(13, 0, '#8a94a8'); pc.px(14, 1, '#b8c0d0');
  if (fill <= 0) {
    // pontinha de fio solta pendurada
    pc.px(14, 17, c0); pc.px(15, 18, c0); pc.px(15, 19, c0); pc.px(16, 20, c0);
  } else if (on) {
    pc.vline(14, 1, Math.max(0, top - 1), '#ff6fa8');             // fio subindo até a agulha
  }
  pc.outline('#2a1220');
  if (on && shimmer % 3 === 1) { pc.px(6, top + 2, '#ffffff'); pc.px(10, 2, '#ffffff'); }
}
defineSprite('obj_spool', {
  w: 18, h: 25, ox: 9, oy: 25,
  anims: { off: { frames: 1, fps: 1 }, wind: { frames: 8, fps: 12, loop: false }, on: { frames: 6, fps: 8 } },
  draw(pc, a, f) {
    if (a === 'off') drawSpool(pc, 0, 0, false);
    else if (a === 'wind') drawSpool(pc, (f + 1) / 8, f, false);
    else drawSpool(pc, 1, f, true);
  },
});

// ---- moldura do portal de saída (casa de botão gigante costurada)
defineSprite('obj_portal', {
  w: 38, h: 48, ox: 19, oy: 48,
  anims: { idle: { frames: 4, fps: 6 } },
  draw(pc, a, f) {
    const cx = 19, cy = 22, rx = 16, ry = 21, ix = 10.5, iy = 15.5;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 38; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      const inn = ((x + 0.5 - cx) / ix) ** 2 + ((y + 0.5 - cy) / iy) ** 2;
      if (d > 1 || inn < 1) continue;
      const s = nx + ny * 0.8;
      let c = '#7a3aa8';
      if (s < -0.75) c = '#b07ae0'; else if (s < -0.35) c = '#9858c8'; else if (s > 0.75) c = '#4a1a70'; else if (s > 0.4) c = '#602a8a';
      if (inn < 1.18) c = '#2a0a44';                              // borda interna funda
      pc.px(x, y, c);
    }
    // pontos em X dourados ao redor
    const n = 18;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2;
      const x = R(cx + Math.cos(an) * 13.2 - 0.5), y = R(cy + Math.sin(an) * 18.3 - 0.5);
      const c = (i + f) % 4 === 0 ? '#fff3a0' : '#ffd23f';
      pc.px(x - 1, y - 1, c); pc.px(x + 1, y + 1, c); pc.px(x + 1, y - 1, c); pc.px(x - 1, y + 1, c); pc.px(x, y, '#c88a10');
    }
    // base de retalho com tufos
    pc.rect(9, 41, 20, 6, '#c8905a'); pc.hline(10, 41, 18, '#ecb880'); pc.hline(9, 46, 20, '#8a5a34');
    for (let x = 11; x < 28; x += 3) pc.px(x, 43, '#fff0d8');
    pc.rect(6, 44, 4, 3, '#5aa84a'); pc.rect(28, 44, 4, 3, '#5aa84a'); pc.px(7, 43, '#8fd06a'); pc.px(30, 43, '#8fd06a');
    // botão-joia no topo
    pc.circle(19, 2.5, 2.6, '#ffd23f'); pc.px(18, 2, '#8a5200'); pc.px(20, 2, '#8a5200'); pc.px(18, 1, '#fff6c0');
    pc.outline('#1e0a2e');
  },
});

// ---- coração de pelúcia (2 quadros: costura brilhando)
const HEART = [
  '.xxx...xxx.',
  'xHHxx.xxxxx',
  'xHxxxxxxxxx',
  'xxxxxxxxxsx',
  'xxxxxxxxxsx',
  '.xxxxxxxsx.',
  '..xxxxxsx..',
  '...xxxsx...',
  '....xsx....',
  '.....x.....',
];
defineSprite('obj_heart', {
  w: 13, h: 12, ox: 6, oy: 6,
  anims: { beat: { frames: 2, fps: 3 } },
  draw(pc, a, f) {
    pc.ascii(HEART, { x: '#ff4f7a', H: '#ffc2d4', s: '#c8285a' }, 1, 1);
    // costura central
    for (let y = 3; y < 9; y += 2) pc.px(6, y, f ? '#ffe0ea' : '#ff9ab4');
    pc.px(9, 2, '#ff8aa8');
    pc.outline('#4a0820');
  },
});

// ---- carretel de energia (4 quadros: brilho girando)
defineSprite('obj_energy', {
  w: 12, h: 13, ox: 6, oy: 6,
  anims: { idle: { frames: 4, fps: 8 } },
  draw(pc, a, f) {
    pc.rect(3, 3, 6, 7, '#2a9ad8');
    for (let y = 3; y < 10; y++) if ((y + f) % 3 === 0) pc.hline(3, y, 5, '#9ff0ff');
    pc.vline(8, 3, 7, '#1a6aa8');
    pc.rect(1, 1, 10, 2, '#c8905a'); pc.hline(2, 1, 8, '#ecb880');
    pc.rect(1, 10, 10, 2, '#c8905a'); pc.hline(1, 11, 10, '#8a5a34');
    pc.px(4, 4, '#ffffff');
    pc.outline('#102a40');
  },
});

// ---- placa de madeira com retalho costurado
defineSprite('obj_sign', {
  w: 18, h: 17, ox: 9, oy: 17,
  anims: { idle: { frames: 1, fps: 1 } },
  draw(pc) {
    pc.rect(8, 10, 2, 7, '#7a5030'); pc.px(8, 11, '#a87448');
    pc.rect(1, 1, 16, 10, '#c89a5a');
    pc.hline(2, 1, 14, '#ecc088'); pc.hline(1, 10, 16, '#9a6a3a'); pc.vline(16, 2, 8, '#a8784a');
    pc.hline(2, 5, 14, '#b88a4a');
    pc.hline(3, 3, 8, '#5a3a20'); pc.hline(3, 7, 6, '#5a3a20'); pc.hline(10, 7, 3, '#5a3a20');
    // retalho rosa no canto com pontinhos
    pc.rect(12, 2, 4, 4, '#ff7aa8'); pc.px(12, 2, '#ffb3d0'); pc.px(15, 3, '#fff0f6'); pc.px(13, 5, '#fff0f6');
    pc.px(2, 2, '#4a3a3a'); pc.px(2, 9, '#4a3a3a'); pc.px(15, 9, '#4a3a3a');
    pc.rect(5, 15, 2, 2, '#5aa84a'); pc.rect(11, 15, 3, 2, '#5aa84a'); pc.px(6, 14, '#8fd06a'); pc.px(12, 14, '#8fd06a');
    pc.outline('#24140a');
  },
});

// ---- mola: botão de costura gigante sobre fio enrolado (idle + boing)
const SPRING_TOP = [8, 1, 6, 3, 5];
function drawSpring(pc, top) {
  pc.ellipse(9, 15, 7.5, 1.6, '#6a4428'); pc.hline(3, 14, 12, '#a87448');
  // mola de fio (anéis empilhados)
  for (let y = 13, i = 0; y > top + 4; y -= 2, i++) {
    pc.ellipseOutline(9, y, 4.5, 1.2, i % 2 ? '#e0a020' : '#ffd23f');
    pc.px(5, y, '#fff3a0');
  }
  // botão (espessura + face + furos com linha em X)
  pc.rect(1, top + 3, 16, 2, '#a82050'); pc.hline(2, top + 5, 14, '#7a1038');
  pc.ellipse(9, top + 3, 8.2, 3.2, '#e8406a');
  pc.ellipse(8, top + 2.4, 5.5, 1.6, '#ff7a9a');
  pc.ellipseOutline(9, top + 3, 4.2, 1.6, '#c82a58');
  pc.px(7, top + 2, '#5a0a24'); pc.px(11, top + 2, '#5a0a24'); pc.px(7, top + 4, '#5a0a24'); pc.px(11, top + 4, '#5a0a24');
  pc.px(8, top + 3, '#fff0f4'); pc.px(10, top + 3, '#fff0f4'); pc.px(9, top + 3, '#ffd23f');
  pc.px(4, top + 2, '#ffd0dc');
  pc.outline('#3a0818');
}
defineSprite('obj_spring', {
  w: 18, h: 17, ox: 9, oy: 17,
  anims: { idle: { frames: 1, fps: 1 }, boing: { frames: 5, fps: 18, loop: false } },
  draw(pc, a, f) { drawSpring(pc, a === 'idle' ? 5 : SPRING_TOP[f]); },
});

// ---- agulha (projétil)
defineSprite('obj_needle', {
  w: 14, h: 5, ox: 7, oy: 2,
  anims: { fly: { frames: 2, fps: 20 } },
  draw(pc, a, f) {
    pc.hline(1, 2, 12, '#d8e2f0'); pc.hline(2, 1, 9, '#ffffff'); pc.hline(1, 3, 10, '#8a94b0');
    pc.px(13, 2, '#ffffff'); pc.px(12, 2, '#ffffff');
    pc.px(2, 2, '#1a1a2a'); pc.px(3, 2, '#1a1a2a');            // buraco da agulha
    pc.outline('#1a2440');
    if (f) pc.px(10, 1, '#c8f6ff');
  },
});

// =============================================================== COLETÁVEIS
class Pickup extends Entity {
  constructor(level, x, y, props) {
    super(level, x, y, props);
    this.w = 10; this.h = 10;
    this.x = x + 3; this.y = y + 3;
    this.baseY = this.y;
    this.z = 20;
  }
  update(dt) {
    this.tickTimers(dt);
    this.y = this.baseY + Math.sin(this.t * 3 + this.x * 0.1) * 1.5;
    const p = this.player;
    if (p && !p.dead && rectsOverlap({ x: this.x - 2, y: this.y - 2, w: this.w + 4, h: this.h + 4 }, p)) this.pick(p);
  }
  pick(p) {}
}

registerEntity('button', class extends Pickup {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.isButton = true;
    if (l.run.collected.has(pr.pid)) this.dead = true;
  }
  update(dt) {
    super.update(dt);
    if (this.dead) return;
    const p = this.player;
    const r = 26 + (p.stats?.magnet || 0);
    if (Math.abs(p.cx - this.cx) < r && Math.abs(p.cy - this.cy) < r) {
      this.x += (p.cx - this.cx) * Math.min(1, dt * 10);
      this.baseY += (p.cy - this.cy) * Math.min(1, dt * 10);
    }
  }
  pick() {
    this.remove();
    this.level.collect('button', 1, this.props.pid);
    audio.sfx('coin', { pitch: 1 + (this.level.run.buttons % 8) * 0.03 });
    this.level.particles.emit('sparkle', this.cx, this.cy, 4);
  }
  draw(ctx) { drawSprite(ctx, 'obj_button', 'spin', animFrame('obj_button', 'spin', this.t + this.x * 0.01), R(this.cx), R(this.cy)); }
});

registerEntity('star', class extends Pickup {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 14; this.h = 14; this.x = x + 1; this.y = y + 1; this.baseY = this.y;
    this.already = save.isCollected(pr.pid);
    this.light = { r: this.already ? 18 : 30, color: this.already ? '#b8c8ff' : '#ffe27a', i: this.already ? 0.35 : 0.75 };
    this.z = 22;
  }
  update(dt) {
    super.update(dt);
    if (!this.dead && Math.random() < (this.already ? 0.04 : 0.12)) {
      this.level.particles.emit('sparkle', this.cx + (Math.random() - 0.5) * 16, this.cy + (Math.random() - 0.5) * 16, 1, this.already ? { colors: ['#c8d8ff', '#ffffff'] } : undefined);
    }
  }
  pick() {
    this.remove();
    this.level.collect('star', 1, this.props.pid, { index: this.props.starIndex });
    audio.sfx('star');
    this.level.particles.emit('stars_burst', this.cx, this.cy, this.already ? 8 : 18);
    if (!this.already) { spawnShockwave(this.level, this.cx, this.cy, { radius: 30, color: '#ffd23f' }); this.level.hitstop(0.06); this.level.shake(0.1); }
    this.level.toast(`Estrela costurada ${this.level.run.starsFound.filter(Boolean).length}/3`, 'icon_star');
  }
  draw(ctx) {
    const cx = R(this.cx), cy = R(this.cy);
    const f = animFrame('obj_star', 'idle', this.t);
    if (this.already) {
      drawSprite(ctx, 'obj_star', 'idle', f, cx, cy, { variant: 'ghost', alpha: 0.55 + Math.sin(this.t * 3) * 0.12 });
      return;
    }
    drawGlow(ctx, cx, cy, 14, '#ffd23f', 0.35 + Math.sin(this.t * 4) * 0.1);
    const sc = 1 + Math.sin(this.t * 4) * 0.06;
    drawSprite(ctx, 'obj_star', 'idle', f, cx, cy, { scaleX: sc, scaleY: sc });
  }
});

registerEntity('heart', class extends Pickup {
  constructor(l, x, y, pr) { super(l, x, y, pr); this.light = { r: 18, color: '#ff7aa2', i: 0.4 }; }
  pick(p) {
    if (p.hp >= p.maxHp) return;
    this.remove(); p.heal(1); audio.sfx('heal');
    this.level.particles.emit('heal', this.cx, this.cy, 10);
    spawnFloatingText(this.level, this.cx, this.y - 2, '+1 ♥', '#ff8aa8');
  }
  draw(ctx) {
    drawGlow(ctx, this.cx, this.cy, 10, '#ff4f7a', 0.25);
    drawSprite(ctx, 'obj_heart', 'beat', animFrame('obj_heart', 'beat', this.t), R(this.cx), R(this.cy));
  }
});

registerEntity('energy', class extends Pickup {
  constructor(l, x, y, pr) { super(l, x, y, pr); this.light = { r: 22, color: '#55d0ff', i: 0.5 }; }
  pick(p) {
    this.remove(); p.gainEnergy(35); audio.sfx('energy');
    this.level.particles.emit('energy', this.cx, this.cy, 12);
    this.level.flashEnergy?.();
  }
  draw(ctx) {
    drawGlow(ctx, this.cx, this.cy, 11, '#55d0ff', 0.3 + Math.sin(this.t * 5) * 0.1);
    drawSprite(ctx, 'obj_energy', 'idle', animFrame('obj_energy', 'idle', this.t), R(this.cx), R(this.cy));
  }
});

// =============================================================== CHECKPOINT
registerEntity('checkpoint', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 16; this.h = 24; this.x = x; this.y = y + TILE - 24;
    this.active = l.run.checkpoint?.id === pr.pid;
    this.windT = this.active ? 9 : -1;     // tempo desde a ativação (animação de enrolar)
    this.z = 5;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.windT >= 0) this.windT += dt;
    const p = this.player;
    if (!this.active && p && !p.dead && this.overlaps(p)) {
      this.active = true; this.windT = 0;
      for (const c of this.level.ofType('checkpoint')) if (c !== this) { c.active = false; c.windT = -1; }
      this.level.setCheckpoint(this.x + 2, this.y + this.h - 18, this.props.pid);
      audio.sfx('checkpoint');
      this.level.particles.emit('thread', this.cx, this.y + 8, 14);
      this.level.toast('Progresso costurado!');
    }
    if (this.active && this.windT > 0.65 && this.windT - dt <= 0.65) {
      spawnShockwave(this.level, this.cx, this.y + 12, { radius: 26, color: '#ff8fc0', particles: false });
      this.level.particles.emit('sparkle', this.cx, this.y + 6, 10, { colors: ['#ffb3d0', '#ffffff', '#ff6fa8'] });
    }
    if (this.active && Math.random() < 0.05) this.level.particles.emit('thread', this.cx, this.y + 4, 1, { colors: ['#ffb3d0', '#ff6fa8'], speed: [5, 15] });
    this.light = this.active ? { r: 34, color: '#ff8fc0', i: 0.6, flicker: 0.3 } : null;
  }
  draw(ctx) {
    const cx = R(this.cx), by = R(this.bottom);
    if (!this.active) { drawSprite(ctx, 'obj_spool', 'off', 0, cx, by); return; }
    const w = this.windT;
    drawGlow(ctx, cx, by - 13, 16, '#ff6fa8', w < 0.65 ? 0.2 : 0.35 + Math.sin(this.t * 3) * 0.08);
    if (w < 0.65) {
      // fio voando do Tico até o carretel enquanto enrola
      const p = this.player;
      const k = w / 0.65;
      const sx = p ? p.cx : cx, sy = p ? p.cy : by - 30;
      const ang = this.t * 14;
      drawThreadLine(ctx, sx + (cx - sx) * k, sy + (by - 13 - sy) * k, cx + Math.cos(ang) * 4, by - 13 + Math.sin(ang) * 2, this.t, '#ff8fc0', { sag: 6 * (1 - k), stitches: false, glow: 0.8 });
      const f = Math.min(7, Math.floor(k * 8));
      const sq = 1 + Math.sin(k * Math.PI * 4) * 0.06;
      drawSprite(ctx, 'obj_spool', 'wind', f, cx, by, { scaleX: 2 - sq, scaleY: sq });
    } else {
      const bounce = w < 1 ? 1 + Math.sin((w - 0.65) / 0.35 * Math.PI) * 0.12 : 1;
      drawSprite(ctx, 'obj_spool', 'on', animFrame('obj_spool', 'on', this.t), cx, by, { scaleX: 2 - bounce, scaleY: bounce });
    }
  }
});

// =============================================================== SAÍDA (portal costurado)
registerEntity('exit', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 20; this.h = 32; this.x = x - 2; this.y = y + TILE - 32;
    this.light = { r: 56, color: '#c89bff', i: 0.9, flicker: 0.4 };
    this.z = 4;
    this.used = false;
  }
  update(dt) {
    this.tickTimers(dt);
    const sx = this.cx, sy = this.bottom - 25;
    if (Math.random() < 0.35) {
      // faíscas sendo sugadas em espiral
      const an = Math.random() * Math.PI * 2, d = 18 + Math.random() * 10;
      this.level.particles.emit('portal', sx + Math.cos(an) * d, sy + Math.sin(an) * d * 1.3, 1, { speed: [0, 0], vx: -Math.cos(an) * 30, vy: -Math.sin(an) * 38, life: [0.5, 0.7] });
    }
    const p = this.player;
    if (!this.used && this.level.state === 'play' && p && this.overlaps(p) && p.state === 'normal') {
      this.used = true;
      audio.sfx('exit');
      this.level.particles.emit('portal', sx, sy, 34);
      this.level.particles.emit('stars_burst', sx, sy, 14);
      spawnShockwave(this.level, sx, sy, { radius: 46, color: '#c89bff', color2: '#ffffff', squash: 1.3 });
      this.level.complete();
    }
  }
  draw(ctx) {
    const cx = R(this.cx), by = R(this.bottom);
    const near = this.player ? Math.max(0, 1 - Math.abs(this.player.cx - this.cx) / 80) : 0;
    drawGlow(ctx, cx, by - 25, 30, '#a855ff', 0.25 + near * 0.25 + Math.sin(this.t * 2) * 0.05);
    drawPortalSwirl(ctx, cx, by - 25, 10 + Math.sin(this.t * 3) * 0.6, this.t * (1 + near), ['#ff4fd8', '#a855ff', '#ffffff'], { squash: 1.48 });
    drawSprite(ctx, 'obj_portal', 'idle', animFrame('obj_portal', 'idle', this.t), cx, by + 1);
    // fios dourados orbitando a moldura
    ctx.fillStyle = '#ffe27a';
    for (let i = 0; i < 6; i++) {
      const a = this.t * 1.6 + (i / 6) * Math.PI * 2;
      const x = R(cx + Math.cos(a) * 19), y = R(by - 25 + Math.sin(a) * 24);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2 + this.t);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
});

// =============================================================== PLACA
registerEntity('sign', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 16; this.h = 16; this.x = x; this.y = y;
    this.interactable = true; this.prompt = 'Ler'; this.z = 3;
  }
  update(dt) { this.tickTimers(dt); }
  interact() { audio.sfx('page_turn'); this.level.say(this.props.dialog || [{ who: 'placa', text: this.props.text || '...' }]); }
  draw(ctx) {
    const near = this.player?.interactTarget === this;
    drawSprite(ctx, 'obj_sign', 'idle', 0, R(this.cx), R(this.bottom), near ? { scaleY: 1 + Math.sin(this.t * 8) * 0.03 } : undefined);
  }
});

// =============================================================== SEGREDO (invisível)
registerEntity('secret_marker', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.isSecret = true;
    this.w = 16; this.h = 16;
    this.found = l.run.secrets.has(pr.pid);
  }
  update() {
    if (!this.found && this.overlaps(this.player)) {
      this.found = true;
      this.level.foundSecret(this.props.pid);
      this.level.particles.emit('stars_burst', this.cx, this.cy, 12, { colors: ['#c89bff', '#ffffff', '#ffe27a'] });
    }
  }
});

// =============================================================== MOLA (botão-trampolim)
registerEntity('spring', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 14; this.h = 8; this.x = x + 1; this.y = y + 8; this.boingT = 9; this.z = 6;
  }
  update(dt) {
    this.tickTimers(dt);
    this.boingT += dt;
    const p = this.player;
    if (p && p.vy >= 0 && this.overlaps(p) && p.bottom - this.y < 8) {
      p.vy = -(this.props.power || 520); p.jumping = false; p.airJumps = 0; p.canAirDash = true; p.grounded = false;
      p.y = Math.min(p.y, this.y - p.h + 2);
      this.boingT = 0; audio.sfx('spring');
      this.level.particles.emit('dust', this.cx, this.y + 4, 6);
      this.level.particles.emit('thread', this.cx, this.y + 2, 3, { colors: ['#ffd23f', '#ff8aa8'] });
    }
  }
  draw(ctx) {
    const done = this.boingT > 5 / 18;
    drawSprite(ctx, 'obj_spring', done ? 'idle' : 'boing', done ? 0 : animFrame('obj_spring', 'boing', this.boingT), R(this.cx), R(this.bottom));
  }
});

// =============================================================== AGULHA (projétil do jogador)
registerEntity('player_needle', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 12; this.h = 4; this.x = x - 6; this.y = y - 2;
    this.vx = (pr.dir || 1) * 340; this.life = 0.7; this.z = 55; this.alwaysUpdate = true;
    this.light = { r: 18, color: '#8ff0ff', i: 0.6 };
  }
  update(dt) {
    this.t += dt;
    this.life -= dt; this.x += this.vx * dt;
    if (this.life <= 0 || this.level.map.rectSolid(this.x, this.y, this.w, this.h)) {
      this.level.particles.emit('stitch_spark', this.cx, this.cy, 5); this.remove(); return;
    }
    for (const e of this.level.entities) {
      if (e.dead || !e.hittable || e === this) continue;
      if (this.overlaps(e)) {
        const res = e.onHit ? e.onHit(this.props.damage || 3, this, { kind: 'needle' }) : e.hurt(this.props.damage || 3, this, { knockback: 160 });
        if (res !== false) { spawnImpact(this.level, this.cx + Math.sign(this.vx) * 5, this.cy, { size: 12, color: '#8ff0ff' }); audio.sfx('hit'); this.remove(); return; }
      }
    }
    if (Math.random() < 0.5) this.level.particles.emit('energy', this.cx - Math.sign(this.vx) * 6, this.cy, 1, { speed: [0, 10] });
  }
  draw(ctx) {
    const d = Math.sign(this.vx) || 1;
    const tail = R(this.cx - d * 6), cy = R(this.cy);
    drawThreadLine(ctx, tail, cy, tail - d * 16, cy + Math.sin(this.t * 40) * 2, this.t, '#ffd23f', { stitches: false, glow: 0.8 });
    drawSprite(ctx, 'obj_needle', 'fly', animFrame('obj_needle', 'fly', this.t), R(this.cx), cy, { flip: d < 0 });
  }
});

// =============================================================== BOTÃO SOLTO (drop de inimigo)
registerEntity('loot_button', class extends Entity {
  constructor(l, x, y, pr) {
    super(l, x, y, pr);
    this.w = 8; this.h = 8; this.vx = pr.vx || 0; this.vy = pr.vy || -150; this.life = 8; this.z = 30;
    this.gravity = 700; this.maxFall = 300; this.alwaysUpdate = true;
  }
  update(dt) {
    this.tickTimers(dt);
    this.life -= dt;
    if (this.life <= 0) { this.remove(); return; }
    const p = this.player;
    if (this.t > 0.35 && Math.abs(p.cx - this.cx) < 30 + (p.stats?.magnet || 0) && Math.abs(p.cy - this.cy) < 30) {
      this.vx += (p.cx - this.cx) * dt * 30; this.vy += (p.cy - this.cy) * dt * 30;
      this.x += this.vx * dt; this.y += this.vy * dt;
    } else {
      const vy0 = this.vy;
      this.physics(dt);
      if (this.grounded) {
        this.vx *= 0.8;
        if (vy0 > 60) this.vy = -vy0 * 0.35; // quiquezinho
      }
    }
    if (this.t > 0.25 && this.overlaps(p)) {
      this.remove();
      this.level.collect('button', 1);
      audio.sfx('coin', { pitch: 1.1 });
      this.level.particles.emit('sparkle', this.cx, this.cy, 3);
    }
  }
  draw(ctx) {
    if (this.life < 2 && Math.floor(this.t * 10) % 2) return;
    drawSprite(ctx, 'obj_button', 'spin', animFrame('obj_button', 'spin', this.t), R(this.cx), R(this.cy));
  }
});
