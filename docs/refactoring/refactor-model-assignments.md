---
name: Refactor Model Assignments
updated: 2026-05-12
---

# Refactor Model Assignments

Which AI model to use for each refactor slice, based on CC risk and function complexity.
Full reasoning: `docs/refactoring/master-refactor-roadmap.md` and `.cursor/rules/deepseek-v4-model-selection.mdc`.

---

## Decision Rules (Quick Reference)

| Condition | Model |
|---|---|
| CC ≤ 19, no Brain Methods, surgical extraction | **Sonnet 4.6** |
| CC 20–62, complex multi-file logic | **Sonnet 4.6** |
| CC 40–70 Brain Method, decomposable with care | **Opus 4.5** |
| CC > 70 Brain Method, or 400+ line monster functions | **Opus 4.7** |
| Multi-file Supabase/backend/sync logic | **DeepSeek v4-Pro** |
| Cross-file analysis, code review, test generation, architectural Q&A | **GPT 5.5** |
| UI layout, design polish, comments | **Sonnet 4.6 (Cursor native)** |

---

## Phase 1 — popup.js

| Slice | Status | Model | Brain Methods | Notes |
|---|---|---|---|---|
| Clips | ✅ Done | Sonnet 4.6 | None | — |
| Categories | ✅ Done | Sonnet 4.6 | None | — |
| Notes | ✅ Done | Sonnet 4.6 | None | — |
| AI Lab | ✅ Done | Sonnet 4.6 | `_craftMagic` CC=63 | Decomposed in `ai-lab.magic.js` |
| Settings | ✅ Done | Sonnet 4.6 | None | — |
| Activity Log | ✅ Done | Sonnet 4.6 | None | `fetchActivityPage` CC=19 → decomposed |
| **Auth** | ⬜ Next | **Sonnet 4.6** base + **Opus 4.5** for `setupAuthModalEvents` CC=65 + **Opus 4.7** for `_restoreSessionState` CC=81 | `_restoreSessionState` CC=81, `setupAuthModalEvents` CC=65 | Tiered: 4.5 handles CC=65, 4.7 handles CC=81 |
| Profile | ⬜ Pending | **Sonnet 4.6** base + **Opus 4.5** for `updateTopBarIdentity` CC=43 + **Opus 4.7** for `profile.avatar.js` | `updateTopBarIdentity` CC=43 | Avatar generation (CC=17, AI calls) needs Opus 4.7 |
| Billing | ⬜ Pending | **Sonnet 4.6** base + **Opus 4.5** for `openSupportForm` CC=30 | `openSupportForm` CC=30, `submitSupportForm` CC=25 | Both must be decomposed |
| Sync / Data | ⬜ Pending | **Sonnet 4.6** base + **Opus 4.5** for `setupLocalStorageListener` CC=42 + **Opus 4.7** for `loadData` CC=73 | `loadData` CC=73 — last Brain Method in popup.js | 4.5 handles CC=42, 4.7 handles CC=73 |

---

## Phase 2 — supabase-client.js (score 1.96, 4,621 lines)

| Module | Model | Risk |
|---|---|---|
| `supabase/core.js` | Sonnet 4.6 | Medium |
| `supabase/storage-adapter.js` | Sonnet 4.6 | Medium |
| `supabase/auth.js` | **Opus 4.5** | High — auth flow, session bridge |
| `supabase/subscription.js` | Sonnet 4.6 | Medium |
| `supabase/sync-queue.js` | **Opus 4.5** | High — `processSyncQueue`, `executeSyncOperation` |
| `supabase/realtime.js` | **Opus 4.5** | High — real-time handlers |
| `supabase/identity.js` | **DeepSeek v4-Pro** | High — user/device identity logic |
| `supabase/clips-sync.js` | **DeepSeek v4-Pro** | High — multi-table sync, merge logic |
| `supabase/categories-sync.js` | **DeepSeek v4-Pro** | High |
| `supabase/notes-sync.js` | **DeepSeek v4-Pro** | High |
| `supabase/archived-clips-sync.js` | **DeepSeek v4-Pro** | High |
| `supabase/settings-sync.js` | Sonnet 4.6 | Medium |
| `supabase/ai-history-sync.js` | Sonnet 4.6 | Medium |
| `supabase/profile-sync.js` | Sonnet 4.6 | Medium |
| `supabase/ai-functions.js` | **Opus 4.7** | High — AI generation calls |
| `supabase/full-sync.js` | **Opus 4.7** | High — `performFullSync` 211 lines Brain Method |
| `supabase/ai-workflow.js` | Sonnet 4.6 | Low–Medium |
| `supabase/tombstones.js` | Sonnet 4.6 | Medium |

---

## Phase 3 — content-script.js (score 1.71, 5,679 lines)

| Module | Model | Risk |
|---|---|---|
| `quick-paste/*` (most modules) | Sonnet 4.6 | Low–Medium |
| `quick-paste/qp.settings-modal.js` | Sonnet 4.6 | Medium–High |
| `widget/*` (most modules) | Sonnet 4.6 | Low–Medium |
| `widget/widget.auto-copy.js` | **Opus 4.5** | High — `setupAutoCopyListener` ~120 lines |
| `widget/widget.quickview.js` | **Opus 4.7** | High — `loadQuickViewContent` ~458 lines Brain Method |
| `widget/widget.storage-sync.js` | Sonnet 4.6 | High |
| `widget/widget.drag-capture.js` | Sonnet 4.6 | Medium–High |

---

## Model Availability (as of May 2026)

| Model | Use for |
|---|---|
| **Sonnet 4.6** | Default — most refactor slices, surgical extractions, minimal diffs, UI |
| **Opus 4.5** | Mid-range Brain Methods CC 40–70, auth flows, sync-queue, real-time handlers, auto-copy |
| **Opus 4.7** | Hardest Brain Methods CC > 70, 400+ line monsters (`_restoreSessionState` CC=81, `loadData` CC=73, `loadQuickViewContent` 458 lines, `performFullSync` 211 lines), avatar AI generation |
| **GPT 5.5** | Cross-file analysis, code review before PR, test generation, architectural Q&A, second-opinion on complex logic |
| **DeepSeek v4-Pro** | Backend Supabase sync modules, multi-table merge logic (Phase 2) |
| **DeepSeek v4-Flash** | High-volume or fast-turnaround tasks only |
