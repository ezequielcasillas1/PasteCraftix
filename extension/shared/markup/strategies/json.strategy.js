/**
 * @forward-slice markup
 * Strategy: json
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'json',
    render(text) {
      try {
        const obj = JSON.parse(text.trim());
        const pretty = JSON.stringify(obj, null, 2);
        const highlighted = ns.highlightCode(pretty, 'json');
        return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
      } catch (_) {
        return `<pre class="pc-code-block"><code>${ns.escapeHtml(text)}</code></pre>`;
      }
    },
    renderPreview(text, _meta, maxChars) {
      try {
        const obj = JSON.parse(text.trim());
        const pretty = JSON.stringify(obj, null, 2);
        const short = pretty.substring(0, maxChars || 200);
        return `<pre class="pc-code-block pc-code-preview"><code>${ns.highlightCode(short, 'json')}</code></pre>`;
      } catch (_) {
        const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
        return `<pre class="pc-code-block pc-code-preview"><code>${ns.escapeHtml(truncated)}</code></pre>`;
      }
    },
  });
})();
