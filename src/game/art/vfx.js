// art/vfx.js — STUB funcional (A05 substitui mantendo as MESMAS exportações e assinaturas).
/** Linha de fio luminoso animada entre dois pontos (coords de mundo no ctx atual). */
export function drawThreadLine(ctx, x0, y0, x1, y1, t = 0, color = '#ffd23f', opts = {}) {
  ctx.fillStyle = color;
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  const sag = opts.sag ?? 0;
  for (let i = 0; i <= n; i++) { const k = i / n; ctx.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag), 1, 1); }
}
/** Onda de choque (anel que expande) — adiciona entidade/efeito na fase. */
export function spawnShockwave(level, x, y, opts = {}) { level.particles.emit('hit', x, y, 12); }
/** Estrela de impacto. */
export function spawnImpact(level, x, y, opts = {}) { level.particles.emit('hit', x, y, 8); }
/** Redemoinho de portal desenhado no ctx. */
export function drawPortalSwirl(ctx, x, y, r, t = 0, colors = ['#ff4fd8', '#a855ff', '#ffffff']) {
  ctx.strokeStyle = colors[0]; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); ctx.stroke();
}
