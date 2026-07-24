/**
 * @forward-slice markup
 * Strategy: latex
 */
(() => {
  'use strict';

  const ns = (typeof window !== 'undefined' ? window : globalThis).__PCMarkupNS;

  ns.registerStrategy({
    type: 'latex',
    render(text) {
      if (typeof katex === 'undefined') return `<pre>${ns.escapeHtml(text)}</pre>`;
      try {
        let processed = text;
        processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
          try { return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
          catch (e) { return `<code>${ns.escapeHtml(expr)}</code>`; }
        });
        processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => {
          try { return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
          catch (e) { return `<code>${ns.escapeHtml(expr)}</code>`; }
        });
        processed = processed.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
          try { return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
          catch (e) { return `<code>${ns.escapeHtml(expr)}</code>`; }
        });
        processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => {
          try { return katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
          catch (e) { return `<code>${ns.escapeHtml(expr)}</code>`; }
        });
        if (processed === text) {
          const stripped = text.replace(/^\\\[|\\\]$|^\$\$|\$\$$|^\\begin\{.*?\}|\\end\{.*?\}$/g, '').trim();
          return katex.renderToString(stripped || text, { displayMode: true, throwOnError: false });
        }
        return `<div class="pc-latex-rendered">${processed}</div>`;
      } catch (_) {
        return `<pre>${ns.escapeHtml(text)}</pre>`;
      }
    },
  });
})();
