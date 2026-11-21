# Sidebar design v3 (reference, owner's design, second version with 68 screens)

`sidebar.css` and `sidebar.js` are the owner's mock-up: static screens drawn with sample data (a page that loads `sidebar.css`, has `<div id="out"></div>` and loads `sidebar.js` shows them). It is a reference for looks, not code to ship: the real sidebar keeps its own markup, ids and behaviour (TODO.md, groups 7 and 8). `COVERAGE.md` says which screen shows what. The screenshots (68 PNG, named `s<N>.png`) stay with the owner; TODO.md uses the same `s<N>`.

The first version (19 screens, TODO.md group 7, T-070 to T-077) was applied before this one arrived. This version adds: language and type pills with a "+N" list, a Period / Moment footer, a closed panel with one opener, switches, empty / loading / error states, confirmation boxes, and screens for every card (borders, routes, layers, relief, directions).

`prototype-standalone.html` (second delivery, the most complete version, 62 screens, clickable) supersedes the screen set above where they differ: open it in a browser; each screen has the same `s<N>` number.
