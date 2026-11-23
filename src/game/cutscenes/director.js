// =============================================================================
// cutscenes/director.js — Diretor de cutscenes.
//
//   runCutscene(level, id, params) -> Promise   cutscene DENTRO da fase (congela o Tico,
//                                               tarjas de cinema, controla level.camera)
//   makeScene('cutscene', id, { next, params }) cena cinematográfica própria com PALCO:
//        def.stage = function(ctx, cs, t) | nome registrado com registerStage(name, fn).
//        O palco é desenhado com a câmera do palco JÁ aplicada (cs.cam = {x,y,zoom}: x,y é o
//        CENTRO da vista em coordenadas do palco; padrão 0,0). cs.view = {w,h};
//        cs.viewRect() = retângulo visível em coords do palco. Atores/partículas usam as mesmas coords.
//
// API cs (as que bloqueiam são geradores: use yield*; chamadas SEM yield* disparam e seguem):
//   wait(s) say(lines|id)→idx choice(prompt, options)→idx (cs.lastChoice)
//   pan(x,y,dur) panTo(ent,dur) zoom(z,dur) shake(a) flash(color,dur) fadeOut(dur,color) fadeIn(dur)
//   letterbox(on,dur) music(name) sfx(name,opts) caption(text,dur) title(text,sub,dur)
//   walk(ent,x,speed) anim(ent,name) face(ent,dir|ent) spawn(type,x,y,props)
//   actor({sprite,anim,x,y,flip,alpha,z,scale,draw?}) → Actor   move(obj,x,y,dur,ease) fade(actor,alpha,dur)
//   particles(name,x,y,n,overrides) parallel(...gens) setFlag(name,v) unlockAbility(id)
//   player level stage params time dt view cam lastChoice skipping
// Dentro do gerador também valem: `yield 0.5` (segundos), `yield () => cond`, `yield` (1 quadro).
// Pular: segurar pausa/voltar (~0,7 s) ou tocar 2x em "Pular" no canto → tudo instantâneo,
// efeitos colaterais (flags, habilidades, spawns) continuam acontecendo. Marca save.markSeen(id).
// =============================================================================
import { R, registerScene, registerCutscene, makeScene } from '../registry.js';
import { Scene } from '../../engine/scene.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { audio, hasSong, hasSfx } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import font from '../../engine/font.js';
import { Entity } from '../../engine/entity.js';
import { ParticleSystem } from '../../engine/particles.js';
import { drawSprite, animFrame, getSprite, hasSprite } from '../../engine/sprites.js';
import { createCanvas } from '../../engine/pixel.js';
import { clamp, Ease } from '../../engine/util.js';
import { DialogueBox } from '../ui/dialogue.js';

const stages = new Map();
/** Registra um palco reutilizável: fn(ctx, cs, t) desenhado em coords do palco. */
export function registerStage(name, fn) { stages.set(name, fn); }

const FRAME = Symbol('frame');
function* none(v) { return v; }

// ----------------------------------------------------------------- Runner
/** Executor de corrotinas que entende "pular" (esperas viram zero). */
class Runner {
  constructor(cs, it) { this.cs = cs; this.stack = [it]; this.wait = 0; this.cond = null; this.done = false; this.sent = undefined; }
  step(dt) {
    const cs = this.cs;
    if (this.done) return;
    if (this.wait > 0) { this.wait -= cs.skipping ? Infinity : dt; if (this.wait > 0) return; }
    let guard = 0;
    while (this.stack.length) {
      if (++guard > 4000) return;
      if (this.wait > 0) { if (cs.skipping) this.wait = 0; else return; }
      if (this.cond) { if (!this.cond()) return; this.cond = null; }
      const it = this.stack[this.stack.length - 1];
      let r;
      try { r = it.next(this.sent); } catch (e) { console.error('[cutscene]', cs.id, e); this.stack.length = 0; break; }
      this.sent = undefined;
      if (r.done) { this.stack.pop(); this.sent = r.value; continue; }
      const v = r.value;
      if (v == null || v === FRAME) { const f = cs.frame; this.cond = () => cs.frame !== f; }
      else if (typeof v === 'number') this.wait = v;
      else if (typeof v === 'function') this.cond = v;
      else if (typeof v.next === 'function') this.stack.push(v);
      else if (typeof v.then === 'function') { let ok = false; v.then(() => { ok = true; }, () => { ok = true; }); this.cond = () => ok; }
    }
    this.done = true;
  }
}

// ----------------------------------------------------------------- Actor
/** Ator de cutscene: sprite animado (ou draw próprio) em coordenadas do palco/mundo (x,y = pivô/pés). */
export class Actor {
  constructor(o = {}) {
    Object.assign(this, { sprite: null, anim: 'idle', x: 0, y: 0, flip: false, alpha: 1, z: 0, scale: 1, draw: null, visible: true, t: 0, variant: null }, o);
  }
  setAnim(a) { if (a !== this.anim) { this.anim = a; this.t = 0; } }
  get height() {
    if (typeof this.h === 'number') return this.h;
    const s = this.sprite && hasSprite(this.sprite) ? getSprite(this.sprite) : null;
    return s ? s.oy * this.scale : 24;
  }
  get headX() { return this.x; }
  get headY() { return this.y - this.height; }
  update(dt) { this.t += dt; }
  render(ctx) {
    if (!this.visible || this.alpha <= 0) return;
    if (this.draw) { ctx.save(); ctx.globalAlpha *= this.alpha; this.draw(ctx, this, this.t); ctx.restore(); return; }
    if (!this.sprite || !hasSprite(this.sprite)) return;
    const f = animFrame(this.sprite, this.anim, this.t);
    drawSprite(ctx, this.sprite, this.anim, f, Math.round(this.x), Math.round(this.y), {
      flip: this.flip, alpha: this.alpha, scaleX: this.scale, scaleY: this.scale, variant: this.variant || undefined,
    });
  }
  *[Symbol.iterator]() { return this; }
}

/** Embrulha um Actor como entidade da fase (para cs.actor dentro de fases). */
class ActorEntity extends Entity {
  constructor(level, actor) {
    super(level, actor.x, actor.y, {});
    this.actor = actor; this.w = 1; this.h = 1;
    this.alwaysUpdate = true; this.alwaysDraw = true;
  }
  update(dt) { this.actor.update(dt); this.z = this.actor.z; this.x = this.actor.x; this.y = this.actor.y; }
  draw(ctx) { this.actor.render(ctx); }
}

// ----------------------------------------------------------------- Overlays (tela)
/** Estado visual compartilhado: tarjas, flash, fade, legenda e título. */
class Overlays {
  constructor() { this.bars = 0; this.barsTarget = 0; this.barsSpeed = 3; this.flash = null; this.fadeA = 0; this.fadeColor = '#0b0716'; this.caption = null; this.title = null; this.skipHint = 0; this.skipArm = 0; this.hold = 0; }
  update(dt) {
    const d = this.barsTarget - this.bars;
    this.bars = Math.abs(d) < 0.01 ? this.barsTarget : this.bars + Math.sign(d) * Math.min(Math.abs(d), dt * this.barsSpeed);
    if (this.flash) { this.flash.t += dt; if (this.flash.t >= this.flash.dur) this.flash = null; }
    if (this.caption) { this.caption.t += dt; if (this.caption.t > this.caption.dur + 0.4) this.caption = null; }
    if (this.title) { this.title.t += dt; if (this.title.t > this.title.dur) this.title = null; }
    if (this.skipHint > 0) this.skipHint -= dt;
    if (this.skipArm > 0) this.skipArm -= dt;
  }
  get busy() { return this.bars !== this.barsTarget || this.fadeA > 0 || !!this.flash; }
  draw(ctx, cs) {
    const W = game.view.w, H = game.view.h;
    const bh = Math.round(Ease.inOutQuad(this.bars) * Math.min(24, H * 0.1));
    if (bh > 0) {
      ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
      ctx.fillStyle = '#2a1f4a';
      for (let x = 2; x < W; x += 6) { ctx.fillRect(x, bh - 3, 3, 1); ctx.fillRect(x + 3, H - bh + 2, 3, 1); }
    }
    if (this.title) this.drawTitle(ctx, W, H);
    if (this.caption) this.drawCaption(ctx, W, H);
    if (this.flash) { ctx.globalAlpha = 1 - this.flash.t / this.flash.dur; ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.fadeA > 0) { ctx.globalAlpha = clamp(this.fadeA, 0, 1); ctx.fillStyle = this.fadeColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (cs && !cs.ended && cs.skippable) this.drawSkip(ctx, W, cs);
  }
  drawCaption(ctx, W, H) {
    const c = this.caption;
    const k = c.t < 0.25 ? c.t / 0.25 : c.t > c.dur ? 1 - (c.t - c.dur) / 0.4 : 1;
    const lines = font.wrap(c.text, Math.min(380, W - 40));
    const hh = lines.length * 10 + 16;
    const y = Math.round(H * 0.5 - hh / 2);
    ctx.globalAlpha = clamp(k, 0, 1) * 0.85;
    ctx.fillStyle = '#0b0716'; ctx.fillRect(0, y, W, hh);
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.fillStyle = '#c9a24a';
    for (let x = 1; x < W; x += 6) { ctx.fillRect(x, y + 2, 3, 1); ctx.fillRect(x + 3, y + hh - 3, 3, 1); }
    const n = Math.floor(c.chars);
    font.draw(ctx, c.text, Math.round(W / 2), y + 8, { align: 'center', color: '#f6e7c8', shadow: '#000', maxWidth: Math.min(380, W - 40), maxChars: n });
    ctx.globalAlpha = 1;
  }
  drawTitle(ctx, W, H) {
    const c = this.title;
    const tin = clamp(c.t / 0.5, 0, 1), tout = clamp((c.dur - c.t) / 0.45, 0, 1);
    const k = Math.min(Ease.outBack(tin), Ease.inOutQuad(tout));
    const tw = Math.max(font.measure(c.text) * 2, font.measure(c.sub || '')) + 40;
    const bw = Math.min(W - 16, tw), bh = c.sub ? 42 : 30;
    const x = Math.round((W - bw) / 2);
    const y = Math.round(-bh - 10 + (H * 0.3 + bh / 2 + 10) * k);
    // faixa de tecido com pontas recortadas em "V"
    const body = '#7a2f5a', light = '#a8487a', dark = '#4a1a38';
    ctx.fillStyle = '#0b071660'; ctx.fillRect(x - 10, y + 3, bw + 22, bh);
    const th = bh - 2, ty = y + 6;
    for (const side of [-1, 1]) {
      for (let j = 0; j < th; j++) {
        const notch = Math.max(0, 6 - Math.round(Math.abs(j - (th - 1) / 2) * 12 / th));
        const L = 18 - notch;
        const rx = side < 0 ? x - 16 + notch : x + bw - 2;
        ctx.fillStyle = '#1b1030'; ctx.fillRect(rx, ty + j, L, 1);
        if (j > 0 && j < th - 1) { ctx.fillStyle = j < 3 ? body : dark; ctx.fillRect(side < 0 ? rx + 1 : rx, ty + j, L - 1, 1); }
      }
    }
    ctx.fillStyle = '#1b1030'; ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
    ctx.fillStyle = body; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = light; ctx.fillRect(x, y, bw, 2);
    ctx.fillStyle = dark; ctx.fillRect(x, y + bh - 2, bw, 2);
    ctx.fillStyle = '#ffd23f';
    for (let xx = x + 3; xx < x + bw - 3; xx += 6) { ctx.fillRect(xx, y + 3, 3, 1); ctx.fillRect(xx, y + bh - 4, 3, 1); }
    font.draw(ctx, c.text, Math.round(W / 2), y + 7, { align: 'center', scale: 2, color: '#fff4dc', outline: '#1b1030' });
    if (c.sub) font.draw(ctx, c.sub, Math.round(W / 2), y + 27, { align: 'center', color: '#ffd23f', shadow: '#1b1030' });
  }
  skipRect(W) { return { x: W - 52, y: 3, w: 48, h: 13 }; }
  drawSkip(ctx, W, cs) {
    const r = this.skipRect(W);
    const show = input.lastDevice === 'touch' || this.skipArm > 0 || this.hold > 0 || this.skipHint > 0;
    if (!show) return;
    ctx.globalAlpha = this.skipArm > 0 || this.hold > 0 ? 0.95 : 0.6;
    ctx.fillStyle = '#1b1030'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = this.skipArm > 0 ? '#7a2f5a' : '#2a1f4a'; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (this.hold > 0) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(r.x + 1, r.y + r.h - 2, Math.round((r.w - 2) * clamp(this.hold / cs.holdNeed, 0, 1)), 1); }
    font.draw(ctx, 'Pular', r.x + 6, r.y + 3, { color: '#fff4dc' });
    ctx.fillStyle = '#ffd23f';
    for (const ox of [36, 41]) for (let i = 0; i < 3; i++) ctx.fillRect(r.x + ox + i, r.y + 3 + i, 1, 7 - i * 2);
    ctx.globalAlpha = 1;
    if (this.skipArm > 0) font.draw(ctx, 'Toque de novo', r.x + r.w, r.y + r.h + 3, { align: 'right', color: '#fff4dc', shadow: '#000' });
    else if (this.skipHint > 0 && input.lastDevice !== 'touch') font.draw(ctx, 'Segure para pular', r.x + r.w, r.y + r.h + 3, { align: 'right', color: '#fff4dc', shadow: '#000' });
  }
}

// ----------------------------------------------------------------- cs
function easeOf(e) { return typeof e === 'function' ? e : Ease[e] || Ease.inOutQuad; }

function createCS({ id, def, params, level, scene }) {
  const ov = new Overlays();
  const tweens = [];
  const walkers = [];
  const cs = {
    id, params: params || {}, level: level || null, stage: scene || null,
    player: level ? level.player : null,
    lastChoice: undefined, skipping: false, ended: false, frame: 0, time: 0, dt: 0,
    skippable: def.skippable !== false, holdNeed: 0.7,
    cam: { x: 0, y: 0, zoom: 1, trauma: 0, sx: 0, sy: 0 },
    actors: [], spawned: [], overlays: ov,
    get view() { return { w: game.view.w, h: game.view.h }; },
    get dialogue() { return level ? level.dialogue : scene.dialogue; },
    get particleSystem() { return level ? level.particles : scene.particles; },
  };

  // ---- interno
  const until = function* (fn) { while (!fn()) yield FRAME; };
  const tween = (dur, apply, ease = Ease.inOutQuad) => {
    const tw = { t: 0, dur: Math.max(0.0001, dur || 0), apply, ease: easeOf(ease), done: false };
    tw.finish = () => { if (!tw.done) { tw.done = true; tw.apply(1); } };
    if (cs.skipping || !dur) tw.finish(); else { tw.apply(0); tweens.push(tw); }
    return tw;
  };
  const waitTween = (tw) => until(() => tw.done);
  cs._update = (dt) => {
    for (const tw of tweens) {
      if (tw.done) continue;
      if (cs.skipping) { tw.finish(); continue; }
      tw.t += dt; tw.apply(tw.ease(Math.min(1, tw.t / tw.dur)));
      if (tw.t >= tw.dur) tw.done = true;
    }
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].done) tweens.splice(i, 1);
    for (const w of walkers) w.step(dt);
    for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].done) walkers.splice(i, 1);
    if (ov.caption && ov.caption.chars < ov.caption.len) ov.caption.chars += dt * 40 * (save.settings?.textSpeed ?? 1);
    ov.update(dt);
  };
  const entCenter = (e) => (e instanceof Actor ? { x: e.x, y: e.y - e.height / 2 } : { x: e.x + (e.w || 0) / 2, y: e.y + (e.h || 0) / 2 });

  // ---- tempo
  cs.wait = function* (s = 0.5) { const end = cs.time + s; yield* until(() => cs.skipping || cs.time >= end); };

  // ---- diálogo
  cs.say = function* (lines, opts = {}) {
    if (typeof lines === 'string') lines = R.dialogues.get(lines) || [lines];
    if (!Array.isArray(lines)) lines = [lines];
    let result;
    if (cs.skipping) {
      for (const l of lines) if (l && l.choices) result = l.default ?? 0;
    } else {
      const dlg = cs.dialogue;
      if (level) level.say(lines, opts); else dlg.start(lines, opts);
      // sonda o estado (não depende de microtarefas de Promise)
      yield* until(() => !dlg.active || cs.skipping);
      if (dlg.active) dlg.skip();
      result = dlg.result;
      if (cs.skipping) for (const l of lines) if (l && l.choices) result = l.default ?? 0;
    }
    if (result !== undefined) cs.lastChoice = result;
    return result;
  };
  cs.choice = function* (prompt, options = [], extra = {}) {
    const line = typeof prompt === 'string' ? { who: extra.who || 'narrador', text: prompt } : { ...prompt };
    line.choices = options;
    if (extra.default != null) line.default = extra.default;
    const r = yield* cs.say([line]);
    cs.lastChoice = r ?? 0;
    return cs.lastChoice;
  };

  // ---- câmera
  const camLevel = level ? level.camera : null;
  cs.pan = function (x, y, dur = 1, ease) {
    if (camLevel) {
      if (cs.skipping || !dur) { camLevel.manual = true; camLevel.pan = null; camLevel.centerOn(x, y); return none(); }
      camLevel.panTo(x, y, dur, easeOf(ease));
      return until(() => cs.skipping ? (camLevel.pan = null, camLevel.centerOn(x, y), true) : !camLevel.panning);
    }
    const c = cs.cam, fx = c.x, fy = c.y;
    return waitTween(tween(dur, (k) => { c.x = fx + (x - fx) * k; c.y = fy + (y - fy) * k; }, ease));
  };
  cs.panTo = function (ent, dur = 1, ease) {
    if (!ent) return none();
    const p = entCenter(ent);
    return cs.pan(p.x, p.y + (camLevel ? camLevel.offsetY * 0.5 : 0), dur, ease);
  };
  cs.zoom = function (z = 1, dur = 0.6, ease) {
    if (camLevel) {
      const fz = camLevel.zoom;
      return waitTween(tween(dur, (k) => {
        const cx = camLevel.cx, cy = camLevel.cy;
        camLevel.zoom = camLevel.targetZoom = fz + (z - fz) * k;
        if (camLevel.manual && !camLevel.pan) camLevel.centerOn(cx, cy);
      }, ease));
    }
    const c = cs.cam, fz = c.zoom;
    return waitTween(tween(dur, (k) => { c.zoom = fz + (z - fz) * k; }, ease));
  };
  cs.shake = function (a = 0.4) {
    if (level) level.shake(a); else cs.cam.trauma = Math.min(1, cs.cam.trauma + a);
    return none();
  };

  // ---- tela
  cs.flash = function (color = '#ffffff', dur = 0.3) { if (!cs.skipping) ov.flash = { color, dur, t: 0 }; return none(); };
  cs.fadeOut = function (dur = 0.6, color = '#0b0716') { ov.fadeColor = color; const f = ov.fadeA; return waitTween(tween(dur, (k) => { ov.fadeA = f + (1 - f) * k; }, Ease.linear)); };
  cs.fadeIn = function (dur = 0.6) { const f = ov.fadeA; return waitTween(tween(dur, (k) => { ov.fadeA = f * (1 - k); }, Ease.linear)); };
  cs.letterbox = function (on = true, dur = 0.4) {
    ov.barsTarget = on ? 1 : 0; ov.barsSpeed = 1 / Math.max(0.05, dur);
    if (cs.skipping) ov.bars = ov.barsTarget;
    return until(() => cs.skipping || ov.bars === ov.barsTarget);
  };
  cs.caption = function (text, dur) {
    text = String(text);
    const len = font.visibleLength(text);
    dur = dur ?? 1.6 + len * 0.045;
    if (cs.skipping) { ov.caption = null; return none(); }
    const c = ov.caption = { text, dur, t: 0, chars: 0, len };
    return until(() => {
      if (cs.skipping) { ov.caption = null; return true; }
      if (c.t > 0.3 && (input.pressed('confirm') || input.pressed('jump') || (input.pointer.pressed && !cs._tapUsed))) {
        if (c.chars < c.len) c.chars = c.len; else if (c.t < c.dur) c.t = c.dur;
      }
      return c.t >= c.dur + 0.4 || ov.caption !== c;
    });
  };
  cs.title = function (text, sub = '', dur = 3) {
    if (cs.skipping) return none();
    const c = ov.title = { text: String(text), sub, dur, t: 0 };
    audio.sfx('page_turn');
    return until(() => cs.skipping || ov.title !== c);
  };

  // ---- áudio
  cs.music = function (name, opts = {}) {
    if (!name) audio.stopMusic?.(opts.fade ?? 1);
    else if (hasSong(name)) audio.playMusic(name, { fade: opts.fade ?? 1 });
    return none();
  };
  cs.sfx = function (name, opts) { if (!cs.skipping && hasSfx(name)) audio.sfx(name, opts); return none(); };

  // ---- personagens
  cs.walk = function (ent, x, speed = 70) {
    if (!ent) return none();
    const isPlayer = level && ent === level.player;
    const dir = Math.sign(x - (ent instanceof Actor ? ent.x : ent.x)) || 1;
    const dist = Math.abs(x - ent.x);
    const w = { done: false, t: 0, max: dist / speed * 1.6 + 0.5 };
    const stop = () => {
      w.done = true;
      if (isPlayer) { ent.vx = 0; }
      else if (ent instanceof Actor) { if (w.prevAnim && ent.anim === 'walk') ent.setAnim(w.prevAnim); }
    };
    w.step = (dt) => {
      if (w.done) return;
      w.t += dt;
      const ex = ent.x;
      if (cs.skipping || w.t > w.max) { ent.x = x; stop(); return; }
      if (isPlayer) {
        ent.facing = dir; ent.vx = dir * speed;
        if ((x - ex) * dir <= 1) { ent.x = x; stop(); }
      } else {
        const nx = ex + dir * speed * dt;
        if ((x - nx) * dir <= 0) { ent.x = x; stop(); } else ent.x = nx;
      }
    };
    if (ent instanceof Actor) { ent.flip = dir < 0; if (hasSprite(ent.sprite) && getSprite(ent.sprite).anims.walk) { w.prevAnim = ent.anim === 'walk' ? 'idle' : ent.anim; ent.setAnim('walk'); } }
    else ent.facing = dir;
    if (cs.skipping) { ent.x = x; stop(); return none(); }
    walkers.push(w);
    return until(() => w.done);
  };
  cs.anim = function (ent, name) {
    if (!ent) return none();
    if (level && ent === level.player) ent.cutsceneAnim = name || null;
    else if (ent instanceof Actor) ent.setAnim(name);
    else if (ent.setAnim) ent.setAnim(name); else ent.anim = name;
    return none();
  };
  cs.face = function (ent, dir) {
    if (!ent) return none();
    let d = dir;
    if (dir === 'left') d = -1; else if (dir === 'right') d = 1;
    else if (dir && typeof dir === 'object') d = Math.sign(entCenter(dir).x - entCenter(ent).x) || 1;
    if (ent instanceof Actor) ent.flip = d < 0; else ent.facing = d < 0 ? -1 : 1;
    return none();
  };
  cs.spawn = function (type, x, y, props = {}) {
    if (!level) return null;
    const e = level.spawn(type, x, y, props);
    if (e && typeof e === 'object') e[Symbol.iterator] = function* () { return e; };
    return e;
  };
  cs.actor = function (o = {}) {
    const a = o instanceof Actor ? o : new Actor(o);
    if (level) { const e = new ActorEntity(level, a); a.entity = e; level.add(e); cs.spawned.push(e); }
    else cs.actors.push(a);
    return a;
  };
  cs.removeActor = function (a) {
    if (!a) return none();
    if (a.entity) a.entity.remove ? a.entity.remove() : (a.entity.dead = true);
    const i = cs.actors.indexOf(a); if (i >= 0) cs.actors.splice(i, 1);
    return none();
  };
  cs.move = function (obj, x, y, dur = 1, ease) {
    if (!obj) return none();
    const fx = obj.x, fy = obj.y;
    x = x ?? fx; y = y ?? fy;
    return waitTween(tween(dur, (k) => { obj.x = fx + (x - fx) * k; obj.y = fy + (y - fy) * k; }, ease));
  };
  cs.fade = function (actor, alpha = 0, dur = 0.5) {
    if (!actor) return none();
    const f = actor.alpha ?? 1;
    return waitTween(tween(dur, (k) => { actor.alpha = f + (alpha - f) * k; }, Ease.linear));
  };
  cs.particles = function (name, x, y, n = 8, overrides) { if (!cs.skipping) cs.particleSystem?.emit(name, x, y, n, overrides); return none(); };
  cs.parallel = function* (...gens) {
    const rs = gens.filter(Boolean).map((g) => new Runner(cs, typeof g === 'function' ? g() : g));
    for (const r of rs) r.step(0);
    while (rs.some((r) => !r.done)) { yield FRAME; for (const r of rs) r.step(cs.dt); }
  };

  // ---- progresso
  cs.setFlag = function (name, v = true) { save.setFlag(name, v); return none(); };
  cs.unlockAbility = function (id) { save.unlockAbility(id); save.commit(); return none(); };
  cs.viewRect = function () {
    const z = cs.cam.zoom || 1, w = game.view.w / z, h = game.view.h / z;
    return { x: cs.cam.x - w / 2, y: cs.cam.y - h / 2, w, h };
  };

  // ---- controle de pular (chamado a cada quadro antes do diálogo)
  cs._skipInput = (dt) => {
    cs._tapUsed = false;
    if (!cs.skippable || cs.skipping) return;
    const W = game.view.w;
    const p = input.pointer, r = ov.skipRect(W);
    if (p.pressed && p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 6) {
      cs._tapUsed = true;
      cs.dialogue.suppressTap = true;
      if (ov.skipArm > 0) cs.skip(); else ov.skipArm = 2;
    }
    if (input.pressed('pause') || input.pressed('back')) ov.skipHint = 2;
    if (input.down('pause') || input.down('back')) { ov.hold += dt; if (ov.hold >= cs.holdNeed) cs.skip(); }
    else ov.hold = 0;
  };
  cs.skip = () => {
    if (cs.skipping) return;
    cs.skipping = true; ov.hold = 0; ov.skipArm = 0;
    if (cs.dialogue.active) cs.dialogue.skip();
    ov.caption = null; ov.title = null; ov.flash = null;
  };

  /** Avança um quadro: entrada de pular, tweens e o roteiro. */
  cs._frame = (dt) => {
    cs.dt = dt; cs.time += dt; cs.frame++;
    cs._skipInput(dt);
    cs._update(dt);
    cs.runner.step(dt);
    if (cs.skipping) { cs._update(0); cs.runner.step(0); }
  };
  cs.runner = new Runner(cs, (function* () { yield* def.run(cs); })());
  return cs;
}

// ----------------------------------------------------------------- dentro da fase
export function runCutscene(level, id, params = {}) {
  const def = R.cutscenes.get(id);
  if (!def) { console.warn('[cutscene] não encontrada:', id); return Promise.resolve(); }
  const cs = createCS({ id, def, params, level });
  const p = level.player;
  const prevState = p ? p.state : null;
  if (p) { p.state = 'frozen'; p.vx = 0; }
  const ov = cs.overlays;
  if (def.letterbox !== false) cs.letterbox(true, 0.35);
  if (def.music) cs.music(def.music);
  // pausa vira "segurar para pular" durante a cutscene (restaurado no fim)
  const ownPause = Object.prototype.hasOwnProperty.call(level, 'pauseGame') ? level.pauseGame : null;
  level.pauseGame = () => { ov.skipHint = 2; };
  const dlg = level.dialogue;
  const prevUnder = dlg.underlay;
  const under = (ctx) => { prevUnder?.(ctx); ov.draw(ctx, cs); };
  dlg.underlay = under;
  return new Promise((resolve) => {
    let last = level.time;
    level.tasks.run(function* () {
      yield () => {
        const dt = clamp(level.time - last, 0, 0.1); last = level.time;
        cs._frame(dt);
        return cs.runner.done;
      };
      // fim: devolve o controle já; tarjas/fade saem em segundo plano
      cs.ended = true;
      if (ownPause) level.pauseGame = ownPause; else delete level.pauseGame;
      if (p) {
        if (p.state === 'frozen') p.state = prevState && prevState !== 'frozen' && prevState !== 'dash' && prevState !== 'hurt' ? prevState : 'normal';
        p.cutsceneAnim = null;
      }
      for (const e of cs.spawned) if (!e.actor?.keep) e.dead = true;
      if (!def.keepCamera) { level.camera.release(); level.camera.targetZoom = 1; }
      save.markSeen(id); save.commit();
      resolve(cs.lastChoice);
      cs.skipping = false;
      cs.letterbox(false, 0.3);
      if (ov.fadeA > 0) cs.fadeIn(0.4);
      last = level.time;
      yield () => { const dt = clamp(level.time - last, 0, 0.1); last = level.time; cs._update(dt); return !ov.busy; };
      if (dlg.underlay === under) dlg.underlay = prevUnder || null;
    });
  });
}

// ----------------------------------------------------------------- cena própria
export class CutsceneScene extends Scene {
  constructor(id, opts = {}) {
    super();
    this.id = id;
    this.opts = opts || {};
  }
  enter(params = {}) {
    this.def = R.cutscenes.get(this.id);
    this.dialogue = new DialogueBox(this);
    this.particles = new ParticleSystem(500);
    this.finished = false;
    this.t = 0;
    if (!this.def) { console.warn('[cutscene] não encontrada:', this.id); this.def = { run: function* () {} }; }
    this.cs = createCS({ id: this.id, def: this.def, params: { ...(this.opts.params || {}), ...params }, scene: this });
    const st = this.def.stage;
    this.stageFn = typeof st === 'function' ? st : typeof st === 'string' ? stages.get(st) : null;
    if (typeof st === 'string' && !this.stageFn) console.warn('[cutscene] palco não registrado:', st);
    if (this.def.music) this.cs.music(this.def.music);
    if (this.def.letterbox) { this.cs.overlays.bars = 1; this.cs.overlays.barsTarget = 1; }
  }
  update(dt) {
    this.t += dt;
    const cs = this.cs;
    if (!this.finished) cs._frame(dt);
    else cs._update(dt);
    this.dialogue.update(dt);
    for (const a of cs.actors) a.update(dt);
    this.particles.update(dt);
    const c = cs.cam;
    c.trauma = Math.max(0, c.trauma - dt * 1.6);
    const m = 7 * c.trauma * c.trauma;
    c.sx = (Math.sin(this.t * 61.3) + Math.sin(this.t * 23.1) * 0.6) * m;
    c.sy = (Math.cos(this.t * 53.7) + Math.sin(this.t * 31.9) * 0.6) * m;
    if (!this.finished && cs.runner.done) this.finish();
  }
  finish() {
    this.finished = true;
    this.cs.ended = true;
    save.markSeen(this.id); save.commit();
    const next = this.opts.next;
    try {
      if (typeof next === 'function') next(this.cs);
      else if (typeof next === 'string') { const s = makeScene(next); if (s) this.manager.go(s, {}, { transition: 'fade' }); }
      else if (this.manager.stack.length > 1) this.manager.pop();
      else { const s = makeScene('title'); if (s) this.manager.go(s, {}, { transition: 'fade' }); }
    } catch (e) { console.error(e); }
  }
  /** Coordenadas do palco → tela (usado pelo balão com `at`). */
  worldToScreen(x, y) {
    const c = this.cs.cam, z = c.zoom || 1;
    return { x: (x - c.x - c.sx) * z + game.view.w / 2, y: (y - c.y - c.sy) * z + game.view.h / 2 };
  }
  drawStage(ctx, w, h) {
    const cs = this.cs, c = cs.cam;
    ctx.save();
    ctx.fillStyle = '#0b0716'; ctx.fillRect(0, 0, w, h);
    ctx.translate(Math.round(w / 2 - c.x - c.sx), Math.round(h / 2 - c.y - c.sy));
    try { this.stageFn?.(ctx, cs, this.t); } catch (e) { if (!this._warned) { console.error('[cutscene stage]', e); this._warned = true; } }
    const list = cs.actors.slice().sort((a, b) => a.z - b.z);
    this.particles.draw(ctx, false);
    for (const a of list) a.render(ctx);
    this.particles.draw(ctx, true);
    try { this.def.drawFront?.(ctx, cs, this.t); } catch (e) { /* opcional */ }
    ctx.restore();
  }
  draw(ctx) {
    const { w, h } = game.view;
    const z = this.cs.cam.zoom || 1;
    if (Math.abs(z - 1) > 0.001) {
      const cw = Math.ceil(w / z) + 2, ch = Math.ceil(h / z) + 2;
      if (!this.zc || this.zc.width !== cw || this.zc.height !== ch) this.zc = createCanvas(cw, ch);
      const zctx = this.zc.getContext('2d');
      zctx.imageSmoothingEnabled = false;
      this.drawStage(zctx, cw, ch);
      ctx.imageSmoothingEnabled = false;
      const ox = Math.round((w - cw * z) / 2), oy = Math.round((h - ch * z) / 2);
      ctx.drawImage(this.zc, 0, 0, cw, ch, ox, oy, cw * z, ch * z);
    } else this.drawStage(ctx, w, h);
    try { this.def.drawScreen?.(ctx, this.cs, this.t); } catch (e) { /* opcional */ }
    this.cs.overlays.draw(ctx, this.cs);
    this.dialogue.draw(ctx);
  }
}
registerScene('cutscene', CutsceneScene);

// ----------------------------------------------------------------- demo
/** Quarto da Lia à noite (palco de demonstração, coords: chão em y=40). */
registerStage('quarto_noite', (ctx, cs, t) => {
  const r = cs.viewRect();
  const x0 = Math.floor(r.x) - 2, x1 = Math.ceil(r.x + r.w) + 2, y0 = Math.floor(r.y) - 2, y1 = Math.ceil(r.y + r.h) + 2;
  // parede com papel listrado
  ctx.fillStyle = '#1c1838'; ctx.fillRect(x0, y0, x1 - x0, 42 - y0);
  ctx.fillStyle = '#221d44';
  for (let x = Math.floor(x0 / 16) * 16; x < x1; x += 16) ctx.fillRect(x, y0, 6, 42 - y0);
  ctx.fillStyle = '#2b2552';
  for (let x = Math.floor(x0 / 16) * 16 + 10; x < x1; x += 32) for (let y = Math.floor(y0 / 24) * 24; y < 30; y += 24) { ctx.fillRect(x, y, 2, 2); }
  // janela com lua
  ctx.fillStyle = '#120d24'; ctx.fillRect(-150, -92, 78, 66);
  ctx.fillStyle = '#16204a'; ctx.fillRect(-146, -88, 70, 58);
  ctx.fillStyle = '#1e2c62'; ctx.fillRect(-146, -88, 70, 20);
  ctx.fillStyle = '#fff4c8'; ctx.fillRect(-100, -80, 12, 12); ctx.fillRect(-102, -78, 16, 8);
  ctx.fillStyle = '#16204a'; ctx.fillRect(-96, -82, 10, 10);
  for (let i = 0; i < 7; i++) { const tw = Math.sin(t * 2 + i * 1.7) > 0.3; ctx.fillStyle = tw ? '#ffffff' : '#7f8fd0'; ctx.fillRect(-142 + ((i * 23) % 62), -84 + ((i * 17) % 50), 1, 1); }
  ctx.fillStyle = '#3a2a5a'; ctx.fillRect(-112, -88, 2, 58); ctx.fillRect(-146, -60, 70, 2);
  // cortinas
  ctx.fillStyle = '#5a2a5a'; ctx.fillRect(-158, -96, 12, 74); ctx.fillRect(-76, -96, 12, 74);
  ctx.fillStyle = '#7a3a72'; ctx.fillRect(-156, -96, 3, 74); ctx.fillRect(-74, -96, 3, 74);
  // luz da lua no chão
  ctx.fillStyle = '#ffffff0c'; ctx.beginPath(); ctx.moveTo(-146, -30); ctx.lineTo(-76, -30); ctx.lineTo(-20, 42); ctx.lineTo(-120, 42); ctx.fill();
  // rodapé e assoalho
  ctx.fillStyle = '#3a2440'; ctx.fillRect(x0, 36, x1 - x0, 6);
  ctx.fillStyle = '#4a2e3a'; ctx.fillRect(x0, 42, x1 - x0, y1 - 42);
  ctx.fillStyle = '#3a2230';
  for (let y = 48; y < y1; y += 8) ctx.fillRect(x0, y, x1 - x0, 1);
  for (let y = 42, k = 0; y < y1; y += 8, k++) for (let x = Math.floor(x0 / 40) * 40 + (k % 2) * 20; x < x1; x += 40) ctx.fillRect(x, y, 1, 8);
  // cama com colcha de retalhos
  ctx.fillStyle = '#2a1830'; ctx.fillRect(40, -6, 8, 48); ctx.fillRect(160, 8, 6, 34);
  ctx.fillStyle = '#e8dcc8'; ctx.fillRect(48, 2, 30, 12);
  const cols = ['#c8506a', '#4a7fe0', '#ffd23f', '#6fbf6f'];
  for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(48 + i * 19, 12, 19, 18); }
  ctx.fillStyle = '#ffffff55'; for (let x = 50; x < 162; x += 4) ctx.fillRect(x, 13, 2, 1);
  ctx.fillStyle = '#1b1030'; ctx.fillRect(48, 30, 116, 2);
  // abajur
  const fl = 0.85 + Math.sin(t * 7) * 0.05;
  ctx.fillStyle = `rgba(255,210,120,${0.08 * fl})`; ctx.beginPath(); ctx.arc(-30, 0, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2a2a'; ctx.fillRect(-44, 24, 28, 18);
  ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-42, 26, 24, 2);
  ctx.fillStyle = '#c8a070'; ctx.fillRect(-31, 6, 2, 18);
  ctx.fillStyle = '#ffcf7a'; ctx.fillRect(-40, -6, 20, 12);
  ctx.fillStyle = '#ffe9b0'; ctx.fillRect(-38, -6, 6, 12);
});

registerCutscene('demo_cutscene', {
  stage: 'quarto_noite',
  run: function* (cs) {
    cs.cam.y = -10;
    yield* cs.fadeIn(0.01);
    const tico = cs.actor({ sprite: 'tico', anim: 'sleep', x: 100, y: 15, z: 5 });
    yield* cs.title('O Quarto da Lia', 'Demonstração de cutscene', 2.4);
    yield* cs.caption('Era uma vez um quarto, uma lua... e um dinossauro de pelúcia.', 2.6);
    yield* cs.zoom(1.5, 0.8);
    yield* cs.panTo(tico, 0.8);
    cs.anim(tico, 'wake');
    cs.particles('sparkle', tico.x, tico.y - 14, 10);
    cs.sfx('magic_hum');
    yield* cs.wait(1);
    yield* cs.say([
      { who: 'tico', expr: 'surprised', text: 'Eu... estou me {#ffd23f}mexendo{/}?', at: tico },
      { who: 'narrador', text: 'Naquela noite, algo antigo despertou nas costuras do Tico.' },
    ]);
    yield* cs.zoom(1, 0.6);
    yield* cs.pan(0, -10, 0.6);
    cs.anim(tico, 'idle');
    yield* cs.walk(tico, -10, 50);
    cs.face(tico, 'right');
    const r = yield* cs.choice({ who: 'tico', expr: 'confused', text: 'O que eu faço agora?' }, ['Explorar o quarto', 'Voltar a dormir']);
    if (r === 0) {
      yield* cs.say({ who: 'tico', expr: 'determined', text: 'Aventura! Mas... só até o tapete.', shake: false });
    } else {
      cs.anim(tico, 'sleep');
      yield* cs.say({ who: 'tico', expr: 'sleepy', text: 'Zzz... amanhã eu salvo o mundo.' });
    }
    cs.shake(0.6);
    cs.sfx('thunder');
    cs.flash('#c8b4ff', 0.4);
    yield* cs.say({ who: 'placa', text: 'CUIDADO: o Avesso fica logo ali.', wait: 1.5 });
    yield* cs.parallel(cs.fade(tico, 0, 0.8), cs.move(tico, tico.x, tico.y - 20, 0.8, 'outQuad'), cs.fadeOut(1));
  },
});

// demo dentro da fase (level=test): `__SW.level.cutscene('demo_level')`
registerCutscene('demo_level', {
  run: function* (cs) {
    const p = cs.player;
    yield* cs.panTo(p, 0.5);
    yield* cs.zoom(1.4, 0.5);
    cs.anim(p, 'look_up');
    yield* cs.say([
      { who: 'botao', expr: 'neutral', text: 'Ei, pequeno! Aqui embaixo... não, AQUI.', at: p },
      { who: 'tico', expr: 'happy', text: 'Sr. Botão! O senhor parece... mais baixinho hoje.' },
      { who: 'botao', text: 'Hmpf. Atravesse a ponte. E não toque no fio roxo.', shake: true },
    ]);
    cs.anim(p, null);
    yield* cs.walk(p, p.x + 48, 70);
    yield* cs.zoom(1, 0.4);
    cs.setFlag('demo_level_seen');
  },
});
