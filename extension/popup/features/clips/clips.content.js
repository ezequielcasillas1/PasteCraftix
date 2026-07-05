/** @forward-slice clips — edit clip content CRUD */
import {
  getClipWriteCrud,
  persistClipTitleState,
  queueClipTitleSync,
} from '../../../bridges/clips/clips-write.facade.js';
import { getClipIdKey } from '../../../shared/clip-id.js';
import { findClipLocationById } from './clips.title.js';

const EDITOR_ID = 'pcClipContentEditorPortal';

function normalizeClipContent(text) {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

export function closeClipContentEditor() {
  const portal = document.getElementById(EDITOR_ID);
  if (!portal) return;
  document.removeEventListener('keydown', portal._pcKeyHandler, true);
  portal.remove();
}

function openClipContentEditor(app, clipId, clip) {
  closeClipContentEditor();

  const portal = document.createElement('div');
  portal.id = EDITOR_ID;
  portal.className = 'modal-overlay pc-clip-content-editor-portal';
  portal.setAttribute('role', 'presentation');

  const currentText = String(clip?.text ?? '');

  portal.innerHTML = `
    <div class="modal-content pc-clip-content-editor" role="dialog" aria-modal="true" aria-labelledby="pcClipContentEditorTitle">
      <div class="modal-header">
        <h3 id="pcClipContentEditorTitle">Edit clip</h3>
        <button type="button" class="modal-close pc-clip-content-cancel" aria-label="Close editor">&times;</button>
      </div>
      <div class="modal-body">
        <label class="pc-clip-content-label" for="pcClipContentTextarea">Clip content</label>
        <textarea id="pcClipContentTextarea" class="pc-clip-content-textarea" rows="10"></textarea>
      </div>
      <div class="modal-footer pc-clip-content-editor-footer">
        <button type="button" class="btn-secondary pc-clip-content-cancel">Cancel</button>
        <button type="button" class="btn-primary pc-clip-content-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(portal);

  const textarea = portal.querySelector('#pcClipContentTextarea');
  const saveBtn = portal.querySelector('.pc-clip-content-save');

  textarea.value = currentText;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });

  const handleClose = () => {
    closeClipContentEditor();
  };

  const handleSave = async () => {
    const nextText = normalizeClipContent(textarea.value);
    if (!nextText.trim()) {
      app.showToast('Clip content cannot be empty', 'error');
      textarea.focus();
      return;
    }
    if (nextText === currentText) {
      handleClose();
      return;
    }
    saveBtn.disabled = true;
    const ok = await updateClipContentById(app, clipId, nextText);
    saveBtn.disabled = false;
    if (ok) handleClose();
  };

  portal.querySelectorAll('.pc-clip-content-cancel').forEach((btn) => {
    btn.addEventListener('click', handleClose);
  });
  saveBtn.addEventListener('click', () => { void handleSave(); });
  portal.addEventListener('click', (event) => {
    if (event.target === portal) handleClose();
  });

  portal._pcKeyHandler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  };
  document.addEventListener('keydown', portal._pcKeyHandler, true);

  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSave();
    }
  });
}

export function promptEditClipContent(app, clipId) {
  const location = findClipLocationById(app, clipId);
  if (!location?.clip) {
    app.showToast('Clip not found');
    return;
  }
  openClipContentEditor(app, clipId, location.clip);
}

export async function updateClipContentById(app, clipId, text) {
  const idKey = getClipIdKey(clipId);
  const normalizedText = normalizeClipContent(text);

  if (!normalizedText.trim()) {
    app.showToast('Clip content cannot be empty', 'error');
    return false;
  }

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
          text: normalizedText,
          updatedAt,
        };

        if (location.listName === 'clips') {
          state.clips[location.index] = nextClip;
        } else {
          state.searchOnlyClips[location.index] = nextClip;
        }

        const notesApp = { ...app, notes: state.notes };
        const changedNotes = updateNoteClipTextsById(notesApp, idKey, normalizedText, updatedAt);
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
        return !!verifiedClip && String(verifiedClip.text ?? '') === normalizedText;
      },
      uiUpdater: () => {
        app.renderChips();
        app.renderSearchResults();
        app.renderCategories();
        app.renderNotes();
        app.updatePreview?.();
        app.maybeRefreshRefactorizationPanel?.();
        app.clipsFeature?.viewer?.refreshIfOpen?.(app, clipId);
        app.notesFeature?.refreshOpenViewsForClipEdit?.(app, clipId, { text: normalizedText });
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

    if (!result.success) {
      return false;
    }

    app.showToast('Clip updated');
    return true;
  });
}

export function updateNoteClipTextsById(app, clipId, text, updatedAt) {
  const changedNotes = [];
  const idKey = getClipIdKey(clipId);
  const PasteCraftCRUD = getClipWriteCrud();

  (app.notes || []).forEach(note => {
    if (!Array.isArray(note?.clips)) return;
    let changed = false;
    note.clips = note.clips.map(clip => {
      if (getClipIdKey(clip?.id) !== idKey) return clip;
      changed = true;
      return { ...clip, text };
    });
    if (changed) {
      note.updatedAt = updatedAt;
      changedNotes.push(PasteCraftCRUD.createSnapshot(note));
    }
  });

  return changedNotes;
}
