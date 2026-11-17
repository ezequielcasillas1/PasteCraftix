# PasteCraft v3.0.51 — Developer mode (unpacked)

Use this folder to smoke-test the Supabase client init fix before uploading `pastecraft-v3.0.51.zip` to Chrome Web Store and Edge Add-ons.

## Load unpacked

1. **Chrome:** Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, choose `pastecraft-v3.0.51-unpacked/` (this directory inside the zip, or the copy under `releases/` in the repo).
2. **Edge:** Open `edge://extensions`, enable **Developer mode**, click **Load unpacked**, select the same folder.

## Smoke checklist

1. Open the extension popup — no persistent errors about missing `config.js` or placeholder Supabase keys.
2. Open the service worker console (`chrome://extensions` → PasteCraft → **Service worker**) — you should not see `Config not loaded` or placeholder Supabase warnings on a clean load.
3. Sign in (or restore an existing session) and confirm sync reaches Supabase.
4. Create one clip and one category change; reload the extension and confirm data is still present.

## Store package

Upload **`pastecraft-v3.0.51.zip`** (extension root contents, not this readme) to both store listings. Do not add a `"key"` field to `manifest.json`.