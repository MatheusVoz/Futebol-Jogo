// =============================================================================
// ui/hud.js — HUD (versão base do núcleo; o agente de UI substitui).
// Interface obrigatória usada pela LevelScene:
//   new Hud(level); update(dt); draw(ctx); toast(text, icon); flashEnergy();
//   pulseAbility(); onCollect(kind, n); showTitle(name, subtitle); drawPrompt(ctx, entity)
// =============================================================================
import font from '../../engine/font.js';
import { game } from '../../engine/game.js';
import { save } from '../../engine/save.js';

export class Hud {
  constructor(level) { this.level = level; this.toasts = []; this.title = null; }
  update(dt) {
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.5);
    if (this.title) { this.title.t += dt; if (this.title.t > 3) this.title = null; }
  }
  toast(text, icon) { this.toasts.push({ text, icon, t: 0 }); }
  flashEnergy() {}
  pulseAbility() {}
  onCollect() {}
  showTitle(name, subtitle) { this.title = { name, subtitle, t: 0 }; }
  drawPrompt(ctx, e) {
    font.draw(ctx, '↑ ' + (e.prompt || 'Interagir'), Math.round(e.cx), Math.round(e.y - 14), { align: 'center', outline: '#1b1030' });
  }
  draw(ctx) {
    const p = this.level.player;
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? '#ff4f7a' : '#3a2040';
      ctx.fillRect(6 + i * 11, 6, 9, 8);
    }
    ctx.fillStyle = '#20183a'; ctx.fillRect(6, 17, 62, 5);
    ctx.fillStyle = '#55d0ff'; ctx.fillRect(7, 18, Math.round(60 * p.energy / p.maxEnergy), 3);
    font.draw(ctx, `${save.data.inventory.buttons}`, game.view.w - 8, 6, { align: 'right', outline: '#1b1030', color: '#ffd23f' });
    this.toasts.forEach((t, i) => font.draw(ctx, t.text, game.view.w / 2, 30 + i * 12, { align: 'center', outline: '#1b1030' }));
    if (this.title) font.draw(ctx, this.title.name, game.view.w / 2, 50, { align: 'center', outline: '#1b1030', scale: 2 });
  }
}
