/** Keyword lookup caps shown in Nerd Stats. Numbers come from the same constants the lookup uses. */

import {
  KEYWORD_BANK_LIMIT,
  KEYWORD_COPY,
  KEYWORD_PAGINATION,
  LOOKUP_TIMEOUT_MS,
  MAX_PHRASE_WORDS,
  MAX_SENSES,
  PHRASE_LOOKUP_DELAY_MS,
  STORED_SENSES,
} from './keywords.constants.js';

export function nerdStatRows(snapshot = {}) {
  const saved = Number(snapshot.savedCount) || 0;
  const rows = [
    { label: KEYWORD_COPY.NERD_LOOKUPS, value: KEYWORD_COPY.NERD_LOOKUPS_VALUE },
    { label: KEYWORD_COPY.NERD_PHRASE, value: `${MAX_PHRASE_WORDS} words` },
    { label: KEYWORD_COPY.NERD_SENSES, value: String(MAX_SENSES) },
    { label: KEYWORD_COPY.NERD_STORED, value: String(STORED_SENSES) },
    { label: KEYWORD_COPY.NERD_BANK, value: `${saved} / ${KEYWORD_BANK_LIMIT}` },
    { label: KEYWORD_COPY.NERD_PAGE, value: String(KEYWORD_PAGINATION.WORDS_PER_PAGE) },
    { label: KEYWORD_COPY.NERD_DELAY, value: `${PHRASE_LOOKUP_DELAY_MS} ms` },
    { label: KEYWORD_COPY.NERD_TIMEOUT, value: `${LOOKUP_TIMEOUT_MS / 1000} s` },
  ];
  if (snapshot.kind === 'review') {
    rows.push({
      label: KEYWORD_COPY.NERD_SELECTED,
      value: `${Number(snapshot.selectedCount) || 0} / ${MAX_PHRASE_WORDS}`,
    });
    rows.push({
      label: KEYWORD_COPY.NERD_CACHE,
      value: `${Number(snapshot.cacheCount) || 0} looked up`,
    });
  }
  return rows;
}
