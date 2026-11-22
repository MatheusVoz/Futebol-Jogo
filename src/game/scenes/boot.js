// =============================================================================
// boot.js — Tela de carregamento: constrói todos os sprites procedurais com
// barra de progresso e então abre a primeira cena.
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { buildAll } from '../../engine/sprites.js';
import { game } from '../../engine/game.js';
import font from '../../engine/font.js';

export class BootScene extends Scene {
  enter({ next }) {
    this.next = next;
    this.progress = 0;
    this.done = false;
    buildAll((p) => { this.progress = p; }).then(() => { this.done = true; });
  }
  update(dt) {
    if (this.done && this.time > 0.4) { this.done = false; this.next(); }
  }
  draw(ctx) {
    const { w, h } = game.view;
    ctx.fillStyle = '#0b0716';
    ctx.fillRect(0, 0, w, h);
    const bw = 140, bx = Math.round(w / 2 - bw / 2), by = Math.round(h / 2 + 10);
    font.draw(ctx, 'Costurando mundos...', w / 2, by - 18, { align: 'center', color: '#e8dcff' });
    ctx.fillStyle = '#2a1f4a'; ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(bx + 1, by + 1, Math.round((bw - 2) * this.progress), 4);
    // little stitches along the bar
    ctx.fillStyle = '#ff8fc0';
    for (let x = bx + 3; x < bx + bw - 2; x += 6) ctx.fillRect(x, by + 8, 3, 1);
  }
}
