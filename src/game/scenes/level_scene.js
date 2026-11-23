// =============================================================================
// level_scene.js — Cena de jogo: carrega uma fase registrada, cria tilemap,
// entidades e o Tico, e coordena câmera, iluminação, partículas, HUD,
// diálogos, cutscenes, checkpoints, segredos, morte e conclusão.
//
// API usada por entidades/habilidades/cutscenes (this.level.*):
//   add(entity) / spawn(type, x, y, props) / query(rect, filter) / byTag(tag)
//   find(fn) / findById(propId)
//   map (Tilemap), player, camera, particles, lighting, tasks (TaskRunner)
//   solids (array de entidades sólidas — mantido automaticamente)
//   signal(name, value) / onSignal(name, fn) / signals (último valor)
//   shake(a) hitstop(s) flash(color, s) toast(text, icon)
//   say(lines, opts) -> Promise    (diálogo; trava o jogador)
//   cutscene(id, params) -> Promise
//   setCheckpoint(x, y, id)   foundSecret(id)   collect(kind, n, pid)
//   complete(opts)            inputLocked (bool)   timer (s)
//   platformAt(px, py) -> entidade one-way/sólida no ponto
//   addLight(x,y,r,color,intensity,flicker)
//   data (os dados registrados da fase)
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { Tilemap, T, TILE_CHARS, isSolidType } from '../../engine/tilemap.js';
import { Camera } from '../../engine/camera.js';
import { ParticleSystem, getParticlePreset } from '../../engine/particles.js';
import { Lighting } from '../../engine/lighting.js';
import { PixelCanvas, createCanvas } from '../../engine/pixel.js';
import { TaskRunner, TILE, makeRng, hashString, rectsOverlap, Emitter, rand } from '../../engine/util.js';
import { input } from '../../engine/input.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { R, makeScene } from '../registry.js';
import { Player } from '../player/player.js';
import { GLOBAL_LEGEND } from '../legend.js';
import { Hud } from '../ui/hud.js';
import { DialogueBox } from '../ui/dialogue.js';
import { runCutscene } from '../cutscenes/director.js';
import { getStats } from '../stats.js';
import { DEFAULT_TOD } from '../art/sky.js';

const CHUNK = 16; // tiles per chunk side

export class LevelScene extends Scene {
  enter(params = {}) {
    this.params = params;
    this.levelId = params.levelId || params.id;
    this.data = R.levels.get(this.levelId);
    if (!this.data) throw new Error('Fase não registrada: ' + this.levelId);
    if (game.params.get('tod')) this.data = { ...this.data, timeOfDay: game.params.get('tod') }; // teste: ?tod=day|dusk|night
    this.run = params.run || {
      timer: 0, deaths: 0, checkpoint: null, collected: new Set(), secrets: new Set(),
      buttons: 0, starsFound: [false, false, false], startedAt: Date.now(),
    };
    this.events = new Emitter();
    this.tasks = new TaskRunner();
    this.particles = new ParticleSystem(900);
    this.lighting = new Lighting(game.view.w, game.view.h);
    this.camera = new Camera(game.view.w, game.view.h);
    this.entities = [];
    this.toAdd = [];
    this.solids = [];
    this.signals = {};
    this.signalHandlers = new Map();
    this.hitstopT = 0;
    this.flashT = 0; this.flashDur = 0; this.flashColor = '#fff';
    this.inputLocked = false;
    this.state = 'play'; // play | complete | dead
    this.lockCount = 0;
    this.extraLights = [];
    this.secretsTotal = 0;
    this.buttonsTotal = 0;
    this.decoy = null;      // Retalho Fantasma ativo (abilities/decoy.js)
    this.boss = null;       // chefe ativo: HUD mostra boss.bossName, boss.hp/maxHp
    this.build();
    this.hud = new Hud(this);
    this.dialogue = new DialogueBox(this);
    this.camera.follow(this.player, true);
    audio.playMusic(this.data.music || `w${this.data.world}_level`);
    this.unsubBlur = game.events.on('blur', () => this.pauseGame());
    // level script
    try { this.data.onStart?.(this); } catch (e) { console.error(e); }
    // intro cutscene (first visit only)
    if (this.data.intro && !save.seen(this.data.intro) && !this.run.checkpoint && !params.skipIntro) {
      this.cutscene(this.data.intro).then(() => save.markSeen(this.data.intro));
    } else if (!this.run.checkpoint) {
      this.hud.showTitle?.(this.data.name, this.data.subtitle);
    }
    game.events.emit('levelStart', this);
  }

  exit() {
    this.unsubBlur?.();
    for (const e of this.entities) e.onRemove?.();
  }

  // ------------------------------------------------------------------ build
  build() {
    const d = this.data;
    const rows = d.map;
    const cols = Math.max(...rows.map((r) => r.length));
    const map = new Tilemap(cols, rows.length);
    this.map = map;
    const legend = { ...GLOBAL_LEGEND, ...(R.legends.get(d.world) || {}), ...(d.legend || {}) };
    const spawns = [];
    let starIdx = 0;
    let playerStart = null;
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < cols; x++) {
        const ch = row[x] ?? '.';
        if (ch === '.' || ch === ' ') continue;
        if (TILE_CHARS[ch] !== undefined) { map.set(x, y, TILE_CHARS[ch]); continue; }
        if (ch === 'P') { playerStart = { x, y }; continue; }
        const entry = legend[ch];
        if (!entry) { console.warn(`[level ${d.id}] caractere desconhecido '${ch}' em ${x},${y}`); continue; }
        const type = typeof entry === 'string' ? entry : entry.type;
        const props = { ...(typeof entry === 'object' ? entry.props : null), ...(d.props?.[`${x},${y}`] || {}) };
        props.pid = props.pid || `${d.id}:${ch}:${x},${y}`;
        props.char = ch;
        if (ch === '*') props.starIndex = starIdx++;
        spawns.push({ type, x, y, props });
      }
    }
    // tiles under entity cells inherit water/bg from neighbors
    for (const s of spawns) {
      const n = [map.get(s.x - 1, s.y), map.get(s.x + 1, s.y), map.get(s.x, s.y - 1), map.get(s.x, s.y + 1)];
      const wc = n.filter((t) => t === T.WATER).length;
      const bc = n.filter((t) => t === T.BG).length;
      if (wc >= 2) map.set(s.x, s.y, T.WATER);
      else if (bc >= 2) map.set(s.x, s.y, T.BG);
    }
    for (const o of d.objects || []) {
      const { type, x, y, ...props } = o;
      props.pid = props.pid || `${d.id}:${type}:${x},${y}`;
      spawns.push({ type, x, y, props });
    }
    // player
    const cp = this.run.checkpoint;
    const start = cp ? { x: cp.x, y: cp.y } : playerStart ? { x: playerStart.x * TILE + 2, y: playerStart.y * TILE + TILE - 18 } : { x: 32, y: 32 };
    this.player = new Player(this, start.x, start.y);
    if (this.params.playerState) Object.assign(this.player, this.params.playerState);
    // entities
    for (const s of spawns) {
      const C = R.entities.get(s.type);
      if (!C) { console.warn(`[level ${d.id}] entidade não registrada: ${s.type}`); continue; }
      try {
        const e = new C(this, s.x * TILE, s.y * TILE, s.props);
        if (e.dead) continue;
        this.entities.push(e);
      } catch (err) { console.error(`[level ${d.id}] erro criando ${s.type}`, err); }
    }
    this.secretsTotal = this.entities.filter((e) => e.isSecret).length;
    this.buttonsTotal = this.entities.filter((e) => e.isButton).length + this.run.buttons;
    this.entities.push(this.player);
    this.refreshSolids();
    for (const e of this.entities) { try { e.init?.(); } catch (err) { console.error(err); } }
    // camera bounds
    this.camera.setBounds(0, 0, map.width, map.height);
    // visuals
    const ovT = game.params.get('tileset'), ovB = game.params.get('bg');
    this.tileset = R.tilesets.get(ovT || d.tileset || `w${d.world}`) || R.tilesets.get('default');
    this.background = R.backgrounds.get(ovB || d.background || `w${d.world}`) || R.backgrounds.get('default') || null;
    this.bakeTiles();
    this.bakeBackground();
    this.ambient = d.ambient ? getParticlePreset(d.ambient) : null;
  }

  refreshSolids() {
    this.solids = this.entities.filter((e) => (e.solid || e.oneway) && !e.dead);
  }

  // --------------------------------------------------------------- baking
  bakeTiles() {
    const map = this.map;
    const ts = this.tileset;
    const seed = hashString(this.data.id);
    const chunksX = Math.ceil(map.cols / CHUNK), chunksY = Math.ceil(map.rows / CHUNK);
    this.chunks = [];
    this.fakeChunks = [];
    this.animDecor = [];
    let decor = [];
    if (ts?.decorate) { try { decor = ts.decorate(map, makeRng(seed ^ 0x5bd1e995), this.data) || []; } catch (e) { console.error('[tileset] decorate', e); } }
    this.animDecor = decor.filter((dd) => dd.anim);
    const staticDecor = decor.filter((dd) => !dd.anim && dd.paint);
    const solidLike = (t) => isSolidType(t) || t === T.FAKE;
    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const pcB = new PixelCanvas(CHUNK * TILE, CHUNK * TILE); // back decor + tiles
        const pcF = new PixelCanvas(CHUNK * TILE, CHUNK * TILE); // front decor
        const pcK = new PixelCanvas(CHUNK * TILE, CHUNK * TILE); // fake walls
        let hasFront = false, hasFake = false;
        const ox = cx * CHUNK * TILE, oy = cy * CHUNK * TILE;
        // back decor
        for (const dd of staticDecor) {
          if (dd.layer === 'front') continue;
          if (dd.x + (dd.w || 32) < ox || dd.x - 32 > ox + CHUNK * TILE || dd.y + (dd.h || 32) < oy || dd.y - 32 > oy + CHUNK * TILE) continue;
          pcB.resetTranslate(); pcB.translate(-ox, -oy);
          try { dd.paint(pcB); } catch (e) { /* ignore decor errors */ }
        }
        pcB.resetTranslate();
        for (let ty = cy * CHUNK; ty < Math.min(map.rows, (cy + 1) * CHUNK); ty++) {
          for (let tx = cx * CHUNK; tx < Math.min(map.cols, (cx + 1) * CHUNK); tx++) {
            const t = map.get(tx, ty);
            if (t === T.EMPTY || t === T.WATER) continue;
            const px = (tx - cx * CHUNK) * TILE, py = (ty - cy * CHUNK) * TILE;
            const rng = makeRng((seed + tx * 7919 + ty * 104729) >>> 0);
            const info = { tx, ty, map, type: t, level: this.data };
            const same = (dx, dy) => {
              const o = map.get(tx + dx, ty + dy);
              if (t === T.ONEWAY || t === T.BG) return o === t;
              return solidLike(o);
            };
            const n = { u: same(0, -1), d: same(0, 1), l: same(-1, 0), r: same(1, 0), ul: same(-1, -1), ur: same(1, -1), dl: same(-1, 1), dr: same(1, 1) };
            try {
              if (t === T.SOLID) ts.solid(pcB, px, py, n, rng, info);
              else if (t === T.ALT) (ts.alt || ts.solid)(pcB, px, py, n, rng, info);
              else if (t === T.ONEWAY) ts.oneway(pcB, px, py, n, rng, info);
              else if (t === T.SPIKE) {
                let dir = 'up';
                if (isSolidType(map.get(tx, ty + 1))) dir = 'up';
                else if (isSolidType(map.get(tx, ty - 1))) dir = 'down';
                else if (isSolidType(map.get(tx - 1, ty))) dir = 'right';
                else if (isSolidType(map.get(tx + 1, ty))) dir = 'left';
                ts.spike(pcB, px, py, dir, rng, info);
              } else if (t === T.BG) (ts.bg || (() => {}))(pcB, px, py, n, rng, info);
              else if (t === T.FAKE) { ts.solid(pcK, px, py, n, rng, info); hasFake = true; }
            } catch (e) { console.error('[tileset] draw error', e); pcB.rect(px, py, TILE, TILE, '#f0f'); }
          }
        }
        // front decor
        for (const dd of staticDecor) {
          if (dd.layer !== 'front') continue;
          if (dd.x + (dd.w || 32) < ox || dd.x - 32 > ox + CHUNK * TILE || dd.y + (dd.h || 32) < oy || dd.y - 32 > oy + CHUNK * TILE) continue;
          pcF.resetTranslate(); pcF.translate(-ox, -oy);
          try { dd.paint(pcF); hasFront = true; } catch (e) { /* ignore */ }
        }
        pcB.flush(); if (hasFront) pcF.flush(); if (hasFake) pcK.flush();
        this.chunks.push({ x: ox, y: oy, back: pcB.canvas, front: hasFront ? pcF.canvas : null });
        if (hasFake) this.fakeChunks.push({ x: ox, y: oy, canvas: pcK.canvas, alpha: 1 });
      }
    }
  }

  bakeBackground() {
    const bg = this.background;
    this.bgLayers = [];
    this.fgLayers = [];
    if (!bg) return;
    // layers are baked once per time of day ('day'|'dusk'|'night'); paint(pc, w, h, tod, levelData)
    const worldKey = this.data.background || `w${this.data.world}`;
    const tod = this.data.timeOfDay || bg.defaultTimeOfDay || DEFAULT_TOD[worldKey] || 'day';
    this.timeOfDay = tod;
    bg._bakedByTod ||= {};
    if (!bg._bakedByTod[tod]) {
      const bake = (L) => {
        const w = L.width || 512, h = L.height || 240;
        const pc = new PixelCanvas(w, h);
        try { L.paint(pc, w, h, tod, this.data); } catch (e) { console.error('[background] paint', e); }
        pc.flush();
        return { ...L, canvas: pc.canvas, w, h };
      };
      bg._bakedByTod[tod] = { back: (bg.layers || []).map(bake), front: (bg.front || []).map(bake) };
    }
    this.bgLayers = bg._bakedByTod[tod].back;
    this.fgLayers = bg._bakedByTod[tod].front;
  }

  // --------------------------------------------------------------- entity API
  add(e) { this.toAdd.push(e); return e; }
  spawn(type, x, y, props = {}) {
    const C = R.entities.get(type);
    if (!C) { console.warn('spawn: tipo desconhecido', type); return null; }
    return this.add(new C(this, x, y, props));
  }
  query(rect, filter) {
    const out = [];
    for (const e of this.entities) if (!e.dead && rectsOverlap(rect, e) && (!filter || filter(e))) out.push(e);
    return out;
  }
  byTag(tag) { return this.entities.filter((e) => !e.dead && e.tags.has(tag)); }
  find(fn) { return this.entities.find((e) => !e.dead && fn(e)); }
  findById(id) { return this.entities.find((e) => !e.dead && (e.props?.id === id)); }
  ofType(type) { return this.entities.filter((e) => !e.dead && e.constructor.type === type); }
  platformAt(px, py) {
    for (const s of this.solids) if (!s.dead && px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h) return s;
    return null;
  }
  inWaterVolume(e) {
    for (const v of this.entities) if (v.waterVolume && !v.dead && rectsOverlap(v, { x: e.x + 2, y: e.y + 6, w: e.w - 4, h: e.h - 8 })) return true;
    return false;
  }

  // --------------------------------------------------------------- signals
  signal(name, value = true) {
    if (!name) return;
    this.signals[name] = value;
    for (const fn of this.signalHandlers.get(name) || []) fn(value);
    this.events.emit('signal', name, value);
  }
  onSignal(name, fn) {
    if (!this.signalHandlers.has(name)) this.signalHandlers.set(name, new Set());
    this.signalHandlers.get(name).add(fn);
  }

  // --------------------------------------------------------------- feedback
  shake(a) { if (save.settings.shake !== false) this.camera.shake(a); }
  hitstop(s) { this.hitstopT = Math.max(this.hitstopT, s); }
  flash(color = '#ffffff', dur = 0.15) { this.flashColor = color; this.flashT = dur; this.flashDur = dur; }
  toast(text, icon) { this.hud?.toast?.(text, icon); }
  addLight(x, y, r, color, intensity = 1, flicker = 0) { this.lighting.add(x, y, r, color, intensity, flicker); }
  flashEnergy() { this.hud?.flashEnergy?.(); }

  lockInput() { this.lockCount++; this.inputLocked = true; }
  unlockInput() { this.lockCount = Math.max(0, this.lockCount - 1); this.inputLocked = this.lockCount > 0; }

  /** Dialogue. lines: array (see docs). Returns a Promise resolved at the end (value = choice index if any). */
  say(lines, opts = {}) {
    if (typeof lines === 'string') lines = R.dialogues.get(lines) || [lines];
    this.lockInput();
    audio.duck(0.55);
    return this.dialogue.start(lines, opts).then((r) => { this.unlockInput(); audio.unduck(); return r; });
  }
  cutscene(id, params = {}) {
    this.lockInput();
    return runCutscene(this, id, params).then((r) => { this.unlockInput(); return r; }, (e) => { console.error(e); this.unlockInput(); });
  }

  setCheckpoint(x, y, id) {
    this.run.checkpoint = { x, y, id };
    this.player.heal(99);
    this.player.energy = this.player.maxEnergy;
    save.commit();
  }
  foundSecret(id) {
    if (this.run.secrets.has(id)) return;
    this.run.secrets.add(id);
    audio.sfx('secret');
    this.toast('Segredo encontrado!', 'icon_secret');
  }
  /** Register a collectible pickup. kind: 'button'|'star'|'memory'|'patch'|'thread'|'heart'|'energy' */
  collect(kind, n = 1, pid = null, extra = {}) {
    const inv = save.data.inventory;
    if (pid) this.run.collected.add(pid);
    switch (kind) {
      case 'button': inv.buttons += n; this.run.buttons += n; break;
      case 'star': if (extra.index !== undefined) this.run.starsFound[extra.index] = true; break;
      case 'memory': if (extra.id && !inv.memories.includes(extra.id)) inv.memories.push(extra.id); break;
      case 'patch': inv.patches += n; break;
      case 'thread': inv.threads += n; break;
      default: break;
    }
    if (pid && ['star', 'memory', 'patch', 'thread', 'chest', 'bigbutton'].includes(kind)) save.markCollected(pid);
    this.events.emit('collect', kind, n, pid);
    this.hud?.onCollect?.(kind, n);
  }

  fadeTeleport(ent, x, y) {
    this.lockInput();
    this.tasks.run(function* (self) {
      self.fadeA = 0;
      for (let t = 0; t < 0.18; t += 1 / 60) { self.fadeA = t / 0.18; yield 0; }
      ent.x = x; ent.y = y; ent.vx = 0; ent.vy = 0;
      self.camera.snap();
      yield 0.08;
      for (let t = 0; t < 0.2; t += 1 / 60) { self.fadeA = 1 - t / 0.2; yield 0; }
      self.fadeA = 0;
      self.unlockInput();
    }, this);
    return true;
  }

  // --------------------------------------------------------------- flow
  pauseGame() {
    if (this.state !== 'play' || this.manager?.top !== this) return;
    const s = makeScene('pause', this);
    if (s) { this.manager.push(s); audio.sfx('ui_open'); }
  }

  onPlayerDeath() {
    this.run.deaths++;
    save.commit();
    const s = makeScene('death', this);
    if (s) this.manager.push(s);
    else this.respawn();
  }
  /** Restart from last checkpoint (fresh entities). */
  respawn() {
    const LS = this.constructor;
    audio.unduck();
    this.manager.go(new LS(), { levelId: this.levelId, run: this.run, skipIntro: true }, { transition: 'fade', time: 0.35 });
  }
  restart() {
    const LS = this.constructor;
    this.manager.go(new LS(), { levelId: this.levelId, skipIntro: true }, { transition: 'fade' });
  }

  /** Finish the level (called by the exit / boss defeat). */
  complete(opts = {}) {
    if (this.state !== 'play') return;
    this.state = 'complete';
    this.lockInput();
    this.player.state = 'celebrate';
    this.player.vx = 0;
    audio.playMusic(opts.music || 'jingle_clear', { fade: 0.3, restart: true });
    const results = this.computeResults();
    this.results = results;
    this.tasks.run(function* (self) {
      yield opts.delay ?? 2.0;
      if (opts.cutscene) yield () => self._csDone; // set by runCutscene if needed
      const s = makeScene('victory', self, results);
      if (s) self.manager.push(s);
      else self.exitToMap();
    }, this);
  }

  computeResults() {
    const d = this.data;
    const id = d.id;
    const rec = save.data.progress.levels[id] || { done: false, rating: 0, bestTime: null, starsFound: [false, false, false], secrets: [], buttons: 0 };
    const time = this.run.timer;
    const stars = this.run.starsFound.map((v, i) => v || rec.starsFound[i]);
    const starsThisRun = this.run.starsFound.filter(Boolean).length;
    const totalStarsPlaced = this.entities.filter((e) => e.constructor.type === 'star').length + starsThisRun;
    const allStars = stars.filter(Boolean).length >= Math.min(3, Math.max(totalStarsPlaced, stars.filter(Boolean).length) || 3);
    const secrets = new Set([...(rec.secrets || []), ...this.run.secrets]);
    const allSecrets = secrets.size >= this.secretsTotal;
    const par = d.parTime || 180;
    let rating = 1;
    if (time <= par) rating++;
    if (allStars && allSecrets) rating++;
    const newRec = {
      done: true,
      rating: Math.max(rec.rating || 0, rating),
      bestTime: rec.bestTime == null ? time : Math.min(rec.bestTime, time),
      starsFound: stars,
      secrets: [...secrets],
      buttons: Math.max(rec.buttons || 0, this.run.buttons),
    };
    save.data.progress.levels[id] = newRec;
    save.data.progress.lastLevel = id;
    // unlock next world when boss level done
    const world = R.worlds.get(d.world);
    if (d.boss && world) save.unlockWorld(d.world + 1);
    save.commit();
    return {
      levelId: id, name: d.name, time, par, rating, prevRating: rec.rating || 0, bestRating: newRec.rating,
      stars, starsThisRun: this.run.starsFound, secretsFound: this.run.secrets.size, secretsTotal: this.secretsTotal,
      buttons: this.run.buttons, deaths: this.run.deaths, boss: !!d.boss, world: d.world,
    };
  }

  exitToMap() {
    const s = makeScene('worldmap', { focusLevel: this.levelId, justCompleted: this.state === 'complete' ? this.levelId : null });
    if (s) this.manager.go(s, {}, { transition: 'stitch' });
    else this.manager.go(makeScene('title') || new LevelScene(), { levelId: this.levelId });
  }

  // --------------------------------------------------------------- update
  update(dt) {
    // pause
    if (input.pressed('pause') && this.state === 'play' && !this.dialogue.active) { this.pauseGame(); return; }
    this.tasks.update(dt);
    this.dialogue.update(dt);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.hitstopT > 0) { this.hitstopT -= dt; this.camera.update(dt * 0.3); return; }

    if (this.state === 'play' && !this.inputLocked) this.run.timer += dt;
    // add pending
    if (this.toAdd.length) {
      for (const e of this.toAdd) { this.entities.push(e); try { e.init?.(); } catch (err) { console.error(err); } }
      this.toAdd.length = 0;
      this.refreshSolids();
    }
    // update entities (active range)
    const cam = this.camera;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e !== this.player && !e.alwaysUpdate && !cam.visible(e.x, e.y, e.w, e.h, e.activeRange ?? 260)) continue;
      try { e.update(dt); } catch (err) { console.error('[entity update]', e.constructor.type, err); e.dead = true; }
    }
    // late updates (ride logic for ropes/bridges etc.)
    for (const e of this.entities) if (!e.dead && e.lateUpdate) { try { e.lateUpdate(dt); } catch (err) { console.error(err); } }
    // contact damage & stomps
    this.resolvePlayerContacts();
    // remove dead
    let removed = false;
    for (const e of this.entities) if (e.dead) { e.onRemove?.(); removed = true; }
    if (removed) { this.entities = this.entities.filter((e) => !e.dead || e === this.player); this.refreshSolids(); }
    else if (this.entities.some((e) => (e.solid || e.oneway) && !this.solids.includes(e))) this.refreshSolids();

    this.particles.update(dt);
    // ambient particles
    if (this.ambient) {
      const rate = this.ambient.rate ?? 6;
      if (Math.random() < rate * dt) {
        this.particles.emit(this.ambient, cam.x + rand(-20, cam.viewW + 20), cam.y + (this.ambient.fromBottom ? cam.viewH + 8 : rand(0, cam.viewH)), 1);
      }
    }
    // level script
    try { this.data.onUpdate?.(this, dt); } catch (e) { console.error(e); }
    this.camera.update(dt);
    this.hud.update(dt);
    // fake wall reveal (secret passages)
    this.updateFakeWalls(dt);
  }

  updateFakeWalls(dt) {
    if (!this.fakeChunks.length) return;
    const p = this.player;
    const inside = this.map.rectHas(p.x - 4, p.y - 4, p.w + 8, p.h + 8, T.FAKE);
    if (inside && !this._insideFake) {
      this._insideFake = true;
      const key = `fake:${Math.floor(p.cx / 64)},${Math.floor(p.cy / 64)}`;
      if (!this.run.secrets.has(key) && !this._fakeAnnounced?.has(key)) {
        (this._fakeAnnounced ||= new Set()).add(key);
        audio.sfx('secret_soft');
      }
    } else if (!inside) this._insideFake = false;
    for (const c of this.fakeChunks) {
      const near = p.cx > c.x - 24 && p.cx < c.x + CHUNK * TILE + 24 && p.cy > c.y - 24 && p.cy < c.y + CHUNK * TILE + 24;
      const target = inside && near ? 0.25 : 1;
      c.alpha += (target - c.alpha) * Math.min(1, dt * 8);
    }
  }

  resolvePlayerContacts() {
    const p = this.player;
    if (p.state === 'dead') return;
    for (const e of this.entities) {
      if (e.dead || e === p || !(e.enemy || e.hazard)) continue;
      if (!rectsOverlap(p, e)) continue;
      // stomp: falling onto a stompable enemy from above
      if (e.stompable && p.vy > 40 && p.bottom - e.y < 10 + p.vy / 60) {
        p.y = e.y - p.h;
        const hold = input.down('jump');
        p.vy = hold ? -340 : -240;
        p.jumping = hold;
        p.airJumps = 0; p.canAirDash = true;
        if (e.onStomp) e.onStomp(p); else e.hurt(1 * getStats().power * p.mods.damage, p, { knockback: 0 });
        audio.sfx('stomp');
        this.particles.emit('dust', p.cx, p.bottom, 6);
        this.hitstop(0.05);
        p.unravelMeter = Math.min(1, p.unravelMeter + 0.03);
        continue;
      }
      if (p.mods.phase && e.enemy && !e.boss) { if (e.hittable) e.hurt(p.mods.damage * 0.5, p); continue; }
      const dmg = e.contactDamage ?? 1;
      if (dmg > 0) p.hurt(dmg, e);
      e.onTouchPlayer?.(p);
    }
  }

  // --------------------------------------------------------------- draw
  draw(ctx) {
    const cam = this.camera;
    const { w, h } = game.view;
    const zoom = cam.zoom;
    const useZoom = Math.abs(zoom - 1) > 0.001;
    let target = ctx;
    if (useZoom) {
      if (!this.zoomCanvas || this.zoomCanvas.width !== Math.ceil(w / zoom) + 2 || this.zoomCanvas.height !== Math.ceil(h / zoom) + 2) {
        this.zoomCanvas = createCanvas(Math.ceil(w / zoom) + 2, Math.ceil(h / zoom) + 2);
      }
      target = this.zoomCanvas.getContext('2d');
      target.imageSmoothingEnabled = false;
    }
    this.drawWorld(target, useZoom ? this.zoomCanvas.width : w, useZoom ? this.zoomCanvas.height : h);
    if (useZoom) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.zoomCanvas, 0, 0, this.zoomCanvas.width, this.zoomCanvas.height, 0, 0, this.zoomCanvas.width * zoom, this.zoomCanvas.height * zoom);
    }
    // lighting
    this.lighting.resize !== undefined && (this.lighting.w !== w || this.lighting.h !== h) && this.lighting.resize(w, h);
    this.lighting.render(ctx, cam);
    // front parallax (fog etc.)
    this.drawParallax(ctx, this.fgLayers, w, h);
    // screen flash
    if (this.flashT > 0) {
      ctx.globalAlpha = Math.min(1, this.flashT / Math.max(0.01, this.flashDur));
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    try { this.data.drawOverlay?.(ctx, this); } catch (e) { /* ignore */ }
    this.hud.draw(ctx);
    this.dialogue.draw(ctx);
    if (this.fadeA > 0) { ctx.globalAlpha = this.fadeA; ctx.fillStyle = '#0b0716'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (game.debug.enabled) this.drawDebug(ctx);
  }

  drawParallax(ctx, layers, w, h) {
    if (!layers?.length) return;
    const cam = this.camera;
    const t = this.time;
    for (const L of layers) {
      const sx = L.speed ?? 0.5, sy = L.speedY ?? sx * 0.5;
      const baseY = (L.anchor === 'top' ? 0 : h - L.h) + (L.y || 0);
      const maxCamY = Math.max(0, this.map.height - cam.viewH);
      const y = Math.round(baseY - (cam.y - maxCamY) * sy);
      const drift = (L.drift || 0) * t;
      let x = -Math.round(((cam.x * sx + drift) % L.w + L.w) % L.w);
      ctx.globalAlpha = L.alpha ?? 1;
      for (; x < w; x += L.w) {
        ctx.drawImage(L.canvas, x, y);
        if (L.repeatY) for (let yy = y - L.h; yy > -L.h; yy -= L.h) ctx.drawImage(L.canvas, x, yy);
      }
      if (L.fillBelow && y + L.h < h) { ctx.fillStyle = L.fillBelow; ctx.fillRect(0, y + L.h, w, h - y - L.h); }
      if (L.fillAbove && y > 0) { ctx.fillStyle = L.fillAbove; ctx.fillRect(0, 0, w, y); }
      ctx.globalAlpha = 1;
      try { L.animate?.(ctx, cam, t, w, h, y); } catch (e) { /* ignore */ }
    }
  }

  drawWorld(ctx, w, h) {
    const cam = this.camera;
    const t = this.time;
    // sky + parallax
    const bg = this.background;
    if (bg?.sky) { try { bg.sky(ctx, w, h, t, cam, this); } catch (e) { ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, w, h); } }
    else { ctx.fillStyle = this.tileset?.skyColor || '#1a1030'; ctx.fillRect(0, 0, w, h); }
    this.drawParallax(ctx, this.bgLayers, w, h);

    const ox = cam.rx, oy = cam.ry;
    ctx.save();
    ctx.translate(-ox, -oy);
    this.lighting.begin(this.data.darkness ?? 0, this.data.darkColor || '#06030f');
    // animated back decor
    for (const d of this.animDecor) {
      if (d.layer === 'front') continue;
      if (!cam.visible(d.x, d.y, d.w || 16, d.h || 16, 16)) continue;
      try { d.anim(ctx, t, this); } catch (e) { /* ignore */ }
      if (d.light) this.lighting.add(d.x + (d.w || 16) / 2, d.y + (d.h || 16) / 2, d.light.r, d.light.color, d.light.i ?? 0.8, d.light.flicker ?? 0.3);
    }
    // tiles (back)
    const CS = CHUNK * TILE;
    for (const c of this.chunks) {
      if (c.x + CS < cam.x - 2 || c.x > cam.x + cam.viewW + 2 || c.y + CS < cam.y - 2 || c.y > cam.y + cam.viewH + 2) continue;
      ctx.drawImage(c.back, c.x, c.y);
    }
    // water (animated)
    this.drawWater(ctx, t);
    // background particles
    this.particles.draw(ctx, false);
    // entities
    const vis = this.entities.filter((e) => !e.dead && (e.alwaysDraw || cam.visible(e.x, e.y, e.w, e.h, e.drawMargin ?? 48)));
    vis.sort((a, b) => a.z - b.z);
    for (const e of vis) {
      try { e.draw(ctx); } catch (err) { console.error('[entity draw]', e.constructor.type, err); }
      if (e.drawLight) e.drawLight(this.lighting);
      if (e.light) this.lighting.add(e.cx, e.cy, e.light.r, e.light.color, e.light.i ?? 1, e.light.flicker ?? 0);
    }
    // player light in the dark
    if ((this.data.darkness ?? 0) > 0.05) {
      const pr = this.data.playerLight ?? 46;
      this.lighting.add(this.player.cx, this.player.cy, pr, '#ffe9c2', 1, 0.2);
    }
    // interact prompt
    const it = this.player.interactTarget;
    if (it && !this.inputLocked) this.hud.drawPrompt?.(ctx, it);
    // front tiles decor
    for (const c of this.chunks) {
      if (!c.front) continue;
      if (c.x + CS < cam.x - 2 || c.x > cam.x + cam.viewW + 2 || c.y + CS < cam.y - 2 || c.y > cam.y + cam.viewH + 2) continue;
      ctx.drawImage(c.front, c.x, c.y);
    }
    for (const d of this.animDecor) {
      if (d.layer !== 'front') continue;
      if (!cam.visible(d.x, d.y, d.w || 16, d.h || 16, 16)) continue;
      try { d.anim(ctx, t, this); } catch (e) { /* ignore */ }
    }
    // fake walls (in front of player)
    for (const c of this.fakeChunks) {
      if (c.x + CS < cam.x || c.x > cam.x + cam.viewW || c.y + CS < cam.y || c.y > cam.y + cam.viewH) continue;
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(c.canvas, c.x, c.y);
      ctx.globalAlpha = 1;
    }
    this.particles.draw(ctx, true);
    for (const L of this.extraLights) this.lighting.add(...L);
    if (game.debug.hitboxes) {
      ctx.strokeStyle = '#0f0';
      for (const e of vis) ctx.strokeRect(Math.round(e.x) + 0.5, Math.round(e.y) + 0.5, e.w - 1, e.h - 1);
      const ab = this.player.attackBox();
      if (ab) { ctx.strokeStyle = '#f00'; ctx.strokeRect(ab.x + 0.5, ab.y + 0.5, ab.w, ab.h); }
    }
    ctx.restore();
  }

  drawWater(ctx, t) {
    const map = this.map;
    const cam = this.camera;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), x1 = Math.min(map.cols - 1, Math.ceil((cam.x + cam.viewW) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1), y1 = Math.min(map.rows - 1, Math.ceil((cam.y + cam.viewH) / TILE) + 1);
    const ts = this.tileset || {};
    const W = ts.water || { body: '#2f7fbf', top: '#7fd6ff', deep: '#1d4f86', highlight: '#c8f4ff', alpha: 0.72 };
    if (ts.drawWater) { ts.drawWater(ctx, map, x0, y0, x1, y1, t); return; }
    ctx.globalAlpha = W.alpha ?? 0.72;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (map.get(tx, ty) !== T.WATER) continue;
        const px = tx * TILE, py = ty * TILE;
        const surface = map.get(tx, ty - 1) !== T.WATER && !isSolidType(map.get(tx, ty - 1));
        ctx.fillStyle = ty > 0 && map.get(tx, ty - 2) === T.WATER && map.get(tx, ty - 3) === T.WATER ? W.deep : W.body;
        ctx.fillRect(px, py, TILE, TILE);
        if (surface) {
          ctx.fillStyle = W.top;
          for (let i = 0; i < TILE; i++) {
            const wy = Math.round(Math.sin((px + i) * 0.35 + t * 3) * 1.2 + Math.sin((px + i) * 0.13 - t * 1.7));
            ctx.fillRect(px + i, py + wy, 1, 2);
          }
          ctx.fillStyle = W.highlight;
          if (((tx * 7 + Math.floor(t * 2)) % 5) === 0) ctx.fillRect(px + 4, py + 3, 3, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawDebug(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, game.view.h - 12, 220, 12);
    ctx.fillStyle = '#0f0';
    ctx.font = '8px monospace';
    const p = this.player;
    ctx.fillText(`fps ${game.fps.toFixed(0)} ent ${this.entities.length} p ${p.x.toFixed(0)},${p.y.toFixed(0)} ${p.state}/${p.anim}`, 2, game.view.h - 3);
  }

  resize(w, h) {
    this.camera.resize(w, h);
    this.lighting.resize(w, h);
  }
}
