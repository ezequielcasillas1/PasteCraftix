/**
 * @forward-slice markup
 * Context: delegates render/preview to registered Strategies.
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  /**
   * @param {string} text - Clip text content
   * @param {object} [meta] - Clip meta object
   * @param {object} [options] - { type?: string }
   * @returns {string|Promise<string>} Sanitized HTML
   */
  function renderMarkup(text, meta, options) {
    if (!text || typeof text !== 'string') return ns.escapeHtml(text || '');
    const type = (options && options.type) || ns.detectMarkupType(text, meta);

    try {
      const strategy = ns.getStrategy(type);
      if (!strategy || typeof strategy.render !== 'function') {
        return `<pre class="pc-plain-text">${ns.escapeHtml(text)}</pre>`;
      }
      return strategy.render(text, meta);
    } catch (_) {
      return `<pre class="pc-plain-text">${ns.escapeHtml(text)}</pre>`;
    }
  }

  function renderMarkupPreview(text, meta, maxChars, detectedType) {
    if (!text || typeof text !== 'string') return ns.escapeHtml(text || '');
    const type = detectedType || ns.detectMarkupType(text, meta);
    if (type === 'text') return '';

    const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
    try {
      const strategy = ns.getStrategy(type);
      if (!strategy) return '';
      if (typeof strategy.renderPreview === 'function') {
        return strategy.renderPreview(text, meta, maxChars);
      }
      return strategy.render(truncated, meta);
    } catch (_) {
      return '';
    }
  }

  ns.renderMarkup = renderMarkup;
  ns.renderMarkupPreview = renderMarkupPreview;
})();
