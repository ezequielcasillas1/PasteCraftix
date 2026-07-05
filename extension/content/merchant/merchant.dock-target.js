import {
  MERCHANT_ACTIONS,
  MERCHANT_DEFAULT_PREFS,
  MERCHANT_DOCK_TARGET_IDS,
  MERCHANT_DOCK_TARGETS,
  MERCHANT_STORAGE_KEYS,
} from './merchant.constants.js';

let _target = MERCHANT_DEFAULT_PREFS.captureDockTarget;

function isValidDockTarget(id) {
  return MERCHANT_DOCK_TARGET_IDS.includes(id);
}

export function getDockTargetLabel(id = _target) {
  const match = MERCHANT_DOCK_TARGETS.find((entry) => entry.id === id);
  return match?.label || 'Tags';
}

export function getCaptureDockTarget() {
  return _target;
}

export async function readCaptureDockTarget() {
  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.PREFS]);
    const raw = stored[MERCHANT_STORAGE_KEYS.PREFS];
    const fromPrefs = raw?.captureDockTarget;
    if (isValidDockTarget(fromPrefs)) {
      _target = fromPrefs;
      return _target;
    }
  } catch (err) {
    console.error('[merchant.dock-target:readCaptureDockTarget]', err);
  }
  _target = MERCHANT_DEFAULT_PREFS.captureDockTarget;
  return _target;
}

export async function saveCaptureDockTarget(targetId) {
  if (!isValidDockTarget(targetId)) {
    return { ok: false, error: 'Invalid dock target.' };
  }

  try {
    const stored = await chrome.storage.local.get([MERCHANT_STORAGE_KEYS.PREFS]);
    const current = stored[MERCHANT_STORAGE_KEYS.PREFS];
    const merged = {
      ...MERCHANT_DEFAULT_PREFS,
      ...(current && typeof current === 'object' ? current : {}),
      captureDockTarget: targetId,
    };
    await chrome.storage.local.set({ [MERCHANT_STORAGE_KEYS.PREFS]: merged });
    _target = targetId;
    return { ok: true, target: targetId };
  } catch (err) {
    console.error('[merchant.dock-target:saveCaptureDockTarget]', err);
    return { ok: false, error: 'Failed to save dock target.' };
  }
}

export function buildDockTargetOptionsMarkup(activeTarget = _target) {
  return MERCHANT_DOCK_TARGETS.map((entry) => `
    <button
      type="button"
      class="pc-merchant-dock-target-btn"
      data-action="${MERCHANT_ACTIONS.DOCK_TARGET_SELECT}"
      data-dock-target="${entry.id}"
      aria-pressed="${entry.id === activeTarget ? 'true' : 'false'}"
      title="Stage Spot / Image → Text into ${entry.label}"
    >${entry.label}</button>
  `).join('');
}

export function buildDockTargetRowMarkup(activeTarget = _target) {
  return `
    <div class="pc-merchant-dock-target-row" data-field="pc-merchant-dock-target-row">
      <span class="pc-merchant-dock-target-label">Spot &amp; Image → Text dock to:</span>
      <div
        class="pc-merchant-dock-target-options"
        data-field="pc-merchant-dock-target-options"
        role="radiogroup"
        aria-label="Spot and Image to Text dock destination"
      >
        ${buildDockTargetOptionsMarkup(activeTarget)}
      </div>
    </div>
  `;
}

export function syncDockTargetStripUi(stripEl, targetId = _target) {
  if (!stripEl) return;
  const safeTarget = isValidDockTarget(targetId) ? targetId : MERCHANT_DEFAULT_PREFS.captureDockTarget;
  stripEl.querySelectorAll(`[data-action="${MERCHANT_ACTIONS.DOCK_TARGET_SELECT}"]`).forEach((btn) => {
    const isActive = btn.getAttribute('data-dock-target') === safeTarget;
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

export async function initMerchantDockTarget({ stripEl } = {}) {
  await readCaptureDockTarget();
  if (stripEl) syncDockTargetStripUi(stripEl, _target);
  return {
    getTarget: getCaptureDockTarget,
    readTarget: readCaptureDockTarget,
    saveTarget: saveCaptureDockTarget,
    syncUi: () => syncDockTargetStripUi(stripEl),
  };
}
