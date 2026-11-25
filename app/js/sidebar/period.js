// The period filter fields of the Explore filters (sidebar domain): two date fields, "from" and "to". The footer that reads and writes them is footer.js.
const PERIOD_OPTS = { modes: ['none', 'exact'], names: { none: 'Any' } }; // the period filter takes unknown ("any") or exact
/** Puts a date (or null = Any) into one of the two fields. which = 'from' | 'to'. */
function periodSetField(which, date) {
  $(which === 'from' ? '#fFrom' : '#fTo').innerHTML = dfHTML(which === 'from' ? 'fl-from' : 'fl-to', date, PERIOD_OPTS);
}
function initPeriod() {
  periodSetField('from', null);
  periodSetField('to', null);
}
/** [start, end) of the chosen period, each null when not set. "to 5th century" covers the whole 5th century. */
function periodBounds() {
  const a = dfSafe($('#fFrom .df')),
    b = dfSafe($('#fTo .df'));
  return [a ? dateBounds(a)[0] : null, b ? dateBounds(b)[1] : null];
}
const periodActive = () => periodBounds().some((v) => v !== null);
