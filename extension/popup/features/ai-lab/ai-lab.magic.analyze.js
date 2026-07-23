// @forward-slice AI Lab magic — craft preview analysis
import {
  CRAFT_CLIPS_AI_MODES,
  CRAFT_CLIP_ACTIONS,
} from './ai-lab.craft-clips.constants.js';

export function _analyzeMagicClips() {
  const app = this;
  const dupMap = _buildDuplicateTextMap(app.clips);
  return app.clips.map(clip => _analyzeOneMagicClip(app, clip, dupMap));
}

function _buildDuplicateTextMap(clips) {
  const dupMap = new Map();
  for (const clip of clips) {
    const key = (clip.text || '').trim().toLowerCase();
    if (!key) continue;
    dupMap.set(key, (dupMap.get(key) || 0) + 1);
  }
  return dupMap;
}

function _analyzeOneMagicClip(app, clip, dupMap) {
  const contentType = app._detectContentType(clip.text, clip.meta);
  const actions = _buildCraftClipActions(app, clip, contentType, dupMap);
  return { clip, contentType, actions };
}

export function _getCraftClipsSettings(app) {
  return app._craftClipsSettings || { smartCategorize: true, duplicateHandling: false, aiMode: CRAFT_CLIPS_AI_MODES.FORMATTED, refactorLevel: 'college' };
}

function _buildCraftClipActions(app, clip, contentType, dupMap) {
  const settings = _getCraftClipsSettings(app);
  const actions = [];
  const skipTypes = app._skipAiFormatTypes();
  const trimmedLen = (clip.text || '').trim().length;
  const hasAi = app._hasAiAccess();

  if (settings.smartCategorize && (!clip.category || clip.category === 'Uncategorized')) {
    actions.push({
      kind: CRAFT_CLIP_ACTIONS.CATEGORIZE,
      label: hasAi ? 'Categorize (AI)' : 'Categorize',
      active: true,
    });
  }

  if (hasAi && trimmedLen > 5 && !skipTypes.has(contentType)) {
    if (settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING) {
      actions.push({
        kind: CRAFT_CLIP_ACTIONS.REFACTOR,
        label: `Refactor (${settings.refactorLevel})`,
        active: true,
      });
    } else {
      actions.push({ kind: CRAFT_CLIP_ACTIONS.FORMAT, label: 'AI Formatted', active: true });
    }
  }

  const enhanced = app._enhanceContent(clip.text, contentType);
  if (enhanced !== clip.text) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.CLEANUP, label: 'Cleanup', active: true });
  }

  const key = (clip.text || '').trim().toLowerCase();
  if (settings.duplicateHandling && _isDuplicateKey(key, dupMap)) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.DEDUPE, label: 'Archive duplicate', active: true });
  } else if (_isDuplicateKey(key, dupMap)) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.DEDUPE, label: 'Duplicate', active: false });
  }

  if (clip.meta?.craftRefactorSourceId) {
    actions.push({ kind: CRAFT_CLIP_ACTIONS.REFACTOR, label: 'Refactored copy', active: false });
  }

  if (actions.length === 0) {
    actions.push({ kind: 'clean', label: 'Already clean', active: false });
  }
  return actions;
}

export function _isDuplicateKey(key, dupMap) {
  if (!key) return false;
  return (dupMap.get(key) || 0) > 1;
}
