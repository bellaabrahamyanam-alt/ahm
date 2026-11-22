// The date field used everywhere a date is typed: place begin/end, note date, period filter.
// The person chooses how sure the date is (unknown, exact, approximate, range) and the FORMAT it is typed in
// (YYYY-MM-DD, DD.MM.YYYY, MM/DD/YYYY, "21 March 1500", "March 1500", year, century, millennium).
// The result is the date object of dates.js: the chosen format plus a UTC time stamp, so the date can always be
// shown again exactly as it was entered. An unknown date is `null` and is always allowed (dates are optional).

const DF_MODES = { none: 'Unknown', exact: 'Exact', approx: 'Approximate (c.)', range: 'Range' };
const dfOptions = (pairs, cur) =>
  pairs.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');

/** The input fields of ONE date (or one end of a range) in format `fmt`; f = fields from dateFromTs, or {} when empty. */
function dfGroup(fmt, f) {
  const F = dateFormat(fmt);
  const num = (c, ph, min, max, v) =>
    `<input class="${c}" type="number" min="${min}" max="${max}" step="1" placeholder="${ph}" value="${v ?? ''}" aria-label="${ph}">`;
  const part = (k) => {
    if (k === 'd') return num('df-d', 'DD', 1, 31, f.d);
    if (k === 'm')
      return F.monthName
        ? `<select class="df-m" aria-label="Month">${dfOptions(
            MONTHS.map((n, i) => [String(i + 1), n]),
            String(f.m ?? 1)
          )}</select>`
        : num('df-m', 'MM', 1, 12, f.m);
    if (k === 'y') return num('df-y', 'YYYY', 1, 99999, f.y);
    return num('df-n', F.word, 1, fmt === 'c' ? 1000 : 100, f.n) + `<span class="sn">${F.word}</span>`;
  };
  return (
    `<div class="df-g">${F.fields.map(part).join('')}` +
    `<select class="df-era" aria-label="Era">${dfOptions([['CE', 'CE'], ['BCE', 'BCE']], f.era || 'CE')}</select></div>`
  );
}
const dfBody = (mode, fmt, ts, tsTo) => {
  if (mode === 'none') return '';
  const f = (t) => (t === null || t === undefined ? {} : dateFromTs(fmt, t));
  return dfGroup(fmt, f(ts)) + (mode === 'range' ? '<div class="sn">to</div>' + dfGroup(fmt, f(tsTo)) : '');
};

/**
 * HTML of one date field. date: a date object or null/undefined (unknown).
 * opts.modes: which certainties to offer (default all four); opts.names: their labels; opts.fmt: format of an empty field.
 */
function dfHTML(cls, date, opts) {
  opts = opts || {};
  const modes = opts.modes || ['none', 'exact', 'approx', 'range'],
    names = Object.assign({}, DF_MODES, opts.names),
    mode = date ? date.mode : 'none',
    fmt = date ? date.fmt : opts.fmt || 'y';
  return (
    `<div class="df ${cls}" data-mode="${mode}" data-fmt="${fmt}"><div class="df-seg" role="group" aria-label="How sure is the date">${modes
      .map((m) => `<button type="button" class="${m === mode ? 'on' : ''}" data-mode="${m}">${(names[m] || '').replace('Approximate (c.)', 'Approx.')}</button>`)
      .join('')}</div><div class="row">` +
    `<select class="df-mode" aria-label="How sure is the date">${dfOptions(
      modes.map((m) => [m, names[m]]),
      mode
    )}</select>` +
    `<select class="df-fmt" aria-label="Date format">${dfOptions(
      DATE_FORMATS.map((f) => [f.id, f.label + ' — ' + f.example]),
      fmt
    )}</select></div>` +
    `<div class="df-body">${dfBody(mode, fmt, date && date.ts, date && date.ts_to)}</div></div>`
  );
}

/** Reads one date field. Returns a date object, or null when it is set to Unknown. Throws a readable error. */
function dfRead(el, what, state) {
  what = what || 'Date';
  const mode = state ? state.mode : el.querySelector('.df-mode').value,
    fmt = state ? state.fmt : el.querySelector('.df-fmt').value;
  if (mode === 'none') return null;
  const ts = (g) => {
    const q = (s) => (g.querySelector(s) ? g.querySelector(s).value : undefined);
    try {
      return dateToTs(fmt, { era: q('.df-era'), y: q('.df-y'), m: q('.df-m'), d: q('.df-d'), n: q('.df-n') });
    } catch (e) {
      throw Error(`${what}: ${e.message}`);
    }
  };
  const groups = el.querySelectorAll('.df-g');
  return dateClean({ fmt, mode, ts: ts(groups[0]), ts_to: mode === 'range' ? ts(groups[1]) : null }, what);
}
/** Like dfRead but never throws: an unreadable date marks the field red and counts as "not set" (used by filters). */
function dfSafe(el) {
  try {
    const d = dfRead(el, 'Date');
    el.classList.remove('bad');
    el.title = '';
    return d;
  } catch (e) {
    el.classList.add('bad');
    el.title = e.message;
    return null;
  }
}

/** Makes the "how sure" and "format" selects of every date field inside root work. Call once per container. */
function dfWire(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.df-seg button'); // the segmented "how sure": sets the hidden select, which does the work
    if (!b) return;
    const sel = b.closest('.df').querySelector('.df-mode');
    if (sel.value === b.dataset.mode) return;
    sel.value = b.dataset.mode;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('.df');
    if (!el || !e.target.matches('.df-mode, .df-fmt')) return;
    el.querySelectorAll('.df-seg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === el.querySelector('.df-mode').value));
    let keep = null;
    try {
      keep = dfRead(el, 'Date', { mode: el.dataset.mode, fmt: el.dataset.fmt }); // what was typed, in the OLD format
    } catch (err) {}
    const mode = el.querySelector('.df-mode').value,
      fmt = el.querySelector('.df-fmt').value;
    el.dataset.mode = mode;
    el.dataset.fmt = fmt;
    el.classList.remove('bad');
    el.querySelector('.df-body').innerHTML = dfBody(
      mode,
      fmt,
      keep && keep.ts,
      keep && keep.mode === 'range' ? keep.ts_to : null
    );
  });
}
