# 🚀 PasteCraft - Edge Add-ons Store Publishing Guide

**Extension Name:** PasteCraft  
**Version:** 3.0.6  
**Author:** Ezequiel Casillas  
**Category:** Productivity  

---

## 📋 Required Assets Checklist

### Icons (Required)
- [x] 128x128 PNG (manifest.json)
- [ ] 16x16 PNG (for store listing)
- [ ] 32x32 PNG (for store listing)
- [ ] 48x48 PNG (for store listing)
- [ ] 128x128 PNG (for store listing)
- [ ] 300x300 PNG (store logo - recommended)

### Screenshots (Required - Minimum 1, Maximum 10)
- [ ] Screenshot 1: Main popup interface (1280x800 or 640x400)
- [ ] Screenshot 2: Quick View widget (1280x800 or 640x400)
- [ ] Screenshot 3: Categories management (1280x800 or 640x400)
- [ ] Screenshot 4: AI features (1280x800 or 640x400)
- [ ] Screenshot 5: Search functionality (1280x800 or 640x400)

### Promotional Images (Optional but Recommended)
- [ ] Marquee promo tile: 1400x560 PNG
- [ ] Small tile: 440x280 PNG

### Video (Optional)
- [ ] YouTube demo video URL

---

## 📝 Store Listing Information

### Short Description (132 characters max)
**Smart clipboard manager with AI-powered features, cloud sync, and seamless paste management for Edge browser.**

### Full Description (10,000 characters max)

**PasteCraft - Your Intelligent Clipboard Manager for Microsoft Edge**

Transform the way you copy and paste with PasteCraft, the ultimate clipboard management extension designed specifically for Microsoft Edge users. Say goodbye to lost clipboard history and hello to effortless productivity.

**🎯 Core Features**

**Smart Clipboard History**
• Never lose a copied item again - automatic clipboard capture
• Unlimited local storage for all your clips
• Organize clips with custom categories and tags
• Quick search across all your clipboard history
• Bulk operations: copy, delete, and manage multiple clips at once

**☁️ Cloud Sync (Premium)**
• Seamlessly sync your clipboard across all devices
• Access your clips from any browser with Edge installed
• Automatic backup and restore functionality
• Real-time synchronization across devices
• Secure cloud storage with Supabase

**🤖 AI-Powered Tools (Premium)**
• **Text Breakdown:** Analyze and structure complex text intelligently
• **Smart Summary:** Generate concise summaries of long content
• **Image Generation:** Create custom images from text descriptions
• **OCR Text Extraction:** Extract text from images instantly

**⚡ Quick View Widget**
• Floating widget for instant access to recent clips
• Right-click context menu integration
• One-click paste to any text field
• Customizable widget position and appearance
• Hotkey support for power users

**🎨 Beautiful Modern UI**
• Dark mode support for comfortable night-time use
• Clean, intuitive interface
• Smooth animations and transitions
• Fully responsive design
• Customizable themes

**🔒 Privacy & Security**
• All data encrypted in transit and at rest
• Google OAuth secure authentication
• Local-first approach - works offline
• Optional cloud sync (you control your data)
• No tracking or analytics without consent

**💎 Free vs Premium**

**FREE Tier:**
✅ Unlimited clips (local storage)
✅ Categories and organization
✅ Search functionality
✅ Quick View widget
✅ Batch operations
❌ No cloud sync
❌ No AI features

**PREMIUM Tier:**
✅ Everything in Free
✅ Cloud sync across devices
✅ AI-powered text breakdown
✅ Smart text summarization
✅ AI image generation
✅ Image-to-text (OCR)
✅ Priority support
✅ Backup and restore

**🚀 Getting Started**

1. Install PasteCraft from the Edge Add-ons store
2. Click the PasteCraft icon in your toolbar
3. Sign in with Google (or use locally)
4. Start copying - PasteCraft automatically captures everything!
5. Access your clips via the popup, Quick View widget, or right-click menu

**🎯 Perfect For:**
• Developers copying code snippets
• Writers managing research and quotes
• Students organizing study materials
• Content creators gathering inspiration
• Anyone who copies and pastes frequently

**🌟 Why Choose PasteCraft?**
• Built specifically for Microsoft Edge
• Modern, fast, and reliable
• Active development and support
• Privacy-focused design
• Free tier with no time limits
• Affordable premium pricing

**💬 Support & Feedback**
Visit pastecraft.com for documentation, tutorials, and support. We're constantly improving PasteCraft based on user feedback!

**🔗 Links**
• Website: https://pastecraft.com
• Privacy Policy: https://pastecraft.com/privacy
• Terms of Service: https://pastecraft.com/terms
• Support: https://pastecraft.com/support

---

## 🏷️ Keywords/Tags (Maximum 15)

1. clipboard
2. clipboard manager
3. copy paste
4. productivity
5. clipboard history
6. text manager
7. AI assistant
8. cloud sync
9. clipboard sync
10. paste manager
11. text snippets
12. copy manager
13. clipboard tool
14. productivity tool
15. text organizer

---

## 📂 Category Selection

**Primary Category:** Productivity  
**Secondary Category:** Accessibility

---

## 🌍 Supported Languages

- English (primary)

---

## 🔗 Website & Support URLs

- **Website:** https://pastecraft.com
- **Support URL:** https://pastecraft.com/support
- **Privacy Policy:** https://pastecraft.com/privacy
- **Terms of Service:** https://pastecraft.com/terms

---

## 💰 Pricing Model

**Free with Premium Upgrade**

- Free Tier: Unlimited local clips (no cloud, no AI)
- Premium Tier: $4.99/month or $49.99/year (cloud sync + AI features)

---

## 🎯 Target Audience

- Age: 13+ (suitable for all ages)
- Audience: Professionals, students, content creators, developers, power users

---

## 📧 Publisher Information

**Developer Name:** Ezequiel Casillas  
**Contact Email:** (Add your support email)  
**Company Website:** https://pastecraft.com

---

## 🔒 Privacy & Permissions Explanation

**Required Permissions:**

1. **contextMenus** - Add "PasteCraft" to right-click menu for easy access
2. **storage** - Save your clipboard history locally
3. **activeTab** - Paste clips into active webpage text fields
4. **scripting** - Inject Quick View widget into web pages
5. **identity** - Google OAuth authentication for cloud sync
6. **clipboardWrite** - Programmatically copy clips to clipboard

**Host Permissions:**

1. **supabase.co** - Cloud sync and database (Premium)
2. **openai.com** - AI text processing features (Premium)
3. **replicate.com** - AI image generation (Premium)
4. **accounts.google.com** - Google OAuth authentication

**Privacy Commitment:**
- We never sell or share your data
- All data encrypted in transit (HTTPS)
- Local-first design - works offline
- Cloud sync is optional
- You can export/delete all data anytime

---

## 🧪 Testing Checklist Before Submission

- [ ] Extension loads without errors in Edge
- [ ] All core features work correctly
- [ ] No console errors in production
- [ ] Google OAuth login works
- [ ] Cloud sync operates smoothly (Premium)
- [ ] AI features functional (Premium)
- [ ] Quick View widget displays properly
- [ ] Context menu integration works
- [ ] Dark mode toggles correctly
- [ ] Categories save and load properly
- [ ] Search returns accurate results
- [ ] Settings persist across sessions
- [ ] Extension icon displays correctly
- [ ] All links in popup work
- [ ] Privacy policy and terms accessible

---

## 📦 Packaging Steps

1. **Clean Build**
   - Remove development files
   - Remove console.logs
   - Minify if applicable

2. **Create ZIP Package**
   - Include only production files
   - Exclude: node_modules, .git, docs, program-study, instructions
   - Include: manifest.json, all .js, .html, .css, icons, assets

3. **Verify Package**
   - Test the ZIP in Edge as unpacked extension
   - Ensure no missing files
   - Verify file paths are correct

---

## 🚀 Submission Process

1. **Register at Partner Center**
   - Visit: https://partner.microsoft.com/dashboard
   - Create developer account ($9 one-time fee)

2. **Create New Submission**
   - Upload extension ZIP
   - Fill out store listing details
   - Upload all required assets

3. **Complete Listing**
   - Add description and keywords
   - Upload screenshots
   - Set pricing/availability
   - Add support information

4. **Submit for Review**
   - Microsoft reviews within 3-7 business days
   - Address any feedback promptly
   - Once approved, extension goes live!

---

## 📈 Post-Launch

- Monitor reviews and ratings
- Respond to user feedback
- Track download metrics
- Plan feature updates based on user requests
- Maintain regular update schedule

---

## ✅ Pre-Submission Checklist

- [ ] All icons created (16, 32, 48, 128, 300)
- [ ] 5 screenshots captured
- [ ] Promotional images created
- [ ] Store description finalized
- [ ] Keywords selected
- [ ] Privacy policy live on website
- [ ] Terms of service live on website
- [ ] Support page live on website
- [ ] Extension tested thoroughly
- [ ] Developer account registered
- [ ] Extension package created
- [ ] All URLs working
- [ ] Contact email set up

---

**Ready to publish? Follow the steps above and launch PasteCraft on the Edge Add-ons store! 🎉**

