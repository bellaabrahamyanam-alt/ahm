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

test('a river is a line type but not a route: an OSM river result is guessed as river and path finding never uses it', () => {
  assert.strictEqual(run("guessShapeType({ addresstype: 'river' })"), 'river');
  assert.strictEqual(run("guessShapeType({ type: 'stream' })"), 'river');
  assert.strictEqual(run("guessShapeType({ addresstype: 'state' })"), 'region');
  assert.strictEqual(run("isRouteType('river')"), false);
  assert.ok(run("BORDER_TYPES.includes('river')"));
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
  assert.strictEqual(run('riverSection(r2, [44, 40], [45.1, 40]).error'), 'apart');
});
