import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { createMerchantQueue } from './merchant.queue-factory.js';

function isLikelyTitleInput(el) {
  if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
  if (el.type && !['text', 'search', ''].includes(el.type)) return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();

  if (field.includes('title') && !field.includes('seo')) return true;
  if (field.includes('product-name') || field.includes('product_name')) return true;
  if (field.includes('listing-title')) return true;
  if (aria.includes('title') && !aria.includes('seo')) return true;
  if (aria.includes('product name') || aria.includes('listing title')) return true;
  if (placeholder.includes('title') && !placeholder.includes('seo')) return true;
  if (name.includes('title') || name.includes('product_name') || name.includes('product-name')) return true;
  if (id.includes('title') && !id.includes('seo')) return true;

  return false;
}

const queue = createMerchantQueue({
  dockField: 'title',
  action: MERCHANT_ACTIONS.TITLE_QUEUE_TOGGLE,
  hintLabel: 'Titles',
  nextItemKey: 'nextTitle',
  stageEmptyMessage: 'Stage titles in Listing Dock first (comma-separated).',
  pasteEmptyMessage: 'No titles staged in dock.',
  pasteCompleteMessage: 'Title queue complete — reset or add more titles.',
  activateMessagePrefix: 'Title queue on — focus title field',
  isLikelyInput: isLikelyTitleInput,
});

export const isTitleQueueActive = queue.isActive;
export const getTitleQueueStatus = queue.getStatus;
export const toggleTitleQueue = queue.toggle;
export const pasteNextTitle = queue.pasteNext;
export const refreshTitleQueue = queue.refresh;
export const resetTitleQueueIndex = queue.resetIndex;
export const deactivateTitleQueueOnUnmount = queue.deactivateOnUnmount;
export const syncTitleQueueStripUi = queue.syncStripUi;
export const initMerchantTitleQueue = queue.init;
