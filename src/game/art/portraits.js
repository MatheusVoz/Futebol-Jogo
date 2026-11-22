// art/portraits.js — STUB funcional (A02 substitui mantendo as MESMAS exportações e assinaturas).
import { R, registerPortrait } from '../registry.js';
export const PORTRAIT_SIZE = 48;
const NAMES = { tico: ['Tico', '#3fc7c0'], lia: ['Lia', '#ff9ad8'], vo_celeste: ['Vó Celeste', '#d8b0ff'], costureiro: ['O Costureiro', '#a855ff'], botao: ['Sr. Botão', '#c89a5a'], pip: ['Pip', '#c0c8d8'], agulheta: ['Agulheta', '#ff6fa8'], capita_bolha: ['Capitã Bolha', '#ffd23f'], tique_taque: ['Tique-Taque', '#ffb84f'], luzinha: ['Luzinha', '#fff3a0'], fiapo: ['Fiapo', '#e0c8a8'], coelho: ['Coelho Sem Rosto', '#d8c8d0'], baleia: ['Baleia de Vidro', '#9fe8ff'], rei: ['Rei do Segundo Perdido', '#ffcf6a'], mae_sombras: ['Mãe das Sombras', '#9a6aff'], tecela: ['Eco da Tecelã', '#ffe8b0'], narrador: ['', '#ffffff'], placa: ['', '#c89a5a'] };
for (const [id, [name, color]] of Object.entries(NAMES)) registerPortrait(id, { name, color });
/** {name, color} do personagem. */
export function portraitInfo(who) { const p = R.portraits.get(who); return p ? { name: p.name, color: p.color } : { name: who || '', color: '#fff' }; }
/** Desenha o retrato 48x48 com canto sup. esq. em (x,y). opts: { talking, t, flip } */
export function drawPortrait(ctx, who, expr = 'neutral', x, y, opts = {}) {
  if (who === 'narrador' || who === 'placa' || !who) return;
  const { color } = portraitInfo(who);
  ctx.fillStyle = '#1b1030'; ctx.fillRect(x, y, PORTRAIT_SIZE, PORTRAIT_SIZE);
  ctx.fillStyle = color; ctx.fillRect(x + 8, y + 8, 32, 32);
  ctx.fillStyle = '#000'; ctx.fillRect(x + 28, y + 18, 3, 4);
  if (opts.talking && Math.floor((opts.t || 0) * 10) % 2) ctx.fillRect(x + 24, y + 30, 6, 2);
}
