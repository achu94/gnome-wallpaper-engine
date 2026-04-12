#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
SCHEMA_ID="org.gnome.shell.extensions.gnome-wallpaper-engine"
DATA_DIR="$HOME/.local/share/gnome-wallpaper-engine"
BACKGROUNDS_DIR="$DATA_DIR/backgrounds"
CATALOG_PATH="$DATA_DIR/media-catalog.json"

since_value="10 min ago"
output_path=""

usage() {
  cat <<'EOF'
Usage: debug.sh <command> [options]

Commands:
  status                  Show runtime summary (extension, settings, processes)
  logs [--since VALUE]    Show filtered GNOME Shell logs
  capture [--output FILE] Capture status + logs into one report

Options:
  --since VALUE           Journal time filter for logs command (default: "10 min ago")
  --output FILE           Output file for capture command (default: stdout)
  -h, --help              Show this help
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

extract_extension_uuid() {
  local metadata_file="$REPO_ROOT/metadata.json"
  [[ -f "$metadata_file" ]] || fail "metadata.json not found in repository root"
  awk -F'"' '/"uuid"[[:space:]]*:/ {print $4; exit}' "$metadata_file"
}

parse_options() {
  while (($# > 0)); do
    case "$1" in
      --since)
        (($# >= 2)) || fail "--since requires a value"
        since_value="$2"
        shift 2
        ;;
      --output)
        (($# >= 2)) || fail "--output requires a path"
        output_path="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
  done
}

print_section() {
  local title="$1"
  printf '\n===== %s =====\n' "$title"
}

print_extension_status() {
  local extension_uuid="$1"
  require_command gnome-extensions
  gnome-extensions info "$extension_uuid" || true
}

resolve_extension_dir() {
  local extension_uuid="$1"
  local info_path
  info_path="$(gnome-extensions info "$extension_uuid" 2>/dev/null | awk -F': ' '/Path:/ {print $2; exit}')"
  if [[ -n "$info_path" ]]; then
    printf '%s\n' "$info_path"
    return
  fi

  printf '%s\n' "$HOME/.local/share/gnome-shell/extensions/$extension_uuid"
}

print_metadata() {
  local metadata_file="$REPO_ROOT/metadata.json"
  print_section "metadata.json"
  cat "$metadata_file"
}

print_settings_snapshot() {
  local extension_dir="$1"

  if ! command -v gsettings >/dev/null 2>&1; then
    echo "gsettings command not available"
    return
  fi

  local -a gsettings_cmd=(gsettings)
  if ! gsettings list-schemas | grep -Fxq "$SCHEMA_ID"; then
    if [[ -d "$extension_dir/schemas" ]]; then
      gsettings_cmd=(gsettings --schemadir "$extension_dir/schemas")
    else
      echo "GSettings schema not available: $SCHEMA_ID"
      return
    fi
  fi

  if ! "${gsettings_cmd[@]}" list-keys "$SCHEMA_ID" >/dev/null 2>&1; then
    echo "Could not read schema keys for: $SCHEMA_ID"
    return
  fi

  local key
  while IFS= read -r key; do
    printf '%s=%s\n' "$key" "$("${gsettings_cmd[@]}" get "$SCHEMA_ID" "$key")"
  done < <("${gsettings_cmd[@]}" list-keys "$SCHEMA_ID" | sort)
}

print_storage_snapshot() {
  echo "data_dir=$DATA_DIR"
  echo "backgrounds_dir=$BACKGROUNDS_DIR"
  echo "catalog_path=$CATALOG_PATH"

  if [[ -d "$BACKGROUNDS_DIR" ]]; then
    echo "backgrounds_dir_exists=true"
    echo "background_files=$(find "$BACKGROUNDS_DIR" -maxdepth 1 -type f | wc -l)"
  else
    echo "backgrounds_dir_exists=false"
  fi

  if [[ -f "$CATALOG_PATH" ]]; then
    echo "catalog_exists=true"
  else
    echo "catalog_exists=false"
  fi
}

print_process_snapshot() {
  ps -eo pid,ppid,etime,cmd \
    | awk '/gnome-shell|mpv.*wallpaper_bg/ {print}'
}

print_environment_snapshot() {
  echo "Timestamp: $(date --iso-8601=seconds)"
  echo "Kernel: $(uname -srmo)"
  echo "Session type: ${XDG_SESSION_TYPE:-unknown}"
  echo "Desktop session: ${XDG_CURRENT_DESKTOP:-unknown}"
  if command -v lsb_release >/dev/null 2>&1; then
    echo "Distribution: $(lsb_release -ds)"
  fi
}

print_filtered_logs() {
  if ! command -v journalctl >/dev/null 2>&1; then
    echo "journalctl command not available"
    return
  fi

  journalctl --no-pager --output short-iso --since "$since_value" _COMM=gnome-shell \
    | grep -Ei 'gnome-wallpaper-engine|Gnome Live Wallpaper|wallpaper_bg|meta_window_set_stack_position_no_sync|ding|conky|mpv|\[;;; DEBUG\]|\[;; DEBUG\]|"scope"|"message"' \
    || true
}

run_status() {
  local extension_uuid="$1"
  local extension_dir
  extension_dir="$(resolve_extension_dir "$extension_uuid")"

  print_section "environment"
  print_environment_snapshot

  print_section "extension status"
  print_extension_status "$extension_uuid"

  print_section "settings snapshot"
  print_settings_snapshot "$extension_dir"

  print_section "storage snapshot"
  print_storage_snapshot

  print_section "process snapshot"
  print_process_snapshot
}

run_logs() {
  print_section "gnome-shell logs"
  print_filtered_logs
}

run_capture() {
  local extension_uuid="$1"
  if [[ -n "$output_path" ]]; then
    mkdir -p "$(dirname "$output_path")"
    {
      run_status "$extension_uuid"
      run_logs
      print_metadata
    } >"$output_path"
    echo "Diagnostics captured to: $output_path"
    return
  fi

  run_status "$extension_uuid"
  run_logs
  print_metadata
}

main() {
  (($# > 0)) || {
    usage
    exit 1
  }

  local command="$1"
  shift
  parse_options "$@"

  require_command awk
  local extension_uuid
  extension_uuid="$(extract_extension_uuid)"
  [[ -n "$extension_uuid" ]] || fail "Could not extract extension UUID from metadata.json"

  case "$command" in
    status)
      run_status "$extension_uuid"
      ;;
    logs)
      run_logs
      ;;
    capture)
      run_capture "$extension_uuid"
      ;;
    -h|--help)
      usage
      ;;
    *)
      fail "Unknown command: $command"
      ;;
  esac
}

main "$@"
