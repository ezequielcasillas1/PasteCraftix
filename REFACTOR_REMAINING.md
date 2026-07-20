# Vertical slice refactor — remainder

Completed prior runs: Phase A (popup orchestrator ~1581→shell), Phase B (supabase shim), Phase C (content entry + 2 classes), Phase D (background handler split external/internal), widget shell → `widget.controller.js`, quick-paste `qp.*` chain complete, background capture + window/clips handler families.

## Next slice (daily automation)

**popup thin delegates** — remove ~300 thin `Feature.method.call(this)` delegates where `popup/events/*` can call feature modules directly; `popup.js` ~1389 lines.

Alternate: **widget high-risk** — `loadQuickViewContent` / `setupAutoCopyListener` (Opus-level; max-1). Escalate to human-led Opus.

Background auth/billing remainder (not daily): `pcRefreshSupabaseToken`, `pcCreateCheckout` still in `messages-internal.js` — human-led if extracted.

---

## Daily queue (extension monoliths)

Priority order for daily automation — pick next incomplete item:

1. **quick-paste** `quick-paste.js` → `qp.*` submodules
   - Done: `qp.helpers.js`, `qp.constants.js`, `qp.styles.js`, `qp.storage.js`, `qp.render.js`, `qp.events.js`, `qp.paste.js`, `qp.settings-modal.js`, `qp.clips-actions.js`, `qp.controller.js`
   - Quick-paste qp.* chain complete
2. **widget** — remaining high-risk extractions in existing `widget.*` modules (`loadQuickViewContent`, `setupAutoCopyListener` — Opus-level; max-1 slice)
3. **background** — one handler file per `message.action` via `messaging/` router
   - Done (2026-07-17): `messaging/message-types.js`, `messaging/router.js`, `handlers/capture.handler.js` (`pcCaptureRegion`, `pcGetPageSelection`, `pcCopyText`)
   - Done (2026-07-18): `handlers/window.handler.js` (`pcOpenPopupWindow`), `handlers/clips.handler.js` (`saveClip`, Quick View get/delete, `refreshClips`/`clipsUpdated`)
   - Deferred (human-led): `pcRefreshSupabaseToken`, `pcCreateCheckout` remain in `messages-internal.js`
4. **popup** — remove ~300 thin `Feature.method.call(this)` delegates where `popup/events/*` can call feature modules directly (grep before delete); `popup.js` ~1389 lines
5. **Phase E** (optional) — `notes.album.js`, `ai-lab.magic.js`, `clips.render.js` after content/widget sub-slices stable

---

## Deferred — human-led / not daily

Do **not** queue for daily automation. Escalate to human-led Opus run with explicit approval:

- **Supabase** — `supabase/**`, `extension/supabase/**` sync/auth write paths, `supabase-client.js` modularization (Phase 2 roadmap)
- **Edge Functions**, migrations, RLS policies
- **Storage schema** changes, storage key renames, `SCHEMA_VERSION` / `onInstalled` migrations
- **manifest.json** edits (Section G / publish only)
- **Background auth/billing handlers** — `pcRefreshSupabaseToken`, `pcCreateCheckout`

Supabase filename churn (`clips-sync.js` vs `sync-clips.js`) — defer unless worth churn during a dedicated human-led slice.

---

## Production

Section G checklist + manifest version bump only when shipping (manifest touched for `type: module` on content + background).
