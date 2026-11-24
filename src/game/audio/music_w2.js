// =============================================================================
// audio/music_w2.js — Mundo 2 (aquático: banheira-oceano, corais de pelúcia, bolhas).
//
// w2_level: atmosférica, melancólica e bonita — 80 bpm em 6/8 (stepsPerBeat 6 → 12 passos/compasso,
//   cada tempo = semínima pontuada). Dó menor (A) / Mi bemol maior (B). Pads "chorus" (saw 4 vozes),
//   arpejos de sino vítreo com eco, lead senoidal "cantado", sub-grave, percussão leve (gotas = 'p').
//   Intro (4) + A B C A2 B2 (40 comp.) ≈ 66 s; loopFrom pula a intro.
//   A ponte (C) esconde o Tema do Tico em Mi bemol: G Bb C Bb | G F Eb.
// w2_calm: versão esparsa (~64 bpm).
// =============================================================================
import { registerSong } from '../../engine/audio.js';
import { INS, mel, cat, rep, dia, pad, arp, bass } from './music_story.js';

const bars = (a) => a.map((b) => mel(b));
const PI = 'Cm9 Abmaj7 Cm9 Abmaj7';
const PA = 'Cm Ab Eb Bb Cm Ab Fm G';
const PB = 'Eb Bb/D Cm Ab Eb/G Ab Bb Bb';
const PC = 'Abmaj7 Eb/Bb Gm Cm Fm Bb Eb G7';

const WA = bars(['Eb5:4 D5:2 C5:4 G4:2', 'Ab4:6 C5:4 Eb5:2', 'G5:6 F5:4 Eb5:2', 'D5:8 Bb4:4',
  'Eb5:4 D5:2 C5:4 Eb5:2', 'Ab5:6 G5:4 F5:2', 'Ab5:4 G5:2 F5:4 Eb5:2', 'D5:6 B4:6']);
const A = cat(WA);
const B = cat(bars(['Bb4:2 Eb5:2 G5:2 Bb5:6', 'Ab5:4 G5:2 F5:6', 'G5:4 F5:2 Eb5:4 C5:2', 'Eb5:8 .:4',
  'Bb4:2 Eb5:2 G5:2 Bb5:6', 'C6:4 Bb5:2 Ab5:6', 'G5:4 F5:2 Eb5:4 D5:2', 'F5:6 D5:6']));
const C = cat(bars(['G5:2 Bb5:2 C6:4 Bb5:4', 'G5:2 F5:2 Eb5:8', 'Bb5:2 D6:2 C6:4 Bb5:4', 'Eb5:2 D5:2 C5:8',
  'Ab5:4 G5:2 F5:6', 'D5:4 F5:2 Bb5:6', 'G5:6 F5:4 Eb5:2', 'B4:6 D5:4 F5:2']));
// segundas vozes (sino): terças acima no A (último compasso sobre Sol7 escrito à mão), terças abaixo no B
const A_HARM = cat(dia(cat(WA.slice(0, 7)), 2, 'Eb'), mel('F5:6 D5:6'));
const B_HARM = dia(B, -2, 'Eb');

const ARP = '0 . 1 . 2 . 3 . 2 . 1 .';
const ARP2 = '0 . 2 . 3 . 4 . 3 . 2 .';
const BUB = mel('.:3 Eb6 .:2 Bb6 .:5 .:7 G6 C7 .:3');
const DA = 'k? . h? . h? . r? . h? . h? .';
const DBp = 'k? . h? . h? h? k+r? . h? . h? p?';
const DC = 'k? . . . p? . . . . . p? .';

const inst = {
  lead: { wave: 'sine', attack: 0.08, decay: 0.3, sustain: 0.85, release: 0.4, vol: 0.17, vibrato: { rate: 4.5, depth: 0.22, delay: 0.3 }, reverb: 0.5, echo: 0.25 },
  bell: { wave: 'fm', ratio: 3.5, index: 1.2, indexDecay: 0.8, attack: 0.002, decay: 1.6, sustain: 0, release: 1, vol: 0.065, reverb: 0.55, echo: 0.45, pan: 0.2 },
  pad: { wave: 'saw', voices: 4, spread: 22, attack: 1.2, decay: 0.8, sustain: 0.85, release: 1.8, vol: 0.04, filter: { freq: 850 }, reverb: 0.6, pan: -0.1 },
  sub: { ...INS.sub, vol: 0.3 },
  bub: { wave: 'sine', attack: 0.003, decay: 0.07, sustain: 0, release: 0.05, vol: 0.06, glide: 0.05, reverb: 0.4, echo: 0.3 },
  drums: { kit: 'water', vol: 0.26, reverb: 0.35 },
};

registerSong('w2_level', {
  bpm: 80, stepsPerBeat: 6, reverb: 0.7, echoSteps: 3, echoFeedback: 0.4, loopFrom: 1,
  instruments: inst,
  patterns: {
    I: { pad: pad(PI, 12, 60, 4), bell: arp(PI, 12, ARP, 72, 4), bub: rep(BUB, 2), sub: bass(PI, 12, 'r?:12'), drums: rep('. . . . p? . . . . . . .', 4) },
    A: { lead: A, bell: arp(PA, 12, ARP, 72, 3), pad: pad(PA, 12, 60, 4), sub: bass(PA, 12, 'r:8 f:4'), drums: rep(DA, 8) },
    B: { lead: B, bell: arp(PB, 12, ARP2, 72, 3), pad: pad(PB, 12, 62, 4), sub: bass(PB, 12, 'r:6 f:4 o:2'), drums: rep(DBp, 8) },
    C: { lead: C, bell: arp(PC, 12, '0 . . 2 . . 1 . . 3 . .', 72, 4), bub: rep(BUB, 4), pad: pad(PC, 12, 60, 4), sub: bass(PC, 12, 'r:12'), drums: rep(DC, 8) },
    A2: { lead: A, bell2: A_HARM, bell: arp(PA, 12, ARP2, 72, 3), pad: pad(PA, 12, 60, 4), sub: bass(PA, 12, 'r:8 f:4'), drums: rep(DBp, 8) },
    B2: { lead: B, bell2: B_HARM, bell: arp(PB, 12, ARP, 72, 3), pad: pad(PB, 12, 64, 4), sub: bass(PB, 12, 'r:6 f:4 o:2'),
      drums: cat(rep(DBp, 7), 'k? . r? . r? r? r . r r r! .') },
  },
  order: ['I', 'A', 'B', 'C', 'A2', 'B2'],
});

registerSong('w2_calm', {
  bpm: 64, stepsPerBeat: 6, reverb: 0.75, echoSteps: 3, echoFeedback: 0.42,
  instruments: { ...inst, lead: { ...inst.lead, vol: 0.13 }, sub: { ...INS.sub, vol: 0.2 } },
  patterns: {
    A: { lead: A, bell: arp(PA, 12, '0 . . . . . 2 . . 1 . .', 72, 3), pad: pad(PA, 12, 60, 4), sub: bass(PA, 12, 'r:12') },
    C: { lead: C, bell: arp(PC, 12, '0 . . . . . 2 . . 1 . .', 72, 4), bub: rep(BUB, 4), pad: pad(PC, 12, 60, 4), sub: bass(PC, 12, 'r:12') },
  },
  order: ['A', 'C'],
});
