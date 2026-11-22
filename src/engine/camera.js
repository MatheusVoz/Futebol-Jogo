// =============================================================================
// camera.js — Câmera 2D suave com look-ahead, zona morta, limites, tremor e zoom.
//
//   cam.follow(entity)            cam.setBounds(0,0,w,h)
//   cam.shake(0.4)                // trauma 0..1 (decai sozinho)
//   cam.lockTo(rect)              // trava numa arena (chefes)
//   cam.panTo(x, y, dur, ease)    // para cutscenes (centro)
//   cam.zoom = 1.5                // zoom (renderizado pela cena)
// x,y = canto superior esquerdo em pixels de mundo.
// =============================================================================
import { clamp, damp, Ease } from './util.js';

export class Camera {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.x = 0; this.y = 0;
    this.target = null;
    this.bounds = null;
    this.lock = null;
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.lookX = 0; this.lookY = 0;
    this.offsetY = -18;        // frame the player slightly below center
    this.zoom = 1;
    this.targetZoom = 1;
    this.pan = null;           // {fx,fy,tx,ty,t,dur,ease}
    this.smooth = 7;
    this.time = 0;
    this.manual = false;       // when true, follow is disabled (cutscenes)
  }
  resize(w, h) { this.w = w; this.h = h; }
  follow(t, snap = true) { this.target = t; if (snap) this.snap(); }
  setBounds(x, y, w, h) { this.bounds = { x, y, w, h }; }
  lockTo(rect) { this.lock = rect; }
  unlock() { this.lock = null; }
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  get viewW() { return this.w / this.zoom; }
  get viewH() { return this.h / this.zoom; }
  get cx() { return this.x + this.viewW / 2; }
  get cy() { return this.y + this.viewH / 2; }

  /** Center camera on a world point instantly. */
  centerOn(x, y) { this.x = x - this.viewW / 2; this.y = y - this.viewH / 2; this.clampToBounds(); }

  snap() {
    if (!this.target) return;
    const t = this.target;
    this.centerOn(t.x + (t.w || 0) / 2, t.y + (t.h || 0) / 2 + this.offsetY);
  }

  /** Cutscene pan: move center to (x,y) over dur seconds. */
  panTo(x, y, dur = 1, ease = Ease.inOutQuad) {
    this.manual = true;
    this.pan = { fx: this.cx, fy: this.cy, tx: x, ty: y, t: 0, dur: Math.max(0.001, dur), ease };
  }
  get panning() { return !!this.pan; }
  release() { this.manual = false; this.pan = null; }

  clampToBounds() {
    const b = this.lock || this.bounds;
    if (!b) return;
    const vw = this.viewW, vh = this.viewH;
    if (b.w <= vw) this.x = b.x + (b.w - vw) / 2; else this.x = clamp(this.x, b.x, b.x + b.w - vw);
    if (b.h <= vh) this.y = b.y + b.h - vh; else this.y = clamp(this.y, b.y, b.y + b.h - vh);
  }

  update(dt) {
    this.time += dt;
    this.zoom = damp(this.zoom, this.targetZoom, 6, dt);
    if (Math.abs(this.zoom - this.targetZoom) < 0.002) this.zoom = this.targetZoom;
    if (this.pan) {
      const p = this.pan;
      p.t += dt;
      const k = p.ease(Math.min(1, p.t / p.dur));
      this.centerOn(p.fx + (p.tx - p.fx) * k, p.fy + (p.ty - p.fy) * k);
      if (p.t >= p.dur) this.pan = null;
    } else if (this.target && !this.manual) {
      const t = this.target;
      const vx = t.vx || 0;
      // look-ahead in movement direction
      const wantLook = clamp(vx * 0.35, -48, 48) + (t.facing || 0) * 14;
      this.lookX = damp(this.lookX, wantLook, 2.5, dt);
      const lookDown = t.lookDown ? 40 : t.lookUp ? -40 : 0;
      this.lookY = damp(this.lookY, lookDown, 3, dt);
      const tx = t.x + (t.w || 0) / 2 + this.lookX - this.viewW / 2;
      let ty = t.y + (t.h || 0) / 2 + this.offsetY + this.lookY - this.viewH / 2;
      // vertical: only follow quickly when falling fast or grounded
      const vy = t.vy || 0;
      const vSmooth = t.grounded || vy > 200 || vy < -350 ? this.smooth : this.smooth * 0.45;
      this.x = damp(this.x, tx, this.smooth, dt);
      this.y = damp(this.y, ty, vSmooth, dt);
      this.clampToBounds();
    }
    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    const mag = 7 * s * (this.shakeScale ?? 1);
    this.shakeX = (Math.sin(this.time * 61.3) + Math.sin(this.time * 23.1) * 0.6) * mag;
    this.shakeY = (Math.cos(this.time * 53.7) + Math.sin(this.time * 31.9) * 0.6) * mag;
  }

  /** Integer render offset (apply as ctx.translate(-rx, -ry)). */
  get rx() { return Math.round(this.x + this.shakeX); }
  get ry() { return Math.round(this.y + this.shakeY); }

  /** Is world rect visible (with margin)? */
  visible(x, y, w, h, margin = 32) {
    return x + w > this.x - margin && x < this.x + this.viewW + margin && y + h > this.y - margin && y < this.y + this.viewH + margin;
  }
}
