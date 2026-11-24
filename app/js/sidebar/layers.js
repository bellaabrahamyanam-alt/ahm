// Layers tab, layer details, layer forms and categories (sidebar domain). The filter state and the pure rules are in core/layer-rules.js.
// Prefix `ly` = layers, `cat` = categories.

let lyCatEditing = null; // id of the category being renamed (administrators)

// Shared components (components.js). layers.test.js and search.test.js load this file without it, so each use falls back to plain markup.
const lyChipUi = (text, o = {}) =>
  typeof uiChip === 'function' ? uiChip(text, o) : `<button type="button" class="chip2${o.on ? ' on' : ''}" ${o.data || ''}>${esc(text)}</button>`;
const lyAddUi = (label, cls) => (typeof uiAdd === 'function' ? uiAdd(label, cls) : `<button type="button" class="${cls}">+ ${esc(label)}</button>`);
const lySwatch = (c) => `<span class="swatch"${c ? ` style="background:${esc(c)}"` : ' data-none'}></span>`; // used by the layer chips of a place sheet
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

// ---- templates: the markup is static in index.html (#tab-layers and <template id="tpl-ly-...">). This file clones it and fills in text, attributes
// and data. It builds no HTML strings; the only innerHTML is the map symbol of a type (typeIcon, shIcon), which is markup of typeicons.js. ----
const lyTpl = (id) => {
  const t = document.querySelector('#tpl-' + id);
  return t && t.content ? t.content.firstElementChild.cloneNode(true) : null; // a page without the template has nothing to draw
};
const lyF = (root, f) => root.querySelector(`[data-f="${f}"]`);
const lyTxt = (root, f, text) => {
  const n = lyF(root, f);
  n.textContent = text;
  return n;
};
/** Text with blank lines between paragraphs, added to `box` as <p> elements. */
const lyParas = (box, text) =>
  text.split(/\n\s*\n/).forEach((t) => {
    const p = document.createElement('p');
    p.textContent = t;
    box.append(p);
  });
const lyMode = (id) => (lyState.only.has(id) ? 'only' : lyState.hide.has(id) ? 'hide' : 'show');
const lyErr = (msg) => {
  const n = lyState.editing ? $('#lyPickErr') : document.querySelector('#lyList .lyx-open [data-f="err"]');
  if (n) n.textContent = msg;
};
/** Switches between the list and the choice of places; a view transition when the browser has them and the person allows motion. */
function lyShowView(v) {
  const go = () => {
    $('#lyListView').hidden = v !== 'list';
    $('#lyPickView').hidden = v !== 'pick';
  };
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !calm && $('#lyPickView').hidden !== (v !== 'pick')) document.startViewTransition(go);
  else go();
}
/** The confirm bar (s69, s86). Resolves true on the red button, false on Cancel or Esc. */
function lyAsk(msg, o = {}) {
  const box = $('#lyConfirm');
  $('#lyConfirmMsg').textContent = msg;
  $('#lyConfirmOk').textContent = o.ok || 'OK';
  box.hidden = false;
  $('#lyConfirmNo').focus();
  return new Promise((resolve) => {
    const end = (yes) => {
      box.hidden = true;
      box.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      resolve(yes);
    };
    const onClick = (e) => {
      const b = e.target.closest('button');
      if (b) end(b.id === 'lyConfirmOk');
    };
    const onKey = (e) => e.key === 'Escape' && end(false);
    box.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

// ---- rendering ----
function lyRender() {
  lyRenderActive();
  lyRenderDetail();
  lyRenderCats();
}
/** The "Layers" line of the Explore filters. */
function lyRenderActive() {
  const l = $('#lang').value,
    chip = (kind, id) =>
      lyChipUi(`${kind === 'only' ? 'only' : 'not in'} · ${lyName(lyById(id), l)}`, {
        on: true,
        removable: true,
        data: `data-lyact="unfilter" data-kind="${kind}" data-lid="${id}" title="Remove this filter"`,
      });
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
const lyPlural = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
/** Shown / Only / Hide: the three radios of a card and its dimming. Used on build and after a change (no rebuild, so the keyboard focus stays). */
function lyPaintMode(li, id) {
  const m = lyMode(id);
  li.querySelectorAll('input[data-lymode]').forEach((r) => (r.checked = r.value === m));
  li.classList.toggle('lyx-dim', m === 'hide');
}
function lyCardNode(ly, l) {
  const li = lyTpl('ly-card'),
    np = ly.members.filter((m) => m.place).length,
    ns = ly.members.length - np,
    open = lyState.open === ly.id;
  li.dataset.lid = ly.id;
  li.style.setProperty('--ly-c', ly.color || 'transparent');
  lyTxt(li, 'title', lyName(ly, l));
  lyTxt(li, 'cat', [catName(catById(ly.category), l), lyWhen(ly)].filter(Boolean).join(' · '));
  lyTxt(li, 'meta', [lyPlural(np, 'place'), ns ? lyPlural(ns, 'border') : ''].filter(Boolean).join(' · '));
  li.querySelectorAll('input[data-lymode]').forEach((r) => (r.name = 'lymode-' + ly.id));
  lyPaintMode(li, ly.id);
  li.classList.toggle('lyx-open', open);
  li.querySelector('[data-lyact="toggle"]').setAttribute('aria-expanded', String(open));
  if (open) lyFillBody(li, ly, l);
  return li;
}
function lyRenderList() {
  const q = norm($('#lyQ').value),
    cat = $('#lyCat').value,
    l = $('#lang').value,
    rows = layers
      .filter((ly) => (!cat || ly.category === cat) && (!q || lyHay(ly).includes(q)))
      .sort((a, b) => lyName(a, l).localeCompare(lyName(b, l))),
    open = lyState.open && lyById(lyState.open),
    list = open && !rows.includes(open) ? [open, ...rows] : rows; // the open layer always has its card, even when the filter hides it
  $('#lyCount').textContent = rows.length + ' of ' + layers.length + ' layers';
  const none = list.length ? '' : !layers.length ? 'none' : cat && !q ? 'cat' : 'nomatch';
  ['none', 'cat', 'nomatch'].forEach((k) => ($('#lyEmpty-' + k).hidden = k !== none));
  $('#lyEmpty-none').querySelector('[data-edit]').hidden = !AHM_CONFIG.canEdit;
  if (!lyTpl('ly-card')) return;
  $('#lyList').replaceChildren(...list.map((ly) => lyCardNode(ly, l)));
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
const lyPlaceRow = (p, l, can) => {
  const r = lyTpl('ly-place');
  r.dataset.pid = p.id;
  lyF(r, 'icon').innerHTML = typeIcon(p.type);
  lyTxt(r, 'name', label(p, l));
  r.title = typeLabel(p.type, l);
  if (!can) r.querySelector('[data-edit]').remove();
  return r;
};
/** The body of the open card: tools, description, places, borders, notes (s86). */
function lyFillBody(li, ly, l) {
  const body = lyTpl('ly-body'),
    can = AHM_CONFIG.canEdit,
    byId = new Map(places.map((p) => [p.id, p])),
    inLayer = ly.members.filter((m) => m.place),
    ps = inLayer.map((m) => byId.get(m.place)).filter(Boolean), // a place deleted elsewhere is not listed
    gone = inLayer.length - ps.length,
    ss = ly.members.map((m) => m.shape && shapeById(m.shape)).filter(Boolean),
    ns = layerNotes
      .filter((n) => n.layer === ly.id && (!l || n.lang === l))
      .sort((a, b) => dateKey(a.date) - dateKey(b.date) || a.title.localeCompare(b.title)),
    show = (f, text) => (lyTxt(body, f, text).hidden = false);
  if (!can) body.querySelectorAll('[data-edit]').forEach((n) => n.remove());
  if (!AHM_CONFIG.canLayerAdmin) body.querySelectorAll('[data-admin]').forEach((n) => n.remove());
  const desc = lyF(body, 'desc');
  if (ly.names.length > 1) lyParas(desc, ly.names.map((n) => `${n.name} [${n.lang}]`).join(' · '));
  ly.descriptions.filter((d) => !l || d.lang === l || !ly.descriptions.some((x) => x.lang === l)).forEach((d) => lyParas(desc, d.text));
  lyTxt(body, 'np', ps.length);
  ps.forEach((p, i) => lyF(body, i < 3 ? 'places' : 'rest').append(lyPlaceRow(p, l, can)));
  if (ps.length > 3) {
    lyF(body, 'restwrap').hidden = false;
    lyTxt(body, 'restsum', '+ ' + (ps.length - 3) + ' more');
  }
  if (!ps.length) show('noplaces', 'No places yet.' + (can ? ' Use “Choose places and borders” (the list icon above).' : ''));
  if (gone) show('gone', gone + (gone === 1 ? ' place of this layer no longer exists.' : ' places of this layer no longer exist.'));
  if (ss.length) {
    lyF(body, 'shapeswrap').hidden = false;
    lyTxt(body, 'ns', ss.length);
    lyF(body, 'shapes').append(
      ...ss.map((s) => {
        const r = lyTpl('ly-shape');
        r.dataset.sid = s.id;
        lyF(r, 'icon').innerHTML = shIcon(s.type);
        lyTxt(r, 'name', shapeName(s, l));
        r.title = shapeType(s.type).label;
        return r;
      })
    );
  }
  lyTxt(body, 'nn', ns.length);
  if (!ns.length) lyF(body, 'nonotes').hidden = false;
  lyF(body, 'notes').append(
    ...ns.map((n) => {
      const r = lyTpl('ly-note');
      lyTxt(r, 'title', n.title);
      lyTxt(r, 'lang', n.lang);
      lyTxt(r, 'when', n.date ? dateText(n.date) : 'No date');
      lyParas(lyF(r, 'text'), n.text);
      const b = r.querySelector('[data-edit]');
      if (can) b.dataset.id = n.id;
      else b.remove();
      return r;
    })
  );
  lyF(body, 'lock').hidden = can;
  lyF(li, 'more').replaceChildren(body);
}
/** Draws what the state says: the list with the open card, or the choice of places. */
function lyRenderDetail() {
  const ed = lyState.editing && lyById(lyState.editing);
  lyShowView(ed ? 'pick' : 'list');
  $('#lyDetail').hidden = true; // the old dock pane; layout.js still looks at it
  if (ed) lyFillPick();
  else lyRenderList();
}
/** Choosing places: click them on the map or tick them here; nothing is saved until "Save places". */
function lyFillPick() {
  if (!lyById(lyState.editing)) return;
  if (lyTpl('ly-pick')) lyDrawPick($('#lang').value);
  $('#lyPickErr').textContent = '';
  lyApplyPick();
  lyDelta();
}
function lyDrawPick(l) {
  const row = (id, name, type, names) => {
    const r = lyTpl('ly-pick');
    r.dataset.pid = id;
    r.dataset.hay = norm(names.join(' '));
    r.querySelector('input').checked = lyState.staged.has(id);
    lyTxt(r, 'name', name);
    lyTxt(r, 'type', type);
    return r;
  };
  $('#lyPick').replaceChildren(
    ...places
      .slice()
      .sort((a, b) => label(a, l).localeCompare(label(b, l)))
      .map((p) => row(p.id, label(p, l), typeLabel(p.type, l), p.names.map((n) => n.name)))
  );
  $('#lyPickShapes').replaceChildren(
    ...shapes
      .slice()
      .sort((a, b) => shapeName(a, l).localeCompare(shapeName(b, l)))
      .map((s) => row(s.id, shapeName(s, l), shapeType(s.type).label, s.names.map((n) => n.name)))
  );
}
/** The search box of the choice of places hides rows; nothing is drawn again. */
function lyApplyPick() {
  const q = norm($('#lyPickQ').value);
  let shown = 0,
    shownShapes = 0;
  [$('#lyPick'), $('#lyPickShapes')].forEach((ul, i) =>
    [...ul.children].forEach((r) => {
      r.hidden = !!q && !r.dataset.hay.includes(q);
      if (!r.hidden) i ? shownShapes++ : shown++;
    })
  );
  $('#lyPickShapesHead').hidden = !shownShapes;
  $('#lyPickNone').hidden = !!(shown || shownShapes);
}
/** True when the places chosen so far differ from the saved members of the layer being edited. */
function lyDirty() {
  const ly = lyState.editing && lyById(lyState.editing);
  if (!ly || !lyState.staged) return false;
  const orig = ly.members.map((m) => m.place || m.shape);
  return orig.length !== lyState.staged.size || orig.some((id) => !lyState.staged.has(id));
}
/** Leaving the choice of places (close, Cancel, another layer): asks first when there are unsaved changes. Resolves false to stay. */
async function lyLeaveEdit() {
  return !lyDirty() || (await lyAsk('Discard the changes to the places of this layer?', { ok: 'Discard' }));
}
function lyDelta() {
  const ly = lyById(lyState.editing);
  if (!ly) return;
  const orig = new Set(ly.members.map((m) => m.place || m.shape)),
    add = [...lyState.staged].filter((p) => !orig.has(p)).length,
    rem = [...orig].filter((p) => !lyState.staged.has(p)).length;
  $('#lyAdd').textContent = '+' + add;
  $('#lyRem').textContent = '−' + rem;
  $('#lyAdd').classList.toggle('lyx-on', add > 0);
  $('#lyRem').classList.toggle('lyx-on', rem > 0);
  $('#lyNoChange').hidden = !!(add || rem);
  $('#lySavePlaces').disabled = !(add || rem);
}

// ---- opening, closing, choosing places ----
function lyOpen(id) {
  if (!lyById(id)) return;
  lyStopEdit();
  lyState.open = id;
  lyState.noteAll = false;
  tab('layers');
  lyRenderDetail();
  const card = $(`#lyList [data-lid="${id}"]`);
  if (card) card.scrollIntoView({ block: 'nearest' });
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
/** A place was clicked on the map or ticked in the list while places are being chosen. */
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
    lyErr(e.message);
  }
}
/** The ✕ of a place in the open card: takes it out of this layer at once (one request); the place stays on the map. */
async function lyRemovePlace(pid) {
  const ly = lyById(lyState.open);
  if (!ly) return;
  try {
    await postJSON(AHM_CONFIG.url.layerSave, { layer_members: { id: ly.id, remove: [pid] } });
    await lyReload();
  } catch (e) {
    lyErr(e.message);
  }
}
/** Shown / Only / Hide of one layer, set from the radios of its card. */
function lySetMode(id, mode) {
  lyState.only.delete(id);
  lyState.hide.delete(id);
  if (mode === 'only') lyState.only.add(id);
  if (mode === 'hide') lyState.hide.add(id);
  lyState.noteAll = false;
  AHM.state.patch('layers', {});
  lyRenderActive();
  const li = $(`#lyList [data-lid="${id}"]`);
  if (li) lyPaintMode(li, id);
  update();
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
    lyAddUi('Add another name', 'pf-add') +
    `<div class="sn">${LANG_HINT}</div>` +
    '<div class="label">Description (one per language, optional)</div><div id="lyDescs">' +
    descs.map(lyDescRow).join('') +
    '</div>' +
    lyAddUi('Add a description', 'ly-dadd') +
    '<div class="label">Category (optional)</div><select id="lyFCat"><option value="">— none —</option>' +
    categories.map((c) => `<option value="${c.id}"${ly && ly.category === c.id ? ' selected' : ''}>${esc(catName(c, $('#lang').value))}</option>`).join('') +
    '</select>' +
    '<div class="label">Dates (optional)</div><div class="pf-sub">From</div>' +
    dfHTML('ly-from', ly && ly.date_from) +
    '<div class="pf-sub">To</div>' +
    dfHTML('ly-to', ly && ly.date_to) +
    `<div class="label">Colour (optional)</div><div class="row lyx-colours"><label><input type="checkbox" role="switch" id="lyUseColor"${ly && ly.color ? ' checked' : ''}> use a colour</label>` +
    (typeof UI_SWATCHES === 'undefined' ? [] : UI_SWATCHES)
      .map((c) => `<button type="button" class="swatch${ly && ly.color === c ? ' on' : ''}" data-lycolor="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`)
      .join('') +
    `<input type="color" id="lyColor" value="${ly && ly.color ? esc(ly.color) : '#9a3b2e'}" aria-label="Custom colour"></div>`;
  $('#lyErr2').textContent = '';
  $('#lyErr2').setAttribute('role', 'alert');
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
$('#lyActive').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lyact="unfilter"]');
  if (b) lyToggleFilter(b.dataset.kind, b.dataset.lid);
});
$('#tab-layers').addEventListener('click', async (e) => {
  const a = e.target.closest('[data-lyact]'),
    card = e.target.closest('li[data-lid]'),
    ly = lyById(card ? card.dataset.lid : lyState.editing);
  if (!a) {
    const pl = e.target.closest('.lyx-rows li[data-pid]'),
      sh = e.target.closest('.lyx-rows li[data-sid]');
    if (pl) show(pl.dataset.pid);
    else if (sh) shOpen(sh.dataset.sid);
    return;
  }
  const act = a.dataset.lyact;
  if (act === 'cancelplaces') return (await lyLeaveEdit()) && lyStopEdit();
  if (act === 'saveplaces') return lySavePlaces();
  if (!ly) return;
  if (act === 'toggle') {
    if (lyState.open === ly.id) lyClose();
    else if (await lyLeaveEdit()) lyOpen(ly.id);
  } else if (act === 'fit') lyFit();
  else if (act === 'editlayer') lyOpenForm(ly);
  else if (act === 'editplaces') lyStartEdit();
  else if (act === 'addnote') lyOpenNoteDlg(ly, null);
  else if (act === 'editnote') lyOpenNoteDlg(ly, layerNotes.find((n) => n.id === a.dataset.id));
  else if (act === 'removeplace') lyRemovePlace(e.target.closest('li[data-pid]').dataset.pid);
  else if (act === 'delete' && AHM_CONFIG.canLayerAdmin) {
    const ok = await lyAsk('Delete this layer? Places and borders stay on the main map. A copy is archived.', { ok: 'Delete' });
    if (!ok) return;
    try {
      await postJSON(AHM_CONFIG.url.layerDelete, { id: ly.id });
      lyClose();
      await lyReload();
    } catch (x) {
      lyErr(x.message);
    }
  }
});
$('#tab-layers').addEventListener('change', (e) => {
  const mode = e.target.closest('input[data-lymode]'),
    card = e.target.closest('li[data-lid]'),
    pick = e.target.closest('#lyPickView li[data-pid]');
  if (mode && card) lySetMode(card.dataset.lid, mode.value);
  else if (pick) lyToggleMember(pick.dataset.pid);
});
$('#tab-layers').addEventListener('input', (e) => e.target.id === 'lyPickQ' && lyApplyPick());
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
    if (!(await lyLeaveEdit())) return;
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
  const sw = e.target.closest('[data-lycolor]'); // a swatch sets the colour and turns "use a colour" on
  if (sw) {
    $('#lyColor').value = sw.dataset.lycolor;
    $('#lyUseColor').checked = true;
    $('#lyForm').querySelectorAll('[data-lycolor]').forEach((x) => x.classList.toggle('on', x === sw));
  }
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
