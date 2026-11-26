// Layers tab (sidebar domain): the list, the layer card, choosing places and borders, the layer form, and the categories of More.
// Markup = <section id="tab-layers"> and the t-ly-* templates in index.html (regions tab-layers and tpl-layers). This file only clones and fills
// them (kit.js, fields.js, dialogs.js): textContent, value, dataset, attributes, `hidden`, events. It builds no markup from strings.
// The filter state and the pure rules (names, counts, search, three-state mode) are in core/layer-rules.js.
// The part under "legacy" still returns HTML strings because Explore (place details, note dialog), Borders and Routes (cards) and More (categories)
// call it; it goes when those screens move to templates.
// Prefix `ly` = layers, `cat` = categories.

let lyCatEditing = null; // id of the category being renamed (administrators)
let lyLoaded = false; // the first data has arrived (until then the list shows a loading skeleton)
let lyForm = null; // the layer being changed in the form, or null for a new one
let lyFormOpen = false;
let lySeq = 0;
const LY_FOLD = 3; // member rows shown before "+ N more"

/** True in the page (templates and kit.js are there); the node tests of the rules run without a DOM and skip all drawing. */
const lyLive = () => typeof kit !== 'undefined' && typeof document.getElementById === 'function' && !!document.getElementById('t-ly-row');
/** Delegated event: fn(event, element) when `sel` matches the target or one of its ancestors inside `root`. */
const lyOn = (root, ev, sel, fn) =>
  root.addEventListener(ev, (e) => {
    const t = e.target.closest && e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });

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
  lyLoaded = true;
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
/** The first load failed (ui.js calls it): the list shows the error with a Retry button. */
function lyFail(msg) {
  if (lyLive()) kit.state($('#lyBox'), 'error', 'Could not load the layers (' + msg + ').', lyRetry);
}
async function lyRetry() {
  kit.state($('#lyBox'), 'loading', 'Loading layers…');
  try {
    await lyReload();
  } catch (e) {
    lyFail(e.message);
  }
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
/** The three-state control: mode = 'show' (neither filter), 'only' or 'hide'. */
function lySetMode(id, mode) {
  if (!lyById(id)) return;
  lyState.only.delete(id);
  lyState.hide.delete(id);
  if (mode === 'only' || mode === 'hide') lyState[mode].add(id);
  lyState.noteAll = false;
  AHM.state.patch('layers', {});
  lyRenderActive();
  lySyncModes();
  update();
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
  if (lyLive()) {
    lyRenderActive();
    lyRenderList();
    lyRenderDetail();
  }
  lyRenderCats();
}
/** Which of the three screens of the tab is shown: the list (or the open layer), choosing places, or the form. */
function lyRenderView() {
  if (!lyLive()) return;
  const open = !!(lyState.open && lyById(lyState.open)),
    form = lyFormOpen,
    pick = !!lyState.editing && !form,
    listing = !form && !pick,
    browse = listing && !open;
  kit.show($('#lyListView'), listing);
  kit.show($('#lyPickView'), pick);
  kit.show($('#lyFormView'), form);
  kit.show($('#lyFind'), listing); // the search and the category stay above an open card (s086)
  kit.show($('#lyInfo'), browse);
  kit.show($('#lyCount'), browse && lyLoaded);
  kit.show($('#lyBox'), browse);
  kit.show($('#lyList'), browse && lyLoaded);
  kit.show($('#lyCard'), listing && open);
  kit.show($('#ly-add'), browse && AHM_CONFIG.canEdit);
}
/** The "Layers" line of the Explore filters (a chip per filter; a click removes it). */
function lyRenderActive() {
  if (!lyLive()) return;
  const l = $('#lang').value,
    chips = [];
  for (const [kind, ids] of [['only', lyState.only], ['hide', lyState.hide]])
    for (const id of ids) {
      const c = kit.tpl('t-ly-chip');
      kit.fill(c, { text: (kind === 'only' ? 'only' : 'not in') + ' · ' + lyName(lyById(id), l) });
      c.dataset.kind = kind;
      c.dataset.lid = id;
      chips.push(c);
    }
  $('#lyActive').replaceChildren(...chips);
}
/** The three-state control inside `host` (a row or the card): put once, then only the ticked radio follows the filters. */
function lyTri(host, id, group) {
  let tri = host.querySelector('.ly-tri');
  if (!tri) {
    tri = kit.tpl('t-ly-tri');
    host.querySelector('[data-tri]').replaceWith(tri);
    tri.querySelectorAll('input').forEach((r) => (r.name = 'lyt-' + group + '-' + id));
  }
  tri.querySelectorAll('input').forEach((r) => (r.checked = r.value === lyModeOf(id)));
}
function lySyncModes() {
  if (!lyLive()) return;
  document.querySelectorAll('#tab-layers .ly-tri').forEach((t) => {
    const h = t.closest('[data-id],[data-lid]'),
      id = h && (h.dataset.id || h.dataset.lid);
    if (id) t.querySelectorAll('input').forEach((r) => (r.checked = r.value === lyModeOf(id)));
  });
}
function lyFillRow(node, ly, l) {
  kit.fill(node, { name: lyName(ly, l), cat: catName(catById(ly.category), l), meta: lyMeta(ly) });
  node.style.setProperty('--ly-c', ly.color || ''); // the colour of the layer, from the data; empty = the default edge
  lyTri(node, ly.id, 'r');
}
function lyRenderList() {
  if (!lyLive()) return;
  const box = $('#lyBox'),
    list = $('#lyList'),
    l = $('#lang').value;
  if (!lyLoaded) {
    kit.state(box, 'loading', 'Loading layers…');
    list.replaceChildren();
    $('#lyCount').textContent = '';
    return lyRenderView();
  }
  const rows = lyRows($('#lyQ').value, $('#lyCat').value, l);
  $('#lyCount').textContent = rows.length === layers.length ? lyPlural(layers.length, 'layer') : `${rows.length} of ${lyPlural(layers.length, 'layer')}`;
  if (!layers.length) kit.state(box, 'empty', AHM_CONFIG.canEdit ? 'No layers yet. Add the first one below.' : 'No layers yet.');
  else if (!rows.length) kit.state(box, 'empty', 'No layers match.');
  else box.replaceChildren();
  kit.list(list, rows.map((ly) => ({ id: ly.id, ly })), 't-ly-row', (node, it) => lyFillRow(node, it.ly, l));
  lyRenderView();
}
function lyFillCats() {
  if (!lyLive()) return;
  const sel = $('#lyCat'),
    v = sel.value,
    l = $('#lang').value,
    opt = (value, text) => {
      const o = kit.tpl('t-ly-opt');
      o.value = value;
      o.textContent = text;
      return o;
    };
  sel.replaceChildren(
    opt('', 'All categories'),
    ...categories
      .slice()
      .sort((a, b) => catName(a, l).localeCompare(catName(b, l)))
      .map((c) => opt(c.id, catName(c, l)))
  );
  sel.value = categories.some((c) => c.id === v) ? v : '';
}

// ---- the card of the open layer ----
/** One row of PLACES or BORDERS AND ROUTES: it = { id, name, kind: 'place' | 'shape', type, group }. */
function lyMemberRow(it, can) {
  const li = kit.tpl('t-ly-member'),
    img = li.querySelector('.ly-ti'),
    sym = li.querySelector('.ly-sym');
  kit.fill(li, { name: it.name });
  li.dataset.id = it.id;
  li.dataset.kind = it.kind;
  kit.show(li.querySelector('[data-act="leave"]'), can && it.kind === 'place'); // only places have the x (s086); a border or route is taken out in Choose places
  const src = it.kind === 'place' && typeof typeIcon === 'function' ? /src="([^"]+)"/.exec(typeIcon(it.type)) : null; // typeIcon (map domain) gives an <img> string: only its src is used
  if (src) {
    img.src = src[1];
    img.hidden = false;
  } else {
    sym.hidden = false;
    sym.dataset.group = it.group || 'place';
    sym.style.setProperty('--ly-c', it.kind === 'shape' ? shapeType(it.type).color : '');
  }
  return li;
}
/** The first LY_FOLD rows, then a native <details> "+ N more" with the rest. */
function lyFillMembers(ul, items, can) {
  ul.replaceChildren(...items.slice(0, LY_FOLD).map((it) => lyMemberRow(it, can)));
  if (items.length > LY_FOLD) {
    const more = kit.tpl('t-ly-more');
    kit.fill(more, { label: '+ ' + (items.length - LY_FOLD) + ' more' });
    more.querySelector('[data-rest]').replaceChildren(...items.slice(LY_FOLD).map((it) => lyMemberRow(it, can)));
    ul.append(more);
  }
}
function lyRenderDetail() {
  if (!lyLive()) return;
  $('#lyDetail').hidden = true; // the sheet in the dock (Explore region) is not used any more: the card is part of this tab
  const ly = lyState.open && lyById(lyState.open),
    box = $('#lyCard');
  if (!ly) {
    box.replaceChildren();
    return lyRenderView();
  }
  const l = $('#lang').value,
    can = AHM_CONFIG.canEdit,
    byId = new Map(places.map((p) => [p.id, p])),
    node = kit.tpl('t-ly-card'),
    q = (s) => node.querySelector(s),
    other = ly.names.length > 1 ? ly.names.map((n) => `${n.name} [${n.lang}]`).join(' · ') : '',
    ps = ly.members.filter((m) => m.place && byId.get(m.place)).map((m) => ({ id: m.place, kind: 'place', name: label(byId.get(m.place), l), type: byId.get(m.place).type })),
    ss = ly.members
      .filter((m) => m.shape && shapeById(m.shape))
      .map((m) => ({ id: m.shape, kind: 'shape', name: shapeName(shapeById(m.shape), l), type: shapeById(m.shape).type, group: shapeGroup(shapeById(m.shape)) })),
    ns = layerNotes
      .filter((n) => n.layer === ly.id && (!l || n.lang === l))
      .sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.title.localeCompare(b.title)),
    descs = ly.descriptions.filter((d) => !l || d.lang === l || !ly.descriptions.some((x) => x.lang === l));
  node.dataset.lid = ly.id;
  node.style.setProperty('--ly-c', ly.color || '');
  kit.fill(node, {
    name: lyName(ly, l),
    cat: catName(catById(ly.category), l),
    meta: lyMeta(ly),
    names: other,
    np: ps.length,
    ns: ss.length,
    nn: ns.length,
    noplaces: ps.length ? '' : 'No places yet.',
    nonotes: ns.length ? '' : 'No notes yet.',
  });
  kit.show(q('[data-bind="names"]'), !!other);
  kit.show(q('[data-bind="noplaces"]'), !ps.length);
  kit.show(q('[data-bind="nonotes"]'), !ns.length);
  lyTri(node, ly.id, 'c');
  for (const a of ['editlayer', 'editplaces', 'addnote']) kit.show(q(`[data-act="${a}"]`), can);
  kit.show(q('[data-act="delete"]'), can && !!AHM_CONFIG.canLayerAdmin);
  const dbox = q('[data-desc]');
  for (const d of descs) {
    if (descs.length > 1) dbox.append(kit.fill(kit.tpl('t-ly-hint'), { text: langName(d.lang) }));
    for (const para of d.text.split(/\n\s*\n/)) dbox.append(kit.fill(kit.tpl('t-ly-para'), { text: para }));
  }
  lyFillMembers(q('[data-places]'), ps, can);
  lyFillMembers(q('[data-shapes]'), ss, can);
  kit.show(q('[data-sec="shapes"]'), ss.length > 0);
  for (const n of ns) {
    const a = fields.note({ title: n.title, lang: n.lang, when: n.date ? dateText(n.date) : '', text: n.text });
    if (can) {
      const b = kit.tpl('t-ly-note-btn');
      b.dataset.id = n.id;
      a.querySelector('[data-actions]').append(b);
    }
    q('[data-notes]').append(a);
  }
  if (!can) kit.state(q('[data-readonly]'), 'readonly', 'Log in to change layers.');
  box.replaceChildren(node);
  lyRenderView();
}
function lyCardError(msg) {
  const e = $('#lyCard [data-error]');
  if (!e) return;
  e.textContent = msg || '';
  e.hidden = !msg;
}

// ---- opening, closing, choosing places ----
function lyOpen(id) {
  if (!lyById(id)) return;
  lyStopEdit();
  if (lyFormOpen) lyCloseForm();
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
  if (lyLive()) {
    $('#lyPickQ').value = '';
    $('#lyPickErr').hidden = true;
    lyRenderPick();
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
const lyPickRow = (id, name, tag, on) => {
  const li = kit.tpl('t-ly-pick');
  kit.fill(li, { name, tag });
  li.dataset.pid = id;
  li.querySelector('input').checked = on;
  return li;
};
/** The checkbox list of places, then of borders and routes, filtered by the find field. */
function lyRenderPick() {
  if (!lyLive() || !lyState.editing) return;
  const l = $('#lang').value,
    q = norm($('#lyPickQ').value),
    hit = (x) => !q || x.names.some((n) => norm(n.name).includes(q)),
    ps = places.filter(hit).sort((a, b) => label(a, l).localeCompare(label(b, l))),
    ss = shapes.filter(hit).sort((a, b) => shapeName(a, l).localeCompare(shapeName(b, l))),
    rows = ps.map((p) => lyPickRow(p.id, label(p, l), typeLabel(p.type, l), lyState.staged.has(p.id)));
  if (ss.length) {
    rows.push(kit.fill(kit.tpl('t-ly-pick-head'), { title: 'Borders' }));
    ss.forEach((s) => rows.push(lyPickRow(s.id, shapeName(s, l), shapeType(s.type).label, lyState.staged.has(s.id))));
  }
  $('#lyPick').replaceChildren(...rows);
  kit.show($('#lyPickNone'), !ps.length && !ss.length);
  lyDelta();
}
/** The +N / −N chips: places and borders added to and taken out of the layer so far. */
function lyDelta() {
  const ly = lyState.editing && lyById(lyState.editing);
  if (!lyLive() || !ly || !lyState.staged) return;
  const orig = new Set(ly.members.map((m) => m.place || m.shape));
  $('#lyPlus').textContent = '+' + [...lyState.staged].filter((p) => !orig.has(p)).length;
  $('#lyMinus').textContent = '−' + [...orig].filter((p) => !lyState.staged.has(p)).length;
}
/** A place was clicked on the map or ticked in the list while places are being chosen. */
function lyToggleMember(pid) {
  lyState.staged.has(pid) ? lyState.staged.delete(pid) : lyState.staged.add(pid);
  AHM.state.patch('layers', {});
  if (lyLive()) {
    const cb = document.querySelector(`#lyPick li[data-pid="${pid}"] input`);
    if (cb) cb.checked = lyState.staged.has(pid);
  }
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
    await lyReload(); // first the new members, then leave the choosing screen: the card never shows the old ones
    lyState.editing = null;
    lyState.staged = null;
    AHM.state.patch('layers', {});
    lyRender();
    update();
  } catch (e) {
    const err = $('#lyPickErr');
    err.textContent = e.message;
    err.hidden = false;
  }
}
function lyFit() {
  const ly = lyById(lyState.open),
    ps = ly ? places.filter((p) => lyMembers[ly.id].has(p.id)) : [],
    ss = ly ? shapes.filter((s) => lyMembers[ly.id].has(s.id)) : [];
  AHM.map.fitTo([...ps.map((p) => [p.lon, p.lat]), ...ss.flatMap((s) => bboxCorners(geomBBox(s.geometry)))]);
}
/** The x of a member row: take the place or border out of the layer (it stays on the main map). */
async function lyLeave(ly, id) {
  try {
    await postJSON(AHM_CONFIG.url.layerSave, { layer_members: { id: ly.id, remove: [id] } });
    await lyReload();
  } catch (e) {
    lyCardError(e.message);
  }
}
async function lyDelete(ly) {
  if (!(await dialogs.confirm('delete-layer', { name: lyName(ly, $('#lang').value) }))) return;
  try {
    await postJSON(AHM_CONFIG.url.layerDelete, { id: ly.id });
    lyClose();
    await lyReload();
  } catch (e) {
    lyCardError(e.message);
  }
}

// ---- the layer form (new / change), a screen of the tab with the sticky Save / Cancel bar ----
const lyLangs = () => languages.map((x) => ({ code: x.code, name: x.name }));
const lyNoPeriod = (row) => row.querySelectorAll('[data-period]').forEach((p) => (p.hidden = true)); // a layer name has no period of its own
function lyDescRow(d) {
  const row = kit.tpl('t-ly-desc'),
    pills = fields.pills(lyLangs(), d.lang);
  row.querySelector('[data-lang]').append(pills);
  row._pills = pills;
  row.querySelector('textarea').value = d.text;
  return row;
}
function lyOpenForm(ly) {
  if (!lyLive()) return;
  lyForm = ly || null;
  lyFormOpen = true;
  const l = $('#lang').value || 'en',
    form = fields.form(ly ? 'Edit layer' : 'Add layer'),
    body = kit.tpl('t-ly-form'),
    names = body.querySelector('[data-names]'),
    sel = body.querySelector('[data-category]'),
    opt = (value, text) => {
      const o = kit.tpl('t-ly-opt');
      o.value = value;
      o.textContent = text;
      return o;
    },
    colour = fields.styleEditor('line', ly && ly.color, {});
  form.querySelector('[data-body]').append(body);
  fields.nameList(names, lyLangs(), ly ? ly.names : [{ lang: l, name: '' }]);
  lyNoPeriod(names);
  (ly ? ly.descriptions : []).forEach((d) => body.querySelector('[data-descs]').append(lyDescRow(d)));
  sel.append(
    opt('', '— none —'),
    ...categories
      .slice()
      .sort((a, b) => catName(a, l).localeCompare(catName(b, l)))
      .map((c) => opt(c.id, catName(c, l)))
  );
  sel.value = ly && categories.some((c) => c.id === ly.category) ? ly.category : '';
  body.querySelector('[data-from]').append(fields.date(ly && ly.date_from));
  body.querySelector('[data-to]').append(fields.date(ly && ly.date_to));
  colour.querySelectorAll('[data-sec]').forEach((s) => (s.hidden = true)); // only the colour row of the style editor
  body.querySelector('[data-colour]').append(colour);
  body.querySelector('[data-usecolor]').checked = !!(ly && ly.color);
  lyOn(form, 'click', '[data-act]', (e, b) => {
    const act = b.dataset.act;
    if (act === 'save') lySaveForm(form);
    else if (act === 'cancel') lyCloseForm();
    else if (act === 'addname') {
      const r = fields.nameAdd(names, $('#lang').value || 'en');
      lyNoPeriod(r);
      r.querySelector('input[type="text"]').focus();
    } else if (act === 'adddesc') body.querySelector('[data-descs]').append(lyDescRow({ lang: $('#lang').value || 'en', text: '' }));
    else if (act === 'deldesc') b.closest('.ly-descrow').remove();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // Enter in a field saves; the page never reloads
    lySaveForm(form);
  });
  form.addEventListener('input', () => {
    kit.clear(form);
    form.querySelector('[data-error]').hidden = true;
  });
  $('#lyFormView').replaceChildren(form);
  lyRenderView();
  names.querySelector('input[type="text"]').focus();
}
function lyCloseForm() {
  lyForm = null;
  lyFormOpen = false;
  if (!lyLive()) return;
  $('#lyFormView').replaceChildren();
  lyRenderView();
}
/** The layer object the server stores; throws a readable Error ("Give the layer at least one name.", a bad date). */
function lyReadForm(root) {
  const names = fields.readNames(root.querySelector('[data-names]'));
  if (!names.length) throw Error('Give the layer at least one name.');
  const descriptions = [...root.querySelectorAll('.ly-descrow')]
      .map((r) => ({ lang: r._pills.dataset.value, text: r.querySelector('textarea').value.trim() }))
      .filter((d) => d.text),
    from = fields.dateRead(root.querySelector('[data-from] .ahm-date'), 'From'),
    to = fields.dateRead(root.querySelector('[data-to] .ahm-date'), 'To');
  dateOrderCheck(from, to);
  return {
    id: lyForm ? lyForm.id : undefined,
    names,
    descriptions,
    category: root.querySelector('[data-category]').value || null,
    date_from: from,
    date_to: to,
    color: root.querySelector('[data-usecolor]').checked ? fields.readStyle(root.querySelector('.ahm-style')).color : null,
  };
}
function lyFormError(form, msg) {
  const err = form.querySelector('[data-error]');
  kit.fill(err, { error: msg });
  kit.show(err, true);
  if (/name/i.test(msg)) {
    const i = form.querySelector('.ahm-name input[type="text"]');
    if (i) {
      i.classList.add('input-error');
      i.setAttribute('aria-invalid', 'true');
      i.focus();
    }
  }
}
async function lySaveForm(form) {
  const save = form.querySelector('[data-act="save"]');
  let layer;
  kit.clear(form);
  form.querySelector('[data-error]').hidden = true;
  try {
    layer = lyReadForm(form);
  } catch (e) {
    return lyFormError(form, e.message);
  }
  save.disabled = true;
  save.setAttribute('aria-busy', 'true');
  try {
    const j = await postJSON(AHM_CONFIG.url.layerSave, { layer });
    await lyReload();
    lyCloseForm();
    lyOpen(j.id);
  } catch (e) {
    lyFormError(form, e.message);
  } finally {
    save.disabled = false;
    save.removeAttribute('aria-busy');
  }
}

// ---- events ----
function lyFind() {
  if (lyState.open && !lyState.editing) lyClose(); // searching or choosing a category goes back to the list
  lyRenderList();
}
$('#lyQ').addEventListener('input', lyFind);
$('#lyCat').addEventListener('change', lyFind);
$('#lang').addEventListener('input', () => {
  lyFillCats();
  lyRender();
});
$('#lyNew').addEventListener('click', () => lyOpenForm(null));
lyOn($('#lyList'), 'click', '[data-act="open"]', (e, b) => lyOpen(b.closest('li').dataset.id));
lyOn($('#lyList'), 'change', '.ly-tri input', (e, r) => lySetMode(r.closest('li').dataset.id, r.value));
lyOn($('#lyCard'), 'change', '.ly-tri input', (e, r) => lySetMode(lyState.open, r.value));
lyOn($('#lyCard'), 'click', '[data-act]', (e, b) => {
  const ly = lyById(lyState.open),
    li = b.closest('li[data-id]'),
    act = b.dataset.act;
  if (!ly) return;
  if (act === 'close') lyClose();
  else if (act === 'editlayer') lyOpenForm(ly);
  else if (act === 'editplaces') lyStartEdit();
  else if (act === 'fit') lyFit();
  else if (act === 'addnote') lyOpenNoteDlg(ly, null);
  else if (act === 'editnote') lyOpenNoteDlg(ly, layerNotes.find((n) => n.id === b.dataset.id));
  else if (act === 'goto' && li) li.dataset.kind === 'shape' ? shOpen(li.dataset.id) : show(li.dataset.id);
  else if (act === 'leave' && li) lyLeave(ly, li.dataset.id);
  else if (act === 'delete') lyDelete(ly);
});
lyOn($('#lyActive'), 'click', '[data-lyact="unfilter"]', (e, b) => lyToggleFilter(b.dataset.kind, b.dataset.lid));
$('#lyPickQ').addEventListener('input', () => lyRenderPick());
lyOn($('#lyPick'), 'change', 'input[type="checkbox"]', (e, cb) => {
  const pid = cb.closest('li').dataset.pid;
  if (lyState.staged && lyState.staged.has(pid) !== cb.checked) lyToggleMember(pid);
});
$('#lyPickSave').addEventListener('click', lySavePlaces);
$('#lyPickCancel').addEventListener('click', lyStopEdit);
if (lyLive()) {
  lyRenderList(); // the loading skeleton, until ui.js hands over the data
  lyRenderView();
}

// ============================ legacy (HTML strings) ============================
// Called by other screens until they move to templates: place details and the note dialog (Explore), the cards of borders and routes,
// and the categories fold of More. Not used by the Layers tab itself.
const lySwatch = (c) => `<span class="swatch"${c ? ` style="background:${esc(c)}"` : ' data-none'}></span>`;
const lyPara = (t) =>
  t
    .split(/\n\s*\n/)
    .map((x) => '<p>' + esc(x) + '</p>')
    .join('');

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
/** [{lang, name}] of the name rows (place form rows, see placeform.js) inside root. */
const lyReadNames = (root) =>
  [...root.querySelectorAll('.pf-name')]
    .map((r) => ({ lang: r.querySelector('.nl').value, name: r.querySelector('.nn').value.trim() }))
    .filter((n) => n.name);
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
