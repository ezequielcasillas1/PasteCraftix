# PasteCraft Merchant — Roadmap, Architecture & Test Lab

## 1. Vision & positioning

PasteCraft Merchant is a **subscription-gated service layer** inside the single PasteCraft extension — not a separate app. Core promise: **paste the annoying small fields** (tags first, then materials, snippets) for Etsy/POD/multi-channel sellers. Title and description stay optional (Advanced); tags-only is the default UI forever. Scholar (clips, AI Lab) and Merchant (Spot, top strip, listing dock) share auth and Supabase but gate independently. Delivery: **vertical slices** in `extension/content/merchant/`, phased rollout with **user test between phases**.

---

## 2. Feature assessment

| Feature | Paste pain | Marketing value | Priority | Nav / UI placement | Phase |
|---|---|---|---|---|---|
| **Tags (13×20, dedupe, preview)** | Very high — many slots, strict rules, one-by-one paste | High — core SEO story, clear differentiation | **P0 — must** | Listing Dock (primary); Spot import; Tag Queue btn (Phase 4) | 3–4 |
| **Tag queue (“paste next tag”)** | Very high — repetitive click-paste loop | High — “Merchant saves time” demo moment | **P0** | Strip: Tag Queue toggle or dock sub-action | 4 |
| **Platform presets** (Etsy / Printify / generic) | Medium — different limits per channel | Medium — multi-channel sellers, bundle upsell | **P1** | Preferences + dock preset chip | 4 |
| **Tags-only default UI** | Low (UX, not paste) | High — sharp product story vs generic clip tools | **P0** | Dock layout; title/desc under “Advanced” | 3 polish |
| **Listing pack parser** (`title:` / `desc:` / `tags:`) | Medium — AI/clip import | Medium — power users, Scholar crossover | **P1** | Spot + dock import path | 3 |
| **Materials queue** | High — structured multi-value field, repetitive | Medium — “tag-like” second field Etsy sellers know | **P1** | Dock tab or Materials slot panel; queue shares engine | 5 |
| **Snippet presets** (personalization, compliance, buyer instructions) | Medium — hard to paste *consistently* across listings | Medium — “reusable seller boilerplate” | **P1** | Strip: Snippets menu; Spot insert | 5 |
| **Merchant Pulse + ephemeral TTL** | Low — trust/UX | Medium — “not saved forever” differentiation vs Scholar | **P0** | Strip: Pulse dot + label (live) | 2 ✅ |
| **Listing Dock staging** | Medium — staging before paste | Medium — visual hub for Merchant workflow | **P0** | Strip: Listing Dock btn (live) | 2 ✅ |
| **Spot (#29)** | High — capture page/selection into dock | High — flagship Merchant action | **P0** | Strip: Spot btn (live) | 1–2 ✅ |
| **Image→Text (#21)** | Medium — OCR into dock | Medium — Scholar-adjacent, useful for tags from images | **P1** | Strip: Image→Text btn (live stub) | 1 ✅ / enrich 6 |
| **DOM adapters** (auto-fill marketplace fields) | Very high when stable — eliminates manual paste | Very high — “magic” demo | **P1** (after A+B) | Same strip actions; adapter runs on paste/fill | 7 (C) |
| **Etsy tag-input adapter** | Very high | Very high | **P1** | Phase C first adapter | 7 |
| **Materials / alt DOM adapters** | High / medium | Medium | **P2** | After tag adapter proven | 8 |
| **Alt text queue** (10 image slots) | Medium — tedious many-slot paste | Low — SEO niche, not core marketing lever | **P3 — deprioritized** | Dock “SEO pack” or Advanced tab | 9+ |
| **Social promo packs** (Pinterest/IG hashtags, captions) | Medium — different limits than Etsy | Medium — adjacent promo workflow | **P2** | Export from dock; “Promo pack” preset | 8 |
| **Variant / SKU grid paste** | High — spreadsheet → many cells | Medium — different product shape | **P2** | Future “Variant Dock” or strip overflow | 9+ |
| **Item attributes presets** | Medium — category-specific attrs | Low–medium | **P3** | Snippets / presets library | 9+ |
| **Duplicate-listing clipboard** | Medium — re-paste after Etsy duplicate | Medium — retention for power sellers | **P2** | Dock quick-load from last staging | 8 |
| **Cross-channel field packs** | Medium — one source → many platforms | Medium — bundle / Merchant-only value | **P2** | Platform preset + export actions | 4–8 |
| **Subscription gating** (`has_merchant`) | None | Required for monetization | **P1** | Hide strip if ungated; popup billing | 6 |
| **Cloud staging sync** (`merchant_listing_staging`) | Low | Medium — cross-device ephemeral | **P2** | Background sync; Pulse reflects cloud TTL | 6–7 |
| **Title / description in dock** | Low — easy big boxes in Etsy | Low — redundant for core user | **P4 — de-emphasized** | Advanced collapse only | 3 polish |

**Locked product decisions**

- Positioning: **paste the annoying small fields** — tags first, then materials, snippets; NOT title/description.
- Tags-first / tags-only **default** — title/description under Advanced; keep forever as default.
- **Big three (core Merchant):** Tags + Materials + Snippets — NOT alt text as core.
- **Core (must):** Tags, tag queue, Etsy 13×20 validation, platform presets (Etsy/Printify/generic).
- **Next highest ROI:** Materials queue (same engine as tags); Snippet presets (personalization/compliance).
- Alt text **deprioritized** — late “SEO pack” add-on only (Phase 9+ backlog); not core marketing lever.

**Merchant-worthy criteria**

- High paste pain (many small slots, strict limits, repetitive click-paste).
- Clear Merchant demo moment (time saved vs generic clip tools).
- Tag-like or queue-friendly field shape — not big-box title/description.
- Fits tags-only default UI or strip/dock workflow.

**Innovation tier summary**

| Tier | Scope | Notes |
|---|---|---|
| **Tier 1 backlog** | Materials, alt text (deprioritized), personalization snippets, cross-channel packs, variant grid | Materials/snippets Phase 5; alt text Phase 9+; variant grid Phase C+ |
| **Tier 2** | Item attributes, compliance, shop sections, social promo, duplicate-listing cleanup | After big three + adapters proven |
| **Tier 3 skip** | Title/desc, price, category, shipping, photos, policies | Easy in Etsy UI; redundant for core story |

---

## 3. Top nav bar map (~1cm strip)

Fixed strip on `document.documentElement` (`merchant.mount.js`). Order left → right:

| Slot | Element | Status | Future |
|---|---|---|---|
| Brand | `Merchant` badge | ✅ Live | — |
| Pulse | Dot + `aria-live` label | ✅ Live | Cloud-sync state |
| Divider | Visual | ✅ | — |
| **Listing Dock** | Toggle ephemeral panel | ✅ Live | Tags-only default layout |
| **Spot** | Stage selection / listing pack | ✅ Live | Tag queue handoff |
| **Image→Text** | Region OCR → dock | ✅ Stub | Full #21 pipeline |
| **Tag Queue** | Paste-next-tag mode | ✅ Built | Phase 4 |
| **Snippets** | Preset library dropdown | ✅ Built | Phase 5 |
| Overflow `⋯` | Platform preset, Promo export, Advanced | Planned | Phase 4–8 |

Strip height: `MERCHANT_STRIP_HEIGHT_PX` (38). Layout compensation: `merchant.layout.js` + `pc-merchant-strip-active` on `html`.

---

## 4. Preferences model

Stored in `chrome.storage.local` (Merchant-only keys; never Scholar archive).

| Key / concept | Purpose | Phase |
|---|---|---|
| `pc_merchant_strip_enabled_v1` | Show/hide on-page strip | 1 ✅ |
| `pc_merchant_dock_staging_v1` | Ephemeral payload + `expires_at` | 2 ✅ |
| `pc_merchant_prefs_v1` (planned) | Nested prefs object | 3+ |
| → `platformPreset` | `etsy` \| `printify` \| `generic` \| `social` | 4 |
| → `tagsOnlyMode` | Default true — hide title/desc in dock | 3 |
| → `ttlHours` | Override default 24h TTL | 5 |
| → `tagDelimiter` | Batch copy delimiter preset | 4 |
| → `snippetLibrary` | User snippet presets (local) | 5 |
| → `queueAutoAdvance` | After paste, advance tag queue | 4 |
| `merchant_listing_staging` (Supabase) | Optional cloud ephemeral row | 6+ |

Popup/options: future **Merchant** section under Settings (or Merchant-only popup tab) — mirrors prefs above; strip toggle remains quick access.

---

## 5. Architecture pathway

### Vertical slices (extension)

```
extension/content/merchant/          ← Merchant content slice (primary)
  merchant.controller.js             orchestration
  merchant.top-strip.js              nav shell
  merchant.listing-dock.js           dock UI
  merchant.dock-storage.js           ephemeral CRUD + TTL
  merchant.pulse.js                  staging indicator
  merchant.spot.js                     Spot #29
  merchant.image-to-text.js          Image→Text #21
  merchant.events.js                   data-action delegation
  merchant.constants.js              keys, actions, shapes
  merchant.adapters/                   (Phase 7+) per-platform DOM
    etsy-tags.adapter.js
    etsy-materials.adapter.js
    printify-stub.adapter.js
  merchant.materials.js              (Phase 5) validation + copy one-shot
  merchant.tag-queue.js              (Phase 4)
  merchant.snippets.js               (Phase 5)

extension/background/handlers/       merchant.* handlers (sync, gating)
extension/shared/                    constants only — no cross-feature imports
```

### Rules

- Merchant modules **do not** import popup or AI Lab directly — message background when needed.
- Scholar clips feed Merchant via Spot / import only (read clip text, no permanent merge).
- Gating deferred until Phase 6 — `has_merchant` checked in controller before mount.
- DOM adapters: isolated modules, registered by `platformPreset` + host URL match (Test Lab + real Etsy).

### Test Lab slice (repo root + website public)

```
merchant-test-lab/                   ← local static serve (mirrors public mocks)
website/public/merchant-test/        ← deploy target (Netlify / pastecraft.com)
website/src/pages/merchant-test/     ← Astro hub with site nav
  index.astro                        hub + links to all mocks
  etsy.html … social-promo.html      (in public/)
  README.md                          local + production URLs
```

### Shared constants (later)

- `extension/shared/merchant-constants.js` or expand `merchant.constants.js` for background/popup parity on presets and limits (Etsy 13×20, etc.).

---

## 6. Development phases

| Phase | Scope | Test gate | Status |
|---|---|---|---|
| **1** | Top strip; Spot + Image→Text entry (stubs OK) | Strip visible, no page break | ✅ Done |
| **2** | Listing Dock + Pulse + ephemeral TTL staging | Stage text; Pulse shows live/expiring | ✅ Done / verify |
| **3** | Tags-first dock UI; Etsy 13×20 validation, dedupe, preview; listing pack parse | Tags-only default; invalid tags flagged | ✅ Done / verify |
| **4** | Tag queue; batch copy/join; platform presets (Etsy/Printify/generic) | Paste-next on Test Lab Etsy page | ✅ Built — user test |
| **5** | Dock materials (copy one-shot); snippet presets | Snippets on Test Lab | ✅ Built — user test |
| **6** | Subscription gating; optional cloud staging sync | Strip hidden without Merchant tier | Planned |
| **7** | DOM adapter — Etsy tags (Phase C) | Auto-fill Test Lab + real Etsy | Planned |
| **8** | DOM adapters — materials; social promo export; duplicate-listing quick-load | Multi-page Test Lab matrix | Planned |
| **9+** | Alt text queue (deprioritized); variant grid dock; attribute presets | Power-user QA | Backlog |

**Billing** (Stripe Merchant prices: $1.99/wk, $6.99/mo, $15.99/yr) ships with Phase 6 gating — after toolbar workflow proven.

---

## 7. Merchant Test Lab website

### Purpose

Crude mock shop forms for **manual QA** and **Phase C DOM adapter** development without Etsy, Shopify, or Printify accounts.

### Location

**Deploy target:** `website/public/merchant-test/` — copied to pastecraft.com on Netlify build.

**Local dev:** `merchant-test-lab/` at repo root (mirrors public mocks + standalone `index.html` hub).

- **Production hub:** https://pastecraft.com/merchant-test.html (Astro page + site nav/footer link)
- **Mock pages:** https://pastecraft.com/merchant-test/etsy.html (etc.)
- **Local Astro:** `cd website && npm run dev` → http://localhost:4321/merchant-test.html
- **Local static:** `npx serve merchant-test-lab -p 5173`

### Mock pages (crude DOM, intentional)

| Page | Mimics | Key fields for Merchant |
|---|---|---|
| `etsy.html` | Etsy listing edit | 13 tag inputs, materials, buyer instructions, optional title/desc + 10 alt text (Advanced) |
| `printify.html` | Printify product | 20 individual keyword inputs, variant option/SKU rows |
| `shopify.html` | Shopify product | 10 tag inputs, SEO title/description/handle |
| `amazon.html` | Amazon listing | 5 bullet points, 10 backend keyword slots |
| `ebay.html` | eBay listing | 12 item-specific key-value pairs |
| `redbubble.html` | Redbubble design | 15 tags × 39 chars |
| `teepublic.html` | TeePublic design | 32 tag slots |
| `woocommerce.html` | WooCommerce product | 10 product tag inputs |
| `generic.html` | Any marketplace | 30 configurable small inputs |
| `social-promo.html` | Pinterest/IG promo | Hashtag slots, caption, link line, Pinterest stub |
| `index.html` (merchant-test-lab only) | Static hub | Links + checklist (Astro hub replaces on site) |

DOM should use **realistic input patterns** (individual `<input>` per tag, not one textarea) so adapters match production pain.

### Phase alignment

- Phases 1–2: strip + dock on any page (including Test Lab).
- Phases 3–5: validation, queue, materials, snippets — primary QA on Etsy mock.
- Phase 7+: adapters target Test Lab first, then real Etsy.

---

## 8. Testing matrix

| Feature | Test Lab page | Extension action | Pass criteria |
|---|---|---|---|
| Strip mount | Any page | Load page with extension | Strip fixed top; page not broken |
| Listing Dock | Any | Dock toggle | Panel opens; edit tags; TTL note visible |
| Pulse | Any | Save staging | Dot + label: live → expiring → expired |
| Spot → dock | Etsy mock | Select text → Spot | Tags staged; Pulse live |
| Listing pack parse | Any | Paste pack in Spot | Tags extracted; title/desc only if Advanced |
| Tag validation 13×20 | Etsy mock | Dock save | Over-limit / duplicate warnings |
| Tag queue | Etsy mock | Tag Queue → click tag fields | Next tag pastes into correct input |
| Batch copy | Any | Dock clipboard action | Delimiter-joined export matches preset |
| Platform preset | Printify mock | Switch preset in prefs | Limits/labels match Printify rules |
| Materials copy | Etsy mock | Dock → Copy materials | Comma-joined materials on clipboard |
| Snippets | Etsy mock | Snippets → insert | Boilerplate in buyer-instructions field |
| Image→Text | Any image on page | Image→Text | OCR text lands in dock tags |
| Etsy tag DOM adapter | Etsy mock → real Etsy | Queue + adapter | Fields filled without manual paste |
| Materials adapter | Etsy mock | Copy materials + adapter | Material inputs populated (Phase 7) |
| Social promo pack | Social stub | Export promo from tags | Hashtags fit platform limits |
| Gating | Any | Toggle `has_merchant` off | Strip not mounted |
| TTL expiry | Any | Wait / shorten TTL in prefs | Staging auto-clears; Pulse expired |

---

## References

- `instructions/request.md` — **#58** PasteCraft Merchant, Product Lines
- `docs/merchant/MERCHANT-QUEUE-SYSTEM.md` — queue support vision, comma-separated rules, queue tiers
- `extension/content/merchant/` — implementation slice
- `implementations.md` — phase completion log
