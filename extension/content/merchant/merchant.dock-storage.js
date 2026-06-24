import {
  ETSY_TAG_PROFILE,
  MERCHANT_DOCK_DEFAULT_TTL_MS,
  MERCHANT_STORAGE_KEYS,
} from './merchant.constants.js';
import { normalizeMaterialsForSave } from './merchant.materials.js';
import { normalizeTagsForSave, normalizeTagsInputString } from './merchant.tags.js';

const DOCK_KEY = MERCHANT_STORAGE_KEYS.DOCK_STAGING;

function nowIso() {
  return new Date().toISOString();
}

function computeExpiresAt(ttlMs = MERCHANT_DOCK_DEFAULT_TTL_MS) {
  return new Date(Date.now() + ttlMs).toISOString();
}

function sanitizeField(value, maxLen) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/** Validates and normalizes dock payload before write. */
export function normalizeDockPayload(input = {}, source = 'manual', profile = null) {
  const title = sanitizeField(input.title, 500);
  const description = sanitizeField(input.description, 5000);
  const { tags, validation } = normalizeTagsForSave(input.tags || '', profile);
  const { materials, validation: materialsValidation } = normalizeMaterialsForSave(input.materials || '');
  const allowedSources = new Set(['manual', 'clipboard', 'selection', 'spot', 'clip']);
  const safeSource = allowedSources.has(source) ? source : 'manual';

  return {
    title,
    description,
    tags,
    materials,
    tag_validation: {
      count: validation.count,
      maxTags: validation.maxTags,
      warnings: validation.warnings,
      hasErrors: validation.hasErrors,
    },
    materials_validation: {
      count: materialsValidation.count,
      maxItems: materialsValidation.maxItems,
      warnings: materialsValidation.warnings,
      hasErrors: materialsValidation.hasErrors,
    },
    source: safeSource,
    updated_at: nowIso(),
    expires_at: computeExpiresAt(),
  };
}

export function isDockPayloadExpired(payload) {
  if (!payload?.expires_at) return true;
  return Date.parse(payload.expires_at) <= Date.now();
}

export function isDockPayloadEmpty(payload) {
  if (!payload) return true;
  return !payload.title && !payload.description && !payload.tags && !payload.materials;
}

/** Future Supabase row shape — local-only in Phase 2. */
export function toSupabaseStagingRow(dockPayload, userId = null) {
  if (!dockPayload) return null;
  return {
    user_id: userId,
    title: dockPayload.title || '',
    description: dockPayload.description || '',
    tags: dockPayload.tags || '',
    materials: dockPayload.materials || '',
    source: dockPayload.source || 'manual',
    updated_at: dockPayload.updated_at,
    expires_at: dockPayload.expires_at,
  };
}

export async function readListingDock() {
  try {
    const stored = await chrome.storage.local.get([DOCK_KEY]);
    const payload = stored[DOCK_KEY];
    if (!payload || typeof payload !== 'object') return null;

    if (isDockPayloadExpired(payload)) {
      await clearListingDock();
      return null;
    }
    return payload;
  } catch (err) {
    console.error('[merchant.dock-storage:readListingDock]', err);
    return null;
  }
}

export async function saveListingDock(input, source = 'manual', profile = null) {
  const payload = normalizeDockPayload(input, source, profile);
  if (isDockPayloadEmpty(payload)) {
    return { ok: false, error: 'At least one field (title, description, tags, or materials) is required.' };
  }

  try {
    await chrome.storage.local.set({ [DOCK_KEY]: payload });
    return { ok: true, payload };
  } catch (err) {
    console.error('[merchant.dock-storage:saveListingDock]', err);
    return { ok: false, error: 'Failed to save listing dock.' };
  }
}

export async function clearListingDock() {
  try {
    await chrome.storage.local.remove([DOCK_KEY]);
    return { ok: true };
  } catch (err) {
    console.error('[merchant.dock-storage:clearListingDock]', err);
    return { ok: false, error: 'Failed to clear listing dock.' };
  }
}

function looksLikeTagList(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  if (/[,;\n\t|]/.test(trimmed)) return true;
  if (/^\s*(?:[-*•]|\d+[.)])\s+/m.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 2 && trimmed.length <= 500;
}

/** Minimal listing-pack parse: title:/description:/tags: sections. */
export function parseListingPackText(text, profile = null) {
  const tagProfile = profile || ETSY_TAG_PROFILE;
  const result = { title: '', description: '', tags: '' };
  const trimmed = (text || '').trim();
  if (!trimmed) return result;

  const sectionPattern = /(?:^|\n)(title|description|tags):\s*/gi;
  const matches = [...trimmed.matchAll(sectionPattern)];
  if (matches.length === 0) {
    if (looksLikeTagList(trimmed)) {
      result.tags = normalizeTagsInputString(trimmed, tagProfile);
    } else {
      result.description = trimmed;
    }
    return result;
  }

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const key = match[1].toLowerCase();
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : trimmed.length;
    const value = trimmed.slice(start, end).trim();
    if (key === 'title') result.title = value;
    else if (key === 'description') result.description = value;
    else if (key === 'tags') result.tags = normalizeTagsInputString(value, tagProfile);
  }
  return result;
}

export async function stageFromSelectionText(text, source = 'selection', profile = null) {
  const parsed = parseListingPackText(text, profile);
  return saveListingDock(parsed, source, profile);
}

export async function stageFromClipboard(profile = null) {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = parseListingPackText(text, profile);
    const result = await saveListingDock(parsed, 'clipboard', profile);
    if (result.ok) {
      result.rawInput = parsed;
    }
    return result;
  } catch (err) {
    console.error('[merchant.dock-storage:stageFromClipboard]', err);
    return { ok: false, error: 'Could not read clipboard. Try again after clicking the page.' };
  }
}
