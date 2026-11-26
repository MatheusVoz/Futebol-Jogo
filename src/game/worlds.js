// =============================================================================
// worlds.js — Definição dos 5 mundos e da ordem das fases.
// Fases: wN_1..wN_5 (normais), wN_6 (chefe), wN_bonus (secreta/desafio).
// =============================================================================
import { registerWorld } from './registry.js';

export const WORLDS = [
  { id: 1, name: 'Floresta dos Brinquedos Perdidos', short: 'Floresta', color: '#5fcf6a', dark: '#1d3a2a', music: 'w1_level', boss: 'O Coelho Sem Rosto', intro: 'world1_intro' },
  { id: 2, name: 'Oceano das Lágrimas', short: 'Oceano', color: '#4fb8ff', dark: '#0f2a4a', music: 'w2_level', boss: 'A Baleia de Vidro', intro: 'world2_intro' },
  { id: 3, name: 'Cidade dos Relógios Quebrados', short: 'Relógios', color: '#ffb84f', dark: '#3a2a1a', music: 'w3_level', boss: 'O Rei do Segundo Perdido', intro: 'world3_intro' },
  { id: 4, name: 'O Pesadelo Debaixo da Cama', short: 'Pesadelo', color: '#9a6aff', dark: '#120a24', music: 'w4_level', boss: 'A Mãe das Sombras', intro: 'world4_intro' },
  { id: 5, name: 'O Coração da Dimensão', short: 'Coração', color: '#ff4f8a', dark: '#2a0a1a', music: 'w5_level', boss: 'O Costureiro', intro: 'world5_intro' },
];

/** Fases dinâmicas (estilo "Cuphead"): entram antes do chefe de cada mundo. */
export const DYNAMIC = { 1: 'w1_climb', 2: 'w2_ride', 3: 'w3_tower', 4: 'w4_fly', 5: 'w5_rise' };

for (const w of WORLDS) {
  // 5 fases normais + 1 fase "dinâmica" (subida / voo / montaria) + chefe.
  w.levels = [`w${w.id}_1`, `w${w.id}_2`, `w${w.id}_3`, `w${w.id}_4`, `w${w.id}_5`, ...(DYNAMIC[w.id] ? [DYNAMIC[w.id]] : []), `w${w.id}_6`];
  w.bonus = `w${w.id}_bonus`;
  w.bonusStarsNeeded = 10; // estrelas do mundo para liberar a fase bônus
  registerWorld(w);
}

/** Next level id after `id` in the main progression (or null at the end of a world). */
export function nextLevelId(id) {
  for (const w of WORLDS) {
    const i = w.levels.indexOf(id);
    if (i < 0) continue;
    if (i < w.levels.length - 1) return w.levels[i + 1];
    return w.id < 5 ? WORLDS[w.id].levels[0] : null;
  }
  return null;
}
