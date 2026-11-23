// Tests of the sidebar domain (DOMAINS.md; owner: sidebar). Placeholder, comments only, so that the file exists
// (tests/js/domains.test.js requires every registered file to exist). `sidebar-tdd: task 007` fills it
// (tasks/007-sidebar-fixes.md); tasks 012 and 014 add to it.

const { test, ok, eq, J } = require('./lib/harness');
const { load, UI_STANDINS } = require('./lib/ctx');

// ---- types dictionary (INTERFACES.md I-8) ----
const TYPES_DICT = [
  { code: 'city', geometry: 'point', names: [{ lang: 'en', name: 'City' }, { lang: 'ru', name: 'Город' }], color: '#b3261e', style: { symbol: 'circle', size: 10 } },
  { code: 'iron-mine', geometry: 'point', names: [{ lang: 'ru', name: 'Рудник' }, { lang: 'hy', name: 'Հանք' }], color: '#a0522d', style: { symbol: 'pickaxe', size: 9 } },
  { code: 'odd', geometry: 'point', names: [{ lang: 'en', name: 'Odd' }], color: 'red', style: { symbol: 'no-such-symbol', size: 99 } },
  { code: 'border', geometry: 'line', names: [{ lang: 'en', name: 'Border' }], color: '#000000', style: {} },
];

test('types: the place form offers the point types of the dictionary, sorted by name, keeps an unknown current type', () => {
  const p = load(['config.js', 'data.js', 'placeform.js']);
  p.X('types = __0', TYPES_DICT);
  const h = p.X('typeOptions("iron-mine", "en")');
  ok(h.includes('<option value="iron-mine" selected>'), 'current is selected');
  ok(!h.includes('border'), 'no line types');
  ok(h.indexOf('value="city"') < h.indexOf('value="odd"'), 'sorted by name');
  ok(p.X('typeOptions("gone", "en")').includes('value="gone" selected'), 'a type not in the dictionary stays visible');
});

test('types: svgToPath joins the shapes of an SVG file into one path and takes the box from the viewBox', () => {
  const p = load(['config.js', 'data.js', 'placeform.js']);
  const r = (svg) => J(p.X('svgToPath(__0)', svg));
  eq({ path: 'M256 10L500 500H10z', box: 512 }, r('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 10L500 500H10z"/></svg>'));
  eq({ path: 'M2 3H12V9H2Z', box: 24 }, r('<svg width="24" height="24"><rect x="2" y="3" width="10" height="6"/></svg>'), 'rectangle');
  eq('M2 5A3 3 0 1 0 8 5A3 3 0 1 0 2 5Z', r('<svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="3"/></svg>').path, 'circle');
  eq('M0 0L10 0L5 8Z', r("<svg><polygon points='0,0 10,0 5,8'/></svg>").path, 'polygon');
  eq('M0 0L1 1 M5 5L6 6', r('<svg><path d="M0 0L1 1"/><path fill="red" d="M5 5L6 6"/></svg>').path, 'paths joined');
  eq({ path: '', box: 24 }, r('<svg><text>hi</text><image href="x.png"/></svg>'), 'nothing drawable');
  eq(24, r('<svg viewBox="0 0 3000 3000"><path d="M0 0L1 1"/></svg>').box, 'a box outside 8..2048 becomes 24');
});

test('types: svgToPath refuses an SVG it would draw wrong (viewBox not starting at 0 0, any transform) and says why', () => {
  const p = load(['config.js', 'data.js', 'placeform.js']);
  const r = (svg) => J(p.X('svgToPath(__0)', svg));
  eq({ path: '', box: 24, why: 'origin' }, r('<svg viewBox="-12 -12 24 24"><path d="M0 0L5 5"/></svg>'));
  eq('origin', r('<svg viewBox="0 3 24 24"><path d="M0 0L5 5"/></svg>').why);
  eq({ path: '', box: 24, why: 'transform' }, r('<svg viewBox="0 0 24 24"><g transform="scale(2)"><path d="M0 0L5 5"/></g></svg>'));
  eq('transform', r('<svg viewBox="0 0 24 24"><path transform="translate(1 1)" d="M0 0L5 5"/></svg>').why);
});

test('types: a type name is written by administrators, so it never reaches HTML without esc()', () => {
  const fs = require('fs'),
    path = require('path'),
    dir = path.join(__dirname, '..', '..', 'app', 'js', 'sidebar');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    fs.readFileSync(path.join(dir, f), 'utf8').split('\n').forEach((line, i) => {
      // inside a template it must be esc(typeLabel(...)); routes.js puts one into a dropdown key that it escapes when it makes the <option>
      const raw = line.replace(/\$\{esc\(typeLabel\(/g, '').includes('${typeLabel(');
      ok(!raw || f === 'routes.js', `${f}:${i + 1} prints typeLabel without esc()`);
    });
  }
});

// ---- T-040: the time bar ----
function timePage() {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'shapes.js', 'timebar.js'], UI_STANDINS);
  const y = (n) => ({ fmt: 'y', ts: String(n).padStart(4, '0') + '-01-01T00:00:00Z', mode: 'exact', ts_to: null });
  p.X('places = __0; shapes = []', [{ id: 'a', date_from: y(100), date_to: y(300) }, { id: 'b', date_from: y(500), date_to: null }]);
  p.time = () => J(p.X("JSON.parse(JSON.stringify(AHM.state.get('time')))"));
  return p;
}

test('time bar: "Time" starts at the earliest date of the data, "Off" switches back and stops play', () => {
  const p = timePage();
  eq(null, p.time().at);
  p.X('tbOpen()');
  eq('0100-01-01T00:00:00Z', p.time().at);
  p.X('tbPlay(true)');
  eq(true, p.time().playing);
  p.X('tbOff()');
  eq({ at: null, playing: false, speed: 10, undated: true }, p.time());
});

test('time bar: a step of play moves the moment by the speed and stops at the latest date', () => {
  const p = timePage();
  p.X("AHM.state.patch('time', { at: '0100-01-01T00:00:00Z', speed: 10 })");
  p.X('tbTick(1000)');
  ok(p.time().at.startsWith('0110-'), 'ten years later: ' + p.time().at);
  p.X("AHM.state.patch('time', { at: '0500-01-01T00:00:00Z', playing: true, speed: 500 })");
  p.X('tbTick(1000)');
  eq(false, p.time().playing, 'at the end play stops');
  ok(p.time().at.startsWith('0500-12-31') || p.time().at.startsWith('0501-01-01'), 'and the moment stays at the end: ' + p.time().at);
  p.X('tbOff()');
});

test('time bar: every change of the moment refreshes the lists and the map (update)', () => {
  const p = timePage();
  p.calls.length = 0;
  p.X("AHM.state.patch('time', { at: '0200-01-01T00:00:00Z' })");
  ok(p.calls.includes('update'), 'update() ran');
  p.X('tbOff()');
});

// ---- foundation F1: design tokens and daisyUI theme (tasks/foundation.md) ----
{
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('./lib/ctx');
  const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
  const HTML = read('app', 'index.html');
  const BASE = read('app', 'css', 'base.css');
  const THEME = BASE.slice(BASE.indexOf('daisyUI theme "paper-and-pencil"'));

  test('foundation F1: daisyUI comes from the CDN with an exact version, before our own css block', () => {
    const m = HTML.match(/href="(https:\/\/cdn\.jsdelivr\.net\/npm\/daisyui@\d+\.\d+\.\d+\/daisyui\.css)"/);
    ok(m, 'index.html links daisyui.css with an exact version');
    ok(HTML.indexOf(m[1]) < HTML.indexOf('<!-- ahm:css -->'), 'the CDN link is outside the bundled css block and comes before it');
  });

  test('foundation F1: the theme is applied; colours.css never exists', () => {
    ok(/<html [^>]*data-theme="paper-and-pencil"/.test(HTML), 'html has data-theme="paper-and-pencil"');
    ok(!HTML.includes('colours.css'), 'index.html does not mention colours.css');
    ok(!fs.existsSync(path.join(ROOT, 'app', 'css', 'colours.css')), 'app/css/colours.css does not exist');
  });

  test('foundation F1: the theme block defines no colour of its own and every token it uses exists in base.css', () => {
    ok(/:root\[data-theme='paper-and-pencil'\]/.test(THEME), 'one theme selector');
    ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/.test(THEME.replace(/\/\*[\s\S]*?\*\//g, '')), 'no literal colour');
    const used = [...new Set([...THEME.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
    const defined = new Set([...BASE.slice(0, BASE.indexOf('daisyUI theme "paper-and-pencil"')).matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
    const missing = used.filter((t) => !defined.has(t));
    eq([], missing, 'tokens used in the theme block but not defined in base.css');
  });

  test('foundation F1: the theme block sets every daisyUI colour and radius variable', () => {
    const need = ['base-100', 'base-200', 'base-300', 'base-content', 'primary', 'primary-content', 'secondary', 'secondary-content', 'accent', 'accent-content', 'neutral', 'neutral-content', 'info', 'info-content', 'success', 'success-content', 'warning', 'warning-content', 'error', 'error-content']
      .map((n) => '--color-' + n)
      .concat(['--radius-selector', '--radius-field', '--radius-box', '--size-selector', '--size-field', '--border', '--depth', '--noise']);
    eq([], need.filter((v) => !new RegExp(v + '\\s*:').test(THEME)), 'daisyUI variables missing from the theme block');
  });
}

// ---- foundation F3/F4: shared components (tasks/foundation.md) ----
{
  const comp = () => load(['config.js', 'dates.js', 'data.js', 'datefield.js', 'components.js'], UI_STANDINS);
  test('foundation F3: the format menu lists every date format of dates.js exactly once, grouped by precision', () => {
    const p = comp();
    const groups = p.X('uiDateFormatGroups()');
    eq(['Full date', 'Month', 'Year and coarser'], groups.map((g) => g.title), 'group titles (prototype s47)');
    const ids = groups.flatMap((g) => g.formats.map((f) => f.id));
    eq(p.X('DATE_FORMATS').map((f) => f.id).sort(), ids.slice().sort(), 'every id once');
    ok(groups[0].formats[0].example === '1500-03-21', 'carries the example of dates.js');
  });
  test('foundation F3: uiDateEditor.preview shows the date as the stored model says, empty for Unknown', () => {
    const p = comp();
    eq('', p.X('uiDateEditor.preview(null)'), 'unknown');
    eq('c. 16th century', p.X("uiDateEditor.preview({ fmt: 'c', mode: 'approx', ts: '1501-01-01T00:00:00Z', ts_to: null })"), 'approx century');
    eq('March 1500 – June 1502', p.X("uiDateEditor.preview({ fmt: 'mony', mode: 'range', ts: '1500-03-01T00:00:00Z', ts_to: '1502-06-01T00:00:00Z' })"), 'range');
  });
  test('foundation F3: uiDateEditor.html is the old date field (same markup as dfHTML)', () => {
    const p = comp();
    eq(p.X("dfHTML('x', null)"), p.X("uiDateEditor.html('x', null)"), 'same html');
  });
}

// ---- foundation F2: app shell (tasks/foundation.md) ----
{
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('./lib/ctx');
  const HTML2 = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
  const LAYOUT = fs.readFileSync(path.join(ROOT, 'app', 'js', 'sidebar', 'layout.js'), 'utf8');
  test('foundation F2: the shell has the brand header and six tabs, each an icon over a label, in the prototype order', () => {
    ok(/<header class="brand">[\s\S]*<h1>Armenian Highlands<\/h1>/.test(HTML2), 'brand header with the title');
    const tabs = [...HTML2.matchAll(/<button data-tab="(\w+)"[^>]*><svg[^>]*aria-hidden="true">[\s\S]*?<\/svg><span>([^<]+)<\/span><\/button>/g)];
    eq(['explore:Explore', 'shapes:Borders', 'routes:Routes', 'rivers:Rivers', 'layers:Layers', 'more:More'], tabs.map((m) => m[1] + ':' + m[2]), 'tabs');
  });
  test('foundation F2: a click on the icon or the label of a tab opens the tab (closest, not target)', () => {
    ok(/e\.target\.closest\("\[data-tab\]"\)/.test(LAYOUT), 'the tab click handler uses closest("[data-tab]")');
  });
}
