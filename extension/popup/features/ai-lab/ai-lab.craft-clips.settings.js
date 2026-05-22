import {
  CRAFT_CLIPS_STORAGE_KEY,
  CRAFT_CLIPS_DEFAULT_SETTINGS,
  CRAFT_CLIPS_AI_MODES,
  REFACTOR_LEVEL_TO_EDGE,
  REFACTOR_LEVEL_INFO,
} from './ai-lab.craft-clips.constants.js';

export async function loadCraftClipsSettings() {
  try {
    const stored = await chrome.storage.local.get([CRAFT_CLIPS_STORAGE_KEY]);
    const raw = stored[CRAFT_CLIPS_STORAGE_KEY];
    if (!raw || typeof raw !== 'object') {
      return { ...CRAFT_CLIPS_DEFAULT_SETTINGS };
    }
    return {
      ...CRAFT_CLIPS_DEFAULT_SETTINGS,
      smartCategorize: raw.smartCategorize !== false,
      duplicateHandling: !!raw.duplicateHandling,
      aiMode: raw.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
        ? CRAFT_CLIPS_AI_MODES.REFACTORING
        : CRAFT_CLIPS_AI_MODES.FORMATTED,
      refactorLevel: REFACTOR_LEVEL_TO_EDGE[raw.refactorLevel]
        ? raw.refactorLevel
        : CRAFT_CLIPS_DEFAULT_SETTINGS.refactorLevel,
    };
  } catch (_) {
    return { ...CRAFT_CLIPS_DEFAULT_SETTINGS };
  }
}

export async function saveCraftClipsSettings(settings) {
  const payload = {
    smartCategorize: settings.smartCategorize !== false,
    duplicateHandling: !!settings.duplicateHandling,
    aiMode: settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING
      ? CRAFT_CLIPS_AI_MODES.REFACTORING
      : CRAFT_CLIPS_AI_MODES.FORMATTED,
    refactorLevel: String(settings.refactorLevel || CRAFT_CLIPS_DEFAULT_SETTINGS.refactorLevel),
  };
  await chrome.storage.local.set({ [CRAFT_CLIPS_STORAGE_KEY]: payload });
  return payload;
}

export function resolveRefactorEdgeLevel(uiLevel) {
  return REFACTOR_LEVEL_TO_EDGE[uiLevel] || 'college';
}

export function syncCraftClipsSettingsToUi(settings) {
  const catToggle = document.getElementById('craftClipsCategorizeToggle');
  const dedupeToggle = document.getElementById('craftClipsDedupeToggle');
  const fmtRadio = document.getElementById('craftClipsAiFormatted');
  const refRadio = document.getElementById('craftClipsAiRefactoring');
  const levelsWrap = document.getElementById('craftClipsRefactorLevels');

  if (catToggle) catToggle.checked = settings.smartCategorize !== false;
  if (dedupeToggle) dedupeToggle.checked = !!settings.duplicateHandling;
  if (fmtRadio) fmtRadio.checked = settings.aiMode !== CRAFT_CLIPS_AI_MODES.REFACTORING;
  if (refRadio) refRadio.checked = settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING;
  if (levelsWrap) {
    levelsWrap.style.display = settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING ? 'flex' : 'none';
    levelsWrap.querySelectorAll('.craft-refactor-level-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.level === settings.refactorLevel);
    });
  }
}

export function bindCraftClipsSettingsUi(app) {
  const persist = async () => {
    const next = readCraftClipsSettingsFromUi();
    app._craftClipsSettings = await saveCraftClipsSettings(next);
    syncCraftClipsSettingsToUi(app._craftClipsSettings);
    _toggleMagicAiCreditNoticeForApp(app);
    if (app._magicAnalysis) {
      app._magicAnalysis = app._analyzeMagicClips();
      app._renderMagicPage(app._magicPage || 0);
    }
  };

  document.getElementById('craftClipsCategorizeToggle')?.addEventListener('change', persist);
  document.getElementById('craftClipsDedupeToggle')?.addEventListener('change', persist);
  document.getElementById('craftClipsAiFormatted')?.addEventListener('change', persist);
  document.getElementById('craftClipsAiRefactoring')?.addEventListener('change', persist);

  document.querySelectorAll('.craft-refactor-level-chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('.craft-refactor-level-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      await persist();
    });
  });

  document.querySelectorAll('.craft-refactor-level-info').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const level = btn.dataset.level;
      const text = REFACTOR_LEVEL_INFO[level] || '';
      const el = document.getElementById('craftClipsLevelInfoText');
      if (el) el.textContent = text;
      const panel = document.getElementById('craftClipsLevelInfoPanel');
      if (panel) panel.style.display = text ? 'block' : 'none';
    });
  });
}

function _toggleMagicAiCreditNoticeForApp(app) {
  const notice = document.getElementById('magicAiCreditNotice');
  if (!notice || !app._hasAiAccess()) return;
  const settings = app._craftClipsSettings || CRAFT_CLIPS_DEFAULT_SETTINGS;
  const modeLabel = settings.aiMode === CRAFT_CLIPS_AI_MODES.REFACTORING ? 'AI Refactoring' : 'AI Formatted';
  notice.textContent = `💎 Premium · ~25 credits per batch · ${modeLabel} (one AI mode per craft)`;
}

export function readCraftClipsSettingsFromUi() {
  const catToggle = document.getElementById('craftClipsCategorizeToggle');
  const dedupeToggle = document.getElementById('craftClipsDedupeToggle');
  const refRadio = document.getElementById('craftClipsAiRefactoring');
  const activeChip = document.querySelector('.craft-refactor-level-chip.active');
  return {
    smartCategorize: catToggle ? catToggle.checked : true,
    duplicateHandling: dedupeToggle ? dedupeToggle.checked : false,
    aiMode: refRadio?.checked ? CRAFT_CLIPS_AI_MODES.REFACTORING : CRAFT_CLIPS_AI_MODES.FORMATTED,
    refactorLevel: activeChip?.dataset?.level || CRAFT_CLIPS_DEFAULT_SETTINGS.refactorLevel,
  };
}
