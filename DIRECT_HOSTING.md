# Direct File Hosting (No GitHub Required)

## Option 1: Vercel Static Files (Easiest)

### Manual Upload:
1. Build your Tauri app locally:
   ```bash
   cd frontend
   npm run tauri:build
   ```

2. Copy installers to public folder:
   ```bash
   # macOS
   cp src-tauri/target/release/bundle/macos/*.dmg frontend/public/downloads/
   
   # Windows  
   cp src-tauri/target/release/bundle/msi/*.msi frontend/public/downloads/
   cp src-tauri/target/release/bundle/nsis/*.exe frontend/public/downloads/
   
   # Linux
   cp src-tauri/target/release/bundle/appimage/*.AppImage frontend/public/downloads/
   ```

3. Commit and push:
   ```bash
   git add frontend/public/downloads/
   git commit -m "Add installers"
   git push
   ```

4. Access via:
   - `https://your-domain.com/downloads/filename.dmg`
   - `https://your-domain.com/downloads/filename.exe`
   - `https://your-domain.com/downloads/filename.AppImage`

**Pros:** Free, already configured, CDN included
**Cons:** Files in git repo (can get large)

---

## Option 2: Cloudflare R2 (Best for Large Files)

### Setup:
1. Sign up: https://dash.cloudflare.com → R2
2. Create bucket: `atsn-ai-downloads`
3. Upload files via dashboard (drag & drop)
4. Create public access:
   - Settings → Public Access → Enable
   - Or use Custom Domain

### Direct Links:
```
https://your-bucket.r2.dev/atsn-ai_1.0.0_x64.dmg
https://your-bucket.r2.dev/atsn-ai_1.0.0_x64-setup.exe
https://your-bucket.r2.dev/atsn-ai_1.0.0_amd64.AppImage
```

**Pros:** No egress fees, unlimited bandwidth, fast CDN
**Cons:** Requires Cloudflare account

---

## Option 3: AWS S3 + CloudFront

### Setup:
1. Create S3 bucket → Upload files → Make public
2. Create CloudFront distribution → Point to S3
3. Get CloudFront URL

**Cost:** ~$0.023/GB egress + CloudFront costs
**Pros:** Reliable, scalable
**Cons:** Requires AWS account, egress fees

---

## Option 4: DigitalOcean Spaces

### Setup:
1. Create Space → Upload files → Make public
2. Get CDN endpoint
3. Share links

**Cost:** $5/month + $0.02/GB egress
**Pros:** Simple, S3-compatible
**Cons:** Monthly cost

---

## Option 5: Backblaze B2 (Cheapest)

### Setup:
1. Create bucket → Upload files → Make public
2. Get download URLs

**Cost:** $5/TB storage, FREE egress (first 1GB/day)
**Pros:** Very cheap, free egress
**Cons:** Less known, requires account

---

## Option 6: Your Own Server/VPS

### If you have a server:
1. Upload files via SFTP/SCP:
   ```bash
   scp *.dmg user@your-server.com:/var/www/html/downloads/
   ```

2. Configure nginx:
   ```nginx
   location /downloads/ {
       alias /var/www/html/downloads/;
       add_header Content-Disposition "attachment";
   }
   ```

3. Access via: `https://your-server.com/downloads/filename.dmg`

**Pros:** Full control
**Cons:** Requires server, bandwidth costs

---

## Recommended: Cloudflare R2

**Why?**
- ✅ No egress fees (unlimited downloads)
- ✅ Fast global CDN
- ✅ S3-compatible API
- ✅ Free tier: 10GB storage, 1M operations/month
- ✅ Easy drag-and-drop upload

**Quick Start:**
1. Go to: https://dash.cloudflare.com
2. R2 → Create bucket → Upload files
3. Enable public access
4. Copy direct links

---

## Update Download Page

After uploading, update `frontend/public/download.html` with your actual file URLs.


