# PasteCraft Merchant — Roadmap, Architecture & Test Lab

## 1. Vision & positioning

PasteCraft Merchant is a **subscription-gated service layer** inside the single PasteCraft extension — not a separate app. Core promise: **paste the annoying small fields** (tags first, then tag-like metadata) for Etsy/POD/multi-channel sellers. Title and description stay optional (Advanced); tags-only is the default UI. Scholar (clips, AI Lab) and Merchant (Spot, top strip, listing dock) share auth and Supabase but gate independently. Delivery: **vertical slices** in `extension/content/merchant/`, phased rollout with **user test between phases**.

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
| **Seal & Ship** (purge staging) | Low — workflow closure | Low–medium — hygiene, trust | **P1** | Strip: Seal & Ship (disabled stub → enable) | 5 |
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

- Tags-first / tags-only **default** — title/description hidden under Advanced.
- Alt text **not** core marketing lever — build only after tags + materials + snippets.
- Core Merchant = **paste the annoying small fields**, not re-type title/description.

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
| **Tag Queue** | Paste-next-tag mode | Planned | Phase 4 |
| **Snippets** | Preset library dropdown | Planned | Phase 5 |
| **Seal & Ship** | Purge staging | Stub disabled | Phase 5 |
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
  merchant.tag-queue.js              (Phase 4)
  merchant.snippets.js               (Phase 5)
  merchant.seal-ship.js              (Phase 5)

extension/background/handlers/       merchant.* handlers (sync, gating)
extension/shared/                    constants only — no cross-feature imports
```

### Rules

- Merchant modules **do not** import popup or AI Lab directly — message background when needed.
- Scholar clips feed Merchant via Spot / import only (read clip text, no permanent merge).
- Gating deferred until Phase 6 — `has_merchant` checked in controller before mount.
- DOM adapters: isolated modules, registered by `platformPreset` + host URL match (Test Lab + real Etsy).

### Test Lab slice (repo root)

```
merchant-test-lab/                   ← standalone static mocks (NOT pastecraft.com)
  index.html                         hub links
  etsy-listing-editor.html           tag slots, materials, optional title/desc
  printify-product-stub.html         keywords + variant-ish fields
  generic-multi-field-form.html      generic tag-like inputs
  social-promo-stub.html             hashtags + caption slots
  README.md                          local open instructions
```

Not included in `website/` Astro build → **not deployed to pastecraft.com** unless explicitly approved and linked.

### Shared constants (later)

- `extension/shared/merchant-constants.js` or expand `merchant.constants.js` for background/popup parity on presets and limits (Etsy 13×20, etc.).

---

## 6. Development phases

| Phase | Scope | Test gate | Status |
|---|---|---|---|
| **1** | Top strip; Spot + Image→Text entry (stubs OK) | Strip visible, no page break | ✅ Done |
| **2** | Listing Dock + Pulse + ephemeral TTL staging | Stage text; Pulse shows live/expiring | ✅ Done / verify |
| **3** | Tags-first dock UI; Etsy 13×20 validation, dedupe, preview; listing pack parse | Tags-only default; invalid tags flagged | Next |
| **4** | Tag queue; batch copy/join; platform presets (Etsy/Printify/generic) | Paste-next on Test Lab Etsy page | Planned |
| **5** | Materials queue; snippet presets; Seal & Ship purge | Materials + snippets on Test Lab | Planned |
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

**`merchant-test-lab/`** at repo root (sibling to `website/`, `extension/`).

- **Not** part of `website/` Astro `dist` build.
- **Not** linked from pastecraft.com nav until user explicitly approves (workspace rule).
- Local: open `merchant-test-lab/index.html` in browser with extension loaded.
- Optional later: separate Netlify site or `netlify.toml` redirect excluded from production — never mixed into main marketing routes.

### Mock pages (crude DOM, intentional)

| Page | Mimics | Key fields for Merchant |
|---|---|---|
| `etsy-listing-editor.html` | Etsy listing edit | 13 tag inputs, materials multi-input, optional title/desc (collapsed), 10 alt text slots (Advanced) |
| `printify-product-stub.html` | Printify product | Tags/keywords, short SEO fields, variant option rows |
| `generic-multi-field-form.html` | Any marketplace | Configurable N small text inputs |
| `social-promo-stub.html` | Pinterest/IG promo | Hashtag slots, caption, link line |
| `index.html` | Hub | Links + “last tested” checklist |

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
| Materials queue | Etsy mock | Materials tab → queue | Sequential paste into material inputs |
| Snippets | Etsy mock | Snippets → insert | Boilerplate in buyer-instructions field |
| Image→Text | Any image on page | Image→Text | OCR text lands in dock tags |
| Seal & Ship | Any | Seal & Ship | Confirm → staging cleared; Pulse empty |
| Etsy tag DOM adapter | Etsy mock → real Etsy | Queue + adapter | Fields filled without manual paste |
| Materials adapter | Etsy mock | Materials queue + adapter | Material inputs populated |
| Social promo pack | Social stub | Export promo from tags | Hashtags fit platform limits |
| Gating | Any | Toggle `has_merchant` off | Strip not mounted |
| TTL expiry | Any | Wait / shorten TTL in prefs | Staging auto-clears; Pulse expired |

---

## References

- `instructions/request.md` — **#58** PasteCraft Merchant, Product Lines
- `extension/content/merchant/` — implementation slice
- `implementations.md` — phase completion log
