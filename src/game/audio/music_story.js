// =============================================================================
// audio/music_story.js — Músicas de história, menus e jingles (100% procedurais).
//
// Também exporta um pequeno "kit de composição" usado por music_w1/w2:
//   mel('E5:2 G5 A5!:4 .:2')  -> tokens do tracker (":n" = duração em passos)
//   tr(str, semitons) / dia(str, graus, tom) -> transposição cromática / diatônica
//   pad/arp/bass(progressão, passosPorAcorde, padrão) -> trilhas geradas por acordes
//   ex.: bass('Dm G/D C', 16, 'r:4 f:4 o:4 t:4')  (r raiz, f quinta, t terça, o oitava, l quinta abaixo)
//        arp('C Am', 12, '0 . 1 . 2 .')            (dígitos = notas do acorde, de baixo p/ cima)
//
// Leitmotivs:
//   Tema do Tico ........... E G A G | E D C   (Dó maior)
//   Motivo do Costureiro ... C B Bb A + trítono (Eb)
//   Canção de Ninar da Vó .. (3/4, Dó) G4 E5 D5 | C5 A4 | F4 A4 C5 | B4 C5 D5 | E5 G5 A5 G5 | E5 D5 C5 | F5 E5 D5 B4 | C5
//     (os compassos 5–6 da canção SÃO o Tema do Tico: a Vó costurou a música dentro dele — revelado no final)
// =============================================================================
import { registerSong } from '../../engine/audio.js';

// ------------------------------------------------------------ kit de composição
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NM = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const midi = (n) => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); return m ? PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12 : null; };
export const nm = (m) => NM[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const toks = (s) => [s].flat(9).join(' ').replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
export const cat = (...a) => toks(a).join(' ');
export const rep = (s, n) => cat(Array(n).fill(s));
const sx = (t) => { const m = /^(.*?)([!?]?)$/.exec(t); return [m[1], m[2]]; };
const mapN = (s, f) => toks(s).map((t) => { const [b, x] = sx(t); return b.split('+').map((p) => { const m = midi(p); return m == null ? p : nm(f(m)); }).join('+') + x; }).join(' ');
/** melodia compacta -> tokens */
export const mel = (s, d = 1) => toks(s).map((t) => { const [n, l] = t.split(':'); const k = l ? +l : d; return [n, ...Array(k - 1).fill(n === '.' ? '.' : '-')].join(' '); }).join(' ');
export const tr = (s, k) => mapN(s, (m) => m + k);
const MAJ = [0, 2, 4, 5, 7, 9, 11];
/** transposição diatônica (k graus) dentro do tom maior `key` (menor/modos: use o relativo maior) */
export const dia = (s, k, key = 'C') => {
  const r = PC[key[0]] + (key[1] === 'b' ? -1 : key[1] === '#' ? 1 : 0);
  return mapN(s, (m) => {
    const rel = m - r, o = Math.floor(rel / 12), pc = rel - o * 12;
    let d = MAJ.indexOf(pc), c = 0;
    if (d < 0) { d = MAJ.indexOf(pc - 1); c = 1; }
    const nd = d + k, o2 = o + Math.floor(nd / 7);
    return r + o2 * 12 + MAJ[nd - Math.floor(nd / 7) * 7] + c;
  });
};
/** acentua (!) ou suaviza (?) todas as notas */
export const acc = (s, x = '!') => toks(s).map((t) => (t === '-' || t === '.' || /[!?]$/.test(t) ? t : t + x)).join(' ');
/** versão menor (E->Eb, A->Ab, B->Bb) */
export const minor = (s) => mapN(s, (m) => ([4, 9, 11].includes(((m % 12) + 12) % 12) ? m - 1 : m));

const Q = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  sus4: [0, 5, 7], sus2: [0, 2, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], aug: [0, 4, 8] };
const pcOf = (n) => midi(n + '4') % 12;
const prog = (s, len) => toks(s).map((t) => {
  const [sym, l] = t.split(':'); const [c, b] = sym.split('/'); const m = /^([A-G][#b]?)(.*)$/.exec(c);
  const r = pcOf(m[1]); return { r, iv: Q[m[2]], b: b ? pcOf(b) : r, len: l ? +l : len };
});
const near = (pc, c) => c - 6 + ((((pc - c + 6) % 12) + 12) % 12); // classe de altura pc posta em [c-6, c+6)
const voice = (ch, c, n = 4, rp = false) => {
  const iv = ch.iv.slice(0, n);
  if (rp) { const r = near(ch.r, c); return iv.map((i) => r + i); }
  return iv.map((i) => near((ch.r + i) % 12, c)).sort((a, b) => a - b);
};
const gen = (ps, len, pat, f) => {
  const p = toks(mel(pat)); const out = [];
  for (const ch of prog(ps, len)) for (let i = 0; i < ch.len; i++) {
    const [b, x] = sx(p[i % p.length]);
    out.push(b === '-' || b === '.' ? b : f(ch, b) + x);
  }
  return out.join(' ');
};
/** acordes (voicing fechado perto de `c`); `pat` opcional p/ "comping" com 'x' */
export const pad = (ps, len, c = 60, n = 4, pat) => gen(ps, len, pat || 'x:' + len, (ch) => voice(ch, c, n).map(nm).join('+'));
export const arp = (ps, len, pat, c = 64, n = 4, rp = false) => gen(ps, len, pat, (ch, b) => {
  const v = voice(ch, c, n, rp); return nm([...v, ...v.map((x) => x + 12), ...v.map((x) => x + 24)][+b]);
});
export const bass = (ps, len, pat, o = 2) => gen(ps, len, pat, (ch, b) => {
  const up = (i) => (((ch.r + ch.iv[i] - ch.b) % 12) + 12) % 12;
  return nm((o + 1) * 12 + ch.b + { r: 0, f: up(2), t: up(1), o: 12, l: up(2) - 12 }[b]);
});

// ------------------------------------------------------------ instrumentos base
export const INS = {
  box: { wave: 'fm', ratio: 4, index: 1.4, indexDecay: 0.3, attack: 0.002, decay: 0.9, sustain: 0, release: 0.6, vol: 0.13, reverb: 0.35, echo: 0.12 },
  bell: { wave: 'fm', ratio: 3.5, index: 2, indexDecay: 0.6, attack: 0.002, decay: 1.4, sustain: 0, release: 0.8, vol: 0.08, reverb: 0.45, echo: 0.3 },
  pluck: { wave: 'pulse', duty: 0.25, attack: 0.003, decay: 0.2, sustain: 0.12, release: 0.1, vol: 0.13, filter: { freq: 1100, env: 2600, envDecay: 0.07, q: 2 }, reverb: 0.25, echo: 0.15 },
  flute: { wave: 'sine', attack: 0.05, decay: 0.2, sustain: 0.85, release: 0.25, vol: 0.17, vibrato: { rate: 5, depth: 0.2, delay: 0.25 }, reverb: 0.35, echo: 0.15 },
  lead: { wave: 'pulse', duty: 0.33, attack: 0.012, decay: 0.15, sustain: 0.65, release: 0.15, vol: 0.1, vibrato: { rate: 5.5, depth: 0.12, delay: 0.25 }, filter: { freq: 2600 }, reverb: 0.3, echo: 0.18 },
  pad: { wave: 'saw', voices: 3, spread: 12, attack: 0.6, decay: 0.5, sustain: 0.85, release: 1, vol: 0.045, filter: { freq: 1000 }, reverb: 0.5 },
  str: { wave: 'saw', voices: 3, spread: 16, attack: 0.3, decay: 0.3, sustain: 0.85, release: 0.6, vol: 0.05, filter: { freq: 1800 }, vibrato: { rate: 5, depth: 0.08, delay: 0.3 }, reverb: 0.5 },
  bass: { wave: 'triangle', attack: 0.005, decay: 0.25, sustain: 0.65, release: 0.08, vol: 0.26, reverb: 0.05 },
  sub: { wave: 'sine', attack: 0.02, decay: 0.3, sustain: 0.9, release: 0.25, vol: 0.3, reverb: 0 },
  kit: { kit: 'soft', vol: 0.28, reverb: 0.12, snareTone: 2400 },
};

// ------------------------------------------------------------ leitmotivs
const bars = (a) => a.map((b) => mel(b));
/** Tema do Tico (4/4, Dó maior) — A e B */
const TA = bars(['E5:2 G5:2 A5:4 G5:6 .:2', 'E5:2 D5:2 C5:8 .:4', 'F5:2 A5:2 C6:4 A5:4 G5:4', 'F5:2 E5:2 D5:8 .:4',
  'E5:2 G5:2 A5:4 G5:6 .:2', 'E5:2 D5:2 C5:4 A4:4 C5:4', 'A5:4 G5:2 F5:2 E5:2 F5:2 D5:4', 'C5:12 .:4']);
const TB = bars(['C6:6 B5:2 A5:4 E5:4', 'G5:6 A5:2 B5:4 G5:4', 'A5:6 G5:2 F5:4 C5:4', 'E5:4 D5:2 E5:2 G5:8',
  'F5:6 E5:2 D5:4 A5:4', 'G5:6 F5:2 D5:4 B4:4', 'A5:2 G5:2 F5:2 E5:2 F5:4 A5:4', 'G5:8 B4:2 C5:2 D5:4']);
const PA = 'C Am F G C Am F:8 G:8 C', PB = 'Am Em F C Dm G F G7';
/** Tema do Tico em valsa (3/4) */
const TW = bars(['E5:2 G5:2 A5:4 G5:4', 'E5:2 D5:2 C5:8', 'F5:2 A5:2 C6:4 A5:4', 'G5:4 F5:2 E5:2 D5:4',
  'E5:2 G5:2 A5:4 G5:4', 'E5:2 D5:2 C5:4 A4:4', 'A5:4 F5:2 E5:2 F5:2 D5:2', 'C5:12']);
/** A Canção de Ninar da Vó (3/4, 8 compassos, Dó maior) */
const LUL = bars(['G4:4 E5:6 D5:2', 'C5:4 A4:8', 'F4:4 A4:4 C5:4', 'B4:6 C5:2 D5:4', 'E5:2 G5:2 A5:4 G5:4', 'E5:2 D5:2 C5:8', 'F5:4 E5:2 D5:2 B4:4', 'C5:12']);
const PL = 'C Am F G C Am Dm7:6 G7:6 C';
export const TICO = cat(TA), TICO_WALTZ = cat(TW), NINAR = cat(LUL), NINAR_CHORDS = PL;
export const COSTUREIRO = mel('C5:4 B4:4 Bb4:4 A4:4 Eb4:8 .:8');

const tick4 = 'p? . . . p? . . . p? . . . p? . . .';
const D1 = 'k . h? . s . h? . k . h? k s . h? .';
const D2 = 'k . h . s . h? . k . h k s . o? .';
const DF = 'k . h? . s . h? . k . s? s? s s t T';

// ============================================================ TÍTULO (90 bpm)
registerSong('title', {
  bpm: 90, swing: 0.06, reverb: 0.5, echoSteps: 3, echoFeedback: 0.28,
  instruments: { box: { ...INS.box, octave: 1 }, lead: INS.lead, str: INS.str, pad: INS.pad, bass: INS.bass, drums: INS.kit },
  patterns: {
    I1: { box: cat(TA.slice(0, 4)), box2: bass('C Am F G', 16, 'r?:4 f?:4 o?:4 f?:4', 3), drums: rep(tick4, 4) },
    I2: { box: cat(TA.slice(4)), box2: bass('C Am F:8 G:8 C', 16, 'r?:4 f?:4 o?:4 f?:4', 3), pad: pad('C Am F:8 G:8 C', 16, 60, 3),
      bass: bass('C Am F:8 G:8 C', 16, 'r?:16'), drums: cat(rep(tick4, 3), '. . . . . . . . s? . s? s? s s t T!') },
    A: { lead: TICO, box: arp(PA, 16, '0 . 1? . 2? . 3? . 2? . 1? . 2? . 1? .', 60, 3), pad: pad(PA, 16, 58, 3),
      bass: bass(PA, 16, 'r!:3 .:1 r:2 f:2 o:3 .:1 f:2 t:2'), drums: cat('k+c . h? . s . h? . k . h? k s . h? .', rep(D1, 6), DF) },
    B: { lead: cat(TB), box: arp(PB, 16, '0 . . . 2? . . . 1? . . . 3? . . .', 60, 3), pad: pad(PB, 16, 60, 3), str: pad(PB, 16, 67, 3, 'x?:16'),
      bass: bass(PB, 16, 'r:6 f:2 o:4 f:4'), drums: cat(rep('k . h? h? . . h? . s? . h? h? . . h? .', 7), 'k . h? . s? . s? . s . s s s s! t T') },
    A2: { lead: TICO, box: dia(TICO, -2), str: pad(PA, 16, 64, 3), pad: pad(PA, 16, 55, 3),
      bass: bass(PA, 16, 'r:2 r:2 o:2 r:2 f:2 r:2 o:2 f:2'), drums: cat('k+c . h . s . h? . k . h k s . o? .', rep(D2, 6), DF) },
  },
  order: ['I1', 'I2', 'A', 'B', 'A2'], loopFrom: 2,
});

// ============================================================ MAPA (104 bpm, Sol maior)
const PWA = 'G Em C D G Em C:8 D:8 G', PWB = 'C D Bm Em C D Am:8 D:8 D7';
const WA = cat(bars(['B4:2 D5:2 E5:4 D5:4 .:2 G5:2', 'B4:2 A4:2 G4:4 .:2 E4:2 G4:2 A4:2', 'C5:2 E5:2 G5:4 E5:2 .:2 C5:2 E5:2', 'D5:4 F#5:2 A5:2 .:2 F#5:2 D5:4',
  'B4:2 D5:2 E5:4 D5:4 .:2 G5:2', 'B5:2 A5:2 G5:4 .:2 E5:2 F#5:2 G5:2', 'A5:4 G5:2 E5:2 F#5:4 E5:2 D5:2', 'G5:6 .:2 D5:2 E5:2 F#5:4']));
const WB = cat(bars(['E5:6 D5:2 C5:4 G4:4', 'F#5:6 E5:2 D5:4 A4:4', 'B4:2 D5:2 F#5:4 E5:2 D5:2 B4:4', 'E5:4 G5:4 B5:8',
  'C6:6 B5:2 A5:4 G5:4', 'A5:6 G5:2 F#5:4 D5:4', 'E5:4 C5:2 E5:2 F#5:4 A5:4', 'F#5:8 .:4 A4:2 C5:2']));
const DW = 'k . h . s . h h k . h . s . h o?';
registerSong('worldmap', {
  bpm: 104, swing: 0.08, reverb: 0.4, echoSteps: 3, echoFeedback: 0.25,
  instruments: { lead: { ...INS.pluck, vol: 0.14 }, bell: INS.bell, flute: { ...INS.flute, vol: 0.12 }, pad: INS.pad, bass: INS.bass, drums: INS.kit },
  patterns: {
    A: { lead: WA, bell: arp(PWA, 16, '. . 0 . . . 2 . . . 1 . . . 3 .', 67, 3), pad: pad(PWA, 16, 60, 3),
      bass: bass(PWA, 16, 'r:2 .:2 f:2 .:2 r:2 .:2 f:2 o:2'), drums: cat(rep(DW, 7), DF) },
    B: { lead: WB, bell: dia(WB, -2, 'G'), pad: pad(PWB, 16, 62, 3), bass: bass(PWB, 16, 'r:4 f:2 r:2 o:4 f:4'),
      drums: cat(rep('k . h . s . h . k k h . s . h h', 7), DF) },
    A2: { lead: WA, flute: dia(WA, -2, 'G'), bell: arp(PWA, 16, '0 . 1 . 2 . 3 . 2 . 1 . 2 . 1 .', 67, 3), pad: pad(PWA, 16, 60, 3),
      bass: bass(PWA, 16, 'r:2 r:2 f:2 r:2 o:2 r:2 f:2 t:2'), drums: cat('k+c . h . s . h h k . h . s . h o?', rep(DW, 6), DF) },
  },
  order: ['A', 'B', 'A2', 'B'],
});

// ============================================================ LEMBRANÇA (66 bpm, 3/4, Fá)
const NF = tr(NINAR, 5), PLF = 'F Dm Bb C F Dm Gm7:6 C7:6 F';
registerSong('memory', {
  bpm: 66, reverb: 0.6, echoSteps: 4, echoFeedback: 0.3,
  instruments: { box: { ...INS.box, vol: 0.15 }, flute: { ...INS.flute, vol: 0.15, vibrato: { rate: 4.5, depth: 0.22, delay: 0.35 } },
    pad: { ...INS.pad, vol: 0.035, attack: 1.2, release: 1.6, filter: { freq: 800 } }, sub: { ...INS.sub, vol: 0.2 } },
  patterns: {
    M1: { box: NF, box2: arp(PLF, 12, '0? . 1? . 2? . 3? . 2? . 1? .', 55, 3, true), pad: pad(PLF, 12, 60, 3) },
    M2: { flute: tr(NF, -12), box: arp(PLF, 12, '3? . 1? . 2? . 4? . 2? . 1? .', 55, 3, true), box2: dia(NF, -2, 'F'),
      pad: pad(PLF, 12, 62, 3), sub: bass(PLF, 12, 'r:12') },
  },
  order: ['M1', 'M2'],
});

// ============================================================ ABERTURA (70 bpm, 3/4, tempestade)
const drip = (n, s) => Array.from({ length: n }, (_, i) => (((i * 37 + s) % 13) < 2 ? 'h?' : '.')).join(' ');
const hold = (n, x = 'C4') => mel(`${x}:${n}`);
const PLm = 'Cm Ab Fm Gm Cm Ab Fm:6 G:6 Cm';
registerSong('opening', {
  bpm: 70, reverb: 0.6, echoSteps: 4, echoFeedback: 0.35,
  instruments: {
    rain: { wave: 'noise', attack: 1.5, decay: 0.5, sustain: 1, release: 2.5, vol: 0.1, filter: { type: 'bandpass', freq: 2400, q: 0.5 }, reverb: 0.3 },
    wind: { wave: 'noise', attack: 2, decay: 1, sustain: 0.8, release: 2.5, vol: 0.13, filter: { type: 'lowpass', freq: 380, q: 3 }, reverb: 0.2 },
    box: { ...INS.box, vol: 0.14 },
    bad: { ...INS.box, ratio: 4.23, index: 1.8, vol: 0.12, vibrato: { rate: 2.8, depth: 0.35, delay: 0.05 } },
    ghost: { wave: 'sine', voices: 2, spread: 45, detune: -30, attack: 0.003, decay: 0.8, sustain: 0, release: 0.5, vol: 0.08, vibrato: { rate: 3, depth: 0.3, delay: 0.1 }, reverb: 0.5, echo: 0.3 },
    low: { wave: 'saw', voices: 2, spread: 10, attack: 0.4, decay: 0.5, sustain: 0.9, release: 0.8, vol: 0.1, filter: { freq: 600, q: 2 }, reverb: 0.4 },
    pad: { ...INS.pad, vol: 0.04, filter: { freq: 700 } },
    drums: { kit: 'storm', vol: 0.4, reverb: 0.4 },
  },
  patterns: {
    S: { rain: hold(48), wind: hold(48), pad: pad('Am:24 F:24', 24, 52, 3), drums: cat('b!', drip(29, 3), 'b', drip(17, 5)) },
    L: { rain: hold(96), box: NINAR, box2: arp(PL, 12, '0? . 1? . 2? . 1? . 2? . 1? .', 55, 3, true), pad: pad(PL, 12, 60, 3),
      drums: cat(drip(60, 1), 'b?', drip(35, 2)) },
    E: { rain: hold(96), bad: minor(NINAR), ghost: minor(NINAR), low: mel('C3:12 B2:12 Bb2:12 A2:12 Eb3:12 A2:12 Eb3:12 A2:12'),
      pad: pad(PLm, 12, 55, 3), drums: cat(rep('p? . . . p? . . . p? . . .', 4), 'b', rep('.', 11), rep('p? . . . p? . . . p? . . .', 2), 'b!', rep('.', 11)) },
    X: { rain: hold(48), wind: hold(48), low: mel('C3:12 B2:12 Bb2:12 A2:6 Eb2:6'), bad: mel('C6:12 B5:12 Bb5:12 A5:6 Eb5:6'),
      pad: pad('Cm:12 G:12 Gm:12 D:6 Adim:6', 12, 55, 3), drums: cat('b!+c', drip(23, 7), 'b', drip(11, 4), 'b!', rep('.', 11)) },
  },
  order: ['S', 'L', 'E', 'X'],
});

// ============================================================ REVELAÇÃO (84 bpm, Lá menor, tensa)
registerSong('revelation', {
  bpm: 84, reverb: 0.55, echoSteps: 3, echoFeedback: 0.3,
  instruments: {
    ost: { wave: 'saw', attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.08, vol: 0.1, filter: { freq: 450, env: 1400, envDecay: 0.06, q: 4 }, reverb: 0.15 },
    low: { wave: 'saw', voices: 2, spread: 10, attack: 0.25, decay: 0.4, sustain: 0.9, release: 0.6, vol: 0.09, filter: { freq: 900, q: 1.5 }, reverb: 0.4 },
    str: { ...INS.str, vol: 0.06, vibrato: { rate: 6, depth: 0.15, delay: 0.2 } },
    bell: { ...INS.bell, ratio: 3.7, vol: 0.06 },
    pad: { ...INS.pad, vol: 0.04, filter: { freq: 800 } }, sub: { ...INS.sub, vol: 0.24 },
    drums: { kit: 'tense', vol: 0.32, reverb: 0.25 },
  },
  patterns: {
    R1: { ost: rep('A2! . A2? A2 . A2? A2 . A2! . A2? A2 . A2? Bb2 .', 8),
      low: mel('C5:8 B4:8 Bb4:8 A4:8 Eb5:12 .:4 A4:16 C5:8 B4:8 Bb4:8 A4:8 Eb4:8 A4:8 Eb5:16'),
      pad: pad('Am Am D#dim Am Fm Am D#dim D#dim', 16, 57, 3), sub: rep(mel('A1:16'), 8), drums: rep('k+p? . k? . p? . . . p? . . . p? . . .', 8) },
    R2: { ost: rep('A3! A3? A3 A3? A3 A3? A3 A3? A3! A3? A3 A3? Bb3 A3? Bb3 A3?', 8),
      str: mel('C6:8 B5:8 Bb5:8 A5:8 Eb6:16 A5:16 C6:8 B5:8 Bb5:8 A5:8 F#5:8 F5:8 E5:16'),
      low: cat(rep(mel('C3:8 B2:8 Bb2:8 A2:8'), 3), mel('F2:8 D#2:8 E2:16')),
      bell: rep(mel('A5+D#6?:16'), 8),
      pad: pad(cat(rep('Am/C:8 E/B:8 Gm/Bb:8 D/A:8', 3), 'F:8 D#dim:8 E:16'), 16, 60, 3),
      drums: cat('k+b! . p . s . p k . k p . s . p T', rep('k . p . s . p k . k p . s . p T', 6), 'k . s s s . s s s s s s s! s! T t') },
  },
  order: ['R1', 'R2'],
});

// ============================================================ FINAL (76 bpm, 3/4: Ninar + Tema do Tico -> Ré maior)
const WZ = 'k . h? . s? . h? . s? . h? .';
const PE4 = 'D Bm G A D Bm Em7:6 A7:6 D'; // PL em Ré (clímax, um tom acima)
registerSong('ending', {
  bpm: 76, reverb: 0.6, echoSteps: 3, echoFeedback: 0.3,
  instruments: { box: { ...INS.box, vol: 0.14 }, flute: INS.flute, lead: { ...INS.lead, vol: 0.11 }, bell: { ...INS.bell, octave: 1, vol: 0.07 },
    str: INS.str, pad: { ...INS.pad, vol: 0.04 }, bass: { ...INS.bass, vol: 0.22 }, drums: { ...INS.kit, vol: 0.3, reverb: 0.25 } },
  patterns: {
    E1: { box: NINAR, box2: arp(PL, 12, '0? . 1? . 2? . 1? . 2? . 1? .', 55, 3, true), pad: cat(rep('.', 48), pad('C Am Dm7:6 G7:6 C', 12, 60, 3, 'x?:12')) },
    E2: { flute: NINAR, box: arp(PL, 12, '0? . 1? . 2? . 3? . 2? . 1? .', 60, 3, true), str: pad(PL, 12, 62, 3), bass: bass(PL, 12, 'r?:8 f?:4') },
    E3: { lead: TICO_WALTZ, flute: tr(NINAR, -12), box: arp(PL, 12, '0? . 1? . 2? . 3? . 2? . 1? .', 60, 3, true), str: pad(PL, 12, 60, 3),
      bass: bass(PL, 12, 'r:4 f:4 o:4'), drums: cat(rep('k? . . . h? . . . h? . . .', 7), 's? . s? . s s s s s! s! t T') },
    E4: { lead: acc(tr(NINAR, 2)), bell: tr(TICO_WALTZ, 2), str: pad(PE4, 12, 64, 3), pad: pad(PE4, 12, 57, 3),
      bass: bass(PE4, 12, 'r!:4 f:4 o:4'), drums: cat('k+c! . h? . s? . h? . s? . h? .', rep(WZ, 3), 'k+c . h? . s? . h? . s? . h? .', rep(WZ, 2), 's . s . s s s s s! s! T t') },
    E5: { lead: mel('A5:12 B5:6 A5:6 Bb5:6 A5:6 D6!:12'), box: cat(tr(cat(TW.slice(0, 2)), 2), mel('.:12 D6:12')),
      str: pad('D G Gm D', 12, 62, 3), pad: pad('D G Gm D', 12, 55, 3), bass: bass('D G Gm D', 12, 'r:12'),
      drums: cat('k+c! . . . . . . . . . . .', rep('.', 24), 'c? . . . . . . . . . . .') },
  },
  order: ['E1', 'E2', 'E3', 'E4', 'E5'],
});

// ============================================================ CRÉDITOS (112 bpm, medley)
const LF4 = cat(bars(['C5:4 A5:8 G5:4', 'F5:4 D5:12', 'Bb4:4 D5:4 F5:8', 'E5:6 F5:2 G5:8', 'A5:2 C6:2 D6:4 C6:8', 'A5:2 G5:2 F5:12', 'Bb5:4 A5:2 G5:2 E5:8', 'F5:12 .:4']));
const PC4 = 'D Bm G A D Bm G:8 A:8 D';
const DC = 'k . h . s . h k . k h . s . h o?';
registerSong('credits', {
  bpm: 112, swing: 0.1, reverb: 0.45, echoSteps: 3, echoFeedback: 0.25,
  instruments: { lead: INS.lead, flute: { ...INS.flute, vol: 0.15 }, box: { ...INS.box, octave: 1, vol: 0.1 }, bell: { ...INS.bell, octave: 1 },
    str: INS.str, pad: INS.pad, bass: INS.bass, drums: INS.kit },
  patterns: {
    C1: { lead: TICO, box: arp(PA, 16, '0 . 1? . 2? . 3? . 2? . 1? . 2? . 1? .', 60, 3), pad: pad(PA, 16, 58, 3),
      bass: bass(PA, 16, 'r:2 r:2 o:2 r:2 f:2 r:2 o:2 f:2'), drums: cat('k+c . h . s . h k . k h . s . h o?', rep(DC, 6), DF) },
    C2: { flute: LF4, lead: acc(dia(LF4, -2, 'F'), '?'), bell: arp('F Dm Bb C F Dm Gm:8 C:8 F', 16, '. . 0 . . . 2 . . . 1 . . . 3 .', 62, 3),
      pad: pad('F Dm Bb C F Dm Gm:8 C:8 F', 16, 60, 3), bass: bass('F Dm Bb C F Dm Gm:8 C:8 F', 16, 'r:3 .:1 r:2 f:2 .:2 f:2 o:2 f:2'),
      drums: cat(rep('k . h h s . h . k . h h s . h h', 7), DF) },
    C3: { str: mel('C6:16 B5:16 Bb5:16 A5:16 Ab5:16 G5:16 F5:16 E5:8 C#5:8'), box: arp('C Em C7 F Fm C/G Bb A7', 16, '0 1? 2? 3? 2? 1? 0 1? 2? 3? 4? 3? 2? 1? 2? 1?', 60, 4),
      pad: pad('C Em C7 F Fm C/G Bb A7', 16, 58, 4), bass: bass('C Em C7 F Fm C/G Bb A7', 16, 'r:4 .:2 r:2 f:4 o:4'),
      drums: cat(rep('k . h? . . . h? . s . h? . . . h? .', 7), 'k . h? . s . s . s s s s s! s! t T') },
    C4: { lead: tr(TICO, 2), bell: dia(tr(TICO, 2), -2, 'D'), str: pad(PC4, 16, 64, 3), pad: pad(PC4, 16, 57, 3),
      bass: bass(PC4, 16, 'r:2 r:2 o:2 r:2 f:2 r:2 o:2 f:2'), drums: cat('k+c! . h . s . h k . k h . s . h o?', rep(DC, 6), 'k . h . s . h . k+c . s s s s s! T') },
  },
  order: ['C1', 'C2', 'C3', 'C4'],
});

// ============================================================ LOJA da Agulheta (110 bpm, bossa)
const SA = cat(bars(['.:2 A5:2 G#5:1 A5:1 C6:2 .:2 A5:2 F5:2 E5:2', 'F5:6 .:2 E5:2 F5:2 G5:4', '.:2 Bb5:2 A5:1 Bb5:1 D6:2 .:2 Bb5:2 G5:2 F5:2', 'E5:6 .:2 D5:2 E5:2 G5:4',
  '.:2 C6:2 B5:1 C6:1 E6:2 .:2 C6:2 A5:2 G5:2', 'F#5:6 .:2 E5:2 F#5:2 A5:4', 'Bb5:4 A5:2 G5:2 E5:2 G5:2 Bb5:4', 'A5:6 .:2 G5:1 F#5:1 G5:2 C5:4']));
const SB = cat(bars(['D6:4 C6:2 A5:2 F5:4 .:4', 'Db6:4 C6:2 Bb5:2 G5:4 .:4', 'C6:2 .:2 C6:2 B5:2 C6:2 E6:2 .:2 C6:2', 'A5:8 F#5:2 G5:2 G#5:2 A5:2',
  'Bb5:4 .:2 A5:2 G5:4 D5:4', 'E5:4 .:2 F5:2 G5:4 Bb5:4', 'A5:6 C6:2 F#5:4 .:4', 'G5:2 A5:2 Bb5:2 B5:2 C6:4 .:4']));
const PSA = 'Fmaj7 Fmaj7 Gm7 C7 Am7 D7 Gm7:8 C7:8 Fmaj7:8 C7:8', PSB = 'Bbmaj7 Bbm6 Am7 D7 Gm7 C7 Fmaj7:8 D7:8 Gm7:8 C7:8';
const COMP = 'x . . x . . x . . . x . . x . .', BOS = 'r:6 f:2 f:6 r:2';
const shopDr = { drums: rep('k? . . . . . k? . k? . . . . . k? .', 8), drums2: rep('h? . h? h? h? . h? h? h? . h? h? h? . h? h?', 8),
  drums3: rep('r . . r . . r . . . r . . r . . . . r . . r . . . . r . . r . .', 4) };
registerSong('shop', {
  bpm: 110, swing: 0.05, reverb: 0.35, echoSteps: 3, echoFeedback: 0.2,
  instruments: {
    lead: { wave: 'pulse', duty: 0.125, attack: 0.005, decay: 0.12, sustain: 0.4, release: 0.06, vol: 0.1, glide: 0.025, gate: 0.8, filter: { freq: 2400 }, reverb: 0.2, echo: 0.12, pan: 0.15 },
    comp: { wave: 'triangle', attack: 0.004, decay: 0.15, sustain: 0.25, release: 0.08, vol: 0.07, gate: 0.6, filter: { freq: 1800 }, pan: -0.2, reverb: 0.2 },
    bell: { wave: 'fm', ratio: 4, index: 0.8, indexDecay: 0.1, attack: 0.002, decay: 0.35, sustain: 0, release: 0.2, vol: 0.12, pan: 0.25, reverb: 0.2 },
    bass: { wave: 'triangle', attack: 0.004, decay: 0.3, sustain: 0.4, release: 0.06, vol: 0.3, reverb: 0.05 },
    drums: { kit: 'bossa', vol: 0.3, reverb: 0.1 },
  },
  patterns: {
    A: { lead: SA, comp: pad(PSA, 16, 62, 4, COMP), bass: bass(PSA, 16, BOS), ...shopDr },
    B: { lead: SB, comp: pad(PSB, 16, 62, 4, COMP), bass: bass(PSB, 16, BOS), ...shopDr },
    A2: { lead: SA, bell: dia(SA, -2, 'F'), comp: pad(PSA, 16, 62, 4, COMP), bass: bass(PSA, 16, BOS), ...shopDr },
  },
  order: ['A', 'B', 'A2', 'B'],
});

// ============================================================ JINGLES (loop:false)
const JI = { lead: { ...INS.lead, vol: 0.13, duty: 0.25 }, brass: { wave: 'saw', voices: 2, spread: 8, attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.3, vol: 0.06, filter: { freq: 2200 }, reverb: 0.3 },
  bell: { ...INS.bell, vol: 0.1, echo: 0.2 }, box: INS.box, bass: INS.bass, pad: { ...INS.pad, attack: 0.2 }, drums: { ...INS.kit, vol: 0.32 } };
registerSong('jingle_clear', {
  bpm: 120, reverb: 0.4, loop: false, instruments: JI,
  patterns: { J: {
    lead: mel('E5:2 G5:2 A5:2 G5:2 E5:2 D5:2 C5:2 G5:2 C6!:12'),
    brass: mel('C4+E4+G4:4 F4+A4+C5:4 G4+B4+D5:4 C4+E4+G4+C5!:16'),
    bass: mel('C3:4 F2:4 G2:4 C2:16'),
    drums: cat('k . h . s . h . k . s s k+c!', rep('.', 15)) } },
  order: ['J'],
});
registerSong('jingle_death', {
  bpm: 100, reverb: 0.5, loop: false, instruments: { box: INS.box, flute: { ...INS.flute, vol: 0.13, vibrato: { rate: 4, depth: 0.3, delay: 0.1 } }, pad: JI.pad, bass: { ...INS.bass, vol: 0.2 } },
  patterns: { J: { box: mel('E5:2 D5:2 C5:2 B4:2 A4:6'), flute: mel('E4:2 D4:2 C4:2 B3:2 A3:6'),
    pad: mel('D4+F4+A4:8 C4+E4+A4:6'), bass: mel('D2:8 A1:6') } },
  order: ['J'],
});
registerSong('jingle_item', {
  bpm: 120, reverb: 0.5, loop: false, instruments: JI,
  patterns: { J: {
    bell: mel('C5 E5 G5 C6 D5 F5 A5 D6 E5 G5 B5 E6 F5 A5 C6 F6 G5+C6+E6:12'),
    lead: mel('.:16 C6!:12'),
    brass: mel('C4+E4+G4:4 D4+F4+A4:4 E4+G4+B4:4 F4+A4+C5:4 C4+E4+G4+C5:12'),
    bass: mel('C3:4 D3:4 E3:4 F3:4 C2:12'),
    drums: cat(rep('.', 16), 'c?', rep('.', 11)) } },
  order: ['J'],
});
registerSong('jingle_star', {
  bpm: 120, reverb: 0.5, loop: false, instruments: JI,
  patterns: { J: { bell: mel('G5 C6 E6 G6 C7:4'), box: mel('.:4 C6+E6+G6:4') } },
  order: ['J'],
});
registerSong('jingle_boss_clear', {
  bpm: 132, reverb: 0.45, loop: false, instruments: JI,
  patterns: { J: {
    lead: mel('E5:2 G5:2 A5:4 G5:4 E5:2 D5:2 C5:4 F5:2 A5:2 C6:4 D6:2 B5:2 C6!:16'),
    brass: mel('C4+E4+G4:12 A3+C4+E4:8 F3+A3+C4+F4:6 G3+B3+D4+G4:6 C4+E4+G4+C5!:16'),
    bass: mel('C3:4 C3:4 C3:4 A2:8 F2:6 G2:6 C2:16'),
    bell: mel('.:32 C6:2 E6:2 G6:2 C7:10'),
    drums: cat('k . s . k . s . k k s . k . s . k . s s k . . k . . s s s s s s! k+c!', rep('.', 15)) } },
  order: ['J'],
});
