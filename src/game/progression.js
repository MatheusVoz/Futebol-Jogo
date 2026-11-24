// =============================================================================
// progression.js — Árvore de habilidades (retalhos mágicos) e loja da Agulheta
// (botões dourados / fios antigos).
//
//   registerSkill(id, { name, desc, icon, cost, branch, col, tier, req:[ids], effects })
//   registerShopItem(id, { name, desc, icon, price, currency, tab, req:[ids], effects })
//   Efeitos usam as chaves de stats.js (maxHp, maxEnergy, power, speed, ...).
//
// Utilitários exportados (usados por scenes/menus_progress.js):
//   BRANCHES, CURRENCY, wallet(cur), skillState(id), buySkill(id),
//   shopState(id), buyShopItem(id), effectText(effects), reqNames(def, map)
// =============================================================================
import { defineImage } from '../engine/sprites.js';
import { save } from '../engine/save.js';
import { R, registerSkill, registerShopItem } from './registry.js';
import { invalidateStats } from './stats.js';

// ----------------------------------------------------------- ícones extras
const INK = '#1b1030';
function icon(name, rows, pal) {
  const w = Math.max(...rows.map((r) => r.length)) + 2, h = rows.length + 2;
  defineImage(name, w, h, (pc) => { pc.ascii(rows, pal, 1, 1); pc.outline(INK); });
}
icon('icon_sk_speed', [ // patinha com linhas de vento
  '.....LLL.',
  'WW..LTTTL',
  '...LTTTTD',
  'WWW.TTTTD',
  '....DTTD.',
  'WW..D.D..',
], { L: '#9ff0ea', T: '#3fc7c0', D: '#2a8d87', W: '#fff4dc' });
icon('icon_sk_dash', [
  'G..G...',
  'GG.GG..',
  '.GG.GG.',
  '..GG.GG',
  '.GG.GG.',
  'GG.GG..',
  'G..G...',
], { G: '#7fe6df' });
icon('icon_sk_regen', [
  '...Y.....',
  '..YY..W..',
  '.YYYYWWW.',
  'YYYYY.W..',
  '...YY....',
  '..YY.....',
  '.Y.......',
], { Y: '#ffd23f', W: '#8fff9a' });
icon('icon_sk_eff', [ // gota de energia com "menos"
  '...B...',
  '..BLB..',
  '.BLBBB.',
  'BBWWWBB',
  'BBBBBDB',
  '.BBBDB.',
  '..DDD..',
], { B: '#55d0ff', L: '#c8f0ff', D: '#2a7ab0', W: '#ffffff' });
icon('icon_sk_power', [ // agulha com brilho
  '......WW',
  '.....WGW',
  '....GGW.',
  '...GGG..',
  '..GGG...',
  '.GGG....',
  'DDG.....',
  'D.......',
], { G: '#e0e8f4', W: '#ffd23f', D: '#8a94a8' });
icon('icon_sk_combo', [
  'W...W...W',
  '.W...W...W',
  '..W...W...',
  '...Y...Y..',
], { W: '#fff4dc', Y: '#ffd23f' });
icon('icon_sk_magnet', [
  '.RRRRR.',
  'RRDDDRR',
  'RR...RR',
  'RR...RR',
  'WW...WW',
  'WW...WW',
], { R: '#ff5a6e', D: '#b02a40', W: '#e8eef8' });

// ------------------------------------------------------------- definições
export const CURRENCY = {
  patches: { name: 'retalhos', icon: 'icon_patch', key: 'patches' },
  buttons: { name: 'botões', icon: 'icon_button', key: 'buttons' },
  threads: { name: 'fios antigos', icon: 'icon_thread', key: 'threads' },
};
export const BRANCHES = [
  { id: 'body', name: 'Corpo', color: '#3fc7c0' },
  { id: 'thread', name: 'Fio', color: '#55a8ff' },
  { id: 'sew', name: 'Costura', color: '#ffb84f' },
];

// Árvore: col (-1/0/+1) e tier (0 = raiz, embaixo).
const SKILLS = {
  body_1: { branch: 'body', col: 0, tier: 0, name: 'Patinhas Ligeiras', icon: 'icon_sk_speed', cost: 1, req: [], effects: { speed: 0.05 }, desc: 'Enchimento novo nas patinhas: Tico corre um pouco mais rápido.' },
  body_2: { branch: 'body', col: 0, tier: 1, name: 'Arranque de Feltro', icon: 'icon_sk_dash', cost: 2, req: ['body_1'], effects: { dashCooldown: -0.08 }, desc: 'O dash recarrega mais depressa.' },
  body_3: { branch: 'body', col: 0, tier: 2, name: 'Coração Remendado', icon: 'icon_heart', cost: 3, req: ['body_2'], effects: { maxHp: 1 }, desc: 'Um remendo firme no peito: +1 coração máximo.' },

  thread_1: { branch: 'thread', col: 0, tier: 0, name: 'Carretel Maior', icon: 'icon_energy', cost: 1, req: [], effects: { maxEnergy: 20 }, desc: 'Cabe mais linha no carretel: mais energia dimensional.' },
  thread_2: { branch: 'thread', col: -1, tier: 1, name: 'Fio Que Volta', icon: 'icon_sk_regen', cost: 2, req: ['thread_1'], effects: { regen: 1.5 }, desc: 'A energia se recupera mais rápido.' },
  thread_3: { branch: 'thread', col: 1, tier: 1, name: 'Ponto Econômico', icon: 'icon_sk_eff', cost: 2, req: ['thread_1'], effects: { efficiency: 0.1 }, desc: 'Habilidades gastam menos energia.' },
  thread_4: { branch: 'thread', col: 1, tier: 2, name: 'Ponto Invisível', icon: 'icon_sk_eff', cost: 3, req: ['thread_3'], effects: { efficiency: 0.1 }, desc: 'Costura tão fina que quase não gasta linha.' },

  sew_1: { branch: 'sew', col: 0, tier: 0, name: 'Agulha Afiada', icon: 'icon_sk_power', cost: 1, req: [], effects: { power: 0.25 }, desc: 'Golpes e habilidades causam mais dano.' },
  sew_2: { branch: 'sew', col: -1, tier: 1, name: 'Nó Duplo', icon: 'icon_clock', cost: 2, req: ['sew_1'], effects: { duration: 0.2 }, desc: 'Pontes, laços e cópias duram mais.' },
  sew_6: { branch: 'sew', col: 0, tier: 1, name: 'Ritmo de Bordado', icon: 'icon_sk_combo', cost: 2, req: ['sew_1'], effects: { comboWindow: 0.1 }, desc: 'Mais tempo para encadear o combo do chicote.' },
  sew_3: { branch: 'sew', col: 1, tier: 1, name: 'Agulha de Aço', icon: 'icon_sk_power', cost: 3, req: ['sew_1'], effects: { power: 0.25 }, desc: 'Ainda mais força em cada ponto.' },
  sew_4: { branch: 'sew', col: -1, tier: 2, name: 'Arremate Eterno', icon: 'icon_clock', cost: 3, req: ['sew_2'], effects: { duration: 0.2 }, desc: 'As habilidades duram bem mais.' },
  sew_5: { branch: 'sew', col: 1, tier: 2, name: 'Coração Desfiado', icon: 'icon_ab_unravel', cost: 4, req: ['sew_3'], effects: { unravelCharge: 0.5 }, desc: 'A Forma Desfiada carrega muito mais rápido.' },
};
for (const [id, d] of Object.entries(SKILLS)) registerSkill(id, { currency: 'patches', ...d });

const SHOP = {
  heart_1: { tab: 'up', name: 'Coração de Algodão', icon: 'icon_heart', price: 300, currency: 'buttons', req: [], effects: { maxHp: 1 }, desc: '+1 coração. "Algodão egípcio, quase!"' },
  heart_2: { tab: 'up', name: 'Coração de Veludo', icon: 'icon_heart', price: 800, currency: 'buttons', req: ['heart_1'], effects: { maxHp: 1 }, desc: '+1 coração. Macio e resistente.' },
  spool_1: { tab: 'up', name: 'Carretel Extra', icon: 'icon_energy', price: 200, currency: 'buttons', req: [], effects: { maxEnergy: 25 }, desc: 'Mais energia dimensional.' },
  spool_2: { tab: 'up', name: 'Carretel Duplo', icon: 'icon_energy', price: 500, currency: 'buttons', req: ['spool_1'], effects: { maxEnergy: 25 }, desc: 'Ainda mais energia dimensional.' },
  magnet: { tab: 'up', name: 'Ímã de Botões', icon: 'icon_sk_magnet', price: 250, currency: 'buttons', req: [], effects: { magnet: 24 }, desc: 'Botões próximos vêm até você.' },
  needle_silver: { tab: 'up', name: 'Agulha de Prata', icon: 'icon_sk_power', price: 400, currency: 'buttons', req: [], effects: { efficiency: 0.1 }, desc: 'Habilidades gastam menos energia.' },
  thread_heart: { tab: 'special', name: 'Coração Ancestral', icon: 'icon_heart', price: 2, currency: 'threads', req: [], effects: { maxHp: 1 }, desc: '+1 coração tecido com fio das Tecelãs.' },
  thread_regen: { tab: 'special', name: 'Canção de Ninar', icon: 'icon_sk_regen', price: 1, currency: 'threads', req: [], effects: { regen: 2 }, desc: 'A energia volta como uma canção.' },
  thread_unravel: { tab: 'special', name: 'Fio Selvagem', icon: 'icon_ab_unravel', price: 1, currency: 'threads', req: [], effects: { unravelCharge: 0.5 }, desc: 'A Forma Desfiada carrega mais rápido.' },
  thread_dash: { tab: 'special', name: 'Pena de Tecelã', icon: 'icon_sk_dash', price: 1, currency: 'threads', req: [], effects: { dashCooldown: -0.15 }, desc: 'O dash recarrega muito mais depressa.' },
};
for (const [id, d] of Object.entries(SHOP)) registerShopItem(id, d);

// ------------------------------------------------------------- utilitários
const fmtN = (v) => String(Math.round(Math.abs(v) * 100) / 100).replace('.', ',');
const pct = (v) => Math.round(Math.abs(v) * 100) + '%';
const EFFECT_TEXT = {
  maxHp: (v) => `+${fmtN(v)} coração`,
  maxEnergy: (v) => `+${fmtN(v)} energia máx.`,
  power: (v) => `+${pct(v)} dano`,
  speed: (v) => `+${pct(v)} velocidade`,
  duration: (v) => `+${pct(v)} duração`,
  regen: (v) => `+${fmtN(v)} energia/s`,
  efficiency: (v) => `-${pct(v)} custo de energia`,
  dashCooldown: (v) => `-${fmtN(v)} s recarga do dash`,
  magnet: (v) => `+${fmtN(v)} px ímã`,
  unravelCharge: (v) => `+${pct(v)} carga desfiada`,
  comboWindow: (v) => `+${fmtN(v)} s janela de combo`,
};
export function effectText(effects) {
  return Object.entries(effects || {}).map(([k, v]) => (EFFECT_TEXT[k] ? EFFECT_TEXT[k](v) : `${k} ${v}`)).join(', ');
}
export function wallet(cur) { return save.data.inventory[CURRENCY[cur]?.key || cur] || 0; }
export function reqNames(def, map) { return (def.req || []).filter((r) => !owned(r, map)).map((r) => map.get(r)?.name || r); }
function owned(id, map) { return map === R.skills ? save.data.skills.includes(id) : save.data.shop.includes(id); }

/** 'owned' | 'available' | 'poor' (sem moeda) | 'locked' (requisito) */
export function skillState(id) {
  const d = R.skills.get(id);
  if (!d) return 'locked';
  if (save.data.skills.includes(id)) return 'owned';
  if ((d.req || []).some((r) => !save.data.skills.includes(r))) return 'locked';
  return wallet(d.currency || 'patches') >= d.cost ? 'available' : 'poor';
}
export function shopState(id) {
  const d = R.shopItems.get(id);
  if (!d) return 'locked';
  if (save.data.shop.includes(id)) return 'owned';
  if ((d.req || []).some((r) => !save.data.shop.includes(r))) return 'locked';
  return wallet(d.currency) >= d.price ? 'available' : 'poor';
}
function spend(cur, n) {
  const inv = save.data.inventory, key = CURRENCY[cur]?.key || cur;
  inv[key] = Math.max(0, (inv[key] || 0) - n);
  if (cur === 'threads') inv.threadsSpent = (inv.threadsSpent || 0) + n;
}
export function buySkill(id) {
  if (skillState(id) !== 'available') return false;
  const d = R.skills.get(id);
  spend(d.currency || 'patches', d.cost);
  save.data.skills.push(id);
  invalidateStats();
  save.commit();
  return true;
}
export function buyShopItem(id) {
  if (shopState(id) !== 'available') return false;
  const d = R.shopItems.get(id);
  spend(d.currency, d.price);
  save.data.shop.push(id);
  invalidateStats();
  save.commit();
  return true;
}
/** Compra um cosmético (R.cosmetics: price/currency). */
export function buyCosmetic(id) {
  const d = R.cosmetics.get(id);
  const c = save.data.cosmetics;
  if (!d || c.owned.includes(id) || wallet(d.currency || 'buttons') < (d.price || 0)) return false;
  spend(d.currency || 'buttons', d.price || 0);
  c.owned.push(id);
  save.commit();
  return true;
}
