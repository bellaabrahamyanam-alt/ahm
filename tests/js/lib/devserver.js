// Starts the Node dev back-end (dev/save-handler.js) and the static files of the extension on a free port,
// working on a throw-away COPY of the extension (the handler writes to ../data relative to itself).
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { ROOT } = require('./ctx');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.md': 'text/plain' };

/** `prepare(root)` (optional) may change the copied data before the handler starts and converts it. */
async function start(prepare) {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'ahm_js_'));
  const root = path.join(copy, 'map');
  fs.mkdirSync(root);
  for (const d of ['dev', 'data']) execSync(`cp -r ${JSON.stringify(path.join(ROOT, d))} ${JSON.stringify(root)}`);
  fs.mkdirSync(path.join(root, 'app'));
  execSync(`cp -r ${JSON.stringify(path.join(ROOT, 'app', 'js'))} ${JSON.stringify(path.join(ROOT, 'app', 'css'))} ${JSON.stringify(path.join(ROOT, 'app', 'index.html'))} ${JSON.stringify(path.join(root, 'app'))}`);
  if (fs.existsSync(path.join(ROOT, 'app', 'features'))) execSync(`cp -r ${JSON.stringify(path.join(ROOT, 'app', 'features'))} ${JSON.stringify(path.join(root, 'app'))}`);
  if (prepare) prepare(root);
  const mw = require(path.join(root, 'dev', 'save-handler.js'));
  const server = http.createServer((req, res) =>
    mw(req, res, () => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/') u = '/index.html';
      const f = u.startsWith('/data/') ? path.join(root, 'data', u.slice(6)) : path.join(root, 'app', u);
      fs.readFile(f, (e, b) => {
        if (e) return (res.statusCode = 404), res.end('not found');
        res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
        res.end(b);
      });
    })
  );
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    base,
    root,
    data: (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8')),
    post: async (u, body) => {
      const r = await fetch(base + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, json: await r.json().catch(() => ({})) };
    },
    stop: () => new Promise((r) => server.close(() => (fs.rmSync(copy, { recursive: true, force: true }), r()))),
  };
}
module.exports = { start };
