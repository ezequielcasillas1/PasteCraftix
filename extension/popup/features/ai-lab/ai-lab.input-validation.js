import { AI_TEXT_INPUT_MAX_CHARS } from './ai-lab.constants.js';

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function clampAiInputLength(value, maxChars = AI_TEXT_INPUT_MAX_CHARS) {
  const raw = String(value ?? '');
  if (raw.length <= maxChars) return raw;
  return raw.slice(0, maxChars);
}

export function getMeaningfulWordCount(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const words = text.match(WORD_PATTERN);
  return Array.isArray(words) ? words.length : 0;
}

export function hasMeaningfulInput(value, minWords = 1) {
  return getMeaningfulWordCount(value) >= Math.max(1, Number(minWords) || 1);
}

export function getRemainingMeaningfulWords(value, minWords = 1) {
  const required = Math.max(1, Number(minWords) || 1);
  return Math.max(0, required - getMeaningfulWordCount(value));
}
