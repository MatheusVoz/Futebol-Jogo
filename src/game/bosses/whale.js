// =============================================================================
// bosses/whale.js — CHEFE DO MUNDO 2: "A BALEIA DE VIDRO" + fase w2_6
//
// Fase 'w2_6' "O Ventre do Oceano" (noite, música 'boss_whale', oxigênio):
//   Aproximação curta a nado (praia → arco de pedra → pilar com estrela → ilhota
//   com checkpoint). Um túnel baixo leva à ARENA submersa (camera.lockTo), com
//   2 parapeitos vazados e 2 respiradouros ('l' = w2_air_bubble). Ao entrar, uma
//   cortina de fios escuros fecha o túnel (o Tico fica preso no x da arena).
// Chefe 'boss_whale' (Enemy, boss=true, ~27 PV × poder):
//   Corpo de vidro (globo de neve com brinquedos engolidos) com 4 PLACAS de tecido
//   escuro costuradas pelo Costureiro. O vidro é duro: o chicote só fere as
//   RACHADURAS que ficam expostas quando uma placa é removida com Descosturar
//   (unstitch(player) remove a placa mais próxima do pulso; sem a habilidade, a
//   placa rasga com 5 chicotadas). Janelas: quando ela passa perto nadando e,
//   principalmente, quando fica ATORDOADA (após investida na parede / pancada).
//   Fase 1: cruzeiros lentos, anéis de energia (boca acende antes), INVESTIDA
//           telegrafada (faixa tracejada) → bate na parede → atordoada 2,8 s.
//   Fase 2 (≤66%): o Costureiro recostura as placas. REDEMOINHO (puxa o Tico
//           para ela) + chuva de cacos de vidro (coluna/sombra de aviso),
//           PANCADA: sobe, sombra no chão, mergulha → ondas no chão + atordoada.
//   Fase 3 (≤33%): ESCURIDÃO (só a baleia brilha), tudo mais rápido.
//   FINAL: 0 PV → o vidro racha inteiro e liberta os brinquedos (os marujos da
//          Capitã Bolha) → cutscene 'boss2_defeat' (revelação, mem_4, Mundo 3).
// Justiça: o corpo é SÓLIDO para o Tico (empurra para fora — a esquiva não o
// atravessa) e encostar nele fere (inclusive em cima); não dá para pisar nela.
// Só quando atordoada o contato é seguro (dá para pousar e bater nas rachaduras).
// Cutscenes: 'boss2_intro' (ao entrar na arena; versão curta nas tentativas),
//            'boss2_defeat'.
// Arte 100% procedural (sprite 'whale_body': 'swim' com brinquedos, 'free' vazio).
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, clamp, lerp, rand, damp, rectsOverlap, makeRng } from '../../engine/util.js';
import { T as TT, moveBody } from '../../engine/tilemap.js';
import { defineSprite, drawSprite, getSprite, hasSprite, animFrame } from '../../engine/sprites.js';
import { audio, registerSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { R, registerEntity, registerLevel, registerCutscene, makeScene } from '../registry.js';
import { getStats } from '../stats.js';
import { Enemy, EnemyProjectile } from '../enemies/base.js';
import { spawnShockwave, spawnFloatingText, drawGlow } from '../art/vfx.js';

// ----------------------------------------------------------------- geometria
const T = TILE;
const MW = 104, MH = 24;
const AX0 = 73 * T, AX1 = 101 * T;          // interior da arena (px)
const ATOP = 6 * T, AFLOOR = 20 * T;        // teto / chão da arena
const ACX = (AX0 + AX1) / 2, ACY = (ATOP + AFLOOR) / 2;
const LOCK = { x: AX0 - 16, y: ATOP - 16, w: AX1 - AX0 + 32, h: AFLOOR - ATOP + 32 };
const HW = 64, HH = 24;                     // meia-caixa do corpo
const XMIN = AX0 + HW + 2, XMAX = AX1 - HW - 2, YMIN = ATOP + HH + 6, YMAX = AFLOOR - HH - 2;
const LANES = [ATOP + 46, ACY, AFLOOR - 42];
const TUNNEL = { x: 70 * T, y: 13 * T, h: 4 * T };

// ----------------------------------------------------------------- paleta
const OUTL = '#0d2a48', GLASS_HI = '#c0f4ff', GLASS_LO = '#2a70a8', CYAN = '#9fe8ff';
const FAB = ['#1e1430', '#2e2048', '#44306a'], STITCH = '#b97aff', VIOLET = '#c070ff';
const Rn = Math.round;

// ----------------------------------------------------------------- sons
registerSfx('whale_song', [
  { wave: 'sine', freq: 196, freqEnd: 294, dur: 1.5, vol: 0.2, attack: 0.35 },
  { wave: 'sine', freq: 98, freqEnd: 147, dur: 1.5, vol: 0.14, attack: 0.45 },
  { wave: 'triangle', freq: 588, freqEnd: 440, dur: 1.2, vol: 0.04, attack: 0.5 },
]);
registerSfx('whale_ring', [
  { wave: 'sine', freq: 880, freqEnd: 440, dur: 0.35, vol: 0.12 },
  { wave: 'triangle', freq: 1320, freqEnd: 990, dur: 0.25, vol: 0.05 },
]);
registerSfx('whale_shard', [
  { wave: 'noise', freq: 4000, dur: 0.22, vol: 0.12, filter: { type: 'highpass', freq: 2800 } },
  { wave: 'sine', freq: 2100, freqEnd: 2600, dur: 0.12, vol: 0.05 },
]);

// =============================================================================
// ARTE — sprite da baleia (pixel a pixel: máscara → vidro translúcido)
// =============================================================================
const SW = 200, SH = 104, BX = 104, BY = 50;   // quadro e centro da caixa no quadro
function hexA(c, a) {
  const n = parseInt(c.slice(1), 16);
  return (((a & 255) << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
}
function mixA(c1, c2, t, a) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const A = p(c1), B = p(c2);
  const r = Rn(lerp(A[0], B[0], t)), g = Rn(lerp(A[1], B[1], t)), b = Rn(lerp(A[2], B[2], t));
  return (((a & 255) << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
function paintWhale(pc, anim, f) {
  const empty = anim === 'free';
  const fb = [0, -3, -1, 3][f], fin = [0, 1, 2, 1][f];
  const M = (lx, ly) => [BX + lx, BY + ly];
  const C = '#ff00ff';
  // ---- 1) máscara
  pc.ellipse(BX + 24, BY - 2, 40, 28, C);                    // cabeça
  pc.ellipse(BX - 24, BY + 2, 40, 23, C);                    // corpo
  pc.ellipse(BX + 16, BY + 10, 42, 18, C);                   // papo / mandíbula
  pc.poly([M(-58, -12), M(-58, 16), M(-84, 6), M(-84, -2)], C);              // pedúnculo
  pc.poly([M(-80, -1), M(-90, -10 + fb), M(-102, -17 + fb), M(-94, -2 + fb), M(-84, 4)], C);   // nadadeira caudal
  pc.poly([M(-80, 5), M(-84, 0), M(-94, 6 + fb), M(-102, 21 + fb), M(-90, 14 + fb)], C);
  pc.poly([M(2, 14), M(18, 15), M(-4, 34 + fin), M(-12, 31 + fin)], C);       // nadadeira peitoral
  pc.poly([M(-48, -16), M(-36, -18), M(-50, -25)], C);                       // dorsal
  // ---- 2) vidro
  const W = pc.w, H = pc.h, buf = pc.buf;
  const inM = new Uint8Array(W * H);
  let top = H, bot = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[y * W + x] >>> 24) { inM[y * W + x] = 1; top = Math.min(top, y); bot = Math.max(bot, y); }
  const isIn = (x, y) => x >= 0 && y >= 0 && x < W && y < H && inM[y * W + x] === 1;
  const edge = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isIn(x, y)) continue;
    const i = y * W + x;
    if (!isIn(x, y - 1) || !isIn(x, y + 1) || !isIn(x - 1, y) || !isIn(x + 1, y)) { buf[i] = hexA(OUTL, 255); edge[i] = 1; continue; }
    if (!isIn(x, y - 2) || !isIn(x - 2, y) || !isIn(x - 1, y - 2)) { buf[i] = hexA('#e8feff', 215); continue; }
    if (!isIn(x, y + 2) || !isIn(x + 2, y)) { buf[i] = hexA('#3d9ccc', 200); continue; }
    const t = (y - top) / Math.max(1, bot - top);
    buf[i] = mixA(GLASS_HI, GLASS_LO, t, Rn(70 + t * 70));
  }
  const inner = (x, y) => isIn(x, y) && !edge[y * W + x];
  const mpx = (x, y, c) => { x = Rn(x); y = Rn(y); if (inner(x, y)) pc.px(x, y, c); };
  // pregas do papo
  for (let k = 0; k < 4; k++) for (let lx = -4; lx <= 54; lx++) {
    const ly = 15 + k * 3 - (lx / 54) * 6;
    mpx(BX + lx, BY + ly, '#ffffff40'); mpx(BX + lx, BY + ly + 1, '#10406a40');
  }
  // ---- 3) brinquedos engolidos (cores já "vistas através do vidro")
  if (!empty) {
    const toy = (x, y) => [BX + x, BY + y];
    // bola de praia
    const [bx, by] = toy(-30, 4);
    pc.circle(bx, by, 6, '#e8607ae0'); pc.ellipse(bx, by, 2, 6, '#f4f0ffe0'); pc.ellipse(bx, by, 6, 1.5, '#5a8ae8e0'); pc.px(bx - 2, by - 3, '#ffffff');
    // patinho
    const [dx, dy] = toy(-8, 12);
    pc.ellipse(dx, dy, 5, 3.5, '#f0d860e0'); pc.circle(dx + 4, dy - 4, 2.6, '#f0d860e0'); pc.rect(dx + 6, dy - 4, 2, 1, '#f09040'); pc.px(dx + 4, dy - 5, '#20304a');
    // barquinho
    const [kx, ky] = toy(8, -12);
    pc.poly([[kx - 7, ky], [kx + 7, ky], [kx + 4, ky + 4], [kx - 4, ky + 4]], '#a8704ae0');
    pc.rect(kx, ky - 9, 1, 9, '#6a4a34'); pc.tri(kx + 1, ky - 8, kx + 1, ky - 1, kx + 6, ky - 1, '#f4f0e0e0');
    // ursinho
    const [ux, uy] = toy(-46, -4);
    pc.circle(ux - 3, uy - 4, 2, '#b08060e0'); pc.circle(ux + 3, uy - 4, 2, '#b08060e0'); pc.circle(ux, uy, 4, '#c09070e0');
    pc.px(ux - 1, uy - 1, '#20304a'); pc.px(ux + 1, uy - 1, '#20304a'); pc.px(ux, uy + 1, '#5a3a2a');
    // bloco "A"
    const [ax, ay] = toy(-20, -12);
    pc.rect(ax - 3, ay - 3, 7, 7, '#e8a040e0'); pc.rect(ax - 1, ay - 1, 3, 1, '#7a3a20'); pc.rect(ax - 1, ay, 1, 2, '#7a3a20'); pc.rect(ax + 1, ay, 1, 2, '#7a3a20');
    // os 3 marujos da Capitã Bolha
    for (const [mx, my] of [[24, 8], [33, 13], [41, 4]]) {
      const [x, y] = toy(mx, my);
      pc.ellipse(x, y + 2, 3, 3.5, '#4a7fe0e8'); pc.circle(x, y - 3, 2.4, '#ffd2b0e8'); pc.rect(x - 3, y - 6, 6, 1, '#ffffff'); pc.px(x, y - 3, '#20304a');
    }
    // estrelinha
    const [sx, sy] = toy(-2, -16);
    pc.poly([[sx, sy - 3], [sx + 1, sy - 1], [sx + 3, sy - 1], [sx + 1, sy + 1], [sx + 2, sy + 3], [sx, sy + 2], [sx - 2, sy + 3], [sx - 1, sy + 1], [sx - 3, sy - 1], [sx - 1, sy - 1]], '#ffe070e0');
    // película de vidro por cima dos brinquedos
    for (let y = BY - 22; y < BY + 22; y++) for (let x = BX - 54; x < BX + 48; x++) if (inner(x, y) && (y + x) % 3 === 0) pc.px(x, y, '#9fe8ff22');
  }
  // ---- 4) neve, brilhos, boca, olho
  const rng = makeRng(empty ? 7 : 3);
  for (let i = 0; i < 46; i++) mpx(BX + rng.range(-70, 58), BY + rng.range(-26, 24), rng.chance(0.3) ? '#ffffffd0' : '#ffffff70');
  for (let a = 3.45; a < 4.45; a += 0.02) { const x = BX + 24 + Math.cos(a) * 33, y = BY - 2 + Math.sin(a) * 21; mpx(x, y, '#ffffffc0'); mpx(x + 1, y + 1, '#ffffff60'); }
  for (let a = 3.6; a < 4.3; a += 0.03) mpx(BX - 24 + Math.cos(a) * 32, BY + 2 + Math.sin(a) * 16, '#ffffff90');
  mpx(BX + 6, BY - 21, '#ffffff'); mpx(BX + 8, BY - 22, '#ffffff'); mpx(BX - 40, BY - 12, '#ffffff');
  for (let lx = 10; lx <= 62; lx++) { const ly = Rn(4 + ((62 - lx) / 52) * 5 + Math.sin(lx * 0.15) * 0.6); if (isIn(BX + lx, BY + ly)) pc.px(BX + lx, BY + ly, OUTL); }
  pc.ellipseOutline(BX + 34, BY - 4, 4, 3, '#0d2a48c0');
  // contorno interno da nadadeira
  pc.line(BX + 2, BY + 16, BX - 8, BY + 30 + fin, '#0d2a4870');
}
defineSprite('whale_body', {
  w: SW, h: SH, ox: BX, oy: BY,
  anims: { swim: { frames: 4, fps: 5 }, free: { frames: 4, fps: 4 } },
  draw: paintWhale,
});

// ----------------------------------------------------------------- utilidades de desenho
const shadowCol = (a) => `rgba(4,10,24,${a})`;
function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); ctx.fillRect(Rn(cx - w), Rn(cy + y), w * 2 + 1, 1); }
}
function jag(ctx, x0, y0, x1, y1, color, seed) {
  const n = 4, dx = (x1 - x0) / n, dy = (y1 - y0) / n;
  ctx.fillStyle = color;
  let px = x0, py = y0;
  for (let i = 1; i <= n; i++) {
    const nx = x0 + dx * i + (i < n ? Math.sin(seed * 7 + i * 3.1) * 2 : 0), ny = y0 + dy * i + (i < n ? Math.cos(seed * 5 + i * 2.3) * 2 : 0);
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - px, ny - py)));
    for (let s = 0; s <= steps; s++) ctx.fillRect(Rn(lerp(px, nx, s / steps)), Rn(lerp(py, ny, s / steps)), 1, 1);
    px = nx; py = ny;
  }
}

// =============================================================================
// PROJÉTEIS / PERIGOS
// =============================================================================
/** Anel de energia (refletível com o Remendo Temporal). */
class WhaleRing extends EnemyProjectile {
  constructor(level, x, y, props = {}) {
    super(level, x, y, { w: 12, h: 12, life: 5, color: CYAN, reflectable: true, ...props });
    this.light = { r: 20, color: CYAN, i: 0.7 };
  }
  draw(ctx) {
    const cx = Rn(this.cx), cy = Rn(this.cy), r = 5 + Math.round(Math.sin(this.t * 14));
    const col = this.reflected ? '#8ff0ff' : '#c8fcff';
    drawGlow(ctx, cx, cy, 11, this.reflected ? '#8ff0ff' : '#7fd8ff', 0.45);
    ctx.fillStyle = col;
    for (let a = 0; a < 16; a++) { const an = (a / 16) * Math.PI * 2; ctx.fillRect(Rn(cx + Math.cos(an) * r), Rn(cy + Math.sin(an) * r), 1, 1); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}
registerEntity('whale_ring', WhaleRing);

/** Caco de vidro: aviso (coluna + sombra) e queda. */
class WhaleShard extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 8; this.h = 14; this.x = x - 4; this.y = ATOP - 6;
    this.warn = props.warn ?? 0.95; this.vy = 0; this.z = 45; this.alwaysUpdate = true;
    this.enemy = false; this.contactDamage = 1;
    // onde vai bater: primeiro sólido/vazado abaixo do teto
    let fy = ATOP + 2;
    while (fy < AFLOOR + 4 && !level.map.solidAt(x, fy) && level.map.at(x, fy) !== TT.ONEWAY) fy += 2;
    this.floorY = fy;
  }
  update(dt) {
    this.t += dt;
    if (this.t < this.warn) return;
    if (!this.enemy) { this.enemy = true; audio.sfx('whale_shard', { cooldown: 0.08 }); }
    this.vy = Math.min(320, this.vy + 900 * dt);
    this.y += this.vy * dt;
    if (this.bottom >= this.floorY) {
      this.level.particles.emit('hit', this.cx, this.floorY - 2, 6, { colors: [CYAN, '#ffffff', '#c8fcff'] });
      this.level.particles.emit('bubble', this.cx, this.floorY - 4, 3);
      audio.sfx('glass_crack', { vol: 0.35, randomPitch: 0.2, cooldown: 0.06 });
      this.remove();
    }
  }
  onTouchPlayer() {}
  draw(ctx) {
    const x = Rn(this.cx);
    if (this.t < this.warn) {
      const k = this.t / this.warn, blink = Math.floor(this.t * 12) % 2 === 0;
      ctx.fillStyle = `rgba(200,252,255,${0.08 + k * 0.14})`;
      ctx.fillRect(x - 3, ATOP, 6, this.floorY - ATOP);
      ctx.fillStyle = `rgba(255,255,255,${blink ? 0.5 : 0.25})`;
      for (let y = ATOP + ((this.t * 60) | 0) % 8; y < this.floorY; y += 8) ctx.fillRect(x, y, 1, 3);
      fillEllipse(ctx, x, this.floorY - 1, Rn(3 + k * 4), 1, shadowCol(0.35 + k * 0.35));
      jag(ctx, x - 5, ATOP + 1, x + 5, ATOP + 3, '#e8feff', x);
      return;
    }
    const y = Rn(this.y);
    ctx.fillStyle = OUTL;
    ctx.fillRect(x - 3, y, 7, 6); ctx.fillRect(x - 2, y + 6, 5, 4); ctx.fillRect(x - 1, y + 10, 3, 4);
    ctx.fillStyle = '#9fe8ff'; ctx.fillRect(x - 2, y + 1, 5, 5); ctx.fillRect(x - 1, y + 6, 3, 4); ctx.fillRect(x, y + 10, 1, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y + 1, 1, 6);
  }
}
registerEntity('whale_shard', WhaleShard);

/** Onda no chão depois da pancada. */
class WhaleWave extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 14; this.h = 14; this.x = x - 7; this.y = AFLOOR - 14;
    this.vx = props.vx || 150; this.enemy = true; this.contactDamage = 1; this.z = 44; this.alwaysUpdate = true;
  }
  update(dt) {
    this.t += dt; this.x += this.vx * dt;
    if (Math.random() < 0.5) this.level.particles.emit('bubble', this.cx, this.y + 4, 1);
    if (this.x < AX0 - 4 || this.right > AX1 + 4 || this.t > 4) this.remove();
  }
  onTouchPlayer() {}
  draw(ctx) {
    const x = Rn(this.x), b = AFLOOR, d = Math.sign(this.vx);
    for (let i = 0; i < 14; i++) {
      const h = Rn(Math.sin((i / 13) * Math.PI) * 12 + 2);
      ctx.fillStyle = i % 3 === 0 ? '#e8feff' : '#7fd8ff';
      ctx.fillRect(d > 0 ? x + i : x + 13 - i, b - h, 1, h);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + (d > 0 ? 9 : 4), b - 13, 2, 1);
  }
}
registerEntity('whale_wave', WhaleWave);

// =============================================================================
// O CHEFE
// =============================================================================
const SLOTS = [[-22, -20], [22, -26], [0, 23], [-54, 2]];   // placas (local, olhando à direita)
const PATTERNS = {
  1: ['cruise_rings', 'charge', 'cruise', 'charge'],
  2: ['vortex', 'slam', 'cruise_rings', 'charge'],
  3: ['charge', 'vortex', 'slam', 'cruise_rings', 'slam', 'charge'],
};
const FIGHT = new Set(['idle', 'cruise', 'ringwind', 'ringpost', 'chargeprep', 'chargewind', 'charge', 'stunned',
  'recover', 'vortexprep', 'vortex', 'rise', 'slamwind', 'slam', 'slammed']);
const STUN = new Set(['stunned', 'slammed']);

class WhaleBoss extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.boss = true; this.bossName = 'A Baleia de Vidro';
    this.bindable = false; this.stompable = false; this.flying = true;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 30;
    this.w = HW * 2; this.h = HH * 2;
    this.place(ACX + 60, ACY);
    this.maxHp = this.hp = Math.max(18, Math.round(27 * (getStats().power || 1)));
    this.drops = { buttons: 0 };
    this.phase = 1; this.state = 'dormant'; this.st = 0; this.qi = 0; this.pending = 0;
    this.facing = -1; this.rot = 0; this.alpha = 0; this.eyeK = 0; this.ready = false;
    this.slots = SLOTS.map(([lx, ly]) => ({ lx, ly, patched: true, sewK: 1, hp: 5 }));
    this.cracks = [];
    const rng = makeRng(42);
    for (let i = 0; i < 12; i++) {
      const lx = rng.range(-56, 52), ly = rng.range(-18, 18), a = rng.range(0, Math.PI * 2), l = rng.range(8, 18);
      this.cracks.push({ x0: lx, y0: ly, x1: lx + Math.cos(a) * l, y1: ly + Math.sin(a) * l * 0.6, s: i });
    }
    this.shatterK = 0; this.freed = false; this.hintCd = 0; this.darkT = props.dark ?? 0.15;
    this.setActive(false);
  }
  setActive(on) { this.hittable = on; this.contact = on; this.enemy = on; }
  get fighting() { return FIGHT.has(this.state); }
  get stunned() { return STUN.has(this.state); }
  get spd() { return [1, 1, 1.12, 1.3][this.phase]; }
  get tele() { return [1, 1, 0.9, 0.78][this.phase]; }
  place(cx, cy) { this.x = cx - this.w / 2; this.y = cy - this.h / 2; }
  go(s) {
    this.state = s; this.st = 0; this.fired = 0;
    this.contact = this.enemy = FIGHT.has(s) && !STUN.has(s);
    this.hittable = FIGHT.has(s);
  }
  /** Ponto local (olhando à direita) → mundo, com espelho e rotação. */
  world(lx, ly) {
    const f = this.facing, c = Math.cos(this.rot), s = Math.sin(this.rot), x = lx * f;
    return { x: this.cx + x * c - ly * s, y: this.cy + x * s + ly * c };
  }

  // ---------------------------------------------------------------- entrada
  prepareEmerge() { this.go('dormant'); this.alpha = 0; this.eyeK = 0; this.facing = -1; this.place(ACX + 96, ACY + 6); }
  emerge() { this.prepareEmerge(); this.go('emerge'); audio.sfx('whale_song'); }
  finishEmerge() { this.place(ACX + 50, ACY); this.alpha = 1; this.eyeK = 1; this.ready = true; this.go('emerged'); }
  beginFight() {
    if (!this.ready) this.finishEmerge();
    const L = this.level;
    L.boss = this;
    this.light = { r: 80, color: CYAN, i: 0.55, flicker: 0.05 };
    if (save.data.abilities?.unstitch) save.data.equippedAbility = 'unstitch';
    this.go('idle'); this.idleDelay = 0.8;
    L.toast('Descosture as placas escuras e ataque as rachaduras!', 'icon_ab_unstitch');
  }

  // ---------------------------------------------------------------- dano
  die() {}
  hurt(amount = 1, src = null, opts = {}) {
    // fontes genéricas (ex.: golpe especial): só valem se houver rachadura exposta
    if (!this.fighting || this.state === 'transition') return false;
    const open = this.slots.some((s) => !s.patched);
    if (!open && !opts.crack) { this.clink(); return false; }
    return this.damage(opts.crack ? amount : amount * 0.5);
  }
  onHit(dmg, src, info = {}) {
    if (!this.fighting || this.invuln > 0) return false;
    let box = src && typeof src.attackBox === 'function' ? src.attackBox() : null;
    if (!box && src && src.w) box = { x: src.x, y: src.y, w: src.w, h: src.h };
    if (!box) return this.hurt(dmg, src);
    const pad = info.kind === 'reflect' ? 14 : 8;
    const bx = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
    let crack = null, patch = null;
    for (const s of this.slots) {
      const p = this.world(s.lx, s.ly);
      if (p.x < bx.x || p.x > bx.x + bx.w || p.y < bx.y || p.y > bx.y + bx.h) continue;
      if (!s.patched) crack = s; else if (s.sewK >= 1) patch = s;
    }
    if (crack) { this.hitSlot = crack; return this.damage(dmg); }
    if (patch) {
      const p = this.world(patch.lx, patch.ly);
      audio.sfx('armor_clink', { cooldown: 0.1 });
      this.level.particles.emit('fabric', p.x, p.y, 3, { colors: FAB });
      if (!save.data.abilities?.unstitch) {          // sem a habilidade: rasga no chicote (lento)
        patch.hp -= 1;
        if (patch.hp <= 0) this.ripSlot(patch);
        return true;
      }
      this.hint('Use Descosturar na placa!');
      return false;
    }
    this.clink(box);
    return false;
  }
  clink(box) {
    audio.sfx('armor_clink', { cooldown: 0.12, pitch: 1.4 });
    const x = box ? box.x + box.w / 2 : this.cx, y = box ? box.y + box.h / 2 : this.cy;
    this.level.particles.emit('hit', clamp(x, this.x, this.right), clamp(y, this.y, this.bottom), 2, { colors: ['#ffffff', CYAN] });
    this.hint(this.slots.some((s) => !s.patched) ? 'Mire nas rachaduras brilhantes!' : 'Vidro duro! Descosture as placas!');
  }
  hint(text) {
    if (this.hintCd > 0) return;
    this.hintCd = 3.5;
    spawnFloatingText(this.level, this.cx, this.y - 10, text, CYAN);
  }
  damage(n) {
    const L = this.level;
    const floor = this.phase === 1 ? this.maxHp * (2 / 3) : this.phase === 2 ? this.maxHp / 3 : 0;
    this.hp = Math.max(floor, this.hp - n);
    this.flash = 0.1; this.invuln = 0.08;
    const s = this.hitSlot, p = s ? this.world(s.lx, s.ly) : { x: this.cx, y: this.cy };
    this.hitSlot = null;
    audio.sfx('boss_hit', { randomPitch: 0.08 });
    audio.sfx('glass_crack', { vol: 0.4, randomPitch: 0.15, cooldown: 0.1 });
    L.particles.emit('hit', p.x, p.y, 6, { colors: [CYAN, '#ffffff', '#c8fcff'] });
    L.particles.emit('sparkle', p.x, p.y, 3);
    L.shake(0.1);
    if (n >= 1.4) L.hitstop(0.05);
    if (this.phase < 3 && this.hp <= floor + 0.001) this.pending = this.phase + 1;
    else if (this.phase === 3 && this.hp <= 0) this.defeat();
    return true;
  }
  /** Descosturar a Realidade: remove a placa mais próxima do pulso. */
  unstitch(p) {
    if (!this.fighting || !p) return false;
    const ox = p.cx + p.facing * 14, oy = p.cy - 2;
    const list = this.slots.filter((s) => s.patched && s.sewK >= 1)
      .map((s) => { const w = this.world(s.lx, s.ly); return { s, d: Math.hypot(w.x - ox, w.y - oy) }; })
      .filter((o) => o.d <= 88).sort((a, b) => a.d - b.d);
    if (!list.length) { this.hint('Chegue mais perto das placas!'); return false; }
    this.ripSlot(list[0].s);
    if (list[1] && list[1].d <= 48) this.ripSlot(list[1].s);
    return true;
  }
  ripSlot(s) {
    const L = this.level, p = this.world(s.lx, s.ly);
    s.patched = false;
    audio.sfx('unstitch_hit'); audio.sfx('glass_crack', { vol: 0.5 });
    L.particles.emit('fabric', p.x, p.y, 10, { colors: FAB });
    L.particles.emit('thread', p.x, p.y, 8, { colors: [STITCH, '#ffffff'] });
    L.particles.emit('sparkle', p.x, p.y, 6);
    spawnShockwave(L, p.x, p.y, { radius: 18, color: CYAN });
    L.shake(0.15);
    if (!this.taughtCrack) { this.taughtCrack = true; spawnFloatingText(L, p.x, p.y - 12, 'Rachadura!', CYAN); }
  }
  defeat() {
    const L = this.level;
    this.hp = 0; this.pending = 0;
    this.go('defeated');
    this.rot = 0;
    L.boss = null;
    this.setActive(false);
    this.clearHazards();
    this.darkT = 0.2;
    audio.sfx('boss_roar', { pitch: 0.55, vol: 0.7 }); audio.sfx('glass_crack');
    audio.stopMusic?.(2);
    L.shake(0.6); L.hitstop(0.15); L.flash('#e8feff', 0.25);
  }
  clearHazards() {
    for (const e of this.level.entities) if (!e.dead && (e instanceof WhaleRing || e instanceof WhaleShard || e instanceof WhaleWave)) e.remove();
  }

  // ---------------------------------------------------------------- ataques
  target() { return super.target(600) || this.level.player; }
  next() {
    const pat = PATTERNS[this.phase];
    const k = pat[this.qi++ % pat.length];
    if (k === 'cruise' || k === 'cruise_rings') {
      const t = this.target();
      this.facing = this.cx < ACX ? 1 : -1;
      this.cruiseTo = this.facing > 0 ? XMAX : XMIN;
      this.laneY = clamp((t ? t.cy : ACY) + rand(-34, 34), YMIN + 8, YMAX - 8);
      this.withRings = k === 'cruise_rings';
      this.go('cruise');
    } else if (k === 'charge') this.go('chargeprep');
    else if (k === 'vortex') this.go('vortexprep');
    else this.go('rise');
  }
  mouth() { return this.world(60, 6); }
  fireRings() {
    const L = this.level, t = this.target(), m = this.mouth();
    const n = this.phase >= 3 ? 5 : 3, spread = 0.3, sp = 82 * this.spd;
    const base = Math.atan2((t ? t.cy : m.y) - m.y, (t ? t.cx : m.x + this.facing) - m.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      L.add(new WhaleRing(L, m.x, m.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }));
    }
    audio.sfx('whale_ring');
    L.particles.emit('bubble', m.x, m.y, 6);
  }
  spawnShard(x, warn) {
    const L = this.level;
    L.add(new WhaleShard(L, clamp(x, AX0 + 6, AX1 - 6), 0, { warn: (warn ?? 0.95) * Math.max(0.8, this.tele) }));
  }
  crash(onFloor) {
    const L = this.level;
    audio.sfx('glass_crack'); audio.sfx('rumble'); audio.sfx('boss_hit', { pitch: 0.6 });
    L.shake(0.55); L.hitstop(0.08);
    L.particles.emit('bubble', this.cx + this.facing * HW, this.cy, 14);
    if (onFloor) {
      for (const d of [-1, 1]) L.add(new WhaleWave(L, this.cx + d * (HW - 6), 0, { vx: d * (150 + 40 * (this.phase - 2)) }));
      const xs = [AX0 + rand(20, 120), ACX + rand(-60, 60), AX1 - rand(20, 120)];
      xs.forEach((x, i) => this.spawnShard(x, 0.9 + i * 0.25));
    } else if (this.phase >= 2) {
      this.spawnShard(rand(AX0 + 30, AX1 - 30), 1); this.spawnShard(rand(AX0 + 30, AX1 - 30), 1.3);
    }
    if (!this.taughtStun) { this.taughtStun = true; spawnFloatingText(L, this.cx, this.y - 14, 'Tonta! Agora!', '#ffd23f'); }
    this.go(onFloor ? 'slammed' : 'stunned');
    this.stunDur = [0, 2.8, 2.4, 2.0][this.phase];
  }
  moveTo(tx, ty, k, dt) { this.place(damp(this.cx, tx, k, dt), damp(this.cy, ty, k, dt)); }

  think(dt) {
    const L = this.level, t = this.target();
    const s = this.state;
    if (this.pending && this.fighting && s !== 'slam' && s !== 'charge') { this.startTransition(); return; }
    switch (s) {
      case 'emerge': {
        const k = Math.min(1, this.st / 2.4);
        this.alpha = k; this.eyeK = clamp((this.st - 1.6) / 0.6, 0, 1);
        this.place(lerp(ACX + 96, ACX + 50, k), ACY + 6 - 6 * k + Math.sin(this.t * 1.5) * 2);
        if (this.st >= 2.4) { this.ready = true; this.go('emerged'); }
        break;
      }
      case 'emerged': case 'dormant':
        if (s === 'emerged') this.place(this.cx, ACY + Math.sin(this.t * 1.5) * 3);
        break;
      case 'idle':
        this.rot = damp(this.rot, 0, 8, dt);
        this.place(clamp(this.cx, XMIN, XMAX), damp(this.cy, clamp(this.cy, YMIN + 10, YMAX - 10), 3, dt) + Math.sin(this.t * 2) * 0.3);
        if (t && Math.abs(t.cx - this.cx) > 30) this.facing = t.cx < this.cx ? -1 : 1;
        if (this.st >= (this.idleDelay ?? 0.8)) { this.idleDelay = [0, 0.9, 0.7, 0.45][this.phase]; this.next(); }
        break;
      case 'cruise': {
        const v = 72 * this.spd;
        const nx = this.cx + this.facing * v * dt;
        this.place(nx, damp(this.cy, this.laneY + Math.sin(this.t * 2.2) * 6, 2.5, dt));
        if (this.withRings && !this.ringsDone && Math.abs(this.cx - ACX) < 20) { this.ringsDone = true; this.go('ringwind'); break; }
        if ((this.facing > 0 && this.cx >= this.cruiseTo) || (this.facing < 0 && this.cx <= this.cruiseTo)) {
          this.place(clamp(this.cx, XMIN, XMAX), this.cy); this.ringsDone = false; this.go('idle');
        }
        break;
      }
      case 'ringwind':
        if (t) this.facing = t.cx < this.cx ? -1 : 1;
        if (this.st >= 0.85 * this.tele) { this.fireRings(); this.go('ringpost'); }
        break;
      case 'ringpost':
        if (this.st >= 0.5) {
          this.facing = this.cruiseTo > this.cx ? 1 : -1;
          this.state = 'cruise'; this.st = 0; this.contact = this.enemy = true;
        }
        break;
      case 'chargeprep': {
        if (this.st === 0 || !this.side) this.side = t && t.cx > ACX ? -1 : 1;   // vai para o lado oposto ao Tico
        const tx = this.side < 0 ? XMIN : XMAX;
        this.facing = this.side < 0 ? 1 : -1;
        this.moveTo(tx, clamp(t ? t.cy : ACY, YMIN, YMAX), 3.2, dt);
        if (Math.abs(this.cx - tx) < 4 || this.st > 1.6) { this.place(tx, this.cy); this.side = 0; this.go('chargewind'); }
        break;
      }
      case 'chargewind': {
        const dur = 1.0 * this.tele;
        if (this.st < dur * 0.7 && t) this.laneY = clamp(t.cy, YMIN, YMAX);
        const back = (this.facing > 0 ? XMIN : XMAX) - this.facing * Math.min(1, this.st / dur) * 10;
        this.place(back, damp(this.cy, this.laneY, 8, dt));
        this.rot = Math.sin(this.st * 40) * 0.02;
        if (this.st >= dur) { this.rot = 0; this.place(this.cx, this.laneY); audio.sfx('whoosh'); audio.sfx('whale_song', { pitch: 1.4, vol: 0.6 }); this.go('charge'); }
        break;
      }
      case 'charge': {
        const nx = this.cx + this.facing * 330 * this.spd * dt;
        this.place(nx, this.cy);
        if (Math.random() < 0.7) L.particles.emit('bubble', this.cx - this.facing * HW, this.cy + rand(-10, 10), 1);
        if (this.facing > 0 ? this.cx >= XMAX + 1 : this.cx <= XMIN - 1) { this.place(this.facing > 0 ? XMAX + 1 : XMIN - 1, this.cy); this.crash(false); }
        break;
      }
      case 'stunned':
        this.place(this.cx, Math.min(YMAX, this.cy + 10 * dt));
        this.rot = Math.sin(this.t * 3) * 0.05;
        if (this.st >= this.stunDur) this.go('recover');
        break;
      case 'slammed':
        this.rot = damp(this.rot, 0, 6, dt);
        if (this.st >= this.stunDur) this.go('recover');
        break;
      case 'recover':
        this.rot = damp(this.rot, 0, 6, dt);
        this.moveTo(clamp(this.cx, XMIN + 10, XMAX - 10), clamp(this.cy, YMIN + 20, YMAX - 30), 3, dt);
        if (this.st >= 0.7) { this.idleDelay = 0.4; this.go('idle'); }
        break;
      case 'vortexprep':
        this.moveTo(ACX, ACY, 3, dt);
        if (this.st >= 0.9) { audio.sfx('current'); audio.sfx('whale_song', { pitch: 0.8 }); this.go('vortex'); this.nextShard = 0.4; }
        break;
      case 'vortex': {
        const dur = 3.8;
        this.place(ACX + Math.sin(this.st * 2.2) * 8, ACY + Math.cos(this.st * 1.7) * 5);
        if (Math.floor(this.st * 1.4) !== Math.floor((this.st - dt) * 1.4)) this.facing *= -1;
        const p = L.player;
        if (p && p.state !== 'dead' && p.inWater) {
          const dx = this.cx - p.cx, dy = this.cy - p.cy, d = Math.hypot(dx, dy) || 1;
          const pull = (this.phase >= 3 ? 300 : 260) * clamp(1.15 - d / 360, 0.35, 1);
          p.addForce((dx / d) * pull + (-dy / d) * 120, (dy / d) * pull + (dx / d) * 120);
        }
        if (Math.random() < 0.6) {
          const a = this.t * 5 + Math.random() * 6, r = rand(70, 150);
          L.particles.emit('bubble', this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r * 0.6, 1);
        }
        this.nextShard -= dt;
        if (this.nextShard <= 0 && this.st < dur - 0.6) {
          this.fired++;
          this.nextShard = this.phase >= 3 ? 0.45 : 0.6;
          this.spawnShard(this.fired % 3 === 0 && p ? p.cx : rand(AX0 + 16, AX1 - 16));
        }
        if (this.st >= dur) this.go('idle');
        break;
      }
      case 'rise': {
        const tx = clamp(t ? t.cx : ACX, XMIN, XMAX);
        this.moveTo(tx, YMIN, 3.5, dt);
        if (t) this.facing = t.cx < this.cx ? -1 : 1;
        if (this.st >= 0.9) this.go('slamwind');
        break;
      }
      case 'slamwind': {
        const dur = 1.0 * this.tele;
        if (this.st < dur * 0.5 && t) this.place(damp(this.cx, clamp(t.cx, XMIN, XMAX), 2.5, dt), YMIN + Math.sin(this.st * 30) * 1);
        this.rot = damp(this.rot, 0.28 * this.facing, 6, dt);
        if (this.st >= dur) { this.vy = 60; audio.sfx('whoosh', { pitch: 0.7 }); this.go('slam'); }
        break;
      }
      case 'slam':
        this.vy = Math.min(460, this.vy + 1100 * dt);
        this.place(this.cx, this.cy + this.vy * dt);
        if (this.bottom >= AFLOOR) { this.place(this.cx, AFLOOR - HH); this.crash(true); }
        break;
      case 'transition': this.updateTransition(dt); break;
      case 'defeated':
        this.moveTo(ACX, ACY - 10, 1.2, dt);
        this.rot = damp(this.rot, Math.sin(this.t * 1.3) * 0.06, 3, dt);
        if (!this.csStarted && this.st >= 1.4) {
          this.csStarted = true;
          L.cutscene('boss2_defeat', { boss: this });
        }
        break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- troca de fase
  startTransition() {
    const L = this.level;
    this.clearHazards();
    this.go('transition');
    this.contact = this.enemy = false; this.hittable = false;
    this.rot = 0; this.newPhase = this.pending; this.pending = 0;
    audio.sfx('boss_roar', { pitch: 0.6 }); audio.sfx('whale_song', { pitch: 0.7 });
    L.shake(0.4); L.flash(VIOLET, 0.2);
    spawnFloatingText(L, this.cx, this.y - 14, 'O Costureiro a remenda!', VIOLET);
    this.slots.forEach((s, i) => { s.sewDelay = 0.9 + i * 0.3; });
  }
  updateTransition(dt) {
    const L = this.level;
    this.moveTo(ACX, ACY, 2.5, dt);
    for (const s of this.slots) {
      if (this.st < s.sewDelay) continue;
      if (s.patched === false) { s.patched = true; s.sewK = 0; s.hp = 5; audio.sfx('stitch_connect', { pitch: 0.7 }); }
      if (s.sewK < 1) {
        s.sewK = Math.min(1, s.sewK + dt * 2.2);
        if (s.sewK >= 1) { const p = this.world(s.lx, s.ly); L.particles.emit('thread', p.x, p.y, 5, { colors: [STITCH, '#ffffff'] }); }
      }
    }
    if (this.st >= 2.8) {
      this.phase = this.newPhase;
      for (const s of this.slots) { s.patched = true; s.sewK = 1; }
      if (this.phase === 3) { this.darkT = 0.84; this.light = { r: 110, color: CYAN, i: 0.95, flicker: 0.05 }; L.toast('A luz se apagou... siga o brilho da baleia!', 'icon_memory'); }
      L.spawn('heart', ACX - 8, AFLOOR - 20);
      this.idleDelay = 0.6; this.qi = 0;
      this.go('idle');
    }
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    this.tickTimers(dt);
    this.st += dt;
    if (this.hintCd > 0) this.hintCd -= dt;
    this.think(dt);
    const L = this.level;
    if (L.data && typeof L.data.darkness === 'number') L.data.darkness = damp(L.data.darkness, this.darkT, 1.5, dt);
    if (this.fighting || this.state === 'transition') this.solidVsPlayer();
  }
  /** Corpo sólido: empurra o Tico para fora (a esquiva não atravessa) e fere ao encostar. */
  solidVsPlayer() {
    const L = this.level, p = L.player;
    if (!p || p.state === 'dead' || !rectsOverlap(p, this)) return;
    if (this.contact && !(p.invuln > 0)) p.hurt(1, this);
    const opts = [
      { dx: this.x - p.right, dy: 0 }, { dx: this.right - p.x, dy: 0 },
      { dx: 0, dy: this.y - p.bottom }, { dx: 0, dy: this.bottom - p.y },
    ].sort((a, b) => Math.abs(a.dx + a.dy) - Math.abs(b.dx + b.dy));
    for (const o of opts) {
      moveBody(p, o.dx, o.dy, L, {});
      if (o.dx < 0 && p.vx > 0) p.vx = -40; if (o.dx > 0 && p.vx < 0) p.vx = 40;
      if (o.dy < 0 && p.vy > 0) p.vy = this.contact ? -120 : 0; if (o.dy > 0 && p.vy < 0) p.vy = 0;
      if (!rectsOverlap(p, this)) break;
    }
    if (p.state === 'dash') { p.state = 'normal'; p.dashT = 0; }
  }

  // ---------------------------------------------------------------- desenho
  draw(ctx) {
    if (this.alpha <= 0.01) return;
    const t = this.t, s = this.state, f = this.facing;
    // telegrafias
    if (s === 'chargewind') {
      const k = this.st / (1.0 * this.tele), blink = Math.floor(this.st * 14) % 2 === 0;
      const y0 = Rn(this.laneY - HH), y1 = Rn(this.laneY + HH);
      ctx.fillStyle = `rgba(255,120,150,${0.05 + k * 0.1})`; ctx.fillRect(AX0, y0, AX1 - AX0, y1 - y0);
      ctx.fillStyle = blink ? 'rgba(255,170,190,0.75)' : 'rgba(255,170,190,0.4)';
      for (let x = AX0 + ((this.st * 90) | 0) % 10; x < AX1; x += 10) { ctx.fillRect(x, y0, 5, 1); ctx.fillRect(x, y1, 5, 1); }
      for (let i = 0; i < 3; i++) {
        const cx = Rn(this.cx + f * (HW + 22 + i * 16 + ((this.st * 40) % 16))), cy = Rn(this.laneY);
        ctx.fillStyle = 'rgba(255,200,215,0.7)';
        for (let j = 0; j < 5; j++) { ctx.fillRect(cx - f * j, cy - j, 1, 1); ctx.fillRect(cx - f * j, cy + j, 1, 1); }
      }
    }
    if (s === 'slamwind' || s === 'rise' || s === 'slam') {
      const k = s === 'slam' ? 1 : s === 'rise' ? 0.3 : Math.min(1, this.st / (1.0 * this.tele));
      fillEllipse(ctx, this.cx, AFLOOR - 2, Rn(HW * (0.6 + 0.4 * k)), 3, shadowCol(0.2 + 0.4 * k));
      if (s === 'slamwind' && Math.floor(this.st * 12) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,170,190,0.5)';
        for (let y = this.bottom + 4; y < AFLOOR - 4; y += 6) { ctx.fillRect(Rn(this.x), y, 1, 3); ctx.fillRect(Rn(this.right - 1), y, 1, 3); }
      }
    }
    if (s === 'vortex' || s === 'vortexprep') {
      const k = s === 'vortex' ? Math.min(1, this.st / 0.5) : 0.25;
      for (let ring = 0; ring < 3; ring++) {
        const r = 90 + ring * 40;
        for (let i = 0; i < 10; i++) {
          const a = t * (2.4 - ring * 0.5) + (i / 10) * Math.PI * 2 + ring;
          for (let j = 0; j < 6; j++) {
            const aa = a - j * 0.05;
            ctx.fillStyle = `rgba(200,252,255,${(0.35 - j * 0.05) * k})`;
            ctx.fillRect(Rn(this.cx + Math.cos(aa) * r), Rn(this.cy + Math.sin(aa) * r * 0.55), 2, 1);
          }
        }
      }
    }
    // corpo
    const glowA = (this.phase >= 3 ? 0.55 : 0.35) * this.alpha;
    drawGlow(ctx, Rn(this.cx), Rn(this.cy), 90, this.freed ? '#bff6ff' : '#5ac8f0', glowA);
    const anim = this.freed ? 'free' : 'swim';
    const fr = animFrame('whale_body', anim, t * (s === 'charge' ? 2.5 : s === 'vortex' ? 2 : 1));
    drawSprite(ctx, 'whale_body', anim, fr, Rn(this.cx), Rn(this.cy), {
      flip: f < 0, rotation: this.rot, alpha: this.alpha * (this.freed ? 0.85 : 1),
      variant: this.flash > 0 ? 'flash' : undefined,
    });
    // neve viva dentro do globo
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 9; i++) {
      const lx = -52 + ((i * 37) % 100), ly = -14 + ((i * 13 + t * (5 + (i % 3) * 2)) % 30);
      const p = this.world(lx + Math.sin(t + i) * 2, ly);
      ctx.fillRect(Rn(p.x), Rn(p.y), 1, 1);
    }
    // rachaduras de dano
    const dmgK = this.freed ? 0 : this.state === 'defeated' ? 1 : 1 - this.hp / this.maxHp;
    const nCr = Math.floor(dmgK * this.cracks.length + this.shatterK * 4);
    for (let i = 0; i < Math.min(this.cracks.length, nCr); i++) {
      const c = this.cracks[i], a = this.world(c.x0, c.y0), b = this.world(c.x1, c.y1);
      jag(ctx, a.x, a.y, b.x, b.y, i % 2 ? '#e8feff' : '#bff6ff', c.s);
    }
    if (this.shatterK > 0) {
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * Math.PI * 2, l = 20 + this.shatterK * 50;
        const a = this.world(0, 0), b = this.world(Math.cos(an) * l, Math.sin(an) * l * 0.45);
        jag(ctx, a.x, a.y, b.x, b.y, '#ffffff', i + 3);
      }
    }
    // placas / rachaduras expostas
    if (!this.freed) for (const sl of this.slots) this.drawSlot(ctx, sl);
    // olho
    const e = this.world(34, -4);
    if (this.eyeK > 0) {
      const ex = Rn(e.x), ey = Rn(e.y);
      if (this.stunned) {
        ctx.fillStyle = '#ffffff';
        for (let i = -2; i <= 2; i++) { ctx.fillRect(ex + i, ey + i, 1, 1); ctx.fillRect(ex + i, ey - i, 1, 1); }
        for (let i = 0; i < 3; i++) {
          const a = t * 4 + i * 2.1;
          ctx.fillStyle = i % 2 ? '#ffd23f' : '#ffffff';
          ctx.fillRect(Rn(this.cx + f * 20 + Math.cos(a) * 18), Rn(this.y - 8 + Math.sin(a) * 4), 2, 2);
        }
      } else {
        const calm = this.freed || s === 'defeated';
        drawGlow(ctx, ex, ey, 9, calm ? CYAN : VIOLET, 0.55 * this.eyeK);
        ctx.fillStyle = calm ? '#e8feff' : '#e0b0ff'; ctx.fillRect(ex - 1, ey - 1, 3, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(ex - 1 + (f > 0 ? 1 : 0), ey - 1, 1, 1);
        if (!calm && (s === 'chargewind' || s === 'slamwind')) { ctx.fillStyle = '#ff9ab4'; ctx.fillRect(ex - 2, ey - 3, 5, 1); }
      }
    }
    // boca acendendo (anéis)
    if (s === 'ringwind') {
      const m = this.mouth(), k = this.st / (0.85 * this.tele);
      drawGlow(ctx, Rn(m.x), Rn(m.y), Rn(6 + k * 12), '#9fe8ff', 0.4 + k * 0.4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Rn(m.x) - 1, Rn(m.y) - 1, 3, 3);
    }
  }
  drawSlot(ctx, sl) {
    const p = this.world(sl.lx, sl.ly), x = Rn(p.x), y = Rn(p.y), t = this.t;
    if (!sl.patched) {
      const pul = 0.5 + 0.5 * Math.sin(t * 6 + sl.lx);
      drawGlow(ctx, x, y, 10 + Rn(pul * 3), CYAN, 0.45 + pul * 0.25);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + 0.3;
        jag(ctx, x, y, x + Math.cos(a) * 7, y + Math.sin(a) * 6, i % 2 ? '#ffffff' : '#bff6ff', i + sl.lx);
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
      return;
    }
    const k = sl.sewK, w = 15, h = Rn(12 * k);
    if (h <= 0) return;
    const x0 = x - 7, y0 = y - 6;
    ctx.fillStyle = OUTL; ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    ctx.fillStyle = FAB[1]; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = FAB[0];
    for (let yy = 0; yy < h; yy += 2) for (let xx = (yy >> 1) % 2; xx < w; xx += 3) ctx.fillRect(x0 + xx, y0 + yy, 1, 1);
    ctx.fillStyle = FAB[2]; ctx.fillRect(x0, y0, w, 1);
    // pontos de costura roxos em volta
    ctx.fillStyle = STITCH;
    for (let xx = 1; xx < w; xx += 3) { ctx.fillRect(x0 + xx, y0 - 2, 1, 2); if (h >= 12) ctx.fillRect(x0 + xx, y0 + h, 1, 2); }
    for (let yy = 1; yy < h; yy += 3) { ctx.fillRect(x0 - 2, y0 + yy, 2, 1); ctx.fillRect(x0 + w, y0 + yy, 2, 1); }
    if (h >= 12) { ctx.fillRect(x0 + 6, y0 + 5, 3, 1); ctx.fillRect(x0 + 7, y0 + 4, 1, 3); }
    // fio chegando durante a recostura
    if (k < 1) {
      ctx.fillStyle = STITCH;
      const sx = sl.lx * this.facing < 0 ? AX0 : AX1, sy = ATOP;
      for (let i = 0; i < 24; i++) { const u = i / 24; if ((i + Math.floor(t * 20)) % 2) ctx.fillRect(Rn(lerp(sx, x, u)), Rn(lerp(sy, y, u) + Math.sin(u * 9 + t * 8) * 2), 1, 1); }
    }
    // quando ela passa perto e o Tico pode descosturar: placa pisca
    const pl = this.level.player;
    if (k >= 1 && pl && save.data.equippedAbility === 'unstitch' && Math.hypot(pl.cx - p.x, pl.cy - p.y) < 80 && Math.floor(t * 6) % 2 === 0) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 2.5, y0 - 2.5, w + 5, 17);
    }
  }
}
registerEntity('boss_whale', WhaleBoss);

// =============================================================================
// ARENA (gatilho, cortina do túnel, energia de reserva, luzes na escuridão)
// =============================================================================
class WhaleArena extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 60;
    this.started = false; this.closeK = 0; this.energyT = 4; this.side = 0;
  }
  start() {
    const L = this.level, b = L._whale;
    this.started = true;
    L.camera.lockTo(LOCK);
    audio.sfx('rumble'); L.shake(0.2);
    L.cutscene('boss2_intro', { boss: b }).then(() => { if (b && b.state !== 'defeated') b.beginFight(); });
  }
  update(dt) {
    this.t += dt;
    const L = this.level, p = L.player;
    if (!p) return;
    if (!this.started && p.state !== 'dead' && p.cx > AX0 + 20 && p.cy > ATOP && p.cy < AFLOOR) this.start();
    if (!this.started) return;
    this.closeK = Math.min(1, this.closeK + dt * 1.8);
    if (p.x < AX0) { p.x = AX0; if (p.vx < 0) p.vx = 0; }
    // energia de reserva para o Descosturar
    const b = L._whale;
    if (b && b.fighting) {
      this.energyT -= dt;
      if (this.energyT <= 0) {
        this.energyT = 7;
        const have = L.entities.some((e) => !e.dead && e.constructor === R.entities.get('energy') && e.x > AX0 && e.x < AX1);
        if (!have && p.energy < p.maxEnergy * 0.6) {
          this.side ^= 1;
          L.spawn('energy', this.side ? 99 * T : 74 * T, 13 * T);
          L.particles.emit('sparkle', this.side ? 99 * T + 8 : 74 * T + 8, 13 * T + 8, 6);
        }
      }
    }
  }
  draw(ctx) {
    const L = this.level;
    // cortina de fios escuros fechando o túnel
    if (this.closeK > 0) {
      const h = Rn(TUNNEL.h * this.closeK);
      for (let i = 0; i < 6; i++) {
        const bx = AX0 - 7 + i * 1.2;
        for (let y = 0; y < h; y++) {
          const xx = Rn(bx + Math.sin((y + i * 5) * 0.3 + this.t * 2) * 1.5);
          ctx.fillStyle = i % 2 ? FAB[2] : FAB[0]; ctx.fillRect(xx, TUNNEL.y + y, 1, 1);
          if ((y + i * 3) % 7 === 0) { ctx.fillStyle = STITCH; ctx.fillRect(xx, TUNNEL.y + y, 1, 1); }
        }
      }
    }
    // na escuridão, os respiradouros e parapeitos ganham um brilho fraco
    if ((L.data.darkness ?? 0) > 0.4) {
      for (const x of [77, 96]) L.addLight(x * T + 8, AFLOOR - 10, 30, CYAN, 0.55);
      for (const x of [74, 99]) L.addLight(x * T + 8, 14 * T, 22, '#7fd8ff', 0.35);
    }
  }
}
registerEntity('whale_arena', WhaleArena);

// =============================================================================
// CUTSCENES
// =============================================================================
registerCutscene('boss2_intro', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._whale;
    if (!b) return;
    const first = !save.seen('boss2_intro');
    b.prepareEmerge();
    yield 0.2;
    yield* cs.pan(ACX, ACY, 1.0);
    if (first) yield* cs.say([{ who: 'tico', expr: 'confused', text: 'Que escuro... A água aqui é tão fria. Parece um choro antigo.' }]);
    b.emerge();
    cs.shake(0.15);
    yield () => b.ready || cs.skipping;
    if (!b.ready) b.finishEmerge();
    cs.flash('#9fe8ff', 0.3); cs.shake(0.35);
    cs.sfx('boss_roar', { pitch: 0.55 });
    yield 0.4;
    if (first) {
      yield* cs.title('A Baleia de Vidro', 'Guardiã do Oceano das Lágrimas', 2.6);
      yield* cs.say([
        { who: 'tico', expr: 'surprised', text: 'Uma baleia... de VIDRO! E tem brinquedos lá dentro!' },
        { who: 'tico', expr: 'surprised', text: 'Aqueles bonequinhos de marinheiro... são os marujos da Capitã Bolha!' },
        { who: 'baleia', expr: 'angry', shake: true, text: 'Tudo o que se perde... vem para mim. TUDO. Ninguém sai do meu vidro.' },
        { who: 'baleia', expr: 'sad', text: 'Os remendos doem... mas eles não me deixam soltar nada...' },
        { who: 'tico', expr: 'determined', text: 'Remendos escuros... coisa do Costureiro! Se eu descosturar, talvez ela se acalme.' },
      ]);
    } else yield 0.3;
    yield* cs.panTo(p, 0.6);
  },
});

function drawMemoryOrb(ctx, a, t) {
  drawGlow(ctx, Rn(a.x), Rn(a.y), 16, '#d8b8ff', 0.6);
  if (hasSprite('obj_memory')) drawSprite(ctx, 'obj_memory', 'idle', animFrame('obj_memory', 'idle', t), Rn(a.x), Rn(a.y));
  else { fillEllipse(ctx, a.x, a.y, 4, 4, '#e8d8ff'); ctx.fillStyle = '#ffffff'; ctx.fillRect(Rn(a.x) - 1, Rn(a.y) - 2, 2, 2); }
}
function drawToy(kind) {
  return (ctx, a) => {
    const x = Rn(a.x), y = Rn(a.y);
    drawGlow(ctx, x, y, 8, '#bff6ff', 0.3);
    if (kind === 'ball') {
      fillEllipse(ctx, x, y, 4, 4, '#e8607a'); ctx.fillStyle = '#f4f0ff'; ctx.fillRect(x - 1, y - 4, 2, 9); ctx.fillStyle = '#5a8ae8'; ctx.fillRect(x - 4, y, 9, 1);
    } else if (kind === 'duck') {
      fillEllipse(ctx, x, y + 1, 4, 3, '#f0d860'); fillEllipse(ctx, x + 3, y - 3, 2, 2, '#f0d860'); ctx.fillStyle = '#f09040'; ctx.fillRect(x + 5, y - 3, 2, 1); ctx.fillStyle = '#20304a'; ctx.fillRect(x + 3, y - 4, 1, 1);
    } else {
      ctx.fillStyle = '#a8704a'; ctx.fillRect(x - 5, y, 11, 3); ctx.fillStyle = '#6a4a34'; ctx.fillRect(x, y - 7, 1, 7); ctx.fillStyle = '#f4f0e0'; ctx.fillRect(x + 1, y - 6, 4, 5);
    }
  };
}
function giveMemory(L) {
  const id = 'mem_4', p = L.player;
  L.collect('memory', 1, 'w2_6:mem_4', { id });
  audio.sfx('star', { pitch: 0.8 });
  spawnShockwave(L, p.cx, p.cy, { radius: 34, color: '#d8b8ff' });
  L.particles.emit('stars_burst', p.cx, p.cy, 14, { colors: ['#e8d8ff', '#ffffff', '#ffd23f'] });
  const title = R.memories?.get?.(id)?.title;
  L.toast(title ? `Memória: ${title}` : 'Memória recuperada!', 'icon_memory');
  save.commit();
  const sc = makeScene('memory_view', id, { onClose: () => {} });
  if (sc) game.scenes.push(sc);
}

registerCutscene('boss2_defeat', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._whale;
    const finish = () => { save.unlockWorld(3); save.commit(); L.complete({ delay: 1 }); };
    if (!b) { finish(); return; }
    yield* cs.panTo(b, 0.8);
    yield 0.3;
    // o vidro racha inteiro...
    for (let i = 0; i < 4; i++) {
      b.shatterK = (i + 1) / 4;
      cs.sfx('glass_crack', { pitch: 1 + i * 0.12 }); cs.shake(0.15 + i * 0.08);
      cs.particles('hit', b.cx + rand(-40, 40), b.cy + rand(-16, 16), 5, { colors: [CYAN, '#ffffff'] });
      yield 0.45;
    }
    // ...e se abre: as placas caem e os brinquedos ficam livres
    cs.flash('#ffffff', 0.5); cs.sfx('explosion', { vol: 0.6 }); cs.sfx('whale_song', { pitch: 1.2 });
    b.freed = true; b.shatterK = 0;
    cs.particles('hit', b.cx, b.cy, 24, { colors: [CYAN, '#ffffff', '#c8fcff'] });
    cs.particles('fabric', b.cx, b.cy, 18, { colors: FAB });
    cs.particles('bubble', b.cx, b.cy, 20);
    const toys = [];
    const side = p.cx < b.cx ? -1 : 1;
    [[24, 8], [33, 13], [41, 4]].forEach(([lx, ly], i) => {
      const w = b.world(lx, ly);
      const a = cs.actor({ sprite: 'qi_marujo', anim: 'idle', x: w.x, y: w.y, z: 61 });
      toys.push({ a, tx: p.cx + side * (-14 - i * 12), ty: p.cy - 14 - (i % 2) * 6 });
    });
    [['ball', -30, 4], ['duck', -8, 12], ['boat', 8, -12]].forEach(([k, lx, ly], i) => {
      const w = b.world(lx, ly);
      const a = cs.actor({ x: w.x, y: w.y, z: 61, draw: drawToy(k) });
      toys.push({ a, tx: w.x + (i - 1) * 50, ty: ATOP + 16 + i * 6 });
    });
    yield* cs.parallel(...toys.map((o, i) => cs.move(o.a, o.tx, o.ty, 1.3 + i * 0.1)));
    yield 0.3;
    yield* cs.say([
      { who: 'tico', expr: 'happy', text: 'Os marujos da Capitã Bolha! E um monte de brinquedos! Vocês estão livres!' },
      { who: 'baleia', expr: 'sad', text: 'Obrigada, pequeno... Eu só queria guardar o que as crianças perdiam. Para nada se perder de vez.' },
      { who: 'baleia', expr: 'sad', text: 'Mas um homem feito de linhas roxas costurou meu abraço... e ele virou uma prisão.' },
      { who: 'tico', expr: 'sad', text: 'O Costureiro de novo...' },
      { who: 'baleia', expr: 'neutral', text: 'Escute. Cada guardião é um nó... e você está desatando.' },
      { who: 'tico', expr: 'confused', text: 'Um nó? Desatando o quê? Eu só quero voltar pra casa!' },
      { who: 'baleia', expr: 'neutral', text: 'Um dia você vai entender. Tome... isto brilhava no fundo do meu vidro. Tem o seu cheiro.' },
    ]);
    const h = b.world(0, 0);
    const orb = cs.actor({ x: h.x, y: h.y, z: 62, draw: drawMemoryOrb });
    cs.sfx('magic_hum');
    yield* cs.move(orb, h.x, h.y - 24, 0.8);
    yield* cs.move(orb, p.cx, p.cy - 4, 0.8);
    orb.alpha = 0;
    giveMemory(L);
    yield 0.8;
    yield* cs.say([
      { who: 'baleia', expr: 'happy', text: 'Siga as bolhas para cima. Além do mar há uma cidade onde os relógios pararam...' },
      { who: 'tico', expr: 'determined', text: 'Primeiro, devolver os marujos pra Capitã. Depois... a cidade dos relógios!' },
    ]);
    for (const o of toys) cs.fade(o.a, 0, 0.8);
    finish();
  },
});

// =============================================================================
// FASE w2_6 — "O Ventre do Oceano"
// =============================================================================
function buildMap() {
  const g = Array.from({ length: MH }, () => Array(MW).fill('.'));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < MW) g[y][x] = c; };
  const put = (x, y, c) => { g[y][x] = c; };
  // ---- aproximação
  fill(0, 7, 11, MH - 1, '#');                 // praia
  fill(12, 7, 69, 16, '~');                    // mar aberto (superfície na linha 7)
  fill(12, 17, 69, MH - 1, '#');               // fundo
  fill(22, 14, 24, 16, '%');                   // coral
  fill(39, 3, 42, 11, '%');                    // arco de pedra (mergulhe por baixo)
  fill(53, 5, 55, 12, '%');                    // pilar (estrela em cima)
  fill(62, 6, 66, 16, '%');                    // ilhota do checkpoint
  put(64, 5, 'K');
  put(23, 12, '*'); put(47, 15, '*'); put(54, 4, '*');
  put(33, 12, 'e'); put(59, 14, 'e'); put(46, 13, 'h');
  put(4, 6, 'P');
  // ---- arena submersa
  fill(70, 0, MW - 1, 5, '#');                 // teto
  fill(70, 6, 72, MH - 1, '#');                // parede esquerda...
  fill(70, 13, 72, 16, '~');                   // ...com o túnel
  fill(73, 6, 100, 19, '~');                   // água da arena
  fill(73, 20, MW - 1, MH - 1, '#');           // chão
  fill(101, 6, MW - 1, 19, '#');               // parede direita
  fill(73, 14, 75, 14, '='); fill(98, 14, 100, 14, '=');   // parapeitos
  put(77, 19, 'l'); put(96, 19, 'l');          // respiradouros
  return g.map((r) => r.join(''));
}

function setupLevel(L) {
  getSprite('whale_body');
  L.data = { ...L.data };                       // cópia: a escuridão muda durante a luta
  const boss = new WhaleBoss(L, 0, 0, { dark: L.data.darkness });
  L.add(boss); L._whale = boss;
  L.add(new WhaleArena(L, 0, 0, {}));
}

registerLevel({
  id: 'w2_6', world: 2, index: 6, name: 'O Ventre do Oceano', subtitle: 'Mundo 2-6 - Chefe',
  music: 'boss_whale', tileset: 'w2', background: 'w2', timeOfDay: 'night', boss: true,
  parTime: 240, darkness: 0.15, ambient: 'w2_bubbles', oxygen: true, oxygenTime: 22,
  map: buildMap(),
  props: {
    '77,19': { rate: 1.1 }, '96,19': { rate: 1.1, delay: 0.5 },
  },
  onStart(level) { setupLevel(level); },
});
