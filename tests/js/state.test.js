// Tests of the state manager (domain state), written first (TDD) from proposals/003-state-manager.md. The state agent makes them pass.
// While AHM.state is only the scaffold these tests are skipped, so the other domains keep a green suite; run them red with:
//   AHM_TDD=1 node tests/js/run.js state
const { test, eq, throws } = require('./lib/harness');
const { load } = require('./lib/ctx');

const page = () => {
  const p = load(['state.js']);
  p.X('globalThis.__events = []; for (const k of ["selected", "layers", "time"]) AHM.on("state:" + k, (e) => __events.push([k, e]));');
  return p;
};
const built = () => load(['state.js']).X('typeof AHM.state.get') === 'function';
const state = (name, fn) =>
  test('state: ' + name, async () => {
    if (!built() && !process.env.AHM_TDD) return console.log('    (state manager not built yet: skipped; AHM_TDD=1 runs it)');
    await fn();
  });
const events = (p) => p.X('__events.splice(0).map(([k, e]) => [k, e])');

state('AHM.state has exactly get, set and patch', () => {
  eq(['get', 'patch', 'set'], load(['state.js']).X('Object.keys(AHM.state).sort()'));
});

state('defaults: selected is null, layers has the fields of the old lyState', () => {
  const p = page();
  eq(null, p.X("AHM.state.get('selected')"));
  eq(true, p.X("(() => { const l = AHM.state.get('layers'); return l.only instanceof Set && l.hide instanceof Set && l.only.size === 0 && l.hide.size === 0; })()"));
  eq([null, null, null, false], p.X("(() => { const l = AHM.state.get('layers'); return [l.open, l.editing, l.staged, l.noteAll]; })()"));
  eq(['editing', 'hide', 'noteAll', 'only', 'open', 'staged'], p.X("Object.keys(AHM.state.get('layers')).sort()"));
});

state('unknown keys throw in get, set and patch', () => {
  const p = page();
  for (const call of ["AHM.state.get('nope')", "AHM.state.set('nope', 1)", "AHM.state.patch('nope', {})"]) throws(/unknown key/, () => p.X(call), call);
});

state('set changes the value, emits state:<key> once with { value, old }, and nothing for an identical value', () => {
  const p = page();
  p.X("AHM.state.set('selected', 'p1')");
  eq('p1', p.X("AHM.state.get('selected')"));
  eq([['selected', { value: 'p1', old: null }]], events(p));
  p.X("AHM.state.set('selected', 'p1')");
  eq([], events(p), 'identical value: no event');
  p.X("AHM.state.set('selected', null)");
  eq([['selected', { value: null, old: 'p1' }]], events(p));
});

state('get("layers") is the live object: the same object every time, mutations are visible', () => {
  const p = page();
  eq(true, p.X("AHM.state.get('layers') === AHM.state.get('layers')"));
  p.X("AHM.state.get('layers').only.add('L1'); AHM.state.get('layers').open = 'L1'");
  eq(['L1', 'L1'], p.X("[[...AHM.state.get('layers').only][0], AHM.state.get('layers').open]"));
  eq([], events(p), 'a mutation in place is silent until announced');
});

state('patch assigns fields and always emits state:layers once (patch with {} announces an in-place change)', () => {
  const p = page();
  const same = p.X("const o = AHM.state.get('layers'); AHM.state.patch('layers', { open: 'L2', noteAll: true }); o === AHM.state.get('layers')");
  eq(true, same, 'same object');
  eq(['L2', true], p.X("[AHM.state.get('layers').open, AHM.state.get('layers').noteAll]"));
  let e = events(p);
  eq(1, e.length);
  eq('layers', e[0][0]);
  eq('L2', e[0][1].value.open);
  eq(null, e[0][1].old.open, 'old is a copy of the state before the patch');
  p.X("AHM.state.patch('layers', {})");
  eq(1, events(p).length, 'an empty patch still announces');
});

state('patch on a value that is not an object throws; set("layers") needs an object and replaces it', () => {
  const p = page();
  throws(/object/, () => p.X("AHM.state.patch('selected', { a: 1 })"));
  throws(/object/, () => p.X("AHM.state.set('layers', 5)"));
  p.X("const n = { only: new Set(['x']), hide: new Set(), open: null, editing: null, staged: null, noteAll: false }; AHM.state.set('layers', n); globalThis.__n = n");
  eq(true, p.X("AHM.state.get('layers') === __n"));
  eq(1, events(p).length);
});

state('a handler that throws does not stop the change or the other handlers', () => {
  const p = page();
  p.X("AHM.on('state:selected', () => { throw new Error('x'); })");
  const quiet = p.X("const log = console.error; console.error = () => {}; AHM.state.set('selected', 'p9'); console.error = log; AHM.state.get('selected')");
  eq('p9', quiet);
  eq(1, events(p).length);
});

state('time (T-040): default is off; patch changes a field and always emits state:time once', () => {
  const p = page();
  eq({ at: null, playing: false, speed: 10, undated: true }, p.X("JSON.parse(JSON.stringify(AHM.state.get('time')))"));
  p.X("AHM.state.patch('time', { at: '0200-01-01T00:00:00Z' })");
  const ev = events(p);
  eq(1, ev.length);
  eq('time', ev[0][0]);
  eq('0200-01-01T00:00:00Z', ev[0][1].value.at);
  eq(null, ev[0][1].old.at, 'old is a copy from before the patch');
  throws(/object/, () => p.X("AHM.state.patch('time', 5)"));
});
