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

for (const w of WORLDS) {
  w.levels = [1, 2, 3, 4, 5, 6].map((i) => `w${w.id}_${i}`);
  w.bonus = `w${w.id}_bonus`;
  w.bonusStarsNeeded = 10; // estrelas do mundo para liberar a fase bônus
  registerWorld(w);
}

/** Next level id after `id` in the main progression (or null at the end of a world). */
export function nextLevelId(id) {
  const m = /^w(\d)_(\d)$/.exec(id);
  if (!m) return null;
  const w = +m[1], i = +m[2];
  if (i < 6) return `w${w}_${i + 1}`;
  return w < 5 ? `w${w + 1}_1` : null;
}
