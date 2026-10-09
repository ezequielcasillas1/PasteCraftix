/** Local word bank. Saved keywords stay in chrome.storage.local. */

import { displaySenses, selectEmphasisSenses } from './keywords.dictionary.js';
import { KEYWORD_BANK_LIMIT, KEYWORD_BANK_STORAGE_KEY } from './keywords.constants.js';

const KINDS = new Set(['entry', 'emphasis', 'missing']);

function plainSense(sense) {
  return {
    partOfSpeech: String(sense?.partOfSpeech || ''),
    definition: String(sense?.definition || ''),
    example: String(sense?.example || ''),
    synonyms: Array.isArray(sense?.synonyms) ? sense.synonyms.slice(0, 6) : [],
    related: Array.isArray(sense?.related) ? sense.related.slice(0, 6) : [],
  };
}

function normalizeSenses(senses) {
  if (!Array.isArray(senses)) return [];
  return senses.slice(0, 8).map((sense) => plainSense(sense)).filter((sense) => sense.definition || sense.partOfSpeech);
}

function normalizeParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts.slice(0, 8).map((part) => ({
    word: String(part?.word || ''),
    phonetic: String(part?.phonetic || ''),
    found: !!part?.found,
    senses: normalizeSenses(part?.senses),
  })).filter((part) => part.word);
}

export function normalizeBankEntry(entry, now = Date.now()) {
  const key = String(entry?.key || entry?.text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const savedAt = Number(entry?.savedAt);
  return {
    key,
    text: String(entry?.text || key).slice(0, 120),
    savedAt: Number.isFinite(savedAt) ? savedAt : now,
    sourceLabel: String(entry?.sourceLabel || '').slice(0, 80),
    clipId: entry?.clipId == null ? null : entry.clipId,
    kind: KINDS.has(entry?.kind) ? entry.kind : 'missing',
    phonetic: String(entry?.phonetic || ''),
    senses: normalizeSenses(entry?.senses),
    parts: normalizeParts(entry?.parts),
    folderId: String(entry?.folderId || '').trim().slice(0, 48),
  };
}

export function upsertKeyword(bank, entry, limit = KEYWORD_BANK_LIMIT) {
  const next = normalizeBankEntry(entry);
  const current = Array.isArray(bank) ? bank.map((item) => normalizeBankEntry(item)).filter(Boolean) : [];
  if (!next) return current.slice(0, limit);
  const previous = current.find((item) => item.key === next.key);
  if (!next.folderId && previous?.folderId) next.folderId = previous.folderId;
  return [next, ...current.filter((item) => item.key !== next.key)].slice(0, limit);
}

export function removeKeywordFromBank(bank, key) {
  const target = String(key || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return (Array.isArray(bank) ? bank : []).filter((item) => item?.key !== target);
}

export function readKeywordBank(stored) {
  const raw = stored?.[KEYWORD_BANK_STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const items = [];
  for (const item of raw) {
    const next = normalizeBankEntry(item);
    if (!next || seen.has(next.key)) continue;
    seen.add(next.key);
    items.push(next);
    if (items.length >= KEYWORD_BANK_LIMIT) break;
  }
  return items;
}

export function bankEntryFromLookup(state, now = Date.now()) {
  const key = String(state?.phraseKey || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  const record = state.entries?.get?.(key);
  if (!record || record.status === 'loading') return { pending: true };
  if (record.status === 'error') return { blocked: true };

  const base = {
    key,
    text: String(state.phraseLabel || key),
    savedAt: now,
    sourceLabel: String(state.sourceLabel || ''),
    clipId: state.clipId ?? null,
  };
  const result = record.result;
  if (record.status !== 'ready' || !result) {
    return { ...base, kind: 'missing', phonetic: '', senses: [], parts: [] };
  }
  if (result.kind === 'emphasis') {
    const phraseWords = (result.parts || []).map((part) => part.word);
    return {
      ...base,
      kind: 'emphasis',
      phonetic: '',
      senses: [],
      parts: (result.parts || []).map((part) => {
        const found = !!part.entry?.found;
        return {
          word: part.word,
          phonetic: found ? String(part.entry.phonetic || '') : '',
          found,
          senses: found ? selectEmphasisSenses(part.entry, phraseWords).map((sense) => plainSense(sense)) : [],
        };
      }),
    };
  }
  const entry = result.entry;
  if (!entry?.found) return { ...base, kind: 'missing', phonetic: '', senses: [], parts: [] };
  return {
    ...base,
    kind: 'entry',
    phonetic: String(entry.phonetic || ''),
    senses: displaySenses(entry).map((sense) => plainSense(sense)),
    parts: [],
  };
}