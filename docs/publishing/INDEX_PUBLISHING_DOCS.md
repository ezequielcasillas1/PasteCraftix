# 📦 PasteCraft Edge Add-ons Publishing - Complete Documentation Index

**Ready to publish PasteCraft to the Microsoft Edge Add-ons store!**

This index helps you navigate all the documentation and resources created for publishing.

---

## 🔄 Production updates (Chrome + Edge)

**Use this for every store update after the listing is live:**

→ **[`EXTENSION_UPDATE_PROTOCOL.md`](EXTENSION_UPDATE_PROTOCOL.md)** — version bump, package, Section G smoke, dual upload, What’s new copy for the current release.

Current release packet: **v3.0.35** (2026-08-12) — `releases/pastecraft-v3.0.35.zip`.

---

## 🚀 Quick Start (3 Easy Steps) — first publish / assets

1. **Read:** `PUBLISHING_READY.md` (overview)
2. **Generate Assets:** Follow `RECRAFT_AI_SETUP.md`
3. **Submit:** Use `PUBLISHING_CHECKLIST.md`

**Estimated Time to Publish:** ~3 hours + Microsoft review (3-7 days)

---

## 📚 Documentation Files

### 0. **EXTENSION_UPDATE_PROTOCOL.md** ⭐ UPDATES
**Purpose:** Production update protocol for Chrome Web Store + Edge Add-ons  
**Contents:** Preflight, package script, full smoke checklist, dual upload, What’s new text, rollback  
**When to use:** Every time you ship a new extension version to the live listings

### 1. **PUBLISHING_READY.md** ⭐ FIRST PUBLISH / ASSETS
**Purpose:** Complete overview and summary  
**Contents:**
- What's been created
- How to proceed (3 phases)
- Asset requirements summary
- Expected timeline
- Next immediate steps

**When to use:** Read this first to understand everything

---

### 2. **PUBLISHING_CHECKLIST.md** ✅ STEP-BY-STEP
**Purpose:** Detailed step-by-step publishing process  
**Contents:**
- Phase 1: Generate Assets (with Recraft AI)
- Phase 2: Prepare Extension Package
- Phase 3: Submit to Store
- Phase 4: Post-Submission monitoring
- Phase 5: Post-Launch marketing
- PowerShell packaging script included

**When to use:** Follow this during actual publishing process

---

### 3. **EDGE_STORE_PUBLISHING.md** 📄 FULL GUIDE
**Purpose:** Complete Edge Add-ons store requirements  
**Contents:**
- Required assets checklist (icons, screenshots, promos)
- Full store description (short & long versions)
- 15 keywords/tags for SEO
- Category selection (Productivity)
- Privacy & permissions explanation
- Testing checklist
- Packaging steps
- Submission process details

**When to use:** Reference during store listing creation

---

### 4. **RECRAFT_AI_SETUP.md** 🎨 ASSET GENERATION
**Purpose:** Guide for using Recraft AI to generate assets  
**Contents:**
- What is Recraft AI
- Option 1: Web interface (recommended)
- Option 2: MCP integration with Cursor
- Icon generation instructions
- Promotional image creation
- Alternative design tools
- Icon scaling guide
- Troubleshooting tips

**When to use:** Before/during asset generation

---

### 5. **edge-store-assets/RECRAFT_AI_PROMPTS.md** 🖼️ PROMPTS
**Purpose:** Detailed Recraft AI prompts for all assets  
**Contents:**
- Brand identity (colors, style)
- Main logo/icon prompts (5 sizes)
- Marquee promotional tile prompt (1400x560)
- Small promotional tile prompt (440x280)
- Feature icon set prompts (6 icons)
- Screenshot template prompt
- Export settings for each asset
- Quality checklist

**When to use:** Copy/paste prompts into Recraft AI

---

### 6. **edge-store-assets/README.md** 📁 ASSET FOLDER
**Purpose:** Overview of asset folder structure  
**Contents:**
- Folder structure explanation
- Quick start for asset generation
- Asset checklist
- Asset specifications table
- Brand guidelines
- Tools needed
- Next steps

**When to use:** Navigate the asset folder

---

### 7. **scripts/package-extension.ps1** 🛠️ PACKAGING SCRIPT
**Purpose:** Automated extension packaging  
**Contents:**
- PowerShell script to create ZIP package
- File validation
- Size reporting
- Success/error handling
- Ready-to-upload package creation

**When to use:** Run when ready to package extension for submission

**How to run:**
```powershell
.\scripts\package-extension.ps1
```

---

## 📂 Folder Structure

```
PasteCraft/
│
├── 📄 PUBLISHING_READY.md          ⭐ START HERE
├── 📄 PUBLISHING_CHECKLIST.md      ✅ Step-by-step guide
├── 📄 EDGE_STORE_PUBLISHING.md     📄 Full store requirements
├── 📄 RECRAFT_AI_SETUP.md          🎨 Asset generation guide
├── 📄 INDEX_PUBLISHING_DOCS.md     📑 This file
│
├── 📁 edge-store-assets/           🖼️ All assets go here
│   ├── README.md                   Asset folder overview
│   ├── RECRAFT_AI_PROMPTS.md       Detailed prompts for Recraft AI
│   │
│   ├── 📁 icons/                   5 PNG files (16,32,48,128,300)
│   │   └── PLACE_ICONS_HERE.md     Instructions
│   │
│   ├── 📁 screenshots/             5 PNG files (1280x800 or 640x400)
│   │   └── CAPTURE_SCREENSHOTS_HERE.md  Instructions
│   │
│   └── 📁 promotional/             2 PNG files (1400x560, 440x280)
│       └── GENERATE_PROMOS_HERE.md  Instructions
│
└── 📁 scripts/
    └── package-extension.ps1       🛠️ Packaging automation
```

---

## 🎯 Publishing Workflow

### Phase 1: Generate Assets (1-2 hours)
1. Read `RECRAFT_AI_SETUP.md`
2. Open `edge-store-assets/RECRAFT_AI_PROMPTS.md`
3. Visit recraft.ai and generate:
   - 5 icon sizes
   - 2 promotional images
4. Capture 5 screenshots from extension
5. Place all files in `edge-store-assets/` subfolders

### Phase 2: Package Extension (30 minutes)
1. Review `manifest.json` (version, paths)
2. Run `.\scripts\package-extension.ps1`
3. Test package in Edge (edge://extensions/)
4. Verify no errors

### Phase 3: Submit (45 minutes)
1. Register at Microsoft Partner Center ($9 fee)
2. Create new submission
3. Upload `pastecraft-v3.0.6.zip`
4. Upload all assets from `edge-store-assets/`
5. Copy store listing from `EDGE_STORE_PUBLISHING.md`
6. Submit for review

### Phase 4: Wait & Monitor (3-7 days)
1. Check Partner Center daily
2. Respond to any feedback
3. Make requested changes if needed

### Phase 5: Launch! 🎉
1. Extension goes live
2. Announce on social media
3. Update pastecraft.com
4. Monitor reviews

---

## ✅ Pre-Publishing Checklist

Use this before starting:

### Documentation
- [x] Publishing guides created
- [x] Asset generation prompts ready
- [x] Packaging script ready
- [x] Folder structure organized

### Assets to Generate
- [ ] Icons (5 PNG files)
- [ ] Screenshots (5 PNG files)
- [ ] Promotional images (2 PNG files)

### Extension Preparation
- [ ] Manifest.json verified
- [ ] Extension tested in Edge
- [ ] No console errors
- [ ] All features working

### Website Requirements
- [ ] pastecraft.com/privacy (privacy policy)
- [ ] pastecraft.com/terms (terms of service)
- [ ] pastecraft.com/support (support page)
- [ ] Support email configured

### Microsoft Requirements
- [ ] Developer account registered ($9)
- [ ] Extension package created (.zip)
- [ ] Store listing information ready
- [ ] All assets uploaded

---

## 📊 Asset Requirements Summary

| Asset Type | Quantity | Dimensions | Location |
|------------|----------|------------|----------|
| Icons | 5 | 16, 32, 48, 128, 300 | `edge-store-assets/icons/` |
| Screenshots | 5 | 1280x800 or 640x400 | `edge-store-assets/screenshots/` |
| Promo Marquee | 1 | 1400x560 | `edge-store-assets/promotional/` |
| Promo Small | 1 | 440x280 | `edge-store-assets/promotional/` |

**Total Assets Needed:** 12 files

---

## 🔗 Important Links

### Documentation
- **Publishing Overview:** `PUBLISHING_READY.md`
- **Step-by-Step Guide:** `PUBLISHING_CHECKLIST.md`
- **Store Requirements:** `EDGE_STORE_PUBLISHING.md`
- **Asset Generation:** `RECRAFT_AI_SETUP.md`
- **AI Prompts:** `edge-store-assets/RECRAFT_AI_PROMPTS.md`

### External Resources
- **Microsoft Partner Center:** https://partner.microsoft.com/dashboard
- **Edge Publishing Docs:** https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/
- **Recraft AI:** https://recraft.ai
- **PasteCraft Website:** https://pastecraft.com

---

## 💡 Tips for Success

1. **Start with Assets**
   - Generate all assets first
   - This takes the most time
   - Get feedback before finalizing

2. **Test Thoroughly**
   - Load packaged extension in Edge
   - Test all features
   - Check for console errors
   - Verify authentication works

3. **Prepare Website**
   - Ensure privacy policy is live
   - Publish terms of service
   - Set up support page
   - Configure support email

4. **Be Patient**
   - Microsoft review takes 3-7 days
   - Respond promptly to feedback
   - Don't rush the process

5. **Post-Launch Marketing**
   - Announce on social media
   - Email existing users
   - Request reviews from beta testers
   - Monitor ratings and feedback

---

## 🆘 Need Help?

### Common Questions

**Q: Where do I start?**  
A: Read `PUBLISHING_READY.md` first for complete overview

**Q: How do I generate the icons?**  
A: Follow `RECRAFT_AI_SETUP.md` and use prompts from `edge-store-assets/RECRAFT_AI_PROMPTS.md`

**Q: How do I create the package?**  
A: Run `.\scripts\package-extension.ps1` in PowerShell

**Q: What do I upload to Microsoft?**  
A: Upload `pastecraft-v3.0.6.zip` and all files from `edge-store-assets/` folders

**Q: How long does review take?**  
A: 3-7 business days typically

---

## ✅ You're Ready to Publish!

Everything you need is documented and organized. Follow these steps:

1. **Read** `PUBLISHING_READY.md` (5 min)
2. **Generate** assets with Recraft AI (1-2 hours)
3. **Package** extension (30 min)
4. **Submit** to Partner Center (45 min)
5. **Wait** for review (3-7 days)
6. **Launch!** 🎉

**Total Time:** ~3 hours of work + Microsoft review time

---

**Good luck with your Edge Add-ons store launch! 🚀**

*Created: December 26, 2025*  
*PasteCraft Version: 3.0.6*  
*Author: Ezequiel Casillas*

