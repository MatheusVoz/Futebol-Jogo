// =============================================================================
// cutscenes/ending.js — ESCOLHA FINAL e os DOIS FINAIS
//
//   'ending_choice' (dentro da fase w5_6, quando o Costureiro chega a 0 PV):
//       o Costureiro caído; o Tico toca o fio e VÊ a memória (1968, tempestade:
//       Celeste menina perde o boneco Fiapo). Revelação: o Costureiro É o Fiapo.
//       cs.choice('O que o Tico vai fazer?', ['Costurar o coração', 'Cortar o fio'])
//       → reação curta na fase → marca o save (gameCleared, ending, fase concluída)
//       → cena própria 'ending_mend' ou 'ending_cut' → créditos.
//   'ending_mend' (final verdadeiro): Vó Celeste velhinha costurando o Tico ("Eu nunca
//       te esqueci, Fiapo."), o Costureiro chora fios e vira bonequinho, os dois caem
//       em casa; manhã no quarto da Lia: ela acorda abraçada ao Tico, um boneco de pano
//       antigo aos pés da cama; a mãe na porta. Pós-créditos: costuras douradas no escuro.
//   'ending_cut': o Costureiro vira pó ("...Celeste..."); Tico cai em casa com as costuras
//       CINZENTAS; Lia o acha no chão. Um fio dourado sai pela janela. Agridoce.
// Palco 'quarto_manha' (coords: chão em y = 40), música 'ending'.
// =============================================================================
import { registerCutscene, makeScene } from '../registry.js';
import { registerStage } from './director.js';
import { drawSprite, animFrame } from '../../engine/sprites.js';
import { save } from '../../engine/save.js';
import { game } from '../../engine/game.js';
import { audio } from '../../engine/audio.js';
import { lerp } from '../../engine/util.js';

const Rn = Math.round;
const PATCH = ['#22142e', '#2a1a3a', '#3a2452', '#4a2e6a'], THREAD = '#a855ff', GOLD = '#ffd23f';

// ----------------------------------------------------------------- utilidades
function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); ctx.fillRect(Rn(cx - w), Rn(cy + y), w * 2 + 1, 1); }
}
function markCleared(ending) {
  const P = save.data.progress;
  P.gameCleared = true;
  P.ending = ending;
  P.levels.w5_6 = { ...(P.levels.w5_6 || {}), done: true };
  save.commit();
}
function toCredits() {
  const c = makeScene('credits');
  if (c) game.scenes.go(c, {}, { transition: 'fade', time: 1.2 });
}

/** Boneco de pano Fiapo (pequeno, fofo): retalhos claros, olhos de botão desparelhados. */
function drawRagDoll(ctx, x, y, s = 1, grey = false) {
  const c = grey ? ['#6a6a70', '#8a8a90', '#a0a0a8'] : ['#a6c2e2', '#e0c8a8', '#c8a080'];
  x = Rn(x); y = Rn(y);
  ctx.fillStyle = '#2a3048';
  ctx.fillRect(x - 5 * s, y - 9 * s, 10 * s, 10 * s); ctx.fillRect(x - 4 * s, y - 17 * s, 8 * s, 8 * s);
  ctx.fillStyle = c[0]; ctx.fillRect(x - 4 * s, y - 8 * s, 8 * s, 8 * s);
  ctx.fillStyle = c[1]; ctx.fillRect(x - 3 * s, y - 16 * s, 6 * s, 6 * s);
  ctx.fillStyle = '#7a2a9a'; ctx.fillRect(x - 2 * s, y - 14 * s, 2 * s, 2 * s);
  ctx.fillStyle = '#c8a040'; ctx.fillRect(x + 1 * s, y - 14 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#ffe8b0'; for (let i = -3; i < 4; i += 2) ctx.fillRect(x + i * s, y - 5 * s, s, s);
  ctx.fillStyle = c[2]; ctx.fillRect(x - 6 * s, y - 7 * s, 2 * s, 5 * s); ctx.fillRect(x + 4 * s, y - 7 * s, 2 * s, 5 * s);
}

// =============================================================================
// PALCO: quarto da Lia de manhã (chão y = 40)
// =============================================================================
registerStage('quarto_manha', (ctx, cs, t) => {
  const S = cs.S || {};
  const r = cs.viewRect();
  const x0 = Math.floor(r.x) - 2, x1 = Math.ceil(r.x + r.w) + 2, y0 = Math.floor(r.y) - 2, y1 = Math.ceil(r.y + r.h) + 2;
  if (S.mode === 'dark') { ctx.fillStyle = '#05030a'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); return; }
  if (S.mode === 'void') {   // queda pelo túnel de fios
    ctx.fillStyle = '#0b0716'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let i = 0; i < 40; i++) {
      const x = x0 + ((i * 53) % (x1 - x0)), y = y1 - ((t * (80 + (i % 5) * 30) + i * 37) % (y1 - y0));
      ctx.fillStyle = i % 3 ? (S.grey ? '#6a6a70' : '#ffd23f') : THREAD; ctx.fillRect(x, Rn(y), 1, 6 + (i % 4) * 3);
    }
    return;
  }
  const grey = !!S.grey, warm = S.light ?? 1;
  // parede creme com listras e luz da manhã
  ctx.fillStyle = grey ? '#b8b0b8' : '#e8d8c0'; ctx.fillRect(x0, y0, x1 - x0, 42 - y0);
  ctx.fillStyle = grey ? '#aaa2aa' : '#dcc8ae';
  for (let x = Math.floor(x0 / 16) * 16; x < x1; x += 16) ctx.fillRect(x, y0, 6, 42 - y0);
  // janela com céu de manhã
  ctx.fillStyle = '#6a4a3a'; ctx.fillRect(-150, -92, 78, 66);
  ctx.fillStyle = grey ? '#a8b8c8' : '#9fd8ff'; ctx.fillRect(-146, -88, 70, 58);
  ctx.fillStyle = grey ? '#c8d0d8' : '#c8ecff'; ctx.fillRect(-146, -60, 70, 30);
  fillEllipse(ctx, -96, -74, 8, 8, grey ? '#e8e8e0' : '#fff2a0');
  for (let i = 0; i < 3; i++) fillEllipse(ctx, -136 + i * 24 + ((t * 3) % 10), -50 + (i % 2) * 6, 9, 3, '#ffffff');
  ctx.fillStyle = '#6a4a3a'; ctx.fillRect(-112, -88, 2, 58); ctx.fillRect(-146, -60, 70, 2);
  ctx.fillStyle = '#e07a9a'; ctx.fillRect(-158, -96, 12, 74); ctx.fillRect(-76, -96, 12, 74);
  ctx.fillStyle = '#f0a0b8'; ctx.fillRect(-156, -96, 3, 74); ctx.fillRect(-74, -96, 3, 74);
  // feixe de sol
  ctx.fillStyle = `rgba(255,240,180,${0.12 * warm})`;
  ctx.beginPath(); ctx.moveTo(-146, -30); ctx.lineTo(-76, -30); ctx.lineTo(10, 42); ctx.lineTo(-100, 42); ctx.fill();
  // porta (a mãe aparece aqui)
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(196, -70, 44, 112);
  ctx.fillStyle = S.doorOpen ? '#f8ecd0' : '#a06a44'; ctx.fillRect(200, -66, 36, 108);
  if (!S.doorOpen) { ctx.fillStyle = GOLD; ctx.fillRect(204, -8, 3, 3); }
  // rodapé e assoalho
  ctx.fillStyle = '#8a5a4a'; ctx.fillRect(x0, 36, x1 - x0, 6);
  ctx.fillStyle = '#b07a5a'; ctx.fillRect(x0, 42, x1 - x0, y1 - 42);
  ctx.fillStyle = '#9a6a4a';
  for (let y = 48; y < y1; y += 8) ctx.fillRect(x0, y, x1 - x0, 1);
  // desenho na geladeira... na parede: Lia, vó e Tico de mãos dadas
  ctx.fillStyle = '#ffffff'; ctx.fillRect(-40, -70, 30, 22);
  ctx.fillStyle = '#e04a6a'; ctx.fillRect(-36, -62, 3, 8); ctx.fillStyle = '#a878d8'; ctx.fillRect(-28, -64, 3, 10); ctx.fillStyle = '#3fc7c0'; ctx.fillRect(-20, -60, 5, 6);
  ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-35, -58, 15, 1);
  // cama com colcha de retalhos
  ctx.fillStyle = '#6a3a2a'; ctx.fillRect(40, -6, 8, 48); ctx.fillRect(160, 8, 6, 34);
  ctx.fillStyle = '#f8f0e0'; ctx.fillRect(48, 2, 30, 12);
  const cols = grey ? ['#9a8a90', '#7a8aa0', '#b0a880', '#8aa08a'] : ['#c8506a', '#4a7fe0', '#ffd23f', '#6fbf6f'];
  for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % 4]; ctx.fillRect(48 + i * 19, 12, 19, 18); }
  ctx.fillStyle = '#ffffff55'; for (let x = 50; x < 162; x += 4) ctx.fillRect(x, 13, 2, 1);
  ctx.fillStyle = '#3a2020'; ctx.fillRect(48, 30, 116, 2);
  if (S.lia) drawSprite(ctx, 'cs_lia', S.lia, animFrame('cs_lia', S.lia, t), 52, -6);
});

// =============================================================================
// ESCOLHA (dentro da fase)
// =============================================================================
/** Painel de memória: 1968, tempestade, Celeste menina perde o Fiapo. */
function memoryPanel(cs, L) {
  const cam = L.camera;
  return cs.actor({
    z: 90, alpha: 0,
    draw(ctx, a) {
      const cx = Rn(cam.cx), cy = Rn(cam.cy - 10), w = 240, h = 120, t = cs.time;
      const x0 = cx - w / 2, y0 = cy - h / 2;
      ctx.save(); ctx.globalAlpha *= a.alpha;
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
      ctx.fillStyle = '#2a2234'; ctx.fillRect(x0, y0, w, h);
      // casa e cerca sob a chuva, em sépia
      ctx.fillStyle = '#4a3e4a'; ctx.fillRect(x0 + 14, y0 + 50, 54, 50); ctx.fillStyle = '#3a3040';
      for (let i = 0; i < 27; i++) ctx.fillRect(x0 + 10 + i, y0 + 50 - Math.min(i, 27 - i) * 0.9, 34 - i, 1);
      ctx.fillStyle = '#f0c870'; ctx.fillRect(x0 + 30, y0 + 66, 10, 10);
      ctx.fillStyle = '#5a4a50'; ctx.fillRect(x0, y0 + 100, w, 20);
      // relâmpago
      if (Math.sin(t * 3.1) > 0.97) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0, y0, w, h); }
      // menina Celeste (vestidinho, tranças) estendendo os braços
      const gx = x0 + 110;
      ctx.fillStyle = '#c86a7a'; ctx.fillRect(gx - 5, y0 + 84, 10, 14);
      ctx.fillStyle = '#f0c8a8'; fillEllipse(ctx, gx, y0 + 78, 5, 5, '#f0c8a8');
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(gx - 6, y0 + 74, 12, 3); ctx.fillRect(gx - 7, y0 + 77, 2, 6); ctx.fillRect(gx + 5, y0 + 77, 2, 6);
      ctx.fillStyle = '#f0c8a8'; ctx.fillRect(gx + 5, y0 + 84, 8, 2); ctx.fillRect(gx + 5, y0 + 88, 7, 2);
      ctx.fillRect(gx - 4, y0 + 98, 2, 4); ctx.fillRect(gx + 2, y0 + 98, 2, 4);
      // o Fiapo voando com o vento
      const k = (t * 0.35) % 1;
      drawRagDoll(ctx, lerp(gx + 30, x0 + w - 14, k), lerp(y0 + 80, y0 + 18, k) + Math.sin(t * 6) * 3, 1);
      // chuva
      ctx.fillStyle = 'rgba(180,190,220,0.6)';
      for (let i = 0; i < 50; i++) { const rx = x0 + ((i * 37 + t * 60) % w), ry = y0 + ((i * 23 + t * 200) % h); ctx.fillRect(Rn(rx), Rn(ry), 1, 4); }
      ctx.restore();
    },
  });
}

registerCutscene('ending_choice', {
  run: function* (cs) {
    const L = cs.level, p = cs.player, b = cs.params.boss || L._tailor;
    const bx = b ? b.cx : p.cx + 40;
    yield 0.6;
    yield* cs.walk(p, bx + (p.cx < bx ? -34 : 34), 70);
    cs.face(p, p.cx < bx ? 'right' : 'left');
    yield 0.4;
    yield* cs.say([
      { who: 'costureiro', expr: 'sad', text: 'Por que... você luta... tanto... por ela?' },
      { who: 'tico', expr: 'determined', text: 'Porque ela me ama. E eu amo ela. É simples.' },
      { who: 'costureiro', expr: 'sad', text: 'Amor... esquece. Celeste... esqueceu.' },
      { who: 'tico', expr: 'surprised', text: 'Celeste? A Vó da Lia? Como você sabe esse nome?' },
    ]);
    // o fio do peito dele encosta no fio dourado do Tico: memória
    cs.sfx('magic_hum'); cs.flash('#ffd23f', 0.4);
    const mem = memoryPanel(cs, L);
    yield* cs.fade(mem, 1, 0.8);
    cs.sfx('thunder', { vol: 0.5 });
    yield* cs.say([
      { who: 'narrador', text: '1968. Uma noite de tempestade.' },
      { who: 'narrador', text: 'Uma menina corre na chuva atrás do seu boneco de pano, levado pelo vento.' },
      { who: 'narrador', text: '"Fiapo! FIAPO! Volta!" — gritava a pequena Celeste.' },
    ]);
    yield* cs.fade(mem, 0, 0.6);
    yield* cs.say([
      { who: 'tico', expr: 'sad', text: 'Fiapo... Você é o Fiapo. O boneco da Vó Celeste.' },
      { who: 'costureiro', expr: 'sad', text: 'Eu caí... aqui. Esperei. Anos. Ninguém... veio.' },
      { who: 'tico', expr: 'sad', text: 'A minha linha dourada... veio do carretel dela. O mesmo que costurou você.' },
      { who: 'costureiro', expr: 'neutral', text: 'Então... termine. Corte... ou costure. O fio... é seu.' },
    ]);
    const pick = yield* cs.choice('O que o Tico vai fazer?', ['Costurar o coração', 'Cortar o fio']);
    const mend = pick === 0;
    markCleared(mend ? 'mend' : 'cut');
    if (mend) {
      yield* cs.say([{ who: 'tico', expr: 'determined', text: 'Eu sei costurar. Mais ou menos. Fica quietinho, Fiapo.' }]);
      p.castT = 2.4; cs.sfx('stitch_cast');
      for (let i = 0; i < 4; i++) { cs.particles('sparkle', bx, b ? b.y + 30 : p.cy, 8); cs.sfx('stitch_connect', { pitch: 1 + i * 0.15 }); yield 0.45; }
      cs.flash('#fff6d8', 0.6);
    } else {
      yield* cs.say([{ who: 'tico', expr: 'sad', text: 'Desculpa... Eu preciso voltar pra casa.' }]);
      cs.sfx('thread_snap'); cs.shake(0.4);
      cs.particles('smoke', bx, b ? b.cy : p.cy, 16);
      if (b) b.alpha = 0.4;
      yield* cs.say([{ who: 'costureiro', expr: 'sad', text: '...Celeste...' }]);
      if (b) b.alpha = 0;
    }
    yield* cs.fadeOut(1.2, mend ? '#fff6e0' : '#000000');
    const sc = makeScene('cutscene', mend ? 'ending_mend' : 'ending_cut', { next: () => toCredits() });
    if (sc) game.scenes.go(sc, {}, { transition: 'none' });
  },
});

// =============================================================================
// FINAL VERDADEIRO — Costurar o coração
// =============================================================================
registerCutscene('ending_mend', {
  stage: 'quarto_manha', music: 'ending',
  run: function* (cs) {
    cs.S = { mode: 'void', lia: null, doorOpen: false };
    cs.cam.y = -10; cs.cam.x = 40;
    // memória: Celeste velhinha costurando o Tico
    yield* cs.fadeIn(1.0);
    const tico = cs.actor({ sprite: 'tico', anim: 'fall', x: -20, y: -40, z: 5 });
    const doll = cs.actor({ x: 24, y: -60, z: 5, scale: 1, draw: (ctx, a) => {
      if (a.dark > 0) {   // o Costureiro encolhendo até virar bonequinho
        const h = Rn(lerp(14, 60, a.dark)), w = Rn(lerp(8, 26, a.dark));
        ctx.fillStyle = PATCH[1]; ctx.fillRect(Rn(a.x - w / 2), Rn(a.y - h), w, h);
        fillEllipse(ctx, a.x, a.y - h, w / 2 + 2, w / 2 + 2, PATCH[2]);
        ctx.fillStyle = THREAD; for (let i = 0; i < 5; i++) ctx.fillRect(Rn(a.x - w / 2 + ((i * 7 + cs.time * 30) % w)), Rn(a.y - h / 2 + i * 3 + ((cs.time * 40) % 10)), 1, 3);
      } else drawRagDoll(ctx, a.x, a.y, 1);
    } });
    doll.dark = 1;
    yield* cs.say([
      { who: 'vo_celeste', expr: 'happy', text: 'Pronto, dinossaurinho. Linha dourada do carretel antigo... a mais forte que eu tenho.' },
      { who: 'vo_celeste', expr: 'sad', text: 'Sabe... eu nunca te esqueci, Fiapo. Nem por um dia.' },
    ]);
    cs.sfx('magic_hum');
    yield* cs.say([{ who: 'costureiro', expr: 'sad', text: '...Ela... lembrava. Ela... lembrava de mim.' }]);
    for (let i = 0; i < 20; i++) { doll.dark = Math.max(0, 1 - i / 19); cs.particles('sparkle', doll.x, doll.y - 20, 1); yield 0.08; }
    doll.dark = 0;
    yield* cs.say([{ who: 'fiapo', expr: 'happy', text: 'Obrigado... Tico. Me leva... pra casa?' }]);
    cs.sfx('portal');
    yield* cs.parallel(cs.move(tico, -20, 30, 1.6), cs.move(doll, 24, 30, 1.6));
    yield* cs.fadeOut(0.8, '#fff6e0');
    // manhã no quarto
    cs.S.mode = 'room'; cs.S.lia = 'sleep';
    tico.x = 96; tico.y = 13; cs.anim(tico, 'sleep');
    doll.x = 150; doll.y = 14;
    cs.sfx('page_turn');
    yield* cs.fadeIn(1.4);
    yield* cs.caption('Na manhã seguinte...', 2.2);
    yield 0.6;
    cs.S.lia = 'stir'; yield 0.8;
    cs.S.lia = 'arm_hug';
    yield* cs.say([
      { who: 'lia', expr: 'sleepy', text: 'Tico... Sonhei que você foi numa aventura enorme.' },
      { who: 'lia', expr: 'surprised', text: 'Ué... e esse bonequinho aqui no pé da cama?' },
    ]);
    cs.S.doorOpen = true; cs.sfx('door_creak');
    yield 0.5;
    yield* cs.say([
      { who: 'narrador', text: 'A mãe, na porta: "Esse... era o boneco da sua avó. Onde você achou?"' },
      { who: 'lia', expr: 'happy', text: 'Não sei! Mas agora ele mora com a gente. Né, Tico?' },
    ]);
    cs.particles('stars_burst', 110, 0, 10, { colors: [GOLD, '#ffffff', '#ff9ad8'] });
    cs.sfx('secret_soft');
    yield 0.8;
    // Tico pisca
    cs.anim(tico, 'idle'); yield 0.25; cs.anim(tico, 'sleep'); yield 0.8;
    yield* cs.caption('E nenhum brinquedo amado é esquecido de verdade.', 3);
    // pós-créditos: as costuras douradas brilham no escuro
    yield* cs.fadeOut(1.4, '#05030a');
    const glow = cs.actor({ x: tico.x, y: tico.y - 8, z: 99, alpha: 0, draw: (ctx, a) => {
      ctx.save(); ctx.globalAlpha *= a.alpha;
      for (let i = 0; i < 9; i++) { const u = i / 8; ctx.fillStyle = i % 2 ? GOLD : '#fff3a0'; ctx.fillRect(Rn(a.x - 10 + u * 20), Rn(a.y + Math.sin(u * 3) * 4), 2, 1); }
      ctx.restore();
    } });
    cs.S.mode = 'dark'; cs.S.lia = null; tico.alpha = 0; doll.alpha = 0;
    yield* cs.fadeIn(0.6);
    yield* cs.fade(glow, 1, 1.2);
    cs.sfx('magic_hum');
    yield 1.6;
    markCleared('mend');
  },
});

// =============================================================================
// FINAL — Cortar o fio
// =============================================================================
registerCutscene('ending_cut', {
  stage: 'quarto_manha', music: 'ending',
  run: function* (cs) {
    cs.S = { mode: 'void', grey: true, lia: null, light: 0.5 };
    cs.cam.y = -10; cs.cam.x = 40;
    yield* cs.fadeIn(1.0);
    const tico = cs.actor({ sprite: 'tico', anim: 'fall', x: -20, y: -60, z: 5 });
    yield* cs.caption('A costura entre os mundos se fechou com um estalo.', 2.6);
    cs.sfx('thread_snap'); cs.shake(0.5);
    yield* cs.move(tico, -20, 30, 1.4);
    yield* cs.fadeOut(0.6, '#000000');
    cs.S.mode = 'room'; cs.S.lia = null;
    tico.x = 20; tico.y = 40; cs.anim(tico, 'sleep'); tico.variant = '#8a8a92';
    yield* cs.fadeIn(1.2);
    yield* cs.caption('Suas costuras douradas... agora eram cinzentas.', 2.6);
    yield 0.5;
    cs.S.lia = 'arm_reach';
    yield* cs.say([
      { who: 'lia', expr: 'surprised', text: 'Tico? Você caiu da cama?' },
      { who: 'lia', expr: 'happy', text: 'Tudo bem. Eu te protejo. Sempre.' },
    ]);
    cs.S.lia = 'arm_hug'; tico.alpha = 0;
    yield 0.6;
    // um único fio dourado sai pela janela
    const thread = cs.actor({ x: 100, y: 10, z: 9, draw: (ctx, a) => {
      for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? GOLD : '#fff3a0'; ctx.fillRect(Rn(a.x + i * 2), Rn(a.y + Math.sin(cs.time * 4 + i * 0.7) * 2), 2, 1); }
    } });
    cs.sfx('magic_hum', { pitch: 0.7 });
    yield* cs.move(thread, -110, -60, 3.2);
    yield* cs.fade(thread, 0, 0.8);
    yield* cs.caption('Ele era só um brinquedo de novo. Mas era amado.', 3);
    yield* cs.fadeOut(1.6, '#000000');
    markCleared('cut');
  },
});

// a música 'ending' é tocada pela própria cena; nada a registrar aqui além das cutscenes
void audio;
