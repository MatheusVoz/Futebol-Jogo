// =============================================================================
// audio/music_w4.js — Mundo 4 (Pesadelo Debaixo da Cama: escuro, abajur, sombras).
//
// w4_level: sombria e assustadora — 70 bpm, Si menor / diminuto. Drones graves, caixinha de música
//   desafinada citando o Tema do Tico em Si menor (D F# G F# | D C# B) com fragilidade, coração no bumbo,
//   sussurros de ruído filtrado, e o Motivo do Costureiro às claras (D C# C B + trítono F).
//   C: a Canção de Ninar da Vó em menor (3/4) na caixinha. Intro + A B C ≈ 89 s; loopFrom pula a intro.
// w4_calm: caixinha frágil com a Canção de Ninar (Ré maior, depois Si menor).
// w4_chase: perseguição implacável — 156 bpm, ostinato, tons, golpes do Costureiro.
// =============================================================================
import { registerSong } from '../../engine/audio.js';
import { INS, mel, cat, rep, tr, dia, minor, pad, arp, bass, NINAR } from './music_story.js';

const bars = (a) => a.map((b) => mel(b));
const R = (n) => rep('.', n);
const NB = tr(minor(NINAR), -1), PLB = 'Bm G Em F#m Bm G Em:6 F#:6 Bm'; // ninar em Si menor
const ND = tr(NINAR, 2), PLD = 'D Bm G A D Bm Em7:6 A7:6 D';

const box = { wave: 'fm', ratio: 4.07, index: 1.6, indexDecay: 0.4, attack: 0.002, decay: 1.2, sustain: 0, release: 0.8, vol: 0.11, vibrato: { rate: 3.2, depth: 0.3, delay: 0.05 }, reverb: 0.6, echo: 0.4 };
const ghost = { wave: 'sine', voices: 2, spread: 40, detune: -25, attack: 0.003, decay: 1, sustain: 0, release: 0.6, vol: 0.05, reverb: 0.6, echo: 0.4 };
const wh = { wave: 'noise', attack: 0.4, decay: 0.6, sustain: 0.3, release: 0.8, vol: 0.07, filter: { type: 'bandpass', freq: 1100, q: 8 }, reverb: 0.6, pan: -0.5 };
const low = { wave: 'saw', voices: 2, spread: 12, attack: 0.3, decay: 0.5, sustain: 0.9, release: 0.8, vol: 0.08, filter: { freq: 700, q: 2 }, reverb: 0.45 };

const PA = 'Bm Bm G F# Bm Bdim Em F#';
const TICO_BM = cat(bars(['D5:2 F#5:2 G5:4 F#5:8', '.:16', 'D5:2 C#5:2 B4:12', '.:16', 'D5:2 F#5:2 G5:4 F#5:4 .:4', 'F5:2 E5:2 D5:4 .:8', 'D5:2 C#5:2 B4:12', 'A#4:4 .:12']));
const HB = 'k . k? . . . . . k . k? . . . . .';

registerSong('w4_level', {
  bpm: 70, reverb: 0.65, echoSteps: 3, echoFeedback: 0.45, loopFrom: 1,
  instruments: {
    drone: { wave: 'saw', voices: 3, spread: 18, attack: 2, decay: 1, sustain: 0.9, release: 2.5, vol: 0.055, filter: { freq: 320, q: 3 }, reverb: 0.5 },
    low, box, ghost, wh, wh2: { ...wh, filter: { type: 'bandpass', freq: 2300, q: 9 }, pan: 0.5 },
    pad: { ...INS.pad, vol: 0.035, filter: { freq: 600 } }, bell: { ...INS.bell, ratio: 3.7, vol: 0.05 },
    drums: { kit: 'heart', vol: 0.32, reverb: 0.3 },
  },
  patterns: {
    I: { drone: mel('B1+F2:64'), wh: rep(mel('.:8 C4:6 .:18'), 2), wh2: mel('.:40 C4:8 .:16'), bell: mel('B4+F5?:32 .:32'), drums: rep(HB, 4) },
    A: { box: TICO_BM, ghost: TICO_BM, drone: mel('B1+F#2:128'), pad: pad(PA, 16, 55, 3),
      wh: rep(mel('.:8 C4:6 .:18'), 4), wh2: rep(mel('.:22 C4:5 .:5'), 4), drums: rep(HB, 8) },
    B: { low: mel('D4:16 C#4:16 C4:16 B3:16 F4:32 B3:32'), box: cat(R(64), mel('F6:4 .:12 E6:4 .:12 Eb6:4 .:12 D6:4 .:12')),
      drone: mel('B1+F2:128'), pad: pad('Bm Bm Bm Bm Bdim Bdim Bm Bm', 16, 55, 3), bell: rep(mel('B5+F6?:32'), 4),
      wh: rep(mel('.:4 C4:6 .:6'), 8), wh2: rep(mel('.:10 C4:4 .:2'), 8), drums: rep('k . k? . k . k? . k . k? . k . k? .', 8) },
    C: { box: NB, ghost: NB, drone: mel('B1+F#2:96'), pad: pad(PLB, 12, 55, 3), wh: rep(mel('.:30 C4:6 .:12'), 2), drums: rep('k . k? . . . . . . . . .', 8) },
  },
  order: ['I', 'A', 'B', 'C'],
});

registerSong('w4_calm', {
  bpm: 60, reverb: 0.65, echoSteps: 4, echoFeedback: 0.4,
  instruments: { box: { ...box, ratio: 4.02, vol: 0.13, vibrato: { rate: 3, depth: 0.12, delay: 0.2 } }, ghost: { ...ghost, vol: 0.035 },
    pad: { ...INS.pad, vol: 0.032, attack: 1.4, release: 2, filter: { freq: 700 } } },
  patterns: {
    L1: { box: ND, box2: arp(PLD, 12, '0? . . . 1? . . . 2? . . .', 55, 3, true), pad: pad(PLD, 12, 60, 3) },
    L2: { box: NB, ghost: NB, pad: pad(PLB, 12, 57, 3) },
  },
  order: ['L1', 'L2'],
});

// ------------------------------------------------------------ perseguição
const PCA = 'Bm Bm Bdim Bdim Bm Bm C F#', PCB = 'Bm Bm G F# Bm Bm C F#';
const LBa = bars(['D5:2 F#5:2 G5:2 F#5:2 D5:2 C#5:2 B4:4', 'D5:2 F#5:2 B5:4 A5:2 F#5:2 D5:4', 'B4:2 D5:2 E5:2 D5:2 B4:2 A4:2 G4:4', 'A#4:2 C#5:2 F#5:4 E5:2 C#5:2 A#4:4',
  'D5:2 F#5:2 G5:2 F#5:2 D5:2 C#5:2 B4:4', 'F#5:2 B5:2 D6:4 C#6:2 B5:2 F#5:4', 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4', 'F#5:4 E5:4 C#5:4 A#4:4']);
const LB = cat(LBa);
const LBH = cat(dia(cat(LBa.slice(0, 3)), -2, 'D'), mel('F#4:2 A#4:2 C#5:4 C#5:2 A#4:2 F#4:4'), dia(cat(LBa.slice(4, 6)), -2, 'D'), dia(LBa[6], -2, 'G'), mel('C#5:4 C#5:4 A#4:4 F#4:4'));
const STAB = rep(mel('D5+D6!:2 .:1 C#5+C#6:2 .:1 C5+C6:2 .:1 B4+B5!:4 .:3 .:8 F5+F6!:2 .:2 B4+B5:2 .:2'), 4); // Costureiro: D C# C B + trítono
const OST = '0 0 3 0 1 0 3 0 2 0 3 0 1 0 2 3';
const OCT = 'r:2 o:2 r:2 o:2 r:2 o:2 r:2 o:2';
const D1 = 'k . h . s . h k k . h . s . h h', TOMS = 't . t . T . t t t . t . T T t .', FILL = 't t t t T T T T s s s s s! s! s! s!';
const beat = { drums: cat(rep(D1, 7), FILL), drums2: rep(TOMS, 8) };

registerSong('w4_chase', {
  bpm: 156, reverb: 0.3, echoSteps: 3, echoFeedback: 0.2, loopFrom: 1,
  instruments: {
    ost: { wave: 'saw', attack: 0.003, decay: 0.1, sustain: 0.3, release: 0.05, vol: 0.08, filter: { freq: 500, env: 1800, envDecay: 0.05, q: 5 }, reverb: 0.1 },
    brass: { wave: 'saw', voices: 2, spread: 10, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.12, vol: 0.055, filter: { freq: 1600, env: 1500, envDecay: 0.08 }, reverb: 0.3 },
    lead: { ...INS.lead, vol: 0.08, duty: 0.25 }, str: { ...INS.str, vol: 0.045 }, low,
    bass: { wave: 'square', attack: 0.004, decay: 0.12, sustain: 0.4, release: 0.05, vol: 0.09, filter: { freq: 600, env: 700, envDecay: 0.05 }, reverb: 0.05 },
    drums: { kit: 'chase', vol: 0.22, reverb: 0.15 },
  },
  patterns: {
    I: { ost: arp('Bm Bm Bm F#', 16, OST, 47, 3), drums: cat('b', R(63)), drums2: cat(rep('t . . . t . . . t . . . t . t .', 2), 't . t . t . t . T . T . T . T T', FILL) },
    A: { ost: arp(PCA, 16, OST, 47, 3), bass: bass(PCA, 16, OCT), brass: STAB, ...beat },
    B: { lead: LB, ost: arp(PCB, 16, OST, 47, 3), bass: bass(PCB, 16, OCT), ...beat },
    A2: { ost: arp(PCA, 16, '0 3 0 1 0 3 0 2 0 3 0 1 3 2 1 0', 47, 3), bass: bass(PCA, 16, OCT), brass: STAB, str: mel('D6:16 C#6:16 C6:16 B5:16 F6:32 B5:32'), ...beat },
    C: { low: mel('D3:16 C#3:16 C3:16 B2:16 F3:32 B2:32'), ost: arp('Bm Bm C C Bm Bm Bdim F#', 16, '0? . 0? . 3? . 0? . 1? . 0? . 2? . 3? .', 47, 3),
      drums: cat(rep('k . . . . . . . k . . . . . . .', 4), rep('k . . . k . . . k . . . k . k .', 3), FILL),
      drums2: cat(rep('t . . . . . . . T . . . . . . .', 4), rep('t . t . T . t . t . t . T . T .', 3), R(16)) },
    B2: { lead: LB, lead2: LBH, ost: arp(PCB, 16, OST, 47, 3), bass: bass(PCB, 16, OCT), ...beat },
    D: { lead: LB, brass: STAB, str: mel('D6:16 C#6:16 C6:16 B5:16 F6:32 B5:32'), ost: arp(PCB, 16, OST, 47, 3), bass: bass(PCB, 16, OCT),
      drums: cat('k+c . h . s . h k k . h . s . h h', rep(D1, 6), FILL), drums2: cat(rep(cat('b', TOMS.slice(2), TOMS), 4)) },
  },
  order: ['I', 'A', 'B', 'A2', 'C', 'B2', 'D'],
});
