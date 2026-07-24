/**
 * PasteCraft Markup Renderer — thin facade
 * Implementation: extension/shared/markup/** (Strategy-per-type)
 * Depends on: marked, DOMPurify, hljs, katex (loaded globally via popup.html)
 * Mermaid is lazy-loaded only when needed.
 *
 * Load shared/markup modules (see shared/markup/markup.load-order.js) before this file.
 */
(() => {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;
  const ns = root.__PCMarkupNS;

  if (!ns || typeof ns.createPublicApi !== 'function') {
    console.warn('[PasteCraft] PCMarkup modules not loaded; markup-renderer facade idle.');
    return;
  }

  root.PCMarkup = ns.createPublicApi();
})();
