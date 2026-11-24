// =============================================================================
// scenes/menus_progress.js — Telas de progresso (overlay; abrem do mapa e da pausa):
//   'inventory'    coletáveis, estrelas por mundo e habilidades
//   'skilltree'    árvore de habilidades (Corpo / Fio / Costura) paga com retalhos
//   'shop'         barraquinha da Agulheta (Melhorias / Especiais / Cosméticos)
//   'memories'     Livro de Memórias (vinhetas animadas, páginas trancadas "???")
//   'memory_view'  (id, {onClose}) vinheta costurada ao pegar uma memória
//   'wardrobe'     guarda-roupa do Tico (chapéu, pescoço, costas, linha)
// Todas fecham com voltar/pausa ou com o botão "Voltar" na tela, funcionam com
// teclado/gamepad e toque, e cabem em larguras lógicas de 320 a 560 px.
// =============================================================================
import { Scene } from '../../engine/scene.js';
import { game } from '../../engine/game.js';
import { input } from '../../engine/input.js';
import { save } from '../../engine/save.js';
import { audio, hasSong } from '../../engine/audio.js';
import font from '../../engine/font.js';
import { createCanvas } from '../../engine/pixel.js';
import { drawSprite, animFrame, animDuration, getImage } from '../../engine/sprites.js';
import { clamp, Ease, pick } from '../../engine/util.js';
import { R, registerScene } from '../registry.js';
import { WORLDS } from '../worlds.js';
import { drawPanel, drawButton, drawCursor, drawDisc } from '../art/ui_kit.js';
import { drawPortrait } from '../art/portraits.js';
import {
  drawCosmetics, drawCosmeticPreview, cosmeticsInSlot, ownsCosmetic, cosmeticUnlocked,
  cosmeticLockText, equipCosmetic, isEquipped, unequipSlot,
} from '../art/cosmetics.js';
import { ConfirmBox, dimScreen, closeScene, navAxis, inRect } from './menus_basic.js';
import {
  BRANCHES, CURRENCY, wallet, skillState, buySkill, shopState, buyShopItem, buyCosmetic, effectText, reqNames,
} from '../progression.js';

const R0 = Math.round;
/** A fonte não tem travessão: troca por hífen. */
const clean = (s) => String(s ?? '').replace(/[\u2014\u2013]/g, '-');
const INK = '#1b1030', CREAM = '#fff4dc', MUTED = '#a898d8', GOLD = '#ffd23f', SEPIA = '#4a2c28';

function asOpts(a) {
  if (!a || typeof a !== 'object') return {};
  if (a.player || a.entities || a.map) return { level: a }; // LevelScene passada direto
  return { ...a };
}
function icon(ctx, name, x, y, alpha = 1) {
  const im = getImage(name);
  if (!im) return 0;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  ctx.drawImage(im, R0(x), R0(y));
  ctx.globalAlpha = pa;
  return im.width;
}
function worldStars(w) {
  let s = 0;
  for (const id of WORLDS[w - 1].levels) for (const f of save.levelRecord(id)?.starsFound || []) if (f) s++;
  return s;
}
/** Anel de pontos girando ao redor de (x,y). */
function selRing(ctx, x, y, r, t, color = '#fff6b0') {
  ctx.fillStyle = color;
  for (let i = 0; i < 10; i++) {
    const a = t * 2.2 + i * Math.PI / 5;
    ctx.fillRect(R0(x + Math.cos(a) * r) - 1, R0(y + Math.sin(a) * r) - 1, 2, 2);
  }
}
/** Linha tracejada de pixels (fio). */
function dashLine(ctx, x0, y0, x1, y1, color, on = 3, off = 2) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d));
  ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) if (i % (on + off) < on) ctx.fillRect(R0(x0 + (x1 - x0) * i / n), R0(y0 + (y1 - y0) * i / n), 2, 2);
}

// ============================================================== base de menu
class ProgressMenu extends Scene {
  constructor(opts) { super(); this.opts = asOpts(opts); this.hits = []; this.pk = null; }
  get overlay() { return true; }
  enter(params) {
    const p = asOpts(params);
    for (const k of Object.keys(p)) if (p[k] !== undefined) this.opts[k] = p[k];
    this.init?.();
  }
  close() {
    if (this.closing) return;
    this.closing = true;
    audio.sfx('ui_close');
    const cb = this.opts.onClose;
    closeScene(this);
    if (typeof cb === 'function') cb();
  }
  hit(key, r) { this.hits.push({ key, r }); }
  hitKey(p) { for (let i = this.hits.length - 1; i >= 0; i--) if (inRect(p, this.hits[i].r)) return this.hits[i].key; return null; }
  /** Toque/clique completo (pressionou e soltou no mesmo alvo) → chave do alvo. */
  tap() {
    const p = input.pointer;
    if (p.pressed) this.pk = this.hitKey(p);
    if (p.released) { const k = this.hitKey(p), pk = this.pk; this.pk = null; if (k != null && k === pk) return k; }
    return null;
  }
  /** Trata confirmação aberta, voltar e o botão "Voltar". true = não processe mais nada. */
  common(dt) {
    if (this.manager?.transitioning || this.closing) return true;
    if (this.confirm) { this.confirm.update(dt); if (this.confirm?.closed) this.confirm = null; return true; }
    if (this.time < 0.12) return true;
    if (input.pressed('back') || (input.pressed('pause') && !input.pressed('confirm'))) {
      input.consume('back'); input.consume('pause'); this.close(); return true;
    }
    return false;
  }
  takeTap() {
    const k = this.tap();
    if (k === 'back') { this.close(); return null; }
    return k;
  }
  /** Fundo escurecido + painel + título + carteira + "Voltar". Devolve o retângulo interno. */
  frame(ctx, title, wallet = [], style = 'dark') {
    this.hits = [];
    const { w, h } = game.view;
    const k = Ease.outCubic(clamp(this.time / 0.2, 0, 1));
    dimScreen(ctx, 0.66 * k);
    const pw = Math.min(w - 12, 540), ph = h - 12;
    const px = R0((w - pw) / 2), py = 6 + R0((1 - k) * 10);
    drawPanel(ctx, px, py, pw, ph, style);
    font.draw(ctx, title, px + 10, py + 8, { color: GOLD, shadow: '#0b0716' });
    const bw = font.measure('Voltar') + 24;
    const br = { x: px + pw - bw - 5, y: py + 4, w: bw, h: 17 };
    this.hit('back', br);
    drawButton(ctx, br.x, br.y + (this.pk === 'back' && input.pointer.down ? 1 : 0), bw, 17, 'Voltar', { icon: 'icon_arrow_l' });
    let x = br.x - 6;
    for (const [ic, val] of wallet.slice().reverse()) {
      const s = String(val), tw = font.measure(s);
      x -= tw; font.draw(ctx, s, x, py + 8, { color: CREAM, shadow: '#0b0716' });
      const im = getImage(ic); x -= (im ? im.width : 0) + 2; icon(ctx, ic, x, py + 6);
      x -= 8;
    }
    return { x: px + 8, y: py + 24, w: pw - 16, h: ph - 30 };
  }
  drawConfirm(ctx) { if (this.confirm) this.confirm.draw(ctx, this.time); }
}

// ================================================================ INVENTÁRIO
const AB_ORDER = ['stitch', 'unstitch', 'rewind', 'decoy', 'unravel'];
class InventoryScene extends ProgressMenu {
  init() { this.sel = 0; this.nav = { t: 0 }; audio.sfx('ui_open'); }
  abilities() {
    const list = AB_ORDER.filter((id) => R.abilities.has(id)).map((id) => {
      const d = R.abilities.get(id);
      return { id, name: d.name, icon: d.icon, desc: d.desc || '', has: save.hasAbility(id) };
    });
    list.push({ id: 'doubleJump', name: 'Pulo Duplo', icon: 'icon_sk_jump', desc: 'Aperte pular no ar para pular de novo.', has: save.hasAbility('doubleJump') });
    return list;
  }
  update(dt) {
    if (this.common(dt)) return;
    const n = this.abilities().length;
    const d = navAxis(this.nav, dt, 'up', 'down');
    if (d) { this.sel = (this.sel + d + n) % n; audio.sfx('ui_move'); }
    const k = this.takeTap();
    if (typeof k === 'number') { if (k !== this.sel) audio.sfx('ui_move'); this.sel = k; }
  }
  draw(ctx) {
    const inv = save.data.inventory, t = this.time;
    const r = this.frame(ctx, 'Inventário');
    const lw = clamp(R0(r.w * 0.4), 118, 200);
    // ---- coletáveis
    let y = r.y;
    const rowH = r.h < 160 ? 11 : 12;
    font.draw(ctx, 'Coletáveis', r.x + 2, y, { color: MUTED });
    y += rowH;
    const rows = [
      ['icon_button', 'Botões', inv.buttons], ['icon_patch', 'Retalhos', inv.patches],
      ['icon_thread', 'Fios antigos', inv.threads], ['icon_memory', 'Memórias', `${new Set(inv.memories).size}/${R.memories.size || 10}`],
    ];
    for (const [ic, label, val] of rows) {
      icon(ctx, ic, r.x + 2, y - 2);
      font.draw(ctx, label, r.x + 17, y, { color: CREAM });
      font.draw(ctx, String(val), r.x + lw - 6, y, { color: GOLD, align: 'right' });
      y += rowH;
    }
    y += 3;
    font.draw(ctx, 'Estrelas por mundo', r.x + 2, y, { color: MUTED });
    y += rowH;
    for (const wd of WORLDS) {
      const open = save.isWorldUnlocked(wd.id) || wd.id === 1;
      ctx.fillStyle = INK; ctx.fillRect(r.x + 2, y - 1, 10, 9);
      ctx.fillStyle = open ? wd.color : '#4a4458'; ctx.fillRect(r.x + 3, y, 8, 7);
      font.draw(ctx, open ? wd.short : '???', r.x + 17, y, { color: open ? CREAM : '#6a6080' });
      if (open) {
        const s = `${worldStars(wd.id)}/18`;
        font.draw(ctx, s, r.x + lw - 6, y, { color: GOLD, align: 'right' });
        icon(ctx, 'icon_star', r.x + lw - 9 - font.measure(s) - 12, y - 2);
      }
      y += rowH;
    }
    // ---- habilidades
    const ax = r.x + lw + 6, aw = r.w - lw - 6;
    drawPanel(ctx, ax - 3, r.y - 3, aw + 3, r.h + 2, 'glass');
    font.draw(ctx, 'Habilidades', ax + 4, r.y + 1, { color: MUTED });
    const list = this.abilities();
    const ih = r.h < 160 ? 14 : 16;
    let yy = r.y + 12;
    list.forEach((a, i) => {
      const rr = { x: ax + 1, y: yy, w: aw - 5, h: ih - 1 };
      this.hit(i, rr);
      if (i === this.sel) drawPanel(ctx, rr.x, rr.y, rr.w, rr.h, 'gold');
      icon(ctx, a.icon, rr.x + 3, rr.y + R0((rr.h - 13) / 2), a.has ? 1 : 0.3);
      font.draw(ctx, a.name, rr.x + 19, rr.y + R0((rr.h - 7) / 2), { color: i === this.sel ? (a.has ? INK : '#6a5a7a') : a.has ? CREAM : '#6a6080', maxWidth: rr.w - 34 });
      if (a.has && save.data.equippedAbility === a.id) icon(ctx, 'icon_check', rr.x + rr.w - 13, rr.y + R0((rr.h - 9) / 2));
      yy += ih;
    });
    const a = list[this.sel];
    if (a) {
      const room = Math.floor((r.y + r.h - yy - 6) / 10);
      const full = a.desc && font.wrap(a.desc, aw - 10).length <= room;
      const short = a.has ? (full ? a.desc : (a.desc.split(/(?<=\.)\s/)[0] || a.desc)) : 'Ainda não descoberta. Procure um altar antigo...';
      font.draw(ctx, short, ax + 4, yy + 4, { color: a.has ? CREAM : MUTED, maxWidth: aw - 10 });
    }
  }
}
registerScene('inventory', InventoryScene);

// ================================================================ HABILIDADES
class SkillTreeScene extends ProgressMenu {
  init() {
    this.ids = [...R.skills.keys()];
    this.sel = this.ids[0];
    this.pos = {};
    this.flash = null;
    this.msg = null;
    audio.sfx('ui_open');
  }
  move(dx, dy) {
    const c = this.pos[this.sel];
    if (!c) return;
    let best = null, bs = 1e9;
    for (const id of this.ids) {
      const p = this.pos[id];
      if (!p || id === this.sel) continue;
      const vx = p.x - c.x, vy = p.y - c.y, along = vx * dx + vy * dy;
      if (along <= 2) continue;
      const score = along + Math.abs(vx * dy - vy * dx) * 2.2;
      if (score < bs) { bs = score; best = id; }
    }
    if (best) { this.sel = best; audio.sfx('ui_move'); }
  }
  tryBuy(id) {
    const d = R.skills.get(id), st = skillState(id);
    if (st === 'owned') { audio.sfx('ui_denied'); this.msg = { text: 'Você já tem essa costura.', t: 1.6 }; return; }
    if (st === 'locked') { audio.sfx('ui_denied'); this.msg = { text: 'Requer: ' + reqNames(d, R.skills).join(', '), t: 1.8 }; return; }
    if (st === 'poor') { audio.sfx('ui_denied'); this.msg = { text: 'Retalhos insuficientes.', t: 1.6 }; return; }
    this.confirm = new ConfirmBox(`Costurar "${d.name}" por ${d.cost} ${d.cost === 1 ? 'retalho' : 'retalhos'}?`, () => {
      if (buySkill(id)) { audio.sfx('ability_get'); this.flash = { id, t: 0 }; this.msg = { text: d.name + ' costurado!', t: 1.8 }; }
    }, null, { yes: 'Costurar', no: 'Não' });
  }
  update(dt) {
    if (this.flash) { this.flash.t += dt; if (this.flash.t > 1) this.flash = null; }
    if (this.msg) { this.msg.t -= dt; if (this.msg.t <= 0) this.msg = null; }
    if (this.common(dt)) return;
    if (input.pressed('left')) this.move(-1, 0);
    else if (input.pressed('right')) this.move(1, 0);
    else if (input.pressed('up')) this.move(0, -1);
    else if (input.pressed('down')) this.move(0, 1);
    if (input.pressed('confirm')) { input.consume('confirm'); input.consume('jump'); this.tryBuy(this.sel); }
    const k = this.takeTap();
    if (k && R.skills.has(k)) {
      if (k === this.sel) this.tryBuy(k);
      else { this.sel = k; audio.sfx('ui_move'); }
    }
  }
  draw(ctx) {
    const t = this.time;
    const r = this.frame(ctx, 'Habilidades', [['icon_patch', wallet('patches')]]);
    const dsel = R.skills.get(this.sel);
    const descLines = dsel ? clamp(font.wrap(dsel.desc, r.w - 16).length, 1, 2) : 1;
    const detH = 34 + descLines * 10, treeH = r.h - detH - 4;
    const bw = r.w / 3;
    const spacing = clamp(R0((treeH - 40) / 2), 24, 50);
    const rootY = R0(r.y + 14 + (treeH - 14) / 2 + spacing) - 2;
    for (let b = 0; b < 3; b++) {
      const br = BRANCHES[b], cx = R0(r.x + bw * b + bw / 2);
      font.draw(ctx, br.name, cx, r.y, { align: 'center', color: br.color, shadow: '#0b0716' });
      // carretel na base do tronco
      ctx.fillStyle = INK; ctx.fillRect(cx - 8, rootY + 9, 16, 7);
      ctx.fillStyle = '#b87a44'; ctx.fillRect(cx - 7, rootY + 10, 14, 1); ctx.fillRect(cx - 7, rootY + 14, 14, 1);
      ctx.fillStyle = br.color; ctx.fillRect(cx - 5, rootY + 11, 10, 3);
      const ids = this.ids.filter((id) => R.skills.get(id).branch === br.id);
      for (const id of ids) {
        const d = R.skills.get(id);
        this.pos[id] = { x: cx + d.col * clamp(R0(bw / 3.6), 22, 30), y: rootY - d.tier * spacing };
      }
      // fios (galhos)
      for (const id of ids) {
        const d = R.skills.get(id), p = this.pos[id], own = save.hasSkill(id);
        if (!d.req?.length) dashLine(ctx, cx, rootY + 9, p.x, p.y, own ? GOLD : 'rgba(255,244,220,0.25)');
        for (const q of d.req || []) {
          const pq = this.pos[q];
          if (pq) dashLine(ctx, pq.x, pq.y, p.x, p.y, own ? GOLD : save.hasSkill(q) ? 'rgba(255,210,63,0.5)' : 'rgba(255,244,220,0.25)');
        }
      }
      for (const id of ids) {
        const d = R.skills.get(id), p = this.pos[id], st = skillState(id);
        const col = st === 'owned' ? GOLD : st === 'locked' ? '#5a5470' : st === 'poor' ? br.color : br.color;
        const down = this.pk === id && input.pointer.down;
        drawDisc(ctx, p.x, p.y, 9, col, down);
        const im = getImage(d.icon);
        if (im) icon(ctx, d.icon, p.x - (im.width >> 1), p.y - (im.height >> 1) + (down ? 1 : 0), st === 'locked' ? 0.45 : st === 'poor' ? 0.7 : 1);
        if (st === 'locked') icon(ctx, 'icon_lock', p.x + 3, p.y + 2);
        if (st === 'owned') icon(ctx, 'icon_check', p.x + 3, p.y + 3);
        this.hit(id, { x: p.x - 11, y: p.y - 11, w: 22, h: 22 });
        if (this.flash?.id === id) { const k = this.flash.t; selRing(ctx, p.x, p.y, 10 + k * 14, t * 3, `rgba(255,214,63,${1 - k})`); }
        if (id === this.sel) {
          selRing(ctx, p.x, p.y, 13, t);
          if (input.lastDevice !== 'touch') drawCursor(ctx, p.x - 13, p.y, t);
        }
      }
    }
    // ---- detalhes
    const d = R.skills.get(this.sel);
    if (!d) return this.drawConfirm(ctx);
    const dy = r.y + r.h - detH;
    drawPanel(ctx, r.x, dy, r.w, detH, 'paper');
    const st = skillState(this.sel);
    font.draw(ctx, d.name, r.x + 8, dy + 6, { color: '#2a1840' });
    const cost = String(d.cost), cw = font.measure(cost);
    font.draw(ctx, cost, r.x + r.w - 8, dy + 6, { color: '#2a1840', align: 'right' });
    icon(ctx, 'icon_patch', r.x + r.w - 10 - cw - 12, dy + 4);
    font.draw(ctx, d.desc, r.x + 8, dy + 17, { color: '#5a4a6a', maxWidth: r.w - 16 });
    let line = 'Efeito: ' + effectText(d.effects), col = '#2a7a3a';
    if (this.msg) { line = this.msg.text; col = '#a8401a'; }
    else if (st === 'owned') { line = 'Costurado! ' + effectText(d.effects); col = '#a87010'; }
    else if (st === 'locked') { line = 'Requer: ' + reqNames(d, R.skills).join(', '); col = '#a8401a'; }
    else if (st === 'poor') { line += ' • faltam retalhos'; }
    font.draw(ctx, line, r.x + 8, dy + 17 + descLines * 10 + 2, { color: col, maxWidth: r.w - 16, maxChars: 90 });
    this.drawConfirm(ctx);
  }
}
registerScene('skilltree', SkillTreeScene);

// ======================================================================= LOJA
const AG_HELLO = [
  'Botões dourados? Aceito! Desconto? Hmm... deixa eu espetar essa ideia.',
  'Tudo original do Avesso! Quase tudo. Algumas coisas. Uma coisa.',
  'Não tenho troco, só alfinetes!',
  'Compre dois e leve... dois! Promoção imperdível!',
  'Cuidado com os espinhos. Os meus e os dos preços.',
  'Olha quem voltou! Meu cliente favorito... com botões.',
];
const AG_THANKS = [
  'Negócio fechado! Volte sempre... com mais botões!',
  'Ótima escolha! Eu diria isso de qualquer jeito, mas é verdade!',
  'Vendido! Sem devolução, sem reclamação, sem lágrimas.',
];
const AG_POOR = [
  'Sem botões, sem negócio. Nada pessoal, só alfinetes.',
  'Hmm, sua carteira está mais vazia que um travesseiro velho.',
];
const AG_OWNED = ['Você já tem isso! Quer dois? Não vendo dois.'];
const TABS = [
  { id: 'up', name: 'Melhorias' },
  { id: 'special', name: 'Especiais' },
  { id: 'cos', name: 'Cosméticos' },
];
class ShopScene extends ProgressMenu {
  constructor(level) { super(level && (level.player || level.map) ? { level } : level); }
  init() {
    this.tab = 0; this.sel = 0; this.scroll = 0; this.nav = { t: 0 };
    this.say(pick(AG_HELLO));
    this.prevMusic = audio.currentName;
    if (hasSong('shop')) { audio.playMusic('shop'); this.started = true; }
    audio.sfx('ui_open');
  }
  exit() {
    if (!this.started) return;
    if (this.prevMusic && hasSong(this.prevMusic)) audio.playMusic(this.prevMusic);
    else audio.stopMusic(0.5);
  }
  say(text, expr = 'happy') { this.line = text; this.lineT = 0; this.expr = expr; }
  items() {
    const T = TABS[this.tab].id;
    if (T === 'cos') {
      return [...R.cosmetics.values()].filter((d) => d.price != null && d.id !== 'thread_gold').map((d) => ({
        id: d.id, kind: 'cos', name: d.name || d.id, desc: d.desc || '', price: d.price, currency: d.currency || 'buttons',
        state: ownsCosmetic(d.id) ? 'owned' : !cosmeticUnlocked(d.id) ? 'locked' : wallet(d.currency || 'buttons') >= d.price ? 'available' : 'poor',
        lock: cosmeticLockText(d.id),
      }));
    }
    return [...R.shopItems.values()].filter((d) => (d.tab || (d.currency === 'threads' ? 'special' : 'up')) === T).map((d) => ({
      id: d.id, kind: 'shop', name: d.name, desc: d.desc, icon: d.icon, price: d.price, currency: d.currency,
      effects: d.effects, state: shopState(d.id), lock: (d.req || []).length ? 'Requer: ' + reqNames(d, R.shopItems).join(', ') : '',
    }));
  }
  setTab(i) { i = (i + TABS.length) % TABS.length; if (i !== this.tab) { this.tab = i; this.sel = 0; this.scroll = 0; audio.sfx('ui_switch'); } }
  tryBuy(it) {
    if (!it) return;
    if (it.state === 'owned') { audio.sfx('ui_denied'); this.say(pick(AG_OWNED), 'neutral'); return; }
    if (it.state === 'locked') { audio.sfx('ui_denied'); this.say(it.lock || 'Ainda não posso vender isso!', 'neutral'); return; }
    if (it.state === 'poor') { audio.sfx('ui_denied'); this.say(pick(AG_POOR), 'neutral'); return; }
    const cur = CURRENCY[it.currency]?.name || it.currency;
    this.confirm = new ConfirmBox(`Comprar "${it.name}" por ${it.price} ${cur}?`, () => {
      const ok = it.kind === 'cos' ? buyCosmetic(it.id) : buyShopItem(it.id);
      if (ok) { audio.sfx('coin'); audio.sfx('chest_open', { vol: 0.5 }); this.say(pick(AG_THANKS)); this.bought = { id: it.id, t: 0 }; }
      else { audio.sfx('ui_denied'); this.say(pick(AG_POOR), 'neutral'); }
    }, null, { yes: 'Comprar', no: 'Não' });
  }
  update(dt) {
    this.lineT += dt;
    if (this.bought) { this.bought.t += dt; if (this.bought.t > 0.8) this.bought = null; }
    if (this.common(dt)) return;
    const list = this.items(), n = list.length;
    if (input.pressed('left')) this.setTab(this.tab - 1);
    else if (input.pressed('right') || input.pressed('cycle')) this.setTab(this.tab + 1);
    const d = navAxis(this.nav, dt, 'up', 'down');
    if (d && n) { this.sel = (this.sel + d + n) % n; audio.sfx('ui_move'); }
    if (input.pressed('confirm')) { input.consume('confirm'); input.consume('jump'); this.tryBuy(list[this.sel]); }
    const k = this.takeTap();
    if (typeof k === 'string' && k.startsWith('tab')) this.setTab(+k.slice(3));
    else if (typeof k === 'number') { if (k === this.sel) this.tryBuy(list[k]); else { this.sel = k; audio.sfx('ui_move'); } }
  }
  draw(ctx) {
    const t = this.time;
    const r = this.frame(ctx, 'Barraca da Agulheta', [['icon_button', wallet('buttons')], ['icon_thread', wallet('threads')]], 'wood');
    const lw = clamp(R0(r.w * 0.32), 92, 140);
    // ---- retrato + balão
    const fx = r.x + R0((lw - 54) / 2);
    drawPanel(ctx, fx, r.y, 54, 54, 'felt');
    const typing = this.lineT * 40 < this.line.length;
    drawPortrait(ctx, 'agulheta', this.expr, fx + 3, r.y + 3, { talking: typing, t });
    font.draw(ctx, 'Agulheta', r.x + lw / 2, r.y + 57, { align: 'center', color: GOLD, shadow: '#0b0716' });
    const by = r.y + 70, bh = Math.min(r.h - 70, font.wrap(this.line, lw - 12).length * 10 + 11);
    drawPanel(ctx, r.x, by, lw, bh, 'balloon');
    ctx.fillStyle = '#fff8ec'; ctx.fillRect(r.x + lw / 2 - 2, by - 3, 5, 4);
    font.draw(ctx, this.line, r.x + 6, by + 6, { color: '#2a1840', maxWidth: lw - 12, maxChars: Math.floor(this.lineT * 40) });
    // ---- abas
    const rx = r.x + lw + 6, rw = r.w - lw - 6;
    const tw = Math.floor((rw - 4) / 3);
    TABS.forEach((tb, i) => {
      const rr = { x: rx + i * (tw + 2), y: r.y, w: tw, h: 16 };
      this.hit('tab' + i, rr);
      drawButton(ctx, rr.x, rr.y, rr.w, rr.h, tb.name, { selected: i === this.tab, style: i === this.tab ? 'gold' : 'dark' });
    });
    // ---- lista
    const list = this.items();
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    const detH = 40, ly = r.y + 20, lh = r.h - 20 - detH - 4, rowH = 15;
    const vis = Math.max(1, Math.floor(lh / rowH));
    this.scroll = clamp(this.scroll, Math.max(0, this.sel - vis + 1), Math.min(this.sel, Math.max(0, list.length - vis)));
    drawPanel(ctx, rx, ly - 1, rw, lh + 2, 'dark');
    for (let i = this.scroll; i < Math.min(list.length, this.scroll + vis); i++) {
      const it = list[i], yy = ly + (i - this.scroll) * rowH;
      const rr = { x: rx + 2, y: yy + 1, w: rw - 4, h: rowH - 1 };
      this.hit(i, rr);
      const sel = i === this.sel;
      if (sel) drawPanel(ctx, rr.x, rr.y, rr.w, rr.h, 'gold');
      const dim = it.state === 'locked' ? 0.35 : 1;
      icon(ctx, it.kind === 'cos' ? (R.cosmetics.get(it.id)?.slot === 'thread' ? 'icon_thread' : 'icon_shirt') : it.icon, rr.x + 3, rr.y + 1, dim);
      const tc = sel ? INK : it.state === 'locked' ? '#6a6080' : CREAM;
      if (it.state === 'owned') {
        icon(ctx, 'icon_check', rr.x + rr.w - 12, rr.y + 3);
      } else {
        const ps = String(it.price), pw = font.measure(ps);
        font.draw(ctx, ps, rr.x + rr.w - 4, rr.y + 4, { align: 'right', color: it.state === 'poor' ? '#ff7a6a' : sel ? INK : GOLD });
        icon(ctx, CURRENCY[it.currency]?.icon || 'icon_button', rr.x + rr.w - 6 - pw - 12, rr.y + 1, dim);
      }
      font.draw(ctx, it.name, rr.x + 18, rr.y + 4, { color: tc, maxWidth: rr.w - 60, maxChars: 40 });
      if (this.bought?.id === it.id) { ctx.fillStyle = `rgba(255,246,176,${0.6 * (1 - this.bought.t / 0.8)})`; ctx.fillRect(rr.x, rr.y, rr.w, rr.h); }
    }
    if (!list.length) font.draw(ctx, 'Nada à venda... por enquanto!', rx + rw / 2, ly + 10, { align: 'center', color: MUTED });
    if (list.length > vis) { // barrinha de rolagem
      const sh = Math.max(6, R0(lh * vis / list.length)), sy = ly + R0((lh - sh) * this.scroll / Math.max(1, list.length - vis));
      ctx.fillStyle = '#ffd23f88'; ctx.fillRect(rx + rw - 3, sy, 2, sh);
    }
    // ---- detalhes
    const it = list[this.sel], dy = r.y + r.h - detH;
    drawPanel(ctx, rx, dy, rw, detH, 'paper');
    if (it) {
      let tx = rx + 6;
      if (it.kind === 'cos') { drawCosmeticPreview(ctx, it.id, rx + 6, dy + 8, t); tx += 28; }
      let info = it.desc;
      let l2 = it.kind === 'shop' ? 'Efeito: ' + effectText(it.effects) : '';
      let c2 = '#2a7a3a';
      if (it.state === 'owned') { l2 = it.kind === 'cos' ? 'Seu! Vista no guarda-roupa.' : 'Comprado!'; c2 = '#a87010'; }
      else if (it.state === 'locked') { l2 = it.lock || 'Indisponível'; c2 = '#a8401a'; }
      font.draw(ctx, info, tx, dy + 6, { color: '#2a1840', maxWidth: rx + rw - tx - 6, maxChars: 120 });
      if (l2) font.draw(ctx, l2, tx, dy + 27, { color: c2, maxWidth: rx + rw - tx - 6 });
    }
    this.drawConfirm(ctx);
  }
}
registerScene('shop', ShopScene);

// ========================================================== LIVRO DE MEMÓRIAS
const MEM_IDS = () => [...R.memories.keys()];
const hasMemory = (id) => save.data.inventory.memories.includes(id);
class MemoriesScene extends ProgressMenu {
  init() {
    const ids = MEM_IDS();
    const first = ids.findIndex(hasMemory);
    this.idx = Math.max(0, first);
    this.nav = { t: 0 };
    this.turn = null;
    audio.sfx('page_turn');
  }
  flip(d) {
    const n = MEM_IDS().length;
    if (!n) return;
    const ni = this.idx + d;
    if (ni < 0 || ni >= n) { audio.sfx('ui_denied'); return; }
    this.idx = ni; this.turn = { t: 0, dir: d }; this.pageT = 0;
    audio.sfx('page_turn');
  }
  update(dt) {
    if (this.turn) { this.turn.t += dt; if (this.turn.t > 0.35) this.turn = null; }
    this.pageT = (this.pageT || 0) + dt;
    if (this.common(dt)) return;
    const d = navAxis(this.nav, dt, 'left', 'right');
    if (d) this.flip(d);
    const k = this.takeTap();
    if (k === 'prev') this.flip(-1);
    else if (k === 'next') this.flip(1);
  }
  draw(ctx) {
    const t = this.time, ids = MEM_IDS();
    const got = ids.filter(hasMemory).length;
    const r = this.frame(ctx, 'Livro de Memórias', [['icon_memory', `${got}/${ids.length}`]]);
    const bookH = r.h - 20;
    // capa + páginas
    drawPanel(ctx, r.x, r.y, r.w, bookH, 'red');
    const pw = Math.floor((r.w - 12) / 2), lx = r.x + 6, rxp = lx + pw, py = r.y + 4, ph = bookH - 8;
    drawPanel(ctx, lx, py, pw, ph, 'paper');
    drawPanel(ctx, rxp, py, pw, ph, 'paper');
    ctx.fillStyle = 'rgba(74,44,40,0.35)'; ctx.fillRect(rxp - 1, py + 2, 2, ph - 4);
    const id = ids[this.idx], def = id && R.memories.get(id), unlocked = id && hasMemory(id);
    // página esquerda: vinheta
    const vw = Math.min(220, pw - 14), vh = Math.min(130, R0(vw * 130 / 220), ph - 30);
    const vw2 = Math.min(vw, R0(vh * 220 / 130));
    const vx = lx + R0((pw - vw2) / 2), vy = py + 8;
    ctx.fillStyle = '#7a4e2a'; ctx.fillRect(vx - 3, vy - 3, vw2 + 6, vh + 6);
    ctx.fillStyle = '#c8945a'; ctx.fillRect(vx - 2, vy - 2, vw2 + 4, vh + 4);
    if (def && unlocked && def.scene) {
      ctx.save(); ctx.translate(vx, vy); ctx.beginPath(); ctx.rect(0, 0, vw2, vh); ctx.clip();
      try { def.scene(ctx, vw2, vh, this.pageT || t); } catch (e) { /* vinheta com problema: ignora */ }
      ctx.restore();
    } else {
      ctx.fillStyle = '#3a2a3a'; ctx.fillRect(vx, vy, vw2, vh);
      ctx.fillStyle = '#4a3646';
      for (let yy = 0; yy < vh; yy += 4) ctx.fillRect(vx, vy + yy, vw2, 1);
      font.draw(ctx, '?', vx + vw2 / 2, vy + vh / 2 - 7, { align: 'center', color: '#8a7090', scale: 2 });
    }
    font.draw(ctx, `${this.idx + 1} / ${ids.length}`, lx + pw / 2, py + ph - 13, { align: 'center', color: '#8a6a50' });
    // página direita: título + narração
    const tx = rxp + 8, tw = pw - 16;
    if (def && unlocked) {
      font.draw(ctx, clean(def.title), tx, py + 8, { color: '#7a2a3a', maxWidth: tw });
      const lines = (Array.isArray(def.text) ? def.text : [def.text]).map(clean);
      let yy = py + 8 + font.wrap(def.title, tw).length * 10 + 4;
      for (const ln of lines) {
        const wl = font.wrap(ln, tw);
        if (yy + wl.length * 10 > py + ph - 4) break;
        font.draw(ctx, ln, tx, yy, { color: SEPIA, maxWidth: tw });
        yy += wl.length * 10 + 3;
      }
    } else {
      font.draw(ctx, '???', tx, py + 8, { color: '#8a6a50' });
      const wd = def && WORLDS[(def.world || 1) - 1];
      const r1 = font.draw(ctx, `Uma memória perdida${wd ? ' em: ' + wd.name : ''}.`, tx, py + 22, { color: '#8a6a50', maxWidth: tw });
      font.draw(ctx, 'Encontre-a para lembrar.', tx, py + 22 + r1.height + 6, { color: '#a08a70', maxWidth: tw });
    }
    // página virando
    if (this.turn) {
      const k = clamp(this.turn.t / 0.35, 0, 1), e = Ease.inOutQuad(k);
      const fwd = this.turn.dir > 0;
      const wpx = R0(pw * Math.abs(1 - 2 * e));
      const onRight = fwd ? e < 0.5 : e >= 0.5;
      const x = onRight ? rxp : rxp - wpx;
      ctx.fillStyle = '#f4e8d0'; ctx.fillRect(x, py + 1, wpx, ph - 2);
      ctx.fillStyle = 'rgba(74,44,40,0.4)'; ctx.fillRect(onRight ? x + wpx - 1 : x, py + 1, 1, ph - 2);
    }
    // setas
    const ay = r.y + bookH + 2;
    const pr = { x: r.x, y: ay, w: 44, h: 17 }, nr = { x: r.x + r.w - 44, y: ay, w: 44, h: 17 };
    this.hit('prev', pr); this.hit('next', nr);
    drawButton(ctx, pr.x, pr.y, pr.w, pr.h, '', { icon: 'icon_arrow_l', disabled: this.idx <= 0 });
    drawButton(ctx, nr.x, nr.y, nr.w, nr.h, '', { icon: 'icon_arrow_r', disabled: this.idx >= ids.length - 1 });
    font.draw(ctx, unlocked && def ? def.title : 'Página trancada', r.x + r.w / 2, ay + 5, { align: 'center', color: MUTED, maxWidth: r.w - 100 });
  }
}
registerScene('memories', MemoriesScene);

// ============================================================ MEMÓRIA (pegou)
class MemoryViewScene extends Scene {
  constructor(id, opts) {
    super();
    this.id = typeof id === 'string' ? id : null;
    this.def = this.id ? R.memories.get(this.id) : null;
    this.opts = opts && typeof opts === 'object' && !opts.player ? opts : {};
  }
  get overlay() { return true; }
  enter() {
    this.ducked = true;
    audio.duck(0.35);
    if (this.def) audio.sfx('magic_hum');
    const lines = Array.isArray(this.def?.text) ? this.def.text : [String(this.def?.text || '')];
    this.text = lines.map(clean).join('\n');
    this.typeT = 0;
    this.stitched = false;
  }
  exit() { if (this.ducked) { this.ducked = false; audio.unduck(); } }
  close() {
    if (this.closing) return;
    this.closing = true;
    audio.sfx('ui_close');
    const cb = this.opts.onClose;
    closeScene(this);
    if (typeof cb === 'function') cb();
  }
  get shown() { return Math.floor(Math.max(0, this.time - 1.1) * 45); }
  update(dt) {
    if (this.manager?.transitioning) return;
    if (!this.def) { this.close(); return; }
    if (!this.stitched && this.time > 0.75) { this.stitched = true; audio.sfx('stitch_connect'); }
    if (this.time < 0.6) return;
    if (input.anyPressed() || input.pressed('back') || input.pressed('interact')) {
      ['confirm', 'jump', 'attack', 'pause', 'dash', 'ability', 'back', 'interact'].forEach((a) => input.consume(a));
      if (font.visibleLength ? this.shown < font.visibleLength(this.text) && !this.skipped : false) { this.skipped = true; this.skipT = this.time; }
      else this.close();
    }
  }
  draw(ctx) {
    if (!this.def) return;
    const { w, h } = game.view, t = this.time;
    dimScreen(ctx, 0.75 * clamp(t / 0.3, 0, 1));
    const tw = Math.min(w - 40, 320);
    const wrapped = this.text.split('\n').reduce((n, ln) => n + font.wrap(ln, tw).length, 0);
    const textH = 14 + wrapped * 10;
    const vh = clamp(h - textH - 44, 50, 130), vw = R0(vh * 220 / 130);
    const fx = R0(w / 2 - vw / 2), fy = Math.max(10, R0((h - vh - textH - 22) / 2));
    // moldura costurada pela agulha
    const per = 2 * (vw + vh + 8), prog = clamp(t / 0.7, 0, 1) * per;
    const pt = (d) => {
      const W = vw + 8, H = vh + 8;
      if (d < W) return [fx - 4 + d, fy - 4];
      d -= W; if (d < H) return [fx + vw + 4, fy - 4 + d];
      d -= H; if (d < W) return [fx + vw + 4 - d, fy + vh + 4];
      d -= W; return [fx - 4, fy + vh + 4 - d];
    };
    // vinheta revelada do centro (cortina costurada abrindo)
    const rk = Ease.outCubic(clamp((t - 0.55) / 0.6, 0, 1));
    if (rk > 0) {
      ctx.fillStyle = '#7a4e2a'; ctx.fillRect(fx - 3, fy - 3, vw + 6, vh + 6);
      const cw = R0(vw * rk);
      ctx.save();
      ctx.beginPath(); ctx.rect(fx + R0((vw - cw) / 2), fy, cw, vh); ctx.clip();
      ctx.translate(fx, fy);
      try { this.def.scene?.(ctx, vw, vh, t); } catch (e) { /* ignora */ }
      ctx.restore();
    }
    for (let d = 0; d < prog; d += 1) if (d % 5 < 3) { const [x, y] = pt(d); ctx.fillStyle = GOLD; ctx.fillRect(R0(x), R0(y), 2, 2); }
    if (t < 0.75) { // agulha
      const [x, y] = pt(prog);
      ctx.fillStyle = '#e8eef8'; ctx.fillRect(R0(x) - 1, R0(y) - 4, 2, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(R0(x) - 1, R0(y) - 4, 1, 2);
    }
    // título e narração
    const ty = fy + vh + 10, ta = clamp((t - 0.9) / 0.4, 0, 1);
    ctx.save(); ctx.globalAlpha = ta;
    font.draw(ctx, clean(this.def.title), w / 2, ty + R0((1 - ta) * 4), { align: 'center', color: GOLD, outline: INK });
    ctx.restore();
    const shown = this.skipped ? 99999 : this.shown;
    let yy = ty + 14, used = 0;
    for (const ln of this.text.split('\n')) {
      const left = shown - used;
      if (left <= 0) break;
      font.draw(ctx, ln, w / 2 - tw / 2, yy, { color: CREAM, shadow: '#0b0716', maxWidth: tw, maxChars: left });
      used += ln.length;
      yy += font.wrap(ln, tw).length * 10;
    }
    if (t > 1.6 && Math.floor(t * 2) % 2 === 0) {
      font.draw(ctx, input.lastDevice === 'touch' ? 'Toque para continuar' : 'Aperte qualquer botão', w - 8, h - 12, { align: 'right', color: MUTED });
    }
  }
}
registerScene('memory_view', MemoryViewScene);

// =============================================================== GUARDA-ROUPA
const SLOTS = [
  { id: 'hat', name: 'Chapéu' }, { id: 'neck', name: 'Pescoço' },
  { id: 'back', name: 'Costas' }, { id: 'thread', name: 'Linha' },
];
class WardrobeScene extends ProgressMenu {
  init() {
    this.slot = 0; this.sel = 0; this.focusTabs = false; this.nav = { t: 0 }; this.navH = { t: 0 };
    this.anim = 'idle'; this.animT = 0;
    this.off = createCanvas(64, 52);
    this.sel = this.equippedIndex();
    audio.sfx('ui_open');
  }
  equippedIndex() {
    const s = SLOTS[this.slot].id, cur = save.data.cosmetics?.[s] ?? null;
    return Math.max(0, this.cells().indexOf(s === 'thread' ? (cur || 'thread_gold') : cur));
  }
  cells() {
    const s = SLOTS[this.slot].id;
    const list = cosmeticsInSlot(s).map((d) => d.id);
    return s === 'thread' ? list : [null, ...list];
  }
  equip(id) {
    const s = SLOTS[this.slot].id;
    if (id === null) { unequipSlot(s); save.commit(); audio.sfx('ui_back'); return; }
    if (!ownsCosmetic(id)) { audio.sfx('ui_denied'); this.denyT = 0.3; return; }
    if (equipCosmetic(id)) { save.commit(); audio.sfx('ui_switch'); this.anim = 'celebrate'; this.animT = 0; }
    else audio.sfx('ui_select');
  }
  update(dt) {
    this.animT += dt;
    this.denyT = Math.max(0, (this.denyT || 0) - dt);
    if (this.anim !== 'idle' && this.animT > (animDuration('tico', this.anim) || 1)) { this.anim = 'idle'; this.animT = 0; }
    if (this.common(dt)) return;
    const cells = this.cells(), n = cells.length, cols = this.cols || 5;
    const setSlot = (i) => { this.slot = (i + SLOTS.length) % SLOTS.length; this.sel = this.equippedIndex(); audio.sfx('ui_switch'); };
    if (input.pressed('cycle')) setSlot(this.slot + 1);
    const dx = navAxis(this.navH, dt, 'left', 'right'), dy = navAxis(this.nav, dt, 'up', 'down');
    if (this.focusTabs) {
      if (dx) setSlot(this.slot + dx);
      if (dy > 0 || input.pressed('confirm')) { input.consume('confirm'); input.consume('jump'); this.focusTabs = false; audio.sfx('ui_move'); }
    } else {
      if (dx && n) { this.sel = clamp(this.sel + dx, 0, n - 1); audio.sfx('ui_move'); }
      if (dy) {
        const ns = this.sel + dy * cols;
        if (ns < 0) { this.focusTabs = true; audio.sfx('ui_move'); }
        else if (ns < n) { this.sel = ns; audio.sfx('ui_move'); }
      }
      if (input.pressed('confirm')) { input.consume('confirm'); input.consume('jump'); this.equip(cells[this.sel]); }
    }
    const k = this.takeTap();
    if (typeof k === 'string' && k.startsWith('slot')) { this.focusTabs = false; setSlot(+k.slice(4)); }
    else if (typeof k === 'number') { this.focusTabs = false; this.sel = k; this.equip(cells[k]); }
  }
  draw(ctx) {
    const t = this.time;
    const r = this.frame(ctx, 'Guarda-roupa');
    // ---- vitrine do Tico (2x, nítido)
    const lw = 104;
    drawPanel(ctx, r.x, r.y, lw, r.h, 'felt');
    const o = this.off.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.clearRect(0, 0, 64, 52);
    const fr = animFrame('tico', this.anim, this.animT);
    drawSprite(o, 'tico', this.anim, fr, 32, 51);
    drawCosmetics(o, null, this.anim, fr, 32, 51, false);
    const sx = r.x + R0((lw - 96) / 2), sy = r.y + R0((r.h - 104) / 2) - 2;
    ctx.fillStyle = 'rgba(11,7,22,0.35)'; ctx.fillRect(r.x + lw / 2 - 22, sy + 100, 44, 4);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 8, 0, 48, 52, sx, sy, 96, 104);
    ctx.restore();
    // ---- abas dos slots
    const rx = r.x + lw + 6, rw = r.w - lw - 6;
    const tw = Math.floor((rw - 6) / 4);
    SLOTS.forEach((s, i) => {
      const rr = { x: rx + i * (tw + 2), y: r.y, w: tw, h: 16 };
      this.hit('slot' + i, rr);
      drawButton(ctx, rr.x, rr.y, rr.w, rr.h, s.name, { selected: i === this.slot && this.focusTabs, style: i === this.slot ? 'gold' : 'dark' });
    });
    // ---- grade de itens
    const cells = this.cells();
    const cs = 28, cols = Math.max(3, Math.floor((rw + 2) / (cs + 2)));
    this.cols = cols;
    const gx = rx + R0((rw - (cols * (cs + 2) - 2)) / 2), gy = r.y + 21;
    if (this.sel >= cells.length) this.sel = Math.max(0, cells.length - 1);
    cells.forEach((id, i) => {
      const cx = gx + (i % cols) * (cs + 2), cy = gy + Math.floor(i / cols) * (cs + 2);
      const rr = { x: cx, y: cy, w: cs, h: cs };
      this.hit(i, rr);
      const own = id === null || ownsCosmetic(id);
      const eq = id === null ? !save.data.cosmetics[SLOTS[this.slot].id] : isEquipped(id);
      const sel = i === this.sel && !this.focusTabs;
      const shake = sel && this.denyT > 0 ? R0(Math.sin(this.denyT * 60) * 2) : 0;
      drawPanel(ctx, cx + shake, cy, cs, cs, eq ? 'gold' : own ? 'dark' : 'glass');
      if (id === null) {
        ctx.fillStyle = '#ff6a7a';
        for (let k = 0; k < 10; k++) { ctx.fillRect(cx + 9 + k, cy + 9 + k, 2, 1); ctx.fillRect(cx + 18 - k, cy + 9 + k, 2, 1); }
      } else {
        ctx.save(); ctx.globalAlpha = own ? 1 : 0.3;
        drawCosmeticPreview(ctx, id, cx + 2 + shake, cy + 2, t);
        ctx.restore();
        if (!own) icon(ctx, 'icon_lock', cx + cs - 12, cy + cs - 13);
        if (eq) icon(ctx, 'icon_check', cx + cs - 11, cy + 1);
      }
      if (sel) selRing(ctx, cx + cs / 2, cy + cs / 2, 17, t);
    });
    // ---- descrição
    const rows = Math.ceil(cells.length / cols);
    const dy = Math.max(gy + rows * (cs + 2) + 2, r.y + r.h - 40);
    const dh = r.y + r.h - dy;
    drawPanel(ctx, rx, dy, rw, dh, 'paper');
    const id = cells[this.sel];
    const d = id ? R.cosmetics.get(id) : null;
    const title = this.focusTabs ? SLOTS[this.slot].name : d ? d.name : 'Nenhum';
    font.draw(ctx, title, rx + 6, dy + 5, { color: '#2a1840', maxWidth: rw - 12 });
    let line, col = '#5a4a6a';
    if (this.focusTabs) line = '←/→ trocam de categoria.';
    else if (!d) line = 'Tirar o acessório deste espaço.';
    else if (ownsCosmetic(id)) { line = isEquipped(id) ? 'Equipado! ' + (d.desc || '') : (d.desc || ''); }
    else {
      const cur = CURRENCY[d.currency || 'buttons']?.name || 'botões';
      line = cosmeticLockText(id) || `À venda na barraca da Agulheta: ${d.price} ${cur}.`;
      col = '#a8401a';
    }
    font.draw(ctx, line, rx + 6, dy + 16, { color: col, maxWidth: rw - 12, maxChars: 140 });
  }
}
registerScene('wardrobe', WardrobeScene);

export { InventoryScene, SkillTreeScene, ShopScene, MemoriesScene, MemoryViewScene, WardrobeScene };
