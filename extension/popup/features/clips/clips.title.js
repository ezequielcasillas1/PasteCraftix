import {
  getClipWriteCrud,
  persistClipTitleState,
  queueClipTitleSync,
} from '../../../bridges/clips/clips-write.facade.js';
import { getClipIdKey } from '../../../shared/clip-id.js';

export function findClipLocationById(app, clipId) {
  const idKey = getClipIdKey(clipId);
  const activeIndex = app.clips.findIndex(c => getClipIdKey(c?.id) === idKey);
  if (activeIndex >= 0) return { listName: 'clips', index: activeIndex, clip: app.clips[activeIndex] };

  const archivedIndex = app.searchOnlyClips.findIndex(c => getClipIdKey(c?.id) === idKey);
  if (archivedIndex >= 0) {
    return { listName: 'searchOnlyClips', index: archivedIndex, clip: app.searchOnlyClips[archivedIndex] };
  }

  return null;
}

export function promptEditClipTitle(app, clipId) {
  const location = findClipLocationById(app, clipId);
  if (!location?.clip) {
    app.showToast('Clip not found');
    return;
  }

  const currentTitle = app._clipTitle(location.clip);
  const fallback = app._clipFallbackTitle(location.clip, 80);
  const nextTitle = prompt('Edit clip title (leave blank to clear):', currentTitle || fallback);
  if (nextTitle === null) return;

  updateClipTitleById(app, clipId, nextTitle);
}

export async function updateClipTitleById(app, clipId, title) {
  const idKey = getClipIdKey(clipId);
  const normalizedTitle = typeof globalThis.PCClipTitle !== 'undefined'
    ? globalThis.PCClipTitle.normalizeTitle(title)
    : String(title || '').replace(/\s+/g, ' ').trim().slice(0, 120);

  return app._queueClipOp(async () => {
    const PasteCraftCRUD = getClipWriteCrud();
    const result = await PasteCraftCRUD.saveOperation({
      stateGetter: () => ({
        clips: app.clips,
        searchOnlyClips: app.searchOnlyClips,
        notes: app.notes,
      }),
      stateSetter: async (newState) => {
        app.clips = Array.isArray(newState.clips) ? newState.clips : [];
        app.searchOnlyClips = Array.isArray(newState.searchOnlyClips) ? newState.searchOnlyClips : [];
        app.notes = Array.isArray(newState.notes) ? newState.notes : [];
      },
      stateKeys: ['clips', 'searchOnlyClips', 'notes'],
      validator: () => {
        const location = findClipLocationById(app, clipId);
        return { valid: !!location?.clip, error: 'Clip not found' };
      },
      mutateState: async (state) => {
        const location = findClipLocationById({
          ...app,
          clips: state.clips,
          searchOnlyClips: state.searchOnlyClips,
        }, clipId);
        if (!location?.clip) throw new Error('Clip not found');

        const updatedAt = Date.now();
        const nextClip = {
          ...location.clip,
          title: normalizedTitle,
          updatedAt,
        };

        if (location.listName === 'clips') {
          state.clips[location.index] = nextClip;
        } else {
          state.searchOnlyClips[location.index] = nextClip;
        }

        const notesApp = { ...app, notes: state.notes };
        const changedNotes = updateNoteClipTitlesById(notesApp, idKey, normalizedTitle, updatedAt);
        state.notes = notesApp.notes;

        return { changedNotes, nextClip, listName: location.listName };
      },
      storageKeys: ['clips', 'searchOnlyClips', 'notes'],
      storageWriter: async (data) => {
        await persistClipTitleState(data);
      },
      verifier: async () => {
        const verification = await chrome.storage.local.get(['clips', 'searchOnlyClips']);
        const verifiedPool = [...(verification.clips || []), ...(verification.searchOnlyClips || [])];
        const verifiedClip = verifiedPool.find(c => getClipIdKey(c?.id) === idKey);
        return !!verifiedClip && app._clipTitle(verifiedClip) === normalizedTitle;
      },
      uiUpdater: () => {
        app.renderChips();
        app.renderSearchResults();
        app.renderCategories();
        app.renderNotes();
        app.clipsFeature?.viewer?.refreshIfOpen?.(app, clipId);
        app.notesFeature?.refreshOpenViewsForClipEdit?.(app, clipId, { title: normalizedTitle });
      },
      backgroundSync: async (meta) => {
        await queueClipTitleSync(meta);
      },
      successMessage: () => '',
      errorMessage: (error) => `Failed to update clip title: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => {
        if (msg) app.showToast(msg, type);
      },
    });

    if (!result.success) {
      return false;
    }

    app.showToast(normalizedTitle ? 'Clip title updated' : 'Clip title cleared');
    return true;
  });
}

export function updateNoteClipTitlesById(app, clipId, title, updatedAt) {
  const changedNotes = [];
  const idKey = getClipIdKey(clipId);
  const PasteCraftCRUD = getClipWriteCrud();

  (app.notes || []).forEach(note => {
    if (!Array.isArray(note?.clips)) return;
    let changed = false;
    note.clips = note.clips.map(clip => {
      if (getClipIdKey(clip?.id) !== idKey) return clip;
      changed = true;
      return { ...clip, title };
    });
    if (changed) {
      note.updatedAt = updatedAt;
      changedNotes.push(PasteCraftCRUD.createSnapshot(note));
    }
  });

  return changedNotes;
}
