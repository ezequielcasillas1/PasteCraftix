# 🚀 PasteCraft - Authentication Setup

## Welcome! You're 3 steps away from a fully working authentication system.

---

## ⚡ Quick Start (Choose One)

### Option A: Guided Setup (Recommended)
**Time: 25 minutes** | **For first-time users**

Follow the detailed checklist:
```
📄 Open: docs/SETUP_CHECKLIST.md
```

### Option B: Fast Setup (Advanced)
**Time: 5 minutes** | **For experienced developers**

Follow the quick guide:
```
📄 Open: docs/QUICK_START_AUTH.md
```

---

## 🎯 What You Need

Before starting, create accounts at:
1. **Supabase** - https://supabase.com (free tier works)
2. **Google Cloud Console** - https://console.cloud.google.com (free)

---

## 📝 Setup Overview

```
1. Create Supabase Project (5 min)
   ├── Run database schema
   └── Copy credentials
   
2. Set Up Google OAuth (5 min)
   ├── Create OAuth credentials
   └── Enable in Supabase
   
3. Update Configuration (2 min)
   ├── config.js → Add Supabase credentials
   └── manifest.json → Add Google Client ID
   
4. Load & Test Extension (3 min)
   ├── Load in Chrome
   ├── Test sign up
   └── Test sign in
```

---

## 🔧 Configuration Files

### 1. config.js (Required)
```javascript
const PASTECRAFT_CONFIG = {
  supabase: {
    url: 'https://xxx.supabase.co',  // ← Add your Supabase URL
    anonKey: 'eyJ...'                 // ← Add your Anon Key
  }
};
```

### 2. manifest.json (Required)
```json
{
  "oauth2": {
    "client_id": "xxx.apps.googleusercontent.com"  // ← Add Google Client ID
  }
}
```

---

## ✅ Test Your Setup

Before loading the extension, test your configuration:

```
1. Open: test-supabase-connection.html in your browser
2. Click "Test Supabase Connection"
3. Try sign up with test email
4. Verify everything works
```

---

## 📚 Available Documentation

All documentation is now organized in the **`docs/`** folder!

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `docs/SETUP_CHECKLIST.md` | Step-by-step checklist | First time setup |
| `docs/QUICK_START_AUTH.md` | Fast reference guide | Quick setup |
| `docs/AUTHENTICATION_SETUP.md` | Detailed instructions | Troubleshooting |
| `docs/README_AUTHENTICATION.md` | System overview | Understanding the system |
| `docs/TASK_12_SUMMARY.md` | Implementation details | Technical reference |
| `docs/DEPLOYMENT.md` | Chrome Web Store guide | Publishing extension |
| `test-supabase-connection.html` | Test tool | Verify configuration |

---

## 🎯 Success Checklist

After setup, you should have:
- [x] Supabase project created
- [x] Database schema executed
- [x] Google OAuth configured
- [x] config.js updated
- [x] manifest.json updated
- [x] Extension loaded in Chrome
- [x] Authentication working

---

## 🆘 Getting Help

### Common Issues

**"Supabase not initialized"**
→ Check config.js has correct URL and Anon Key

**"Google OAuth failed"**
→ Verify Client ID in manifest.json matches Google Console

**"Table doesn't exist"**
→ Run supabase-auth-schema.sql in Supabase SQL Editor

**"RLS policy error"**
→ Make sure you ran the complete schema file

### Test Your Setup
Open `test-supabase-connection.html` in browser to diagnose issues

---

## 🎉 What's Included

Your authentication system includes:

✅ **Email/Password Authentication**
- Sign up with email
- Sign in with credentials
- Password validation
- Email verification (optional)

✅ **Google OAuth**
- One-click Google sign in
- Automatic account creation
- Secure OAuth flow

✅ **User Management**
- Three subscription tiers (free/premium/admin)
- Automatic free tier on signup
- Row Level Security (RLS)

✅ **Admin Portal**
- Separate admin login
- Admin-only access
- User management ready

✅ **Session Management**
- Persistent sessions
- Automatic token refresh
- Secure sign out

---

## 🚀 Next Steps After Setup

Once authentication works:
1. **Customize**: Update email templates in Supabase
2. **Add Features**: Integrate Stripe for premium tier
3. **Deploy**: Package extension for Chrome Web Store
4. **Monitor**: Track users in Supabase dashboard

---

## 📞 Ready to Begin?

1. **Choose your path** (Guided or Fast)
2. **Open the appropriate guide**
3. **Follow the steps**
4. **Test thoroughly**
5. **Start using PasteCraft!**

---

**Estimated Total Time**: 25-30 minutes

**Result**: Production-ready authentication system 🎉

Let's get started! 🚀


