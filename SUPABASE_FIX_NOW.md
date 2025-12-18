# 🔥 SUPABASE PASSWORD RESET FIX - DO THIS NOW

## The Problem
Supabase is NOT redirecting to your extension. It stays on `https://blpngeeqcegquiydreyu.supabase.co` with the error "requested path is invalid"

## The Solution - 2 Settings Required

### Step 1: Set Site URL
1. Go to: https://app.supabase.com/project/blpngeeqcegquiydreyu/auth/url-configuration
2. Find **"Site URL"** at the top
3. Set it to: `chrome-extension://nkmpfhkinojohffdichlonlipfhgbobh`
4. Click **Save**

### Step 2: Verify Redirect URLs
Make sure these are ALL in the **Redirect URLs** list:

```
chrome-extension://nkmpfhkinojohffdichlonlipfhgbobh/callback.html
chrome-extension://nkmpfhkinojohffdichlonlipfhgbobh/*
chrome-extension://*/callback.html
```

### Step 3: Reload Extension
1. Go to `edge://extensions/`
2. Find PasteCraft
3. Click the refresh icon ⟳
4. Done!

### Step 4: Test Password Reset Again
1. Click PasteCraft icon
2. Click "Forgot Password?"
3. Enter your email
4. Click the reset link from Gmail
5. Should now open `chrome-extension://nkmpfhkinojohffdichlonlipfhgbobh/callback.html` ✅

---

## Why This Happens

Supabase checks TWO things:
1. **Site URL** - The base URL of your app
2. **Redirect URLs** - Where auth callbacks can go

If Site URL is wrong (like set to localhost or blank), Supabase refuses to redirect to your extension and keeps you on the Supabase domain.

---

## Alternative: Use a Web-Based Callback

If Supabase still blocks extension URLs, we can use a hosted callback page instead:

1. Create a simple HTML page on GitHub Pages or Netlify
2. That page receives the token and opens your extension with the token
3. Set Supabase redirect URLs to that hosted page

Let me know if you need this approach!

