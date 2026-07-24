/** @forward-slice Freemium / local durability banner + actions. */

import { DATA_SAFETY_ELEMENT_IDS } from './data-safety.constants.js';
import { AUTH_STORAGE_KEYS } from '../auth/auth.constants.js';

function _els() {
  return {
    banner: document.getElementById(DATA_SAFETY_ELEMENT_IDS.BANNER),
    text: document.getElementById(DATA_SAFETY_ELEMENT_IDS.BANNER_TEXT),
    exportBtn: document.getElementById(DATA_SAFETY_ELEMENT_IDS.EXPORT_BTN),
    accountBtn: document.getElementById(DATA_SAFETY_ELEMENT_IDS.ACCOUNT_BTN),
    dismissBtn: document.getElementById(DATA_SAFETY_ELEMENT_IDS.DISMISS_BTN),
  };
}

export function hideDataSafetyBanner() {
  const { banner } = _els();
  if (banner) banner.style.display = 'none';
}

/**
 * @param {'guest'|'unhealthy'|'recovered'|'lost'} mode
 * @param {string} [detail]
 */
export function showDataSafetyBanner(mode, detail = '') {
  const { banner, text } = _els();
  if (!banner || !text) return;

  const copy = {
    guest: 'Local freemium mode: clips stay on this device. Edge reset or storage failure can erase them — export a backup or create a free account.',
    unhealthy: 'Storage may not be saving. Export a backup now. Restart Edge and check clips still appear.',
    recovered: `Recovered local data from a backup source${detail ? ` (${detail})` : ''}. Export a JSON backup to keep a copy outside the browser.`,
    lost: 'Local data looks empty, but PasteCraft previously saw clips here. Import a JSON backup or create an account if you use cloud sync.',
  };

  text.textContent = copy[mode] || copy.guest;
  banner.dataset.mode = mode;
  banner.style.display = 'flex';
}

export function wireDataSafetyBanner(app) {
  const { exportBtn, accountBtn, dismissBtn, banner } = _els();
  if (!banner || banner.dataset.wired === '1') return;
  banner.dataset.wired = '1';

  exportBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (typeof app.exportBackupToJson === 'function') {
        await app.exportBackupToJson();
      } else if (app.settingsFeature?.backup?.exportBackupToJson) {
        await app.settingsFeature.backup.exportBackupToJson();
      } else {
        app.showToast?.('Open Settings → Export backup JSON', 'info');
      }
    } catch (_) {
      app.showToast?.('Export failed — try Settings → Export', 'error');
    }
  });

  accountBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    app._isFreemiumGuest = false;
    try {
      await chrome.storage.local.remove([AUTH_STORAGE_KEYS.FREEMIUM_GUEST, 'pc_freemium_guest']);
    } catch (_) {}
    hideDataSafetyBanner();
    app.showAuthModal?.();
    const signupTab = document.querySelector('[data-auth-tab="signup"]');
    if (signupTab) signupTab.click();
  });

  dismissBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideDataSafetyBanner();
  });
}
