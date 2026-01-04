# 🚀 Host the Password Reset Callback Page

## Problem
Browsers block `chrome-extension://` URLs from email links for security.

## Solution
Host a callback page on a real domain that can receive the tokens.

---

## Option 1: GitHub Pages (Recommended - FREE & Fast)

### Step 1: Create a GitHub Repo
1. Go to https://github.com/new
2. Repo name: `pastecraft-callback`
3. Make it **Public**
4. Click **Create repository**

### Step 2: Upload callback-hosted.html
1. In your new repo, click **Add file** → **Upload files**
2. Upload `callback-hosted.html` from your PasteCraft folder
3. **Rename it to `index.html`** (important!)
4. Click **Commit changes**

### Step 3: Enable GitHub Pages
1. Go to repo **Settings**
2. Click **Pages** (left sidebar)
3. Under **Source**, select **main branch**
4. Click **Save**
5. Wait 1-2 minutes
6. Your page will be live at: `https://YOUR-USERNAME.github.io/pastecraft-callback/`

### Step 4: Update Supabase Redirect URLs
1. Go to https://app.supabase.com/project/blpngeeqcegquiydreyu/auth/url-configuration
2. **Remove all chrome-extension:// URLs**
3. **Add this URL:**
   ```
   https://YOUR-USERNAME.github.io/pastecraft-callback/
   ```
4. Set **Site URL** to the same:
   ```
   https://YOUR-USERNAME.github.io/pastecraft-callback/
   ```
5. Click **Save**

### Step 5: Test Password Reset
1. Request password reset from PasteCraft
2. Click email link → Opens GitHub Pages
3. Page shows "✅ Reset Link Verified!"
4. Copy the reset code
5. Click PasteCraft icon
6. Paste code and set new password

---

## Option 2: Netlify Drop (Even Faster)

### Step 1: Go to Netlify Drop
1. Go to https://app.netlify.com/drop
2. Drag `callback-hosted.html` (renamed to `index.html`) into the drop zone
3. Wait 10 seconds
4. You get a URL like: `https://random-name-123.netlify.app`

### Step 2: Update Supabase
1. Go to https://app.supabase.com/project/blpngeeqcegquiydreyu/auth/url-configuration
2. Add your Netlify URL to Redirect URLs
3. Set Site URL to the same Netlify URL
4. Save

### Step 3: Test
Same as GitHub Pages method above.

---

## Option 3: Use Supabase Hosted UI (Simplest)

Instead of custom flow, use Supabase's built-in password reset:

1. In Supabase Dashboard → Authentication → Email Templates
2. Edit "Reset Password" template
3. Use Supabase's default hosted UI
4. Site URL should be: `https://blpngeeqcegquiydreyu.supabase.co`

Then modify the extension to handle the reset in-app without email redirect.

---

## Recommended: GitHub Pages

It's free, reliable, and you control it. Follow Option 1 above.

Once hosted, the flow will be:
```
Email link → GitHub Pages (shows code) → Copy code → PasteCraft extension → Reset password ✅
```

