// Contract tests for the interfaces in INTERFACES.md. A domain that breaks one fixes its own code, never this test (shared domain).
const { test, ok, eq } = require('./lib/harness');
const fs = require('fs');
const path = require('path');
const { ROOT, load } = require('./lib/ctx');

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const jsFiles = (d) => fs.readdirSync(path.join(ROOT, 'app', 'js', d)).filter((f) => f.endsWith('.js')).map((f) => read('app', 'js', d, f));
const names = (src, re) => [...src.matchAll(re)].map((m) => m[1]);
const uniq = (a) => [...new Set(a)].sort();

// ---- I-1 data <-> front end ----
const READ = ['places', 'notesIndex', 'note', 'languages', 'overlays', 'overlayImage', 'layers', 'layerNotesIndex', 'categories'];
const WRITE = ['save', 'languageSave', 'overlaySave', 'overlayUpload', 'overlayDelete', 'layerSave', 'layerDelete', 'categorySave'];
// Names added by proposal 010 (INTERFACES.md 1.5): accepted before they exist, not required yet (tightened after tasks 010, 011 and 013 are merged; the owner decides).
const NEW_READ = ['types', 'shapes', 'sources'];
const NEW_WRITE = ['typeSave', 'typeDelete', 'shapeSave', 'shapeDelete', 'sourceSave'];
/** `have` must hold every name of `need` and may hold others only from `optional`. */
const within = (need, optional, have, what) => {
  const missing = need.filter((k) => !have.includes(k)),
    extra = have.filter((k) => !need.includes(k) && !optional.includes(k));
  ok(missing.length === 0 && extra.length === 0, `${what}: missing [${missing}], not in INTERFACES.md [${extra}]`);
};

test('contract I-1: config.js offers exactly the endpoint names of INTERFACES.md, in development and in the forum', () => {
  const p = load(['config.js']);
  within([...READ, ...WRITE], [...NEW_READ, ...NEW_WRITE], uniq(Object.keys(p.X('AHM_CONFIG.url'))), 'development URLs');
  const src = read('app', 'js', 'config.js');
  const forum = src.slice(src.indexOf('window.AHM_BACKEND\n    ? {'), src.indexOf('    : {'));
  within([...READ, ...WRITE], [...NEW_READ, ...NEW_WRITE], uniq(names(forum, /^\s{8}(\w+):/gm)), 'forum URLs');
});

test('contract I-1: the forum controller hands out every endpoint name, and the dev server knows every write endpoint', async () => {
  const php = read('controller', 'main.php');
  for (const k of [...READ, ...WRITE]) ok(php.includes(`'${k}' =>`), 'controller/main.php lacks the key ' + k);
  const S = await require('./lib/devserver').start();
  try {
    for (const url of ['/api/save', '/api/language/save', '/api/overlay/save', '/api/overlay/delete', '/api/layer/save', '/api/layer/delete', '/api/category/save']) {
      const r = await fetch(S.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      ok(r.status === 400 || r.status === 403, `${url} answered ${r.status}; an empty request must be refused with 400 (or 403), not 404 or 500`);
      const j = await r.json().catch(() => null);
      ok(j && typeof j.error === 'string', `${url}: the error is {"error": "..."}`);
    }
    for (const f of ['places.geojson', 'languages.json', 'overlays.json', 'layers.json', 'categories.json', 'sources.json', 'notes/index.json', 'layer-notes/index.json']) {
      const r = await fetch(S.base + '/data/' + f);
      ok(r.status === 200 && JSON.parse(await r.text()), 'data/' + f + ' is readable JSON');
    }
  } finally {
    await S.stop();
  }
});

// ---- I-2 sidebar <-> map ----
const MAP_COMMANDS = ['editPin', 'fitRoute', 'fitTo', 'focusPlace', 'focusPoint', 'getZoom', 'hidePlace', 'resize', 'setFeatures', 'setPick', 'setRoute', 'setRouteMarkers'];
const MAP_EVENTS = ['map:click', 'map:ready', 'map:show-controls', 'place:click', 'place:dblclick'];
const SIDEBAR_EVENTS = ['sidebar:resized'];
// Added by proposal 010 (1.5): accepted, not required yet. showFound: added after the fact for the Routes tab (TODO.md T-020). riverNameAt: the Rivers tab (T-038).
const NEW_MAP_COMMANDS = ['drawShape', 'baseRivers', 'getSymbols', 'hideMenu', 'hideShape', 'highlightRivers', 'highlightShape', 'isDrawing', 'previewShape', 'riverNameAt', 'selectBox', 'setShapes', 'setTypes', 'showFound', 'showMenu', 'showPreview'];
const NEW_MAP_EVENTS = ['box:cancel', 'box:select', 'draw:cancel', 'draw:finish', 'map:menu', 'map:menu-close', 'shape:click'];

test('contract I-2: AHM.map has exactly the commands of INTERFACES.md', () => {
  const p = load(['typeicons.js', 'map.js']);
  const have = Object.keys(p.X('AHM.map')).sort();
  within(MAP_COMMANDS, NEW_MAP_COMMANDS, have, 'AHM.map commands');
  for (const k of have) ok(typeof p.X('AHM.map.' + k) === 'function', k + ' is a function');
});

test('contract I-2: the events emitted and handled match the lists, and each side uses only the interface', () => {
  const map = jsFiles('map').join('\n'),
    side = jsFiles('sidebar').join('\n');
  const emit = (s) => uniq(names(s, /AHM\.emit\(\s*["']([^"']+)["']/g)),
    on = (s) => uniq(names(s, /AHM\.on\(\s*["']([^"']+)["']/g));
  within(MAP_EVENTS, NEW_MAP_EVENTS, emit(map), 'events emitted by the map');
  eq(SIDEBAR_EVENTS, emit(side), 'events emitted by the sidebar');
  within(MAP_EVENTS.filter((e) => e !== 'map:ready'), [...NEW_MAP_EVENTS, 'state:time'], on(side), 'events handled by the sidebar (map:ready needs no handler: features are queued; state:time of I-6 refreshes the lists and the map)');
  eq([...SIDEBAR_EVENTS, 'state:selected'].sort(), on(map), 'events handled by the map: sidebar:resized, and state:selected of I-6 (the map highlights the selected place)');
  const used = uniq(names(side, /AHM\.map\.(\w+)/g));
  const known = [...MAP_COMMANDS, ...NEW_MAP_COMMANDS];
  ok(used.every((k) => known.includes(k)), 'the sidebar calls an AHM.map command that is not in INTERFACES.md: ' + used.filter((k) => !known.includes(k)));
  const props = uniq(names(map + side, /\bAHM\.(\w+)/g));
  ok(props.every((k) => ['emit', 'icons', 'map', 'on', 'state'].includes(k)), 'only AHM.map, AHM.on, AHM.emit, AHM.state (I-6) and AHM.icons (I-7) may be used outside ahm.js: ' + props);
});

// ---- I-3 core functions ----
const CORE = [
  'isoToSec', 'secToIso', 'dateToTs', 'dateFromTs', 'dateClean', 'dateUpgrade', 'dateBounds', 'spanBounds', 'dateKey', 'dateOrderCheck', 'dateText', 'spanText',
  'periodEndSec', 'datePeriodEnd', 'legacyToDate', 'getJSON', 'loadPlaces', 'loadNotesIndex', 'loadNoteBody', 'loadLayers', 'loadLayerNotes', 'loadCategories',
  'loadLanguages', 'esc', 'norm', 'label', 'langName', 'run', 'byDateKey', 'periodActive', 'layerAllows', 'lyScope', 'lyHalo', 'lyNoteVisible',
  'loadSources', 'sourceById', 'evidenceAllows', 'visibleAt', 'timeSpan', 'timeAdvance', 'timeLook', 'nameAt', 'nameMatch',
];

test('contract I-3: the core functions of INTERFACES.md exist with the same names', () => {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'search.js', 'searchfield.js', 'period.js']);
  for (const k of CORE) ok(typeof p.X(k) === 'function', k + ' is missing from the core (or sidebar/period.js for periodActive)');
  ok(p.X('DATE_FORMATS') !== undefined, 'DATE_FORMATS');
});

// Added by proposal 010 (1.5): not required yet; a name that exists must be a function (tightened after task 011 is merged; the owner decides).
const NEW_CORE = ['loadTypes', 'typeLabel', 'loadShapes', 'layerAllowsShape'];

test('contract I-3 [1.5]: the new core names are not required yet, but a name that exists is a function', () => {
  const p = load(['state.js', 'config.js', 'dates.js', 'data.js', 'datefield.js', 'layer-rules.js', 'search.js', 'searchfield.js', 'period.js']);
  for (const k of NEW_CORE) ok(['undefined', 'function'].includes(p.X(`typeof ${k}`)), k + ' must be a function when it exists');
});

test('contract I-4: typeIcon(type) and TYPE_STYLE exist (the symbols are drawn by the map domain, used by the sidebar)', () => {
  const p = load(['config.js', 'data.js', 'typeicons.js']);
  ok(typeof p.X('typeIcon') === 'function', 'typeIcon');
  ok(p.X('TYPE_STYLE.settlement') !== undefined, 'TYPE_STYLE.settlement');
});

// ---- I-6 state manager ----
const STATE_KEYS = ['layers', 'selected', 'time'];

test('contract I-6: AHM.state has exactly get, set, patch and exactly the keys selected, layers and time', () => {
  const p = load(['state.js']);
  if (p.X('typeof AHM.state') !== 'object') return console.log('    (state manager not built yet: skipped)');
  eq(['get', 'patch', 'set'], p.X('Object.keys(AHM.state).sort()'));
  const src = read('app', 'js', 'state', 'state.js');
  const block = src.slice(src.indexOf('const values = {'), src.indexOf('\n  };', src.indexOf('const values = {')));
  eq(STATE_KEYS, uniq(names(block, /^ {4}(\w+):/gm)), 'the keys of state.js must be the keys of INTERFACES.md I-6');
  for (const k of STATE_KEYS) ok(p.X(`AHM.state.get('${k}') !== undefined`), 'get(' + k + ')');
  ok(p.X("(() => { try { AHM.state.get('nope'); return false; } catch (e) { return /unknown key/.test(e.message); } })()"), 'an unknown key throws "unknown key"');
});

test('contract I-6: nobody but app/js/state/state.js assigns AHM.state', () => {
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
  const bad = walk(path.join(ROOT, 'app', 'js'))
    .concat(walk(path.join(ROOT, 'app', 'features')))
    .filter((f) => !f.endsWith(path.join('state', 'state.js')) && /\bAHM\.state\s*=[^=]/.test(fs.readFileSync(f, 'utf8')));
  eq([], bad.map((f) => path.relative(ROOT, f)), 'files that assign AHM.state');
});
