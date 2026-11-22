// =============================================================================
// cutscenes/director.js — Executor de cutscenes (versão base; agente substitui).
// runCutscene(level, id, params) -> Promise
// =============================================================================
import { R } from '../registry.js';

export function runCutscene(level, id, params = {}) {
  const def = R.cutscenes.get(id);
  if (!def) { console.warn('[cutscene] não encontrada:', id); return Promise.resolve(); }
  return new Promise((resolve) => {
    const cs = {
      level, params,
      wait: (s) => s,
      say: function* (lines) { let done = false; level.dialogue.start(lines).then(() => { done = true; }); yield () => done; },
    };
    level.tasks.run(function* () { yield* def.run(cs); resolve(); });
  });
}
