// Production bundle (T-005, tools/build.js): app/dist is committed, so it must match the sources, keep every global name
// (the scripts share one global scope) and be served by the controller. It needs no Bun: the build itself is not run here.
const { test, ok, eq } = require('./lib/harness');
const fs = require('fs');
const path = require('path');
const b = require('../../tools/build');
const ROOT = path.join(__dirname, '..', '..');
const dist = (f) => fs.readFileSync(path.join(b.DIST, f), 'utf8');

test('build: index.html marks the scripts and styles to bundle (the page loads the same files in dev)', () => {
  const s = b.sources();
  ok(s.js.length >= 20, 'found the scripts: ' + s.js.join(','));
  ok(s.js[0] === 'js/config.js' && s.js.at(-1) === 'js/features.js', 'first config.js, last features.js: ' + s.js[0] + ' ' + s.js.at(-1));
  eq(['css/base.css', 'css/sidebar.css', 'css/map.css', 'css/shapes.css', 'css/explore.css', 'css/layers.css'], s.css);
  const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
  const all = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
  eq(all, s.js); // no local script outside the marked block: it would be missing from the bundle
});

test('build: app/dist is built from the current sources (run `bun tools/build.js` and commit app/dist/)', () => {
  ok(!b.stale(), 'app/dist is stale');
});

test('build: the minified script parses and keeps every top-level name of the sources', () => {
  const min = dist('app.min.js');
  new Function(min); // syntax check
  const src = b.joinJs(b.sources().js);
  const names = new Set();
  for (const m of src.matchAll(/^(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  ok(names.size > 100, 'found the top-level names: ' + names.size);
  const lost = [...names].filter((n) => !b.hasDeclaration(min, n));
  eq([], lost);
  ok(min.length < src.length * 0.8, 'the bundle is smaller than the sources');
});

test('build: the minified style keeps every custom property and class name of the sources', () => {
  const min = dist('app.min.css');
  const src = b.joinCss(b.sources().css).replace(/\/\*[\s\S]*?\*\//g, ''); // comments are removed on purpose
  const props = new Set([...src.matchAll(/--[a-z][\w-]*/g)].map((m) => m[0]));
  const classes = new Set([...src.matchAll(/\.([a-z][\w-]*)\s*[{,:.>\s[]/g)].map((m) => m[1]));
  ok(props.size > 10 && classes.size > 20, `found ${props.size} properties, ${classes.size} classes`);
  eq([], [...props].filter((p) => !min.includes(p)));
  eq([], [...classes].filter((c) => !min.includes('.' + c)));
  ok(min.length < src.length, 'the style is smaller than the sources');
});

test('build: the manifest lists the files and sizes of the bundle', () => {
  const m = JSON.parse(dist('manifest.json'));
  eq(b.sources().js, m.js);
  eq(b.sources().css, m.css);
  eq(Buffer.byteLength(dist('app.min.js')), m.bytes['app.min.js']);
  eq(Buffer.byteLength(dist('app.min.css')), m.bytes['app.min.css']);
  ok(/^[0-9a-f]{64}$/.test(m.hash), 'hash is sha256');
});

test('build: hasDeclaration finds a name only where it is declared, not anywhere in the text', () => {
  ok(b.hasDeclaration('function foo(){}', 'foo'));
  ok(b.hasDeclaration('x();async function foo(){}', 'foo'));
  ok(b.hasDeclaration('class Foo{}', 'Foo'));
  ok(b.hasDeclaration('const a=1;let b=2,foo=3;', 'foo'), 'a second declarator of a merged declaration');
  ok(b.hasDeclaration('var $x=1', '$x'), 'a name with $');
  ok(!b.hasDeclaration('x.foo();', 'foo'), 'a call');
  ok(!b.hasDeclaration('foo=1;', 'foo'), 'an assignment');
  ok(!b.hasDeclaration('function foobar(){}', 'foo'), 'a longer name');
  ok(!b.hasDeclaration('a.foo=1;', 'foo'), 'a property');
});

test('build: --check also fails when a bundle differs in size from the manifest (a hand-edited bundle with a matching manifest hash)', () => {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ahm-dist-'));
  try {
    const fresh = () => fs.cpSync(b.DIST, tmp, { recursive: true });
    fresh();
    ok(!b.stale(tmp), 'an untouched copy is not stale');
    fs.appendFileSync(path.join(tmp, 'app.min.js'), '\n');
    ok(b.stale(tmp), 'app.min.js longer than the manifest says');
    fresh();
    fs.appendFileSync(path.join(tmp, 'app.min.css'), ' ');
    ok(b.stale(tmp), 'app.min.css longer than the manifest says');
    fresh();
    const m = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
    m.bytes['app.min.js'] -= 1;
    fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(m));
    ok(b.stale(tmp), 'a manifest that states another size');
    fresh();
    fs.rmSync(path.join(tmp, 'app.min.css'));
    ok(b.stale(tmp), 'a missing bundle file');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Terrain tile builder (T-053, tools/terrain/): the unit tests are Python (numpy and Pillow). Without them (a plain CI image) the test says so loudly
// and does not run: a follow-up in TODO.md asks the owner to add `pip install numpy pillow` to tools/ci.sh (a protected file).
test('terrain tool: the Python unit tests of tools/terrain pass (the GeoTIFF adapter is NOT covered)', () => {
  const { spawnSync } = require('child_process');
  const dir = path.join(ROOT, 'tools', 'terrain');
  const have = spawnSync('python3', ['-I', '-c', 'import numpy, PIL'], { encoding: 'utf8' });
  if (have.status !== 0) {
    console.log('  !!   terrain tool tests NOT RUN: python3 with numpy and Pillow is missing here (' + String(have.stderr || have.error).trim().split('\n').pop() + ')');
    return;
  }
  const r = spawnSync('python3', ['-I', '-m', 'unittest', 'discover', '-s', dir, '-p', 'test_*.py'], { encoding: 'utf8' });
  ok(r.status === 0, 'python unit tests failed:\n' + String(r.stderr).split('\n').slice(-25).join('\n'));
});

// ---- tools/assets/build.js (T-069) ----
const os = require('os');
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
