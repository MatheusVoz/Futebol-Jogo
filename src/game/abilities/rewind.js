// =============================================================================
// abilities/rewind.js — REMENDO TEMPORAL
//
// Habilidade 'rewind' (custo 35, recarga 4 s). Infraestrutura de histórico:
//   RewindRecorder (entidade invisível, uma por fase) grava `captureState()` a cada
//   0.1 s de toda entidade com `rewindable = true` (guarda ~4 s em e._rwHist).
//   Ao usar (raio 6 tiles ao redor do Tico) as entidades afetadas tocam o histórico
//   AO CONTRÁRIO em 0.6 s até o estado de ~3 s atrás (restoreState a cada quadro;
//   durante a volta `e.rewinding = true` — pare sua lógica nesse caso).
//   Projéteis inimigos `reflectable` no raio chamam `reflect()`.
//   Regras: não afeta o jogador nem inimigos; `sealed = true` (selo roxo) bloqueia;
//   histórico limitado (3 s); sem nada para voltar, não gasta energia.
// Contrato para outras entidades: rewindable=true + captureState()→objeto NOVO +
//   restoreState(s); opcionais onRewindStart() / onRewound().
// Entidades deste módulo:
//   crumble        'C'  bloco que treme 0.5 s quando pisado e desmorona em pedaços;
//                       volta após 5 s (props.noRespawn = nunca). props.sealed.
//   rewind_bridge       fileira de tábuas (props.width tiles, topo = topo da célula) que
//                       desaba em cascata quando pisada (props.noStep desliga) ou com
//                       props.signal (props.from='right' começa pela direita).
//                       props.respawn = s para refazer sozinha.
//   boulder             novelo gigante (24 px): golpe empurra, rola, cai, esmaga
//                       'breakable', fere inimigos, pesa em placas. props.signal (+dir,
//                       speed) o faz rolar. Cai no abismo → volta à origem após 4 s
//                       (props.noRespawn = some).
//   ab_test_turret      canhão de teste (atira projéteis refletíveis) — só fases teste.
// Fase de teste: ?level=test_ab_rewind&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, approach, makeRng, rectsOverlap } from '../../engine/util.js';
import { defineImage, drawImage, getImage } from '../../engine/sprites.js';
import { audio } from '../../engine/audio.js';
import { game } from '../../engine/game.js';
import { save } from '../../engine/save.js';
import { registerAbility, registerEntity, registerLevel } from '../registry.js';
import { Enemy, EnemyProjectile } from '../enemies/base.js';
import { buildTestMap } from './stitch.js';
import * as VFX from '../art/vfx.js';

// ----------------------------------------------------------------- ajustes
const COST = 35, COOLDOWN = 4;
const RADIUS = 6 * TILE;          // alcance (px) a partir do centro do Tico
const SAMPLE = 0.1;               // intervalo de gravação (s)
const KEEP = 40;                  // amostras guardadas (~4 s)
const BACK = 30;                  // amostras voltadas (~3 s)
const PLAY = 0.6;                 // duração da volta (s)
const BLUE = '#7fe6ff', SEPIA = '#d8b078', SEAL = '#a855ff';
const GHOST_FILTER = 'sepia(1) hue-rotate(165deg) saturate(1.8) brightness(1.15)';
const Rn = Math.round;

/** Distância do ponto (px,py) ao retângulo da entidade. */
function rectDist(e, px, py) {
  const dx = Math.max(e.x - px, 0, px - (e.x + e.w));
  const dy = Math.max(e.y - py, 0, py - (e.y + e.h));
  return Math.hypot(dx, dy);
}
/** Corpo apoiado em cima do retângulo r? */
function standsOn(b, r) {
  return b && !b.dead && b.grounded && Math.abs(b.y + b.h - r.y) < 1.5 && b.x + b.w > r.x + 1 && b.x < r.x + r.w - 1;
}
/** Algum corpo (jogador, cópia, objeto pesado) em cima de r? */
function loaded(level, r) {
  if (standsOn(level.player, r) || standsOn(level.decoy, r)) return true;
  for (const e of level.entities) if (e.weight && e !== r && standsOn(e, r)) return true;
  return false;
}
/** Tira jogador/cópia de dentro de um sólido que acabou de reaparecer. */
function unstick(level, s) {
  for (const b of [level.player, level.decoy]) {
    if (!b || b.dead || !rectsOverlap(b, s)) continue;
    if (b.y + b.h / 2 < s.y + s.h / 2) { b.y = s.y - b.h; b.vy = Math.min(b.vy, 0); }
    else if (b.x + b.w / 2 < s.x + s.w / 2) b.x = s.x - b.w;
    else b.x = s.x + s.w;
  }
}

// ----------------------------------------------------------------- arte
defineImage('rw_seal', 9, 9, (pc) => {
  pc.circle(4, 4, 4, '#6a2aa8');
  pc.circle(4, 4, 3, SEAL);
  pc.px(3, 2, '#d8b0ff'); pc.px(2, 3, '#d8b0ff');
  pc.rect(3, 3, 3, 3, '#3a1060'); pc.px(4, 6, '#3a1060');   // fechadura
  pc.px(4, 4, '#ffd23f');
  pc.outline('#1a0830');
});
defineImage('crumble_block', 16, 16, (pc) => {
  pc.rect(0, 0, 16, 16, '#7a4a28');
  pc.rect(1, 5, 14, 10, '#a0703e');
  pc.hline(1, 5, 14, '#c89058');
  for (const x of [5, 10]) pc.vline(x, 5, 10, '#6a3e1c');
  pc.px(2, 7, '#e8dcc0'); pc.px(13, 7, '#e8dcc0'); pc.px(7, 12, '#e8dcc0');
  // retalho de tecido no topo (rosa, costura clara)
  pc.rect(0, 0, 16, 5, '#c8506a'); pc.hline(0, 0, 16, '#f08aa4'); pc.hline(0, 4, 16, '#8a2c48');
  for (let i = 1; i < 16; i += 3) pc.px(i, 2, '#ffe7c8');
  // rachaduras
  for (const [x, y] of [[3, 9], [4, 10], [4, 11], [11, 7], [12, 8], [12, 9], [8, 13]]) pc.px(x, y, '#3e2210');
  pc.strokeRect(0, 0, 16, 16, '#2e1a0c');
});
defineImage('crumble_crack', 16, 16, (pc) => {
  const C = '#1e0e06';
  for (const [x, y] of [[2, 5], [3, 6], [3, 7], [4, 8], [6, 9], [7, 9], [8, 10], [9, 11], [12, 5], [12, 6], [11, 7], [13, 8], [13, 9], [6, 2], [7, 3], [5, 12], [5, 13]]) pc.px(x, y, C);
});
defineImage('rw_plank', 16, 6, (pc) => {
  pc.rect(0, 0, 16, 6, '#9a6a3a');
  pc.hline(0, 0, 16, '#d0a066'); pc.hline(0, 5, 16, '#5e3a1a');
  pc.hline(2, 3, 5, '#7e5228'); pc.hline(9, 2, 4, '#7e5228');
  pc.rect(6, 1, 4, 3, '#4a7fe0'); pc.px(6, 1, '#7fa8f0'); pc.px(7, 2, '#ffe7c8'); pc.px(8, 2, '#ffe7c8');   // remendo azul
  pc.px(1, 2, '#e8dcc0'); pc.px(14, 2, '#e8dcc0');
  pc.strokeRect(0, 0, 16, 6, '#2e1a0c');
});
// novelo gigante (12 quadros de rotação)
const YARN = ['#e0506e', '#ff8aa4', '#a02c4a', '#ffd0dc'];
for (let i = 0; i < 12; i++) {
  defineImage('rw_boulder_' + i, 26, 26, (pc) => {
    const c = 12.5, r = 11.5, rot = (i / 12) * Math.PI * 2;
    pc.circle(c, c, r, YARN[0]);
    for (let s = 0; s < 5; s++) {
      const tilt = rot + s * 0.63, k = 0.25 + (s % 3) * 0.22;
      for (let t = 0; t < Math.PI * 2; t += 0.05) {
        const ex = (r - 1.5) * Math.cos(t), ey = (r - 1.5) * k * Math.sin(t);
        const x = c + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = c + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        pc.px(Math.floor(x), Math.floor(y), Math.sin(t) > 0 ? YARN[2] : YARN[1]);
      }
    }
    // sombra (baixo-direita) e brilho fixo (cima-esquerda)
    for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
      if (d < r && dx + dy > r * 0.75 && (x + y) % 2 === 0) pc.px(x, y, '#7a1c36');
    }
    pc.circle(c - 4, c - 4, 2, YARN[3]);
    // ponta solta do fio
    const ax = c + Math.cos(rot) * r, ay = c + Math.sin(rot) * r;
    pc.px(Math.floor(ax), Math.floor(ay), YARN[1]);
    pc.outline('#3a0c1c');
  });
}

// ============================================================================
// GRAVADOR (infraestrutura do histórico)
// ============================================================================
class RewindRecorder extends Entity {
  constructor(level) {
    super(level, 0, 0, {});
    this.w = 0; this.h = 0; this.z = 46;
    this.alwaysUpdate = true; this.alwaysDraw = true;
    this.acc = 0; this.plays = []; this.ripple = null;
  }
  get busy() { return this.plays.length > 0; }
  update(dt) {
    this.t += dt;
    if (this.ripple && (this.ripple.t += dt) > PLAY + 0.4) this.ripple = null;
  }
  lateUpdate(dt) {
    // ---- reprodução ao contrário
    if (this.plays.length) {
      for (const pl of this.plays) {
        pl.t += dt;
        const k = Math.min(1, pl.t / PLAY), ke = 1 - (1 - k) * (1 - k);
        const n = pl.frames.length;
        const idx = Math.round((1 - ke) * (n - 1));
        const e = pl.e;
        if (e.dead) { pl.done = true; continue; }
        try { e.restoreState(pl.frames[idx]); } catch (err) { console.error('[rewind]', err); pl.done = true; }
        if ((pl.tick = (pl.tick || 0) + 1) % 3 === 0) {
          pl.trail.push({ x: e.x, y: e.y });
          if (pl.trail.length > 5) pl.trail.shift();
        }
        if (Math.random() < 0.35) this.level.particles.emit('rewind_glyph', e.x + Math.random() * e.w, e.y + Math.random() * e.h, 1);
        if (k >= 1) {
          pl.done = true;
          e.rewinding = false;
          e._rwHist = e._rwHist.slice(0, pl.ti + 1);
          e._rwDirty = false;
          e.onRewound?.();
          this.level.particles.emit('sparkle', e.x + e.w / 2, e.y + e.h / 2, 4, { colors: [BLUE, '#ffffff'] });
        }
      }
      for (const pl of this.plays) if (pl.done) pl.e.rewinding = false;
      this.plays = this.plays.filter((pl) => !pl.done);
    }
    // ---- gravação
    this.acc += dt;
    if (this.acc < SAMPLE) return;
    this.acc = this.acc > SAMPLE * 3 ? 0 : this.acc - SAMPLE;
    for (const e of this.level.entities) {
      if (!e.rewindable || e.dead || e.rewinding || !e.captureState) continue;
      const h = e._rwHist || (e._rwHist = []);
      h.push(e.captureState());
      if (h.length > KEEP) h.shift();
      e._rwDirty = h.length > 1 && JSON.stringify(h[h.length - 1]) !== JSON.stringify(h[Math.max(0, h.length - 1 - BACK)]);
    }
  }
  /** Separa o que está no raio: alvos válidos, selados e projéteis. */
  scan(p) {
    const cx = p.cx, cy = p.cy, targets = [], sealed = [], shots = [];
    for (const e of this.level.entities) {
      if (e.dead || e === p || e.isPlayer) continue;
      if (e instanceof EnemyProjectile) {
        if (e.reflectable && !e.reflected && rectDist(e, cx, cy) <= RADIUS) shots.push(e);
        continue;
      }
      if (!e.rewindable || e.enemy || e instanceof Enemy || e.rewinding || rectDist(e, cx, cy) > RADIUS) continue;
      if (e.sealed) { if (e._rwDirty) sealed.push(e); continue; }
      if (e._rwDirty && e._rwHist?.length > 1) targets.push(e);
    }
    return { targets, sealed, shots };
  }
  start(p, targets, shots, sealed) {
    this.ripple = { x: p.cx, y: p.cy, t: 0, full: true };
    for (const e of targets) {
      const h = e._rwHist, ti = Math.max(0, h.length - 1 - BACK);
      e.rewinding = true;
      e.onRewindStart?.();
      this.plays.push({ e, frames: h.slice(ti), ti, t: 0, trail: [] });
    }
    for (const s of shots) if (s.reflect()) {
      this.level.particles.emit('rewind_glyph', s.cx, s.cy, 3);
      VFX.spawnImpact(this.level, s.cx, s.cy, { color: BLUE, size: 8 });
    }
    for (const e of sealed) this.sealFx(e);
    VFX.spawnShockwave(this.level, p.cx, p.cy, { radius: RADIUS, color: BLUE, color2: '#ffffff', dur: 0.5, particles: false });
    this.level.particles.emit('rewind_glyph', p.cx, p.cy, 14, { speed: [30, 90] });
    this.level.flash('#bfe8ff', 0.12);
  }
  fizzle(p, sealed) {
    this.ripple = { x: p.cx, y: p.cy, t: PLAY * 0.5, full: false };
    for (const e of sealed) this.sealFx(e);
    this.level.particles.emit('rewind_glyph', p.cx, p.cy, 4);
  }
  sealFx(e) {
    this.level.particles.emit('ghost_patch', e.x + e.w / 2, e.y + 2, 6, { colors: [SEAL, '#d8b0ff'] });
    e._sealPulse = 0.6;
  }
  draw(ctx) {
    const L = this.level, cam = L.camera;
    // ---- ondulação: disco sépia + aro azul + mostrador de relógio girando ao contrário
    if (this.ripple) {
      const rp = this.ripple, k = Math.min(1, rp.t / 0.3);
      const r = Math.max(2, Rn(RADIUS * (1 - (1 - k) * (1 - k) * (1 - k)) * (rp.full ? 1 : 0.4)));
      const fade = rp.t < PLAY ? 1 : Math.max(0, 1 - (rp.t - PLAY) / 0.4);
      const pa = ctx.globalAlpha, cx = Rn(rp.x), cy = Rn(rp.y);
      ctx.globalAlpha = pa * 0.2 * fade;
      ctx.fillStyle = SEPIA;
      for (let dy = -r; dy <= r; dy++) {
        const hw = Math.floor(Math.sqrt(r * r - dy * dy));
        ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
      }
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pa * 0.85 * fade;
      ctx.fillStyle = BLUE;
      const N = Math.max(16, Rn(r * 2.4));
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        ctx.fillRect(Rn(cx + Math.cos(a) * r), Rn(cy + Math.sin(a) * r), 1, 1);
        if (i % 2 === 0) ctx.fillRect(Rn(cx + Math.cos(a) * (r - 2)), Rn(cy + Math.sin(a) * (r - 2)), 1, 1);
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 12; i++) {      // marcas de hora
        const a = (i / 12) * Math.PI * 2, l = i % 3 === 0 ? 4 : 2;
        for (let j = 0; j < l; j++) ctx.fillRect(Rn(cx + Math.cos(a) * (r - 5 - j)), Rn(cy + Math.sin(a) * (r - 5 - j)), 1, 1);
      }
      ctx.fillStyle = '#d8f6ff';
      for (const [len, sp] of [[r * 0.55, 14], [r * 0.35, 4]]) {   // ponteiros (anti-horário)
        const a = -Math.PI / 2 - rp.t * sp;
        for (let j = 0; j < len; j++) ctx.fillRect(Rn(cx + Math.cos(a) * j), Rn(cy + Math.sin(a) * j), 1, 1);
      }
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = pa;
    }
    // ---- rastros fantasma das entidades voltando no tempo
    for (const pl of this.plays) {
      const e = pl.e;
      pl.trail.forEach((g, i) => {
        if (Math.abs(g.x - e.x) + Math.abs(g.y - e.y) < 2) return;
        ctx.save();
        ctx.globalAlpha = 0.12 + i * 0.06;
        ctx.filter = GHOST_FILTER;
        ctx.translate(Rn(g.x - e.x), Rn(g.y - e.y));
        try { e.draw(ctx); } catch (err) { /* desenho alheio */ }
        ctx.restore();
      });
    }
    // ---- selos roxos + prévia do alcance
    if (!save.data.abilities?.rewind) return;
    const p = L.player;
    const showPrev = p && save.data.equippedAbility === 'rewind' && p.state === 'normal' && !this.busy;
    for (const e of L.entities) {
      if (!e.rewindable || e.dead || !cam.visible(e.x, e.y, e.w, e.h, 16)) continue;
      const tx = Rn(e.x + e.w / 2), ty = Rn(e.y) - 6;
      if (e.sealed) {
        if (e._sealPulse > 0) e._sealPulse -= 1 / 60;
        const bob = Rn(Math.sin(this.t * 3 + e.x) * 1);
        if (e._sealPulse > 0) VFX.drawGlow(ctx, tx, ty + bob, 8, SEAL, e._sealPulse);
        drawImage(ctx, 'rw_seal', tx - 4, ty - 4 + bob);
      } else if (showPrev && e._rwDirty && rectDist(e, p.cx, p.cy) <= RADIUS) {
        // pequeno relógio: este objeto pode voltar no tempo
        const a = -this.t * 6;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#1b2a3a'; ctx.fillRect(tx - 3, ty - 3, 7, 7);
        ctx.fillStyle = BLUE; ctx.fillRect(tx - 2, ty - 3, 5, 1); ctx.fillRect(tx - 2, ty + 3, 5, 1);
        ctx.fillRect(tx - 3, ty - 2, 1, 5); ctx.fillRect(tx + 3, ty - 2, 1, 5);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, ty, 1, 1);
        ctx.fillRect(Rn(tx + Math.cos(a) * 2), Rn(ty + Math.sin(a) * 2), 1, 1);
        ctx.globalAlpha = 1;
      }
    }
    if (showPrev && p.cooldownOf('rewind') <= 0) {   // aro pontilhado do alcance
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = BLUE;
      const ph = this.t * 0.3;
      for (let i = 0; i < 48; i++) {
        const a = ph + (i / 48) * Math.PI * 2;
        ctx.fillRect(Rn(p.cx + Math.cos(a) * RADIUS), Rn(p.cy + Math.sin(a) * RADIUS), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }
}
registerEntity('rewind_recorder', RewindRecorder);

function recorderOf(level) {
  if (!level?.add) return null;
  if (!level._rwRec || level._rwRec.dead || level._rwRec.level !== level) level._rwRec = level.add(new RewindRecorder(level));
  return level._rwRec;
}
game.events?.on?.('levelStart', (level) => recorderOf(level));

// ============================================================================
// CRUMBLE — bloco que desmorona ('C')
// ============================================================================
const CR_SHAKE = 0.5, CR_RESPAWN = 5, CR_G = 520;
class Crumble extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 16; this.h = 16; this.solid = true; this.z = 8;
    this.rewindable = true; this.sealed = !!p.sealed;
    this.st = 'idle'; this.timer = 0; this.bt = 0; this.popT = 0;
    const rng = makeRng((x * 31 + y * 17) | 0 || 7);
    this.pieces = [];
    for (let i = 0; i < 7; i++) {
      this.pieces.push({ sx: rng.int(0, 11), sy: rng.int(0, 11), s: rng.int(3, 5), vx: rng.range(-45, 45), vy: rng.range(-90, -20) });
    }
  }
  captureState() { return { st: this.st, timer: this.timer, bt: this.bt }; }
  restoreState(s) {
    const was = this.st;
    this.st = s.st; this.timer = s.timer; this.bt = s.bt;
    this.applySolid();
    if (was === 'broken' && s.st !== 'broken') this.popT = 0.25;
  }
  applySolid() {
    const want = this.st !== 'broken';
    if (want === this.solid) return;
    this.solid = want;
    if (want) unstick(this.level, this);
    this.level.refreshSolids();
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.popT > 0) this.popT -= dt;
    if (this.rewinding) return;
    const L = this.level;
    if (this.st === 'idle') {
      if (loaded(L, this)) { this.st = 'shake'; this.timer = CR_SHAKE; audio.sfx('crumble', { pitch: 1.4, vol: 0.45, cooldown: 0.08 }); }
    } else if (this.st === 'shake') {
      this.timer -= dt;
      if (Math.random() < dt * 14) L.particles.emit('dust', this.x + Math.random() * 16, this.bottom, 1, { colors: ['#c89058', '#e8dcc0'] });
      if (this.timer <= 0) this.crumble();
    } else if (this.st === 'broken') {
      this.bt = Math.min(3, this.bt + dt);
      if (!this.props.noRespawn) {
        this.timer -= dt;
        const blocked = [L.player, L.decoy].some((b) => b && !b.dead && rectsOverlap(b, this));
        if (this.timer <= 0 && !blocked) {
          this.st = 'idle'; this.applySolid(); this.popT = 0.3;
          L.particles.emit('fluff', this.cx, this.cy, 5);
          audio.sfx('secret_soft', { vol: 0.35, pitch: 1.3 });
        }
      }
    }
  }
  crumble() {
    this.st = 'broken'; this.bt = 0; this.timer = CR_RESPAWN;
    this.applySolid();
    audio.sfx('crumble', { cooldown: 0.05 });
    const L = this.level;
    L.particles.emit('fabric', this.cx, this.cy, 6, { colors: ['#c8506a', '#f08aa4', '#a0703e', '#7a4a28'] });
    L.particles.emit('dust', this.cx, this.bottom, 4);
  }
  draw(ctx) {
    const x = Rn(this.x), y = Rn(this.y);
    if (this.st !== 'broken') {
      const sh = this.st === 'shake' ? Rn(Math.sin(this.t * 70) * (1 - this.timer / CR_SHAKE + 0.3)) : 0;
      if (this.popT > 0) VFX.drawGlow(ctx, x + 8, y + 8, 12, BLUE, this.popT * 2);
      drawImage(ctx, 'crumble_block', x + sh, y);
      if (this.st === 'shake') drawImage(ctx, 'crumble_crack', x + sh, y, { alpha: Math.min(1, 1.2 - this.timer / CR_SHAKE) });
      if (this.popT > 0) drawImage(ctx, 'crumble_block', x, y, { alpha: this.popT * 2 });
      return;
    }
    // contorno tracejado de onde o bloco estava (azul se o Tico conhece o Remendo)
    ctx.fillStyle = save.data.abilities?.rewind ? BLUE : '#e8dcc0';
    ctx.globalAlpha = 0.22 + (this.timer < 1 && !this.props.noRespawn ? (Math.floor(this.t * 10) % 2) * 0.3 : 0);
    for (let i = 0; i < 16; i += 3) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i, y + 15, 2, 1); ctx.fillRect(x, y + i, 1, 2); ctx.fillRect(x + 15, y + i, 1, 2); }
    ctx.globalAlpha = 1;
    // pedaços caindo (posição é função do tempo → voltar no tempo os faz subir de volta)
    this.drawPieces(ctx, this.bt, 1);
    if (this.rewinding) { this.drawPieces(ctx, this.bt + 0.05, 0.35); this.drawPieces(ctx, this.bt + 0.1, 0.18); }
  }
  drawPieces(ctx, bt, alpha) {
    if (bt > 1.6) return;
    const img = getImage('crumble_block');
    if (!img) return;
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * alpha;
    for (const pc of this.pieces) {
      const px = Rn(this.x + pc.sx + pc.vx * bt), py = Rn(this.y + pc.sy + pc.vy * bt + 0.5 * CR_G * bt * bt);
      ctx.drawImage(img, pc.sx, pc.sy, pc.s, pc.s, px, py, pc.s, pc.s);
    }
    ctx.globalAlpha = pa;
  }
}
registerEntity('crumble', Crumble);

// ============================================================================
// REWIND_BRIDGE — ponte de tábuas que desaba em cascata
// ============================================================================
class BridgeSeg extends Entity {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 16; this.h = 6; this.oneway = true; this.z = 7; this.alwaysUpdate = true; }
}
registerEntity('rewind_bridge_seg', BridgeSeg);

class RewindBridge extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.n = Math.max(1, p.width | 0 || 4);
    this.x = x; this.y = y; this.w = this.n * TILE; this.h = 8; this.z = 7;
    this.rewindable = true; this.sealed = !!p.sealed;
    this.f = Array(this.n).fill(-1);   // -1 = inteira; >= 0 = tempo caindo
    this.d = Array(this.n).fill(-1);   // contagem até cair (-1 = nenhuma)
    this.downT = 0;
    this.segs = [];
    for (let i = 0; i < this.n; i++) this.segs.push(l.add(new BridgeSeg(l, x + i * TILE, y, { parent: this })));
  }
  init() {
    if (this.props.signal) this.level.onSignal(this.props.signal, (v) => { if (v) this.trigger(this.props.from === 'right' ? this.n - 1 : 0); });
  }
  captureState() { return { f: this.f.slice(), d: this.d.slice() }; }
  restoreState(s) { this.f = s.f.slice(); this.d = s.d.slice(); this.sync(); }
  sync() {
    let ch = false;
    this.segs.forEach((s, i) => {
      const want = this.f[i] < 0;
      if (s.oneway !== want) { s.oneway = want; ch = true; if (want) unstick(this.level, s); }
    });
    if (ch) this.level.refreshSolids();
  }
  trigger(from) {
    let any = false;
    for (let j = 0; j < this.n; j++) if (this.f[j] < 0 && this.d[j] < 0) { this.d[j] = 0.35 + Math.abs(j - from) * 0.14; any = true; }
    if (any) audio.sfx('crumble', { pitch: 0.8, vol: 0.5 });
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.rewinding) return;
    const L = this.level;
    if (!this.props.noStep) this.segs.forEach((s, i) => { if (this.f[i] < 0 && this.d[i] < 0 && loaded(L, s)) this.trigger(i); });
    let ch = false, allDown = true;
    for (let i = 0; i < this.n; i++) {
      if (this.d[i] >= 0) {
        this.d[i] -= dt;
        if (this.d[i] <= 0) {
          this.d[i] = -1; this.f[i] = 0; ch = true;
          audio.sfx('crumble', { pitch: 1.1 + Math.random() * 0.3, vol: 0.35, cooldown: 0.05 });
          L.particles.emit('dust', this.x + i * TILE + 8, this.y + 4, 3);
        }
      }
      if (this.f[i] >= 0) this.f[i] = Math.min(3, this.f[i] + dt); else allDown = false;
    }
    if (ch) this.sync();
    // props.respawn: refaz a ponte sozinha
    this.downT = allDown ? this.downT + dt : 0;
    if (this.props.respawn && this.downT > this.props.respawn) {
      this.f.fill(-1); this.d.fill(-1); this.sync(); this.downT = 0;
      L.particles.emit('fluff', this.cx, this.y, 8);
    }
  }
  plankPos(i, f) {
    return { x: this.x + i * TILE + (i % 2 ? 1 : -1) * f * 14, y: this.y + 0.5 * 640 * f * f };
  }
  draw(ctx) {
    const x0 = Rn(this.x), y0 = Rn(this.y);
    // postes nas pontas
    for (const px of [x0 - 2, x0 + this.w - 1]) {
      ctx.fillStyle = '#2e1a0c'; ctx.fillRect(px - 1, y0 - 9, 5, 16);
      ctx.fillStyle = '#9a6a3a'; ctx.fillRect(px, y0 - 8, 3, 14);
      ctx.fillStyle = '#d0a066'; ctx.fillRect(px, y0 - 8, 1, 14);
    }
    // corda entre tábuas inteiras
    ctx.fillStyle = '#e8d8b0';
    for (let i = 0; i < this.n; i++) {
      if (this.f[i] >= 0) continue;
      const sh = this.d[i] >= 0 ? Rn(Math.sin(this.t * 60 + i) * 1) : 0;
      ctx.fillRect(x0 + i * TILE, y0 - 6 + sh, TILE, 1);
      ctx.fillRect(x0 + i * TILE + 7, y0 - 5 + sh, 1, 5);
    }
    for (let i = 0; i < this.n; i++) {
      const f = this.f[i];
      if (f < 0) {
        const sh = this.d[i] >= 0 ? Rn(Math.sin(this.t * 60 + i * 2) * 1) : 0;
        drawImage(ctx, 'rw_plank', x0 + i * TILE, y0 + sh);
      } else if (f < 1.4) {
        if (this.rewinding) for (const [df, a] of [[0.1, 0.18], [0.05, 0.35]]) {
          const g = this.plankPos(i, f + df);
          drawImage(ctx, 'rw_plank', g.x, g.y, { alpha: a });
        }
        const q = this.plankPos(i, f);
        drawImage(ctx, 'rw_plank', q.x, q.y);
      }
    }
  }
}
registerEntity('rewind_bridge', RewindBridge);

// ============================================================================
// BOULDER — novelo gigante que rola
// ============================================================================
class Boulder extends Entity {
  constructor(l, x, y, p = {}) {
    super(l, x, y, p);
    this.w = 24; this.h = 24;
    this.x = x + TILE / 2 - 12; this.y = y + TILE - 24;
    this.home = { x: this.x, y: this.y };
    this.rewindable = true; this.sealed = !!p.sealed;
    this.weight = true; this.hittable = true; this.solid = true;
    this.gravity = 900; this.maxFall = 380; this.z = 15;
    this.rot = 0; this.lost = false; this.lostT = 0; this.pushT = 0;
    this.started = !p.signal;
    this.activeRange = 400;
  }
  init() {
    if (this.props.signal) this.level.onSignal(this.props.signal, (v) => {
      if (!v || this.started || this.lost) return;
      this.started = true;
      this.vx = (this.props.dir ?? 1) * (this.props.speed ?? 140);
      this.setSolid(false);
      audio.sfx('crumble', { pitch: 0.6 });
    });
  }
  captureState() { return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, rot: this.rot, lost: this.lost, started: this.started }; }
  restoreState(s) {
    Object.assign(this, s);
    this.lostT = 0;
    this.setSolid(!this.lost && Math.abs(this.vx) < 8);
  }
  onRewound() { this.vx = 0; this.vy = 0; this.setSolid(!this.lost); }
  setSolid(v) {
    if (v && [this.level.player, this.level.decoy].some((b) => b && !b.dead && rectsOverlap(b, this))) v = false;
    if (v !== this.solid) { this.solid = v; this.level.refreshSolids(); }
  }
  onHit(dmg, src, opts = {}) {
    if (this.lost || this.rewinding || this.invuln > 0) return false;
    this.invuln = 0.15; this.flash = 0.1; this.pushT = 0.5;
    const dir = Math.sign(this.cx - (src?.cx ?? this.cx)) || src?.facing || 1;
    const strong = opts.kind === 'side3' || opts.kind === 'blast' || dmg >= 3;
    this.vx = dir * (strong ? 230 : 165);
    this.vy = Math.min(this.vy, opts.kind === 'up' ? -260 : -70);
    this.started = true;
    this.setSolid(false);
    audio.sfx('hit', { pitch: 0.6 });
    this.level.particles.emit('fluff', this.cx, this.cy, 5, { colors: YARN });
    return true;
  }
  hurt(n, src, opts) { return this.onHit(n, src, opts); }
  update(dt) {
    this.tickTimers(dt);
    if (this.pushT > 0) this.pushT -= dt;
    if (this.rewinding) return;
    const L = this.level;
    if (this.lost) {
      this.lostT += dt;
      if (!this.props.noRespawn && this.lostT > 4) {
        this.lost = false; this.x = this.home.x; this.y = this.home.y; this.vx = this.vy = 0;
        L.particles.emit('fluff', this.cx, this.cy, 10, { colors: YARN });
        VFX.spawnShockwave(L, this.cx, this.cy, { radius: 18, color: '#ff8aa4', particles: false });
        this.setSolid(true);
      }
      return;
    }
    const speed = Math.abs(this.vx);
    // esmaga blocos quebráveis à frente
    if (speed > 30) {
      const probe = { x: this.vx > 0 ? this.x + this.w : this.x - 4, y: this.y + 3, w: 4, h: this.h - 6 };
      for (const e of L.entities) {
        if (e.dead || e === this || !e.smash || e.enemy || !rectsOverlap(probe, e)) continue;
        e.smash(this); this.vx *= 0.8; L.shake(0.25);
      }
    }
    if (this.grounded) this.vx = approach(this.vx, 0, 45 * dt);
    const pvx = this.vx, pvy = this.vy;
    this.physics(dt);
    if (this.hitWall) {
      if (Math.abs(pvx) > 60) { this.vx = -pvx * 0.35; L.shake(0.2); audio.sfx('land', { pitch: 0.55 }); L.particles.emit('dust', this.hitWall > 0 ? this.right : this.x, this.cy, 5); }
      else this.vx = 0;
    }
    if (this.justLanded && pvy > 160) {
      L.shake(Math.min(0.35, pvy / 900)); audio.sfx('land', { pitch: 0.5 });
      L.particles.emit('dust', this.cx, this.bottom, 8);
      if (pvy > 260) this.vy = -pvy * 0.25;
    }
    this.rot += (this.vx * dt) / 12;
    // fere inimigos / jogador quando rola rápido
    if (Math.abs(this.vx) > 60 || this.vy > 200) {
      for (const e of L.entities) {
        if (!e.enemy || e.dead || e.dying || !e.hittable || e instanceof EnemyProjectile || !rectsOverlap(this, e)) continue;
        e.hurt(3, this, { knockback: 180 });
      }
      const p = L.player;
      if (p && this.pushT <= 0 && rectsOverlap(this, p) && Math.sign(p.cx - this.cx) === Math.sign(this.vx)) p.hurt(1, this);
    }
    this.setSolid(this.grounded && Math.abs(this.vx) < 8);
    if (this.y > L.map.rows * TILE + 40) {
      this.lost = true; this.lostT = 0; this.vx = this.vy = 0; this.setSolid(false);
    }
  }
  draw(ctx) {
    if (this.lost) return;
    const fr = ((Math.floor((this.rot / (Math.PI * 2)) * 12) % 12) + 12) % 12;
    const x = Rn(this.x) - 1, y = Rn(this.y) - 1;
    drawImage(ctx, 'rw_boulder_' + fr, x, y);
    if (this.flash > 0) { ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, y + 4, 18, 18); ctx.globalAlpha = 1; }
  }
}
registerEntity('boulder', Boulder);

// ============================================================================
// HABILIDADE
// ============================================================================
registerAbility('rewind', {
  name: 'Remendo Temporal', icon: 'icon_ab_rewind', cost: COST, cooldown: COOLDOWN, color: BLUE,
  desc: 'Objetos próximos voltam ~3 s no tempo (blocos que desmoronaram, pontes, novelos) e projéteis são devolvidos. Não afeta você, inimigos nem objetos com selo roxo.',
  onPress(p, level) {
    const rec = recorderOf(level);
    if (!rec || rec.busy) return;
    const { targets, sealed, shots } = rec.scan(p);
    if (!targets.length && !shots.length) {
      p.setCooldown('rewind', 0.5);
      audio.sfx('ui_denied');
      rec.fizzle(p, sealed);
      level.toast(sealed.length ? 'Selo roxo: o tempo deste objeto não volta!' : 'Nada para remendar no tempo aqui.', 'icon_ab_rewind');
      return;
    }
    if (!p.spendEnergy(COST)) return;
    p.setCooldown('rewind', COOLDOWN);
    p.castT = 0.45;
    p._rwCast = 0.6;
    audio.sfx('rewind_cast');
    level.shake(0.15);
    rec.start(p, targets, shots, sealed);
  },
  update(p, dt) {
    if (p._rwCast > 0) p._rwCast -= dt;
    if (p.level && (!p.level._rwRec || p.level._rwRec.level !== p.level)) recorderOf(p.level);
  },
  draw(ctx, p) {
    if (!(p._rwCast > 0)) return;
    // mostrador girando ao redor do Tico durante o lançamento
    const k = p._rwCast / 0.6;
    ctx.fillStyle = BLUE;
    for (let i = 0; i < 12; i++) {
      const a = -p.t * 8 + (i / 12) * Math.PI * 2;
      ctx.globalAlpha = k * (i % 3 === 0 ? 1 : 0.5);
      ctx.fillRect(Rn(p.cx + Math.cos(a) * 14), Rn(p.cy - 2 + Math.sin(a) * 14), 1, 1);
    }
    ctx.globalAlpha = 1;
  },
  onUnequip() {},
});

// ============================================================================
// Canhão de teste (projéteis refletíveis) — só para fases test_ab_*
// ============================================================================
class AbTestTurret extends Enemy {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 14; this.h = 14; this.alignToCell(x, y);
    this.hp = this.maxHp = props.hp ?? 4;
    this.flying = true; this.stompable = false; this.bindable = false;
    this.fireT = 1.2;
    this.drops = { buttons: 1, heart: 0, energy: 0.5 };
  }
  think(dt) {
    this.faceTarget(this.level.player);
    this.fireT -= dt;
    if (this.fireT <= 0 && this.playerNear(230, 60)) {
      this.fireT = 1.8;
      this.level.add(new EnemyProjectile(this.level, this.cx + this.facing * 9, this.cy - 1, { vx: this.facing * 105, life: 3.5 }));
      audio.sfx('whip', { pitch: 0.7, vol: 0.4 });
    }
  }
  draw(ctx) {
    const o = this.spriteOpts(), x = Rn(this.x), y = Rn(this.y), f = this.facing;
    ctx.globalAlpha = o.alpha;
    ctx.fillStyle = '#1a1024'; ctx.fillRect(x, y + 2, 14, 12);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#8a5ad8'; ctx.fillRect(x + 1, y + 3, 12, 10);
    ctx.fillStyle = '#c8a2ff'; ctx.fillRect(x + 2, y + 4, 4, 2);
    ctx.fillStyle = '#1a1024'; ctx.fillRect(f > 0 ? x + 10 : x - 4, y + 5, 8, 5);
    ctx.fillStyle = '#5a3a90'; ctx.fillRect(f > 0 ? x + 11 : x - 3, y + 6, 6, 3);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 6 + f, y + 6, 2, 2);
    ctx.globalAlpha = 1;
    this.drawStatus(ctx);
  }
}
registerEntity('ab_test_turret', AbTestTurret);

// ============================================================================
// Fase de teste: ?level=test_ab_rewind&unlock=all
// ============================================================================
registerLevel({
  id: 'test_ab_rewind', world: 0, index: 0, name: 'Teste: Remendo Temporal', subtitle: 'Volta, Tempo!',
  tileset: 'default', background: 'default', music: null, parTime: 90,
  map: buildTestMap(70, 16, (fill, put) => {
    fill(0, 12, 69, 15, '#');
    put(2, 11, 'P');
    fill(8, 12, 13, 15, '.'); fill(8, 12, 13, 12, 'C');      // blocos sobre o abismo (sem voltar sozinhos)
    fill(18, 12, 23, 15, '.');                               // abismo da ponte
    put(31, 10, 'B'); put(31, 11, 'B');                      // quebráveis no caminho do novelo
    fill(36, 9, 37, 11, '#');                                // parede que segura o novelo
    fill(42, 12, 47, 15, '.');                               // abismo com blocos (um selado)
    fill(42, 12, 44, 12, 'C'); fill(45, 12, 47, 12, 'C');
    fill(60, 10, 61, 11, '#');
    put(61, 9, 't');
    put(68, 11, 'E');
  }),
  legend: { t: 'ab_test_turret' },
  props: {
    '8,12': { noRespawn: true }, '9,12': { noRespawn: true }, '10,12': { noRespawn: true },
    '11,12': { noRespawn: true }, '12,12': { noRespawn: true }, '13,12': { noRespawn: true },
    '45,12': { sealed: true }, '46,12': { sealed: true }, '47,12': { sealed: true },
  },
  objects: [
    { type: 'rewind_bridge', x: 18, y: 12, width: 6 },
    { type: 'boulder', x: 27, y: 11 },
  ],
  onStart() { if (save.data.abilities?.rewind) save.data.equippedAbility = 'rewind'; },
});
