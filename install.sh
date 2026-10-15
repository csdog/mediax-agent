#!/usr/bin/env bash
# MediaX CLI + Skill installer. Downloads GitHub Release binaries — Bun not required.
# Layout: $MEDIAX_HOME/{bin,skills/mediax,backups/<version>,…}; PATH/Agent dirs are symlinks.
set -eu

REPO_SLUG='csdog/mediax-agent'
REF='latest'
DOWNLOAD_BASE="https://github.com/${REPO_SLUG}/releases"
RAW_BASE="https://raw.githubusercontent.com/${REPO_SLUG}/main"
MEDIAX_HOME="${MEDIAX_HOME:-$HOME/.mediax}"
LINK_DIR="${MEDIAX_BIN_DIR:-$HOME/.local/bin}"
SKILLS_DIR=''
SKILL_ONLY=false
FROM_SOURCE=false
BACKUP_KEEP=3

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

  --skills-dir DIR   Agent skills parent directory (symlinks DIR/mediax + DIR/mx)
  --bin-dir DIR      PATH link directory for mediax-cli / mxc (default: ~/.local/bin); real binary in ~/.mediax/bin
  --skill-only       Sync Skill only; do not install the CLI
  --from-source      Build CLI with Bun from source (developers / fallback)
  --ref TAG          Release tag (default: latest). Example: v0.0.9
EOF
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --skills-dir|--bin-dir|--ref)
        [ "$#" -ge 2 ] && [ -n "$2" ] || fail "Missing value for $1"
        case "$1" in
          --skills-dir) SKILLS_DIR=$2 ;;
          --bin-dir) LINK_DIR=$2 ;;
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
    Darwin-arm64) ASSET='mediax-darwin-arm64.zip'; BIN_NAME='mediax-cli' ;;
    Darwin-x86_64) ASSET='mediax-darwin-x64.zip'; BIN_NAME='mediax-cli' ;;
    Linux-x86_64|Linux-amd64) ASSET='mediax-linux-x64.zip'; BIN_NAME='mediax-cli' ;;
    Linux-aarch64|Linux-arm64) ASSET='mediax-linux-arm64.zip'; BIN_NAME='mediax-cli' ;;
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

sanitize_version() {
  local raw=$1
  raw=$(printf '%s' "$raw" | tr -d '\r' | head -n 1)
  raw=${raw#v}
  raw=${raw#V}
  if printf '%s' "$raw" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$'; then
    printf '%s' "$raw"
  else
    printf 'unknown'
  fi
}

outgoing_version() {
  local ver skill_md line bin
  for bin in "$MEDIAX_HOME/bin/mediax-cli" "$MEDIAX_HOME/bin/mediax"; do
    if [ -x "$bin" ]; then
      ver=$("$bin" --version 2>/dev/null || true)
      ver=$(sanitize_version "$ver")
      if [ "$ver" != "unknown" ]; then
        printf '%s' "$ver"
        return
      fi
    fi
  done
  skill_md="$MEDIAX_HOME/skills/mediax/SKILL.md"
  if [ -f "$skill_md" ]; then
    line=$(grep -E '^version:[[:space:]]*' "$skill_md" | head -n 1 || true)
    line=${line#version:}
    line=$(printf '%s' "$line" | tr -d ' "'\''')
    sanitize_version "$line"
    return
  fi
  printf 'unknown'
}

backup_existing() {
  local has_bin=false has_skill=false ver backup f
  for f in mediax-cli mediax mxc mx; do
    if [ -e "$MEDIAX_HOME/bin/$f" ] || [ -L "$MEDIAX_HOME/bin/$f" ]; then
      has_bin=true
      break
    fi
  done
  if [ -e "$MEDIAX_HOME/skills/mediax" ] || [ -L "$MEDIAX_HOME/skills/mediax" ] ||
    [ -e "$MEDIAX_HOME/skills/mx" ] || [ -L "$MEDIAX_HOME/skills/mx" ]; then
    has_skill=true
  fi
  if [ "$has_bin" = false ] && [ "$has_skill" = false ]; then
    return
  fi
  ver=$(outgoing_version)
  backup="$MEDIAX_HOME/backups/$ver"
  rm -rf -- "$backup"
  mkdir -p "$backup/bin" "$backup/skills"
  if [ "$has_bin" = true ]; then
    for f in mediax-cli mediax mxc mx; do
      if [ -e "$MEDIAX_HOME/bin/$f" ] || [ -L "$MEDIAX_HOME/bin/$f" ]; then
        mv "$MEDIAX_HOME/bin/$f" "$backup/bin/$f"
      fi
    done
  fi
  if [ -e "$MEDIAX_HOME/skills/mediax" ] || [ -L "$MEDIAX_HOME/skills/mediax" ]; then
    mv "$MEDIAX_HOME/skills/mediax" "$backup/skills/mediax"
  fi
  if [ -e "$MEDIAX_HOME/skills/mx" ] || [ -L "$MEDIAX_HOME/skills/mx" ]; then
    mv "$MEDIAX_HOME/skills/mx" "$backup/skills/mx"
  fi
  printf 'Backed up previous install to %s\n' "$backup"
}

prune_backups() {
  local backups_root="$MEDIAX_HOME/backups"
  [ -d "$backups_root" ] || return
  # Keep newest BACKUP_KEEP dirs by mtime; delete the rest.
  # shellcheck disable=SC2012
  ls -1t "$backups_root" 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while IFS= read -r name; do
    [ -n "$name" ] || continue
    rm -rf -- "$backups_root/$name"
  done
}

ensure_skill_link() {
  local link=$1
  local canonical=$2
  mkdir -p "$(dirname "$link")"
  if [ -L "$link" ] || [ -e "$link" ]; then
    if [ -L "$link" ] && [ "$(realpath "$link" 2>/dev/null || true)" = "$(realpath "$canonical")" ]; then
      return
    fi
    rm -rf -- "$link"
  fi
  ln -sfn "$canonical" "$link"
  printf 'Skill link: %s → %s\n' "$link" "$canonical"
}

install_one_skill() {
  local source=$1
  local name=$2
  local canonical="$MEDIAX_HOME/skills/$name"
  mkdir -p "$MEDIAX_HOME/skills"
  rm -rf -- "$canonical"
  mkdir -p "$canonical"
  cp -R "$source"/. "$canonical"/
  [ -f "$canonical/SKILL.md" ] || fail "Skill $name missing SKILL.md after install"
  printf 'Skill installed: %s\n' "$canonical"
  ensure_skill_link "${SKILLS_DIR%/}/$name" "$canonical"
  ensure_skill_link "$HOME/.agents/skills/$name" "$canonical"
}

# $1 = directory that contains mediax/ (and optionally mx/)
install_skills_package() {
  local package_root=$1
  [ -f "$package_root/mediax/SKILL.md" ] || fail "Package missing mediax/SKILL.md"
  install_one_skill "$package_root/mediax" mediax
  if [ -f "$package_root/mx/SKILL.md" ]; then
    install_one_skill "$package_root/mx" mx
  else
    printf 'Note: package has no mx/ alias Skill; skipping short name.\n'
  fi
}

ensure_path_links() {
  local real="$MEDIAX_HOME/bin/mediax-cli"
  [ -x "$real" ] || fail "Missing CLI at $real"
  mkdir -p "$LINK_DIR"
  ln -sfn "$real" "$LINK_DIR/mediax-cli"
  ln -sfn "$real" "$LINK_DIR/mxc"
  # Drop legacy short/long names if present
  rm -f "$LINK_DIR/mediax" "$LINK_DIR/mx"
  printf 'CLI installed: %s (links: %s/mediax-cli, %s/mxc)\n' "$real" "$LINK_DIR" "$LINK_DIR"
  if ! on_path "$LINK_DIR"; then
    printf 'Note: %s is not on PATH; add it or use the absolute path.\n' "$LINK_DIR"
  fi
}

install_cli_binary() {
  local zip_path=$1
  require_tools unzip
  local extract=$TEMP_DIR/bin
  mkdir -p "$extract"
  unzip -qo "$zip_path" -d "$extract"
  # Prefer mediax-cli; accept legacy mediax in older Release zips
  if [ ! -f "$extract/$BIN_NAME" ] && [ -f "$extract/mediax" ]; then
    BIN_NAME=mediax
  fi
  [ -f "$extract/$BIN_NAME" ] || fail "Zip missing mediax-cli (or legacy mediax)"
  mkdir -p "$MEDIAX_HOME/bin"
  install -m 755 "$extract/$BIN_NAME" "$MEDIAX_HOME/bin/mediax-cli"
  ln -sfn mediax-cli "$MEDIAX_HOME/bin/mxc"
  rm -f "$MEDIAX_HOME/bin/mediax" "$MEDIAX_HOME/bin/mx"
  ensure_path_links
}

install_cli_from_source() {
  local source_root=$1
  require_tools bun
  (
    cd "$source_root"
    bun install --frozen-lockfile 2>/dev/null || bun install
    bun run build
  )
  mkdir -p "$MEDIAX_HOME/bin"
  install -m 755 "$source_root/dist/mediax-cli" "$MEDIAX_HOME/bin/mediax-cli"
  ln -sfn mediax-cli "$MEDIAX_HOME/bin/mxc"
  rm -f "$MEDIAX_HOME/bin/mediax" "$MEDIAX_HOME/bin/mx"
  ensure_path_links
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
  require_tools curl tar mktemp mkdir cp rm mv ln grep

  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf -- "$TEMP_DIR"' EXIT
  mkdir -p "$MEDIAX_HOME"

  backup_existing

  if [ "$FROM_SOURCE" = true ]; then
    printf 'Building from source (%s) …\n' "$REF"
    if [ -n "${MEDIAX_INSTALL_SOURCE:-}" ]; then
      SOURCE_ROOT=$MEDIAX_INSTALL_SOURCE
      [ -f "$SOURCE_ROOT/skills/mediax/SKILL.md" ] || fail "MEDIAX_INSTALL_SOURCE missing skills/mediax/SKILL.md"
    else
      download_repo_skills "$REF"
    fi
    install_skills_package "$SOURCE_ROOT/skills"
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
      install_skills_package "$TEMP_DIR/skills"
    else
      printf 'No mediax-skills.zip; syncing Skill from repository archive …\n'
      download_repo_skills "$REF"
      install_skills_package "$SOURCE_ROOT/skills"
    fi

    if [ "$SKILL_ONLY" = false ]; then
      printf 'Downloading %s …\n' "$ASSET"
      curl -fL --connect-timeout 10 --max-time 180 "$(asset_url "$ASSET")" -o "$TEMP_DIR/$ASSET" ||
        fail "Missing Release asset $ASSET. Publish a v* tag (CI builds binaries), or use --from-source (requires Bun)."
      install_cli_binary "$TEMP_DIR/$ASSET"
      if [ -x "$MEDIAX_HOME/bin/mediax-cli" ]; then
        "$MEDIAX_HOME/bin/mediax-cli" --version 2>/dev/null || true
      fi
    fi
  fi

  prune_backups

  if [ "$SKILL_ONLY" = true ]; then
    printf 'Skill-only install finished (CLI skipped).\n'
  fi

  printf '\nDone. Refresh the Agent skill list (or restart the Agent), then run: mediax-cli doctor\n'
  printf 'Home: %s\n' "$MEDIAX_HOME"
  printf 'Install doc: %s/install.md\n' "$RAW_BASE"
}

main "$@"
