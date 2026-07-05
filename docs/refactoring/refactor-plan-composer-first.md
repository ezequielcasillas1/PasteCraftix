---
name: PasteCraft Refactor Plan — Composer First
updated: 2026-07-05
status: Active
branch_strategy: Implement on main until Ezequiel confirms SUCCESS → commit on matching task branch → return to main
---

# PasteCraft Refactor Plan — Composer First

Hybrid strategy: **MV3-boundary-first** (resilience at service worker, storage, auth, manifest, content entry) plus **remaining master roadmap** (popup shell, Supabase hardening, QuickPaste modularization, production gates).

**Current baselines (2026-07-05):** `popup.js` ~1,705 lines · `supabase-client.js` shim (7 lines → `supabase/` ~18 modules) · `background.js` shim (2 lines → `background/service-worker.js`) · `content/content.js` ~26 lines · `content-script.js` bootstrap ~21 lines · `quick-paste/quick-paste.js` ~2,500 lines monolith.

---

## 1. Why We Refactor

- **Not MV2→MV3** — already MV3 (`manifest_version: 3`, service worker, module scripts).
- **Maintainability + MV3 boundary resilience** — isolate lifecycle-sensitive surfaces (SW termination, `chrome.storage` migrations, auth bridge, content injection) from feature UI churn.
- **CodeScene gates** — no slice ships without baseline review, pre-commit safeguard, and CC ≤ 9 per function in new modules.

---

## 2. Model Ladder

| Tier | Model | When |
|---|---|---|
| **Composer 2.5** (default) | Most slices, scaffolding, medium extractions, handler splits |
| **Sonnet 5** (`claude-sonnet-5-thinking-xhigh`) | UI polish, surgical diffs when Composer struggles once |
| **GLM 5.2 Max** | Optional backend/sync if Sonnet/Composer blocked on merge logic |
| **Opus 4.7** | CC > 70 brain methods, `performFullSync`, auth session bridge, fragile sync |

**Escalation rule:** Composer 2.5 first → Sonnet 5 on gate fail → Opus 4.7 on second fail or CC > 70.

**Workflow gates** (from `refactor-model-switching-workflow.mdc`): research real code → report functions/lines/CC/deps → model table → ask Ezequiel before coding → one approved sub-slice → ask before next.

---

## 3. MCP Workflow Per Slice

1. **Arkitect** — `analyze` + `diagnose` + `recommend_patterns` on target slice.
2. **CodeScene** — baseline score/review on files to touch.
3. **Extract** — vertical slice; no storage key renames; no custom RLS plumbing.
4. **Verify** — smoke test + CodeScene pre-commit; CC ≤ 9 per helper.
5. **User SUCCESS** — Ezequiel confirms before SuccessLog or task-branch commit.
6. **Commit** — task branch only after SUCCESS (`fix/`, `feat/`, `refactor/`).

---

## 4. Phase Status

| Phase | Scope | Status | Branch prefix |
|---|---|---|---|
| **0 — Widget** | `content/widget/*` vertical slice (0.1–0.9) | **DONE** — `refactor/widget-vertical-slice` through `82a5121` | `refactor/widget-vertical-slice` |
| **MV3-B** | Service worker, storage migrations, auth bridge, manifest audit, content entry | **NEW — optional priority track** | `refactor/mv3-boundary-*` |
| **1 — Popup** | Feature modules under `popup/features/*`, events shell | **Mostly done** — `popup.js` ~1,705 lines; `setupEventListeners` still in shell | `refactor/popup-*` |
| **2 — Supabase** | `extension/supabase/*` (~18 modules); thin `supabase-client.js` shim | **In progress / harden** — batch 2.1–2.10 | `refactor/supabase-*` |
| **3 — Content QuickPaste** | `quick-paste/*` modules; widget legacy path in content-script | **QuickPaste monolith remains** | `refactor/quick-paste-*` |
| **4 — Production** | Section G checklist, version bump, store upload | **Blocked** until Phases 1–3 + CodeScene ≥ 7 | — |

---

## 5. MV3-Boundary Refactor Track (Optional Priority)

| Slice | Target files | Model | Smoke test |
|---|---|---|---|
| **MV3-B1** | `background.js`, `background/service-worker.js`, `background/handlers/messages-internal.js`, `messages-external.js`, `background/shared.js` | Composer 2.5 | Extension reload → internal message (`pcCopyText`) returns OK |
| **MV3-B2** | `background/shared.js` (`SCHEMA_VERSION`, `onInstalled` migrations), `supabase/storage-adapter.js`, shared storage constants | Composer 2.5 | Bump test migration idempotently; reload preserves clips/settings |
| **MV3-B3** | `supabase/auth.js`, `supabase/auth-bridge.js`, popup `auth.session.js` / `auth.service.js` | Composer 2.5 → **Opus 4.7** | Login → reload popup → session restored via bridge |
| **MV3-B4** | `manifest.json` permissions/host_permissions/CSP audit | Composer 2.5 (doc-first) | Checklist doc only; minimal manifest diff if gap found |
| **MV3-B5** | `content-script.js`, `content/content.js`, `web_accessible_resources`, site-guard injection | Composer 2.5 | Load arbitrary page → widget + QuickPaste init once; no double inject |

**Note:** B1/B2 partially landed (thin entry shims exist). Remaining work = handler decomposition, migration registry clarity, message-type constants.

---

## 5.1 Arkitect Slice Ownership & Parallel Rules

Mitigate overlap when multiple agents run on the same refactor track.

### A. Parallel rules

- Max **2–3 coding agents** only when **edit folders are disjoint**.
- **One agent per hot seam:** `background/shared.js`, Supabase orchestrator (`supabase/class.js`, `supabase/index.js`), content entry (`content-script.js`, `content/content.js`).
- Each coding agent: Arkitect `analyze` + **`explicitRefactorIntent: true`** + **`requestedOutcome`** before any edit.
- **Sequential merge to main** after Ezequiel confirms SUCCESS per slice — no parallel commits on overlapping paths.
- **Research-only parallel** (up to 5 agents): safe; **overlapping file edits** are not.

### B. Ownership table

| Slice | Owns (edit) | Must NOT touch | Parallel OK with | Model |
|---|---|---|---|---|
| **MV3-B1** *(DONE — uncommitted)* | `background.js`, `background/service-worker.js`, `background/messaging/router.js`, `background/messaging/message-types.js`, `background/handlers/messages-internal.js`, `background/handlers/internal/internal-handlers.js`, `background/handlers/messages-external.js` | `background/shared.js`, `extension/supabase/*`, `content/*` | Research on B4/B5 only | Composer 2.5 |
| **MV3-B2** | `background/shared.js` (`SCHEMA_VERSION`, `onInstalled` migrations), `supabase/storage-adapter.js`, shared storage constants | `background/messaging/*`, `background/handlers/internal/*`, `supabase/auth.js` | B4 (manifest audit), B5 (content entry) | Composer 2.5 |
| **MV3-B3** | `supabase/auth.js`, `supabase/auth-bridge.js`, `popup/features/auth/auth.session.js`, `popup/features/auth/auth.service.js` | `background/shared.js`, `supabase/full-sync.js`, `popup/features/clips/*` | B4; QuickPaste 3.1–3.2 (disjoint folders) | Composer 2.5 → Opus 4.7 |
| **MV3-B4** | `manifest.json` (permissions, host_permissions, CSP audit doc) | `background/handlers/*`, `supabase/*` | B2, B5, Supabase 2.1 (research) | Composer 2.5 |
| **MV3-B5** | `content-script.js`, `content/content.js`, `manifest.json` `web_accessible_resources` | `content/merchant/*`, `content/quick-paste/quick-paste.js` body | B4; QuickPaste 3.1 (constants/helpers only) | Composer 2.5 |
| **Supabase 2.1** | `supabase/core.js`, `supabase/class.js`, `supabase/index.js`, `supabase/storage-adapter.js` | `supabase/auth.js`, `background/shared.js` | MV3-B4; QuickPaste 3.1 | Composer 2.5 |
| **Supabase 2.2** | `supabase/auth.js`, `supabase/auth-bridge.js` | **MV3-B3** (same files — coordinate), `full-sync.js` | None while B3 active | Composer 2.5 → Opus 4.7 |
| **Supabase 2.3–2.5** | `subscription.js`, `identity.js` · `sync-queue.js` · `realtime.js` | Orchestrator wiring in `class.js`/`index.js` (one agent) | Each other if sequential; not with 2.1 | Composer 2.5 |
| **Supabase 2.6–2.7** | `sync-clips.js`, `sync-categories.js` · `sync-notes.js`, `sync-archived.js`, `sync-settings.js` | `full-sync.js`, `sync-queue.js` | QuickPaste 3.3–3.4 | Composer 2.5 |
| **Supabase 2.8** | `profile-sync.js`, `profile-images.js`, `ai-history-sync.js` | `auth.js`, popup profile UI | QuickPaste 3.2 | Composer 2.5 |
| **Supabase 2.9–2.10** | `ai-functions.js`, `ai-workflow.js` · `full-sync.js` | All other `supabase/sync-*.js` during 2.10 | None parallel with 2.10 | Composer 2.5 → Opus 4.7 |
| **QuickPaste 3.1** | Extract `content/quick-paste/qp.constants.js`, `qp.helpers.js` from `quick-paste.js` | `content/content.js`, `content-script.js`, `content/merchant/*` | MV3-B5 (after entry stable); Supabase 2.6+ | Composer 2.5 |
| **QuickPaste 3.2** | `content/quick-paste/qp.styles.js` | `qp.render.js`, `content/widget/*` | 3.1 after SUCCESS | Composer 2.5 |
| **QuickPaste 3.3** | `content/quick-paste/qp.storage.js` | `supabase/storage-adapter.js`, `background/shared.js` | 3.1, 3.2 | Composer 2.5 |
| **QuickPaste 3.4** | `content/quick-paste/qp.render.js` | `qp.events.js`, `qp.paste.js` (later slices) | 3.1–3.3 | Composer 2.5 |
| **Popup 1.S / 1.F** | `popup.js` (`setupEventListeners` ~L493), `popup/popup.events.js`, `popup/events/*` | `popup/features/*` (except auth.events bridge calls), `supabase/*` | QuickPaste 3.x; Supabase 2.8 | Composer 2.5 |

### C. Arkitect intake template

Agents copy per slice before coding:

```yaml
requestedOutcome: "Extract [SLICE_ID] ONLY: [files/functions]. DO NOT edit: [forbidden paths]."
explicitRefactorIntent: true
category: moving-features
architectureId: vertical-slice
remixId: clean-slice-fusion
```

### D. Example filled intakes

- **MV3-B2:** `requestedOutcome: "Extract MV3-B2 ONLY: SCHEMA_VERSION + onInstalled migration registry in background/shared.js; align supabase/storage-adapter.js. DO NOT edit: background/messaging/*, background/handlers/internal/*, supabase/auth.js."`
- **Supabase 2.1:** `requestedOutcome: "Extract Supabase 2.1 ONLY: core.js, class.js, index.js, storage-adapter.js orchestrator wiring. DO NOT edit: supabase/auth.js, background/shared.js migrations."`
- **QuickPaste 3.1:** `requestedOutcome: "Extract QuickPaste 3.1 ONLY: qp.constants.js + qp.helpers.js from content/quick-paste/quick-paste.js. DO NOT edit: content/content.js, content-script.js, content/merchant/*."`

---

## 6. Supabase Phase 2 — Batched Slices (2.1–2.10)

Modules live under `extension/supabase/`. Keep `PasteCraftSupabase` orchestrator + `pasteCraftSupabase` singleton. No storage key renames.

| Slice | Modules | Primary | Escalate |
|---|---|---|---|
| **2.1** | `core.js`, `class.js`, `index.js`, `storage-adapter.js` | Composer 2.5 | Sonnet 5 if class wiring breaks |
| **2.2** | `auth.js`, `auth-bridge.js` | Composer 2.5 | **Opus 4.7** — session bridge |
| **2.3** | `subscription.js`, `identity.js` | Composer 2.5 | GLM 5.2 Max if device/user merge blocked |
| **2.4** | `sync-queue.js` | Composer 2.5 | **Opus 4.7** — queue compaction/execute |
| **2.5** | `realtime.js` | Composer 2.5 | Opus 4.7 if handler CC > 9 |
| **2.6** | `sync-clips.js`, `sync-categories.js` | Composer 2.5 | GLM 5.2 Max — multi-table merge |
| **2.7** | `sync-notes.js`, `sync-archived.js`, `sync-settings.js` | Composer 2.5 | GLM 5.2 Max |
| **2.8** | `profile-sync.js`, `profile-images.js`, `ai-history-sync.js` | Composer 2.5 | Sonnet 5 for upload URL edge cases |
| **2.9** | `ai-functions.js`, `ai-workflow.js` | Composer 2.5 | **Opus 4.7** — AI call cluster |
| **2.10** | `full-sync.js` | Composer 2.5 | **Opus 4.7** — `performFullSync` brain method |

Gate per slice: CodeScene pre-commit; no function CC > 9; `supabase-client.js` shim unchanged or thinner only.

---

## 7. Content-Script Phase 3 — QuickPaste (3.1–3.x)

**Entry:** `content-script.js` → dynamic import → `content/content.js` (site-guard, widget, QuickPaste, merchant).

**Widget:** Phase 0 complete on `refactor/widget-vertical-slice` (`content/widget/*`). Legacy `PasteCraftFloatingWidget` in old monolith content-script is superseded — merge branch before treating widget as done on main.

**QuickPaste target modules** (`content/quick-paste/`):

| Slice | Module | Primary | Escalate |
|---|---|---|---|
| **3.1** | `qp.constants.js`, `qp.helpers.js` | Composer 2.5 | — |
| **3.2** | `qp.styles.js` | Composer 2.5 | Sonnet 5 if CSS string split regresses layout |
| **3.3** | `qp.storage.js` | Composer 2.5 | — |
| **3.4** | `qp.render.js` | Composer 2.5 | — |
| **3.5** | `qp.events.js`, `qp.paste.js` | Composer 2.5 | Sonnet 5 if listener duplication |
| **3.6** | `qp.settings-modal.js` | Composer 2.5 | Sonnet 5 |
| **3.7** | `qp.clips-actions.js` | Composer 2.5 | — |
| **3.8** | `qp.controller.js` + thin `quick-paste.js` shell | Composer 2.5 | — |

Gate: behavior unchanged; no storage key renames; CodeScene on extracted files.

---

## 8. Phase 1 — Popup Remaining Shell

| Item | Target | Model | Notes |
|---|---|---|---|
| **1.S** | `setupEventListeners` → full delegation to `popup/popup.events.js` + `popup/events/*` | Composer 2.5 | `popup.js` still hosts ~L493; goal shell ≤ ~800 lines |
| **1.F** | Residual CRUD/helpers only referenced from shell | Composer 2.5 | Escalate Sonnet 5 for one-off brain stubs |

Most features already in `popup/features/*` (clips, categories, notes, ai-lab, settings, activity, auth, profile, billing, sync).

---

## 9. Phase 4 — Production Gates

After Phases 1–3 + MV3-B (if taken) and CodeScene scores ≥ 7 on touched hotspots:

1. Full Section G checklist (`production-publishing-safety.mdc`)
2. Bump `manifest.json` version (strictly increasing)
3. Unpacked reload test: login, clips, settings persist
4. Package `extension/` zip only
5. Chrome + Edge upload (same zip)
6. User-owned SuccessLog — agent does not write SUCCESS without confirmation

---

## 10. Completed Work Log Pointer

- **Widget Phase 0:** branch `refactor/widget-vertical-slice`, slices 0.1–0.9 committed through **`82a5121`**
- **Popup Phase 1 features:** see `refactor-model-assignments.md` ✅ rows
- **Do not write SuccessLog here** — Ezequiel confirms SUCCESS per slice

---

## 11. What NOT to Refactor (Defer)

- **Pure merchant UI** (`content/merchant/*`) unless touching MV3 boundary (messages, storage, injection)
- **Docs-only changes** unless explicitly requested
- **DeepSeek / GPT ladders** — superseded by Composer-first ladder above for this plan
- **Storage key renames** without migration ticket
- **Netlify / store publish** until Phase 4 gates pass

---

## References

- `docs/refactoring/master-refactor-roadmap.md` — CC baselines, original phase breakdown
- `docs/refactoring/refactor-model-assignments.md` — historical model map (May 2026)
- `.cursor/rules/refactor-model-switching-workflow.mdc` — approval gates
- `.cursor/rules/production-publishing-safety.mdc` — Section G publish checklist
