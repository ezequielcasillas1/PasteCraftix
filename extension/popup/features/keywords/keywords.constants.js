/** @forward-slice Keywords tab — English word review from clip text. */

export const KEYWORD_SELECTORS = Object.freeze({
  TAB: 'keywordsTab',
  SOURCE: 'keywordsSource',
  HIDE_COMMON: 'keywordsHideCommon',
  WORD_LIST: 'keywordsWordList',
  DEFINITION: 'keywordsDefinition',
  REVIEW_BTN: 'reviewKeywordsBtn',
  BULK_SEND_BTN: 'bulkSendKeywordsBtn',
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
