// =============================================================================
// audio/sfx.js — Todos os efeitos sonoros de STITCHED WORLDS (100% sintetizados).
//
// Identidade sonora: um mundo de pelúcia e feltro. Passos e quedas são "fwumps"
// macios (seno com queda de altura + sopro de ruído marrom), fios cortam o ar com
// whooshes de ruído rosa filtrado, botões/estrelas brilham com sinos FM, a UI usa
// blips suaves (triângulo + um toque de quadrada filtrada) e as habilidades têm um
// brilho mágico (sinos inarmônicos, faíscas pentatônicas, chorus desafinado).
// Nada de agudos ásperos: quase tudo passa por filtros e envelopes curtos.
//
// Cada som é uma função (ac, dest, t, opts) registrada via registerSfx. Por cima do
// motor há uma mini-síntese própria (classe Kit) que:
//   • escala TODAS as frequências por opts.pitch — inclusive filtros de ruído —
//     para que randomPitch/pitch dos chamadores funcionem em sons ruidosos;
//   • respeita opts.vol (o motor só repassa; ex.: 'land' usa vol ∝ velocidade);
//   • envia para o reverb (opts.reverb) só onde pedido (campo `rv`), e ignora o
//     envio no render offline (lá reverb === dest e somaria seco ao pico).
//
// Uso típico: audio.sfx('coin'), audio.sfx('step', { vol: 0.35, randomPitch: 0.15 }).
// 'text_blip' / 'text_blip_low' são curtíssimos: o diálogo varia opts.pitch por letra.
// Sons longos ficam abaixo de 2 s (limite do render offline dos testes).
//
// Categorias: UI · Movimento · Combate do Tico · Coletáveis · Objetos/puzzles ·
// Inimigos · Habilidades · Chefes/mundo · Extras.
// =============================================================================
import { registerSfx, noteFreq } from '../../engine/audio.js';

const N = (n) => noteFreq(n);
const PENTA = [0, 2, 4, 7, 9];
const rnd = (a, b) => a + Math.random() * (b - a);

// ----------------------------------------------------------- buffers e ondas
// Ruídos gerados uma vez por AudioContext (2 s, em loop com início aleatório).
const noiseCache = new WeakMap();
function noiseBuffer(ac, kind) {
  let m = noiseCache.get(ac);
  if (!m) { m = new Map(); noiseCache.set(ac, m); }
  if (m.has(kind)) return m.get(kind);
  const sr = ac.sampleRate, len = Math.floor(sr * 2);
  const b = ac.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  if (kind === 'pink') { // aproximação de Paul Kellet — sopros e whooshes mais macios
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else if (kind === 'brown') { // grave e redondo: corpo de pelúcia, ribombos
    const a = Math.exp(-2 * Math.PI * 140 / sr);
    let y = 0;
    for (let i = 0; i < len; i++) { y = a * y + (1 - a) * (Math.random() * 2 - 1); d[i] = y; }
  } else if (kind === 'crackle') { // estalos esparsos: farelos, papel, vidro, trovão
    const dec = Math.exp(-1 / (sr * 0.0015));
    let env = 0;
    for (let i = 0; i < len; i++) {
      if (Math.random() < 240 / sr) env = 0.25 + Math.random() * 0.75;
      d[i] = (Math.random() * 2 - 1) * env;
      env *= dec;
    }
  } else {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  // normaliza o pico (níveis consistentes entre tipos de ruído)
  let pk = 0;
  for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(d[i]));
  if (pk > 0) for (let i = 0; i < len; i++) d[i] *= 0.95 / pk;
  m.set(kind, b);
  return b;
}

const waveCache = new WeakMap();
function pulseWave(ac, duty) {
  let m = waveCache.get(ac);
  if (!m) { m = new Map(); waveCache.set(ac, m); }
  const key = duty.toFixed(3);
  if (m.has(key)) return m.get(key);
  const n = 48, re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  const w = ac.createPeriodicWave(re, im);
  m.set(key, w);
  return w;
}

// ------------------------------------------------------------- mini-síntese
// Especificação de voz (tone/noise):
//   w: 'sine'|'triangle'|'square'|'sawtooth'|'pulse'|'fm'   (tone)   c: 'white'|'pink'|'brown'|'crackle' (noise)
//   f, f2, pt (tempo da rampa de altura), pc:'lin', fp:[[t,f]...] (vários pontos), arp:[semitons], as (passo)
//   at (atraso), a/h/d (ataque, sustentação, decaimento exp.) ou env:[[t,nível 0..1]...] (rampas lineares)
//   v (volume de pico), lp/hp/bp + q (atalhos) ou fl:{type,f,f2,t,q,pts} (ou lista), kt:false (sem pitch-track)
//   vib:{r,d(semitons),delay}, tr:{r,d} (tremolo), n/spread (uníssono, cents), det, pan, rv (envio de reverb)
//   FM: ratio, index (desvio/f), index2, idec (tempo de queda do índice), cw (onda portadora)
class Kit {
  constructor(ac, dest, t, opts) {
    this.ac = ac;
    this.dest = dest;
    this.t = t;
    this.P = opts.pitch ?? 1;
    this.V = opts.vol ?? 1;
    this.rv = opts.reverb && opts.reverb !== dest ? opts.reverb : null;
    this.maxF = ac.sampleRate * 0.45;
  }
  hz(f) { return Math.max(10, Math.min(this.maxF, f)); }
  len(s) { return s.env ? s.env[s.env.length - 1][0] : (s.a ?? 0.003) + (s.h ?? 0) + (s.d ?? 0.1); }

  /** Envelope + filtros + tremolo + pan + envio; devolve o nó de entrada. */
  chain(s, t0, len) {
    const ac = this.ac;
    const v = Math.max(0.0003, (s.v ?? 0.3) * this.V);
    const g = ac.createGain();
    const gp = g.gain;
    gp.setValueAtTime(0, t0);
    if (s.env) {
      for (const [tt, lv] of s.env) gp.linearRampToValueAtTime(Math.max(0, lv) * v, t0 + tt);
    } else {
      const a = s.a ?? 0.003, h = s.h ?? 0, d = s.d ?? 0.1;
      gp.linearRampToValueAtTime(v, t0 + a);
      if (h > 0) gp.setValueAtTime(v, t0 + a + h);
      gp.exponentialRampToValueAtTime(0.0001, t0 + a + h + d);
    }
    const filters = s.fl ? (Array.isArray(s.fl) ? [...s.fl] : [s.fl]) : [];
    if (s.lp) filters.push({ type: 'lowpass', f: s.lp, q: s.q });
    if (s.hp) filters.push({ type: 'highpass', f: s.hp, q: s.q });
    if (s.bp) filters.push({ type: 'bandpass', f: s.bp, q: s.q });
    let input = g;
    for (let i = filters.length - 1; i >= 0; i--) {
      const F = filters[i];
      const bq = ac.createBiquadFilter();
      bq.type = F.type || 'lowpass';
      const k = s.kt === false || F.kt === false ? 1 : this.P;
      bq.frequency.setValueAtTime(this.hz(F.f * k), t0);
      if (F.pts) for (const [tt, ff] of F.pts) bq.frequency.exponentialRampToValueAtTime(this.hz(ff * k), t0 + tt);
      else if (F.f2) bq.frequency.exponentialRampToValueAtTime(this.hz(F.f2 * k), t0 + (F.t ?? len));
      // lowpass/highpass: Q em dB (0 = sem ressonância); bandpass: Q linear
      bq.Q.value = F.q ?? (bq.type === 'bandpass' ? 1 : 0);
      bq.connect(input);
      input = bq;
    }
    let tail = g;
    if (s.tr) {
      const dep = Math.min(1, s.tr.d ?? 0.5);
      const tg = ac.createGain();
      tg.gain.setValueAtTime(1 - dep / 2, t0);
      const lfo = ac.createOscillator();
      lfo.frequency.setValueAtTime(s.tr.r ?? 8, t0);
      const lg = ac.createGain();
      lg.gain.value = dep / 2;
      lfo.connect(lg).connect(tg.gain);
      lfo.start(t0); lfo.stop(t0 + len + 0.05);
      tail.connect(tg); tail = tg;
    }
    if (s.pan) {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, s.pan));
      tail.connect(p); tail = p;
    }
    tail.connect(this.dest);
    if (s.rv && this.rv) {
      const sg = ac.createGain();
      sg.gain.value = s.rv;
      tail.connect(sg).connect(this.rv);
    }
    return input;
  }

  /** Automação de frequência (rampa simples, multiponto e/ou arpejo). */
  freq(param, s, t0, len, mul) {
    const k = this.P * mul;
    param.setValueAtTime(this.hz(s.f * k), t0);
    const ramp = s.pc === 'lin' ? 'linearRampToValueAtTime' : 'exponentialRampToValueAtTime';
    if (s.fp) for (const [tt, ff] of s.fp) param[ramp](this.hz(ff * k), t0 + tt);
    else if (s.f2) param[ramp](this.hz(s.f2 * k), t0 + (s.pt ?? len));
    if (s.arp) {
      const sp = s.as ?? 0.05;
      const steps = s.arpLoop ? Math.ceil(len / sp) : s.arp.length;
      for (let i = 0; i < steps; i++) {
        param.setValueAtTime(this.hz(s.f * k * 2 ** (s.arp[i % s.arp.length] / 12)), t0 + i * sp);
      }
    }
  }

  tone(s) {
    const ac = this.ac;
    const t0 = this.t + (s.at || 0);
    const len = this.len(s);
    const end = t0 + len + 0.03;
    const input = this.chain(s, t0, len);
    const n = s.n || 1;
    let vg = input;
    if (n > 1) { vg = ac.createGain(); vg.gain.value = 1 / Math.sqrt(n); vg.connect(input); }
    for (let i = 0; i < n; i++) {
      const det = (s.det || 0) + (n > 1 ? (i / (n - 1) - 0.5) * 2 * (s.spread ?? 10) : 0);
      const detParams = [];
      let out;
      if (s.w === 'fm') {
        const car = ac.createOscillator();
        const mod = ac.createOscillator();
        const mg = ac.createGain();
        car.type = s.cw || 'sine';
        const ratio = s.ratio ?? 2;
        this.freq(car.frequency, s, t0, len, 1);
        this.freq(mod.frequency, s, t0, len, ratio);
        const base = s.f * this.P;
        mg.gain.setValueAtTime(base * (s.index ?? 2), t0);
        mg.gain.exponentialRampToValueAtTime(Math.max(0.5, base * (s.index2 ?? 0.06)), t0 + (s.idec ?? len));
        mod.connect(mg).connect(car.frequency);
        mod.start(t0); mod.stop(end);
        car.start(t0); car.stop(end);
        detParams.push(car.detune, mod.detune);
        out = car;
      } else {
        const o = ac.createOscillator();
        if (s.w === 'pulse') o.setPeriodicWave(pulseWave(ac, s.duty ?? 0.25));
        else o.type = s.w === 'saw' ? 'sawtooth' : (s.w || 'sine');
        this.freq(o.frequency, s, t0, len, 1);
        o.start(t0); o.stop(end);
        detParams.push(o.detune);
        out = o;
      }
      if (det) for (const p of detParams) p.setValueAtTime(det, t0);
      if (s.vib) { // vibrato em cents (acompanha glissandos)
        const lfo = ac.createOscillator();
        lfo.frequency.setValueAtTime(s.vib.r ?? 6, t0);
        const lg = ac.createGain();
        const cents = (s.vib.d ?? 0.3) * 100;
        if (s.vib.delay) { lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(cents, t0 + s.vib.delay); } else lg.gain.setValueAtTime(cents, t0);
        lfo.connect(lg);
        for (const p of detParams) lg.connect(p);
        lfo.start(t0); lfo.stop(end);
      }
      out.connect(vg);
    }
  }

  noise(s) {
    const ac = this.ac;
    const t0 = this.t + (s.at || 0);
    const len = this.len(s);
    const input = this.chain(s, t0, len);
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, s.c || 'white');
    src.loop = true;
    const k = s.kt === false ? 1 : this.P;
    src.playbackRate.setValueAtTime((s.rate ?? 1) * k, t0);
    src.connect(input);
    src.start(t0, Math.random() * 1.8);
    src.stop(t0 + len + 0.03);
  }
}

/** Registra um sfx construído com o Kit. */
function def(name, build) {
  registerSfx(name, (ac, dest, t, opts = {}) => {
    const k = new Kit(ac, dest, t, opts);
    if (k.V <= 0.001) return;
    build(k, opts);
  });
}

// ------------------------------------------------------- blocos reutilizáveis
/** "Fwump" de pelúcia: seno caindo + harmônico p/ alto-falantes pequenos + sopro marrom. */
function thump(k, o = {}) {
  const f = o.f ?? 180, f2 = o.f2 ?? f * 0.33, pt = o.pt ?? 0.07, d = o.d ?? 0.14, v = o.v ?? 0.4, at = o.at || 0;
  k.tone({ w: 'sine', f, f2, pt, a: 0.002, d, v, at });
  k.tone({ w: 'triangle', f, f2: f2 * 1.3, pt: pt * 0.8, a: 0.002, d: d * 0.5, v: v * 0.25, lp: 1200, at });
  const puff = o.puff ?? 0.6;
  if (puff > 0) {
    const lp = o.lp ?? 1000;
    k.noise({ c: 'brown', fl: { type: 'lowpass', f: lp, f2: lp * 0.3, t: d * 0.6 }, a: 0.003, d: d * 0.8, v: v * puff, at });
  }
}

/** Fio cortando o ar: ruído rosa em passa-banda varrendo f1→f2. */
function whoosh(k, o = {}) {
  k.noise({
    c: 'pink', fl: { type: 'bandpass', f: o.f1 ?? 600, f2: o.f2 ?? 3500, t: o.t, q: o.q ?? 1.2 },
    a: o.a ?? 0.03, h: o.h ?? 0, d: o.d ?? 0.15, v: o.v ?? 0.3, at: o.at, rv: o.rv, pan: o.pan,
  });
}

/** Sino FM (ratio 3 = harmônico/doce; 3.5 = glockenspiel inarmônico) + corpo senoidal. */
function bell(k, f, o = {}) {
  const d = o.d ?? 0.4, v = o.v ?? 0.12;
  k.tone({ w: 'fm', f, ratio: o.ratio ?? 3.5, index: o.index ?? 1.8, idec: o.idec ?? 0.12, a: 0.002, d, v, at: o.at, rv: o.rv, pan: o.pan });
  const body = o.body ?? 0.8;
  if (body > 0) k.tone({ w: 'sine', f, a: 0.002, d: d * 0.8, v: v * body, at: o.at, pan: o.pan });
}

/** Faíscas: pings pentatônicos agudos, curtos, espalhados no tempo e no estéreo. */
function sparkle(k, o = {}) {
  const n = o.n ?? 4, base = o.base ?? N('C7'), t0 = o.at ?? 0, span = o.span ?? 0.25, oct = o.oct ?? 1;
  for (let i = 0; i < n; i++) {
    const semi = PENTA[(Math.random() * 5) | 0] + 12 * ((Math.random() * oct) | 0);
    k.tone({
      w: 'fm', f: base * 2 ** (semi / 12), ratio: 2, index: 0.7, idec: 0.05, a: 0.002, d: rnd(0.08, 0.16),
      v: (o.v ?? 0.05) * rnd(0.6, 1), at: t0 + (i + Math.random()) * (span / n), pan: rnd(-0.5, 0.5), rv: o.rv,
    });
  }
}

/** Blip de UI: triângulo macio + pitada de quadrada filtrada (sabor 8-bit discreto). */
function blip(k, f, o = {}) {
  const f2 = o.f2 ?? f * 1.02, d = o.d ?? 0.07, v = o.v ?? 0.2;
  k.tone({ w: o.w ?? 'triangle', f, f2, pt: 0.03, a: 0.002, h: o.h ?? 0, d, v, lp: o.lp ?? 5000, at: o.at });
  const chip = o.chip ?? 0.2;
  if (chip > 0) k.tone({ w: 'square', f, f2, pt: 0.03, a: 0.002, h: o.h ?? 0, d: d * 0.7, v: v * chip, lp: 2200, at: o.at });
}

/** Clique curtinho (ruído em passa-banda). */
function click(k, o = {}) {
  k.noise({ c: 'white', fl: { type: 'bandpass', f: o.f ?? 2500, q: o.q ?? 2 }, a: 0.0008, d: o.d ?? 0.015, v: o.v ?? 0.3, at: o.at });
}

/** Corda/fio tensionado: dente-de-serra com filtro fechando. */
function pluck(k, f, o = {}) {
  const d = o.d ?? 0.3;
  k.tone({
    w: 'sawtooth', f, f2: o.f2, a: 0.002, d, v: o.v ?? 0.15, at: o.at, vib: o.vib, rv: o.rv,
    fl: { type: 'lowpass', f: o.bright ?? f * 8, f2: f * 1.5, t: d * 0.6, q: 4 },
  });
}

/** Tique de relógio. */
function tick(k, o = {}) {
  const f = o.f ?? 2400, v = o.v ?? 0.2;
  k.tone({ w: 'sine', f, f2: f * 0.7, pt: 0.02, a: 0.001, d: 0.03, v, at: o.at });
  k.tone({ w: 'triangle', f: f * 0.4, f2: f * 0.36, a: 0.001, d: 0.028, v: v * 0.5, at: o.at });
  click(k, { f: 3500, q: 3, d: 0.01, v: v * 1.2, at: o.at });
}

/** Bolha: seno subindo rápido ("blup"), com leve variação natural. */
function bubbleTone(k, o = {}) {
  const f = (o.f ?? 500) * rnd(0.88, 1.12), d = o.d ?? 0.055;
  k.tone({ w: 'sine', f, f2: f * (o.up ?? 2.4), pt: d, a: 0.003, d: d + 0.01, v: o.v ?? 0.12, at: o.at, pan: o.pan });
}

// =============================================================================
// UI / MENUS
// =============================================================================
def('ui_move', (k) => {
  k.tone({ w: 'triangle', f: 880, f2: 940, pt: 0.03, a: 0.002, d: 0.055, v: 0.2, lp: 5000 });
  k.tone({ w: 'sine', f: 1760, a: 0.001, d: 0.025, v: 0.04 });
  click(k, { f: 4000, q: 1.5, d: 0.01, v: 0.15 });
});

def('ui_select', (k) => {
  blip(k, N('E5'), { d: 0.07, v: 0.2 });
  blip(k, N('B5'), { at: 0.055, h: 0.02, d: 0.16, v: 0.22 });
  bell(k, N('B5'), { at: 0.055, ratio: 3, index: 1.5, d: 0.22, v: 0.06, body: 0 });
});

def('ui_back', (k) => {
  blip(k, N('G5'), { f2: N('G5') * 0.97, d: 0.06, v: 0.18 });
  blip(k, N('D5'), { at: 0.05, f2: N('D5') * 0.95, d: 0.12, v: 0.18 });
});

def('ui_open', (k) => {
  whoosh(k, { f1: 500, f2: 2800, a: 0.06, d: 0.1, v: 0.18 });
  k.tone({ w: 'sine', f: 392, f2: 784, pt: 0.09, a: 0.01, d: 0.12, v: 0.16 });
  blip(k, N('G5'), { at: 0.08, d: 0.14, v: 0.16 });
  bell(k, N('D6'), { at: 0.1, ratio: 3, d: 0.25, v: 0.05, body: 0.5 });
});

def('ui_close', (k) => {
  whoosh(k, { f1: 2600, f2: 600, a: 0.04, d: 0.1, v: 0.16 });
  k.tone({ w: 'sine', f: 740, f2: 370, pt: 0.1, a: 0.005, d: 0.12, v: 0.16 });
  thump(k, { at: 0.08, f: 240, f2: 120, d: 0.08, v: 0.18, puff: 0.4 });
});

def('ui_switch', (k) => { // troca de habilidade: clique + blip subindo + giro
  click(k, { f: 2800, q: 2, d: 0.012, v: 0.3 });
  k.tone({ w: 'square', f: 1250, f2: 1150, a: 0.001, d: 0.02, v: 0.05, lp: 3000 });
  blip(k, N('C6'), { at: 0.035, f2: N('D6'), d: 0.08, v: 0.17 });
  whoosh(k, { at: 0.02, f1: 1500, f2: 3500, a: 0.02, d: 0.06, v: 0.07 });
});

def('ui_denied', (k) => { // "nã-ão": duas notas graves e abafadas
  for (const [at, f] of [[0, 196], [0.11, 165]]) {
    k.tone({ w: 'square', f, f2: f * 0.94, a: 0.004, h: 0.04, d: 0.09, v: 0.12, lp: 1100, at });
    k.tone({ w: 'triangle', f, f2: f * 0.94, a: 0.004, h: 0.04, d: 0.1, v: 0.2, at });
  }
});

def('menu_confirm_big', (k) => { // "Novo jogo"/confirmação importante
  thump(k, { f: 220, f2: 80, d: 0.16, v: 0.25 });
  ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
    blip(k, N(n), { at: i * 0.05, f2: N(n), d: 0.22, v: 0.15, chip: 0.25 });
    bell(k, N(n) * 2, { at: i * 0.05, ratio: 3, d: 0.3, v: 0.04, body: 0 });
  });
  for (const n of ['C6', 'E6', 'G6']) k.tone({ w: 'sine', f: N(n), a: 0.01, d: 0.7, v: 0.06, at: 0.2, vib: { r: 5, d: 0.08 }, rv: 0.35 });
  whoosh(k, { f1: 600, f2: 4500, a: 0.12, d: 0.2, v: 0.1 });
  sparkle(k, { at: 0.2, n: 5, span: 0.4, v: 0.05 });
});

def('text_blip', (k) => { // letra a letra: curtíssimo e macio (chamador varia pitch)
  k.tone({ w: 'triangle', f: 540, f2: 480, pt: 0.03, a: 0.002, d: 0.035, v: 0.15, lp: 3200 });
  k.tone({ w: 'square', f: 540, f2: 480, pt: 0.03, a: 0.002, d: 0.022, v: 0.025, lp: 1800 });
});

def('text_blip_low', (k) => { // vozes graves (chefes, rei, baleia)
  k.tone({ w: 'triangle', f: 240, f2: 210, pt: 0.04, a: 0.003, d: 0.05, v: 0.17, lp: 2000 });
  k.tone({ w: 'square', f: 240, f2: 210, pt: 0.04, a: 0.003, d: 0.035, v: 0.04, lp: 1000 });
});

def('page_turn', (k) => { // folha virando + leve batida ao assentar
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 1600, f2: 4200, t: 0.14, q: 0.9 }, a: 0.07, h: 0.03, d: 0.12, v: 0.3, tr: { r: 38, d: 0.55 } });
  k.noise({ c: 'crackle', hp: 2000, a: 0.02, h: 0.05, d: 0.1, v: 0.12 });
  k.noise({ c: 'pink', lp: 700, a: 0.003, d: 0.07, v: 0.14, at: 0.19 });
  k.tone({ w: 'sine', f: 180, f2: 100, a: 0.002, d: 0.07, v: 0.1, at: 0.19 });
});

// =============================================================================
// MOVIMENTO DO TICO
// =============================================================================
def('jump', (k) => {
  k.tone({ w: 'sine', f: 250, f2: 540, pt: 0.09, a: 0.004, d: 0.13, v: 0.26 });
  k.tone({ w: 'square', f: 250, f2: 540, pt: 0.09, a: 0.004, d: 0.08, v: 0.045, lp: 1800 });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 1300, f2: 2600, q: 0.9 }, a: 0.008, d: 0.07, v: 0.16 });
});

def('double_jump', (k) => {
  k.tone({ w: 'triangle', f: 380, f2: 880, pt: 0.1, a: 0.004, d: 0.15, v: 0.22 });
  whoosh(k, { f1: 1000, f2: 4500, a: 0.025, d: 0.12, v: 0.16 });
  bell(k, N('E6'), { at: 0.04, ratio: 3, index: 1.6, d: 0.25, v: 0.08, body: 0.6 });
  bell(k, N('B6'), { at: 0.075, ratio: 3, index: 1.2, d: 0.2, v: 0.05, body: 0.5 });
});

def('land', (k) => thump(k, { f: 190, f2: 60, d: 0.14, v: 0.42, puff: 0.8, lp: 1200 }));

def('step', (k) => { // passinho de feltro (chamador: vol 0.35, randomPitch 0.15)
  const r = rnd(0.85, 1.15);
  k.tone({ w: 'sine', f: 200 * r, f2: 110 * r, pt: 0.035, a: 0.002, d: 0.05, v: 0.3 });
  k.noise({ c: 'pink', fl: { type: 'lowpass', f: 1100 * r, f2: 500 * r, t: 0.04 }, a: 0.002, d: 0.045, v: 0.4 });
});

def('skid', (k) => { // derrapada: tecido raspando
  k.noise({ c: 'white', fl: { type: 'bandpass', f: 2400, f2: 1300, q: 2.5 }, a: 0.01, h: 0.06, d: 0.16, v: 0.4, tr: { r: 36, d: 0.7 } });
  k.noise({ c: 'pink', lp: 700, a: 0.01, d: 0.18, v: 0.15 });
});

def('dash', (k) => { // zip de linha
  whoosh(k, { f1: 700, f2: 4200, t: 0.12, q: 1.5, a: 0.015, h: 0.02, d: 0.14, v: 0.38 });
  k.tone({ w: 'triangle', f: 320, f2: 1100, pt: 0.1, a: 0.004, d: 0.12, v: 0.12 });
  k.tone({ w: 'sine', f: 200, f2: 80, pt: 0.06, a: 0.002, d: 0.08, v: 0.2 });
});

def('swim', (k) => { // braçada: empurrão d'água + bolhinhas
  k.noise({ c: 'brown', fl: { type: 'lowpass', f: 1000, f2: 350 }, a: 0.025, d: 0.18, v: 0.3 });
  bubbleTone(k, { at: 0.02, f: 420, up: 2.1, v: 0.13 });
  bubbleTone(k, { at: 0.07, f: 620, up: 2.1, d: 0.045, v: 0.08 });
});

def('splash_in', (k) => {
  k.noise({ c: 'white', fl: { type: 'lowpass', f: 5000, f2: 700, t: 0.3 }, a: 0.004, d: 0.38, v: 0.3 });
  k.noise({ c: 'brown', lp: 600, a: 0.005, d: 0.25, v: 0.35 });
  k.tone({ w: 'sine', f: 160, f2: 60, pt: 0.1, a: 0.003, d: 0.16, v: 0.32 });
  [0.1, 0.16, 0.23, 0.3].forEach((at, i) => bubbleTone(k, { at, f: 520 + i * 90, v: 0.09 - i * 0.015 }));
});

def('splash_out', (k) => {
  k.noise({ c: 'white', fl: { type: 'bandpass', f: 2400, f2: 4500, q: 0.8 }, a: 0.003, d: 0.22, v: 0.32 });
  k.noise({ c: 'brown', lp: 700, a: 0.003, d: 0.12, v: 0.2 });
  bubbleTone(k, { at: 0.03, f: 700, v: 0.1 });
  k.tone({ w: 'sine', f: 1100, f2: 2300, pt: 0.03, a: 0.002, d: 0.04, v: 0.07, at: 0.13 });
});

// =============================================================================
// COMBATE DO TICO
// =============================================================================
def('whip', (k) => { // chicote de fio: whoosh + estalinho + ressonância da linha
  whoosh(k, { f1: 1100, f2: 5000, t: 0.08, q: 1.2, a: 0.025, d: 0.08, v: 0.34 });
  k.noise({ c: 'white', hp: 2500, a: 0.001, d: 0.022, v: 0.2, at: 0.065 });
  k.tone({ w: 'triangle', f: 1700, f2: 800, pt: 0.03, a: 0.001, d: 0.035, v: 0.1, at: 0.065 });
  k.tone({ w: 'triangle', f: 660, f2: 640, a: 0.002, d: 0.1, v: 0.06, at: 0.065, vib: { r: 30, d: 0.3 } });
});

def('whip_big', (k) => { // 3º golpe do combo
  whoosh(k, { f1: 500, f2: 4500, t: 0.13, q: 1.0, a: 0.05, d: 0.13, v: 0.38 });
  k.noise({ c: 'white', hp: 2000, a: 0.001, d: 0.03, v: 0.26, at: 0.11 });
  k.tone({ w: 'square', f: 1500, f2: 600, pt: 0.05, a: 0.001, d: 0.05, v: 0.06, lp: 3000, at: 0.11 });
  thump(k, { at: 0.1, f: 200, f2: 70, d: 0.14, v: 0.3, puff: 0.4 });
  sparkle(k, { at: 0.11, n: 2, span: 0.1, v: 0.05 });
});

def('hit', (k) => { // impacto gordinho
  k.tone({ w: 'sine', f: 260, f2: 70, pt: 0.06, a: 0.001, d: 0.12, v: 0.45 });
  k.tone({ w: 'triangle', f: 260, f2: 90, pt: 0.04, a: 0.001, d: 0.06, v: 0.14, lp: 1500 });
  k.noise({ c: 'pink', fl: { type: 'lowpass', f: 3500, f2: 600, t: 0.06 }, a: 0.001, d: 0.07, v: 0.4 });
  k.tone({ w: 'square', f: 900, f2: 300, pt: 0.025, a: 0.001, d: 0.025, v: 0.08, lp: 3500 });
});

def('needle', (k) => { // Agulhada (projétil)
  k.tone({ w: 'triangle', f: 2000, f2: 700, pt: 0.12, a: 0.002, d: 0.14, v: 0.2 });
  k.tone({ w: 'fm', f: 2400, ratio: 1.41, index: 1.2, idec: 0.06, a: 0.001, d: 0.12, v: 0.06 });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 3000, f2: 6000, q: 1 }, a: 0.01, d: 0.1, v: 0.18 });
});

def('charge_ready', (k) => { // agulhada carregada: "di-ding"
  bell(k, N('E6'), { ratio: 3.5, index: 2.2, d: 0.3, v: 0.12 });
  bell(k, N('A6'), { at: 0.07, ratio: 3.5, index: 2.2, d: 0.4, v: 0.13, rv: 0.2 });
  k.noise({ c: 'white', hp: 6000, a: 0.02, d: 0.2, v: 0.05, at: 0.05 });
});

def('hurt', (k) => { // "ai!" fofo
  k.tone({ w: 'triangle', f: 640, f2: 280, pt: 0.18, a: 0.004, d: 0.22, v: 0.22, vib: { r: 24, d: 1.2 } });
  k.tone({ w: 'square', f: 640, f2: 280, pt: 0.18, a: 0.004, d: 0.18, v: 0.07, lp: 1600, vib: { r: 24, d: 1.2 } });
  thump(k, { f: 220, f2: 70, d: 0.12, v: 0.32, puff: 0.5 });
});

def('death', (k) => { // pelúcia murchando + caindo
  k.tone({ w: 'sine', f: 330, f2: 120, pt: 0.1, a: 0.002, d: 0.12, v: 0.25 });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 1500, f2: 500, q: 0.8 }, a: 0.003, d: 0.15, v: 0.2 });
  const wob = { r: 8, d: 0.7, delay: 0.15 };
  k.tone({ w: 'triangle', f: 760, f2: 120, pt: 0.85, a: 0.02, h: 0.35, d: 0.55, v: 0.22, vib: wob, at: 0.06 });
  k.tone({ w: 'square', f: 760, f2: 120, pt: 0.85, a: 0.02, h: 0.3, d: 0.4, v: 0.05, lp: 1400, vib: wob, at: 0.06 });
  thump(k, { at: 0.85, f: 160, f2: 50, d: 0.3, v: 0.4, puff: 0.6 });
});

def('stomp', (k) => { // pisão na cabeça: amassa + quica
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 1000, f2: 300, q: 1 }, a: 0.002, d: 0.1, v: 0.35 });
  k.tone({ w: 'sine', f: 280, f2: 80, pt: 0.05, a: 0.002, d: 0.12, v: 0.42 });
  k.tone({ w: 'triangle', f: 230, f2: 580, pt: 0.08, a: 0.004, d: 0.14, v: 0.17, at: 0.03 });
});

// =============================================================================
// COLETÁVEIS
// =============================================================================
def('coin', (k) => { // botão: dois toques cintilantes (chamador sobe o pitch em sequência)
  blip(k, N('B5'), { f2: N('B5'), d: 0.07, v: 0.16, chip: 0.25 });
  blip(k, N('E6'), { at: 0.055, f2: N('E6'), h: 0.02, d: 0.26, v: 0.18, chip: 0.2 });
  bell(k, N('E6'), { at: 0.055, ratio: 3, index: 1.8, d: 0.3, v: 0.07, body: 0 });
  k.tone({ w: 'sine', f: N('E7'), a: 0.002, d: 0.15, v: 0.03, at: 0.06 });
});

def('star', (k) => { // estrela costurada: arpejo brilhante + cauda cintilante
  k.tone({ w: 'sine', f: N('C4'), a: 0.01, d: 0.5, v: 0.1 });
  ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => {
    blip(k, N(n), { at: i * 0.06, f2: N(n), d: 0.3, v: 0.13, chip: 0.15 });
    bell(k, N(n), { at: i * 0.06, ratio: 3.5, index: 2, d: 0.45, v: 0.06, body: 0 });
  });
  for (const n of ['E7', 'G7']) k.tone({ w: 'sine', f: N(n), a: 0.02, d: 0.8, v: 0.04, at: 0.22, vib: { r: 6, d: 0.1 }, rv: 0.4 });
  sparkle(k, { at: 0.2, n: 7, span: 0.55, v: 0.045, rv: 0.3 });
  k.noise({ c: 'white', hp: 5000, a: 0.15, d: 0.5, v: 0.04, at: 0.1 });
});

def('heal', (k) => { // coração: arpejo quente
  ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => {
    k.tone({ w: 'sine', f: N(n), a: 0.01, d: 0.35, v: 0.15, at: i * 0.07, vib: { r: 6, d: 0.1 } });
    k.tone({ w: 'triangle', f: N(n), a: 0.005, d: 0.12, v: 0.06, at: i * 0.07 });
  });
  k.tone({ w: 'triangle', n: 2, spread: 12, f: N('C4'), a: 0.1, h: 0.1, d: 0.4, v: 0.1, lp: 1500 });
  sparkle(k, { at: 0.2, n: 3, span: 0.2, v: 0.04 });
});

def('energy', (k) => { // energia: zap mágico subindo
  k.tone({ w: 'sine', f: 520, f2: 1560, pt: 0.15, a: 0.005, d: 0.22, v: 0.2, vib: { r: 14, d: 0.5 } });
  k.tone({ w: 'square', f: 520, f2: 1560, pt: 0.15, a: 0.005, d: 0.12, v: 0.03, lp: 3000 });
  bell(k, N('E6'), { at: 0.1, ratio: 2, index: 2.5, d: 0.3, v: 0.08 });
  k.noise({ c: 'white', hp: 5000, a: 0.05, d: 0.15, v: 0.05 });
});

def('checkpoint', (k) => {
  thump(k, { f: 220, f2: 90, d: 0.1, v: 0.2, puff: 0.5 });
  ['G5', 'C6', 'E6', 'G6'].forEach((n, i) => {
    bell(k, N(n), { at: 0.04 + i * 0.09, ratio: 3.5, index: 1.8, d: 0.6, v: 0.09, rv: 0.3 });
    blip(k, N(n), { at: 0.04 + i * 0.09, f2: N(n), d: 0.3, v: 0.08, chip: 0 });
  });
  sparkle(k, { at: 0.35, n: 3, span: 0.25, v: 0.04 });
});

def('exit', (k) => { // saída da fase: redemoinho mágico
  ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'].forEach((n, i) => {
    k.tone({ w: 'triangle', f: N(n), a: 0.003, d: 0.2, v: 0.11, at: i * 0.04 });
    bell(k, N(n), { at: i * 0.04, ratio: 3, index: 1.2, d: 0.2, v: 0.04, body: 0 });
  });
  bell(k, N('C7'), { at: 0.42, ratio: 3.5, index: 2, d: 0.9, v: 0.1, rv: 0.4 });
  whoosh(k, { f1: 400, f2: 3500, a: 0.25, d: 0.4, v: 0.13 });
  for (const n of ['C4', 'G4']) k.tone({ w: 'sine', f: N(n), a: 0.1, h: 0.2, d: 0.5, v: 0.08 });
});

// =============================================================================
// OBJETOS / PUZZLES
// =============================================================================
def('spring', (k) => { // "boing" com mola vibrando
  k.tone({ w: 'triangle', f: 180, f2: 540, pt: 0.14, a: 0.003, d: 0.35, v: 0.28, vib: { r: 17, d: 2.2 } });
  k.tone({ w: 'sine', f: 110, f2: 280, pt: 0.1, a: 0.003, d: 0.18, v: 0.22 });
  k.tone({ w: 'fm', f: 1800, ratio: 1.41, index: 1, idec: 0.04, a: 0.001, d: 0.06, v: 0.05 });
});

def('secret', (k) => { // segredo: arpejo sonhador (Mi maior com 9ª)
  ['E5', 'G#5', 'B5', 'D#6', 'F#6', 'B6'].forEach((n, i) => {
    bell(k, N(n), { at: i * 0.075, ratio: 3.5, index: 1.8, d: 0.55, v: 0.08, rv: 0.35 });
    k.tone({ w: 'triangle', f: N(n), a: 0.004, d: 0.25, v: 0.1, at: i * 0.075 });
  });
  sparkle(k, { at: 0.4, n: 6, span: 0.5, v: 0.04, base: N('B6'), rv: 0.3 });
  k.tone({ w: 'sine', n: 2, spread: 8, f: N('E4'), a: 0.2, h: 0.3, d: 0.6, v: 0.08 });
});

def('secret_soft', (k) => {
  bell(k, N('E6'), { ratio: 3.5, index: 1.5, d: 0.45, v: 0.09, rv: 0.3 });
  bell(k, N('B6'), { at: 0.1, ratio: 3.5, index: 1.5, d: 0.5, v: 0.08, rv: 0.3 });
  sparkle(k, { at: 0.12, n: 3, span: 0.25, v: 0.035 });
});

def('chest_open', (k) => { // rangido da tampa + baque + revelação
  k.tone({ w: 'sawtooth', f: 105, fp: [[0.12, 140], [0.2, 125]], a: 0.03, h: 0.1, d: 0.08, v: 0.12, bp: 900, q: 5, vib: { r: 23, d: 1.2 } });
  thump(k, { at: 0.19, f: 220, f2: 80, d: 0.12, v: 0.32, puff: 0.6 });
  ['G5', 'C6', 'E6', 'G6', 'C7'].forEach((n, i) => {
    k.tone({ w: 'triangle', f: N(n), a: 0.003, d: 0.25, v: 0.1, at: 0.24 + i * 0.045 });
    bell(k, N(n), { at: 0.24 + i * 0.045, ratio: 3.5, index: 1.6, d: 0.35, v: 0.05, body: 0, rv: 0.25 });
  });
  sparkle(k, { at: 0.45, n: 5, span: 0.35, v: 0.04 });
});

def('gate_open', (k) => { // catraca + ribombo + baque final
  for (let i = 0; i < 8; i++) {
    const at = i * 0.065;
    click(k, { at, f: 1600 + (i % 2) * 300, q: 3, d: 0.02, v: 0.28 });
    k.tone({ w: 'square', f: 320, f2: 260, a: 0.001, d: 0.02, v: 0.04, lp: 1800, at });
  }
  k.noise({ c: 'brown', lp: 350, a: 0.06, h: 0.35, d: 0.25, v: 0.4 });
  k.tone({ w: 'sawtooth', f: 58, a: 0.05, h: 0.35, d: 0.2, v: 0.07, lp: 500, vib: { r: 9, d: 0.6 } });
  thump(k, { at: 0.6, f: 170, f2: 50, d: 0.25, v: 0.45, puff: 0.7 });
});

def('lever', (k) => {
  click(k, { f: 2600, q: 2, d: 0.015, v: 0.3 });
  k.tone({ w: 'sine', f: 280, f2: 110, pt: 0.04, a: 0.001, d: 0.1, v: 0.32, at: 0.04 });
  k.tone({ w: 'square', f: 190, f2: 170, a: 0.001, d: 0.04, v: 0.06, lp: 1500, at: 0.04 });
  k.tone({ w: 'fm', f: 1400, ratio: 1.41, index: 1, idec: 0.05, a: 0.001, d: 0.15, v: 0.05, at: 0.04 });
});

def('plate_down', (k) => {
  click(k, { f: 1800, q: 2, d: 0.012, v: 0.2 });
  k.tone({ w: 'sine', f: 230, f2: 85, pt: 0.05, a: 0.002, d: 0.12, v: 0.38 });
  k.noise({ c: 'pink', fl: { type: 'lowpass', f: 1500, f2: 400 }, a: 0.002, d: 0.06, v: 0.22 });
});

def('plate_up', (k) => {
  k.tone({ w: 'sine', f: 120, f2: 230, pt: 0.06, a: 0.003, d: 0.1, v: 0.3 });
  click(k, { at: 0.05, f: 2300, q: 2, d: 0.012, v: 0.22 });
});

def('break_block', (k) => { // bloco de pano estourando
  k.noise({ c: 'white', fl: { type: 'lowpass', f: 2800, f2: 400, t: 0.15 }, a: 0.001, d: 0.2, v: 0.38 });
  thump(k, { f: 190, f2: 50, pt: 0.08, d: 0.22, v: 0.45, puff: 0.5 });
  k.noise({ c: 'crackle', bp: 2200, q: 0.8, a: 0.01, h: 0.06, d: 0.2, v: 0.4, at: 0.02 });
  k.noise({ c: 'white', bp: 3000, q: 2, a: 0.005, d: 0.08, v: 0.15, tr: { r: 60, d: 0.8 } });
});

def('crumble', (k) => { // plataforma esfarelando
  k.noise({ c: 'crackle', lp: 2000, a: 0.03, h: 0.25, d: 0.2, v: 0.5 });
  k.noise({ c: 'brown', lp: 450, a: 0.05, h: 0.2, d: 0.2, v: 0.28 });
  k.tone({ w: 'triangle', f: 95, f2: 60, a: 0.05, d: 0.4, v: 0.1 });
});

// =============================================================================
// INIMIGOS
// =============================================================================
def('bind', (k) => { // laço de fio apertando
  whoosh(k, { f1: 800, f2: 3500, a: 0.02, d: 0.1, v: 0.2 });
  k.tone({ w: 'triangle', f: 300, f2: 1200, pt: 0.11, a: 0.003, d: 0.12, v: 0.13 });
  pluck(k, 330, { at: 0.1, d: 0.32, v: 0.16 });
  k.tone({ w: 'triangle', f: 330, a: 0.003, d: 0.3, v: 0.07, at: 0.1, vib: { r: 7, d: 0.2 } });
  k.tone({ w: 'sine', f: 1400, f2: 1900, a: 0.005, d: 0.06, v: 0.04, at: 0.1 });
});

def('armor_clink', (k) => { // metal (dedal/armadura) — inarmônico mas filtrado
  k.noise({ c: 'white', hp: 3000, a: 0.001, d: 0.012, v: 0.22 });
  k.tone({ w: 'fm', f: 1100, ratio: 1.414, index: 2.4, idec: 0.05, a: 0.001, d: 0.28, v: 0.13, lp: 6000 });
  k.tone({ w: 'fm', f: 1730, ratio: 1.414, index: 1.2, idec: 0.04, a: 0.001, d: 0.2, v: 0.06, lp: 6000 });
  k.tone({ w: 'triangle', f: 480, f2: 420, a: 0.001, d: 0.05, v: 0.1 });
});

def('unstitch_hit', (k) => { // pontos estourando um a um
  [880, 660, 495].forEach((f, i) => {
    const at = i * 0.04;
    pluck(k, f, { at, d: 0.07, v: 0.12 });
    k.noise({ c: 'white', hp: 3000, a: 0.0008, d: 0.008, v: 0.12, at });
  });
  sparkle(k, { at: 0.08, n: 3, span: 0.15, v: 0.04 });
});

def('enemy_die', (k) => { // "puf" de enchimento
  k.tone({ w: 'sine', f: 540, f2: 180, pt: 0.08, a: 0.002, d: 0.12, v: 0.32 });
  k.tone({ w: 'triangle', f: 540, f2: 220, pt: 0.06, a: 0.002, d: 0.07, v: 0.08 });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 1500, f2: 450, q: 0.8 }, a: 0.004, d: 0.26, v: 0.35 });
  sparkle(k, { at: 0.05, n: 3, span: 0.18, v: 0.045 });
});

// =============================================================================
// HABILIDADES
// =============================================================================
def('stitch_cast', (k) => { // Costura Dimensional: agulha mágica
  whoosh(k, { f1: 1000, f2: 5000, a: 0.02, d: 0.14, v: 0.2 });
  k.tone({ w: 'triangle', f: N('C5'), f2: N('C6'), pt: 0.2, a: 0.02, d: 0.3, v: 0.13, vib: { r: 10, d: 0.4 } });
  bell(k, N('E6'), { at: 0.05, ratio: 3.5, index: 2, d: 0.35, v: 0.07, rv: 0.25 });
  bell(k, N('G6'), { at: 0.1, ratio: 3.5, index: 2, d: 0.35, v: 0.06, rv: 0.25 });
  k.noise({ c: 'white', hp: 6000, a: 0.05, d: 0.3, v: 0.05, tr: { r: 20, d: 0.6 } });
});

def('stitch_connect', (k) => { // fio esticado ligando ilhós
  click(k, { f: 3000, q: 1.5, d: 0.01, v: 0.2 });
  pluck(k, 196, { d: 0.45, v: 0.2, bright: 2600 });
  k.tone({ w: 'triangle', f: 392, a: 0.003, d: 0.35, v: 0.09, vib: { r: 6, d: 0.15 } });
  bell(k, N('G6'), { ratio: 3, index: 1.8, d: 0.45, v: 0.09, rv: 0.25 });
  bell(k, N('D7'), { at: 0.05, ratio: 3, index: 1.5, d: 0.35, v: 0.05 });
});

def('thread_snap', (k) => { // fio arrebentando
  k.noise({ c: 'white', hp: 2500, a: 0.001, d: 0.025, v: 0.32 });
  k.tone({ w: 'triangle', f: 900, f2: 300, pt: 0.12, a: 0.001, d: 0.16, v: 0.15 });
  k.tone({ w: 'sawtooth', f: 450, f2: 150, pt: 0.12, a: 0.001, d: 0.15, v: 0.06, fl: { type: 'lowpass', f: 2200, f2: 400 } });
  whoosh(k, { f1: 3000, f2: 800, a: 0.005, d: 0.12, v: 0.12 });
});

def('unstitch_cast', (k) => { // Descosturar: rasgo (zíper) + arpejo descendo
  k.noise({ c: 'white', fl: { type: 'bandpass', f: 2600, f2: 1200, q: 1.5 }, a: 0.005, h: 0.08, d: 0.12, v: 0.3, tr: { r: 55, d: 0.9 } });
  ['G6', 'E6', 'C6', 'A5', 'G5'].forEach((n, i) => {
    k.tone({ w: 'triangle', f: N(n), a: 0.003, d: 0.18, v: 0.09, at: 0.03 + i * 0.04 });
    bell(k, N(n), { at: 0.03 + i * 0.04, ratio: 3.5, index: 1.5, d: 0.25, v: 0.04, body: 0, rv: 0.2 });
  });
  whoosh(k, { f1: 3500, f2: 600, a: 0.02, d: 0.3, v: 0.12 });
  k.tone({ w: 'sine', f: 240, f2: 110, a: 0.005, d: 0.25, v: 0.18 });
});

def('rewind_cast', (k) => { // Remendo Temporal: "prato ao contrário" + tiques acelerando + ping
  k.noise({ c: 'white', fl: { type: 'bandpass', f: 1500, f2: 5000, q: 0.8 }, env: [[0.33, 1], [0.36, 0]], v: 0.22 });
  k.tone({ w: 'triangle', f: 800, fp: [[0.15, 300], [0.34, 1200]], env: [[0.05, 0.6], [0.3, 1], [0.36, 0]], v: 0.14, vib: { r: 18, d: 0.6 } });
  [0, 0.1, 0.18, 0.24, 0.28, 0.31].forEach((at) => tick(k, { at, f: 2600, v: 0.08 }));
  bell(k, N('A6'), { at: 0.36, ratio: 3.5, index: 2, d: 0.5, v: 0.12, rv: 0.3 });
  k.tone({ w: 'sine', f: N('A4'), a: 0.003, d: 0.4, v: 0.12, at: 0.36 });
});

def('rewind_loop', (k) => { // ~0,5 s, para repetir enquanto o tempo volta
  const env = [[0.06, 1], [0.44, 1], [0.5, 0]];
  k.tone({ w: 'triangle', f: 620, fp: [[0.25, 460], [0.5, 620]], env, v: 0.1, vib: { r: 12, d: 0.9 } });
  k.tone({ w: 'sine', f: 310, fp: [[0.25, 230], [0.5, 310]], env, v: 0.08 });
  k.noise({ c: 'pink', bp: 1300, q: 2, env: [[0.1, 1], [0.4, 1], [0.5, 0]], v: 0.12, tr: { r: 8, d: 0.6 } });
  [0, 0.125, 0.25, 0.375].forEach((at) => tick(k, { at, f: 2200, v: 0.07 }));
});

def('decoy_cast', (k) => { // Retalho Fantasma: coro fantasmagórico
  thump(k, { f: 200, f2: 90, d: 0.15, v: 0.25, puff: 0.6 });
  k.tone({ w: 'sine', n: 3, spread: 25, f: N('C5'), f2: N('G5'), pt: 0.3, a: 0.06, h: 0.05, d: 0.4, v: 0.13, vib: { r: 5, d: 0.3 }, rv: 0.35 });
  k.noise({ c: 'pink', bp: 2000, q: 0.7, a: 0.08, d: 0.3, v: 0.12 });
  sparkle(k, { at: 0.1, n: 4, span: 0.3, v: 0.04, rv: 0.3 });
});

def('decoy_swap', (k) => { // troca de lugar: zip-zap + pop
  k.tone({ w: 'triangle', f: 400, f2: 1600, pt: 0.07, a: 0.003, d: 0.08, v: 0.15 });
  k.tone({ w: 'triangle', f: 1600, f2: 400, pt: 0.07, a: 0.003, d: 0.09, v: 0.15, at: 0.07 });
  whoosh(k, { f1: 1200, f2: 3500, a: 0.02, d: 0.13, v: 0.12 });
  k.tone({ w: 'sine', f: 520, f2: 200, pt: 0.06, a: 0.002, d: 0.08, v: 0.24, at: 0.14 });
  k.noise({ c: 'white', bp: 2500, q: 1.5, a: 0.001, d: 0.03, v: 0.14, at: 0.14 });
});

def('unravel_start', (k) => { // Forma Desfiada: subida de energia + explosão de brilho
  k.tone({ w: 'sawtooth', n: 3, spread: 18, f: 110, f2: 440, pt: 0.7, a: 0.05, h: 0.5, d: 0.35, v: 0.13, fl: { type: 'lowpass', f: 300, f2: 4000, t: 0.7, q: 4 } });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 400, f2: 5000, t: 0.7, q: 1.2 }, env: [[0.65, 1], [0.72, 0.2], [0.9, 0]], v: 0.18 });
  thump(k, { at: 0.7, f: 170, f2: 45, pt: 0.12, d: 0.4, v: 0.45, puff: 0.6 });
  for (const n of ['C6', 'E6', 'G6', 'C7']) bell(k, N(n), { at: 0.7, ratio: 3.5, index: 2, d: 0.8, v: 0.05, rv: 0.3 });
  k.noise({ c: 'white', hp: 4000, a: 0.005, d: 0.4, v: 0.08, at: 0.7 });
  sparkle(k, { at: 0.72, n: 6, span: 0.5, v: 0.04 });
});

def('unravel_end', (k) => { // fim da forma: desinfla suave
  k.tone({ w: 'sawtooth', n: 2, spread: 10, f: 440, f2: 110, pt: 0.5, a: 0.01, h: 0.1, d: 0.45, v: 0.1, fl: { type: 'lowpass', f: 3000, f2: 300, t: 0.5, q: 2 } });
  whoosh(k, { f1: 3000, f2: 400, a: 0.02, d: 0.4, v: 0.12 });
  ['E6', 'C6', 'G5'].forEach((n, i) => bell(k, N(n), { at: i * 0.08, ratio: 3.5, index: 1.5, d: 0.3, v: 0.05 }));
  thump(k, { at: 0.45, f: 160, f2: 70, d: 0.16, v: 0.22, puff: 0.7 });
});

def('unravel_blast', (k) => { // ataque especial devastador
  k.tone({ w: 'sine', f: 150, f2: 35, pt: 0.3, a: 0.002, d: 0.6, v: 0.5 });
  k.tone({ w: 'triangle', f: 300, f2: 60, pt: 0.2, a: 0.002, d: 0.25, v: 0.15 });
  k.noise({ c: 'white', fl: { type: 'lowpass', f: 6000, f2: 300, t: 0.5 }, a: 0.002, d: 0.5, v: 0.3 });
  for (const n of ['C5', 'G5', 'C6']) k.tone({ w: 'fm', f: N(n), ratio: 2, index: 3, idec: 0.3, a: 0.003, d: 0.7, v: 0.06, rv: 0.3 });
  sparkle(k, { at: 0.08, n: 7, span: 0.55, v: 0.045, oct: 2, base: N('C6') });
});

def('ability_get', (k) => { // nova habilidade desbloqueada
  thump(k, { f: 180, f2: 60, d: 0.3, v: 0.3, puff: 0.5 });
  ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => {
    k.tone({ w: 'triangle', f: N(n), a: 0.003, d: 0.3, v: 0.12, at: i * 0.07 });
    bell(k, N(n), { at: i * 0.07, ratio: 3.5, index: 1.8, d: 0.4, v: 0.05, body: 0 });
  });
  for (const n of ['C5', 'E5', 'G5', 'C6']) {
    k.tone({ w: 'triangle', n: 2, spread: 8, f: N(n), a: 0.05, h: 0.4, d: 0.8, v: 0.07, at: 0.45, vib: { r: 5, d: 0.1, delay: 0.3 }, rv: 0.3 });
  }
  k.noise({ c: 'white', hp: 6000, a: 0.3, h: 0.4, d: 0.6, v: 0.04, tr: { r: 12, d: 0.7 }, at: 0.3 });
  sparkle(k, { at: 0.45, n: 8, span: 1.0, v: 0.04, rv: 0.3 });
});

// =============================================================================
// CHEFES / MUNDO / AMBIENTE
// =============================================================================
def('boss_roar', (k) => { // rugido: serra grave com vibrato forte + formante de ruído
  k.tone({ w: 'sawtooth', n: 3, spread: 30, f: 95, fp: [[0.25, 125], [1.1, 70]], a: 0.08, h: 0.5, d: 0.5, v: 0.2, fl: { type: 'lowpass', f: 1100, f2: 500, t: 1.0, q: 3 }, vib: { r: 28, d: 1.5 } });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 800, f2: 400, t: 1.0, q: 3 }, a: 0.08, h: 0.5, d: 0.5, v: 0.35, tr: { r: 30, d: 0.6 } });
  k.tone({ w: 'sine', f: 60, f2: 40, a: 0.1, h: 0.5, d: 0.5, v: 0.28 });
});

def('boss_hit', (k) => { // golpe no chefe: mais peso + anel metálico
  k.tone({ w: 'sine', f: 200, f2: 45, pt: 0.1, a: 0.001, d: 0.3, v: 0.5 });
  k.tone({ w: 'triangle', f: 200, f2: 60, pt: 0.08, a: 0.001, d: 0.12, v: 0.15, lp: 1500 });
  k.noise({ c: 'pink', fl: { type: 'lowpass', f: 4000, f2: 500, t: 0.12 }, a: 0.001, d: 0.18, v: 0.42 });
  k.tone({ w: 'fm', f: 620, ratio: 1.41, index: 2, idec: 0.1, a: 0.001, d: 0.35, v: 0.08 });
  k.tone({ w: 'square', f: 800, f2: 200, pt: 0.04, a: 0.001, d: 0.04, v: 0.1, lp: 3000 });
});

def('explosion', (k) => {
  k.tone({ w: 'sine', f: 120, f2: 30, pt: 0.45, a: 0.002, d: 0.9, v: 0.5 });
  k.tone({ w: 'triangle', f: 240, f2: 60, pt: 0.2, a: 0.002, d: 0.25, v: 0.15 });
  k.noise({ c: 'brown', fl: { type: 'lowpass', f: 1500, f2: 150, t: 0.8 }, a: 0.003, d: 1.0, v: 0.55 });
  k.noise({ c: 'white', fl: { type: 'lowpass', f: 5000, f2: 800, t: 0.15 }, a: 0.001, d: 0.2, v: 0.32 });
  k.noise({ c: 'crackle', lp: 2500, a: 0.05, h: 0.2, d: 0.5, v: 0.22 });
});

def('portal', (k) => { // redemoinho mágico
  k.tone({ w: 'fm', f: 330, fp: [[0.45, 660], [0.95, 440]], ratio: 2.01, index: 1.5, index2: 0.6, idec: 0.9, a: 0.25, h: 0.25, d: 0.45, v: 0.12, vib: { r: 6, d: 0.5 }, rv: 0.35 });
  k.tone({ w: 'sine', n: 3, spread: 20, f: 880, a: 0.3, h: 0.2, d: 0.45, v: 0.06, vib: { r: 4, d: 0.3 }, rv: 0.3 });
  k.noise({ c: 'white', hp: 5000, a: 0.3, h: 0.2, d: 0.4, v: 0.05, tr: { r: 9, d: 0.8 } });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 400, f2: 2500, t: 0.5, q: 1.2 }, a: 0.3, d: 0.5, v: 0.12 });
});

def('bubble', (k) => bubbleTone(k, { f: 460, up: 2.8, v: 0.28 }));

def('current', (k) => { // correnteza
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 500, f2: 1300, t: 0.8, q: 1.2 }, a: 0.25, h: 0.2, d: 0.4, v: 0.3, tr: { r: 3.5, d: 0.5 } });
  k.noise({ c: 'brown', lp: 350, a: 0.2, h: 0.3, d: 0.4, v: 0.22 });
  for (let i = 0; i < 3; i++) bubbleTone(k, { at: rnd(0.1, 0.6), f: rnd(500, 900), v: 0.05, pan: rnd(-0.5, 0.5) });
});

def('clock_tick', (k) => tick(k, { f: 2400, v: 0.2 }));

def('clock_chime', (k) => { // badalada dupla de relógio
  const strike = (f, at, v) => {
    k.tone({ w: 'fm', f, ratio: 3.5, index: 2.6, idec: 0.5, a: 0.002, d: 1.4, v, at, rv: 0.35 });
    k.tone({ w: 'sine', f, a: 0.002, d: 1.4, v: v * 0.8, at });
    k.tone({ w: 'sine', f: f * 2.76, a: 0.001, d: 0.5, v: v * 0.25, at });
    k.tone({ w: 'sine', f: f * 0.5, a: 0.01, d: 1.1, v: v * 0.4, at });
  };
  strike(N('E5'), 0, 0.14);
  strike(N('C5'), 0.45, 0.12);
});

def('shadow_whisper', (k) => { // sussurro: formantes de ruído se movendo + drone dissonante
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 900, pts: [[0.4, 1600], [1.2, 700]], q: 6 }, a: 0.3, h: 0.3, d: 0.6, v: 0.4, tr: { r: 6, d: 0.7 }, rv: 0.4 });
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 2300, pts: [[0.6, 1500], [1.2, 2600]], q: 6 }, a: 0.35, h: 0.25, d: 0.6, v: 0.3, tr: { r: 4.3, d: 0.7 } });
  k.noise({ c: 'white', hp: 3500, a: 0.2, d: 0.6, v: 0.05, tr: { r: 3, d: 0.6 } });
  k.tone({ w: 'sine', f: 110, a: 0.3, h: 0.3, d: 0.6, v: 0.07, vib: { r: 3, d: 0.4 } });
  k.tone({ w: 'sine', f: 116.5, a: 0.3, h: 0.3, d: 0.6, v: 0.06 });
});

def('heartbeat', (k) => { // tum-tum
  k.tone({ w: 'sine', f: 80, f2: 45, pt: 0.08, a: 0.004, d: 0.16, v: 0.5 });
  k.tone({ w: 'triangle', f: 160, f2: 90, pt: 0.06, a: 0.004, d: 0.08, v: 0.1, lp: 600 });
  k.noise({ c: 'brown', lp: 250, a: 0.004, d: 0.1, v: 0.25 });
  k.tone({ w: 'sine', f: 70, f2: 40, pt: 0.08, a: 0.004, d: 0.14, v: 0.38, at: 0.22 });
  k.tone({ w: 'triangle', f: 140, f2: 80, pt: 0.06, a: 0.004, d: 0.07, v: 0.08, lp: 600, at: 0.22 });
});

def('thunder', (k) => {
  k.noise({ c: 'white', fl: { type: 'lowpass', f: 7000, f2: 1000, t: 0.1 }, a: 0.001, d: 0.15, v: 0.3 });
  k.noise({ c: 'crackle', lp: 4000, a: 0.002, h: 0.1, d: 0.3, v: 0.32 });
  k.noise({ c: 'brown', fl: { type: 'lowpass', f: 600, f2: 120, t: 1.5 }, a: 0.08, h: 0.2, d: 1.5, v: 0.6, tr: { r: 5, d: 0.5 } });
  k.tone({ w: 'sine', f: 52, f2: 35, a: 0.1, h: 0.2, d: 1.4, v: 0.2 });
});

def('glass_crack', (k) => {
  k.noise({ c: 'white', hp: 2500, a: 0.001, d: 0.03, v: 0.32 });
  k.noise({ c: 'crackle', hp: 2000, a: 0.005, d: 0.2, v: 0.25 });
  for (let i = 0; i < 5; i++) {
    k.tone({ w: 'fm', f: rnd(2500, 4500), ratio: rnd(1.41, 2.4), index: 1.5, idec: 0.05, a: 0.001, d: 0.15, v: 0.05, at: rnd(0, 0.25), pan: rnd(-0.5, 0.5) });
  }
});

// =============================================================================
// EXTRAS
// =============================================================================
def('star_rating', (k) => { // estrelas da tela de resultado (chamador pode subir o pitch por estrela)
  thump(k, { f: 300, f2: 140, d: 0.09, v: 0.22, puff: 0.4 });
  bell(k, N('G6'), { ratio: 3, index: 2, d: 0.5, v: 0.12, rv: 0.3 });
  k.tone({ w: 'triangle', f: N('G6'), a: 0.002, d: 0.2, v: 0.12 });
  k.tone({ w: 'triangle', f: N('D7'), a: 0.002, d: 0.12, v: 0.05, at: 0.03 });
  sparkle(k, { at: 0.04, n: 3, span: 0.2, v: 0.04 });
});

def('whoosh', (k) => {
  k.noise({ c: 'pink', fl: { type: 'bandpass', f: 350, pts: [[0.16, 2200], [0.35, 700]], q: 1.4 }, a: 0.12, d: 0.23, v: 0.4 });
});

def('rumble', (k) => {
  k.noise({ c: 'brown', lp: 200, a: 0.2, h: 0.6, d: 0.5, v: 0.6, tr: { r: 7, d: 0.4 } });
  k.noise({ c: 'brown', lp: 600, a: 0.2, h: 0.6, d: 0.5, v: 0.12 });
  k.tone({ w: 'sine', f: 42, a: 0.2, h: 0.6, d: 0.5, v: 0.25, vib: { r: 3, d: 1 } });
  k.tone({ w: 'triangle', f: 84, a: 0.2, h: 0.6, d: 0.5, v: 0.05, vib: { r: 3, d: 1 } });
});

def('door_creak', (k) => {
  const fp = [[0.25, 125], [0.5, 95], [0.8, 140]];
  k.tone({ w: 'sawtooth', f: 85, fp, pc: 'lin', a: 0.05, h: 0.5, d: 0.3, v: 0.16, bp: 1100, q: 6, tr: { r: 22, d: 0.6 } });
  k.tone({ w: 'sawtooth', f: 85, fp, pc: 'lin', a: 0.05, h: 0.5, d: 0.3, v: 0.1, bp: 2300, q: 8, tr: { r: 22, d: 0.6 } });
});

def('footstep_wood', (k) => {
  const r = rnd(0.9, 1.1);
  k.tone({ w: 'triangle', f: 330 * r, f2: 240 * r, pt: 0.03, a: 0.001, d: 0.07, v: 0.24 });
  k.tone({ w: 'sine', f: 170 * r, f2: 120 * r, a: 0.001, d: 0.06, v: 0.2 });
  k.noise({ c: 'white', bp: 1400 * r, q: 1.5, a: 0.001, d: 0.03, v: 0.15 });
});

def('footstep_metal', (k) => {
  const r = rnd(0.92, 1.08);
  k.tone({ w: 'fm', f: 520 * r, ratio: 1.41, index: 1.8, idec: 0.05, a: 0.001, d: 0.14, v: 0.1, lp: 5000 });
  k.noise({ c: 'white', hp: 2500, a: 0.001, d: 0.012, v: 0.16 });
  k.tone({ w: 'sine', f: 160 * r, f2: 100 * r, a: 0.001, d: 0.05, v: 0.2 });
});

def('water_drip', (k) => {
  k.tone({ w: 'sine', f: 800, f2: 2300, pt: 0.035, a: 0.001, d: 0.05, v: 0.26, rv: 0.4 });
  k.tone({ w: 'sine', f: 1000, f2: 2500, pt: 0.03, a: 0.001, d: 0.04, v: 0.06, at: 0.09 });
});

def('magic_hum', (k) => {
  const sw = { a: 0.4, h: 0.6, d: 0.5, tr: { r: 2.5, d: 0.3 } };
  k.tone({ ...sw, w: 'sine', f: 220, v: 0.12, vib: { r: 4, d: 0.15 } });
  k.tone({ ...sw, w: 'sine', f: 330, v: 0.08, vib: { r: 4.5, d: 0.15 } });
  k.tone({ ...sw, w: 'triangle', n: 2, spread: 8, f: 440, v: 0.05, lp: 2000 });
  k.noise({ ...sw, c: 'white', hp: 6000, v: 0.025 });
});
