import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { clearListingDock } from './merchant.dock-storage.js';
import { refreshMerchantPulse } from './merchant.pulse.js';
import { getSpotStatusLabel } from './merchant.spot.js';
import { closeSnippetsMenu } from './merchant.snippets.js';
import { deactivateTagQueueOnUnmount, syncTagQueueStripUi } from './merchant.tag-queue.js';

const CONFIRM_MESSAGE =
  'Purge all ephemeral listing staging? This cannot be undone.';

function ensureSealModal(root) {
  let backdrop = root.querySelector('[data-field="pc-merchant-seal-backdrop"]');
  if (backdrop) return backdrop;

  backdrop = document.createElement('div');
  backdrop.className = 'pc-merchant-seal-backdrop';
  backdrop.setAttribute('data-field', 'pc-merchant-seal-backdrop');
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <div class="pc-merchant-seal-dialog" role="dialog" aria-modal="true" aria-labelledby="pc-merchant-seal-title">
      <h3 class="pc-merchant-seal-title" data-field="pc-merchant-seal-title">Seal &amp; Ship</h3>
      <p class="pc-merchant-seal-message">${CONFIRM_MESSAGE}</p>
      <div class="pc-merchant-seal-actions">
        <button type="button" class="pc-merchant-seal-btn" data-action="${MERCHANT_ACTIONS.SEAL_CANCEL}">Cancel</button>
        <button type="button" class="pc-merchant-seal-btn pc-merchant-seal-btn-confirm" data-action="${MERCHANT_ACTIONS.SEAL_CONFIRM}">Purge staging</button>
      </div>
    </div>
  `;
  root.appendChild(backdrop);
  return backdrop;
}

function confirmSealAndShip(root) {
  if (!root) {
    return Promise.resolve(window.confirm(`Seal & Ship — ${CONFIRM_MESSAGE}`));
  }

  return new Promise((resolve) => {
    const backdrop = ensureSealModal(root);
    backdrop.hidden = false;

    const confirmBtn = backdrop.querySelector(`[data-action="${MERCHANT_ACTIONS.SEAL_CONFIRM}"]`);
    confirmBtn?.focus();

    const finish = (confirmed) => {
      backdrop.hidden = true;
      backdrop.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      resolve(confirmed);
    };

    const onClick = (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn || !backdrop.contains(btn)) {
        if (event.target === backdrop) {
          finish(false);
        }
        return;
      }
      const action = btn.getAttribute('data-action');
      if (action === MERCHANT_ACTIONS.SEAL_CONFIRM) {
        event.preventDefault();
        finish(true);
      }
      if (action === MERCHANT_ACTIONS.SEAL_CANCEL) {
        event.preventDefault();
        finish(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
    };

    backdrop.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
  });
}

export async function runSealAndShip({ stripEl, root } = {}) {
  const modalRoot = root || window.__pasteCraftMerchant?.strip?.root || null;
  const confirmed = await confirmSealAndShip(modalRoot);
  if (!confirmed) {
    return { ok: false, message: 'Seal & Ship cancelled.' };
  }

  const clearResult = await clearListingDock();
  if (!clearResult.ok) {
    return { ok: false, message: clearResult.error || 'Purge failed.' };
  }

  deactivateTagQueueOnUnmount();
  closeSnippetsMenu();
  syncTagQueueStripUi();

  const dock = window.__pasteCraftMerchant?.dock;
  dock?.setFieldValues?.({});
  dock?.close?.();

  if (stripEl) {
    await refreshMerchantPulse(stripEl);
    const queueBtn = stripEl.querySelector('[data-action="merchant-tag-queue-toggle"]');
    queueBtn?.setAttribute('aria-pressed', 'false');
    queueBtn?.classList.remove('is-active');
    const hint = stripEl.querySelector('[data-field="pc-merchant-hint"]');
    if (hint) hint.textContent = getSpotStatusLabel();
  }

  return { ok: true, message: 'Sealed — staging purged.' };
}
