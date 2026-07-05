import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { activateSpot, deactivateSpot, getSpotStatusLabel } from './merchant.spot.js';
import { activateImageToText, disarmImageToText, isImageToTextArmed } from './merchant.image-to-text.js';
import { cachePageSelection, initSelectionCache } from './merchant.selection-cache.js';
import { saveCaptureDockTarget, syncDockTargetStripUi } from './merchant.dock-target.js';
import {
  toggleTagQueue,
  deactivateTagQueueOnUnmount,
  syncTagQueueStripUi,
} from './merchant.tag-queue.js';
import {
  toggleMaterialQueue,
  deactivateMaterialQueueOnUnmount,
  syncMaterialQueueStripUi,
} from './merchant.material-queue.js';
import {
  toggleTitleQueue,
  deactivateTitleQueueOnUnmount,
  syncTitleQueueStripUi,
} from './merchant.title-queue.js';
import {
  toggleDescriptionQueue,
  deactivateDescriptionQueueOnUnmount,
  syncDescriptionQueueStripUi,
} from './merchant.description-queue.js';
import {
  toggleKeywordQueue,
  deactivateKeywordQueueOnUnmount,
  syncKeywordQueueStripUi,
} from './merchant.keyword-queue.js';
import {
  toggleBulletQueue,
  deactivateBulletQueueOnUnmount,
  syncBulletQueueStripUi,
} from './merchant.bullet-queue.js';
import {
  toggleHashtagQueue,
  deactivateHashtagQueueOnUnmount,
  syncHashtagQueueStripUi,
} from './merchant.hashtag-queue.js';
import {
  isAnyMerchantQueueActive,
  setMerchantStripHint,
  syncMerchantQueueHints,
} from './merchant.queue-hints.js';
import { runOneShotPaste } from './merchant.one-shot-paste.js';
import {
  closeSnippetsMenu,
  addSnippetFromInput,
  deleteSnippet,
  insertSnippet,
  toggleSnippetsMenu,
} from './merchant.snippets.js';
let _toastTimer = null;

const QUEUE_TOGGLE_HANDLERS = Object.freeze([
  { action: MERCHANT_ACTIONS.TAG_QUEUE_TOGGLE, toggle: toggleTagQueue, sync: syncTagQueueStripUi },
  { action: MERCHANT_ACTIONS.MATERIAL_QUEUE_TOGGLE, toggle: toggleMaterialQueue, sync: syncMaterialQueueStripUi },
  { action: MERCHANT_ACTIONS.TITLE_QUEUE_TOGGLE, toggle: toggleTitleQueue, sync: syncTitleQueueStripUi },
  { action: MERCHANT_ACTIONS.DESCRIPTION_QUEUE_TOGGLE, toggle: toggleDescriptionQueue, sync: syncDescriptionQueueStripUi },
  { action: MERCHANT_ACTIONS.KEYWORD_QUEUE_TOGGLE, toggle: toggleKeywordQueue, sync: syncKeywordQueueStripUi },
  { action: MERCHANT_ACTIONS.BULLET_QUEUE_TOGGLE, toggle: toggleBulletQueue, sync: syncBulletQueueStripUi },
  { action: MERCHANT_ACTIONS.HASHTAG_QUEUE_TOGGLE, toggle: toggleHashtagQueue, sync: syncHashtagQueueStripUi },
]);

function showMerchantToast(root, message) {
  let toast = root.querySelector('[data-field="pc-merchant-toast"]');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'pc-merchant-toast';
    toast.setAttribute('data-field', 'pc-merchant-toast');
    root.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function updateHint(stripEl) {
  if (isAnyMerchantQueueActive()) {
    syncMerchantQueueHints(stripEl);
    return;
  }
  const hint = stripEl.querySelector('[data-field="pc-merchant-hint"]');
  if (!hint) return;
  if (isImageToTextArmed()) {
    hint.textContent = 'Image → Text — drag region';
    return;
  }
  hint.textContent = getSpotStatusLabel();
}

function getDock() {
  return window.__pasteCraftMerchant?.dock || null;
}

async function handleSpotAction(root, stripEl, spotBtn) {
  const result = await activateSpot();
  spotBtn.setAttribute('aria-pressed', result.staged ? 'true' : 'false');
  updateHint(stripEl);
  showMerchantToast(root, result.message);
}

async function handleImageToTextAction(root, stripEl, imageBtn) {
  const startingCapture = !isImageToTextArmed();
  if (startingCapture) {
    imageBtn?.setAttribute('aria-pressed', 'true');
    updateHint(stripEl);
    showMerchantToast(root, 'Drag to capture region — Esc to cancel');
  }

  const result = await activateImageToText();

  imageBtn?.setAttribute('aria-pressed', 'false');
  updateHint(stripEl);
  if (!startingCapture || result.staged || !result.ok) {
    if (result.message) showMerchantToast(root, result.message);
  }
}

function handleDockToggleAction() {
  const dock = getDock();
  if (!dock) return;
  dock.toggle();
}

async function handleQueueToggle(root, stripEl, handler) {
  const result = await handler.toggle();
  handler.sync();
  updateHint(stripEl);
  showMerchantToast(root, result.message || (result.ok ? 'Queue toggled.' : 'Queue failed.'));
}

async function handleSnippetsToggle(root, stripEl) {
  const result = await toggleSnippetsMenu();
  updateHint(stripEl);
  if (result.message && result.message !== 'Snippets closed.') {
    showMerchantToast(root, result.message);
  }
}

async function handleOneShotPaste(root, stripEl) {
  try {
    const result = await runOneShotPaste({ stripEl });
    if (result.ok) {
      setMerchantStripHint(stripEl, result.message);
    } else {
      updateHint(stripEl);
    }
    showMerchantToast(root, result.message || (result.ok ? 'Fill All complete.' : 'Fill All failed.'));
  } catch (_) {
    updateHint(stripEl);
    showMerchantToast(root, 'Fill All failed — reload the extension and try again.');
  }
}

async function handleDockTargetSelect(root, stripEl, btn) {
  const targetId = btn.getAttribute('data-dock-target');
  if (!targetId) return;
  const result = await saveCaptureDockTarget(targetId);
  syncDockTargetStripUi(stripEl, targetId);
  if (result.ok) {
    showMerchantToast(root, `Spot & Image → Text → ${btn.textContent.trim()}`);
  }
}

async function handleSnippetInsert(root, btn) {
  const snippetId = btn.getAttribute('data-snippet-id');
  if (!snippetId) return;
  const result = await insertSnippet(snippetId);
  showMerchantToast(root, result.message || (result.ok ? 'Snippet copied.' : 'Copy failed.'));
}

async function handleSnippetSave(root, stripEl) {
  const input = stripEl.querySelector('[data-field="pc-merchant-snippet-new-text"]');
  const result = await addSnippetFromInput(input?.value || '');
  if (result.ok && input) {
    input.value = '';
  }
  showMerchantToast(root, result.message || (result.ok ? 'Snippet saved.' : 'Save failed.'));
}

async function handleSnippetDelete(root, btn) {
  const snippetId = btn.getAttribute('data-snippet-id');
  if (!snippetId) return;
  const result = await deleteSnippet(snippetId);
  showMerchantToast(root, result.message || (result.ok ? 'Snippet removed.' : 'Delete failed.'));
}

export function bindMerchantStripEvents(root, stripEl) {
  if (!root || !stripEl || stripEl.dataset.pcMerchantEventsBound === '1') {
    return;
  }
  stripEl.dataset.pcMerchantEventsBound = '1';
  initSelectionCache();

  stripEl.addEventListener('pointerdown', (event) => {
    const spotBtn = event.target.closest(`[data-action="${MERCHANT_ACTIONS.SPOT}"]`);
    if (spotBtn && stripEl.contains(spotBtn)) {
      cachePageSelection();
    }
  });

  stripEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || !stripEl.contains(btn)) return;

    const action = btn.getAttribute('data-action');
    if (action === MERCHANT_ACTIONS.DOCK_TOGGLE) {
      event.preventDefault();
      handleDockToggleAction();
      return;
    }
    if (action === MERCHANT_ACTIONS.ONE_SHOT_PASTE) {
      event.preventDefault();
      handleOneShotPaste(root, stripEl).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.SPOT) {
      event.preventDefault();
      handleSpotAction(root, stripEl, btn).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.IMAGE_TO_TEXT) {
      event.preventDefault();
      handleImageToTextAction(root, stripEl, btn).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.DOCK_TARGET_SELECT) {
      event.preventDefault();
      handleDockTargetSelect(root, stripEl, btn).catch(() => {});
      return;
    }
    const queueHandler = QUEUE_TOGGLE_HANDLERS.find((entry) => entry.action === action);
    if (queueHandler) {
      event.preventDefault();
      handleQueueToggle(root, stripEl, queueHandler).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.SNIPPETS_TOGGLE) {
      event.preventDefault();
      handleSnippetsToggle(root, stripEl).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.SNIPPET_INSERT) {
      event.preventDefault();
      handleSnippetInsert(root, btn).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.SNIPPET_DELETE) {
      event.preventDefault();
      event.stopPropagation();
      handleSnippetDelete(root, btn).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.SNIPPET_SAVE) {
      event.preventDefault();
      event.stopPropagation();
      handleSnippetSave(root, stripEl).catch(() => {});
    }
  });

  stripEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const btn = event.target.closest('[data-action]');
    if (!btn || !stripEl.contains(btn)) return;
    event.preventDefault();
    btn.click();
  });
}

export function resetMerchantFeatureState(stripEl) {
  deactivateSpot();
  disarmImageToText();
  deactivateTagQueueOnUnmount();
  deactivateMaterialQueueOnUnmount();
  deactivateTitleQueueOnUnmount();
  deactivateDescriptionQueueOnUnmount();
  deactivateKeywordQueueOnUnmount();
  deactivateBulletQueueOnUnmount();
  deactivateHashtagQueueOnUnmount();
  closeSnippetsMenu();
  if (stripEl) {
    const spotBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.SPOT}"]`);
    spotBtn?.setAttribute('aria-pressed', 'false');
    const imageBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.IMAGE_TO_TEXT}"]`);
    imageBtn?.setAttribute('aria-pressed', 'false');
    QUEUE_TOGGLE_HANDLERS.forEach(({ action }) => {
      const queueBtn = stripEl.querySelector(`[data-action="${action}"]`);
      queueBtn?.setAttribute('aria-pressed', 'false');
      queueBtn?.classList.remove('is-active');
    });
    const snippetsBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"]`);
    snippetsBtn?.setAttribute('aria-expanded', 'false');
    updateHint(stripEl);
  }
}
