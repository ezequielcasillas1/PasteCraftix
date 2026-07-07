import { readListingDock } from './merchant.dock-storage.js';
import { copyTextToClipboard } from './merchant.tag-queue.js';

/** Etsy materials — up to 13 values, 45 chars each (practical seller limits). */
export const ETSY_MATERIALS_PROFILE = Object.freeze({
  MAX_ITEMS: 13,
  MAX_CHARS: 45,
});

function cleanPart(part) {
  return String(part || '')
    .trim()
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
}

export function splitMaterialsInput(text) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/[,;\n\t|]/.test(trimmed)) {
    return trimmed.split(/[,;\n\t|]+/).map(cleanPart).filter(Boolean);
  }
  if (/\n/.test(trimmed)) {
    return trimmed.split(/\n+/).map(cleanPart).filter(Boolean);
  }
  return [trimmed];
}

export function materialsToStorageString(items) {
  if (!Array.isArray(items)) return '';
  return items.filter(Boolean).join(', ');
}

export function normalizeMaterialsInputString(text) {
  return materialsToStorageString(splitMaterialsInput(text));
}

export function validateMaterials(rawInput, profile = ETSY_MATERIALS_PROFILE) {
  const maxItems = profile?.MAX_ITEMS ?? ETSY_MATERIALS_PROFILE.MAX_ITEMS;
  const maxChars = profile?.MAX_CHARS ?? ETSY_MATERIALS_PROFILE.MAX_CHARS;
  const items = splitMaterialsInput(typeof rawInput === 'string' ? rawInput : materialsToStorageString(rawInput));
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
      warnings.push(`Only first ${maxItems} materials kept`);
      break;
    }
    valid.push(trimmed);
  }

  return {
    materials: valid,
    count: valid.length,
    maxItems,
    warnings,
    hasErrors: warnings.length > 0,
  };
}

export function normalizeMaterialsForSave(rawInput, profile = ETSY_MATERIALS_PROFILE) {
  const normalized = normalizeMaterialsInputString(rawInput);
  const result = validateMaterials(normalized, profile);
  return {
    materials: materialsToStorageString(result.materials),
    validation: result,
  };
}

function getStagedMaterialsSource() {
  const dock = window.__pasteCraftMerchant?.dock;
  const liveRaw = dock?.getFieldValues?.()?.materials;
  if ((liveRaw || '').trim()) {
    return liveRaw;
  }
  return null;
}

export async function copyAllStagedMaterials() {
  const live = getStagedMaterialsSource();
  let raw = live;
  if (!raw?.trim()) {
    const payload = await readListingDock();
    raw = payload?.materials || '';
  }
  const result = validateMaterials(raw);
  if (result.materials.length === 0) {
    return { ok: false, message: 'No materials to copy.' };
  }
  const text = materialsToStorageString(result.materials);
  const copyResult = await copyTextToClipboard(text);
  if (!copyResult.ok) {
    return { ok: false, message: copyResult.error || 'Copy failed.' };
  }
  return { ok: true, message: `Copied ${result.materials.length} material(s)`, text };
}
