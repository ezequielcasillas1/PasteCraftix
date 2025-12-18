# ⚡ Quick Start: Authentication Setup

## 5-Minute Setup Guide

### Prerequisites
- Chrome browser
- Supabase account (free tier works)
- Google Cloud account (free)

---

## 🚀 Step-by-Step

### 1. Supabase Setup (2 minutes)
```bash
1. Go to https://supabase.com → Create project
2. Copy Project URL and Anon Key
3. Go to SQL Editor → Run supabase-auth-schema.sql
```

### 2. Google OAuth (2 minutes)
```bash
1. https://console.cloud.google.com → Create project
2. Enable Google+ API
3. Create OAuth 2.0 Client ID
4. Add redirect: https://YOUR-PROJECT.supabase.co/auth/v1/callback
5. Copy Client ID & Secret
```

### 3. Supabase Configuration (30 seconds)
```bash
1. Supabase → Authentication → Providers
2. Enable Google
3. Paste Client ID & Secret
```

### 4. Update Code (30 seconds)

**config.js:**
```javascript
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'https://YOUR-PROJECT.supabase.co',
    anonKey: 'YOUR-ANON-KEY'
  }
};
```

**manifest.json:**
```json
{
  "oauth2": {
    "client_id": "YOUR-GOOGLE-CLIENT-ID.apps.googleusercontent.com"
  }
}
```

### 5. Test (30 seconds)
```bash
1. Load extension in Chrome
2. Sign up with email
3. Sign in with Google
4. Done! ✅
```

---

## 📝 Quick Commands

### View Users
```sql
SELECT email, subscription_tier, created_at 
FROM user_subscriptions 
ORDER BY created_at DESC;
```

### Make Admin
```sql
UPDATE user_subscriptions 
SET subscription_tier = 'admin' 
WHERE email = 'your@email.com';
```

### Check Subscription
```javascript
const sub = await pasteCraftSupabase.getUserSubscription(userId);
console.log(sub.subscription_tier); // 'free', 'premium', or 'admin'
```

---

## 🎯 Key Features

✅ Email/Password signup & signin  
✅ Google OAuth integration  
✅ Admin portal with restricted access  
✅ Three subscription tiers (free/premium/admin)  
✅ Row Level Security (RLS)  
✅ Automatic session management  
✅ Sign out functionality  

---

## 🔑 Default Behavior

- New users → **free tier**
- Email verification → **optional** (configure in Supabase)
- Session timeout → **1 week** (configurable)
- Password reset → **built-in** (via Supabase)

---

## 📚 Full Documentation

See `AUTHENTICATION_SETUP.md` for detailed setup instructions, troubleshooting, and advanced configuration.

---

**Ready to use in production!** 🚀


