// =============================================================================
// scenes/menus_basic.js — Menus de jogo: 'pause', 'death', 'victory', 'loading'.
// Também exporta os utilitários de menu usados pelas telas de título:
//   ButtonList  — lista de botões (teclado/gamepad + toque/mouse via input.pointer)
//   ConfirmBox  — caixa "Sim / Não" modal
//   navAxis     — navegação com auto-repetição ao segurar
//   dimScreen, fmtTime, closeScene
// Todas as telas se ajustam a larguras lógicas de 320 a 560 px.
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { audio, hasSong } from '../../engine/audio.js';
import font from '../../engine/font.js';
import { drawSprite, animFrame, animDuration, getImage } from '../../engine/sprites.js';
import { clamp, Ease, pick } from '../../engine/util.js';
import { R, registerScene, makeScene } from '../registry.js';
import { drawPanel, drawButton, drawCursor } from '../art/ui_kit.js';

// ------------------------------------------------------------------ helpers
export function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
export function dimScreen(ctx, a = 0.6, color = '11,7,22') {
  const { w, h } = game.view;
  ctx.fillStyle = `rgba(${color},${a})`;
  ctx.fillRect(0, 0, w, h);
}
/** Fecha uma cena de menu: pop se houver algo embaixo, senão volta ao título. */
export function closeScene(scene) {
  const m = scene.manager;
  if (!m) return;
  if (m.stack.length > 1) m.pop();
  else m.go(makeScene('title') || scene, {}, { transition: 'fade' });
}
/** Navegação -1/0/+1 com repetição ao segurar. st = { t } persistente. */
export function navAxis(st, dt, neg, pos) {
  if (input.pressed(neg)) { st.t = 0.35; return -1; }
  if (input.pressed(pos)) { st.t = 0.35; return 1; }
  const d = (input.down(pos) ? 1 : 0) - (input.down(neg) ? 1 : 0);
  if (d) { st.t -= dt; if (st.t <= 0) { st.t = 0.1; return d; } } else st.t = 0.35;
  return 0;
}
export function inRect(p, r) { return r && p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h; }
function drawIcon(ctx, name, x, y, scale = 1, alpha = 1) {
  const img = getImage(name);
  if (!img) return 0;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  if (scale === 1) ctx.drawImage(img, Math.round(x), Math.round(y));
  else ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(img.width * scale), Math.round(img.height * scale));
  ctx.globalAlpha = pa;
  return img.width * scale;
}

// --------------------------------------------------------------- ButtonList
/**
 * items: [{ label, icon, disabled, hidden, action, sfx }]
 * Layout: layoutV(cx, y, w, bh, gap) ou layoutH(cx, y, bw, bh, gap) a cada quadro.
 */
export class ButtonList {
  constructor(items, opts = {}) {
    this.items = items;
    this.sel = opts.sel || 0;
    this.nav = { t: 0 };
    this.pressIdx = -1;
    this.lpx = input.pointer.x; this.lpy = input.pointer.y;
    this.denyT = 0;
    this.showCursor = opts.cursor !== false;
  }
  get vis() { return this.items.filter((i) => !i.hidden); }
  layoutV(cx, y, w, bh = 16, gap = 3) {
    this.vis.forEach((it, i) => { it.rect = { x: Math.round(cx - w / 2), y: Math.round(y + i * (bh + gap)), w, h: bh }; });
    return this.vis.length * (bh + gap) - gap;
  }
  layoutH(cx, y, bw, bh = 16, gap = 6) {
    const v = this.vis, tw = v.length * bw + (v.length - 1) * gap;
    v.forEach((it, i) => { it.rect = { x: Math.round(cx - tw / 2 + i * (bw + gap)), y: Math.round(y), w: bw, h: bh }; });
    return tw;
  }
  select(i, quiet) {
    const n = this.vis.length;
    if (!n) return;
    i = (i + n) % n;
    if (i !== this.sel && !quiet) audio.sfx('ui_move');
    this.sel = i;
  }
  activate(i) {
    const it = this.vis[i];
    if (!it) return;
    this.sel = i;
    if (it.disabled) { audio.sfx('ui_denied'); this.denyT = 0.3; return; }
    audio.sfx(it.sfx || 'ui_select');
    it.action?.();
  }
  hit(p) { return this.vis.findIndex((it) => inRect(p, it.rect)); }
  update(dt) {
    this.denyT = Math.max(0, this.denyT - dt);
    const v = this.vis;
    if (this.sel >= v.length) this.sel = Math.max(0, v.length - 1);
    const d = navAxis(this.nav, dt, 'up', 'down') || navAxis(this.navH || (this.navH = { t: 0 }), dt, 'left', 'right');
    if (d) this.select(this.sel + d);
    const p = input.pointer, h = this.hit(p);
    if (p.x !== this.lpx || p.y !== this.lpy) {
      if (h >= 0 && !p.down && input.lastDevice !== 'touch') this.select(h);
      this.lpx = p.x; this.lpy = p.y;
    }
    if (p.pressed) { this.pressIdx = h; if (h >= 0) this.select(h, true); }
    if (p.released) { const pi = this.pressIdx; this.pressIdx = -1; if (h >= 0 && h === pi) { this.activate(h); return true; } }
    if (input.pressed('confirm')) { input.consume('confirm'); input.consume('jump'); this.activate(this.sel); return true; }
    return false;
  }
  draw(ctx, t) {
    const p = input.pointer;
    this.vis.forEach((it, i) => {
      const r = it.rect;
      if (!r) return;
      const sel = i === this.sel;
      const down = this.pressIdx === i && p.down && inRect(p, r);
      const shake = sel && this.denyT > 0 ? Math.round(Math.sin(this.denyT * 60) * 2) : 0;
      drawButton(ctx, r.x + shake, r.y + (down ? 1 : 0), r.w, r.h, it.label, { selected: sel, disabled: it.disabled, icon: it.icon || (it.disabled ? 'icon_lock' : undefined), style: it.style && !sel ? it.style : undefined });
      if (sel && this.showCursor && input.lastDevice !== 'touch') drawCursor(ctx, r.x - 2, r.y + Math.floor(r.h / 2) - 1, t);
    });
  }
}

// --------------------------------------------------------------- ConfirmBox
export class ConfirmBox {
  constructor(text, onYes, onNo, opts = {}) {
    this.text = text;
    this.t = 0;
    const done = (fn) => () => { this.closed = true; fn?.(); };
    this.onNo = done(onNo);
    this.list = new ButtonList([
      { label: opts.yes || 'Sim', action: done(onYes), style: 'red' },
      { label: opts.no || 'Não', action: this.onNo, sfx: 'ui_back' },
    ], { sel: 1 });
  }
  update(dt) {
    this.t += dt;
    if (this.t < 0.1) return;
    if (input.pressed('back')) { input.consume('back'); audio.sfx('ui_back'); this.onNo(); return; }
    this.list.update(dt);
  }
  draw(ctx, t) {
    const { w, h } = game.view;
    dimScreen(ctx, 0.55);
    const pw = Math.min(w - 24, 250);
    const lines = font.wrap(this.text, pw - 20);
    const ph = 22 + lines.length * 10 + 24;
    const k = Ease.outBack(clamp(this.t / 0.22, 0, 1));
    const px = Math.round(w / 2 - pw / 2), py = Math.round(h / 2 - ph / 2 + (1 - k) * 12);
    drawPanel(ctx, px, py, pw, ph, 'paper');
    font.draw(ctx, this.text, w / 2, py + 10, { align: 'center', color: '#2a1840', maxWidth: pw - 20 });
    this.list.layoutH(w / 2, py + ph - 24, 64, 16, 10);
    this.list.draw(ctx, t);
  }
}

// ==================================================================== PAUSE
class PauseScene extends Scene {
  constructor(level) { super(); this.level = level || {}; }
  get overlay() { return true; }
  enter() {
    audio.duck(0.35);
    const L = this.level;
    this.list = new ButtonList([
      { label: 'Continuar', action: () => this.close() },
      { label: 'Reiniciar fase', action: () => { audio.unduck(); L.restart?.(); } },
      { label: 'Inventário', icon: 'icon_bag', hidden: !R.scenes.has('inventory'), action: () => this.openSub(makeScene('inventory', { level: L, from: 'pause' })) },
      { label: 'Configurações', icon: 'icon_gear', action: () => this.openSub(makeScene('settings', { onClose: null })) },
      { label: 'Sair para o mapa', icon: 'icon_map', action: () => { audio.unduck(); L.exitToMap?.(); } },
    ]);
  }
  openSub(s) { if (s) this.manager.push(s, { onClose: null, level: this.level }); }
  close() { audio.unduck(); audio.sfx('ui_close'); closeScene(this); }
  exit() { audio.unduck(); }
  update(dt) {
    if (this.manager?.transitioning || this.time < 0.1) return;
    if (this.list.update(dt)) return;
    if (input.pressed('pause') || input.pressed('back')) { input.consume('pause'); input.consume('back'); this.close(); }
  }
  draw(ctx) {
    const { w, h } = game.view;
    const t = this.time, L = this.level;
    const k = Ease.outCubic(clamp(t / 0.2, 0, 1));
    dimScreen(ctx, 0.6 * k);
    const pw = Math.min(w - 32, 220), nb = this.list.vis.length;
    const bh = h < 215 ? 15 : 16, gap = h < 215 ? 2 : 3;
    const ph = 50 + nb * (bh + gap);
    const px = Math.round(w / 2 - pw / 2), py = Math.round(h / 2 - ph / 2 - (1 - k) * 16);
    drawPanel(ctx, px, py, pw, ph, 'dark');
    // título (nome da fase)
    font.draw(ctx, 'PAUSA', w / 2, py - 4, { align: 'center', color: '#ffd23f', outline: '#1b1030' });
    const name = L.data?.name || 'Fase';
    font.draw(ctx, name, w / 2, py + 9, { align: 'center', color: '#fff4dc', shadow: '#0b0716', maxWidth: pw - 12 });
    if (L.data?.subtitle) font.draw(ctx, L.data.subtitle, w / 2, py + 19, { align: 'center', color: '#a898d8' });
    // estrelas · tempo · botões
    const rec = save.levelRecord?.(L.levelId);
    const run = L.run || {};
    const iy = py + 30;
    let x = px + 10;
    for (let i = 0; i < 3; i++) {
      const got = run.starsFound?.[i], old = rec?.starsFound?.[i];
      x += drawIcon(ctx, got || old ? 'icon_star' : 'icon_star_empty', x, iy, 1, got || !old ? 1 : 0.5) + 1;
    }
    const tm = fmtTime(run.timer);
    const tw = font.measure(tm);
    const cx = Math.round(w / 2 - (tw + 13) / 2) + 6;
    drawIcon(ctx, 'icon_clock', cx, iy);
    font.draw(ctx, tm, cx + 13, iy + 2, { color: '#e8dcff' });
    const bt = String(run.buttons || 0), bw = font.measure(bt);
    drawIcon(ctx, 'icon_button', px + pw - 10 - bw - 13, iy);
    font.draw(ctx, bt, px + pw - 10 - bw, iy + 2, { color: '#ffd23f' });
    this.list.layoutV(w / 2, py + 46, pw - 40, bh, gap);
    this.list.draw(ctx, t);
  }
}
registerScene('pause', PauseScene);

// ==================================================================== DEATH
const FLUFF = ['#fff4dc', '#f4ead6', '#e8dcc8', '#ffffff', '#ffd23f', '#3fc7c0', '#ff8a3c'];
class DeathScene extends Scene {
  constructor(level) { super(); this.level = level || {}; }
  get overlay() { return true; }
  enter() {
    if (hasSong('jingle_death')) audio.playMusic('jingle_death', { fade: 0.2, restart: true });
    else audio.duck(0.3);
    const L = this.level;
    // posição do Tico na tela
    const { w, h } = game.view;
    const P = L.player, C = L.camera;
    if (P && C) {
      const z = C.zoom || 1;
      this.tx = clamp(Math.round((P.x + (P.w || 12) / 2 - C.x) * z), 30, w - 30);
      this.ty = clamp(Math.round((P.y + (P.h || 18) - C.y) * z), 50, h - 70);
    } else { this.tx = Math.round(w / 2); this.ty = Math.round(h / 2 - 20); }
    this.parts = [];
    this.burst = false;
    this.list = new ButtonList([
      { label: 'Tentar de novo', action: () => this.retry() },
      { label: 'Sair para o mapa', icon: 'icon_map', action: () => { audio.unduck(); L.exitToMap?.(); } },
    ]);
  }
  retry() {
    audio.unduck();
    if (this.level.respawn) this.level.respawn();
    else closeScene(this);
  }
  spawnFluff(n, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6 * spread;
      const sp = 30 + Math.random() * 70;
      this.parts.push({ x: this.tx + (Math.random() - 0.5) * 10, y: this.ty - 12 - Math.random() * 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.6 + Math.random() * 1.8, t: 0, c: pick(FLUFF), s: Math.random() < 0.3 ? 2 : 1, ph: Math.random() * 6 });
    }
  }
  update(dt) {
    if (!this.burst && this.time > 0.35) { this.burst = true; this.spawnFluff(36); audio.sfx('break_block', { vol: 0.5, pitch: 1.4 }); }
    if (this.time > 1 && Math.random() < dt * 6) this.spawnFluff(1, 0.4);
    for (const p of this.parts) {
      p.t += dt;
      p.vx *= 1 - dt * 2.2; p.vy = p.vy * (1 - dt * 2.2) + 26 * dt;
      p.x += (p.vx + Math.sin(p.t * 3 + p.ph) * 8) * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    if (this.manager?.transitioning || this.time < 1.1) return;
    this.list.update(dt);
  }
  draw(ctx) {
    const { w, h } = game.view, t = this.time;
    dimScreen(ctx, Math.min(0.8, t * 1.3), '20,6,24');
    // Tico se desfazendo
    const dur = animDuration('tico', 'death') || 1;
    const fr = animFrame('tico', 'death', Math.min(t * 0.9, dur - 0.01));
    drawSprite(ctx, 'tico', 'death', fr, this.tx, this.ty, { alpha: t > 2 ? Math.max(0.35, 1 - (t - 2) * 0.4) : 1 });
    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, (p.life - p.t) * 1.5);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s + (p.c === '#fff4dc' ? 1 : 0), p.s);
    }
    ctx.globalAlpha = 1;
    // texto
    const msg = 'Tico se desfez...';
    const chars = Math.floor(Math.max(0, t - 0.5) * 18);
    const ty = Math.round(Math.min(h * 0.3, h / 2 - 50));
    font.draw(ctx, msg, w / 2, ty, { align: 'center', color: '#ffb0c8', outline: '#2a0a1c', scale: 2, maxChars: chars });
    if (t > 1.1) {
      const k = Ease.outBack(clamp((t - 1.1) / 0.3, 0, 1));
      ctx.globalAlpha = clamp((t - 1.1) * 4, 0, 1);
      font.draw(ctx, 'Mas um brinquedo sempre pode ser costurado de novo.', w / 2, ty + 22, { align: 'center', color: '#e8dcff', shadow: '#0b0716', maxWidth: w - 40 });
      const bw = Math.min(150, w - 60);
      this.list.layoutV(w / 2, h - 48 + (1 - k) * 20, bw, 16, 4);
      this.list.draw(ctx, t);
      ctx.globalAlpha = 1;
    }
  }
}
registerScene('death', DeathScene);

// ================================================================== VICTORY
class VictoryScene extends Scene {
  constructor(level, results) {
    super();
    this.level = level || {};
    this.r = results || this.level.results || { time: 0, par: 0, rating: 1, stars: [false, false, false], secretsFound: 0, secretsTotal: 0, buttons: 0, deaths: 0 };
  }
  get overlay() { return true; }
  get blocksUpdate() { return false; }
  enter() {
    const r = this.r;
    this.rating = clamp(r.rating | 0, 1, 3);
    this.record = (r.bestRating || 0) > (r.prevRating || 0);
    this.popped = 0;
    this.sparks = [];
    this.T0 = 0.5; // início das estrelas
    this.list = new ButtonList([
      { label: 'Continuar', action: () => this.level.exitToMap?.() },
      { label: 'Repetir', sfx: 'ui_select', action: () => this.level.restart?.() },
    ], { sel: 0 });
  }
  get animEnd() { return this.T0 + 0.45 * this.rating + 0.35 * 5 + 0.3; }
  update(dt) {
    const t = this.time;
    while (this.popped < this.rating && t > this.T0 + this.popped * 0.45) {
      audio.sfx('star_rating', { pitch: 1 + this.popped * 0.12 });
      this.popped++;
      this.burstAt = this.popped;
      this.spark(this.popped - 1);
    }
    for (const s of this.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (this.manager?.transitioning) return;
    if (t < this.animEnd) {
      if (t > 0.3 && (input.pressed('confirm') || input.pointer.pressed)) { input.consume('confirm'); this.time = this.animEnd; this.list.pressIdx = -1; while (this.popped < this.rating) { this.popped++; this.spark(this.popped - 1); } }
      return;
    }
    this.list.update(dt);
  }
  spark(i) {
    const c = this.starPos(i);
    if (!c) return;
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 50;
      this.sparks.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, t: 0, life: 0.5 + Math.random() * 0.4, c: Math.random() < 0.5 ? '#ffd23f' : '#fff4dc' });
    }
  }
  starPos(i) { return this.lay ? { x: this.lay.cx + (i - 1) * 34, y: this.lay.sy + 12 } : null; }
  draw(ctx) {
    const { w, h } = game.view, t = this.time, r = this.r;
    const k = Ease.outCubic(clamp(t / 0.3, 0, 1));
    dimScreen(ctx, 0.55 * k);
    const pw = Math.min(w - 24, 260);
    const compact = h < 225;
    const rowH = compact ? 11 : 12;
    const ph = (compact ? 150 : 164) + (this.record ? 0 : -6);
    const px = Math.round(w / 2 - pw / 2), py = Math.round(h / 2 - ph / 2 + (1 - k) * 20);
    drawPanel(ctx, px, py, pw, ph, 'paper');
    // faixa de título
    const bw = Math.min(pw - 20, 170);
    drawPanel(ctx, w / 2 - bw / 2, py - 8, bw, 18, 'red');
    font.draw(ctx, 'Fase concluída!', w / 2, py - 3, { align: 'center', color: '#fff4dc', shadow: '#7a1435' });
    font.draw(ctx, r.name || this.level.data?.name || '', w / 2, py + 13, { align: 'center', color: '#6a4a8a', maxWidth: pw - 16 });
    // estrelas de avaliação
    const sy = py + 24;
    this.lay = { cx: Math.round(w / 2), sy };
    const star = getImage('icon_star'), empty = getImage('icon_star_empty');
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 3; i++) {
      const c = this.starPos(i);
      const tt = t - (this.T0 + i * 0.45);
      const on = i < this.popped;
      const img = on ? star : empty;
      if (!img) continue;
      let s = 2;
      if (on && tt < 0.35) s = 2 * (tt < 0.18 ? Ease.outCubic(tt / 0.18) * 1.5 : 1.5 - 0.5 * Ease.outCubic((tt - 0.18) / 0.17));
      const iw = img.width * s, ih = img.height * s;
      ctx.globalAlpha = on ? 1 : 0.45;
      ctx.drawImage(img, Math.round(c.x - iw / 2), Math.round(c.y - ih / 2 - (i === 1 ? 3 : 0)), Math.round(iw), Math.round(ih));
    }
    ctx.globalAlpha = 1;
    for (const s of this.sparks) { ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    // linhas de resultado
    const rows = [
      ['icon_clock', 'Tempo', `${fmtTime(r.time)} / ${fmtTime(r.par)}`, r.par && r.time <= r.par],
      ['icon_star', 'Estrelas costuradas', null, (r.stars || []).every(Boolean), 'stars'],
      ['icon_secret', 'Segredos', `${r.secretsFound | 0}/${r.secretsTotal | 0}`, (r.secretsTotal | 0) > 0 && r.secretsFound >= r.secretsTotal],
      ['icon_button', 'Botões', null, false, 'buttons'],
      ['icon_skull', 'Quedas', String(r.deaths | 0), (r.deaths | 0) === 0],
    ];
    const r0 = this.T0 + 0.45 * this.rating + 0.1;
    let y = sy + 32;
    const lx = px + 14, rx = px + pw - 14;
    rows.forEach((row, i) => {
      const tt = t - (r0 + i * 0.35);
      if (tt < 0) return;
      ctx.globalAlpha = clamp(tt * 5, 0, 1);
      const ox = Math.round((1 - clamp(tt * 5, 0, 1)) * 10);
      drawIcon(ctx, row[0], lx + ox, y - 2);
      font.draw(ctx, row[1], lx + 15 + ox, y, { color: '#2a1840' });
      let vx = rx;
      if (row[3]) { vx -= drawIcon(ctx, 'icon_check', rx - 10, y - 2) + 3; }
      if (row[4] === 'stars') {
        for (let j = 2; j >= 0; j--) { vx -= 12; drawIcon(ctx, r.stars?.[j] ? 'icon_star' : 'icon_star_empty', vx, y - 2); }
      } else {
        const val = row[4] === 'buttons' ? String(Math.round((r.buttons | 0) * clamp(tt / 0.6, 0, 1))) : row[2];
        font.draw(ctx, val, vx, y, { align: 'right', color: row[3] ? '#2a8a50' : '#4a2a6a' });
      }
      // pesponto separador
      ctx.fillStyle = '#e0c696';
      for (let x = lx; x < rx; x += 4) ctx.fillRect(x, y + rowH - 3, 2, 1);
      y += rowH;
    });
    ctx.globalAlpha = 1;
    if (this.record && t > r0 + 1.8) {
      const pulse = Math.sin(t * 6) > 0 ? '#e8456a' : '#ff8a3c';
      font.draw(ctx, '★ Novo recorde! ★', w / 2, y, { align: 'center', color: pulse, shadow: '#fff4dc' });
      y += 11;
    }
    if (t >= this.animEnd - 0.01) {
      this.list.layoutH(w / 2, py + ph - 22, Math.min(96, (pw - 30) / 2), 16, 8);
      this.list.draw(ctx, t);
    } else if (Math.sin(t * 5) > -0.3) {
      font.draw(ctx, '...', w / 2, py + ph - 18, { align: 'center', color: '#a08060' });
    }
  }
}
registerScene('victory', VictoryScene);

// ================================================================== LOADING
const TIPS = [
  'Segure o ataque para disparar uma {#ffd23f}Agulhada{/} - custa energia.',
  'Paredes com uma aparência estranha podem ser falsas. Tente atravessá-las!',
  'A {#ffd23f}Costura Dimensional{/} liga dois ilhós dourados com uma ponte de fio.',
  '{#ffd23f}Descosturar a Realidade{/} abre paredes costuradas e tira a armadura dos inimigos.',
  'O {#ffd23f}Remendo Temporal{/} faz plataformas que desabaram voltarem no tempo.',
  'O {#ffd23f}Retalho Fantasma{/} distrai inimigos e pesa sobre placas de pressão.',
  'Bata em inimigos para encher o medidor da {#ffd23f}Forma Desfiada{/}.',
  'Cada fase esconde {#ffd23f}3 estrelas costuradas{/}. Procure em cantos suspeitos!',
  'No ar, aperte para baixo e ataque para quicar em cima dos inimigos.',
  'Botões dourados compram itens na loja. Retalhos mágicos melhoram suas habilidades.',
  'Termine abaixo do tempo meta para ganhar mais uma estrela de avaliação.',
  'Os pontos de controle guardam onde você parou dentro da fase.',
  'O dash funciona uma vez no ar: use-o para alcançar plataformas distantes.',
  'Memórias escondidas contam a história da criança que amava o Tico.',
  'Ataque para cima para acertar inimigos voadores logo acima de você.',
];
class LoadingScene extends Scene {
  constructor(opts = {}) {
    super();
    this.opts = opts && typeof opts === 'object' ? opts : {};
    this.tip = typeof this.opts.tip === 'string' ? this.opts.tip : pick(TIPS);
    this.done = false;
  }
  enter(params) { if (params && typeof params.next === 'function' && !this.opts.next) this.opts = { ...this.opts, ...params }; }
  update() {
    if (this.done || this.time < (this.opts.time || 1.2)) return;
    this.done = true;
    if (typeof this.opts.next === 'function') this.opts.next();
    else closeScene(this);
  }
  draw(ctx) {
    const { w, h } = game.view, t = this.time;
    ctx.fillStyle = '#120c24'; ctx.fillRect(0, 0, w, h);
    // tecido listrado ao fundo
    ctx.fillStyle = '#170f2e';
    for (let y = 0; y < h; y += 12) ctx.fillRect(0, y, w, 6);
    // fio-chão rolando
    const gy = Math.round(h * 0.56);
    ctx.fillStyle = '#2a1f4a'; ctx.fillRect(0, gy + 1, w, h - gy);
    ctx.fillStyle = '#ffd23f';
    const off = Math.floor(t * 120) % 8;
    for (let x = -off; x < w; x += 8) ctx.fillRect(x, gy, 4, 1);
    ctx.fillStyle = '#7a68b8';
    for (let x = -(Math.floor(t * 60) % 16); x < w; x += 16) ctx.fillRect(x, gy + 6, 6, 1);
    // Tico correndo
    const tx = Math.round(w / 2 + Math.sin(t * 1.3) * 12);
    drawSprite(ctx, 'tico', 'run', animFrame('tico', 'run', t), tx, gy);
    if (Math.floor(t * 10) % 2 === 0) { ctx.fillStyle = '#5a4a8a'; ctx.fillRect(tx - 18 - (Math.floor(t * 30) % 6), gy - 3, 2, 2); }
    const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
    font.draw(ctx, 'Costurando' + dots, w / 2 - 30, gy - 52, { color: '#e8dcff', shadow: '#0b0716' });
    // dica
    const pw = Math.min(w - 32, 300);
    const lines = font.wrap(this.tip, pw - 40);
    const ph = 18 + lines.length * 10;
    const px = Math.round(w / 2 - pw / 2), py = Math.min(h - ph - 8, gy + 18);
    drawPanel(ctx, px, py, pw, ph, 'paper');
    drawIcon(ctx, 'icon_book', px + 8, py + 6);
    font.draw(ctx, 'Dica', px + 8, py + 18, { color: '#c8925a' });
    font.draw(ctx, this.tip, px + 32, py + 9, { color: '#2a1840', maxWidth: pw - 40 });
  }
}
registerScene('loading', LoadingScene);
