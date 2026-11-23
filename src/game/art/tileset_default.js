// =============================================================================
// art/tileset_default.js — Tileset/fundo neutro de fallback ('default').
// Mundos registram seus próprios ('w1'...'w5') em art/tiles_wN.js / art/bg_wN.js.
// =============================================================================
import { registerTileset, registerBackground } from '../registry.js';
import { drawSky, skyPreset } from './sky.js';

registerTileset('default', {
  skyColor: '#2a2050',
  solid(pc, x, y, n, rng) {
    pc.rect(x, y, 16, 16, '#5a4a6a');
    pc.rect(x + rng.int(1, 10), y + rng.int(3, 12), 3, 2, '#4a3a5a');
    if (!n.u) { pc.rect(x, y, 16, 4, '#6fbf5a'); pc.hline(x, y + 4, 16, '#3f8a3a'); }
  },
  oneway(pc, x, y) { pc.rect(x, y, 16, 4, '#a07040'); pc.hline(x, y + 4, 16, '#604020'); },
  spike(pc, x, y, dir) {
    for (let i = 0; i < 4; i++) pc.tri(x + i * 4, y + 16, x + i * 4 + 2, y + 6, x + i * 4 + 4, y + 16, '#d8d8e8');
  },
  bg(pc, x, y) { pc.rect(x, y, 16, 16, '#30284a'); },
});
registerBackground('default', {
  sky(ctx, w, h, t, cam, level) { drawSky(ctx, w, h, t, cam, skyPreset(level?.data?.skyWorld || 'w1', level)); },
  layers: [],
});
