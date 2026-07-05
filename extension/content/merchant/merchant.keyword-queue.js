import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { createMerchantQueue } from './merchant.queue-factory.js';

function isLikelyKeywordInput(el) {
  if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
  if (el.type && !['text', 'search', ''].includes(el.type)) return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();
  const maxLen = el.maxLength > 0 ? el.maxLength : null;

  if (field.includes('keyword') || field.includes('search-term') || field.includes('search_term')) return true;
  if (field.includes('backend') && field.includes('keyword')) return true;
  if (aria.includes('keyword') || aria.includes('search term')) return true;
  if (placeholder.includes('keyword') || placeholder.includes('search term')) return true;
  if (name.includes('keyword') || name.includes('search_term')) return true;
  if (id.includes('keyword')) return true;
  // Printify keyword slots use maxlength 40 without always exposing "keyword" in labels.
  if (maxLen != null && maxLen <= 40) return true;
  if (maxLen != null && maxLen <= 50 && (field.includes('amazon') || id.includes('keyword'))) return true;

  return false;
}

const queue = createMerchantQueue({
  dockField: 'keywords',
  fallbackDockField: 'tags',
  action: MERCHANT_ACTIONS.KEYWORD_QUEUE_TOGGLE,
  hintLabel: 'Keywords',
  nextItemKey: 'nextKeyword',
  stageEmptyMessage: 'Stage keywords in Listing Dock (or tags as fallback).',
  pasteEmptyMessage: 'No keywords staged in dock.',
  pasteCompleteMessage: 'Keyword queue complete — reset or add more.',
  activateMessagePrefix: 'Keyword queue on — focus keyword field',
  isLikelyInput: isLikelyKeywordInput,
});

export const isKeywordQueueActive = queue.isActive;
export const getKeywordQueueStatus = queue.getStatus;
export const toggleKeywordQueue = queue.toggle;
export const pasteNextKeyword = queue.pasteNext;
export const refreshKeywordQueue = queue.refresh;
export const resetKeywordQueueIndex = queue.resetIndex;
export const deactivateKeywordQueueOnUnmount = queue.deactivateOnUnmount;
export const syncKeywordQueueStripUi = queue.syncStripUi;
export const initMerchantKeywordQueue = queue.init;
