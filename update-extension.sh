#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

mode="source"
zip_path="$REPO_ROOT/gnome-wallpaper-engine@gjs.com.zip"
build_zip=0
force_enable=0
request_logout=0

usage() {
  cat <<'EOF'
Usage: update-extension.sh [OPTIONS]

Update local GNOME extension install from source or release zip.

Options:
  --from-source       Sync current checkout into local extension directory (default)
  --from-zip PATH     Install from an existing zip artifact
  --build-zip         Build zip before zip install mode
  --enable            Enable extension after update
  --logout            Request GNOME logout after update
  -h, --help          Show this help
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
      --from-source)
        mode="source"
        shift
        ;;
      --from-zip)
        (($# >= 2)) || fail "--from-zip requires a path"
        mode="zip"
        zip_path="$2"
        shift 2
        ;;
      --build-zip)
        build_zip=1
        shift
        ;;
      --enable)
        force_enable=1
        shift
        ;;
      --logout)
        request_logout=1
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

resolve_zip_path() {
  if [[ "$zip_path" != /* ]]; then
    zip_path="$REPO_ROOT/$zip_path"
  fi
}

extract_extension_uuid() {
  local metadata_file="$REPO_ROOT/metadata.json"
  [[ -f "$metadata_file" ]] || fail "metadata.json not found in repository root"
  awk -F'"' '/"uuid"[[:space:]]*:/ {print $4; exit}' "$metadata_file"
}

is_extension_enabled() {
  local uuid="$1"
  local state
  state="$(gnome-extensions info "$uuid" 2>/dev/null | awk -F': ' '/Enabled:/ {print $2}')"
  [[ "$state" == "Yes" ]]
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

  mkdir -p "$destination_dir"

  local item
  for item in "${required_items[@]}"; do
    [[ -e "$source_dir/$item" ]] || fail "Required runtime item missing: $item"
    rsync -a --delete "$source_dir/$item" "$destination_dir/"
  done
}

compile_schemas_in_target() {
  local extension_dir="$1"
  glib-compile-schemas --strict "$extension_dir/schemas"
}

sync_from_source() {
  local uuid="$1"
  local extension_dir="$2"
  copy_runtime_files "$REPO_ROOT/" "$extension_dir/"
  compile_schemas_in_target "$extension_dir"
  echo "Updated from source checkout: $extension_dir"
}

install_from_zip() {
  local zip_file="$1"
  [[ -f "$zip_file" ]] || fail "Zip artifact not found: $zip_file"
  gnome-extensions install --force "$zip_file"
  echo "Installed from zip artifact: $zip_file"
}

maybe_logout() {
  if ((request_logout == 0)); then
    if [[ "${XDG_SESSION_TYPE:-}" == "wayland" ]]; then
      echo "Wayland session detected. Logout/login is required for full shell refresh."
    else
      echo "X11 session detected. You can restart shell with Alt+F2, then r."
    fi
    return
  fi

  require_command gnome-session-quit
  gnome-session-quit --logout --no-prompt
}

main() {
  parse_args "$@"
  resolve_zip_path

  require_command awk
  require_command gnome-extensions

  local extension_uuid
  extension_uuid="$(extract_extension_uuid)"
  [[ -n "$extension_uuid" ]] || fail "Could not extract extension UUID from metadata.json"

  local extension_dir="$HOME/.local/share/gnome-shell/extensions/$extension_uuid"
  local was_enabled=0

  if is_extension_enabled "$extension_uuid"; then
    was_enabled=1
    gnome-extensions disable "$extension_uuid" || true
  fi

  if [[ "$mode" == "source" ]]; then
    require_command rsync
    require_command glib-compile-schemas
    sync_from_source "$extension_uuid" "$extension_dir"
  else
    if ((build_zip == 1)); then
      "$REPO_ROOT/create-release-zip.sh" --output "$zip_path"
    fi
    install_from_zip "$zip_path"
  fi

  if ((force_enable == 1 || was_enabled == 1)); then
    gnome-extensions enable "$extension_uuid"
  fi

  echo "Extension update completed for: $extension_uuid"
  maybe_logout
}

main "$@"
