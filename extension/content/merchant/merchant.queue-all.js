import { refreshTagQueueTags, resetTagQueueIndex, deactivateTagQueue } from './merchant.tag-queue.js';
import { refreshMaterialQueueMaterials, resetMaterialQueueIndex, deactivateMaterialQueue } from './merchant.material-queue.js';
import { refreshTitleQueue, resetTitleQueueIndex, deactivateTitleQueueOnUnmount } from './merchant.title-queue.js';
import { refreshDescriptionQueue, resetDescriptionQueueIndex, deactivateDescriptionQueueOnUnmount } from './merchant.description-queue.js';
import { refreshKeywordQueue, resetKeywordQueueIndex, deactivateKeywordQueueOnUnmount } from './merchant.keyword-queue.js';
import { refreshBulletQueue, resetBulletQueueIndex, deactivateBulletQueueOnUnmount } from './merchant.bullet-queue.js';
import { refreshHashtagQueue, resetHashtagQueueIndex, deactivateHashtagQueueOnUnmount } from './merchant.hashtag-queue.js';

export async function refreshAllMerchantQueues() {
  await Promise.all([
    refreshTagQueueTags(),
    refreshMaterialQueueMaterials(),
    refreshTitleQueue(),
    refreshDescriptionQueue(),
    refreshKeywordQueue(),
    refreshBulletQueue(),
    refreshHashtagQueue(),
  ]);
}

export function resetAllMerchantQueueIndices() {
  resetTagQueueIndex();
  resetMaterialQueueIndex();
  resetTitleQueueIndex();
  resetDescriptionQueueIndex();
  resetKeywordQueueIndex();
  resetBulletQueueIndex();
  resetHashtagQueueIndex();
}

/**
 * Deactivate all queues and unbind their page listeners.
 */
export function deactivateAllMerchantQueues() {
  deactivateTagQueue();
  deactivateMaterialQueue();
  deactivateTitleQueueOnUnmount();
  deactivateDescriptionQueueOnUnmount();
  deactivateKeywordQueueOnUnmount();
  deactivateBulletQueueOnUnmount();
  deactivateHashtagQueueOnUnmount();
}
