// art/ui_kit.js — STUB funcional (A04 substitui mantendo as MESMAS exportações e assinaturas).
import { defineImage } from '../../engine/sprites.js';
import font from '../../engine/font.js';

/** Painel. style: 'paper' | 'dark' | 'wood' | 'balloon' | 'glass' */
export function drawPanel(ctx, x, y, w, h, style = 'dark') {
  const c = { paper: ['#2a1840', '#fff4dc'], dark: ['#0b0716', '#2a1f4a'], wood: ['#3a2010', '#a0703a'], balloon: ['#1b1030', '#fff8e8'], glass: ['#1b1030', '#2a3a6a'] }[style] || ['#000', '#333'];
  ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c[1]; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}
/** Botão com rótulo. opts: { selected, disabled, icon, style } */
export function drawButton(ctx, x, y, w, h, label, opts = {}) {
  drawPanel(ctx, x, y, w, h, opts.selected ? 'paper' : 'dark');
  font.draw(ctx, label, x + w / 2, y + Math.round(h / 2 - 4), { align: 'center', color: opts.disabled ? '#777' : opts.selected ? '#2a1840' : '#fff' });
}
/** Logo do jogo centralizado em cx. */
export function drawLogo(ctx, cx, y, scale = 1, t = 0) {
  font.draw(ctx, 'STITCHED WORLDS', cx, y, { align: 'center', scale: 2 * scale, color: '#7fd6ff', outline: '#1b1030' });
  font.draw(ctx, '— O ÚLTIMO BRINQUEDO —', cx, y + 22 * scale, { align: 'center', color: '#ffd23f', outline: '#1b1030' });
}
/** Barra de progresso. colors: { bg, fill, border } */
export function drawBar(ctx, x, y, w, h, ratio, colors = {}) {
  ctx.fillStyle = colors.border || '#0b0716'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colors.bg || '#2a1f4a'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = colors.fill || '#55d0ff'; ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, ratio))), h - 2);
}
/** Cursor/seta de seleção apontando para a direita, ponta em (x,y). */
export function drawCursor(ctx, x, y, t = 0) {
  const o = Math.round(Math.sin(t * 8));
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 4 + i + o, y - 3 + i, 1, 7 - i * 2);
}
const ICONS = ['icon_heart', 'icon_heart_empty', 'icon_energy', 'icon_button', 'icon_star', 'icon_star_empty', 'icon_patch', 'icon_thread', 'icon_memory', 'icon_secret', 'icon_ab_stitch', 'icon_ab_unstitch', 'icon_ab_rewind', 'icon_ab_decoy', 'icon_ab_unravel', 'icon_lock', 'icon_check'];
const COL = ['#ff4f7a', '#3a2040', '#55d0ff', '#ffd23f', '#ffe27a', '#4a4060', '#c86aff', '#ffd23f', '#ff9ad8', '#9affc8', '#ffd23f', '#ff8a3c', '#7fd6ff', '#c8f4ff', '#ff4fd8', '#888', '#6fdf6f'];
ICONS.forEach((n, i) => defineImage(n, 9, 9, (pc) => { pc.circle(4.5, 4.5, 4, COL[i]); pc.outline('#1b1030'); }));
