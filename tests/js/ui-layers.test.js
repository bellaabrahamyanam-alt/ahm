/* global document, window, getComputedStyle, layers, layerNotes, categories, places, lyState, lyById, lySet, lyOpen, lyFail, lyShowState, run, searchOptions, dateKey, AHM_CONFIG */
// Layers tab: tests of tasks/layers.md (own file, so that parallel workers never edit the same test file).
// The drawn tab is tested in real Chromium (Playwright) against the dev server on a copy of the data; set AHM_SHOTS=<dir> to also write 400x860 screenshots.
const fs = require('fs');
const path = require('path');
const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');

const STUB = `(function(){
 const p=new Proxy(function(){},{get:(t,k)=>{ if(k==='then')return undefined;
  if(k==='on'||k==='once')return (ev,a,b)=>{const f=typeof a==='function'?a:b; if(ev==='load'||ev==='style.load'||ev==='idle')setTimeout(()=>f&&f({}),0); return p;};
  if(k==='getZoom')return()=>6; if(k==='getPitch'||k==='getBearing')return()=>0; if(k==='getLayer'||k==='getSource')return()=>undefined; if(k==='queryRenderedFeatures')return()=>[];
  if(k==='getBounds')return()=>({getWest:()=>40,getEast:()=>48,getNorth:()=>42,getSouth:()=>36}); if(k==='getCanvas')return()=>({style:{},addEventListener(){},removeEventListener(){}});
  if(k==='getStyle')return()=>({layers:[],sources:{}}); if(k==='isStyleLoaded')return()=>true; if(k==='getLngLat')return()=>({lat:40,lng:44});
  return ()=>p; }, apply:()=>p, construct:()=>p});
 window.maplibregl={Map:function(){return p;},Marker:function(){return p;},Popup:function(){return p;},NavigationControl:function(){return {};},LngLatBounds:function(){return {extend(){return this;},isEmpty(){return true;}};}};
})();`;
const playwright = () => {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(p);
    } catch (e) {
      /* next */
    }
  }
  return null;
};
const daisyFile = () => [process.env.AHM_DAISYUI_CSS, path.join(__dirname, '..', '..', 'app', 'node_modules', 'daisyui', 'daisyui.css')].filter(Boolean).find((f) => fs.existsSync(f));

/** A fresh server and a page on the Layers tab (wide window: the panel is 400 wide; the layout test narrows it); fn(pg, S, shot). Page errors fail the test. */
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
    const pg = await browser.newPage({ viewport: { width: 1100, height: 860 }, deviceScaleFactor: 1 });
    pg.setDefaultTimeout(8000);
    const errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push('console ' + m.text()));
    await pg.route('**/maplibre-gl*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* stand-in */' }));
    await pg.route((u) => !u.toString().startsWith(S.base) && !/maplibre-gl/.test(u.toString()), (r) => r.abort());
    const dz = daisyFile();
    if (dz) await pg.route('**/daisyui@*/daisyui.css', (r) => r.fulfill({ contentType: 'text/css', path: dz }));
    await pg.addInitScript(STUB);
    // the side panel is 400 wide beside the map on a wide window (the frames are 400x860): screenshot its box
    const shot = async (file) => process.env.AHM_SHOTS && (fs.mkdirSync(process.env.AHM_SHOTS, { recursive: true }), pg.locator('aside').screenshot({ path: path.join(process.env.AHM_SHOTS, file + '.png') }));
    try {
      await pg.goto(S.base + '/');
      await pg.waitForFunction(() => typeof layers !== 'undefined' && layers.length > 0 && document.querySelector('#lyList > li'));
      await pg.click('[data-tab=layers]');
      await fn(pg, S, shot);
      eq([], errs, 'page errors');
    } finally {
      await browser.close();
      await S.stop();
    }
  });
}
const nRows = (pg) => pg.locator('#lyList > li').count();
const places = (pg, n) => pg.evaluate((k) => run(searchOptions()).length === k, n);

scenario('layers ui: list (s085): count, three-state join show / only / hide, greyed hidden layer, category filter, search', async (pg, S, shot) => {
  ok((await nRows(pg)) === 1, 'the sample layer is listed');
  ok(/1 layer/.test(await pg.locator('#lyCount').innerText()), 'count: ' + (await pg.locator('#lyCount').innerText()));
  ok(await pg.locator('#lyListView .alert').isVisible(), 'info card shown');
  ok(await pg.locator('#lyNew').isVisible(), 'Add layer is shown');
  const radios = pg.locator('#lyList > li').first().locator('.ly-three input');
  eq(3, await radios.count());
  ok(await pg.locator('#lyList input[value=show]').first().isChecked(), 'show is the default');
  const total = await pg.evaluate(() => run(searchOptions()).length);
  await pg.check('#lyList input[value=only]');
  ok(await pg.locator('#lyList input[value=only]').isChecked() && !(await pg.locator('#lyList input[value=show]').isChecked()), 'only is checked, show is not (one radio group)');
  ok((await pg.evaluate(() => lyState.only.size)) === 1, 'state: only');
  ok(/only/.test(await pg.locator('#lyActive').innerText()), 'Explore filter chip shown');
  await pg.check('#lyList input[value=hide]');
  ok((await pg.evaluate(() => [lyState.only.size, lyState.hide.size])).join() === '0,1', 'hide replaces only');
  ok(await pg.locator('#lyList > li.ly-hidden').count() === 1, 'a hidden layer is greyed (class ly-hidden)');
  ok((await pg.locator('#lyList > li .ly-open').first().evaluate((e) => Number(getComputedStyle(e).opacity))) < 1, 'greyed look is applied');
  ok(await pg.evaluate((t) => run(searchOptions()).length < t, total), 'places of a hidden layer leave the map list');
  await shot('s085-list-hidden');
  await pg.check('#lyList input[value=show]');
  ok(await pg.locator('#lyList > li.ly-hidden').count() === 0 && (await pg.evaluate(() => run(searchOptions()).length)) === total, 'show clears both');
  // category filter and search
  const cat = await pg.evaluate(() => categories.find((c) => lyById(layers[0].id).category === c.id) || categories[0]);
  await pg.selectOption('#lyCat', cat.id);
  const inCat = await pg.evaluate(() => layers.filter((l) => l.category === document.querySelector('#lyCat').value).length);
  ok((await nRows(pg)) === inCat, 'category filter: ' + inCat);
  await pg.selectOption('#lyCat', '');
  await pg.fill('#lyQ', 'zzzz');
  ok((await nRows(pg)) === 0 && (await pg.locator('#lyState').innerText()).includes('No layers match'), 'search: nothing matches');
  ok(/0 of 1 layers/.test(await pg.locator('#lyCount').innerText()), 'filtered count: ' + (await pg.locator('#lyCount').innerText()));
  await pg.fill('#lyQ', 'urart');
  ok((await nRows(pg)) === 1, 'search finds it');
  await pg.fill('#lyQ', '');
  await shot('s085-list');
});

scenario('layers ui: the card (s086) opens inside its row, shows places, borders, notes, folds again', async (pg, S, shot) => {
  const row = pg.locator('#lyList > li').first();
  ok(!(await row.locator('[data-card]').isVisible()), 'closed at first');
  await row.locator('.ly-open').click();
  ok(await row.locator('[data-card]').isVisible() && (await row.getAttribute('data-open')) === 'true', 'the card opens inside the row');
  ok(await row.locator('.ly-tools button:visible').count() === 4, 'four tools: edit, choose, fit, delete');
  ok(/PLACES|Places/i.test(await row.locator('.ly-sec').first().innerText()), 'PLACES heading');
  ok(await row.locator('[data-places] li').count() > 0, 'place rows');
  ok(await row.locator('[data-places] li img.ly-ti').first().evaluate((i) => i.src.startsWith('data:image/png')), 'place rows show the type symbol');
  ok(await row.locator('[data-act=addnote]').isVisible(), 'Add note');
  await shot('s086-card');
  await row.locator('.ly-open').click();
  ok(!(await row.locator('[data-card]').isVisible()), 'a second click folds it');
  // "+ N more": make a layer with 5 places
  await pg.evaluate(() => {
    const l = layers[0];
    places.slice(0, 5).forEach((p) => !l.members.some((m) => m.place === p.id) && l.members.push({ place: p.id }));
    lySet(layers, layerNotes, categories);
    lyOpen(l.id);
  });
  const more = row.locator('[data-act=more]');
  ok(await more.isVisible() && /\+ \d+ more/.test(await more.innerText()), 'more button: ' + (await more.innerText()));
  eq(3, await row.locator('[data-places] li').count());
  await more.click();
  ok((await row.locator('[data-places] li').count()) > 3, 'all places after the click');
});

scenario('layers ui: choose places and borders (s087): +N / -N chips, find, save sends one request, cancel', async (pg, S, shot) => {
  await pg.locator('#lyList > li .ly-open').first().click();
  await pg.click('#lyList [data-act=places]');
  ok(await pg.locator('#lyPickView').isVisible() && !(await pg.locator('#lyListView').isVisible()), 'the choose view replaces the list');
  ok(await pg.locator('#lyPickView .ly-banner').isVisible(), 'banner');
  ok((await pg.locator('#lyPick li').count()) > 3, 'checkbox list');
  ok((await pg.locator('#lyPick .ly-tag').first().innerText()).length > 0, 'type tag');
  eq('+0', await pg.locator('#lyAddN').innerText());
  const was = await pg.evaluate(() => lyState.staged.size);
  const unchecked = pg.locator('#lyPick li:has(input:not(:checked))');
  await unchecked.nth(0).locator('input').check();
  await unchecked.nth(0).locator('input').check();
  eq('+2', await pg.locator('#lyAddN').innerText());
  const member = await pg.evaluate(() => layers[0].members.find((m) => m.place).place);
  await pg.locator(`#lyPick li[data-pid="${member}"] input`).uncheck();
  eq('−1', await pg.locator('#lyRemN').innerText());
  ok(await pg.locator('#lyDelta').isHidden(), '"no changes yet" is gone once something changed');
  await pg.fill('#lyPickQ', 'zzzzzz');
  ok(await pg.locator('#lyPickNone').isVisible() && /Nothing matches/.test(await pg.locator('#lyPickNone').innerText()), 'Nothing matches.');
  await pg.fill('#lyPickQ', '');
  await shot('s087-choose');
  await pg.click('#lyPickView [data-act=saveplaces]');
  await pg.waitForFunction((n) => !lyState.editing && lyById(layers[0].id).members.length === n, was + 1); // the list is reloaded after the save
  ok((await pg.evaluate(() => lyById(layers[0].id).members.length)) === was + 2 - 1, 'saved: ' + was + ' +2 -1');
  ok(await pg.locator('#lyListView').isVisible(), 'back to the list');
  // cancel
  await pg.click('#lyList [data-act=places]');
  await pg.locator('#lyPick li input').nth(0).click();
  await pg.click('#lyPickView [data-act=cancelplaces]');
  ok(!(await pg.evaluate(() => !!lyState.editing)) && await pg.locator('#lyListView').isVisible(), 'cancel leaves without saving');
  // a save error stays in the view
  await pg.evaluate(() => (AHM_CONFIG.url.layerSave = '/nowhere'));
  await pg.click('#lyList [data-act=places]');
  await pg.locator('#lyPick li input').nth(0).click();
  await pg.click('#lyPickView [data-act=saveplaces]');
  await pg.waitForSelector('#lyErr .alert-error');
  ok(/Save failed/.test(await pg.locator('#lyErr').innerText()), 'save error shown: ' + (await pg.locator('#lyErr').innerText()));
  ok(await pg.locator('#lyPickView').isVisible(), 'still choosing after a failed save');
});

scenario('layers ui: form (s088): add with names, description, category, dates, colour; name is required; edit; cancel', async (pg, S, shot) => {
  await pg.click('#lyNew');
  const f = pg.locator('#lyFormView');
  ok(await f.isVisible() && /Add layer/.test(await f.locator('h3').innerText()), 'form view with its title');
  ok((await f.locator('.ahm-name .ahm-pill').count()) >= 3, 'language pills in the name card');
  ok((await f.locator('.ahm-name [data-period]:visible').count()) === 0, 'no Period row for a layer name');
  ok(await f.locator('[data-act=addname]').isVisible() && await f.locator('[data-act=adddesc]').isVisible(), 'add name / add description');
  ok((await f.locator('.ahm-date').count()) === 2, 'two Foundation date fields');
  ok((await f.locator('.ahm-date [data-modes] input').count()) === 4, 'Unknown / Exact for each date (2 + 2)');
  await shot('s088-form-empty');
  await f.locator('[data-act=save]').click();
  ok(/Give the layer at least one name\./.test(await f.innerText()), 'inline validation: name required');
  ok((await f.locator('[data-value=name]').first().getAttribute('aria-invalid')) === 'true', 'the name field is marked invalid');
  ok((await pg.evaluate(() => layers.length)) === 1, 'nothing saved');
  await f.locator('[data-value=name]').first().fill('Hammurabi campaigns');
  ok(!/Give the layer at least one name/.test(await f.innerText()), 'typing clears the message');
  await f.locator('[data-act=adddesc]').click();
  await f.locator('.ly-descrow textarea').fill('Wars of Babylon.');
  const cat = await pg.evaluate(() => categories[0].id);
  await f.locator('[data-cat]').selectOption(cat);
  await f.locator('.ahm-date').nth(0).locator('[data-modes] input[value=exact]').check();
  await f.locator('.ahm-date').nth(0).locator('[data-f=y]').fill('1792');
  await f.locator('.ahm-date').nth(0).locator('[data-era=BCE]').check();
  await f.locator('.ahm-date').nth(1).locator('[data-modes] input[value=exact]').check();
  await f.locator('.ahm-date').nth(1).locator('[data-f=y]').fill('1750');
  await f.locator('.ahm-date').nth(1).locator('[data-era=BCE]').check();
  await f.locator('[data-swatches] [data-swatch]').nth(2).click();
  ok(await f.locator('[data-use]').isChecked(), 'picking a swatch ticks "use a colour"');
  await shot('s088-form-filled');
  await f.locator('[data-act=save]').click();
  await pg.waitForFunction(() => layers.length === 2);
  const ly = await pg.evaluate(() => layers.find((l) => l.names.some((n) => n.name === 'Hammurabi campaigns')));
  ok(ly && ly.descriptions[0].text === 'Wars of Babylon.' && ly.category === cat && /^#[0-9a-f]{6}$/i.test(ly.color), 'stored: ' + JSON.stringify([ly && ly.descriptions, ly && ly.category, ly && ly.color]));
  ok(ly.date_from && ly.date_to && (await pg.evaluate((l) => dateKey(l.date_from) < dateKey(l.date_to), ly)), 'dates stored as before: ' + JSON.stringify([ly.date_from, ly.date_to]));
  ok(!(await f.isVisible()) && (await pg.locator('#lyList > li[data-open=true]').innerText()).includes('Hammurabi'), 'the new layer is opened in the list');
  // edit it: values come back, a second name can be added, a bad date order is refused
  await pg.click('#lyList > li[data-open=true] [data-act=edit]');
  ok(/Edit layer/.test(await f.locator('h3').innerText()) && (await f.locator('[data-value=name]').first().inputValue()) === 'Hammurabi campaigns', 'edit form is filled');
  ok((await f.locator('.ly-descrow textarea').inputValue()) === 'Wars of Babylon.' && (await f.locator('[data-use]').isChecked()), 'description and colour come back');
  await f.locator('[data-act=addname]').click();
  eq(2, await f.locator('.ahm-name').count());
  await f.locator('.ahm-name').nth(1).locator('[data-value=name]').fill('Ḫammurapi');
  await f.locator('.ahm-date').nth(1).locator('[data-f=y]').fill('1900');
  await f.locator('[data-act=save]').click();
  await pg.waitForTimeout(300);
  ok((await f.isVisible()) && (await f.innerText()).length > 0 && (await pg.evaluate(() => lyById(lyState.open).names.length)) === 1, 'an end before the start is refused: ' + (await f.locator('[data-err]').innerText()));
  await f.locator('[data-act=cancel]').click();
  ok(!(await f.isVisible()) && (await pg.locator('#lyListView').isVisible()), 'cancel returns to the list');
});

scenario('layers ui: delete asks in the Foundation modal; Cancel keeps the layer', async (pg) => {
  await pg.locator('#lyList > li .ly-open').first().click();
  await pg.click('#lyList [data-act=delete]');
  ok(await pg.locator('#ahm-confirm').isVisible(), 'modal shown');
  ok(/Delete the layer/.test(await pg.locator('#ahm-confirm h3').innerText()) && /Its places and their notes stay on the map/.test(await pg.locator('#ahm-confirm').innerText()), 'text of frame s069');
  await pg.click('#ahm-confirm button[value=cancel] >> nth=0');
  ok((await pg.evaluate(() => layers.length)) === 1, 'Cancel keeps it');
  await pg.click('#lyList [data-act=delete]');
  await pg.click('#ahm-confirm [data-ok]');
  await pg.waitForFunction(() => layers.length === 0);
  ok((await nRows(pg)) === 0 && (await pg.locator('#lyState').innerText()).includes('No layers yet'), 'empty state after the last layer is gone');
  ok(await pg.evaluate(() => places.length > 0), 'places stay');
});

scenario('layers ui: states: empty, loading, load error with Retry, read-only visitor', async (pg, S, shot) => {
  await pg.evaluate(() => lySet([], [], categories));
  ok((await pg.locator('#lyState').innerText()).includes('No layers yet') && (await nRows(pg)) === 0, 'empty list');
  await pg.evaluate(() => lyShowState(document.querySelector('#lyState'), 'loading', 'Loading layers…'));
  ok(await pg.locator('#lyState .skeleton').count() === 3, 'loading skeleton');
  await pg.evaluate(() => lyFail('Could not load the layers.', () => {}));
  ok(await pg.locator('#lyState .alert-error').isVisible() && await pg.locator('#lyState [data-retry]').isVisible(), 'load error with a Retry button');
  // (clicking Retry is not tested: the old components.js reloads the page on any [data-retry] click, see the report)
  await shot('states-error');
  // visitor
  await pg.reload();
  await pg.waitForFunction(() => layers.length > 0);
  await pg.evaluate(() => ((AHM_CONFIG.canEdit = false), (AHM_CONFIG.canLayerAdmin = false), lyOpen(layers[0].id)));
  await pg.click('[data-tab=layers]');
  const row = pg.locator('#lyList > li').first();
  ok(await row.locator('[data-card]').isVisible(), 'a visitor can open the card');
  ok(!(await row.locator('.ly-tools').isVisible()) && !(await row.locator('[data-act=addnote]').isVisible()), 'no edit tools and no Add note');
  ok(/Log in to change layers\./.test(await row.locator('[data-readonly]').innerText()), 'the visitor line');
  ok(await row.locator('.ly-three input').first().isEnabled(), 'show / only / hide still work');
  await shot('s086-card-visitor');
});

scenario('layers ui: names and descriptions are text, never markup', async (pg) => {
  await pg.evaluate(() => {
    layers[0].names = [{ lang: 'en', name: '<img src=x onerror="window.__xss=1">' }];
    layers[0].descriptions = [{ lang: 'en', text: '<script>window.__xss=2</script>' }];
    lySet(layers, layerNotes, categories);
    lyOpen(layers[0].id);
  });
  const html = await pg.locator('#lyList').innerHTML();
  ok(html.includes('&lt;img') && html.includes('&lt;script&gt;'), 'escaped in the page');
  ok(!(await pg.locator('#lyList img[src=x]').count()) && (await pg.evaluate(() => window.__xss)) === undefined, 'nothing was executed');
});

scenario('layers ui: 400x860 layout: nothing overflows sideways, Add layer stays at the bottom, form bar is reachable', async (pg) => {
  await pg.setViewportSize({ width: 400, height: 860 });
  await pg.waitForTimeout(200);
  const over = () => pg.evaluate(() => document.querySelector('#tab-layers').scrollWidth - document.querySelector('#tab-layers').clientWidth);
  ok((await over()) <= 1, 'list: no horizontal overflow (' + (await over()) + ')');
  const r = await pg.locator('#ly-add').boundingBox();
  ok(r && r.y + r.height <= 860 + 1, 'Add layer is inside the viewport');
  await pg.locator('#lyList > li .ly-open').first().click();
  ok((await over()) <= 1, 'card: no horizontal overflow');
  await pg.click('#lyList [data-act=places]');
  ok((await over()) <= 1, 'choose view: no horizontal overflow');
  await pg.click('#lyPickView [data-act=cancelplaces]');
  ok(!(await pg.locator('#lyNew').isVisible()), 'Add layer is hidden while a card is open');
  await pg.locator('#lyList > li .ly-open').first().click();
  await pg.click('#lyNew');
  ok((await over()) <= 1, 'form: no horizontal overflow');
  await pg.locator('#lyFormView [data-act=save]').scrollIntoViewIfNeeded();
  const b = await pg.locator('#lyFormView [data-act=save]').boundingBox();
  ok(b && b.y + b.height <= 860 + 1 && b.y >= 0, 'the Save bar can be reached');
});
