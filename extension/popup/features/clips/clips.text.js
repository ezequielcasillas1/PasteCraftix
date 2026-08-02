import {
  persistClipTitleState,
  queueClipTitleSync,
} from '../../../bridges/clips/clips-write.facade.js';
import {
  saveClipsState,
  snapshotClipValue,
} from '../../../bridges/clips/clips-crud.facade.js';
import { getClipIdKey } from '../../../shared/clip-id.js';
import { findClipLocationById } from './clips.title.js';

function updateNoteClipTextsById(app, clipId, text, updatedAt) {
  const changedNotes = [];
  const idKey = getClipIdKey(clipId);

  (app.notes || []).forEach((note) => {
    if (!Array.isArray(note?.clips)) return;
    let changed = false;
    note.clips = note.clips.map((clip) => {
      if (getClipIdKey(clip?.id) !== idKey) return clip;
      changed = true;
      return { ...clip, text };
    });
    if (changed) {
      note.updatedAt = updatedAt;
      changedNotes.push(snapshotClipValue(note));
    }
  });

  return changedNotes;
}

/**
 * Persist clip body text (active or archived) with the same save/sync path as title edits.
 * Does not mutate meta.image or the image side-store.
 */
export async function updateClipTextById(app, clipId, nextText) {
  const idKey = getClipIdKey(clipId);
  const text = String(nextText ?? '');

  return app._queueClipOp(async () => {
    const result = await saveClipsState({
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
          text,
          updatedAt,
        };

        if (location.listName === 'clips') {
          state.clips[location.index] = nextClip;
        } else {
          state.searchOnlyClips[location.index] = nextClip;
        }

        const notesApp = { ...app, notes: state.notes };
        const changedNotes = updateNoteClipTextsById(notesApp, idKey, text, updatedAt);
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
        const verifiedClip = verifiedPool.find((c) => getClipIdKey(c?.id) === idKey);
        return !!verifiedClip && String(verifiedClip.text ?? '') === text;
      },
      uiUpdater: () => {
        app.renderChips?.();
        app.renderSearchResults?.();
        app.renderCategories?.();
        app.renderNotes?.();
        app.notesFeature?.refreshOpenViewsForClipEdit?.(app, clipId, { text });
      },
      backgroundSync: async (meta) => {
        await queueClipTitleSync(meta);
      },
      successMessage: () => '',
      errorMessage: (error) => `Failed to update clip: ${error.message || 'Unknown error'}`,
      showToast: (msg, type) => {
        if (msg) app.showToast(msg, type);
      },
    });

    if (!result.success) return null;
    return result.nextClip || null;
  });
}
