// Layer rules (core domain): the filter state and the pure rules that decide which places and notes are shown.
// No DOM and no map here. The sidebar UI (sidebar/layers.js) fills `layers`, `layerNotes`, `categories`, `lyMembers` and changes `lyState`.
// A layer is a named SUBSET of the general layer (every place with every note; the general layer is not stored).
// "only" = show only places that are in at least one of these layers (OR); "hide" = hide places in any of these layers (NOT IN).
// Prefix `ly` = layers, `cat` = categories.

// Fields (owned by AHM.state): only, hide, open (id of the layer whose details are shown), editing (id of the layer whose places
// are being chosen), staged (while editing: Set of place ids that will be the members), noteAll ("show all notes" for the place shown now).
const lyState = AHM.state.get('layers');
// The time slider (T-040; AHM.state 'time': at = ISO text or null = off, playing, speed in years per second, undated = show undated objects faded).
const timeState = AHM.state.get('time');
const timeActive = () => timeState.at !== null; // the time slider is on
/** 'yes', 'faded' or 'no': how one place, shape or layer looks at the moment of the slider ('yes' while the slider is off). */
function timeLook(item) {
  if (timeState.at === null) return 'yes';
  const look = visibleAt(item, isoToSec(timeState.at));
  return look === 'undated' ? (timeState.undated ? 'faded' : 'no') : look;
}
let lyMembers = {}; // layer id -> Set of place ids
const lyById = (id) => layers.find((l) => l.id === id);
const nameIn = (list, l) => (list.find((n) => n.lang === l) || list.find((n) => n.lang === 'en') || list[0]).name;
const lyName = (ly, l) => nameIn(ly.names, l);
const catById = (id) => categories.find((c) => c.id === id);
const catName = (c, l) => (c ? nameIn(c.names, l) : '');
const lyWhen = (ly) => spanText(ly.date_from, ly.date_to);

// ---- what the filters do to the map and to notes ----
function layerAllows(pid) {
  if (lyState.editing) return true; // while places are being chosen, every place is shown
  if (lyState.only.size && ![...lyState.only].some((id) => lyMembers[id] && lyMembers[id].has(pid))) return false;
  return ![...lyState.hide].some((id) => lyMembers[id] && lyMembers[id].has(pid));
}
const lyFilterCount = () => lyState.only.size + lyState.hide.size;
/** Layers whose notes are shown for place pid: the open layer and the "only" layers that contain it; null = all notes. */
function lyScope(pid, withOpen) {
  const cand = [...(withOpen && lyState.open ? [lyState.open] : []), ...lyState.only].filter(
    (id) => lyMembers[id] && lyMembers[id].has(pid)
  );
  return lyState.noteAll || !cand.length ? null : [...new Set(cand)];
}
const lyNoteVisible = (n, scope) => !scope || (n.layers || []).some((id) => scope.includes(id));
/** Colour of the ring around a place on the map ('' = none): the members while editing, else the colour of an "only" layer. */
function lyHalo(pid) {
  if (lyState.editing) return lyState.staged.has(pid) ? (lyById(lyState.editing).color || '#bc2a4d') : '';
  for (const id of lyState.only) if (lyMembers[id] && lyMembers[id].has(pid) && lyById(id).color) return lyById(id).color;
  return '';
}
