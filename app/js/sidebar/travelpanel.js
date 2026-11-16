// Travel time from the terrain (T-045): the button "Travel time" in the card of a place, a route, a river or a border opens a small
// panel. From a place or a shape (all its cells are the start): the area reached in 1, 2, 3 ... days and the places inside it; the
// least-cost path to a place or a point you click; the walking time along the shape's own line. All of it is an ESTIMATE on the
// modern relief (AHM.map.travel does the work, see map/travel.js). Needs places and label (core), AHM.map, AHM_CONFIG.travel.
const tv = { mode: null, days: 3, from: null, pick: false, host: null }; // host: the card element whose panel shows the answers
const tvCfg = () => AHM_CONFIG.travel || { hoursPerDay: 8, modes: { foot: { label: 'On foot', mult: 1 } } };
/** The button (a host) that a card puts where the panel goes. kind: 'place' | 'shape'. */
const tvHostHTML = (kind, id) => `<div class="tv-host" data-kind="${kind}" data-id="${esc(id)}"><button type="button" data-tvact="open">Travel time…</button></div>`;
const tvH = (h) => (h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h.toFixed(1) + ' h');
const tvDays = (h, perDay) => (h / perDay).toFixed(1) + ' days of ' + perDay + ' h';
const tvFromOf = (host) => (host.dataset.kind === 'shape' ? { shape: host.dataset.id } : (({ lon, lat }) => [lon, lat])(places.find((p) => p.id === host.dataset.id) || { lon: 0, lat: 0 }));
function tvPanel(host) {
  const c = tvCfg(),
    shape = host.dataset.kind === 'shape';
  if (!tv.mode || !c.modes[tv.mode]) tv.mode = Object.keys(c.modes)[0];
  host.innerHTML =
    `<div class="tv-box"><div class="label">Travel time</div>` +
    `<div class="row"><select class="tv-mode" aria-label="How they travel">${Object.entries(c.modes).map(([k, m]) => `<option value="${esc(k)}"${k === tv.mode ? ' selected' : ''}>${esc(m.label)}</option>`).join('')}</select>` +
    `<label>Days <input type="number" class="tv-days" min="1" max="5" value="${tv.days}"></label></div>` +
    `<div class="row"><button type="button" data-tvact="area">Area reached in days</button><button type="button" data-tvact="to">Path to…</button>${shape ? '<button type="button" data-tvact="along">Time along it</button>' : ''}<button type="button" data-tvact="clear">Clear</button></div>` +
    `<div class="sn tv-info"></div><div class="chips tv-list"></div>` +
    `<div class="sn">An estimate on today's terrain with ${c.hoursPerDay} h of walking a day (Tobler's hiking speed): no rivers, lakes, snow, seasons, roads or borders are taken into account.</div></div>`;
}
const tvInfo = (html) => (tv.host && tv.host.querySelector('.tv-info') ? (tv.host.querySelector('.tv-info').innerHTML = html) : 0);
const tvOpts = (extra) => ({ mode: tv.mode, days: tv.days, ...extra });
async function tvArea(host) {
  tvInfo('Working…');
  tv.host.querySelector('.tv-list').innerHTML = '';
  const from = tvFromOf(host),
    r = await AHM.map.travel(tvOpts({ from, places: places.filter((p) => p.id !== host.dataset.id).map((p) => ({ id: p.id, lon: p.lon, lat: p.lat })) }));
  if (r.error) return tvInfo(esc(r.error));
  const per = r.hoursPerDay,
    counts = r.bands.map((b) => `${b.day} day${b.day > 1 ? 's' : ''}: ${r.reach.filter((x) => x.hours <= b.hours).length} places`);
  tvInfo(`Reached in ${counts.join(' · ')}.${r.clipped ? ' The area is cut at 105 km from the start.' : ''}`);
  const inside = r.reach.filter((x) => x.hours <= per).slice(0, 40),
    l = $('#lang').value;
  tv.host.querySelector('.tv-list').innerHTML = inside.length
    ? `<div class="label">Within one day (${per} h)</div>` + inside.map((x) => `<button type="button" class="chip" data-tvact="place" data-pid="${esc(x.id)}">${esc(label(places.find((p) => p.id === x.id), l))} · ${tvH(x.hours)}</button>`).join('')
    : '<div class="sn">No place within one day.</div>';
}
async function tvPath(to) {
  tvInfo('Working…');
  const r = await AHM.map.travel(tvOpts({ from: tv.from, to }));
  if (r.error) return tvInfo(esc(r.error));
  tvInfo(`Least-cost path: ${r.path.km.toFixed(1)} km, ${tvH(r.path.hours)} (${tvDays(r.path.hours, r.hoursPerDay)}).`);
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest && e.target.closest('[data-tvact]'),
    host = b && b.closest('.tv-host');
  if (!b) return;
  const a = b.dataset.tvact;
  if (a === 'place') return AHM.map.focusPlace && AHM.state.set && AHM.state.set('selected', b.dataset.pid);
  if (!host) return;
  tv.host = host;
  if (a === 'open') return document.querySelectorAll('.tv-host').forEach((h) => h !== host && h.querySelector('.tv-box') && ((h.innerHTML = ''), h.insertAdjacentHTML('beforeend', `<button type="button" data-tvact="open">Travel time…</button>`))), tvPanel(host);
  if (a === 'clear') return AHM.map.travelClear(), (tv.pick = false), tvInfo(''), (host.querySelector('.tv-list').innerHTML = '');
  if (a === 'area') return tvArea(host);
  if (a === 'along') {
    tvInfo('Working…');
    const r = await AHM.map.travel(tvOpts({ along: host.dataset.id }));
    return tvInfo(r.error ? esc(r.error) : `Along the line (${r.along.km.toFixed(1)} km): ${tvH(r.along.hours)} one way (${tvDays(r.along.hours, r.hoursPerDay)}), ${tvH(r.along.backHours)} the other way.`);
  }
  if (a === 'to') {
    tv.from = tvFromOf(host);
    tv.pick = true;
    tvInfo('Click the destination on the map (a place or any point).');
  }
});
document.addEventListener('change', (e) => {
  if (e.target.classList && e.target.classList.contains('tv-mode')) tv.mode = e.target.value;
  if (e.target.classList && e.target.classList.contains('tv-days')) tv.days = Math.max(1, Math.min(5, Math.round(+e.target.value) || 3));
});
AHM.on('map:click', (c) => {
  if (!tv.pick) return;
  tv.pick = false;
  tvPath([c.lon, c.lat]);
});
AHM.on('place:click', ({ id }) => {
  const p = tv.pick && places.find((x) => x.id === id);
  if (!p) return;
  tv.pick = false;
  tvPath([p.lon, p.lat]);
});
