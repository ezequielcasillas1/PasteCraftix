import { getTagQueueStatus, isTagQueueActive } from './merchant.tag-queue.js';
import { getMaterialQueueStatus, isMaterialQueueActive } from './merchant.material-queue.js';
import { getTitleQueueStatus, isTitleQueueActive } from './merchant.title-queue.js';
import { getDescriptionQueueStatus, isDescriptionQueueActive } from './merchant.description-queue.js';
import { getKeywordQueueStatus, isKeywordQueueActive } from './merchant.keyword-queue.js';
import { getBulletQueueStatus, isBulletQueueActive } from './merchant.bullet-queue.js';
import { getHashtagQueueStatus, isHashtagQueueActive } from './merchant.hashtag-queue.js';

function queueHintPart(isActive, getStatus, label, nextKey, emptyMessage, completeMessage) {
  if (!isActive()) return null;
  const status = getStatus();
  if (status.empty) return `${label} queue — ${emptyMessage}`;
  if (status.done) return `${label} queue complete`;
  const next = status[nextKey];
  return next
    ? `${label} ${status.at}/${status.total}: ${next}`
    : `${label} ${status.at}/${status.total}`;
}

export function isAnyMerchantQueueActive() {
  return isTagQueueActive()
    || isMaterialQueueActive()
    || isTitleQueueActive()
    || isDescriptionQueueActive()
    || isKeywordQueueActive()
    || isBulletQueueActive()
    || isHashtagQueueActive();
}

export function setMerchantStripHint(stripEl, message) {
  const hint = stripEl?.querySelector('[data-field="pc-merchant-hint"]');
  if (!hint || !message) return;
  hint.textContent = message;
}

export function syncMerchantQueueHints(stripEl) {
  const hint = stripEl?.querySelector('[data-field="pc-merchant-hint"]');
  if (!hint) return;
  const parts = [
    queueHintPart(isTagQueueActive, getTagQueueStatus, 'Tags', 'nextTag', 'stage tags in dock first', 'Tag queue complete'),
    queueHintPart(isMaterialQueueActive, getMaterialQueueStatus, 'Materials', 'nextMaterial', 'stage materials in dock first', 'Material queue complete'),
    queueHintPart(isTitleQueueActive, getTitleQueueStatus, 'Titles', 'nextTitle', 'stage titles in dock first', 'Title queue complete'),
    queueHintPart(isDescriptionQueueActive, getDescriptionQueueStatus, 'Descriptions', 'nextDescription', 'stage descriptions in dock first', 'Description queue complete'),
    queueHintPart(isKeywordQueueActive, getKeywordQueueStatus, 'Keywords', 'nextKeyword', 'stage keywords in dock first', 'Keyword queue complete'),
    queueHintPart(isBulletQueueActive, getBulletQueueStatus, 'Bullets', 'nextBullet', 'stage bullets in dock first', 'Bullet queue complete'),
    queueHintPart(isHashtagQueueActive, getHashtagQueueStatus, 'Hashtags', 'nextHashtag', 'stage hashtags in dock first', 'Hashtag queue complete'),
  ].filter(Boolean);
  hint.textContent = parts.length > 0 ? parts.join(' · ') : '';
}
