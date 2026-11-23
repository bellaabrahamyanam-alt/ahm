// The Moment logic (sidebar domain, T-040, F5): the map at one moment ("year X"), with play. The controls are the Moment footer (period.js, frame s22).
// The moment lives in AHM.state 'time' (I-6); what is shown at that moment is a core rule (visibleAt, timeLook). This file is only the logic.
const TB_SPEEDS = [1, 10, 50, 100, 500]; // years per second
const TB_TICK = 200; // ms between two steps of play
let tbTimer = null;
const tbPatch = (p) => AHM.state.patch('time', p);
const tbSpan = () => timeSpan([...places, ...shapes]);
/** The time-travel button of the Period footer: switch the bar on at the earliest date of the data (nothing happens while no object has a date). */
function tbOpen() {
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

/** The footer draws itself from the state (period.js, ftRender). */
const tbRender = () => typeof ftRender === 'function' && ftRender();

// the lists and the map follow the moment (places.js update); the bar redraws itself
AHM.on('state:time', () => {
  tbRender();
  update();
});
