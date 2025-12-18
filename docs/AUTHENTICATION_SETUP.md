# 🔐 PasteCraft Authentication System Setup Guide

## Task #12 Implementation Complete ✅

This guide will help you set up the full authentication system with email/password and Google OAuth for PasteCraft.

---

## 📋 What's Been Implemented

✅ **Email/Password Authentication**
- Sign up with email verification
- Sign in with email/password
- Password strength validation (min 8 characters)
- Terms & conditions acceptance

✅ **Google OAuth Integration**
- Sign in with Google
- Sign up with Google
- Automatic account creation on first OAuth sign in

✅ **Admin Portal**
- Separate admin authentication
- Admin-only access controls
- Admin tier validation

✅ **User Subscription System**
- Three tiers: `free`, `premium`, `admin`
- Automatic free tier assignment on signup
- Subscription status tracking
- Stripe integration ready (customer_id, subscription_id fields)

✅ **Row Level Security (RLS)**
- Users can only access their own data
- Admins can view all subscriptions
- Secure database policies

---

## 🚀 Setup Instructions

### Step 1: Set Up Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish setting up (this may take a few minutes)
3. Once ready, go to **Settings** → **API**
4. Copy your:
   - **Project URL** (e.g., `https://xxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)

### Step 2: Run Database Schema

1. In your Supabase Dashboard, go to **SQL Editor**
2. Open the file `supabase-auth-schema.sql` from this project
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **Run** to execute the schema
6. Verify success - you should see:
   - `user_subscriptions` table created
   - Indexes created
   - RLS policies applied

### Step 3: Configure Google OAuth

#### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Google+ API"
   - Click **Enable**

4. Create OAuth 2.0 Credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **+ CREATE CREDENTIALS** → **OAuth client ID**
   - Select **Web application**
   - Add **Name**: "PasteCraft Extension"
   - Add **Authorized redirect URIs**:
     ```
     https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
     ```
     (Replace `[YOUR-PROJECT-REF]` with your Supabase project reference from Step 1)
   - Click **Create**
   - **Copy** your **Client ID** and **Client Secret**

#### B. Enable Google Provider in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Find **Google** in the list
3. Toggle it to **Enabled**
4. Paste your **Client ID** and **Client Secret** from Google
5. Click **Save**

### Step 4: Update Extension Configuration

#### A. Update `config.js`

Create or update `config.js` with your Supabase credentials:

```javascript
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'https://YOUR-PROJECT-REF.supabase.co', // From Step 1
    anonKey: 'YOUR-ANON-KEY-HERE' // From Step 1
  },
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY' // Optional, for AI features
  },
  replicate: {
    apiToken: 'YOUR_REPLICATE_TOKEN' // Optional, for image generation
  }
};
```

#### B. Update `manifest.json`

Replace `YOUR_GOOGLE_CLIENT_ID` with your Google Client ID:

```json
{
  "oauth2": {
    "client_id": "123456789-abc123.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  }
}
```

### Step 5: Test Authentication

1. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select your PasteCraft directory

2. Click the extension icon
3. You should see the **Welcome to PasteCraft** auth modal

4. Test Email Sign Up:
   - Enter email and password
   - Check "I agree to terms"
   - Click **Create Account**
   - Check your email for verification link
   - Click verification link
   - Return to extension and sign in

5. Test Google Sign In:
   - Click **Sign in with Google**
   - Complete OAuth in new tab
   - Should automatically sign in

6. Test Sign Out:
   - Click the **Sign Out** button (top right)
   - Should return to auth modal

---

## 👥 User Subscription Tiers

### Free Tier (Default)
- Assigned automatically on signup
- Basic clipboard features
- Local storage only
- Limited to 20 active clips

### Premium Tier
- All AI features unlocked
- Cloud sync across devices
- Unlimited clip history
- Priority support

### Admin Tier
- Full system access
- View all user subscriptions
- Admin dashboard access
- User management

---

## 🔑 Creating Your First Admin User

1. Sign up for a regular account through the extension
2. Find your User ID in Supabase:
   - Go to **Authentication** → **Users**
   - Find your email
   - Copy the **UUID** (e.g., `abc123...`)

3. Run this SQL in Supabase SQL Editor:
```sql
UPDATE user_subscriptions
SET subscription_tier = 'admin'
WHERE user_id = 'YOUR-USER-UUID-HERE';
```

4. Sign out and sign in again
5. Now click **🔐 Admin Sign In** link
6. Enter your admin credentials
7. You now have admin access!

---

## 🛡️ Security Features

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access their own data
- Admins have read-only access to subscriptions

### Password Requirements
- Minimum 8 characters
- Must match confirmation
- Stored securely by Supabase Auth

### Session Management
- Automatic session refresh
- Secure token storage
- Sign out clears all sessions

### OAuth Security
- State verification
- PKCE flow support
- Redirect URI validation

---

## 🔧 Advanced Configuration

### Email Templates (Optional)

Customize auth emails in Supabase:
1. Go to **Authentication** → **Email Templates**
2. Edit templates for:
   - Confirmation email
   - Password reset
   - Magic link

### Rate Limiting (Optional)

Configure rate limits in Supabase:
1. Go to **Authentication** → **Rate Limits**
2. Set limits for:
   - Sign ups per hour
   - Sign ins per hour
   - Password resets per hour

---

## 📊 Monitoring & Analytics

### View User Statistics

```sql
-- Total users by tier
SELECT subscription_tier, COUNT(*) as count
FROM user_subscriptions
GROUP BY subscription_tier;

-- Recent signups
SELECT email, created_at
FROM user_subscriptions
ORDER BY created_at DESC
LIMIT 10;

-- Active vs inactive users
SELECT subscription_status, COUNT(*) as count
FROM user_subscriptions
GROUP BY subscription_status;
```

---

## 🐛 Troubleshooting

### "Supabase not initialized" Error
- Check that `config.js` is loaded before `supabase-client.js`
- Verify Supabase URL and Anon Key are correct
- Check browser console for detailed errors

### Google OAuth Not Working
- Verify redirect URI matches exactly
- Check that Google+ API is enabled
- Ensure Client ID in manifest.json matches Google Console
- Try incognito mode to clear cache

### Email Verification Not Sending
- Check Supabase email settings
- Verify email service is configured
- Check spam folder
- Enable SMTP in Supabase settings (Production)

### RLS Policy Errors
- Verify schema was run successfully
- Check that `auth.uid()` is available
- Ensure user is signed in before database operations

---

## 📚 API Reference

### Authentication Methods

```javascript
// Sign up with email
await pasteCraftSupabase.signUpWithEmail(email, password);

// Sign in with email
await pasteCraftSupabase.signInWithEmail(email, password);

// Sign in with Google
await pasteCraftSupabase.signInWithGoogle();

// Sign out
await pasteCraftSupabase.signOut();

// Get current user
const user = await pasteCraftSupabase.getCurrentUser();

// Get subscription
const sub = await pasteCraftSupabase.getUserSubscription(userId);

// Check if premium
const isPremium = await pasteCraftSupabase.isPremiumUser(userId);

// Admin sign in
await pasteCraftSupabase.signInAsAdmin(email, password);
```

---

## 🎯 Next Steps

Now that authentication is set up, you can:

1. **Integrate Stripe** for premium subscriptions
2. **Add profile features** (avatars, preferences)
3. **Implement cloud sync** for clips and categories
4. **Add usage analytics** per tier
5. **Create admin dashboard** for user management

---

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] Database schema executed successfully
- [ ] Google OAuth credentials created
- [ ] Google provider enabled in Supabase
- [ ] `config.js` updated with Supabase credentials
- [ ] `manifest.json` updated with Google Client ID
- [ ] Extension loaded in Chrome
- [ ] Email signup tested
- [ ] Email signin tested
- [ ] Google OAuth tested
- [ ] Sign out tested
- [ ] Admin user created
- [ ] Admin signin tested

---

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Review Supabase logs (Dashboard → Logs)
3. Verify all configuration steps
4. Test in incognito mode
5. Check this README for troubleshooting

---

**Authentication System Implemented**: ✅ **Complete**

All authentication features from Task #12 have been successfully implemented and are ready for production use!


