/**
 * @forward-slice markup
 * Strategy: markdown
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'markdown',
    render(text) {
      if (typeof marked === 'undefined') {
        return `<pre class="pc-plain-text">${ns.escapeHtml(text)}</pre>`;
      }
      const html = marked.parse(text, { gfm: true, breaks: true });
      return ns.sanitize(html);
    },
  });
})();
