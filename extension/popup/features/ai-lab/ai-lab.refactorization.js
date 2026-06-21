import {
  REFACTOR_LEVEL_INFO,
  CRAFT_CLIPS_AI_MODES,
} from './ai-lab.craft-clips.constants.js';
import {
  loadCraftClipsSettings,
  saveCraftClipsSettings,
} from './ai-lab.craft-clips.settings.js';

const PREVIEW_MAX = 100;

function _previewText(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length <= PREVIEW_MAX ? flat : `${flat.slice(0, PREVIEW_MAX)}…`;
}

function _getSelectedLevel() {
  const active = document.querySelector('#refactorizationLevelChips .rf-level-chip.active');
  return active?.dataset?.level || 'college';
}

function _setSelectedLevel(level) {
  document.querySelectorAll('#refactorizationLevelChips .rf-level-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.level === level);
  });
}

export function activateRefactorizationSection(app) {
  document.querySelectorAll('.ai-lab-tab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.ai-lab-section').forEach((section) => section.classList.remove('active'));
  document.getElementById('aiRefactorizationSection')?.classList.add('active');
  app._currentAiLabSubTab = 'refactorization';
  app._refactorizationSelected = new Set();
  app._saveActiveTabState();
  renderRefactorizationPanel.call(app);
}

export function maybeRefreshRefactorizationPanel(app) {
  const section = document.getElementById('aiRefactorizationSection');
  if (!section?.classList.contains('active')) return;
  renderRefactorizationPanel.call(app);
}

export function renderRefactorizationPanel() {
  const app = this;
  const listEl = document.getElementById('refactorizationClipList');
  const countEl = document.getElementById('refactorizationEligibleCount');
  const runBtn = document.getElementById('refactorizationRunBtn');
  const premiumNote = document.getElementById('refactorizationPremiumNote');
  if (!listEl) return;

  const hasAi = app._hasAiAccess();
  if (premiumNote) {
    premiumNote.style.display = hasAi ? 'none' : 'block';
  }

  if (!hasAi) {
    if (countEl) countEl.textContent = 'Premium required';
    listEl.innerHTML = '<div class="rf-empty">Upgrade to refactor clips with AI.</div>';
    if (runBtn) runBtn.disabled = true;
    return;
  }

  const eligible = app.aiLabFeature.magic.getRefactorEligibleClips.call(app);
  if (countEl) {
    countEl.textContent = eligible.length === 1
      ? '1 clip ready'
      : `${eligible.length} clips ready`;
  }

  if (eligible.length === 0) {
    listEl.innerHTML = '<div class="rf-empty">No clips ready — add text clips (not URLs/code) with more than a few characters.</div>';
    if (runBtn) runBtn.disabled = true;
    app._refactorizationSelected = new Set();
    _updateRefactorizationRunBtn();
    return;
  }

  if (!app._refactorizationSelected) {
    app._refactorizationSelected = new Set();
  } else {
    const validIds = new Set(eligible.map((c) => String(c.id)));
    for (const id of [...app._refactorizationSelected]) {
      if (!validIds.has(id)) app._refactorizationSelected.delete(id);
    }
  }

  const labels = app._magicTypeLabels();
  listEl.innerHTML = eligible.map((clip) => {
    const id = String(clip.id);
    const checked = app._refactorizationSelected.has(id);
    const contentType = app._detectContentType(clip.text, clip.meta);
    const typeBadge = app._escHtml(labels[contentType] || contentType);
    return `
      <label class="rf-clip-row" data-clip-id="${id}">
        <input type="checkbox" class="rf-clip-check" data-clip-id="${id}" ${checked ? 'checked' : ''}>
        <div class="rf-clip-body">
          <div class="rf-clip-text">${app._escHtml(_previewText(clip.text))}</div>
          <span class="rf-clip-type">${typeBadge}</span>
        </div>
      </label>`;
  }).join('');

  _attachRefactorizationListHandlers(app, listEl);
  _updateRefactorizationRunBtn();
}

function _attachRefactorizationListHandlers(app, listEl) {
  listEl.querySelectorAll('.rf-clip-check').forEach((input) => {
    input.addEventListener('change', () => {
      const id = String(input.dataset.clipId || '');
      if (!id) return;
      if (input.checked) app._refactorizationSelected.add(id);
      else app._refactorizationSelected.delete(id);
      _updateRefactorizationRunBtn();
    });
  });
}

function _updateRefactorizationRunBtn() {
  const runBtn = document.getElementById('refactorizationRunBtn');
  const selected = document.querySelectorAll('.rf-clip-check:checked').length;
  if (runBtn) {
    runBtn.disabled = selected === 0;
    runBtn.textContent = selected === 1
      ? 'Refactorization (1 clip)'
      : `Refactorization (${selected} clips)`;
  }
}

export function selectAllRefactorizationClips(app) {
  const eligible = app.aiLabFeature.magic.getRefactorEligibleClips.call(app);
  app._refactorizationSelected = new Set(eligible.map((c) => String(c.id)));
  document.querySelectorAll('.rf-clip-check').forEach((input) => {
    input.checked = true;
  });
  _updateRefactorizationRunBtn();
}

export async function runRefactorizationFromPanel() {
  const app = this;
  if (!app._hasAiAccess()) {
    app.showToast('Premium required for AI Refactorization', 'error');
    return;
  }

  if (!app._hasTextCreditsForRefactor()) {
    app.showToast('Need more AI credits — buy a pack or wait for your monthly reset', 'error');
    return;
  }

  const selected = [...(app._refactorizationSelected || [])];
  if (selected.length === 0) {
    app.showToast('Select at least one clip', 'error');
    return;
  }

  const level = _getSelectedLevel();
  const runBtn = document.getElementById('refactorizationRunBtn');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = 'Refactoring…';
  }

  try {
    const stats = await app.aiLabFeature.magic.runRefactorizationOnly.call(app, selected, level);
    await app._finishCraftFlow(stats);
    app._refactorizationSelected = new Set();
    renderRefactorizationPanel.call(app);
  } catch (err) {
    console.error('[runRefactorizationFromPanel]', err);
    app.showToast(err?.message || 'Refactorization failed', 'error');
  } finally {
    if (runBtn) runBtn.disabled = false;
    _updateRefactorizationRunBtn();
  }
}

export async function openCraftClipsFromRefactorization() {
  const app = this;
  const level = _getSelectedLevel();
  const settings = await loadCraftClipsSettings();
  const next = {
    ...settings,
    aiMode: CRAFT_CLIPS_AI_MODES.REFACTORING,
    refactorLevel: level,
  };
  await saveCraftClipsSettings(next);
  return app.aiLabFeature.magic.openCraftClipsForRefactor.call(app);
}

export function bindRefactorizationPanelUi(app) {
  const section = document.getElementById('aiRefactorizationSection');
  if (!section || section.dataset.bound) return;
  section.dataset.bound = '1';

  const chipsWrap = document.getElementById('refactorizationLevelChips');
  if (chipsWrap) {
    loadCraftClipsSettings().then((settings) => {
      _setSelectedLevel(settings.refactorLevel || 'college');
    });

    chipsWrap.querySelectorAll('.rf-level-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        _setSelectedLevel(chip.dataset.level);
        const infoPanel = document.getElementById('refactorizationLevelInfoPanel');
        const infoText = document.getElementById('refactorizationLevelInfoText');
        if (infoPanel && infoText) {
          infoText.textContent = REFACTOR_LEVEL_INFO[chip.dataset.level] || '';
          infoPanel.style.display = 'block';
        }
      });
    });

    chipsWrap.querySelectorAll('.rf-level-info').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const level = btn.dataset.level;
        const infoPanel = document.getElementById('refactorizationLevelInfoPanel');
        const infoText = document.getElementById('refactorizationLevelInfoText');
        if (infoPanel && infoText) {
          infoText.textContent = REFACTOR_LEVEL_INFO[level] || '';
          infoPanel.style.display = infoPanel.style.display === 'none' ? 'block' : 'none';
        }
      });
    });
  }

  document.getElementById('refactorizationSelectAll')?.addEventListener('click', () => {
    selectAllRefactorizationClips(app);
  });
  document.getElementById('refactorizationRunBtn')?.addEventListener('click', () => {
    runRefactorizationFromPanel.call(app);
  });
  document.getElementById('refactorizationCraftClipsBtn')?.addEventListener('click', () => {
    openCraftClipsFromRefactorization.call(app);
  });
}
