#!/usr/bin/env bash

set -e

OUTPUT_DIR="[gnome-wallpaper-engine@gjs.com](mailto:gnome-wallpaper-engine@gjs.com)"
ZIP_NAME="[gnome-wallpaper-engine@gjs.com.zip](mailto:gnome-wallpaper-engine@gjs.com.zip)"
SCRIPT_NAME="$(basename "$0")"

echo "➡️ Creating release structure..."

rm -rf "$OUTPUT_DIR" "$ZIP_NAME"

mkdir -p "$OUTPUT_DIR"

rsync -av ./ "$OUTPUT_DIR/" 
--exclude="assets" 
--exclude="backgrounds/*" 
--exclude="README.md" 
--exclude=".gitignore" 
--exclude="$SCRIPT_NAME"

mkdir -p "$OUTPUT_DIR/backgrounds"

echo "📦 Creating zip archive..."

cd "$OUTPUT_DIR"
zip -r "../$ZIP_NAME" .
cd ..

echo "🧹 Cleaning up..."
rm -rf "$OUTPUT_DIR"

echo "✅ Done!"
echo "ZIP created: $ZIP_NAME"
