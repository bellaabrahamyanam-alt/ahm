// Tests of the route chains (app/js/core/routes.js): segments between stops, chaining routes that share a place, one-way routes, alternatives.
const test = require('node:test'),
  assert = require('node:assert'),
  fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const ctx = vm.createContext({ console });
['shapes', 'routes'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js/core/' + f + '.js'), 'utf8'), ctx, { filename: f }));
const run = (code) => vm.runInContext(code, ctx);
ctx.place = {
  van: { lon: 43.4, lat: 38.5 },
  ani: { lon: 43.6, lat: 40.5 },
  kars: { lon: 43.1, lat: 40.6 },
  dvin: { lon: 44.6, lat: 40.0 },
};
const placeAt = (id) => ctx.place[id];
const route = (id, ids, twoway, via = {}) => ({
  id,
  type: 'trade',
  twoway,
  stops: ids,
  geometry: { type: 'LineString', coordinates: ids.flatMap((p, i) => [...(via[ids[i - 1]] ? [via[ids[i - 1]]] : []), [ctx.place[p].lon, ctx.place[p].lat]]) },
});
const find = (routes, a, b, max) => ctx.findRoutePaths(routes, placeAt, a, b, max);

test('a route is cut into segments at its stops, and a waypoint between two stops stays in the segment', () => {
  const r = route('r1', ['van', 'ani', 'kars'], true, { van: [43.0, 39.5] });
  const segs = ctx.routeSegments(r, placeAt);
  assert.deepEqual(segs.map((s) => [s.from, s.to, s.coords.length]), [['van', 'ani', 3], ['ani', 'kars', 2]]);
  assert.ok(segs[0].km > segs[1].km * 0.5 && segs[0].km > 0);
});
test('two routes that share a place chain into one path, in order', () => {
  const routes = [route('a', ['van', 'ani'], true), route('b', ['ani', 'kars'], true)];
  const [p] = find(routes, 'van', 'kars');
  assert.deepEqual(p.stops, ['van', 'ani', 'kars']);
  assert.deepEqual(p.legs.map((l) => l.route.id), ['a', 'b']);
  assert.ok(Math.abs(p.km - p.legs.reduce((n, l) => n + l.km, 0)) < 1e-9);
});
test('a path may start or end in the middle of a route, and one route is one leg', () => {
  const [p] = find([route('r', ['van', 'ani', 'kars', 'dvin'], true)], 'ani', 'dvin');
  assert.equal(p.legs.length, 1);
  assert.deepEqual(p.stops, ['ani', 'kars', 'dvin']); // the place passed on the way is listed too
});
test('a one-way route is only used in its own direction, a two-way route in both', () => {
  const one = [route('m', ['van', 'ani'], false)];
  assert.equal(find(one, 'van', 'ani').length, 1);
  assert.equal(find(one, 'ani', 'van').length, 0);
  const two = [route('t', ['van', 'ani'], true)];
  assert.equal(find(two, 'ani', 'van').length, 1);
});
test('no path when the routes do not meet, or when start and end are the same', () => {
  assert.equal(find([route('a', ['van', 'ani'], true), route('b', ['kars', 'dvin'], true)], 'van', 'dvin').length, 0);
  assert.equal(find([route('a', ['van', 'ani'], true)], 'van', 'van').length, 0);
  assert.equal(find([], 'van', 'ani').length, 0);
});
test('the shortest path comes first and an alternative avoids one route of it', () => {
  const routes = [route('direct', ['van', 'kars'], true), route('a', ['van', 'ani'], true), route('b', ['ani', 'kars'], true)];
  const paths = find(routes, 'van', 'kars');
  assert.equal(paths.length, 2);
  assert.ok(paths[0].km <= paths[1].km);
  assert.deepEqual(paths[0].legs.map((l) => l.route.id), ['direct']);
  assert.deepEqual(paths[1].legs.map((l) => l.route.id), ['a', 'b']);
});
test('a place that is not on the map any more is skipped, not an error', () => {
  const r = route('r', ['van', 'ani', 'kars'], true);
  r.stops = ['van', 'gone', 'ani'];
  assert.deepEqual(ctx.routeSegments(r, placeAt).map((s) => [s.from, s.to]), [['van', 'ani']]);
});
test('routesThrough finds the routes that pass a place', () => {
  ctx.rs = [route('a', ['van', 'ani'], true), route('b', ['kars', 'dvin'], true)];
  assert.deepEqual(run("routesThrough(rs, 'ani').map((r) => r.id)"), ['a']);
});
test('lineKm: one degree of latitude is about 111 km', () => {
  assert.ok(Math.abs(run('lineKm([[0, 0], [0, 1]])') - 111.2) < 0.5);
});

// ---- T-036: line and area types come from the types dictionary (the shape type registry in core/shapes.js) ----
const fresh = () => {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js/core/shapes.js'), 'utf8'), ctx, { filename: 'shapes.js' });
  return (code) => vm.runInContext(code, ctx);
};
const dict = [
  { code: 'settlement', geometry: 'point', names: [{ lang: 'en', name: 'Settlement' }], color: '#8d6e63', style: { symbol: 'circle', size: 8 } },
  { code: 'fiefdom', geometry: 'area', names: [{ lang: 'ru', name: 'Лен' }, { lang: 'en', name: 'Fiefdom' }], color: '#339966', style: { fill_opacity: 0.25, outline: { width: 1.5, pattern: 'dotted', opacity: 1 } } },
  { code: 'pilgrim-path', geometry: 'line', names: [{ lang: 'en', name: 'Pilgrim path' }], color: '#336699', style: { width: 2.5, pattern: 'dashed', opacity: 1, arrow: true } },
  { code: 'high-road', geometry: 'line', names: [{ lang: 'en', name: 'High road' }], color: '#5d4037', style: { width: 2, pattern: 'solid', opacity: 1, arrow: false } },
];

test('shape types: before a dictionary arrives the 12 built-in types work (6 areas, 5 routes, 1 river)', () => {
  const run = fresh();
  assert.deepEqual(run('BORDER_TYPES'), ['country', 'kingdom', 'province', 'district', 'territory', 'disputed']);
  assert.deepEqual(run('ROUTE_TYPE_LIST'), ['trade', 'military', 'migration', 'journey', 'road']);
  assert.deepEqual(run('RIVER_TYPE_LIST'), ['waterway']);
});

test('shape types: setShapeTypes replaces the built-in lists by the line and area types of the dictionary, in its order', () => {
  const run = fresh();
  run('setShapeTypes(' + JSON.stringify(dict) + ')');
  assert.deepEqual(run('BORDER_TYPES'), ['fiefdom']);
  assert.deepEqual(run('ROUTE_TYPE_LIST'), ['pilgrim-path', 'high-road']);
  const f = JSON.parse(run('JSON.stringify(shapeType("fiefdom"))'));
  assert.deepEqual([f.dash, f.width, f.fill, f.color, !!f.route, f.label], ['dotted', 1.5, 0.25, '#339966', false, 'Fiefdom']);
  const p = JSON.parse(run('JSON.stringify(shapeType("pilgrim-path"))'));
  assert.deepEqual([p.dash, p.width, p.color, p.route, p.twoway], ['dashed', 2.5, '#336699', true, false], 'arrow: true = one way');
  assert.equal(run('shapeType("high-road").twoway'), true, 'arrow: false = both ways');
  assert.equal(run('isRouteType("pilgrim-path")'), true);
  assert.equal(run('isRouteType("fiefdom")'), false);
  assert.equal(run('isRouteType("settlement")'), false, 'a point type is no shape type');
});

test('shape types: a dictionary with no line or area type leaves the built-in ones; an unknown type of a stored shape is drawn like the first area type', () => {
  const run = fresh();
  run('setShapeTypes(' + JSON.stringify([dict[0]]) + ')');
  assert.equal(run('BORDER_TYPES.length'), 6);
  run('setShapeTypes(' + JSON.stringify(dict) + ')');
  const u = JSON.parse(run('JSON.stringify(shapeType("country"))'));
  assert.equal(u.color, '#339966', 'country is gone from the dictionary: the first area type stands in');
  assert.equal(run('guessShapeType({ addresstype: "country" })'), 'fiefdom', 'a guess names a type that exists');
});

test('shape types: a route without its own twoway takes the one of its type', () => {
  const run = fresh();
  run('setShapeTypes(' + JSON.stringify(dict) + ')');
  const out = JSON.parse(run('JSON.stringify(normShape({ properties: { type: "pilgrim-path", id: "x" }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }))'));
  assert.equal(out.twoway, false);
  assert.deepEqual(out.stops, []);
});

test('river section: the way along a river between two clicks, with pieces in any order and direction', () => {
  run(`
    var line = (x0, x1) => { const o = []; for (let x = x0; x <= x1 + 1e-9; x += 0.1) o.push([+x.toFixed(3), 40]); return o; };
    // two pieces that meet at 44.5; the second one runs the other way round
    var river = { type: 'MultiLineString', coordinates: [line(44.0, 44.5), line(44.5, 45.0).reverse()] };
    var s = riverSection(river, [44.12, 40.01], [44.88, 39.99]);
  `);
  const J = (code) => JSON.stringify(run(code));
  assert.strictEqual(run('s.error'), undefined);
  assert.strictEqual(J('s.coords[0]'), '[44.1,40]');
  assert.strictEqual(J('s.coords[s.coords.length - 1]'), '[44.9,40]');
  assert.strictEqual(run('s.coords.length'), 9, 'every river point between the two ends, no more');
  assert.ok(run('s.km') > 66 && run('s.km') < 70, 'about 0.8 degrees of longitude at 40 N');
  assert.strictEqual(J('riverSection(river, [44.88, 40], [44.12, 40]).coords[0]'), '[44.9,40]', 'the direction follows the clicks');
});

test('river section: a click far from the river, or a piece that does not join, gives an error and no line', () => {
  run(`
    var r1 = { type: 'LineString', coordinates: [[44, 40], [44.1, 40], [44.2, 40]] };
    var r2 = { type: 'MultiLineString', coordinates: [[[44, 40], [44.1, 40]], [[45, 40], [45.1, 40]]] };
  `);
  assert.strictEqual(run('riverSection(r1, [44.1, 40], [44.1, 41]).error'), 'far');
  assert.strictEqual(run('riverSection(r1, [44.1, 40.02], [44.2, 40]).error'), 'far', 'a click 2 km from the river is not on it');
  assert.ok(run('riverSection(r1, [44.1, 40.005], [44.2, 40]).coords.length') >= 2, 'a click 0.5 km from the river is');
  assert.strictEqual(run('riverSection(r2, [44, 40], [45.1, 40]).error'), 'apart');
});

test('river types: a river type is a line that is not a route and not a border; the three groups are told apart', () => {
  const run = fresh();
  assert.strictEqual(run("isRiverType('waterway')"), true);
  assert.strictEqual(run("isRouteType('waterway')"), false);
  assert.strictEqual(run("BORDER_TYPES.includes('waterway')"), false);
  assert.strictEqual(run("shapeGroup({ type: 'waterway' })"), 'river');
  assert.strictEqual(run("shapeGroup({ type: 'road' })"), 'route');
  assert.strictEqual(run("shapeGroup({ type: 'country' })"), 'border');
});

// ---- T-057: selecting rivers by a rectangle or by an area (core/shapes.js: riversTouching, areasByName) ----
const riverRun = () => {
  const ctx = vm.createContext({ console, norm: (x) => String(x).toLowerCase() });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/js/core/shapes.js'), 'utf8'), ctx, { filename: 'shapes.js' });
  return (code, vars = {}) => (Object.assign(ctx, vars), vm.runInContext(code, ctx));
};
const line = (id, ...pts) => ({ id, geometry: { type: 'LineString', coordinates: pts } });
const SQUARE = [0, 0, 10, 10];
const RIVERS = [
  line('cross', [-5, 5], [15, 5]), // goes through the box with no vertex in it
  line('inside', [2, 2], [8, 8]),
  line('outside', [20, 20], [30, 30]),
  line('corner', [10, 10], [15, 15]), // touches the corner only
  line('near', [-5, 12], [5, 12]), // its bounding box overlaps nothing of the box, lies above it
  line('half', [5, 5], [15, 5]), // one vertex inside, one outside
];

test('riversTouching: a box in mode cross takes every river that touches or crosses it, in the order of the list', () => {
  const run = riverRun();
  assert.deepEqual(run('riversTouching(R, B, "cross")', { R: RIVERS, B: SQUARE }), ['cross', 'inside', 'corner', 'half']);
  assert.deepEqual(run('riversTouching(R, B)', { R: RIVERS, B: SQUARE }), ['cross', 'inside', 'corner', 'half'], 'cross is the default');
});

test('riversTouching: mode inside takes only the rivers whose every vertex is inside', () => {
  assert.deepEqual(riverRun()('riversTouching(R, B, "inside")', { R: RIVERS, B: SQUARE }), ['inside']);
});

test('riversTouching: a polygon with a hole: a river only in the hole is not touched; a river over the hole edge is', () => {
  const run = riverRun();
  const donut = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]]] };
  const R = [line('hole', [4, 4], [6, 6]), line('edge', [4, 4], [8, 8]), line('ring', [1, 1], [2, 2])];
  assert.deepEqual(run('riversTouching(R, G, "cross")', { R, G: donut }), ['edge', 'ring']);
  assert.deepEqual(run('riversTouching(R, G, "inside")', { R, G: donut }), ['ring']);
});

test('riversTouching: MultiPolygon areas, MultiLineString rivers, a triangle, and shapes without a line are skipped', () => {
  const run = riverRun();
  const multi = { type: 'MultiPolygon', coordinates: [[[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], [[[10, 10], [12, 10], [12, 12], [10, 12], [10, 10]]]] };
  const R = [{ id: 'two', geometry: { type: 'MultiLineString', coordinates: [[[50, 50], [51, 51]], [[11, 11], [11.5, 11.5]]] } }, line('none', [5, 5], [6, 6]), { id: 'area', geometry: multi }];
  assert.deepEqual(run('riversTouching(R, G, "cross")', { R, G: multi }), ['two']);
  const tri = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [0, 10], [0, 0]]] };
  assert.deepEqual(run('riversTouching(R, G)', { R: [line('a', [1, 1], [2, 2]), line('b', [8, 8], [9, 9])], G: tri }), ['a']);
});

test('areasByName: finds area shapes by any of their names, not lines; empty text finds nothing', () => {
  const run = riverRun();
  const poly = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
  const L = [
    { id: 'a', names: [{ lang: 'en', name: 'Lori' }, { lang: 'ru', name: 'Лори' }], geometry: poly },
    { id: 'b', names: [{ lang: 'en', name: 'Lori road' }], geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
    { id: 'c', names: [{ lang: 'en', name: 'Syunik' }, { lang: 'en', name: 'Siunik (old)' }], geometry: poly },
  ];
  assert.deepEqual(run('areasByName(L, "lor").map((s) => s.id)', { L }), ['a']);
  assert.deepEqual(run('areasByName(L, "siun").map((s) => s.id)', { L }), ['c'], 'an old name');
  assert.deepEqual(run('areasByName(L, "").length', { L }), 0);
});
