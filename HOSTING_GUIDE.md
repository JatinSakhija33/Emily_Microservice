# Hosting ATSN AI Desktop App Installers

## Option 1: Vercel (Recommended - Already Set Up)

### Steps:
1. Download installers from GitHub Releases
2. Place files in `frontend/public/downloads/`:
   ```
   frontend/public/downloads/atsn-ai_1.0.0_x64.dmg
   frontend/public/downloads/atsn-ai_1.0.0_x64-setup.exe
   frontend/public/downloads/atsn-ai_1.0.0_amd64.AppImage
   ```
3. Push to git - Vercel will auto-deploy
4. Access via:
   - `https://your-domain.com/downloads/atsn-ai_1.0.0_x64.dmg`
   - `https://your-domain.com/downloads/atsn-ai_1.0.0_x64-setup.exe`
   - `https://your-domain.com/downloads/atsn-ai_1.0.0_amd64.AppImage`

**Pros:** Free, already configured, CDN included
**Cons:** Files are in your git repo (can get large)

---

## Option 2: Cloudflare R2 (Best for Large Files)

### Setup:
1. Create Cloudflare account → R2 → Create bucket
2. Upload installers via dashboard or CLI
3. Create public access via Custom Domain or R2.dev subdomain
4. Get direct download links

**Pros:** No egress fees, S3-compatible, fast CDN
**Cons:** Requires Cloudflare account

### CLI Upload Example:
```bash
# Install wrangler CLI
npm install -g wrangler

# Configure
wrangler r2 bucket create atsn-ai-downloads

# Upload files
wrangler r2 object put atsn-ai-downloads/atsn-ai_1.0.0_x64.dmg --file=./atsn-ai_1.0.0_x64.dmg
```

---

## Option 3: AWS S3 + CloudFront

### Setup:
1. Create S3 bucket → Upload files → Make public
2. Create CloudFront distribution → Point to S3
3. Get CloudFront URL for direct downloads

**Pros:** Reliable, scalable, industry standard
**Cons:** Egress fees, requires AWS account

### Direct Links Format:
```
https://your-cloudfront-domain.cloudfront.net/atsn-ai_1.0.0_x64.dmg
```

---

## Option 4: DigitalOcean Spaces

### Setup:
1. Create Space → Upload files → Make public
2. Get CDN endpoint
3. Share direct links

**Pros:** Simple, affordable, S3-compatible
**Cons:** Monthly cost (~$5/month)

---

## Option 5: Direct Server Hosting

### If you have your own server:
1. Upload files to `/var/www/downloads/` or similar
2. Configure nginx/apache to serve files
3. Access via: `https://your-server.com/downloads/filename.dmg`

**Pros:** Full control
**Cons:** Requires server management, bandwidth costs

---

## Quick Setup Script (Vercel)

I can create a script that:
1. Downloads installers from GitHub Releases
2. Uploads to your Vercel public folder
3. Updates download.html with correct links

Would you like me to create this?


