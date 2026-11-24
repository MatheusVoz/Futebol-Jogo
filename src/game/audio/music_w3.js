// =============================================================================
// audio/music_w3.js — Mundo 3 (Cidade dos Relógios: engrenagens, pêndulos, torres de latão).
//
// w3_level: mecânica e acelerada — 136 bpm, Lá menor. Tique-taque ('p' tique / 'r' taque), lead pulse
//   staccato, "cravo" (saw com envelope de filtro) em ostinato de semicolcheias, baixo em oitavas.
//   B cita os carrilhões de Westminster. BRK = o relógio "quebra": as notas se espaçam (1,2,3,4,6,8,16
//   passos) e caem de afinação como uma mola desenrolando, silêncio, catraca de corda e recomeço.
//   C traz o Tema do Tico em Lá menor (C E F E | C B A). Intro + 48 compassos ≈ 92 s; loopFrom pula a intro.
// w3_calm: valsa de loja de relógios (3/4, 96 bpm).
// =============================================================================
import { registerSong } from '../../engine/audio.js';
import { INS, midi, nm, mel, cat, rep, dia, pad, arp, bass } from './music_story.js';

const bars = (a) => cat(a.map((b) => mel(b)));
const R = (n) => rep('.', n);
/** espaça eventos por uma lista de intervalos (o relógio desacelerando) */
const wind = (gaps, f) => cat(gaps.map((g, i) => cat(f(i), R(g - 1))));

const PI = 'Am Am F E', PA = 'Am F G E Am F Dm E', PB = 'C G Am G F G Am E', PC = 'F Am Dm E F C Dm E';
const A = bars(['A5:3 E5:1 .:2 A5:2 B5:2 C6:2 B5:2 A5:2', 'G5:3 F5:1 .:2 E5:2 F5:4 C5:4', 'D5:3 G5:1 .:2 B5:2 D6:2 C6:2 B5:2 G5:2', 'G#5:4 A5:2 B5:2 E5:4 .:4',
  'A5:3 E5:1 .:2 A5:2 B5:2 C6:2 D6:2 E6:2', 'F6:3 E6:1 .:2 D6:2 C6:2 A5:2 C6:4', 'D6:2 C6:2 A5:2 F5:2 D5:2 F5:2 A5:2 D6:2', 'B5:2 G#5:2 E5:2 B4:2 E5:4 .:4']);
const CHIME = mel('E5:4 C5:4 D5:4 G4:4 G4:4 D5:4 E5:4 C5:4 E5:4 D5:4 C5:4 G4:4 G4:4 D5:4 E5:4 C5:4'); // Westminster
const ANSW = bars(['A4:2 C5:2 F5:4 E5:2 C5:2 A4:4', 'B4:2 D5:2 G5:4 F5:2 D5:2 B4:4', 'C5:2 E5:2 A5:4 G5:2 E5:2 C5:2 A4:2', 'B4:2 G#4:2 E4:2 G#4:2 B4:8']);
const C = bars(['C5:2 E5:2 F5:4 E5:8', 'C5:2 B4:2 A4:12', 'D5:2 F5:2 G5:4 F5:8', 'D5:2 C5:2 B4:12',
  'E5:2 G5:2 A5:4 G5:8', 'E5:2 D5:2 C5:12', 'F5:4 A5:4 D6:8', 'B5:4 G#5:4 E5:8']);

const OST = '0 1 2 1 3 1 2 1 0 1 2 1 3 1 2 1', OST2 = '3 2 1 0 1 2 3 4 3 2 1 0 1 2 3 2';
const OCT = 'r:2 o:2 r:2 o:2 r:2 o:2 r:2 o:2';
const TT = 'p . r . p . r . p . r . p . r .';
const DA = 'k+p . r . s+p . r . k+p k r . s+p . r p?';
const DA2 = 'k+p . r p s+p . r . k+p k r p s+p . r+o .';
const DF = 'k+p . r . s+p . r . s s s s t t T T';
// relógio quebrando: 16x1, 8x2, ... até parar (112 passos) + 1 compasso de catraca
const GAPS = [...Array(16).fill(1), ...Array(8).fill(2), 3, 3, 3, 3, 4, 4, 4, 4, 4, 6, 6, 4, 8, 8, 16];

registerSong('w3_level', {
  bpm: 136, reverb: 0.3, echoSteps: 3, echoFeedback: 0.2, loopFrom: 1,
  instruments: {
    lead: { wave: 'pulse', duty: 0.25, attack: 0.003, decay: 0.08, sustain: 0.35, release: 0.04, vol: 0.09, gate: 0.55, filter: { freq: 2800 }, reverb: 0.15, echo: 0.12, pan: 0.1 },
    harp: { wave: 'saw', attack: 0.002, decay: 0.16, sustain: 0.05, release: 0.1, vol: 0.06, filter: { freq: 900, env: 3800, envDecay: 0.05, q: 1.5 }, reverb: 0.2, pan: -0.25 },
    bell: { ...INS.bell, vol: 0.08 }, str: { ...INS.str, vol: 0.05 }, pad: { ...INS.pad, vol: 0.035 },
    bass: { wave: 'square', attack: 0.004, decay: 0.12, sustain: 0.4, release: 0.05, vol: 0.1, filter: { freq: 600, env: 700, envDecay: 0.05 }, reverb: 0.05 },
    drums: { kit: 'clock', vol: 0.27, reverb: 0.1 },
  },
  patterns: {
    I: { harp: arp(PI, 16, OST, 60, 3), bass: cat(R(32), bass('F E', 16, OCT)), drums: cat(rep(TT, 2), 'k+p . r . p . r . k+p . r . p . r .', DF) },
    A: { lead: A, harp: arp(PA, 16, OST, 60, 3), bass: bass(PA, 16, OCT), pad: pad(PA, 16, 57, 3), drums: cat(rep(DA, 7), DF) },
    B: { bell: cat(CHIME, R(64)), lead: cat(R(64), ANSW), harp: arp(PB, 16, OST, 60, 3), bass: bass(PB, 16, 'r:4 o:4 r:4 o:4'), pad: pad(PB, 16, 57, 3),
      drums: cat(rep('k+p . r . x+p . r . k+p . r . x+p . r .', 7), DF) },
    A2: { lead: A, bell: dia(A, -7), harp: arp(PA, 16, OST2, 60, 3), bass: bass(PA, 16, OCT), pad: pad(PA, 16, 60, 3), drums: cat('k+p+c . r p s+p . r . k+p k r p s+p . r+o .', rep(DA2, 6), DF) },
    BRK: { harp: cat(wind(GAPS, (i) => nm(midi(['E5', 'C5', 'A4', 'C5'][i % 4]) - Math.floor(i / 8))), mel('A3 A#3 B3 C4 C#4 D4 D#4 E4 F4 F#4 G4 G#4 A4 A#4 B4 C5')),
      bass: cat(bass('Am Am', 16, OCT), mel('A2:16'), R(64), mel('.:12 E2:4')), pad: cat(pad('Am:48', 48, 57, 3), R(80)), bell: cat(R(96), mel('A4:16'), R(16)),
      drums: cat(wind(GAPS, (i) => (i % 2 ? 'r' : 'p')), 'r? r? r? r? r? r? r? r? r r r r r! r! r! r!') },
    C: { str: C, harp: arp(PC, 16, '0 . 1 . 2 . 3 . 2 . 1 . 2 . 1 .', 60, 3), bass: bass(PC, 16, 'r:4 .:4 f:4 .:4'), pad: pad(PC, 16, 57, 3),
      drums: cat(rep('k+p . . . r . . . s+p . . . r . . .', 7), DF) },
    A3: { lead: A, harp: arp(PA, 16, OST, 60, 3), harp2: dia(A, -2), bass: bass(PA, 16, OCT), pad: pad(PA, 16, 57, 3), drums: cat('k+p+c . r . s+p . r . k+p k r . s+p . r p?', rep(DA2, 6), DF) },
  },
  order: ['I', 'A', 'B', 'A2', 'BRK', 'C', 'A3'],
});

// ------------------------------------------------------------ valsa da loja de relógios
const PW = 'Am E7 Am Am Dm Am E7 Am C G7 C Am Dm Am E7 Am';
const W = bars(['A4:4 C5:4 E5:4', 'D5:8 B4:4', 'C5:4 E5:4 A5:4', 'G#5:8 A5:4', 'F5:4 A5:4 D6:4', 'C6:8 A5:4', 'B5:4 D6:4 G#5:4', 'A5:12',
  'E5:4 G5:4 C6:4', 'D6:8 B5:4', 'C6:4 G5:4 E5:4', 'A5:8 E5:4', 'C5:2 E5:2 F5:4 E5:4', 'C5:2 B4:2 A4:8', 'B4:4 D5:4 G#4:4', 'A4:12']);
const waltz = { harp: pad(PW, 12, 62, 3, '. . . . x? . . . x? . . .'), bass: bass(PW, 12, 'r:4 .:8'), drums: rep('p . . . r? . . . r? . . .', 16) };
registerSong('w3_calm', {
  bpm: 96, reverb: 0.4, echoSteps: 3, echoFeedback: 0.25,
  instruments: { box: { ...INS.box, vol: 0.14 }, flute: { ...INS.flute, vol: 0.13 },
    harp: { wave: 'saw', attack: 0.002, decay: 0.2, sustain: 0.05, release: 0.12, vol: 0.035, filter: { freq: 800, env: 2500, envDecay: 0.06 }, reverb: 0.25 },
    bass: { ...INS.bass, vol: 0.22 }, drums: { kit: 'clock', vol: 0.22, reverb: 0.15 } },
  patterns: {
    W: { box: W, ...waltz },
    W2: { flute: W, box: arp(PW, 12, '0? . 1? . 2? . 1? . 2? . 1? .', 64, 3, true), ...waltz },
  },
  order: ['W', 'W2'],
});
