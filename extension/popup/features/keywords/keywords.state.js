/** In-memory keyword review. Cleared when the popup closes. */

export function createKeywordsState() {
  return {
    sourceLabel: '',
    words: [],
    hideCommon: false,
    selectedKeys: [],
    anchorKey: '',
    phraseKey: '',
    phraseLabel: '',
    phraseTimer: 0,
    settleLookup: null,
    entries: new Map(),
    lookupSeq: 0,
  };
}
