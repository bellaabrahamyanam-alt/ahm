// Loads the browser scripts (classic scripts, no modules) into a vm context with a tiny DOM stand-in,
// in the order of app/index.html, so the functions can be called without a browser.
// Top-level const/let of all scripts share one scope, exactly like in a page: a name declared twice throws here as well.
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const JS = path.join(ROOT, 'app', 'js');

/** A script name such as 'dates.js' is found in app/js or in one of its domain folders (core, sidebar, map). */
function scriptPath(name) {
  for (const d of ['', 'core', 'sidebar', 'map', 'state']) {
    const f = path.join(JS, d, name);
    if (fs.existsSync(f)) return f;
  }
  throw new Error('script not found: ' + name);
}

// A 2D canvas context that accepts every call and every assignment (icons are drawn on canvases: typeicons.js, sidebar/shapes.js).
const ctx2d = new Proxy({}, { get: () => () => {}, set: () => true });

function fakeEl(sel) {
  const e = {
    sel,
    value: '',
    innerHTML: '',
    textContent: '',
    hidden: false,
    checked: false,
    open: false,
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(ev, fn) {
      ((e._on ||= {})[ev] ||= []).push(fn); // kept so that a test can call the handlers a script registered at load
    },
    removeEventListener() {},
    setAttribute() {},
    getAttribute: () => null,
    focus() {},
    close() {},
    showModal() {},
    show() {},
    insertAdjacentHTML() {},
    scrollIntoView() {},
    prepend() {},
    getContext: () => ctx2d,
    toDataURL: () => 'data:image/png;base64,',
    closest: () => null,
    matches: () => false,
    querySelector: (s) => fakeEl(sel + ' ' + s),
    querySelectorAll: () => [],
  };
  return e;
}

/** @param scripts file names in app/js, in load order; @param pre code run before them (stand-ins for ui.js functions) */
function load(scripts, pre = '') {
  const els = {};
  const document = {
    querySelector: (s) => (els[s] ||= fakeEl(s)),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => fakeEl('created'),
    body: fakeEl('body'),
    documentElement: fakeEl('html'),
  };
  const calls = [];
  const sandbox = {
    document,
    history: { replaceState() {} },
    location: { hash: '', pathname: '/', search: '' },
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }),
    fetch: () => Promise.reject(new Error('no network in tests')),
    console,
    setTimeout,
    clearTimeout,
    performance: globalThis.performance,
    alert() {},
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    requestAnimationFrame: () => 0, // frames never run here: revealRow / fitNotes of ui.js need a real layout
    cancelAnimationFrame() {},
    innerWidth: 1280,
    innerHeight: 800,
    confirm: () => true,
    __calls: calls,
    __els: els,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(pre, ctx, { filename: 'stand-ins' });
  for (const f of ['ahm.js', 'icons.js', ...scripts]) vm.runInContext(fs.readFileSync(scriptPath(f), 'utf8'), ctx, { filename: f });
  return {
    ctx,
    els,
    calls,
    /** evaluate code in the page scope; `vars` become temporary globals __0, __1 ... (plain data) */
    X(code, ...vars) {
      vars.forEach((v, i) => (ctx['__' + i] = v));
      return vm.runInContext(code, ctx);
    },
    el: (s) => (els[s] ||= fakeEl(s)),
  };
}

// stand-ins for what ui.js / typeicons.js provide, so layers.js and friends can run without them
const UI_STANDINS = `
  var cur = null, dlg = {}, curTab = 'explore', editMk = null;
  function update() { __calls.push('update'); }
  function tab(n) { curTab = n; __calls.push('tab:' + n); }
  function show(id) { __calls.push('show:' + id); }
  function closeDetail() { __calls.push('closeDetail'); }
  function dockSync() {}
  function revealRow() {}
  const typeIcon = () => ''; // typeLabel comes from core/data.js
`;
const SAMPLE = {
  places: [
    { id: 'p1', type: 'city', names: [{ lang: 'en', name: 'Artashat' }, { lang: 'hy', name: 'Արտաշատ' }], date_from: null, date_to: null, lon: 44.5, lat: 39.9 },
    { id: 'p2', type: 'fortress', names: [{ lang: 'en', name: 'Erebuni' }], date_from: null, date_to: null, lon: 44.5, lat: 40.1 },
    { id: 'p3', type: 'mountain', names: [{ lang: 'en', name: 'Ararat' }, { lang: 'hy', name: 'Արարատ' }], height_m: 5137, date_from: null, date_to: null, lon: 44.3, lat: 39.7 },
    { id: 'p4', type: 'village', names: [{ lang: 'ru', name: 'Деревня' }], date_from: null, date_to: null, lon: 45, lat: 40 },
  ],
};
module.exports = { load, ROOT, JS, UI_STANDINS, SAMPLE, fakeEl };
