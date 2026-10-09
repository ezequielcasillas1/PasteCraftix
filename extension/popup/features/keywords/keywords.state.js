/** In-memory keyword review. Cleared when the popup closes. */

export function createKeywordsState(options = {}) {
  return {
    sourceLabel: '',
    words: [],
    hideCommon: false,
    phraseMode: !!options.phraseMode,
    selectedKeys: [],
    anchorKey: '',
    phraseKey: '',
    phraseLabel: '',
    clipId: null,
    openKey: '',
    savedKeys: null,
    savedPlaces: null,
    saveTarget: '',
    phraseTimer: 0,
    settleLookup: null,
    entries: new Map(),
    lookupSeq: 0,
  };
}

/** Keywords page view: open file, expanded folders, open word, inline name form, search and pagination. */
export function createKeywordsPageState() {
  return {
    viewFileId: '',
    expanded: new Set(),
    expandedSeeded: false,
    openKey: '',
    form: null,
    fileSearch: '',
    filePage: 0,
    folderSearch: '',
    folderPage: 0,
    wordSearch: '',
    wordPages: new Map(),
  };
}
