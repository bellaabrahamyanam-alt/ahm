// Shared UI components (task F3, tasks/foundation.md). One place for what several tabs draw the same way.
// Interface (the screens never reach into datefield.js or placeform.js directly for these):
//   uiDateEditor.html(cls, date, opts)  HTML of a date field; date = null (unknown) or { fmt, ts, mode, ts_to }
//   uiDateEditor.read(el, what)         the date object, or null when Unknown; throws a readable Error
//   uiDateEditor.check(el, what)        never throws: { date, error }  (error is '' or the message to show)
//   uiDateEditor.safe(el)               like read, an unreadable field is marked red and counts as Unknown
//   uiDateEditor.wire(root)             makes the mode and format selects inside root work (once per container)
//   uiDateEditor.preview(date)          the text shown under the field ("c. 16th century CE"), '' when unknown
//   uiDateFormatGroups()                the format menu: [{ title, formats: [{ id, label, example }] }]
//   uiLanguagePills(cur)                language pills; defined in placeform.js beside langOptions (that file is loaded wherever name rows are)
//   uiStyleEditor.html(kind, color, style)  colour swatches, sliders, pattern tiles, switch; kind = point | line | area | river (the model of docs/05, Types)
//   uiStyleEditor.read(root)            { color, style } as the server stores them; throws a readable Error
//   uiTypePills(items, cur)             type pills; defined in placeform.js (value holder: the select.pf-type next to them)
//   uiState.html(kind, msg, retry)      loading | empty | error | readonly state block; retry = true adds a Retry button (data-retry)
//   uiAdd(label, cls)                   the dashed "+ Add ..." button; uiChip(text, opts) filter / removable chip; uiAccordion(id, icon, title, sub, body, open)
//   uiHistogram(items, lo, hi, n)       counts of dated objects per step, for the Period / Moment footer (undated are not counted)
// Every value is the date object of core/dates.js, so the stored data never changes with the look of the field.
// Components return HTML text and read from the DOM they made; text from data goes through esc().

/** The format menu of the prototype (frame s47), the groups of datefield.js. */
function uiDateFormatGroups() {
  return DF_FORMAT_GROUPS.map(([title, ids]) => ({
    title,
    formats: ids.map((id) => {
      const f = dateFormat(id);
      return { id: f.id, label: f.label, example: f.example };
    }),
  }));
}

const uiDateEditor = {
  html: (cls, date, opts) => dfHTML(cls, date, opts),
  read: (el, what, state) => dfRead(el, what, state),
  safe: (el) => dfSafe(el),
  wire: (root) => dfWire(root),
  preview: (date) => (date ? dateText(date) : ''),
  check(el, what) {
    try {
      return { date: dfRead(el, what), error: '' };
    } catch (e) {
      return { date: null, error: e.message };
    }
  },
};

/**
 * Histogram of the Period / Moment footer (F5): how many dated objects exist in each of `n` equal steps of [lo, hi) seconds.
 * items = anything with date_from / date_to (places, borders, routes); an open end runs to the edge; undated objects are not counted.
 */
function uiHistogram(items, lo, hi, n) {
  const bins = new Array(n).fill(0),
    w = (hi - lo) / n;
  if (!(w > 0)) return bins;
  for (const it of items) {
    if (!it.date_from && !it.date_to) continue;
    const [a, b] = spanBounds(it.date_from, it.date_to),
      s = Math.max(a, lo),
      e = Math.min(b, hi);
    if (e <= s) continue;
    const i0 = Math.min(n - 1, Math.floor((s - lo) / w)),
      i1 = Math.min(n - 1, Math.floor((e - 1 - lo) / w));
    for (let i = i0; i <= i1; i++) bins[i]++;
  }
  return bins;
}

/**
 * Style editor (F6, prototype s20 s43 s44): colour, and by kind: point = symbol + size; line / river = width, opacity, pattern, (line) arrow;
 * area = fill opacity, outline width, outline pattern. The stored shape is the one of docs/05 (Types): { color, style }.
 * Controls carry data-st="..." so one reader serves every screen; symbols are passed in (AHM.map.getSymbols() in the browser).
 */
const UI_SWATCHES = ['#475b66', '#8d6e63', '#b3261e', '#c9a227', '#7b1fa2', '#2c6291', '#587535'];
const UI_PATTERNS = ['solid', 'dashed', 'dotted', 'dashdot'];
const uiStyleEditor = {
  html(kind, color, style, symbols) {
    const st = style || {},
      ol = kind === 'area' ? st.outline || {} : st,
      c = String(color || UI_SWATCHES[0]).toLowerCase(),
      sw = UI_SWATCHES.map((x) => `<button type="button" class="swatch${x === c ? ' on' : ''}" data-st-swatch="${x}" style="background:${x}" aria-label="Colour ${x}"></button>`).join(''),
      slider = (id, label, min, max, step, v, unit) =>
        `<label class="st-row"><span>${label}</span><input type="range" data-st="${id}" min="${min}" max="${max}" step="${step}" value="${v}"><output>${v}${unit}</output></label>`,
      pats = `<div class="st-pats" role="group" aria-label="Pattern">${UI_PATTERNS.map((p) => `<button type="button" class="st-pat${p === (ol.pattern || 'solid') ? ' on' : ''}" data-st-pattern="${p}" aria-pressed="${p === (ol.pattern || 'solid')}"><i class="pat-${p}"></i><span class="sr">${p}</span></button>`).join('')}</div>`;
    let h = `<div class="st-row"><span>Colour</span><span class="st-sw">${sw}<input type="color" data-st="color" value="${esc(c)}" aria-label="Custom colour"></span></div>`;
    if (kind === 'point') {
      h += `<div class="label">Symbol</div><div class="st-syms" role="group" aria-label="Symbol">${(symbols || []).map((y) => `<button type="button" class="st-sym${y.name === st.symbol ? ' on' : ''}" data-st-symbol="${esc(y.name)}" title="${esc(y.label || y.name)}" aria-pressed="${y.name === st.symbol}">${esc(y.label || y.name)}</button>`).join('')}</div>`;
      h += slider('size', 'Size', 4, 14, 0.5, Number(st.size) || 8, '');
    } else if (kind === 'area') {
      h += slider('fill_opacity', 'Fill opacity', 0, 0.8, 0.05, st.fill_opacity == null ? 0.15 : st.fill_opacity, '');
      h += slider('width', 'Outline width', 1, 12, 0.5, Number(ol.width) || 2, ' px') + '<div class="label">Outline pattern</div>' + pats;
    } else {
      h += slider('width', 'Width', 1, 12, 0.5, Number(ol.width) || 2.5, ' px') + slider('opacity', 'Opacity', 0.1, 1, 0.05, ol.opacity == null ? 1 : ol.opacity, '') + '<div class="label">Pattern</div>' + pats;
      if (kind === 'line') h += `<label class="st-row"><span>Arrow shows the direction</span><input type="checkbox" role="switch" data-st="arrow" ${st.arrow ? 'checked' : ''}></label>`;
    }
    return `<div class="st-ed" data-kind="${kind}">${h}</div>`;
  },
  /** Reads the editor inside `root`; the sliders are numbers, a missing control is left out. */
  read(root) {
    const ed = root.querySelector('.st-ed'),
      kind = ed.dataset.kind,
      v = (id) => ed.querySelector(`[data-st="${id}"]`),
      num = (id) => (v(id) ? Number(v(id).value) : undefined),
      pat = (ed.querySelector('.st-pat.on') || {}).dataset;
    const color = v('color').value.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) throw Error('Choose a colour.');
    if (kind === 'point') {
      const y = ed.querySelector('.st-sym.on');
      return { color, style: { ...(y ? { symbol: y.dataset.stSymbol } : {}), size: num('size') } };
    }
    const line = { width: num('width'), pattern: pat ? pat.stPattern : 'solid' };
    if (kind === 'area') return { color, style: { fill_opacity: num('fill_opacity'), outline: { ...line, opacity: 1 } } };
    return { color, style: { ...line, opacity: num('opacity'), ...(kind === 'line' ? { arrow: !!(v('arrow') && v('arrow').checked) } : {}) } };
  },
};
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-st-swatch], [data-st-pattern], [data-st-symbol]');
    const ed = b && b.closest('.st-ed');
    if (!ed) return;
    const group = b.matches('[data-st-swatch]') ? '[data-st-swatch]' : b.matches('[data-st-pattern]') ? '[data-st-pattern]' : '[data-st-symbol]';
    ed.querySelectorAll(group).forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.stSwatch) ed.querySelector('[data-st="color"]').value = b.dataset.stSwatch;
    ed.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('input', (e) => {
    const ed = e.target.closest && e.target.closest('.st-ed');
    if (!ed) return;
    if (e.target.type === 'range' && e.target.nextElementSibling) e.target.nextElementSibling.value = e.target.value + (/px/.test(e.target.nextElementSibling.textContent) ? ' px' : '');
    if (e.target.dataset.st === 'color') ed.querySelectorAll('[data-st-swatch]').forEach((x) => x.classList.toggle('on', x.dataset.stSwatch === e.target.value.toLowerCase()));
  });
}

/** States every list and sheet needs (F2): loading, empty, error (with Retry) and read-only. Text goes through esc(). */
const uiState = {
  html: (kind, msg, retry) =>
    `<div class="state state-${kind}" role="${kind === 'error' ? 'alert' : 'status'}"><p>${esc(msg)}</p>${retry ? '<button type="button" class="primary" data-retry>Retry</button>' : ''}</div>`,
};
/** The dashed "add" button (prototype: Add another name, Add language, Add category, Add image overlay). */
const uiAdd = (label, cls) => `<button type="button" class="add-dashed ${cls || ''}"><span aria-hidden="true">+</span> ${esc(label)}</button>`;
/** A chip: opts { on, count, removable, icon (HTML), data (attribute text) }. */
const uiChip = (text, o = {}) =>
  `<button type="button" class="chip2${o.on ? ' on' : ''}" aria-pressed="${!!o.on}" ${o.data || ''}>${o.icon || ''}<span>${esc(text)}</span>${o.count != null ? `<sup>${esc(o.count)}</sup>` : ''}${o.removable ? '<span class="x" aria-hidden="true">✕</span>' : ''}</button>`;
/** The accordion card of More (prototype s19): icon tile, title, one-line subtitle, chevron; native <details>, so it works without script. */
const uiAccordion = (id, icon, title, sub, body, open) =>
  `<details class="acc" id="${esc(id)}"${open ? ' open' : ''}><summary><span class="acc-ico">${icon}</span><span class="acc-t"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="acc-chev" aria-hidden="true">⌄</span></summary><div class="acc-body">${body}</div></details>`;
if (typeof document !== 'undefined' && document.addEventListener)
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('[data-retry]')) location.reload();
  });
