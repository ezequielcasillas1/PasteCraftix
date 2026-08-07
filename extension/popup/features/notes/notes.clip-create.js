import { getClipPickerElements } from './notes.selectors.js';

const MAX_CLIPS_PER_CATEGORY = 150;

function getWriteCategoryNames(app) {
  const names = ['Uncategorized'];
  const seen = new Set(['uncategorized']);
  (Array.isArray(app.categories) ? app.categories : []).forEach((cat) => {
    const name = typeof cat === 'string' ? cat : cat?.name;
    if (!name || typeof name !== 'string') return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names;
}

export function populateClipPickerWriteCategories(app) {
  const { writeCategory: select } = getClipPickerElements();
  if (!select) return;

  const currentValue = select.value || 'Uncategorized';
  const names = getWriteCategoryNames(app);
  select.innerHTML = '';
  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  select.value = names.includes(currentValue) ? currentValue : 'Uncategorized';
}

export function clearClipPickerWriteForm(app) {
  const { writeTextarea, writeMarkup } = getClipPickerElements();
  if (writeTextarea) {
    writeTextarea.value = '';
    writeTextarea.focus();
  }
  if (writeMarkup) writeMarkup.value = 'auto';
}

function setWriteSavingState(saving) {
  const { writeSaveBtn, writeSaveSpinner, writeSaveLabel } = getClipPickerElements();
  if (writeSaveBtn) writeSaveBtn.disabled = saving;
  if (writeSaveSpinner) writeSaveSpinner.style.display = saving ? 'inline-block' : 'none';
  if (writeSaveLabel) writeSaveLabel.textContent = saving ? 'Saving…' : 'Create & Attach';
}

function isClipAlreadyAttached(app, clipId) {
  return (app.currentNoteAttachments || []).some((att) => att.type === 'clip' && att.id == clipId);
}

function toNoteClipAttachment(clip) {
  return { type: 'clip', id: clip.id, text: clip.text, addedDate: Date.now() };
}

function canAttachClip(app, clip) {
  return Boolean(clip && clip.id != null && !isClipAlreadyAttached(app, clip.id));
}

export function attachCreatedClipsToNote(app, clips) {
  if (!Array.isArray(app.currentNoteAttachments)) app.currentNoteAttachments = [];
  const list = Array.isArray(clips) ? clips : [];
  let addedCount = 0;

  for (const clip of list) {
    if (!canAttachClip(app, clip)) continue;
    app.currentNoteAttachments.push(toNoteClipAttachment(clip));
    addedCount += 1;
  }

  if (addedCount > 0) app.renderNoteAttachments?.();
  return addedCount;
}

function categoryHasRoom(app, category, pendingCount = 1) {
  if (category === 'Uncategorized') return true;
  const allClips = [...(app.clips || []), ...(app.searchOnlyClips || [])];
  const inCat = allClips.filter((c) => c.category === category).length;
  return inCat + pendingCount <= MAX_CLIPS_PER_CATEGORY;
}

function readMarkupMeta(writeMarkup) {
  const selectedMarkup = writeMarkup?.value || 'auto';
  return selectedMarkup === 'auto' ? null : { markupHint: selectedMarkup };
}

function buildWriteClipFromForm(els) {
  const text = els.writeTextarea?.value?.trim() || '';
  const category = els.writeCategory?.value || 'Uncategorized';
  const clipMeta = readMarkupMeta(els.writeMarkup);
  const clip = { id: Date.now() + Math.random(), text, category, timestamp: Date.now() };
  if (clipMeta) clip.meta = clipMeta;
  return { text, category, clip };
}

function validateWriteClipInput(app, text, category) {
  if (!text) {
    app.showToast('Please enter some text to save');
    return false;
  }
  if (!categoryHasRoom(app, category, 1)) {
    app.showToast(`Category "${category}" is full (${MAX_CLIPS_PER_CATEGORY} clips max)`);
    return false;
  }
  return true;
}

function resolveCreateClipsFn(app) {
  const createClips = app.clipsFeature?.service?.createClips;
  if (typeof createClips === 'function') return createClips;
  app.showToast('Clip create is unavailable', 'error');
  return null;
}

function completeWriteClipAttach(app, newClip, category, writeTextarea) {
  const added = attachCreatedClipsToNote(app, [newClip]);
  if (writeTextarea) writeTextarea.value = '';
  if (typeof app.closeClipPicker === 'function') app.closeClipPicker();
  app.showToast(
    added > 0
      ? `Clip created and attached to note (${category})`
      : 'Clip created (already attached)',
  );
}

export async function saveClipPickerWriteClip(app) {
  if (app.noteWriteClipSaveInProgress) return;

  const els = getClipPickerElements();
  const { text, category, clip: newClip } = buildWriteClipFromForm(els);
  if (!validateWriteClipInput(app, text, category)) return;

  const createClips = resolveCreateClipsFn(app);
  if (!createClips) return;

  try {
    app.noteWriteClipSaveInProgress = true;
    setWriteSavingState(true);

    const result = await createClips(app, [newClip], {
      successMessage: null,
      autoShowSavedClip: false,
    });

    if (!result?.success) {
      app.showToast(result?.error || 'Failed to create clip', 'error');
      return;
    }

    completeWriteClipAttach(app, newClip, category, els.writeTextarea);
  } catch (err) {
    console.error('[notes.clip-create] save failed', err);
    app.showToast('Failed to create clip', 'error');
  } finally {
    app.noteWriteClipSaveInProgress = false;
    setWriteSavingState(false);
  }
}

export function chooseClipPickerPdf(app) {
  const { pdfFileInput } = getClipPickerElements();
  if (!pdfFileInput) return;
  pdfFileInput.click();
}

export async function handleClipPickerPdfFileChange(app, event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file) return;

  app._pdfAttachToNote = true;
  if (typeof app.openPdfExtractModal === 'function') {
    await app.openPdfExtractModal(file);
  } else {
    app._pdfAttachToNote = false;
    app.showToast('PDF tools unavailable', 'error');
  }
}

export function finishPdfAttachToNote(app, clipsToSave) {
  app._pdfAttachToNote = false;
  const added = attachCreatedClipsToNote(app, clipsToSave);
  if (typeof app.closeClipPicker === 'function') app.closeClipPicker();
  if (added > 0) {
    app.showToast(
      added === 1
        ? 'PDF clip created and attached to note'
        : `${added} PDF clips created and attached to note`,
    );
  }
  return added;
}
