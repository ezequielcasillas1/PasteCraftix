# 📦 Edge Store Assets

This folder contains all assets needed for publishing PasteCraft to the Microsoft Edge Add-ons store.

---

## 📂 Folder Structure

```
edge-store-assets/
├── README.md (this file)
├── RECRAFT_AI_PROMPTS.md (Recraft AI generation guide)
├── icons/
│   ├── icon-master-1024.png (source/master, optional but recommended)
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon-300.png
├── screenshots/
│   ├── screenshot-01-main-popup.png
│   ├── screenshot-02-quick-view.png
│   ├── screenshot-03-categories.png
│   ├── screenshot-04-ai-features.png
│   └── screenshot-05-search.png
└── promotional/
    ├── marquee/
    │   └── promo-marquee-1400x560.png
    ├── small/
    │   └── promo-small-440x280.png
    └── feature-icons/ (optional)
        ├── feature-clipboard.png
        ├── feature-cloud.png
        ├── feature-ai.png
        ├── feature-quick.png
        ├── feature-folders.png
        └── feature-search.png
```

---

## 🎯 Quick Start

1. **Generate Assets with Recraft AI**
   - Read `RECRAFT_AI_PROMPTS.md`
   - Visit recraft.ai
   - Use the provided prompts
   - Generate all icons and promotional materials

2. **Capture Screenshots**
   - Install PasteCraft in Edge (developer mode)
   - Open each key interface
   - Use Windows Snipping Tool (Win + Shift + S)
   - Capture at 1280x800 or 640x400
   - Save to `screenshots/` folder

3. **Verify Assets**
   - Check all files are present
   - Verify dimensions and quality
   - Ensure professional appearance

4. **Ready to Publish!**
   - See `../EDGE_STORE_PUBLISHING.md` for submission guide

---

## ✅ Asset Checklist

### Icons (Required)
- [ ] icon-16.png (16x16)
- [ ] icon-32.png (32x32)
- [ ] icon-48.png (48x48)
- [ ] icon-128.png (128x128)
- [ ] icon-300.png (300x300)

### Icons (Recommended Source)
- [ ] icon-master-1024.png (1024x1024) - keep as your “master” for future resizing/edits

### Feature Icons (Optional)
- [ ] Place optional feature icons in `promotional/feature-icons/` (not in `icons/`)

### Screenshots (Minimum 1, Recommended 5)
- [ ] screenshot-01-main-popup.png
- [ ] screenshot-02-quick-view.png
- [ ] screenshot-03-categories.png
- [ ] screenshot-04-ai-features.png
- [ ] screenshot-05-search.png

### Promotional (Optional but Recommended)
- [ ] promotional/marquee/promo-marquee-1400x560.png
- [ ] promotional/small/promo-small-440x280.png

---

## 📐 Asset Specifications

| Asset Type | Dimensions | Format | Notes |
|------------|------------|--------|-------|
| Icon (Tiny) | 16x16 | PNG | Transparent background |
| Icon (Small) | 32x32 | PNG | Transparent background |
| Icon (Medium) | 48x48 | PNG | Transparent background |
| Icon (Large) | 128x128 | PNG | Transparent background |
| Store Logo | 300x300 | PNG | Transparent or solid background |
| Screenshot | 1280x800 or 640x400 | PNG | Browser UI visible |
| Marquee Promo | 1400x560 | PNG | Solid background |
| Small Promo | 440x280 | PNG | Solid background |

---

## 🎨 Brand Guidelines

**Colors:**
- Primary: Deep Blue `#1e40af`
- Secondary: Bright Cyan `#06b6d4`
- Accent: Purple `#8b5cf6`
- Dark Mode: `#1f2937`
- Light Mode: `#ffffff`

**Typography:**
- Modern sans-serif fonts
- Clean, readable at all sizes
- Professional tech aesthetic

**Design Style:**
- Modern, minimalist
- Tech-forward
- Productivity-focused
- AI/intelligent features emphasis

---

## 🛠️ Tools Needed

**For Icon Generation:**
- Recraft AI (recraft.ai) - AI image generation
- Image editor (optional) for scaling/adjustments

**For Screenshots:**
- Microsoft Edge browser
- Windows Snipping Tool (Win + Shift + S)
- Image editor (optional) for annotations

**For Image Editing:**
- Photoshop, GIMP, or Paint.NET (optional)
- Online tools: Photopea.com, Pixlr.com

---

## 📝 Next Steps

1. **Generate all assets** using Recraft AI prompts
2. **Capture screenshots** from running extension
3. **Verify quality** of all files
4. **Update manifest.json** with final icon paths
5. **Follow publishing guide** in `../EDGE_STORE_PUBLISHING.md`

---

## 💡 Tips

- Generate multiple variations in Recraft AI and pick the best
- Keep source files (PSD, AI, etc.) for future edits
- Test icons at actual sizes to ensure readability
- Use consistent style across all assets
- Get feedback before final submission

---

**Need help?** See `RECRAFT_AI_PROMPTS.md` for detailed generation instructions.

