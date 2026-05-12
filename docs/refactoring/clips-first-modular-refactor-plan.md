---
name: Clips-first modular refactor
overview: Extract the Clips feature from the large popup script into feature-based modules, using CodeScene MCP as the refactor guide and quality gate.
target_date: Thursday
status: planned
primary_file: extension/popup.js
---

# Clips-First Modular Refactor Plan

## Goal

Refactor PasteCraft one feature at a time, starting with Clips. The first pass should keep behavior unchanged while moving Clips logic out of `extension/popup.js` into focused modules.

Architecture pattern: feature-based modular architecture with layered modules inside each feature folder. This is also close to vertical slice architecture because each feature owns its UI, state, events, and service logic.

## Why Clips First

- Clips are the core product workflow.
- Clips touch storage, rendering, categories, search, copy, delete, archive, and sync.
- Extracting Clips first creates the pattern for Categories, Notes, AI Lab, Settings, Billing, Auth, and Sync.
- The work can be tested with visible user flows after every small extraction.

## Current Constraints

- `extension/popup.html` currently loads `popup.js` as a classic script, not `type="module"`.
- `extension/popup.js` contains the main `PasteCraftPopup` class and assigns `window.pasteCraftPopup`.
- Some existing popup actions reference `window.pasteCraftPopup` directly.
- The first extraction must preserve those global bridge points until each feature is safely moved.
- No storage key rename, schema change, auth change, or Supabase write-path change should happen during the Clips refactor.

## Current Architecture Dependencies

These files are part of the Clips architecture and must be checked before moving code:

- `extension/popup.js` - main Clips UI, state, rendering, category actions, search/archive, PDF import, Magic, notes clip picker, restore points, and sync triggers.
- `extension/popup.html` - DOM contract for Clips selectors, tabs, modals, bulk actions, manual input, search, PDF import, and clip picker.
- `extension/background.js` - context-menu clip creation path, `saveTextDirectly()`, archive overflow, and `clipSaved` broadcasts.
- `extension/content-script.js` - Quick Paste clip read/delete/paste flow and storage/message refresh contract.
- `extension/supabase-client.js` - `syncWithQueue`, Clips sync, archived Clips sync, realtime refresh, tombstone guards, and remote pagination.
- `extension/indexeddb-store.js` - local entity mirror for clips, categories, and notes.
- `extension/tiered-storage.js` and `extension/storage-meter.js` - lazy loading, local budget, and archive pagination support.
- `extension/markup-renderer.js` and `extension/clip-title.js` - clip preview rendering, markup detection, and title behavior.
- `extension/styles.css`, `extension/styles/clip-title.css`, `extension/styles/clip-viewer.css` - existing Clips styling surface.

## Clip Data Contract

Do not change this shape during the first pass:

- Active clips live in `chrome.storage.local` key `clips`.
- Archived/search-only clips live in `chrome.storage.local` key `searchOnlyClips`.
- Clip fields currently include `id`, `text`, `title`, `category`, `timestamp`, `updatedAt`, `deletedAt`, `deviceId`, and `meta`.
- Supabase maps active clips to `clips` and archived clips to `archived_clips`.
- IDs must remain stable; do not introduce a new ID strategy during this refactor.

## Entry Points To Preserve

- Context menu save from `background.js`.
- Manual text save from popup.
- PDF-to-clips save flow.
- Quick Paste read, paste, multi-copy, and delete.
- Clip delete, archive overflow, restore, category move, and bulk actions.
- Search tab and category tab clip actions.
- Magic auto-categorize, format, dedupe, and organize flow.
- Notes clip picker and send-to-notes flows.
- Realtime `dataChanged`, runtime `clipSaved`, and `clipsUpdated` refresh paths.

## Global Bridge Contract

Keep these stable until the full popup is converted safely:

- `window.pasteCraftPopup`
- `PasteCraftPopup.handleMessage()`
- `window.renderLucideIcons()`
- Runtime messages: `clipSaved`, `clipsUpdated`, `showCategoryModal`
- Existing fallback `onclick="window.pasteCraftPopup..."` paths in generated empty states

## CodeScene MCP Role

Use CodeScene MCP as a required guide before and after each refactor slice.

Required MCP workflow:

1. Select the PasteCraft project in CodeScene MCP.
2. Run a Code Health review on `extension/popup.js`.
3. Record the baseline issues for Clips-related code: complexity, size, duplication, cohesion, and hotspot risk.
4. Extract one small Clips slice.
5. Re-run Code Health review or score.
6. If Code Health regresses, refactor before continuing.
7. Before commit, run the CodeScene pre-commit safeguard.

Useful CodeScene MCP tools to include if available:

- `select_codescene_project`
- `code_health_review`
- `code_health_score`
- `pre_commit_code_health_safeguard`
- `analyze_change_set`
- `list_technical_debt_hotspots`

If CodeScene MCP is not connected on Thursday, continue with manual extraction only after noting that the CodeScene quality gate was skipped.

## Target Folder Shape

```text
extension/
  popup/
    features/
      clips/
        clips.controller.js
        clips.state.js
        clips.service.js
        clips.render.js
        clips.events.js
        clips.selectors.js
        clips.constants.js
    shared/
      popup-dom.js
      popup-storage.js
      popup-events.js
      popup-bridge.js
```

## Long-Term Popup Organization

Use vertical slices for product features, and separate cross-cutting systems into modules.

```text
extension/
  popup/
    app/
      popup-bootstrap.js
      popup-app.js

    features/
      clips/
      categories/
      notes/
      ai-lab/
      settings/

    modules/
      auth/
      billing/
      sync/

    shared/
      popup-bridge.js
      popup-dom.js
      popup-events.js
      popup-storage.js
      crud-operations.js
```

Feature folders own user-facing workflows. Module folders own cross-cutting app capabilities that support multiple features.

Do not force Auth, Billing, or Sync into `features/` unless they become full user-facing feature slices with their own tab/page workflow.

## Feature Modularity Rule

Use vertical slices first, then modularize inside each slice only when the code proves the responsibility exists.

- Start with the smallest useful files for each feature.
- Add `state`, `service`, `render`, `events`, `selectors`, or `constants` only when that responsibility is real.
- Do not create empty architecture folders or placeholder files just for appearance.
- If modularity is found inside a feature during refactor, document it in the dependency map and extract it in the smallest safe slice.

## Modularity Discovery Process

Before extracting each feature, research `popup.js` by feature area and produce a short dependency map.

For each feature, map:

- State variables owned by the feature.
- DOM selectors and popup sections it touches.
- Event listeners and user actions it owns.
- Render functions and markup helpers it uses.
- Storage reads, writes, and storage keys.
- Sync calls, realtime refresh paths, and message events.
- Cross-feature dependencies and shared helper candidates.

Compare features only to find repeated patterns, not to force identical folders. Create module files only when the code proves the responsibility exists.

Dependency map format:

```text
Feature: Clips
State: clips, searchOnlyClips, selectedChips, currentPage
DOM: chipContainer, paginationControls, quickCopyBtn
Storage: clips, searchOnlyClips, pc_local_updatedAt
External: background.js, content-script.js, supabase-client.js
Modules needed: state, service, render, events, selectors, constants
```

## CRUD Utility Placement

`PasteCraftCRUD` is shared popup infrastructure, not a Clips-only service.

- Move generic CRUD helpers to `extension/popup/shared/crud-operations.js`.
- Keep feature-specific CRUD behavior inside each feature service, such as `clips.service.js`, `categories.service.js`, `notes.service.js`, and `settings.service.js`.
- Shared CRUD owns retry, snapshot, rollback, validation, idempotency, and verification patterns.
- Feature services own domain behavior like delete clip, create category, save note, update settings, archive overflow, and related UI refresh.
- Do not grow one global CRUD utility into a new large feature file.

## Module Responsibilities

`clips.controller.js`
- Initializes the Clips feature.
- Connects state, events, rendering, and services.
- Provides a small adapter for the existing `PasteCraftPopup` instance.

`clips.state.js`
- Owns Clips UI state only.
- Keeps selection, pagination, filters, and expanded state isolated.
- Does not write directly to Chrome storage.

`clips.service.js`
- Owns Clips CRUD operations.
- Uses existing storage and sync paths.
- Preserves current id, tombstone, archive, and verification behavior.
- Uses shared CRUD helpers when they fit, but keeps Clips-specific archive/search/sync behavior local to Clips.

`clips.render.js`
- Renders Clips UI from state and data.
- Avoids storage writes and business rules.
- Keeps markup generation close to Clips only.

`clips.events.js`
- Registers Clips click, input, keyboard, and bulk action handlers.
- Uses event delegation where possible.
- Avoids inline handlers for new code.

`clips.selectors.js`
- Centralizes DOM queries for Clips.
- Uses existing DOM structure first; no broad HTML rewrite during extraction.

`clips.constants.js`
- Holds Clips-only constants.
- Shared constants stay in existing shared files when used outside Clips.

## Extraction Order

1. Create a short Clips dependency map from the files listed above.
2. Lock the Clip data contract and DOM selector contract before moving code.
3. Extract Clips constants and selectors.
4. Extract render helpers that do not mutate storage.
5. Extract event registration for Clips-only actions.
6. Extract state helpers for selection, pagination, filters, and expanded state.
7. Extract service operations for copy, delete, archive, restore, and category move.
8. Add the controller bridge between `PasteCraftPopup` and Clips modules.
9. Re-check background, content script, Supabase, IndexedDB, and tiered storage behavior.
10. Final cleanup of duplicated or dead Clips code inside `popup.js`.

## Refactor Slice Rules

- Move one responsibility at a time.
- After each move, the popup must load and Clips must still work.
- Do not combine render, event, state, and service extraction in one slice.
- Keep each slice small enough to review and revert safely.
- Run the manual Clips checklist after every user-facing slice.

## Shared Vs Feature Decision Rule

- If code is used by one feature, keep it in that feature.
- If code is used by two or more features, move it to `extension/popup/shared/`.
- If code coordinates app-wide behavior, move it to `extension/popup/modules/`.
- If code touches storage, sync, auth, or billing, verify it does not bypass existing contracts.

## Safe Bridge Pattern

Start with `popup.js` still owning startup:

```js
document.addEventListener('DOMContentLoaded', () => {
  window.pasteCraftPopup = new PasteCraftPopup();
});
```

Then add a small feature bridge later:

```js
const clipsFeature = await import('./popup/features/clips/clips.controller.js');
clipsFeature.initClipsFeature(window.pasteCraftPopup);
```

This avoids converting the whole popup script to a module in the first pass.

## Legacy Bridge Removal Plan

- Keep `window.pasteCraftPopup` during the Clips extraction.
- Keep existing fallback `onclick="window.pasteCraftPopup..."` paths until their generated UI is moved.
- Keep `PasteCraftPopup.handleMessage()` until runtime message handlers are moved safely.
- Remove global bridge points only after every dependent popup action has migrated to feature/module code.
- Do not remove bridge code in the same slice that introduces new feature modules.

## Guardrails

- Keep behavior unchanged during the first Clips extraction.
- Do not rename storage keys.
- Do not change Supabase schema or RLS.
- Do not bypass existing tiered storage or sync queue behavior.
- Do not introduce new generated IDs in the extension.
- Do not move Categories, Notes, AI Lab, Settings, Auth, Billing, or Sync during the Clips pass.
- Keep new files small, named exports only, and vanilla JavaScript.
- Add tests or manual verification for each user-facing Clips flow touched.

## Useful Follow-Up Notes

- CSS ownership should be decided later: keep shared CSS in `extension/styles.css`, and move only clearly feature-owned styles when safe.
- No behavior rewrite during extraction: keep existing ID generation, storage keys, sync calls, archive limits, and tombstone behavior unchanged.
- Produce the dependency map before coding so the slice boundary is explicit.
- Treat shared helpers as earned abstractions; do not move code to shared just because it might be reused later.

Follow-up meanings:

- CSS ownership: do not split CSS during the first Clips extraction unless a style is clearly Clips-only and safe to move.
- No behavior rewrite: this refactor should move code first, not redesign storage, sync, archive, ID, or tombstone behavior.
- Dependency map first: write the Clips dependency map before coding so the first slice is obvious and reviewable.
- Earned shared helpers: move helper code to `shared/` only after two or more features truly use it.

## Manual Test Checklist

After each slice:

- Popup opens without console errors.
- Existing clips render.
- Context-menu save creates a new clip.
- Manual input save creates a new clip.
- PDF import saves one clip and multiple page clips.
- New clip save still appears in Clips.
- Copy clip still works.
- Delete clip still removes the right item.
- Archive/search-only clips still behave as before.
- Category assignment still displays correctly.
- Bulk selection still works if touched.
- Markup/math clips still render correctly if touched.
- Quick Paste still reads, copies, and deletes clips.
- Magic actions still categorize/format selected clips if touched.
- Notes clip picker and send-to-notes still work if touched.
- Realtime/storage refresh still updates visible Clips views.
- Browser reload keeps clips intact.

## Thursday Work Plan

### Phase 1: Baseline

- Run CodeScene hotspot/code health review.
- Search `popup.js` for Clips-related methods and event handlers.
- Create a short Clips dependency map.
- Confirm the data contract, DOM selector contract, and message bridge contract.
- Pick the smallest safe extraction slice.

### Phase 2: First Extraction

- Create `extension/popup/features/clips/`.
- Move constants/selectors first.
- Wire imports through a minimal bridge.
- Re-test popup load and Clips rendering.

### Phase 3: Behavior Extraction

- Move render-only helpers.
- Move event registration.
- Move isolated state helpers.
- Keep data writes in the original path until service extraction is safe.

### Phase 4: Service Extraction

- Move Clips CRUD operations only after render/events are stable.
- Extract reusable `PasteCraftCRUD` helpers to shared popup infrastructure before broad feature service reuse.
- Preserve current storage, IndexedDB, tombstone, and sync behavior.
- Preserve `background.js`, `content-script.js`, and `supabase-client.js` contracts.
- Re-run CodeScene review after the service move.

### Phase 5: Verification

- Run lint/diagnostics for edited files.
- Run manual Clips checklist.
- Run CodeScene pre-commit safeguard.
- Ask: `Ezequiel is the implementation successful`
- Only after confirmation, write the matching program-study log if requested.

## Next Refactor Order After Clips

Product feature slices:

1. Categories
2. Notes
3. AI Lab
4. Settings

Cross-cutting modules:

1. Auth
2. Billing
3. Sync

Move one folder at a time. Product features go under `extension/popup/features/`; cross-cutting modules go under `extension/popup/modules/`.

## Post-Refactor Follow-Up (Implement After This Pass)

Once the modular refactor is complete and verified, implement the following queued fix using the new `*.events.js` modules — do not patch the monolith before the refactor:

- **Icon Click Hit-Target Fix** — `instructions/request.md` item **#46**
  - Add `pointer-events: none` to all icon elements inside action buttons
  - Ensure event handlers are on the outermost button container, not inner children
  - Surfaces: Popup (PDF button, Save Clip button), content widget (Magic wand button), and any other icon+label button pairs
  - Fix belongs in the new `clips.events.js`, `categories.events.js`, and widget event modules

---

## Done Criteria For The Clips Pass

- Clips code is partially or fully moved into `extension/popup/features/clips/`.
- `popup.js` is smaller and still controls startup safely.
- Existing Clips workflows behave the same.
- CodeScene review shows no regression, or the regression is documented and accepted.
- No user data migration is required.
- No production publishing checklist is triggered unless `manifest.json`, storage shape, auth, or sync behavior changes.
