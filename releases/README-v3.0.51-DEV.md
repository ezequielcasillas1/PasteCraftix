# PasteCraft v3.0.51 — Developer mode (unpacked)

Use this folder to smoke-test the Supabase client init fix before uploading `pastecraft-v3.0.51.zip` to Chrome Web Store and Edge Add-ons.

## Load unpacked

**Important (Windows):** Chrome/Edge require the folder that **contains `manifest.json` at its root** — not a parent folder. After extracting a zip, if you see an extra nested folder and no `manifest.json` beside `config.js`, open that **inner** folder before clicking **Load unpacked**. Picking the wrong folder shows *Manifest file is missing or unreadable*.

1. Extract `pastecraft-v3.0.51-unpacked.zip` (archive root is flat: `manifest.json` and `config.js` sit at the top level of the zip, not inside a wrapper folder).
2. **Chrome:** Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the extracted folder that **directly contains** `manifest.json` (or use `releases/pastecraft-v3.0.51-unpacked/` from a git clone — same layout as `extension/`).
3. **Edge:** Open `edge://extensions`, enable **Developer mode**, click **Load unpacked**, select that same folder.

## Smoke checklist

1. Open the extension popup — no persistent errors about missing `config.js` or placeholder Supabase keys.
2. Open the service worker console (`chrome://extensions` → PasteCraft → **Service worker**) — you should not see `Config not loaded` or placeholder Supabase warnings on a clean load.
3. Sign in (or restore an existing session) and confirm sync reaches Supabase.
4. Create one clip and one category change; reload the extension and confirm data is still present.

## Store package

Upload **`pastecraft-v3.0.51.zip`** (extension root contents, not this readme) to both store listings. Do not add a `"key"` field to `manifest.json`.