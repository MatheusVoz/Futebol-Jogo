// =============================================================================
// ui/dialogue.js — Caixa de diálogo (versão base do núcleo; o agente substitui).
// Interface obrigatória:
//   new DialogueBox(scene)  start(lines, opts) -> Promise<choiceIndex|undefined>
//   update(dt)  draw(ctx)  get active
// Formato das falas: veja docs/ARCHITECTURE.md §Diálogos.
// =============================================================================
import font from '../../engine/font.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';

export class DialogueBox {
  constructor(scene) { this.scene = scene; this.lines = null; this.i = 0; this.chars = 0; this.resolve = null; }
  get active() { return !!this.lines; }
  start(lines, opts = {}) {
    this.lines = lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    this.i = 0; this.chars = 0;
    return new Promise((res) => { this.resolve = res; });
  }
  update(dt) {
    if (!this.lines) return;
    const line = this.lines[this.i];
    const len = font.visibleLength(line.text);
    this.chars = Math.min(len, this.chars + dt * 45);
    if (input.pressed('jump') || input.pressed('attack') || input.pressed('confirm') || input.pointer.pressed) {
      if (this.chars < len) this.chars = len;
      else { this.i++; this.chars = 0; if (this.i >= this.lines.length) { const r = this.resolve; this.lines = null; r && r(); } }
    }
  }
  draw(ctx) {
    if (!this.lines) return;
    const line = this.lines[this.i];
    const w = game.view.w - 40, h = 46, x = 20, y = game.view.h - h - 8;
    ctx.fillStyle = '#1b1030'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (line.who) font.draw(ctx, line.who, x + 6, y + 4, { color: '#7a3aa0' });
    font.draw(ctx, line.text, x + 6, y + 16, { color: '#2a1840', maxWidth: w - 12, maxChars: Math.floor(this.chars) });
  }
}
