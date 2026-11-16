const { test, ok, eq, J } = require('./lib/harness');
const { load, UI_STANDINS, SAMPLE } = require('./lib/ctx');

// astronomical year -> ISO text (years below 0 use the expanded form)
const isoYear = (n) => (n >= 0 ? String(n).padStart(4, '0') : '-' + String(-n).padStart(6, '0')) + '-01-01T00:00:00Z';

/** a page with places p1..p4 and some notes; the filters are driven through the stand-in form fields */
function page() {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'shapes.js', 'search.js', 'searchfield.js', 'placeform.js', 'layers.js'], UI_STANDINS);
  const y = (n) => ({ fmt: 'y', ts: isoYear(n), mode: 'exact', ts_to: null });
  const pl = J(SAMPLE.places);
  pl[0].date_from = y(100);
  pl[0].date_to = y(300);
  pl[1].date_from = y(-800);
  pl[1].date_to = y(-600);
  p.X('places = __0; notes = __1; by = {}; notes.forEach(n => (by[n.place] ??= []).push(n))', pl, [
    { id: 'n1', place: 'p1', lang: 'en', title: 'Foundation', text: 'Founded by Artaxias I', date: null, layers: [] },
    { id: 'n2', place: 'p2', lang: 'en', title: 'Excavation', text: 'Karmir Blur', date: null, layers: [] },
  ]);
  // run(options) takes plain values (INTERFACES.md I-3); the date widgets that produce `period` are tested in the browser part
  p.opts = { q: '', lang: '', sort: 'name', period: [null, null] };
  p.set = (q = '', lang = '', sort = 'name') => Object.assign(p.opts, { q, lang, sort });
  p.ids = () => p.X('run(__0).map(r => r.p.id)', p.opts);
  p.period = (a, b) => (p.opts.period = [a, b]);
  p.set();
  return p;
}

test('search: with no filter every place is listed, sorted A-Z by English name', () => {
  const p = page();
  eq(['p3', 'p1', 'p2', 'p4'].sort(), p.ids().slice().sort());
  eq(['Ararat', 'Artashat', 'Erebuni'], p.X('run(__0).map(r => label(r.p, "en")).slice(0, 3)', p.opts));
});

test('search: type filter', () => {
  const p = page();
  p.X('state.types.add("city")');
  eq(['p1'], p.ids());
  p.X('state.types.add("mountain")');
  eq(['p1', 'p3'].sort(), p.ids().slice().sort());
});

test('search: a name matches regardless of case and accents, in any language', () => {
  const p = page();
  p.set('ARTASHAT');
  eq(['p1'], p.ids());
  p.set('արտաշատ');
  eq(['p1'], p.ids());
  p.set('zzzz');
  eq([], p.ids());
});

test('search: note text is searched and returned as hits', () => {
  const p = page();
  p.set('karmir');
  eq(['p2'], p.ids());
  eq(['n2'], J(p.X('run(__0)[0].hits.map(h => h.id)', p.opts)));
});

test('search: language filter keeps places that have a name or a note in that language', () => {
  const p = page();
  p.set('', 'hy');
  eq(['p1', 'p3'].sort(), p.ids().slice().sort());
  p.set('', 'ru');
  eq(['p4'], p.ids());
});

test('search: period filter keeps places whose life overlaps it; places without dates are hidden', () => {
  const p = page();
  const s = (y) => Date.parse(isoYear(y)) / 1000;
  p.period(s(200), null); // from 200 on: p1 (100-300) overlaps
  eq(['p1'], p.ids());
  p.period(null, s(-700)); // up to the year 700 BCE: p2 (-800..-600) overlaps (year -699 = 700 BCE)
  eq(['p2'], p.ids());
  p.period(s(1000), s(1100)); // nobody lived then
  eq([], p.ids());
  p.period(null, null);
  eq(4, p.ids().length);
});

test('search: sort by date puts unknown dates last', () => {
  const p = page();
  p.set('', '', 'date');
  const ids = p.ids();
  eq(['p2', 'p1'], ids.slice(0, 2), 'oldest first');
  eq(2, new Set(ids.slice(2)).size);
});

test('search: layer filter "only" is OR over layers, "hide" is NOT IN, both combine with other filters', () => {
  const p = page();
  const L = (id, ...m) => ({ id, names: [{ lang: 'en', name: id }], descriptions: [], category: null, color: null, date_from: null, date_to: null, members: m.map((x) => ({ place: x })) });
  p.X('lySet(__0, [], [])', [L('A', 'p1', 'p2'), L('B', 'p2', 'p3')]);
  p.X('lyState.only.add("A")');
  eq(['p1', 'p2'].sort(), p.ids().slice().sort());
  p.X('lyState.only.add("B")');
  eq(['p1', 'p2', 'p3'].sort(), p.ids().slice().sort(), 'A or B');
  p.X('lyState.only.clear(); lyState.hide.add("A")');
  eq(['p3', 'p4'].sort(), p.ids().slice().sort(), 'not in A');
  p.X('lyState.hide.add("B")');
  eq(['p4'], p.ids(), 'not in A and not in B');
  p.X('lyState.hide.clear(); lyState.only.add("A")');
  p.set('erebuni');
  eq(['p2'], p.ids(), 'layer + text');
  p.X('lyState.only.clear(); lyState.hide.clear()');
});

test('layer rules: lyState is the "layers" object of the state manager (task 002)', () => {
  const p = page();
  ok(p.X('lyState === AHM.state.get("layers")'), 'same object, not a private copy');
  eq(['editing', 'hide', 'noteAll', 'only', 'open', 'staged'], p.X('Object.keys(lyState)').slice().sort(), 'fields unchanged');
  // a change made through the state manager is seen by the layer rules at once
  p.X('AHM.state.get("layers").only.add("zz")');
  ok(p.X('lyState.only.has("zz")'));
  p.X('lyState.only.clear()');
});

// ---- T-040: the time slider filters places and shapes ----
const timed = (patch) => {
  const p = page();
  p.X("AHM.state.patch('time', __0)", patch);
  return p;
};

test('time: run keeps only the places that exist at the moment; undated places stay while "Show undated" is on', () => {
  eq(['p1', 'p2', 'p3', 'p4'], page().ids().slice().sort(), 'time off: everything');
  const p = timed({ at: '0200-01-01T00:00:00Z' });
  eq(['p1', 'p3', 'p4'], p.ids().slice().sort(), 'p2 lived -800 to -600');
  p.X("AHM.state.patch('time', { undated: false })");
  eq(['p1'], p.ids(), 'undated hidden');
  p.X("AHM.state.patch('time', { at: null })");
  eq(['p1', 'p2', 'p3', 'p4'], p.ids().slice().sort(), 'Off brings every place back');
});

test('time: timeLook says yes, faded or no for one item at the moment of the slider', () => {
  const p = timed({ at: '0200-01-01T00:00:00Z' });
  const look = (id) => p.X('timeLook(places.find((x) => x.id === __0))', id);
  eq('yes', look('p1'));
  eq('no', look('p2'));
  eq('faded', look('p3'), 'undated, shown faded');
  p.X("AHM.state.patch('time', { undated: false })");
  eq('no', look('p3'));
  p.X("AHM.state.patch('time', { at: null })");
  eq('yes', look('p2'), 'time off');
});

test('time: shapesRun follows the slider the same way (borders, rivers, routes)', () => {
  const p = timed({ at: '0200-01-01T00:00:00Z' });
  const y = (n) => ({ fmt: 'y', ts: isoYear(n), mode: 'exact', ts_to: null });
  const mk = (id, a, b) => ({ id, names: [{ lang: 'en', name: id }], type: 'x', date_from: a, date_to: b, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } });
  p.X('shapes = __0', [mk('s1', y(100), y(300)), mk('s2', y(-800), y(-600)), mk('s3', null, null)]);
  eq(['s1', 's3'], p.X('shapesRun({}).map((s) => s.id)').slice().sort());
  p.X("AHM.state.patch('time', { undated: false })");
  eq(['s1'], p.X('shapesRun({}).map((s) => s.id)'));
});
