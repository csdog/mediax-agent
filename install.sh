#!/usr/bin/env bash
# MediaX CLI + Skill installer (GitHub). Does not start the desktop or login.
set -eu

REPO_SLUG='csdog/mediax-agent'
REF='main'
BASE_URL="https://raw.githubusercontent.com/${REPO_SLUG}/${REF}"
ARCHIVE_URL="https://github.com/${REPO_SLUG}/archive/refs/heads/${REF}.tar.gz"
BIN_DIR="${MEDIAX_BIN_DIR:-$HOME/.local/bin}"
SKILLS_DIR=''
SKILL_ONLY=false
BIN_DIR_EXPLICIT=false

fail() { printf '%s\n' "$*" >&2; exit 1; }
require_tools() {
  for tool in "$@"; do command -v "$tool" >/dev/null || fail "Missing tool: $tool"; done
}
on_path() {
  case ":$PATH:" in *":$1:"*) return 0 ;; *) return 1 ;; esac
}

usage() {
  cat <<'EOF'
Usage: install.sh --skills-dir DIR [--bin-dir DIR] [--skill-only] [--ref REF]

  --skills-dir DIR   Agent skills parent directory (installs DIR/mediax)
  --bin-dir DIR      Where to place mediax / mx (default: ~/.local/bin)
  --skill-only       Sync Skill only; do not build or install the CLI
  --ref REF          Git ref for archive / raw URLs (default: main)
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --skills-dir|--bin-dir|--ref)
        [ "$#" -ge 2 ] && [ -n "$2" ] || fail "Missing value for $1"
        case "$1" in
          --skills-dir) SKILLS_DIR=$2 ;;
          --bin-dir) BIN_DIR=$2; BIN_DIR_EXPLICIT=true ;;
          --ref)
            REF=$2
            BASE_URL="https://raw.githubusercontent.com/${REPO_SLUG}/${REF}"
            ARCHIVE_URL="https://github.com/${REPO_SLUG}/archive/refs/heads/${REF}.tar.gz"
            case "$REF" in
              v*) ARCHIVE_URL="https://github.com/${REPO_SLUG}/archive/refs/tags/${REF}.tar.gz" ;;
            esac
            ;;
        esac
        shift 2
        ;;
      --skill-only) SKILL_ONLY=true; shift ;;
      --help|-h) usage; exit 0 ;;
      *) fail "Unknown option: $1" ;;
    esac
  done
}

sync_skill() {
  local source=$1
  local target=$2
  mkdir -p "$(dirname "$target")"
  rm -rf -- "$target"
  mkdir -p "$target"
  cp -R "$source"/. "$target"/
  printf 'Skill synced to %s\n' "$target"
}

install_cli() {
  local source_root=$1
  require_tools bun
  (
    cd "$source_root"
    bun install --frozen-lockfile 2>/dev/null || bun install
    bun run build
  )
  mkdir -p "$BIN_DIR"
  install -m 755 "$source_root/dist/mediax" "$BIN_DIR/mediax"
  ln -sfn mediax "$BIN_DIR/mx"
  printf 'CLI installed: %s/mediax (alias mx)\n' "$BIN_DIR"
  if ! on_path "$BIN_DIR"; then
    printf 'Note: %s is not on PATH; add it or use the absolute path.\n' "$BIN_DIR"
  fi
}

main() {
  parse_args "$@"
  [ -n "$SKILLS_DIR" ] || fail "Required: --skills-dir DIR (Agent skills parent directory)"
  require_tools curl tar mktemp mkdir cp rm

  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf -- "$TEMP_DIR"' EXIT

  printf 'Downloading %s@%s …\n' "$REPO_SLUG" "$REF"
  curl -fL --connect-timeout 10 --max-time 180 "$ARCHIVE_URL" -o "$TEMP_DIR/src.tgz"
  tar -xzf "$TEMP_DIR/src.tgz" -C "$TEMP_DIR"
  SOURCE_ROOT=$(find "$TEMP_DIR" -maxdepth 1 -type d -name 'mediax-agent-*' | head -n 1)
  [ -n "$SOURCE_ROOT" ] && [ -f "$SOURCE_ROOT/skills/mediax/SKILL.md" ] ||
    fail "Archive missing skills/mediax/SKILL.md"

  SKILL_TARGET="${SKILLS_DIR%/}/mediax"
  sync_skill "$SOURCE_ROOT/skills/mediax" "$SKILL_TARGET"

  if [ "$SKILL_ONLY" = false ]; then
    install_cli "$SOURCE_ROOT"
    if command -v mediax >/dev/null 2>&1 || [ -x "$BIN_DIR/mediax" ]; then
      "$BIN_DIR/mediax" --version 2>/dev/null || true
    fi
  else
    printf 'Skill-only install finished (CLI skipped).\n'
  fi

  printf '\nDone. Refresh the Agent skill list (or restart the Agent), then run: mediax doctor\n'
  printf 'Install doc: %s/install.md\n' "$BASE_URL"
}

main "$@"
