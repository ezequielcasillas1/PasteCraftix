---
name: Notes Modular Refactor
overview: Extract the Notes feature out of popup.js into a vertical slice at extension/popup/features/notes/, following the same module pattern proven with Clips and Categories. Five incremental slices, each gated by CodeScene before commit.
---

# Notes Modular Refactor

## What exists today

All ~3,100 Notes-related lines still live in `extension/popup.js`. This includes the core notes CRUD, note editor, note viewer, album sub-feature, clip picker, AI title/description, tiered storage, and lazy loading. A ~155-line duplicate block also exists (lines 14141–14296) that will be cleaned up during Slice 5.

## Target folder shape

```
extension/popup/features/notes/
  notes.constants.js     storage keys, defaults, sync queue names, page sizes
  notes.selectors.js     DOM query helpers
  notes.render.js        renderNotes, _renderNoteCard, _attachNoteCardListeners,
                         updateNoteAiControls, renderNoteAttachments
  notes.state.js         state initializers, prefs helpers
  notes.events.js        setupEventListeners notes block, album/viewer/picker wiring
  notes.service.js       loadNotes, saveNotes, saveNotesPrefs, deleteNote,
                         _initializeTieredNotesStorage, _maybeMigrateTieredStorage,
                         _getNoteContentForHash, _lazyLoadNotesPage
  notes.editor.js        openNoteEditor, closeNoteEditor, saveNote,
                         generateNoteTitleFromContent, generateNoteDescriptionFromContent,
                         showClipPickerForNote + all clip picker helpers,
                         addCurrentClipToNote, showImagePickerForNote,
                         addURLToNote, exportNoteToPDF
  notes.album.js         openNoteViewer, closeNoteViewer, refreshAlbumsForNote,
                         showAlbumPicker, showAlbumPickerForNote, closeAlbumPicker,
                         showBackToAlbumPicker, hideBackToAlbumPicker,
                         renderAlbumPicker, filterAlbumPicker, addNoteToAlbum,
                         getAlbumAttachmentOpenMode, openAlbumAttachment,
                         openAlbumAttachmentInEdgePopup, openAlbumAttachmentOverlay,
                         closeAlbumAttachmentViewer, openAlbumSourceNoteOverlay,
                         closeAlbumSourceNoteOverlay, copyAllNoteAttachments
  notes.controller.js    initNotesFeature(app) bridge
```

## Contracts to preserve (do not change these)

- Storage key `notes` in `chrome.storage.local`
- Note shape: `{ id, title, description, type, body, clips, images, urls, noteRefs, createdAt, updatedAt, deletedAt }`
- `PasteCraftPopup.handleMessage()` signatures (called from other features)
- Inline onclick references `window.pasteCraftPopup.notesPageIndex` / `renderNotes()` in lazy load HTML — keep `window.pasteCraftPopup` bridge stable
- `updateClipTitleById` / `_updateNoteClipTitlesById` — cross-feature clip title propagation into notes

---

## Slice 1 — Constants, Selectors, Render (low risk)

**Files created:**
- `extension/popup/features/notes/notes.constants.js`
- `extension/popup/features/notes/notes.selectors.js`
- `extension/popup/features/notes/notes.render.js`

**Methods moved from `popup.js`:**
- `renderNotes` (line 12022)
- `_renderNoteCard` (line 12305)
- `_attachNoteCardListeners` (line 12347)
- `updateNoteAiControls` (line 12400)
- `renderNoteAttachments` (line 12557)

**popup.js change:** Replace each body with a one-line delegate to `this.notesFeature.render.*`.

**CodeScene gate:** `pre_commit_code_health_safeguard` must pass before commit.

---

## Slice 2 — State and Events (medium risk)

**Files created:**
- `extension/popup/features/notes/notes.state.js`
- `extension/popup/features/notes/notes.events.js`

**Methods moved:**
- State prefs: `notesViewMode`, `notesPageIndex`, `notesAiEnabled` helpers → state
- `setupEventListeners` notes block (lines 2651–2988) → `registerNotesEvents(app)`

**popup.js change:** Replace the notes block in `setupEventListeners` with `this.notesFeature.events.registerNotesEvents(this)`.

**CodeScene gate:** `pre_commit_code_health_safeguard` must pass before commit.

---

## Slice 3 — Service (higher risk)

**Files created:**
- `extension/popup/features/notes/notes.service.js`

**Methods moved:**
- `loadNotes` (line 11672)
- `_initializeTieredNotesStorage` (line 11795)
- `_maybeMigrateTieredStorage` notes branch (line 11830)
- `_getNoteContentForHash` (line 11944)
- `saveNotes` (line 11952)
- `saveNotesPrefs` (line 12014)
- `_lazyLoadNotesPage` (line 12209)
- `deleteNote` (line 12768)

**CodeScene gate:** `analyze_change_set` vs `main`; `pre_commit_code_health_safeguard` must pass before commit.

---

## Slice 4 — Editor + Clip Picker (higher risk)

**Files created:**
- `extension/popup/features/notes/notes.editor.js`

**Methods moved:**
- `openNoteEditor` (line 12485)
- `closeNoteEditor` (line 12549)
- `saveNote` (line 12592)
- `generateNoteTitleFromContent` (line 12417)
- `generateNoteDescriptionFromContent` (line 12451)
- `showClipPickerForNote` (line 12822)
- `closeClipPicker` (line 12839)
- `updateClipPickerFooter` (line 12847)
- `togglePickerClip` (line 12861)
- `normalizePickerText` (line 12877)
- `createPickerSearchRowHTML` (line 12881)
- `createPickerChipElement` (line 12906)
- `attachPickerSearchRowHandlers` (line 12949)
- `switchClipPickerTab` (line 12970)
- `renderClipPickerRecentClips` (line 13010)
- `searchClipsInPicker` (line 13032)
- `renderClipPickerSearchResults` (line 13049)
- `renderClipPickerCategories` (line 13067)
- `addSelectedClipsToNote` (line 13182)
- `showImagePickerForNote` (line 13224)
- `addURLToNote` (line 13228)
- `exportNoteToPDF` (line 13243)
- `addCurrentClipToNote` (line 14408)

**CodeScene gate:** `pre_commit_code_health_safeguard` must pass before commit.

---

## Slice 5 — Album + Viewer + Controller Bridge (highest risk)

**Files created:**
- `extension/popup/features/notes/notes.album.js`
- `extension/popup/features/notes/notes.controller.js`

**Methods moved:**
- `openNoteViewer` (line 13637)
- `closeNoteViewer` (line 13840)
- `refreshAlbumsForNote` (line 12656)
- `showAlbumPicker` (line 14316)
- `showAlbumPickerForNote` (line 14322)
- `closeAlbumPicker` (line 14328)
- `showBackToAlbumPicker` (line 14334)
- `hideBackToAlbumPicker` (line 14341)
- `renderAlbumPicker` (line 14348)
- `filterAlbumPicker` (line 14404)
- `addNoteToAlbum` (line 14457)
- `getAlbumAttachmentOpenMode` (line 13846) — deduplicate: remove second copy at ~14141
- `openAlbumAttachment` (line 13852) — deduplicate: remove second copy at ~14147
- `openAlbumAttachmentInEdgePopup` (line 13875) — deduplicate: remove second copy at ~14170
- `openAlbumAttachmentOverlay` (line 13948) — deduplicate: remove second copy at ~14243
- `closeAlbumAttachmentViewer` (line 13999) — deduplicate: remove second copy at ~14292
- `openAlbumSourceNoteOverlay` (line 14005)
- `closeAlbumSourceNoteOverlay` (line 14135)
- `copyAllNoteAttachments` (line 14298)

**Controller bridge** (same pattern as Clips and Categories):
```js
// notes.controller.js
export function initNotesFeature(app) {
  return { render, events, state, service, editor, album };
}
```

```js
// popup.js — inside _initImpl()
await this._initializeNotesFeature();
```

**Cleanup:** Remove the ~155-line duplicate block (lines 14141–14296).

**CodeScene gate:** `analyze_change_set` vs `main`; `pre_commit_code_health_safeguard` must pass before commit.

---

## Manual test checklist (after each slice)

- Popup opens with no console errors
- Notes tab renders existing notes and albums
- Create a new note — it saves and appears
- Edit a note title/description/body
- Delete a note — removed correctly
- Attach a clip to a note via clip picker
- AI title/description generation works (premium)
- Export note to PDF works
- Send note to album works
- Album viewer opens and shows attached notes
- Album attachment viewer opens correctly
- Lazy loading pagination works (if > 3/6 notes)
- Notes search filters correctly
- Notes sync persists after reload
