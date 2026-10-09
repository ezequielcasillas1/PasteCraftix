/** Turn clip text into unique English words, first spelling kept. */

import { COMMON_WORDS, MAX_PHRASE_WORDS } from './keywords.constants.js';

const WORD_PATTERN = /(?<!\d)[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

export function extractKeywords(text) {
  const seen = new Set();
  const words = [];
  for (const match of String(text || '').matchAll(WORD_PATTERN)) {
    const token = match[0];
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push({ text: token, key });
  }
  return words;
}

export function visibleKeywords(words, hideCommon) {
  if (!hideCommon) return words || [];
  return (words || []).filter((word) => !COMMON_WORDS.has(word.key));
}

export function selectedPhrase(words, selectedKeys) {
  const selected = new Set(selectedKeys || []);
  const chosen = (words || []).filter((word) => selected.has(word.key));
  return {
    key: chosen.map((word) => word.key).join(' '),
    label: chosen.map((word) => word.text).join(' '),
  };
}

export function toggleKeywordSelection(words, selectedKeys, key, options = {}) {
  const order = (words || []).map((word) => word.key);
  const wordKey = String(key || '').trim().toLowerCase();
  const current = (selectedKeys || []).filter((item) => order.includes(item));
  if (!order.includes(wordKey)) return { keys: current, limited: false };

  const max = options.max || MAX_PHRASE_WORDS;
  const anchor = String(options.anchor || '').trim().toLowerCase();
  const set = new Set(current);
  if (options.replace) {
    if (current.length === 1 && current[0] === wordKey) return { keys: [], limited: false };
    return { keys: [wordKey], limited: false };
  }
  if (options.extend && order.includes(anchor)) {
    const start = order.indexOf(anchor);
    const end = order.indexOf(wordKey);
    const from = Math.min(start, end);
    const to = Math.max(start, end);
    order.slice(from, to + 1).forEach((item) => set.add(item));
  } else if (set.has(wordKey)) {
    set.delete(wordKey);
  } else {
    set.add(wordKey);
  }

  const desired = order.filter((item) => set.has(item));
  if (desired.length <= max) return { keys: desired, limited: false };
  return { keys: current, limited: true };
}
