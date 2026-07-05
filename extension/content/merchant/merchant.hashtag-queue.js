import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { createMerchantQueue } from './merchant.queue-factory.js';

function isLikelyHashtagInput(el) {
  if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
  if (el.type && !['text', 'search', ''].includes(el.type)) return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();

  if (field.includes('hashtag') || field.includes('hash-tag')) return true;
  if (field.includes('social-tag')) return true;
  if (aria.includes('hashtag')) return true;
  if (placeholder.includes('#') || placeholder.includes('hashtag')) return true;
  if (name.includes('hashtag')) return true;
  if (id.includes('hashtag')) return true;

  return false;
}

const queue = createMerchantQueue({
  dockField: 'hashtags',
  action: MERCHANT_ACTIONS.HASHTAG_QUEUE_TOGGLE,
  hintLabel: 'Hashtags',
  nextItemKey: 'nextHashtag',
  stageEmptyMessage: 'Stage hashtags in Listing Dock first (comma-separated).',
  pasteEmptyMessage: 'No hashtags staged in dock.',
  pasteCompleteMessage: 'Hashtag queue complete — reset or add more.',
  activateMessagePrefix: 'Hashtag queue on — focus hashtag field',
  isLikelyInput: isLikelyHashtagInput,
});

export const isHashtagQueueActive = queue.isActive;
export const getHashtagQueueStatus = queue.getStatus;
export const toggleHashtagQueue = queue.toggle;
export const pasteNextHashtag = queue.pasteNext;
export const refreshHashtagQueue = queue.refresh;
export const resetHashtagQueueIndex = queue.resetIndex;
export const deactivateHashtagQueueOnUnmount = queue.deactivateOnUnmount;
export const syncHashtagQueueStripUi = queue.syncStripUi;
export const initMerchantHashtagQueue = queue.init;
