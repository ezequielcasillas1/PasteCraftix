# 🎨 Installing Recraft AI in Cursor for PasteCraft Asset Generation

This guide helps you set up Recraft AI within Cursor to generate all the image assets needed for Edge Add-ons store publishing.

---

## 🌟 What is Recraft AI?

Recraft AI is a powerful AI image generation tool that supports the Model Context Protocol (MCP). This means it can integrate directly with Cursor, allowing you to generate professional images without leaving your development environment.

**Website:** https://recraft.ai

---

## 🚀 Option 1: Use Recraft AI Web Interface (Recommended)

### Quick Start (5 minutes)

1. **Visit Recraft AI**
   - Go to: https://recraft.ai
   - Click "Get Started" or "Sign Up"

2. **Create Account**
   - Sign up with email or Google
   - Free tier available for testing

3. **Start Generating**
   - Click "New Project"
   - Choose project type: "Icon", "Banner", or "Marketing"
   - Copy/paste prompts from `edge-store-assets/RECRAFT_AI_PROMPTS.md`
   - Generate images
   - Download as PNG

4. **Save Assets**
   - Download generated images
   - Place in appropriate folders:
     - Icons → `edge-store-assets/icons/`
     - Screenshots → `edge-store-assets/screenshots/`
     - Promotional → `edge-store-assets/promotional/`

---

## 🔧 Option 2: Recraft AI MCP Integration with Cursor

### What is MCP?

Model Context Protocol (MCP) allows AI assistants like Cursor to interact with external tools like Recraft AI directly from the IDE.

### Setup Steps (10-15 minutes)

#### Step 1: Check MCP Support in Cursor

1. Open Cursor Settings (Ctrl + ,)
2. Search for "MCP" or "Model Context Protocol"
3. Verify MCP is enabled

#### Step 2: Get Recraft AI API Access

1. Visit: https://recraft.ai/docs/mcp-reference/getting-started
2. Sign up for Recraft AI account
3. Navigate to API settings
4. Generate API key
5. Copy the API key (keep it secure!)

#### Step 3: Configure Recraft MCP in Cursor

1. Open Cursor settings
2. Navigate to MCP configuration (if available)
3. Add Recraft AI as MCP provider:
   ```json
   {
     "mcpServers": {
       "recraft": {
         "url": "https://api.recraft.ai/mcp",
         "apiKey": "YOUR_API_KEY_HERE"
       }
     }
   }
   ```

#### Step 4: Verify Connection

1. Restart Cursor
2. Open chat/command palette
3. Try a command like: "Generate icon using Recraft"
4. If working, Cursor will access Recraft API

---

## 📝 Using Recraft AI for PasteCraft Assets

### Generating Icons (5 sizes needed)

**Method 1: Web Interface**
1. Open Recraft AI web app
2. Create new "Icon" project
3. Copy/paste this prompt from `RECRAFT_AI_PROMPTS.md`:
   ```
   Create a modern, professional app icon for "PasteCraft", a smart clipboard manager extension...
   ```
4. Generate at 1024x1024 resolution
5. Download PNG with transparent background
6. Use image editor to scale down to: 300, 128, 48, 32, 16

**Method 2: Cursor MCP (if configured)**
1. In Cursor chat, type:
   ```
   Generate PasteCraft logo icon using the prompt from edge-store-assets/RECRAFT_AI_PROMPTS.md
   ```
2. Cursor will call Recraft API
3. Download generated image
4. Scale as needed

### Generating Promotional Images

**Marquee Promo (1400x560)**
1. Create new "Banner" project in Recraft
2. Use "Marquee Promotional Tile" prompt
3. Generate 1400x560 banner
4. Download as PNG
5. Save to `edge-store-assets/promotional/promo-marquee-1400x560.png`

**Small Promo (440x280)**
1. Create new "Banner" project
2. Use "Small Promotional Tile" prompt
3. Generate 440x280 tile
4. Download as PNG
5. Save to `edge-store-assets/promotional/promo-small-440x280.png`

---

## 🎨 Alternative: Manual Design Tools

If you prefer traditional design tools:

### Free Options
- **Photopea** (https://photopea.com) - Free online Photoshop alternative
- **Figma** (https://figma.com) - Professional design tool with free tier
- **Canva** (https://canva.com) - Easy template-based design
- **GIMP** (https://gimp.org) - Free desktop image editor

### Paid Options
- **Adobe Photoshop** - Industry standard
- **Affinity Designer** - One-time purchase alternative
- **Sketch** - Mac-only design tool

---

## 📐 Icon Scaling Guide

Once you have the 1024x1024 main logo, scale it to required sizes:

### Using Online Tools
- **ImageResizer.com** - Free online resizer
- **Squoosh.app** - Google's image optimizer
- **TinyPNG.com** - Compress and resize

### Using Photoshop/GIMP
1. Open 1024x1024 image
2. Image → Image Size
3. Set to: 300x300 → Save as `icon-300.png`
4. Repeat for: 128, 48, 32, 16
5. Ensure "Maintain Aspect Ratio" is checked
6. Use "Bicubic Sharper" for downscaling

### Using PowerShell (Automated)
```powershell
# Requires ImageMagick installed
$sizes = @(300, 128, 48, 32, 16)
foreach ($size in $sizes) {
    magick icon-1024.png -resize ${size}x${size} icon-${size}.png
}
```

---

## ✅ Asset Generation Checklist

### Icons (5 files)
- [ ] Generate main logo at 1024x1024
- [ ] Scale to 300x300 → `icon-300.png`
- [ ] Scale to 128x128 → `icon-128.png`
- [ ] Scale to 48x48 → `icon-48.png`
- [ ] Scale to 32x32 → `icon-32.png`
- [ ] Scale to 16x16 → `icon-16.png`
- [ ] Verify all look sharp and clear
- [ ] Save to `edge-store-assets/icons/`

### Promotional Images (2 files)
- [ ] Generate marquee promo 1400x560 → `promo-marquee-1400x560.png`
- [ ] Generate small promo 440x280 → `promo-small-440x280.png`
- [ ] Verify brand colors consistent
- [ ] Verify text readable
- [ ] Save to `edge-store-assets/promotional/`

### Screenshots (5 files)
- [ ] Capture main popup interface
- [ ] Capture Quick View widget
- [ ] Capture categories page
- [ ] Capture AI features page
- [ ] Capture search functionality
- [ ] Ensure 1280x800 or 640x400 dimensions
- [ ] Save to `edge-store-assets/screenshots/`

---

## 🆘 Troubleshooting

### "Can't access Recraft AI"
- Check your internet connection
- Verify account is active
- Try web interface instead of MCP

### "API key not working"
- Regenerate API key in Recraft settings
- Check for typos in configuration
- Verify API key hasn't expired

### "Generated images don't match brand"
- Adjust prompt to be more specific about colors
- Include hex codes: #1e40af, #06b6d4, #8b5cf6
- Use "Refine" feature to iterate
- Generate multiple variations and pick best

### "Icons look blurry at small sizes"
- Use vector-friendly prompts ("clean lines", "minimalist")
- Generate at higher resolution (2048x2048)
- Use sharp downscaling algorithm
- Simplify design if too detailed

---

## 💡 Pro Tips

1. **Generate Multiple Variations**
   - Create 3-5 versions of each asset
   - Pick the best one
   - Keep backups of alternatives

2. **Maintain Consistency**
   - Use same color scheme across all assets
   - Keep logo design consistent
   - Match typography style

3. **Test at Actual Size**
   - View icons at 16x16 on screen
   - Ensure logo is recognizable
   - Check readability

4. **Save Source Files**
   - Keep high-resolution originals
   - Save Recraft project files
   - Document prompts used for future reference

5. **Get Feedback**
   - Show assets to others before finalizing
   - Test on different screens
   - Verify accessibility (color contrast)

---

## 📚 Resources

- **Recraft AI Website:** https://recraft.ai
- **Recraft MCP Docs:** https://recraft.ai/docs/mcp-reference/
- **Cursor MCP Guide:** Check Cursor documentation
- **Edge Asset Requirements:** https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/

---

## ✅ You're Ready!

Choose your preferred method:
- **Quick:** Use Recraft AI web interface (recommended)
- **Integrated:** Set up MCP in Cursor (advanced)
- **Manual:** Use traditional design tools

All prompts are ready in `edge-store-assets/RECRAFT_AI_PROMPTS.md`.

**Start generating and bring PasteCraft to life! 🎨✨**

