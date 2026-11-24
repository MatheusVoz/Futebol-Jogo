// =============================================================================
// save.js — Persistência (localStorage; funciona offline no WebView do APK).
//
//   save.data            -> objeto do progresso atual (veja defaultSave())
//   save.settings        -> configurações (volume etc.), separadas do progresso
//   save.commit()        -> grava agora
//   save.newGame()       -> zera progresso (mantém configurações)
//   save.hasGame()       -> existe jogo salvo?
// =============================================================================

const KEY = 'stitched_worlds_save_v1';         // slot 0 (compatível com saves antigos)
const slotKey = (n) => (n ? `${KEY}_s${n}` : KEY);
export const SLOT_COUNT = 3;
const SKEY = 'stitched_worlds_settings_v1';

export function defaultSave() {
  return {
    version: 1,
    created: Date.now(),
    playTime: 0,
    // ---- progresso
    progress: {
      unlockedWorlds: [1],
      levels: {},          // levelId -> { done, rating(1-3), bestTime, starsFound:[bool,bool,bool], secrets:[ids], buttons:n }
      currentWorld: 1,
      lastLevel: null,
      bonusUnlocked: [],   // world numbers whose secret level is unlocked
      gameCleared: false,
      ending: null,        // 'cut' | 'mend'
    },
    // ---- inventário
    inventory: {
      buttons: 0,          // Botões dourados (moeda)
      patches: 0,          // Retalhos mágicos (árvore de habilidades)
      threads: 0,          // Fios antigos (raros)
      memories: [],        // ids de memórias da criança
      collected: {},       // persistentId -> true (estrelas, baús, memórias, botões grandes...)
    },
    // ---- habilidades
    abilities: {
      stitch: false,       // Costura Dimensional
      unstitch: false,     // Descosturar a Realidade
      rewind: false,       // Remendo Temporal
      decoy: false,        // Retalho Fantasma
      unravel: false,      // Forma Desfiada
      doubleJump: false,
    },
    equippedAbility: 'stitch',
    skills: [],            // ids de nós comprados na árvore de habilidades
    shop: [],              // ids de itens comprados na loja
    cosmetics: { owned: ['thread_gold'], hat: null, neck: null, back: null, thread: 'thread_gold' },
    story: { flags: {}, seen: [] }, // cutscenes vistas, flags narrativas, missões
    quests: {},            // questId -> state
    checkpoint: null,      // { level, x, y } (só dentro da fase atual)
  };
}

export function defaultSettings() {
  return { lastSlot: 0, music: 0.6, sfx: 0.8, master: 0.9, shake: true, touchOpacity: 0.55, touchScale: 1, textSpeed: 1, showTimer: false, vibrate: true };
}

function deepMerge(base, over) {
  if (!over || typeof over !== 'object') return base;
  for (const k of Object.keys(over)) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof over[k] === 'object' && !Array.isArray(over[k])) deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

class SaveSystem {
  constructor() {
    this.data = defaultSave();
    this.settings = defaultSettings();
    this._has = false;
    this.slot = 0;
    this.listeners = new Set();
  }
  load() {
    try {
      const st = localStorage.getItem(SKEY);
      if (st) this.settings = deepMerge(defaultSettings(), JSON.parse(st));
    } catch (e) { /* ignore */ }
    this.slot = Math.max(0, Math.min(SLOT_COUNT - 1, this.settings.lastSlot | 0));
    this.loadSlot(this.slot);
    return this;
  }
  /** Lê o slot n para save.data (sem trocar se não existir: data fica padrão). */
  loadSlot(n) {
    this.slot = n;
    this.data = defaultSave();
    this._has = false;
    try {
      const raw = localStorage.getItem(slotKey(n));
      if (raw) { this.data = deepMerge(defaultSave(), JSON.parse(raw)); this._has = true; }
    } catch (e) { console.warn('[save] falha ao carregar', e); }
    return this._has;
  }
  /** Escolhe o slot ativo (lembrado nas configurações). */
  selectSlot(n) {
    this.loadSlot(n);
    this.settings.lastSlot = n;
    this.commitSettings();
    return this._has;
  }
  /** Resumo de cada slot para a tela de escolha. */
  listSlots() {
    const out = [];
    for (let n = 0; n < SLOT_COUNT; n++) {
      let d = null;
      try { const raw = localStorage.getItem(slotKey(n)); if (raw) d = JSON.parse(raw); } catch (e) { d = null; }
      if (!d) { out.push({ slot: n, exists: false }); continue; }
      const lv = d.progress?.levels || {};
      let stars = 0, done = 0;
      for (const r of Object.values(lv)) { if (r?.done) done++; stars += (r?.starsFound || []).filter(Boolean).length; }
      out.push({
        slot: n, exists: true, playTime: d.playTime || 0, stars, done,
        worlds: (d.progress?.unlockedWorlds || [1]).length, memories: (d.inventory?.memories || []).length,
        buttons: d.inventory?.buttons || 0, lastLevel: d.progress?.lastLevel || null, cleared: !!d.progress?.gameCleared,
      });
    }
    return out;
  }
  hasAnyGame() { return this.listSlots().some((s) => s.exists); }
  deleteSlot(n) {
    try { localStorage.removeItem(slotKey(n)); } catch (e) { /* ignore */ }
    if (n === this.slot) { this.data = defaultSave(); this._has = false; }
  }
  hasGame() { return this._has; }
  newGame(n = this.slot) {
    this.slot = n;
    this.settings.lastSlot = n;
    this.commitSettings();
    this.data = defaultSave();
    this._has = true;
    this.commit();
  }
  commit() {
    try {
      localStorage.setItem(slotKey(this.slot || 0), JSON.stringify(this.data));
      this._has = true;
    } catch (e) { console.warn('[save] falha ao salvar', e); }
    for (const fn of this.listeners) fn(this.data);
  }
  commitSettings() {
    try { localStorage.setItem(SKEY, JSON.stringify(this.settings)); } catch (e) { /* ignore */ }
  }
  wipe() {
    for (let n = 0; n < SLOT_COUNT; n++) { try { localStorage.removeItem(slotKey(n)); } catch (e) { /* ignore */ } }
    this.data = defaultSave();
    this._has = false;
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  // ---------------- helpers
  get inv() { return this.data.inventory; }
  get prog() { return this.data.progress; }
  isCollected(id) { return !!this.data.inventory.collected[id]; }
  markCollected(id) { this.data.inventory.collected[id] = true; }
  flag(name) { return this.data.story.flags[name]; }
  setFlag(name, v = true) { this.data.story.flags[name] = v; }
  seen(id) { return this.data.story.seen.includes(id); }
  markSeen(id) { if (!this.seen(id)) this.data.story.seen.push(id); }
  hasAbility(a) { return !!this.data.abilities[a]; }
  unlockAbility(a) { this.data.abilities[a] = true; }
  hasSkill(id) { return this.data.skills.includes(id); }
  levelRecord(id) { return this.data.progress.levels[id] || null; }
  isWorldUnlocked(w) { return this.data.progress.unlockedWorlds.includes(w); }
  unlockWorld(w) { if (!this.isWorldUnlocked(w)) this.data.progress.unlockedWorlds.push(w); }
}

export const save = new SaveSystem();
export default save;
