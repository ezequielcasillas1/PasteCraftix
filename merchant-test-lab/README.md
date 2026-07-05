# Merchant Test Lab

Mock seller pages for PasteCraft Merchant QA and Phase 7+ DOM adapter development.

## URLs

| Environment | Hub | Mock pages |
|---|---|---|
| **Production** | https://pastecraft.com/merchant-test.html | https://pastecraft.com/merchant-test/etsy.html etc. |
| **Local Astro** | http://localhost:4321/merchant-test.html | http://localhost:4321/merchant-test/etsy.html |
| **Local static** | http://localhost:5173/ (see below) | Same filenames in this folder |

Site nav: footer link **Merchant Test Lab** → Astro hub with links to all mocks.

## Open locally

### Option A — Astro dev (recommended, matches production)

```powershell
cd website
npm run dev
```

Visit `http://localhost:4321/merchant-test.html` then open mock pages from the hub.

### Option B — static serve (this folder only)

```powershell
npx --yes serve merchant-test-lab -p 5173
```

Visit `http://localhost:5173` — uses `index.html` in this folder (no site chrome).

### Option C — file://

Open `merchant-test-lab/index.html` directly (extension still loads via `<all_urls>`).

## Pages

| File | Platform | Key fields |
|---|---|---|
| `etsy.html` | Etsy | 13 tag inputs, materials, buyer instructions, 10 alt text (Advanced) |
| `printify.html` | Printify | 20 keyword inputs, variant rows |
| `shopify.html` | Shopify | 10 tag inputs, SEO title/desc/handle |
| `amazon.html` | Amazon | 5 bullets, 10 backend keyword slots |
| `ebay.html` | eBay | 12 item-specific key-value pairs |
| `redbubble.html` | Redbubble | 15 tags × 39 chars |
| `teepublic.html` | TeePublic | 32 tag slots |
| `woocommerce.html` | WooCommerce | 10 product tag inputs |
| `generic.html` | Generic/custom | 30 small fields |
| `social-promo.html` | Social promo | Hashtags, caption, Pinterest stub |

All inputs use `data-field` attributes for future DOM adapters. Source of truth for deploy: `website/public/merchant-test/`.

## Extension test flow

1. Load unpacked extension from `extension/`
2. **Reload extension** after Merchant code changes (chrome://extensions → Reload)
3. Open any Test Lab page
4. Verify Merchant top strip mounts (~1cm)
5. **Listing Dock** — tags-first UI, preview chips, preset limits
6. **Spot** — stage comma tags or listing pack
7. **Tag Queue** — toggle on, focus tag input, paste next
8. **Materials** — Etsy mock: queue into material inputs
9. **Snippets** — insert into buyer-instructions field

## Sample listing pack

```
tags: handmade mug, ceramic gift, coffee lover, this tag is way too long for etsy
title: Optional title
description: Optional description
```
