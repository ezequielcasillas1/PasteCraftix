# Netlify Deployment Fix - Repository Access Error

## Problem
Netlify error: "Failed to prepare repo" - Build fails before reaching build step because Netlify cannot check out the repository.

## Root Cause
Netlify's GitHub app/deploy key lost access to the repository OR branch name mismatch in Netlify settings.

## Solution Steps

### Step 1: Verify Branch Name in Netlify
1. Go to Netlify Dashboard → Your Site → **Site settings**
2. Click **Build & deploy**
3. Under **Deploy settings**, check **Branch to deploy**
4. **Must be:** `pc1.0` (case-sensitive, exact match)
5. If wrong, update and **Save**

### Step 2: Re-authorize Netlify GitHub Access
1. Go to Netlify Dashboard → **Team settings** → **Git**
2. Click **Connect to GitHub** (or **Reconnect** if already connected)
3. Authorize Netlify to access your repository
4. Select repository: `PasteCraft`
5. Grant access to `pc1.0` branch

### Step 3: Verify Build Settings
1. In Netlify → **Site settings** → **Build & deploy**
2. **Base directory:** Leave empty (root) OR set to `.`
3. **Publish directory:** `website`
4. **Build command:** Leave empty (static site)
5. **Save** settings

### Step 4: Trigger New Deploy
1. Click **Trigger deploy** → **Deploy site**
2. Or push a new commit to `pc1.0` branch
3. Watch deploy logs - should pass "preparing repo" stage

## Configuration Files

### netlify.toml (Root)
```toml
[build]
  base = "."
  publish = "website"

[functions]
  directory = "netlify/functions"
```

This tells Netlify:
- Build from repository root
- Publish the `website` folder contents
- Functions are in `netlify/functions`

## Verification
After fix, deploy logs should show:
- ✅ "Starting to prepare the repo for build"
- ✅ "Finished preparing the repo"
- ✅ "Starting to build site"
- ✅ Build completes successfully

## If Still Failing
1. Check GitHub repository is **Public** OR Netlify has access
2. Verify `pc1.0` branch exists: `git branch -a`
3. Check Netlify logs for specific error message
4. Try disconnecting and reconnecting GitHub integration
