---
name: PasteCraft Master Refactor Roadmap
updated: 2026-05-08
codescene_score_popup: 1.27
---

# PasteCraft Master Refactor Roadmap

## CodeScene Scores — Current Baseline

| File | Lines | Score | Status |
|---|---|---|---|
| `popup.js` | 8,871 | **1.27** | Critical |
| `content-script.js` | 5,679 | **1.71** | Critical |
| `supabase-client.js` | 4,621 | **1.96** | Critical |
| `background.js` | 767 | 7.13 | Healthy |
| `notes.album.js` | 865 | 8.22 | Healthy |
| `ai-lab.magic.js` | 782 | 10.0 | Perfect |

---

## CodeScene Top Findings — popup.js (current)

| Function | CC | LoC | Risk |
|---|---|---|---|
| `setupEventListeners` | 197 | 850 | Brain Method |
| `_restoreSessionState` | 81 | 161 | Brain Method |
| `openClipViewer` | 78 | 153 | Brain Method |
| `loadData` | 73 | 118 | Brain Method |
| `setupAuthModalEvents` | 65 | 341 | Brain Method |
| `PasteCraftCRUD.deleteOperation` | 63 | 162 | Brain Method |
| `PasteCraftCRUD.createOperation` | 46 | 111 | Complex |
| `updateTopBarIdentity` | 43 | 78 | Complex |
| `setupLocalStorageListener` | 42 | 99 | Complex |
| `PasteCraftCRUD.updateOperation` | 39 | 109 | Complex |
| `setupProfileModalEvents` | 21 | 125 | Complex |
| `fetchActivityPage` | 19 | — | Complex |
| `generateMyCartoon` | 17 | 77 | Moderate |
| `_createCheckout` | 17 | — | Moderate |
| `getActivitySummary` | 9 | — | Threshold |

---

## Phase 1 — popup.js Cleanup

### ✅ Completed

| Feature | Modules | Status |
|---|---|---|
| Clips | `clips.controller/service/render/events/...` | Done |
| Categories | `categories.*` | Done |
| Notes | `notes.*` | Done |
| AI Lab (incl. AI History) | `ai-lab.constants/credits/summary/history/magic/controller` | Done |
| Settings | `settings.constants/selectors/storage/render/events/backup/controller` | Done |
| Activity Log | `activity.constants/service/render/events/controller` | Done |
| Auth | `auth.constants/selectors/service/session/events/controller` | Done |
| Profile | `profile.constants/selectors/storage/render/events/generators/gallery/controller` | Done |

> **AI History** (`loadAiHistory`, `saveAiHistory`, `renderAiHistoryList`, `openAiHistoryModal`, `continueHistoryConversation`, `clearAllAiHistory`, etc.) is fully delegated to `this.aiLabFeature.history` — already extracted, nothing remaining.

---

### ⬜ Slice: Activity Log
**Model: Sonnet 4.6**
**CC risk: Medium (max CC=19)**
**Target folder:** `extension/popup/features/activity/`

| Function | CC | Line |
|---|---|---|
| `loadActivityLog` | — | L8548 |
| `fetchActivityPage` | 19 | L8574 |
| `renderActivityList` | — | L8621 |
| `getActivityIcon` | — | L8663 |
| `getTableBadge` | — | L8673 |
| `getActivitySummary` | 9 | L8686 |
| `formatTimeAgo` | — | L8710 |
| `loadMoreActivity` (event wiring) | — | inline in `setupEventListeners` |

Extract to:
```
activity.constants.js   — table badge map, operation icons, filter values
activity.service.js     — loadActivityLog, fetchActivityPage, loadMoreActivity
activity.render.js      — renderActivityList, getActivityIcon, getTableBadge, getActivitySummary, formatTimeAgo
activity.events.js      — refresh btn, load-more btn, filter wiring
activity.controller.js  — initActivityFeature(app), delegation
```

Gate: CodeScene pre-commit on `activity.service.js` — `fetchActivityPage` CC must drop below 9. No function CC > 9 in any new file.

---

### ⬜ Slice: Auth
**Model: Sonnet 4.6**
**CC risk: HIGH (`setupAuthModalEvents` CC=65, 341 lines — Brain Method)**
**Target folder:** `extension/popup/features/auth/`

| Function | CC | Line |
|---|---|---|
| `setupAuthModalEvents` | 65 | L3497 |
| `_refreshSupabaseTokenViaBackground` | 32 | L3401 |
| `restoreSupabaseSessionFromBridge` | 36 | L3436 |
| `_getSessionBridgePayload` | 11 | L3386 |
| `_restoreSessionState` | 81 | L7972 — Brain Method |
| `setupLocalStorageListener` | 42 | L1150 |
| `clearLegacyAuthPrefs` | — | L787 |

> `setupAuthModalEvents` (CC=65) and `_restoreSessionState` (CC=81) are Brain Methods. Both **must** be decomposed inline before commit — break into private `_auth*` helpers until each helper CC ≤ 9.
> **Escalate `_restoreSessionState` to Opus 4.7** if Sonnet 4.6 cannot reduce cleanly.

Extract to:
```
auth.constants.js     — modal IDs, storage keys, auth state flags
auth.selectors.js     — DOM helpers for auth modal elements
auth.service.js       — restoreSupabaseSessionFromBridge, _refreshSupabaseTokenViaBackground, _getSessionBridgePayload, clearLegacyAuthPrefs
auth.session.js       — _restoreSessionState (brain method — decompose here), setupLocalStorageListener
auth.events.js        — setupAuthModalEvents (brain method — decompose here), sign-in/sign-up wiring
auth.controller.js    — initAuthFeature(app), delegation
```

Gate: CodeScene pre-commit on `auth.events.js` and `auth.session.js` — no function CC > 9. `popup.js` score must rise above 1.27.

---

### ⬜ Slice: Profile
**Model: Sonnet 4.6 + Opus 4.7 for avatar**
**CC risk: HIGH (multiple functions CC > 15)**
**Target folder:** `extension/popup/features/profile/`
**Depends on:** Auth slice (shares `currentUser`, `userProfile`)

| Function | CC | Line |
|---|---|---|
| `updateTopBarIdentity` | 43 | L5803 |
| `showProfileModal` | 15 | L5936 |
| `setupProfileModalEvents` | 21 | L6048 |
| `handleProfileImageUpload` | 15 | L6240 |
| `generateAnimalAvatar` | 14 | L6302 |
| `generateMyCartoon` | 17 | L6393 |
| `loadUserProfile` | — | L5786 |
| `displayImageTopLeft` | — | L6591 |
| `migrateProfileImageToGallery` | — | L7332 |
| `updateAIGenerateButtonState` | 9 | L6001 |
| `applyAuthPrefsToUi` | — | existing |
| `saveUserName`, `saveAiNameToProfile`, `uploadProfileImage` | — | various |

> **`updateTopBarIdentity` (CC=43)** and **`setupProfileModalEvents` (CC=21)** require decomposition.
> **`generateMyCartoon` (CC=17)**, **`generateAnimalAvatar` (CC=14)** — AI generation calls, use **Opus 4.7** for `profile.avatar.js` only.

Extract to:
```
profile.constants.js   — modal IDs, storage keys
profile.selectors.js   — DOM helpers
profile.storage.js     — loadUserProfile, saveUserName, saveAiNameToProfile
profile.render.js      — updateTopBarIdentity (decompose), showProfileModal, hideProfileModal, updateAIGenerateButtonState, displayImageTopLeft
profile.events.js      — setupProfileModalEvents (decompose), handleProfileImageUpload
profile.avatar.js      — generateAnimalAvatar, generateMyCartoon, uploadProfileImage [Opus 4.7]
profile.gallery.js     — renderAIGallery, renderGalleryPagination, setAsProfile, setupImageViewer, migrateProfileImageToGallery
profile.controller.js  — initProfileFeature(app), delegation
```

Gate: No function CC > 9 in any profile module. `popup.js` score must improve.

---

### ⬜ Slice: Billing
**Model: Sonnet 4.6**
**CC risk: Medium (`_createCheckout` CC=17)**
**Target folder:** `extension/popup/features/billing/`

| Function | CC | Line |
|---|---|---|
| `openUpgradeModal` | — | L1697 |
| `closeUpgradeModal` | — | L1702 |
| `_createCheckout` | 17 | L1711 |
| `openSupportForm` | 30 | L3971 |
| `submitSupportForm` | 25 | L4144 |

> `openSupportForm` (CC=30) and `submitSupportForm` (CC=25) belong with billing — support contact is tier-gated. Both require decomposition.

Extract to:
```
billing.constants.js   — price IDs, plan tiers
billing.service.js     — _createCheckout (decompose)
billing.support.js     — openSupportForm (decompose), submitSupportForm (decompose)
billing.events.js      — upgrade modal wiring, support form wiring
billing.controller.js  — initBillingFeature(app), delegation
```

Gate: No function CC > 9 in any billing module.

---

### ⬜ Slice: Sync / Data
**Model: Sonnet 4.6**
**CC risk: HIGH (`loadData` CC=73, `setupLocalStorageListener` CC=42)**
**Target folder:** `extension/popup/features/sync/`

| Function | CC | Line |
|---|---|---|
| `loadData` | 73 | L1915 — Brain Method |
| `setupLocalStorageListener` | 42 | L1150 |
| `performBackgroundSync` | 11 | L1623 |
| `_initializeTieredStorage` | 9 | L2060 |
| `_mirrorChangedLocalStateToIndexedDb` | 13 | L1288 |
| `_ensureIndexedDbReadyAndMigrate` | 12 | L1271 |
| `_maybeMigrateTieredStorage` | 17 | L8306 |

> `loadData` (CC=73) is the last Brain Method in popup.js. Must be decomposed. **Escalate to Opus 4.7** if needed.

Extract to:
```
sync.storage.js     — _initializeTieredStorage, _mirrorChangedLocalStateToIndexedDb, _ensureIndexedDbReadyAndMigrate, _maybeMigrateTieredStorage
sync.loader.js      — loadData (brain method — decompose)
sync.listener.js    — setupLocalStorageListener (decompose), performBackgroundSync
sync.controller.js  — initSyncFeature(app), delegation
```

Gate: `loadData` CC must reach ≤ 9 per helper. `popup.js` final score must be ≥ 7.

---

## Phase 2 — supabase-client.js Modularization
**Lines:** 4,621 | **Score:** 1.96
**Model: Sonnet 4.6 (medium clusters), Opus 4.7 (`performFullSync`, auth, sync-queue high clusters)**

One mega-class (`PasteCraftSupabase`) — 27 clusters. Split into focused modules:

| Module | Cluster | Complexity |
|---|---|---|
| `supabase/core.js` | constructor, init, setupConnectionMonitor, _fetchWithTimeout | Medium |
| `supabase/storage-adapter.js` | _safeStorageSet, _saveToIdb | Medium |
| `supabase/auth.js` | signInWithEmail, signInWithGoogle, signOut, signOutFast, getCurrentUser, setupAuthSessionBridge, _clearCachedAuthState, getStoredAccessToken | **High — Opus 4.7** |
| `supabase/subscription.js` | getCachedSubscription, setCachedSubscription, createUserSubscription, getUserSubscription, isPremiumUser, hasCloudSyncAccess, checkPremiumAccess | Medium |
| `supabase/sync-queue.js` | _compactSyncQueue, loadSyncQueue, addToSyncQueue, processSyncQueue, executeSyncOperation, syncWithQueue | **High — Opus 4.7** |
| `supabase/realtime.js` | setupRealtimeSubscriptions, handleClipsChange, handleProfileChange, unsubscribeAll | **High — Opus 4.7** |
| `supabase/identity.js` | getChromeUserId, getSyncUserId, ensureUserProfileRow, getDeviceId | **High** |
| `supabase/clips-sync.js` | syncClipsToSupabase, syncClipsFromSupabase, mergeClips, buildDbClipsForUpsert, syncDeletedClipsToSupabase, fetchClipsPage | **High** |
| `supabase/categories-sync.js` | syncCategoriesToSupabase, syncCategoriesFromSupabase, mergeCategories, deleteCategoryFromSupabase | **High** |
| `supabase/notes-sync.js` | syncNotesToSupabase, syncNotesFromSupabase, mergeNotes, syncDeletedNotesToSupabase, buildDbNotesForUpsert | **High** |
| `supabase/archived-clips-sync.js` | syncArchivedClipsToSupabase, syncArchivedClipsFromSupabase, mergeArchivedClips | **High** |
| `supabase/settings-sync.js` | syncSettingsToSupabase, syncSettingsFromSupabase | Medium |
| `supabase/ai-history-sync.js` | syncAiHistoryToSupabase, fetchAiHistoryFromSupabase, mergeAiHistory | Medium |
| `supabase/profile-sync.js` | getUserProfile, createUserProfile, updateUserProfile, uploadProfileImage, syncUserProfileToSupabase, syncUserProfileFromSupabase, convertToPermanentProfileImageUrl | Medium |
| `supabase/ai-functions.js` | generateAIName, analyzePhotoWithVision, aiCategorize, aiFormat, breakdownText, generateSummary, generateProfileImage | **High** |
| `supabase/full-sync.js` | `performFullSync` (211 lines — Brain Method, orchestrates all domains) | **High — Opus 4.7** |
| `supabase/ai-workflow.js` | _normalizeAiWorkflow, getAiWorkflowConfig, setAiWorkflowConfigDirect | Low–Medium |
| `supabase/tombstones.js` | _fetchTombstonedIds, _mergeTombstonesIntoLocal | Medium |

**Strategy:** Keep `PasteCraftSupabase` class as thin orchestrator. Maintain `pasteCraftSupabase` global singleton. No storage key renames. No RLS custom plumbing. `performFullSync` decomposed by Opus 4.7 before commit.

Gate: All modules pass CodeScene pre-commit. No function CC > 9.

---

## Phase 3 — content-script.js Modularization
**Lines:** 5,679 | **Score:** 1.71
**Model: Sonnet 4.6 (most clusters), Opus 4.7 (`loadQuickViewContent` + `setupAutoCopyListener`)**

Two classes — `QuickPasteInterface` (L55–L2534) and `PasteCraftFloatingWidget` (L2537–L5653).

### QuickPasteInterface modules

| Module | Methods | CC Risk |
|---|---|---|
| `quick-paste/qp.constants.js` | Storage keys, CSS class strings, element IDs | Low |
| `quick-paste/qp.styles.js` | `addStyles` (~834 lines CSS string) | Medium |
| `quick-paste/qp.storage.js` | `loadClips`, `loadSettings`, `saveSettings`, `savePosition` | Medium |
| `quick-paste/qp.render.js` | `createInterface`, `renderClips`, `updateInterface`, `showInterface`, `hideInterface`, `applySettings` | Low–Medium |
| `quick-paste/qp.events.js` | `setupEventListeners`, `setupMessageListener`, `setupStorageSync` | Medium |
| `quick-paste/qp.paste.js` | `pasteClip`, `pasteClipById`, `showToast`, helpers | Medium |
| `quick-paste/qp.helpers.js` | `getTimeAgo`, `escapeHtml`, `_detectQuickBadge`, `_lightFormatPreview`, `_clipIdKey`, `_fnv1a36` | Low |
| `quick-paste/qp.settings-modal.js` | `showSettingsModal`, `applyBeautifulSettingsStyles`, `setupSettingsModalEvents`, `saveSettingsFromModal`, help modal | Medium–High |
| `quick-paste/qp.clips-actions.js` | `showClearAllConfirmation`, `clearAllClips`, `toggleClipSelection`, `copyMultipleClips`, `deleteClip` | Medium |
| `quick-paste/qp.controller.js` | `QuickPasteInterface` class shell + wiring | Low |

### PasteCraftFloatingWidget modules

| Module | Methods | CC Risk |
|---|---|---|
| `widget/widget.constants.js` | Storage keys, IDs | Low |
| `widget/widget.styles.js` | `addStyles`, `addQuickViewStyles`, `addSettingsStyles`, `addOverlayStyles` | Medium |
| `widget/widget.core.js` | constructor, `initAsync`, `createWidget`, `setupWidgetDrag`, `setupEventListeners`, position | Medium |
| `widget/widget.storage-sync.js` | `setupStorageSync` (~100 lines) | **High** |
| `widget/widget.profile-icon.js` | `_getProfileImageForWidget`, `applyWidgetIcon` | Low |
| `widget/widget.auto-copy.js` | `setupAutoCopyListener` (~120 lines — High), `toggleAutoCopy`, `updateAutoCopyCounter` | **High — Opus 4.7** |
| `widget/widget.docking.js` | `ensurePageDockStyles`, `getActivePanelWidthPx`, `syncPageDocking` | Low |
| `widget/widget.popup-overlay.js` | `openPopupOverlay`, `closePopupOverlay` | Medium |
| `widget/widget.settings-panel.js` | `openSettings`, `closeSettings` | Medium–High |
| `widget/widget.toast.js` | `showWidgetToast` | Low |
| `widget/widget.drag-capture.js` | `saveClickAndDragFromDataTransfer` (~121 lines), `ensureClickAndDragDropBox`, `_pc*` helpers | Medium–High |
| `widget/widget.quickview.js` | `openQuickView`, `loadQuickViewContent` (~458 lines — **Brain Method**), `closeQuickView` | **High — Opus 4.7** |
| `widget/widget.mini-quickview.js` | `openMiniQuickView`, `_populateMiniQuickView` | Medium |
| `widget/widget.controller.js` | `PasteCraftFloatingWidget` class shell + wiring | Low |

Gate: `loadQuickViewContent` and `setupAutoCopyListener` decomposed by Opus 4.7. All modules pass CodeScene pre-commit gate. Behavior unchanged — no storage key renames.

---

## Phase 4 — Production
Once Phases 1–3 complete and all CodeScene scores ≥ 7:
1. Run full Section G pre-publish checklist (`production-publishing-safety.mdc`)
2. Bump `manifest.json` version (patch or minor per change scope)
3. Load previous published version → verify test data → reload new version → verify
4. Package `extension/` zip — never repo root
5. Upload to Chrome Web Store + Edge Add-ons (same zip)
6. Log to `program-study/success/SuccessLog.md`
