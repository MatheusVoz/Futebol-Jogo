// =============================================================================
// cutscenes/world_intros.js — Intros dos mundos, cenas de habilidade e a revelação do Mundo 4.
//
//  'world1_intro'..'world5_intro'  cena própria (worldmap → fase): vista do mundo com o céu vivo
//        (skyPreset do mundo) + as camadas de parallax do fundo do mundo (R.backgrounds 'wN';
//        silhuetas próprias se o fundo ainda não existir) + um morro em primeiro plano com
//        adereços animados. Um portal de fios se abre, o Tico cai, a câmera passeia pela vista
//        (legenda), título do mundo, 1–3 falas do Tico, escurece.
//  'ability_stitch' 'ability_unstitch' 'ability_rewind' 'ability_decoy' 'ability_unravel'
//        dentro da fase (chamadas pelo altar com params.shrine): fios de luz saem do altar e giram
//        em volta do Tico, clarão, título "Nova habilidade!", demonstração visual da habilidade,
//        explicação em personagem, unlockAbility, jingle e volta da música da fase.
//  'w4_revelation'  dentro da fase: a escuridão aumenta, sombras se juntam, o rosto do Costureiro
//        surge nas sombras (camada de tela), revelação dos nós, crise do Tico, Luzinha chega com
//        sua luz e o anima (usa o diálogo 'w4_luzinha_2' se estiver registrado).
// =============================================================================
import { R, registerCutscene } from '../registry.js';
import { game } from '../../engine/game.js';
import { PixelCanvas } from '../../engine/pixel.js';
import { drawSprite, animFrame } from '../../engine/sprites.js';
import { hash2 } from '../../engine/util.js';
import { drawSky, skyPreset, DEFAULT_TOD } from '../art/sky.js';
import { drawGlow, drawThreadLine } from '../art/vfx.js';
import { tws, spawnTask, ticoActor, drawThreadVortex, costureiroHead, vignette } from './opening.js';

const RN = Math.round;
const TAU = Math.PI * 2;
const EXPR_ANIM = { surprised: 'surprise', scared: 'scared', sad: 'sad', confused: 'think', determined: 'idle', happy: 'wave', neutral: 'idle' };

// ============================================================ dados dos mundos
const WD = {
  1: { name: 'Floresta dos Brinquedos Perdidos', amb: 'w1_fireflies', land: 'land', fx: 'fluff',
    g: ['#86d870', '#4f9a48', '#3a2a22', '#2a1c16'],
    caption: 'Na Floresta dos Brinquedos Perdidos dormem os brinquedos de crianças que cresceram.',
    lines: [{ expr: 'surprised', text: 'Árvores de feltro... cogumelos que brilham...' },
      { expr: 'determined', text: 'Lia, me espera. Eu vou achar o caminho de casa!' }] },
  2: { name: 'Oceano das Lágrimas', amb: 'w2_bubbles', land: 'land', fx: 'dust',
    g: ['#f4e0a8', '#d8bc78', '#8a6a4a', '#5a4430'],
    caption: 'No Oceano das Lágrimas, cada onda nasceu do choro de alguém que perdeu um brinquedo.',
    lines: [{ expr: 'surprised', text: 'Isso tudo... são lágrimas?' },
      { expr: 'scared', text: 'Eu sou de pelúcia. Pelúcia e água NÃO combinam.' },
      { expr: 'determined', text: '...Mas pela Lia eu tomo até banho. Vamos lá!' }] },
  3: { name: 'Cidade dos Relógios Quebrados', amb: 'w3_dust', land: 'footstep_metal', fx: 'dust',
    g: ['#e0b050', '#a87028', '#4a3020', '#2e1e14'],
    caption: 'Na Cidade dos Relógios Quebrados, o tempo parou no instante em que cada brinquedo se perdeu.',
    lines: [{ expr: 'confused', text: 'Todos os relógios parados... na mesma hora.' },
      { expr: 'sad', text: 'Se o tempo parou aqui, será que a Lia ainda está dormindo?' }] },
  4: { name: 'O Pesadelo Debaixo da Cama', amb: 'w4_dust', land: 'land', fx: 'shadow',
    g: ['#5a4a90', '#3a2e66', '#1c1636', '#120e24'],
    caption: 'Debaixo da cama mora tudo o que as crianças temem quando a luz se apaga.',
    lines: [{ expr: 'scared', text: 'Tá escuro. Muito escuro. Escuro DEMAIS.' },
      { expr: 'sad', text: 'A Lia tem medo do escuro... Agora eu entendo por quê.' },
      { expr: 'determined', text: 'Ela me abraçava pra ficar corajosa. Agora é a minha vez.' }] },
  5: { name: 'O Coração da Dimensão', amb: 'w5_threads', land: 'land', fx: 'thread',
    g: ['#d0588a', '#8a2a5a', '#3a0a2a', '#24061a'],
    caption: 'No Coração da Dimensão, todos os fios do Avesso se encontram.',
    lines: [{ expr: 'surprised', text: 'Fios dourados... iguais às minhas costuras.' },
      { expr: 'determined', text: 'Ele está aqui, em algum lugar. O Costureiro.' },
      { expr: 'determined', text: 'Lia, aguenta firme. Eu tô chegando.' }] },
};

// ============================================================ vista: céu + parallax + morro
const layerCache = new Map();
function fallbackLayers(N) {
  const pal = N === 4 ? ['#221c44', '#171234', '#0e0a22'] : ['#5e1c50', '#40103a', '#280824'];
  return [0, 1, 2].map((i) => {
    const w = 512, h = 150 + i * 40, pc = new PixelCanvas(w, h), base = h - (70 - i * 16);
    for (let x = 0; x < w; x++) {
      const top = RN(base - (18 + i * 8) * (0.5 + 0.5 * Math.sin(x * (0.012 + i * 0.007) + i * 2)) - 6 * Math.sin(x * 0.05 + i));
      pc.vline(x, top, h - top, pal[i]);
    }
    const c = pal[i];
    if (N === 4) {
      if (i === 0) {
        pc.rect(40, base - 96, 150, 12, c); for (let x = 46; x < 186; x += 14) pc.rect(x, base - 86, 5, 86, c);
        pc.rect(300, base - 120, 80, 120, c); pc.vline(340, base - 116, 116, '#2e2858');
        pc.px(332, base - 70, '#ffd23f'); pc.px(336, base - 70, '#ffd23f'); pc.px(450, base - 40, '#ffe27a'); pc.px(454, base - 40, '#ffe27a');
      } else if (i === 1) {
        for (const [x, s] of [[60, 18], [84, 12], [150, 22], [330, 16], [420, 20]]) pc.rect(x, base - s - 10, s, s + 10, c);
        pc.circle(250, base - 26, 14, c); pc.circle(250, base - 46, 10, c); pc.circle(242, base - 54, 4, c); pc.circle(258, base - 54, 4, c);
      }
    } else if (i === 0) {
      for (const x of [90, 330]) { pc.rect(x, base - 110, 46, 110, c); pc.ellipse(x + 23, base - 110, 30, 7, c); pc.ellipse(x + 23, base - 40, 30, 7, c); }
      for (let k = 0; k < 3; k++) pc.curve(0, base - 120 + k * 20, 256, base - 190 + k * 30, 512, base - 120 + k * 20, '#ffd23f60', 0);
    } else if (i === 1) {
      pc.rect(120, base - 90, 24, 90, c); pc.circle(132, base - 96, 14, c); pc.ring(132, base - 96, 9, '#ffd23f50');
      pc.rect(300, base - 70, 6, 70, c); pc.tri(306, base - 70, 306, base - 30, 336, base - 34, c);
      pc.circle(440, base - 50, 20, c); pc.rect(436, base - 34, 8, 34, c);
    }
    pc.flush();
    return { canvas: pc.canvas, w, h, L: { speed: 0.12 + i * 0.2, speedY: 0.05 + i * 0.08, fillBelow: c } };
  });
}
function layersFor(N) {
  const key = 'w' + N;
  if (layerCache.has(key)) return layerCache.get(key);
  const bg = R.backgrounds.get(key), tod = bg?.defaultTimeOfDay || DEFAULT_TOD[key] || 'day';
  let out;
  if (bg && bg.layers && bg.layers.length) {
    out = bg.layers.map((L) => {
      const w = L.width || 512, h = L.height || 240, pc = new PixelCanvas(w, h);
      try { L.paint(pc, w, h, tod, { id: key + '_intro', world: N, timeOfDay: tod }); } catch (e) { console.error('[world_intro] fundo', e); }
      pc.flush();
      return { canvas: pc.canvas, w, h, L };
    });
  } else out = fallbackLayers(N);
  layerCache.set(key, out);
  return out;
}
function drawLayer(ctx, E, camX, camY, w, h, t) {
  const L = E.L, sx = L.speed ?? 0.5, sy = L.speedY ?? sx * 0.5;
  const y = RN((L.anchor === 'top' ? 0 : h - E.h) + (L.y || 0) - camY * sy);
  let x = -RN((((camX * sx + (L.drift || 0) * t) % E.w) + E.w) % E.w);
  ctx.globalAlpha = L.alpha ?? 1;
  for (; x < w; x += E.w) {
    ctx.drawImage(E.canvas, x, y);
    if (L.repeatY) for (let yy = y - E.h; yy > -E.h; yy -= E.h) ctx.drawImage(E.canvas, x, yy);
  }
  if (L.fillBelow && y + E.h < h) { ctx.fillStyle = L.fillBelow; ctx.fillRect(0, y + E.h, w, h - y - E.h); }
  if (L.fillAbove && y > 0) { ctx.fillStyle = L.fillAbove; ctx.fillRect(0, 0, w, y); }
  ctx.globalAlpha = 1;
  if (L.animate) try { L.animate(ctx, { x: camX, y: camY, viewW: w, viewH: h, zoom: 1, w, h }, t, w, h, y); } catch (e) { /* opcional */ }
}
const groundTop = (x) => 60 + Math.sin(x * 0.05) * 2 + (x > -90 ? (x + 90) * (x + 90) * 0.03 : 0);
function gear(ctx, x, y, r, a, c, c2) {
  const n = Math.max(6, RN(r * 0.7));
  ctx.fillStyle = c;
  for (let i = 0; i < n; i++) { const b = a + i / n * TAU; ctx.fillRect(RN(x + Math.cos(b) * (r + 1)) - 1, RN(y + Math.sin(b) * (r + 1)) - 1, 3, 3); }
  for (let yy = -r; yy <= r; yy++) { const s = RN(Math.sqrt(r * r - yy * yy)); ctx.fillRect(RN(x) - s, RN(y) + yy, s * 2, 1); }
  ctx.fillStyle = c2; ctx.fillRect(RN(x) - 2, RN(y) - 2, 4, 4);
  for (let i = 0; i < 4; i++) { const b = a + i * TAU / 4; ctx.fillRect(RN(x + Math.cos(b) * r * 0.6), RN(y + Math.sin(b) * r * 0.6), 2, 2); }
}
function drawProps(ctx, N, t) {
  if (N === 1) {
    ctx.fillStyle = '#d84a4a'; ctx.fillRect(-196, groundTop(-196) - 10, 11, 11);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-193, groundTop(-196) - 7, 5, 1); ctx.fillRect(-193, groundTop(-196) - 4, 5, 1); ctx.fillRect(-193, groundTop(-196) - 7, 1, 5); ctx.fillRect(-189, groundTop(-196) - 7, 1, 5);
    for (const [x, s] of [[-262, 1], [-232, 0.7], [-118, 0.85]]) {
      const y = RN(groundTop(x)), p = 0.3 + 0.15 * Math.sin(t * 2 + x);
      ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x - 1, y - RN(7 * s), 3, RN(7 * s));
      ctx.fillStyle = '#2a8a98'; ctx.fillRect(x - RN(6 * s), y - RN(10 * s), RN(12 * s) + 1, RN(4 * s));
      ctx.fillStyle = '#4fd8e0'; ctx.fillRect(x - RN(5 * s), y - RN(11 * s), RN(10 * s) + 1, RN(3 * s));
      ctx.fillStyle = '#c8fff8'; ctx.fillRect(x - 2, y - RN(10 * s), 1, 1); ctx.fillRect(x + 2, y - RN(10 * s) + 1, 1, 1);
      drawGlow(ctx, x, y - 9 * s, 12, '#6ff0ff', p);
    }
  } else if (N === 2) {
    for (let x = -72; x < 620; x += 2) {
      const y = RN(84 + Math.sin(x * 0.06 + t * 2) * 1.5);
      ctx.fillStyle = '#2f7fc0'; ctx.fillRect(x, y, 2, 120); ctx.fillStyle = '#5ab8ec'; ctx.fillRect(x, y + 3, 2, 3); ctx.fillStyle = '#c8f0ff'; ctx.fillRect(x, y, 2, 1);
      if (hash2(x, (t * 3) | 0, 2) < 0.03) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + 8 + ((x * 7) % 20), 2, 1); }
    }
    const by = RN(80 + Math.sin(40 * 0.06 + t * 2) * 1.5), bx = 40;
    ctx.fillStyle = '#c84a3a'; ctx.fillRect(bx - 10, by - 2, 20, 4); ctx.fillRect(bx - 8, by + 2, 16, 2);
    ctx.fillStyle = '#6a4428'; ctx.fillRect(bx, by - 20, 1, 18);
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 14; i++) ctx.fillRect(bx + 1, by - 19 + i, RN(i * 0.7), 1);
    ctx.fillStyle = '#9ad8c8'; ctx.fillRect(-206, groundTop(-206) - 9, 6, 9); ctx.fillRect(-205, groundTop(-206) - 12, 4, 3);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(-205, groundTop(-206) - 7, 4, 5);
    ctx.fillStyle = '#ff9ab8'; ctx.fillRect(-250, groundTop(-250) - 2, 3, 2); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-120, groundTop(-120) - 2, 3, 2);
  } else if (N === 3) {
    gear(ctx, -236, groundTop(-236) + 2, 14, t * 0.6, '#b8862e', '#5a3a18');
    gear(ctx, -206, groundTop(-206) + 6, 9, -t * 0.93, '#d8a040', '#5a3a18');
    const cx = -128, cy = RN(groundTop(-128)) - 14;
    ctx.fillStyle = '#6a4a20'; ctx.fillRect(cx - 13, cy - 13, 27, 27); ctx.fillStyle = '#f4ead0'; ctx.fillRect(cx - 11, cy - 11, 23, 23);
    ctx.fillStyle = '#4a3020'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillRect(RN(cx + Math.cos(a) * 9), RN(cy + Math.sin(a) * 9), 1, 1); }
    ctx.fillStyle = '#2a1a10'; for (let k = 0; k < 7; k++) ctx.fillRect(cx + k, cy, 1, 1); for (let k = 0; k < 5; k++) ctx.fillRect(cx - RN(k * 0.4), cy - k, 1, 1);
    ctx.fillStyle = '#c8a050'; ctx.fillRect(-300, RN(groundTop(-300)) - 12, 220, 2);
    for (let x = -300; x < -80; x += 22) ctx.fillRect(x, RN(groundTop(x)) - 12, 2, 12);
  } else if (N === 4) {
    ctx.fillStyle = '#2a1e4a'; ctx.fillRect(-262, groundTop(-262) - 9, 30, 9); ctx.fillRect(-266, groundTop(-262) - 5, 6, 5);
    ctx.fillStyle = '#4a3a7a'; ctx.fillRect(-258, groundTop(-262) - 9, 22, 2);
    const blink = Math.sin(t * 1.7) > -0.9;
    if (blink) { ctx.fillStyle = '#ffe27a'; ctx.fillRect(-312, 36, 2, 1); ctx.fillRect(-304, 36, 2, 1); }
    for (let x = -300; x < -80; x += 12) { ctx.fillStyle = '#7a6ab0'; ctx.fillRect(x, RN(groundTop(x)) + 5, 2, 1); }
  } else {
    drawThreadLine(ctx, -90, 46, 520, -70, t, '#ffd23f', { sag: 36, glow: 1.5, width: 3, stitches: false });
    drawThreadLine(ctx, -330, 30, 420, -140, t + 1, '#ffd23f', { sag: 60, glow: 1.2, width: 2, stitches: false });
    const sx = -262, sy = RN(groundTop(sx));
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx - 12, sy - 4, 24, 4); ctx.fillRect(sx - 12, sy - 26, 24, 4);
    ctx.fillStyle = '#8a2a5a'; ctx.fillRect(sx - 8, sy - 22, 16, 18);
    ctx.fillStyle = '#f0c040'; for (let y = sy - 21; y < sy - 4; y += 2) ctx.fillRect(sx - 8, y, 16, 1);
  }
}
function drawGround(ctx, N, t) {
  const g = WD[N].g;
  for (let x = -460; x < -36; x += 2) {
    const top = RN(groundTop(x));
    ctx.fillStyle = g[2]; ctx.fillRect(x, top, 2, 260);
    ctx.fillStyle = g[0]; ctx.fillRect(x, top, 2, 2);
    ctx.fillStyle = g[1]; ctx.fillRect(x, top + 2, 2, 3);
    if (hash2(x, 1, N) < 0.3) { ctx.fillStyle = g[3]; ctx.fillRect(x, top + 8 + RN(hash2(x, 2, N) * 40), 2, 2); }
    if (N === 1 && hash2(x, 3, 1) < 0.25) { ctx.fillStyle = g[0]; ctx.fillRect(x, top - 2, 1, 2); }
  }
  for (let x = -440; x < -60; x += 24) { ctx.fillStyle = '#fff4dc50'; ctx.fillRect(x, RN(groundTop(x)) + 14, 6, 1); }
  drawProps(ctx, N, t);
}
function drawVista(ctx, cs, N) {
  const S = cs.S;
  if (!S) return;
  const z = cs.cam.zoom || 1, vw = cs.view.w, vh = cs.view.h, t = cs.time;
  ctx.save();
  ctx.setTransform(1 / z, 0, 0, 1 / z, 0, 0);
  try { drawSky(ctx, vw, vh, t, { x: cs.cam.x * 0.3 + 600, y: 0 }, skyPreset('w' + N, null)); } catch (e) { ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, vw, vh); }
  for (const E of layersFor(N)) drawLayer(ctx, E, cs.cam.x + 420, cs.cam.y, vw, vh, t);
  ctx.restore();
  drawGround(ctx, N, t);
  drawThreadVortex(ctx, S.vx, S.vy, 40, t, S.vk);
}
function vistaFront(ctx, cs, N) {
  const S = cs.S;
  if (!S || !S.tico) return;
  if (N === 4) drawGlow(ctx, S.tico.x, S.tico.y - 14, 44, '#ffe9a0', 0.22);
  if (N === 5) drawGlow(ctx, S.tico.x, S.tico.y - 14, 30, '#ffd23f', 0.15 + 0.08 * Math.sin(cs.time * 3));
}
function vistaScreen(ctx, cs, N) {
  const S = cs.S;
  if (!S) return;
  const { w, h } = cs.view;
  ctx.drawImage(vignette(w, h), 0, 0);
  if (N === 4) ctx.drawImage(vignette(w, h), 0, 0);
  if (S.black > 0) { ctx.globalAlpha = Math.min(1, S.black); ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
}
function* fall(cs, a, x, y, dur) {
  const x0 = a.x, y0 = a.y, t0 = cs.time;
  for (;;) {
    const k = cs.skipping ? 1 : Math.min(1, (cs.time - t0) / dur);
    a.x = x0 + (x - x0) * k; a.y = y0 + (y - y0) * k * k;
    if (k >= 1) return;
    yield;
  }
}

for (const N of [1, 2, 3, 4, 5]) {
  const D = WD[N];
  registerCutscene(`world${N}_intro`, {
    stage: (ctx, cs) => drawVista(ctx, cs, N), music: `w${N}_level`, letterbox: true,
    drawFront: (ctx, cs) => vistaFront(ctx, cs, N), drawScreen: (ctx, cs) => vistaScreen(ctx, cs, N),
    run: function* (cs) {
      const S = cs.S = { black: 1, vk: 0, vx: -150, vy: -86, tico: null };
      const gy = RN(groundTop(-150));
      Object.assign(cs.cam, { x: -140, y: -46, zoom: 1.5 });
      spawnTask(cs, (function* () { for (;;) { const r = cs.viewRect(); cs.particles(D.amb, r.x + Math.random() * r.w, r.y + Math.random() * r.h, 1); yield 0.14; } })());
      const tico = S.tico = ticoActor(cs, { anim: 'fall', x: S.vx, y: S.vy + 10, z: 5, alpha: 0 });
      yield* tws(cs, S, { black: 0 }, 1.2, 'linear');
      cs.sfx('portal');
      yield* tws(cs, S, { vk: 1 }, 0.9, 'outBack');
      cs.particles('portal', S.vx, S.vy, 14);
      yield 0.25;
      tico.alpha = 1; cs.sfx('whoosh');
      yield* cs.parallel(fall(cs, tico, -150, gy, 0.85), cs.pan(-140, gy - 46, 0.9, 'inQuad'),
        (function* () { yield 0.5; yield* tws(cs, S, { vk: 0 }, 0.6, 'inBack'); })());
      tico.anim = 'land'; tico.t = 0; tico.sx = 1.25; tico.sy = 0.72;
      cs.sfx(D.land); cs.shake(0.2); cs.particles('dust', tico.x, gy, 10); cs.particles(D.fx, tico.x, gy - 4, 6);
      yield* tws(cs, tico, { sx: 1, sy: 1 }, 0.3, 'outBack');
      tico.anim = 'idle';
      yield 0.5;
      tico.anim = 'look_up';
      yield* cs.parallel(cs.pan(110, -16, 4.8), cs.zoom(1.0, 4.8), (function* () { yield 0.8; yield* cs.caption(D.caption, 3.8); })());
      yield* cs.title(D.name, `Mundo ${N}`, 3.2);
      yield* cs.parallel(cs.pan(-128, gy - 28, 1.6), cs.zoom(1.8, 1.6));
      for (const l of D.lines) {
        tico.anim = EXPR_ANIM[l.expr] || 'idle'; tico.t = 0;
        yield* cs.say([{ who: 'tico', expr: l.expr, text: l.text, at: tico }]);
      }
      tico.anim = 'idle';
      yield* cs.parallel(cs.walk(tico, -100, 50), tws(cs, S, { black: 1 }, 1.5, 'linear'));
    },
  });
}

// ============================================================ habilidades (dentro da fase)
function drawAura(ctx, a, t) {
  const k = a.k, x = a.x, y = a.y - 16, col = a.col;
  if (k > 0.01) {
    drawGlow(ctx, x, y, 26 + 22 * k, col, 0.5 * k);
    ctx.globalAlpha = 0.2 * k; ctx.fillStyle = col; ctx.fillRect(RN(x - 9 * k), RN(y - 140), RN(18 * k), 160);
    ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#ffffff'; ctx.fillRect(RN(x - 3 * k), RN(y - 140), RN(6 * k), 160);
    for (let i = 0; i < 6; i++) for (let s = 0; s < 18; s++) {
      const u = s / 18, ang = i / 6 * TAU + t * 4 + u * 5, rr = (26 - u * 14) * k;
      ctx.globalAlpha = k * (1 - u * 0.6); ctx.fillStyle = i % 2 ? col : '#ffffff';
      ctx.fillRect(RN(x + Math.cos(ang) * rr), RN(y + 18 - u * 46 + Math.sin(ang) * rr * 0.3), 1, 1);
    }
    if (a.sx != null) for (let i = 0; i < 3; i++) drawThreadLine(ctx, a.sx, a.sy, x + (i - 1) * 6, y + 4, t + i, col, { sag: -16 - i * 8, glow: 1.2, alpha: k * 0.8, stitches: false });
  }
  if (a.ring > 0.01) {
    const r = (1 - a.ring) * 80 + 6;
    ctx.globalAlpha = a.ring; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 48; i++) { const b = i / 48 * TAU; ctx.fillRect(RN(x + Math.cos(b) * r), RN(y + Math.sin(b) * r * 0.7), 2, 1); }
  }
  ctx.globalAlpha = 1;
}
function* fxStitch(cs, p, col) {
  const d = p.facing || 1, x0 = p.cx + d * 6, y0 = p.bottom - 14, x1 = x0 + d * 64, y1 = y0 - 18, F = { u: 0, a: 1 };
  cs.actor({ x: x0, y: y0, z: 41, draw: (ctx) => {
    if (F.u <= 0.01) return;
    drawThreadLine(ctx, x0, y0, x0 + (x1 - x0) * F.u, y0 + (y1 - y0) * F.u, cs.time, col, { sag: 6 * F.u, glow: 1.4, width: 2, stitches: true, alpha: F.a });
    drawGlow(ctx, x0 + (x1 - x0) * F.u, y0 + (y1 - y0) * F.u, 8, col, 0.6 * F.a);
  } });
  cs.anim(p, 'cast'); cs.sfx('stitch_cast');
  yield* tws(cs, F, { u: 1 }, 0.5, 'outQuad');
  cs.sfx('stitch_connect'); cs.particles('stitch_spark', x1, y1, 10);
  yield 0.7;
  yield* tws(cs, F, { a: 0 }, 0.5);
  cs.anim(p, null);
}
function* fxUnstitch(cs, p, col) {
  const d = p.facing || 1, x = RN(p.cx + d * 34), y = RN(p.bottom - 20), F = { open: 0, pops: 0, a: 1 };
  cs.actor({ x, y, z: 41, draw: (ctx) => {
    ctx.globalAlpha = F.a;
    for (let yy = -16; yy <= 16; yy++) {
      const hw = F.open * 7 * Math.sqrt(1 - (yy / 16.5) ** 2);
      if (hw >= 1) { ctx.fillStyle = '#160a24'; ctx.fillRect(RN(x - hw), y + yy, RN(hw * 2), 1); ctx.fillStyle = col; ctx.fillRect(RN(x - hw) - 1, y + yy, 1, 1); ctx.fillRect(RN(x + hw), y + yy, 1, 1); }
      else { ctx.fillStyle = col; ctx.fillRect(x, y + yy, 1, 1); }
    }
    ctx.fillStyle = '#ffffff';
    for (let i = F.pops; i < 5; i++) { const yy = y - 12 + i * 6; for (let k = -4; k <= 4; k++) { ctx.fillRect(x + k, yy + RN(k * 0.25), 1, 1); ctx.fillRect(x + k, yy - RN(k * 0.25), 1, 1); } }
    ctx.globalAlpha = 1;
  } });
  cs.anim(p, 'cast'); cs.sfx('unstitch_cast');
  yield 0.4;
  for (let i = 0; i < 5; i++) {
    F.pops = i + 1; cs.sfx('thread_snap', { pitch: 1 + i * 0.08 });
    cs.particles('thread', x, y - 12 + i * 6, 4, { colors: [col, '#ffffff'] });
    yield* tws(cs, F, { open: (i + 1) / 5 }, 0.12);
    yield 0.06;
  }
  yield 0.6;
  yield* tws(cs, F, { a: 0 }, 0.4);
  cs.anim(p, null);
}
function* fxRewind(cs, p, col) {
  const d = p.facing || 1, gx = p.cx, gy = p.bottom, Ck = { k: 0, ang: 0 };
  const ghost = cs.actor({ x: gx + d * 44, y: gy, z: 39, alpha: 0, draw: (ctx, a) => drawSprite(ctx, 'tico', 'run', animFrame('tico', 'run', 10 - a.t), a.x, a.y, { flip: d < 0, variant: col, alpha: 0.55 }) });
  cs.actor({ x: gx, y: gy, z: 41, draw: (ctx) => {
    if (Ck.k <= 0.01) return;
    const cx = gx, cy = gy - 44, r = 12 * Ck.k;
    drawGlow(ctx, cx, cy, r + 10, col, 0.5 * Ck.k);
    ctx.fillStyle = col;
    for (let i = 0; i < 24; i++) { const b = i / 24 * TAU; ctx.fillRect(RN(cx + Math.cos(b) * r), RN(cy + Math.sin(b) * r), 1, 1); }
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < r * 0.8; k++) ctx.fillRect(RN(cx + Math.cos(Ck.ang) * k), RN(cy + Math.sin(Ck.ang) * k), 1, 1);
    for (let k = 0; k < r * 0.5; k++) ctx.fillRect(RN(cx + Math.cos(Ck.ang / 12) * k), RN(cy + Math.sin(Ck.ang / 12) * k), 1, 1);
  } });
  cs.anim(p, 'cast'); cs.sfx('rewind_cast'); cs.particles('rewind_glyph', gx, gy - 20, 12);
  yield* cs.parallel(tws(cs, Ck, { k: 1, ang: -TAU * 1.6 }, 1.2),
    (function* () { ghost.alpha = 1; yield* cs.move(ghost, gx, gy, 1.0, 'inOutQuad'); yield* cs.fade(ghost, 0, 0.3); })());
  yield* tws(cs, Ck, { k: 0 }, 0.3);
  cs.anim(p, null);
}
function* fxDecoy(cs, p, col) {
  const d = p.facing || 1;
  const copy = ticoActor(cs, { anim: 'idle', x: RN(p.cx + d * 28), y: RN(p.bottom), z: 39, flip: d > 0, tint: 0.75, tintColor: col, alpha: 0 });
  cs.sfx('decoy_cast'); cs.particles('ghost_patch', copy.x, copy.y - 14, 12);
  yield* cs.fade(copy, 0.85, 0.25);
  copy.anim = 'wave';
  yield 0.5;
  cs.anim(p, 'scared'); cs.shake(0.1);
  yield* cs.say([{ who: 'tico', expr: 'scared', text: 'AAH! Outro eu?! ...Ah. É um retalho fantasma. Que susto.', at: p }]);
  cs.sfx('decoy_swap'); cs.particles('ghost_patch', copy.x, copy.y - 14, 16);
  yield* cs.fade(copy, 0, 0.3);
  cs.anim(p, null);
}
function* fxUnravel(cs, p) {
  const F = { k: 0 };
  cs.actor({ x: p.cx, y: p.bottom, z: 41, draw: (ctx) => {
    if (F.k <= 0.01) return;
    drawSprite(ctx, 'tico', p.anim, p.frame || 0, RN(p.cx), RN(p.bottom), { flip: p.facing < 0, variant: '#ffd23f', alpha: F.k * (0.5 + 0.25 * Math.sin(cs.time * 20)) });
    drawGlow(ctx, p.cx, p.bottom - 16, 36, '#ffd23f', 0.45 * F.k);
  } });
  cs.anim(p, 'charge'); cs.sfx('unravel_start');
  const em = spawnTask(cs, (function* () { for (;;) { cs.particles('unravel_fiber', p.cx, p.bottom - 16, 3); yield 0.06; } })());
  yield* tws(cs, F, { k: 1 }, 1.0);
  yield 0.6;
  cs.sfx('unravel_end'); cs.removeActor(em);
  yield* tws(cs, F, { k: 0 }, 0.5);
  cs.anim(p, null);
}
const AB = {
  stitch: { fx: fxStitch, lines: [
    { expr: 'surprised', text: 'Minhas costuras... estão brilhando dourado!' },
    { expr: 'happy', text: 'Perto de um ilhó dourado, use a habilidade: eu costuro uma ponte de fio até outro ilhó!' },
    { expr: 'determined', text: 'Se tiver mais de um, ↑ e ↓ escolhem. Longe deles, o fio laça os inimigos!' }] },
  unstitch: { fx: fxUnstitch, lines: [
    { expr: 'surprised', text: 'Eu puxei um fio... e a rede inteira se desmanchou!' },
    { expr: 'happy', text: 'Perto de costuras, use a habilidade: paredes costuradas se abrem e armaduras caem.' },
    { expr: 'determined', text: 'Armadilhas se desarmam também. E às vezes... aparecem segredos escondidos!' }] },
  rewind: { fx: fxRewind, lines: [
    { expr: 'surprised', text: 'O tempo... voltou? Só um pouquinho, mas voltou!' },
    { expr: 'happy', text: 'Use a habilidade: o que está perto volta uns 3 segundos. Pontes, blocos, novelos...' },
    { expr: 'confused', text: 'Até projéteis voltam pra quem jogou! Só não funciona em mim, em inimigos e em selos roxos.' }] },
  decoy: { fx: fxDecoy, lines: [
    { expr: 'happy', text: 'Use a habilidade: eu lanço uma cópia de retalhos que distrai inimigos e pesa em placas.' },
    { expr: 'determined', text: '↑ lança alto, ↓ solta aos meus pés. Usando de novo, eu troco de lugar com ela!' }] },
  unravel: { fx: fxUnravel, lines: [
    { expr: 'surprised', text: 'Eu sou... fio. Fio de verdade. E eu não tenho medo.' },
    { expr: 'happy', text: 'Com a carga cheia, use a habilidade: fico mais rápido e forte e atravesso barreiras de fios.' },
    { expr: 'determined', text: 'Desfiado, eu crio plataformas no ar. E apertando de novo... Tempestade de Fios!' }] },
};
function* abilityRun(cs, id) {
  const L = cs.level, p = cs.player;
  if (!L || !p) { cs.unlockAbility(id); return; }
  const def = R.abilities.get(id) || {}, col = def.color || '#ffd23f', sh = cs.params && cs.params.shrine;
  const px = RN(p.cx), py = RN(p.bottom);
  if (sh) cs.face(p, sh);
  yield* cs.parallel(cs.pan(sh ? RN((sh.cx + px) / 2) : px, py - 28, 0.7), cs.zoom(1.7, 0.7));
  cs.anim(p, 'look_up');
  const aura = cs.actor({ x: px, y: py, z: 40, k: 0, ring: 0, col, sx: sh ? sh.cx : null, sy: sh ? sh.bottom - 26 : null, draw: drawAura });
  cs.sfx('magic_hum');
  const swirl = spawnTask(cs, (function* () { for (;;) { cs.particles('thread', px + (Math.random() - 0.5) * 30, py - 8 - Math.random() * 30, 1, { colors: [col, '#ffffff'] }); yield 0.05; } })());
  yield* tws(cs, aura, { k: 1 }, 1.3, 'inQuad');
  cs.anim(p, 'cast');
  yield 0.3;
  cs.removeActor(swirl);
  cs.flash('#ffffff', 0.45); cs.shake(0.35); cs.sfx('ability_get');
  cs.particles('stars_burst', px, py - 16, 26, { colors: [col, '#ffffff'] });
  aura.ring = 1;
  spawnTask(cs, tws(cs, aura, { ring: 0 }, 0.8, 'outQuad'));
  cs.music('jingle_item');
  cs.anim(p, 'celebrate');
  yield* cs.title(def.name || 'Nova habilidade', 'Nova habilidade!', 2.8);
  cs.unlockAbility(id);
  yield* tws(cs, aura, { k: 0 }, 0.4);
  cs.anim(p, null);
  yield* AB[id].fx(cs, p, col);
  yield* cs.say(AB[id].lines.map((l) => ({ who: 'tico', expr: l.expr, text: l.text, at: p })));
  cs.music(L.data.music || `w${L.data.world}_level`);
  yield* cs.zoom(1, 0.5);
}
for (const id of Object.keys(AB)) registerCutscene(`ability_${id}`, { run: (cs) => abilityRun(cs, id) });

// ============================================================ 'w4_revelation' (dentro da fase)
function drawFace(ctx, F, t) {
  if (F.k <= 0.01) return;
  const W = game.view.w, H = game.view.h, sc = 2, head = costureiroHead(F.open > 0.5);
  const x = RN(W / 2 - 15 * sc + Math.sin(t * 0.9) * 2), y = RN(H * 0.1 + Math.sin(t * 1.3) * 3);
  ctx.save();
  ctx.fillStyle = '#05020c';
  for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.18 * F.k; ctx.beginPath(); ctx.ellipse(W / 2, y + 40, 90 - i * 14, 60 - i * 9, 0, 0, TAU); ctx.fill(); }
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.9 * F.k;
  ctx.drawImage(head, x, y, 30 * sc, 36 * sc);
  ctx.globalAlpha = F.k;
  for (const [ex, ey] of [[10, 22], [21.5, 23]]) { drawGlow(ctx, x + ex * sc, y + ey * sc, 12, '#c070ff', F.k); ctx.fillStyle = '#ffffff'; ctx.fillRect(RN(x + ex * sc), RN(y + ey * sc), 1, 1); }
  for (let i = 0; i < 5; i++) for (let k = 0; k < 22; k++) {
    ctx.globalAlpha = F.k * (1 - k / 22) * 0.8; ctx.fillStyle = k % 5 ? '#7a2ab0' : '#d090ff';
    ctx.fillRect(RN(x + 10 + i * 10 + Math.sin(t * 2 + i + k * 0.3) * k * 0.3), RN(y + 66 + k * 1.6), 1, 1);
  }
  ctx.restore();
}
registerCutscene('w4_revelation', {
  music: 'revelation',
  run: function* (cs) {
    const L = cs.level, p = cs.player;
    if (!L || !p) return;
    const d0 = L.data.darkness ?? 0, ov = cs.overlays, F = { k: 0, open: 0 }, base = Object.getPrototypeOf(ov).draw;
    ov.draw = function (ctx, c) { try { drawFace(ctx, F, cs.time); } catch (e) { /* opcional */ } return base.call(this, ctx, c); };
    yield* cs.parallel(cs.pan(p.cx, p.cy - 34, 0.9), cs.zoom(1.5, 0.9));
    cs.anim(p, 'scared'); cs.sfx('shadow_whisper');
    // a escuridão aumenta e as sombras se juntam
    const sh = { r: 1 };
    cs.actor({ x: p.cx, y: p.bottom, z: 45, draw: (ctx) => {
      const cx = p.cx, cy = p.cy, rr = 30 + 130 * sh.r;
      ctx.fillStyle = '#05030a';
      for (let i = 0; i < 12; i++) {
        const b = i / 12 * TAU + Math.sin(cs.time * 0.7 + i) * 0.2;
        for (let k = 0; k < 40; k++) {
          const u = k / 40, rad = rr + u * 90;
          ctx.fillRect(RN(cx + Math.cos(b + Math.sin(cs.time * 2 + u * 6 + i) * 0.15) * rad), RN(cy + Math.sin(b) * rad * 0.7), 3 - RN(u * 2), 3 - RN(u * 2));
        }
      }
    } });
    const wisps = spawnTask(cs, (function* () { for (;;) { const a = Math.random() * TAU; cs.particles('shadow_wisp', p.cx + Math.cos(a) * 70, p.cy + Math.sin(a) * 40, 1); yield 0.08; } })());
    yield* cs.parallel(tws(cs, L.data, { darkness: Math.max(d0, 0.93) }, 2.6), tws(cs, sh, { r: 0.25 }, 3.0, 'inOutQuad'));
    cs.sfx('heartbeat');
    yield* tws(cs, F, { k: 1 }, 1.6, 'inQuad');
    F.open = 1;
    yield* cs.say([
      { who: 'costureiro', expr: 'neutral', text: 'Pequeno fio... você está fazendo exatamente o que eu queria.' },
      { who: 'costureiro', expr: 'happy', text: 'Cada nó que você desata me aproxima de casa.' },
    ]);
    F.open = 0;
    yield* cs.say([{ who: 'tico', expr: 'scared', text: 'Nó? Que nó? Eu só ajudei os guardiões!', at: p, shake: true }]);
    F.open = 1;
    yield* cs.say([
      { who: 'costureiro', expr: 'neutral', text: 'O Coelho. A Baleia. O Rei. Nós da costura... e você desatou um por um.' },
    ]);
    F.open = 0; cs.anim(p, 'sad');
    yield* cs.say([{ who: 'tico', expr: 'sad', text: 'Então... eu estava abrindo o caminho pra VOCÊ?', at: p }]);
    F.open = 1;
    yield* cs.say([{ who: 'costureiro', expr: 'happy', text: 'Fio antigo só obedece a quem o carrega. Continue, brinquedo.' }]);
    F.open = 0; cs.sfx('shadow_whisper');
    yield* tws(cs, F, { k: 0 }, 1.4, 'inQuad');
    cs.removeActor(wisps);
    yield 0.6;
    yield* cs.say([{ who: 'tico', expr: 'sad', text: 'Eu só queria voltar pra Lia...', at: p }]);
    cs.anim(p, 'think');
    yield* cs.say([{ who: 'tico', expr: 'confused', text: 'Eu sou um brinquedo? Ou algo muito maior do que isso?', at: p }]);
    // a Luzinha chega com sua luz
    const d = p.facing || 1;
    const luz = cs.actor({ sprite: 'npc_luzinha', anim: 'fly', x: p.cx - d * 150, y: p.bottom - 90, z: 46, flip: d < 0, h: 22 });
    if (luz.entity) luz.entity.light = { r: 80, color: '#fff3a0', i: 1, flicker: 0.15 };
    cs.sfx('heal');
    yield* cs.parallel(cs.move(luz, p.cx - d * 22, p.bottom - 26, 1.8, 'outCubic'), tws(cs, L.data, { darkness: d0 }, 2.2), tws(cs, sh, { r: 1.6 }, 2.2));
    luz.setAnim('talk');
    cs.anim(p, 'surprise');
    const comfort = R.dialogues.has('w4_luzinha_2') ? 'w4_luzinha_2' : [
      { who: 'luzinha', expr: 'scared', text: 'T-Tico? Eu tô aqui. Tá vendo? O escuro já recuou um pouquinho.', at: luz },
      { who: 'luzinha', expr: 'happy', text: 'Eu sou só uma luz de tomada... e ainda assim espanto pesadelos.', at: luz },
      { who: 'luzinha', expr: 'neutral', text: 'Você não precisa saber o que é. Só pra quem você quer voltar.', at: luz },
    ];
    yield* cs.say(comfort);
    luz.setAnim('idle'); cs.anim(p, 'idle');
    yield* cs.say([{ who: 'tico', expr: 'determined', text: 'Pra Lia. ...Tá bom. Se ele quer o meu fio, vai ter que me alcançar primeiro!', at: p }]);
    L.data.darkness = d0;
    delete ov.draw;
    yield* cs.zoom(1, 0.6);
  },
});
