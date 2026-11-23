// =============================================================================
// ui/touch.js — Controles de toque multitoque (overlay do jogo).
//   Esquerda: ANALÓGICO flutuante (surge onde o polegar encosta nos 40% da esquerda).
//   Direita: PULAR, ATACAR, DASH, HABILIDADE (ícone + recarga), CORRER (toque = trava,
//   segurar = enquanto segura), TROCAR habilidade, INTERAGIR (contextual) e PAUSA.
// Aparece só em aparelho de toque com input.lastDevice === 'touch' e só na LevelScene
// (fora de diálogo/cutscene). Debug: ?touch=1 força a exibição.
// Toques capturados aqui NÃO chegam a input.pointer (menus).
// =============================================================================
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { getImage } from '../../engine/sprites.js';
import { PixelCanvas } from '../../engine/pixel.js';
import font from '../../engine/font.js';
import { R } from '../registry.js';
import { drawDisc, INK } from '../art/ui_kit.js';

const ACTS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'ability', 'cycle', 'interact', 'run', 'pause'];
const SLIDE = new Set(['jump', 'attack', 'dash', 'ability']); // dá pra deslizar o dedo entre estes
const DEAD = 0.24, VERT = 0.62, RUN_AT = 0.85;

const hasWin = typeof window !== 'undefined';
const isTouchDevice = hasWin && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
const forced = () => game.params.get('touch') === '1';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

const fingers = new Map();   // pointerId -> { kind: 'stick'|'btn'|'none', btn, t0 }
const swallow = new Set();   // ids que começaram no overlay e devem continuar engolidos
let stick = null;            // { id, ox, oy, x, y }
let runLock = false;
const vstate = {};
let layout = null;
let visibleNow = false;
let attached = false;
const restKnob = { x: 0, y: 0 };

/** true se o overlay de toque está visível neste quadro (a HUD usa para abrir espaço). */
export function touchControlsVisible() { return visibleNow; }

function activeLevel() {
  const L = hasWin ? window.__SW?.level : null;
  if (!L || game.scenes.top !== L || !L.player) return null;
  if (L.dialogue?.active || L.inputLocked || L.state === 'complete') return null;
  return L;
}
function shouldShow() {
  const L = activeLevel();
  if (!L) return null;
  if (forced()) return L;
  return isTouchDevice && input.lastDevice === 'touch' ? L : null;
}

// ------------------------------------------------------------------ layout
function computeLayout(L) {
  const W = game.view.w, H = game.view.h;
  const s = clamp(+save.settings.touchScale || 1, 0.6, 1.6) * clamp(H / 224, 0.85, 1.15);
  const S = (v) => Math.max(6, Math.round(v * s));
  const p = L.player;
  const B = [];
  const m = S(7);
  const rj = S(20), ra = S(16), rd = S(15), rb = S(15), rr = S(14), rc = S(11), rp = S(11), ri = S(14);
  const jx = W - m - rj, jy = H - m - rj - 2;
  B.push({ id: 'jump', action: 'jump', x: jx, y: jy, r: rj, color: '#3fc7c0', glyph: 'ctl_jump' });
  const ax = jx - rj - ra - S(6), ay = jy + S(5);
  B.push({ id: 'attack', action: 'attack', x: ax, y: ay, r: ra, color: '#ff6b8a', glyph: 'ctl_attack' });
  const dx = jx + S(3), dy = jy - rj - rd - S(7);
  B.push({ id: 'dash', action: 'dash', x: dx, y: dy, r: rd, color: '#7fd6ff', glyph: 'ctl_dash' });
  const rx = ax - ra - rr - S(9), ry = jy + S(9);
  B.push({ id: 'run', action: 'run', x: rx, y: ry, r: rr, color: '#9ad860', glyph: 'ctl_run', halo: runLock });
  const unlocked = Object.keys(save.data.abilities || {}).filter((k) => save.data.abilities[k] && R.abilities.has(k));
  const def = save.data.abilities?.[p.equipped] ? R.abilities.get(p.equipped) : null;
  const bx = ax - S(5), by = ay - ra - rb - S(9);
  if (def) {
    const cost = def.cost || 0;
    B.push({ id: 'ability', action: 'ability', x: bx, y: by, r: rb, color: def.color || '#ffd23f', glyph: 'ctl_ability', def, cost,
      enough: p.energy >= cost, cd: def.cooldown ? clamp(p.cooldownOf(p.equipped) / def.cooldown, 0, 1) : 0 });
  }
  if (unlocked.length >= 2) B.push({ id: 'cycle', action: 'cycle', x: bx - rb - rc - S(4), y: by - S(9), r: rc, color: '#b48cff', glyph: 'ctl_cycle' });
  if (p.interactTarget) {
    B.push({ id: 'interact', action: 'interact', x: Math.round((bx + dx) / 2) + S(2), y: Math.min(by, dy) - rb - ri - S(6), r: ri, color: '#fff4dc', glyph: 'ctl_interact' });
  }
  B.push({ id: 'pause', action: 'pause', x: W - S(5) - rp, y: S(5) + rp, r: rp, color: '#3b2d63', glyph: 'ctl_pause' });
  const stickR = S(27);
  restKnob.x = stickR + S(14); restKnob.y = H - stickR - S(12);
  return { B, s, W, H, stickR, knobR: S(12), zoneW: Math.round(W * 0.4), slack: S(7) };
}

function hit(x, y, onlySlide = false) {
  if (!layout) return null;
  let best = null, bd = Infinity;
  for (const b of layout.B) {
    if (onlySlide && !SLIDE.has(b.id)) continue;
    const d = Math.hypot(x - b.x, y - b.y) - b.r;
    if (d < layout.slack && d < bd) { bd = d; best = b; }
  }
  return best;
}

// -------------------------------------------------------------- estado virtual
function stickVec() {
  if (!stick || !layout) return null;
  const R0 = layout.stickR;
  const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
  const len = Math.hypot(dx, dy);
  const m = Math.min(1, len / R0);
  const nx = len > 0 ? (dx / len) * m : 0, ny = len > 0 ? (dy / len) * m : 0;
  return { nx, ny, m };
}
function sync() {
  const want = {};
  for (const f of fingers.values()) {
    if (f.kind === 'btn' && f.btn) want[f.btn] = true;
  }
  const v = stickVec();
  if (v && v.m > DEAD) {
    if (v.nx < -DEAD) want.left = true;
    if (v.nx > DEAD) want.right = true;
    if (v.ny < -VERT) want.up = true;
    if (v.ny > VERT) want.down = true;
    if (v.m > RUN_AT && Math.abs(v.nx) > 0.45) want.run = true;
  }
  if (runLock) want.run = true;
  for (const a of ACTS) {
    const w = !!want[a];
    if (w !== !!vstate[a]) { vstate[a] = w; input.setVirtual(a, w); }
  }
}
function releaseAll() {
  const ld = input.lastDevice;
  for (const id of fingers.keys()) swallow.add(id);
  fingers.clear();
  stick = null;
  for (const a of ACTS) if (vstate[a]) { vstate[a] = false; input.setVirtual(a, false); }
  input.lastDevice = ld;
}

// ----------------------------------------------------------------- eventos
function claimable(e) { return e.pointerType === 'touch' || e.pointerType === 'pen' || forced(); }
function onDown(e) {
  if (!claimable(e)) return;
  if (e.pointerType === 'touch') input.lastDevice = 'touch';
  const L = shouldShow();
  if (!L) return;
  layout = computeLayout(L);
  const p = input.toView(e.clientX, e.clientY);
  const b = hit(p.x, p.y);
  if (b) {
    fingers.set(e.pointerId, { kind: 'btn', btn: b.id, t0: now() });
    if (b.id !== 'pause') game.vibrate(8);
  } else if (p.x < layout.zoneW && !stick) {
    const R0 = layout.stickR;
    const ox = clamp(p.x, R0 + 3, layout.zoneW), oy = clamp(p.y, R0 + 3, layout.H - R0 - 3);
    stick = { id: e.pointerId, ox, oy, x: p.x, y: p.y };
    fingers.set(e.pointerId, { kind: 'stick' });
  } else fingers.set(e.pointerId, { kind: 'none' });
  e.stopPropagation();
  if (e.cancelable) e.preventDefault();
  sync();
}
function onMove(e) {
  if (swallow.has(e.pointerId)) { e.stopPropagation(); return; }
  const f = fingers.get(e.pointerId);
  if (!f) return;
  e.stopPropagation();
  const p = input.toView(e.clientX, e.clientY);
  if (f.kind === 'stick' && stick && stick.id === e.pointerId) {
    stick.x = p.x; stick.y = p.y;
    // base segue o polegar se ele for longe demais (analógico "arrastável")
    const R0 = layout ? layout.stickR : 27;
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    if (d > R0 * 1.6) { const k = (d - R0 * 1.6) / d; stick.ox += dx * k; stick.oy += dy * k; }
  } else if (f.kind === 'btn' && SLIDE.has(f.btn) || (f.kind === 'btn' && !f.btn)) {
    const cur = layout?.B.find((b) => b.id === f.btn);
    const stillOn = cur && Math.hypot(p.x - cur.x, p.y - cur.y) < cur.r + layout.slack * 1.5;
    if (!stillOn) { const nb = hit(p.x, p.y, true); f.btn = nb ? nb.id : null; }
  }
  sync();
}
function onUp(e) {
  if (swallow.delete(e.pointerId)) { e.stopPropagation(); return; }
  const f = fingers.get(e.pointerId);
  if (!f) return;
  e.stopPropagation();
  if (f.kind === 'btn' && f.btn === 'run') { if (now() - f.t0 < 0.3) runLock = !runLock; else runLock = false; }
  if (f.kind === 'stick') stick = null;
  fingers.delete(e.pointerId);
  sync();
}

if (hasWin) {
  window.addEventListener('pointerdown', onDown, { capture: true, passive: false });
  window.addEventListener('pointermove', onMove, { capture: true });
  window.addEventListener('pointerup', onUp, { capture: true });
  window.addEventListener('pointercancel', onUp, { capture: true });
  window.addEventListener('blur', () => { releaseAll(); swallow.clear(); });
}
function attach() {
  if (attached || !game.canvas) return;
  attached = true;
  const c = game.canvas;
  c.style.touchAction = 'none';
  const prevent = (e) => { if (e.cancelable) e.preventDefault(); };
  c.addEventListener('touchstart', prevent, { passive: false });
  c.addEventListener('touchmove', prevent, { passive: false });
}

// ------------------------------------------------------------------ desenho
const ringCache = new Map();
function ringImg(r) {
  let im = ringCache.get(r);
  if (im) return im;
  const size = r * 2 + 1, c = r + 0.5;
  const pc = new PixelCanvas(size, size);
  const step = Math.PI * 2 / 28;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    if (d > r) continue;
    let k;
    if (d > r - 1 || (d > r - 6 && d <= r - 5)) k = INK;
    else if (d > r - 5) {
      const a = Math.atan2(dy, dx) + Math.PI;
      k = d > r - 3.6 && d <= r - 2.6 && Math.floor(a / step) % 2 === 0 ? '#b8a8e8' : (dx + dy < 0 ? '#4a3a7a' : '#2e2252');
    } else k = '#1b103055';
    pc.px(x, y, k);
  }
  // setinhas nas 4 direções
  const arrow = (ax, ay, dx, dy) => {
    for (let i = 0; i < 3; i++) for (let j = -i; j <= i; j++) pc.px(ax + dx * (2 - i) + (dy ? j : 0), ay + dy * (2 - i) + (dx ? j : 0), '#fff4dcb0');
  };
  const ir = r - 9;
  arrow(r, r - ir, 0, -1); arrow(r, r + ir, 0, 1); arrow(r - ir, r, -1, 0); arrow(r + ir, r, 1, 0);
  pc.flush();
  im = pc.canvas;
  ringCache.set(r, im);
  return im;
}

function drawStick(ctx, op) {
  const R0 = layout.stickR, kr = layout.knobR;
  const active = !!stick;
  const ox = active ? stick.ox : restKnob.x, oy = active ? stick.oy : restKnob.y;
  ctx.globalAlpha = active ? Math.min(1, op + 0.15) : op * 0.55;
  const ring = ringImg(R0);
  ctx.drawImage(ring, Math.round(ox) - R0, Math.round(oy) - R0);
  let kx = ox, ky = oy, running = false;
  if (active) {
    const v = stickVec();
    kx = ox + v.nx * R0 * 0.82; ky = oy + v.ny * R0 * 0.82;
    running = v.m > RUN_AT && Math.abs(v.nx) > 0.45;
  }
  if (running || runLock) { // linhas de velocidade atrás do botão
    ctx.fillStyle = '#fff4dc';
    const dir = active && stick.x < stick.ox ? 1 : -1;
    for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(kx + dir * (kr + 2)), Math.round(ky - 5 + i * 5), dir * (5 + (i % 2) * 3), 1);
  }
  drawDisc(ctx, kx, ky, kr, running ? '#9ad860' : '#fff4dc', false);
  // furinhos de botão de costura
  ctx.fillStyle = '#7a6040';
  const h = Math.max(2, Math.round(kr / 4));
  for (const [hx, hy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(Math.round(kx + hx * h - (hx < 0 ? 2 : 0)), Math.round(ky + hy * h - (hy < 0 ? 2 : 0)), 2, 2);
}

function drawSweep(ctx, cx, cy, r, f) {
  if (f <= 0) return;
  ctx.fillStyle = '#0b0716b8';
  const T = Math.PI * 2;
  for (let y = -r; y < r; y++) for (let x = -r; x < r; x++) {
    const dx = x + 0.5, dy = y + 0.5;
    if (dx * dx + dy * dy > r * r) continue;
    if (((Math.atan2(dx, -dy) + T) % T) / T < f) ctx.fillRect(cx + x, cy + y, 1, 1);
  }
}

function drawButtonTouch(ctx, b, pressed, op) {
  const base = b.id === 'ability' && !b.enough ? op * 0.6 : op;
  ctx.globalAlpha = pressed ? Math.min(1, base + 0.35) : base;
  if (b.halo) drawDisc(ctx, b.x, b.y, b.r + 2, '#ffd23f', false);
  drawDisc(ctx, b.x, b.y, b.r, b.id === 'ability' && !b.enough ? '#6a5e8a' : b.color, pressed);
  const oy = pressed ? 1 : 0;
  if (b.id === 'ability') {
    const im = getImage(b.def.icon || 'icon_ab_' + b.def.id);
    if (im) {
      const k = im.width * 2 <= b.r * 2 - 4 ? 2 : 1;
      ctx.drawImage(im, Math.round(b.x - im.width * k / 2), Math.round(b.y - im.height * k / 2) + oy, im.width * k, im.height * k);
    }
    drawSweep(ctx, Math.round(b.x), Math.round(b.y) + oy, b.r - 1, b.cd);
    if (b.cost) font.draw(ctx, String(b.cost), Math.round(b.x), Math.round(b.y + b.r - 3) + oy, { align: 'center', color: b.enough ? '#d8f8ff' : '#ff9ab4', outline: INK });
  } else {
    const im = getImage(b.glyph);
    if (im) ctx.drawImage(im, Math.round(b.x - im.width / 2), Math.round(b.y - im.height / 2) + oy);
  }
  if (b.label) {
    const w = font.measure(b.label);
    const lx = Math.round(b.x - w / 2), ly = Math.round(b.y - b.r - 11);
    ctx.globalAlpha = Math.min(1, op + 0.3);
    ctx.fillStyle = INK; ctx.fillRect(lx - 3, ly - 2, w + 6, 11);
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(lx - 2, ly - 1, w + 4, 9);
    font.draw(ctx, b.label, lx, ly, { color: INK });
  }
}

function draw(ctx) {
  attach();
  const L = shouldShow();
  if (!L) {
    if (visibleNow || fingers.size || stick) releaseAll();
    visibleNow = false;
    return;
  }
  visibleNow = true;
  layout = computeLayout(L);
  sync(); // runLock/estado após mudanças de layout
  const op = clamp(save.settings.touchOpacity ?? 0.55, 0.15, 1);
  const a0 = ctx.globalAlpha;
  const held = new Set();
  for (const f of fingers.values()) if (f.kind === 'btn' && f.btn) held.add(f.btn);
  drawStick(ctx, op);
  for (const b of layout.B) drawButtonTouch(ctx, b, held.has(b.id), op);
  ctx.globalAlpha = a0;
}

game.addOverlay(draw);
