// tools/build.mjs — Gera dist/ (index.html + game.js único, minificado) para o APK.
import * as esbuild from 'esbuild';
import fs from 'node:fs';

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });
const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, sourcemap: false,
  target: ['chrome80'], outfile: 'dist/game.js', legalComments: 'none', logLevel: 'warning',
});
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<script type="module" src="src/main.js"></script>', '<script src="game.js"></script>');
fs.writeFileSync('dist/index.html', html);
const size = fs.statSync('dist/game.js').size;
console.log(`dist/game.js ${(size / 1024).toFixed(1)} KB` + (r.warnings.length ? ` (${r.warnings.length} warnings)` : ''));
