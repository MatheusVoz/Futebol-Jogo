// =============================================================================
// tilemap.js — Grade de tiles estáticos + colisão AABB contra tiles e sólidos
// dinâmicos (plataformas móveis, pontes de fio, blocos...).
//
// Tipos de tile (T.*):
//   EMPTY  vazio            SOLID  chão/parede       ALT   sólido de material alternativo
//   ONEWAY plataforma vazada (atravessa por baixo)    SPIKE espinhos (dano)
//   WATER  água (nado)      FAKE   parede falsa (parece sólida; passagem secreta)
//   BG     parede de fundo decorativa (não colide)
// =============================================================================
import { TILE } from './util.js';

export const T = { EMPTY: 0, SOLID: 1, ALT: 2, ONEWAY: 3, SPIKE: 4, WATER: 5, FAKE: 6, BG: 7 };

export const TILE_CHARS = {
  '#': T.SOLID, '%': T.ALT, '=': T.ONEWAY, '^': T.SPIKE, '~': T.WATER, H: T.FAKE, ':': T.BG,
};

export const isSolidType = (t) => t === T.SOLID || t === T.ALT;

export class Tilemap {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.data = new Uint8Array(cols * rows);
    this.revealed = new Uint8Array(cols * rows); // for FAKE tiles faded out
  }
  get width() { return this.cols * TILE; }
  get height() { return this.rows * TILE; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows; }
  get(tx, ty) {
    if (tx < 0 || tx >= this.cols) return ty < this.rows ? T.SOLID : T.EMPTY; // side walls
    if (ty < 0) return this.get(tx, 0) === T.WATER ? T.WATER : T.EMPTY;
    if (ty >= this.rows) return T.EMPTY; // bottomless pit
    return this.data[ty * this.cols + tx];
  }
  set(tx, ty, t) { if (this.inBounds(tx, ty)) this.data[ty * this.cols + tx] = t; }
  at(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); }
  solidAt(px, py) { return isSolidType(this.at(px, py)); }
  isSolid(tx, ty) { return isSolidType(this.get(tx, ty)); }

  /** Does rect overlap any tile of given type? */
  rectHas(x, y, w, h, type) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.get(tx, ty) === type) return true;
    return false;
  }
  rectSolid(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolidType(this.get(tx, ty))) return true;
    return false;
  }

  /** Raycast through solid tiles (DDA). Returns {x,y,dist,hit} */
  raycast(x0, y0, dx, dy, maxDist = 400) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const step = 2;
    for (let d = 0; d <= maxDist; d += step) {
      const x = x0 + dx * d, y = y0 + dy * d;
      if (this.solidAt(x, y)) return { x, y, dist: d, hit: true };
    }
    return { x: x0 + dx * maxDist, y: y0 + dy * maxDist, dist: maxDist, hit: false };
  }
  /** Line of sight between two points (no solid tiles). */
  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    return !this.raycast(x0, y0, x1 - x0, y1 - y0, d).hit;
  }
}

// =============================================================================
// Physics: moveBody — move an AABB body against tiles + dynamic solids.
//
// body: { x, y, w, h, vx, vy } — this function sets body.grounded, body.hitWall
// (−1/0/1), body.hitCeiling, body.groundEntity, body.onOneWay.
// world: { map: Tilemap, solids: Entity[] } — solids have x,y,w,h and either
//   .solid = true (blocks all sides) or .oneway = true (top only).
// opts.dropThrough: ignore one-way platforms (player pressing down+jump).
// =============================================================================
const EPS = 0.001;

function overlapsSolidEntity(x, y, w, h, solids, self) {
  for (const s of solids) {
    if (s === self || !s.solid || s.dead) continue;
    if (x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return s;
  }
  return null;
}

export function moveBody(body, dx, dy, world, opts = {}) {
  const map = world.map;
  const solids = world.solids || [];
  body.hitWall = 0;
  body.hitCeiling = false;
  const wasGrounded = body.grounded;
  body.grounded = false;
  body.groundEntity = null;
  body.onOneWay = false;

  // ---- X axis (substeps)
  let remaining = dx;
  while (Math.abs(remaining) > EPS) {
    const step = Math.max(-6, Math.min(6, remaining));
    remaining -= step;
    const nx = body.x + step;
    const hits = (x) => map.rectSolid(x, body.y, body.w, body.h) || overlapsSolidEntity(x, body.y, body.w, body.h, solids, body);
    if (step !== 0 && hits(nx)) {
      // creep toward the obstacle in small increments, then stop flush against it
      const s = Math.sign(step);
      let moved = 0;
      while (Math.abs(moved) + 0.25 <= Math.abs(step) && !hits(body.x + moved + s * 0.25)) moved += s * 0.25;
      body.x += moved;
      // snap to exact tile edge when touching a tile wall
      const edgeX = s > 0 ? Math.ceil(body.x + body.w) : Math.floor(body.x);
      if (Math.abs(edgeX - (s > 0 ? body.x + body.w : body.x)) < 0.26 && edgeX % TILE === 0) {
        const snapped = s > 0 ? edgeX - body.w : edgeX;
        if (!hits(snapped)) body.x = snapped;
      }
      body.hitWall = s;
      body.vx = 0;
      break;
    }
    body.x = nx;
  }

  // ---- Y axis
  remaining = dy;
  while (Math.abs(remaining) > EPS) {
    const step = Math.max(-6, Math.min(6, remaining));
    remaining -= step;
    const ny = body.y + step;
    let blocked = false;
    if (map.rectSolid(body.x, ny, body.w, body.h)) {
      blocked = true;
      if (step > 0) body.y = Math.floor((ny + body.h) / TILE) * TILE - body.h;
      else body.y = (Math.floor(ny / TILE) + 1) * TILE;
    } else {
      const se = overlapsSolidEntity(body.x, ny, body.w, body.h, solids, body);
      if (se) {
        blocked = true;
        if (step > 0) { body.y = se.y - body.h; body.groundEntity = se; }
        else body.y = se.y + se.h;
      } else if (step > 0 && !opts.dropThrough) {
        // one-way tiles & entities
        const footPrev = body.y + body.h;
        const footNew = ny + body.h;
        const x0 = Math.floor((body.x + 1) / TILE), x1 = Math.floor((body.x + body.w - 1) / TILE);
        const ty = Math.floor((footNew - EPS) / TILE);
        const top = ty * TILE;
        if (footPrev <= top + EPS) {
          for (let tx = x0; tx <= x1; tx++) {
            if (map.get(tx, ty) === T.ONEWAY) { blocked = true; body.y = top - body.h; body.onOneWay = true; break; }
          }
        }
        if (!blocked) {
          for (const s of solids) {
            if (!s.oneway || s.dead || s === body) continue;
            if (body.x + body.w > s.x && body.x < s.x + s.w && footPrev <= s.y + EPS && footNew >= s.y) {
              blocked = true; body.y = s.y - body.h; body.groundEntity = s; body.onOneWay = true; break;
            }
          }
        }
      }
    }
    if (blocked) {
      if (step > 0) body.grounded = true;
      else body.hitCeiling = true;
      body.vy = 0;
      break;
    }
    body.y = ny;
  }

  // ground probe when not moving vertically (resting)
  if (!body.grounded && dy >= 0) {
    const probe = 1;
    if (map.rectSolid(body.x, body.y + body.h, body.w, probe)) body.grounded = true;
    else {
      const se = overlapsSolidEntity(body.x, body.y + probe, body.w, body.h, solids, body);
      if (se && se.y >= body.y + body.h - 1) { body.grounded = true; body.groundEntity = se; }
      else if (!opts.dropThrough) {
        const foot = body.y + body.h;
        if (Math.abs(foot - Math.round(foot / TILE) * TILE) < 0.5) {
          const ty = Math.round(foot / TILE);
          const x0 = Math.floor((body.x + 1) / TILE), x1 = Math.floor((body.x + body.w - 1) / TILE);
          for (let tx = x0; tx <= x1; tx++) if (map.get(tx, ty) === T.ONEWAY) { body.grounded = true; body.onOneWay = true; }
        }
        if (!body.grounded) for (const s of solids) {
          if (!s.oneway || s.dead) continue;
          if (body.x + body.w > s.x && body.x < s.x + s.w && Math.abs(foot - s.y) < 1) { body.grounded = true; body.groundEntity = s; body.onOneWay = true; break; }
        }
      }
    }
  }
  body.justLanded = body.grounded && !wasGrounded;
  return body;
}
