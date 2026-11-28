// =============================================================================
// player/weapons.js — As duas armas do Tico (troca com o botão TROCAR / Q / Tab):
//   • 'punch' (Soco): luva de pelúcia, curta, forte e rápida. Combo de 3 golpes,
//     soco p/ cima e p/ baixo no ar (quica em inimigos). Visual: braço curto +
//     luvinha (no sprite 'tico', anims attack*), arco branco de impacto até o
//     alcance real, linhas de velocidade e estrela "pow" no ponto do acerto.
//   • 'bow'   (Arco): toque dispara uma flechinha de linha (horizontal, ou p/ cima
//     segurando ↑), alcance ~220 px, recarga 0.35 s, para em paredes.
// Projétil: entidade 'player_arrow'. Acerta pela MESMA API do ataque corpo a
// corpo — e.onHit(dmg, flecha, { kind: 'arrow' }) ou e.hurt(...) — e, se a
// entidade recusar o tipo 'arrow', tenta de novo como golpe lateral ('side'),
// para nenhum interruptor/abajur/ponto fraco ficar impossível.
// Também define ícones/glifos: icon_wpn_punch, icon_wpn_bow, ctl_punch, ctl_bow,
// ctl_swap e os efeitos fx_glove*, fx_pow*, fx_bow*, fx_arrow*.
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { defineImage, drawImage, getImage } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { rectsOverlap } from '../../engine/util.js';
import { registerEntity } from '../registry.js';

export const WEAPONS = {
  punch: { id: 'punch', name: 'Soco', icon: 'icon_wpn_punch', glyph: 'ctl_punch', color: '#ff6b8a' },
  bow: { id: 'bow', name: 'Arco', icon: 'icon_wpn_bow', glyph: 'ctl_bow', color: '#ffb347' },
};
export const WEAPON_ORDER = ['punch', 'bow'];
export const BOW = { COOLDOWN: 0.35, RANGE: 220, SPEED: 420, DAMAGE: 0.7 };

/** Arma escolhida (persistida em save.data.weapon). */
export function currentWeapon() {
  const w = save.data?.weapon;
  return WEAPONS[w] ? w : 'punch';
}
export function setWeapon(w) {
  if (!WEAPONS[w] || !save.data) return;
  save.data.weapon = w;
}

// ------------------------------------------------------------------ pixel art
const OUT = '#1b2a3a';
const ROT_CCW = (rows) => { // aponta p/ cima o que apontava p/ a direita
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const o = [];
  for (let r = 0; r < w; r++) { let s = ''; for (let c = 0; c < h; c++) s += rows[c][w - 1 - r] || '.'; o.push(s); }
  return o;
};
const ROT_CW = (rows) => { // aponta p/ baixo o que apontava p/ a direita
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const o = [];
  for (let r = 0; r < w; r++) { let s = ''; for (let c = 0; c < h; c++) s += rows[h - 1 - c][r] || '.'; o.push(s); }
  return o;
};
function asciiImg(name, rows, pal, outline = OUT) {
  const w = Math.max(...rows.map((r) => r.length)) + 2, h = rows.length + 2;
  defineImage(name, w, h, (pc) => { pc.ascii(rows, pal, 1, 1); pc.outline(outline); });
}
function scaledImg(name, size, rows, pal, s = 2) {
  defineImage(name, size, size, (pc) => {
    const w = Math.max(...rows.map((r) => r.length)) * s, h = rows.length * s;
    const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2);
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) pc.rect(ox + i * s, oy + j * s, s, s, c); } });
    pc.outline('#1b1030');
  });
}

// luva de pelúcia (aponta p/ a direita): punho amarelo costurado + polegar
const GLOVE = [
  '..HHHRR.',
  '.HWHRRRR',
  'YHHRRRRS',
  'YRRRRRRS',
  'yRRRRRRS',
  'YRTTRRSS',
  '.RTTRSS.',
  '..SSSS..',
];
const GLOVE_PAL = { H: '#ffa8c0', W: '#ffffff', R: '#ff5c84', S: '#c23a5c', T: '#ff8aa8', Y: '#ffd23f', y: '#e0a020' };
asciiImg('fx_glove', GLOVE, GLOVE_PAL);
asciiImg('fx_glove_up', ROT_CCW(GLOVE), GLOVE_PAL);
asciiImg('fx_glove_down', ROT_CW(GLOVE), GLOVE_PAL);
asciiImg('icon_wpn_punch', GLOVE, GLOVE_PAL, '#1b1030');
// glifo do botão de ataque com Soco: luva grande creme com polegar e punho amarelo
defineImage('ctl_punch', 22, 22, (pc) => {
  const CW = '#fff4dc', CS = '#d9bf8f', IN = '#1b1030';
  pc.hline(0, 7, 3, CW); pc.hline(1, 11, 2, CW); pc.hline(0, 15, 3, CW);   // linhas de velocidade
  pc.rect(4, 6, 5, 11, '#ffd23f'); pc.vline(4, 6, 11, '#fff0a0'); pc.vline(8, 6, 11, '#e0a020');
  for (let y = 8; y < 16; y += 3) pc.px(6, y, '#a0701a');                    // pesponto do punho
  pc.ellipse(14, 11, 7, 7, CW);
  pc.ellipse(15.5, 12.5, 5.5, 5.5, CS);
  pc.ellipse(13.5, 10, 5.5, 5.5, CW);
  pc.ellipse(12, 15, 4.2, 2.4, CW);                                          // polegar
  for (let x = 8; x <= 16; x++) { const u = (x - 12) / 4.4; pc.px(x, Math.round(14.6 - 2.6 * Math.sqrt(Math.max(0, 1 - u * u))), IN); }
  pc.px(16, 14, IN); pc.px(16, 15, CS);
  pc.px(12, 6, '#ffffff'); pc.px(11, 7, '#ffffff'); pc.px(13, 6, '#ffffff');
  pc.outline(IN);
});

// estrela "pow" (8 pontas) — grande e pequena
function powImg(name, size, ro, ri) {
  defineImage(name, size, size, (pc) => {
    const c = (size - 1) / 2, pts = [], pts2 = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2 + 0.2, r = i % 2 ? ri : ro;
      pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
      pts2.push([c + Math.cos(a) * r * 0.55, c + Math.sin(a) * r * 0.55]);
    }
    pc.poly(pts, '#ffd23f');
    pc.poly(pts2, '#fffbe0');
    pc.px(Math.round(c), Math.round(c), '#ffffff');
    pc.outline('#7a3a10');
  });
}
powImg('fx_pow', 17, 7.6, 3.6);
powImg('fx_pow_s', 11, 4.6, 2.2);

// arco de linha (barriga p/ a direita, corda à esquerda)
defineImage('fx_bow', 9, 18, (pc) => {
  for (let y = 1; y <= 16; y++) {
    const k = (y - 1) / 15, x = 2 + Math.round(4.4 * Math.sin(Math.PI * k));
    pc.px(x, y, y < 9 ? '#e8b878' : '#a0703a');
    pc.px(x - 1, y, y < 9 ? '#c08a4a' : '#7a4f22');
  }
  pc.rect(5, 7, 2, 4, '#ff6b8a'); pc.px(5, 7, '#ffb0c4');            // empunhadura de retalho
  pc.vline(1, 2, 14, '#fff4dc');                                      // corda de linha
  pc.outline(OUT);
});
defineImage('fx_bow_up', 18, 9, (pc) => {
  for (let x = 1; x <= 16; x++) {
    const k = (x - 1) / 15, y = 6 - Math.round(4.4 * Math.sin(Math.PI * k));
    pc.px(x, y, x < 9 ? '#e8b878' : '#a0703a');
    pc.px(x, y + 1, x < 9 ? '#c08a4a' : '#7a4f22');
  }
  pc.rect(7, 1, 4, 2, '#ff6b8a');
  pc.hline(2, 7, 14, '#fff4dc');
  pc.outline(OUT);
});

// flechinha de linha: ponta de agulha prateada, haste de madeira, penas de retalho
const ARROW = [
  'FF......W..',
  '.FSSSSSSWWt',
  'FF......W..',
];
const ARROW_PAL = { F: '#ff6b8a', S: '#c08a4a', W: '#c8d0e0', t: '#ffffff' };
asciiImg('fx_arrow', ARROW, ARROW_PAL);
asciiImg('fx_arrow_up', ROT_CCW(ARROW), ARROW_PAL);

// ícone do arco (HUD) e glifo do botão de ataque com arco
const BOW_ICON = [
  '..bb.......',
  '.b.s.......',
  'b...s....t.',
  'b....s..WW.',
  'b.FSSSSSW..',
  'b....s.....',
  'b...s......',
  '.b.s.......',
  '..bb.......',
];
const BOW_PAL = { b: '#c08a4a', s: '#fff4dc', F: '#ff6b8a', S: '#e8b878', W: '#c8d0e0', t: '#ffffff' };
asciiImg('icon_wpn_bow', BOW_ICON, BOW_PAL, '#1b1030');
scaledImg('ctl_bow', 22, BOW_ICON, { ...BOW_PAL, b: '#fff4dc', S: '#ffe8c0', F: '#ffd0dc' }, 2);

// glifo TROCAR: duas setas curvas apontando uma para a outra (⇄ arredondado)
const SWAP = [
  '...........A.....',
  '...........AA....',
  '..AAAAAAAAAAAA...',
  '.AAAAAAAAAAAAAA..',
  '.AA........AA....',
  '.AA........A.....',
  '.AA..............',
  '..............BB.',
  '.....B........BB.',
  '....BB........BB.',
  '..BBBBBBBBBBBBBB.',
  '...BBBBBBBBBBBB..',
  '....BB...........',
  '.....B...........',
];
defineImage('ctl_swap', 19, 16, (pc) => { pc.ascii(SWAP, { A: '#fff4dc', B: '#ffe0a8' }, 1, 1); pc.outline('#1b1030'); });

// ------------------------------------------------------------------ desenho
const R0 = Math.round;
const BODY = '#3fc7c0', BODY_L = '#7fe6df';

/** Fração de extensão do soco (0..1) a partir do tempo decorrido. */
function punchExtent(el, total) {
  if (el < 0.045) return el / 0.045;
  if (el < 0.13) return 1;
  return Math.max(0, 1 - (el - 0.13) / Math.max(0.05, total - 0.13));
}

/** Geometria do soco atual (ombro, direção, ponta da luva). */
export function punchGeom(p) {
  const kind = p.attackKind;
  if (!(p.attackT > 0) || !kind || kind === 'needle') return null;
  const total = p.attackTotal || 0.22;
  const el = total - p.attackT;
  const k = punchExtent(el, total);
  const f = p.facing;
  let sx, sy, dx = 0, dy = 0, reach;
  if (kind === 'up') { sx = p.cx + f * 2; sy = p.y + 4; dy = -1; reach = 16; }
  else if (kind === 'down') { sx = p.cx + f * 2; sy = p.bottom - 6; dy = 1; reach = 14; }
  else {
    const big = kind === 'side3';
    sx = p.cx + f * 4; sy = p.bottom - (kind === 'side2' ? 12 : 10); dx = f; reach = big ? 24 : 20;
  }
  const L = R0(reach * k);
  return { kind, el, total, k, sx: R0(sx), sy: R0(sy), dx, dy, L, ex: R0(sx + dx * L), ey: R0(sy + dy * L) };
}

/**
 * Efeitos do soco (coordenadas de MUNDO). O braço curto + luvinha fazem parte do
 * próprio sprite do Tico (anims attack*); aqui só desenhamos o alcance: um arco
 * branco ("swoosh") que corre até o fim da caixa de acerto + 2–3 linhas de velocidade.
 */
export function drawPunch(ctx, p) {
  const g = punchGeom(p);
  if (!g) return;
  const box = p.attackBox?.();
  const { dx, dy, el } = g;
  const a0 = ctx.globalAlpha;
  const big = g.kind === 'side3';
  // ponto de partida: logo à frente da luvinha (≈ 10 px do corpo)
  const ox = dx ? R0(p.cx + dx * 14) : R0(p.cx + p.facing * 3);
  const oy = dy < 0 ? R0(p.y - 4) : dy > 0 ? R0(p.bottom + 4) : R0(p.bottom - (g.kind === 'side2' ? 14 : 12));
  // linhas de velocidade (2–3) logo no início do golpe
  if (el < 0.12) {
    ctx.globalAlpha = a0 * (1 - el / 0.12) * 0.9;
    ctx.fillStyle = '#ffffff';
    const n = big ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 5, len = 7 + (i % 2) * 3;
      const lead = R0(el * 120);
      if (dx) ctx.fillRect(dx > 0 ? ox - 4 + lead : ox + 4 - lead - len, oy + R0(off), len, 1);
      else ctx.fillRect(ox + R0(off), dy < 0 ? oy + 4 - lead - len : oy - 4 + lead, 1, len);
    }
  }
  // arco de impacto ")" correndo até o alcance real
  if (box && el >= 0.03 && el <= 0.17) {
    const t = (el - 0.03) / 0.14;
    ctx.globalAlpha = a0 * (1 - t * 0.8);
    const half = R0((big ? 10 : 7) - t * 2);
    const bend = big ? 4 : 3;
    const cols = big ? ['#fff0a0', '#ffffff'] : ['#ffffff', '#d8f8ff'];
    if (dx) {
      const far = dx > 0 ? box.x + box.w - 3 : box.x + 3;
      const cx = R0(ox + (far - ox) * t);
      for (let j = -half; j <= half; j++) {
        const off = R0((1 - (j * j) / (half * half)) * bend);
        ctx.fillStyle = cols[0]; ctx.fillRect(cx + dx * off, oy + j, 1, 1);
        if (Math.abs(j) < half - 1) { ctx.fillStyle = cols[1]; ctx.fillRect(cx + dx * (off - 1), oy + j, 1, 1); }
      }
    } else {
      const far = dy < 0 ? box.y + 3 : box.y + box.h - 3;
      const cy = R0(oy + (far - oy) * t);
      for (let j = -half; j <= half; j++) {
        const off = R0((1 - (j * j) / (half * half)) * bend);
        ctx.fillStyle = cols[0]; ctx.fillRect(ox + j, cy + dy * off, 1, 1);
        if (Math.abs(j) < half - 1) { ctx.fillStyle = cols[1]; ctx.fillRect(ox + j, cy + dy * (off - 1), 1, 1); }
      }
    }
  }
  ctx.globalAlpha = a0;
}

/** Estrelas "pow" dos acertos (lista em p.pows: {x,y,t,big}). */
export function drawPows(ctx, pows) {
  for (const w of pows) {
    const life = w.big ? 0.26 : 0.2;
    const k = w.t / life;
    if (k >= 1) continue;
    const name = k < 0.25 ? 'fx_pow_s' : w.big || k < 0.6 ? 'fx_pow' : 'fx_pow_s';
    const im = getImage(name);
    if (!im) continue;
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    ctx.drawImage(im, R0(w.x - im.width / 2), R0(w.y - im.height / 2));
    // raiozinhos
    if (k > 0.2 && k < 0.8) {
      ctx.fillStyle = '#ffffff';
      const r = R0(im.width / 2 + 2 + k * 4);
      ctx.fillRect(R0(w.x) - r, R0(w.y), 2, 1); ctx.fillRect(R0(w.x) + r - 1, R0(w.y), 2, 1);
      ctx.fillRect(R0(w.x), R0(w.y) - r, 1, 2); ctx.fillRect(R0(w.x), R0(w.y) + r - 1, 1, 2);
    }
    ctx.globalAlpha = a0;
  }
}

/** Arco nas mãos do Tico logo após atirar (ou carregando a Agulhada). */
export function drawBow(ctx, p) {
  if (p.weaponId !== 'bow') return;
  const charging = p.chargeT > 0.15;
  if (!(p.bowT > 0) && !charging) return;
  const f = p.facing;
  const a0 = ctx.globalAlpha;
  if (!charging && p.bowT < 0.08) ctx.globalAlpha = a0 * (p.bowT / 0.08);
  const twang = p.bowT > 0.2 ? (Math.floor(p.bowT * 60) % 2 ? 1 : -1) : 0;
  if (p.bowUp && !charging) {
    const x = R0(p.cx - 9 + f * 3), y = R0(p.y - 17);
    drawImage(ctx, 'fx_bow_up', x, y);
    if (twang) { ctx.fillStyle = '#fff4dc'; ctx.fillRect(x + 3, y + 7 + twang, 12, 1); }
  } else {
    const x = R0(f > 0 ? p.cx + 6 : p.cx - 15), y = R0(p.cy - 8);
    drawImage(ctx, 'fx_bow', x, y, { flip: f < 0 });
    if (twang) { ctx.fillStyle = '#fff4dc'; ctx.fillRect(f > 0 ? x + 1 + twang : x + 7 + twang, y + 2, 1, 14); }
  }
  ctx.globalAlpha = a0;
}

// ------------------------------------------------------------------ projétil
function canHit(e, arrow) {
  return !e.dead && e.hittable && e !== arrow && e !== arrow.owner && !e.isPlayer && !e.isDecoy && !e.isPlayerShot;
}

registerEntity('player_arrow', class PlayerArrow extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.dx = props.dx ?? 1; this.dy = props.dy ?? 0;
    const horiz = this.dy === 0;
    this.w = horiz ? 12 : 6; this.h = horiz ? 6 : 12;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.speed = props.speed || BOW.SPEED;
    this.range = props.range || BOW.RANGE;
    this.damage = props.damage ?? BOW.DAMAGE;
    this.owner = props.owner || null;
    this.dist = 0;
    this.z = 55; this.alwaysUpdate = true;
    this.isPlayerShot = true;
    this.hitSet = new Set();
  }
  /** Para entidades que medem o golpe pelo retângulo do ataque (ex.: pontos fracos de chefes). */
  attackBox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get vx() { return this.dx * (this.speed || 0); }
  set vx(v) { /* velocidade fixa */ }
  get facing() { return this.dx || (this.owner?.facing ?? 1); }
  set facing(v) { /* idem */ }
  poof(spark = true) {
    if (spark) this.level.particles.emit('hit', this.cx + this.dx * 4, this.cy + this.dy * 4, 3, { colors: ['#fff4dc', '#c8d0e0'] });
    else this.level.particles.emit('thread', this.cx, this.cy, 2, { colors: ['#ff6b8a', '#fff4dc'], speed: [5, 25] });
    this.remove();
  }
  update(dt) {
    this.t += dt;
    const total = this.speed * dt;
    const n = Math.max(1, Math.ceil(total / 5));
    const st = total / n;
    for (let i = 0; i < n; i++) {
      this.x += this.dx * st; this.y += this.dy * st; this.dist += st;
      if (this.tryHits()) return;
      if (this.level.map.rectSolid(this.x + 1, this.y + 1, this.w - 2, this.h - 2)) { audio.sfx('armor_clink', { vol: 0.25, pitch: 1.6, cooldown: 0.05 }); this.poof(true); return; }
      for (const s of this.level.solids) {
        if (s.dead || s.oneway || !s.solid || s.hittable || s === this.owner) continue;
        if (rectsOverlap(this, s)) { this.poof(true); return; }
      }
      if (this.dist >= this.range || this.t > 2) { this.poof(false); return; }
    }
    if (Math.random() < 0.35) this.level.particles.emit('thread', this.cx - this.dx * 6, this.cy - this.dy * 6, 1, { colors: ['#ff8aa8', '#fff4dc'], speed: [0, 8] });
  }
  tryHits() {
    for (const e of this.level.entities) {
      if (!canHit(e, this) || this.hitSet.has(e) || !rectsOverlap(this, e)) continue;
      this.hitSet.add(e);
      let res = e.onHit ? e.onHit(this.damage, this, { kind: 'arrow', ranged: true }) : e.hurt(this.damage, this, { knockback: 90 });
      // compatibilidade: quem só aceita golpes corpo a corpo recebe como golpe lateral
      if (res === false && e.onHit && !e.dead) res = e.onHit(this.damage, this, { kind: 'side', ranged: true });
      const p = this.owner;
      if (res !== false) {
        audio.sfx('hit', { randomPitch: 0.1, pitch: 1.15 });
        if (p?.pows) p.pows.push({ x: this.cx + this.dx * 5, y: this.cy + this.dy * 5, t: 0, big: false });
        this.level.particles.emit('fabric', e.cx, e.cy, 2);
        if (p) p.unravelMeter = Math.min(1, (p.unravelMeter || 0) + 0.015 * (p.stats?.unravelCharge || 1));
        this.level.hitstop?.(0.02);
        this.remove();
        return true;
      }
      // bloqueado (armadura, escudo...): a flecha quica e some
      this.poof(true);
      return true;
    }
    return false;
  }
  draw(ctx) {
    const a0 = ctx.globalAlpha;
    const left = this.range - this.dist;
    if (left < 30) ctx.globalAlpha = a0 * Math.max(0.2, left / 30);
    if (this.dy) {
      drawImage(ctx, 'fx_arrow_up', R0(this.cx - 2.5), R0(this.y));
      ctx.fillStyle = '#ff8aa8'; ctx.fillRect(R0(this.cx), R0(this.y + this.h + 2), 1, 3);
    } else {
      drawImage(ctx, 'fx_arrow', R0(this.cx - 7), R0(this.cy - 2.5), { flip: this.dx < 0 });
      ctx.fillStyle = '#ff8aa880';
      const tx = this.dx > 0 ? R0(this.x - 6) : R0(this.x + this.w + 2);
      ctx.fillRect(tx, R0(this.cy) + (Math.floor(this.t * 30) % 2), 4, 1);
    }
    ctx.globalAlpha = a0;
  }
});
