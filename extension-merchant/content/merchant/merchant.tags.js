import { ETSY_TAG_PROFILE } from './merchant.constants.js';

function resolveProfileLimits(profile) {
  return {
    maxTags: profile?.maxTags ?? profile?.MAX_TAGS ?? ETSY_TAG_PROFILE.MAX_TAGS,
    maxChars: profile?.maxChars ?? profile?.MAX_CHARS ?? ETSY_TAG_PROFILE.MAX_CHARS,
  };
}

function cleanTagPart(part) {
  return String(part || '')
    .trim()
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
}

function groupWordsIntoTags(words, maxChars, maxTags) {
  const tags = [];
  let current = '';

  for (const word of words) {
    const w = word.trim();
    if (!w) continue;

    if (w.length > maxChars) {
      if (current) {
        tags.push(current);
        current = '';
      }
      if (tags.length >= maxTags) break;
      tags.push(w.slice(0, maxChars));
      continue;
    }

    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) tags.push(current);
      current = w;
    }
    if (tags.length >= maxTags) break;
  }

  if (current && tags.length < maxTags) {
    tags.push(current);
  }

  return tags.slice(0, maxTags);
}

function expandSegmentsToTags(segments, profile) {
  const { maxChars, maxTags } = resolveProfileLimits(profile);
  const result = [];

  for (const seg of segments) {
    if (result.length >= maxTags) break;
    const cleaned = cleanTagPart(seg);
    if (!cleaned) continue;

    if (cleaned.length <= maxChars) {
      result.push(cleaned);
    } else {
      const words = cleaned.split(/\s+/).filter(Boolean);
      const grouped = groupWordsIntoTags(words, maxChars, maxTags - result.length);
      result.push(...grouped);
    }
  }

  return result.slice(0, maxTags);
}

function splitByExplicitDelimiters(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  if (/\n/.test(normalized)) {
    const lines = normalized.split(/\n+/).map(cleanTagPart).filter(Boolean);
    const bulletLike = lines.some((line) => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line));
    if (bulletLike) {
      return lines.map((line) => cleanTagPart(line.replace(/^(?:[-*•]|\d+[.)])\s+/, ''))).filter(Boolean);
    }
    return lines;
  }
  if (/\t/.test(normalized)) {
    return normalized.split(/\t+/).map(cleanTagPart).filter(Boolean);
  }
  if (/\|/.test(normalized)) {
    return normalized.split(/\|+/).map(cleanTagPart).filter(Boolean);
  }
  if (/;/.test(normalized)) {
    return normalized.split(/;+/).map(cleanTagPart).filter(Boolean);
  }
  if (/,/.test(normalized)) {
    return normalized.split(/,+/).map(cleanTagPart).filter(Boolean);
  }

  return null;
}

/**
 * Parse AI/provider tag lists into platform-sized tag candidates.
 * Handles newlines, bullets, numbered lists, comma/semicolon/pipe/tab,
 * and space-separated prose via greedy word grouping.
 */
export function parseSmartTagCandidates(text, profile = null) {
  const { maxChars, maxTags } = resolveProfileLimits(profile);
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const explicit = splitByExplicitDelimiters(trimmed);
  if (explicit && explicit.length > 0) {
    return expandSegmentsToTags(explicit, profile);
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  return groupWordsIntoTags(words, maxChars, maxTags);
}

/** Split tag input; pass profile for smart AI-list normalization. */
export function splitTagInput(text, profile = null) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (profile) {
    return parseSmartTagCandidates(trimmed, profile);
  }

  if (/[,;\n\t|]/.test(trimmed)) {
    return trimmed
      .split(/[,;\n\t|]+/)
      .map(cleanTagPart)
      .filter(Boolean);
  }

  const spaceParts = trimmed.split(/\s+/).filter(Boolean);
  if (spaceParts.length > 1) {
    return spaceParts;
  }

  return [trimmed];
}

/** Normalize raw tag text to comma-separated storage (Clip Joiner default). */
export function normalizeTagsInputString(text, profile = null) {
  return tagsToStorageString(splitTagInput(text, profile));
}

/** Join normalized tags for dock storage display. */
export function tagsToStorageString(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.filter(Boolean).join(', ');
}

/**
 * Validate tags against a platform profile (dedupe, trim, length, count).
 * @returns {{ tags: string[], chips: Array, count: number, maxTags: number, maxChars: number, warnings: string[], hasErrors: boolean }}
 */
export function validateTags(rawInput, profile) {
  const maxTags = profile?.maxTags ?? profile?.MAX_TAGS ?? ETSY_TAG_PROFILE.MAX_TAGS;
  const maxChars = profile?.maxChars ?? profile?.MAX_CHARS ?? ETSY_TAG_PROFILE.MAX_CHARS;
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
      chips.push({ text: trimmed, status: 'duplicate', message: 'Duplicate tag' });
      continue;
    }
    seen.add(lower);

    if (trimmed.length > maxChars) {
      chips.push({
        text: trimmed,
        status: 'invalid_length',
        message: `${trimmed.length}/${maxChars} chars`,
      });
      continue;
    }

    if (validTags.length >= maxTags) {
      chips.push({
        text: trimmed,
        status: 'over_limit',
        message: `Over ${maxTags} tag limit`,
      });
      continue;
    }

    validTags.push(trimmed);
    chips.push({ text: trimmed, status: 'valid', message: null });
  }

  const invalidCount = chips.filter((c) => c.status === 'invalid_length').length;
  const duplicateCount = chips.filter((c) => c.status === 'duplicate').length;
  const overLimitCount = chips.filter((c) => c.status === 'over_limit').length;

  if (invalidCount > 0) {
    warnings.push(`${invalidCount} tag(s) exceed ${maxChars} characters`);
  }
  if (duplicateCount > 0) {
    warnings.push(`${duplicateCount} duplicate tag(s) removed`);
  }
  if (overLimitCount > 0) {
    warnings.push(`Only first ${maxTags} valid tags kept`);
  }
  if (validTags.length === maxTags && overLimitCount > 0) {
    warnings.push(`Tag limit reached (${maxTags}/${maxTags})`);
  }

  return {
    tags: validTags,
    chips,
    count: validTags.length,
    maxTags,
    maxChars,
    warnings,
    hasErrors: invalidCount > 0 || overLimitCount > 0,
  };
}

/**
 * Etsy tag profile: dedupe (case-insensitive), trim, validate length and count.
 * @returns {{ tags: string[], chips: Array, count: number, maxTags: number, maxChars: number, warnings: string[], hasErrors: boolean }}
 */
export function validateEtsyTags(rawInput) {
  return validateTags(rawInput, ETSY_TAG_PROFILE);
}

/** Normalize tags for save — valid profile only. */
export function normalizeTagsForSave(rawInput, profile = null) {
  const p = profile || ETSY_TAG_PROFILE;
  const normalized = normalizeTagsInputString(rawInput, p);
  const result = validateTags(normalized, p);
  return {
    tags: tagsToStorageString(result.tags),
    validation: result,
  };
}
