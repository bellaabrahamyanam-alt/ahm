// Behaviour in a real browser (headless Chromium via Playwright) against the dev server on a throw-away copy of the data.
// The map library (MapLibre) is replaced by a stand-in, so map DRAWING is not exercised; everything else in the page is real.
// Skipped with --no-browser, or when Playwright / Chromium is not available.
const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');
const fs = require('fs');
const path = require('path');

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

/** runs fn(page, server) on a fresh server and page; collects page errors and fails if there are any */
const daisyFile = () =>
  [process.env.AHM_DAISYUI_CSS, path.join(__dirname, '..', '..', 'app', 'node_modules', 'daisyui', 'daisyui.css')].filter(Boolean).find((f) => require('fs').existsSync(f));
async function scenario(name, seed, fn) {
  test(name, async () => {
    const pw = playwright();
    if (process.env.AHM_NO_BROWSER || !pw) return console.log('    (browser tests skipped)');
    const S = await start();
    if (seed) seed(S);
    let browser;
    try {
      browser = await pw.chromium.launch();
    } catch (e) {
      await S.stop();
      return console.log('    (Chromium not available: skipped)');
    }
    const pg = await browser.newPage();
    pg.setDefaultTimeout(8000);
    const errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    pg.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console ' + m.text());
    });
    pg.on('dialog', (d) => d.accept());
    await pg.route('**/maplibre-gl*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* stand-in */' }));
    await pg.route((u) => !u.toString().startsWith(S.base) && !/maplibre-gl/.test(u.toString()), (r) => r.abort());
    const dz = daisyFile(); // daisyUI from node_modules when it exists (the CDN is blocked in the sandbox): the layout tests need its classes
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

// the old format: a date saved as whole seconds by the first version of the date model
const seedOldDate = (S) => {
  const f = path.join(S.root, 'data', 'places.geojson');
  const fc = JSON.parse(fs.readFileSync(f, 'utf8'));
  fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [44, 40] }, properties: { id: '99999999-9999-4999-8999-999999999999', label: 'Intville', type: 'town', date_from: { fmt: 'y', ts: 0, mode: 'exact', ts_to: null }, date_to: null, height_m: null, names: [{ lang: 'en', name: 'Intville' }] } });
  fs.writeFileSync(f, JSON.stringify(fc));
};

scenario('browser: languages, optional dates in many formats, mountain height, notes, ISO storage', seedOldDate, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
    ok(!(await pg.content()).includes('colours.css'), 'index.html does not mention colours.css');
    ok(await pg.evaluate(()=>languages.length)===6, 'language dictionary loaded (6)');
    await pg.click('[data-tab=more]'); await pg.click('#more-lang > summary'); // Languages is a fold in More
    ok((await pg.locator('#langList li').count())===6, 'Languages tab lists 6');
    ok(await pg.locator('#lgNew').count()===1 && await pg.locator('#lgAdd').count()===0, 'admin sees the + Add language button, no form yet (dev has no login)');
    await pg.click('#lgNew'); ok(await pg.locator('#lgAdd').count()===1, '+ Add language opens the form');
    // add language
    await pg.fill('#lgCode','xcl'); await pg.fill('#lgName','Classical Armenian'); await pg.fill('#lgNative','Գրաբար'); await pg.click('#lgAdd'); await pg.waitForTimeout(500);
    ok((await pg.locator('#langList li').count())===7, 'language added -> 7');
    await pg.click('#lgNew'); await pg.fill('#lgCode','xcl'); await pg.fill('#lgName','dup'); await pg.click('#lgAdd'); await pg.waitForTimeout(400);
    ok(/already/.test(await pg.locator('#lgErr').innerText()), 'duplicate language refused: '+await pg.locator('#lgErr').innerText());
    // new place dialog
    await pg.evaluate(()=>openDlg('place',{lon:44.5,lat:40.1,name:'Testville'}));
    const opts=await pg.locator('#dPlaceForm .nl option').allInnerTexts();
    ok(opts.length===7 && !(await pg.locator('#dPlaceForm input.nl').count()), 'name language is a select with 7 dictionary entries: '+opts.join(', '));
    // dates optional: save with unknown dates
    await pg.selectOption('#dPlaceForm .pf-type','village');
    ok(await pg.locator('#dPlaceForm .pf-from .df-mode').inputValue()==='none', 'date defaults to Unknown');
    await pg.click('#dSave'); await pg.waitForTimeout(800);
    ok(await pg.evaluate(()=>places.some(p=>p.names.some(n=>n.name==='Testville') && p.date_from===null && p.date_to===null)), 'place saved with no dates');
    // place with date in DD.MM.YYYY format, exact, and an end as a range of centuries
    await pg.evaluate(()=>openDlg('place',{lon:44.6,lat:40.2,name:'Datetown'}));
    await pg.selectOption('#dPlaceForm .pf-type','town');
    await pg.selectOption('#dPlaceForm .pf-from .df-mode','exact'); await pg.selectOption('#dPlaceForm .pf-from .df-fmt','dmy');
    await pg.fill('#dPlaceForm .pf-from .df-d','21'); await pg.fill('#dPlaceForm .pf-from .df-m','3'); await pg.fill('#dPlaceForm .pf-from .df-y','1500');
    await pg.selectOption('#dPlaceForm .pf-to .df-mode','range'); await pg.selectOption('#dPlaceForm .pf-to .df-fmt','c');
    const g=pg.locator('#dPlaceForm .pf-to .df-g'); await g.nth(0).locator('.df-n').fill('16'); await g.nth(1).locator('.df-n').fill('17');
    await pg.click('#dSave'); await pg.waitForTimeout(800);
    const dt=await pg.evaluate(()=>{const p=places.find(p=>p.names.some(n=>n.name==='Datetown')); return p&&[p.date_from,p.date_to,spanText(p.date_from,p.date_to)];});
    ok(dt && dt[0].fmt==='dmy' && dt[0].ts==='1500-03-21T00:00:00Z', 'dmy date stored as ISO 8601: '+JSON.stringify(dt));
    ok(dt && dt[1].ts==='1500-01-01T00:00:00Z' && dt[1].ts_to==='1601-01-01T00:00:00Z' || dt[1].ts_to==='1601-01-01T00:00:00Z', 'range ends are ISO text');
    ok(dt && dt[1].mode==='range' && dt[1].fmt==='c', 'century range stored');
    // bad date: 31 Feb
    await pg.evaluate(()=>openDlg('place',{lon:44.7,lat:40.3,name:'Badday'}));
    await pg.selectOption('#dPlaceForm .pf-from .df-mode','exact'); await pg.selectOption('#dPlaceForm .pf-from .df-fmt','ymd');
    await pg.fill('#dPlaceForm .pf-from .df-y','2023'); await pg.fill('#dPlaceForm .pf-from .df-m','2'); await pg.fill('#dPlaceForm .pf-from .df-d','30');
    await pg.click('#dSave'); await pg.waitForTimeout(300);
    ok(/no day 30/.test(await pg.locator('#dErr').innerText()), 'invalid day refused: '+await pg.locator('#dErr').innerText());
    // mountain: dates hidden, height shown
    await pg.selectOption('#dPlaceForm .pf-type','mountain');
    ok(await pg.locator('#dPlaceForm .pf-when').isHidden() && await pg.locator('#dPlaceForm .pf-height').isVisible(), 'mountain: dates hidden, height shown');
    await pg.fill('#dPlaceForm .pf-h','5137'); await pg.click('#dSave'); await pg.waitForTimeout(800);
    ok(await pg.evaluate(()=>places.some(p=>p.names.some(n=>n.name==='Badday')&&p.type==='mountain'&&p.height_m===5137&&p.date_from===null)), 'mountain saved with height 5137, no dates');
    // mountain without height
    await pg.evaluate(()=>openDlg('place',{lon:44.8,lat:40.4,name:'Nohigh'})); await pg.selectOption('#dPlaceForm .pf-type','mountain'); await pg.click('#dSave'); await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>places.some(p=>p.names.some(n=>n.name==='Nohigh')&&p.height_m===null)), 'mountain saved without height');
    // note with language select + approx date
    const pid=await pg.evaluate(()=>places.find(p=>p.names.some(n=>n.name==='Datetown')).id);
    await pg.evaluate(id=>openDlg('note',places.find(p=>p.id===id)),pid);
    ok((await pg.locator('#nLang option').count())===7 && await pg.locator('#nLang').evaluate(e=>e.tagName)==='SELECT', 'note language is a select');
    await pg.selectOption('#nDate .df-mode','approx'); await pg.selectOption('#nDate .df-fmt','m'); await pg.fill('#nDate .df-n','2'); await pg.selectOption('#nDate .df-era','BCE');
    await pg.fill('#nTitle','Millennium note'); await pg.fill('#nText','body'); await pg.click('#dSave'); await pg.waitForTimeout(800);
    ok(await pg.evaluate(()=>notes.some(n=>n.title==='Millennium note'&&n.date&&n.date.fmt==='m'&&n.date.mode==='approx')), 'note with approx millennium saved');
    // server rejects unknown language even if the UI is bypassed
    const r=await pg.evaluate(async()=>{const x=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({place:{lat:40,lon:44,type:'village',names:[{lang:'zz',name:'Q'}]}})}); return [x.status,(await x.json()).error];});
    ok(r[0]===400 && /not in the list/.test(r[1]), 'server refuses unknown language: '+r.join(' '));
    // every stored time stamp is ISO text; the seeded old integer date was upgraded
    const allIso=await pg.evaluate(()=>places.every(p=>[p.date_from,p.date_to].every(d=>!d||(typeof d.ts==='string'&&(d.ts_to===null||typeof d.ts_to==='string')))));
    ok(allIso,'all place dates in the browser use ISO time stamps');
    const iv=await pg.evaluate(()=>{const p=places.find(p=>p.names.some(n=>n.name==='Intville')); return p&&p.date_from;});
    ok(iv && iv.ts==='1970-01-01T00:00:00Z', 'old integer ts upgraded: '+JSON.stringify(iv));
    const raw=await (await pg.request.get('' + S.base + '/data/places.geojson')).text();
    ok(!/"ts": *-?\d+[,\s}]/.test(raw) && /"ts": *"[^"]+T00:00:00Z"/.test(raw), 'places.geojson on disk has ISO time stamps only');
    
});

scenario('browser: the Rivers tab lists only rivers, has its own add panel and finds rivers by name without saving them', null, async (pg, S) => {
  const dense = (x0, x1) => { const o = []; for (let x = x0; x <= x1 + 1e-9; x += 0.01) o.push([+x.toFixed(3), +(40 + (x - 44) * 0.2).toFixed(4)]); return o; }; // a river with a point every kilometre or so
  await pg.route('**/nominatim.openstreetmap.org/**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify([
      { display_name: 'Araks, Armenia', osm_type: 'relation', osm_id: 1, type: 'river', addresstype: 'river', geojson: { type: 'MultiLineString', coordinates: [dense(44.0, 44.5), dense(44.5, 45.0)] } },
      { display_name: 'Araks, Turkey', osm_type: 'relation', osm_id: 2, type: 'river', addresstype: 'river', geojson: { type: 'LineString', coordinates: [[42.0, 39.9], [43.0, 40.0]] } },
    ]) }));
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
  const saved = await pg.evaluate(async () => {
    const x = await fetch('/api/shape/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: [{ lang: 'en', name: 'Test river' }], type: 'waterway', color: '#1e88e5', opacity: 1, label: true, source: '', date_from: null, date_to: null, width: 4, geometry: { type: 'LineString', coordinates: [[44.1, 40.0], [44.4, 40.1]] } }) });
    await shReload();
    return x.status;
  });
  ok(saved === 200, 'a river is saved through the shape endpoint');
  await pg.evaluate(() => tab('rivers'));
  ok(await pg.locator('#tab-shapes').isVisible() && (await pg.locator('.tabs .tab-active').innerText()) === 'Rivers', 'the Rivers tab shows the shapes panel and is the selected tab');
  ok(/1 of 1 rivers/.test(await pg.locator('#shCount').innerText()) && (await pg.locator('#shList li[data-sid]').count()) === 1, 'the Rivers list has the river');
  ok(/Find rivers/.test(await pg.locator('#shAdd').innerText()) && !/Add a border/.test(await pg.locator('#shAdd').innerText()), 'the Rivers tab has the river search, not the border add panel');
  await pg.fill('#shRvQ', 'Araks'); await pg.click('[data-shadd="rvfind"]'); await pg.waitForTimeout(500);
  ok((await pg.locator('#shRvRes li[data-i]').count()) === 2, 'a search finds several rivers');
  ok((await pg.locator('#shRvRes button').count()) === 0, 'found rivers have no Add button');
  ok((await pg.locator('#shList li[data-sid]').count()) === 1, 'finding rivers saves nothing');
  const leg = await pg.evaluate(async () => {
    sh.draw = { kind: 'line', mode: 'new' }; // the drawing tool asks shRiverLeg for the points between two clicks
    sh.river.on = true; sh.river.clicks = [];
    const far = await shRiverLeg([10, 10], [10.1, 10]), farClicks = sh.river.clicks.length;
    const near = await shRiverLeg([44.1, 40.02], [44.4, 40.08]), nearClicks = sh.river.clicks.length;
    sh.draw = null;
    return { far, farClicks, near: near && near.length, nearClicks, first: near && near[0] };
  });
  ok(leg.far === null && leg.farClicks === 0, 'a click that gets no river section is kept in the line (not recorded to be dropped)');
  ok(leg.near > 25 && leg.nearClicks === 2 && leg.first[0] === 44.1, 'two clicks on the river give its points between them, and only then the clicks are recorded');
  await pg.evaluate(() => tab('shapes'));
  ok(!/Test river/.test(await pg.locator('#shList').innerText()) && /\+ Add border/.test(await pg.locator('#shAdd').innerText()), 'the Borders tab does not list the river and has its own add button');
  await pg.evaluate(() => tab('rivers'));
  await pg.click('#shList li[data-sid] b');
  ok(/Test river/.test(await pg.locator('#shDetail').innerText()) && (await pg.locator('#shWidth').count()) === 1, 'the river card opens with a Width slider');
});

scenario('browser: tabs, sheets, filters, layers (only / hide / search / create / choose places / notes / delete), categories', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
    ok(await pg.locator('.tabs [data-tab]').count()===6 && await pg.locator('#more-maps #basemap').count()===1, 'six tabs (Explore, Borders, Routes, Rivers, Layers, More); Maps is a fold in More');
    await pg.evaluate(()=>tab('route')); ok(await pg.locator('#more-route').evaluate(e=>e.open) && !(await pg.locator('#more-maps').evaluate(e=>e.open)) && await pg.locator('#tab-more').isVisible(), 'tab(route) opens the Directions fold in More');
    await pg.evaluate(()=>tab('explore'));
    // selected types are shown inside Filters only: no chips under the Filters block
    await pg.evaluate(()=>{state.types.add('settlement');fillTypes();update();});
    ok(await pg.locator('#fActive .chip').count()===0, 'no chip for a selected type');
    ok(/1/.test(await pg.locator('#fcount').innerText()), 'the filter count shows the selected type');
    await pg.evaluate(()=>{state.types.clear();fillTypes();update();});
    // a place opens in the details dock under the list; its row stays in the list and is marked; the map does not move; no Back button
    const rows=await pg.locator('#list li[data-id]').count();
    await pg.click('#list li[data-id] >> nth=1'); await pg.waitForTimeout(300);
    ok(await pg.locator('#dock #detail').count()===1 && await pg.locator('#detail').isVisible() && await pg.locator('#detail .dock-btns').isVisible(), 'place opens in the details dock with its buttons');
    ok(await pg.locator('#list li[data-id]').count()===rows, 'the other places stay in the list');
    ok(await pg.locator('#list li.on').count()===1, 'the open place is marked in its row');
    ok(await pg.locator('[data-act=back]').count()===0, 'no Back button');
    await pg.click('#list li.on'); ok(await pg.locator('#detail').isHidden(), 'a second click folds the details');
    await pg.click('#list li[data-id] >> nth=0'); await pg.fill('#q','tu'); ok(await pg.locator('#detail').isHidden(), 'typing in search closes the details');
    ok(await pg.locator('.clear[data-clearfor=q]').isVisible(), 'the search field shows its clear button');
    await pg.click('.clear[data-clearfor=q]'); ok(await pg.inputValue('#q')==='', 'the clear button empties the search');
    
    await pg.click('[data-tab=layers]'); 
    ok(await pg.locator('#lyList li[data-lid]').count()===1, 'sample layer listed');
    ok(await pg.locator('#more-cat').count()===1 && await pg.locator('#tab-layers #catList').count()===0, 'categories are in the More tab, not in Layers');
    // filters
    const total=await pg.evaluate(()=>run(searchOptions()).length);
    await pg.click('#lyList [data-lyact=only]');
    ok(await pg.evaluate(()=>run(searchOptions()).length)===3, 'Only: 3 places (of '+total+')');
    ok(/only/.test(await pg.locator('#lyActive').innerText()), 'active filter chip shown');
    await pg.click('#lyList [data-lyact=hide]');
    ok(await pg.evaluate(()=>run(searchOptions()).length)===total-3, 'Hide: NOT IN -> '+(total-3));
    await pg.click('[data-tab=explore]'); await pg.click('#lyActive [data-lyact=unfilter]'); await pg.click('[data-tab=layers]');
    ok(await pg.evaluate(()=>run(searchOptions()).length)===total, 'chip removes the filter');
    // search layers
    await pg.fill('#lyQ','zzzz'); ok(await pg.locator('#lyList li[data-lid]').count()===0,'layer search: no match');
    await pg.fill('#lyQ','urart'); ok(await pg.locator('#lyList li[data-lid]').count()===1,'layer search: match');
    await pg.fill('#lyQ','');
    // categories (More tab): table rows, "Add" opens the fields, the pencil opens them under the row
    await pg.click('[data-tab=more]'); await pg.click('#more-cat > summary');
    ok(await pg.locator('#catList li.tr').count()===5, '5 categories listed');
    ok(await pg.locator('#catAdd').count()===1 && await pg.locator('#catSave').count()===0, 'admin sees one Add button, no form yet');
    await pg.click('#catAdd'); ok(await pg.locator('#catSave').count()===1 && await pg.locator('#catCancel').count()===1, 'Add opens the fields with Save and Cancel');
    await pg.click('#catCancel'); ok(await pg.locator('#catAdd').count()===1, 'Cancel closes the fields');
    await pg.click('#catAdd'); await pg.fill('#catForm .nn','Pilgrimage'); await pg.click('#catSave'); await pg.waitForTimeout(500);
    ok(await pg.locator('#catList li.tr').count()===6, 'category added');
    await pg.click('#catList li.tr:has-text("Pilgrimage") [data-lyact=editcat]'); ok(await pg.locator('#catAdmin #catForm').count()===1 && await pg.locator('#catList li.tr.on:has-text("Pilgrimage")').count()===1, 'the pencil opens the fields under the list and marks the row');
    await pg.fill('#catForm .nn','Pilgrimages'); await pg.click('#catSave'); await pg.waitForTimeout(500);
    ok(await pg.locator('#catList li.tr:has-text("Pilgrimages")').count()===1, 'category renamed');
    // new layer (its own Add layer fold in the Layers tab)
    await pg.click('[data-tab=layers]'); await pg.evaluate(()=>{document.querySelector('#ly-add').open=true;}); await pg.click('#lyNew'); await pg.fill('#lyForm .nn','Hammurabi campaigns');
    await pg.click('.ly-dadd'); await pg.fill('.ly-desc .dt','Wars of Babylon.');
    await pg.selectOption('#lyFCat',{label:'Military campaign'});
    await pg.check('#lyUseColor'); await pg.click('#lySave'); await pg.waitForTimeout(700);
    
    ok(await pg.evaluate(()=>layers.length)===2 && await pg.locator('#lyList li.on').innerText().then(t=>/Hammurabi/.test(t)), 'layer created and opened');
    // choose places
    await pg.click('[data-lyact=editplaces]');
    ok(await pg.locator('#lyPick li').count()>3, 'pick list shown');
    await pg.locator('#lyPick li').nth(0).locator('input').check(); await pg.locator('#lyPick li').nth(1).locator('input').check();
    ok(/\+2/.test(await pg.locator('#lyDelta').innerText()), 'delta +2');
    await pg.click('[data-lyact=saveplaces]'); await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>lyById(lyState.open).members.length)===2, 'two members saved');
    // layer note
    await pg.click('[data-lyact=addnote]'); await pg.fill('#nTitle','Campaign of year 30'); await pg.fill('#nText','He took the city.');
    await pg.click('#dSave'); await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>layerNotes.length)===1 && /Campaign of year 30/.test(await pg.locator('#lyDetail').innerText()), 'layer note saved and shown');
    // new place while a layer is open joins it, note tagged
    await pg.evaluate(()=>openDlg('place',{lon:44.9,lat:40.4,name:'Newtown'}));
    ok(await pg.locator('#dLayersPlace input:checked').count()===1, 'open layer preselected in the new place dialog');
    await pg.fill('#nTitle','Newtown note'); await pg.fill('#nText','Tagged text.');
    await pg.click('#dSave'); await pg.waitForTimeout(900);
    ok(await pg.evaluate(()=>{const p=places.find(p=>p.names.some(n=>n.name==='Newtown')); return lyMembers[lyState.open].has(p.id) && notes.find(n=>n.place===p.id).layers.includes(lyState.open);}), 'new place joined the layer; note tagged');
    // place details show layers; leave
    ok(await pg.locator('#detail .ly-chip').count()===1, 'place details list the layer');
    await pg.click('#detail [data-lyact=leave]'); await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>places.some(p=>p.names.some(n=>n.name==='Newtown')))&&await pg.locator('#detail .ly-chip').count()===0, 'removed from the layer, place still exists');
    // edit mode: filters bypassed
    await pg.evaluate(()=>closeDetail()); await pg.click('[data-tab=layers]'); 
    await pg.click('[data-lyact=only] >> nth=0').catch(()=>{});
    // delete layer
    await pg.evaluate(()=>lyOpen(layers[1].id)); await pg.click('[data-lyact=delete]'); await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>layers.length)===1 && await pg.evaluate(()=>places.some(p=>p.names.some(n=>n.name==='Newtown'))), 'layer deleted, places kept');
    await pg.evaluate(()=>{lyState.only.clear();lyState.hide.clear();});
    
});

scenario('browser: a new version of a border in one go: the outline opens for editing, Next asks the dates, Save makes a second version of the same series and leaves the first as it was', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
  const old = await pg.evaluate(async () => { // the drawing tool needs the real map: a stand-in that hands back a moved outline
    AHM.map.drawShape = ({ coords }) => ({ remove() {}, points: () => [], getGeometry: () => { const r = coords.map((c) => [c[0] + 0.5, c[1] + 0.25]); return { type: 'Polygon', coordinates: [[...r, r[0]]] }; } });
    AHM.map.showPreview = () => {};
    await shReload();
    tab('shapes');
    const s = shapes.find((x) => x.type === 'kingdom');
    shOpen(s.id);
    return { id: s.id, geometry: JSON.stringify(s.geometry), n: shapes.length };
  });
  ok((await pg.locator('[data-shact=addversion]').innerText()).startsWith('New version'), 'the sheet has one button for a new version');
  await pg.click('[data-shact=addversion]');
  ok(await pg.evaluate(() => sh.draw && sh.draw.mode === 'version' && sh.draw.version.prevId !== undefined), 'the button opens the outline for editing (version mode), no form yet');
  ok(/New version: move the points/.test(await pg.locator('#shAdd').innerText()) && /Next: dates/.test(await pg.locator('#shFinish').innerText()), 'the banner says what to do and the button is Next');
  eq(old.n, await pg.evaluate(() => shapes.length), 'nothing is saved yet');
  await pg.click('#shFinish');
  ok(/New version of/.test(await pg.locator('#shDetail .dock-title').innerText()), 'Next opens the details form titled as a new version');
  ok(/stays as it is/.test(await pg.locator('#shDetail').innerText()), 'the form says the first version stays');
  await pg.click('.pf-add');
  await pg.locator('#shForm .nn').last().fill('Later outline');
  await pg.click('[data-shact=save]'); await pg.waitForTimeout(800);
  const after = await pg.evaluate(() => shapes.map((s) => ({ id: s.id, series: s.series || null, geometry: JSON.stringify(s.geometry), names: s.names.map((n) => n.name) })));
  eq(old.n + 1, after.length, 'one shape was added');
  const first = after.find((s) => s.id === old.id), added = after.find((s) => s.id !== old.id && s.series === first.series);
  ok(first.series && added, 'both are versions of one series (the first joined it)');
  eq(old.geometry, first.geometry, 'the first version keeps its outline');
  ok(added.geometry !== first.geometry, 'the new version has the moved outline');
  ok(added.names.includes('Later outline'), 'the new name was saved');
  ok(/Versions in time \(2\)/i.test(await pg.locator('#shDetail').innerText()) && (await pg.locator('#shDetail .chips .chip.on').count()) >= 1, 'the sheet of the new version lists both versions and marks the open one');
  // Cancel in the drawing step brings the first version back
  await pg.evaluate((id) => shOpen(id), old.id);
  await pg.click('[data-shact=addversion]');
  await pg.evaluate(() => shCancelDraw());
  ok(await pg.evaluate((id) => !sh.draw && sh.open === id, old.id), 'cancelling returns to the version we started from');
  eq(old.n + 1, await pg.evaluate(() => shapes.length), 'cancelling saves nothing');
});

scenario('browser: the server names the unknown type in its error', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(800);
  const r = await pg.evaluate(async () => {
    const x = await fetch('/api/shape/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: [{ lang: 'en', name: 'X' }], type: 'nonsense', color: '#336699', opacity: 0.5, label: true, source: '', date_from: null, date_to: null, geometry: { type: 'Polygon', coordinates: [[[44, 40], [44.5, 40], [44.5, 40.5], [44, 40]]] } }) });
    return { status: x.status, error: (await x.json()).error };
  });
  ok(r.status === 400 && /unknown border type “nonsense”/.test(r.error), 'the error names the type: ' + r.error);
});

scenario('browser: a new version of a route in one go: the path opens for editing, Next asks the dates, Save adds a second version of the series, the first is unchanged and ends the day before', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
  const old = await pg.evaluate(async () => {
    const line = [[44.0, 40.0], [44.5, 40.2], [45.0, 40.1]];
    const x = await fetch('/api/shape/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: [{ lang: 'en', name: 'Test road' }], type: 'trade', color: '#aa5500', opacity: 0.8, label: true, source: '', twoway: true, stops: [], date_from: null, date_to: null, geometry: { type: 'LineString', coordinates: line } }) });
    if (x.status !== 200) return { status: x.status, error: (await x.json()).error };
    await shReload();
    // the drawing tool needs the real map: a stand-in that hands back a moved path
    AHM.map.drawShape = ({ coords, ids }) => { let pts = coords.map((c) => [c[0] + 0.5, c[1] + 0.25]); return { remove() {}, undo() {}, count: () => pts.length, points: () => pts, ids: () => ids, flags: () => [], ready: async () => {} }; };
    const s = shapes.find((r) => r.names.some((n) => n.name === 'Test road'));
    rtOpen(s.id);
    return { id: s.id, geometry: JSON.stringify(s.geometry), n: shapes.length };
  });
  ok(old.id, 'the route was saved: ' + JSON.stringify(old));
  ok((await pg.locator('[data-rtact=addversion]').innerText()).startsWith('New version'), 'the route card has the button');
  await pg.click('[data-rtact=addversion]');
  ok(await pg.evaluate(() => rts.draw && rts.draw.mode === 'version'), 'the button opens the path for editing (version mode), no form yet');
  ok(/Next: dates/.test(await pg.locator('#rtFinish').innerText()) && /New version: move the points/.test(await pg.locator('#rtAdd').innerText()), 'banner and button say what to do');
  eq(old.n, await pg.evaluate(() => shapes.length), 'nothing is saved yet');
  await pg.click('#rtFinish');
  ok(/New version of/.test(await pg.locator('#rtDetail .dock-title').innerText()) && /stays as it is/.test(await pg.locator('#rtDetail').innerText()), 'Next opens the form titled as a new version');
  eq('Test road', await pg.locator('#rtForm .nn').first().inputValue(), 'the name is taken over');
  // the dates: began in the year 1200
  await pg.selectOption('#rtForm .pf-from .df-mode', 'exact'); await pg.selectOption('#rtForm .pf-from .df-fmt', 'y'); await pg.fill('#rtForm .pf-from .df-y', '1200');
  await pg.click('[data-rtact=save]'); await pg.waitForTimeout(900);
  const after = await pg.evaluate(() => shapes.map((s) => ({ id: s.id, series: s.series || null, geometry: JSON.stringify(s.geometry), color: s.color, to: s.date_to })));
  eq(old.n + 1, after.length, 'one route was added');
  const first = after.find((s) => s.id === old.id), added = after.find((s) => s.id !== old.id && s.series === first.series);
  ok(first.series && added, 'both are versions of one series');
  eq(old.geometry, first.geometry, 'the first version keeps its path');
  ok(added.geometry !== first.geometry, 'the new version has the moved path');
  eq('#aa5500', added.color, 'the look is taken over');
  ok(first.to !== null, 'the first version now ends before the new one: ' + JSON.stringify(first.to));
  ok(/Versions in time \(2\)/i.test(await pg.locator('#rtDetail').innerText()), 'the route card lists both versions');
  // Cancel in the drawing step returns to the route
  await pg.evaluate((id) => rtOpen(id), old.id);
  await pg.click('[data-rtact=addversion]');
  await pg.click('[data-rtadd=canceldraw]');
  ok(await pg.evaluate((id) => !rts.draw && rts.open === id, old.id), 'cancelling returns to the route we started from');
  eq(old.n + 1, await pg.evaluate(() => shapes.length), 'cancelling saves nothing');
});

scenario('browser: names over time (T-043): a name with a period saves in the place form, a wrong order is refused, nameAt picks the name of the moment', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => openDlg('place', { lon: 44.5, lat: 40.1, name: 'Newname' }));
  ok(await pg.locator('#dPlaceForm .pf-name .pf-period').count() === 1, 'every name row has a "Period of this name" part');
  await pg.click('#dPlaceForm .pf-add');
  ok(await pg.locator('#dPlaceForm .pf-name .pf-period').count() === 2, 'a row added with "+ Add another name" has it too');
  await pg.locator('#dPlaceForm .pf-name').nth(1).locator('.nn').fill('Oldname');
  const row = pg.locator('#dPlaceForm .pf-name').nth(1);
  await row.locator('.pf-period summary').click();
  await row.locator('.pf-nfrom .df-mode').selectOption('exact'); await row.locator('.pf-nfrom .df-y').fill('1300');
  await row.locator('.pf-nto .df-mode').selectOption('exact'); await row.locator('.pf-nto .df-y').fill('1200');
  await pg.selectOption('#dPlaceForm .pf-type', 'village');
  await pg.click('#dSave'); await pg.waitForTimeout(400);
  ok(/before|earlier|order|after/i.test(await pg.locator('#dErr').innerText()), 'a period that ends before it begins is refused: ' + await pg.locator('#dErr').innerText());
  await row.locator('.pf-nto .df-y').fill('1500');
  await pg.click('#dSave'); await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const p = places.find((x) => x.names.some((n) => n.name === 'Newname'));
    const sec = (y) => Date.parse(`${String(y).padStart(4, '0')}-06-01T00:00:00Z`) / 1000;
    return { names: p.names.map((n) => [n.name, !!n.date_from, !!n.date_to]), at1400: nameAt(p, 'en', sec(1400)), at1600: nameAt(p, 'en', sec(1600)), off: nameAt(p, 'en', null) };
  });
  eq(JSON.stringify([['Newname', false, false], ['Oldname', true, true]]), JSON.stringify(r.names), 'the period was saved on the second name only');
  eq('Oldname', r.at1400, 'inside its period the old name is the name');
  eq('Newname', r.at1600, 'outside every period the first name is the name');
  eq('Newname', r.off, 'with no moment (time bar off) the first name, as before');
});

scenario('browser: foundation: the Period / Moment footer, language and type pills, the date format menu', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1200);
  ok((await pg.locator('#foot').count()) === 1 && (await pg.locator('#tbOpen, #timebar').count()) === 0, 'the footer is there and the old time bar is gone');
  eq('Any', (await pg.locator('#ftRange').innerText()).trim(), 'Period reads Any at the start');
  eq(48, await pg.locator('#ftBars i').count(), 'the histogram has 48 steps');
  const bar0 = await pg.evaluate(() => document.querySelector('#ftBars i'));
  await pg.evaluate(() => { const f = document.querySelector('#ftFrom'); f.value = '400'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => periodActive()), 'moving the handle sets the Period filter');
  ok(!/Any/.test(await pg.locator('#ftRange').innerText()), 'the footer shows the new range');
  eq(48, await pg.locator('#ftBars i').count(), 'still 48 bars after a redraw');
  await pg.click('#ftClear'); await pg.waitForTimeout(200);
  ok(!(await pg.evaluate(() => periodActive())) && /Any/.test(await pg.locator('#ftRange').innerText()), 'the cross resets the Period to Any');
  await pg.locator('#ftModeMoment').check({ force: true }); await pg.waitForTimeout(200);
  ok(await pg.locator('#ftDate').isVisible() && (await pg.evaluate(() => AHM.state.get('time').at)) !== null, 'Moment shows the Moment controls and sets the moment');
  ok(!(await pg.locator('#ftFrom').isVisible()), 'the Period handles are hidden in Moment');
  await pg.locator('#ftSpeed input[value="50"]').check({ force: true });
  eq(50, await pg.evaluate(() => AHM.state.get('time').speed), 'the speed buttons set the speed');
  await pg.locator('#ftModePeriod').check({ force: true }); await pg.waitForTimeout(200);
  ok(/Any/.test(await pg.locator('#ftRange').innerText()) && (await pg.evaluate(() => AHM.state.get('time').at)) === null, 'Period returns to the Period footer');
  await pg.evaluate(() => openDlg('place', { lon: 44.5, lat: 40.1, name: 'Pillville' }));
  await pg.click('#dPlaceForm .lang-pill[data-lang="hy"]');
  eq('hy', await pg.locator('#dPlaceForm .pf-name .nl').inputValue(), 'a language pill sets the select that holds the value');
  await pg.click('#dPlaceForm .type-pill[data-type="village"]');
  eq('village', await pg.locator('#dPlaceForm .pf-type').inputValue(), 'a type pill sets the type');
  const df = pg.locator('#dPlaceForm .pf-when .df').first();
  await df.locator('.df-fmtbtn').click();
  ok(await df.locator('.df-menu').isVisible(), 'the format chip opens the menu');
  await df.locator('.df-menu [data-fmt="dmy"]').click();
  eq('dmy', await df.locator('.df-fmt').inputValue(), 'choosing a format in the menu sets the format');
  ok(!(await df.locator('.df-menu').isVisible()), 'the menu closes after the choice');
});

scenario('browser: foundation: confirm dialog, toast, note Show more', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1000);
  await pg.evaluate(() => { window.__r = null; uiConfirm('Delete it?').then((v) => (window.__r = v)); });
  ok(await pg.locator('dialog.ui-confirm').isVisible(), 'the confirm dialog is open');
  await pg.click('dialog.ui-confirm [data-v="1"]'); await pg.waitForTimeout(100);
  eq(true, await pg.evaluate(() => window.__r), 'Delete answers true');
  await pg.evaluate(() => { window.__r = null; uiConfirm('Delete it?').then((v) => (window.__r = v)); });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  eq(false, await pg.evaluate(() => window.__r), 'Escape answers false');
  await pg.evaluate(() => uiToast('Saved', 'ok', 300));
  ok(await pg.locator('.ui-toast').isVisible(), 'the toast shows');
  await pg.waitForTimeout(500);
  eq(0, await pg.locator('.ui-toast').count(), 'and goes away by itself');
  await pg.evaluate(() => { document.querySelector('#list').insertAdjacentHTML('beforeend', uiNote({ title: 'T', lang: 'en', text: 'word '.repeat(80) })); });
  await pg.click('.ui-more');
  ok(!(await pg.locator('.ui-text').evaluate((e) => e.classList.contains('clamp'))) && /less/.test(await pg.locator('.ui-more').innerText()), 'Show more opens the text and turns into Show less');
});

// ---- foundation v2: kit, confirm dialog, toast, states (static templates, no markup built in JS) ----
scenario('browser: foundation v2: kit fills templates, states, field errors, list keeps rows', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => {
    const box = document.createElement('div'); document.body.append(box);
    const out = {};
    kit.state(box, 'error', 'Could not load <b>x</b>', () => (window.__retried = true));
    out.errText = box.textContent.trim().startsWith('Could not load <b>x</b>') && !box.querySelector('b'); // text, never markup
    box.querySelector('[data-retry]').click(); out.retried = window.__retried === true;
    kit.state(box, 'empty', 'Nothing here'); out.empty = !!box.querySelector('p') && box.textContent.includes('Nothing here');
    kit.state(box, 'loading', 'Loading'); out.skeleton = box.querySelectorAll('.skeleton').length === 3;
    kit.state(box, 'down', 'Service down'); out.downNoRetry = box.querySelector('[data-retry]').hidden === true;
    const inp = document.createElement('input'); inp.className = 'input'; box.replaceChildren(inp);
    kit.invalid(inp, 'Required'); out.inv = inp.classList.contains('input-error') && inp.getAttribute('aria-invalid') === 'true' && /Required/.test(box.textContent);
    kit.clear(box); out.cleared = !inp.classList.contains('input-error') && box.querySelectorAll('[data-field-error]').length === 0;
    const ul = document.createElement('ul'); document.body.append(ul);
    kit.list(ul, [{ id: 1 }, { id: 2 }], 't-toast', (n, it) => kit.fill(n, { text: 'n' + it.id }));
    const first = ul.children[0];
    kit.list(ul, [{ id: 2 }, { id: 1 }, { id: 3 }], 't-toast', (n, it) => kit.fill(n, { text: 'n' + it.id }));
    out.keyed = ul.children[1] === first && [...ul.children].map((c) => c.dataset.id).join() === '2,1,3';
    kit.list(ul, [{ id: 3 }], 't-toast', () => {}); out.removed = ul.children.length === 1;
    return out;
  });
  for (const k of Object.keys(r)) ok(r[k] === true, 'kit: ' + k);
});

scenario('browser: foundation v2: confirm (five texts of s068/s069), toast, Escape and Cancel', null, async (pg, S) => {
  await pg.goto(S.base + '/'); await pg.waitForTimeout(800);
  const ask = (kind, vars) => pg.evaluate(([k, v]) => { window.__r = null; dialogs.confirm(k, v).then((x) => (window.__r = x)); }, [kind, vars]);
  const texts = {
    delete: ['Delete “Kingdom of Urartu”?', 'Delete', { name: 'Kingdom of Urartu' }],
    'remove-type': ['Remove the type “Fortress”?', 'Remove', { name: 'Fortress' }],
    'delete-layer': ['Delete the layer “Artaxiad capitals”?', 'Delete', { name: 'Artaxiad capitals' }],
    import: ['Import 8 shapes as borders?', 'Import', { count: 8, type: 'Territory or area' }],
    'discard-route': ['Discard this route?', 'Discard', {}],
  };
  for (const [kind, [title, okText, vars]] of Object.entries(texts)) {
    await ask(kind, vars);
    ok(await pg.locator('#ahm-confirm').isVisible(), kind + ': open');
    eq(title, (await pg.locator('#ahm-confirm h3').innerText()).trim(), kind + ': title');
    eq(okText, (await pg.locator('#ahm-confirm [data-ok]').innerText()).trim(), kind + ': ok button');
    eq(kind !== 'import', await pg.locator('#ahm-confirm [data-ok]').evaluate((e) => e.classList.contains('btn-error')), kind + ': danger colour');
    await pg.click('#ahm-confirm [data-ok]'); await pg.waitForTimeout(50);
    eq(true, await pg.evaluate(() => window.__r), kind + ': OK answers true');
  }
  await ask('delete', { name: 'X' }); await pg.click('#ahm-confirm form .btn-soft'); await pg.waitForTimeout(50);
  eq(false, await pg.evaluate(() => window.__r), 'Cancel answers false');
  await ask('delete', { name: 'X' }); await pg.keyboard.press('Escape'); await pg.waitForTimeout(50);
  eq(false, await pg.evaluate(() => window.__r), 'Escape answers false');
  await pg.evaluate(() => dialogs.toast('Saved', 'ok', 300));
  ok(await pg.locator('#ahm-toasts .alert').isVisible(), 'the toast shows');
  await pg.waitForTimeout(500);
  eq(0, await pg.locator('#ahm-toasts .alert').count(), 'and goes away by itself');
});

scenario('browser: foundation v2: rail (60px, tooltips, Period dot), logo toggle, tabs', null, async (pg, S) => {
  await pg.setViewportSize({ width: 1100, height: 860 });
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1000);
  ok(await pg.locator('#side .tabs.tabs-border .tab').count() === 6, 'six daisyUI tabs');
  eq('true', await pg.locator('.tabs [data-tab="explore"]').getAttribute('aria-selected'), 'Explore is the selected tab');
  await pg.click('#ahmLogo'); await pg.waitForTimeout(400);
  eq(60, Math.round(await pg.locator('#side').evaluate((e) => e.getBoundingClientRect().width)), 'closed: the rail is 60px');
  ok(await pg.locator('#rail').isVisible() && !(await pg.locator('#side .tabs').isVisible()), 'closed: rail shown, tab bar hidden');
  eq('Borders: opens the panel on this tab', await pg.locator('.tooltip:has([data-rail="shapes"])').getAttribute('data-tip'), 'tooltip says what a click does');
  ok(await pg.locator('#railDot').evaluate((e) => e.hidden), 'no dot while the Period is Any');
  await pg.evaluate(() => { periodSetField('from', { fmt: 'y', ts: '0100-01-01T00:00:00Z', mode: 'exact', ts_to: null }); document.querySelector('#fFrom').dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(200);
  ok(!(await pg.locator('#railDot').evaluate((e) => e.hidden)), 'a Period filter puts the dot on the clock');
  await pg.click('[data-rail="routes"]'); await pg.waitForTimeout(400);
  ok(!(await pg.evaluate(() => document.body.classList.contains('collapsed'))) && await pg.locator('#tab-routes').isVisible(), 'a rail icon opens the panel on that tab');
  await pg.click('#collapse'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => document.body.classList.contains('collapsed')), 'the chevron closes the panel');
});

scenario('browser: foundation v2: phone bottom sheet, handle, Time button', null, async (pg, S) => {
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.goto(S.base + '/'); await pg.waitForTimeout(1000);
  const box = await pg.locator('#side').boundingBox();
  ok(box.width >= 389 && box.y > 100, 'the panel is a bottom sheet');
  ok(await pg.locator('#resizer').isVisible(), 'the grab handle is there');
  await pg.click('#collapse'); await pg.waitForTimeout(400);
  ok(await pg.locator('#expand').isVisible() && await pg.locator('#ahmTime').isVisible(), 'hidden: the handle tab and the Time button stay');
  await pg.click('#expand'); await pg.waitForTimeout(400);
  ok((await pg.locator('#side').boundingBox()).y < 844 - 100, 'the handle tab opens the sheet again');
});
