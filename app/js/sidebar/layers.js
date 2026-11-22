// Layers tab, layer details, layer forms and categories (sidebar domain). The filter state and the pure rules are in core/layer-rules.js.
// Prefix `ly` = layers, `cat` = categories.

let lyCatEditing = null; // id of the category being renamed (administrators)

const lySwatch = (c) => `<span class="swatch"${c ? ` style="background:${esc(c)}"` : ' data-none'}></span>`;
const lyPara = (t) =>
  t
    .split(/\n\s*\n/)
    .map((x) => '<p>' + esc(x) + '</p>')
    .join('');

async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error('Save failed: ' + (j.error || r.status));
  return j;
}

// ---- data ----
function lySet(ls, ln, cs) {
  layers = ls;
  layerNotes = ln;
  categories = cs;
  lyMembers = {};
  layers.forEach((l) => (lyMembers[l.id] = new Set(l.members.map((m) => m.place || m.shape))));
  ['only', 'hide'].forEach((k) => [...lyState[k]].forEach((id) => lyById(id) || lyState[k].delete(id))); // deleted by someone
  if (lyState.open && !lyById(lyState.open)) lyState.open = null;
  if (lyState.editing && !lyById(lyState.editing)) lyStopEdit();
  AHM.state.patch('layers', {});
  lyFillCats();
  lyRender();
}
async function lyReload() {
  const [a, b, c] = await Promise.all([loadLayers(), loadLayerNotes(), loadCategories()]);
  lySet(a, b, c);
  update();
}

function lyChanged() {
  lyState.noteAll = false;
  lyRender();
  update();
}
function lyToggleFilter(kind, id) {
  const other = kind === 'only' ? 'hide' : 'only';
  lyState[other].delete(id);
  lyState[kind].has(id) ? lyState[kind].delete(id) : lyState[kind].add(id);
  AHM.state.patch('layers', {});
  lyChanged();
}
function lyClearFilters() {
  lyState.only.clear();
  lyState.hide.clear();
  lyState.noteAll = false;
  AHM.state.patch('layers', {});
  lyRender();
}

// ---- rendering ----
function lyRender() {
  lyRenderActive();
  lyRenderList();
  lyRenderDetail();
  lyRenderCats();
}
/** The "Layers" line of the Explore filters. */
function lyRenderActive() {
  const l = $('#lang').value,
    chip = (kind, id) =>
      `<button class="chip on" data-lyact="unfilter" data-kind="${kind}" data-lid="${id}" title="Remove this filter">${kind === 'only' ? 'only' : 'not in'} · ${esc(lyName(lyById(id), l))} ✕</button>`;
  $('#lyActive').innerHTML =
    [...lyState.only].map((id) => chip('only', id)).join('') + [...lyState.hide].map((id) => chip('hide', id)).join('');
}
function lyHay(ly) {
  return norm(
    [
      ...ly.names.map((n) => n.name),
      ...ly.descriptions.map((d) => d.text),
      catName(catById(ly.category), 'en'),
      ...((catById(ly.category) || { names: [] }).names.map((n) => n.name)),
      ...layerNotes.filter((n) => n.layer === ly.id).map((n) => n.title + ' ' + n.text),
    ].join(' ')
  );
}
function lyRowHTML(ly, l) {
  const c = catById(ly.category),
    np = ly.members.filter((m) => m.place).length,
    ns = ly.members.length - np,
    meta = [catName(c, l), lyWhen(ly), np + (np === 1 ? ' place' : ' places'), ns ? ns + (ns === 1 ? ' border' : ' borders') : ''].filter(Boolean);
  return (
    `<li data-lid="${ly.id}" ${ly.color ? ` style="--lc:${esc(ly.color)}"` : ''}><div class="t"><div class="lyt"><b>${lySwatch(ly.color)}${esc(lyName(ly, l))}</b><div class="sn">${esc(meta.join(' · '))}</div></div>` +
    `<span class="ly-btns"><button class="${!lyState.only.has(ly.id) && !lyState.hide.has(ly.id) ? 'on' : ''}" data-lyact="show" data-lid="${ly.id}" title="Show this layer as usual">Show</button><button class="${lyState.only.has(ly.id) ? 'on' : ''}" data-lyact="only" data-lid="${ly.id}" title="Show on the map only the places of this layer">Only</button>` +
    `<button class="${lyState.hide.has(ly.id) ? 'on' : ''}" data-lyact="hide" data-lid="${ly.id}" title="Hide the places of this layer">Hide</button></span></div></li>`
  );
}
function lyRenderList() {
  const q = norm($('#lyQ').value),
    cat = $('#lyCat').value,
    l = $('#lang').value,
    rows = layers
      .filter((ly) => (!cat || ly.category === cat) && (!q || lyHay(ly).includes(q)))
      .sort((a, b) => lyName(a, l).localeCompare(lyName(b, l)));
  $('#lyCount').textContent = rows.length + ' of ' + layers.length + ' layers';
  if (typeof dockPark === "function") dockPark(); // the details card sits in the list (T-082)
  $('#lyList').innerHTML = rows.length ? rows.map((ly) => lyRowHTML(ly, l)).join('') : '<li class="empty">No layers match.</li>';
  lyPlaceDetail();
}
/** The details of the open layer (#lyDetail) live in the dock under the list; the list keeps all its rows and the open one is marked. */
function lyPlaceDetail() {
  const ly = lyState.open && lyById(lyState.open),
    d = $('#lyDetail');
  document.querySelectorAll('#lyList li.on').forEach((x) => x.classList.remove('on'));
  if (!ly) {
    d.hidden = true;
    dockSync();
    return;
  }
  let li = $(`#lyList li[data-lid="${ly.id}"]`);
  if (!li) {
    // the layer is filtered out of the list: show its row anyway, so the open layer always has a row
    const e = $('#lyList .empty');
    if (e) e.remove();
    $('#lyList').insertAdjacentHTML('afterbegin', lyRowHTML(ly, $('#lang').value));
    li = $('#lyList li');
  }
  li.classList.add('on');
  dockSync();
  if (!d.hidden) revealRow(li);
}
function lyFillCats() {
  const v = $('#lyCat').value,
    l = $('#lang').value;
  $('#lyCat').innerHTML =
    '<option value="">All categories</option>' +
    categories
      .slice()
      .sort((a, b) => catName(a, l).localeCompare(catName(b, l)))
      .map((c) => `<option value="${c.id}">${esc(catName(c, l))}</option>`)
      .join('');
  $('#lyCat').value = categories.some((c) => c.id === v) ? v : '';
}
/** The header of the layer card: swatch, name, then edit and close. */
const lyHeadHTML = (ly, l, can) =>
  `<div class="dock-head">${lySwatch(ly.color)}<h3 class="dock-title">${esc(lyName(ly, l))}</h3><span class="dock-btns">` +
  (can ? `<button type="button" class="icon-btn" data-lyact="editlayer" title="Edit layer" aria-label="Edit layer">${AHM.icons.svg('pencil', 16)}</button>` : '') +
  `<button type="button" class="icon-btn" data-lyact="close" title="Close" aria-label="Close">${AHM.icons.svg('close', 16)}</button></span></div>`;
function lyRenderDetail() {
  const ly = lyState.open && lyById(lyState.open);
  $('#lyDetail').hidden = !ly || curTab !== 'layers';
  if (!ly) return lyPlaceDetail();
  const l = $('#lang').value,
    can = AHM_CONFIG.canEdit,
    c = catById(ly.category),
    ns = layerNotes
      .filter((n) => n.layer === ly.id && (!l || n.lang === l))
      .sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.title.localeCompare(b.title)),
    byId = new Map(places.map((p) => [p.id, p])),
    editing = lyState.editing === ly.id;
  $('#lyDetail').innerHTML =
    lyHeadHTML(ly, l, can && !editing) +
    '<div class="dock-body">' +
    (ly.names.length > 1
      ? '<p>' + ly.names.map((n) => `${esc(n.name)} <span class="sn">[${esc(n.lang)}]</span>`).join(' · ') + '</p>'
      : '') +
    ly.descriptions
      .filter((d) => !l || d.lang === l || !ly.descriptions.some((x) => x.lang === l))
      .map((d) => `<div class="sn">${esc(langName(d.lang))}</div>${lyPara(d.text)}`)
      .join('') +
    '<div class="row ly-quick">' +
    `<button class="${lyState.only.has(ly.id) ? 'on' : ''}" data-lyact="only" data-lid="${ly.id}">Only this layer</button>` +
    `<button class="${lyState.hide.has(ly.id) ? 'on' : ''}" data-lyact="hide" data-lid="${ly.id}">Hide this layer</button>` +
    '<button data-lyact="fit">Fit map</button></div>' +
    (editing
      ? lyEditPanel(ly, byId)
      : `<div class="label">Places (${ly.members.filter((m) => m.place).length})</div><ul class="ly-members">` +
        (ly.members
          .map((m, i) => byId.get(m.place) && `<li data-pid="${m.place}"><span class="sn">${i + 1}.</span> <b>${esc(label(byId.get(m.place), l))}</b> <span class="badge">${typeIcon(byId.get(m.place).type)}${esc(typeLabel(byId.get(m.place).type, l))}</span></li>`)
          .filter(Boolean)
          .join('') || '<li class="empty">No places yet.</li>') +
        '</ul>' +
        lyShapeList(ly, l)) +
    '<div class="label">Notes about this layer</div>' +
    (ns
      .map(
        (n) =>
          `<div class="ly-note"><div class="note-head"><div class="note-meta"><b>${esc(n.title)}</b> <span class="sn">${n.date ? esc(dateText(n.date)) + ' · ' : ''}${esc(langName(n.lang))}</span></div>${can ? `<button type="button" class="icon-btn sm" data-lyact="editnote" data-id="${n.id}" title="Edit note" aria-label="Edit note">${AHM.icons.svg('pencil', 16)}</button>` : ''}</div>${lyPara(n.text)}</div>`
      )
      .join('') || '<p class="sn">No notes yet.</p>') +
    (AHM_CONFIG.canEdit ? '' : '<div class="sn">Log in to change layers.</div>') +
    '<div id="lyErr" class="sn err-line"></div></div>' +
    (can && !editing
      ? '<div class="dock-foot"><button class="primary" data-lyact="editplaces">Choose places</button><button data-lyact="addnote">Add note</button>' +
        (AHM_CONFIG.canLayerAdmin ? '<button class="danger" data-lyact="delete">Delete</button>' : '') +
        '</div>'
      : '');
  lyPlaceDetail();
}
/** Choosing places: click them on the map or tick them here; nothing is saved until "Save places". */
function lyEditPanel(ly, byId) {
  const orig = new Set(ly.members.map((m) => m.place || m.shape)),
    add = [...lyState.staged].filter((p) => !orig.has(p)).length,
    rem = [...orig].filter((p) => !lyState.staged.has(p)).length;
  return (
    `<div class="ly-edit"><b>Choose the places and borders of this layer</b><div class="sn">Click places or borders (their lines) on the map, or tick them below. Everything stays on the main map. ` +
    `<span id="lyDelta">${add || rem ? `+${add} −${rem}` : 'no changes yet'}</span></div>` +
    searchFieldHTML('lyPickQ', 'Find a place or border…') +
    `<ul id="lyPick">${lyPickRows('', byId)}</ul>` +
    '<div class="row"><button class="primary" data-lyact="saveplaces">Save places</button><button data-lyact="cancelplaces">Cancel</button></div></div>'
  );
}
function lyPickRows(q, byId) {
  const l = $('#lang').value;
  q = norm(q);
  return (
    places
      .filter((p) => !q || p.names.some((n) => norm(n.name).includes(q)))
      .sort((a, b) => label(a, l).localeCompare(label(b, l)))
      .map(
        (p) =>
          `<li data-pid="${p.id}"><label><input type="checkbox"${lyState.staged.has(p.id) ? ' checked' : ''}> ${esc(label(p, l))}</label> <span class="badge">${esc(typeLabel(p.type, l))}</span></li>`
      )
      .join('') +
      shapes
        .filter((s) => !q || s.names.some((n) => norm(n.name).includes(q)))
        .sort((a, b) => shapeName(a, l).localeCompare(shapeName(b, l)))
        .map((s) => `<li data-pid="${s.id}"><label><input type="checkbox"${lyState.staged.has(s.id) ? ' checked' : ''}> ${esc(shapeName(s, l))}</label> <span class="badge">${shIcon(s.type)}${esc(shapeType(s.type).label)}</span></li>`)
        .join('') || '<li class="empty">Nothing matches.</li>'
  );
}
/** The borders of an open layer, under its places. */
function lyShapeList(ly, l) {
  const ss = ly.members.map((m) => m.shape && shapeById(m.shape)).filter(Boolean);
  return ss.length
    ? `<div class="label">Borders and routes (${ss.length})</div><ul class="ly-members">` +
        ss.map((s) => `<li data-sid="${s.id}"><b>${esc(shapeName(s, l))}</b> <span class="badge">${shIcon(s.type)}${esc(shapeType(s.type).label)}</span></li>`).join('') +
        '</ul>'
    : '';
}
function lyDelta() {
  const ly = lyById(lyState.editing),
    orig = new Set(ly.members.map((m) => m.place || m.shape)),
    add = [...lyState.staged].filter((p) => !orig.has(p)).length,
    rem = [...orig].filter((p) => !lyState.staged.has(p)).length;
  if ($('#lyDelta')) $('#lyDelta').textContent = add || rem ? `+${add} −${rem}` : 'no changes yet';
}

// ---- opening, closing, choosing places ----
function lyOpen(id) {
  if (!lyById(id)) return;
  lyStopEdit();
  lyState.open = id;
  lyState.noteAll = false;
  tab('layers');
  lyRenderDetail();
  history.replaceState(null, '', '#layer-' + id);
}
function lyClose() {
  lyStopEdit();
  lyState.open = null;
  lyState.noteAll = false;
  lyRenderDetail();
  history.replaceState(null, '', location.pathname + location.search);
}
function lyStartEdit() {
  const ly = lyById(lyState.open);
  if (!ly) return;
  lyState.editing = ly.id;
  lyState.staged = new Set(ly.members.map((m) => m.place || m.shape));
  AHM.state.patch('layers', {});
  lyRenderDetail();
  update(); // every place is shown now, the members get a ring
}
function lyStopEdit() {
  if (!lyState.editing) return;
  lyState.editing = null;
  lyState.staged = null;
  AHM.state.patch('layers', {});
  lyRenderDetail();
  update();
}
/** A place was clicked on the map or in the list while places are being chosen. */
function lyToggleMember(pid) {
  lyState.staged.has(pid) ? lyState.staged.delete(pid) : lyState.staged.add(pid);
  AHM.state.patch('layers', {});
  const cb = document.querySelector(`#lyPick li[data-pid="${pid}"] input`);
  if (cb) cb.checked = lyState.staged.has(pid);
  lyDelta();
  update();
}
async function lySavePlaces() {
  const ly = lyById(lyState.editing),
    orig = ly.members.map((m) => m.place || m.shape),
    add = [...lyState.staged].filter((p) => !orig.includes(p)),
    remove = orig.filter((p) => !lyState.staged.has(p));
  try {
    if (add.length || remove.length) await postJSON(AHM_CONFIG.url.layerSave, { layer_members: { id: ly.id, add, remove } });
    lyState.editing = null;
    lyState.staged = null;
    await lyReload();
  } catch (e) {
    $('#lyErr').textContent = e.message;
  }
}
function lyFit() {
  const ly = lyById(lyState.open),
    ps = ly ? places.filter((p) => lyMembers[ly.id].has(p.id)) : [],
    ss = ly ? shapes.filter((s) => lyMembers[ly.id].has(s.id)) : [];
  AHM.map.fitTo([...ps.map((p) => [p.lon, p.lat]), ...ss.flatMap((s) => bboxCorners(geomBBox(s.geometry)))]);
}

// ---- the layer form (new / change) ----
const lyDescRow = (d) =>
  `<div class="row ly-desc"><select class="dl" aria-label="Language">${langOptions(d.lang)}</select>` +
  `<textarea class="dt" rows="3" placeholder="description" aria-label="Description">${esc(d.text)}</textarea>` +
  '<button type="button" class="ly-ddel" title="Remove this description">✕</button></div>';
let lyForm = null; // the layer being changed, or null for a new one
function lyOpenForm(ly) {
  lyForm = ly || null;
  const names = ly ? ly.names : [{ lang: $('#lang').value || 'en', name: '' }],
    descs = ly && ly.descriptions.length ? ly.descriptions : [];
  $('#lyTitle').textContent = ly ? 'Edit layer' : 'Add layer';
  $('#lyForm').innerHTML =
    `<div class="label">Names</div><div class="pf-names">${names.map((n) => pfRow(n)).join('')}</div>` +
    '<button type="button" class="pf-add">+ Add another name</button>' +
    `<div class="sn">${LANG_HINT}</div>` +
    '<div class="label">Description (one per language, optional)</div><div id="lyDescs">' +
    descs.map(lyDescRow).join('') +
    '</div><button type="button" class="ly-dadd">+ Add a description</button>' +
    '<div class="label">Category (optional)</div><select id="lyFCat"><option value="">— none —</option>' +
    categories.map((c) => `<option value="${c.id}"${ly && ly.category === c.id ? ' selected' : ''}>${esc(catName(c, $('#lang').value))}</option>`).join('') +
    '</select>' +
    '<div class="label">Dates (optional)</div><div class="pf-sub">From</div>' +
    dfHTML('ly-from', ly && ly.date_from) +
    '<div class="pf-sub">To</div>' +
    dfHTML('ly-to', ly && ly.date_to) +
    `<div class="label">Colour (optional)</div><div class="row"><label><input type="checkbox" id="lyUseColor"${ly && ly.color ? ' checked' : ''}> use a colour</label>` +
    `<input type="color" id="lyColor" value="${ly && ly.color ? esc(ly.color) : '#9a3b2e'}"></div>`;
  $('#lyErr2').textContent = '';
  lyValidate();
  $('#lyDlg').showModal();
}
function lyReadForm() {
  const root = $('#lyForm'),
    names = lyReadNames(root);
  if (!names.length) throw Error('Give the layer at least one name.');
  const descriptions = [...root.querySelectorAll('.ly-desc')]
    .map((r) => ({ lang: r.querySelector('.dl').value, text: r.querySelector('.dt').value.trim() }))
    .filter((d) => d.text);
  const from = dfRead(root.querySelector('.ly-from'), 'From'),
    to = dfRead(root.querySelector('.ly-to'), 'To');
  dateOrderCheck(from, to);
  return {
    id: lyForm ? lyForm.id : undefined,
    names,
    descriptions,
    category: $('#lyFCat').value || null,
    date_from: from,
    date_to: to,
    color: $('#lyUseColor').checked ? $('#lyColor').value : null,
  };
}
/** [{lang, name}] of the name rows (place form rows, see placeform.js) inside root. */
const lyReadNames = (root) =>
  [...root.querySelectorAll('.pf-name')]
    .map((r) => ({ lang: r.querySelector('.nl').value, name: r.querySelector('.nn').value.trim() }))
    .filter((n) => n.name);

// ---- a note of a layer (uses the note dialog of ui.js) ----
/** The notes of a border or a route, as a block of its card. `attr` = the data attribute of its buttons (`shact` or `rtact`). */
function lyOwnerNotesHTML(id, l, attr) {
  const can = AHM_CONFIG.canEdit,
    ns = layerNotes
      .filter((n) => n.layer === id && (!l || n.lang === l))
      .sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.title.localeCompare(b.title));
  return (
    '<div class="label">Notes</div>' +
    (ns
      .map(
        (n) =>
          `<div class="ly-note"><div class="note-head"><div class="note-meta"><b>${esc(n.title)}</b> <span class="sn">${n.date ? esc(dateText(n.date)) + ' · ' : ''}${esc(langName(n.lang))}</span></div>${can ? `<button type="button" class="icon-btn sm" data-${attr}="editnote" data-id="${n.id}" title="Edit note" aria-label="Edit note">${AHM.icons.svg('pencil', 16)}</button>` : ''}</div>${lyPara(n.text)}</div>`
      )
      .join('') || '<p class="sn">No notes yet.</p>') +
    (can ? `<button type="button" data-${attr}="addnote">Add note</button>` : '')
  );
}
/** Opens the note dialog for a layer, or for a border or route (`what` = 'layer' | 'border' | 'route'; the owner is any object with `id` and `names`). */
function lyOpenNoteDlg(ly, note, what = 'layer') {
  dlg = { mode: 'lnote', p: null, note, layer: ly };
  $('#dErr').textContent = '';
  $('#dPlace').style.display = 'none';
  $('#dLayersPlace').innerHTML = '';
  $('#dLayersNote').innerHTML = '';
  $('#dTitle').textContent = (note ? 'Edit note' : 'New note') + ' · ' + lyName(ly, $('#lang').value);
  $('#dNoteHead').textContent = 'Note about the ' + what;
  $('#nLang').innerHTML = langOptions(note ? note.lang : $('#lang').value || 'en');
  $('#nDate').innerHTML = dfHTML('n-date', note ? note.date : null);
  $('#nTitle').value = note ? note.title : '';
  $('#nText').value = note ? note.text : '';
  $('#dlg').showModal();
}
/** Called by the Save button of the note dialog when the note belongs to a layer. */
async function lyDlgSave() {
  try {
    const title = $('#nTitle').value.trim(),
      text = $('#nText').value.trim();
    if (!title) throw Error('A note needs a title.');
    if (!text) throw Error('Write the note text.');
    await postJSON(AHM_CONFIG.url.layerSave, {
      layer_note: {
        layer_id: dlg.layer.id,
        note: { id: dlg.note && dlg.note.id, lang: $('#nLang').value, title, date: dfRead($('#nDate .df'), 'Note date'), text },
      },
    });
    await lyReload();
    if (typeof shRenderView === 'function') shRenderView(); // the card of a border or a route shows its notes
    if (typeof rtRenderView === 'function') rtRenderView();
    $('#dlg').close();
  } catch (e) {
    $('#dErr').textContent = e.message;
  }
}

// ---- layer choices inside the place / note dialog ----
/** Fills the "layers" tick boxes of the dialog: all layers for a new place, the layers of the place for a note. */
function lyDlgLayers(mode, p, note) {
  const l = $('#lang').value,
    ctx = [...(lyState.open ? [lyState.open] : []), ...lyState.only],
    box = (ids, on, head) =>
      ids.length
        ? `<div class="label">${head}</div>` +
          ids
            .map((id) => `<label class="ly-check"><input type="checkbox" value="${id}"${on.includes(id) ? ' checked' : ''}> ${esc(lyName(lyById(id), l))}</label>`)
            .join('')
        : '';
  $('#dNoteHead').textContent = mode === 'place' ? 'Note (optional for a new place)' : 'Note';
  const sorted = (ids) => ids.slice().sort((a, b) => lyName(lyById(a), l).localeCompare(lyName(lyById(b), l)));
  $('#dLayersPlace').innerHTML =
    mode === 'place' && layers.length
      ? box(sorted(layers.map((x) => x.id)), ctx, 'Add the new place to layers (it stays on the main map as well; a note below is tied to the same layers)')
      : '';
  const mine = mode === 'note' ? sorted(layers.filter((x) => lyMembers[x.id].has(p.id)).map((x) => x.id)) : [];
  $('#dLayersNote').innerHTML = box(
    mine,
    note ? note.layers || [] : ctx.filter((id) => mine.includes(id)),
    'This note belongs to layers (it is always visible in the general layer too)'
  );
}
const lyDlgChecked = () => [...document.querySelectorAll('#dLayersPlace input:checked, #dLayersNote input:checked')].map((i) => i.value);

// ---- the layers of one place (place details) ----
function lyPlaceHTML(p) {
  const l = $('#lang').value,
    mine = layers.filter((x) => lyMembers[x.id].has(p.id)),
    others = layers.filter((x) => !lyMembers[x.id].has(p.id)),
    can = AHM_CONFIG.canEdit;
  return (
    '<div class="label">Layers</div><div class="chips">' +
    (mine
      .map(
        (x) =>
          `<span class="chip ly-chip"><a href="#layer-${x.id}" data-lyact="goto" data-lid="${x.id}">${lySwatch(x.color)}${esc(lyName(x, l))}</a>` +
          (can ? `<button data-lyact="leave" data-lid="${x.id}" title="Take this place out of the layer (it stays on the main map)">✕</button>` : '') +
          '</span>'
      )
      .join('') || '<span class="sn">Not in any layer.</span>') +
    '</div>' +
    (can && others.length
      ? '<select id="lyJoin" aria-label="Add to a layer"><option value="">Add to a layer…</option>' +
        others.map((x) => `<option value="${x.id}">${esc(lyName(x, l))}</option>`).join('') +
        '</select>'
      : '')
  );
}
/** The line above the notes of a place when only some notes are shown. */
function lyScopeHTML(scope, shown, total) {
  if (!scope) return '';
  const l = $('#lang').value;
  return (
    `<div class="sn ly-scope">Notes of the layer${scope.length > 1 ? 's' : ''} ${scope.map((id) => esc(lyName(lyById(id), l))).join(', ')} (${shown} of ${total}). ` +
    '<a href="#" data-lyact="noteall">Show all notes</a></div>'
  );
}

// ---- categories (a dictionary like the languages; administrators add and rename) ----
// Table without lines: [pencil] [name in the filter language] [all names]. The pencil opens the name fields under that row;
// "Add" (full width) opens the same fields under the list. Save and Cancel are half width each.
// small icons shared with the languages table in ui.js
const ICON_PENCIL =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_PLUS =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
let lyCatOpen = null; // null = nothing is edited, 'new' = adding, otherwise the id of the category being renamed
const catEditorHTML = (title) =>
  `<div class="label">${title}</div><div class="pf" id="catForm"><div class="pf-names"></div><button type="button" class="pf-add">+ Add another name</button></div>` +
  '<div class="btn-pair"><button id="catSave" class="primary" disabled>Save</button><button id="catCancel">Cancel</button></div><div id="catErr" class="sn"></div>';
function lyRenderCats() {
  const l = $('#lang').value,
    admin = AHM_CONFIG.canLayerAdmin;
  if (!admin) lyCatOpen = null;
  $('#catList').innerHTML =
    categories
      .slice()
      .sort((a, b) => catName(a, l).localeCompare(catName(b, l)))
      .map(
        (c) =>
          `<li class="tr tr-cat${lyCatOpen === c.id ? ' on' : ''}" data-cid="${c.id}"><span class="tc-btn">` +
          (admin
            ? `<button type="button" class="icon-btn" data-lyact="editcat" data-cid="${c.id}" title="Rename ${esc(catName(c, l))}" aria-label="Rename ${esc(catName(c, l))}">${ICON_PENCIL}</button>`
            : '') +
          `</span><b>${esc(catName(c, l))}</b><span class="sn">${esc(c.names.map((n) => n.name + ' [' + n.lang + ']').join(' · '))}</span></li>`
      )
      .join('') || '<li class="empty">No categories yet.</li>';
  if (!admin) {
    $('#catAdmin').innerHTML = '<div class="sn">Only administrators can add a category. Missing one? Ask an administrator.</div>';
  } else if (lyCatOpen) {
    // one editor at the bottom of the fold for both a new category and a rename (the renamed row is marked)
    $('#catAdmin').innerHTML = catEditorHTML(lyCatOpen === 'new' ? 'New category' : 'Rename category');
  } else {
    $('#catAdmin').innerHTML = '<button id="catAdd" class="wide">+ Add category</button>';
  }
  if ($('#catForm')) {
    placeFormWire($('#catForm'));
    catFill(lyCatOpen === 'new' ? null : catById(lyCatOpen));
  }
}
// Save stays off until at least one name is filled.
const catValidate = () => {
  const b = $('#catSave');
  if (b) b.disabled = !lyReadNames($('#catForm')).length;
};
function catFill(c) {
  lyCatEditing = c ? c.id : null;
  $('#catForm .pf-names').innerHTML = (c ? c.names : [{ lang: $('#lang').value || 'en', name: '' }]).map((n) => pfRow(n)).join('');
  $('#catErr').textContent = '';
  catValidate();
}

// ---- events ----
$('#lyQ').addEventListener('input', lyRenderList);
$('#lyCat').addEventListener('change', lyRenderList);
$('#lang').addEventListener('input', () => {
  lyFillCats();
  lyRender();
});
$('#lyNew').onclick = () => lyOpenForm(null);
$('#ly-add').hidden = !AHM_CONFIG.canEdit;
$('#lyList').addEventListener('click', (e) => {
  // the details handle their own clicks (they may already have re-rendered, so ask the original event path, not the detached target)
  if (e.composedPath().includes($('#lyDetail'))) return;
  const b = e.target.closest('[data-lyact]'),
    li = e.target.closest('li[data-lid]');
  if (b) lyToggleFilter(b.dataset.lyact, b.dataset.lid);
  else if (li && lyState.open === li.dataset.lid) {
    if (!lyState.editing) lyClose(); // a second click on the open layer folds it
  } else if (li) lyOpen(li.dataset.lid);
});
$('#lyActive').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lyact="unfilter"]');
  if (b) lyToggleFilter(b.dataset.kind, b.dataset.lid);
});
$('#lyDetail').addEventListener('click', async (e) => {
  const li = e.target.closest('.ly-members li[data-pid]'),
    pk = e.target.closest('#lyPick li[data-pid]'),
    a = e.target.closest('[data-lyact]'),
    ly = lyById(lyState.open);
  if (pk) {
    if (e.target.tagName !== 'INPUT') e.preventDefault(); // the label would toggle the box a second time
    return lyToggleMember(pk.dataset.pid);
  }
  if (li && !a) return show(li.dataset.pid);
  const sli = e.target.closest('.ly-members li[data-sid]');
  if (sli && !a) return shOpen(sli.dataset.sid);
  if (!a || !ly) return;
  const act = a.dataset.lyact;
  if (act === 'only' || act === 'hide') lyToggleFilter(act, ly.id);
  else if (act === 'show') {
    lyState.only.delete(ly.id);
    lyState.hide.delete(ly.id);
    AHM.state.patch('layers', {});
    lyChanged();
  }
  else if (act === 'fit') lyFit();
  else if (act === 'close') lyClose();
  else if (act === 'editlayer') lyOpenForm(ly);
  else if (act === 'editplaces') lyStartEdit();
  else if (act === 'saveplaces') lySavePlaces();
  else if (act === 'cancelplaces') lyStopEdit();
  else if (act === 'addnote') lyOpenNoteDlg(ly, null);
  else if (act === 'editnote') lyOpenNoteDlg(ly, layerNotes.find((n) => n.id === a.dataset.id));
  else if (act === 'delete' && confirm(`Delete the layer “${lyName(ly, $('#lang').value)}”? Its places and their notes stay on the map. A copy is archived.`)) {
    try {
      await postJSON(AHM_CONFIG.url.layerDelete, { id: ly.id });
      lyClose();
      await lyReload();
    } catch (x) {
      $('#lyErr').textContent = x.message;
    }
  }
});
$('#lyDetail').addEventListener('input', (e) => {
  if (e.target.id !== 'lyPickQ') return;
  $('#lyPick').innerHTML = lyPickRows(e.target.value);
});
// place details: layers of the place
$('#detail').addEventListener('click', async (e) => {
  const a = e.target.closest('[data-lyact]');
  if (!a || !cur) return;
  const act = a.dataset.lyact;
  if (act === 'noteall') {
    e.preventDefault();
    lyState.noteAll = true;
    show(cur.id);
  } else if (act === 'goto') {
    e.preventDefault();
    const id = a.dataset.lid;
    closeDetail();
    lyOpen(id);
  } else if (act === 'leave') {
    try {
      await postJSON(AHM_CONFIG.url.layerSave, { layer_members: { id: a.dataset.lid, remove: [cur.id] } });
      await lyReload();
      show(cur.id);
    } catch (x) {
      alert(x.message);
    }
  }
});
$('#detail').addEventListener('change', async (e) => {
  if (e.target.id !== 'lyJoin' || !e.target.value || !cur) return;
  try {
    await postJSON(AHM_CONFIG.url.layerSave, { layer_members: { id: e.target.value, add: [cur.id] } });
    await lyReload();
    show(cur.id);
  } catch (x) {
    alert(x.message);
  }
});
// the layer form
placeFormWire($('#lyForm'));
$('#lyForm').addEventListener('click', (e) => {
  if (e.target.closest('.ly-dadd')) $('#lyDescs').insertAdjacentHTML('beforeend', lyDescRow({ lang: $('#lang').value || 'en', text: '' }));
  else if (e.target.closest('.ly-ddel')) e.target.closest('.ly-desc').remove();
});
$('#lyCancel').onclick = () => $('#lyDlg').close();
// Save is off until the layer has at least one name
const lyValidate = () => ($('#lySave').disabled = !lyReadNames($('#lyForm')).length);
$('#lyForm').addEventListener('input', lyValidate);
$('#lyForm').addEventListener('click', () => setTimeout(lyValidate)); // a name row may have been removed
$('#lySave').onclick = async () => {
  try {
    const layer = lyReadForm();
    $('#lyErr2').textContent = 'Saving…';
    const j = await postJSON(AHM_CONFIG.url.layerSave, { layer });
    await lyReload();
    $('#lyDlg').close();
    lyOpen(j.id);
  } catch (e) {
    $('#lyErr2').textContent = e.message;
  }
};
// categories
$('#catList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lyact="editcat"]');
  if (b) {
    lyCatOpen = b.dataset.cid;
    lyRenderCats();
    $('#catAdmin').scrollIntoView({ block: 'nearest' });
    $('#catForm .nn').focus();
  }
});
async function catClick(e) {
  if (e.target.id === 'catAdd') {
    lyCatOpen = 'new';
    lyRenderCats();
    return $('#catForm .nn').focus();
  }
  if (e.target.id === 'catCancel') {
    lyCatOpen = null;
    return lyRenderCats();
  }
  if (e.target.id !== 'catSave') return;
  try {
    const names = lyReadNames($('#catForm'));
    if (!names.length) throw Error('Give the category at least one name.');
    $('#catErr').textContent = 'Saving…';
    await postJSON(AHM_CONFIG.url.categorySave, { id: lyCatEditing || undefined, names });
    lyCatOpen = null;
    await lyReload();
  } catch (x) {
    $('#catErr').textContent = x.message;
  }
}
$('#catAdmin').addEventListener('click', catClick);
$('#catAdmin').addEventListener('input', catValidate);
$('#catAdmin').addEventListener('click', () => setTimeout(catValidate)); // a name row may have been removed
$('#catList').addEventListener('click', catClick);
