// =============================================================================
// stats.js — Atributos do jogador derivados do save (árvore de habilidades,
// itens da loja, fios antigos). Os nós/itens registrados declaram `effects`:
//   { maxHp:+1, maxEnergy:+25, power:+0.25, speed:+0.05, duration:+0.15,
//     regen:+1.5, efficiency:+0.1, dashCooldown:-0.08, magnet:+16,
//     heartRegen:-4 (s por meio coração), ... }
// =============================================================================
import { save } from '../engine/save.js';
import { R } from './registry.js';

export const BASE_STATS = {
  maxHp: 4,          // corações
  maxEnergy: 100,    // energia dimensional
  power: 1,          // multiplicador de dano
  speed: 1,          // multiplicador de velocidade
  duration: 1,       // multiplicador de duração das habilidades
  regen: 3,          // energia por segundo
  efficiency: 0,     // redução de custo (0..0.6)
  dashCooldown: 0.45,
  magnet: 0,         // raio extra de atração de botões
  unravelCharge: 1,  // velocidade de carga da Forma Desfiada
  comboWindow: 0,
  heartRegen: 20,    // s para recuperar meio coração (vida funciona em meios corações)
};

let cache = null;
let cacheKey = '';

export function getStats() {
  const d = save.data;
  const key = d.skills.join(',') + '|' + d.shop.join(',') + '|' + (d.inventory.threadsSpent || 0);
  if (cache && key === cacheKey) return cache;
  const s = { ...BASE_STATS };
  const apply = (def) => {
    if (!def?.effects) return;
    for (const [k, v] of Object.entries(def.effects)) s[k] = (s[k] ?? 0) + v;
  };
  for (const id of d.skills) apply(R.skills.get(id));
  for (const id of d.shop) apply(R.shopItems.get(id));
  s.efficiency = Math.min(0.6, s.efficiency);
  s.maxHp = Math.min(10, Math.round(s.maxHp * 2) / 2);
  s.heartRegen = Math.max(5, s.heartRegen);
  cache = s;
  cacheKey = key;
  return s;
}
export function invalidateStats() { cache = null; }
