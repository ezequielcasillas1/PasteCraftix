/** @forward-slice Keywords tab — English word review from clip text. */

export const KEYWORD_SELECTORS = Object.freeze({
  TAB: 'keywordsTab',
  FILES: 'keywordsFiles',
  FOLDERS: 'keywordsFolders',
  NERD_TOGGLE: 'keywordsNerdToggle',
  NERD_PANEL: 'keywordsNerdStats',
});

/** Words from the latest Quick Save Text. Separate from the saved word bank. */
export const QUICK_SAVE_KEYWORD_SELECTORS = Object.freeze({
  ROOT: 'quickSaveKeywords',
  TAB: 'quickSaveKeywords',
  SOURCE: 'quickSaveKeywordsSource',
  HIDE_COMMON: 'quickSaveKeywordsHideCommon',
  WORD_LIST: 'quickSaveKeywordsWords',
  DEFINITION: 'quickSaveKeywordsDefinition',
  NERD_TOGGLE: 'quickSaveKeywordsNerdToggle',
  NERD_PANEL: 'quickSaveKeywordsNerdStats',
});

export const KEYWORD_COPY = Object.freeze({
  PAGE_SUBTITLE: 'Keywords pick out the words in what you save and show what each word means.',
  PAGE_EMPTY: 'Save a word from Quick Save Text or from a clip. Saved words stay here.',
  FOLDER_EMPTY: 'No words here yet. Open a word in another folder and use Move to folder.',
  FILES_LABEL: 'Files',
  FOLDERS_IN: 'Folders in',
  GUIDE_LABEL: 'What files and folders do',
  GUIDE_FILES: 'A file groups folders. Tap a file to open it.',
  GUIDE_NEW_FILE: 'New file adds another group.',
  GUIDE_RENAME_FILE: 'Rename and Delete sit under the open file. Saved always stays. Deleting another file moves its words to Saved / All words.',
  GUIDE_SEARCH_FILES: 'Search files finds a file by name.',
  GUIDE_FOLDERS: 'A folder holds the words inside the open file.',
  GUIDE_OPEN_FOLDER: 'Open a folder, then click a word to see its meaning, move it, or delete it.',
  GUIDE_NEW_FOLDER: 'New folder adds a place in this file. The pencil renames it. The trash deletes it and moves its words to another folder in the same file.',
  GUIDE_TARGET: 'Save new words here chooses where the next saved word goes.',
  GUIDE_MOVE: 'Move to folder sends a word to another folder. Search folders and Search keywords find a place or a word.',
  NEW_FILE: 'New file',
  NEW_FOLDER: 'New folder',
  RENAME_FILE: 'Rename file',
  DELETE_FILE: 'Delete file',
  RENAME_FOLDER: 'Rename folder',
  DELETE_FOLDER: 'Delete folder',
  TARGET_BADGE: 'New words go here',
  SET_TARGET: 'Save new words here',
  MOVE: 'Move to folder',
  MOVE_SEARCH: 'Search folders...',
  MOVE_CURRENT: 'Current',
  MOVE_NO_MATCH: 'No folders match your search.',
  FORM_SAVE: 'Save',
  FORM_CANCEL: 'Cancel',
  DEFAULT_FILE: 'Saved',
  DEFAULT_FOLDER: 'All words',
  FIRST_FOLDER: 'Words',
  TAB_TITLE: 'Saved words and what they mean',
  REVIEW_HINT: 'Click a word to see what it means.',
  PHRASE_HINT: 'Click more words to see the phrase they make.',
  ACTIVATE_PHRASE: 'Activate phrase',
  ACTIVATE_PHRASE_TIP: 'Off: look up one word. On: click several words to make a phrase.',
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
  NERD_VIEW: 'View Nerd Stats',
  NERD_HIDE: 'Hide Nerd Stats',
  NERD_LOOKUPS: 'Meaning lookups',
  NERD_LOOKUPS_VALUE: 'No user cap',
  NERD_PHRASE: 'Phrase length',
  NERD_SENSES: 'Meanings shown',
  NERD_STORED: 'Meanings kept',
  NERD_BANK: 'Saved words',
  NERD_PAGE: 'Words per page',
  NERD_DELAY: 'Phrase wait',
  NERD_TIMEOUT: 'Lookup wait',
  NERD_CACHE: 'This session',
  NERD_SELECTED: 'Words selected',
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
  MOVE_FOLDERS_PER_PAGE: 6,
});

/** Second mount inside the clip viewer. Same review, separate from the Keywords tab. */
export const CLIP_VIEWER_KEYWORD_SELECTORS = Object.freeze({
  ROOT: 'clipViewerKeywords',
  TAB: 'clipViewerKeywords',
  SOURCE: 'clipViewerKeywordsSource',
  HIDE_COMMON: 'clipViewerKeywordsHideCommon',
  PHRASE_MODE: 'clipViewerKeywordsPhraseMode',
  WORD_LIST: 'clipViewerKeywordsWords',
  DEFINITION: 'clipViewerKeywordsDefinition',
  NERD_TOGGLE: 'clipViewerKeywordsNerdToggle',
  NERD_PANEL: 'clipViewerKeywordsNerdStats',
});

export const KEYWORD_ACTIONS = Object.freeze({
  LOOKUP: 'keyword-lookup',
  PHRASE_MODE: 'keyword-phrase-mode',
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
  MOVE_TOGGLE: 'keyword-move-toggle',
  MOVE_PAGE: 'keyword-move-page',
  CLEAR_MOVE_SEARCH: 'keyword-clear-move-search',
  FORM_CANCEL: 'keyword-form-cancel',
  FILE_PAGE: 'keyword-file-page',
  FOLDER_PAGE: 'keyword-folder-page',
  WORD_PAGE: 'keyword-word-page',
  CLEAR_FILE_SEARCH: 'keyword-clear-file-search',
  CLEAR_FOLDER_SEARCH: 'keyword-clear-folder-search',
  CLEAR_WORD_SEARCH: 'keyword-clear-word-search',
  NERD_STATS: 'keyword-nerd-stats',
  GUIDE: 'keyword-guide',
});

export const DICTIONARY_SOURCES = Object.freeze({
  FREE: 'free-dictionary',
  WIKTIONARY: 'wiktionary',
  WIKIPEDIA: 'wikipedia',
});

export const FREE_DICTIONARY_ENDPOINT = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
export const WIKTIONARY_ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition/';
export const WIKIPEDIA_SUMMARY_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

export const DICTIONARY_ATTRIBUTION = Object.freeze({
  [DICTIONARY_SOURCES.FREE]: 'Free Dictionary API',
  [DICTIONARY_SOURCES.WIKTIONARY]: 'Wiktionary, CC BY-SA',
  [DICTIONARY_SOURCES.WIKIPEDIA]: 'Wikipedia, CC BY-SA',
});

/**
 * Study-sector keywords → Wikipedia article titles.
 * Used when word dictionaries misread majors (e.g. premed → premedication).
 */
export const STUDY_SECTOR_ALIASES = Object.freeze({
  'pre-med': 'Pre-medical',
  premed: 'Pre-medical',
  'pre medical': 'Pre-medical',
  'pre-medical': 'Pre-medical',
  'pre-law': 'Pre-law',
  prelaw: 'Pre-law',
  'pre-dental': 'Pre-dental',
  predental: 'Pre-dental',
  'pre-pharmacy': 'Pharmacy',
  'computer science': 'Computer science',
  'software engineering': 'Software engineering',
  'information technology': 'Information technology',
  'data science': 'Data science',
  cybersecurity: 'Computer security',
  'computer security': 'Computer security',
  'artificial intelligence': 'Artificial intelligence',
  'machine learning': 'Machine learning',
  biology: 'Biology',
  'molecular biology': 'Molecular biology',
  'cell biology': 'Cell biology',
  microbiology: 'Microbiology',
  biochemistry: 'Biochemistry',
  biophysics: 'Biophysics',
  biotechnology: 'Biotechnology',
  genetics: 'Genetics',
  neuroscience: 'Neuroscience',
  chemistry: 'Chemistry',
  physics: 'Physics',
  mathematics: 'Mathematics',
  statistics: 'Statistics',
  engineering: 'Engineering',
  'mechanical engineering': 'Mechanical engineering',
  'electrical engineering': 'Electrical engineering',
  'civil engineering': 'Civil engineering',
  'chemical engineering': 'Chemical engineering',
  'biomedical engineering': 'Biomedical engineering',
  'industrial engineering': 'Industrial engineering',
  'aerospace engineering': 'Aerospace engineering',
  medicine: 'Medicine',
  nursing: 'Nursing',
  pharmacy: 'Pharmacy',
  dentistry: 'Dentistry',
  'public health': 'Public health',
  psychology: 'Psychology',
  sociology: 'Sociology',
  anthropology: 'Anthropology',
  economics: 'Economics',
  'political science': 'Political science',
  'business administration': 'Business administration',
  accounting: 'Accounting',
  finance: 'Finance',
  marketing: 'Marketing',
  architecture: 'Architecture',
  education: 'Education',
  journalism: 'Journalism',
  linguistics: 'Linguistics',
  philosophy: 'Philosophy',
  history: 'History',
  'environmental science': 'Environmental science',
  'earth science': 'Earth science',
  astronomy: 'Astronomy',
  geology: 'Geology',
});

export const MAX_SENSES = 4;
export const STORED_SENSES = 8;
export const MAX_PHRASE_WORDS = 8;
export const EMPHASIS_SENSES = 1;
export const PHRASE_LOOKUP_DELAY_MS = 280;
export const LOOKUP_TIMEOUT_MS = 8000;

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
