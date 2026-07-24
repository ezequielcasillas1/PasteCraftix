/**
 * @forward-slice markup
 * Strategy: plain text (default)
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'text',
    render(text) {
      return `<pre class="pc-plain-text">${ns.escapeHtml(text)}</pre>`;
    },
    renderPreview() {
      return '';
    },
  });
})();
