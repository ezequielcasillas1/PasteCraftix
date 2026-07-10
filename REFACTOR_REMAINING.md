# Vertical slice refactor — remainder

Completed this run: Phase B (supabase), Phase C (content entry + 2 classes), Phase D (background handlers), Phase A largely done prior (~1581-line popup orchestrator).

## Still to do

- Split `content/quick-paste/quick-paste.js` (~2493 lines) into `qp.*` submodules per roadmap (styles, storage, render, events, paste, settings-modal).
  - Done: `qp.helpers.js` (clipIdKey, fnv1a36, getTimeAgo, escapeHtml, detectQuickBadge, lightFormatPreview).
  - Done: `qp.constants.js` (storage keys, host/DOM ids/classes, defaults, limits, delimiters).
  - Remaining: styles, storage, render, events, paste, settings-modal, clips-actions, controller shell.
- Split `content/widget/widget.js` (~3143 lines) into `widget.*` submodules (`loadQuickViewContent`, `setupAutoCopyListener` need Opus-level decomposition).
- Background: one handler file per `message.action` (current split is external vs internal only).
- Popup: remove ~300 thin `Feature.method.call(this)` delegates where `popup/events/*` can call feature modules directly (grep before delete).
- Supabase: rename slices to match roadmap filenames (`clips-sync.js` vs `sync-clips.js`) only if worth churn; run CodeScene pre-commit per slice.
- Phase E: optional splits `notes.album.js`, `ai-lab.magic.js`, `clips.render.js` after content/widget sub-slices stable.
- Production: Section G checklist + manifest version bump only when shipping (manifest touched for `type: module` on content + background).
