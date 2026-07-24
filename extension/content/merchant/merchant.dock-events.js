/**
 * Listing dock panel event binding (Phase 3A extract).
 * @forward-slice merchant
 */
import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { normalizeTagsInputString } from './merchant.tags.js';
import { normalizeMaterialsInputString } from './merchant.materials.js';
import { refreshTagQueueTags, updateMerchantPrefs } from './merchant.tag-queue.js';
import { syncTagLimitCustomRow } from './merchant.dock-layout.js';

function mergeNormalizedPaste(inputEl, normalized) {
  const start = inputEl.selectionStart ?? 0;
  const end = inputEl.selectionEnd ?? 0;
  const before = inputEl.value.slice(0, start).replace(/,\s*$/, '');
  const after = inputEl.value.slice(end).replace(/^\s*,\s*/, '');
  if (before && after) return `${before}, ${normalized}, ${after}`;
  if (before) return `${before}, ${normalized}`;
  if (after) return `${normalized}, ${after}`;
  return normalized;
}

function bindTagsInput(dock, tagsEl) {
  tagsEl?.addEventListener('input', () => {
    dock.renderTagPreview(tagsEl.value);
    refreshTagQueueTags().catch(() => {});
  });

  tagsEl?.addEventListener('paste', (event) => {
    const raw = event.clipboardData?.getData('text/plain');
    if (!raw?.trim()) return;
    event.preventDefault();
    const profile = dock.getActiveProfile();
    const normalized = normalizeTagsInputString(raw, profile);
    const next = mergeNormalizedPaste(tagsEl, normalized);
    tagsEl.value = next;
    dock.renderTagPreview(next);
    refreshTagQueueTags().catch(() => {});
  });
}

function bindMaterialsPaste(materialsEl) {
  materialsEl?.addEventListener('paste', (event) => {
    const raw = event.clipboardData?.getData('text/plain');
    if (!raw?.trim()) return;
    event.preventDefault();
    const normalized = normalizeMaterialsInputString(raw);
    materialsEl.value = mergeNormalizedPaste(materialsEl, normalized);
  });
}

function bindTagLimitControls(dock) {
  const presetRadios = dock.panelEl.querySelectorAll('[data-field="dock-tag-limit-preset"]');
  presetRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      syncTagLimitCustomRow(dock.panelEl);
      if (radio.value !== 'custom' && radio.checked) {
        dock.applyTagLimitSelection({ closePanel: true }).catch(() => {});
      }
    });
  });

  const customInput = dock.panelEl.querySelector('[data-field="dock-tag-limit-custom"]');
  customInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      dock.applyTagLimitSelection({ closePanel: true }).catch(() => {});
    }
  });
}

function bindAutoAdvance(dock) {
  const autoAdvanceEl = dock.panelEl.querySelector('[data-field="dock-queue-auto-advance"]');
  autoAdvanceEl?.addEventListener('change', () => {
    updateMerchantPrefs({ queueAutoAdvance: autoAdvanceEl.checked }).catch(() => {});
  });
}

const DOCK_ACTION_HANDLERS = {
  [MERCHANT_ACTIONS.DOCK_SAVE]: (dock) => { dock.handleSave().catch(() => {}); },
  [MERCHANT_ACTIONS.DOCK_CLIPBOARD]: (dock) => { dock.handleClipboard().catch(() => {}); },
  [MERCHANT_ACTIONS.DOCK_COPY_TAGS]: (dock) => { dock.handleCopyTags().catch(() => {}); },
  [MERCHANT_ACTIONS.DOCK_NEXT_TAG]: (dock) => { dock.handleNextTag().catch(() => {}); },
  [MERCHANT_ACTIONS.DOCK_COPY_MATERIALS]: (dock) => { dock.handleCopyMaterials().catch(() => {}); },
  [MERCHANT_ACTIONS.DOCK_CLEAR]: (dock) => { dock.handleClear().catch(() => {}); },
  [MERCHANT_ACTIONS.DOCK_CLOSE]: (dock) => { dock.close(); },
  [MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE]: (dock) => { dock.toggleTagOptions(); },
  [MERCHANT_ACTIONS.DOCK_TAG_LIMIT_CUSTOM_SELECT]: (dock) => { dock.selectCustomTagLimit(); },
  [MERCHANT_ACTIONS.DOCK_TAG_LIMIT_APPLY]: (dock) => {
    dock.applyTagLimitSelection({ closePanel: true }).catch(() => {});
  },
  [MERCHANT_ACTIONS.SEAL_SHIP]: (dock) => { dock.handleSealShip().catch(() => {}); },
};

function handleDockAction(dock, action) {
  DOCK_ACTION_HANDLERS[action]?.(dock);
}

function bindActionDelegation(dock) {
  dock.panelEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || !dock.panelEl.contains(btn)) return;
    event.preventDefault();
    handleDockAction(dock, btn.getAttribute('data-action'));
  });

  dock.panelEl.addEventListener('click', (event) => {
    if (!dock._tagOptionsOpen) return;
    const panel = dock.panelEl.querySelector('[data-field="dock-tag-options-panel"]');
    const toggleBtn = dock.panelEl.querySelector(`[data-action="${MERCHANT_ACTIONS.DOCK_TAG_OPTIONS_TOGGLE}"]`);
    const insidePanel = Boolean(panel?.contains(event.target));
    const insideToggle = Boolean(toggleBtn?.contains(event.target));
    if (!panel || insidePanel || insideToggle) return;
    dock.closeTagOptions();
  });
}

/** Bind once per panel; same guards as former MerchantListingDock.bindEvents. */
export function bindListingDockEvents(dock) {
  if (!dock.panelEl || dock.panelEl.dataset.pcMerchantDockBound === '1') return;
  dock.panelEl.dataset.pcMerchantDockBound = '1';

  const tagsEl = dock.panelEl.querySelector('[data-field="dock-tags"]');
  const materialsEl = dock.panelEl.querySelector('[data-field="dock-materials"]');

  bindTagsInput(dock, tagsEl);
  bindMaterialsPaste(materialsEl);
  bindTagLimitControls(dock);
  bindAutoAdvance(dock);
  bindActionDelegation(dock);
}
