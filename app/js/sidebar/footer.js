// The Period | Moment footer (foundation v2, frames s001 s022 s049). Markup is static in the footer region of index.html;
// this file only sets values, classes and `hidden`, and handles events. Logic stays in period.js (periodBounds ...) and timebar.js (tb*).
// The Period lives in the two Filters fields (#fFrom, #fTo); the footer reads and writes them, so places.js, shapes.js and routes.js keep calling periodBounds().
// The Moment lives in AHM.state 'time'. Moment on => Moment is drawn, the Period fields stay as they were.
const FT_STEPS = 48;
let ftSelf = false; // true while the footer itself writes the fields: no redraw under the hand that drags
const ftSpan = () => {
  const s = timeSpan([...places, ...shapes]);
  return s && s[1] - 1 > s[0] ? s : null;
};
const ftSec = (span, v) => span[0] + ((span[1] - 1 - span[0]) * v) / 1000;
const ftPos = (span, sec) => Math.max(0, Math.min(1000, Math.round((1000 * (sec - span[0])) / (span[1] - 1 - span[0]))));
/** A whole year as a date value (\"exact\", format Year) from seconds. */
function ftYear(sec) {
  const a = Number(secToIso(sec).match(/^([+-]?\d+)-/)[1]);
  return { fmt: 'y', ts: secToIso(daysFromCivil(a, 1, 1) * DAY_SECONDS), mode: 'exact', ts_to: null };
}
const ftLabel = (sec) => dateText(ftYear(sec));
/** The 48 bars are made once, from a template; later only their height and class change. */
function ftInitBars() {
  const box = $('#ftBars');
  if (box.children.length) return;
  for (let i = 0; i < FT_STEPS; i++) box.append(kit.tpl('t-ft-bar'));
}
function ftDrawBars(span, lo, hi, before) {
  const bins = uiHistogram([...places, ...shapes], span[0], span[1], FT_STEPS),
    max = Math.max(1, ...bins),
    w = (span[1] - span[0]) / FT_STEPS;
  [...$('#ftBars').children].forEach((b, i) => {
    const a = span[0] + i * w;
    b.style.height = Math.max(6, Math.round((100 * bins[i]) / max)) + '%';
    b.classList.toggle('in', before ? a < hi : a + w > lo && a < hi);
  });
}
function ftRender(force) {
  const root = $('#foot');
  if (!root || (ftSelf && !force)) return; // force = the hand let go: draw now
  ftInitBars();
  if (typeof shellSync === 'function') shellSync();
  const span = ftSpan(),
    t = AHM.state.get('time'),
    moment = t.at !== null;
  root.querySelectorAll('[data-ft]').forEach((n) => kit.show(n, n.dataset.ft === (moment ? 'moment' : 'period')));
  $('#ftModePeriod').checked = !moment;
  $('#ftModeMoment').checked = moment;
  $('#ftModeMoment').disabled = !span && !moment; // nothing to travel through until an object has a date
  kit.show($('#ftHist'), !!span);
  kit.show($('#ftAxis'), !!span);
  if (span) {
    $('#ftAxL').textContent = ftLabel(span[0]);
    $('#ftAxR').textContent = ftLabel(span[1] - 1);
    const z = $('#ftAxZ'),
      y0 = daysFromCivil(0, 1, 1) * DAY_SECONDS, // the year 0, not the 1970 epoch
      zero = span[0] < y0 && span[1] > y0;
    kit.show(z, zero);
    if (zero) z.style.left = (100 * (y0 - span[0])) / (span[1] - span[0]) + '%';
  }
  if (moment) {
    const at = isoToSec(t.at);
    $('#ftDate').textContent = dateText({ fmt: 'y', ts: t.at, mode: 'exact', ts_to: null });
    const play = $('#ftPlay');
    play.setAttribute('aria-label', t.playing ? 'Pause' : 'Play');
    play.classList.toggle('ahm-playing', !!t.playing);
    root.querySelectorAll('#ftSpeed input').forEach((r) => (r.checked = Number(r.value) === t.speed));
    $('#ftUndated').checked = !!t.undated;
    if (span) {
      ftDrawBars(span, 0, at, true);
      $('#ftAt').value = ftPos(span, at);
    }
    return;
  }
  const [lo, hi] = periodBounds(),
    any = lo === null && hi === null,
    a = dfSafe($('#fFrom .df')),
    b = dfSafe($('#fTo .df'));
  $('#ftRange').textContent = any ? 'Any' : spanText(a, b).replace(/^(from|until) /, '');
  $('#ftClear').disabled = any;
  if (span) {
    ftDrawBars(span, lo === null ? -Infinity : lo, hi === null ? Infinity : hi, false);
    $('#ftFrom').value = lo === null ? 0 : ftPos(span, lo);
    $('#ftTo').value = hi === null ? 1000 : ftPos(span, hi);
  }
}
/** Writes one end of the Period into its Filters field (position 0 or 1000 = open end = Any) and lets the lists refilter. */
function ftSetEnd(which, span, v) {
  const open = which === 'from' ? v <= 0 : v >= 1000;
  periodSetField(which, open ? null : ftYear(ftSec(span, v)));
  ftSelf = true;
  try {
    $(which === 'from' ? '#fFrom' : '#fTo').dispatchEvent(new Event('change', { bubbles: true }));
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
    const el = e.target;
    if (el.id === 'ftUndated') tbPatch({ undated: el.checked });
    else if (el.id === 'ftFrom' || el.id === 'ftTo') ftRender(true);
    else if (el.name === 'ftMode') (el.value === 'moment' ? tbOpen : tbOff)();
    else if (el.name === 'ftSpeed') tbPatch({ speed: Number(el.value) });
  });
  foot.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'ftPlay') tbPlay(!AHM.state.get('time').playing);
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
