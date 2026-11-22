// =============================================================================
// entity.js — Classe base de todas as entidades (inimigos, objetos, NPCs...).
//
// Ciclo de vida (chamado pela LevelScene):
//   constructor(level, x, y, props)   x,y = canto sup. esq. da CÉLULA do mapa (px)
//   init()                            depois de todas as entidades existirem
//   update(dt)                        60 Hz
//   draw(ctx)                         ctx já transladado pela câmera (coords de mundo)
//   drawLight?(lighting)              opcional: adicionar luzes
//   onRemove()                        ao ser removida
//
// Flags úteis (defina no constructor):
//   this.solid = true    -> bloqueia movimento (plataforma móvel, bloco)
//   this.oneway = true   -> só por cima
//   this.enemy = true    -> causa dano ao tocar o jogador (contactDamage)
//   this.hittable = true -> pode ser atingida pelo ataque do jogador (onHit)
//   this.stompable = true-> jogador pode pular em cima (onStomp)
//   this.interactable = true + interact(player) + prompt = 'Falar'
//   this.persistentId    -> se definido, a coleta/abertura é salva (não volta)
//   this.z               -> ordem de desenho (maior = na frente). Jogador = 50.
//   this.alwaysUpdate    -> atualiza mesmo fora da tela
// =============================================================================
import { TILE, rectsOverlap } from './util.js';
import { moveBody } from './tilemap.js';

let _nextId = 1;

export class Entity {
  constructor(level, x = 0, y = 0, props = {}) {
    this.id = _nextId++;
    this.level = level;
    this.x = x; this.y = y;
    this.w = 16; this.h = 16;
    this.vx = 0; this.vy = 0;
    this.props = props;
    this.dead = false;
    this.facing = 1;
    this.z = 10;
    this.t = 0;              // age in seconds
    this.grounded = false;
    this.hp = 1;
    this.maxHp = 1;
    this.flash = 0;          // white hit flash timer
    this.invuln = 0;
    this.contactDamage = 1;
    this.gravity = 900;
    this.maxFall = 380;
    this.tags = new Set();
    this.activeRange = 260;  // update only when within this distance of camera view
  }

  // ---- geometry helpers
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get left() { return this.x; }
  get right() { return this.x + this.w; }
  get top() { return this.y; }
  get bottom() { return this.y + this.h; }
  get tx() { return Math.floor(this.cx / TILE); }
  get ty() { return Math.floor(this.cy / TILE); }
  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  overlaps(o) { return rectsOverlap(this, o); }
  distTo(o) { return Math.hypot(o.cx - this.cx, o.cy - this.cy); }
  /** Place so that the bottom of the entity sits on the bottom of its map cell. */
  alignToCell(cellX, cellY) {
    this.x = cellX + (TILE - this.w) / 2;
    this.y = cellY + TILE - this.h;
  }

  init() {}
  update(dt) {}
  draw(ctx) {}
  onRemove() {}

  remove() {
    if (this.dead) return;
    this.dead = true;
  }

  /** Apply gravity + move with collisions. Returns body flags. */
  physics(dt, opts = {}) {
    if (!opts.noGravity) this.vy = Math.min(this.maxFall, this.vy + this.gravity * dt);
    moveBody(this, this.vx * dt, this.vy * dt, this.level, opts);
    return this;
  }

  /** Check ground ahead (for patrolling enemies not walking off ledges). */
  groundAhead(dir = this.facing, dist = 2) {
    const px = dir > 0 ? this.x + this.w + dist : this.x - dist;
    return this.level.map.solidAt(px, this.y + this.h + 2) || this.level.platformAt(px, this.y + this.h + 2);
  }
  wallAhead(dir = this.facing, dist = 2) {
    const px = dir > 0 ? this.x + this.w + dist : this.x - dist;
    return this.level.map.solidAt(px, this.y + this.h - 4) || this.level.map.solidAt(px, this.y + 2);
  }

  /** Called by player attacks / abilities. Return true if the hit landed. */
  hurt(amount = 1, source = null, opts = {}) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= amount;
    this.flash = 0.12;
    this.invuln = opts.invuln ?? 0.15;
    if (source && opts.knockback !== 0) {
      const dir = Math.sign(this.cx - (source.cx ?? source.x)) || 1;
      this.vx = dir * (opts.knockback ?? 120);
      if (!opts.noLift) this.vy = Math.min(this.vy, -80);
    }
    this.onHurt?.(amount, source, opts);
    if (this.hp <= 0) this.die(source);
    return true;
  }
  die(source) { this.remove(); }

  /** Common timers update — call from update() via super.update or manually. */
  tickTimers(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
  }

  /** Is the player within rect range (dx horizontally, dy vertically)? */
  playerNear(dx, dy = dx) {
    const p = this.level.player;
    if (!p || p.dead) return false;
    return Math.abs(p.cx - this.cx) < dx && Math.abs(p.cy - this.cy) < dy;
  }
  get player() { return this.level.player; }
}
