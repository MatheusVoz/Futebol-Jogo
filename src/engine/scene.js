// =============================================================================
// scene.js — Cenas e pilha de cenas com transições.
//
// class MinhaCena extends Scene {
//   enter(params) {}  exit() {}  update(dt) {}  draw(ctx) {}
//   get overlay() { return true }   // desenha a cena de baixo (pausa, diálogos)
//   get blocksUpdate() { return true } // impede update da cena de baixo
// }
// scenes.push(new X(), params)   scenes.pop()   scenes.replace(new Y(), params)
// scenes.go(new Y(), params, { transition:'fade'|'stitch'|'iris'|'none', time })
// =============================================================================
import { Ease } from './util.js';

export class Scene {
  constructor() { this.time = 0; this.manager = null; }
  get overlay() { return false; }
  get blocksUpdate() { return true; }
  enter(params) {}
  exit() {}
  resume() {}           // when scene above is popped
  update(dt) {}
  draw(ctx) {}
  resize(w, h) {}
}

export class SceneManager {
  constructor(game) {
    this.game = game;
    this.stack = [];
    this.transition = null; // {phase:'out'|'in', t, time, kind, action}
  }
  get top() { return this.stack[this.stack.length - 1]; }

  push(scene, params) {
    scene.manager = this;
    scene.game = this.game;
    this.stack.push(scene);
    scene.enter(params || {});
    return scene;
  }
  pop() {
    const s = this.stack.pop();
    if (s) s.exit();
    this.top?.resume();
    return s;
  }
  remove(scene) {
    const i = this.stack.indexOf(scene);
    if (i >= 0) { this.stack.splice(i, 1); scene.exit(); }
  }
  replace(scene, params) {
    while (this.stack.length) this.stack.pop().exit();
    return this.push(scene, params);
  }
  /** Replace whole stack with a transition. */
  go(scene, params, opts = {}) {
    const kind = opts.transition || 'fade';
    if (kind === 'none') { this.replace(scene, params); return; }
    if (this.transition) return; // ignore double-trigger
    this.transition = {
      phase: 'out', t: 0, time: opts.time ?? 0.45, kind, color: opts.color || '#0b0716',
      action: () => this.replace(scene, params),
    };
  }
  /** Run an arbitrary action hidden behind a transition. */
  cover(action, opts = {}) {
    if (this.transition) return;
    this.transition = { phase: 'out', t: 0, time: opts.time ?? 0.35, kind: opts.transition || 'fade', color: opts.color || '#0b0716', action };
  }
  get transitioning() { return !!this.transition; }

  update(dt) {
    // update from top until a scene blocks
    const n = this.stack.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = this.stack[i];
      s.time += dt;
      s.update(dt);
      if (s.blocksUpdate) break;
    }
    const tr = this.transition;
    if (tr) {
      tr.t += dt;
      if (tr.t >= tr.time) {
        if (tr.phase === 'out') {
          tr.phase = 'in'; tr.t = 0;
          try { tr.action(); } catch (e) { console.error(e); }
        } else this.transition = null;
      }
    }
  }

  draw(ctx) {
    // find lowest scene that needs drawing
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].overlay) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) this.stack[i].draw(ctx);
    if (this.transition) this.drawTransition(ctx);
  }

  drawTransition(ctx) {
    const tr = this.transition;
    const { w, h } = this.game.view;
    let k = Math.min(1, tr.t / tr.time);
    k = tr.phase === 'out' ? Ease.inOutQuad(k) : 1 - Ease.inOutQuad(k);
    ctx.save();
    ctx.fillStyle = tr.color;
    if (tr.kind === 'fade') {
      ctx.globalAlpha = k;
      ctx.fillRect(0, 0, w, h);
    } else if (tr.kind === 'iris') {
      const R = Math.hypot(w, h) * 0.55 * (1 - k);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, Math.max(0, R), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    } else if (tr.kind === 'stitch') {
      // two fabric curtains closing with a stitched seam
      const half = Math.ceil((w / 2) * k);
      ctx.fillStyle = '#2a1f4a';
      ctx.fillRect(0, 0, half, h);
      ctx.fillRect(w - half, 0, half, h);
      ctx.fillStyle = '#3b2d66';
      for (let y = 0; y < h; y += 8) { ctx.fillRect(0, y, half, 1); ctx.fillRect(w - half, y + 4, half, 1); }
      ctx.fillStyle = '#ffd23f';
      for (let y = 2; y < h; y += 8) {
        ctx.fillRect(half - 4, y, 3, 1);
        ctx.fillRect(w - half + 1, y + 4, 3, 1);
      }
    } else {
      ctx.globalAlpha = k;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
