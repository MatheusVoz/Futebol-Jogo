// =============================================================================
// audio/music_w5.js — Mundo 5 (Coração da Dimensão: fios dourados gigantes, tear das Tecelãs).
//
// w5_level: épica e misteriosa — 116 bpm, Ré menor / frígio. Coro (saw filtrado c/ vibrato), bateria e
//   tons, baixo em oitavas, arpejos com eco. A: Motivo do Costureiro como "line cliché" (Dm7 Dm6 Bb/D)
//   + trítono = bII frígio (Eb). A2: Tema do Tico em Ré menor (F A Bb A | F E D) CONTRA o motivo no grave.
//   B: virada triunfal para Ré MAIOR (Tema do Tico heroico). C: ponte frígia. Intro + 40 comp. ≈ 91 s.
// w5_calm: o tear das Tecelãs — harpa ondulante + pads; cita a Canção de Ninar (Ré maior) no coro.
// =============================================================================
import { registerSong } from '../../engine/audio.js';
import { INS, mel, cat, rep, tr, dia, pad, arp, bass, TICO, NINAR } from './music_story.js';

const R = (n) => rep('.', n);
const PI = 'Dm Eb Dm Eb';
const PA = 'Dm7:8 Dm6:8 Bb/D:8 Dm:8 Eb Dm Dm7:8 Dm6:8 Bb/D:8 Dm:8 Eb A';
const PA2 = 'Dm Bb Gm A Dm Bb Gm:8 A:8 Dm';
const PB = 'D Bm G A D Bm G:8 A:8 D';
const PC = 'Dm Eb Dm Eb Bb Eb Gm A';
const MOTIF = mel('C5:8 B4:8 Bb4:8 A4:8 Eb5:16 D5:16 C5:8 B4:8 Bb4:8 A4:8 Eb5:16 C#5:16');
const TICO_DM = dia(tr(TICO, 5), -2, 'F'); // Tema do Tico em Ré menor
const COUNTER = mel('C4:8 B3:8 Bb3:8 A3:8 Bb3:8 A3:8 Eb4:16 C4:8 B3:8 Bb3:8 A3:8 Bb3:8 A3:4 G#3:4 A3:16');
const TICO_D = tr(TICO, 2);
const C = mel('F5:8 A5:8 Bb5:16 A5:8 G5:8 F5:16 D5:8 F5:8 G5:16 Bb5:16 A5:8 E5:8');

const ARP = '0 1 2 3 2 1 0 1 2 3 4 3 2 1 2 3';
const OCT = 'r:2 o:2 r:2 o:2 r:2 o:2 r:2 o:2';
const DA = 'k . h . s . h k . k h . s . t T', DB = 'k . h k s . h k . k h k s . h o', F5 = 'k . t t s . t t T T t t s s s! T';
const TOM = 'T? . . . t? . . . T? . . . t? . t? .';

registerSong('w5_level', {
  bpm: 116, reverb: 0.55, echoSteps: 3, echoFeedback: 0.38, loopFrom: 1,
  instruments: {
    choir: { wave: 'saw', voices: 4, spread: 20, attack: 0.8, decay: 0.5, sustain: 0.9, release: 1.2, vol: 0.038, filter: { freq: 1300, q: 3 }, vibrato: { rate: 4.5, depth: 0.12, delay: 0.4 }, reverb: 0.6 },
    brass: { wave: 'saw', voices: 2, spread: 8, attack: 0.05, decay: 0.3, sustain: 0.75, release: 0.3, vol: 0.06, filter: { freq: 1400, env: 1200, envDecay: 0.15 }, reverb: 0.35 },
    lead: { ...INS.lead, vol: 0.1, duty: 0.4 }, str: { ...INS.str, vol: 0.05 },
    bell: { ...INS.bell, vol: 0.05, echo: 0.4 },
    bass: { wave: 'square', attack: 0.004, decay: 0.12, sustain: 0.45, release: 0.05, vol: 0.09, filter: { freq: 650, env: 700, envDecay: 0.05 }, reverb: 0.05 },
    drums: { kit: 'epic', vol: 0.28, reverb: 0.2 },
  },
  patterns: {
    I: { choir: pad(PI, 16, 60, 3), bell: arp(PI, 16, ARP, 62, 3), bass: cat(R(32), bass('Dm Eb', 16, 'r:16')), drums2: cat(rep('T? . . . . . . . T? . . . . . . .', 3), F5) },
    A: { brass: MOTIF, brass2: tr(MOTIF, -12), choir: pad(PA, 16, 60, 4), bell: arp(PA, 16, ARP, 62, 3), bass: bass(PA, 16, OCT), drums: cat(rep(DA, 7), F5), drums2: rep(TOM, 8) },
    A2: { lead: TICO_DM, brass: COUNTER, choir: pad(PA2, 16, 60, 3), bell: arp(PA2, 16, ARP, 62, 3), bass: bass(PA2, 16, OCT), drums: cat('k+c . h . s . h k . k h . s . t T', rep(DB, 6), F5) },
    B: { lead: TICO_D, str: dia(TICO_D, -2, 'D'), choir: pad(PB, 16, 62, 3), bell: arp(PB, 16, ARP, 66, 3), bass: bass(PB, 16, OCT), drums: cat('k+c! . h . s . h k . k h . s . h o', rep(DB, 6), F5) },
    C: { str: C, choir: pad(PC, 16, 57, 3), bell: arp(PC, 16, '0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .', 62, 3), bass: bass(PC, 16, 'r:8 o:8'),
      drums: cat(rep('k . . . . . . . s? . . . . . . .', 4), rep('k . . k . . t . s . . k t . T .', 3), F5), drums2: rep(TOM, 8) },
    B2: { lead: TICO_D, str: dia(TICO_D, -2, 'D'), choir: pad(PB, 16, 69, 3), brass: tr(TICO_D, -12), bell: arp(PB, 16, ARP, 66, 3), bass: bass(PB, 16, OCT),
      drums: cat('k+c! . h . s . h k . k h . s . h o', rep(DB, 6), 'k . t t s . t t T T t t s s c! .') },
  },
  order: ['I', 'A', 'A2', 'B', 'C', 'B2'],
});

// ------------------------------------------------------------ o tear das Tecelãs
const PLD = 'D Bm G A D Bm Em7:6 A7:6 D';
const LOOM = '0 1 2 3 4 3 2 1 0 1 2 1';
registerSong('w5_calm', {
  bpm: 72, reverb: 0.7, echoSteps: 3, echoFeedback: 0.4,
  instruments: {
    harp: { wave: 'triangle', attack: 0.002, decay: 0.5, sustain: 0, release: 0.4, vol: 0.09, filter: { freq: 2400 }, reverb: 0.55, echo: 0.25 },
    choir: { wave: 'saw', voices: 4, spread: 18, attack: 0.6, decay: 0.4, sustain: 0.9, release: 1, vol: 0.045, filter: { freq: 1500, q: 2.5 }, vibrato: { rate: 4.5, depth: 0.15, delay: 0.35 }, reverb: 0.65 },
    pad: { ...INS.pad, vol: 0.032, attack: 1.5, release: 2, filter: { freq: 800 } }, bell: { ...INS.bell, vol: 0.05 },
  },
  patterns: {
    L1: { harp: arp(PLD, 12, LOOM, 55, 3, true), pad: pad(PLD, 12, 62, 3), bell: rep(mel('A5?:24 .:24'), 2) },
    L2: { harp: arp(PLD, 12, LOOM, 55, 3, true), choir: tr(NINAR, 2), pad: pad(PLD, 12, 57, 3) },
  },
  order: ['L1', 'L2'],
});
