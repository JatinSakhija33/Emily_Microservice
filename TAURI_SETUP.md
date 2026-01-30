# ATSN AI Desktop App Setup Guide

## ✅ Keys Generated
- **Public Key**: Added to `tauri.conf.json`
- **Private Key**: Generated and ready for GitHub Secrets

## 🔐 GitHub Secrets Setup
Add these to your GitHub repo settings → Secrets and variables → Actions:

### Required Secret:
**TAURI_PRIVATE_KEY**
```
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIPkmwzhvkBrxRxTh3x456fZEQgZZrxPEEAgQJkiNkt1R
-----END PRIVATE KEY-----
```

## 🚀 First Release
```bash
# Commit all changes
git add .
git commit -m "Add Tauri desktop app with auto-updates"

# Create first release tag
git tag v1.0.0
git push origin main --tags
```

## 📦 What Happens Next
- GitHub Actions builds installers for Windows, macOS, Linux
- Releases are signed with your private key
- Users download from: `https://github.com/theathiestmonk/atsn-ai/releases`

## 🔔 Auto-Updates
- Future releases (v1.0.1, etc.) will trigger updates for installed apps
- Users see: "A new version of ATSN AI is ready" notification

## 🧪 Test Locally
```bash
cd frontend
npm run tauri:dev  # Development
npm run tauri:build  # Production build
```

## 📋 Checklist
- ✅ Icons added to `frontend/src-tauri/icons/`
- ✅ Keys generated and configured
- ✅ GitHub Actions workflow ready
- ⏳ Push to Git and create v1.0.0 tag

**Ready for your first desktop release!** 🎉
