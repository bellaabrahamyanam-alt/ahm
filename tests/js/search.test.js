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

// ---- T-041: versions of one shape in time ----
const mkShape = (id, series, a, b) => ({ id, series, names: [{ lang: 'en', name: id }], type: 'x', date_from: a, date_to: b, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } });

test('series: shapeVersions lists the other versions of the same series, oldest first; none for a shape without a series', () => {
  const p = page();
  const y = (n) => ({ fmt: 'y', ts: isoYear(n), mode: 'exact', ts_to: null });
  p.X('shapes = __0', [mkShape('c', 'S', y(300), null), mkShape('a', 'S', y(100), y(199)), mkShape('b', 'S', y(200), y(299)), mkShape('z', null, null, null), mkShape('o', 'T', y(1), y(2))]);
  eq(['a', 'b'], p.X("shapeVersions(shapeById('c')).map((s) => s.id)"));
  eq(['b', 'c'], p.X("shapeVersions(shapeById('a')).map((s) => s.id)"));
  eq([], p.X("shapeVersions(shapeById('z'))"));
});

test('series: versionEndBefore closes an open version the day before the new one starts, and leaves the other cases alone', () => {
  const p = page();
  const y = (n) => ({ fmt: 'y', ts: isoYear(n), mode: 'exact', ts_to: null });
  const end = (prev, from) => J(p.X('versionEndBefore(__0, __1)', prev, from));
  eq({ fmt: 'ymd', ts: '0199-12-31T00:00:00Z', mode: 'exact', ts_to: null }, end(mkShape('a', 'S', y(100), null), y(200)));
  eq({ fmt: 'ymd', ts: '0199-12-31T00:00:00Z', mode: 'exact', ts_to: null }, end(mkShape('a', 'S', null, null), y(200)), 'no start is fine');
  eq(null, end(mkShape('a', 'S', y(100), y(150)), y(200)), 'already has an end');
  eq(null, end(mkShape('a', 'S', y(200), null), y(200)), 'starts at or after the new version');
  eq(null, end(mkShape('a', 'S', y(100), null), null), 'the new version has no start');
});

// ---- T-043: names over time ----
const yr = (n) => ({ fmt: 'y', ts: isoYear(n), mode: 'exact', ts_to: null });
const named = (...names) => ({ id: 'n', names: names.map(([lang, name, a, b]) => ({ lang, name, ...(a ? { date_from: yr(a) } : {}), ...(b ? { date_to: yr(b) } : {}) })) });
const sec = (n) => Date.parse(isoYear(n)) / 1000;

test('names: nameAt takes the first name of the language whose period holds the moment, else the first name of that language', () => {
  const p = page();
  const at = (item, lang, a) => p.X('nameAt(__0, __1, __2)', item, lang, a === null ? null : sec(a));
  const it = named(['en', 'Dwin'], ['en', 'Dvin', 450, 900], ['ru', 'Двин'], ['en', 'Tigranakert', 100, 400]);
  eq('Dwin', at(it, 'en', null), 'slider off: the first name, as before');
  eq('Dvin', at(it, 'en', 600), 'inside the period of the second name');
  eq('Tigranakert', at(it, 'en', 200));
  eq('Dwin', at(it, 'en', 1500), 'outside every period: the first name of the language');
  eq('Двин', at(it, 'ru', 600), 'no period: that name');
  eq('Dvin', at(it, 'hy', 600), 'language not present: English (as label() always did), by the same rule');
  eq('Dvin', at(it, 'en', 900), 'the end year is included');
  eq('Dwin', at(it, 'en', 901), 'and the year after is not');
});

test('names: label and shapeName follow the time bar; with the bar off they give the first name', () => {
  const p = timed({ at: '0600-01-01T00:00:00Z' });
  const it = named(['en', 'Dwin'], ['en', 'Dvin', 450, 900]);
  eq('Dvin', p.X('label(__0, "en")', it));
  eq('Dvin', p.X('shapeName(__0, "en")', it));
  p.X("AHM.state.patch('time', { at: null })");
  eq('Dwin', p.X('label(__0, "en")', it));
});

test('names: search finds an old name, and nameMatch says which name matched when it is not the shown one', () => {
  const p = page();
  p.X('places[0].names = __0', named(['en', 'Dwin'], ['en', 'Dvin', 450, 900]).names);
  p.set('dvin');
  ok(p.ids().includes('p1'), 'found by the old name');
  eq('Dvin', p.X('nameMatch(places[0], "dvin", "")'), 'the matching name');
  eq('', p.X('nameMatch(places[0], "dwin", "")'), 'the shown name matched: nothing to say');
  eq('', p.X('nameMatch(places[0], "", "")'), 'no search text');
});

test('names: the name row of the place and border forms has a period (open when the name has one), the row of other forms does not', () => {
  const p = page();
  const dated = p.X('pfRowDated(__0)', { lang: 'en', name: 'Dvin', date_from: yr(450), date_to: yr(900) });
  ok(dated.includes('pf-nfrom') && dated.includes('pf-nto'), 'both date fields');
  ok(/<details class="pf-period" open>/.test(dated), 'open for a name that has a period');
  ok(dated.endsWith('</details></div>'), 'inside the row');
  ok(!/<details class="pf-period" open>/.test(p.X('pfRowDated(__0)', { lang: 'en', name: 'Dwin' })), 'closed for a name without one');
  ok(!p.X('pfRow(__0)', { lang: 'en', name: 'x' }).includes('pf-period'), 'the plain row (layers, types, categories) has none');
});
