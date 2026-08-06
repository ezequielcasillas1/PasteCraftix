/**
 * @forward-slice markup
 * Public API object (assigned to window.PCMarkup by facade).
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.createPublicApi = function createPublicApi() {
    return {
      detectMarkupType: ns.detectMarkupType,
      renderMarkup: ns.renderMarkup,
      renderMarkupPreview: ns.renderMarkupPreview,
      renderEnriched: ns.renderEnriched,
      needsEnrichment: ns.needsEnrichment,
      getMarkupBadge: ns.getMarkupBadge,
      getMarkupBadgeForClip: ns.getMarkupBadgeForClip,
      sanitize: ns.sanitize,
      escapeHtml: ns.escapeHtml,
      highlightCode: ns.highlightCode,
    };
  };
})();
