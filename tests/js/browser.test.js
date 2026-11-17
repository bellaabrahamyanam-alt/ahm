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
  ok(await pg.locator('#tab-shapes').isVisible() && (await pg.locator('.tabs button.on').innerText()) === 'Rivers', 'the Rivers tab shows the shapes panel and is the selected tab');
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
    ok(await pg.locator('.tabs button').count()===6 && await pg.locator('#more-maps #basemap').count()===1, 'six tabs (Explore, Borders, Routes, Rivers, Layers, More); Maps is a fold in More');
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
