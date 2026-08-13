/**
 * Notes destination catalog — single queue for clip, bulk, and category send.
 * Sources adapt their payload; this module owns pending state + album picker.
 * @forward-slice notes
 */

const DEFAULT_EMPTY = 'No clip to send to notes';

export function normalizeClipsForNotes(clips) {
  const list = Array.isArray(clips) ? clips : (clips ? [clips] : []);
  return list.filter((clip) => clip && clip.id != null);
}

function setPendingClips(app, list) {
  app.pendingNoteForAlbum = null;
  if (list.length > 1) {
    app.pendingBulkClipsForNotes = list;
    app.pendingClipForNotes = null;
    return;
  }
  app.pendingBulkClipsForNotes = null;
  app.pendingClipForNotes = list[0];
}

export async function queueClipsForNotes(app, clips, options = {}) {
  const list = normalizeClipsForNotes(clips);
  if (!list.length) {
    app.showToast?.(options.emptyMessage || DEFAULT_EMPTY, 'error');
    return false;
  }

  await app.loadNotes?.();
  setPendingClips(app, list);
  app.showAlbumPicker?.();
  return true;
}
