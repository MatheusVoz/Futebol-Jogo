// =============================================================================
// bosses/whale.js — CHEFE DO MUNDO 2: "A BALEIA DE VIDRO" + fase w2_6
//
// Fase 'w2_6' "O Ventre do Oceano" (noite, música 'boss_whale', oxigênio):
//   Aproximação curta a nado (praia → arco de pedra → pilar com estrela → ilhota
//   com checkpoint). Um túnel submerso desemboca num BOLSÃO DE AR (a arena,
//   camera.lockTo): chão firme, 2 degraus de pedra e 2 parapeitos vazados. Na
//   luta não há pressão de oxigênio. Ao entrar, uma cortina de fios fecha o túnel.
// Chefe 'boss_whale' — luta justa, estilo Cuphead/Hollow Knight:
//   PONTOS FRACOS: crochezinhos roxos (entidades 'whale_stitch', hittable)
//   costurados sobre as marcas do vidro. Soco, flecha ({kind:'arrow'}), agulhada,
//   Descosturar ou golpe especial cortam o crochê (3 golpes × poder cada).
//   Fase 1: 2 crochês (dorso, flanco) · Fase 2: 3 (cauda, papo, cabeça) ·
//   Fase 3: 3 (dorso, flanco, cauda) + penumbra. Barra = crochês restantes.
//   JUSTIÇA: o corpo de vidro NUNCA fere nem empurra — só a BOCA na investida e a
//   BARRIGA na queda da pancada ('whale_maw'). O dorso é uma plataforma vazada
//   ('whale_back') que leva o Tico de carona (moveBody: nunca entra no teto).
//   Ela nunca "aparece" sobre o Tico: nada com velocidade limitada, sai e entra
//   pelas paredes com aviso (bolhas + faixa + setas).
//   Ataques (todos com 0,6–1 s de aviso visual + som):
//     ANÉIS: vai para o lado oposto, boca acende → 3/5 anéis lentos (com o Tico
//            nas costas ela atira para a frente, nunca nele).
//     INVESTIDA: sai da arena, faixa vermelha marca a altura (rasteira → pule ou
//            suba num degrau; alta → fique no chão), atravessa. Fase 3: ida e volta.
//     CANTO (fase 2+): no alto, cacos caem do teto em colunas avisadas (nunca
//            sobre ela — quem pega carona está a salvo).
//     PANCADA: sobe, sombra + setas no chão, ela se sacode (quem está nas costas é
//            arremessado para cima, SEM dano), mergulha → ondas rente ao chão
//            (pule; morrem nos degraus) → fica CANSADA no chão 3,6/3,1/2,7 s com
//            os crochês piscando (janela principal; dá para subir nas costas).
//   FINAL: último crochê → o vidro racha e liberta os brinquedos (marujos da
//          Capitã Bolha) → cutscene 'boss2_defeat' (mem_4, Mundo 3).
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
const XMIN = AX0 + HW + 2, XMAX = AX1 - HW - 2;
const RX0 = 76 * T + HW, RX1 = 98 * T - HW; // onde ela pode pousar (entre os degraus de pedra)
const CY_MIN = ATOP + 26 + 22;              // centro mais alto: o dorso fica 26 px abaixo do teto (cabe o Tico)
const HOVER_Y = ATOP + 74;                  // altura de cruzeiro
const SONG_Y = ATOP + 80;                   // altura do canto (alcançável dos parapeitos + pulo duplo)
const REST_Y = AFLOOR - 27;                 // deitada no chão (cansada)
const LANE_LOW = AFLOOR - HH - 2;           // investida rasteira: pule por cima ou suba num degrau
const LANE_HIGH = 258;                      // investida alta: fique no chão (degraus ficam na mira)
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
    // morre ao bater nos degraus de pedra (quem está em cima deles fica a salvo)
    if (this.x < AX0 + 3 * T || this.right > AX1 - 3 * T || this.t > 4) { this.level.particles.emit('bubble', this.cx, this.y + 6, 4); this.remove(); }
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
// PEÇAS DO CHEFE: dorso (plataforma), boca (dano), crochês (pontos fracos)
// =============================================================================
/** Dorso da baleia: plataforma vazada que acompanha o corpo (o Tico pega carona). */
class WhaleBack extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 92; this.h = 6; this.oneway = false; this.alwaysUpdate = true; this.z = 29;
    this.boss = props.boss;
  }
  update() {}
  draw() {}
}
registerEntity('whale_back', WhaleBack);

/** Boca/dentes (ou a barriga na pancada): o ÚNICO ponto que fere por contato,
 *  e só enquanto ela ataca. O corpo de vidro em si nunca fere. */
class WhaleMaw extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 30; this.h = 30; this.enemy = false; this.contactDamage = 1; this.alwaysUpdate = true; this.z = 29;
    this.boss = null;
  }
  update() {}
  draw() {}
}
registerEntity('whale_maw', WhaleMaw);

/** Crochezinho escuro costurado sobre uma marca do vidro. Recebe soco, flecha,
 *  agulhada, Descosturar etc. (qualquer coisa que chame onHit/hurt). */
class WhaleStitch extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 20; this.h = 18; this.alwaysUpdate = true; this.z = 31;
    this.whale = props.whale; this.slot = props.slot; this.hittable = false;
  }
  update(dt) { this.tickTimers(dt); }
  onHit(dmg, src, info = {}) {
    const k = info.kind;
    // a agulhada carregada continua valendo, mas não resolve sozinha
    const d = k === 'needle' ? Math.min(dmg, this.whale.patchHp * 0.67) : dmg;
    return this.whale.hitSlot(this.slot, d, k);
  }
  hurt(n = 1, src, opts = {}) { return this.whale.hitSlot(this.slot, n, opts.kind || 'other'); }
  unstitch() { return this.whale.hitSlot(this.slot, this.whale.patchHp * 0.5, 'unstitch'); }
  draw() {}
}
registerEntity('whale_stitch', WhaleStitch);

// =============================================================================
// O CHEFE
// =============================================================================
// Pontos fracos (local, olhando à direita; centro do corpo = 0,0).
const SPOTS = {
  back: [-24, -20], head: [22, -26], flank: [-30, 9], tail: [-74, 7], chin: [42, 15],
};
const PHASE_SPOTS = { 1: ['back', 'flank'], 2: ['tail', 'chin', 'head'], 3: ['back', 'flank', 'tail'] };
const TOTAL_SPOTS = 8;
const PATTERNS = {
  1: ['rings', 'charge', 'slam'],
  2: ['charge', 'song', 'rings', 'slam'],
  3: ['charge2', 'song', 'slam', 'rings', 'charge', 'slam'],
};
// estados em que a luta está rolando (crochês atingíveis)
const FIGHT = new Set(['idle', 'reposition', 'ringwind', 'ringpost', 'exit', 'lanewarn', 'charge', 'returnwarn', 'return',
  'rise', 'slamwind', 'slam', 'tired', 'recover', 'songprep', 'song']);
const TIRED = new Set(['tired']);

class WhaleBoss extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    // level.boss = this mostra a barra; this.boss fica falso de propósito: o corpo
    // de vidro é atravessável e não deve frear a esquiva do Tico.
    this.boss = false; this.bossName = 'A Baleia de Vidro';
    this.enemy = false; this.hittable = false; this.contactDamage = 0;
    this.bindable = false; this.stompable = false; this.flying = true;
    this.alwaysUpdate = true; this.alwaysDraw = true; this.z = 30;
    this.w = HW * 2; this.h = HH * 2;
    this.place(ACX + 60, ACY);
    this.patchHp = 3 * Math.max(1, getStats().power || 1);
    this.maxHp = this.hp = TOTAL_SPOTS * this.patchHp;
    this.drops = { buttons: 0 };
    this.phase = 1; this.state = 'dormant'; this.st = 0; this.qi = 0;
    this.facing = -1; this.rot = 0; this.alpha = 0; this.eyeK = 0; this.ready = false;
    this.jx = 0;                      // tremidinha visual (não mexe na caixa)
    this.slots = [];
    this.scars = [];                  // marcas já libertadas (brilham no vidro)
    this.cracks = [];
    const rng = makeRng(42);
    for (let i = 0; i < 12; i++) {
      const lx = rng.range(-56, 52), ly = rng.range(-18, 18), a = rng.range(0, Math.PI * 2), l = rng.range(8, 18);
      this.cracks.push({ x0: lx, y0: ly, x1: lx + Math.cos(a) * l, y1: ly + Math.sin(a) * l * 0.6, s: i });
    }
    this.shatterK = 0; this.freed = false; this.hintCd = 0; this.clinkCd = 0; this.darkT = props.dark ?? 0.15;
    this.lane = 1; this.taught = {};
    // peças
    this.back = new WhaleBack(level, 0, 0, { boss: this });
    this.maw = new WhaleMaw(level, 0, 0, {});
    level.add(this.back); level.add(this.maw);
    this.sewSlots(PHASE_SPOTS[1], true);
    this.syncParts();
  }
  get fighting() { return FIGHT.has(this.state); }
  get stunned() { return TIRED.has(this.state); }
  get spd() { return [1, 1, 1.1, 1.22][this.phase]; }
  get tele() { return [1, 1, 0.92, 0.84][this.phase]; }
  place(cx, cy) { this.x = cx - this.w / 2; this.y = cy - this.h / 2; }
  go(s) { this.state = s; this.st = 0; this.fired = 0; }
  /** Ponto local (olhando à direita) → mundo, com espelho e rotação. */
  world(lx, ly) {
    const f = this.facing, c = Math.cos(this.rot), s = Math.sin(this.rot), x = lx * f;
    return { x: this.cx + x * c - ly * s, y: this.cy + x * s + ly * c };
  }
  /** Nada com velocidade limitada até (tx,ty): ela NUNCA "teleporta". */
  swimTo(tx, ty, maxV, dt) {
    const dx = tx - this.cx, dy = ty - this.cy, d = Math.hypot(dx, dy);
    if (d < 0.5) return true;
    const v = Math.min(maxV, d * 5) * dt;
    this.place(this.cx + (dx / d) * Math.min(v, d), this.cy + (dy / d) * Math.min(v, d));
    return d < 3;
  }
  target() { return super.target(600) || this.level.player; }
  get rider() {
    const p = this.level.player;
    return p && p.state !== 'dead' && p.groundEntity === this.back && this.back.oneway ? p : null;
  }

  // ---------------------------------------------------------------- crochês
  sewSlots(names, instant = false) {
    for (const s of this.slots) if (s.ent && !s.ent.dead) s.ent.remove();
    this.slots = names.map((n, i) => {
      const [lx, ly] = SPOTS[n];
      const s = { name: n, lx, ly, hp: this.patchHp, sewK: instant ? 1 : 0, sewDelay: 0.6 + i * 0.4, hitK: 0 };
      s.ent = new WhaleStitch(this.level, 0, 0, { whale: this, slot: s });
      this.level.add(s.ent);
      return s;
    });
  }
  slotsLeft() { return this.slots.filter((s) => s.hp > 0).length; }
  hitSlot(s, dmg, kind) {
    if (!this.fighting || s.hp <= 0 || s.sewK < 1 || this.alpha < 0.6) return false;
    if (s.ent.invuln > 0) return true;
    const L = this.level, p = this.world(s.lx, s.ly);
    const d = Math.max(0.25, dmg || 1), before = s.hp;
    s.hp = Math.max(0, s.hp - d); s.hitK = 1; s.ent.invuln = 0.05;
    this.hp = Math.max(0, this.hp - (before - s.hp));
    this.flash = 0.06;
    audio.sfx('unstitch_hit', { randomPitch: 0.12, cooldown: 0.05 });
    L.particles.emit('thread', p.x, p.y, 4, { colors: [STITCH, '#ffffff'] });
    L.particles.emit('fabric', p.x, p.y, 3, { colors: FAB });
    if (kind === 'arrow' || kind === 'needle') audio.sfx('armor_clink', { pitch: 1.8, vol: 0.4, cooldown: 0.08 });
    if (s.hp <= 0) this.ripSlot(s);
    return true;
  }
  ripSlot(s) {
    const L = this.level, p = this.world(s.lx, s.ly);
    s.hp = 0; s.ent.hittable = false;
    this.hp = Math.min(this.hp, this.hpFloor());
    this.scars.push({ lx: s.lx, ly: s.ly });
    audio.sfx('thread_snap', { cooldown: 0.05 }); audio.sfx('glass_crack', { vol: 0.5 }); audio.sfx('boss_hit', { randomPitch: 0.08 });
    L.particles.emit('fabric', p.x, p.y, 12, { colors: FAB });
    L.particles.emit('thread', p.x, p.y, 10, { colors: [STITCH, '#ffffff'] });
    L.particles.emit('sparkle', p.x, p.y, 8);
    spawnShockwave(L, p.x, p.y, { radius: 20, color: CYAN });
    L.shake(0.18); L.hitstop(0.06);
    if (!this.taught.rip) { this.taught.rip = true; spawnFloatingText(L, p.x, p.y - 12, 'Crochê cortado!', CYAN); }
    if (this.slotsLeft() === 0) {
      if (this.phase >= 3) this.defeat();
      else this.startTransition();
    }
  }
  /** PV mínimos enquanto restam crochês nesta fase e nas próximas. */
  hpFloor() {
    const future = this.phase === 1 ? 6 : this.phase === 2 ? 3 : 0;
    return (future + this.slots.reduce((a, s) => a + (s.hp > 0 ? 1 : 0), 0)) * this.patchHp;
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
    this.go('idle'); this.idleDelay = 1.0;
    L.toast('Corte os crochês roxos dela: soco ou flecha!', 'icon_patch');
  }

  // ---------------------------------------------------------------- dano (corpo)
  die() {}
  hurt() { return false; }       // o vidro em si é duro: só os crochês contam
  onHit() { return false; }
  hint(text) {
    if (this.hintCd > 0) return;
    this.hintCd = 4;
    spawnFloatingText(this.level, this.cx, this.y - 10, text, CYAN);
  }
  /** Soco no vidro (fora dos crochês): tilinta e dá a dica. */
  checkClink() {
    const p = this.level.player;
    if (this.clinkCd > 0 || !p || typeof p.attackBox !== 'function') return;
    const box = p.attackBox();
    if (!box || !rectsOverlap(box, this)) return;
    if (this.slots.some((s) => s.ent.hittable && rectsOverlap(box, s.ent))) return;
    this.clinkCd = 0.35;
    audio.sfx('armor_clink', { pitch: 1.5, vol: 0.5 });
    const x = clamp(box.x + box.w / 2, this.x, this.right), y = clamp(box.y + box.h / 2, this.y, this.bottom);
    this.level.particles.emit('hit', x, y, 2, { colors: ['#ffffff', CYAN] });
    this.hint('Vidro duro! Mire nos crochês roxos!');
  }
  defeat() {
    const L = this.level;
    this.hp = 0;
    this.go('defeated');
    this.rot = 0; this.jx = 0;
    L.boss = null;
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
  next() {
    const pat = PATTERNS[this.phase];
    const k = pat[this.qi++ % pat.length];
    const t = this.target();
    if (k === 'rings') {
      const side = t && t.cx < ACX ? 1 : -1;            // vai para o lado oposto ao Tico
      this.hover = { x: side > 0 ? XMAX - 8 : XMIN + 8, y: HOVER_Y + rand(-6, 18) };
      this.go('reposition');
    } else if (k === 'charge' || k === 'charge2') {
      this.double = k === 'charge2';
      this.exitSide = this.cx < ACX ? -1 : 1;
      this.go('exit');
    } else if (k === 'song') this.go('songprep');
    else this.go('rise');
  }
  mouth() { return this.world(60, 6); }
  fireRings() {
    const L = this.level, t = this.target(), m = this.mouth();
    const n = this.phase >= 3 ? 5 : 3, spread = 0.32, sp = 84 * this.spd;
    // com o Tico de carona, ela atira para a frente (nunca nele, que está nas costas)
    const aim = !this.rider && t;
    const base = aim ? Math.atan2(t.cy - m.y, t.cx - m.x) : (this.facing > 0 ? 0 : Math.PI);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      L.add(new WhaleRing(L, m.x, m.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }));
    }
    audio.sfx('whale_ring');
    L.particles.emit('bubble', m.x, m.y, 6);
  }
  /** Caco do teto com aviso; nunca cai sobre o corpo dela (nem sobre quem pega carona). */
  spawnShard(x, warn) {
    const L = this.level;
    x = clamp(x, AX0 + 6, AX1 - 6);
    if (Math.abs(x - this.cx) < HW + 10) x = this.cx + (x < this.cx ? -1 : 1) * (HW + 10 + rand(0, 30));
    if (x < AX0 + 6 || x > AX1 - 6) return;
    L.add(new WhaleShard(L, x, 0, { warn: (warn ?? 0.95) * Math.max(0.85, this.tele) }));
  }
  crash() {
    const L = this.level;
    audio.sfx('glass_crack'); audio.sfx('rumble'); audio.sfx('boss_hit', { pitch: 0.6 });
    L.shake(0.5); L.hitstop(0.06);
    L.particles.emit('bubble', this.cx, AFLOOR - 4, 14);
    L.particles.emit('dust', this.cx - HW, AFLOOR - 2, 6); L.particles.emit('dust', this.cx + HW, AFLOOR - 2, 6);
    const v = [0, 140, 160, 180][this.phase];
    for (const d of [-1, 1]) L.add(new WhaleWave(L, this.cx + d * (HW - 4), 0, { vx: d * v }));
    if (this.phase >= 2) {
      const n = this.phase >= 3 ? 3 : 2;
      for (let i = 0; i < n; i++) this.spawnShard(rand(AX0 + 50, AX1 - 50), 1.0 + i * 0.3);
    }
    this.go('tired');
    this.tiredDur = [0, 3.6, 3.1, 2.7][this.phase];
    if (!this.taught.tired) { this.taught.tired = true; spawnFloatingText(L, this.cx, this.y - 16, 'Cansada! Corte os crochês!', '#ffd23f'); }
  }
  /** Ela se sacode: quem estiver nas costas é arremessado para cima (sem dano). */
  buck() {
    const p = this.rider;
    if (!p) return;
    p.vy = -300; p.vx = clamp(p.cx - this.cx, -1, 1) * 30; p.grounded = false; p.groundEntity = null; p.jumping = false;
    this.level.particles.emit('bubble', p.cx, p.bottom, 6);
    audio.sfx('jump', { pitch: 0.7 });
    if (!this.taught.buck) { this.taught.buck = true; spawnFloatingText(this.level, p.cx, p.y - 10, 'Upa! Ela se sacode!', '#ffffff'); }
  }
  offX(side) { return side < 0 ? AX0 - HW - 40 : AX1 + HW + 40; }
  laneY(i) { return i === 0 ? LANE_LOW : LANE_HIGH; }
  pickLane() {
    if (this.phase === 1) this.lane = this.lane === 0 ? 1 : 0;           // alterna: previsível
    else this.lane = Math.random() < 0.5 ? 0 : 1;
  }
  /** Transparência ao atravessar as paredes da arena (ela nada "para dentro" do mar). */
  wallAlpha() {
    const out = Math.max(0, AX0 + 10 - (this.cx - HW * 0.4), (this.cx + HW * 0.4) - (AX1 - 10));
    return clamp(1 - out / (HW * 1.1), 0, 1);
  }

  think(dt) {
    const L = this.level, t = this.target();
    const s = this.state, st = this.st;
    this.jx = 0;
    switch (s) {
      case 'emerge': {
        const k = Math.min(1, st / 2.4);
        this.alpha = k; this.eyeK = clamp((st - 1.6) / 0.6, 0, 1);
        this.place(lerp(ACX + 96, ACX + 50, k), ACY + 6 - 6 * k + Math.sin(this.t * 1.5) * 2);
        if (st >= 2.4) { this.ready = true; this.go('emerged'); }
        break;
      }
      case 'emerged': case 'dormant':
        if (s === 'emerged') this.place(this.cx, ACY + Math.sin(this.t * 1.5) * 3);
        break;
      case 'idle':
        this.rot = damp(this.rot, 0, 8, dt);
        this.swimTo(clamp(this.cx, XMIN, XMAX), clamp(this.cy, CY_MIN + 10, HOVER_Y + 30) + Math.sin(this.t * 2) * 2, 50, dt);
        if (t && Math.abs(t.cx - this.cx) > 40 && !this.rider) this.facing = t.cx < this.cx ? -1 : 1;
        if (st >= (this.idleDelay ?? 0.8)) { this.idleDelay = [0, 0.9, 0.7, 0.5][this.phase]; this.next(); }
        break;
      // ---- anéis
      case 'reposition':
        this.facing = this.hover.x < this.cx ? -1 : 1;
        if (this.swimTo(this.hover.x, this.hover.y, 120, dt) || st > 2.2) { audio.sfx('whale_ring', { pitch: 0.55, vol: 0.7 }); this.go('ringwind'); }
        break;
      case 'ringwind':
        if (t && !this.rider) this.facing = t.cx < this.cx ? -1 : 1;
        this.place(this.cx, this.cy + Math.sin(this.t * 3) * 0.2);
        if (st >= 0.85 * this.tele) { this.fireRings(); this.go('ringpost'); }
        break;
      case 'ringpost':
        if (st >= 0.6) this.go('idle');
        break;
      // ---- investida: sai de cena, avisa a faixa, atravessa, volta
      case 'exit': {
        const side = this.exitSide;
        this.facing = side;
        const tx = this.offX(side);
        this.swimTo(tx, clamp(this.cy, CY_MIN, LANE_LOW), 190, dt);
        if (Math.abs(this.cx - tx) < 4 || st > 3) {
          // entra pelo lado oposto ao Tico (pista livre para ele ver e reagir)
          this.enterSide = t ? (t.cx < ACX ? 1 : -1) : -side;
          this.pickLane();
          this.place(this.offX(this.enterSide), this.laneY(this.lane));
          this.facing = -this.enterSide;
          audio.sfx('whale_song', { pitch: 1.35, vol: 0.6 }); audio.sfx('current', { vol: 0.6 });
          this.go('lanewarn');
        }
        break;
      }
      case 'lanewarn': {
        const ex = this.enterSide < 0 ? AX0 + 4 : AX1 - 4;
        if (Math.random() < dt * 30) L.particles.emit('bubble', ex + rand(-4, 4), this.laneY(this.lane) + rand(-HH, HH), 1);
        if (st >= 1.0 * this.tele) { audio.sfx('whoosh'); this.go('charge'); }
        break;
      }
      case 'charge': {
        const v = 300 * this.spd, dir = -this.enterSide;
        this.place(this.cx + dir * v * dt, this.laneY(this.lane));
        if (Math.random() < 0.7) L.particles.emit('bubble', this.cx - dir * HW, this.cy + rand(-10, 10), 1);
        const far = this.offX(dir);
        if (dir > 0 ? this.cx >= far : this.cx <= far) {
          if (this.double) {
            this.double = false;
            this.enterSide = dir; this.lane = this.lane ? 0 : 1;
            this.place(this.offX(this.enterSide), this.laneY(this.lane));
            this.facing = -this.enterSide;
            audio.sfx('whale_song', { pitch: 1.45, vol: 0.6 });
            this.go('lanewarn'); this.st = 0.15 * this.tele;
          } else {
            this.enterSide = dir;
            this.place(this.offX(dir), HOVER_Y);
            this.facing = -dir;
            this.go('returnwarn');
          }
        }
        break;
      }
      case 'returnwarn': {
        const ex = this.enterSide < 0 ? AX0 + 4 : AX1 - 4;
        if (Math.random() < dt * 20) L.particles.emit('bubble', ex + rand(-4, 4), HOVER_Y + rand(-HH, HH), 1);
        if (st >= 0.6) this.go('return');
        break;
      }
      case 'return': {
        const tx = this.enterSide < 0 ? XMIN + 20 : XMAX - 20;
        if (this.swimTo(tx, HOVER_Y, 120, dt) || st > 3) { this.idleDelay = 0.5; this.go('idle'); }
        break;
      }
      // ---- pancada: sobe, mira (sombra), se sacode, mergulha → cansada
      case 'rise': {
        const tx = clamp(t ? t.cx : ACX, RX0, RX1);
        if (t && Math.abs(t.cx - this.cx) > 30 && !this.rider) this.facing = t.cx < this.cx ? -1 : 1;
        this.rot = damp(this.rot, 0, 8, dt);
        if (this.swimTo(tx, CY_MIN + 4, 150, dt) || st > 1.8) {
          audio.sfx('rumble', { vol: 0.6 }); audio.sfx('whale_song', { pitch: 0.6, vol: 0.7 });
          this.go('slamwind');
        }
        break;
      }
      case 'slamwind': {
        const dur = 0.95 * this.tele;
        if (st < dur * 0.6 && t && !this.rider) this.swimTo(clamp(t.cx, RX0, RX1), CY_MIN + 4, 75, dt);
        this.jx = st > dur * 0.4 ? (Math.floor(st * 30) % 2 ? 1.5 : -1.5) : 0;    // se sacudindo
        if (st >= dur) { this.buck(); this.vy = 80; audio.sfx('whoosh', { pitch: 0.7 }); this.go('slam'); }
        break;
      }
      case 'slam':
        this.vy = Math.min(520, this.vy + 1300 * dt);
        this.place(this.cx, Math.min(REST_Y, this.cy + this.vy * dt));
        if (this.cy >= REST_Y) this.crash();
        break;
      case 'tired': {
        this.rot = damp(this.rot, Math.sin(this.t * 2.2) * 0.03, 4, dt);
        const left = this.tiredDur - st;
        if (left < 0.55) this.jx = Math.floor(st * 20) % 2 ? 1 : -1;               // aviso: vai levantar
        if (Math.random() < dt * 3) L.particles.emit('bubble', this.world(56, 4).x, this.world(56, 4).y, 1);
        if (left <= 0) { audio.sfx('whale_song', { pitch: 0.9, vol: 0.5 }); this.go('recover'); }
        break;
      }
      case 'recover':
        this.rot = damp(this.rot, 0, 6, dt);
        if (this.swimTo(this.cx, HOVER_Y, 70, dt) || st > 2) { this.idleDelay = 0.5; this.go('idle'); }
        break;
      // ---- canto: cacos caem do teto (colunas de aviso)
      case 'songprep':
        if (t && Math.abs(t.cx - this.cx) > 30 && !this.rider) this.facing = t.cx < this.cx ? -1 : 1;
        if ((this.swimTo(ACX, SONG_Y, 130, dt) && st > 0.8) || st > 2.4) {
          audio.sfx('whale_song', { pitch: 1.1 }); this.go('song'); this.nextShard = 0.3;
        }
        break;
      case 'song': {
        const dur = 3.4, p = L.player;
        this.place(ACX + Math.sin(st * 1.6) * 6, SONG_Y + Math.cos(st * 1.3) * 3);
        this.nextShard -= dt;
        if (this.nextShard <= 0 && st < dur - 0.8) {
          this.fired++;
          this.nextShard = this.phase >= 3 ? 0.42 : 0.55;
          this.spawnShard(this.fired % 3 === 0 && p ? p.cx : rand(AX0 + 16, AX1 - 16));
        }
        if (st >= dur) this.go('idle');
        break;
      }
      case 'transition': this.updateTransition(dt); break;
      case 'defeated':
        this.swimTo(ACX, ACY - 10, 40, dt);
        this.rot = damp(this.rot, Math.sin(this.t * 1.3) * 0.06, 3, dt);
        if (!this.csStarted && st >= 1.4) {
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
    this.rot = 0; this.newPhase = this.phase + 1; this.sewn = false;
    audio.sfx('boss_roar', { pitch: 0.6 }); audio.sfx('whale_song', { pitch: 0.7 });
    L.shake(0.4); L.flash(VIOLET, 0.2);
    spawnFloatingText(L, this.cx, this.y - 14, 'O Costureiro a remenda!', VIOLET);
  }
  updateTransition(dt) {
    const L = this.level, st = this.st;
    this.alpha = Math.min(1, this.alpha + dt * 2);
    this.swimTo(clamp(this.cx, XMIN, XMAX), HOVER_Y, 60, dt);
    if (!this.sewn && st >= 0.6) { this.sewn = true; this.phase = this.newPhase; this.sewSlots(PHASE_SPOTS[this.phase]); }
    if (this.sewn) for (const s of this.slots) {
      if (st < 0.6 + s.sewDelay) continue;
      if (s.sewK === 0) audio.sfx('stitch_connect', { pitch: 0.7 });
      if (s.sewK < 1) {
        s.sewK = Math.min(1, s.sewK + dt * 2.2);
        if (s.sewK >= 1) { const p = this.world(s.lx, s.ly); L.particles.emit('thread', p.x, p.y, 5, { colors: [STITCH, '#ffffff'] }); }
      }
    }
    if (st >= 3.0) {
      for (const s of this.slots) s.sewK = 1;
      if (this.phase === 3) { this.darkT = 0.55; this.light = { r: 120, color: CYAN, i: 0.95, flicker: 0.05 }; L.toast('Ficou escuro... siga o brilho da baleia!', 'icon_memory'); }
      L.spawn('heart', ACX - 8, AFLOOR - 20);
      this.idleDelay = 0.8; this.qi = 0;
      this.go('idle');
    }
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    this.tickTimers(dt);
    this.st += dt;
    if (this.hintCd > 0) this.hintCd -= dt;
    if (this.clinkCd > 0) this.clinkCd -= dt;
    const L = this.level, p = L.player;
    if (p && p.state === 'dead' && this.fighting) { this.syncParts(); return; }   // Tico caiu: ela para
    const bx0 = this.back.x, by0 = this.back.y, wasRiding = !!this.rider;
    this.think(dt);
    if (this.state === 'exit' || this.state === 'charge' || this.state === 'return' || this.state === 'lanewarn' || this.state === 'returnwarn') this.alpha = this.wallAlpha();
    else if (this.ready && this.state !== 'emerge') this.alpha = Math.min(1, this.alpha + dt * 3);
    this.syncParts();
    // carona: quem está no dorso acompanha o movimento (com colisão: nunca entra no teto/paredes)
    if (wasRiding && this.back.oneway && p.groundEntity === this.back) {
      const dx = this.back.x - bx0, dy = this.back.y - by0;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) moveBody(p, dx, dy, L, {});
    }
    for (const s of this.slots) if (s.hitK > 0) s.hitK = Math.max(0, s.hitK - dt * 5);
    if (this.fighting) this.checkClink();
    if (L.data && typeof L.data.darkness === 'number') L.data.darkness = damp(L.data.darkness, this.darkT, 1.5, dt);
  }
  /** Posiciona dorso, boca e crochês de acordo com o corpo. */
  syncParts() {
    const s = this.state, b = this.back, m = this.maw;
    // dorso: plataforma vazada (desliga na pancada, inclinada ou invisível)
    const ride = this.ready && this.alpha > 0.6 && Math.abs(this.rot) < 0.15 && s !== 'slam' && s !== 'defeated' && s !== 'dormant';
    b.oneway = ride;
    b.x = this.cx - b.w / 2;                             // simétrico: virar não desloca quem está em cima
    b.y = this.cy - 22;
    // boca: fere só atacando (investida) ou a barriga na queda da pancada
    if (s === 'charge' && this.alpha > 0.4) {
      const f = this.facing;
      m.w = 30; m.h = 30; m.x = this.cx + (f > 0 ? 36 : -66); m.y = this.cy - 14;
      m.enemy = true;
    } else if (s === 'slam') {
      m.w = 104; m.h = 18; m.x = this.cx - 54; m.y = this.cy + 10;
      m.enemy = true;
    } else { m.enemy = false; m.x = this.cx; m.y = this.cy; }
    // crochês
    const hitOk = this.fighting && this.alpha > 0.6;
    for (const sl of this.slots) {
      const p = this.world(sl.lx, sl.ly), e = sl.ent;
      e.x = p.x - e.w / 2; e.y = p.y - e.h / 2;
      e.hittable = hitOk && sl.hp > 0 && sl.sewK >= 1;
    }
  }

  // ---------------------------------------------------------------- desenho
  draw(ctx) {
    this.drawTelegraphs(ctx);
    if (this.alpha <= 0.01) return;
    const t = this.t, s = this.state, f = this.facing;
    const ox = this.x, oy = this.y;
    this.x += this.jx;                                   // tremidinha só no desenho
    const glowA = (this.phase >= 3 ? 0.55 : 0.35) * this.alpha;
    drawGlow(ctx, Rn(this.cx), Rn(this.cy), 90, this.freed ? '#bff6ff' : '#5ac8f0', glowA);
    const anim = this.freed ? 'free' : 'swim';
    const fr = animFrame('whale_body', anim, t * (s === 'charge' ? 2.5 : s === 'tired' ? 0.4 : 1));
    drawSprite(ctx, 'whale_body', anim, fr, Rn(this.cx), Rn(this.cy), {
      flip: f < 0, rotation: this.rot, alpha: this.alpha * (this.freed ? 0.85 : 1),
      variant: this.flash > 0 ? 'flash' : undefined,
    });
    ctx.globalAlpha = this.alpha;
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
    // marcas libertadas + crochês
    if (!this.freed) {
      for (const sc of this.scars) this.drawScar(ctx, sc);
      for (const sl of this.slots) if (sl.hp > 0) this.drawSlot(ctx, sl);
    }
    // dentes (só quando ataca de boca)
    if (s === 'charge' || s === 'lanewarn') {
      ctx.fillStyle = '#ffffff';
      for (let lx = 30; lx <= 58; lx += 5) { const p = this.world(lx, 6 - (lx - 30) * 0.12); ctx.fillRect(Rn(p.x), Rn(p.y), 1, 2); }
      const m = this.mouth();
      drawGlow(ctx, Rn(m.x), Rn(m.y), 14, '#ff9ab4', 0.35);
    }
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
          ctx.fillRect(Rn(this.cx + f * 20 + Math.cos(a) * 18), Rn(this.y - 12 + Math.sin(a) * 4), 2, 2);
        }
      } else {
        const calm = this.freed || s === 'defeated';
        drawGlow(ctx, ex, ey, 9, calm ? CYAN : VIOLET, 0.55 * this.eyeK);
        ctx.fillStyle = calm ? '#e8feff' : '#e0b0ff'; ctx.fillRect(ex - 1, ey - 1, 3, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(ex - 1 + (f > 0 ? 1 : 0), ey - 1, 1, 1);
        if (!calm && (s === 'slamwind' || s === 'ringwind' || s === 'rise' || s === 'charge')) { ctx.fillStyle = '#ff9ab4'; ctx.fillRect(ex - 2, ey - 3, 5, 1); }
      }
    }
    // boca acendendo (anéis)
    if (s === 'ringwind') {
      const m = this.mouth(), k = this.st / (0.85 * this.tele);
      drawGlow(ctx, Rn(m.x), Rn(m.y), Rn(6 + k * 12), '#9fe8ff', 0.4 + k * 0.4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Rn(m.x) - 1, Rn(m.y) - 1, 3, 3);
      for (let i = 0; i < 6; i++) {             // bolhas sugadas para a boca
        const a = i * 1.05 + this.st * 3, r = 24 * (1 - ((this.st * 2 + i / 6) % 1));
        ctx.fillStyle = '#c8fcff'; ctx.fillRect(Rn(m.x + Math.cos(a) * r), Rn(m.y + Math.sin(a) * r), 1, 1);
      }
    }
    // notas do canto
    if (s === 'songprep' || s === 'song') {
      for (let i = 0; i < 4; i++) {
        const k = ((this.t * 0.6 + i / 4) % 1), m = this.world(52, -18);
        const x = Rn(m.x + f * (k * 30 + Math.sin(k * 9 + i) * 4)), y = Rn(m.y - k * 34);
        ctx.fillStyle = i % 2 ? '#e0b0ff' : '#c8fcff';
        ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 1, y - 4, 1, 4); ctx.fillRect(x + 2, y - 4, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    this.x = ox; this.y = oy;
  }
  /** Avisos legíveis antes de cada ataque. */
  drawTelegraphs(ctx) {
    const s = this.state, st = this.st;
    if (s === 'lanewarn') {
      const dur = 1.0 * this.tele, k = Math.min(1, st / dur), blink = Math.floor(st * 14) % 2 === 0;
      const cy = this.laneY(this.lane), y0 = Rn(cy - 14), y1 = Rn(cy + 16);
      const by0 = Rn(cy - HH), by1 = Rn(cy + HH);
      ctx.fillStyle = `rgba(160,230,255,${0.05 + k * 0.06})`; ctx.fillRect(AX0, by0, AX1 - AX0, by1 - by0);
      ctx.fillStyle = `rgba(255,110,140,${0.14 + k * 0.2})`; ctx.fillRect(AX0, y0, AX1 - AX0, y1 - y0);
      ctx.fillStyle = blink ? 'rgba(255,170,190,0.85)' : 'rgba(255,170,190,0.45)';
      const dir = -this.enterSide;
      for (let x = AX0 + ((st * 90 * dir) % 10 + 10) % 10; x < AX1; x += 10) { ctx.fillRect(Rn(x), y0, 5, 1); ctx.fillRect(Rn(x), y1, 5, 1); }
      // setas saindo da parede de entrada
      const ex = this.enterSide < 0 ? AX0 : AX1;
      for (let i = 0; i < 3; i++) {
        const cx = Rn(ex + dir * (14 + i * 14 + ((st * 40) % 14))), cyy = Rn(cy);
        ctx.fillStyle = `rgba(255,220,230,${0.9 - i * 0.2})`;
        for (let j = 0; j < 6; j++) { ctx.fillRect(cx - dir * j, cyy - j, 1, 1); ctx.fillRect(cx - dir * j, cyy + j, 1, 1); }
      }
      // brilho do olho dela "atrás" da parede
      drawGlow(ctx, ex, Rn(cy - 4), Rn(10 + k * 10), '#ff9ab4', 0.3 + k * 0.4);
    }
    if (s === 'returnwarn') {
      const ex = this.enterSide < 0 ? AX0 : AX1;
      drawGlow(ctx, ex, Rn(HOVER_Y), 16, CYAN, 0.35);
    }
    if (s === 'slamwind' || s === 'rise' || s === 'slam') {
      const dur = 0.95 * this.tele;
      const k = s === 'slam' ? 1 : s === 'rise' ? 0.25 : Math.min(1, st / dur);
      const rx = Rn(54 * (0.6 + 0.4 * k));
      fillEllipse(ctx, this.cx, AFLOOR - 2, rx, 3, shadowCol(0.3 + 0.45 * k));
      // contorno rosa piscando: legível mesmo no fundo escuro
      ctx.fillStyle = Math.floor(st * 12) % 2 ? 'rgba(255,150,175,0.9)' : 'rgba(255,220,230,0.6)';
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; ctx.fillRect(Rn(this.cx + Math.cos(a) * (rx + 2)), Rn(AFLOOR - 2 + Math.sin(a) * 4), 2, 1); }
      if (s === 'slamwind') {
        const blink = Math.floor(st * 12) % 2 === 0;
        ctx.fillStyle = blink ? 'rgba(255,150,175,0.8)' : 'rgba(255,150,175,0.4)';
        for (let y = Rn(this.bottom + 4); y < AFLOOR - 4; y += 6) { ctx.fillRect(Rn(this.cx - 54), y, 1, 3); ctx.fillRect(Rn(this.cx + 54), y, 1, 3); }
        // setas para baixo no chão
        for (const dx of [-30, 0, 30]) {
          const x = Rn(this.cx + dx), y = AFLOOR - 10 - (blink ? 2 : 0);
          ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y + 2, 1, 1);
        }
      }
    }
  }
  drawScar(ctx, sc) {
    const p = this.world(sc.lx, sc.ly), x = Rn(p.x), y = Rn(p.y);
    drawGlow(ctx, x, y, 7, CYAN, 0.3 + 0.1 * Math.sin(this.t * 4 + sc.lx));
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; jag(ctx, x, y, x + Math.cos(a) * 6, y + Math.sin(a) * 5, '#e8feff', i + sc.lx); }
  }
  /** Crochê redondo (toalhinha escura) — perde voltas conforme é cortado. */
  drawSlot(ctx, sl) {
    const p = this.world(sl.lx, sl.ly), t = this.t;
    const x = Rn(p.x + (sl.hitK > 0 ? Math.sin(t * 80) * sl.hitK * 2 : 0)), y = Rn(p.y);
    const k = sl.sewK, r = Math.max(0, Math.round(8 * k));
    if (r <= 0) return;
    const hpK = sl.hp / this.patchHp;
    const vuln = this.stunned || this.rider;
    // aura de "alvo" quando ela está cansada (ou quando o Tico está em cima)
    if (k >= 1 && vuln) drawGlow(ctx, x, y, 14, '#ffd23f', 0.25 + 0.15 * Math.sin(t * 8));
    fillEllipse(ctx, x, y, r + 1, r, OUTL);
    fillEllipse(ctx, x, y, r, r - 1, FAB[2]);
    fillEllipse(ctx, x, y, r - 2, r - 3, FAB[1]);
    // borda de crochê (picô) em roxo claro: destaca o alvo sobre o vidro
    ctx.fillStyle = '#d8a8ff';
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.2; ctx.fillRect(Rn(x + Math.cos(a) * (r + 1)), Rn(y + Math.sin(a) * r), 1, 1); }
    // voltas do crochê (pontinhos em anel); somem conforme o PV
    const rings = [[r - 2, 10], [r - 5, 6]];
    rings.forEach(([rr, n], ri) => {
      if (rr <= 0) return;
      for (let i = 0; i < n; i++) {
        if (i / n > hpK + 0.05 && ri === 0) continue;
        const a = (i / n) * Math.PI * 2 + ri * 0.3;
        ctx.fillStyle = (i + ri) % 2 ? STITCH : FAB[2];
        ctx.fillRect(Rn(x + Math.cos(a) * rr), Rn(y + Math.sin(a) * rr * 0.9), 1, 1);
      }
    });
    // miolo: a marca brilhando por baixo do crochê
    ctx.fillStyle = hpK < 0.5 ? '#bff6ff' : FAB[0]; ctx.fillRect(x - 1, y - 1, 2, 2);
    // ponto em X costurado por cima
    ctx.fillStyle = STITCH;
    if (hpK > 0.66) for (let i = -2; i <= 2; i++) { ctx.fillRect(x + i, y + i, 1, 1); ctx.fillRect(x + i, y - i, 1, 1); }
    // fio chegando durante a recostura
    if (k < 1) {
      const sx = sl.lx * this.facing < 0 ? AX0 : AX1, sy = ATOP;
      for (let i = 0; i < 24; i++) { const u = i / 24; if ((i + Math.floor(t * 20)) % 2) ctx.fillRect(Rn(lerp(sx, x, u)), Rn(lerp(sy, y, u) + Math.sin(u * 9 + t * 8) * 2), 1, 1); }
    }
    // contorno piscando quando vulnerável
    if (k >= 1 && vuln && Math.floor(t * 6) % 2 === 0) {
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.fillRect(Rn(x + Math.cos(a) * (r + 3)), Rn(y + Math.sin(a) * (r + 2)), 1, 1); }
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
    // energia de reserva (habilidades / flechas)
    const b = L._whale;
    if (b && b.fighting) {
      this.energyT -= dt;
      if (this.energyT <= 0) {
        this.energyT = 7;
        const have = L.entities.some((e) => !e.dead && e.constructor === R.entities.get('energy') && e.x > AX0 && e.x < AX1);
        if (!have && p.energy < p.maxEnergy * 0.6) {
          this.side ^= 1;
          const x = this.side ? 99 * T : 74 * T;
          L.spawn('energy', x, 12 * T);
          L.particles.emit('sparkle', x + 8, 12 * T + 8, 6);
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
    // na escuridão, degraus e parapeitos ganham um brilho fraco
    if ((L.data.darkness ?? 0) > 0.35) {
      for (const x of [74, 99]) { L.addLight(x * T + 8, 17 * T, 30, CYAN, 0.5); L.addLight(x * T + 8, 13 * T, 24, '#7fd8ff', 0.4); }
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
    if (first) yield* cs.say([{ who: 'tico', expr: 'confused', text: 'Um bolsão de ar no fundo do mar... Que frio. Parece um choro antigo.' }]);
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
        { who: 'baleia', expr: 'sad', text: 'Os crochês doem... mas eles não me deixam soltar nada...' },
        { who: 'tico', expr: 'determined', text: 'Crochês escuros... coisa do Costureiro! Se eu cortar todos, talvez ela se acalme.' },
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
  // ---- arena: bolsão de AR no ventre do oceano (sem pressão de oxigênio na luta)
  fill(70, 0, MW - 1, 5, '#');                 // teto
  fill(70, 6, 72, MH - 1, '#');                // parede esquerda...
  fill(70, 13, 72, 16, '~');                   // ...com o túnel submerso (sai num degrau)
  fill(73, 20, MW - 1, MH - 1, '#');           // chão
  fill(101, 6, MW - 1, 19, '#');               // parede direita
  fill(73, 17, 75, 19, '%'); fill(98, 17, 100, 19, '%');   // degraus de pedra (3 tiles)
  fill(73, 13, 75, 13, '='); fill(98, 13, 100, 13, '=');   // parapeitos
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
  onStart(level) { setupLevel(level); },
});
