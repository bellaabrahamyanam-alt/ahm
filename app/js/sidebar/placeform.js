// The place form: names, type, dates (or height for a mountain) and position.
// Used twice: in the "new place" dialog and in the sidebar when an existing place is edited.
const MAX_HEIGHT_M = 9000;

/** <option>s of the language dictionary (sorted by name). A code that is not in the dictionary is kept visible, not lost. */
const langOptions = (cur) => {
  const list = languages.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    (!cur || list.some((l) => l.code === cur) ? '' : `<option value="${esc(cur)}" selected>${esc(cur)} (not in the list)</option>`) +
    list.map((l) => `<option value="${esc(l.code)}"${l.code === cur ? ' selected' : ''}>${esc(l.name)} (${esc(l.code)})</option>`).join('')
  );
};
/** <option>s of the point types of the dictionary (sorted by name in language l). A type that is not in the dictionary is kept visible. */
const typeOptions = (cur, l) => {
  const list = types.filter((t) => t.geometry === 'point').map((t) => t.code);
  if (cur && !list.includes(cur)) list.push(cur);
  return list
    .sort((a, b) => typeLabel(a, l).localeCompare(typeLabel(b, l)))
    .map((t) => `<option value="${esc(t)}"${t === cur ? ' selected' : ''}>${esc(typeLabel(t, l))}</option>`)
    .join('');
};
/**
 * Turns the text of an SVG file into one path and the size of its box: the paths, rectangles, circles, ellipses and
 * polygons of the file are joined (colours and everything else are ignored). `path` is '' when there is nothing to draw or the
 * file cannot be used; `why` is then 'transform' or 'origin'.
 */
function svgToPath(text) {
  const attr = (tag, n) => {
    const m = new RegExp('(?:^|\\s)' + n + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(tag);
    return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
  };
  const num = (tag, n) => {
    const v = parseFloat(attr(tag, n));
    return Number.isFinite(v) ? v : 0;
  };
  const f = (x) => String(Math.round(x * 1000) / 1000);
  const parts = [];
  let box = 0;
  // Not supported, so refused instead of drawn wrong: a viewBox that does not start at 0 0, and any transform.
  if (/\stransform\s*=/i.test(text)) return { path: '', box: 24, why: 'transform' };
  for (const tag of String(text).match(/<(?:svg|path|rect|circle|ellipse|polygon)\b[^>]*>/gi) || []) {
    const name = /^<(\w+)/.exec(tag)[1].toLowerCase();
    if (name === 'svg') {
      const vb = /([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(attr(tag, 'viewBox') || '');
      if (vb && (Number(vb[1]) !== 0 || Number(vb[2]) !== 0)) return { path: '', box: 24, why: 'origin' };
      box = vb ? Math.max(Number(vb[3]), Number(vb[4])) : Math.max(num(tag, 'width'), num(tag, 'height'));
    } else if (name === 'path') {
      if (attr(tag, 'd')) parts.push(attr(tag, 'd').trim());
    } else if (name === 'rect') {
      const x = num(tag, 'x'), y = num(tag, 'y'), w = num(tag, 'width'), h = num(tag, 'height');
      if (w > 0 && h > 0) parts.push(`M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`);
    } else if (name === 'circle' || name === 'ellipse') {
      const cx = num(tag, 'cx'), cy = num(tag, 'cy'), rx = name === 'circle' ? num(tag, 'r') : num(tag, 'rx'), ry = name === 'circle' ? rx : num(tag, 'ry');
      if (rx > 0 && ry > 0) parts.push(`M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`);
    } else if (name === 'polygon') {
      const n = (attr(tag, 'points') || '').trim().split(/[\s,]+/).map(Number);
      if (n.length >= 6 && n.length % 2 === 0 && n.every(Number.isFinite)) {
        parts.push('M' + n.map((v, i) => (i && i % 2 === 0 ? 'L' : i ? ' ' : '') + f(v)).join('') + 'Z');
      }
    }
  }
  return { path: parts.join(' '), box: box >= 8 && box <= 2048 ? box : 24 };
}
const TYPE_HINT = 'Type missing? Ask an administrator to add it (More tab, Place types).';
const LANG_HINT = 'Language missing? Ask an administrator to add it (Languages tab).';
const pfRow = (n) =>
  `<div class="row pf-name"><select class="nl" aria-label="Language" title="${LANG_HINT}">${langOptions(n.lang)}</select>` +
  `<input class="nn" value="${esc(n.name)}" placeholder="name" aria-label="Name">` +
  `<button type="button" class="pf-up" title="Move up: the first name of a language is the one shown on the map">↑</button>` +
  `<button type="button" class="pf-del" title="Remove this name">✕</button></div>`;

// Names over time (T-043, places and shapes): every name row has an optional period, with the date field of the period filter.
const NAME_PERIOD = { modes: ['none', 'exact'], names: { none: 'Any' } };
const pfRowDated = (n) =>
  pfRow(n).replace(
    /<\/div>$/,
    `<details class="pf-period"${n.date_from || n.date_to ? ' open' : ''}><summary>Period of this name</summary><div class="pf-sub">From</div>${dfHTML('pf-nfrom', n.date_from || null, NAME_PERIOD)}<div class="pf-sub">To</div>${dfHTML('pf-nto', n.date_to || null, NAME_PERIOD)}</details></div>`
  );
/** The names of a form with their periods; throws the readable error of a bad date. */
function pfReadNames(root) {
  return [...root.querySelectorAll('.pf-name')]
    .map((r) => {
      const n = { lang: r.querySelector('.nl').value, name: r.querySelector('.nn').value.trim() },
        f = r.querySelector('.pf-nfrom'),
        t = r.querySelector('.pf-nto');
      if (f && t && n.name) {
        const a = dfRead(f, 'Name from'),
          b = dfRead(t, 'Name to');
        dateOrderCheck(a, b);
        if (a) n.date_from = a;
        if (b) n.date_to = b;
      }
      return n;
    })
    .filter((n) => n.name);
}

/** p: { names, type, date_from, date_to, height_m, lat, lon } (dates are date objects or null) */
function placeFormHTML(p) {
  const names = p.names && p.names.length ? p.names : [{ lang: 'en', name: '' }],
    mountain = p.type === 'mountain';
  return (
    `<div class="pf"><div class="label">Names</div><div class="pf-names" data-dated="1">${names.map((n) => pfRowDated(n)).join('')}</div>` +
    `<button type="button" class="pf-add">+ Add another name</button>` +
    `<div class="sn">A place can have several names, even in one language (Ararat and Masis). The first name of each language is shown on the map. ${LANG_HINT}</div>` +
    `<div class="label">Type</div><select class="pf-type" title="${TYPE_HINT}">${typeOptions(p.type, typeof document !== 'undefined' && document.getElementById ? (document.getElementById('lang') || {}).value : 'en')}</select>` +
    `<div class="pf-when"${mountain ? ' hidden' : ''}><div class="label">Dates (optional)</div>` +
    `<div class="sn">Leave “Unknown” when you do not know a date. Choose “Approximate” or “Range” when you only know roughly.</div>` +
    `<div class="pf-sub">Began / founded</div>${dfHTML('pf-from', p.date_from)}` +
    `<div class="pf-sub">Ended / abandoned</div>${dfHTML('pf-to', p.date_to)}</div>` +
    `<div class="pf-height"${mountain ? '' : ' hidden'}><div class="label">Height (optional)</div>` +
    `<input class="pf-h" type="number" min="0" max="${MAX_HEIGHT_M}" step="1" value="${p.height_m ?? ''}" placeholder="metres above sea level" aria-label="Height in metres"></div>` +
    `<div class="label">Position (latitude, longitude)</div><div class="row">` +
    `<input class="pf-lat" type="number" step="any" value="${p.lat}"><input class="pf-lon" type="number" step="any" value="${p.lon}"></div></div>`
  );
}

/** Makes the add / move up / remove buttons, the type switch and the date fields inside root work. Call once per container. */
function placeFormWire(root) {
  dfWire(root);
  root.addEventListener('change', (e) => {
    if (!e.target.matches('.pf-type')) return;
    const mountain = e.target.value === 'mountain'; // a mountain has a height instead of dates
    root.querySelector('.pf-when').hidden = mountain;
    root.querySelector('.pf-height').hidden = !mountain;
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.pf-add, .pf-del, .pf-up');
    if (!b) return;
    const box = root.querySelector('.pf-names');
    if (b.classList.contains('pf-add')) {
      const last = box.lastElementChild;
      box.insertAdjacentHTML('beforeend', (box.dataset.dated ? pfRowDated : pfRow)({ lang: last ? last.querySelector('.nl').value : 'en', name: '' }));
      box.lastElementChild.querySelector('.nn').focus();
      return;
    }
    const row = b.closest('.pf-name');
    if (b.classList.contains('pf-del')) {
      if (box.children.length > 1) row.remove();
      else row.querySelector('.nn').value = '';
    } else if (row.previousElementSibling) box.insertBefore(row, row.previousElementSibling);
  });
}

/** Reads and checks the form inside root. Returns the fields the server expects, or throws a readable error. */
function readPlaceForm(root) {
  const q = (s) => root.querySelector(s);
  const names = pfReadNames(root);
  if (!names.length) throw Error('Give the place at least one name.');
  names.forEach((n) => {
    if (!languages.some((l) => l.code === n.lang))
      throw Error(`The language “${n.lang || '?'}” is not in the list. Ask an administrator to add it.`);
  });
  const type = q('.pf-type').value,
    mountain = type === 'mountain';
  let from = null,
    to = null,
    height = null;
  if (mountain) {
    const h = q('.pf-h').value.trim();
    if (h !== '') {
      height = Number(h);
      if (!Number.isInteger(height) || height < 0 || height > MAX_HEIGHT_M)
        throw Error(`Height must be a whole number of metres from 0 to ${MAX_HEIGHT_M}.`);
    }
  } else {
    from = dfRead(q('.pf-from'), 'Began');
    to = dfRead(q('.pf-to'), 'Ended');
    dateOrderCheck(from, to);
  }
  const lat = parseFloat(q('.pf-lat').value),
    lon = parseFloat(q('.pf-lon').value);
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180))
    throw Error('Latitude must be between −90 and 90, longitude between −180 and 180.');
  return { lat, lon, type, names, date_from: from, date_to: to, height_m: height };
}
