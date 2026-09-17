#!/usr/bin/env bash
# Operator Turso login for Windows/WSL. Waits for the localhost OAuth callback.
# Do not pass --headless: that flag prints a URL and exits immediately.
set -euo pipefail

TURSO="${TURSO_BIN:-/root/.turso/turso}"
DB="${PAID_BETA_TURSO_DB:-vault-paid-beta-dev}"

usage() {
  cat <<EOF
Wait for Turso OAuth callback on Windows/WSL, then create empty ${DB}.

Do not use --headless. That flag prints a URL and exits immediately.
It never starts the localhost callback server and never prints
"Waiting for authentication...".

This script:
  1. Puts a Windows cmd.exe xdg-open wrapper first on PATH (this WSL has no xdg-open).
  2. Runs: script -q -e -c "${TURSO} auth login" /dev/null
     so the CLI has a PTY and waits for the browser callback (up to 5 minutes).
  3. After whoami succeeds, creates empty ${DB} if needed.
  4. Prints where to put gitignored VAULT_LIBSQL_URL and VAULT_LIBSQL_AUTH_TOKEN.
  5. Leaves VAULT_DURABLE_DATA unset so local :4319 stays on sqlite.

Persistent PowerShell (keep it open until Success):
  wsl --cd "<vault-lab>" -u root -- bash scripts/turso-wsl-login.sh

Dry-run: bash scripts/turso-wsl-login.sh --help
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" || "${1:-}" == "--print-only" ]]; then
  usage
  exit 0
fi

if [[ ! -e "$TURSO" ]]; then
  echo "missing Turso CLI at $TURSO" >&2
  exit 1
fi

logged_in() {
  local text
  text="$("$TURSO" auth whoami 2>&1 || true)"
  if echo "$text" | grep -Eqi 'not logged|please login|unauthoriz'; then
    return 1
  fi
  [[ -n "${text//[[:space:]]/}" ]]
}

if ! logged_in; then
  bindir="$(mktemp -d)"
  cleanup() { rm -rf "$bindir"; }
  trap cleanup EXIT
  cat > "$bindir/xdg-open" << 'OPEN'
#!/bin/sh
# Quote the URL for cmd.exe. Unquoted OAuth query '&' is a command separator
# (redirect/state become extra commands; Turso then reports failed to open auth URL).
exec /mnt/c/Windows/System32/cmd.exe /c "start \"\" \"$1\""
OPEN
  chmod +x "$bindir/xdg-open"
  ln -sf "$bindir/xdg-open" "$bindir/x-www-browser"
  ln -sf "$bindir/xdg-open" "$bindir/www-browser"
  export PATH="$bindir:$PATH"
  echo "Starting Turso login without the headless flag. Keep this terminal open."
  echo "The CLI will print Waiting for authentication... until the browser callback hits localhost."
  script -q -e -c "$TURSO auth login" /dev/null
fi

if ! logged_in; then
  echo "whoami still logged out. Re-run this script in a persistent PowerShell." >&2
  echo "Do not add the headless flag; it exits before the callback server starts." >&2
  exit 1
fi

echo "whoami ok"
set +e
create_out="$("$TURSO" db create "$DB" 2>&1)"
create_status=$?
set -e
printf '%s\n' "$create_out"
if [[ "$create_status" -ne 0 ]] && ! echo "$create_out" | grep -Eqi 'already exists|already in use|already created'; then
  echo "turso db create $DB failed" >&2
  exit 1
fi

echo "Empty database target: $DB"
echo "Copy URL into gitignored .env as VAULT_LIBSQL_URL from:"
echo "  $TURSO db show $DB --url"
echo "Then create a token (not printed here) with:"
echo "  $TURSO db tokens create $DB"
echo "and paste it into gitignored .env as VAULT_LIBSQL_AUTH_TOKEN."
echo "Leave VAULT_DURABLE_DATA unset so local :4319 paid-beta:testnet stays on sqlite."
