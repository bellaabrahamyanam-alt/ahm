# Change log of the state domain

The folder `app/js/state/` was a scaffold made by the integrator (`changes/shared.md` #4).

One entry per change, newest last: date, what, why, files, how to verify, open follow-ups. Only the state domain appends here (DOMAINS.md, rule 7).

## 1. 2026-11-07: state manager built (task 001)

- **What:** `AHM.state` with `get(key)`, `set(key, value)`, `patch(key, partial)`. Keys `selected` (default `null`) and `layers` (`{ only: Set, hide: Set, open, editing, staged, noteAll }`, live object). Unknown key throws ("unknown key"); non-object `patch` or `set('layers', non-object)` throws ("object").
- **Events:** `state:<key>` with `{ value, old }`. `set` emits only when the value is not identical (`!==`); `patch` always emits once, `old` is a shallow copy from before the patch.
- **Why:** proposal 003 (approved), step 2: one place for state shared between domains.
- **Files:** `app/js/state/state.js`, `changes/state.md`, `todo/state.md`. No test changed (the 8 tests of `tests/js/state.test.js` were already on main).
- **Verify:** `AHM_TDD=1 node tests/js/run.js --no-browser state` (8 passed); `node tests/js/run.js` (90 passed).
- **Follow-ups:** steps 3-6 of proposal 003 (core, sidebar, map, shared) belong to other domains.

## 2. 2026-11-16: key `time` (T-040)

- **What:** `AHM.state` key `time` = `{ at: null, playing: false, speed: 10, undated: true }` (live object like `layers`; `set('time', x)` needs the same fields; `patch` announces `state:time`).
- **Why:** T-040 (time slider). **Files:** `app/js/state/state.js`, `interfaces/I-6-state-manager.md`, `tests/js/state.test.js`, `tests/js/contract.test.js`.
- **Verify:** `node tests/js/run.js state --no-browser`. Owner-approved: T-040.
