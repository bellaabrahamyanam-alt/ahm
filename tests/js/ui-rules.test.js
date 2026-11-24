// Static check of THE RULE (docs/design-migration/01-design-system.md): runs in node, no browser.
const { test, ok } = require('./lib/harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SHARED = ['kit', 'fields', 'footer', 'shell', 'dialogs'].map((n) => `app/js/sidebar/${n}.js`).filter((f) => fs.existsSync(path.join(ROOT, f)));
const FOUNDATION_CSS = ['app/css/base.css', 'app/css/shell.css'];
const HTML = read('app/index.html');
const REGIONS = ['head', 'shell', 'footer', 'dialogs', 'templates', ...['explore', 'borders', 'routes', 'rivers', 'layers', 'more'].flatMap((n) => [`tab-${n}`, `tpl-${n}`])];

test('ui-rules (a): shared scripts never build markup (innerHTML, outerHTML, insertAdjacentHTML, document.write, createContextualFragment)', () => {
  ok(SHARED.length >= 2, 'the shared scripts exist');
  const bad = [];
  for (const f of SHARED)
    read(f).split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/insertAdjacentHTML|outerHTML|document\.write|createContextualFragment/.test(code)) bad.push(`${f}:${i + 1}`);
      if (/innerHTML/.test(code) && !/innerHTML\s*=\s*(''|"")\s*;?\s*$/.test(code)) bad.push(`${f}:${i + 1}`);
    });
  ok(bad.length === 0, 'markup built in JS at ' + bad.join(', '));
});

// classes defined by `.name` selectors in a stylesheet
const classesOf = (css) => new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:^|[\s,>+~(:)])\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]));
function daisyCss() {
  const c = [process.env.AHM_DAISYUI_CSS, 'app/node_modules/daisyui/daisyui.css', 'node_modules/daisyui/daisyui.css'].filter(Boolean).map((f) => (path.isAbsolute(f) ? f : path.join(ROOT, f)));
  return c.find((f) => fs.existsSync(f));
}
test('ui-rules (b): the foundation CSS defines no class that daisyUI owns', () => {
  const f = daisyCss();
  if (!f) return console.log('    (daisyui.css not found in node_modules and AHM_DAISYUI_CSS not set: check skipped)');
  const owned = classesOf(fs.readFileSync(f, 'utf8'));
  for (const css of FOUNDATION_CSS) {
    const clash = [...classesOf(read(css))].filter((c) => owned.has(c));
    ok(clash.length === 0, `${css} defines daisyUI classes: ${clash.join(', ')}`);
  }
  // the older sidebar files are cleaned by the screen workers: report, never fail
  const legacy = ['sidebar', 'shapes', 'explore', 'layers'].flatMap((n) => [...classesOf(read(`app/css/${n}.css`))].filter((c) => owned.has(c)));
  if (legacy.length) console.log(`    (legacy css still defines ${new Set(legacy).size} daisyUI class names: ${[...new Set(legacy)].join(' ')})`);
});

test('ui-rules (c): the 14 region markers of index.html are present and paired, each once', () => {
  for (const r of REGIONS) {
    const open = HTML.split(`<!-- ahm:region ${r} -->`).length - 1,
      close = HTML.split(`<!-- /ahm:region ${r} -->`).length - 1;
    ok(open === 1 && close === 1, `region ${r}: ${open} open, ${close} close`);
    ok(HTML.indexOf(`<!-- ahm:region ${r} -->`) < HTML.indexOf(`<!-- /ahm:region ${r} -->`), `region ${r} closes before it opens`);
  }
  ok((HTML.match(/<!-- \/?ahm:region /g) || []).length === REGIONS.length * 2, 'no other ahm:region marker');
});

test('ui-rules (d): every data-bind of a template or dialog is used by the code that fills it', () => {
  const code = fs.readdirSync(path.join(ROOT, 'app/js/sidebar')).map((f) => read('app/js/sidebar/' + f)).join('\n');
  const blocks = [...HTML.matchAll(/<template[\s\S]*?<\/template>|<dialog id="ahm-[\s\S]*?<\/dialog>/g)].map((m) => m[0]);
  const missing = new Set();
  for (const b of blocks) for (const m of b.matchAll(/data-bind="([\w-]+)"/g)) if (!new RegExp(`\\b${m[1]}\\b`).test(code)) missing.add(m[1]);
  ok(missing.size === 0, 'data-bind never referenced by code: ' + [...missing].join(', '));
});
