// More tab (task more.md): Maps & base map, Directions, Languages, Types, Historical maps.
// Markup is static in index.html (regions tab-more, tpl-more); the scripts clone templates. Real browser (Chromium via Playwright, MapLibre stubbed).
const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// ---- rule: no markup built from strings in the files of this tab ----
test('ui-more: admin.js and overlays.js build no markup from strings; the regions have no inline style or handler', () => {
  for (const f of ['app/js/sidebar/admin.js', 'app/js/map/overlays.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|createContextualFragment/.test(s), f + ' builds no markup');
    ok(!/\besc\(/.test(s), f + ' needs no esc()');
  }
  const html = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
  const region = (n) => html.slice(html.indexOf(`<!-- ahm:region ${n} -->`), html.indexOf(`<!-- /ahm:region ${n} -->`));
  const mine = region('tab-more').replace(/<details class="fold" id="more-cat">[\s\S]*?<\/details>/, '') + region('tpl-more'); // Categories is the layers worker's
  ok(!/\sstyle="/.test(mine) && !/\son[a-z]+="/.test(mine), 'no inline style, no inline handler');
  ok(!/<section/.test(region('tpl-more')), 'a template never holds a <section> (tab() hides every section of the panel)');
});

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
const STUB = `(function(){
 const p=new Proxy(function(){},{get:(t,k)=>{ if(k==='then')return undefined;
  if(k==='on'||k==='once')return (ev,a,b)=>{const f=typeof a==='function'?a:b; if(ev==='load'||ev==='style.load'||ev==='idle')setTimeout(()=>f&&f({}),0); return p;};
  if(k==='getZoom')return()=>6.5; if(k==='getPitch'||k==='getBearing')return()=>0; if(k==='getLayer'||k==='getSource')return()=>undefined; if(k==='queryRenderedFeatures')return()=>[];
  if(k==='getBounds')return()=>({getWest:()=>40,getEast:()=>48,getNorth:()=>42,getSouth:()=>36}); if(k==='getCanvas')return()=>({style:{},addEventListener(){},removeEventListener(){}});
  if(k==='getStyle')return()=>({layers:[],sources:{}}); if(k==='isStyleLoaded')return()=>true; if(k==='getLngLat')return()=>({lat:40,lng:44});
  return ()=>p; }, apply:()=>p, construct:()=>p});
 window.maplibregl={Map:function(){return p;},Marker:function(){return p;},Popup:function(){return p;},NavigationControl:function(){return {};},LngLatBounds:function(){return {extend(){return this;},isEmpty(){return true;}};}};
})();`;
const daisy = () => [process.env.AHM_DAISYUI_CSS, path.join(ROOT, 'app', 'node_modules', 'daisyui', 'daisyui.css'), '/tmp/ahm-ui/node_modules/daisyui/daisyui.css'].filter(Boolean).find((f) => fs.existsSync(f));

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
    const pg = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    pg.setDefaultTimeout(8000);
    const errs = [];
    pg.on('pageerror', (e) => errs.push('pageerror ' + e.message));
    pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push('console ' + m.text()));
    await pg.route('**/maplibre-gl*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: '/* stand-in */' }));
    await pg.route((u) => !u.toString().startsWith(S.base) && !/maplibre-gl/.test(u.toString()), (r) => r.abort());
    const dz = daisy();
    if (dz) await pg.route('**/daisyui@*/daisyui.css', (r) => r.fulfill({ contentType: 'text/css', path: dz }));
    await pg.addInitScript(STUB);
    try {
      await pg.goto(S.base + '/');
      await pg.waitForTimeout(1200);
      await pg.evaluate(() => tab('more'));
      await fn(pg, S);
      eq([], errs, 'page errors');
    } finally {
      await browser.close();
      await S.stop();
    }
  });
}
const E = (pg, f, ...a) => pg.evaluate(f, ...a);

scenario('ui-more: the five cards are the same accordion; opening one by name works; 400 px wide nothing overflows sideways', async (pg) => {
  eq(6, await pg.locator('#mr-cards > details').count(), 'five cards + the legacy Categories');
  for (const id of ['more-maps', 'more-route', 'more-lang', 'more-types', 'more-hist']) {
    ok(await pg.locator(`#${id}.collapse > summary .mr-tile`).count() === 1, id + ' has the icon tile');
    await pg.evaluate((i) => (document.getElementById(i).open = true), id);
  }
  await pg.evaluate(() => (document.querySelector('aside').style.width = '400px'));
  const over = await E(pg, () => [...document.querySelectorAll('#tab-more *')].filter((e) => e.offsetParent && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > document.querySelector('#tab-more').getBoundingClientRect().right + 1).map((e) => e.id || e.className).slice(0, 5));
  eq([], over, 'no element sticks out of the 400 px panel');
});

scenario('ui-more: base-map choice, toggles and the 3D readouts write the same config as before', async (pg) => {
  await pg.evaluate(() => (document.getElementById('more-maps').open = true));
  const thumbs = await pg.locator('#basemap input[type=radio]').count();
  ok(thumbs >= 2, 'thumbs: ' + thumbs);
  eq(1, await pg.locator('#basemap input:checked').count());
  ok(await E(pg, () => document.querySelector('#relief-opts').hidden), 'relief options are hidden on the plain map');
  eq(4, await pg.locator('#groups input[data-g]').count(), 'four "Show on the map" toggles, static');
  await pg.fill('#view-exag', '1.5');
  eq('1.5×', await pg.locator('#view-exag-out').innerText(), 'the height readout follows');
  await pg.fill('#river-size', '2');
  eq('2×', await pg.locator('#river-size-out').innerText());
  ok(await E(pg, () => document.querySelector('#view-exag').style.getPropertyValue('--mr-fill') !== ''), 'the range is filled up to the thumb');
});

scenario('ui-more: colour ramp editor adds, removes, edits (hex and swatch) and resets', async (pg) => {
  await pg.evaluate(() => {
    document.getElementById('more-maps').open = true;
    document.querySelector('#relief-opts').hidden = false;
    document.querySelector('#relief-edit').open = true;
  });
  const n0 = await pg.locator('#relief-stops .mr-stop').count();
  ok(n0 >= 2, 'stops: ' + n0);
  await pg.click('#relief-add');
  eq(n0 + 1, await pg.locator('#relief-stops .mr-stop').count(), 'Add colour');
  await pg.fill('#relief-stops .mr-stop >> nth=0 >> [data-k=h]', '#123456');
  eq('#123456', await pg.locator('#relief-stops .mr-stop >> nth=0 >> [data-k=c]').inputValue(), 'the hex field sets the swatch');
  ok(await E(pg, () => document.querySelector('#relief-ramp').value === '__custom'), 'editing makes the ramp custom');
  await pg.locator('#relief-stops [data-act=del]').last().click();
  eq(n0, await pg.locator('#relief-stops .mr-stop').count(), 'remove');
  await pg.click('#relief-reset');
  ok(await E(pg, () => document.querySelector('#relief-ramp').value !== '__custom'), 'reset goes back to the ramp');
  ok((await pg.locator('#relief-ticks span').count()) >= 2, 'legend ticks drawn from the template');
});

scenario('ui-more: languages: Add language, Save disabled until valid; duplicate refused; read-only variant', async (pg) => {
  await pg.evaluate(() => (document.getElementById('more-lang').open = true));
  eq(6, await pg.locator('#langList li').count());
  eq(0, await pg.locator('#lgAdd').count(), 'no form until + Add language');
  await pg.click('#lgNew');
  ok(await pg.locator('#lgAdd').isDisabled(), 'Save is off while empty');
  await pg.fill('#lgCode', 'xcl');
  ok(await pg.locator('#lgAdd').isDisabled(), 'still off without a name');
  await pg.fill('#lgName', 'Classical Armenian');
  ok(await pg.locator('#lgAdd').isEnabled(), 'on when code and name are there');
  await pg.click('#lgAdd');
  await pg.waitForTimeout(500);
  eq(7, await pg.locator('#langList li').count(), 'added');
  eq('7 languages', await pg.locator('#lgSub').innerText());
  await E(pg, () => { AHM_CONFIG.canLanguage = false; renderLangs(); });
  ok(await pg.locator('#lgRO').isVisible() && !(await pg.locator('#langAdmin').isVisible()), 'read-only: the note, no Add button');
  eq('Read only', await pg.locator('#lgSub').innerText());
  eq(0, await pg.locator('#langList [data-lgedit]:visible').count(), 'no pencil when read-only');
});

scenario('ui-more: types: grouped list with usage counts and "+ N more"; four Add buttons; the editors of the four kinds read and write the stored model', async (pg) => {
  await pg.evaluate(() => (document.getElementById('more-types').open = true));
  ok((await pg.locator('#typeList .mr-group').count()) >= 3, 'groups');
  ok((await pg.locator('#typeList .badge').count()) > 0, 'usage counts');
  eq(4, await pg.locator('#typeAdmin [data-tynew]').count());
  for (const geo of ['point', 'line', 'area', 'river']) {
    const code = await E(pg, (g) => types.find((t) => t.geometry === g).code, geo);
    await E(pg, ([c, g]) => tyOpenEditor(types.find((t) => t.code === c), g), [code, geo]);
    ok(await pg.locator('#mr-sheet .ahm-form').isVisible() && !(await pg.locator('#mr-cards').isVisible()), geo + ': the editor replaces the cards');
    const same = await E(pg, (c) => {
      const t = types.find((x) => x.code === c), d = tyRead();
      return JSON.stringify([d.color.toLowerCase() === t.color.toLowerCase(), Object.keys(d.style).filter((k) => JSON.stringify(d.style[k], (n, v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v)) !== JSON.stringify(t.style[k], (n, v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v))), tyReadNames().length === t.names.length, d.color, t.color, d.style, t.style]);
    }, code);
    ok(JSON.parse(same)[0] && JSON.parse(same)[1].length === 0 && JSON.parse(same)[2], geo + ': what the editor reads is what is stored ' + same);
    ok(await pg.locator('#tyAdd').isEnabled(), geo + ': Save is on for a stored type');
    await pg.click('#tyCancel');
    ok(await pg.locator('#mr-cards').isVisible(), geo + ': Cancel returns to the cards');
  }
  // delete rule: a type in use cannot be removed from the editor
  const used = await E(pg, () => { const n = typeUsage(); return types.find((t) => n[t.code] > 0).code; });
  await E(pg, (c) => tyOpenEditor(types.find((t) => t.code === c), types.find((t) => t.code === c).geometry), used);
  ok(await pg.locator('#mr-sheet [data-del]').isDisabled(), 'a type in use has its trash button off');
  await pg.click('#tyCancel');
});

scenario('ui-more: SVG symbol upload: a transform is refused with a message and Save stays off; a plain path is taken', async (pg) => {
  await E(pg, () => tyOpenEditor(types.find((t) => t.geometry === 'point'), 'point'));
  await pg.click('#mr-sheet [data-upload]');
  ok(await pg.locator('#mr-sheet .mr-svg').isVisible(), 'the zone opens');
  await E(pg, () => tyUseSvg('<svg viewBox="0 0 24 24"><path transform="scale(2)" d="M3 9c4-5 14-5 18 0z"/></svg>'));
  ok(/transform/.test(await pg.locator('#tySvgMsg').innerText()), 'error names the transform');
  ok(await pg.locator('#tyAdd').isDisabled(), 'Save is off');
  await E(pg, () => tyUseSvg('<svg viewBox="0 0 24 24"><path d="M3 9c4-5 14-5 18 0z"/></svg>', 'x.svg'));
  ok(await pg.locator('#tyAdd').isEnabled(), 'Save is on again');
  eq('custom', await E(pg, () => tyRead().style.symbol), 'the uploaded SVG is the chosen symbol');
  ok((await E(pg, () => tyRead().style.path)).startsWith('M'), 'path stored');
  await pg.click('#tyCancel');
});

scenario('ui-more: new type: Save needs an English name; the stored model comes from the editor', async (pg) => {
  await pg.evaluate(() => (document.getElementById('more-types').open = true));
  await pg.click('[data-tynew=area]');
  ok(await pg.locator('#tyAdd').isDisabled(), 'off without a name');
  await pg.fill('#mr-sheet [data-names] input[type=text], #mr-sheet [data-names] input:not([type])', 'Test realm');
  ok(await pg.locator('#tyAdd').isEnabled(), 'on with an English name');
  const d = await E(pg, () => tyRead());
  ok(d.style.outline && 'fill_opacity' in d.style, 'area model: fill_opacity + outline');
  await pg.click('#tyAdd');
  await pg.waitForTimeout(600);
  ok(await E(pg, () => types.some((t) => t.names.some((n) => n.name === 'Test realm'))), 'saved by the server and reloaded');
});

scenario('ui-more: Directions: every state of the card', async (pg) => {
  await pg.evaluate(() => (document.getElementById('more-route').open = true));
  const st = () => E(pg, () => [$('#rFrom').textContent, $('#rTo').textContent, $('#rInfo').textContent, !$('#rStats').hidden, $('#rInfo').classList.contains('mr-err')]);
  await E(pg, () => { rt = { a: null, b: null }; rtRes = null; rtInfo = ''; renderRoute(); });
  eq(['— choose on the map', '— choose on the map', '', false, false], await st(), 'empty');
  await E(pg, () => { rt = { a: { name: 'Van', lat: 38.5, lon: 43.4 }, b: null }; rtInfo = 'Now choose the destination on the map.'; renderRoute(); });
  eq(['Van', '— choose on the map', 'Now choose the destination on the map.', false, false], await st(), 'start set');
  await E(pg, () => { rt = { a: { lat: 40.7894, lon: 43.8475 }, b: null }; renderRoute(); });
  eq('40.7894, 43.8475', (await st())[0], 'a point on the map shows its coordinates');
  await E(pg, () => { rt = { a: { name: 'Van', lat: 38.5, lon: 43.4 }, b: { name: 'Yerevan', lat: 40.2, lon: 44.5 } }; rtInfo = 'Routing…'; renderRoute(); });
  eq('Routing…', (await st())[2], 'routing');
  await E(pg, () => { rtRes = { km: 452.2, min: 400 }; renderRoute(); });
  eq(['452', '6', '40'], await E(pg, () => [$('#rKm').textContent, $('#rH').textContent, $('#rM').textContent]), 'result: 452 km, 6 h 40 min');
  await E(pg, () => { rtRes = null; rtInfo = 'No route found (no road within 5 km).'; renderRoute(); });
  const s = await st();
  ok(s[3] === false && s[4] === true && /^No route found/.test(s[2]), 'no route: red text, no stats');
  await pg.click('#rSwap');
  await pg.click('#rClear');
  eq('— choose on the map', (await st())[0], 'cleared');
});

scenario('ui-more: historical maps: empty, row, upload progress from a stubbed request, error line, edit sheet', async (pg) => {
  await E(pg, () => { AHM_CONFIG.canOverlay = true; document.getElementById('more-hist').open = true; ovList = []; renderOvList(); });
  await pg.waitForTimeout(500);
  ok(await pg.locator('#ovEmpty').isVisible(), 'empty text ' + (await E(pg, () => [document.querySelector('#ovEmpty').hidden, ovList.length, document.querySelector('#more-hist').open, getComputedStyle(document.querySelector('#ovEmpty')).display].join())));
  ok(await E(pg, () => document.querySelector('#ovAdd').classList.contains('btn-primary') && !document.querySelector('#ovAdd').classList.contains('btn-dash')), 'solid Add button when empty');
  await E(pg, () => { ovList = [{ id: '1', title: 'Map of Greater Armenia, 1 c. BCE', coordinates: [[44, 41], [45, 41], [45, 40], [44, 40]], minzoom: 4, maxzoom: 12, opacity: 0.6 }]; renderOvList(); });
  eq(1, await pg.locator('#ovList .mr-ov').count(), 'one row');
  eq('1 image overlay', await pg.locator('#ovSub').innerText());
  ok(await E(pg, () => document.querySelector('#ovAdd').classList.contains('btn-dash')), 'dashed Add button when there are overlays');
  // progress: a stand-in XMLHttpRequest that reports 62 % and then answers
  const seen = await E(pg, async () => {
    const real = window.XMLHttpRequest;
    window.XMLHttpRequest = class {
      constructor() { this.upload = {}; }
      open() {}
      setRequestHeader() {}
      send() { setTimeout(() => { this.upload.onprogress({ lengthComputable: true, loaded: 62, total: 100 }); this.status = 200; this.responseText = '{"ok":true}'; setTimeout(() => this.onload(), 0); }, 0); }
    };
    const got = [];
    await ovUpload('/x', new Blob(['a'], { type: 'image/png' }), (p) => got.push(p));
    window.XMLHttpRequest = real;
    return got;
  });
  eq([0.62], seen, 'progress callback');
  await E(pg, () => { ovShowError('Save failed: the file is larger than 20 MB.'); });
  ok(await pg.locator('#ovErrBox').isVisible(), 'error line');
  await pg.click('#ovList [data-edit]');
  ok(await pg.locator('#ovTitle').isVisible() && !(await pg.locator('#mr-cards').isVisible()), 'edit sheet replaces the cards');
  eq('Map of Greater Armenia, 1 c. BCE', await pg.locator('#ovTitle').inputValue());
  await pg.fill('#ovMin', '9');
  await pg.fill('#ovMax', '3');
  await pg.click('#ovSave');
  ok(/smaller/.test(await pg.locator('#ovErr').innerText()), 'zoom range is checked');
  await pg.click('#ovCancel');
  ok(await pg.locator('#mr-cards').isVisible(), 'cancel returns to the cards');
});
