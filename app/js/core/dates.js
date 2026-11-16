// Dates: ONE model used everywhere (places, notes, filters). Mirrored in service/dates.php; the dev server
// (dev/save-handler.js) loads this very file, so the browser and the dev back-end can never disagree.
//
// A date is either `null` (unknown, simply not set) or an object
//   { fmt: 'dmy', ts: '1500-03-21T00:00:00Z', mode: 'exact' | 'approx' | 'range', ts_to: null | <ts> }
// - ts / ts_to : UTC time stamp of the START of the period the person typed, in ISO 8601 / RFC 3339 text,
//                always with the "Z" (UTC) zone. A day is 00:00:00Z of that day, a month its 1st, a year 1 January,
//                a century its first year (12th century BCE = 1200 BCE … 1101 BCE starts at 1200 BCE), a millennium likewise.
//                Years 0000–9999 are written with four digits, exactly as RFC 3339 wants. Outside that range (every BCE
//                date, because year 0000 is 1 BCE) ISO 8601's expanded form is used: a sign and six digits, for example
//                `-001199-01-01T00:00:00Z` = 1200 BCE and `+012000-01-01T00:00:00Z`. JavaScript's Date.parse reads both.
//                Inside this file times are compared as whole seconds since 1970-01-01T00:00:00Z (see isoToSec).
// - fmt        : the format the person chose. With `ts` it is enough to show the date again exactly as it was entered.
// - mode       : exact, approximate ("c. 800 BCE"), or a range (ts … ts_to, both in the same format).
// The calendar is the proleptic Gregorian one with year-numbering "1 BCE, 1 CE" (no year 0 for people). Julian dates
// are not converted: enter the date as written and treat it as Gregorian (see README, limitations).

const DATE_FORMATS = [
  { id: 'ymd', label: 'YYYY-MM-DD', example: '1500-03-21', fields: ['y', 'm', 'd'], sep: '-' },
  { id: 'dmy', label: 'DD.MM.YYYY', example: '21.03.1500', fields: ['d', 'm', 'y'], sep: '.' },
  { id: 'mdy', label: 'MM/DD/YYYY', example: '03/21/1500', fields: ['m', 'd', 'y'], sep: '/' },
  { id: 'dmony', label: 'D Month YYYY', example: '21 March 1500', fields: ['d', 'm', 'y'], sep: ' ', monthName: true },
  { id: 'mony', label: 'Month YYYY', example: 'March 1500', fields: ['m', 'y'], sep: ' ', monthName: true },
  { id: 'y', label: 'Year', example: '1500', fields: ['y'], sep: '' },
  { id: 'c', label: 'Century', example: '16th century', fields: ['n'], sep: '', word: 'century' },
  { id: 'm', label: 'Millennium', example: '2nd millennium', fields: ['n'], sep: '', word: 'millennium' },
];
const DATE_MODES = ['exact', 'approx', 'range'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY_SECONDS = 86400;
const MIN_ASTRO_YEAR = -100000,
  MAX_ASTRO_YEAR = 100000;

const dateErr = (m) => Object.assign(new Error(m), { status: 400 });
const dFloor = Math.floor;
const dMod = (a, b) => ((a % b) + b) % b;
const dateFormat = (id) => DATE_FORMATS.find((f) => f.id === id);

// ---- calendar arithmetic (integers only, works for any year; "astronomical" years: 1 BCE = 0) ----
function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = dFloor(y / 400),
    yoe = y - era * 400,
    doy = dFloor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1,
    doe = yoe * 365 + dFloor(yoe / 4) - dFloor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z) {
  z += 719468;
  const era = dFloor(z / 146097),
    doe = z - era * 146097,
    yoe = dFloor((doe - dFloor(doe / 1460) + dFloor(doe / 36524) - dFloor(doe / 146096)) / 365),
    doy = doe - (365 * yoe + dFloor(yoe / 4) - dFloor(yoe / 100)),
    mp = dFloor((5 * doy + 2) / 153),
    d = doy - dFloor((153 * mp + 2) / 5) + 1,
    m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}
const isLeap = (a) => dMod(a, 4) === 0 && (dMod(a, 100) !== 0 || dMod(a, 400) === 0);
const daysInMonth = (a, m) => (m === 2 ? (isLeap(a) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31);

// ---- ISO 8601 / RFC 3339 text  <->  seconds since 1970-01-01T00:00:00Z ----
const pad = (n, w) => String(n).padStart(w, '0');
/** 'YYYY-MM-DDTHH:MM:SSZ'; years outside 0000–9999 as ±YYYYYY (ISO 8601 expanded year, year 0000 = 1 BCE). */
function secToIso(sec) {
  const days = dFloor(sec / DAY_SECONDS),
    rem = sec - days * DAY_SECONDS,
    [a, m, d] = civilFromDays(days),
    y = a >= 0 && a <= 9999 ? pad(a, 4) : (a < 0 ? '-' : '+') + pad(Math.abs(a), 6);
  return `${y}-${pad(m, 2)}-${pad(d, 2)}T${pad(dFloor(rem / 3600), 2)}:${pad(dFloor((rem % 3600) / 60), 2)}:${pad(rem % 60, 2)}Z`;
}
const ISO_TS = /^(\d{4}|[+-]\d{6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
/** Seconds since 1970 for a canonical time stamp, or null when the text is not one (wrong shape, impossible day, no "Z", …). */
function isoToSec(s) {
  const m = typeof s === 'string' && s.match(ISO_TS);
  if (!m) return null;
  const a = Number(m[1]),
    mo = +m[2],
    d = +m[3],
    h = +m[4],
    mi = +m[5],
    se = +m[6];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(a, mo) || h > 23 || mi > 59 || se > 59) return null;
  const sec = daysFromCivil(a, mo, d) * DAY_SECONDS + h * 3600 + mi * 60 + se;
  return secToIso(sec) === s ? sec : null; // refuses "+000500-…" and "-000000-…": one way to write each moment
}

// ---- fields typed by a person  <->  time stamp ----
/** f = { era: 'CE'|'BCE', y, m, d } for day/month/year formats, { era, n } for century and millennium. Returns the ISO 8601 / RFC 3339 time stamp of the start. Throws a readable error. */
function dateToTs(fmt, f) {
  const F = dateFormat(fmt);
  if (!F) throw dateErr('Unknown date format.');
  if (f.era !== 'CE' && f.era !== 'BCE') throw dateErr('Choose CE or BCE.');
  const int = (v, lo, hi, what) => {
    const n = Number(v);
    if (String(v ?? '').trim() === '' || !Number.isInteger(n) || n < lo || n > hi)
      throw dateErr(`${what} must be a whole number from ${lo} to ${hi}.`);
    return n;
  };
  let a,
    m = 1,
    d = 1;
  if (F.word) {
    const k = fmt === 'c' ? 100 : 1000,
      n = int(f.n, 1, fmt === 'c' ? 1000 : 100, F.word === 'century' ? 'Century' : 'Millennium');
    a = f.era === 'CE' ? k * (n - 1) + 1 : -k * n + 1;
  } else {
    const y = int(f.y, 1, 99999, 'Year');
    a = f.era === 'CE' ? y : 1 - y;
    if (F.fields.includes('m')) m = int(f.m, 1, 12, 'Month');
    if (F.fields.includes('d')) {
      d = int(f.d, 1, 31, 'Day');
      if (d > daysInMonth(a, m)) throw dateErr(`There is no day ${d} in ${MONTHS[m - 1]} of that year.`);
    }
  }
  return secToIso(daysFromCivil(a, m, d) * DAY_SECONDS);
}
/** The reverse: { era, y, m, d, n } for an ISO time stamp (use the fields that belong to the format). */
function dateFromTs(fmt, ts) {
  const sec = isoToSec(ts);
  if (sec === null) throw dateErr('Not a valid time stamp.');
  const [a, m, d] = civilFromDays(dFloor(sec / DAY_SECONDS)),
    k = fmt === 'm' ? 1000 : 100;
  return {
    era: a >= 1 ? 'CE' : 'BCE',
    y: a >= 1 ? a : 1 - a,
    m,
    d,
    n: a >= 1 ? dFloor((a - 1) / k) + 1 : dFloor(-a / k) + 1,
  };
}
/** True when ts is exactly the start of a period of this format (a century starts on 1 Jan of year 1 mod 100, …). */
function dateAligned(fmt, ts) {
  const sec = isoToSec(ts);
  if (sec === null || dMod(sec, DAY_SECONDS) !== 0) return false;
  const [a, m, d] = civilFromDays(sec / DAY_SECONDS);
  if (a < MIN_ASTRO_YEAR || a > MAX_ASTRO_YEAR) return false;
  if (fmt === 'mony') return d === 1;
  if (fmt === 'y') return m === 1 && d === 1;
  if (fmt === 'c') return m === 1 && d === 1 && dMod(a - 1, 100) === 0;
  if (fmt === 'm') return m === 1 && d === 1 && dMod(a - 1, 1000) === 0;
  return true;
}
/** First second AFTER the period that starts at `sec` seconds (the end is exclusive). */
function periodEndSec(fmt, sec) {
  const [a, m] = civilFromDays(sec / DAY_SECONDS),
    jan = (y) => daysFromCivil(y, 1, 1) * DAY_SECONDS;
  if (fmt === 'mony') return m === 12 ? jan(a + 1) : daysFromCivil(a, m + 1, 1) * DAY_SECONDS;
  if (fmt === 'y') return jan(a + 1);
  if (fmt === 'c') return jan(a + 100);
  if (fmt === 'm') return jan(a + 1000);
  return sec + DAY_SECONDS;
}
/** The same for a time stamp text: the first moment AFTER the period that starts at ts, as a time stamp text. */
const datePeriodEnd = (fmt, ts) => secToIso(periodEndSec(fmt, isoToSec(ts)));

// ---- a whole date value ----
/** Dates saved by the first version of this model had `ts` as whole seconds (a number). Returns the same date with ISO time stamps. */
function dateUpgrade(d) {
  if (!d || typeof d !== 'object' || !Number.isInteger(d.ts)) return d;
  return { ...d, ts: secToIso(d.ts), ts_to: Number.isInteger(d.ts_to) ? secToIso(d.ts_to) : d.ts_to };
}
/** Checks a date as it arrives from a browser or a file. Returns the normalised date or null; throws a readable error. */
function dateClean(d, what) {
  what = what || 'Date';
  if (d === null || d === undefined) return null;
  if (typeof d !== 'object' || Array.isArray(d)) throw dateErr(`${what}: not a valid date.`);
  d = dateUpgrade(d);
  if (!dateFormat(d.fmt)) throw dateErr(`${what}: unknown date format.`);
  if (!DATE_MODES.includes(d.mode)) throw dateErr(`${what}: choose exact, approximate or range.`);
  if (!dateAligned(d.fmt, d.ts)) throw dateErr(`${what}: the time stamp does not match the chosen format.`);
  let to = null;
  if (d.mode === 'range') {
    if (!dateAligned(d.fmt, d.ts_to)) throw dateErr(`${what}: the end of the range does not match the chosen format.`);
    if (isoToSec(d.ts_to) <= isoToSec(d.ts)) throw dateErr(`${what}: the end of the range must be after its start.`);
    to = d.ts_to;
  } else if (d.ts_to !== null && d.ts_to !== undefined) throw dateErr(`${what}: only a range has an end.`);
  return { fmt: d.fmt, ts: d.ts, mode: d.mode, ts_to: to };
}
/** [from, to): the stretch of time a date can mean. A century is 100 years long, a range runs to the end of its last period. */
const dateBounds = (d) => [isoToSec(d.ts), periodEndSec(d.fmt, isoToSec(d.mode === 'range' ? d.ts_to : d.ts))];
/** A place exists from `from` to `to`, either may be unknown (open). Returns [lo, hi) with ±Infinity for open ends. */
const spanBounds = (from, to) => [from ? dateBounds(from)[0] : -Infinity, to ? dateBounds(to)[1] : Infinity];

// ---- the time slider (T-040) ----
const YEAR_SEC = 31556952; // 365.2425 days
/**
 * One item with `date_from` / `date_to` (a place, shape or layer) at the moment `at` (seconds): 'no' (outside its life), 'yes',
 * 'faded' (only possible: inside the period of an approximate date or inside a range) or 'undated' (no date at all; the caller decides).
 * An unknown end never hides (docs/05: unknown, not "still exists"), nor does an unknown start.
 */
function visibleAt(item, at) {
  const f = item.date_from,
    t = item.date_to;
  if (!f && !t) return 'undated';
  let look = 'yes';
  if (f) {
    const [lo, hi] = dateBounds(f);
    if (at < lo) return 'no';
    if (f.mode !== 'exact' && at < hi) look = 'faded';
  }
  if (t) {
    const [lo, hi] = dateBounds(t);
    if (at >= hi) return 'no';
    if (t.mode !== 'exact' && at >= lo) look = 'faded';
  }
  return look;
}
/** [earliest start, latest end] in seconds of the dated items, or null when no item has a date. */
function timeSpan(items) {
  let a = Infinity,
    b = -Infinity;
  for (const it of items)
    for (const d of [it.date_from, it.date_to])
      if (d) {
        const [lo, hi] = dateBounds(d);
        a = Math.min(a, lo);
        b = Math.max(b, hi);
      }
  return a === Infinity ? null : [a, b];
}
/** Play: `at` moved on by `speed` years per second for `dtMs` milliseconds, never past `end`; `done` when it got there. */
function timeAdvance(at, speed, dtMs, end) {
  const next = at + (speed * YEAR_SEC * dtMs) / 1000;
  return next >= end ? { at: end, done: true } : { at: next, done: false };
}
/** For the sidebar sort: unknown dates last. */
const dateKey = (d) => (d ? isoToSec(d.ts) : Infinity);
/** Throws when a "from" date lies after the end of a "to" date. */
function dateOrderCheck(from, to) {
  if (from && to && dateBounds(from)[0] >= dateBounds(to)[1]) throw dateErr('The “from” date is after the “to” date.');
}

// ---- showing a date ----
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]);
function dateOne(fmt, ts) {
  const f = dateFromTs(fmt, ts),
    p2 = (n) => String(n).padStart(2, '0'),
    y4 = String(f.y).padStart(4, '0'),
    era = f.era === 'BCE' ? ' BCE' : '';
  let s;
  if (fmt === 'ymd') s = `${y4}-${p2(f.m)}-${p2(f.d)}`;
  else if (fmt === 'dmy') s = `${p2(f.d)}.${p2(f.m)}.${y4}`;
  else if (fmt === 'mdy') s = `${p2(f.m)}/${p2(f.d)}/${y4}`;
  else if (fmt === 'dmony') s = `${f.d} ${MONTHS[f.m - 1]} ${f.y}`;
  else if (fmt === 'mony') s = `${MONTHS[f.m - 1]} ${f.y}`;
  else if (fmt === 'y') s = String(f.y);
  else s = `${ordinal(f.n)} ${fmt === 'c' ? 'century' : 'millennium'}`;
  return s + era;
}
/** "21.03.1500", "c. 800 BCE", "12th century BCE – 10th century BCE"; '' for an unknown date. */
function dateText(d) {
  if (!d) return '';
  if (d.mode === 'range') return dateOne(d.fmt, d.ts) + ' – ' + dateOne(d.fmt, d.ts_to);
  return (d.mode === 'approx' ? 'c. ' : '') + dateOne(d.fmt, d.ts);
}
/** The life of a place: "c. 840 BCE – 590 BCE", "from 335", "until 1236", '' when both are unknown. */
function spanText(from, to) {
  if (from && to) {
    // when an end is itself a range ("16th century – 17th century") the dash alone would be ambiguous
    if (from.mode === 'range' || to.mode === 'range') return 'from ' + dateText(from) + ' to ' + dateText(to);
    return dateText(from) + ' – ' + dateText(to);
  }
  if (from) return 'from ' + dateText(from);
  if (to) return 'until ' + dateText(to);
  return '';
}

// ---- old data (before this model): a year number (negative = BCE, no year 0) and the wording as typed ----
const LEGACY_CENTURY =
  /^(early|mid|late)?\s*(-)?\s*(\d{1,3})(?:st|nd|rd|th)?\s*(?:century|cent|cen|c)\s*(bce|bc|ce|ad)?$/;
const LEGACY_YEAR = /^(?:ad|ce)?\s*(-)?\s*(\d{1,6})\s*(bce|bc|ce|ad)?$/;
/** Converts an old year (+ wording + "approximate" flag) into a date object, or null when there is nothing usable. */
function legacyToDate(year, text, approx) {
  let mode = approx ? 'approx' : 'exact';
  const s = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(circa|ca|c|~)\s+(?=[-\d])/, () => {
      mode = 'approx';
      return '';
    });
  try {
    let m = s && s.match(LEGACY_CENTURY);
    if (m) {
      if (m[1]) mode = 'approx'; // "early 5th century": the third is not kept, the date becomes approximate
      const era = m[2] || m[4] === 'bce' || m[4] === 'bc' ? 'BCE' : 'CE';
      return { fmt: 'c', ts: dateToTs('c', { era, n: +m[3] }), mode, ts_to: null };
    }
    m = s && s.match(LEGACY_YEAR);
    if (m && +m[2]) {
      const era = m[1] || m[3] === 'bce' || m[3] === 'bc' ? 'BCE' : 'CE';
      return { fmt: 'y', ts: dateToTs('y', { era, y: +m[2] }), mode, ts_to: null };
    }
    if (year === null || year === undefined || year === '' || !parseInt(year, 10)) return null;
    const y = parseInt(year, 10);
    return { fmt: 'y', ts: dateToTs('y', { era: y < 0 ? 'BCE' : 'CE', y: Math.abs(y) }), mode, ts_to: null };
  } catch (e) {
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports)
  module.exports = {
    DATE_FORMATS,
    MONTHS,
    daysFromCivil,
    civilFromDays,
    secToIso,
    isoToSec,
    dateUpgrade,
    dateToTs,
    dateFromTs,
    dateAligned,
    datePeriodEnd,
    dateClean,
    dateBounds,
    spanBounds,
    visibleAt,
    timeSpan,
    timeAdvance,
    dateKey,
    dateOrderCheck,
    dateText,
    spanText,
    legacyToDate,
  };
