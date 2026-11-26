#!/usr/bin/env bash
# A phpBB board on SQLite with this extension, the forum "Map" and the sample data, for development and tests (docs/11-local-development.md).
#   tools/dev/phpbb-up.sh          install phpBB, enable the extension, fill the board (does nothing that is already done)
#   tools/dev/phpbb-up.sh serve    start the board at http://127.0.0.1:8080/app.php/map (admin / adminadmin)
#   tools/dev/phpbb-up.sh check    check the board: tables, forum, topics, posts, writes through the store, and the map answers
#   tools/dev/phpbb-up.sh reset    delete the board
# Needs git, composer and PHP with sqlite3, pdo_sqlite, mbstring, xml, zip, curl, gd. Variables: AHM_DEV_DIR (default .dev), PHPBB_TAG, PORT.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV="${AHM_DEV_DIR:-$REPO/.dev}"
TAG="${PHPBB_TAG:-release-3.3.19}"
PORT="${PORT:-8080}"
BOARD="$DEV/phpbb-src/phpBB"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 1; }; }

setup() {
  need git; need php; need composer
  php -r 'foreach (["sqlite3","pdo_sqlite","mbstring","xml","zip","curl","gd"] as $e) if (!extension_loaded($e)) { fwrite(STDERR, "PHP needs the extension $e\n"); exit(1); }'
  mkdir -p "$DEV"
  if [ ! -d "$DEV/phpbb-src" ]; then
    git clone --quiet --depth 1 --branch "$TAG" https://github.com/phpbb/phpbb.git "$DEV/phpbb-src"
  fi
  if [ ! -d "$BOARD/vendor" ]; then
    (cd "$BOARD" && COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --no-interaction --prefer-dist --no-progress)
  fi
  if [ ! -f "$BOARD/config.php" ]; then
    mkdir -p "$BOARD/cache" "$BOARD/store" "$BOARD/files" "$BOARD/images/avatars/upload"
    chmod -R a+rwX "$BOARD/cache" "$BOARD/store" "$BOARD/files" "$BOARD/images/avatars/upload" "$BOARD/config" 2>/dev/null || true
    cat > "$DEV/install.yml" <<YML
installer:
    admin: {name: admin, password: adminadmin, email: admin@example.org}
    board: {lang: en, name: AHM dev board, description: development board}
    database: {dbms: sqlite3, dbhost: $DEV/phpbb.sqlite3, dbport: ~, dbuser: ~, dbpasswd: ~, dbname: ~, table_prefix: phpbb_}
    email: {enabled: false, smtp_delivery: ~, smtp_host: ~, smtp_port: ~, smtp_auth: ~, smtp_user: ~, smtp_pass: ~}
    server: {cookie_secure: false, server_protocol: "http://", force_server_vars: false, server_name: 127.0.0.1, server_port: $PORT, script_path: /}
    extensions: []
YML
    (cd "$BOARD" && php install/phpbbcli.php install "$DEV/install.yml" >"$DEV/install.log" 2>&1) || { tail -20 "$DEV/install.log" >&2; exit 1; }
  fi
  [ -d "$BOARD/install" ] && mv "$BOARD/install" "$BOARD/install.bak"
  mkdir -p "$BOARD/ext/ahm"
  ln -sfn "$REPO" "$BOARD/ext/ahm/map"
  if ! (cd "$BOARD" && php bin/phpbbcli.php extension:show 2>/dev/null | sed -n '/^Enabled/,/^Disabled/p' | grep -q 'ahm/map'); then
    (cd "$BOARD" && php bin/phpbbcli.php extension:enable ahm/map)
  fi
  php "$REPO/tools/dev/seed.php" "$BOARD"
  echo "ready: $BOARD   (tools/dev/phpbb-up.sh serve, then http://127.0.0.1:$PORT/app.php/map, admin / adminadmin)"
}

serve() {
  [ -f "$BOARD/config.php" ] || { echo "run tools/dev/phpbb-up.sh first" >&2; exit 1; }
  echo "http://127.0.0.1:$PORT/app.php/map   (Ctrl-C to stop)"
  exec php -S "127.0.0.1:$PORT" -t "$BOARD"
}

check() {
  [ -f "$BOARD/config.php" ] || { echo "run tools/dev/phpbb-up.sh first" >&2; exit 1; }
  php "$REPO/tools/dev/seed.php" "$BOARD" --check
  php "$REPO/tools/dev/selftest.php" "$BOARD"
  php -S "127.0.0.1:$PORT" -t "$BOARD" >"$DEV/serve.log" 2>&1 &
  local pid=$!
  trap 'kill $pid 2>/dev/null || true' EXIT
  sleep 2
  local bad=0 u code
  for u in app.php/map app.php/map/data/places app.php/map/data/shapes app.php/map/data/layers app.php/map/data/types app.php/map/data/sources viewforum.php?f=1 index.php; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/$u")"
    if [ "$code" = 200 ]; then echo "  ok   GET /$u"; else echo "  FAIL GET /$u -> $code"; bad=1; fi
  done
  exit $bad
}

case "${1:-setup}" in
  setup) setup ;;
  serve) serve ;;
  check) check ;;
  reset) rm -rf "$DEV"; echo "deleted $DEV" ;;
  *) echo "usage: $0 [setup|serve|check|reset]" >&2; exit 2 ;;
esac
