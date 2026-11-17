// Data access and small helpers. The ONLY place that knows where our data comes from.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const getJSON = (u) =>
  fetch(u, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw Error(r.status);
    return r.json();
  });
// ---- old data: files saved before the date model changed are converted here, so a not-yet-migrated store still works ----
const asDate = (v, text, approx) => (v && typeof v === 'object' ? dateUpgrade(v) : legacyToDate(v, text, approx));
const normPlace = (p) => {
  const mountain = p.type === 'mountain'; // a mountain has a height, not dates
  return {
    ...p,
    date_from: mountain ? null : asDate(p.date_from, p.date_from_text, p.approx),
    date_to: mountain ? null : asDate(p.date_to, p.date_to_text, p.approx),
    height_m: mountain && p.height_m != null ? p.height_m : null,
  };
};
const normNote = (n) => ({ ...n, layers: n.layers || [], date: n.date && typeof n.date === 'object' ? dateUpgrade(n.date) : asDate(n.year, n.when, false) });
const loadPlaces = () =>
  getJSON(AHM_CONFIG.url.places).then((fc) =>
    fc.features.map((f) =>
      normPlace({
        ...f.properties,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      })
    )
  );
const loadNotesIndex = () => getJSON(AHM_CONFIG.url.notesIndex).then((j) => j.notes.map(normNote));
// Layers, their notes and the categories are optional files: a store without them behaves as "no layers".
const loadOpt = (u, f) => getJSON(u).then(f).catch(() => []);
const normLayer = (l) => ({
  ...l,
  date_from: l.date_from ? dateUpgrade(l.date_from) : null,
  date_to: l.date_to ? dateUpgrade(l.date_to) : null,
});
const loadLayers = () => loadOpt(AHM_CONFIG.url.layers, (j) => j.layers.map(normLayer));
const loadLayerNotes = () =>
  loadOpt(AHM_CONFIG.url.layerNotesIndex, (j) =>
    j.notes.map((n) => ({ ...n, date: n.date && typeof n.date === 'object' ? dateUpgrade(n.date) : null }))
  );
const loadCategories = () => loadOpt(AHM_CONFIG.url.categories, (j) => j.categories);
const loadLanguages = () => getJSON(AHM_CONFIG.url.languages).then((j) => j.languages);
// The dictionary of place types (like languages and categories). A store without types.json still works: no types, codes are shown as text.
const loadTypes = () => loadOpt(AHM_CONFIG.url.types, (j) => j.types);
const loadNoteBody = (n) =>
  fetch(AHM_CONFIG.url.note(n.place, n.id), { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw Error(r.status);
      return r.text();
    })
    .then((t) => t.replace(/^---[\s\S]*?---\s*/, ''));
let places = [],
  notes = [],
  by = {},
  layers = [],
  layerNotes = [],
  categories = [],
  languages = [], // the dictionary of languages: [{ code, name, native }]; only administrators add to it
  types = []; // the dictionary of types: [{ code, geometry, names, color, style }]; only administrators add to it
// Names over time (T-043): a name may carry date_from / date_to (the date model). nameAt gives the name of language `lang` that is valid at the moment
// `at` (seconds; null = no moment: the first name, as always): the first name with a period that holds it, else the first name of the language;
// no such language: English, then the first name.
function nameAt(item, lang, at) {
  const live = (n) => (n.date_from || n.date_to) && ['yes', 'faded'].includes(visibleAt(n, at));
  for (const code of [lang, 'en']) {
    const list = item.names.filter((n) => n.lang === code);
    if (list.length) return (at === null ? list[0] : list.find(live) || list[0]).name;
  }
  return item.names[0].name;
}
/** The moment of the time bar in seconds, null while it is off (state.js is loaded first in the page). */
const nameMoment = () => {
  const t = AHM.state && AHM.state.get('time');
  return t && t.at !== null ? isoToSec(t.at) : null;
};
const label = (p, l) => nameAt(p, l, nameMoment());
/** The name that matched the search text when it is not the one shown (an old name found by search), else ''. */
function nameMatch(item, text, lang) {
  const q = norm(text);
  if (!q || norm(nameAt(item, lang, nameMoment())).includes(q)) return '';
  const hit = item.names.find((n) => (!lang || n.lang === lang) && norm(n.name).includes(q));
  return hit ? hit.name : '';
}
const langName = (code) => {
  const l = languages.find((x) => x.code === code);
  return l ? l.name : code;
};
// Name of a type in language `lang` (else English, else the first name, else the code with spaces) for lists, chips and forms.
const typeLabel = (code, lang) => {
  const t = types.find((x) => x.code === code),
    n = t && t.names.length ? t.names.find((x) => x.lang === lang) || t.names.find((x) => x.lang === 'en') || t.names[0] : null;
  return n ? n.name : String(code).replace(/_/g, ' ');
};
// What a place shows instead of dates: a mountain its height, everything else its dates ('' when nothing is known).
const placeWhen = (p) =>
  p.type === 'mountain' ? (p.height_m == null ? '' : 'height ' + p.height_m + ' m') : spanText(p.date_from, p.date_to);
