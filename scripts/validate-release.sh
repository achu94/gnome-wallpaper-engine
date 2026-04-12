#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/validate-release.sh <release-zip-path>

Validate a GNOME extension release zip for required structure and content.
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

extract_uuid_from_metadata_content() {
  awk -F'"' '/"uuid"[[:space:]]*:/ {print $4; exit}'
}

main() {
  (($# == 1)) || {
    usage
    exit 1
  }

  local zip_path="$1"
  [[ -f "$zip_path" ]] || fail "Release zip not found: $zip_path"

  require_command awk
  require_command unzip

  local entries
  entries="$(unzip -Z -1 "$zip_path")"
  [[ -n "$entries" ]] || fail "Zip is empty: $zip_path"

  local top_level_count
  top_level_count="$(printf '%s\n' "$entries" | awk -F/ 'NF > 1 {print $1}' | sort -u | wc -l | tr -d ' ')"
  [[ "$top_level_count" == "1" ]] || fail "Zip must contain exactly one top-level extension directory"

  local extension_root
  extension_root="$(printf '%s\n' "$entries" | awk -F/ 'NF > 1 {print $1; exit}')"
  [[ -n "$extension_root" ]] || fail "Could not detect extension root directory"

  local metadata_entry="$extension_root/metadata.json"
  printf '%s\n' "$entries" | grep -Fxq "$metadata_entry" || fail "Missing metadata.json in zip root"

  local metadata_content
  metadata_content="$(unzip -p "$zip_path" "$metadata_entry")"
  [[ -n "$metadata_content" ]] || fail "Could not read metadata.json from zip"

  local metadata_uuid
  metadata_uuid="$(printf '%s\n' "$metadata_content" | extract_uuid_from_metadata_content)"
  [[ -n "$metadata_uuid" ]] || fail "Could not extract uuid from metadata.json"
  [[ "$metadata_uuid" == "$extension_root" ]] || fail "metadata uuid '$metadata_uuid' does not match zip root '$extension_root'"

  local -a required_entries=(
    "$extension_root/extension.js"
    "$extension_root/indicator.js"
    "$extension_root/prefs.js"
    "$extension_root/stylesheet.css"
    "$extension_root/schemas/org.gnome.shell.extensions.gnome-wallpaper-engine.gschema.xml"
    "$extension_root/schemas/gschemas.compiled"
  )

  local required_entry
  for required_entry in "${required_entries[@]}"; do
    printf '%s\n' "$entries" | grep -Fqx "$required_entry" || fail "Missing required entry: $required_entry"
  done

  local -a required_prefixes=(
    "$extension_root/modules/"
    "$extension_root/prefs/"
    "$extension_root/schemas/"
  )

  local required_prefix
  for required_prefix in "${required_prefixes[@]}"; do
    printf '%s\n' "$entries" | grep -Fq "$required_prefix" || fail "Missing required directory content: $required_prefix"
  done

  local -a forbidden_patterns=(
    "$extension_root/.git/"
    "$extension_root/.github/"
    "$extension_root/docs/"
    "$extension_root/scripts/"
    "$extension_root/create-release-zip.sh"
    "$extension_root/update-extension.sh"
    "$extension_root/debug.sh"
  )

  local forbidden_pattern
  for forbidden_pattern in "${forbidden_patterns[@]}"; do
    if printf '%s\n' "$entries" | grep -Fq "$forbidden_pattern"; then
      fail "Forbidden entry found in release artifact: $forbidden_pattern"
    fi
  done

  echo "Release artifact validation passed: $zip_path"
}

main "$@"
