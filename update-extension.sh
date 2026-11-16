#!/bin/bash

set -e  # stoppt bei Fehlern

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ZIP_FILE="$SCRIPT_DIR/gnome-wallpaper-engine@gjs.com.zip"

cd "$SCRIPT_DIR"

echo "📦 Erstelle Release ZIP..."
"$SCRIPT_DIR/create-release-zip.sh"

echo "📥 Installiere Extension..."
gnome-extensions install --force "$ZIP_FILE"

echo "🚪 Logging out..."

# GNOME Logout (funktioniert in den meisten Fällen)
# gnome-session-quit --logout --no-prompt
