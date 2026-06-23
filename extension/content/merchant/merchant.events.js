import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { activateSpotPlaceholder, deactivateSpotPlaceholder, getSpotStatusLabel } from './merchant.spot.js';
import { toggleImageToTextPlaceholder } from './merchant.image-to-text.js';

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
  if (hint) {
    hint.textContent = getSpotStatusLabel();
  }
}

function handleSpotAction(root, stripEl, spotBtn) {
  const result = activateSpotPlaceholder();
  spotBtn.setAttribute('aria-pressed', 'true');
  updateHint(stripEl);
  showMerchantToast(root, result.message);
}

function handleImageToTextAction(root, stripEl) {
  const result = toggleImageToTextPlaceholder();
  updateHint(stripEl);
  showMerchantToast(root, result.message);
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
    if (action === MERCHANT_ACTIONS.SPOT) {
      event.preventDefault();
      handleSpotAction(root, stripEl, btn);
      return;
    }
    if (action === MERCHANT_ACTIONS.IMAGE_TO_TEXT) {
      event.preventDefault();
      handleImageToTextAction(root, stripEl);
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
  deactivateSpotPlaceholder();
  if (stripEl) {
    const spotBtn = stripEl.querySelector(`[data-action="${MERCHANT_ACTIONS.SPOT}"]`);
    spotBtn?.setAttribute('aria-pressed', 'false');
    updateHint(stripEl);
  }
}
