// Versão CommonJS do servidor estático (para scripts .cjs de QA).
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
exports.startServer = (port = 0, root = process.cwd()) => new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(url.parse(req.url).pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
  });
  s.listen(port, '127.0.0.1', () => resolve(s));
});
