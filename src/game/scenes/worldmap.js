// =============================================================================
// scenes/worldmap.js — Mapa-múndi do Avesso ('worldmap'), estilo overworld 16 bits.
//
// Um mapa contínuo com 5 regiões lado a lado (map_layout.js), cada uma com
// terreno e decoração próprios pré-renderizados (overworld_art.js). As fases são
// bolinhas (amarela = a vencer, vermelha = vencida) ligadas por caminhos bege
// pontilhados; o chefe é um castelo; a fase secreta é uma estrela num ramo.
// Entre mundos há uma ponte sobre a costura dourada: Tico anda até lá e a câmera
// o acompanha (sem "saltos"). A lista de fases de cada mundo é variável
// (WORLDS[i].levels: 5 normais + dinâmica + chefe); fase não registrada aparece
// como "Em breve".
//
// params (constructor e/ou enter): { focusLevel, justCompleted, worldSelect }
//   focusLevel    → Tico começa nesse nó
//   justCompleted → revela o caminho até a próxima fase; se for chefe, Tico
//                   costura a ponte até o próximo mundo (uma vez, flag 'map_sewn_wN')
//   worldSelect   → começa no modo "Escolha o mundo" (←/→ trocam de mundo)
// Controles: direcionais seguem os caminhos · confirmar = jogar · voltar = menu ·
// Q/E (cycle) = próximo mundo · toque: nó, setas do cabeçalho, "Jogar", "Menu".
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { audio, hasSong } from '../../engine/audio.js';
import font from '../../engine/font.js';
import { drawSprite, animFrame, getImage, defineImage } from '../../engine/sprites.js';
import { clamp, damp, lerp, Ease, lighten, smoothstep } from '../../engine/util.js';
import { R, registerScene, makeScene } from '../registry.js';
import { WORLDS } from '../worlds.js';
import { drawPanel, drawButton } from '../art/ui_kit.js';
import { drawCosmetics } from '../art/cosmetics.js';
import { ButtonList, inRect, fmtTime } from './menus_basic.js';
import { LevelScene } from './level_scene.js';
import { RW, RH, LAYOUT, nodePos, linkWaypoints } from './map_layout.js';
import {
  regionArt, regionReady, drawBackdrop, seamImage, roadsImage, drawRoadPartial, drawRegionAnims,
  nodeImage, drawCastle, lockedOverlay,
} from './overworld_art.js';

const INK = '#1b1030';
const HEADER = 22, INFO_H = 42;
const R0 = Math.round;
const NW = WORLDS.length;

// ------------------------------------------------------------ imagens fixas
defineImage('map_star_on', 7, 7, (pc) => {
  pc.ascii(['..L..', '.LYY.', 'YYYYD', '.YYD.', '.D.D.'], { L: '#fff6b0', Y: '#ffd23f', D: '#c88a10' }, 1, 1); pc.outline(INK);
});
defineImage('map_star_off', 7, 7, (pc) => {
  pc.ascii(['..G..', '.GGG.', 'GGGGG', '.GGG.', '.G.G.'], { G: '#4a4060' }, 1, 1); pc.outline(INK);
});
defineImage('map_castle_tag', 9, 8, (pc) => {
  pc.ascii(['B.B.B.B', 'BBBBBBB', 'BBBDBBB', 'BBDDDBB', 'BBDDDBB'], { B: '#1b1030', D: '#fff4dc' }, 1, 1);
});

/** Polilinha → pontos a cada ~1 px (inclui as pontas). */
function sample(poly) {
  const pts = [{ x: poly[0][0], y: poly[0][1] }];
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let k = 1; k <= n; k++) pts.push({ x: ax + (bx - ax) * k / n, y: ay + (by - ay) * k / n });
  }
  return pts;
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
    this.buildGraph();
    this.focus = 'map';
    this.picker = !!P.worldSelect;
    this.leaving = false;
    this.inputLock = 0.2;
    this.denyNode = null; this.denyT = 0;
    this.pop = null; this.sew = null; this.unlockFx = {}; this.poof = null; this.peek = null; this.pan = null;
    this.rects = {};
    this.press = null;
    this.playOnArrive = false;
    // ponto de partida do Tico (sempre um nó aberto)
    const prog = save.data.progress;
    let start = this.byId.get(P.justCompleted) || this.byId.get(P.focusLevel) || this.byId.get(prog.lastLevel);
    if (!start || !this.isOpen(start)) start = this.furthestOpen(this.picker ? this.maxWorld() : (start?.world || prog.currentWorld || 1));
    this.tico = { x: start.x, y: start.y, at: start, dest: start, link: null, s: 0, queue: [], speed: 110, flip: false, t: 0 };
    this.info = start;
    this.startAnims();
    // pré-renderiza a região inicial já (as outras vão sendo feitas aos poucos)
    this.ensureRegion(start.world);
    const ct = this.camTarget();
    this.camX = ct.x; this.camY = ct.y;
    this.menu = new ButtonList([
      { label: '', name: 'Inventário', icon: 'icon_bag', action: () => this.openSub('inventory') },
      { label: '', name: 'Habilidades', icon: 'icon_ab_stitch', action: () => this.openSub('skilltree') },
      { label: '', name: 'Memórias', icon: 'icon_book', action: () => this.openSub('memories') },
      { label: '', name: 'Guarda-roupa', icon: 'icon_shirt', action: () => this.openSub('wardrobe') },
      { label: '', name: 'Configurações', icon: 'icon_gear', action: () => this.openSub('settings') },
      { label: '', name: 'Título', icon: 'icon_arrow_l', sfx: 'ui_back', action: () => this.toTitle() },
    ], { cursor: false });
    this.music();
  }
  music() { if (hasSong('worldmap')) audio.playMusic('worldmap'); }
  resume() { this.music(); this.press = null; this.inputLock = 0.2; this.focus = 'map'; }

  // ------------------------------------------------------------- grafo
  buildGraph() {
    this.nodes = []; this.chain = []; this.byId = new Map(); this.bonus = {}; this.first = {}; this.last = {};
    this.links = new Map();
    const polys = []; // {a, b, poly(global)}
    for (const wd of WORLDS) {
      const ox = (wd.id - 1) * RW, n = wd.levels.length, L = LAYOUT[wd.id];
      const G = ([x, y]) => [ox + x, y];
      const ws = [];
      wd.levels.forEach((id, i) => {
        const [lx, ly] = nodePos(wd.id, i, n);
        const node = { id, world: wd.id, li: i, idx: i + 1, boss: i === n - 1, dyn: n >= 7 && i === n - 2, x: ox + lx, y: ly };
        this.nodes.push(node); this.chain.push(node); this.byId.set(id, node); ws.push(node);
      });
      this.first[wd.id] = ws[0]; this.last[wd.id] = ws[ws.length - 1];
      for (let i = 0; i < ws.length - 1; i++) {
        polys.push({ a: ws[i], b: ws[i + 1], poly: [[ws[i].x, ws[i].y], ...linkWaypoints(wd.id, i, n).map(G), [ws[i + 1].x, ws[i + 1].y]] });
      }
      if (wd.bonus && L.bonus) {
        const from = ws[clamp(L.bonus.from, 0, ws.length - 2)];
        const b = { id: wd.bonus, world: wd.id, li: -1, idx: 0, bonus: true, parent: from, x: ox + L.bonus.at[0], y: L.bonus.at[1] };
        from.bonusNode = b;
        this.nodes.push(b); this.byId.set(b.id, b); this.bonus[wd.id] = b;
        polys.push({ a: from, b, poly: [[from.x, from.y], ...(L.bonus.via || []).map(G), [b.x, b.y]] });
      }
    }
    // pontes entre mundos: castelo → borda (exit) → borda (entry do próximo) → 1ª fase
    for (let w = 1; w < NW; w++) {
      const a = this.last[w], b = this.first[w + 1];
      const ex = (LAYOUT[w].exit || []).map(([x, y]) => [(w - 1) * RW + x, y]);
      const en = (LAYOUT[w + 1].entry || []).map(([x, y]) => [w * RW + x, y]);
      polys.push({ a, b, poly: [[a.x, a.y], ...ex, ...en, [b.x, b.y]], cross: true });
    }
    for (const p of polys) {
      // remove pontos repetidos consecutivos
      const poly = p.poly.filter((q, i, arr) => i === 0 || q[0] !== arr[i - 1][0] || q[1] !== arr[i - 1][1]);
      const pts = sample(poly);
      const L = { a: p.a, b: p.b, poly, pts, len: pts.length - 1, cross: !!p.cross };
      this.links.set(p.a.id + '>' + p.b.id, L);
    }
    this.linkList = [...this.links.values()];
    // geometria local de cada região (para a arte evitar os caminhos)
    this.geo = {};
    for (const wd of WORLDS) {
      const ox = (wd.id - 1) * RW;
      const segs = [];
      for (const L of this.linkList) {
        for (let i = 0; i < L.poly.length - 1; i++) {
          const [ax, ay] = L.poly[i], [bx, by] = L.poly[i + 1];
          if (Math.max(ax, bx) < ox - 20 || Math.min(ax, bx) > ox + RW + 20) continue;
          segs.push([ax - ox, ay, bx - ox, by]);
        }
      }
      const nodes = this.nodes.filter((n) => n.world === wd.id).map((n) => [n.x - ox, n.y, n.boss ? 'boss' : n.bonus ? 'bonus' : 'level']);
      const boss = this.last[wd.id];
      this.geo[wd.id] = { segs, nodes, boss: [boss.x - ox, boss.y] };
    }
  }
  getLink(a, b) {
    const L = this.links.get(a.id + '>' + b.id);
    if (L) return { from: a, to: b, pts: L.pts, len: L.len, src: L };
    const R2 = this.links.get(b.id + '>' + a.id);
    if (R2) { if (!R2.rev) R2.rev = R2.pts.slice().reverse(); return { from: a, to: b, pts: R2.rev, len: R2.len, src: R2 }; }
    const pts = sample([[a.x, a.y], [b.x, b.y]]);   // segurança: nunca deveria acontecer
    return { from: a, to: b, pts, len: pts.length - 1, src: null };
  }
  ensureRegion(w) { return regionArt(w, this.geo[w]); }

  // ------------------------------------------------------------- estado
  rec(id) { return save.levelRecord(id); }
  exists(n) { return !!n && R.levels.has(n.id); }
  worldOpen(w) { return w === 1 || save.isWorldUnlocked(w) || this.debugAll; }
  worldLevels(w) { return WORLDS[w - 1].levels; }
  worldStars(w) {
    let s = 0;
    for (const id of this.worldLevels(w)) for (const f of this.rec(id)?.starsFound || []) if (f) s++;
    return s;
  }
  worldStarsMax(w) { return this.worldLevels(w).filter((id) => R.levels.has(id)).length * 3; }
  bonusShown(w) {
    return this.debugAll || this.worldStars(w) >= (WORLDS[w - 1].bonusStarsNeeded || 10) || save.data.progress.bonusUnlocked.includes(w);
  }
  /** Mundo ainda "costurado" visualmente (inclui o que está sendo costurado agora). */
  worldShut(w) { return !this.worldOpen(w) || (this.sew && !this.sew.crossed && this.sew.to.world === w); }
  isOpen(n) {
    if (!n || !this.exists(n) || this.worldShut(n.world)) return false;
    if (n.bonus) return this.bonusShown(n.world);
    if (this.debugAll) return true;
    const list = this.worldLevels(n.world);
    let i = n.li - 1;
    while (i >= 0 && !R.levels.has(list[i])) i--;   // pula fases "em breve"
    if (i < 0) return true;
    return !!this.rec(list[i])?.done;
  }
  /** 'soon' | 'locked' | 'open' | 'done' */
  state(n) {
    if (!this.exists(n)) return 'soon';
    if (!this.isOpen(n)) return 'locked';
    return this.rec(n.id)?.done ? 'done' : 'open';
  }
  maxWorld() { let m = 1; for (let w = 1; w <= NW; w++) if (this.worldOpen(w) && this.chain.some((n) => n.world === w && this.isOpen(n))) m = w; return m; }
  furthestOpen(world) {
    const list = this.chain.filter((n) => n.world === world && this.isOpen(n));
    const notDone = list.find((n) => !this.rec(n.id)?.done);
    return notDone || list[list.length - 1] || this.chain.find((n) => this.isOpen(n)) || this.chain[0];
  }
  linkOpen(L) {
    const dest = L.b; // b é sempre o nó "de depois" (cadeia) ou o bônus
    if (this.pop && this.pop.link === L && !this.pop.revealed) return false;
    return this.isOpen(dest) && this.isOpen(L.a);
  }

  // ------------------------------------------------------------- movimento
  route(a, b) {
    if (a === b) return [a];
    const seq = [a];
    let s = a;
    if (a.bonus) { s = a.parent; seq.push(s); }
    const e = b.bonus ? b.parent : b;
    const i0 = this.chain.indexOf(s), i1 = this.chain.indexOf(e);
    const st = i1 >= i0 ? 1 : -1;
    for (let i = i0 + st; st > 0 ? i <= i1 : i >= i1; i += st) seq.push(this.chain[i]);
    if (b.bonus && seq[seq.length - 1] !== b) seq.push(b);
    return seq;
  }
  /** Anda até `target` seguindo os caminhos; pode inverter no meio de um trecho. */
  walkTo(target, playAfter = false, speed = 0) {
    const T = this.tico;
    if (!target) return;
    this.peek = null;
    this.info = target;
    if (!T.link) {
      if (target === T.at) { if (playAfter) this.play(target); return; }
      T.queue = this.route(T.at, target).slice(1);
      this.nextLink();
    } else {
      const A = T.link.from, B = T.link.to;
      if (target === B) T.queue = [];
      else if (target === A) { this.reverseLink(); T.queue = []; }
      else {
        const sb = this.route(B, target);
        if (sb[1] === A) { this.reverseLink(); T.queue = this.route(A, target).slice(1); }
        else T.queue = sb.slice(1);
      }
    }
    T.dest = target;
    this.playOnArrive = playAfter;
    let rem = T.link ? T.link.len - T.s : 0, at = T.link ? T.link.to : T.at;
    for (const q of T.queue) { rem += this.getLink(at, q).len; at = q; }
    T.speed = speed || (rem > 420 ? 260 : rem > 180 ? 160 : 110);
  }
  nextLink() {
    const T = this.tico;
    if (!T.queue.length) { T.link = null; return false; }
    const nx = T.queue.shift();
    T.link = this.getLink(T.at, nx); T.s = 0;
    return true;
  }
  reverseLink() {
    const T = this.tico, L = T.link;
    if (!L) return;
    T.link = this.getLink(L.to, L.from);
    T.s = Math.max(0, L.len - T.s);
  }
  stopAt(n) { // teleporta (troca de mundo pelas setas)
    const T = this.tico;
    T.link = null; T.queue = []; T.at = T.dest = n; T.x = n.x; T.y = n.y; T.s = 0;
    this.playOnArrive = false;
  }
  updateTico(dt) {
    const T = this.tico;
    T.t += dt;
    if (!T.link) { T.x = T.at.x; T.y = T.at.y; return; }
    T.s += T.speed * dt;
    let guard = 0;
    while (T.link && T.s >= T.link.len && guard++ < 50) {
      const over = T.s - T.link.len;
      T.at = T.link.to;
      if (this.nextLink()) T.s = over;
      else { T.link = null; T.s = 0; this.arrive(); }
    }
    if (T.link) {
      const P = T.link.pts, i = Math.min(P.length - 2, Math.floor(T.s)), k = T.s - i;
      const p = P[Math.max(0, i)], q = P[Math.max(0, i) + 1] || p;
      T.x = p.x + (q.x - p.x) * k; T.y = p.y + (q.y - p.y) * k;
      const ahead = P[Math.min(P.length - 1, i + 3)];
      if (Math.abs(ahead.x - p.x) > 0.3) T.flip = ahead.x < p.x;
    } else { T.x = T.at.x; T.y = T.at.y; }
  }
  arrive() {
    audio.sfx('land', { vol: 0.35 });
    if (this.playOnArrive) { this.playOnArrive = false; if (this.isOpen(this.tico.at)) this.play(this.tico.at); }
  }
  get moving() { return !!this.tico.link; }
  get curWorld() { return clamp(Math.floor(this.tico.x / RW) + 1, 1, NW); }
  get viewWorld() { return this.peek || this.curWorld; }

  // ------------------------------------------------------------- animações
  startAnims() {
    const jc = this.params.justCompleted;
    const n = jc && this.byId.get(jc);
    if (!n || n.bonus) return;
    if (n.boss && n.world < NW) {
      const nw = n.world + 1, flag = 'map_sewn_w' + nw, to = this.first[nw];
      if (save.isWorldUnlocked(nw) && !save.flag(flag)) {
        save.setFlag(flag); save.commit();
        if (this.exists(to) && this.tico.at === n) { this.sew = { from: n, to, t: 0, crossed: false, started: false }; return; }
      }
    }
    // próxima fase aberta do mesmo mundo (pulando "em breve")
    const i = this.chain.indexOf(n);
    let next = null;
    for (let j = i + 1; j < this.chain.length && this.chain[j].world === n.world; j++) { if (this.exists(this.chain[j])) { next = this.chain[j]; break; } }
    if (next && this.isOpen(next) && !this.rec(next.id)?.done) {
      const link = this.links.get(this.chain[i].id + '>' + this.chain[i + 1].id);
      this.pop = { node: next, from: n, link: next === this.chain[i + 1] ? link : null, t: -0.35, revealed: !link || next !== this.chain[i + 1], walk: true };
    }
  }
  updateAnims(dt) {
    const P = this.pop;
    if (P) {
      P.t += dt;
      if (P.t > 0 && !P.sfx) { P.sfx = true; audio.sfx('stitch_connect'); }
      if (P.t >= 0.6 && !P.revealed) { P.revealed = true; audio.sfx('ui_select', { vol: 0.6 }); }
      if (P.t > 1.1 && P.walk) {
        P.walk = false;
        const T = this.tico;
        if (!T.link && T.at === P.from && this.focus === 'map' && !this.leaving) this.walkTo(P.node);
      }
      if (P.t > 1.3) this.pop = null;
    }
    const S = this.sew;
    if (S) {
      S.t += dt;
      const T = this.tico;
      if (!S.started && S.t > 0.6) { S.started = true; audio.sfx('stitch_cast'); this.walkTo(S.to, false, 80); }
      if (S.started && T.link && Math.floor(S.t * 7) !== Math.floor((S.t - dt) * 7)) audio.sfx('step', { vol: 0.2, pitch: 1.6 });
      if (!S.crossed && T.x >= (S.to.world - 1) * RW) { S.crossed = true; this.unlockFx[S.to.world] = 0; audio.sfx('ability_get'); }
      const done = S.started && !T.link && T.at === S.to;
      if (done || S.t > 20) {
        if (!done) this.stopAt(S.to);
        S.crossed = true;
        this.sew = null;
        this.info = S.to;
        this.pop = { node: S.to, from: S.to, link: null, t: 0.6, revealed: true, walk: false, sfx: true };
      } else if (S.started && !T.link) { // algo interrompeu a caminhada: retoma
        this.walkTo(S.to, false, 80);
      }
    }
    for (const k of Object.keys(this.unlockFx)) { this.unlockFx[k] += dt; if (this.unlockFx[k] > 1.2) delete this.unlockFx[k]; }
    if (this.poof) { this.poof.t += dt; if (this.poof.t > 0.5) this.poof = null; }
    this.denyT = Math.max(0, this.denyT - dt);
  }

  // ------------------------------------------------------------- ações
  play(n) {
    if (this.leaving || !n || !this.isOpen(n) || this.manager?.transitioning || this.sew) { audio.sfx('ui_denied'); this.deny(n); return; }
    this.leaving = true;
    this.playOnArrive = false;
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
  deny(n) { if (n) { this.denyNode = n; this.denyT = 0.35; } }
  openSub(name) {
    this.focus = 'map';
    const s = makeScene(name, { from: 'map', onClose: null });
    if (!s) { audio.sfx('ui_denied'); return; }
    audio.sfx('ui_open');
    this.manager.push(s, { onClose: null, from: 'map' });
  }
  toTitle() {
    if (this.leaving) return;
    const t = makeScene('title');
    if (t) { this.leaving = true; game.scenes.go(t, {}, { transition: 'fade' }); }
  }
  startPan() { this.pan = { x: this.camX, y: this.camY, t: 0, dur: 0 }; }
  /** Vai para o mundo w: Tico salta para lá se houver fase aberta; senão a câmera só "espia". */
  gotoWorld(w) {
    if (w < 1 || w > NW) return false;
    if (this.pop) this.pop.walk = false;
    const has = this.worldOpen(w) && this.chain.some((n) => n.world === w && this.isOpen(n));
    if (!has) {
      this.peek = w === this.curWorld ? null : w;
      this.info = this.peek ? this.first[w] : this.tico.dest;
      audio.sfx('ui_move');
      this.startPan();
      return true;
    }
    const n = this.furthestOpen(w), T = this.tico;
    this.peek = null;
    this.info = n;
    if (T.at === n && !T.link) { this.startPan(); return true; }
    this.stopAt(n);
    this.poof = { x: n.x, y: n.y, t: 0 };
    audio.sfx('whoosh', { vol: 0.5 });
    this.startPan();
    return true;
  }
  switchWorld(dir) { return this.gotoWorld(this.viewWorld + dir); }
  /** Vizinhos de um nó: [{ node (alvo efetivo), dir:{x,y} (direção inicial do caminho) }]. */
  neighbors(cur) {
    const out = [];
    const addVia = (imm, target) => {
      if (!imm || !target) return;
      const L = this.getLink(cur, imm), p = L.pts[0], q = L.pts[Math.min(L.len, 10)];
      const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      out.push({ node: target, imm, dir: { x: (q.x - p.x) / d, y: (q.y - p.y) / d } });
    };
    if (cur.bonus) { addVia(cur.parent, cur.parent); return out; }
    const i = this.chain.indexOf(cur);
    for (const st of [1, -1]) {
      const imm = this.chain[i + st];
      if (!imm) continue;
      let j = i + st;
      while (this.chain[j] && !this.exists(this.chain[j])) j += st;   // atravessa fases "em breve"
      const tgt = this.chain[j] && this.isOpen(this.chain[j]) ? this.chain[j] : imm;
      addVia(imm, tgt);
      out[out.length - 1].chainDir = st;
    }
    if (cur.bonusNode && this.bonusShown(cur.world)) { addVia(cur.bonusNode, cur.bonusNode); out[out.length - 1].bonus = true; }
    return out;
  }
  /** Direcional: segue o caminho que sai na direção apertada (como nos mapas clássicos). */
  dirMove(dx, dy) {
    if (this.peek) { this.peek = null; this.info = this.tico.dest; this.startPan(); return; }
    const T = this.tico, cur = T.link ? T.dest : T.at;
    const nb = this.neighbors(cur);
    let best = null, bd = 0.55;
    for (const c of nb) { const d = c.dir.x * dx + c.dir.y * dy; if (d > bd) { bd = d; best = c; } }
    if (!best) { // reserva: → próxima, ← anterior, ↑/↓ ramo bônus
      if (dx) best = nb.find((c) => c.chainDir === dx) || (cur.bonus ? nb[0] : null);
      else best = nb.find((c) => c.bonus) || (cur.bonus ? nb[0] : null);
    }
    if (!best) return;
    if (this.pop) this.pop.walk = false;
    const target = best.node;
    if (this.isOpen(target)) { audio.sfx('ui_move'); this.walkTo(target); }
    else { audio.sfx('ui_denied'); this.deny(target); this.info = target; }
  }

  // ------------------------------------------------------------- câmera
  mapArea() { const { w, h } = game.view; return { top: HEADER, h: h - HEADER - INFO_H - 6, w, vh: h }; }
  camTarget() {
    const A = this.mapArea(), w = A.w, T = this.tico;
    const fx = this.peek ? (this.peek - 1) * RW + RW / 2 : T.x;
    const fy = this.peek ? RH / 2 : T.y - 8;
    let tx = fx - w / 2, ty = fy - (A.top + A.h / 2);
    const r = clamp(Math.floor(fx / RW), 0, NW - 1), x0 = r * RW, x1 = x0 + RW;
    const framed = RW + 32 >= w ? clamp(tx, x0 - 16, x1 + 16 - w) : x0 + RW / 2 - w / 2;
    // perto da costura a câmera segue o Tico livremente; dentro da região, enquadra a região
    const k = this.peek ? 1 : smoothstep(clamp((Math.min(fx - x0, x1 - fx) - 4) / 30, 0, 1));
    tx = lerp(tx, framed, k);
    tx = clamp(tx, -16, NW * RW + 16 - w);
    const yMin = -(HEADER - 4), yMax = RH - A.vh + INFO_H + 4;
    ty = yMax > yMin ? clamp(ty, yMin, yMax) : (yMin + yMax) / 2;
    return { x: tx, y: ty };
  }
  updateCamera(dt) {
    const ct = this.camTarget();
    const P = this.pan;
    if (P) {
      if (!P.dur) P.dur = clamp(Math.hypot(ct.x - P.x, ct.y - P.y) / 700, 0.3, 0.9);
      P.t += dt;
      const k = Ease.inOutCubic(clamp(P.t / P.dur, 0, 1));
      this.camX = lerp(P.x, ct.x, k); this.camY = lerp(P.y, ct.y, k);
      if (P.t >= P.dur) this.pan = null;
    } else {
      this.camX = damp(this.camX, ct.x, 7, dt); this.camY = damp(this.camY, ct.y, 7, dt);
    }
  }

  // ------------------------------------------------------------- update
  update(dt) {
    this.updateAnims(dt);
    this.updateTico(dt);
    this.updateCamera(dt);
    // pré-renderiza uma região por quadro (as próximas da vista primeiro)
    const vw = this.viewWorld;
    for (const w of [vw, vw + 1, vw - 1, vw + 2, vw - 2, 1, 2, 3, 4, 5]) {
      if (w >= 1 && w <= NW && !regionReady(w)) { this.ensureRegion(w); break; }
    }
    this.inputLock = Math.max(0, this.inputLock - dt);
    if (this.leaving || this.manager?.transitioning || this.inputLock > 0) { this.press = null; return; }
    if (this.focus === 'menu') { this.updateMenu(dt); return; }
    if (this.sew) { // costurando a ponte: tocar/confirmar acelera
      if (this.sew.started && (input.pressed('confirm') || input.pointer.pressed)) { input.consume('confirm'); input.consume('jump'); this.tico.speed = 220; }
      return;
    }
    this.handlePointer();
    if (this.leaving || this.focus === 'menu') return;
    if (this.picker) {
      if (input.pressed('left')) { if (!this.switchWorld(-1)) audio.sfx('ui_denied'); }
      else if (input.pressed('right')) { if (!this.switchWorld(1)) audio.sfx('ui_denied'); }
      if (input.pressed('confirm') || input.pressed('down')) {
        input.consume('confirm'); input.consume('jump');
        if (this.peek) { audio.sfx('ui_denied'); this.deny(this.info); } else { audio.sfx('ui_select'); this.picker = false; }
      }
      if (input.pressed('back')) { input.consume('back'); this.picker = false; this.openMenu(); }
      return;
    }
    if (input.pressed('right')) this.dirMove(1, 0);
    else if (input.pressed('left')) this.dirMove(-1, 0);
    else if (input.pressed('up')) this.dirMove(0, -1);
    else if (input.pressed('down')) this.dirMove(0, 1);
    if (input.pressed('cycle')) { if (this.pop) this.pop.walk = false; this.gotoWorld(this.viewWorld >= NW ? 1 : this.viewWorld + 1); }
    if (input.pressed('confirm')) {
      input.consume('confirm'); input.consume('jump');
      this.confirmSelection();
    }
    if (input.pressed('back')) { input.consume('back'); this.openMenu(); }
  }
  confirmSelection() {
    const T = this.tico;
    if (this.peek) { audio.sfx('ui_denied'); this.deny(this.info); return; }
    if (T.link) { if (this.isOpen(T.dest)) { this.playOnArrive = true; audio.sfx('ui_select'); } return; }
    const n = this.info;
    if (n !== T.at && this.isOpen(n)) { audio.sfx('ui_select'); this.walkTo(n, true); return; }
    if (this.isOpen(T.at)) this.play(T.at); else { audio.sfx('ui_denied'); this.deny(T.at); }
  }
  openMenu() { this.focus = 'menu'; this.menu.sel = 0; this.menu.pressIdx = -1; this.press = null; audio.sfx('ui_open'); }
  closeMenu() { this.focus = 'map'; this.press = null; audio.sfx('ui_back'); }
  updateMenu(dt) {
    if (input.pressed('back') || input.pressed('cycle') || input.pressed('right')) {
      input.consume('back'); input.consume('right'); this.closeMenu(); return;
    }
    const p = input.pointer;
    const onItem = this.menu.hit(p) >= 0;
    const onBtn = inRect(p, this.rects.menuBtn);
    if (p.pressed) this.press = onBtn ? { k: 'menuBtn' } : onItem || inRect(p, this.rects.menuPanel) ? { k: 'panel' } : { k: 'outside' };
    if (p.released) {
      const a = this.press; this.press = null;
      if (a && a.k === 'menuBtn' && onBtn) { this.closeMenu(); return; }
      if (a && a.k === 'outside' && !onItem && !inRect(p, this.rects.menuPanel)) { this.closeMenu(); return; }
    }
    this.menu.update(dt);   // itens: ponteiro + teclado (só aqui → sem disparo duplo)
  }
  handlePointer() {
    const p = input.pointer;
    const hitAt = () => {
      const r = this.rects;
      if (inRect(p, r.menuBtn)) return { k: 'menuBtn' };
      if (inRect(p, r.arrowL)) return { k: 'arrow', d: -1 };
      if (inRect(p, r.arrowR)) return { k: 'arrow', d: 1 };
      if (inRect(p, r.play)) return { k: 'play' };
      if (inRect(p, r.info) || inRect(p, r.header) || inRect(p, r.stats)) return { k: 'ui' };
      const mx = p.x + this.camX, my = p.y + this.camY;
      let best = null, bd = 13;
      for (const n of this.nodes) {
        if (this.worldShut(n.world) || (n.bonus && !this.bonusShown(n.world))) continue;
        const d = Math.hypot(n.x - mx, n.y - my - (n.boss ? 4 : 0));
        if (d < bd) { bd = d; best = n; }
      }
      return best ? { k: 'node', n: best } : null;
    };
    if (p.pressed) this.press = hitAt();
    if (!p.released) return;
    const a = this.press, b = hitAt();
    this.press = null;
    if (!a || !b || a.k !== b.k || a.n !== b.n || a.d !== b.d) return;
    if (b.k === 'menuBtn') { this.picker = false; this.openMenu(); }
    else if (b.k === 'arrow') { if (!this.switchWorld(b.d)) audio.sfx('ui_denied'); }
    else if (b.k === 'play') {
      const n = this.info, T = this.tico;
      if (this.peek || !this.isOpen(n)) { audio.sfx('ui_denied'); this.deny(n); return; }
      this.picker = false;
      if (n === T.at && !T.link) this.play(n);
      else { audio.sfx('ui_select'); this.walkTo(n, true); }
    } else if (b.k === 'node') {
      this.picker = false;
      if (this.pop) this.pop.walk = false;
      const n = b.n, T = this.tico;
      if (!this.isOpen(n)) { audio.sfx('ui_denied'); this.deny(n); this.info = n; this.peek = null; return; }
      if (n === T.at && !T.link && this.info === n) this.play(n);
      else { audio.sfx('ui_move'); this.walkTo(n); }
    }
  }

  // ------------------------------------------------------------- desenho
  draw(ctx) {
    const { w, h } = game.view, t = this.time;
    const cx = R0(this.camX), cy = R0(this.camY);
    const vis = [];
    for (let wd = 1; wd <= NW; wd++) { const x0 = (wd - 1) * RW; if (x0 < cx + w && x0 + RW > cx) vis.push(wd); }
    // fundo (mar / vazio / cosmos) de cada região visível
    ctx.fillStyle = '#0b0716'; ctx.fillRect(0, 0, w, h);
    for (const wd of vis) {
      const x0 = (wd - 1) * RW - cx;
      drawBackdrop(ctx, wd, wd === 1 ? 0 : Math.max(0, x0), wd === NW ? w : Math.min(w, x0 + RW), h, this.camX, this.camY, t);
    }
    ctx.save();
    ctx.translate(-cx, -cy);
    const fr = Math.floor(t * 1.6) % 2;
    for (const wd of vis) {
      const reg = this.ensureRegion(wd), ox = (wd - 1) * RW;
      ctx.drawImage(reg.frames[fr], ox, 0);
      drawRegionAnims(ctx, wd, reg, ox, t, 'base');
    }
    const seam = seamImage();
    for (let k = 1; k < NW; k++) { const x = k * RW; if (x > cx - 8 && x < cx + w + 8) ctx.drawImage(seam, x - 6, 0); }
    for (const wd of vis) this.drawRoads(ctx, wd);
    this.drawPartialRoads(ctx, t);
    for (const wd of vis) this.drawShut(ctx, wd, t);
    this.drawNodes(ctx, vis, t);
    this.drawTico(ctx, t);
    for (const wd of vis) { const reg = this.ensureRegion(wd), ox = (wd - 1) * RW; drawRegionAnims(ctx, wd, reg, ox, t, 'top'); }
    ctx.restore();
    this.drawHeader(ctx, w, t);
    this.drawStats(ctx, w);
    this.drawInfo(ctx, w, h, t);
    this.drawMenu(ctx, w, h, t);
  }
  drawRoads(ctx, wd) {
    const ox = (wd - 1) * RW;
    const links = [];
    let key = '';
    for (const L of this.linkList) {
      if (Math.max(L.a.x, L.b.x) < ox - 40 && !L.cross) continue;
      const lo = Math.min(...L.poly.map((q) => q[0])), hi = Math.max(...L.poly.map((q) => q[0]));
      if (hi < ox - 8 || lo > ox + RW + 8) continue;
      if (L.b.bonus && !this.bonusShown(wd)) continue;
      const open = this.linkOpen(L);
      if (!L.local) L.local = {};
      if (!L.local[wd]) L.local[wd] = L.pts.filter((q) => q.x >= ox - 8 && q.x <= ox + RW + 8).map((q) => ({ x: q.x - ox, y: q.y }));
      if (!L.local[wd].length) continue;
      links.push({ pts: L.local[wd], open });
      key += open ? '1' : '0';
    }
    ctx.drawImage(roadsImage(wd, key, links, this.ensureRegion(wd)), ox, 0);
  }
  drawPartialRoads(ctx, t) {
    const P = this.pop;
    if (P && P.link && !P.revealed && P.t > 0) drawRoadPartial(ctx, P.node.world, P.link.pts, P.t / 0.6, 0);
    const S = this.sew, T = this.tico;
    if (S && S.started && T.link && T.link.to === S.to) {
      const head = Math.min(T.link.len, T.s + 12);
      drawRoadPartial(ctx, S.from.world, T.link.pts, head / T.link.len, 0);
      // agulha costurando à frente do Tico
      const P2 = T.link.pts, i = Math.min(P2.length - 2, Math.floor(head)), p = P2[i], q = P2[i + 1];
      const d = Math.hypot(q.x - p.x, q.y - p.y) || 1, ux = (q.x - p.x) / d, uy = (q.y - p.y) / d;
      for (let j = 0; j < 10; j++) { ctx.fillStyle = j < 2 ? '#ffffff' : j > 7 ? '#8a94a8' : '#d8e2ee'; ctx.fillRect(R0(p.x + ux * (4 - j)), R0(p.y + uy * (4 - j)) - 6, 2, 2); }
      ctx.fillStyle = '#ffd23f';
      for (let j = 0; j < 6; j++) ctx.fillRect(R0(p.x - ux * (6 + j * 2)), R0(p.y - uy * (6 + j * 2)) - 5 + (j % 2), 1, 1);
      if (Math.floor(t * 10) % 2) { ctx.fillStyle = '#fff6b0'; ctx.fillRect(R0(p.x + ux * 7) - 1, R0(p.y + uy * 7) - 7, 2, 2); }
    }
  }
  drawShut(ctx, wd, t) {
    const fx = this.unlockFx[wd];
    if (!this.worldShut(wd) && fx == null) return;
    const a = fx != null && !this.worldShut(wd) ? 1 - clamp(fx / 1.0, 0, 1) : 1;
    if (a <= 0) return;
    const ox = (wd - 1) * RW, lift = (1 - a) * 10;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(lockedOverlay(), ox, -lift);
    const lock = getImage('icon_lock');
    const cx = ox + RW / 2, cy = RH / 2 - lift;
    drawPanel(ctx, cx - 62, cy - 22, 124, 44, 'dark');
    if (lock) ctx.drawImage(lock, R0(cx - lock.width), R0(cy - 18), lock.width * 2, lock.height * 2);
    font.draw(ctx, 'Costurado', R0(cx), R0(cy + 2), { align: 'center', color: '#ffd23f', shadow: '#0b0716' });
    font.draw(ctx, 'Vença o chefe anterior', R0(cx), R0(cy + 12), { align: 'center', color: '#c0b8d8', shadow: '#0b0716' });
    ctx.restore();
  }
  drawNodes(ctx, vis, t) {
    const list = this.nodes.filter((n) => vis.includes(n.world) && !this.worldShut(n.world) && !(n.bonus && !this.bonusShown(n.world)));
    list.sort((a, b) => a.y - b.y);
    for (const n of list) this.drawNode(ctx, n, t);
    // dica do bônus ainda escondido
    for (const wd of vis) {
      const b = this.bonus[wd];
      if (b && !this.worldShut(wd) && !this.bonusShown(wd)) this.drawBonusHint(ctx, b, WORLDS[wd - 1]);
    }
  }
  drawNode(ctx, n, t) {
    let st = this.state(n);
    const P = this.pop;
    if (P && P.node === n && !P.revealed) st = 'locked';
    let ox = 0;
    if (this.denyNode === n && this.denyT > 0) ox = R0(Math.sin(this.denyT * 50) * 2);
    const x = R0(n.x) + ox, y = R0(n.y);
    if (n.boss) drawCastle(ctx, n.world, x, y + 3, st, t);
    const kind = n.bonus ? 'bonus' : n.dyn ? 'dyn' : 'level';
    const img = nodeImage(kind, st, Math.floor(t * 2 + n.x * 0.01) % 2);
    let sc = 1;
    if (P && P.node === n && P.revealed) sc = Ease.outBack(clamp((P.t - 0.6) / 0.4, 0, 1));
    if (sc < 0.999) {
      const k = 0.3 + sc * 0.7, iw = img.width * k, ih = img.height * k;
      ctx.drawImage(img, R0(x - iw / 2), R0(y - ih / 2), R0(iw), R0(ih));
    } else ctx.drawImage(img, x - (img.width >> 1), y - (img.height >> 1));
    // estrelas encontradas (só fases vencidas)
    if (st === 'done' && !n.boss) {
      const f = this.rec(n.id)?.starsFound || [];
      if (f.some(Boolean)) for (let i = 0; i < 3; i++) { const im = getImage(f[i] ? 'map_star_on' : 'map_star_off'); if (im) ctx.drawImage(im, x - 11 + i * 7, y + 6); }
    }
    // seleção: anel de pontos girando
    if (n === this.info && (n !== this.tico.at || this.moving || this.peek)) {
      const rr = n.boss ? 11 : 9, k = t * 2.2;
      ctx.fillStyle = this.isOpen(n) ? '#fff6b0' : '#c0b8d8';
      for (let i = 0; i < 10; i++) { const a = k + i * Math.PI / 5; ctx.fillRect(R0(x + Math.cos(a) * rr) - 1, R0(y + Math.sin(a) * rr * 0.8) - 1, 2, 2); }
    }
  }
  drawBonusHint(ctx, b, wd) {
    const x = R0(b.x), y = R0(b.y);
    ctx.fillStyle = 'rgba(255,244,220,0.45)';
    for (let i = 0; i < 12; i += 2) { const a = i * Math.PI / 6; ctx.fillRect(R0(x + Math.cos(a) * 7), R0(y + Math.sin(a) * 7), 1, 1); }
    const im = getImage('map_star_off');
    if (im) ctx.drawImage(im, x - 3, y - 4);
    font.draw(ctx, `${this.worldStars(wd.id)}/${wd.bonusStarsNeeded}`, x, y + 6, { align: 'center', color: '#fff4dc', shadow: '#0b0716' });
  }
  drawTico(ctx, t) {
    const T = this.tico;
    const anim = T.link ? 'walk' : 'idle';
    const fr = animFrame('tico', anim, T.t);
    const x = R0(T.x), y = R0(T.y) + 3;   // pés no centro da bolinha
    ctx.fillStyle = 'rgba(11,7,22,0.35)';
    ctx.fillRect(x - 6, y - 1, 12, 2);
    drawSprite(ctx, 'tico', anim, fr, x, y, { flip: T.flip });
    drawCosmetics(ctx, null, anim, fr, x, y, T.flip);
    if (this.poof) {
      const k = this.poof.t / 0.5;
      ctx.fillStyle = `rgba(255,244,220,${(1 - k).toFixed(2)})`;
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillRect(R0(this.poof.x + Math.cos(a) * k * 16) - 1, R0(this.poof.y - 10 + Math.sin(a) * k * 12) - 1, 3, 3); }
    }
  }
  drawHeader(ctx, w, t) {
    const wd = WORLDS[this.viewWorld - 1];
    this.rects.menuBtn = { x: 4, y: 4, w: 52, h: 16 };
    const L = 60, Rr = w - 4;                       // depois do botão Menu; até a borda direita
    const hw = Math.min(Rr - L - 44, 300), total = hw + 44;
    const ax = R0(Math.max(L, (w - total) / 2)), hx = ax + 22;
    this.rects.header = { x: hx, y: 2, w: hw, h: 18 };
    drawPanel(ctx, hx, 2, hw, 18, 'dark');
    let name = `Mundo ${wd.id} - ${wd.name}`;
    if (font.measure(name) > hw - 12) name = `Mundo ${wd.id} - ${wd.short}`;
    if (this.picker) name = 'Escolha o mundo: ' + wd.short;
    if (font.measure(name) > hw - 8) name = `${wd.id} - ${wd.short}`;
    font.draw(ctx, name, hx + hw / 2, 7, { align: 'center', color: lighten(wd.color, 0.25), shadow: '#0b0716' });
    const canL = this.viewWorld > 1, canR = this.viewWorld < NW;
    const bob = this.picker ? R0(Math.sin(t * 6) * 1.5) : 0;
    this.rects.arrowL = canL ? { x: ax, y: 2, w: 20, h: 18 } : null;
    this.rects.arrowR = canR ? { x: hx + hw + 2, y: 2, w: 20, h: 18 } : null;
    if (canL) drawButton(ctx, ax - bob, 2, 20, 18, '', { icon: 'icon_arrow_l', selected: this.picker });
    if (canR) drawButton(ctx, hx + hw + 2 + bob, 2, 20, 18, '', { icon: 'icon_arrow_r', selected: this.picker });
  }
  drawStats(ctx, w) {
    const wv = this.viewWorld;
    const stars = `${this.worldStars(wv)}/${this.worldStarsMax(wv)}`, btn = String(save.data.inventory?.buttons ?? 0);
    const si = getImage('icon_star'), bi = getImage('icon_button');
    const sw = (si ? si.width + 2 : 0) + font.measure(stars), bw = (bi ? bi.width + 2 : 0) + font.measure(btn);
    const pw = sw + bw + 18, px = w - pw - 4, py = HEADER + 1;
    this.rects.stats = { x: px, y: py, w: pw, h: 14 };
    drawPanel(ctx, px, py, pw, 14, 'dark');
    let x = px + 6;
    if (si) { ctx.drawImage(si, x, py + 7 - (si.height >> 1)); x += si.width + 2; }
    font.draw(ctx, stars, x, py + 4, { color: '#ffd23f' }); x += font.measure(stars) + 6;
    if (bi) { ctx.drawImage(bi, x, py + 7 - (bi.height >> 1)); x += bi.width + 2; }
    font.draw(ctx, btn, x, py + 4, { color: '#fff4dc' });
  }
  drawMenu(ctx, w, h, t) {
    // menu recolhido: um único botão "Menu"; aberto: lista com nomes por cima do mapa
    const open = this.focus === 'menu';
    if (!open) {
      for (const it of this.menu.items) it.rect = null;
      this.rects.menuPanel = null;
      drawButton(ctx, 4, 4, 52, 16, 'Menu', { icon: 'icon_bag', selected: false });
      return;
    }
    for (const it of this.menu.items) it.label = it.name;
    ctx.fillStyle = 'rgba(11,7,22,0.55)';
    ctx.fillRect(0, 0, w, h);
    const bw = 124, n = this.menu.vis.length;
    let bh = 17, gap = 3;
    if (n * (bh + gap) + 18 + 24 > h - 4) { bh = 15; gap = 2; }
    const ph = n * (bh + gap) + 18, px = 6, py = 24;
    this.rects.menuPanel = { x: px, y: py, w: bw + 12, h: ph };
    drawPanel(ctx, px, py, bw + 12, ph, 'dark');
    font.draw(ctx, 'Menu', px + (bw + 12) / 2, py + 4, { align: 'center', color: '#ffd23f' });
    this.menu.layoutV(px + 6 + bw / 2, py + 15, bw, bh, gap);
    this.menu.draw(ctx, t);
    drawButton(ctx, 4, 4, 52, 16, 'Fechar', { icon: 'icon_arrow_l', selected: false });
  }
  drawInfo(ctx, w, h) {
    const n = this.info;
    const x = 4, y = h - INFO_H - 4, pw = w - 8;
    this.rects.info = { x, y, w: pw, h: INFO_H };
    drawPanel(ctx, x, y, pw, INFO_H, 'dark');
    const st = this.state(n), wd = WORLDS[n.world - 1];
    const data = R.levels.get(n.id);
    const bw = 62, bx = x + pw - bw - 6, by = y + 11;
    const open = (st === 'open' || st === 'done') && !this.peek;
    this.rects.play = { x: bx, y: by, w: bw, h: 20 };
    drawButton(ctx, bx, by, bw, 20, 'Jogar', { selected: open && this.focus === 'map' && !this.picker, disabled: !open });
    const tw = bx - x - 14;
    // linha 1: selo + nome
    const tag = n.bonus ? `${n.world}-★` : n.boss ? `${n.world}-` : `${n.world}-${n.idx}`;
    const castle = n.boss ? getImage('map_castle_tag') : null;
    const tagW = font.measure(tag) + 8 + (castle ? castle.width : 0);
    ctx.fillStyle = INK; ctx.fillRect(x + 6, y + 5, tagW, 11);
    ctx.fillStyle = wd.color; ctx.fillRect(x + 7, y + 6, tagW - 2, 9);
    font.draw(ctx, tag, x + 10, y + 7, { color: INK });
    if (castle) ctx.drawImage(castle, x + 10 + font.measure(tag), y + 6);
    const kindTxt = n.boss ? ' (Chefe)' : n.bonus ? ' (Bônus)' : n.dyn ? ' (Desafio)' : '';
    const name = st === 'soon' ? 'Em breve' : (data?.name || '???') + kindTxt;
    font.draw(ctx, name, x + 10 + tagW, y + 7, { color: st === 'soon' ? '#a898d8' : '#fff4dc', shadow: '#0b0716', maxWidth: tw - tagW - 4, maxChars: 60 });
    const L2 = y + 19, L3 = y + 30;
    if (st === 'soon') { font.draw(ctx, 'Esta fase ainda está sendo costurada.', x + 8, L2, { color: '#a898d8', maxWidth: tw }); return; }
    if (this.sew && n === this.sew.to) { font.draw(ctx, `Costurando o caminho até o Mundo ${n.world}...`, x + 8, L2, { color: '#ffd23f', maxWidth: tw }); return; }
    if (st === 'locked') {
      const msg = this.worldShut(n.world) ? 'Mundo costurado: vença o chefe anterior.' : n.bonus ? `Junte ${wd.bonusStarsNeeded} estrelas do mundo.` : 'Termine a fase anterior para liberar.';
      font.draw(ctx, msg, x + 8, L2, { color: '#a898d8', maxWidth: tw });
      return;
    }
    const rec = this.rec(n.id) || {};
    let cx = x + 8;
    const ic = (nm, yy) => { const im = getImage(nm); if (!im) return 0; ctx.drawImage(im, cx, yy - 2); cx += im.width + 2; return im.width; };
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
    const l3 = rating ? `Melhor nota: {#ffd23f}${'★'.repeat(rating)}{/}` : 'Ainda não concluída';
    font.draw(ctx, l3, x + 8, L3, { color: '#a898d8', maxWidth: tw });
  }
}

registerScene('worldmap', WorldMapScene);
export { WorldMapScene };
