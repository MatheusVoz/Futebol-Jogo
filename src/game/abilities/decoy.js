// =============================================================================
// abilities/decoy.js — RETALHO FANTASMA
//
// Habilidade 'decoy' (custo 30, recarga 1 s). Cria a entidade 'decoy': cópia
// translúcida em retalhos do Tico (sprite 'tico' variante 'ghost' + pontos de costura),
// com gravidade, que dura 8 s × getStats().duration (pisca no fim e se desfaz em
// retalhos). É lançada à frente do Tico:
//     normal → arremesso curto para a frente (~2 tiles)
//     ↑      → arremesso ALTO (~6.5 tiles) — alcança bordas que o Tico não alcança
//     ↓      → solta aos pés
// Contratos: level.decoy = cópia ativa (null quando some); decoy.taunting = true nos
// primeiros 2 s (Enemy.target() a prefere); aguenta 3 golpes (contato de inimigos,
// projéteis, ou quem chamar decoy.hurt()); pesa em pressure_plate (D); plataformas
// móveis a carregam. Usar a habilidade de novo com a cópia ativa = TROCA de lugar
// (custo 10) — atravessar barreiras, subir bordas altas, enganar chefes.
// Fase de teste: ?level=test_ab_decoy&unlock=all
// =============================================================================
import { Entity } from '../../engine/entity.js';
import { TILE, approach, rectsOverlap } from '../../engine/util.js';
import { drawSprite, animFrame } from '../../engine/sprites.js';
import { input } from '../../engine/input.js';
import { audio } from '../../engine/audio.js';
import { save } from '../../engine/save.js';
import { registerAbility, registerEntity, registerLevel } from '../registry.js';
import { getStats } from '../stats.js';
import { buildTestMap } from './stitch.js';
import * as VFX from '../art/vfx.js';

// ----------------------------------------------------------------- ajustes
const COST = 30, COOLDOWN = 1, SWAP_COST = 10;
const LIFE = 8, TAUNT = 2, HITS = 3;
const TOSS = { fwd: [120, -190], up: [70, -460], down: [0, 0] };
const CYAN = '#9ff6ff', CYAN_D = '#3fc7c0', STITCH = '#e8fdff';
const Rn = Math.round;
const dur = () => getStats().duration || 1;
const patchFx = (level, x, y, n) => level.particles.emit('ghost_patch', x, y, n, { colors: [CYAN, '#e8fdff', CYAN_D] });

class Decoy extends Entity {
  constructor(level, x, y, props = {}) {
    super(level, x, y, props);
    this.w = 12; this.h = 18; this.x = x; this.y = y;
    this.z = 48; this.alwaysUpdate = true;
    this.gravity = 1000; this.maxFall = 340;
    this.facing = props.facing || 1;
    const [tvx, tvy] = TOSS[props.toss || 'fwd'];
    this.tossVx = tvx * this.facing; this.vx = this.tossVx; this.vy = tvy;
    this.life = this.maxLife = LIFE * dur();
    this.hits = 0; this.tauntT = TAUNT;
    this.isDecoy = true;
  }
  get taunting() { return this.tauntT > 0; }
  /** Recebe um golpe (inimigos podem chamar diretamente). */
  hurt(n = 1, src = null) {
    if (this.dead || this.invuln > 0) return false;
    this.hits++; this.invuln = 0.6; this.flash = 0.15;
    const dir = Math.sign(this.cx - (src?.cx ?? this.cx)) || -this.facing;
    this.vx = dir * 90; this.vy = Math.min(this.vy, -120); this.tossVx = 0;
    audio.sfx('hit', { pitch: 1.4, vol: 0.6 });
    patchFx(this.level, this.cx, this.cy, 5);
    if (this.hits >= HITS) this.pop();
    return true;
  }
  update(dt) {
    this.tickTimers(dt);
    if (this.tauntT > 0) this.tauntT -= dt;
    this.life -= dt;
    if (this.life <= 0) { this.pop(); return; }
    // física: mantém o impulso do arremesso no ar (mesmo raspando paredes)
    if (this.grounded) { this.tossVx = 0; this.vx = approach(this.vx, 0, 600 * dt); }
    else if (this.tossVx) this.vx = this.tossVx;
    this.physics(dt);
    if (this.y > this.level.map.rows * TILE + 32) { this.pop(); return; }
    // golpes de inimigos e projéteis
    for (const e of this.level.entities) {
      if (e.dead || !e.enemy || e.dying || e === this || !rectsOverlap(this, e)) continue;
      if (e.reflectable !== undefined && e.pop) { e.pop(); this.hurt(1, e); }   // projétil
      else if (this.invuln <= 0) this.hurt(e.contactDamage || 1, e);
      if (this.dead) return;
    }
    if (Math.random() < dt * 3) patchFx(this.level, this.x + Math.random() * this.w, this.y + Math.random() * this.h, 1);
  }
  pop() {
    if (this.dead) return;
    this.remove();
    patchFx(this.level, this.cx, this.cy, 14);
    this.level.particles.emit('fabric', this.cx, this.cy, 8, { colors: [CYAN, CYAN_D, '#ffffff'] });
    audio.sfx('decoy_cast', { pitch: 1.6, vol: 0.5 });
  }
  onRemove() { if (this.level.decoy === this) this.level.decoy = null; }
  draw(ctx) {
    // pisca nos últimos 1.5 s
    if (this.life < 1.5 && Math.floor(this.life * (this.life < 0.6 ? 16 : 8)) % 2 === 0) return;
    const x = Rn(this.cx), y = Rn(this.bottom), f = this.facing;
    VFX.drawGlow(ctx, x, y - 9, 14, CYAN, 0.25);
    const anim = this.grounded ? 'idle' : this.vy < 0 ? 'jump' : 'fall';
    const fr = animFrame('tico', anim, this.t);
    drawSprite(ctx, 'tico', anim, fr, x, y, { flip: f < 0, variant: this.flash > 0 ? 'flash' : 'ghost' });
    // retalhos costurados por cima (quadradinhos com ponto corrido)
    const bx = x - 2 * f, by = y - 11;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = STITCH;
    for (let i = 0; i < 5; i += 2) { ctx.fillRect(bx - 3 + i, by - 3, 1, 1); ctx.fillRect(bx - 3 + i, by + 2, 1, 1); ctx.fillRect(bx - 3, by - 2 + i, 1, 1); ctx.fillRect(bx + 2, by - 2 + i, 1, 1); }
    const hx = x + 5 * f, hy = y - 22;   // "X" de costura na cabeça
    ctx.fillRect(hx - 1, hy - 1, 1, 1); ctx.fillRect(hx + 1, hy - 1, 1, 1); ctx.fillRect(hx, hy, 1, 1); ctx.fillRect(hx - 1, hy + 1, 1, 1); ctx.fillRect(hx + 1, hy + 1, 1, 1);
    ctx.globalAlpha = 1;
    // provocação: ondas saindo da cabeça
    if (this.taunting) {
      const k = (this.t * 2) % 1, r = Rn(4 + k * 8);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 10; i++) {
        const a = Math.PI + (i / 9) * Math.PI;
        ctx.fillRect(Rn(x + Math.cos(a) * r), Rn(y - 28 + Math.sin(a) * r * 0.6), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // golpes restantes (retalhos)
    if (this.hits > 0) {
      for (let i = 0; i < HITS; i++) {
        ctx.fillStyle = '#1b2a3a'; ctx.fillRect(x - 6 + i * 4, y - 33, 3, 3);
        ctx.fillStyle = i < HITS - this.hits ? CYAN : '#3a4a5a'; ctx.fillRect(x - 6 + i * 4, y - 33, 2, 2);
      }
    }
  }
}
registerEntity('decoy', Decoy);

// ----------------------------------------------------------------- troca de lugar
function swap(p, d, level) {
  const px = p.x, py = p.y, dx = d.x, dy = d.y;
  p.x = dx; p.y = dy; d.x = px; d.y = py;
  p.vx = 0; p.vy = Math.min(p.vy, 0) * 0.3; d.vx = 0; d.vy = 0; d.tossVx = 0;
  d.facing = p.facing;
  d.tauntT = Math.max(d.tauntT, 1);              // engana quem mirava o Tico
  p.invuln = Math.max(p.invuln, 0.3);
  p.castT = 0.2;
  audio.sfx('decoy_swap');
  level.flash('#c8faff', 0.1);
  for (const [x, y] of [[px + 6, py + 9], [dx + 6, dy + 9]]) {
    patchFx(level, x, y, 8);
    VFX.spawnShockwave(level, x, y, { radius: 16, color: CYAN, particles: false, dur: 0.35 });
  }
  level.add(new SwapThread(level, px + 6, py + 9, { x2: dx + 6, y2: dy + 9 }));
}
/** Fio que liga os dois pontos por um instante após a troca. */
class SwapThread extends Entity {
  constructor(l, x, y, p) { super(l, x, y, p); this.w = 1; this.h = 1; this.z = 60; this.alwaysDraw = true; this.alwaysUpdate = true; }
  update(dt) { this.t += dt; if (this.t > 0.3) this.remove(); }
  draw(ctx) {
    ctx.globalAlpha = 1 - this.t / 0.3;
    VFX.drawThreadLine(ctx, this.x, this.y, this.props.x2, this.props.y2, this.t, CYAN);
    ctx.globalAlpha = 1;
  }
}
registerEntity('decoy_swap_thread', SwapThread);

// ============================================================================
// HABILIDADE
// ============================================================================
registerAbility('decoy', {
  name: 'Retalho Fantasma', icon: 'icon_ab_decoy', cost: COST, cooldown: COOLDOWN, color: CYAN,
  desc: 'Lança uma cópia de retalhos que distrai inimigos e pesa em placas (↑ lança alto, ↓ solta aos pés). Use de novo para trocar de lugar com ela.',
  onPress(p, level) {
    const d = level.decoy;
    if (d && !d.dead) {
      if (!p.spendEnergy(SWAP_COST)) return;
      swap(p, d, level);
      p.setCooldown('decoy', 0.4);
      return;
    }
    if (!p.spendEnergy(COST)) return;
    const toss = input.down('up') ? 'up' : input.down('down') ? 'down' : 'fwd';
    const nd = new Decoy(level, p.x, p.y, { facing: p.facing, toss });
    level.decoy = level.add(nd);
    p.setCooldown('decoy', COOLDOWN);
    p.castT = 0.3;
    audio.sfx('decoy_cast');
    patchFx(level, p.cx, p.cy, 10);
    VFX.spawnShockwave(level, p.cx, p.cy, { radius: 14, color: CYAN, particles: false, dur: 0.3 });
  },
  update(p) {
    const L = p.level;
    if (L?.decoy && L.decoy.dead) L.decoy = null;
  },
  draw(ctx, p) {
    // fio pontilhado até a cópia (prévia da troca)
    const d = p.level?.decoy;
    if (!d || d.dead || save.data.equippedAbility !== 'decoy' || p.state !== 'normal') return;
    const x0 = p.cx, y0 = p.cy, x1 = d.cx, y1 = d.cy, len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 12) return;
    const n = Math.floor(len / 4), ph = Math.floor(p.t * 10);
    const ok = p.cooldownOf('decoy') <= 0 && p.energy >= p.costOf(SWAP_COST);
    ctx.globalAlpha = ok ? 0.4 : 0.15;
    ctx.fillStyle = CYAN;
    for (let i = 1; i < n; i++) if ((i + ph) % 3 !== 0) ctx.fillRect(Rn(x0 + (x1 - x0) * i / n), Rn(y0 + (y1 - y0) * i / n), 1, 1);
    ctx.globalAlpha = 1;
  },
  onUnequip() {},
});

// ============================================================================
// Fase de teste: ?level=test_ab_decoy&unlock=all
// ============================================================================
registerLevel({
  id: 'test_ab_decoy', world: 0, index: 0, name: 'Teste: Retalho Fantasma', subtitle: 'Eu e Eu Mesmo',
  tileset: 'default', background: 'default', music: null, parTime: 90,
  map: buildTestMap(60, 16, (fill, put) => {
    fill(0, 12, 59, 15, '#');
    put(2, 11, 'P');
    put(10, 11, 'D');                       // placa → portão
    fill(16, 0, 16, 5, '#'); put(16, 11, 'G');
    put(26, 11, 'a'); put(31, 11, 'a');     // inimigos (distraídos pela cópia)
    fill(40, 6, 59, 11, '#');               // borda alta (6 tiles): cópia alta + troca
    put(57, 5, 'E');
  }),
  legend: { a: 'ab_test_dummy' },
  props: { '10,11': { signal: 'dg' }, '16,11': { signal: 'dg' } },
  onStart() { if (save.data.abilities?.decoy) save.data.equippedAbility = 'decoy'; },
});
