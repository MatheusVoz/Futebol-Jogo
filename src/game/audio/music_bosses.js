// =============================================================================
// audio/music_bosses.js — Músicas dos chefes (Guardiões + Costureiro), 100% procedurais.
//
// boss_rabbit ........ folk-horror frenético (150 bpm, Mi menor/frígio): rabeca, ostinato "plucky" em
//                      hemíola, taikos, fragmentos de caixinha desafinada (Tema do Tico + Costureiro).
// boss_whale ......... majestosa e triste (3/4, 84 bpm, Fá menor): canto de baleia (seno c/ glide), sinos vítreos.
// boss_king .......... barroco de relógio (140 bpm, Sol menor): sequência de quintas; a densidade das notas
//                      (semínimas → colcheias → semicolcheias → mínimas...) acelera e freia o "tempo".
// boss_shadow ........ horror (100 bpm): clusters, coração, coro, golpes; o Tema do Tico frágil no meio do pesadelo.
// boss_tailor ........ tema épico e sombrio sobre o Motivo do Costureiro (128 bpm, Ré menor); ponte em 3/4
//                      com a Canção de Ninar em menor (Fiapo, o boneco perdido da Vó).
// boss_tailor_final .. o Tema do Tico luta contra o motivo (Ré menor → Ré MAIOR) e termina em esperança:
//                      Tema do Tico e Canção de Ninar tocados JUNTOS.
// =============================================================================
import { registerSong } from '../../engine/audio.js';
import { INS, vs, mel, cat, rep, tr, dia, minor, pad, arp, bass, TICO, NINAR } from './music_story.js';

const bars = (a) => a.map((b) => mel(b));
const R = (n) => rep('.', n);
/** alonga as durações k vezes (meia velocidade) */
const stretch = (s, k) => s.split(' ').map((t) => [t, ...Array(k - 1).fill(t === '.' ? '.' : '-')].join(' ')).join(' ');
const OCT = 'r:2 o:2 r:2 o:2 r:2 o:2 r:2 o:2';

const I = {
  brass: { wave: 'saw', voices: 2, spread: 8, attack: 0.04, decay: 0.3, sustain: 0.75, release: 0.3, vol: 0.055, filter: { freq: 1400, env: 1200, envDecay: 0.15 }, reverb: 0.35 },
  choir: { wave: 'saw', voices: 4, spread: 20, attack: 0.8, decay: 0.5, sustain: 0.9, release: 1.2, vol: 0.036, filter: { freq: 1200, q: 3 }, vibrato: { rate: 4.5, depth: 0.12, delay: 0.4 }, reverb: 0.6 },
  ost: { wave: 'saw', attack: 0.003, decay: 0.1, sustain: 0.3, release: 0.05, vol: 0.075, filter: { freq: 500, env: 1800, envDecay: 0.05, q: 5 }, reverb: 0.1 },
  bass: { wave: 'square', attack: 0.004, decay: 0.12, sustain: 0.45, release: 0.05, vol: 0.09, filter: { freq: 650, env: 700, envDecay: 0.05 }, reverb: 0.05 },
  lead: { ...INS.lead, vol: 0.1, duty: 0.4 }, str: { ...INS.str, vol: 0.05 }, bell: { ...INS.bell, vol: 0.06, echo: 0.35 },
  flute: { ...INS.flute, vol: 0.15 }, pad: { ...INS.pad, vol: 0.04 },
  box: { wave: 'fm', ratio: 4.11, index: 1.6, indexDecay: 0.35, attack: 0.002, decay: 1.1, sustain: 0, release: 0.7, vol: 0.11, vibrato: { rate: 3, depth: 0.3, delay: 0.05 }, reverb: 0.6, echo: 0.35 },
  ghost: { wave: 'sine', voices: 2, spread: 40, detune: -25, attack: 0.003, decay: 1, sustain: 0, release: 0.6, vol: 0.05, reverb: 0.6, echo: 0.4 },
  low: { wave: 'saw', voices: 3, spread: 18, attack: 1.2, decay: 1, sustain: 0.9, release: 2, vol: 0.055, filter: { freq: 380, q: 3 }, reverb: 0.5 },
  wh: { wave: 'noise', attack: 0.4, decay: 0.6, sustain: 0.3, release: 0.8, vol: 0.45, filter: { type: 'bandpass', freq: 1500, q: 5 }, reverb: 0.6, pan: 0.4 },
  drums: { kit: 'boss', vol: 0.28, reverb: 0.2 },
};

// ============================================================ COELHO (150 bpm)
const RA = bars(['E5:2 G5:2 B5:2 G5:2 E5:2 G5:2 B5:2 E6:2', 'D6:2 B5:2 A5:2 G5:2 F#5:2 G5:2 E5:4', 'F#5:2 A5:2 D6:2 A5:2 F#5:2 A5:2 D6:2 F#6:2', 'E6:2 D6:2 B5:2 G5:2 E5:8',
  'E5:2 F5:2 G5:2 F5:2 E5:2 F5:2 G5:2 B5:2', 'C6:2 B5:2 A5:2 G5:2 F5:2 E5:2 C5:4', 'D5:2 F#5:2 A5:2 C6:2 B5:2 A5:2 F#5:4', 'D#5:2 F#5:2 B5:4 A5:2 F#5:2 D#5:4']);
const RB = bars(['B5:6 C6:2 B5:4 G5:4', 'A5:6 C6:2 A5:4 F5:4', 'G5:6 A5:2 G5:4 E5:4', 'F5:4 E5:4 F5:4 A5:4',
  'G5:6 E5:2 C5:4 E5:4', 'F#5:6 D#5:2 B4:4 D#5:4', 'E5:4 G5:4 B5:4 E6:4', 'D#6:8 B5:4 F#5:4']);
const PRA = 'Em Em D Em Em C D B', PRB = 'Em F Em F C B Em B';
const OSTR = '0 1 2 0 1 2 0 1 2 0 1 2 3 2 1 0', GAL = 'r:3 r:1 .:2 f:2 r:3 r:1 .:2 o:2';
const DR = 'k . h h s . h . k k h . s . h h', FR = 'k . t t s . t t T T t t s s s! s!';
const TK = 'T . . t . . T . t . T . t t T .', TK2 = 'T . t t T . t . T . t t T T t t';
const rab = (fid, p, tk, extra = {}) => ({ fid: cat(fid), pluck: arp(p, 16, OSTR, 64, 3), bass: bass(p, 16, GAL), drums: cat(rep(DR, 7), FR), drums2: rep(tk, 8), ...extra });
registerSong('boss_rabbit', {
  bpm: 150, reverb: 0.35, echoSteps: 3, echoFeedback: 0.25, loopFrom: 2,
  instruments: vs({ ...I, fid: { wave: 'saw', attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.08, vol: 0.06, filter: { freq: 2600, q: 1.5 }, vibrato: { rate: 6, depth: 0.18, delay: 0.12 }, reverb: 0.25, echo: 0.1 },
    pluck: { ...INS.pluck, vol: 0.1 }, bass: { ...INS.bass, vol: 0.25 }, drums: { kit: 'boss', vol: 0.21, reverb: 0.2 } }, 0.85),
  patterns: {
    I: { pluck: arp('Em Em Em B', 16, OSTR, 64, 3), low: mel('E2+B2:64'), drums: cat('b', R(63)),
      drums2: cat(rep('T . . . . . . . T . . . . . . .', 2), 'T . . T . . T . T . . T . . T .', 'T . T . T . T . t t t t T T T T!') },
    A: rab(RA, PRA, TK),
    B: rab(RB, PRB, TK2),
    A2: rab(RA, PRA, TK, { box: cat(RA[0], R(16), RA[2], R(16), RA[4], R(16), RA[6], R(16)) }),
    C: { box: mel('G5:2 B5:2 C6:4 B5:8 .:16 G5:2 F#5:2 E5:12 .:16 G5:2 B5:2 C6:4 B5:4 .:4 C6:2 B5:2 Bb5:2 A5:2 .:8 Eb5:16 .:16'),
      ghost: mel('.:16 G5:2 B5:2 C6:4 B5:8 .:16 G5:2 F#5:2 E5:12 .:64'), low: mel('E2+B2:128'), pad: pad('Em Em Em Em Em F Em B', 16, 55, 3),
      drums2: cat(rep('T? . . . . . . . t? . . . . . . .', 7), 'T . t . T . t . T T t t T T T! T!') },
    B2: rab(RB, PRB, TK2, { box: cat(RB[0], RB[1], R(32), RB[4], RB[5], R(32)) }),
  },
  order: ['I', 'A', 'B', 'A2', 'C', 'B2', 'A'],
});

// ============================================================ BALEIA (3/4, 84 bpm)
const WA = bars(['C5:6 F5:6', 'Ab5:8 F5:4', 'Eb5:6 C5:6', 'G5:8 Bb4:4', 'C5:6 F5:6', 'Ab5:4 Db6:8', 'C6:4 Bb5:4 F5:4', 'E5:12']);
const WB = cat(bars(['Eb5:4 Ab5:8', 'Bb5:8 G5:4', 'Ab5:6 C6:6', 'F5:8 Ab5:4', 'Eb6:8 C6:4', 'Bb5:6 G5:6', 'Ab5:4 F5:4 Db5:4', 'G5:6 E5:6']));
const PWA = 'Fm Db Ab Eb Fm Db Bbm C', PWB = 'Ab Eb/G Fm Db Ab Eb Db C', PWC = 'Fm Fm Db Db Eb Eb Fm C';
const BA = '0 . 1 . 2 . 3 . 2 . 1 .';
const WDR = cat('b . . . . . . . . . . .', rep('k? . . . . . h? . . . . .', 7));
const sea = (p) => ({ bell: arp(p, 12, BA, 72, 3), pad: pad(p, 12, 57, 4), sub: bass(p, 12, 'r:12') });
registerSong('boss_whale', {
  bpm: 84, reverb: 0.7, echoSteps: 3, echoFeedback: 0.42, loopFrom: 1,
  instruments: { ...I,
    whale: { wave: 'sine', attack: 0.25, decay: 0.5, sustain: 0.9, release: 0.8, vol: 0.17, glide: 0.18, vibrato: { rate: 3.5, depth: 0.35, delay: 0.4 }, reverb: 0.7, echo: 0.35 },
    bell: { ...INS.bell, vol: 0.06, echo: 0.45 }, pad: { wave: 'saw', voices: 4, spread: 20, attack: 1.5, decay: 1, sustain: 0.9, release: 2, vol: 0.036, filter: { freq: 700 }, reverb: 0.6 },
    sub: { ...INS.sub, vol: 0.28, attack: 0.6 }, str: { ...INS.str, vol: 0.045, attack: 0.8 }, drums: { kit: 'deep', vol: 0.26, reverb: 0.5 } },
  patterns: {
    I: { whale: mel('C5:12 .:12 F4:24'), bell: arp('Fm Db Fm C', 12, '0 . . . 2 . . . 1 . . .', 72, 3), pad: pad('Fm Db Fm C', 12, 57, 4), sub: bass('Fm Db Fm C', 12, 'r:12'), drums: cat('b', R(47)) },
    A: { whale: cat(WA), ...sea(PWA), drums: WDR },
    B: { whale: WB, ...sea(PWB), str: pad(PWB, 12, 66, 3), drums: cat('c? . . . . . . . . . . .', rep('k? . . . . . h? . . h? . .', 7)) },
    C: { whale: mel('F4:12 C5:12 Ab5:24 G5:12 Eb5:12 C5:24'), bell: arp(PWC, 12, '0 . . . . . 2 . . . . .', 72, 3), pad: pad(PWC, 12, 57, 4), sub: bass(PWC, 12, 'r:12'),
      drums: rep(cat('b?', R(23)), 4) },
    A2: { whale: cat(WA), str: cat(dia(cat(WA.slice(0, 7)), 2, 'Ab'), mel('G5:12')), ...sea(PWA), drums: WDR },
  },
  order: ['I', 'A', 'B', 'C', 'A2'],
});

// ============================================================ REI DOS RELÓGIOS (140 bpm, barroco)
const OFF = [0, 3, -1, 2, -2, 1, -3, 0]; // ciclo de quintas Gm Cm F Bb Eb Am7b5 D Gm (graus em Si bemol)
const seq = (cell) => cat(OFF.map((o, i) => { const b = dia(mel(cell), o, 'Bb'); return i === 6 ? b.replace(/\bF(\d)/g, 'F#$1') : b; }));
const PK = 'Gm Cm F Bb Eb Am7b5 D Gm';
const K16 = '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1', K8 = '0 . 1 . 2 . 1 .';
const kingSec = (cell, harpPat, bassPat, dr, extra = {}) => ({ lead: seq(cell), harp: arp(PK, 16, harpPat, 57, 3), bass: bass(PK, 16, bassPat), drums: rep(dr, 8), ...extra });
const E8 = 'G5:2 D5:2 Bb4:2 D5:2 G5:2 A5:2 Bb5:2 G5:2', S16 = 'G5 D5 Bb4 D5 G5 A5 Bb5 A5 G5 F5 Eb5 D5 C5 Bb4 A4 Bb4';
registerSong('boss_king', {
  bpm: 140, reverb: 0.35, echoSteps: 3, echoFeedback: 0.2,
  instruments: { ...I,
    lead: { wave: 'pulse', duty: 0.25, attack: 0.003, decay: 0.08, sustain: 0.4, release: 0.05, vol: 0.09, gate: 0.6, filter: { freq: 2800 }, reverb: 0.2, echo: 0.1 },
    harp: { wave: 'saw', attack: 0.002, decay: 0.16, sustain: 0.05, release: 0.1, vol: 0.055, filter: { freq: 900, env: 3800, envDecay: 0.05, q: 1.5 }, reverb: 0.2, pan: -0.25 },
    bass: { wave: 'saw', attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.08, vol: 0.08, filter: { freq: 700, env: 500, envDecay: 0.08 }, reverb: 0.1 },
    bell: { ...INS.bell, vol: 0.07 }, drums: { kit: 'clock', vol: 0.26, reverb: 0.12 } },
  patterns: {
    K1: kingSec('G4:4 Bb4:4 D5:4 G5:4', K8, 'r:4 f:4 o:4 f:4', 'k+p . . . r . . . s+p . . . r . . .'),
    K2: kingSec(E8, K16, OCT, 'k+p . r . s+p . r . k+p . r . s+p . r .'),
    K3: kingSec(S16, K8, OCT, 'k+p r p r s+p r p r k+p r p r s+p r p r'),
    K4: kingSec('G5:8 D5:8', '0 . . . . . . . 2 . . . . . . .', 'r:8 f:8', 'k+p . . . . . . . r . . . . . . .', { str: pad(PK, 16, 60, 3), bell: arp(PK, 16, '0:16', 72, 3) }),
    K5: kingSec('G4:6 Bb4:2 D5:6 G5:2', K16, 'r:4 f:4 o:4 f:4', 'k+p . . s? s+p . r . k+p . . s? s+p . r .'),
    K6: kingSec(S16, K16, OCT, 'k+p r p r s+p r p r k+p r p r s+p r p r', { bell: tr(seq(E8), -12), drums: cat('k+p+c r p r s+p r p r k+p r p r s+p r p r', rep('k+p r p r s+p r p r k+p r p r s+p r p r', 7)) }),
  },
  order: ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'],
});

// ============================================================ SOMBRA (100 bpm, horror)
const CL = mel('B3+C4+F4:32 Bb3+B3+E4:32 C4+Db4+G4:32 A3+Bb3+Eb4:32');
const STABS = mel('.:24 B4+C5+F5:4 .:36 Bb4+B4+E5:4 .:28 C5+Db5+G5:4 .:28'), BOOMS = cat(R(24), 'b', R(39), 'b', R(31), 'b', R(31));
const HB1 = 'k . k? . . . . . . . . . . . . .', HB2 = 'k . k? . . . . . k . k? . . . . .';
const SCREECH = rep('F6? E6? F6? E6?', 16);
const shadowA = (hb, extra = {}) => ({ low: mel('B1+F2:128'), choir: CL, brass: STABS, drums: rep(hb, 8), drums2: BOOMS, wh: rep(mel('.:8 C4:6 .:18'), 4), ...extra });
registerSong('boss_shadow', {
  bpm: 100, reverb: 0.65, echoSteps: 3, echoFeedback: 0.4, loopFrom: 1,
  instruments: vs({ ...I, choir: { ...I.choir, filter: { freq: 900, q: 3 } },
    str: { wave: 'saw', voices: 2, spread: 25, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.1, vol: 0.035, filter: { freq: 3000 }, vibrato: { rate: 7, depth: 0.4, delay: 0.05 }, reverb: 0.5 },
    brass: { wave: 'saw', voices: 3, spread: 15, attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.4, vol: 0.04, filter: { freq: 1200, env: 2500, envDecay: 0.1 }, reverb: 0.5 },
    ost: { ...I.ost, vol: 0.085, filter: { freq: 400, env: 1200, envDecay: 0.06, q: 4 } }, drums: { kit: 'horror', vol: 0.2, reverb: 0.4 } }, 0.82),
  patterns: {
    I: { low: mel('B1+F2:64'), wh: rep(mel('.:8 C4:6 .:18'), 2), drums: rep(HB1, 4) },
    A: shadowA(HB1),
    B: { ost: rep(mel('B1:2 C2:2'), 32), str: cat(R(64), SCREECH), choir: tr(CL, 1), brass: rep(mel('B4+C5+F5:2 .:30'), 4), drums: rep(HB2, 8), drums2: rep(cat('b', R(31)), 4) },
    C: { box: TICO, ghost: TICO, low: mel('C2+G2:128'), choir: pad('Cm Ab Fm G Cm Ab Fm:8 G:8 Cm', 16, 55, 3), wh: rep(mel('.:8 C4:6 .:18'), 4),
      brass: cat(R(112), mel('B4+C5+F5:16')), drums: cat(rep('k? . . . . . . . . . . . . . . .', 7), 'k . k . k . k . k k k k k! k! k! k!'), drums2: cat(R(112), 'b', R(15)) },
    A2: shadowA(HB2, { ost: rep(mel('B1:2 C2:2'), 32), str: rep(SCREECH, 2) }),
  },
  order: ['I', 'A', 'B', 'C', 'A2'],
});

// ============================================================ COSTUREIRO (128 bpm, Ré menor)
const TA = cat(bars(['D5:4 F5:4 A5:4 D6:4', 'C6:8 B5:8', 'Bb5:8 A5:8', 'Eb6:16', 'D6:4 C6:4 Bb5:4 A5:4', 'G5:4 Bb5:4 A5:4 G5:4', 'F5:4 E5:4 D5:4 C#5:4', 'D5:16']));
const TB = cat(bars(['D5:4 F5:4 Bb5:8', 'E5:4 G5:4 C6:8', 'A5:8 F5:4 D5:4', 'C6:4 B5:4 Bb5:4 A5:4', 'D6:8 Bb5:8', 'E6:8 C6:8', 'C#6:8 A5:8', 'Eb6:8 A5:8']));
const PTA = 'Dm Dm7:8 Dm6:8 Bb/D:8 Dm:8 Eb Dm Gm A Dm', PTB = 'Bb C Dm Dm Bb C A A', PTC = 'Dm:24 Bb:24 Gm:24 Am:24 Dm:24 Bb:24 Gm:12 Am:12 Dm:24';
const OST8 = '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1';
const DT = 'k . h k s . h . k k h . s . h h', DT2 = 'k . t k s . t t k k T . s . T t', FT = 'k . t t s . t t T T t t s s s! s!';
const ROLL = cat(rep('t . . . . . . . t . . . . . . .', 2), 't . t . t . t . t t t t t t t t', 't t t t t t t t T T T T T! T! T! T!');
const tailor = (mel_, p, dr, extra = {}) => ({ brass: mel_, brass2: tr(mel_, -12), choir: pad(p, 16, 60, 3), ost: arp(p, 16, OST8, 50, 3), bass: bass(p, 16, OCT), drums: dr, ...extra });
registerSong('boss_tailor', {
  bpm: 128, reverb: 0.5, echoSteps: 3, echoFeedback: 0.3, loopFrom: 1,
  instruments: I,
  patterns: {
    I: { ost: arp('Dm Dm Eb A', 16, OST8, 50, 3), choir: pad('Dm Dm Eb A', 16, 60, 3), drums: cat('b', R(63)), drums2: ROLL },
    A: tailor(TA, PTA, cat(rep(DT, 7), FT)),
    B: tailor(TB, PTB, cat(rep(DT2, 7), FT)),
    C: { box: stretch(tr(minor(NINAR), 2), 2), ghost: stretch(tr(minor(NINAR), 2), 2), pad: pad(PTC, 24, 55, 3), bass: bass(PTC, 24, 'r:24'), drums: rep(cat('k?', R(23)), 8) },
    A2: tailor(TA, PTA, cat('k+c . h k s . h . k k h . s . h h', rep(DT, 6), FT), { bell: TA }),
    B2: tailor(TB, PTB, cat('k+c . t k s . t t k k T . s . T t', rep(DT2, 6), FT), { choir: pad(PTB, 16, 67, 3), drums2: rep('T . . . T . . . T . . . T . T .', 8) }),
  },
  order: ['I', 'A', 'B', 'C', 'A2', 'B2'],
});

// ============================================================ COSTUREIRO — FINAL (140 bpm, esperança)
const TICO_DM = dia(tr(TICO, 5), -2, 'F'), TICO_D = tr(TICO, 2);
const COUNTER = mel('C4:8 B3:8 Bb3:8 A3:8 Bb3:8 A3:8 Eb4:16 C4:8 B3:8 Bb3:8 A3:8 Bb3:8 A3:4 G#3:4 A3:16');
const LF4 = cat(bars(['C5:4 A5:8 G5:4', 'F5:4 D5:12', 'Bb4:4 D5:4 F5:8', 'E5:6 F5:2 G5:8', 'A5:2 C6:2 D6:4 C6:8', 'A5:2 G5:2 F5:12', 'Bb5:4 A5:2 G5:2 E5:8', 'F5:12 .:4']));
const PD = 'D Bm G A D Bm G:8 A:8 D', PDL = 'D Bm G A D Bm Em:8 A:8 D';
const DH = 'k . h k s . h . k k h . s . h o';
registerSong('boss_tailor_final', {
  bpm: 140, reverb: 0.5, echoSteps: 3, echoFeedback: 0.3, loopFrom: 1,
  instruments: { ...I, box: { ...INS.box, vol: 0.1 } },
  patterns: {
    I: { brass: mel('C5:16 B4:16 Bb4:16 A4:8 Eb5:8'), brass2: mel('C4:16 B3:16 Bb3:16 A3:8 Eb4:8'), choir: pad('Dm7 Dm6 Bb/D A', 16, 60, 3), drums: cat('b', R(63)), drums2: ROLL },
    A: tailor(TA, PTA, cat(rep(DT, 7), FT)),
    B: { lead: TICO_DM, brass: COUNTER, choir: pad('Dm Bb Gm A Dm Bb Gm:8 A:8 Dm', 16, 60, 3), ost: arp('Dm Bb Gm A Dm Bb Gm:8 A:8 Dm', 16, OST8, 50, 3),
      bass: bass('Dm Bb Gm A Dm Bb Gm:8 A:8 Dm', 16, OCT), drums: cat(rep(DT2, 7), FT) },
    C: { lead: TICO_D, str: dia(TICO_D, -2, 'D'), choir: pad(PD, 16, 62, 3), ost: arp(PD, 16, OST8, 50, 3), bass: bass(PD, 16, OCT), drums: cat('k+c! . h k s . h . k k h . s . h o', rep(DH, 6), FT) },
    D: { flute: tr(LF4, -3), box: arp(PDL, 16, '0 . 1? . 2? . 3? . 2? . 1? . 2? . 1? .', 62, 3), pad: pad(PDL, 16, 57, 3), bass: bass(PDL, 16, 'r:8 f:8'),
      drums: cat(rep('k . h . . . h . s . h . . . h .', 7), 'k . h . s . h . s s s s s s s! s!') },
    E: { lead: TICO_D, str: tr(LF4, -15), choir: pad(PD, 16, 66, 3), bell: arp(PD, 16, OST8, 62, 3), bass: bass(PD, 16, OCT),
      drums: cat('k+c! . h k s . h . k k h . s . h o', rep(DH, 6), 'k . t t s . t t T T t t s s c! .') },
  },
  order: ['I', 'A', 'B', 'C', 'D', 'E'],
});
