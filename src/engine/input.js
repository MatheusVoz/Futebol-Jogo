// =============================================================================
// input.js — Entrada unificada: teclado, gamepad, toque (botões virtuais) e
// ponteiro (menus por toque/mouse).
//
// Ações: left right up down jump attack dash ability cycle interact run
//        pause confirm back  (+ ab1..ab5 para selecionar habilidade direto)
//
//   input.down('jump')      // segurando
//   input.pressed('jump')   // apertou neste quadro (lógico, 60Hz)
//   input.released('jump')
//   input.consume('jump')   // marca como usado (não dispara de novo neste quadro)
//   input.axisX()           // -1..1
//   input.pointer           // {x,y,down,pressed,released} em coords da tela lógica
//   input.setVirtual('jump', true/false)  // usado pelos controles de toque
//   input.lastDevice        // 'keyboard' | 'gamepad' | 'touch'
// =============================================================================

export const ACTIONS = [
  'left', 'right', 'up', 'down', 'jump', 'attack', 'dash', 'ability', 'cycle',
  'interact', 'run', 'pause', 'confirm', 'back', 'ab1', 'ab2', 'ab3', 'ab4', 'ab5', 'map',
];

const KEYMAP = {
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['up', 'interact'], KeyW: ['up', 'interact'],
  ArrowDown: ['down'], KeyS: ['down'],
  Space: ['jump', 'confirm'], KeyZ: ['jump', 'confirm'], KeyK: ['jump'],
  KeyX: ['attack', 'back'], KeyJ: ['attack'],
  KeyC: ['dash'], KeyL: ['dash'], ShiftRight: ['dash'],
  KeyV: ['ability'], KeyI: ['ability'],
  KeyQ: ['cycle'], KeyE: ['cycle'], Tab: ['cycle'],
  ShiftLeft: ['run'],
  Enter: ['confirm', 'pause'], Escape: ['pause', 'back'], KeyP: ['pause'], Backspace: ['back'],
  KeyF: ['interact'],
  KeyM: ['map'],
  Digit1: ['ab1'], Digit2: ['ab2'], Digit3: ['ab3'], Digit4: ['ab4'], Digit5: ['ab5'],
};

// Standard gamepad mapping
const PADMAP = {
  0: ['jump', 'confirm'], 1: ['dash', 'back'], 2: ['attack'], 3: ['ability'],
  4: ['cycle'], 5: ['run'], 6: ['cycle'], 7: ['ability'],
  8: ['map'], 9: ['pause'], 12: ['up', 'interact'], 13: ['down'], 14: ['left'], 15: ['right'],
};

class Input {
  constructor() {
    this.state = {};      // current down state per action (merged)
    this.prev = {};
    this.keys = new Set();
    this.virtual = {};    // touch overlay
    this.pad = {};
    this.consumed = new Set();
    this.pointer = { x: 0, y: 0, down: false, pressed: false, released: false, id: null };
    this._pointerPressedEdge = false;
    this._pointerReleasedEdge = false;
    this.lastDevice = 'keyboard';
    this.toView = (cx, cy) => ({ x: cx, y: cy }); // set by game (client -> view coords)
    this.enabled = true;
    this.pressedLatch = {}; // presses that happened between logic frames
    this.anyKeyHandlers = new Set();
    for (const a of ACTIONS) { this.state[a] = false; this.prev[a] = false; }
  }

  attach(target = window, canvas) {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) { if (KEYMAP[e.code]) e.preventDefault(); return; }
      this.keys.add(e.code);
      this.lastDevice = 'keyboard';
      for (const a of KEYMAP[e.code] || []) this.pressedLatch[a] = true;
      if (KEYMAP[e.code]) e.preventDefault();
      for (const h of this.anyKeyHandlers) h(e);
    });
    target.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    target.addEventListener('blur', () => { this.keys.clear(); this.virtual = {}; });
    if (canvas) {
      const toV = (e) => { const r = this.toView(e.clientX, e.clientY); return r; };
      canvas.addEventListener('pointerdown', (e) => {
        const p = toV(e);
        Object.assign(this.pointer, p, { down: true, id: e.pointerId });
        this._pointerPressedEdge = true;
        if (e.pointerType === 'touch') this.lastDevice = 'touch';
      });
      canvas.addEventListener('pointermove', (e) => {
        if (this.pointer.id !== null && this.pointer.id !== e.pointerId && this.pointer.down) return;
        Object.assign(this.pointer, toV(e));
      });
      const up = (e) => {
        if (this.pointer.id !== null && this.pointer.id !== e.pointerId) return;
        Object.assign(this.pointer, toV(e), { down: false, id: null });
        this._pointerReleasedEdge = true;
      };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
    }
  }

  setVirtual(action, down) {
    if (down && !this.virtual[action]) this.pressedLatch[action] = true;
    this.virtual[action] = down;
    this.lastDevice = 'touch';
  }

  pollGamepad() {
    this.pad = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      gp.buttons.forEach((b, i) => {
        if (b.pressed) {
          for (const a of PADMAP[i] || []) this.pad[a] = true;
          this.lastDevice = 'gamepad';
        }
      });
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -0.4) this.pad.left = true;
      if (ax > 0.4) this.pad.right = true;
      if (ay < -0.5) { this.pad.up = true; this.pad.interact = true; }
      if (ay > 0.5) this.pad.down = true;
      if (Math.abs(ax) > 0.4 || Math.abs(ay) > 0.5) this.lastDevice = 'gamepad';
    }
  }

  /** Called once per logic tick (60Hz) BEFORE game update. */
  update() {
    this.pollGamepad();
    for (const a of ACTIONS) {
      this.prev[a] = this.state[a];
      let d = !!this.virtual[a] || !!this.pad[a];
      if (!d) for (const k of this.keys) { const m = KEYMAP[k]; if (m && m.includes(a)) { d = true; break; } }
      // a press that started and ended between ticks still counts as one press
      if (this.pressedLatch[a] && !d && !this.prev[a]) { this.state[a] = true; this._latchRelease = this._latchRelease || new Set(); this._latchRelease.add(a); }
      else this.state[a] = d;
    }
    this.pressedLatch = {};
    this.consumed.clear();
    this.pointer.pressed = this._pointerPressedEdge;
    this.pointer.released = this._pointerReleasedEdge;
    this._pointerPressedEdge = false;
    this._pointerReleasedEdge = false;
  }

  /** Called after game update — releases one-tick latched presses. */
  postUpdate() {
    if (this._latchRelease) {
      for (const a of this._latchRelease) this.state[a] = false;
      this._latchRelease.clear();
    }
  }

  down(a) { return this.enabled && !!this.state[a]; }
  pressed(a) { return this.enabled && this.state[a] && !this.prev[a] && !this.consumed.has(a); }
  released(a) { return this.enabled && !this.state[a] && this.prev[a]; }
  consume(a) { this.consumed.add(a); }
  axisX() { return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0); }
  axisY() { return (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0); }
  /** True if any menu-ish button was pressed this tick. */
  anyPressed() {
    return ['jump', 'attack', 'confirm', 'pause', 'dash', 'ability'].some((a) => this.pressed(a)) || this.pointer.pressed;
  }
  clearAll() {
    this.keys.clear(); this.virtual = {}; this.pressedLatch = {};
    for (const a of ACTIONS) { this.state[a] = false; this.prev[a] = false; }
  }
}

export const input = new Input();
export default input;
