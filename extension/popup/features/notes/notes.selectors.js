import { NOTES_SELECTORS } from './notes.constants.js';

export function byId(id) {
  return document.getElementById(id);
}

export function getNoteContainerElements() {
  return {
    container: byId(NOTES_SELECTORS.CONTAINER),
    pagination: byId(NOTES_SELECTORS.PAGINATION),
    searchInput: byId(NOTES_SELECTORS.SEARCH_INPUT),
    searchClear: byId(NOTES_SELECTORS.SEARCH_CLEAR),
  };
}

export function getNoteEditorElements() {
  return {
    modal: byId(NOTES_SELECTORS.NOTE_EDITOR_MODAL),
    titleInput: byId(NOTES_SELECTORS.NOTE_TITLE_INPUT),
    descInput: byId(NOTES_SELECTORS.NOTE_DESC_INPUT),
    bodyInput: byId(NOTES_SELECTORS.NOTE_BODY_INPUT),
    editorType: byId(NOTES_SELECTORS.NOTE_EDITOR_TYPE),
    attachmentsList: byId(NOTES_SELECTORS.NOTE_ATTACHMENTS_LIST),
    attachmentsSection: byId(NOTES_SELECTORS.NOTE_ATTACHMENTS_SECTION),
    aiTitleBtn: byId(NOTES_SELECTORS.AI_TITLE_BTN),
    aiDescBtn: byId(NOTES_SELECTORS.AI_DESC_BTN),
  };
}

export function getClipPickerElements() {
  return {
    modal: byId(NOTES_SELECTORS.CLIP_PICKER_MODAL),
    searchInput: byId(NOTES_SELECTORS.CLIP_PICKER_SEARCH_INPUT),
    addBtn: byId(NOTES_SELECTORS.CLIP_PICKER_ADD_BTN),
    recentList: byId(NOTES_SELECTORS.CLIP_PICKER_RECENT_LIST),
    searchList: byId(NOTES_SELECTORS.CLIP_PICKER_SEARCH_LIST),
    categoriesList: byId(NOTES_SELECTORS.CLIP_PICKER_CATEGORIES_LIST),
    writeTextarea: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_TEXTAREA),
    writeCategory: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_CATEGORY),
    writeMarkup: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_MARKUP),
    writeSaveBtn: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_SAVE_BTN),
    writeSaveSpinner: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_SAVE_SPINNER),
    writeSaveLabel: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_SAVE_LABEL),
    writeClearBtn: byId(NOTES_SELECTORS.CLIP_PICKER_WRITE_CLEAR_BTN),
    pdfFileInput: byId(NOTES_SELECTORS.CLIP_PICKER_PDF_FILE_INPUT),
    pdfChooseBtn: byId(NOTES_SELECTORS.CLIP_PICKER_PDF_CHOOSE_BTN),
    selectFooter: byId(NOTES_SELECTORS.CLIP_PICKER_SELECT_FOOTER),
  };
}

export function getAlbumPickerElements() {
  return {
    modal: byId(NOTES_SELECTORS.ALBUM_PICKER_MODAL),
    search: byId(NOTES_SELECTORS.ALBUM_PICKER_SEARCH),
    list: byId(NOTES_SELECTORS.ALBUM_PICKER_LIST),
  };
}
