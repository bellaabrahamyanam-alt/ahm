// The Routes tab (sidebar domain): historical routes through places and free waypoints (trade, military, migration, journeys, roads).
// A route is a shape (core/shapes.js) of a route type: a line stored in the same file, with the same layers, period filter and drawing tool
// as a border. Extra fields: stops (the ordered ids of the places the line passes: a place is a stop when a point of the line sits on it) and
// twoway (usable both ways; a one-way route is drawn with arrows). Routes that share a stop chain into journeys: "Find a path" (core/routes.js).
// Add one by drawing it on the map: click the start (A), the points it passes and the destination (B); a click on a place marker makes that
// place a stop, any other click is a free point. Optionally the line follows modern roads between the clicks (OSRM). Then its names, type,
// direction and dates. Drag the handle of a segment to insert a point.
const rts = {
  open: null, // id of the route whose card is open
  types: new Set(), // type filter
  hidden: new Set(), // routes switched off in the list (this session only)
  form: null, // { id | null, ...fields } while the form is shown
  draw: null, // { mode: 'new' | 'edit', id, ctl, body } while the drawing tool is on
  found: null, // { a, b, paths, pick } the path search of the finder
  note: '', // a message for the card that opens next
  keys: null, // place name → id for the inputs, see rtKeys
  pending: null, // { coords, ids, road }: the line just drawn, while its form is open
  roads: false, // follow modern roads between the clicks
};
const rtCan = () => AHM_CONFIG.canEdit;
const rtErr = (m) => ($('#rtErr') ? ($('#rtErr').textContent = m || '') : m && alert(m));
const rtVisible = () => shapesRun({ q: $('#rtQ') ? $('#rtQ').value : '', lang: $('#lang').value, types: rts.types, period: periodBounds(), group: 'route' });
const rtCur = () => rts.open && shapeById(rts.open);
const placeById = (id) => places.find((p) => p.id === id);
const rtName = (id) => (placeById(id) ? label(placeById(id), $('#lang').value) : '?');
const rtKm = (km) => (km < 1 ? '' : '≈ ' + Math.round(km).toLocaleString('en') + ' km');
const rtStops = (s) => (s.stops || []).filter((id) => placeById(id));
const rtBody = (s, o = {}) => ({ ...shBody(s), stops: s.stops || [], twoway: s.twoway, ...o });
const rtBtn = (act, icon, text) =>
  `<button type="button" class="icon-btn" data-rtact="${act}" title="${text}" aria-label="${text}">${AHM.icons.svg(icon, 16)}</button>`;
/** The ids of the places that the points of a line sit on (null for a free point), in the order of the points. */
function rtVertexIds(coords) {
  const near = (v, p) => Math.abs(v[0] - p.lon) < 1e-5 && Math.abs(v[1] - p.lat) < 1e-5;
  return coords.map((v) => (places.find((p) => near(v, p)) || {}).id || null);
}
/** The stops of a drawn line, in order, without a place twice in a row. */
const rtStopsOf = (ids) => ids.filter((id, i) => id && id !== ids.slice(0, i).reverse().find(Boolean));
/** Place name → id, for every input that takes a place (the datalist #rtPlaceList). The name shown now; two places with one name also get the type and position. */
function rtKeys() {
  const l = $('#lang').value,
    sig = places.length + '|' + l + '|' + (places[0] ? places[0].id : '');
  if (rts.keys && rts.keys.sig === sig) return rts.keys.map;
  const count = {},
    map = new Map();
  places.forEach((p) => (count[label(p, l)] = (count[label(p, l)] || 0) + 1));
  places.forEach((p) => map.set(count[label(p, l)] > 1 ? `${label(p, l)} (${typeLabel(p.type, l)}, ${p.lat.toFixed(2)}, ${p.lon.toFixed(2)})` : label(p, l), p.id));
  rts.keys = { sig, map };
  $('#rtPlaceList').innerHTML = [...map.keys()].map((k) => `<option value="${esc(k)}"></option>`).join('');
  return map;
}
/** The id of the place typed into an input ('' when empty); throws a message when it is not a place of the map. */
function rtPlaceIn(input, word) {
  const v = input.value.trim();
  if (!v) return '';
  const keys = rtKeys(),
    hit = keys.get(v) || [...keys].find(([k]) => norm(k) === norm(v));
  if (!hit) throw Error(`“${v}” is not a place of the map. Choose the ${word} from the list.`);
  return Array.isArray(hit) ? hit[1] : hit;
}

async function rtReload() {
  shapes = await loadShapes();
  shRefresh();
  rtRenderView();
}

// ---- the list ----
function rtRenderList() {
  if (!$('#rtList')) return;
  const l = $('#lang').value,
    rows = rtVisible(),
    all = shapes.filter(isRoute),
    c = {};
  rtKeys();
  all.forEach((s) => (c[s.type] = (c[s.type] || 0) + 1));
  $('#rtTypes').innerHTML = ROUTE_TYPE_LIST.filter((t) => c[t] || rts.types.has(t))
    .map((t) => `<button class="chip${rts.types.has(t) ? ' on' : ''}" data-t="${t}">${shIcon(t)}${esc(SHAPE_TYPES[t].label)} <span>${c[t] || 0}</span></button>`)
    .join('');
  $('#rtCount').textContent = rows.length + ' of ' + all.length + ' routes';
  dockPark('#rtDetail');
  $('#rtList').innerHTML = rows.length
    ? rows
        .map((s) => {
          const t = shapeType(s.type),
            st = rtStops(s),
            ends = st.length > 1 ? `${esc(rtName(st[0]))} → ${esc(rtName(st[st.length - 1]))}${st.length > 2 ? ` (via ${st.length - 2})` : ''}` : '',
            when = shapeWhen(s);
          return (
            `<li data-sid="${s.id}"${rts.open === s.id ? ' class="on"' : ''}><div class="t"><span class="tmark" title="${esc(t.label)}">${shIcon(s.type)}</span><b>${esc(shapeName(s, l))}</b>` +
            `<label class="sh-eye" title="Show on the map"><input type="checkbox" data-vis="${s.id}"${rts.hidden.has(s.id) ? '' : ' checked'} aria-label="Show on the map"></label></div>` +
            `<div class="sn">${esc(t.label)}${s.twoway ? '' : ' · one way'}${ends ? ' · ' + ends : ''}${when ? ' · ' + esc(when) : ''}</div></li>`
          );
        })
        .join('')
    : `<li class="empty">${all.length ? 'No routes match. Try fewer filters.' : 'No routes yet.'}</li>`;
  if (rts.found) rtFindRun(); // the period or the routes changed: the path may be another one
}
$('#rtList').addEventListener('click', (e) => {
  if (e.target.closest('.sh-eye')) return;
  const li = e.target.closest('li[data-sid]');
  if (!li || e.detail > 1) return;
  rts.open === li.dataset.sid && !rts.form ? rtClose() : rtOpen(li.dataset.sid);
});
$('#rtList').addEventListener('dblclick', (e) => {
  const li = e.target.closest('li[data-sid]');
  if (li && !e.target.closest('.sh-eye')) rtOpen(li.dataset.sid, true);
});
$('#rtList').addEventListener('change', (e) => {
  const id = e.target.dataset.vis;
  if (!id) return;
  e.target.checked ? rts.hidden.delete(id) : rts.hidden.add(id);
  shPush();
});
$('#rtTypes').addEventListener('click', (e) => {
  const b = e.target.closest('.chip[data-t]');
  if (!b) return;
  rts.types.has(b.dataset.t) ? rts.types.delete(b.dataset.t) : rts.types.add(b.dataset.t);
  shRefresh();
});
document.addEventListener('input', (e) => e.target.id === 'rtQ' && shRefresh());
$('#rtFit').onclick = () => AHM.map.fitTo(rtVisible().flatMap((s) => bboxCorners(shBox(s))));

// ---- find a path: the routes that share a place chain into a journey (core/routes.js) ----
function rtFindRun() {
  const f = rts.found;
  if (!f) return;
  const routes = shapesRun({ period: periodBounds(), group: 'route' });
  f.paths = findRoutePaths(routes, placeById, f.a, f.b);
  f.pick = Math.min(f.pick || 0, Math.max(0, f.paths.length - 1));
  rtFindRender();
}
function rtFindRender() {
  const f = rts.found,
    box = $('#rtFound');
  if (!f) {
    AHM.map.showFound(null);
    return (box.innerHTML = '');
  }
  const l = $('#lang').value;
  if (!f.paths.length) {
    AHM.map.showFound(null);
    return (box.innerHTML = `<div class="sn">No chain of routes leads from ${esc(rtName(f.a))} to ${esc(rtName(f.b))}${periodBounds()[0] === null ? '' : ' in this period'}. A route joins another one only at a place that both pass, and a one-way route only runs in its own direction.</div>`);
  }
  box.innerHTML =
    `<div class="sn">${f.paths.length} way${f.paths.length > 1 ? 's' : ''}, shortest first.</div><ul class="rt-found">` +
    f.paths
      .map(
        (p, i) =>
          `<li data-pi="${i}"${i === f.pick ? ' class="on"' : ''}><b>${p.stops.map((id) => esc(rtName(id))).join(' → ')}</b>` +
          `<div class="sn">${rtKm(p.km)} · ${p.legs.length} route${p.legs.length > 1 ? 's' : ''}</div><ol class="rt-legs">` +
          p.legs
            .map(
              (g) =>
                `<li><button type="button" class="chip" data-rtact="open" data-sid="${g.route.id}">${shIcon(g.route.type)}${esc(shapeName(g.route, l))}</button> ${esc(rtName(g.from))} → ${esc(rtName(g.to))} <span class="sn">${rtKm(g.km)}${g.stops.length > 2 ? ' · via ' + g.stops.slice(1, -1).map(rtName).map(esc).join(', ') : ''}</span></li>`
            )
            .join('') +
          `</ol></li>`
      )
      .join('') +
    `</ul>`;
  const p = f.paths[f.pick];
  AHM.map.showFound({ type: 'MultiLineString', coordinates: p.legs.map((g) => g.coords) });
}
function rtFind(fit = true) {
  const err = $('#rtFindErr');
  err.textContent = '';
  try {
    const a = rtPlaceIn($('#rtFrom'), 'start'),
      b = rtPlaceIn($('#rtTo'), 'end');
    if (!a || !b) throw Error('Choose both places.');
    if (a === b) throw Error('The start and the end are the same place.');
    rts.found = { a, b, paths: [], pick: 0 };
    rtFindRun();
    const p = rts.found.paths[0];
    if (fit && p) AHM.map.fitTo(p.legs.flatMap((g) => g.coords));
  } catch (e) {
    err.textContent = e.message;
  }
}
$('#rtFind').onclick = () => rtFind();
$('#rtFindClear').onclick = () => {
  rts.found = null;
  $('#rtFrom').value = $('#rtTo').value = $('#rtFindErr').textContent = '';
  rtFindRender();
};
$('#rtSwap').onclick = () => {
  const a = $('#rtFrom').value;
  $('#rtFrom').value = $('#rtTo').value;
  $('#rtTo').value = a;
  if (rts.found) rtFind();
};
['rtFrom', 'rtTo'].forEach((id) => $('#' + id).addEventListener('keydown', (e) => e.key === 'Enter' && rtFind()));
$('#rtFound').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rtact="open"]');
  if (b) return rtOpen(b.dataset.sid, true);
  const li = e.target.closest('.rt-found > li');
  if (!li || !rts.found) return;
  rts.found.pick = +li.dataset.pi;
  rtFindRender();
  AHM.map.fitTo(rts.found.paths[rts.found.pick].legs.flatMap((g) => g.coords));
});

// ---- the card ----
function rtOpen(id, fit) {
  if (!shapeById(id)) return;
  rtCancelForm();
  rts.open = id;
  tab('routes');
  rtRenderList();
  rtRenderView();
  history.replaceState(null, '', '#route-' + id);
  if (fit) AHM.map.fitTo(bboxCorners(shBox(shapeById(id))));
}
function rtClose() {
  rtCancelForm();
  rts.open = null;
  rtRenderList();
  rtRenderView();
  history.replaceState(null, '', location.pathname + location.search);
}
function rtShow(on) {
  $('#rtDetail').hidden = !on;
  dockSync();
}
/** The chain of a route: place – distance → place … and how many free waypoints lie between. */
function rtChainHTML(s) {
  const segs = routeSegments(s, placeById),
    st = rtStops(s);
  if (!st.length) return '<span class="sn">No places on the way yet. Edit the path and click places to make them stops.</span>';
  const chip = (id) => `<button class="chip" data-rtact="place" data-pid="${id}" title="Show on the map">${esc(rtName(id))}</button>`;
  let h = chip(st[0]);
  for (let i = 1; i < st.length; i++) {
    const g = segs.find((x) => x.from === st[i - 1] && x.to === st[i]);
    h += ` <span class="sn">${g ? rtKm(g.km) + ' ' : ''}→</span> ` + chip(st[i]);
  }
  return h;
}
function rtRenderView() {
  const s = rtCur(),
    d = $('#rtDetail');
  if (curTab === 'routes') AHM.map.highlightShape(s ? s.id : null);
  document.querySelectorAll('#rtList li.on').forEach((x) => x.classList.remove('on'));
  if (rts.form) return rtShow(curTab === 'routes');
  if (!s || curTab !== 'routes') return rtShow(false);
  const li = $(`#rtList li[data-sid="${s.id}"]`),
    l = $('#lang').value,
    t = shapeType(s.type),
    can = rtCan(),
    dis = can ? '' : ' disabled',
    when = shapeWhen(s),
    others = s.names.filter((n) => n.name !== shapeName(s, l)),
    inLy = layers.filter((ly) => lyMembers[ly.id] && lyMembers[ly.id].has(s.id)),
    free = layers.filter((ly) => !inLy.includes(ly)),
    st = rtStops(s),
    pts = geomPoints(s.geometry).length,
    free_pts = Math.max(0, pts - rtVertexIds(geomLines(s.geometry)[0] || []).filter(Boolean).length), // the points that are not on a place
    allRoutes = shapes.filter(isRoute),
    joins = [...new Set(st.flatMap((id) => routesThrough(allRoutes, id).filter((r) => r.id !== s.id).map((r) => r.id)))].map(shapeById);
  if (li) li.classList.add('on');
  d.innerHTML =
    `<div class="dock-head"><span class="tmark" title="${esc(t.label)}">${shIcon(s.type)}</span><h3 class="dock-title">${esc(shapeName(s, l))}</h3><span class="dock-btns">` +
    (can ? rtBtn('edit', 'pencil', 'Edit names, type, direction and dates') : '') +
    rtBtn('close', 'close', 'Close') +
    `</span></div><div class="dock-body">` +
    (others.length ? `<div class="sn">${others.map((n) => `${esc(n.name)} <span class="sn">(${esc(n.lang)})</span>`).join(' · ')}</div>` : '') +
    `<div class="sn">${esc(t.label)}${geomLengthKm(s.geometry) >= 1 ? ' · ' + rtKm(geomLengthKm(s.geometry)) : ''}${when ? ' · ' + esc(when) : ''}</div>` +
    (shapeVersions(s).length ? `<div class="label">Versions in time (${shapeVersions(s).length + 1})</div><div class="chips">${shVersionChips(s, 'data-rtact="open"')}</div>` : '') +
    `<div class="label">Places on the way</div><div class="chips rt-ends">${rtChainHTML(s)}</div>` +
    (free_pts ? `<div class="sn">and ${free_pts} free waypoint${free_pts > 1 ? 's' : ''} that only give the line its course.</div>` : '') +
    `<label class="sh-check"><input type="checkbox" id="rtTwo"${s.twoway ? ' checked' : ''}${dis}> Usable both ways${s.twoway ? '' : ' (now: only from the first place to the last)'}</label>` +
    (joins.length
      ? `<div class="label">Joins</div><div class="chips">${joins.slice(0, 12).map((r) => `<button class="chip" data-rtact="open" data-sid="${r.id}">${shIcon(r.type)}${esc(shapeName(r, l))}</button>`).join('')}</div><div class="sn">Routes that pass one of its places: use “Find a path” to chain them.</div>`
      : '') +
    `<div class="label">Look</div><div class="sh-look">` +
    `<label>Colour <input type="color" id="rtColor" value="${esc(s.color)}"${dis}></label>` +
    `<label>Line opacity <input type="range" id="rtOp" min="0.1" max="1" step="0.05" value="${s.opacity}"${dis}> <span id="rtOpVal">${Math.round(s.opacity * 100)}%</span></label>` +
    `<label class="sh-check"><input type="checkbox" id="rtLabel"${s.label ? ' checked' : ''}${dis}> Show the name on the map</label></div>` +
    `<div class="label">In layers</div><div class="chips">` +
    (inLy.length ? inLy.map((ly) => `<button class="chip ly-chip" data-rtact="layer" data-lid="${ly.id}"${ly.color ? ` style="--a:${esc(ly.color)}"` : ''}>${esc(lyName(ly, l))}</button>`).join('') : '<span class="sn">None yet.</span>') +
    `</div>` +
    (can && free.length ? `<select id="rtAddLayer" aria-label="Add to a layer"><option value="">Add to a layer…</option>${free.map((ly) => `<option value="${ly.id}">${esc(lyName(ly, l))}</option>`).join('')}</select>` : '') +
    lyOwnerNotesHTML(s.id, l, 'rtact') +
    (/^osrm:/.test(s.source || '') ? `<div class="sn">The path follows modern roads: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL), via OSRM. Edit the path to match the historical one.</div>` : '') +
    (rts.note ? `<div class="sn">${esc(rts.note)}</div>` : '') +
    `<div class="err-line" id="rtErr"></div></div><div class="dock-foot">` +
    `<button type="button" data-rtact="fit">Fit map</button>` +
    (can ? `${geomToDraw(s.geometry) ? '<button type="button" data-rtact="editpath">Edit path</button><button type="button" data-rtact="addversion" title="Move the points to the path for another time. The path you see now stays as it is.">New version…</button>' : ''}<button type="button" data-rtact="reverse" title="Run the other way: the places and the line are reversed">Reverse</button><button type="button" class="danger" data-rtact="delete">Delete</button>` : '') +
    `</div>`;
  rts.note = '';
  rtShow(true);
  if (li) revealRow(li);
}
/** Saves a change at once (the map is already showing it). */
async function rtStyle(s, patch) {
  const old = Object.fromEntries(Object.keys(patch).map((k) => [k, s[k]]));
  Object.assign(s, patch);
  shPush();
  setTimeout(() => AHM.map.previewShape(s.id, null), 500);
  try {
    await postJSON(shUrl().shapeSave, rtBody(s));
    rtErr('');
    if ('twoway' in patch) (rtRenderList(), rtRenderView());
  } catch (e) {
    Object.assign(s, old);
    shPush();
    rtRenderView();
    rtErr(e.message);
  }
}
$('#rtDetail').addEventListener('input', (e) => {
  const s = rtCur();
  if (!s || rts.form) return;
  if (e.target.id === 'rtColor') AHM.map.previewShape(s.id, { color: e.target.value });
  if (e.target.id === 'rtOp') {
    AHM.map.previewShape(s.id, { opacity: +e.target.value });
    $('#rtOpVal').textContent = Math.round(e.target.value * 100) + '%';
  }
});
$('#rtDetail').addEventListener('change', async (e) => {
  if (rts.form) {
    if (e.target.id === 'rtTwo') e.target.dataset.touched = '1'; // the person chose: the type no longer sets it
    return;
  }
  const s = rtCur();
  if (!s) return;
  if (e.target.id === 'rtColor') rtStyle(s, { color: e.target.value });
  else if (e.target.id === 'rtOp') rtStyle(s, { opacity: +e.target.value });
  else if (e.target.id === 'rtLabel') rtStyle(s, { label: e.target.checked });
  else if (e.target.id === 'rtTwo') rtStyle(s, { twoway: e.target.checked });
  else if (e.target.id === 'rtAddLayer' && e.target.value) {
    try {
      await postJSON(shUrl().layerSave, { layer_members: { id: e.target.value, add: [s.id] } });
      await lyReload();
      rtRenderView();
    } catch (err) {
      rtErr(err.message);
    }
  }
});
$('#rtDetail').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-rtact]');
  if (!b) return;
  const act = b.dataset.rtact,
    s = rtCur();
  if (act === 'close') return rts.form ? rtDiscardForm() : rtClose();
  if (act === 'typepick') {
    b.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    const two = $('#rtTwo');
    if (b.dataset.t && two && !two.dataset.touched) two.checked = SHAPE_TYPES[b.dataset.t].twoway; // each type has its usual direction
    return;
  }
  if (act === 'save') return rtSaveForm();
  if (act === 'cancel') return rtDiscardForm();
  if (act === 'back') {
    const prevId = rts.form && rts.form.prevId;
    rts.form = null; // not through rtCancelForm: it would go back to the card
    return rtStartDraw({ mode: prevId ? 'version' : 'new', id: prevId, pending: rts.pending });
  }
  if (act === 'open') return rtOpen(b.dataset.sid, true);
  if (act === 'place') {
    const p = placeById(b.dataset.pid);
    return p && AHM.map.focusPoint(p, Math.max(AHM.map.getZoom(), 8));
  }
  if (!s) return;
  if (act === 'fit') AHM.map.fitTo(bboxCorners(shBox(s)));
  else if (act === 'layer') lyOpen(b.dataset.lid);
  else if (act === 'addnote') lyOpenNoteDlg(s, null, 'route');
  else if (act === 'editnote') lyOpenNoteDlg(s, layerNotes.find((n) => n.id === b.dataset.id), 'route');
  else if (act === 'edit') rtOpenForm({ ...s });
  else if (act === 'editpath') rtStartDraw({ mode: 'edit', id: s.id });
  else if (act === 'addversion') rtStartDraw({ mode: 'version', id: s.id });
  else if (act === 'reverse') {
    try {
      await postJSON(shUrl().shapeSave, rtBody(s, { geometry: geomReverse(s.geometry), stops: (s.stops || []).slice().reverse() }));
      await rtReload();
    } catch (err) {
      rtErr(err.message);
    }
  } else if (act === 'delete') {
    if (!confirm(`Delete “${shapeName(s, $('#lang').value)}”? It also leaves its layers. A copy of the old file stays in the archive on the server.`)) return;
    try {
      await postJSON(shUrl().shapeDelete, { id: s.id });
      rts.open = null;
      history.replaceState(null, '', location.pathname + location.search);
      await rtReload();
      await lyReload();
    } catch (err) {
      rtErr(err.message);
    }
  }
});

// ---- the form: after the line is drawn, its names, type, direction and dates ----
const rtTypeChips = (cur) =>
  ROUTE_TYPE_LIST.map((t) => `<button type="button" class="chip${t === cur ? ' on' : ''}" data-rtact="typepick" data-t="${t}" title="${esc(SHAPE_TYPES[t].label)}">${shIcon(t)}${esc(SHAPE_TYPES[t].label)}</button>`).join('');
/** f: a route being edited ({ id, ... }) or { id: null } for the line just drawn (rts.pending). */
function rtOpenForm(f) {
  rts.form = f;
  const pend = f.id ? null : rts.pending,
    stops = pend ? rtStopsOf(pend.ids) : [],
    names = f.names && f.names.length ? f.names : [{ lang: $('#lang').value || 'en', name: stops.length > 1 ? `${rtName(stops[0])} – ${rtName(stops[stops.length - 1])}` : '' }],
    type = f.type || 'trade',
    prev = f.prevId && shapeById(f.prevId),
    chain = pend
      ? stops.length
        ? stops.map((id) => `<span class="chip">${esc(rtName(id))}</span>`).join(' <span class="sn">→</span> ')
        : '<span class="sn">No place on the way: it runs between free points.</span>'
      : rtChainHTML(f);
  rtKeys();
  $('#rtDetail').innerHTML =
    `<div class="dock-head"><span class="tmark">${shIcon(type)}</span><h3 class="dock-title">${f.id ? 'Edit route' : prev ? 'New version of “' + esc(shapeName(prev, $('#lang').value)) + '”' : 'New route'}</h3><span class="dock-btns">${rtBtn('cancel', 'close', 'Cancel')}</span></div>` +
    `<div class="dock-body"><div class="pf" id="rtForm">` +
    (pend ? `<div class="sn">${pend.coords.length} points drawn, ${rtKm(lineKm(pend.coords))}.</div>` : '') +
    (prev ? `<div class="sn">The path you just drew is saved as a new version of the same route. “${esc(shapeWhen(prev) || 'no dates')}” stays as it is. Give the dates of the new one; names, type and direction are taken over, change them if they differ.</div>` : '') +
    `<div class="label">Places on the way</div><div class="chips rt-ends">${chain}</div>` +
    (f.id ? `<div class="sn">To change the places or the course of the line, close this and use “Edit path”.</div>` : `<div class="sn">A place is a stop when a point of the line sits on it. The other points only give the line its course.</div>`) +
    `<div class="label">Names</div><div class="pf-names" data-dated="1">${names.map((n) => pfRowDated(n)).join('')}</div>` +
    `<button type="button" class="pf-add">+ Add another name</button><div class="sn">${LANG_HINT}</div>` +
    `<div class="label">Type</div><div class="chips sh-typepick">${rtTypeChips(type)}</div>` +
    `<div class="sn">The type sets the line pattern, the first colour and the usual direction.</div>` +
    `<label class="sh-check"><input type="checkbox" id="rtTwo"${f.id || prev ? (f.twoway ? ' checked' : '') : SHAPE_TYPES[type].twoway ? ' checked' : ''}> Usable both ways</label>` +
    `<div class="sn">Switched off, the route is drawn with arrows and a path only follows it from A to B.</div>` +
    `<div class="label">Dates (optional)</div><div class="sn">When the route was used. Routes with dates follow the period filter.</div>` +
    `<div class="pf-sub">Began</div>${dfHTML('pf-from', f.date_from || null)}<div class="pf-sub">Ended</div>${dfHTML('pf-to', f.date_to || null)}${prev && !prev.date_to ? '<label class="sh-check"><input type="checkbox" id="rtClosePrev" checked> End the previous version the day before</label>' : ''}</div>` +
    `<div class="err-line" id="rtErr"></div></div><div class="dock-foot"><button type="button" class="primary" data-rtact="save">${f.id ? 'Save' : prev ? 'Save version' : 'Save route'}</button>` +
    (pend ? '<button type="button" data-rtact="back">Back to the map</button>' : '') +
    `<button type="button" data-rtact="cancel">${pend ? 'Discard' : 'Cancel'}</button></div>`;
  rtShow(true);
  tab('routes');
  const n = $('#rtForm .nn');
  if (n) n.focus();
}
placeFormWire($('#rtDetail'));
function rtReadForm() {
  const root = $('#rtForm'),
    names = pfReadNames(root);
  if (!names.length) throw Error('Give the route at least one name.');
  names.forEach((n) => {
    if (!languages.some((l) => l.code === n.lang)) throw Error(`The language “${n.lang || '?'}” is not in the list. Ask an administrator to add it.`);
  });
  const from = dfRead(root.querySelector('.pf-from'), 'Began'),
    to = dfRead(root.querySelector('.pf-to'), 'Ended');
  dateOrderCheck(from, to);
  return { names, type: root.querySelector('.sh-typepick .chip.on').dataset.t, date_from: from, date_to: to, twoway: $('#rtTwo').checked };
}
async function rtSaveForm() {
  const f = rts.form,
    btn = $('#rtDetail [data-rtact="save"]');
  try {
    const fields = rtReadForm();
    btn.disabled = true;
    if (f.id) {
      await postJSON(shUrl().shapeSave, rtBody(shapeById(f.id), fields));
      rts.form = null;
      await rtReload();
      return rtOpen(f.id);
    }
    const p = rts.pending,
      prev = f.prevId && shapeById(f.prevId);
    if (prev && !prev.series) await postJSON(shUrl().shapeSave, rtBody(prev, { series: f.series })); // the route we started from joins the series first (T-041)
    await rtCreate(
      {
        ...shapeDefaults(fields.type, 'line'),
        ...fields,
        ...(f.look || {}),
        ...(f.series ? { series: f.series } : {}),
        source: p.road ? 'osrm:driving' : '',
        stops: rtStopsOf(p.ids),
        geometry: { type: 'LineString', coordinates: p.coords },
      },
      prev && $('#rtClosePrev') && $('#rtClosePrev').checked ? { prev, end: versionEndBefore(prev, fields.date_from) } : null,
    );
  } catch (e) {
    btn.disabled = false;
    rtErr(e.message);
  }
}
async function rtCreate(body, close = null) {
  const id = (await postJSON(shUrl().shapeSave, body)).id;
  if (close && close.end) await postJSON(shUrl().shapeSave, rtBody(close.prev, { date_to: close.end })); // the version before ends the day before the new one
  rts.form = null;
  rts.pending = null;
  await rtReload();
  rtRenderAdd();
  rtOpen(id, true);
}
function rtCancelForm() {
  if (!rts.form) return;
  const back = rts.form.prevId;
  rts.form = null;
  rts.pending = null;
  rtRenderView();
  rtRenderAdd();
  if (back && shapeById(back)) rtOpen(back);
}
/** The person closes the form: a line that was just drawn is only lost after a confirmation. */
function rtDiscardForm() {
  if (rts.pending && !confirm(rts.form && rts.form.prevId ? 'Discard this version? The path you drew is lost.' : 'Discard this route? The line you drew is lost.')) return;
  rtCancelForm();
}

// ---- drawing: click the map for the start (A), the points the route passes, and the destination (B) ----
// A click on a place marker makes it a stop; any other click is a free point. Options: follow modern roads between the clicks.
async function rtRoad(a, b) {
  const msg = $('#rtAddMsg');
  if (!rts.roads) return null;
  try {
    const leg = simplifyGeometry((await route({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] })).geometry, 30).coordinates;
    if (msg) msg.textContent = '';
    return leg.slice(1, -1);
  } catch (e) {
    if (msg) msg.textContent = 'No road between these two points: a straight line was used.';
    return null;
  }
}
function rtDrawInfo() {
  const d = rts.draw,
    el = $('#rtDrawInfo');
  if (!d || !el) return;
  const n = d.ctl.count();
  el.textContent = !n
    ? 'Click the map to set the start (A).'
    : n === 1
      ? 'Start set. Click the map to add the next point.'
      : `${n} points · ${rtKm(lineKm(d.ctl.points())) || '< 1 km'}. The last point is the destination (B): keep clicking to continue the route.`;
}
/** mode 'version': the line of route `id` as the start of a new version of it (T-041); mode 'new': a fresh line (pending: the points of a line that came back from the form; startPlace: a place to start from); mode 'edit': the line of route `id`. */
function rtStartDraw({ mode, id, pending, startPlace }) {
  rtCancelForm();
  if (rts.draw) rts.draw.ctl.remove();
  if (sh.draw) shCancelDraw();
  const s = id && shapeById(id),
    sp = startPlace && placeById(startPlace),
    coords = pending ? pending.coords : s ? (geomLines(s.geometry)[0] || []).map((c) => c.slice()) : sp ? [[sp.lon, sp.lat]] : [],
    ids = pending ? pending.ids : s ? rtVertexIds(coords) : sp ? [sp.id] : [],
    ctl = AHM.map.drawShape({ kind: 'line', coords, ids, snap: true, locate: (pid) => (placeById(pid) ? [placeById(pid).lon, placeById(pid).lat] : null), labels: true, expand: rtRoad }, () => {
      const f = $('#rtFinish');
      if (f) f.disabled = ctl.count() < 2;
      rtDrawInfo();
    });
  rts.open = null;
  rts.draw = { mode, id, ctl };
  rts.pending = null;
  rtRenderList();
  rtRenderView();
  shPush();
  rtRenderAdd();
  if (coords.length) AHM.map.fitTo(coords.length > 1 ? coords : [coords[0], coords[0]]);
}
async function rtFinishDraw() {
  const d = rts.draw;
  await d.ctl.ready(); // a click that is still asking for its road
  if (d.ctl.count() < 2) return ($('#rtAddMsg').textContent = 'A route needs a start and at least one more point.');
  const coords = d.ctl.points(),
    ids = d.ctl.ids(),
    road = d.ctl.flags().includes('road');
  d.ctl.remove();
  rts.draw = null;
  if (d.mode === 'new') {
    rts.pending = { coords, ids, road };
    rtRenderAdd();
    return rtOpenForm({ id: null });
  }
  if (d.mode === 'version') {
    const prev = shapeById(d.id);
    rts.pending = { coords, ids, road };
    rtRenderAdd();
    return rtOpenForm({ id: null, prevId: prev.id, series: prev.series || shNewUuid(), names: prev.names, type: prev.type, twoway: prev.twoway, look: { color: prev.color, opacity: prev.opacity, label: prev.label, ...(prev.width ? { width: prev.width } : {}) } });
  }
  const s = shapeById(d.id);
  try {
    await postJSON(shUrl().shapeSave, rtBody(s, { geometry: { type: 'LineString', coordinates: coords }, stops: rtStopsOf(ids), source: road ? 'osrm:driving' : s.source || '' }));
  } catch (e) {
    alert(e.message);
  }
  await rtReload();
  rtRenderAdd();
  rtOpen(d.id);
}
function rtCancelDraw() {
  const d = rts.draw;
  if (!d) return;
  if (d.mode === 'new' && d.ctl.count() >= 2 && !confirm('Discard this route? The points you clicked are lost.')) return;
  d.ctl.remove();
  rts.draw = null;
  shPush();
  rtRenderAdd();
  if (d.id) rtOpen(d.id);
}
AHM.on('draw:finish', () => rts.draw && rtFinishDraw());
AHM.on('draw:cancel', () => rts.draw && rtCancelDraw());

// ---- adding ----
function rtRenderAdd() {
  const box = $('#rtAdd');
  $('#tab-routes').classList.toggle('rt-drawing', !!rts.draw); // while drawing, only the drawing panel is shown
  if (!rtCan()) return (box.innerHTML = '');
  if (rts.draw) {
    const d = rts.draw;
    box.innerHTML =
      `<div class="sh-banner"><b>${d.mode === 'version' ? 'New version: move the points' : d.mode === 'edit' ? 'Editing the path' : 'Drawing the route'}</b>` +
      (d.mode === 'version' ? `<div class="sn">The path you started from is not changed. Move the points to the path for the other time, then press Next to give its dates.</div>` : '') +
      `` +
      `<div class="sn" id="rtDrawInfo"></div>` +
      `<label class="sh-check"><input type="checkbox" id="rtRoads"${rts.roads ? ' checked' : ''}> Follow modern roads between the points I click</label>` +
      `<div class="sn">Click a place to make it a stop (green), or anywhere else for a free point. Drag a point to move it (drop it on a place to make it a stop), drag the small handle in the middle of a segment to insert a point, right-click a point to remove it, Backspace undoes. Enter or a double click finishes, Esc cancels.</div>` +
      `<div class="row"><button type="button" data-rtadd="undo">Undo</button><button type="button" class="primary" id="rtFinish" data-rtadd="finish"${d.ctl.count() < 2 ? ' disabled' : ''}>${d.mode === 'version' ? 'Next: dates' : d.mode === 'edit' ? 'Save path' : 'Finish'}</button>` +
      `<button type="button" data-rtadd="canceldraw">Cancel</button></div><div class="err-line" id="rtAddMsg"></div></div>`;
    rtDrawInfo();
  } else box.innerHTML = rts.pending ? '' : `<button type="button" class="wide" data-rtadd="new">+ Add route</button>`;
}
$('#rtAdd').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rtadd]');
  if (!b) return;
  const a = b.dataset.rtadd;
  if (a === 'new') (rts.open = null), rtRenderList(), rtStartDraw({ mode: 'new' });
  else if (a === 'undo') rts.draw.ctl.undo();
  else if (a === 'finish') rtFinishDraw();
  else if (a === 'canceldraw') rtCancelDraw();
});
$('#rtAdd').addEventListener('change', (e) => {
  if (e.target.id === 'rtRoads') rts.roads = e.target.checked;
});
rtRenderAdd();

// ---- the place card: the routes that pass the place, and a shortcut into "Find a path" ----
function rtPlaceHTML(p) {
  const all = shapes.filter(isRoute),
    through = routesThrough(all, p.id),
    l = $('#lang').value;
  if (!all.length) return '';
  return (
    `<div class="label">Routes</div><div class="chips">` +
    (through.length
      ? through.map((r) => `<button type="button" class="chip" data-rtopen="${r.id}">${shIcon(r.type)}${esc(shapeName(r, l))}</button>`).join('')
      : '<span class="sn">No route passes here.</span>') +
    `<button type="button" class="chip" data-rtfrom="${p.id}" title="Open “Find a path” with this place as the start">Find a path from here…</button>` +
    (rtCan() ? `<button type="button" class="chip" data-rtstart="${p.id}" title="Start drawing a route at this place">Start a route here</button>` : '') +
    `</div>`
  );
}
$('#detail').addEventListener('click', (e) => {
  const o = e.target.closest('[data-rtopen]'),
    f = e.target.closest('[data-rtfrom]'),
    st = e.target.closest('[data-rtstart]');
  if (st) {
    tab('routes');
    rtStartDraw({ mode: 'new', startPlace: st.dataset.rtstart });
  } else if (o) rtOpen(o.dataset.rtopen, true);
  else if (f) {
    tab('routes');
    $('#rtFinder').open = true;
    $('#rtFrom').value = ([...rtKeys()].find(([, id]) => id === f.dataset.rtfrom) || [''])[0];
    $('#rtTo').focus();
  }
});
