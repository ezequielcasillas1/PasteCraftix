/**
 * Test Lab adapter factory — maps dock fields to provider DOM selectors.
 * @typedef {Object} MerchantFieldMapEntry
 * @property {string} selector
 * @property {string} [fallbackField]
 * @property {string} [strategy]
 *
 * @typedef {Object} MerchantAdapter
 * @property {string} platformId
 * @property {(ctx?: { href?: string }) => boolean} canHandle
 * @property {string[]} dispatchOrder
 * @property {Record<string, MerchantFieldMapEntry>} fieldMap
 * @property {string} fillStrategy
 */

export function createTestLabAdapter({
  platformId,
  bodyPlatform,
  pathHint,
  fieldMap,
  dispatchOrder,
  fillStrategy = 'direct-set',
}) {
  return {
    platformId,
    canHandle(ctx = {}) {
      const href = ctx.href || (typeof location !== 'undefined' ? location.href : '');
      const bodyMatch = typeof document !== 'undefined'
        && document.body?.getAttribute?.('data-platform') === bodyPlatform;
      if (bodyMatch) return true;
      try {
        const url = new URL(href);
        return url.pathname.includes(pathHint);
      } catch (_) {
        return false;
      }
    },
    dispatchOrder,
    fieldMap,
    fillStrategy,
  };
}
