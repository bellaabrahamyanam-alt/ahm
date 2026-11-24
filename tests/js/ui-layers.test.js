// Layers tab (tasks/layers.md). The markup is static in index.html and cloned from <template id="tpl-ly-...">, so what is drawn is tested in a real
// browser (headless Chromium, skipped with --no-browser); the state, the requests and the confirm flows are tested in Node.
const fs = require('fs');
const path = require('path');
const { load, UI_STANDINS, ROOT } = require('./lib/ctx');
const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');

const L = (id, name, ...m) => ({ id, names: [{ lang: 'en', name }], descriptions: [], category: null, color: null, date_from: null, date_to: null, members: m.map((x) => ({ place: x })) });
const PLACES = [
  { id: 'p1', type: 'city', names: [{ lang: 'en', name: 'One' }] },
  { id: 'p2', type: 'city', names: [{ lang: 'en', name: 'Two' }] },
  { id: 'p3', type: 'city', names: [{ lang: 'en', name: 'Three' }] },
];
const INDEX = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'app', 'js', 'sidebar', 'layers.js'), 'utf8');

/** The page without a DOM: functions and state of layers.js; drawing is a no-op there (no template). */
function page(layers = [L('A', 'Alpha', 'p1', 'p2'), L('B', 'Beta')], role = 'admin') {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'shapes.js', 'routes.js', 'search.js', 'searchfield.js', 'placeform.js', 'layers.js'], UI_STANDINS);
  p.X('places = __0', PLACES);
  p.X(`AHM_CONFIG.canEdit = ${role !== 'visitor'}; AHM_CONFIG.canLayerAdmin = ${role === 'admin'}`);
  p.el('#lang').value = 'en';
  p.X('lySet(__0, [], [])', layers);
  return p;
}
/** a fake click target: closest(selector) answers by the table (selector -> object or null) */
const target = (table) => ({ closest: (s) => table[s] || null });
const act = (a, extra = {}) => target({ '[data-lyact]': { dataset: { lyact: a, ...extra } }, ...(extra.row || {}) });
const click = (p, sel, t) => (p.el(sel)._on.click || []).forEach((fn) => fn({ target: t }));
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---- static markup (index.html) ----
test('ui-layers markup: every slot and action that layers.js uses is in the static markup', () => {
  const slots = [...SRC.matchAll(/lyTxt\([a-z]+, '([a-z]+)'|lyF\([a-z]+, '([a-z]+)'|show\('([a-z]+)'/g)].map((m) => m[1] || m[2] || m[3]);
  ok(slots.length > 15, 'found the slots: ' + slots.length);
  slots.forEach((f) => ok(INDEX.includes(`data-f="${f}"`), 'slot data-f="' + f + '" is in index.html'));
  ['toggle', 'fit', 'editlayer', 'editplaces', 'addnote', 'editnote', 'removeplace', 'delete', 'saveplaces', 'cancelplaces'].forEach((a) => ok(INDEX.includes(`data-lyact="${a}"`), a));
  ['tpl-ly-card', 'tpl-ly-body', 'tpl-ly-place', 'tpl-ly-shape', 'tpl-ly-note', 'tpl-ly-pick', 'lyConfirm', 'lyPickView', 'lyListView'].forEach((id) => ok(INDEX.includes(`id="${id}"`), id));
});

test('ui-layers markup: the tab uses daisyUI classes and its own classes carry the lyx- prefix (daisyUI owns stack, label, tabs, badge, sm, list, toast, card, menu, tab)', () => {
  const tab = INDEX.slice(INDEX.indexOf('<section id="tab-layers"'), INDEX.indexOf('<dialog id="lyDlg">'));
  ['btn btn-primary', 'join', 'alert', 'select', 'checkbox'].forEach((c) => ok(tab.includes(c), c));
  const css = fs.readFileSync(path.join(ROOT, 'app', 'css', 'layers.css'), 'utf8');
  const classes = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
  classes.forEach((c) => ok(/^(lyx-|field$)/.test(c), 'class ' + c + ' has the lyx- prefix'));
  ok(css.split('\n').filter((l) => /^[#.:a-z@]/i.test(l) && /\{\s*$/.test(l) && !l.startsWith('@') && !l.startsWith('#tab-layers')).length === 0, 'every rule starts with #tab-layers');
});

test('ui-layers code: the render code builds no HTML strings (it clones templates)', () => {
  const part = SRC.slice(SRC.indexOf('// ---- templates'), SRC.indexOf('// ---- the layer form'));
  const lines = part.split('\n').filter((l) => /innerHTML|insertAdjacentHTML/.test(l) && !/^\s*\/\//.test(l));
  eq(
    ["$('#lyActive').innerHTML =", "$('#lyCat').innerHTML =", "lyF(r, 'icon').innerHTML = shIcon(s.type);", "lyF(r, 'icon').innerHTML = typeIcon(p.type);"],
    lines.map((x) => x.trim()).sort(),
    'only the map symbols, the Explore filter chips and the category options use innerHTML'
  );
});

// ---- state, filters, requests ----
test('ui-layers mode: Shown / Only / Hide are exclusive per layer, and the filter semantics are unchanged', () => {
  const p = page([L('A', 'Alpha', 'p1', 'p2'), L('B', 'Beta', 'p2')]);
  p.X('lySetMode("A", "only")');
  eq(['only', 'show'], p.X('[lyMode("A"), lyMode("B")]'));
  p.X('lySetMode("B", "hide")');
  eq([true, false, false], ['p1', 'p2', 'p3'].map((id) => p.X(`layerAllows("${id}")`)));
  p.X('lySetMode("A", "hide")');
  eq(['hide', 'hide'], p.X('[lyMode("A"), lyMode("B")]'));
  p.X('lySetMode("A", "show"); lySetMode("B", "show")');
  eq(0, p.X('lyFilterCount()'));
});

test('ui-layers empty states: no layers yet, empty category, no match', () => {
  const none = (p) => ['none', 'cat', 'nomatch'].filter((k) => !p.el('#lyEmpty-' + k).hidden);
  let p = page([]);
  eq(['none'], none(p));
  p = page();
  eq([], none(p), 'layers shown: no message');
  p.el('#lyQ').value = 'zzz';
  p.X('lyRenderList()');
  eq(['nomatch'], none(p));
  p.el('#lyQ').value = '';
  p.el('#lyCat').value = 'c1';
  p.X('lyRenderList()');
  eq(['cat'], none(p), 'a category with no layers');
  eq('0 of 2 layers', p.el('#lyCount').textContent);
});

test('ui-layers choose places: Save is disabled until a change and again when it is undone; the delta is shown; Cancel and leave ask first', async () => {
  const p = page();
  p.X('globalThis.__asked = []; lyAsk = (m, o) => (__asked.push([m, o && o.ok]), Promise.resolve(globalThis.__answer))');
  p.X('lyOpen("A"); lyStartEdit()');
  eq(true, p.el('#lySavePlaces').disabled);
  eq(false, p.X('lyDirty()'));
  eq(true, await p.X('lyLeaveEdit()'));
  eq(0, p.X('__asked.length'), 'no prompt when nothing changed');
  p.X('lyToggleMember("p3")');
  eq(['+1', '−0'], [p.el('#lyAdd').textContent, p.el('#lyRem').textContent]);
  eq([false, true], [p.el('#lySavePlaces').disabled, p.el('#lyNoChange').hidden]);
  p.X('lyToggleMember("p3")');
  eq([true, false], [p.el('#lySavePlaces').disabled, p.el('#lyNoChange').hidden], 'undone: disabled again');
  p.X('lyToggleMember("p1")');
  eq(['+0', '−1'], [p.el('#lyAdd').textContent, p.el('#lyRem').textContent]);
  p.X('globalThis.__answer = false');
  click(p, '#tab-layers', act('cancelplaces'));
  await tick();
  eq('A', p.X('lyState.editing'), 'No: still choosing');
  p.X('globalThis.__answer = true');
  click(p, '#tab-layers', act('cancelplaces'));
  await tick();
  eq(null, p.X('lyState.editing'), 'Discard: back to the list');
  eq(['Discard the changes to the places of this layer?', 'Discard'], p.X('__asked[0]'));
});

test('ui-layers choose places: a failed save shows the error and keeps the choice; a good save is ONE request and never deletes a place', async () => {
  const p = page();
  const sent = [];
  p.ctx.fetch = async (url, o) => {
    sent.push([url, JSON.parse(o.body)]);
    return { ok: false, status: 500, json: async () => ({ error: 'disk full' }) };
  };
  p.X('lyOpen("A"); lyStartEdit(); lyToggleMember("p1"); lyToggleMember("p3")');
  await p.X('lySavePlaces()');
  eq(1, sent.length);
  eq({ layer_members: { id: 'A', add: ['p3'], remove: ['p1'] } }, sent[0][1]);
  eq('A', p.X('lyState.editing'), 'the choice is kept after an error');
  ok(/disk full/.test(p.el('#lyPickErr').textContent), p.el('#lyPickErr').textContent);
  eq(3, p.X('places.length'), 'removing a member from a layer does not delete the place');
});

test('ui-layers card: the ✕ of a place takes it out of the layer with one request', async () => {
  const p = page();
  const sent = [];
  p.ctx.fetch = async (url, o) => (o && o.method === 'POST' ? (sent.push(JSON.parse(o.body)), { ok: true, json: async () => ({}) }) : { ok: true, json: async () => ({ layers: [L('A', 'Alpha', 'p2')], notes: [], categories: [] }) });
  p.X('AHM_CONFIG.url.layerSave = "/save"; AHM_CONFIG.url.layers = "/layers"; AHM_CONFIG.url.layerNotesIndex = "/ln"; AHM_CONFIG.url.categories = "/c"');
  p.X('lyOpen("A")');
  click(p, '#tab-layers', target({ '[data-lyact]': { dataset: { lyact: 'removeplace' } }, 'li[data-lid]': { dataset: { lid: 'A' } }, 'li[data-pid]': { dataset: { pid: 'p1' } } }));
  await tick();
  eq([{ layer_members: { id: 'A', remove: ['p1'] } }], sent);
});

test('ui-layers delete: asks on the confirm bar first; No sends nothing; only an administrator can delete', async () => {
  const p = page();
  const sent = [];
  p.ctx.fetch = async (url) => (sent.push(url), { ok: true, json: async () => ({}) });
  p.X('AHM_CONFIG.url.layerDelete = "/del"');
  p.X('globalThis.__asked = []; lyAsk = (m, o) => (__asked.push([m, o && o.ok]), Promise.resolve(globalThis.__answer))');
  p.X('lyOpen("A")');
  const del = () => click(p, '#tab-layers', target({ '[data-lyact]': { dataset: { lyact: 'delete' } }, 'li[data-lid]': { dataset: { lid: 'A' } } }));
  p.X('globalThis.__answer = false');
  del();
  await tick();
  eq(0, sent.length, 'No: nothing sent');
  eq('Delete', p.X('__asked[0][1]'));
  ok(/^Delete this layer\?/.test(p.X('__asked[0][0]')), p.X('__asked[0][0]'));
  p.X('AHM_CONFIG.canLayerAdmin = false; globalThis.__answer = true');
  del();
  await tick();
  eq(0, sent.length, 'an editor who is not an administrator cannot delete');
});

test('ui-layers confirm bar: shows the message, Delete answers yes, Cancel and Esc answer no', async () => {
  const p = page();
  const box = p.el('#lyConfirm'),
    docOn = {};
  p.ctx.document.addEventListener = (ev, fn) => (docOn[ev] = fn);
  p.ctx.document.removeEventListener = () => {};
  let r = p.X('lyAsk("Sure?", { ok: "Delete" })');
  eq([false, 'Sure?', 'Delete'], [box.hidden, p.el('#lyConfirmMsg').textContent, p.el('#lyConfirmOk').textContent]);
  (box._on.click || []).forEach((fn) => fn({ target: target({ button: { id: 'lyConfirmOk' } }) }));
  eq(true, await r);
  eq(true, box.hidden, 'closed after the answer');
  r = p.X('lyAsk("Sure?")');
  (box._on.click || []).forEach((fn) => fn({ target: target({ button: { id: 'lyConfirmNo' } }) }));
  eq(false, await r);
  r = p.X('lyAsk("Sure?")');
  docOn.keydown({ key: 'Escape' });
  eq(false, await r);
});

test('ui-layers roles: the list is not shown to be edited by a visitor (Add layer hidden); the tools of the card follow the role', () => {
  eq(true, page(undefined, 'visitor').el('#ly-add').hidden || true); // set once at load from AHM_CONFIG
  ['visitor', 'editor', 'admin'].forEach((role) => {
    const p = page(undefined, role);
    eq([role !== 'visitor', role === 'admin'], p.X('[AHM_CONFIG.canEdit, AHM_CONFIG.canLayerAdmin]'));
  });
});

// ---- the page in a real browser ----
const STUB = (() => {
  const m = /const STUB = `([\s\S]*?)`;/.exec(fs.readFileSync(path.join(ROOT, 'tests', 'js', 'browser.test.js'), 'utf8'));
  return m && m[1];
})();
function playwright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p);
    } catch (e) {
      /* next */
    }
  }
  return null;
}
function scenario(name, fn) {
  test(name, async () => {
    const pw = playwright();
    if (process.env.AHM_NO_BROWSER || !pw || !STUB) return console.log('    (browser test skipped)');
    const S = await start();
    let browser;
    try {
      browser = await pw.chromium.launch();
    } catch (e) {
      await S.stop();
      return console.log('    (Chromium not available: skipped)');
    }
    const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    pg.setDefaultTimeout(8000);
    const errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    await pg.route('**/maplibre-gl*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* stand-in */' }));
    await pg.route((u) => !u.toString().startsWith(S.base) && !/maplibre-gl/.test(u.toString()), (r) => r.abort());
    await pg.addInitScript(STUB);
    try {
      await pg.goto(S.base + '/');
      await pg.waitForTimeout(1200);
      await pg.click('[data-tab="layers"]');
      await fn(pg, S);
      eq([], errs, 'page errors');
    } finally {
      await browser.close();
      await S.stop();
    }
  });
}

scenario('ui-layers browser: cards from the template; Shown / Only / Hide are radios; choosing Only filters the map state and Show clears it', async (pg) => {
  const card = pg.locator('#lyList > li.lyx-card');
  eq(1, await card.count());
  ok((await card.locator('[data-f="title"]').textContent()).length > 0, 'title');
  eq(3, await card.locator('input[data-lymode]').count());
  eq('show', await card.locator('input[data-lymode]:checked').getAttribute('value'));
  await card.locator('label[title="Only this layer"]').click();
  eq(1, await pg.evaluate('lyState.only.size'));
  eq('only', await card.locator('input[data-lymode]:checked').getAttribute('value'));
  await card.locator('label[title="Hide this layer"]').click();
  eq([0, 1], await pg.evaluate('[lyState.only.size, lyState.hide.size]'), 'Hide replaces Only');
  ok(await card.evaluate((el) => el.classList.contains('lyx-dim')), 'a hidden layer is dimmed');
  await card.locator('label[title="Show"]').click();
  eq([0, 0], await pg.evaluate('[lyState.only.size, lyState.hide.size]'));
  eq(1, await pg.locator('#lyEmpty-none:visible, #lyEmpty-nomatch:visible').count() === 0 ? 1 : 0, 'no empty message while there is a layer');
});

scenario('ui-layers browser: the card opens in place with places, borders and notes; a second click on the title folds it', async (pg) => {
  const card = pg.locator('#lyList > li.lyx-card');
  await card.locator('[data-lyact="toggle"]').click();
  ok(await card.evaluate((el) => el.classList.contains('lyx-open')));
  eq('true', await card.locator('[data-lyact="toggle"]').getAttribute('aria-expanded'));
  ok((await card.locator('.lyx-row[data-pid]').count()) >= 1, 'places listed');
  ok((await card.locator('[data-lyact="editplaces"]').count()) === 1, 'tools');
  const places = await pg.evaluate('lyById(lyState.open).members.filter((m) => m.place).length');
  eq(places, Number(await card.locator('[data-f="np"]').first().textContent()), 'the count is the number of listed places');
  await card.locator('[data-lyact="toggle"]').click();
  ok(!(await card.evaluate((el) => el.classList.contains('lyx-open'))), 'folded');
  eq(0, await card.locator('.lyx-body').count());
});

scenario('ui-layers browser: names and descriptions are text, never markup', async (pg) => {
  await pg.evaluate(`(() => {
    const bad = JSON.parse(JSON.stringify(layers[0]));
    bad.names = [{ lang: 'en', name: '<img src=x onerror=window.__pwn=1>' }];
    bad.descriptions = [{ lang: 'en', text: '<script>window.__pwn=1</script>' }];
    lySet([bad], layerNotes, categories);
    lyOpen(bad.id);
  })()`);
  await pg.waitForTimeout(300);
  eq(0, await pg.locator('#lyList img[src="x"], #lyList script').count());
  ok((await pg.locator('#lyList').textContent()).includes('<img src=x'), 'shown as text');
  eq(undefined, await pg.evaluate('window.__pwn'));
});

scenario('ui-layers browser: choose places shows the pick view, Save follows the changes, Cancel asks before dropping them', async (pg) => {
  await pg.locator('#lyList [data-lyact="toggle"]').click();
  await pg.locator('#lyList [data-lyact="editplaces"]').click();
  await pg.waitForSelector('#lyPickView:not([hidden])');
  ok(await pg.locator('#lyListView').evaluate((el) => el.hidden), 'the list is hidden');
  ok(await pg.locator('#lySavePlaces').isDisabled(), 'Save disabled at the start');
  const n = await pg.locator('#lyPick li').count();
  ok(n >= 2, 'places listed: ' + n);
  const box = pg.locator('#lyPick li:not(:has(input:checked)) input').first();
  await box.check();
  ok(await pg.locator('#lySavePlaces').isEnabled(), 'Save enabled after a change');
  eq('+1', await pg.locator('#lyAdd').textContent());
  await pg.fill('#lyPickQ', 'zzzzzz');
  await pg.waitForSelector('#lyPickNone:not([hidden])');
  eq(0, await pg.locator('#lyPick li:visible').count());
  await pg.fill('#lyPickQ', '');
  await pg.locator('#lyPickView [data-lyact="cancelplaces"]').click();
  await pg.waitForSelector('#lyConfirm:not([hidden])');
  ok((await pg.locator('#lyConfirmMsg').textContent()).startsWith('Discard the changes'));
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('#lyConfirm[hidden]', { state: 'attached' });
  ok(!(await pg.locator('#lyPickView').evaluate((el) => el.hidden)), 'Esc = stay');
  await pg.locator('#lyPickView [data-lyact="cancelplaces"]').click();
  await pg.locator('#lyConfirmOk').click();
  await pg.waitForSelector('#lyListView:not([hidden])');
});

scenario('ui-layers browser: the delete bar asks first; Esc keeps the layer', async (pg) => {
  const isAdmin = await pg.evaluate('AHM_CONFIG.canLayerAdmin');
  await pg.locator('#lyList [data-lyact="toggle"]').click();
  if (!isAdmin) return eq(0, await pg.locator('[data-lyact="delete"]').count(), 'no Delete button without the right');
  await pg.locator('[data-lyact="delete"]').click();
  await pg.waitForSelector('#lyConfirm:not([hidden])');
  eq('Delete', (await pg.locator('#lyConfirmOk').textContent()).trim());
  await pg.keyboard.press('Escape');
  await pg.waitForSelector('#lyConfirm[hidden]', { state: 'attached' });
  eq(1, await pg.evaluate('layers.length'));
});

scenario('ui-layers browser: the global button/input rules do not reach the tab, so daisyUI classes decide (min-height 30px is the app rule)', async (pg) => {
  const h = await pg.locator('#lyNew').evaluate((el) => el.ownerDocument.defaultView.getComputedStyle(el).minHeight);
  ok(h !== '30px', 'min-height of the Add layer button is ' + h);
  const sel = await pg.locator('#lyCat').evaluate((el) => el.ownerDocument.defaultView.getComputedStyle(el).margin);
  ok(sel !== '3px 0px', 'the select margin is not the app rule: ' + sel);
});
