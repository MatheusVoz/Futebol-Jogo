// =============================================================================
// ui/dialogue.js — Balão de fala em pixel art (estilo tecido costurado).
//
// Interface:
//   const dlg = new DialogueBox(scene)
//   dlg.start(lines, opts) -> Promise<índice da última escolha | undefined>
//   dlg.update(dt)   dlg.draw(ctx)   dlg.active
//   dlg.skip()        encerra já (escolhas usam line.default ?? 0) — usado ao pular cutscenes
//   dlg.underlay      fn(ctx) opcional desenhada ANTES do balão (o diretor de cutscenes usa
//                     para tarjas/legendas/fades ficarem atrás do texto)
//   dlg.suppressTap   true = ignora o toque deste quadro (botão "Pular" já usou o toque)
//
// Falas (string ou objeto): { who, expr, text, side:'left'|'right', speed, shake, wait,
//   at: entidade|ator (balão com rabicho apontando para ela no mundo), choices:[...], default }
// Especiais: who 'narrador' = faixa de livro de histórias (sem retrato, centralizada);
//            who 'placa'    = placa de madeira.
// Controles: apertar completa a fala; apertar de novo avança; segurar pulo/confirmar acelera.
// Escolhas: ↑/↓ + confirmar, ou toque direto na opção.
// =============================================================================
import font from '../../engine/font.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { paint } from '../../engine/pixel.js';
import { clamp, Ease, mixColor, hashString, parseColor } from '../../engine/util.js';
import { drawPortrait, portraitInfo, PORTRAIT_SIZE } from '../art/portraits.js';
import { R } from '../registry.js';

const PS = PORTRAIT_SIZE;          // 48
const LH = 10;                     // altura da linha de texto
const BASE_CPS = 42;               // letras por segundo (x textSpeed x line.speed)
const OUTLINE = '#1b1030';
const CREAM = '#fff8e8';
const LOW_VOICES = new Set(['coelho', 'rei', 'baleia', 'mae_sombras', 'costureiro']);
const ADVANCE = ['jump', 'confirm', 'attack'];

// ----------------------------------------------------------------- helpers
const lum = (c) => { const [r, g, b] = parseColor(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/** Quebra o texto (com marcação) em glifos posicionados. */
function layoutText(text, maxW, align) {
  const lines = font.wrap(text, maxW);
  const glyphs = [];
  let width = 0;
  const widths = lines.map((l) => font.measure(l));
  for (const w of widths) width = Math.max(width, w);
  lines.forEach((line, li) => {
    let x = align === 'center' ? Math.floor((width - widths[li]) / 2) : 0;
    let color = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '{') {
        const end = line.indexOf('}', i);
        if (end > i) {
          const tag = line.slice(i + 1, end);
          if (tag[0] === '#') { color = tag; i = end; continue; }
          if (tag === '/') { color = null; i = end; continue; }
          if (tag.startsWith('i:')) {
            const s = '{' + tag + '}';
            glyphs.push({ s, x, y: li * LH, color, ch: '■' });
            x += font.measure(s) + 1; i = end; continue;
          }
        }
      }
      glyphs.push({ s: ch, x, y: li * LH, color, ch });
      x += font.measure(ch) + 1;
    }
  });
  return { lines, glyphs, width, height: lines.length * LH };
}

/** Retângulo arredondado "pixelado" (cantos de raio ~3). */
function pcRound(pc, x, y, w, h, c) {
  const ins = [3, 1, 1];
  for (let i = 0; i < 3; i++) {
    pc.rect(x + ins[i], y + i, w - ins[i] * 2, 1, c);
    pc.rect(x + ins[i], y + h - 1 - i, w - ins[i] * 2, 1, c);
  }
  pc.rect(x, y + 3, w, h - 6, c);
}

const cache = new Map();
function cached(key, w, h, fn) {
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    c = paint(w, h, fn);
    cache.set(key, c);
  }
  return c;
}

/** Corpo do balão de tecido (cacheado por tamanho/cor). */
function balloonImage(w, h, accent) {
  return cached(`b${w}x${h}${accent}`, w + 1, h + 2, (pc) => {
    pcRound(pc, 1, 2, w, h, '#0b071666');             // sombra
    pcRound(pc, 0, 0, w, h, OUTLINE);
    pcRound(pc, 1, 1, w - 2, h - 2, CREAM);
    pc.rect(4, 1, w - 8, 1, '#ffffff');               // brilho no topo
    pc.rect(3, h - 4, w - 6, 2, '#f1e0c4');            // sombra de pano embaixo
    pc.rect(2, h - 5, 1, 2, '#f1e0c4'); pc.rect(w - 3, h - 5, 1, 2, '#f1e0c4');
    // trama leve do tecido
    for (let yy = 5; yy < h - 5; yy += 4) for (let xx = 6 + ((yy >> 2) & 1) * 2; xx < w - 5; xx += 4) pc.px(xx, yy, '#f7ecd8');
    // pesponto (costura tracejada) na cor do personagem
    const st = mixColor(accent, CREAM, 0.35);
    for (let xx = 5; xx < w - 5; xx += 4) { pc.rect(xx, 2, 2, 1, st); pc.rect(xx, h - 3, 2, 1, st); }
    for (let yy = 5; yy < h - 5; yy += 4) { pc.rect(2, yy, 1, 2, st); pc.rect(w - 3, yy, 1, 2, st); }
  });
}

/** Placa de madeira. */
function plaqueImage(w, h) {
  return cached(`p${w}x${h}`, w, h + 8, (pc) => {
    // cordinhas
    pc.rect(6, 0, 1, 8, '#6a4a2a'); pc.rect(w - 7, 0, 1, 8, '#6a4a2a');
    pc.rect(5, 0, 3, 1, '#3a2010'); pc.rect(w - 8, 0, 3, 1, '#3a2010');
    const y0 = 7;
    pcRound(pc, 0, y0, w, h, '#2a160a');
    pcRound(pc, 1, y0 + 1, w - 2, h - 2, '#a0703a');
    for (let yy = y0 + 6; yy < y0 + h - 3; yy += 7) pc.rect(2, yy, w - 4, 1, '#7a4f24');
    for (let i = 0; i < Math.floor(w * h / 90); i++) {
      const gx = 4 + ((i * 37) % (w - 12)), gy = y0 + 3 + ((i * 53) % (h - 6));
      pc.rect(gx, gy, 3 + (i % 3), 1, '#8c6030');
    }
    pc.rect(3, y0 + 1, w - 6, 1, '#c8935a');
    pc.rect(2, y0 + h - 3, w - 4, 1, '#7a4f24');
    for (const [nx, ny] of [[3, y0 + 3], [w - 5, y0 + 3], [3, y0 + h - 5], [w - 5, y0 + h - 5]]) {
      pc.rect(nx, ny, 2, 2, '#5a4a40'); pc.px(nx, ny, '#e8e0d0');
    }
  });
}

/** Etiqueta com o nome (retalho colorido). */
function tagImage(name, color) {
  const tw = font.measure(name) + 10;
  return cached(`t${name}${color}`, tw, 12, (pc) => {
    pcRound(pc, 0, 0, tw, 11, OUTLINE);
    pcRound(pc, 1, 1, tw - 2, 9, color);
    pc.rect(2, 1, tw - 4, 1, mixColor(color, '#ffffff', 0.35));
    pc.rect(2, 9, tw - 4, 1, mixColor(color, '#000000', 0.25));
    pc.px(2, 5, mixColor(color, '#ffffff', 0.6)); pc.px(tw - 3, 5, mixColor(color, '#ffffff', 0.6));
  });
}

function drawNeedle(ctx, x, y) {
  // agulha de costura apontando para baixo + linha
  ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1, y - 7, 3, 9);
  ctx.fillStyle = '#d8e0ea'; ctx.fillRect(x, y - 6, 1, 7);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 6, 1, 2);
  ctx.fillStyle = OUTLINE; ctx.fillRect(x, y - 5, 1, 1);   // olho
  ctx.fillStyle = '#ff6a8a'; ctx.fillRect(x + 1, y - 7, 2, 1); ctx.fillRect(x + 3, y - 6, 1, 2);
}

// =============================================================================
export class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.lines = null;
    this.i = 0;
    this.chars = 0;
    this.resolve = null;
    this.t = 0;
    this.underlay = null;
    this.suppressTap = false;
    this.closing = null;
    this.result = undefined;
  }
  get active() { return !!this.lines; }

  start(lines, opts = {}) {
    if (!Array.isArray(lines)) lines = [lines];
    this.lines = lines.filter((l) => l != null).map((l) => (typeof l === 'string' ? { text: l } : { ...l }));
    if (!this.lines.length) { this.lines = null; return Promise.resolve(undefined); }
    if (this.resolve) { const r = this.resolve; this.resolve = null; r(this.result); }
    this.opts = opts;
    this.result = undefined;
    this.sides = new Map();
    this.closing = null;
    this.prevKey = null;
    this.i = 0;
    this._begin();
    return new Promise((res) => { this.resolve = res; });
  }

  /** Termina imediatamente (pular cutscene). */
  skip() {
    if (!this.lines) return;
    for (let k = this.i; k < this.lines.length; k++) if (this.lines[k].choices) this.result = this.lines[k].default ?? 0;
    this._finish(false);
  }

  _finish(anim = true) {
    const r = this.resolve;
    if (anim && this.L) this.closing = { t: 0, L: this.L, line: this.line };
    this.lines = null; this.resolve = null;
    r && r(this.result);
  }

  get line() { return this.lines && this.lines[this.i]; }

  _begin() {
    const line = this.line;
    const who = line.who || '';
    line.kind = who === 'narrador' ? 'narrator' : who === 'placa' ? 'plaque' : 'balloon';
    if (line.kind === 'balloon' && !line.side) {
      if (!this.sides.has(who)) {
        // Tico fica à esquerda; quem conversa com ele, à direita; demais alternam
        const withTico = this.lines.some((l) => l.who === 'tico');
        let side = this.sides.size % 2 === 0 ? 'left' : 'right';
        if (withTico) side = who === 'tico' ? 'left' : 'right';
        this.sides.set(who, side);
      }
      line.side = this.sides.get(who);
    }
    this.chars = 0;
    this.pauseT = 0;
    this.doneT = 0;
    this.holdT = this.holdT || 0;
    this.sel = 0;
    this.lastGlyph = 0;
    this.guard = 1;
    const key = `${line.kind}|${who}|${line.side}|${!!line.at}`;
    this.popT = key === this.prevKey ? 0.12 : 0;     // novo falante: estoura; mesmo: só um pulinho
    this.bump = key === this.prevKey ? 0 : 1;
    this.prevKey = key;
    this.L = this._layout(line);
  }

  // ---------------------------------------------------------------- layout
  _layout(line) {
    const W = game.view.w, H = game.view.h;
    const touch = input.lastDevice === 'touch';
    // largura máx. do conjunto: deixa os cantos de baixo livres para os botões de toque
    const maxTotal = Math.min(420, W - 16, touch ? Math.max(W - 128, 300) : 999);
    const text = String(line.text ?? '');
    const info = portraitInfo(line.who);
    const accent = info.color || '#c86aff';
    const L = { kind: line.kind, side: line.side, accent, name: line.kind === 'balloon' ? info.name : '', vw: W, vh: H, touch };
    if (line.kind === 'narrator') {
      const tw = Math.min(400, maxTotal) - 24;
      L.text = layoutText(text, tw, 'center');
      L.bw = W; L.bh = Math.max(2, L.text.lines.length) * LH + 14;
      L.bx = 0; L.by = H - L.bh - 8;
      L.tx = Math.round((W - L.text.width) / 2); L.ty = L.by + 8 + (L.text.lines.length === 1 ? 5 : 0);
      L.color = '#f6e7c8'; L.shadow = '#0b0716';
    } else if (line.kind === 'plaque') {
      L.text = layoutText(text, maxTotal - 32, 'center');
      L.bw = Math.max(96, L.text.width + 32); L.bh = L.text.lines.length * LH + 14;
      L.bx = Math.round((W - L.bw) / 2); L.by = H - L.bh - 8;
      L.tx = Math.round((W - L.text.width) / 2); L.ty = L.by + 8;
      L.color = '#3a1e0c'; L.shadow = '#c08a4a';
    } else {
      const hasPortrait = !!(line.who && R_hasPortrait(line.who));
      L.portrait = hasPortrait;
      const avail = hasPortrait ? maxTotal - PS - 6 : maxTotal;
      const firstW = font.measure(font.plain(text));
      const tw0 = Math.min(avail - 18, Math.max(110, firstW));
      L.text = layoutText(text, tw0, 'left');
      L.bw = Math.max(L.name ? font.measure(L.name) + 30 : 0, Math.max(128, L.text.width + 18));
      L.bh = Math.max(2, L.text.lines.length) * LH + 13;
      L.color = '#2a1840'; L.shadow = null;
      const G = (hasPortrait ? PS + 6 : 0) + L.bw;
      const gx = Math.round((W - G) / 2);
      if (!hasPortrait) { L.bx = gx; }
      else if (line.side === 'right') { L.bx = gx; L.px = gx + L.bw + 6; }
      else { L.px = gx; L.bx = gx + PS + 6; }
      L.by = H - 6 - L.bh;
      if (hasPortrait) L.py = H - 6 - PS;
      L.tail = hasPortrait ? { dir: line.side === 'right' ? 'right' : 'left' } : null;
    }
    // escolhas
    if (line.choices?.length) {
      const ow = Math.max(...line.choices.map((c) => font.measure(String(c))));
      L.cw = ow + 26; L.ch = line.choices.length * 12 + 6;
    }
    return L;
  }

  /** Posição na tela de quem fala (line.at), ou null. */
  _anchor(ent) {
    if (!ent) return null;
    const s = this.scene;
    const ax = typeof ent.headX === 'number' ? ent.headX : ent.x + (ent.w || 0) / 2;
    const ay = typeof ent.headY === 'number' ? ent.headY : ent.y;
    let p = null;
    if (s?.worldToScreen) p = s.worldToScreen(ax, ay);
    else if (s?.camera) { const c = s.camera, z = c.zoom || 1; p = { x: (ax - c.rx) * z, y: (ay - c.ry) * z }; }
    if (!p) return null;
    const W = game.view.w, H = game.view.h;
    if (p.x < 4 || p.x > W - 4 || p.y < 20 || p.y > H) return null;
    return p;
  }

  /** Recalcula posições que dependem do quadro (âncora no mundo / escolhas). */
  _place(L, line) {
    const W = game.view.w, H = game.view.h;
    if (L.vw !== W || L.vh !== H || L.touch !== (input.lastDevice === 'touch')) { Object.assign(L, this._layout(line)); }
    L.at = null;
    if (L.kind === 'balloon' && line.at) {
      const a = this._anchor(line.at);
      if (a) {
        const bw = Math.min(L.text.width + 18 < 128 ? 128 : L.text.width + 18, W - 12);
        let bx = Math.round(clamp(a.x - bw / 2, 6, W - 6 - bw));
        let by = Math.round(a.y - 10 - L.bh), up = false;
        if (by < 14) { by = Math.round(a.y + 26); up = true; }
        L.at = { bx, by, bw, tipX: Math.round(a.x), tipY: Math.round(up ? a.y + 18 : a.y - 3), up };
      }
    }
    const bx = L.at ? L.at.bx : L.bx, by = L.at ? L.at.by : L.by, bw = L.at ? L.at.bw : L.bw;
    L.cbx = bx; L.cby = by; L.cbw = bw;
    if (L.kind !== 'narrator') L.tx = L.kind === 'plaque' ? L.tx : bx + 9;
    if (L.kind === 'balloon') L.ty = by + 7;
    if (L.cw) {
      const right = L.kind === 'balloon' && L.side !== 'right';
      L.cx = clamp(right ? bx + bw - L.cw - 4 : bx + 4, 4, W - L.cw - 4);
      if (L.kind === 'narrator') L.cx = Math.round((W - L.cw) / 2);
      L.cy = by - L.ch - (L.name && !right ? 10 : 5);
      if (L.cy < 2) L.cy = by + L.bh + 6;
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.t += dt;
    if (this.closing) { this.closing.t += dt; if (this.closing.t > 0.14) this.closing = null; }
    const tapBlocked = this.suppressTap; this.suppressTap = false;
    if (!this.lines) return;
    const line = this.line, L = this.L;
    this.popT += dt;
    const total = L.text.glyphs.length;
    const tap = input.pointer.pressed && !tapBlocked;
    let pressed = false;
    if (this.guard > 0) this.guard--;
    else {
      for (const a of ADVANCE) if (input.pressed(a)) { pressed = true; input.consume(a); }
      if (tap && !L.cw) pressed = true;
    }
    const holding = ADVANCE.some((a) => input.down(a)) || (input.pointer.down && !L.cw);
    this.holdT = holding ? this.holdT + dt : 0;
    const ff = this.holdT > 0.35 && !line.choices;
    // ---- datilografia
    if (this.chars < total) {
      if (pressed) { this.chars = total; pressed = false; }
      else if (this.pauseT > 0) this.pauseT -= dt * (ff ? 4 : 1);
      else {
        const cps = BASE_CPS * (save.settings?.textSpeed ?? 1) * (line.speed ?? 1) * (ff ? 4 : 1);
        this.chars = Math.min(total, this.chars + cps * dt);
      }
      const n = Math.floor(this.chars);
      if (n > this.lastGlyph) {
        for (let k = this.lastGlyph; k < n; k++) {
          const g = L.text.glyphs[k];
          if (k === n - 1 && n < total) {
            if ('.!?…'.includes(g.ch) && L.text.glyphs[k + 1]?.ch !== g.ch) this.pauseT = 0.16;
            else if (g.ch === ',' || g.ch === ';' || g.ch === ':') this.pauseT = 0.07;
          }
        }
        const g = L.text.glyphs[n - 1];
        if (g && g.ch !== ' ' && line.kind !== 'plaque') this._blip(line, g.ch);
        this.lastGlyph = n;
      }
      return;
    }
    this.lastGlyph = total;
    this.doneT += dt;
    // ---- escolhas
    if (line.choices?.length) {
      const n = line.choices.length;
      if (input.pressed('up')) { this.sel = (this.sel + n - 1) % n; audio.sfx('ui_move', { vol: 0.6 }); input.consume('up'); }
      if (input.pressed('down')) { this.sel = (this.sel + 1) % n; audio.sfx('ui_move', { vol: 0.6 }); input.consume('down'); }
      this._place(L, line);
      const p = input.pointer;
      const hit = (p.x >= L.cx && p.x < L.cx + L.cw) ? Math.floor((p.y - L.cy - 3) / 12) : -1;
      if ((p.down || p.pressed) && hit >= 0 && hit < n) this.sel = hit;
      if (tap && this.guard <= 0 && hit >= 0 && hit < n) pressed = true;
      if (pressed && this.doneT > 0.12) {
        this.result = this.sel;
        audio.sfx('ui_select', { vol: 0.7 });
        this._next();
      }
      return;
    }
    // ---- avançar
    if (pressed || (ff && this.doneT > 0.15) || (line.wait != null && this.doneT >= line.wait)) this._next();
  }

  _next() {
    this.i++;
    if (this.i >= this.lines.length) this._finish(true);
    else this._begin();
  }

  _blip(line, ch) {
    const who = line.who || '';
    const base = 0.85 + (hashString(who || 'x') % 40) / 100;
    const code = ch.charCodeAt(0);
    const pitch = base * (1 + (((code * 7) % 7) - 3) * 0.035);
    audio.sfx(LOW_VOICES.has(who) ? 'text_blip_low' : 'text_blip', { pitch, cooldown: 0.03, vol: line.kind === 'narrator' ? 0.45 : 0.8 });
  }

  // ---------------------------------------------------------------- draw
  draw(ctx) {
    if (this.underlay) { try { this.underlay(ctx); } catch (e) { console.error(e); } }
    if (this.closing) {
      const k = this.closing.t / 0.14;
      this._drawLine(ctx, this.closing.line, this.closing.L, 1 - k * 0.6, 1 - k, true);
    }
    if (!this.lines) return;
    this._place(this.L, this.line);
    this._drawLine(ctx, this.line, this.L, 1, 1, false);
  }

  _drawLine(ctx, line, L, scaleMul, alpha, closing) {
    const t = this.t;
    const kind = L.kind;
    const bx = L.cbx, by = L.cby, bw = L.cbw, bh = L.bh;
    // animação de entrada (estouro com leve achatamento) ou pulinho entre falas
    let sx = 1, sy = 1;
    if (!closing) {
      if (this.bump) {
        const k = clamp(this.popT / 0.2, 0, 1);
        const s = Ease.outBack(k);
        const sq = Math.sin(k * Math.PI) * 0.12;
        sx = (0.35 + 0.65 * s) * (1 + sq); sy = (0.35 + 0.65 * s) * (1 - sq);
      } else {
        const k = clamp((this.popT - 0.12) / 0.1, 0, 1);
        sy = 1 + Math.sin(k * Math.PI) * 0.04;
      }
    }
    sx *= scaleMul; sy *= scaleMul;
    const scaled = Math.abs(sx - 1) > 0.002 || Math.abs(sy - 1) > 0.002 || alpha < 1;
    // pivô do estouro: rabicho/retrato
    let ox = bx + bw / 2, oy = by + bh;
    if (L.at) { ox = L.at.tipX; oy = L.at.up ? by : by + bh; }
    else if (L.tail) ox = L.tail.dir === 'left' ? bx : bx + bw;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
    // retrato (desliza do lado, independente da escala do balão)
    if (kind === 'balloon' && L.portrait && !L.at) {
      const k = closing ? 1 : clamp(this.popT / 0.22, 0, 1);
      const slide = this.bump && !closing ? Math.round((1 - Ease.outBack(k)) * (L.side === 'right' ? 30 : -30)) : 0;
      const bob = Math.round(Math.sin(t * 2.2) * 0.8);
      const px = L.px + slide, py = L.py + bob;
      ctx.fillStyle = '#0b071666'; ctx.fillRect(px + 2, py + 3, PS, PS);
      const typing = !closing && this.chars < L.text.glyphs.length && this.pauseT <= 0;
      drawPortrait(ctx, line.who, line.expr || 'neutral', px, py, { talking: typing, t, flip: L.side === 'right' });
    }
    if (scaled) {
      ctx.translate(ox, oy); ctx.scale(sx, sy); ctx.translate(-ox, -oy);
    }
    if (kind === 'narrator') this._drawNarrator(ctx, L, by, bh);
    else if (kind === 'plaque') ctx.drawImage(plaqueImage(bw, bh), bx, by - 7);
    else {
      ctx.drawImage(balloonImage(bw, bh, L.accent), bx, by);
      this._drawTail(ctx, L, bx, by, bw, bh);
      if (L.name) {
        const img = tagImage(L.name, L.accent);
        const tx = L.side === 'right' && !L.at ? bx + bw - img.width - 7 : bx + 7;
        ctx.drawImage(img, tx, by - 7);
        const light = lum(L.accent) > 0.62;
        font.draw(ctx, L.name, tx + 5, by - 5, { color: light ? OUTLINE : '#ffffff', shadow: light ? mixColor(L.accent, '#ffffff', 0.5) : mixColor(L.accent, '#000000', 0.45) });
      }
    }
    // texto
    const total = L.text.glyphs.length;
    const n = closing ? total : Math.floor(this.chars);
    const tx = L.tx, ty = L.ty;
    const glyphs = L.text.glyphs;
    for (let k = 0; k < n && k < total; k++) {
      const g = glyphs[k];
      if (g.ch === ' ') continue;
      let dx = 0, dy = 0;
      if (line.shake) {
        const h = hashString(`${k}:${Math.floor(t * 18)}`);
        dx = (h % 3) - 1; dy = ((h >> 3) % 3) - 1;
      }
      if (!closing && k >= n - 2 && n < total) dy -= 1;   // letra nova "pula" de leve
      let color = L.color, shadow = L.shadow;
      if (g.color) {
        color = g.color;
        if (kind !== 'narrator' && lum(g.color) > 0.55) shadow = kind === 'plaque' ? '#2a160a' : '#2a1840';
      }
      font.draw(ctx, g.s, tx + g.x + dx, ty + g.y + dy, shadow ? { color, shadow } : { color });
    }
    // indicador "continuar" (agulha quicando)
    if (!closing && n >= total && !line.choices && line.wait == null) {
      const bounce = Math.round(Math.abs(Math.sin(t * 6)) * -3);
      if (kind === 'narrator') drawNeedle(ctx, Math.round(game.view.w / 2 + L.text.width / 2 + 10), by + bh - 5 + bounce);
      else drawNeedle(ctx, bx + bw - 8, by + bh - 4 + bounce);
    }
    ctx.restore();
    // escolhas
    if (!closing && n >= total && line.choices?.length) this._drawChoices(ctx, line, L);
  }

  _drawNarrator(ctx, L, by, bh) {
    const W = game.view.w;
    ctx.fillStyle = '#0b0716d0'; ctx.fillRect(0, by, W, bh);
    ctx.fillStyle = '#0b0716'; ctx.fillRect(0, by - 1, W, 1); ctx.fillRect(0, by + bh, W, 1);
    ctx.fillStyle = '#2a1f4a'; ctx.fillRect(0, by + 1, W, 1); ctx.fillRect(0, by + bh - 2, W, 1);
    ctx.fillStyle = '#c9a24a';
    const off = Math.floor(this.t * 6) % 6;
    for (let x = -6 + off; x < W; x += 6) { ctx.fillRect(x, by + 3, 3, 1); ctx.fillRect(W - x - 3, by + bh - 4, 3, 1); }
    // ornamentos (losangos) nas pontas do texto
    const cy = by + Math.round(bh / 2);
    for (const x of [Math.round((W - L.text.width) / 2) - 12, Math.round((W + L.text.width) / 2) + 8]) {
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + 1, cy - 2, 1, 5); ctx.fillRect(x, cy - 1, 3, 3);
      ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x + 1, cy, 1, 1);
    }
  }

  _drawTail(ctx, L, bx, by, bw, bh) {
    if (L.at) {
      const a = L.at;
      const rootX = clamp(a.tipX, bx + 10, bx + bw - 10);
      const rootY = a.up ? by : by + bh - 1;
      const len = Math.max(3, Math.min(9, Math.abs(a.tipY - rootY)));
      const dir = a.up ? -1 : 1;
      for (let i = 0; i <= len; i++) {
        const k = i / len;
        const cx = Math.round(rootX + (clamp(a.tipX, rootX - 12, rootX + 12) - rootX) * k);
        const hw = Math.round((1 - k) * 4);
        const y = rootY + dir * i;
        ctx.fillStyle = OUTLINE; ctx.fillRect(cx - hw - 1, y, hw * 2 + 3, 1);
        if (i < len) { ctx.fillStyle = CREAM; ctx.fillRect(cx - hw, y - (a.up ? 0 : 0), hw * 2 + 1, 1); }
      }
      return;
    }
    if (!L.tail) return;
    const left = L.tail.dir === 'left';
    const lens = [2, 4, 6, 5, 3, 1];
    const y0 = by + bh - 17;
    lens.forEach((len, j) => {
      const y = y0 + j;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(left ? bx - len : bx + bw - 1, y, len + 1, 1);
      if (j === 0 || j === lens.length - 1) return;
      const f = Math.min(lens[j - 1], lens[j + 1], len - 1);
      ctx.fillStyle = CREAM;
      ctx.fillRect(left ? bx - f + 1 : bx + bw - 2, y, f + 1, 1);
    });
  }

  _drawChoices(ctx, line, L) {
    const { cx, cy, cw, ch } = L;
    ctx.drawImage(balloonImage(cw, ch, L.accent), cx, cy);
    line.choices.forEach((c, k) => {
      const y = cy + 4 + k * 12;
      const on = k === this.sel;
      if (on) {
        ctx.fillStyle = mixColor(L.accent, CREAM, 0.6); ctx.fillRect(cx + 3, y, cw - 6, 11);
        ctx.fillStyle = mixColor(L.accent, CREAM, 0.25); ctx.fillRect(cx + 3, y + 10, cw - 6, 1);
        const o = Math.round(Math.sin(this.t * 8));
        ctx.fillStyle = OUTLINE;
        for (let i = 0; i < 4; i++) ctx.fillRect(cx + 6 + i + o, y + 2 + i, 1, 7 - i * 2);
        ctx.fillStyle = '#ff6a8a';
        for (let i = 0; i < 3; i++) ctx.fillRect(cx + 6 + i + o, y + 3 + i, 1, 5 - i * 2);
      }
      font.draw(ctx, String(c), cx + 15, y + 2, { color: on ? '#2a1840' : '#6a5a7a' });
    });
  }
}

// retrato existe e desenha algo? (narrador/placa não têm)
function R_hasPortrait(who) {
  const p = R.portraits.get(who);
  return !!p && !p.none;
}
