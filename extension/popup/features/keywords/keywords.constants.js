/** @forward-slice Keywords tab — English word review from clip text. */

export const KEYWORD_SELECTORS = Object.freeze({
  TAB: 'keywordsTab',
  FILES: 'keywordsFiles',
  FOLDERS: 'keywordsFolders',
});

/** Words from the latest Quick Save Text. Separate from the saved word bank. */
export const QUICK_SAVE_KEYWORD_SELECTORS = Object.freeze({
  ROOT: 'quickSaveKeywords',
  TAB: 'quickSaveKeywords',
  SOURCE: 'quickSaveKeywordsSource',
  HIDE_COMMON: 'quickSaveKeywordsHideCommon',
  WORD_LIST: 'quickSaveKeywordsWords',
  DEFINITION: 'quickSaveKeywordsDefinition',
});

export const KEYWORD_COPY = Object.freeze({
  PAGE_SUBTITLE: 'Keywords pick out the words in what you save and show what each word means.',
  PAGE_EMPTY: 'Save a word from Quick Save Text or from a clip. Saved words stay here.',
  FOLDER_EMPTY: 'No words here yet. Open a word in another folder and use Move to folder.',
  FILES_LABEL: 'Files',
  FOLDERS_IN: 'Folders in',
  NEW_FILE: 'New file',
  NEW_FOLDER: 'New folder',
  RENAME_FILE: 'Rename file',
  DELETE_FILE: 'Delete file',
  RENAME_FOLDER: 'Rename folder',
  DELETE_FOLDER: 'Delete folder',
  TARGET_BADGE: 'New words go here',
  SET_TARGET: 'Save new words here',
  MOVE: 'Move to folder',
  FORM_SAVE: 'Save',
  FORM_CANCEL: 'Cancel',
  DEFAULT_FILE: 'Saved',
  DEFAULT_FOLDER: 'All words',
  FIRST_FOLDER: 'Words',
  TAB_TITLE: 'Saved words and what they mean',
  REVIEW_HINT: 'Click a word to see what it means.',
  OPEN_HINT: 'Click a word to see its meaning, move it, or delete it.',
  SAVE: 'Save keyword',
  SAVED: 'Saved',
  SAVES_TO: 'Saves to',
  SAVED_IN: 'Saved in',
  REMOVE: 'Delete word',
  SEARCH_FILES: 'Search files...',
  SEARCH_FOLDERS: 'Search folders...',
  SEARCH_KEYWORDS: 'Search keywords...',
  NO_FILES_MATCH: 'No files match your search.',
  NO_FOLDERS_MATCH: 'No folders match your search in this file.',
  NO_WORDS_MATCH: 'No keywords match your search in this folder.',
});

export const KEYWORD_FORM_TITLES = Object.freeze({
  'new-file': 'Name the new file',
  'new-folder': 'Name the new folder',
  'rename-file': 'Rename this file',
  'rename-folder': 'Rename this folder',
});

export const KEYWORD_BANK_STORAGE_KEY = 'pastecraftKeywordBank';
export const KEYWORD_LIBRARY_STORAGE_KEY = 'pastecraftKeywordLibrary';
export const KEYWORD_BANK_LIMIT = 200;
export const DEFAULT_KEYWORD_FILE_ID = 'kw-file-saved';
export const DEFAULT_KEYWORD_FOLDER_ID = 'kw-folder-all';

/** One screen of chips or cards. Further items stay on later pages; there is no file or folder ceiling. */
export const KEYWORD_PAGINATION = Object.freeze({
  FILES_PER_PAGE: 5,
  FOLDERS_PER_PAGE: 4,
  WORDS_PER_PAGE: 12,
});

/** Second mount inside the clip viewer. Same review, separate from the Keywords tab. */
export const CLIP_VIEWER_KEYWORD_SELECTORS = Object.freeze({
  ROOT: 'clipViewerKeywords',
  TAB: 'clipViewerKeywords',
  SOURCE: 'clipViewerKeywordsSource',
  HIDE_COMMON: 'clipViewerKeywordsHideCommon',
  WORD_LIST: 'clipViewerKeywordsWords',
  DEFINITION: 'clipViewerKeywordsDefinition',
});

export const KEYWORD_ACTIONS = Object.freeze({
  LOOKUP: 'keyword-lookup',
  CLEAR: 'keyword-clear',
  SAVE: 'keyword-save',
  REMOVE: 'keyword-remove',
  OPEN: 'keyword-open',
  VIEW_FILE: 'keyword-view-file',
  TOGGLE_FOLDER: 'keyword-toggle-folder',
  SET_TARGET: 'keyword-set-target',
  NEW_FILE: 'keyword-new-file',
  NEW_FOLDER: 'keyword-new-folder',
  RENAME_FILE: 'keyword-rename-file',
  RENAME_FOLDER: 'keyword-rename-folder',
  DELETE_FILE: 'keyword-delete-file',
  DELETE_FOLDER: 'keyword-delete-folder',
  MOVE: 'keyword-move',
  FORM_CANCEL: 'keyword-form-cancel',
  FILE_PAGE: 'keyword-file-page',
  FOLDER_PAGE: 'keyword-folder-page',
  WORD_PAGE: 'keyword-word-page',
  CLEAR_FILE_SEARCH: 'keyword-clear-file-search',
  CLEAR_FOLDER_SEARCH: 'keyword-clear-folder-search',
  CLEAR_WORD_SEARCH: 'keyword-clear-word-search',
});

export const DICTIONARY_SOURCES = Object.freeze({
  FREE: 'free-dictionary',
  WIKTIONARY: 'wiktionary',
});

export const FREE_DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
export const WIKTIONARY_ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition/';

export const DICTIONARY_ATTRIBUTION = Object.freeze({
  [DICTIONARY_SOURCES.FREE]: 'Free Dictionary API',
  [DICTIONARY_SOURCES.WIKTIONARY]: 'Wiktionary, CC BY-SA',
});

export const MAX_SENSES = 4;
export const STORED_SENSES = 8;
export const MAX_PHRASE_WORDS = 8;
export const EMPHASIS_SENSES = 1;
export const PHRASE_LOOKUP_DELAY_MS = 280;

/** Function words hidden only when the user turns the toggle on. */
export const COMMON_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while',
  'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'into',
  'over', 'after', 'before', 'about', 'up', 'down', 'out', 'off', 'again',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their',
  'not', 'no', 'yes', 'do', 'does', 'did', 'doing',
  'have', 'has', 'had', 'having',
  'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'shall',
  'than', 'too', 'very', 'just', 'so', 'such', 'there', 'here',
  'what', 'which', 'who', 'whom', 'whose', 'how', 'why', 'where',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'only', 'own', 'same', 'also', 'because', 'until', 'during', 'without',
  'within', 'between', 'through', 'above', 'below', 'under', 'across',
]);
