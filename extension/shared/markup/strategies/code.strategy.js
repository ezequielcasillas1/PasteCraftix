/**
 * @forward-slice markup
 * Strategy: code (fenced / highlighted)
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'code',
    render(text) {
      const match = text.match(/^```([\w-]*)\s*\n([\s\S]+?)\n```\s*$/m);
      if (match) {
        const lang = match[1] || '';
        const code = match[2];
        const highlighted = ns.highlightCode(code, lang);
        return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
      }
      const highlighted = ns.highlightCode(text, '');
      return `<pre class="pc-code-block"><code>${highlighted}</code></pre>`;
    },
    renderPreview(text, _meta, maxChars) {
      const truncated = text.length > (maxChars || 200) ? text.substring(0, maxChars || 200) : text;
      const match = truncated.match(/^```([\w-]*)\s*\n([\s\S]*)/m);
      const lang = match ? match[1] : '';
      const code = match ? match[2].replace(/\n```\s*$/, '') : truncated;
      return `<pre class="pc-code-block pc-code-preview"><code>${ns.highlightCode(code, lang)}</code></pre>`;
    },
  });
})();
