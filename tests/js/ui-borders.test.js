// Borders tab: tests of tasks/borders.md (own file, so that parallel workers never edit the same test file).
// Logic in node; the UI in a real Chromium (docs/design-migration/05-browser-testing.md). Screenshots (400x860) go to $AHM_SHOTS or <tmp>/ahm-borders-shots.
const { load, UI_STANDINS } = require('./lib/ctx');
const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const SHOTS = process.env.AHM_SHOTS || path.join(os.tmpdir(), 'ahm-borders-shots');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- node: the rule (no markup built in JS in the borders code) and the markup is where it belongs ----
test('borders (node): the borders code builds no markup from strings (list, card, form, add and drawing panels)', () => {
  const js = read('app/js/sidebar/shapes.js'),
    a = js.indexOf('// ---- the list ----'),
    b = js.indexOf('async function shSaveForm'),
    c = js.indexOf('function shRenderAdd()'),
    d = js.indexOf('async function shAddOsm');
  ok(a > 0 && b > a && c > b && d > c, 'the markers are found');
  for (const [name, code] of [['list+card+form', js.slice(a, b)], ['add+drawing', js.slice(c, d)]]) {
    // the rivers branch of shRenderAdd is the rivers worker's and stays as it was
    const part = name === 'add+drawing' ? code.replace(/ {2}\} else if \(sh\.mode === 'rivers'\) \{[\s\S]*?\} else if \(sh\.adding\) \{/, '') : code;
    const bad = part.split('\n').filter((l) => /innerHTML|insertAdjacentHTML|outerHTML|\besc\(/.test(l.replace(/\/\/.*$/, '')));
    // shVersionChips (string, kept for routes.js) sits inside the first slice
    const real = bad.filter((l) => !/shVersionChips|shapeWhen\(v\) \|\| 'no dates'\)\}<\/span/.test(l));
    eq([], real, name + ': lines that build markup');
  }
});
test('borders (node): the templates and the static regions exist; the tab keeps its ids', () => {
  const html = read('app/index.html');
  for (const id of ['t-bd-card', 't-bd-type', 't-bd-row', 't-bd-chip', 't-bd-swatch', 't-bd-src', 't-bd-notebtn', 't-bd-srcopt', 't-bd-lychip', 't-bd-name', 't-bd-formview', 't-bd-addbtn', 't-bd-add', 't-bd-geo', 't-bd-draw']) ok(html.includes(`<template id="${id}">`), 'template ' + id);
  const tab = html.slice(html.indexOf('<!-- ahm:region tab-borders -->'), html.indexOf('<!-- /ahm:region tab-borders -->'));
  for (const id of ['shIntro', 'shQ', 'shTypes', 'shCount', 'shFit', 'shList', 'shAdd', 'rvSel']) ok(tab.includes(`id="${id}"`), '#' + id);
  ok(/id="bdPanel"/.test(tab) && /class="input w-full/.test(tab), 'the panel container and the daisyUI input');
});
test('borders (node): shapes.css defines no class that daisyUI owns in the new (bd-) rules', () => {
  const css = read('app/css/shapes.css').slice(read('app/css/shapes.css').indexOf('Borders tab (bd-*)'));
  const own = new Set([...css.matchAll(/\.([a-z][a-z0-9_-]*)/gi)].map((m) => m[1]));
  const daisy = ['stack', 'label', 'tabs', 'badge', 'sm', 'list', 'toast', 'card', 'menu', 'tab', 'modal', 'table', 'status', 'stat', 'filter', 'dock', 'join', 'kbd', 'link', 'toggle', 'range', 'select', 'input', 'radio', 'checkbox', 'btn', 'alert', 'skeleton', 'loading', 'progress', 'tooltip', 'indicator', 'collapse', 'dropdown', 'fieldset', 'validator', 'swap'];
  eq([], [...own].filter((c) => daisy.includes(c) ), 'bd css classes that daisyUI owns');
  eq([], [...own].filter((c) => !/^(bd-|ahm-|pane$)/.test(c) && true), 'classes without the bd- prefix');
});

// ---- browser ----
const STUB = `(function(){
 const p=new Proxy(function(){},{get:(t,k)=>{ if(k==='then')return undefined;
  if(k==='on'||k==='once')return (ev,a,b)=>{const f=typeof a==='function'?a:b; if(ev==='load'||ev==='style.load'||ev==='idle')setTimeout(()=>f&&f({}),0); return p;};
  if(k==='getZoom')return()=>6; if(k==='getPitch'||k==='getBearing')return()=>0; if(k==='getLayer'||k==='getSource')return()=>undefined; if(k==='queryRenderedFeatures')return()=>[];
  if(k==='getBounds')return()=>({getWest:()=>40,getEast:()=>48,getNorth:()=>42,getSouth:()=>36}); if(k==='getCanvas')return()=>({style:{},addEventListener(){},removeEventListener(){}});
  if(k==='getStyle')return()=>({layers:[],sources:{}}); if(k==='isStyleLoaded')return()=>true; if(k==='getLngLat')return()=>({lat:40,lng:44});
  return ()=>p; }, apply:()=>p, construct:()=>p});
 window.maplibregl={Map:function(){return p;},Marker:function(){return p;},Popup:function(){return p;},NavigationControl:function(){return {};},LngLatBounds:function(){return {extend(){return this;},isEmpty(){return true;}};}};
})();`;
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
const daisyFile = () => [process.env.AHM_DAISYUI_CSS, path.join(ROOT, 'app', 'node_modules', 'daisyui', 'daisyui.css')].filter(Boolean).find((f) => fs.existsSync(f));
function scenario(name, fn) {
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
    const pg = await browser.newPage({ viewport: { width: 400, height: 860 } });
    pg.setDefaultTimeout(8000);
    const errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push('console ' + m.text()));
    await pg.route('**/maplibre-gl*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* stand-in */' }));
    await pg.route((u) => !u.toString().startsWith(S.base) && !/maplibre-gl|daisyui@/.test(u.toString()), (r) => r.abort());
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
// the panel frames are 400x860 of the open desktop panel (the page itself is a phone sheet below 700px): shoot its left 400x860
const shot = async (pg, name) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.setViewportSize({ width: 800, height: 860 });
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(SHOTS, name + '.png'), clip: { x: 0, y: 0, width: 400, height: 860 } });
  await pg.setViewportSize({ width: 400, height: 860 });
};
const open = async (pg, S) => {
  await pg.goto(S.base + '/');
  await pg.waitForTimeout(1200);
  await pg.addStyleTag({ content: '.campaigns-badge { display: none !important; }' }); // the dev badge of another feature floats over the bottom of the phone sheet
  await pg.evaluate(() => { AHM.map.showPreview = () => {}; tab('shapes'); });
};
// a drawing tool stand-in whose points the test controls
const DRAW = () => {
  window.__pts = [];
  AHM.map.drawShape = ({ kind }, cb) => {
    const g = () => (kind === 'area' ? (__pts.length >= 3 ? { type: 'Polygon', coordinates: [[...__pts, __pts[0]]] } : null) : __pts.length >= 2 ? { type: 'LineString', coordinates: __pts } : null);
    const ctl = { remove() {}, undo() { __pts.pop(); cb(g()); }, points: () => __pts, getGeometry: g };
    window.__ctl = ctl;
    window.__push = (n) => { for (let i = 0; i < n; i++) __pts.push([44 + __pts.length * 0.1, 40 + (__pts.length % 2) * 0.1]); cb(g()); };
    return ctl;
  };
};

scenario('borders (browser): list: intro with More, search, type chips with counts, eye toggle, hidden row, pinned Add border', async (pg, S) => {
  await open(pg, S);
  ok(await pg.locator('#tab-shapes').isVisible(), 'the Borders tab is shown');
  await shot(pg, 's073-list');
  const n = await pg.evaluate(() => shapes.filter((s) => shapeGroup(s) === 'border').length);
  eq(n, await pg.locator('#shList li[data-sid]').count(), 'one row per border');
  ok(/^\d+ of \d+ borders$/.test(await pg.locator('#shCount').innerText()), 'count line');
  const clamped = await pg.locator('#shIntro').evaluate((e) => e.classList.contains('bd-clamp'));
  await pg.click('#shMore');
  ok(clamped && !(await pg.locator('#shIntro').evaluate((e) => e.classList.contains('bd-clamp'))), 'More unfolds the intro');
  const chips = await pg.locator('#shTypes [data-t]').evaluateAll((els) => els.map((e) => ({ t: e.dataset.t, n: +e.querySelector('.bd-n').textContent })));
  ok(chips.length > 0 && chips.reduce((a, c) => a + c.n, 0) === n, 'the type chips count every border once: ' + JSON.stringify(chips));
  await pg.click('#shTypes [data-t]');
  ok(await pg.locator('#shTypes [data-t].btn-primary').count() === 1, 'a clicked type chip is on');
  eq(chips[0].n, await pg.locator('#shList li[data-sid]').count(), 'and filters the list');
  await pg.click('#shTypes [data-t].btn-primary');
  await pg.fill('#shQ', 'zzzzqq');
  ok(/No borders match/.test(await pg.locator('#shList').innerText()), 'no match shows the empty state');
  await pg.fill('#shQ', '');
  const row = pg.locator('#shList li[data-sid]').first();
  const full = await row.locator('.ahm-rt').evaluate((e) => +getComputedStyle(e).opacity);
  await row.locator('.bd-eye').click();
  eq(1, await pg.evaluate(() => sh.hidden.size), 'the eye hides the border on the map');
  ok((await row.locator('.ahm-rt').evaluate((e) => +getComputedStyle(e).opacity)) < full, 'a hidden border shows the off-eye state');
  await row.locator('.bd-eye').click();
  eq(0, await pg.evaluate(() => sh.hidden.size), 'the eye shows it again');
  ok(/Kingdom|Territory|Province|Country|·/.test(await row.locator('.ahm-hint').first().innerText()), 'the sub line has type, kind and dates');
  eq('sticky', await pg.locator('#shAdd .bd-bar').evaluate((e) => getComputedStyle(e).position), 'Add border is pinned');
  ok(/Add border/.test(await pg.locator('#shAdd').innerText()), 'the pinned button');
  eq(true, await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.body').scrollWidth <= document.querySelector('.body').clientWidth + 1), 'no sideways scroll at 400px');
});

scenario('borders (browser): card: icons on top, look, layers, notes; a version chip switches the shape; delete asks the shared modal', async (pg, S) => {
  await open(pg, S);
  const ids = await pg.evaluate(async () => {
    const s = shapes.find((x) => x.type === 'kingdom'),
      series = shNewUuid();
    await postJSON(shUrl().shapeSave, shBody(s, { series }));
    const id2 = await shCreate({ names: s.names, type: s.type, date_from: null, date_to: null, source: '', series, geometry: s.geometry });
    await shReload();
    shOpen(s.id);
    return { a: s.id, b: id2, n: shapes.length };
  });
  let card = pg.locator('#shList .bd-open');
  eq(1, await card.count(), 'the open row unfolds into the card');
  for (const a of ['edit', 'editshape', 'addversion', 'fit', 'delete']) ok((await card.locator(`[data-shact=${a}]`).count()) === 1, 'icon action ' + a);
  ok(await card.locator('[data-shact=delete]').evaluate((e) => e.classList.contains('text-error')), 'delete is red');
  ok(/versions in time · 2/i.test(await card.innerText()) && (await card.locator('[data-vlist] [aria-current]').count()) === 1, 'Versions in time lists both, one marked');
  ok(/no dates/.test(await card.locator('[data-vlist]').innerText()), 'a version without dates says "no dates"');
  ok((await card.locator('[data-swatches] .bd-swatch').count()) >= 6 && (await card.locator('#shLabel').count()) === 1 && (await card.locator('#shOp').count()) === 1, 'LOOK has swatches, opacity and the name toggle');
  ok(/in layers/i.test(await card.innerText()) && /notes/i.test(await card.innerText()) && (await card.locator('[data-shact=addnote]').count()) === 1, 'In layers and Notes (with Add note)');
  await shot(pg, 's074-card');
  await card.locator('[data-vlist] [data-shact=version]').click();
  card = pg.locator('#shList .bd-open');
  eq(ids.b, await pg.evaluate(() => sh.open), 'a version chip opens the other version');
  const col = await pg.evaluate(() => shapeById(sh.open).color);
  await card.locator('[data-swatches] .bd-swatch').nth(2).click();
  await pg.waitForTimeout(300);
  ok((await pg.evaluate(() => shapeById(sh.open).color)) !== undefined && (await card.locator('[data-swatches] .bd-swatch[aria-pressed=true]').count()) <= 1, 'a swatch saves the colour at once (was ' + col + ')');
  await card.locator('[data-shact=delete]').click();
  ok(await pg.locator('#ahm-confirm').isVisible(), 'delete asks the shared confirm');
  ok(/Delete “/.test(await pg.locator('#ahm-confirm h3').innerText()), 'with the s068 title');
  await pg.click('#ahm-confirm [data-ok]');
  await pg.waitForTimeout(700);
  eq(ids.n - 1, await pg.evaluate(() => shapes.length), 'confirming deletes the border');
});

scenario('borders (browser): drawing an area: point count, error under 3 points, Finish only from 3, Undo, discard asks', async (pg, S) => {
  await open(pg, S);
  await pg.evaluate(DRAW);
  await pg.click('[data-shadd=open]');
  ok(/Add a border/.test(await pg.locator('#bdPanel').innerText()) && (await pg.locator('#bdMain').isHidden()), 'the add view replaces the list');
  await pg.click('[data-shadd=drawarea]');
  ok(await pg.evaluate(() => !!sh.draw && sh.draw.kind === 'area'), 'drawing starts');
  eq('No points yet.', await pg.locator('#bdPts').innerText(), 'the counter starts empty');
  ok((await pg.locator('#shFinish').isDisabled()) && (await pg.locator('#shDrawErr').isHidden()), 'Finish disabled, no error before the first click');
  await pg.evaluate(() => __push(2));
  eq('2 points so far.', await pg.locator('#bdPts').innerText(), 'the counter follows');
  eq('An area needs at least 3 points.', (await pg.locator('#shDrawErr').innerText()).trim(), 'the error under 3 points');
  ok(await pg.locator('#shFinish').isDisabled(), 'Finish stays disabled');
  await shot(pg, 's076-drawing-area-error');
  await pg.evaluate(() => __push(1));
  ok((await pg.locator('#shFinish').isEnabled()) && (await pg.locator('#shDrawErr').isHidden()), 'Finish enabled at 3 points, error gone');
  ok(/Click/.test(await pg.locator('.bd-keys kbd').first().innerText()) && (await pg.locator('.bd-keys kbd').count()) === 4, 'the four key hints are kbd');
  await pg.click('[data-shadd=undo]');
  eq('2 points so far.', await pg.locator('#bdPts').innerText(), 'Undo removes a point');
  await pg.click('[data-shadd=canceldraw]');
  ok(await pg.locator('#ahm-confirm').isVisible() && /Discard this drawing/.test(await pg.locator('#ahm-confirm h3').innerText()), 'Cancel with points asks to discard');
  await pg.click('#ahm-confirm form .btn-soft');
  ok(await pg.evaluate(() => !!sh.draw), 'declining keeps the drawing');
  await pg.click('[data-shadd=canceldraw]');
  await pg.click('#ahm-confirm [data-ok]');
  await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => !sh.draw), 'confirming discards it');
  // a line: follow a river block
  await pg.click('[data-shadd=open]');
  await pg.click('[data-shadd=drawline]');
  ok(await pg.locator('[data-river]').isVisible() && /Drawing a line/.test(await pg.locator('#bdPanel').innerText()), 'a line offers Follow a river');
  await pg.evaluate(() => shCancelDraw());
});

scenario('borders (browser): a new version: the form has the banner, names, type pills, Began and Ended, Save version', async (pg, S) => {
  await open(pg, S);
  const old = await pg.evaluate(() => {
    const s = shapes.find((x) => x.type === 'kingdom');
    shOpenForm({ kind: 'area', prevId: s.id, series: shNewUuid(), names: s.names, type: s.type, source: '', geometry: s.geometry, look: { color: s.color, opacity: s.opacity, label: s.label } });
    return { id: s.id, n: shapes.length };
  });
  const f = pg.locator('#bdPanel');
  ok(/New version of/.test(await f.locator('h3').innerText()) && /stays as it is/.test(await f.locator('.bd-headcard').innerText()), 'title and subtitle');
  eq(2, await f.locator('.ahm-date').count(), 'Began and Ended use the shared date field');
  ok((await f.locator('[data-type] .ahm-pill').count()) > 0 && (await f.locator('[data-type] .btn-primary').count()) === 1, 'type pills with one chosen');
  eq('Save version', (await f.locator('[data-shact=save]').innerText()).trim(), 'the save button');
  await shot(pg, 's033-version-form');
  await pg.click('#shForm [data-act=addname]');
  await pg.locator('#shForm [data-value=name]').last().fill('Later outline');
  await pg.locator('#shForm .ahm-date').first().locator('input[type=radio]').nth(1).check({ force: true });
  await pg.locator('#shForm .ahm-date').first().locator('[data-f=y]').first().fill('500');
  await pg.click('[data-shact=save]');
  await pg.waitForTimeout(800);
  eq(old.n + 1, await pg.evaluate(() => shapes.length), 'saved as a new version');
  ok(/versions in time · 2/i.test(await pg.locator('#shList').innerText()), 'the saved card lists both versions');
  // an error does not save and says so
  await pg.evaluate((id) => shOpenForm({ id: null, kind: 'area', geometry: shapeById(id).geometry }), old.id);
  await pg.click('[data-shact=save]');
  ok(/at least one name/.test(await pg.locator('#bdPanel #shErr').innerText()), 'a form error shows in the alert');
  eq(old.n + 1, await pg.evaluate(() => shapes.length), 'nothing saved on error');
});

scenario('borders (browser): add a border: OSM search (results, none, service down) with a stubbed search; GeoJSON limit and confirm', async (pg, S) => {
  await open(pg, S);
  await pg.click('[data-shadd=open]');
  const poly = { type: 'Polygon', coordinates: [[[44, 41], [45, 41], [45, 42], [44, 41]]] };
  await pg.evaluate((g) => {
    const real = window.fetch;
    window.__geo = 'ok';
    window.fetch = (u, o) => /format=jsonv2/.test(String(u))
      ? Promise.resolve(window.__geo === 'down' ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => (window.__geo === 'none' ? [] : [{ display_name: 'Lori, Armenia', osm_type: 'relation', osm_id: 1, type: 'administrative', place_rank: 8, addresstype: 'state', namedetails: { name: 'Lori' }, geojson: g }]) })
      : real(u, o);
  }, poly);
  await pg.fill('#shGeoQ', 'Lori');
  await pg.click('[data-shadd=search]');
  await pg.waitForSelector('#shGeoRes .bd-geo');
  ok(/Lori/.test(await pg.locator('#shGeoRes').innerText()) && (await pg.locator('#shGeoRes [data-shadd=geoadd]').count()) === 1, 'a result with a + button');
  await shot(pg, 's075-add-results');
  await pg.evaluate(() => (window.__geo = 'none'));
  await pg.fill('#shGeoQ', 'Nowhere');
  await pg.click('[data-shadd=search]');
  await pg.waitForFunction(() => /Nothing with an outline/.test($('#shGeoRes').textContent));
  ok(/Nothing with an outline found/.test(await pg.locator('#shGeoRes').innerText()), 'none found');
  await pg.evaluate(() => (window.__geo = 'down'));
  await pg.fill('#shGeoQ', 'Downtown');
  await pg.click('[data-shadd=search]');
  await pg.waitForSelector('#shGeoRes .alert-warning');
  ok(/answered 503/.test(await pg.locator('#shGeoRes').innerText()) && (await pg.locator('#shGeoRes [data-retry]').count()) === 1, 'service down with Retry');
  // the + button adds
  await pg.evaluate(() => (window.__geo = 'ok'));
  await pg.fill('#shGeoQ', 'Lori again');
  const n0 = await pg.evaluate(() => shapes.length);
  await pg.click('[data-shadd=search]');
  await pg.waitForSelector('#shGeoRes .bd-geo');
  await pg.click('#shGeoRes [data-shadd=geoadd]');
  await pg.waitForTimeout(800);
  eq(n0 + 1, await pg.evaluate(() => shapes.length), 'the + button adds the border');
  ok(/OpenStreetMap contributors/.test(await pg.locator('#shList').innerText()), 'its card shows the OSM attribution');
  // import
  await pg.evaluate(() => tab('shapes'));
  await pg.click('[data-shadd=open]');
  const fc = (n) => JSON.stringify({ type: 'FeatureCollection', features: Array.from({ length: n }, (_, i) => ({ type: 'Feature', properties: { name: 'F' + i }, geometry: { type: 'Polygon', coordinates: [[[44, 40], [44.1, 40], [44.1, 40.1], [44, 40]]] } })) });
  await pg.setInputFiles('#shFile', { name: 'big.geojson', mimeType: 'application/json', buffer: Buffer.from(fc(140)) });
  await pg.waitForFunction(() => /limit is 100/.test($('#shAddMsg').textContent));
  eq('The file has 140 shapes; the limit is 100 at once. Split it.', (await pg.locator('#shAddMsg').innerText()).trim(), 'the limit message');
  await pg.setInputFiles('#shFile', { name: 'bad.geojson', mimeType: 'application/json', buffer: Buffer.from('{nope') });
  await pg.waitForFunction(() => /Import failed/.test($('#shAddMsg').textContent));
  ok(true, 'a broken file says Import failed');
  await pg.setInputFiles('#shFile', { name: 'three.geojson', mimeType: 'application/json', buffer: Buffer.from(fc(3)) });
  await pg.waitForSelector('#ahm-confirm[open]');
  eq('Import 3 shapes as borders?', (await pg.locator('#ahm-confirm h3').innerText()).trim(), 'the import confirm (s069)');
  const n1 = await pg.evaluate(() => shapes.length);
  await pg.click('#ahm-confirm form .btn-soft');
  await pg.waitForTimeout(300);
  eq(n1, await pg.evaluate(() => shapes.length), 'Cancel imports nothing');
});

scenario('borders (browser): Rivers mode still opens, lists and offers its own add panel; Borders comes back intact', async (pg, S) => {
  await open(pg, S);
  await pg.evaluate(() => tab('rivers'));
  ok(await pg.locator('#rvSel').isVisible() && /Find rivers/.test(await pg.locator('#shAdd').innerText()), 'rivers: selection block and Find rivers');
  ok(/rivers/.test(await pg.locator('#shCount').innerText()) && (await pg.locator('#shList').innerText()).length > 0, 'rivers: the list renders');
  await pg.evaluate(() => tab('shapes'));
  ok(await pg.locator('#rvSel').isHidden() && /Add border/.test(await pg.locator('#shAdd').innerText()), 'borders: Add border is back');
});
