# 📧 Email Verification Setup Guide

## Problem
You're not receiving verification emails from Supabase after signing up.

## Solutions

### Option 1: Disable Email Confirmation (Recommended for Development)

**For quick testing and development, disable email verification:**

1. Go to your **Supabase Dashboard**: https://app.supabase.com
2. Select your project: `PasteCraft`
3. Go to **Authentication** → **Providers** (in the left sidebar)
4. Find **Email** provider
5. Scroll down to **"Confirm email"**
6. **Toggle OFF** "Confirm email" 
7. Click **Save**

✅ **Now you can sign in immediately after signing up without email verification!**

---

### Option 2: Configure Email Delivery (For Production)

If you want email verification to work properly:

#### Step 1: Set up SMTP Settings

1. In Supabase Dashboard → **Project Settings** → **Authentication**
2. Scroll to **SMTP Settings**
3. Enable **"Enable Custom SMTP"**
4. Configure with your email provider (Gmail, SendGrid, etc.)

#### Example: Using Gmail

```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: [App Password - see below]
Sender email: your-email@gmail.com
Sender name: PasteCraft
```

#### Gmail App Password Setup:
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Go to **App Passwords**
4. Generate password for "Mail"
5. Use that 16-character password in Supabase

---

### Option 3: Use the Resend Button

We've added a **"Resend verification email"** link in the Sign In form:

1. Enter your email in the Sign In form
2. Click **"Didn't receive verification email? Resend it"**
3. Check your spam folder
4. Wait a few minutes for delivery

---

## Testing After Setup

### If you disabled email confirmation (Option 1):

1. Sign Up with any email/password
2. Sign In immediately (no verification needed)
3. ✅ You're in!

### If you configured SMTP (Option 2):

1. Sign Up
2. Check email (and spam)
3. Click verification link
4. Come back and Sign In

---

## Current Status

- ✅ Sign Up form with password validation
- ✅ Resend verification email button
- ✅ Clear error messages
- ⚠️ Email delivery needs configuration in Supabase

## Quick Fix Command

**Temporarily disable email confirmation for testing:**

```sql
-- Run this in Supabase SQL Editor
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'your-email@example.com';
```

Replace `your-email@example.com` with the email you used to sign up.

---

## Support

If you continue having issues:
1. Check Supabase logs: Dashboard → **Logs** → **Auth**
2. Verify project URL and anon key in `config.js`
3. Test with a different email provider

✨ **Recommended**: Disable email confirmation for development to get started quickly!

