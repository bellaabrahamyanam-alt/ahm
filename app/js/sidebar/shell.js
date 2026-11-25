// App shell behaviour (foundation v2, frames s050-s052, s099, s100): the rail, the logo tile toggle, the Period dot, the phone Time button.
// Markup is static in the shell and footer regions of index.html. Open/close, tabs and resizing stay in layout.js (tab, toggleSide, setSize).
const shellClosed = () => document.body.classList.contains('collapsed');
/** Redraws what depends on state: the dot on the rail clock (a Period filter is on), the active rail button, the Time button. */
function shellSync() {
  const dot = $('#railDot');
  if (!dot) return;
  kit.show(dot, typeof periodActive === 'function' && periodActive());
  document.querySelectorAll('[data-rail]').forEach((b) => b.classList.toggle('ahm-rail-on', b.dataset.rail === curTab));
  const t = $('#ahmTime');
  t.disabled = !(typeof ftSpan === 'function' && ftSpan());
}
// the logo tile is the one toggle (s050): closed -> opens the panel, open -> closes it
$('#ahmLogo').addEventListener('click', () => toggleSide(!shellClosed()));
// a rail icon opens the panel on that tab; the clock opens it at the footer
kit.on($('#rail'), 'click', '[data-rail]', (e, b) => {
  if (b.dataset.rail !== 'clock') tab(b.dataset.rail);
  toggleSide(false);
});
// phone, panel hidden (s100): the handle tab (#expand) and the Time button open the sheet
$('#expand').addEventListener('click', () => toggleSide(false));
$('#ahmTime').addEventListener('click', () => {
  toggleSide(false);
  if (AHM.state.get('time').at === null) tbOpen();
});
shellSync();
