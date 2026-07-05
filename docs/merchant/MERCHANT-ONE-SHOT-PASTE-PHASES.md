# PasteCraft Merchant — One-Shot Paste: Phase Plan

**Related:** `MERCHANT-ROADMAP-AND-TEST-LAB.md` · `MERCHANT-QUEUE-SYSTEM.md` · `MERCHANT-PHASE-STATUS.md` · `docs/PASTECRAFT-FLOW.md`

---

## Overview

One-shot paste is the completion of the Merchant queue vision: instead of toggling each queue manually, a single user action fires all staged metadata types into their matching fields in sequence. The user stages a full listing payload in Listing Dock (title, description, tags, materials, keywords, bullets, hashtags), then triggers one action that dispatches each queue to its correct field group on the active provider page.

This document plans the provider adapter rollout across the existing queue infrastructure. The queue engine (`merchant.queue-factory.js`), dock storage (`merchant.dock-storage.js`), and all seven queue modules already exist. The missing layer is the DOM adapter pattern that maps dock fields to real provider inputs and fires them without user-guided focus.

---

## Metadata Types

| Dock field | Queue module | Parser | Strip toggle |
|---|---|---|---|
| `tags` | `merchant.tag-queue.js` | `parseSmartTagCandidates` | Tag Queue |
| `materials` | `merchant.material-queue.js` | `splitMaterialsInput` | Material Queue |
| `title` | `merchant.title-queue.js` | `splitQueueInput` | Title Queue |
| `description` | `merchant.description-queue.js` | `splitQueueInput` | Description Queue |
| `keywords` | `merchant.keyword-queue.js` | `splitQueueInput` (fallback: `tags`) | Keyword Queue |
| `bullets` | `merchant.bullet-queue.js` | `splitQueueInput` | Bullet Queue |
| `hashtags` | `merchant.hashtag-queue.js` | `splitQueueInput` | Hashtag Queue |

All seven queues share the same `createMerchantQueue` factory. One-shot paste calls `pasteNext` on each queue targeting the correct field group, sequenced by provider profile.

---

## Architecture Pattern

### Current (manual queue)

```
Listing Dock staging → queue toggle (per type) → user focuses field → paste-next fires
```

### One-shot target

```
Listing Dock staging → one-shot trigger → adapter resolves fields → dispatch each queue in order
```

### Key files

| File | Role in one-shot |
|---|---|
| `merchant.queue-factory.js` | Core engine — `pasteNext`, `activate`, field focus listener |
| `merchant.queue-all.js` | `refreshAllMerchantQueues`, `resetAllMerchantQueueIndices` — basis for batch reset |
| `merchant.queue-hints.js` | `isAnyMerchantQueueActive` — gate for one-shot dispatch |
| `merchant.dock-storage.js` | Source of staged payload; all queues read from here |
| `merchant.dock-target.js` | `MERCHANT_DOCK_TARGET_IDS` — canonical field routing |
| `merchant.constants.js` | `MERCHANT_PLATFORM_PRESETS`, `MERCHANT_ACTIONS`, `MERCHANT_QUEUE_LIMITS` |
| `merchant.region-text.js` | DOM text extraction for Spot/Image→Text staging |
| **`merchant.adapters/`** (planned) | Per-provider DOM selector maps + fill strategy |

### Adapter contract (planned — `merchant.adapters/`)

Each adapter exports:
- `platformId` — matches `MERCHANT_PLATFORM_PRESETS` key + `data-platform` attribute on test-lab pages
- `canHandle(url)` — URL pattern or hostname match
- `fieldMap` — dock field key → CSS selector(s) for provider inputs
- `fillStrategy` — `'focus-next'` (reuse queue engine) | `'direct-set'` (programmatic fill) | `'dispatch-input'` (trigger input event)
- `charLimits` — per-field override caps (defer to `MERCHANT_PLATFORM_PRESETS` where possible)

---

## Provider Matrix

| Platform | Test Lab | DOM complexity | Fields supported | One-shot fields | Phase | Key selectors (test lab) | Blockers / risks |
|---|---|---|---|---|---|---|---|
| **Etsy** | `etsy.html` ✅ | High | tags (13×20), materials (chips), title, description, buyer instructions | tags, materials, title, bullets (buyer notes), hashtags (social export) | **1** | `[data-field^="etsy-tag-"]`, `[data-field^="etsy-material-"]`, `[data-field="listing-title"]` | Live site uses React SPA + chip autocomplete for materials — adapter must click chip, not just set value |
| **Redbubble** | `redbubble.html` ✅ | Low | tags (15×39), title | tags, title | **1** | `[data-field^="redbubble-tag-"]`, `[data-field="redbubble-title"]` | Simple static inputs on test lab; live site may differ |
| **TeePublic** | `teepublic.html` ✅ | Low | tags (32), title | tags, title | **1** | `[data-field^="teepublic-tag-"]`, `[data-field="teepublic-title"]` | Large tag count; check pagination on live site |
| **Printify** | `printify.html` ✅ | Med | keywords (20×40), title, description | keywords, title, description | **1** | `[data-field^="printify-tag-"]`, `[data-field="printify-title"]`, `[data-field="printify-seo-desc"]` | Live site has React form; keywords field may batch-input via textarea |
| **Generic** | `generic.html` ✅ | Low | 30 configurable small inputs | tags/keywords (generic) | **1** | `[data-field^="generic-input-"]` | No fixed type — adapter uses tag-queue heuristic (`isLikelyTagInput`) |
| **Amazon** | `amazon.html` ✅ | Med | bullets (5×500), keywords (10×50), title | bullets, keywords, title | **2** | `[data-field^="amazon-bullet-"]`, `[data-field^="amazon-keyword-"]`, `[data-field="amazon-title"]` | Live Seller Central uses heavy SPA; search-term field may be single textarea in production |
| **eBay** | `ebay.html` ✅ | Med | item specifics (12 k-v pairs), title | tags (value col), title | **2** | `[data-field^="ebay-specific-value-"]`, `[data-field="ebay-title"]` | Key column is read-only on live eBay; only values are pasted — adapter must target value inputs only |
| **WooCommerce** | `woocommerce.html` ✅ | Med | tags (10+), title, short description | tags, title, description | **2** | `[data-field^="woocommerce-tag-"]`, `[data-field="woocommerce-title"]` | Real WP admin uses Select2 tag widget (comma-field) — adapter needs to trigger tokenizer |
| **Shopify** | `shopify.html` ✅ | Med | tags (10+), title, SEO title, SEO description, handle | tags, title, description | **2** | `[data-field^="shopify-tag-"]`, `[data-field="shopify-title"]`, `[data-field="shopify-seo-title"]` | Real admin is React + Polaris; tag input is a token field — adapter must fire keyboard events |
| **Social Promo** | `social-promo.html` ✅ | Low | hashtags (15), caption, link line | hashtags, description (caption) | **2** | `[data-field^="social-hashtag-"]`, `[data-field="social-caption"]` | Pinterest stub only; Instagram / Pinterest live are separate apps (no DOM adapter possible) |

---

## Phased Rollout

### Phase 1 — Test Lab adapters (simplest DOM)

**Target providers:** Etsy, Redbubble, TeePublic, Printify, Generic

**Criteria for Phase 1:**
- Provider has a test-lab mock with individual `data-field` inputs
- Tag/keyword queue already detects inputs via `isLikelyTagInput` / `isLikelyKeywordInput`
- DOM is static or minimal JS (test lab is always static)

**Goal:** One-shot triggers all staged queues against test-lab inputs without manual focus. Validate adapter contract shape.

**Dependencies before Phase 1 starts:**
- Phase 6 `has_merchant` gating (merchant.controller.js currently skips check)
- `merchant.adapters/` directory structure + base adapter interface
- A `MERCHANT_ACTIONS.ONE_SHOT_PASTE` action constant in `merchant.constants.js`
- Strip button or dock action wired to dispatch the one-shot

### Phase 2 — Test Lab adapters (medium DOM complexity)

**Target providers:** Amazon, eBay, WooCommerce, Shopify, Social Promo

**Criteria for Phase 2:**
- Phase 1 adapter contract proven and stable
- Field-type specificity required (eBay value-only, Amazon bullet vs keyword split)
- Keyword queue fallback (`fallbackDockField: 'tags'`) validated against Amazon + Printify

**Goal:** All test-lab providers covered. Full one-shot paste matrix works locally.

### Phase 3 — Live site adapters (real provider DOM)

**Target providers:** Etsy (live), then Redbubble / TeePublic, then Amazon Seller Central

**Criteria for Phase 3:**
- Phase 2 test-lab coverage complete + all passes green
- Provider-specific SPA / React form investigation done (hostname match, shadow DOM check, CSP)
- Adapter fill strategy upgraded from `'focus-next'` to `'direct-set'` or `'dispatch-input'` where needed
- Real site smoke test passes for at least tags field before declaring an adapter production-ready

**Known live-site risks per provider:**

| Provider | Risk |
|---|---|
| Etsy | React chip autocomplete — material chips need click simulation, not value set |
| Shopify | Polaris token input — keyboard events required to commit tag tokens |
| WooCommerce | Select2 tag widget — must trigger change event after value inject |
| Amazon Seller Central | Single search-term textarea on real backend (not individual slots) |
| eBay | Item specifics loaded dynamically by category — selector may differ per listing type |

---

## One-Shot Paste Flow

1. **User stages payload** — fills Listing Dock fields (tags, materials, title, description, keywords, bullets, hashtags) via manual input, Spot capture, or Image→Text.
2. **User triggers one-shot** — clicks "Fill All" strip action or dock button (`MERCHANT_ACTIONS.ONE_SHOT_PASTE`).
3. **Adapter resolves** — `merchant.adapters/<platform>.adapter.js` `canHandle(location.href)` returns `true`; fallback to generic adapter if no match.
4. **Queue refresh** — `refreshAllMerchantQueues()` reads latest staging from `merchant.dock-storage.js`; all indices reset via `resetAllMerchantQueueIndices()`.
5. **Sequential dispatch** — adapter iterates `fieldMap` in priority order (tags → materials → keywords/bullets → title → description → hashtags); for each field group, calls `pasteNext` into the matching DOM inputs.
6. **Verification** — strip hint (`merchant.queue-hints.js`) updates after each field group; toast shows progress.
7. **Done state** — when all queues report `done`, strip hint clears; optional one-shot complete toast.

**Fill strategy details:**
- `'focus-next'`: simulates focus event on each input — reuses existing `handleFieldFocus` path in `merchant.queue-factory.js`
- `'direct-set'`: sets `input.value` directly + dispatches `input` and `change` events (for React-controlled fields)
- `'dispatch-input'`: fires full keyboard event sequence for token/chip fields (Shopify, WooCommerce, Etsy materials)

---

## Implementation Checklist

### Phase 1 (Test Lab — simple providers)

- [ ] Add `MERCHANT_ACTIONS.ONE_SHOT_PASTE` to `merchant.constants.js`
- [ ] Create `merchant.adapters/` directory; write base adapter interface doc comment
- [ ] Implement `etsy-tags.adapter.js` (tags + materials + title field map)
- [ ] Implement `redbubble.adapter.js`, `teepublic.adapter.js`, `printify.adapter.js`, `generic.adapter.js`
- [ ] Wire one-shot strip button + event in `merchant.events.js` and `merchant.top-strip.js`

### Phase 2 (Test Lab — medium providers)

- [ ] Implement `amazon.adapter.js` (bullet + keyword split)
- [ ] Implement `ebay.adapter.js` (value-column only selector)
- [ ] Implement `shopify.adapter.js` + `woocommerce.adapter.js` (tag field map)
- [ ] Implement `social-promo.adapter.js` (hashtag + caption)
- [ ] Validate keyword queue fallback (`keywords` → `tags`) on Printify + Amazon adapters

### Phase 3 (Live site — real DOM)

- [ ] Research Etsy live DOM (React/SPA); write `etsy-live.adapter.js` with `'dispatch-input'` strategy
- [ ] Smoke test Etsy live: tags fill without page reload, materials chip trigger works
- [ ] Port lessons to Redbubble + TeePublic live adapters (simpler DOM expected)
- [ ] Document live-site adapter findings in `MERCHANT-ROADMAP-AND-TEST-LAB.md` Phase 7 notes

---

## Dependencies

| Dependency | Required for | Status |
|---|---|---|
| Phase 6 `has_merchant` gating | All phases — strip must not mount without merchant tier | Planned (`merchant.controller.js`) |
| `merchant.queue-factory.js` — `pasteNext` | All queue dispatch | ✅ Built |
| `merchant.queue-all.js` — `refreshAll` + `resetAll` | One-shot pre-dispatch reset | ✅ Built |
| `merchant.dock-storage.js` — `readListingDock` | All queue source reads | ✅ Built |
| `merchant.constants.js` — `MERCHANT_PLATFORM_PRESETS` | Per-provider char limits | ✅ Built |
| `merchant.adapters/` directory + interface | Phase 1 | Not started |
| `MERCHANT_ACTIONS.ONE_SHOT_PASTE` constant | Phase 1 strip wiring | Not started |
| Real-site DOM research (Etsy, Shopify) | Phase 3 | Not started |

---

## Testing Strategy

### Test Lab (Phases 1–2)

- Load `merchant-test-lab/etsy.html` locally (`npx serve merchant-test-lab -p 5173`)
- Stage a full payload in Listing Dock (tags + materials + title + bullets)
- Trigger one-shot → verify all tagged `[data-field]` inputs filled in order
- Check strip hint shows correct progress then clears
- Repeat for each provider mock page in the matrix

### Live site smoke tests (Phase 3)

- Open a real Etsy listing editor draft (do not publish)
- Stage tags in Listing Dock → trigger one-shot → verify 13 tag inputs populated, no JS errors
- Test materials: stage 5 materials → one-shot → verify Etsy chip autocomplete adds each
- Repeat for Redbubble (simpler DOM; good regression baseline for tag adapter)

### Regression guard

- Each new adapter must pass test-lab run before any live-site work
- After any change to `merchant.queue-factory.js`, re-run full test-lab matrix
- Manual check: existing per-queue manual flow (Tag Queue, Bullet Queue, etc.) must still work after one-shot is added — adapters are additive, not replacements

---

## Social-Media Priority

Full analysis: [`docs/merchant/MERCHANT-SOCIAL-MEDIA-PRIORITY.md`](MERCHANT-SOCIAL-MEDIA-PRIORITY.md)

**Tier 1 targets (social-native sellers):** Etsy · Printify · Shopify

- Etsy and Printify are already Phase 1 — this is the correct call; both provider communities are Pinterest/TikTok-active and are the highest word-of-mouth surface for PasteCraft.
- Shopify should be prioritized *first* within Phase 2 (before eBay/WooCommerce) — Shopify sellers are actively using Instagram Shopping and TikTok Shop at the moment they manage listings.
- Redbubble and TeePublic are Tier 2 with active Instagram/Pinterest artist communities; Phase 1 placement holds.
- eBay, WooCommerce, and Generic are Tier 3 — real paste pain but weak social acquisition signal; Phase 2–3 placement appropriate.
- Hashtag queue output should be validated in Phase 1 (via Social Promo test lab mock) as it directly serves Etsy/Printify/Redbubble sellers who export listing tags to Instagram/Pinterest.

---

## Gaps Addressed by This Document

The existing docs (`MERCHANT-ROADMAP-AND-TEST-LAB.md`, `MERCHANT-QUEUE-SYSTEM.md`, `MERCHANT-PHASE-STATUS.md`) establish the queue engine, provider presets, and phase cadence but do not:

- Define a concrete adapter contract for `merchant.adapters/`
- Assign specific DOM complexity ratings and blockers per provider
- Sequence the one-shot dispatch flow step by step
- Map the relationship between `queue-factory`, `queue-all`, and the planned adapter layer
- Distinguish test-lab adapter work (static DOM, safe) from live-site adapter work (SPA risk, char-limit enforcement)

This document fills those gaps as the single planning source for one-shot paste implementation.
