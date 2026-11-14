// Dev "backend" for browser-sync: POST /api/save adds a place and/or a note by writing files in data/.
// The same rules as service/store.php (and the same date code as the browser: app/js/core/dates.js). No permission checks.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const D = require('../app/js/core/dates.js');
const DATA = path.join(__dirname, '..', 'data'),
  GEO = path.join(DATA, 'places.geojson');
const ARCH = path.join(DATA, '..', 'dev', 'archive'),
  NOTES = path.join(DATA, 'notes');
const TYPES = [
  'settlement',
  'city',
  'town',
  'village',
  'fortress',
  'temple',
  'tomb',
  'inscription_site',
  'monument',
  'mountain',
  'lake',
  'river',
  'region',
];
const LANG = /^[A-Za-z-]{2,8}$/,
  UUID = /^[0-9a-f-]{36}$/;
const MAX_HEIGHT_M = 9000;
const LANG_FILE = path.join(DATA, 'languages.json');
// Names for language codes found in older data when the dictionary (languages.json) is first created.
const KNOWN_LANGS = {
  en: ['English', 'English'],
  hy: ['Armenian', 'Հայերեն'],
  ru: ['Russian', 'Русский'],
  tr: ['Turkish', 'Türkçe'],
  la: ['Latin', 'Latina'],
  xur: ['Urartian', ''],
};
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const writeAtomic = (p, s) => {
  fs.writeFileSync(p + '.tmp', s);
  fs.renameSync(p + '.tmp', p);
};
const readJSON = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fallback;
  }
};
const stampNow = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const parseMeta = (head) => {
  const meta = {};
  head.split('\n').forEach((l) => {
    const i = l.indexOf(': ');
    if (i > 0) meta[l.slice(0, i)] = l.slice(i + 2);
  });
  return meta;
};
// A note file: a small header, then the text. The date (if any) is one line of JSON.
const noteFile = (id, lang, title, date, text, layers = []) =>
  `---\nid: ${id}\nlang: ${lang}\ntitle: ${title}\n${layers.length ? `layers: ${layers.join(',')}\n` : ''}${date ? `date: ${JSON.stringify(date)}\n` : ''}---\n${text}\n`;
// "id1,id2" (a note's layers: header) -> the valid ids
const layerIds = (csv) => {
  const out = [];
  String(csv || '')
    .split(',')
    .map((x) => x.trim())
    .forEach((x) => UUID.test(x) && !out.includes(x) && out.push(x));
  return out;
};
// The header lines of a note file as an object (empty when the file is not a note).
const noteMeta = (file) => {
  let raw = '';
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {}
  const end = raw.indexOf('\n---\n', 3);
  return raw.startsWith('---\n') && end >= 0 ? parseMeta(raw.slice(4, end)) : {};
};
// The date of a note from its header: the "date:" JSON, or (older files) "year:" + "when:" converted. null = unknown.
function noteDate(meta) {
  if (meta.date !== undefined) {
    try {
      const d = JSON.parse(meta.date);
      return d && typeof d === 'object' ? D.dateUpgrade(d) : null;
    } catch (e) {
      return null;
    }
  }
  return meta.year !== undefined ? D.legacyToDate(meta.year, meta.when || '', false) : null;
}

// ---------------- languages: the dictionary (languages.json) ----------------
function usedLangCodes() {
  const used = new Set();
  (readJSON(GEO, { features: [] }).features || []).forEach((f) =>
    ((f.properties || {}).names || []).forEach((n) => n.lang && used.add(n.lang))
  );
  if (fs.existsSync(NOTES))
    for (const place of fs.readdirSync(NOTES)) {
      if (!UUID.test(place) || !fs.statSync(path.join(NOTES, place)).isDirectory()) continue;
      for (const fn of fs.readdirSync(path.join(NOTES, place))) {
        if (!fn.endsWith('.md')) continue;
        const m = fs.readFileSync(path.join(NOTES, place, fn), 'utf8').slice(0, 600).match(/^lang: *(.+)$/m);
        if (m) used.add(m[1].trim());
      }
    }
  return [...used];
}
// Reads languages.json; when it does not exist yet, creates it from the languages already in use.
function langLoad() {
  const d = readJSON(LANG_FILE, null);
  if (d && Array.isArray(d.languages)) return d.languages;
  const codes = ['en', 'hy', 'ru', 'tr'];
  usedLangCodes()
    .sort()
    .forEach((c) => codes.includes(c) || codes.push(c));
  const list = codes.map((code) => {
    const k = KNOWN_LANGS[code] || [code, ''];
    return { code, name: k[0], native: k[1] };
  });
  writeAtomic(LANG_FILE, JSON.stringify({ version: 1, languages: list }, null, 1));
  return list;
}
// Adds one language, or with edit:true changes the names of an existing one (the server only lets administrators do this). Returns its code.
function saveLang(inp) {
  const code = String(inp.code || '')
      .trim()
      .toLowerCase(),
    name = oneLine(inp.name, 80),
    native = oneLine(inp.native, 80);
  if (!LANG.test(code)) throw bad('the language code must be 2-8 letters (for example en, hy, xur)');
  if (!name) throw bad('the language needs a name');
  const list = langLoad();
  const at = list.findIndex((l) => l.code === code),
    edit = !!inp.edit; // edit = change the names of an existing language (the code never changes)
  if (edit && at < 0) throw bad(`language "${code}" is not in the list`);
  if (!edit && at >= 0) throw bad(`language "${code}" is already in the list`);
  fs.mkdirSync(ARCH, { recursive: true });
  fs.copyFileSync(LANG_FILE, archivePath('languages', 'json'));
  if (edit) list[at] = { code, name, native };
  else list.push({ code, name, native });
  writeAtomic(LANG_FILE, JSON.stringify({ version: 1, languages: list }, null, 1));
  return code;
}

// ---------------- place types: the dictionary (types.json); same rules as service/store.php ----------------
const TYPE_FILE = path.join(DATA, 'types.json'),
  TYPE_COLOR = /^#[0-9a-fA-F]{6}$/,
  SYMBOL = /^[a-z0-9-]{1,24}$/,
  PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]{2,20000}$/; // SVG path data of a custom symbol: drawing commands and numbers only
const SEED_STYLE = {
  settlement: ['circle', '#8D6E63', 7.5],
  city: ['circle', '#B3261E', 10],
  town: ['circle', '#E07B39', 8],
  village: ['circle', '#C9A227', 6.5],
  fortress: ['square', '#455A64', 8.5],
  temple: ['diamond', '#7B1FA2', 9],
  tomb: ['plus', '#5D4037', 9],
  inscription_site: ['star', '#F9A825', 10],
  monument: ['hexagon', '#00796B', 9],
  mountain: ['triangle', '#2E7D32', 10],
  lake: ['drop', '#1976D2', 9],
  river: ['bar', '#0288D1', 9],
  region: ['ring', '#6A1B9A', 10],
};
// Reads types.json; when it does not exist yet, creates it from the seed (the types that existed before).
function typeLoad() {
  if (fs.existsSync(TYPE_FILE)) {
    // Never replace a file that exists: a damaged one must not silently drop the types an administrator added.
    let d = null;
    try {
      d = JSON.parse(fs.readFileSync(TYPE_FILE, 'utf8'));
    } catch (e) {
      d = null;
    }
    if (!d || !Array.isArray(d.types)) throw bad('types.json cannot be read; restore it from the archive folder or fix it, nothing was changed');
    return d.types;
  }
  const list = Object.entries(SEED_STYLE).map(([code, s]) => ({
    code,
    geometry: 'point',
    names: [{ lang: 'en', name: code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ') }],
    color: s[1],
    style: { symbol: s[0], size: s[2] },
  }));
  writeAtomic(TYPE_FILE, JSON.stringify({ version: 1, types: list }, null, 1));
  return list;
}
function putTypes(list) {
  if (fs.existsSync(TYPE_FILE)) {
    fs.mkdirSync(ARCH, { recursive: true });
    fs.copyFileSync(TYPE_FILE, archivePath('types', 'json'));
  }
  writeAtomic(TYPE_FILE, JSON.stringify({ version: 1, types: list }, null, 1));
}
// Code of a new type: its English name in lower case, letters and digits joined by "-"; "-2", "-3" ... when taken.
function typeCodeFrom(name, taken) {
  let c = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
    .replace(/-+$/, '');
  if (!c) throw bad('the English name must have letters or digits (the code of the type is made from it)');
  let code = c;
  for (let i = 2; taken.includes(code); i++) code = c + '-' + i;
  return code;
}
// Administrators only: adds a type, or with edit:true changes one (code and geometry never change). Returns its code.
function saveType(inp) {
  if (inp.geometry !== 'point')
    throw bad('only point types (markers of places) can be added for now: geometry must be "point"');
  const names = cleanNames(inp.names, langLoad().map((l) => l.code), 'a type needs at least one name');
  const color = String(inp.color === undefined ? '' : inp.color);
  if (!TYPE_COLOR.test(color)) throw bad('the colour must look like #1a2b3c');
  const st = inp.style && typeof inp.style === 'object' ? inp.style : {},
    symbol = String(st.symbol == null ? 'circle' : st.symbol),
    size = st.size == null ? 8 : st.size;
  if (!SYMBOL.test(symbol)) throw bad('the symbol must be a slug of letters, digits and "-" (for example circle, tree)');
  if (typeof size !== 'number' || !(size >= 4 && size <= 14)) throw bad('the size must be a number from 4 to 14');
  const list = typeLoad(),
    at = list.findIndex((t) => t.code === inp.code);
  let code;
  if (inp.edit) {
    if (at < 0) throw bad('unknown type');
    code = list[at].code;
  } else {
    const en = (names.find((n) => n.lang === 'en') || {}).name;
    if (!en) throw bad('give the type a name in English (its code is made from it)');
    code = typeCodeFrom(en, list.map((t) => t.code));
  }
  const style = { symbol, size };
  if (symbol === 'custom') {
    // A custom symbol: an SVG path drawn in a square box (default 24) whose corner is 0,0.
    const path = typeof st.path === 'string' ? st.path.trim() : '',
      box = st.box == null ? 24 : st.box;
    if (!PATH.test(path) || !/^[Mm]/.test(path))
      throw bad('a custom symbol needs an SVG path (the d value, 2 to 20000 characters of drawing commands and numbers, starting with M)');
    if (typeof box !== 'number' || !(box >= 8 && box <= 2048)) throw bad('the box of a custom symbol must be a number from 8 to 2048');
    style.path = path;
    style.box = box;
  }
  const entry = { code, geometry: 'point', names, color: color.toLowerCase(), style };
  if (inp.edit) list[at] = entry;
  else list.push(entry);
  putTypes(list);
  return code;
}
// Administrators only: removes a type nobody uses. 400 with the number of places when some place still has it.
function deleteType(code) {
  const list = typeLoad(),
    at = list.findIndex((t) => t.code === code);
  if (at < 0) throw bad('unknown type');
  if (code === 'mountain') throw bad('the type "mountain" cannot be removed (a mountain has a height instead of dates)');
  const used = (readJSON(GEO, { features: [] }).features || []).filter((f) => (f.properties || {}).type === code).length;
  if (used > 0) throw bad(`${used} place${used === 1 ? '' : 's'} use the type "${code}"; change their type first`);
  list.splice(at, 1);
  putTypes(list);
  return true;
}

const oneLine = (v, max) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
// Checks the fields of a place (new or edited). Several names per language are allowed; codes = the language dictionary,
// types = the codes of the types dictionary.
// A mountain has a height (optional) and no dates; every other type has optional dates and no height.
function cleanPlace(p, codes, types) {
  const lat = Number(p.lat),
    lon = Number(p.lon);
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) throw bad('bad coordinates');
  if (!types.includes(p.type)) throw bad('bad type');
  const names = (p.names || [])
    .map((n) => ({ lang: String(n.lang || ''), name: oneLine(n.name, 200) }))
    .filter((n) => n.name);
  names.forEach((n) => {
    if (!codes.includes(n.lang)) throw bad(`language "${n.lang}" is not in the list; ask an administrator to add it`);
  });
  if (!names.length) throw bad('at least one name is required');
  let from = null,
    to = null,
    height = null;
  if (p.type === 'mountain') {
    const h = p.height_m;
    if (h !== null && h !== undefined && h !== '') {
      height = typeof h === 'number' ? h : typeof h === 'string' && h.trim() !== '' ? Number(h) : NaN;
      if (!Number.isInteger(height) || height < 0 || height > MAX_HEIGHT_M)
        throw bad('height must be a whole number of metres from 0 to ' + MAX_HEIGHT_M);
    }
  } else {
    from = D.dateClean(p.date_from === undefined ? null : p.date_from, 'begin date');
    to = D.dateClean(p.date_to === undefined ? null : p.date_to, 'end date');
    D.dateOrderCheck(from, to);
  }
  return {
    lat,
    lon,
    props: {
      label: (names.find((n) => n.lang === 'en') || names[0]).name,
      type: p.type,
      date_from: from,
      date_to: to,
      height_m: height,
      names,
    },
  };
}
function save(inp) {
  migrate();
  const codes = langLoad().map((l) => l.code), // the only languages a name or note may use
    types = typeLoad().map((t) => t.code); // the only place types a place may use
  // a new place may join layers at once: "layer_ids" (a list) and/or "layer_id" (one); checked before anything is written
  const joins = [];
  if (inp.place) {
    const want = inp.layer_ids === undefined ? [] : inp.layer_ids;
    if (!Array.isArray(want)) throw bad('layer_ids must be a list');
    const all = want.slice();
    if (inp.layer_id) all.push(String(inp.layer_id));
    const ld = layersData();
    all.forEach((x) => {
      if (typeof x !== 'string' || !UUID.test(x) || layerIndex(ld, x) < 0) throw bad('unknown layer');
      if (!joins.includes(x)) joins.push(x);
    });
  }
  // the layers a note is tied to (when the request says so): the place must be a member, or join in this request
  let tags = null;
  if (inp.note && typeof inp.note === 'object' && 'layers' in inp.note)
    tags = cleanNoteLayers(inp.note.layers, inp.place_id || (inp.place_update || {}).id || null, joins);
  fs.mkdirSync(ARCH, { recursive: true });
  const fc = JSON.parse(fs.readFileSync(GEO, 'utf8'));
  let pid = inp.place_id || null;
  if (inp.place) {
    const c = cleanPlace(inp.place, codes, types);
    pid = crypto.randomUUID();
    fs.copyFileSync(GEO, archivePath('places', 'geojson'));
    fc.features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { id: pid, ...c.props },
    });
    writeAtomic(GEO, JSON.stringify(fc, null, 1));
    joins.forEach((lid) => changeMembers(lid, [pid], [])); // the place stays in the general layer as well
  } else if (inp.place_update) {
    // change an existing place: position, names, type, dates (its id never changes)
    const u = inp.place_update,
      c = cleanPlace(u, codes, types),
      f = fc.features.find((x) => x.properties.id === String(u.id || ''));
    if (!f) throw bad('unknown place');
    pid = f.properties.id;
    fs.copyFileSync(GEO, archivePath('places', 'geojson'));
    f.geometry = { type: 'Point', coordinates: [c.lon, c.lat] };
    f.properties = Object.assign({}, f.properties, c.props);
    writeAtomic(GEO, JSON.stringify(fc, null, 1));
  } else if (!fc.features.some((f) => f.properties.id === pid)) throw bad('unknown place');
  if (inp.note) {
    const n = inp.note,
      { lang, title, text, date } = cleanNote(n, codes);
    const dir = path.join(NOTES, pid);
    fs.mkdirSync(dir, { recursive: true });
    let nid = String(n.id || ''),
      kept = [];
    if (nid) {
      // edit an existing note
      if (!UUID.test(nid) || !fs.existsSync(path.join(dir, nid + '.md'))) throw bad('unknown note');
      kept = layerIds(noteMeta(path.join(dir, nid + '.md')).layers);
      fs.copyFileSync(path.join(dir, nid + '.md'), archivePath(`note-${pid}-${nid}`, 'md'));
    } else nid = crypto.randomUUID(); // new note: any number per place and language
    writeAtomic(path.join(dir, nid + '.md'), noteFile(nid, lang, title, date, text, tags === null ? kept : tags));
  }
  rebuildIndex();
  return pid;
}
function rebuildIndex() {
  // regenerate notes/index.json from the .md files
  const out = [];
  for (const place of fs.readdirSync(NOTES).sort()) {
    if (!UUID.test(place)) continue;
    for (const fn of fs.readdirSync(path.join(NOTES, place)).sort()) {
      if (!fn.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(NOTES, place, fn), 'utf8'),
        end = raw.indexOf('\n---\n', 3);
      if (!raw.startsWith('---\n') || end < 0) continue;
      const meta = parseMeta(raw.slice(4, end));
      out.push({
        id: meta.id || fn.slice(0, -3),
        place,
        lang: meta.lang || fn.slice(0, -3),
        title: meta.title || '',
        layers: layerIds(meta.layers),
        date: noteDate(meta),
        text: raw.slice(end + 5).trim(),
      });
    }
  }
  writeAtomic(path.join(NOTES, 'index.json'), JSON.stringify({ version: 1, notes: out }, null, 1));
}
// Brings the data up to date; safe to repeat. Every file that is replaced is copied to the archive first.
//  1. old notes <place>/<lang>.md  ->  <place>/<note-id>.md
//  2. old dates (year number + wording + "approximate" flag)  ->  the date model of app/js/core/dates.js
//  3. the language dictionary (languages.json) is created from the languages already in use
function migrate() {
  const count = migrateNoteFiles() + migratePlaceDates() + migrateNoteDates();
  langLoad();
  if (count) rebuildIndex();
  return count;
}
// Places: date_from/date_to numbers + *_text + approx  ->  date objects (or null); a mountain gets a height, no dates.
function migratePlaceDates() {
  const fc = readJSON(GEO, null);
  if (!fc || !Array.isArray(fc.features)) return 0;
  const drop = ['id', 'label', 'type', 'date_from', 'date_to', 'height_m', 'names', 'approx', 'date_from_text', 'date_to_text'];
  let n = 0;
  fc.features.forEach((f) => {
    const p = f.properties;
    const legacy =
      'approx' in p ||
      'date_from_text' in p ||
      'date_to_text' in p ||
      !('height_m' in p) ||
      (p.date_from != null && typeof p.date_from !== 'object') ||
      (p.date_to != null && typeof p.date_to !== 'object') ||
      Number.isInteger((p.date_from || {}).ts) || // time stamps as seconds -> ISO 8601 text
      Number.isInteger((p.date_to || {}).ts);
    if (!legacy) return;
    const mountain = p.type === 'mountain',
      conv = (v, text) => (v && typeof v === 'object' ? D.dateUpgrade(v) : D.legacyToDate(v, text || '', !!p.approx)),
      rest = {};
    Object.keys(p).forEach((k) => drop.includes(k) || (rest[k] = p[k]));
    f.properties = {
      id: p.id,
      label: p.label || '',
      type: p.type,
      date_from: mountain ? null : conv(p.date_from, p.date_from_text),
      date_to: mountain ? null : conv(p.date_to, p.date_to_text),
      height_m: mountain && p.height_m != null ? p.height_m : null,
      names: p.names || [],
      ...rest,
    };
    n++;
  });
  if (n) {
    fc.version = 3; // 3 = dates with ISO 8601 time stamps
    fs.mkdirSync(ARCH, { recursive: true });
    fs.copyFileSync(GEO, path.join(ARCH, `places-${stampNow()}-before-dates.geojson`));
    writeAtomic(GEO, JSON.stringify(fc, null, 1));
  }
  return n;
}
// Notes: "year:" + "when:" header lines  ->  one "date:" line (or none when no date can be read).
function migrateNoteDates() {
  if (!fs.existsSync(NOTES)) return 0;
  let count = 0;
  for (const place of fs.readdirSync(NOTES)) {
    if (!UUID.test(place) || !fs.statSync(path.join(NOTES, place)).isDirectory()) continue;
    for (const fn of fs.readdirSync(path.join(NOTES, place))) {
      if (!fn.endsWith('.md') || !UUID.test(fn.slice(0, -3))) continue;
      const file = path.join(NOTES, place, fn),
        raw = fs.readFileSync(file, 'utf8'),
        end = raw.indexOf('\n---\n', 3);
      if (!raw.startsWith('---\n') || end < 0) continue;
      const meta = parseMeta(raw.slice(4, end));
      let seconds = false;
      try {
        seconds = Number.isInteger(JSON.parse(meta.date).ts);
      } catch (e) {}
      if (!(meta.year !== undefined && meta.date === undefined) && !seconds) continue; // nothing to convert
      fs.mkdirSync(ARCH, { recursive: true });
      fs.copyFileSync(file, path.join(ARCH, `legacy-dates-${place}-${fn}`));
      const d = noteDate(meta);
      writeAtomic(
        file,
        `---\nid: ${meta.id || fn.slice(0, -3)}\nlang: ${meta.lang || ''}\ntitle: ${meta.title || ''}\n${meta.layers ? `layers: ${meta.layers}\n` : ''}${d ? `date: ${JSON.stringify(d)}\n` : ''}---\n${raw.slice(end + 5)}`
      );
      count++;
    }
  }
  return count;
}
// Old notes were <place>/<lang>.md; they become <place>/<note-id>.md with a lang: header.
function migrateNoteFiles() {
  if (!fs.existsSync(NOTES)) return 0;
  let count = 0;
  for (const place of fs.readdirSync(NOTES)) {
    if (!UUID.test(place) || !fs.statSync(path.join(NOTES, place)).isDirectory()) continue;
    for (const fn of fs.readdirSync(path.join(NOTES, place))) {
      const stem = fn.slice(0, -3);
      if (!fn.endsWith('.md') || UUID.test(stem) || !LANG.test(stem)) continue;
      const raw = fs.readFileSync(path.join(NOTES, place, fn), 'utf8'),
        end = raw.indexOf('\n---\n', 3);
      if (!raw.startsWith('---\n') || end < 0) continue;
      const meta = {};
      raw
        .slice(4, end)
        .split('\n')
        .forEach((l) => {
          const i = l.indexOf(': ');
          if (i > 0) meta[l.slice(0, i)] = l.slice(i + 2);
        });
      const id = UUID.test(meta.id || '') ? meta.id : crypto.randomUUID();
      writeAtomic(
        path.join(NOTES, place, id + '.md'),
        `---\nid: ${id}\nlang: ${stem}\ntitle: ${meta.title || ''}\nyear: ${parseInt(meta.year || '0', 10)}\n---\n${raw.slice(end + 5)}`
      );
      fs.mkdirSync(ARCH, { recursive: true });
      fs.renameSync(path.join(NOTES, place, fn), path.join(ARCH, `legacy-${place}-${fn}`));
      count++;
    }
  }
  return count;
}
migrate();
// ---------------- categories and layers: same rules as service/store.php (read the comment there for the model) ----------------
const SHAPES_FILE = path.join(DATA, 'shapes.geojson'),
  CAT_FILE = path.join(DATA, 'categories.json'),
  LAYERS_FILE = path.join(DATA, 'layers.json'),
  LNOTES = path.join(DATA, 'layer-notes');
const COLOR = /^#[0-9a-fA-F]{6}$/,
  MAX_DESC = 5000;
const nowUtc = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
// A unique file name in the archive (a second change in the same second must not overwrite the first copy).
function archivePath(stem, ext) {
  fs.mkdirSync(ARCH, { recursive: true });
  const base = path.join(ARCH, `${stem}-${stampNow()}`);
  let c = `${base}.${ext}`;
  for (let i = 1; fs.existsSync(c); i++) c = `${base}-${i}.${ext}`;
  return c;
}
const listData = (file, key) => {
  const d = readJSON(file, null);
  return d && Array.isArray(d[key]) ? d : { version: 1, [key]: [] };
};
const putList = (file, stem, d) => {
  if (fs.existsSync(file)) fs.copyFileSync(file, archivePath(stem, 'json'));
  writeAtomic(file, JSON.stringify(d, null, 1));
};
const categoriesData = () => listData(CAT_FILE, 'categories'),
  layersData = () => listData(LAYERS_FILE, 'layers'),
  layerIndex = (d, id) => d.layers.findIndex((l) => l.id === id);
// Checks the language, title, text and date of a note (place note or layer note).
function cleanNote(n, codes) {
  const lang = String(n.lang || ''),
    text = String(n.text || '').trim(),
    title = String(n.title || '')
      .replace(/\s+/g, ' ')
      .trim();
  if (!LANG.test(lang) || !title || !text) throw bad('a note needs a language, a title and a text');
  if (!codes.includes(lang)) throw bad(`language "${lang}" is not in the list; ask an administrator to add it`);
  return { lang, title, text, date: D.dateClean(n.date === undefined ? null : n.date, 'note date') }; // the date is optional
}
// A list of {lang, name} (several per language allowed); every language must be in the dictionary.
function cleanNames(list, codes, noneMsg) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((n) => {
    const nm = n && typeof n === 'object' ? oneLine(n.name, 200) : '',
      lg = n && typeof n === 'object' ? String(n.lang || '') : '';
    if (!nm) return;
    if (!codes.includes(lg)) throw bad(`language "${lg}" is not in the list; ask an administrator to add it`);
    out.push({ lang: lg, name: nm });
  });
  if (!out.length) throw bad(noneMsg);
  return out;
}
// Administrators only: adds a category, or changes the names of one. Returns its id.
function saveCategory(inp) {
  const names = cleanNames(inp.names, langLoad().map((l) => l.code), 'a category needs at least one name'),
    d = categoriesData();
  let id = String(inp.id || '');
  if (id) {
    const c = d.categories.find((x) => x.id === id);
    if (!UUID.test(id) || !c) throw bad('unknown category');
    c.names = names;
  } else {
    id = crypto.randomUUID();
    d.categories.push({ id, names });
  }
  putList(CAT_FILE, 'categories', d);
  return id;
}
function cleanLayer(inp, codes) {
  const names = cleanNames(inp.names, codes, 'a layer needs at least one name'),
    descriptions = [],
    seen = new Set();
  (Array.isArray(inp.descriptions) ? inp.descriptions : []).forEach((x) => {
    const t = x && typeof x === 'object' ? String(x.text ?? '').replace(/\r\n/g, '\n').trim() : '',
      lg = x && typeof x === 'object' ? String(x.lang || '') : '';
    if (!t) return;
    if (!codes.includes(lg)) throw bad(`language "${lg}" is not in the list; ask an administrator to add it`);
    if (seen.has(lg)) throw bad(`a layer has one description per language ("${lg}" appears twice)`);
    if ([...t].length > MAX_DESC) throw bad(`a description can have at most ${MAX_DESC} characters`);
    seen.add(lg);
    descriptions.push({ lang: lg, text: t });
  });
  let category = inp.category === undefined || inp.category === '' ? null : inp.category;
  if (category !== null && (typeof category !== 'string' || !categoriesData().categories.some((c) => c.id === category)))
    throw bad('unknown category');
  let color = inp.color === undefined || inp.color === '' ? null : inp.color;
  if (color !== null && (typeof color !== 'string' || !COLOR.test(color))) throw bad('the colour must look like #aa3344');
  const from = D.dateClean(inp.date_from === undefined ? null : inp.date_from, 'begin date'),
    to = D.dateClean(inp.date_to === undefined ? null : inp.date_to, 'end date');
  D.dateOrderCheck(from, to);
  return { names, descriptions, category, color: color === null ? null : color.toLowerCase(), date_from: from, date_to: to };
}
// Creates a layer (no id; it starts with no places) or changes the fields of one (its places stay). Returns the id.
function saveLayer(inp) {
  const c = cleanLayer(inp, langLoad().map((l) => l.code)),
    d = layersData();
  let id = String(inp.id || '');
  const now = nowUtc();
  if (id) {
    const i = UUID.test(id) ? layerIndex(d, id) : -1;
    if (i < 0) throw bad('unknown layer');
    d.layers[i] = Object.assign({}, d.layers[i], c, { updated: now });
  } else {
    id = crypto.randomUUID();
    d.layers.push(Object.assign({ id }, c, { members: [], created: now, updated: now }));
  }
  putList(LAYERS_FILE, 'layers', d);
  return id;
}
const placeIds = () => new Set(((readJSON(GEO, { features: [] }).features) || []).map((f) => (f.properties || {}).id));
const shapeIds = () => new Set(((readJSON(SHAPES_FILE, { features: [] }).features) || []).map((f) => (f.properties || {}).id));
// Adds and/or removes members of one layer: places and shapes (borders), both given as ids. Returns the new number of members.
function changeMembers(lid, add, remove) {
  const d = layersData(),
    i = UUID.test(String(lid)) ? layerIndex(d, lid) : -1;
  if (i < 0) throw bad('unknown layer');
  const places = placeIds(),
    shapes = shapeIds(),
    kind = new Map(d.layers[i].members.map((m) => [m.place || m.shape, m.shape ? 'shape' : 'place']));
  let members = d.layers[i].members.map((m) => m.place || m.shape),
    changed = false;
  add.forEach((p) => {
    if (typeof p !== 'string' || !(places.has(p) || shapes.has(p))) throw bad('unknown place or border');
    if (!members.includes(p)) {
      members.push(p); // appended: the order of the list is the order of adding
      kind.set(p, places.has(p) ? 'place' : 'shape');
      changed = true;
    }
  });
  const removed = [];
  remove.forEach((p) => {
    const k = members.indexOf(p);
    if (k >= 0) {
      members.splice(k, 1);
      removed.push(p);
      changed = true;
    }
  });
  if (changed) {
    d.layers[i].members = members.map((id) => ({ [kind.get(id)]: id }));
    d.layers[i].updated = nowUtc();
    putList(LAYERS_FILE, 'layers', d);
    const gone = removed.filter((p) => kind.get(p) === 'place');
    gone.forEach((p) => untagNotes(lid, p)); // a place that left the layer keeps its notes, but they are no longer tied to it
    if (gone.length) rebuildIndex();
  }
  return members.length;
}
// Takes the layer id out of the "layers:" header of the notes of one place (or of all places when pid is null).
function untagNotes(lid, pid = null) {
  if (!fs.existsSync(NOTES)) return;
  for (const pl of pid === null ? fs.readdirSync(NOTES) : [pid]) {
    const dir = path.join(NOTES, pl);
    if (!UUID.test(pl) || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const fn of fs.readdirSync(dir)) {
      if (!fn.endsWith('.md')) continue;
      const file = path.join(dir, fn),
        raw = fs.readFileSync(file, 'utf8'),
        end = raw.indexOf('\n---\n', 3);
      if (!raw.startsWith('---\n') || end < 0) continue;
      const ids = layerIds(parseMeta(raw.slice(4, end)).layers);
      if (!ids.includes(lid)) continue;
      fs.copyFileSync(file, archivePath(`note-${pl}-${fn.slice(0, -3)}-untag`, 'md'));
      const head = raw
          .slice(4, end)
          .split('\n')
          .filter((l) => !l.startsWith('layers: '))
          .join('\n'),
        rest = ids.filter((x) => x !== lid);
      writeAtomic(file, `---\n${head}\n${rest.length ? `layers: ${rest.join(',')}\n` : ''}---\n${raw.slice(end + 5)}`);
    }
  }
}
// Checks the layers of a place note: they must exist and the place must be a member of each (or join it in the same request).
function cleanNoteLayers(ids, pid, joining = []) {
  if (!Array.isArray(ids)) throw bad('layers must be a list');
  const d = layersData(),
    out = [];
  ids.forEach((id) => {
    const i = typeof id === 'string' && UUID.test(id) ? layerIndex(d, id) : -1;
    if (i < 0) throw bad('unknown layer');
    if (!joining.includes(id) && (pid === null || !d.layers[i].members.some((m) => m.place === pid)))
      throw bad(`the place is not in the layer "${d.layers[i].names[0].name}"; add it to the layer first`);
    if (!out.includes(id)) out.push(id);
  });
  return out;
}
function saveMembers(inp) {
  ['add', 'remove'].forEach((k) => {
    if (inp[k] !== undefined && !Array.isArray(inp[k])) throw bad(`"${k}" must be a list of place or border ids`);
  });
  return changeMembers(String(inp.id || ''), inp.add || [], inp.remove || []);
}
// Adds or edits a note of a layer itself (not of a place): {layer_id, note: {id?, lang, title, date, text}}. Returns its id.
function saveLayerNote(inp) {
  const codes = langLoad().map((l) => l.code),
    lid = String(inp.layer_id || '');
  // the owner of a layer note is a layer or a shape (a border or a route); both ids are UUIDs, so they never clash
  if (!UUID.test(lid) || (layerIndex(layersData(), lid) < 0 && !shapeIds().has(lid))) throw bad('unknown layer or border');
  const n = inp.note;
  if (!n || typeof n !== 'object') throw bad('a note is required');
  const { lang, title, text, date } = cleanNote(n, codes),
    dir = path.join(LNOTES, lid);
  fs.mkdirSync(dir, { recursive: true });
  let nid = String(n.id || '');
  if (nid) {
    if (!UUID.test(nid) || !fs.existsSync(path.join(dir, nid + '.md'))) throw bad('unknown note');
    fs.copyFileSync(path.join(dir, nid + '.md'), archivePath(`layer-note-${lid}-${nid}`, 'md'));
  } else nid = crypto.randomUUID();
  writeAtomic(path.join(dir, nid + '.md'), noteFile(nid, lang, title, date, text));
  rebuildLayerNotesIndex();
  return nid;
}
// layer-notes/index.json: generated from the note files, used for showing and searching.
function rebuildLayerNotesIndex() {
  fs.mkdirSync(LNOTES, { recursive: true });
  const out = [];
  for (const ly of fs.readdirSync(LNOTES).sort()) {
    if (!UUID.test(ly) || !fs.statSync(path.join(LNOTES, ly)).isDirectory()) continue;
    for (const fn of fs.readdirSync(path.join(LNOTES, ly)).sort()) {
      if (!fn.endsWith('.md')) continue;
      const raw = fs.readFileSync(path.join(LNOTES, ly, fn), 'utf8'),
        end = raw.indexOf('\n---\n', 3);
      if (!raw.startsWith('---\n') || end < 0) continue;
      const meta = parseMeta(raw.slice(4, end));
      out.push({
        id: meta.id || fn.slice(0, -3),
        layer: ly,
        lang: meta.lang || '',
        title: meta.title || '',
        date: noteDate(meta),
        text: raw.slice(end + 5).trim(),
      });
    }
  }
  writeAtomic(path.join(LNOTES, 'index.json'), JSON.stringify({ version: 1, notes: out }, null, 1));
}
// Moves every note of an owner (a layer or a shape) to the archive and rebuilds the index. Nothing happens when it has no notes.
function archiveLayerNotes(id) {
  const dir = path.join(LNOTES, id);
  if (!fs.existsSync(dir)) return;
  for (const fn of fs.readdirSync(dir))
    if (fn.endsWith('.md')) fs.renameSync(path.join(dir, fn), archivePath(`layer-note-${id}-${fn.slice(0, -3)}`, 'md'));
  fs.rmdirSync(dir);
  rebuildLayerNotesIndex();
}
// Administrators only. Removes a layer; its places and their notes stay in the general layer. Returns true.
function deleteLayer(id) {
  const d = layersData(),
    i = UUID.test(String(id)) ? layerIndex(d, id) : -1;
  if (i < 0) throw bad('unknown layer');
  d.layers.splice(i, 1);
  putList(LAYERS_FILE, 'layers', d); // the copy in the archive still has the layer and its members
  archiveLayerNotes(id);
  untagNotes(id);
  rebuildIndex();
  return true;
}
// One of {layer}, {layer_members}, {layer_note}. Returns what the browser needs.
function layerSave(inp) {
  if (inp.layer && typeof inp.layer === 'object') return { id: saveLayer(inp.layer) };
  if (inp.layer_members && typeof inp.layer_members === 'object') return { members: saveMembers(inp.layer_members) };
  if (inp.layer_note && typeof inp.layer_note === 'object') return { id: saveLayerNote(inp.layer_note) };
  throw bad('nothing to save');
}
// ---------------- shapes: borders and routes (same rules as service/store.php) ----------------
// data/shapes.geojson: one feature per shape. Geometry: Polygon, MultiPolygon, LineString or MultiLineString. Properties: id, names, type,
// color, opacity (the fill of an area, the line of a line), label (draw the name on the map), date_from, date_to, source, created, updated.
const ROUTE_TYPES = ['trade', 'military', 'migration', 'journey', 'road'];
const SHAPE_TYPES = ['country', 'kingdom', 'region', 'district', 'territory', 'disputed', 'river', ...ROUTE_TYPES];
const SHAPE_GEOMS = ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'];
const MAX_SHAPE_POINTS = 20000,
  SOURCE = /^[A-Za-z0-9:_./ -]{0,100}$/;
const readShapes = () => {
  const d = readJSON(SHAPES_FILE, null);
  return d && Array.isArray(d.features) ? d : { type: 'FeatureCollection', features: [] };
};
// One feature per line: a change in git shows as a change of one line, not of thousands of numbers.
const putShapes = (d) => {
  if (fs.existsSync(SHAPES_FILE)) fs.copyFileSync(SHAPES_FILE, archivePath('shapes', 'geojson'));
  writeAtomic(SHAPES_FILE, '{"type":"FeatureCollection","features":[\n' + d.features.map((f) => JSON.stringify(f)).join(',\n') + '\n]}\n');
};
function cleanGeometry(g) {
  if (!g || typeof g !== 'object' || !SHAPE_GEOMS.includes(g.type) || !Array.isArray(g.coordinates))
    throw bad('a border needs a Polygon, MultiPolygon, LineString or MultiLineString geometry');
  let n = 0;
  const pt = (c) => {
      if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)
        throw bad('a coordinate is out of range (longitude -180..180, latitude -90..90)');
      n++;
      return [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];
    },
    line = (l, min) => {
      if (!Array.isArray(l) || l.length < min) throw bad(`a line needs at least ${min} points`);
      return l.map(pt);
    },
    ring = (r) => {
      const q = line(r, 4);
      if (q[0][0] !== q[q.length - 1][0] || q[0][1] !== q[q.length - 1][1]) throw bad('an area outline must be closed');
      return q;
    },
    poly = (p) => {
      if (!Array.isArray(p) || !p.length) throw bad('an area needs an outline');
      return p.map(ring);
    },
    many = (a, f) => {
      if (!a.length) throw bad('the geometry is empty');
      return a.map(f);
    };
  const c = g.coordinates,
    coordinates =
      g.type === 'Polygon' ? poly(c) : g.type === 'MultiPolygon' ? many(c, poly) : g.type === 'LineString' ? line(c, 2) : many(c, (l) => line(l, 2));
  if (n > MAX_SHAPE_POINTS) throw bad(`a border can have at most ${MAX_SHAPE_POINTS} points (it has ${n}); simplify it`);
  return { type: g.type, coordinates };
}
function cleanShape(inp, codes, places) {
  const names = cleanNames(inp.names, codes, 'a border needs at least one name');
  if (!SHAPE_TYPES.includes(inp.type)) throw bad('unknown border type');
  if (typeof inp.color !== 'string' || !COLOR.test(inp.color)) throw bad('the colour must look like #aa3344');
  const opacity = Number(inp.opacity);
  if (!(opacity >= 0 && opacity <= 1)) throw bad('the opacity must be between 0 and 1');
  if (typeof inp.label !== 'boolean') throw bad('"label" must be true or false');
  // width: the line width in pixels, 0.5 to 12. Absent = unchanged (a new shape then uses the width of its type).
  if ('width' in inp && (typeof inp.width === 'boolean' || inp.width === null || inp.width === '' || !(Number(inp.width) >= 0.5 && Number(inp.width) <= 12))) throw bad('the width must be between 0.5 and 12');
  const source = inp.source === undefined || inp.source === null ? '' : String(inp.source);
  if (!SOURCE.test(source)) throw bad('the source is too long or has unusual characters');
  const from = D.dateClean(inp.date_from === undefined ? null : inp.date_from, 'begin date'),
    to = D.dateClean(inp.date_to === undefined ? null : inp.date_to, 'end date');
  D.dateOrderCheck(from, to);
  const out = { names, type: inp.type, color: inp.color.toLowerCase(), opacity: Math.round(opacity * 100) / 100, label: inp.label, date_from: from, date_to: to, source };
  if ('width' in inp) out.width = Math.round(Number(inp.width) * 10) / 10;
  if (ROUTE_TYPES.includes(inp.type)) {
    // stops: the places the route passes, in order (ids of existing places; at most 60). twoway: usable both ways. Absent = unchanged.
    if (inp.stops !== undefined) {
      if (!Array.isArray(inp.stops) || inp.stops.length > 60 || inp.stops.some((id) => typeof id !== 'string' || !places.has(id))) throw bad('unknown place among the route stops');
      out.stops = inp.stops;
    }
    if (inp.twoway !== undefined) {
      if (typeof inp.twoway !== 'boolean') throw bad('twoway must be true or false');
      out.twoway = inp.twoway;
    }
  }
  return out;
}
// A route is a line: refuses an area for a route type.
const routeGeomCheck = (type, g) => {
  if (ROUTE_TYPES.includes(type) && !/^(Multi)?LineString$/.test(g.type)) throw bad('a route must be a line');
};
// Creates a shape (no id; geometry required) or changes one (geometry only when given). Returns the id.
function saveShape(inp) {
  const c = cleanShape(inp, langLoad().map((l) => l.code), placeIds()),
    d = readShapes(),
    now = nowUtc();
  let id = String(inp.id || '');
  if (id) {
    const f = UUID.test(id) ? d.features.find((x) => x.properties.id === id) : null;
    if (!f) throw bad('unknown border');
    if (inp.geometry !== undefined) f.geometry = cleanGeometry(inp.geometry);
    routeGeomCheck(c.type, f.geometry);
    f.properties = Object.assign({}, f.properties, c, { updated: now });
  } else {
    id = crypto.randomUUID();
    const geometry = cleanGeometry(inp.geometry);
    routeGeomCheck(c.type, geometry);
    d.features.push({ type: 'Feature', geometry, properties: Object.assign({ id }, c, { created: now, updated: now }) });
  }
  putShapes(d);
  return id;
}
// Deletes a shape; the archive keeps the old file. The shape leaves every layer.
function deleteShape(id) {
  const d = readShapes(),
    i = UUID.test(String(id)) ? d.features.findIndex((x) => x.properties.id === id) : -1;
  if (i < 0) throw bad('unknown border');
  d.features.splice(i, 1);
  putShapes(d);
  const ls = layersData();
  let changed = false;
  ls.layers.forEach((l) => {
    const keep = l.members.filter((m) => m.shape !== id);
    if (keep.length !== l.members.length) {
      l.members = keep;
      l.updated = nowUtc();
      changed = true;
    }
  });
  if (changed) putList(LAYERS_FILE, 'layers', ls);
  archiveLayerNotes(id); // the notes of the shape go to the archive with it
  return true;
}
// ---------------- historical map images (overlays): same rules as service/store.php ----------------
const OVJ = path.join(DATA, 'overlays.json'),
  OVDIR = path.join(DATA, 'overlays'),
  IMG_MAX = 12 * 1024 * 1024;
const readOv = () => {
  try {
    const d = JSON.parse(fs.readFileSync(OVJ, 'utf8'));
    if (Array.isArray(d.overlays)) return d;
  } catch (e) {}
  return { version: 1, overlays: [] };
};
const writeOv = (d) => writeAtomic(OVJ, JSON.stringify(d, null, 1));
function sniff(b) {
  if (b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
function cleanOv(inp) {
  const title = String(inp.title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!title) throw bad('a title is required');
  const co = inp.coordinates;
  if (!Array.isArray(co) || co.length !== 4) throw bad('four corner coordinates are required');
  const coordinates = co.map((c) => {
    const lon = Number(c && c[0]),
      lat = Number(c && c[1]);
    if (!isFinite(lon) || !isFinite(lat)) throw bad('bad coordinates');
    if (lon < -180 || lon > 180 || lat < -85.06 || lat > 85.06) throw bad('coordinates out of range');
    return [lon, lat];
  });
  const minzoom = Number(inp.minzoom ?? 0),
    maxzoom = Number(inp.maxzoom ?? 24),
    opacity = Number(inp.opacity ?? 0.6);
  if (!(minzoom >= 0 && maxzoom <= 24 && minzoom < maxzoom)) throw bad('zoom range must satisfy 0 <= from < to <= 24');
  if (!(opacity >= 0 && opacity <= 1)) throw bad('opacity must be between 0 and 1');
  return { title, coordinates, minzoom, maxzoom, opacity };
}
function ovSave(inp) {
  const d = readOv(),
    c = cleanOv(inp),
    now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  let id = String(inp.id || '');
  if (id) {
    const i = d.overlays.findIndex((o) => o.id === id);
    if (!UUID.test(id) || i < 0) throw bad('unknown overlay');
    d.overlays[i] = Object.assign({}, d.overlays[i], c, { updated: now });
  } else {
    id = crypto.randomUUID();
    d.overlays.push(Object.assign({ id, file: '', created: now }, c, { updated: now }));
  }
  writeOv(d);
  return id;
}
function ovImage(id, buf) {
  if (!UUID.test(id)) throw bad('bad id');
  if (!buf.length || buf.length > IMG_MAX) throw bad('image missing or larger than 12 MB');
  const ext = sniff(buf);
  if (!ext) throw bad('only PNG, JPEG or WebP images are accepted');
  const d = readOv(),
    o = d.overlays.find((x) => x.id === id);
  if (!o) throw bad('unknown overlay');
  fs.mkdirSync(OVDIR, { recursive: true });
  fs.mkdirSync(ARCH, { recursive: true });
  const file = id + '.' + ext;
  writeAtomic(path.join(OVDIR, file), buf);
  if (o.file && o.file !== file && fs.existsSync(path.join(OVDIR, o.file)))
    fs.renameSync(path.join(OVDIR, o.file), path.join(ARCH, 'overlay-' + Date.now() + '-' + o.file));
  o.file = file;
  o.updated = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  writeOv(d);
  return file;
}
function ovDelete(id) {
  if (!UUID.test(id)) throw bad('bad id');
  const d = readOv(),
    o = d.overlays.find((x) => x.id === id);
  if (!o) throw bad('unknown overlay');
  fs.mkdirSync(ARCH, { recursive: true });
  if (o.file && fs.existsSync(path.join(OVDIR, o.file)))
    fs.renameSync(path.join(OVDIR, o.file), path.join(ARCH, 'overlay-' + Date.now() + '-' + o.file));
  d.overlays = d.overlays.filter((x) => x.id !== id);
  writeOv(d);
  return true;
}
function readBody(req, cap) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > cap) {
        reject(new Error('too large'));
        req.destroy();
      } else parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}
const send = (res, code, obj) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
};
// One JSON POST: reads the body, runs fn(parsedBody) and answers { ok: true, ...result } or { error }.
const jsonPost = (req, res, fn) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let inp = null;
    try {
      inp = JSON.parse(body);
    } catch (e) {
      /* not JSON: refused below, like the PHP controller */
    }
    if (inp === null || typeof inp !== 'object' || Array.isArray(inp)) return send(res, 400, { error: 'bad request' });
    try {
      send(res, 200, Object.assign({ ok: true }, fn(inp)));
    } catch (e) {
      send(res, e.status || 500, { error: e.message });
    }
  });
};
const saveNotes = (req, res, next) => {
  if (!req.url.startsWith('/api/save')) return next();
  jsonPost(req, res, (inp) => ({ id: save(inp) }));
};
module.exports = (req, res, next) => {
  const url = req.url.split('?')[0];
  if (url === '/api/language/save') return jsonPost(req, res, (inp) => ({ code: saveLang(inp) })); // admins only in the forum
  if (url === '/api/type/save') return jsonPost(req, res, (inp) => ({ code: saveType(inp) })); // admins only in the forum
  if (url === '/api/type/delete') return jsonPost(req, res, (inp) => ({ ok: deleteType(String(inp.code || '')) })); // admins only in the forum
  if (url === '/api/layer/save') return jsonPost(req, res, (inp) => layerSave(inp)); // editors in the forum
  if (url === '/api/layer/delete') return jsonPost(req, res, (inp) => (deleteLayer(String(inp.id || '')), {})); // admins only in the forum
  if (url === '/api/shape/save') return jsonPost(req, res, (inp) => ({ id: saveShape(inp) })); // editors in the forum
  if (url === '/api/shape/delete') return jsonPost(req, res, (inp) => (deleteShape(String(inp.id || '')), {})); // editors in the forum
  if (url === '/api/category/save') return jsonPost(req, res, (inp) => ({ id: saveCategory(inp) })); // admins only in the forum
  if (!url.startsWith('/api/overlay/')) return saveNotes(req, res, next);
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  readBody(req, IMG_MAX + 4096)
    .then((buf) => {
      try {
        let m;
        if (url === '/api/overlay/save')
          return send(res, 200, { ok: true, id: ovSave(JSON.parse(buf.toString('utf8'))) });
        if (url === '/api/overlay/delete')
          return send(res, 200, {
            ok: ovDelete(String(JSON.parse(buf.toString('utf8')).id || '')),
          });
        if ((m = url.match(/^\/api\/overlay\/upload\/([0-9a-f-]{36})$/)))
          return send(res, 200, { ok: true, file: ovImage(m[1], buf) });
        send(res, 404, { error: 'not found' });
      } catch (e) {
        send(res, e.status || 500, { error: e.message });
      }
    })
    .catch(() => send(res, 413, { error: 'upload too large' }));
};
