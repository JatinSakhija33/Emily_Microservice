#!/bin/bash

# Script to download installers from GitHub Releases and prepare for Vercel hosting
# Usage: ./scripts/upload-installers.sh [version]
# Example: ./scripts/upload-installers.sh 1.0.0

set -e

VERSION=${1:-"1.0.0"}
REPO="Theathiestmonk/Agent_Emily"
DOWNLOAD_DIR="frontend/public/downloads"
GITHUB_TOKEN=${GITHUB_TOKEN:-""}

echo "🚀 Preparing installers for version $VERSION"

# Create downloads directory
mkdir -p "$DOWNLOAD_DIR"

# Function to download file from GitHub Releases
download_from_github() {
    local filename=$1
    local url="https://github.com/${REPO}/releases/download/v${VERSION}/${filename}"
    
    echo "📥 Downloading $filename..."
    
    if [ -n "$GITHUB_TOKEN" ]; then
        curl -L -H "Authorization: token $GITHUB_TOKEN" -o "$DOWNLOAD_DIR/$filename" "$url"
    else
        curl -L -o "$DOWNLOAD_DIR/$filename" "$url"
    fi
    
    if [ -f "$DOWNLOAD_DIR/$filename" ]; then
        echo "✅ Downloaded: $filename ($(du -h "$DOWNLOAD_DIR/$filename" | cut -f1))"
    else
        echo "❌ Failed to download: $filename"
        return 1
    fi
}

# Download installers (adjust filenames based on actual Tauri output)
echo "📦 Downloading installers from GitHub Releases..."

# macOS
download_from_github "atsn-ai_${VERSION}_x64.dmg" || \
download_from_github "atsn-ai_${VERSION}_aarch64.dmg" || \
download_from_github "atsn-ai_${VERSION}_universal.dmg" || \
echo "⚠️  macOS installer not found"

# Windows
download_from_github "atsn-ai_${VERSION}_x64-setup.exe" || \
download_from_github "atsn-ai_${VERSION}_x64_en-US.msi" || \
echo "⚠️  Windows installer not found"

# Linux
download_from_github "atsn-ai_${VERSION}_amd64.AppImage" || \
download_from_github "atsn-ai_${VERSION}_amd64.deb" || \
echo "⚠️  Linux installer not found"

echo ""
echo "✅ Installers prepared in: $DOWNLOAD_DIR"
echo ""
echo "📋 Next steps:"
echo "1. Review files in: $DOWNLOAD_DIR"
echo "2. Commit and push: git add $DOWNLOAD_DIR && git commit -m 'Add installers v$VERSION' && git push"
echo "3. Vercel will auto-deploy"
echo "4. Access at: https://your-domain.com/downloads/"
echo ""
echo "🔗 Direct download links will be:"
ls -1 "$DOWNLOAD_DIR"/*.{dmg,exe,AppImage,deb,msi} 2>/dev/null | while read file; do
    filename=$(basename "$file")
    echo "   https://your-domain.com/downloads/$filename"
done


