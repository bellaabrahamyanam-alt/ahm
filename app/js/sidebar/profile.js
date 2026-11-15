// The height profile of a route, a river or a border (T-044): the button "Height profile" in the sheet of the shape. The heights come
// from AHM.map.profile (the shape's own line, or the part of it between two clicks); this file draws the chart and the numbers.
// A route marks its stops on the chart; a river shows its start, end, fall and mean slope; moving over the chart shows the distance and
// height and moves a point on the map (AHM.map.profileMark). Needs shapeById (core), placeById (routes.js), AHM.map.
const pr = { id: null, data: null, at: -1, pick: null, stops: [] }; // the shape shown, its profile, the sample under the cursor, the clicks of a section, the stop marks
const prFmt = (m) => Math.round(m).toLocaleString('en');
const prHTML = () =>
  `<div class="pr-box"><div class="sn" id="prInfo">Reading the heights…</div><canvas id="prChart" width="420" height="140" hidden></canvas>` +
  `<div class="sn" id="prHover"></div><div class="sn" id="prStops"></div></div>`;
/** Numbers under the chart: a route says ascent and descent, a river or a border its fall and mean slope too. */
function prSummary(s, d) {
  const a = `${d.length.toFixed(1)} km · min ${prFmt(d.min)} m · max ${prFmt(d.max)} m · +${prFmt(d.up)} m / −${prFmt(d.down)} m`;
  if (isRoute(s)) return a;
  const first = d.h.find((x) => !Number.isNaN(x)),
    last = [...d.h].reverse().find((x) => !Number.isNaN(x));
  return `${a}<br>Start ${prFmt(first)} m, end ${prFmt(last)} m: ${d.fall >= 0 ? 'fall' : 'rise'} ${prFmt(Math.abs(d.fall))} m, mean slope ${Math.abs(d.slope).toFixed(2)} %`;
}
/** Draws the chart; `at` is the sample under the cursor (a vertical line), the stops are dots with their order number. */
function prDraw() {
  const cv = $('#prChart'),
    d = pr.data;
  const cx = cv && typeof cv.getContext === 'function' ? cv.getContext('2d') : null;
  if (!cx || !d) return;
  const [W, H] = [cv.width, cv.height],
    v = d.h.map((x) => (Number.isNaN(x) ? null : x)),
    lo = Math.min(d.min, ...[]),
    hi = Math.max(d.max, lo + 1),
    X = (i) => (i / (v.length - 1)) * W,
    Y = (x) => H - 6 - ((x - lo) / (hi - lo)) * (H - 16);
  cx.clearRect(0, 0, W, H);
  cx.beginPath();
  cx.moveTo(0, H);
  v.forEach((x, i) => x != null && cx.lineTo(X(i), Y(x)));
  cx.lineTo(W, H);
  cx.closePath();
  cx.fillStyle = 'rgba(215,25,28,0.25)';
  cx.fill();
  cx.beginPath();
  let pen = false;
  v.forEach((x, i) => (x == null ? (pen = false) : (pen ? cx.lineTo(X(i), Y(x)) : cx.moveTo(X(i), Y(x)), (pen = true))));
  cx.strokeStyle = '#d7191c';
  cx.stroke();
  pr.stops.forEach((st) => {
    if (v[st.i] == null) return;
    cx.beginPath();
    cx.arc(X(st.i), Y(v[st.i]), 4, 0, 6.3);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.stroke();
  });
  if (pr.at >= 0) {
    cx.beginPath();
    cx.moveTo(X(pr.at), 0);
    cx.lineTo(X(pr.at), H);
    cx.strokeStyle = '#555';
    cx.stroke();
  }
}
/** The sample of the profile nearest to a stop (a place of the route): its index and the distance along the line. */
function prStopMarks(s, d) {
  if (!isRoute(s)) return [];
  return rtStops(s).map((id, k) => {
    const p = placeById(id),
      q = [p.lon, p.lat];
    let best = 0,
      bd = Infinity;
    d.pts.forEach((x, i) => {
      const e = (x[0] - q[0]) ** 2 + (x[1] - q[1]) ** 2;
      if (e < bd) (bd = e), (best = i);
    });
    return { i: best, n: k + 1, name: rtName(id) };
  });
}
/** Shows the profile of shape `s` (the whole line, or the part between opts.from and opts.to) in the host under its buttons. */
async function prOpen(s, opts) {
  // the shape card and the route card each have a host; the one on screen gets the box and the other is emptied (the ids inside stay unique)
  const hosts = [...document.querySelectorAll('.pr-host')],
    host = hosts.find((h) => h.offsetParent !== null);
  hosts.forEach((h) => h !== host && (h.innerHTML = ''));
  if (!host) return;
  pr.id = s.id;
  pr.data = null;
  pr.at = -1;
  host.innerHTML =
    prHTML() +
    (isRoute(s) ? '' : `<button type="button" data-pract="section">${opts ? 'Another section' : 'Section between two clicks'}</button>` + (opts ? ' <button type="button" data-pract="whole">Whole line</button>' : ''));
  const d = await AHM.map.profile(s.id, opts || {}).catch(() => null);
  if (pr.id !== s.id || !$('#prInfo')) return; // another shape was opened meanwhile
  if (!d) return void ($('#prInfo').textContent = 'No heights for this line (the relief tiles are not available).');
  pr.data = d;
  pr.stops = prStopMarks(s, d);
  $('#prInfo').innerHTML = prSummary(s, d);
  $('#prChart').hidden = false;
  $('#prStops').innerHTML = pr.stops.length ? 'Stops: ' + pr.stops.map((st) => `${st.n}. ${esc(st.name)} ${d.dist[st.i].toFixed(1)} km, ${Number.isNaN(d.h[st.i]) ? '?' : prFmt(d.h[st.i]) + ' m'}`).join(' · ') : '';
  prDraw();
}
function prClear() {
  pr.id = pr.data = pr.pick = null;
  pr.at = -1;
  pr.stops = [];
  if (window.AHM && AHM.map && AHM.map.profileMark) AHM.map.profileMark(null);
}
document.addEventListener('mousemove', (e) => {
  if (!e.target || e.target.id !== 'prChart' || !pr.data) return;
  const r = e.target.getBoundingClientRect(),
    n = pr.data.h.length,
    i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / (r.width || 1)) * (n - 1))));
  if (i === pr.at) return;
  pr.at = i;
  const h = pr.data.h[i];
  $('#prHover').textContent = `${pr.data.dist[i].toFixed(1)} km · ${Number.isNaN(h) ? 'no height' : prFmt(h) + ' m'}`;
  AHM.map.profileMark(pr.data.pts[i]);
  prDraw();
});
document.addEventListener('mouseout', (e) => {
  if (!e.target || e.target.id !== 'prChart') return;
  pr.at = -1;
  if ($('#prHover')) $('#prHover').textContent = '';
  AHM.map.profileMark(null);
  prDraw();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-pract]');
  if (!b || !pr.id) return;
  const s = shapeById(pr.id);
  if (!s) return;
  if (b.dataset.pract === 'whole') return prOpen(s);
  pr.pick = []; // the next two clicks on the map are the start and the end of the section
  $('#prInfo').textContent = 'Click the start of the section on the line, then its end.';
});
AHM.on('map:click', (c) => {
  if (!pr.pick || !pr.id) return;
  pr.pick.push([c.lon, c.lat]);
  if (pr.pick.length < 2) return void ($('#prInfo').textContent = 'Now click the end of the section.');
  const [from, to] = pr.pick,
    s = shapeById(pr.id);
  pr.pick = null;
  if (s) prOpen(s, { from, to });
});
