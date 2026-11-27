// =============================================================================
// ui/hud.js — HUD de pelúcia (ícones pixel art de ui_kit.js).
// Interface usada pela LevelScene:
//   new Hud(level); update(dt); draw(ctx); toast(text, icon); flashEnergy();
//   pulseAbility(); onCollect(kind, n); showTitle(name, subtitle); drawPrompt(ctx, entity)
// Layout: canto sup. esquerdo = corações (em MEIOS corações + indicador sutil de
// regeneração), carretel de energia, anel da Forma Desfiada, arma atual, bolhas de
// oxigênio. Ao trocar de arma: plaquinha com ícone + nome ("Soco"/"Arco"). Canto sup. direito = botões, estrelas, habilidade equipada.
// Topo central = barra do chefe, cronômetro, avisos. Os cantos inferiores ficam
// livres para os controles de toque.
// =============================================================================
import font from '../../engine/font.js';
import { game } from '../../engine/game.js';
import { save } from '../../engine/save.js';
import { input } from '../../engine/input.js';
import { getImage, defineImage } from '../../engine/sprites.js';
import { R } from '../registry.js';
import { drawPanel, drawBar, drawDisc, INK } from '../art/ui_kit.js';
import { touchControlsVisible, touchRightInset } from './touch.js';
import { WEAPONS, currentWeapon } from '../player/weapons.js';

defineImage('hud_bubble', 9, 9, (pc) => {
  pc.circle(4.5, 4.5, 3.6, '#55d0ff88');
  pc.ring(4.5, 4.5, 3.6, '#d8f8ff');
  pc.px(3, 2, '#ffffff'); pc.px(2, 3, '#ffffff');
  pc.outline(INK);
});
defineImage('hud_bubble_pop', 9, 9, (pc) => {
  for (const [x, y] of [[2, 2], [6, 2], [2, 6], [6, 6]]) pc.px(x, y, '#7fb8d8');
  pc.px(4, 4, '#3a5a7a');
});

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const WORLD_COL = { 1: '#4fa04a', 2: '#2f86c8', 3: '#e07a2a', 4: '#8a4ad0', 5: '#c23a5c' };
const TOAST_LIFE = 2.6;
const TITLE_LIFE = 3.6;

function img(name) { return getImage(name); }
function blit(ctx, name, x, y, alpha = 1) {
  const im = getImage(name);
  if (!im) return;
  if (alpha !== 1) { const a = ctx.globalAlpha; ctx.globalAlpha = a * alpha; ctx.drawImage(im, Math.round(x), Math.round(y)); ctx.globalAlpha = a; } else ctx.drawImage(im, Math.round(x), Math.round(y));
}
function sparkle(ctx, x, y, k, color = '#ffffff') {
  if (k <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x - k, y, k * 2 + 1, 1);
  ctx.fillRect(x, y - k, 1, k * 2 + 1);
}
/** Pizza de recarga: escurece a fração `f` (sentido horário a partir do topo) de um círculo. */
function sweep(ctx, cx, cy, r, f, color = '#0b0716b0') {
  if (f <= 0) return;
  ctx.fillStyle = color;
  const T = Math.PI * 2;
  for (let y = -r; y < r; y++) {
    for (let x = -r; x < r; x++) {
      const dx = x + 0.5, dy = y + 0.5;
      if (dx * dx + dy * dy > r * r) continue;
      const a = (Math.atan2(dx, -dy) + T) % T;
      if (a / T < f) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

export class Hud {
  constructor(level) {
    this.level = level;
    this.toasts = [];
    this.title = null;
    this.t = 0;
    this.alpha = 1;
    const p = level.player;
    this.lastHp = p ? p.hp : 0;
    this.heartFx = {};
    this.shakeT = 0;
    this.enShown = p ? p.energy : 0;
    this.enTrail = this.enShown;
    this.enFlashT = 0;
    this.enGainT = 0;
    this.btnShown = save.data.inventory.buttons;
    this.btnBumpT = 0;
    this.lastStars = [...(level.run?.starsFound || [false, false, false])];
    this.starPop = [0, 0, 0];
    this.abPulseT = 0;
    this.abNameT = 0;
    this.lastEq = p ? p.equipped : null;
    this.boss = null;
    this.bossFill = 0;
    this.bossShown = 0;
    this.bossTrail = 0;
    this.bossHitT = 0;
    this.bossTrailWait = 0;
    this.bossOutT = 0;
    this.unravelFullT = 0;
    this.lastWpn = currentWeapon();
    this.wpnT = 0;
  }

  // -------------------------------------------------------------- eventos
  toast(text, icon) {
    if (this.toasts.length >= 3) this.toasts[0].t = Math.max(this.toasts[0].t, TOAST_LIFE - 0.3);
    this.toasts.push({ text: String(text ?? ''), icon, t: 0 });
  }
  flashEnergy() { this.enFlashT = 0.45; }
  pulseAbility() { this.abPulseT = 0.5; this.abNameT = 1.6; }
  pulseWeapon() { this.wpnT = 1.6; this.lastWpn = currentWeapon(); }
  onCollect(kind) {
    if (kind === 'button' || kind === 'bigbutton' || kind === 'chest') this.btnBumpT = 0.3;
  }
  showTitle(name, subtitle) { this.title = { name: String(name || ''), subtitle: subtitle || '', t: 0 }; }

  // --------------------------------------------------------------- update
  update(dt) {
    const L = this.level, p = L.player;
    this.t += dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < TOAST_LIFE);
    if (this.title) { this.title.t += dt; if (this.title.t > TITLE_LIFE) this.title = null; }
    // esconde o HUD em cutscenes (não em diálogos)
    const hide = L.inputLocked && !L.dialogue?.active;
    this.alpha = clamp(this.alpha + (hide ? -dt * 4 : dt * 4), 0, 1);
    if (!p) return;
    // vida
    const hp = p.hp;
    if (hp !== this.lastHp) {
      // efeitos por coração conforme o preenchimento (0, ½, 1) mudou
      const n = Math.ceil(Math.max(hp, this.lastHp, p.maxHp));
      for (let i = 0; i < n; i++) {
        const a = clamp(this.lastHp - i, 0, 1), b = clamp(hp - i, 0, 1);
        if (b < a) this.heartFx[i] = { k: 'lose', t: 0, half: b > 0 || a < 1 };
        else if (b > a) this.heartFx[i] = { k: 'gain', t: 0, half: b < 1 || a > 0 };
      }
      if (hp < this.lastHp) this.shakeT = 0.4;
    }
    this.lastHp = hp;
    // arma
    const w = currentWeapon();
    if (w !== this.lastWpn) this.pulseWeapon();
    if (this.wpnT > 0) this.wpnT -= dt;
    for (const k of Object.keys(this.heartFx)) { const f = this.heartFx[k]; f.t += dt; if (f.t > 0.7) delete this.heartFx[k]; }
    if (this.shakeT > 0) this.shakeT -= dt;
    // energia
    if (p.energy > this.enShown + 0.5) this.enGainT = 0.35;
    this.enShown += (p.energy - this.enShown) * Math.min(1, dt * 14);
    if (this.enTrail > this.enShown) this.enTrail = Math.max(this.enShown, this.enTrail - dt * p.maxEnergy * 0.6);
    else this.enTrail = this.enShown;
    if (this.enFlashT > 0) this.enFlashT -= dt;
    if (this.enGainT > 0) this.enGainT -= dt;
    // habilidade
    if (p.equipped !== this.lastEq) { this.lastEq = p.equipped; this.pulseAbility(); }
    if (this.abPulseT > 0) this.abPulseT -= dt;
    if (this.abNameT > 0) this.abNameT -= dt;
    this.unravelFullT = p.unravelMeter >= 1 ? this.unravelFullT + dt : 0;
    // botões (contador sobe rapidinho)
    const target = save.data.inventory.buttons;
    if (this.btnShown < target) this.btnShown = Math.min(target, this.btnShown + Math.max(1, Math.ceil((target - this.btnShown) * dt * 10)));
    else this.btnShown = target;
    if (this.btnBumpT > 0) this.btnBumpT -= dt;
    // estrelas
    const sf = L.run?.starsFound || [];
    for (let i = 0; i < 3; i++) { if (sf[i] && !this.lastStars[i]) this.starPop[i] = 0.8; this.lastStars[i] = !!sf[i]; if (this.starPop[i] > 0) this.starPop[i] -= dt; }
    // chefe
    const b = L.boss;
    if (b && b !== this.boss) { this.boss = b; this.bossFill = 0; this.bossShown = 0; this.bossTrail = 0; this.bossOutT = 0; }
    if (this.boss) {
      const bb = this.boss;
      const ratio = clamp((bb.hp || 0) / (bb.maxHp || 1), 0, 1);
      if (!b || bb.dead) { this.bossOutT += dt; if (this.bossOutT > 0.8) this.boss = null; }
      this.bossFill = Math.min(1, this.bossFill + dt * 1.2);
      const shown = Math.min(ratio, this.bossFill);
      if (shown < this.bossShown - 0.001 && this.bossFill >= 1) { this.bossHitT = 0.22; this.bossTrailWait = 0.45; }
      this.bossShown = shown;
      if (this.bossTrailWait > 0) this.bossTrailWait -= dt;
      else if (this.bossTrail > shown) this.bossTrail = Math.max(shown, this.bossTrail - dt * 0.6);
      if (this.bossTrail < shown) this.bossTrail = shown;
      if (this.bossHitT > 0) this.bossHitT -= dt;
    }
  }

  // ----------------------------------------------------------------- draw
  draw(ctx) {
    const L = this.level, p = L.player;
    if (!p) return;
    const W = game.view.w, H = game.view.h;
    const touch = touchControlsVisible();
    const rIn = touch ? touchRightInset() : 5;
    const a0 = ctx.globalAlpha;
    if (this.alpha > 0.01) {
      ctx.globalAlpha = a0 * this.alpha;
      const leftEnd = this.drawLeft(ctx, p);
      const rightStart = this.drawRight(ctx, p, W - rIn, touch);
      this.leftEnd = leftEnd; this.rightStart = rightStart;
      ctx.globalAlpha = a0;
    }
    let topY = 4;
    if (this.boss) topY = this.drawBoss(ctx, W) + 3;
    if (save.settings.showTimer) topY = this.drawTimer(ctx, W, topY) + 2;
    this.drawToasts(ctx, W, topY);
    this.drawTitle(ctx, W, H);
    ctx.globalAlpha = a0;
  }

  drawLeft(ctx, p) {
    const x0 = 4, y0 = 3;
    const n = Math.max(1, Math.ceil(p.maxHp));
    const perRow = 10;
    const shake = this.shakeT > 0 ? Math.round(Math.sin(this.t * 70) * 2 * (this.shakeT / 0.4)) : 0;
    const rows = Math.ceil(n / perRow);
    const regenK = p.regenK || 0;
    const regenIdx = regenK > 0 ? Math.floor(p.hp) : -1;      // coração que está enchendo
    const regenRight = p.hp % 1 >= 0.5;                       // metade direita (a esquerda já está cheia)
    for (let i = 0; i < n; i++) {
      const hx = x0 + (i % perRow) * 12 + shake, hy = y0 + Math.floor(i / perRow) * 11;
      const fill = p.hp >= i + 1 ? 'icon_heart' : p.hp >= i + 0.5 ? 'icon_heart_half' : 'icon_heart_empty';
      const fx = this.heartFx[i];
      let dy = 0;
      if (fx && fx.k === 'gain' && fx.t < 0.35) dy = -Math.round(Math.sin((fx.t / 0.35) * Math.PI) * 2);
      if (p.hp > 0 && p.hp <= 1 && i === 0 && (this.t % 0.9) < 0.14) dy = -1;
      blit(ctx, fill, hx, hy + dy);
      if (i === regenIdx) this.drawRegen(ctx, hx, hy + dy, regenRight, regenK);
      if (p.hp > 0 && p.hp <= 1 && i === 0 && (this.t % 0.9) < 0.1) blit(ctx, 'icon_heart_flash', hx, hy + dy, 0.45);
      if (fx && fx.k === 'lose') {
        if (fx.t < 0.1) blit(ctx, 'icon_heart_flash', hx, hy);
        else if (fx.t < 0.55) {
          const k = (fx.t - 0.1) / 0.45;
          if (fx.half) this.blitHalf(ctx, 'icon_heart', hx + Math.round(k * 3), hy - Math.round(k * 9), p.hp > i, 1 - k);
          else blit(ctx, 'icon_heart', hx + Math.round(k * 3), hy - Math.round(k * 9), 1 - k);
        }
      } else if (fx && fx.k === 'gain') {
        const k = Math.round(2 - Math.abs(fx.t - 0.3) * 6);
        sparkle(ctx, hx + 1, hy + 1, k);
        sparkle(ctx, hx + 11, hy + 7, k - 1, '#ffe0ea');
      }
    }
    let y = y0 + rows * 11 + 2;
    // carretel de energia
    const ex = x0 + (this.enFlashT > 0 ? Math.round(Math.sin(this.t * 80) * 1.5) : 0);
    const spoolDy = this.enGainT > 0 ? -1 : 0;
    blit(ctx, 'icon_energy', ex, y + spoolDy);
    const bw = clamp(Math.round(50 * p.maxEnergy / 100), 40, 96);
    const bx = ex + 12, by = y + 2;
    const flash = this.enFlashT > 0 && Math.floor(this.enFlashT * 16) % 2 === 0;
    const cost = this.abilityCost(p);
    const fillCol = flash ? '#ff4f7a' : p.energy < cost ? '#3f9fd8' : '#55d0ff';
    const r = clamp(this.enShown / (p.maxEnergy || 1), 0, 1);
    drawBar(ctx, bx, by, bw, 7, r, { fill: fillCol, bg: '#1c1434', border: INK });
    const tr = clamp(this.enTrail / (p.maxEnergy || 1), 0, 1);
    if (tr > r + 0.005) {
      const xa = bx + 1 + Math.round((bw - 2) * r), xb = bx + 1 + Math.round((bw - 2) * tr);
      ctx.fillStyle = '#fff4dccc'; ctx.fillRect(xa, by + 1, xb - xa, 5);
    }
    if (cost > 0 && cost < p.maxEnergy) { // marca do custo da habilidade
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(bx + 1 + Math.round((bw - 2) * cost / p.maxEnergy), by - 1, 1, 2);
    }
    let right = bx + bw;
    // anel dourado da Forma Desfiada
    if (save.data.abilities?.unravel) {
      this.drawUnravel(ctx, right + 8, y + 5, p.unravelMeter || 0);
      right += 15;
    }
    // arma atual (teclado/controle; no toque o botão de ataque já mostra)
    const wdef = WEAPONS[currentWeapon()];
    if (!touchControlsVisible()) {
      const im = img(wdef.icon);
      if (im) {
        const pop = this.wpnT > 1.3 ? -Math.round(Math.sin(((this.wpnT - 1.3) / 0.3) * Math.PI) * 2) : 0;
        ctx.drawImage(im, right + 3, Math.round(y + 6 - im.height / 2) + pop);
        right += im.width + 3;
      }
    }
    y += 12;
    // plaquinha ao trocar de arma
    if (this.wpnT > 0) {
      const a = ctx.globalAlpha;
      const inK = clamp((1.6 - this.wpnT) / 0.18, 0, 1), outK = clamp(this.wpnT / 0.3, 0, 1);
      ctx.globalAlpha = a * Math.min(inK, outK);
      const im = img(wdef.icon);
      const label = wdef.name;
      const w = font.measure(label) + (im ? im.width + 4 : 0) + 12;
      const px = x0 - Math.round((1 - easeOutBack(inK)) * 12);
      drawPanel(ctx, px, y, w, 15, 'dark');
      if (im) ctx.drawImage(im, px + 5, Math.round(y + 7.5 - im.height / 2));
      font.draw(ctx, label, px + 6 + (im ? im.width + 3 : 0), y + 4, { color: wdef.color, shadow: '#0b0716' });
      ctx.globalAlpha = a;
      y += 17;
    }
    // oxigênio
    if (this.level.data?.oxygen && p.oxygen < 1) {
      const n2 = 5, ox = Math.max(0, p.oxygen);
      const blink = ox < 0.3 && Math.floor(this.t * 6) % 2 === 0;
      for (let i = 0; i < n2; i++) {
        const v = ox * n2 - i;
        const name = v > 0.15 ? 'hud_bubble' : 'hud_bubble_pop';
        blit(ctx, name, x0 + i * 9, y + (v > 0.15 && v < 1 ? Math.round((1 - v) * 2) : 0), blink ? 0.4 : 1);
      }
      y += 10;
    }
    return right;
  }

  /** Metade (esquerda/direita) de um ícone de coração. */
  blitHalf(ctx, name, x, y, right, alpha = 1) {
    const im = getImage(name);
    if (!im) return;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    const hw = 7; // a costura do meio fica na coluna 6
    if (right) ctx.drawImage(im, hw, 0, im.width - hw, im.height, Math.round(x) + hw, Math.round(y), im.width - hw, im.height);
    else ctx.drawImage(im, 0, 0, hw, im.height, Math.round(x), Math.round(y), hw, im.height);
    ctx.globalAlpha = a;
  }
  /** Indicador sutil de regeneração: a metade vazia vai "enchendo" de baixo p/ cima e pulsa. */
  drawRegen(ctx, x, y, right, k) {
    const im = getImage('icon_heart');
    if (!im) return;
    const a = ctx.globalAlpha;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * (3 + k * 5));
    const sx = right ? 7 : 1, sw = right ? im.width - 8 : 6;
    const top = 1, inner = im.height - 3;              // área útil do coração
    const fh = Math.max(1, Math.round(inner * k));
    const sy = top + inner - fh;
    ctx.globalAlpha = a * (0.18 + 0.16 * k + 0.1 * pulse);
    ctx.drawImage(im, sx, sy, sw, fh, Math.round(x) + sx, Math.round(y) + sy, sw, fh);
    // linha de "costura" brilhante no topo do que já encheu
    if (k > 0.05) {
      ctx.globalAlpha = a * (0.35 + 0.35 * pulse);
      ctx.fillStyle = '#ffd0dc';
      for (let i = sx; i < sx + sw; i += 2) ctx.fillRect(Math.round(x) + i, Math.round(y) + sy, 1, 1);
    }
    ctx.globalAlpha = a;
  }

  drawUnravel(ctx, cx, cy, m) {
    const T = Math.PI * 2;
    const full = m >= 1;
    const glow = full && Math.floor(this.unravelFullT * 8) % 2 === 0;
    for (let y = -7; y < 7; y++) {
      for (let x = -7; x < 7; x++) {
        const dx = x + 0.5, dy = y + 0.5, d = Math.hypot(dx, dy);
        if (d > 6.4) continue;
        let c;
        if (d > 5.4 || (d > 2.2 && d <= 3.2)) c = INK;
        else if (d > 3.2) {
          const a = (Math.atan2(dx, -dy) + T) % T;
          c = a / T < m ? (full ? (glow ? '#ffb0ec' : '#ff4fd8') : dy < 0 ? '#fff0a0' : '#ffd23f') : '#3a2a50';
        } else c = full ? (glow ? '#ffffff' : '#ff4fd8') : '#2a1f4a';
        ctx.fillStyle = c;
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  abilityDef(p) {
    if (!save.data.abilities?.[p.equipped]) return null;
    return R.abilities.get(p.equipped) || null;
  }
  abilityCost(p) { const d = this.abilityDef(p); return d ? (d.cost || 0) : 0; }

  drawRight(ctx, p, xr, touch) {
    // botões
    const bump = this.btnBumpT > 0 ? Math.round(Math.sin((this.btnBumpT / 0.3) * Math.PI) * 2) : 0;
    const txt = String(this.btnShown);
    const tw = font.measure(txt);
    blit(ctx, 'icon_button', xr - 11, 4 - bump);
    font.draw(ctx, txt, xr - 13, 6, { align: 'right', color: bump ? '#ffffff' : '#ffd23f', outline: INK });
    let minX = xr - 15 - tw;
    // estrelas
    const sf = this.level.run?.starsFound || [];
    for (let i = 0; i < 3; i++) {
      const sx = xr - 13 - (2 - i) * 12, pop = this.starPop[i];
      const dy = pop > 0.4 ? -Math.round(Math.sin(((pop - 0.4) / 0.4) * Math.PI) * 3) : 0;
      blit(ctx, sf[i] ? 'icon_star' : 'icon_star_empty', sx, 17 + dy);
      if (pop > 0) sparkle(ctx, sx + 6, 22, Math.round(3 * Math.min(1, pop * 2)), '#fffbe0');
    }
    minX = Math.min(minX, xr - 37);
    // habilidade equipada
    const def = this.abilityDef(p);
    if (def) {
      const r = 10, cx = xr - r, cy = 41;
      const cost = def.cost || 0, enough = p.energy >= cost;
      const cdMax = def.cooldown || 0, cd = p.cooldownOf ? p.cooldownOf(p.equipped) : 0;
      if (!touch) {
        const pr = this.abPulseT > 0 ? Math.round(this.abPulseT * 4) : 0;
        drawDisc(ctx, cx, cy, r + pr, enough ? (def.color || '#ffd23f') : '#5a4e7a', false);
        const im = img(def.icon || 'icon_ab_' + p.equipped);
        if (im) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (enough ? 1 : 0.55);
          ctx.drawImage(im, Math.round(cx - im.width / 2), Math.round(cy - im.height / 2));
          ctx.globalAlpha = a;
        }
        if (cdMax > 0 && cd > 0) sweep(ctx, cx, cy, r - 1, clamp(cd / cdMax, 0, 1));
        if (this.abPulseT > 0) {
          const k = 1 - this.abPulseT / 0.5, rr = Math.round(r + 2 + k * 8);
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (1 - k);
          ctx.fillStyle = def.color || '#ffd23f';
          for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(an) * rr), Math.round(cy + Math.sin(an) * rr), 1, 1); }
          ctx.globalAlpha = a;
        }
        if (cost > 0) {
          const ct = String(cost);
          font.draw(ctx, ct, cx - r - 2, cy - 3, { align: 'right', color: enough ? '#7fd6ff' : '#ff6b8a', outline: INK });
          minX = Math.min(minX, cx - r - 3 - font.measure(ct));
        }
      }
      if (this.abNameT > 0) {
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * clamp(this.abNameT / 0.3, 0, 1);
        font.draw(ctx, def.name || p.equipped, xr, touch ? 31 : 55, { align: 'right', color: def.color || '#ffd23f', outline: INK });
        ctx.globalAlpha = a;
      }
    }
    return minX;
  }

  drawBoss(ctx, W) {
    const b = this.boss;
    const leftEnd = (this.leftEnd || 80) + 6, rightStart = this.rightStart || W - 60;
    const half = Math.min(W / 2 - leftEnd, rightStart - W / 2) - 4;
    const bw = Math.round(clamp(half * 2 - 12, 90, 220));
    const fx = Math.round((W - bw) / 2) - 5;
    const shake = this.bossHitT > 0 ? Math.round(Math.sin(this.t * 90) * 1.5) : 0;
    const a = ctx.globalAlpha;
    const fade = clamp(1 - this.bossOutT / 0.8, 0, 1) * clamp(this.bossFill * 3, 0, 1);
    ctx.globalAlpha = a * fade;
    const fy = 1 + Math.round((1 - clamp(this.bossFill * 2.5, 0, 1)) * -26);
    drawPanel(ctx, fx + shake, fy, bw + 10, 25, 'dark');
    const name = b.bossName || 'Chefe';
    const nw = font.measure(name);
    const skull = img('icon_skull');
    const total = nw + (skull ? skull.width + 3 : 0);
    const nx = Math.round(W / 2 - total / 2) + shake;
    if (skull) ctx.drawImage(skull, nx, fy + 4);
    font.draw(ctx, name, nx + (skull ? skull.width + 3 : 0), fy + 5, { color: '#fff4dc', shadow: '#0b0716' });
    const bx = fx + 5 + shake, by = fy + 14;
    drawBar(ctx, bx, by, bw, 7, this.bossTrail, { fill: '#fff0b0', bg: '#1c1434', border: INK });
    const fw = Math.round((bw - 2) * this.bossShown);
    if (fw > 0) {
      const flash = this.bossHitT > 0.12;
      ctx.fillStyle = flash ? '#ffffff' : '#ff4f7a'; ctx.fillRect(bx + 1, by + 1, fw, 5);
      ctx.fillStyle = flash ? '#ffffff' : '#ff9ab4'; ctx.fillRect(bx + 1, by + 1, fw, 1);
      ctx.fillStyle = flash ? '#ffe0e8' : '#c22a55'; ctx.fillRect(bx + 1, by + 5, fw, 1);
      ctx.fillStyle = '#a01a44';
      for (let i = 3; i < fw - 1; i += 4) ctx.fillRect(bx + 1 + i, by + 3, 2, 1); // pesponto
    }
    ctx.fillStyle = '#1b103099';
    for (const q of [0.25, 0.5, 0.75]) ctx.fillRect(bx + 1 + Math.round((bw - 2) * q), by + 1, 1, 5);
    ctx.globalAlpha = a;
    return fy + 25;
  }

  drawTimer(ctx, W, y) {
    const t = this.level.run?.timer || 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
    const txt = `${m}:${String(s).padStart(2, '0')}.${d}`;
    const tw = font.measure(txt);
    const x = Math.round(W / 2 - (tw + 15) / 2);
    blit(ctx, 'icon_clock', x, y);
    font.draw(ctx, txt, x + 15, y + 3, { color: '#fff4dc', outline: INK });
    return y + 13;
  }

  drawToasts(ctx, W, y0) {
    let y = y0;
    for (const t of this.toasts) {
      const inK = clamp(t.t / 0.28, 0, 1), outK = clamp((t.t - (TOAST_LIFE - 0.35)) / 0.35, 0, 1);
      const im = t.icon ? img(t.icon) : null;
      const tw = font.measure(t.text);
      const w = tw + 14 + (im ? im.width + 4 : 0), h = 17;
      const x = Math.round(W / 2 - w / 2);
      const yy = Math.round(y - (1 - easeOutBack(inK)) * (h + y0) - outK * 12);
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * (1 - outK) * clamp(inK * 3, 0, 1);
      drawPanel(ctx, x, yy, w, h, 'dark');
      let tx = x + 7;
      if (im) {
        const bob = t.t < 0.6 ? -Math.round(Math.sin((t.t / 0.6) * Math.PI * 2) * 1.5) : 0;
        ctx.drawImage(im, tx, Math.round(yy + (h - im.height) / 2) + bob);
        tx += im.width + 4;
      }
      font.draw(ctx, t.text, tx, yy + 5, { color: '#fff4dc', shadow: '#0b0716' });
      ctx.globalAlpha = a;
      y += Math.round((h + 2) * (1 - outK));
    }
  }

  drawTitle(ctx, W, H) {
    const T = this.title;
    if (!T) return;
    const t = T.t;
    const L = this.level;
    const sub = T.subtitle || (L.data?.world ? `Mundo ${L.data.world}-${L.data.index || 1}` : '');
    let scale = 2;
    if (font.measure(T.name) * 2 + 48 > W - 24) scale = 1;
    const nw = font.measure(T.name) * scale;
    const rh = scale === 2 ? 24 : 15;
    const fullW = nw + 40;
    const unroll = clamp(t / 0.45, 0, 1);
    const k = 1 - Math.pow(1 - unroll, 3);
    const out = clamp((t - (TITLE_LIFE - 0.6)) / 0.6, 0, 1);
    const rw = Math.max(4, Math.round(fullW * k));
    const cy = Math.round(H * 0.3 - out * 10);
    const x = Math.round(W / 2 - rw / 2), y = cy - Math.floor(rh / 2);
    const col = WORLD_COL[L.data?.world] || '#e8456a';
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * (1 - out);
    // caudas dobradas
    const tail = (ex, dir) => {
      const tl = 12, th = rh - 2;
      for (let j = 0; j < th; j++) {
        const n = Math.round(6 * (1 - Math.abs(j - (th - 1) / 2) / ((th - 1) / 2)));
        const len = tl - n;
        const xx = dir > 0 ? ex : ex - len;
        ctx.fillStyle = INK; ctx.fillRect(xx, y + 5 + j, len, 1);
        if (j > 0 && j < th - 1 && len > 1) { ctx.fillStyle = j === 1 ? shade(col, -0.05) : shade(col, -0.3); ctx.fillRect(dir > 0 ? xx : xx + 1, y + 5 + j, len - 1, 1); }
      }
    };
    if (k > 0.6) { tail(x + rw - 2, 1); tail(x + 2, -1); }
    ctx.fillStyle = INK; ctx.fillRect(x, y, rw, rh);
    ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, rw - 2, rh - 2);
    ctx.fillStyle = shade(col, 0.35); ctx.fillRect(x + 1, y + 1, rw - 2, 1);
    ctx.fillStyle = shade(col, -0.25); ctx.fillRect(x + 1, y + rh - 2, rw - 2, 1);
    ctx.fillStyle = shade(col, 0.6);
    for (let i = 3; i < rw - 4; i += 4) { ctx.fillRect(x + i, y + 3, 2, 1); ctx.fillRect(x + i, y + rh - 4, 2, 1); }
    if (unroll >= 1) {
      const ta = clamp((t - 0.45) / 0.25, 0, 1);
      ctx.globalAlpha = a * (1 - out) * ta;
      font.draw(ctx, T.name, Math.round(W / 2), y + Math.round((rh - 7 * scale) / 2), { align: 'center', scale, color: '#fff4dc', shadow: shade(col, -0.55) });
      if (sub) {
        const sw = font.measure(sub) + 12;
        const sx = Math.round(W / 2 - sw / 2), sy = y - 13;
        drawPanel(ctx, sx, sy, sw, 14, 'paper');
        font.draw(ctx, sub, Math.round(W / 2), sy + 4, { align: 'center', color: '#5a3a2a' });
      }
    }
    ctx.globalAlpha = a;
  }

  // ------------------------------------------------------ prompt (MUNDO)
  drawPrompt(ctx, e) {
    if (!e) return;
    const label = e.prompt || 'Interagir';
    const touch = touchControlsVisible() || input.lastDevice === 'touch';
    const lw = font.measure(label);
    const iw = touch ? 11 : 9;
    const w = lw + iw + 9, h = 14;
    const bob = Math.round(Math.sin(this.t * 5));
    const cx = Math.round(e.cx ?? (e.x + (e.w || 0) / 2));
    const x = cx - Math.floor(w / 2), y = Math.round(e.y) - h - 9 + bob;
    drawPanel(ctx, x, y, w, h, 'balloon');
    ctx.fillStyle = INK; ctx.fillRect(cx - 2, y + h - 1, 5, 1); ctx.fillRect(cx - 1, y + h, 3, 1); ctx.fillRect(cx, y + h + 1, 1, 1);
    ctx.fillStyle = '#fff8e8'; ctx.fillRect(cx - 1, y + h - 1, 3, 1); ctx.fillRect(cx, y + h, 1, 1);
    if (touch) blit(ctx, 'icon_hand', x + 3, y + 1);
    else { // tecla ↑
      const kx = x + 3, ky = y + 2;
      ctx.fillStyle = INK; ctx.fillRect(kx, ky, 9, 10);
      ctx.fillStyle = '#d9bf8f'; ctx.fillRect(kx + 1, ky + 1, 7, 8);
      ctx.fillStyle = '#fff4dc'; ctx.fillRect(kx + 1, ky + 1, 7, 7);
      ctx.fillStyle = INK; ctx.fillRect(kx + 4, ky + 2, 1, 5); ctx.fillRect(kx + 3, ky + 3, 3, 1); ctx.fillRect(kx + 2, ky + 4, 1, 1); ctx.fillRect(kx + 6, ky + 4, 1, 1);
    }
    font.draw(ctx, label, x + iw + 5, y + 4, { color: INK });
  }
}

const shadeCache = new Map();
function shade(c, k) {
  const key = c + k;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(c.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const tgt = k > 0 ? 255 : 0, f = Math.abs(k);
  r = Math.round(r + (tgt - r) * f); g = Math.round(g + (tgt - g) * f); b = Math.round(b + (tgt - b) * f);
  v = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  shadeCache.set(key, v);
  return v;
}
