const { test, ok, eq, J, throws } = require('./lib/harness');
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

// ---- T-046: certainty and source filters ----
test('evidence: run filters by certainty and by source; empty sets filter nothing; an object without them never matches a chosen one', () => {
  const p = page();
  p.X("places[0].certainty = 'approximate'; places[0].sources = ['s1', 's2']; places[1].certainty = 'disputed'; places[1].sources = ['s2']; places[2].certainty = 'exact'");
  const ids = (o) => p.X('run(__0).map((r) => r.p.id)', o).slice().sort();
  eq(['p1', 'p2', 'p3', 'p4'], ids({}));
  eq(['p1'], ids({ certainty: new Set(['approximate']) }));
  eq(['p1', 'p2'], ids({ certainty: new Set(['approximate', 'disputed']) }));
  eq(['p1', 'p2'], ids({ sources: new Set(['s2']) }));
  eq(['p1'], ids({ sources: new Set(['s1']), certainty: new Set(['approximate']) }), 'both filters must hold');
  eq([], ids({ sources: new Set(['s1']), certainty: new Set(['disputed']) }));
});

test('evidence: shapesRun filters the same way', () => {
  const p = page();
  const mk = (id, c, s) => ({ ...mkShape(id, null, null, null), certainty: c, sources: s });
  p.X('shapes = __0', [mk('a', 'approximate', ['s1']), mk('b', 'disputed', ['s2']), mk('c', undefined, undefined)]);
  const ids = (o) => p.X('shapesRun(__0).map((s) => s.id)', o).slice().sort();
  eq(['a', 'b', 'c'], ids({}));
  eq(['b'], ids({ certainty: new Set(['disputed']) }));
  eq(['a'], ids({ sources: new Set(['s1']) }));
});

test('evidence: sourceById finds a source of the dictionary, loadSources reads sources.json, a missing file means no sources', async () => {
  const p = page();
  p.X("sources = [{ id: 's1', title: 'Strabo' }]");
  eq('Strabo', p.X("sourceById('s1').title"));
  eq(undefined, p.X("sourceById('nope')"));
});

// ---- T-046: certainty, radius and sources in the sheet and the forms ----
const withSources = () => {
  const p = page();
  p.X("sources = [{ id: 's1', title: 'Strabo', citation: 'book 11', url: 'https://example.org/s' }, { id: 's2', title: 'Khorenatsi' }]");
  return p;
};

test('evidence: the sheet says certainty, radius and sources, links only http(s) urls, and is empty when there is nothing to say', () => {
  const p = withSources();
  eq('', p.X('evidenceHTML(__0)', {}));
  const h = p.X('evidenceHTML(__0)', { certainty: 'approximate', radius_m: 5000, sources: ['s1', 's2', 'gone'] });
  ok(h.includes('Approximate') && h.includes('about 5 km'), h);
  ok(h.includes('<a href="https://example.org/s"') && h.includes('rel="noopener noreferrer"') && h.includes('>Strabo</a>'), 'the source with a link is a link');
  ok(h.includes('Khorenatsi') && !h.includes('gone'), 'a source without a link is text; an id that is not in the dictionary is left out');
  ok(p.X('evidenceHTML(__0)', { certainty: 'disputed', radius_m: 800 }).includes('about 800 m'));
  ok(!p.X('evidenceHTML(__0)', { sources: [] }).includes('Sources'));
  ok(p.X('evidenceHTML(__0)', { certainty: 'exact' }).includes('Exact'));
});

test('evidence: the form has certainty, sources (ticked as saved) and, for places only, the radius', () => {
  const p = withSources();
  const f = p.X('evidenceFormHTML(__0, true)', { certainty: 'disputed', radius_m: 1200, sources: ['s2'] });
  ok(/<option value="disputed" selected>/.test(f), 'certainty selected');
  ok(/class="pf-rad"[^>]*value="1200"/.test(f), 'radius filled');
  ok(/value="s2" checked/.test(f) && !/value="s1" checked/.test(f), 'only the saved source is ticked');
  ok(!p.X('evidenceFormHTML(__0, false)', {}).includes('pf-rad'), 'a border has no radius');
});

test('evidence: reading the form gives null / [] for what is empty (so a save clears it), checks the radius, and leaves the radius out for borders', () => {
  const p = withSources();
  const root = (cert, rad, ticked) => ({
    querySelector: (s) => ({ '.pf-cert': { value: cert }, '.pf-rad': rad === undefined ? null : { value: rad } }[s] || null),
    querySelectorAll: () => ['s1', 's2'].map((v) => ({ value: v, checked: ticked.includes(v) })),
  });
  const read = (r, rad) => J(p.X('evidenceRead(__0, __1)', r, rad));
  eq({ certainty: 'approximate', sources: ['s2'], radius_m: 300 }, read(root('approximate', '300', ['s2']), true));
  eq({ certainty: null, sources: [], radius_m: null }, read(root('', '', []), true));
  eq({ certainty: 'disputed', sources: ['s1'] }, read(root('disputed', undefined, ['s1']), false));
  for (const bad of ['0', '2.5', 'far', '1000001']) throws(/Radius/, () => p.X('evidenceRead(__0, true)', root('', bad, [])));
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
