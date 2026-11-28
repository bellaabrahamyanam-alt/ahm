// The Borders tab (sidebar domain): the list of shapes, one card per shape (look, layers, details), and the three ways to add one:
// search OpenStreetMap, draw on the map, import a GeoJSON file. The data rules live in core/shapes.js, the drawing on the map in map/shapes.js.
// Look changes (colour, opacity, name on the map) are saved at once from the card; names, type and dates have a form.
const sh = {
  open: null, // id of the shape whose card is open
  mode: 'borders', // the tab the list and the card serve: 'borders' (areas and lines) or 'rivers' (rivers), same code, two tabs
  modes: { borders: { q: '', types: new Set() }, rivers: { q: '', types: new Set() } }, // the search text and the type filter of each tab
  get types() {
    return this.modes[this.mode].types;
  },
  hidden: new Set(), // shapes the person switched off in the list (this session only)
  form: null, // { id | null, kind, geometry, source } while the form is shown
  draw: null, // { mode: 'new' | 'edit', kind, id, ctl } while the drawing tool is on
  adding: false, // the add panel is open
  geo: [], // results of the OpenStreetMap search
  geoQ: '',
  loaded: false, // the data has arrived (until then the list shows a loading skeleton)
  rsel: new Set(), // the selected rivers (T-057), by id; this session only
  rbase: new Map(), // the selected rivers of the base map: "b:<name>" -> { id, name, geometry }
  rOnly: false, // "Show only these": the map draws only the selected rivers
  boxOn: false, // the rectangle tool of the map is on
  river: { on: false, seen: false, q: '', lines: [], clicks: [], res: [] }, // rivers: the river lines found by name (only used for drawing and looking, never saved) and the clicks they were used for
};
const shCan = () => AHM_CONFIG.canEdit;
const shBox = (s) => s._box || (s._box = geomBBox(s.geometry));
const shUrl = () => AHM_CONFIG.url;

// ---- the type marker: a small picture of the line pattern and the fill of the type, like the markers of the place types ----
const shIcons = {};
function shIcon(type) {
  if (shIcons[type]) return shIcons[type];
  const t = shapeType(type),
    c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.fillStyle = t.color + '40';
  x.strokeStyle = t.color;
  x.lineWidth = Math.max(1.3, t.width * 0.6);
  x.setLineDash({ solid: [], dashed: [3, 2], dotted: [0.1, 2.4], dashdot: [4, 1.6, 1, 1.6] }[t.dash]);
  x.lineCap = t.dash === 'dotted' ? 'round' : 'butt';
  x.beginPath();
  if (t.route) {
    // a route: a line from one end to the other, with an arrowhead
    x.moveTo(2, 13);
    x.lineTo(13, 4);
    x.stroke();
    x.setLineDash([]);
    x.beginPath();
    x.moveTo(14, 3);
    x.lineTo(8.5, 4.2);
    x.lineTo(12.8, 8.5);
    x.fillStyle = t.color;
    x.fill();
  } else {
    x.roundRect(2, 3, 12, 10, 2);
    x.fill();
    x.stroke();
  }
  return (shIcons[type] = `<img class="ti" alt="" width="16" height="16" src="${c.toDataURL()}">`);
}

/** The marker of a type as an <img> element (the string form above stays for the other tabs). */
function shIconNode(type) {
  const i = document.createElement('img');
  i.className = 'ti';
  i.alt = '';
  i.width = i.height = 16;
  i.src = /src="([^"]+)"/.exec(shIcon(type))[1];
  return i;
}
// ---- the two tabs of this module: Borders and Rivers (the card, the form, the notes and the drawing tool are shared) ----
const SH_TEXT = {
  borders: { intro: 'Borders of countries, regions and other areas, and lines. Colour them, make them transparent and show their names on the map. They can belong to layers and follow the period filter of Explore.', search: 'Search borders', ph: 'Search borders…', fit: 'Zoom the map to the borders in the list' },
  rivers: { intro: 'Rivers. Find a river by name, then draw the part you need by clicking two points on it. Colour them, set the width and show their names on the map. They can belong to layers and follow the period filter of Explore.', search: 'Search rivers', ph: 'Search rivers…', fit: 'Zoom the map to the rivers in the list' },
};
/** Called by tab(): the Borders and the Rivers tab show the same panel with their own list, filters, types and add panel. */
function shSetMode(m) {
  if (m === sh.mode) return;
  if (sh.draw) shCancelDraw(); // a drawing belongs to its tab: leaving the tab cancels it
  sh.modes[sh.mode].q = $('#shQ').value;
  if (sh.boxOn) AHM.map.selectBox(false), (sh.boxOn = false), rvBoxBtn(); // the rectangle belongs to the Rivers tab
  sh.mode = m;
  $('#rvSel').hidden = m !== 'rivers';
  sh.open = null;
  sh.adding = false;
  if (m === 'rivers' && !sh.river.seen) (sh.river.on = true), (sh.river.seen = true); // the first time, the Rivers tab follows a river by default; after that the choice is kept
  const t = SH_TEXT[m];
  $('#shQ').value = sh.modes[m].q;
  $('#shQ').placeholder = t.ph;
  $('#shIntro').textContent = t.intro;
  $('#shSearchLbl').textContent = t.search;
  $('#shFit').title = t.fit;
  shRenderList();
  shRenderAdd();
}
// ---- data ----
const SH_GROUP = { borders: 'border', rivers: 'river' };
/** The shapes of one tab (borders or rivers) that pass its search, type filter and the period. */
const shVisibleOf = (m) =>
  shapesRun({ q: m === sh.mode && $('#shQ') ? $('#shQ').value : sh.modes[m].q, lang: $('#lang').value, types: sh.modes[m].types, period: periodBounds(), group: SH_GROUP[m] });
const shVisible = () => shVisibleOf(sh.mode);
const shTypeList = () => (sh.mode === 'rivers' ? RIVER_TYPE_LIST : BORDER_TYPES);
const shOnTab = () => curTab === (sh.mode === 'rivers' ? 'rivers' : 'shapes');
const shWord = () => (sh.mode === 'rivers' ? 'rivers' : 'borders');
async function shReload() {
  shapes = await loadShapes();
  sh.loaded = true;
  shRefresh();
  shRenderView();
}
/** Called by update(): the filters, the language or the layers changed. */
function shRefresh() {
  shRenderList();
  rtRenderList(); // the routes follow the same filters (routes.js)
  shPush();
}
/** Gives the map every visible shape with its look resolved (the map knows nothing about types). */
function shPush() {
  const l = $('#lang').value,
    out = [];
  [...shVisibleOf('borders'), ...shVisibleOf('rivers').filter((s) => !(sh.rOnly && sh.rsel.size) || sh.rsel.has(s.id))].filter((s) => !sh.hidden.has(s.id)).concat(rtVisible().filter((s) => !rts.hidden.has(s.id))) // borders, rivers and routes (routes.js)
    .filter((s) => !(sh.draw && sh.draw.id === s.id) && !(rts.draw && rts.draw.id === s.id)) // the shape whose outline is being redrawn is drawn by the tool
    .sort((a, b) => bboxArea(shBox(b)) - bboxArea(shBox(a))) // big first: small shapes end on top
    .forEach((s) => {
      const t = shapeType(s.type),
        kind = shapeKind(s.geometry),
        props = {
          id: s.id,
          kind,
          name: shapeName(s, l),
          type: t.label,
          dates: shapeWhen(s),
          color: s.color,
          ink: shapeInk(s.color),
          opacity: timeLook(s) === 'faded' ? s.opacity * 0.35 : s.opacity, // only possible at the moment of the time bar (T-040)
          width: s.width || t.width,
          dash: t.dash,
          label: s.label,
          arrows: isRoute(s) && !s.twoway,
          river: isRiver(s), // the map widens rivers with "River size" (T-055)
          halo: lyState.editing ? lyHalo(s.id) : '', // while members are chosen, the members of the layer get a ring
          size: bboxArea(shBox(s)),
        };
      out.push({ type: 'Feature', geometry: s.geometry, properties: props });
      if (kind === 'area' && s.label)
        out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: s._lp || (s._lp = geomLabelPoint(s.geometry)) }, properties: { ...props, id: s.id + '#label', kind: 'label' } });
    });
  AHM.map.setShapes({ type: 'FeatureCollection', features: out });
}

// ---- the list ----
function shRenderTypes() {
  const c = {},
    box = $('#shTypes');
  shapes.filter((s) => shapeGroup(s) === SH_GROUP[sh.mode]).forEach((s) => (c[s.type] = (c[s.type] || 0) + 1));
  box.replaceChildren();
  shTypeList()
    .filter((t) => c[t] || sh.types.has(t))
    .forEach((t) => {
      const b = kit.tpl('t-bd-type'),
        on = sh.types.has(t);
      b.dataset.t = t;
      b.classList.toggle('btn-primary', on);
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('.bd-dot').style.setProperty('--bd-c', SHAPE_TYPES[t].color || '#475b66');
      kit.fill(b, { label: SHAPE_TYPES[t].label, count: c[t] || 0 });
      box.append(b);
    });
}
function shRenderList() {
  if (typeof kit === 'undefined') return; // the node test pages (layers.test.js uiPage) load no templates
  const l = $('#lang').value,
    rows = shVisible(),
    all = shapes.filter((s) => shapeGroup(s) === SH_GROUP[sh.mode]).length,
    ul = $('#shList');
  shRenderTypes();
  kit.fill($('#shCount'), { n: rows.length, rest: 'of ' + all + ' ' + shWord() });
  if (!sh.loaded || !rows.length) {
    const li = document.createElement('li');
    kit.state(li, sh.loaded ? 'empty' : 'loading', !sh.loaded ? 'Loading…' : all ? `No ${shWord()} match. Try fewer filters.` : `No ${shWord()} yet.`);
    ul.replaceChildren(li);
    return;
  }
  ul.replaceChildren(
    ...rows.map((s) => {
      const t = shapeType(s.type),
        when = shapeWhen(s),
        also = nameMatch(s, sh.modes[sh.mode].q, l), // an old name found by the search (T-043)
        li = kit.tpl('t-bd-row'),
        eye = li.querySelector('[data-vis]');
      li.dataset.sid = s.id;
      li.querySelector('[data-icon]').append(shIconNode(s.type));
      li.querySelector('[data-icon]').title = t.label;
      kit.fill(li, { title: shapeName(s, l), sub: `${t.label} · ${shapeKind(s.geometry) === 'area' ? 'area' : 'line'}${when ? ' · ' + when : ''}`, alias: also ? 'also called ' + also : '' });
      li.querySelector('[data-bind="alias"]').hidden = !also;
      eye.dataset.vis = s.id;
      eye.checked = !sh.hidden.has(s.id);
      if (sh.open === s.id && shOnTab() && !sh.form) shExpand(li, s);
      else if (sh.form && sh.formNode && sh.form.id === s.id) shFormInRow(li);
      return li;
    })
  );
}
$('#shList').addEventListener('click', (e) => {
  if (e.target.closest('.bd-eye') || e.target.closest('.bd-body')) return;
  const li = e.target.closest('li[data-sid]');
  if (!li || e.detail > 1) return;
  sh.open === li.dataset.sid && !sh.form ? shClose() : shOpen(li.dataset.sid);
});
$('#shList').addEventListener('dblclick', (e) => {
  const li = e.target.closest('li[data-sid]');
  if (li && !e.target.closest('.bd-eye') && !e.target.closest('.bd-body')) shOpen(li.dataset.sid, true);
});
$('#shList').addEventListener('change', (e) => {
  const id = e.target.dataset.vis;
  if (!id) return;
  e.target.checked ? sh.hidden.delete(id) : sh.hidden.add(id);
  shPush();
});
$('#shTypes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  sh.types.has(b.dataset.t) ? sh.types.delete(b.dataset.t) : sh.types.add(b.dataset.t);
  shRefresh();
});
document.addEventListener('input', (e) => e.target.id === 'shQ' && shRefresh());
$('#shMore').addEventListener('click', (e) => {
  const open = $('#shIntro').classList.toggle('bd-clamp') === false;
  e.target.textContent = open ? 'Less' : 'More';
  e.target.setAttribute('aria-expanded', String(open));
});
$('#shFit').onclick = () => AHM.map.fitTo(shVisible().flatMap((s) => bboxCorners(shBox(s))));
function shFit(id) {
  const s = shapeById(id);
  if (s) AHM.map.fitTo(bboxCorners(shBox(s)));
}

// ---- the card ----
function shOpen(id, fit) {
  if (!shapeById(id)) return;
  if (isRoute(shapeById(id))) return rtOpen(id, fit); // a route has its own tab and card (routes.js)
  shCancelForm();
  if (sh.adding) ((sh.adding = false), AHM.map.showPreview(null), shRenderAdd());
  sh.open = id;
  tab(isRiver(shapeById(id)) ? 'rivers' : 'shapes');
  shRenderList();
  shRenderView();
  history.replaceState(null, '', '#border-' + id);
  if (fit) shFit(id);
}
function shClose() {
  shCancelForm();
  sh.open = null;
  shRenderList();
  shRenderView();
  history.replaceState(null, '', location.pathname + location.search);
}
function shShow(on) {
  $('#shDetail').hidden = !on;
  dockSync();
}
/** The tab shows the list (null) or one full view (add, drawing, form) in #bdPanel. */
function shView(node) {
  $('#bdMain').hidden = !!node;
  $('#bdPanel').hidden = !node;
  $('#bdPanel').textContent = '';
  if (node) $('#bdPanel').append(node);
}
/** The open row unfolds into the card; the others fold. */
function shExpand(li, s) {
  document.querySelectorAll('#shList .bd-open').forEach((x) => x !== li && shFold(x));
  const body = li.querySelector('.bd-body');
  li.classList.add('bd-open');
  body.replaceChildren(shCardBody(s));
  body.hidden = false;
}
/** The form of Edit details takes the place of the card in its row. */
function shFormInRow(li) {
  const body = li.querySelector('.bd-body');
  li.classList.add('bd-open');
  body.replaceChildren(sh.formNode);
  body.hidden = false;
}
function shFold(li) {
  const body = li.querySelector('.bd-body');
  li.classList.remove('bd-open');
  body.hidden = true;
  body.replaceChildren();
}
/** The nodes of the version chips of a series (oldest first); the open one is marked. */
function shVersionNodes(s) {
  const all = [...shapeVersions(s), s].sort((a, b) => (dateKey(a.date_from) < dateKey(b.date_from) ? -1 : dateKey(a.date_from) > dateKey(b.date_from) ? 1 : 0));
  return all.map((v) => {
    const b = kit.tpl('t-bd-chip');
    kit.fill(b, { label: shapeWhen(v) || 'no dates' });
    if (v.id === s.id) (b.classList.add('btn-primary'), b.setAttribute('aria-current', 'true'));
    else (b.dataset.shact = 'version'), (b.dataset.sid = v.id);
    return b;
  });
}
/** The card of a shape (it unfolds inside its row): names, versions, look (saved at once), layers, notes. */
function shCardBody(s) {
  const l = $('#lang').value,
    t = shapeType(s.type),
    kind = shapeKind(s.geometry),
    can = shCan(),
    others = s.names.filter((n) => n.name !== shapeName(s, l)),
    vs = shapeVersions(s),
    inLy = layers.filter((ly) => lyMembers[ly.id] && lyMembers[ly.id].has(s.id)),
    free = layers.filter((ly) => !inLy.includes(ly)),
    osm = /^osm:(node|way|relation)\/(\d+)$/.exec(s.source || ''),
    srcs = (s.sources || []).map(sourceById).filter(Boolean),
    cert = [s.certainty ? CERT_LABELS[s.certainty] : '', s.radius_m ? 'about ' + radiusText(s.radius_m) : ''].filter(Boolean).join(', '),
    ns = layerNotes.filter((n) => n.layer === s.id && (!l || n.lang === l)).sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.title.localeCompare(b.title)),
    c = kit.tpl('t-bd-card'),
    q = (x) => c.querySelector(x),
    w = s.width || t.width;
  kit.fill(c, { vtitle: `Versions in time · ${vs.length + 1}`, cert: cert ? 'Certainty: ' + cert : '', opLabel: kind === 'area' ? 'Fill opacity' : 'Line opacity', ntitle: `Notes · ${ns.length}` });
  c.querySelectorAll('[data-can]').forEach((b) => (b.hidden = !can || (b.dataset.shact === 'editshape' && !geomToDraw(s.geometry))));
  others.forEach((n) => {
    const r = kit.tpl('t-bd-name');
    kit.fill(r, { name: n.name, lang: n.lang.toUpperCase() });
    q('[data-names]').append(r);
  });
  kit.show(q('[data-names]'), others.length > 0);
  kit.show(q('[data-versions]'), vs.length > 0);
  q('[data-vlist]').append(...shVersionNodes(s));
  kit.show(q('[data-evid]'), !!cert || srcs.length > 0);
  kit.show(q('[data-srcs]'), srcs.length > 0);
  kit.fill(q('[data-srcs]'), { sp: (cert ? ' · ' : '') + 'Sources: ' });
  srcs.forEach((x, i) => {
    const a = kit.tpl('t-bd-src');
    kit.fill(a, { title: x.title });
    a.title = x.citation || '';
    if (/^https?:\/\//i.test(x.url || '')) a.href = x.url;
    else (a.removeAttribute('href'), a.classList.remove('link', 'link-primary'));
    q('[data-srclist]').append(...(i ? [document.createTextNode(', ')] : []), a);
  });
  UI_SWATCHES.forEach((col) => {
    const b = kit.tpl('t-bd-swatch');
    b.dataset.color = col;
    b.style.setProperty('--bd-c', col);
    b.setAttribute('aria-label', 'Colour ' + col);
    b.setAttribute('aria-pressed', String(col === String(s.color).toLowerCase()));
    b.disabled = !can;
    q('[data-swatches]').append(b);
  });
  q('#shColor').value = s.color;
  q('#shOp').value = s.opacity;
  q('#shOpVal').textContent = Math.round(s.opacity * 100) + '%';
  q('#shWidth').value = w;
  q('#shWidthVal').textContent = w + ' px';
  kit.show(q('[data-widthrow]'), kind === 'line');
  q('#shLabel').checked = !!s.label;
  [q('#shColor'), q('#shOp'), q('#shWidth'), q('#shLabel')].forEach((x) => (x.disabled = !can));
  inLy.forEach((ly) => {
    const b = kit.tpl('t-bd-lychip');
    kit.fill(b, { label: lyName(ly, l) });
    b.dataset.lid = ly.id;
    b.querySelector('.bd-dot').style.setProperty('--bd-c', ly.color || '#475b66');
    q('[data-layers]').append(b);
  });
  kit.show(q('[data-addlayer]'), can && free.length > 0);
  free.forEach((ly) => {
    const o = document.createElement('option');
    o.value = ly.id;
    o.textContent = lyName(ly, l);
    q('#shAddLayer').append(o);
  });
  ns.forEach((n) => {
    const a = fields.note({ title: n.title, lang: langName(n.lang), when: n.date ? dateText(n.date) : '', text: n.text });
    if (can) {
      const eb = kit.tpl('t-bd-notebtn');
      eb.dataset.id = n.id;
      a.querySelector('[data-actions]').append(eb);
    }
    q('[data-notes]').append(a);
  });
  kit.show(q('[data-osm]'), !!osm);
  if (osm) q('[data-osmlink]').href = `https://www.openstreetmap.org/${osm[1]}/${osm[2]}`;
  return c;
}
/** Keeps the map and the open row in step with sh.open. */
function shRenderView() {
  const s = sh.open && shapeById(sh.open);
  if (!(rts.open && curTab === 'routes')) AHM.map.highlightShape(s && shOnTab() ? s.id : null); // a route card owns the highlight (routes.js)
  if (sh.form) return; // the form (in its row or full view) owns the row
  const li = s && shOnTab() ? $(`#shList li[data-sid=\"${s.id}\"]`) : null;
  document.querySelectorAll('#shList .bd-open').forEach((x) => x !== li && shFold(x));
  if (li) {
    shExpand(li, s);
    revealRow(li);
  }
}
const shErr = (m) => {
  const el = document.querySelector('#bdPanel #shErr') || document.querySelector('#shErr');
  if (el) el.textContent = m || '';
  else if (m) alert(m);
};
const shBody = (s, o = {}) => ({ id: s.id, names: s.names, type: s.type, color: s.color, opacity: s.opacity, ...(s.width ? { width: s.width } : {}), label: s.label, date_from: s.date_from, date_to: s.date_to, source: s.source || '', ...o });
/** Saves a look change at once (the map is already showing it). */
async function shStyle(s, patch) {
  const old = Object.fromEntries(Object.keys(patch).map((k) => [k, s[k]]));
  Object.assign(s, patch);
  shPush();
  setTimeout(() => AHM.map.previewShape(s.id, null), 500);
  try {
    await postJSON(shUrl().shapeSave, shBody(s));
    shErr('');
  } catch (e) {
    Object.assign(s, old);
    shPush();
    shRenderView();
    shErr(e.message);
  }
}
const shCur = () => sh.open && shapeById(sh.open);
$('#tab-shapes').addEventListener('input', (e) => {
  const s = shCur();
  if (!s || sh.form) return;
  if (e.target.id === 'shColor') AHM.map.previewShape(s.id, { color: e.target.value });
  if (e.target.id === 'shOp') {
    AHM.map.previewShape(s.id, { opacity: +e.target.value });
    $('#shOpVal').textContent = Math.round(e.target.value * 100) + '%';
  }
  if (e.target.id === 'shWidth') $('#shWidthVal').textContent = e.target.value + ' px';
});
$('#tab-shapes').addEventListener('change', async (e) => {
  const s = shCur();
  if (!s || sh.form) return;
  if (e.target.id === 'shColor') shStyle(s, { color: e.target.value });
  else if (e.target.id === 'shOp') shStyle(s, { opacity: +e.target.value });
  else if (e.target.id === 'shWidth') shStyle(s, { width: +e.target.value });
  else if (e.target.id === 'shLabel') shStyle(s, { label: e.target.checked });
  else if (e.target.id === 'shAddLayer' && e.target.value) {
    try {
      await postJSON(shUrl().layerSave, { layer_members: { id: e.target.value, add: [s.id] } });
      await lyReload();
      shRenderView();
    } catch (err) {
      shErr(err.message);
    }
  }
});
$('#tab-shapes').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-shact]');
  if (!b) return;
  const act = b.dataset.shact,
    s = shCur();
  if (act === 'close') return sh.form ? shCancelForm() : shClose();
  if (act === 'save') return shSaveForm();
  if (act === 'cancel') return shCancelForm();
  if (!s) return;
  if (act === 'fit') shFit(s.id);
  else if (act === 'layer') lyOpen(b.dataset.lid);
  else if (act === 'addnote') lyOpenNoteDlg(s, null, 'border');
  else if (act === 'editnote') lyOpenNoteDlg(s, layerNotes.find((n) => n.id === b.dataset.id), 'border');
  else if (act === 'edit') shOpenForm({ id: s.id, kind: shapeKind(s.geometry), ...s });
  else if (act === 'editshape') shStartDraw(shapeKind(s.geometry), s);
  else if (act === 'swatch') shStyle(s, { color: b.dataset.color });
  else if (act === 'version') shOpen(b.dataset.sid, true);
  else if (act === 'addversion') shStartVersion(s);
  else if (act === 'delete') {
    if (!(await dialogs.confirm('delete', { name: shapeName(s, $('#lang').value) }))) return;
    try {
      await postJSON(shUrl().shapeDelete, { id: s.id });
      sh.open = null;
      history.replaceState(null, '', location.pathname + location.search);
      await shReload();
      await lyReload();
    } catch (err) {
      shErr(err.message);
    }
  }
});

$('#tab-shapes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !sh.form) return;
  if (b.dataset.act === 'addname') fields.nameAdd($('#shForm [data-names]'), $('#lang').value);
  else if (b.dataset.act === 'srcadd') shAddSource();
});
$('#tab-shapes').addEventListener('submit', (e) => e.preventDefault());

/** The chips of all versions of a series, the open one marked (oldest first, by the start date); `act` is the data attribute of the click (borders and rivers: shact, routes: rtact). */
function shVersionChips(s, act = 'data-shact="version"') {
  const all = [...shapeVersions(s), s].sort((a, b) => (dateKey(a.date_from) < dateKey(b.date_from) ? -1 : dateKey(a.date_from) > dateKey(b.date_from) ? 1 : 0));
  return all
    .map((v) => (v.id === s.id ? `<span class="chip on" aria-current="true">${esc(shapeWhen(v) || 'no dates')}</span>` : `<button type="button" class="chip" ${act} data-sid="${v.id}">${esc(shapeWhen(v) || 'no dates')}</button>`))
    .join('');
}
/**
 * A new version of a shape for another time (T-041), in one go: the outline opens in the drawing tool, you move the points, press Next, give
 * the dates (names and type are taken over) and save. The version we start from is not changed (except that it ends the day before, if asked).
 * An outline the tool cannot edit (several parts) is taken over as it is and only the details are asked.
 */
function shStartVersion(s) {
  const kind = shapeKind(s.geometry),
    v = { kind, prevId: s.id, series: s.series || shNewUuid(), names: s.names, type: s.type, source: s.source || '', look: { color: s.color, opacity: s.opacity, label: s.label, ...(s.width ? { width: s.width } : {}) } };
  if (!geomToDraw(s.geometry)) return shOpenForm({ ...v, geometry: s.geometry });
  shStartDraw(kind, s, v);
}
// A new UUID (v4) for a series. crypto.randomUUID exists only in a secure context (https or localhost): on a plain-http forum it is undefined,
// which broke "Add version for another time". crypto.getRandomValues works everywhere.
function shNewUuid() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---- the form: names, type, dates (new shape or details of an existing one) ----
/** The source tick boxes of the form; `ticked` = ids. */
function shSrcOpts(ticked) {
  const box = $('#shForm .pf-srcs');
  box.replaceChildren();
  if (!sources.length) {
    const p = document.createElement('p');
    p.className = 'ahm-hint';
    p.textContent = 'No sources yet. Add the first one below.';
    return box.append(p);
  }
  sources.forEach((x) => {
    const n = kit.tpl('t-bd-srcopt'),
      i = n.querySelector('input');
    i.value = x.id;
    i.checked = ticked.includes(x.id);
    kit.fill(n, { title: x.title });
    box.append(n);
  });
}
async function shAddSource() {
  const root = $('#shForm'),
    box = root.querySelector('.pf-newsrc'),
    err = box.querySelector('.pf-srcerr'),
    title = box.querySelector('.pf-st').value.trim();
  err.textContent = '';
  try {
    if (!title) throw Error('Give the source a title.');
    const r = await postJSON(AHM_CONFIG.url.sourceSave, { title, citation: box.querySelector('.pf-sc').value.trim(), url: box.querySelector('.pf-su').value.trim() });
    sources = (await loadSources()).slice();
    shSrcOpts([...root.querySelectorAll('.pf-srcs input')].filter((i) => i.checked).map((i) => i.value).concat(r.id));
    box.querySelectorAll('input').forEach((i) => (i.value = ''));
    box.open = false;
  } catch (e) {
    err.textContent = e.message;
  }
}
function shOpenForm(f) {
  sh.form = f;
  const l = $('#lang').value,
    prev = f.prevId && shapeById(f.prevId),
    inline = !!f.id && !prev,
    names = f.names && f.names.length ? f.names : [{ lang: l || 'en', name: '' }],
    v = kit.tpl('t-bd-formview'),
    q = (x) => v.querySelector(x);
  kit.fill(v, {
    title: prev ? 'New version of “' + shapeName(prev, l) + '”' : f.id ? 'Edit “' + shapeName(f, l) + '”' : sh.mode === 'rivers' ? 'New river' : f.kind === 'area' ? 'New border (area)' : 'New border (line)',
    sub: prev ? `Move the points on the map, then save with the dates when this shape was true. “${shapeWhen(prev) || 'no dates'}” stays as it is.` : f.id ? 'Names, type, dates and sources. The outline is changed with Edit shape.' : 'Name it, choose a type and give the dates it was true.',
    save: prev ? 'Save version' : 'Save',
    langhint: prev ? '' : LANG_HINT,
  });
  fields.nameList(q('[data-names]'), languages.map((x) => ({ code: x.code, name: langName(x.code) })), names);
  const cur = f.type || shTypeList()[0] || 'territory';
  sh.formRefs = {
    type: fields.typePills(shTypeList().map((t) => ({ code: t, name: SHAPE_TYPES[t].label })), cur),
    from: fields.date(f.date_from || null),
    to: fields.date(f.date_to || null),
  };
  sh.formRefs.type._pills.forEach((b) => b.prepend(shIconNode(b.dataset.code))); // the type marker in front of the name, as in s033
  q('[data-type]').append(sh.formRefs.type);
  q('[data-from]').append(sh.formRefs.from);
  q('[data-to]').append(sh.formRefs.to);
  kit.show(q('[data-closeprev]'), !!(prev && !prev.date_to));
  q('.pf-cert').value = f.certainty || '';
  if (inline) {
    // s007: editing happens inside the open card; Save / Cancel take the pinned slot of Add border
    const bar = q('.bd-bar'),
      head = kit.tpl('t-bd-edithead');
    kit.fill(head, { title: sh.mode === 'rivers' ? 'Edit river' : 'Edit border' });
    q('.bd-headcard').replaceWith(head);
    bar.remove();
    sh.formNode = v;
    shView(null);
    shRenderList();
    $('#shAdd').replaceChildren(bar);
    const row = $(`#shList li[data-sid="${f.id}"]`);
    if (row) row.scrollIntoView({ block: 'start' });
  } else shView(v);
  shSrcOpts(f.sources || []);
  tab(sh.mode === 'rivers' ? 'rivers' : 'shapes');
  const n = $('#shForm [data-value=\"name\"]');
  if (n) n.focus({ preventScroll: true });
}
function shReadForm() {
  const root = $('#shForm'),
    r = sh.formRefs,
    names = fields.readNames(root.querySelector('[data-names]'));
  if (!names.length) throw Error('Give the border at least one name.');
  names.forEach((n) => {
    if (!languages.some((l) => l.code === n.lang)) throw Error(`The language “${n.lang || '?'}” is not in the list. Ask an administrator to add it.`);
  });
  const type = r.type.dataset.value;
  if (!type) throw Error('Choose a type. If there is none, an administrator adds one in More > Types.');
  const from = fields.dateRead(r.from, 'Began'),
    to = fields.dateRead(r.to, 'Ended');
  dateOrderCheck(from, to);
  return { names, type, date_from: from, date_to: to, ...evidenceRead(root, false) };
}
async function shSaveForm() {
  const f = sh.form;
  try {
    const v = shReadForm();
    let id = f.id;
    if (id) {
      const s = shapeById(id);
      await postJSON(shUrl().shapeSave, shBody(s, v));
    } else {
      const d = shapeDefaults(v.type, f.kind),
        prev = f.prevId && shapeById(f.prevId);
      if (prev && !prev.series) await postJSON(shUrl().shapeSave, shBody(prev, { series: f.series })); // the shape the copy was made from joins the series first (T-041)
      id = (await postJSON(shUrl().shapeSave, { ...v, ...d, ...(f.look || {}), ...(f.series ? { series: f.series } : {}), source: f.source || '', geometry: f.geometry })).id;
      const end = prev && $('#shClosePrev') && $('#shClosePrev').checked ? versionEndBefore(prev, v.date_from) : null;
      if (end) await postJSON(shUrl().shapeSave, shBody(prev, { date_to: end }));
    }
    sh.form = null;
    sh.formNode = null;
    shRenderAdd();
    AHM.map.showPreview(null);
    await shReload();
    shOpen(id, !f.id);
  } catch (e) {
    shErr(e.message);
  }
}
function shCancelForm() {
  if (!sh.form) return;
  const back = sh.form.prevId;
  sh.form = null;
  sh.formNode = null;
  shRenderAdd();
  AHM.map.showPreview(null);
  shRenderView();
  if (back && shapeById(back)) shOpen(back);
}

// ---- drawing ----
function shStartDraw(kind, existing, version = null) {
  sh.river.clicks = [];
  shCancelForm();
  if (rts.draw) rtCancelDraw();
  if (sh.draw) sh.draw.ctl.remove();
  sh.open = null;
  sh.adding = false;
  shRenderList();
  shRenderView();
  AHM.map.showPreview(null);
  const coords = existing ? geomToDraw(existing.geometry) : [],
    ctl = AHM.map.drawShape({ kind, coords, expand: shRiverLeg }, (g) => shDrawSync(g));
  sh.draw = { mode: version ? 'version' : existing ? 'edit' : 'new', kind, id: existing && !version ? existing.id : null, version, ctl };
  shPush();
  shRenderAdd();
  if (existing) AHM.map.fitTo(bboxCorners(shBox(existing)));
}
/** The point count, the error and the Finish button of the drawing panel follow the outline. */
function shDrawSync(g) {
  const d = sh.draw,
    out = $('#bdPts');
  if (!d || !out) return;
  const n = d.ctl.points().length,
    bad = n > 0 && !g,
    err = $('#shDrawErr');
  out.textContent = n ? `${n} point${n === 1 ? '' : 's'} so far.` : 'No points yet.';
  err.querySelector('[data-bind="err"]').textContent = bad ? (d.kind === 'area' ? 'An area needs at least 3 points.' : 'A line needs at least 2 points.') : '';
  err.hidden = !bad;
  $('#shFinish').disabled = !g;
}
async function shDiscard() {
  const d = sh.draw;
  if (d && d.mode === 'new' && d.ctl.points().length) {
    dialogs.texts['discard-drawing'] = dialogs.texts['discard-drawing'] || { title: () => 'Discard this drawing?', body: () => 'The points you clicked are lost.', ok: 'Discard', danger: true };
    if (!(await dialogs.confirm('discard-drawing'))) return;
  }
  shCancelDraw();
}
const shRiverMsg = (m) => ($('#shRiverMsg') ? ($('#shRiverMsg').textContent = m) : $('#shAddMsg') ? ($('#shAddMsg').textContent = m) : 0);
/** Finds rivers by name on OpenStreetMap: several can come back. They are only shown on the map and used by the drawing tool, never saved. */
async function shRiverFind(q) {
  const rv = sh.river;
  q = (q || '').trim();
  if (!q) return;
  rv.q = q;
  shRiverMsg('Searching…');
  try {
    const rs = await geocodeShapes(q, $('#lang').value, 0.0005);
    rv.res = rs.filter((r) => /LineString$/.test(r.geometry.type) && (!r.kind || ['river', 'stream', 'canal', 'drain', 'ditch', 'brook', 'waterway'].includes(r.kind))); // only waterways, not villages or boundaries of the same name
    rv.lines = rv.res.map((r) => r.geometry);
    shRiverShow(null);
    shRiverMsg(rv.lines.length ? '' : 'No river line found. Try another spelling.');
  } catch (e) {
    shRiverMsg(e.message);
  }
  if ($('#shRvRes')) shRenderRivers();
}
/** Shows one found river (index) or all of them (null) on the map as a blue draft. */
function shRiverShow(i) {
  const L = i == null ? sh.river.lines : [sh.river.lines[i]];
  AHM.map.showPreview(L.length ? { type: 'MultiLineString', coordinates: L.flatMap(geomLines) } : null);
}
function shRenderRivers() {
  const ul = $('#shRvRes');
  if (!ul) return;
  const rs = sh.river.res;
  ul.innerHTML = rs
    .map((r, i) => `<li data-i="${i}"><div class="t"><b>${esc(r.name.split(',').slice(0, 2).join(','))}</b></div><div class="sn">${esc(r.name)} · ${geomCount(r.geometry)} points</div></li>`)
    .join('');
  if (rs.length) ul.insertAdjacentHTML('beforeend', '<li class="empty">These rivers are only shown, not saved. Draw a river and follow one to save a section.</li>');
}
/** Like the road of a route: the points of the river between two clicks (called by the drawing tool for every click after the first). */
async function shRiverLeg(a, b) {
  const rv = sh.river;
  if (!rv.on || !sh.draw || sh.draw.kind !== 'line' || sh.draw.mode !== 'new') return null;
  // the river whose line passes nearest to both clicks (within RIVER_CLICK_KM); its name is told, so a wrong river is seen at once
  const cut = () =>
    rv.res
      .map((r) => ({ ...riverSection(r.geometry, a, b), name: r.name.split(',').slice(0, 2).join(',') }))
      .filter((r) => r.coords)
      .sort((x, y) => x.offKm - y.offKm)[0];
  let best = cut();
  if (!best) {
    // no river loaded near these clicks: take the name of the river under them from the base map and find it on OpenStreetMap
    const nm = AHM.map.riverNameAt(a) || AHM.map.riverNameAt(b);
    if (nm) {
      shRiverMsg(`Looking for ${nm}…`);
      await shRiverFind(nm);
      best = cut();
    }
  }
  if (!best) return shRiverMsg('No river found at these two points: a straight line was used. Click right on the river, or type its name above.'), null;
  rv.clicks.push(a, b); // only a click that got a section is dropped from the line at the end (the section starts and ends on the river)
  shRiverMsg(`River section of ${best.km.toFixed(1)} km (${best.name}). Click again to continue along it, or Finish.`);
  return best.coords;
}
async function shFinishDraw() {
  const d = sh.draw;
  let g = d.ctl.getGeometry();
  if (!g) return shDrawSync(g);
  const rv = sh.river;
  if (d.mode === 'new' && d.kind === 'line' && rv.on && rv.clicks.length) {
    // the clicks only told where on the river to start and stop: the line keeps the points of the river itself
    const raw = new Set(rv.clicks.map((c) => c.join())),
      kept = d.ctl.points().filter((p) => !raw.has(p.join()));
    if (kept.length >= 2) g = { type: 'LineString', coordinates: kept };
  }
  d.ctl.remove();
  sh.draw = null;
  if (d.mode === 'version') {
    shRenderAdd();
    AHM.map.showPreview(g);
    return shOpenForm({ ...d.version, geometry: g });
  }
  if (d.mode === 'new') {
    shRenderAdd();
    AHM.map.showPreview(g);
    return shOpenForm({ id: null, kind: d.kind, geometry: g, ...(sh.mode === 'rivers' ? { type: RIVER_TYPE_LIST[0] } : {}) });
  }
  try {
    await postJSON(shUrl().shapeSave, shBody(shapeById(d.id), { geometry: g }));
  } catch (e) {
    alert(e.message);
  }
  await shReload();
  shRenderAdd();
  shOpen(d.id);
}
function shCancelDraw() {
  const d = sh.draw;
  if (!d) return;
  d.ctl.remove();
  sh.draw = null;
  shPush();
  shRenderAdd();
  if (d.id) shOpen(d.id);
  else if (d.version && shapeById(d.version.prevId)) shOpen(d.version.prevId);
}
AHM.on('draw:finish', () => sh.draw && shFinishDraw());
AHM.on('draw:cancel', () => sh.draw && shCancelDraw());
AHM.on('shape:click', ({ id }) => (lyState.editing ? lyToggleMember(id) : shOpen(id)));

// ---- adding: OpenStreetMap search, drawing, a file ----
function shRenderAdd() {
  const box = $('#shAdd');
  if (sh.form) return; // the form view is up (shOpenForm)
  if (!shCan() && sh.mode !== 'rivers') return shView(null), (box.textContent = '');
  if (sh.draw) {
    const d = sh.draw,
      p = kit.tpl('t-bd-draw'),
      line = d.kind === 'line' && d.mode === 'new';
    kit.fill(p, {
      title: d.mode === 'version' ? 'New version: move the points' : d.mode === 'edit' ? 'Editing the shape' : d.kind === 'area' ? 'Drawing an area' : sh.mode === 'rivers' ? 'Drawing a river' : 'Drawing a line',
      vnote: 'The outline you started from is not changed. Move the points to the outline for the other time, then press Next to give its dates.',
    });
    p.querySelector('[data-bind="vnote"]').hidden = d.mode !== 'version';
    kit.show(p.querySelector('[data-river]'), line);
    p.querySelector('#shRiverOn').checked = sh.river.on;
    kit.show(p.querySelector('[data-riverq]'), sh.river.on);
    p.querySelector('#shRiverQ').value = sh.river.q;
    p.querySelector('#shRiverMsg').textContent = sh.river.on ? (sh.river.lines.length ? sh.river.lines.length + ' river lines loaded (blue). Click near the start, then near the end. ' : '') + 'Type the river name and press Find.' : '';
    p.querySelector('#shFinish').textContent = d.mode === 'version' ? 'Next: dates' : d.mode === 'edit' ? 'Save shape' : 'Finish';
    box.textContent = '';
    shView(p);
    shDrawSync(d.ctl.getGeometry());
  } else if (sh.mode === 'rivers') {
    shView(null);
    box.innerHTML =
      `<div class="sh-banner"><b>Find rivers</b><div class="sn">Search OpenStreetMap by name. Several rivers can be found; they are only shown (blue), not saved.</div>` +
      `<div class="row"><input type="text" id="shRvQ" placeholder="River name, e.g. Araks" value="${esc(sh.river.q)}"><button type="button" data-shadd="rvfind">Find</button></div><ul id="shRvRes"></ul><div class="err-line" id="shAddMsg"></div></div>` +
      (shCan()
        ? `<button type="button" class="wide" data-shadd="drawline">+ Draw a river</button><div class="row"><button type="button" data-shadd="import">GeoJSON file…</button></div><input type="file" id="shFile" accept=".geojson,.json,application/geo+json,application/json" hidden>`
        : '');
    shRenderRivers();
  } else if (sh.adding) {
    box.textContent = '';
    shView(kit.tpl('t-bd-add'));
    $('#shGeoQ').value = sh.geoQ;
    shRenderGeo();
  } else {
    shView(null);
    box.replaceChildren(kit.tpl('t-bd-addbtn'));
  }
}
const shMsg = (m, info) => {
  const el = $('#shAddMsg');
  if (!el) return;
  el.textContent = m || '';
  el.classList.toggle('alert-info', !!info);
  el.classList.toggle('alert-error', !info);
};
function shRenderGeo() {
  const box = $('#shGeoRes');
  if (!box) return;
  box.replaceChildren(
    ...sh.geo.map((r, i) => {
      const n = kit.tpl('t-bd-geo'),
        ty = guessShapeType(r),
        parts = r.name.split(',').map((x) => x.trim());
      n.dataset.i = i;
      n.querySelector('[data-shadd="geoadd"]').dataset.i = i;
      n.querySelector('[data-icon]').append(shIconNode(ty));
      kit.fill(n, { title: parts[0], sub: SHAPE_TYPES[ty].label + (parts.length > 1 ? ' · ' + parts[parts.length - 1] : '') });
      return n;
    })
  );
}
async function shSearch() {
  const q = $('#shGeoQ').value.trim(),
    box = $('#shGeoRes');
  sh.geoQ = q;
  if (!q) return;
  sh.geo = [];
  kit.state(box, 'loading', 'Searching…');
  try {
    sh.geo = await geocodeShapes(q, $('#lang').value);
    if (!sh.geo.length) return kit.state(box, 'empty', 'Nothing with an outline found. Try another spelling, or draw it.');
    shRenderGeo();
  } catch (e) {
    kit.state(box, 'down', e.message, shSearch);
  }
}
/** Names for a search result: every language of the dictionary that OpenStreetMap knows, or the plain name. */
function shOsmNames(r) {
  const codes = languages.map((l) => l.code),
    out = codes.filter((c) => r.names['name:' + c]).map((c) => ({ lang: c, name: r.names['name:' + c] }));
  if (!out.length) out.push({ lang: codes.includes('en') ? 'en' : codes[0], name: r.names.name || r.name.split(',')[0] });
  return out;
}
async function shCreate(body) {
  const d = shapeDefaults(body.type, shapeKind(body.geometry));
  return (await postJSON(shUrl().shapeSave, { ...d, ...body })).id;
}
async function shAddOsm(i) {
  const r = sh.geo[i];
  shMsg('Adding…', true);
  try {
    const id = await shCreate({ names: shOsmNames(r), type: guessShapeType(r), date_from: null, date_to: null, source: 'osm:' + r.osm, geometry: simplifyGeometry(r.geometry) });
    AHM.map.showPreview(null);
    sh.adding = false;
    await shReload();
    shRenderAdd();
    shOpen(id, true);
  } catch (e) {
    shMsg(e.message);
  }
}
async function shImport(file) {
  try {
    const j = JSON.parse(await file.text()),
      feats = (j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [{ geometry: j, properties: {} }]).filter(
        (f) => f && f.geometry && /^(Multi)?(Polygon|LineString)$/.test(f.geometry.type)
      );
    if (!feats.length) return shMsg('No areas or lines found in this file.');
    if (feats.length > 100) return shMsg(`The file has ${feats.length} shapes; the limit is 100 at once. Split it.`);
    if (!(await dialogs.confirm('import', { count: feats.length, type: (SHAPE_TYPES[shTypeList()[0]] || { label: 'Territory or area' }).label }))) return;
    const lang = languages.some((l) => l.code === 'en') ? 'en' : languages[0].code;
    let n = 0,
      last = null;
    for (const f of feats) {
      const p = f.properties || {},
        name = String(p.name || p.NAME || p['name:en'] || p.title || p.admin || '').trim() || 'Imported border ' + (n + 1);
      last = await shCreate({ names: [{ lang, name: name.slice(0, 200) }], type: shTypeList()[0] || 'territory', date_from: null, date_to: null, source: '', geometry: simplifyGeometry(f.geometry) });
      shMsg(`Imported ${++n} of ${feats.length}…`, true);
    }
    sh.adding = false;
    await shReload();
    shRenderAdd();
    shOpen(last, true);
  } catch (e) {
    shMsg('Import failed: ' + e.message);
  }
}
$('#tab-shapes').addEventListener('click', (e) => {
  const li = e.target.closest('#shGeoRes .bd-geo');
  const b = e.target.closest('[data-shadd]');
  if (!b && li) {
    const r = sh.geo[li.dataset.i];
    AHM.map.showPreview(r.geometry);
    return AHM.map.fitTo(bboxCorners(geomBBox(r.geometry)));
  }
  if (!b) return;
  const a = b.dataset.shadd;
  if (a === 'open') (sh.adding = true), shRenderAdd();
  else if (a === 'closeadd') (sh.adding = false), AHM.map.showPreview(null), shRenderAdd();
  else if (a === 'search') shSearch();
  else if (a === 'riverfind') shRiverFind($('#shRiverQ').value);
  else if (a === 'rvfind') shRiverFind($('#shRvQ').value);
  else if (a === 'geoadd') shAddOsm(+b.dataset.i);
  else if (a === 'drawarea') shStartDraw('area');
  else if (a === 'drawline') shStartDraw('line');
  else if (a === 'import') $('#shFile').click();
  else if (a === 'undo') sh.draw.ctl.undo();
  else if (a === 'finish') shFinishDraw();
  else if (a === 'canceldraw') shDiscard();
});
$('#tab-shapes').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'shGeoQ') shSearch();
  else if (e.target.id === 'shRvQ') shRiverFind(e.target.value);
  else if (e.target.id === 'shRiverQ') e.stopPropagation(), shRiverFind(e.target.value);
});
// a found river: show it alone on the map
$('#tab-shapes').addEventListener('click', (e) => {
  const li = e.target.closest('#shRvRes li[data-i]');
  if (li) shRiverShow(+li.dataset.i);
});
$('#tab-shapes').addEventListener('change', (e) => {
  if (e.target.id === 'shRiverOn') (sh.river.on = e.target.checked), shRenderAdd();
  if (e.target.id === 'shFile' && e.target.files[0]) shImport(e.target.files[0]);
  if (e.target.id === 'shFile') e.target.value = '';
});

/** Called once the data is loaded. */
function shSet(list) {
  shapes = list;
  sh.loaded = true; // the list leaves its loading skeleton at the next update()
  shRenderAdd();
}

// ---- select rivers (T-057): by a rectangle on the map or by the name of an area; the selection can be zoomed to, kept alone on the map ----
const rvBoxBtn = () => ($('#rvBox').textContent = sh.boxOn ? 'Drag on the map (Esc cancels)' : 'Select by rectangle');
const rvIsBase = (id) => id.startsWith('b:');
/** The ids of every river that touches `area` (a box or a geometry): the ones you added, then the rivers of the base map that are loaded in the view. */
function rvFound(area) {
  const mode = $('#rvInside').checked ? 'inside' : 'cross',
    base = AHM.map.baseRivers(),
    own = riversTouching(shapes.filter(isRiver), area, mode),
    ids = riversTouching(base, area, mode);
  ids.forEach((id) => sh.rbase.set(id, base.find((b) => b.id === id)));
  return { ids: [...own, ...ids], base: ids.length };
}
function rvSync() {
  [...sh.rsel].forEach((id) => (rvIsBase(id) ? sh.rbase.has(id) : shapeById(id)) || sh.rsel.delete(id)); // a river that was deleted leaves the selection
  if (!sh.rsel.size) sh.rOnly = false;
  const l = $('#lang').value,
    nameOf = (id) => (rvIsBase(id) ? sh.rbase.get(id).name : shapeName(shapeById(id), l));
  $('#rvCount').textContent = sh.rsel.size + ' selected';
  $('#rvOnly').textContent = sh.rOnly ? 'Show all rivers' : 'Show only these';
  $('#rvSelList').innerHTML = [...sh.rsel]
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    .map((id) => `<li data-sid="${esc(id)}"><b>${esc(nameOf(id))}</b>${rvIsBase(id) ? ' <span class="sn">map</span>' : ''} <button type="button" class="icon-btn" data-rvdel="${esc(id)}" title="Remove from the selection" aria-label="Remove from the selection">×</button></li>`)
    .join('');
  AHM.map.highlightRivers([...sh.rsel].sort((a, b) => rvIsBase(a) - rvIsBase(b))); // your rivers first
  shPush();
}
/** Adds the rivers found; says how many were new. */
function rvAdd(found, what) {
  const n = sh.rsel.size;
  found.ids.forEach((id) => sh.rsel.add(id));
  $('#rvMsg').textContent = `${sh.rsel.size - n} new of ${found.ids.length} rivers found${what ? ' for ' + what : ''}.${found.base ? ' Base-map rivers: only those with a name that are loaded in the view; zoom to the area first.' : ''}`;
  rvSync();
}
$('#rvBox').addEventListener('click', () => {
  sh.boxOn = !sh.boxOn;
  AHM.map.selectBox(sh.boxOn);
  rvBoxBtn();
});
AHM.on('box:select', ({ bbox }) => {
  sh.boxOn = false;
  rvBoxBtn();
  rvAdd(rvFound(bbox));
});
AHM.on('box:cancel', () => {
  sh.boxOn = false;
  rvBoxBtn();
});
$('#rvArea').addEventListener('input', (e) => {
  const l = $('#lang').value;
  $('#rvAreaRes').innerHTML = areasByName(shapes, e.target.value)
    .slice(0, 8)
    .map((a) => `<button type="button" data-area="${a.id}">${esc(shapeName(a, l))} <span class="sn">${esc(shapeType(a.type).label)}</span></button>`)
    .join('');
});
$('#rvAreaRes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-area]'),
    a = b && shapeById(b.dataset.area);
  if (!a) return;
  rvAdd(rvFound(a.geometry), shapeName(a, $('#lang').value));
  $('#rvArea').value = '';
  $('#rvAreaRes').innerHTML = '';
});
$('#rvSelList').addEventListener('click', (e) => {
  const x = e.target.closest('[data-rvdel]'),
    li = e.target.closest('li[data-sid]');
  if (x) (sh.rsel.delete(x.dataset.rvdel), rvSync());
  else if (li && !rvIsBase(li.dataset.sid)) shOpen(li.dataset.sid, true);
});
$('#rvClear').addEventListener('click', () => {
  sh.rsel.clear();
  sh.rbase.clear();
  $('#rvMsg').textContent = '';
  rvSync();
});
$('#rvOnly').addEventListener('click', () => {
  sh.rOnly = !sh.rOnly;
  rvSync();
});
$('#rvZoom').addEventListener('click', () => {
  const pts = [...sh.rsel].flatMap((id) => bboxCorners(rvIsBase(id) ? geomBBox(sh.rbase.get(id).geometry) : shBox(shapeById(id))));
  if (pts.length) AHM.map.fitTo(pts);
});
