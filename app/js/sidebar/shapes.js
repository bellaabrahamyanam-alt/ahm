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
  rsel: new Set(), // the selected rivers (T-057), by id; this session only
  rbase: new Map(), // the selected rivers of the base map: "b:<name>" -> { id, name, geometry }
  rOnly: false, // "Show only these": the map draws only the selected rivers
  boxOn: false, // the rectangle tool of the map is on
  river: { on: false, seen: false, q: '', lines: [], clicks: [], res: [] }, // rivers: the river lines found by name (only used for drawing and looking, never saved) and the clicks they were used for
};
const shCan = () => AHM_CONFIG.canEdit;
const shBox = (s) => s._box || (s._box = geomBBox(s.geometry));
const shUrl = () => AHM_CONFIG.url;
const shBtn = (act, icon, text, extra = '') =>
  `<button type="button" class="icon-btn" data-shact="${act}" ${extra} title="${text}" aria-label="${text}">${AHM.icons.svg(icon, 16)}</button>`;

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
  const c = {};
  shapes.filter((s) => shapeGroup(s) === SH_GROUP[sh.mode]).forEach((s) => (c[s.type] = (c[s.type] || 0) + 1));
  $('#shTypes').innerHTML = shTypeList().filter((t) => c[t] || sh.types.has(t))
    .map((t) => `<button class="chip${sh.types.has(t) ? ' on' : ''}" data-t="${t}">${shIcon(t)}${esc(SHAPE_TYPES[t].label)} <span>${c[t] || 0}</span></button>`)
    .join('');
}
function shRenderList() {
  const l = $('#lang').value,
    rows = shVisible();
  shRenderTypes();
  $('#shCount').textContent = rows.length + ' of ' + shapes.filter((s) => shapeGroup(s) === SH_GROUP[sh.mode]).length + ' ' + shWord();
  $('#shList').innerHTML = rows.length
    ? rows
        .map((s) => {
          const t = shapeType(s.type),
            when = shapeWhen(s);
          return (
            `<li data-sid="${s.id}"${sh.open === s.id ? ' class="on"' : ''}><div class="t"><span class="tmark" title="${esc(t.label)}">${shIcon(s.type)}</span><b>${esc(shapeName(s, l))}</b>` +
            `<label class="sh-eye" title="Show on the map"><input type="checkbox" data-vis="${s.id}"${sh.hidden.has(s.id) ? '' : ' checked'} aria-label="Show on the map"></label></div>` +
            `<div class="sn">${esc(t.label)} · ${shapeKind(s.geometry) === 'area' ? 'area' : 'line'}${when ? ' · ' + esc(when) : ''}</div>` +
            (nameMatch(s, sh.modes[sh.mode].q, l) ? `<div class="sn">also called ${esc(nameMatch(s, sh.modes[sh.mode].q, l))}</div>` : '') + // an old name found by the search (T-043)
            '</li>'
          );
        })
        .join('')
    : `<li class="empty">${shapes.some((s) => shapeGroup(s) === SH_GROUP[sh.mode]) ? `No ${shWord()} match. Try fewer filters.` : `No ${shWord()} yet.`}</li>`;
}
$('#shList').addEventListener('click', (e) => {
  if (e.target.closest('.sh-eye')) return;
  const li = e.target.closest('li[data-sid]');
  if (!li || e.detail > 1) return;
  sh.open === li.dataset.sid && !sh.form ? shClose() : shOpen(li.dataset.sid);
});
$('#shList').addEventListener('dblclick', (e) => {
  const li = e.target.closest('li[data-sid]');
  if (li && !e.target.closest('.sh-eye')) shOpen(li.dataset.sid, true);
});
$('#shList').addEventListener('change', (e) => {
  const id = e.target.dataset.vis;
  if (!id) return;
  e.target.checked ? sh.hidden.delete(id) : sh.hidden.add(id);
  shPush();
});
$('#shTypes').addEventListener('click', (e) => {
  const b = e.target.closest('.chip[data-t]');
  if (!b) return;
  sh.types.has(b.dataset.t) ? sh.types.delete(b.dataset.t) : sh.types.add(b.dataset.t);
  shRefresh();
});
document.addEventListener('input', (e) => e.target.id === 'shQ' && shRefresh());
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
/** The card of the open shape: look (saved at once), layers, source; below it the buttons for the details. */
function shRenderView() {
  const s = sh.open && shapeById(sh.open),
    d = $('#shDetail');
  if (!(rts.open && curTab === 'routes')) AHM.map.highlightShape(s && shOnTab() ? s.id : null); // a route card owns the highlight (routes.js)
  document.querySelectorAll('#shList li.on').forEach((x) => x.classList.remove('on'));
  if (sh.form) return shShow(shOnTab());
  if (!s || !shOnTab()) return shShow(false);
  const li = $(`#shList li[data-sid="${s.id}"]`),
    l = $('#lang').value,
    t = shapeType(s.type),
    kind = shapeKind(s.geometry),
    can = shCan(),
    dis = can ? '' : ' disabled',
    when = shapeWhen(s),
    others = s.names.filter((n) => n.name !== shapeName(s, l)),
    inLy = layers.filter((ly) => lyMembers[ly.id] && lyMembers[ly.id].has(s.id)),
    free = layers.filter((ly) => !inLy.includes(ly)),
    osm = /^osm:(node|way|relation)\/(\d+)$/.exec(s.source || '');
  if (li) li.classList.add('on');
  d.innerHTML =
    `<div class="dock-head"><span class="tmark" title="${esc(t.label)}">${shIcon(s.type)}</span><h3 class="dock-title">${esc(shapeName(s, l))}</h3><span class="dock-btns">` +
    (can ? shBtn('edit', 'pencil', 'Edit names, type and dates') : '') +
    shBtn('close', 'close', 'Close') +
    `</span></div><div class="dock-body">` +
    (others.length ? `<div class="sn">${others.map((n) => `${esc(n.name)} <span class="sn">(${esc(n.lang)})</span>`).join(' · ')}</div>` : '') +
    `<div class="sn">${esc(t.label)} · ${kind === 'area' ? 'area' : 'line'}${when ? ' · ' + esc(when) : ''}</div>` +
    (shapeVersions(s).length
      ? `<div class="label">Versions in time (${shapeVersions(s).length + 1})</div><div class="chips">${shVersionChips(s)}</div>`
      : '') +
    evidenceHTML(s) + // certainty and sources (T-046)
    `<div class="label">Look</div><div class="sh-look">` +
    `<label>Colour <input type="color" id="shColor" value="${esc(s.color)}"${dis}></label>` +
    `<label>${kind === 'area' ? 'Fill opacity' : 'Line opacity'} <input type="range" id="shOp" min="0" max="1" step="0.05" value="${s.opacity}"${dis}> <span id="shOpVal">${Math.round(s.opacity * 100)}%</span></label>` +
    (kind === 'line' ? `<label>Width <input type="range" id="shWidth" min="0.5" max="12" step="0.5" value="${s.width || t.width}"${dis}> <span id="shWidthVal">${s.width || t.width} px</span></label>` : '') +
    `<label class="sh-check"><input type="checkbox" id="shLabel"${s.label ? ' checked' : ''}${dis}> Show the name on the map</label></div>` +
    `<div class="label">In layers</div><div class="chips">` +
    (inLy.length ? inLy.map((ly) => `<button class="chip ly-chip" data-shact="layer" data-lid="${ly.id}"${ly.color ? ` style="--a:${esc(ly.color)}"` : ''}>${esc(lyName(ly, l))}</button>`).join('') : '<span class="sn">None yet.</span>') +
    `</div>` +
    (can && free.length ? `<select id="shAddLayer" aria-label="Add to a layer"><option value="">Add to a layer…</option>${free.map((ly) => `<option value="${ly.id}">${esc(lyName(ly, l))}</option>`).join('')}</select>` : '') +
    lyOwnerNotesHTML(s.id, l, 'shact') +
    (osm ? `<div class="sn">Outline © <a href="https://www.openstreetmap.org/${osm[1]}/${osm[2]}" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL).</div>` : '') +
    `<div class="err-line" id="shErr"></div></div><div class="dock-foot">` +
    `<button type="button" data-shact="fit">Fit map</button>` +
    (can ? `${geomToDraw(s.geometry) ? '<button type="button" data-shact="editshape">Edit shape</button>' : ''}<button type="button" data-shact="addversion" title="Move the points to the outline for another time. The outline you see now stays as it is.">New version…</button><button type="button" class="danger" data-shact="delete">Delete</button>` : '') +
    `</div>`;
  shShow(true);
  if (li) revealRow(li);
}
const shErr = (m) => ($('#shErr') ? ($('#shErr').textContent = m || '') : m && alert(m));
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
$('#shDetail').addEventListener('input', (e) => {
  const s = shCur();
  if (!s || sh.form) return;
  if (e.target.id === 'shColor') AHM.map.previewShape(s.id, { color: e.target.value });
  if (e.target.id === 'shOp') {
    AHM.map.previewShape(s.id, { opacity: +e.target.value });
    $('#shOpVal').textContent = Math.round(e.target.value * 100) + '%';
  }
  if (e.target.id === 'shWidth') $('#shWidthVal').textContent = e.target.value + ' px';
});
$('#shDetail').addEventListener('change', async (e) => {
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
$('#shDetail').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-shact]');
  if (!b) return;
  const act = b.dataset.shact,
    s = shCur();
  if (act === 'close') return sh.form ? shCancelForm() : shClose();
  if (act === 'typepick') {
    b.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    return;
  }
  if (act === 'save') return shSaveForm();
  if (act === 'cancel') return shCancelForm();
  if (!s) return;
  if (act === 'fit') shFit(s.id);
  else if (act === 'layer') lyOpen(b.dataset.lid);
  else if (act === 'addnote') lyOpenNoteDlg(s, null, 'border');
  else if (act === 'editnote') lyOpenNoteDlg(s, layerNotes.find((n) => n.id === b.dataset.id), 'border');
  else if (act === 'edit') shOpenForm({ id: s.id, kind: shapeKind(s.geometry), ...s });
  else if (act === 'editshape') shStartDraw(shapeKind(s.geometry), s);
  else if (act === 'version') shOpen(b.dataset.sid, true);
  else if (act === 'addversion') shStartVersion(s);
  else if (act === 'delete') {
    if (!confirm(`Delete “${shapeName(s, $('#lang').value)}”? It also leaves its layers. A copy of the old file stays in the archive on the server.`)) return;
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
const shTypeChips = (cur) =>
  shTypeList().map((t) => `<button type="button" class="chip${t === cur ? ' on' : ''}" data-shact="typepick" data-t="${t}" title="${esc(SHAPE_TYPES[t].label)}">${shIcon(t)}${esc(SHAPE_TYPES[t].label)}</button>`)
    .join('');
const shVersionHint = (f) => {
  const p = shapeById(f.prevId);
  return `<div class="sn">The outline you just drew is saved as a new version of the same ${f.kind === 'area' ? 'border' : 'line'}. “${esc(shapeWhen(p) || 'no dates')}” stays as it is. Give the dates of the new one; names and type are taken over, change them if they differ.</div>`;
};
function shOpenForm(f) {
  sh.form = f;
  const names = f.names && f.names.length ? f.names : [{ lang: $('#lang').value || 'en', name: '' }];
  $('#shDetail').innerHTML =
    `<div class="dock-head"><span class="tmark">${shIcon(f.type || shTypeList()[0] || 'territory')}</span><h3 class="dock-title">${f.prevId ? 'New version of “' + esc(shapeName(shapeById(f.prevId), $('#lang').value)) + '”' : f.id ? 'Edit details' : sh.mode === 'rivers' ? 'New river' : f.kind === 'area' ? 'New border (area)' : 'New border (line)'}</h3><span class="dock-btns">${shBtn('cancel', 'close', 'Cancel')}</span></div>` +
    `<div class="dock-body">${f.prevId ? shVersionHint(f) : ''}<div class="pf" id="shForm"><div class="label">Names</div><div class="pf-names" data-dated="1">${names.map((n) => pfRowDated(n)).join('')}</div>` +
    `<button type="button" class="pf-add">+ Add another name</button><div class="sn">${LANG_HINT}</div>` +
    `<div class="label">Type</div><div class="chips sh-typepick">${shTypeChips(f.type || shTypeList()[0] || 'territory')}</div>` +
    `<div class="sn">The type sets the line pattern and the first colour. You can change the colour afterwards.</div>` +
    `<div class="label">Dates (optional)</div><div class="sn">Leave “Unknown” for a modern border or when you do not know. Borders with dates follow the period filter.</div>` +
    `<div class="pf-sub">Began</div>${dfHTML('pf-from', f.date_from || null)}<div class="pf-sub">Ended</div>${dfHTML('pf-to', f.date_to || null)}${f.prevId && !shapeById(f.prevId).date_to ? '<label class="sh-check"><input type="checkbox" id="shClosePrev" checked> End the previous version the day before</label>' : ''}` +
    evidenceFormHTML(f, false) + // certainty and sources (T-046), inside #shForm so that shReadForm finds it
    '</div>' +
    `<div class="err-line" id="shErr"></div></div><div class="dock-foot"><button type="button" class="primary" data-shact="save">Save</button><button type="button" data-shact="cancel">Cancel</button></div>`;
  shShow(true);
  tab(sh.mode === 'rivers' ? 'rivers' : 'shapes');
  const n = $('#shForm .nn');
  if (n) n.focus();
}
placeFormWire($('#shDetail')); // the add / remove name buttons and the date fields (once; the form is drawn many times)
function shReadForm() {
  const root = $('#shForm'),
    names = pfReadNames(root);
  if (!names.length) throw Error('Give the border at least one name.');
  names.forEach((n) => {
    if (!languages.some((l) => l.code === n.lang)) throw Error(`The language “${n.lang || '?'}” is not in the list. Ask an administrator to add it.`);
  });
  const chip = root.querySelector('.sh-typepick .chip.on');
  if (!chip) throw Error('Choose a type. If there is none, an administrator adds one in More > Types.');
  const type = chip.dataset.t,
    from = dfRead(root.querySelector('.pf-from'), 'Began'),
    to = dfRead(root.querySelector('.pf-to'), 'Ended');
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
    ctl = AHM.map.drawShape({ kind, coords, expand: shRiverLeg }, (g) => {
      const f = $('#shFinish');
      if (f) f.disabled = !g;
    });
  sh.draw = { mode: version ? 'version' : existing ? 'edit' : 'new', kind, id: existing && !version ? existing.id : null, version, ctl };
  shPush();
  shRenderAdd();
  if (existing) AHM.map.fitTo(bboxCorners(shBox(existing)));
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
  if (!g) return ($('#shAddMsg').textContent = d.kind === 'area' ? 'An area needs at least 3 points.' : 'A line needs at least 2 points.');
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
  if (!shCan() && sh.mode !== 'rivers') {
    box.innerHTML = '';
    return;
  }
  if (sh.draw) {
    const d = sh.draw;
    box.innerHTML =
      `<div class="sh-banner"><b>${d.mode === 'version' ? 'New version: move the points' : d.mode === 'edit' ? 'Editing the shape' : d.kind === 'area' ? 'Drawing an area' : sh.mode === 'rivers' ? 'Drawing a river' : 'Drawing a line'}</b>` +
      (d.mode === 'version' ? `<div class="sn">The outline you started from is not changed. Move the points to the outline for the other time, then press Next to give its dates.</div>` : '') +
      `<div class="sn">Click the map to add points. Drag a point to move it, right-click to remove it, Backspace undoes. Enter or a double click finishes, Esc cancels.</div>` +
      (d.kind === 'line' && d.mode === 'new'
        ? `<label class="sh-check"><input type="checkbox" id="shRiverOn"${sh.river.on ? ' checked' : ''}> Follow a river between the points I click</label>` +
          (sh.river.on
            ? `<div class="row"><input type="text" id="shRiverQ" placeholder="River name, e.g. Araks" value="${esc(sh.river.q)}"><button type="button" data-shadd="riverfind">Find</button></div>` +
              `<div class="sn" id="shRiverMsg">${sh.river.lines.length ? sh.river.lines.length + ' river line(s) loaded (blue). Click near the start, then near the end.' : 'Type the river name and press Find.'}</div>`
            : '')
        : '') +
      `<div class="row"><button type="button" data-shadd="undo">Undo</button><button type="button" class="primary" id="shFinish" data-shadd="finish"${d.ctl.getGeometry() ? '' : ' disabled'}>${d.mode === 'version' ? 'Next: dates' : d.mode === 'edit' ? 'Save shape' : 'Finish'}</button>` +
      `<button type="button" data-shadd="canceldraw">Cancel</button></div><div class="err-line" id="shAddMsg"></div></div>`;
  } else if (sh.mode === 'rivers') {
    box.innerHTML =
      `<div class="sh-banner"><b>Find rivers</b><div class="sn">Search OpenStreetMap by name. Several rivers can be found; they are only shown (blue), not saved.</div>` +
      `<div class="row"><input type="text" id="shRvQ" placeholder="River name, e.g. Araks" value="${esc(sh.river.q)}"><button type="button" data-shadd="rvfind">Find</button></div><ul id="shRvRes"></ul><div class="err-line" id="shAddMsg"></div></div>` +
      (shCan()
        ? `<button type="button" class="wide" data-shadd="drawline">+ Draw a river</button><div class="row"><button type="button" data-shadd="import">GeoJSON file…</button></div><input type="file" id="shFile" accept=".geojson,.json,application/geo+json,application/json" hidden>`
        : '');
    shRenderRivers();
  } else if (sh.adding) {
    box.innerHTML =
      `<div class="sh-banner"><b>Add a border</b><div class="label">Find it on OpenStreetMap</div>` +
      `<div class="row">${searchFieldHTML('shGeoQ', 'Country, region, district…')}<button type="button" data-shadd="search">Search</button></div><ul id="shGeoRes"></ul>` +
      `<div class="label">Or draw it</div><div class="row"><button type="button" data-shadd="drawarea">${AHM.icons.svg('area', 16)} Draw an area</button><button type="button" data-shadd="drawline">${AHM.icons.svg('line', 16)} Draw a line</button></div>` +
      `<div class="label">Or import it</div><button type="button" data-shadd="import">GeoJSON file…</button><input type="file" id="shFile" accept=".geojson,.json,application/geo+json,application/json" hidden>` +
      `<div class="sn">Outlines from OpenStreetMap are © OpenStreetMap contributors (ODbL) and are marked as such. Big outlines are simplified. After adding, set the colour and opacity on the card.</div>` +
      `<div class="err-line" id="shAddMsg"></div><button type="button" data-shadd="closeadd">Close</button></div>`;
    $('#shGeoQ').value = sh.geoQ;
    searchFieldSync();
    shRenderGeo();
  } else box.innerHTML = `<button type="button" class="wide" data-shadd="open">+ Add border</button>`;
}
const shMsg = (m) => ($('#shAddMsg') ? ($('#shAddMsg').textContent = m || '') : 0);
function shRenderGeo() {
  const ul = $('#shGeoRes');
  if (!ul) return;
  ul.innerHTML = sh.geo
    .map((r, i) => {
      const t = SHAPE_TYPES[guessShapeType(r)];
      return `<li data-i="${i}"><div class="t"><span class="tmark">${shIcon(guessShapeType(r))}</span><b>${esc(r.name.split(',').slice(0, 2).join(','))}</b></div><div class="sn">${esc(r.name)}</div><div class="row"><span class="sn">${esc(t.label)} · ${geomCount(r.geometry)} points</span><button type="button" data-shadd="geoadd" data-i="${i}">Add</button></div></li>`;
    })
    .join('');
}
async function shSearch() {
  const q = $('#shGeoQ').value.trim();
  sh.geoQ = q;
  if (!q) return;
  shMsg('Searching…');
  try {
    sh.geo = await geocodeShapes(q, $('#lang').value);
    shMsg(sh.geo.length ? '' : 'Nothing with an outline found. Try another spelling, or draw it.');
    shRenderGeo();
  } catch (e) {
    shMsg(e.message);
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
  shMsg('Adding…');
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
    if (!confirm(`Import ${feats.length} shape${feats.length > 1 ? 's' : ''} as borders of type “Territory or area”? You can change the type afterwards.`)) return;
    const lang = languages.some((l) => l.code === 'en') ? 'en' : languages[0].code;
    let n = 0,
      last = null;
    for (const f of feats) {
      const p = f.properties || {},
        name = String(p.name || p.NAME || p['name:en'] || p.title || p.admin || '').trim() || 'Imported border ' + (n + 1);
      last = await shCreate({ names: [{ lang, name: name.slice(0, 200) }], type: shTypeList()[0] || 'territory', date_from: null, date_to: null, source: '', geometry: simplifyGeometry(f.geometry) });
      shMsg(`Imported ${++n} of ${feats.length}…`);
    }
    sh.adding = false;
    await shReload();
    shRenderAdd();
    shOpen(last, true);
  } catch (e) {
    shMsg('Import failed: ' + e.message);
  }
}
$('#shAdd').addEventListener('click', (e) => {
  const li = e.target.closest('#shGeoRes li');
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
  else if (a === 'canceldraw') shCancelDraw();
});
$('#shAdd').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'shGeoQ') shSearch();
  else if (e.target.id === 'shRvQ') shRiverFind(e.target.value);
  else if (e.target.id === 'shRiverQ') e.stopPropagation(), shRiverFind(e.target.value);
});
// a found river: show it alone on the map
$('#shAdd').addEventListener('click', (e) => {
  const li = e.target.closest('#shRvRes li[data-i]');
  if (li) shRiverShow(+li.dataset.i);
});
$('#shAdd').addEventListener('change', (e) => {
  if (e.target.id === 'shRiverOn') (sh.river.on = e.target.checked), shRenderAdd();
  if (e.target.id === 'shFile' && e.target.files[0]) shImport(e.target.files[0]);
  if (e.target.id === 'shFile') e.target.value = '';
});

/** Called once the data is loaded. */
function shSet(list) {
  shapes = list;
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
