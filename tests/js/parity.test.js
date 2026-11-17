const { test, ok, eq } = require('./lib/harness');
const { start } = require('./lib/devserver');
const path = require('path');
const fs = require('fs');
const table = require('../fixtures/rules.json').cases;
const URLS = { save: '/api/save', layer: '/api/layer/save', category: '/api/category/save', language: '/api/language/save', type: '/api/type/save', shape: '/api/shape/save', source: '/api/source/save' };

test('parity table: the Node dev server gives the verdict the table says (PHP is checked against the same table)', async () => {
  const s = await start();
  try {
    // the dev server converts old data when it starts; wait for the first request to be served
    await fetch(s.base + '/data/places.geojson');
    const P = s.data('places.geojson').features.map((f) => f.properties.id);
    const L0 = s.data('layers.json').layers[0].id;
    const C0 = s.data('categories.json').categories[0].id;
    const S = s.data('sources.json').sources.map((x) => x.id);
    const expand = (b) =>
      JSON.parse(JSON.stringify(b).replace(/@P(\d+)/g, (_, n) => P[+n]).replace(/@S(\d+)/g, (_, n) => S[+n]).replace(/@L0/g, L0).replace(/@C0/g, C0));
    ok(table.length >= 50);
    for (const c of table) {
      const r = await s.post(URLS[c.via], expand(c.body));
      if (c.expect === 'ok') eq(200, r.status, `${c.name}: ${JSON.stringify(r.json)}`);
      else ok(r.status === 400 && new RegExp(c.expect, 'i').test(r.json.error || ''), `${c.name}: wanted 400 /${c.expect}/, got ${r.status} ${JSON.stringify(r.json)}`);
    }
  } finally {
    await s.stop();
  }
});

test('dev server: deleting a border archives its notes, removes them from the index and leaves other notes', async () => {
  const s = await start();
  try {
    await fetch(s.base + '/data/places.geojson');
    const sid = s.data('shapes.geojson').features[0].properties.id,
      L0 = s.data('layers.json').layers[0].id,
      note = (id) => ({ layer_note: { layer_id: id, note: { lang: 'en', title: 't', text: 'x' } } });
    const a = await s.post('/api/layer/save', note(sid)),
      b = await s.post('/api/layer/save', note(L0));
    eq(200, a.status, JSON.stringify(a.json));
    eq(200, b.status, JSON.stringify(b.json));
    const dir = path.join(s.root, 'data', 'layer-notes', sid),
      arch = path.join(s.root, 'dev', 'archive'),
      archived = () => (fs.existsSync(arch) ? fs.readdirSync(arch).filter((f) => f.startsWith('layer-note-' + sid + '-')) : []);
    ok(fs.existsSync(dir) && fs.readdirSync(dir).length === 1, 'note stored under the shape id');
    eq(200, (await s.post('/api/shape/delete', { id: sid })).status);
    ok(!fs.existsSync(dir), 'note folder of the shape removed');
    eq(1, archived().length, 'the note is in the archive');
    const idx = s.data('layer-notes/index.json').notes;
    ok(!idx.some((n) => n.layer === sid), 'not in the index');
    ok(idx.some((n) => n.layer === L0), 'the note of the layer stays');
  } finally {
    await s.stop();
  }
});

test('dev server: a line or area type that shapes use cannot be deleted; an unused built-in one can; the 12 built-in types are written with the first new type', async () => {
  const s = await start();
  try {
    await fetch(s.base + '/data/places.geojson');
    const types = () => s.data('types.json').types;
    ok(types().some((t) => t.code === 'kingdom' && t.geometry === 'area'), 'the area type kingdom is in the dictionary');
    ok(types().some((t) => t.code === 'trade' && t.geometry === 'line'), 'the line type trade is in the dictionary');
    const used = s.data('shapes.geojson').features[0].properties.type;
    const r = await s.post('/api/type/delete', { code: used });
    ok(r.status === 400 && /shapes? use the type/.test(r.json.error), JSON.stringify(r.json));
    eq(200, (await s.post('/api/type/delete', { code: 'road' })).status);
    ok(!types().some((t) => t.code === 'road'));
  } finally {
    await s.stop();
  }
});

test('dev server: a border of the old type "region" becomes "province" when the data is brought up to date', async () => {
  const s = await start((root) => {
    const f = path.join(root, 'data', 'shapes.geojson'),
      d = JSON.parse(fs.readFileSync(f, 'utf8'));
    d.features[0].properties.type = 'region';
    fs.writeFileSync(f, JSON.stringify(d));
  });
  try {
    await fetch(s.base + '/data/places.geojson');
    const types = s.data('shapes.geojson').features.map((x) => x.properties.type);
    ok(types.includes('province') && !types.includes('region'), types.join(','));
  } finally {
    await s.stop();
  }
});

test('dev server: a write answers 400 for broken JSON and 405 or 400 for a GET, never crashes', async () => {
  const s = await start();
  try {
    const bad = await fetch(s.base + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'garbage' });
    eq(400, bad.status);
    for (const body of ['null', '"text"', '[1,2]', '42']) {
      const r = await fetch(s.base + '/api/layer/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      eq(400, r.status, 'body ' + body);
    }
    const get = await fetch(s.base + '/api/save');
    ok([400, 404, 405].includes(get.status), 'GET answered ' + get.status);
    const again = await fetch(s.base + '/data/places.geojson');
    eq(200, again.status, 'still alive');
  } finally {
    await s.stop();
  }
});

test('dev server: two saves in the same second keep both archive copies', async () => {
  const s = await start();
  try {
    await fetch(s.base + '/data/places.geojson');
    const body = { place: { lat: 40, lon: 44, type: 'village', names: [{ lang: 'en', name: 'A' }] } };
    for (let i = 0; i < 3; i++) eq(200, (await s.post('/api/save', body)).status);
    const fs = require('fs');
    const arch = path.join(s.root, 'dev', 'archive');
    const copies = fs.readdirSync(arch).filter((f) => /^places-\d{14}(-\d+)?\.geojson$/.test(f) && !f.includes('before-dates'));
    ok(copies.length >= 3, 'three saves, three copies: ' + copies.length);
  } finally {
    await s.stop();
  }
});

test('dev server: versions of one series (T-041): an update that overlaps another version is refused, an update without series keeps it', async () => {
  const s = await start();
  try {
    await fetch(s.base + '/data/places.geojson');
    const sid = '5e1f0000-0000-4000-8000-000000000041';
    const y = (n) => ({ fmt: 'y', ts: String(n).padStart(4, '0') + '-01-01T00:00:00Z', mode: 'exact', ts_to: null });
    const body = (a, b, extra = {}) => ({
      names: [{ lang: 'en', name: 'V' }], type: 'kingdom', color: '#336699', opacity: 0.5, label: false, source: '', date_from: y(a), date_to: y(b), series: sid,
      geometry: { type: 'Polygon', coordinates: [[[44, 40], [44.5, 40], [44.5, 40.5], [44, 40]]] }, ...extra,
    });
    const a = (await s.post('/api/shape/save', body(100, 199))).json.id;
    const b = (await s.post('/api/shape/save', body(200, 299))).json.id;
    eq(200, (await s.post('/api/shape/save', body(100, 199, { id: a }))).status, 'unchanged');
    const r = await s.post('/api/shape/save', body(100, 250, { id: a }));
    ok(r.status === 400 && /versions of one series overlap/.test(r.json.error), 'overlap refused: ' + JSON.stringify(r.json));
    const nos = body(200, 299, { id: b });
    delete nos.series;
    eq(200, (await s.post('/api/shape/save', nos)).status);
    eq(2, s.data('shapes.geojson').features.filter((f) => f.properties.series === sid).length, 'the series is kept');
  } finally {
    await s.stop();
  }
});

test('dev server: sources (T-046): add and change a source; certainty, radius and sources are kept when an update sends nothing, and cleared by null / []', async () => {
  const s = await start();
  try {
    await fetch(s.base + '/data/places.geojson');
    const S = s.data('sources.json').sources.map((x) => x.id);
    const sid = (await s.post('/api/source/save', { title: 'Pliny, Natural History', citation: 'NH 6', url: 'https://example.org/p' })).json.id;
    eq(S.length + 1, s.data('sources.json').sources.length);
    await s.post('/api/source/save', { id: sid, title: 'Pliny the Elder', citation: 'NH 6' });
    const now = s.data('sources.json').sources.find((x) => x.id === sid);
    ok(now.title === 'Pliny the Elder' && now.url === undefined, 'renamed, and the link is gone when not sent');
    const base = { lat: 40.1, lon: 44.5, type: 'village', names: [{ lang: 'en', name: 'Certain' }] };
    const id = (await s.post('/api/save', { place: { ...base, certainty: 'disputed', radius_m: 8000, sources: [S[0], S[0], S[1]] } })).json.id;
    const prop = () => s.data('places.geojson').features.find((f) => f.properties.id === id).properties;
    eq([S[0], S[1]], prop().sources, 'a source is listed once');
    await s.post('/api/save', { place_update: { ...base, id, names: [{ lang: 'en', name: 'Renamed' }] } });
    ok(prop().label === 'Renamed' && prop().certainty === 'disputed' && prop().radius_m === 8000, 'kept when not sent');
    await s.post('/api/save', { place_update: { ...base, id, certainty: null, radius_m: '', sources: [] } });
    ok(!('certainty' in prop()) && !('radius_m' in prop()) && !('sources' in prop()), 'cleared');
    const shape = { names: [{ lang: 'en', name: 'B' }], type: 'kingdom', color: '#336699', opacity: 0.5, label: false, source: '', date_from: null, date_to: null, geometry: { type: 'Polygon', coordinates: [[[44, 40], [44.5, 40], [44.5, 40.5], [44, 40]]] } };
    const bid = (await s.post('/api/shape/save', { ...shape, certainty: 'approximate', sources: [S[1]] })).json.id;
    await s.post('/api/shape/save', { ...shape, id: bid });
    const bp = () => s.data('shapes.geojson').features.find((f) => f.properties.id === bid).properties;
    ok(bp().certainty === 'approximate' && bp().sources[0] === S[1], 'kept');
    await s.post('/api/shape/save', { ...shape, id: bid, certainty: null, sources: [] });
    ok(!('certainty' in bp()) && !('sources' in bp()), 'cleared');
  } finally {
    await s.stop();
  }
});
