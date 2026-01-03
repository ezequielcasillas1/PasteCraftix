# 🚀 Quick Publishing Checklist

Use this as your step-by-step guide to publish PasteCraft to Edge Add-ons store.

---

## Phase 1: Generate Assets (Using Recraft AI)

### Step 1: Create Icons
- [ ] Visit recraft.ai and sign in
- [ ] Use "Main Logo/Icon" prompt from `edge-store-assets/RECRAFT_AI_PROMPTS.md`
- [ ] Generate 1024x1024 PNG logo
- [ ] Scale to 5 sizes: 300, 128, 48, 32, 16
- [ ] Save to `edge-store-assets/icons/` with proper names
- [ ] Verify all icons look good at their respective sizes

### Step 2: Create Promotional Images
- [ ] Use "Marquee Promotional Tile" prompt in Recraft AI
- [ ] Generate 1400x560 PNG banner
- [ ] Save as `promo-marquee-1400x560.png` in `edge-store-assets/promotional/`
- [ ] Use "Small Promotional Tile" prompt
- [ ] Generate 440x280 PNG tile
- [ ] Save as `promo-small-440x280.png` in `edge-store-assets/promotional/`

### Step 3: Capture Screenshots
- [ ] Load PasteCraft in Edge (developer mode)
- [ ] Open main popup → capture (1280x800 or 640x400)
- [ ] Enable Quick View → capture widget on screen
- [ ] Navigate to Categories page → capture
- [ ] Navigate to AI/Images page → capture
- [ ] Navigate to Search page → capture
- [ ] Save all 5 screenshots to `edge-store-assets/screenshots/`

**Time Estimate:** 1-2 hours

---

## Phase 2: Prepare Extension Package

### Step 4: Update Manifest
- [ ] Open `manifest.json`
- [ ] Verify version number is current (3.0.6)
- [ ] Ensure all icon paths point to correct files
- [ ] Double-check permissions are accurate
- [ ] Verify host_permissions are needed
- [ ] Save changes

### Step 5: Clean Build
- [ ] Remove development-only files
- [ ] Remove console.log statements (if any)
- [ ] Delete unnecessary documentation from package
- [ ] Test extension loads without errors

### Step 6: Create ZIP Package
- [ ] Run the packaging script (see below)
- [ ] OR manually create ZIP with these files:
  ```
  ✅ manifest.json
  ✅ background.js
  ✅ content-script.js
  ✅ popup.html, popup.js
  ✅ styles.css
  ✅ config.js
  ✅ supabase-client.js, supabase.js
  ✅ callback.html, callback.js
  ✅ icon.png, logo.svg
  ✅ All HTML files needed
  ❌ NO: node_modules, .git, docs, program-study, instructions
  ❌ NO: edge-store-assets (keep separate)
  ```
- [ ] Name it: `pastecraft-v3.0.6.zip`

### Step 7: Test Package
- [ ] Unzip package to temp folder
- [ ] Load in Edge as unpacked extension
- [ ] Test all core features work
- [ ] Verify no console errors
- [ ] Test authentication flow
- [ ] Test clipboard capture and paste

**Time Estimate:** 30-60 minutes

---

## Phase 3: Prepare Store Listing

### Step 8: Create Partner Center Account
- [ ] Visit https://partner.microsoft.com/dashboard
- [ ] Register as developer ($9 one-time fee)
- [ ] Complete developer profile
- [ ] Verify email and payment method

### Step 9: Gather Store Information
- [ ] Extension name: **PasteCraft**
- [ ] Version: **3.0.6**
- [ ] Category: **Productivity**
- [ ] Short description (132 chars): Ready in `EDGE_STORE_PUBLISHING.md`
- [ ] Full description: Ready in `EDGE_STORE_PUBLISHING.md`
- [ ] Keywords: Listed in `EDGE_STORE_PUBLISHING.md`
- [ ] Support email: (Add your email)
- [ ] Privacy policy URL: https://pastecraft.com/privacy
- [ ] Terms of service URL: https://pastecraft.com/terms

### Step 10: Verify Website Pages
- [ ] https://pastecraft.com is live
- [ ] https://pastecraft.com/privacy page exists
- [ ] https://pastecraft.com/terms page exists
- [ ] https://pastecraft.com/support page exists
- [ ] All pages accessible and professional

**Time Estimate:** 20-30 minutes (if account already created)

---

## Phase 4: Submit to Store

### Step 11: Create New Submission
- [ ] Log into Partner Center
- [ ] Click "New Extension" or "New Submission"
- [ ] Upload `pastecraft-v3.0.6.zip`
- [ ] Wait for package validation (automatic)

### Step 12: Complete Store Listing
- [ ] Upload icon-128.png as main store icon
- [ ] Upload all 5 screenshots in order
- [ ] Upload promo-marquee-1400x560.png (optional but recommended)
- [ ] Upload promo-small-440x280.png (optional but recommended)
- [ ] Copy/paste short description (132 chars max)
- [ ] Copy/paste full description from `EDGE_STORE_PUBLISHING.md`
- [ ] Add all 15 keywords
- [ ] Set category: Productivity
- [ ] Set pricing: Free (with in-app purchases/subscriptions)
- [ ] Add website URLs (main, support, privacy, terms)
- [ ] Add support email

### Step 13: Configure Availability
- [ ] Set target regions (select all or specific countries)
- [ ] Set age rating (13+)
- [ ] Set visibility (public)

### Step 14: Review & Submit
- [ ] Review all information for accuracy
- [ ] Preview store listing
- [ ] Check all URLs are working
- [ ] Verify assets display correctly
- [ ] Click "Submit for Review"

**Time Estimate:** 30-45 minutes

---

## Phase 5: Post-Submission

### Step 15: Monitor Review Status
- [ ] Check Partner Center dashboard daily
- [ ] Microsoft reviews in 3-7 business days
- [ ] Respond promptly to any feedback/questions
- [ ] Make requested changes if needed

### Step 16: Launch!
- [ ] Extension approved → goes live automatically
- [ ] Verify store listing looks correct
- [ ] Test installation from store
- [ ] Share Edge Add-ons store link

### Step 17: Post-Launch Marketing
- [ ] Announce on social media
- [ ] Update pastecraft.com with store link
- [ ] Email existing users (if any)
- [ ] Request reviews from early users
- [ ] Monitor ratings and feedback

**Time Estimate:** Ongoing

---

## 📦 Packaging Script

Create a PowerShell script to package the extension:

```powershell
# Save as: package-extension.ps1

$version = "3.0.6"
$outputName = "pastecraft-v$version.zip"

# Files to include
$filesToInclude = @(
    "manifest.json",
    "background.js",
    "content-script.js",
    "popup.html",
    "popup.js",
    "styles.css",
    "config.js",
    "supabase-client.js",
    "supabase.js",
    "callback.html",
    "callback.js",
    "icon.png",
    "logo.svg",
    "index.html",
    "get-extension-id.html",
    "setup-edge.html"
)

# Create zip
Write-Host "Packaging PasteCraft v$version..."
Compress-Archive -Path $filesToInclude -DestinationPath $outputName -Force
Write-Host "✅ Package created: $outputName"
Write-Host "📦 Ready to upload to Edge Partner Center!"
```

Run: `.\package-extension.ps1`

---

## ⚠️ Important Reminders

1. **Test thoroughly** before submission
2. **Double-check** all URLs are live
3. **Verify** privacy policy and terms are published
4. **Ensure** support email is monitored
5. **Remove** all debug code and console.logs
6. **Backup** extension source code before submitting

---

## 📊 Success Metrics

After launch, track:
- Total installations
- Active users
- Ratings and reviews
- User feedback
- Premium conversion rate
- Feature usage analytics

---

## ✅ Final Checklist

Before clicking Submit:

- [ ] All assets generated and uploaded
- [ ] Extension package tested and working
- [ ] Store listing information complete
- [ ] All website pages live and accessible
- [ ] Support email ready to receive inquiries
- [ ] Privacy policy and terms published
- [ ] Extension thoroughly tested in Edge
- [ ] No console errors in production build
- [ ] All required permissions justified
- [ ] Description is accurate and compelling

---

**YOU'RE READY TO PUBLISH! 🎉**

Follow these steps in order, and PasteCraft will be live on the Edge Add-ons store within a week!

**Good luck! 🚀**

