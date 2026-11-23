// Shared UI components (task F3, tasks/foundation.md). One place for what several tabs draw the same way.
// Interface (the screens never reach into datefield.js or placeform.js directly for these):
//   uiDateEditor.html(cls, date, opts)  HTML of a date field; date = null (unknown) or { fmt, ts, mode, ts_to }
//   uiDateEditor.read(el, what)         the date object, or null when Unknown; throws a readable Error
//   uiDateEditor.check(el, what)        never throws: { date, error }  (error is '' or the message to show)
//   uiDateEditor.safe(el)               like read, an unreadable field is marked red and counts as Unknown
//   uiDateEditor.wire(root)             makes the mode and format selects inside root work (once per container)
//   uiDateEditor.preview(date)          the text shown under the field ("c. 16th century CE"), '' when unknown
//   uiDateFormatGroups()                the format menu: [{ title, formats: [{ id, label, example }] }]
// Every value is the date object of core/dates.js, so the stored data never changes with the look of the field.
// Components return HTML text and read from the DOM they made; text from data goes through esc().

/** The format menu of the prototype (frame s47), the groups of datefield.js. */
function uiDateFormatGroups() {
  return DF_FORMAT_GROUPS.map(([title, ids]) => ({
    title,
    formats: ids.map((id) => {
      const f = dateFormat(id);
      return { id: f.id, label: f.label, example: f.example };
    }),
  }));
}

const uiDateEditor = {
  html: (cls, date, opts) => dfHTML(cls, date, opts),
  read: (el, what, state) => dfRead(el, what, state),
  safe: (el) => dfSafe(el),
  wire: (root) => dfWire(root),
  preview: (date) => (date ? dateText(date) : ''),
  check(el, what) {
    try {
      return { date: dfRead(el, what), error: '' };
    } catch (e) {
      return { date: null, error: e.message };
    }
  },
};
