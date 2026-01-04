# 🚀 pastecraft.com Setup Guide

## You now own: pastecraft.com - Let's configure it!

---

## Step 1: Choose Your Hosting (Pick ONE)

### Option A: Netlify (Recommended - Easiest)

#### 1. Deploy to Netlify
1. Go to https://app.netlify.com
2. Sign up/login with GitHub
3. Click **"Add new site"** → **"Import an existing project"**
4. Or use **Netlify Drop**: https://app.netlify.com/drop
5. Drag your `callback-hosted.html` (rename to `index.html` first)
6. You'll get: `https://random-name.netlify.app`

#### 2. Add Custom Domain
1. In Netlify site dashboard → **Domain settings**
2. Click **Add custom domain**
3. Enter: `auth.pastecraft.com` (or just `pastecraft.com`)
4. Netlify gives you DNS records

#### 3. Configure Your Domain Registrar
Go to where you bought pastecraft.com and add these DNS records:

**If using `auth.pastecraft.com` (recommended):**
```
Type: CNAME
Name: auth
Value: random-name.netlify.app
```

**If using root `pastecraft.com`:**
```
Type: A
Name: @
Value: 75.2.60.5

Type: CNAME
Name: www
Value: random-name.netlify.app
```

#### 4. Enable HTTPS
- Netlify auto-provisions SSL (takes ~1 hour)
- Your callback will be at: `https://auth.pastecraft.com`

---

### Option B: GitHub Pages + Cloudflare (Free Forever)

#### 1. Create GitHub Repo
1. Go to https://github.com/new
2. Name: `pastecraft-callback`
3. Make it **Public**
4. Upload `callback-hosted.html` renamed to `index.html`

#### 2. Enable GitHub Pages
1. Repo **Settings** → **Pages**
2. Source: **main branch**
3. Click **Save**

#### 3. Add Custom Domain to GitHub
1. Still in Pages settings
2. Custom domain: `auth.pastecraft.com`
3. Click **Save**

#### 4. Configure DNS (at your registrar)
```
Type: CNAME
Name: auth
Value: YOUR-GITHUB-USERNAME.github.io
```

#### 5. Add Cloudflare (Optional - for HTTPS)
1. Go to https://cloudflare.com
2. Add site: `pastecraft.com`
3. Follow DNS migration steps
4. Enable SSL (Full)

---

## Step 2: Update Supabase Configuration

### Go to Supabase Dashboard:
https://app.supabase.com/project/blpngeeqcegquiydreyu/auth/url-configuration

### Set Site URL:
```
https://auth.pastecraft.com
```

### Set Redirect URLs (add all these):
```
https://auth.pastecraft.com
https://auth.pastecraft.com/
https://auth.pastecraft.com/*
https://pastecraft.com
https://www.pastecraft.com
```

### Click **Save**

---

## Step 3: Update Extension Code

We need to tell users to check `auth.pastecraft.com` for the reset code.

