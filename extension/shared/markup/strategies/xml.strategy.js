/**
 * @forward-slice markup
 * Strategy: xml
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'xml',
    render(text) {
      const highlighted = ns.highlightCode(text, 'xml');
      return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
    },
    renderPreview(text, _meta, maxChars) {
      const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
      return `<pre class="pc-code-block pc-code-preview"><code>${ns.highlightCode(truncated, 'xml')}</code></pre>`;
    },
  });
})();
