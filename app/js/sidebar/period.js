// The period filter fields of the Explore filters (sidebar domain): two date fields, "from" and "to".
const PERIOD_OPTS = { modes: ['none', 'exact'], names: { none: 'Any' } }; // the period filter takes unknown ("any") or exact
function initPeriod() {
  $('#fFrom').innerHTML = dfHTML('fl-from', null, PERIOD_OPTS);
  $('#fTo').innerHTML = dfHTML('fl-to', null, PERIOD_OPTS);
}
/** [start, end) of the chosen period, each null when not set. "to 5th century" covers the whole 5th century. */
function periodBounds() {
  const a = dfSafe($('#fFrom .df')),
    b = dfSafe($('#fTo .df'));
  return [a ? dateBounds(a)[0] : null, b ? dateBounds(b)[1] : null];
}
const periodActive = () => periodBounds().some((v) => v !== null);

// ---- the footer: Period (a filter) or Moment (time travel), one slot on every tab (F5, frames s1, s22, s45, s49) ----
// The Period still lives in the two Filters fields (#fFrom, #fTo); the footer reads and writes them, so places.js, shapes.js and routes.js
// keep calling periodBounds(). The Moment lives in AHM.state 'time' (timebar.js). Moment is on => Moment is drawn, the Period fields stay as they were.
const FT_STEPS = 48;
const FT_SPEEDS = [1, 10, 50, 100, 500]; // years per second
const FT_ICON = {
  clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  travel: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/><path d="M10 9l5 3-5 3z"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
let ftSelf = false; // true while the footer itself writes the fields: no redraw under the hand that drags
const ftSpan = () => {
  const s = timeSpan([...places, ...shapes]);
  return s && s[1] - 1 > s[0] ? s : null;
};
const ftSec = (span, v) => span[0] + ((span[1] - 1 - span[0]) * v) / 1000;
const ftPos = (span, sec) => Math.max(0, Math.min(1000, Math.round((1000 * (sec - span[0])) / (span[1] - 1 - span[0]))));
/** A whole year as a date value ("exact", format Year) from seconds. */
function ftYear(sec) {
  const a = Number(secToIso(sec).match(/^([+-]?\d+)-/)[1]);
  return { fmt: 'y', ts: secToIso(daysFromCivil(a, 1, 1) * DAY_SECONDS), mode: 'exact', ts_to: null };
}
const ftLabel = (sec) => dateText(ftYear(sec));
function ftBars(span, lo, hi, mark) {
  const bins = uiHistogram([...places, ...shapes], span[0], span[1], FT_STEPS),
    max = Math.max(1, ...bins),
    w = (span[1] - span[0]) / FT_STEPS;
  return bins
    .map((c, i) => {
      const a = span[0] + i * w,
        on = mark === 'before' ? a < hi : a + w > lo && a < hi;
      return `<i class="${on ? 'in' : ''}" style="height:${Math.max(6, Math.round((100 * c) / max))}%"></i>`;
    })
    .join('');
}
function ftAxis(span) {
  const zero = span[0] < 0 && span[1] > 0 ? `<span style="left:${(100 * (0 - span[0])) / (span[1] - span[0])}%">0</span>` : '';
  return `<div class="ft-axis"><span class="l">${esc(ftLabel(span[0]))}</span>${zero}<span class="r">${esc(ftLabel(span[1] - 1))}</span></div>`;
}
function ftRender() {
  const root = $('#foot');
  if (!root || ftSelf) return;
  const span = ftSpan(),
    t = AHM.state.get('time');
  if (t.at !== null) {
    const d = { fmt: 'y', ts: t.at, mode: 'exact', ts_to: null },
      at = isoToSec(t.at);
    root.innerHTML = `<div class="ft ft-moment">
      <div class="ft-row"><button type="button" class="ft-play" id="ftPlay" aria-label="${t.playing ? 'Pause' : 'Play'}">${t.playing ? '⏸' : '▶'}</button>
        <div class="ft-mom"><small>MOMENT</small><div class="ft-date">${esc(dateText(d))}</div></div>
        <button type="button" class="icon-btn" id="ftOff" title="Back to the period" aria-label="Back to the period">${FT_ICON.x}</button></div>
      <div class="seg" id="ftSpeed" role="group" aria-label="Speed, years per second">${FT_SPEEDS.map((v) => `<button type="button" data-speed="${v}" class="${v === t.speed ? 'on' : ''}">${v}×</button>`).join('')}</div>
      ${span ? `<div class="ft-hist"><div class="ft-bars">${ftBars(span, 0, at, 'before')}</div><input type="range" id="ftAt" min="0" max="1000" value="${ftPos(span, at)}" aria-label="Moment" /></div>${ftAxis(span)}` : ''}
      <label class="ft-sw"><span>Show undated places</span><input type="checkbox" role="switch" id="ftUndated" ${t.undated ? 'checked' : ''} /></label></div>`;
    return;
  }
  const [lo, hi] = periodBounds(),
    any = lo === null && hi === null,
    a = dfSafe($('#fFrom .df')),
    b = dfSafe($('#fTo .df'));
  root.innerHTML = `<div class="ft ft-period">
    <div class="ft-row">${FT_ICON.clock}<span class="ft-txt">Period <b>${any ? 'Any' : esc(spanText(a, b).replace(/^(from|until) /, ''))}</b></span>
      <button type="button" class="icon-btn" id="ftTravel" title="Time travel: the map at one moment" aria-label="Time travel"${span ? '' : ' disabled'}>${FT_ICON.travel}</button>
      <button type="button" class="icon-btn" id="ftClear" title="Reset the period to Any" aria-label="Reset the period to Any"${any ? ' disabled' : ''}>${FT_ICON.x}</button></div>
    ${span ? `<div class="ft-hist"><div class="ft-bars">${ftBars(span, lo === null ? -Infinity : lo, hi === null ? Infinity : hi)}</div>
      <input type="range" id="ftFrom" min="0" max="1000" value="${lo === null ? 0 : ftPos(span, lo)}" aria-label="Period from" />
      <input type="range" id="ftTo" min="0" max="1000" value="${hi === null ? 1000 : ftPos(span, hi)}" aria-label="Period to" /></div>${ftAxis(span)}` : ''}</div>`;
}
/** Writes one end of the Period into its Filters field (position 0 or 1000 = open end = Any) and lets the lists refilter. */
function ftSetEnd(which, span, v) {
  const open = which === 'from' ? v <= 0 : v >= 1000;
  const el = $(which === 'from' ? '#fFrom' : '#fTo');
  el.innerHTML = dfHTML(which === 'from' ? 'fl-from' : 'fl-to', open ? null : ftYear(ftSec(span, v)), PERIOD_OPTS);
  ftSelf = true;
  try {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    setTimeout(() => (ftSelf = false), 0); // after the MutationObserver below has seen the new field
  }
}
if ($('#foot')) {
  const foot = $('#foot');
  foot.addEventListener('input', (e) => {
    const id = e.target.id,
      span = ftSpan();
    if (!span) return;
    if (id === 'ftFrom' || id === 'ftTo') {
      const f = $('#ftFrom'),
        t = $('#ftTo');
      if (+f.value > +t.value) (id === 'ftFrom' ? (f.value = t.value) : (t.value = f.value));
      ftSetEnd(id === 'ftFrom' ? 'from' : 'to', span, +e.target.value);
    } else if (id === 'ftAt') {
      tbStop();
      tbPatch({ at: secToIso(Math.round(ftSec(span, +e.target.value))), playing: false });
    }
  });
  foot.addEventListener('change', (e) => {
    if (e.target.id === 'ftUndated') tbPatch({ undated: e.target.checked });
    else if (e.target.id === 'ftFrom' || e.target.id === 'ftTo') ftRender();
  });
  foot.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'ftTravel') tbOpen();
    else if (b.id === 'ftOff') tbOff();
    else if (b.id === 'ftPlay') tbPlay(!AHM.state.get('time').playing);
    else if (b.dataset.speed) tbPatch({ speed: Number(b.dataset.speed) });
    else if (b.id === 'ftClear') {
      initPeriod();
      $('#fFrom').dispatchEvent(new Event('change', { bubbles: true }));
      ftRender();
    }
  });
  // the Filters fields (typed, reset, cleared by a chip) redraw the footer; typing does not change the DOM, so the events are listened to as well
  ['#fFrom', '#fTo'].forEach((s) => {
    ['input', 'change'].forEach((ev) => $(s).addEventListener(ev, () => ftRender()));
    if (typeof MutationObserver !== 'undefined') new MutationObserver(() => ftRender()).observe($(s), { childList: true });
  });
}
