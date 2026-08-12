// @forward-slice AI Lab magic — craft pipeline + results
import {
  CRAFT_CLIPS_AI_MODES,
} from './ai-lab.craft-clips.constants.js';
import {
  loadCraftClipsSettings,
  resolveRefactorEdgeLevel,
} from './ai-lab.craft-clips.settings.js';
import { openCraftCategoryPickModal } from './ai-lab.craft-clips.category-pick.js';
import { REFACTOR_TEXT_CREDIT_COST } from './ai-lab.credits.js';
import { _getCraftClipsSettings } from './ai-lab.magic.analyze.js';
import {
  ensureRefactorRegistryReady,
  _normalizeRefactorEligibleTargets,
  _resolveRefactorSkipToast,
  _insertRefactoredSiblingClips,
  _saveCraftRefactorHistory,
} from './ai-lab.magic.refactor.js';
import {
  _fetchCategorySuggestions,
  _runAiCategorization,
  _categorizeClipForMagic,
  _createMissingMagicCategories,
  _assignPendingMagicCategories,
  _applyCraftCategoryPick as _applyCraftCategoryPickImpl,
} from './ai-lab.magic.craft.category.js';
import {
  _runAiFormatting,
  _applyAiFormatRefactorAndCleanup,
  _saveCraftFormatHistory,
} from './ai-lab.magic.craft.format.js';
import {
  isModelNotCapableError,
  MODEL_NOT_CAPABLE_MESSAGE,
} from './ai-lab.model-error.js';
import { _runAiRefactoring } from './ai-lab.magic.craft.refactor-run.js';
import {
  _archiveYoungerDuplicates,
  _detectMagicDuplicates,
} from './ai-lab.magic.craft.duplicates.js';
import {
  _saveMagicState,
  _refreshMagicCreditsAndUi,
} from './ai-lab.magic.craft.persist.js';
import {
  _showMagicResults,
} from './ai-lab.magic.craft.results.js';

export { _showMagicResults };

function _initMagicStats() {
  return {
    categorized: 0,
    enhanced: 0,
    duplicatesFound: 0,
    duplicatesArchived: 0,
    typesFound: {},
    aiCategorized: false,
    aiFormatted: 0,
    aiRefactored: 0,
    craftAiMode: CRAFT_CLIPS_AI_MODES.FORMATTED,
    refactorLevel: 'college',
    duplicateHandling: false,
  };
}

function _buildClipTypeMap(app, targetSet) {
  const map = new Map();
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    map.set(String(clip.id), app._detectContentType(clip.text, clip.meta));
  }
  return map;
}

function _collectUncategorizedTargets(app, targetSet) {
  const out = [];
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    if (!clip.category || clip.category === 'Uncategorized') out.push(clip);
  }
  return out;
}

function _collectAiEligibleTargets(app, targetSet, clipTypeMap, skipTypes) {
  const out = [];
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    const ct = clipTypeMap.get(String(clip.id));
    const trimmedLen = (clip.text || '').trim().length;
    if (!skipTypes.has(ct) && trimmedLen > 5) out.push(clip);
  }
  return out;
}

function _shouldDeferCategoryPick(settings, hasAi, uncategorizedTargets) {
  return settings.smartCategorize && hasAi && uncategorizedTargets.length > 0;
}

function _isRefactoringMode(settings) {
  return settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING;
}

function _blockedNoCreditsPipeline(aiEligibleTargets) {
  return {
    eligible: aiEligibleTargets.length,
    aiResultCount: 0,
    mapSize: 0,
    siblingsCreated: 0,
    skipped: aiEligibleTargets.map((target) => ({
      clipId: String(target.id),
      outcome: 'no_credits',
      reason: 'insufficient_text_credits',
    })),
    blockedBeforeCall: true,
  };
}

function _emptyAiPhase() {
  return {
    aiCategoryMap: new Map(),
    aiFormatMap: new Map(),
    aiRefactorMap: new Map(),
    refactorDiagnostics: new Map(),
    refactorPipeline: null,
  };
}

function _hasAiEligibleWork(hasAi, aiEligibleTargets) {
  return hasAi && aiEligibleTargets.length > 0;
}

async function _runRefactorAiPhase(input) {
  const { app, settings, aiEligibleTargets, stats, phase } = input;
  const edgeLevel = resolveRefactorEdgeLevel(settings.refactorLevel);
  if (!app._hasTextCreditsForRefactor()) {
    stats.refactorError = 'Need more AI credits';
    stats.refactorPipeline = _blockedNoCreditsPipeline(aiEligibleTargets);
    console.warn('[PasteCraft:refactor]', {
      ...stats.refactorPipeline,
      reason: 'blocked_no_credits',
      refactorCost: REFACTOR_TEXT_CREDIT_COST,
    });
    return;
  }
  const refactorResult = await _runAiRefactoring(aiEligibleTargets, edgeLevel, stats);
  phase.aiRefactorMap = refactorResult.map;
  phase.refactorDiagnostics = refactorResult.diagnostics;
  phase.refactorPipeline = refactorResult.pipeline;
}

function _warnSkippedRefactorPhase(aiEligibleTargets, hasAi) {
  console.warn('[PasteCraft:refactor]', {
    eligible: aiEligibleTargets.length,
    hasAi,
    reason: !hasAi ? 'no_ai_access' : 'no_eligible_clips',
  });
}

async function _runMagicAiPhase(input) {
  const {
    app, settings, aiEligibleTargets, uncategorizedTargets, hasAi, deferCategoryPick, stats,
  } = input;
  const phase = _emptyAiPhase();

  if (settings.smartCategorize && !deferCategoryPick) {
    phase.aiCategoryMap = await _runAiCategorization(uncategorizedTargets, hasAi, stats);
  }

  if (_hasAiEligibleWork(hasAi, aiEligibleTargets)) {
    if (_isRefactoringMode(settings)) {
      await _runRefactorAiPhase({ app, settings, aiEligibleTargets, stats, phase });
    } else {
      try {
        phase.aiFormatMap = await _runAiFormatting(aiEligibleTargets, hasAi);
      } catch (err) {
        const msg = isModelNotCapableError(err)
          ? MODEL_NOT_CAPABLE_MESSAGE
          : String(err?.message || 'AI format failed');
        stats.formatError = msg;
        // Surface clearly — do not silently continue as if format succeeded.
        app?.showToast?.(msg, 'error');
      }
    }
  } else if (_isRefactoringMode(settings)) {
    _warnSkippedRefactorPhase(aiEligibleTargets, hasAi);
  }

  return phase;
}

function _processMagicTargetClips(app, ctx) {
  for (const clip of app.clips) {
    if (!ctx.targetSet.has(String(clip.id))) continue;
    const contentType = ctx.clipTypeMap.get(String(clip.id)) || 'text';
    ctx.stats.typesFound[contentType] = (ctx.stats.typesFound[contentType] || 0) + 1;
    if (ctx.settings?.smartCategorize && !ctx.deferCategoryPick) {
      _categorizeClipForMagic(app, clip, contentType, ctx);
    }
    _applyAiFormatRefactorAndCleanup(app, clip, contentType, ctx);
  }
}

function _shouldSaveRefactorHistory(settings, ctx) {
  if (!_isRefactoringMode(settings)) return false;
  const hasNew = (ctx.refactorNewClips || []).length > 0;
  const hasDiag = ctx.refactorDiagnostics && ctx.refactorDiagnostics.size > 0;
  return hasNew || hasDiag;
}

function _promoteCraftedClipsToRecents(app, targetSet) {
  let ts = Date.now();
  for (const clip of app.clips) {
    if (!targetSet.has(String(clip.id))) continue;
    clip.timestamp = ts;
    clip.updatedAt = ts;
    ts -= 1;
  }
  app.clips.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  app.currentPage = 0;
}

function _recordRefactorPipeline(ctx, refactorPipeline) {
  if (!refactorPipeline) return;
  refactorPipeline.siblingsCreated = (ctx.refactorNewClips || []).length;
  ctx.stats.refactorPipeline = refactorPipeline;
  console.warn('[PasteCraft:refactor]', {
    ...refactorPipeline,
    statsAiRefactored: ctx.stats.aiRefactored,
  });
}

function _handleMagicDuplicates(app, settings, targetSet, stats) {
  if (settings.duplicateHandling) {
    _archiveYoungerDuplicates(app, targetSet, stats);
  } else {
    _detectMagicDuplicates(app, targetSet, stats);
  }
}

function _stampMagicStats(stats, settings) {
  stats.craftAiMode = settings.aiMode;
  stats.refactorLevel = settings.refactorLevel;
  stats.duplicateHandling = settings.duplicateHandling;
}

async function _maybeAttachCategorySuggestions(app, input) {
  const { stats, deferCategoryPick, uncategorizedTargets, hasAi } = input;
  if (!deferCategoryPick) return;
  stats.needsCategoryPick = true;
  stats.pendingCategoryClipIds = uncategorizedTargets.map((c) => String(c.id));
  stats.categorySuggestions = await _fetchCategorySuggestions(app, uncategorizedTargets, hasAi);
}

async function _finalizeMagicCraft(input) {
  const {
    app, ctx, targetSet, categoryQueue, refactorPipeline,
    settings, uncategorizedTargets, hasAi, deferCategoryPick,
  } = input;
  const { stats } = ctx;

  _processMagicTargetClips(app, ctx);
  await _insertRefactoredSiblingClips(app, ctx, targetSet);
  _recordRefactorPipeline(ctx, refactorPipeline);
  _handleMagicDuplicates(app, settings, targetSet, stats);

  await _createMissingMagicCategories(app, categoryQueue);
  _assignPendingMagicCategories(app, stats);
  _promoteCraftedClipsToRecents(app, targetSet);

  await _saveMagicState(app, {
    uiUpdater: () => _refreshMagicCreditsAndUi(app, stats),
    syncToCloud: true,
  });

  if (_shouldSaveRefactorHistory(settings, ctx)) {
    await _saveCraftRefactorHistory(app, ctx);
  }
  if (!_isRefactoringMode(settings) && (ctx.formatComparisons || []).length > 0) {
    stats.formatComparisons = ctx.formatComparisons;
    await _saveCraftFormatHistory(app, ctx);
  }
  if (_isRefactoringMode(settings)) {
    await ensureRefactorRegistryReady(app);
  }

  _stampMagicStats(stats, settings);
  await _maybeAttachCategorySuggestions(app, {
    stats, deferCategoryPick, uncategorizedTargets, hasAi,
  });
  return stats;
}

export async function _craftMagic(clipIds) {
  const app = this;
  app._craftClipsSettings = app._craftClipsSettings || await loadCraftClipsSettings();
  const settings = _getCraftClipsSettings(app);
  const targetSet = new Set(clipIds.map(String));
  const stats = _initMagicStats();
  const categoryQueue = new Map();

  const clipTypeMap = _buildClipTypeMap(app, targetSet);
  const uncategorizedTargets = settings.smartCategorize
    ? _collectUncategorizedTargets(app, targetSet)
    : [];
  const skipTypes = app._skipAiFormatTypes();
  let aiEligibleTargets = _collectAiEligibleTargets(app, targetSet, clipTypeMap, skipTypes);
  if (_isRefactoringMode(settings)) {
    aiEligibleTargets = _normalizeRefactorEligibleTargets(app, aiEligibleTargets);
  }
  const hasAi = app._hasAiAccess();
  const deferCategoryPick = _shouldDeferCategoryPick(settings, hasAi, uncategorizedTargets);

  const aiPhase = await _runMagicAiPhase({
    app, settings, aiEligibleTargets, uncategorizedTargets, hasAi, deferCategoryPick, stats,
  });

  const ctx = {
    targetSet,
    clipTypeMap,
    aiCategoryMap: aiPhase.aiCategoryMap,
    aiFormatMap: aiPhase.aiFormatMap,
    aiRefactorMap: aiPhase.aiRefactorMap,
    refactorDiagnostics: aiPhase.refactorDiagnostics,
    refactorNewClips: [],
    formatComparisons: [],
    queue: categoryQueue,
    stats,
    settings,
    deferCategoryPick,
  };

  return _finalizeMagicCraft({
    app, ctx, targetSet, categoryQueue,
    refactorPipeline: aiPhase.refactorPipeline,
    settings, uncategorizedTargets, hasAi, deferCategoryPick,
  });
}

export async function _craftAllMagic() {
  const app = this;
  const allClipIds = app.clips.map((c) => String(c.id));
  const stats = await app._craftMagic(allClipIds);
  app.showToast('✨ All clips crafted!');
  return stats;
}

export async function _applyCraftCategoryPick(categoryName, clipIds) {
  return _applyCraftCategoryPickImpl.call(this, categoryName, clipIds, async (app) => {
    await _saveMagicState(app, {
      uiUpdater: () => _refreshMagicCreditsAndUi(app, { aiCategorized: true }),
      syncToCloud: true,
    });
  });
}

function _notifyRefactorOutcome(app, stats) {
  if (stats.aiRefactored > 0) {
    app.showToast?.(`✨ ${stats.aiRefactored} refactored clip(s) added to recents`);
    return;
  }

  const toast = _resolveRefactorSkipToast(
    stats.refactorPipeline?.skipped || [],
    stats.refactorError,
  );
  app.showToast?.(toast, 'error');
}

export async function _finishCraftFlow(stats) {
  const app = this;

  if (stats.craftAiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
    await ensureRefactorRegistryReady(app);
    _notifyRefactorOutcome(app, stats);
  }

  if (stats.needsCategoryPick && stats.categorySuggestions?.length) {
    const chosen = await openCraftCategoryPickModal(stats.categorySuggestions);
    if (chosen) {
      const count = await _applyCraftCategoryPick.call(app, chosen, stats.pendingCategoryClipIds);
      stats.categorized = count;
      stats.aiCategorized = true;
      stats.chosenCategory = chosen;
    }
  }

  app._showMagicResults(stats);
}

function _isRefactorEligibleClip(app, clip, skipTypes) {
  if (clip.meta?.craftRefactor) return false;
  const contentType = app._detectContentType(clip.text, clip.meta);
  const trimmedLen = (clip.text || '').trim().length;
  return trimmedLen > 5 && !skipTypes.has(contentType);
}

/** Clips eligible for standalone AI Refactorization (AI Lab panel). */
export function getRefactorEligibleClips() {
  const app = this;
  if (!app._hasAiAccess()) return [];
  const skipTypes = app._skipAiFormatTypes();
  return app.clips
    .filter((clip) => _isRefactorEligibleClip(app, clip, skipTypes))
    .sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
}

/** Refactor selected clips only — no categorize, dedupe, or format. */
export async function runRefactorizationOnly(clipIds, refactorLevel) {
  const app = this;
  const prev = app._craftClipsSettings;
  app._craftClipsSettings = {
    smartCategorize: false,
    duplicateHandling: false,
    aiMode: CRAFT_CLIPS_AI_MODES.REFACTORING,
    refactorLevel: refactorLevel || 'college',
  };
  try {
    return await _craftMagic.call(app, clipIds);
  } finally {
    app._craftClipsSettings = prev;
  }
}
