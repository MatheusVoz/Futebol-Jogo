// =============================================================================
// audio/music_w1.js — Mundo 1 (floresta de retalhos, névoa roxa, cogumelos luminosos).
//
// w1_level: curiosa, misteriosa e aconchegante — 96 bpm, Ré dórico (A, ponte) / Fá maior (B).
//   Caixinha de música (fm), lead "plucky" (pulse com envelope de filtro), flauta senoidal no B,
//   pad quente, baixo redondo, bateria de vassourinha. Intro (4 comp.) + A A2 B C A3 (40 comp.) ≈ 110 s;
//   loopFrom pula a intro. A ponte (C) esconde o Tema do Tico em Ré dórico: F A B A | F E D.
// w1_calm: versão esparsa na caixinha de música (~70 bpm).
// Kit de composição (mel/arp/pad/bass/dia...) vem de music_story.js.
// =============================================================================
import { registerSong } from '../../engine/audio.js';
import { INS, mel, cat, rep, dia, pad, arp, bass } from './music_story.js';

const bars = (a) => a.map((b) => mel(b));
const PI = 'Dm G/D Dm A7sus4:8 A7:8';
const PA = 'Dm G Dm C Dm G Bb A7';
const PB = 'F C/E Dm Bb F C Bb C';
const PC = 'Dm G Em Am Dm G C A7';

// A: tema curioso (Ré dórico — o Si natural do acorde de Sol dá a cor de "mistério")
const WA = bars(['A4:2 D5:2 E5:2 F5:6 E5:2 D5:2', 'B4:2 D5:2 E5:2 G5:6 F5:2 E5:2', 'F5:2 A5:2 G5:2 F5:2 E5:2 D5:2 E5:4', 'E5:6 C5:2 G4:8',
  'A4:2 D5:2 E5:2 F5:6 A5:2 G5:2', 'B5:6 A5:2 G5:4 D5:4', 'F5:4 D5:2 F5:2 Bb5:4 A5:2 G5:2', 'A5:6 G5:1 F5:1 E5:4 C#5:4']);
const A = cat(WA);
// segunda voz (terças abaixo; compasso 7 em Fá por causa do Si bemol, 8 escrito à mão sobre Lá7)
const A_HARM = cat(dia(cat(WA.slice(0, 6)), -2, 'C'), dia(WA[6], -2, 'F'), mel('C#5:6 E5:1 D5:1 C#5:4 A4:4'));
// B: Fá maior, lírico, na flauta
const B = cat(bars(['C5:4 F5:4 A5:6 G5:2', 'G5:8 E5:4 C5:4', 'F5:4 A5:4 D6:6 C6:2', 'Bb5:8 A5:4 F5:4',
  'A5:4 C6:4 A5:6 G5:2', 'G5:4 E5:4 C5:4 E5:4', 'D5:6 F5:2 Bb5:6 A5:2', 'G5:12 .:4']));
// C: ponte com o Tema do Tico escondido (graus 3 5 6 5 | 3 2 1 em Ré dórico)
const C = cat(bars(['F5:2 A5:2 B5:4 A5:8', 'F5:2 E5:2 D5:8 .:4', 'G5:2 B5:2 C6:4 B5:8', 'G5:2 F5:2 E5:8 .:4',
  'A5:4 F5:4 D5:4 F5:4', 'B5:4 G5:4 D5:4 G5:4', 'C6:6 B5:2 G5:4 E5:4', 'A5:8 C#5:4 E5:4']));

const DB = 'k . h? h? s? . h? . k? . h? k? s? . h? h?';
const DB2 = 'k . h? h? s . h? . k? . h? k? s? . o? .';
const DBF = 'k . h? h? s? . h? . s? . s? s? s s t T';
const DOT = '0 . . 1? . . 2? . . 1? . . 3? . . .'; // arpejo pontuado da caixinha
const EIGHT = '0? . 1? . 2? . 1? . 0? . 1? . 2? . 3? .';
const BASSA = 'r:3 .:1 r:2 f:2 .:2 f:2 o:2 f:2';

registerSong('w1_level', {
  bpm: 96, swing: 0.1, reverb: 0.45, echoSteps: 3, echoFeedback: 0.3, loopFrom: 1,
  instruments: {
    box: { ...INS.box, octave: 1, vol: 0.11 },
    lead: { ...INS.pluck, pan: -0.15 },
    flute: { ...INS.flute, pan: 0.1 },
    pad: { ...INS.pad, vol: 0.042, filter: { freq: 900 } },
    bass: { ...INS.bass, vol: 0.27 },
    drums: { kit: 'brush', vol: 0.3, reverb: 0.15, snareTone: 3200 },
  },
  patterns: {
    I: { box: arp(PI, 16, DOT, 67, 4), pad: pad(PI, 16, 57, 3), bass: bass(PI, 16, 'r?:16'),
      drums: cat(rep('.', 48), 'h? . h? . h? . h? h? s? . s? . s? s? s s') },
    A: { lead: A, box: arp(PA, 16, DOT, 67, 3), pad: pad(PA, 16, 57, 3), bass: bass(PA, 16, BASSA), drums: cat(rep(DB, 7), DBF) },
    A2: { lead: A, box: A_HARM, pad: pad(PA, 16, 57, 3), bass: bass(PA, 16, BASSA), drums: cat(rep(DB2, 7), DBF) },
    B: { flute: B, box: arp(PB, 16, EIGHT, 67, 3), lead: pad(PB, 16, 62, 3, '. . x? . . . x? . . . x? . . . x? .'),
      pad: pad(PB, 16, 57, 3), bass: bass(PB, 16, 'r:8 f:4 o:4'), drums: cat(rep('k . h? . . . h? . s? . h? . . . h? .', 7), DBF) },
    C: { flute: C, box: arp(PC, 16, DOT, 67, 3), pad: pad(PC, 16, 57, 3), bass: bass(PC, 16, 'r:8 .:4 f:4'),
      drums: cat(rep('k? . . . r? . . . . . r? . t? . . .', 7), 'k? . . . r? . . . t? . t? . T? . T .') },
    A3: { lead: A, flute: A_HARM, box: arp(PA, 16, EIGHT, 67, 3),
      pad: pad(PA, 16, 57, 3), bass: bass(PA, 16, 'r:2 r:2 o:2 r:2 f:2 r:2 o:2 f:2'), drums: cat('k+c . h? h? s . h? . k? . h? k? s? . o? .', rep(DB2, 6), DBF) },
  },
  order: ['I', 'A', 'A2', 'B', 'C', 'A3'],
});

registerSong('w1_calm', {
  bpm: 70, swing: 0.08, reverb: 0.55, echoSteps: 3, echoFeedback: 0.32,
  instruments: { box: { ...INS.box, vol: 0.15 }, pad: { ...INS.pad, vol: 0.035, attack: 1.2, release: 1.6, filter: { freq: 800 } }, sub: { ...INS.sub, vol: 0.18 } },
  patterns: {
    A: { box: A, box2: bass(PA, 16, 'r?:8 f?:8', 3), pad: pad(PA, 16, 57, 3), sub: bass(PA, 16, 'r:16') },
    C: { box: C, box2: arp(PC, 16, '0? . . . . . 2? . . . 1? . . . . .', 55, 3, true), pad: pad(PC, 16, 57, 3), sub: bass(PC, 16, 'r:16') },
  },
  order: ['A', 'C'],
});
