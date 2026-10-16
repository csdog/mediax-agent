#!/usr/bin/env bash
# Smoke: install.sh --from-source into a temp HOME; verify ~/.mediax/agent layout, links, backup, prune.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf -- "$TMP"' EXIT
export HOME="$TMP/home"
export MEDIAX_HOME="$HOME/.mediax"
AGENT_HOME="$MEDIAX_HOME/agent"
mkdir -p "$HOME/.local/bin" "$HOME/.cursor/skills"

# Seed prior agent install + control.json under agent/ + extra backups for prune
mkdir -p "$AGENT_HOME/bin" "$AGENT_HOME/skills/mediax" \
  "$AGENT_HOME/backups/0.0.1/bin" "$AGENT_HOME/backups/0.0.2/bin" \
  "$AGENT_HOME/backups/0.0.3/bin" "$AGENT_HOME/backups/0.0.4/bin"
cat >"$AGENT_HOME/bin/mediax-cli" <<'EOF'
#!/bin/sh
echo 0.0.7
EOF
chmod +x "$AGENT_HOME/bin/mediax-cli"
cat >"$AGENT_HOME/skills/mediax/SKILL.md" <<'EOF'
---
name: mediax
version: 0.0.7
---
old
EOF
printf '%s\n' '{"baseUrl":"http://127.0.0.1:9","token":"t"}' >"$AGENT_HOME/control.json"
CONTROL_HASH=$(cksum <"$AGENT_HOME/control.json")

MEDIAX_INSTALL_SOURCE="$ROOT" bash "$ROOT/skills/install.sh" --skills-dir "$HOME/.cursor/skills" --from-source --ref main

test -x "$AGENT_HOME/bin/mediax-cli"
test -f "$AGENT_HOME/skills/mediax/SKILL.md"
test -f "$AGENT_HOME/skills/mx/SKILL.md"
test -L "$HOME/.local/bin/mediax-cli"
test "$(realpath "$HOME/.local/bin/mediax-cli")" = "$(realpath "$AGENT_HOME/bin/mediax-cli")"
test -L "$HOME/.local/bin/mxc"
test ! -e "$HOME/.local/bin/mediax"
test ! -e "$HOME/.local/bin/mx"
test -L "$HOME/.cursor/skills/mediax"
test "$(realpath "$HOME/.cursor/skills/mediax")" = "$(realpath "$AGENT_HOME/skills/mediax")"
test -L "$HOME/.cursor/skills/mx"
test "$(realpath "$HOME/.cursor/skills/mx")" = "$(realpath "$AGENT_HOME/skills/mx")"
test -L "$HOME/.agents/skills/mediax"
test -L "$HOME/.agents/skills/mx"
test -d "$AGENT_HOME/backups/0.0.7"
test -f "$AGENT_HOME/backups/0.0.7/skills/mediax/SKILL.md"
test "$(cksum <"$AGENT_HOME/control.json")" = "$CONTROL_HASH"
test ! -e "$MEDIAX_HOME/bin"
test ! -d "$MEDIAX_HOME/skills"

backup_count=$(find "$AGENT_HOME/backups" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
test "$backup_count" -le 3

printf 'smoke-install-home: ok (HOME=%s agent=%s)\n' "$HOME" "$AGENT_HOME"
