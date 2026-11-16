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
