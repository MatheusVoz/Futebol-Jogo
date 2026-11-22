// tools/build.mjs — Gera dist/ (index.html + game.js único, minificado) para o APK.
//   node tools/build.mjs          -> dist/
//   node tools/build.mjs --check  -> só verifica se o bundle compila (arquivo temporário; seguro em paralelo)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const check = process.argv.includes('--check');
const outfile = check ? path.join(os.tmpdir(), `sw_check_${process.pid}.js`) : 'dist/game.js';
if (!check) { fs.rmSync('dist', { recursive: true, force: true }); fs.mkdirSync('dist', { recursive: true }); }
try {
  const r = await esbuild.build({
    entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !check, sourcemap: false,
    target: ['chrome80'], outfile, legalComments: 'none', logLevel: 'warning',
  });
  const size = fs.statSync(outfile).size;
  if (check) { fs.rmSync(outfile, { force: true }); console.log(`build check OK (${(size / 1024).toFixed(1)} KB)`); }
  else {
    let html = fs.readFileSync('index.html', 'utf8');
    html = html.replace('<script type="module" src="src/main.js"></script>', '<script src="game.js"></script>');
    fs.writeFileSync('dist/index.html', html);
    console.log(`dist/game.js ${(size / 1024).toFixed(1)} KB` + (r.warnings.length ? ` (${r.warnings.length} warnings)` : ''));
  }
} catch (e) {
  console.error('BUILD FAILED');
  process.exit(1);
}
