// @forward-slice AI Lab magic — craft AI format + per-clip apply
import { CRAFT_CLIPS_AI_MODES } from './ai-lab.craft-clips.constants.js';
import { _getCraftClipsSettings } from './ai-lab.magic.analyze.js';
import {
  _resolveRefactorSourceClip,
  _normalizeRefactorText,
  _buildRefactoredSiblingClip,
} from './ai-lab.magic.refactor.js';

/** Clear AI-slop phrases — not normal grammar polish. */
const AI_FORMAT_FILLER_RE = /\b(delve|delving|it's important to note|it is important to note|in conclusion|it's worth noting|it is worth noting|in today's world|navigate the complexities|as an ai|underscores the importance|comprehensive overview|robust solution)\b/i;

function _countEmDashes(text) {
  return (String(text || '').match(/—/g) || []).length;
}

/** Allow generous growth: punctuation/structure on short clips often exceeds +12%. */
function _isTooLongAiFormat(orig, fmt) {
  if (!orig.length) return false;
  const maxLen = Math.max(Math.ceil(orig.length * 2.25), orig.length + 160);
  return fmt.length > maxLen;
}

function _hasNewAiFiller(orig, fmt) {
  return AI_FORMAT_FILLER_RE.test(fmt) && !AI_FORMAT_FILLER_RE.test(orig);
}

/** Em-dashes are valid punctuation; only reject heavy decorative spam. */
function _gainedTooManyEmDashes(orig, fmt) {
  return _countEmDashes(fmt) > _countEmDashes(orig) + 3;
}

export function _isSuspiciousAiFormatOutput(original, formatted) {
  const orig = String(original || '').trim();
  const fmt = String(formatted || '').trim();
  if (!fmt || fmt === orig) return false;
  if (_isTooLongAiFormat(orig, fmt)) return true;
  if (_hasNewAiFiller(orig, fmt)) return true;
  if (_gainedTooManyEmDashes(orig, fmt)) return true;
  return false;
}

function _rejectReason(original, formatted) {
  const orig = String(original || '').trim();
  const fmt = String(formatted || '').trim();
  if (!fmt) return 'empty_response';
  if (fmt === orig) return 'identical_text';
  if (_isTooLongAiFormat(orig, fmt)) return 'too_long';
  if (_hasNewAiFiller(orig, fmt)) return 'ai_filler';
  if (_gainedTooManyEmDashes(orig, fmt)) return 'em_dash_spam';
  return null;
}

function _shouldAcceptAiFormat(original, formatted) {
  return !_rejectReason(original, formatted);
}

function _firstDiffIndex(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

export function _populateAiFormatMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const original = (targets[i].text || '').trim();
    const formatted = String(aiResults[i] || '').trim();
    const reason = _rejectReason(original, formatted);
    if (reason) {
      console.warn('[PasteCraft:ai-format]', {
        clipId: String(targets[i].id),
        outcome: 'rejected',
        reason,
        originalLen: original.length,
        formattedLen: formatted.length,
      });
      continue;
    }
    map.set(String(targets[i].id), formatted);
  }
}

export async function _runAiFormatting(targets, hasAi) {
  const map = new Map();
  if (targets.length === 0 || !hasAi) return map;
  try {
    const aiResults = await pasteCraftSupabase.aiFormat(targets);
    console.warn('[PasteCraft:ai-format]', {
      message: 'aiFormat response',
      eligible: targets.length,
      resultCount: Array.isArray(aiResults) ? aiResults.length : 0,
    });
    if (Array.isArray(aiResults) && aiResults.length > 0) {
      _populateAiFormatMap(map, targets, aiResults);
    }
  } catch (err) {
    console.warn('[PasteCraft:ai-format]', {
      message: 'aiFormat request failed',
      error: err?.message || String(err),
    });
  }
  console.warn('[PasteCraft:ai-format]', {
    message: 'accepted map',
    mapSize: map.size,
    eligible: targets.length,
  });
  return map;
}

function _isFormattedMode(settings) {
  return settings.aiMode === CRAFT_CLIPS_AI_MODES.FORMATTED;
}

function _isRefactoringMode(settings) {
  return settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING;
}

function _ensureClipMeta(clip) {
  if (!clip.meta || typeof clip.meta !== 'object') clip.meta = {};
  return clip.meta;
}

function _recordFormatComparison(ctx, clip, before, after) {
  if (!Array.isArray(ctx.formatComparisons)) ctx.formatComparisons = [];
  ctx.formatComparisons.push({
    clipId: String(clip.id),
    before,
    after,
  });
}

function _applyFormattedText(clip, ctx, settings) {
  const aiFormatted = ctx.aiFormatMap.get(String(clip.id));
  const formattedMode = _isFormattedMode(settings);
  const before = String(clip.text || '').trim();
  if (skip) return;

  const meta = _ensureClipMeta(clip);
  if (!meta.craftFormatBefore) meta.craftFormatBefore = before;
  meta.craftFormatted = true;
  meta.craftFormattedAt = Date.now();

  clip.text = aiFormatted;
  clip.updatedAt = Date.now();
  ctx.stats.aiFormatted++;
  _recordFormatComparison(ctx, clip, before, aiFormatted);
}

function _queueRefactoredSibling(app, clip, ctx, settings) {
  if (!_isRefactoringMode(settings)) return;
  const sourceClip = _resolveRefactorSourceClip(app, clip);
  const aiRefactored = ctx.aiRefactorMap.get(String(sourceClip.id));
  if (!aiRefactored) return;
  const original = (sourceClip.text || '').trim();
  if (_normalizeRefactorText(aiRefactored) === _normalizeRefactorText(original)) return;
  ctx.refactorNewClips.push(_buildRefactoredSiblingClip(sourceClip, aiRefactored, settings));
  ctx.stats.aiRefactored++;
}

function _applyRuleBasedEnhance(app, clip, contentType, ctx) {
  const settings = ctx.settings || _getCraftClipsSettings(app);
  if (_isRefactoringMode(settings)) return;
  const enhanced = app._enhanceContent(clip.text, contentType);
  if (enhanced === clip.text) return;
  clip.text = enhanced;
  ctx.stats.enhanced++;
}

export function _applyAiFormatRefactorAndCleanup(app, clip, contentType, ctx) {
  const settings = ctx.settings || _getCraftClipsSettings(app);
  _applyFormattedText(clip, ctx, settings);
  _queueRefactoredSibling(app, clip, ctx, settings);
  _applyRuleBasedEnhance(app, clip, contentType, ctx);
}

export async function _saveCraftFormatHistory(app, ctx) {
  const pairs = ctx.formatComparisons || [];
  if (!pairs.length) return;
  if (typeof app.saveFormatHistory !== 'function') return;
  await app.saveFormatHistory(pairs.map((p) => ({
    before: p.before,
    after: p.after,
    sourceClipId: p.clipId,
    newClipId: p.clipId,
  })));
}
