// =============================================================================
// audio.js — Motor de áudio 100% procedural (WebAudio). Sem arquivos externos.
//
// EFEITOS SONOROS
//   registerSfx('jump', { wave:'square', freq:300, freqEnd:600, dur:0.12, vol:0.3 })
//   registerSfx('boom', [ layer1, layer2 ])        // várias camadas
//   audio.sfx('jump', { vol:1, pitch:1, pan:0 })
//
//   Camada (layer): {
//     wave: 'square'|'triangle'|'sawtooth'|'sine'|'noise'|'pulse'|'fm',
//     freq, freqEnd, curve:'exp'|'linear', dur, attack, vol, delay,
//     duty (pulse), ratio/index (fm), vibrato:{rate,depth(semitons)},
//     filter:{type,freq,freqEnd,q}, arp:[semitons...], arpSpeed (s)
//   }
//
// MÚSICA (sequenciador estilo tracker) — veja docs/ARCHITECTURE.md §Áudio
//   registerSong('w1_level', { bpm, instruments, patterns, order, loopFrom })
//   audio.playMusic('w1_level', { fade: 1 })
//   audio.stopMusic(1)
//
// VOLUME: audio.setVolume('music'|'sfx'|'master', 0..1)
// =============================================================================

const sfxDefs = new Map();
const songs = new Map();

export function registerSfx(name, def) { sfxDefs.set(name, def); }
export function registerSong(name, song) { songs.set(name, song); }
export function hasSong(name) { return songs.has(name); }
export function hasSfx(name) { return sfxDefs.has(name); }
export function songNames() { return [...songs.keys()]; }
export function sfxNames() { return [...sfxDefs.keys()]; }

const NOTE_BASE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
/** 'C#4' -> frequency (A4 = 440). Returns null for invalid. */
export function noteFreq(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  let n = NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) - 4) * 12;
  return 440 * Math.pow(2, n / 12);
}

// ----------------------------------------------------------------- Synth core
/** Builds voices on any (Offline)AudioContext. */
class Synth {
  constructor(ac) {
    this.ac = ac;
    this.waves = new Map();
    this.noiseBuf = null;
  }
  noise() {
    if (this.noiseBuf) return this.noiseBuf;
    const len = this.ac.sampleRate * 2;
    const b = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    return b;
  }
  pulseWave(duty = 0.5) {
    const key = 'p' + duty.toFixed(3);
    if (this.waves.has(key)) return this.waves.get(key);
    const n = 64;
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * 1;
    const w = this.ac.createPeriodicWave(re, im);
    this.waves.set(key, w);
    return w;
  }
  /** Create an oscillator-ish source for a given wave. Returns {node, freqParams:[AudioParam], stop(t)} */
  source(wave, freq, t, opts = {}) {
    const ac = this.ac;
    if (wave === 'noise') {
      const s = ac.createBufferSource();
      s.buffer = this.noise();
      s.loop = true;
      s.playbackRate.value = opts.noiseRate || 1;
      s.start(t, Math.random() * 1.5);
      return { node: s, freqParams: [], stop: (tt) => s.stop(tt) };
    }
    if (wave === 'fm') {
      const car = ac.createOscillator();
      const mod = ac.createOscillator();
      const mg = ac.createGain();
      car.type = opts.carrier || 'sine';
      mod.type = 'sine';
      car.frequency.setValueAtTime(freq, t);
      mod.frequency.setValueAtTime(freq * (opts.ratio || 2), t);
      mg.gain.setValueAtTime(freq * (opts.index || 2), t);
      if (opts.indexDecay) mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.05), t + opts.indexDecay);
      mod.connect(mg).connect(car.frequency);
      car.start(t); mod.start(t);
      return { node: car, freqParams: [car.frequency], modParams: [mod.frequency], stop: (tt) => { car.stop(tt); mod.stop(tt); } };
    }
    const o = ac.createOscillator();
    if (wave === 'pulse') o.setPeriodicWave(this.pulseWave(opts.duty ?? 0.25));
    else o.type = wave === 'saw' ? 'sawtooth' : wave || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.setValueAtTime(opts.detune, t);
    o.start(t);
    return { node: o, freqParams: [o.frequency], stop: (tt) => o.stop(tt) };
  }

  /** Play one SFX layer into dest at time t. */
  layer(L, dest, t, { pitch = 1, vol = 1 } = {}) {
    const ac = this.ac;
    t += L.delay || 0;
    const dur = L.dur ?? 0.15;
    const f0 = (L.freq ?? 440) * pitch;
    const src = this.source(L.wave || 'square', f0, t, L);
    const g = ac.createGain();
    const peak = (L.vol ?? 0.3) * vol;
    const atk = L.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    if (L.sustain) {
      g.gain.setValueAtTime(peak, t + atk + L.sustain);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src.node;
    if (L.freqEnd) {
      for (const p of src.freqParams) {
        if (L.curve === 'linear') p.linearRampToValueAtTime(L.freqEnd * pitch, t + dur);
        else p.exponentialRampToValueAtTime(Math.max(1, L.freqEnd * pitch), t + dur);
      }
      if (src.modParams) for (const p of src.modParams) p.exponentialRampToValueAtTime(Math.max(1, L.freqEnd * pitch * (L.ratio || 2)), t + dur);
    }
    if (L.arp && src.freqParams.length) {
      const sp = L.arpSpeed || 0.05;
      let k = 0;
      for (let tt = t; tt < t + dur; tt += sp, k++) {
        const semi = L.arp[k % L.arp.length];
        for (const p of src.freqParams) p.setValueAtTime(f0 * Math.pow(2, semi / 12), tt);
      }
    }
    if (L.vibrato && src.freqParams.length) {
      const lfo = ac.createOscillator();
      const lg = ac.createGain();
      lfo.frequency.value = L.vibrato.rate || 6;
      lg.gain.value = f0 * (Math.pow(2, (L.vibrato.depth || 0.3) / 12) - 1);
      lfo.connect(lg);
      for (const p of src.freqParams) lg.connect(p);
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    if (L.filter) {
      const f = ac.createBiquadFilter();
      f.type = L.filter.type || 'lowpass';
      f.frequency.setValueAtTime(L.filter.freq || 2000, t);
      if (L.filter.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, L.filter.freqEnd), t + dur);
      f.Q.value = L.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    if (L.pan) {
      const p = ac.createStereoPanner();
      p.pan.value = L.pan;
      g.connect(p).connect(dest);
    } else g.connect(dest);
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------- Instruments
  /** Play a melodic note. inst: instrument def. Returns nothing. */
  note(inst, freq, t, len, vel, dest, sends) {
    const ac = this.ac;
    const voices = inst.voices || 1;
    const spread = inst.spread || 0;
    const a = inst.attack ?? 0.01, d = inst.decay ?? 0.1, s = inst.sustain ?? 0.7, r = inst.release ?? 0.08;
    const peak = (inst.vol ?? 0.25) * vel / Math.sqrt(voices);
    const g = ac.createGain();
    const end = t + Math.max(len, a + 0.01);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, Math.max(0.005, d / 3));
    g.gain.setTargetAtTime(0.0001, end, Math.max(0.005, r / 4));
    const stopAt = end + r + 0.1;
    let out = g;
    if (inst.filter) {
      const f = ac.createBiquadFilter();
      f.type = inst.filter.type || 'lowpass';
      f.frequency.setValueAtTime(inst.filter.freq || 2500, t);
      if (inst.filter.env) {
        f.frequency.setValueAtTime((inst.filter.freq || 800) + inst.filter.env, t);
        f.frequency.setTargetAtTime(inst.filter.freq || 800, t, inst.filter.envDecay || 0.1);
      }
      f.Q.value = inst.filter.q ?? 0.8;
      g.connect(f);
      out = f;
    }
    let panNode = out;
    if (inst.pan) {
      const p = ac.createStereoPanner();
      p.pan.value = inst.pan;
      out.connect(p);
      panNode = p;
    }
    panNode.connect(dest);
    if (sends) {
      if (inst.reverb !== 0 && sends.reverb) {
        const sg = ac.createGain(); sg.gain.value = inst.reverb ?? 0.25; panNode.connect(sg).connect(sends.reverb);
      }
      if (inst.echo && sends.delay) {
        const sg = ac.createGain(); sg.gain.value = inst.echo; panNode.connect(sg).connect(sends.delay);
      }
    }
    for (let v = 0; v < voices; v++) {
      const det = voices > 1 ? (v / (voices - 1) - 0.5) * 2 * spread : 0;
      const src = this.source(inst.wave || 'square', freq, t, { ...inst, detune: (inst.detune || 0) + det });
      if (inst.glide && inst._lastFreq) {
        for (const p of src.freqParams) { p.setValueAtTime(inst._lastFreq, t); p.exponentialRampToValueAtTime(freq, t + inst.glide); }
      }
      if (inst.vibrato) {
        const lfo = ac.createOscillator();
        const lg = ac.createGain();
        lfo.frequency.value = inst.vibrato.rate || 5;
        const depth = freq * (Math.pow(2, (inst.vibrato.depth || 0.15) / 12) - 1);
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(depth, t + (inst.vibrato.delay || 0.15) + 0.05);
        lfo.connect(lg);
        for (const p of src.freqParams) lg.connect(p);
        lfo.start(t); lfo.stop(stopAt);
      }
      src.node.connect(g);
      src.stop(stopAt);
    }
    inst._lastFreq = freq;
  }

  drum(kind, t, vel, dest, sends, kit = {}) {
    const ac = this.ac;
    const v = vel * (kit.vol ?? 0.5);
    const env = (node, peak, dur, startT = t) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(peak, startT);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
      node.connect(g);
      g.connect(dest);
      if (sends?.reverb && kit.reverb) { const s = ac.createGain(); s.gain.value = kit.reverb; g.connect(s).connect(sends.reverb); }
      return g;
    };
    const noiseSrc = (type, freq, q = 1) => {
      const s = ac.createBufferSource(); s.buffer = this.noise(); s.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      s.connect(f); s.start(t, Math.random()); return { s, f };
    };
    switch (kind) {
      case 'k': { // kick
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(kit.kickHi || 150, t);
        o.frequency.exponentialRampToValueAtTime(kit.kickLo || 42, t + 0.12);
        env(o, v * 1.4, 0.32); o.start(t); o.stop(t + 0.35);
        const c = ac.createOscillator(); c.type = 'square'; c.frequency.value = 900;
        env(c, v * 0.08, 0.015); c.start(t); c.stop(t + 0.03);
        break;
      }
      case 's': { // snare
        const n = noiseSrc('bandpass', kit.snareTone || 1800, 0.7); env(n.f, v * 0.9, 0.18); n.s.stop(t + 0.2);
        const o = ac.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        env(o, v * 0.6, 0.1); o.start(t); o.stop(t + 0.12);
        break;
      }
      case 'x': { // clap
        for (let i = 0; i < 3; i++) {
          const n = noiseSrc('bandpass', 1200, 1.2); env(n.f, v * 0.7, 0.05 + (i === 2 ? 0.12 : 0), t + i * 0.012); n.s.stop(t + 0.25);
        }
        break;
      }
      case 'h': { const n = noiseSrc('highpass', 7000, 0.5); env(n.f, v * 0.35, 0.04); n.s.stop(t + 0.06); break; }
      case 'o': { const n = noiseSrc('highpass', 6500, 0.5); env(n.f, v * 0.3, 0.25); n.s.stop(t + 0.3); break; }
      case 'c': { const n = noiseSrc('highpass', 4000, 0.3); env(n.f, v * 0.45, 1.2); n.s.stop(t + 1.3); break; }
      case 'r': { // rim / wood
        const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 1700;
        env(o, v * 0.2, 0.025); o.start(t); o.stop(t + 0.04); break;
      }
      case 'p': { // tick / clock perc
        const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2600, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.03);
        env(o, v * 0.3, 0.04); o.start(t); o.stop(t + 0.05); break;
      }
      case 't': case 'T': { // toms
        const o = ac.createOscillator(); o.type = 'sine';
        const f = kind === 't' ? 110 : 190;
        o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
        env(o, v * 0.9, 0.3); o.start(t); o.stop(t + 0.32); break;
      }
      case 'b': { // deep boom (cinematic)
        const o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
        env(o, v * 1.5, 1.2); o.start(t); o.stop(t + 1.3);
        const n = noiseSrc('lowpass', 300, 0.5); env(n.f, v * 0.5, 0.9); n.s.stop(t + 1);
        break;
      }
      default: break;
    }
  }
}

// ----------------------------------------------------------------- Parsing
/** Parse a track string into events [{step, freqs, len, vel}] or drum events. */
function parseTrack(str, isDrum) {
  const toks = str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  const events = [];
  let cur = null;
  toks.forEach((tok, i) => {
    if (tok === '-') { if (cur) cur.len++; return; }
    if (cur) { events.push(cur); cur = null; }
    if (tok === '.') return;
    let vel = 1;
    if (tok.endsWith('!')) { vel = 1.35; tok = tok.slice(0, -1); }
    else if (tok.endsWith('?')) { vel = 0.55; tok = tok.slice(0, -1); }
    const parts = tok.split('+');
    if (isDrum) { events.push({ step: i, drums: parts, vel }); return; }
    const freqs = parts.map(noteFreq).filter((f) => f);
    if (freqs.length) cur = { step: i, freqs, len: 1, vel };
  });
  if (cur) events.push(cur);
  return { events, length: toks.length };
}

function compileSong(song) {
  if (song._compiled) return song._compiled;
  const pats = {};
  for (const [pname, pat] of Object.entries(song.patterns)) {
    let length = 0;
    const tracks = {};
    for (const [tname, str] of Object.entries(pat)) {
      if (typeof str !== 'string') continue;
      const inst = song.instruments[tname] || song.instruments[tname.replace(/\d+$/, '')];
      const isDrum = inst?.kit !== undefined || tname.startsWith('drum');
      const parsed = parseTrack(str, isDrum);
      tracks[tname] = { ...parsed, isDrum, inst };
      length = Math.max(length, parsed.length);
    }
    pats[pname] = { tracks, length: pat.length || length };
  }
  song._compiled = pats;
  return pats;
}

function makeImpulse(ac, seconds = 2.2, decay = 2.5) {
  const len = Math.floor(ac.sampleRate * seconds);
  const b = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

// ----------------------------------------------------------------- Player
class SongPlayer {
  constructor(engine, song, out) {
    this.engine = engine;
    this.ac = engine.ac;
    this.song = song;
    this.pats = compileSong(song);
    this.out = out; // gain node for this song (fade control)
    this.orderIdx = 0;
    this.step = 0;
    this.stepDur = 60 / (song.bpm || 120) / (song.stepsPerBeat || 4);
    this.nextTime = this.ac.currentTime + 0.08;
    this.stopped = false;
    // per-song FX
    this.delay = this.ac.createDelay(2);
    this.delay.delayTime.value = this.stepDur * (song.echoSteps || 3);
    const fb = this.ac.createGain(); fb.gain.value = song.echoFeedback ?? 0.35;
    const dg = this.ac.createGain(); dg.gain.value = 0.6;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(dg).connect(out);
    this.sends = { reverb: engine.reverbIn, delay: this.delay };
    // clone instruments so glide state isn't shared between players
    this.instruments = {};
    for (const [k, v] of Object.entries(song.instruments)) this.instruments[k] = { ...v };
  }
  get pattern() {
    const order = this.song.order;
    return this.pats[order[this.orderIdx % order.length]];
  }
  schedule(until) {
    while (!this.stopped && this.nextTime < until) {
      const pat = this.pattern;
      if (!pat) { this.stopped = true; return; }
      const swing = this.song.swing || 0;
      const t = this.nextTime + (this.step % 2 === 1 ? swing * this.stepDur : 0);
      for (const [tname, tr] of Object.entries(pat.tracks)) {
        const inst = this.instruments[tname] || this.instruments[tname.replace(/\d+$/, '')] || tr.inst;
        if (!inst) continue;
        for (const ev of tr.events) {
          if (ev.step !== this.step) continue;
          if (tr.isDrum) for (const d of ev.drums) this.engine.synth.drum(d, t, ev.vel, this.out, this.sends, inst);
          else for (const f of ev.freqs) {
            const fr = f * Math.pow(2, inst.octave || 0);
            this.engine.synth.note(inst, fr, t, ev.len * this.stepDur * (inst.gate ?? 0.92), ev.vel, this.out, this.sends);
          }
        }
      }
      this.nextTime += this.stepDur;
      this.step++;
      if (this.step >= pat.length) {
        this.step = 0;
        this.orderIdx++;
        if (this.orderIdx >= this.song.order.length) {
          if (this.song.loop === false) { this.stopped = true; return; }
          this.orderIdx = this.song.loopFrom || 0;
        }
      }
    }
  }
  stop(fade = 0.5) {
    const now = this.ac.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.02, fade));
    setTimeout(() => { this.stopped = true; try { this.out.disconnect(); } catch (e) { /* ignore */ } }, (fade + 0.2) * 1000);
    this.stopped = true;
  }
}

// ----------------------------------------------------------------- Engine
class AudioEngine {
  constructor() {
    this.ac = null;
    this.volumes = { master: 0.9, music: 0.6, sfx: 0.8 };
    this.current = null;
    this.currentName = null;
    this.players = [];
    this.lastSfx = new Map();
    this.muted = false;
    this.pendingSong = null;
  }
  /** Create/resume the AudioContext (must be called from a user gesture). */
  unlock() {
    try {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ac = new AC({ latencyHint: 'interactive' });
        this._build();
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      if (this.pendingSong) { const p = this.pendingSong; this.pendingSong = null; this.playMusic(p.name, p.opts); }
    } catch (e) { console.warn('[audio] unlock failed', e); }
  }
  _build() {
    const ac = this.ac;
    this.synth = new Synth(ac);
    this.master = ac.createGain();
    this.comp = ac.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(ac.destination);
    this.musicGain = ac.createGain();
    this.sfxGain = ac.createGain();
    this.duckGain = ac.createGain();
    this.musicGain.connect(this.duckGain).connect(this.master);
    this.sfxGain.connect(this.master);
    this.reverb = ac.createConvolver();
    this.reverb.buffer = makeImpulse(ac, 2.4, 2.8);
    this.reverbIn = ac.createGain();
    this.reverbIn.gain.value = 1;
    this.reverbOut = ac.createGain();
    this.reverbOut.gain.value = 0.5;
    this.reverbIn.connect(this.reverb).connect(this.reverbOut).connect(this.musicGain);
    this.sfxReverbIn = ac.createGain();
    this.sfxReverbIn.gain.value = 0.6;
    this.sfxReverbIn.connect(this.reverb);
    this.applyVolumes();
    this._timer = setInterval(() => this.tick(), 25);
  }
  applyVolumes() {
    if (!this.ac) return;
    const m = this.muted ? 0 : this.volumes.master;
    this.master.gain.value = m;
    this.musicGain.gain.value = this.volumes.music;
    this.sfxGain.gain.value = this.volumes.sfx;
  }
  setVolume(kind, v) { this.volumes[kind] = Math.max(0, Math.min(1, v)); this.applyVolumes(); }
  getVolume(kind) { return this.volumes[kind]; }
  setMuted(m) { this.muted = m; this.applyVolumes(); }

  tick() {
    if (!this.ac || this.ac.state !== 'running') return;
    const until = this.ac.currentTime + 0.15;
    for (const p of this.players) p.schedule(until);
    this.players = this.players.filter((p) => !p.stopped);
  }

  /** Play a registered SFX. opts: vol, pitch, pan, cooldown (s) */
  sfx(name, opts = {}) {
    if (!this.ac || this.ac.state !== 'running') return;
    const def = sfxDefs.get(name);
    if (!def) return;
    const now = this.ac.currentTime;
    const cd = opts.cooldown ?? 0.03;
    if (now - (this.lastSfx.get(name) || -1) < cd) return;
    this.lastSfx.set(name, now);
    const pitch = (opts.pitch ?? 1) * (opts.randomPitch ? 1 + (Math.random() * 2 - 1) * opts.randomPitch : 1);
    let dest = this.sfxGain;
    if (opts.pan) { const p = this.ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); p.connect(this.sfxGain); dest = p; }
    try {
      if (typeof def === 'function') def(this.ac, dest, now, { ...opts, pitch, synth: this.synth, reverb: this.sfxReverbIn });
      else {
        const layers = Array.isArray(def) ? def : [def];
        for (const L of layers) {
          this.synth.layer(L, dest, now, { pitch, vol: opts.vol ?? 1 });
          if (L.reverb) this.synth.layer({ ...L, vol: (L.vol ?? 0.3) * L.reverb }, this.sfxReverbIn, now, { pitch, vol: opts.vol ?? 1 });
        }
      }
    } catch (e) { console.warn('[audio] sfx error', name, e); }
  }

  /** Play a registered song (crossfades). Same song = no restart. */
  playMusic(name, opts = {}) {
    if (!name) { this.stopMusic(opts.fade ?? 1); return; }
    if (this.currentName === name && this.current && !this.current.stopped && !opts.restart) return;
    if (!this.ac || this.ac.state !== 'running') { this.pendingSong = { name, opts }; this.currentName = name; return; }
    const song = songs.get(name);
    if (!song) { console.warn('[audio] música não encontrada:', name); return; }
    const fade = opts.fade ?? 1;
    if (this.current) this.current.stop(fade);
    const out = this.ac.createGain();
    out.gain.value = 0.0001;
    out.gain.linearRampToValueAtTime(song.volume ?? 1, this.ac.currentTime + Math.max(0.05, opts.fadeIn ?? fade * 0.6));
    out.connect(this.musicGain);
    this.reverbOut.gain.value = song.reverb ?? 0.45;
    const p = new SongPlayer(this, song, out);
    this.players.push(p);
    this.current = p;
    this.currentName = name;
  }
  stopMusic(fade = 1) {
    if (this.current) this.current.stop(fade);
    this.current = null;
    this.currentName = null;
    this.pendingSong = null;
  }
  /** Temporarily lower music (dialogue, pause). amount 0..1 of volume kept. */
  duck(amount = 0.4, time = 0.3) {
    if (!this.ac) return;
    const g = this.duckGain.gain;
    g.cancelScheduledValues(this.ac.currentTime);
    g.setTargetAtTime(amount, this.ac.currentTime, time / 3);
  }
  unduck(time = 0.5) { this.duck(1, time); }

  /**
   * Offline render a song (for automated tests). Returns {peak, rms, seconds}.
   */
  async renderSongOffline(name, seconds = 8) {
    const song = songs.get(name);
    if (!song) throw new Error('song not found ' + name);
    const sr = 22050;
    const oac = new OfflineAudioContext(2, sr * seconds, sr);
    const fake = { ac: oac, synth: new Synth(oac), reverbIn: oac.createGain() };
    fake.reverbIn.connect(oac.destination);
    const out = oac.createGain();
    out.connect(oac.destination);
    const p = new SongPlayer(fake, song, out);
    p.nextTime = 0.01;
    p.schedule(seconds);
    const buf = await oac.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    return { peak, rms: Math.sqrt(sum / d.length), seconds };
  }
  async renderSfxOffline(name) {
    const def = sfxDefs.get(name);
    const sr = 22050;
    const oac = new OfflineAudioContext(1, sr * 2, sr);
    const synth = new Synth(oac);
    if (typeof def === 'function') def(oac, oac.destination, 0.01, { pitch: 1, synth, reverb: oac.destination });
    else for (const L of Array.isArray(def) ? def : [def]) synth.layer(L, oac.destination, 0.01, {});
    const buf = await oac.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    return { peak };
  }
}

export const audio = new AudioEngine();
export default audio;
