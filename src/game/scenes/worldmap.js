// =============================================================================
// scenes/worldmap.js — Mapa-colcha do Avesso ('worldmap').
//
// Cada mundo é uma ilha-retalho de tecido (borda picotada + pesponto) flutuando
// no céu vivo do mundo; as fases são botões de costura ligados por linhas
// tracejadas. Tico anda pela linha entre os botões (←/→, ↑/↓ p/ fase bônus, ou
// toque num botão). Mundos trancados aparecem "costurados" (pontos em X).
//
// params (constructor e/ou enter): { focusLevel, justCompleted, worldSelect }
//   focusLevel    → Tico começa nesse botão
//   justCompleted → anima o próximo botão; se for chefe, costura o fio até o
//                   próximo mundo (uma vez por mundo, flag 'map_sewn_wN')
//   worldSelect   → começa no modo "Escolha o mundo" (←/→ trocam de mundo)
// Controles: confirmar = jogar · voltar = menu lateral · Q/E (cycle) = mundo.
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { islandImage, castleImage, drawSea, drawClouds, ISLE_M, bridgeImage } from './overworld_art.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { audio, hasSong } from '../../engine/audio.js';
import font from '../../engine/font.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { drawSprite, animFrame, getImage, defineImage } from '../../engine/sprites.js';
import { clamp, damp, Ease, makeRng, mixColor, lighten, darken } from '../../engine/util.js';
import { R, registerScene, makeScene } from '../registry.js';
import { WORLDS } from '../worlds.js';
import { drawPanel, drawButton } from '../art/ui_kit.js';
import { drawSky, skyPreset } from '../art/sky.js';
import { drawCosmetics, threadColor } from '../art/cosmetics.js';
import { ButtonList, inRect, fmtTime } from './menus_basic.js';
import { LevelScene } from './level_scene.js';

const INK = '#1b1030';
const PW = 232, PH = 124, GAP = 100;
const YOFF = [0, 12, -8, 10, -4];
const MENU_W = 28, TOP = 22, INFO_H = 42;
// layout base dos botões (local ao retalho); mundos pares são espelhados na vertical
const LAYOUT = [[24, 90], [60, 64], [100, 86], [138, 56], [172, 82], [205, 46]];
const BONUS = { at: [86, 30], parent: 2 };
const PAL = {
  1: { t: ['#2f7a3a', '#3f9a48', '#5fbf5a', '#8fe07a'], edge: '#1d4a2a', st: '#f4e8b0' },
  2: { t: ['#1f5a9a', '#2f78c0', '#4f9fe0', '#8fd0ff'], edge: '#0f2a4a', st: '#ffe0f0' },
  3: { t: ['#9a5a1a', '#c07a2a', '#e0a040', '#ffd080'], edge: '#4a2a10', st: '#fff4dc' },
  4: { t: ['#2a1a4a', '#3a2662', '#4e3680', '#7a5ab0'], edge: '#120a24', st: '#ffd86a' },
  5: { t: ['#7a1430', '#a01e40', '#c83050', '#ff6a7a'], edge: '#3a0a1a', st: '#ffd23f' },
};
const R0 = Math.round;

// ------------------------------------------------------------ imagens fixas
defineImage('map_star_on', 7, 7, (pc) => {
  pc.ascii(['..L..', '.LYY.', 'YYYYD', '.YYD.', '.D.D.'], { L: '#fff6b0', Y: '#ffd23f', D: '#c88a10' }, 1, 1); pc.outline(INK);
});
defineImage('map_star_off', 7, 7, (pc) => {
  pc.ascii(['..G..', '.GGG.', 'GGGGG', '.GGG.', '.G.G.'], { G: '#4a4060' }, 1, 1); pc.outline(INK);
});
defineImage('map_crown', 13, 9, (pc) => {
  pc.ascii(['W....W....W', 'YY..YYY..YY', 'YYYYYYYYYYY', 'YRYYYBYYYRY', 'DDDDDDDDDDD'],
    { W: '#fff6b0', Y: '#ffd23f', D: '#c88a10', R: '#ff4f6a', B: '#4fb8ff' }, 1, 1); pc.outline(INK);
});

// --------------------------------------------------------- retalho (ilha)
const patchCache = new Map();
function patchImage(world, locked) {
  const key = world + (locked ? 'L' : '');
  let img = patchCache.get(key);
  if (img) return img;
  const p = PAL[world];
  const C = locked ? (c) => mixColor(c, '#3a3448', 0.72) : (c) => c;
  const t = p.t.map(C), edge = C(p.edge), st = C(p.st);
  const W = PW + 4, H = PH + 5;
  const pc = new PixelCanvas(W, H);
  const cx = (PW - 1) / 2, cy = (PH - 1) / 2, rr = 12;
  const inside = (x, y) => {
    const qx = Math.abs(x - cx) - (PW / 2 - rr), qy = Math.abs(y - cy) - (PH / 2 - rr);
    const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
    return -sdf;
  };
  const tooth = (x, y) => Math.abs(((x + y) % 6) - 3) * 0.6;
  // sombra
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (inside(x, y) >= tooth(x, y)) pc.px(x + 3, y + 4, '#0b071677');
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const d = inside(x, y);
      if (d < tooth(x, y)) continue;
      let c = t[1];
      if ((x % 4 === 0 && y % 2 === 0) || (x % 4 === 2 && y % 2 === 1)) c = t[2];
      if (x % 6 === 3 && y % 6 === 3) c = t[0];
      const lx = x - cx, ly = y - cy;
      if (d < 3.2) c = (lx / PW + ly / PH) < 0 ? t[3] : t[0];
      if (d < 1.4) c = edge;
      if (d >= 5 && d < 6 && ((x + y) % 6) < 4) c = st;
      pc.px(x, y, c);
    }
  }
  // motivos bordados, longe dos botões e das linhas
  const flip = world % 2 === 0;
  const nodes = LAYOUT.map(([x, y]) => [x, flip ? PH - y : y]).concat([[BONUS.at[0], flip ? PH - BONUS.at[1] : BONUS.at[1]]]);
  const segs = [];
  for (let i = 0; i < 5; i++) segs.push([nodes[i], nodes[i + 1]]);
  segs.push([nodes[BONUS.parent], nodes[6]]);
  const far = (x, y) => {
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      const k = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
      if (Math.hypot(x - a[0] - dx * k, y - a[1] - dy * k) < 15) return false;
    }
    return inside(x, y) > 12;
  };
  const rng = makeRng(world * 977 + 13);
  const M = MOTIFS[world];
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 18; tries++) {
    const x = rng.int(10, PW - 10), y = rng.int(10, PH - 10);
    if (!far(x, y)) continue;
    M(pc, x, y, rng, t, C);
    placed++;
  }
  pc.flush();
  img = pc.canvas;
  patchCache.set(key, img);
  return img;
}
const MOTIFS = {
  1: (pc, x, y, rng, t, C) => { // árvores, cogumelos, tufos
    const k = rng();
    if (k < 0.45) {
      pc.rect(x, y + 3, 2, 3, C('#6a4428'));
      pc.tri(x - 4, y + 3, x + 5, y + 3, x + 1, y - 5, t[0]);
      pc.tri(x - 3, y, x + 4, y, x + 1, y - 7, t[3]);
      pc.px(x, y - 4, C('#c8ff9a'));
    } else if (k < 0.7) {
      pc.rect(x, y + 1, 2, 2, C('#f4e8c8'));
      pc.ellipse(x + 1, y, 3, 2, C('#e8384a'));
      pc.px(x, y - 1, C('#ffffff')); pc.px(x + 2, y, C('#ffffff'));
    } else { pc.px(x, y, t[3]); pc.px(x + 2, y - 1, t[3]); pc.px(x + 1, y + 1, t[0]); pc.px(x + 4, y, t[3]); }
  },
  2: (pc, x, y, rng, t, C) => { // ondas, bolhas, coral
    const k = rng();
    if (k < 0.5) { for (let i = 0; i < 7; i++) pc.px(x + i, y + R0(Math.sin(i * 0.9) * 1.5), t[3]); }
    else if (k < 0.8) { pc.ring(x, y, 2, t[3]); pc.px(x - 1, y - 1, C('#ffffff')); }
    else { pc.vline(x, y - 4, 5, C('#ff7a9a')); pc.vline(x - 2, y - 2, 3, C('#ff7a9a')); pc.vline(x + 2, y - 3, 4, C('#ffa0b8')); pc.hline(x - 2, y, 5, C('#d8506a')); }
  },
  3: (pc, x, y, rng, t, C) => { // engrenagens e relógios
    if (rng() < 0.55) {
      const r = rng.int(3, 5);
      for (let a = 0; a < 8; a++) pc.px(R0(x + Math.cos(a * Math.PI / 4) * (r + 1)), R0(y + Math.sin(a * Math.PI / 4) * (r + 1)), t[0]);
      pc.circle(x, y, r, t[3]); pc.circle(x, y, r - 2, t[1]); pc.px(x, y, t[0]);
    } else {
      pc.circle(x, y, 4, C('#fff4dc')); pc.ring(x, y, 4, t[0]);
      pc.vline(x, y - 3, 3, INK); pc.hline(x, y, 3, C('#a8401a'));
    }
  },
  4: (pc, x, y, rng, t, C) => { // estrelinhas, lua, olhos no escuro
    const k = rng();
    if (k < 0.55) { const c = C('#ffd86a'); pc.px(x, y, c); pc.px(x - 1, y, c); pc.px(x + 1, y, c); pc.px(x, y - 1, c); pc.px(x, y + 1, c); }
    else if (k < 0.75) { pc.circle(x, y, 4, C('#f0e0a0')); pc.circle(x + 2, y - 1, 4, t[1]); }
    else { pc.px(x, y, C('#ffe14a')); pc.px(x + 3, y, C('#ffe14a')); pc.px(x, y + 1, t[0]); pc.px(x + 3, y + 1, t[0]); }
  },
  5: (pc, x, y, rng, t, C) => { // espirais de fio dourado e fendas
    if (rng() < 0.6) {
      for (let i = 0; i < 22; i++) { const a = i * 0.5, r = 0.4 + i * 0.22; pc.px(R0(x + Math.cos(a) * r), R0(y + Math.sin(a) * r), C(i % 3 ? '#ffd23f' : '#fff09a')); }
    } else {
      let yy = y;
      for (let i = 0; i < 9; i++) { pc.px(x + i, yy, C('#ff4fd8')); pc.px(x + i, yy + 1, C('#5a0a3a')); yy += (i % 2 ? 1 : -1); }
    }
  },
};

// ----------------------------------------------------------- botão de costura
const btnCache = new Map();
function buttonImage(r, face, state) {
  const key = r + face + state;
  let img = btnCache.get(key);
  if (img) return img;
  const S = r * 2 + 3, pc = new PixelCanvas(S, S + 2);
  const c = r + 1.5, hs = Math.max(2, R0(r * 0.36));
  const lt = lighten(face, 0.3), dk = darken(face, 0.28), gr = darken(face, 0.42);
  for (let y = 0; y < S + 2; y++) for (let x = 0; x < S; x++) {
    if (Math.hypot(x + 0.5 - c, y + 0.5 - c) > r + 1 && Math.hypot(x + 0.5 - c, y - 1.5 - c) <= r + 1) pc.px(x, y, '#0b071688');
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    if (d > r + 1) continue;
    let k = face;
    if (d > r) k = INK;
    else if (d > r - 1.5) k = dx + dy < 0 ? lt : dk;
    else if (d > r - 2.5 && r >= 6) k = gr;
    else if (dx + dy < -r * 0.6) k = mixColor(face, lt, 0.5);
    pc.px(x, y, k);
  }
  const cc = Math.floor(c);
  const holes = [[-hs, -hs], [hs, -hs], [-hs, hs], [hs, hs]];
  if (state === 'done') {
    pc.line(cc - hs, cc - hs, cc + hs, cc + hs, '#ffd23f');
    pc.line(cc + hs, cc - hs, cc - hs, cc + hs, '#ffd23f');
    pc.px(cc - hs + 1, cc - hs + 1, '#fff6b0');
  }
  for (const [hx, hy] of holes) {
    pc.px(cc + hx, cc + hy, state === 'done' ? '#c88a10' : INK);
    if (r >= 9) pc.px(cc + hx + 1, cc + hy, gr);
  }
  pc.flush();
  img = pc.canvas;
  btnCache.set(key, img);
  return img;
}

// ======================================================================= CENA
class WorldMapScene extends Scene {
  constructor(params) {
    super();
    this.params = params && typeof params === 'object' && !params.player ? { ...params } : {};
  }
  enter(params) {
    if (params && typeof params === 'object' && !params.player) {
      for (const k of ['focusLevel', 'justCompleted', 'worldSelect']) if (params[k] != null) this.params[k] = params[k];
    }
    const P = this.params;
    this.debugAll = game.params?.get('unlock') === 'all';
    this.buildNodes();
    this.focus = 'map';
    this.picker = !!P.worldSelect;
    this.denyNode = null; this.denyT = 0;
    this.pop = null; this.sew = null; this.unlockFx = {}; this.poof = null;
    this.rects = {};
    this.press = null;
    // ponto de partida do Tico
    const prog = save.data.progress;
    let start = this.byId.get(P.focusLevel) || this.byId.get(prog.lastLevel);
    if (!start || !this.isOpen(start)) start = this.furthestOpen(this.picker ? this.maxWorld() : (start?.world || prog.currentWorld || 1));
    this.tico = { x: start.x, y: start.y, node: start, dest: start, path: [], flip: false, t: 0 };
    this.info = start;
    this.curWorld = start.world;
    this.skyWorld = start.world; this.prevSky = null; this.skyK = 1;
    const { w, h } = game.view;
    this.camX = this.camTarget(w, h).x; this.camY = this.camTarget(w, h).y;
    this.menu = new ButtonList([
      { label: '', name: 'Inventário', icon: 'icon_bag', action: () => this.openSub('inventory') },
      { label: '', name: 'Habilidades', icon: 'icon_ab_stitch', action: () => this.openSub('skilltree') },
      { label: '', name: 'Memórias', icon: 'icon_book', action: () => this.openSub('memories') },
      { label: '', name: 'Guarda-roupa', icon: 'icon_shirt', action: () => this.openSub('wardrobe') },
      { label: '', name: 'Configurações', icon: 'icon_gear', action: () => this.openSub('settings') },
      { label: '', name: 'Título', icon: 'icon_arrow_l', sfx: 'ui_back', action: () => this.toTitle() },
    ], { cursor: false });
    this.hoverMenu = -1;
    this.startAnims();
    this.music();
  }
  music() { if (hasSong('worldmap')) audio.playMusic('worldmap'); }
  resume() { this.music(); this.press = null; }

  // ------------------------------------------------------------- dados
  buildNodes() {
    this.nodes = []; this.chain = []; this.byId = new Map(); this.bonus = {};
    WORLDS.forEach((wd, wi) => {
      const ox = wi * (PW + GAP), oy = YOFF[wi], flip = wi % 2 === 1;
      const pos = ([x, y]) => ({ x: ox + x, y: oy + (flip ? PH - y : y) });
      wd.levels.forEach((id, i) => {
        const n = { id, world: wd.id, idx: i + 1, boss: i === 5, ...pos(LAYOUT[i]) };
        this.nodes.push(n); this.chain.push(n); this.byId.set(id, n);
      });
      const b = { id: wd.bonus, world: wd.id, idx: 0, bonus: true, ...pos(BONUS.at) };
      b.parent = this.byId.get(wd.levels[BONUS.parent]);
      b.parent.bonusNode = b;
      this.nodes.push(b); this.byId.set(b.id, b); this.bonus[wd.id] = b;
    });
    this.links = new Map();
  }
  patchX(world) { return (world - 1) * (PW + GAP); }
  patchY(world) { return YOFF[world - 1]; }
  rec(id) { return save.levelRecord(id); }
  exists(n) { return R.levels.has(n.id); }
  worldOpen(w) { return w === 1 || save.isWorldUnlocked(w) || this.debugAll; }
  worldStars(w) {
    let s = 0;
    for (const id of WORLDS[w - 1].levels) for (const f of this.rec(id)?.starsFound || []) if (f) s++;
    return s;
  }
  bonusShown(w) {
    return this.debugAll || this.worldStars(w) >= (WORLDS[w - 1].bonusStarsNeeded || 10) || save.data.progress.bonusUnlocked.includes(w);
  }
  isOpen(n) {
    if (!n || !this.exists(n) || !this.worldOpen(n.world)) return false;
    if (this.sew && n.world === this.sew.to.world) return false;
    if (n.bonus) return this.bonusShown(n.world);
    if (this.debugAll || n.idx === 1) return true;
    return !!this.rec(WORLDS[n.world - 1].levels[n.idx - 2])?.done;
  }
  /** 'soon' | 'locked' | 'open' | 'done' */
  state(n) {
    if (!this.exists(n)) return 'soon';
    if (!this.isOpen(n)) return 'locked';
    return this.rec(n.id)?.done ? 'done' : 'open';
  }
  maxWorld() { let m = 1; for (let w = 1; w <= 5; w++) if (this.worldOpen(w)) m = w; return m; }
  furthestOpen(world) {
    const list = this.chain.filter((n) => n.world === world && this.isOpen(n));
    const notDone = list.find((n) => !this.rec(n.id)?.done);
    return notDone || list[list.length - 1] || this.chain.find((n) => this.isOpen(n)) || this.chain[0];
  }

  // ------------------------------------------------------------- linhas
  linkPts(a, b) {
    const key = a.id + '>' + b.id;
    let pts = this.links.get(key);
    if (pts) return pts;
    const rev = this.links.get(b.id + '>' + a.id);
    if (rev) { pts = rev.slice().reverse(); this.links.set(key, pts); return pts; }
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    let off = a.world !== b.world ? 0 : (a.bonus || b.bonus ? 6 : (Math.min(a.idx, b.idx) % 2 ? 8 : -8));
    let mx = (a.x + b.x) / 2 - (dy / len) * off, my = (a.y + b.y) / 2 + (dx / len) * off;
    if (a.world !== b.world) my = Math.max(a.y, b.y) + 30;
    const n = Math.max(6, Math.ceil(len / 3));
    pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, u = 1 - k;
      pts.push({ x: u * u * a.x + 2 * u * k * mx + k * k * b.x, y: u * u * a.y + 2 * u * k * my + k * k * b.y });
    }
    this.links.set(key, pts);
    return pts;
  }
  route(a, b) {
    if (a === b) return [a];
    const seq = [a];
    if (a.bonus) seq.push(a.parent);
    const s = seq[seq.length - 1], e = b.bonus ? b.parent : b;
    const i0 = this.chain.indexOf(s), i1 = this.chain.indexOf(e);
    const st = i1 >= i0 ? 1 : -1;
    for (let i = i0 + st; st > 0 ? i <= i1 : i >= i1; i += st) seq.push(this.chain[i]);
    if (b.bonus && seq[seq.length - 1] !== b) seq.push(b);
    return seq;
  }
  walkTo(target, playAfter = false) {
    const T = this.tico;
    const from = T.path.length ? T.dest : T.node;
    if (target === from && !T.path.length) { this.info = target; if (playAfter) this.play(target); return; }
    const seq = this.route(T.path.length ? this.nearestNode() : T.node, target);
    const pts = [];
    for (let i = 0; i < seq.length - 1; i++) pts.push(...this.linkPts(seq[i], seq[i + 1]).slice(1));
    T.path = pts; T.dest = target; T.speed = pts.length * 3 > 240 ? 240 : 120;
    this.peek = null;
    this.info = target;
    this.playOnArrive = playAfter;
  }
  nearestNode() {
    let best = null, bd = 1e9;
    for (const n of this.nodes) { const d = Math.hypot(n.x - this.tico.x, n.y - this.tico.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  // ------------------------------------------------------------- animações
  startAnims() {
    const jc = this.params.justCompleted;
    const n = jc && this.byId.get(jc);
    if (!n || n.bonus) return;
    if (n.boss && n.world < 5) {
      const nw = n.world + 1, flag = 'map_sewn_w' + nw;
      if (save.isWorldUnlocked(nw) && !save.flag(flag)) {
        save.setFlag(flag); save.commit();
        this.sew = { from: n, to: this.byId.get(WORLDS[nw - 1].levels[0]), t: -0.6, dur: 2.2 };
        this.sew.pts = this.linkPts(this.sew.from, this.sew.to);
        return;
      }
    }
    const next = this.chain[this.chain.indexOf(n) + 1];
    if (next && next.world === n.world && this.isOpen(next) && !this.rec(next.id)?.done) this.pop = { node: next, t: -0.4 };
  }
  updateAnims(dt) {
    if (this.pop) {
      this.pop.t += dt;
      if (this.pop.t > 0 && !this.pop.sfx) { this.pop.sfx = true; audio.sfx('stitch_connect'); }
      if (this.pop.t > 0.7 && !this.pop.walked) { this.pop.walked = true; this.walkTo(this.pop.node); }
      if (this.pop.t > 1.4) this.pop = null;
    }
    const S = this.sew;
    if (S) {
      const prev = S.t;
      S.t += dt;
      if (prev < 0 && S.t >= 0) audio.sfx('stitch_cast');
      if (S.t > 0 && Math.floor(S.t * 8) !== Math.floor(prev * 8)) audio.sfx('step', { vol: 0.25, pitch: 1.6 });
      if (S.t >= S.dur && prev < S.dur) {
        audio.sfx('ability_get');
        this.unlockFx[S.to.world] = 0;
      }
      if (S.t >= S.dur + 0.8) { const to = S.to; this.sew = null; this.walkTo(to); }
    }
    for (const k of Object.keys(this.unlockFx)) { this.unlockFx[k] += dt; if (this.unlockFx[k] > 1) delete this.unlockFx[k]; }
    if (this.poof) { this.poof.t += dt; if (this.poof.t > 0.5) this.poof = null; }
    this.denyT = Math.max(0, this.denyT - dt);
  }

  // ------------------------------------------------------------- ações
  play(n) {
    if (!n || !this.isOpen(n) || this.manager?.transitioning) { audio.sfx('ui_denied'); this.deny(n); return; }
    const id = n.id, wd = WORLDS[n.world - 1];
    save.data.progress.currentWorld = n.world;
    save.commit();
    audio.sfx('menu_confirm_big');
    const toLevel = () => game.scenes.go(new LevelScene(), { levelId: id }, { transition: 'stitch' });
    if (wd.intro && R.cutscenes.has(wd.intro) && !save.seen(wd.intro)) {
      const cs = makeScene('cutscene', wd.intro, { next: toLevel });
      if (cs) { game.scenes.go(cs, {}, { transition: 'stitch' }); return; }
    }
    toLevel();
  }
  deny(n) { this.denyNode = n; this.denyT = 0.35; }
  openSub(name) {
    const s = makeScene(name, { from: 'map', onClose: null });
    if (!s) { audio.sfx('ui_denied'); return; }
    audio.sfx('ui_open');
    this.manager.push(s, { onClose: null, from: 'map' });
  }
  toTitle() { const t = makeScene('title'); if (t) game.scenes.go(t, {}, { transition: 'fade' }); }
  get viewWorld() { return this.peek || this.curWorld; }
  /** Vai para o mundo w: Tico salta para lá se houver fase aberta; senão a câmera só "espia". */
  gotoWorld(w) {
    if (w < 1 || w > 5) return false;
    const has = this.worldOpen(w) && this.chain.some((n) => n.world === w && this.isOpen(n));
    if (!has) {
      this.peek = w === this.curWorld ? null : w;
      this.info = this.chain[(w - 1) * 6];
      audio.sfx('ui_move');
      return true;
    }
    const n = this.furthestOpen(w);
    const T = this.tico;
    this.peek = null;
    if (T.node === n && !T.path.length) { this.info = n; return true; }
    T.path = []; T.node = T.dest = n; T.x = n.x; T.y = n.y;
    this.curWorld = n.world;
    this.info = n;
    this.poof = { x: n.x, y: n.y, t: 0 };
    audio.sfx('whoosh', { vol: 0.5 });
    return true;
  }
  switchWorld(dir) { return this.gotoWorld(this.viewWorld + dir); }
  step(dir) { // ←/→ ao longo da linha
    if (this.peek) { this.peek = null; this.info = this.tico.dest; return; }
    const T = this.tico, cur = T.path.length ? T.dest : T.node;
    let target;
    if (cur.bonus) target = cur.parent;
    else target = this.chain[this.chain.indexOf(cur) + dir];
    if (!target) return;
    if (this.isOpen(target)) { audio.sfx('ui_move'); this.walkTo(target); }
    else { audio.sfx('ui_denied'); this.deny(target); this.info = target; }
  }
  vert() { // ↑/↓: ramo da fase bônus
    if (this.peek) { this.peek = null; this.info = this.tico.dest; return; }
    const T = this.tico, cur = T.path.length ? T.dest : T.node;
    const target = cur.bonus ? cur.parent : cur.bonusNode;
    if (!target) return;
    if (this.isOpen(target)) { audio.sfx('ui_move'); this.walkTo(target); }
    else if (!target.bonus || this.bonusShown(target.world)) { audio.sfx('ui_denied'); this.deny(target); this.info = target; }
  }

  // ------------------------------------------------------------- update
  camTarget(w, h) {
    const S = this.sew;
    const areaCX = MENU_W + (w - MENU_W) / 2, areaCY = TOP + (h - TOP - INFO_H - 4) / 2;
    if (S && S.t > 0) {
      const k = clamp(S.t / S.dur, 0, 1), p = S.pts[Math.floor(k * (S.pts.length - 1))];
      return { x: p.x - areaCX, y: this.patchY(S.from.world) + PH / 2 - areaCY };
    }
    const vw = this.viewWorld;
    return { x: this.patchX(vw) + PW / 2 - areaCX, y: this.patchY(vw) + PH / 2 - areaCY };
  }
  update(dt) {
    const T = this.tico;
    T.t += dt;
    this.updateAnims(dt);
    // movimento do Tico
    if (T.path.length) {
      let move = (T.speed || 120) * dt;
      while (move > 0 && T.path.length) {
        const p = T.path[0], dx = p.x - T.x, dy = p.y - T.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.05) T.flip = dx < 0;
        if (d <= move) { T.x = p.x; T.y = p.y; move -= d; T.path.shift(); } else { T.x += dx / d * move; T.y += dy / d * move; move = 0; }
      }
      if (!T.path.length) {
        T.node = T.dest; audio.sfx('land', { vol: 0.35 });
        if (this.playOnArrive) { this.playOnArrive = false; this.play(T.node); }
      }
    }
    const near = T.path.length ? this.nearestNode() : T.node;
    if (near.world !== this.curWorld) { this.curWorld = near.world; }
    if (this.skyWorld !== this.viewWorld) { this.prevSky = this.skyWorld; this.skyWorld = this.viewWorld; this.skyK = 0; }
    this.skyK = Math.min(1, this.skyK + dt * 1.6);
    const { w, h } = game.view;
    const ct = this.camTarget(w, h);
    this.camX = damp(this.camX, ct.x, 6, dt); this.camY = damp(this.camY, ct.y, 6, dt);

    if (this.manager?.transitioning || this.time < 0.15 || this.sew) return;
    this.handlePointer();
    if (this.focus === 'menu') {
      if (input.pressed('back') || input.pressed('cycle') || input.pressed('right')) {
        input.consume('back'); input.consume('right'); audio.sfx('ui_back'); this.focus = 'map'; return;
      }
      this.menu.update(dt);
      return;
    }
    if (this.picker) {
      if (input.pressed('left')) { if (!this.switchWorld(-1)) audio.sfx('ui_denied'); }
      if (input.pressed('right')) { if (!this.switchWorld(1)) audio.sfx('ui_denied'); }
      if (input.pressed('confirm') || input.pressed('down')) {
        input.consume('confirm'); input.consume('jump');
        if (this.peek) { audio.sfx('ui_denied'); this.deny(this.info); } else { audio.sfx('ui_select'); this.picker = false; }
      }
      if (input.pressed('back')) { input.consume('back'); this.picker = false; this.focus = 'menu'; this.menu.sel = 0; audio.sfx('ui_open'); }
      return;
    }
    if (input.pressed('right')) this.step(1);
    else if (input.pressed('left')) this.step(-1);
    else if (input.pressed('up') || input.pressed('down')) this.vert();
    if (input.pressed('cycle')) { if (!this.switchWorld(1)) this.gotoWorld(1); }
    if (input.pressed('confirm')) {
      input.consume('confirm'); input.consume('jump');
      if (T.path.length) this.playOnArrive = this.isOpen(T.dest);
      else this.play(this.info === T.node ? T.node : this.info);
    }
    if (input.pressed('back')) { input.consume('back'); this.focus = 'menu'; audio.sfx('ui_open'); }
  }
  handlePointer() {
    const p = input.pointer;
    const hitAt = () => {
      const r = this.rects;
      if (inRect(p, r.play)) return { k: 'play' };
      if (inRect(p, r.arrowL)) return { k: 'arrow', d: -1 };
      if (inRect(p, r.arrowR)) return { k: 'arrow', d: 1 };
      if (inRect(p, r.menuBtn)) return { k: 'menuBtn' };
      const mi = this.menu.hit(p);
      if (mi >= 0) return { k: 'menu', i: mi };
      if (this.focus === 'menu') return { k: 'outside' };
      if (inRect(p, r.info)) return { k: 'info' };
      const mx = p.x + this.camX, my = p.y + this.camY;
      let best = null, bd = 13;
      for (const n of this.nodes) {
        if (!this.worldOpen(n.world) || (n.bonus && !this.bonusShown(n.world))) continue;
        const d = Math.hypot(n.x - mx, n.y - my);
        if (d < bd) { bd = d; best = n; }
      }
      return best ? { k: 'node', n: best } : null;
    };
    const mi = this.menu.hit(p);
    this.hoverMenu = input.lastDevice !== 'touch' ? mi : -1;
    if (p.pressed) this.press = hitAt();
    if (!p.released) return;
    const a = this.press, b = hitAt();
    this.press = null;
    if (!a || !b || a.k !== b.k || a.i !== b.i || a.n !== b.n || a.d !== b.d) return;
    if (b.k === 'menuBtn') { this.focus = this.focus === 'menu' ? 'map' : 'menu'; this.menu.sel = 0; audio.sfx(this.focus === 'menu' ? 'ui_open' : 'ui_back'); }
    else if (b.k === 'outside') { this.focus = 'map'; audio.sfx('ui_back'); }
    else if (b.k === 'menu') { this.focus = 'map'; this.menu.activate(b.i); }
    else if (b.k === 'arrow') { if (!this.switchWorld(b.d)) audio.sfx('ui_denied'); this.picker = false; }
    else if (b.k === 'play') { const n = this.info; if (this.isOpen(n)) { audio.sfx('ui_select'); this.walkTo(n, true); } else { audio.sfx('ui_denied'); this.deny(n); } }
    else if (b.k === 'node') {
      this.picker = false; this.focus = 'map';
      const n = b.n, T = this.tico;
      if (!this.isOpen(n)) { audio.sfx('ui_denied'); this.deny(n); this.info = n; return; }
      if (n === T.node && !T.path.length && this.info === n) this.play(n);
      else { audio.sfx('ui_move'); this.walkTo(n); }
    }
  }

  // ------------------------------------------------------------- desenho
  draw(ctx) {
    const { w, h } = game.view, t = this.time;
    const cx = R0(this.camX), cy = R0(this.camY);
    // mar animado (estilo overworld) — o mundo atual tinge a água
    drawSea(ctx, w, h, cx, cy, t, this.skyWorld);
    ctx.save();
    ctx.translate(-cx, -cy);
    this.drawWorlds(ctx, w, cx, t);
    this.drawTico(ctx, t);
    ctx.restore();
    drawClouds(ctx, w, h, cx, cy, t, 'shadow');
    drawClouds(ctx, w, h, cx, cy, t, 'cloud');
    this.drawHeader(ctx, w, t);
    this.drawMenu(ctx, w, h, t);
    this.drawInfo(ctx, w, h, t);
  }
  drawWorlds(ctx, w, cx, t) {
    const vis = (world) => { const x = this.patchX(world); return x + PW + 40 > cx && x - 40 < cx + w; };
    // retalhos
    for (const wd of WORLDS) {
      if (!vis(wd.id)) continue;
      const open = this.worldOpen(wd.id) && !(this.sew && this.sew.to.world === wd.id);
      const x = this.patchX(wd.id), y = this.patchY(wd.id);
      ctx.drawImage(islandImage(wd.id, !open, PW, PH, ...this.isleGeom(wd.id)), x - ISLE_M, y - ISLE_M);
      // etiqueta com o nome curto
      const label = wd.id + ' - ' + wd.short, lw = font.measure(label) + 10;
      const ly = wd.id % 2 === 0 ? y + PH - 8 : y - 8; // mundos espelhados: etiqueta embaixo
      drawPanel(ctx, x + 10, ly, lw, 16, open ? 'paper' : 'dark');
      font.draw(ctx, label, x + 10 + lw / 2, ly + 4, { align: 'center', color: open ? '#2a1840' : '#8a80a0' });
    }
    // faixas de terra ligando as ilhas (um continente só)
    for (let wi = 1; wi < 5; wi++) {
      const b = bridgeImage(wi, PW, PH, GAP, (k) => this.patchX(k), (k) => this.patchY(k));
      if (b.x + b.img.width < cx - 20 || b.x > cx + w + 20) continue;
      if (!this.worldOpen(wi + 1)) ctx.globalAlpha = 0.55;
      ctx.drawImage(b.img, b.x, b.y);
      ctx.globalAlpha = 1;
      const a = this.chain[wi * 6 - 1], c = this.chain[wi * 6];
      this.drawRoad(ctx, this.linkPts(a, c), wi);
    }
    // linhas entre mundos
    for (let wi = 1; wi < 5; wi++) {
      const a = this.chain[wi * 6 - 1], b = this.chain[wi * 6];
      if (!vis(a.world) && !vis(b.world)) continue;
      if (this.sew && this.sew.to === b) this.drawThread(ctx, this.linkPts(a, b), true, clamp(this.sew.t / this.sew.dur, 0, 1), t);
      else if (this.worldOpen(b.world)) this.drawThread(ctx, this.linkPts(a, b), this.isOpen(b), 1, t);
    }
    // linhas dentro dos mundos + botões
    for (const wd of WORLDS) {
      if (!vis(wd.id)) continue;
      const open = this.worldOpen(wd.id) && !(this.sew && this.sew.to.world === wd.id);
      if (!open) { this.drawStitchedShut(ctx, wd.id, t, 1); continue; }
      if (this.unlockFx[wd.id] != null) this.drawStitchedShut(ctx, wd.id, t, 1 - this.unlockFx[wd.id]);
      const ns = this.chain.filter((n) => n.world === wd.id);
      for (let i = 0; i < 5; i++) this.drawRoad(ctx, this.linkPts(ns[i], ns[i + 1]), wd.id);
      if (this.bonusShown(wd.id)) this.drawRoad(ctx, this.linkPts(this.bonus[wd.id].parent, this.bonus[wd.id]), wd.id);
      for (let i = 0; i < 5; i++) this.drawThread(ctx, this.linkPts(ns[i], ns[i + 1]), this.isOpen(ns[i + 1]), 1, t);
      const b = this.bonus[wd.id];
      if (this.bonusShown(wd.id)) this.drawThread(ctx, this.linkPts(b.parent, b), this.isOpen(b), 1, t);
      for (const n of ns) this.drawNode(ctx, n, t);
      if (this.bonusShown(wd.id)) this.drawNode(ctx, b, t);
      else this.drawBonusHint(ctx, b, wd, t);
    }
    // agulha costurando o caminho para o próximo mundo
    const S = this.sew;
    if (S && S.t > 0 && S.t < S.dur) {
      const k = S.t / S.dur, i = Math.min(S.pts.length - 2, Math.floor(k * (S.pts.length - 1)));
      const p = S.pts[i], q = S.pts[i + 1];
      const d = Math.hypot(q.x - p.x, q.y - p.y) || 1, ux = (q.x - p.x) / d, uy = (q.y - p.y) / d;
      for (let j = 0; j < 10; j++) { ctx.fillStyle = j < 2 ? '#ffffff' : j > 7 ? '#8a94a8' : '#d8e2ee'; ctx.fillRect(R0(p.x + ux * (4 - j)), R0(p.y + uy * (4 - j)) - 1, 2, 2); }
      ctx.fillStyle = '#fff6b0';
      if (Math.floor(t * 10) % 2) ctx.fillRect(R0(p.x + ux * 6) - 1, R0(p.y + uy * 6) - 2, 2, 2);
    }
  }
  /** Pontos/segmentos dos caminhos em coordenadas locais da ilha (para não pôr decoração em cima). */
  isleGeom(world) {
    const flip = world % 2 === 0;
    const nodes = LAYOUT.map(([x, y]) => [x, flip ? PH - y : y]).concat([[BONUS.at[0], flip ? PH - BONUS.at[1] : BONUS.at[1]]]);
    const segs = [];
    for (let i = 0; i < 5; i++) segs.push([nodes[i], nodes[i + 1]]);
    segs.push([nodes[BONUS.parent], nodes[6]]);
    return [nodes, segs];
  }
  /** Estrada de terra sob o fio (como nos mapas clássicos). */
  drawRoad(ctx, pts, world) {
    const edge = world === 4 ? '#1a1228' : world === 5 ? '#3a0a1a' : '#7a5a32';
    const fill = world === 4 ? '#4a4060' : world === 5 ? '#7a3a4a' : world === 2 ? '#f0dca8' : '#d8b878';
    ctx.fillStyle = edge;
    for (const p of pts) ctx.fillRect(R0(p.x) - 3, R0(p.y) - 2, 6, 5);
    ctx.fillStyle = fill;
    for (const p of pts) ctx.fillRect(R0(p.x) - 2, R0(p.y) - 1, 4, 3);
  }
  drawThread(ctx, pts, active, frac, t) {
    const col = active ? threadColor() : 'rgba(27,16,48,0.55)';
    let acc = 0;
    const total = pts.length - 1, upto = frac * total;
    for (let i = 0; i < total && i < upto; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(seg));
      for (let j = 0; j < n; j++) {
        const d = acc + j;
        if (d % 6 >= 3.5) continue;
        const x = R0(a.x + (b.x - a.x) * j / n), y = R0(a.y + (b.y - a.y) * j / n);
        if (active) { ctx.fillStyle = 'rgba(11,7,22,0.45)'; ctx.fillRect(x, y + 1, 2, 1); ctx.fillStyle = col; }
        else ctx.fillStyle = col;
        ctx.fillRect(x, y, 2, 1);
      }
      acc += seg;
    }
  }
  drawNode(ctx, n, t) {
    const st = this.state(n);
    const r = n.boss ? 11 : n.bonus ? 8 : 7;
    const face = st === 'locked' || st === 'soon' ? '#6a6478' : n.bonus ? '#ffd23f' : WORLDS[n.world - 1].color;
    let ox = 0, oy = 0;
    if (this.denyNode === n && this.denyT > 0) ox = R0(Math.sin(this.denyT * 50) * 2);
    let sc = 1;
    if (this.pop && this.pop.node === n) { const k = clamp(this.pop.t / 0.5, 0, 1); sc = this.pop.t < 0 ? 0.0 : Ease.outBack(k); }
    const img = buttonImage(r, face, st === 'done' ? 'done' : 'open');
    if (sc <= 0.05 && this.pop?.node === n) return;
    const x = R0(n.x) + ox, y = R0(n.y) + oy;
    if (n.boss) ctx.drawImage(castleImage(n.world, st === 'locked' || st === 'soon'), x - 15, y - 33);
    if (sc !== 1) {
      const s = Math.max(0.1, sc), iw = img.width * s, ih = img.height * s;
      ctx.drawImage(img, R0(x - iw / 2), R0(y - ih / 2 + 1), R0(iw), R0(ih));
    } else ctx.drawImage(img, x - r - 1, y - r - 1);
    // ícones por cima
    const icon = (name) => { const im = getImage(name); if (im) ctx.drawImage(im, x - (im.width >> 1), y - (im.height >> 1)); };
    if (st === 'locked' || st === 'soon') icon('icon_lock');
    else if (n.boss) icon(st === 'done' ? 'map_crown' : 'icon_skull');
    else if (n.bonus) icon('icon_star');
    // estrelas encontradas
    if (st === 'done') {
      const f = this.rec(n.id)?.starsFound || [];
      const sy = y + r + 2;
      for (let i = 0; i < 3; i++) { const im = getImage(f[i] ? 'map_star_on' : 'map_star_off'); if (im) ctx.drawImage(im, x - 11 + i * 7, sy); }
    }
    // seleção: anel de pontos girando
    if (n === this.info) {
      const rr = r + 4, k = t * 2.2, sel = this.isOpen(n);
      ctx.fillStyle = sel ? '#fff6b0' : '#c0b8d8';
      for (let i = 0; i < 10; i++) {
        const a = k + i * Math.PI / 5;
        ctx.fillRect(R0(x + Math.cos(a) * rr) - 1, R0(y + Math.sin(a) * rr) - 1, 2, 2);
      }
    }
  }
  drawBonusHint(ctx, b, wd, t) {
    if (!this.worldOpen(wd.id)) return;
    const x = R0(b.x), y = R0(b.y);
    ctx.fillStyle = 'rgba(255,244,220,0.35)';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; if (i % 2) continue; ctx.fillRect(R0(x + Math.cos(a) * 7), R0(y + Math.sin(a) * 7), 1, 1); }
    const txt = `${this.worldStars(wd.id)}/${wd.bonusStarsNeeded}`;
    const im = getImage('map_star_off');
    if (im) ctx.drawImage(im, x - 3, y - 4);
    font.draw(ctx, txt, x, y + 6, { align: 'center', color: '#fff4dc', shadow: '#0b0716' });
  }
  drawStitchedShut(ctx, world, t, a) {
    if (a <= 0) return;
    const x0 = this.patchX(world), y0 = this.patchY(world);
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    const lift = (1 - a) * 10;
    // fileiras de pontos em X atravessando o retalho
    for (const row of [0.3, 0.5, 0.7]) {
      const yy = R0(y0 + PH * row - lift);
      for (let xx = x0 + 18; xx < x0 + PW - 22; xx += 14) {
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = '#120a1e'; ctx.fillRect(xx + i, yy - 3 + i, 2, 1); ctx.fillRect(xx + 6 - i, yy - 3 + i, 2, 1);
          ctx.fillStyle = '#5a4a78'; ctx.fillRect(xx + i, yy - 4 + i, 1, 1);
        }
      }
    }
    const lock = getImage('icon_lock');
    if (lock) ctx.drawImage(lock, R0(x0 + PW / 2 - lock.width), R0(y0 + PH / 2 - lock.height - lift), lock.width * 2, lock.height * 2);
    font.draw(ctx, 'Costurado', R0(x0 + PW / 2), R0(y0 + PH / 2 + lock.height + 2 - lift), { align: 'center', color: '#c0b8d8', shadow: '#0b0716' });
    ctx.restore();
  }
  drawTico(ctx, t) {
    const T = this.tico;
    if (this.sew && this.sew.t > 0 && this.sew.t < this.sew.dur) { /* Tico assiste */ }
    const anim = T.path.length ? 'walk' : 'idle';
    const fr = animFrame('tico', anim, T.t);
    const x = R0(T.x), y = R0(T.y) - 3;
    ctx.fillStyle = 'rgba(11,7,22,0.35)';
    ctx.fillRect(x - 6, y - 1, 12, 2);
    drawSprite(ctx, 'tico', anim, fr, x, y, { flip: T.flip });
    drawCosmetics(ctx, null, anim, fr, x, y, T.flip);
    if (this.poof) {
      const k = this.poof.t / 0.5;
      ctx.fillStyle = `rgba(255,244,220,${1 - k})`;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(R0(this.poof.x + Math.cos(a) * k * 16) - 1, R0(this.poof.y - 10 + Math.sin(a) * k * 12) - 1, 3, 3); }
    }
  }
  drawHeader(ctx, w, t) {
    const wd = WORLDS[this.viewWorld - 1];
    const hw = Math.min(w - MENU_W - 52, 300), hx = R0(MENU_W + (w - MENU_W) / 2 - hw / 2);
    drawPanel(ctx, hx, 2, hw, 18, 'dark');
    let name = `Mundo ${wd.id} - ${wd.name}`;
    if (font.measure(name) > hw - 12) name = `Mundo ${wd.id} - ${wd.short}`;
    if (this.picker) name = 'Escolha o mundo: ' + wd.short;
    font.draw(ctx, name, hx + hw / 2, 7, { align: 'center', color: lighten(wd.color, 0.25), shadow: '#0b0716' });
    const canL = this.viewWorld > 1, canR = this.viewWorld < 5;
    const bob = this.picker ? R0(Math.sin(t * 6) * 1.5) : 0;
    this.rects.arrowL = canL ? { x: hx - 22, y: 2, w: 20, h: 18 } : null;
    this.rects.arrowR = canR ? { x: hx + hw + 2, y: 2, w: 20, h: 18 } : null;
    if (canL) drawButton(ctx, hx - 22 - bob, 2, 20, 18, '', { icon: 'icon_arrow_l', selected: this.picker });
    if (canR) drawButton(ctx, hx + hw + 2 + bob, 2, 20, 18, '', { icon: 'icon_arrow_r', selected: this.picker });
  }
  drawMenu(ctx, w, h, t) {
    // menu recolhido: um único botão "Menu"; aberto: lista com nomes por cima do mapa
    const open = this.focus === 'menu';
    this.rects.menuBtn = { x: 4, y: 4, w: 52, h: 16 };
    if (!open) {
      for (const it of this.menu.items) it.rect = null;
      drawButton(ctx, 4, 4, 52, 16, 'Menu', { icon: 'icon_bag', selected: false });
      return;
    }
    for (const it of this.menu.items) it.label = it.name;
    ctx.fillStyle = 'rgba(11,7,22,0.55)';
    ctx.fillRect(0, 0, w, h);
    const bw = 124, bh = 17, gap = 3, n = this.menu.vis.length;
    const ph = n * (bh + gap) + 18, px = 6, py = 24;
    drawPanel(ctx, px, py, bw + 12, ph, 'dark');
    font.draw(ctx, 'Menu', px + (bw + 12) / 2, py + 4, { align: 'center', color: '#ffd23f' });
    this.menu.layoutV(px + 6 + bw / 2, py + 15, bw, bh, gap);
    this.menu.draw(ctx, t);
    drawButton(ctx, 4, 4, 52, 16, 'Fechar', { icon: 'icon_arrow_l', selected: false });
  }
  drawInfo(ctx, w, h, t) {
    const n = this.info;
    const x = MENU_W + 4, y = h - INFO_H - 4, pw = w - x - 4;
    this.rects.info = { x, y, w: pw, h: INFO_H };
    drawPanel(ctx, x, y, pw, INFO_H, 'dark');
    const st = this.state(n), wd = WORLDS[n.world - 1];
    const data = R.levels.get(n.id);
    const bw = 62, bx = x + pw - bw - 6, by = y + 11;
    const open = st === 'open' || st === 'done';
    this.rects.play = { x: bx, y: by, w: bw, h: 20 };
    drawButton(ctx, bx, by, bw, 20, 'Jogar', { selected: open && this.focus === 'map' && !this.picker, disabled: !open });
    const tw = bx - x - 14;
    // linha 1: selo + nome
    const tag = n.bonus ? `${n.world}-★` : `${n.world}-${n.idx}`;
    const tagW = font.measure(tag) + 8;
    ctx.fillStyle = INK; ctx.fillRect(x + 6, y + 5, tagW, 11);
    ctx.fillStyle = wd.color; ctx.fillRect(x + 7, y + 6, tagW - 2, 9);
    font.draw(ctx, tag, x + 6 + tagW / 2, y + 7, { align: 'center', color: INK });
    const name = st === 'soon' ? 'Em breve' : (data?.name || '???') + (n.boss ? ' (Chefe)' : n.bonus ? ' (Bônus)' : '');
    font.draw(ctx, name, x + 10 + tagW, y + 7, { color: st === 'soon' ? '#a898d8' : '#fff4dc', shadow: '#0b0716', maxWidth: tw - tagW - 4, maxChars: 60 });
    const L2 = y + 19, L3 = y + 30;
    if (st === 'soon') { font.draw(ctx, 'Esta fase ainda está sendo costurada.', x + 8, L2, { color: '#a898d8', maxWidth: tw }); return; }
    if (st === 'locked') {
      const msg = !this.worldOpen(n.world) ? 'Mundo costurado: vença o chefe anterior.' : n.bonus ? `Junte ${wd.bonusStarsNeeded} estrelas do mundo.` : 'Termine a fase anterior para liberar.';
      font.draw(ctx, msg, x + 8, L2, { color: '#a898d8', maxWidth: tw });
      return;
    }
    const rec = this.rec(n.id) || {};
    let cx = x + 8;
    const ic = (name, yy) => { const im = getImage(name); if (!im) return 0; ctx.drawImage(im, cx, yy - 2); cx += im.width + 2; return im.width; };
    for (let i = 0; i < 3; i++) ic(rec.starsFound?.[i] ? 'icon_star' : 'icon_star_empty', L2);
    cx += 4;
    ic('icon_clock', L2);
    font.draw(ctx, rec.bestTime ? fmtTime(rec.bestTime) : '--:--', cx, L2, { color: '#fff4dc' });
    cx += 30;
    if (cx + 30 < bx) {
      ic('icon_secret', L2);
      font.draw(ctx, String(rec.secrets?.length || 0), cx, L2, { color: '#fff4dc' });
    }
    const rating = rec.rating || 0;
    const stars = '★'.repeat(rating);
    const l3 = rating ? `Melhor nota: {#ffd23f}${stars}{/}` : 'Ainda não concluída';
    font.draw(ctx, l3, x + 8, L3, { color: '#a898d8', maxWidth: tw });
    const ws = `Mundo: ${this.worldStars(n.world)}/18`;
    if (x + 8 + font.measure(l3.replace(/\{[^}]*\}/g, '')) + 16 + font.measure(ws) < bx) {
      font.draw(ctx, ws, bx - 6, L3, { align: 'right', color: '#a898d8' });
    }
  }
}

registerScene('worldmap', WorldMapScene);
export { WorldMapScene };
