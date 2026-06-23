# Merchant Test Lab

Standalone mock shop pages for PasteCraft Merchant QA and future DOM adapter development.

**Not** part of `website/` or pastecraft.com — local/dev only.

## Open locally

### Option A — file://

Open `merchant-test-lab/index.html` directly in Chrome/Edge with the extension loaded.

### Option B — simple HTTP serve (recommended)

From repo root:

```powershell
npx --yes serve merchant-test-lab -p 5173
```

Then visit `http://localhost:5173`

## Pages

| File | Purpose |
|---|---|
| `index.html` | Hub + checklist |
| `etsy-listing.html` | 13 individual tag inputs, materials, optional title/desc |
| `printify-stub.html` | Tags/keywords + variant stub fields |
| `generic-form.html` | Generic multi-field paste targets |

All inputs use `data-field` attributes for future adapter hooks.

## Extension test flow

1. Load unpacked extension from `extension/`
2. Open any Test Lab page
3. Verify Merchant top strip mounts
4. **Listing Dock** — tags-first UI, preview chips, count X/13
5. **Spot** — select comma-separated tags or listing pack (`tags:` section) → stage
6. **Save to dock** — normalized tags persist with 24h TTL; Pulse updates

## Sample listing pack (clipboard/Spot)

```
tags: handmade mug, ceramic gift, coffee lover, this tag is way too long for etsy
title: Optional title
description: Optional description
```
