// Servidor estático mínimo para desenvolvimento: node tools/serve.mjs [porta] [raiz]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

export function startServer(port = 0, root = process.cwd()) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(url.parse(req.url).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const port = +(process.argv[2] || 8080);
  const root = path.resolve(process.argv[3] || '.');
  startServer(port, root).then((s) => console.log(`http://127.0.0.1:${s.address().port}/`));
}
