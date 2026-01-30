# LinkedIn OAuth Setup for Local and Production

## Overview
This guide shows how to configure LinkedIn OAuth to work on both localhost (development) and your production domain.

## LinkedIn App Configuration

### 1. Add Redirect URIs to LinkedIn App
Go to [LinkedIn Developer Portal](https://developer.linkedin.com) and add these redirect URIs:

```
# For Local Development
http://localhost:8000/connections/auth/linkedin/callback

# For Production
https://agent-emily.onrender.com/connections/auth/linkedin/callback
```

### 2. Ensure Required Products are Enabled
- ✅ Share on LinkedIn (Default Tier)
- ✅ Sign In with LinkedIn using OpenID Connect (Standard Tier)

### 3. OAuth Scopes Configuration

**Scopes Status in Your App:**
- ✅ `openid` - **Configured & Auto-approved**
- ✅ `profile` - **Configured & Auto-approved**
- ✅ `email` - **Configured & Auto-approved**
- ⚠️ `w_member_social` - **Configured but NEEDS approval for posting**

**Important Distinction:**
- **"Configured"** = Scopes added to your app settings
- **"Approved"** = LinkedIn has reviewed and granted permission

**❌ Excluded (Require Special Approval - Often Rejected):**
- `w_organization_social` - Post to organization pages
- `r_organization_social` - Read organization data
- `rw_organization_admin` - Manage organization settings

**To enable organization scopes** (only if needed):
```env
LINKEDIN_INCLUDE_ORG_SCOPES=true
```

## Environment Configuration

### Backend Configuration

#### For Local Development (`backend/.env`):
```env
# Environment
ENVIRONMENT=development

# API URLs
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# LinkedIn Credentials
LINKEDIN_CLIENT_ID=77hic9feenwtii
LINKEDIN_CLIENT_SECRET=your_actual_linkedin_client_secret

# CORS (allow localhost)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

#### For Production (`backend/.env`):
```env
# Environment
ENVIRONMENT=production

# API URLs
API_BASE_URL=https://agent-emily.onrender.com
FRONTEND_URL=https://emily.atsnai.com

# LinkedIn Credentials
LINKEDIN_CLIENT_ID=77hic9feenwtii
LINKEDIN_CLIENT_SECRET=your_actual_linkedin_client_secret

# CORS (allow production domain)
CORS_ORIGINS=https://emily.atsnai.com,https://agent-emily.onrender.com
```

### Frontend Configuration

#### For Local Development (`frontend/.env`):
```env
VITE_API_URL=http://localhost:8000
```

#### For Production (`frontend/.env`):
```env
VITE_API_URL=https://agent-emily.onrender.com
```

## Testing

### Local Development:
1. Start backend: `cd backend && python main.py`
2. Start frontend: `cd frontend && npm run dev`
3. Test LinkedIn connection in browser at `http://localhost:3000`

### Production:
1. Deploy backend to render.com
2. Deploy frontend to vercel/netlify
3. Test LinkedIn connection on your production domain

## Code Changes Made

### Backend Changes:
- Added environment-based logic in `generate_oauth_url()` function
- LinkedIn OAuth now detects localhost vs production automatically
- Updated test endpoint to use environment-based redirect URIs

### Frontend Changes:
- Updated `.env.example` to show both local and production configurations

## Troubleshooting

### If localhost doesn't work:
1. Use ngrok: `ngrok http 8000`
2. Add ngrok URL to LinkedIn app redirects
3. Set `API_BASE_URL=https://your-ngrok-url.ngrok.io`

### If production doesn't work:
1. Check that production URLs are added to LinkedIn app
2. Verify environment variables are set correctly on render.com
3. Check render.com logs for any errors

### Common Issues:
- **"Invalid redirect URI"**: URI not registered in LinkedIn app
- **"CORS error"**: Frontend/backend URL mismatch
- **"Client ID not found"**: Wrong client ID in environment variables

## Permissions Required

Your LinkedIn app needs these permissions approved:
- `w_member_social` (for posting to personal profiles)
- `openid`, `profile`, `email` (for basic user info)

Note: `w_member_social` requires LinkedIn approval and may take 1-2 weeks.
