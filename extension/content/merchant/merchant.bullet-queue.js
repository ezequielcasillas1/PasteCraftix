import { MERCHANT_ACTIONS } from './merchant.constants.js';
import { createMerchantQueue } from './merchant.queue-factory.js';

function isLikelyBulletInput(el) {
  if (!el || el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return false;
  if (el.type && !['text', 'search', ''].includes(el.type)) return false;
  if (el.disabled || el.readOnly) return false;

  const field = (el.getAttribute('data-field') || '').toLowerCase();
  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.getAttribute('id') || '').toLowerCase();

  if (field.includes('bullet')) return true;
  if (field.includes('feature') && !field.includes('image')) return true;
  if (aria.includes('bullet') || aria.includes('feature')) return true;
  if (placeholder.includes('bullet')) return true;
  if (name.includes('bullet') || name.includes('feature')) return true;
  if (id.includes('bullet')) return true;

  return false;
}

const queue = createMerchantQueue({
  dockField: 'bullets',
  action: MERCHANT_ACTIONS.BULLET_QUEUE_TOGGLE,
  hintLabel: 'Bullets',
  nextItemKey: 'nextBullet',
  stageEmptyMessage: 'Stage bullets in Listing Dock first (comma-separated).',
  pasteEmptyMessage: 'No bullets staged in dock.',
  pasteCompleteMessage: 'Bullet queue complete — reset or add more.',
  activateMessagePrefix: 'Bullet queue on — focus bullet field',
  isLikelyInput: isLikelyBulletInput,
});

export const isBulletQueueActive = queue.isActive;
export const getBulletQueueStatus = queue.getStatus;
export const toggleBulletQueue = queue.toggle;
export const pasteNextBullet = queue.pasteNext;
export const refreshBulletQueue = queue.refresh;
export const resetBulletQueueIndex = queue.resetIndex;
export const deactivateBulletQueueOnUnmount = queue.deactivateOnUnmount;
export const syncBulletQueueStripUi = queue.syncStripUi;
export const initMerchantBulletQueue = queue.init;
