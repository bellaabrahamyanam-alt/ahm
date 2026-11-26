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
/** The three-state control of a row: kind = show (neither filter) | only | hide. */
function lySetFilter(id, kind) {
  lyState.only.delete(id);
  lyState.hide.delete(id);
  if (kind !== 'show') lyState[kind].add(id);
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

// ---- rendering: templates of the tpl-layers region of index.html, filled with text and attributes (no markup is built here) ----
const lyMore = new Set(); // layers whose full place list is shown ("+ N more" was clicked)
let lyFormOpen = false;
const LY_FEW = 3; // places shown before "+ N more"
/** The node tests load this file without the page: nothing is drawn there. */
const lyReady = () => typeof kit !== 'undefined' && typeof document.getElementById === 'function' && !!document.getElementById('t-ly-row');

function lyRender() {
  lyRenderActive();
  lyRenderDetail(); // draws the list too
  lyRenderCats();
}
/** The "Layers" line of the Explore filters. */
function lyRenderActive() {
  if (!lyReady()) return;
  const l = $('#lang').value,
    box = $('#lyActive');
  box.replaceChildren();
  for (const [kind, ids] of [['only', lyState.only], ['hide', lyState.hide]])
    for (const id of ids) {
      const c = kit.tpl('t-ly-chip');
      kit.fill(c, { text: (kind === 'only' ? 'only' : 'not in') + ' · ' + lyName(lyById(id), l) });
      c.dataset.kind = kind;
      c.dataset.lid = id;
      box.append(c);
    }
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
/** The layers the list shows: category and search applied, sorted by name in language l. Pure. */
const lyRows = (q, cat, l) =>
  layers
    .filter((ly) => (!cat || ly.category === cat) && (!q || lyHay(ly).includes(norm(q))))
    .sort((a, b) => lyName(a, l).localeCompare(lyName(b, l)));
const lyCounts = (ly) => {
  const np = ly.members.filter((m) => m.place).length;
  return { np, ns: ly.members.length - np };
};
const lyPlural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function lyRenderList() {
  const l = $('#lang').value,
    q = $('#lyQ').value,
    cat = $('#lyCat').value,
    rows = lyRows(q, cat, l);
  $('#lyCount').textContent = rows.length === layers.length ? lyPlural(layers.length, 'layer', 'layers') : rows.length + ' of ' + layers.length + ' layers';
  if (!lyReady()) return;
  const open = lyState.open && lyById(lyState.open);
  if (open && !rows.includes(open)) rows.unshift(open); // the open layer always has a row, even when the filter hides it
  $('#ly-add').hidden = !AHM_CONFIG.canEdit || !!open; // Add layer is for the list; an open card has its own tools
  const state = $('#lyState');
  state.replaceChildren();
  if (!layers.length) kit.state(state, 'empty', 'No layers yet.');
  else if (!rows.length) kit.state(state, 'empty', 'No layers match.');
  kit.list($('#lyList'), rows, 't-ly-row', (node, ly) => lyFillRow(node, ly, l));
}
function lyFillRow(node, ly, l) {
  const c = catById(ly.category),
    { np, ns } = lyCounts(ly),
    on = lyState.open === ly.id,
    meta = [lyWhen(ly), lyPlural(np, 'place', 'places'), ns ? lyPlural(ns, 'border', 'borders') : ''].filter(Boolean).join(' · ');
  kit.fill(node, { name: lyName(ly, l), cat: catName(c, l), meta });
  kit.show(node.querySelector('.ly-cat'), !!c);
  if (ly.color) node.style.setProperty('--ly-c', ly.color);
  else node.style.removeProperty('--ly-c');
  node.classList.toggle('ly-hidden', lyState.hide.has(ly.id));
  node.dataset.open = on ? 'true' : 'false';
  node.querySelector('.ly-open').setAttribute('aria-expanded', String(on));
  const now = lyState.only.has(ly.id) ? 'only' : lyState.hide.has(ly.id) ? 'hide' : 'show';
  node.querySelectorAll('.ly-three input').forEach((r) => {
    r.name = 'lys-' + ly.id;
    r.checked = r.value === now;
  });
  const card = node.querySelector('[data-card]');
  kit.show(card, on);
  if (on) lyFillCard(card, ly, l);
}
// the symbol of a place type, as the map draws it (typeicons.js); borders and routes get a dot of their colour
const lyIcons = {};
// typeIcon (I-4, map domain) gives an <img> string: only its picture address is taken from it
const lyTypeSrc = (t) => lyIcons[t] || (lyIcons[t] = (/src="([^"]*)"/.exec(typeIcon(t)) || [])[1] || '');
function lyPlaceRow(p, l) {
  const li = kit.tpl('t-ly-place');
  kit.fill(li, { name: label(p, l) });
  li.dataset.pid = p.id;
  li.querySelector('.ly-ti').src = lyTypeSrc(p.type);
  return li;
}
function lyShapeRow(s, l) {
  const li = kit.tpl('t-ly-place'),
    dot = li.querySelector('.ly-dot');
  kit.fill(li, { name: shapeName(s, l) });
  li.dataset.sid = s.id;
  li.querySelector('.ly-ti').hidden = true;
  dot.hidden = false;
  dot.style.setProperty('--ly-c', shapeType(s.type).color);
  return li;
}
/** The card of the open layer, inside its row (frame s086). */
function lyFillCard(card, ly, l) {
  const can = AHM_CONFIG.canEdit,
    byId = new Map(places.map((p) => [p.id, p])),
    ps = ly.members.map((m) => m.place && byId.get(m.place)).filter(Boolean),
    ss = ly.members.map((m) => m.shape && shapeById(m.shape)).filter(Boolean),
    ns = layerNotes
      .filter((n) => n.layer === ly.id && (!l || n.lang === l))
      .sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.title.localeCompare(b.title)),
    all = lyMore.has(ly.id),
    q = (k) => card.querySelector(`[data-${k}]`);
  kit.show(card.querySelector('.ly-tools'), can);
  kit.show(card.querySelector('[data-act="edit"]'), can);
  kit.show(card.querySelector('[data-act="places"]'), can);
  kit.show(card.querySelector('[data-act="delete"]'), can && AHM_CONFIG.canLayerAdmin);
  // other names, descriptions (the ones in the filter language, else all)
  const other = ly.names.filter((n) => n.name !== lyName(ly, l));
  q('names').textContent = other.map((n) => `${n.name} [${n.lang}]`).join(' · ');
  kit.show(q('names'), other.length > 0);
  q('desc').replaceChildren(
    ...ly.descriptions
      .filter((d) => !l || d.lang === l || !ly.descriptions.some((x) => x.lang === l))
      .map((d) => {
        const p = kit.tpl('t-ly-p');
        kit.fill(p, { lang: ly.descriptions.length > 1 ? d.lang : '', text: d.text });
        kit.show(p.querySelector('.badge'), ly.descriptions.length > 1);
        return p;
      })
  );
  kit.fill(card, { placesHead: 'Places · ' + ps.length, shapesHead: 'Borders and routes · ' + ss.length, notesHead: 'Notes about this layer · ' + ns.length });
  q('places').replaceChildren(...(all ? ps : ps.slice(0, LY_FEW)).map((p) => lyPlaceRow(p, l)));
  const more = card.querySelector('[data-act="more"]');
  kit.show(more, ps.length > LY_FEW);
  more.textContent = all ? 'Show fewer' : `+ ${ps.length - LY_FEW} more`;
  kit.show(q('shapes-head'), ss.length > 0);
  q('shapes').replaceChildren(...ss.map((s) => lyShapeRow(s, l)));
  q('notes').replaceChildren(
    ...ns.map((n) => {
      const a = fields.note({ title: n.title, lang: n.lang, when: n.date ? dateText(n.date) : '', text: n.text });
      a.dataset.id = n.id;
      if (can) a.querySelector('[data-actions]').append(kit.tpl('t-ly-noteact'));
      return a;
    })
  );
  kit.show(q('no-notes'), !ns.length);
  kit.show(card.querySelector('[data-act="addnote"]'), can);
  if (can) q('readonly').replaceChildren();
  else kit.state(q('readonly'), 'readonly', 'Log in to change layers.');
}
const lyOption = (text, value) => {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
};
function lyFillCats() {
  if (!lyReady()) return;
  const v = $('#lyCat').value,
    l = $('#lang').value;
  $('#lyCat').replaceChildren(
    lyOption('All categories', ''),
    ...categories
      .slice()
      .sort((a, b) => catName(a, l).localeCompare(catName(b, l)))
      .map((c) => lyOption(catName(c, l), c.id))
  );
  $('#lyCat').value = categories.some((c) => c.id === v) ? v : '';
}
/** Which of the three views of the tab is shown: the list (with the card), choosing places, or the form. */
function lyShowView() {
  if (!lyReady()) return;
  const v = lyFormOpen ? 'form' : lyState.editing ? 'pick' : 'list';
  kit.show($('#lyListView'), v === 'list');
  kit.show($('#lyPickView'), v === 'pick');
  kit.show($('#lyFormView'), v === 'form');
}
function lyRenderDetail() {
  lyRenderList(); // the open card is part of its row
  if (!lyReady()) return;
  lyShowView();
  if (lyState.editing) lyRenderPick();
  const li = lyState.open && document.querySelector(`#lyList > li[data-id="${lyState.open}"]`);
  if (li && curTab === 'layers' && !lyState.editing) li.scrollIntoView({ block: 'nearest' });
}
/** The checkbox lists of "Choose places and borders" (frame s087). */
function lyRenderPick() {
  const l = $('#lang').value,
    q = norm($('#lyPickQ').value),
    row = (id, name, type) => ({ id, name, type });
  const ps = places
      .filter((p) => !q || p.names.some((n) => norm(n.name).includes(q)))
      .sort((a, b) => label(a, l).localeCompare(label(b, l)))
      .map((p) => row(p.id, label(p, l), typeLabel(p.type, l))),
    ss = shapes
      .filter((s) => !q || s.names.some((n) => norm(n.name).includes(q)))
      .sort((a, b) => shapeName(a, l).localeCompare(shapeName(b, l)))
      .map((s) => row(s.id, shapeName(s, l), shapeType(s.type).label));
  const fill = (box, items) =>
    kit.list(box, items, 't-ly-pickrow', (node, it) => {
      kit.fill(node, { name: it.name, type: it.type });
      node.dataset.pid = it.id;
      node.querySelector('input').checked = lyState.staged.has(it.id);
    });
  fill($('#lyPick'), ps);
  fill($('#lyPickShapes'), ss);
  kit.show($('#lyPickShapesHead'), ss.length > 0);
  kit.show($('#lyPickNone'), !ps.length && !ss.length);
  lyDelta();
}
function lyDelta() {
  const ly = lyById(lyState.editing);
  if (!ly) return;
  const orig = new Set(ly.members.map((m) => m.place || m.shape)),
    add = [...lyState.staged].filter((p) => !orig.has(p)).length,
    rem = [...orig].filter((p) => !lyState.staged.has(p)).length;
  $('#lyAddN').textContent = '+' + add;
  $('#lyRemN').textContent = '−' + rem;
  $('#lyDelta').hidden = !!(add || rem);
}
/** A save or load error, or a loading skeleton, in a container (Foundation states). */
function lyShowState(box, kind, text, retry) {
  if (lyReady()) kit.state(box, kind, text, retry);
}
/** The load failed (ui.js): the Layers tab shows it with Retry. */
const lyFail = (msg, retry) => lyShowState($('#lyState'), 'error', msg, retry);

// ---- opening, closing, choosing places ----
function lyOpen(id) {
  if (!lyById(id)) return;
  lyStopEdit();
  lyCloseForm();
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
  if (lyReady()) {
    $('#lyPickQ').value = '';
    $('#lyErr').replaceChildren();
  }
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
  const cb = document.querySelector(`#lyPickView li[data-pid="${pid}"] input`);
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
    lyShowState($('#lyErr'), 'error', e.message);
  }
}
function lyFit() {
  const ly = lyById(lyState.open),
    ps = ly ? places.filter((p) => lyMembers[ly.id].has(p.id)) : [],
    ss = ly ? shapes.filter((s) => lyMembers[ly.id].has(s.id)) : [];
  AHM.map.fitTo([...ps.map((p) => [p.lon, p.lat]), ...ss.flatMap((s) => bboxCorners(geomBBox(s.geometry)))]);
}

// ---- the layer form (frame s088): a view of the tab, with the Foundation form frame and fields ----
let lyForm = null; // the layer being changed, or null for a new one
const lyLangs = () => languages.map((x) => ({ code: x.code, name: x.name }));
const lyHideNamePeriod = (root) => root.querySelectorAll('.ahm-name [data-period]').forEach((p) => (p.hidden = true)); // a layer name has no period
function lyDescRow(d) {
  const r = kit.tpl('t-ly-desc');
  r.querySelector('[data-lang]').append(fields.pills(lyLangs(), d.lang));
  kit.fill(r, { text: d.text });
  return r;
}
const lyDateOpts = (d) => ({ modes: d && (d.mode === 'approx' || d.mode === 'range') ? ['none', 'exact', 'approx', 'range'] : ['none', 'exact'], names: { none: 'Unknown' } });
function lyOpenForm(ly) {
  lyForm = ly || null;
  const l = $('#lang').value,
    f = fields.form(ly ? 'Edit layer' : 'Add layer'),
    body = kit.tpl('t-ly-form'),
    names = ly ? ly.names : [{ lang: l || 'en', name: '' }];
  f.querySelector('[data-body]').append(body);
  fields.nameList(body.querySelector('[data-names]'), lyLangs(), names);
  lyHideNamePeriod(body);
  body.querySelector('[data-descs]').replaceChildren(...(ly ? ly.descriptions : []).map(lyDescRow));
  const cat = body.querySelector('[data-cat]');
  cat.replaceChildren(
    lyOption('— none —', ''),
    ...categories.map((c) => lyOption(catName(c, l), c.id))
  );
  cat.value = ly && ly.category ? ly.category : '';
  body.querySelector('[data-from]').append(fields.date(ly && ly.date_from, lyDateOpts(ly && ly.date_from)));
  body.querySelector('[data-to]').append(fields.date(ly && ly.date_to, lyDateOpts(ly && ly.date_to)));
  const color = (ly && ly.color) || '#9a3b2e',
    use = body.querySelector('[data-use]'),
    pick = body.querySelector('[data-color]'),
    sw = body.querySelector('[data-swatches]'),
    mark = () => sw.querySelectorAll('[data-swatch]').forEach((b) => b.classList.toggle('ahm-on', use.checked && b.dataset.swatch === pick.value.toLowerCase()));
  use.checked = !!(ly && ly.color);
  pick.value = color;
  for (const x of UI_SWATCHES) {
    const b = kit.tpl('t-swatch');
    b.dataset.swatch = x;
    b.style.background = x;
    b.setAttribute('aria-label', 'Colour ' + x);
    sw.append(b);
  }
  kit.on(sw, 'click', '[data-swatch]', (e, b) => {
    pick.value = b.dataset.swatch;
    use.checked = true;
    mark();
  });
  pick.addEventListener('input', () => ((use.checked = true), mark()));
  use.addEventListener('change', mark);
  mark();
  $('#lyFormView').replaceChildren(f);
  lyFormOpen = true;
  lyShowView();
  fields.fit && f.querySelectorAll('.ahm-pills').forEach((p) => fields.fit(p));
  const first = f.querySelector('[data-value="name"]');
  if (first) first.focus();
}
function lyCloseForm() {
  if (!lyFormOpen) return;
  lyFormOpen = false;
  lyForm = null;
  if (lyReady()) $('#lyFormView').replaceChildren();
  lyShowView();
}
/** [{lang, name}] of the name rows (place form rows, see placeform.js) inside root; used by the category editor. */
const lyReadNames = (root) =>
  [...root.querySelectorAll('.pf-name')]
    .map((r) => ({ lang: r.querySelector('.nl').value, name: r.querySelector('.nn').value.trim() }))
    .filter((n) => n.name);
/** The layer object of the form; throws a readable Error. */
function lyReadForm(root) {
  const names = fields.readNames(root.querySelector('[data-names]'));
  if (!names.length) throw Error('Give the layer at least one name.');
  const descriptions = [...root.querySelectorAll('.ly-descrow')]
    .map((r) => ({ lang: r.querySelector('.ahm-pills').dataset.value, text: r.querySelector('[data-value="text"]').value.trim() }))
    .filter((d) => d.text);
  const [from, to] = [['[data-from] .ahm-date', 'From'], ['[data-to] .ahm-date', 'To']].map(([s, w]) => fields.dateRead(root.querySelector(s), w));
  dateOrderCheck(from, to);
  return {
    id: lyForm ? lyForm.id : undefined,
    names,
    descriptions,
    category: root.querySelector('[data-cat]').value || null,
    date_from: from,
    date_to: to,
    color: root.querySelector('[data-use]').checked ? root.querySelector('[data-color]').value : null,
  };
}
/** Shows the message of a failed form: under the first name when the names are the problem, else at the end of the form. */
function lyFormError(root, msg) {
  kit.clear(root);
  root.querySelector('[data-err]').replaceChildren();
  const n = root.querySelector('[data-value="name"]');
  if (/name/.test(msg) && n) kit.invalid(n, msg);
  else kit.state(root.querySelector('[data-err]'), 'error', msg);
}
async function lySaveForm(f) {
  const save = f.querySelector('[data-act="save"]');
  try {
    kit.clear(f);
    f.querySelector('[data-err]').replaceChildren();
    const layer = lyReadForm(f);
    save.disabled = true;
    kit.fill(f, { save: 'Saving…' });
    const j = await postJSON(AHM_CONFIG.url.layerSave, { layer });
    await lyReload();
    lyCloseForm();
    lyOpen(j.id);
  } catch (e) {
    save.disabled = false;
    kit.fill(f, { save: 'Save' });
    lyFormError(f, e.message);
  }
}

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
  if (lyState.editing) lyRenderPick();
});
$('#lyNew').onclick = () => lyOpenForm(null);
$('#ly-add').hidden = !AHM_CONFIG.canEdit;
const lyOf = (node) => lyById(node.closest('li[data-id]').dataset.id);
// the list: one delegated handler for the rows and the cards inside them
$('#lyList').addEventListener('change', (e) => {
  const r = e.target.closest('input[data-lyact]');
  if (r) lySetFilter(lyOf(r).id, r.value);
});
$('#lyList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !e.currentTarget.contains(b)) return;
  const act = b.dataset.act,
    ly = lyOf(b),
    li = b.closest('li[data-pid], li[data-sid]');
  if (act === 'open') return lyState.open === ly.id ? !lyState.editing && lyClose() : lyOpen(ly.id); // a second click on the open layer folds it
  if (act === 'goto') return li.dataset.sid ? shOpen(li.dataset.sid) : show(li.dataset.pid);
  if (lyState.open !== ly.id) return;
  if (act === 'edit') lyOpenForm(ly);
  else if (act === 'places') lyStartEdit();
  else if (act === 'fit') lyFit();
  else if (act === 'more') (lyMore.has(ly.id) ? lyMore.delete(ly.id) : lyMore.add(ly.id), lyRenderList());
  else if (act === 'addnote') lyOpenNoteDlg(ly, null);
  else if (act === 'editnote') lyOpenNoteDlg(ly, layerNotes.find((n) => n.id === b.closest('[data-note]').dataset.id));
  else if (act === 'remove') {
    try {
      await postJSON(AHM_CONFIG.url.layerSave, { layer_members: { id: ly.id, remove: [li.dataset.pid || li.dataset.sid] } });
      await lyReload();
    } catch (x) {
      lyShowState(b.closest('li[data-id]').querySelector('[data-err]'), 'error', x.message);
    }
  } else if (act === 'delete') {
    if (!(await dialogs.confirm('delete-layer', { name: lyName(ly, $('#lang').value) }))) return;
    try {
      await postJSON(AHM_CONFIG.url.layerDelete, { id: ly.id });
      lyClose();
      await lyReload();
    } catch (x) {
      lyShowState(document.querySelector(`#lyList > li[data-id="${ly.id}"] [data-err]`), 'error', x.message);
    }
  }
});
$('#lyActive').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lyact="unfilter"]');
  if (b) lyToggleFilter(b.dataset.kind, b.dataset.lid);
});
// choosing places and borders
$('#lyPickView').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && b.dataset.act === 'saveplaces') lySavePlaces();
  else if (b && b.dataset.act === 'cancelplaces') lyStopEdit();
});
$('#lyPickView').addEventListener('change', (e) => {
  const li = e.target.closest('li[data-pid]');
  if (li && e.target.type === 'checkbox') lyToggleMember(li.dataset.pid);
});
$('#lyPickQ').addEventListener('input', lyRenderPick);
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
// the layer form: Save and Cancel of the Foundation form frame, the add / remove buttons of its fields
$('#lyFormView').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'),
    f = $('#lyFormView').firstElementChild;
  if (!b || !f) return;
  const act = b.dataset.act;
  if (act === 'save') lySaveForm(f);
  else if (act === 'cancel') lyCloseForm();
  else if (act === 'addname') lyHideNamePeriod(fields.nameAdd(f.querySelector('[data-names]'), $('#lang').value || 'en').parentElement);
  else if (act === 'adddesc') f.querySelector('[data-descs]').append(lyDescRow({ lang: $('#lang').value || 'en', text: '' }));
  else if (act === 'deldesc') b.closest('.ly-descrow').remove();
});
$('#lyFormView').addEventListener('input', (e) => {
  if (e.target.matches('[data-value="name"]')) kit.clear($('#lyFormView')); // typing a name clears the "at least one name" message
});
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
