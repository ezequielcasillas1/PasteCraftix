// @forward-slice AI Lab magic — craft AI refactor batch run
import { isOutOfCreditsError } from './ai-lab.credit-error.js';
import { isModelNotCapableError, MODEL_NOT_CAPABLE_MESSAGE } from './ai-lab.model-error.js';
import {
  _normalizeRefactorText,
  _textPreview,
  _formatRefactorSkipLog,
} from './ai-lab.magic.refactor.js';

function _emptyRefactorPipeline(eligible) {
  return {
    eligible,
    aiResultCount: 0,
    mapSize: 0,
    siblingsCreated: 0,
    skipped: [],
  };
}

function _resolveDiagForTarget(diagList, index) {
  return diagList[index] || diagList.find((d) => d?.index === index) || null;
}

function _isCreditBlockedError(err, msg) {
  return isOutOfCreditsError(err) || /need more ai credits/i.test(msg);
}

function _isNetworkishMessage(msg) {
  return msg.includes('fetch') || msg.includes('network');
}

function _failureSynthesis(msg, creditBlocked, modelBlocked) {
  if (creditBlocked) return 'Not enough AI text credits for this refactor batch.';
  if (modelBlocked) return MODEL_NOT_CAPABLE_MESSAGE;
  if (_isNetworkishMessage(msg)) {
    return 'Network error — check connection and Supabase reachability, then try again.';
  }
  return 'The refactor request failed before the model could rewrite this clip.';
}

function _skipOutcome(diag, returned, original) {
  if (diag?.outcome) return diag.outcome;
  if (returned && returned !== original) return 'unknown';
  return 'unchanged';
}

function _skipReason(diag, returned, original) {
  if (diag?.reasons?.[0]) return diag.reasons[0];
  if (returned === original) return 'identical_text';
  return 'not_in_map';
}

function _buildSkipEntry(ctx) {
  const { target, returned, diag, edgeLevel } = ctx;
  const original = (target.text || '').trim();
  return {
    clipId: String(target.id),
    outcome: _skipOutcome(diag, returned, original),
    reason: _skipReason(diag, returned, original),
    reasons: Array.isArray(diag?.reasons) ? diag.reasons : undefined,
    synthesis: diag?.synthesis || '',
    originalLen: original.length,
    refactoredLen: returned.length,
    originalPreview: _textPreview(original),
    refactoredPreview: _textPreview(returned),
    level: diag?.level || edgeLevel,
  };
}

function _recordSkippedTargets(ctx) {
  const { targets, aiResults, diagList, map, diagnostics, pipeline, edgeLevel } = ctx;
  targets.forEach((target, i) => {
    const clipId = String(target.id);
    const diag = _resolveDiagForTarget(diagList, i);
    if (diag) diagnostics.set(clipId, diag);
    if (map.has(clipId)) return;
    pipeline.skipped.push(_buildSkipEntry({
      target,
      returned: String(aiResults[i] || '').trim(),
      diag,
      edgeLevel,
    }));
  });
}

function _pushCreditSkip(pipeline, target) {
  pipeline.skipped.push({
    clipId: String(target.id),
    outcome: 'no_credits',
    reason: 'insufficient_text_credits',
  });
}

function _applyRefactorFailure(ctx) {
  const { targets, err, edgeLevel, stats, diagnostics, pipeline } = ctx;
  const modelBlocked = isModelNotCapableError(err);
  const msg = modelBlocked
    ? MODEL_NOT_CAPABLE_MESSAGE
    : String(err?.message || 'AI refactor request failed');
  stats.refactorError = msg;
  pipeline.error = msg;
  const creditBlocked = _isCreditBlockedError(err, msg);
  const synthesis = _failureSynthesis(msg, creditBlocked, modelBlocked);

  targets.forEach((target) => {
    diagnostics.set(String(target.id), {
      outcome: creditBlocked ? 'no_credits' : (modelBlocked ? 'model_not_capable' : 'failed'),
      reasons: [msg],
      synthesis,
      level: edgeLevel,
    });
    if (creditBlocked) _pushCreditSkip(pipeline, target);
  });

  console.warn('[PasteCraft:refactor]', {
    ...pipeline,
    reason: creditBlocked ? 'no_credits' : (modelBlocked ? 'model_not_capable' : 'request_failed'),
    skipSummaries: pipeline.skipped.map((s) => _formatRefactorSkipLog(s)).join(' | '),
  });
}

function _logRefactorPipeline(pipeline) {
  const skipSummaries = pipeline.skipped.map((s) => _formatRefactorSkipLog(s)).join(' | ');
  console.warn('[PasteCraft:refactor]', {
    ...pipeline,
    skipSummaries: skipSummaries || undefined,
    skipped: pipeline.skipped.length > 0 ? pipeline.skipped : undefined,
  });
}

export function _populateAiRefactorMap(map, targets, aiResults) {
  const len = Math.min(targets.length, aiResults.length);
  for (let i = 0; i < len; i++) {
    const refactored = String(aiResults[i] || '').trim();
    const original = (targets[i].text || '').trim();
    if (refactored && _normalizeRefactorText(refactored) !== _normalizeRefactorText(original)) {
      map.set(String(targets[i].id), refactored);
    }
  }
}

function _ingestRefactorSuccess(state, result, edgeLevel) {
  const { map, diagnostics, pipeline, targets } = state;
  const aiResults = Array.isArray(result?.refactored) ? result.refactored : [];
  const diagList = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
  pipeline.aiResultCount = aiResults.length;

  if (aiResults.length > 0) {
    _populateAiRefactorMap(map, targets, aiResults);
  }
  pipeline.mapSize = map.size;

  _recordSkippedTargets({
    targets, aiResults, diagList, map, diagnostics, pipeline, edgeLevel,
  });

  if (aiResults.length === 0) {
    pipeline.skipped.push({ outcome: 'empty_response', reason: 'edge_returned_no_refactored_array' });
  }
}

export async function _runAiRefactoring(targets, edgeLevel, stats) {
  const map = new Map();
  const diagnostics = new Map();
  const pipeline = _emptyRefactorPipeline(targets.length);
  const state = { map, diagnostics, pipeline, targets };

  if (targets.length === 0) {
    console.warn('[PasteCraft:refactor]', { ...pipeline, reason: 'no_eligible_targets' });
    return state;
  }

  try {
    const result = await pasteCraftSupabase.aiRefactor(targets, edgeLevel);
    _ingestRefactorSuccess(state, result, edgeLevel);
  } catch (err) {
    _applyRefactorFailure({ targets, err, edgeLevel, stats, diagnostics, pipeline });
    return state;
  }

  _logRefactorPipeline(pipeline);
  return state;
}
