// The time bar (sidebar domain, T-040): a bar over the map that shows the map at one moment ("year X"), with play.
// The moment lives in AHM.state 'time' (I-6); what is shown at that moment is a core rule (visibleAt, timeLook). This file is only the controls.
const TB_SPEEDS = [1, 10, 50, 100, 500]; // years per second
const TB_TICK = 200; // ms between two steps of play
const TB_AT = { modes: ['none', 'exact'], names: { none: 'Any' } };
let tbTimer = null;
const tbPatch = (p) => AHM.state.patch('time', p);
const tbSpan = () => timeSpan([...places, ...shapes]);
/** The "Time" button: switch the bar on at the earliest date of the data (nothing happens while no object has a date). */
function tbOpen() {
  if (AHM.state.get('time').at !== null) return; // already on: the segment button does nothing
  const span = tbSpan();
  if (span) tbPatch({ at: secToIso(span[0]) });
}
function tbStop() {
  clearTimeout(tbTimer);
  tbTimer = null;
}
function tbLoop() {
  tbTick(TB_TICK);
  if (AHM.state.get('time').playing) tbTimer = setTimeout(tbLoop, TB_TICK);
}
function tbPlay(on) {
  tbStop();
  tbPatch({ playing: on });
  if (on) tbTimer = setTimeout(tbLoop, TB_TICK);
}
/** "Off": today's behaviour, every object is shown again. */
function tbOff() {
  tbStop();
  tbPatch({ at: null, playing: false });
}
/** One step of play: `dtMs` of speed years per second; stops at the latest date of the data. */
function tbTick(dtMs) {
  const t = AHM.state.get('time'),
    span = tbSpan();
  if (!span || t.at === null) return tbPlay(false);
  const r = timeAdvance(isoToSec(t.at), t.speed, dtMs, span[1] - 1);
  tbPatch({ at: secToIso(Math.round(r.at)) });
  if (r.done) tbPlay(false);
}

function tbRender() {
  const t = AHM.state.get('time'),
    span = tbSpan();
  const on = t.at !== null;
  $('#timebar').hidden = !on;
  $('#tbOpen').classList.toggle('on', on); // Period | Moment switch of the footer
  $('#pfPeriod').classList.toggle('on', !on);
  $('#pfPeriodBox').hidden = on;
  $('#pfLabel').hidden = on;
  if (!on) return;
  const d = { fmt: 'y', ts: t.at, mode: 'exact', ts_to: null };
  $('#tbPlay').textContent = t.playing ? '⏸' : '▶';
  $('#tbPlay').setAttribute('aria-label', t.playing ? 'Pause' : 'Play');
  $('#tbSpeed').value = String(t.speed);
  $('#tbUndated').checked = t.undated;
  $('#tbLabel').textContent = dateText(d);
  if (span && span[1] > span[0]) $('#tbSlider').value = String(Math.round((1000 * (isoToSec(t.at) - span[0])) / (span[1] - span[0])));
  const f = $('#tbAt'); // the date field is redrawn unless the person is typing in it
  if (!(document.activeElement && f.contains(document.activeElement))) f.innerHTML = dfHTML('tb-at', d, TB_AT);
}

$('#tbSpeed').innerHTML = TB_SPEEDS.map((v) => `<option value="${v}">${v} y/s</option>`).join('');
$('#tbOpen').onclick = tbOpen;
$('#tbOff').onclick = tbOff;
$('#pfPeriod').onclick = tbOff;
$('#tbPlay').onclick = () => tbPlay(!AHM.state.get('time').playing);
$('#tbSpeed').addEventListener('change', () => tbPatch({ speed: Number($('#tbSpeed').value) }));
$('#tbUndated').addEventListener('change', () => tbPatch({ undated: $('#tbUndated').checked }));
$('#tbSlider').addEventListener('input', () => {
  const span = tbSpan();
  if (!span) return;
  tbStop();
  tbPatch({ at: secToIso(Math.round(span[0] + ((span[1] - 1 - span[0]) * Number($('#tbSlider').value)) / 1000)), playing: false });
});
dfWire($('#tbAt'));
$('#tbAt').addEventListener('change', () => {
  const d = dfSafe($('#tbAt .df')); // null while the field is empty or not valid
  if (d) tbPatch({ at: secToIso(dateBounds(d)[0]) });
});
// the lists and the map follow the moment (places.js update); the bar redraws itself
AHM.on('state:time', () => {
  tbRender();
  update();
});
