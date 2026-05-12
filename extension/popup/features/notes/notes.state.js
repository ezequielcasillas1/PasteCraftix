import { NOTES_DEFAULTS } from './notes.constants.js';

export function getNotesStateDefaults() {
  return {
    notes: [],
    currentNoteId: null,
    currentNoteType: 'note',
    currentNoteAttachments: [],
    pendingClipForNotes: null,
    pendingBulkClipsForNotes: null,
    pendingNoteForAlbum: null,
    currentViewerNoteId: null,
    currentAlbumAttachmentContext: null,
    noteViewerParentAlbumId: null,
    notesViewMode: NOTES_DEFAULTS.VIEW_MODE,
    notesPageIndex: NOTES_DEFAULTS.PAGE_INDEX,
    notesAiEnabled: NOTES_DEFAULTS.AI_ENABLED,
    totalNotesCount: 0,
    tieredNotesStore: null,
    selectedPickerClips: new Set(),
  };
}
