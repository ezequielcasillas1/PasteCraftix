# PasteCraft

Clipboard manager browser extension with account sync (`package.json`: "Intelligent clipboard manager with authentication").

## Layout
- `extension/` — the browser extension (MV3 manifest in `extension/manifest.json`)
- `manifest.json` (root) — dev loader so the repo root can be loaded as an unpacked extension
- `website/`, `auth-site/` — marketing and auth web pages (Netlify config in `netlify.toml`)
- `supabase/`, `db/` — backend schema and functions
- `tests/` — Node test suites
- `docs/` — project documentation

## Development
```bash
npm install
npm test
```
Copy `.env.example` / `extension/config.example.js` for local configuration. Load `extension/` as an unpacked extension in Chrome.
