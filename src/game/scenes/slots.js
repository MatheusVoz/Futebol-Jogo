// =============================================================================
// slots.js — Escolha de jogo salvo (3 slots), aberta pelo botão "Jogar" do título.
// Slot com jogo: mostra estrelas, mundos, memórias e tempo → continuar.
// Slot vazio: "Novo Jogo". Cada slot cheio pode ser apagado (com confirmação).
// params: { onPlay(slot), onNew(slot) }
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { audio } from '../../engine/audio.js';
import { save, SLOT_COUNT } from '../../engine/save.js';
import { drawSprite, animFrame, getImage } from '../../engine/sprites.js';
import font from '../../engine/font.js';
import { clamp, Ease } from '../../engine/util.js';
import { registerScene } from '../registry.js';
import { drawPanel, drawButton } from '../art/ui_kit.js';
import { ConfirmBox } from './menus_basic.js';

const fmtTime = (s) => { const m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? `${h}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };

class SlotsScene extends Scene {
  get overlay() { return true; }
  enter(params = {}) {
    this.params = params;
    this.slots = save.listSlots();
    this.sel = save.settings.lastSlot || 0;
    this.confirm = null;
    this.rects = [];
  }
  close() { audio.sfx('ui_back'); this.manager.pop(); }
  choose(i) {
    const s = this.slots[i];
    audio.sfx('ui_select');
    if (s.exists) this.params.onPlay?.(i);
    else this.params.onNew?.(i);
  }
  askDelete(i) {
    audio.sfx('ui_open');
    this.confirm = new ConfirmBox(`Apagar o Jogo ${i + 1}? Isso não pode ser desfeito.`, () => {
      save.deleteSlot(i); this.slots = save.listSlots(); audio.sfx('break_block');
    }, null, { yes: 'Apagar', no: 'Não' });
  }
  update(dt) {
    if (this.confirm) { this.confirm.update(dt); if (this.confirm.closed) this.confirm = null; return; }
    if (input.pressed('left')) { this.sel = (this.sel + SLOT_COUNT - 1) % SLOT_COUNT; audio.sfx('ui_move'); }
    if (input.pressed('right')) { this.sel = (this.sel + 1) % SLOT_COUNT; audio.sfx('ui_move'); }
    if (input.pressed('up') || input.pressed('down')) { this.sel = (this.sel + (input.pressed('down') ? 1 : SLOT_COUNT - 1)) % SLOT_COUNT; audio.sfx('ui_move'); }
    if (input.pressed('confirm') || input.pressed('jump')) { input.consume('confirm'); input.consume('jump'); this.choose(this.sel); return; }
    if (input.pressed('dash') && this.slots[this.sel].exists) { this.askDelete(this.sel); return; }
    if (input.pressed('back') || input.pressed('pause')) { input.consume('back'); input.consume('pause'); this.close(); return; }
    const p = input.pointer;
    if (p.pressed) {
      const hit = (r) => r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
      if (hit(this.backRect)) { this.close(); return; }
      this.rects.forEach((r, i) => {
        if (hit(r.del) && this.slots[i].exists) { this.sel = i; this.askDelete(i); }
        else if (hit(r.card)) { if (this.sel === i) this.choose(i); else { this.sel = i; audio.sfx('ui_move'); } }
      });
    }
  }
  draw(ctx) {
    const { w, h } = game.view, t = this.time;
    ctx.fillStyle = 'rgba(11,7,22,0.72)';
    ctx.fillRect(0, 0, w, h);
    const k = Ease.outCubic(clamp(this.time / 0.25, 0, 1));
    font.draw(ctx, 'Escolha um jogo', w / 2, 12, { align: 'center', color: '#ffd23f', outline: '#1b1030', scale: 1 });
    const gap = 8, cw = Math.min(150, Math.floor((w - 24 - gap * 2) / 3)), ch = Math.min(150, h - 70);
    const x0 = Math.round(w / 2 - (cw * 3 + gap * 2) / 2), y0 = Math.round(30 + (1 - k) * 12);
    this.rects = [];
    this.slots.forEach((s, i) => {
      const x = x0 + i * (cw + gap), y = y0, selected = i === this.sel;
      const lift = selected ? -3 : 0;
      drawPanel(ctx, x, y + lift, cw, ch, selected ? 'paper' : 'dark');
      const ink = selected ? '#2a1840' : '#fff4dc', dim = selected ? '#6a5878' : '#a898c0';
      font.draw(ctx, `Jogo ${i + 1}`, x + cw / 2, y + lift + 7, { align: 'center', color: selected ? '#a02848' : '#ffd23f' });
      const cx = x + cw / 2;
      if (s.exists) {
        drawSprite(ctx, 'tico', selected ? 'walk' : 'idle', animFrame('tico', selected ? 'walk' : 'idle', t), cx, y + lift + 62);
        const rows = [
          ['icon_star', `${s.stars} estrelas`],
          ['icon_map', `Mundo ${s.worlds} de 5`],
          ['icon_memory', `${s.memories}/10 memórias`],
          ['icon_clock', fmtTime(s.playTime)],
        ];
        rows.forEach(([ic, txt], j) => {
          const ry = y + lift + 66 + j * 11;
          const im = getImage(ic);
          if (im) ctx.drawImage(im, x + 10, ry);
          font.draw(ctx, txt, x + 24, ry + 2, { color: ink });
        });
        const del = { x: x + cw / 2 - 26, y: y + lift + ch - 20, w: 52, h: 14 };
        drawButton(ctx, del.x, del.y, del.w, del.h, 'Apagar', { selected: false });
        this.rects.push({ card: { x, y, w: cw, h: ch - 22 }, del });
      } else {
        ctx.globalAlpha = 0.5;
        drawSprite(ctx, 'tico', 'sleep', animFrame('tico', 'sleep', t), cx, y + lift + 62);
        ctx.globalAlpha = 1;
        font.draw(ctx, 'Vazio', cx, y + lift + 76, { align: 'center', color: dim });
        font.draw(ctx, '+ Novo Jogo', cx, y + lift + 92, { align: 'center', color: ink });
        this.rects.push({ card: { x, y, w: cw, h: ch } });
      }
    });
    this.backRect = { x: Math.round(w / 2 - 34), y: h - 22, w: 68, h: 16 };
    drawButton(ctx, this.backRect.x, this.backRect.y, this.backRect.w, this.backRect.h, 'Voltar', { icon: 'icon_arrow_l' });
    if (this.confirm) this.confirm.draw(ctx, t);
  }
}
registerScene('slots', SlotsScene);
