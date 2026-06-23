import { ETSY_TAG_PROFILE } from './merchant.constants.js';

/** Split comma/semicolon/newline-separated tag input. */
export function splitTagInput(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Join normalized tags for dock storage display. */
export function tagsToStorageString(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.filter(Boolean).join(', ');
}

/**
 * Etsy tag profile: dedupe (case-insensitive), trim, validate length and count.
 * @returns {{ tags: string[], chips: Array, count: number, maxTags: number, maxChars: number, warnings: string[], hasErrors: boolean }}
 */
export function validateEtsyTags(rawInput) {
  const items = splitTagInput(typeof rawInput === 'string' ? rawInput : tagsToStorageString(rawInput));
  const seen = new Set();
  const chips = [];
  const validTags = [];
  const warnings = [];

  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) {
      chips.push({
        text: trimmed,
        status: 'duplicate',
        message: 'Duplicate tag',
      });
      continue;
    }
    seen.add(lower);

    if (trimmed.length > ETSY_TAG_PROFILE.MAX_CHARS) {
      chips.push({
        text: trimmed,
        status: 'invalid_length',
        message: `${trimmed.length}/${ETSY_TAG_PROFILE.MAX_CHARS} chars`,
      });
      continue;
    }

    if (validTags.length >= ETSY_TAG_PROFILE.MAX_TAGS) {
      chips.push({
        text: trimmed,
        status: 'over_limit',
        message: `Over ${ETSY_TAG_PROFILE.MAX_TAGS} tag limit`,
      });
      continue;
    }

    validTags.push(trimmed);
    chips.push({ text: trimmed, status: 'valid', message: null });
  }

  if (items.length > validTags.length + chips.filter((c) => c.status !== 'valid').length) {
    // dupes/invalid handled above
  }

  const invalidCount = chips.filter((c) => c.status === 'invalid_length').length;
  const duplicateCount = chips.filter((c) => c.status === 'duplicate').length;
  const overLimitCount = chips.filter((c) => c.status === 'over_limit').length;

  if (invalidCount > 0) {
    warnings.push(`${invalidCount} tag(s) exceed ${ETSY_TAG_PROFILE.MAX_CHARS} characters`);
  }
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} duplicate tag(s) removed`);
  }
  if (overLimitCount > 0) {
    warnings.push(`Only first ${ETSY_TAG_PROFILE.MAX_TAGS} valid tags kept`);
  }
  if (validTags.length === ETSY_TAG_PROFILE.MAX_TAGS && overLimitCount > 0) {
    warnings.push(`Tag limit reached (${ETSY_TAG_PROFILE.MAX_TAGS}/${ETSY_TAG_PROFILE.MAX_TAGS})`);
  }

  return {
    tags: validTags,
    chips,
    count: validTags.length,
    maxTags: ETSY_TAG_PROFILE.MAX_TAGS,
    maxChars: ETSY_TAG_PROFILE.MAX_CHARS,
    warnings,
    hasErrors: invalidCount > 0 || overLimitCount > 0,
  };
}

/** Normalize tags for save — valid Etsy profile only. */
export function normalizeTagsForSave(rawInput) {
  const result = validateEtsyTags(rawInput);
  return {
    tags: tagsToStorageString(result.tags),
    validation: result,
  };
}
