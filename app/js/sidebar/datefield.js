// The date field used everywhere a date is typed: place begin/end, note date, period filter.
// The person chooses how sure the date is (unknown, exact, approximate, range) and the FORMAT it is typed in
// (YYYY-MM-DD, DD.MM.YYYY, MM/DD/YYYY, "21 March 1500", "March 1500", year, century, millennium).
// The result is the date object of dates.js: the chosen format plus a UTC time stamp, so the date can always be
// shown again exactly as it was entered. An unknown date is `null` and is always allowed (dates are optional).

const DF_MODES = { none: 'Unknown', exact: 'Exact', approx: 'Approx.', range: 'Range' };
// the format menu (prototype s47): formats grouped by precision; every DATE_FORMATS id exactly once
const DF_FORMAT_GROUPS = [
  ['Full date', ['ymd', 'dmy', 'mdy', 'dmony']],
  ['Month', ['mony']],
  ['Year and coarser', ['y', 'c', 'm']],
];
const DF_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
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
    // CE | BCE toggle (prototype s48). The select stays the value holder (read by dfRead, driven by the tests); the buttons set it.
    `<span class="df-eraT" role="group" aria-label="Era">${['CE', 'BCE']
      .map((e) => `<button type="button" data-era="${e}" class="${(f.era || 'CE') === e ? 'on' : ''}">${e}</button>`)
      .join('')}</span>` +
    `<select class="df-era sr" aria-label="Era">${dfOptions([['CE', 'CE'], ['BCE', 'BCE']], f.era || 'CE')}</select></div>`
  );
}
const dfBody = (mode, fmt, ts, tsTo) => {
  if (mode === 'none') return '';
  const f = (t) => (t === null || t === undefined ? {} : dateFromTs(fmt, t));
  return mode === 'range'
    ? `<div class="df-lbl">From</div>${dfGroup(fmt, f(ts))}<div class="df-lbl">To</div>${dfGroup(fmt, f(tsTo))}`
    : dfGroup(fmt, f(ts));
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
    `<div class="df ${cls}" data-mode="${mode}" data-fmt="${fmt}">` +
    // segmented control (prototype s48); the select is the value holder, the buttons set it
    `<div class="df-modes" role="group" aria-label="How sure is the date">${modes
      .map((m) => `<button type="button" data-mode="${m}" class="${m === mode ? 'on' : ''}">${esc(names[m])}</button>`)
      .join('')}</div>` +
    `<div class="row"><select class="df-mode sr" aria-label="How sure is the date">${dfOptions(
      modes.map((m) => [m, names[m]]),
      mode
    )}</select>` +
    `<span class="df-fmtw"><button type="button" class="df-fmtbtn" aria-haspopup="listbox" aria-expanded="false">${DF_CAL}<span>${esc(dateFormat(fmt).label)}</span><span aria-hidden="true">⌄</span></button>` +
    `<div class="df-menu" role="listbox" hidden>${DF_FORMAT_GROUPS.map(
      ([title, ids]) =>
        `<div class="df-mg">${esc(title)}</div>${ids
          .map((id) => `<button type="button" role="option" data-fmt="${id}" aria-selected="${id === fmt}" class="${id === fmt ? 'on' : ''}"><b>${esc(dateFormat(id).label)}</b><small>${esc(dateFormat(id).example)}</small></button>`)
          .join('')}`
    ).join('')}</div></span>` +
    `<select class="df-fmt sr" aria-label="Date format">${DF_FORMAT_GROUPS.map(
      ([title, ids]) =>
        `<optgroup label="${esc(title)}">${dfOptions(
          ids.map((id) => [id, dateFormat(id).label + ' — ' + dateFormat(id).example]),
          fmt
        )}</optgroup>`
    ).join('')}</select></div>` +
    `<div class="df-body">${dfBody(mode, fmt, date && date.ts, date && date.ts_to)}</div>` +
    `<div class="df-prev" aria-live="polite">${esc(date ? dateText(date) : '')}</div></div>`
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

/** The preview line under a date field: the date as it will be stored, or the reason it cannot be, in red. */
function dfRefresh(el) {
  el.querySelectorAll('.df-modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === el.dataset.mode));
  el.querySelectorAll('.df-g').forEach((g) => {
    const era = g.querySelector('.df-era');
    g.querySelectorAll('.df-eraT button').forEach((b) => b.classList.toggle('on', era && b.dataset.era === era.value));
  });
  const fb = el.querySelector('.df-fmtbtn > span');
  if (fb) fb.textContent = dateFormat(el.dataset.fmt).label;
  el.querySelectorAll('.df-menu [data-fmt]').forEach((b) => {
    b.classList.toggle('on', b.dataset.fmt === el.dataset.fmt);
    b.setAttribute('aria-selected', String(b.dataset.fmt === el.dataset.fmt));
  });
  const out = el.querySelector('.df-prev');
  if (!out) return;
  let text = '',
    bad = false;
  try {
    const d = dfRead(el, 'Date');
    text = d ? dateText(d) : '';
  } catch (e) {
    text = el.querySelector('.df-g input:not(:placeholder-shown)') ? e.message : '';
    bad = !!text;
  }
  out.textContent = text;
  out.classList.toggle('err', bad);
}

/** Makes the "how sure" and "format" selects (and the buttons that drive them) of every date field inside root work. Call once per container. */
function dfWire(root) {
  root.addEventListener('click', (e) => {
    const fb = e.target.closest('.df-fmtbtn'),
      fi = e.target.closest('.df-menu [data-fmt]');
    if (fb && root.contains(fb)) {
      const m = fb.parentElement.querySelector('.df-menu');
      dfCloseMenus(m);
      m.hidden = !m.hidden;
      fb.setAttribute('aria-expanded', String(!m.hidden));
      return;
    }
    if (fi && root.contains(fi)) {
      const holder = fi.closest('.df').querySelector('.df-fmt');
      dfCloseMenus();
      holder.value = fi.dataset.fmt;
      holder.dispatchEvent(new Event('change', { bubbles: true })); // the same path as choosing in the select
      return;
    }
    const b = e.target.closest('.df-modes button, .df-eraT button');
    if (!b || !root.contains(b)) return;
    const holder = b.closest('.df-modes') ? b.closest('.df').querySelector('.df-mode') : b.closest('.df-g').querySelector('.df-era');
    holder.value = b.dataset.mode || b.dataset.era;
    holder.dispatchEvent(new Event('change', { bubbles: true })); // the same path as choosing in the select
  });
  root.addEventListener('input', (e) => {
    const el = e.target.closest('.df');
    if (el) dfRefresh(el);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('.df');
    if (!el) return;
    if (!e.target.matches('.df-mode, .df-fmt')) return dfRefresh(el);
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
    dfRefresh(el);
  });
}

/** Closes every open format menu (except `keep`): on a click elsewhere, on Escape, when another one opens. */
function dfCloseMenus(keep) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.df-menu:not([hidden])').forEach((m) => {
    if (m === keep) return;
    m.hidden = true;
    const b = m.parentElement.querySelector('.df-fmtbtn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', (e) => e.target.closest && !e.target.closest('.df-fmtw') && dfCloseMenus());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && dfCloseMenus());
}
