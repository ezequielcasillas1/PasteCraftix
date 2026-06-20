import { saveSettings, saveThemeOnly, saveWidgetIconUseProfileImage, getCurrentProfileImageForWidget } from './settings.storage.js';
import { showSettingsModal, hideSettingsModal, showHelpModal, hideHelpModal, openRestorePreviewModal, hideRestorePreviewModal } from './settings.render.js';
import {
  finishUxInteractionAfterPaint,
  startUxInteraction,
} from '../../shared/ux-perf-capture.js';

// ── Auto-save debounce ────────────────────────────────────────────────────────

function _createAutoSave(app) {
  let timeout = null;
  return (skipAuthPrefs = false) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => saveSettings(app, true, skipAuthPrefs).catch(() => {}), 300);
  };
}

// ── Modal open/close ──────────────────────────────────────────────────────────

function _wireModalToggle(app) {
  const settingsBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettingsModal');
  const modalOverlay = document.getElementById('settingsModal');

  settingsBtn?.addEventListener('click', () => {
    const perf = startUxInteraction('nav-modal', 'settings-open');
    Promise.resolve(showSettingsModal(app))
      .catch(() => {})
      .finally(() => {
        finishUxInteractionAfterPaint(perf, {
          location: 'settings.events:open',
        });
      });
  });
  closeBtn?.addEventListener('click', () => hideSettingsModal());
  modalOverlay?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') hideSettingsModal();
  });
}

// ── Help modal ────────────────────────────────────────────────────────────────

function _wireHelpModal() {
  document.getElementById('helpBtn')?.addEventListener('click', () => showHelpModal());
  document.getElementById('closeHelpModal')?.addEventListener('click', () => hideHelpModal());
  document.getElementById('backBtn')?.addEventListener('click', () => hideHelpModal());
  document.getElementById('backToSettingsFromHelp')?.addEventListener('click', () => hideHelpModal());
  document.getElementById('helpModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') hideHelpModal();
  });
}

// ── Standard settings inputs ──────────────────────────────────────────────────

function _wireStandardInputs(app, triggerAutoSave) {
  [
    'autoDeletePeriod',
    'darkModeToggle',
    'quickPasteAutoHidePopup',
    'quickPasteShowTimestampsPopup',
    'albumAttachmentOpenMode',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const event = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(event, () => triggerAutoSave(true));
    if (el.type === 'range' || el.type === 'number') el.addEventListener('input', () => triggerAutoSave(true));
  });

  const maxClipsEl = document.getElementById('quickPasteMaxClipsPopup');
  if (maxClipsEl) {
    maxClipsEl.addEventListener('input', () => triggerAutoSave(true));
    maxClipsEl.addEventListener('change', () => triggerAutoSave(true));
  }
}

// ── Theme toggles ─────────────────────────────────────────────────────────────

function _wireThemeToggles(app, triggerAutoSave) {
  const darkModeEl = document.getElementById('darkModeToggle');
  if (darkModeEl) darkModeEl.addEventListener('change', () => triggerAutoSave(true));

  const profileDarkModeEl = document.getElementById('profileDarkModeToggle');
  if (profileDarkModeEl) {
    profileDarkModeEl.addEventListener('change', async () => {
      if (app._themeSyncing) return;
      await saveThemeOnly(app, profileDarkModeEl.checked ? 'dark' : 'light', true);
    });
  }
}

// ── Widget icon toggle ────────────────────────────────────────────────────────

function _wireWidgetIconToggle(app) {
  const el = document.getElementById('widgetIconUseProfileToggle');
  if (!el) return;
  el.addEventListener('change', async () => {
    const enabled = !!el.checked;
    if (enabled) {
      const src = await getCurrentProfileImageForWidget(app);
      if (!src) {
        el.checked = false;
        app.showToast('⚠️ Set a profile image first (upload or AI)', 'error');
        return;
      }
    }
    await saveWidgetIconUseProfileImage(app, enabled, true);
  });
}

// ── Restore clips ─────────────────────────────────────────────────────────────

function _wireRestoreClips(app) {
  const restoreWindowSelect = document.getElementById('restoreWindowSelect');
  const previewBtn = document.getElementById('previewRestoreBtn');
  const restoreNowBtn = document.getElementById('restoreNowBtn');
  const syncRestoredBtn = document.getElementById('syncRestoredToCloudBtn');
  const closeRestoreBtn = document.getElementById('closeRestorePreviewModal');
  const closeRestoreFooterBtn = document.getElementById('restorePreviewCloseBtn');
  const restoreModal = document.getElementById('restorePreviewModal');

  restoreWindowSelect?.addEventListener('change', async () => {
    try { await app.previewRestore(restoreWindowSelect.value); } catch (_) {}
  });

  previewBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await openRestorePreviewModal(app, restoreWindowSelect?.value || '1week');
    } catch (error) {
      console.error('[Settings] restore preview failed:', error);
      app.showToast?.('❌ Restore preview failed', 'error');
    }
  });

  closeRestoreBtn?.addEventListener('click', () => hideRestorePreviewModal());
  closeRestoreFooterBtn?.addEventListener('click', () => hideRestorePreviewModal());
  restoreModal?.addEventListener('click', (e) => {
    if (e.target.id === 'restorePreviewModal') hideRestorePreviewModal();
  });

  restoreNowBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await app.previewRestore(restoreWindowSelect?.value || '1week'); } catch (_) {}
    await app.applyRestoreFromPreview();
  });

  syncRestoredBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await app.syncRestoredDataToCloud();
  });
}

// ── Export / Import ───────────────────────────────────────────────────────────

function _wireExportImport(app) {
  document.getElementById('exportBackupJsonBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await app.exportBackupToJson();
    } catch (error) {
      console.error('[Settings] export JSON failed:', error);
      app.showToast?.('❌ Export JSON failed', 'error');
    }
  });

  document.getElementById('exportClipsCsvBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await app.exportClipsToCsv();
    } catch (error) {
      console.error('[Settings] export CSV failed:', error);
      app.showToast?.('❌ Export CSV failed', 'error');
    }
  });

  const importBtn = document.getElementById('importBackupJsonBtn');
  const importFile = document.getElementById('importBackupJsonFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', (e) => {
      e.preventDefault();
      importFile.value = '';
      importFile.click();
    });
    importFile.addEventListener('change', async () => {
      const file = importFile.files?.[0] ?? null;
      if (!file) return;
      try {
        await app.importBackupFromJsonMerge(file);
      } catch (error) {
        console.error('[Settings] import JSON failed:', error);
        app.showToast?.('❌ Import JSON failed', 'error');
      }
    });
  }
}

// ── Info modals (clip joiner, clip settings) ──────────────────────────────────

function _wireInfoModals() {
  const pairs = [
    ['clipJoinerInfo', 'clipJoinerModal', 'closeClipJoinerModal'],
    ['clipSettingsInfo', 'clipSettingsModal', 'closeClipSettingsModal'],
  ];

  pairs.forEach(([infoId, modalId, closeId]) => {
    document.getElementById(infoId)?.addEventListener('click', () => {
      document.getElementById(modalId)?.classList.add('active');
    });
    document.getElementById(closeId)?.addEventListener('click', () => {
      document.getElementById(modalId)?.classList.remove('active');
    });
    document.getElementById(modalId)?.addEventListener('click', (e) => {
      if (e.target.id === modalId) document.getElementById(modalId)?.classList.remove('active');
    });
  });
}

// ── Public init ───────────────────────────────────────────────────────────────

export function initSettingsEvents(app) {
  const triggerAutoSave = _createAutoSave(app);

  const wire = (name, fn) => {
    try { fn(); } catch (e) { console.error(`[Settings] ${name} failed:`, e); }
  };

  wire('modalToggle', () => _wireModalToggle(app));
  wire('helpModal', () => _wireHelpModal());
  wire('themeToggles', () => _wireThemeToggles(app, triggerAutoSave));
  wire('standardInputs', () => _wireStandardInputs(app, triggerAutoSave));
  wire('widgetIconToggle', () => _wireWidgetIconToggle(app));
  wire('restoreClips', () => _wireRestoreClips(app));
  wire('exportImport', () => _wireExportImport(app));
  wire('infoModals', () => _wireInfoModals());
}
