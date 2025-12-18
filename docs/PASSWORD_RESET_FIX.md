# 🔧 Password Reset Error Fix

## Problem
Getting error: **"requested path is invalid"** when clicking password reset link from email.

## Root Cause
The extension's callback URL is not whitelisted in Supabase's allowed redirect URLs.

## Solution

### Step 1: Get Your Extension ID
1. Open Chrome and go to: `chrome://extensions/`
2. Find **PasteCraft** in the list
3. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### Step 2: Configure Supabase Redirect URLs
1. Go to: https://app.supabase.com/project/blpngeeqcegquiydreyu
2. Navigate to: **Authentication** → **URL Configuration**
3. Scroll to **Redirect URLs** section
4. Add these URLs (replace `YOUR-EXTENSION-ID` with your actual ID):
   ```
   chrome-extension://YOUR-EXTENSION-ID/callback.html
   chrome-extension://YOUR-EXTENSION-ID/*
   chrome-extension://*/callback.html
   ```
5. Click **Save**

### Step 3: Test Password Reset
1. Reload PasteCraft extension in Chrome (`chrome://extensions/` → click refresh icon)
2. Click PasteCraft extension icon
3. Click "Forgot Password?"
4. Enter your email and submit
5. Check Gmail for reset email
6. Click the reset link → Opens `callback.html` in new tab
7. Callback page will show: "✅ Password Reset Verified! Click extension icon..."
8. Click PasteCraft extension icon
9. Set your new password ✅

## How Password Reset Works (Technical)

### The Correct Flow:
```
User clicks "Forgot Password"
    ↓
PasteCraft sends email to Supabase with redirectTo: chrome-extension://[id]/callback.html
    ↓
Supabase emails reset link to user's Gmail
    ↓
User clicks link in Gmail
    ↓
Opens callback.html in NEW TAB with recovery tokens in URL hash
    ↓
callback.js extracts tokens and stores them in chrome.storage.local
    ↓
User clicks PasteCraft extension icon
    ↓
popup.js checks chrome.storage.local for password_reset_callback
    ↓
If found, shows "Set New Password" modal
    ↓
User sets new password, tokens are consumed ✅
```

## Common Misconceptions

❌ **WRONG**: "The sign-in page needs to stay open for password reset to work"
✅ **CORRECT**: Password reset tokens are stored in Chrome's local storage, tabs can close

❌ **WRONG**: "The error happens because I switched to Gmail tab"
✅ **CORRECT**: The error happens because Supabase doesn't recognize the callback URL

## Verification

After configuring Supabase, check the callback logs:

1. Click reset link from email
2. When callback.html opens, press `F12` to open DevTools
3. Check Console tab for logs:
   ```
   ✅ Hash found, parsing parameters...
   🔑 PASSWORD RECOVERY DETECTED!
   💾 Storing recovery data to chrome.storage.local...
   ✅ Recovery tokens stored successfully!
   ```

If you see these logs, the fix worked! 🎉

## Still Not Working?

Check these:

1. **Extension ID matches**: The ID in Supabase redirect URLs matches your actual extension ID
2. **Extension reloaded**: After changing Supabase config, reload the extension
3. **Cache cleared**: Try clearing browser cache or use Incognito mode
4. **Supabase tier**: Free tier allows up to 3 redirect URLs (should be enough)

## Support

If still having issues, check:
- Supabase logs: Dashboard → Logs → Auth logs
- Extension logs: `chrome://extensions/` → Click "Errors" on PasteCraft
- Console logs: Open extension → F12 → Console tab

