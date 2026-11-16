<!-- One interface of the contract; index and rules: INTERFACES.md -->

## I-6 State manager (`window.AHM.state`, `app/js/state/state.js`). Provider: **state**. Consumers: everyone

The one module that holds state shared between domains. It has no DOM, no map and no sidebar code and calls no other domain. Only the
state domain writes `app/js/state/`. Spec: `changes/archive/proposals/003-state-manager.md` (approved), tests: `tests/js/state.test.js`.
- `AHM.state.get(key)` returns the value. `AHM.state.set(key, value)` replaces it. `AHM.state.patch(key, partial)` assigns the given fields of an object value. These three are the whole API.
- Keys (version 1.10, exactly these three; new keys only in a TODO.md item with an `Approved:` line):
  - `selected`: id of the place shown now, or `null` (default). Written by the sidebar, read by the map (highlight).
  - `layers`: `{ only: Set, hide: Set, open, editing, staged, noteAll }`, the fields of the former `lyState`. `get('layers')` returns the live object; after changing its sets in place call `AHM.state.patch('layers', {})` to announce it.
  - `time` **[1.10]**: `{ at, playing, speed, undated }`, the time bar (T-040). `at` = ISO text of the moment or `null` (off, default), `playing` boolean (default `false`), `speed` years per second (default `10`), `undated` = show objects with no date faded (default `true`). Written by the sidebar (the time bar), read by core (`timeLook`); the sidebar handles `state:time` to refresh its lists and the map. The event is `state:time` (not a separate `time:changed`: state events are named `state:<key>`).
- Events: `AHM.emit('state:<key>', { value, old })`. `set` emits only when the value is not identical (`!==`); `patch` always emits once (`old` = shallow copy from before the patch).
- Errors (thrown): unknown key (message contains "unknown key"); `patch` on a value that is not an object, or with a non-object argument; `set('layers', x)` or `set('time', x)` with anything but an object that has the same fields.
- Rules: nobody but `state.js` assigns `AHM.state`; state events are named `state:<key>`; the sidebar and the map may use `AHM.state` besides `AHM.map`, `AHM.on` and `AHM.emit`.
- Roll-out (old tasks 002-004, merged 2026-11-08): core reads `lyState` from `AHM.state.get('layers')`; the sidebar writes `selected` and announces layer changes; the map listens to `state:selected`.
