import { resolveMerchantAdapter } from './merchant.adapters/index.js';
import { fillFieldGroup } from './merchant.adapters/adapter-fill.js';
import { readListingDock } from './merchant.dock-storage.js';
import {
  refreshAllMerchantQueues,
  resetAllMerchantQueueIndices,
  deactivateAllMerchantQueues,
} from './merchant.queue-all.js';
import { splitMaterialsInput } from './merchant.materials.js';
import { splitQueueInput } from './merchant.queue-parse.js';
import { validateTags } from './merchant.tags.js';
import { readMerchantPrefs, getPlatformProfile } from './merchant.tag-queue.js';
import { setMerchantStripHint } from './merchant.queue-hints.js';

const FIELD_LABELS = Object.freeze({
  tags: 'Tags',
  materials: 'Materials',
  title: 'Title',
  description: 'Description',
  keywords: 'Keywords',
  bullets: 'Bullets',
  hashtags: 'Hashtags',
});

function getLiveDockValues() {
  return window.__pasteCraftMerchant?.dock?.getFieldValues?.() || {};
}

function resolveFieldRaw(dockField, payload, live, fieldConfig) {
  let raw = (live[dockField] || '').trim() || (payload?.[dockField] || '').trim();
  if (!raw && fieldConfig?.fallbackField) {
    const fallback = fieldConfig.fallbackField;
    raw = (live[fallback] || '').trim() || (payload?.[fallback] || '').trim();
  }
  return raw;
}

function resolveFieldItems(dockField, raw, tagProfile) {
  if (!raw) return [];
  if (dockField === 'tags') {
    return validateTags(raw, tagProfile).tags;
  }
  if (dockField === 'materials') {
    return splitMaterialsInput(raw);
  }
  return splitQueueInput(raw);
}

/**
 * One-shot paste — fill all staged dock fields via provider adapter (Test Lab Phase 1).
 */
export async function runOneShotPaste({ stripEl } = {}) {
  const adapter = resolveMerchantAdapter({ href: location.href });

  await refreshAllMerchantQueues();
  resetAllMerchantQueueIndices();
  deactivateAllMerchantQueues();

  const payload = await readListingDock();
  const live = getLiveDockValues();
  const prefs = await readMerchantPrefs();
  const tagProfile = getPlatformProfile(prefs.platformPreset, prefs);
  const strategy = adapter.fillStrategy || 'direct-set';
  const order = adapter.dispatchOrder || [];

  let totalFilled = 0;
  const details = [];

  for (const dockField of order) {
    const fieldConfig = adapter.fieldMap[dockField];
    if (!fieldConfig?.selector) continue;

    const raw = resolveFieldRaw(dockField, payload, live, fieldConfig);
    const items = resolveFieldItems(dockField, raw, tagProfile);
    if (items.length === 0) continue;

    const result = fillFieldGroup(
      fieldConfig.selector,
      items,
      fieldConfig.strategy || strategy,
    );
    totalFilled += result.filled;
    details.push({ field: dockField, ...result });
    if (stripEl && result.filled > 0) {
      const label = FIELD_LABELS[dockField] || dockField;
      setMerchantStripHint(
        stripEl,
        `Fill All — ${label}: ${result.filled}/${items.length} pasted`,
      );
    }
  }

  if (totalFilled === 0) {
    return {
      ok: false,
      message: 'Nothing staged to fill — add tags/title in Listing Dock first.',
      adapter: adapter.platformId,
    };
  }

  return {
    ok: true,
    message: `Fill All — ${totalFilled} value(s) pasted (${adapter.platformId})`,
    adapter: adapter.platformId,
    totalFilled,
    details,
  };
}
