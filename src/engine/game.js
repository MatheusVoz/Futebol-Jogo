// =============================================================================
// game.js — Núcleo: canvas com escala pixel-perfect, loop de passo fixo (60Hz),
// pilha de cenas e serviços globais.
//
//   import { game } from '../engine/game.js';
//   game.view.w / game.view.h   tamanho da tela LÓGICA (≈ 400-520 x 216-240)
//   game.scenes                 SceneManager
//   game.input / game.audio / game.save
//   game.events                 Emitter global ('levelComplete', 'pause', ...)
//   game.time                   segundos desde o início
//   game.timeScale              câmera lenta (1 = normal)
//   game.vibrate(ms)            vibração no celular (se habilitado)
// =============================================================================
import { SceneManager } from './scene.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { Emitter } from './util.js';

const STEP = 1 / 60;
const TARGET_H = 224;

class Game {
  constructor() {
    this.view = { w: 400, h: 224, scale: 1 };
    this.scenes = new SceneManager(this);
    this.input = input;
    this.audio = audio;
    this.save = save;
    this.events = new Emitter();
    this.time = 0;
    this.frame = 0;
    this.timeScale = 1;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.fps = 60;
    this.debug = { enabled: false, hitboxes: false, god: false };
    this.overlays = []; // functions(ctx) drawn after scenes (touch controls, debug)
    this.paused = false;
    this.params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  }

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    save.load();
    audio.volumes.music = save.settings.music;
    audio.volumes.sfx = save.settings.sfx;
    audio.volumes.master = save.settings.master;
    input.attach(window, canvas);
    input.toView = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * this.view.w, y: ((cy - r.top) / r.height) * this.view.h };
    };
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.events.emit('blur'); if (audio.ac) audio.ac.suspend(); }
      else { if (audio.ac) audio.ac.resume(); this.last = performance.now(); }
    });
    this.resize();
    return this;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const sw = Math.max(1, Math.floor(window.innerWidth * dpr));
    const sh = Math.max(1, Math.floor(window.innerHeight * dpr));
    const forced = this.params.get('scale');
    let scale = forced ? parseInt(forced, 10) : Math.max(1, Math.round(sh / TARGET_H));
    let vh = Math.floor(sh / scale);
    while (vh < 200 && scale > 1) { scale--; vh = Math.floor(sh / scale); }
    let vw = Math.floor(sw / scale);
    vw = Math.max(320, Math.min(vw, 560));
    vh = Math.max(200, Math.min(vh, 260));
    this.view.w = vw; this.view.h = vh; this.view.scale = scale;
    this.canvas.width = vw;
    this.canvas.height = vh;
    this.canvas.style.width = (vw * scale) / dpr + 'px';
    this.canvas.style.height = (vh * scale) / dpr + 'px';
    this.ctx.imageSmoothingEnabled = false;
    for (const s of this.scenes.stack) s.resize?.(vw, vh);
    this.events.emit('resize', vw, vh);
  }

  start(firstScene, params) {
    if (firstScene) this.scenes.replace(firstScene, params);
    this.running = true;
    this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.fps = this.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        this.tick(STEP);
        this.acc -= STEP;
        steps++;
      }
      if (steps >= 5) this.acc = 0;
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  tick(dt) {
    input.update();
    this.time += dt;
    this.frame++;
    if (save.hasGame()) save.data.playTime += dt;
    this.scenes.update(dt * this.timeScale);
    input.postUpdate();
  }

  /** Advance the simulation manually (used by automated tests). */
  stepFrames(n = 1) { for (let i = 0; i < n; i++) this.tick(STEP); this.render(); }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0716';
    ctx.fillRect(0, 0, this.view.w, this.view.h);
    this.scenes.draw(ctx);
    for (const o of this.overlays) { try { o(ctx); } catch (e) { console.error(e); } }
  }

  addOverlay(fn) { this.overlays.push(fn); return () => { this.overlays = this.overlays.filter((f) => f !== fn); }; }

  vibrate(ms = 20) {
    if (save.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }
}

export const game = new Game();
export default game;
