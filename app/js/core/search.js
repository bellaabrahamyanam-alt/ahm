// Filtering, searching and sorting (types, names, notes, language, period) (core domain). No DOM: the sidebar passes the options in.
const state = { types: new Set(), certainty: new Set(), sources: new Set() }; // the filters of the Places tab (certainty and sources: T-046)
const byDateKey = (x, y) => {
  const a = dateKey(x.date_from),
    b = dateKey(y.date_from);
  return a === b ? 0 : a < b ? -1 : 1; // unknown dates last
};
/**
 * The places that pass the filters, with their note hits, sorted. INTERFACES.md I-3.
 * options: q = search text, lang = language code or '' for all, sort = 'name' | 'date',
 * period = [start, end) in seconds, each null when not set, certainty / sources = Sets (T-046, empty = all). Types and layer filters come from `state` and `lyState`.
 */
function run({ q: text = '', lang: l = '', sort = 'name', period: [a, b] = [null, null], certainty = new Set(), sources: srcs = new Set() } = {}) {
  const q = norm(text),
    byDate = sort === 'date';
  return places
    .map((p) => {
      if (state.types.size && !state.types.has(p.type)) return null;
      if (!layerAllows(p.id)) return null; // layer filters (layers.js)
      if (timeLook(p) === 'no') return null; // the time slider (T-040)
      if (!evidenceAllows(p, certainty, srcs)) return null; // certainty and source filters (T-046)
      const ns = (by[p.id] || []).filter((n) => !l || n.lang === l),
        nm = p.names.filter((n) => !l || n.lang === l);
      if (l && !ns.length && !nm.length) return null;
      if (a !== null || b !== null) {
        // a period filter keeps only places whose life is known and overlaps it
        if (!p.date_from && !p.date_to) return null;
        const [lo, hi] = spanBounds(p.date_from, p.date_to);
        if (a !== null && hi <= a) return null;
        if (b !== null && lo >= b) return null;
      }
      const nameHit = !q || nm.some((n) => norm(n.name).includes(q));
      const hits = q ? ns.filter((n) => norm(n.title + ' ' + n.text).includes(q)) : [];
      return nameHit || hits.length ? { p, hits } : null;
    })
    .filter(Boolean)
    .sort((x, y) => (byDate ? byDateKey(x.p, y.p) : label(x.p, 'en').localeCompare(label(y.p, 'en'))));
}
