# 🚀 PasteCraft Authentication Setup Checklist

## Complete this checklist to activate authentication

---

## ☑️ Phase 1: Supabase Setup (10 minutes)

### Step 1.1: Create Supabase Project
- [ ] Go to [https://supabase.com](https://supabase.com)
- [ ] Click "New Project"
- [ ] Enter project details:
  - [ ] Name: `PasteCraft`
  - [ ] Database Password: (save this securely)
  - [ ] Region: (choose closest to you)
- [ ] Click "Create new project"
- [ ] Wait for project to finish setup (~2 minutes)

### Step 1.2: Get Supabase Credentials
- [ ] Once ready, go to **Settings** → **API**
- [ ] Copy **Project URL** (e.g., `https://xxxx.supabase.co`)
- [ ] Copy **Anon/Public Key** (starts with `eyJ...`)
- [ ] Save these for next step

### Step 1.3: Update config.js
- [ ] Open `config.js` in your editor
- [ ] Replace `YOUR_SUPABASE_PROJECT_URL_HERE` with your Project URL
- [ ] Replace `YOUR_SUPABASE_ANON_KEY_HERE` with your Anon Key
- [ ] Save the file

### Step 1.4: Run Database Schema
- [ ] In Supabase Dashboard, go to **SQL Editor**
- [ ] Click **New Query**
- [ ] Open `supabase-auth-schema.sql` from this project
- [ ] Copy entire contents
- [ ] Paste into SQL Editor
- [ ] Click **Run** (play button)
- [ ] Verify success message appears
- [ ] Check: Go to **Database** → **Tables** → Should see `user_subscriptions`

---

## ☑️ Phase 2: Google OAuth Setup (10 minutes)

### Step 2.1: Create Google Cloud Project
- [ ] Go to [https://console.cloud.google.com](https://console.cloud.google.com)
- [ ] Click "Select a project" → "New Project"
- [ ] Enter project name: `PasteCraft Extension`
- [ ] Click "Create"
- [ ] Wait for project creation

### Step 2.2: Enable Google+ API
- [ ] In Google Cloud Console, click "APIs & Services" → "Library"
- [ ] Search for "Google+ API"
- [ ] Click on it
- [ ] Click "Enable"
- [ ] Wait for API to enable

### Step 2.3: Create OAuth Credentials
- [ ] Go to "APIs & Services" → "Credentials"
- [ ] Click "+ CREATE CREDENTIALS" → "OAuth client ID"
- [ ] If prompted, configure consent screen:
  - [ ] Choose "External"
  - [ ] Fill in app name: `PasteCraft`
  - [ ] Add your email
  - [ ] Click "Save and Continue" through all steps
- [ ] Select Application Type: **Web application**
- [ ] Name: `PasteCraft Extension`
- [ ] Add Authorized redirect URIs:
  - [ ] Format: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
  - [ ] Replace `YOUR-PROJECT-REF` with your Supabase project reference
  - [ ] Example: `https://abcdefgh.supabase.co/auth/v1/callback`
- [ ] Click "Create"
- [ ] **IMPORTANT**: Copy your **Client ID** (ends with `.apps.googleusercontent.com`)
- [ ] **IMPORTANT**: Copy your **Client Secret**

### Step 2.4: Configure Supabase Google Provider
- [ ] In Supabase Dashboard, go to **Authentication** → **Providers**
- [ ] Find "Google" in the list
- [ ] Toggle it to **Enabled**
- [ ] Paste your **Client ID** from Google
- [ ] Paste your **Client Secret** from Google
- [ ] Click "Save"

### Step 2.5: Update manifest.json
- [ ] Open `manifest.json` in your editor
- [ ] Find the `oauth2` section
- [ ] Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
- [ ] Save the file

---

## ☑️ Phase 3: Load Extension (2 minutes)

### Step 3.1: Load in Chrome
- [ ] Open Chrome browser
- [ ] Go to `chrome://extensions/`
- [ ] Enable **Developer mode** (toggle in top right)
- [ ] Click "Load unpacked"
- [ ] Select your PasteCraft project folder
- [ ] Extension should appear in list

### Step 3.2: Verify Installation
- [ ] Check that extension icon appears in Chrome toolbar
- [ ] Click extension icon
- [ ] Should see "Welcome to PasteCraft" auth modal
- [ ] If you see errors, check browser console (F12)

---

## ☑️ Phase 4: Test Authentication (5 minutes)

### Test 4.1: Email Sign Up
- [ ] Click extension icon
- [ ] Click "Sign Up" tab
- [ ] Enter email address
- [ ] Enter password (min 8 characters)
- [ ] Confirm password
- [ ] Check "I agree to terms"
- [ ] Click "Create Account"
- [ ] Should see: "✅ Account created! Please check your email to verify."
- [ ] Check Supabase: **Authentication** → **Users** → Should see your email

### Test 4.2: Email Sign In
- [ ] Click "Sign In" tab
- [ ] Enter email and password
- [ ] Click "Sign In"
- [ ] Should see: "✅ Welcome back!"
- [ ] App should load normally
- [ ] Should see "Sign Out" button (top right)

### Test 4.3: Google OAuth
- [ ] Click "Sign Out" to log out
- [ ] Click "Sign in with Google"
- [ ] New tab opens with Google sign in
- [ ] Select Google account
- [ ] Grant permissions
- [ ] Should redirect back
- [ ] Should be signed in
- [ ] Check Supabase: User should be created

### Test 4.4: Verify Subscription Tier
- [ ] In Supabase Dashboard, go to **SQL Editor**
- [ ] Run this query:
```sql
SELECT email, subscription_tier, created_at 
FROM user_subscriptions 
ORDER BY created_at DESC;
```
- [ ] Should see your user with `subscription_tier = 'free'`

### Test 4.5: Sign Out
- [ ] Click "Sign Out" button (top right)
- [ ] Click "OK" to confirm
- [ ] Should return to auth modal
- [ ] Session should be cleared

---

## ☑️ Phase 5: Create Admin User (Optional)

### Step 5.1: Make Yourself Admin
- [ ] In Supabase SQL Editor, run:
```sql
UPDATE user_subscriptions 
SET subscription_tier = 'admin' 
WHERE email = 'YOUR-EMAIL-HERE';
```
- [ ] Replace `YOUR-EMAIL-HERE` with your actual email
- [ ] Run the query
- [ ] Should see "Success. 1 rows affected."

### Step 5.2: Test Admin Sign In
- [ ] Click extension icon
- [ ] Click "🔐 Admin Sign In" link
- [ ] Enter your email and password
- [ ] Click "Sign In as Admin"
- [ ] Should see: "✅ Admin access granted!"
- [ ] You now have admin-level access

---

## ☑️ Phase 6: Production Checklist

### Before Going Live
- [ ] Email verification configured (optional)
- [ ] SMTP settings configured in Supabase (for production emails)
- [ ] Privacy policy & terms of service links updated
- [ ] Google OAuth consent screen fully configured
- [ ] Rate limits configured in Supabase
- [ ] Backup admin account created
- [ ] Error logging set up
- [ ] Analytics tracking added (optional)

---

## 🎯 Success Criteria

All these should be ✅:
- [ ] Supabase project created and configured
- [ ] Database schema executed successfully
- [ ] Google OAuth credentials created and configured
- [ ] config.js updated with real credentials
- [ ] manifest.json updated with Google Client ID
- [ ] Extension loaded in Chrome without errors
- [ ] Email signup works
- [ ] Email signin works
- [ ] Google OAuth works
- [ ] Sign out works
- [ ] User subscription created with 'free' tier
- [ ] Admin user created (optional)
- [ ] Admin signin works (optional)

---

## 🆘 Troubleshooting

### Issue: "Supabase not initialized"
**Fix**: Check that config.js has correct URL and Anon Key

### Issue: Google OAuth not working
**Fix**: 
1. Verify Client ID in manifest.json
2. Check redirect URI in Google Console
3. Ensure Google+ API is enabled
4. Clear browser cache and try again

### Issue: "Invalid credentials"
**Fix**: Double-check email and password, or try password reset

### Issue: RLS policy errors
**Fix**: Re-run supabase-auth-schema.sql to ensure policies are created

---

## 📚 Reference Documents

- **Detailed Setup**: `AUTHENTICATION_SETUP.md`
- **Quick Start**: `QUICK_START_AUTH.md`
- **API Reference**: `README_AUTHENTICATION.md`
- **Implementation Details**: `TASK_12_SUMMARY.md`

---

## ✅ Completion

Once all checkboxes are ✅, your authentication system is **fully operational**!

**Time to complete**: ~25-30 minutes total

**Status after completion**: Production-ready 🚀


