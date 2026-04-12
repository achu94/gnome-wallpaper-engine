#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
}

check_script_syntax() {
  local -a scripts_to_check=(
    "$REPO_ROOT/create-release-zip.sh"
    "$REPO_ROOT/update-extension.sh"
    "$REPO_ROOT/debug.sh"
    "$REPO_ROOT/scripts/validate-release.sh"
    "$REPO_ROOT/scripts/smoke-check.sh"
  )

  local script_path
  for script_path in "${scripts_to_check[@]}"; do
    [[ -f "$script_path" ]] || fail "Script not found: $script_path"
    bash -n "$script_path"
  done
}

check_schema_compilation() {
  local schema_source_dir="$REPO_ROOT/schemas"
  [[ -d "$schema_source_dir" ]] || fail "Schema directory missing: $schema_source_dir"

  local temp_schema_dir
  temp_schema_dir="$(mktemp -d "${TMPDIR:-/tmp}/gwe-smoke-schemas.XXXXXX")"

  cp "$schema_source_dir"/*.xml "$temp_schema_dir/"
  glib-compile-schemas --strict "$temp_schema_dir"
  [[ -f "$temp_schema_dir/gschemas.compiled" ]] || fail "Schema compilation smoke check failed"

  rm -rf "$temp_schema_dir"
}

check_release_packaging() {
  local temp_dir
  temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/gwe-smoke-release.XXXXXX")"

  local output_zip="$temp_dir/gnome-wallpaper-engine@gjs.com.zip"
  "$REPO_ROOT/create-release-zip.sh" --output "$output_zip"
  "$REPO_ROOT/scripts/validate-release.sh" "$output_zip"

  rm -rf "$temp_dir"
}

main() {
  require_command bash
  require_command glib-compile-schemas
  require_command zip
  require_command unzip
  require_command rsync

  check_script_syntax
  check_schema_compilation
  check_release_packaging

  echo "Smoke checks passed."
}

main "$@"
