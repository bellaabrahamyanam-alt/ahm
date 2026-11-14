const { test, ok, eq, J } = require('./lib/harness');
const { load, UI_STANDINS } = require('./lib/ctx');
const L = (id, name, ...m) => ({ id, names: [{ lang: 'en', name }], descriptions: [], category: null, color: null, date_from: null, date_to: null, members: m.map((x) => ({ place: x })) });

function page(layers = [L('A', 'Alpha', 'p1', 'p2'), L('B', 'Beta', 'p2')], cats = []) {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'shapes.js', 'routes.js', 'search.js', 'searchfield.js', 'placeform.js', 'layers.js'], UI_STANDINS);
  p.X('places = __0', [{ id: 'p1', type: 'city', names: [{ lang: 'en', name: 'One' }] }, { id: 'p2', type: 'city', names: [{ lang: 'en', name: 'Two' }] }, { id: 'p3', type: 'city', names: [{ lang: 'en', name: 'Three' }] }]);
  p.X('lySet(__0, [], __1)', layers, cats);
  return p;
}
const allows = (p, id) => p.X(`layerAllows("${id}")`);

test('layers: no filter allows every place', () => {
  const p = page();
  ['p1', 'p2', 'p3'].forEach((id) => ok(allows(p, id)));
  eq(0, p.X('lyFilterCount()'));
});

test('layers: "only" keeps members of any chosen layer (OR)', () => {
  const p = page();
  p.X('lyState.only.add("A")');
  eq([true, true, false], ['p1', 'p2', 'p3'].map((id) => allows(p, id)));
  p.X('lyState.only.add("B")');
  eq([true, true, false], ['p1', 'p2', 'p3'].map((id) => allows(p, id)));
});

test('layers: "hide" removes members of every chosen layer (NOT IN)', () => {
  const p = page();
  p.X('lyState.hide.add("B")');
  eq([true, false, true], ['p1', 'p2', 'p3'].map((id) => allows(p, id)));
  p.X('lyState.hide.add("A")');
  eq([false, false, true], ['p1', 'p2', 'p3'].map((id) => allows(p, id)));
});

test('layers: only + hide together: in the chosen layers but not in the hidden ones', () => {
  const p = page();
  p.X('lyState.only.add("A"); lyState.hide.add("B")');
  eq([true, false, false], ['p1', 'p2', 'p3'].map((id) => allows(p, id)));
});

test('layers: while places are being chosen every place is shown', () => {
  const p = page();
  p.X('lyState.only.add("A"); lyState.open = "A"; lyStartEdit()');
  ok(allows(p, 'p3'));
  ok(p.X('lyState.editing === "A"'));
  p.X('lyStopEdit()');
  ok(!allows(p, 'p3'));
});

test('layers: lyToggleFilter moves a layer between only and hide, and clicking again removes it', () => {
  const p = page();
  p.X('lyToggleFilter("only","A")');
  eq([['A'], []], J(p.X('[[...lyState.only], [...lyState.hide]]')));
  p.X('lyToggleFilter("hide","A")');
  eq([[], ['A']], J(p.X('[[...lyState.only], [...lyState.hide]]')));
  p.X('lyToggleFilter("hide","A")');
  eq([[], []], J(p.X('[[...lyState.only], [...lyState.hide]]')));
  ok(p.calls.includes('update'), 'the list and the map are refreshed');
});

test('layers: lyClearFilters (Reset) empties both lists', () => {
  const p = page();
  p.X('lyState.only.add("A"); lyState.hide.add("B"); lyClearFilters()');
  eq(0, p.X('lyFilterCount()'));
});

test('layers: a layer deleted by someone else disappears from the filters and from the open sheet', () => {
  const p = page();
  p.X('lyState.only.add("A"); lyState.hide.add("B"); lyState.open = "B"');
  p.X('lySet(__0, [], [])', [L('A', 'Alpha', 'p1')]);
  eq([['A'], []], J(p.X('[[...lyState.only], [...lyState.hide]]')));
  eq(null, p.X('lyState.open'));
});

test('layers: notes are limited to the open layer or the "only" layers that contain the place', () => {
  const p = page();
  eq(null, p.X('lyScope("p1", true)'), 'general view: all notes');
  p.X('lyState.open = "A"');
  eq(['A'], J(p.X('lyScope("p1", true)')));
  eq(null, p.X('lyScope("p3", true)'), 'a place that is not in the layer shows all its notes');
  p.X('lyState.noteAll = true');
  eq(null, p.X('lyScope("p1", true)'), '"show all notes"');
  p.X('lyState.noteAll = false; lyState.open = null; lyState.only.add("B")');
  eq(['B'], J(p.X('lyScope("p2", false)')));
  eq(null, p.X('lyScope("p1", false)'));
  ok(p.X('lyNoteVisible({layers:["A"]}, ["A"])'));
  ok(!p.X('lyNoteVisible({layers:[]}, ["A"])'));
  ok(p.X('lyNoteVisible({layers:[]}, null)'));
});

test('layers: halo = colour of an "only" layer; while choosing, the members get a ring', () => {
  const colored = [{ ...L('A', 'Alpha', 'p1'), color: '#aa3344' }, L('B', 'Beta', 'p2')];
  const p = page(colored);
  eq('', p.X('lyHalo("p1")'));
  p.X('lyState.only.add("A")');
  eq('#aa3344', p.X('lyHalo("p1")'));
  eq('', p.X('lyHalo("p2")'));
  p.X('lyState.only.clear(); lyState.open = "A"; lyStartEdit()');
  eq('#aa3344', p.X('lyHalo("p1")'));
  eq('', p.X('lyHalo("p3")'));
  p.X('lyToggleMember("p3")');
  eq('#aa3344', p.X('lyHalo("p3")'));
  p.X('lyToggleMember("p1")');
  eq('', p.X('lyHalo("p1")'));
});

test('layers: lyName falls back to English, then the first name', () => {
  const p = page();
  eq('Alpha', p.X('lyName(lyById("A"), "xx")'));
  eq('Первый', p.X('lyName({names:[{lang:"ru",name:"Первый"}]}, "en")'));
});

test('layers: layer names and descriptions are escaped when drawn (no HTML injection)', () => {
  const bad = L('X', '<img src=x onerror=alert(1)>', 'p1');
  bad.descriptions = [{ lang: 'en', text: '<script>alert(1)</script>' }];
  const p = page([bad]);
  p.el('#lang').value = 'en';
  p.X('lyOpen("X")');
  const html = p.el('#lyList').innerHTML + p.el('#lyDetail').innerHTML;
  ok(html.includes('&lt;img'), 'name escaped');
  ok(!/<img|<script/i.test(html), 'no raw tag in the output: ' + html.slice(0, 200));
});

test('layers: categories list is sorted, filtered by search, and the category name is searchable', () => {
  const c = [{ id: 'c1', names: [{ lang: 'en', name: 'Military campaign' }] }];
  const l = { ...L('A', 'Alpha', 'p1'), category: 'c1' };
  const p = page([l, L('B', 'Beta')], c);
  p.el('#lang').value = 'en';
  p.el('#lyQ').value = 'military';
  p.el('#lyCat').value = '';
  p.X('lyRenderList()');
  const html = p.el('#lyList').innerHTML;
  ok(html.includes('Alpha') && !html.includes('Beta'), html);
  eq('1 of 2 layers', p.el('#lyCount').textContent);
});

test('layers: choosing places shows +added −removed and Save sends ONE request with both lists', async () => {
  const p = page(); // layer A has p1 and p2
  const sent = [];
  p.ctx.fetch = async (url, o) => {
    if (o && o.method === 'POST') {
      sent.push(J({ url, body: JSON.parse(o.body) }));
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: true, json: async () => (url === '/layers' ? { layers: [L('A', 'Alpha', 'p2', 'p3')] } : url === '/lnotes' ? { notes: [] } : { categories: [] }) };
  };
  p.X('AHM_CONFIG.url.layerSave = "/save"; AHM_CONFIG.url.layers = "/layers"; AHM_CONFIG.url.layerNotesIndex = "/lnotes"; AHM_CONFIG.url.categories = "/cats"');
  p.el('#lang').value = 'en';
  p.X('lyOpen("A"); lyStartEdit(); lyToggleMember("p1"); lyToggleMember("p3")');
  eq(['p2', 'p3'].sort(), J(p.X('[...lyState.staged]')).sort());
  await p.X('lySavePlaces()');
  eq(1, sent.length, 'one request');
  eq({ url: '/save', body: { layer_members: { id: 'A', add: ['p3'], remove: ['p1'] } } }, sent[0]);
  eq(null, p.X('lyState.editing'), 'choosing is over after saving');
});

test('layers: nothing is sent when nothing changed', async () => {
  const p = page();
  const sent = [];
  p.ctx.fetch = async (url, o) => (o && o.method === 'POST' ? (sent.push(1), { ok: true, json: async () => ({}) }) : { ok: true, json: async () => ({ layers: [L('A', 'Alpha', 'p1', 'p2')], notes: [], categories: [] }) });
  p.X('AHM_CONFIG.url.layers = "/l"; AHM_CONFIG.url.layerNotesIndex = "/n"; AHM_CONFIG.url.categories = "/c"; lyState.open = "A"; lyStartEdit()');
  await p.X('lySavePlaces()');
  eq(0, sent.length);
});

// ---- task 003: the sidebar publishes the state (AHM.state, I-6) ----
// Written first (TDD). While ui.js / layers.js do not publish yet, these tests are skipped so the suite stays green.
// Run them red with:  AHM_TDD=1 node tests/js/run.js --no-browser sidebar
const fs = require('fs');
const path = require('path');
const { JS, SAMPLE } = require('./lib/ctx');
const srcOf = (f) => fs.readFileSync(path.join(JS, 'sidebar', f), 'utf8');
// ui.js was split (T-029): the sidebar files in load order; together they are the old ui.js
const UI_FILES = ['layout.js', 'places.js', 'actions.js', 'admin.js', 'ui.js'];
const publishesSelected = () => /AHM\.state\.set\(\s*['"]selected['"]/.test(UI_FILES.map(srcOf).join('\n'));
const publishesLayers = () => /AHM\.state\.patch\(\s*['"]layers['"]/.test(srcOf('layers.js'));
const gated = (isBuilt, name, fn) =>
  test(name, async () => {
    if (!isBuilt() && !process.env.AHM_TDD) return console.log('    (not published yet: skipped; AHM_TDD=1 runs it)');
    await fn();
  });
const tick = () => new Promise((r) => setTimeout(r, 0));

const UI_SCRIPTS = ['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'shapes.js', 'routes.js', 'search.js', 'searchfield.js', 'period.js', 'placeform.js', 'layers.js', 'sidebar/shapes.js', 'sidebar/routes.js'];
/** The page with the sidebar files (the old ui.js) themselves running (it declares cur, tab, show, update ...), a map stand-in, and recorded event handlers. */
function uiPage() {
  const p = load(UI_SCRIPTS);
  const doc = p.ctx.document;
  const h = {};
  const plain = doc.querySelector;
  doc.querySelector = (s) => {
    const e = plain(s);
    e.after ||= () => {};
    e.append ||= () => {};
    if (!e.__w) {
      e.__w = true;
      e.addEventListener = (ev, fn) => (h[s + ':' + ev] ||= []).push(fn);
    }
    return e;
  };
  doc.addEventListener = (ev, fn) => (h['document:' + ev] ||= []).push(fn);
  doc.activeElement = { tagName: 'BODY' };
  p.X(`var typeIcon = () => '';
    AHM.map = { setFeatures() {}, hidePlace() {}, focusPlace() {}, focusPoint() {}, fitTo() {}, fitRoute() {}, setRoute() {}, setRouteMarkers() {}, setPick() {}, resize() {}, getZoom: () => 6, showMenu() {}, hideMenu() {}, setShapes() {}, highlightShape() {}, previewShape() {}, showPreview() {}, editPin: () => ({ getPosition() {}, setPosition() {}, remove() {} }) };`);
  for (const f of UI_FILES) p.X(srcOf(f));
  p.X('setData(__0, [])', SAMPLE.places);
  p.X(`globalThis.__sel = []; globalThis.__reads = []; globalThis.__peek = AHM.state.get;
    AHM.on('state:selected', (e) => __sel.push(e.value));
    const __get = AHM.state.get; AHM.state.get = (k) => (__reads.push(k), __get(k));`);
  return { p, h };
}
const rowClick = (h, ev, id, detail = 1) =>
  (h['#list:' + ev] || []).forEach((fn) => fn({ detail, target: { closest: (s) => (s === 'li[data-id]' ? { dataset: { id } } : null) } }));
const pressEsc = (h) => (h['document:keydown'] || []).forEach((fn) => fn({ key: 'Escape' }));
const inSync = (p) => eq(p.X('cur ? cur.id : null'), p.X('__peek("selected")'), 'selected equals the open place id (or null)');

gated(publishesSelected, 'sidebar publishes: a click on a place row publishes its id; a second click folds it and publishes null', async () => {
  const { p, h } = uiPage();
  rowClick(h, 'click', 'p1');
  await tick();
  eq(['p1'], p.X('__sel'));
  inSync(p);
  rowClick(h, 'click', 'p1');
  await tick();
  eq(['p1', null], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: a double click (list or map) opens and selects the place', async () => {
  const { p, h } = uiPage();
  p.X('AHM.emit("place:click", { id: "p1" })');
  await tick();
  rowClick(h, 'dblclick', 'p2');
  await tick();
  eq(['p1', 'p2'], p.X('__sel'));
  p.X('AHM.emit("place:dblclick", { id: "p3" })');
  await tick();
  eq(['p1', 'p2', 'p3'], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: switching place replaces the id; an unknown id changes nothing', async () => {
  const { p } = uiPage();
  await p.X('show("p1")');
  await p.X('show("p2")');
  await p.X('show("nope")');
  eq(['p1', 'p2'], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: a map click on empty map keeps the selection', async () => {
  const { p } = uiPage();
  await p.X('show("p1")');
  p.X('AHM.emit("map:click", { lon: 44, lat: 40, name: "x" })');
  eq(['p1'], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: Esc closes the place and publishes null', async () => {
  const { p, h } = uiPage();
  await p.X('show("p1")');
  pressEsc(h);
  eq(['p1', null], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: switching tab closes the place and publishes null', async () => {
  const { p } = uiPage();
  await p.X('show("p1")');
  p.X('tab("layers")');
  eq(['p1', null], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: typing in the search closes the place and publishes null', async () => {
  const { p, h } = uiPage();
  await p.X('show("p1")');
  p.el('#q').value = 'zz';
  (h['#q:input'] || []).forEach((fn) => fn({}));
  eq(['p1', null], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: a filter that hides the open place does not change the selection', async () => {
  const { p } = uiPage();
  await p.X('show("p1")');
  p.el('#q').value = 'zzzz';
  p.X('update()');
  eq(['p1'], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: editing a place selects it; Esc then publishes null', async () => {
  const { p, h } = uiPage();
  p.X('editPlace(places[0])');
  eq(['p1'], p.X('__sel'));
  inSync(p);
  pressEsc(h);
  eq(['p1', null], p.X('__sel'));
  inSync(p);
});

gated(publishesSelected, 'sidebar publishes: the sidebar never reads "selected" back', async () => {
  const { p, h } = uiPage();
  rowClick(h, 'click', 'p1');
  await tick();
  await p.X('show("p2")');
  p.X('AHM.emit("map:click", { lon: 44, lat: 40 })');
  p.X('tab("layers")');
  await p.X('show("p1")');
  pressEsc(h);
  eq(false, p.X('__reads.includes("selected")'));
});

// ---- layers: after the sets in lyState change, AHM.state.patch('layers', {}) announces it ----
const layPage = () => {
  const p = page();
  p.X(`globalThis.__lay = [];
    AHM.on('state:layers', () => __lay.push({ only: [...lyState.only], hide: [...lyState.hide], staged: lyState.staged && [...lyState.staged] }));`);
  return p;
};
const lastLay = (p) => p.X('__lay[__lay.length - 1]');

gated(publishesLayers, 'sidebar publishes: lyToggleFilter announces the changed only / hide sets', () => {
  const p = layPage();
  p.X('lyToggleFilter("only", "A")');
  ok(p.X('__lay.length') >= 1, 'state:layers announced');
  eq({ only: ['A'], hide: [], staged: null }, lastLay(p), 'announced after the change');
  p.X('__lay.length = 0; lyToggleFilter("hide", "A")');
  ok(p.X('__lay.length') >= 1);
  eq({ only: [], hide: ['A'], staged: null }, lastLay(p));
});

gated(publishesLayers, 'sidebar publishes: lyClearFilters (Reset) announces the emptied sets', () => {
  const p = layPage();
  p.X('lyState.only.add("A"); lyState.hide.add("B"); lyClearFilters()');
  ok(p.X('__lay.length') >= 1, 'state:layers announced');
  eq({ only: [], hide: [], staged: null }, lastLay(p));
});

gated(publishesLayers, 'sidebar publishes: a layer deleted by someone else is removed from the sets and announced', () => {
  const p = layPage();
  p.X('lyState.only.add("A"); lyState.hide.add("B")');
  p.X('lySet(__0, [], [])', [L('A', 'Alpha', 'p1')]);
  ok(p.X('__lay.length') >= 1, 'state:layers announced');
  eq({ only: ['A'], hide: [], staged: null }, lastLay(p));
});

gated(publishesLayers, 'sidebar publishes: choosing places (start, toggle, stop) announces the staged set', () => {
  const p = layPage();
  p.X('lyOpen("A"); __lay.length = 0; lyStartEdit()');
  ok(p.X('__lay.length') >= 1, 'start announced');
  eq(['p1', 'p2'], lastLay(p).staged.slice().sort());
  p.X('__lay.length = 0; lyToggleMember("p3")');
  ok(p.X('__lay.length') >= 1, 'toggle announced');
  eq(['p1', 'p2', 'p3'], lastLay(p).staged.slice().sort());
  p.X('__lay.length = 0; lyStopEdit()');
  ok(p.X('__lay.length') >= 1, 'stop announced');
  eq(null, lastLay(p).staged);
});

// ---- notes of a border or a route: stored with the layer notes, the owner is the shape id ----
test('shape notes: the card block lists the notes of one shape, escaped, in the current language; buttons only for editors', () => {
  const p = page();
  p.X('layerNotes = __0', [
    { id: 'n1', layer: 'S1', lang: 'en', title: 'Goods <i>', text: 'Silk', date: null },
    { id: 'n2', layer: 'S1', lang: 'ru', title: 'Russian only', text: 'x', date: null },
    { id: 'n3', layer: 'A', lang: 'en', title: 'Other owner', text: 'x', date: null },
  ]);
  p.X('AHM_CONFIG.canEdit = true');
  const h = p.X('lyOwnerNotesHTML("S1", "en", "shact")');
  ok(h.includes('Goods &lt;i&gt;') && !h.includes('Goods <i>'), 'title escaped');
  ok(!h.includes('Russian only') && !h.includes('Other owner'), 'other language and other owner left out');
  ok(h.includes('data-shact="editnote" data-id="n1"') && h.includes('data-shact="addnote"'), 'edit and add buttons for editors');
  p.X('AHM_CONFIG.canEdit = false');
  const r = p.X('lyOwnerNotesHTML("S1", "en", "rtact")');
  ok(r.includes('Goods &lt;i&gt;') && !/data-rtact/.test(r), 'readers see the notes, no buttons');
  ok(p.X('lyOwnerNotesHTML("S2", "en", "shact")').includes('No notes yet.'));
});

test('shape notes: the note dialog opens for a border or a route and names what the note is about', () => {
  const p = page();
  p.X('lyOpenNoteDlg(__0, null, "route")', { id: 'S1', names: [{ lang: 'en', name: 'Silk Road' }] });
  eq('Note about the route', p.X('$("#dNoteHead").textContent'));
  eq('S1', p.X('dlg.layer.id'));
  p.X('lyOpenNoteDlg(__0, null)', { id: 'A', names: [{ lang: 'en', name: 'Alpha' }] });
  eq('Note about the layer', p.X('$("#dNoteHead").textContent'));
});
