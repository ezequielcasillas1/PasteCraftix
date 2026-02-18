# PasteCraft — Partner Center Submission Info

Use this document when submitting PasteCraft to Microsoft Edge Add-ons Partner Center.

---

## Manifest Details

| Field | Value |
|-------|-------|
| **Name** | PasteCraft |
| **Version** | 3.0.6 |
| **Default Language** | English (en) |
| **Author** | Ezequiel Casillas |

---

## Short Description (≤132 characters)

Smart clipboard manager with search, categories, Quick View, and AI. Break down text, summarize notes, and organize research clips as a study tool.

---

## Permissions (Current)

**API Permissions:**
- `contextMenus` — Right-click menu for copy/paste
- `storage` — Save clips, settings, categories locally
- `activeTab` — Access current tab for paste
- `scripting` — Inject Quick View widget
- `identity` — Google sign-in for cloud sync
- `clipboardWrite` — Paste clips to clipboard

**Host Permissions:**
- `https://*.supabase.co/*` — Cloud sync backend
- `https://api.openai.com/*` — AI text features
- `https://api.replicate.com/*` — AI image generation
- `https://*.blob.core.windows.net/*` — Image storage
- `https://accounts.google.com/*` — OAuth sign-in
- `http://127.0.0.1:7242/*` — Local dev/testing

---

## Full Description (Store Listing)

PasteCraft helps you save, organize, and reuse everything you copy—so you never lose important snippets again. Freemium model: start free, upgrade to Basic (cloud sync) or Enhanced (AI tools). Use clipboard managing as an effective learning style: break down complex text, summarize research, and organize study materials in one place. Ideal for students, researchers, and anyone who collects text, code, or images while browsing.

### Core Features (FREE)
- Clipboard history saved locally
- Fast search across saved clips
- Categories/folders to organize clips
- Notes + Albums: bundle clips, images, URLs
- One-click copy/paste and bulk actions
- Quick View widget + right-click context menu
- Productivity: Deduplicate, Sort A→Z, clip-joining (comma/newline/space/custom)
- 20+ markup formats (Markdown, LaTeX, code, MediaWiki, JIRA, etc.)
- Raw code detection for 190+ languages

### Freemium Model (Subscription Tiers)
- **Freemium (free)** — Unlimited local clips, search, categories, Notes + Albums, Quick View, markup support. Try before you upgrade.
- **Basic** — Everything Freemium + cloud sync + database storage (access clips across devices).
- **Enhanced** — Everything Basic + full AI access: AI Breakdown, Smart Summary, AI Image generation, Magic Wand, AI History, AI hints.

### Subscription Summary
- **Freemium:** Local clips + organization + search + Quick View + markup support
- **Basic:** Freemium + cloud sync
- **Enhanced:** Basic + all AI tools

### Study Tool Use
- **Break down complex text** — Copy lecture notes or articles; get ELI5, high school, college, or PhD-level explanations
- **Summarize research** — Paste long articles; generate summaries and ask follow-up questions
- **Organize study materials** — Use categories and notes to group clips by topic, course, or project
- **Code snippets** — Save and search code with syntax highlighting; join clips for study guides
- **AI hints** — Get step-by-step hints for problem-solving without full answers

### Innovative UI Widgets
- **Highlight & drag** — Select text on any page and drag it into the Quick View box to save instantly—no copy needed
- **Screenpage widget view** — Currently in use; improved widget experience coming in future releases
- One-click copy/paste, right-click context menu, and floating Quick View for fast access

### Version & Roadmap
- **You're viewing v1.0** — Full clipboard manager with AI, search, and study tools
- **v2.0 coming soon** — Enhanced widget experience and more innovations

### Links
- Website: https://pastecraft.com
- Support: https://pastecraft.com/support
- Privacy: https://pastecraft.com/privacy
- Terms: https://pastecraft.com/terms

### Follow for updates
- Facebook: https://www.facebook.com/PasteCraftOfficial
- Reddit: https://www.reddit.com/r/PasteCraft/

---

## Package Contents Checklist

- [x] **manifest.json** — Name, version, description, permissions, default language
- [ ] **Icons** — 16, 32, 48, 128, 300px (see `edge-store-assets/icons/`)
- [ ] **Screenshots** — Min 1, recommended 5 (see `edge-store-assets/screenshots/`)
- [ ] **Promotional** — Marquee 1400×560, Small 440×280 (optional)

---

## Default Language

`default_locale` is set to `en` in manifest.json.
