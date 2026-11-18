#!/usr/bin/env node
// One small asset builder for every project that serves classic (non-module) scripts and plain CSS: this repository, a phpBB extension,
// a phpBB style. Copy THIS FILE next to a config file; it needs nothing else (the minifiers below are optional and found by `require`).
//   node build.js [config.json]          build every bundle of the config (default: assets.config.json in the current folder)
//   node build.js [config.json] --check  exit 1 if a bundle is missing or was built from other sources (for CI; needs no minifier)
//   node build.js [config.json] --engine bun|terser|none   force an engine (default "auto", see below)
//
// config.json (paths are relative to the folder of the config file):
//   { "engine": "auto",
//     "bundles": [ { "name": "forum", "outDir": "dist",
//                    "js":  ["js/a.js", "js/b.js"],              // ORDER MATTERS: the files share one global scope, nothing is sorted
//                    "css": ["css/a.css", "css/b.css"] } ] }     // either list may be empty or missing
// Output: <outDir>/<name>.min.js, <outDir>/<name>.min.css and <outDir>/<name>.manifest.json (hash of the sources, sizes, engine).
//
// Engines: JS "terser" (needs `npm i terser`) minifies names INSIDE functions only: `toplevel` is off, so every global name stays (the scripts call
// each other by name). CSS "lightningcss" (needs `npm i lightningcss`) minifies and merges rules, and never changes what browsers support (no targets).
// "bun" is the fallback for both (`bun build --minify`, whitespace and syntax only: no renaming). "none" only joins the files (tests, debugging).
// "auto" = terser + lightningcss when installed, else Bun, else the build stops with a message: it never writes a bundle in silence with another engine.
//
// CSS: `@import` is refused (the file would be fetched again by the browser; list the file in "css" instead). A relative url(...) is rewritten when the
// bundle is written to another folder than the css file, so images and fonts keep working.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const VERSION = 'assets-v1'; // part of the hash: a changed rule here rebuilds every bundle

const sha = (...parts) => {
  const h = crypto.createHash('sha256').update(VERSION);
  for (const p of parts) h.update('\0').update(p);
  return h.digest('hex');
};

function loadConfig(file) {
  const abs = path.resolve(file);
  const cfg = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (!Array.isArray(cfg.bundles) || !cfg.bundles.length) throw new Error(`${file}: "bundles" must be a non-empty list`);
  const names = new Set();
  for (const b of cfg.bundles) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(b.name || '')) throw new Error(`${file}: a bundle needs a "name" of letters, digits, - or _ (got ${JSON.stringify(b.name)})`);
    if (names.has(b.name)) throw new Error(`${file}: two bundles are named "${b.name}"`);
    names.add(b.name);
    if (!b.outDir) throw new Error(`${file}: bundle "${b.name}" has no "outDir"`);
    if (!(b.js || []).length && !(b.css || []).length) throw new Error(`${file}: bundle "${b.name}" has no js and no css`);
    for (const f of [...(b.js || []), ...(b.css || [])]) if (!fs.existsSync(path.resolve(path.dirname(abs), f))) throw new Error(`${file}: bundle "${b.name}": missing file ${f}`);
  }
  return { cfg, dir: path.dirname(abs) };
}

// A `;` line between scripts: a script that starts with `(` must not continue the previous one.
const joinJs = (texts) => texts.join('\n;\n');

/** Joins css files; refuses @import; rewrites relative url(...) from the folder of each file to `outDir`. `files` are absolute paths. */
function joinCss(files, outDir) {
  return files
    .map((f) => {
      const css = fs.readFileSync(f, 'utf8');
      if (/@import\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) throw new Error(`${f}: @import is not supported, list that file in "css" instead`);
      const from = path.dirname(f);
      if (path.resolve(from) === path.resolve(outDir)) return css;
      return css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (m, q, u) => {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/|#|data:)/i.test(u) || u.startsWith('{') || u.includes('<')) return m; // absolute, data:, #fragment, template variable
        const p = u.match(/^[^?#]*/)[0], tail = u.slice(p.length); // keep ?query and #fragment
        const moved = path.relative(outDir, path.resolve(from, p)).split(path.sep).join('/');
        return `url(${q}${moved}${tail}${q})`;
      });
    })
    .join('\n');
}

const tryRequire = (name) => {
  try {
    return require(name);
  } catch (e) {
    return null;
  }
};
const hasBun = () => spawnSync('bun', ['--version'], { encoding: 'utf8' }).status === 0;

/** { js: 'terser'|'bun'|'none', css: 'lightningcss'|'bun'|'none' } for the wanted engine, or throws with what to install. */
function pickEngines(want) {
  if (want === 'none') return { js: 'none', css: 'none' };
  if (want === 'bun') return { js: 'bun', css: 'bun' };
  const terser = tryRequire('terser'), lcss = tryRequire('lightningcss');
  if (want === 'terser') {
    if (!terser || !lcss) throw new Error(`engine "terser" needs: npm i terser lightningcss (missing: ${[!terser && 'terser', !lcss && 'lightningcss'].filter(Boolean).join(', ')})`);
    return { js: 'terser', css: 'lightningcss' };
  }
  if (terser && lcss) return { js: 'terser', css: 'lightningcss' };
  if (hasBun()) return { js: 'bun', css: 'bun' };
  throw new Error('no minifier: run `npm i terser lightningcss` here, or install Bun, or pass --engine none to only join the files');
}

function bunMin(code, ext, flags) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  try {
    const i = path.join(tmp, 'in.' + ext), o = path.join(tmp, 'out.' + ext);
    fs.writeFileSync(i, code);
    const r = spawnSync('bun', ['build', i, ...flags, '--outfile', o], { encoding: 'utf8' });
    if (r.error || r.status !== 0) throw new Error(`bun build failed: ${r.error || r.stderr || r.stdout}`);
    return fs.readFileSync(o, 'utf8');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function minJs(code, engine) {
  if (engine === 'none') return code;
  if (engine === 'bun') return bunMin(code, 'js', ['--no-bundle', '--minify-whitespace', '--minify-syntax']);
  const r = await require('terser').minify(code, {
    ecma: 2020,
    compress: { passes: 2, toplevel: false, unused: true }, // toplevel false: a top-level function or variable may be used by another file
    mangle: { toplevel: false }, // names inside functions only
    format: { comments: false },
  });
  if (r.error) throw r.error;
  return r.code;
}

async function minCss(code, engine) {
  if (engine === 'none') return code;
  if (engine === 'bun') return bunMin(code, 'css', ['--minify']);
  const r = require('lightningcss').transform({ filename: 'bundle.css', code: Buffer.from(code), minify: true }); // no targets: no syntax is lowered or prefixed
  return r.code.toString();
}

/** The hash a bundle must have (sources, their order, their paths and the rules of this file). */
function hashOf(b, dir) {
  const parts = [JSON.stringify([b.js || [], b.css || [], b.outDir])];
  for (const f of [...(b.js || []), ...(b.css || [])]) parts.push(f, fs.readFileSync(path.resolve(dir, f)));
  return sha(...parts);
}

const manifestPath = (b, dir) => path.resolve(dir, b.outDir, b.name + '.manifest.json');

/** true when the bundle was not built from the current sources, or a built file is missing or differs in size (hand-edited). */
function stale(b, dir) {
  const mf = manifestPath(b, dir);
  if (!fs.existsSync(mf)) return true;
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  if (m.hash !== hashOf(b, dir)) return true;
  return Object.entries(m.bytes || {}).some(([f, n]) => !fs.existsSync(path.resolve(dir, b.outDir, f)) || fs.statSync(path.resolve(dir, b.outDir, f)).size !== n);
}

async function buildBundle(b, dir, want) {
  const out = path.resolve(dir, b.outDir);
  const eng = pickEngines(want);
  fs.mkdirSync(out, { recursive: true });
  const bytes = {}, before = {};
  if ((b.js || []).length) {
    const raw = joinJs(b.js.map((f) => fs.readFileSync(path.resolve(dir, f), 'utf8')));
    const min = await minJs(raw, eng.js);
    fs.writeFileSync(path.join(out, b.name + '.min.js'), min);
    bytes[b.name + '.min.js'] = Buffer.byteLength(min);
    before[b.name + '.min.js'] = Buffer.byteLength(raw);
  }
  if ((b.css || []).length) {
    const raw = joinCss(b.css.map((f) => path.resolve(dir, f)), out);
    const min = await minCss(raw, eng.css);
    fs.writeFileSync(path.join(out, b.name + '.min.css'), min);
    bytes[b.name + '.min.css'] = Buffer.byteLength(min);
    before[b.name + '.min.css'] = Buffer.byteLength(raw);
  }
  const manifest = { hash: hashOf(b, dir), engine: eng, js: b.js || [], css: b.css || [], bytes };
  fs.writeFileSync(manifestPath(b, dir), JSON.stringify(manifest, null, 2) + '\n');
  return { bytes, before, engine: eng };
}

async function main(argv) {
  const args = argv.slice(2);
  const ei = args.indexOf('--engine');
  const want = ei >= 0 ? args.splice(ei, 2)[1] : null;
  const check = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--')) || 'assets.config.json';
  const { cfg, dir } = loadConfig(file);
  if (check) {
    const old = cfg.bundles.filter((b) => stale(b, dir)).map((b) => b.name);
    if (old.length) return console.error(`stale or missing bundle(s): ${old.join(', ')}. Run \`node build.js ${file}\` and commit the output.`), 1;
    console.log(`all ${cfg.bundles.length} bundle(s) are up to date`);
    return 0;
  }
  for (const b of cfg.bundles) {
    const r = await buildBundle(b, dir, want || cfg.engine || 'auto');
    for (const [f, n] of Object.entries(r.bytes)) console.log(`${b.name}: ${f} ${r.before[f]} -> ${n} bytes (${r.engine[f.endsWith('.js') ? 'js' : 'css']})`);
  }
  return 0;
}

module.exports = { loadConfig, joinJs, joinCss, hashOf, stale, buildBundle, pickEngines, minJs, minCss };

if (require.main === module) main(process.argv).then((c) => process.exit(c), (e) => (console.error('build failed: ' + e.message), process.exit(1)));
