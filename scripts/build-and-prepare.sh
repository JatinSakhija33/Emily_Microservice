#!/bin/bash

# Build Tauri app and prepare installers for direct hosting
# Usage: ./scripts/build-and-prepare.sh

set -e

echo "🔨 Building Tauri app..."

cd frontend

# Build frontend
echo "📦 Building frontend..."
npm run build

# Build Tauri app for all platforms (or specify)
echo "🖥️  Building Tauri desktop app..."
npm run tauri:build

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Installers location:"
echo "   macOS:   frontend/src-tauri/target/release/bundle/macos/"
echo "   Windows: frontend/src-tauri/target/release/bundle/msi/"
echo "   Linux:   frontend/src-tauri/target/release/bundle/appimage/"
echo ""
echo "📋 Next steps:"
echo "1. Copy installers to your hosting service"
echo "2. Update download.html with your file URLs"
echo "3. Share download links with users"
echo ""

# List built files
echo "📦 Built files:"
find src-tauri/target/release/bundle -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.msi" -o -name "*.AppImage" -o -name "*.deb" \) 2>/dev/null | while read file; do
    echo "   $(basename "$file") - $(du -h "$file" | cut -f1)"
done


