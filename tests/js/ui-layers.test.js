// Layers tab: tests of tasks/layers.md (own file, so that parallel workers never edit the same test file).
// Part 1: the pure rules in node (core/layer-rules.js). Part 2: the screens in a real browser (headless Chromium via Playwright), against the dev server
// on a throw-away copy of the data; the map library is a stand-in, so map drawing is not exercised. Skipped with --no-browser or without Chromium.
/* global window, document, getComputedStyle, innerWidth, run, searchOptions, layers, places, categories, layerNotes, lyById, lyState, lySet, lyRender, lyRenderList, lyFail, lyOpen, lyStartEdit, lyStopEdit, lyOpenForm, AHM_CONFIG, lyLoaded:writable */
const { load, UI_STANDINS } = require('./lib/ctx');
const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');
const fs = require('fs');
const path = require('path');

// ---------------- part 1: logic, no DOM ----------------
const mk = (id, name, over = {}) => ({ id, names: [{ lang: 'en', name }], descriptions: [], category: null, date_from: null, date_to: null, color: null, members: [], ...over });
function rules(ls, cats = [], ln = []) {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'shapes.js', 'routes.js', 'search.js', 'searchfield.js', 'placeform.js', 'layers.js'], UI_STANDINS);
  p.X('places = []');
  p.X('lySet(__0, __1, __2)', ls, ln, cats);
  return p;
}
test('ui-layers: lyMeta says "3 places · 1 border", counts only what exists, singular for one', () => {
  const p = rules([mk('A', 'A', { members: [{ place: 'p1' }, { place: 'p2' }, { place: 'p3' }, { shape: 's1' }] }), mk('B', 'B', { members: [{ place: 'p1' }] }), mk('C', 'C')]);
  eq('3 places · 1 border', p.X('lyMeta(layers[0])'));
  eq('1 place', p.X('lyMeta(layers[1])'));
  eq('0 places', p.X('lyMeta(layers[2])'));
});
test('ui-layers: lyRows filters by category and by search (names, description, category name, notes) and sorts by name', () => {
  const c = [{ id: 'c1', names: [{ lang: 'en', name: 'Military campaign' }] }];
  const ls = [mk('B', 'Beta'), mk('A', 'Alpha', { category: 'c1', descriptions: [{ lang: 'en', text: 'Wars of Babylon' }] })];
  const p = rules(ls, c, [{ id: 'n1', layer: 'B', title: 'Siege', text: 'of Tushpa', lang: 'en' }]);
  const ids = (q, cat) => p.X(`lyRows(${JSON.stringify(q)}, ${JSON.stringify(cat)}, "en").map(l => l.id)`);
  eq(['A', 'B'], ids('', ''));
  eq(['A'], ids('', 'c1'));
  eq(['A'], ids('military', ''));
  eq(['A'], ids('babylon', ''));
  eq(['B'], ids('tushpa', ''));
  eq([], ids('zzzz', ''));
});
test('ui-layers: lyModeOf follows the only / hide filters', () => {
  const p = rules([mk('A', 'A')]);
  eq('show', p.X('lyModeOf("A")'));
  p.X('lyState.only.add("A")');
  eq('only', p.X('lyModeOf("A")'));
  p.X('lyState.only.clear(); lyState.hide.add("A")');
  eq('hide', p.X('lyModeOf("A")'));
});

// ---------------- part 2: the screens in a real browser ----------------
const STUB = /const STUB = `([\s\S]*?)`;/.exec(fs.readFileSync(path.join(__dirname, 'browser.test.js'), 'utf8'))[1];
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
const daisyFile = () => [process.env.AHM_DAISYUI_CSS, path.join(__dirname, '..', '..', 'app', 'node_modules', 'daisyui', 'daisyui.css')].filter(Boolean).find((f) => fs.existsSync(f));
const SHOTS = process.env.AHM_SHOTS || ''; // a folder: the scenarios then save 400x860 screenshots there
/** opts.phone = a 400x860 phone viewport (the sidebar is then a bottom sheet over the Period / Moment footer); the default is a desktop window. fn(page, server) */
function scenario(name, opts, fn) {
  test(name, async () => {
    const pw = playwright();
    if (process.env.AHM_NO_BROWSER || !pw) return console.log('    (browser tests skipped)');
    const S = await start();
    let browser;
    try {
      browser = await pw.chromium.launch();
    } catch (e) {
      await S.stop();
      return console.log('    (Chromium not available: skipped)');
    }
    const pg = await browser.newPage({ viewport: opts.phone ? { width: 400, height: 860 } : { width: 1280, height: 800 } });
    pg.setDefaultTimeout(8000);
    const errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    pg.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console ' + m.text());
    });
    await pg.route('**/maplibre-gl*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* stand-in */' }));
    await pg.route((u) => !u.toString().startsWith(S.base) && !/maplibre-gl/.test(u.toString()), (r) => r.abort());
    const dz = daisyFile();
    if (dz) await pg.route('**/daisyui@*/daisyui.css', (r) => r.fulfill({ contentType: 'text/css', path: dz }));
    await pg.addInitScript(STUB);
    try {
      await fn(pg, S);
      eq([], errs, 'page errors');
    } finally {
      await browser.close();
      await S.stop();
    }
  });
}
const shot = (pg, name) => (SHOTS ? pg.screenshot({ path: path.join(SHOTS, name + '.png') }) : null);
const open = async (pg, S) => {
  await pg.goto(S.base + '/');
  await pg.waitForFunction(() => document.querySelectorAll('#lyList li').length > 0);
  await pg.click('[data-tab=layers]');
};
const tri = (pg, row, mode) => pg.locator(`${row} label:has(input[value=${mode}])`).click();
const searchCount = (pg) => pg.evaluate(() => run(searchOptions()).length);

scenario('ui-layers (browser): list, three-state control, category filter, search, count', {}, async (pg, S) => {
  await open(pg, S);
  eq(1, await pg.locator('#lyList li').count(), 'the sample layer is listed');
  ok(/3 places/.test(await pg.locator('#lyList li').innerText()), 'its row says how many places');
  eq('1 layer', (await pg.locator('#lyCount').innerText()).trim(), 'count');
  eq(3, await pg.locator('#lyList li input[type=radio]').count(), 'three radios in one join');
  eq('show', await pg.locator('#lyList li input:checked').getAttribute('value'), 'Show is the start state');
  const total = await searchCount(pg);
  await tri(pg, '#lyList li', 'only');
  eq('only', await pg.locator('#lyList li input:checked').getAttribute('value'), 'Only is ticked');
  eq(3, await searchCount(pg), 'Only: the 3 places of the layer');
  await tri(pg, '#lyList li', 'hide');
  eq(total - 3, await searchCount(pg), 'Hide: the layer places are left out');
  ok(Number(await pg.locator('#lyList li').evaluate((e) => getComputedStyle(e.querySelector('.ly-main')).opacity)) < 1, 'a hidden layer is greyed');
  ok(/not in/.test(await pg.locator('#lyActive').innerText()), 'the Explore filter line shows a chip');
  await tri(pg, '#lyList li', 'show');
  eq(total, await searchCount(pg), 'Show: back to everything');
  const cat = await pg.evaluate(() => layers[0].category);
  await pg.selectOption('#lyCat', { index: 1 });
  eq((await pg.inputValue('#lyCat')) === cat ? 1 : 0, await pg.locator('#lyList li').count(), 'the category select filters the list');
  await pg.selectOption('#lyCat', '');
  eq(1, await pg.locator('#lyList li').count(), 'all categories');
  await pg.fill('#lyQ', 'zzzz');
  eq(0, await pg.locator('#lyList li').count(), 'search: no match');
  ok(/No layers match/.test(await pg.locator('#lyBox').innerText()), 'search: the empty state says so');
  await pg.fill('#lyQ', 'urart');
  eq(1, await pg.locator('#lyList li').count(), 'search: match');
  await pg.fill('#lyQ', '');
  const sw = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  ok(sw[0] <= sw[1], '400px: no horizontal scroll ' + sw);
  await shot(pg, 's085-list');
});

scenario('ui-layers (browser): card, choose places (+N / −N, save), form validation, create, notes, delete via the modal', {}, async (pg, S) => {
  await open(pg, S);
  await pg.click('#lyList li [data-act=open]');
  ok(await pg.locator('#lyCard .ly-card').isVisible(), 'the card opens');
  ok((await pg.locator('#lyList').isHidden()) && (await pg.locator('#lyInfo').isHidden()), 'the list is replaced by the card');
  ok((await pg.locator('#lyCard [data-places] li.ly-mem').count()) >= 1, 'place rows');
  await shot(pg, 's086-card');
  const before = await pg.evaluate(() => [lyById(lyState.open).members.length, places.length]);
  await pg.locator('#lyCard [data-places] [data-act=leave]').first().click();
  await pg.waitForFunction((n) => lyById(lyState.open).members.length === n, before[0] - 1);
  eq(before[1], await pg.evaluate(() => places.length), 'the place is still on the main map');
  await pg.click('#lyCard [data-act=editplaces]');
  ok((await pg.locator('#lyPickView').isVisible()) && (await pg.locator('#lyCard').isHidden()), 'choosing places is its own screen');
  const rows = await pg.locator('#lyPick li.ly-pickrow').count();
  ok(rows > 3, 'pick list shown (' + rows + ')');
  ok((await pg.locator('#lyPick .ly-tag').first().innerText()).trim().length > 0, 'each row has a type tag');
  const unticked = pg.locator('#lyPick li.ly-pickrow:has(input:not(:checked))');
  await unticked.nth(0).locator('input').check();
  await unticked.nth(0).locator('input').check();
  eq('+2', (await pg.locator('#lyPlus').innerText()).trim(), 'two places added');
  const member = await pg.evaluate(() => [...lyState.staged].find((id) => lyById(lyState.open).members.some((m) => (m.place || m.shape) === id)));
  await pg.locator(`#lyPick li[data-pid="${member}"] input`).uncheck();
  ok(!/−0/.test(await pg.locator('#lyMinus').innerText()), '−N after taking one out: ' + (await pg.locator('#lyMinus').innerText()));
  await pg.fill('#lyPickQ', 'zzzzzz');
  ok(await pg.locator('#lyPickNone').isVisible(), '"Nothing matches."');
  eq(0, await pg.locator('#lyPick li').count(), 'no rows when nothing matches');
  await shot(pg, 's087-pick-empty');
  await pg.fill('#lyPickQ', '');
  await shot(pg, 's087-pick');
  const want = await pg.evaluate(() => lyState.staged.size);
  await pg.click('#lyPickSave');
  await pg.waitForFunction(() => !lyState.editing);
  eq(want, await pg.evaluate(() => lyById(lyState.open).members.length), 'members saved');
  ok(await pg.locator('#lyCard .ly-card').isVisible(), 'back on the card');
  await pg.click('#lyCard [data-act=editplaces]');
  await pg.locator('#lyPick li.ly-pickrow input').first().click();
  await pg.click('#lyPickCancel');
  eq(want, await pg.evaluate(() => lyById(lyState.open).members.length), 'Cancel changes nothing');
  await pg.click('#lyCard [data-act=addnote]');
  await pg.fill('#nTitle', 'Campaign of year 30');
  await pg.fill('#nText', 'He took the city.');
  await pg.click('#dSave');
  await pg.waitForFunction(() => layerNotes.length === 1);
  ok(/Campaign of year 30/.test(await pg.locator('#lyCard [data-notes]').innerText()), 'the note is shown in the card');
  await pg.click('#lyCard [data-act=close]');
  await pg.click('#lyNew');
  ok((await pg.locator('#lyFormView .ly-form').isVisible()) && (await pg.locator('#lyListView').isHidden()), 'the form opens');
  await pg.click('#lyFormView [data-act=save]');
  ok(/Give the layer at least one name\./.test(await pg.locator('#lyFormView [data-error]').innerText()), 'name required: inline message');
  ok(await pg.locator('#lyFormView [data-error]').isVisible(), 'the message is shown');
  eq(1, await pg.evaluate(() => layers.length), 'nothing was saved');
  await shot(pg, 's088-form-error');
  await pg.fill('#lyFormView .ahm-name input[type=text]', 'Hammurabi campaigns');
  await pg.click('#lyFormView [data-act=adddesc]');
  await pg.fill('#lyFormView .ly-descrow textarea', 'Wars of Babylon.');
  await pg.selectOption('#lyFormView [data-category]', { index: 1 });
  await shot(pg, 's088-form');
  await pg.click('#lyFormView [data-act=save]');
  await pg.waitForFunction(() => layers.length === 2);
  ok(/Hammurabi campaigns/.test(await pg.locator('#lyCard .ly-name').innerText()), 'the new layer is created and opened');
  ok(/Wars of Babylon/.test(await pg.locator('#lyCard .ly-desc').innerText()), 'its description is shown');
  await pg.click('#lyCard [data-act=editlayer]');
  eq('Hammurabi campaigns', await pg.inputValue('#lyFormView .ahm-name input[type=text]'), 'edit shows the saved name');
  await pg.click('#lyFormView [data-act=cancel]');
  eq(2, await pg.evaluate(() => layers.length), 'Cancel of the form saves nothing');
  await pg.evaluate(() => {
    layers[1].names[0].name = '<img src=x onerror=alert(1)>';
    lyRender();
  });
  eq(0, await pg.locator('#lyCard img[src="x"], #lyList img[src="x"]').count(), 'a name with markup is shown as text');
  ok((await pg.locator('#lyCard .ly-name').innerText()).includes('<img'), 'the text is on screen');
  await pg.click('#lyCard [data-act=delete]');
  ok(await pg.locator('#ahm-confirm').isVisible(), 'the confirm dialog opens');
  ok(/Delete the layer/.test(await pg.locator('#ahm-confirm h3').innerText()), 'with the layer text');
  await pg.click('#ahm-confirm form .btn-soft');
  eq(2, await pg.evaluate(() => layers.length), 'Cancel keeps the layer');
  await pg.click('#lyCard [data-act=delete]');
  await pg.click('#ahm-confirm [data-ok]');
  await pg.waitForFunction(() => layers.length === 1);
  ok(await pg.locator('#lyList').isVisible(), 'back on the list');
});

scenario('ui-layers (browser): a visitor sees no buttons and "Log in to change layers."', {}, async (pg, S) => {
  await open(pg, S);
  await pg.evaluate(() => {
    AHM_CONFIG.canEdit = false;
    AHM_CONFIG.canLayerAdmin = false;
    lyRender();
  });
  ok(await pg.locator('#ly-add').isHidden(), 'no Add layer');
  await pg.click('#lyList li [data-act=open]');
  ok(/Log in to change layers/.test(await pg.locator('#lyCard').innerText()), 'the visitor line');
  for (const a of ['editlayer', 'editplaces', 'addnote', 'delete', 'leave']) eq(0, await pg.locator(`#lyCard [data-act=${a}]:visible`).count(), a + ' hidden');
});

scenario('ui-layers (browser): the empty list', {}, async (pg, S) => {
  await pg.goto(S.base + '/');
  await pg.waitForFunction(() => typeof lySet === 'function' && document.querySelectorAll('#lyList li').length > 0);
  await pg.evaluate(() => lySet([], [], categories));
  await pg.click('[data-tab=layers]');
  ok(/No layers yet/.test(await pg.locator('#lyBox').innerText()), 'empty state text');
  eq(0, await pg.locator('#lyList li').count(), 'no rows');
  ok(await pg.locator('#lyNew').isVisible(), 'the Add layer button is still there');
  await shot(pg, 'state-empty');
});

scenario('ui-layers (browser): loading state and load error with Retry', {}, async (pg, S) => {
  await open(pg, S);
  await pg.evaluate(() => {
    lyLoaded = false;
    lyRenderList();
  });
  ok((await pg.locator('#lyBox').isVisible()) && (await pg.locator('#lyBox').innerText()).trim().length > 0, 'the loading state is shown');
  await shot(pg, 'state-loading');
  await pg.evaluate(() => lyFail('HTTP 500'));
  ok(/Could not load the layers \(HTTP 500\)/.test(await pg.locator('#lyBox').innerText()), 'the error names the cause');
  await shot(pg, 'state-error');
  // components.js (shared) reloads the page on any [data-retry] click, and kit.state's Retry button has that attribute: so Retry = a reload (the tab is Explore again)
  await Promise.all([pg.waitForEvent('load'), pg.locator('#lyBox button').click()]);
  await open(pg, S);
  eq(1, await pg.locator('#lyList li').count(), 'after Retry the list is loaded again');
});

scenario('ui-layers (browser): a failed save shows the error in the form and keeps what was typed', {}, async (pg, S) => {
  await open(pg, S);
  await pg.click('#lyNew');
  await pg.fill('#lyFormView .ahm-name input[type=text]', 'Doomed');
  await pg.evaluate(() => {
    window.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'disk full' }) });
  });
  await pg.click('#lyFormView [data-act=save]');
  await pg.waitForFunction(() => /disk full/.test(document.querySelector('#lyFormView [data-error]').textContent));
  eq('Doomed', await pg.inputValue('#lyFormView .ahm-name input[type=text]'), 'the typed name is kept');
  ok(await pg.locator('#lyFormView [data-act=save]').isEnabled(), 'Save works again');
});

scenario('ui-layers (browser): 400x860 phone: every screen fits the width', { phone: true }, async (pg, S) => {
  await open(pg, S);
  const r = await pg.locator('#resizer').boundingBox(); // drag the grab handle up: a tall sheet shows the whole screen
  await pg.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await pg.mouse.down();
  await pg.mouse.move(r.x + r.width / 2, 130, { steps: 6 });
  await pg.mouse.up();
  const fits = async (what) => {
    const w = await pg.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.querySelector('#tab-layers').scrollWidth, document.querySelector('#tab-layers').clientWidth]);
    ok(w[0] <= w[1] && w[2] <= w[3], what + ': no horizontal scroll ' + w);
  };
  await fits('list');
  await shot(pg, 'phone-s085-list');
  await pg.evaluate(() => lyOpen(layers[0].id));
  await fits('card');
  await pg.waitForTimeout(300); // the fade-in of the card
  await shot(pg, 'phone-s086-card');
  await pg.evaluate(() => lyStartEdit());
  await fits('choose places');
  await shot(pg, 'phone-s087-pick');
  await pg.evaluate(() => lyStopEdit());
  await pg.evaluate(() => lyOpenForm(null));
  await fits('form');
  await shot(pg, 'phone-s088-form');
});
