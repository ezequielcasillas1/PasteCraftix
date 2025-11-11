# 🔐 PasteCraft Chrome Extension - Complete Setup Guide

## ⚡ Authentication System Now Included!

**Version 3.0** includes full authentication with email/password and Google OAuth.

---

## 🚀 Quick Start

### New Users - Start Here!
```
📄 Open: START_HERE.md
```
This is your main entry point with links to all setup guides.

### Returning Users - Quick Reference
```
📄 Open: QUICK_START_AUTH.md
```
5-minute setup for experienced developers.

---

## 📚 Complete Documentation Index

### Setup Guides
1. **START_HERE.md** - Main entry point (start here!)
2. **docs/SETUP_CHECKLIST.md** - Detailed step-by-step checklist
3. **docs/QUICK_START_AUTH.md** - Fast 5-minute setup
4. **docs/AUTHENTICATION_SETUP.md** - Comprehensive setup guide
5. **docs/DEPLOYMENT.md** - Chrome Web Store deployment guide

### Reference Documentation
6. **docs/README_AUTHENTICATION.md** - Complete system overview
7. **docs/TASK_12_SUMMARY.md** - Implementation details
8. **supabase-auth-schema.sql** - Database schema

### Testing Tools
9. **test-supabase-connection.html** - Test your configuration
10. **config.js** - Your configuration file (update this!)

---

## 🎯 What's Included

### ✅ Authentication System
- Email/password sign up and sign in
- Google OAuth integration
- Admin portal with restricted access
- User subscription tiers (free/premium/admin)
- Automatic free tier assignment
- Sign out functionality
- Row Level Security (RLS)

### ✅ Clipboard Management
- Right-click to save text
- 20 active clips + unlimited archive
- Categories and organization
- Search functionality
- Format controls (delimiters, sort, dedupe)
- Magic wand quick format

### ✅ Profile Features
- AI-generated names
- Profile images with AI generation
- Custom avatar creation
- Settings management

---

## 🔧 Setup Requirements

### You Need Accounts At:
1. **Supabase** (https://supabase.com) - Free tier works
2. **Google Cloud Console** (https://console.cloud.google.com) - Free

### Optional (for AI features):
3. **OpenAI** (https://platform.openai.com) - For AI names/images
4. **Replicate** (https://replicate.com) - For image generation

---

## 📋 Setup Steps Overview

```
Step 1: Supabase Setup (10 min)
├── Create project
├── Run schema (supabase-auth-schema.sql)
└── Copy credentials

Step 2: Google OAuth (10 min)
├── Create OAuth credentials
├── Enable in Supabase
└── Copy Client ID

Step 3: Configuration (5 min)
├── Update config.js
└── Update manifest.json

Step 4: Test (5 min)
├── Load extension in Chrome
├── Test authentication
└── Verify everything works
```

**Total Time: ~30 minutes**

---

## 🎨 Features by Tier

### Free Tier (Default)
- ✅ Basic clipboard management
- ✅ 20 active clips
- ✅ Categories and search
- ✅ Local storage
- ❌ AI features locked
- ❌ Cloud sync disabled

### Premium Tier
- ✅ All free features
- ✅ AI name generation
- ✅ AI image generation
- ✅ Unlimited clip history
- ✅ Cloud sync across devices
- ✅ Priority support

### Admin Tier
- ✅ All premium features
- ✅ User management
- ✅ Analytics dashboard
- ✅ System administration

---

## 🧪 Testing Your Setup

Before loading the extension:
1. Open `test-supabase-connection.html` in your browser
2. Test Supabase connection
3. Try sign up/sign in
4. Verify subscription tier creation

---

## 🆘 Troubleshooting

### Common Issues & Solutions

**Issue**: "Supabase not initialized"
```
→ Update config.js with your Supabase URL and Anon Key
→ Make sure config.js loads before other scripts
```

**Issue**: "Google OAuth not working"
```
→ Verify Client ID in manifest.json
→ Check redirect URI in Google Console
→ Enable Google+ API
→ Try incognito mode
```

**Issue**: "Table doesn't exist"
```
→ Run supabase-auth-schema.sql in Supabase SQL Editor
→ Check table was created successfully
```

**Issue**: "RLS policy error"
```
→ Ensure complete schema was executed
→ Verify user is signed in
→ Check Supabase logs for details
```

**Issue**: "Please configure API keys" error
```
→ Make sure you've updated config.js with real API keys
→ Reload the extension after updating config.js
```

**Issue**: OpenAI API errors
```
→ Verify your API key is valid
→ Check you have credits in your OpenAI account
→ Make sure API key has access to GPT-3.5 and DALL-E 3
```

---

## 📞 Getting Help

1. Check `docs/AUTHENTICATION_SETUP.md` for detailed troubleshooting
2. Review browser console (F12) for error messages
3. Check Supabase logs in dashboard
4. Use `test-supabase-connection.html` to diagnose

---

## 🎉 Success Criteria

Your setup is complete when:
- [x] Extension loads without errors
- [x] Authentication modal appears
- [x] Email sign up works
- [x] Google OAuth works
- [x] Sign out works
- [x] User gets 'free' tier subscription
- [x] Data persists across sessions

---

## 🚀 After Setup

Once everything works:
1. Create your first admin user (see docs/AUTHENTICATION_SETUP.md)
2. Customize email templates in Supabase
3. Add Stripe for premium subscriptions (optional)
4. Deploy to Chrome Web Store (see docs/DEPLOYMENT.md)

---

## 📈 What's Next

### Immediate
- Test all authentication flows
- Create admin account
- Explore features

### Future Enhancements
- Stripe integration
- Advanced analytics
- Team collaboration
- API webhooks

---

## 🎯 File Structure

```
PasteCraft/
├── START_HERE.md                 ← Begin here!
├── SETUP.md                      ← This file
│
├── docs/                         ← All documentation
│   ├── README.md                 ← Docs index
│   ├── SETUP_CHECKLIST.md        ← Detailed checklist
│   ├── QUICK_START_AUTH.md       ← Fast setup
│   ├── AUTHENTICATION_SETUP.md   ← Full guide
│   ├── README_AUTHENTICATION.md  ← System docs
│   ├── TASK_12_SUMMARY.md        ← Tech details
│   └── DEPLOYMENT.md             ← Deploy guide
│
├── config.js                     ← YOUR CONFIG (update this!)
├── manifest.json                 ← Update Google Client ID
├── supabase-auth-schema.sql      ← Run in Supabase
├── test-supabase-connection.html ← Test tool
│
├── popup.html                    ← Main UI
├── popup.js                      ← Main logic
├── styles.css                    ← Styling
├── supabase-client.js            ← Supabase methods
└── background.js                 ← Background tasks
```

---

## ✅ Ready to Start?

1. Open **START_HERE.md**
2. Follow your chosen path (Guided or Fast)
3. Complete the setup steps
4. Test thoroughly
5. Start using PasteCraft!

**Time Investment**: 30 minutes  
**Result**: Production-ready authentication system 🎉

Let's build something amazing! 🚀

---

**Version**: 3.0.0  
**Status**: Production Ready  
**Authentication**: ✅ Complete  
**Documentation**: ✅ Comprehensive

