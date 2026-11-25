// Rivers tab: tests of tasks/rivers.md (own file, so that parallel workers never edit the same test file).
const { load, UI_STANDINS } = require('./lib/ctx');
const { test, ok, eq } = require('./lib/harness');
