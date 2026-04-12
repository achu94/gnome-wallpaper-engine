#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
DEFAULT_ZIP_PATH="$REPO_ROOT/gnome-wallpaper-engine@gjs.com.zip"

zip_path="$DEFAULT_ZIP_PATH"
keep_staging=0
staging_parent=""

usage() {
  cat <<'EOF'
Usage: create-release-zip.sh [--output PATH] [--keep-staging]

Build a clean release artifact rooted at the extension UUID folder.

Options:
  --output PATH     Output zip path (default: ./gnome-wallpaper-engine@gjs.com.zip)
  --keep-staging    Keep temporary staging directory for inspection
  -h, --help        Show this help
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --output)
        (($# >= 2)) || fail "--output requires a path"
        zip_path="$2"
        shift 2
        ;;
      --keep-staging)
        keep_staging=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done
}

resolve_output_path() {
  if [[ "$zip_path" != /* ]]; then
    zip_path="$REPO_ROOT/$zip_path"
  fi
}

extract_extension_uuid() {
  local metadata_file="$REPO_ROOT/metadata.json"
  [[ -f "$metadata_file" ]] || fail "metadata.json not found in repository root"
  awk -F'"' '/"uuid"[[:space:]]*:/ {print $4; exit}' "$metadata_file"
}

cleanup() {
  if [[ -z "$staging_parent" ]]; then
    return
  fi

  if ((keep_staging == 1)); then
    echo "Staging directory kept at: $staging_parent"
    return
  fi

  rm -rf "$staging_parent"
}

copy_runtime_files() {
  local source_dir="$1"
  local destination_dir="$2"

  local -a required_items=(
    extension.js
    indicator.js
    metadata.json
    prefs.js
    stylesheet.css
    modules
    prefs
    schemas
  )

  local item
  for item in "${required_items[@]}"; do
    [[ -e "$source_dir/$item" ]] || fail "Required runtime item missing: $item"
    rsync -a "$source_dir/$item" "$destination_dir/"
  done
}

validate_staged_runtime() {
  local stage_dir="$1"

  [[ -f "$stage_dir/metadata.json" ]] || fail "Staged metadata.json missing"
  [[ -f "$stage_dir/extension.js" ]] || fail "Staged extension.js missing"
  [[ -f "$stage_dir/schemas/org.gnome.shell.extensions.gnome-wallpaper-engine.gschema.xml" ]] \
    || fail "Staged GSettings schema XML missing"
}

compile_schemas() {
  local stage_dir="$1"
  glib-compile-schemas --strict "$stage_dir/schemas"
  [[ -f "$stage_dir/schemas/gschemas.compiled" ]] || fail "Schema compilation did not create gschemas.compiled"
}

create_zip() {
  local extension_uuid="$1"
  local stage_parent="$2"
  local output_file="$3"

  mkdir -p "$(dirname "$output_file")"
  rm -f "$output_file"

  (
    cd "$stage_parent"
    zip -qr "$output_file" "$extension_uuid"
  )

  [[ -f "$output_file" ]] || fail "Expected release zip not found at $output_file"
}

main() {
  parse_args "$@"
  resolve_output_path

  require_command awk
  require_command rsync
  require_command zip
  require_command glib-compile-schemas

  local extension_uuid
  extension_uuid="$(extract_extension_uuid)"
  [[ -n "$extension_uuid" ]] || fail "Could not extract extension UUID from metadata.json"

  staging_parent="$(mktemp -d "${TMPDIR:-/tmp}/gwe-release.XXXXXX")"
  trap cleanup EXIT

  local staging_extension_dir="$staging_parent/$extension_uuid"
  mkdir -p "$staging_extension_dir"

  copy_runtime_files "$REPO_ROOT/" "$staging_extension_dir/"
  validate_staged_runtime "$staging_extension_dir"
  compile_schemas "$staging_extension_dir"
  create_zip "$extension_uuid" "$staging_parent" "$zip_path"

  echo "Release ZIP created: $zip_path"
}

main "$@"
