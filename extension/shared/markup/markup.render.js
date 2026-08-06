/**
 * @forward-slice markup
 * Context: delegates render/preview to registered Strategies.
 * Enriches markdown/prose with embedded LaTeX + Mermaid when present.
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  /**
   * @param {string} text - Clip text content
   * @param {object} [meta] - Clip meta object
   * @param {object} [options] - { type?: string, enrich?: boolean }
   * @returns {string|Promise<string>} Sanitized HTML
   */
  function renderMarkup(text, meta, options) {
    if (!text || typeof text !== 'string') return ns.escapeHtml(text || '');
    const type = (options && options.type) || ns.detectMarkupType(text, meta);
    const allowEnrich = !(options && options.enrich === false);

    try {
      if (allowEnrich && typeof ns.needsEnrichment === 'function' && ns.needsEnrichment(text, type)) {
        const baseType = type === 'latex' ? 'markdown' : type;
        return ns.renderEnriched(text, meta, baseType);
      }

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
    if (type === 'text' && !(ns.hasEmbeddedLatex?.(text) || ns.hasEmbeddedMermaid?.(text))) {
      return '';
    }

    const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
    try {
      const strategy = ns.getStrategy(type === 'text' ? 'markdown' : type);
      if (!strategy) return '';

      if (typeof ns.needsEnrichment === 'function' && ns.needsEnrichment(text, type)) {
        const baseType = type === 'latex' || type === 'text' ? 'markdown' : type;
        const enriched = ns.renderEnriched(truncated, meta, baseType, { syncPreview: true });
        if (enriched && typeof enriched.then === 'function') {
          // Preview path must stay sync; fall back to strategy preview/escape.
          if (typeof strategy.renderPreview === 'function') {
            return strategy.renderPreview(text, meta, maxChars);
          }
          return ns.escapeHtml(truncated);
        }
        return enriched;
      }

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
