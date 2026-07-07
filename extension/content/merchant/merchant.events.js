import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { activateSpot, deactivateSpot, getSpotStatusLabel } from './merchant.spot.js';
import { toggleImageToTextPlaceholder, runImageToTextCapture, disarmImageToText, isImageToTextArmed } from './merchant.image-to-text.js';
import {
  toggleTagQueue,
  deactivateTagQueueOnUnmount,
  syncTagQueueStripUi,
  isTagQueueActive,
} from './merchant.tag-queue.js';
import { closeSnippetsMenu, insertSnippet, toggleSnippetsMenu } from './merchant.snippets.js';
import { runSealAndShip } from './merchant.seal-ship.js';

let _toastTimer = null;

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
  const hint = stripEl.querySelector('[data-field="pc-merchant-hint"]');
  if (!hint) return;
  if (isTagQueueActive()) {
    syncTagQueueStripUi();
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

async function handleImageToTextAction(root, stripEl) {
  const result = isImageToTextArmed()
    ? await runImageToTextCapture()
    : toggleImageToTextPlaceholder();
  updateHint(stripEl);
  showMerchantToast(root, result.message);
}

function handleDockToggleAction() {
  const dock = getDock();
  if (!dock) return;
  dock.toggle();
}

async function handleTagQueueToggle(root, stripEl) {
  const result = await toggleTagQueue();
  syncTagQueueStripUi();
  updateHint(stripEl);
  showMerchantToast(root, result.message || (result.ok ? 'Tag queue toggled.' : 'Tag queue failed.'));
}

async function handleSnippetsToggle(root, stripEl) {
  const result = await toggleSnippetsMenu();
  updateHint(stripEl);
  if (result.message && result.message !== 'Snippets closed.') {
    showMerchantToast(root, result.message);
  }
}

async function handleSnippetInsert(root, btn) {
  const snippetId = btn.getAttribute('data-snippet-id');
  if (!snippetId) return;
  const result = await insertSnippet(snippetId);
  showMerchantToast(root, result.message || (result.ok ? 'Snippet inserted.' : 'Insert failed.'));
}

async function handleSealShip(root, stripEl) {
  const result = await runSealAndShip({ stripEl, root });
  updateHint(stripEl);
  showMerchantToast(root, result.message || (result.ok ? 'Staging purged.' : 'Seal & Ship failed.'));
}

export function bindMerchantStripEvents(root, stripEl) {
  if (!root || !stripEl || stripEl.dataset.pcMerchantEventsBound === '1') {
    return;
  }
  stripEl.dataset.pcMerchantEventsBound = '1';

  stripEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn || !stripEl.contains(btn)) return;

    const action = btn.getAttribute('data-action');
    if (action === MERCHANT_ACTIONS.DOCK_TOGGLE) {
      event.preventDefault();
      handleDockToggleAction();
      return;
    }
    if (action === MERCHANT_ACTIONS.SPOT) {
      event.preventDefault();
      handleSpotAction(root, stripEl, btn).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.IMAGE_TO_TEXT) {
      event.preventDefault();
      handleImageToTextAction(root, stripEl).catch(() => {});
      return;
    }
    if (action === MERCHANT_ACTIONS.TAG_QUEUE_TOGGLE) {
      event.preventDefault();
      handleTagQueueToggle(root, stripEl).catch(() => {});
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
    if (action === MERCHANT_ACTIONS.SEAL_SHIP) {
      event.preventDefault();
      handleSealShip(root, stripEl).catch(() => {});
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
  closeSnippetsMenu();
  if (stripEl) {
    const spotBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.SPOT}"]`);
    spotBtn?.setAttribute('aria-pressed', 'false');
    const queueBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.TAG_QUEUE_TOGGLE}"]`);
    queueBtn?.setAttribute('aria-pressed', 'false');
    queueBtn?.classList.remove('is-active');
    const snippetsBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.SNIPPETS_TOGGLE}"]`);
    snippetsBtn?.setAttribute('aria-expanded', 'false');
    updateHint(stripEl);
  }
}
