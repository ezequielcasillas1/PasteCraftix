// @forward-slice AI Lab magic — facade (Craft Clips)
import {
  loadCraftClipsSettings,
  saveCraftClipsSettings,
  syncCraftClipsSettingsToUi,
} from './ai-lab.craft-clips.settings.js';
import { CRAFT_CLIPS_AI_MODES } from './ai-lab.craft-clips.constants.js';
import {
  _animateMagicWand,
  _toggleMagicAiCreditNotice,
  _renderMagicPage,
  _renderMagicPagination,
  _updateMagicSelectedCount,
  _escHtml,
} from './ai-lab.magic.render.js';
import {
  _magicTypeLabels,
  _skipAiFormatTypes,
  _suggestCategory,
  _detectContentType,
} from './ai-lab.magic.detect.js';
import { _enhanceContent } from './ai-lab.magic.enhance.js';
import { _analyzeMagicClips } from './ai-lab.magic.analyze.js';
import {
  _craftMagic,
  _craftAllMagic,
  _applyCraftCategoryPick,
  _finishCraftFlow,
  _showMagicResults,
  getRefactorEligibleClips,
  runRefactorizationOnly,
} from './ai-lab.magic.craft.js';
import {
  hydrateRefactorResolverIndex,
  ensureRefactorRegistryReady,
} from './ai-lab.magic.refactor.js';

export {
  _magicTypeLabels,
  _skipAiFormatTypes,
  _suggestCategory,
  _detectContentType,
  _enhanceContent,
  _analyzeMagicClips,
  _renderMagicPage,
  _renderMagicPagination,
  _updateMagicSelectedCount,
  _escHtml,
  _craftMagic,
  _craftAllMagic,
  _applyCraftCategoryPick,
  _finishCraftFlow,
  _showMagicResults,
  getRefactorEligibleClips,
  runRefactorizationOnly,
  hydrateRefactorResolverIndex,
  ensureRefactorRegistryReady,
};

export async function magicFormat() {
  const app = this;
  _animateMagicWand();

  app._craftClipsSettings = await loadCraftClipsSettings();
  syncCraftClipsSettingsToUi(app._craftClipsSettings);

  app._magicAnalysis = app._analyzeMagicClips();
  app._magicSelected = new Set();
  app._magicPage = 0;

  _toggleMagicAiCreditNotice(app);

  app._renderMagicPage(0);
  app._renderMagicPagination();
  app._updateMagicSelectedCount();

  const modal = document.getElementById('magicPreviewModal');
  if (modal) {
    modal.style.display = 'flex';
    window.renderLucideIcons?.(modal);
  }
}

/** Open Craft Clips with AI Refactoring mode pre-selected. */
export async function openCraftClipsForRefactor() {
  const app = this;
  const settings = await loadCraftClipsSettings();
  const next = {
    ...settings,
    aiMode: CRAFT_CLIPS_AI_MODES.REFACTORING,
  };
  app._craftClipsSettings = await saveCraftClipsSettings(next);
  return magicFormat.call(app);
}
