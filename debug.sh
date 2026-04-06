#!/usr/bin/env bash

set -e

echo "[DEBUG] Starting nested GNOME Shell..."

dbus-run-session gnome-shell --nested --wayland 2>&1 | grep --line-buffered ";;"