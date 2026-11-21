// The period footer (sidebar domain, design v3.1, T-078): "Period | Moment", the chosen period, a histogram of the dated places and a
// slider with two handles. The handles set the same two date fields of the Filters block (#fFrom, #fTo) and so the same period filter; "Moment" switches
// the one-moment time bar (T-040) on and "Period" off. Nothing new is stored: the filter fields stay the source.
const PF_N = 28; // bars of the histogram
const pfSpan = () => timeSpan([...places, ...shapes]);
const pfYear = (sec) => Math.round(sec / 31556952 + 1970);
const pfDate = (sec) => ({ mode: 'exact', fmt: 'y', ts: secToIso(sec), ts_to: null });
const pfText = (sec) => dateText(pfDate(sec));

/** The footer shows the filter state: handles, label, clear button and the bars in the chosen range. */
function pfSync() {
  const span = pfSpan();
  $('#pfoot').classList.toggle('empty', !span);
  if (!span) return;
  const [s0, s1] = span,
    [a, b] = periodBounds(),
    w = s1 - s0 || 1,
    lo = a === null ? 0 : Math.max(0, Math.min(1000, Math.round(((a - s0) / w) * 1000))),
    hi = b === null ? 1000 : Math.max(0, Math.min(1000, Math.round(((b - s0) / w) * 1000)));
  $('#pfLo').value = lo;
  $('#pfHi').value = hi;
  $('#pfLabel').textContent = periodActive() ? (a === null ? '…' : pfText(a)) + ' – ' + (b === null ? '…' : pfText(b - 1)) : 'Any';
  $('#pfClear').hidden = !periodActive();
  $('#pfA').textContent = pfText(s0);
  $('#pfB').textContent = pfText(s1 - 1);
  $('#pfM').textContent = s0 < 0 && s1 > 0 ? '0' : '';
  // histogram: how many dated places exist in each slice of the span (an open end lasts to the end of the span)
  const n = new Array(PF_N).fill(0);
  for (const p of places) {
    if (!p.date_from && !p.date_to) continue;
    const x = p.date_from ? dateBounds(p.date_from)[0] : s0,
      y = p.date_to ? dateBounds(p.date_to)[1] : s1;
    for (let i = 0; i < PF_N; i++) if (x < s0 + (w * (i + 1)) / PF_N && y > s0 + (w * i) / PF_N) n[i]++;
  }
  const mx = Math.max(1, ...n);
  $('#pfHist').innerHTML = n
    .map((c, i) => `<i${i / PF_N * 1000 >= lo - 1000 / PF_N && (i / PF_N) * 1000 < hi ? ' class="in"' : ''} style="height:${Math.max(4, Math.round((c / mx) * 100))}%"></i>`)
    .join('');
}

/** Set the two period fields from the handles (nothing is set while a handle is at the end of the span). */
function pfApply() {
  const span = pfSpan();
  if (!span) return;
  const [s0, s1] = span,
    w = s1 - s0,
    lo = +$('#pfLo').value,
    hi = +$('#pfHi').value;
  $('#fFrom').innerHTML = dfHTML('fl-from', lo > 0 ? pfDate(s0 + (w * lo) / 1000) : null, PERIOD_OPTS);
  $('#fTo').innerHTML = dfHTML('fl-to', hi < 1000 ? pfDate(s0 + (w * hi) / 1000) : null, PERIOD_OPTS);
  update();
}
function pfClear() {
  $('#fFrom').innerHTML = dfHTML('fl-from', null, PERIOD_OPTS);
  $('#fTo').innerHTML = dfHTML('fl-to', null, PERIOD_OPTS);
  update();
}
['#pfLo', '#pfHi'].forEach((id) => {
  $(id).addEventListener('input', () => {
    if (+$('#pfLo').value > +$('#pfHi').value) $(id === '#pfLo' ? '#pfHi' : '#pfLo').value = $(id).value; // the handles never cross
    $('#pfLabel').textContent = '…';
  });
  $(id).addEventListener('change', pfApply);
});
$('#pfClear').onclick = pfClear;
$('#pfPeriod').onclick = () => tbOff();
$('#pfMoment').onclick = () => tbOpen();
// Moment on = the time bar shows; the segmented control follows it
AHM.on('state:time', () => {
  const on = AHM.state.get('time').at !== null;
  $('#pfPeriod').classList.toggle('on', !on);
  $('#pfMoment').classList.toggle('on', on);
  $('#pfPeriod').setAttribute('aria-pressed', String(!on));
  $('#pfMoment').setAttribute('aria-pressed', String(on));
});
// the footer belongs to the lists of places, borders and routes
const pfShow = () => ($('#pfoot').hidden = !['explore', 'shapes', 'routes'].includes(document.querySelector('.tabs .on')?.dataset.tab));
document.querySelector('.tabs').addEventListener('click', () => setTimeout(pfShow));
pfShow();
pfSync();
