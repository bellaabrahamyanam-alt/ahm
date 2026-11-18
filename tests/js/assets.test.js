// tools/assets/build.js (T-064): the builder that is copied into extensions and styles. Engine "none" only joins the files, so these tests need no minifier.
const { test, ok, eq } = require('./lib/harness');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const A = require('../../tools/assets/build');
const BUILD = path.join(__dirname, '..', '..', 'tools', 'assets', 'build.js');

const project = (files, cfg) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-test-'));
  for (const [f, t] of Object.entries(files)) (fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }), fs.writeFileSync(path.join(d, f), t));
  fs.writeFileSync(path.join(d, 'assets.config.json'), JSON.stringify(cfg));
  return d;
};
const run = (d, ...args) => spawnSync('node', [BUILD, 'assets.config.json', ...args], { cwd: d, encoding: 'utf8' });
const CFG = { bundles: [{ name: 'forum', outDir: 'dist', js: ['js/a.js', 'js/b.js'], css: ['css/a.css', 'css/sub/b.css'] }] };
const FILES = { 'js/a.js': 'function a() { return 1; }\n', 'js/b.js': '(function () { a(); })();\n', 'css/a.css': 'a { color: red; }\n', 'css/sub/b.css': '.x { background: url(img/x.png?v=1#f); } .y { background: url("/abs.png") } .z { background: url(data:image/png;base64,AA) }\n' };

test('assets: joins the files in the listed order with a `;` between scripts, and writes bundle + manifest', () => {
  const d = project(FILES, CFG);
  const r = run(d, '--engine', 'none');
  eq(0, r.status, r.stderr);
  const js = fs.readFileSync(path.join(d, 'dist/forum.min.js'), 'utf8');
  ok(js.indexOf('function a()') < js.indexOf('(function ()') && /\}\n\n;\n\(function/.test(js), 'order kept, `;` line between: ' + JSON.stringify(js));
  const m = JSON.parse(fs.readFileSync(path.join(d, 'dist/forum.manifest.json'), 'utf8'));
  eq(['js/a.js', 'js/b.js'], m.js, 'the manifest lists the sources');
  eq(fs.statSync(path.join(d, 'dist/forum.min.js')).size, m.bytes['forum.min.js'], 'the manifest has the size');
});

test('assets: --check fails when missing or after a source changed, passes after a rebuild, and needs no minifier', () => {
  const d = project(FILES, CFG);
  ok(run(d, '--check').status === 1, 'no bundle yet: stale');
  run(d, '--engine', 'none');
  eq(0, run(d, '--check').status, 'fresh');
  fs.appendFileSync(path.join(d, 'js/a.js'), '// edit\n');
  ok(run(d, '--check').status === 1, 'a changed source makes it stale');
  run(d, '--engine', 'none');
  fs.appendFileSync(path.join(d, 'dist/forum.min.js'), ' ');
  ok(run(d, '--check').status === 1, 'a hand-edited bundle (other size) is stale');
  run(d, '--engine', 'none');
  const cfg2 = JSON.parse(JSON.stringify(CFG)); cfg2.bundles[0].js.reverse();
  fs.writeFileSync(path.join(d, 'assets.config.json'), JSON.stringify(cfg2));
  ok(run(d, '--check').status === 1, 'another file order is another bundle');
});

test('assets: relative url() of a css file in another folder is rewritten to the bundle folder; absolute, data: and #/? parts are kept', () => {
  const d = project(FILES, CFG);
  run(d, '--engine', 'none');
  const css = fs.readFileSync(path.join(d, 'dist/forum.min.css'), 'utf8');
  ok(css.includes('url(../css/sub/img/x.png?v=1#f)'), 'rewritten, query kept: ' + css);
  ok(css.includes('url("/abs.png")') && css.includes('url(data:image/png;base64,AA)'), 'absolute and data: untouched');
  eq(path.join(d, 'css'), path.dirname(path.join(d, 'css/a.css')), 'sanity');
  // a css file next to the bundle keeps its urls as they are
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-same-'));
  fs.writeFileSync(path.join(out, 'k.css'), '.k { background: url(i.png) }');
  eq('.k { background: url(i.png) }', A.joinCss([path.join(out, 'k.css')], out), 'same folder: unchanged');
});

test('assets: @import is refused with the file name; a wrong config is refused with a clear message', () => {
  const d = project({ ...FILES, 'css/a.css': '@import "x.css";\na{}' }, CFG);
  const r = run(d, '--engine', 'none');
  ok(r.status === 1 && /@import is not supported/.test(r.stderr) && /a\.css/.test(r.stderr), 'import refused: ' + r.stderr);
  const bad = (cfg, re, why) => { const p = project(FILES, cfg), x = run(p, '--engine', 'none'); ok(x.status === 1 && re.test(x.stderr), why + ': ' + x.stderr); };
  bad({ bundles: [{ name: 'x y', outDir: 'd', js: ['js/a.js'] }] }, /needs a "name"/, 'bad name');
  bad({ bundles: [{ name: 'x', outDir: 'd', js: ['js/none.js'] }] }, /missing file js\/none\.js/, 'missing file');
  bad({ bundles: [{ name: 'x', outDir: 'd' }] }, /no js and no css/, 'empty bundle');
  bad({ bundles: [{ name: 'x', outDir: 'd', js: ['js/a.js'] }, { name: 'x', outDir: 'e', js: ['js/a.js'] }] }, /two bundles are named/, 'duplicate name');
});

test('assets: engine "terser" says what to install when terser or lightningcss is missing; never falls back in silence', () => {
  const have = (n) => { try { require.resolve(n); return true; } catch (e) { return false; } };
  if (have('terser') && have('lightningcss')) return ok(A.pickEngines('terser').js === 'terser', 'both installed');
  let msg = '';
  try { A.pickEngines('terser'); } catch (e) { msg = e.message; }
  ok(/npm i terser lightningcss/.test(msg), 'forced terser without it: ' + msg);
});
