// =============================================================================
// registry.js — Registros globais de conteúdo. Cada módulo de conteúdo chama
// register*() ao ser importado (veja src/content.js, que importa todos).
// =============================================================================

export const R = {
  entities: new Map(),    // type -> class (extends Entity)
  levels: new Map(),      // id -> level data
  tilesets: new Map(),    // id -> tileset def
  backgrounds: new Map(), // id -> background def
  cutscenes: new Map(),   // id -> cutscene def  { stage?, music?, run: function*(cs) }
  dialogues: new Map(),   // id -> array of lines
  worlds: new Map(),      // number -> world def
  legends: new Map(),     // world number -> { char: type | {type, props} }
  memories: new Map(),    // id -> { title, world, text, scene? }
  abilities: new Map(),   // id -> ability def
  portraits: new Map(),   // character id -> { name, color, draw(pc, expression, frame) }
  skills: new Map(),      // skill-tree node id -> def
  shopItems: new Map(),   // id -> def
  cosmetics: new Map(),   // id -> def
  scenes: new Map(),      // name -> Scene class (title, worldmap, pause...)
  quests: new Map(),      // id -> def
};

export function registerEntity(type, cls) {
  if (R.entities.has(type)) console.warn('[registry] entidade duplicada:', type);
  R.entities.set(type, cls);
  cls.type = type;
  return cls;
}
export function registerLevel(data) { R.levels.set(data.id, data); return data; }
export function registerTileset(id, def) { R.tilesets.set(id, def); return def; }
export function registerBackground(id, def) { R.backgrounds.set(id, def); return def; }
export function registerCutscene(id, def) { R.cutscenes.set(id, typeof def === 'function' ? { run: def } : def); }
export function registerDialogue(id, lines) { R.dialogues.set(id, lines); }
export function registerDialogues(obj) { for (const [k, v] of Object.entries(obj)) R.dialogues.set(k, v); }
export function registerWorld(def) { R.worlds.set(def.id, def); }
export function registerLegend(world, map) { R.legends.set(world, { ...(R.legends.get(world) || {}), ...map }); }
export function registerMemory(id, def) { R.memories.set(id, { id, ...def }); }
export function registerAbility(id, def) { R.abilities.set(id, { id, ...def }); }
export function registerPortrait(id, def) { R.portraits.set(id, { id, ...def }); }
export function registerSkill(id, def) { R.skills.set(id, { id, ...def }); }
export function registerShopItem(id, def) { R.shopItems.set(id, { id, ...def }); }
export function registerCosmetic(id, def) { R.cosmetics.set(id, { id, ...def }); }
export function registerScene(name, cls) { R.scenes.set(name, cls); }
export function registerQuest(id, def) { R.quests.set(id, { id, ...def }); }

/** Create a registered scene by name (returns null if not registered). */
export function makeScene(name, ...args) {
  const C = R.scenes.get(name);
  return C ? new C(...args) : null;
}
