#!/bin/bash

set -e  # stoppt bei Fehlern

EXT_DIR="$HOME/.local/share/gnome-shell/extensions/gnome-wallpaper-engine@gjs.com"
PROJECT_DIR="."
ZIP_FILE="./gnome-wallpaper-engine@gjs.com.zip"

echo "🧹 Entferne alte Extension..."
rm -rf "$EXT_DIR"

echo "📦 Erstelle Release ZIP..."
"$PROJECT_DIR/create-release-zip.sh"

echo "📥 Installiere Extension..."
gnome-extensions install "$ZIP_FILE"

echo "🚪 Logging out..."

# GNOME Logout (funktioniert in den meisten Fällen)
gnome-session-quit --logout --no-prompt