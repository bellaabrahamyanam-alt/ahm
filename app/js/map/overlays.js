// Historical map images ("overlays"): a picture pinned to the map by its four corners, shown between two zoom levels with transparency.
// Everyone can see them and change their own transparency; administrators can add, move, stretch, rotate, edit and delete them.
let ovList = [],
  ovHidden = new Set(),
  ovLocal = {},
  ovEdit = null;
const OV_MAX_PX = 4096; // larger scans are shrunk before upload (also what weak GPUs can draw)
const ovId = (id) => 'ahm-ov-' + id;
const ovUrl = (o) => o.tmpUrl || AHM_CONFIG.url.overlayImage(o);
const ovOpacity = (o) => (ovEdit && ovEdit.id === o.id ? ovEdit.opacity : (ovLocal[o.id] ?? o.opacity));
const fmtZ = (z) => Math.round(z * 10) / 10;
const ovCenter = (c) => [c.reduce((s, p) => s + p[0], 0) / 4, c.reduce((s, p) => s + p[1], 0) / 4];

async function ovPost(url, body, type) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': type || 'application/json' },
    body: type ? body : JSON.stringify(body),
  });
  let j = {};
  try {
    j = await r.json();
  } catch (e) {}
  if (!r.ok) throw Error(j.error || r.status);
  return j;
}
async function loadOverlays() {
  try {
    const r = await fetch(AHM_CONFIG.url.overlays, { cache: 'no-cache' });
    ovList = r.ok ? (await r.json()).overlays || [] : [];
  } catch (e) {
    ovList = [];
  }
  syncOverlays();
  renderOvList();
}
// Make the map layers match ovList (add, update, remove).
function syncOverlays() {
  if (typeof map === 'undefined' || !map || !map.getLayer('ahm-route')) return;
  const want = new Set(ovList.map((o) => ovId(o.id)));
  map
    .getStyle()
    .layers.filter((l) => l.id.startsWith('ahm-ov-') && !want.has(l.id))
    .forEach((l) => {
      map.removeLayer(l.id);
      map.removeSource(l.id);
    });
  ovList.forEach((o) => {
    const id = ovId(o.id),
      editing = ovEdit && ovEdit.id === o.id,
      c = editing ? ovEdit.coords : o.coordinates;
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'image', url: ovUrl(o), coordinates: c });
      map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-fade-duration': 0 } }, map.getLayer('ahm-shape-fill') ? 'ahm-shape-fill' : 'ahm-route'); // above the base map, below the borders, the route and the markers
    } else map.getSource(id).setCoordinates(c);
    map.setPaintProperty(id, 'raster-opacity', ovOpacity(o));
    map.setLayerZoomRange(id, editing ? 0 : o.minzoom, editing ? 24 : o.maxzoom); // while editing it is always visible
    map.setLayoutProperty(id, 'visibility', ovHidden.has(o.id) && !editing ? 'none' : 'visible');
  });
}
// Only a map that is not drawn at the current zoom needs a line of explanation.
const ovHint = (o) => {
  const z = map ? map.getZoom() : 0;
  return z >= o.minzoom && z < o.maxzoom ? '' : `Hidden at this zoom (shown for zoom ${fmtZ(o.minzoom)}–${fmtZ(o.maxzoom)})`;
};
function updateOvHints() {
  ovList.forEach((o) => {
    const e = document.querySelector(`[data-id="${o.id}"] .ovhint`);
    if (e) {
      e.textContent = ovHint(o);
      e.hidden = !e.textContent;
    }
  });
  const z = $('#ovZoom');
  if (z) z.textContent = fmtZ(map.getZoom());
}
function overlaysInit() {
  map.on('zoom', updateOvHints);
}

function renderOvList() {
  const shown = ovList.filter((o) => !o.tmpUrl),
    can = AHM_CONFIG.canOverlay;
  kit.list($('#ovList'), shown.map((o) => ({ id: o.id, o })), 't-mr-ov', (row, { o }) => {
    const op = ovLocal[o.id] ?? o.opacity,
      hint = ovHint(o);
    kit.fill(row, { title: o.title, opacity: Math.round(op * 100) + '%', hint });
    kit.show(row.querySelector('.ovhint'), !!hint);
    const cb = row.querySelector('[data-ov]');
    cb.dataset.ov = o.id;
    cb.checked = !ovHidden.has(o.id);
    const r = row.querySelector('[data-opa]');
    r.dataset.opa = o.id;
    r.value = op;
    row.querySelector('[data-fit]').dataset.fit = o.id;
    const ed = row.querySelector('[data-edit]');
    ed.dataset.edit = o.id;
    ed.hidden = !can;
  });
  $('#ovEmpty').hidden = !!shown.length;
  $('#ovSub').textContent = shown.length ? shown.length + (shown.length === 1 ? ' image overlay' : ' image overlays') : 'Image overlays';
  $('#ovAdmin').hidden = !can;
  const add = $('#ovAdd');
  add.classList.toggle('btn-primary', true);
  add.classList.toggle('btn-dash', !!shown.length);
  add.classList.toggle('rounded-full', !!shown.length);
  add.querySelector('use').setAttribute('href', shown.length ? '#mr-plus' : '#mr-upload');
}
const ovFit = (c) =>
  map.fitBounds(
    c.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(c[0], c[0])),
    { padding: viewPad(60) }
  );
$('#ovList').addEventListener('change', (e) => {
  const id = e.target.dataset.ov;
  if (!id) return;
  e.target.checked ? ovHidden.delete(id) : ovHidden.add(id);
  syncOverlays();
});
$('#ovList').addEventListener('input', (e) => {
  const id = e.target.dataset.opa;
  if (!id) return;
  ovLocal[id] = +e.target.value;
  map.setPaintProperty(ovId(id), 'raster-opacity', +e.target.value);
});
$('#ovList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fit],[data-edit]');
  if (!b) return;
  if (b.dataset.fit) ovFit(ovList.find((o) => o.id === b.dataset.fit).coordinates);
  else startEdit(ovList.find((o) => o.id === b.dataset.edit));
});
$('#ovAdmin').addEventListener('click', (e) => {
  if (e.target.closest('#ovAdd')) $('#ovFile').click();
});
// The line under the list: the picture could not be read or saved (hidden when empty).
function ovShowError(text) {
  $('#ovErrMsg').textContent = text || '';
  $('#ovErrBox').hidden = !text;
}
// The upload with its progress (fetch has none): fn(0..1) is called while the bytes go out.
function ovUpload(url, blob, fn) {
  return new Promise((ok, no) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.setRequestHeader('Content-Type', blob.type);
    x.upload.onprogress = (e) => e.lengthComputable && fn(e.loaded / e.total);
    x.onerror = () => no(Error('the network failed.'));
    x.onload = () => {
      let j = {};
      try {
        j = JSON.parse(x.responseText);
      } catch (e) {}
      x.status >= 200 && x.status < 300 ? ok(j) : no(Error(j.error || (x.status === 413 ? 'the file is too large.' : x.status)));
    };
    x.send(blob);
  });
}

// ---- adding: shrink the picture if needed, place it in the middle of the current view, then edit ----
async function ovPrepare(file) {
  const bmp = await createImageBitmap(file);
  let w = bmp.width,
    h = bmp.height;
  const k = Math.min(1, OV_MAX_PX / Math.max(w, h));
  const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
  if (k === 1 && ok && file.size <= 8e6) return { blob: file, w, h };
  w = Math.round(w * k);
  h = Math.round(h * k);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const toBlob = (t, q) => new Promise((r) => cv.toBlob(r, t, q));
  let blob = await toBlob(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
  if (blob.size > 9e6) blob = await toBlob('image/jpeg', 0.85);
  return { blob, w, h };
}
function ovStartCorners(w, h) {
  const r = map.getContainer().getBoundingClientRect(),
    s = Math.min((r.width * 0.6) / w, (r.height * 0.6) / h),
    pw = w * s,
    ph = h * s,
    cx = r.width / 2,
    cy = r.height / 2;
  return [
    [cx - pw / 2, cy - ph / 2],
    [cx + pw / 2, cy - ph / 2],
    [cx + pw / 2, cy + ph / 2],
    [cx - pw / 2, cy + ph / 2],
  ].map((p) => {
    const l = map.unproject(p);
    return [l.lng, l.lat];
  });
}
$('#ovFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  ovShowError('');
  try {
    const img = await ovPrepare(f);
    const o = {
      id: 'new',
      title: f.name.replace(/\.[^.]+$/, ''),
      coordinates: ovStartCorners(img.w, img.h),
      minzoom: 0,
      maxzoom: 24,
      opacity: 0.6,
      file: '',
      tmpUrl: URL.createObjectURL(img.blob),
      blob: img.blob,
    };
    stopEdit();
    ovList.push(o);
    startEdit(o);
  } catch (err) {
    ovShowError('Could not read that image: ' + err.message);
  }
});

// ---- editing: drag the red corners to fit, the blue dot to move everything, sliders to rotate / scale ----
function startEdit(o) {
  stopEdit();
  AHM.emit('map:show-controls'); // the sidebar opens the Maps fold
  ovEdit = {
    id: o.id,
    o,
    isNew: !!o.tmpUrl,
    title: o.title,
    coords: o.coordinates.map((c) => c.slice()),
    minzoom: o.minzoom,
    maxzoom: o.maxzoom,
    opacity: o.opacity,
    base: null,
    handles: [],
    center: null,
  };
  ovEdit.base = ovEdit.coords.map((c) => c.slice());
  syncOverlays();
  buildHandles();
  renderEditPanel();
  ovFit(ovEdit.coords);
}
const ovLive = () => map.getSource(ovId(ovEdit.id)).setCoordinates(ovEdit.coords);
function ovRebase() {
  ovEdit.base = ovEdit.coords.map((c) => c.slice());
  ovEdit.center.setLngLat(ovCenter(ovEdit.coords));
  $('#ovRot').value = 0;
  $('#ovScale').value = 1;
  $('#ovRotVal').textContent = '0°';
  $('#ovScVal').textContent = '100%';
  rangeFill($('#ovRot'));
  rangeFill($('#ovScale'));
}
function buildHandles() {
  const mk = (cls, ll) => {
    const el = document.createElement('div');
    el.className = cls;
    return new maplibregl.Marker({ element: el, draggable: true }).setLngLat(ll).addTo(map);
  };
  ovEdit.handles = ovEdit.coords.map((c, i) => {
    const m = mk('ovh', c);
    m.on('drag', () => {
      const l = m.getLngLat();
      ovEdit.coords[i] = [l.lng, l.lat];
      ovLive();
      ovEdit.center.setLngLat(ovCenter(ovEdit.coords));
    });
    m.on('dragend', ovRebase);
    return m;
  });
  ovEdit.center = mk('ovh center', ovCenter(ovEdit.coords));
  ovEdit.center.getElement().title = 'Drag to move the whole image';
  let start = null;
  ovEdit.center.on('dragstart', () => {
    start = { c: ovEdit.center.getLngLat(), px: ovEdit.coords.map((p) => map.project(p)) };
  });
  ovEdit.center.on('drag', () => {
    const a = map.project(start.c),
      b = map.project(ovEdit.center.getLngLat());
    ovEdit.coords = start.px.map((p) => {
      const l = map.unproject([p.x + b.x - a.x, p.y + b.y - a.y]);
      return [l.lng, l.lat];
    });
    ovEdit.handles.forEach((h, i) => h.setLngLat(ovEdit.coords[i]));
    ovLive();
  });
  ovEdit.center.on('dragend', ovRebase);
}
function ovApplyRS() {
  // rotate / scale the shape captured at the last drag, around its centre (screen space)
  const rot = (+$('#ovRot').value * Math.PI) / 180,
    k = +$('#ovScale').value,
    px = ovEdit.base.map((p) => map.project(p));
  const cx = px.reduce((s, p) => s + p.x, 0) / 4,
    cy = px.reduce((s, p) => s + p.y, 0) / 4;
  ovEdit.coords = px.map((p) => {
    const dx = (p.x - cx) * k,
      dy = (p.y - cy) * k;
    const l = map.unproject([
      cx + dx * Math.cos(rot) - dy * Math.sin(rot),
      cy + dx * Math.sin(rot) + dy * Math.cos(rot),
    ]);
    return [l.lng, l.lat];
  });
  ovEdit.handles.forEach((h, i) => h.setLngLat(ovEdit.coords[i]));
  ovLive();
  $('#ovRotVal').textContent = $('#ovRot').value + '°';
  $('#ovScVal').textContent = Math.round(k * 100) + '%';
}
function renderEditPanel() {
  const e = ovEdit;
  if (!e) {
    if ($('#mr-sheet .mr-edbody')) mrSheet.close();
    return;
  }
  const f = fields.form(e.isNew ? 'New image overlay' : 'Edit image overlay');
  f.querySelector('[data-body]').append(kit.tpl('t-mr-ovedit'));
  f.querySelector('[data-act="save"]').id = 'ovSave';
  f.querySelector('[data-act="cancel"]').id = 'ovCancel';
  if (!e.isNew) {
    const del = kit.tpl('t-mr-trash');
    del.id = 'ovDelete';
    del.title = del.ariaLabel = 'Delete this image overlay';
    f.append(del);
  }
  f.addEventListener('submit', (x) => x.preventDefault());
  mrSheet.open(f);
  $('#ovTitle').value = e.title;
  $('#ovOp').value = e.opacity;
  $('#ovOpVal').textContent = Math.round(e.opacity * 100) + '%';
  $('#ovZoom').textContent = fmtZ(map.getZoom());
  $('#ovMin').value = e.minzoom;
  $('#ovMax').value = e.maxzoom;
  ['#ovOp', '#ovRot', '#ovScale'].forEach((s) => rangeFill($(s)));
}
$('#mr-sheet').addEventListener('input', (e) => {
  if (!ovEdit) return;
  const id = e.target.id;
  if (id === 'ovTitle') ovEdit.title = e.target.value;
  else if (id === 'ovOp') {
    ovEdit.opacity = +e.target.value;
    $('#ovOpVal').textContent = Math.round(ovEdit.opacity * 100) + '%';
    map.setPaintProperty(ovId(ovEdit.id), 'raster-opacity', ovEdit.opacity);
  } else if (id === 'ovRot' || id === 'ovScale') ovApplyRS();
  else if (id === 'ovMin') ovEdit.minzoom = +e.target.value;
  else if (id === 'ovMax') ovEdit.maxzoom = +e.target.value;
});
$('#mr-sheet').addEventListener('click', async (e) => {
  if (!ovEdit) return;
  const zb = e.target.closest('[data-z]'),
    z = zb && zb.dataset.z,
    err = (t) => ($('#ovErr').textContent = t);
  if (z) {
    const v = Math.round(map.getZoom() * 2) / 2;
    if (z === 'min') {
      ovEdit.minzoom = v;
      $('#ovMin').value = v;
    } else {
      ovEdit.maxzoom = v;
      $('#ovMax').value = v;
    }
  } else if (e.target.closest('#ovCancel')) stopEdit();
  else if (e.target.closest('#ovDelete')) {
    dialogs.texts['delete-overlay'] = { title: (v) => `Delete “${v.name}”?`, body: () => 'A copy is kept in the archive folder on the server.', ok: 'Delete', danger: true };
    if (!(await dialogs.confirm('delete-overlay', { name: ovEdit.title }))) return;
    try {
      await ovPost(AHM_CONFIG.url.overlayDelete, { id: ovEdit.id });
      stopEdit();
      await loadOverlays();
    } catch (x) {
      err('Delete failed: ' + x.message);
    }
  } else if (e.target.closest('#ovSave')) {
    const d = ovEdit;
    if (!d.title.trim()) return err('Give it a title.');
    if (!(d.minzoom >= 0 && d.maxzoom <= 24 && d.minzoom < d.maxzoom)) return err('Zoom range: the first number must be smaller than the second (0–24).');
    const meta = { id: d.isNew ? undefined : d.id, title: d.title.trim(), coordinates: d.coords, minzoom: d.minzoom, maxzoom: d.maxzoom, opacity: d.opacity };
    err('Saving…');
    ovShowError('');
    try {
      const r = await ovPost(AHM_CONFIG.url.overlaySave, meta);
      if (d.isNew) {
        const up = (p) => {
          const pct = Math.round(p * 100);
          $('#ovUp').hidden = false;
          $('#ovUpName').textContent = d.title.trim();
          $('#ovUpPct').textContent = 'Uploading… ' + pct + '%';
          $('#ovUpBar').value = pct;
          err('Uploading… ' + pct + '%');
        };
        up(0);
        try {
          await ovUpload(AHM_CONFIG.url.overlayUpload(r.id), d.o.blob, up);
        } catch (x) {
          await ovPost(AHM_CONFIG.url.overlayDelete, { id: r.id }).catch(() => {});
          throw x;
        } finally {
          $('#ovUp').hidden = true;
        }
      }
      stopEdit();
      await loadOverlays();
    } catch (x) {
      err('Save failed: ' + x.message);
      ovShowError('Save failed: ' + x.message);
    }
  }
});
function stopEdit() {
  if (!ovEdit) return;
  ovEdit.handles.forEach((h) => h.remove());
  ovEdit.center && ovEdit.center.remove();
  if (ovEdit.isNew) {
    ovList = ovList.filter((o) => o.id !== 'new');
    URL.revokeObjectURL(ovEdit.o.tmpUrl);
  }
  ovEdit = null;
  syncOverlays();
  renderOvList();
  renderEditPanel();
}

document.addEventListener("DOMContentLoaded", loadOverlays); // the map domain starts its own data (after initMap)
