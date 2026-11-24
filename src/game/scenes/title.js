// =============================================================================
// scenes/title.js — Tela de título animada + 'settings' (configurações) +
// 'credits' (créditos rolando numa cortina costurada).
//
// Título: céu noturno vivo (drawSky, lua/estrelas/estrelas cadentes), morros em
// parallax com um castelo de brinquedo em silhueta, o Tico num morro gramado
// (idle / acena / dorme), logo com brilho e fios mágicos flutuando.
// Fluxo: "Toque para começar" → menu (Novo Jogo, Continuar, Seleção de Mundos,
// Configurações, Créditos). Tudo funciona com teclado/gamepad e toque/mouse.
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { audio, hasSong } from '../../engine/audio.js';
import font from '../../engine/font.js';
import { drawSprite, animFrame, animDuration, getImage } from '../../engine/sprites.js';
import { createCanvas } from '../../engine/pixel.js';
import { clamp, Ease, hash2, makeRng } from '../../engine/util.js';
import { R, registerScene, makeScene } from '../registry.js';
import { drawPanel, drawLogo, drawBar } from '../art/ui_kit.js';
import { drawSky, skyPreset } from '../art/sky.js';
import { LevelScene } from './level_scene.js';
import { ButtonList, ConfirmBox, navAxis, dimScreen, closeScene, inRect } from './menus_basic.js';

const SKY = skyPreset('w1', null, 'night');
const M = 18; // margem de parallax (px de cada lado)

// ------------------------------------------------------------- cenário (cache)
function hillProfile(x, period, seed, amp) {
  const f = (k) => Math.sin((x / period) * Math.PI * 2 * k + seed * k * 1.7);
  return amp * (0.55 * f(1) + 0.3 * f(2) + 0.15 * f(5));
}
const layerCache = new Map();
function buildLayers(w, h) {
  const key = w + 'x' + h;
  if (layerCache.has(key)) return layerCache.get(key);
  const W = w + M * 2;
  // --- morros distantes + castelo de brinquedo
  const far = createCanvas(W, h), g1 = far.getContext('2d');
  const farBase = Math.round(h * 0.62);
  for (let x = 0; x < W; x++) {
    const top = Math.round(farBase + hillProfile(x, W, 1.3, h * 0.07));
    g1.fillStyle = '#151a3c'; g1.fillRect(x, top, 1, h - top);
    g1.fillStyle = '#26305e'; g1.fillRect(x, top, 1, 1);
    if (hash2(x, 3) < 0.5) { g1.fillStyle = '#1c2450'; g1.fillRect(x, top + 1, 1, 1); }
  }
  // castelo
  const cx = Math.round(W * 0.74), cb = Math.round(farBase + hillProfile(W * 0.74, W, 1.3, h * 0.07)) + 2;
  const body = '#0f1230', rim = '#2c3468', win = '#ffd86a';
  const tower = (x, wdt, ht, roof) => {
    g1.fillStyle = body; g1.fillRect(x, cb - ht, wdt, ht);
    g1.fillStyle = rim; g1.fillRect(x, cb - ht, 1, ht);
    // ameias ou telhado cônico de brinquedo
    if (roof) {
      for (let i = 0; i < roof; i++) { const rw = Math.max(1, Math.round(wdt + 2 - (i * (wdt + 2)) / roof)); g1.fillStyle = i < 2 ? '#3a1840' : '#2a1238'; g1.fillRect(x + Math.round((wdt - rw) / 2), cb - ht - i - 1, rw, 1); }
      g1.fillStyle = '#c04a6a'; g1.fillRect(x + Math.floor(wdt / 2), cb - ht - roof - 5, 1, 5); g1.fillRect(x + Math.floor(wdt / 2) + 1, cb - ht - roof - 5, 3, 2);
    } else {
      for (let i = 0; i < wdt; i += 3) { g1.fillStyle = body; g1.fillRect(x + i, cb - ht - 2, 2, 2); }
    }
  };
  tower(cx - 26, 10, 30, 12); tower(cx + 18, 10, 34, 13); tower(cx - 6, 14, 44, 16);
  tower(cx - 18, 36, 18, 0);
  g1.fillStyle = '#0a0c22'; g1.fillRect(cx - 4, cb - 9, 8, 9); g1.fillRect(cx - 3, cb - 10, 6, 1); // portão
  const windows = [[cx - 23, cb - 22], [cx + 21, cb - 26], [cx - 1, cb - 34], [cx + 3, cb - 34], [cx - 12, cb - 12], [cx + 8, cb - 12], [cx + 1, cb - 22]];
  // --- morros médios com árvores redondas de brinquedo
  const mid = createCanvas(W, h), g2 = mid.getContext('2d');
  const midBase = Math.round(h * 0.74);
  const midTop = [];
  for (let x = 0; x < W; x++) midTop[x] = Math.round(midBase + hillProfile(x, W, 4.1, h * 0.05));
  const rng = makeRng(77);
  for (let i = 0; i < 9; i++) {
    const tx = rng.int(10, W - 10), r = rng.int(5, 9), ty = midTop[tx] - r - 2;
    g2.fillStyle = '#0c2228'; g2.fillRect(tx - 1, ty, 2, r + 4);
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) { g2.fillStyle = (xx + yy < -r * 0.6) ? '#1e4a4a' : '#123236'; g2.fillRect(tx + xx, ty + yy - r * 0.4, 1, 1); }
  }
  for (let x = 0; x < W; x++) {
    const top = midTop[x];
    g2.fillStyle = '#0f2a2e'; g2.fillRect(x, top, 1, h - top);
    g2.fillStyle = '#1f4a46'; g2.fillRect(x, top, 1, 1);
    if (hash2(x, 9) < 0.4) { g2.fillStyle = '#163a3a'; g2.fillRect(x, top + 1, 1, 2); }
  }
  // --- morro do Tico (primeiro plano, à esquerda) com grama e cogumelos
  const near = createCanvas(W, h), g3 = near.getContext('2d');
  const nearTop = [];
  const hx = Math.round(Math.max(70, w * 0.2)) + M;
  for (let x = 0; x < W; x++) {
    const d = (x - hx) / (w * 0.42);
    let top = Math.round(h * 0.79 + d * d * h * 0.16 + Math.sin(x * 0.07) * 1.5);
    top = Math.min(top, h + 2);
    const low = Math.round(h * 0.94 + Math.sin(x * 0.05) * 2);
    nearTop[x] = Math.min(top, low);
  }
  for (let x = 0; x < W; x++) {
    const top = nearTop[x];
    for (let y = top; y < h; y++) {
      const dd = y - top;
      let c = dd < 2 ? '#3f8a52' : dd < 4 ? '#2c6a42' : dd < 9 ? '#1d4e34' : '#143826';
      if (dd >= 4 && dd < 9 && hash2(x, y) < 0.18) c = '#2c6a42';
      if (dd >= 9 && hash2(x, y, 2) < 0.08) c = '#1d4e34';
      g3.fillStyle = c; g3.fillRect(x, y, 1, 1);
    }
    g3.fillStyle = '#5aae64';
    if (hash2(x, 1) < 0.45) g3.fillRect(x, top - 1, 1, 1);
    if (hash2(x, 2) < 0.12) { g3.fillRect(x, top - 2, 1, 1); g3.fillStyle = '#7fd07a'; g3.fillRect(x, top - 3, 1, 1); }
  }
  // costura no morro (pesponto)
  g3.fillStyle = '#7a5a2a';
  for (let x = 0; x < W; x += 5) g3.fillRect(x, nearTop[x] + 6, 3, 1);
  const shrooms = [];
  for (const sx of [hx - 40, hx + 34, hx + 70, Math.round(W * 0.82), Math.round(W * 0.9)]) {
    if (sx < 4 || sx > W - 4) continue;
    const sy = nearTop[sx];
    g3.fillStyle = '#e8dcc8'; g3.fillRect(sx, sy - 3, 1, 3);
    g3.fillStyle = '#b05aff'; g3.fillRect(sx - 2, sy - 5, 5, 2); g3.fillRect(sx - 1, sy - 6, 3, 1);
    g3.fillStyle = '#e0a8ff'; g3.fillRect(sx - 1, sy - 6, 1, 1); g3.fillRect(sx + 1, sy - 5, 1, 1);
    shrooms.push([sx, sy - 5]);
  }
  const L = { far, mid, near, windows, hx, hy: nearTop[hx], shrooms, W };
  layerCache.set(key, L);
  return L;
}

/** Desenha o cenário do título (céu + parallax). Usado também pelos créditos/configurações. */
export function drawTitleBackdrop(ctx, t, opts = {}) {
  const { w, h } = game.view;
  drawSky(ctx, w, h, t, null, SKY);
  const L = buildLayers(w, h);
  const sway = Math.sin(t * 0.13);
  ctx.drawImage(L.far, Math.round(-M + sway * M * 0.25), 0);
  const ox1 = Math.round(-M + sway * M * 0.25);
  for (const [i, wp] of L.windows.entries()) {
    const on = hash2(i, Math.floor(t * 0.5 + i * 0.3)) > 0.2;
    ctx.fillStyle = on ? '#ffd86a' : '#6a5a3a';
    ctx.fillRect(wp[0] + ox1, wp[1], 2, 2);
  }
  // névoa roxa do W1
  ctx.fillStyle = '#5a3a8a';
  for (let x = 0; x < w; x += 3) {
    const a = 0.08 + 0.06 * Math.sin(x * 0.03 + t * 0.4);
    ctx.globalAlpha = a;
    ctx.fillRect(x, Math.round(h * 0.68 + Math.sin(x * 0.02 + t * 0.3) * 3), 3, 10);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(L.mid, Math.round(-M + sway * M * 0.55), 0);
  const ox3 = Math.round(-M + sway * M);
  ctx.drawImage(L.near, ox3, 0);
  // brilho dos cogumelos
  for (const [i, s] of L.shrooms.entries()) {
    const a = 0.25 + 0.2 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(190,120,255,${a.toFixed(2)})`;
    ctx.fillRect(s[0] + ox3 - 4, s[1] - 2, 9, 5);
  }
  // vagalumes
  for (let i = 0; i < 14; i++) {
    const fx = (hash2(i, 5) * (w + 40) + Math.sin(t * 0.5 + i) * 20 + t * (3 + i % 3)) % (w + 40) - 20;
    const fy = h * (0.6 + hash2(i, 6) * 0.32) + Math.sin(t * 1.3 + i * 2) * 6;
    const b = Math.sin(t * 2.5 + i * 1.7);
    if (b < -0.2) continue;
    ctx.fillStyle = b > 0.6 ? '#f8ff9a' : '#b8e05a';
    ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
    if (b > 0.7) { ctx.globalAlpha = 0.3; ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3); ctx.globalAlpha = 1; }
  }
  if (opts.swirls !== false) drawSwirls(ctx, t, w, h);
  return { hx: L.hx + ox3, hy: L.hy };
}

// fios mágicos flutuando (laços que atravessam o céu)
const SWIRLS = [
  { y: 0.2, v: 9, r: 9, f: 2.3, c: '#ffd23f', len: 46, ph: 0 },
  { y: 0.42, v: -7, r: 7, f: 2.9, c: '#ff8fc0', len: 38, ph: 2 },
  { y: 0.56, v: 6, r: 11, f: 1.9, c: '#7fe6df', len: 42, ph: 4.5 },
];
function drawSwirls(ctx, t, w, h) {
  const span = w + 120;
  for (const s of SWIRLS) {
    for (let k = 0; k < s.len; k++) {
      const u = t - k * 0.045;
      let x = ((u * s.v * 2.4 + s.ph * 97) % span + span) % span - 60;
      x += Math.cos(u * s.f + s.ph) * s.r * 1.4;
      const y = h * s.y + Math.sin(u * s.f + s.ph) * s.r + Math.sin(u * 0.6 + s.ph) * 10;
      const a = 1 - k / s.len;
      ctx.globalAlpha = a * (k % 3 === 2 ? 0.4 : 0.9);
      ctx.fillStyle = k === 0 ? '#ffffff' : s.c;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ==================================================================== TITLE
class TitleScene extends Scene {
  enter() {
    this.state = 'press';
    this.stateT = 0;
    this.idleT = 0;
    this.tico = 'idle'; this.ticoT = 0;
    this.confirm = null;
    this.buildMenu();
    if (hasSong('title')) audio.playMusic('title', { fade: 1 });
  }
  resume() { this.buildMenu(this.menu?.sel); }
  buildMenu(sel = 0) {
    const has = save.hasGame();
    const worlds = save.data?.progress?.unlockedWorlds?.length || 1;
    this.menu = new ButtonList([
      { label: 'Novo Jogo', action: () => this.newGame() },
      { label: 'Continuar', hidden: !has, action: () => this.continueGame() },
      { label: 'Seleção de Mundos', icon: worlds > 1 ? 'icon_map' : 'icon_lock', disabled: !has || worlds <= 1, action: () => this.worldSelect() },
      { label: 'Configurações', icon: 'icon_gear', action: () => this.push('settings', { onClose: null }) },
      { label: 'Créditos', icon: 'icon_book', action: () => this.push('credits', {}) },
    ], { sel: has && !sel ? 1 : sel });
  }
  push(name, params) { const s = makeScene(name, params); if (s) this.manager.push(s, params); }
  setTico(a) { if (this.tico !== a) { this.tico = a; this.ticoT = 0; } }
  newGame() {
    const start = () => {
      save.newGame();
      audio.sfx('menu_confirm_big');
      const first = R.levels.has('w1_1') ? 'w1_1' : [...R.levels.keys()][0];
      const toLevel = () => game.scenes.go(new LevelScene(), { levelId: first });
      const cs = R.cutscenes.has('opening') ? makeScene('cutscene', 'opening', { next: toLevel }) : null;
      if (cs) game.scenes.go(cs, {}, { transition: 'fade', time: 0.8 });
      else toLevel();
    };
    if (save.hasGame()) this.confirm = new ConfirmBox('Apagar o jogo salvo?', start, null, { yes: 'Apagar', no: 'Não' });
    else start();
  }
  continueGame() {
    const wm = makeScene('worldmap', {});
    if (wm) { game.scenes.go(wm, {}, { transition: 'stitch' }); return; }
    let id = save.data.progress.lastLevel;
    if (!id || !R.levels.has(id)) id = 'w1_1';
    game.scenes.go(new LevelScene(), { levelId: id });
  }
  worldSelect() {
    const wm = makeScene('worldmap', { worldSelect: true });
    if (wm) game.scenes.go(wm, { worldSelect: true }, { transition: 'stitch' });
  }
  update(dt) {
    this.stateT += dt; this.ticoT += dt;
    if (this.manager?.transitioning) return;
    // animação do Tico
    if (this.tico === 'wave' && this.ticoT > (animDuration('tico', 'wave') || 0.6) * 2) this.setTico('idle');
    if (this.confirm) { this.confirm.update(dt); if (this.confirm?.closed) this.confirm = null; return; }
    const any = input.anyPressed() || ['up', 'down', 'left', 'right', 'back'].some((a) => input.pressed(a));
    this.idleT = any ? 0 : this.idleT + dt;
    if (this.tico === 'sleep' && any) { this.setTico('wave'); return; }
    if (this.idleT > 25 && this.tico === 'idle') this.setTico('sleep');
    if (this.state === 'press') {
      if (this.stateT > 0.6 && any) {
        input.consume('confirm'); input.consume('jump');
        this.menu.pressIdx = -1;
        this.state = 'menu'; this.stateT = 0;
        audio.sfx('ui_open');
        this.setTico('wave');
      }
      return;
    }
    if (this.stateT < 0.15) return;
    if (this.menu.update(dt)) return;
    if (input.pressed('back')) { audio.sfx('ui_back'); this.state = 'press'; this.stateT = 0.6; }
  }
  draw(ctx) {
    const { w, h } = game.view;
    const t = game.time;
    const pos = drawTitleBackdrop(ctx, t);
    // (o Tico agora fica no próprio logo — veja drawLogo)
    // logo
    const scale = w >= 300 && h >= 190 ? 1 : 0.75;
    const intro = Ease.outBack(clamp(this.time / 0.9, 0, 1));
    const ly = Math.round(4 + (1 - intro) * -100);
    drawLogo(ctx, w / 2, ly, scale, t, { tico: this.tico, ticoT: this.ticoT });
    const logoBottom = ly + Math.round(82 * scale);
    if (this.state === 'press') {
      if (Math.sin(t * 4) > -0.4) font.draw(ctx, 'Toque para começar', w / 2, Math.round(Math.max(logoBottom + 30, h * 0.62)), { align: 'center', color: '#fff4dc', outline: '#1b1030' });
    } else {
      const n = this.menu.vis.length;
      const bh = 16, gap = Math.max(2, Math.min(4, Math.floor((h - logoBottom - 10 - n * bh) / n)));
      const total = n * (bh + gap) - gap;
      const y0 = Math.round(clamp(logoBottom + 6, 0, h - total - 6));
      const k = Ease.outCubic(clamp(this.stateT / 0.25, 0, 1));
      ctx.globalAlpha = k;
      this.menu.layoutV(Math.round(w / 2), y0 + Math.round((1 - k) * 10), Math.min(132, w * 0.42), bh, gap);
      this.menu.draw(ctx, t);
      ctx.globalAlpha = 1;
    }
    font.draw(ctx, 'v1.0', w - 4, h - 10, { align: 'right', color: '#5a6a8a' });
    if (this.confirm) this.confirm.draw(ctx, t);
  }
}
registerScene('title', TitleScene);

// ================================================================= SETTINGS
const TEXT_SPEEDS = [['Lenta', 0.6], ['Normal', 1], ['Rápida', 1.8]];
const TOUCH_SIZES = [['Pequeno', 0.8], ['Médio', 1], ['Grande', 1.25], ['Enorme', 1.5]];
class SettingsScene extends Scene {
  constructor(opts) { super(); this.opts = opts && typeof opts === 'object' && !(opts instanceof Scene) ? opts : {}; }
  get overlay() { return true; }
  enter(params) {
    if (params && params.onClose) this.opts.onClose = params.onClose;
    this.sel = 0; this.nav = { t: 0 }; this.navH = { t: 0 };
    this.drag = false; this.pressRow = -1; this.confirm = null;
    this.lpx = input.pointer.x; this.lpy = input.pointer.y;
    this.rows = [
      { id: 'music', label: 'Música', icon: 'icon_music', type: 'slider', min: 0, max: 1, step: 0.1 },
      { id: 'sfx', label: 'Efeitos', icon: 'icon_sfx', type: 'slider', min: 0, max: 1, step: 0.1 },
      { id: 'shake', label: 'Tremor de tela', type: 'toggle' },
      { id: 'vibrate', label: 'Vibração', type: 'toggle' },
      { id: 'showTimer', label: 'Mostrar cronômetro', icon: 'icon_clock', type: 'toggle' },
      { id: 'textSpeed', label: 'Velocidade do texto', type: 'choice', options: TEXT_SPEEDS },
      { id: 'touchOpacity', label: 'Toque: opacidade', icon: 'icon_hand', type: 'slider', min: 0.15, max: 1, step: 0.05 },
      { id: 'touchScale', label: 'Toque: tamanho', icon: 'icon_hand', type: 'choice', options: TOUCH_SIZES },
      { id: 'wipe', label: 'Apagar progresso', icon: 'icon_skull', type: 'action' },
      { id: 'back', label: 'Voltar', type: 'action' },
    ];
  }
  get S() { return save.settings; }
  apply(row) {
    const s = this.S;
    audio.setVolume('music', s.music);
    audio.setVolume('sfx', s.sfx);
    save.commitSettings();
    if (row?.id === 'vibrate' && s.vibrate) game.vibrate?.(40);
  }
  setSlider(row, v) {
    v = clamp(Math.round(v / row.step) * row.step, row.min, row.max);
    v = Math.round(v * 100) / 100;
    if (v === this.S[row.id]) return;
    this.S[row.id] = v;
    this.apply(row);
    if (row.id === 'sfx') audio.sfx('coin', { cooldown: 0.09 });
    else audio.sfx('ui_move', { cooldown: 0.05 });
  }
  choiceIndex(row) {
    const v = this.S[row.id];
    let best = 0;
    row.options.forEach((o, i) => { if (Math.abs(o[1] - v) < Math.abs(row.options[best][1] - v)) best = i; });
    return best;
  }
  adjust(row, d, fromConfirm) {
    if (row.type === 'slider') { if (!fromConfirm) this.setSlider(row, (this.S[row.id] ?? 0) + d * row.step); }
    else if (row.type === 'toggle') { this.S[row.id] = !this.S[row.id]; this.apply(row); audio.sfx('ui_switch'); }
    else if (row.type === 'choice') {
      const n = row.options.length;
      this.S[row.id] = row.options[(this.choiceIndex(row) + d + n) % n][1];
      this.apply(row); audio.sfx('ui_switch');
    } else if (fromConfirm) this.action(row);
  }
  action(row) {
    if (row.id === 'back') { this.close(); return; }
    if (row.id === 'wipe') {
      audio.sfx('ui_open');
      this.confirm = new ConfirmBox('Apagar TODO o progresso? Isso não pode ser desfeito.', () => {
        save.wipe();
        audio.sfx('ui_back');
        game.scenes.go(makeScene('title'), {}, { transition: 'stitch' });
      }, null, { yes: 'Apagar', no: 'Não' });
    }
  }
  close() {
    save.commitSettings();
    audio.sfx('ui_back');
    const cb = this.opts.onClose;
    closeScene(this);
    if (typeof cb === 'function') cb();
  }
  update(dt) {
    if (this.manager?.transitioning || this.time < 0.1) return;
    if (this.confirm) { this.confirm.update(dt); if (this.confirm.closed) this.confirm = null; return; }
    const n = this.rows.length;
    const d = navAxis(this.nav, dt, 'up', 'down');
    if (d) { this.sel = (this.sel + d + n) % n; audio.sfx('ui_move'); }
    const row = this.rows[this.sel];
    const a = navAxis(this.navH, dt, 'left', 'right');
    if (a && row.type !== 'action') this.adjust(row, a);
    if (input.pressed('confirm')) { input.consume('confirm'); this.adjust(row, 1, true); return; }
    if (input.pressed('back') || input.pressed('pause')) { input.consume('back'); input.consume('pause'); this.close(); return; }
    // ponteiro
    const p = input.pointer;
    const hit = this.rows.findIndex((r) => inRect(p, r.rect));
    if ((p.x !== this.lpx || p.y !== this.lpy) && !p.down && hit >= 0 && input.lastDevice !== 'touch' && hit !== this.sel) { this.sel = hit; audio.sfx('ui_move'); }
    this.lpx = p.x; this.lpy = p.y;
    if (p.pressed && hit >= 0) {
      this.sel = hit; this.pressRow = hit;
      const r = this.rows[hit];
      if (r.type === 'slider' && r.ctl && p.x >= r.ctl.x - 6) this.drag = true;
    }
    if (this.drag && p.down) {
      const r = this.rows[this.pressRow];
      if (r?.ctl) this.setSlider(r, r.min + clamp((p.x - r.ctl.x) / r.ctl.w, 0, 1) * (r.max - r.min));
    }
    if (p.released) {
      const r = this.rows[this.pressRow];
      if (!this.drag && r && hit === this.pressRow) {
        if (r.type === 'toggle') this.adjust(r, 1);
        else if (r.type === 'choice') this.adjust(r, p.x < r.ctl.x + r.ctl.w / 2 ? -1 : 1);
        else if (r.type === 'action') { audio.sfx('ui_select'); this.action(r); }
      }
      this.drag = false; this.pressRow = -1;
    }
  }
  draw(ctx) {
    const { w, h } = game.view, t = game.time;
    dimScreen(ctx, 0.62);
    const n = this.rows.length;
    const rh = clamp(Math.floor((h - 44) / n), 12, 16);
    const pw = Math.min(w - 16, 330), ph = n * rh + 10;
    const px = Math.round(w / 2 - pw / 2), py = Math.max(22, Math.round((h - ph) / 2) + 6);
    font.draw(ctx, 'Configurações', w / 2, py - 15, { align: 'center', color: '#ffd23f', outline: '#1b1030' });
    drawPanel(ctx, px, py, pw, ph, 'dark');
    const cw = Math.min(110, Math.round(pw * 0.38));
    this.rows.forEach((r, i) => {
      const y = py + 5 + i * rh;
      r.rect = { x: px + 4, y, w: pw - 8, h: rh };
      const sel = i === this.sel;
      if (sel) {
        ctx.fillStyle = '#3f3168'; ctx.fillRect(px + 5, y, pw - 10, rh - 1);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(px + 5, y, 2, rh - 1);
      }
      const ty = y + Math.floor((rh - 8) / 2);
      let lx = px + 11;
      const icon = r.icon && getImage(r.icon);
      if (icon) { ctx.drawImage(icon, lx, y + Math.floor((rh - icon.height) / 2)); }
      lx += 14;
      const col = r.id === 'wipe' ? '#ff8aa4' : sel ? '#fff4dc' : '#c8bce8';
      font.draw(ctx, r.label, lx, ty, { color: col, shadow: '#0b0716' });
      const cx = px + pw - 10 - cw;
      r.ctl = { x: cx, y, w: cw, h: rh };
      if (r.type === 'slider') {
        const v = this.S[r.id] ?? 0, ratio = (v - r.min) / (r.max - r.min);
        const bw = cw - 26;
        r.ctl = { x: cx, y, w: bw, h: rh };
        drawBar(ctx, cx, y + Math.floor((rh - 7) / 2), bw, 7, ratio, { fill: r.id === 'music' ? '#b07aff' : r.id === 'sfx' ? '#3fc7c0' : '#ffd23f' });
        const kx = cx + Math.round((bw - 2) * ratio);
        ctx.fillStyle = '#1b1030'; ctx.fillRect(kx - 1, y + Math.floor((rh - 11) / 2), 4, 11);
        ctx.fillStyle = sel ? '#fff4dc' : '#c8bce8'; ctx.fillRect(kx, y + Math.floor((rh - 11) / 2) + 1, 2, 9);
        font.draw(ctx, Math.round(v * 100) + '%', px + pw - 10, ty, { align: 'right', color: '#e8dcff' });
      } else if (r.type === 'toggle') {
        const on = !!this.S[r.id];
        const sx = px + pw - 10 - 46, sy = y + Math.floor((rh - 9) / 2);
        ctx.fillStyle = '#0b0716'; ctx.fillRect(sx, sy, 20, 9);
        ctx.fillStyle = on ? '#3fc7c0' : '#3a2f5a'; ctx.fillRect(sx + 1, sy + 1, 18, 7);
        ctx.fillStyle = on ? '#d8fffb' : '#7a68b8'; ctx.fillRect(sx + (on ? 11 : 2), sy + 2, 7, 5);
        font.draw(ctx, on ? 'Sim' : 'Não', px + pw - 10, ty, { align: 'right', color: on ? '#7fe6df' : '#9a8ac8' });
      } else if (r.type === 'choice') {
        const label = r.options[this.choiceIndex(r)][0];
        const l = getImage('icon_arrow_l'), rr = getImage('icon_arrow_r');
        const mid = cx + Math.round(cw / 2);
        if (l) ctx.drawImage(l, cx + 4, y + Math.floor((rh - l.height) / 2));
        if (rr) ctx.drawImage(rr, cx + cw - 4 - rr.width, y + Math.floor((rh - rr.height) / 2));
        font.draw(ctx, label, mid, ty, { align: 'center', color: '#ffd23f' });
      }
    });
    if (this.confirm) this.confirm.draw(ctx, t);
  }
}
registerScene('settings', SettingsScene);

// ================================================================== CREDITS
const ROLES = [
  'Direção e Programação do Motor', 'Arte do Tico', 'Retratos', 'Mundos 1-5', 'Música', 'Efeitos Sonoros',
  'Habilidades', 'Inimigos e Chefes', 'Fases', 'História e Diálogos', 'Cutscenes', 'Interface',
];
const curtainCache = new Map();
function buildCurtain(w, h) {
  const key = w + 'x' + h;
  if (curtainCache.has(key)) return curtainCache.get(key);
  const c = createCanvas(w, h), g = c.getContext('2d');
  const tones = ['#4a0c28', '#6a1438', '#8a2048', '#a8305a', '#c04a6c'];
  for (let x = 0; x < w; x++) {
    const f = (Math.sin((x / 26) * Math.PI * 2) + 1) / 2; // dobras
    for (let y = 0; y < h; y += 2) {
      const v = f * 3.6 + (hash2(x, y) - 0.5) * 0.5 + (y / h) * -0.4;
      g.fillStyle = tones[clamp(Math.round(v), 0, 4)];
      g.fillRect(x, y, 1, 2);
    }
  }
  // costuras douradas entre os painéis
  for (let x = 13; x < w; x += 52) {
    g.fillStyle = '#3a0820'; g.fillRect(x, 0, 1, h);
    g.fillStyle = '#ffd23f';
    for (let y = 18; y < h; y += 6) { g.fillRect(x - 1, y, 1, 3); g.fillRect(x + 1, y + 3, 1, 3); }
  }
  // sanefa no topo com franja
  g.fillStyle = '#5a0c2a'; g.fillRect(0, 0, w, 12);
  for (let x = 0; x < w; x++) { const d = 3 - Math.abs(((x % 20) - 10) / 3.4); g.fillRect(x, 12, 1, Math.max(0, Math.round(d))); }
  g.fillStyle = '#ffd23f';
  for (let x = 0; x < w; x += 2) g.fillRect(x, 11 + Math.round(3 - Math.abs(((x % 20) - 10) / 3.4)), 1, 2);
  g.fillStyle = '#ffe890'; for (let x = 2; x < w; x += 8) g.fillRect(x, 4, 4, 1);
  // palco
  g.fillStyle = '#3a2210'; g.fillRect(0, h - 10, w, 10);
  g.fillStyle = '#6e4620'; g.fillRect(0, h - 10, w, 1);
  for (let x = 0; x < w; x += 24) { g.fillStyle = '#2a1408'; g.fillRect(x, h - 9, 1, 9); }
  curtainCache.set(key, c);
  return c;
}
class CreditsScene extends Scene {
  enter() {
    const lines = [
      { k: 'logo', hgt: 92 },
      { k: 'big', s: 'STITCHED WORLDS', hgt: 12 }, { k: 'sub', s: 'O Último Brinquedo', hgt: 22 },
      { k: 'text', s: 'Um jogo feito por uma equipe de agentes Claude', hgt: 30 },
    ];
    ROLES.forEach((r, i) => {
      lines.push({ k: 'role', s: r, hgt: 11, icon: ['icon_thread', 'icon_star', 'icon_button', 'icon_patch'][i % 4] });
      lines.push({ k: 'name', s: i === 0 ? 'Claude, agente líder' : 'Agentes Claude', hgt: 22 });
    });
    lines.push({ k: 'text', s: 'Todo pixel e toda nota foram costurados em código.', hgt: 40 });
    lines.push({ k: 'end', s: 'Obrigado por jogar!', hgt: 0 });
    this.lines = lines;
    this.total = lines.reduce((a, l) => a + l.hgt, 0);
  }
  update(dt) {
    if (this.manager?.transitioning || this.time < 0.5) return;
    if (input.anyPressed() || input.pressed('back')) { input.consume('back'); audio.sfx('ui_back'); closeScene(this); }
  }
  draw(ctx) {
    const { w, h } = game.view, t = this.time;
    ctx.drawImage(buildCurtain(w, h), 0, 0);
    const cw = Math.min(w - 40, 300), cx = Math.round(w / 2);
    const top = 18, bot = h - 12;
    ctx.fillStyle = 'rgba(16,6,20,0.6)';
    ctx.fillRect(cx - cw / 2, top, cw, bot - top);
    ctx.fillStyle = '#ffd23f';
    for (let y = top + 2; y < bot; y += 6) { ctx.fillRect(cx - cw / 2 - 2, y, 1, 3); ctx.fillRect(cx + cw / 2 + 1, y + 3, 1, 3); }
    const endY = Math.round(h / 2 - 20);
    const scroll = Math.min(t * 18, this.total + bot - endY);
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - cw / 2, top, cw, bot - top); ctx.clip();
    let y = bot - scroll + 4;
    for (const l of this.lines) {
      if (y > -100 && y < h + 10) {
        if (l.k === 'logo') drawLogo(ctx, cx, y, cw >= 220 ? 1 : 0.75, t, { tico: false });
        else if (l.k === 'big') font.draw(ctx, l.s, cx, y, { align: 'center', color: '#ffd23f', shadow: '#3a0820' });
        else if (l.k === 'sub') font.draw(ctx, l.s, cx, y, { align: 'center', color: '#fff4dc' });
        else if (l.k === 'text') font.draw(ctx, l.s, cx, y, { align: 'center', color: '#ffb0c8', maxWidth: cw - 16 });
        else if (l.k === 'role') {
          const img = getImage(l.icon), tw = font.measure(l.s);
          if (img) { ctx.drawImage(img, cx - tw / 2 - img.width - 4, y - 2); ctx.drawImage(img, cx + tw / 2 + 4, y - 2); }
          font.draw(ctx, l.s, cx, y, { align: 'center', color: '#ffd23f' });
        } else if (l.k === 'name') font.draw(ctx, l.s, cx, y, { align: 'center', color: '#e8dcff' });
        else if (l.k === 'end') {
          font.draw(ctx, l.s, cx, y, { align: 'center', color: '#fff4dc', outline: '#3a0820', scale: 2 });
          drawSprite(ctx, 'tico', 'wave', animFrame('tico', 'wave', t), cx, y + 58);
        }
      }
      y += l.hgt;
    }
    ctx.restore();
    if (t > 2 && Math.sin(t * 3) > 0) font.draw(ctx, 'Toque para voltar', w - 6, h - 9, { align: 'right', color: '#e8c890' });
  }
}
registerScene('credits', CreditsScene);
