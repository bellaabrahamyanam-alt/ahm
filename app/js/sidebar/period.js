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

// ---- the footer: the same filter as a two-handle slider (years; BCE is negative), plus its label and reset ----
const PF_MIN = -1200,
  PF_MAX = 1500;
const pfTs = (v) => dateToTs('y', { era: v < 0 ? 'BCE' : 'CE', y: String(Math.abs(v) || 1) });
const pfYear = (d) => {
  const y = parseInt(d.ts, 10); // astronomical year: 0 is 1 BCE
  return y <= 0 ? y - 1 : y;
};
function periodLabel() {
  const a = dfSafe($('#fFrom .df')),
    b = dfSafe($('#fTo .df'));
  if (a && b) return dateText(a) + ' \u2013 ' + dateText(b);
  return a ? 'from ' + dateText(a) : b ? 'to ' + dateText(b) : 'Any';
}
/** Redraws label, reset button and slider handles from the two date fields. */
function periodSync() {
  const a = dfSafe($('#fFrom .df')),
    b = dfSafe($('#fTo .df')),
    lo = a ? Math.max(PF_MIN, Math.min(PF_MAX, pfYear(a))) : PF_MIN,
    hi = b ? Math.max(PF_MIN, Math.min(PF_MAX, pfYear(b))) : PF_MAX,
    pct = (v) => ((v - PF_MIN) / (PF_MAX - PF_MIN)) * 100 + '%';
  $('#pfLabel').textContent = periodLabel();
  $('#pfReset').disabled = !periodActive();
  if (document.activeElement !== $('#pfFrom')) $('#pfFrom').value = String(lo);
  if (document.activeElement !== $('#pfTo')) $('#pfTo').value = String(hi);
  $('#pfFrom').parentElement.style.cssText = `--lo:${pct(lo)};--hi:${pct(hi)}`;
}
function pfSlide(which) {
  let lo = Number($('#pfFrom').value),
    hi = Number($('#pfTo').value);
  if (which === 'from' && lo > hi) $('#pfFrom').value = String((lo = hi));
  if (which === 'to' && hi < lo) $('#pfTo').value = String((hi = lo));
  const [sel, cls, v, edge] = which === 'from' ? ['#fFrom', 'fl-from', lo, PF_MIN] : ['#fTo', 'fl-to', hi, PF_MAX];
  $(sel).innerHTML = dfHTML(cls, v === edge ? null : { fmt: 'y', mode: 'exact', ts: pfTs(v), ts_to: null }, PERIOD_OPTS);
  $(sel).dispatchEvent(new Event('change', { bubbles: true })); // the list and the map follow, like a typed date
}
$('#pfFrom').addEventListener('input', () => pfSlide('from'));
$('#pfTo').addEventListener('input', () => pfSlide('to'));
$('#pfReset').onclick = () => {
  initPeriod();
  update();
  periodSync();
};
['#fFrom', '#fTo'].forEach((s) => ['input', 'change'].forEach((ev) => $(s).addEventListener(ev, periodSync)));

/** The bars behind the slider: how many dated places existed in each of 15 stretches of the scale. Redrawn only when the data changes. */
function pfHist() {
  if (pfHist.src === places) return;
  pfHist.src = places;
  const n = 15,
    step = (PF_MAX - PF_MIN) / n,
    edge = Array.from({ length: n + 1 }, (_, i) => isoToSec(pfTs(PF_MIN + Math.round(i * step)))),
    c = new Array(n).fill(0);
  places.forEach((p) => {
    if (!p.date_from && !p.date_to) return; // undated places (and mountains) are not on the scale
    const s = p.date_from ? dateBounds(p.date_from)[0] : -Infinity,
      e = p.date_to ? dateBounds(p.date_to)[1] : Infinity;
    for (let i = 0; i < n; i++) if (s < edge[i + 1] && e > edge[i]) c[i]++;
  });
  const m = Math.max(1, ...c);
  $('#pfHist').innerHTML = c.map((v) => `<i style="height:${v ? 12 + Math.round((48 * v) / m) : 5}%"></i>`).join('');
}
