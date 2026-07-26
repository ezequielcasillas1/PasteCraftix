// @forward-slice AI Lab magic — craft category suggest + assign
import {
  CRAFT_CATEGORY_SUGGESTION_COUNT,
} from './ai-lab.craft-clips.constants.js';
import { createCategory } from '../categories/categories.service.js';

function _metaSourceUrl(meta) {
  return String(meta.sourcePageUrl || meta.url || '').trim();
}

function _clipOwnSourceUrl(clip) {
  return String(clip?.sourcePageUrl || clip?.url || '').trim();
}

function _rawClipSourceUrl(clip) {
  const meta = clip && typeof clip.meta === 'object' ? clip.meta : {};
  return _metaSourceUrl(meta) || _clipOwnSourceUrl(clip);
}

function _hostnameFromUrl(raw) {
  try {
    return String(new URL(raw).hostname || '').toLowerCase().slice(0, 80);
  } catch (_) {
    return raw.slice(0, 80).toLowerCase();
  }
}

export function _clipSourceHint(clip) {
  const raw = _rawClipSourceUrl(clip);
  if (!raw) return '';
  return _hostnameFromUrl(raw);
}

function _parseTitleLines(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/\r?\n|[|•]/g)
    .map((line) => String(line || '').replace(/^\s*(?:[-*]|\d+[\).\s])\s*/, '').trim())
    .filter(Boolean);
}

const GENERIC_CATEGORY_NAMES = new Set([
  'quick notes', 'links', 'work', 'personal', 'reference', 'quick', 'notes',
  'contacts', 'code', 'data', 'markup', 'diagrams', 'uncategorized', 'general',
]);

export function _normalizeAiCategorySuggestions(raw) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = String(item || '').trim();
    if (!name || GENERIC_CATEGORY_NAMES.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= CRAFT_CATEGORY_SUGGESTION_COUNT) break;
  }
  return out;
}

async function _fetchCategorySuggestionsFromSummaryAi(targets) {
  if (!Array.isArray(targets) || targets.length === 0) return [];
  try {
    const source = targets
      .slice(0, 12)
      .map((clip, idx) => {
        const hint = _clipSourceHint(clip);
        const text = String(clip?.text || '').trim().slice(0, 260);
        return hint
          ? `Snippet ${idx + 1}: ${text} [source:${hint}]`
          : `Snippet ${idx + 1}: ${text}`;
      })
      .join('\n');
    const prompt =
      'Return up to 5 custom clipboard category titles that match these snippets. ' +
      'If a source hint appears like [source:example.com], use it as context. ' +
      'If source/topic hints suggest Bible content, prefer canonical book-level titles like Psalms/Proverbs/Romans. ' +
      'For wiki/docs/information sites, prefer topic-specific titles from snippet and source/topic hints. ' +
      'Use specific topical names (not generic words like Work, Personal, Links, Quick, Reference). ' +
      'Output titles only, one per line, no numbering.';
    const summary = await pasteCraftSupabase.generateSummary(source, prompt);
    return _normalizeAiCategorySuggestions(_parseTitleLines(summary));
  } catch (e) {
    console.error('Summary AI category fallback failed:', e);
    return [];
  }
}

function _padCategorySuggestions(names, seen) {
  const pads = ['Quick Notes', 'Links', 'Work', 'Personal', 'Reference'];
  for (const p of pads) {
    if (names.length >= CRAFT_CATEGORY_SUGGESTION_COUNT) break;
    if (!seen.has(p.toLowerCase())) {
      names.push(p);
      seen.add(p.toLowerCase());
    }
  }
  return names.slice(0, CRAFT_CATEGORY_SUGGESTION_COUNT);
}

export function _fallbackCategorySuggestions(app, targets) {
  const names = [];
  const seen = new Set();
  for (const clip of targets) {
    const contentType = app._detectContentType(clip.text, clip.meta);
    const name = app._suggestCategory(contentType).name;
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
  return _padCategorySuggestions(names, seen);
}

export async function _fetchCategorySuggestions(app, targets, hasAi) {
  if (targets.length === 0) return [];
  if (hasAi) {
    try {
      const ai = await pasteCraftSupabase.aiCategorizeSuggestions(targets);
      const custom = _normalizeAiCategorySuggestions(ai);
      if (custom.length > 0) return custom;
      const customFromSummary = await _fetchCategorySuggestionsFromSummaryAi(targets);
      if (customFromSummary.length > 0) return customFromSummary;
    } catch (e) {
      console.error('AI category suggestion flow failed:', e);
    }
  }
  return _fallbackCategorySuggestions(app, targets);
}

function _populateAiCategoryMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const catName = String(aiResults[i] || '').trim();
    if (catName) map.set(String(targets[i].id), catName);
  }
}

export async function _runAiCategorization(targets, hasAi, stats) {
  const map = new Map();
  if (targets.length === 0 || !hasAi) return map;
  try {
    const aiResults = await pasteCraftSupabase.aiCategorize(targets);
    if (Array.isArray(aiResults) && aiResults.length > 0) {
      _populateAiCategoryMap(map, targets, aiResults);
      stats.aiCategorized = true;
    }
  } catch (_) { /* AI failed — fall back to rule-based */ }
  return map;
}

function _resolveSuggestedCategory(app, clip, contentType, aiCategoryMap) {
  const aiCat = aiCategoryMap.get(String(clip.id));
  return aiCat ? { name: aiCat, icon: '🏷️' } : app._suggestCategory(contentType);
}

function _assignClipToExistingCategory(app, clip, existingCat, stats) {
  const clipsInCat = app.clips.filter((c) => c.category === existingCat.name);
  if (clipsInCat.length < 150) {
    clip.category = existingCat.name;
    stats.categorized++;
  }
}

function _queueNewCategoryForClip(clip, suggested, queue) {
  if (!queue.has(suggested.name)) {
    queue.set(suggested.name, suggested);
  }
  clip._pendingCategory = suggested.name;
}

export function _categorizeClipForMagic(app, clip, contentType, ctx) {
  if (clip.category && clip.category !== 'Uncategorized') return;
  const suggested = _resolveSuggestedCategory(app, clip, contentType, ctx.aiCategoryMap);
  const existingCat = app.categories.find((c) => c.name.toLowerCase() === suggested.name.toLowerCase());
  if (existingCat) {
    _assignClipToExistingCategory(app, clip, existingCat, ctx.stats);
  } else {
    _queueNewCategoryForClip(clip, suggested, ctx.queue);
  }
}

export async function _createMissingMagicCategories(app, queue) {
  for (const [name, { icon }] of queue) {
    const exists = app.categories.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) continue;
    try {
      await createCategory(app, name, icon, { silent: true });
    } catch (_) {
      /* fall through — assignPending may still match if created elsewhere */
    }
  }
}

function _categoryHasRoom(app, cat) {
  return app.clips.filter((c) => c.category === cat.name).length < 150;
}

export function _assignPendingMagicCategories(app, stats) {
  for (const clip of app.clips) {
    if (!clip._pendingCategory) continue;
    const cat = app.categories.find((c) => c.name.toLowerCase() === clip._pendingCategory.toLowerCase());
    if (cat && _categoryHasRoom(app, cat)) {
      clip.category = cat.name;
      stats.categorized++;
    }
    delete clip._pendingCategory;
  }
}

function _isValidCategoryPick(name, clipIds) {
  return Boolean(name) && Array.isArray(clipIds) && clipIds.length > 0;
}

async function _ensureCraftCategoryExists(app, name) {
  let existingCat = app.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existingCat) return existingCat;
  try {
    await createCategory(app, name, '🏷️', { silent: true });
    existingCat = app.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  } catch (_) { /* may exist from race */ }
  return existingCat || null;
}

function _isCategoryAtCapacity(app, catName, clip) {
  if (clip.category === catName) return false;
  const clipsInCat = app.clips.filter((c) => c.category === catName);
  return clipsInCat.length >= 150;
}

function _assignClipsToCategory(app, idSet, existingCat) {
  let assigned = 0;
  for (const clip of app.clips) {
    if (!idSet.has(String(clip.id))) continue;
    if (_isCategoryAtCapacity(app, existingCat.name, clip)) continue;
    clip.category = existingCat.name;
    assigned++;
  }
  return assigned;
}

export async function _applyCraftCategoryPick(categoryName, clipIds, saveState) {
  const app = this;
  const name = String(categoryName || '').trim();
  if (!_isValidCategoryPick(name, clipIds)) return 0;

  const existingCat = await _ensureCraftCategoryExists(app, name);
  if (!existingCat) return 0;

  const assigned = _assignClipsToCategory(app, new Set(clipIds.map(String)), existingCat);
  if (assigned > 0 && typeof saveState === 'function') {
    await saveState(app);
  }
  return assigned;
}
