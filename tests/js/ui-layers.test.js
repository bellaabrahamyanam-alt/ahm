// Layers tab: tests of tasks/layers.md (own file, so that parallel workers never edit the same test file).
const { load, UI_STANDINS } = require('./lib/ctx');
const { test, ok, eq } = require('./lib/harness');

const L = (id, name, ...m) => ({ id, names: [{ lang: 'en', name }], descriptions: [], category: null, color: null, date_from: null, date_to: null, members: m.map((x) => ({ place: x })) });
const PLACES = [
  { id: 'p1', type: 'city', names: [{ lang: 'en', name: 'One' }] },
  { id: 'p2', type: 'city', names: [{ lang: 'en', name: 'Two' }] },
  { id: 'p3', type: 'city', names: [{ lang: 'en', name: 'Three' }] },
];

/** The page with the shared components loaded (components.js), as in index.html. */
function page(layers = [L('A', 'Alpha', 'p1', 'p2'), L('B', 'Beta')], cats = [], role = 'admin') {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'components.js', 'layer-rules.js', 'shapes.js', 'routes.js', 'search.js', 'searchfield.js', 'placeform.js', 'layers.js'], UI_STANDINS);
  p.X('places = __0', PLACES);
  p.X(`AHM_CONFIG.canEdit = ${role !== 'visitor'}; AHM_CONFIG.canLayerAdmin = ${role === 'admin'}`);
  p.el('#lang').value = 'en';
  p.X('lySet(__0, [], __1)', layers, cats);
  return p;
}
const list = (p) => p.el('#lyList').innerHTML;
const sheet = (p) => p.el('#lyDetail').innerHTML;
const click = (p, sel, target) => (p.el(sel)._on.click || []).forEach((fn) => fn({ target, composedPath: () => [], preventDefault() {} }));
/** a fake click target whose closest() finds one data-lyact button */
const btn = (act, extra = {}) => ({ tagName: 'BUTTON', closest: (s) => (s === '[data-lyact]' ? { dataset: { lyact: act, ...extra } } : null) });

test('ui-layers list: rows are shared rows with Only and Hide chips, the open one is marked, names are escaped', () => {
  const p = page([L('A', '<b>Alpha</b>', 'p1'), L('B', 'Beta')]);
  const h = list(p);
  ok(/class="ui-row"[^>]*data-lid="A"/.test(h) && /data-lid="B"/.test(h), h.slice(0, 300));
  eq(2, (h.match(/data-lyact="only"/g) || []).length);
  eq(2, (h.match(/data-lyact="hide"/g) || []).length);
  ok(h.includes('&lt;b&gt;Alpha') && !h.includes('<b>Alpha'), 'name escaped');
  ok(h.includes('1 place'), 'count in the subtitle');
  p.X('lyToggleFilter("only", "A")');
  ok(/chip2 on"[^>]*data-lyact="only" data-lid="A"/.test(list(p)), 'Only chip is on');
  p.X('lyState.open = "B"; lyRenderList()');
  ok(/ui-row on"[^>]*data-lid="B"/.test(list(p)), 'the open layer row is marked');
});

test('ui-layers list: Explore shows the active layer filters as removable chips', () => {
  const p = page();
  p.X('lyToggleFilter("only", "A"); lyToggleFilter("hide", "B")');
  const h = p.el('#lyActive').innerHTML;
  ok(h.includes('only · Alpha') && h.includes('not in · Beta'), h);
  ok(h.includes('data-lyact="unfilter"') && h.includes('class="x"'), 'removable chips');
  p.X('lyClearFilters()');
  eq('', p.el('#lyActive').innerHTML);
});

test('ui-layers list: empty states - no layers yet, no match, empty category', () => {
  let p = page([]);
  ok(/state-empty/.test(list(p)) && list(p).includes('No layers yet.') && list(p).includes('Add the first one'), list(p));
  eq('0 of 0 layers', p.el('#lyCount').textContent);
  p = page([], [], 'visitor');
  ok(list(p).includes('No layers yet.') && !list(p).includes('Add the first one'), 'a visitor is not told to add');
  p = page([L('A', 'Alpha')], [{ id: 'c1', names: [{ lang: 'en', name: 'Wars' }] }]);
  p.el('#lyQ').value = 'zzz';
  p.X('lyRenderList()');
  ok(list(p).includes('No layers match.'), list(p));
  p.el('#lyQ').value = '';
  p.el('#lyCat').value = 'c1';
  p.X('lyRenderList()');
  ok(list(p).includes('No layers in this category.'), list(p));
});

test('ui-layers sheet: places as rows, a deleted place is not counted but reported, empty layer has a message', () => {
  const p = page([L('A', 'Alpha', 'p1', 'gone'), L('B', 'Beta')]);
  p.X('lyOpen("A")');
  let h = sheet(p);
  ok(h.includes('Places (1)') && h.includes('data-pid="p1"') && !h.includes('data-pid="gone"'), h.slice(0, 600));
  ok(h.includes('1 place of this layer no longer exists'), 'deleted place reported');
  p.X('lyOpen("B")');
  h = sheet(p);
  ok(h.includes('Places (0)') && h.includes('No places yet.') && h.includes('Choose places'), h.slice(0, 600));
});

test('ui-layers sheet: notes use the shared note, escaped; the edit button only for people who can edit', () => {
  const p = page();
  p.X('layerNotes = __0', [{ id: 'n1', layer: 'A', lang: 'en', title: '<i>Note</i>', date: null, text: 'Body' }]);
  p.X('lyOpen("A")');
  let h = sheet(p);
  ok(h.includes('class="ui-note"') && h.includes('&lt;i&gt;Note') && h.includes('data-lyact="editnote"'), h.slice(0, 900));
  p.X('AHM_CONFIG.canEdit = false; lyRenderDetail()');
  h = sheet(p);
  ok(!h.includes('data-lyact="editnote"') && h.includes('ui-note'), 'visitor sees the note without the edit button');
});

test('ui-layers roles: visitor reads only, editor chooses places and adds notes, only an administrator deletes', () => {
  const foot = (role) => {
    const p = page(undefined, [], role);
    p.X('lyOpen("A")');
    return sheet(p);
  };
  const v = foot('visitor'),
    e = foot('editor'),
    a = foot('admin');
  ok(v.includes('state-readonly') && v.includes('Log in to change layers.'), 'visitor: read-only block');
  ok(!/data-lyact="(editplaces|addnote|delete|editlayer)"/.test(v), 'visitor: no editing buttons');
  ok(/data-lyact="editplaces"/.test(e) && /data-lyact="addnote"/.test(e) && /data-lyact="editlayer"/.test(e) && !/data-lyact="delete"/.test(e), 'editor: no Delete');
  ok(/data-lyact="delete"/.test(a), 'administrator: Delete');
});

test('ui-layers choose places: Save is disabled until a change, and again when the change is undone; the delta is shown', () => {
  const p = page();
  p.X('lyOpen("A"); lyStartEdit()');
  ok(/data-lyact="saveplaces" disabled/.test(sheet(p)), 'disabled at the start');
  ok(sheet(p).includes('no changes yet'));
  const save = { disabled: true };
  p.ctx.document.querySelector = ((orig) => (s) => (s === '#lyDetail [data-lyact="saveplaces"]' ? save : orig(s)))(p.ctx.document.querySelector);
  p.X('lyToggleMember("p3")');
  eq('+1 −0', p.el('#lyDelta').textContent);
  eq(false, save.disabled, 'enabled after a change');
  p.X('lyToggleMember("p3")');
  eq('no changes yet', p.el('#lyDelta').textContent);
  eq(true, save.disabled, 'disabled again');
});

test('ui-layers choose places: leaving with unsaved changes asks first; without changes it does not ask', async () => {
  const p = page();
  p.X('globalThis.__asked = []; globalThis.uiConfirm = (m, o) => (__asked.push(m), Promise.resolve(globalThis.__answer))');
  p.X('lyOpen("A"); lyStartEdit()');
  eq(false, p.X('lyDirty()'));
  eq(true, await p.X('lyLeaveEdit()'));
  eq(0, p.X('__asked.length'), 'no prompt when nothing changed');
  p.X('lyToggleMember("p3")');
  eq(true, p.X('lyDirty()'));
  p.X('globalThis.__answer = false');
  eq(false, await p.X('lyLeaveEdit()'));
  p.X('globalThis.__answer = true');
  eq(true, await p.X('lyLeaveEdit()'));
  eq(2, p.X('__asked.length'));
  ok(/Discard the changes/.test(p.X('__asked[0]')));
});

test('ui-layers choose places: Cancel and Close keep the choice when the person says no, drop it when yes', async () => {
  const p = page();
  p.X('globalThis.uiConfirm = () => Promise.resolve(globalThis.__answer)');
  p.X('lyOpen("A"); lyStartEdit(); lyToggleMember("p3")');
  p.X('globalThis.__answer = false');
  click(p, '#lyDetail', btn('cancelplaces'));
  await new Promise((r) => setTimeout(r, 0));
  eq('A', p.X('lyState.editing'), 'still choosing');
  p.X('globalThis.__answer = true');
  click(p, '#lyDetail', btn('close'));
  await new Promise((r) => setTimeout(r, 0));
  eq(null, p.X('lyState.editing'));
  eq(null, p.X('lyState.open'));
});

test('ui-layers choose places: a failed save shows the error and keeps the choice; a good save sends one request and leaves the general layer alone', async () => {
  const p = page();
  const sent = [];
  p.ctx.fetch = async (url, o) => {
    sent.push([url, JSON.parse(o.body)]);
    return { ok: sent.length > 1, status: 500, json: async () => (sent.length > 1 ? {} : { error: 'disk full' }) };
  };
  p.X('lyOpen("A"); lyStartEdit(); lyToggleMember("p1"); lyToggleMember("p3")');
  await p.X('lySavePlaces()');
  ok(/disk full/.test(p.el('#lyErr').textContent), p.el('#lyErr').textContent);
  eq('A', p.X('lyState.editing'), 'the choice is kept after an error');
  eq(1, sent.length);
  eq({ layer_members: { id: 'A', add: ['p3'], remove: ['p1'] } }, sent[0][1]);
  eq(3, p.X('places.length'), 'removing from a layer never deletes the place from the general layer');
});

test('ui-layers delete: asks first, an administrator only; No sends nothing', async () => {
  const p = page();
  const sent = [];
  p.ctx.fetch = async (url, o) => (sent.push(url), { ok: true, json: async () => ({}) });
  p.X('globalThis.__asked = []; globalThis.uiConfirm = (m) => (__asked.push(m), Promise.resolve(globalThis.__answer))');
  p.X('lyOpen("A")');
  p.X('globalThis.__answer = false');
  click(p, '#lyDetail', btn('delete'));
  await new Promise((r) => setTimeout(r, 0));
  eq(0, sent.length, 'No: nothing sent');
  ok(/Delete the layer .Alpha./.test(p.X('__asked[0]')), p.X('__asked[0]'));
  p.X('AHM_CONFIG.canLayerAdmin = false');
  p.X('globalThis.__answer = true');
  click(p, '#lyDetail', btn('delete'));
  await new Promise((r) => setTimeout(r, 0));
  eq(0, sent.length, 'an editor who is not an administrator cannot delete');
});

test('ui-layers categories: the list offers rename and add for administrators, never delete; others get a hint', () => {
  const c = [{ id: 'c1', names: [{ lang: 'en', name: 'Wars' }] }];
  const a = page(undefined, c, 'admin');
  ok(a.el('#catList').innerHTML.includes('data-lyact="editcat"') && a.el('#catAdmin').innerHTML.includes('catAdd'), 'admin: rename and add');
  ok(!/delete|remove|trash/i.test(a.el('#catList').innerHTML + a.el('#catAdmin').innerHTML), 'no delete control');
  const e = page(undefined, c, 'editor');
  ok(!e.el('#catList').innerHTML.includes('editcat') && e.el('#catAdmin').innerHTML.includes('Only administrators'), 'editor: read only');
});

test('ui-layers form: colour swatches set the colour and switch "use a colour" on; names and descriptions use the dashed add button', () => {
  const p = page();
  p.X('lyOpenForm(null)');
  const h = p.el('#lyForm').innerHTML;
  ok(h.includes('add-dashed pf-add') && h.includes('add-dashed ly-dadd'), 'shared add buttons');
  ok(/data-lycolor="#475b66"/.test(h) && h.includes('id="lyUseColor"') && h.includes('id="lyColor"'), 'swatches and the colour input');
  const colour = { value: '', checked: false },
    use = { checked: false },
    sw = { dataset: { lycolor: '#b3261e' }, classList: { toggle() {} } };
  p.ctx.document.querySelector = ((orig) => (s) => (s === '#lyColor' ? colour : s === '#lyUseColor' ? use : orig(s)))(p.ctx.document.querySelector);
  click(p, '#lyForm', { closest: (s) => (s === '[data-lycolor]' ? sw : null) });
  eq('#b3261e', colour.value);
  eq(true, use.checked);
});

test('ui-layers filters: Only and Hide semantics and the period filter are unchanged (Only = OR, Hide = NOT IN)', () => {
  const p = page([L('A', 'Alpha', 'p1', 'p2'), L('B', 'Beta', 'p2')]);
  p.X('lyState.only.add("A"); lyState.hide.add("B")');
  eq([true, false, false], ['p1', 'p2', 'p3'].map((id) => p.X(`layerAllows("${id}")`)));
});
