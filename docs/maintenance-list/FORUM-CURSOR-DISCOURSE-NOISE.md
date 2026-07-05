# forum.cursor.com — Discourse Theme Console Noise

**Not a PasteCraft bug.** Safe to ignore when testing the extension on Cursor's forum.

## Error

```
client-error-handler.js:109 [THEME 157 'Forum Success Stats'] Error: Could not find module `discourse/admin/components/chart` imported from `(require)`
```

## Source

| Item | Detail |
|---|---|
| Site | `forum.cursor.com` (Discourse) |
| Theme | **157 — Forum Success Stats** (Cursor-hosted) |
| Cause | Theme imports deprecated `discourse/admin/components/chart`; Discourse moved chart to GJS/webpack ([commit 843f74e](https://github.com/discourse/discourse/commit/843f74e)) |
| PasteCraft repo | **No** discourse/chart/client-error-handler references |

## Store publish impact

**Does not block** Chrome/Edge store upload or PasteCraft production readiness.

## If you are forum admin

1. Update or disable Theme 157 (Forum Success Stats).
2. Replace `discourse/admin/components/chart` with current Discourse chart API for your version.
3. Admin → Customize → Themes → clear theme cache / rebuild assets.
4. Upgrade Discourse core if theme targets an older API.

PasteCraft cannot fix Cursor's hosted forum from this repo.

## PasteCraft on forum.cursor.com

- `content_scripts` matches `<all_urls>` — widget + QuickPaste init (site-guard allows this host).
- Merchant mounts only with Merchant subscription + strip enabled — not tied to this error.
- Filter console by `[PasteCraft]` to separate extension logs from Discourse theme noise.

## Verification

1. Disable PasteCraft → reload forum → error still appears → confirms external.
2. Enable PasteCraft → filter `[PasteCraft]` → no chart/module errors from extension.
3. Optional: block `forum.cursor.com` in extension site settings if forum testing is not needed.
