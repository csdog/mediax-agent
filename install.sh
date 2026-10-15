#!/usr/bin/env bash
# MediaX CLI + Skill installer. Downloads GitHub Release binaries — Bun not required.
set -eu

REPO_SLUG='csdog/mediax-agent'
REF='latest'
DOWNLOAD_BASE="https://github.com/${REPO_SLUG}/releases"
RAW_BASE="https://raw.githubusercontent.com/${REPO_SLUG}/main"
BIN_DIR="${MEDIAX_BIN_DIR:-$HOME/.local/bin}"
SKILLS_DIR=''
SKILL_ONLY=false
FROM_SOURCE=false

fail() { printf '%s\n' "$*" >&2; exit 1; }
require_tools() {
  for tool in "$@"; do command -v "$tool" >/dev/null || fail "Missing tool: $tool"; done
}
on_path() {
  case ":$PATH:" in *":$1:"*) return 0 ;; *) return 1 ;; esac
}

usage() {
  cat <<'EOF'
Usage: install.sh --skills-dir DIR [--bin-dir DIR] [--skill-only] [--from-source] [--ref TAG]

  --skills-dir DIR   Agent skills parent directory (installs DIR/mediax)
  --bin-dir DIR      Where to place mediax / mx (default: ~/.local/bin)
  --skill-only       Sync Skill only; do not install the CLI
  --from-source      Build CLI with Bun from source (developers / fallback)
  --ref TAG          Release tag (default: latest). Example: v0.0.6
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --skills-dir|--bin-dir|--ref)
        [ "$#" -ge 2 ] && [ -n "$2" ] || fail "Missing value for $1"
        case "$1" in
          --skills-dir) SKILLS_DIR=$2 ;;
          --bin-dir) BIN_DIR=$2 ;;
          --ref) REF=$2 ;;
        esac
        shift 2
        ;;
      --skill-only) SKILL_ONLY=true; shift ;;
      --from-source) FROM_SOURCE=true; shift ;;
      --help|-h) usage; exit 0 ;;
      *) fail "Unknown option: $1" ;;
    esac
  done
}

detect_asset() {
  local os arch
  os=$(uname -s)
  arch=$(uname -m)
  case "$os-$arch" in
    Darwin-arm64) ASSET='mediax-darwin-arm64.zip'; BIN_NAME='mediax' ;;
    Darwin-x86_64) ASSET='mediax-darwin-x64.zip'; BIN_NAME='mediax' ;;
    Linux-x86_64|Linux-amd64) ASSET='mediax-linux-x64.zip'; BIN_NAME='mediax' ;;
    Linux-aarch64|Linux-arm64) ASSET='mediax-linux-arm64.zip'; BIN_NAME='mediax' ;;
    *) fail "Unsupported platform: $os $arch (use --from-source on a supported host, or install a matching Release asset)" ;;
  esac
}

asset_url() {
  local file=$1
  if [ "$REF" = "latest" ]; then
    printf '%s/latest/download/%s' "$DOWNLOAD_BASE" "$file"
  else
    printf '%s/download/%s/%s' "$DOWNLOAD_BASE" "$REF" "$file"
  fi
}

sync_skill_from_dir() {
  local source=$1
  local target=$2
  mkdir -p "$(dirname "$target")"
  rm -rf -- "$target"
  mkdir -p "$target"
  cp -R "$source"/. "$target"/
  printf 'Skill synced to %s\n' "$target"
}

install_cli_binary() {
  local zip_path=$1
  require_tools unzip
  local extract=$TEMP_DIR/bin
  mkdir -p "$extract"
  unzip -qo "$zip_path" -d "$extract"
  [ -f "$extract/$BIN_NAME" ] || fail "Zip missing $BIN_NAME"
  mkdir -p "$BIN_DIR"
  install -m 755 "$extract/$BIN_NAME" "$BIN_DIR/mediax"
  ln -sfn mediax "$BIN_DIR/mx"
  printf 'CLI installed: %s/mediax (alias mx)\n' "$BIN_DIR"
  if ! on_path "$BIN_DIR"; then
    printf 'Note: %s is not on PATH; add it or use the absolute path.\n' "$BIN_DIR"
  fi
}

install_cli_from_source() {
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
  printf 'CLI installed from source: %s/mediax (alias mx)\n' "$BIN_DIR"
}

download_repo_skills() {
  local archive_ref=$1
  local archive_url
  case "$archive_ref" in
    latest) archive_url="https://github.com/${REPO_SLUG}/archive/refs/heads/main.tar.gz" ;;
    v*) archive_url="https://github.com/${REPO_SLUG}/archive/refs/tags/${archive_ref}.tar.gz" ;;
    *) archive_url="https://github.com/${REPO_SLUG}/archive/refs/heads/${archive_ref}.tar.gz" ;;
  esac
  curl -fL --connect-timeout 10 --max-time 180 "$archive_url" -o "$TEMP_DIR/src.tgz"
  tar -xzf "$TEMP_DIR/src.tgz" -C "$TEMP_DIR"
  SOURCE_ROOT=$(find "$TEMP_DIR" -maxdepth 1 -type d -name 'mediax-agent-*' | head -n 1)
  [ -n "$SOURCE_ROOT" ] && [ -f "$SOURCE_ROOT/skills/mediax/SKILL.md" ] ||
    fail "Archive missing skills/mediax/SKILL.md"
}

main() {
  parse_args "$@"
  [ -n "$SKILLS_DIR" ] || fail "Required: --skills-dir DIR (Agent skills parent directory)"
  require_tools curl tar mktemp mkdir cp rm

  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf -- "$TEMP_DIR"' EXIT
  SKILL_TARGET="${SKILLS_DIR%/}/mediax"

  if [ "$FROM_SOURCE" = true ]; then
    printf 'Building from source (%s) …\n' "$REF"
    download_repo_skills "$REF"
    sync_skill_from_dir "$SOURCE_ROOT/skills/mediax" "$SKILL_TARGET"
    if [ "$SKILL_ONLY" = false ]; then
      install_cli_from_source "$SOURCE_ROOT"
    fi
  else
    detect_asset
    printf 'Downloading Skill from Release (%s) …\n' "$REF"
    if curl -fL --connect-timeout 10 --max-time 180 "$(asset_url mediax-skills.zip)" -o "$TEMP_DIR/skills.zip"; then
      require_tools unzip
      mkdir -p "$TEMP_DIR/skills"
      unzip -qo "$TEMP_DIR/skills.zip" -d "$TEMP_DIR/skills"
      [ -f "$TEMP_DIR/skills/mediax/SKILL.md" ] || fail "mediax-skills.zip missing mediax/SKILL.md"
      sync_skill_from_dir "$TEMP_DIR/skills/mediax" "$SKILL_TARGET"
    else
      printf 'No mediax-skills.zip; syncing Skill from repository archive …\n'
      download_repo_skills "$REF"
      sync_skill_from_dir "$SOURCE_ROOT/skills/mediax" "$SKILL_TARGET"
    fi

    if [ "$SKILL_ONLY" = false ]; then
      printf 'Downloading %s …\n' "$ASSET"
      curl -fL --connect-timeout 10 --max-time 180 "$(asset_url "$ASSET")" -o "$TEMP_DIR/$ASSET" ||
        fail "Missing Release asset $ASSET. Publish a v* tag (CI builds binaries), or use --from-source (requires Bun)."
      install_cli_binary "$TEMP_DIR/$ASSET"
      if [ -x "$BIN_DIR/mediax" ]; then
        "$BIN_DIR/mediax" --version 2>/dev/null || true
      fi
    fi
  fi

  if [ "$SKILL_ONLY" = true ]; then
    printf 'Skill-only install finished (CLI skipped).\n'
  fi

  printf '\nDone. Refresh the Agent skill list (or restart the Agent), then run: mediax doctor\n'
  printf 'Install doc: %s/install.md\n' "$RAW_BASE"
}

main "$@"
