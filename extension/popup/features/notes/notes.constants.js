export const NOTES_STORAGE_KEYS = Object.freeze({
  NOTES: 'notes',
  NOTES_VIEW_MODE: 'notesViewMode',
  NOTES_PAGE_INDEX: 'notesPageIndex',
  NOTES_AI_ENABLED: 'notesAiEnabled',
  UPDATED_AT: 'pc_local_updatedAt',
  TIERED_MIGRATED: 'pc_tiered_storage_migrated_v1',
});

export const NOTES_SYNC_QUEUE_KEYS = Object.freeze({
  NOTES: 'syncNotes',
  DELETED_NOTES: 'syncDeletedNotes',
});

export const NOTES_IDB_STORE = 'notes';
export const NOTES_SUPABASE_TABLE = 'notes';

export const NOTES_DEFAULTS = Object.freeze({
  VIEW_MODE: 'grid',
  PAGE_INDEX: 0,
  AI_ENABLED: false,
  UNTITLED_NOTE: 'Untitled Note',
  UNTITLED_ALBUM: 'Untitled Album',
});

export const NOTES_PAGE_SIZES = Object.freeze({
  LIST: 3,
  GRID: 6,
});

export const NOTES_SELECTORS = Object.freeze({
  CONTAINER: 'notesContainer',
  PAGINATION: 'notesPagination',
  SEARCH_INPUT: 'notesSearchInput',
  SEARCH_CLEAR: 'notesSearchClear',
  CREATE_NOTE_BTN: 'createNoteBtn',
  CREATE_ALBUM_BTN: 'createAlbumBtn',
  VIEW_ALBUMS_BTN: 'viewAlbumsBtn',
  AI_TOGGLE: 'notesAiToggle',
  INFO_EXPAND_BTN: 'notesInfoExpandBtn',
  INFO_MODAL: 'notesInfoModal',
  CLOSE_INFO_MODAL: 'closeNotesInfoModal',
  // Editor
  NOTE_EDITOR_MODAL: 'noteEditorModal',
  NOTE_TITLE_INPUT: 'noteTitleInput',
  NOTE_DESC_INPUT: 'noteDescriptionInput',
  NOTE_BODY_INPUT: 'noteBodyInput',
  NOTE_EDITOR_TYPE: 'noteEditorType',
  NOTE_ATTACHMENTS_LIST: 'noteAttachmentsList',
  NOTE_ATTACHMENTS_SECTION: 'noteEditorAttachmentsSection',
  CLOSE_NOTE_EDITOR: 'closeNoteEditor',
  CANCEL_NOTE_EDITOR: 'cancelNoteEditor',
  SAVE_NOTE_BTN: 'saveNote',
  ADD_CLIP_TO_NOTE: 'addClipToNote',
  ADD_IMAGE_TO_NOTE: 'addImageToNote',
  ADD_URL_TO_NOTE: 'addURLToNote',
  AI_TITLE_BTN: 'aiTitleBtn',
  AI_DESC_BTN: 'aiDescBtn',
  // Viewer
  NOTE_VIEWER_MODAL: 'noteViewerModal',
  CLOSE_NOTE_VIEWER: 'closeNoteViewer',
  CLOSE_NOTE_VIEWER_BTN: 'closeNoteViewerBtn',
  NOTE_VIEWER_BACK_BTN: 'noteViewerBackBtn',
  EDIT_NOTE_FROM_VIEWER: 'editNoteFromViewer',
  COPY_NOTE_CONTENT: 'copyNoteContent',
  COPY_ALL_ATTACHMENTS: 'copyAllAttachments',
  // Clip picker
  CLIP_PICKER_MODAL: 'clipPickerModal',
  CLOSE_CLIP_PICKER: 'closeClipPicker',
  CLIP_PICKER_SEARCH_INPUT: 'clipPickerSearchInput',
  CLIP_PICKER_ADD_BTN: 'clipPickerAddBtn',
  CLIP_PICKER_RECENT_LIST: 'clipPickerRecentList',
  CLIP_PICKER_SEARCH_LIST: 'clipPickerSearchList',
  CLIP_PICKER_CATEGORIES_LIST: 'clipPickerCategoriesList',
  CLIP_PICKER_CLIPS_TAB: 'clipPickerClipsTab',
  CLIP_PICKER_SEARCH_TAB: 'clipPickerSearchTab',
  CLIP_PICKER_CATEGORIES_TAB: 'clipPickerCategoriesTab',
  // Image picker
  IMAGE_PICKER_MODAL: 'imagePickerModal',
  IMAGE_PICKER_CAPTURES_LIST: 'imagePickerCapturesList',
  IMAGE_PICKER_NOTES_LIST: 'imagePickerNotesList',
  IMAGE_PICKER_FILE_INPUT: 'imagePickerFileInput',
  IMAGE_PICKER_URL_INPUT: 'imagePickerUrlInput',
  IMAGE_PICKER_ADD_BTN: 'imagePickerAddBtn',
  IMAGE_PICKER_EDIT_ADD_BTN: 'imagePickerEditAddBtn',
  IMAGE_PICKER_SELECTION_COUNT: 'imagePickerSelectionCount',
  // Album picker
  ALBUM_PICKER_MODAL: 'albumPickerModal',
  CLOSE_ALBUM_PICKER: 'closeAlbumPicker',
  CREATE_NEW_ALBUM_FROM_PICKER: 'createNewAlbumFromPicker',
  BACK_TO_ALBUM_PICKER: 'backToAlbumPicker',
  ALBUM_PICKER_SEARCH: 'albumPickerSearch',
  ALBUM_PICKER_LIST: 'albumPickerList',
  // Album attachment viewer
  ALBUM_ATTACHMENT_VIEWER_MODAL: 'albumAttachmentViewerModal',
  ALBUM_ATTACHMENT_BACK_BTN: 'albumAttachmentBackBtn',
  CLOSE_ALBUM_ATTACHMENT_VIEWER: 'closeAlbumAttachmentViewer',
  ALBUM_ATTACHMENT_OPEN_IN_POPUP_BTN: 'albumAttachmentOpenInPopupBtn',
  ALBUM_ATTACHMENT_VIEWER_FOOTER: 'albumAttachmentViewerFooter',
  ALBUM_ATTACHMENT_AI_SUMMARY_BTN: 'albumAttachmentAiSummaryBtn',
  ALBUM_ATTACHMENT_AI_BREAKDOWN_BTN: 'albumAttachmentAiBreakdownBtn',
  ALBUM_ATTACHMENT_GOOGLE_SEARCH_BTN: 'albumAttachmentGoogleSearchBtn',
  ALBUM_ATTACHMENT_AI_REFACTOR_BTN: 'albumAttachmentAiRefactorBtn',
  ALBUM_ATTACHMENT_AI_CRAFT_BTN: 'albumAttachmentAiCraftBtn',
  ALBUM_ATTACHMENT_SEND_CATEGORIES_BTN: 'albumAttachmentSendCategoriesBtn',
  ALBUM_ATTACHMENT_SEND_NOTES_BTN: 'albumAttachmentSendNotesBtn',
  ALBUM_ATTACHMENT_ANNOTATE_BTN: 'albumAttachmentAnnotateBtn',
  // Album source note overlay
  ALBUM_SOURCE_NOTE_MODAL: 'albumSourceNoteModal',
  ALBUM_SOURCE_NOTE_BACK_BTN: 'albumSourceNoteBackBtn',
  CLOSE_ALBUM_SOURCE_NOTE_MODAL: 'closeAlbumSourceNoteModal',
  ALBUM_SOURCE_NOTE_COPY_CONTENT: 'albumSourceNoteCopyContent',
});
