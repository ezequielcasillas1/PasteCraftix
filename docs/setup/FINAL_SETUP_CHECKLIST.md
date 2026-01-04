# ✅ Final Setup Checklist for pastecraft.com

## What We Just Did:
1. ✅ Created production-ready callback page (`index.html`)
2. ✅ Updated extension to use `https://auth.pastecraft.com`
3. ✅ Updated user messaging

---

## NOW DO THESE STEPS IN ORDER:

### Step 1: Deploy to Netlify (5 minutes)

#### A. Sign up & Deploy
1. Go to https://app.netlify.com (sign up with GitHub if needed)
2. Click **"Add new site"** → **"Deploy manually"**
3. Drag the `index.html` file into the drop zone
4. Wait 10 seconds - you'll get a URL like: `https://sparkly-unicorn-123.netlify.app`

#### B. Test It Works
1. Visit your Netlify URL in browser
2. You should see: "PasteCraft Authentication" page
3. ✅ If you see that, continue!

#### C. Add Custom Domain
1. In Netlify dashboard, click **"Domain settings"**
2. Click **"Add custom domain"**
3. Enter: `auth.pastecraft.com`
4. Click **"Verify"**

#### D. Netlify Will Show DNS Instructions
Copy the DNS record they show (usually):
```
Type: CNAME
Name: auth
Value: sparkly-unicorn-123.netlify.app
```

---

### Step 2: Configure DNS at Your Registrar (5 minutes)

Where did you buy pastecraft.com? (GoDaddy, Namecheap, Google Domains, etc.)

1. **Log into your domain registrar**
2. Find **DNS settings** or **DNS management**
3. **Add new record:**
   ```
   Type: CNAME
   Host/Name: auth
   Value: [your-site-name].netlify.app  (from Netlify)
   TTL: Automatic or 3600
   ```
4. **Save** the DNS record
5. **Wait 5-60 minutes** for DNS to propagate

#### How to Check DNS is Working:
Open command prompt and run:
```bash
nslookup auth.pastecraft.com
```

If you see an IP address → DNS is working! ✅

---

### Step 3: Enable HTTPS in Netlify (Automatic)

1. Go back to Netlify dashboard
2. After DNS propagates (~5-60 min), go to **Domain settings** → **HTTPS**
3. Netlify automatically provisions SSL certificate
4. Wait ~5-10 minutes
5. Visit `https://auth.pastecraft.com` → Should work! ✅

---

### Step 4: Configure Supabase (2 minutes)

#### Go to URL Configuration:
https://app.supabase.com/project/blpngeeqcegquiydreyu/auth/url-configuration

#### Set Site URL (at the top):
```
https://auth.pastecraft.com
```

#### Add These Redirect URLs:
```
https://auth.pastecraft.com
https://auth.pastecraft.com/
https://auth.pastecraft.com/*
https://pastecraft.com
https://www.pastecraft.com
```

#### Remove Old URLs:
- ❌ Delete all `chrome-extension://` URLs
- ❌ Delete any localhost URLs (unless you need them for dev)

#### Click **Save**

---

### Step 5: Reload Extension (30 seconds)

1. Go to `edge://extensions/`
2. Find **PasteCraft**
3. Click the **refresh icon** ⟳
4. Extension is now using the new domain!

---

### Step 6: Test Password Reset (2 minutes)

1. **Click PasteCraft icon** in Edge
2. **Click "Forgot Password?"**
3. **Enter your email** and submit
4. **Check Gmail** for reset email
5. **Click the link** → Should open `https://auth.pastecraft.com` ✅
6. **See success page** with instructions
7. **Click PasteCraft icon** → Set new password
8. **✅ SUCCESS!**

---

## Troubleshooting

### DNS Not Propagating?
- Wait longer (can take up to 24 hours, usually 5-60 minutes)
- Use https://www.whatsmydns.net to check propagation globally
- Try accessing from incognito/private browser

### "Site can't be reached"?
- DNS not propagated yet
- Check CNAME record is correct in registrar
- Make sure you used `auth` not `auth.pastecraft.com` as the host

### Netlify Shows "Domain Already Taken"?
- Someone else owns that domain on Netlify
- You need to verify ownership by adding DNS record first

### Supabase Still Giving Errors?
- Make sure you clicked "Save" in Supabase
- Clear browser cache
- Try in incognito mode
- Check that Site URL matches exactly: `https://auth.pastecraft.com`

---

## After Everything Works:

### Optional: Main Website
You can also host a marketing site at `https://pastecraft.com`:

1. Create `website` folder with your marketing HTML
2. Deploy to Netlify separately
3. Add `pastecraft.com` as custom domain (not `auth.`)
4. Configure DNS apex records

### Optional: Use Your Own Domain for Extension
If you want users to download from `https://pastecraft.com`:

1. Create Chrome Web Store listing
2. Create Edge Add-ons listing  
3. Link to download pages from pastecraft.com

---

## Summary

After these steps, your **production setup** will be:

- ✅ **Extension**: Works in Microsoft Edge
- ✅ **Password Reset**: `https://auth.pastecraft.com`
- ✅ **Email Flow**: Gmail → auth.pastecraft.com → Extension
- ✅ **SSL**: Fully encrypted HTTPS
- ✅ **Professional**: Custom domain
- ✅ **Free**: Netlify free tier (plenty for extensions)
- ✅ **Reliable**: 99.9% uptime

---

## Next Steps After Testing

1. Test with real users
2. Monitor Netlify analytics
3. Add Google Analytics to callback page (optional)
4. Set up monitoring/alerts
5. Consider adding support email/chat

You're ready for production! 🚀

