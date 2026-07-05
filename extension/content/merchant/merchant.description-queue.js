import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { createMerchantQueue } from './merchant.queue-factory.js';

function isLikelyDescriptionInput(el) {
  if (!el || el.tagName !== 'TEXTAREA') return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();

  if (field.includes('description') || field.includes('desc')) return true;
  if (field.includes('product-description')) return true;
  if (aria.includes('description') || aria.includes('product description')) return true;
  if (placeholder.includes('description')) return true;
  if (name.includes('description') || name.includes('product_description')) return true;
  if (id.includes('description')) return true;

  return false;
}

const queue = createMerchantQueue({
  dockField: 'description',
  action: MERCHANT_ACTIONS.DESCRIPTION_QUEUE_TOGGLE,
  hintLabel: 'Descriptions',
  nextItemKey: 'nextDescription',
  stageEmptyMessage: 'Stage descriptions in Listing Dock first (comma-separated).',
  pasteEmptyMessage: 'No descriptions staged in dock.',
  pasteCompleteMessage: 'Description queue complete — reset or add more.',
  activateMessagePrefix: 'Description queue on — focus description field',
  isLikelyInput: isLikelyDescriptionInput,
});

export const isDescriptionQueueActive = queue.isActive;
export const getDescriptionQueueStatus = queue.getStatus;
export const toggleDescriptionQueue = queue.toggle;
export const pasteNextDescription = queue.pasteNext;
export const refreshDescriptionQueue = queue.refresh;
export const resetDescriptionQueueIndex = queue.resetIndex;
export const deactivateDescriptionQueueOnUnmount = queue.deactivateOnUnmount;
export const syncDescriptionQueueStripUi = queue.syncStripUi;
export const initMerchantDescriptionQueue = queue.init;
