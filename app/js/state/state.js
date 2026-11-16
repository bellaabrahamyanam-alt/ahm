// State manager (domain "state"; INTERFACES.md I-6, changes/archive/proposals/003-state-manager.md). The ONE place that holds state shared between
// domains (the selected place, the layer state). Provided to everyone as AHM.state; it knows nothing about the DOM, the map or the sidebar.
// One function scope: no top-level names.
(() => {
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const values = {
    selected: null,
    layers: { only: new Set(), hide: new Set(), open: null, editing: null, staged: null, noteAll: false },
    time: { at: null, playing: false, speed: 10, undated: true }, // the time slider (T-040): at = ISO text of the moment, null = off
  };
  const fields = { layers: Object.keys(values.layers).sort().join(), time: Object.keys(values.time).sort().join() };

  const check = (key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error('state: unknown key "' + key + '"');
  };

  const get = (key) => {
    check(key);
    return values[key];
  };

  const set = (key, value) => {
    check(key);
    if (fields[key] && (!isObject(value) || Object.keys(value).sort().join() !== fields[key])) {
      throw new Error('state: "' + key + '" needs an object with the fields ' + fields[key]);
    }
    const old = values[key];
    if (value === old) return;
    values[key] = value;
    AHM.emit('state:' + key, { value, old });
  };

  const patch = (key, partial) => {
    check(key);
    const value = values[key];
    if (!isObject(value)) throw new Error('state: "' + key + '" is not an object, patch needs an object value');
    if (!isObject(partial)) throw new Error('state: patch needs an object');
    const old = { ...value };
    Object.assign(value, partial);
    AHM.emit('state:' + key, { value, old });
  };

  AHM.state = { get, set, patch };
})();
