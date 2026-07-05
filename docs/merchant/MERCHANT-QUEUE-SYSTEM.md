# PasteCraft Merchant — Queue Support System

**Related:** `MERCHANT-ROADMAP-AND-TEST-LAB.md` · `instructions/request.md` (#58) · `extension/content/merchant/`

---

## Vision

- Merchant is a **queue support system** for bulk and manual listing workflows — not a full listing editor.
- PasteCraft strength: **snippets** — choose, save, paste. Merchant extends that to **many small marketplace fields**.
- User stages comma-separated (or smart-parsed) values in **Listing Dock** → toggles a queue → **focus field → paste next item** until the queue is done.
- Ephemeral staging (24h TTL); Scholar clips feed Merchant via Spot/import only.

---

## Comma-separated → queue items

- **Dock input rule:** comma-separated values = **one queue item per segment** (after trim/dedupe).
- **Tag queue** also accepts smart parse: newlines, bullets, pipes, tabs, semicolons (`parseSmartTagCandidates` in `merchant.tags.js`).
- **Material queue** splits on `, ; \n \t |` (`splitMaterialsInput` in `merchant.materials.js`).
- **Future queues** (title, description, bullets, etc.) share the same pattern: stage list → index advances on each paste (`queueAutoAdvance` pref).
- **Copy out:** queues join back to comma-separated for clipboard export (tags/materials today).

---

## Queue engine (shared pattern)

| Step | Behavior |
|---|---|
| Stage | User fills dock field (comma-separated) or Spot imports listing pack |
| Activate | Strip toggle (Tag Queue / Material Queue / future queues) |
| Paste loop | Focus marketplace field → clipboard gets next item → optional auto-advance |
| Hint | Strip shows `Tags 3/13: ceramic mug · Materials 2/5: cotton` (`merchant.queue-hints.js`) |

**Not queues:** **Snippets** = one-shot preset insert (compliance, personalization) — same strip, different UX.

---

## Queues by tier

### Phase 1 — now (built / in test)

| Queue | Dock field | Strip toggle | Notes |
|---|---|---|---|
| **Tag queue** | `tags` | ✅ Tag Queue | Platform presets (Etsy 13×20, Printify, Amazon, …); paste-next on tag/keyword inputs |
| **Material queue** | `materials` | ✅ Material Queue | Up to 13 values; Etsy mock slots; live Etsy uses preset chips |
| **Snippet presets** | — | ✅ Snippets | Not a queue — reusable boilerplate insert |

### Phase 2 — planned (next expansion)

| Queue | Dock field | Use case |
|---|---|---|
| **Title queue** | `title` (Advanced) | Bulk listings with rotating title variants (A/B, channel-specific) |
| **Description queue** | `description` (Advanced) | Short desc variants, channel-specific blurbs |
| **Keyword queue** | tags alias / `keywords` | Amazon backend terms, Printify keyword slots (same engine, different field matcher) |
| **Bullet queue** | `bullets` | Amazon 5 bullet points — one per focus |
| **Hashtag queue** | `hashtags` | Social promo — 15 slot pattern (`social-promo.html`) |

### Future candidates (by platform pain)

**SEO & discoverability**

- Alt text queue (Etsy 10 image slots)
- SEO meta title queue (Shopify ~70 chars)
- SEO meta description queue (Shopify ~320 chars)
- Pinterest pin title / pin description queues
- Search-term / backend keyword queue (Amazon byte-limited blob split to slots)

**Attributes & variants**

- Item-specific value queue (eBay key–value pairs)
- Brand queue
- Color variant queue
- Size variant queue
- SKU queue
- Printify variant row queue (color + size + SKU grid)

**Listing structure**

- Handle / URL slug queue (Shopify)
- Category / taxonomy queue
- Shop section queue
- Price queue (spreadsheet → many listings)
- Shipping profile / processing-time snippet queue

**Cross-channel**

- Cross-channel field pack (one source → Etsy tags + Amazon bullets + social hashtags)
- Duplicate-listing reload (re-stage last ephemeral payload)
- Promo export pack (tags → hashtag caption bundle)

**Deprioritized (low paste pain — big boxes in native UI)**

- Single-field caption textarea (social)
- Full description paste (one textarea per listing)
- Photo upload queues
- Policy / legal blocks (snippet-only)

---

## Platform → queue mapping (Test Lab)

| Mock page | High-value queue targets |
|---|---|
| **Etsy** | Tag, material, alt text, buyer-instructions (snippet) |
| **Printify** | Keyword (20 slots), variant color/size/SKU |
| **Shopify** | Tag, SEO title, SEO description, handle |
| **Amazon** | Bullet (5), backend keyword (10+) |
| **eBay** | Item-specific values (12 pairs) |
| **Redbubble / TeePublic** | Tag (15 / 32 slots) |
| **WooCommerce** | Product tag (10 slots) |
| **Generic** | Configurable small-input grid (30 slots) |
| **Social promo** | Hashtag, pin title/desc, link line (snippet) |

---

## Product notes (code vs roadmap)

- Roadmap still **tags-first / tags-only default**; title/description under Advanced — **title/description queues are Phase 2**, not core marketing yet.
- Tag queue detects inputs via `tag`, `keyword`, short `maxLength`, etc. (`isLikelyTagInput`).
- Material queue detects `material` in field/aria/name/id.
- Future queues need **field matchers + optional platform profiles** (same slice pattern as `merchant.tag-queue.js` / `merchant.material-queue.js`).
- DOM adapters (Phase 7+) auto-fill after queue paste — queues stay the manual fallback.

---

## References

- Implementation: `merchant.tag-queue.js`, `merchant.material-queue.js`, `merchant.queue-hints.js`, `merchant.listing-dock.js`
- Test Lab: `merchant-test-lab/` · `website/public/merchant-test/`
