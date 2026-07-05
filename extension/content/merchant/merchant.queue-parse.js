function cleanQueuePart(part) {
  return String(part || '')
    .trim()
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
}

/** Comma / semicolon / newline / pipe / tab split — same engine as materials. */
export function splitQueueInput(text) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/[,;\n\t|]/.test(trimmed)) {
    return trimmed.split(/[,;\n\t|]+/).map(cleanQueuePart).filter(Boolean);
  }
  if (/\n/.test(trimmed)) {
    return trimmed.split(/\n+/).map(cleanQueuePart).filter(Boolean);
  }
  return [trimmed];
}

export function queueToStorageString(items) {
  if (!Array.isArray(items)) return '';
  return items.filter(Boolean).join(', ');
}

export function normalizeQueueInputString(text) {
  return queueToStorageString(splitQueueInput(text));
}

export function validateQueueItems(rawInput, { maxItems = 50, maxChars = 500 } = {}) {
  const items = splitQueueInput(typeof rawInput === 'string' ? rawInput : queueToStorageString(rawInput));
  const seen = new Set();
  const valid = [];
  const warnings = [];

  for (const raw of items) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    if (trimmed.length > maxChars) {
      warnings.push(`"${trimmed.slice(0, 20)}…" exceeds ${maxChars} chars`);
      continue;
    }
    if (valid.length >= maxItems) {
      warnings.push(`Only first ${maxItems} item(s) kept`);
      break;
    }
    valid.push(trimmed);
  }

  return {
    items: valid,
    count: valid.length,
    maxItems,
    warnings,
    hasErrors: warnings.length > 0,
  };
}

export function normalizeQueueForSave(rawInput, options = {}) {
  const normalized = normalizeQueueInputString(rawInput);
  const result = validateQueueItems(normalized, options);
  return {
    value: queueToStorageString(result.items),
    validation: result,
  };
}
