#!/usr/bin/env bash
# Smoke: install.sh --from-source into a temp HOME; verify ~/.mediax layout, links, backup, prune.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf -- "$TMP"' EXIT
export HOME="$TMP/home"
export MEDIAX_HOME="$HOME/.mediax"
mkdir -p "$HOME/.local/bin" "$HOME/.cursor/skills"

# Seed prior install + control.json + extra backups for prune
mkdir -p "$MEDIAX_HOME/bin" "$MEDIAX_HOME/skills/mediax" \
  "$MEDIAX_HOME/backups/0.0.1/bin" "$MEDIAX_HOME/backups/0.0.2/bin" \
  "$MEDIAX_HOME/backups/0.0.3/bin" "$MEDIAX_HOME/backups/0.0.4/bin"
cat >"$MEDIAX_HOME/bin/mediax-cli" <<'EOF'
#!/bin/sh
echo 0.0.7
EOF
chmod +x "$MEDIAX_HOME/bin/mediax-cli"
cat >"$MEDIAX_HOME/skills/mediax/SKILL.md" <<'EOF'
---
name: mediax
version: 0.0.7
---
old
EOF
printf '%s\n' '{"baseUrl":"http://127.0.0.1:9","token":"t"}' >"$MEDIAX_HOME/control.json"
CONTROL_HASH=$(cksum <"$MEDIAX_HOME/control.json")

MEDIAX_INSTALL_SOURCE="$ROOT" bash "$ROOT/install.sh" --skills-dir "$HOME/.cursor/skills" --from-source --ref main

test -x "$MEDIAX_HOME/bin/mediax-cli"
test -f "$MEDIAX_HOME/skills/mediax/SKILL.md"
test -f "$MEDIAX_HOME/skills/mx/SKILL.md"
test -L "$HOME/.local/bin/mediax-cli"
test "$(realpath "$HOME/.local/bin/mediax-cli")" = "$(realpath "$MEDIAX_HOME/bin/mediax-cli")"
test -L "$HOME/.local/bin/mxc"
test ! -e "$HOME/.local/bin/mediax"
test ! -e "$HOME/.local/bin/mx"
test -L "$HOME/.cursor/skills/mediax"
test "$(realpath "$HOME/.cursor/skills/mediax")" = "$(realpath "$MEDIAX_HOME/skills/mediax")"
test -L "$HOME/.cursor/skills/mx"
test "$(realpath "$HOME/.cursor/skills/mx")" = "$(realpath "$MEDIAX_HOME/skills/mx")"
test -L "$HOME/.agents/skills/mediax"
test -L "$HOME/.agents/skills/mx"
test -d "$MEDIAX_HOME/backups/0.0.7"
test -f "$MEDIAX_HOME/backups/0.0.7/skills/mediax/SKILL.md"
test "$(cksum <"$MEDIAX_HOME/control.json")" = "$CONTROL_HASH"

backup_count=$(find "$MEDIAX_HOME/backups" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
test "$backup_count" -le 3

printf 'smoke-install-home: ok (HOME=%s)\n' "$HOME"
